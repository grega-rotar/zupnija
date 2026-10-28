"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAssistant } from "./AssistantContext";
import { Icon } from "./Icon";
import { ChurchMark } from "@/components/ui/ChurchMark";
import { MoreSheet, ProfileSheet } from "./sheets";
import { currentItem, editorPath, navFor, type ShellUser } from "./nav";

/**
 * The editor frame from the prototype: sidebar on wide screens; phone bar,
 * tab bar (with "Več") on narrow ones; the ask bar above the tab bar.
 * `approvals` is the owner's pending change-request count (badge on Domov).
 */
export function Shell({ me, approvals, children }: { me: ShellUser; approvals: number; children: React.ReactNode }) {
  const path = editorPath(usePathname() ?? "/");
  const items = navFor(me);
  const cur = currentItem(items, path);
  const canUpload = me.isOwner || me.sections.includes("oznanila");
  const badge = me.isOwner && approvals > 0 ? approvals : 0;
  const { openAssistant } = useAssistant();

  // A sheet belongs to the page it was opened on; navigating closes it.
  const [sheet, setSheet] = useState<{ kind: "more" | "profile"; at: string } | null>(null);
  const open = sheet && sheet.at === path ? sheet.kind : null;
  const close = () => setSheet(null);

  // New page starts at the top of the scroll area (the window itself never scrolls).
  useEffect(() => {
    document.getElementById("scroll")?.scrollTo({ top: 0 });
  }, [path]);

  const tabs = items.length <= 4 ? items : items.slice(0, 3);
  const more = items.length > 4 ? items.slice(3) : [];
  const moreCurrent = more.length > 0 && !tabs.some((t) => t.href === cur.href);
  const avatarCls = `avatar${me.isOwner ? " moss" : ""}`;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <ChurchMark />
          <div>
            <Wordmark />
            <small>urejanje</small>
          </div>
        </div>
        <nav className="nav" aria-label="Razdelki">
          {items.map((n, i) => (
            <NavLinkWithSep
              key={n.href}
              sep={n.href === "/zgodovina" || (!n.group && !!items[i - 1]?.group)}
              heading={n.group && n.group !== items[i - 1]?.group ? n.group : undefined}
            >
              <Link href={n.href} aria-current={cur.href === n.href ? "page" : undefined}>
                <span className={`tile${GREY.has(n.href) || n.group ? " n" : ""}`}>
                  <Icon name={n.icon} />
                </span>
                {n.label}
                {n.href === "/" && badge ? (
                  <span className="count">{badge}</span>
                ) : null}
              </Link>
            </NavLinkWithSep>
          ))}
        </nav>
        <button type="button" className="me" onClick={() => setSheet({ kind: "profile", at: path })}>
          <span className={avatarCls}>{me.short}</span>
          <div>
            <b>{me.name}</b>
            <small>{me.title}</small>
          </div>
        </button>
      </aside>

      <div className="mainwrap">
        <header className="topbar">
          <p className="crumb">
            <span>{cur.group ?? "Urejanje"} ›</span> {cur.label}
          </p>
        </header>
        <header className="phonebar">
          <ChurchMark />
          <Wordmark />
          <button type="button" className={avatarCls} onClick={() => setSheet({ kind: "profile", at: path })} aria-label="Profil">
            {me.short}
          </button>
        </header>

        <main className="scroll" id="scroll">
          {children}
        </main>

        {path === "/oznanila/nalozi" ? (
          <div />
        ) : (
          <div className="askbar">
            <div className="inner">
              <button type="button" className="ask" onClick={() => openAssistant()}>
                <Icon name="msg" />
                <span>Napišite, kaj naj spremenim …</span>
              </button>
              {canUpload ? (
                <Link href="/oznanila/nalozi" className="cam" aria-label="Fotografiraj oznanila">
                  <Icon name="cam" />
                </Link>
              ) : null}
            </div>
          </div>
        )}

        <nav className="tabbar" aria-label="Razdelki">
          {tabs.map((n) => (
            <Link key={n.href} href={n.href} aria-current={cur.href === n.href ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.short ?? n.label}
              {n.href === "/" && badge ? (
                <span className="dot">{badge}</span>
              ) : null}
            </Link>
          ))}
          {more.length ? (
            <button type="button" onClick={() => setSheet({ kind: "more", at: path })} aria-current={moreCurrent ? "page" : undefined} aria-haspopup="dialog">
              <Icon name="more" />
              Več
            </button>
          ) : null}
        </nav>
      </div>

      {open === "more" ? <MoreSheet items={more} current={cur.href} onClose={close} /> : null}
      {open === "profile" ? <ProfileSheet me={me} onClose={close} /> : null}
    </div>
  );
}

/** Sidebar tiles are gold for the parish's work, grey for people and history (the prototype's two groups). */
const GREY = new Set(["/ljudje", "/zgodovina"]);

/** The parish's name, as in the prototype's window: one line, Inter 700. */
function Wordmark() {
  return <span className="wordmark">Župnija Pirniče</span>;
}

function NavLinkWithSep({ sep, heading, children }: { sep: boolean; heading?: string; children: React.ReactNode }) {
  return (
    <>
      {sep ? <div className="sep" role="separator" /> : null}
      {heading ? <p className="navgroup">{heading}</p> : null}
      {children}
    </>
  );
}
