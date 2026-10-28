/**
 * Online Verouk enrolment (US-006): parents fill /verouk/vpis, the row lands
 * in catechesis_enrolments with a number "V-2026-0001", the parish gets one
 * mail and every parent e-mail a confirmation. The editor lists them under
 * Verouk → Vpisi and exports CSV.
 *
 * Enrolment can be closed: app_settings "verouk.enrolmentOpen" = "false"
 * (the switch on the Vpisi tab, action `enrolment.setOpen`). Missing = open.
 */
import "server-only";
import { asc, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db } from "@/db";
import { defineAction } from "@/lib/admin/engine";
import { now } from "@/lib/clock";
import { formatDate } from "@/lib/dates";
import { mailParish } from "@/lib/forms/parish";
import { CHECK_FIELDS, fields, submitPublicForm, type FormResult } from "@/lib/forms/public";
import { sendMail } from "@/lib/mail";

const e = schema.catechesisEnrolments;
export const OPEN_KEY = "verouk.enrolmentOpen";

export const ACTIVITIES = ["ministranti", "pevski_zbor", "skavti"] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const ACTIVITY_LABEL: Record<Activity, string> = { ministranti: "Ministranti", pevski_zbor: "Otroški pevski zbor", skavti: "Skavti" };

// ── School year ─────────────────────────────────────────────────────────────
/** From June on, enrolment is for the year that starts in September: "2026/2027". */
export function schoolYear(d: Date = now()): string {
  const y = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric" }).format(d));
  const m = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", month: "numeric" }).format(d));
  return m >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

/** "2026/2027" → "2026/27" */
export const shortYear = (sy: string) => sy.replace(/^(\d{4})\/\d{2}(\d{2})$/, "$1/$2");

export const closedMessage = (sy = schoolYear()) => `Vpisi za šolsko leto ${shortYear(sy)} so zaprti.`;

export async function isEnrolmentOpen(dbx: Db = defaultDb): Promise<boolean> {
  const [row] = await dbx.select().from(schema.appSettings).where(eq(schema.appSettings.key, OPEN_KEY));
  return row?.value !== "false";
}

// ── The form ────────────────────────────────────────────────────────────────
const parent = {
  Name: fields.optional(120),
  Email: fields.optionalEmail(),
  Phone: fields.optionalPhone(),
};

export const enrolmentSchema = z
  .object({
    fatherName: parent.Name,
    fatherEmail: parent.Email,
    fatherPhone: parent.Phone,
    motherName: parent.Name,
    motherEmail: parent.Email,
    motherPhone: parent.Phone,
    childFirstName: fields.text("Vpišite ime otroka.", 80),
    childLastName: fields.text("Vpišite priimek otroka.", 80),
    birthDate: fields.date("Datum rojstva ni pravilen.", { past: "Datum rojstva ni pravilen." }),
    birthPlace: fields.text("Vpišite kraj rojstva.", 120),
    baptismDate: fields.optionalDate("Datum krsta ni pravilen.", { past: "Datum krsta ni pravilen." }),
    baptismParish: fields.optional(120),
    address: fields.text("Vpišite naslov.", 200),
    grade: z.preprocess((v) => Number(v), z.number({ error: "Izberite razred." }).int("Izberite razred.").min(1, "Izberite razred.").max(9, "Izberite razred.")),
    groupId: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().optional()),
    activities: fields.many(ACTIVITIES),
    photoArchive: fields.checkbox(),
    photoPublish: fields.checkbox(),
    rules: fields.checkbox().refine((v) => v, "Za vpis potrdite pravila veroučne šole."),
    notes: fields.optional(1000),
  })
  .superRefine((p, ctx) => {
    for (const who of ["father", "mother"] as const) {
      const name = p[`${who}Name`];
      if ((p[`${who}Email`] || p[`${who}Phone`]) && !name)
        ctx.addIssue({ code: "custom", path: [`${who}Name`], message: "Vpišite ime in priimek." });
      if (name && !p[`${who}Email`] && !p[`${who}Phone`])
        ctx.addIssue({ code: "custom", path: [`${who}Phone`], message: "Vpišite telefon ali e-pošto." });
    }
    if (!p.fatherName && !p.motherName)
      ctx.addIssue({ code: "custom", path: ["motherName"], message: "Vpišite podatke vsaj enega od staršev." });
  });

export type EnrolmentData = z.output<typeof enrolmentSchema>;

/** Fields the form keeps after a successful submit ("Dodaj še enega otroka"). */
export const PARENT_FIELDS = ["fatherName", "fatherEmail", "fatherPhone", "motherName", "motherEmail", "motherPhone", "address"] as const;

async function nextNumber(dbx: Db, year: number): Promise<string> {
  const prefix = `V-${year}-`;
  const [last] = await dbx.select({ n: e.number }).from(e).where(like(e.number, `${prefix}%`)).orderBy(desc(e.number)).limit(1);
  const n = last ? Number(last.n.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} in ${xs[xs.length - 1]}`);

export async function submitEnrolment(data: FormData | Record<string, unknown>, opts: { ip?: string; dbx?: Db } = {}): Promise<FormResult> {
  const dbx = opts.dbx ?? defaultDb;
  if (!(await isEnrolmentOpen(dbx))) return { ok: false, status: 409, message: closedMessage(), fieldErrors: {} };

  return submitPublicForm({
    form: "verouk",
    schema: enrolmentSchema,
    data,
    thanks: "Hvala, vpis je oddan.",
    ip: opts.ip,
    dbx,
    handle: async (p) => {
      const group = p.groupId ? (await dbx.select().from(schema.catechesisGroups).where(eq(schema.catechesisGroups.id, p.groupId)))[0] : undefined;
      const groups = await dbx.select({ id: schema.catechesisGroups.id }).from(schema.catechesisGroups).limit(1);
      if (groups.length && !group) return { ok: false, message: CHECK_FIELDS, fieldErrors: { groupId: "Izberite skupino." } };

      const childName = `${p.childFirstName} ${p.childLastName}`;
      const sy = schoolYear();
      const year = Number(sy.slice(0, 4));
      const { rules, ...rest } = p;
      const record = { ...rest, rulesAccepted: rules, groupName: group?.name ?? null };

      // The number is unique; two parents at the same second retry once.
      let number = "";
      for (let attempt = 0; attempt < 3 && !number; attempt++) {
        const candidate = await nextNumber(dbx, year);
        try {
          await dbx.insert(e).values({ number: candidate, schoolYear: sy, childName, grade: p.grade, groupId: group?.id ?? null, data: record, createdAt: now() });
          number = candidate;
        } catch (err) {
          if (attempt === 2) throw err;
        }
      }

      const parents = [
        p.fatherName ? `Oče: ${p.fatherName}${[p.fatherEmail, p.fatherPhone].filter(Boolean).map((x) => `, ${x}`).join("")}` : null,
        p.motherName ? `Mati: ${p.motherName}${[p.motherEmail, p.motherPhone].filter(Boolean).map((x) => `, ${x}`).join("")}` : null,
      ].filter(Boolean);
      const summary: Array<[string, string | null | undefined]> = [
        ["Številka vpisa", number],
        ["Otrok", childName],
        ["Rojen(a)", `${formatDate(p.birthDate)}, ${p.birthPlace}`],
        ["Krst", [p.baptismDate ? formatDate(p.baptismDate) : null, p.baptismParish].filter(Boolean).join(", ") || null],
        ["Naslov", p.address],
        ["Razred", `${p.grade}.`],
        ["Skupina", group?.name],
        ["Dejavnosti", p.activities.map((a) => ACTIVITY_LABEL[a]).join(", ") || null],
        ["Fotografije za arhiv", p.photoArchive ? "da" : "ne"],
        ["Objava fotografij", p.photoPublish ? "da" : "ne"],
      ];

      await mailParish(`Vpis k verouku: ${childName}, ${p.grade}. razred`, summary, [...parents, p.notes ? `\nOpomba: ${p.notes}` : ""].join("\n").trim());

      const emails = [...new Set([p.fatherEmail, p.motherEmail].filter((x): x is string => !!x))];
      for (const to of emails) {
        await sendMail({
          to,
          subject: "Potrdilo o vpisu k verouku",
          text: [
            "Pozdravljeni,",
            "",
            `prejeli smo vpis k verouku za šolsko leto ${shortYear(sy)}. Številka vpisa: ${number}.`,
            "",
            ...summary.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
            "",
            "Če je kaj narobe, odgovorite na to sporočilo ali pokličite župnišče.",
            "",
            "Župnija Pirniče",
          ].join("\n"),
        });
      }

      const keep = Object.fromEntries(PARENT_FIELDS.map((k) => [k, (p[k] as string | undefined) ?? ""]));
      return {
        ok: true,
        message: emails.length
          ? `Hvala, vpis je oddan. Potrdilo smo poslali na ${list(emails)}. Številka vpisa je ${number}.`
          : `Hvala, vpis je oddan. Številka vpisa je ${number}.`,
        values: keep,
      };
    },
  });
}

// ── Reading (editor) ────────────────────────────────────────────────────────
export type EnrolmentView = {
  id: number;
  number: string;
  schoolYear: string;
  createdAt: string;
  childName: string;
  grade: number;
  group: string | null;
  data: EnrolmentData & { groupName?: string | null; rulesAccepted?: boolean };
};

export async function listEnrolments(dbx: Db = defaultDb): Promise<EnrolmentView[]> {
  const rows = await dbx
    .select({ row: e, group: schema.catechesisGroups.name })
    .from(e)
    .leftJoin(schema.catechesisGroups, eq(schema.catechesisGroups.id, e.groupId))
    .orderBy(asc(e.grade), asc(e.childName), asc(e.id));
  return rows.map(({ row, group }) => {
    const data = row.data as EnrolmentView["data"];
    return {
      id: row.id,
      number: row.number,
      schoolYear: row.schoolYear,
      createdAt: row.createdAt.toISOString(),
      childName: row.childName,
      grade: row.grade,
      group: group ?? data.groupName ?? null,
      data,
    };
  });
}

export async function countEnrolments(dbx: Db = defaultDb): Promise<number> {
  const [row] = await dbx.select({ n: sql<number>`count(*)::int` }).from(e);
  return row?.n ?? 0;
}

const CSV_COLUMNS: Array<[string, (v: EnrolmentView) => string | number | null | undefined]> = [
  ["Številka", (v) => v.number],
  ["Oddano", (v) => formatDate(v.createdAt.slice(0, 10))],
  ["Šolsko leto", (v) => v.schoolYear],
  ["Razred", (v) => v.grade],
  ["Skupina", (v) => v.group],
  ["Ime otroka", (v) => v.data.childFirstName],
  ["Priimek otroka", (v) => v.data.childLastName],
  ["Datum rojstva", (v) => (v.data.birthDate ? formatDate(v.data.birthDate) : "")],
  ["Kraj rojstva", (v) => v.data.birthPlace],
  ["Datum krsta", (v) => (v.data.baptismDate ? formatDate(v.data.baptismDate) : "")],
  ["Župnija krsta", (v) => v.data.baptismParish],
  ["Naslov", (v) => v.data.address],
  ["Oče", (v) => v.data.fatherName],
  ["Oče e-pošta", (v) => v.data.fatherEmail],
  ["Oče telefon", (v) => v.data.fatherPhone],
  ["Mati", (v) => v.data.motherName],
  ["Mati e-pošta", (v) => v.data.motherEmail],
  ["Mati telefon", (v) => v.data.motherPhone],
  ["Dejavnosti", (v) => (v.data.activities ?? []).map((a) => ACTIVITY_LABEL[a] ?? a).join(", ")],
  ["Fotografije za arhiv", (v) => (v.data.photoArchive ? "da" : "ne")],
  ["Objava fotografij", (v) => (v.data.photoPublish ? "da" : "ne")],
  ["Opomba", (v) => v.data.notes],
];

const cell = (x: string | number | null | undefined) => {
  const s = x == null ? "" : String(x);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Semicolon-separated with a BOM, so Slovenian Excel opens it with č, š, ž intact. */
export function enrolmentsCsv(rows: EnrolmentView[]): string {
  const lines = [CSV_COLUMNS.map(([h]) => cell(h)).join(";"), ...rows.map((v) => CSV_COLUMNS.map(([, f]) => cell(f(v))).join(";"))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ── enrolment.setOpen ───────────────────────────────────────────────────────
export const setEnrolmentOpen = defineAction({
  name: "enrolment.setOpen",
  area: "verouk",
  approvable: false,
  schema: z.object({ open: z.boolean() }),
  label: (p) => (p.open ? "Spletni vpis k verouku odprt" : "Spletni vpis k verouku zaprt"),
  apply: async (p, { track, tx, actor }) => {
    const value = p.open ? "true" : "false";
    const [row] = await tx.select().from(schema.appSettings).where(eq(schema.appSettings.key, OPEN_KEY));
    return row
      ? track.update("app_settings", OPEN_KEY, { value, updatedBy: actor.id })
      : track.insert("app_settings", { key: OPEN_KEY, value, updatedBy: actor.id });
  },
  tags: ["verouk"],
});
