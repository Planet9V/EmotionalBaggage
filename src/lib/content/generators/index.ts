// Every content generator, for the drafting engine's registry.
import type { Generator } from "@/lib/ai/drafts/types";
import { adGenerators } from "./ads";
import { landingPage } from "./landing";
import { launchGenerators } from "./launch";
import { listingGenerators } from "./listing";
import { socialGenerators } from "./social";

export const CONTENT_GENERATORS = [...adGenerators, landingPage, ...listingGenerators, ...socialGenerators, ...launchGenerators] as unknown as Generator<never>[];
