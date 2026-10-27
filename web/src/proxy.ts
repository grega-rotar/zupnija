/**
 * Host routing. The editor is served only on ADMIN_HOST (admin.<domain>; in
 * development also admin.localhost): there `/x` is rewritten to `/admin/x`,
 * and pages need a session cookie or they redirect to /prijava. On the public
 * host every /admin path is a 404 and everything else is untouched.
 *
 * The cookie check here is only a fast path; pages and actions still check
 * the session themselves (requireActor / requireArea).
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export type RouteDecision =
  | { kind: "next" }
  | { kind: "rewrite"; path: string }
  | { kind: "redirect"; path: string }
  | { kind: "notFound" };

export type RouteOptions = { hasSession?: boolean; dev?: boolean; adminHost?: string };

const hostname = (h: string) => h.trim().toLowerCase().replace(/:\d+$/, "");
const under = (p: string, prefix: string) => p === prefix || p.startsWith(`${prefix}/`);

export function isAdminHost(host: string, opts: Pick<RouteOptions, "dev" | "adminHost"> = {}): boolean {
  const dev = opts.dev ?? process.env.NODE_ENV !== "production";
  const admin = opts.adminHost ?? process.env.ADMIN_HOST;
  const h = hostname(host);
  return (!!admin && h === hostname(admin)) || (dev && h === "admin.localhost");
}

/** What to do with a request, from its host and path only (pure, tested). */
export function route(host: string, pathname: string, opts: RouteOptions = {}): RouteDecision {
  const dev = opts.dev ?? process.env.NODE_ENV !== "production";

  if (!isAdminHost(host, { dev, adminHost: opts.adminHost })) {
    if (under(pathname, "/admin") || under(pathname, "/api/auth")) return { kind: "notFound" };
    return { kind: "next" };
  }

  // Admin host: framework files, API routes and static assets pass through.
  if (under(pathname, "/api") || pathname.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(pathname)) return { kind: "next" };

  const target = `/admin${pathname === "/" ? "" : pathname}`;
  const open = under(pathname, "/prijava") || (dev && under(pathname, "/dev"));
  if (!open && !opts.hasSession) return { kind: "redirect", path: "/prijava" };
  return { kind: "rewrite", path: target };
}

export function proxy(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const dev = process.env.NODE_ENV !== "production";
  const hasSession =
    !!getSessionCookie(req) || (dev && (req.cookies.has("dev_actor") || !!process.env.DEV_ACTOR));
  const d = route(host, req.nextUrl.pathname, { hasSession, dev });

  switch (d.kind) {
    case "next":
      return NextResponse.next();
    case "notFound":
      // Any unknown single-segment path renders the public site's 404 page.
      return NextResponse.rewrite(new URL("/_ni-strani", req.url));
    case "redirect":
      return NextResponse.redirect(new URL(d.path, req.url));
    case "rewrite": {
      const url = req.nextUrl.clone();
      url.pathname = d.path;
      return NextResponse.rewrite(url);
    }
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
