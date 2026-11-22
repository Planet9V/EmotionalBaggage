// HOOK: is the caller the platform administrator? The platform administrator exists only in the new sign-in
// (AUTH2); under the old sign-in nobody is, so this answers false and the new powers of Admin stay closed.
//
// TODO(accounts slice 2): when AUTH2 is on, answer from src/lib/auth2/platformAdmin.ts `requirePlatformAdmin(headers)`
// (the platform-admin flag of the signed-in Better Auth user). Until it exists this is false, so nothing is open by
// accident. This is the only place that decides; src/lib/admin/guard.ts calls nothing else.
import { auth2Enabled } from "@/lib/auth2/config";

export async function platformAdminFromAuth2(req: Request): Promise<boolean> {
  if (!auth2Enabled()) return false;
  void req; // slice 2: return await requirePlatformAdmin(req.headers) resolved to a boolean
  return false;
}
