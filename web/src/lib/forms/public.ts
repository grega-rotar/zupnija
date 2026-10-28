/**
 * The public forms' shared helper (tasks/contract-complete.md, "Public forms").
 * Every form a visitor can send (Verouk enrolment, intention request, sacrament
 * enquiry, newsletter subscribe) goes through `submitPublicForm`:
 *
 *   honeypot `website` filled  → { ok: true, message: thanks }, nothing stored
 *   zod validation fails       → { ok: false, message, fieldErrors } (Slovenian, per field)
 *   5 hits per 10 min per form and IP (rate_limit_hits) → { ok: false, message: TOO_MANY, status: 429 }
 *   otherwise                  → your `handle(data)` result
 *
 * API (keep it this small):
 *
 *   type FormResult            the server action's return value (and useActionState state)
 *   submitPublicForm(opts)     the whole pipeline above; `ip` defaults to the request's
 *   clientIp(headers)          CF-Connecting-IP, then the first X-Forwarded-For, else "unknown"
 *   formValues(formData)       FormData → plain object (repeated keys → arrays, $ACTION_* dropped)
 *   fields.*                   zod building blocks with the Slovenian messages
 *   TOO_MANY, CHECK_FIELDS     the shared messages
 *
 * Usage, in a "use server" file:
 *
 *   export async function subscribe(_: FormResult | null, fd: FormData): Promise<FormResult> {
 *     return submitPublicForm({
 *       form: "newsletter",
 *       schema: z.object({ email: fields.email() }),
 *       data: fd,
 *       thanks: "Hvala. Poslali smo vam e-pošto s povezavo za potrditev.",
 *       handle: async ({ email }) => { …store, sendMail… return { ok: true, message: "…" }; },
 *     });
 *   }
 *
 * On the client: `const [state, action, pending] = useActionState(subscribe, null)`;
 * render `state.message` inline and `state.fieldErrors?.<name>` under each field.
 * The ready-made field look is in src/components/forms/kit.tsx (optional).
 */
import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db } from "@/db";
import { now, today } from "@/lib/clock";

// ── Result ──────────────────────────────────────────────────────────────────
export type FormResult =
  | {
      ok: true;
      message: string;
      /** Values the form should show again after success (e.g. the parents for "another child"). */
      values?: Record<string, string>;
    }
  | {
      ok: false;
      message: string;
      /** Field name → its first error. Empty when the error is about the whole form. */
      fieldErrors: Record<string, string>;
      /** What was sent, so the form can be filled in again (React resets it after an action). */
      values?: Record<string, string | string[]>;
      /** The HTTP status this would be for an API (409 closed, 429 rate limit); informational. */
      status?: number;
    };

export const CHECK_FIELDS = "Preverite označena polja.";
export const TOO_MANY = "Poslali ste že več obrazcev zapored. Poskusite znova čez nekaj minut.";

// ── Building blocks ─────────────────────────────────────────────────────────
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Slovenian and international numbers: digits with spaces, slashes, dashes, an optional +. */
const PHONE = /^\+?[\d\s/().-]{6,20}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A FormData string (or nothing) → trimmed string; "" when missing. */
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const fields = {
  /** Required text. */
  text: (required: string, max = 200, tooLong = `Največ ${max} znakov.`) =>
    z.preprocess(str, z.string().min(1, required).max(max, tooLong)),
  /** Optional text → undefined when empty. */
  optional: (max = 2000, tooLong = `Največ ${max} znakov.`) =>
    z.preprocess((v) => str(v) || undefined, z.string().max(max, tooLong).optional()),
  /** A required e-mail, lower-cased. */
  email: (message = "Vpišite veljaven e-poštni naslov.") =>
    z.preprocess((v) => str(v).toLowerCase(), z.string().regex(EMAIL, message)),
  /** An optional e-mail → undefined when empty. */
  optionalEmail: (message = "Vpišite veljaven e-poštni naslov.") =>
    z.preprocess((v) => str(v).toLowerCase() || undefined, z.string().regex(EMAIL, message).optional()),
  /** An optional phone → undefined when empty. */
  optionalPhone: (message = "Vpišite veljavno telefonsko številko.") =>
    z.preprocess((v) => str(v) || undefined, z.string().regex(PHONE, message).optional()),
  /** A phone number or an e-mail address (one is required). */
  contact: (message = "Vpišite telefon ali e-poštni naslov.") =>
    z.preprocess(str, z.string().refine((s) => EMAIL.test(s) || PHONE.test(s), message)),
  /** A checkbox → boolean ("on" when ticked). */
  checkbox: () => z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  /** Checkboxes sharing one name → the ticked values (only from `allowed`). */
  many: <T extends string>(allowed: readonly [T, ...T[]]) =>
    z.preprocess((v) => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]), z.array(z.enum(allowed))),
  /** A YYYY-MM-DD date; with `future`, today or later (Ljubljana). */
  date: (message: string, opts: { future?: string; past?: string } = {}) =>
    z.preprocess(
      str,
      z
        .string()
        .regex(ISO_DATE, message)
        .refine((d) => !Number.isNaN(Date.parse(d)), message)
        .refine((d) => !opts.future || d >= today(), opts.future ?? message)
        .refine((d) => !opts.past || d <= today(), opts.past ?? message),
    ),
  /** The same, optional → undefined when empty. */
  optionalDate: (message: string, opts: { future?: string; past?: string } = {}) =>
    z.preprocess((v) => str(v) || undefined, fields.date(message, opts).optional()),
};

// ── FormData ────────────────────────────────────────────────────────────────
/** FormData → object. A key sent more than once (checkboxes) becomes an array. */
export function formValues(fd: FormData | Record<string, unknown>): Record<string, string | string[]> {
  if (!(fd instanceof FormData)) {
    const out: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(fd)) {
      if (Array.isArray(v)) out[k] = v.map(String);
      else if (typeof v === "boolean") out[k] = v ? "on" : "";
      else if (v != null) out[k] = String(v);
    }
    return out;
  }
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}

// ── IP and rate limit ───────────────────────────────────────────────────────
/** The visitor's IP: Cloudflare's header first, then the first X-Forwarded-For hop. */
export function clientIp(h: Headers): string {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || "unknown";
}

const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * Records one hit for `form` from `ip` unless the limit is reached.
 * Returns false when the visitor already sent LIMIT in the window.
 * Rows older than the window are pruned on write.
 */
async function takeHit(dbx: Db, form: string, ip: string): Promise<boolean> {
  const r = schema.rateLimitHits;
  const key = `${form}:${ip}`;
  const since = new Date(now().getTime() - WINDOW_MS);
  await dbx.delete(r).where(lt(r.createdAt, since));
  const recent = await dbx.select({ id: r.id }).from(r).where(and(eq(r.key, key), gte(r.createdAt, since)));
  if (recent.length >= LIMIT) return false;
  await dbx.insert(r).values({ key, createdAt: now() });
  return true;
}

// ── The pipeline ────────────────────────────────────────────────────────────
function firstErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "_");
    out[k] ??= issue.message;
  }
  return out;
}

export async function submitPublicForm<S extends z.ZodType>(opts: {
  /** Short name for the rate limit key, e.g. "verouk", "namen", "zakrament", "newsletter". */
  form: string;
  schema: S;
  data: FormData | Record<string, unknown>;
  /** What a bot that filled the honeypot is told (the normal thank-you text). */
  thanks: string;
  /** Store and mail. Runs only for valid, non-spam submissions within the limit. */
  handle: (data: z.output<S>) => Promise<FormResult>;
  /** Defaults to the current request's IP (next/headers). */
  ip?: string;
  dbx?: Db;
}): Promise<FormResult> {
  const values = formValues(opts.data);
  if (str(values.website)) return { ok: true, message: opts.thanks };
  delete values.website;

  const parsed = opts.schema.safeParse(values);
  if (!parsed.success) return { ok: false, message: CHECK_FIELDS, fieldErrors: firstErrors(parsed.error), values };

  const ip = opts.ip ?? clientIp(await (await import("next/headers")).headers());
  if (!(await takeHit(opts.dbx ?? defaultDb, opts.form, ip))) {
    return { ok: false, message: TOO_MANY, fieldErrors: {}, values, status: 429 };
  }

  const res = await opts.handle(parsed.data);
  return res.ok ? res : { ...res, values: res.values ?? values };
}
