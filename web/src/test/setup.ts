import { afterAll } from "vitest";

afterAll(async () => {
  const g = globalThis as unknown as { __zupnijaSql?: { end: () => Promise<void> } };
  await g.__zupnijaSql?.end();
  g.__zupnijaSql = undefined;
});
