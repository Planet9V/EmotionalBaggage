"use client";

// The proof, as one showcase: the worked example in two groups, Make it (the engineering stage, six live views)
// and Sell it (the market stage, seven views), behind one switch. Each group is the stage it always was, with its
// own tabs; only one is on the page at a time, so the engineering views still load lazily as the stage nears the
// window and nothing of the market stage is drawn until it is asked for. Without script the switch cannot change:
// Make it is open, with its own no-script stills, and the Sell it views are set out under it.
import { useState } from "react";
import type { Item } from "@/lib/types";
import type { ExampleEnclosure } from "./exampleData";
import type { MarketData } from "./storyData";
import { Engineering } from "./Engineering";
import { Market, MarketNoScript } from "./Market";
import { ENGINEERING, MARKET, PROOF } from "./content";

type Group = keyof typeof PROOF.groups;
const GROUPS = Object.keys(PROOF.groups) as Group[];
/** the page's text column, and the wider one the stage runs in */
const TEXT = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
const WIDE = "mx-auto w-full max-w-[90rem] px-2 sm:px-6 lg:px-8";

export function Showcase({ parts, wires, enclosure, market }: { parts: Item[]; wires: Item[]; enclosure: ExampleEnclosure | null; market: MarketData }) {
  const [group, setGroup] = useState<Group>("make");
  return (
    <div>
      <div className={`${TEXT} flex flex-wrap items-center gap-x-5 gap-y-3`}>
        <div role="group" aria-label={PROOF.switch} className="inline-flex rounded-lg border border-hairline bg-surface p-1">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={group === g}
              data-track={`cta:proof-${g}`}
              onClick={() => setGroup(g)}
              className={`h-9 rounded-md px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none ${group === g ? "bg-action text-white" : "text-secondary hover:text-primary"}`}
            >
              {PROOF.groups[g].label}
            </button>
          ))}
        </div>
        <p className="min-w-0 text-sm leading-relaxed text-secondary" aria-live="polite">{PROOF.groups[group].sub}</p>
      </div>

      <div className={`${WIDE} mt-4`}>
        {group === "make" ? <Engineering parts={parts} wires={wires} enclosure={enclosure} /> : <Market data={market} />}
      </div>
      <div className={TEXT}>
        <p className="mt-3 max-w-[80ch] text-[13px] leading-relaxed text-muted">{group === "make" ? `${PROOF.enclosureNote} ${ENGINEERING.note}` : MARKET.note}</p>
      </div>

      <noscript>
        <div className={WIDE}>
          <p className="mt-6 px-2 text-[13px] text-secondary sm:px-0">{PROOF.noscript}</p>
          <div className="mt-3">
            <MarketNoScript data={market} />
          </div>
        </div>
      </noscript>
    </div>
  );
}
