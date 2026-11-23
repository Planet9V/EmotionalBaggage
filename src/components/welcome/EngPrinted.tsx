"use client";

// The Enclosure and print tab: the example's enclosure as the app holds it. It is an authored design (made outside
// the app's generators and kept as files), so this shows what the Enclosure page shows of one: its printed pieces
// laid out on their two print plates, in their filaments' colours, each to be picked for its mass and cost; the
// design's own checks, said to be its maker's and not this app's; the two print jobs as they stand; and the renders
// kept in Files. The plates are drawn in code from the tag's own numbers (tagShape.ts) and the pieces' rows; the
// renders are copies of the stored files. Every word and figure is one of the example's rows (product/printed.ts).
import { useState } from "react";
import { Check, X } from "lucide-react";
import { TONE_CLASS, statusTone } from "@/lib/statusTones";
import type { Printed, PrintedPiece } from "./product/printed";
import { FACE, SLOT, TAG_MM, tagPath } from "./scenes/film/tagShape";
import { ENGINEERING } from "./content";
import { StageBar, StageFoot, StageView } from "./StageParts";

const C = ENGINEERING.enclosure;
const { w: W, h: H } = TAG_MM;
/** A filament's colour in the drawing, by the colour its name says. */
const swatch = (name: string) => (/brown|saddle|tan/i.test(name) ? "#a8683a" : /cream|ivory|white/i.test(name) ? "#f1e4c3" : /black/i.test(name) ? "#1d1f23" : "#8a9099");
const mm = (n: number) => String(Math.round(n * 10) / 10);

/** Where each piece lies on its plate, in mm: the body, the back plate beside it, the two doors in a column; the strap on a plate of its own. */
const PLATE_GAP = 6;
function layout(pieces: PrintedPiece[]) {
  const at = new Map<string, { x: number; y: number }>();
  const body = pieces.find((p) => p.look === "shell");
  const plate = pieces.find((p) => p.look === "plate");
  const doors = pieces.filter((p) => p.look === "trackerDoor" || p.look === "coinDoor");
  const strap = pieces.find((p) => p.look === "strap");
  let x = 0;
  if (body) {
    at.set(body.ref, { x: W / 2, y: H / 2 });
    x = W + PLATE_GAP;
  }
  if (plate) {
    at.set(plate.ref, { x: x + plate.size[0]! / 2, y: plate.size[1]! / 2 });
    x += plate.size[0]! + PLATE_GAP;
  }
  let y = 0;
  let wide = 0;
  for (const d of doors) {
    at.set(d.ref, { x: x + d.size[0]! / 2, y: y + d.size[0]! / 2 });
    y += d.size[0]! + PLATE_GAP;
    wide = Math.max(wide, d.size[0]!);
  }
  const first = { x0: -PLATE_GAP, x1: x + wide + PLATE_GAP };
  // (wide enough for its own heading)
  const second = strap ? { x0: first.x1 + PLATE_GAP * 2, x1: first.x1 + PLATE_GAP * 2 + Math.max(36, strap.size[0]! + PLATE_GAP * 2) } : null;
  if (strap && second) at.set(strap.ref, { x: (second.x0 + second.x1) / 2, y: strap.size[1]! / 2 });
  return { at, first, second };
}

function Piece({ p, at, colours, on, onPick }: { p: PrintedPiece; at: { x: number; y: number }; colours: string[]; on: boolean; onPick: () => void }) {
  const [main, second] = [swatch(colours[0] ?? ""), swatch(colours[1] ?? colours[0] ?? "")];
  const edge = on ? "#ff8a3d" : "#00000066";
  const sw = on ? 1.4 : 0.5;
  const r = p.size[0]! / 2;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={on}
      aria-label={`${p.ref}, ${p.title}`}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onPick();
      }}
      className="cursor-pointer outline-none [&:focus-visible>*:first-child]:stroke-[#F78C4F]"
      transform={`translate(${at.x} ${at.y})`}
    >
      {p.look === "shell" ? (
        <>
          <path d={tagPath(1)} transform={`translate(0 ${-H / 2})`} fill={main} stroke={edge} strokeWidth={sw} strokeLinejoin="round" />
          <path d={tagPath(1, 3)} transform={`translate(0 ${-H / 2})`} fill="none" stroke={second} strokeWidth={0.9} strokeDasharray="2.2 1.2" />
          <rect x={FACE.panel.x0} y={-FACE.panel.y1} width={FACE.panel.x1 - FACE.panel.x0} height={FACE.panel.y1 - FACE.panel.y0} rx={2.5} fill="#00000022" />
          <circle cx={FACE.door.x} cy={-FACE.door.y} r={FACE.door.r} fill="#0b0c0e" fillOpacity={0.55} />
          <ellipse cx={FACE.oval.x} cy={-FACE.oval.y} rx={FACE.oval.rx} ry={FACE.oval.ry} fill="none" stroke="#00000055" strokeWidth={0.6} />
          <rect x={-SLOT.w / 2} y={-H / 2 + SLOT.down - SLOT.h / 2} width={SLOT.w} height={SLOT.h} rx={SLOT.h / 2} fill="#0b0c0e" />
        </>
      ) : p.look === "plate" ? (
        <>
          <rect x={-p.size[0]! / 2} y={-p.size[1]! / 2} width={p.size[0]} height={p.size[1]} rx={3} fill={main} stroke={edge} strokeWidth={sw} />
          <rect x={-p.size[0]! / 2 + 2.2} y={-p.size[1]! / 2 + 2.2} width={p.size[0]! - 4.4} height={p.size[1]! - 4.4} rx={2} fill="none" stroke={second} strokeWidth={0.9} strokeDasharray="2.2 1.2" />
          {/* the card window and the tracker door's opening, where they are on the plate */}
          <rect x={FACE.card.x0} y={-(FACE.card.y1 - (FACE.plate.y0 + FACE.plate.y1) / 2)} width={FACE.card.x1 - FACE.card.x0} height={FACE.card.y1 - FACE.card.y0} rx={1.6} fill="#00000030" />
          <circle cx={FACE.tracker.x} cy={-(FACE.tracker.y - (FACE.plate.y0 + FACE.plate.y1) / 2)} r={FACE.tracker.r} fill="#0b0c0e" fillOpacity={0.55} />
        </>
      ) : p.look === "strap" ? (
        <rect x={-p.size[0]! / 2} y={-p.size[1]! / 2} width={p.size[0]} height={p.size[1]} rx={2} fill={main} stroke={on ? edge : "#ffffff40"} strokeWidth={sw} />
      ) : (
        <>
          <circle r={r} fill={main} stroke={edge} strokeWidth={sw} />
          <rect x={-r * 0.3} y={-0.6} width={r * 0.6} height={1.2} rx={0.6} fill={p.look === "trackerDoor" ? second : "#00000066"} />
        </>
      )}
    </g>
  );
}

export default function EngPrinted({ printed }: { printed: Printed }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [render, setRender] = useState<number | null>(null);
  const { at, first, second } = layout(printed.pieces);
  const piece = printed.pieces.find((p) => p.ref === picked) ?? null;
  const ok = printed.checks.filter((c) => c.ok).length;
  const grams = printed.pieces.reduce((a, p) => a + (p.grams ?? 0), 0);
  const tall = Math.max(H, ...printed.pieces.map((p) => (at.get(p.ref)?.y ?? 0) + (p.look === "trackerDoor" || p.look === "coinDoor" ? p.size[0]! : p.size[1]!) / 2));
  const x1 = (second ?? first).x1;
  const shown = render === null ? null : printed.renders[render]!;
  const row = "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 border-t border-hairline py-1.5 text-[13px] leading-snug";

  return (
    <>
      <StageBar path="/s/design/enclosure">
        <p className="truncate text-[13px] text-secondary">
          <span className="text-primary">{printed.name}</span>
          {printed.size.length ? <span className="hidden sm:inline"> · {printed.size.map(mm).join(" x ")} mm</span> : null}
        </p>
      </StageBar>
      <StageView className="flex flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* the plates, or the render that was picked */}
        <div className="relative flex min-h-[300px] flex-1 items-center justify-center bg-[radial-gradient(ellipse_62%_58%_at_50%_46%,#2a211b_0%,#15120f_45%,#0b0c0e_82%)] p-4 sm:p-6 lg:min-h-0">
          {shown ? (
            <figure className="flex h-full w-full flex-col items-center justify-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small static copy in public/, shown at its own size */}
              <img src={shown.src} alt={shown.label} className="max-h-[calc(100%-2.5rem)] max-w-full rounded-lg object-contain" />
              <figcaption className="text-center text-[13px] text-secondary">
                {shown.label}. <span className="text-muted">{C.renderNote}</span>
              </figcaption>
            </figure>
          ) : (
            <svg viewBox={`${first.x0 - 2} -16 ${x1 - first.x0 + 4} ${tall + 26}`} className="h-full max-h-[520px] w-full" role="group" aria-label={C.platesLabel(printed.jobs.length)}>
              {[first, second].map((b, i) =>
                b && printed.jobs[i] ? (
                  <g key={i}>
                    <rect x={b.x0} y={-PLATE_GAP} width={b.x1 - b.x0} height={tall + PLATE_GAP * 2} rx={3} fill="#ffffff08" stroke="#ffffff26" strokeWidth={0.4} strokeDasharray="2 2" />
                    <text x={b.x0 + 1} y={-9.5} fontSize={4.6} fill="#d4d4d8" fontFamily="var(--font-sans, system-ui)">
                      {C.plate(i + 1)} · {printed.jobs[i]!.material}
                    </text>
                  </g>
                ) : null,
              )}
              {printed.pieces.map((p) => (
                <Piece key={p.ref} p={p} at={at.get(p.ref) ?? { x: 0, y: 0 }} colours={printed.jobs[p.job]?.colours ?? []} on={picked === p.ref} onPick={() => setPicked(picked === p.ref ? null : p.ref)} />
              ))}
            </svg>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-4 border-hairline bg-[#101216] p-4 lg:w-[360px] lg:overflow-y-auto lg:border-l">
          {/* the piece that is picked */}
          <div aria-live="polite">
            {piece ? (
              <>
                <p className="text-[13px] text-muted">
                  <span className="font-mono font-semibold text-dutchOrange-300">{piece.ref}</span>
                </p>
                <h4 className="text-base font-semibold leading-snug text-primary">{piece.title}</h4>
                <p className="mt-1 text-[13px] leading-relaxed text-secondary">{piece.does}</p>
                <dl className="mt-2">
                  {piece.grams !== null ? (
                    <div className={row}>
                      <dt className="text-muted">{C.mass}</dt>
                      <dd className="tabular-nums text-primary">{mm(piece.grams)} g</dd>
                    </div>
                  ) : null}
                  {piece.cost ? (
                    <div className={row}>
                      <dt className="text-muted">{C.cost}</dt>
                      <dd className="tabular-nums text-primary">
                        {piece.cost} <span className="text-muted">({C.estimate})</span>
                      </dd>
                    </div>
                  ) : null}
                  <div className={row}>
                    <dt className="text-muted">{C.filament}</dt>
                    <dd className="text-primary">{(printed.jobs[piece.job]?.colours ?? []).join(", ")}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-secondary">{printed.designedBy ? `${C.held} ${printed.designedBy}.` : C.held}</p>
                <ul className="mt-2 grid gap-1">
                  {printed.pieces.map((p) => (
                    <li key={p.ref}>
                      <button type="button" onClick={() => { setRender(null); setPicked(p.ref); }} className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] text-secondary hover:bg-white/5 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus max-lg:min-h-11">
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {p.grams !== null ? <span className="shrink-0 tabular-nums text-muted">{mm(p.grams)} g</span> : null}
                        <span className="w-10 shrink-0 text-right font-mono text-[12px] text-dutchOrange-300">{p.ref}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {piece ? (
              <button type="button" onClick={() => setPicked(null)} className="mt-2 inline-flex min-h-9 items-center text-[13px] font-medium text-link underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus max-lg:min-h-11">
                {C.allPieces}
              </button>
            ) : null}
          </div>

          {/* the design's checks, and whose they are */}
          <details className="group rounded-lg border border-hairline">
            <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 text-[13px] leading-snug text-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              <span>
                <span className="font-medium text-primary">{C.checks(ok, printed.checks.length)}</span> {C.checkedBy(printed.checkedBy)}
              </span>
            </summary>
            <ul className="grid gap-1 border-t border-hairline px-3 py-2.5">
              {printed.checks.map((c) => (
                <li key={c.label} className="flex gap-2 text-[13px] leading-snug text-secondary">
                  {c.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-label="met" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-label="not met" />}
                  {c.label}
                </li>
              ))}
            </ul>
          </details>

          {/* the print jobs, as they stand */}
          <div>
            <p className="text-[13px] font-medium text-muted">{C.jobsTitle}</p>
            <ul className="mt-1.5 grid gap-2">
              {printed.jobs.map((j) => (
                <li key={j.title} className="rounded-lg border border-hairline px-3 py-2">
                  <p className="flex items-start justify-between gap-2 text-[13px] font-medium leading-snug text-primary">
                    {j.title}
                    <span className={`inline-flex h-[22px] shrink-0 items-center rounded-full border px-2 text-[13px] font-normal leading-none ${TONE_CLASS[statusTone(j.status)]}`}>{j.status}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-secondary">
                    {j.colours.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/25" style={{ background: swatch(c) }} aria-hidden />
                        {c}
                      </span>
                    ))}
                  </p>
                  <p className="mt-1 text-[13px] text-muted">{j.estimate}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* the renders the app keeps */}
          {printed.renders.length ? (
            <div>
              <p className="text-[13px] font-medium text-muted">{C.rendersTitle}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="group" aria-label={C.rendersTitle}>
                <button type="button" aria-pressed={render === null} onClick={() => setRender(null)} className={`flex aspect-[4/3] items-center justify-center rounded-md border px-1 text-center text-[13px] leading-tight focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${render === null ? "border-dutchOrange text-primary" : "border-hairline text-secondary hover:text-primary"}`}>
                  {C.plates}
                </button>
                {printed.renders.map((r, i) => (
                  <button key={r.src} type="button" aria-pressed={render === i} aria-label={r.label} onClick={() => setRender(i)} className={`aspect-[4/3] overflow-hidden rounded-md border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${render === i ? "border-dutchOrange" : "border-hairline hover:border-white/40"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a small static copy in public/ */}
                    <img src={r.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-muted">{C.renderNote}</p>
            </div>
          ) : null}
          <p className="text-[13px] leading-snug text-muted">{C.generator}</p>
        </div>
      </StageView>
      <StageFoot hint={C.hint}>{C.counts(printed.pieces.length, mm(grams), printed.jobs.length)}</StageFoot>
    </>
  );
}
