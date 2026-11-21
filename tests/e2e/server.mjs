// Started by Playwright's webServer (playwright.config.ts); not meant to be run by hand, though it can be.
// One process that, in order:
//   1. checks the production standalone build exists and copies .next/static and public/ next to it
//      (`next build` with output "standalone" leaves both out),
//   2. drops and recreates the e2e database, so every run starts from the seeded example concept,
//   3. starts the NetworkX planner the way tests/plan/planner.setup.ts does (python3 -m uvicorn, polled
//      on /health), on a free port,
//   4. starts the standalone server on HOSTNAME=127.0.0.1 and E2E_PORT, pointed at that database and planner.
// It stops both children when Playwright stops it. Any failure ends the process with a message.
import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const STANDALONE = `${ROOT}.next/standalone`;
const PLANNER_DIR = `${ROOT}planner`;
const PORT = process.env.E2E_PORT ?? "3210";
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://c2r:c2r@localhost:5432/c2r_e2e";

const children = [];
let stopping = false;

function die(message) {
  console.error(`[e2e server] ${message}`);
  stop(1);
  // Never resolves: `await die(...)` halts the start-up sequence while the children are stopped.
  return new Promise(() => {});
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill("SIGTERM");
  setTimeout(() => {
    for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
    process.exit(code);
  }, 3000).unref();
  if (children.every((c) => c.exitCode !== null || c.signalCode !== null)) process.exit(code);
  Promise.all(children.map((c) => new Promise((r) => (c.exitCode !== null || c.signalCode !== null ? r() : c.once("exit", r))))).then(() =>
    process.exit(code),
  );
}

process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));

function prefixed(stream, tag) {
  let buf = "";
  stream.on("data", (b) => {
    buf += b;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) process.stdout.write(`[${tag}] ${l}\n`);
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a ? a.port : 0;
      s.close(() => resolve(port));
    });
  });
}

// 1. The build.
if (!existsSync(`${STANDALONE}/server.js`)) {
  await die("No production build at .next/standalone/server.js. Run `npm run build` first.");
}
cpSync(`${ROOT}.next/static`, `${STANDALONE}/.next/static`, { recursive: true });
if (existsSync(`${ROOT}public`)) cpSync(`${ROOT}public`, `${STANDALONE}/public`, { recursive: true });

// 2. A fresh database. The name must contain "e2e", so a mistyped E2E_DATABASE_URL cannot drop a real database.
const target = new URL(DATABASE_URL);
const dbName = decodeURIComponent(target.pathname.replace(/^\//, ""));
if (!/e2e/i.test(dbName)) await die(`E2E_DATABASE_URL names the database "${dbName}"; its name must contain "e2e", because this run drops it.`);
const admin = new URL(DATABASE_URL);
admin.pathname = "/postgres";
try {
  const c = new pg.Client({ connectionString: admin.toString() });
  await c.connect();
  const ident = `"${dbName.replace(/"/g, '""')}"`;
  await c.query(`DROP DATABASE IF EXISTS ${ident} WITH (FORCE)`);
  await c.query(`CREATE DATABASE ${ident}`);
  await c.end();
  console.log(`[e2e server] database ${dbName} recreated`);
} catch (e) {
  await die(`Could not recreate database ${dbName} (${e.message}). Is PostgreSQL running and E2E_DATABASE_URL right?`);
}

// 3. The planner, started and polled like tests/plan/planner.setup.ts.
const plannerPort = await freePort();
const plannerUrl = `http://127.0.0.1:${plannerPort}`;
let plannerExited = null;
const planner = spawn("python3", ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(plannerPort)], {
  cwd: PLANNER_DIR,
  stdio: ["ignore", "pipe", "pipe"],
});
children.push(planner);
prefixed(planner.stdout, "planner");
prefixed(planner.stderr, "planner");
planner.on("error", (e) => (plannerExited = `could not start python3: ${e.message}`));
planner.on("exit", (code, signal) => {
  plannerExited ??= `exited with ${code ?? signal}`;
  if (!stopping) die(`The planner stopped (${plannerExited}).`);
});
const deadline = Date.now() + 30_000;
for (;;) {
  if (plannerExited) await die(`The planner did not start (${plannerExited}). Install it with: python3 -m pip install -r planner/requirements-dev.txt`);
  try {
    const r = await fetch(`${plannerUrl}/health`, { signal: AbortSignal.timeout(1000) });
    if (r.ok && (await r.json()).ok) break;
  } catch {
    // not listening yet
  }
  if (Date.now() > deadline) await die("The planner gave no answer from /health within 30 s.");
  await new Promise((r) => setTimeout(r, 150));
}
console.log(`[e2e server] planner at ${plannerUrl}`);

// 4. The app.
const web = spawn(process.execPath, ["server.js"], {
  cwd: STANDALONE,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT, DATABASE_URL, PLANNER_URL: plannerUrl },
});
children.push(web);
prefixed(web.stdout, "web");
prefixed(web.stderr, "web");
web.on("exit", (code, signal) => {
  if (!stopping) die(`The app server stopped (exited with ${code ?? signal}).`);
});
