"use client";

import { useEffect } from "react";
import { Button, Container, Section } from "@/components/ui/primitives";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section>
      <Container width="prose" className="max-w-2xl py-10">
        <p className="text-small text-ink-3">Napaka</p>
        <h1 className="mt-2 text-h1">Nekaj je šlo narobe</h1>
        <p className="mt-4 text-lede text-ink-2">
          Strani trenutno ne moremo prikazati. Poskusite znova; če se napaka ponavlja, nas pokličite ali pišite.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center rounded-sm bg-moss px-5 font-medium text-paper hover:bg-moss-deep"
          >
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
