import type { ReactNode } from "react";
import { Breadcrumbs, Container, PageHeader, Section } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";

/**
 * The frame of a public request form (Verouk enrolment, intention request,
 * sacrament enquiry): the light centered header, then a white form tile with
 * a quieter column of notes beside it (below it on phones).
 */
export function FormPage({
  title,
  accent,
  lede,
  crumbs,
  eyebrow,
  heading,
  intro,
  aside,
  children,
}: {
  title: string;
  accent?: string;
  lede?: string;
  crumbs: { label: string; href?: string }[];
  eyebrow: string;
  heading: ReactNode;
  intro?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} accent={accent} lede={lede} eyebrow={<Breadcrumbs items={[{ label: "Domov", href: routes.home }, ...crumbs]} />} />
      <Section>
        <Container className="grid gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-lg bg-surface p-6 shadow-soft sm:p-10">
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="mt-1 text-[1.5rem] font-bold tracking-[-0.035em]">{heading}</h2>
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
export function AsideTile({ eyebrow, title, children, warm }: { eyebrow?: string; title: string; children: ReactNode; warm?: boolean }) {
  return (
    <div className={warm ? "rounded-lg bg-[linear-gradient(165deg,var(--color-gold-soft)_0%,#fff_72%)] p-6 shadow-soft sm:p-8" : "rounded-lg bg-surface p-6 shadow-soft sm:p-8"}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="mt-1 text-[1.25rem] font-bold tracking-[-0.03em] text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-body text-ink-2">{children}</div>
    </div>
  );
}
