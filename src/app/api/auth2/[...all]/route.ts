/**
 * The new sign-in's API (Better Auth), beside the old one under /api/auth. Answers only while AUTH2 is on; off, every
 * address under /api/auth2 is a 404 and no database is touched.
 *
 * route.open puts the app's own checks in front of Better Auth's: a state-changing request from another origin is
 * refused (403), the body is capped, a NUL character is refused. Better Auth then checks the origin against its
 * trusted list, the throttle, and the session.
 */
import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { auth2Enabled } from "@/lib/auth2/config";
import { auth2 } from "@/lib/auth2/server";

const NOT_FOUND = () => NextResponse.json({ error: "Not found." }, { status: 404 });

const open = route.open(async (req: Request) => (await auth2()).handler(req), { maxBodyBytes: 64 * 1024 });

// The switch is read first, so with AUTH2 off even a refused request is a plain 404.
const handle = async (req: Request) => (auth2Enabled() ? open(req) : NOT_FOUND());

export const GET = handle;
export const POST = handle;
