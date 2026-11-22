/**
 * The new sign-in: Better Auth 1.7.27 with this app's production settings (trial task 3,
 * docs/research/auth-trial-findings.md, question 7). It sits beside the old sign-in (src/lib/auth.ts) and answers
 * only while AUTH2 is on (./config.ts).
 *
 * What is set here and why, against Better Auth's defaults:
 * - Cross-site checks explicitly on. Better Auth skips its origin check when it thinks it runs under a test; here
 *   it is the same everywhere. The app's own check (route.open in src/lib/api/route.ts) runs in front as well.
 * - Throttle on, in the database (`rateLimit` table), with tighter rules for sign-in, codes, and everything that
 *   sends an email. Better Auth's default is in memory and only in production.
 * - Passwords hashed with this app's scrypt (N=2^17, r=8; src/lib/auth.ts), not Better Auth's weaker default.
 * - Reset, confirmation and two-factor challenge tokens stored hashed (`verification.storeIdentifier`).
 * - Session tokens stored hashed by wrapping the database adapter (./tokenHash.ts); sessions last 30 days from
 *   last use, refreshed at most daily, and never more than 90 days from sign-in (./sessionLife.ts), as before.
 * - Cookies Secure whenever the base address is https, with their own prefix so they never meet the old cookie.
 * - Email confirmation required before the first sign-in; confirming does not sign in by itself.
 * - Two-factor: authenticator-app codes with recovery codes only (no email or SMS codes), each code usable once
 *   (./replayGuard.ts).
 * - Every new account gets a workspace (a Better Auth organization) with the user as owner, and every session
 *   starts in one. Invitations wait for slice 2: their endpoints are switched off until then.
 * - Sign-up, sign-in, sign-out, password and two-factor changes are written to the audit log.
 *
 * The owner's database connection is used (src/lib/db.ts ownerPool): the request role cannot read these tables.
 */
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { organization, twoFactor } from "better-auth/plugins";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely, PostgresDialect } from "kysely";
import type { Pool } from "pg";
import { CLIENT_ADDRESS_HEADER, hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { audit } from "@/lib/db";
import { AUTH2_BASE_PATH, AUTH2_PAGES, auth2BaseURL, auth2Secret, auth2TrustedOrigins } from "./config";
import { mailSender, render, type MailSender } from "./mail";
import { checkImage, cleanName, confirmedBefore, replaceUnconfirmed, tokenClaims } from "./guards";
import { guardTotp, TOTP_PATH } from "./replayGuard";
import { capSessionLife } from "./sessionLife";
import { hashSessionTokens } from "./tokenHash";

const APP_NAME = "Concept to Realization";
const COOKIE_PREFIX = "c2r2";
const SESSION_DAYS = 30;
const ABSOLUTE_SESSION_DAYS = 90;
const MAX_PASSWORD_LENGTH = 128;

/** Better Auth endpoints that are off: they need a session token handed back (see ./tokenHash.ts) or belong to slice 2. */
const DISABLED_PATHS = [
  // two-factor codes by email or text message: not offered
  "/two-factor/send-otp",
  "/two-factor/verify-otp",
  "/list-sessions",
  "/revoke-session",
  // checks a password and answers yes or no, with no screen using it: an oracle for guessing (review B5)
  "/verify-password",
  "/organization/invite-member",
  "/organization/accept-invitation",
  "/organization/reject-invitation",
  "/organization/cancel-invitation",
  "/organization/get-invitation",
  "/organization/list-invitations",
  "/organization/list-user-invitations",
];

/** Requests allowed per address in a window (seconds). Everything else: 100 in 10 seconds. */
const THROTTLE = {
  "/sign-in/email": { window: 10, max: 3 },
  "/two-factor/verify-totp": { window: 10, max: 3 },
  "/two-factor/verify-backup-code": { window: 10, max: 3 },
  "/sign-up/email": { window: 60, max: 3 },
  "/send-verification-email": { window: 60, max: 3 },
  "/request-password-reset": { window: 60, max: 3 },
  "/reset-password": { window: 60, max: 5 },
  "/change-password": { window: 60, max: 5 },
} as const;

export type Auth2Options = {
  baseURL?: string;
  secret?: string;
  mail?: MailSender;
  /** The throttle; on unless a test turns it off. */
  rateLimit?: boolean;
};

const slugOf = (id: string) => `ws-${id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`;

/** Audit actions for the endpoints that change who can sign in, written after they succeed. */
const AUDITED: Record<string, [string, string]> = {
  "/sign-up/email": ["account.signed_up", "Created an account"],
  "/sign-up/replaced": ["account.sign_up_replaced", "Signed up again before confirming: the new password and name replaced the old ones"],
  "/verify-email": ["account.confirmed", "Confirmed the email address"],
  "/sign-in/email": ["account.signed_in", "Signed in (password)"],
  "/two-factor/verify-totp": ["account.signed_in_code", "Entered an authenticator code"],
  "/two-factor/verify-backup-code": ["account.recovery_code_used", "Used a recovery code"],
  "/sign-out": ["account.signed_out", "Signed out"],
  "/change-password": ["account.password_changed", "Changed the password"],
  "/reset-password": ["account.password_reset", "Reset the password from an emailed link"],
  "/two-factor/enable": ["account.two_factor_started", "Started setting up an authenticator app"],
  "/two-factor/disable": ["account.two_factor_off", "Turned off the authenticator app"],
  "/two-factor/generate-backup-codes": ["account.recovery_codes_new", "Made new recovery codes"],
  "/revoke-other-sessions": ["account.signed_out_elsewhere", "Signed out every other browser"],
};

/**
 * Everything but the database, so tests/auth2/schema.test.ts can hand Better Auth's migration planner the same
 * configuration with the plain pool (the planner cannot use the wrapped adapter).
 */
export function auth2Options(db: Pool, opts: Auth2Options = {}) {
  const mail = opts.mail ?? mailSender();
  const baseURL = (opts.baseURL ?? auth2BaseURL()).replace(/\/+$/, "");
  const link = (path: string, token: string) => `${baseURL}${AUTH2_PAGES}${path}?token=${encodeURIComponent(token)}`;
  // Filled in by makeAuth once the instance exists; the sign-up hook needs it to create the workspace.
  const self: { auth?: { api: { createOrganization: (a: { body: { name: string; slug: string; userId: string } }) => Promise<unknown> } } } = {};

  const secret = opts.secret ?? auth2Secret();
  const options = {
    appName: APP_NAME,
    baseURL,
    basePath: AUTH2_BASE_PATH,
    secret,
    trustedOrigins: opts.baseURL ? [new URL(baseURL).origin] : auth2TrustedOrigins(),
    database: db,
    telemetry: { enabled: false },
    disabledPaths: DISABLED_PATHS,
    rateLimit: { enabled: opts.rateLimit ?? true, storage: "database", window: 10, max: 100, customRules: { ...THROTTLE } },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: baseURL.startsWith("https://"),
      cookiePrefix: COOKIE_PREFIX,
      // The client's address, worked out by ./clientAddress.ts before the request reaches Better Auth (the route
      // puts it in this header, overwriting whatever the client sent), so Better Auth reads one plain value.
      ipAddress: { ipAddressHeaders: [CLIENT_ADDRESS_HEADER] },
    },
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    verification: { storeIdentifier: "hashed" },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      revokeSessionsOnPasswordReset: true,
      // A sign-up for an address that is not confirmed yet replaces the earlier one (./guards.ts, review B2).
      onExistingUserSignUp: replaceUnconfirmed(db, mail, secret, link, (email) => auditAs(email, "/sign-up/replaced")),
      resetPasswordTokenExpiresIn: 60 * 60,
      password: { hash: hashPassword, verify: ({ hash, password }: { hash: string; password: string }) => verifyPassword(password, hash) },
      sendResetPassword: async ({ user, token }: { user: { email: string; name: string }; token: string }) =>
        mail.send(render({ kind: "reset-password", to: user.email, name: user.name, link: link("/reset/new", token) })),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, token }: { user: { email: string; name: string }; token: string }) =>
        mail.send(render({ kind: "confirm-email", to: user.email, name: user.name, link: link("/confirm", token) })),
    },
    databaseHooks: {
      user: {
        create: {
          // A workspace of their own for every new account, with the user as its owner.
          after: async (user: { id: string; name: string; email: string }) => {
            await self.auth!.api.createOrganization({
              body: { name: `${user.name || user.email.split("@")[0]}'s workspace`, slug: slugOf(user.id), userId: user.id },
            });
            // Recorded here, where the account really exists, not from the request: a sign-up for an address that
            // already has an account writes no line under a name the sender chose (review F2).
            await auditAs(user.email, "/sign-up/email");
          },
        },
      },
      session: {
        create: {
          // Every session starts in a workspace: the one the user joined first.
          before: async (session: { userId: string } & Record<string, unknown>) => {
            const r = await db.query<{ organizationId: string }>('SELECT "organizationId" FROM member WHERE "userId" = $1 ORDER BY "createdAt", id LIMIT 1', [session.userId]);
            return { data: { ...session, activeOrganizationId: r.rows[0]?.organizationId ?? null } };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        if (ctx.path === "/sign-up/email" || ctx.path === "/update-user") {
          checkImage(body.image);
          if (ctx.path === "/sign-up/email" || "name" in body) return { context: { body: { ...body, name: cleanName(body.name) } } };
          return;
        }
        if (ctx.path === "/verify-email") await confirmedBefore(db, (ctx.query as { token?: unknown } | undefined)?.token);
        if (ctx.path === TOTP_PATH || ctx.path === "/two-factor/verify-backup-code") {
          if (ctx.path === TOTP_PATH) await guardTotp(db, ctx as never);
          // No "trust this device": not decided by the owner, so never set (review F7).
          if (body.trustDevice !== undefined) return { context: { body: { ...body, trustDevice: false } } };
          return;
        }
        if (ctx.path === "/revoke-other-sessions") {
          // Better Auth's own version compares listed tokens with the current one, which hashed storage makes
          // unequal (./tokenHash.ts), so it would end this session too. The same work, by id.
          const s = await getSessionFromCtx(ctx);
          if (!s) return;
          await db.query('DELETE FROM "session" WHERE "userId" = $1 AND id <> $2', [s.user.id, s.session.id]);
          await auditAs(s.user.email, "/revoke-other-sessions");
          return ctx.json({ status: true });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        // Sign-up is recorded by the user-created database hook instead (review F2).
        if (!AUDITED[ctx.path] || ctx.path === "/sign-up/email") return;
        const returned = ctx.context.returned;
        if (returned instanceof Error || (returned instanceof Response && !returned.ok)) return;
        // The actor is the account the request acted on, never an address taken from the request body.
        const fromToken = ctx.path === "/verify-email" ? tokenClaims((ctx.query as { token?: unknown } | undefined)?.token)?.email : undefined;
        const who = ctx.context.newSession?.user.email ?? ctx.context.session?.user.email ?? fromToken;
        await auditAs(who || "unknown", ctx.path);
      }),
    },
    plugins: [
      twoFactor({
        issuer: APP_NAME,
        // Authenticator app and recovery codes only: no one-time codes by email or text message.
        skipVerificationOnEnable: false,
        backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
      }),
      organization({ creatorRole: "owner", requireEmailVerificationOnInvitation: true }),
    ],
  } satisfies BetterAuthOptions;
  return { options, self };
}

async function auditAs(actor: string, path: string) {
  const [action, summary] = AUDITED[path];
  // The audit log must not stop a sign-in; a failure to write it is logged.
  await audit({ actor, action, summary }).catch((e) => console.error(`[auth2] audit line not written: ${(e as Error).message}`));
}

export function makeAuth(db: Pool, opts: Auth2Options = {}) {
  const { options, self } = auth2Options(db, opts);
  const kysely = new Kysely({ dialect: new PostgresDialect({ pool: db }) });
  const base = kyselyAdapter(kysely, { type: "postgres", transaction: true });
  const auth = betterAuth({
    ...options,
    database: (o: BetterAuthOptions) => capSessionLife(hashSessionTokens(base(o)), ABSOLUTE_SESSION_DAYS * 24 * 60 * 60 * 1000),
  });
  self.auth = auth as never;
  return auth;
}

export type Auth2 = ReturnType<typeof makeAuth>;
