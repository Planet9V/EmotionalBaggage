// Request shapes of the drafts routes.
import { z } from "zod";
import { OPTIMISE_ACTIONS } from "./measure";

const projectId = z.string().min(1).max(80);
const id = z.number().int().positive();

export const runRequest = z.object({
  projectId,
  generator: z.string().min(1).max(80),
  /** confirm marking earlier undecided drafts of this generator superseded */
  supersede: z.boolean().optional(),
  /** revise these existing rows of the target store instead of drafting new ones */
  reviseIds: z.array(id).min(1).max(500).optional(),
  why: z.string().max(4000).optional(),
  /** a reviewer critique to answer (with reviseIds) */
  critique: z.string().max(20_000).optional(),
  /** what a generator run from its own screen needs (a research answer id, how many, a note); each generator checks its own */
  params: z.record(z.string().max(40), z.union([z.string().max(6000), z.number(), z.boolean()])).optional(),
});

export const draftEdit = z
  .object({
    title: z.string().max(300).optional(),
    body: z.string().max(20_000).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "nothing to change" });

export const rejectRequest = z.object({ reason: z.string().max(400).optional() });

export const approveRunRequest = z.object({
  projectId,
  runId: z.uuid(),
  confirm: z.literal(true, { message: "Approving a whole run needs confirm: true." }),
});

export const impactRequest = z.object({ projectId, itemId: id });

export const proposeRequest = z.object({
  projectId,
  itemId: id,
  groups: z.array(z.object({ generator: z.string().min(1).max(80), itemIds: z.array(id).min(1).max(500) })).min(1).max(20),
  supersede: z.boolean().optional(),
});

export const optimiseRequest = z.object({ projectId, action: z.enum(OPTIMISE_ACTIONS), supersede: z.boolean().optional() });

export const draftStatusFilter = z.enum(["draft", "approved", "rejected", "all"]);
