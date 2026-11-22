"use client";

// The departures board: a split-flap display in the Solari manner. Every character is one cell of two half
// panels on a hinge. To show a new character a cell does not jump to it: it flaps through the drum's fixed order
// (space, A to Z, 0 to 9, a few marks) one character at a time, the top half folding down over the bottom, so
// every cell needs a different number of flaps and a row settles raggedly, left to right.
//
// What it shows is data (BOARD_STATES in content.ts): the board before any call, then each gate called in turn,
// with remarks that are the worked example's own figures. It moves to the next state every seven seconds while
// it is on screen. It has no pause control (owner, 22 Nov). Off screen it waits; under reduced motion it rests on
// one settled state, the one the server sends: the last, where every row shows its figure.
//
// The flaps are decoration and hidden from assistive technology. The same content is a real table beside them,
// visually hidden and kept in step with the state. It is not a live region: a board that announced itself every
// seven seconds would be noise, so a screen reader reads the current state when it gets there.
//
// The flapping is driven outside React: one requestAnimationFrame loop writes the characters and starts the two
// half-turn animations (transform only) per flap. Cells are size-contained, so no flap causes layout elsewhere.
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { useAnimated } from "./useAnimated";
import { BOARD, BOARD_REST, BOARD_STATES, type BoardRow } from "./content";

const DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-:";
const FLAP_MS = 72;
const STATE_MS = 7000;
const COLUMNS = ["time", "destination", "gate", "status", "remarks"] as const;

/** The whole board as one string of drum characters, row by row, column by column. */
function spell(rows: BoardRow[]) {
  return rows.map((r) => COLUMNS.map((c) => r[c].toUpperCase().padEnd(BOARD.cells[c], " ").slice(0, BOARD.cells[c])).join("")).join("");
}
const drumIndex = (ch: string) => Math.max(0, DRUM.indexOf(ch));

type Cell = { top: Element; bottom: Element; flapTop: HTMLElement; flapBottom: HTMLElement; at: number; to: number; due: number; turning: Animation[] };

/** Runs the flaps of every cell under `root`. `show` sets what the board should read; `snap` skips the flapping. */
function drive(root: HTMLElement) {
  const cells: Cell[] = Array.from(root.querySelectorAll<HTMLElement>("[data-flap]")).map((el) => {
    const [top, bottom, flapTop, flapBottom] = Array.from(el.children) as HTMLElement[];
    const at = drumIndex(top!.textContent ?? " ");
    return { top: top!.firstElementChild!, bottom: bottom!.firstElementChild!, flapTop: flapTop!, flapBottom: flapBottom!, at, to: at, due: 0, turning: [] };
  });
  const perRow = cells.length / BOARD.rows.length;
  let frame = 0;

  // the flap has landed: the bottom half now shows the new character and the two moving halves go back to rest
  const land = (c: Cell) => {
    const ch = DRUM[c.at]!;
    c.bottom.textContent = ch;
    c.flapTop.firstElementChild!.textContent = ch;
    c.turning.forEach((a) => a.cancel());
    c.turning = [];
  };

  const tick = (now: number) => {
    let busy = false;
    for (const c of cells) {
      if (c.turning.length && now >= c.due) land(c);
      if (c.at === c.to) {
        busy ||= c.turning.length > 0;
        continue;
      }
      busy = true;
      if (now < c.due) continue;
      c.at = (c.at + 1) % DRUM.length;
      const next = DRUM[c.at]!;
      c.top.textContent = next; // behind the top flap until it folds away
      c.flapBottom.firstElementChild!.textContent = next;
      c.turning = [
        c.flapTop.animate([{ transform: "perspective(5em) rotateX(0deg)" }, { transform: "perspective(5em) rotateX(-90deg)" }], { duration: FLAP_MS / 2, easing: "ease-in", fill: "forwards" }),
        c.flapBottom.animate([{ transform: "perspective(5em) rotateX(90deg)" }, { transform: "perspective(5em) rotateX(0deg)" }], { duration: FLAP_MS / 2, delay: FLAP_MS / 2, easing: "cubic-bezier(0.3, 1.5, 0.6, 1)", fill: "both" }),
      ];
      c.due = now + FLAP_MS;
    }
    frame = busy ? requestAnimationFrame(tick) : 0;
  };

  return {
    show(text: string, snap: boolean) {
      const now = performance.now();
      cells.forEach((c, i) => {
        c.to = drumIndex(text[i] ?? " ");
        if (snap) {
          c.at = c.to;
          c.top.textContent = DRUM[c.at]!;
          c.flapBottom.firstElementChild!.textContent = DRUM[c.at]!;
          land(c);
        } else if (c.at !== c.to && !c.turning.length) {
          // a small stagger along the row and down the board, so the change sweeps rather than snaps
          c.due = now + (i % perRow) * 14 + Math.floor(i / perRow) * 60;
        }
      });
      if (!snap && !frame) frame = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      cells.forEach((c) => c.turning.forEach((a) => a.cancel()));
    },
  };
}

function Flaps({ text, width }: { text: string; width: number }) {
  return (
    <>
      {text.toUpperCase().padEnd(width, " ").slice(0, width).split("").map((ch, k) => (
        <span key={k} data-flap className="wl-flap">
          <i><b>{ch}</b></i>
          <i><b>{ch}</b></i>
          <i><b>{ch}</b></i>
          <i><b>{ch}</b></i>
        </span>
      ))}
    </>
  );
}

const TONE = { plain: "text-white", good: "text-success", late: "text-warning" } as const;

export function DeparturesBoard() {
  const board = useRef<HTMLDivElement>(null);
  const driver = useRef<ReturnType<typeof drive> | null>(null);
  const [state, setState] = useState(BOARD_REST);
  const animated = useAnimated();
  const seen = useInView(board, { amount: 0.3 });
  const running = animated && seen;
  const rows = BOARD_STATES[state]!;

  useEffect(() => {
    const d = board.current ? drive(board.current) : null;
    driver.current = d;
    return () => d?.stop();
  }, []);

  // show the state: flapping when things may move, set straight otherwise
  useEffect(() => {
    driver.current?.show(spell(BOARD_STATES[state]!), !animated);
  }, [state, animated]);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setState((s) => (s + 1) % BOARD_STATES.length), STATE_MS);
    return () => window.clearInterval(t);
  }, [running]);

  return (
    <div className="dark overflow-hidden rounded-xl border border-hairline bg-[#0b0c0e] text-primary shadow-[var(--shadow-card)]">
      <p className="border-b border-hairline px-4 py-2.5 font-mono text-xs font-semibold text-dutchOrange-400 sm:px-5">
        Departures <span className="ml-2 font-normal text-muted">{BOARD.flight}</span>
      </p>

      <div ref={board} aria-hidden="true" className="wl-board px-4 pb-3 pt-2 font-mono sm:px-5">
        <div className="wl-board-row wl-board-head text-muted">
          {COLUMNS.map((c) => (
            <span key={c} data-col={c} style={{ width: `${BOARD.cells[c] * 1.43}em` }}>
              <span className="text-[11px]">{BOARD.columns[c]}</span>
            </span>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={BOARD.rows[i]!.n} className="wl-board-row">
            {COLUMNS.map((c) => (
              <span key={c} data-col={c} className={c === "status" || c === "time" ? TONE[r.tone] : c === "gate" ? "text-dutchOrange-300" : "text-white"}>
                {/* the server's characters; after that the driver owns them, so React is told the text never changes */}
                <Flaps text={BOARD_STATES[BOARD_REST]![i]![c]} width={BOARD.cells[c]} />
              </span>
            ))}
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>
          Departures for {BOARD.flight}, state {state + 1} of {BOARD_STATES.length}
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} scope="col">{BOARD.columns[c]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gate}>
              <td>{r.time}</td>
              <th scope="row">{r.destination}</th>
              <td>{r.gate}</td>
              <td>{r.status}</td>
              <td>{r.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
