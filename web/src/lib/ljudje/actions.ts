/**
 * People and access (area "ljudje", owner only): invite a helper, change what
 * they may edit, or take their access away. Never queued for approval.
 *
 * person.invite creates the user inside the change; the invitation e-mail is
 * sent after the transaction commits, so pages call `invitePerson` (not bare
 * perform).
 */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db, type Tx } from "@/db";
import { defineAction, perform, type PerformResult } from "@/lib/admin/engine";
import { UserError } from "@/lib/admin/errors";
import { SECTION_LABEL, SECTIONS, type Actor, type Section } from "@/lib/admin/sections";
import { now } from "@/lib/clock";
import { sendMail } from "@/lib/mail";

const u = schema.user;
const sectionList = z.array(z.enum(SECTIONS)).transform((s) => [...new Set(s)] as Section[]);

async function loadUser(tx: Tx, id: string) {
  const [row] = await tx.select().from(u).where(eq(u.id, id));
  if (!row || row.disabledAt) throw new UserError("Te osebe ni več med sodelavci.");
  return row;
}

/** Avatar initials: "Petra Kovač" → "PK"; titles like "msgr." are skipped. */
export function initials(name: string): string {
  const all = name.trim().split(/\s+/).filter(Boolean);
  const words = all.filter((w) => !w.endsWith("."));
  return (words.length ? words : all)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Origin of the editor, e.g. https://admin.zupnija-pirnice.si (same rule as lib/auth.ts). */
function adminOrigin(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  if (process.env.ADMIN_HOST) return `https://${process.env.ADMIN_HOST}`;
  return "http://admin.localhost:3000";
}

// ── person.invite ───────────────────────────────────────────────────────────
export const personInviteSchema = z.object({
  name: z.string({ error: "Vpišite ime." }).trim().min(1, "Vpišite ime.").max(120, "Največ 120 znakov."),
  email: z
    .string({ error: "Vpišite e-poštni naslov." })
    .trim()
    .toLowerCase()
    .pipe(z.email("Vpišite veljaven e-poštni naslov.")),
  title: z.string().trim().max(60, "Največ 60 znakov.").optional(),
  sections: sectionList.refine((s) => s.length > 0, "Izberite vsaj en razdelek."),
  requiresApproval: z.boolean(),
});
export type PersonInvitePayload = z.input<typeof personInviteSchema>;

export const inviteAction = defineAction({
  name: "person.invite",
  area: "ljudje",
  approvable: false,
  schema: personInviteSchema,
  label: (p) => `Povabilo: ${p.name}`,
  check: async (p, tx) => {
    const [row] = await tx.select({ id: u.id }).from(u).where(eq(sql`lower(${u.email})`, p.email));
    if (row) throw new UserError("Ta oseba že ima dostop.");
  },
  apply: async (p, { track }) => {
    const row = await track.insert("user", {
      id: randomUUID(),
      name: p.name,
      email: p.email,
      emailVerified: false,
      title: p.title || "Sodelavec",
      short: initials(p.name),
      isOwner: false,
      requiresApproval: p.requiresApproval,
      invitedAt: now(),
    });
    await track.setSections(row.id, p.sections);
    return { userId: row.id };
  },
  tags: ["people"],
});

/** The invitation e-mail (Slovenian), with a link to the editor's sign-in page. */
export function inviteMail(inviter: string, p: { name: string; email: string; sections: Section[] }) {
  const link = `${adminOrigin()}/prijava`;
  const what = p.sections.map((s) => SECTION_LABEL[s]).join(", ");
  return {
    to: p.email,
    subject: "Povabilo k urejanju župnijske spletne strani",
    text: [
      `Pozdravljeni, ${p.name}!`,
      "",
      `${inviter} vas vabi, da pomagate urejati spletno stran župnije.`,
      `Urejali boste: ${what}.`,
      "",
      "Za prijavo odprite spodnjo povezavo in vpišite ta e-poštni naslov. Poslali vam bomo povezavo za vstop, gesla ne potrebujete.",
      link,
      "",
      "Lep pozdrav",
    ].join("\n"),
  };
}

// ── person.update ───────────────────────────────────────────────────────────
export const personUpdateSchema = z.object({
  userId: z.string().min(1),
  sections: sectionList,
  requiresApproval: z.boolean(),
});
export type PersonUpdatePayload = z.input<typeof personUpdateSchema>;

export const updateAccessAction = defineAction({
  name: "person.update",
  area: "ljudje",
  approvable: false,
  schema: personUpdateSchema,
  label: async (p, tx) => `Dostop za ${(await loadUser(tx, p.userId)).name}`,
  check: async (p, tx) => {
    if ((await loadUser(tx, p.userId)).isOwner) throw new UserError("Župnik ureja vse. Njegovega dostopa ni mogoče spreminjati.");
  },
  apply: async (p, { track }) => {
    await track.setSections(p.userId, p.sections);
    await track.update("user", p.userId, { requiresApproval: p.requiresApproval });
  },
  tags: ["people"],
});

// ── person.revoke ───────────────────────────────────────────────────────────
export const revokeAction = defineAction({
  name: "person.revoke",
  area: "ljudje",
  approvable: false,
  schema: z.object({ userId: z.string().min(1) }),
  label: async (p, tx) => {
    const [row] = await tx.select({ name: u.name }).from(u).where(eq(u.id, p.userId));
    return `Odvzet dostop: ${row?.name ?? p.userId}`;
  },
  check: async (p, tx) => {
    if ((await loadUser(tx, p.userId)).isOwner) throw new UserError("Župniku ni mogoče odvzeti dostopa.");
  },
  apply: async (p, { track, tx }) => {
    await track.update("user", p.userId, { disabledAt: now() });
    // Sessions are not tracked: after an undo the person simply signs in again.
    await tx.delete(schema.session).where(eq(schema.session.userId, p.userId));
  },
  tags: ["people"],
});

// ── Entry points for pages ──────────────────────────────────────────────────
/** Invite a helper, then (after the commit) e-mail them the sign-in link. */
export async function invitePerson(
  actor: Actor,
  payload: PersonInvitePayload,
  dbx: Db = defaultDb,
): Promise<PerformResult & { mailed: boolean }> {
  const r = await perform(actor, "person.invite", payload, dbx);
  const p = personInviteSchema.parse(payload);
  const sent = await sendMail(inviteMail(actor.name, p));
  if (!sent.ok) console.error("[ljudje] povabila ni bilo mogoče poslati", p.email, sent.error);
  return { ...r, mailed: sent.ok };
}

export const updateAccess = (actor: Actor, payload: PersonUpdatePayload, dbx: Db = defaultDb) =>
  perform(actor, "person.update", payload, dbx);
export const revokeAccess = (actor: Actor, userId: string, dbx: Db = defaultDb) =>
  perform(actor, "person.revoke", { userId }, dbx);
