// The link between scenes: a split-flap board in the manner of the page's departures board. Its three rows turn
// to the next scene's number, its name and what the gadget is about to sense, then hold for a moment. Each cell
// runs through the drum until its own landing time, left to right, so the change sweeps across the board.
import type { Scene } from "./scenes";
import { ORIGIN } from "./scenes";

const DRUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+_-'";
const FLAP_MS = 55;
const LAND_FROM = 140;
const LAND_STEP = 20;

function Row({ text, cells, t, row, accent = false }: { text: string; cells: number; t: number; row: number; accent?: boolean }) {
  const shown = text.toUpperCase().padEnd(cells, " ").slice(0, cells);
  return (
    <div className="flex justify-center">
      {[...shown].map((ch, i) => {
        const land = LAND_FROM + row * 70 + i * LAND_STEP;
        const turning = t < land && ch !== " ";
        const now = turning ? DRUM[(i * 7 + row * 3 + Math.floor(t / FLAP_MS)) % DRUM.length]! : ch;
        return (
          <span key={i} className={`sc-flap ${accent && !turning ? "sc-flap-accent" : ""}`}>
            <b key={turning ? Math.floor(t / FLAP_MS) : "landed"} className={turning ? "sc-flap-turn" : ""}>
              {now}
            </b>
          </span>
        );
      })}
    </div>
  );
}

/** `t` is the time since the slate came up, in milliseconds. */
export function Slate({ scene, n, of, t }: { scene: Scene; n: number; of: number; t: number }) {
  const sensed = `${ORIGIN.sensed} ${scene.sensed.replace(" · ", " ").replace("+ ", "+")}`;
  return (
    <div className="sc-slate flex h-full w-full flex-col items-center justify-center gap-[0.5em]">
      <Row text={`SCENE ${n} OF ${of}`} cells={12} t={t} row={0} />
      <Row text={scene.title} cells={18} t={t} row={1} />
      <Row text={sensed} cells={23} t={t} row={2} accent />
    </div>
  );
}
