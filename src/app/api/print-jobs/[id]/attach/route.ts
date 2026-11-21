import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, recordId, route } from "@/lib/api/route";
import { attachSlicedFile } from "@/lib/slicing/flow";

type Ctx = { params: Promise<{ id: string }> };
const MAX = 100 * 1024 * 1024;

const fields = z.object({
  slicer: z.string().trim().min(1, "Name the slicer the file came from.").max(80),
  minutes: z.coerce.number().finite().positive("The print time is a number of minutes above 0.").max(60 * 24 * 14),
  grams: z.coerce.number().finite().min(0, "Filament is a number of grams, 0 or more.").max(100_000),
});

/**
 * multipart/form-data: file (the sliced G-code or .3mf), slicer (its name), minutes and grams (what that slicer
 * reported). For a job sliced in the person's own slicer, when this install has none or they prefer their own.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That print job");
  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, "The upload could not be read. Send it as multipart/form-data with a file field.");
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach the sliced file.");
  if (file.size > MAX) throw new HttpError(413, "Files are limited to 100 MB.");
  const parsed = fields.safeParse({ slicer: form.get("slicer") ?? "", minutes: form.get("minutes") ?? "", grams: form.get("grams") ?? "" });
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Check the slicer, minutes and grams.");
  const item = await attachSlicedFile(id, { file: { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, slicer: parsed.data.slicer, seconds: Math.round(parsed.data.minutes * 60), filamentG: parsed.data.grams });
  return NextResponse.json({ item }, { status: 201 });
}, { maxBodyBytes: MAX + 64 * 1024, tooLarge: "Files are limited to 100 MB." });
