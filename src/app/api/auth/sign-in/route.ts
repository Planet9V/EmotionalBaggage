import { NextResponse } from "next/server";
import { z } from "zod";
import { body, HttpError, route } from "@/lib/api/route";
import { MAX_PASSWORD_LENGTH, MAX_USERNAME_LENGTH, sessionCookie, signIn, signOut, tokenFromRequest } from "@/lib/auth";

const SignIn = z.object({
  username: z.string().trim().min(1, "Enter your username.").max(MAX_USERNAME_LENGTH),
  password: z.string().min(1, "Enter your password.").max(MAX_PASSWORD_LENGTH),
});

/** Open: this is how a session starts. The origin check in route() still applies. */
export const POST = route.open(async (req: Request) => {
  const { username, password } = await body(req, SignIn);
  const result = await signIn(username, password, req.headers.get("user-agent") ?? "");
  if (!result.ok) {
    if (result.reason === "locked") {
      const minutes = Math.ceil(result.retryAfterSeconds / 60);
      throw new HttpError(
        429,
        `Too many failed sign-in attempts for this username. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
      );
    }
    // The same answer whether the name or the password was wrong.
    throw new HttpError(401, "The username or password is not right.");
  }
  // A browser that signs in again does not leave its previous session behind.
  await signOut(tokenFromRequest(req));
  const { username: name, usingDefaultPassword } = result.session;
  return NextResponse.json(
    { user: { username: name, usingDefaultPassword } },
    { headers: { "set-cookie": sessionCookie(result.token, req), "cache-control": "no-store" } }
  );
});
