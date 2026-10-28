"use client";

import { useEffect } from "react";

/**
 * The restrained reveal: elements with `data-reveal` that start below the
 * fold fade up once when they scroll in. Without JavaScript, or with
 * reduced motion, everything is simply visible.
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter((el) => el.getBoundingClientRect().top > window.innerHeight);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.reveal = "in";
          io.unobserve(e.target);
        }
      },
      { threshold: 0.1 },
    );
    for (const el of els) {
      el.dataset.reveal = "wait";
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return null;
}
