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

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * The address the app is reached at, for links in emails and Better Auth's own origin check. In production it
 * must be set, and must be https (cookies are then Secure); elsewhere it defaults to this machine.
 */
export function auth2BaseURL(): string {
  const set = process.env.BETTER_AUTH_URL?.trim();
  if (isProduction()) {
    if (!set) throw new Error("BETTER_AUTH_URL must be set when AUTH2 is on in production: the https address people open the app at.");
    if (!set.startsWith("https://")) throw new Error("BETTER_AUTH_URL must start with https:// when AUTH2 is on in production, so sign-in cookies are sent only over https.");
  }
  if (set) {
    try {
      new URL(set);
    } catch {
      throw new Error("BETTER_AUTH_URL is not an address, for example https://app.example.com.");
    }
    return set.replace(/\/+$/, "");
  }
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

const SECRET_HELP = "(for example: openssl rand -base64 48)";
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

/** The signing and encryption secret. Required and random; never a default. */
export function auth2Secret(): string {
  const s = process.env.BETTER_AUTH_SECRET ?? "";
  const problem = secretProblem(s);
  if (problem) throw new Error(`${problem} It is needed while AUTH2 is on.`);
  return s;
}

/**
 * Every setting the new sign-in needs, checked at once. Called from ready() (src/lib/db.ts) when AUTH2 is on, so a
 * wrong setting stops the app at start, with the health check failing, instead of at someone's first sign-in.
 */
export async function checkAuth2Settings(): Promise<void> {
  auth2Secret();
  auth2BaseURL();
  auth2TrustedOrigins();
  (await import("./clientAddress")).trustedProxies();
  (await import("./mail")).mailSender();
}
