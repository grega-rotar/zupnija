/**
 * Who is signed in, as an Actor. OWNED BY THE AUTH WORK: replace the TODO
 * with the Better Auth session lookup. Keep the exported signatures.
 *
 * Development shortcut: DEV_ACTOR=<user id> in .env.local signs in as that
 * user (never in production). The prototype-style user switch relies on it.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { loadActor } from "./actor";
import { ForbiddenError } from "./errors";
import { can, type Actor, type Area } from "./sections";

export async function getActor(): Promise<Actor | null> {
  if (process.env.NODE_ENV !== "production") {
    const dev = (await cookies()).get("dev_actor")?.value ?? process.env.DEV_ACTOR;
    if (dev) return loadActor(db, dev);
  }
  // TODO(auth): Better Auth session → user id → loadActor(db, id)
  return null;
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
