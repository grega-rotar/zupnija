/**
 * Who is signed in, as an Actor: the Better Auth session → loadActor.
 * A disabled user (or one whose row is gone) is signed out (null).
 *
 * Development shortcut: DEV_ACTOR=<user id> in .env.local, or the dev_actor
 * cookie set by /dev/kot/<id>, signs in as that user (never in production).
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { loadActor } from "./actor";
import { ForbiddenError } from "./errors";
import { can, type Actor, type Area } from "./sections";

export async function getActor(): Promise<Actor | null> {
  if (process.env.NODE_ENV !== "production") {
    const dev = (await cookies()).get("dev_actor")?.value ?? process.env.DEV_ACTOR;
    if (dev) return loadActor(db, dev);
  }
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  return loadActor(db, s.user.id);
}

/** For pages: redirect to /prijava when signed out. */
export async function requireActor(): Promise<Actor> {
  const a = await getActor();
  if (!a) redirect("/prijava");
  return a;
}

/** For pages and actions that belong to one area. */
export async function requireArea(area: Area): Promise<Actor> {
  const a = await requireActor();
  if (!can(a, area)) throw new ForbiddenError();
  return a;
}
