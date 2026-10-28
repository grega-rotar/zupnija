"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buttonClassName } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { copyText } from "./copy";

/** The fallback links, built from the page's absolute URL (exported for tests). */
export function shareLinks(title: string, url: string) {
  const u = encodeURIComponent(url);
  return [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: "E-pošta", href: `mailto:?subject=${encodeURIComponent(title)}&body=${u}` },
  ];
}

/**
 * "Deli" (US-010). On a phone with the Web Share API it opens the system
 * share sheet with {title, url}; elsewhere it opens a small panel with
 * WhatsApp, Facebook, E-pošta and "Kopiraj povezavo".
 */
export function Share({ title, url, className }: { title: string; url: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  async function onShare() {
    const phone = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
    if (phone && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // closed the sheet
      }
    }
    setOpen((o) => !o);
  }

  const item = "flex min-h-11 w-full items-center rounded-sm px-3.5 text-left text-[0.9375rem] font-medium text-ink hover:bg-paper-2";
  return (
    <div ref={root} className={cn("relative inline-block", className)}>
      <button type="button" className={cn(buttonClassName({ variant: "secondary", size: "sm" }), "gap-2")} aria-expanded={open} aria-controls={panelId} onClick={onShare}>
        <Icon name="link" size={16} />
        <span>Deli</span>
      </button>
      <div id={panelId} hidden={!open} className="absolute left-0 z-20 mt-2 w-60 rounded-md bg-surface p-1.5 shadow-lift">
        <ul>
          {shareLinks(title, url).map((l) => (
            <li key={l.label}>
              <a href={l.href} className={item} target={l.href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={item}
              onClick={async () => {
                setCopied(await copyText(url));
                setTimeout(() => setCopied(false), 2400);
              }}
            >
              {copied ? "Povezava je kopirana" : "Kopiraj povezavo"}
            </button>
          </li>
        </ul>
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? "Povezava je kopirana." : ""}
        </span>
      </div>
    </div>
  );
}
