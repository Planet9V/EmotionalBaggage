import type { Metadata } from "next";
import { requireWorkspace } from "../gate";
import { Frame, TextLink } from "../_components/Frame";
import { WorkspaceList } from "./WorkspaceList";

export const metadata: Metadata = { title: "Workspaces · Concept to Realization" };

/** The workspace switcher: every workspace of this account, which one is open, and a new one. */
export default async function WorkspacesPage() {
  const { active, all } = await requireWorkspace("/auth/workspaces");
  return (
    <Frame
      wide
      title="Workspaces"
      lead={<>You are working in <strong className="font-medium text-primary">{active.name}</strong>.</>}
      footer={<p><TextLink href="/auth/account">Back to your account</TextLink></p>}
    >
      <WorkspaceList active={active.workspaceId} workspaces={all.map((w) => ({ id: w.workspaceId, name: w.name, role: w.role }))} />
    </Frame>
  );
}
