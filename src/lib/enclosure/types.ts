// Shared shapes for the enclosure generators (plan 5.7 to 5.9). No I/O here: the browser and the server both import it.
//
// Two frames are in use and they are never mixed:
//  - the concept frame, as the Physical layout stores it: Y up, millimetres, origin at the centre of the enclosure floor;
//  - the box frame, which the generators use: Z up, right handed, origin at the outer bottom corner of the box,
//    X = concept x, Y = minus concept z, Z = concept y. The box's front (low Y) is the concept's front (high z).

export type Vec3 = [number, number, number];
export type Box = { min: Vec3; max: Vec3 };

/** Faces as a person names them. Concept frame: right +x, left -x, front +z, back -z, top +y, bottom -y. */
export const FACES = ["left", "right", "front", "back", "top", "bottom"] as const;
export type Face = (typeof FACES)[number];

export const GENERATOR_KEYS = ["casemaker", "yapp"] as const;
export type GeneratorKey = (typeof GENERATOR_KEYS)[number];

export const GENERATORS: Record<GeneratorKey, { label: string; licence: string; source: string; sourceFile: string; opensIn: string }> = {
  casemaker: {
    label: "CaseMaker",
    licence: "Apache-2.0",
    source: "https://github.com/SlyWombat/CaseMaker",
    sourceFile: "a CaseMaker project file (.json), which CaseMaker opens with Open project",
    opensIn: "https://electricrv.ca/casemaker",
  },
  yapp: {
    label: "YAPP_Box",
    licence: "MIT",
    source: "https://github.com/mrWheel/YAPP_Box",
    sourceFile: "an OpenSCAD file (.scad) that includes the YAPP generator, which OpenSCAD opens",
    opensIn: "https://openscad.org",
  },
};

export const LID_TYPES = ["slip", "snap", "screw"] as const;
export type LidType = (typeof LID_TYPES)[number];
export const LID_LABELS: Record<LidType, string> = {
  slip: "Slip fit (friction ridge)",
  snap: "Snap fit",
  screw: "Screwed down",
};

/** Screw sizes the generators can be asked for. Millimetres. `pin` is the standoff pin, `boss` the standoff outer diameter. */
export const SCREWS = {
  M2: { clearance: 2.4, pin: 2, pilot: 1.8, boss: 4.4, headRecess: 4 },
  "M2.5": { clearance: 2.9, pin: 2.5, pilot: 2.2, boss: 5.4, headRecess: 5 },
  M3: { clearance: 3.4, pin: 3, pilot: 2.7, boss: 6.4, headRecess: 6 },
} as const;
export type ScrewSize = keyof typeof SCREWS;
export const SCREW_SIZES = Object.keys(SCREWS) as ScrewSize[];

export type EnclosureParams = {
  /** Side wall thickness. */
  wallThickness: number;
  floorThickness: number;
  lidThickness: number;
  cornerRadius: number;
  /** The air kept between every part and the walls and lid, which the checks hold the result to. */
  clearance: number;
  /** Added to each side of an opening that has to let a part through or show it. */
  openingMargin: number;
  lidType: LidType;
  screwSize: ScrewSize;
};

export const DEFAULT_PARAMS: EnclosureParams = {
  wallThickness: 2,
  floorThickness: 2,
  lidThickness: 2,
  cornerRadius: 2,
  clearance: 0.5,
  openingMargin: 0.5,
  lidType: "snap",
  screwSize: "M2",
};

export type ParamRule = { key: keyof EnclosureParams; label: string; unit: string; min: number; max: number; step: number; help: string };

export const NUMERIC_RULES: ParamRule[] = [
  { key: "wallThickness", label: "Wall thickness", unit: "mm", min: 1.2, max: 6, step: 0.1, help: "Three perimeters of a 0.4 mm nozzle is 1.2 mm. 2 mm is a sound default." },
  { key: "floorThickness", label: "Floor thickness", unit: "mm", min: 1.2, max: 6, step: 0.1, help: "Under the parts, and the base of the standoffs." },
  { key: "lidThickness", label: "Lid thickness", unit: "mm", min: 1.2, max: 6, step: 0.1, help: "The flat plate of the lid." },
  { key: "cornerRadius", label: "Corner radius", unit: "mm", min: 0, max: 10, step: 0.5, help: "Outside vertical edges. Must be smaller than half the narrowest side." },
  { key: "clearance", label: "Clearance", unit: "mm", min: 0, max: 5, step: 0.1, help: "Gap kept between a part and the wall or lid. The checks measure the result against it." },
  { key: "openingMargin", label: "Opening margin", unit: "mm", min: 0, max: 3, step: 0.1, help: "Extra on each side of a cut-out so the part moves freely in it." },
];

/** Parts that need an opening when they sit against a wall, from what they are. */
export const OPENING_KINDS = ["speaker", "display", "button", "switch", "led", "connector", "sensor", "microphone"] as const;
export const PART_KINDS = [...OPENING_KINDS, "pcb", "battery", "module", "shell", "other"] as const;
export type PartKind = (typeof PART_KINDS)[number];

export type OpeningShape = "rect" | "circle";

/** What a person can set on a part row (`data.opening`) to override or add an opening. */
export type OpeningOverride = {
  /** true: this part never gets an opening. */
  off?: boolean;
  face?: Face;
  shape?: OpeningShape;
  /** Along the face's first in-plane axis (see FACE_AXES), mm. For a circle, the diameter. */
  width?: number;
  height?: number;
  /** Move the opening from the part's centre, mm along the face's two in-plane axes. */
  shift?: [number, number];
};

export type Hole = { x: number; z: number; diameter: number };

export type SpecPart = {
  id: number;
  ref: string;
  title: string;
  kind: PartKind;
  /** Where the kind came from, so the screen can say so. */
  kindFrom: "row" | "inferred";
  /** Concept frame, all bodies of a counted part included. */
  box: Box;
  shape: "box" | "cylinder" | "shell";
  /**
   * inside: wholly in the cavity. through: crosses a wall. outside: wholly outside the envelope (a strap, say).
   * shell: the existing shell part the envelope is taken from. A part with no box is not in the list at all.
   */
  role: "inside" | "through" | "outside" | "shell";
  /** the reference of the part that holds this one (data.insideOf on the row): their overlap is not a collision */
  insideOf?: string;
};

/** The two in-plane axes of each face, in the concept frame: width runs along the first, height along the second. */
export const FACE_AXES: Record<Face, [axis: 0 | 1 | 2, axis: 0 | 1 | 2]> = {
  left: [2, 1],
  right: [2, 1],
  front: [0, 1],
  back: [0, 1],
  top: [0, 2],
  bottom: [0, 2],
};

export type Opening = {
  partRef: string;
  partId: number;
  face: Face;
  shape: OpeningShape;
  /** Concept frame, on the outer surface of the face. */
  center: Vec3;
  /** Along FACE_AXES[face][0] and [1]. For a circle both are the diameter. */
  width: number;
  height: number;
  source: "kind" | "crossing" | "row";
  /** Why it exists, in a sentence for the screen. */
  reason: string;
};

export type StandoffSpec = {
  /** Concept frame centre of each hole on the PCB's plane. */
  holes: Hole[];
  partRef: string;
  /** Height of the PCB's underside above the inner floor. */
  height: number;
  pcbThickness: number;
  assumed: boolean;
  /** Default holes left out because a part sits over them (the part's reference). */
  dropped: string[];
};

export type EnclosureSpec = {
  /** Concept frame. */
  outer: Box;
  inner: Box;
  /** "shell": taken from the shell part's box. "parts": worked out from the parts, the walls and the clearance. */
  envelope: "shell" | "parts";
  params: EnclosureParams;
  parts: SpecPart[];
  openings: Opening[];
  standoffs: StandoffSpec | null;
  issues: Issue[];
};

export type Issue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  /** The parameter key or part reference the message is about. */
  about?: string;
};

export type GeneratedMesh = { positions: Float32Array; indices: Uint32Array };

/** The generator's answer, meshes in the concept frame, assembled (lid in place on the base). */
export type GeneratorOutput = {
  key: GeneratorKey;
  version: string;
  base: GeneratedMesh;
  lid: GeneratedMesh;
  source: { filename: string; text: string; note: string };
  seconds: number;
  /** Things the generator did not do that the spec asked for. */
  notes: string[];
};

export type CheckResult = { key: string; label: string; ok: boolean; detail: string };
