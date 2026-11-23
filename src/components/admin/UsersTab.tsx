"use client";

// Admin, Users (owner's rulings of 22 and 23 Nov): every account, searched and filtered, with all the platform
// administrator may do to one: create (an invitation, or a temporary password the administrator types), rename,
// change the address, confirm it, make or remove a platform administrator, disable, unlock, set a temporary password
// or send a reset link, two-step sign-in, end sessions, view as the person, and delete. Below: account invitations.
//
// Every change goes to /api/admin/users (src/lib/auth2/adminOps.ts checks and audits it). A link or one-time code the
// server hands back (no mail set up) is shown once here, and nowhere else. Passwords typed here are sent in the
// request body only; the app never makes or shows one.
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/ui/native-select";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks, SaveError } from "@/components/ui/states";
import { fmtDateTime } from "@/lib/format";
import { messageOf } from "@/lib/queries";
import { useSignInStatus } from "@/lib/admin/client";
import { DEFAULT_PASSWORD_POLICY, passwordChecklist, type PasswordPolicy } from "@/lib/auth2/passwordPolicy";
import {
  useAccountInvitations,
  useCreateUser,
  useDeleteUser,
  useInvitationAction,
  useUserAction,
  useUsers,
  type ChangeAnswer,
  type InvitationStatus,
  type UserAction,
  type UserFilter,
  type UserState,
} from "@/lib/admin/peopleClient";
import { ViewAsButton } from "./ViewAsButton";

const STATES = { "": "Any state", active: "Active", invited: "Invited", disabled: "Disabled", locked: "Locked", reset: "Asked for a reset" } as const;
const ROLES = { "": "Any role", admin: "Platform administrators", member: "Members" } as const;

/** The rules and whether mail is set up, from Admin, Sign-in (defaults while it loads). */
function useSignInFacts(): { policy: PasswordPolicy; mail: boolean } {
  const s = useSignInStatus();
  const d = s.data && "rules" in s.data ? s.data : null;
  return { policy: d?.rules.password ?? DEFAULT_PASSWORD_POLICY, mail: d?.detail.mail ?? false };
}

export function UsersTab() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<keyof typeof ROLES>("");
  const [state, setState] = useState<keyof typeof STATES>("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<UserState | null>(null);
  const filter: UserFilter = { q, role: role || undefined, state: state || undefined, page };
  const list = useUsers(filter);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <Panel
        title="Users"
        description="Every account on this installation. A platform administrator can do everything here, without any email being sent. Changes to another platform administrator ask for your own password again."
        actions={<Button size="sm" onClick={() => setAdding(true)}>Add a person</Button>}
      >
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Field id="users-q" label="Search by name or address">
            <Input id="users-q" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </Field>
          <Field id="users-role" label="Role">
            <NativeSelect id="users-role" value={role} onChange={(e) => { setRole(e.target.value as keyof typeof ROLES); setPage(1); }}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </Field>
          <Field id="users-state" label="State">
            <NativeSelect id="users-state" value={state} onChange={(e) => { setState(e.target.value as keyof typeof STATES); setPage(1); }}>
              {Object.entries(STATES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </Field>
        </div>
        {list.isPending ? (
          <LoadingBlocks rows={3} label="Reading the accounts" />
        ) : list.isError ? (
          <LoadError what="The accounts" message={messageOf(list.error)} onRetry={() => void list.refetch()} />
        ) : list.data.users.length === 0 ? (
          <EmptyState>No account matches.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-hairline">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Who</TableHead>
                    <TableHead className="w-48">Role</TableHead>
                    <TableHead className="min-w-56">State</TableHead>
                    <TableHead className="w-24">Workspaces</TableHead>
                    <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.users.map((u) => (
                    <TableRow key={u.id} className="align-top" data-testid={`user-${u.id}`}>
                      <TableCell className="align-top text-sm">
                        <span className="block font-medium text-primary wrap-anywhere">{u.name}</span>
                        <span className="block text-xs text-secondary wrap-anywhere">{u.email}</span>
                      </TableCell>
                      <TableCell className="align-top">{u.platformAdmin ? <StatusBadge tone="info">Platform administrator</StatusBadge> : <span className="text-sm text-secondary">Member</span>}</TableCell>
                      <TableCell className="align-top"><StateBadges u={u} /></TableCell>
                      <TableCell className="align-top font-mono text-sm text-secondary">{u.workspaces}</TableCell>
                      <TableCell className="align-top">
                        <Button size="sm" variant="outline" aria-label={`Manage ${u.email}`} onClick={() => setOpen(u)}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <nav aria-label="Pages of accounts" className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span role="status" className="text-xs text-muted">{list.data.total} {list.data.total === 1 ? "account" : "accounts"}, page {page} of {pages}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous page</Button>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next page</Button>
              </span>
            </nav>
          </>
        )}
      </Panel>
      <InvitationsPanel />
      {adding ? <AddPerson onClose={() => setAdding(false)} /> : null}
      {open ? <ManageUser user={(list.data?.users.find((x) => x.id === open.id)) ?? open} self={open.id === list.data?.me} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

/** What is true of an account, each as a word (never colour alone). */
function StateBadges({ u }: { u: UserState }) {
  const items: [string, "neutral" | "info" | "success" | "warning" | "danger"][] = [];
  if (u.disabled) items.push(["Disabled", "danger"]);
  else if (u.state === "invited") items.push([u.invitation?.status === "expired" ? "Invitation expired" : "Invited", u.invitation?.status === "expired" ? "warning" : "info"]);
  else items.push(["Active", "success"]);
  if (u.lockedUntil) items.push([u.lockedUntil === "until-unlocked" ? "Locked until unlocked" : `Locked until ${fmtDateTime(u.lockedUntil)}`, "danger"]);
  if (!u.confirmed && u.state !== "invited") items.push(["Address not confirmed", "warning"]);
  if (u.resetRequestedAt) items.push([`Asked for a reset ${fmtDateTime(u.resetRequestedAt)}`, "warning"]);
  if (u.mustChangePassword) items.push(["Must change password", "neutral"]);
  if (u.twoFactor) items.push(["Two-step on", "success"]);
  else if (u.twoFactorRequired) items.push(["Two-step required", "warning"]);
  return (
    <span className="flex flex-wrap gap-1">
      {items.map(([t, tone]) => <StatusBadge key={t} tone={tone}>{t}</StatusBadge>)}
    </span>
  );
}

/** A link or code shown once, with a copy button and the plain note. */
function ShownOnce({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div role="status" className="space-y-2 rounded-md border border-hairline bg-canvas p-3">
      <p className="text-sm text-primary">{note}</p>
      <p className="break-all font-mono text-xs text-primary" aria-label={label}>{value}</p>
      <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(value).then(() => toast.success("Copied."))}>
        <Copy className="h-3.5 w-3.5" aria-hidden /> Copy {label.toLowerCase()}
      </Button>
    </div>
  );
}

function PasswordInput({ id, label, value, onChange, policy, who, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; policy?: PasswordPolicy; who?: { email?: string; name?: string }; hint?: string }) {
  return (
    <div className="space-y-1">
      <Field id={id} label={label} hint={hint}>
        <Input id={id} type="password" autoComplete={policy ? "new-password" : "current-password"} value={value} onChange={(e) => onChange(e.target.value)} {...describe(id, { hint: !!hint })} />
      </Field>
      {policy && value ? (
        <ul aria-label="Password rules" className="space-y-0.5 text-xs text-secondary">
          {passwordChecklist(policy, value, who).map((r) => <li key={r.key} className={r.met ? "text-success" : ""}>{r.met === null ? "" : r.met ? "Done: " : "Not yet: "}{r.label}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function AddPerson({ onClose }: { onClose: () => void }) {
  const { policy, mail } = useSignInFacts();
  const create = useCreateUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [how, setHow] = useState<"invite" | "password">("invite");
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(true);
  const [stepUp, setStepUp] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    create.mutate(
      { name, email, platformAdmin: admin, how, ...(how === "password" ? { password, markVerified: verified } : {}), ...(admin ? { stepUp } : {}) },
      {
        onSuccess: (r) => {
          setPassword("");
          setStepUp("");
          setDone(true);
          if (r.invitation?.link) setLink(r.invitation.link);
          else toast.success(how === "invite" ? `The invitation is on its way to ${email}.` : `The account ${email} is made.`);
          if (!r.invitation?.link) onClose();
        },
        onError: (err) => setError(messageOf(err)),
      }
    );
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Add a person" description="An account with a workspace of its own." wide>
      {done && link ? (
        <ShownOnce label="Invitation link" value={link} note="No email was sent: mail is not set up. Give this link to the person; it works once, until it expires, and is shown only now. It is in no log." />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="add-name" label="Name"><Input id="add-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field id="add-email" label="Email address"><Input id="add-email" type="email" autoCapitalize="none" spellCheck={false} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-primary">Role</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="add-role" checked={!admin} onChange={() => setAdmin(false)} /> Member</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="add-role" checked={admin} onChange={() => setAdmin(true)} /> Platform administrator (full power over this installation)</label>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-primary">How they get in</legend>
            <label className="flex items-start gap-2 text-sm"><input type="radio" name="add-how" className="mt-1" checked={how === "invite"} onChange={() => setHow("invite")} /> <span>Send an invitation: they choose their own password. {mail ? "It is emailed." : "Mail is not set up, so you get a link to hand over."}</span></label>
            <label className="flex items-start gap-2 text-sm"><input type="radio" name="add-how" className="mt-1" checked={how === "password"} onChange={() => setHow("password")} /> <span>Set a temporary password that you type: no email is sent, and they must change it at their first sign-in.</span></label>
          </fieldset>
          {how === "password" ? (
            <div className="space-y-2 rounded-md border border-hairline p-3">
              <PasswordInput id="add-password" label="Temporary password" value={password} onChange={setPassword} policy={policy} who={{ email, name }} hint="You type it and give it to them yourself. The app never makes or shows one." />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Mark the address as confirmed (no email is sent)</label>
            </div>
          ) : null}
          {admin ? <PasswordInput id="add-stepup" label="Your own password" value={stepUp} onChange={setStepUp} hint="Needed to make someone a platform administrator." /> : null}
          {error ? <SaveError message={error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Adding…" : how === "invite" ? "Send the invitation" : "Create the account"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-hairline pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {children}
    </section>
  );
}

function ManageUser({ user: u, self, onClose }: { user: UserState; self: boolean; onClose: () => void }) {
  const { policy, mail } = useSignInFacts();
  const act = useUserAction();
  const remove = useDeleteUser();
  const [error, setError] = useState("");
  const [shown, setShown] = useState<{ label: string; value: string; note: string } | null>(null);
  const [name, setName] = useState(u.name);
  const [email, setEmail] = useState(u.email);
  const [markVerified, setMarkVerified] = useState(false);
  const [temp, setTemp] = useState("");
  const [stepUp, setStepUp] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleteShared, setDeleteShared] = useState(false);
  const needsStepUp = u.platformAdmin && !self;

  const run = (change: UserAction, done: (r: ChangeAnswer) => void) => {
    setError("");
    act.mutate(
      { id: u.id, change: { ...change, ...(stepUp ? { stepUp } : {}) } },
      { onSuccess: (r) => { setTemp(""); done(r); }, onError: (e) => setError(messageOf(e)) }
    );
  };
  const ok = (m: string) => () => toast.success(m);

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={u.name} description={u.email} wide>
      <div className="space-y-4">
        <StateBadges u={u} />
        <PasswordInput id="manage-stepup" label="Your own password" value={stepUp} onChange={setStepUp} hint={needsStepUp ? "This is another platform administrator: every change here asks for your own password." : "Needed only to make this person a platform administrator or to view as them."} />
        {error ? <ErrorLine>{error}</ErrorLine> : null}
        {shown ? <ShownOnce {...shown} /> : null}

        <Section title="Name and address">
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run({ action: "rename", name }, ok("The name is changed.")); }}>
            <Field id="manage-name" label="Name"><Input id="manage-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Button type="submit" size="sm" variant="outline" disabled={act.isPending || name === u.name}>Save the name</Button>
          </form>
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run({ action: "email", email, markVerified }, (r) => toast.success(markVerified ? "The address is changed and marked confirmed." : r.confirmationSent ? "The address is changed; a confirmation link was sent to it." : "The address is changed. It is not confirmed yet: no mail is set up, so confirm it here.")); }}>
            <div className="flex flex-wrap items-end gap-2">
              <Field id="manage-email" label="Email address"><Input id="manage-email" type="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Button type="submit" size="sm" variant="outline" disabled={act.isPending || email.trim().toLowerCase() === u.email.toLowerCase()}>Change the address</Button>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={markVerified} onChange={(e) => setMarkVerified(e.target.checked)} /> Mark the new address as confirmed (no email is sent)</label>
            <p className="text-xs text-secondary">Changing the address signs the person out everywhere.</p>
          </form>
          {!u.confirmed && u.state !== "invited" ? <Button size="sm" variant="outline" onClick={() => run({ action: "confirm" }, ok("The address is confirmed; no email was sent."))}>Confirm the address without email</Button> : null}
        </Section>

        <Section title="Role and access">
          <div className="flex flex-wrap gap-2">
            <ConfirmButton
              label={u.platformAdmin ? "Remove platform administrator" : "Make platform administrator"}
              title={u.platformAdmin ? "Stop being a platform administrator?" : "Make this person a platform administrator?"}
              body={u.platformAdmin ? `${u.email} keeps the account and its workspaces, without the Admin area. The last platform administrator cannot lose the role.` : `${u.email} gets full power over this installation: every account, workspace and setting. Your own password is needed above.`}
              confirmLabel={u.platformAdmin ? "Remove the role" : "Make administrator"}
              onConfirm={() => run({ action: "admin", on: !u.platformAdmin }, ok(u.platformAdmin ? "The role is removed." : "The person is a platform administrator."))}
            />
            {!self ? (
              <ConfirmButton
                label={u.disabled ? "Enable the account" : "Disable the account"}
                title={u.disabled ? "Enable this account?" : "Disable this account?"}
                body={u.disabled ? "The person can sign in again." : "The person is signed out everywhere and cannot sign in until the account is enabled again. Nothing is deleted."}
                confirmLabel={u.disabled ? "Enable" : "Disable"}
                onConfirm={() => run({ action: "disabled", on: !u.disabled }, ok(u.disabled ? "The account is enabled." : "The account is disabled."))}
              />
            ) : null}
            {u.lockedUntil ? <Button size="sm" variant="outline" onClick={() => run({ action: "unlock" }, ok("Unlocked."))}>Unlock</Button> : null}
            <Button size="sm" variant="outline" onClick={() => run({ action: "end-sessions" }, (r) => toast.success(`Signed out of ${r.ended ?? 0} ${r.ended === 1 ? "browser" : "browsers"}.`))}>End all sessions ({u.sessions})</Button>
            {!u.platformAdmin && !u.disabled && u.state === "active" ? <ViewAsButton userId={u.id} name={u.name} email={u.email} stepUp={stepUp} /> : null}
          </div>
        </Section>

        <Section title="Password">
          {u.state === "invited" || !u.hasPassword ? (
            <div className="space-y-1">
              <p className="text-sm text-secondary">{u.invitation ? `Invitation ${u.invitation.status}, until ${fmtDateTime(u.invitation.expiresAt)}.` : "No password yet."}</p>
              <Button size="sm" variant="outline" onClick={() => run({ action: "invite-again" }, (r) => (r.link ? setShown({ label: "Invitation link", value: r.link, note: "No email was sent: mail is not set up. Give this link to the person; it works once, until it expires, and is shown only now." }) : toast.success("A new invitation is on its way.")))}>Send a new invitation</Button>
            </div>
          ) : null}
          {u.resetRequestedAt ? <p className="text-sm text-warning">Asked for a reset on {fmtDateTime(u.resetRequestedAt)}, while no mail was set up. Set a temporary password and give it to them.</p> : null}
          {mail && u.hasPassword ? <Button size="sm" variant="outline" onClick={() => run({ action: "reset-link" }, (r) => toast.success(r.sent ? "A reset link was emailed." : "Mail is not set up: no link was sent."))}>Email a reset link</Button> : null}
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run({ action: "password", password: temp }, ok("The temporary password is set; they must change it at their next sign-in.")); }}>
            <PasswordInput id="manage-temp" label="Set a temporary password" value={temp} onChange={setTemp} policy={policy} who={{ email: u.email, name: u.name }} hint="You type it and give it to them. They are signed out and must choose their own at the next sign-in." />
            <Button type="submit" size="sm" variant="outline" disabled={act.isPending || !temp}>Set the temporary password</Button>
          </form>
        </Section>

        <Section title="Two-step sign-in">
          <p className="text-sm text-secondary">{u.twoFactor ? "Set up with an authenticator app." : "Not set up."} {u.twoFactorRequired ? "Required by a platform administrator." : ""}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => run({ action: "two-factor-required", on: !u.twoFactorRequired }, ok(u.twoFactorRequired ? "No longer required." : "Required at the next sign-in."))}>{u.twoFactorRequired ? "Stop requiring it" : "Require it at the next sign-in"}</Button>
            {u.twoFactor ? (
              <>
                <ConfirmButton label="Reset it" title="Reset two-step sign-in?" body="The authenticator app and recovery codes are removed and the person is signed out. They set it up again with a one-time code shown to you now (or a link emailed to them)." confirmLabel="Reset" onConfirm={() => run({ action: "two-factor-reset" }, (r) => r.code && setShown({ label: "One-time code", value: r.code, note: "Give this code to the person. With their password it lets them set up two-step sign-in again at /auth/re-enrol. It works once, for 24 hours, and is shown only now." }))} />
                <ConfirmButton label="Turn it off" title="Turn two-step sign-in off?" body="The authenticator app and recovery codes are removed, the requirement is lifted and the person is signed out. A workspace that requires it will still ask at the next sign-in." confirmLabel="Turn off" onConfirm={() => run({ action: "two-factor-off" }, ok("Two-step sign-in is off."))} />
              </>
            ) : null}
          </div>
        </Section>

        {!self ? (
          <Section title="Delete the account">
            <p className="text-sm text-secondary">
              The account goes, with its own workspace and that workspace&rsquo;s concepts when nobody else is in it. A workspace others work in that only this person owns blocks the deletion: make someone else its owner in Workspaces first, or tick below to delete those too. Workspaces others also own stay. The audit log keeps what was done.
            </p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={deleteShared} onChange={(e) => setDeleteShared(e.target.checked)} /> Also delete workspaces others work in that only this person owns</label>
            <Field id="manage-delete" label={`Type ${u.email} to confirm`}>
              <Input id="manage-delete" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} />
            </Field>
            <Button
              size="sm"
              variant="destructive"
              disabled={remove.isPending || confirmDelete.trim().toLowerCase() !== u.email.toLowerCase()}
              onClick={() => {
                setError("");
                remove.mutate({ id: u.id, confirmEmail: confirmDelete, deleteWorkspaces: deleteShared, ...(stepUp ? { stepUp } : {}) }, { onSuccess: () => { toast.success(`${u.email} is deleted.`); onClose(); }, onError: (e) => setError(messageOf(e)) });
              }}
            >
              Delete the account
            </Button>
          </Section>
        ) : <p className="text-xs text-muted">This is your own account: you cannot disable or delete it here.</p>}
      </div>
    </Modal>
  );
}

function InvitationsPanel() {
  const [status, setStatus] = useState<InvitationStatus | "">("pending");
  const list = useAccountInvitations(status || undefined);
  const act = useInvitationAction();
  const [error, setError] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const run = (id: string, action: "resend" | "revoke") => {
    setError("");
    setLink(null);
    act.mutate({ id, action }, { onSuccess: (r) => (r.link ? setLink(r.link) : toast.success(action === "resend" ? "Sent again with a new link." : "Revoked: the link no longer works.")), onError: (e) => setError(messageOf(e)) });
  };
  return (
    <Panel title="Invitations" description="Invitations to create an account. Each works once, until it expires (Admin, Sign-in sets how many days; 7 by default). Sending one again makes a new link and the old one stops working.">
      <div className="mb-3 max-w-xs">
        <Field id="inv-status" label="Show">
          <NativeSelect id="inv-status" value={status} onChange={(e) => setStatus(e.target.value as InvitationStatus | "")}>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
            <option value="accepted">Accepted</option>
            <option value="revoked">Revoked</option>
            <option value="">All</option>
          </NativeSelect>
        </Field>
      </div>
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      {link ? <ShownOnce label="Invitation link" value={link} note="No email was sent: mail is not set up. Give this link to the person; it is shown only now." /> : null}
      {list.isPending ? (
        <LoadingBlocks rows={2} label="Reading the invitations" />
      ) : list.isError ? (
        <LoadError what="The invitations" message={messageOf(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState>None.</EmptyState>
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline">
          {list.data.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" data-testid={`invitation-${i.id}`}>
              <span className="min-w-0">
                <span className="block font-medium text-primary wrap-anywhere">{i.name} <span className="font-normal text-secondary">{i.email}</span></span>
                <span className="block text-xs text-muted">
                  {i.status === "pending" ? `Expires ${fmtDateTime(i.expiresAt)}` : i.status === "expired" ? `Expired ${fmtDateTime(i.expiresAt)}` : i.status === "accepted" ? "Accepted" : "Revoked"}
                  {` · sent ${i.sends} ${i.sends === 1 ? "time" : "times"}${i.mailed ? " by email" : ", link handed over"} · by ${i.invitedBy}`}
                </span>
              </span>
              {i.status === "pending" || i.status === "expired" ? (
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => run(i.id, "resend")}>Send again<span className="sr-only"> to {i.email}</span></Button>
                  <Button size="sm" variant="outline" onClick={() => run(i.id, "revoke")}>Revoke<span className="sr-only"> the invitation for {i.email}</span></Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
