/**
 * The early-access form without script: a plain form POST (application/x-www-form-urlencoded) to the same open
 * routes. The answer is then a 303 to the confirmation page /welcome/early, which shows the place or the waiting
 * list. The token for the optional details travels in a short-lived HttpOnly cookie scoped to that page, never in
 * the address. A refusal goes back to the same page with a short code (?e=...), never with what was typed.
 */
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { HttpError } from "@/lib/api/route";

/** The cookie that carries the confirmation token to /welcome/early (only after a form sent without script). */
export const EARLY_COOKIE = "c2r_early";
export const EARLY_PAGE = "/welcome/early";
const COOKIE_SECONDS = 24 * 60 * 60;

/** The codes the confirmation page explains; anything else reads as "could not be sent". */
export const NO_SCRIPT_ERRORS = {
  email: "Enter a working email address.",
  building: "Say in a few words what you want to make.",
  wait: "Too many requests from here. Wait a few minutes and send it again.",
  expired: "This confirmation has expired. Your request is kept.",
  invalid: "The form could not be sent. Check it and send it again.",
} as const;
export type NoScriptError = keyof typeof NO_SCRIPT_ERRORS;

/** Is this a plain HTML form post (no script)? */
export const isFormPost = (req: Request) => /application\/x-www-form-urlencoded|multipart\/form-data/i.test(req.headers.get("content-type") ?? "");

/** Reads a JSON body or a plain form post into the schema. */
export async function readEither<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  if (!isFormPost(req)) {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new HttpError(400, "The request body must be JSON.");
    }
    return schema.parse(raw);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "The form could not be read.");
  }
  const raw: Record<string, string> = {};
  for (const [k, v] of form) if (typeof v === "string") raw[k] = v;
  return schema.parse(raw);
}

/** The 303 back to the confirmation page; with a token, it is set as the page's cookie. */
export function backToPage(req: Request, opts: { token?: string | null; query?: Record<string, string>; hash?: string } = {}): Response {
  const u = new URL(EARLY_PAGE, req.url);
  for (const [k, v] of Object.entries(opts.query ?? {})) u.searchParams.set(k, v);
  if (opts.hash) u.hash = opts.hash;
  const res = NextResponse.redirect(u, { status: 303, headers: { "cache-control": "no-store" } });
  if (opts.token) {
    res.cookies.set(EARLY_COOKIE, opts.token, { httpOnly: true, sameSite: "lax", path: EARLY_PAGE, maxAge: COOKIE_SECONDS, secure: new URL(req.url).protocol === "https:" });
  }
  return res;
}

/** The short code for a refusal of a form post. */
export function errorCode(e: unknown): NoScriptError {
  if (e instanceof ZodError) {
    const field = String(e.issues[0]?.path[0] ?? "");
    if (field === "email" || field === "building") return field;
    if (field === "token") return "expired";
    return "invalid";
  }
  if (e instanceof HttpError) {
    if (e.status === 429) return "wait";
    if (e.status === 410) return "expired";
  }
  return "invalid";
}
