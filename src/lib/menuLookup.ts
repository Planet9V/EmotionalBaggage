// Names and addresses of the menu's stages, sections and stores, read from the menu (src/lib/menu.ts).
// Several sections can show one store (Sourcing, Physical layout and Bill of materials all show design/bom).
// The section whose own path is the store ("design/bom" is Bill of materials) owns it first; a store with
// no section of that path ("design/wiring") belongs to the first section that shows it.
import { DEFAULT_STATUSES, STAGES, storeKey, type Section, type Stage } from "@/lib/menu";

/** Every distinct store key in menu order, with the stage and section that owns it. */
export type StoreRef = { store: string; stage: Stage; section: Section };

export const STORE_REFS: StoreRef[] = (() => {
  const out = new Map<string, StoreRef>();
  for (const stage of STAGES) {
    for (const section of stage.sections) {
      const store = storeKey(stage, section);
      const own = `${stage.key}/${section.key}` === store;
      // the first section to show a store holds it until a section of that store's own path turns up
      if (!out.has(store) || own) out.set(store, { store, stage, section });
    }
  }
  return [...out.values()];
})();

const BY_STORE = new Map(STORE_REFS.map((r) => [r.store, r]));

export const storeRef = (store: string): StoreRef | null => BY_STORE.get(store) ?? null;

/**
 * The stage and section a key names: a store key ("design/bom"), or the path of a section that shows another store
 * ("prototype/sourcing" shows design/bom). The process checks and the chat sources use both kinds of key.
 */
function locate(key: string): { stage: Stage; section: Section } | null {
  const byStore = BY_STORE.get(key);
  if (byStore) return byStore;
  const [stageKey, sectionKey] = key.split("/");
  const stage = STAGES.find((s) => s.key === stageKey);
  const section = stage?.sections.find((x) => x.key === sectionKey);
  return stage && section ? { stage, section } : null;
}

/** The statuses a row in this store can take; the current one is always included. */
export function statusesFor(store: string, current?: string): string[] {
  const list = BY_STORE.get(store)?.section.statuses ?? DEFAULT_STATUSES;
  return current && !list.includes(current) ? [...list, current] : list;
}

/** The label of a stage ("prototype" gives "Prototype"), or the key. */
export const stageLabel = (key: string): string => STAGES.find((s) => s.key === key)?.label ?? key;

/** The label a person sees for a store key or a section path ("design/bom" and "prototype/sourcing" give "Bill of materials" and "Sourcing"), or the key itself. */
export const sectionLabel = (key: string): string => locate(key)?.section.label ?? key;

/** "Prototype / Assembly"; a store the menu does not know is shown as stored. */
export function storeLabel(store: string): string {
  const r = locate(store);
  return r ? `${r.stage.label} / ${r.section.label}` : store;
}

/** The page that shows a store's rows ("/s/design/bom"), or null for a store the menu does not know. */
export function storeHref(store: string): string | null {
  const r = locate(store);
  return r ? (r.section.href ?? `/s/${r.stage.key}/${r.section.key}`) : null;
}

/** As storeHref, and for a store the menu does not know a best-guess address. */
export const storeLink = (store: string): string => storeHref(store) ?? `/s/${store}`;
