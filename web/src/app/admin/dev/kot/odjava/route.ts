/** Development only: /dev/kot/odjava stops acting as a dev user. */
import { cookies } from "next/headers";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not Found", { status: 404 });
  (await cookies()).delete("dev_actor");
  return new Response(null, { status: 303, headers: { Location: "/prijava" } });
}
