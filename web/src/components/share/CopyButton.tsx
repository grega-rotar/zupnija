"use client";

import { useEffect, useState } from "react";
import { buttonClassName } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { copyText } from "./copy";

type Props = {
  text: string;
  label: string;
  /** Said (and shown) after copying, e.g. "IBAN je kopiran." */
  done: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

/** A button that copies `text`; the confirmation is announced through a live region. */
export function CopyButton({ text, label, done, variant = "secondary", className }: Props) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2400);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" className={cn(buttonClassName({ variant, size: "sm" }), "gap-2", className)} onClick={async () => setState((await copyText(text)) ? "ok" : "fail")}>
        <Icon name={state === "ok" ? "check" : "document"} size={16} />
        <span>{state === "ok" ? "Kopirano" : label}</span>
      </button>
      <span role="status" aria-live="polite" className="text-small text-ink-3">
        {state === "ok" ? done : state === "fail" ? "Kopiranje ni uspelo. Označite besedilo in ga kopirajte ročno." : ""}
      </span>
    </span>
  );
}
