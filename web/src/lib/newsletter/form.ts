/**
 * The subscribe form, through the public forms' helper (lib/forms/public.ts):
 * honeypot, validation, and ZUP-19's limit of 5 signups per IP per hour. The
 * answer is THANK_YOU for every accepted signup (new, pending, active or
 * throttled address alike). The server action (actions.ts) calls this; tests
 * pass `ip`.
 */
import "server-only";
import { z } from "zod";
import { fields, submitPublicForm, type FormResult } from "@/lib/forms/public";
import { subscribe, THANK_YOU } from "./service";

/** The newsletter's own wording for the rate limit (PRD US-005). */
export const TOO_MANY_TRIES = "Preveč poskusov. Poskusite čez nekaj minut.";

/** Signups per IP per hour (ZUP-19). */
export const SIGNUP_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

const subscribeSchema = z.object({ email: fields.email() });

export async function submitSubscribe(fd: FormData, ip?: string): Promise<FormResult> {
  const r = await submitPublicForm({
    form: "newsletter",
    schema: subscribeSchema,
    data: fd,
    thanks: THANK_YOU,
    ip,
    limit: SIGNUP_LIMIT,
    handle: async ({ email }) => {
      await subscribe(email);
      return { ok: true, message: THANK_YOU };
    },
  });
  if (r.ok) return r;
  // One field, so the message is the field's own error.
  return { ...r, message: r.status === 429 ? TOO_MANY_TRIES : (r.fieldErrors.email ?? r.message) };
}
