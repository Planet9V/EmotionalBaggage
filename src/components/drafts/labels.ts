import { BUILD_SHEET } from "@/lib/ai/drafts/impact";
import { STAGES, storeKey } from "@/lib/menu";

/** The menu label of the section that shows a store (browser side). */
export function storeLabelClient(store: string) {
  if (store === BUILD_SHEET) return "Wiring and soldering";
  for (const st of STAGES) for (const s of st.sections) if (storeKey(st, s) === store) return s.label;
  return store;
}
