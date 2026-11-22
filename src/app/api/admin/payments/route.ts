import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin/guard";
import { getStripeSettings, STRIPE_WEBHOOK_PATH } from "@/lib/admin/stripe";

/** Whether payments are set up, in which mode, and the webhook path. Never a key: the keys are in /api/admin/credentials. */
export const GET = adminRoute(async () => {
  const s = await getStripeSettings();
  return NextResponse.json(
    s.configured
      ? { configured: true, mode: s.mode, webhookSecret: !!s.webhookSecret, webhookPath: STRIPE_WEBHOOK_PATH }
      : { configured: false, reason: s.reason, webhookPath: STRIPE_WEBHOOK_PATH }
  );
});
