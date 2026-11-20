import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { ready } from "@/lib/db";
import { listIntegrations } from "@/lib/integrations";
import { plannerHealth } from "@/lib/admin/planner";

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
  // The planner address saved in Admin wins over PLANNER_URL.
  const h = await plannerHealth();
  const planner: { connected: boolean; networkx?: string; error?: string; source: "admin" | "environment" | null } = {
    connected: h.connected,
    source: h.source,
    ...(h.networkx ? { networkx: h.networkx } : {}),
    ...(h.error ? { error: h.error } : {}),
  };
  // Without a database the integrations cannot be read; the page still gets the database and planner state.
  const integrations = database.connected ? await listIntegrations().catch(() => []) : [];
  return NextResponse.json({ integrations, database, planner });
});
