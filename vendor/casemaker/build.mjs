#!/usr/bin/env node
// Builds vendor/casemaker/dist/engine.mjs from the forked CaseMaker source in this folder.
//   node vendor/casemaker/build.mjs
// The bundle is committed so the web app, its tests and the Docker build never need this step.
// manifold-3d stays external: the application's own copy is used, so there is one wasm kernel.
import { rolldown } from "rolldown";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const stub = join(here, "stubs/unavailable.mjs");
const bundle = await rolldown({
  input: join(here, "entry.ts"),
  platform: "node",
  external: ["manifold-3d"],
  resolve: {
    alias: {
      "@/platform/wasmAssets": join(here, "stubs/wasmAssets.mjs"),
      "@": join(here, "casemaker-app/src"),
      "occt-import-js/dist/occt-import-js.wasm?url": stub,
      "occt-import-js": stub,
      "opentype.js": stub,
    },
  },
  plugins: [
    {
      // registry.ts imports './fontAssets' relatively, which an alias cannot catch.
      name: "stub-font-assets",
      resolveId(id) {
        if (/(^|\/)fontAssets$/.test(id)) return join(here, "stubs/fontAssets.mjs");
        return null;
      },
    },
  ],
  logLevel: "warn",
});
await bundle.write({ file: join(here, "dist/engine.mjs"), format: "esm", minify: false, comments: { legal: true } });
console.log("wrote vendor/casemaker/dist/engine.mjs");
