"use client";

import { useEffect } from "react";
import { Button, Container, Section, buttonClassName } from "@/components/ui/primitives";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section>
      <Container width="prose" className="flex flex-col items-center py-10 text-center lg:py-16">
        <h1>
          Nekaj je šlo narobe
        </h1>
        <p className="lede mt-5 text-balance">
          Strani trenutno ne moremo prikazati. Poskusite znova; če se napaka ponavlja, nas pokličite ali pišite.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className={buttonClassName()}>
            Poskusi znova
          </button>
          <Button href="/" variant="secondary">
            Na domačo stran
          </Button>
        </div>
        {error.digest ? <p className="mt-6 text-meta text-ink-3">Koda napake: {error.digest}</p> : null}
      </Container>
    </Section>
  );
}
