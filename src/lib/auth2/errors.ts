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
  INVALID_EMAIL: "Enter a whole email address, such as name@example.com.",
  ALREADY_MEMBER: "That person is a member of this workspace already.",
  ALREADY_INVITED: "That address has an invitation waiting already. Send it again from the list of invitations.",
  SEAT_LIMIT: "This workspace is full: it holds at most 50 people, counting invitations not yet accepted.",
  TOO_MANY_INVITATIONS: "This workspace has sent as many invitations in the last hour as it may. Try again later.",
  INVITATION_NOT_FOUND: "That invitation was not found. It may have been accepted or revoked already.",
  RESENT_TOO_SOON: "This invitation was sent less than a minute ago. Wait a minute before sending it again.",
  RESEND_LIMIT: "This invitation has been sent as often as it may be. Revoke it and invite the address again.",
  INVITATION_INVALID: "This invitation link is not valid. It may have been used, revoked or sent again since. Ask for a new one.",
  INVITATION_EXPIRED: "This invitation has expired. Ask whoever invited you to send it again.",
  INVITATION_OTHER_ADDRESS: "This invitation is for another email address. Sign out, then sign in or create an account with the address it was sent to.",
  INVITATION_WITHDRAWN: "This invitation no longer holds: whoever sent it may no longer give that role. Ask for a new one.",
  TWO_FACTOR_SETUP_REQUIRED: "A workspace you belong to requires two-step sign-in. Set up an authenticator app first.",
  TWO_FACTOR_REQUIRED_BY_WORKSPACE: "A workspace you belong to requires two-step sign-in, so it cannot be turned off.",
  TWO_FACTOR_NOT_REQUIRED_HERE: "This workspace does not require two-step sign-in of this member, so it is theirs to manage. Require it first if they need it reset.",
  NOT_YOUR_OWN: "You cannot reset your own two-step sign-in here. Use a recovery code to sign in, then set it up again.",
  RESET_NEEDS_PLATFORM_ADMIN: "This person's two-step sign-in matters beyond this workspace. Ask a platform administrator to reset it.",
  RESET_LIMIT: "This person's two-step sign-in has been reset as often today as it may be. Try again tomorrow, or ask a platform administrator.",
  REENROL_PROOF_REQUIRED: "Your two-step sign-in was reset. Use the link we emailed you, or the code from whoever reset it.",
  REENROL_INVALID: "That address, password and code or link do not match. Check them, or ask for a new reset.",
  SIGN_UP_CLOSED: "Accounts are made by invitation on this installation. Ask for one below, or use the link in your invitation.",
  SIGN_IN_LOCKED: "Too many failed sign-ins for this address, so it is locked for now. To get in at once, choose a new password with \"Forgotten your password?\", or ask an administrator to unlock it.",
  PASSWORD_CHANGE_REQUIRED: "An administrator set this password. Choose a password of your own to sign in.",
  PASSWORD_CHANGE_NOT_REQUIRED: "This account's password does not have to be changed. Sign in as usual.",
  STEP_UP_REQUIRED: "Enter your own password to confirm this change.",
  STEP_UP_WRONG: "That is not your password. It counts as a failed sign-in.",
  NOT_YOURSELF: "You cannot do this to your own account. Another platform administrator can.",
  VIEW_AS_NOT_ALLOWED: "While viewing as someone, their password, address, two-step sign-in and sessions cannot be changed. Use Stop in the banner to go back to your own account.",
  VIEW_AS_ADMIN: "You cannot view as another platform administrator.",
  VIEW_AS_INVITED: "This person has not chosen a password yet, so there is nothing of theirs to see.",
  INVITATION_ACCEPTED: "This invitation has been accepted: the account is in use.",
  INVITATION_REVOKED: "This invitation was revoked. Ask the administrator for a new one.",
  USE_RESET_LINK: "Mail is set up: ask for a reset link instead.",
  SIGN_IN_WAIT: "Too many tries for this account in a short time. Wait a minute, then try again.",
  ACCOUNT_DISABLED: "This account has been disabled by an administrator of this installation.",
  NOT_PLATFORM_ADMIN: "Only a platform administrator may do this.",
  LAST_PLATFORM_ADMIN: "This is the last platform administrator. Make someone else one first.",
  FIRST_RUN_CLOSED: "This installation has its owner already. Sign in instead.",
  SETUP_REQUIRED: "This installation is not set up yet: its owner has to be created first, on the first-run page.",
  SETUP_CODE_WRONG: "That set-up code is not right. It is in the server log, on the line that starts \"[auth2] This installation has no owner yet\".",
  SETUP_CODE_WAIT: "Too many wrong set-up codes. Wait a little, then try again.",
  INVALID_ADDRESS: "Confirm the address this installation is opened at, for example https://app.example.com.",
  ADDRESS_MISMATCH: "The address must be the one this page is open at. Open the page at the address people will use, then try again.",
  INVALID_BODY: "Fill in every field, then try again.",
  INVALID_TEXT: "A field holds characters that are not valid text.",
  USER_EXISTS: "An account with that address exists already.",
  USER_NOT_FOUND: "That account was not found.",
  SOLE_OWNER: "That account is the only owner of workspaces others work in. Make someone else owner of each, or delete them in the same step.",
  TRANSFER_NOT_A_MEMBER: "The new owner must already be a member of that workspace.",
  INVALID_ORIGIN: "This request came from another site and was refused.",
  MISSING_OR_NULL_ORIGIN: "This request came from another site and was refused.",
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: "This request came from another site and was refused.",
};

/** The sentence for an answer that was not ok. */
export function plainError(status: number, body: unknown): string {
  const code = body && typeof body === "object" && typeof (body as { code?: unknown }).code === "string" ? (body as { code: string }).code : "";
  // The password rules are the administrator's setting: the server's own sentence names the rule broken.
  const message = body && typeof body === "object" ? (body as { message?: unknown }).message : undefined;
  if (code === "PASSWORD_RULE" && typeof message === "string" && message) return message;
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
