"use client";

import { useEffect } from "react";

/**
 * The restrained reveal: elements with `data-reveal` that start below the
 * fold fade up once when they scroll in. Without JavaScript, or with
 * reduced motion, everything is simply visible.
 *
 * Positions come only from the IntersectionObserver (its first report says
 * what is already on screen), never from getBoundingClientRect: reading
 * layout right after hydration forces a reflow of the whole page.
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (!seen.has(el)) {
            seen.add(el);
            // Already visible on load: leave it as it is, no animation.
            if (e.isIntersecting || e.boundingClientRect.top < 0) {
              io.unobserve(el);
              continue;
            }
            el.dataset.reveal = "wait";
            continue;
          }
          if (!e.isIntersecting) continue;
          el.dataset.reveal = "in";
          io.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    for (const el of document.querySelectorAll<HTMLElement>("[data-reveal]")) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
