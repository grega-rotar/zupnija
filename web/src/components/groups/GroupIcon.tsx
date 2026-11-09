import type { StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import bralciBozjeBesede from "./icons/bralci-bozje-besede.svg";
import krasilci from "./icons/krasilci.svg";
import ministranti from "./icons/ministranti.svg";
import mladinskaSkupina from "./icons/mladinska-skupina.svg";
import mladinskiPevskiZbor from "./icons/mladinski-pevski-zbor.svg";
import molitvenaSkupina from "./icons/molitvena-skupina.svg";
import odrasliPevskiZbor from "./icons/odrasli-pevski-zbor.svg";
import oratorij from "./icons/oratorij.svg";
import oratorijskiAnimatorji from "./icons/oratorijski-animatorji.svg";
import otroskiPevskiZbor from "./icons/otroski-pevski-zbor.svg";
import pritrkovalci from "./icons/pritrkovalci.svg";
import verouk from "./icons/verouk.svg";
import zakonskaSkupina from "./icons/zakonska-skupina.svg";
import zupnijskaKaritas from "./icons/zupnijska-karitas.svg";
import zupnijskiPastoralniSvet from "./icons/zupnijski-pastoralni-svet.svg";

/**
 * The groups' icons (ZUP-13, skupine-ikone-v3): line drawings in the "Daruj"
 * button's colour (--color-moss, #7a5c1e) on a transparent ground. Keys are
 * the editor's choices (GROUP_ICONS in src/lib/content/fields.ts).
 */
const ICONS: Record<string, StaticImageData> = {
  "bralci-bozje-besede": bralciBozjeBesede,
  krasilci,
  ministranti,
  "mladinska-skupina": mladinskaSkupina,
  "mladinski-pevski-zbor": mladinskiPevskiZbor,
  "molitvena-skupina": molitvenaSkupina,
  "odrasli-pevski-zbor": odrasliPevskiZbor,
  oratorij,
  "oratorijski-animatorji": oratorijskiAnimatorji,
  "otroski-pevski-zbor": otroskiPevskiZbor,
  pritrkovalci,
  verouk,
  "zakonska-skupina": zakonskaSkupina,
  "zupnijska-karitas": zupnijskaKaritas,
  "zupnijski-pastoralni-svet": zupnijskiPastoralniSvet,
};

/**
 * The icon in its rounded square of light ground (#F3EEE3). A group without
 * an icon gets the same square, empty, so the grid stays even.
 */
export function GroupIcon({ icon, size = 72, className }: { icon: string | null | undefined; size?: number; className?: string }) {
  const src = icon ? ICONS[icon] : undefined;
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-[22%] bg-[#f3eee3]", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small static SVG, nothing for the optimiser to do
        <img src={src.src} alt="" width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} draggable={false} />
      ) : null}
    </span>
  );
}
