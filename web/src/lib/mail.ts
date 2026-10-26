import "server-only";

/**
 * Outbound e-mail boundary. The site only ever sends contact-form
 * messages to the parish. The provider (Resend over plain HTTPS) is
 * isolated here so it can be swapped without touching the form.
 *
 * Without RESEND_API_KEY (local development) messages are logged instead.
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
