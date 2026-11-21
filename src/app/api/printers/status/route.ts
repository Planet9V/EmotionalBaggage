import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { printerStatuses } from "@/lib/printers/readings";

/** The live status of every enabled printer. A printer that does not answer is listed with its error and when it is tried again. */
export const GET = route(async () => NextResponse.json({ printers: await printerStatuses() }));
