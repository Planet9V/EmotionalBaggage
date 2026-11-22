import type { Metadata } from "next";
import { requireAccount } from "../../gate";
import { TwoFactorSetup } from "./TwoFactorSetup";

export const metadata: Metadata = { title: "Authenticator app · Concept to Realization" };

export default async function TwoFactorSetupPage() {
  const { user } = await requireAccount("/auth/two-factor/setup");
  return <TwoFactorSetup enabled={Boolean((user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled)} email={user.email} />;
}
