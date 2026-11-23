/**
 * The password rules (owner's ruling of 23 Nov: "minimum complexity password requirements"). One set of rules for
 * every place a password is chosen: the first-run owner, sign-up, reset, change, the first change after an
 * administrator set one, accepting an account invitation, and the temporary password an administrator types.
 *
 * This module has no server import: the forms use passwordChecklist() to show the same rules live, the server uses
 * passwordProblem() (here) plus the common-password list (./newPassword.ts), so both say the same words. The rules
 * are the platform administrator's setting `password.policy` (Admin, Sign-in), within safe bounds; the defaults
 * below are defaults, not rulings. A rule applies to a password when it is chosen: existing passwords stay valid.
 */

export type PasswordPolicy = {
  /** at least this many characters (8 to 64; default 12) */
  minLength: number;
  /** at most this many (128; fixed: the hash is the same cost for any length up to it) */
  maxLength: number;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  symbol: boolean;
  /** not the account's email address, the part before its @, or its name */
  notEmailOrName: boolean;
  /** not on the bundled list of common passwords (checked on the server) */
  notCommon: boolean;
};

const PASSWORD_BOUNDS = { minLength: { min: 8, max: 64 }, maxLength: 128 } as const;

/** Defaults chosen by the engineer on 23 Nov (labelled as defaults in docs/TASKS.md). */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: PASSWORD_BOUNDS.maxLength,
  upper: true,
  lower: true,
  digit: true,
  symbol: true,
  notEmailOrName: true,
  notCommon: true,
};

/** A stored or submitted policy made safe: anything missing or out of bounds takes the default or the bound. */
export function normalizePolicy(raw: unknown): PasswordPolicy {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const flag = (k: keyof PasswordPolicy) => (typeof r[k] === "boolean" ? (r[k] as boolean) : (DEFAULT_PASSWORD_POLICY[k] as boolean));
  const n = typeof r.minLength === "number" && Number.isFinite(r.minLength) ? Math.round(r.minLength) : DEFAULT_PASSWORD_POLICY.minLength;
  return {
    minLength: Math.min(PASSWORD_BOUNDS.minLength.max, Math.max(PASSWORD_BOUNDS.minLength.min, n)),
    maxLength: PASSWORD_BOUNDS.maxLength,
    upper: flag("upper"),
    lower: flag("lower"),
    digit: flag("digit"),
    symbol: flag("symbol"),
    notEmailOrName: flag("notEmailOrName"),
    notCommon: flag("notCommon"),
  };
}

/** Whose password it is, for the "not your address or name" rule. Either may be unknown (left empty). */
export type PasswordOwner = { email?: string | null; name?: string | null };

const length = (s: string) => [...s].length;
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** Whether the password is, or is made only of, the address, its local part or the name. */
function isEmailOrName(pw: string, who: PasswordOwner): boolean {
  const p = norm(pw);
  const email = norm(who.email ?? "");
  const candidates = [email, email.split("@")[0] ?? "", norm(who.name ?? "")].filter((c) => c.length >= 3);
  return candidates.some((c) => p === c || p.replace(/[^\p{L}\p{N}]/gu, "") === c.replace(/[^\p{L}\p{N}]/gu, ""));
}

type Rule = { key: string; label: string; met: (pw: string, who: PasswordOwner) => boolean; on: (p: PasswordPolicy) => boolean; refusal: string };

function rules(p: PasswordPolicy): Rule[] {
  const all: Rule[] = [
    { key: "length", on: () => true, label: `At least ${p.minLength} characters`, refusal: `The password must be at least ${p.minLength} characters.`, met: (pw) => length(pw) >= p.minLength },
    { key: "max", on: () => true, label: `At most ${p.maxLength} characters`, refusal: `The password must be at most ${p.maxLength} characters.`, met: (pw) => length(pw) <= p.maxLength },
    { key: "upper", on: (x) => x.upper, label: "An upper-case letter", refusal: "The password needs at least one upper-case letter.", met: (pw) => /\p{Lu}/u.test(pw) },
    { key: "lower", on: (x) => x.lower, label: "A lower-case letter", refusal: "The password needs at least one lower-case letter.", met: (pw) => /\p{Ll}/u.test(pw) },
    { key: "digit", on: (x) => x.digit, label: "A digit", refusal: "The password needs at least one digit.", met: (pw) => /\p{Nd}/u.test(pw) },
    { key: "symbol", on: (x) => x.symbol, label: "A symbol, such as ! or #", refusal: "The password needs at least one symbol, such as ! or #.", met: (pw) => /[^\p{L}\p{N}\s]/u.test(pw) },
    { key: "personal", on: (x) => x.notEmailOrName, label: "Not your email address or name", refusal: "The password cannot be your email address or your name.", met: (pw, who) => !isEmailOrName(pw, who) },
  ];
  return all.filter((r) => r.on(p));
}

/** The rules as a list a form shows beside the field, each met or not yet. The common-password rule is listed but
 *  checked on the server only (`met: null`). */
export function passwordChecklist(policy: PasswordPolicy, pw: string, who: PasswordOwner = {}): { key: string; label: string; met: boolean | null }[] {
  const list: { key: string; label: string; met: boolean | null }[] = rules(policy)
    .filter((r) => r.key !== "max" || length(pw) > policy.maxLength)
    .map((r) => ({ key: r.key, label: r.label, met: r.met(pw, who) }));
  if (policy.notCommon) list.push({ key: "common", label: "Not a commonly used password (checked when you send it)", met: null });
  return list;
}

/** The first rule the password breaks, as the sentence the server answers, or null. Excludes the common list. */
export function passwordProblem(policy: PasswordPolicy, pw: unknown, who: PasswordOwner = {}): string | null {
  if (typeof pw !== "string" || !pw.isWellFormed()) return `The password must be at least ${policy.minLength} characters.`;
  for (const r of rules(policy)) if (!r.met(pw, who)) return r.refusal;
  return null;
}

/** One line for a hint under a password field. */
export function policySummary(p: PasswordPolicy): string {
  const parts = [p.upper && "an upper-case letter", p.lower && "a lower-case letter", p.digit && "a digit", p.symbol && "a symbol"].filter(Boolean) as string[];
  const kinds = parts.length ? `, with ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}` : "";
  return `At least ${p.minLength} characters${kinds}.`;
}

/** The code every refusal of a password rule carries; the screens show the server's own sentence for it. */
export const PASSWORD_RULE = "PASSWORD_RULE";
