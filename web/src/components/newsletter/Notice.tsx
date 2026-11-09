import { Button, Container, Section } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";

/**
 * The confirm and unsubscribe pages' message (/obvestila/potrdi, /obvestila/odjava),
 * centered like the site's 404: the headline and a lede.
 */
export function NewsletterNotice({ title, accent, lede }: { title: string; accent: string; lede: string }) {
  return (
    <Section>
      <Container width="prose" className="flex flex-col items-center py-10 text-center lg:py-16">
        <h1 className="text-balance">
          {title} {accent}
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
