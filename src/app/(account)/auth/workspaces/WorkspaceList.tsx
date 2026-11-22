"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EYEBROW, Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/auth2/client";
import type { Role } from "@/lib/auth2/workspaces/permissions";
import { TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";

type Workspace = { id: string; name: string; role: Role };

const ROLE_WORDS: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };

const createSchema = z.object({ name: z.string().trim().min(1, "Enter a name for the workspace.").max(100, "Keep the workspace name to 100 characters.") });

/** The list with Switch and Leave on each row, and a form for a new workspace. A full reload follows each change. */
export function WorkspaceList({ active, workspaces }: { active: string; workspaces: Workspace[] }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<{ name: string }>({ resolver: zodResolver(createSchema), defaultValues: { name: "" } });

  const act = async (key: string, path: string, body: unknown) => {
    setBusy(key);
    setError("");
    const r = await call(path, body);
    if (!r.ok) {
      setBusy("");
      return setError(r.error);
    }
    window.location.reload();
  };

  const create = handleSubmit(async (v) => {
    const r = await call("/workspace/create", { name: v.name });
    if (!r.ok) return setFieldError("root", { message: r.error });
    window.location.reload();
  });

  const only = workspaces.length <= 1;
  return (
    <div className="space-y-6">
      <Message id="workspaces-message" error={error} />
      <ul className="divide-y divide-hairline rounded-md border border-hairline">
        {workspaces.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary">{w.name}</p>
              <p className="text-xs text-secondary">
                {ROLE_WORDS[w.role]}
                {w.id === active ? " · open now" : ""}
              </p>
            </div>
            {w.id === active ? (
              <TextLink href="/auth/workspace">{w.role === "member" ? "Members" : "Members and settings"}</TextLink>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => void act(`switch-${w.id}`, "/workspace/set-active", { workspaceId: w.id })}>
                {busy === `switch-${w.id}` ? "Switching…" : <>Switch{" "}<span className="sr-only">to {w.name}</span></>}
              </Button>
            )}
            {!only && (
              <Button type="button" size="sm" variant="ghost" disabled={!!busy} onClick={() => void act(`leave-${w.id}`, "/workspace/leave", { workspaceId: w.id })}>
                {busy === `leave-${w.id}` ? "Leaving…" : <>Leave{" "}<span className="sr-only">{w.name}</span></>}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {only && <p className="text-sm text-secondary">This is your only workspace. Every account keeps at least one, so it cannot be left.</p>}
      <form method="post" onSubmit={(e) => void create(e)} noValidate className="space-y-3" aria-labelledby="new-ws-h">
        <h2 id="new-ws-h" className={EYEBROW}>New workspace</h2>
        <Message id="new-ws-message" error={errors.root?.message} />
        <Field id="new-ws-name" label="Name" error={errors.name?.message}>
          <Input id="new-ws-name" autoComplete="off" {...register("name")} {...describe("new-ws-name", { error: errors.name?.message })} />
        </Field>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Create the workspace"}</Button>
      </form>
    </div>
  );
}
