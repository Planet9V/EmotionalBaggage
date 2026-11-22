import { NextResponse } from "next/server";
import { z } from "zod";
import { body } from "@/lib/api/route";
import { adminRoute } from "@/lib/admin/guard";
import { httpUrl } from "@/lib/admin/schemas";
import { listSpeechModels, listVoices } from "@/lib/voice/speech";

const optionsBody = z.object({ baseUrl: httpUrl.optional() }).strict();

/**
 * POST { baseUrl? }: the voices and models a Kokoro server offers, for the pickers in Admin, Voice (the address in
 * the form, else the saved one). It calls out, so it is the platform administrator's; it saves nothing.
 */
export const POST = adminRoute(async (req: Request) => {
  const b = await body(req, optionsBody);
  const [voices, models] = await Promise.all([listVoices({ baseUrl: b.baseUrl }), listSpeechModels({ baseUrl: b.baseUrl })]);
  return NextResponse.json({ voices, models });
}, { platformAdmin: true });
