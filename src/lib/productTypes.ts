import { STAGES, type Stage } from "@/lib/menu";

// What kind of product a concept is decides which menu sections it shows (plan 2.7).
// A hidden section is only hidden: its rows stay in the database and the item routes
// still accept them, so changing a concept's type back shows them again.

export type ProductType = "electronics" | "printed" | "physical";

export type ProductTypeInfo = {
  key: ProductType;
  label: string;
  /** Sections this type does not show, as "<stage key>/<section key>" (menu keys, not store keys). */
  hidden: readonly string[];
};

export const PRODUCT_TYPES: readonly ProductTypeInfo[] = [
  { key: "electronics", label: "Electronics in an enclosure", hidden: [] },
  { key: "printed", label: "Printed part", hidden: ["design/schematic", "prototype/wiring"] },
  { key: "physical", label: "Physical product, no electronics", hidden: ["design/schematic", "prototype/wiring"] },
];

export const PRODUCT_TYPE_KEYS = PRODUCT_TYPES.map((t) => t.key) as [ProductType, ...ProductType[]];

export const DEFAULT_PRODUCT_TYPE: ProductType = "electronics";

// A hidden key that names no menu section would silently hide nothing; fail at load instead.
for (const t of PRODUCT_TYPES) {
  for (const key of t.hidden) {
    const [stageKey, sectionKey] = key.split("/");
    const ok = STAGES.some((s) => s.key === stageKey && s.sections.some((x) => x.key === sectionKey));
    if (!ok) throw new Error(`Product type "${t.key}" hides "${key}", which is not a section of the menu.`);
  }
}

export function isProductType(value: unknown): value is ProductType {
  return typeof value === "string" && PRODUCT_TYPES.some((t) => t.key === value);
}

/** The type's definition. A value that is not a known type (an old row, a typo) is treated as electronics: nothing hidden. */
export function productType(value: string): ProductTypeInfo {
  return PRODUCT_TYPES.find((t) => t.key === value) ?? PRODUCT_TYPES[0];
}

/** Whether a menu section shows for this type. A section the menu does not have is never visible. */
export function sectionVisible(type: string, stageKey: string, sectionKey: string): boolean {
  const stage = STAGES.find((s) => s.key === stageKey);
  if (!stage || !stage.sections.some((s) => s.key === sectionKey)) return false;
  return !productType(type).hidden.includes(`${stageKey}/${sectionKey}`);
}

/** The menu's stages, in order, with the sections this type hides removed. Stages themselves always stay. */
export function sectionsFor(type: string): Stage[] {
  return STAGES.map((stage) => ({
    ...stage,
    sections: stage.sections.filter((section) => sectionVisible(type, stage.key, section.key)),
  }));
}
