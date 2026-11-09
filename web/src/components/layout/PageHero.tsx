import type { ReactNode } from "react";
import type { SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { SanityImage, hasImage } from "@/components/sanity/SanityImage";
import { PageHeader } from "@/components/ui/primitives";

type HeaderKey = "massesHeader" | "announcementsHeader" | "eventsHeader" | "parishHeader" | "catechesisHeader" | "contactHeader";

type Props = {
  settings: SETTINGS_QUERY_RESULT | null;
  header: HeaderKey;
  title: string;
  crumbs?: { label: string; href?: string }[];
  /** Shown under the photo frame, never on it. */
  children?: ReactNode;
};

/**
 * Header for the main sections: the editor's photograph from »Nastavitve
 * župnije → Glave strani« with only the breadcrumbs and the title on it
 * (ZUP-14), in the rounded photo frame of the homepage hero. Without a
 * photo it quietly becomes the light, centered header.
 */
export function PageHero({ settings, header, title, crumbs, children }: Props) {
  const h = settings?.[header];
  const image = hasImage(h?.image) ? (
    <SanityImage image={h.image} aspect={21 / 9} sizes="100vw" maxWidth={2400} priority quality={74} decorative fill />
  ) : null;

  return (
    <PageHeader title={title} crumbs={crumbs} image={image}>
      {children}
    </PageHeader>
  );
}
