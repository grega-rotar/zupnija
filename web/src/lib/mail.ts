import "server-only";

/**
 * Outbound e-mail boundary: contact-form messages to the parish and the
 * editor's sign-in links. The provider (Resend over plain HTTPS) is isolated
 * here so it can be swapped without touching callers.
 *
 * Without RESEND_API_KEY (local development, tests) messages are logged and
 * kept in an in-memory outbox instead; /dev/outbox shows it.
 */

export type ContactMessage = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
};

export type SendResult = { ok: true; delivered: boolean } | { ok: false; error: string };

export async function sendContactMessage(to: string, msg: ContactMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL || "spletna-stran@zupnija-pirnice.si";

  const subject = `[Spletna stran] ${msg.subject?.trim() || "Sporočilo s spletnega obrazca"}`;
  const text = [
    `Ime: ${msg.name}`,
    `E-pošta: ${msg.email}`,
    msg.phone ? `Telefon: ${msg.phone}` : null,
    "",
    msg.message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  if (!apiKey) {
    console.info("[kontakt] RESEND_API_KEY ni nastavljen — sporočilo ni bilo poslano:\n", { to, subject, text });
    keep({ to, subject, text });
    return { ok: true, delivered: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], reply_to: msg.email, subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[kontakt] Resend error", res.status, body);
      return { ok: false, error: `Ponudnik pošte je vrnil napako (${res.status}).` };
    }
    return { ok: true, delivered: true };
  } catch (err) {
    console.error("[kontakt] send failed", err);
    return { ok: false, error: "Pošiljanje ni uspelo." };
  }
}


// ── Generic messages (sign-in links, invitations) ──────────────────────────

/** `headers`: extra mail headers (the newsletter's List-Unsubscribe). */
export type OutgoingMail = { to: string; subject: string; text: string; html?: string; headers?: Record<string, string> };
export type OutboxEntry = OutgoingMail & { at: string };

const OUTBOX_MAX = 50;
const g = globalThis as unknown as { __zupnijaOutbox?: OutboxEntry[] };

function keep(mail: OutgoingMail) {
  const box = (g.__zupnijaOutbox ??= []);
  box.unshift({ ...mail, at: new Date().toISOString() });
  box.length = Math.min(box.length, OUTBOX_MAX);
}

/** Messages "sent" without RESEND_API_KEY, newest first (development and tests). */
export function devOutbox(): OutboxEntry[] {
  return g.__zupnijaOutbox ?? [];
}

export function clearDevOutbox(): void {
  g.__zupnijaOutbox = [];
}

export async function sendMail(mail: OutgoingMail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL || "spletna-stran@zupnija-pirnice.si";

  if (!apiKey) {
    keep(mail);
    // In production a missing key means mail silently never leaves (sign-in links, invites).
    if (process.env.NODE_ENV === "production") console.error(`[mail] RESEND_API_KEY ni nastavljen — ni poslano: ${mail.subject}`);
    else if (process.env.NODE_ENV === "development") console.info(`[mail] ni poslano (brez RESEND_API_KEY): ${mail.to} — ${mail.subject}`);
    return { ok: true, delivered: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html, headers: mail.headers }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[mail] Resend error", res.status, body);
      return { ok: false, error: `Ponudnik pošte je vrnil napako (${res.status}).` };
    }
    return { ok: true, delivered: true };
  } catch (err) {
    console.error("[mail] send failed", err);
    return { ok: false, error: "Pošiljanje ni uspelo." };
  }
}
