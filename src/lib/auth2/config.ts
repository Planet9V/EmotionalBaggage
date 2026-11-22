/**
 * The switch and the settings for the new sign-in (accounts, slice 1).
 *
 * AUTH2 is off unless set to 1/true/yes/on. Off, nothing of the new sign-in answers: its API route says 404 and
 * its screens are not found, and the app signs in exactly as before (src/lib/auth.ts, `demo`/`demo`). On, the API
 * under /api/auth2 and the screens under /auth are reachable, beside the old sign-in; neither replaces the other
 * until the cut-over (slice 3).
 *
 * Read at request time, never at build time, so one image serves both.
 */
const ON = /^(1|true|yes|on)$/i;

export const AUTH2_BASE_PATH = "/api/auth2";
/** Where the new screens live (src/app/(account)/auth/). */
export const AUTH2_PAGES = "/auth";

export const auth2Enabled = () => ON.test(process.env.AUTH2?.trim() ?? "");

/** The address the app is reached at, for links in emails and Better Auth's own origin check. */
export function auth2BaseURL(): string {
  const set = process.env.BETTER_AUTH_URL?.trim();
  if (set) return set.replace(/\/+$/, "");
  return `http://localhost:${process.env.PORT?.trim() || "3000"}`;
}

/**
 * Other addresses the app is reached at (AUTH2_TRUSTED_ORIGINS, comma-separated), for example a self-hosted
 * install opened by name and by address. A state-changing request whose Origin is none of these and not the base
 * address is refused.
 */
export function auth2TrustedOrigins(): string[] {
  const base = new URL(auth2BaseURL()).origin;
  const more = (process.env.AUTH2_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return new URL(s).origin;
      } catch {
        throw new Error(`AUTH2_TRUSTED_ORIGINS has an entry that is not an address: ${s}`);
      }
    });
  return [...new Set([base, ...more])];
}

/** The signing and encryption secret. Required, at least 32 characters; never a default. */
export function auth2Secret(): string {
  const s = process.env.BETTER_AUTH_SECRET ?? "";
  if (s.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 random characters when AUTH2 is on (for example: openssl rand -base64 48).");
  }
  return s;
}
