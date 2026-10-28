"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/admin/ui";
import { ACCEPT_ANY, ACCEPT_PHOTO, handOff } from "./handoff";

/**
 * "Izberi datoteko" (the PDF, the usual case) and "Fotografiraj" outside the
 * upload page: opens the picker here, then continues on /oznanila/nalozi with the file.
 */
export function PickButtons({ photoLabel = "Fotografiraj" }: { photoLabel?: string }) {
  const router = useRouter();
  const photo = useRef<HTMLInputElement>(null);
  const any = useRef<HTMLInputElement>(null);
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    handOff(f);
    router.push("/oznanila/nalozi");
  };
  return (
    <>
      <Button variant="primary" size="lg" icon="up" onClick={() => any.current?.click()}>
        Izberi datoteko
      </Button>
      <Button size="lg" icon="cam" onClick={() => photo.current?.click()}>
        {photoLabel}
      </Button>
      <input ref={any} type="file" accept={ACCEPT_ANY} hidden onChange={take} />
      <input ref={photo} type="file" accept={ACCEPT_PHOTO} capture="environment" hidden onChange={take} />
    </>
  );
}
