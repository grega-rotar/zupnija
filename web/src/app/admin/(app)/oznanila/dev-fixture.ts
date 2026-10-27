/**
 * DEVELOPMENT ONLY: deterministic bulletin reads for browser checks.
 *
 * Uploading a file whose name starts with "primer-" (never in production)
 * makes the next Claude run for that week return a fixture after ~4 s
 * instead of spawning claude-pool:
 *
 *   primer-*nejasn*      → fixtures/extract-unreadable.json (status unreadable)
 *   primer-*zased*       → AiBusyError (status ai_busy)
 *   primer-*.pdf         → fixtures/extract-pdf.json
 *   any other primer-*   → fixtures/extract-rokopis.json
 *
 * It swaps runClaude with setRunClaude only while such a read is pending and
 * restores the real one right after; other calls meanwhile use the real one.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AiBusyError, runClaude, setRunClaude, type RunClaudeOptions, type RunClaudeResult } from "@/lib/ai/runClaude";

type Fixture = "rokopis" | "pdf" | "unreadable" | "busy";
const pending = new Map<string, Fixture>();

const fixtureFor = (name: string): Fixture => {
  const n = name.toLowerCase();
  if (n.includes("nejasn")) return "unreadable";
  if (n.includes("zased")) return "busy";
  if (n.endsWith(".pdf")) return "pdf";
  return "rokopis";
};

async function fake(o: RunClaudeOptions): Promise<RunClaudeResult> {
  const week = [...pending.keys()].find((w) => o.prompt.includes(`for the week ${w} `));
  if (!week) {
    // Not ours (e.g. the assistant): the real implementation.
    setRunClaude(null);
    try {
      return await runClaude(o);
    } finally {
      if (pending.size) setRunClaude(fake);
    }
  }
  const fixture = pending.get(week)!;
  pending.delete(week);
  if (!pending.size) setRunClaude(null);
  await new Promise((r) => setTimeout(r, 4000));
  if (fixture === "busy") throw new AiBusyError();
  const file = { rokopis: "extract-rokopis.json", pdf: "extract-pdf.json", unreadable: "extract-unreadable.json" }[fixture];
  const text = await readFile(path.join(process.cwd(), "src/lib/bulletin/fixtures", file), "utf8");
  return { text, account: "dev-fixture", durationMs: 4000 };
}

/** Call before startBulletin. Does nothing in production or for other file names. */
export function armDevFixture(fileName: string, weekStart: string): void {
  if (process.env.NODE_ENV === "production" || !fileName.startsWith("primer-")) return;
  pending.set(weekStart, fixtureFor(fileName));
  setRunClaude(fake);
}
