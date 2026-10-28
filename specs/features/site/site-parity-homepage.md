# Homepage around "today" and parity with Preska and Ribnica

Status: planned (2026-10-28) · PRD: `tasks/prd-site-parity-homepage.md` · Prototype: `tasks/prototype-homepage.html` (variant A)

## Purpose

The homepage answers "is there Mass today, when, where, for whom" in the first screen. The site also gains what zupnija-preska.si and zupnija-ribnica.si offer that fits Pirniče.

## Scope

- **Design system v3** (`tasks/prototype-homepage-v3.html`), shared by the site and the editor:
  - near-white and warm cream, gold-brown buttons, a candle-gold accent; no blue and no black blocks;
  - Inter in heavy weights, with an Instrument Serif italic accent;
  - a full-bleed photo hero with an iOS-style "Danes" widget, a bento grid, pills and a floating frosted nav;
  - gentle motion.
- **All website content editable in the editor** (pages, news, galleries, churches, groups, people, sacraments, settings, homepage). It moves from Sanity into Postgres and goes through the engine; Sanity is retired.
- **Homepage (variant A):**
  - a "Danes" block: today's or the next Masses with intentions, plus the liturgical day and readings;
  - cards for the next event, the bulletin and this week;
  - a giving and newsletter band.
- **Readings from hozana.si:** `osnovni_podatki.json` (free) and `api.php` (`HOZANA_API_KEY`), cached 24 h; a `/berila` page.
- **Newsletter:** double opt-in; every published bulletin is e-mailed once, through a throttled outbox.
- **Forms:** catechism enrolment, Mass-intention request and sacrament enquiry. Each is stored in Postgres, mailed to the parish and shown in an editor inbox.
- **Giving:** `/daruj` with a UPN QR (SVG) and IBAN; a small QR in the footer; per-purpose QRs.
- **Calendars:** `.ics` per event, a `/koledar.ics` feed, Google links with `ctz=Europe/Ljubljana`, and share controls.
- **Church pages:** list that church's Masses for 14 days.
- **Other pages:** `/molitev` (prayer and adoration, a Sanity singleton) and group search (`?q=`).

## Data model

New tables:
- `newsletter_subscribers` (email, status pending|active|unsubscribed, token, consent_at);
- `outbox` (to, subject, text, html, headers, status, send_after, attempts);
- `catechesis_enrolments`;
- `intention_requests` (status new|done|declined, intention_id);
- `sacrament_requests` (kind, status).

Changed columns and settings:
- `bulletins.mailed_at` is added.
- `app_settings` gains `verouk.enrolmentOpen`.
- Sanity: a `prayerPage` singleton and `donationPurpose` documents.

## Routes

**Public:**
- `/berila`
- `/obvestila/potrdi`, `/obvestila/odjava`
- `/verouk/vpis`
- `/masni-nameni/prosnja`
- `/zakramenti/povprasevanje`
- `/daruj`
- `/dogodki/<slug>/dogodek.ics`, `/koledar.ics`
- `/molitev`

**Internal:** `/api/cron/outbox` (needs `CRON_SECRET`).

**Editor:**
- Verouk → Vpisi
- Nameni → Prošnje
- Domov → enquiries
- Ljudje → Naročniki (owner only)

## Key decisions

- Nothing public edits data. Preska exposes intention editing without login; we never do.
- There is no online payment, only QR and IBAN, and no pop-up newsletter.
- Mail goes out through Resend's free tier, limited per day by the outbox. Incoming `*@zupnija-pirnice.si` mail forwards via Cloudflare Email Routing.
- Readings are republished with the parish's permission from hozana.si, always credited and linked.
