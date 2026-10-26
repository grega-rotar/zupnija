# Župnija Pirniče — Sanity Studio

Standalone content studio for the parish website (`../web`).

```bash
npm install
npm run dev        # http://localhost:3333
npm run typegen    # extract schema + generate TypeScript types into ../web
npm run build      # production build (dist/)
npm run deploy     # deploy to Sanity hosting
```

Sample content: `npx sanity exec scripts/seed-sample-content.ts --with-user-token`
(add `-- --clean` to remove it again).

Documentation lives in `../docs`.
