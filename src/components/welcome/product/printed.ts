// The example's enclosure as the app holds it: a design made outside the app's generators and kept as files, with
// the checks its own maker ran. Worked out on the server from the concept's enclosure row (lib/enclosure/authored),
// the printed pieces of the parts list and the print jobs; plain values for the Enclosure and print tab. Pure.
import type { Item } from "@/lib/types";
import { authoredOf } from "@/lib/enclosure/authored";
import { TAG_MM } from "../scenes/film/tagShape";
import type { Product, ProductPart } from "./model";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const PRINTED: ProductPart["look"][] = ["shell", "plate", "trackerDoor", "coinDoor", "strap"];

export type PrintedPiece = { ref: string; title: string; name: string; look: ProductPart["look"]; does: string; grams: number | null; cost: string; size: number[]; /** which print job it is in */ job: number };
type PrintJob = { title: string; status: string; material: string; colours: string[]; estimate: string; file: string; /** the layer height the job sets, in mm */ layerMm: number | null };
export type Printed = {
  name: string;
  size: number[];
  designedBy: string;
  pieces: PrintedPiece[];
  jobs: PrintJob[];
  checks: { label: string; ok: boolean }[];
  checkedBy: string;
  /** the renders the app keeps in Files, as the copies this page serves (public/landing, same name, .webp) */
  renders: { src: string; label: string }[];
};

/** The copies of the design's renders that the welcome page serves: the files named here, as WebP, in public/landing. */
const SERVED = new Set(["BaggageClaims_Tag_RevD_A1_hero.jpg", "BaggageClaims_Tag_RevD_A1_back.jpg", "BaggageClaims_Tag_RevD_A1_on_handle.jpg", "BaggageClaims_Tag_RevD_A_exploded.jpg", "BaggageClaims_Tag_RevD_A_dimensioned.jpg"]);

export function printedOf(row: Item | null, product: Product, printing: Item[]): Printed | null {
  const a = authoredOf(row?.data);
  if (!a) return null;
  const jobs: PrintJob[] = printing.map((j) => ({
    title: j.title,
    status: j.status,
    material: str(j.data.material),
    colours: Array.isArray(j.data.colours) ? j.data.colours.map(String) : [],
    estimate: str(j.data.estimate),
    file: str(j.data.fileName),
    layerMm: typeof j.data.layerHeight === "number" && j.data.layerHeight > 0 ? j.data.layerHeight : null,
  }));
  // a piece is in the job that names it, else in the job of the material its own title names
  const jobOf = (p: ProductPart) => {
    const named = printing.findIndex((j) => str(j.data.part) === p.ref);
    if (named >= 0) return named;
    const byMaterial = jobs.findIndex((j) => j.material && p.title.includes(j.material));
    return Math.max(0, byMaterial);
  };
  return {
    name: a.name,
    size: a.size ?? [],
    designedBy: a.designedBy ?? "",
    pieces: product.parts
      .filter((p) => PRINTED.includes(p.look) && p.body)
      .map((p) => ({ ref: p.ref, title: p.title, name: p.name, look: p.look, does: p.does, grams: p.grams, cost: p.cost, size: p.body!.size, job: jobOf(p) })),
    jobs,
    checks: a.checks,
    checkedBy: a.checkedBy,
    renders: a.renders.filter((r) => SERVED.has(r.file)).map((r) => ({ src: `/landing/${r.file.replace(/\.jpe?g$/, ".webp")}`, label: r.label })),
  };
}

const { w: W, h: H } = TAG_MM;
/** A filament's colour in a drawing, by the colour its name says. */
export const filamentColour = (name: string) => (/brown|saddle|tan/i.test(name) ? "#a8683a" : /cream|ivory|white/i.test(name) ? "#f1e4c3" : /black/i.test(name) ? "#1d1f23" : "#8a9099");

/** Where each piece lies on its plate, in mm: the body, the back plate beside it, the two doors in a column; the strap on a plate of its own. */
export const PLATE_GAP = 6;
export function plateLayout(pieces: PrintedPiece[]) {
  const at = new Map<string, { x: number; y: number }>();
  const body = pieces.find((p) => p.look === "shell");
  const plate = pieces.find((p) => p.look === "plate");
  const doors = pieces.filter((p) => p.look === "trackerDoor" || p.look === "coinDoor");
  const strap = pieces.find((p) => p.look === "strap");
  let x = 0;
  if (body) {
    at.set(body.ref, { x: W / 2, y: H / 2 });
    x = W + PLATE_GAP;
  }
  if (plate) {
    at.set(plate.ref, { x: x + plate.size[0]! / 2, y: plate.size[1]! / 2 });
    x += plate.size[0]! + PLATE_GAP;
  }
  let y = 0;
  let wide = 0;
  for (const d of doors) {
    at.set(d.ref, { x: x + d.size[0]! / 2, y: y + d.size[0]! / 2 });
    y += d.size[0]! + PLATE_GAP;
    wide = Math.max(wide, d.size[0]!);
  }
  const first = { x0: -PLATE_GAP, x1: x + wide + PLATE_GAP };
  // (wide enough for its own heading)
  const second = strap ? { x0: first.x1 + PLATE_GAP * 2, x1: first.x1 + PLATE_GAP * 2 + Math.max(36, strap.size[0]! + PLATE_GAP * 2) } : null;
  if (strap && second) at.set(strap.ref, { x: (second.x0 + second.x1) / 2, y: strap.size[1]! / 2 });
  return { at, first, second };
}

