// Shared client/server shapes. Views import from here only.

export type Project = { id: string; name: string; oneLiner: string };

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
  /** "step": a row with a key; "decision": a keyed row in concept/decisions (a zero-minute milestone) */
  kind: "step" | "decision";
  /** full duration as stored (always 0 for a decision) */
  minutes: number;
  /** minutes still to do: 0 once a step's status is closed, otherwise `minutes` */
  remaining: number;
  /** a step with a closed status, or a decision with a chosen option */
  done: boolean;
  /** keys this node waits on as stored and found: a step's `after`, a decision's `dependsOn` */
  after: string[];
  /** earliest start over remaining work, minutes from now */
  start: number;
  finish: number;
  /** parallel wave index (topological generation); -1 when blocked or when the planner is unavailable */
  wave: number;
  critical: boolean;
  /** in a loop, or downstream of one: no order, start or finish */
  blocked: boolean;
};

/** One link of the plan graph and the rule that made it. */
export type PlanEdge = { from: string; to: string; rule: "after" | "dependsOn" | "unlocks" };

/** A link that was left out: it names a key that does not exist, or a node names itself. */
export type PlanDropped = PlanEdge & { reason: "unknown key" | "self" };

export type Plan = {
  /** "unavailable": the planner service did not answer; nodes are listed but no order is given */
  engine: "networkx" | "unavailable";
  nodes: PlanNode[];
  edges: PlanEdge[];
  order: string[];
  criticalPath: string[];
  /** remaining minutes along the critical path */
  totalMinutes: number;
  /** full minutes along the same critical path, done work included */
  plannedMinutes: number;
  cycles: string[][];
  dropped: PlanDropped[];
  /** keys used by more than one row; only the first row is planned */
  duplicates: string[];
  note?: string;
};
