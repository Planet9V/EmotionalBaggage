/**
 * The new sign-in's API (Better Auth), beside the old one under /api/auth. Answers only while AUTH2 is on.
 *
 * route.open puts the app's own checks in front, the same as on every other route: a state-changing request from
 * another origin is refused (403), the body is capped (413), a NUL character is refused (400). Then, with AUTH2
 * off, every address under /api/auth2 is a 404 and the new sign-in is never built and touches no database; with it
 * on, Better Auth checks the origin against its trusted list, the throttle and the session.
 *
 * Changes are recorded in the audit log by src/lib/auth2/auth.ts (hooks and the user-created database hook).
 */
import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { withClientAddress } from "@/lib/auth2/clientAddress";
import { auth2Enabled } from "@/lib/auth2/config";
import { auth2, SetupRequired } from "@/lib/auth2/server";

const handle = route.open(
  async (req: Request) => {
    if (!(await auth2Enabled())) return NextResponse.json({ error: "Not found." }, { status: 404 });
    try {
      return (await auth2()).handler(withClientAddress(req));
    } catch (e) {
      if (!(e instanceof SetupRequired)) throw e;
      return NextResponse.json({ code: "SETUP_REQUIRED", error: "Sign-in is not set up yet. Open the first-run page to create the owner." }, { status: 503 });
    }
  },
  { maxBodyBytes: 64 * 1024 }
);

export const GET = handle;
export const POST = handle;
