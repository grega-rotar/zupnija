/**
 * Where the public forms' mail goes: the parish inbox from Nastavitve
 * (`contactFormRecipient`, else the parish e-mail), plus the emergency phone
 * the sacrament form shows for sick calls and funerals.
 */
import "server-only";
import { contentStore, readContactRecipient, readSettings } from "@/lib/content/read";
import { sendMail } from "@/lib/mail";

export async function parishInbox(): Promise<string | null> {
  return readContactRecipient(await contentStore())?.recipient ?? null;
}

export async function emergencyContact(): Promise<{ label: string; phone: string } | null> {
  const e = readSettings(await contentStore())?.emergencyContact;
  return e?.phone ? { label: e.label || "Za nujne primere", phone: e.phone } : null;
}

/** One mail to the parish inbox. Lines with an empty value are left out. */
export async function mailParish(subject: string, lines: Array<[string, string | null | undefined]>, body?: string): Promise<void> {
  const to = await parishInbox();
  if (!to) {
    console.error(`[obrazec] ni prejemnika (Nastavitve → Prejemnik sporočil): ${subject}`);
    return;
  }
  const text = [...lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), ...(body ? ["", body] : [])].join("\n");
  await sendMail({ to, subject, text });
}
