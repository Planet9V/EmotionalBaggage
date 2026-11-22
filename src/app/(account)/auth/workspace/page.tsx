import type { Metadata } from "next";
import { currentMailSender } from "@/lib/auth2/mail";
import { membersView } from "@/lib/auth2/workspaces/view";
import { ownerPool } from "@/lib/db";
import { requireWorkspace } from "../gate";
import { MembersScreen } from "./MembersScreen";

export const metadata: Metadata = { title: "Workspace members · Concept to Realization" };

/** The open workspace: its members, invitations and settings (owners and admins), or the member list (members). */
export default async function WorkspacePage() {
  const { user, active } = await requireWorkspace("/auth/workspace");
  const view = await membersView(ownerPool(), user, active);
  return <MembersScreen view={view} mail={(await currentMailSender()) !== null} />;
}
