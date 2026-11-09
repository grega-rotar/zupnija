import type { ReactNode } from "react";
import { Container, PageHeader, Section } from "@/components/ui/primitives";

/**
 * The frame of a public request form (Verouk enrolment, intention request,
 * sacrament enquiry): the light centered header, then a white form tile with
 * a quieter column of notes beside it (below it on phones).
 */
export function FormPage({
  title,
  crumbs,
  heading,
  intro,
  aside,
  children,
}: {
  title: string;
  crumbs: { label: string; href?: string }[];
  heading: ReactNode;
  intro?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} crumbs={crumbs} />
      <Section>
        <Container className="grid gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-lg bg-surface p-6 shadow-soft sm:p-10">
            <h2 className="text-h3">{heading}</h2>
            {intro ? <div className="mt-1.5 text-small text-ink-2">{intro}</div> : null}
            <div className="mt-8">{children}</div>
          </div>
          {aside ? <aside className="min-w-0 space-y-5">{aside}</aside> : null}
        </Container>
      </Section>
    </>
  );
}

/** A note tile beside the form. */
export function AsideTile({ title, children, warm }: { title: string; children: ReactNode; warm?: boolean }) {
  return (
    <div className={warm ? "rounded-lg bg-[linear-gradient(165deg,var(--color-gold-soft)_0%,#fff_72%)] p-6 shadow-soft sm:p-8" : "rounded-lg bg-surface p-6 shadow-soft sm:p-8"}>
      <h2 className="text-h4">{title}</h2>
      <div className="mt-3 space-y-3 text-body text-ink-2">{children}</div>
    </div>
  );
}
