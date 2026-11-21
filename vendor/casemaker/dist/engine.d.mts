// Types for the bundle built by vendor/casemaker/build.mjs. Only what the application calls.
import type { ManifoldToplevel, Manifold } from "manifold-3d";

export type BuildNode = { id: string; op: unknown; [key: string]: unknown };
export type BuildPlan = { nodes: BuildNode[]; placementReport?: unknown; [key: string]: unknown };

export function compileProject(project: unknown): BuildPlan;
export function executeOp(tl: ManifoldToplevel, op: unknown): Promise<Manifold>;
export function computeShellDims(...args: unknown[]): { outerX: number; outerY: number; outerZ: number; cavityX: number; cavityY: number; cavityZ: number };
export function defaultSnapCatchesForCase(board: unknown, params: unknown): unknown[];
export function cube(size: [number, number, number], center?: boolean): unknown;
export function cylinder(height: number, radius: number, segments?: number, ...rest: unknown[]): unknown;
export function translate(offset: [number, number, number], child: unknown): unknown;
export function rotate(degrees: [number, number, number], child: unknown): unknown;
export function difference(children: unknown[]): unknown;
