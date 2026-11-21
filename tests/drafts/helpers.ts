// Shared helpers for the drafting tests: a scripted reasoning model (the OpenAI-compatible stand-in
// answering with a JSON object chosen by which generator is asking), and short route callers.
import { q } from "@/lib/db";
import { start, type OpenAIOptions } from "../standins/openai";
import type { StandIn } from "../standins/core";
import { ctx, json, read } from "../api/helpers";
import { POST as RUN } from "@/app/api/drafts/run/route";
import { GET as LIST } from "@/app/api/drafts/route";
import { POST as APPROVE } from "@/app/api/drafts/[id]/approve/route";
import { POST as REJECT } from "@/app/api/drafts/[id]/reject/route";
import { PATCH as EDIT } from "@/app/api/drafts/[id]/route";
import { POST as APPROVE_RUN } from "@/app/api/drafts/approve-run/route";
import type { Draft, RunResult } from "@/lib/ai/drafts/shared";

/** Words in each generator's instructions, to tell which one is asking. */
export const MARKERS: Record<string, string> = {
  "press-release": "press release a company would publish",
  faq: "frequently asked questions",
  requirements: "requirements an engineer can design",
  parts: "candidate parts list",
  wiring: "propose the wires",
  assembly: "assembly of a first prototype",
  tests: "acceptance tests a prototype must pass",
  "optimise-cost": "cheaper substitutes",
  "optimise-parts": "design-for-assembly check",
  "optimise-print": "3D print jobs",
  reviewer: "You review product concepts",
};

export type Script = Record<string, unknown>;

/** The stand-in model, answering each generator with script[generator] (as JSON) and the reviewer with text. */
export async function scriptedModel(script: Script): Promise<StandIn<OpenAIOptions>> {
  return start({
    prefix: "/v1",
    reply: (messages) => {
      const system = messages.find((m) => m.role === "system");
      const text = typeof system?.content === "string" ? system.content : JSON.stringify(system?.content ?? "");
      for (const [id, marker] of Object.entries(MARKERS)) {
        if (text.includes(marker)) {
          const v = script[id];
          if (v === undefined) return id === "reviewer" ? "Who pays, and why would they switch?" : JSON.stringify({ rows: [] });
          return typeof v === "string" ? v : JSON.stringify(v);
        }
      }
      return JSON.stringify({ rows: [] });
    },
  });
}

/** Which generator a recorded request came from. */
export function askedBy(body: unknown): string {
  const msgs = (body as { messages?: { role: string; content: unknown }[] })?.messages ?? [];
  const sys = String(msgs.find((m) => m.role === "system")?.content ?? "");
  return Object.entries(MARKERS).find(([, m]) => sys.includes(m))?.[0] ?? "unknown";
}

export async function makeConcept(id: string, name: string, productType = "electronics", oneLiner = "") {
  await q("DELETE FROM projects WHERE id=$1", [id]);
  await q("INSERT INTO projects (id, name, one_liner, product_type) VALUES ($1,$2,$3,$4)", [id, name, oneLiner, productType]);
}

export async function addItem(projectId: string, section: string, title: string, data: Record<string, unknown> = {}, body = "", status = "open") {
  const r = await q<{ id: string }>("INSERT INTO items (project_id, section, title, body, data, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [
    projectId,
    section,
    title,
    body,
    JSON.stringify(data),
    status,
  ]);
  return Number(r[0].id);
}

export const run = async (payload: Record<string, unknown>) => read<RunResult & { error?: string; detail?: { pending: number } }>(await RUN(json("POST", payload)));
export const list = async (projectId: string, extra = "") => read<{ drafts: Draft[]; pending: Record<string, number>; error?: string }>(await LIST(json("GET", undefined, `http://t/api/drafts?projectId=${projectId}${extra}`)));
export const approve = async (id: number) => read<{ draft: Draft; item: { id: number; title: string; data: Record<string, unknown>; section: string } | null; error?: string }>(await APPROVE(json("POST"), ctx(String(id))));
export const reject = async (id: number, reason?: string) => read<{ draft: Draft; error?: string }>(await REJECT(json("POST", reason === undefined ? undefined : { reason }), ctx(String(id))));
export const edit = async (id: number, change: Record<string, unknown>) => read<{ draft: Draft; error?: string }>(await EDIT(json("PATCH", change), ctx(String(id))));
export const approveRun = async (projectId: string, runId: string, confirm: unknown = true) => read<{ approved: unknown[]; error?: string }>(await APPROVE_RUN(json("POST", { projectId, runId, confirm })));

export const itemsOf = (projectId: string, section: string) =>
  q<{ id: string; title: string; body: string; data: Record<string, unknown>; status: string }>("SELECT id, title, body, data, status FROM items WHERE project_id=$1 AND section=$2 ORDER BY id", [projectId, section]);
