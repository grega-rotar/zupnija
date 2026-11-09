import { SubscribeForm } from "./SubscribeForm";

/** The footer's "Oznanila po e-pošti" on every page: the only signup (ZUP-17 removed the homepage tile). */
export function FooterSubscribe() {
  return (
    <div className="max-w-[440px]">
      <h2 className="mb-2 text-[0.875rem] tracking-[-0.01em] text-ink">Oznanila po e-pošti</h2>
      <SubscribeForm labelClassName="sr-only" />
    </div>
  );
}
