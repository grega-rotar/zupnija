import { RichText, type PortableTextValue } from "@/components/sanity/RichText";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { tile } from "./primitives";

type Item = { _key: string; question: string; answer: PortableTextValue | null };

/**
 * Questions and answers using native <details>: keyboard accessible, no
 * JavaScript, and the browser handles open/close state.
 */
export function Faq({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return (
    <div className={cn(tile, "divide-y divide-stone/70")}>
      {items.map((item) => (
        <details key={item._key} className="group">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-6 py-4 text-[1.0625rem] font-semibold tracking-[-0.015em] text-ink marker:hidden sm:px-8 [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <Icon name="chevron-down" size={20} className="shrink-0 text-gold-ink transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <div className="px-6 pb-6 sm:px-8">
            <RichText value={item.answer} />
          </div>
        </details>
      ))}
    </div>
  );
}
