import { MODELS, type PrinterModel } from "./models";

/** The list entry a saved printer's model text refers to: its id, or "Maker Model", or the model name alone. */
export function findModelFor(text: string): PrinterModel | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  return MODELS.find((m) => m.id === t || `${m.maker} ${m.model}`.toLowerCase() === t || m.model.toLowerCase() === t);
}
