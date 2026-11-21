// Browser-safe: which slicer profile a printer saved in Admin stands for.
export type SlicerPrinter = { maker: string; model: string; available: boolean; reason: string; materials: string[]; layerHeights: number[]; note: string };
export type SlicerCatalogue = { orca: { version: string; commit: string }; materials: string[]; printers: SlicerPrinter[] };

/** "Maker Model", the model alone, or "maker-model" as an id. Exactly one match, or null: a guess is never made. */
export function matchPrinter(text: string, printers: SlicerPrinter[]): SlicerPrinter | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  const hits = printers.filter((p) => {
    const full = `${p.maker} ${p.model}`.toLowerCase();
    return full === t || p.model.toLowerCase() === t || full.replace(/ /g, "-") === t;
  });
  return hits.length === 1 ? hits[0] : null;
}
