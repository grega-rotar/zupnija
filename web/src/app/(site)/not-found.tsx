import Link from "next/link";
import { routes } from "@/lib/routes";
import { Button, Container, Section, headline } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <Section>
      <Container width="prose" className="flex flex-col items-center py-10 text-center lg:py-16">
        <p className="eyebrow">Napaka 404</p>
        <h1 className={cn("mt-3", headline.display)}>
          Te strani <span className="accent">ni</span>
        </h1>
        <p className="lede mt-5 text-balance">
          Povezava je morda zastarela ali napačno zapisana. Kar iščete, je verjetno na eni od spodnjih strani.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button href={routes.home}>Na domačo stran</Button>
          <Button href={routes.masses} variant="secondary">
            Svete maše
          </Button>
          <Button href={routes.search} variant="secondary">
            Iskanje
          </Button>
        </div>
        <p className="mt-9 text-small text-ink-3">
          Če mislite, da gre za napako na strani,{" "}
          <Link href={routes.contact} className="font-medium text-gold-ink underline underline-offset-4 hover:text-moss-deep">
            nam sporočite
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}
