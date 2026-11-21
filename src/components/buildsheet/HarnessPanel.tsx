"use client";

/**
 * The harness drawing: the planner runs WireViz (a separate program) on the wires and connectors
 * and returns an SVG and a bill of materials. Cable lengths on it are routed lengths only.
 */
import { useMemo, useState } from "react";
import { Download, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import type { HarnessOutcome } from "@/lib/geometry/harness";

type State = { state: "idle" } | { state: "running" } | { state: "done"; out: HarnessOutcome; ms: number } | { state: "error"; message: string };

function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function HarnessPanel({ projectId }: { projectId: string }) {
  const [s, setS] = useState<State>({ state: "idle" });
  // The SVG is shown through an <img>, so nothing inside it can run.
  const src = useMemo(() => (s.state === "done" ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.out.svg)}` : ""), [s]);

  const draw = async () => {
    setS({ state: "running" });
    const t0 = performance.now();
    try {
      const out = await api<HarnessOutcome>(`/api/projects/${encodeURIComponent(projectId)}/harness`, { method: "POST", body: "{}" });
      setS({ state: "done", out, ms: performance.now() - t0 });
    } catch (e) {
      setS({ state: "error", message: (e as Error).message });
    }
  };

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void draw()} disabled={s.state === "running"}>
          <Network className="h-3.5 w-3.5" aria-hidden /> {s.state === "running" ? "Drawing" : s.state === "done" ? "Draw again" : "Draw the harness"}
        </Button>
        {s.state === "done" && (
          <>
            <Button variant="outline" size="sm" onClick={() => save(`${projectId}-harness.svg`, s.out.svg, "image/svg+xml")}>
              <Download className="h-3.5 w-3.5" aria-hidden /> Download SVG
            </Button>
            <Button variant="ghost" size="sm" onClick={() => save(`${projectId}-harness.yml`, s.out.yaml, "text/yaml")}>
              <Download className="h-3.5 w-3.5" aria-hidden /> WireViz YAML
            </Button>
          </>
        )}
      </div>
      {s.state === "idle" && <p className="text-xs text-secondary">Draws every wire between its two connectors, with the pin names and the suggested colours, using WireViz in the planner service.</p>}
      {s.state === "running" && <p role="status" className="text-xs text-muted">Drawing the harness.</p>}
      {s.state === "error" && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {s.message}
        </p>
      )}
      {s.state === "done" && (
        <>
          <p role="status" className="text-xs text-secondary">
            Drawn in {s.out.seconds.toFixed(2)} s by {s.out.wireviz || "WireViz"}, run as a separate program. {s.out.withLength} wire{s.out.withLength === 1 ? "" : "s"} carry a routed length
            {s.out.withoutLength > 0 ? `; ${s.out.withoutLength} ${s.out.withoutLength === 1 ? "has" : "have"} none because ${s.out.withoutLength === 1 ? "it is" : "they are"} not routed, or the route is out of date (route them in the 3D model)` : ""}.
          </p>
          {s.out.problems.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-warning">
              {s.out.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {src && (
            <div className="overflow-auto rounded-xl border border-hairline bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Wiring harness drawing: connectors, pins and the wires between them" className="mx-auto h-auto max-w-full" />
            </div>
          )}
          {s.out.bom.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Harness bill of materials from WireViz</caption>
                <thead>
                  <tr className="text-muted">
                    {Object.keys(s.out.bom[0]).map((h) => (
                      <th key={h} scope="col" className="px-3 py-1.5 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.out.bom.map((r, i) => (
                    <tr key={i} className="border-t border-hairline">
                      {Object.keys(s.out.bom[0]).map((h) => (
                        <td key={h} className="px-3 py-1.5 font-mono">{r[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
