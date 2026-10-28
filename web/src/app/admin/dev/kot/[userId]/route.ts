/** Development only: /dev/kot/<userId> acts as that user (dev_actor cookie, read by session.ts). */
import { cookies } from "next/headers";

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not Found", { status: 404 });
  const { userId } = await params;
  (await cookies()).set("dev_actor", userId, { path: "/", httpOnly: true, sameSite: "lax" });
  return new Response(null, { status: 303, headers: { Location: "/" } });
}
