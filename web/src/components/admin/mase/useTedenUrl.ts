"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * The week screen keeps its state in the URL: `w` (week), `pogled=strani`
 * (preview), `masa` (open Mass panel) and `nov=1` (the "Nov namen" panel),
 * so reload and the back button work.
 *
 * A Mass panel opens with history.pushState (the week already has its data,
 * no server round trip); "Nov namen" needs the upcoming Masses, so it is a
 * router navigation. Closing goes back in history when we pushed the entry
 * and nothing changed since; otherwise it replaces the URL, so the page that
 * was just refreshed by an action stays on screen.
 */
let pushed = false;
if (typeof window !== "undefined") window.addEventListener("popstate", () => (pushed = false));

/** After a change the old history entry may show stale data: close by replacing. */
export function markChanged() {
  pushed = false;
}

type Patch = Record<string, string | null>;

export function useTedenUrl() {
  const sp = useSearchParams();
  const router = useRouter();

  const href = useCallback(
    (patch: Patch) => {
      const q = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null) q.delete(k);
        else q.set(k, v);
      }
      const s = q.toString();
      return s ? `?${s}` : window.location.pathname;
    },
    [sp],
  );

  const openMass = useCallback(
    (id: number) => {
      pushed = true;
      window.history.pushState(null, "", href({ masa: String(id), nov: null }));
    },
    [href],
  );

  const openNew = useCallback(() => {
    pushed = true;
    router.push(href({ nov: "1", masa: null }), { scroll: false });
  }, [href, router]);

  const close = useCallback(() => {
    if (pushed) {
      pushed = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", href({ masa: null, nov: null }));
    }
  }, [href]);

  const setView = useCallback(
    (preview: boolean) => window.history.replaceState(null, "", href({ pogled: preview ? "strani" : null })),
    [href],
  );

  const goWeek = useCallback(
    (w: string | null) => router.push(href({ w, masa: null, nov: null }), { scroll: false }),
    [href, router],
  );

  return {
    massId: Number(sp.get("masa")) || null,
    isNew: sp.get("nov") === "1",
    preview: sp.get("pogled") === "strani",
    openMass,
    openNew,
    close,
    setView,
    goWeek,
  };
}
