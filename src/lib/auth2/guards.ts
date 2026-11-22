/**
 * Checks that run before Better Auth's own endpoints, and the work done when someone signs up with an address that
 * already has an account (security review, 22 Nov: B2, F1, F7).
 */
import type { Pool } from "pg";
import { APIError, createEmailVerificationToken } from "better-auth/api";
import { hashPassword } from "@/lib/auth";
import { render, type MailSender } from "./mail";
import { personalSlug } from "./workspaces/store";

// --- F1: names and pictures -------------------------------------------------------------------------------------

const MAX_NAME = 80;
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
/** Anything a mail client or a page would turn into a link. */
const LINKISH = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ru|cn|info|biz|xyz|app|dev|link|me|ly|top|site|online|shop)\b)/i;

const refuse = (code: string, message: string) => APIError.from("BAD_REQUEST", { code, message });

/**
 * A name as it may be stored: control characters and line breaks become spaces, runs of space collapse. Refused
 * when empty, over MAX_NAME characters, or when it holds an address (a name is shown in emails and to other
 * members, so it must not carry a link).
 */
export function cleanName(raw: unknown): string {
  return cleanLabel(raw, MAX_NAME, { empty: ["INVALID_NAME", "Enter your name."], long: ["NAME_TOO_LONG", `Keep the name to ${MAX_NAME} characters.`], link: ["NAME_HAS_LINK", "A name cannot contain a web address."] });
}

/** A workspace's name has the same rules as a person's (it is shown in invitation emails), a little longer. */
const MAX_WORKSPACE_NAME = 100;
export function cleanWorkspaceName(raw: unknown): string {
  return cleanLabel(raw, MAX_WORKSPACE_NAME, {
    empty: ["INVALID_WORKSPACE_NAME", "Enter a name for the workspace."],
    long: ["WORKSPACE_NAME_TOO_LONG", `Keep the workspace name to ${MAX_WORKSPACE_NAME} characters.`],
    link: ["WORKSPACE_NAME_HAS_LINK", "A workspace name cannot contain a web address."],
  });
}

type Refusals = { empty: [string, string]; long: [string, string]; link: [string, string] };
function cleanLabel(raw: unknown, max: number, r: Refusals): string {
  // A lone surrogate is valid JSON text but not a string PostgreSQL will store (review B1): refused up front.
  if (typeof raw !== "string" || !raw.isWellFormed()) throw refuse(...r.empty);
  const name = raw.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  if (!name) throw refuse(...r.empty);
  if ([...name].length > max) throw refuse(...r.long);
  if (LINKISH.test(name)) throw refuse(...r.link);
  return name;
}

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/**
 * An email address as this app accepts it from anyone: well-formed text (no lone surrogate), trimmed, lower case,
 * at most 254 characters, one @ and a dot after it. The one check for invitations, platform administration and the
 * first-run page; Better Auth's own endpoints get the well-formed check in ./auth.ts.
 */
export function cleanEmail(raw: unknown): string {
  const e = typeof raw === "string" && raw.isWellFormed() ? raw.trim().toLowerCase() : "";
  if (!e || e.length > 254 || !EMAIL.test(e)) throw refuse("INVALID_EMAIL", "Enter a whole email address, such as name@example.com.");
  return e;
}

/** Any text field from a request: refused when it holds a lone surrogate. */
export function wellFormed(v: unknown): boolean {
  return typeof v !== "string" || v.isWellFormed();
}

/** A picture address: empty, or https and at most 2,048 characters. */
export function checkImage(raw: unknown): void {
  if (raw === undefined || raw === null || raw === "") return;
  if (typeof raw === "string" && raw.length <= 2048) {
    try {
      if (new URL(raw).protocol === "https:") return;
    } catch {
      // falls through to the refusal
    }
  }
  throw refuse("INVALID_IMAGE", "A picture must be an https address.");
}

// --- B2: sign-up for an address that already has an account ----------------------------------------------------

type Existing = { id: string; email: string; name: string; emailVerified: boolean };

/**
 * Better Auth answers a sign-up for an existing address exactly as for a new one, and changes nothing. That left an
 * attack: sign up a victim's address first with your own password; the victim's own sign-up later changes nothing
 * and their confirmation link confirms the account with the attacker's password.
 *
 * So, for an address that is not confirmed yet, the newest sign-up wins: its password and name replace the old
 * ones, every session, two-factor enrolment and reset link of the account ends, links sent before stop working
 * (verify-email checks against "updatedAt", see confirmedBefore below), and a fresh confirmation link is sent. For a
 * confirmed address nothing changes. The answer is Better Auth's own, the same in every case; this work runs after
 * it, so the time taken does not tell the cases apart either.
 */
export function replaceUnconfirmed(db: Pool, mail: MailSender, secret: string, link: (path: string, token: string) => string, onDone: (email: string) => Promise<void>) {
  return async ({ user }: { user: Existing }, request?: Request) => {
    if (user.emailVerified) return;
    let body: { password?: unknown; name?: unknown } = {};
    try {
      body = (await request?.clone().json()) ?? {};
    } catch {
      return;
    }
    if (typeof body.password !== "string") return;
    let name: string;
    try {
      name = cleanName(body.name);
    } catch {
      return;
    }
    const password = body.password;
    // Not awaited: the answer must not wait for a second password hash.
    void (async () => {
      const hash = await hashPassword(password);
      // The next whole second, by this process's clock (the same clock that stamps the new link below).
      const floor = new Date((Math.floor(Date.now() / 1000) + 1) * 1000);
      const c = await db.connect();
      try {
        await c.query("BEGIN");
        const still = await c.query('SELECT 1 FROM "user" WHERE id = $1 AND NOT "emailVerified" FOR UPDATE', [user.id]);
        if (!still.rowCount) {
          await c.query("ROLLBACK");
          return;
        }
        // updatedAt moves to now: confirmation links issued before this second stop working (confirmedBefore).
        await c.query('UPDATE "user" SET name = $2, "updatedAt" = $3 WHERE id = $1', [user.id, name, floor]);
        await c.query(`UPDATE account SET password = $2, "updatedAt" = now() WHERE "userId" = $1 AND "providerId" = 'credential'`, [user.id, hash]);
        await c.query('DELETE FROM "session" WHERE "userId" = $1', [user.id]);
        await c.query('DELETE FROM "twoFactor" WHERE "userId" = $1', [user.id]);
        // Reset links and two-factor challenges carry the user's id as their value.
        await c.query("DELETE FROM verification WHERE value = $1", [user.id]);
        await c.query("UPDATE organization SET name = $2 WHERE slug = $1", [personalSlug(user.id), `${name}'s workspace`]);
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK").catch(() => undefined);
        throw e;
      } finally {
        c.release();
      }
      // Issued after the new updatedAt second, so it is the one link that works.
      await new Promise((r) => setTimeout(r, Math.max(0, floor.getTime() - Date.now()) + 5));
      const token = await createEmailVerificationToken(secret, user.email, undefined, 24 * 60 * 60);
      await mail.send(render({ kind: "confirm-email", to: user.email, name, link: link("/confirm", token) }));
      await onDone(user.email);
    })().catch((e) => console.error(`[auth2] replacing an unconfirmed sign-up failed: ${(e as Error).message}`));
  };
}

/** The email and issue time inside a confirmation token, read without checking it (Better Auth checks it next). */
export function tokenClaims(token: unknown): { email: string; iat: number } | null {
  if (typeof token !== "string") return null;
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: unknown; iat?: unknown };
    return typeof p.email === "string" && typeof p.iat === "number" ? { email: p.email.toLowerCase(), iat: p.iat } : null;
  } catch {
    return null;
  }
}

/**
 * Refuses a confirmation link issued before the account last changed while unconfirmed (a sign-up that replaced
 * an earlier one), so only the newest link works.
 */
export async function confirmedBefore(db: Pool, token: unknown): Promise<void> {
  const claims = tokenClaims(token);
  if (!claims) return;
  const r = await db.query<{ updatedAt: Date; emailVerified: boolean }>('SELECT "updatedAt", "emailVerified" FROM "user" WHERE email = $1', [claims.email]);
  const u = r.rows[0];
  if (!u || u.emailVerified) return;
  if (claims.iat < Math.floor(new Date(u.updatedAt).getTime() / 1000)) {
    throw APIError.from("UNAUTHORIZED", { code: "INVALID_TOKEN", message: "Invalid token" });
  }
}
