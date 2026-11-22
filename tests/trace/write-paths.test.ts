// Integration item 12: every route that writes records what it changed. The trace feature's history
// tests check paths one by one; this walks every route file on disk, so a write path added later (by
// any feature) fails here until it is listed with where it records the change. Each recording call in
// the files listed as "self" must carry before and after (or one of the trace helpers that build them).
// The behavioural checks below call the paths the twelve features added and read the event back.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as override } from "@/app/api/projects/[id]/gates/route";
import { POST as moveStage } from "@/app/api/projects/[id]/stage/route";
import { POST as launch } from "@/app/api/projects/[id]/campaigns/launch/route";
import { POST as saveResults, DELETE as removeResults } from "@/app/api/projects/[id]/campaigns/results/route";
import { POST as makeLink } from "@/app/api/projects/[id]/campaigns/links/route";
import { PATCH as toggleLink, DELETE as deleteLink } from "@/app/api/projects/[id]/campaigns/links/[linkId]/route";
import { PUT as saveMapping } from "@/app/api/projects/[id]/campaigns/csv-mapping/route";
import { ctx, json, read } from "../api/helpers";
import { drop, events, newConcept } from "./helpers";

/** Tracked links may only go to hosts on the concept's list (kept on its marketing plan row). */
async function allowLinkHost(projectId: string, host: string) {
  const data = JSON.stringify({ linkHosts: [host] });
  const u = await q<{ id: number }>("UPDATE items SET data = data || $2::jsonb WHERE project_id=$1 AND section='marketing/campaigns' AND data->>'kind'='plan' RETURNING id", [projectId, data]);
  if (!u.length) await q("INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,'marketing/campaigns','Marketing plan','',$2::jsonb || '{\"kind\":\"plan\"}'::jsonb,'planned',99999)", [projectId, data]);
}


const ROOT = join(process.cwd(), "src/app/api");
const WRITES = /export const (POST|PUT|PATCH|DELETE)\b/;
const RECORDS = /\b(logEvent|logEventIn|audit|auditIn)\(/;

/**
 * Where each writing route records its change. "self": in the route file. A path: the library code the
 * route hands the write to. "none: ...": the route writes nothing a person changed, and why.
 */
const WRITE_PATHS: Record<string, string> = {
  "access-requests/route.ts": "src/lib/accessRequests/store.ts",
  "admin/access-requests/[id]/route.ts": "src/lib/accessRequests/store.ts",
  // the new sign-in (AUTH2): account events go to the audit log from its hooks
  "auth2/[...all]/route.ts": "src/lib/auth2/auth.ts",
  "admin/credentials/[provider]/[field]/route.ts": "src/lib/admin/credentials.ts",
  "admin/credentials/[provider]/route.ts": "src/lib/admin/credentials.ts",
  "admin/printers/[id]/route.ts": "self",
  "admin/printers/route.ts": "self",
  "admin/plans/route.ts": "src/lib/admin/plans.ts",
  "admin/settings/route.ts": "src/lib/admin/settings.ts",
  "admin/test/route.ts": "src/lib/admin/connection.ts",
  "auth/password/route.ts": "self",
  "auth/sign-in/route.ts": "self",
  "auth/sign-out-everywhere/route.ts": "self",
  "auth/sign-out/route.ts": "none: ending a session changes no concept or setting; sign-in and refused sign-ins are recorded",
  "challenge/route.ts": "self",
  "channels/amazon/route.ts": "self",
  "channels/amazon/sync/route.ts": "src/lib/channels/amazonSync.ts",
  "channels/inbox/fetch/route.ts": "src/lib/channels/inbox.ts",
  "channels/instagram/image/route.ts": "self",
  "channels/instagram/review/route.ts": "self",
  "channels/reviews/import/route.ts": "src/lib/channels/reviews.ts",
  "channels/reviews/requirement/route.ts": "src/lib/channels/reviews.ts",
  "channels/send/resolve/route.ts": "src/lib/channels/send.ts",
  "channels/send/route.ts": "src/lib/channels/send.ts",
  "channels/x/ack/route.ts": "src/lib/channels/inbox.ts",
  "channels/x/connect/route.ts": "self",
  "chats/[id]/messages/route.ts": "self",
  "chats/[id]/route.ts": "self",
  "drafts/[id]/approve/route.ts": "src/lib/ai/drafts/store.ts",
  "drafts/[id]/reject/route.ts": "src/lib/ai/drafts/store.ts",
  "drafts/[id]/route.ts": "src/lib/ai/drafts/store.ts",
  "drafts/approve-run/route.ts": "src/lib/ai/drafts/store.ts",
  "drafts/attack/route.ts": "src/lib/ai/drafts/attack.ts",
  "drafts/impact/propose/route.ts": "src/lib/ai/drafts/run.ts",
  "drafts/impact/route.ts": "none: works out what a change affects and saves nothing",
  "drafts/optimise/route.ts": "src/lib/ai/drafts/run.ts",
  "drafts/run/route.ts": "src/lib/ai/drafts/run.ts",
  "files/[id]/route.ts": "self",
  "index/route.ts": "none: stores search vectors worked out from rows; no row or setting changes",
  "items/[id]/pins/route.ts": "self",
  "items/[id]/reason/route.ts": "src/lib/trace/reason.ts",
  "items/[id]/route.ts": "self",
  "print-jobs/[id]/attach/route.ts": "src/lib/slicing/flow.ts",
  "print-jobs/[id]/control/route.ts": "src/lib/slicing/flow.ts",
  "print-jobs/[id]/result/route.ts": "src/lib/slicing/flow.ts",
  "print-jobs/[id]/send/route.ts": "src/lib/slicing/flow.ts",
  "print-jobs/[id]/slice/route.ts": "src/lib/slicing/flow.ts",
  "print-jobs/[id]/start/route.ts": "src/lib/slicing/flow.ts",
  "printers/[id]/actions/route.ts": "src/lib/printers/actions.ts",
  "printers/[id]/upload/route.ts": "src/lib/printers/actions.ts",
  "projects/[id]/archive/route.ts": "self",
  "projects/[id]/campaigns/csv-mapping/route.ts": "self",
  "projects/[id]/campaigns/explain/route.ts": "none: a model explains a verdict; nothing is saved",
  "projects/[id]/campaigns/launch/route.ts": "self",
  "projects/[id]/campaigns/links/[linkId]/route.ts": "self",
  "projects/[id]/campaigns/links/route.ts": "self",
  "projects/[id]/campaigns/results/route.ts": "self",
  "projects/[id]/chats/route.ts": "self",
  "projects/[id]/compliance/draft/route.ts": "src/lib/ai/drafts/run.ts",
  "projects/[id]/duplicate/route.ts": "self",
  "projects/[id]/enclosure/generate/route.ts": "self",
  "projects/[id]/enclosure/print/route.ts": "self",
  "projects/[id]/files/route.ts": "self",
  "projects/[id]/gates/route.ts": "self",
  "projects/[id]/harness/route.ts": "none: the planner draws the harness; nothing is saved",
  "projects/[id]/items/route.ts": "self",
  "projects/[id]/market/critique/route.ts": "self",
  "projects/[id]/market/generate/route.ts": "src/lib/ai/drafts/run.ts",
  "projects/[id]/production-settings/route.ts": "self",
  "projects/[id]/restore/route.ts": "self",
  "projects/[id]/sources/[sourceId]/reindex/route.ts": "src/lib/sources/store.ts",
  "projects/[id]/sources/[sourceId]/route.ts": "src/lib/sources/store.ts",
  "projects/[id]/sources/[sourceId]/version/route.ts": "src/lib/sources/store.ts",
  "projects/[id]/sources/route.ts": "src/lib/sources/store.ts",
  "projects/[id]/route-wires/route.ts": "self",
  "projects/[id]/route.ts": "self",
  "projects/[id]/sourcing/research/route.ts": "src/lib/sourcing/research.ts",
  "projects/[id]/stage/route.ts": "self",
  "projects/route.ts": "self",
  "research/evidence/route.ts": "self",
  "research/route.ts": "self",
};

/** Write paths the twelve features added (or the integration changed): each recording call must carry before and after. */
const BEFORE_AFTER = new Set([
  "items/[id]/pins/route.ts",
  "projects/[id]/campaigns/csv-mapping/route.ts",
  "projects/[id]/campaigns/launch/route.ts",
  "projects/[id]/campaigns/links/[linkId]/route.ts",
  "projects/[id]/campaigns/links/route.ts",
  "projects/[id]/campaigns/results/route.ts",
  "projects/[id]/duplicate/route.ts",
  "projects/[id]/enclosure/generate/route.ts",
  "projects/[id]/enclosure/print/route.ts",
  "projects/[id]/gates/route.ts",
  "projects/[id]/market/critique/route.ts",
  "projects/[id]/production-settings/route.ts",
  "projects/[id]/route-wires/route.ts",
  "projects/[id]/stage/route.ts",
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? routeFiles(p) : n === "route.ts" ? [p] : [];
  });
}

/** The text of each `logEventIn(` / `logEvent(` call, found by matching its brackets. */
function recordingCalls(src: string): string[] {
  const out: string[] = [];
  const re = /\blogEvent(In)?\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

describe("every route that writes records its change", () => {
  const files = routeFiles(ROOT).map((p) => ({ rel: relative(ROOT, p), src: readFileSync(p, "utf8") }));
  const writing = files.filter((f) => WRITES.test(f.src));

  it("lists every writing route, and only those", () => {
    expect(writing.map((f) => f.rel).sort()).toEqual(Object.keys(WRITE_PATHS).sort());
  });

  it("each records where the list says", () => {
    for (const f of writing) {
      const where = WRITE_PATHS[f.rel];
      if (where.startsWith("none:")) continue;
      const src = where === "self" ? f.src : readFileSync(join(process.cwd(), where), "utf8");
      expect(RECORDS.test(src), `${f.rel} records through ${where}`).toBe(true);
      if (where !== "self") expect(f.src.includes(`from "@/${where.replace(/^src\//, "").replace(/\.ts$/, "")}"`) || f.src.includes("@/lib/"), `${f.rel} calls ${where}`).toBe(true);
    }
  });

  it("the new write paths carry before and after on every recording call", () => {
    for (const rel of BEFORE_AFTER) {
      const f = files.find((x) => x.rel === rel)!;
      const calls = recordingCalls(f.src);
      expect(calls.length, rel).toBeGreaterThan(0);
      for (const c of calls) expect(/\bbefore\b|\bafter\b|addedDetail\(|changedDetail\(|removedDetail\(/.test(c), `${rel}: ${c.slice(0, 120)}`).toBe(true);
    }
    // the library paths the new features write through
    for (const lib of ["src/lib/slicing/flow.ts", "src/lib/ai/drafts/attack.ts", "src/lib/ai/drafts/store.ts"]) {
      const src = readFileSync(join(process.cwd(), lib), "utf8");
      const writes = recordingCalls(src).filter((c) => !/"(draft\.run|draft\.rejected|draft\.edited|print\.(pause|resume)d)"|`print\.\$\{action\}d`/.test(c));
      for (const c of writes) expect(/\bbefore\b|\bafter\b|Detail\(/.test(c), `${lib}: ${c.slice(0, 120)}`).toBe(true);
    }
  });
});

describe("the new write paths, called one by one", () => {
  let project = "";
  type Detail = Record<string, unknown> & { before?: unknown; after?: unknown };
  const last = async (kind: string) => {
    const e = (await events(project)).filter((x) => x.kind === kind).at(-1);
    expect(e, `an event of kind ${kind}`).toBeTruthy();
    return e!.data as Detail;
  };
  const add = async (section: string, title: string, data: Record<string, unknown>, status = "open") =>
    Number((await q<{ id: string }>("INSERT INTO items (project_id, section, title, data, status) VALUES ($1,$2,$3,$4,$5) RETURNING id", [project, section, title, JSON.stringify(data), status]))[0].id);

  beforeAll(async () => {
    project = await newConcept("Write paths");
  });
  afterAll(async () => {
    await drop(project);
    await pool().end();
  });

  it("overriding a gate and moving the stage", async () => {
    expect((await override(json("POST", { stage: "concept", reason: "Checked by phone" }), ctx(project))).status).toBe(200);
    expect(await last("gate.overridden")).toMatchObject({ before: { overridden: false }, after: { overridden: true, note: "Checked by phone" } });
    expect((await moveStage(json("POST", { stage: "research" }), ctx(project))).status).toBe(200);
    expect(await last("stage.advanced")).toMatchObject({ before: { stage: "concept" }, after: { stage: "research" } });
    expect((await moveStage(json("POST", { stage: "concept" }), ctx(project))).status).toBe(200);
    expect(await last("stage.moved-back")).toMatchObject({ before: { stage: "research" }, after: { stage: "concept" } });
  });

  it("starting a launch records every row it adds", async () => {
    const r = await read<{ launchItemId: number; steps: number }>(await launch(json("POST", { template: "amazon", launchDate: "2027-05-01" }), ctx(project)));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(await last("launch.created")).toMatchObject({ after: { launchDate: "2027-05-01", rows: r.body.steps + 1 } });
    const added = (await events(project)).filter((e) => e.kind === "item.added" && (e.data as { section?: string }).section === "marketing/launch");
    expect(added.length).toBe(r.body.steps + 1);
    expect((added[0].data as Detail).after).toBeTruthy();
  });

  it("results, links and the CSV mapping", async () => {
    const ad = await add("marketing/ads", "Ad", {}, "draft");
    const camp = await add("marketing/campaigns", "Spring", { kind: "campaign" }, "planned");
    const row = { day: "2027-05-02", spend: 500, impressions: 1000, clicks: 20, orders: 1, revenue: 2500 };
    expect((await saveResults(json("POST", { campaignId: camp, source: "manual", rows: [row] }), ctx(project))).status).toBe(201);
    expect((await saveResults(json("POST", { campaignId: camp, source: "manual", rows: [{ ...row, spend: 700 }] }), ctx(project))).status).toBe(201);
    const d = await last("campaign.results");
    expect(d.before).toEqual({ results: [expect.objectContaining({ day: "2027-05-02", spend: 500 })] });
    expect(d.after).toEqual({ results: [expect.objectContaining({ day: "2027-05-02", spend: 700 })] });
    const ids = (await q<{ id: string }>("SELECT id FROM campaign_results WHERE campaign_id=$1", [camp])).map((x) => Number(x.id));
    expect((await removeResults(json("DELETE", { campaignId: camp, ids }), ctx(project))).status).toBe(200);
    expect((await last("campaign.results.removed")).before).toEqual({ results: [expect.objectContaining({ spend: 700 })] });

    await allowLinkHost(project, "example.com");
    const link = await read<{ link: { id: number } }>(await makeLink(json("POST", { campaignId: camp, creativeId: ad, baseUrl: "https://example.com/", source: "meta", medium: "paid-social" }), ctx(project)));
    expect(link.status).toBe(201);
    expect((await last("campaign.link")).after).toMatchObject({ destination: expect.stringContaining("utm_content=ad") });
    expect((await toggleLink(json("PATCH", { disabled: true }), { params: Promise.resolve({ id: project, linkId: String(link.body.link.id) }) })).status).toBe(200);
    expect(await last("campaign.link")).toMatchObject({ before: { disabled: false }, after: { disabled: true } });
    expect((await deleteLink(json("DELETE"), { params: Promise.resolve({ id: project, linkId: String(link.body.link.id) }) })).status).toBe(200);
    expect((await last("campaign.link")).before).toMatchObject({ destination: expect.any(String), creativeId: ad });

    const mapping = { mapping: { day: "Date", spend: "Spend" } };
    expect((await saveMapping(json("PUT", { channel: "meta", saved: mapping }), ctx(project))).status).toBe(200);
    expect(await last("campaign.csv-mapping")).toMatchObject({ before: { mapping: null }, after: { mapping: { mapping: { day: "Date", spend: "Spend" } } } });
    await q("DELETE FROM settings WHERE key LIKE $1", [`%${project}%`]);
  });
});
