/**
 * Manual check for bulletin reading (US-008): runs the REAL claude-pool on
 * every bulletin file in a folder and prints the draft, plus accuracy when an
 * expected draft sits next to the file. Not run in CI; a monthly PDF takes a
 * few minutes and uses pool usage.
 *
 *   cd web
 *   npx tsx --conditions=react-server scripts/eval-bulletin.ts <folder> [periodStart=2026-10-01] [--json out.json]
 *
 * The expected period is the month of periodStart; the document's own period
 * wins. Uses the default reading hints (src/lib/bulletin/hints.ts); NO_HINTS=1
 * runs without them.
 *
 * (--conditions=react-server lets the "server-only" imports load outside Next.)
 * Needs no database: the period's Masses come from the regular schedule in
 * src/test/seed.ts, written out below.
 *
 * Put bulletins (pdf, jpg, png, heic, webp, xlsx, ods, csv) in the folder. For
 * accuracy, add `<file>.expected.json` with the correct draft, shaped like
 * src/lib/bulletin/fixtures/extract-oktober-2026.json (flags are ignored).
 * With --json the (last) draft is written to that file.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dateRange } from "@/lib/dates";
import { DEFAULT_READING_HINTS } from "@/lib/bulletin/hints";
import { extractDraft, scheduleText } from "@/lib/bulletin/prompt";
import { uploadKind, UPLOAD_TYPES } from "@/lib/bulletin/kinds";
import { allIntentions, monthPeriod, type PeriodMass, type ReadableDraft } from "@/lib/bulletin/types";

const CHURCHES = [
  { slug: "marijino-vnebovzetje", name: "Župnijska cerkev Marijinega vnebovzetja" },
  { slug: "sv-kriz", name: "Podružnična cerkev Povišanja svetega Križa" },
  { slug: "sv-tomaz", name: "Podružnična cerkev sv. Tomaža, apostola" },
];
/** weekday (0 = Sunday) → [time, church] */
const SCHEDULE: [number[], string, string][] = [
  [[0], "08:00", "sv-kriz"],
  [[0], "10:00", "marijino-vnebovzetje"],
  [[6], "18:30", "marijino-vnebovzetje"],
  [[1, 5], "18:30", "sv-kriz"],
  [[2, 3], "18:30", "marijino-vnebovzetje"],
  [[4], "07:00", "marijino-vnebovzetje"],
];

async function massesFor(start: string, end: string): Promise<PeriodMass[]> {
  return dateRange(start, end).flatMap((date) => {
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    return SCHEDULE.filter(([days]) => days.includes(wd)).map(([, time, churchSlug]) => ({ date, time, churchSlug }));
  });
}

const norm = (s?: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Intentions paired in order (date, time, church, kind, text), plus day titles, notices and events. */
function accuracy(got: ReadableDraft, want: ReadableDraft) {
  let ok = 0, total = 0;
  const g = allIntentions(got), w = allIntentions(want);
  w.forEach((x, n) => {
    for (const f of ["date", "time", "churchSlug", "kind", "text"] as const) {
      total++;
      if (g[n] && norm(String(g[n][f])) === norm(String(x[f]))) ok++;
    }
  });
  for (const d of want.days) {
    const gd = got.days.find((x) => x.date === d.date);
    for (const f of ["title", "sundayName", "gospel"] as const) {
      if (!d[f]) continue;
      total++;
      if (gd && norm(gd[f]) === norm(d[f])) ok++;
    }
  }
  return {
    ok,
    total,
    intentions: `${g.length}/${w.length}`,
    days: `${got.days.length}/${want.days.length}`,
    notices: `${got.notices.length}/${want.notices.length}`,
    events: `${got.events.length}/${want.events.length}`,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const jsonAt = args.indexOf("--json");
  const jsonOut = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null;
  const [dir, month = "2026-10-01"] = args;
  if (!dir) throw new Error("usage: eval-bulletin.ts <folder> [month] [--json out.json]");
  const period = monthPeriod(month);
  const files = readdirSync(dir).filter((f) => uploadKind(f, "") && !f.endsWith(".json")).sort();
  if (!files.length) throw new Error(`no ${Object.keys(UPLOAD_TYPES).join("/")} files in ${dir}`);
  const hints = process.env.NO_HINTS ? "" : DEFAULT_READING_HINTS;
  const schedule = scheduleText(await massesFor("2026-10-04", "2026-10-10"), CHURCHES);
  let sumOk = 0, sumTotal = 0;

  for (const f of files) {
    const kind = uploadKind(f, "")!;
    const started = Date.now();
    console.log(`\n── ${f} (${kind})`);
    try {
      const out = await extractDraft({ bytes: new Uint8Array(readFileSync(path.join(dir, f))), kind, period, massesFor, churches: CHURCHES, schedule, hints });
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      if (out.status === "unreadable") {
        console.log(`unreadable after ${out.attempts} attempt(s) in ${secs}s: ${out.reason}`);
        continue;
      }
      const d = out.draft;
      console.log(`draft in ${secs}s, ${out.attempts} attempt(s), account ${out.account ?? "?"}`);
      console.log(`  ${d.period.title} (${d.period.start} … ${d.period.end})${d.period.issue ? `, ${d.period.issue}` : ""}`);
      for (const day of d.days) {
        const head = [day.title, day.sundayName && day.sundayName !== day.title ? day.sundayName : "", day.gospel, day.tags.length ? `[${day.tags.join(", ")}]` : ""].filter(Boolean).join(" · ");
        console.log(`  ${day.date} ${head}`);
        for (const it of day.intentions) {
          const flag = it.flag ? `  ⚑ ${it.flag.field}: ${it.flag.question} [${it.flag.options.join(" | ")}]` : "";
          console.log(`      ${it.id} ${it.time} ${it.churchSlug.padEnd(20)} ${it.kind.padEnd(12)} ${it.text}${flag}`);
        }
      }
      d.notices.forEach((n) => console.log(`  • ${n.text}`));
      for (const e of d.events) {
        const flag = e.flag ? `  ⚑ ${e.flag.field}: ${e.flag.question} [${e.flag.options.join(" | ")}]` : "";
        console.log(`  ◆ ${e.date} ${e.time ?? "--:--"} ${e.title}${e.place ? ` (${e.place})` : ""}${e.description ? ` — ${e.description}` : ""}${flag}`);
      }
      if (d.article) console.log(`  article: ${d.article.title} (${d.article.text.length} chars)`);
      if (d.prayerIntention) console.log(`  prayer: ${d.prayerIntention.title} — ${d.prayerIntention.text}`);
      if (jsonOut) writeFileSync(jsonOut, JSON.stringify(d, null, 2) + "\n");
      const expected = path.join(dir, `${f}.expected.json`);
      if (existsSync(expected)) {
        const a = accuracy(d, JSON.parse(readFileSync(expected, "utf8")) as ReadableDraft);
        sumOk += a.ok;
        sumTotal += a.total;
        console.log(`  accuracy: ${a.ok}/${a.total} fields; intentions ${a.intentions}, days ${a.days}, notices ${a.notices}, events ${a.events}`);
      }
    } catch (e) {
      console.log(`failed: ${(e as Error).name}: ${(e as Error).message}`);
    }
  }
  if (sumTotal) console.log(`\nfield accuracy: ${sumOk}/${sumTotal} (${Math.round((100 * sumOk) / sumTotal)}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
