// Where the slicer service is: the address saved in Admin, Printers ("slicer.url") first, then the
// SLICER_URL environment variable, the same order as the planner address (src/lib/admin/planner.ts).
import { getSetting, SETTING } from "@/lib/settings";

export const SLICER_SETTING = SETTING.slicerUrl;

export type SlicerAddress = { url: string | null; source: "admin" | "environment" | null };

export async function slicerAddress(): Promise<SlicerAddress> {
  const saved = await getSetting<string | null>(SLICER_SETTING, null);
  if (typeof saved === "string" && saved.trim()) return { url: saved.trim().replace(/\/+$/, ""), source: "admin" };
  const env = process.env.SLICER_URL?.trim();
  if (env) return { url: env.replace(/\/+$/, ""), source: "environment" };
  return { url: null, source: null };
}

/** The slicer's base address with no trailing slash, or null when neither Admin nor the environment sets one. */
export async function slicerUrl(): Promise<string | null> {
  return (await slicerAddress()).url;
}
