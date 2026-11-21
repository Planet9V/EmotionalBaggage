import { z } from "zod";
import { STAGES } from "@/lib/menu";

const STAGE_KEYS = STAGES.map((s) => s.key) as [string, ...string[]];
const stage = z.enum(STAGE_KEYS, { message: `must be one of: ${STAGE_KEYS.join(", ")}` });

/** POST /api/projects/[id]/gates: override one stage's gate. The reason is required and kept. */
export const overrideBody = z.object({
  stage,
  reason: z.string().max(1000, "Keep the reason under 1,000 characters.").trim().min(1, "Type the reason for passing this gate without its checks."),
});

/** POST /api/projects/[id]/stage: move the concept to another stage. */
export const stageBody = z.object({ stage });
