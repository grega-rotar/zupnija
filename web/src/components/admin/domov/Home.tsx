import Link from "next/link";
import { Icon, type IconName } from "@/components/admin/Icon";
import { ButtonLink, PageHead } from "@/components/admin/ui";
import { MAS, pl, SPREMEMBA_JE, URA_ODPADE } from "@/lib/domov/format";
import type { HomeView } from "@/lib/domov/loader";
import { PickButtons } from "@/components/admin/oznanila/PickButtons";
import { ApprovalsTask } from "./ApprovalsTask";
import { AskTile } from "./AskTile";

/** Domov, variant C of the prototype (vHome): greeting, hero, Na vrsti, Hitro, Urejeno. */
export function Home({ v, isOwner, inbox }: { v: HomeView; isOwner: boolean; inbox?: React.ReactNode }) {
  const tasks: React.ReactNode[] = [];

  // Requests from the site's forms (components/admin/requests).
  if (inbox) tasks.push(inbox);

  if (isOwner && v.approvals.length) tasks.push(<ApprovalsTask key="approve" rows={v.approvals} />);

  if (!isOwner && v.mine.length)
    tasks.push(
      <li key="mine" className="task wait">
        <span className="ic">
          <Icon name="clock" />
        </span>
        <h3>{pl(v.mine.length, SPREMEMBA_JE)} pri župniku</h3>
        <p>Na strani bodo, ko jih potrdi.</p>
        <ul className="appr-list">
          {v.mine.map((a) => (
            <li key={a.id} className="appr">
              <div>
                <b>{a.what}</b>
                <small>
                  {a.where ? `${a.where} · ` : ""}poslano {a.at}
                </small>
              </div>
            </li>
          ))}
        </ul>
      </li>,
    );

  if (v.bulletin) {
    const draft = v.bulletin.status === "draft";
    tasks.push(
      <li key="bulletin" className="task">
        <span className="ic">
          <Icon name="file" />
        </span>
        <h3>{draft ? `Osnutek oznanil za ${v.bulletin.span} čaka pregled` : `Oznanila za ${v.bulletin.span} še niso naložena`}</h3>
        <p>
          {draft
            ? "Shranili ste ga za pozneje. Preverite označena mesta in ga objavite."
            : "Izberite PDF oznanil ali jih fotografirajte. Claude jih prebere, vi preverite in objavite."}
        </p>
        <div className="acts">
          {draft ? (
            <ButtonLink href={v.bulletin.id ? `/oznanila/nalozi?id=${v.bulletin.id}` : "/oznanila"} variant="primary" size="lg" icon="pen">
              Nadaljuj pregled
            </ButtonLink>
          ) : (
            <>
              <PickButtons />
            </>
          )}
        </div>
      </li>,
    );
  }

  const empty = v.massesWithoutIntention;
  if (empty.length)
    tasks.push(
      <li key="empty" className="task">
        <span className="ic">
          <Icon name="cal" />
        </span>
        <h3>{empty.length === 1 ? "Ena maša ta teden je brez namena" : `Brez namena ta teden: ${pl(empty.length, MAS)}`}</h3>
        <p>{empty.map((m) => m.line).join(" · ")}</p>
        <div className="acts">
          <ButtonLink href="/teden?nov=1" size="lg" icon="plus">
            Dodaj namen
          </ButtonLink>
          <ButtonLink href="/teden" variant="ghost" size="lg">
            Odpri teden
          </ButtonLink>
        </div>
      </li>,
    );

  const off = v.cancelledLessons;
  if (off.length)
    tasks.push(
      <li key="off" className="task wait">
        <span className="ic">
          <Icon name="ban" />
        </span>
        <h3>{pl(off.length, URA_ODPADE)} ta teden</h3>
        <p>{off.map((g) => g.line).join(" · ")}. Starši vidijo obvestilo na strani.</p>
      </li>,
    );

  const quick: [string, IconName, string, string][] = [];
  if (v.can.oznanila) quick.push(["/oznanila/nalozi", "up", "Naloži oznanila", "Claude jih prebere"]);
  if (v.can.mase) quick.push(["/teden?nov=1", "plus", "Dodaj namen", "k izbrani maši"]);
  if (v.can.dogodki) quick.push(["/dogodki?dogodek=nov", "star", "Nov dogodek", "na strani in koledarju"]);
  if (v.can.verouk && !v.can.mase) quick.push(["/verouk", "book", "Odpovej uro verouka", "z obvestilom staršem"]);

  const h = v.hero;
  return (
    <div className="page enter">
      <PageHead eyebrow={v.greeting.eyebrow} title={`Dober dan, ${v.greeting.name}.`} sub={v.greeting.sub} />

      {h ? (
        <Link className="hero" href={h.kind === "mass" ? `/teden?masa=${h.massId}` : "/verouk"}>
          <span className="when tnum">{h.time}</span>
          <span className="lbl">{h.label}</span>
          <span className="what">
            {h.place} <span>· {h.detail}</span>
          </span>
          <span className="int">{h.note}</span>
          <span className="go">
            <Icon name="r" />
          </span>
        </Link>
      ) : null}

      {tasks.length ? (
        <section className="sect">
          <div className="sect-h">
            <h2>Na vrsti</h2>
          </div>
          <ul className="tasks">{tasks}</ul>
        </section>
      ) : (
        <div className="calm">
          <h3>Vse je urejeno.</h3>
          <p>Ko bo kaj novega, bo tukaj. Za spremembo lahko pišete pomočniku spodaj.</p>
        </div>
      )}

      <section className="sect">
        <div className="sect-h">
          <h2>Hitro</h2>
        </div>
        <div className="quick">
          {quick.map(([href, icon, title, sub]) => (
            <Link key={title} className="qt" href={href}>
              <Icon name={icon} />
              <span>
                {title}
                <small>{sub}</small>
              </span>
            </Link>
          ))}
          <AskTile />
        </div>
      </section>

      {v.done.length ? (
        <details className="done">
          <summary>
            <Icon name="r" />
            Urejeno ({v.done.length})
          </summary>
          <ul>
            {v.done.map((d) => (
              <li key={d}>
                <Icon name="check" />
                {d}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
