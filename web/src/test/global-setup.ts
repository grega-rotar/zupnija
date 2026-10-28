/** Create the test database if needed and push the current schema to it. */
import { execFileSync } from "node:child_process";
import postgres from "postgres";

export default async function setup() {
  const base = process.env.TEST_DATABASE_BASE ?? "postgres://zupnija:dev@localhost:5433";
  const name = process.env.TEST_DB ?? "zupnija_test";
  const admin = postgres(`${base}/postgres`, { max: 1, onnotice: () => {} });
  const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
  if (!exists) await admin.unsafe(`create database "${name}"`);
  await admin.end();
  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    env: { ...process.env, DATABASE_URL: `${base}/${name}` },
    stdio: "pipe",
  });
}
