import { RichText, type PortableTextValue } from "@/components/sanity/RichText";
import { Icon } from "./Icon";

type Item = { _key: string; question: string; answer: PortableTextValue | null };

/**
 * Questions and answers using native <details>: keyboard accessible, no
 * JavaScript, and the browser handles open/close state.
 */
export function Faq({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return (
    <div className="divide-y divide-stone border-y border-stone">
      {items.map((item) => (
        <details key={item._key} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-serif text-lede text-ink marker:hidden [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <Icon name="chevron-down" size={20} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="pb-5">
            <RichText value={item.answer} />
          </div>
        </details>
      ))}
    </div>
  );
}
