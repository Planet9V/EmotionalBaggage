// Admin, Sign-in: the new sign-in's switch and addresses (accounts slice 2, integration with the admin area).
// Read here; changed through the route (platform administrator only) and src/lib/auth2/adminOps.ts setAddresses.
// While the new sign-in is off nobody is the platform administrator: it is first turned on from inside the
// container (`node scripts/sign-in.mjs on`); after that the platform administrator turns it off or on here.
import { AUTH2_SETTING, auth2Enabled, override, readAuth2Setting, resolveAuth2Config } from "@/lib/auth2/config";
import { ownerPool, ready } from "@/lib/db";

export type SignInStatus = {
  on: boolean;
  /** "environment" when AUTH2 overrides the stored switch (development and tests) */
  switchFrom: "environment" | "database";
  /** null for anyone but the platform administrator once the new sign-in is on */
  detail: null | {
    baseURL: string | null;
    trustedOrigins: string[];
    platformAdminAddress: string | null;
    warnings: string[];
    mail: boolean;
  };
  /** Said plainly on the screen (slice 3 scopes concepts per workspace). */
  sharedConcepts: string;
};

export const SHARED_CONCEPTS =
  "Concepts are not yet kept apart per workspace: until that is built, every signed-in account sees and changes the same concepts, as today. Workspaces, members and invitations already work.";

export async function signInStatus(viewer: { platformAdmin: boolean }): Promise<SignInStatus> {
  await ready();
  const db = ownerPool();
  const on = await auth2Enabled();
  const base: SignInStatus = { on, switchFrom: override() === null ? "database" : "environment", detail: null, sharedConcepts: SHARED_CONCEPTS };
  if (on && !viewer.platformAdmin) return base;
  const config = await resolveAuth2Config(db);
  const address = await readAuth2Setting<unknown>(db, AUTH2_SETTING.platformAdminAddress);
  return {
    ...base,
    detail: {
      baseURL: config.baseURL,
      trustedOrigins: config.trustedOrigins.filter((o) => !config.baseURL || o !== new URL(config.baseURL).origin),
      platformAdminAddress: typeof address === "string" ? address : null,
      warnings: config.warnings,
      mail: await mailConfigured(),
    },
  };
}

/** Whether Admin, Email has a mail server (the log sender outside production does not count). */
async function mailConfigured(): Promise<boolean> {
  const { getMailSender } = await import("./mail");
  return (await getMailSender()).configured;
}
