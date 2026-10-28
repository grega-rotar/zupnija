/**
 * Sign-in for the editor (admin.<domain>): Better Auth on our Postgres schema.
 *
 * Invite only. Users are created by the priest (people/invite), never here:
 * magic links go only to existing, enabled users (unknown addresses get the
 * same success response and no email), Google sign-in links to an existing
 * user by email and never signs up, and a disabled user gets no session.
 */
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { eq } from "drizzle-orm";
import { db, schema, type Db, type Tx } from "@/db";
import { sendMail } from "@/lib/mail";

const DAY = 60 * 60 * 24;

/** Origin of the editor, e.g. https://admin.zupnija-pirnice.si. */
export function adminOrigin(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  if (process.env.ADMIN_HOST) return `https://${process.env.ADMIN_HOST}`;
  return "http://admin.localhost:3000";
}

/** Where a magic link lands; that route hands the token to Better Auth. */
export function magicLinkUrl(token: string): string {
  return `${adminOrigin()}/prijava/potrdi?token=${encodeURIComponent(token)}`;
}

async function findUserByEmail(email: string) {
  const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email.trim().toLowerCase()));
  return u ?? null;
}

async function sendSignInLink(email: string, token: string): Promise<void> {
  const u = await findUserByEmail(email);
  // Unknown or disabled: send nothing, answer the same (no address probing).
  if (!u || u.disabledAt) return;
  const url = magicLinkUrl(token);
  await sendMail({
    to: u.email,
    subject: "Prijava v urejanje — Župnija Pirniče",
    text: [
      `Pozdravljeni${u.name ? `, ${u.name}` : ""}!`,
      "",
      "Za prijavo v urejanje spletne strani Župnije Pirniče odprite to povezavo:",
      url,
      "",
      "Povezava velja 15 minut in jo lahko uporabite samo enkrat.",
      "Če prijave niste zahtevali vi, to sporočilo preprosto prezrite.",
    ].join("\n"),
  });
}

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          disableSignUp: true,
          prompt: "select_account" as const,
        },
      }
    : undefined;

export const googleEnabled = Boolean(google);

/** Parish columns on `user`; readable from the session, never set by sign-in. */
const parishFields = {
  title: { type: "string", required: false, input: false },
  short: { type: "string", required: false, input: false },
  isOwner: { type: "boolean", required: false, input: false },
  requiresApproval: { type: "boolean", required: false, input: false },
  bigText: { type: "boolean", required: false, input: false },
  invitedAt: { type: "date", required: false, input: false },
  disabledAt: { type: "date", required: false, input: false },
  lastSeenAt: { type: "date", required: false, input: false },
} as const;

export const auth = betterAuth({
  baseURL: adminOrigin(),
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  user: { additionalFields: parishFields },
  session: { expiresIn: 30 * DAY, updateAge: DAY },
  account: {
    // An invited user (no account row yet) may sign in with a Google account
    // whose verified email matches; the user row itself is never created here.
    accountLinking: { enabled: true, requireLocalEmailVerified: false, updateUserInfoOnLink: false },
  },
  socialProviders: google,
  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      disableSignUp: true,
      sendMagicLink: ({ email, token }) => sendSignInLink(email, token),
    }),
  ],
  databaseHooks: {
    user: {
      // Never auto-create users, whatever path tries to.
      create: { before: async () => false },
    },
    session: {
      create: {
        before: async (s) => {
          const [u] = await db.select({ disabledAt: schema.user.disabledAt }).from(schema.user).where(eq(schema.user.id, s.userId));
          return Boolean(u && !u.disabledAt);
        },
        after: async (s) => {
          await db.update(schema.user).set({ lastSeenAt: new Date() }).where(eq(schema.user.id, s.userId));
        },
      },
    },
  },
});

/**
 * Use a magic-link token (from /prijava/potrdi). The response sets the session
 * cookie and redirects to `/`, or to `/prijava?error=INVALID_TOKEN` when the
 * link was already used or has expired.
 */
export async function verifyMagicLink(token: string, headers: Headers): Promise<Response> {
  const url = new URL("/api/auth/magic-link/verify", adminOrigin());
  url.searchParams.set("token", token);
  url.searchParams.set("callbackURL", "/");
  url.searchParams.set("errorCallbackURL", "/prijava");
  return auth.handler(new Request(url, { headers }));
}

/** Sign a user out everywhere (access revoked or changed). */
export async function revokeSessions(dbx: Db | Tx, userId: string): Promise<void> {
  await dbx.delete(schema.session).where(eq(schema.session.userId, userId));
}

/** Better Auth error codes (?error=…) as the login screen shows them. */
export function loginErrorMessage(code: string | undefined | null): string | null {
  if (!code) return null;
  switch (code.toLowerCase()) {
    case "invalid_token":
      return "Povezava je že bila uporabljena. Zahtevajte novo.";
    case "signup_disabled":
    case "new_user_signup_disabled":
    case "account_not_linked":
    case "unable_to_link_account":
    case "failed_to_create_session":
    case "unable_to_create_session":
      return "Ta e-pošta nima dostopa. Prosite župnika za povabilo.";
    case "access_denied":
      return "Prijava z Googlom je bila preklicana.";
    default:
      return "Prijava ni uspela. Poskusite znova.";
  }
}
