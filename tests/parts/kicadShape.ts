// A structural comparison of .kicad_sch files, for checking our export against a file KiCad 10 wrote.
//
// From a reference file it learns, for every node path (the chain of list heads, such as
// kicad_sch/lib_symbols/symbol/property/effects/font/size):
//   - which child list kinds occur under it,
//   - in which order child kinds occur (every "a comes before b" pair seen in one node),
//   - the form of each leading atom by position: a quoted string, a number, or a bare keyword.
// `compareShape` then reports every place where another file uses a node path, a child kind, an
// order or an atom form the reference never shows. A supplement adds what the reference file does
// not happen to contain but KiCad's parser accepts; each supplement entry cites the parser source.
import { parse, type SNode } from "@/lib/parts/sexpr";

export type AtomForm = "string" | "number" | `keyword:${string}`;
type NodeShape = { children: Set<string>; before: Set<string>; atoms: Map<number, Set<AtomForm>>; unordered: Set<string> };
export type ShapeModel = Map<string, NodeShape>;

// KiCad's lexer (common/dsnlexer.cpp, isNumber) reads a bare token as a number when it has this form.
const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

export function atomForm(a: SNode): AtomForm {
  if (typeof a === "string") return NUMBER.test(a) ? "number" : `keyword:${a}`;
  if (!Array.isArray(a)) return "string";
  throw new Error("not an atom");
}

const shapeOf = (m: ShapeModel, path: string): NodeShape => {
  let s = m.get(path);
  if (!s) m.set(path, (s = { children: new Set(), before: new Set(), atoms: new Map(), unordered: new Set() }));
  return s;
};

function learn(m: ShapeModel, n: SNode[], parent: string) {
  const head = typeof n[0] === "string" ? n[0] : "?";
  const path = parent ? `${parent}/${head}` : head;
  const s = shapeOf(m, path);
  let pos = 0;
  const kinds: string[] = [];
  for (const c of n.slice(1)) {
    if (Array.isArray(c)) {
      const k = typeof c[0] === "string" ? c[0] : "?";
      s.children.add(k);
      kinds.push(k);
      learn(m, c, path);
    } else {
      const forms = s.atoms.get(pos) ?? new Set<AtomForm>();
      forms.add(atomForm(c));
      s.atoms.set(pos++, forms);
    }
  }
  for (let i = 0; i < kinds.length; i++) for (let j = i + 1; j < kinds.length; j++) if (kinds[i] !== kinds[j]) s.before.add(`${kinds[i]}<${kinds[j]}`);
}

/** The shape model of one or more .kicad_sch texts. */
export function shapeModel(...texts: string[]): ShapeModel {
  const m: ShapeModel = new Map();
  for (const t of texts) learn(m, parse(t) as SNode[], "");
  return m;
}

/** A supplement entry: a node path and what the parser accepts there beyond the reference file. */
export type Supplement = {
  path: string;
  children?: string[];
  atoms?: Record<number, AtomForm[]>;
  /** child kinds KiCad writes in an order that is not by kind (its writer sorts them by content) */
  unordered?: string[];
  cite: string;
};

export function supplement(m: ShapeModel, entries: Supplement[]): ShapeModel {
  for (const e of entries) {
    const s = shapeOf(m, e.path);
    for (const c of e.children ?? []) s.children.add(c);
    for (const c of e.unordered ?? []) s.unordered.add(c);
    for (const [pos, forms] of Object.entries(e.atoms ?? {})) {
      const set = s.atoms.get(Number(pos)) ?? new Set<AtomForm>();
      for (const f of forms) set.add(f);
      s.atoms.set(Number(pos), set);
    }
  }
  return m;
}

/** Every difference between a file and the reference model, as readable lines; empty when none. */
export function compareShape(model: ShapeModel, text: string): string[] {
  const problems = new Set<string>();
  const walk = (n: SNode[], parent: string) => {
    const head = typeof n[0] === "string" ? n[0] : "?";
    const path = parent ? `${parent}/${head}` : head;
    const ref = model.get(path);
    if (!ref) {
      problems.add(`${path}: KiCad's file has no node at this path`);
      return;
    }
    let pos = 0;
    const kinds: string[] = [];
    for (const c of n.slice(1)) {
      if (Array.isArray(c)) {
        const k = typeof c[0] === "string" ? c[0] : "?";
        if (!ref.children.has(k)) problems.add(`${path}: child (${k}) never appears here in KiCad's file`);
        kinds.push(k);
        walk(c, path);
        continue;
      }
      const form = atomForm(c);
      const allowed = ref.atoms.get(pos);
      if (!allowed) problems.add(`${path}: atom ${pos} (${form}) has no counterpart in KiCad's file`);
      else if (!allowed.has(form)) problems.add(`${path}: atom ${pos} is ${form}; KiCad's file has ${[...allowed].join(", ")}`);
      if (form === "number" && !/^-?\d+(\.\d+)?$/.test(c as string)) problems.add(`${path}: number ${String(c)} is not plain decimal`);
      pos++;
    }
    for (let i = 0; i < kinds.length; i++)
      for (let j = i + 1; j < kinds.length; j++)
        if (kinds[i] !== kinds[j] && !(ref.unordered.has(kinds[i]) && ref.unordered.has(kinds[j])) && ref.before.has(`${kinds[j]}<${kinds[i]}`) && !ref.before.has(`${kinds[i]}<${kinds[j]}`))
          problems.add(`${path}: (${kinds[i]}) comes before (${kinds[j]}); KiCad writes (${kinds[j]}) first`);
  };
  walk(parse(text) as SNode[], "");
  return [...problems].sort();
}
