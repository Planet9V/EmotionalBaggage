import { NextResponse } from "next/server";
import { z } from "zod";
import { body, HttpError, requireProject, route } from "@/lib/api/route";
import { SOURCE_KINDS } from "@/lib/story/parts";
import { addSource, listSources, MAX_FILE_BYTES, MAX_PASTED, type NewSource } from "@/lib/sources/store";

type Ctx = { params: Promise<{ id: string }> };

/** room in the request for the multipart boundaries and the text fields */
const MULTIPART_ROOM = 64 * 1024;

const fields = {
  title: z.string().trim().min(1, "A source needs a title.").max(300),
  what: z.string().trim().max(4000).optional(),
  kind: z.enum(SOURCE_KINDS).optional(),
  origin: z.string().trim().max(400).optional(),
  url: z.string().trim().max(2000).optional().refine((u) => !u || /^https?:\/\//i.test(u), "A link starts with http:// or https://."),
  folder: z.string().trim().max(120).optional(),
};
const pasted = z.object({ ...fields, text: z.string().min(1, "Paste some text.").max(MAX_PASTED) });
const uploaded = z.object(fields);

/** Every source of the concept, in order, with what cites each one. */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  return NextResponse.json({ sources: await listSources(id, new URL(req.url).searchParams.get("q") ?? "") });
});

/**
 * Adds a source. multipart/form-data with `file` (Markdown, text, CSV, JSON, PDF or an image; 25 MB at most) and the
 * fields title, what, kind, origin and url; or JSON with the same fields and `text` (pasted text). The text is read,
 * cut into passages and indexed for search by meaning when an embedding model is chosen. The answer says how many
 * passages were made and what indexing did.
 */
export const POST = route(
  async (req: Request, { params }: Ctx) => {
    const { id } = await params;
    await requireProject(id);
    let input: NewSource;
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      if (!form) throw new HttpError(400, "The upload could not be read. Send it as multipart/form-data with a file field.");
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "Choose a file to upload.");
      if (file.size > MAX_FILE_BYTES) throw new HttpError(413, "Files are limited to 25 MB.");
      const text = (k: string) => {
        const v = form.get(k);
        return typeof v === "string" && v !== "" ? v.replace(/\u0000/g, "") : undefined;
      };
      const f = uploaded.parse({ title: text("title") ?? file.name, what: text("what"), kind: text("kind"), origin: text("origin"), url: text("url"), folder: text("folder") });
      input = { ...f, file: { name: file.name.replace(/\u0000/g, ""), mime: file.type || "application/octet-stream", bytes: new Uint8Array(await file.arrayBuffer()) } };
    } else {
      input = await body(req, pasted);
    }
    const r = await addSource(id, input);
    return NextResponse.json(r, { status: 201 });
  },
  { maxBodyBytes: MAX_FILE_BYTES + MULTIPART_ROOM, tooLarge: "Files are limited to 25 MB." }
);
