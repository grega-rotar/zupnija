/**
 * The one place the editor talks to Claude: it spawns claude-pool (a wrapper
 * around the `claude` CLI that picks an account with usage left).
 *
 *   claude-pool -p <prompt> --output-format json --model claude-opus-5-5
 *               --allowedTools … --disallowedTools …
 *
 * Exit code 75 = every pool account is full → AiBusyError. Tests replace the
 * implementation with setRunClaude().
 */
import "server-only";
import { spawn } from "node:child_process";

export class AiBusyError extends Error {
  constructor() {
    super("ai_busy");
    this.name = "AiBusyError";
  }
}
export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

export type RunClaudeOptions = {
  prompt: string;
  /** Working directory; give the bulletin run a temp dir holding only the upload. */
  cwd?: string;
  /** Built-in tools Claude may use, e.g. ["Read"]. Default: none. */
  allowedTools?: string[];
  timeoutMs?: number;
  model?: string;
};
export type RunClaudeResult = { text: string; account?: string; durationMs: number };

const ALL_TOOLS = ["Bash", "Read", "Edit", "Write", "MultiEdit", "NotebookEdit", "Glob", "Grep", "WebFetch", "WebSearch", "Task", "TodoWrite"];

export function buildArgs(o: RunClaudeOptions): string[] {
  const allowed = o.allowedTools ?? [];
  const args = ["-p", o.prompt, "--output-format", "json", "--model", o.model ?? "claude-opus-5-5"];
  if (allowed.length) args.push("--allowedTools", allowed.join(","));
  args.push("--disallowedTools", ALL_TOOLS.filter((t) => !allowed.includes(t)).join(","));
  return args;
}

/** Only what claude-pool needs: app secrets (database, auth, Google) never reach the model's process. */
export function childEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const keep = (k: string) =>
    ["PATH", "HOME", "LANG", "TZ", "TMPDIR", "DISABLE_AUTOUPDATER"].includes(k) || k.startsWith("CLAUDE") || k.startsWith("ANTHROPIC_");
  return Object.fromEntries(Object.entries(env).filter(([k]) => keep(k))) as NodeJS.ProcessEnv;
}

async function spawnClaude(o: RunClaudeOptions): Promise<RunClaudeResult> {
  const started = Date.now();
  const bin = process.env.CLAUDE_POOL_BIN ?? "claude-pool";
  return new Promise((resolve, reject) => {
    const child = spawn(bin, buildArgs(o), { cwd: o.cwd, env: childEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), o.timeoutMs ?? 120_000);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new AiError(`claude-pool could not start: ${e.message}`));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 75) return reject(new AiBusyError());
      if (signal) return reject(new AiError(`claude-pool stopped (${signal})`));
      try {
        const j = JSON.parse(out) as { result?: string; is_error?: boolean; pool_account?: string };
        if (code !== 0 || j.is_error || typeof j.result !== "string") return reject(new AiError(`claude-pool failed (${code}): ${err.slice(0, 500) || out.slice(0, 500)}`));
        resolve({ text: j.result, account: j.pool_account, durationMs: Date.now() - started });
      } catch {
        reject(new AiError(`claude-pool returned no JSON (${code}): ${err.slice(0, 500)}`));
      }
    });
  });
}

let impl: (o: RunClaudeOptions) => Promise<RunClaudeResult> = spawnClaude;

export function runClaude(o: RunClaudeOptions): Promise<RunClaudeResult> {
  return impl(o);
}

/** Tests: replace the implementation; pass null to restore the real one. */
export function setRunClaude(fn: ((o: RunClaudeOptions) => Promise<RunClaudeResult>) | null): void {
  impl = fn ?? spawnClaude;
}

/** Pull the first JSON object out of a model reply (it may wrap it in ```json fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new AiError("no JSON object in reply");
  return JSON.parse(body.slice(start, end + 1));
}
