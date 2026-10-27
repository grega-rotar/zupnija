import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/admin/Icon";
import { PickButtons } from "@/components/admin/oznanila/PickButtons";
import { fDayS, fSpan, fT, NAM, OBV, pl } from "@/components/admin/oznanila/format";
import { ButtonLink, PageHead, Pill } from "@/components/admin/ui";
import { requirePageArea } from "@/lib/admin/next";
import { today } from "@/lib/clock";
import { listBulletins, nextWeekStart, type BulletinListEntry } from "@/lib/bulletin/service";

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" });
const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Ljubljana", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** "danes", "ned 25. okt." */
const day = (d: Date) => (ymd.format(d) === today() ? "danes" : fDayS(ymd.format(d)));
/** "danes ob 10.04" */
const dayAt = (d: Date) => `${day(d)} ob ${fT(hm.format(d))}`;

/** " · iz datoteke: PDF", " · vpisano ročno", or nothing for weeks from before the editor. */
const source = (s: { mime: string | null; hasDraft: boolean } | undefined) => {
  if (s?.mime) return ` · iz datoteke: ${s.mime.startsWith("image/") ? "fotografija" : s.mime === "application/pdf" ? "PDF" : "tabela"}`;
  return s?.hasDraft ? " · vpisano ročno" : "";
};

export default async function BulletinsPage() {
  await requirePageArea("oznanila");
  const list = await listBulletins();
  const next = nextWeekStart();
  const ids = list.map((b) => b.id).filter((id): id is number => id != null);

  const uploads = ids.length
    ? await db
        .select({ id: schema.bulletins.id, mime: schema.uploads.mime, hasDraft: sql<boolean>`${schema.bulletins.draft} is not null` })
        .from(schema.bulletins)
        .leftJoin(schema.uploads, eq(schema.uploads.id, schema.bulletins.uploadId))
        .where(inArray(schema.bulletins.id, ids))
    : [];
  const srcOf = new Map(uploads.map((u) => [u.id, u]));
  // Published weeks without a stored draft (older ones): count the week's intentions.
  const m = schema.masses;
  const perWeek = await db
    .select({ week: sql<string>`date_trunc('week', ${m.date})::date::text`, n: sql<number>`count(*)::int` })
    .from(schema.intentions)
    .innerJoin(m, eq(m.id, schema.intentions.massId))
    .groupBy(sql`1`);
  const intentionsIn = new Map(perWeek.map((r) => [r.week, r.n]));
  const cr = schema.changeRequests;
  const requests = await db
    .select({ payload: cr.payload, at: cr.createdAt, name: schema.user.name })
    .from(cr)
    .innerJoin(schema.user, eq(schema.user.id, cr.createdBy))
    .where(and(eq(cr.status, "pending"), eq(cr.action, "bulletin.publish")));
  const sentBy = new Map(requests.map((r) => [(r.payload as { bulletinId?: number }).bulletinId, r]));

  const eyebrow = (b: BulletinListEntry) => (b.weekStart === next ? "prihodnja nedelja" : b.weekStart < next ? "ta teden" : "kasneje");
  const resume = (b: BulletinListEntry) => `/oznanila/nalozi?id=${b.id}`;

  const card = (b: BulletinListEntry) => {
    const span = fSpan(b.weekStart);
    switch (b.status) {
      case "missing":
      case "draft":
        return (
          <div key={b.weekStart} className="bcard missing">
            <div className="meta">
              <Pill tone="gold">{b.status === "draft" ? "osnutek" : "manjka"}</Pill>
              <span className="eyebrow">{eyebrow(b)}</span>
            </div>
            <h3>{span}</h3>
            <p>
              {b.status === "draft"
                ? "Osnutek je shranjen. Preverite označena polja in ga objavite."
                : "Fotografirajte list z oznanili ali izberite PDF ali tabelo. Claude jih prebere in pripravi osnutek. Nič ni objavljeno, dokler ne potrdite."}
            </p>
            <div className="acts">
              {b.status === "draft" ? (
                <ButtonLink href={resume(b)} variant="primary" size="lg" icon="pen">
                  Nadaljuj pregled
                </ButtonLink>
              ) : (
                <PickButtons />
              )}
            </div>
          </div>
        );
      case "reading":
      case "unreadable":
      case "ai_busy":
        return (
          <div key={b.weekStart} className="bcard missing">
            <div className="meta">
              <Pill tone={b.status === "reading" ? "gold" : "alert"}>{b.status === "reading" ? "Claude bere" : "ni prebrano"}</Pill>
              <span className="eyebrow">{eyebrow(b)}</span>
            </div>
            <h3>{span}</h3>
            <p>
              {b.status === "reading"
                ? "Claude bere naloženi list. Osnutek bo pripravljen v pol minute."
                : "Lista ni bilo mogoče prebrati. Naložite ga znova ali vpišite oznanila ročno."}
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
          <div key={b.weekStart} className="bcard">
            <div>
              <div className="meta">
                <Pill tone="gold">pri župniku</Pill>
              </div>
              <h3>{span}</h3>
              <p>
                {s ? `Poslala ${s.name}, ${dayAt(s.at)} · ` : ""}
                {pl(b.itemCount, NAM)}, {pl(b.noticeCount, OBV)}
              </p>
            </div>
          </div>
        );
      }
      case "published":
        return (
          <div key={b.weekStart} className="bcard">
            <div>
              <div className="meta">
                <Pill icon="check">objavljeno</Pill>
                {b.publishedAt ? <span className="wsum">{day(b.publishedAt)}</span> : null}
              </div>
              <h3>{span}</h3>
              <p>
                {pl(srcOf.get(b.id!)?.hasDraft ? b.itemCount : (intentionsIn.get(b.weekStart) ?? 0), NAM)}, {pl(b.noticeCount, OBV)}
                {source(srcOf.get(b.id!))}
              </p>
            </div>
            <ButtonLink href={`/teden?w=${b.weekStart}`} variant="ghost" icon="eye">
              Poglej
            </ButtonLink>
          </div>
        );
    }
  };

  return (
    <div className="page enter">
      <PageHead title="Oznanila" sub="Vsak teden en list. Claude ga prebere, vi preverite in objavite." />
      <div className="blist">
        {list.map(card)}
        {list.length === 0 ? (
          <p className="wsum">
            <Icon name="file" /> Še ni oznanil.
          </p>
        ) : null}
      </div>
    </div>
  );
}
