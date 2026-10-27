"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { undoHistory } from "@/app/admin/actions";
import { Icon } from "./Icon";
import { useAppFrame } from "./Panel";

/**
 * One toast at a time, at the bottom of the app frame, gone after 5.2 s.
 *
 *   const toast = useToast();
 *   toast.show({ text: "Shranjeno. Namen je že na strani.", historyId });
 *   toast.show("Osnutek je shranjen. Najdete ga pri Oznanilih.");
 *
 * With `historyId` the toast offers "Razveljavi": it undoes that change on
 * the server and then says "Razveljavljeno: …". `tone: "error"` shows the
 * alert icon (for an ActionResult error).
 */
export type ToastInput = { text: string; historyId?: number | null; tone?: "ok" | "error" };
type ToastApi = { show: (t: ToastInput | string) => void; hide: () => void };
type Shown = ToastInput & { key: number };

const Ctx = createContext<ToastApi | null>(null);
const DURATION = 5200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Shown | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  const [busy, startTransition] = useTransition();
  const frame = useAppFrame();

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);
  const show = useCallback((t: ToastInput | string) => {
    const input = typeof t === "string" ? { text: t } : t;
    clearTimeout(timer.current);
    setToast({ ...input, key: ++seq.current });
    timer.current = setTimeout(() => setToast(null), DURATION);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const undo = (historyId: number) =>
    startTransition(async () => {
      const r = await undoHistory(historyId);
      show(r.ok ? { text: r.data.label } : { text: r.error === "forbidden" ? "Tega ne morete razveljaviti." : r.error, tone: "error" });
    });

  const api = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {frame && toast
        ? createPortal(
            <div key={toast.key} className="toast enter" role="status">
              <Icon name={toast.tone === "error" ? "alert" : "check"} />
              <span>{toast.text}</span>
              {toast.historyId != null ? (
                <button type="button" onClick={() => undo(toast.historyId!)} disabled={busy}>
                  Razveljavi
                </button>
              ) : null}
            </div>,
            frame,
          )
        : null}
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}
