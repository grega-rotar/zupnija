import Link from "next/link";
import { routes } from "@/lib/routes";
import { Button, Container, Section } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <Section>
      <Container width="prose" className="max-w-2xl py-10">
        <p className="text-small text-ink-3">Napaka 404</p>
        <h1 className="mt-2 text-h1">Te strani ni</h1>
        <p className="mt-4 text-lede text-ink-2">
          Povezava je morda zastarela ali napačno zapisana. Kar iščete, je verjetno na eni od spodnjih strani.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href={routes.home}>Na domačo stran</Button>
          <Button href={routes.masses} variant="secondary">
            Svete maše
          </Button>
          <Button href={routes.search} variant="secondary">
            Iskanje
          </Button>
        </div>
        <p className="mt-8 text-small text-ink-3">
          Če mislite, da gre za napako na strani,{" "}
          <Link href={routes.contact} className="underline underline-offset-4 hover:text-ink">
            nam sporočite
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}
