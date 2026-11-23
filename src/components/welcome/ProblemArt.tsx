// The problem as a picture: on one side the tools a hardware idea usually lives in (the ones the block's own lead
// names), loose and at odds, the links between them broken; on the other the one line every stage of the
// workbench sits on, from the idea to the sale: the same line the hero's product hangs from. Markup and a little
// SVG, drawn by the server; nothing moves.
import { GET, HERO_STAGE, PROBLEM } from "./content";

const STAGES = GET.groups.flatMap((g) => g.items.map((it) => it.stage));
/** each loose tool: how far it is turned and dropped, so no two sit square to each other */
const LOOSE = [
  "-rotate-[5deg]",
  "translate-y-1.5 rotate-[3deg]",
  "-translate-y-1 rotate-[7deg]",
  "translate-y-1 -rotate-[2deg]",
  "-rotate-[8deg]",
  "translate-y-2 rotate-[4deg]",
  "-translate-y-0.5 -rotate-[4deg]",
  "translate-y-1 rotate-[6deg]",
];

export function ProblemArt() {
  return (
    <figure aria-label={PROBLEM.art} className="grid items-center gap-x-6 gap-y-5 rounded-2xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div>
        <p className="text-[13px] font-medium text-muted">{PROBLEM.before}</p>
        <ul className="mt-3 flex flex-wrap gap-x-2.5 gap-y-3.5">
          {PROBLEM.tools.map((t, i) => (
            <li key={t} className={`rounded-md border border-dashed border-[color-mix(in_oklab,var(--text-muted)_55%,transparent)] bg-subtle px-2.5 py-1 text-[13px] text-secondary ${LOOSE[i % LOOSE.length]}`}>
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* into one: down the page on a phone, across it from 768 px */}
      <svg viewBox="0 0 56 56" className="mx-auto h-10 w-10 rotate-90 text-dutchOrange md:h-14 md:w-14 md:rotate-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8C20 8 22 28 36 28M4 28h32M4 48c16 0 18-20 32-20" strokeOpacity="0.55" />
        <path d="M36 28h16m-7-7l7 7l-7 7" />
      </svg>

      <div>
        <p className="text-[13px] font-medium text-link">{PROBLEM.after}</p>
        <div className="mt-4 flex items-center gap-2.5 text-[13px] font-medium" aria-hidden="true">
          <span className="text-primary">{HERO_STAGE.from}</span>
          <span className="relative h-[3px] min-w-0 flex-1 rounded-full bg-dutchOrange">
            <span className="absolute inset-x-1 top-1/2 flex -translate-y-1/2 justify-between">
              {STAGES.map((s) => (
                <span key={s} className="h-[9px] w-[9px] rounded-full border-2 border-dutchOrange bg-surface" />
              ))}
            </span>
          </span>
          <span className="rounded-full bg-action px-2.5 py-0.5 text-white">{HERO_STAGE.to}</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-secondary">{STAGES.join(", ")}</p>
      </div>
    </figure>
  );
}
