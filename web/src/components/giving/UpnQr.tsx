import { upnQrPath } from "@/lib/giving/upnqr";
import { cn } from "@/lib/utils";

/**
 * A UPN QR code as inline SVG (one path, crisp edges, white quiet zone), so
 * it scales sharply and needs no request. The payload comes from
 * src/lib/giving/donations.ts.
 */
export function UpnQr({ payload, label = "UPN QR koda za dar župniji", className }: { payload: string; label?: string; className?: string }) {
  const { size, d } = upnQrPath(payload);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className={cn("block h-auto w-full text-ink", className)}>
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/** The QR in its white card with the small "UPN QR" caption (the prototype's `.c-qr`). */
export function QrCard({ payload, label, caption = "UPN QR", className }: { payload: string; label?: string; caption?: string; className?: string }) {
  return (
    <figure
      className={cn(
        "w-[13rem] shrink-0 rounded-[1.5rem] bg-surface px-4 pb-3.5 pt-4 text-center shadow-[0_0_0_1px_rgb(14_14_16/0.07),0_10px_30px_rgb(20_12_4/0.08)]",
        className,
      )}
    >
      <UpnQr payload={payload} label={label} />
      <figcaption className="mt-2.5 text-[11px] font-semibold tracking-[0.06em] text-ink-3">{caption}</figcaption>
    </figure>
  );
}
