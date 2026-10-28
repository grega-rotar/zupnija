# Build v4: shared brief for the three build agents

The owner approved the design in `tasks/prototype-homepage-v4.html`. It is assembled from `tasks/proto-v4/partials/{a,b,c}.html` on top of `tasks/proto-v4/base.css`; read the partial your part comes from. We are now building it in the real Next.js app (`web/`). Requirements are in `tasks/prd-site-parity-homepage.md` (US-001…US-004, US-011, §6 Design).

## Already done (the foundation, by the lead; do not redo)

- `web/src/app/globals.css` has the v4 tokens under the old names, so existing classes follow:
  - colours:
    - `moss` = primary gold-brown `#7a5c1e`;
    - `paper` = page bg `#fafaf8`, `paper-2` = sunk `#f2f1ee`, new `surface` = `#fff`;
    - `stone` = hairline;
    - `gold` = accent, new `gold-ink` = gold text;
  - radii: `rounded-sm` 12px controls, `rounded-md` 18px, `rounded-lg` 28px tiles, `rounded-xl` 40px hero frames;
  - shadows: `shadow-soft` (hairline plus soft) and `shadow-lift`;
  - headings: Inter 700 with tight tracking;
  - utility classes:
    - `.accent`: the Instrument Serif italic phrase, e.g. `<h2>Ta teden <span className="accent">v župniji</span></h2>`;
    - `.eyebrow`: the small gold label;
    - `.lede`: the subline.
- Fonts come from `web/src/lib/fonts.ts` (Inter plus Instrument Serif) in both the site and admin layouts.
- `Button` / `buttonClassName` in `components/ui/primitives.tsx` are pills.

## File ownership (agents run at the same time, in the same working tree)

- **Agent HOME** owns:
  - `src/components/home/**`, `src/components/layout/Header.tsx`, `Nav.tsx`, `Footer.tsx`, `src/app/(site)/page.tsx`;
  - new `src/lib/data/today.ts` and `src/lib/liturgy/**` with their tests.
- **Agent PAGES** owns:
  - every other public route under `src/app/(site)/**` (not `page.tsx` at the root);
  - every other `src/components/**` folder except `home`, `layout/{Header,Nav,Footer}` and `admin`;
  - `src/components/ui/primitives.tsx`, the shared primitives. Others may read it; if they need a primitive change they build a local component instead.
- **Agent EDITOR** owns `src/app/admin/**` and `src/components/admin/**`. No functional changes, only the look.
- **Nobody** edits `globals.css`, `lib/fonts.ts`, `db/schema.ts`, migrations, `lib/admin/engine.ts` or `package.json` without asking the lead. Report the need instead.
- Do not commit, push or switch branches; the lead commits.

## Rules

- **Match the prototype exactly**: section order, copy, centered section openings (eyebrow, h2 with one `.accent` phrase, `.lede`), spacing (sections 160px apart on desktop and 96px on mobile, 56px from opening to content, 20px tile gaps, container 1240px), materials (white tiles, hairline, soft shadow, 28px radius) and the restrained motion. Use the real data the app already has; placeholders from the prototype become real data or are hidden when there is none.
- **No blue, no black blocks.** Desaturate photos as in the prototype.
- **Quality floor:**
  - 390px with no horizontal scroll;
  - `:focus-visible`;
  - contrast ≥ 4.5:1;
  - `prefers-reduced-motion` respected;
  - real `<a>`, `<button>` and `<label>` elements.
- **Next.js 16** is not the Next.js you know. Read `web/AGENTS.md` and the relevant guide in `web/node_modules/next/dist/docs/` before using an API you are unsure of.
- **Server:** a dev server already runs on http://localhost:3000; the editor is http://admin.localhost:3000. Don't start another on 3000; if you need one, use your own port.
- **Screenshots:** use the headless Chrome at `~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell` with `--no-sandbox --hide-scrollbars --window-size=W,H --virtual-time-budget=6000 --screenshot=out.png URL`. Compare with the prototype at the same width, and iterate.
- **Tests:**
  - `cd web && TEST_DB=zupnija_test_<yourname> npx vitest run <files>` uses Postgres on localhost:5433 (user `zupnija`, password `dev`). Look at `vitest.config.ts` and `src/test/` for how `TEST_DB` and `TEST_NOW` work.
  - Add tests for new logic as the PRD lists them.
  - Before you finish:
    - `npx tsc --noEmit -p .` is clean;
    - `npx eslint <your files>` reports 0 errors;
    - your tests pass.
- Code reads like the surrounding code: match its comments, naming and idiom. Slovenian user-facing copy.

## Report back

In under 200 words:
- what you built;
- the files you touched;
- the tests you added and their results;
- the screenshot paths at 1440 and 390;
- anything you needed from outside your files.
