// The Sanity → Postgres import (web/scripts/import-sanity.mjs), as plain functions so vitest can
// test them (src/lib/import/sanity.test.ts). Plain Node ESM: the Docker image runs it with node,
// without tsx, and only `postgres` is available at runtime. Nothing here talks to Sanity: the CLI
// fetches the documents and passes them in.

/** GROQ for everything the import reads, published documents only. */
export const QUERY = `{
  "churches": *[_type == "church" && !(_id in path("drafts.**"))] | order(order asc, name asc){ _id, name, shortName, "slug": slug.current, order },
  "schedules": *[_type == "massSchedule" && !(_id in path("drafts.**"))]{ _id, title, validFrom, validUntil, replacesRegular, entries, note },
  "massDays": *[_type == "massDay" && !(_id in path("drafts.**"))] | order(date asc),
  "events": *[_type == "event" && !(_id in path("drafts.**"))] | order(start asc),
  "groups": *[_type == "catechesisGroup" && !(_id in path("drafts.**"))] | order(grade asc, title asc),
  "bulletins": *[_type == "weeklyBulletin" && !(_id in path("drafts.**"))] | order(weekStart asc)
}`;

export const WEEKDAY_NUM = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const MASS_TYPES = new Set(["regular", "sunday", "family", "children", "youth", "evening"]);
const INTENTION_KINDS = new Set(["deceased", "thanksgiving", "other"]);

/** Fallback for a Verouk group without a session in Sanity: Monday 00:00, and this as the place. */
export const GROUP_FALLBACK = { weekday: 1, time: "00:00", place: "Termin še ni določen" };

// ── Portable Text ────────────────────────────────────────────────────────────

/**
 * Portable Text → plain text the site's `textBlocks` turns back into paragraphs: one paragraph per
 * block, separated by a blank line. List items keep a "– " or "1. " marker. Marks and links are
 * dropped (the link text stays); non-text blocks (images, embeds) are skipped and counted.
 */
export function ptToText(blocks) {
  if (typeof blocks === "string") return { text: blocks.trim(), skipped: 0 };
  if (!Array.isArray(blocks)) return { text: "", skipped: 0 };
  const out = [];
  let skipped = 0;
  let n = 0;
  for (const b of blocks) {
    if (!b || b._type !== "block") {
      skipped++;
      continue;
    }
    const text = (b.children ?? [])
      .map((c) => (typeof c?.text === "string" ? c.text : ""))
      .join("")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (b.listItem === "number") n++;
    else n = 0;
    if (!text) continue;
    out.push(b.listItem === "number" ? `${n}. ${text}` : b.listItem ? `– ${text}` : text);
  }
  return { text: out.join("\n\n"), skipped };
}

/** Plain text, without the skipped count. */
export const pt = (blocks) => ptToText(blocks).text;

// ── Dates ────────────────────────────────────────────────────────────────────

const ljFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Ljubljana",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Sanity datetime (UTC ISO) → Ljubljana wall clock { date: "2026-11-03", time: "19:15" }. */
export function ljubljana(iso) {
  const parts = Object.fromEntries(ljFmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD date. */
export const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** The Sunday on or before `date`. */
export function sundayOf(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

const hhmm = (t) => (typeof t === "string" ? t.slice(0, 5).padStart(5, "0") : t);

// ── "Lost on switch" bookkeeping ─────────────────────────────────────────────

/** Collects what the Postgres schema can't hold: label → set of Sanity document ids. */
export function lossTracker() {
  const map = new Map();
  return {
    add(label, id) {
      if (!map.has(label)) map.set(label, new Set());
      map.get(label).add(id);
    },
    /** [{ label, count, ids }] in insertion order. */
    list: () => [...map].map(([label, ids]) => ({ label, count: ids.size, ids: [...ids] })),
  };
}

const has = (v) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0);

// ── Mapping (Sanity document → rows) ─────────────────────────────────────────

export function mapChurch(doc) {
  return { slug: doc.slug || doc._id.replace(/^church-/, ""), name: doc.name, short_name: doc.shortName || doc.name, position: doc.order ?? 0 };
}

/** A massSchedule's entries → mass_schedule_entries rows (church as a Sanity id, resolved later). */
export function mapScheduleEntries(schedule, lost) {
  const rows = [];
  for (const e of schedule.entries ?? []) {
    const type = MASS_TYPES.has(e.type) ? e.type : "regular";
    if (e.type && type !== e.type) lost.add(`mass type "${e.type}" (schedule entry → regular)`, schedule._id);
    rows.push({
      weekdays: (e.weekdays ?? []).map((d) => WEEKDAY_NUM[d]).filter((d) => d != null).sort(),
      time: hhmm(e.time),
      churchRef: e.church?._ref,
      type,
      note: e.note || null,
      validFrom: schedule.validFrom || null,
      validUntil: schedule.validUntil || null,
    });
  }
  return rows;
}

/**
 * A massDay → its override row (only when it has a title or replaces the schedule) and its Masses,
 * each with intentions. `entries` (mapped schedule rows) decide a Mass's `source` and default note
 * the same way ensureMasses would: a Mass that the schedule generates anyway is "schedule".
 */
export function mapMassDay(doc, entries, lost) {
  const date = doc.date;
  const override = doc.liturgicalTitle || doc.replacesSchedule ? { date, replacesSchedule: !!doc.replacesSchedule, label: doc.liturgicalTitle || null } : null;
  if (has(doc.note)) lost.add("massDay note (shown under the day)", doc._id);
  const wd = weekdayOf(date);
  const masses = [];
  for (const o of doc.masses ?? []) {
    if (!o.church?._ref || !o.time) {
      lost.add("Mass without church or time (skipped)", doc._id);
      continue;
    }
    const time = hhmm(o.time);
    const entry = doc.replacesSchedule
      ? null
      : entries.find(
          (e) =>
            e.churchRef === o.church._ref &&
            e.time === time &&
            e.weekdays.includes(wd) &&
            (!e.validFrom || e.validFrom <= date) &&
            (!e.validUntil || e.validUntil >= date),
        );
    const type = MASS_TYPES.has(o.type) ? o.type : entry?.type ?? "regular";
    if (o.type && !MASS_TYPES.has(o.type)) lost.add(`mass type "${o.type}" (→ ${type})`, doc._id);
    if (o.celebrant?._ref) lost.add("Mass celebrant", doc._id);
    let note = o.note || entry?.note || null;
    let status = "scheduled";
    let cancelReason = null;
    if (o.status === "cancelled") {
      status = "cancelled";
      cancelReason = o.statusNote || null;
    } else if (o.status === "changed") {
      // No "changed" status in Postgres: the Mass stays scheduled and the explanation goes into the note.
      note = [note, o.statusNote].filter(Boolean).join(" · ") || null;
      lost.add('Mass status "changed" (→ scheduled, statusNote into note)', doc._id);
    }
    const intentions = [];
    for (const it of o.intentions ?? []) {
      const text = (it.text ?? "").trim();
      if (!text) continue;
      // living/health/intention/parish have no prefix on the site, so "other" shows them the same.
      intentions.push({ kind: INTENTION_KINDS.has(it.kind) ? it.kind : it.kind ? "other" : "deceased", text });
    }
    masses.push({ date, time, churchRef: o.church._ref, type, status, cancelReason, note, source: entry ? "schedule" : "manual", intentions });
  }
  return { override, masses };
}

/**
 * An event → an events row. Place is what the event card showed (church short name, else the
 * location name). The card's summary and the description are kept together as the description.
 * `onFrontPage`: the old homepage listed the next 4 upcoming events whether featured or not, so
 * every event from `today` on is marked for the front page (plus anything marked featured).
 */
export function mapEvent(doc, churchShort, today, lost) {
  const { date, time } = ljubljana(doc.start);
  const church = doc.church?._ref ? churchShort.get(doc.church._ref) : null;
  const place = church ?? doc.locationName ?? "";
  if (church && doc.locationName && doc.locationName !== church) lost.add("event locationName next to a church (church kept)", doc._id);
  const { text: body, skipped } = ptToText(doc.description);
  const summary = (doc.summary ?? "").trim();
  const description = [summary, body].filter(Boolean).join("\n\n");
  if (skipped) lost.add("event description images/embeds", doc._id);
  if (has(doc.image?.asset)) lost.add("event image", doc._id);
  if (doc.category) lost.add("event category (label on the card)", doc._id);
  if (doc.end) lost.add("event end time / multi-day span", doc._id);
  if (doc.allDay) lost.add('event "all day" flag (start time kept)', doc._id);
  if (doc.organizer?._ref || doc.organizerName) lost.add("event organizer", doc._id);
  if (has(doc.registration)) lost.add("event registration link", doc._id);
  if (has(doc.attachments)) lost.add("event attachments", doc._id);
  if (!place) lost.add("event without church or location (place left empty)", doc._id);
  return { title: doc.title, date, time, place, description, onFrontPage: !!doc.featured || date >= today, legacySlug: doc.slug?.current ?? null };
}

/** A catechesisGroup → a catechesis_groups row; the first session is the weekly lesson. */
export function mapGroup(doc, index, lost, warnings) {
  const [s, ...more] = (doc.sessions ?? []).filter((x) => x && (x.weekday || x.time));
  const weekday = s?.weekday != null ? WEEKDAY_NUM[s.weekday] : undefined;
  const ok = weekday != null && /^\d{1,2}:\d{2}$/.test(s?.time ?? "");
  if (!ok) warnings.push(`Verouk "${doc.title}": no weekday/time in Sanity → ${JSON.stringify(GROUP_FALLBACK)}; set it in the editor`);
  if (more.length) lost.add("Verouk extra sessions (only the first is kept)", doc._id);
  if (doc.catechist?._ref || doc.catechistName) lost.add("Verouk catechist name", doc._id);
  if (has(doc.notes)) lost.add("Verouk group notes", doc._id);
  if (has(doc.documents)) lost.add("Verouk group documents", doc._id);
  if (doc.schoolYear) lost.add("Verouk school year", doc._id);
  return {
    name: doc.title,
    weekday: ok ? weekday : GROUP_FALLBACK.weekday,
    time: ok ? hhmm(s.time) : GROUP_FALLBACK.time,
    place: (ok && s.location) || (ok ? "" : GROUP_FALLBACK.place),
    kids: 0,
    position: doc.grade ?? index + 1,
  };
}

/** A weeklyBulletin → a published bulletins row and its notices ("title" and body as two paragraphs). */
export function mapBulletin(doc, lost, warnings) {
  let weekStart = doc.weekStart;
  if (weekStart && weekdayOf(weekStart) !== 0) {
    weekStart = sundayOf(weekStart);
    warnings.push(`Bulletin ${doc._id}: weekStart ${doc.weekStart} is not a Sunday → ${weekStart}`);
  }
  const notices = (doc.items ?? [])
    .map((it) => [(it.title ?? "").trim(), pt(it.body)].filter(Boolean).join("\n\n"))
    .filter(Boolean);
  if (has(doc.liturgicalNotes)) lost.add("bulletin liturgical note (intro line)", doc._id);
  if (has(doc.specialInfo)) lost.add("bulletin special info", doc._id);
  if (has(doc.attachments)) lost.add("bulletin PDF/attachments", doc._id);
  if (has(doc.events)) lost.add("bulletin linked events (the week's events still show, by date)", doc._id);
  if (doc.weekEnd && weekStart && doc.weekEnd !== new Date(Date.parse(`${weekStart}T12:00:00Z`) + 6 * 864e5).toISOString().slice(0, 10))
    warnings.push(`Bulletin ${doc._id}: weekEnd ${doc.weekEnd} ignored (weeks are Sunday–Saturday)`);
  return { weekStart, publishedAt: doc._updatedAt ?? doc._createdAt ?? null, notices };
}

// ── Database ─────────────────────────────────────────────────────────────────

/** Rows per imported table, to show before/after. */
export const TABLES = ["churches", "mass_schedule_entries", "mass_day_overrides", "masses", "intentions", "events", "catechesis_groups", "bulletins", "bulletin_notices"];

/** @returns {Promise<Record<string, number>>} */
export async function tableCounts(sql) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const t of TABLES) out[t] = Number((await sql`select count(*)::int as n from ${sql(t)}`)[0].n);
  return out;
}

/**
 * Import `docs` (the QUERY result) into Postgres, in one transaction. Insert-only and keyed on
 * natural keys, so a second run adds nothing and nothing already there (from the editor or an
 * earlier run) is ever changed:
 *   churches: slug · schedule entries: weekdays+time+church+type+note+validity · overrides: date ·
 *   masses: date+time+church · intentions: mass+text · events: title+date+time ·
 *   Verouk groups: name · bulletins: week (notices only with a new bulletin).
 * Refuses when the editor has been used (history rows) unless `force`.
 * `dryRun` rolls the transaction back at the end. Returns { created, lost, warnings }.
 */
export async function importSanity(sql, docs, { force = false, dryRun = false, today }) {
  const lost = lossTracker();
  const warnings = [];
  const created = Object.fromEntries(TABLES.map((t) => [t, 0]));

  const ROLLBACK = new Error("dry run");
  await sql.begin(async (tx) => {
    const [{ n: historyRows }] = await tx`select count(*)::int as n from history`;
    if (historyRows > 0 && !force) {
      throw Object.assign(new Error(`The editor has been used already (${historyRows} history rows). Re-run with --force to add only what's missing.`), {
        code: "HAS_HISTORY",
      });
    }

    // Churches
    const churchId = new Map(); // Sanity id → Postgres id
    const churchShort = new Map(); // Sanity id → short name
    for (const doc of docs.churches ?? []) {
      const row = mapChurch(doc);
      const ins = await tx`insert into churches ${tx(row)} on conflict (slug) do nothing returning id`;
      if (ins.length) created.churches++;
      const [{ id, short_name }] = await tx`select id, short_name from churches where slug = ${row.slug}`;
      churchId.set(doc._id, id);
      churchShort.set(doc._id, short_name);
    }
    const church = (ref, what, docId) => {
      const id = churchId.get(ref);
      if (id == null) warnings.push(`${what} in ${docId}: unknown church ${ref}, skipped`);
      return id;
    };

    // Regular schedule (every massSchedule; seasonal ones keep their validity dates)
    const entries = [];
    for (const s of docs.schedules ?? []) {
      if (has(s.note)) lost.add("schedule note (still shown from Sanity on /svete-mase)", s._id);
      if (s.replacesRegular) lost.add("seasonal schedule replacing the regular one (imported as extra entries)", s._id);
      entries.push(...mapScheduleEntries(s, lost).map((e) => ({ ...e, docId: s._id })));
    }
    for (const e of entries) {
      const churchIdPg = church(e.churchRef, "Schedule entry", e.docId);
      if (churchIdPg == null || !e.weekdays.length) continue;
      const [found] = await tx`
        select id from mass_schedule_entries
        where weekdays = ${e.weekdays}::int[] and time = ${e.time} and church_id = ${churchIdPg} and type = ${e.type}
          and note is not distinct from ${e.note}
          and valid_from is not distinct from ${e.validFrom}::date and valid_until is not distinct from ${e.validUntil}::date`;
      if (found) continue;
      await tx`insert into mass_schedule_entries ${tx({ weekdays: e.weekdays, time: e.time, church_id: churchIdPg, type: e.type, note: e.note, valid_from: e.validFrom, valid_until: e.validUntil })}`;
      created.mass_schedule_entries++;
    }

    // Mass days: overrides, Masses, intentions
    for (const doc of docs.massDays ?? []) {
      const { override, masses } = mapMassDay(doc, entries, lost);
      if (override) {
        const ins = await tx`insert into mass_day_overrides ${tx({ date: override.date, replaces_schedule: override.replacesSchedule, label: override.label })} on conflict (date) do nothing returning date`;
        created.mass_day_overrides += ins.length;
      }
      for (const m of masses) {
        const cid = church(m.churchRef, "Mass", doc._id);
        if (cid == null) continue;
        const row = { date: m.date, time: m.time, church_id: cid, type: m.type, status: m.status, cancel_reason: m.cancelReason, note: m.note, source: m.source };
        const ins = await tx`insert into masses ${tx(row)} on conflict (date, time, church_id) do nothing returning id`;
        created.masses += ins.length;
        const [{ id: massId }] = await tx`select id from masses where date = ${m.date} and time = ${m.time} and church_id = ${cid}`;
        const existing = new Set((await tx`select text from intentions where mass_id = ${massId}`).map((r) => r.text));
        let position = existing.size;
        for (const it of m.intentions) {
          if (existing.has(it.text)) continue;
          await tx`insert into intentions ${tx({ mass_id: massId, kind: it.kind, text: it.text, position: position++ })}`;
          existing.add(it.text);
          created.intentions++;
        }
      }
    }

    // Events
    for (const doc of docs.events ?? []) {
      if (!doc.start || !doc.title) {
        warnings.push(`Event ${doc._id}: no title or start, skipped`);
        continue;
      }
      const e = mapEvent(doc, churchShort, today, lost);
      const [found] = await tx`select id from events where title = ${e.title} and date = ${e.date} and time = ${e.time}`;
      if (found) continue;
      await tx`insert into events ${tx({ title: e.title, date: e.date, time: e.time, place: e.place, description: e.description, on_front_page: e.onFrontPage, legacy_slug: e.legacySlug })}`;
      created.events++;
    }

    // Verouk groups
    for (const [i, doc] of (docs.groups ?? []).entries()) {
      const g = mapGroup(doc, i, lost, warnings);
      const [found] = await tx`select id from catechesis_groups where name = ${g.name}`;
      if (found) continue;
      await tx`insert into catechesis_groups ${tx(g)}`;
      created.catechesis_groups++;
    }

    // Weekly bulletins
    for (const doc of docs.bulletins ?? []) {
      const b = mapBulletin(doc, lost, warnings);
      if (!b.weekStart) {
        warnings.push(`Bulletin ${doc._id}: no weekStart, skipped`);
        continue;
      }
      const ins = await tx`
        insert into bulletins ${tx({ week_start: b.weekStart, status: "published", published_at: b.publishedAt })}
        on conflict (week_start) do nothing returning id`;
      if (!ins.length) continue;
      created.bulletins++;
      for (const [position, text] of b.notices.entries()) {
        await tx`insert into bulletin_notices ${tx({ bulletin_id: ins[0].id, position, text })}`;
        created.bulletin_notices++;
      }
    }
    if (dryRun) throw ROLLBACK;
  }).catch((e) => {
    if (e !== ROLLBACK) throw e;
  });

  return { created, lost: lost.list(), warnings };
}
