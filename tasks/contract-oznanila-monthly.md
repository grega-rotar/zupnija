# Contract: monthly oznanila (2026-10-28)

**The format will change over time.** The October booklet below is today's example, not a fixed format:

- The period comes from the document: a week, a month or any span.
- Printed Mass times win over the schedule. A printed time that differs from the schedule is flagged, never overwritten.
- Content that can't be placed is flagged, never dropped silently and never failing the whole read.
- Parish conventions such as the Sunday line order live in an owner-editable "Navodila za branje oznanil" (`app_settings`, engine action `settings.readingHints`, in history and undoable). They reach the prompt as hints, so a new layout needs a text edit, not a code change.
- Tests keep several formats side by side: monthly booklet, weekly sheet, spreadsheet, handwritten photo.

The parish publishes **one bulletin per month**: a folded A4 booklet. The real example is `oznanila-oktober-2026.pdf`; a copy for development is at `/tmp/claude-1000/-home-grega-grega-rotar-zupnija/578cb306-f30c-49b1-b873-6a11bcd0233e/scratchpad/real/oznanila-oktober-2026.pdf`. Never commit it. The editor was built for a weekly sheet and rejected it. This contract fixes the shapes that every part shares.

## What the real booklet contains

- **Calendar table ("OKTOBER – VINOTOK"):** one row per day of the month.
  - Columns: date and weekday (`11. nedelja`), the liturgical day or saint (`28. navadna nedelja`, `Simon in Juda Tadej, apostola`), optional group tags in caps (`MLADINSKA SK.`, `ŽPS`, `1. ZAKONSKA`, `ZAK. JUBILANTI`, `SODELAVCI KARITAS`, `ŽUPNIJSKO ROMANJE`, `15.00. – 18.30 ČEŠČENJE S.R.T.`), and the Mass intention(s).
  - Sundays have a second row: the Gospel line in italics (`»Kje pa je onih devet?«`) and the second intention.
  - Sunday line 1 belongs to the 8.00 Mass (Sv. Križ), line 2 to the 10.00 Mass (Marijina cerkev): the intentions go in time order.
  - The table rows can be split across pages (the 1–7 rows come last in the PDF).
- **Intention notation:**
  - `+ Name` is one deceased person, `++ …` several. Strip the markers and set kind `deceased`.
  - `obl.` (anniversary) and `30. dan` (30th day after death) stay in the text.
  - `V zahvalo` → kind `thanksgiving`.
  - `Za farane`, `Po namenu`, `Za zdravje`, `Za Božje varstvo in blagoslov`, `Na čast Svetemu Duhu` → kind `other`.
  - One line can hold two names joined by "in" (`++ Jožefa in Milan Ptiček, obl. in ++ iz družin Črnuta`). That is still ONE intention: keep the text, without the `+`/`++` markers.
- **No times in the table.** Times come from the regular schedule (`mass_schedule_entries`), which matches the booklet's "MAŠE:" paragraph.
- **Other parts:**
  - Notices: bullet paragraphs, plus highlighted one-line meeting announcements ("Redna mesečna seja ŽPS-ja bo v torek, 6. oktobra ob 19.15 v župnišču.").
  - A feature article with a title ("Rožnovenska Mati Božja").
  - "MOLITVENI NAMEN ZA MESEC OKTOBER" (the month's prayer intention).
  - The issue line "OKTOBER 2026 · LETO XLII · ŠTEVILKA 10".
  - The office hours paragraph.

## Database (web/src/db/schema.ts; migration 0001 must convert the existing production row)

- **`bulletins`:**
  - `week_start` is replaced by `period_start` (date, unique) and `period_end` (date).
  - New columns:
    - `title` (text, "Oktober 2026");
    - `issue` (text, nullable, "Leto XLII, številka 10");
    - `article` (jsonb, nullable, `{title, text}`);
    - `prayer_intention` (jsonb, nullable, `{title, text}`).
  - Migration of the existing row: `period_start = week_start`, `period_end = week_start + 6`, `title = 'Teden ' || to_char(…)` or similar. There is exactly one such row in production (week 2026-10-25, published, 3 notices).
- **New `calendar_days`:**
  - Columns: `date` (pk), `title` (text, the liturgical day or saint), `sunday_name` (text, nullable), `gospel` (text, nullable), `tags` (text[], default `{}`), `bulletin_id` (fk, nullable, on delete set null).
  - Written by publish, overwriting the dates in the period.
- **`events`:** add `source_bulletin_id` (fk bulletins, nullable, on delete set null).

## Draft (`bulletins.draft`, web/src/lib/bulletin/types.ts)

```ts
type BulletinFlag = { field: "text" | "time" | "date" | "church" | "event"; question: string; options: string[] };

type DraftIntention = {
  id: string;            // "i1"…, unique in the draft
  text: string;          // without +/++ markers, max 200
  kind: "deceased" | "thanksgiving" | "other";
  time: string;          // "HH:MM", assigned by the SERVER from the schedule, not by the model
  churchSlug: string;    // assigned by the server
  sourceLine?: string;   // the row as printed
  flag?: BulletinFlag;
};

type DraftDay = {
  date: string;          // YYYY-MM-DD
  title?: string;        // liturgical day / saint
  sundayName?: string;   // e.g. "28. navadna nedelja" (Sundays)
  gospel?: string;       // e.g. "»Kje pa je onih devet?«"
  tags: string[];        // ["MLADINSKA SK."]
  intentions: DraftIntention[];
};

type DraftEvent = {
  id: string;            // "e1"…
  title: string; date: string; time?: string; place?: string; description?: string;
  include: boolean;      // the priest can untick; default true
  flag?: BulletinFlag;
};

type ReadableDraft = {
  readable: true;
  period: { start: string; end: string; title: string; issue?: string };
  days: DraftDay[];                       // every day of the period that has anything
  notices: { id: string; text: string }[];
  events: DraftEvent[];
  article?: { title: string; text: string };
  prayerIntention?: { title: string; text: string };
};
type BulletinDraft = ReadableDraft | { readable: false; reason: string };
```

- **Mapping intentions to Masses (server, `assignMasses`):**
  - For each day, take that day's generated Masses sorted by time. The i-th intention goes to the i-th Mass.
  - Extra intentions go to the day's last Mass. A Mass can have several intentions.
  - A day with intentions but no scheduled Mass (e.g. a feast) gets a `time` flag on each intention, with options from the schedule.
  - `flagScheduleMismatches` keeps working on the assigned times.
- **Resolutions:** keyed by intention or event id. The publish payload is `{ bulletinId, resolutions: Record<string,string> }`. Edits to notices, event include toggles, added or removed intentions, article and prayer text are saved into the draft first, with `saveDraftForLater(id, draft)`.
- **Publish, in one engine action, deduplicating:**
  - Ensure Masses for the whole period.
  - Insert each intention unless the same Mass already has the same normalised text.
  - Store notices.
  - Write `calendar_days`.
  - Create included events unless one with the same title and date exists, with `source_bulletin_id` set.
  - Set title, issue, article, prayer intention and status `published`.
  - Past dates are allowed: an October booklet uploaded late still fills October.

## Missing-bulletin logic

The "next" bulletin is the next calendar month without a published or pending bulletin covering its first day. Domov shows "Oznanila za november 2026 še niso naložena" from the 20th of the previous month, and always when the current month has none. The upload target defaults to that month.

## Public site

- **/oznanila:** the bulletin covering today, otherwise the latest, showing:
  - title and issue;
  - the article;
  - the prayer intention;
  - the notices;
  - the month's events and meetings;
  - **"Prenesi PDF"** when the upload is a PDF;
  - the weekly Mass view links.
- **PDF route:** a published bulletin's original PDF is served publicly at a stable URL (e.g. `/oznanila/<period_start>/oznanila.pdf`). Unpublished uploads stay private.
- **Mass day cards** (`/masni-nameni`, `/svete-mase`, the editor's day cards and "Na strani") show the `calendar_days` title. On Sundays they also show the Sunday name and the Gospel line.
