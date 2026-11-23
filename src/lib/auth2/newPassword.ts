/**
 * The server's check of a new password: the rules in force (./rules.ts, `password.policy`) and the bundled list of
 * common passwords (./commonPasswords.ts). Called wherever a password is chosen; see ./passwordPolicy.ts.
 */
import type { Pool, PoolClient } from "pg";
import { APIError } from "better-auth/api";
import { COMMON_PASSWORDS } from "./commonPasswords";
import { PASSWORD_RULE, passwordProblem, type PasswordOwner, type PasswordPolicy } from "./passwordPolicy";
import { readRules } from "./rules";

let common: Set<string> | undefined;
/** Whether the password is on the common list (compared in lower case). */
export function isCommonPassword(pw: string): boolean {
  common ??= new Set(COMMON_PASSWORDS.split(" "));
  return common.has(pw.normalize("NFKC").toLowerCase());
}

/** The sentence for the first rule the password breaks, or null. */
export function newPasswordProblem(policy: PasswordPolicy, pw: unknown, who: PasswordOwner = {}): string | null {
  const p = passwordProblem(policy, pw, who);
  if (p) return p;
  if (policy.notCommon && isCommonPassword(pw as string)) return "That password is one of the most commonly used, so it is easy to guess. Choose another.";
  return null;
}

/** Refuses (400 PASSWORD_RULE, with the sentence) a password that breaks the rules in force; answers it otherwise. */
export async function checkNewPassword(db: Pick<Pool, "query"> | PoolClient, pw: unknown, who: PasswordOwner = {}): Promise<string> {
  const problem = newPasswordProblem((await readRules(db)).password, pw, who);
  if (problem) throw APIError.from("BAD_REQUEST", { code: PASSWORD_RULE, message: problem });
  return pw as string;
}
