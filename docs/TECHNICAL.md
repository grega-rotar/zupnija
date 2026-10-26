# Župnija Pirniče — technical documentation

For developers taking over the project. Editor documentation (Slovenian) is in
[`NAVODILA-ZA-UREJANJE.md`](./NAVODILA-ZA-UREJANJE.md).

## 1. Architecture

```
zupnija/
├── studio/   Sanity Studio v6 (standalone, Vite)   → sanity.studio hosting
├── web/      Next.js 16 App Router (React 19)      → Vercel
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

### Website → Vercel

- Root directory: `web`. Framework: Next.js. Node 22.
- Environment variables: see table above (`NEXT_PUBLIC_SITE_URL` =
  `https://zupnija-pirnice.si`, `NEXT_PUBLIC_SANITY_STUDIO_URL` = Studio URL,
  `SANITY_API_READ_TOKEN`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`).
- Add the production origin to Sanity CORS (with credentials).
- In the Studio, set `settings.siteUrl` to the production URL.

### Studio → Sanity hosting

```bash
cd studio
SANITY_STUDIO_PREVIEW_ORIGIN=https://zupnija-pirnice.si npm run deploy
```

`sanity deploy` asks for a hostname the first time (e.g. `zupnija-pirnice`).
Auto-updates are enabled (`deployment.autoUpdates`).

### After deployment checklist

1. Invite editors: sanity.io/manage → project → Members (Editor role).
2. Replace sample content (`npx sanity exec scripts/seed-sample-content.ts
   --with-user-token -- --clean`, then enter real data) — or edit it in place.
3. Fill in `Nastavitve župnije` (address, phones, office hours, form recipient).
4. Verify `/sitemap.xml`, Open Graph preview, and the Presentation tool.

## 8. Extending

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
