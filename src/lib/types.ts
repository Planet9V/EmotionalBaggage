// Shared client/server shapes. Views import from here only.
export type Project = { id: string; name: string; oneLiner: string };

export type Geometry = {
  shape: "box" | "cylinder" | "shell";
  /** box/shell: [x, y, z] mm. cylinder: [diameter, length] mm */
  size: number[];
  pos: number[];
  explode: number[];
  basis: "doc" | "typical";
  count?: number;
  print?: boolean;
  /** cylinder only: which axis its length runs along */
  axis?: "x" | "y" | "z";
};

export type Item = {
  id: number;
  projectId: string;
  section: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: string;
  sort: number;
};

export type FileMeta = {
  id: number;
  name: string;
  mime: string;
  kind: string;
  size: number;
  sha256: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type EventRow = { id: number; kind: string; summary: string; createdAt: string };

export type PlanNode = {
  id: string;
  itemId: number;
  title: string;
  section: string;
  status: string;
  minutes: number;
  after: string[];
  /** earliest start, minutes from zero */
  start: number;
  finish: number;
  /** parallel wave index (topological generation) */
  wave: number;
  critical: boolean;
};

export type Plan = {
  engine: "networkx" | "fallback";
  nodes: PlanNode[];
  order: string[];
  criticalPath: string[];
  totalMinutes: number;
  cycles: string[][];
  note?: string;
};
