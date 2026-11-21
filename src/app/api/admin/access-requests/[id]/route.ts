import { NextResponse } from "next/server";
import { z } from "zod";
import { body, recordId, route, sessionOf } from "@/lib/api/route";
import { ACCESS_STATUSES } from "@/lib/accessRequests/shared";
import { refuseWhileDefaultPassword, setAccessStatus } from "@/lib/accessRequests/store";

type Ctx = { params: Promise<{ id: string }> };

const StatusChange = z.object({ status: z.enum(ACCESS_STATUSES, "Choose new, contacted or declined.") });

/** Sets a request's status (new, contacted, declined), recorded with before and after. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  refuseWhileDefaultPassword(sessionOf(req).usingDefaultPassword);
  const id = recordId((await params).id, "That access request");
  const { status } = await body(req, StatusChange);
  return NextResponse.json({ request: await setAccessStatus(id, status) });
});
