/**
 * #1162 — ONE WASM LOADER FOR EVERY REALM: the page, plain Node (the sample harness, `casemaker
 * cut`), and a BUNDLED file (the house's planning bundle, #1293 phase 1).
 *
 * Every sweep recorded the two STEP samples as import FAIL: stepMesh imported its wasm with Vite's
 * `?url` specifier even under Node, where Node resolves the tail as a package ("Cannot find package
 * 'a'"). ManifoldRuntime had already isolated its `?url` behind the browser branch (#966); this
 * module is that pattern, once, for both kernels.
 *
 * WHERE A WASM IS, under Node, in order:
 *   1. BESIDE THE RUNNING MODULE — `./<file>` against `import.meta.url`. In an ESM bundle that is
 *      the bundle file, so a bundle that carries its `.wasm` next to it needs no node_modules and
 *      no `?url`. (In the source tree nothing sits beside this file, and step 2 answers.)
 *   2. node_modules, through `createRequire` — ONLY where the build allows it (tsx, vitest, the
 *      scripts). A production bundle defines `__WASM_NODE_MODULES_FALLBACK__` false at build time,
 *      which REMOVES this step from the bundled code: a missing `.wasm` beside the bundle must
 *      fail, never be masked by a node_modules that happens to be nearby (P3/Manager, #1162).
 *   3. Neither: a {@link WasmUnavailableError} naming where it looked, so the caller can say the
 *      reader could not be loaded and why — an environment fault, never a product verdict.
 * In the page, the `?url` import is a DYNAMIC import reached only from the browser branch, so no
 * Node realm ever evaluates it; a bundler for Node marks `*?url` external.
 *
 * THE BUNDLE'S SIDE OF THE CONTRACT (#1293; bundler-independent):
 *   - define `__WASM_NODE_MODULES_FALLBACK__` as `false`, with dead-code elimination on (any
 *     minifier; esbuild's `minifySyntax`), so the fallback branch is removed from the bundle;
 *   - copy each {@link wasmSources} entry's `path` beside the bundle's entry, under its `file` name;
 *   - leave `*.wasm?url` unresolved (external): the Node path never evaluates it;
 *   - bundle as ESM, and give the kernels' CommonJS glue `require`/`__dirname`.
 */

export type WasmAsset = 'occt' | 'manifold';

/** One wasm a kernel loads: the name it is found by beside a bundle, and its package path. */
export interface WasmSource {
  asset: WasmAsset;
  /** The file name the emscripten glue asks for, and the name it carries beside a bundle. */
  file: string;
  /** Where the package installs it, for `createRequire().resolve` and a bundle's copy step. */
  packagePath: string;
}

/**
 * THE ONE LIST (P3's contract): the bundle's copy step and its bundle check both read it, and a
 * source-scan spec holds every `?url` wasm import in the CLI's graph to it.
 */
export const WASM_SOURCES: readonly WasmSource[] = [
  { asset: 'occt', file: 'occt-import-js.wasm', packagePath: 'occt-import-js/dist/occt-import-js.wasm' },
  { asset: 'manifold', file: 'manifold.wasm', packagePath: 'manifold-3d/manifold.wasm' },
];

const sourceOf = (asset: WasmAsset): WasmSource => WASM_SOURCES.find((s) => s.asset === asset)!;


/** A kernel's wasm is in no place this build looks. Its message names each place it looked. */
export class WasmUnavailableError extends Error {
  readonly asset: WasmAsset;
  readonly looked: readonly string[];
  constructor(asset: WasmAsset, looked: readonly string[], message: string) {
    super(message);
    this.name = 'WasmUnavailableError';
    this.asset = asset;
    this.looked = looked;
  }
}

interface NodeBuiltins {
  existsSync(path: string): boolean;
  fileURLToPath(url: URL): string;
  createRequire(url: string): { resolve(id: string): string };
}

/**
 * The Node built-ins, through `process.getBuiltinModule` (Node ≥ 22.3): this file is compiled for
 * the page too (no `@types/node`), so a static `node:` import would not compile here — the same
 * reason `platform/headless/bootstrap.ts` has its own `builtin()`.
 */
function nodeBuiltins(): NodeBuiltins {
  const get = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process?.getBuiltinModule;
  if (typeof get !== 'function') throw new Error('loading a wasm under Node needs Node ≥ 22.3 (process.getBuiltinModule)');
  const fs = get('node:fs') as { existsSync(path: string): boolean };
  const url = get('node:url') as { fileURLToPath(url: URL): string };
  const mod = get('node:module') as { createRequire(url: string): { resolve(id: string): string } };
  return { existsSync: fs.existsSync, fileURLToPath: url.fileURLToPath, createRequire: mod.createRequire };
}

/** True under Node (vitest, tsx, a bundle), false in the page or a worker. */
export function runningInNode(): boolean {
  return typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node === 'string';
}

/** The page's URL for a wasm, as Vite emitted it. Only the browser branch reaches this. */
async function browserUrl(asset: WasmAsset): Promise<string> {
  if (asset === 'occt') return ((await import('occt-import-js/dist/occt-import-js.wasm?url')) as { default: string }).default;
  return ((await import('manifold-3d/manifold.wasm?url')) as { default: string }).default;
}

/** Under Node: the wasm beside the running module, else (where the build allows) the package's own. */
function nodePath(asset: WasmAsset): string {
  const node = nodeBuiltins();
  const { file, packagePath } = sourceOf(asset);
  const beside = node.fileURLToPath(new URL(`./${file}`, import.meta.url));
  if (node.existsSync(beside)) return beside;
  // The build-time define is tested INLINE, so a bundle that defines it `false` folds this whole
  // branch away — the fallback and its sentence are not in the bundled code at all.
  if (typeof __WASM_NODE_MODULES_FALLBACK__ === 'undefined' || __WASM_NODE_MODULES_FALLBACK__) {
    try {
      return node.createRequire(import.meta.url).resolve(packagePath);
    } catch {
      throw new WasmUnavailableError(asset, [beside, packagePath], `${file} is not beside the running module (${beside}) nor in node_modules (${packagePath})`);
    }
  }
  throw new WasmUnavailableError(asset, [beside], `${file} is not beside the bundle (${beside}); a bundled build looks nowhere else`);
}

/** Where a kernel's wasm is, in the realm asking: a URL in the page, a file path under Node. */
export async function locateWasm(asset: WasmAsset): Promise<string> {
  return runningInNode() ? nodePath(asset) : browserUrl(asset);
}

/**
 * The one list with each installed file resolved: what a Node bundle copies beside its entry
 * (`path` → `file`), and what its bundle check reads (#1293). Build-time tooling only.
 */
export function wasmSources(): (WasmSource & { path: string })[] {
  const require = nodeBuiltins().createRequire(import.meta.url);
  return WASM_SOURCES.map((s) => ({ ...s, path: require.resolve(s.packagePath) }));
}
