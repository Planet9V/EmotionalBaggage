import { NextResponse } from "next/server";
import { adminAccess, adminRoute } from "@/lib/admin/guard";

/** Which new powers this session has ({ platformAdmin, capabilities, notice }); the screens disable the rest. */
export const GET = adminRoute(async (req: Request) => NextResponse.json(await adminAccess(req)));
