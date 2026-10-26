import { connection } from "next/server";

/** Liveness check for the Docker healthcheck and the deploy job. */
export async function GET() {
  await connection();
  return Response.json({ ok: true });
}
