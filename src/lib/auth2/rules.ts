/**
 * The account rules of the owner's ruling of 23 Nov, as settings the platform administrator changes in Admin
 * (Sign-in and Email), stored in auth2_settings on the owner's connection (./config.ts). Each has a default here, and
 * a stored value outside its bounds is never used: it is brought inside them.
 *
 * | Setting                     | Default          | Bounds                                  | Read by                         |
 * |-----------------------------|------------------|-----------------------------------------|---------------------------------|
 * | invites.expiryDays          | 7                | 1 to 30                                 | account and workspace invitations |
 * | signIn.maxFailures          | 7                | 3 to 20                                 | the lock (./signInWait.ts)      |
 * | signIn.lockMinutes          | 30               | 5 to 1440, or 0: until an administrator unlocks | the lock                |
 * | password.policy             | ./passwordPolicy.ts DEFAULT_PASSWORD_POLICY | minimum length 8 to 64 | every new password |
 * | notify.signupRequestsTo     | jim@eigenia.nl   | an address, or "" for none              | ./notify.ts                     |
 * | signUp.open                 | false            | true or false                           | the sign-up endpoint and page   |
 *
 * The defaults are the engineer's (labelled as defaults in docs/TASKS.md), except 7 days, 7 tries and the address,
 * which are the owner's words.
 */
import type { Pool, PoolClient } from "pg";
import { APIError } from "better-auth/api";
import { auditIn } from "@/lib/db";
import { AUTH2_SETTING, writeAuth2Setting } from "./config";
import { cleanEmail } from "./guards";
import { DEFAULT_PASSWORD_POLICY, normalizePolicy, type PasswordPolicy } from "./passwordPolicy";

type Queryable = Pick<Pool, "query"> | PoolClient;

export type AccountRules = {
  inviteExpiryDays: number;
  maxFailures: number;
  /** 0: until an administrator unlocks */
  lockMinutes: number;
  password: PasswordPolicy;
  /** null: no notification is sent */
  notifySignupRequestsTo: string | null;
  signUpOpen: boolean;
};

export const DEFAULT_RULES: AccountRules = {
  inviteExpiryDays: 7,
  maxFailures: 7,
  lockMinutes: 30,
  password: DEFAULT_PASSWORD_POLICY,
  notifySignupRequestsTo: "jim@eigenia.nl",
  signUpOpen: false,
};

export const RULE_BOUNDS = { inviteExpiryDays: [1, 30], maxFailures: [3, 20], lockMinutes: [5, 1440] } as const;

const clampInt = (v: unknown, [lo, hi]: readonly [number, number], dflt: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;

/** Every rule in force: stored values brought within bounds, defaults for the rest. */
export async function readRules(db: Queryable): Promise<AccountRules> {
  const rows = await db.query<{ key: string; value: unknown }>(
    "SELECT key, value FROM auth2_settings WHERE key = ANY($1::text[])",
    [[AUTH2_SETTING.inviteExpiryDays, AUTH2_SETTING.maxFailures, AUTH2_SETTING.lockMinutes, AUTH2_SETTING.passwordPolicy, AUTH2_SETTING.notifySignupRequestsTo, AUTH2_SETTING.signUpOpen]]
  );
  const v = new Map(rows.rows.map((r) => [r.key, r.value]));
  const lock = v.get(AUTH2_SETTING.lockMinutes);
  const notify = v.get(AUTH2_SETTING.notifySignupRequestsTo);
  return {
    inviteExpiryDays: clampInt(v.get(AUTH2_SETTING.inviteExpiryDays), RULE_BOUNDS.inviteExpiryDays, DEFAULT_RULES.inviteExpiryDays),
    maxFailures: clampInt(v.get(AUTH2_SETTING.maxFailures), RULE_BOUNDS.maxFailures, DEFAULT_RULES.maxFailures),
    lockMinutes: lock === 0 ? 0 : clampInt(lock, RULE_BOUNDS.lockMinutes, DEFAULT_RULES.lockMinutes),
    password: v.has(AUTH2_SETTING.passwordPolicy) ? normalizePolicy(v.get(AUTH2_SETTING.passwordPolicy)) : DEFAULT_RULES.password,
    notifySignupRequestsTo: notify === undefined ? DEFAULT_RULES.notifySignupRequestsTo : typeof notify === "string" && notify ? notify : null,
    signUpOpen: v.get(AUTH2_SETTING.signUpOpen) === true,
  };
}

export type RulesChange = Partial<{
  inviteExpiryDays: unknown;
  maxFailures: unknown;
  lockMinutes: unknown;
  password: unknown;
  notifySignupRequestsTo: unknown;
  signUpOpen: unknown;
}>;

const bad = (code: string, message: string) => APIError.from("BAD_REQUEST", { code, message });

function intIn(v: unknown, [lo, hi]: readonly [number, number], what: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) throw bad("INVALID_SETTING", `${what} must be a whole number from ${lo} to ${hi}.`);
  return v;
}

/** Checks and stores a change, in the caller's transaction, with one audit line saying what changed. */
export async function writeRules(c: PoolClient, change: RulesChange, actor: string): Promise<AccountRules> {
  const before = await readRules(c);
  const set: [string, unknown][] = [];
  if (change.inviteExpiryDays !== undefined) set.push([AUTH2_SETTING.inviteExpiryDays, intIn(change.inviteExpiryDays, RULE_BOUNDS.inviteExpiryDays, "Days an invitation works")]);
  if (change.maxFailures !== undefined) set.push([AUTH2_SETTING.maxFailures, intIn(change.maxFailures, RULE_BOUNDS.maxFailures, "Failed sign-ins before the lock")]);
  if (change.lockMinutes !== undefined) set.push([AUTH2_SETTING.lockMinutes, change.lockMinutes === 0 ? 0 : intIn(change.lockMinutes, RULE_BOUNDS.lockMinutes, "Minutes of the lock")]);
  if (change.password !== undefined) {
    const p = change.password as Record<string, unknown> | null;
    if (!p || typeof p !== "object") throw bad("INVALID_SETTING", "Send the password rules as a set.");
    if (p.minLength !== undefined) intIn(p.minLength, [8, 64], "The shortest password");
    set.push([AUTH2_SETTING.passwordPolicy, normalizePolicy({ ...before.password, ...p })]);
  }
  if (change.notifySignupRequestsTo !== undefined) {
    const raw = change.notifySignupRequestsTo;
    set.push([AUTH2_SETTING.notifySignupRequestsTo, raw === "" || raw === null ? "" : cleanEmail(raw)]);
  }
  if (change.signUpOpen !== undefined) {
    if (typeof change.signUpOpen !== "boolean") throw bad("INVALID_SETTING", "Choose open or closed.");
    set.push([AUTH2_SETTING.signUpOpen, change.signUpOpen]);
  }
  for (const [k, value] of set) await writeAuth2Setting(c, k as Parameters<typeof writeAuth2Setting>[1], value, actor);
  const after = await readRules(c);
  const changed = (Object.keys(after) as (keyof AccountRules)[]).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
  if (changed.length) {
    await auditIn(c, {
      actor,
      action: "platform.rules_changed",
      summary: `Changed the account rules: ${changed.join(", ")}`,
      detail: Object.fromEntries(changed.map((k) => [k, { before: before[k], after: after[k] }])),
    });
  }
  return after;
}

