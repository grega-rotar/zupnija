/** People for the owner's "Ljudje in dostop" screen. */
import { isNull } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { SECTIONS, type Section } from "@/lib/admin/sections";

export type Person = {
  id: string;
  name: string;
  email: string;
  title: string;
  short: string;
  isOwner: boolean;
  /** The owner has every section. */
  sections: Section[];
  requiresApproval: boolean;
  /** Invitation sent, never signed in ("povabilo poslano, še ni prijavljen"). */
  invited: boolean;
  invitedAt: Date | null;
  lastSeenAt: Date | null;
};

/** Everyone with access (disabled users left out): the owner first, then by name. */
export async function listPeople(dbx: Db = defaultDb): Promise<Person[]> {
  const users = await dbx.select().from(schema.user).where(isNull(schema.user.disabledAt));
  const secs = await dbx.select().from(schema.userSections);
  const order = (s: Section) => SECTIONS.indexOf(s);
  return users
    .map(
      (x): Person => ({
        id: x.id,
        name: x.name,
        email: x.email,
        title: x.title,
        short: x.short,
        isOwner: x.isOwner,
        sections: x.isOwner
          ? [...SECTIONS]
          : secs
              .filter((s) => s.userId === x.id)
              .map((s) => s.section as Section)
              .sort((a, b) => order(a) - order(b)),
        requiresApproval: !x.isOwner && x.requiresApproval,
        invited: x.invitedAt != null && x.lastSeenAt == null,
        invitedAt: x.invitedAt,
        lastSeenAt: x.lastSeenAt,
      }),
    )
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name, "sl"));
}

/** One person with access, or null (missing or disabled). */
export async function getPerson(id: string, dbx: Db = defaultDb): Promise<Person | null> {
  return (await listPeople(dbx)).find((p) => p.id === id) ?? null;
}
