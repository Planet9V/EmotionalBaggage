import { NextResponse } from "next/server";
import { adminAccess, adminRoute } from "@/lib/admin/guard";

/** May this session change settings? { canWrite, reason }: the screens disable Save and Test and show the reason. */
export const GET = adminRoute(async (req: Request) => NextResponse.json(adminAccess(req)));
