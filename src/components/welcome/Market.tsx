"use client";

// The market stage: one panel with seven tabs, at the weight and in the frame of the engineering stage
// (Engineering.tsx), for the half of the workbench that sells the product. The rows and the rules come from the
// server as props (storyData.ts); nothing here calls the API and nothing can be saved.
//   Positioning          the app's line and its proof check, on the example's notes, claims, tests and requirements
//   Brand kit            the example's voice rules, what a kit holds, and the app's contrast check
//   Ads                  the example's ad drafts and every ad channel's limits
//   Landing page         the example's planned pages and the sections the generator draws
//   Launch plan          the app's launch templates, step by step in days from launch day
//   Listing              the listing's fields with Amazon's limits, and the example's one row
//   Channels and results the example's sales channels and campaigns with their targets, and the connections
// On a wide screen the stage has one fixed height and a tab scrolls inside it; on a phone a tab takes the height
// it needs. Without script every tab is set out one under another.
import { useRef, useState, type KeyboardEvent } from "react";
import type { MarketData } from "./storyData";
import { MarketPanel, type MarketTab } from "./MarketPanels";
import { MARKET } from "./content";

const TABS = Object.keys(MARKET.tabs) as MarketTab[];

/** Tabs set out one under another, for a reader without script. It holds no <noscript> of its own, so it can sit inside one. */
function MarketTabsFlat({ tabs, data }: { tabs: MarketTab[]; data: MarketData }) {
  return (
    <>
      {tabs.map((t) => (
        <section key={t} aria-label={MARKET.tabs[t]} className="flex flex-col border-t border-hairline">
          <p className="px-4 pt-4 text-base font-semibold text-primary">{MARKET.tabs[t]}</p>
          <MarketPanel tab={t} data={data} />
        </section>
      ))}
    </>
  );
}

/** The whole market stage without script: every tab, in the stage's frame. Used where the stage itself is not on the page (Showcase). */
export function MarketNoScript({ data }: { data: MarketData }) {
  return (
    <div className="dark overflow-hidden rounded-xl border border-hairline bg-[#0b0c0e] text-primary">
      <MarketTabsFlat tabs={TABS} data={data} />
    </div>
  );
}

export function Market({ data }: { data: MarketData }) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tab, setTab] = useState<MarketTab>("positioning");

  const onKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const to = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i + TABS.length - 1) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(TABS[to]!);
    tabRefs.current[to]?.focus();
  };

  return (
    <div className="rounded-[18px] border border-hairline bg-bezel p-1.5 shadow-plate sm:p-2">
      <div className="dark overflow-hidden rounded-xl border border-black/60 bg-[#0b0c0e] text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="flex items-stretch border-b border-hairline">
          <div role="tablist" aria-label={MARKET.title} onKeyDown={onKey} className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t, i) => (
              <button
                key={t}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`mkt-tab-${t}`}
                aria-selected={tab === t}
                aria-controls="mkt-panel"
                tabIndex={tab === t ? 0 : -1}
                onClick={() => setTab(t)}
                className={`relative h-12 shrink-0 whitespace-nowrap px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:px-5 ${tab === t ? "text-primary" : "text-secondary hover:text-primary"}`}
              >
                {MARKET.tabs[t]}
                <span className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-dutchOrange transition-opacity duration-150 ${tab === t ? "opacity-100" : "opacity-0"}`} aria-hidden />
              </button>
            ))}
          </div>
          <p className="hidden shrink-0 items-center gap-2 border-l border-hairline px-4 font-mono text-[11px] text-muted xl:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-dutchOrange" aria-hidden />
            {MARKET.badge}
          </p>
        </div>

        <div id="mkt-panel" role="tabpanel" aria-labelledby={`mkt-tab-${tab}`} className="flex min-h-[560px] flex-col lg:h-[700px]">
          <MarketPanel tab={tab} data={data} />
        </div>

        {/* without script the tabs cannot change, so the other six are set out here */}
        <noscript>
          <div className="border-t border-hairline">
            <p className="px-4 py-3 text-[13px] text-secondary">{MARKET.noscript}</p>
            <MarketTabsFlat tabs={TABS.slice(1)} data={data} />
          </div>
        </noscript>
      </div>
    </div>
  );
}
