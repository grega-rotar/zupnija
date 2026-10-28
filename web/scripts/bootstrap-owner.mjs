// Create or update the editor's single owner (the parish priest), who can then invite everyone
// else from the editor (Ljudje). Sign-in never creates users, so the first one comes from here.
//
//   docker compose exec web node web/scripts/bootstrap-owner.mjs --email zupnik@example.si --name "msgr. dr. Blaž Jezeršek" [--title Župnik]
//
// Idempotent. A new user gets the given name and title; an existing user (same e-mail) keeps
// name and title unless given, and is made the owner: is_owner, no approval needed, enabled.
// Refuses when a different user is already the owner (there is only one).
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import postgres from "postgres";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, title: { type: "string" } },
  strict: true,
});
const email = values.email?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node web/scripts/bootstrap-owner.mjs --email <e-mail> --name "<name>" [--title Župnik]');
  process.exit(2);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("bootstrap-owner: DATABASE_URL is not set");
  process.exit(1);
}

/** Same rule as initials() in src/lib/ljudje/actions.ts: "msgr. dr. Blaž Jezeršek" → "BJ". */
function initials(name) {
  const all = name.trim().split(/\s+/).filter(Boolean);
  const words = all.filter((w) => !w.endsWith("."));
  return (words.length ? words : all)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const msg = await sql.begin(async (tx) => {
    const [other] = await tx`select email from "user" where is_owner and lower(email) <> ${email}`;
    if (other) throw Object.assign(new Error(`${other.email} is already the owner; there is only one.`), { code: "OTHER_OWNER" });

    const [existing] = await tx`select id, name, title, is_owner, requires_approval, disabled_at from "user" where lower(email) = ${email}`;
    if (!existing) {
      const name = values.name?.trim();
      if (!name) throw Object.assign(new Error("--name is required for a new user"), { code: "USAGE" });
      const id = randomUUID();
      await tx`insert into "user" ${tx({
        id,
        name,
        email,
        email_verified: true,
        title: values.title?.trim() || "Župnik",
        short: initials(name),
        is_owner: true,
        requires_approval: false,
      })}`;
      return `created owner ${name} <${email}> (${id})`;
    }

    const set = { is_owner: true, requires_approval: false, disabled_at: null };
    if (values.name?.trim()) Object.assign(set, { name: values.name.trim(), short: initials(values.name) });
    if (values.title?.trim()) set.title = values.title.trim();
    const changed = Object.entries(set).filter(([k, v]) => (k === "disabled_at" ? existing.disabled_at !== null : existing[k] !== undefined && existing[k] !== v));
    if (!changed.length) return `${existing.name} <${email}> is already the owner, nothing changed`;
    await tx`update "user" set ${tx(set)}, updated_at = now() where id = ${existing.id}`;
    return `updated ${existing.id} <${email}>: ${changed.map(([k]) => k).join(", ")}`;
  });
  console.log(`bootstrap-owner: ${msg}`);
} catch (e) {
  console.error(`bootstrap-owner: ${e.code ? e.message : e}`);
  process.exitCode = e.code === "USAGE" ? 2 : 1;
} finally {
  await sql.end();
}
