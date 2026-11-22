// "The trip in 60 seconds": six slides, one line and one drawing each, in the Deck. A server component: the
// slides are in the page as plain markup and the Deck only adds the moving between them.
import type { ReactNode } from "react";
import { Bag } from "./Bag";
import { Deck } from "./Deck";
import { AdFan, IdeaScreen } from "./Illustrations";
import { CostBuild, PrintBuild } from "./StagePieces";
import { BAG_LINES, SIXTY } from "./content";

const PICTURE = "block h-full max-h-[210px] w-auto max-w-full";

function picture(key: string): ReactNode {
  switch (key) {
    case "joke":
      return (
        <div className="flex h-full items-center gap-4">
          <Bag className="block h-full max-h-[210px] w-auto shrink-0" />
          <p className="relative max-w-[11rem] rounded-xl border border-hairline bg-canvas px-4 py-3 text-sm font-semibold leading-snug text-primary">
            &ldquo;{BAG_LINES.scale.line}&rdquo;
            <span className="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-hairline bg-canvas" aria-hidden />
          </p>
        </div>
      );
    case "idea":
      return <IdeaScreen className={PICTURE} />;
    case "part":
      return <PrintBuild className="h-full max-h-[210px]" />;
    case "cost":
      return <CostBuild className="h-full max-h-[210px]" figureClassName="text-2xl" />;
    case "launch":
      return <AdFan className={PICTURE} />;
    default:
      return <Bag speaking="briefly" className={PICTURE} />;
  }
}

export function Sixty({ cta }: { /** the page's primary action, shown on the last slide */ cta: ReactNode }) {
  return (
    <Deck label={SIXTY.title} tabs={SIXTY.slides.map((s) => s.tab)} auto>
      {SIXTY.slides.map((s, i) => (
        <div key={s.key} className="grid h-full items-center gap-5 rounded-xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8 md:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] text-link">
              {i + 1} of {SIXTY.slides.length}
            </p>
            <p className="mt-2 max-w-[24ch] text-[1.375rem] font-semibold leading-snug tracking-tight text-primary sm:text-2xl">{s.line}</p>
            <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-secondary">{s.note}</p>
            {s.key === "turn" ? <div className="mt-5">{cta}</div> : null}
          </div>
          <div className="flex h-[180px] items-center justify-center sm:h-[210px]">{picture(s.key)}</div>
        </div>
      ))}
    </Deck>
  );
}
