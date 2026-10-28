"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Icon } from "@/components/admin/Icon";
import { Button, PageHead, Pill } from "@/components/admin/ui";
import { SECTION_LABEL, type Section } from "@/lib/admin/sections";
import { PeopleTabs } from "@/components/newsletter/admin/PeopleTabs";
import { InvitePanel, PersonPanel } from "./panels";

export type PersonView = {
  id: string;
  name: string;
  short: string;
  title: string;
  email: string;
  isOwner: boolean;
  sections: Section[];
  requiresApproval: boolean;
  invited: boolean;
  /** "Tajnica · <status>": "nazadnje danes ob 8.15", "ureja vse", … */
  status: string;
};

/** The URL holds which panel is open; native pushState keeps it instant and in sync. */
function go(query: string) {
  window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
}

export function PeopleScreen({ people }: { people: PersonView[] }) {
  const params = useSearchParams();
  const openId = params.get("oseba");
  const inviting = params.get("povabi") === "1";
  const person = openId ? people.find((p) => p.id === openId && !p.isOwner) : undefined;
  const close = useCallback(() => go(""), []);

  return (
    <div className="page enter">
      <PageHead
        title="Ljudje in dostop"
        sub="Kdo sme kaj urejati. Vsak vidi samo svoje razdelke."
        action={
          <Button variant="primary" icon="plus" onClick={() => go("povabi=1")}>
            Povabi osebo
          </Button>
        }
      />
      <PeopleTabs current="/ljudje" />
      <div className="people">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            className="person"
            disabled={p.isOwner}
            onClick={p.isOwner ? undefined : () => go(`oseba=${encodeURIComponent(p.id)}`)}
            aria-haspopup={p.isOwner ? undefined : "dialog"}
          >
            <span className={`avatar lg${p.isOwner ? " moss" : ""}`} aria-hidden="true">
              {p.short}
            </span>
            <span>
              <b>{p.name}</b>
              <p>
                {p.title} · {p.status}
              </p>
              <span className="secs">
                {p.isOwner ? <Pill>vse</Pill> : p.sections.map((s) => <Pill key={s} tone="line">{SECTION_LABEL[s]}</Pill>)}
                {!p.isOwner && p.requiresApproval ? <Pill tone="gold">potrjujete vi</Pill> : null}
              </span>
            </span>
            {p.isOwner ? null : (
              <span className="chev">
                <Icon name="r" />
              </span>
            )}
          </button>
        ))}
      </div>
      {person ? <PersonPanel key={person.id} person={person} onClose={close} /> : null}
      {inviting && !person ? <InvitePanel onClose={close} /> : null}
    </div>
  );
}
