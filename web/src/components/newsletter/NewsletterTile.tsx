import { SubscribeForm } from "./SubscribeForm";

/** The footer's "Oznanila po e-pošti" on every page: the only signup (ZUP-17 removed the homepage tile). */
export function FooterSubscribe() {
  return (
    <div className="max-w-[440px]">
      <h2 className="mb-2 text-[13px] font-semibold tracking-[-0.005em] text-ink">Oznanila po e-pošti</h2>
      <SubscribeForm labelClassName="sr-only" />
    </div>
  );
}
