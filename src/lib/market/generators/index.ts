import type { z } from "zod";
import { entry as competitors } from "./competitors";
import { entry as names } from "./names";
import { entry as personas } from "./personas";
import { entry as positioning } from "./positioning";
import { entry as voiceCheck } from "./voiceCheck";
import type { Entry } from "./types";

export const GENERATOR_IDS = ["personas", "competitors", "positioning", "names", "voice-check"] as const;
export type GeneratorId = (typeof GENERATOR_IDS)[number];

export const GENERATORS: Record<GeneratorId, Entry<z.ZodType>> = {
  personas: personas as unknown as Entry<z.ZodType>,
  competitors: competitors as unknown as Entry<z.ZodType>,
  positioning: positioning as unknown as Entry<z.ZodType>,
  names: names as unknown as Entry<z.ZodType>,
  "voice-check": voiceCheck as unknown as Entry<z.ZodType>,
};
