"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { NavItem } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

type Props = {
  items: NavItem[];
  searchHref: string;
  /** Optional highlighted action on the right. */
  action?: { label: string; href: string };
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Site navigation. Desktop: inline links, sections with children open a
 * small panel on click (keyboard and touch friendly). Mobile: a full-height
 * drawer with large tap targets. One component so behaviour stays in sync.
 */
export function Nav({ items, searchHref, action }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState(pathname);
  const drawerId = useId();
  const navRef = useRef<HTMLDivElement>(null);

  // Close everything on navigation (state derived from the pathname prop).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setExpanded(null);
  }

  // Lock scroll while the drawer is open; close on Escape / outside click.
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setExpanded(null);
      }
    }
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setExpanded(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const desktopLink =
    "inline-flex min-h-11 items-center gap-1 border-b border-transparent px-2.5 text-small font-medium text-ink/85 transition-colors hover:text-ink";

  return (
    <div ref={navRef} className="flex items-center gap-1 lg:gap-2">
      {/* Desktop */}
      <nav aria-label="Glavna navigacija" className="hidden lg:block">
        <ul className="flex items-center gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href) || item.children?.some((c) => isActive(pathname, c.href));
            if (!item.children) {
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(desktopLink, active && "border-ink text-ink")}>
                    {item.label}
                  </Link>
                </li>
              );
            }
            const isOpen = expanded === item.label;
            return (
              <li key={item.href} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setExpanded(isOpen ? null : item.label)}
                  className={cn(desktopLink, active && "border-ink text-ink")}
                >
                  {item.label}
                  <Icon name="chevron-down" size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen ? (
                  <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-md border border-stone bg-paper p-2 shadow-soft">
                    <ul>
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className="block rounded-sm px-3 py-2.5 hover:bg-paper-2"
                            aria-current={isActive(pathname, child.href) ? "page" : undefined}
                          >
                            <span className="block font-medium text-ink">{child.label}</span>
                            {child.description ? <span className="block text-meta text-ink-3">{child.description}</span> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <Link href={searchHref} className="inline-flex size-11 items-center justify-center rounded-sm text-ink hover:bg-paper-2" aria-label="Iskanje">
        <Icon name="search" size={22} />
      </Link>

      {action ? (
        <Link
          href={action.href}
          className="hidden min-h-10 items-center rounded-sm bg-moss px-4 text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-paper transition-colors hover:bg-moss-deep sm:inline-flex"
        >
          {action.label}
        </Link>
      ) : null}

      {/* Mobile trigger */}
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-sm text-ink hover:bg-paper-2 lg:hidden"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "close" : "menu"} size={24} />
        <span className="sr-only">{open ? "Zapri meni" : "Odpri meni"}</span>
      </button>

      {/* Mobile drawer */}
      <div id={drawerId} hidden={!open} className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-paper lg:top-20 lg:hidden">
        <nav aria-label="Mobilna navigacija" className="px-4 pb-10 pt-2 sm:px-6">
          <ul className="divide-y divide-stone">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              if (!item.children) {
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex min-h-14 items-center font-serif text-[1.375rem] text-ink", active && "text-moss-deep")}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }
              const isOpen = expanded === item.label;
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : item.label)}
                    className="flex min-h-14 w-full items-center justify-between font-serif text-[1.375rem] text-ink"
                  >
                    {item.label}
                    <Icon name="chevron-down" size={22} className={cn("transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen ? (
                    <ul className="mb-3 ml-1 border-l border-stone pl-4">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            aria-current={isActive(pathname, child.href) ? "page" : undefined}
                            className="flex min-h-12 items-center text-lede text-ink-2"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {action ? (
            <Link
              href={action.href}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-moss px-4 text-[0.875rem] font-semibold uppercase tracking-[0.12em] text-paper"
            >
              {action.label}
            </Link>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
