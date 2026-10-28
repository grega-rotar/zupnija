"use client";

import { useAssistant } from "@/components/admin/AssistantContext";
import { Icon } from "@/components/admin/Icon";

/** The "Vprašaj pomočnika" quick tile: opens the assistant panel. */
export function AskTile() {
  const { openAssistant } = useAssistant();
  return (
    <button type="button" className="qt" onClick={() => openAssistant()}>
      <Icon name="msg" />
      <span>
        Vprašaj pomočnika<small>napišite po domače</small>
      </span>
    </button>
  );
}
