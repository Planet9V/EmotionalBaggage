// Whether the /admin page shows the admin area to this visitor (cut-over review B3). With the new sign-in on, only
// the platform administrator sees it; anyone else gets a plain sentence and no data. With it off, everyone the proxy
// let through sees it, as before. The API routes behind the page decide for themselves (src/lib/admin/guard.ts); this
// only keeps the screen from offering what they refuse.
import { auth2Enabled } from "@/lib/auth2/config";

export async function adminPageOpen(headers: Headers): Promise<boolean> {
  if (!(await auth2Enabled())) return true;
  try {
    const { requirePlatformAdmin } = await import("@/lib/auth2/platformAdmin");
    await requirePlatformAdmin(headers);
    return true;
  } catch {
    // signed out, not the platform administrator, disabled, or the check failed: closed
    return false;
  }
}
