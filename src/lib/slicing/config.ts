// Where the slicer service is: the address saved in settings ("slicer.url"), then the SLICER_URL environment variable.
import { getSetting } from "@/lib/settings";

export const SLICER_SETTING = "slicer.url";

export async function slicerUrl(): Promise<string | null> {
  const saved = (await getSetting<string | null>(SLICER_SETTING, null)) ?? "";
  const url = (saved.trim() || process.env.SLICER_URL?.trim() || "").replace(/\/+$/, "");
  return url || null;
}
