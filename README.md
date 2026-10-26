# Župnija Pirniče — spletna stran in urejevalnik vsebine

Monorepo:

| Folder | What | Run |
|---|---|---|
| `studio/` | Standalone Sanity Studio (content editing) | `cd studio && npm run dev` → http://localhost:3333 |
| `web/` | Next.js public website (Docker on t4a, see `infra/`) | `cd web && npm run dev` → http://localhost:3000 |
| `docs/` | Documentation | — |

- Editors (Slovenian): [`docs/NAVODILA-ZA-UREJANJE.md`](docs/NAVODILA-ZA-UREJANJE.md)
- Developers: [`docs/TECHNICAL.md`](docs/TECHNICAL.md)

Sanity project `hnwav9pa`, dataset `production`. The dataset currently holds
**sample content** (marked »vzorec«) — nothing in it is verified parish
information.
