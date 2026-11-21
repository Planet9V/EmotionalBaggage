"use client";

import { CritiquePanel } from "./CritiquePanel";
import { ImpactNotice } from "./ImpactNotice";

/** Under a section's header: the notice of what a saved change affects, and the reviewer's attack on press and FAQ rows. */
export function SectionAssist({ projectId, store }: { projectId: string; store: string }) {
  return (
    <div className="mb-5 space-y-3 empty:hidden">
      <ImpactNotice projectId={projectId} />
      <CritiquePanel projectId={projectId} store={store} />
    </div>
  );
}
