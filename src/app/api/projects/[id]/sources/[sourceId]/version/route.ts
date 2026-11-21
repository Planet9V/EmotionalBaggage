import { NextResponse } from "next/server";
import { HttpError, recordId, requireProject, route } from "@/lib/api/route";
import { MAX_FILE_BYTES, replaceVersion } from "@/lib/sources/store";

type Ctx = { params: Promise<{ id: string; sourceId: string }> };

/** Replaces a file with a new version (multipart/form-data, field `file`). The earlier version is kept and listed on the row. */
export const POST = route(
  async (req: Request, { params }: Ctx) => {
    const { id, sourceId } = await params;
    await requireProject(id);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Choose the new version of the file.");
    if (file.size > MAX_FILE_BYTES) throw new HttpError(413, "Files are limited to 25 MB.");
    const r = await replaceVersion(id, recordId(sourceId, "That file"), { name: file.name.replace(/\u0000/g, ""), mime: file.type || "application/octet-stream", bytes: new Uint8Array(await file.arrayBuffer()) });
    return NextResponse.json(r);
  },
  { maxBodyBytes: MAX_FILE_BYTES + 64 * 1024, tooLarge: "Files are limited to 25 MB." }
);
