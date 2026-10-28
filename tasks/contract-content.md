# Contract: all website content in the editor (US-013), 2026-10-28

Goal: the priest edits **every** piece of website content in the editor (`admin.<domain>`), and Sanity is retired. Production changes go through PRs; the lead commits.

## Key decision: keep Sanity's document shapes, change only where they live

The Sanity dataset is small: settings 1, homePage 1, catechesisPage 1, page 2, article 6, announcement 6, church 3, person 2, parishGroup 7, sacrament 7, parishDocument 6, gallery 0, specialPeriod 0. Masses, events, bulletins and Verouk groups are already in Postgres. The schemas are in `studio/schemaTypes/**`.

- **Documents** are stored **as their Sanity JSON** (minus `_rev`, `_updatedAt`, `_createdAt`) in a Postgres `content` table.
  - Ids stay the same: imported docs keep their Sanity `_id`, and new docs get `crypto.randomUUID()`.
  - References (`{_type:"reference", _ref}`) therefore stay valid.
- **Rich text** stays **Portable Text**. The public `RichText` renderer is unchanged, and the editor uses `@portabletext/editor`, which outputs Portable Text natively.
- **Assets** keep their Sanity asset ids (`image-<sha1>-<w>x<h>-<ext>`, `file-<sha1>-<ext>`) and are stored in a `media` table plus files on the uploads volume.
  - New uploads get ids in the same format, so `@sanity/image-url` keeps working with `baseUrl` pointed at our own `/media` route.
  - The route implements the CDN params we use: `rect`, `w`, `h`, `fit`, `crop`, `fp-x`, `fp-y`, `q`, `auto=format`, and `dl` for files, with sharp and an on-disk cache.
- **The public data layer** (`src/sanity/data.ts`, 42 exported functions) keeps its exported names **and return types** (`src/sanity/types.generated.ts` stays the type contract). It reads Postgres instead of GROQ. Pages and components do not change, apart from removing the Sanity Live and visual-editing bits.

## Database (one migration, `web/drizzle/0002_content.sql`, made with drizzle-kit)

```ts
content = pgTable("content", {
  id: text().primaryKey(),             // Sanity _id or uuid
  type: text().notNull(),              // "article", "settings", … (Sanity _type)
  slug: text(),                        // data.slug.current when the type has one; unique per type (partial unique index where slug is not null)
  data: jsonb().notNull(),             // the full document incl. _id and _type
  published: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
  createdBy: text(), createdAt: timestamp({withTimezone:true}).defaultNow().notNull(),
  updatedAt: timestamp({withTimezone:true}).defaultNow().notNull(),
}); // index on (type, sort)

media = pgTable("media", {
  id: text().primaryKey(),             // "image-<sha1>-<w>x<h>-<ext>" | "file-<sha1>-<ext>"
  kind: text().notNull(),              // "image" | "file"
  path: text().notNull(),              // relative to UPLOAD_DIR, e.g. "media/ab/<id>.<ext>"
  mime: text().notNull(), size: integer().notNull(),
  width: integer(), height: integer(), // images
  lqip: text(),                        // tiny base64 webp placeholder for images (sharp, 20px)
  filename: text(),                    // original file name
  sha256: text().notNull(),
  createdBy: text(), createdAt: timestamp({withTimezone:true}).defaultNow().notNull(),
});
```

**Singletons** are rows with a fixed id equal to the type: `settings`, `homePage`, `catechesisPage`.

## Engine actions (`web/src/lib/content/actions.ts`, registered in `lib/admin/registry.ts`)

**Areas.** Add to `SECTIONS` in `lib/admin/sections.ts`:
- `"vsebina"`: label "Vsebina strani" (pages, news, announcements, galleries, documents, homePage, special periods);
- `"zupnija"`: label "Župnija" (churches, people, groups, sacraments, catechesisPage).

`settings` is owner-only: use the existing owner-only check, as "ljudje" does.

| action | payload | notes |
|---|---|---|
| `content.save` | `{ id?: string, type: ContentType, data: object }` | Validated by the type's zod schema (`lib/content/schemas.ts`), with slug uniqueness and a "Ta naslov že obstaja" error. Creates (new uuid) or replaces `data`. `approvable: true`. Tags `["content", "content:<type>"]`. Label: "Sprememba: <title>" / "Novo: <title>". |
| `content.delete` | `{ id }` | Owner only, never queued. Refuses when another doc references it: "Na to se sklicuje: …". |
| `content.reorder` | `{ type, ids: string[] }` | Sets `sort`. |
| `content.publish` | `{ id, published: boolean }` | `approvable`. |
| `media.*` | none | Uploads are not engine actions: a server action `uploadMedia(formData)` in `lib/content/media.ts` stores the file (sha256 dedupe), returns `{ id, url, width, height, filename }` and writes no history. A media row is only "used" once a saved doc references it. |

Undo and history work through `track.insert/update/delete` on `content`. The track helper already supports non-id-keyed tables; `content` uses its text `id`.

## Field definitions (`web/src/lib/content/fields.ts`): one source for the form and the validation

```ts
type Field =
  | { kind: "string"; name: string; label: string; required?: boolean; max?: number; help?: string }
  | { kind: "text"; name: string; label: string; rows?: number; max?: number; required?: boolean; help?: string }
  | { kind: "slug"; name: string; label: string; source: string }            // stored as {_type:"slug", current}
  | { kind: "date" | "datetime" | "time"; name: string; label: string; required?: boolean }
  | { kind: "boolean"; name: string; label: string; help?: string }
  | { kind: "select"; name: string; label: string; options: {value: string; label: string}[]; required?: boolean }
  | { kind: "image"; name: string; label: string; required?: boolean }      // imageWithAlt shape {_type:"image", asset:{_type:"reference",_ref}, alt, hotspot?, crop?}
  | { kind: "file"; name: string; label: string; accept?: string }          // {_type:"file", asset:{_type:"reference",_ref}}
  | { kind: "richText"; name: string; label: string; variant: "full" | "simple" } // blockContent | simpleBlockContent
  | { kind: "reference"; name: string; label: string; to: ContentType[]; many?: boolean }
  | { kind: "object"; name: string; label: string; fields: Field[] }
  | { kind: "array"; name: string; label: string; of: { type: string; label: string; fields: Field[] }[] }; // each item gets _key and _type

type TypeDef = {
  type: ContentType; label: string; plural: string; area: "vsebina" | "zupnija" | "owner";
  singleton?: boolean; orderable?: boolean; titleField: string; subtitle?: (doc) => string;
  fields: Field[]; publicPath?: (doc) => string | null;   // for "Odpri na strani" / preview
};
```

- **The `TYPES` registry** mirrors `studio/schemaTypes/**` exactly: same field names, the same nested objects (address, openingHours, link, faqItem, attachment, seo, pageHeader), and the page sections.
- **`schemas.ts` derives zod from `fields.ts`**, so validation messages are in Slovenian.

## Editor UI (`web/src/app/admin/(app)/vsebina/**`, `web/src/components/admin/vsebina/**`)

- **Sidebar.** A new "Spletna stran" group in `components/admin/nav.ts`, each item shown only when the actor `can()`:
  - Domača stran, Strani, Novice, Obvestila, Galerije, Dokumenti, Cerkve, Skupine, Duhovniki, Zakramenti, Verouk (stran), Posebna obdobja;
  - Nastavitve (owner only).
- **Routes:**
  - `/vsebina/<type>`: the list, with search, a drag-reorder handle when orderable, a published dot, and "Nova …";
  - `/vsebina/<type>/<id>`: the form;
  - a singleton goes straight to its form.
- **The form**, generic and rendered from `TypeDef.fields` in the v4 editor style: grouped rows, label column, inputs.
  - Every field kind has a component under `components/admin/vsebina/fields/`.
  - The sticky top bar has "Shrani", "Predogled" (opens the public path in draft preview; skip it if it is too costly and say so) and "Odpri na strani".
  - "Izbriši" is in the overflow menu.
  - Unsaved changes are guarded with a confirm on leave.
  - Errors appear per field.
- **Rich text:** a `<RichTextField value onChange variant>` built on `@portabletext/editor`. Toolbar:
  - full: B, I, link, H2, H3, quote, the two list types, image, attachment;
  - simple: B, I, link, bullet list.

  Pasting from Word keeps only these marks.
- **Images:** `<ImageField>` uploads (drag and drop), shows the preview, edits alt text, and sets the focal point (hotspot) by clicking on the image. "Odstrani" clears it.
- **Files:** `<FileField>` uploads and shows the file name and size.
- **Arrays:** add or remove items, move up and down, and pick the item type for page sections. **References:** a searchable select.

## Public side

- **`src/sanity/data.ts`:** every function reads through `src/lib/content/read.ts`. It loads all published `content` rows plus the needed `media` once per request (React `cache`) and through `unstable_cache` with tag `content`. Each GROQ projection in `src/sanity/queries/*.ts` is re-implemented in TS:
  - resolve references;
  - `asset->` becomes the media row: `{_id, url, metadata:{dimensions, lqip}}`;
  - counts, ordering and filters (dates, `published`, `showUntil`, …) follow the GROQ.
- **Tests:** given an imported fixture of the real dataset (`src/test/fixtures/sanity-export.json`, made by the import script with `--dump`), each data function returns deep-equal results to what the GROQ query returned (`src/test/fixtures/groq-results.json`, captured once from the live Sanity API). Dynamic dates are pinned with TEST_NOW.
- **Remove:**
  - `SanityLive`, `VisualEditing`, `DisableDraftMode` and the Sanity draft-mode API route from the public site;
  - `next-sanity` usage, but keep `@sanity/image-url` (`urlFor` with `baseUrl` = `/media`).

  `image-loader.ts` must accept our `/media/...` URLs.
- **`/media/images/<project>/<dataset>/<file>` and `/media/files/<project>/<dataset>/<file>`** (keep that path shape so `@sanity/image-url` builds it):
  - streams the original or a sharp derivative cached under `UPLOAD_DIR/media-cache/`;
  - sends `Cache-Control: public, max-age=31536000, immutable`;
  - returns 404 for unknown ids.

## Import (`web/scripts/import-sanity-content.mjs`, idempotent, safe to re-run)

- **Fetching:** reads every published document of the content types from the public Sanity API (project `hnwav9pa`, dataset `production`, no token needed) and every referenced asset; downloads the assets into media storage.
- **Writing:** upserts `content` and `media`, keeping existing rows that were edited after import (`updatedAt` > the import run) unless `--force`.
- **`--dump <dir>`:** writes the fixtures above.
- **Production:** run once in the web container, like `import-sanity.mjs`. Documented in `docs/TECHNICAL.md §8`.

## Ownership (parallel agents, one working tree)

- **CORE:**
  - `db/schema.ts` (content, media) and the migration;
  - `lib/content/{read,actions,schemas,media}.ts` (`schemas.ts` consumes `fields.ts` from FORMS);
  - the `/media` route, `src/sanity/*` and the data layer switch;
  - the site layout cleanup and the import script;
  - `lib/admin/sections.ts` and `registry.ts`;
  - tests.
- **FORMS:**
  - `lib/content/fields.ts` (all `TYPES`, mirroring studio);
  - `app/admin/(app)/vsebina/**`, `components/admin/vsebina/**` except `fields/RichTextField*` and `fields/ImageField*` / `fields/FileField*`;
  - `components/admin/nav.ts`.

  FORMS writes `fields.ts` FIRST: CORE derives zod from it.
- **MEDIA-UI:** `components/admin/vsebina/fields/{RichTextField,ImageField,FileField}*` and their CSS, with the exact props above.
- **The lead:** `package.json`. Agents tell the lead which packages they need: `@portabletext/editor` (MEDIA-UI) and `sharp` as an explicit dependency (CORE). Install with `npm i` only after telling the lead in the report; if blocked, the lead installs.
