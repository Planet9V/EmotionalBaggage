// Admin, Sign-in: the new sign-in's switch and addresses (accounts slice 2, integration with the admin area).
// Read here; changed through the route (platform administrator only) and src/lib/auth2/adminOps.ts setAddresses.
// While the new sign-in is off nobody is the platform administrator: it is first turned on from inside the
// container (`node scripts/sign-in.mjs on`); after that the platform administrator turns it off or on here.
import { AUTH2_SETTING, auth2Enabled, override, readAuth2Setting, resolveAddresses } from "@/lib/auth2/config";
import { ownerPool, ready } from "@/lib/db";

/** What the platform administrator reads of Admin, Sign-in. */
export type SignInStatus = {
  on: boolean;
  /** "environment" when AUTH2 overrides the stored switch (development and tests) */
  switchFrom: "environment" | "database";
  detail: {
    baseURL: string | null;
    trustedOrigins: string[];
    platformAdminAddress: string | null;
    warnings: string[];
    mail: boolean;
  };
  /** Said plainly on the screen (slice 3 scopes concepts per workspace). */
  sharedConcepts: string;
};

/**
 * What anyone else reads (cut-over review F1): whether the new sign-in is on, nothing more. With the switch off this
 * is everyone, the public demo account included; with it on, nobody else reaches the route at all (B3).
 */
export type SignInSummary = { enabled: boolean };

const SHARED_CONCEPTS =
  "Concepts are not yet kept apart per workspace: until that is built, every signed-in account sees and changes the same concepts, as today. Workspaces, members and invitations already work.";

/** Reads only: never creates the secret or any other row (F1). */
export async function signInStatus(viewer: { platformAdmin: boolean }): Promise<SignInStatus | SignInSummary> {
  await ready();
  const db = ownerPool();
  const on = await auth2Enabled();
  if (!viewer.platformAdmin) return { enabled: on };
  const config = await resolveAddresses(db);
  const address = await readAuth2Setting<unknown>(db, AUTH2_SETTING.platformAdminAddress);
  return {
    on,
    switchFrom: override() === null ? "database" : "environment",
    sharedConcepts: SHARED_CONCEPTS,
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
