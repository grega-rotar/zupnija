/**
 * The subscribe form, through the public forms' helper (lib/forms/public.ts):
 * honeypot, validation, the rate limit of 5 per 10 minutes per IP. The server
 * action (actions.ts) calls this; tests pass `ip`.
 */
import "server-only";
import { z } from "zod";
import { fields, submitPublicForm, type FormResult } from "@/lib/forms/public";
import { subscribe, thankYou } from "./service";

/** The newsletter's own wording for the rate limit (PRD US-005). */
export const TOO_MANY_TRIES = "Preveč poskusov. Poskusite čez nekaj minut.";

const subscribeSchema = z.object({ email: fields.email() });

export async function submitSubscribe(fd: FormData, ip?: string): Promise<FormResult> {
  const raw = String(fd.get("email") ?? "").trim().toLowerCase();
  const r = await submitPublicForm({
    form: "newsletter",
    schema: subscribeSchema,
    data: fd,
    thanks: thankYou(raw),
    ip,
    handle: async ({ email }) => {
      await subscribe(email);
      return { ok: true, message: thankYou(email) };
    },
  });
  if (r.ok) return r;
  // One field, so the message is the field's own error.
  return { ...r, message: r.status === 429 ? TOO_MANY_TRIES : (r.fieldErrors.email ?? r.message) };
}
