// An authored enclosure: one designed outside this app's generators (CaseMaker, YAPP_Box) and kept as files in the
// concept's Files. The concept's enclosure row (design/enclosure) names it with `enclosureSource: "authored"` and
// lists its files by their names in Files; the Enclosure page shows its renders and downloads instead of the
// generator controls. Its checks are the ones its own maker ran, and the row says who ran them: this app does not
// measure an authored mesh.
import { z } from "zod";

const fileName = z.string().trim().min(1).max(200);

export const authoredEnclosure = z.object({
  /** what it is, as the decision names it */
  name: z.string().trim().min(1).max(200),
  /** outside size in mm: width, length, thickness */
  size: z.array(z.number().positive()).length(3).optional(),
  /** the decision row that chose it, by title */
  decision: z.string().max(300).optional(),
  /** the assembled model to download */
  model: fileName.optional(),
  /** the files that print, one per print job */
  printFiles: z.array(fileName).max(20).default([]),
  renders: z.array(z.object({ file: fileName, label: z.string().trim().min(1).max(300) })).max(20).default([]),
  documents: z.array(fileName).max(20).default([]),
  checks: z.array(z.object({ label: z.string().trim().min(1).max(300), ok: z.boolean() })).max(100).default([]),
  /** who measured the checks (never this app) */
  checkedBy: z.string().max(300).default(""),
  designedBy: z.string().max(300).optional(),
});
export type AuthoredEnclosure = z.infer<typeof authoredEnclosure>;

export const ENCLOSURE_SOURCES = ["generated", "authored"] as const;

/** The authored enclosure a saved enclosure row chooses, or null when it chooses a generator (or nothing). */
export function authoredOf(data: Record<string, unknown> | undefined | null): AuthoredEnclosure | null {
  if (!data || data.enclosureSource !== "authored") return null;
  const r = authoredEnclosure.safeParse(data.authored);
  return r.success ? r.data : null;
}

/** Every file an authored enclosure names, once, in the order the page shows them. */
export const authoredFiles = (a: AuthoredEnclosure) => [...new Set([...(a.model ? [a.model] : []), ...a.printFiles, ...a.renders.map((r) => r.file), ...a.documents])];
