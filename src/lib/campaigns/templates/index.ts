import { amazon } from "./amazon";
import { kickstarter } from "./kickstarter";
import { ownSite } from "./ownsite";
import { retail } from "./retail";
import { softLaunch } from "./soft";
import type { LaunchTemplate } from "./types";

export type { LaunchTemplate } from "./types";
export { CHECK_PROMPT } from "./types";

export const TEMPLATES: LaunchTemplate[] = [kickstarter, amazon, ownSite, retail, softLaunch];

export const template = (id: string) => TEMPLATES.find((t) => t.id === id);
