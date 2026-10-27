import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import { CancelPanel, RestoreButton } from "@/components/admin/verouk/LessonControls";
import { PageHead, Pill } from "@/components/admin/ui";
import s from "@/components/admin/verouk/verouk.module.css";
import { requirePageArea } from "@/lib/admin/next";
import { pl } from "@/lib/assistant/greeting";
import { weekStart } from "@/lib/clock";
import { addDays, formatDayHeading, formatTime, formatWeekSpan } from "@/lib/dates";
import { getLessons, type Lesson } from "@/lib/verouk/queries";

const KIDS: [string, string, string, string] = ["otrok", "otroka", "otroci", "otrok"];
/** "torek, 27. oktober" (the prototype's fDay). */
const fDay = (iso: string) => {
  const d = formatDayHeading(iso);
  return d.charAt(0).toLowerCase() + d.slice(1);
};
const firstOf = (name: string) => {
  const w = name.trim().split(/\s+/);
  return w.length > 1 ? w[w.length - 2] : w[0];
};

function LessonCard({ l, me }: { l: Lesson; me: string }) {
  const p = l.pending;
  return (
    <div className={`group${l.cancelled ? " off" : ""}`}>
      <div>
        <h3>{l.name}</h3>
        <p>
          {fDay(l.date)}, {formatTime(l.time)} · {l.place}
        </p>
        <p className="wsum">
          {pl(l.kids, KIDS)}
          {l.cancelled ? (
            <>
              {" · "}
              <Pill tone="alert">Odpade</Pill>
            </>
          ) : null}
          {p ? (
            <>
              {" · "}
              <Pill tone="gold">
                {p.action === "lesson.cancel" ? "odpoved" : "vrnitev"} {p.by === me ? "čaka župnika" : `čaka potrditev · ${firstOf(p.byName)}`}
              </Pill>
            </>
          ) : null}
        </p>
      </div>
      {p ? null : l.cancelled ? (
        <RestoreButton groupId={l.groupId} date={l.date} />
      ) : (
        <Link href={`/verouk?odpade=${l.groupId}`} className={`btn ${s.link}`} scroll={false} prefetch={false}>
          <Icon name="ban" />
          Ta teden odpade
        </Link>
      )}
      {l.message ? <p className="msg">»{l.message}«</p> : null}
    </div>
  );
}

export default async function VeroukPage({ searchParams }: { searchParams: Promise<{ odpade?: string | string[] }> }) {
  const actor = await requirePageArea("verouk");
  const { odpade } = await searchParams;
  const from = weekStart();
  const lessons = await getLessons(from);
  const gid = Number(Array.isArray(odpade) ? odpade[0] : odpade);
  const open = lessons.find((l) => l.groupId === gid && !l.cancelled && !l.pending);

  return (
    <div className="page enter">
      <PageHead title="Verouk" sub={`Teden ${formatWeekSpan(from, addDays(from, 6))}. Če ura odpade, starši to vidijo na strani.`} />
      {lessons.length ? (
        <div className="groups">
          {lessons.map((l) => (
            <LessonCard key={l.groupId} l={l} me={actor.id} />
          ))}
        </div>
      ) : (
        <div className="calm">
          <h3>Ni skupin verouka.</h3>
          <p>Ko bodo skupine vpisane, bodo tukaj ure za ta teden.</p>
        </div>
      )}
      {open ? <CancelPanel key={open.groupId} groupId={open.groupId} date={open.date} name={open.name} when={`${fDay(open.date)}, ${formatTime(open.time)}`} /> : null}
    </div>
  );
}
