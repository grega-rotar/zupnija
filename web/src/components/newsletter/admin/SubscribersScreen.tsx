import { PageHead, Pill } from "@/components/admin/ui";
import { formatDate } from "@/lib/dates";
import type { NewsletterStats } from "@/lib/newsletter/service";
import { PeopleTabs } from "./PeopleTabs";

const STATUS = {
  active: { label: "potrjen", tone: "moss" },
  pending: { label: "čaka potrditev", tone: "gold" },
  unsubscribed: { label: "odjavljen", tone: "line" },
} as const;

/** "3 potrjeni · 1 čaka potrditev" (Slovenian dual and plural). */
function confirmed(n: number) {
  const m = n % 100;
  return `${n} ${m === 1 ? "potrjen" : m === 2 ? "potrjena" : "potrjeni"}`;
}

/** Ljudje → Naročniki (PRD US-005): how many get the bulletin by e-mail, and how the last sending went. */
export function SubscribersScreen({ stats }: { stats: NewsletterStats }) {
  const { last } = stats;
  return (
    <div className="page enter">
      <PageHead title="Ljudje in dostop" sub="Kdo sme kaj urejati. Vsak vidi samo svoje razdelke." />
      <PeopleTabs current="/ljudje/narocniki" />

      <div className="card mb-5">
        <div className="card-h">
          <b>Oznanila po e-pošti</b>
        </div>
        <div className="card-b">
          <p className="text-[1.375rem] font-bold tracking-[-0.03em] text-ink" data-testid="subscriber-count">
            {confirmed(stats.active)} · {stats.pending} čaka potrditev
          </p>
          {last ? (
            <p data-testid="last-send">
              Zadnja oznanila ({last.title}, {formatDate(last.mailedAt.toISOString())}):{" "}
              <b>
                Poslano {last.sent} od {last.total}
              </b>
              {last.queued ? ` · ${last.queued} v vrsti` : ""}
              {last.failed ? ` · ${last.failed} ni uspelo` : ""}
            </p>
          ) : (
            <p className="text-ink-3">Oznanila še niso bila poslana. Pošljejo se sama, ko objavite nova.</p>
          )}
          <p className="text-[0.8125rem] text-ink-3">
            Naročniki se prijavijo na spletni strani in prijavo potrdijo po e-pošti. Na dan gre ven največ toliko sporočil, kot jih dovoli ponudnik; ostala gredo naslednje jutro.
          </p>
        </div>
      </div>

      {stats.subscribers.length ? (
        <div className="people">
          {stats.subscribers.map((sub) => (
            <div key={sub.email} className="person" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <span className="min-w-0">
                <b className="block truncate">{sub.email}</b>
                <p>od {formatDate(sub.since.toISOString())}</p>
              </span>
              <Pill tone={STATUS[sub.status].tone}>{STATUS[sub.status].label}</Pill>
            </div>
          ))}
        </div>
      ) : (
        <div className="calm">
          <h3>Še ni naročnikov.</h3>
          <p>Obrazec za prijavo je na domači strani in v nogi spletne strani.</p>
        </div>
      )}
    </div>
  );
}
