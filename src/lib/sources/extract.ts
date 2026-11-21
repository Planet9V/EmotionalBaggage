// Reading the text out of a source file. Plain text, Markdown, CSV and JSON are read as UTF-8; a PDF's text
// layer is read with unpdf (Mozilla's PDF.js, serverless build); an image is kept with no text. Word files are
// refused with a sentence: no maintained Word reader is installed in this app.
import { HttpError } from "@/lib/api/route";
import { normaliseText } from "./chunk";
import { CODE_EXTENSIONS } from "@/lib/story/parts";

export type Extracted = {
  text: string;
  /** how it was read: "text", "pdf", "image" or "pasted" */
  method: string;
  /** something the person should know about what was read */
  note?: string;
  /** what the stored file is: the MIME type the app serves it as */
  mime: string;
  kind: "document" | "spreadsheet" | "image" | "note";
};

const TEXT = new Set(["md", "markdown", "txt", "text", "json", ...CODE_EXTENSIONS]);
const TABLE = new Set(["csv", "tsv"]);
const IMAGE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
const WORD = new Set(["doc", "docx", "odt", "rtf", "pages"]);

/** A PDF longer than this many pages is read only up to it, and the note says so. */
const MAX_PDF_PAGES = 400;

const extensionOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[1] ?? "");

/** The text of an uploaded file, or a refusal (415) that says what to do instead. */
export async function extractText(name: string, mime: string, bytes: Uint8Array): Promise<Extracted> {
  const ext = extensionOf(name);
  const isPdf = ext === "pdf" || mime === "application/pdf";
  if (WORD.has(ext)) {
    throw new HttpError(415, `"${name}" is a Word or rich-text file, and no reader for those is installed here. Save it as PDF or plain text, or paste its text.`);
  }
  if (TEXT.has(ext) || TABLE.has(ext) || (!ext && mime.startsWith("text/"))) {
    const text = normaliseText(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
    const table = TABLE.has(ext);
    return {
      text,
      method: "text",
      mime: table ? "text/csv" : ext === "json" ? "application/json" : ext === "md" || ext === "markdown" ? "text/markdown" : ext === "yml" || ext === "yaml" ? "application/yaml" : ext === "sql" ? "application/sql" : "text/plain",
      kind: table ? "spreadsheet" : "document",
      ...(text ? {} : { note: "The file holds no text." }),
    };
  }
  if (isPdf) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    let pages: string[];
    let total: number;
    try {
      const doc = await getDocumentProxy(new Uint8Array(bytes));
      total = doc.numPages;
      if (total > MAX_PDF_PAGES) {
        pages = [];
        for (let i = 1; i <= MAX_PDF_PAGES; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join(""));
        }
      } else {
        pages = (await pdfText(doc, { mergePages: false })).text;
      }
    } catch (e) {
      throw new HttpError(415, `"${name}" could not be read as a PDF: ${(e as Error).message}`.slice(0, 300));
    }
    const text = normaliseText(pages.map((p, i) => `[Page ${i + 1} of ${total}]\n${p}`).join("\n\n"));
    const words = text.replace(/\[Page \d+ of \d+\]/g, "").trim();
    return {
      text: words ? text : "",
      method: "pdf",
      mime: "application/pdf",
      kind: "document",
      ...(words
        ? total > MAX_PDF_PAGES
          ? { note: `Only the first ${MAX_PDF_PAGES} of ${total} pages were read.` }
          : {}
        : { note: "This PDF has no text layer (it may be scanned pages). Paste its text, or describe it in What it is." }),
    };
  }
  if (IMAGE[ext] || mime.startsWith("image/")) {
    return { text: "", method: "image", mime: IMAGE[ext] ?? mime, kind: "image", note: "An image has no text to search. Say what it shows in What it is, so chat and search can find it." };
  }
  throw new HttpError(415, `"${name}" is not a kind of file this page reads. Upload Markdown, text, CSV, JSON, code (SQL, YAML and the like), PDF or an image, or paste the text.`);
}
