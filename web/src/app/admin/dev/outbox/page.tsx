/** Development only: emails the mail adapter kept instead of sending (no RESEND_API_KEY). */
import { notFound } from "next/navigation";
import { devOutbox } from "@/lib/mail";

export const dynamic = "force-dynamic";

const LINK = /(https?:\/\/[^\s]+)/g;

export default function DevOutboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const mails = devOutbox();

  return (
    <main style={{ height: "100dvh", overflow: "auto", padding: "32px 20px", maxWidth: 760, margin: "0 auto", display: "grid", gap: 16, alignContent: "start" }}>
      <h1>Izhodna pošta (razvoj)</h1>
      <p style={{ color: "var(--color-ink-3)" }}>
        Sporočila, ki bi jih poslali brez RESEND_API_KEY. Najnovejša so na vrhu. Osvežite stran za nova.
      </p>
      {mails.length === 0 ? <p>Ni sporočil.</p> : null}
      {mails.map((m, i) => (
        <article key={`${m.at}-${i}`} style={{ border: "1px solid var(--color-stone)", borderRadius: 8, padding: 16, display: "grid", gap: 8, background: "var(--color-paper)" }}>
          <small style={{ color: "var(--color-ink-3)" }}>
            {new Date(m.at).toLocaleString("sl-SI")} · za <b>{m.to}</b>
          </small>
          <b>{m.subject}</b>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", font: "inherit" }}>
            {m.text.split(LINK).map((part, j) =>
              j % 2 === 1 ? (
                <a key={j} href={part} style={{ color: "var(--color-moss)", textDecoration: "underline" }}>
                  {part}
                </a>
              ) : (
                part
              ),
            )}
          </pre>
        </article>
      ))}
    </main>
  );
}
