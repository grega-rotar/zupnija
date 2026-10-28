/**
 * "Navodila za branje oznanil": the parish's own hints for reading its
 * bulletin, plain text the owner edits (app_settings key
 * "bulletin.readingHints"). They go into the prompt as hints, not rules, so a
 * change of the bulletin's format needs no code change: the priest describes
 * the new layout here.
 *
 *   getReadingHints()                  the saved text, else DEFAULT_READING_HINTS
 *   setReadingHints(actor, text)       engine action "settings.readingHints" (owner only, in history, undoable)
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db, type Tx } from "@/db";
import { defineAction, perform, type PerformResult } from "@/lib/admin/engine";
import { ForbiddenError } from "@/lib/admin/errors";
import type { Actor } from "@/lib/admin/sections";
import { now } from "@/lib/clock";

export const READING_HINTS_KEY = "bulletin.readingHints";
export const READING_HINTS_MAX = 4000;

/** The conventions of the parish's bulletin as of October 2026. */
export const DEFAULT_READING_HINTS = [
  "Oznanila izidejo enkrat na mesec (zloženka A4). Koledar ima za vsak dan svojo vrstico: datum, godovnjak ali liturgični dan, skupine z velikimi črkami (npr. MLADINSKA SK., ŽPS) in mašni namen.",
  "Ure maš v koledarju niso napisane; veljajo redne ure maš.",
  "Ob nedeljah je prva vrstica namenov za mašo ob 8.00 (Sv. Križ), druga za 10.00 (Marijina cerkev). V drugi nedeljski vrstici je tudi evangelij v ležečem tisku.",
  "Sobotna maša ob 18.30 je nedeljska maša na predvečer, njen namen je v sobotni vrstici.",
  "Vrstice koledarja so lahko razdeljene na dve strani; prvi dnevi meseca so včasih natisnjeni na koncu.",
  "Srečanja (ŽPS, Karitas, zakonske skupine, romanje, češčenje …) so napisana med obvestili, pogosto v obarvanih vrsticah.",
].join("\n");

export async function getReadingHints(dbx: Db | Tx = defaultDb): Promise<string> {
  const [row] = await dbx.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, READING_HINTS_KEY));
  return row?.value ?? DEFAULT_READING_HINTS;
}

const hintsSchema = z.object({ text: z.string().trim().max(READING_HINTS_MAX, `Navodila so predolga (največ ${READING_HINTS_MAX} znakov).`) });
type HintsPayload = z.output<typeof hintsSchema>;

export const readingHintsAction = defineAction<HintsPayload>({
  name: "settings.readingHints",
  area: "oznanila",
  approvable: false,
  schema: hintsSchema,
  label: () => "Navodila za branje oznanil",
  apply: async (p, { actor, track, tx }) => {
    if (!actor.isOwner) throw new ForbiddenError();
    const values = { value: p.text, updatedAt: now(), updatedBy: actor.id };
    const [old] = await tx.select().from(schema.appSettings).where(eq(schema.appSettings.key, READING_HINTS_KEY));
    if (old) await track.update("app_settings", READING_HINTS_KEY, values);
    else await track.insert("app_settings", { key: READING_HINTS_KEY, ...values });
  },
  tags: [],
});

/** Save the hints (owner only; an empty text means "no hints"). */
export async function setReadingHints(actor: Actor, text: string, dbx: Db = defaultDb): Promise<PerformResult> {
  if (!actor.isOwner) throw new ForbiddenError();
  return perform(actor, "settings.readingHints", { text }, dbx);
}
