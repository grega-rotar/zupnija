"use client";

import { Fragment, useEffect, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { tabFromHash } from "@/lib/sacraments/tabs";
import { cn } from "@/lib/utils";

type Tab = { key: string; label: string; apart: boolean };

/** Tab changes made here replace the hash without a `hashchange`, so they announce themselves. */
const CHANGE = "zakramenti:tab";
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}
const hashNow = () => window.location.hash;
const noHash = () => "";

/**
 * The tabs of /zakramenti as an ARIA tablist of links: the URL hash picks
 * the tab (/zakramenti#pogreb opens Pogreb, also after the 301 from an old
 * subpage), a click or the arrow keys change it in place, and the address
 * bar always holds a link worth sharing. On narrow screens the row scrolls
 * sideways and keeps the chosen tab in view. Every panel is in the HTML.
 */
export function SacramentTabs({ tabs, panels }: { tabs: Tab[]; panels: ReactNode[] }) {
  const hash = useSyncExternalStore(subscribe, hashNow, noHash);
  const active = tabFromHash(hash);
  const rail = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const select = (key: string, focus = false) => {
    history.replaceState(null, "", `#${key}`);
    window.dispatchEvent(new Event(CHANGE));
    if (focus) document.getElementById(`zavihek-${key}`)?.focus();
  };

  // A shared link (#pogreb) lands on the tabs, not on the top of the page.
  useEffect(() => {
    if (tabs.some((t) => `#${t.key}` === window.location.hash)) root.current?.scrollIntoView({ block: "start" });
  }, [tabs]);

  // Keep the chosen tab inside the sideways-scrolling row.
  useEffect(() => {
    const r = rail.current;
    const tab = document.getElementById(`zavihek-${active}`);
    if (!r || !tab || r.scrollWidth <= r.clientWidth) return;
    const left = tab.offsetLeft - (r.clientWidth - tab.offsetWidth) / 2;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    r.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
  }, [active]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    select(tabs[(to + tabs.length) % tabs.length].key, true);
  };

  return (
    <div ref={root} className="scroll-mt-28">
      <div
        ref={rail}
        className="-mx-4 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,#000_1rem,#000_calc(100%-1rem),transparent)] [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        <div role="tablist" aria-label="Zakramenti" className="mx-auto flex w-max items-center gap-1 rounded-full bg-paper-2 p-1.5">
          {tabs.map((t, i) => {
            const on = t.key === active;
            return (
              <Fragment key={t.key}>
                {t.apart && !tabs[i - 1]?.apart ? <span aria-hidden="true" className="mx-2 h-6 w-px shrink-0 bg-stone-2" /> : null}
                <a
                  id={`zavihek-${t.key}`}
                  href={`#${t.key}`}
                  role="tab"
                  aria-selected={on}
                  aria-controls={t.key}
                  tabIndex={on ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    select(t.key);
                  }}
                  onKeyDown={(e) => onKey(e, i)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-4 py-2.5 text-[0.9375rem] font-medium leading-none no-underline transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none sm:px-5",
                    on ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:bg-surface/60 hover:text-ink",
                  )}
                >
                  {t.label}
                </a>
              </Fragment>
            );
          })}
        </div>
      </div>

      {tabs.map((t, i) => (
        <div key={t.key} id={t.key} role="tabpanel" aria-labelledby={`zavihek-${t.key}`} hidden={t.key !== active} tabIndex={0} className="mt-12 focus-visible:outline-offset-8 sm:mt-16">
          {panels[i]}
        </div>
      ))}
    </div>
  );
}
