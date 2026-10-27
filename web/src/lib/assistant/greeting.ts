/**
 * The assistant's opening line and suggestion chips (prototype greet() and
 * suggestions()), computed from the database for this person.
 */
import "server-only";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { can, needsApproval, type Actor } from "@/lib/admin/sections";
import { today, weekStart } from "@/lib/clock";
import { addDays } from "@/lib/dates";

/** Slovenian number forms: [1, 2, 3–4, 5+] by the last two digits. */
export function pl(n: number, forms: [string, string, string, string]): string {
  const k = n % 100;
  return `${n} ${forms[k === 1 ? 0 : k === 2 ? 1 : k === 3 || k === 4 ? 2 : 3]}`;
}
const MAS: [string, string, string, string] = ["maša", "maši", "maše", "maš"];
const WAITING: [string, string, string, string] = ["sprememba čaka", "spremembi čakata", "spremembe čakajo", "sprememb čaka"];

export const firstName = (name: string) => name.replace(/^(msgr\.\s*)?(dr\.\s*)?/i, "").split(" ")[0];

export async function greeting(actor: Actor, dbx: Db = defaultDb): Promise<string> {
  const first = firstName(actor.name);
  if (!can(actor, "mase")) {
    if (can(actor, "verouk")) return `Pozdravljeni, ${first}. Pri verouku vam lahko odpovem uro ali pripravim sporočilo staršem.`;
    const what = [can(actor, "oznanila") && "naložim oznanila", can(actor, "dogodki") && "dodam dogodek"].filter(Boolean).join(" ali ");
    return `Pozdravljeni, ${first}.${what ? ` Lahko vam ${what}.` : ""}`;
  }

  const mon = weekStart(today());
  const m = schema.masses;
  const live = await dbx
    .select({ id: m.id })
    .from(m)
    .where(and(gte(m.date, mon), lte(m.date, addDays(mon, 6)), ne(m.status, "cancelled")));
  const ids = live.map((r) => r.id);
  const withIntention = ids.length
    ? new Set((await dbx.selectDistinct({ id: schema.intentions.massId }).from(schema.intentions).where(inArray(schema.intentions.massId, ids))).map((r) => r.id))
    : new Set<number>();
  const empty = ids.filter((id) => !withIntention.has(id)).length;

  let t = `${actor.isOwner ? "Dober dan." : `Dober dan, ${first}.`} Ta teden je ${pl(ids.length, MAS)}`;
  if (empty) t += `, brez namena ${empty === 1 ? "je še ena" : `jih je še ${empty}`}`;
  t += ".";
  if (actor.isOwner) {
    const pending = await dbx.select({ id: schema.changeRequests.id }).from(schema.changeRequests).where(eq(schema.changeRequests.status, "pending"));
    if (pending.length) t += ` ${pl(pending.length, WAITING)} vašo potrditev.`;
  }
  if (needsApproval(actor)) t += " Vse, kar spremenite, pred objavo pregleda župnik.";
  return t;
}

export async function suggestions(actor: Actor, dbx: Db = defaultDb): Promise<string[]> {
  const out: string[] = [];
  if (can(actor, "mase")) out.push("Odpovej mašo v sredo", "Dodaj namen za Jožeta Novaka v nedeljo ob 8h", "Kaj je ta teden?");
  if (can(actor, "oznanila")) out.push("Naloži oznanila");
  if (!can(actor, "mase") && can(actor, "verouk")) {
    const [g] = await dbx
      .select({ name: schema.catechesisGroups.name, weekday: schema.catechesisGroups.weekday })
      .from(schema.catechesisGroups)
      .orderBy(asc(schema.catechesisGroups.position), asc(schema.catechesisGroups.id))
      .limit(1);
    const day = ["nedeljo", "ponedeljek", "torek", "sredo", "četrtek", "petek", "soboto"];
    out.push(g ? `Odpovej verouk za ${g.name} v ${day[g.weekday]}` : "Odpovej verouk", "Kaj je ta teden?");
  }
  if (!can(actor, "mase") && can(actor, "dogodki")) out.push("Dodaj dogodek");
  return out;
}
