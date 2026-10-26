import type { HOME_PAGE_QUERY_RESULT } from "@/sanity/types.generated";
import { routes } from "@/lib/routes";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Container } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

type Props = { home: HOME_PAGE_QUERY_RESULT; parishName: string; tagline?: string | null };

/**
 * Photograph of the place, full width, with the parish name set on it.
 * A soft dark gradient on the left keeps the text readable on any photo.
 */
export function Hero({ home, parishName, tagline }: Props) {
  const title = home?.heroTitle || parishName;
  const text = home?.heroText || tagline;
  const quote = home?.heroQuote?.text ? home.heroQuote : null;

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ink text-paper">
      {hasImage(home?.heroImage) ? (
        <SanityImage
          image={home.heroImage}
          aspect={16 / 9}
          sizes="100vw"
          maxWidth={2400}
          priority
          quality={82}
          decorative
          fill
          className="-z-20"
        />
      ) : (
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,#3d5a47,#1e2622)]" aria-hidden="true" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(20_28_24/0.72)_0%,rgb(20_28_24/0.45)_45%,rgb(20_28_24/0.15)_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(180deg,transparent,rgb(20_28_24/0.55))]" />

      <Container className="relative flex min-h-[32rem] flex-col justify-end py-14 sm:min-h-[36rem] sm:py-20 lg:min-h-[40rem] lg:justify-center lg:py-24">
        <div className="animate-rise max-w-xl">
          {home?.heroEyebrow ? (
            <p className="mb-5 text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-paper/80">{home.heroEyebrow}</p>
          ) : null}
          <h1 id="hero-title" className="font-serif text-[clamp(2.75rem,1.6rem+4.4vw,5rem)] leading-[0.98] tracking-[-0.025em] text-paper">
            {title}
          </h1>
          {text ? <p className="mt-5 font-serif text-[clamp(1.375rem,1.1rem+1vw,1.875rem)] leading-snug text-paper">{text}</p> : null}
          {quote ? (
            <blockquote className="mt-8 max-w-md border-l border-paper/40 pl-4 text-paper/85">
              <p className="lede text-[1.0625rem] text-paper/85">{quote.text}</p>
              {quote.source ? <cite className="mt-1 block text-small not-italic text-paper/70">{quote.source}</cite> : null}
            </blockquote>
          ) : null}
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href={routes.masses}
              className="inline-flex min-h-12 items-center gap-2.5 rounded-sm bg-moss px-5 font-medium text-paper transition-colors hover:bg-moss-deep"
            >
              <Icon name="calendar" size={18} />
              Svete maše
            </a>
            <a
              href={routes.events}
              className="inline-flex min-h-12 items-center rounded-sm border border-paper/70 px-5 font-medium text-paper transition-colors hover:border-paper hover:bg-paper/10"
            >
              Prihajajoči dogodki
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
