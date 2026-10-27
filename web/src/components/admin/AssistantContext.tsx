"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Open/closed state of the assistant panel, shared by the ask bar, the
 * "Vprašaj pomočnika" tile on Domov and the panel itself.
 *
 *   const { openAssistant } = useAssistant();
 *   openAssistant();                      // just open
 *   openAssistant("Odpovej mašo v sredo"); // open and send this text
 *
 * The panel reads `initial` once and calls `consumeInitial()`.
 */
type AssistantState = {
  open: boolean;
  initial: string | null;
  openAssistant: (initial?: string) => void;
  closeAssistant: () => void;
  consumeInitial: () => string | null;
};

const Ctx = createContext<AssistantState | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<string | null>(null);
  const openAssistant = useCallback((text?: string) => {
    setInitial(text?.trim() ? text.trim() : null);
    setOpen(true);
  }, []);
  const closeAssistant = useCallback(() => setOpen(false), []);
  const consumeInitial = useCallback(() => {
    const t = initial;
    if (t) setInitial(null);
    return t;
  }, [initial]);
  const value = useMemo(
    () => ({ open, initial, openAssistant, closeAssistant, consumeInitial }),
    [open, initial, openAssistant, closeAssistant, consumeInitial],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistant(): AssistantState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAssistant must be used inside <AssistantProvider>");
  return v;
}
