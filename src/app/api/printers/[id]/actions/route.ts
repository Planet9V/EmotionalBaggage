import { NextResponse } from "next/server";
import { z } from "zod";
import { body, recordId, route } from "@/lib/api/route";
import { runPrinterAction } from "@/lib/printers/actions";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["start", "pause", "resume", "cancel"]),
  /** the file to start, for "start" */
  name: z.string().trim().min(1).max(120).optional(),
  /** start and cancel are destructive: the request is refused unless this is true */
  confirm: z.boolean().optional(),
  plate: z.number().int().min(1).max(64).optional(),
  useAms: z.boolean().optional(),
  amsMapping: z.array(z.number().int().min(-1).max(15)).max(16).optional(),
  timelapse: z.boolean().optional(),
});

/** Start, pause, resume or cancel on a saved printer. Start and cancel need confirm: true; every one is written to the audit log. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That printer");
  const b = await body(req, schema);
  const result = await runPrinterAction(id, b.action, {
    confirm: b.confirm, name: b.name, options: { plate: b.plate, useAms: b.useAms, amsMapping: b.amsMapping, timelapse: b.timelapse },
  });
  return NextResponse.json({ ok: true, message: result.message });
});
