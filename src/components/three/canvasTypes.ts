import { type PartGeometry } from "./layout";
import { type Mesh, type ShellParams } from "./stl";
import { type ShowcaseOptions } from "./canvasShowcase";

export type CanvasPart = {
  id: number;
  ref: string;
  title: string;
  geometry: PartGeometry;
  /** scene-space triangles of an attached STL or STEP file, centred on the part's position, in mm; null shows its bounding box */
  shape?: Float32Array | null;
  /** A colour for this part in place of the palette's (the welcome page colours parts by kind). A selected part is still orange. */
  color?: string;
};

export type TransformMode = "off" | "translate" | "rotate";
/** One cutting plane: keeps what is below `pos` on its axis (or above it when flipped). */
export type CutPlane = { axis: "x" | "y" | "z"; on: boolean; pos: number; flip: boolean };
export type Measurement = { a: [number, number, number]; b: [number, number, number]; distance: number } | null;
/** A wire drawn along its routed path. */
export type RoutedDraw = {
  id: number;
  name: string;
  ends: string;
  length: number;
  color: string;
  path: [number, number, number][];
  /** tube radius in mm; bundles are thicker */
  radius: number;
};
export type ShellView = "clear" | "solid";
/**
 * An enclosure drawn to its own outline instead of as a box: the outline of its walls seen from above, in mm about
 * the shell's middle ([x across, z along]), the same outline one wall in, and any openings through the lid.
 */
export type ShellOutline = { outer: readonly (readonly [number, number])[]; inner: readonly (readonly [number, number])[]; lidHoles?: readonly (readonly (readonly [number, number])[])[] };
/** A wire to draw: one line between the centres of two parts. */
export type CanvasWire = {
  id: number;
  /** Hover text: the wire name and what it joins. */
  name: string;
  ends: string;
  color: string;
  a: number;
  b: number;
};

export type ModelCanvasProps = {
  parts: CanvasPart[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** 0 assembled, 1 fully exploded */
  explode: number;
  labels: boolean;
  shellView: ShellView;
  shellParams: ShellParams;
  /** Draws the enclosure to this outline rather than as the box of its size (the welcome page's example). */
  shellOutline?: ShellOutline;
  resetToken: number;
  dark: boolean;
  uploaded: { mesh: Mesh; key: string } | null;
  /** Wires to draw when wiresOn; both ends must be in `parts`. */
  wires: CanvasWire[];
  wiresOn: boolean;
  /** Target opacity per part id while a part is focused (missing id = 1). null = no fade. */
  fade: ReadonlyMap<number, number> | null;
  /** 1 = this part moves with the explode slider, 0 = it stays put (explode by net). null = all move. */
  weights: ReadonlyMap<number, number> | null;
  /** Part ids to frame; null = the whole product. */
  focusIds: number[] | null;
  onFocusPart: (id: number) => void;
  /**
   * Gives the caller a function that draws the scene once and returns it as a PNG data address
   * (transparent background), or null when the canvas goes away. Used by the Imagery screen's
   * "Render from the 3D model" (plan 8.7).
   */
  onCaptureReady?: (capture: (() => string) | null) => void;
  /** Handles on the selected part: none, move or rotate. Only used in the assembled view. */
  transform: TransformMode;
  /** Called when a drag ends, with the new position and rotation (mm, degrees), already snapped to 1 mm and 15 degrees. */
  onTransform: (id: number, change: { pos: [number, number, number]; rotation: [number, number, number] }) => void;
  section: CutPlane[];
  measure: boolean;
  onMeasure: (m: Measurement) => void;
  /** Routed wires; drawn as tubes when assembled. */
  routed: RoutedDraw[];
  /** Presentation extras for the public welcome page: turntable, wireframe, Ctrl + wheel zoom. Not used by the app's own view. */
  showcase?: ShowcaseOptions;
};
