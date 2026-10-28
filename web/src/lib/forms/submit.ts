"use server";

/** The server actions behind the public request forms (useActionState on the client). */
import { submitEnrolment } from "@/lib/verouk/enrolment";
import { submitIntentionRequest } from "@/lib/mase/requests";
import { submitSacramentRequest } from "@/lib/sacraments/requests";
import type { FormResult } from "./public";

export async function enrolAction(_prev: FormResult | null, fd: FormData): Promise<FormResult> {
  return submitEnrolment(fd);
}

export async function intentionRequestAction(_prev: FormResult | null, fd: FormData): Promise<FormResult> {
  return submitIntentionRequest(fd);
}

export async function sacramentRequestAction(_prev: FormResult | null, fd: FormData): Promise<FormResult> {
  return submitSacramentRequest(fd);
}
