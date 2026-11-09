import { cn } from "@/lib/utils";
import { SubscribeForm } from "./SubscribeForm";
import s from "./newsletter.module.css";

/** The homepage's "Oznanila po e-pošti" tile, next to the giving tile (#darovi). */
export function NewsletterTile({ className }: { className?: string }) {
  return (
    <div className={cn(s.tile, className)} id="oznanila-po-e-posti">
      <h3 className={s.gt}>
        Oznanila po e-pošti
      </h3>
      <p className={s.gp}>Enkrat na mesec, ko izidejo. Nič drugega.</p>
      <SubscribeForm />
    </div>
  );
}

/** The footer's line: the same form, without the tile. */
export function FooterSubscribe() {
  return (
    <div className="max-w-[440px]">
      <h2 className="mb-2 text-[0.875rem] tracking-[-0.01em] text-ink">Oznanila po e-pošti</h2>
      <SubscribeForm labelClassName="sr-only" />
    </div>
  );
}
