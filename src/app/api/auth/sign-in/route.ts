import { audit } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, HttpError, refuseWhenNewSignIn, route } from "@/lib/api/route";
import { clientAddress, MAX_PASSWORD_LENGTH, MAX_USERNAME_LENGTH, sessionCookie, signIn, signOut, tokenFromRequest } from "@/lib/auth";

const SignIn = z.object({
  username: z.string().trim().min(1, "Enter your username.").max(MAX_USERNAME_LENGTH),
  password: z.string().min(1, "Enter your password.").max(MAX_PASSWORD_LENGTH),
});

/** Open: this is how a session starts. The origin check in route() still applies. */
export const POST = route.open(async (req: Request) => {
  // Replaced by /api/auth2 while the new sign-in is on.
  await refuseWhenNewSignIn();
  const { username, password } = await body(req, SignIn);
  const result = await signIn(username, password, req.headers.get("user-agent") ?? "", { client: clientAddress(req) });
  if (!result.ok) {
    if (result.reason === "wait") {
      const secs = result.retryAfterSeconds;
      const when = secs < 120 ? `${secs} second${secs === 1 ? "" : "s"}` : `${Math.ceil(secs / 60)} minutes`;
      throw new HttpError(429, `Too many failed sign-in attempts from here. Try again in ${when}.`, undefined, { "retry-after": String(secs) });
    }
    await audit({ action: "session.refused", summary: "A sign-in attempt was refused", actor: "" });
    // The same answer whether the name or the password was wrong.
    throw new HttpError(401, "The username or password is not right.");
  }
  // A browser that signs in again does not leave its previous session behind.
  await signOut(tokenFromRequest(req));
  const { username: name, usingDefaultPassword } = result.session;
  await audit({ action: "session.started", summary: `${name} signed in`, actor: name });
  return NextResponse.json(
    { user: { username: name, usingDefaultPassword } },
    { headers: { "set-cookie": sessionCookie(result.token, req), "cache-control": "no-store" } }
  );
});
