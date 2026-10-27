#!/usr/bin/env bash
# Restores a scripts/backup.sh file into an EMPTY database, then checks the row counts (US-015).
#   scripts/restore.sh /var/backups/zupnija/zupnija-2026-10-27.tar              # into $TARGET_DB
#   scripts/restore.sh --uploads /var/backups/zupnija/zupnija-2026-10-27.tar    # also the uploads volume
# Restore drill (no downtime): TARGET_DB=zupnija_drill scripts/restore.sh <file> creates that database,
# restores, compares the counts and leaves it for a look; drop it afterwards.
# A real restore: docs/TECHNICAL.md, "Urejevalnik" → "Restore".
set -euo pipefail

ZUPNIJA_DIR=${ZUPNIJA_DIR:-/srv/zupnija}
TARGET_DB=${TARGET_DB:-zupnija}
UPLOADS_VOLUME=${UPLOADS_VOLUME:-zupnija_uploads}

die() { echo "restore: $*" >&2; exit 1; }
uploads=false
if [ "${1:-}" = "--uploads" ]; then uploads=true; shift; fi
[ $# -eq 1 ] || die "usage: restore.sh [--uploads] <zupnija-YYYY-MM-DD.tar>"
[ -f "$1" ] || die "no file $1"
file=$(realpath "$1")
[[ "$TARGET_DB" =~ ^[a-z0-9_]+$ ]] || die "TARGET_DB may use a-z, 0-9 and _"
cd "$ZUPNIJA_DIR" || die "no $ZUPNIJA_DIR"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tar -C "$work" -xf "$file" || die "can't read $file"
[ -s "$work/db.dump" ] || die "$file has no db.dump"

psql_() { docker compose exec -T db psql -U zupnija -XAtq -v ON_ERROR_STOP=1 "$@"; }

if [ -z "$(psql_ -d postgres -c "select 1 from pg_database where datname = '$TARGET_DB'")" ]; then
  psql_ -d postgres -c "create database \"$TARGET_DB\" owner zupnija" || die "create database failed"
fi
tables=$(psql_ -d "$TARGET_DB" -c "select count(*) from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema')")
[ "$tables" = "0" ] || die "database $TARGET_DB is not empty ($tables tables); restore only into an empty one"

docker compose exec -T db pg_restore -U zupnija -d "$TARGET_DB" --no-owner --exit-on-error < "$work/db.dump" \
  || die "pg_restore failed"
echo "restore: database $TARGET_DB restored from $file"

# Same query as backup.sh.
COUNTS_SQL="select table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema') order by 1"
psql_ -d "$TARGET_DB" -F $'\t' -c "$COUNTS_SQL" > "$work/restored.tsv" || die "row counts failed"
if [ -f "$work/counts.tsv" ]; then
  # backup.sh counts just before pg_dump, so a write in between shows up here as a difference.
  if diff -u "$work/counts.tsv" "$work/restored.tsv"; then
    echo "restore: row counts match the backup ($(wc -l < "$work/restored.tsv") tables)"
  else
    die "row counts differ from the backup (above: - backup, + restored)"
  fi
else
  echo "restore: no counts.tsv in the backup, counts not compared"
fi

if $uploads; then
  # Same rule as for the database: only into an empty volume. 1000 = the image's node user.
  # shellcheck disable=SC2016  # expanded inside the container
  docker run --rm -i -v "$UPLOADS_VOLUME:/uploads" postgres:17 sh -c \
    '[ -z "$(ls -A /uploads)" ] || { echo "restore: uploads volume is not empty" >&2; exit 1; }; tar -C /uploads -xzf - && chown -R 1000:1000 /uploads' \
    < "$work/uploads.tar.gz" || die "uploads restore failed"
  echo "restore: uploads restored into $UPLOADS_VOLUME"
fi
