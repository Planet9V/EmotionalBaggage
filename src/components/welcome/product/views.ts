// The set views of the product viewer: the angle each is seen from, and what each shows open, pulled apart or drawn
// differently. Angles are in radians: `yaw` turns the tag about its strap (0 is the front; a positive turn brings
// its switch edge round to the viewer), `pitch` tips its top toward the viewer.
import type { Open, ViewerMode } from "./scene";

type ViewKey = "front" | "left" | "right" | "back" | "edge" | "top" | "handle" | "coin" | "tracker" | "exploded" | "inside" | "lines";
export type View = { key: ViewKey; yaw: number; pitch: number; mode: ViewerMode; explode: number; open: Open; /** names on the parts */ labels?: boolean; /** a still picture, not the live model */ render?: string };

export const VIEWS: View[] = [
  { key: "front", yaw: 0, pitch: 0, mode: "solid", explode: 0, open: null },
  { key: "left", yaw: 0.62, pitch: 0.1, mode: "solid", explode: 0, open: null },
  { key: "right", yaw: -0.62, pitch: 0.1, mode: "solid", explode: 0, open: null },
  { key: "back", yaw: Math.PI, pitch: 0, mode: "solid", explode: 0, open: null },
  { key: "edge", yaw: Math.PI / 2 - 0.12, pitch: 0.06, mode: "solid", explode: 0, open: null },
  { key: "top", yaw: 0.38, pitch: 0.92, mode: "solid", explode: 0, open: null },
  { key: "handle", yaw: 0, pitch: 0, mode: "solid", explode: 0, open: null, render: "/landing/tag-on-handle.webp" },
  { key: "coin", yaw: 0.5, pitch: 0.12, mode: "solid", explode: 0, open: "coin" },
  { key: "tracker", yaw: Math.PI - 0.5, pitch: 0.12, mode: "solid", explode: 0, open: "tracker" },
  { key: "exploded", yaw: 1.12, pitch: 0.14, mode: "solid", explode: 1, open: null, labels: true },
  { key: "inside", yaw: 0.5, pitch: 0.12, mode: "translucent", explode: 0, open: null },
  { key: "lines", yaw: 0.5, pitch: 0.12, mode: "wireframe", explode: 0, open: null },
];
