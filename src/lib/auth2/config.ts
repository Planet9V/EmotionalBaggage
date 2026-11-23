/**
 * The switch and the settings of the new sign-in, all kept in PostgreSQL (owner's rulings of 22 Nov: "everything
 * is stored in Postgres", "Docker first"). With `docker compose up` and nothing else the app runs; the only
 * configuration outside the database is the database connection itself.
 *
 * Where each value comes from, first match wins:
 *
 * | Value              | 1. environment (optional override)  | 2. PostgreSQL                                      | 3. otherwise                         |
 * |--------------------|-------------------------------------|----------------------------------------------------|--------------------------------------|
 * | the switch         | AUTH2 (1/on/true/yes or 0/off/...)  | auth2_settings `auth2.enabled`                     | off when stored as off or not stored; a failed read keeps the last value read, or answers 503 |
 * | signing secret     | BETTER_AUTH_SECRET                  | table auth2_secrets, made on first use             | (always made)                        |
 * | base address       | BETTER_AUTH_URL                     | auth2_settings `auth2.baseUrl`                     | http://localhost:PORT outside production; in production none until the first-run page stores the address the owner confirms |
 * | other addresses    | AUTH2_TRUSTED_ORIGINS               | auth2_settings `auth2.trustedOrigins`              | none                                 |
 *
 * auth2_settings and auth2_secrets are read and written on the owner's connection only, through the functions
 * here; the request role can neither read nor write them (review F6: they used to be in `settings`, which it can
 * write). A platform administrator changes the addresses with adminOps().setAddresses.
 *
 * The environment wins where both exist, so tests and development can force a value; nobody has to set one. A
 * base address that is not https in production is a warning shown to the platform administrator, not a refusal.
 * The secret lives in a table the request role cannot read (src/lib/auth2/dbRoles.ts, WITHHELD).
 */
import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";

const ON = /^(1|true|yes|on)$/i;
const OFF = /^(0|false|no|off)$/i;

export const AUTH2_BASE_PATH = "/api/auth2";
/** Where the new screens live (src/app/(account)/auth/). */
export const AUTH2_PAGES = "/auth";

export const AUTH2_SETTING = {
  enabled: "auth2.enabled",
  baseUrl: "auth2.baseUrl",
  trustedOrigins: "auth2.trustedOrigins",
  /** The address the first-run page offers; empty unless stored (migration 0044 cleared the old seeded suggestion). */
  platformAdminAddress: "auth2.platformAdminAddress",
  // The account rules of 23 Nov (./rules.ts reads and checks them; defaults there).
  inviteExpiryDays: "invites.expiryDays",
  maxFailures: "signIn.maxFailures",
  lockMinutes: "signIn.lockMinutes",
  passwordPolicy: "password.policy",
  notifySignupRequestsTo: "notify.signupRequestsTo",
  signUpOpen: "signUp.open",
  viewAsMinutes: "impersonation.minutes",
  viewAsNotifyUser: "impersonation.notifyUser",
  notifyLockAlertsTo: "notify.lockAlertsTo",
} as const;

const isProduction = () => process.env.NODE_ENV === "production";

/** The AUTH2 environment override: true or false when set to a known word, null when not set. */
export function override(): boolean | null {
  const v = process.env.AUTH2?.trim() ?? "";
  if (ON.test(v)) return true;
  if (OFF.test(v)) return false;
  return null;
}

const CACHE_MS = 5_000;
const g = globalThis as unknown as {
  __c2rAuth2Switch?: { value: boolean; at: number };
  /** the last value read successfully in this process; never cleared by forgetAuth2Switch (cut-over review B2) */
  __c2rAuth2Known?: boolean;
  __c2rAuth2Config?: { db: unknown; env: string; at: number; config: Auth2Config };
};

/** The switch could not be read and this process has never read it: answer 503, never "off" (cut-over review B2). */
export class SwitchUnavailable extends Error {
  readonly status = 503;
  constructor() {
    super("The application is temporarily unavailable. Try again in a minute.");
  }
}

/**
 * Whether the new sign-in is on: the AUTH2 override, else the stored setting (read at most every five seconds).
 * A failed read never turns it off (cut-over review B2): it keeps the last value read successfully in this process,
 * so once read as on it stays on until a successful read says off; with no value read yet it throws
 * SwitchUnavailable, which routes and the proxy answer as 503.
 */
export async function auth2Enabled(): Promise<boolean> {
  const o = override();
  if (o !== null) return o;
  const c = g.__c2rAuth2Switch;
  if (c && Date.now() - c.at < CACHE_MS) return c.value;
  let value: boolean;
  try {
    const { ownerPool, ready } = await import("@/lib/db");
    await ready();
    value = await storedSwitch(ownerPool());
  } catch (e) {
    const known = g.__c2rAuth2Known;
    console.error(`[auth2] the switch could not be read, ${known === undefined ? "so the app answers 503" : `so the last value read is kept: ${known ? "on" : "off"}`}: ${(e as Error).message}`);
    if (known === undefined) throw new SwitchUnavailable();
    // Tried again on the next request, not held for the cache window.
    return known;
  }
  g.__c2rAuth2Known = value;
  g.__c2rAuth2Switch = { value, at: Date.now() };
  return value;
}

/**
 * The switch without waiting: the override, else the last value auth2Enabled() read in this process. For the root
 * layout only, which must not query the database (it renders static pages too); every request passes the proxy,
 * which reads the switch first.
 */
export const auth2EnabledNow = (): boolean => override() ?? g.__c2rAuth2Switch?.value ?? g.__c2rAuth2Known ?? false;

/** The stored switch, read straight from auth2_settings (ready() uses this after the migrations: review N13). */
export async function storedSwitch(db: Queryable): Promise<boolean> {
  return (await readAuth2Setting<unknown>(db, AUTH2_SETTING.enabled)) === true;
}

/** Forgets the cached switch and settings, after one of them changes. */
export function forgetAuth2Switch() {
  g.__c2rAuth2Switch = undefined;
  g.__c2rAuth2Config = undefined;
}

type Queryable = Pick<Pool, "query"> | PoolClient;
type Auth2SettingKey = (typeof AUTH2_SETTING)[keyof typeof AUTH2_SETTING];

/** One of the new sign-in's settings, or null. `db` must be the owner's connection. */
export async function readAuth2Setting<T>(db: Queryable, key: Auth2SettingKey): Promise<T | null> {
  const r = await db.query<{ value: T }>("SELECT value FROM auth2_settings WHERE key = $1", [key]);
  return r.rows[0]?.value ?? null;
}

/** Stores one of the new sign-in's settings (null removes it). `db` must be the owner's connection. */
export async function writeAuth2Setting(db: Queryable, key: Auth2SettingKey, value: unknown, by = ""): Promise<void> {
  if (value === null) await db.query("DELETE FROM auth2_settings WHERE key = $1", [key]);
  else {
    await db.query(
      `INSERT INTO auth2_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [key, JSON.stringify(value), by]
    );
  }
  forgetAuth2Switch();
}

const SECRET_HELP = "(for example: openssl rand -base64 48), or leave it out and the app keeps its own";
/** Words that put a secret in a dictionary: a random secret of this length does not contain them. */
const WORDS = /secret|password|passwd|changeme|example|default|better.?auth|letmein|qwerty|123456|abcdef/i;

/**
 * Why a secret is unfit, or null. Random secrets pass; typed ones usually do not. Rules: at least 32 characters;
 * at least 10 different characters; no character more than a fifth of the whole; at least 128 bits by the rough
 * estimate length x log2(different characters); no dictionary word.
 */
export function secretProblem(s: string): string | null {
  if (s.length < 32) return `BETTER_AUTH_SECRET must be at least 32 random characters ${SECRET_HELP}.`;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const distinct = counts.size;
  const most = Math.max(...counts.values());
  if (distinct < 10 || most > s.length / 5 || s.length * Math.log2(distinct) < 128) {
    return `BETTER_AUTH_SECRET is not random enough: it repeats too few characters. Make a new one ${SECRET_HELP}.`;
  }
  if (WORDS.test(s)) return `BETTER_AUTH_SECRET contains a word or a run anyone could guess. Make a random one ${SECRET_HELP}.`;
  return null;
}

/** The BETTER_AUTH_SECRET override: null when not set; a set value that is unfit is refused (it was chosen by someone). */
export function envSecret(): string | null {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s === undefined || s === "") return null;
  const problem = secretProblem(s);
  if (problem) throw new Error(problem);
  return s;
}

/** An address as an origin-less base (no trailing slash), or a plain sentence naming where it came from. */
function asBase(raw: string, from: string): string {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
    return raw.replace(/\/+$/, "");
  } catch {
    throw new Error(`${from} is not an address, for example https://app.example.com.`);
  }
}

/** The base address from the environment only (tests and makeAuth's defaults): BETTER_AUTH_URL, else this machine. */
export function envBaseURL(): string {
  const set = process.env.BETTER_AUTH_URL?.trim();
  return set ? asBase(set, "BETTER_AUTH_URL") : `http://localhost:${process.env.PORT?.trim() || "3000"}`;
}

const originsOf = (list: string[], from: string) =>
  list.map((s) => s.trim()).filter(Boolean).map((s) => {
    try {
      return new URL(s).origin;
    } catch {
      throw new Error(`${from} has an entry that is not an address: ${s}`);
    }
  });

export type Auth2Config = {
  secret: string;
  /** Null in production until the first-run page has stored the address the owner confirmed. */
  baseURL: string | null;
  trustedOrigins: string[];
  /** Shown to a platform administrator; never a reason not to start. */
  warnings: string[];
};

/** The signing secret: the override, else the stored one, made once (two starts at once keep the same one). */
async function storedSecret(db: Pool): Promise<string> {
  const fromEnv = envSecret();
  if (fromEnv) return fromEnv;
  const made = randomBytes(48).toString("base64url");
  await db.query("INSERT INTO auth2_secrets (name, value) VALUES ('better-auth', $1) ON CONFLICT (name) DO NOTHING", [made]);
  const r = await db.query<{ value: string }>("SELECT value FROM auth2_secrets WHERE name = 'better-auth'");
  return r.rows[0].value;
}

/**
 * Everything the new sign-in needs, resolved as in the table at the top. `db` is the owner's pool. Kept for five
 * seconds, as the switch is (review N15); a change through writeAuth2Setting is seen at once.
 */
export async function resolveAuth2Config(db: Pool): Promise<Auth2Config> {
  // The environment overrides are part of what is cached against: a changed one is read at once.
  const env = [process.env.BETTER_AUTH_SECRET, process.env.BETTER_AUTH_URL, process.env.AUTH2_TRUSTED_ORIGINS, process.env.NODE_ENV].join("\u0000");
  const held = g.__c2rAuth2Config;
  if (held && held.db === db && held.env === env && Date.now() - held.at < CACHE_MS) return held.config;
  const config = await resolveNow(db);
  g.__c2rAuth2Config = { db, env, at: Date.now(), config };
  return config;
}

async function resolveNow(db: Pool): Promise<Auth2Config> {
  const secret = await storedSecret(db);
  return { secret, ...(await resolveAddresses(db)) };
}

export type Auth2Addresses = Omit<Auth2Config, "secret">;

/**
 * The addresses only, resolved as in the table at the top: reads, never creates anything (no secret is made). For
 * Admin, Sign-in and for checking a change of the addresses inside its transaction (`db` may be its client).
 */
export async function resolveAddresses(db: Queryable): Promise<Auth2Addresses> {
  const setting = <T>(key: Auth2SettingKey) => readAuth2Setting<T>(db, key);
  const envURL = process.env.BETTER_AUTH_URL?.trim();
  const savedURL = await setting<string>(AUTH2_SETTING.baseUrl);
  let baseURL: string | null = null;
  if (envURL) baseURL = asBase(envURL, "BETTER_AUTH_URL");
  else if (typeof savedURL === "string" && savedURL) baseURL = asBase(savedURL, `The setting ${AUTH2_SETTING.baseUrl}`);
  else if (!isProduction()) baseURL = envBaseURL();
  const envOrigins = process.env.AUTH2_TRUSTED_ORIGINS?.trim();
  const savedOrigins = await setting<unknown>(AUTH2_SETTING.trustedOrigins);
  const more = envOrigins
    ? originsOf(envOrigins.split(","), "AUTH2_TRUSTED_ORIGINS")
    : Array.isArray(savedOrigins)
      ? originsOf(savedOrigins.filter((x): x is string => typeof x === "string"), `The setting ${AUTH2_SETTING.trustedOrigins}`)
      : [];
  const trustedOrigins = [...new Set([...(baseURL ? [new URL(baseURL).origin] : []), ...more])];
  const warnings: string[] = [];
  if (isProduction() && baseURL && !baseURL.startsWith("https://")) {
    warnings.push(`The sign-in address is ${baseURL}, not https: sign-in cookies are sent unencrypted. Serve the app over https and change the address.`);
  }
  if (isProduction() && !baseURL) warnings.push("The sign-in address is not set yet. It is stored when the owner is created on the first-run page.");
  return { baseURL, trustedOrigins, warnings };
}

/**
 * Checks of values someone set in the environment, run at start (ready() in src/lib/db.ts): a weak
 * BETTER_AUTH_SECRET, an unreadable address, a TRUSTED_PROXIES entry that is not an address. A value nobody set is
 * never a reason to stop.
 */
export async function checkAuth2Settings(): Promise<void> {
  envSecret();
  if (process.env.BETTER_AUTH_URL?.trim()) envBaseURL();
  if (process.env.AUTH2_TRUSTED_ORIGINS?.trim()) originsOf(process.env.AUTH2_TRUSTED_ORIGINS.split(","), "AUTH2_TRUSTED_ORIGINS");
  (await import("./clientAddress")).trustedProxies();
}
