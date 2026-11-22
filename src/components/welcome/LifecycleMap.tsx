"use client";

// "The whole trip on one map". The server renders the content as an ordered list in a box of the map's height;
// once the page runs, the React Flow map (LifecycleFlow, loaded on its own so the first screen does not wait for
// it) takes the box and the list stays for screen readers. With no script the list is the map.
import dynamic from "next/dynamic";
import { useHydrated, useWide } from "./useAnimated";
import { MAP, MAP_LABEL as LABEL } from "./content";

const LifecycleFlow = dynamic(() => import("./LifecycleFlow"), { ssr: false });

/** The same content as a list: what the server sends, what a screen reader gets, and all there is without script. */
function AsList({ hidden }: { hidden: boolean }) {
  return (
    <ol className={hidden ? "sr-only" : "grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4"}>
      {MAP.stages.map((s) => (
        <li key={s.key}>
          <span className="font-mono text-xs text-link">{s.n}</span> <span className="font-semibold text-primary">{s.name}</span>
          <ul className="mt-1 space-y-0.5 text-secondary">
            {s.makes.map(([id, label]) => {
              const to = MAP.feeds.filter(([a]) => a === id).map(([, b]) => LABEL.get(b)!.toLowerCase());
              return <li key={id}>{to.length ? `${label}, which feeds the ${to.join(" and the ")}` : label}</li>;
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function LifecycleMap() {
  const ready = useHydrated();
  const wide = useWide();
  return (
    <div className="min-h-[788px] lg:min-h-[300px]">
      {ready ? <LifecycleFlow key={wide ? "wide" : "tall"} tall={!wide} /> : null}
      <AsList hidden={ready} />
    </div>
  );
}

