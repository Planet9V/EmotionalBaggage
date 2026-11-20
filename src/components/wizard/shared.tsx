"use client";

import Link from "next/link";
import { Plug } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

/** Shown when an integration key is missing. Says what the view does and what it needs. */
export function NotConnected({ title, does, envVar }: { title: string; does: string; envVar: string }) {
  return (
    <Card hoverEffect={false} innerClassName="p-[26px]" className="max-w-2xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Not connected</p>
      <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-primary">{title}</h2>
      <p className="mt-2 text-sm text-secondary">{does}</p>
      <p className="mt-3 text-sm text-secondary">
        It needs <code className="rounded-md bg-subtle px-1.5 py-0.5 font-mono text-xs text-primary">{envVar}</code> in the
        server environment. Set it, restart the app, and this page switches on. Nothing is faked until then.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href="/integrations"><Plug className="h-3.5 w-3.5" aria-hidden /> Open integrations</Link>
      </Button>
    </Card>
  );
}

export function stamp(iso: string | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
