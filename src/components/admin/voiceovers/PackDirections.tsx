"use client";

// The bag's recommended lines for each sensed moment, directed for voice packs to be made later. Read only.
import { Panel } from "@/components/ui/panel";
import { PACK_DIRECTIONS } from "@/components/welcome/scenes/voiceDirections";

export function PackDirections() {
  return (
    <Panel title="Directions for the voice packs" description="The bag's three recommended lines for each sensed moment (docs/design/baggage-claims-lines.md), directed the same way, so packs can be recorded later. Nothing here is generated yet.">
      <details>
        <summary className="cursor-pointer text-sm text-secondary">Show the {PACK_DIRECTIONS.length} lines</summary>
        <ul className="mt-3 divide-y divide-hairline">
          {PACK_DIRECTIONS.map((p) => (
            <li key={p.id} className="space-y-1 py-3">
              <p className="text-sm text-primary">
                <span className="mr-2 font-mono text-xs text-muted">{p.id}</span>
                <span className="mr-2 text-xs text-secondary">{p.moment}</span>&ldquo;{p.text}&rdquo;
              </p>
              <p className="max-w-[90ch] text-xs leading-relaxed text-secondary">{p.direction}</p>
              <p className="font-mono text-xs text-muted wrap-anywhere">{p.inlineTags}</p>
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}
