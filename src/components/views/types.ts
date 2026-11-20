import type { Section, Stage } from "@/lib/menu";
import type { Project } from "@/lib/types";

/** Props every section view receives. `store` is the backend section key its items live under. */
export type ViewProps = { project: Project; stage: Stage; section: Section; store: string };
