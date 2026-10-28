import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/admin/Icon";
import { PickButtons } from "@/components/admin/oznanila/PickButtons";
import { ReadingHints } from "@/components/admin/oznanila/ReadingHints";
import { fDayS, fT, NAM, OBV, periodName, pl, SRE, toCheck } from "@/components/admin/oznanila/format";
import { ButtonLink, PageHead, Pill } from "@/components/admin/ui";
import { requirePageArea } from "@/lib/admin/next";
import { today } from "@/lib/clock";
import { getReadingHints } from "@/lib/bulletin/hints";
import { listBulletins, type BulletinListEntry } from "@/lib/bulletin/service";

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" });
const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Ljubljana", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** "danes", "ned 25. okt" */
const day = (d: Date) => (ymd.format(d) === today() ? "danes" : fDayS(ymd.format(d)));
/** "danes ob 10.04" */
const dayAt = (d: Date) => `${day(d)} ob ${fT(hm.format(d))}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** " · iz datoteke: PDF", " · vpisano ročno", or nothing for bulletins from before the editor. */
const source = (s: { mime: string | null; hasDraft: boolean } | undefined) => {
  if (s?.mime) return ` · iz datoteke: ${s.mime.startsWith("image/") ? "fotografija" : s.mime === "application/pdf" ? "PDF" : "tabela"}`;
  return s?.hasDraft ? " · vpisano ročno" : "";
};

/** "35 namenov, 10 obvestil, 8 srečanj" (the parts that aren't zero, intentions always). */
const counts = (b: BulletinListEntry) =>
  [pl(b.itemCount, NAM), b.noticeCount ? pl(b.noticeCount, OBV) : null, b.eventCount ? pl(b.eventCount, SRE) : null].filter(Boolean).join(", ");

export default async function BulletinsPage() {
  const actor = await requirePageArea("oznanila");
  const [list, hints] = await Promise.all([listBulletins(), actor.isOwner ? getReadingHints() : null]);
  const ids = list.map((b) => b.id).filter((id): id is number => id != null);
  const t = today();

  const uploads = ids.length
    ? await db
        .select({ id: schema.bulletins.id, mime: schema.uploads.mime, draft: schema.bulletins.draft, error: schema.bulletins.error })
        .from(schema.bulletins)
        .leftJoin(schema.uploads, eq(schema.uploads.id, schema.bulletins.uploadId))
        .where(inArray(schema.bulletins.id, ids))
    : [];
  const srcOf = new Map(uploads.map((u) => [u.id, { mime: u.mime, hasDraft: u.draft != null }]));
  /** "other_period:Oktober 2026" → "oktober 2026": the file was the bulletin of a period that is already here. */
  const otherOf = new Map(uploads.flatMap((u) => (u.error?.startsWith("other_period:") ? [[u.id, u.error.slice(13).replace(/^./, (c) => c.toLowerCase())] as const] : [])));
  // Published bulletins without a stored draft (from before the editor): count their period's intentions.
  const m = schema.masses;
  const older = list.filter((b) => b.status === "published" && !srcOf.get(b.id!)?.hasDraft);
  const intentionsIn = new Map(
    await Promise.all(
      older.map(async (b) => {
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.intentions)
          .innerJoin(m, eq(m.id, schema.intentions.massId))
          .where(and(gte(m.date, b.periodStart), lte(m.date, b.periodEnd)));
        return [b.id, n] as const;
      }),
    ),
  );
  const cr = schema.changeRequests;
  const requests = await db
    .select({ payload: cr.payload, at: cr.createdAt, name: schema.user.name })
    .from(cr)
    .innerJoin(schema.user, eq(schema.user.id, cr.createdBy))
    .where(and(eq(cr.status, "pending"), eq(cr.action, "bulletin.publish")));
  const sentBy = new Map(requests.map((r) => [(r.payload as { bulletinId?: number }).bulletinId, r]));

  /** "ta mesec", "prihodnji mesec", or nothing: where the period sits relative to today. */
  const when = (b: BulletinListEntry) => (b.periodStart <= t && b.periodEnd >= t ? "trenutno" : b.periodStart > t ? "naslednja" : null);
  const resume = (b: BulletinListEntry) => `/oznanila/nalozi?id=${b.id}`;
  const name = (b: BulletinListEntry) => cap(periodName({ start: b.periodStart, end: b.periodEnd }));
  const span = (b: BulletinListEntry) => periodName({ start: b.periodStart, end: b.periodEnd });

  const card = (b: BulletinListEntry) => {
    const w = when(b);
    const eyebrow = w ? <span className="eyebrow">{w}</span> : null;
    switch (b.status) {
      case "missing":
        return (
          <div key={b.periodStart} className="bcard missing">
            <div className="meta">
              <Pill tone="gold">manjka</Pill>
              {eyebrow}
            </div>
            <h3>{name(b)}</h3>
            <p>Oznanila za {span(b)} še niso naložena. Izberite PDF ali jih fotografirajte. Claude jih prebere in pripravi osnutek. Nič ni objavljeno, dokler ne potrdite.</p>
            <div className="acts">
              <PickButtons />
            </div>
          </div>
        );
      case "draft":
        return (
          <div key={b.periodStart} className="bcard missing">
            <div className="meta">
              <Pill tone="gold">osnutek</Pill>
              {b.flagCount ? <span className="wsum">{toCheck(b.flagCount)}</span> : null}
              {eyebrow}
            </div>
            <h3>{name(b)}</h3>
            <p>
              Osnutek je shranjen: {counts(b)}. {b.flagCount ? "Preverite označena mesta in ga objavite." : "Preverite ga in objavite."}
            </p>
            <div className="acts">
              <ButtonLink href={resume(b)} variant="primary" size="lg" icon="pen">
                Nadaljuj pregled
              </ButtonLink>
            </div>
          </div>
        );
      case "reading":
      case "unreadable":
      case "ai_busy":
        return (
          <div key={b.periodStart} className="bcard missing">
            <div className="meta">
              <Pill tone={b.status === "reading" || otherOf.has(b.id!) ? "gold" : "alert"}>{b.status === "reading" ? "Claude bere" : otherOf.has(b.id!) ? "druga oznanila" : "ni prebrano"}</Pill>
              {eyebrow}
            </div>
            <h3>{name(b)}</h3>
            <p>
              {b.status === "reading"
                ? "Claude bere naložena oznanila. Osnutek bo pripravljen v minuti."
                : b.status === "ai_busy"
                  ? "Branje ni uspelo. Poskusite znova ali vpišite oznanila ročno."
                  : otherOf.has(b.id!)
                    ? `Naložena datoteka so bila oznanila za ${otherOf.get(b.id!)}, ki so že naložena. Za ${span(b)} izberite drugo datoteko.`
                    : "Datoteke ni bilo mogoče prebrati. Naložite jo znova ali vpišite oznanila ročno."}
            </p>
            <div className="acts">
              <ButtonLink href={resume(b)} variant="primary" size="lg" icon={b.status === "reading" ? "eye" : "r"}>
                {b.status === "reading" ? "Poglej" : "Nadaljuj"}
              </ButtonLink>
            </div>
          </div>
        );
      case "pending": {
        const s = sentBy.get(b.id ?? -1);
        return (
          <div key={b.periodStart} className="bcard">
            <div>
              <div className="meta">
                <Pill tone="gold">pri župniku</Pill>
                {eyebrow}
              </div>
              <h3>{name(b)}</h3>
              <p>
                {s ? `Poslala ${s.name}, ${dayAt(s.at)} · ` : ""}
                {counts(b)}
              </p>
            </div>
          </div>
        );
      }
      case "published":
        return (
          <div key={b.periodStart} className="bcard">
            <div>
              <div className="meta">
                <Pill icon="check">objavljeno</Pill>
                {b.publishedAt ? <span className="wsum">{day(b.publishedAt)}</span> : null}
                {eyebrow}
              </div>
              <h3>{name(b)}</h3>
              <p>
                {srcOf.get(b.id!)?.hasDraft ? counts(b) : counts({ ...b, itemCount: intentionsIn.get(b.id) ?? 0 })}
                {source(srcOf.get(b.id!))}
              </p>
            </div>
            <ButtonLink href={`/teden?w=${b.periodStart > t ? b.periodStart : b.periodEnd < t ? b.periodStart : t}`} variant="ghost" icon="eye">
              Poglej
            </ButtonLink>
          </div>
        );
    }
  };

  return (
    <div className="page enter">
      <PageHead title="Oznanila" sub="Claude prebere oznanila, vi preverite in objavite." action={hints != null ? <ReadingHints key={hints} initial={hints} /> : undefined} />
      <div className="blist">
        {/* Open work first, oldest first (a draft before the next missing month); then what is published, newest first. */}
        {[...list.filter((b) => b.status !== "published").reverse(), ...list.filter((b) => b.status === "published")].map(card)}
        {list.length === 0 ? (
          <p className="wsum">
            <Icon name="file" /> Še ni oznanil.
          </p>
        ) : null}
      </div>
    </div>
  );
}
