# Parish editor (admin.<domain>)

Status: planned

PRD: [`tasks/prd-admin-editor.md`](../../../tasks/prd-admin-editor.md) · Prototype (variant C): [`tasks/prototype-editor.html`](../../../tasks/prototype-editor.html)

## Purpose

A task-shaped, Slovenian, phone-first editor for the priest and helpers. It replaces Sanity Studio for the parish's weekly work.

## Scope (v1)

- Domov: the to-do home.
- Maše in nameni: the week, the Mass panel, and a "Na strani" preview.
- Oznanila: upload a photo, PDF or sheet; Claude extracts a draft; flagged fields; publish.
- Dogodki, Verouk.
- Ljudje in dostop (owner only).
- Zgodovina with undo.
- Assistant chat that proposes changes as cards.
- Login by magic link or Google, invite only.

## Key decisions

- Built from scratch: Next.js 16 (`web/`, both hosts, proxy routes `admin.` to `src/app/(admin)`) + Postgres 17 + Drizzle + Better Auth.
- AI through **claude-pool** (user's decision): `web/src/lib/ai/runClaude.ts` spawns `claude-pool -p --output-format json --model claude-opus-5-5` with a restricted tool list, and the reply is validated with zod. Exit code 75 means busy, and every task still works without AI.
- Sections `mase`, `oznanila`, `dogodki`, `verouk`, plus owner-only `ljudje`. Every write calls `requireSection`. The per-user `requires_approval` setting turns writes into `change_requests` for the owner to approve.
- AI never writes on its own. Assistant tools only read data or return proposals. A bulletin can't be published with open flags, and a server-side schedule check adds flags of its own.
- Every applied change writes `history` (before/after). Undo is allowed while the affected rows are unchanged since.
- Content the editor manages moves from Sanity to Postgres. Articles, pages, galleries and other content stay in Sanity until v2.

## Data model (new tables)

`users`, `user_sections`, the Better Auth tables, `churches`, `mass_schedule_entries`, `mass_day_overrides`, `masses`, `intentions`, `events`, `catechesis_groups`, `catechesis_cancellations`, `bulletins`, `bulletin_notices`, `uploads`, `change_requests`, `history`.

## Routes (admin host)

`/prijava`, `/` (Domov), `/teden`, `/oznanila`, `/oznanila/nalozi`, `/dogodki`, `/verouk`, `/ljudje`, `/zgodovina`

## Public site changes

`/`, `/svete-mase`, `/oznanila`, `/dogodki` and `/verouk` read from `web/src/lib/data/*` (Postgres), with `revalidateTag` called on every editor write.
