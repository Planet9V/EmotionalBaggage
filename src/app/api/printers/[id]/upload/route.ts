import { NextResponse } from "next/server";
import { HttpError, recordId, route } from "@/lib/api/route";
import { uploadToPrinter } from "@/lib/printers/actions";

type Ctx = { params: Promise<{ id: string }> };
const MAX = 100 * 1024 * 1024;

/** multipart/form-data: file (required), name (optional: the name to store it under). Sends the file; never starts the print. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That printer");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "file is required.");
  if (file.size > MAX) throw new HttpError(413, "Files are limited to 100 MB.");
  const given = form?.get("name");
  const name = typeof given === "string" && given.trim() ? given.trim() : file.name;
  const result = await uploadToPrinter(id, { data: new Uint8Array(await file.arrayBuffer()), contentType: file.type || undefined }, name);
  return NextResponse.json({ ok: true, name: result.name, message: result.message }, { status: 201 });
});
