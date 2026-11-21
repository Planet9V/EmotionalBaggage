import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { FILE_ONLY_STEPS, modelsByMaker, validateModels } from "@/lib/printers/models";

/** The supported-printer list: models by maker, each with its adapter and the page every fact came from. */
export const GET = route(async () => NextResponse.json({ makers: modelsByMaker(), fileOnlySteps: FILE_ONLY_STEPS, problems: validateModels() }));
