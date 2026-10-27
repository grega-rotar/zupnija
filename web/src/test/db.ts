/** Test helpers: wipe every table, and create users quickly. */
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Actor, Section } from "@/lib/admin/sections";

export async function resetDb(): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
}

export async function makeUser(
  id: string,
  opts: { name?: string; isOwner?: boolean; requiresApproval?: boolean; sections?: Section[]; title?: string } = {},
): Promise<Actor> {
  const name = opts.name ?? id;
  const sections = opts.sections ?? [];
  await db.insert(schema.user).values({
    id,
    name,
    email: `${id}@example.com`,
    emailVerified: true,
    title: opts.title ?? (opts.isOwner ? "Župnik" : "Sodelavec"),
    short: name.slice(0, 2).toUpperCase(),
    isOwner: opts.isOwner ?? false,
    requiresApproval: opts.requiresApproval ?? false,
  });
  if (sections.length) await db.insert(schema.userSections).values(sections.map((section) => ({ userId: id, section })));
  return {
    id,
    name,
    email: `${id}@example.com`,
    title: opts.title ?? "",
    short: "",
    isOwner: opts.isOwner ?? false,
    requiresApproval: opts.requiresApproval ?? false,
    bigText: false,
    sections,
  };
}
