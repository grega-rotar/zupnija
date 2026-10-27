import type { IconName } from "./Icon";
import type { Section } from "@/lib/admin/sections";

/** What the shell needs to know about the signed-in person (serialisable). */
export type ShellUser = {
  name: string;
  email: string;
  title: string;
  short: string;
  isOwner: boolean;
  bigText: boolean;
  sections: Section[];
};

export type NavItem = { href: string; label: string; short?: string; icon: IconName };

/** The prototype's NAV, filtered by what this person may see. Hrefs are host-relative (admin.<domain>/…). */
export function navFor(u: Pick<ShellUser, "isOwner" | "sections">): NavItem[] {
  const can = (s: Section) => u.isOwner || u.sections.includes(s);
  const items: Array<NavItem | false> = [
    { href: "/", label: "Domov", icon: "home" },
    can("mase") && { href: "/teden", label: "Maše in nameni", short: "Maše", icon: "cal" },
    can("oznanila") && { href: "/oznanila", label: "Oznanila", icon: "file" },
    can("dogodki") && { href: "/dogodki", label: "Dogodki", icon: "star" },
    can("verouk") && { href: "/verouk", label: "Verouk", icon: "book" },
    u.isOwner && { href: "/ljudje", label: "Ljudje in dostop", short: "Ljudje", icon: "users" },
    { href: "/zgodovina", label: "Zgodovina", icon: "hist" },
  ];
  return items.filter((n): n is NavItem => !!n);
}

/** The editor path without the /admin prefix the proxy rewrites to. */
export function editorPath(pathname: string): string {
  const p = pathname.replace(/^\/admin(?=\/|$)/, "") || "/";
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

/** The nav item a path belongs to ("/oznanila/nalozi" → Oznanila); Domov when none. */
export function currentItem(items: NavItem[], path: string): NavItem {
  return items.find((n) => n.href !== "/" && (path === n.href || path.startsWith(n.href + "/"))) ?? items[0];
}
