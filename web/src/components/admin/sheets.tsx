"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setBigText } from "@/app/admin/actions";
import { signOut } from "@/lib/auth-client";
import { Icon } from "./Icon";
import { Panel } from "./Panel";
import { useToast } from "./Toast";
import { Switch } from "./ui";
import type { NavItem, ShellUser } from "./nav";

/** "Več" on the phone tab bar: the sections that didn't fit. */
export function MoreSheet({ items, current, onClose }: { items: NavItem[]; current: string; onClose: () => void }) {
  return (
    <Panel title="Več" onClose={onClose}>
      <nav className="menu" aria-label="Več razdelkov">
        {items.map((n) => (
          <Link key={n.href} href={n.href} onClick={onClose} aria-current={current === n.href ? "page" : undefined}>
            <Icon name={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>
    </Panel>
  );
}

/** The profile: bigger text, my changes, sign out. */
export function ProfileSheet({ me, onClose }: { me: ShellUser; onClose: () => void }) {
  const [big, setBig] = useState(me.bigText);
  const [, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const toast = useToast();
  const router = useRouter();

  function toggleBig(on: boolean) {
    setBig(on);
    document.documentElement.classList.toggle("big", on);
    startTransition(async () => {
      const r = await setBigText(on);
      if (!r.ok) {
        setBig(!on);
        document.documentElement.classList.toggle("big", !on);
        toast.show({ text: "Nastavitve ni bilo mogoče shraniti.", tone: "error" });
      }
    });
  }

  async function leave() {
    setLeaving(true);
    try {
      await signOut(); // POST /api/auth/sign-out, then /prijava
    } catch {
      router.replace("/prijava");
    }
  }

  return (
    <Panel eyebrow={me.title} title={me.name} sub={me.email} onClose={onClose}>
      <div className="grp">
        <Switch label="Večje črke" hint="Vse besedilo malo večje." checked={big} onChange={toggleBig} />
      </div>
      <nav className="menu" aria-label="Profil">
        <Link href="/zgodovina" onClick={onClose}>
          <Icon name="hist" />
          Moje spremembe
        </Link>
        <button type="button" onClick={leave} disabled={leaving}>
          <Icon name="out" />
          Odjava
        </button>
      </nav>
    </Panel>
  );
}
