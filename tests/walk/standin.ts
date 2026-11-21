// Scratch: the stand-ins for the browser walk, on fixed ports (forwarders), so the app can be restarted.
import { createServer, request } from "node:http";
import { createRequire } from "node:module";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { start as openai } from "../standins/openai";
import { start as pplx } from "../standins/perplexity";
import { startAmazon, startX, startInstagram } from "../standins/channels";
import { start as octo } from "../standins/octoprint";

const DIR = process.env.WALK_DIR ?? process.cwd();
/** The first of nine ports (WALK_PORT_BASE, default 3410), so two walks on one machine do not collide. */
const BASE = Number(process.env.WALK_PORT_BASE ?? 3410);
const P = (n: number) => BASE + n;
const req = createRequire(import.meta.url);
const J = (o: unknown) => JSON.stringify(o);
function fresh() { const p = DIR + "/answer.cjs"; delete req.cache[req.resolve(p)]; return req(p); }

const oa = await openai({
  prefix: "/v1",
  models: ["walk-chat", "walk-embed"],
  dimensions: 8,
  reply: (messages) => {
    const system = messages.find((x) => x.role === "system");
    const sys = typeof system?.content === "string" ? system.content : J(system?.content ?? "");
    const users = messages.filter((x) => x.role === "user");
    const lastUser = users[users.length - 1];
    const usr = typeof lastUser?.content === "string" ? lastUser.content : J(lastUser?.content ?? "");
    const full = messages.map((x) => (typeof x.content === "string" ? x.content : J(x.content))).join("\n");
    try { return fresh().answer(sys, messages.length > 2 ? full : usr); } catch (e) { appendFileSync(DIR + "/standin.log", "ERR " + e + "\n"); return J({ rows: [] }); }
  },
});
const pp = await pplx({ apiKey: "pplx-walk-key-0001", reply: "Researchers found the main alternatives are Rival One at $29.99 and Rival Two at $99. Rival One is reported to break easily [1]. Many buyers say \"it just works for me\" about simple products [2].", citations: ["https://example.com/rival-one-review", "https://example.org/buyers-forum"], costUsd: 0.004 });
const day = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const amz = await startAmazon({ refreshToken: "Atzr|walk-refresh", clientId: "amzn1.application-oa2-client.walk", clientSecret: "walk-secret", orders: [0, 1, 2].map((i) => ({ orderId: `111-000000${i}-000000${i}`, createdTime: day(i + 1), lastUpdatedTime: day(i), status: "Shipped", items: [{ asin: "B0WALK0001", sku: "WALK-1", qty: 1 + i, unit: "29.99" }] })) });
const x = await startX({ clientId: "walk-x-client", mentions: [{ id: "1900000000000000001", text: "@baggageclaims does it work with carry-on?", author_id: "42", created_at: day(1), conversation_id: "1900000000000000001" }] });
const ig = await startInstagram({ media: [{ id: "18000000000000001", permalink: "https://instagram.com/p/x", comments: [{ id: "17900000000000001", text: "Looks handy, when can I buy one?", username: "traveller", timestamp: day(1) }] }] });
const printer = await octo({});

// The X sign-in page: as if the user approved on x.com, the code is remembered with its challenge and sent back.
let n = 0;
createServer((rq, rs) => {
  const u = new URL(rq.url ?? "/", "http://x");
  const code = `walk-code-${++n}`;
  const codes: Record<string, string> = {};
  codes[code] = u.searchParams.get("code_challenge") ?? "";
  x.set({ codes });
  const back = new URL(u.searchParams.get("redirect_uri") ?? "http://127.0.0.1/");
  back.searchParams.set("code", code);
  back.searchParams.set("state", u.searchParams.get("state") ?? "");
  rs.writeHead(302, { location: back.toString() });
  rs.end();
}).listen(P(8), "127.0.0.1");

// A fake slicer with the real wrapper's interface (slicer/app/main.py): GET /health, GET /profiles (the catalogue built
// from slicer/profiles.json as profiles.catalogue() builds it), POST /slice (refuses a file that is not .stl or .3mf
// and a printer with no profile, as the wrapper does), GET /jobs/<id>/gcode and DELETE /jobs/<id>.
// The time depends on the layer height sent (0.2 mm: 2 h 10 min; 0.28 mm: 1 h 25 min; other: 1 h 40 min).
type ProfileEntry = { profile?: unknown; orcaMachine?: string; reason?: string; note?: string; process?: Record<string, string>; filament?: Record<string, string> };
const TABLE = JSON.parse(readFileSync(new URL("../../slicer/profiles.json", import.meta.url), "utf8")) as { orca: { version: string; tag: string; commit: string }; materials: string[]; printers: Record<string, Record<string, ProfileEntry>> };
const hasProfile = (e: ProfileEntry) => !!e.profile;
const CATALOGUE = Object.entries(TABLE.printers).flatMap(([maker, models]) =>
  Object.entries(models).map(([model, e]) => ({
    maker, model, available: hasProfile(e), reason: e.reason ?? "",
    materials: hasProfile(e) ? Object.keys(e.filament ?? {}).sort() : [],
    layerHeights: hasProfile(e) ? Object.keys(e.process ?? {}).map(Number).sort((x, y) => x - y) : [],
    note: e.note ?? "",
  })),
);
const JOB = "c".repeat(32);
createServer((rq, rs) => {
  const chunks: Buffer[] = [];
  rq.on("data", (c) => chunks.push(c));
  rq.on("end", () => {
    const done = (st: number, body: string | Buffer, type = "application/json") => { rs.writeHead(st, { "content-type": type }); rs.end(body); };
    const url = rq.url ?? "";
    if (rq.method === "GET" && url === "/health") return done(200, J({ ok: true, slicerInstalled: true, orcaVersion: TABLE.orca.version, profiles: TABLE.orca, profileRootPresent: true }));
    if (rq.method === "GET" && url === "/profiles") return done(200, J({ orca: TABLE.orca, materials: TABLE.materials, printers: CATALOGUE }));
    if (rq.method === "POST" && url === "/slice") {
      const form = Buffer.concat(chunks).toString("latin1");
      const field = (n: string) => new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`).exec(form)?.[1];
      const file = /name="file"; filename="([^"]*)"/.exec(form)?.[1] ?? "";
      if (!/\.(stl|3mf)$/i.test(file)) return done(422, J({ detail: "Send an .stl or .3mf file." }));
      const maker = field("maker") ?? "", model = field("model") ?? "";
      const entry = TABLE.printers[maker]?.[model];
      if (!entry || !hasProfile(entry)) return done(422, J({ detail: `There is no OrcaSlicer profile for ${maker} ${model}.` }));
      const layer = field("layer_height") ?? "0.2";
      const seconds = Number(layer) === 0.2 ? 7800 : Number(layer) === 0.28 ? 5100 : 6000;
      return done(200, J({ id: JOB, orca: { version: TABLE.orca.version, profileCommit: TABLE.orca.commit }, profile: { machine: entry.orcaMachine ?? `${maker} ${model}`, process: `${layer}mm`, filament: `Generic ${field("material") ?? "PLA"}`, note: "fake slicer for the walk" }, settings: { layerHeight: Number(layer), infill: Number(field("infill") ?? 15), supports: field("supports") === "true", material: (field("material") ?? "PLA").toUpperCase() }, result: { seconds, filamentMm: 3000, filamentG: 40, filamentCm3: 30, supportG: null, layers: 200, readFrom: "statistics.json" }, warnings: [], files: { gcode: { name: "job.gcode", url: `/jobs/${JOB}/gcode` }, project: null, statistics: null }, expiresInSeconds: 3600 }));
    }
    if (rq.method === "GET" && url === `/jobs/${JOB}/gcode`) return done(200, "; fake\nG28\n", "text/plain");
    if (rq.method === "DELETE" && url.startsWith("/jobs/")) return done(200, "{}");
    return done(404, J({ detail: "Not Found" }));
  });
}).listen(P(6), "127.0.0.1");

function fwd(from: number, to: string) {
  const u = new URL(to);
  createServer((rq, rs) => {
    const p = request({ host: u.hostname, port: u.port, path: rq.url, method: rq.method, headers: rq.headers }, (r) => { rs.writeHead(r.statusCode ?? 502, r.headers); r.pipe(rs); });
    p.on("error", () => { rs.statusCode = 502; rs.end(); });
    rq.pipe(p);
  }).listen(from, "127.0.0.1");
}
fwd(P(0), oa.url); fwd(P(1), pp.url); fwd(P(2), amz.url); fwd(P(3), x.url); fwd(P(4), ig.url); fwd(P(5), printer.url);
writeFileSync(`${DIR}/standin.json`, J({ openai: `http://127.0.0.1:${P(0)}`, pplx: `http://127.0.0.1:${P(1)}`, amazon: `http://127.0.0.1:${P(2)}`, x: `http://127.0.0.1:${P(3)}`, ig: `http://127.0.0.1:${P(4)}`, printer: `http://127.0.0.1:${P(5)}`, slicer: `http://127.0.0.1:${P(6)}`, xauth: `http://127.0.0.1:${P(8)}/authorize` }));
console.log("standins up");
setInterval(() => {
  writeFileSync(`${DIR}/requests.json`, J({ x: x.requests.map((r) => ({ m: r.method, p: r.path, b: r.body })), ig: ig.requests.map((r) => ({ m: r.method, p: r.path })), amazon: amz.requests.map((r) => ({ m: r.method, p: r.path })), printer: printer.requests.map((r) => ({ m: r.method, p: r.path })) }));
}, 2000);
