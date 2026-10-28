# Župnija Pirniče — technical documentation

For developers taking over the project. Editor documentation (Slovenian) is in
[`NAVODILA-ZA-UREJANJE.md`](./NAVODILA-ZA-UREJANJE.md).

## 1. Architecture

```
zupnija/
├── studio/   Sanity Studio v6 (standalone, Vite)   → sanity.studio hosting
├── web/      Next.js 16 App Router (React 19)      → Docker on t4a
└── docs/
```

- **Content Lake:** project `hnwav9pa`, dataset `production` (public read).
- **Studio** is standalone and never embedded in Next.js (faster builds,
  auto-updates, TypeGen watch mode).
- **Website** reads content through `next-sanity`'s **Live Content API**
  (`defineLive`). Fetches are cached with Sanity sync tags and invalidated
  automatically when content changes — no webhooks, no manual redeploys.
- All pages are rendered per request (`dynamic = "force-dynamic"` in the root
  layout) because "today", "this week" and expiring announcements depend on the
  current time. The data behind them is cached, so responses stay fast.

Runtime: Node 22+. Package manager: npm (separate lockfiles per app).

## 2. Local development

```bash
# terminal 1 — Studio
cd studio && npm install && npm run dev        # http://localhost:3333

# terminal 2 — website
cd web && npm install
cp .env.example .env.local                      # add SANITY_API_READ_TOKEN (Viewer) for previews
npm run dev                                     # http://localhost:3000
```

CORS: the website origin must be allowed with credentials
(`npx sanity cors add https://your-domain --credentials` from `studio/`).
`http://localhost:3000` is already added.

### Environment variables (`web/.env.local`)

| Name | Public | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | yes | `hnwav9pa` |
| `NEXT_PUBLIC_SANITY_DATASET` | yes | `production` |
| `NEXT_PUBLIC_SANITY_STUDIO_URL` | yes | Studio URL, used by Visual Editing overlays |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical origin fallback (settings.siteUrl wins) |
| `SANITY_API_READ_TOKEN` | **no** | Viewer token; enables draft previews in the Presentation tool |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` | **no** | Contact-form delivery; without a key messages are logged |

Secrets are only read in server-only modules (`src/sanity/token.ts`,
`src/lib/mail.ts`). Never import those from client components.

`studio/.env` (optional): `SANITY_STUDIO_PREVIEW_ORIGIN` — website origin for
the Presentation tool (defaults to `http://localhost:3000`). Set it to the
production URL when deploying the Studio.

## 3. Content model (studio/schemaTypes)

Singletons (fixed ids, created/edited only through the structure):
`settings`, `homePage`, `catechesisPage`.

Documents: `church`, `person`, `massSchedule`, `massDay`, `specialPeriod`,
`announcement`, `weeklyBulletin`, `event`, `article`, `gallery`,
`parishDocument`, `catechesisGroup`, `parishGroup`, `sacrament`, `page`.

Objects: `imageWithAlt`, `seo`, `link`, `attachment`, `blockContent`,
`simpleBlockContent`, `address`, `openingHours`, `faqItem`, `massScheduleEntry`,
`massOccurrence`, `massIntention`, and the page sections `section*` collected in
`pageSections`.

Fixed value lists (weekdays, Mass types, categories …) live in
`studio/lib/constants.ts`; their Slovenian labels for the website are in
`web/src/lib/labels.ts`. Keep both in sync when adding values.

### Masses — how the schedule is computed

`web/src/lib/masses.ts` (`buildMassDays`) turns documents into concrete Masses per day:

1. `massSchedule` without dates = the regular weekly schedule.
2. A dated `massSchedule` valid on the day is added; with `replacesRegular`
   (default) the regular schedule is dropped for that day.
3. A `massDay` for the date: with `replacesSchedule` its Masses are the only
   ones. Otherwise each Mass either **enriches** a scheduled Mass with the same
   `time` + `church` (intentions, note, status, celebrant) or is **added**.

Everything is computed in `Europe/Ljubljana` (`web/src/lib/dates.ts`).

### Page builder

`page.sections` is a constrained array of approved section objects rendered by
`web/src/components/sections/PageSections.tsx`. Editors cannot set colours,
fonts or spacing. Add a section by: schema object in
`studio/schemaTypes/sections/index.ts` → add to `pageSections` → projection in
`PAGE_QUERY` → renderer in `PageSections.tsx` → `npm run typegen`.

## 4. Studio (studio/)

- `sanity.config.ts` — plugins: structure (Slovenian, parish-oriented),
  presentation (preview at `previewUrl.origin`), vision (developers).
  Singleton documents cannot be created from "New document", duplicated,
  unpublished or deleted.
- `structure/index.ts` — the sidebar. Lists are filtered (upcoming Mass days,
  current announcements) with `today` computed in Ljubljana time.
- `presentation/resolve.ts` — document → website URL mapping (locations).
- `scripts/seed-sample-content.ts` — sample dataset, ids prefixed `sample-`
  (`--clean` removes them). Ids must never contain a dot: dotted ids are
  private and invisible to unauthenticated reads.

## 5. Website (web/)

```
src/
├── app/                    routes (Slovenian paths), metadata, sitemap, robots, error/not-found
├── components/             ui primitives, layout, feature components, page sections
├── lib/                    dates, masses, routes, seo, links, labels, mail, utils
└── sanity/
    ├── env.ts / client.ts / live.ts / token.ts / image.ts / image-loader.ts
    ├── queries/            all GROQ (defineQuery) — settings, masses, content
    ├── data.ts             the only data-access layer used by pages
    └── types.generated.ts  TypeGen output (do not edit)
```

Conventions:

- Pages call `src/sanity/data.ts` only. Every function goes through `load()`
  → `sanityFetch` (Live Content API). Metadata fetches pass `stega: false`.
- Any string used for **logic** (lookups, comparisons) goes through
  `clean()` (`src/lib/clean.ts`) so Visual Editing markers cannot break it.
- URLs are built from `src/lib/routes.ts` (`routes.*`, `pathForDocument`).
- Images: `SanityImage` + a custom `next/image` loader (`images.loaderFile`)
  so the Sanity CDN does the resizing; hotspot/crop are respected. Always
  pass `sizes`.
- Rich text: `RichText` (Portable Text with a limited component set).
- Server Components by default. Client components: `Nav`, `Lightbox`,
  `ContactForm`, `DisableDraftMode`, `error.tsx`.
- Contact form: server action in `components/forms/actions.ts`; honeypot +
  minimum fill time; delivery via `lib/mail.ts` (Resend over HTTPS, swappable).
- Privacy: no analytics, no third-party scripts, no cookies except Next.js
  Draft Mode for editors. No cookie banner is needed.

Design tokens live in `src/app/globals.css` (`@theme`): fonts Newsreader
(serif) + Source Sans 3, palette paper/stone/ink/moss/gold, type scale, radii.
Liturgical colours are thin markers only (`SEASON_COLOR`).

### Scripts

```bash
npm run dev | build | start | lint
npx tsc --noEmit
cd ../studio && npm run typegen   # after schema or query changes
```

TypeGen config is in `studio/sanity.cli.ts` (`typegen.path` → `../web/src`,
`generates` → `../web/src/sanity/types.generated.ts`). It also runs during
`sanity dev`/`sanity build`. Result types are named `<QUERY_NAME>_RESULT`.

## 6. SEO & accessibility

- `buildMetadata()` (`src/lib/seo.ts`): document `seo` → content → parish
  settings; canonical, Open Graph, Twitter, `noIndex`.
- JSON-LD: `Church`/Organization (layout), `Event`, `NewsArticle`, `Church`
  (place), `FAQPage`, `BreadcrumbList`.
- `sitemap.ts` combines static routes with all slugged documents;
  `robots.ts` excludes `/api` and `/iskanje`.
- `lang="sl"`, skip link, semantic landmarks, visible focus (gold outline),
  ≥44px tap targets, `prefers-reduced-motion` respected, colour never the only
  carrier of meaning (cancelled Masses are struck through *and* labelled).

## 7. Deployment

### Website → t4a (Docker, GitHub Actions)

```
Browser ─HTTPS─> Cloudflare (proxy) ─HTTPS, origin cert─> Traefik :443 (/srv/edge) ──> web:3000
```

Same setup as rokomet-stats and jakamarinko on the shared server `t4a`
(`77.42.42.60`). The Traefik in `/srv/edge` belongs to the jakamarinko repo
(`etiam-si/jakamarinko`, `infra/edge/`) and owns :443. This app joins its
external `edge` network and routes itself with the `traefik.*` labels in
`infra/compose.yml`.

`.github/workflows/deploy.yml`, on every push to `main`:

1. **check** (web and studio): `npm ci`, lint, typecheck, build; for web also `npm test`
   against a `postgres:17` service on port 5433. Pull requests run only this.
2. **image**: `web/Dockerfile` (context = repo root, because the Turbopack root
   is one level up) → `ghcr.io/grega-rotar/zupnija-web:<sha>` and `:latest`.
   `NEXT_PUBLIC_*` are build args, since Next inlines them into the browser bundle.
3. **deploy**: scp `infra/compose.yml` and `scripts/` to `/srv/zupnija/`, then as `deploy`:
   `docker compose pull && up -d`. Then poll `$SITE_URL/api/health` and `/` for 60 s.
4. **studio** (only when the variable `STUDIO_DEPLOY` is `true`): `sanity deploy`.

Rollback: run the workflow by hand with `tag=<older sha>`, or on the server
`cd /srv/zupnija && IMAGE_TAG=<sha> docker compose up -d`.

GitHub repo settings (Settings → Secrets and variables → Actions):

| Kind | Name | Value |
|---|---|---|
| secret | `DEPLOY_HOST` | `77.42.42.60` |
| secret | `DEPLOY_SSH_KEY` | private key whose public half is in `~deploy/.ssh/authorized_keys` on t4a |
| secret | `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan 77.42.42.60` |
| secret | `SANITY_AUTH_TOKEN` | Deploy Studio token (sanity.io/manage → API → Tokens), for the studio job |
| variable | `SITE_URL` | `https://zupnija-pirnice.si` (no trailing slash) |
| variable | `STUDIO_URL` | e.g. `https://zupnija-pirnice.sanity.studio` |
| variable | `STUDIO_DEPLOY` | `true` once the first manual Studio deploy is done |

On t4a, `/srv/zupnija/.env` (owner `deploy`, mode 600) holds the runtime values:

```
DOMAIN=zupnija-pirnice.si
SANITY_API_READ_TOKEN=...
RESEND_API_KEY=...
CONTACT_FROM_EMAIL=...
```

`DOMAIN` is used by the Traefik labels (the router matches it and `www.` too).

The site runs on `zupnija-pirnice.si` (moved from `zupnija.etiam.si` on
2026-10-28). The old host redirects permanently, keeping the path, through
`/srv/edge/dynamic/zupnija-legacy.yml` on t4a; the `zupnija.etiam.si` record in
the `etiam.si` zone stays so the redirect keeps working. Sanity's `settings.siteUrl`
and CORS origins point at the new domain. The URL is also baked into the image
from the `SITE_URL` variable, so a domain change needs a redeploy.
Cloudflare: proxied `A` records for the domain and `www` → `77.42.42.60`,
SSL mode Full (strict), and an Origin Certificate in
`/srv/edge/certs/<zone>/origin.{pem,key}`, listed in `infra/edge/dynamic/tls.yml`
of the jakamarinko repo.

Also add the production origin to Sanity CORS (with credentials), and in the
Studio set `settings.siteUrl` to the production URL.

### Studio → Sanity hosting

First time, by hand:

```bash
cd studio
SANITY_STUDIO_PREVIEW_ORIGIN=https://zupnija-pirnice.si npx sanity deploy
```

It asks for a hostname (e.g. `zupnija-pirnice`) and prints a
`deployment.appId` to add to `sanity.cli.ts`. Commit that, then set
`STUDIO_DEPLOY=true` so CI deploys the Studio on every push to `main`.
Auto-updates are enabled (`deployment.autoUpdates`).

### After deployment checklist

1. Invite editors: sanity.io/manage → project → Members (Editor role).
2. Replace sample content (`npx sanity exec scripts/seed-sample-content.ts
   --with-user-token -- --clean`, then enter real data) — or edit it in place.
3. Fill in `Nastavitve župnije` (address, phones, office hours, form recipient).
4. Verify `/sitemap.xml`, Open Graph preview, and the Presentation tool.

## 8. Urejevalnik (admin)

The parish editor (`tasks/prd-admin-editor.md`). Masses, intentions, bulletins,
events and Verouk move from Sanity to Postgres; everything else stays in Sanity.

### Architecture

```
public:  $DOMAIN, www.$DOMAIN ─┐
                               ├─ Traefik (/srv/edge) ──> web:3000 ──> db:5432 (Postgres 17)
admin:   $ADMIN_HOST ──────────┘                           │
                                                           ├─ /data/uploads   (volume zupnija_uploads)
                                                           └─ claude-pool → claude → Anthropic
                                                                ├─ /etc/claude-pool (host, read-only: tokens)
                                                                └─ /data/claude     (volume zupnija_claude)
```

- **One Next.js app, two hosts.** Both Traefik routers (`zupnija`, `zupnija-admin`)
  point at the same service. `src/proxy.ts` routes by Host header: on
  `ADMIN_HOST`, `/x` is rewritten to `/admin/x` and needs a session; on the
  public host every `/admin` and `/api/auth` path is a 404.
- **Postgres 17** in the `db` service, on the project's own network only (no
  port, no Traefik). Schema in `web/src/db/schema.ts`; migrations generated by
  `npm run db:generate` into `web/drizzle/` and committed.
- **Migrations run on container start:** the image's command is
  `node web/scripts/migrate.mjs && exec node web/server.js`. The script uses
  drizzle-orm's migrator (drizzle-kit isn't in the image), waits up to 60 s for
  the database, and a failed migration stops the container, so the deploy's
  health check fails and the old schema isn't served half-updated.
- **AI** (FR-9): `src/lib/ai/runClaude.ts` spawns `claude-pool`, which runs the
  Claude Code CLI on whichever pooled account has usage left. Exit code 75 =
  every account full → the UI says the assistant is busy, and everything still
  works by hand (FR-13a). The image pins both: `CLAUDE_CODE_VERSION` and
  `CLAUDE_POOL_VERSION` + `CLAUDE_POOL_SHA256` at the top of `web/Dockerfile`
  (the release file is checked against the sha256 at build). Bump them
  together on purpose. No tokens in the image.
- **Uploads** (FR-15) live in the `zupnija_uploads` volume at `/data/uploads`
  and are never served publicly.

### Environment variables

Runtime values go in `/srv/zupnija/.env` on t4a (as in "Deployment"), or in
`web/.env.local` for development. Compose sets the ones marked *compose*
itself.

| Name | Where | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | `.env` (required) | Database password; compose builds `DATABASE_URL` from it. Keep it URL-safe: `openssl rand -hex 24` |
| `DATABASE_URL` | compose / `.env.local` | `postgres://zupnija:…@db:5432/zupnija`; locally `postgres://zupnija:dev@localhost:5433/zupnija` |
| `ADMIN_HOST` | `.env` | Editor host. Default `admin.$DOMAIN`; also the Traefik rule |
| `BETTER_AUTH_SECRET` | `.env` | Session signing key: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `.env` | `https://$ADMIN_HOST` (defaults to that when unset) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `.env` | Google sign-in. Redirect URI: `https://$ADMIN_HOST/api/auth/callback/google`. Unset = magic links only |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` | `.env` | Already there; also send the magic links |
| `CLAUDE_POOL_GID` | `.env` (required) | GID of the host's `claude-pool` group (`getent group claude-pool`), added to the container user |
| `UPLOAD_DIR` | image / compose | `/data/uploads` (default `./.uploads` in development) |
| `CLAUDE_POOL_BIN` | image | `/usr/local/bin/claude-pool` |
| `CLAUDE_POOL_DIR` | image / compose | `/etc/claude-pool` (host folder, read-only) |
| `CLAUDE_POOL_STATE` | image / compose | `/data/claude/state/usage.json` (volume `zupnija_claude`) |
| `CLAUDE_CONFIG_DIR` | image / compose | `/data/claude/config`: claude's writable home |
| `CLAUDE_POOL_ENV_FILE` | image | `/dev/null`, so claude-pool never picks up a stray `.env` |
| `CLAUDE_POOL_ALERT` | `.env` (optional) | Command run when every account is full or a token is refused (claude-pool docs/settings.md) |
| `DEV_ACTOR` | `.env.local` only | Development: act as this user id without signing in. Ignored in production |

No new GitHub secrets or variables are needed: CI's Postgres uses fixed
throw-away credentials, and everything above is runtime-only.

### claude-pool on t4a (once)

Tokens stay on the host in `/etc/claude-pool` (mode 2770, group
`claude-pool`, files 640), mounted read-only into `web`. Usage state and
claude's own config live in the `zupnija_claude` volume.

```bash
# as root on t4a
groupadd claude-pool
install -d -m 2770 -g claude-pool /etc/claude-pool
echo "CLAUDE_POOL_GID=$(getent group claude-pool | cut -d: -f3)" >> /srv/zupnija/.env

# For each account: run `claude setup-token` on any machine, logged in as that account,
# then paste the token here. The image has claude-pool, so the host needs nothing installed.
docker run --rm -it --group-add "$(getent group claude-pool | cut -d: -f3)" \
  -v /etc/claude-pool:/etc/claude-pool -v zupnija_claude:/data/claude \
  ghcr.io/grega-rotar/zupnija-web:latest claude-pool --pool-add parish-1

# after the deploy, as deploy
cd /srv/zupnija && docker compose exec web claude-pool --pool-check   # must exit 0
```

`--pool-check` fails if the container can't read a token (wrong group or
mode: `chgrp claude-pool /etc/claude-pool/*; chmod 640 /etc/claude-pool/*`).
`docker compose exec web claude-pool --pool-status` shows each account's usage.

### Domain and TLS

The editor runs on `admin.zupnija-pirnice.si`: a proxied `A` record to t4a,
covered by the `zupnija-pirnice.si` + `*.zupnija-pirnice.si` origin cert in
`/srv/edge/certs/zupnija-pirnice.si/` (valid until 2041). `.env` sets
`ADMIN_HOST=admin.zupnija-pirnice.si` and
`BETTER_AUTH_URL=https://admin.zupnija-pirnice.si`.

### Backups

`scripts/backup.sh` (copied to `/srv/zupnija/scripts/` by every deploy) writes
`$BACKUP_DIR/zupnija-YYYY-MM-DD.tar` (mode 600) with `db.dump` (`pg_dump -Fc`),
`uploads.tar.gz` (the uploads volume) and `counts.tsv` (rows per table). It
keeps the newest 30 and exits non-zero on any failure. Cron as `deploy`:

```
15 3 * * * /srv/zupnija/scripts/backup.sh >> /srv/zupnija/backup.log 2>&1
```

| Variable | Default |
|---|---|
| `BACKUP_DIR` | `/var/backups/zupnija` (create it, owner `deploy`, mode 700) |
| `BACKUP_KEEP` | `30` |
| `BACKUP_REMOTE` | unset. **Off-site hook:** an rclone remote path (e.g. `b2:zupnija-backup`); when set, each file is `rclone copy`'d there. The target is still an open question in the PRD, so today backups are on t4a only |
| `ZUPNIJA_DIR`, `UPLOADS_VOLUME` | `/srv/zupnija`, `zupnija_uploads` |

### Restore

`scripts/restore.sh [--uploads] <file>` restores into an **empty** database
(`TARGET_DB`, default `zupnija`; created if missing) and refuses a non-empty
one, then compares row counts with the backup's `counts.tsv` and exits
non-zero on a difference. `--uploads` also unpacks the files into the uploads
volume, which must be empty.

Drill (before go-live, then now and then; no downtime):

```bash
cd /srv/zupnija
TARGET_DB=zupnija_drill scripts/restore.sh /var/backups/zupnija/zupnija-$(date +%F).tar
docker compose exec db dropdb -U zupnija zupnija_drill
```

Real restore:

```bash
cd /srv/zupnija && docker compose stop web
docker compose exec db dropdb -U zupnija zupnija
scripts/restore.sh /var/backups/zupnija/zupnija-YYYY-MM-DD.tar    # creates the database again
# files too: docker run --rm -v zupnija_uploads:/u postgres:17 sh -c 'rm -rf /u/* /u/.[!.]*'
#            then add --uploads to the line above
docker compose up -d
```

### Local development

```bash
cd web
docker compose -f compose.dev.yml up -d   # Postgres 17 on localhost:5433, zupnija/dev, db zupnija
# or the container used so far (same port and login; run only one of the two):
# docker run --name zupnija-pg -e POSTGRES_USER=zupnija -e POSTGRES_PASSWORD=dev \
#   -e POSTGRES_DB=zupnija -p 5433:5432 -d postgres:17

# web/.env.local
DATABASE_URL=postgres://zupnija:dev@localhost:5433/zupnija
BETTER_AUTH_SECRET=dev-only-secret
# DEV_ACTOR=<user id>                     # optional: always act as this user

npm run db:push      # schema straight to the dev database (no migration files)
npm run db:seed      # development data (scripts/seed.ts)
npm run dev          # site on http://localhost:3000, editor on http://admin.localhost:3000
```

- Without a sign-in: `http://admin.localhost:3000/dev/kot/<user id>` acts as
  that user (cookie `dev_actor`), `/dev/kot/odjava` stops. Development only.
- Schema changes: edit `src/db/schema.ts`, `npm run db:push` locally, and
  `npm run db:generate` for the migration that production applies on start.
- `npm test` creates and uses `zupnija_test` on the same server
  (`TEST_DB=<name>` for a separate one). CI does the same with a `postgres:17`
  service. `runClaude` is mocked; the real model only runs in
  `npm run eval:bulletin` / `eval:assistant`, never in CI.
- Without `RESEND_API_KEY`, mail isn't sent, only logged (`src/lib/mail.ts`).

## 9. Extending

- **Another language:** the schema is single-language on purpose. The usual
  path is field-level localisation for editorial fields
  (`sanity-best-practices` skill, `localization.md`) plus a `[locale]` route
  segment; labels in `lib/labels.ts` and `lib/dates.ts` are already isolated.
- **Newsletter:** add a provider module next to `lib/mail.ts` and a form in
  `components/forms`; keep API keys server-only.
- **Analytics:** prefer a cookieless, privacy-friendly service; add the script
  in `app/layout.tsx` and update the privacy page.
- **Webhook revalidation** is not needed with the Live Content API. If you
  ever switch to plain ISR, use `next-sanity/webhook` tag revalidation.
