"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, TriangleAlert, UserRound } from "lucide-react";
import { api } from "@/lib/http";
import { meQuery } from "./me";

/**
 * The bottom of the sidebar: who is signed in, a Sign out button, and while the published default
 * password is still in use a one-line warning that links to the change-password form.
 * `linkClass` is the shell's own class for its sidebar rows, so these rows look the same.
 */
export function SessionControls({ linkClass }: { linkClass: string }) {
  const me = useQuery(meQuery()).data ?? null;
  const [leaving, setLeaving] = useState(false);

  const signOut = async () => {
    setLeaving(true);
    try {
      await api("/api/auth/sign-out", { method: "POST" });
    } catch {
      // Signed out or not, the sign-in page is the right place to go next.
    }
    // A full page load drops every cached answer of the session that just ended.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full reload
    window.location.assign("/sign-in");
  };

  if (!me) return null;
  return (
    <>
      {me.usingDefaultPassword && (
        <Link href="/account" className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-warning hover:bg-subtle">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden /> Change the default password
        </Link>
      )}
      <Link href="/account" className={linkClass} title="Account">
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate">{me.username}</span>
      </Link>
      <button type="button" onClick={signOut} disabled={leaving} className={`${linkClass} w-full`}>
        <LogOut className="h-3.5 w-3.5" aria-hidden /> {leaving ? "Signing out…" : "Sign out"}
      </button>
    </>
  );
}
