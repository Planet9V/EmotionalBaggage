import { z } from "zod";
import { OUTCOMES } from "./jobState";

export const confirmBody = z.object({ printer: z.string().min(1).max(200), file: z.string().max(200) });

const n = z.number().finite().min(0).max(1e7);
export const resultBody = z.object({
  outcome: z.enum(OUTCOMES),
  actualSeconds: n.optional(),
  actualG: n.optional(),
  notes: z.string().max(4000).optional(),
  photoFileIds: z.array(z.number().int().positive()).max(20).default([]),
});
