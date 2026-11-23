// Admin, Users and Workspaces on the server: the platform-admin operations (src/lib/auth2/adminOps.ts) for one
// request, and their refusals as the route's plain answers. Only reached through adminRoute(..., { platformAdmin:
// true }), and adminOps checks the actor again on every call.
import { HttpError, sessionOf } from "@/lib/api/route";
import { ownerPool } from "@/lib/db";

/** The operations as the signed-in administrator of this request; `stepUp` is their own password typed again. */
export async function opsFor(req: Request, stepUp?: string) {
  const [{ adminOps }, { auth2 }, { resolveAuth2Config }] = await Promise.all([import("@/lib/auth2/adminOps"), import("@/lib/auth2/server"), import("@/lib/auth2/config")]);
  const s = sessionOf(req);
  if (s.kind !== "auth2") throw new HttpError(403, "This area is for the platform administrator.");
  const config = await resolveAuth2Config(ownerPool());
  return adminOps({ db: ownerPool(), auth: await auth2(), actorId: s.userId, baseURL: config.baseURL ?? "", stepUp });
}

/** A refusal of adminOps (Better Auth's APIError) as the same sentence and code, with its status. */
export async function refusalAsHttp<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const { APIError } = await import("better-auth/api");
    if (!(e instanceof APIError)) throw e;
    const b = e.body as { code?: string; message?: string } | undefined;
    throw new HttpError(e.statusCode, b?.message ?? "The change was refused.", b?.code ? { code: b.code } : undefined);
  }
}
