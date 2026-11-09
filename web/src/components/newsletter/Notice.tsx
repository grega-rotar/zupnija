import { Button, Container, Section, headline } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * The confirm and unsubscribe pages' message (/obvestila/potrdi, /obvestila/odjavljeni),
 * centered like the site's 404: the headline and one line under it (ZUP-14: no eyebrow, one font).
 */
export function NewsletterNotice({ title, lede }: { title: string; lede: string }) {
  return (
    <Section>
      <Container width="prose" className="flex flex-col items-center py-10 text-center lg:py-16">
        <h1 className={cn("text-balance", headline.h2)}>{title}</h1>
        <p className="mt-5 text-balance text-lede text-ink-2">{lede}</p>
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
