"use server";

import { getContactRecipient } from "@/sanity/data";
import { sendContactMessage } from "@/lib/mail";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<"name" | "email" | "message" | "phone", string>>;
  /** Echo of submitted values so the form can be re-filled after an error. */
  values?: { name: string; email: string; phone: string; subject: string; message: string };
};

const MIN_SECONDS_BEFORE_SUBMIT = 3;
const MAX_LENGTHS = { name: 120, email: 200, phone: 40, subject: 160, message: 4000 } as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function field(form: FormData, name: string, max: number): string {
  const v = form.get(name);
  return (typeof v === "string" ? v : "").trim().slice(0, max);
}

/**
 * Handles the contact form. Validation is duplicated on the server on
 * purpose; spam protection is a honeypot field plus a minimum fill time —
 * enough for a parish site, and no third-party script for visitors.
 */
export async function submitContactForm(_prev: ContactFormState, form: FormData): Promise<ContactFormState> {
  const values = {
    name: field(form, "name", MAX_LENGTHS.name),
    email: field(form, "email", MAX_LENGTHS.email),
    phone: field(form, "phone", MAX_LENGTHS.phone),
    subject: field(form, "subject", MAX_LENGTHS.subject),
    message: field(form, "message", MAX_LENGTHS.message),
  };

  // Honeypot: real people never see or fill this field.
  if (field(form, "website", 200)) {
    return { status: "success", message: "Hvala za sporočilo." };
  }
  const startedAt = Number(form.get("t"));
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < MIN_SECONDS_BEFORE_SUBMIT * 1000) {
    return { status: "error", message: "Obrazec je bil poslan prehitro. Poskusite znova.", values };
  }

  const errors: ContactFormState["errors"] = {};
  if (values.name.length < 2) errors.name = "Vpišite svoje ime.";
  if (!EMAIL.test(values.email)) errors.email = "Vpišite veljaven e-poštni naslov, da vam lahko odgovorimo.";
  if (values.message.length < 10) errors.message = "Sporočilo naj ima vsaj nekaj besed.";
  if (Object.keys(errors).length) {
    return { status: "error", message: "Preverite označena polja.", errors, values };
  }

  const recipient = await getContactRecipient();
  const to = recipient?.recipient;
  if (!to) {
    return {
      status: "error",
      message: "Sporočila trenutno ni mogoče poslati. Pokličite župnišče ali pišite po e-pošti.",
      values,
    };
  }

  const result = await sendContactMessage(to, values);
  if (!result.ok) {
    return { status: "error", message: "Sporočila ni bilo mogoče poslati. Poskusite pozneje ali pokličite župnišče.", values };
  }
  return { status: "success", message: "Hvala za sporočilo. Odgovorili vam bomo, kakor hitro bo mogoče." };
}
