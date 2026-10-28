/**
 * The personal unsubscribe link in every newsletter mail (PRD US-005), and the
 * List-Unsubscribe URL. A route handler, not a page, because mail programs'
 * one-click unsubscribe (RFC 8058) POSTs here with a multipart or urlencoded
 * body, which a page would take for a server action.
 *
 *   GET  ?token=… → unsubscribe, then 303 to /obvestila/odjavljeni (the message)
 *   POST ?token=… → unsubscribe, 200 (one-click; the body is not needed)
 */
import { unsubscribe } from "@/lib/newsletter/service";

const tokenOf = (req: Request) => new URL(req.url).searchParams.get("token");

export async function GET(req: Request): Promise<Response> {
  const result = await unsubscribe(tokenOf(req));
  const to = result === "done" ? "/obvestila/odjavljeni" : "/obvestila/odjavljeni?stanje=neveljavna";
  // Relative, so it works behind the proxy on any host.
  return new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store" } });
}

export async function POST(req: Request): Promise<Response> {
  const result = await unsubscribe(tokenOf(req));
  return new Response(result === "done" ? "Odjavljeni ste." : "Povezava ni veljavna.", {
    status: result === "done" ? 200 : 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
