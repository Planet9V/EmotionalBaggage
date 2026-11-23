"use client";

// The banner of a "view as" session (src/lib/auth2/viewAs.ts), on every page while it lasts: who is being viewed,
// until when, and one button back to the administrator's own account. It asks the server only when the page can
// see the hint cookie the start left (no secret in it); the server's answer decides what is shown.
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

type Viewing = { name: string; email: string; endsAt: string | null; by: string };

const hinted = () => typeof document !== "undefined" && /(?:^|;\s*)c2r2_viewing=1(?:;|$)/.test(document.cookie);

export function ViewAsBanner() {
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!hinted()) return;
    let live = true;
    void fetch("/api/auth2/view-as/status", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { viewing: null }))
      .then((b: { viewing: Viewing | null }) => live && setViewing(b.viewing))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  if (!viewing) return null;
  const stop = async () => {
    setBusy(true);
    await fetch("/api/auth2/view-as/stop", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => undefined);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load: every part of the page starts again as the administrator
    window.location.assign("/admin?tab=users");
  };
  const until = viewing.endsAt ? new Date(viewing.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div role="region" aria-label="Viewing as another person" data-testid="view-as-banner" className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-3 bg-danger-solid px-4 py-2 text-sm font-medium text-white shadow-md">
      <p className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          You are viewing as {viewing.name} ({viewing.email}). Everything you change is recorded as {viewing.by || "you"} as this person.{until ? ` Ends at ${until}.` : ""}
        </span>
      </p>
      <button type="button" onClick={() => void stop()} disabled={busy} className="rounded-md border border-white/70 bg-white px-3 py-1 text-sm font-semibold text-danger hover:bg-white/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white">
        {busy ? "Stopping…" : "Stop"}
      </button>
    </div>
  );
}
