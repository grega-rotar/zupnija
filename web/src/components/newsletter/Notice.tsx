import { Button, Container, Section, headline } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * The confirm and unsubscribe pages' message (/obvestila/potrdi, /obvestila/odjava),
 * centered like the site's 404: eyebrow, a headline with one serif phrase, a lede.
 */
export function NewsletterNotice({ title, accent, lede }: { title: string; accent: string; lede: string }) {
  return (
    <Section>
      <Container width="prose" className="flex flex-col items-center py-10 text-center lg:py-16">
        <p className="eyebrow">Oznanila po e-pošti</p>
        <h1 className={cn("mt-3 text-balance", headline.h2)}>
          {title} <span className="accent">{accent}</span>
        </h1>
        <p className="lede mt-5 text-balance">{lede}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button href={routes.announcements}>Oznanila</Button>
          <Button href={routes.home} variant="secondary">
            Na domačo stran
          </Button>
        </div>
      </Container>
    </Section>
  );
}
