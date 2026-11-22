import { adminRoute, guardAccessRequests } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, recordId } from "@/lib/api/route";
import { ACCESS_STATUSES } from "@/lib/accessRequests/shared";
import { deleteAccessRequest, setAccessStatus } from "@/lib/accessRequests/store";

type Ctx = { params: Promise<{ id: string }> };

const StatusChange = z.object({ status: z.enum(ACCESS_STATUSES, "Choose new, contacted or declined.") });

/** Sets a request's status (new, contacted, declined), recorded with before and after. */
export const PATCH = adminRoute(async (req: Request, { params }: Ctx) => {
  await guardAccessRequests(req);
  const id = recordId((await params).id, "That access request");
  const { status } = await body(req, StatusChange);
  return NextResponse.json({ request: await setAccessStatus(id, status) });
});

/**
 * Deletes a request, recorded by its number and status only. Guarded like the other actions: the platform
 * administrator's with the new sign-in on; with it off, refused while the account uses the published demo password.
 */
export const DELETE = adminRoute(async (req: Request, { params }: Ctx) => {
  await guardAccessRequests(req);
  await deleteAccessRequest(recordId((await params).id, "That access request"));
  return NextResponse.json({ ok: true });
});
