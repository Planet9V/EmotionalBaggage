// Generator 2 (plan 5.8): YAPP_Box, run by OpenSCAD inside the planner service (POST /enclosure/yapp).
import { plannerUrl } from "@/lib/admin/planner";
import { frameOf, meshToConcept, toBoxSpec } from "./boxspec";
import { parseStl } from "./stl";
import type { EnclosureSpec, GeneratorOutput } from "./types";

/** Why YAPP_Box could not run, in words for the screen. `code` lets a caller treat "not running" differently from "refused". */
export class GeneratorUnavailable extends Error {
  constructor(public code: "not-configured" | "unreachable" | "no-openscad" | "timeout" | "refused", message: string) {
    super(message);
  }
}

type PlannerAnswer = {
  version: string;
  base_stl: string;
  lid_stl: string;
  scad: string;
  seconds: number;
  notes: string[];
  planner_check: Record<string, { closed: boolean; badEdges: number; triangles: number }>;
};

const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

export async function generateYapp(spec: EnclosureSpec, opts: { timeoutSeconds?: number; url?: string | null } = {}): Promise<GeneratorOutput & { plannerCheck: PlannerAnswer["planner_check"] }> {
  const url = opts.url === undefined ? await plannerUrl() : opts.url;
  if (!url) throw new GeneratorUnavailable("not-configured", "YAPP_Box runs in the planner service, and no planner address is set. Set it in Admin or in PLANNER_URL.");
  const limit = opts.timeoutSeconds ?? 120;
  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/enclosure/yapp?timeout=${limit}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toBoxSpec(spec)),
      signal: AbortSignal.timeout((limit + 15) * 1000),
    });
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err.name === "TimeoutError") throw new GeneratorUnavailable("timeout", `The planner did not answer within ${limit + 15} seconds.`);
    throw new GeneratorUnavailable("unreachable", `The planner service is not reachable (${err.message ?? "no answer"}), so YAPP_Box cannot run.`);
  }
  if (!res.ok) {
    const detail = ((await res.json().catch(() => ({}))) as { detail?: unknown }).detail;
    const msg = typeof detail === "string" ? detail : `The planner answered ${res.status}.`;
    if (res.status === 503) throw new GeneratorUnavailable("no-openscad", msg);
    if (res.status === 504) throw new GeneratorUnavailable("timeout", msg);
    throw new GeneratorUnavailable("refused", msg);
  }
  const a = (await res.json()) as PlannerAnswer;
  const frame = frameOf(spec);
  return {
    key: "yapp",
    version: a.version,
    base: meshToConcept(parseStl(bytes(a.base_stl)), frame),
    lid: meshToConcept(parseStl(bytes(a.lid_stl)), frame),
    source: { filename: "enclosure.scad", text: a.scad, note: "Put YAPPgenerator_v3.scad from the YAPP_Box repository beside it, open it in OpenSCAD and render." },
    seconds: a.seconds,
    notes: a.notes,
    plannerCheck: a.planner_check,
  };
}
