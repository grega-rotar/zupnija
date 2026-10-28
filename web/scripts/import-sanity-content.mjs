// Imports the website content from Sanity into Postgres (docs/TECHNICAL.md §8, "Website content"):
// every published settings, homePage, catechesisPage, page, article, announcement, church, person,
// parishGroup, sacrament, parishDocument, gallery and specialPeriod document into `content`, and every
// image and file they reference into `media` (the bytes under UPLOAD_DIR/media/). Reads Sanity's public
// API (no token, read-only). Contract: tasks/contract-content.md.
//
//   docker compose exec web node web/scripts/import-sanity-content.mjs          # production
//   DATABASE_URL=postgres://zupnija:dev@localhost:5433/zupnija UPLOAD_DIR=./.uploads node scripts/import-sanity-content.mjs
//
// Options: --dry-run      import, print, then roll back (assets are still downloaded)
//          --force        also replace documents that were edited in the editor since the import
//          --dump <dir>   write <dir>/sanity-export.json (documents + asset metadata, the test fixture)
//                         and stop; no database needed
//          --if-empty     only when `content` has no rows yet (the container runs this on every start,
//                         so the first deploy fills the site); never fails the start
// Env:     SANITY_PROJECT_ID (hnwav9pa), SANITY_DATASET (production), SANITY_API_VERSION (2026-09-14),
//          UPLOAD_DIR (./.uploads)
//
// Idempotent: a second run changes nothing. A document edited in the editor is kept (and listed).
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { ASSETS_QUERY, CONTENT_TYPES, DOCS_QUERY, assetRefs, importContent, mediaPath } from "./import-sanity-content-lib.mjs";

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const dryRun = argv.includes("--dry-run");
const ifEmpty = argv.includes("--if-empty");
const dumpAt = argv.indexOf("--dump");
const dumpDir = dumpAt >= 0 ? argv[dumpAt + 1] : null;
for (const [i, a] of argv.entries()) {
  if (i === dumpAt + 1 && dumpAt >= 0) continue;
  if (!["--force", "--dry-run", "--dump", "--if-empty"].includes(a)) {
    console.error(`import-sanity-content: unknown option ${a}`);
    process.exit(2);
  }
}
if (dumpAt >= 0 && !dumpDir) {
  console.error("import-sanity-content: --dump needs a directory");
  process.exit(2);
}

const project = process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "hnwav9pa";
const dataset = process.env.SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const version = process.env.SANITY_API_VERSION ?? "2026-09-14";

async function groq(query, params) {
  // api (not apicdn): the import must see the latest published content, not a cached copy.
  const url = new URL(`https://${project}.api.sanity.io/v${version}/data/query/${dataset}`);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(`$${k}`, JSON.stringify(v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).result;
}

if (ifEmpty) {
  const check = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  const [{ n }] = await check`select count(*)::int as n from content`.catch(() => [{ n: -1 }]);
  await check.end();
  if (n !== 0) {
    console.log(n > 0 ? `import-sanity-content: content already has ${n} documents, nothing to do` : "import-sanity-content: content table not readable, skipped");
    process.exit(0);
  }
  // From here a failure is logged but never stops the web container from starting.
  process.on("exit", (code) => {
    if (code) console.error("import-sanity-content: first import failed; run it by hand (docs/TECHNICAL.md §8)");
    process.exitCode = 0;
  });
}

const documents = await groq(DOCS_QUERY, { types: CONTENT_TYPES });
const assets = await groq(ASSETS_QUERY, { ids: assetRefs(documents) });
const counts = {};
for (const d of documents) counts[d._type] = (counts[d._type] ?? 0) + 1;
console.log(`Sanity ${project}/${dataset}: ${documents.length} documents (${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(", ")}), ${assets.length} assets`);

if (dumpDir) {
  await mkdir(dumpDir, { recursive: true });
  const file = path.join(dumpDir, "sanity-export.json");
  await writeFile(file, JSON.stringify({ project, dataset, documents, assets }, null, 1) + "\n");
  console.log(`Wrote ${file}`);
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("import-sanity-content: DATABASE_URL is not set");
  process.exit(1);
}
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "./.uploads");

/** Download an asset into UPLOAD_DIR (once; an existing file of the right size is reused). */
async function store(asset) {
  const abs = path.join(uploadDir, mediaPath(asset._id));
  let bytes;
  const have = await stat(abs).catch(() => null);
  if (have && (!asset.size || have.size === asset.size)) bytes = await readFile(abs);
  else {
    const res = await fetch(asset.url);
    if (!res.ok) throw new Error(`Download of ${asset._id} failed: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
  }
  return { sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.byteLength };
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const r = await importContent(sql, { documents, assets }, { store, force, dryRun });
  console.log(dryRun ? "\nDry run (rolled back):" : "\nImported:");
  console.log(`  content  +${r.inserted} new, ${r.updated} updated, ${r.unchanged} unchanged`);
  console.log(`  media    +${r.media} (files under ${path.join(uploadDir, "media")})`);
  if (r.kept.length) console.log(`\nEdited in the editor since the import, kept (--force replaces them):\n  ${r.kept.join("\n  ")}`);
  if (r.missingAssets.length) console.log(`\nReferenced but missing in Sanity:\n  ${r.missingAssets.join("\n  ")}`);
} catch (e) {
  console.error("import-sanity-content: failed, nothing was imported:", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
