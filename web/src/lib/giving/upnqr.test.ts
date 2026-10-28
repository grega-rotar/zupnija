import { describe, expect, it } from "vitest";
import { buildUpnQr, encodeIso88592, parseUpnQr, upnAmount, upnQrSymbol, upnText } from "./upnqr";

/**
 * The sample from the ZBS specification (priloga 7.3 "UPN QR struktura kode
 * QR", objava_dokumentacije_UPN_QR-2016-12-15.zip): its column "Primer polja
 * v kodi QR", field by field, with the checksum the document gives (252).
 */
const ZBS_SAMPLE = [
  "UPNQR",
  "SI56020170014356205",
  "",
  "",
  "SI00225268-32526-222",
  "Poljubno podjetje d.o.o.",
  "Lepa cesta 10",
  "2000 Maribor",
  "00000126874",
  "11.07.2016",
  "X",
  "CPYR",
  "Plačilo računa 18/2016.",
  "",
  "SI56020360253863406",
  "SI081236-17-345679",
  "Združenje bank Slovenije - GIZ",
  "Šubičeva 2",
  "1000 Ljubljana",
  "252",
]
  .map((f) => `${f}\n`)
  .join("");

const PARISH = {
  iban: "SI56 0202 1026 2993 393",
  name: "Župnija Pirniče",
  address: "Zgornje Pirniče 74b",
  city: "1215 Medvode",
  purpose: "Dar za župnijo",
  code: "CHAR",
};

// ───────────── An independent QR decoder (ISO/IEC 18004), for the round trip ─────────────

const MASKS: ((i: number, j: number) => boolean)[] = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0,
];

/** Reads the matrix back: version, error-correction level, mask, ECI designator and the decoded text. */
function decode(payload: string) {
  const { modules } = upnQrSymbol(payload);
  const size = modules.size;
  const version = (size - 17) / 4;

  // Format information, the copy beside the top-left finder (bit i at these positions).
  let format = 0;
  for (let i = 0; i < 15; i++) {
    const row = i < 6 ? i : i < 8 ? i + 1 : size - 15 + i;
    if (modules.get(row, 8)) format |= 1 << i;
  }
  format ^= 0b101010000010010;
  const ecl = ({ 0b01: "L", 0b00: "M", 0b11: "Q", 0b10: "H" } as Record<number, string>)[format >> 13];
  const mask = MASKS[(format >> 10) & 7];

  // Data modules in the zigzag order, unmasked.
  const bits: number[] = [];
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let n = 0; n < size; n++) {
      const row = up ? size - 1 - n : n;
      for (const c of [col, col - 1]) {
        if (modules.isReserved(row, c)) continue;
        bits.push((modules.get(row, c) ? 1 : 0) ^ (mask(row, c) ? 1 : 0));
      }
    }
    up = !up;
  }
  const codewords = Array.from({ length: 655 }, (_, k) => bits.slice(k * 8, k * 8 + 8).reduce((a, b) => (a << 1) | b, 0));

  // Version 15-M: 5 blocks of 41 and 5 of 42 data codewords, interleaved.
  const sizes = [41, 41, 41, 41, 41, 42, 42, 42, 42, 42];
  const blocks: number[][] = sizes.map(() => []);
  let k = 0;
  for (let i = 0; i < 42; i++) sizes.forEach((len, b) => i < len && blocks[b].push(codewords[k++]));
  const data = blocks.flat();

  // The bit stream: ECI header, then one byte-mode segment.
  const stream = data.map((b) => b.toString(2).padStart(8, "0")).join("");
  let p = 0;
  const take = (n: number) => parseInt(stream.slice(p, (p += n)), 2);
  const eciMode = take(4);
  const eci = take(8);
  const byteMode = take(4);
  const count = take(16);
  const bytes = Uint8Array.from({ length: count }, () => take(8));
  const terminator = take(4);
  return { version, ecl, eciMode, eci, byteMode, terminator, text: new TextDecoder("iso-8859-2").decode(bytes) };
}

describe("UPN QR payload (ZBS specification)", () => {
  it("parses the ZBS sample and its checksum of 252", () => {
    const f = parseUpnQr(ZBS_SAMPLE);
    expect(f.checksum).toBe("252");
    expect(f.amount).toBe("00000126874");
    expect(f.name).toBe("Združenje bank Slovenije - GIZ");
    expect(f.street).toBe("Šubičeva 2");
  });

  it("builds the ZBS sample's payee side byte for byte", () => {
    const payload = buildUpnQr({
      iban: "SI56 0203 6025 3863 406",
      name: "Združenje bank Slovenije - GIZ",
      address: "Šubičeva 2",
      city: "1000 Ljubljana",
      purpose: "Plačilo računa 18/2016.",
      code: "CPYR",
      amount: 1268.74,
      reference: "SI08 1236-17-345679",
    });
    const sample = ZBS_SAMPLE.split("\n");
    const ours = payload.split("\n");
    // Fields 9 and 12–19 are the payee's; the sample's payer fields (2–8, 10, 11) are left empty here.
    for (const i of [0, 8, 11, 12, 13, 14, 15, 16, 17, 18]) expect(ours[i]).toBe(sample[i]);
  });

  it("has the header, 19 fields plus the checksum, LF line ends and a checksum equal to the length", () => {
    const payload = buildUpnQr(PARISH);
    expect(payload.startsWith("UPNQR\n")).toBe(true);
    expect(payload.endsWith("\n")).toBe(true);
    const lines = payload.split("\n");
    expect(lines).toHaveLength(21); // 20 fields, each closed by LF, and the empty reserve
    const body = lines.slice(0, 19).join("\n") + "\n";
    expect(lines[19]).toBe(String(body.length).padStart(3, "0"));
    // ISO 8859-2: one byte per character, so the checksum is also the byte length.
    expect(encodeIso88592(body)).toHaveLength(body.length);
    expect(payload).not.toContain("\r");
  });

  it("fills the payee side and leaves the payer's empty", () => {
    const f = parseUpnQr(buildUpnQr({ ...PARISH, reference: "SI00 2027" }));
    expect(f).toMatchObject({
      payerIban: "",
      payerName: "",
      code: "CHAR",
      purpose: "Dar za župnijo",
      iban: "SI56020210262993393",
      reference: "SI002027",
      name: "Župnija Pirniče",
      street: "Zgornje Pirniče 74b",
      city: "1215 Medvode",
    });
  });

  it("leaves the amount empty without one, and writes cents with 11 digits", () => {
    expect(parseUpnQr(buildUpnQr(PARISH)).amount).toBe("");
    expect(parseUpnQr(buildUpnQr({ ...PARISH, amount: 25 })).amount).toBe("00000002500");
    expect(upnAmount(40)).toBe("00000004000");
    expect(upnAmount(0.1 + 0.2)).toBe("00000000030");
  });

  it("uses SI99 when there is no reference", () => {
    expect(parseUpnQr(buildUpnQr(PARISH)).reference).toBe("SI99");
  });

  it("encodes ISO 8859-2 exactly as the standard code page", () => {
    const all = new Uint8Array(256).map((_, i) => i);
    const text = new TextDecoder("iso-8859-2").decode(all);
    expect([...encodeIso88592(text)]).toEqual([...all]);
    expect([...encodeIso88592("ČŠŽčšž")]).toEqual([0xc8, 0xa9, 0xae, 0xe8, 0xb9, 0xbe]);
  });

  it("cuts fields to their maximum length and replaces characters outside ISO 8859-2", () => {
    const f = parseUpnQr(buildUpnQr({ ...PARISH, purpose: "Oratorij 2027 – prispevek za otroke in animatorje „Pirniče“" }));
    expect(f.purpose.length).toBeLessThanOrEqual(42);
    expect(f.purpose.startsWith("Oratorij 2027 - prispevek")).toBe(true);
    expect(upnText("  Señor  ", 33)).toBe("Senor");
    expect(upnText("Sveti 🙏", 33)).toBe("Sveti ?");
  });

  it("refuses a bad IBAN", () => {
    expect(() => buildUpnQr({ ...PARISH, iban: "" })).toThrow("IBAN");
  });
});

describe("UPN QR symbol", () => {
  it("round-trips: version 15, level M, ECI ISO 8859-2, byte mode, fields unchanged", () => {
    const payload = buildUpnQr({ ...PARISH, amount: 25, purpose: "Oratorij 2027 · Ščitnik, Žiga, Čuk" });
    const out = decode(payload);
    expect(out).toMatchObject({ version: 15, ecl: "M", eciMode: 0b0111, eci: 4, byteMode: 0b0100, terminator: 0 });
    expect(out.text).toBe(payload);
    expect(parseUpnQr(out.text)).toEqual(parseUpnQr(payload));
    expect(parseUpnQr(out.text).purpose).toBe("Oratorij 2027 - Ščitnik, Žiga, Čuk");
  });

  it("round-trips the ZBS sample", () => {
    expect(decode(ZBS_SAMPLE).text).toBe(ZBS_SAMPLE);
  });

  it("fits the 411-character capacity at the longest fields", () => {
    const long = "Ž".repeat(60);
    const payload = buildUpnQr({ iban: "SI56 0202 1026 2993 393", name: long, address: long, city: long, purpose: long, amount: 999999999.99, reference: "SI12" + "1".repeat(30), deadline: "2027-07-01" });
    expect(encodeIso88592(payload).length).toBeLessThanOrEqual(411);
    expect(decode(payload).text).toBe(payload);
  });
});
