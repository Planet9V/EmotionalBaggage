// The concept story and the concept's sources: what each part of the story is, and what a story row and a
// source row hold in `data`. Pure, so the browser, the API and the drafting engine share one definition.
//
// Both are ordinary rows in `items`: the story in "concept/story" (one row per part, the part's text in the
// body as Markdown), the sources in "concept/files" (title, what it is in the body, where it came from in
// data). The text of a source is cut into passages in `source_chunks` (migration 0029).
import { z } from "zod";

export const STORY_STORE = "concept/story";
export const SOURCES_STORE = "concept/files";


export type StoryPartKey = "pitch" | "origin" | "how" | "why" | "who" | "positioning" | "voice" | "open" | "gate";

export type StoryPart = {
  key: StoryPartKey;
  heading: string;
  /** what the part covers, shown when it is empty and given to the drafting model */
  covers: string;
};

export const STORY_PARTS: StoryPart[] = [
  { key: "pitch", heading: "The pitch", covers: "The whole idea in one paragraph: what it is, who it is for, and why anyone would want it." },
  { key: "origin", heading: "Where the idea came from", covers: "The moment, the itch or the joke that started it, and what inspired it." },
  { key: "how", heading: "What it is and how it works", covers: "The product in plain words: what you hold, what it does, and how it does it, without jargon." },
  { key: "why", heading: "Why it should work", covers: "The reasoning and the evidence. Each claim is marked as sourced, measured, or an assumption still to test." },
  { key: "who", heading: "Who it is for, and the moment they want it", covers: "The people who buy it, the people who use it, and the moment they reach for it." },
  { key: "positioning", heading: "Positioning", covers: "What it sits next to, what it is not, and the one-line position." },
  { key: "voice", heading: "Voice, humour and personality", covers: "How it talks and behaves, with real examples of its lines." },
  { key: "open", heading: "Decided and still open", covers: "What has been settled, and what is still open or in conflict between the sources." },
  { key: "gate", heading: "What it costs to find out", covers: "The cheapest test that would show it is worth building, what it costs, and the result that means go or stop." },
];

export const STORY_PART_KEYS = STORY_PARTS.map((p) => p.key) as [StoryPartKey, ...StoryPartKey[]];
export const storyPart = (key: unknown): StoryPart | undefined => STORY_PARTS.find((p) => p.key === key);

export const CLAIM_BASES = ["sourced", "measured", "assumption"] as const;
export type ClaimBasis = (typeof CLAIM_BASES)[number];
export const CLAIM_BASIS_LABEL: Record<ClaimBasis, string> = {
  sourced: "Sourced",
  measured: "Measured",
  assumption: "Assumption to test",
};

const text = (max: number) => z.string().max(max);
const ids = z.array(z.number().int().positive()).max(100);

const claim = z.object({
  text: text(1000).trim().min(1, "a claim needs text"),
  basis: z.enum(CLAIM_BASES),
  /** source rows (concept/files) it was taken from */
  sourceIds: ids.optional(),
  /** "stated in the source, not checked", or how it was measured */
  note: text(500).optional(),
});

const example = z.object({
  text: text(600).trim().min(1, "an example needs text"),
  /** when it is said: "at the check-in scale" */
  context: text(300).optional(),
});

/** A part of the concept story. The heading is the row's title; the part's text is the body (Markdown). */
const storyData = z.looseObject({
  part: z.enum(STORY_PART_KEYS),
  /** positioning: the one-line position, shown as a pull-out */
  position: text(400).optional(),
  /** voice: lines set as examples */
  examples: z.array(example).max(60).optional(),
  /** why: the claims, each with how it is known */
  claims: z.array(claim).max(60).optional(),
  /** source rows (concept/files) this part was written from */
  sourceIds: ids.optional(),
});
export type StoryData = z.infer<typeof storyData>;
export type StoryClaim = z.infer<typeof claim>;
export type StoryExample = z.infer<typeof example>;

export const SOURCE_KINDS = ["document", "note", "chat", "spreadsheet", "image", "link", "other"] as const;
export const SOURCE_KIND_LABEL: Record<(typeof SOURCE_KINDS)[number], string> = {
  document: "Document",
  note: "Note",
  chat: "Chat",
  spreadsheet: "Spreadsheet",
  image: "Image",
  link: "Link",
  other: "Other",
};

/** A source. Its title is the row's title; what it is goes in the body. */
const sourceData = z.looseObject({
  kind: z.enum(SOURCE_KINDS).default("document"),
  /** where it came from, in words: "a file", "the owner's Drive folder", "a chat with an assistant" */
  origin: text(400).optional(),
  url: text(2000).optional(),
  /** the stored file, when there is one */
  fileId: z.number().int().positive().nullable().optional(),
  fileName: text(300).optional(),
  mime: text(120).optional(),
  size: z.number().int().min(0).optional(),
  addedBy: text(120).optional(),
  addedAt: text(40).optional(),
  /** characters of text read from it, and the passages it was cut into */
  chars: z.number().int().min(0).optional(),
  chunks: z.number().int().min(0).optional(),
  /** how the text was read, and anything to know about it */
  extract: z.looseObject({ method: text(60), note: text(500).optional() }).optional(),
  /** the folder it is filed in ("" or absent: the top level); one level of folders */
  folder: text(120).optional(),
  /** earlier versions of the file, newest first: each kept in the file store when a new version replaced it */
  versions: z
    .array(z.looseObject({ fileId: z.number().int().positive(), fileName: text(300), size: z.number().int().min(0), sha256: text(64).optional(), replacedAt: text(40), replacedBy: text(120).optional() }))
    .max(100)
    .optional(),
});
export type SourceData = z.infer<typeof sourceData>;

export const STORY_SCHEMAS = { [STORY_STORE]: storyData, [SOURCES_STORE]: sourceData };

/** The source ids a story row cites: its own and its claims'. */
export function citedSourceIds(data: Record<string, unknown>): number[] {
  const out = new Set<number>();
  const add = (v: unknown) => {
    if (Array.isArray(v)) for (const n of v) if (typeof n === "number") out.add(n);
  };
  add(data.sourceIds);
  if (Array.isArray(data.claims)) for (const c of data.claims) if (c && typeof c === "object") add((c as { sourceIds?: unknown }).sourceIds);
  return [...out];
}

/** Files whose text is code or configuration: read as text, shown in a monospaced preview. */
export const CODE_EXTENSIONS = ["sql", "yml", "yaml", "toml", "ini", "ino", "c", "h", "cpp", "hpp", "py", "js", "mjs", "ts", "tsx", "jsx", "sh", "html", "css", "xml", "env"] as const;
/** Uploads accepted as files, by extension. Word files are refused: no reader for them is installed. */
const SOURCE_EXTENSIONS = ["md", "markdown", "txt", "text", "csv", "tsv", "json", ...CODE_EXTENSIONS, "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg"] as const;
/** The largest file the file store keeps (the files table's own limit). */
export const MAX_FILE_MB = 25;

/** How a file is previewed, from its name. */
export function previewKind(name: string): "markdown" | "text" | "csv" | "code" | "pdf" | "image" | "none" {
  const ext = name.toLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[1] ?? "";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if ((CODE_EXTENSIONS as readonly string[]).includes(ext) || ext === "json" || ext === "svg") return "code";
  if (ext === "txt" || ext === "text") return "text";
  return "none";
}
export const SOURCE_ACCEPT = SOURCE_EXTENSIONS.map((e) => `.${e}`).join(",");
