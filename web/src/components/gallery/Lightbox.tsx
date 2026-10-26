"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export type LightboxPhoto = {
  key: string;
  src: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
};

type Props = { photos: LightboxPhoto[]; label: string; children: ReactNode };

/**
 * Full-screen photo viewer built on the native <dialog> (focus trapping,
 * Escape, backdrop for free). Thumbnails inside `children` opt in with
 * `data-lightbox-index`. Keyboard: ← → to move. Touch: swipe.
 */
export function Lightbox({ photos, label, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);

  const open = useCallback((i: number) => {
    setIndex(i);
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const step = useCallback(
    (delta: number) => {
      setIndex((i) => (i === null ? null : (i + delta + photos.length) % photos.length));
    },
    [photos.length],
  );

  // Delegate clicks from the thumbnails (keeps the grid a server component).
  function onGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-lightbox-index]");
    if (!target) return;
    e.preventDefault();
    open(Number(target.dataset.lightboxIndex));
  }

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    function onKey(e: KeyboardEvent) {
      if (!d?.open) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    }
    function onClose() {
      setIndex(null);
    }
    d.addEventListener("close", onClose);
    window.addEventListener("keydown", onKey);
    return () => {
      d.removeEventListener("close", onClose);
      window.removeEventListener("keydown", onKey);
    };
  }, [step]);

  const photo = index === null ? null : photos[index];

  return (
    <div onClick={onGridClick}>
      {children}
      <dialog
        ref={dialogRef}
        aria-label={label}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-ink/95 p-0 text-paper backdrop:bg-ink/80"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onTouchStart={(e) => {
          touchStart.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          const end = e.changedTouches[0]?.clientX;
          touchStart.current = null;
          if (start === null || end === undefined) return;
          if (end - start > 50) step(-1);
          if (start - end > 50) step(1);
        }}
      >
        {photo ? (
          <div className="flex h-dvh flex-col">
            <div className="flex items-center justify-between px-3 py-2 sm:px-4">
              <p className="text-small tnum text-paper/80">
                {index! + 1} / {photos.length}
              </p>
              <button
                type="button"
                onClick={close}
                className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-paper/10"
                aria-label="Zapri"
                autoFocus
              >
                <Icon name="close" size={26} />
              </button>
            </div>
            <figure className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
              {/* eslint-disable-next-line @next/next/no-img-element -- full-size CDN image, sized by the viewer */}
              <img
                key={photo.key}
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                className="max-h-full max-w-full object-contain"
                style={{ height: "auto", width: "auto" }}
                decoding="async"
              />
              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="absolute left-1 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-ink/60 hover:bg-ink sm:left-3"
                    aria-label="Prejšnja fotografija"
                  >
                    <Icon name="arrow-left" size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="absolute right-1 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-ink/60 hover:bg-ink sm:right-3"
                    aria-label="Naslednja fotografija"
                  >
                    <Icon name="arrow-right" size={24} />
                  </button>
                </>
              ) : null}
              {photo.caption || photo.alt ? (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-4 pb-4 pt-8 text-center text-small text-paper/90">
                  {photo.caption || photo.alt}
                </figcaption>
              ) : null}
            </figure>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
