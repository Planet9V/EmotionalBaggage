import { audit } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, HttpError, route, sessionOf } from "@/lib/api/route";
import { changePassword, MAX_PASSWORD_LENGTH } from "@/lib/auth";

const Change = z.object({
  current: z.string().max(MAX_PASSWORD_LENGTH),
  next: z.string().max(MAX_PASSWORD_LENGTH),
});

/** Changes the signed-in user's password; every other session of that user is signed out. */
export const POST = route(async (req: Request) => {
  const session = sessionOf(req);
  const { current, next } = await body(req, Change);
  const result = await changePassword(session.userId, current, next, session.sessionId);
  if (!result.ok) throw new HttpError(400, result.error, { field: result.field });
  await audit({ action: "password.changed", summary: `${session.username} changed the password; other browsers were signed out` });
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
});
