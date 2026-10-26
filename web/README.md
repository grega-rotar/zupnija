# Župnija Pirniče — website

Next.js (App Router) frontend reading from the Sanity Content Lake.

```bash
cp .env.example .env.local   # fill in SANITY_API_READ_TOKEN for previews
npm install
npm run dev                  # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

Types in `src/sanity/types.generated.ts` are generated from the Studio
(`cd ../studio && npm run typegen`) — do not edit by hand.

Documentation lives in `../docs`.
