// npm run walk: the next-step-only browser walk (tests/walk/flow_main.py), in one command. Not run in CI.
//
// 1. starts the app and the planner the way the browser smoke test does (tests/e2e/server.mjs: a fresh
//    database named in WALK_DATABASE_URL, which must contain "e2e"; the production build in .next/standalone);
// 2. builds the stand-ins (tests/walk/standin.ts, the model, Perplexity, X, Instagram, Amazon, an OctoPrint
//    printer and a fake slicer on ports 3410 to 3418) and the scripted model answers (answer.ts) with esbuild,
//    and starts them;
// 3. runs flow_main.py with Python's Playwright (system Chrome), from a scratch folder that also holds its
//    log (flow.log) and screenshots (shots/);
// 4. passes when the log says the walk reached an approved campaign plan with a queued print job and the end of
//    Marketing; prints where the log and screenshots are either way.
//
// Needs: npm run build first; python3 with playwright and requests; Google Chrome. Ports: WALK_PORT (default 3378)
// for the app, 3410 to 3418 for the stand-ins.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WALK_SRC = join(ROOT, "tests/walk");
const PORT = process.env.WALK_PORT ?? "3378";
const DB = process.env.WALK_DATABASE_URL;
if (!DB || !/e2e/.test(new URL(DB).pathname)) {
  console.error('Set WALK_DATABASE_URL to a database you can throw away; its name must contain "e2e" (it is dropped and made again).');
  process.exit(2);
}
if (!existsSync(join(ROOT, ".next/standalone/server.js"))) {
  console.error("No production build: run npm run build first.");
  process.exit(2);
}

const dir = process.env.WALK_DIR ?? mkdtempSync(join(tmpdir(), "c2r-walk-"));
mkdirSync(join(dir, "shots"), { recursive: true });
for (const f of readdirSync(WALK_SRC)) if (f.endsWith(".py")) copyFileSync(join(WALK_SRC, f), join(dir, f));

const esbuild = join(ROOT, "node_modules/.bin/esbuild");
for (const [src, out, fmt] of [["answer.ts", "answer.cjs", "cjs"], ["standin.ts", "standin.mjs", "esm"]]) {
  const r = spawnSync(esbuild, [join(WALK_SRC, src), "--bundle", "--platform=node", `--format=${fmt}`, "--packages=external", `--outfile=${join(dir, out)}`], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const children = [];
const stop = (code) => {
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 1500).unref();
};
process.on("SIGINT", () => stop(130));

const run = (cmd, args, env) => {
  const c = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "inherit", "inherit"] });
  children.push(c);
  return c;
};

// the app talks to the stand-ins through the test-only addresses (developer guide, Channels and Research)
const S = (port, path = "") => `http://127.0.0.1:${port}${path}`;
run("node", [join(ROOT, "tests/e2e/server.mjs")], {
  E2E_DATABASE_URL: DB,
  E2E_PORT: PORT,
  PERPLEXITY_BASE_URL: S(3411),
  AMAZON_LWA_TOKEN_URL: S(3412, "/auth/o2/token"),
  AMAZON_SP_BASE_URL: S(3412),
  X_API_BASE_URL: S(3413),
  X_AUTHORIZE_URL: S(3418, "/"),
  INSTAGRAM_GRAPH_BASE_URL: S(3414, "/v27.0"),
});
run("node", [join(dir, "standin.mjs")], { WALK_DIR: dir, NODE_PATH: join(ROOT, "node_modules") });

const base = `http://127.0.0.1:${PORT}`;
const until = Date.now() + 180_000;
for (;;) {
  const ok = await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false);
  if (ok) break;
  if (Date.now() > until) {
    console.error("The app did not answer within three minutes.");
    stop(1);
    await new Promise(() => {});
  }
  await new Promise((r) => setTimeout(r, 1000));
}
await new Promise((r) => setTimeout(r, 3000)); // the stand-ins and the migrations settle

const walk = run("python3", [join(dir, "flow_main.py")], { WALK_DIR: dir, WALK_BASE: base });
const code = await new Promise((r) => walk.on("exit", (c) => r(c ?? 1)));
const log = existsSync(join(dir, "flow.log")) ? readFileSync(join(dir, "flow.log"), "utf8") : "";
const reached = /^REACHED:/m.test(log) && /^END OF MARKETING/m.test(log);
console.log(`\nWalk log: ${join(dir, "flow.log")}\nScreenshots: ${join(dir, "shots")}\n${reached ? "PASSED: reached an approved campaign plan with a queued print job, and the end of Marketing." : "FAILED: the walk did not reach the end of Marketing; read the log."}`);
stop(code === 0 && reached ? 0 : 1);
