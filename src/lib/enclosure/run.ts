// Runs the chosen generators on a spec and checks what came out. Server only.
import { computeChecks } from "./checks";
import { generateCaseMaker } from "./casemaker";
import { GeneratorUnavailable, generateYapp } from "./yapp";
import { writeBinaryStl, toBase64 } from "./stl";
import type { CheckResult, EnclosureSpec, GeneratedMesh, GeneratorKey } from "./types";

export type GeneratorResult =
  | {
      key: GeneratorKey;
      ok: true;
      version: string;
      seconds: number;
      notes: string[];
      checks: CheckResult[];
      /** Binary STL, base64, in the concept frame with the lid in place on the base. For the preview. */
      baseStl: string;
      lidStl: string;
      /** The lid upside down on the build plate, minimum y at 0. For printing. */
      lidPrintStl: string;
      source: { filename: string; text: string; note: string };
    }
  | { key: GeneratorKey; ok: false; code: GeneratorUnavailable["code"] | "failed"; error: string };

/** The lid turned over (180 degrees about x, a rotation, so winding is kept) and lowered onto y = 0. */
export function lidForPrinting(m: GeneratedMesh): GeneratedMesh {
  const p = new Float32Array(m.positions.length);
  let minY = Infinity;
  for (let i = 0; i < p.length; i += 3) {
    p[i] = m.positions[i];
    p[i + 1] = -m.positions[i + 1];
    p[i + 2] = -m.positions[i + 2];
    if (p[i + 1] < minY) minY = p[i + 1];
  }
  for (let i = 1; i < p.length; i += 3) p[i] -= minY;
  return { positions: p, indices: m.indices };
}

export async function runEnclosureGenerator(key: GeneratorKey, spec: EnclosureSpec, opts: { timeoutSeconds?: number; plannerUrl?: string | null } = {}): Promise<GeneratorResult> {
  try {
    const out = key === "casemaker" ? await generateCaseMaker(spec) : await generateYapp(spec, { timeoutSeconds: opts.timeoutSeconds, url: opts.plannerUrl });
    const checks = await computeChecks(spec, out);
    const notes = [...out.notes];
    const pc = (out as { plannerCheck?: Record<string, { closed: boolean; badEdges: number }> }).plannerCheck;
    if (pc) {
      const open = Object.entries(pc).filter(([, v]) => !v.closed).map(([k]) => k);
      if (open.length) notes.push(`The planner's own edge count found open edges in the ${open.join(" and ")}.`);
    }
    return {
      key,
      ok: true,
      version: out.version,
      seconds: out.seconds,
      notes,
      checks,
      baseStl: toBase64(writeBinaryStl(out.base, "base")),
      lidStl: toBase64(writeBinaryStl(out.lid, "lid")),
      lidPrintStl: toBase64(writeBinaryStl(lidForPrinting(out.lid), "lid")),
      source: out.source,
    };
  } catch (e) {
    if (e instanceof GeneratorUnavailable) return { key, ok: false, code: e.code, error: e.message };
    return { key, ok: false, code: "failed", error: (e as Error).message || "The generator failed." };
  }
}
