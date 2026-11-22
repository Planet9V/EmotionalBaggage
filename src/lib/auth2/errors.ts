/**
 * Better Auth answers errors as `{ code, message }` in its own words. The screens show these plain sentences
 * instead (trial task 5: "map Better Auth's error codes to plain sentences"). No server import: the browser uses it.
 */
const SENTENCES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "That email address and password do not match an account. Check both and try again.",
  EMAIL_NOT_VERIFIED: "Confirm your email address first: follow the link in the email we sent you. You can ask for a new one below.",
  PASSWORD_TOO_SHORT: "The password must be at least 8 characters.",
  PASSWORD_TOO_LONG: "The password must be at most 128 characters.",
  INVALID_PASSWORD: "That is not your current password.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "This account has no password to change.",
  INVALID_TOKEN: "This link is not valid. It may have been used already, or copied only in part. Ask for a new one.",
  TOKEN_EXPIRED: "This link has expired. Ask for a new one.",
  INVALID_CODE: "That code is not right. Enter the six digits your authenticator app shows now.",
  CODE_ALREADY_USED: "That code has already been used. Wait for the next code from your authenticator app.",
  INVALID_BACKUP_CODE: "That recovery code is not right, or it has been used already. Each recovery code works once.",
  INVALID_TWO_FACTOR_COOKIE: "This sign-in has timed out. Enter your email address and password again.",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "Too many wrong codes for this sign-in. Enter your email address and password again.",
  ACCOUNT_TEMPORARILY_LOCKED: "Too many wrong codes. The second step of sign-in is locked for 15 minutes; try again after that.",
  TOTP_NOT_ENABLED: "This account does not use an authenticator app.",
  TWO_FACTOR_NOT_ENABLED: "This account does not use an authenticator app.",
  SESSION_EXPIRED: "For this change, sign in again first: your sign-in is too old.",
  INVALID_NAME: "Enter your name.",
  NAME_TOO_LONG: "Keep the name to 80 characters.",
  NAME_HAS_LINK: "A name cannot contain a web address.",
  INVALID_IMAGE: "A picture must be an https address.",
  FAILED_TO_CREATE_USER: "The account could not be created. Try again in a moment.",
  WORKSPACE_NOT_FOUND: "That workspace was not found, or you are not a member of it.",
  MEMBER_NOT_FOUND: "That person is not a member of this workspace.",
  NOT_ALLOWED: "Your role in this workspace does not allow this change.",
  INVALID_ROLE: "Choose owner, admin or member.",
  LAST_OWNER: "A workspace needs at least one owner. Make someone else an owner first.",
  ONLY_WORKSPACE: "This is your only workspace. Every account keeps at least one, so it cannot be left or deleted.",
  USE_LEAVE: "To take yourself out of a workspace, leave it.",
  WORKSPACE_LIMIT: "You own as many workspaces as one person can. Delete one you no longer need first.",
  INVALID_WORKSPACE_NAME: "Enter a name for the workspace.",
  WORKSPACE_NAME_TOO_LONG: "Keep the workspace name to 100 characters.",
  WORKSPACE_NAME_HAS_LINK: "A workspace name cannot contain a web address.",
  INVALID_ORIGIN:"This request came from another site and was refused.",
  MISSING_OR_NULL_ORIGIN: "This request came from another site and was refused.",
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: "This request came from another site and was refused.",
};

/** The sentence for an answer that was not ok. */
export function plainError(status: number, body: unknown): string {
  const code = body && typeof body === "object" && typeof (body as { code?: unknown }).code === "string" ? (body as { code: string }).code : "";
  if (code && SENTENCES[code]) return SENTENCES[code];
  if (status === 429) return "Too many tries in a short time. Wait a minute, then try again.";
  if (status === 403) return "This request was refused. Reload the page and try again.";
  if (status === 401) return "You are not signed in, or your sign-in has ended. Sign in again.";
  // The app's own route wrapper answers { error } in plain words already.
  const own = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  if (typeof own === "string" && own) return own;
  if (status >= 500) return "The server could not complete this. Try again in a moment.";
  return `That did not work (${status}). Check what you entered and try again.`;
}
