// Generator 1 (plan 5.7): CaseMaker, forked into vendor/casemaker and run here, in the Node process, on Manifold.
// The spec is turned into a CaseMaker project file; CaseMaker's own compiler builds the shell and lid.
import { compileProject, cube, cylinder, defaultSnapCatchesForCase, difference, executeOp, rotate, translate } from "../../../vendor/casemaker/dist/engine.mjs";
import { frameOf, meshToConcept, toBoxSpec, type BoxSpec } from "./boxspec";
import { fromManifold, getKernel } from "./kernel";
import type { EnclosureSpec, GeneratorOutput } from "./types";

export const CASEMAKER_COMMIT = "8988792b627dd646e5acd02017a871aee1d0616c";
const JOINT = { slip: "flat-lid", snap: "snap-fit", screw: "screw-down" } as const;

/** The CaseMaker project for a box spec. Exported so the source file the user downloads is exactly what was built. */
export function caseMakerProject(b: BoxSpec, name: string) {
  const now = new Date(0).toISOString();
  const inset = b.wall; // internalClearance is 0: the board is the cavity floor plan
  const cavityX = b.outer[0] - 2 * b.wall;
  const cavityY = b.outer[1] - 2 * b.wall;
  const cavityZ = b.outer[2] - b.floor - b.lid;
  const standoff = b.standoffs?.height ?? 0;
  const pcbZ = b.standoffs?.pcbThickness ?? 1.6;
  const holes = (b.standoffs?.holes ?? []).map((h, i) => ({ id: `h${i + 1}`, x: h.x - inset, y: h.y - inset, diameter: h.diameter }));
  return {
    schemaVersion: 16,
    id: "c2r-enclosure",
    name,
    createdAt: now,
    modifiedAt: now,
    board: {
      id: "c2r-cavity",
      name: "Concept cavity",
      manufacturer: "Shipwright",
      pcb: { size: { x: cavityX, y: cavityY, z: pcbZ } },
      mountingHoles: holes,
      components: [],
      defaultStandoffHeight: standoff,
      recommendedZClearance: cavityZ - standoff - pcbZ,
      builtin: false,
    },
    case: {
      wallThickness: b.wall,
      floorThickness: b.floor,
      lidThickness: b.lid,
      cornerRadius: b.cornerRadius,
      internalClearance: 0,
      zClearance: cavityZ - standoff - pcbZ,
      joint: JOINT[b.lidType],
      ventilation: { enabled: false, pattern: "none", coverage: 0 },
      bosses: { enabled: holes.length > 0, insertType: "self-tap", outerDiameter: b.screw.boss, holeDiameter: b.screw.pilot },
    },
    ports: [],
    externalAssets: [],
    hats: [],
    customHats: [],
    mountingFeatures: [],
    display: null,
    customDisplays: [],
    fanMounts: [],
    textLabels: [],
    antennas: [],
    customFonts: [],
  };
}

/**
 * Cutters for the spec's openings, built with CaseMaker's own operations. CaseMaker's "custom cutout" feature is not used: at the
 * pinned commit its rectangular and round cutters reach only about 1 mm into a wall (they start 1 mm inside the face and run
 * wall + 2 mm onward), so a 2 mm wall keeps its outer or inner millimetre. Found on the example; see the report.
 */
export function openingCutters(b: BoxSpec): unknown[] {
  const OVER = 1;
  return b.openings.map((o) => {
    const [cx, cy, cz] = o.center;
    const thick = o.face === "top" ? b.lid : o.face === "bottom" ? b.floor : b.wall;
    const len = thick + 2 * OVER;
    const w = o.width, h = o.height;
    // Start of the cutter along the face normal, so it begins OVER outside the face and runs through the wall.
    switch (o.face) {
      case "left":
      case "right": {
        const x0 = o.face === "left" ? cx - OVER : cx - thick - OVER;
        return o.shape === "circle"
          ? translate([x0, cy, cz], rotate([0, 90, 0], cylinder(len, w / 2, 48)))
          : translate([x0, cy - w / 2, cz - h / 2], cube([len, w, h]));
      }
      case "front":
      case "back": {
        const y0 = o.face === "front" ? cy - OVER : cy - thick - OVER;
        return o.shape === "circle"
          ? translate([cx, y0, cz], rotate([-90, 0, 0], cylinder(len, w / 2, 48)))
          : translate([cx - w / 2, y0, cz - h / 2], cube([w, len, h]));
      }
      default: {
        const z0 = o.face === "bottom" ? cz - OVER : cz - thick - OVER;
        return o.shape === "circle"
          ? translate([cx, cy, z0], cylinder(len, w / 2, 48))
          : translate([cx - w / 2, cy - h / 2, z0], cube([w, h, len]));
      }
    }
  });
}

/** Where a part stands in the way of a snap arm: CaseMaker places its catches clear of "components" facing a wall, so each part near a wall is given as one. */
function blockers(b: BoxSpec) {
  const reach = 4.5; // an arm and its barb stand about this far in from the wall
  const band = 10; // and hang about this far down from the lid
  const out: unknown[] = [];
  const inner = { x: b.outer[0] - b.wall, y: b.outer[1] - b.wall, z: b.outer[2] - b.lid };
  let n = 0;
  for (const p of b.parts) {
    if (p.max[2] < inner.z - band) continue;
    const walls: [string, boolean][] = [
      ["-x", p.min[0] - b.wall < reach],
      ["+x", inner.x - p.max[0] < reach],
      ["-y", p.min[1] - b.wall < reach],
      ["+y", inner.y - p.max[1] < reach],
    ];
    for (const [facing, near] of walls) {
      if (!near) continue;
      out.push({ id: `keep-${n++}`, kind: "custom", position: { x: p.min[0] - b.wall - 1, y: p.min[1] - b.wall - 1, z: 0 }, size: { x: p.max[0] - p.min[0] + 2, y: p.max[1] - p.min[1] + 2, z: 0.1 }, facing });
    }
  }
  return out;
}

export async function generateCaseMaker(spec: EnclosureSpec, name = "Enclosure"): Promise<GeneratorOutput> {
  const t0 = Date.now();
  const box = toBoxSpec(spec);
  const project = caseMakerProject(box, name);
  let snapCount = -1;
  if (box.lidType === "snap") {
    project.board.components = blockers(box) as never[];
    const catches = defaultSnapCatchesForCase(project.board, project.case);
    (project.case as Record<string, unknown>).snapCatches = catches;
    project.board.components = [];
    snapCount = catches.length;
  }
  const plan = compileProject(project);
  const cutters = openingCutters(box);
  if (cutters.length) for (const node of plan.nodes) node.op = difference([node.op, ...cutters]);
  const tl = await getKernel();
  const frame = frameOf(spec);
  const meshes: Record<string, ReturnType<typeof fromManifold>> = {};
  for (const node of plan.nodes) {
    const m = await executeOp(tl, node.op);
    try {
      meshes[node.id] = fromManifold(m);
    } finally {
      m.delete();
    }
  }
  const notes: string[] = [];
  if (!meshes.shell || !meshes.lid) throw new Error(`CaseMaker returned ${Object.keys(meshes).join(", ") || "nothing"}, not a shell and a lid.`);
  const extra = Object.keys(meshes).filter((k) => k !== "shell" && k !== "lid");
  if (extra.length) notes.push(`CaseMaker also built ${extra.join(", ")}; those parts are not shown or checked here.`);
  if (snapCount === 0) notes.push("No snap catch could be placed clear of the parts, so the lid has no retention. Use a screwed lid, or move a part away from a wall.");
  else if (snapCount > 0) notes.push(`${snapCount} snap ${snapCount === 1 ? "catch" : "catches"} placed by CaseMaker, clear of the parts.`);
  if (spec.params.lidType === "slip") notes.push("Slip fit is CaseMaker's flat lid: it sits on the rim and is held by the user's glue or tape, with no ridge.");
  return {
    key: "casemaker",
    version: `CaseMaker commit ${CASEMAKER_COMMIT.slice(0, 9)}`,
    base: meshToConcept(meshes.shell, frame),
    lid: meshToConcept(meshes.lid, frame),
    source: { filename: "enclosure.casemaker.json", text: JSON.stringify(project, null, 2), note: "Open it in CaseMaker with Open project." },
    seconds: (Date.now() - t0) / 1000,
    notes,
  };
}
