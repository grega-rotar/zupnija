import { eq } from "drizzle-orm";
import { schema, type Db, type Tx } from "@/db";
import type { Actor, Section } from "./sections";

/** Load a user and their sections as an Actor; null if missing or disabled. */
export async function loadActor(db: Db | Tx, userId: string): Promise<Actor | null> {
  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, userId));
  if (!u || u.disabledAt) return null;
  const secs = await db.select().from(schema.userSections).where(eq(schema.userSections.userId, userId));
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    title: u.title,
    short: u.short,
    isOwner: u.isOwner,
    requiresApproval: u.requiresApproval,
    bigText: u.bigText,
    sections: secs.map((s) => s.section as Section),
  };
}
