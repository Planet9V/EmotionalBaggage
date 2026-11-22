/**
 * Every new-sign-in screen starts here. With AUTH2 off the screen does not exist (404), so the live site, which runs
 * with it off, is unchanged. With it on, screens that need a signed-in account send a signed-out visitor to the new
 * sign-in page and back.
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { safeNext } from "@/app/sign-in/shared";
import { auth2Enabled } from "@/lib/auth2/config";
import { auth2Session } from "@/lib/auth2/server";

export async function gate() {
  // Decided per request from the environment, never at build time.
  await connection();
  if (!auth2Enabled()) notFound();
}

/** The signed-in account (new sign-in), or a redirect to /auth/sign-in that comes back to `here`. */
export async function requireAccount(here: string) {
  await gate();
  const s = await auth2Session(await headers());
  if (!s) redirect(`/auth/sign-in?next=${encodeURIComponent(here)}`);
  return s;
}

/** The `next` parameter of a page, as a string or null. */
export const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

/** Where to go after signing in: a path on this site (safeNext), the account page by default. */
export function nextOf(v: string | null) {
  const n = safeNext(v);
  const path = n.split(/[?#]/)[0];
  return path === "/" || path === "/auth/sign-in" || path === "/auth/two-factor" ? "/auth/account" : n;
}
