import { NextResponse } from "next/server";
import { z } from "zod";
import { body } from "@/lib/api/route";
import { adminRoute } from "@/lib/admin/guard";
import { httpUrl } from "@/lib/admin/schemas";
import { listSpeechModels, listVoices } from "@/lib/voice/speech";

const optionsBody = z.object({ provider: z.enum(["kokoro", "openrouter"]).optional(), baseUrl: httpUrl.optional(), model: z.string().trim().min(1).max(200).optional() }).strict();

/**
 * POST { provider?, baseUrl?, model? }: the models and voices on offer, for the pickers in Admin, Voice. Kokoro: the
 * server at the address in the form, else the saved one. OpenRouter: its speech models, and the voices of `model`.
 * It calls out, so it is the platform administrator's; it saves nothing.
 */
export const POST = adminRoute(async (req: Request) => {
  const b = await body(req, optionsBody);
  const [voices, models] = await Promise.all([listVoices(b), listSpeechModels(b)]);
  return NextResponse.json({ voices, models });
}, { platformAdmin: true });
