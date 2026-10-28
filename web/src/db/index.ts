import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// One pool per process; Next dev reloads modules, so keep it on globalThis.
const g = globalThis as unknown as { __zupnijaSql?: ReturnType<typeof postgres> };
const client = (g.__zupnijaSql ??= postgres(url, { max: 10 }));

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
