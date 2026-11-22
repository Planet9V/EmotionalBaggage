import { NextResponse } from "next/server";
import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { getStripeSettings, STRIPE_WEBHOOK_PATH } from "@/lib/admin/stripe";

/** Whether payments are set up, in which mode, and the webhook path. Never a key: the keys are in /api/admin/credentials. */
export const GET = adminRoute(async (req: Request) => {
  const s = await getStripeSettings();
  // anyone but the platform administrator: configured or not, nothing more (review F5)
  if (!(await isPlatformAdmin(req))) return NextResponse.json({ configured: s.configured, hidden: true, webhookPath: STRIPE_WEBHOOK_PATH });
  return NextResponse.json(
    s.configured
      ? { configured: true, mode: s.mode, webhookSecret: !!s.webhookSecret, webhookPath: STRIPE_WEBHOOK_PATH }
      : { configured: false, reason: s.reason, webhookPath: STRIPE_WEBHOOK_PATH }
  );
});
