/** Better Auth in the browser (login screen, sign-out). Same origin as the editor. */
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({ plugins: [magicLinkClient()] });

export async function signOut(): Promise<void> {
  await authClient.signOut();
  window.location.href = "/prijava";
}
