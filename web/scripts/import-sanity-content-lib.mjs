// The website-content import (web/scripts/import-sanity-content.mjs) as plain functions, so vitest can
// run it against the test database with the fixture (src/lib/content/read.test.ts). Plain Node ESM:
// the Docker image runs it with node, without tsx. Nothing here talks to Sanity or the disk: the CLI
// fetches the documents and passes a `store` function that saves an asset's bytes.
//
// Contract: tasks/contract-content.md. Documents keep their Sanity JSON and _id; assets keep their
// Sanity asset id, so references and @sanity/image-url keep working.

/** Document types that move into the `content` table. Masses, events, bulletins and Verouk groups don't: they have their own tables. */
export const CONTENT_TYPES = [
  "settings",
  "homePage",
  "catechesisPage",
  "page",
  "article",
  "announcement",
  "church",
  "person",
  "parishGroup",
  "sacrament",
  "parishDocument",
  "gallery",
  "specialPeriod",
  // Only for its title and note: the schedule's times live in mass_schedule_entries (getCurrentSchedules).
  "massSchedule",
];

/** Singletons: one row each, with the type as id. */
export const SINGLETON_TYPES = ["settings", "homePage", "catechesisPage"];

/** GROQ: every published document of the content types (with $types = CONTENT_TYPES). */
export const DOCS_QUERY = `*[_type in $types && !(_id in path("drafts.**"))] | order(_type asc, _id asc)`;

/** GROQ: the asset documents with these ids ($ids). */
export const ASSETS_QUERY = `*[_id in $ids] | order(_id asc){
  _id, _type, url, originalFilename, extension, mimeType, size,
  "metadata": select(_type == "sanity.imageAsset" => metadata { lqip, dimensions { width, height } })
}`;

/** Sanity's system fields that don't belong in `data`. */
const SYSTEM_FIELDS = ["_rev", "_createdAt", "_updatedAt", "_system"];

/** A document as stored in content.data. */
export function stripDoc(doc) {
  const out = { ...doc };
  for (const k of SYSTEM_FIELDS) delete out[k];
  // A schedule's times live in mass_schedule_entries; its Sanity entries would only pin the churches they reference.
  if (out._type === "massSchedule") delete out.entries;
  return out;
}

/** Every asset id ("image-…", "file-…") a document references, anywhere. */
export function assetRefs(docs) {
  const ids = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      if (typeof v._ref === "string" && /^(image|file)-/.test(v._ref)) ids.add(v._ref);
      Object.values(v).forEach(walk);
    }
  };
  docs.forEach(walk);
  return [...ids].sort();
}

/** The content row for a document. `at` is the version time (Sanity's _updatedAt). */
export function contentRow(doc) {
  const at = new Date(doc._updatedAt ?? Date.now());
  return {
    id: doc._id,
    type: doc._type,
    slug: typeof doc.slug?.current === "string" && doc.slug.current ? doc.slug.current : null,
    data: stripDoc(doc),
    published: true,
    // Orderable types (church, person, parishGroup, sacrament) keep their Studio order.
    sort: Number.isInteger(doc.order) ? doc.order : 0,
    created_by: null,
    // created_at = updated_at marks a row as "as imported": the editor's Tracker moves updated_at on
    // every edit, and a re-run leaves such rows alone (unless --force).
    created_at: at,
    updated_at: at,
  };
}

/** "image-<sha1>-800x600-jpg" → { kind, sha1, width, height, ext }. */
export function parseAssetId(id) {
  let m = /^image-([a-f0-9]+)-(\d+)x(\d+)-([a-z0-9]+)$/i.exec(id);
  if (m) return { kind: "image", sha1: m[1], width: Number(m[2]), height: Number(m[3]), ext: m[4] };
  m = /^file-([a-f0-9]+)-([a-z0-9]+)$/i.exec(id);
  if (m) return { kind: "file", sha1: m[1], width: null, height: null, ext: m[2] };
  return null;
}

/** Where an asset lives under UPLOAD_DIR: "media/ab/<id>.<ext>". */
export function mediaPath(id) {
  const a = parseAssetId(id);
  return `media/${a.sha1.slice(0, 2)}/${id}.${a.ext}`;
}

/** The media row for a Sanity asset document, given what `store` returned ({ sha256, size }). */
export function mediaRow(asset, stored) {
  const a = parseAssetId(asset._id);
  return {
    id: asset._id,
    kind: a.kind,
    path: mediaPath(asset._id),
    mime: asset.mimeType ?? (a.kind === "image" ? `image/${a.ext === "jpg" ? "jpeg" : a.ext}` : "application/octet-stream"),
    size: stored.size ?? asset.size ?? 0,
    width: a.width,
    height: a.height,
    // Sanity's own placeholder (same idea as ours: a tiny base64 image).
    lqip: asset.metadata?.lqip ?? null,
    filename: asset.originalFilename ?? null,
    sha256: stored.sha256,
    created_by: null,
  };
}

/** JSON with sorted keys (jsonb doesn't keep key order). */
const stable = (v) =>
  JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

/**
 * Upsert the documents and assets (one transaction).
 *
 * - media: inserted once per id (an id names its bytes, so an existing row is never changed);
 *   `store(asset)` saves the file and returns { sha256, size }.
 * - content: new documents are inserted; a document already here is replaced only while it is
 *   still as imported (created_at = updated_at), i.e. nobody edited it in the editor since.
 *   `force` replaces edited ones too.
 *
 * Returns counts and the ids of edited documents that were kept.
 */
export async function importContent(sql, { documents, assets }, { store, force = false, dryRun = false }) {
  const result = { inserted: 0, updated: 0, unchanged: 0, kept: [], media: 0, missingAssets: [] };
  const byId = new Map(assets.map((a) => [a._id, a]));
  for (const id of assetRefs(documents)) if (!byId.has(id)) result.missingAssets.push(id);

  const ROLLBACK = new Error("dry run");
  try {
    await sql.begin(async (tx) => {
      const have = new Set((await tx`select id from media`).map((r) => r.id));
      for (const asset of assets) {
        if (have.has(asset._id) || !parseAssetId(asset._id)) continue;
        const stored = await store(asset);
        await tx`insert into media ${tx(mediaRow(asset, stored))} on conflict (id) do nothing`;
        result.media++;
      }

      for (const doc of documents) {
        if (!CONTENT_TYPES.includes(doc._type)) continue;
        const row = contentRow(doc);
        const [cur] = await tx`select data, created_at, updated_at from content where id = ${row.id}`;
        if (!cur) {
          await tx`insert into content ${tx(row)}`;
          result.inserted++;
        } else if (cur.updated_at > cur.created_at && !force) {
          result.kept.push(row.id);
        } else if (stable(cur.data) === stable(row.data) && +cur.updated_at === +row.updated_at) {
          result.unchanged++;
        } else {
          const { id, ...rest } = row;
          await tx`update content set ${tx(rest)} where id = ${id}`;
          result.updated++;
        }
      }
      if (dryRun) throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return result;
}
