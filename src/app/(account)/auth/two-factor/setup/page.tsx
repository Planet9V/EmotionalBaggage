import type { Metadata } from "next";
import { requiredFor } from "@/lib/auth2/workspaces/twoFactor";
import { ownerPool } from "@/lib/db";
import { requireAccount } from "../../gate";
import { TwoFactorSetup } from "./TwoFactorSetup";

export const metadata: Metadata = { title: "Authenticator app · Shipwright" };

export default async function TwoFactorSetupPage() {
  const { user } = await requireAccount("/auth/two-factor/setup", { owedOk: true });
  const required = await requiredFor(ownerPool(), user.id);
  return <TwoFactorSetup enabled={Boolean((user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled)} email={user.email} required={required} />;
}
