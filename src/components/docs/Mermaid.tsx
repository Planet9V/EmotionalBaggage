"use client";

import { useEffect, useId, useState } from "react";

/** Draws one Mermaid diagram. The library is loaded only on pages that have a diagram. */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const draw = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dark = document.documentElement.classList.contains("dark");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral", fontFamily: "inherit" });
        const out = await mermaid.render(`m${id}`, chart);
        if (alive) setSvg(out.svg);
      } catch {
        if (alive) setFailed(true);
      }
    };
    void draw();
    const watch = new MutationObserver(() => void draw());
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      alive = false;
      watch.disconnect();
    };
  }, [chart, id]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-hairline bg-subtle p-4 font-mono text-xs text-secondary" aria-label="Diagram source">
        {chart}
      </pre>
    );
  }
  return (
    <figure
      className="my-6 overflow-x-auto rounded-xl border border-hairline bg-surface p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      role="img"
      aria-label="Diagram"
      data-testid="mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
