# Contract: complete the PRD in one batch (2026-10-28)

Requirements: `tasks/prd-site-parity-homepage.md`, user stories US-003, US-005, US-006, US-007, US-008, US-009, US-010 and US-012, plus performance. Branch `complete-prd`. The lead commits and opens the PR. General working rules are in `tasks/build-v4/BRIEF.md` (Next 16 docs, screenshots, TEST_DB per agent, no commits). The design language is v4 (`tasks/prototype-homepage-v4.html`, `src/app/globals.css`, the existing pages and editor).

## Already done by the lead (do not redo)

- **Migration `0003_forms_newsletter`:**
  - `newsletter_subscribers`;
  - `outbox` (queued, sent, failed; `send_after`; `attempts`);
  - `catechesis_enrolments`, `intention_requests`, `sacrament_requests` (all with a `request_status` of new, done or declined);
  - `rate_limit_hits`;
  - `bulletins.mailed_at`.

  See the bottom of `src/db/schema.ts`. If you need a column changed, ask the lead; don't create another migration.
- **Content types in `lib/content/fields.ts`** (with sidebar entries):
  - `prayerPage`, a singleton: title, intro, image, `items[] {title, when, place, note, onHome}`;
  - `donationPurpose`, orderable: title, description, amount, purpose (UPN, max 42), reference, until.

  The owning agent may refine its own entry.
- **Existing settings to use (content `settings`):**
  - `contactFormRecipient`: the parish inbox for form mails;
  - `emergencyContact {label, phone}`;
  - `address`, `phone`, `email`;
  - `donations {intro, recipient, iban, bic, reference, purpose}`.

## Shared rules

- **Mail.** One-off mails (confirmations, form notifications) go out at once through `sendMail` in `src/lib/mail.ts`. Bulk mail (the newsletter) goes only into `outbox`. Without `RESEND_API_KEY` everything lands in the dev outbox, as it does today.
- **Public forms.** All of them use one helper, built by FORMS in `src/lib/forms/public.ts`, which every other agent imports:
  - zod validation with Slovenian messages per field;
  - a honeypot field `website`;
  - a rate limit of 5 per 10 minutes per form and IP, stored in `rate_limit_hits`. The client IP comes from the `CF-Connecting-IP` header, then `X-Forwarded-For`.
  - a result shape `{ ok: true, message } | { ok: false, message, fieldErrors }`;
  - the client side is a server action plus `useActionState`, with inline success or error text and no reload.

  The newsletter's subscribe form uses the same helper.
- **Editor inboxes** are permission-aware and use the engine for anything that changes parish data (converting an intention request). Plain status flips (done, declined) may be direct writes, but they still go through the engine so they appear in history.
- **Slovenian copy:** plain verbs, as in the PRD. Every criterion in the PRD for your user stories is your acceptance test. Write the tests it names.
- **Cache tags:** revalidate with the existing helpers (`lib/admin/next.ts`, `updateTag`).

## Ownership (five agents, one working tree; edit only your own files)

| agent | builds | owns |
|---|---|---|
| **PERF** | Make public pages fast without losing freshness: TTFB is ~450 ms because every page renders per request (`(site)/layout.tsx` has `dynamic = "force-dynamic"`). Research Next 16 caching (`node_modules/next/dist/docs`: Cache Components / `"use cache"` / `cacheLife`, ISR, CDN headers) and implement the best option that meets all three rules below. Also fix the homepage card `sizes` (news and church cards are served at 768 px for a 364 px slot on phones). Measure with Lighthouse before and after; see "Measuring" below. | `src/app/(site)/layout.tsx`, route segment configs, `next.config.ts`, `src/lib/data/cache.ts`, `src/components/home/Sections.tsx` (sizes only), `proxy.ts` |
| **FORMS** | `src/lib/forms/public.ts` (the shared helper, built FIRST) plus US-006 (`/verouk/vpis` and the editor Verouk tab "Vpisi" with CSV), US-007 (`/masni-nameni/prosnja` and the editor Nameni tab "Prošnje (n)", which converts a request into an intention through the existing `intention.add` engine flow, with approval rules), and US-008 (`/zakramenti/povprasevanje`, a button on each sacrament page, and the inbox on editor Domov). | `src/lib/forms/**`, `src/lib/verouk/enrolment*`, `src/lib/mase/requests*`, `src/lib/sacraments/**`, the new public routes, the new editor tabs and components |
| **NEWS** | US-005: subscribe, double opt-in, confirm and unsubscribe (with one-click POST), queueing on `bulletin.publish` (exactly once via `mailed_at`, never on undo), the outbox sender `/api/cron/outbox` (`CRON_SECRET` header, `MAIL_DAILY_LIMIT` default 90, `List-Unsubscribe` and `List-Unsubscribe-Post` headers), and the editor "Naročniki" tab under Ljudje (owner only). The footer and homepage form (in the prototype's "Oznanila po e-pošti" tile) go in a small component the PERF agent doesn't touch: `src/components/newsletter/**`. Put it in the homepage giving section and the footer by editing only those insertion lines. | `src/lib/newsletter/**`, `src/app/obvestila/**` or `(site)/obvestila/**`, `src/app/api/cron/outbox/**`, `src/components/newsletter/**`, `lib/bulletin/actions.ts` (the publish hook only) |
| **GIVING** | US-009: `/daruj` (from `settings.donations` plus the `donationPurpose` docs), a UPN QR built to the ZBS UPN QR specification (`src/lib/giving/upnqr.ts`, with a round-trip test), SVG through the `qrcode` package (ask the lead to install it), "Kopiraj IBAN", and a small QR plus IBAN in the footer. US-010: `.ics` per event, `/koledar.ics`, Google links with `ctz=Europe/Ljubljana`, and the share control on events, news and bulletins, plus "Naroči se na koledar" on `/svete-mase`. | `src/lib/giving/**`, `src/lib/calendar/**`, `(site)/daruj/**`, the `.ics` routes, `src/components/share/**`, `src/components/giving/**` |
| **PRAYER** | US-012: `/molitev` (`prayerPage`; 404 and the nav link hidden when there are no items), "Molitev" in the public nav (replacing the temporary Verouk item, which moves into the Župnija menu or stays where the design has it), the homepage "Pridite pred Najsvetejše" band from the prototype (items with `onHome`), and group search on `/zupnija/skupine` (`?q=`). US-003 readings: `/berila` (and `?datum=`) from hozana `api.php` with `HOZANA_API_KEY`, cached 24 h, with source credit and the unavailable state from the PRD; without a key the page shows the references and a link. Link "Preberi današnja berila" to `/berila`. | `src/lib/prayer/**`, `src/lib/liturgy/readings*`, `(site)/molitev/**`, `(site)/berila/**`, the group search component, `src/components/home/Prayer*.tsx` |

**Shared files several agents must touch:**
- the public nav and footer: PRAYER owns `layout/Nav.tsx`; NEWS and GIVING edit only their insertion lines in `Footer.tsx`;
- `lib/admin/registry.ts`: one import line each;
- `components/admin/nav.ts`: tabs inside existing screens need no nav edit;
- the homepage `src/app/(site)/page.tsx`: NEWS, GIVING and PRAYER each insert one section or line.

Make these edits small and late. Use the Edit tool, which detects concurrent changes. Don't rewrite whole files.

**Packages:** ask the lead (your report, or tell the user-facing lead before you finish if you are blocked). GIVING needs `qrcode` and `@types/qrcode`; the lead installs them before you start.

## Performance (PERF) — rules for any caching

- `npm run build` must succeed **without a database** (CI and the Docker build set `DATABASE_URL=postgres://build:build@127.0.0.1:1/build`).
- The "Danes" widget must never be more than 60 s stale. Past Masses and the countdown are allowed to lag by at most a minute.
- Editor changes must show on the public site within 60 s, and immediately where the existing `updateTag` path already does so.
- No public page may ever be served empty or broken after a deploy. Prove this with a build plus `npm start` against the dev database, after a cold start.

## Measuring

Lighthouse helper: `bash /tmp/claude-1000/-home-grega-grega-rotar-zupnija-web/578cb306-f30c-49b1-b873-6a11bcd0233e/scratchpad/lh.sh <url> 3`. It runs against a URL; for local runs, use `npm run build && PORT=3100 npm start` with the dev DB env.

## Done means

- `npx tsc --noEmit -p .` is clean.
- `npx eslint <your files>` reports 0 errors.
- Your tests pass on a fresh TEST_DB.
- Screenshots at 1440 and 390 of every new screen, compared against the v4 look.
- A report under 200 words: what you built, the files, the tests, the screenshot paths, and what you need from the lead.
