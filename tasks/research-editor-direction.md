# Research notes: how the parish edits content (2026-10-27)

Status: research done, **no PRD yet, nothing implemented**. Next step is the UI prototype (see bottom).

## What the user wants

- The priest and older helpers must be able to update the site easily (Masses, intentions, oznanila, activities).
- **Role-based access**: the priest and different helpers (catechist, secretary, choir…) see and change only their own parts.
- Oznanila arrive as **PDF, handwritten pages (photos), or a spreadsheet**, so AI (Claude) should read them.
- **Agentic first**: a chat where the priest says what to do ("odpovej mašo v sredo", "dodaj namen za Jožeta Novaka v nedeljo ob 8h") and the assistant does it.
- "Next level" editing experience, not a generic CMS.
- The editor is **hosted on its own subdomain** (e.g. `urejanje.zupnija-pirnice.si`), separate from the public site.

## Options considered and dropped

| Option | Why dropped |
|---|---|
| Google Drive / Sheets as source of truth | Free-form sheets break parsing (`8h`, merged cells) → wrong Mass times; Docs→HTML is lossy; Drive push channels expire (files 1 day, changes 1 week, no auto-renew) so needs polling; user found it "too heavy". |
| Drive as drop-box only (files → Claude → Sanity drafts) | Workable, but still heavy; replaced by upload inside our own editor. |
| Stay on Sanity with roles | Free plan has only Administrator + Viewer. Growth ($15/seat/mo) adds Editor (publish) + Contributor (drafts only). **Non-profit plan** = Growth features free, 25 users, apply with project id `hnwav9pa`, ~14 business days; parish eligibility likely but unconfirmed. Per-section roles (catechist → only Verouk) are **Enterprise only**; on lower plans per-user Studio menus can only hide sections (not enforced). |
| Switch to Directus / Strapi | Directus is BSL (fine under $5M revenue) but a full migration; Strapi's free custom admin roles are weak/unclear. |

## Current direction (user leaning here)

**Our own editing app, built from scratch for the parish's tasks, on a subdomain, agentic-first.**

- Task-shaped screens instead of CMS document types:
  - **»Ta teden«**: one week grid, regular Masses pre-filled from the schedule, type intentions straight in.
  - **Naloži oznanila**: photo/PDF/sheet → Claude reads it → draft with "please check" highlights → one »Objavi« (publish) button.
  - Tap a Mass → »Odpovej« (cancel).
  - Live preview of the website card while editing.
  - Big »Razveljavi« (undo) + version history.
  - Phone-first, Slovenian, magic-link or Google login.
  - Per-role start page: the catechist sees only Verouk.
- **Chat assistant** (Claude API with tools that call our own data functions). The assistant **proposes** changes as confirmation cards; the person confirms. Same permission rules as the screens.
- **AI never publishes on its own**: drafts plus human confirmation, because handwritten names in intentions are easy to misread.

### Open architecture decision: what sits underneath the custom editor

1. **Payload CMS underneath** (recommended in discussion): MIT licence, self-hosted, Next.js native, Slovenian admin translation, access control in code that is enforced on the server (collection / document / field level), drafts, versions, uploads. Our UI calls Payload's direct database API; Payload's own admin stays for the developer only. Figma bought Payload in 2025; the repo stays MIT.
2. **Pure from scratch**: Postgres + Drizzle + Better Auth/Auth.js + Tiptap + sharp. Full control, but roughly 30–40% of the effort is plumbing (roles, drafts, history, uploads, backups).
3. Keep Sanity as storage with the custom editor on top: weakest, because there are still no real roles.

Either 1 or 2 means **leaving Sanity**. Now is the cheapest moment: the dataset only holds sample content. Costs:
- rewrite ~17 schema types,
- the web data layer moves from GROQ to Payload/Drizzle,
- seed scripts get redone,
- lose the Live Content API (replace with revalidation on save),
- we now own Postgres + **backups** + file storage on t4a.

## Decisions still needed from the user

1. Payload underneath vs pure from scratch.
2. People and roles list (who sees what). Do helpers' changes wait for the priest's approval?
3. Upload scope for v1: oznanila + intentions only, or events too.
4. Exact subdomain name.
5. Whether to also have an email-in channel later (`oznanila@…` → draft).

## Next step (was in progress when paused)

Following the `writing-prds` skill, build **one prototype artifact** with variants of the editor, using the site's design tokens (`web/src/app/globals.css`: paper/stone/moss/gold palette, Newsreader serif + Source Sans 3) and real data (churches: Marijina cerkev, Sv. Križ, Sv. Tomaž; regular schedule from `studio/scripts/seed-parish-data.ts`).

Planned variants:
- **A. Pogovor najprej** (chat first): chat is the home screen; changes show up as confirmation cards; week panel at the side.
- **B. Teden + pomočnik** (week + assistant): week grid is the main view, chat drawer on the right.
- **C. Opravila** (tasks): home is a to-do list ("Oznanila za nedeljo še niso naložena", "3 maše brez namena"), big buttons, chat bar at the bottom.

States to show:
- Claude is reading an upload
- a field Claude wasn't sure about
- couldn't read the file (error)
- an empty week
- the catechist's restricted view
- a helper's change waiting for the priest
- phone view

After the user picks a variant: PRD at `tasks/prd-<name>.md` + spec in `specs/features/…` with `Status: planned`.

## Sources

- Sanity roles: https://www.sanity.io/docs/roles-reference
- Sanity non-profit plan: https://www.sanity.io/docs/platform-management/non-profit-plan
- Sanity pricing: https://sanity.io/pricing
- Drive push notifications: https://developers.google.com/workspace/drive/api/guides/push
- Payload i18n: https://payloadcms.com/docs/configuration/i18n
- CMS comparison: https://glukhov.org/post/2025/11/headless-cms-comparison-strapi-directus-payload/

## Prototype (2026-10-27)

Local file: `tasks/prototype-editor.html` (open in a browser; the published artifact was deleted). Variants A/B/C, roles župnik / tajnica / katehistinja, states: reading, flagged fields, read error, empty week, helper change waiting, phone. Waiting for the user to pick a variant, then write the PRD.

## AI provider decision (2026-10-27)

The user decided the editor's AI runs on **claude-pool** (spawned as a CLI from the server), not an Anthropic API key. Risk noted in the PRD: claude-pool's README says pooling accounts breaks Anthropic's terms. Mitigation: every task also works without AI.
