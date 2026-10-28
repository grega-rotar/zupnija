// One-time import of the editor's content from Sanity into Postgres (docs/TECHNICAL.md §8,
// "First deploy of the editor"): churches, the regular Mass schedule, Mass days with intentions,
// events, Verouk groups and weekly bulletins. Reads Sanity's public query API (no token, read-only).
//
//   docker compose exec web node web/scripts/import-sanity.mjs            # production
//   DATABASE_URL=postgres://zupnija:dev@localhost:5433/zupnija node scripts/import-sanity.mjs
//
// Options: --force       run although the editor has been used (history rows); still insert-only
//          --dry-run     import, print, then roll back
// Env:     SANITY_PROJECT_ID (hnwav9pa), SANITY_DATASET (production), SANITY_API_VERSION (2026-09-14)
//
// Idempotent: a second run inserts nothing. Mapping and keys: scripts/import-sanity-lib.mjs.
import postgres from "postgres";
import { QUERY, importSanity, tableCounts } from "./import-sanity-lib.mjs";

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const dryRun = args.has("--dry-run");
for (const a of args) {
  if (!["--force", "--dry-run"].includes(a)) {
    console.error(`import-sanity: unknown option ${a}`);
    process.exit(2);
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("import-sanity: DATABASE_URL is not set");
  process.exit(1);
}

const project = process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "hnwav9pa";
const dataset = process.env.SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const version = process.env.SANITY_API_VERSION ?? "2026-09-14";
// api (not apicdn): the import must see the latest published content, not a cached copy.
const endpoint = `https://${project}.api.sanity.io/v${version}/data/query/${dataset}?query=${encodeURIComponent(QUERY)}&perspective=published`;

const res = await fetch(endpoint);
if (!res.ok) {
  console.error(`import-sanity: Sanity answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const docs = (await res.json()).result;
console.log(
  `Sanity ${project}/${dataset}: ${docs.churches.length} churches, ${docs.schedules.length} schedules, ${docs.massDays.length} Mass days, ` +
    `${docs.events.length} events, ${docs.groups.length} Verouk groups, ${docs.bulletins.length} bulletins`,
);

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const before = await tableCounts(sql);
  const result = await importSanity(sql, docs, { force, dryRun, today });
  const after = await tableCounts(sql);

  console.log(dryRun ? "\nDry run (rolled back):" : "\nImported:");
  for (const t of Object.keys(result.created)) {
    console.log(`  ${t.padEnd(22)} +${String(result.created[t]).padEnd(4)} (${before[t]} → ${dryRun ? before[t] + result.created[t] : after[t]})`);
  }
  if (!Object.values(result.created).some(Boolean)) console.log("  Nothing new: everything was already imported.");
  if (result.warnings.length) {
    console.log("\nWarnings:");
    for (const w of result.warnings) console.log(`  ! ${w}`);
  }
  if (result.lost.length) {
    console.log("\nNot imported (no place for it in Postgres), documents affected:");
    for (const l of result.lost) console.log(`  ${String(l.count).padStart(3)} × ${l.label}`);
  }
} catch (e) {
  if (e?.code === "HAS_HISTORY") {
    console.error(`import-sanity: refusing: ${e.message}`);
    process.exitCode = 3;
  } else {
    console.error("import-sanity: failed, nothing was imported:", e);
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
