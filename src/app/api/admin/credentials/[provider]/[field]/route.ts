import { NextResponse } from "next/server";
import { HttpError, notFound, route } from "@/lib/api/route";
import { providerView, removeCredential } from "@/lib/admin/credentials";
import { fieldDef, isProvider } from "@/lib/admin/providers";

type Ctx = { params: Promise<{ provider: string; field: string }> };

/** Removes one saved value; an environment variable for the same field, if any, applies again. */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { provider, field } = await params;
  if (!isProvider(provider)) throw notFound("That provider");
  if (!fieldDef(provider, field)) throw notFound("That field");
  if (!(await removeCredential(provider, field))) throw new HttpError(404, "Nothing is saved for that field.");
  return NextResponse.json({ provider: await providerView(provider) });
});
