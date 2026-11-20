import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { PRINTER_FAMILIES } from "@/lib/admin/printerFamilies";

/** The printer families, for the Admin form to build itself from. */
export const GET = route(async () => NextResponse.json({ families: PRINTER_FAMILIES }));
