"use client";

import { useEffect, useId, useState } from "react";

/**
 * Mermaid's colours from the Eigenia tokens of the theme in use (globals.css), read when a diagram is drawn
 * and again when the theme changes. Mermaid works its derived colours out from hex values, so the tokens are
 * read as the page computes them rather than passed as var() references. Edge labels sit on the surface
 * colour with the primary text colour, which clears 4.5:1 in both themes.
 */
export function mermaidThemeVariables(css: (name: string) => string) {
  const surface = css("--bg-surface");
  const subtle = css("--bg-subtle");
  const text = css("--text-primary");
  const secondary = css("--text-secondary");
  const line = css("--text-muted");
  const hairline = css("--border-hairline");
  const accent = css("--link");
  return {
    darkMode: false,
    background: surface,
    fontFamily: "inherit",
    primaryColor: subtle,
    primaryTextColor: text,
    primaryBorderColor: accent,
    secondaryColor: surface,
    secondaryTextColor: text,
    secondaryBorderColor: hairline,
    tertiaryColor: surface,
    tertiaryTextColor: text,
    tertiaryBorderColor: hairline,
    lineColor: line,
    textColor: text,
    mainBkg: subtle,
    nodeBorder: accent,
    nodeTextColor: text,
    clusterBkg: surface,
    clusterBorder: hairline,
    titleColor: text,
    edgeLabelBackground: surface,
    labelTextColor: text,
    labelBackground: surface,
    // sequence and ER diagrams
    actorBkg: subtle,
    actorBorder: accent,
    actorTextColor: text,
    actorLineColor: line,
    signalColor: secondary,
    signalTextColor: text,
    noteBkgColor: subtle,
    noteTextColor: text,
    noteBorderColor: hairline,
    attributeBackgroundColorOdd: surface,
    attributeBackgroundColorEven: subtle,
  };
}

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
        const style = getComputedStyle(document.documentElement);
        const vars = mermaidThemeVariables((name) => style.getPropertyValue(name).trim());
        vars.darkMode = document.documentElement.classList.contains("dark");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: vars, fontFamily: "inherit" });
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
      <figure className="my-6">
        <figcaption className="sr-only">Diagram source</figcaption>
        <pre className="overflow-x-auto rounded-xl border border-hairline bg-subtle p-4 font-mono text-xs text-secondary">{chart}</pre>
      </figure>
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
