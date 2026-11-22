"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { call } from "@/lib/auth2/client";
import { ROLES, may, mayGrant, type Role } from "@/lib/auth2/workspaces/permissions";
import type { MembersView } from "@/lib/auth2/workspaces/view";
import { TextLink, useStoredTheme } from "../_components/Frame";
import { Message } from "../_components/Message";
import { emailField } from "../_components/rules";

const ROLE_WORDS: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** A link or code handed back in "no mail" mode (or when sending failed), to pass on by hand. Shown once. */
function HandOver({ link, code, onDone }: { link?: string; code?: string; onDone: () => void }) {
  const value = link ?? code ?? "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(link ? "The link is copied." : "The code is copied.");
    } catch {
      toast.error("It could not be copied here. Select it and copy it.");
    }
  };
  return (
    <div role="status" className="space-y-2 rounded-md border border-hairline bg-canvas p-3">
      <p className="text-sm text-primary">
        {link
          ? "No email was sent. Give this link to the person you invited; it works once, for 48 hours, and is shown only now."
          : "No email was sent. Give this code to the person, in person or by phone: with their password it lets them set up two-step sign-in again, at /auth/re-enrol. It works once, for 24 hours, and is shown only now."}
      </p>
      <p className="break-all font-mono text-xs text-primary" data-invite-link={link ? "" : undefined} data-reenrol-code={code ? "" : undefined}>{value}</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>{link ? "Copy the link" : "Copy the code"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

const inviteSchema = z.object({ email: emailField, role: z.enum(ROLES) });
const renameSchema = z.object({ name: z.string().trim().min(1, "Enter a name for the workspace.").max(100, "Keep the workspace name to 100 characters.") });

/**
 * The members screen. Every change is checked again by the server (src/lib/auth2/workspaces/permissions.ts); the
 * screen only leaves out what the viewer's role cannot do. After a change the page is read again from the server.
 */
export function MembersScreen({ view, mail }: { view: MembersView; mail: boolean }) {
  useStoredTheme();
  const router = useRouter();
  const ws = view.workspace;
  const me = ws.role;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [handOver, setHandOver] = useState<{ link?: string; code?: string } | null>(null);

  const act = async (key: string, path: string, body: Record<string, unknown>, done: string) => {
    setBusy(key);
    setError("");
    const r = await call<{ link?: string; code?: string; mailed?: boolean }>(path, { workspaceId: ws.id, ...body });
    setBusy("");
    if (!r.ok) return setError(r.error);
    if (r.data?.link) setHandOver({ link: r.data.link });
    if (r.data?.code) setHandOver({ code: r.data.code });
    toast.success(done);
    router.refresh();
  };

  const invite = useForm<z.infer<typeof inviteSchema>>({ resolver: zodResolver(inviteSchema), defaultValues: { email: "", role: "member" } });
  const sendInvite = invite.handleSubmit(async (v) => {
    const r = await call<{ link?: string; mailed: boolean }>("/workspace/invite", { workspaceId: ws.id, email: v.email, role: v.role });
    if (!r.ok) return invite.setError("root", { message: r.error });
    invite.reset({ email: "", role: v.role });
    if (r.data.link) setHandOver({ link: r.data.link });
    toast.success(r.data.mailed ? `Invitation sent to ${v.email}.` : `Invitation made for ${v.email}.`);
    router.refresh();
  });

  const rename = useForm<{ name: string }>({ resolver: zodResolver(renameSchema), defaultValues: { name: ws.name } });
  const saveName = rename.handleSubmit(async (v) => {
    const r = await call("/workspace/rename", { workspaceId: ws.id, name: v.name });
    if (!r.ok) return rename.setError("root", { message: r.error });
    toast.success("The workspace is renamed.");
    router.refresh();
  });

  const [policy, setPolicy] = useState(view.admin?.twoFactorRequired ? "required" : "off");
  const grantable = ROLES.filter((r) => mayGrant(me, r));
  const admin = view.admin;

  return (
    <main className="min-h-dvh bg-canvas text-primary">
      <PageHeader eyebrow="Workspace" title={ws.name} nextStep={false} blurb={`You are ${{ owner: "an owner", admin: "an admin", member: "a member" }[me]} here.`}>
        <TextLink href="/auth/workspaces">All workspaces</TextLink>
      </PageHeader>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8">
        <Message id="members-message" error={error} />
        {handOver && <HandOver {...handOver} onDone={() => setHandOver(null)} />}

        <Panel title="Members" description={admin ? "Roles, and whether each person signs in with an authenticator app." : "Who works in this workspace."}>
          <Table aria-label="List of members">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {admin && <TableHead>Two-step sign-in</TableHead>}
                {admin && <TableHead><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.members.map((m) => (
                <TableRow key={m.memberId}>
                  <TableCell className="font-medium">{m.name}{m.you ? <span className="text-secondary"> (you)</span> : null}</TableCell>
                  <TableCell className="break-all text-secondary">{m.email}</TableCell>
                  <TableCell>
                    {m.manageable ? (
                      <NativeSelect
                        aria-label={`Role of ${m.name}`}
                        value={m.role}
                        disabled={!!busy}
                        className="h-8 w-28"
                        onChange={(e) => void act(`role-${m.memberId}`, "/workspace/member/role", { memberId: m.memberId, role: e.target.value }, `${m.name} is now ${e.target.value}.`)}
                      >
                        {ROLES.filter((r) => r === m.role || mayGrant(me, r)).map((r) => <option key={r} value={r}>{ROLE_WORDS[r]}</option>)}
                      </NativeSelect>
                    ) : (
                      <StatusBadge tone={m.role === "owner" ? "info" : "neutral"}>{ROLE_WORDS[m.role]}</StatusBadge>
                    )}
                  </TableCell>
                  {admin && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge tone={m.twoFactor ? "success" : admin.twoFactorRequired || m.required ? "warning" : "neutral"}>{m.twoFactor ? "On" : admin.twoFactorRequired || m.required ? "Not set up" : "Off"}</StatusBadge>
                        {m.required && <StatusBadge tone="info">Required of them</StatusBadge>}
                      </div>
                    </TableCell>
                  )}
                  {admin && (
                    <TableCell>
                      {m.manageable && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={!!busy}
                            onClick={() => void act(`req-${m.memberId}`, "/workspace/member/two-factor-required", { memberId: m.memberId, required: !m.required }, m.required ? `Two-step sign-in is no longer required of ${m.name}.` : `Two-step sign-in is now required of ${m.name}.`)}
                          >
                            {m.required ? "Stop requiring two-step" : "Require two-step"}{" "}<span className="sr-only">of {m.name}</span>
                          </Button>
                          {m.twoFactor && (admin.twoFactorRequired || m.required) && (
                            <ConfirmButton
                              size="xs"
                              label={<>Reset two-step{" "}<span className="sr-only">of {m.name}</span></>}
                              title={`Reset two-step sign-in of ${m.name}?`}
                              body={`This removes ${m.email}'s authenticator app and recovery codes and signs them out everywhere. Their password alone will not sign them in: ${mail ? "we email them a link" : "you get a one-time code to give them"} to set up an app again. Use it when they have lost their phone.`}
                              confirmLabel="Reset two-step sign-in"
                              disabled={!!busy}
                              onConfirm={() => void act(`reset-${m.memberId}`, "/workspace/member/reset-two-factor", { memberId: m.memberId }, `Two-step sign-in of ${m.name} is reset.`)}
                            />
                          )}
                          <ConfirmButton
                            size="xs"
                            label={<>Remove{" "}<span className="sr-only">{m.name}</span></>}
                            title={`Remove ${m.name} from ${ws.name}?`}
                            body="They lose access to this workspace at once. Their own workspaces are not affected."
                            confirmLabel="Remove"
                            disabled={!!busy}
                            onConfirm={() => void act(`rm-${m.memberId}`, "/workspace/member/remove", { memberId: m.memberId }, `${m.name} is removed.`)}
                          />
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        {admin && (
          <Panel title="Invite someone" description={mail ? "We email them a link. It works once, for 48 hours, and only for that address." : "This installation sends no email: you get a link to hand over. It works once, for 48 hours, and only for that address."}>
            <form method="post" onSubmit={(e) => void sendInvite(e)} noValidate className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
              <div className="sm:col-span-3"><Message id="invite-message" error={invite.formState.errors.root?.message} /></div>
              <Field id="invite-email" label="Email address" error={invite.formState.errors.email?.message}>
                <Input id="invite-email" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} {...invite.register("email")} {...describe("invite-email", { error: invite.formState.errors.email?.message })} />
              </Field>
              <Field id="invite-role" label="Role">
                <NativeSelect id="invite-role" {...invite.register("role")}>
                  {grantable.map((r) => <option key={r} value={r}>{ROLE_WORDS[r]}</option>)}
                </NativeSelect>
              </Field>
              <Button type="submit" disabled={invite.formState.isSubmitting}>{invite.formState.isSubmitting ? "Inviting…" : "Invite"}</Button>
            </form>
          </Panel>
        )}

        {admin && (
          <Panel title="Invitations waiting" description="Not yet accepted. Sending again makes a new link; the old one stops working.">
            {admin.invitations.length === 0 ? (
              <p className="text-sm text-secondary">None.</p>
            ) : (
              <Table aria-label="List of invitations waiting">
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited by</TableHead>
                    <TableHead>Works until</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admin.invitations.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="break-all">{i.email}</TableCell>
                      <TableCell><StatusBadge tone="neutral">{ROLE_WORDS[i.role]}</StatusBadge></TableCell>
                      <TableCell className="text-secondary">{i.invitedBy}</TableCell>
                      <TableCell className="text-secondary">{date(i.expiresAt)}</TableCell>
                      <TableCell>
                        {mayGrant(me, i.role) && (
                          <div className="flex justify-end gap-1.5">
                            <Button type="button" size="xs" variant="outline" disabled={!!busy} onClick={() => void act(`resend-${i.id}`, "/workspace/invitation/resend", { invitationId: i.id }, `Invitation to ${i.email} sent again.`)}>
                              {busy === `resend-${i.id}` ? "Sending…" : <>Send again{" "}<span className="sr-only">to {i.email}</span></>}
                            </Button>
                            <ConfirmButton
                              size="xs"
                              label={<>Revoke{" "}<span className="sr-only">the invitation to {i.email}</span></>}
                              title={`Revoke the invitation to ${i.email}?`}
                              body="The link stops working at once."
                              confirmLabel="Revoke"
                              disabled={!!busy}
                              onConfirm={() => void act(`revoke-${i.id}`, "/workspace/invitation/revoke", { invitationId: i.id }, `Invitation to ${i.email} revoked.`)}
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        )}

        {admin && (
          <Panel title="Two-step sign-in for this workspace" description="Required: everyone here must use an authenticator app; whoever has not set one up is asked to at their next sign-in, and nobody here can turn it off. You can also require it of one person in the list above.">
            <div className="flex flex-wrap items-end gap-3">
              <Field id="tf-policy" label="Two-step sign-in" className="w-56">
                <NativeSelect id="tf-policy" value={policy} onChange={(e) => setPolicy(e.target.value)}>
                  <option value="off">Not required</option>
                  <option value="required">Required</option>
                </NativeSelect>
              </Field>
              <Button
                type="button"
                disabled={!!busy || policy === (admin.twoFactorRequired ? "required" : "off")}
                onClick={() => void act("policy", "/workspace/two-factor-policy", { required: policy === "required" }, "Saved.")}
              >
                Save
              </Button>
            </div>
          </Panel>
        )}

        {may(me, "rename") && (
          <Panel title="Workspace">
            <form method="post" onSubmit={(e) => void saveName(e)} noValidate className="flex flex-wrap items-end gap-3">
              <div className="w-full"><Message id="rename-message" error={rename.formState.errors.root?.message} /></div>
              <Field id="ws-name" label="Name" className="min-w-64 flex-1" error={rename.formState.errors.name?.message}>
                <Input id="ws-name" autoComplete="off" {...rename.register("name")} {...describe("ws-name", { error: rename.formState.errors.name?.message })} />
              </Field>
              <Button type="submit" disabled={rename.formState.isSubmitting}>{rename.formState.isSubmitting ? "Saving…" : "Rename"}</Button>
            </form>
            {may(me, "delete") && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                <p className="text-sm text-secondary">Deleting removes everyone from it. It cannot be undone, and your only workspace cannot be deleted.</p>
                <ConfirmButton
                  label="Delete the workspace"
                  title={`Delete ${ws.name}?`}
                  body="Everyone loses access to it at once. Anyone for whom it was their last workspace gets a new one of their own."
                  confirmLabel="Delete"
                  disabled={!!busy}
                  onConfirm={async () => {
                    setError("");
                    const r = await call("/workspace/delete", { workspaceId: ws.id });
                    if (!r.ok) return setError(r.error);
                    router.push("/auth/workspaces");
                    router.refresh();
                  }}
                />
              </div>
            )}
          </Panel>
        )}
      </div>
    </main>
  );
}
