/**
 * Mass-intention requests (US-007): a visitor asks on /masni-nameni/prosnja,
 * the parish gets one mail, and the request waits in the editor (Maše in
 * nameni → Prošnje).
 *
 * Converting goes through the existing `intention.add` action with
 * `requestId` (src/lib/mase/actions.ts): it inserts the intention and marks the
 * request done in one history row, so approval rules and undo apply as for
 * any intention. Declining is `intentionRequest.decline` here.
 */
import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db, type Tx } from "@/db";
import { defineAction } from "@/lib/admin/engine";
import { UserError } from "@/lib/admin/errors";
import { now } from "@/lib/clock";
import { formatDate } from "@/lib/dates";
import { mailParish } from "@/lib/forms/parish";
import { fields, submitPublicForm, type FormResult } from "@/lib/forms/public";
import type { IntentionKind } from "./format";

const r = schema.intentionRequests;

// ── The public form ─────────────────────────────────────────────────────────
export const intentionRequestSchema = z.object({
  name: fields.text("Vpišite svoje ime.", 120),
  contact: fields.contact(),
  text: fields.text("Vpišite, za koga naj se daruje maša.", 200, "Namen je predolg (največ 200 znakov)."),
  date: fields.optionalDate("Datum ni pravilen.", { future: "Izberite datum v prihodnosti." }),
  church: fields.optional(80),
  note: fields.optional(1000),
});

export const INTENTION_THANKS = "Hvala, prošnja je oddana. Župnik vas bo poklical ali vam pisal.";

export async function submitIntentionRequest(data: FormData | Record<string, unknown>, opts: { ip?: string; dbx?: Db } = {}): Promise<FormResult> {
  const dbx = opts.dbx ?? defaultDb;
  return submitPublicForm({
    form: "namen",
    schema: intentionRequestSchema,
    data,
    thanks: INTENTION_THANKS,
    ip: opts.ip,
    dbx,
    handle: async (p) => {
      const church = p.church
        ? (await dbx.select().from(schema.churches).where(eq(schema.churches.slug, p.church)))[0] ?? null
        : null;
      await dbx.insert(r).values({
        name: p.name,
        contact: p.contact,
        text: p.text,
        preferredDate: p.date ?? null,
        churchSlug: church?.slug ?? null,
        note: p.note ?? null,
        createdAt: now(),
      });
      await mailParish(
        `Prošnja za mašni namen: ${p.text}`,
        [
          ["Namen", p.text],
          ["Želeni datum", p.date ? formatDate(p.date) : "ni naveden"],
          ["Cerkev", church?.shortName],
          ["Ime", p.name],
          ["Kontakt", p.contact],
        ],
        [p.note, "Prošnjo vpišete kot namen v urejevalniku: Maše in nameni → Prošnje."].filter(Boolean).join("\n\n"),
      );
      return { ok: true, message: INTENTION_THANKS };
    },
  });
}

// ── Reading (editor) ────────────────────────────────────────────────────────
export type IntentionRequestView = {
  id: number;
  name: string;
  contact: string;
  text: string;
  preferredDate: string | null;
  churchSlug: string | null;
  church: string | null;
  note: string | null;
  createdAt: string;
  /** A helper's conversion waiting for the priest (change request id). */
  pendingBy: string | null;
};

/** New requests, oldest first, with any conversion that waits for approval. */
export async function listIntentionRequests(dbx: Db = defaultDb): Promise<IntentionRequestView[]> {
  const rows = await dbx
    .select({ req: r, church: schema.churches.shortName })
    .from(r)
    .leftJoin(schema.churches, eq(schema.churches.slug, r.churchSlug))
    .where(eq(r.status, "new"))
    .orderBy(asc(r.createdAt), asc(r.id));
  const cr = schema.changeRequests;
  const pend = rows.length
    ? await dbx
        .select({ requestId: sql<number>`(${cr.payload}->>'requestId')::int`, name: schema.user.name })
        .from(cr)
        .innerJoin(schema.user, eq(schema.user.id, cr.createdBy))
        .where(
          and(
            eq(cr.status, "pending"),
            eq(cr.action, "intention.add"),
            inArray(sql`(${cr.payload}->>'requestId')::int`, rows.map((x) => x.req.id)),
          ),
        )
    : [];
  return rows.map(({ req, church }) => ({
    id: req.id,
    name: req.name,
    contact: req.contact,
    text: req.text,
    preferredDate: req.preferredDate,
    churchSlug: req.churchSlug,
    church,
    note: req.note,
    createdAt: req.createdAt.toISOString(),
    pendingBy: pend.find((p) => p.requestId === req.id)?.name ?? null,
  }));
}

export async function countNewIntentionRequests(dbx: Db = defaultDb): Promise<number> {
  const [row] = await dbx.select({ n: sql<number>`count(*)::int` }).from(r).where(eq(r.status, "new"));
  return row?.n ?? 0;
}

/** Recently decided requests (for the "Obravnavane" list). */
export async function listDecidedIntentionRequests(limit = 10, dbx: Db = defaultDb) {
  return dbx
    .select()
    .from(r)
    .where(inArray(r.status, ["done", "declined"]))
    .orderBy(desc(r.decidedAt), desc(r.id))
    .limit(limit);
}

/**
 * The prefill for "Vpiši kot namen": the visitor's text without a leading
 * cross (the kind says it), and the kind guessed from it.
 */
export function intentionPrefill(text: string): { text: string; kind: IntentionKind } {
  const t = text.trim();
  if (/^[+†✝]/.test(t)) return { text: t.replace(/^[+†✝]\s*/, ""), kind: "deceased" };
  if (/zahval/i.test(t)) return { text: t, kind: "thanksgiving" };
  return { text: t, kind: "other" };
}

/** For intention.add's check: the request exists and nobody has dealt with it yet. */
export async function openIntentionRequest(tx: Tx, id: number) {
  const [row] = await tx.select().from(r).where(eq(r.id, id));
  if (!row) throw new UserError("Te prošnje ni več.");
  if (row.status !== "new") throw new UserError("Ta prošnja je že obravnavana.");
  return row;
}

// ── intentionRequest.decline ────────────────────────────────────────────────
export const declineIntentionRequest = defineAction({
  name: "intentionRequest.decline",
  area: "mase",
  // A plain status flip: no approval needed, but it is in Zgodovina and can be undone.
  approvable: false,
  schema: z.object({
    requestId: z.number().int(),
    note: z.string().trim().max(500, "Največ 500 znakov.").optional(),
  }),
  label: async (p, tx) => {
    const [row] = await tx.select().from(r).where(eq(r.id, p.requestId));
    return `Zavrnjena prošnja za namen: ${row?.text ?? ""}`.trim();
  },
  check: async (p, tx) => {
    await openIntentionRequest(tx, p.requestId);
  },
  apply: (p, { track, actor }) =>
    track.update("intention_requests", p.requestId, {
      status: "declined",
      declineNote: p.note || null,
      decidedBy: actor.id,
      decidedAt: now(),
    }),
  tags: [],
});
