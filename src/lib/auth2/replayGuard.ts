/**
 * An authenticator code works once (owner's ruling; trial finding: "the same code is accepted twice within its
 * 30 seconds").
 *
 * Better Auth's two-factor plugin accepts any code from the time steps either side of now and remembers none. This
 * runs before its `/two-factor/verify-totp` endpoint: it finds whose code it is (the signed-in user, or the user
 * halfway through signing in, named by the two-factor cookie), works out which 30-second step the code belongs to
 * with the same rule the plugin uses (RFC 6238: HMAC-SHA1, 6 digits, the step before, now and after), and claims
 * that step in `auth2_totp_steps` in one statement that only succeeds if the step is later than the last one used.
 * A code for a step already used, or older, is refused with CODE_ALREADY_USED; two requests with the same code at
 * the same moment cannot both pass. A code that matches no step is left to the plugin, which refuses it and counts
 * the failure.
 */
import { createHmac } from "node:crypto";
import type { Pool } from "pg";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { symmetricDecrypt } from "better-auth/crypto";

export const TOTP_PATH = "/two-factor/verify-totp";
const PERIOD_S = 30;
const DIGITS = 6;
/** The two-factor plugin's cookie name (better-auth/dist/plugins/two-factor/constant.mjs). */
const TWO_FACTOR_COOKIE = "two_factor";

const CODE_ALREADY_USED = {
  code: "CODE_ALREADY_USED",
  message: "That code has already been used. Wait for the next code from your authenticator app.",
};

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(s: string): Buffer {
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error("not base32");
    bits += v.toString(2).padStart(5, "0");
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

/** The code for one time step (RFC 4226 section 5.3). */
function hotp(key: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", key).update(counter).digest();
  const o = mac[mac.length - 1] & 0xf;
  const bin = ((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** The time step a code belongs to, among the three the plugin accepts, or null. The latest wins a tie. */
function stepOf(key: Buffer, code: string, now = Date.now()): number | null {
  const current = Math.floor(now / 1000 / PERIOD_S);
  for (const step of [current + 1, current, current - 1]) if (hotp(key, step) === code) return step;
  return null;
}

/**
 * Claims a step for a user: true when it is later than every step this user used before, recorded at once;
 * false when it was used already (or an earlier one was, after it).
 */
async function claimStep(db: Pool, userId: string, step: number): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO auth2_totp_steps AS s (user_id, last_step) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET last_step = EXCLUDED.last_step, used_at = now()
     WHERE s.last_step < EXCLUDED.last_step
     RETURNING 1`,
    [userId, step]
  );
  return (r.rowCount ?? 0) > 0;
}

// The parts of Better Auth's endpoint context this reads. Typed loosely on purpose: the hook context's own type
// is generic over the whole configuration.
type HookCtx = {
  path?: string;
  body?: { code?: unknown };
  getSignedCookie: (name: string, secret: string) => Promise<string | null | false>;
  context: {
    secret: string;
    secretConfig: Parameters<typeof symmetricDecrypt>[0]["key"];
    createAuthCookie: (name: string) => { name: string };
    internalAdapter: { findVerificationValue: (id: string) => Promise<{ value: string; expiresAt: Date } | null> };
    adapter: { findOne: <T>(q: { model: string; where: { field: string; value: string }[] }) => Promise<T | null> };
  };
};

async function userOf(ctx: HookCtx): Promise<string | null> {
  const session = await getSessionFromCtx(ctx as never).catch(() => null);
  if (session?.user?.id) return session.user.id;
  const cookie = await ctx.getSignedCookie(ctx.context.createAuthCookie(TWO_FACTOR_COOKIE).name, ctx.context.secret);
  if (!cookie) return null;
  const v = await ctx.context.internalAdapter.findVerificationValue(cookie);
  if (!v || new Date(v.expiresAt).getTime() <= Date.now()) return null;
  return v.value;
}

async function keyOf(ctx: HookCtx, userId: string): Promise<Buffer | null> {
  const row = await ctx.context.adapter.findOne<{ secret: string }>({ model: "twoFactor", where: [{ field: "userId", value: userId }] });
  if (!row) return null;
  const secret = await symmetricDecrypt({ key: ctx.context.secretConfig, data: row.secret });
  // Imported secrets are stored as "base32:<secret>" (the plugin's decryptTOTPSecret); generated ones are used as text.
  return secret.startsWith("base32:") ? base32Decode(secret.slice(7)) : Buffer.from(secret, "utf8");
}

/**
 * The before-hook body for TOTP_PATH. Throws CODE_ALREADY_USED for a replayed code; otherwise lets the plugin decide.
 * The code is taken exactly as sent: anything but six digits is left to the plugin, which refuses it, so a malformed
 * code (" 123456") never claims a step the plugin would then not accept.
 */
export async function guardTotp(db: Pool, ctx: HookCtx): Promise<void> {
  const code = typeof ctx.body?.code === "string" ? ctx.body.code : "";
  if (!/^\d{6}$/.test(code)) return;
  const userId = await userOf(ctx);
  if (!userId) return;
  const key = await keyOf(ctx, userId);
  if (!key) return;
  const step = stepOf(key, code);
  if (step === null) return;
  if (!(await claimStep(db, userId, step))) throw APIError.from("UNAUTHORIZED", CODE_ALREADY_USED);
}
