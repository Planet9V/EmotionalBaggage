"use client";

import { Check, Circle, Info } from "lucide-react";
import { passwordChecklist, type PasswordOwner, type PasswordPolicy } from "@/lib/auth2/passwordPolicy";

/**
 * The password rules in force, shown under a new-password field and ticked off as the person types (the same rules
 * the server checks: src/lib/auth2/passwordPolicy.ts). Announced politely, once per change of state, not per key.
 */
export function PasswordChecklist({ id, policy, value, who }: { id: string; policy: PasswordPolicy; value: string; who?: PasswordOwner }) {
  const items = passwordChecklist(policy, value, who);
  return (
    <ul id={id} aria-label="Password rules" className="space-y-1 text-xs text-secondary" data-testid="password-checklist">
      {items.map((r) => (
        <li key={r.key} className={`flex items-start gap-1.5 ${r.met ? "text-success" : ""}`} data-met={r.met === null ? "server" : String(r.met)}>
          {r.met === null ? <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> : r.met ? <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> : <Circle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span>
            {r.label}
            <span className="sr-only">{r.met === null ? "" : r.met ? ": done" : ": not yet"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
