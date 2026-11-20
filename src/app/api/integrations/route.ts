import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { ready } from "@/lib/db";
import { listIntegrations } from "@/lib/integrations";

export const GET = route(async () => {
  let database: { connected: boolean; vector: boolean; version?: string; error?: string };
  try {
    const { vector } = await ready();
    const { pool } = await import("@/lib/db");
    const v = await pool().query("SHOW server_version");
    database = { connected: true, vector, version: v.rows[0].server_version };
  } catch (e) {
    database = { connected: false, vector: false, error: (e as Error).message };
  }
  let planner: { connected: boolean; networkx?: string; error?: string } = { connected: false, error: "PLANNER_URL is not set" };
  if (process.env.PLANNER_URL) {
    try {
      const r = await fetch(`${process.env.PLANNER_URL.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(2500) });
      const j = (await r.json()) as { networkx?: string };
      planner = { connected: r.ok, networkx: j.networkx };
    } catch (e) {
      planner = { connected: false, error: (e as Error).message };
    }
  }
  return NextResponse.json({ integrations: listIntegrations(), database, planner });
});
