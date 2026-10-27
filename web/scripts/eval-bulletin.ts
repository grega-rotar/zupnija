/**
 * Manual check for bulletin reading (US-008): runs the REAL claude-pool on
 * every bulletin file in a folder and prints the draft, plus field accuracy
 * when an expected draft sits next to the file. Not run in CI; each file takes
 * 5–30 s and uses pool usage.
 *
 *   cd web
 *   npx tsx --conditions=react-server scripts/eval-bulletin.ts <folder> [weekStart=2026-11-02]
 *
 * (--conditions=react-server lets the "server-only" imports load outside Next.)
 * Needs no database: the week's Masses come from the regular schedule in
 * src/test/seed.ts, written out below.
 *
 * Real sample photos are needed: put photographed/scanned bulletins (jpg, png,
 * heic, webp, pdf) and spreadsheets (xlsx, ods, csv) in the folder. For
 * accuracy, add `<file>.expected.json` with the correct draft, e.g.
 * oznanila-rokopis.jpg + oznanila-rokopis.jpg.expected.json shaped like
 * src/lib/bulletin/fixtures/extract-rokopis.json (flags are ignored).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { addDays, dateRange } from "@/lib/dates";
import { extractDraft } from "@/lib/bulletin/prompt";
import { uploadKind, UPLOAD_TYPES } from "@/lib/bulletin/kinds";
import type { ReadableDraft, WeekMass } from "@/lib/bulletin/types";

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

function weekMasses(weekStart: string): WeekMass[] {
  return dateRange(weekStart, addDays(weekStart, 6)).flatMap((date) => {
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    return SCHEDULE.filter(([days]) => days.includes(wd)).map(([, time, churchSlug]) => ({ date, time, churchSlug }));
  });
}

const FIELDS = ["date", "time", "churchSlug", "kind", "text"] as const;

/** Share of expected item fields matched (items paired in order), and notice count. */
function accuracy(got: ReadableDraft, want: ReadableDraft) {
  let ok = 0, total = 0;
  want.items.forEach((w, n) => {
    const g = got.items[n];
    for (const f of FIELDS) {
      total++;
      if (g && String(g[f]).trim().toLowerCase() === String(w[f]).trim().toLowerCase()) ok++;
    }
  });
  return { ok, total, items: `${got.items.length}/${want.items.length}`, notices: `${got.notices.length}/${want.notices.length}` };
}

async function main() {
  const [dir, weekStart = "2026-11-02"] = process.argv.slice(2);
  if (!dir) throw new Error("usage: eval-bulletin.ts <folder> [weekStart]");
  const masses = weekMasses(weekStart);
  const files = readdirSync(dir).filter((f) => uploadKind(f, "") && !f.endsWith(".json")).sort();
  if (!files.length) throw new Error(`no ${Object.keys(UPLOAD_TYPES).join("/")} files in ${dir}`);
  let sumOk = 0, sumTotal = 0;

  for (const f of files) {
    const kind = uploadKind(f, "")!;
    const started = Date.now();
    console.log(`\n── ${f} (${kind})`);
    try {
      const out = await extractDraft({ bytes: new Uint8Array(readFileSync(path.join(dir, f))), kind, weekStart, masses, churches: CHURCHES });
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      if (out.status === "unreadable") {
        console.log(`unreadable after ${out.attempts} attempt(s) in ${secs}s: ${out.reason}`);
        continue;
      }
      console.log(`draft in ${secs}s, ${out.attempts} attempt(s), account ${out.account ?? "?"}`);
      for (const it of out.draft.items) {
        const flag = it.flag ? `  ⚑ ${it.flag.field}: ${it.flag.question} [${it.flag.options.join(" | ")}]` : "";
        console.log(`  ${it.id} ${it.date} ${it.time} ${it.churchSlug.padEnd(20)} ${it.kind.padEnd(12)} ${it.text}${flag}`);
      }
      out.draft.notices.forEach((n) => console.log(`  • ${n}`));
      const expected = path.join(dir, `${f}.expected.json`);
      if (existsSync(expected)) {
        const a = accuracy(out.draft, JSON.parse(readFileSync(expected, "utf8")) as ReadableDraft);
        sumOk += a.ok;
        sumTotal += a.total;
        console.log(`  accuracy: ${a.ok}/${a.total} fields, items ${a.items}, notices ${a.notices}`);
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
