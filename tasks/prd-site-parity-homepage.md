# PRD: A homepage built around today, and everything Preska and Ribnica offer

Status: planned (2026-10-28) · Spec: `specs/features/site/site-parity-homepage.md`

## 1. Introduction

Parishioners open the parish website to answer one question: **is there Mass today, when, where, and for whom?** Our homepage answers it in a small card under a large photo, without intentions. The neighbouring parishes Preska (zupnija-preska.si) and Ribnica (zupnija-ribnica.si) both put today's Masses with intentions first. They also offer things we lack:
- an e-mail newsletter;
- online catechism enrolment;
- a donation QR code;
- "add to calendar" links;
- per-church Mass lists;
- a prayer and adoration page.

This PRD covers two things:
1. a new homepage built around "today": prototype variant **A**, reworked into a slick, modern design (v3);
2. the reference sites' features that we don't have yet, built properly where they built them badly.

The audits are summarised in §7. The full notes are in the session scratchpad (`preska/`, `rib/`).

## 2. Goals

- A visitor sees today's Masses, their churches and **intentions** within the first screen on desktop (1440×900) and on a phone (390×844) without scrolling.
- Today's liturgical day, rank, Gospel line and **the full daily readings** (from hozana.si, with the parish's permission) are one click from the homepage.
- Every feature either reference site has that fits Pirniče exists on our site (see the parity table in §7).
- Parishioners can subscribe once and receive every published bulletin by e-mail.
- Catechism enrolment, Mass-intention requests and sacrament enquiries arrive in the editor as structured requests, not loose e-mails.
- The site's look moves from moss green to the v3 design (near-white and cream, gold-brown buttons, candle-gold accent) across the public site and the editor (one token change, not per-page edits).

## 3. User stories

Verification tags used in this PRD (this project's stack is Next.js 16, Postgres and Vitest; there is no PHP):
- **`[unit]`**: a pure-function Vitest test.
- **`[db]`**: a Vitest test against the real test Postgres (`npm test`, TEST_NOW pinned).
- **`[browser]`**: a dev-browser check on `npm run dev` with seeded data.

The clock for every example is **TEST_NOW = 2026-10-28T14:40:00+01:00 (Wednesday)** unless the criterion states otherwise.

### US-001: Design system v3 (slick and modern, quiet sacred accent) for site and editor
**Description:** As the parish, I want the site and the editor in one slick, modern, Apple-like style with a quiet sacred accent, so the site feels both modern and holy.

**Acceptance Criteria:**
- [unit] `globals.css` defines the v3 tokens from `tasks/prototype-homepage-v3.html`:
  - colours: `--color-bg` `#fafaf8`, `--color-surface` `#fff`, `--color-sunk` `#f2f1ee`, `--color-ink` `#1f1c18`, `--color-primary` `#7a5c1e`, `--color-accent` `#a8822f`, `--color-accent-ink` `#7d5f1c`, `--color-accent-soft` `#f6efdf`, `--color-night` `#111113`;
  - radii: `--radius-sm` 18px, `--radius` 28px, `--radius-xl` 40px;
  - two shadow tokens;
  - fonts: Inter as sans and Instrument Serif (italic) as the accent serif, both through `next/font`.

  The old `moss` and `paper` names are removed, and every usage is migrated: `grep -rn "moss\|paper-2" src` returns 0 hits.
- [unit] Contrast checks (WCAG relative luminance, computed in the test):
  - white on `--color-accent` ≥ 4.5:1;
  - `--color-accent-2` on `--color-bg` ≥ 4.5:1;
  - `--color-ink-3` on white ≥ 4.5:1.
- [browser] `/` and `admin.localhost:3000/` render with zero elements whose computed `background-color` is the old `rgb(61, 90, 71)` (#3d5a47).
- [browser] Buttons have `border-radius` ≥ 999px (pill), cards 24px, and the "Danes" panel 32px. The navigation bar has `backdrop-filter: blur(...)` and stays sticky on scroll.
- [browser] With `prefers-reduced-motion: reduce` emulated, no element has a running CSS transition on load.

**Verification:**
- New tests: `src/lib/design/palette.test.ts` (parses globals.css, computes contrast).
- dev-browser flow: open `/`, run `[...document.querySelectorAll('*')].filter(e => getComputedStyle(e).backgroundColor === 'rgb(61, 90, 71)').length === 0`.
- Regression risk: the season colours (`--color-season-*`) and alert red must remain unchanged; the editor shares the tokens.

### US-002: "Danes" block on the homepage
**Description:** As a parishioner, I want to see at once whether there is Mass today, at what time, where and for whom.

**Acceptance Criteria:**
- [db] `getTodayBlock(now)` with seeded Masses 7.30 Sv. Križ ("Za zdravje") and 18.00 Marijina cerkev (two intentions) returns:
  - `mode: "today"`, `headline: "Sveta maša danes ob 18.00"`, `nextInMinutes: 200`;
  - the 7.30 Mass marked `past: true`;
  - the 18.00 Mass with both intention texts in schedule order.
- [db] At `2026-10-28T19:00` (both Masses over) it returns `mode: "tomorrow"`, `headline: "Jutri ob 18.00"`, plus `earlierToday: ["7.30", "18.00"]`.
- [db] On `2026-11-02` (no Mass that day) it returns `mode: "none-today"` and `next` = the first future Mass (date, time, church, intentions).
- [db] A Mass with status `cancelled` is returned with `cancelled: true` and never becomes the headline time. If the 18.00 Mass is cancelled at 14.40, the headline is the next non-cancelled Mass.
- [db] A Mass with no intention returns `intentions: []`. The component prints "Namen še ni vpisan" in `--color-ink-3`.
- [db] On Sunday `2026-11-01` it returns both Masses (8.00 Sv. Križ, 10.00 Marijina cerkev), and `day.sundayName` / `day.gospel` come from `calendar_days`.
- [unit] `formatCountdown(200)` → `"čez 3 h 20 min"`, `formatCountdown(45)` → `"čez 45 min"`, `formatCountdown(0)` → `"zdaj"`. The countdown chip is hidden when more than 12 h away.
- [browser] At 14.40 `/` shows, inside `[aria-label="Danes"]`:
  - the heading "Sveta maša danes ob 18.00";
  - the text "+ Marija Kos, 30. dan";
  - a struck-through "7.30";
  - zero console errors.
- [browser] An intention of 160 characters wraps inside the block on a 390 px viewport, and `document.documentElement.scrollWidth === 390` (no horizontal scroll).
- [browser] On a 390×844 viewport, the "Danes" heading's `getBoundingClientRect().bottom` < 844 (above the fold).

**Verification:**
- New tests: `src/lib/data/today.test.ts`, `src/lib/dates.test.ts` (countdown).
- dev-browser flow: seed (§10), set `DEV_NOW` to each of the 4 moments, load `/`, assert the texts above.
- Regression risk:
  - `pickTodayOrNext` is used by `/svete-mase`, so its tests must still pass;
  - the `revalidate` of the homepage must be ≤ 300 s so "že mimo" is not stale for hours.

### US-003: Liturgical day and daily readings (hozana.si)
**Description:** As a parishioner, I want today's feast, its rank, the Gospel line and the readings on our site.

**Acceptance Criteria:**
- [unit] `parseOsnovniPodatki(json, "2026-10-28", "ljubljana")` on the saved fixture returns:
  - `title: "Sv. Simon in Juda Tadej, apostola"` (or the fixture's exact `opis`);
  - `rank: "praznik"`;
  - `gospelLine` equal to the fixture's `vrstica`.
- [unit] `parseHozanaBB(fixture)` returns `readings: [{label:"Berilo", ref:"Ef 2,19-22", text}, {label:"Psalm", …}, {label:"Evangelij", ref:"Lk 6,12-16", text}]`, with HTML stripped to paragraphs.
- [db] Fetch order for the liturgical day: `calendar_days` row for the date (from the bulletin) wins over hozana `osnovni_podatki.json` (cached 24 h), which wins over nothing. With a `calendar_days` row "28. navadna nedelja" for 2026-10-11, that title is shown, not hozana's.
- [db] Readings come from `api.php?kaj=bb&datum=28.10.2026&skofija=ljubljana&kljuc=$HOZANA_API_KEY` and are cached per date for 24 h (`unstable_cache` tag `readings:<date>`). A second request on the same date makes 0 outbound calls; this is asserted with a fetch mock call count.
- [db] Without `HOZANA_API_KEY`, or when hozana returns a non-2xx or a timeout (> 4 s), `getReadings` returns `{ available: false }` and logs once. The page still renders.
- [browser] `/berila` shows the three headings Berilo, Psalm and Evangelij with non-empty text, and the line "Vir: hozana.si", linked to `https://hozana.si/?datum=28.10.2026`.
- [browser] `/berila?datum=2026-11-01` shows the readings for All Saints; `/berila?datum=garbage` redirects to `/berila`.
- [browser] With hozana mocked down, the homepage card shows "Berila so ta trenutek nedosegljiva." and a link "Odpri na hozana.si →".

**Verification:**
- New tests: `src/lib/liturgy/hozana.test.ts`, with fixtures in `src/lib/liturgy/__fixtures__/`.
- dev-browser flow: `/` → click "Preberi današnja berila" → lands on `/berila` and the three headings are present.
- Regression risk: the editor and Mass pages already read `calendar_days`; they must not start calling hozana.

### US-004: Next event, bulletin and this week on the homepage
**Description:** As a parishioner, I want the next event, the current bulletin and this week's Mass times under the "Danes" block.

**Acceptance Criteria:**
- [db] `getHomeEvents(now)` returns events ordered by start, with the first having `daysUntil: 4` for the 2026-11-01 event. Events whose `include` was unticked in a bulletin do not appear.
- [browser] The "Naslednji dogodek" card shows "čez 4 dni", the title "Vsi sveti: molitev na pokopališču" and "Nedelja, 1. november · 14.00".
- [browser] The bulletin card for October 2026 shows "Leto XLII, številka 10" and a "Prenesi PDF" link whose `href` returns 200 and `content-type: application/pdf`.
- [browser] When no bulletin covers the current month (seed: delete October, keep September), the card shows the heading "November 2026" and the text "Novembrska oznanila še niso objavljena. Do takrat veljajo oktobrska." Its link points to the latest published bulletin.
- [browser] The "Ta teden" card lists every day from tomorrow to Saturday that has Masses. Each row shows its times and church short names (with the seed: Thursday, Friday, Saturday, and Sunday is listed because the week ends Saturday and the next Sunday is shown bold).
- [browser] With zero future events, the card reads "V naslednjih tednih ni napovedanih dogodkov." with a link to `/dogodki/arhiv`.

**Verification:**
- New tests: extend `src/lib/data/data.test.ts`.
- dev-browser flow: load `/`, assert the 3 cards, click "Prenesi PDF", check the response headers.
- Regression risk: `Today.tsx` is replaced, so remove it and its tests together.

### US-005: Email newsletter (bulletins by e-mail)
**Description:** As a parishioner, I want to receive each new bulletin by e-mail without visiting the site.

**Acceptance Criteria:**
- [db] POST of the subscribe form with `vas@primer.si` creates a `newsletter_subscribers` row with `status: "pending"`, a random `token` and `consent_at`, and sends exactly 1 mail (dev outbox) with subject "Potrdite prijavo na oznanila župnije Pirniče" containing `/obvestila/potrdi?token=`.
- [db] GET `/obvestila/potrdi?token=<t>` sets `status: "active"`. A second GET with the same token shows "Prijava je že potrjena." and changes nothing. An unknown token shows "Povezava ni veljavna."
- [db] Subscribing an address that is already `active` sends no mail and shows the same thank-you text, so whether an address is subscribed is not revealed.
- [db] Invalid e-mail `abc` → error "Vpišite veljaven e-poštni naslov." and no row. The honeypot field filled → 200 with the thank-you text, no row, no mail.
- [db] More than 5 subscribe requests from one IP in 10 minutes → the 6th returns "Preveč poskusov. Poskusite čez nekaj minut." and no row.
- [db] Publishing a bulletin through the engine (`bulletin.publish`) enqueues 1 mail per `active` subscriber (3 active + 1 pending + 1 unsubscribed seeded → exactly 3 mails). Each mail has:
  - subject "Oznanila za oktober 2026";
  - the article title, notices and events as text;
  - a link to `/oznanila`;
  - the PDF link;
  - a personal unsubscribe link;
  - `List-Unsubscribe` and `List-Unsubscribe-Post` headers.
- [db] Undoing the publish does not send anything. Re-publishing the same bulletin does not send again (`bulletins.mailed_at` is set once).
- [db] GET `/obvestila/odjava?token=<t>` sets `status: "unsubscribed"`, and POST to the same URL (one-click) does the same and returns 200.
- [db] Sending respects the provider's daily limit: mails are queued in `outbox` and a worker sends at most `MAIL_DAILY_LIMIT` (default 90) per day. With 120 active subscribers, 90 are `sent` today and 30 remain `queued` with `send_after` tomorrow 06:00.
- [browser] Editor → Ljudje → new tab "Naročniki" shows the count "3 potrjeni · 1 čaka potrditev" and the last bulletin's send status "Poslano 3 od 3". Only the owner sees it; a helper gets 404 on `/narocniki`.
- [browser] The footer form on `/`: enter `vas@primer.si`, click "Prijavi me", and the inline message reads "Hvala. Na vas@primer.si smo poslali povezavo za potrditev." with no page reload and zero console errors.

**Verification:**
- New tests: `src/lib/newsletter/newsletter.test.ts`, `src/lib/mail/outbox.test.ts`.
- dev-browser flow: subscribe → open the dev outbox (`/dev/outbox`) → click the confirm link → publish the seeded bulletin in the editor → the outbox shows 3 new mails.
- Regression risk: `bulletin.publish` (engine), `sendMail` and the existing magic-link mails.

### US-006: Online catechism enrolment
**Description:** As a parent, I want to enrol my child in Verouk online and get a confirmation.

**Acceptance Criteria:**
- [db] A valid POST to `/verouk/vpis` stores a `catechesis_enrolments` row with:
  - father and mother: name, e-mail, mobile;
  - the child: name, surname, birth date and place, baptism date and parish, address;
  - grade 1–9 and the chosen group (`catechesis_groups.id`);
  - activities (`ministranti` | `pevski_zbor` | `skavti`);
  - photo consents `archive` and `publish` as separate booleans;
  - `rules_accepted: true`.
- [db] The same submission sends 2 mails:
  - to the parish address (setting `parishEmail`), subject "Vpis k verouku: <Ime Priimek>, <N>. razred";
  - to each parent e-mail given, subject "Potrdilo o vpisu k verouku", containing the enrolment number `V-2026-0001`.
- [db] Missing child name → the field error "Vpišite ime otroka." and no row. A birth date in the future → "Datum rojstva ni pravilen." `rules_accepted` false → "Za vpis potrdite pravila veroučne šole."
- [browser] "Dodaj še enega otroka z enakimi podatki staršev" after a successful submit opens the form again with both parents filled in and the child fields empty.
- [browser] Editor → Verouk → tab "Vpisi" lists the enrolment with grade, group, parents and consent icons. "Izvozi CSV" downloads a file whose first data row contains the child's name. A catechist with Verouk access sees it; a helper without Verouk access gets 404.
- [db] The enrolment page shows "Vpisi za šolsko leto 2026/27 so zaprti." when `app_settings.verouk.enrolmentOpen` is false. A POST then returns 409 and stores nothing.

**Verification:**
- New tests: `src/lib/verouk/enrolment.test.ts`.
- dev-browser flow: fill the form with the seed data in §10 → submit → see "Hvala, vpis je oddan. Potrdilo smo poslali na …" → open the editor tab → the row is present.
- Regression risk: Verouk groups and cancellations on `/verouk`.

### US-007: Mass-intention request form
**Description:** As a parishioner, I want to ask for a Mass intention online instead of only in the office.

**Acceptance Criteria:**
- [db] POST `/masni-nameni/prosnja` with the following stores a `intention_requests` row with `status: "new"` and sends 1 mail to the parish:
  - name "Ana Kralj", contact "041 123 456" (a phone or an e-mail is required);
  - text "+ Franc Kralj, obl.";
  - preferred date "2026-11-15" (optional), church "marijina" (optional) and a note.
- [db] Text over 200 characters → "Namen je predolg (največ 200 znakov)." A preferred date in the past → "Izberite datum v prihodnosti."
- [browser] The page states plainly: "Prošnja še ni potrjen namen. Župnik vas bo poklical ali vam pisal. Dar za mašo prinesete v župnišče." No payment is asked online.
- [browser] Editor → Nameni → tab "Prošnje (1)":
  - Clicking "Vpiši kot namen" opens the existing add-intention sheet prefilled with text, date and church. Saving creates the intention through the engine and sets the request to `status: "done"`, linked to the intention id.
  - "Zavrni" asks for an optional note and sets `status: "declined"`.
  - Both actions appear in Zgodovina and can be undone.
- [db] Approval rules still apply: a helper who needs approval converts a request → a change request is created and the request stays `new` until it is approved.

**Verification:**
- New tests: `src/lib/mase/requests.test.ts`.
- dev-browser flow: submit the form → the editor badge "Prošnje (1)" appears → convert → the intention shows on `/masni-nameni` for 15. 11.
- Regression risk: the engine `intention.add` action and the change requests flow.

### US-008: Sacrament enquiry form
**Description:** As someone preparing a baptism, wedding or similar, I want to send a structured enquiry.

**Acceptance Criteria:**
- [db] POST `/zakramenti/povprasevanje` stores a `sacrament_requests` row and mails the parish with subject "Povpraševanje: Krst · Ana Kralj". It takes:
  - `kind`, one of `krst`, `prvo_obhajilo`, `birma`, `poroka`, `bolniško_maziljenje`, `pogreb`, `drugo`;
  - name, a phone or an e-mail, a preferred date (optional) and a message.
- [browser] Each `/zakramenti/<slug>` page shows a button "Pošlji povpraševanje" that opens the form with `kind` preselected (for example on `/zakramenti/krst` the select value is `krst`).
- [browser] For `kind: bolniško_maziljenje` and `pogreb`, the form shows above the fields: "Za nujne primere pokličite: <phone from settings>", as a `tel:` link.
- [browser] Editor → Domov shows "Novo povpraševanje: Krst · Ana Kralj" in the inbox list. "Označi kot rešeno" removes it from the list.

**Verification:**
- New tests: `src/lib/forms/sacrament.test.ts`.
- dev-browser flow: `/zakramenti/krst` → open the form → submit → the editor Domov list shows it.
- Regression risk: the contact form (it shares the mail and rate-limit helpers).

### US-009: Donations page with UPN QR
**Description:** As a parishioner, I want to scan a code in my bank app to give to the parish.

**Acceptance Criteria:**
- [unit] `buildUpnQr({iban:"SI56…", name:"Župnija Pirniče", address, city, purpose:"Dar za župnijo", code:"CHAR", amount?})` returns a payload that:
  - follows the ZBS UPN QR specification: header `UPNQR`, 19 fields, line breaks `\n`, a checksum field equal to the payload length, ISO 8859-2 encoding;
  - round-trips through a decoder in the test, so the fields come back unchanged.
- [unit] Without an amount the amount field is empty (the payer enters it); with `amount: 25` it is `00000002500`.
- [browser] `/daruj` shows:
  - the recipient, IBAN (grouped in 4s), BIC, purpose and reference from Sanity `settings.donations`;
  - a scannable QR (an `<svg>` with `role="img"` and `aria-label="UPN QR koda za dar župniji"`);
  - a "Kopiraj IBAN" button that puts the IBAN without spaces on the clipboard.
- [browser] The footer on every public page shows the small QR and the IBAN. With `settings.donations.iban` empty, neither the footer block nor `/daruj` renders (404), and nothing breaks.
- [browser] Per-purpose QR: a Sanity "Namen darovanja" (purpose) with a title, amount and deadline (for example "Oratorij 2027 · 40 €") renders its own QR with that amount on `/daruj`.

**Verification:**
- New tests: `src/lib/giving/upnqr.test.ts`, with a real decoded sample.
- dev-browser flow: `/daruj` → the QR is present → click "Kopiraj IBAN" → read the clipboard.
- Regression risk: the `kontakt` page already shows the IBAN; reuse one component.

### US-010: Add to calendar and share
**Description:** As a parishioner, I want to put an event or Mass in my calendar and share it.

**Acceptance Criteria:**
- [unit] `eventIcs(event)` produces valid iCalendar with `DTSTART;TZID=Europe/Ljubljana:20261101T140000`, a `VTIMEZONE` block, `SUMMARY`, `LOCATION`, `URL` and a stable `UID` `event-<id>@zupnija-pirnice.si`. A test parses it back with `ical.js` or an equivalent.
- [unit] `googleCalendarUrl(event)` encodes the start as `20261101T140000` together with `ctz=Europe/Ljubljana`, so it is not marked UTC; this is the bug Ribnica has.
- [db] GET `/dogodki/<slug>/dogodek.ics` returns 200, `content-type: text/calendar; charset=utf-8`, and the event. GET `/koledar.ics` returns all events from 30 days ago to 180 days ahead, plus all Masses for the next 60 days (`SUMMARY: "Sveta maša · Marijina cerkev"`, intentions in `DESCRIPTION`).
- [browser] An event page shows "Dodaj v koledar" with two options, "Google koledar" and "Apple / Outlook (.ics)", and a "Deli" button:
  - on a 390 px viewport with `navigator.share` it calls `navigator.share({title, url})`;
  - otherwise it shows WhatsApp, Facebook, E-pošta and "Kopiraj povezavo" links with the correct encoded URLs.
- [browser] News and bulletin pages have the same "Deli" control. `/svete-mase` has "Naroči se na koledar" with the `webcal://` URL of `/koledar.ics`.

**Verification:**
- New tests: `src/lib/calendar/ics.test.ts`.
- dev-browser flow: event page → click Google → the opened URL contains `ctz=Europe%2FLjubljana`; download the .ics and check the content.
- Regression risk: the event slug and legacy-slug routing must keep working.

### US-011: Church pages list that church's Masses
**Description:** As someone who goes to one church, I want its upcoming Masses on its page.

**Acceptance Criteria:**
- [db] `getChurchMasses("marijina", now, 14)` returns only Masses at that church, ordered by date and time, with intentions. With the seed (Sv. Križ has 7.30 on Wednesdays and 8.00 on Sundays), Sv. Križ's list has a different count from Marijina's: 3 vs 9.
- [browser] `/zupnija/cerkve/sv-kriz` shows the section "Svete maše v tej cerkvi" with 3 rows, each showing date, time and intention.
- [browser] A church with no upcoming Masses (Sv. Jakob na Gori) shows "V naslednjih dveh tednih tu ni svetih maš." and a link to `/svete-mase`.

**Verification:**
- New tests: extend `src/lib/data/data.test.ts`.
- dev-browser flow: open 2 church pages and compare the row counts.
- Regression risk: the existing `ScheduleTable` on the church page stays as the weekly regular schedule.

### US-012: "Molitev in češčenje" page and group search
**Description:** As a parishioner, I want one page with adoration, rosary and prayer times, and to find a group quickly.

**Acceptance Criteria:**
- [db] A new Sanity singleton `prayerPage` (fields: intro and `items[] {title, when, place, note}`) renders at `/molitev`, linked from the main menu under "Župnija" and from the footer.
- [browser] `/molitev` with 3 seeded items shows 3 rows ("Češčenje Najsvetejšega · prvi petek v mesecu, 15.00–18.30 · Marijina cerkev"…). With 0 items the page returns 404 and the menu link is hidden.
- [browser] `/zupnija/skupine` has a search field "Išči skupino ali dejavnost". With 9 groups seeded, typing "zbor" leaves exactly 2 visible cards (not 9), and typing "xyz" shows "Nobena skupina ne ustreza iskanju." with a "Počisti" button that restores 9.
- [browser] The search value is kept in the URL (`?q=zbor`). After a reload the field holds "zbor" and 2 cards show.

**Verification:**
- New tests: `src/components/groups/GroupSearch.test.tsx` (filter logic).
- dev-browser flow: as in the criteria.
- Regression risk: the Sanity schema deploy (Studio) and the group page routing.

### US-013: The priest edits all website content in the editor (no Sanity Studio)
**Description:** As the priest, I want to change any text, photo or page of the website in the same editor I use for Masses and bulletins, so that maintaining the site needs no second tool and no developer.

Today these types live only in Sanity:
- articles (news), galleries, pages, documents;
- groups, people (clergy), sacraments, churches' texts and photos;
- the special periods, the homepage (hero, tile, welcome) and the Verouk page text;
- settings: name, address, office hours, contact, donations, social links.

**Decision (recommended):** move this content into Postgres and edit it through the engine, as with Masses. It then gets the same roles, approvals, history and undo, the same design, and the assistant can edit it too. Sanity is imported once (`import-sanity` is extended to every type) and then retired. It stays read-only for 30 days as a fallback.

**Acceptance Criteria:**
- [db] After `import-sanity --all` on the fixture dataset, Postgres holds:
  - every Sanity document of the types listed above, with the same counts as the fixture (for example 12 articles, 4 galleries with 37 images, 9 groups, 3 people, 7 sacraments, 6 pages);
  - every image downloaded into `uploads` with alt text, crop and hotspot kept.

  The public pages render the same text. A test compares the rendered `<main>` text of `/novice/<slug>` before and after for 3 sample slugs.
- [db] Each type has engine actions `<type>.create`, `.update`, `.delete` and `.reorder` (where ordered), validated with zod. Each action writes history and can be undone, and is gated by a new section permission: `vsebina` (pages, news, galleries, documents), `zupnija` (churches, groups, people, sacraments, prayer, giving) and `nastavitve` (settings, owner only).
- [db] A helper with `vsebina` access who needs approval and edits a news title gets a change request, and the public title stays unchanged until it is approved.
- [db] Rich text is stored as a constrained JSON document with these block types:
  - paragraph and headings h2 and h3;
  - bold, italic and links;
  - bullet and numbered lists;
  - quote, image and attachment.

  It renders through one component. Pasting from Word strips styles but keeps bold, italic, lists and links. A unit test runs the paste of a fixture HTML.
- [browser] Editor → Spletna stran → Domača stran, as in the prototype: change the subtitle to "Dobrodošli doma", click "Objavi", and `/` shows "Dobrodošli doma" within 5 s (`updateTag`). Undo in Zgodovina restores the old text on `/`.
- [browser] Editor → Novice → "Nova novica":
  1. Fill in the title "Miklavževanje 2026", text and a photo (upload a 4 MB JPEG; it is resized to max 2400 px and WebP and AVIF variants are made).
  2. Click "Objavi".
  3. `/novice/miklavzevanje-2026` returns 200 with the photo, and the homepage news row shows it first.
- [browser] Editor → Galerije: drag 10 photos at once, and they upload with per-file progress. A failed file shows "Ta fotografija se ni naložila. Poskusi znova." while the other 9 succeed. Reordering by drag persists after a reload.
- [browser] Every editor screen has "Predogled" (Preview), which opens the public page with the unsaved draft (Next draft mode) and a bar "Predogled · ni objavljeno".
- [browser] The assistant can change content. Asked "Spremeni uradne ure v torek in petek 16.30–17.30", it proposes a confirm card; after confirming, the footer on `/` shows the new hours.
- [db] Nothing reads Sanity at runtime after the switch-over: `grep -r "@/sanity" src/app` returns 0 hits, and the build passes without `SANITY_*` environment variables.

**Verification:**
- New tests: `src/lib/content/*.test.ts` (one per type), `scripts/import-sanity-all.test.ts`, `src/lib/richtext/paste.test.ts`.
- dev-browser flow: as in the criteria; plus a full round of each type: create → preview → publish → edit → undo → delete.
- Regression risk:
  - every public page currently reads Sanity, so migrate one type at a time behind a data-layer function and keep a snapshot test per page;
  - SEO metadata, sitemap, search, redirects;
  - the existing Sanity webhook revalidation, which gets removed.

## 4. Functional requirements

- FR-1: The site moves to the v3 tokens (US-001). The editor inherits them.
- FR-2: The homepage follows prototype variant A, in this order:
  1. header;
  2. photo hero (shorter, 360 px desktop);
  3. the "Danes" block (Masses with intentions, plus the liturgical day and readings);
  4. a row of 3 cards: next event, bulletin, this week;
  5. news;
  6. the giving and newsletter band;
  7. the footer.

  The current sections "Naše cerkve", welcome text and special period stay below the news, unchanged.
- FR-3: The "Danes" logic lives in `src/lib/data/today.ts`, is server-rendered and revalidates every 300 s. It has four modes: today, tomorrow, none-today and none-at-all (the last one shows "V naslednjih dneh ni vpisanih svetih maš.").
- FR-4: Liturgical data comes first from `calendar_days`, then from hozana `osnovni_podatki.json`. Readings come from hozana `api.php` with `HOZANA_API_KEY`; both are cached for 24 h. There is a page `/berila`, and the source is always shown.
- FR-5: New tables, each in one Drizzle migration:
  - `newsletter_subscribers`;
  - `outbox` (queued mails with `send_after` and `attempts`);
  - `catechesis_enrolments`;
  - `intention_requests`;
  - `sacrament_requests`.
- FR-6: All public forms share one helper. It provides:
  - zod validation with Slovenian messages;
  - a honeypot;
  - an IP rate limit of 5 per 10 min, stored in Postgres, not memory;
  - a mail to the parish address (`settings.parishEmail`, default `info@zupnija-pirnice.si`, which forwards via Cloudflare Email Routing).
- FR-7: Every request type has an editor inbox that is permission-aware. Enrolments are under Verouk, intention requests under Nameni, sacrament enquiries on Domov, and subscribers (owner only) under Ljudje.
- FR-8: The newsletter uses double opt-in. Publishing a bulletin queues one mail per active subscriber, at most once per bulletin. There is one-click unsubscribe, and sending is throttled to a daily limit.
- FR-9: `/daruj` shows a UPN QR generated server-side as SVG. A small QR and the IBAN go in the footer, and there are per-purpose QRs.
- FR-10: There is an `.ics` file for each event, a `/koledar.ics` feed of events and Masses, and Google Calendar links with `ctz=Europe/Ljubljana`. Share controls use `navigator.share` with link fallbacks.
- FR-11: Church pages list that church's Masses for the next 14 days.
- FR-12: There is a `/molitev` page (Sanity singleton) and client-side group search with a `?q=` URL parameter.
- FR-13: Nothing on the public site lets anyone edit data without signing in. Preska's public `/uredi-namen/` is the anti-example.
- FR-14: All website content is editable in the editor (US-013):
  - it is stored in Postgres and goes through the engine (permissions, approval, history, undo, assistant);
  - images are stored in `uploads` with resized variants;
  - Sanity is imported once and then retired.
- FR-15: The public site and the editor share one visual system (§6, prototype v3): the same tokens, radii, buttons, pills and type.

## 5. Non-goals

- Online card or PayPal payments: the site offers QR and IBAN only.
- Livestream or video, multilingual versions, and a Facebook feed embed.
- A pop-up newsletter prompt; the form sits in the footer band only.
- A hall rental page, unless Pirniče has a hall to rent (see Open questions).
- Image-only obituaries.
- A FullCalendar month grid. Our event list with month headings stays, plus the `.ics` feed.

## 6. Design considerations

- **Prototype:** local file `tasks/prototype-homepage-v3.html` (no hosted artifact, at the user's request). The history:
  1. v1 (`prototype-homepage.html`): variant A was chosen.
  2. v2 (`prototype-homepage-v2.html`): rejected as "made in 2002".
  3. v3 is the current direction.
- **Direction for v3:** slick and modern (Apple product pages, iOS widgets), with a quiet sacred accent:
  - **Type:** Inter in heavy weights with tight tracking (-0.045 to -0.055em) for headlines; one *Instrument Serif italic* phrase per headline is the only devotional touch ("Ta teden *v župniji*", "pod *Šmarno goro*").
  - **Colour:**
    - near-white `#fafaf8` and white surfaces, warm dark ink `#1f1c18`; buttons in a warm gold-brown `#7a5c1e` (white text 6:1), never black; dark tones appear only as overlays on photos;
    - a single accent, candle gold `#a8822f` (text `#7d5f1c`); "Bordo" `#8c2a3a` is switchable;
    - no blue: hero and church photos are desaturated (`saturate(.55–.6)`) under a dark warm gradient.
  - **Hero:** a full-bleed real photo (Zgornje Pirniče), 880 px high, with rounded bottom corners (40 px). The huge headline sits bottom-left and the **"Danes" iOS-style widget** bottom-right: dark frosted glass, the next Mass time in 76 px numerals, a live pulsing dot, intentions, and "Vse maše tega tedna" / "V koledar". On a phone the widget sits under the headline, still above the fold.
  - **Bento grid "Ta teden v župniji":**
    - the liturgical day (2×2, warm gold glow, the readings as chips, "Preberi današnja berila");
    - the next event (large "4 dni");
    - the bulletin (soft gold tile);
    - the Masses until Sunday as day chips (Sunday highlighted in soft gold).
  - **Other sections:**
    - news as large rounded photos;
    - a full-bleed candles photo for "Pridite pred *Najsvetejše*", with glass time chips;
    - churches as tall 3:4 photo cards with the name overlaid;
    - the bulletin and newsletter tiles in a soft gold-to-white gradient; giving (QR) on white.
  - **Shape and motion:**
    - radii 28 px for tiles and 40 px for the hero and the prayer band; pills for buttons and tags; soft two-layer shadows;
    - a floating pill navigation, frosted over the hero, that turns solid white after scrolling;
    - a slow hero zoom-out, fade-up on scroll and hover scale, all off under `prefers-reduced-motion`.
- **The editor uses the same system** (the "Urejevalnik" section of the prototype):
  - an iOS Settings-style grouped form (label column plus inline inputs) and section toggles;
  - a sidebar with a "Spletna stran" group;
  - gold-brown pill "Objavi" buttons.

  The editor's current tokens are replaced, not kept side by side.
- The states are redrawn in v3 as widget variants: no Mass today, all over, cancelled, Sunday, long or missing intention, readings down, no bulletin.
- **States drawn in the prototype:**
  1. no Mass today;
  2. all Masses over;
  3. cancelled Mass;
  4. Sunday;
  5. Mass without an intention;
  6. long intention;
  7. readings unavailable;
  8. bulletin not yet uploaded;
  9. no events;
  10. special period;
  11. newsletter success/error.

  Loading is skipped, because the page is server-rendered.
- **Reuse:**
  - `Container`, `Section`, `SectionHeading` and `TextLink` from `components/ui/primitives`;
  - `DayTitle` and `MASS_TYPE_LABEL`;
  - `formatDayHeading` and `formatTime` from `lib/dates`;
  - `Icon`, and `buttonClassName` and `Tag` (shared with the editor).

## 7. Technical considerations

**Parity table:** ✓ = in this PRD, — = deliberately not.

| Feature | Preska | Ribnica | Pirniče after this PRD |
|---|---|---|---|
| Today's Masses with intentions on the homepage | ✓ | ✓ | ✓ US-002 |
| Liturgical day / saints | in the Mass list | weekly modal | ✓ US-003 (plus full readings) |
| Bulletin PDF, archive, download | ✓ | ✓ | already have it |
| Newsletter | ✓ | ✓ (pop-up) | ✓ US-005 (no pop-up) |
| Catechism online enrolment | Google Form | ✓ native | ✓ US-006 native |
| Mass-intention request | — | — | ✓ US-007 |
| Sacrament enquiry | — | — | ✓ US-008 |
| Donation QR and IBAN | ✓ | ✓ footer, per purpose | ✓ US-009 |
| Add to Google Calendar | ✓ | ✓ (wrong time zone) | ✓ US-010 plus .ics feed |
| Share buttons | ✓ | ✓ | ✓ US-010 |
| Per-church Masses | — | ✓ | ✓ US-011 |
| Prayer/adoration page | orphaned page | — | ✓ US-012 |
| Group directory with search | ✓ | — | ✓ US-012 |
| News, galleries, churches, clergy, sacraments, contact form, site search | partly | partly | already have them |
| Hall rental | ✓ | — | Open question |

**Other technical notes:**
- **hozana.si:**
  - `osnovni_podatki.json` is free and needs no key: the current year's celebrations, rank and Gospel line, per diocese (use `ljubljana`).
  - `api.php` needs a key, requested from hozana by e-mail for a named site. The user states the parish has permission to republish the readings. Store the key as `HOZANA_API_KEY` in `/srv/zupnija/.env`, never in git, and always show "Vir: hozana.si" with a link.
- **Mail:** sending still needs a Resend key (`RESEND_API_KEY`). The free tier allows 100 mails a day and 3,000 a month, hence the outbox throttle (FR-8). Until the key exists, the newsletter, confirmations and form notifications sit in the outbox. Incoming mail to `*@zupnija-pirnice.si` already forwards to grega@etiam.si via Cloudflare Email Routing (catch-all rule).
- **Outbox worker:** a route `/api/cron/outbox`, protected by a `CRON_SECRET` header and called every 5 min by a cron on t4a (`curl` from the host). It does not run inside the request that publishes the bulletin.
- **UPN QR:** use the `qrcode` npm package for the matrix, rendered as SVG with error correction M. The payload builder is ours, written against the ZBS "UPN QR" specification and tested against a real bank-app-readable sample.
- **Time zone:** every time is stored and rendered in Europe/Ljubljana through `lib/dates`; there is no `new Date()` formatting in components.
- **Caching:** the homepage revalidates every 300 s. Engine writes already call `updateTag` for masses, intentions, events and bulletins.

## 8. Success metrics

- On a phone, the time and intention of the next Mass are visible without scrolling: 100% of the 4 "Danes" modes in the browser check.
- At least 30 newsletter subscribers within 2 months of launch.
- The office receives at least 50% of catechism enrolments online in the 2027/28 enrolment round.
- 0 reports of wrong calendar times. The Ribnica UTC bug cannot happen, because the test pins `ctz`.

## 9. Open questions

1. **Look (v3):** is `tasks/prototype-homepage-v3.html` the direction? Which accent: "Zlato" (default) or "Bordo"?
2. **hozana API key:** please send the key, or the e-mail where hozana granted permission, so I can request one in the parish's name.
3. **TRR, BIC and purpose** for donations: are the values in Sanity `settings.donations` correct and complete? Is there a per-purpose fund now (for example Karitas, a renovation)?
4. **Parish inbox:** form notifications should go to which address: `info@zupnija-pirnice.si` (forwarded to grega@etiam.si for now), or straight to zupirnice@gmail.com?
5. **Catechism:** the grades and groups for 2026/27, the rules text, and whether enrolment is open now.
6. Does Pirniče have a hall or rooms to rent? If yes, add a page with an enquiry form (as Preska has).
7. Emergency phone number for the sick and for funerals (US-008).

## 10. Verification checklist

### Per-change coverage

**Change 1: Blue palette**
- [ ] **Frontend:** tokens changed in `globals.css` only, and no component has a hard-coded `#3d5a47`. Check: `grep -r "3d5a47" src` returns 0 hits outside `globals.css` history.
- [ ] **Validation:** contrast test passes (US-001).
- [ ] **Backend storage:** N/A, no data.
- [ ] **Round-trip:** N/A.
- [ ] **Edge cases:** season colours and alert red unchanged; the editor checked at 1440 and 390 px.
- [ ] **Scoping:** N/A, public styling.

**Change 2: The "Danes" block**
- [ ] **Frontend:** heading, countdown chip, the Mass list with intentions, the liturgical card, "Preberi današnja berila".
- [ ] **Validation:** N/A, read-only.
- [ ] **Backend:** `getTodayBlock` in all 4 modes, plus cancelled and no-intention cases (US-002).
- [ ] **Round-trip:** an intention added in the editor appears on `/` within 300 s, or immediately via `updateTag`.
- [ ] **Edge cases:** a 160-character intention, 3 intentions on one Mass, a Sunday, a special period.
- [ ] **Scoping:** only published data. Pending change requests never show; check this with a pending intention request.

**Change 3: Liturgy and readings**
- [ ] **Frontend:** the liturgical card and `/berila`.
- [ ] **Validation:** a bad `?datum` redirects.
- [ ] **Backend:** cache hit makes 0 fetches; the `calendar_days` precedence; key missing → `available: false`.
- [ ] **Round-trip:** N/A.
- [ ] **Edge cases:** hozana timeout, the year boundary (31. 12. → 1. 1. needs next year's `osnovni_podatki`), a date outside the year.
- [ ] **Scoping:** N/A.

**Change 4: Homepage cards**
- [ ] **Frontend:** event countdown, bulletin card with PDF, this week.
- [ ] **Backend:** `getHomeEvents`, the current-bulletin fallback.
- [ ] **Edge cases:** no events, no bulletin this month, no PDF (a manually entered bulletin has no "Prenesi PDF").

**Change 5: Newsletter**
- [ ] **Frontend:** footer form, confirm and unsubscribe pages, the editor "Naročniki" tab.
- [ ] **Validation:** bad e-mail, honeypot, rate limit.
- [ ] **Backend storage:** the subscriber row's status transitions pending → active → unsubscribed; outbox rows.
- [ ] **Round-trip:** subscribe → confirm → publish → mail in outbox → unsubscribe → the next publish sends nothing to that address.
- [ ] **Edge cases:** an already-active address, a re-publish, undo, the daily-limit overflow.
- [ ] **Scoping:** the subscriber list is owner-only (a helper gets 404).

**Change 6: Catechism enrolment**
- [ ] **Frontend:** all fields, "dodaj še enega otroka", the closed state.
- [ ] **Validation:** required fields, birth date, rules accepted.
- [ ] **Backend storage:** `catechesis_enrolments` row; 2 mails.
- [ ] **Round-trip:** submit → the editor "Vpisi" lists it → CSV export contains it.
- [ ] **Edge cases:** one parent only, a long name with čšž, two children.
- [ ] **Scoping:** Verouk-area users only.

**Change 7: Intention requests**
- [ ] **Frontend:** the form with honest copy, and the editor tab with a badge count.
- [ ] **Validation:** 200-character limit, past date, a contact is required.
- [ ] **Backend:** convert → an engine `intention.add` is created plus the request's `done` link; decline; undo.
- [ ] **Round-trip:** request → convert → visible on `/masni-nameni`.
- [ ] **Edge cases:** a helper who needs approval (a change request is created).
- [ ] **Scoping:** Nameni-area users only.

**Change 8: Sacrament enquiries**
- [ ] **Frontend:** the button on each sacrament page with the kind preselected; the emergency phone line for sick calls and funerals.
- [ ] **Validation:** kind enum, contact required.
- [ ] **Backend:** the row and the mail.
- [ ] **Round-trip:** submit → shown on editor Domov → resolve removes it.
- [ ] **Scoping:** owner, plus any user granted the new `zakramenti` section.

**Change 9: Giving**
- [ ] **Frontend:** `/daruj`, the footer QR, "Kopiraj IBAN", per-purpose QRs.
- [ ] **Validation:** the UPN payload unit test against the spec.
- [ ] **Backend:** values from Sanity settings.
- [ ] **Edge cases:** an empty IBAN hides everything; a purpose with an amount; a purpose past its deadline is hidden.

**Change 10: Calendars and share**
- [ ] **Frontend:** "Dodaj v koledar" and "Deli" on events, news and bulletins; "Naroči se na koledar" on `/svete-mase`.
- [ ] **Backend:** `.ics` routes and their headers.
- [ ] **Edge cases:** an all-day event (no time), an event across the DST change (25. 10. 2026), a cancelled Mass excluded from the feed.

**Change 11: Church Masses**
- [ ] **Backend:** a per-church filter with divergent counts (3 vs 9).
- [ ] **Edge cases:** a church with none.

**Change 12: Prayer page and group search**
- [ ] **Frontend:** `/molitev`, the search field.
- [ ] **Backend:** the Sanity singleton.
- [ ] **Round-trip:** `?q=` survives a reload.
- [ ] **Edge cases:** 0 items gives 404; a no-match search shows the empty state.

### Test data setup

Seed in `web/scripts/seed.ts`, extended with the flag `--scenario=parity` (via `npm run db:seed -- --scenario=parity`):
- **Churches:** `sv-kriz` (Sv. Križ), `marijina` (Marijina cerkev), `sv-jakob` (Sv. Jakob na Gori, no Masses).
- **Masses, 2026-10-25 → 2026-11-08:**
  - weekdays at 18.00 Marijina;
  - Wednesdays also at 7.30 Sv. Križ;
  - Sundays at 8.00 Sv. Križ and 10.00 Marijina;
  - 2026-11-02 has none.

  That gives Sv. Križ 3 and Marijina 9 in the 14 days from 2026-10-28.
- **Intentions:**
  - 28. 10. 7.30 "Za zdravje";
  - 28. 10. 18.00 "+ Marija Kos, 30. dan" and "++ Anton in Ivana Zupan, obl.";
  - 1. 11. 8.00 "Za farane";
  - 1. 11. 10.00 "++ Franc in Ana Kralj";
  - 3. 11. 18.00 "+ Jože Novak, obl.";
  - one 160-character intention on 30. 10.;
  - 29. 10. 18.00 left without an intention.
- **Cancelled:** a copy of the 28. 10. 7.30 Mass with `status: cancelled` in the "cancelled" scenario only.
- **calendar_days:** 2026-10-28 "Sv. Simon in Juda Tadej, apostola"; 2026-11-01 "Vsi sveti" with gospel "»[vrstica]«".
- **Events:**
  - 2026-11-01 14.00 "Vsi sveti: molitev na pokopališču";
  - 2026-11-06 19.00 "Srečanje Karitas";
  - one unticked bulletin event that must not appear.
- **Bulletins:** October 2026 published with a PDF upload, 10 notices and an article; September 2026 published.
- **Newsletter:** 3 active, 1 pending and 1 unsubscribed subscriber; 120 active in the "overflow" scenario.
- **Groups (Sanity fixture):** 9 groups, 2 of them with "zbor" in the title.
- **Prayer page:** 3 items.
- **Edge cases:** names with čšž, a 200-character intention text, an e-mail with a plus (`ana+zupnija@primer.si`).
- **Isolation:** a helper user with only the Nameni area, used to assert 404 on Verouk "Vpisi", "Naročniki" and Domov enquiries.
- **Cleanup:** tests use per-run `TEST_DB` databases; the dev seed is idempotent and re-runnable.

### Browser end-to-end

- [ ] Test data seeded per the setup above; `DEV_NOW` used to set the four "Danes" moments.
- [ ] Every `[browser]` criterion driven in dev-browser, with the DOM asserted, zero console errors and 2xx network responses.
- [ ] Happy path:
  1. `/` at 14.40;
  2. read the intention;
  3. "Preberi današnja berila" → `/berila`;
  4. back → "Prenesi PDF";
  5. subscribe → confirm;
  6. publish a bulletin in the editor → the outbox has the mail;
  7. `/verouk/vpis` submit → it shows in the editor;
  8. `/masni-nameni/prosnja` submit → convert in the editor → visible on `/masni-nameni`;
  9. `/daruj` → the QR is present;
  10. an event → "Dodaj v koledar" → Google URL `ctz` checked.
- [ ] Screenshots of `/` at 1440 and 390 px, in all four "Danes" modes.
- [ ] **Visual parity:** `/` at 1440 px next to `tasks/prototype-homepage-v3.html` at 1440 px. For each item, report whether it matches or differs: section order, headings and copy, type scale, spacing and card style, colours (the chosen palette), and the empty states.

### Suite gates

- [ ] `npm test` (Vitest with Postgres) passes, with the new tests listed per story.
- [ ] `npm run typecheck` passes.
- [ ] `npx eslint .` reports 0 errors.
- [ ] `npm run build` succeeds.
- [ ] Evidence reported: test output and dev-browser assertions, not "looks good".
