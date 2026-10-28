# Prototype v4: shared brief for the three parts

## What this is

The homepage prototype for **Župnija Pirniče**, a Catholic parish website in Slovenian. The parish is under Šmarno gora, with three churches: Marijina cerkev, Sv. Križ and Sv. Tomaž. The page's one job: a parishioner sees **whether there is Mass today, when, where and for whom**, then this week's parish life.

The approved direction is `tasks/prototype-homepage-v3.html`; read it first. v4 keeps its structure and content but polishes it to a premium level.

## The owner's feedback so far (binding)

- They want the look of an **Apple "Pro" product page**: "more polished, more centered, like every section costs millions", "smooth", "clean", "slick and modern".
- They want it **holy but modern**.
- Rejected:
  - an older ivory, serif and sepia version as "looks like 2002";
  - "too much black": dark tones only as overlays on photos; buttons use the gold-brown `--primary`, never black;
  - anything blue: the photos are desaturated for this reason;
  - muddy grey glass and dark cards nested in dark cards.
- Liked:
  - the light frosted "Danes" widget with the thin day timeline (dots for Masses, a gold "zdaj" mark);
  - the calendar-page date tile;
  - heavy Inter headlines with one Instrument Serif italic phrase.

## Apple Pro polish, concretely

- **Centered section openings.** Each section starts with a centered gold eyebrow (13px, 600, `--accentInk`), a centered headline (the `.h2` scale or larger, with one serif italic phrase) and an optional centered subline (19–21px, `--ink2`, max-width 640px). Content below may be a grid.
- **Generous, consistent rhythm:**
  - 160px between sections on desktop, 96px on mobile;
  - 56px from the section opening to its content;
  - tile gap 20px;
  - container max-width 1240px with 24px side padding.
- **Precision:** everything aligns to the container edges and to each other. Equal tile heights in a row. No orphan words in headlines (use `text-wrap: balance`). Use `font-variant-numeric: tabular-nums` for times.
- **Materials:** white tiles (radius 28px) on `--bg`, with a hairline `0 0 0 1px var(--line)` plus a very soft shadow. Big imagery in rounded 28–40px frames. Restraint: one accent colour, no extra decoration.
- **Motion:** subtle. The `.reveal` fade-up is already in base. Hover is a tiny lift or image scale, at most 1.03. Everything respects `prefers-reduced-motion`.

## Hard rules (so the three parts don't collide)

- **Shared files:**
  - `tasks/proto-v4/base.css` holds the tokens and globals. Do not edit it, with one exception: part A owns the block marked `"Danes" widget` at its end and may refine it. Parts B and C only use those classes.
- **Your file:** write only your own partial, `tasks/proto-v4/partials/<a|b|c>.html`. It contains one `<style>` block and then your markup.
- **Class names:** prefix every new class with your letter (`a-`, `b-`, `c-`), and scope any new token inside your own selectors.
- **The `data-part` attribute:** every top-level element in your partial, including the `<style>`, must carry `data-part="<letter>"`. `shot.sh` hides the other parts with it.
- **Photos:** real parish photos are in `tasks/prototype-assets/`. Reference them as `prototype-assets/<file>.jpg`. The files are:
  - `zgornje-pirnice.jpg`, `zgornje-pirnice-2.jpg`, `spodnje-pirnice.jpg`, `sv-kriz.jpg`, `sv-kriz-2.jpg`, `sv-tomaz.jpg` (all with blue skies; desaturate with `saturate(.55–.6)` or crop them out);
  - `svece.jpg` (candles; the candles sit at the bottom of the frame), `monstranca.jpg`, `roznivenec.jpg`, `obhajilo.jpg`, `zbor.jpg`.
- **Copy:** keep the v3 content, data and Slovenian wording, which has real names, times and intentions. Placeholders in [brackets] stay placeholders. Don't invent new facts about the parish.
- **Quality floor:**
  - works at 390px with no horizontal scroll;
  - visible `:focus-visible` rings;
  - text contrast ≥ 4.5:1;
  - real `<a>`, `<button>` and `<label>` elements.
- **Verify by looking:**
  - Run `tasks/proto-v4/shot.sh <letter> 1440 <height> <out.png>` and `tasks/proto-v4/shot.sh <letter> 390 <height> <out.png>`. Use the Read tool on the PNG to see it, and iterate until it is pixel-clean.
  - Put screenshots in `tasks/proto-v4/shots/`.
  - `node tasks/proto-v4/build.mjs` assembles `tasks/prototype-homepage-v4.html`.
- Do not edit `prototype-homepage-v3.html`, other partials, or anything outside `tasks/proto-v4/`. Do not commit.

## Parts

- **A:**
  - the floating pill nav (`id="nav"`, it gets the `solid` class after scrolling);
  - the hero with the "Danes" widget (`id="top"`; consider centering the headline Apple-style while keeping the widget above the fold);
  - the "Ta teden v župniji" bento: liturgical day and readings, next event with a calendar date, the bulletin, and the Masses until Sunday.
- **B:**
  - "Iz življenja župnije" (news);
  - "Pridite pred Najsvetejše" (prayer and adoration over the candles photo);
  - "Naše cerkve" (the three churches).
- **C:**
  - "Podprite župnijo" (UPN QR) with "Oznanila po e-pošti" (newsletter);
  - the footer;
  - "Ko se dan spremeni" (`id="stanja"`): the 6 widget states, using the shared `.widget` classes;
  - "Na telefonu" (`id="telefon"`): the phone mockup;
  - "Urejevalnik v istem slogu" (`id="urejevalnik"`): the editor screen in an iOS Settings style.

## Report back

In under 150 words: what you changed, plus the final screenshot paths at 1440 and 390.
