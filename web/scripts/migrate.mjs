// Applies the drizzle-kit migrations in web/drizzle/ and exits. The Docker image runs it before
// the server starts (web/Dockerfile), so drizzle-kit itself isn't needed at runtime.
// Locally: `DATABASE_URL=postgres://zupnija:dev@localhost:5433/zupnija node scripts/migrate.mjs`.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

const folder = process.env.MIGRATIONS_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
if (!existsSync(path.join(folder, "meta", "_journal.json"))) {
  console.warn(`migrate: no migrations in ${folder}, nothing to do`);
  process.exit(0);
}

// The db container can still be starting after a host reboot; retry the first connection for ~60 s.
const sql = postgres(url, { max: 1, onnotice: () => {} });
for (let i = 1; ; i++) {
  try {
    await sql`select 1`;
    break;
  } catch (e) {
    if (i >= 30) {
      console.error(`migrate: can't reach the database: ${e.message}`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

try {
  await migrate(drizzle(sql), { migrationsFolder: folder });
  console.log("migrate: database is up to date");
} catch (e) {
  console.error("migrate: failed:", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
