/**
 * UPN QR: the QR code on the Slovenian universal payment order, which every
 * Slovenian bank app scans. Written against the specification of the
 * Združenje bank Slovenije (ZBS), "objava_dokumentacije_UPN_QR-2016-12-15.zip"
 * from https://www.zbs-giz.si/standardi-in-prirocniki/:
 *
 *  - priloga 7.3 "UPN QR struktura kode QR" (fields, lengths, checksum);
 *  - priloga 7.1 "UPN QR tehnični standard" ver. 1.1, november 2016;
 *  - priloga 7.2 "Navodila za izpolnjevanje" (which fields a payee fills).
 *
 * The payload is 19 fields plus a checksum (field 20), each ended by LF
 * ("\n", also when the field is empty), then an optional reserve with no LF:
 *
 *    1 "UPNQR"                 8 payer city (33)         15 payee IBAN (34)
 *    2 payer IBAN (19)         9 amount (11)             16 payee reference (26)
 *    3 deposit "X"            10 payment date (10)       17 payee name (33)
 *    4 withdrawal "X"         11 urgent "X"              18 payee street (33)
 *    5 payer reference (26)   12 purpose code (4)        19 payee city (33)
 *    6 payer name (33)        13 purpose (42)            20 checksum (3)
 *    7 payer street (33)      14 deadline (10)
 *
 *  - Text: every character of ISO 8859-2, no leading or trailing spaces.
 *  - Amount: cents, zero-padded to 11 digits (25 € → "00000002500").
 *  - IBAN and reference without spaces; a reference is model + number ("SI00…").
 *  - Checksum: the length of fields 1–19 including their 19 LFs, 3 digits
 *    zero-padded ("strlen(N1+'\n') + … + strlen(N19+'\n')").
 *  - Symbol: QR version 15, error correction M, byte mode, preceded by an
 *    ECI 000004 (ISO 8859-2) header; capacity 411 characters.
 *
 * A donation fills only the payee's side (payer fields are the payer's), with
 * purpose code CHAR (charity, from the ZBS list of purpose codes). The PRD
 * leaves the amount empty when there is none, so the payer types it in.
 */
import { create, type QRCodeSegment } from "qrcode";

export type UpnQrInput = {
  /** Payee IBAN, spaces allowed. */
  iban: string;
  /** Payee name, street and "postcode city". */
  name: string;
  address?: string | null;
  city?: string | null;
  /** "Namen plačila", max 42. */
  purpose: string;
  /** Purpose code, 4 capital letters (default CHAR). */
  code?: string;
  /** Euros; empty when null/undefined (the payer enters the amount). */
  amount?: number | null;
  /** Payee reference, e.g. "SI00 2027"; default SI99 (no reference). */
  reference?: string | null;
  /** Payment deadline (YYYY-MM-DD), optional. */
  deadline?: string | null;
};

/** The 20 fields of a payload, in order (1-based in the specification). */
export const UPN_FIELDS = [
  "header",
  "payerIban",
  "deposit",
  "withdrawal",
  "payerReference",
  "payerName",
  "payerStreet",
  "payerCity",
  "amount",
  "paymentDate",
  "urgent",
  "code",
  "purpose",
  "deadline",
  "iban",
  "reference",
  "name",
  "street",
  "city",
  "checksum",
] as const;
export type UpnFields = Record<(typeof UPN_FIELDS)[number], string>;

/** Max length of fields 1–20 (priloga 7.3). */
const MAX = [5, 19, 1, 1, 26, 33, 33, 33, 11, 10, 1, 4, 42, 10, 34, 26, 33, 33, 33, 3];

/** Characters 0xA0–0xFF of ISO 8859-2 (0x00–0x9F map to themselves). */
const ISO_8859_2_HIGH =
  " Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ°ą˛ł´ľśˇ¸šşťź˝žżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙";
const TO_BYTE = new Map<string, number>([...ISO_8859_2_HIGH].map((ch, i) => [ch, 0xa0 + i]));

/** Typographic characters an editor may type, in their ISO 8859-2 stand-ins. */
const FALLBACK: Record<string, string> = { "–": "-", "—": "-", "„": '"', "“": '"', "”": '"', "‘": "'", "’": "'", "€": "EUR", "…": "...", "·": "-", "•": "-" };

/** Text as it may go into a field: ISO 8859-2 only, one line, trimmed, at most `max` characters. */
export function upnText(s: string | null | undefined, max: number): string {
  let out = "";
  for (const ch of (s ?? "").normalize("NFC").replace(/\s+/g, " ")) {
    if (ch.charCodeAt(0) < 0xa0 || TO_BYTE.has(ch)) out += ch;
    else if (FALLBACK[ch]) out += FALLBACK[ch];
    else {
      // A letter with a diacritic ISO 8859-2 lacks (e.g. "ñ") loses the diacritic.
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += base && [...base].every((c) => c.charCodeAt(0) < 0x80) ? base : "?";
    }
  }
  return out.trim().slice(0, max).trim();
}

/** The payload as ISO 8859-2 bytes. Throws on a character outside the code page (upnText never leaves one). */
export function encodeIso88592(s: string): Uint8Array {
  return Uint8Array.from(s, (ch) => {
    const code = ch.charCodeAt(0);
    const b = code < 0xa0 ? code : TO_BYTE.get(ch);
    if (b === undefined) throw new Error(`Znak »${ch}« ni v ISO 8859-2.`);
    return b;
  });
}

const compact = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "").toUpperCase();

/** 25 → "00000002500"; null → "". */
export function upnAmount(euros: number | null | undefined): string {
  if (euros == null || !Number.isFinite(euros)) return "";
  const cents = Math.round(euros * 100);
  if (cents < 0 || cents > 99_999_999_999) throw new Error("Znesek ni veljaven.");
  return String(cents).padStart(11, "0");
}

/** "2027-07-01" → "01.07.2027". */
const upnDate = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join(".") : "");

/** The UPN QR payload (a JS string; encode it with encodeIso88592). */
export function buildUpnQr(input: UpnQrInput): string {
  const iban = compact(input.iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban)) throw new Error("IBAN ni veljaven.");
  const code = compact(input.code || "CHAR");
  if (!/^[A-Z]{4}$/.test(code)) throw new Error("Koda namena ni veljavna.");
  const fields = [
    "UPNQR",
    "", // payer IBAN
    "", // deposit
    "", // withdrawal
    "", // payer reference
    "", // payer name
    "", // payer street
    "", // payer city
    upnAmount(input.amount),
    "", // payment date
    "", // urgent
    code,
    upnText(input.purpose, MAX[12]),
    upnDate(input.deadline),
    iban,
    compact(input.reference).slice(0, MAX[15]) || "SI99",
    upnText(input.name, MAX[16]),
    upnText(input.address, MAX[17]),
    upnText(input.city, MAX[18]),
  ];
  const body = fields.map((f) => `${f}\n`).join("");
  return `${body}${String(body.length).padStart(3, "0")}\n`;
}

/** Splits a payload back into its fields and checks the header, the field lengths and the checksum. */
export function parseUpnQr(payload: string): UpnFields {
  const parts = payload.split("\n");
  if (parts.length < 21) throw new Error("UPN QR: premalo polj.");
  const values = parts.slice(0, 20);
  if (values[0] !== "UPNQR") throw new Error("UPN QR: manjka glava UPNQR.");
  values.forEach((v, i) => {
    if (v.length > MAX[i]) throw new Error(`UPN QR: polje ${i + 1} je predolgo.`);
  });
  const length = values.slice(0, 19).reduce((n, v) => n + v.length + 1, 0);
  if (Number(values[19]) !== length) throw new Error(`UPN QR: kontrolna vsota ${values[19]} ni ${length}.`);
  return Object.fromEntries(UPN_FIELDS.map((k, i) => [k, values[i]])) as UpnFields;
}

// ───────────────────────── The symbol ─────────────────────────

/**
 * The `qrcode` package has no ECI segment. Its builder writes, per segment,
 * the mode (4 bits), a count (mode.ccBits bits) and the data; an ECI header
 * is mode 0111 followed by the 8-bit designator, so a "segment" with mode bit
 * 7, an 8-bit count of 4 and no data writes exactly ECI 000004. The package
 * takes prebuilt segments only through Segments.fromArray(array), which calls
 * array.reduce, so the array hands them over through its own reduce.
 * upnqr.test.ts decodes the resulting matrix bit by bit to prove the layout.
 */
type Segment = { mode: { id: string; bit: number; ccBits: number[] }; getLength(): number; getBitsLength(): number; write(buf: { put(n: number, len: number): void }): void };

function segments(bytes: Uint8Array): Segment[] {
  const eci: Segment = { mode: { id: "ECI", bit: 0b0111, ccBits: [8, 8, 8] }, getLength: () => 4, getBitsLength: () => 0, write: () => {} };
  const data: Segment = {
    mode: { id: "Byte", bit: 0b0100, ccBits: [8, 16, 16] },
    getLength: () => bytes.length,
    getBitsLength: () => bytes.length * 8,
    write: (buf) => bytes.forEach((b) => buf.put(b, 8)),
  };
  return [eci, data];
}

/** The QR symbol of a payload: version 15, error correction M, ECI ISO 8859-2, byte mode. */
export function upnQrSymbol(payload: string) {
  const segs = segments(encodeIso88592(payload));
  const handOver = Object.assign([] as unknown[], { reduce: () => segs });
  return create(handOver as unknown as QRCodeSegment[], { version: 15, errorCorrectionLevel: "M" });
}

/**
 * The symbol as one SVG path (viewBox in modules, with the 4-module quiet
 * zone the QR standard requires), dark modules merged into horizontal runs.
 */
export function upnQrPath(payload: string): { size: number; d: string } {
  const { modules } = upnQrSymbol(payload);
  const q = 4;
  let d = "";
  for (let r = 0; r < modules.size; r++) {
    for (let c = 0; c < modules.size; c++) {
      if (!modules.get(r, c)) continue;
      let run = 1;
      while (c + run < modules.size && modules.get(r, c + run)) run++;
      d += `M${c + q} ${r + q}h${run}v1h-${run}z`;
      c += run - 1;
    }
  }
  return { size: modules.size + 2 * q, d };
}
