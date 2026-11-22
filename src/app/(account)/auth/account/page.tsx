import type { Metadata } from "next";
import { EYEBROW } from "@/components/ui/field";
import { requireWorkspace } from "../gate";
import { Frame, TextLink } from "../_components/Frame";
import { AccountActions } from "./AccountActions";

export const metadata: Metadata = { title: "Your account · Concept to Realization" };

export default async function AccountPage() {
  const { user, active, all } = await requireWorkspace("/auth/account");
  const twoFactor = Boolean((user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled);
  return (
    <Frame title="Your account" lead={<>Signed in as <strong className="break-all font-medium text-primary">{user.email}</strong>.</>}>
      <section aria-labelledby="ws-h" className="space-y-1">
        <h2 id="ws-h" className={EYEBROW}>Workspace</h2>
        <p className="text-sm text-primary">
          <strong className="font-medium">{active.name}</strong>{" "}
          <TextLink href="/auth/workspaces">{all.length > 1 ? `Switch (${all.length} workspaces)` : "Workspaces"}</TextLink>
        </p>
      </section>
      <section aria-labelledby="password-h" className="space-y-1">
        <h2 id="password-h" className={EYEBROW}>Password</h2>
        <p className="text-sm text-primary"><TextLink href="/auth/password">Change your password</TextLink></p>
      </section>
      <section aria-labelledby="tf-h" className="space-y-1">
        <h2 id="tf-h" className={EYEBROW}>Two-step sign-in</h2>
        <p className="text-sm text-primary">
          {twoFactor ? "On: signing in asks for a code from your authenticator app." : "Off: signing in asks only for your password."}{" "}
          <TextLink href="/auth/two-factor/setup">{twoFactor ? "Manage" : "Set up an authenticator app"}</TextLink>
        </p>
      </section>
      <AccountActions />
    </Frame>
  );
}
