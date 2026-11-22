import { adminRoute } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { PRINTER_FAMILIES } from "@/lib/admin/printerFamilies";

/** The printer families, for the Admin form to build itself from. */
export const GET = adminRoute(async () => NextResponse.json({ families: PRINTER_FAMILIES }));
