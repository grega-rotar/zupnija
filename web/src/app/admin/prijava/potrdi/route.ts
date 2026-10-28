/**
 * The link in the sign-in email: /prijava/potrdi?token=…
 * Hands the token to Better Auth's verify endpoint, which sets the session
 * cookie and redirects to Domov, or back to /prijava?error=… (reused or
 * expired link, no access).
 */
import type { NextRequest } from "next/server";
import { verifyMagicLink } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return verifyMagicLink(req.nextUrl.searchParams.get("token") ?? "", req.headers);
}
