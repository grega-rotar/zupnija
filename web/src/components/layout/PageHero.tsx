import type { ReactNode } from "react";
import type { SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { routes } from "@/lib/routes";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { Breadcrumbs, PageHeader } from "@/components/ui/primitives";

type HeaderKey = "massesHeader" | "announcementsHeader" | "eventsHeader" | "parishHeader" | "catechesisHeader" | "contactHeader";

type Props = {
  settings: SETTINGS_QUERY_RESULT | null;
  header: HeaderKey;
  title: string;
  /** Fallback line when the editor has not written one. */
  lede?: string | null;
  crumbs?: { label: string; href?: string }[];
  children?: ReactNode;
};

/**
 * Header for the main sections: the editor's photograph, short line and
 * quotation from »Nastavitve župnije → Glave strani«. Without a photo it
 * quietly becomes the light header.
 */
export function PageHero({ settings, header, title, lede, crumbs, children }: Props) {
  const h = settings?.[header];
  const image = hasImage(h?.image) ? (
    <SanityImage image={h.image} aspect={21 / 9} sizes="100vw" maxWidth={2400} priority quality={80} decorative fill />
  ) : null;
  const trail = [{ label: "Domov", href: routes.home }, ...(crumbs ?? [{ label: title }])];

  return (
    <PageHeader
      title={title}
      lede={h?.tagline || lede}
      image={image}
      quote={h?.quote?.text ? { text: h.quote.text, source: h.quote.source } : null}
      eyebrow={<Breadcrumbs items={trail} />}
    >
      {children}
    </PageHeader>
  );
}
