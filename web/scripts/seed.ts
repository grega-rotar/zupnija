/**
 * Dev seed: wipe every table in DATABASE_URL and load the PRD §10 parish data.
 *
 *   npm run db:push && npm run db:seed
 *
 * Builds its own drizzle client instead of importing "@/db", which is
 * "server-only" and refuses to load outside Next.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import type { Db } from "../src/db";
import { seedParish } from "../src/test/seed";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed: NODE_ENV=production.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Db;
  try {
    await db.transaction(async (tx) => {
      const rows = await tx.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
      const names = rows.map((r) => `"${r.tablename}"`).join(", ");
      if (names) await tx.execute(sql.raw(`truncate ${names} restart identity cascade`));
      const s = await seedParish(tx);
      console.log(`Seeded: ${Object.keys(s.masses).length} maš, 5 uporabnikov, 2 spremembi čakata potrditev.`);
    });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
