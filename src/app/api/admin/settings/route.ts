import { NextResponse } from "next/server";
import { body, route } from "@/lib/api/route";
import { readAdminSettings, writeAdminSettings } from "@/lib/admin/settings";
import { adminSettingsPut } from "@/lib/admin/schemas";

export const GET = route(async () => NextResponse.json({ settings: await readAdminSettings() }));

/** Any of reasoningModel, embeddingModel, plannerUrl, defaultConcept. Absent keys are unchanged; null clears. */
export const PUT = route(async (req: Request) => {
  const b = await body(req, adminSettingsPut);
  const notices = await writeAdminSettings(b);
  return NextResponse.json({ settings: await readAdminSettings(), notices });
});
