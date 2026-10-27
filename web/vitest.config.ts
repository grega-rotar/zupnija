import path from "node:path";
import { defineConfig } from "vitest/config";

// Each parallel worker can use its own database: TEST_DB=zupnija_test_teden npm test
const testDb = process.env.TEST_DB ?? "zupnija_test";
const base = process.env.TEST_DATABASE_BASE ?? "postgres://zupnija:dev@localhost:5433";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    setupFiles: ["src/test/setup.ts"],
    env: { DATABASE_URL: `${base}/${testDb}`, TEST_NOW: "2026-10-27T10:00:00+01:00", TEST_DB: testDb, TEST_DATABASE_BASE: base },
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
