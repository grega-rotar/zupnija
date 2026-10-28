#!/usr/bin/env bash
# Daily backup of the editor's data (US-015): the Postgres database and the uploads volume.
# Runs on t4a as `deploy` from cron (docs/TECHNICAL.md, "Urejevalnik" → "Backups"):
#   15 3 * * * /srv/zupnija/scripts/backup.sh >> /srv/zupnija/backup.log 2>&1
# Writes $BACKUP_DIR/zupnija-YYYY-MM-DD.tar holding
#   db.dump        pg_dump custom format (restore with scripts/restore.sh)
#   uploads.tar.gz the uploads volume
#   counts.tsv     row count per table, which restore.sh compares against
# keeps the newest $BACKUP_KEEP (30) and exits non-zero on any failure.
set -euo pipefail

ZUPNIJA_DIR=${ZUPNIJA_DIR:-/srv/zupnija}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/zupnija}
BACKUP_KEEP=${BACKUP_KEEP:-30}
UPLOADS_VOLUME=${UPLOADS_VOLUME:-zupnija_uploads}

die() { echo "backup: $*" >&2; exit 1; }
cd "$ZUPNIJA_DIR" || die "no $ZUPNIJA_DIR"
mkdir -p "$BACKUP_DIR"
umask 077   # intentions name real people (PRD, Privacy)

name="zupnija-$(date +%F)"
out="$BACKUP_DIR/$name.tar"
work=$(mktemp -d "$BACKUP_DIR/.$name.XXXXXX")
trap 'rm -rf "$work"' EXIT

# Same query as restore.sh: every table outside the system schemas with its exact row count.
COUNTS_SQL="select table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema') order by 1"

docker compose exec -T db psql -U zupnija -d zupnija -XAtq -F $'\t' -v ON_ERROR_STOP=1 -c "$COUNTS_SQL" > "$work/counts.tsv" \
  || die "row counts failed"
docker compose exec -T db pg_dump -U zupnija -d zupnija -Fc > "$work/db.dump" || die "pg_dump failed"
[ -s "$work/db.dump" ] || die "pg_dump wrote nothing"
# The postgres image is already on the server and has tar; the volume is mounted read-only.
docker run --rm -v "$UPLOADS_VOLUME:/uploads:ro" postgres:17 tar -C /uploads -czf - . > "$work/uploads.tar.gz" \
  || die "tar of $UPLOADS_VOLUME failed"

tar -C "$work" -cf "$work/$name.tar" db.dump uploads.tar.gz counts.tsv || die "tar failed"
mv -f "$work/$name.tar" "$out"
echo "backup: wrote $out ($(du -h "$out" | cut -f1))"

# Keep the newest $BACKUP_KEEP daily files. Names sort by date.
mapfile -t old < <(find "$BACKUP_DIR" -maxdepth 1 -name 'zupnija-????-??-??.tar' | sort -r | tail -n +"$((BACKUP_KEEP + 1))")
if [ "${#old[@]}" -gt 0 ]; then
  rm -f -- "${old[@]}"
  echo "backup: removed ${#old[@]} old file(s)"
fi

# OFF-SITE HOOK. The target is still an open question (PRD, Open questions: another server,
# Backblaze B2 or Google Drive). Set BACKUP_REMOTE to an rclone remote path, e.g. `b2:zupnija-backup`,
# after `rclone config` as this user. Unset = local copies only.
if [ -n "${BACKUP_REMOTE:-}" ]; then
  command -v rclone > /dev/null || die "BACKUP_REMOTE is set but rclone is not installed"
  rclone copy "$out" "$BACKUP_REMOTE" || die "off-site copy to $BACKUP_REMOTE failed"
  echo "backup: copied to $BACKUP_REMOTE"
fi
