/**
 * DEVELOPMENT ONLY: deterministic bulletin reads for browser checks.
 *
 * Uploading a file whose name starts with "primer-" (never in production)
 * makes the next bulletin read return a fixture after ~4 s instead of
 * spawning claude-pool. The fixture is the model's reply; the server still
 * assigns Masses and checks the schedule as for a real read.
 *
 *   primer-*nejasn*   → status unreadable
 *   primer-*zased*    → AiBusyError (status ai_busy, "Claude je zdaj zaseden")
 *   primer-*napak*    → a crash (status ai_busy with an error: "ne deluje")
 *   primer-*oznake*   → the hand-made October booklet with flags to check
 *                       (components/admin/oznanila/dev-fixtures/extract-oktober-2026.json)
 *   any other primer- → the October 2026 booklet (lib/bulletin/fixtures/extract-oktober-2026.json
 *                       when the backend's canonical one exists, else the hand-made one here)
 *
 * It swaps runClaude with setRunClaude only while such a read is pending and
 * restores the real one right after; other calls (e.g. the assistant) use the real one.
 */
import "server-only";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { AiBusyError, runClaude, setRunClaude, type RunClaudeOptions, type RunClaudeResult } from "@/lib/ai/runClaude";

type Fixture = "month" | "flags" | "unreadable" | "busy" | "crash";
const pending: Fixture[] = [];

const fixtureFor = (name: string): Fixture => {
  const n = name.toLowerCase();
  if (n.includes("nejasn")) return "unreadable";
  if (n.includes("zased")) return "busy";
  if (n.includes("napak")) return "crash";
  if (n.includes("oznake")) return "flags";
  return "month";
};

/** A bulletin read (prompt.ts buildPrompt), not the assistant or anything else. */
const isBulletinRead = (o: RunClaudeOptions) => /bulletin \("oznanila"\)/.test(o.prompt);

const MINE = "src/components/admin/oznanila/dev-fixtures/extract-oktober-2026.json";

async function monthFixture(): Promise<string> {
  const canonical = path.join(process.cwd(), "src/lib/bulletin/fixtures/extract-oktober-2026.json");
  const mine = path.join(process.cwd(), MINE);
  const file = await access(canonical).then(
    () => canonical,
    () => mine,
  );
  return readFile(file, "utf8");
}

async function fake(o: RunClaudeOptions): Promise<RunClaudeResult> {
  if (!isBulletinRead(o) || !pending.length) {
    setRunClaude(null);
    try {
      return await runClaude(o);
    } finally {
      if (pending.length) setRunClaude(fake);
    }
  }
  const fixture = pending.shift()!;
  if (!pending.length) setRunClaude(null);
  await new Promise((r) => setTimeout(r, 4000));
  if (fixture === "busy") throw new AiBusyError();
  if (fixture === "crash") throw new Error("dev-fixture: claude-pool exited with code 1");
  const text =
    fixture === "unreadable"
      ? JSON.stringify({ readable: false, reason: "To ni list z oznanili" })
      : fixture === "flags"
        ? await readFile(path.join(process.cwd(), MINE), "utf8")
        : await monthFixture();
  return { text, account: "dev-fixture", durationMs: 4000 };
}

/** Call before startBulletin. Does nothing in production or for other file names. */
export function armDevFixture(fileName: string): void {
  if (process.env.NODE_ENV === "production" || !fileName.startsWith("primer-")) return;
  pending.push(fixtureFor(fileName));
  setRunClaude(fake);
}
