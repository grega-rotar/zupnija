"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

/**
 * The prototype's panel: a side panel on wide screens, a bottom sheet on
 * narrow ones (the switch is the @container rule in admin.css). Rendered into
 * the app frame (#admin-app) with a scrim. Escape and the scrim close it,
 * Tab stays inside, focus returns to where it was on close.
 *
 *   {open && (
 *     <Panel eyebrow="Dogodki" title="Nov dogodek" sub="Pokaže se …" onClose={close}
 *       footer={<><Button variant="primary" size="lg">Dodaj dogodek</Button>…</>}>
 *       <Field label="Naslov">…</Field>
 *     </Panel>
 *   )}
 *
 * `footer` goes into `.panel-f`. `full` makes the sheet full-height on phones
 * (the assistant). `bare` skips the `.panel-b` wrapper so the caller lays out
 * the body itself (the assistant's `.chat`).
 */
export type PanelProps = {
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  full?: boolean;
  bare?: boolean;
  /** Accessible name when `title` isn't plain text. */
  label?: string;
  /** CSS selector inside the panel to focus on open; default is the panel itself (no keyboard pop-up on phones). */
  autoFocus?: string;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const noop = () => () => {};

export function useAppFrame(): HTMLElement | null {
  return useSyncExternalStore(
    noop,
    () => document.getElementById("admin-app"),
    () => null,
  );
}

export function Panel({ onClose, title, eyebrow, sub, children, footer, full, bare, label, autoFocus, className }: PanelProps) {
  const frame = useAppFrame();
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const [entering, setEntering] = useState(true);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Focus in on open, back out on close.
  useEffect(() => {
    if (!frame) return;
    const before = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const target = (autoFocus && el?.querySelector<HTMLElement>(autoFocus)) || el;
    target?.focus({ preventScroll: true });
    return () => {
      if (before && before.isConnected) before.focus({ preventScroll: true });
    };
    // Only on mount/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  // Escape closes from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function trap(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!frame) return null;
  const enter = entering ? " enter" : "";
  const name = label ?? (typeof title === "string" ? title : undefined);
  return createPortal(
    <>
      <div className={`scrim${enter}`} onClick={onClose} aria-hidden="true" />
      <section
        ref={ref}
        className={`panel${full ? " full" : ""}${enter}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={name}
        aria-labelledby={name ? undefined : titleId}
        tabIndex={-1}
        onKeyDown={trap}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setEntering(false);
        }}
      >
        <div className="panel-h">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
            {sub ? <p>{sub}</p> : null}
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Zapri">
            <Icon name="x" />
          </button>
        </div>
        {bare ? children : <div className="panel-b">{children}</div>}
        {footer ? <div className="panel-f">{footer}</div> : null}
      </section>
    </>,
    frame,
  );
}
