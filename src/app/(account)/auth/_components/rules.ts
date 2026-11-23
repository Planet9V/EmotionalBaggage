/** Rules the account forms check before sending, in the same words the server's refusals use (src/lib/auth2/errors.ts). */
import { z } from "zod";
import { passwordProblem, type PasswordOwner, type PasswordPolicy } from "@/lib/auth2/passwordPolicy";

export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

/**
 * A new password checked against the rules in force (src/lib/auth2/passwordPolicy.ts), in the server's words. The
 * common-password list is checked by the server only. `who` gives the address and name for "not your address or
 * name" when the form knows them.
 */
export const policyPasswordField = (policy: PasswordPolicy, who: () => PasswordOwner = () => ({})) =>
  z.string().superRefine((pw, ctx) => {
    const problem = passwordProblem(policy, pw, who());
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/** A new password typed twice, under the rules in force. */
export const policyPasswordPair = (policy: PasswordPolicy, who?: () => PasswordOwner) =>
  z
    .object({ password: policyPasswordField(policy, who), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two new passwords are not the same." });

export const emailField = z.string().trim().min(1, "Enter your email address.").max(254, "That email address is too long.").email("Enter a whole email address, such as name@example.com.");
export const newPasswordField = z
  .string()
  .min(MIN_PASSWORD, `The password must be at least ${MIN_PASSWORD} characters.`)
  .max(MAX_PASSWORD, `The password must be at most ${MAX_PASSWORD} characters.`);
export const passwordField = z.string().min(1, "Enter your password.");
export const codeField = z
  .string()
  .transform((s) => s.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the six digits your authenticator app shows."));

/** A new password typed twice. */
export const newPasswordPair = z
  .object({ password: newPasswordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two new passwords are not the same." });
