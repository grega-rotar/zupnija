"use server";
/** The subscribe form's server action (components/newsletter/SubscribeForm.tsx). */
import type { FormResult } from "@/lib/forms/public";
import { submitSubscribe } from "./form";

export async function subscribeAction(_: FormResult | null, fd: FormData): Promise<FormResult> {
  return submitSubscribe(fd);
}
