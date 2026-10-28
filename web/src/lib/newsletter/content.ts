/**
 * The newsletter's two mails (PRD US-005): the double opt-in confirmation and
 * the bulletin itself. Plain text plus a simple HTML version in the v4 palette
 * (white tile on paper, gold-brown links). Pure: the URLs come in absolute.
 */
import { formatDayHeading, formatTime } from "@/lib/dates";

export const CONFIRM_SUBJECT = "Potrdite prijavo na oznanila župnije Pirniče";

export type Mail = { subject: string; text: string; html: string };

const C = { paper: "#fafaf8", surface: "#ffffff", line: "#e5e2dc", ink: "#1f1c18", ink2: "#4d4840", ink3: "#6f685e", moss: "#7a5c1e", gold: "#7d5f1c" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const para = (s: string) => esc(s).replace(/\n/g, "<br>");

/** The page around every mail: paper background, one white tile, a grey footer line. */
function frame(title: string, body: string, foot: string): string {
  return `<!doctype html><html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};color:${C.ink};font-family:${FONT};font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 8px 16px;font-size:15px;font-weight:700;letter-spacing:-0.02em;color:${C.ink}">Župnija Pirniče</td></tr>
<tr><td style="background:${C.surface};border:1px solid ${C.line};border-radius:20px;padding:32px 28px">${body}</td></tr>
<tr><td style="padding:16px 8px 0;font-size:13px;color:${C.ink3}">${foot}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${C.moss};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${esc(label)}</a>`;
const link = (href: string, label: string) => `<a href="${esc(href)}" style="color:${C.moss};font-weight:600">${esc(label)}</a>`;
const h = (text: string) => `<h2 style="margin:28px 0 8px;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:${C.ink}">${esc(text)}</h2>`;

export function confirmMail(confirmUrl: string): Mail {
  const text = [
    "Pozdravljeni,",
    "",
    "prejeli smo prijavo na oznanila župnije Pirniče po e-pošti. Prijavo potrdite s klikom na povezavo:",
    "",
    confirmUrl,
    "",
    "Če se niste prijavili vi, to sporočilo prezrite. Brez potrditve vam ne bomo pošiljali ničesar.",
    "",
    "Župnija Pirniče",
  ].join("\n");
  const body = `<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${C.gold}">Oznanila po e-pošti</p>
<h1 style="margin:0 0 14px;font-size:24px;font-weight:700;letter-spacing:-0.03em">Potrdite prijavo</h1>
<p style="margin:0 0 22px;color:${C.ink2}">Prejeli smo prijavo na oznanila župnije Pirniče po e-pošti. Enkrat na mesec, ko izidejo. Nič drugega.</p>
<p style="margin:0 0 22px">${button(confirmUrl, "Potrdi prijavo")}</p>
<p style="margin:0;font-size:14px;color:${C.ink3}">Ali odprite to povezavo: <a href="${esc(confirmUrl)}" style="color:${C.moss};word-break:break-all">${esc(confirmUrl)}</a></p>`;
  return { subject: CONFIRM_SUBJECT, text, html: frame(CONFIRM_SUBJECT, body, "Če se niste prijavili vi, to sporočilo prezrite. Brez potrditve vam ne bomo pošiljali ničesar.") };
}

export type BulletinMailInput = {
  /** "oktober 2026" or "1.–7. november 2026" (bulletin/types.ts periodLabel). */
  period: string;
  issue?: string | null;
  article?: { title: string; text: string } | null;
  notices: string[];
  events: { title: string; date: string; time?: string | null; place?: string | null }[];
  /** Absolute: the site's /oznanila. */
  pageUrl: string;
  /** Absolute, or null when the bulletin was not uploaded as a PDF. */
  pdfUrl: string | null;
};

/** "Petek, 6. november ob 19.00, župnišče" */
const when = (e: BulletinMailInput["events"][number]) =>
  [formatDayHeading(e.date) + (e.time && e.time !== "00:00" ? ` ob ${formatTime(e.time)}` : ""), e.place].filter(Boolean).join(", ");

/** The bulletin as a mail; the same body for everyone, the unsubscribe link is per person. */
export function bulletinMail(b: BulletinMailInput, unsubscribeUrl: string): Mail {
  const subject = `Oznanila za ${b.period}`;
  const t: string[] = [subject + (b.issue ? ` (${b.issue})` : ""), ""];
  if (b.article) t.push(b.article.title, "", b.article.text, "");
  if (b.notices.length) t.push("OBVESTILA", "", ...b.notices.map((n) => `• ${n}`), "");
  if (b.events.length) t.push("DOGODKI", "", ...b.events.map((e) => `• ${e.title} — ${when(e)}`), "");
  t.push(`Vsa oznanila: ${b.pageUrl}`);
  if (b.pdfUrl) t.push(`Oznanila v PDF: ${b.pdfUrl}`);
  t.push("", "—", "Župnija Pirniče", `Odjava od oznanil po e-pošti: ${unsubscribeUrl}`);

  let body = `<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${C.gold}">Oznanila${b.issue ? ` · ${esc(b.issue)}` : ""}</p>
<h1 style="margin:0;font-size:26px;font-weight:700;letter-spacing:-0.03em">${esc(subject)}</h1>`;
  if (b.article) body += `${h(b.article.title)}<p style="margin:0;color:${C.ink2}">${para(b.article.text)}</p>`;
  if (b.notices.length) {
    body += h("Obvestila");
    body += `<ul style="margin:0;padding:0 0 0 20px;color:${C.ink2}">${b.notices.map((n) => `<li style="margin:0 0 8px">${para(n)}</li>`).join("")}</ul>`;
  }
  if (b.events.length) {
    body += h("Dogodki");
    body += b.events
      .map((e) => `<p style="margin:0 0 10px"><b style="color:${C.ink}">${esc(e.title)}</b><br><span style="font-size:14px;color:${C.ink3}">${esc(when(e))}</span></p>`)
      .join("");
  }
  body += `<p style="margin:28px 0 0">${button(b.pageUrl, "Oznanila na spletni strani")}</p>`;
  if (b.pdfUrl) body += `<p style="margin:14px 0 0;font-size:14px">${link(b.pdfUrl, "Prenesi oznanila v PDF")}</p>`;
  const foot = `Oznanila prejemate, ker ste se prijavili na spletni strani župnije. <a href="${esc(unsubscribeUrl)}" style="color:${C.ink3}">Odjava</a>`;
  return { subject, text: t.join("\n"), html: frame(subject, body, foot) };
}
