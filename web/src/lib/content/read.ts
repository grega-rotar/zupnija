/**
 * The website's content, from Postgres (`content` + `media`), in exactly the
 * shapes the old GROQ queries returned (src/sanity/queries/*.ts, result types
 * in src/sanity/types.generated.ts). src/sanity/data.ts calls these.
 *
 * The dataset is small (a few dozen documents), so every published row and
 * every media row is loaded once per request (React `cache`) through
 * `unstable_cache` with the tag "content" (the editor's content actions
 * revalidate it), and each query is a plain function over that store:
 *
 *  - references resolve to the published document (or null: missing, a
 *    draft, or a type that lives in its own table now, like events);
 *  - `asset->` resolves to the media row: { _id, url, metadata { lqip, dimensions } };
 *  - filters, ordering, slices, `count()`, `coalesce()` and `pt::text()`
 *    follow the GROQ, including its nulls (a projected field that is missing
 *    is null, and `count(missing) > 0` is null, not false).
 *
 * Tested against the live GROQ results: src/lib/content/read.test.ts.
 */
import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cached } from "@/lib/data/cache";
import { dataset, projectId } from "@/sanity/env";
import type * as T from "@/sanity/types.generated";

// The documents are schemaless JSON here; the result types above are the contract.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
type Doc = Record<string, J>;

type MediaRow = typeof schema.media.$inferSelect;
type Row = { id: string; type: string; sort: number; updatedAt: string; data: Doc };
type Loaded = { rows: Row[]; media: Omit<MediaRow, "createdAt" | "createdBy" | "sha256" | "path">[] };

async function loadAll(): Promise<Loaded> {
  const c = schema.content;
  const m = schema.media;
  const [rows, media] = await Promise.all([
    db
      .select({ id: c.id, type: c.type, sort: c.sort, updatedAt: c.updatedAt, data: c.data })
      .from(c)
      .where(eq(c.published, true))
      .orderBy(asc(c.id)),
    db
      .select({ id: m.id, kind: m.kind, mime: m.mime, size: m.size, width: m.width, height: m.height, lqip: m.lqip, filename: m.filename })
      .from(m),
  ]);
  return { rows: rows.map((r) => ({ ...r, updatedAt: sanityTime(r.updatedAt) })), media };
}

/** Sanity's timestamp format: "2026-10-26T17:48:37Z" (no milliseconds). */
const sanityTime = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

const loadCached = cached(loadAll, "content", ["content"]);

export type Store = {
  rows: Row[];
  byId: Map<string, Row>;
  media: Map<string, Loaded["media"][number]>;
};

/** Everything published, once per request. */
export const contentStore = cache(async (): Promise<Store> => {
  const { rows, media } = await loadCached();
  return { rows, byId: new Map(rows.map((r) => [r.id, r])), media: new Map(media.map((x) => [x.id, x])) };
});

// ───────────────────────── GROQ building blocks ─────────────────────────

const isObj = (v: unknown): v is Doc => !!v && typeof v === "object" && !Array.isArray(v);
const nul = <V>(v: V | undefined): V | null => (v === undefined ? null : v);

/** `obj { … }`: null unless an object. */
function proj<R>(v: unknown, f: (o: Doc) => R): R | null {
  return isObj(v) ? f(v) : null;
}

/** `arr[]{ … }`: null unless an array. */
function each<R>(v: unknown, f: (o: Doc) => R): R[] | null {
  return Array.isArray(v) ? v.map((x) => (isObj(x) ? f(x) : x)) : null;
}

/** `count(arr)`: null unless an array. */
const count = (v: unknown): number | null => (Array.isArray(v) ? v.length : null);

/** `pick(o, a, b)` = `o { a, b }` without a projection of its own. */
function pick(o: Doc, ...keys: string[]): Doc {
  return Object.fromEntries(keys.map((k) => [k, nul(o[k])]));
}

const slugOf = (d: Doc) => nul(d.slug?.current);

/** `ref->`: the published document, or null. */
function deref(s: Store, ref: unknown): Doc | null {
  const id = isObj(ref) ? ref._ref : undefined;
  return typeof id === "string" ? (s.byId.get(id)?.data ?? null) : null;
}

/** `*[_type == type]`, in id order (GROQ's default). */
const ofType = (s: Store, type: string): Doc[] => s.rows.filter((r) => r.type === type).map((r) => r.data);

const sortOf = (s: Store, d: Doc) => s.byId.get(d._id)?.sort ?? 0;

/** GROQ ordering: null/missing sorts after every value. */
function cmp(a: unknown, b: unknown): number {
  const an = a == null, bn = b == null;
  if (an || bn) return an === bn ? 0 : an ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const x = String(a), y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

type Key = [(d: Doc) => unknown, "asc" | "desc"];
function order(list: Doc[], ...keys: Key[]): Doc[] {
  return [...list].sort((a, b) => {
    for (const [f, dir] of keys) {
      const c = cmp(f(a), f(b));
      if (c) return dir === "asc" ? c : -c;
    }
    return 0;
  });
}

/** `pt::text(blocks)`: the blocks' text, a blank line between blocks. */
function ptText(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  return v
    .filter((b) => isObj(b) && b._type === "block")
    .map((b) => (Array.isArray(b.children) ? b.children.map((c: J) => (typeof c?.text === "string" ? c.text : "")).join("") : ""))
    .join("\n\n");
}

/** `a <= b` on GROQ strings: null when either side is missing. */
const lte = (a: unknown, b: string) => typeof a === "string" && a <= b;
const gte = (a: unknown, b: string) => typeof a === "string" && a >= b;
const defined = (v: unknown) => v != null;

// ───────────────────────── Assets ─────────────────────────

const MEDIA_BASE = "/media";

/** The /media URL of an asset id, the path shape cdn.sanity.io had (so @sanity/image-url builds the same). */
export function mediaUrl(id: string): string | null {
  let m = /^image-([a-f0-9]+)-(\d+x\d+)-([a-z0-9]+)$/i.exec(id);
  if (m) return `${MEDIA_BASE}/images/${projectId}/${dataset}/${m[1]}-${m[2]}.${m[3]}`;
  m = /^file-([a-f0-9]+)-([a-z0-9]+)$/i.exec(id);
  if (m) return `${MEDIA_BASE}/files/${projectId}/${dataset}/${m[1]}.${m[2]}`;
  return null;
}

/** `asset->`: the asset document as Sanity had it, or null. */
function assetDoc(s: Store, ref: unknown): Doc | null {
  const id = isObj(ref) ? ref._ref : undefined;
  const m = typeof id === "string" ? s.media.get(id) : undefined;
  if (!m) return null;
  const extension = m.id.slice(m.id.lastIndexOf("-") + 1);
  const dims = m.width && m.height ? { width: m.width, height: m.height, aspectRatio: m.width / m.height } : null;
  return {
    _id: m.id,
    url: mediaUrl(m.id),
    originalFilename: m.filename,
    extension,
    size: m.size,
    mimeType: m.mime,
    metadata: m.kind === "image" ? { lqip: m.lqip, dimensions: dims } : null,
  };
}

/** `asset->{ … keys }`. */
const asset = (s: Store, ref: unknown, ...keys: string[]) => proj(assetDoc(s, ref), (a) => pick(a, ...keys));

// ───────────────────────── Fragments (src/sanity/queries/fragments.ts) ─────────────────────────

const imageFragment = (s: Store, o: Doc) => ({
  asset: proj(assetDoc(s, o.asset), (a) => ({
    _id: a._id,
    url: a.url,
    metadata: proj(a.metadata, (md) => ({
      lqip: nul(md.lqip),
      dimensions: proj(md.dimensions, (d) => pick(d, "width", "height", "aspectRatio")),
    })),
  })),
  alt: nul(o.alt),
  caption: nul(o.caption),
  hotspot: nul(o.hotspot),
  crop: nul(o.crop),
});
const image = (s: Store, v: unknown) => proj(v, (o) => imageFragment(s, o));

const fileFragment = (s: Store, o: Doc) => ({
  asset: asset(s, o.asset, "_id", "url", "originalFilename", "extension", "size", "mimeType"),
});

const attachmentFragment = (s: Store, o: Doc) => ({
  _key: nul(o._key),
  _type: nul(o._type),
  title: nul(o.title),
  file: proj(o.file, (f) => fileFragment(s, f)),
});

/** Rich text with images and attachments expanded. */
const blockContent = (s: Store, v: unknown) =>
  each(v, (b) => ({
    ...b,
    ...(b._type === "imageWithAlt" ? imageFragment(s, b) : {}),
    ...(b._type === "attachment" ? attachmentFragment(s, b) : {}),
    markDefs: each(b.markDefs, (md) => ({ ...md, ...(md._type === "link" ? { href: nul(md.href) } : {}) })),
  }));

const churchRef = (d: Doc) => ({ _id: d._id, name: nul(d.name), shortName: nul(d.shortName), slug: slugOf(d) });

const personRef = (s: Store, d: Doc) => ({
  _id: d._id,
  name: nul(d.name),
  role: nul(d.role),
  roleTitle: nul(d.roleTitle),
  email: nul(d.email),
  phone: nul(d.phone),
  showContact: nul(d.showContact),
  slug: slugOf(d),
  photo: image(s, d.photo),
});

const link = (s: Store, o: Doc) => ({
  label: nul(o.label),
  kind: nul(o.kind),
  href: nul(o.href),
  internal: proj(deref(s, o.internal), (d) => ({ _type: d._type, slug: slugOf(d), title: nul(d.title), name: nul(d.name) })),
});

const pageHeader = (s: Store, o: Doc) => ({
  image: image(s, o.image),
  tagline: nul(o.tagline),
  quote: proj(o.quote, (q) => pick(q, "text", "source")),
});

const seo = (s: Store, d: Doc) => ({
  seo: {
    title: nul(d.seo?.title),
    description: nul(d.seo?.description),
    image: proj(d.seo?.image, (i) => ({ asset: asset(s, i.asset, "_id", "url"), hotspot: nul(i.hotspot), crop: nul(i.crop) })),
    noIndex: d.seo?.noIndex === true,
  },
});

const eventCard = (s: Store, d: Doc) => ({
  _id: d._id,
  title: nul(d.title),
  slug: slugOf(d),
  start: nul(d.start),
  end: nul(d.end),
  allDay: nul(d.allDay),
  category: nul(d.category),
  summary: nul(d.summary),
  featured: nul(d.featured),
  locationName: nul(d.locationName),
  church: proj(deref(s, d.church), churchRef),
  image: image(s, d.image),
});

const announcementCard = (s: Store, d: Doc) => {
  const n = count(d.attachments);
  return {
    _id: d._id,
    title: nul(d.title),
    slug: slugOf(d),
    importance: nul(d.importance),
    category: nul(d.category),
    image: image(s, d.image),
    hasAttachments: n == null ? null : n > 0,
    summary: nul(d.summary),
    publishFrom: nul(d.publishFrom),
    publishUntil: nul(d.publishUntil),
    showOnHomepage: nul(d.showOnHomepage),
    cta: proj(d.cta, (c) => link(s, c)),
    relatedEvent: proj(deref(s, d.relatedEvent), (e) => ({ _id: e._id, title: nul(e.title), slug: slugOf(e), start: nul(e.start) })),
  };
};

const articleCard = (s: Store, d: Doc) => ({
  _id: d._id,
  title: nul(d.title),
  slug: slugOf(d),
  excerpt: nul(d.excerpt),
  publishedAt: nul(d.publishedAt),
  image: image(s, d.image),
});

const galleryCard = (s: Store, d: Doc) => {
  const cover = d.cover ?? (Array.isArray(d.images) ? d.images[0] : undefined);
  return { _id: d._id, title: nul(d.title), slug: slugOf(d), date: nul(d.date), count: count(d.images), cover: image(s, cover) };
};

const imageItems = (s: Store, v: unknown) => each(v, (i) => ({ _key: nul(i._key), ...imageFragment(s, i) }));
const linkItems = (s: Store, v: unknown) => each(v, (l) => ({ _key: nul(l._key), ...link(s, l) }));
const refs = (s: Store, v: unknown) => (Array.isArray(v) ? v.map((r) => deref(s, r)) : null);

/** `downloads[]->{ … file { asset->{ … } } }`. */
const docRefs = (s: Store, v: unknown, keys: string[], fileKeys: string[]) =>
  refs(s, v)?.map((d) => (d ? { ...pick(d, ...keys), file: proj(d.file, (f) => ({ asset: asset(s, f.asset, ...fileKeys) })) } : null)) ?? null;

const first = <V>(list: V[]): V | null => list[0] ?? null;
const bySlug = (s: Store, type: string, slug: string) => ofType(s, type).find((d) => d.slug?.current === slug) ?? null;

// ───────────────────────── Settings & global ─────────────────────────

export function readSettings(s: Store): T.SETTINGS_QUERY_RESULT {
  const d = s.byId.get("settings")?.data;
  if (!d || d._type !== "settings") return null;
  const header = (v: unknown) => proj(v, (o) => pageHeader(s, o));
  return {
    name: nul(d.name),
    tagline: nul(d.tagline),
    diocese: nul(d.diocese),
    pastor: proj(deref(s, d.pastor), (p) => personRef(s, p)),
    address: nul(d.address),
    phone: nul(d.phone),
    mobile: nul(d.mobile),
    email: nul(d.email),
    officeHours: each(d.officeHours, (o) => pick(o, "_key", "weekday", "from", "to", "note")),
    officeHoursNote: nul(d.officeHoursNote),
    emergencyContact: proj(d.emergencyContact, (o) => pick(o, "label", "phone")),
    socialLinks: each(d.socialLinks, (o) => pick(o, "_key", "platform", "label", "url")),
    donations: proj(d.donations, (o) => pick(o, "intro", "recipient", "iban", "bic", "reference", "purpose")),
    siteUrl: nul(d.siteUrl),
    massesHeader: header(d.massesHeader),
    announcementsHeader: header(d.announcementsHeader),
    eventsHeader: header(d.eventsHeader),
    parishHeader: header(d.parishHeader),
    catechesisHeader: header(d.catechesisHeader),
    contactHeader: header(d.contactHeader),
    seo: proj(d.seo, (o) => ({
      title: nul(o.title),
      description: nul(o.description),
      image: proj(o.image, (i) => ({ asset: asset(s, i.asset, "_id", "url"), hotspot: nul(i.hotspot), crop: nul(i.crop) })),
    })),
    footerText: nul(d.footerText),
    privacyPage: proj(deref(s, d.privacyPage), (p) => ({ title: nul(p.title), slug: slugOf(p) })),
    legalPage: proj(deref(s, d.legalPage), (p) => ({ title: nul(p.title), slug: slugOf(p) })),
  } as J;
}

export function readContactRecipient(s: Store): T.CONTACT_RECIPIENT_QUERY_RESULT {
  const d = s.byId.get("settings")?.data;
  if (!d || d._type !== "settings") return null;
  return { recipient: d.contactFormRecipient ?? d.email ?? null, name: nul(d.name) };
}

const activePeriods = (s: Store, today: string) =>
  order(
    ofType(s, "specialPeriod").filter((d) => lte(d.activeFrom, today) && gte(d.activeUntil, today)),
    [(d) => d.activeFrom, "desc"],
  );

export function readActiveSpecialPeriod(s: Store, today: string): T.ACTIVE_SPECIAL_PERIOD_QUERY_RESULT {
  return proj(first(activePeriods(s, today)), (d) => ({
    _id: d._id,
    title: nul(d.title),
    slug: slugOf(d),
    season: nul(d.season),
    activeFrom: nul(d.activeFrom),
    activeUntil: nul(d.activeUntil),
    officeHoursNote: nul(d.officeHoursNote),
    excerpt: ptText(d.message),
  })) as J;
}

export function readUrgentAnnouncements(s: Store, now: string): T.URGENT_ANNOUNCEMENTS_QUERY_RESULT {
  const list = currentAnnouncements(s, now).filter((d) => d.importance === "urgent");
  return order(list, [(d) => d.publishFrom, "desc"])
    .slice(0, 2)
    .map((d) => ({ _id: d._id, title: nul(d.title), slug: slugOf(d), summary: nul(d.summary) })) as J;
}

// ───────────────────────── Churches (Mass pages) ─────────────────────────

const churchesInOrder = (s: Store) => order(ofType(s, "church"), [(d) => sortOf(s, d), "asc"], [(d) => d.name, "asc"]);

export function readChurchesBrief(s: Store): T.CHURCHES_BRIEF_QUERY_RESULT {
  return churchesInOrder(s).map((d) => ({ ...churchRef(d), kind: nul(d.kind), address: nul(d.address), image: image(s, d.image) })) as J;
}

export type ScheduleDoc = { _id: string; title: string | null; validFrom: string | null; validUntil: string | null; replacesRegular: boolean | null; note: J };

/** The massSchedule documents (only their title and note are used; the times are in mass_schedule_entries). */
export function readScheduleDocs(s: Store): ScheduleDoc[] {
  return ofType(s, "massSchedule").map((d) => ({
    _id: d._id,
    title: nul(d.title),
    validFrom: nul(d.validFrom),
    validUntil: nul(d.validUntil),
    replacesRegular: nul(d.replacesRegular),
    note: nul(d.note),
  }));
}

/** The church document's id for a churches-table slug (Mass schedule rows → church cards). */
export function churchIdBySlug(s: Store, slug: string): string {
  return bySlug(s, "church", slug)?._id ?? `church-${slug}`;
}

// ───────────────────────── Announcements ─────────────────────────

const IMPORTANCE_RANK: Record<string, number> = { urgent: 0, important: 1 };

const currentAnnouncements = (s: Store, now: string) =>
  ofType(s, "announcement").filter((d) => lte(d.publishFrom, now) && (!defined(d.publishUntil) || gte(d.publishUntil, now)));

const byImportance = (list: Doc[]) =>
  order(list, [(d) => IMPORTANCE_RANK[d.importance] ?? 2, "asc"], [(d) => d.publishFrom, "desc"]);

export function readHomeAnnouncements(s: Store, now: string): T.HOME_ANNOUNCEMENTS_QUERY_RESULT {
  return byImportance(currentAnnouncements(s, now).filter((d) => d.showOnHomepage === true))
    .slice(0, 4)
    .map((d) => announcementCard(s, d)) as J;
}

export function readCurrentAnnouncements(s: Store, now: string): T.CURRENT_ANNOUNCEMENTS_QUERY_RESULT {
  return byImportance(currentAnnouncements(s, now)).map((d) => announcementCard(s, d)) as J;
}

export function readArchivedAnnouncements(s: Store, now: string): T.ARCHIVED_ANNOUNCEMENTS_QUERY_RESULT {
  const list = ofType(s, "announcement").filter((d) => defined(d.publishUntil) && typeof d.publishUntil === "string" && d.publishUntil < now);
  return order(list, [(d) => d.publishFrom, "desc"])
    .slice(0, 60)
    .map((d) => announcementCard(s, d)) as J;
}

export function readAnnouncement(s: Store, slug: string): T.ANNOUNCEMENT_QUERY_RESULT {
  return proj(bySlug(s, "announcement", slug), (d) => ({
    ...announcementCard(s, d),
    body: blockContent(s, d.body),
    attachments: each(d.attachments, (a) => attachmentFragment(s, a)),
    relatedEvent: proj(deref(s, d.relatedEvent), (e) => eventCard(s, e)),
  })) as J;
}

// ───────────────────────── Weekly bulletins (their own table now; kept for the names) ─────────────────────────

const bulletinProjection = (s: Store, d: Doc) => ({
  _id: d._id,
  weekStart: nul(d.weekStart),
  weekEnd: d.weekEnd ?? d.weekStart ?? null,
  liturgicalNotes: nul(d.liturgicalNotes),
  items: each(d.items, (i) => pick(i, "_key", "title", "body")),
  specialInfo: blockContent(s, d.specialInfo),
  events: refs(s, d.events)?.map((e) => (e ? eventCard(s, e) : null)) ?? null,
  attachments: each(d.attachments, (a) => attachmentFragment(s, a)),
});

export function readCurrentBulletin(s: Store, today: string): T.CURRENT_BULLETIN_QUERY_RESULT {
  const list = order(ofType(s, "weeklyBulletin").filter((d) => lte(d.weekStart, today)), [(d) => d.weekStart, "desc"]);
  return proj(first(list), (d) => bulletinProjection(s, d)) as J;
}

export function readBulletinByWeek(s: Store, weekStart: string): T.BULLETIN_BY_WEEK_QUERY_RESULT {
  return proj(ofType(s, "weeklyBulletin").find((d) => d.weekStart === weekStart), (d) => bulletinProjection(s, d)) as J;
}

export function readBulletinList(s: Store): T.BULLETIN_LIST_QUERY_RESULT {
  return order(ofType(s, "weeklyBulletin"), [(d) => d.weekStart, "desc"])
    .slice(0, 52)
    .map((d) => ({ _id: d._id, weekStart: nul(d.weekStart), weekEnd: d.weekEnd ?? d.weekStart ?? null, itemCount: count(d.items) })) as J;
}

// ───────────────────────── Events (their own table now; kept for the names) ─────────────────────────

const endOrStart = (d: Doc) => d.end ?? d.start;

export function readUpcomingEvents(s: Store, now: string, limit: number): T.UPCOMING_EVENTS_QUERY_RESULT {
  return order(ofType(s, "event").filter((d) => gte(endOrStart(d), now)), [(d) => d.start, "asc"])
    .slice(0, limit)
    .map((d) => eventCard(s, d)) as J;
}

export function readPastEvents(s: Store, now: string): T.PAST_EVENTS_QUERY_RESULT {
  return order(ofType(s, "event").filter((d) => typeof endOrStart(d) === "string" && endOrStart(d) < now), [(d) => d.start, "desc"])
    .slice(0, 40)
    .map((d) => eventCard(s, d)) as J;
}

export function readEventsInRange(s: Store, from: string, to: string): T.EVENTS_IN_RANGE_QUERY_RESULT {
  return order(ofType(s, "event").filter((d) => gte(d.start, from) && lte(d.start, to)), [(d) => d.start, "asc"]).map((d) =>
    eventCard(s, d),
  ) as J;
}

export function readEvent(s: Store, slug: string): T.EVENT_QUERY_RESULT {
  return proj(bySlug(s, "event", slug), (d) => ({
    ...eventCard(s, d),
    description: blockContent(s, d.description),
    organizer: proj(deref(s, d.organizer), (o) => ({ _id: o._id, title: nul(o.title), slug: slugOf(o) })),
    organizerName: nul(d.organizerName),
    registration: proj(d.registration, (l) => link(s, l)),
    attachments: each(d.attachments, (a) => attachmentFragment(s, a)),
    church: proj(deref(s, d.church), (c) => ({ ...churchRef(c), address: nul(c.address), location: nul(c.location) })),
    galleries: galleriesReferencing(s, d._id).map((g) => galleryCard(s, g)),
    ...seo(s, d),
  })) as J;
}

/** `*[_type == "gallery" && references(id)] | order(date desc)`. */
function galleriesReferencing(s: Store, id: string): Doc[] {
  const mentions = (v: unknown): boolean =>
    Array.isArray(v) ? v.some(mentions) : isObj(v) ? v._ref === id || Object.values(v).some(mentions) : false;
  return order(ofType(s, "gallery").filter(mentions), [(d) => d.date, "desc"]);
}

// ───────────────────────── Articles & galleries ─────────────────────────

const publishedArticles = (s: Store, now: string) =>
  order(ofType(s, "article").filter((d) => lte(d.publishedAt, now)), [(d) => d.publishedAt, "desc"]);

export function readArticles(s: Store, now: string, limit = 40): T.ARTICLES_QUERY_RESULT {
  return publishedArticles(s, now)
    .slice(0, limit)
    .map((d) => articleCard(s, d)) as J;
}

export function readArticle(s: Store, slug: string, now: string): T.ARTICLE_QUERY_RESULT {
  return proj(bySlug(s, "article", slug), (d) => ({
    ...articleCard(s, d),
    body: blockContent(s, d.body),
    author: proj(deref(s, d.author), (p) => personRef(s, p)),
    gallery: proj(deref(s, d.gallery), (g) => ({ ...galleryCard(s, g), images: imageItems(s, g.images) })),
    relatedEvent: proj(deref(s, d.relatedEvent), (e) => eventCard(s, e)),
    attachments: each(d.attachments, (a) => attachmentFragment(s, a)),
    related: publishedArticles(s, now)
      .filter((a) => a._id !== d._id)
      .slice(0, 3)
      .map((a) => articleCard(s, a)),
    ...seo(s, d),
  })) as J;
}

export function readGalleries(s: Store, limit = 60): T.GALLERIES_QUERY_RESULT {
  return order(ofType(s, "gallery"), [(d) => d.date, "desc"])
    .slice(0, limit)
    .map((d) => galleryCard(s, d)) as J;
}

export function readGallery(s: Store, slug: string): T.GALLERY_QUERY_RESULT {
  return proj(bySlug(s, "gallery", slug), (d) => ({
    ...galleryCard(s, d),
    description: nul(d.description),
    photographer: nul(d.photographer),
    images: imageItems(s, d.images),
    relatedEvent: proj(deref(s, d.relatedEvent), (e) => ({ _id: e._id, title: nul(e.title), slug: slugOf(e), start: nul(e.start) })),
  })) as J;
}

// ───────────────────────── Churches ─────────────────────────

export function readChurches(s: Store): T.CHURCHES_QUERY_RESULT {
  return churchesInOrder(s).map((d) => ({
    ...churchRef(d),
    kind: nul(d.kind),
    dedication: nul(d.dedication),
    patronFeast: nul(d.patronFeast),
    summary: nul(d.summary),
    address: nul(d.address),
    image: image(s, d.image),
  })) as J;
}

export function readChurch(s: Store, slug: string): T.CHURCH_QUERY_RESULT {
  return proj(bySlug(s, "church", slug), (d) => ({
    ...churchRef(d),
    kind: nul(d.kind),
    dedication: nul(d.dedication),
    patronFeast: nul(d.patronFeast),
    summary: nul(d.summary),
    description: blockContent(s, d.description),
    history: blockContent(s, d.history),
    address: nul(d.address),
    location: nul(d.location),
    accessibility: nul(d.accessibility),
    parking: nul(d.parking),
    visitNotes: nul(d.visitNotes),
    image: image(s, d.image),
    gallery: imageItems(s, d.gallery),
    ...seo(s, d),
  })) as J;
}

// ───────────────────────── People & groups ─────────────────────────

export function readPeople(s: Store): T.PEOPLE_QUERY_RESULT {
  return order(ofType(s, "person"), [(d) => sortOf(s, d), "asc"], [(d) => d.name, "asc"]).map((d) => ({
    ...personRef(s, d),
    bio: nul(d.bio),
  })) as J;
}

export function readGroups(s: Store): T.GROUPS_QUERY_RESULT {
  return order(ofType(s, "parishGroup"), [(d) => sortOf(s, d), "asc"], [(d) => d.title, "asc"]).map((d) => ({
    _id: d._id,
    title: nul(d.title),
    slug: slugOf(d),
    summary: nul(d.summary),
    meetingSchedule: nul(d.meetingSchedule),
    location: nul(d.location),
    image: image(s, d.image),
  })) as J;
}

export function readGroup(s: Store, slug: string, now: string): T.GROUP_QUERY_RESULT {
  return proj(bySlug(s, "parishGroup", slug), (d) => ({
    _id: d._id,
    title: nul(d.title),
    slug: slugOf(d),
    summary: nul(d.summary),
    description: blockContent(s, d.description),
    meetingSchedule: nul(d.meetingSchedule),
    location: nul(d.location),
    contactPerson: proj(deref(s, d.contactPerson), (p) => personRef(s, p)),
    contactName: nul(d.contactName),
    email: nul(d.email),
    phone: nul(d.phone),
    links: linkItems(s, d.links),
    image: image(s, d.image),
    gallery: imageItems(s, d.gallery),
    events: order(
      ofType(s, "event").filter((e) => e.organizer?._ref === d._id && gte(endOrStart(e), now)),
      [(e) => e.start, "asc"],
    )
      .slice(0, 4)
      .map((e) => eventCard(s, e)),
    ...seo(s, d),
  })) as J;
}

// ───────────────────────── Sacraments ─────────────────────────

const sacramentsInOrder = (s: Store) => order(ofType(s, "sacrament"), [(d) => sortOf(s, d), "asc"], [(d) => d.title, "asc"]);

export function readSacraments(s: Store): T.SACRAMENTS_QUERY_RESULT {
  return sacramentsInOrder(s).map((d) => ({
    _id: d._id,
    title: nul(d.title),
    slug: slugOf(d),
    kind: nul(d.kind),
    summary: nul(d.summary),
    image: image(s, d.image),
  })) as J;
}

export function readSacrament(s: Store, slug: string): T.SACRAMENT_QUERY_RESULT {
  return proj(bySlug(s, "sacrament", slug), (d) => ({
    _id: d._id,
    title: nul(d.title),
    slug: slugOf(d),
    kind: nul(d.kind),
    summary: nul(d.summary),
    image: image(s, d.image),
    description: blockContent(s, d.description),
    contact: proj(deref(s, d.contact), (p) => personRef(s, p)),
    contactNote: nul(d.contactNote),
    requirements: nul(d.requirements),
    steps: each(d.steps, (x) => pick(x, "_key", "title", "text")),
    documentsNeeded: nul(d.documentsNeeded),
    downloads: docRefs(s, d.downloads, ["_id", "title", "description"], ["url", "extension", "size"]),
    faq: each(d.faq, (x) => pick(x, "_key", "question", "answer")),
    links: linkItems(s, d.links),
    ...seo(s, d),
  })) as J;
}

// ───────────────────────── Catechesis ─────────────────────────

/** The Verouk page. Its groups live in their own table now (src/lib/data/verouk.ts), so `groups` is always []. */
export function readCatechesis(s: Store): T.CATECHESIS_QUERY_RESULT {
  const d = s.byId.get("catechesisPage")?.data;
  const page =
    d && d._type === "catechesisPage"
      ? {
          title: nul(d.title),
          schoolYear: nul(d.schoolYear),
          intro: blockContent(s, d.intro),
          enrollment: blockContent(s, d.enrollment),
          contact: proj(deref(s, d.contact), (p) => personRef(s, p)),
          documents: docRefs(s, d.documents, ["_id", "title", "description"], ["url", "extension", "size"]),
          notice: nul(d.notice),
          image: image(s, d.image),
          ...seo(s, d),
        }
      : null;
  return { page, groups: [] } as J;
}

// ───────────────────────── Documents ─────────────────────────

export function readDocuments(s: Store): T.DOCUMENTS_QUERY_RESULT {
  return order(
    ofType(s, "parishDocument").filter((d) => d.public !== false),
    [(d) => d.date, "desc"],
    [(d) => d.title, "asc"],
  ).map((d) => ({
    ...pick(d, "_id", "title", "category", "date", "description"),
    file: proj(d.file, (f) => ({ asset: asset(s, f.asset, "url", "extension", "size", "originalFilename") })),
  })) as J;
}

// ───────────────────────── Special periods ─────────────────────────

export function readSpecialPeriod(s: Store, slug: string): T.SPECIAL_PERIOD_QUERY_RESULT {
  return proj(bySlug(s, "specialPeriod", slug), (d) => ({
    _id: d._id,
    title: nul(d.title),
    slug: slugOf(d),
    season: nul(d.season),
    activeFrom: nul(d.activeFrom),
    activeUntil: nul(d.activeUntil),
    officeHoursNote: nul(d.officeHoursNote),
    image: image(s, d.image),
    message: blockContent(s, d.message),
    schedule: proj(deref(s, d.schedule), (m) => ({
      ...pick(m, "_id", "title", "validFrom", "validUntil", "note"),
      entries: each(m.entries, (e) => ({
        ...pick(e, "_key", "weekdays", "time", "type", "note"),
        church: proj(deref(s, e.church), churchRef),
      })),
    })),
    events: refs(s, d.events)?.map((e) => (e ? eventCard(s, e) : null)) ?? null,
    announcements: refs(s, d.announcements)?.map((a) => (a ? announcementCard(s, a) : null)) ?? null,
    attachments: each(d.attachments, (a) => attachmentFragment(s, a)),
  })) as J;
}

export function readHomeSpecialPeriod(s: Store, today: string): T.HOME_SPECIAL_PERIOD_QUERY_RESULT {
  return proj(first(activePeriods(s, today)), (d) => ({
    _id: d._id,
    title: nul(d.title),
    slug: slugOf(d),
    season: nul(d.season),
    activeFrom: nul(d.activeFrom),
    activeUntil: nul(d.activeUntil),
    image: image(s, d.image),
    excerpt: ptText(d.message),
    hasSchedule: defined(d.schedule),
  })) as J;
}

// ───────────────────────── Pages ─────────────────────────

const churchTile = (s: Store, c: Doc) => ({
  ...churchRef(c),
  kind: nul(c.kind),
  dedication: nul(c.dedication),
  summary: nul(c.summary),
  image: image(s, c.image),
});

function section(s: Store, x: Doc): Doc {
  const base = { _key: nul(x._key), _type: nul(x._type) };
  switch (x._type) {
    case "sectionHero":
      return { ...base, title: nul(x.title), text: nul(x.text), image: image(s, x.image) };
    case "sectionRichText":
      return { ...base, title: nul(x.title), body: blockContent(s, x.body) };
    case "sectionTextImage":
      return { ...base, title: nul(x.title), body: nul(x.body), imageSide: nul(x.imageSide), image: image(s, x.image), link: proj(x.link, (l) => link(s, l)) };
    case "sectionQuote":
      return { ...base, quote: nul(x.quote), source: nul(x.source) };
    case "sectionGallery":
      return {
        ...base,
        title: nul(x.title),
        gallery: proj(deref(s, x.gallery), (g) => ({ ...galleryCard(s, g), images: imageItems(s, g.images) })),
        images: imageItems(s, x.images),
      };
    case "sectionPeople":
      return { ...base, title: nul(x.title), people: refs(s, x.people)?.map((p) => (p ? { ...personRef(s, p), bio: nul(p.bio) } : null)) ?? null };
    case "sectionChurches": {
      const n = count(x.churches);
      const churches =
        n != null && n > 0
          ? refs(s, x.churches)!.map((c) => (c ? churchTile(s, c) : null))
          : order(ofType(s, "church"), [(d) => sortOf(s, d), "asc"]).map((c) => churchTile(s, c));
      return { ...base, title: nul(x.title), churches };
    }
    case "sectionFaq":
      return { ...base, title: nul(x.title), items: each(x.items, (i) => pick(i, "_key", "question", "answer")) };
    case "sectionDocuments":
      return { ...base, title: nul(x.title), documents: docRefs(s, x.documents, ["_id", "title", "description", "category", "date"], ["url", "extension", "size"]) };
    case "sectionContact":
      return { ...base, title: nul(x.title), showForm: nul(x.showForm) };
    case "sectionEvents":
      return { ...base, title: nul(x.title), limit: nul(x.limit) };
    case "sectionMassSchedule":
      return { ...base, title: nul(x.title), church: proj(deref(s, x.church), (c) => ({ _id: c._id })) };
    case "sectionCta":
      return { ...base, title: nul(x.title), text: nul(x.text), link: proj(x.link, (l) => link(s, l)) };
    default:
      return base;
  }
}

export function readPage(s: Store, slug: string): T.PAGE_QUERY_RESULT {
  return proj(bySlug(s, "page", slug), (d) => ({
    _id: d._id,
    _type: d._type,
    title: nul(d.title),
    slug: slugOf(d),
    intro: nul(d.intro),
    sections: each(d.sections, (x) => section(s, x)),
    ...seo(s, d),
  })) as J;
}

export function readHomePage(s: Store): T.HOME_PAGE_QUERY_RESULT {
  const d = s.byId.get("homePage")?.data;
  if (!d || d._type !== "homePage") return null;
  return {
    heroImage: image(s, d.heroImage),
    heroEyebrow: nul(d.heroEyebrow),
    heroTitle: nul(d.heroTitle),
    heroText: nul(d.heroText),
    heroQuote: proj(d.heroQuote, (q) => pick(q, "text", "source")),
    tile: proj(d.tile, (t) => ({ image: image(s, t.image), text: nul(t.text), source: nul(t.source) })),
    welcome: proj(d.welcome, (w) => ({ title: nul(w.title), text: nul(w.text), image: image(s, w.image), link: proj(w.link, (l) => link(s, l)) })),
    featuredLinks: linkItems(s, d.featuredLinks),
    ...seo(s, d),
  } as J;
}

export type PrayerItem = { _key: string; title: string; when: string; place: string | null; note: string | null; onHome: boolean };
export type PrayerPageDoc = { title: string | null; intro: J; image: NonNullable<T.HOME_PAGE_QUERY_RESULT>["heroImage"]; items: PrayerItem[] };

/** The prayerPage singleton (/molitev, the homepage band); items without a title or time are left out. */
export function readPrayerPage(s: Store): PrayerPageDoc | null {
  const d = s.byId.get("prayerPage")?.data;
  if (!d || d._type !== "prayerPage") return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const items = (Array.isArray(d.items) ? d.items : [])
    .filter(isObj)
    .map((i, n) => ({ _key: str(i._key) ?? String(n), title: str(i.title) ?? "", when: str(i.when) ?? "", place: str(i.place), note: str(i.note), onHome: i.onHome === true }))
    .filter((i) => i.title && i.when);
  return { title: str(d.title), intro: blockContent(s, d.intro), image: image(s, d.image) as J, items };
}

// ───────────────────────── Search & sitemap ─────────────────────────

const SEARCH_TYPES = ["announcement", "event", "article", "page", "church", "sacrament", "parishGroup", "gallery", "parishDocument"];

/** The words GROQ's `match` sees in a text: lower-cased runs of letters and digits. */
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** GROQ `text match ["word*", …]`: every pattern matches a word of the text (a trailing * = prefix). */
function match(value: unknown, patterns: string[]): boolean {
  const text = typeof value === "string" ? value : Array.isArray(value) ? value.filter((v) => typeof v === "string").join(" ") : null;
  if (text == null) return false;
  const ws = words(text);
  return patterns.every((p) => {
    const parts = words(p.replace(/\*$/, ""));
    if (!parts.length) return true;
    const prefix = p.endsWith("*");
    // A pattern with several words (e.g. "sv.kriz*") needs each part.
    return parts.every((part, i) => ws.some((w) => (prefix && i === parts.length - 1 ? w.startsWith(part) : w === part)));
  });
}

export function readSearch(s: Store, patterns: string[]): T.SEARCH_QUERY_RESULT {
  const hits = s.rows
    .filter((r) => SEARCH_TYPES.includes(r.type))
    .filter(({ data: d }) =>
      [d.title, d.name, d.summary, d.excerpt, ptText(d.body), ptText(d.description)].some((v) => match(v, patterns)),
    );
  return [...hits]
    .sort((a, b) => cmp(b.updatedAt, a.updatedAt))
    .slice(0, 40)
    .map(({ data: d }) => ({
      _id: d._id,
      _type: d._type,
      title: d.title ?? d.name ?? null,
      slug: slugOf(d),
      summary: d.summary ?? d.excerpt ?? (d._type === "parishDocument" ? d.description : ptText(d.description)) ?? "",
      date: d.start ?? d.publishedAt ?? d.publishFrom ?? d.date ?? null,
      fileUrl: proj(assetDoc(s, d.file?.asset), (a) => a.url),
    })) as J;
}

const SITEMAP_TYPES = ["page", "event", "article", "church", "sacrament", "parishGroup", "gallery", "announcement", "specialPeriod"];

export function readSitemapEntries(s: Store): T.SITEMAP_QUERY_RESULT {
  return s.rows
    .filter((r) => SITEMAP_TYPES.includes(r.type) && defined(r.data.slug?.current) && r.data.seo?.noIndex !== true)
    .map((r) => ({ _type: r.type, slug: r.data.slug.current, _updatedAt: r.updatedAt })) as J;
}
