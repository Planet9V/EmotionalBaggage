import type { ReactNode } from "react";
import { ProjectContext } from "@/lib/client";

/** Opens one concept for the components under it, as the shell does. */
export function ProcessContext({ projectId, children }: { projectId: string; children: ReactNode }) {
  const value = { projects: [], project: { id: projectId, name: projectId, oneLiner: "" }, loading: false, error: "", select: () => {}, reload: async () => {} };
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
