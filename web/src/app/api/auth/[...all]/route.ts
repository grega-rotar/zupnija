/** Better Auth endpoints (magic link, Google, session) under /api/auth/*. */
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
