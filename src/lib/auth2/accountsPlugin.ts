/**
 * Account endpoints of the owner's ruling of 23 Nov, as a Better Auth plugin under the same catch-all route (same
 * origin check, throttle and audit as sign-in):
 *
 * - POST /account/first-password: the first sign-in after an administrator set a temporary password. Better Auth
 *   starts no session for such an account (../auth.ts, PASSWORD_CHANGE_REQUIRED); here the person gives the address,
 *   the temporary password and a new one (under the password rules), and then signs in with the new one. A wrong
 *   temporary password counts towards the lock like any failed sign-in.
 * - POST /account/join: accepts an account invitation (../accountInvitations.ts): chooses the password.
 * - POST /account/reset-request: "Forgotten your password?" while no mail is set up. Nothing can be sent, so the
 *   request is noted on the account for the platform administrator (Users, "asked for a reset"). The answer is the
 *   same whether or not the address has an account; with mail set up it is refused, and the page uses Better Auth's
 *   own /request-password-reset instead.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import type { Pool } from "pg";
import { z } from "zod";
import { CLIENT_ADDRESS_HEADER, hashPassword, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/db";
import * as invitations from "./accountInvitations";
import type { MailSender } from "./mail";
import { checkNewPassword } from "./newPassword";
import { claimRefusal, claimTry, clearTries, failedTry } from "./signInWait";

let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword(`dummy-${Math.random()}`));

const wrong = () => APIError.from("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" });

export function accounts(db: Pool, deps: { mailer: () => Promise<MailSender | null> }) {
  return {
    id: "c2r-accounts",
    endpoints: {
      firstPassword: createAuthEndpoint(
        "/account/first-password",
        { method: "POST", body: z.object({ email: z.string().max(320), password: z.string().max(200), newPassword: z.string().max(400) }) },
        async (ctx) => {
          const email = ctx.body.email.trim().toLowerCase();
          const client = ctx.headers?.get(CLIENT_ADDRESS_HEADER) ?? "";
          const refused = claimRefusal(await claimTry(db, email, client));
          if (refused) throw refused;
          const r = await db.query<{ id: string; email: string; name: string; password: string | null; must: boolean }>(
            `SELECT u.id, u.email, u.name, a.password, u."mustChangePassword" AS must FROM "user" u
               LEFT JOIN account a ON a."userId" = u.id AND a."providerId" = 'credential' WHERE lower(u.email) = $1`,
            [email]
          );
          const row = r.rows[0];
          // The same work whether or not the account exists.
          const ok = await verifyPassword(ctx.body.password, row?.password ?? (await dummy()));
          if (!row || !row.password || !ok) {
            await failedTry(db, email);
            throw wrong();
          }
          await clearTries(db, email, client);
          if (!row.must) throw APIError.from("BAD_REQUEST", { code: "PASSWORD_CHANGE_NOT_REQUIRED", message: "This account's password does not have to be changed. Sign in as usual." });
          const pw = await checkNewPassword(db, ctx.body.newPassword, row);
          if (pw === ctx.body.password) throw APIError.from("BAD_REQUEST", { code: "PASSWORD_RULE", message: "Choose a password other than the temporary one." });
          const hash = await hashPassword(pw);
          await db.query(`UPDATE account SET password = $2, "updatedAt" = now() WHERE "userId" = $1 AND "providerId" = 'credential'`, [row.id, hash]);
          await db.query(`UPDATE "user" SET "mustChangePassword" = false, "resetRequestedAt" = NULL, "updatedAt" = now() WHERE id = $1`, [row.id]);
          await db.query('DELETE FROM "session" WHERE "userId" = $1', [row.id]);
          await audit({ actor: row.email, action: "account.password_changed_first", summary: "Chose a password of their own in place of the temporary one an administrator set" });
          return ctx.json({ changed: true });
        }
      ),

      join: createAuthEndpoint("/account/join", { method: "POST", body: z.object({ token: z.string().max(200), password: z.string().max(400) }) }, async (ctx) => {
        const { email } = await invitations.accept(db, ctx.body.token, ctx.body.password);
        return ctx.json({ joined: true, email });
      }),

      resetRequest: createAuthEndpoint("/account/reset-request", { method: "POST", body: z.object({ email: z.string().max(320) }) }, async (ctx) => {
        if (await deps.mailer()) throw APIError.from("BAD_REQUEST", { code: "USE_RESET_LINK", message: "Mail is set up: ask for a reset link instead." });
        const email = ctx.body.email.trim().toLowerCase();
        const r = await db.query<{ id: string; email: string }>(
          `UPDATE "user" SET "resetRequestedAt" = now() WHERE lower(email) = $1 AND "disabledAt" IS NULL AND ("resetRequestedAt" IS NULL OR "resetRequestedAt" < now() - interval '1 hour') RETURNING id, email`,
          [email]
        );
        // Recorded under the account's own address, never one taken from the request (review F2): an unknown
        // address writes nothing.
        const u = r.rows[0];
        if (u) await audit({ actor: u.email, action: "account.reset_requested", summary: "Asked for a password reset while no mail is set up; shown to the platform administrator", detail: { userId: u.id } });
        return ctx.json({ status: true });
      }),
    },
  } satisfies BetterAuthPlugin;
}
