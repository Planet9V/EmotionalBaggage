import { adminRoute, isPlatformAdmin, platformAdminOnly, requirePlatformAdmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { body } from "@/lib/api/route";
import { readAdminSettings, writeAdminSettings } from "@/lib/admin/settings";
import { adminSettingsPut } from "@/lib/admin/schemas";

export const GET = adminRoute(async (req: Request) => NextResponse.json({ settings: await readAdminSettings({ platformAdmin: await isPlatformAdmin(req) }) }));

/** Any of reasoningModel, embeddingModel, plannerUrl, defaultConcept. Absent keys are unchanged; null clears. */
export const PUT = adminRoute(async (req: Request) => {
  const b = await body(req, adminSettingsPut);
  // Only the keys listed open in the guard (GUARD_LISTS) may be changed by anyone; mail, voice and anything later need the platform administrator
  if (Object.keys(b).some((k) => platformAdminOnly.setting(k))) await requirePlatformAdmin(req);
  const notices = await writeAdminSettings(b);
  return NextResponse.json({ settings: await readAdminSettings({ platformAdmin: await isPlatformAdmin(req) }), notices });
});
