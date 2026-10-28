/**
 * Donations (US-009): the bank details from Nastavitve → Darovi
 * (settings.donations), the parish address for the payee's street and city,
 * and the editor's "Nameni darovanja" (donationPurpose, orderable), each
 * with its UPN QR payload. Without an IBAN there is nothing: /daruj is 404
 * and the footer block is hidden.
 */
import "server-only";
import { cache } from "react";
import type { SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { contentStore } from "@/lib/content/read";
import { today } from "@/lib/clock";
import { getSettings } from "@/sanity/data";
import { buildUpnQr } from "./upnqr";

type Donations = NonNullable<NonNullable<SETTINGS_QUERY_RESULT>["donations"]>;

export type GivingPurpose = {
  id: string;
  title: string;
  description: string | null;
  amount: number | null;
  purpose: string;
  until: string | null;
  payload: string;
};

export type Giving = {
  recipient: string;
  /** Without spaces, for the clipboard. */
  iban: string;
  /** In groups of four, for reading. */
  ibanGrouped: string;
  bic: string | null;
  reference: string | null;
  purpose: string;
  intro: Donations["intro"];
  street: string | null;
  city: string | null;
  /** The general QR: no amount, the settings' purpose. */
  payload: string;
  purposes: GivingPurpose[];
};

export type PurposeDoc = { _id: string; title?: unknown; description?: unknown; amount?: unknown; purpose?: unknown; reference?: unknown; until?: unknown };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** "SI56 0202 1026 2993 393" from any spacing. */
export const groupIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");

/** The page's data from settings and the purpose documents (in their editor order); null without a usable IBAN. */
export function givingFrom(settings: SETTINGS_QUERY_RESULT | null, docs: PurposeDoc[], on: string): Giving | null {
  const d = settings?.donations;
  const iban = (d?.iban ?? "").replace(/\s+/g, "").toUpperCase();
  if (!d || !iban) return null;
  const a = settings?.address;
  const base = {
    iban,
    name: str(d.recipient) ?? settings?.name ?? "Župnija Pirniče",
    address: str(a?.street),
    city: [a?.postalCode, a?.city].filter(Boolean).join(" ") || null,
  };
  const purpose = str(d.purpose) ?? "Dar za župnijo";
  let payload: string;
  try {
    payload = buildUpnQr({ ...base, purpose, reference: d.reference });
  } catch {
    return null; // an IBAN the editor mistyped: no QR rather than a broken page
  }
  const purposes = docs.flatMap((p): GivingPurpose[] => {
    const until = str(p.until);
    const title = str(p.title);
    if (!title || (until && until < on)) return [];
    const amount = typeof p.amount === "number" && p.amount > 0 ? p.amount : null;
    const text = str(p.purpose) ?? title;
    return [{ id: p._id, title, description: str(p.description), amount, purpose: text, until, payload: buildUpnQr({ ...base, purpose: text, amount, reference: str(p.reference) ?? d.reference }) }];
  });
  return {
    recipient: base.name,
    iban,
    ibanGrouped: groupIban(iban),
    bic: str(d.bic),
    reference: str(d.reference),
    purpose,
    intro: d.intro,
    street: base.address,
    city: base.city,
    payload,
    purposes,
  };
}

/** Published "Nameni darovanja" in the editor's order. */
async function purposeDocs(): Promise<PurposeDoc[]> {
  const s = await contentStore();
  return s.rows
    .filter((r) => r.type === "donationPurpose")
    .sort((a, b) => a.sort - b.sort)
    .map((r) => ({ ...r.data, _id: r.id }));
}

/** Everything /daruj, the footer and the homepage tile show; null without an IBAN. */
export const getGiving = cache(async (): Promise<Giving | null> => {
  const [settings, docs] = await Promise.all([getSettings(), purposeDocs()]);
  return givingFrom(settings, docs, today());
});
