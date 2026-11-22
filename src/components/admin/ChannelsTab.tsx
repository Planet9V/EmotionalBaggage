"use client";

// Admin, Sales channels: the credentials the channel code reads (Amazon Selling Partner API, X, Instagram), each on
// the shared key card with its own connection test and notes. Admin owns the values; the Integrations page
// (/integrations) is the read-only report of what is connected, for everyone.
import Link from "next/link";
import { CredentialsTab } from "./CredentialsTab";

/** The providers that are sales channels (src/lib/channels/registry.ts), in the order shown. */
const CHANNEL_PROVIDERS = ["amazon-sp", "x", "instagram"] as const;

export function ChannelsTab() {
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-secondary">
        Where the app sells and posts. Each channel is optional: without it, its screens say it is not connected and you can still work by hand. What is
        connected is also listed, read only, on{" "}
        <Link href="/integrations" className="text-link underline underline-offset-2">
          Integrations
        </Link>
        .
      </p>
      <CredentialsTab only={CHANNEL_PROVIDERS} intro={false} />
    </div>
  );
}
