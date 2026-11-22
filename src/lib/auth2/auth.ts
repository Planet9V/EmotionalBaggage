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
 *   starts in one. The organization plugin supplies the tables only: every one of its endpoints is switched off,
 *   and workspaces, members and invitations are changed through ./workspaces/plugin.ts, which holds its own
 *   permission rules (./workspaces/permissions.ts).
 * - Sign-up, sign-in, sign-out, password and two-factor changes are written to the audit log.
 * - Besides the per-address throttle, every password try earns a growing wait per account (./signInWait.ts).
 *
 * The owner's database connection is used (src/lib/db.ts ownerPool): the request role cannot read these tables.
 */
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { organization, twoFactor } from "better-auth/plugins";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely, PostgresDialect } from "kysely";
import type { Pool } from "pg";
import { CLIENT_ADDRESS_HEADER, hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { audit } from "@/lib/db";
import { AUTH2_BASE_PATH, AUTH2_PAGES, envBaseURL, envSecret } from "./config";
import { currentMailSender, render, type MailSender } from "./mail";
import { checkImage, cleanName, confirmedBefore, replaceUnconfirmed, tokenClaims, wellFormed } from "./guards";
import { workspaces } from "./workspaces/plugin";
import { createPersonal } from "./workspaces/store";
import { proofOwed, proofSpent, requiredFor } from "./workspaces/twoFactor";
import { claimTry, clearTries, hasTag, KNOWN_DEVICE_COOKIE, waitRefusal, withTag } from "./signInWait";
import { guardTotp, TOTP_PATH } from "./replayGuard";
import { capSessionLife } from "./sessionLife";
import { hashSessionTokens } from "./tokenHash";

const APP_NAME = "Concept to Realization";
const COOKIE_PREFIX = "c2r2";
const SESSION_DAYS = 30;
const ABSOLUTE_SESSION_DAYS = 90;
const MAX_PASSWORD_LENGTH = 128;

const ORGANIZATION_OPTIONS = { creatorRole: "owner", requireEmailVerificationOnInvitation: true } as const;

/**
 * Every endpoint of the organization plugin, read from the plugin itself so one added by an upgrade is off too. The
 * plugin's rules are not this app's (it lets an admin invite an owner, keeps invitation ids as their own tokens, and
 * clears the active workspace on a refused switch), so its tables are used through ./workspaces/ only.
 */
const ORGANIZATION_PATHS = Object.values(organization(ORGANIZATION_OPTIONS).endpoints).map((e) => (e as { path: string }).path);

/** Better Auth endpoints that are off: they need a session token handed back (see ./tokenHash.ts), are not offered,
 *  or are the organization plugin's (above). */
const DISABLED_PATHS = [
  // two-factor codes by email or text message: not offered
  "/two-factor/send-otp",
  "/two-factor/verify-otp",
  "/list-sessions",
  "/revoke-session",
  // checks a password and answers yes or no, with no screen using it: an oracle for guessing (review B5)
  "/verify-password",
  ...ORGANIZATION_PATHS,
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
  "/workspace/create": { window: 60, max: 3 },
  "/workspace/delete": { window: 60, max: 3 },
  "/workspace/member/reset-two-factor": { window: 60, max: 5 },
  "/re-enrol": { window: 60, max: 5 },
  // Each of these sends an email (or makes a link): per network address, besides the per-workspace limits.
  "/workspace/invite": { window: 60, max: 10 },
  "/workspace/invitation/resend": { window: 60, max: 5 },
  "/workspace/invitation/accept": { window: 60, max: 10 },
} as const;

export type Auth2Options = {
  baseURL?: string;
  secret?: string;
  /** Where mail goes: a sender, null for "no mail" mode, or (left out) whatever currentMailSender() says per message. */
  mail?: MailSender | null;
  /** More addresses besides the base address that may send forms (resolved by ./config.ts). */
  trustedOrigins?: string[];
  /** The throttle; on unless a test turns it off. */
  rateLimit?: boolean;
};

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
  const mailer = opts.mail === undefined ? currentMailSender : async () => opts.mail ?? null;
  // Better Auth's callbacks get a sender that asks at each message; in "no mail" mode it sends nothing.
  const mail: MailSender = {
    send: async (m) => {
      const sender = await mailer();
      if (sender) return sender.send(m);
      // "No mail" mode: nothing of the message (no address, no link) reaches the log.
      console.info("[auth2 mail] no mail service is configured: one message was not sent.");
    },
  };
  const baseURL = (opts.baseURL ?? envBaseURL()).replace(/\/+$/, "");
  const link = (path: string, token: string) => `${baseURL}${AUTH2_PAGES}${path}?token=${encodeURIComponent(token)}`;

  const secret = opts.secret ?? envSecret();
  if (!secret) throw new Error("The new sign-in was built without its secret; build it through auth2() in ./server.ts, which reads it from the database.");
  const options = {
    appName: APP_NAME,
    baseURL,
    basePath: AUTH2_BASE_PATH,
    secret,
    trustedOrigins: [...new Set([new URL(baseURL).origin, ...(opts.trustedOrigins ?? [])])],
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
      sendResetPassword: async ({ user, token }: { user: { id: string; email: string; name: string }; token: string }) => {
        // A disabled account gets no reset link; the answer to the request is the same as for any address (N14).
        const off = await db.query('SELECT 1 FROM "user" WHERE id = $1 AND "disabledAt" IS NOT NULL', [user.id]);
        if (off.rowCount) {
          await db.query("DELETE FROM verification WHERE value = $1", [user.id]);
          return;
        }
        await mail.send(render({ kind: "reset-password", to: user.email, name: user.name, link: link("/reset/new", token) }));
      },
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
            await createPersonal(db, user);
            // Recorded here, where the account really exists, not from the request: a sign-up for an address that
            // already has an account writes no line under a name the sender chose (review F2).
            await auditAs(user.email, "/sign-up/email");
          },
        },
      },
      session: {
        create: {
          // Every session starts in a workspace: the one the user joined first. A disabled account gets none: this
          // runs only once the password (and code) were right, so the refusal tells nothing to a guesser.
          before: async (session: { userId: string } & Record<string, unknown>) => {
            const off = await db.query('SELECT 1 FROM "user" WHERE id = $1 AND "disabledAt" IS NOT NULL', [session.userId]);
            if (off.rowCount) throw APIError.from("FORBIDDEN", { code: "ACCOUNT_DISABLED", message: "This account has been disabled by an administrator." });
            // Two-factor reset by someone else: the password alone starts no session until the proof is given (B4).
            if (await proofOwed(db, session.userId)) {
              throw APIError.from("FORBIDDEN", { code: "REENROL_PROOF_REQUIRED", message: "Your two-step sign-in was reset. Use the link we emailed you, or the code from whoever reset it." });
            }
            const r = await db.query<{ organizationId: string }>('SELECT "organizationId" FROM member WHERE "userId" = $1 ORDER BY "createdAt", id LIMIT 1', [session.userId]);
            return { data: { ...session, activeOrganizationId: r.rows[0]?.organizationId ?? null } };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        // No lone surrogates in any text field (review B1): PostgreSQL would refuse them halfway through the work.
        if (!Object.values(body).every(wellFormed)) throw APIError.from("BAD_REQUEST", { code: "INVALID_TEXT", message: "A field holds characters that are not valid text." });
        if (ctx.path === "/sign-up/email" || ctx.path === "/update-user") {
          checkImage(body.image);
          if (ctx.path === "/sign-up/email" || "name" in body) return { context: { body: { ...body, name: cleanName(body.name) } } };
          return;
        }
        if (ctx.path === "/sign-in/email" && typeof body.email === "string") {
          // Per account, before the password is checked (./signInWait.ts, review N4). Better Auth's per-address
          // throttle has already run.
          const knownDevice = hasTag(ctx.getCookie(KNOWN_DEVICE_COOKIE), secret, body.email);
          const wait = await claimTry(db, body.email, ctx.headers?.get(CLIENT_ADDRESS_HEADER) ?? "", new Date(), { knownDevice });
          if (wait !== null) throw waitRefusal(wait);
        }
        if (ctx.path === "/verify-email") await confirmedBefore(db, (ctx.query as { token?: unknown } | undefined)?.token);
        if (ctx.path === "/two-factor/disable") {
          // Required by a workspace: it cannot be turned off (slice 2, step 4). An owner or admin can reset it instead.
          const s = await getSessionFromCtx(ctx);
          if (s && (await requiredFor(db, s.user.id))) {
            throw APIError.from("FORBIDDEN", { code: "TWO_FACTOR_REQUIRED_BY_WORKSPACE", message: "A workspace you belong to requires two-step sign-in, so it cannot be turned off." });
          }
        }
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
        if (ctx.path === TOTP_PATH) {
          // Set up again after a reset: the proof is spent once the app is on.
          const r = ctx.context.returned;
          const s = ctx.context.session ?? ctx.context.newSession;
          if (s && !(r instanceof Error) && !(r instanceof Response && !r.ok)) {
            const on = await db.query('SELECT 1 FROM "user" WHERE id = $1 AND "twoFactorEnabled"', [s.user.id]);
            if (on.rowCount) await proofSpent(db, s.user.id);
          }
        }
        if (ctx.path === "/sign-in/email") {
          const r = ctx.context.returned;
          const email = (ctx.body as { email?: unknown } | undefined)?.email;
          if (typeof email === "string" && !(r instanceof Error) && !(r instanceof Response && !r.ok)) {
            await clearTries(db, email);
            // This browser has now signed in to this account: it skips the name-wide wait next time (review B5).
            ctx.setCookie(KNOWN_DEVICE_COOKIE, withTag(ctx.getCookie(KNOWN_DEVICE_COOKIE), secret, email), {
              httpOnly: true, sameSite: "lax", secure: baseURL.startsWith("https://"), path: AUTH2_BASE_PATH, maxAge: 365 * 24 * 60 * 60,
            });
          }
        }
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
      organization(ORGANIZATION_OPTIONS),
      workspaces(db, { mailer, link }),
    ],
  } satisfies BetterAuthOptions;
  return { options };
}

async function auditAs(actor: string, path: string) {
  const [action, summary] = AUDITED[path];
  // The audit log must not stop a sign-in; a failure to write it is logged.
  await audit({ actor, action, summary }).catch((e) => console.error(`[auth2] audit line not written: ${(e as Error).message}`));
}

export function makeAuth(db: Pool, opts: Auth2Options = {}) {
  const { options } = auth2Options(db, opts);
  const kysely = new Kysely({ dialect: new PostgresDialect({ pool: db }) });
  const base = kyselyAdapter(kysely, { type: "postgres", transaction: true });
  const auth = betterAuth({
    ...options,
    database: (o: BetterAuthOptions) => capSessionLife(hashSessionTokens(base(o)), ABSOLUTE_SESSION_DAYS * 24 * 60 * 60 * 1000),
  });
  return auth;
}

export type Auth2 = ReturnType<typeof makeAuth>;
