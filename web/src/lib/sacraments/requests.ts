/**
 * Sacrament enquiries (US-008): a visitor sends one from
 * /zakramenti/povprasevanje (each sacrament page links there with its kind),
 * the parish gets a mail, and the enquiry waits on editor Domov until someone
 * marks it resolved (`sacramentRequest.resolve`, area "zupnija").
 */
import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db, type Tx } from "@/db";
import { defineAction } from "@/lib/admin/engine";
import { UserError } from "@/lib/admin/errors";
import { now } from "@/lib/clock";
import { formatDate } from "@/lib/dates";
import { mailParish } from "@/lib/forms/parish";
import { fields, submitPublicForm, type FormResult } from "@/lib/forms/public";
import { SACRAMENT_KINDS, kindLabel, type SacramentKind } from "./kinds";

const r = schema.sacramentRequests;

export const sacramentRequestSchema = z.object({
  // "bolniško_maziljenje" (the PRD's spelling) is accepted and stored without the caron.
  kind: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace("š", "s") : v),
    z.enum(SACRAMENT_KINDS, { error: "Izberite, za kaj sprašujete." }),
  ),
  name: fields.text("Vpišite svoje ime.", 120),
  contact: fields.contact(),
  date: fields.optionalDate("Datum ni pravilen.", { future: "Izberite datum v prihodnosti." }),
  message: fields.text("Na kratko opišite, kaj želite.", 4000),
});

export const SACRAMENT_THANKS = "Hvala, povpraševanje je oddano. Oglasili se vam bomo, kakor hitro bo mogoče.";

export async function submitSacramentRequest(data: FormData | Record<string, unknown>, opts: { ip?: string; dbx?: Db } = {}): Promise<FormResult> {
  const dbx = opts.dbx ?? defaultDb;
  return submitPublicForm({
    form: "zakrament",
    schema: sacramentRequestSchema,
    data,
    thanks: SACRAMENT_THANKS,
    ip: opts.ip,
    dbx,
    handle: async (p) => {
      await dbx.insert(r).values({
        kind: p.kind,
        name: p.name,
        contact: p.contact,
        preferredDate: p.date ?? null,
        message: p.message,
        createdAt: now(),
      });
      await mailParish(
        `Povpraševanje: ${kindLabel(p.kind)} · ${p.name}`,
        [
          ["Za", kindLabel(p.kind)],
          ["Ime", p.name],
          ["Kontakt", p.contact],
          ["Želeni datum", p.date ? formatDate(p.date) : null],
        ],
        p.message,
      );
      return { ok: true, message: SACRAMENT_THANKS };
    },
  });
}

// ── Reading (editor Domov) ──────────────────────────────────────────────────
export type SacramentRequestView = {
  id: number;
  kind: SacramentKind;
  name: string;
  contact: string;
  preferredDate: string | null;
  message: string;
  createdAt: string;
};

export async function listOpenSacramentRequests(dbx: Db = defaultDb): Promise<SacramentRequestView[]> {
  const rows = await dbx.select().from(r).where(eq(r.status, "new")).orderBy(asc(r.createdAt), asc(r.id));
  return rows.map((x) => ({
    id: x.id,
    kind: x.kind as SacramentKind,
    name: x.name,
    contact: x.contact,
    preferredDate: x.preferredDate,
    message: x.message,
    createdAt: x.createdAt.toISOString(),
  }));
}

export async function countOpenSacramentRequests(dbx: Db = defaultDb): Promise<number> {
  const [row] = await dbx.select({ n: sql<number>`count(*)::int` }).from(r).where(eq(r.status, "new"));
  return row?.n ?? 0;
}

async function openRequest(tx: Tx, id: number) {
  const [row] = await tx.select().from(r).where(eq(r.id, id));
  if (!row) throw new UserError("Tega povpraševanja ni več.");
  if (row.status !== "new") throw new UserError("To povpraševanje je že rešeno.");
  return row;
}

// ── sacramentRequest.resolve ────────────────────────────────────────────────
export const resolveSacramentRequest = defineAction({
  name: "sacramentRequest.resolve",
  area: "zupnija",
  approvable: false,
  schema: z.object({ requestId: z.number().int() }),
  label: async (p, tx) => {
    const [row] = await tx.select().from(r).where(eq(r.id, p.requestId));
    return row ? `Rešeno povpraševanje: ${kindLabel(row.kind)} · ${row.name}` : "Rešeno povpraševanje";
  },
  check: async (p, tx) => {
    await openRequest(tx, p.requestId);
  },
  apply: (p, { track, actor }) => track.update("sacrament_requests", p.requestId, { status: "done", resolvedBy: actor.id, resolvedAt: now() }),
  tags: [],
});
