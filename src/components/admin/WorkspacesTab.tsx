"use client";

// Admin, Workspaces (owner's addition of 23 Nov: "setting up (CRUD) users and workspaces"): every workspace, searched,
// with what a platform administrator may do to one: create (name, owner chosen from the accounts), rename, delete
// (type the name to confirm), members: add without an invitation, change role, remove, make owner (transfer), and
// "view as" a member. Every change goes to /api/admin/workspaces (src/lib/auth2/adminOps.ts checks and audits it).
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/ui/native-select";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks, SaveError } from "@/components/ui/states";
import { fmtDateTime } from "@/lib/format";
import { messageOf } from "@/lib/queries";
import { useUsers } from "@/lib/admin/peopleClient";
import { useCreateWorkspace, useWorkspace, useWorkspaceAction, useWorkspaces, type WorkspaceRow } from "@/lib/admin/workspacesClient";
import { ViewAsButton } from "./ViewAsButton";

const ROLE = { owner: "Owner", admin: "Admin", member: "Member" } as const;
type Role = keyof typeof ROLE;

export function WorkspacesTab() {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<WorkspaceRow | null>(null);
  const list = useWorkspaces(q);
  return (
    <div className="space-y-4">
      <Panel
        title="Workspaces"
        description="Every workspace on this installation, with its members. Concepts are not yet kept apart per workspace: until that is built, deleting a workspace removes its memberships and invitations only, and no concept."
        actions={<Button size="sm" onClick={() => setCreating(true)}>New workspace</Button>}
      >
        <div className="mb-3 max-w-md">
          <Field id="ws-q" label="Search by workspace name or a member's address">
            <Input id="ws-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
        </div>
        {list.isPending ? (
          <LoadingBlocks rows={3} label="Reading the workspaces" />
        ) : list.isError ? (
          <LoadError what="The workspaces" message={messageOf(list.error)} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState>No workspace matches.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Workspace</TableHead>
                  <TableHead>Owners</TableHead>
                  <TableHead className="w-24">People</TableHead>
                  <TableHead className="w-40">Made</TableHead>
                  <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((w) => (
                  <TableRow key={w.id} className="align-top" data-testid={`workspace-${w.id}`}>
                    <TableCell className="align-top text-sm font-medium text-primary wrap-anywhere">
                      {w.name} {w.personal ? <StatusBadge tone="neutral" className="ml-1">Personal</StatusBadge> : null} {w.twoFactorRequired ? <StatusBadge tone="info" className="ml-1">Two-step required</StatusBadge> : null}
                    </TableCell>
                    <TableCell className="align-top text-xs text-secondary wrap-anywhere">{w.owners.join(", ")}</TableCell>
                    <TableCell className="align-top font-mono text-sm text-secondary">{w.members}</TableCell>
                    <TableCell className="align-top font-mono text-xs text-muted">{fmtDateTime(w.createdAt)}</TableCell>
                    <TableCell className="align-top">
                      <Button size="sm" variant="outline" aria-label={`Manage the workspace ${w.name}`} onClick={() => setOpen(w)}>Manage</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
      {creating ? <CreateWorkspace onClose={() => setCreating(false)} /> : null}
      {open ? <ManageWorkspace row={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

/** An account chosen by searching its address or name (the accounts list, first page). */
function PickUser({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (userId: string) => void }) {
  const [q, setQ] = useState("");
  const users = useUsers({ q, page: 1 });
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field id={`${id}-q`} label={`${label}: search`}>
        <Input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <Field id={id} label={label}>
        <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose an account</option>
          {(users.data?.users ?? []).filter((u) => !u.disabled).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
        </NativeSelect>
      </Field>
    </div>
  );
}

function CreateWorkspace({ onClose }: { onClose: () => void }) {
  const create = useCreateWorkspace();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    create.mutate({ name, ownerUserId: owner }, { onSuccess: () => { toast.success(`"${name}" is made.`); onClose(); }, onError: (err) => setError(messageOf(err)) });
  };
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="New workspace" wide>
      <form onSubmit={submit} noValidate className="space-y-3">
        <Field id="new-ws-name" label="Name"><Input id="new-ws-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <PickUser id="new-ws-owner" label="Owner" value={owner} onChange={setOwner} />
        {error ? <SaveError message={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending || !name.trim() || !owner}>{create.isPending ? "Making…" : "Make the workspace"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ManageWorkspace({ row, onClose }: { row: WorkspaceRow; onClose: () => void }) {
  const detail = useWorkspace(row.id);
  const act = useWorkspaceAction(row.id);
  const [name, setName] = useState(row.name);
  const [add, setAdd] = useState("");
  const [addRole, setAddRole] = useState<Role>("member");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const run = (change: Parameters<typeof act.mutate>[0], done: string, after?: () => void) => {
    setError("");
    act.mutate(change, { onSuccess: () => { toast.success(done); after?.(); }, onError: (e) => setError(messageOf(e)) });
  };
  const members = detail.data?.members ?? [];
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={row.name} description={`${row.members} ${row.members === 1 ? "person" : "people"}`} wide>
      <div className="space-y-4">
        {error ? <ErrorLine>{error}</ErrorLine> : null}
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run({ action: "rename", name }, "Renamed."); }}>
          <Field id="ws-name" label="Name"><Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Button type="submit" size="sm" variant="outline" disabled={act.isPending || name === row.name}>Rename</Button>
        </form>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">Members</h3>
          {detail.isPending ? <LoadingBlocks rows={2} label="Reading the members" /> : detail.isError ? <LoadError what="The members" message={messageOf(detail.error)} onRetry={() => void detail.refetch()} /> : (
            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
              {members.map((m) => (
                <li key={m.memberId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" data-testid={`member-${m.memberId}`}>
                  <span className="min-w-0">
                    <span className="block font-medium text-primary wrap-anywhere">{m.name} <span className="font-normal text-secondary">{m.email}</span></span>
                    <span className="block text-xs text-muted">{ROLE[m.role]}{m.platformAdmin ? ", platform administrator" : ""}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${m.memberId}`}>Role of {m.email}</label>
                    <NativeSelect id={`role-${m.memberId}`} value={m.role} onChange={(e) => run({ action: "role", memberId: m.memberId, role: e.target.value as Role }, "The role is changed.")}>
                      {(Object.keys(ROLE) as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
                    </NativeSelect>
                    {m.role !== "owner" ? <Button size="sm" variant="outline" onClick={() => run({ action: "transfer", memberId: m.memberId }, `${m.email} is now the owner.`)}>Make sole owner<span className="sr-only"> ({m.email})</span></Button> : null}
                    <ConfirmButton label={<>Remove<span className="sr-only"> {m.email}</span></>} title={`Remove ${m.email}?`} body="They leave this workspace. If it was their only one, they get a workspace of their own. The last owner cannot be removed." confirmLabel="Remove" onConfirm={() => run({ action: "remove", memberId: m.memberId }, "Removed.")} />
                    {!m.platformAdmin ? <ViewAsButton userId={m.userId} name={m.name} email={m.email} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form className="space-y-2 rounded-md border border-hairline p-3" onSubmit={(e) => { e.preventDefault(); run({ action: "add", userId: add, role: addRole }, "Added, without an invitation.", () => setAdd("")); }}>
            <PickUser id="ws-add" label="Add a person" value={add} onChange={setAdd} />
            <div className="flex flex-wrap items-end gap-2">
              <Field id="ws-add-role" label="As">
                <NativeSelect id="ws-add-role" value={addRole} onChange={(e) => setAddRole(e.target.value as Role)}>
                  {(Object.keys(ROLE) as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
                </NativeSelect>
              </Field>
              <Button type="submit" size="sm" variant="outline" disabled={act.isPending || !add}>Add (no invitation is sent)</Button>
            </div>
          </form>
        </section>
        <section className="space-y-2 border-t border-hairline pt-3">
          <h3 className="text-sm font-semibold text-primary">Delete the workspace</h3>
          <p className="text-sm text-secondary">Its memberships and invitations go. Anyone for whom it was the last workspace gets a workspace of their own. No concept is deleted: concepts are not yet kept per workspace.</p>
          <Field id="ws-delete" label={`Type ${row.name} to confirm`}><Input id="ws-delete" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <Button size="sm" variant="destructive" disabled={act.isPending || confirm !== row.name} onClick={() => run({ action: "delete", confirmName: confirm }, "The workspace is deleted.", onClose)}>Delete the workspace</Button>
        </section>
      </div>
    </Modal>
  );
}
