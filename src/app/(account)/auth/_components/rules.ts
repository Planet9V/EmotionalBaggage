/** Rules the account forms check before sending, in the same words the server's refusals use (src/lib/auth2/errors.ts). */
import { z } from "zod";

export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

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
