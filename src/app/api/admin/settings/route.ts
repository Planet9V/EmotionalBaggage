import { adminRoute, isPlatformAdmin, platformAdminOnly, requirePlatformAdmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { body } from "@/lib/api/route";
import { readAdminSettings, writeAdminSettings } from "@/lib/admin/settings";
import { adminSettingsPut } from "@/lib/admin/schemas";

export const GET = adminRoute(async (req: Request) => NextResponse.json({ settings: await readAdminSettings({ platformAdmin: await isPlatformAdmin(req) }) }));

/** Any of reasoningModel, embeddingModel, plannerUrl, defaultConcept. Absent keys are unchanged; null clears. */
export const PUT = adminRoute(async (req: Request) => {
  const b = await body(req, adminSettingsPut);
  // mail and voice are new powers (platform administrator); every other key is open as before
  if (Object.keys(b).some((k) => platformAdminOnly.setting(k))) await requirePlatformAdmin(req);
  const notices = await writeAdminSettings(b);
  return NextResponse.json({ settings: await readAdminSettings({ platformAdmin: await isPlatformAdmin(req) }), notices });
});
