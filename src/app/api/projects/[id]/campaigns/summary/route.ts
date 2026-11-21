import { NextResponse } from "next/server";
import { requireProject, route } from "@/lib/api/route";
import { channelMargins } from "@/lib/campaigns/margin";
import { currencyOf, economicsRowsOf } from "@/lib/campaigns/server";

type Ctx = { params: Promise<{ id: string }> };

/**
 * What the campaign screens need from the unit economics: the concept's currency and the margin per
 * unit before advertising on each sales channel, with the arithmetic. The screens never work a margin
 * out themselves, so the number on a campaign is the number on the economics page.
 */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const currency = await currencyOf(id);
  return NextResponse.json({ currency, margins: channelMargins(await economicsRowsOf(id), currency) });
});
