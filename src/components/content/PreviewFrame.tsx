"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { messageOf } from "@/lib/queries";

type Preview = { html: string; problems: string[]; sections: number };

/** The landing page as a visitor would see it, behind sign-in. It is not published anywhere. */
export function PreviewFrame({ id }: { id: string }) {
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    // The shell is not drawn here, so apply the stored theme to the page chrome and start the preview in it.
    const d = window.localStorage.getItem("c2r.theme") === "dark";
    document.documentElement.classList.toggle("dark", d);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the stored theme on mount
    setScheme(d ? "dark" : "light");
  }, []);
  const q = useQuery({ queryKey: ["landing-page", id, scheme], queryFn: () => api<Preview>(`/api/content/landing/preview?projectId=${encodeURIComponent(id)}&scheme=${scheme}`) });
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-surface px-4 py-2 text-sm">
        <h1 className="sr-only">Landing page preview</h1>
        <p className="text-secondary">
          <span className="font-semibold text-primary">Public preview, not published.</span> Only people signed in to this workbench can open this address. Export a zip from the Landing page section to host it.
        </p>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Preview colours" className="flex gap-1">
            {(["light", "dark"] as const).map((m) => (
              <Button key={m} size="sm" variant={scheme === m ? "default" : "outline"} aria-pressed={scheme === m} onClick={() => setScheme(m)}>{m === "light" ? "Light" : "Dark"}</Button>
            ))}
          </div>
          <Link href="/s/marketing/landing" className="text-link hover:underline">Back to the editor</Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        {q.isPending ? (
          <p role="status" className="p-6 text-sm text-secondary">Drawing the page.</p>
        ) : q.isError ? (
          <p role="alert" className="p-6 text-sm text-danger">{messageOf(q.error)}</p>
        ) : q.data.sections === 0 ? (
          <p className="p-6 text-sm text-secondary">This concept has no landing page sections yet. Draft them in the Landing page section.</p>
        ) : (
          <iframe title="Landing page" sandbox="allow-scripts" srcDoc={q.data.html} className="w-full flex-1 border-0 bg-white" style={{ minHeight: "calc(100vh - 56px)" }} />
        )}
      </main>
    </div>
  );
}
