import { STAGES, type Column, type Section, type Stage } from "@/lib/menu";

// What kind of product a concept is decides which menu sections it shows (plan 2.7).
// A hidden section is only hidden: its rows stay in the database and the item routes
// still accept them, so changing a concept's type back shows them again.

export type ProductType = "electronics" | "printed" | "physical";

export type ProductTypeInfo = {
  key: ProductType;
  label: string;
  /** Sections this type does not show, as "<stage key>/<section key>" (menu keys, not store keys). */
  hidden: readonly string[];
  /** The columns of the Requirements section for this type: what a requirement of this kind of product states. */
  requirementColumns: readonly Column[];
};

/** Every type states how a requirement is tested (the menu's promise: "each with how it will be tested"). */
const TESTED_BY: Column = { key: "verify", label: "How it is tested" };

export const PRODUCT_TYPES: readonly ProductTypeInfo[] = [
  {
    key: "electronics",
    label: "Electronics in an enclosure",
    hidden: [],
    // The keys the menu has always used, so rows written before product types keep their values.
    requirementColumns: [{ key: "trigger", label: "Input or trigger" }, { key: "response", label: "Response" }, TESTED_BY],
  },
  {
    key: "printed",
    label: "Printed part",
    hidden: ["design/schematic", "prototype/wiring"],
    requirementColumns: [{ key: "load", label: "Load or fit" }, { key: "material", label: "Material" }, TESTED_BY],
  },
  {
    key: "physical",
    label: "Physical product, no electronics",
    hidden: ["design/schematic", "prototype/wiring"],
    requirementColumns: [{ key: "use", label: "Use condition" }, { key: "material", label: "Material or finish" }, TESTED_BY],
  },
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

const REQUIREMENTS = "design/requirements";

/** A section as this type shows it: the Requirements section takes the type's requirement columns. */
function asType(type: string, stageKey: string, section: Section): Section {
  if (`${stageKey}/${section.key}` !== REQUIREMENTS) return section;
  return { ...section, columns: [...productType(type).requirementColumns] };
}


/** The menu's stages, in order, with the sections this type hides removed. Stages themselves always stay. */
export function sectionsFor(type: string): Stage[] {
  return STAGES.map((stage) => ({
    ...stage,
    sections: stage.sections.filter((section) => sectionVisible(type, stage.key, section.key)).map((section) => asType(type, stage.key, section)),
  }));
}

/** One section as this type shows it, or null when the menu has no such section or the type hides it. */
export function sectionFor(type: string, stageKey: string, sectionKey: string): { stage: Stage; section: Section } | null {
  if (!sectionVisible(type, stageKey, sectionKey)) return null;
  const stage = STAGES.find((s) => s.key === stageKey)!;
  return { stage, section: asType(type, stageKey, stage.sections.find((s) => s.key === sectionKey)!) };
}
