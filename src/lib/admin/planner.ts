// Where the planner service is: the address saved in Admin first, then the PLANNER_URL environment variable.
import { getSetting, SETTING } from "@/lib/settings";

export type PlannerAddress = { url: string | null; source: "admin" | "environment" | null };

export async function plannerAddress(): Promise<PlannerAddress> {
  const saved = await getSetting<string | null>(SETTING.plannerUrl, null);
  if (typeof saved === "string" && saved.trim()) return { url: saved.trim().replace(/\/+$/, ""), source: "admin" };
  const env = process.env.PLANNER_URL?.trim();
  if (env) return { url: env.replace(/\/+$/, ""), source: "environment" };
  return { url: null, source: null };
}

/** The planner's base address with no trailing slash, or null when neither Admin nor the environment sets one. */
export async function plannerUrl(): Promise<string | null> {
  return (await plannerAddress()).url;
}

export type PlannerHealth = { connected: boolean; url: string | null; source: PlannerAddress["source"]; networkx?: string; error?: string };

/** One quick read of the planner's /health, for status pages. Never throws. */
export async function plannerHealth(timeoutMs = 2500): Promise<PlannerHealth> {
  const { url, source } = await plannerAddress();
  if (!url) return { connected: false, url, source, error: "No planner address is saved in Admin and PLANNER_URL is not set" };
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; networkx?: string };
    return { connected: r.ok && j.ok !== false, url, source, networkx: j.networkx };
  } catch (e) {
    const err = e as { name?: string; message?: string; cause?: { code?: string } };
    const error = err.name === "TimeoutError" ? `No answer within ${timeoutMs} ms` : err.cause?.code ?? err.message ?? "unreachable";
    return { connected: false, url, source, error };
  }
}
