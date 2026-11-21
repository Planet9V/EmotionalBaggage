// Runs the chosen generators on a spec and checks what came out. Server only.
import { computeChecks } from "./checks";
import { generateCaseMaker } from "./casemaker";
import { GeneratorUnavailable, generateYapp } from "./yapp";
import { writeBinaryStl, toBase64 } from "./stl";
import { basePrintMesh, lidPrintMesh } from "./printFiles";
import type { CheckResult, EnclosureSpec, GeneratorKey } from "./types";

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
      /** The base and the lid as they print: Z up, on z = 0, the lid turned over (printFiles.ts). For the downloads. */
      basePrintStl: string;
      lidPrintStl: string;
      source: { filename: string; text: string; note: string };
    }
  | { key: GeneratorKey; ok: false; code: GeneratorUnavailable["code"] | "failed"; error: string };

export async function runGenerator(key: GeneratorKey, spec: EnclosureSpec, opts: { timeoutSeconds?: number; plannerUrl?: string | null } = {}): Promise<GeneratorResult> {
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
      basePrintStl: toBase64(writeBinaryStl(basePrintMesh(out.base), "base")),
      lidPrintStl: toBase64(writeBinaryStl(lidPrintMesh(out.lid), "lid")),
      source: out.source,
    };
  } catch (e) {
    if (e instanceof GeneratorUnavailable) return { key, ok: false, code: e.code, error: e.message };
    return { key, ok: false, code: "failed", error: (e as Error).message || "The generator failed." };
  }
}
