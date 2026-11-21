// Scratch: the stand-ins for the browser walk, on fixed ports (forwarders), so the app can be restarted.
import { createServer, request } from "node:http";
import { createRequire } from "node:module";
import { writeFileSync, appendFileSync } from "node:fs";
import { start as openai } from "../standins/openai";
import { start as pplx } from "../standins/perplexity";
import { startAmazon, startX, startInstagram } from "../standins/channels";
import { start as octo } from "../standins/octoprint";

const DIR = process.env.WALK_DIR ?? process.cwd();
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
}).listen(3418, "127.0.0.1");

// A fake slicer: the time depends on the layer height sent (0.2 mm: 2 h 10 min; 0.28 mm: 1 h 25 min; other: 1 h 40 min).
const JOB = "c".repeat(32);
createServer((rq, rs) => {
  const chunks: Buffer[] = [];
  rq.on("data", (c) => chunks.push(c));
  rq.on("end", () => {
    const done = (st: number, body: string | Buffer, type = "application/json") => { rs.writeHead(st, { "content-type": type }); rs.end(body); };
    const url = rq.url ?? "";
    if (rq.method === "GET" && url === "/health") return done(200, J({ ok: true, orca: "2.5.0 (fake)" }));
    if (rq.method === "POST" && url === "/slice") {
      const form = Buffer.concat(chunks).toString("latin1");
      const layer = /name="layer_height"\r\n\r\n([^\r]+)/.exec(form)?.[1] ?? "0.2";
      const seconds = layer === "0.2" ? 7800 : layer === "0.28" ? 5100 : 6000;
      return done(200, J({ id: JOB, orca: { version: "2.5.0", profileCommit: "fake" }, profile: { machine: "Bambu Lab A1 0.4 nozzle", process: `${layer}mm`, filament: "Generic PLA", note: "fake slicer for the walk" }, settings: { layerHeight: Number(layer), infill: 15, supports: false, material: "PLA" }, result: { seconds, filamentMm: 3000, filamentG: 40, filamentCm3: 30, supportG: null, layers: 200, readFrom: "statistics.json" }, warnings: [], files: { gcode: { name: "job.gcode", url: `/jobs/${JOB}/gcode` }, project: null, statistics: null } }));
    }
    if (rq.method === "GET" && url === `/jobs/${JOB}/gcode`) return done(200, "; fake\nG28\n", "text/plain");
    if (rq.method === "DELETE") return done(200, "{}");
    return done(404, "{}");
  });
}).listen(3416, "127.0.0.1");

function fwd(from: number, to: string) {
  const u = new URL(to);
  createServer((rq, rs) => {
    const p = request({ host: u.hostname, port: u.port, path: rq.url, method: rq.method, headers: rq.headers }, (r) => { rs.writeHead(r.statusCode ?? 502, r.headers); r.pipe(rs); });
    p.on("error", () => { rs.statusCode = 502; rs.end(); });
    rq.pipe(p);
  }).listen(from, "127.0.0.1");
}
fwd(3410, oa.url); fwd(3411, pp.url); fwd(3412, amz.url); fwd(3413, x.url); fwd(3414, ig.url); fwd(3415, printer.url);
writeFileSync(`${DIR}/standin.json`, J({ openai: "http://127.0.0.1:3410", pplx: "http://127.0.0.1:3411", amazon: "http://127.0.0.1:3412", x: "http://127.0.0.1:3413", ig: "http://127.0.0.1:3414", printer: "http://127.0.0.1:3415", slicer: "http://127.0.0.1:3416", xauth: "http://127.0.0.1:3418/authorize" }));
console.log("standins up");
setInterval(() => {
  writeFileSync(`${DIR}/requests.json`, J({ x: x.requests.map((r) => ({ m: r.method, p: r.path, b: r.body })), ig: ig.requests.map((r) => ({ m: r.method, p: r.path })), amazon: amz.requests.map((r) => ({ m: r.method, p: r.path })), printer: printer.requests.map((r) => ({ m: r.method, p: r.path })) }));
}, 2000);
