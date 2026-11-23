"use client";

// The one control language of "What you get": every view's switches, sliders and toggles are these, built on the
// shared kit (shadcn/ui ToggleGroup, Toggle, Slider and Button on Radix), styled once for the dark stage. Each has a
// visible name, a visible focus ring, and announces its value; each works by keyboard (arrows in a group and on a
// slider, Space or Enter on a toggle). On a phone the bar wraps and the sliders take the full width.
import type { ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus, RotateCcw } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { ShowcaseNudge } from "@/components/three/canvasShowcase";

const ITEM =
  "h-8 min-w-0 flex-none border border-hairline px-2.5 text-[13px] font-normal text-secondary hover:bg-white/5 hover:text-primary data-[state=on]:border-transparent data-[state=on]:bg-action data-[state=on]:text-white focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-0 sm:px-3";
const LABEL = "text-[13px] text-muted";

/** A named group of controls in the bar. */
export function ControlGroup({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className={`${LABEL} hidden shrink-0 xl:inline`} aria-hidden>
        {label}
      </span>
      {children}
    </div>
  );
}

/** One of a few: how the view is drawn. Arrow keys move along it; one is always chosen. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <ToggleGroup type="single" aria-label={label} value={value} onValueChange={(v) => v && onChange(v as T)} className="shrink-0">
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className={`${ITEM} -ml-px first:ml-0`}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** On or off: tags, wires. */
export function Switch({ label, on, onChange, disabled }: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Toggle pressed={on} onPressedChange={onChange} disabled={disabled} className={`${ITEM} rounded-md data-[state=on]:border-dutchOrange data-[state=on]:bg-transparent data-[state=on]:text-primary`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-dutchOrange" : "bg-muted"}`} aria-hidden />
      {label}
    </Toggle>
  );
}

/** A value along a range, with its reading beside it in the mono type. */
export function Range({ label, value, min, max, step = 1, onChange, onTouch, readout, valueText, className = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; /** the visitor has taken hold of it, even without changing the value */ onTouch?: () => void; readout: ReactNode; valueText: string; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <span className={`${LABEL} shrink-0`} aria-hidden>
        {label}
      </span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? min)}
        onPointerDown={onTouch}
        onKeyDown={onTouch}
        thumbLabel={label}
        thumbValueText={valueText}
        className="min-w-[7rem] flex-1 py-2 [&_[data-slot=slider-range]]:bg-dutchOrange [&_[data-slot=slider-thumb]]:border-dutchOrange [&_[data-slot=slider-thumb]]:focus-visible:ring-focus [&_[data-slot=slider-track]]:bg-white/12"
      />
      <span className="shrink-0 text-[13px] tabular-nums text-primary">{readout}</span>
    </div>
  );
}

const ICON = "h-8 w-8 border-hairline bg-[#0b0c0e]/90 text-secondary hover:border-dutchOrange hover:bg-[#0b0c0e] hover:text-primary focus-visible:ring-2 focus-visible:ring-focus";

/** Turn, tilt and zoom by button, for people who do not drag; and back to the start. */
export function OrbitPad({ onNudge, onReset, resetLabel, compact = false }: { onNudge: (k: ShowcaseNudge["kind"]) => void; onReset: () => void; resetLabel: string; compact?: boolean }) {
  const all: { k: ShowcaseNudge["kind"]; label: string; icon: ReactNode; wide?: boolean }[] = [
    { k: "left", label: "Turn left", icon: <ArrowLeft className="h-4 w-4" aria-hidden /> },
    { k: "right", label: "Turn right", icon: <ArrowRight className="h-4 w-4" aria-hidden /> },
    { k: "up", label: "Tilt up", icon: <ArrowUp className="h-4 w-4" aria-hidden />, wide: true },
    { k: "down", label: "Tilt down", icon: <ArrowDown className="h-4 w-4" aria-hidden />, wide: true },
    { k: "in", label: "Zoom in", icon: <Plus className="h-4 w-4" aria-hidden /> },
    { k: "out", label: "Zoom out", icon: <Minus className="h-4 w-4" aria-hidden /> },
  ];
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Turn, tilt and zoom">
      {all
        .filter((b) => !compact || !b.wide)
        .map((b) => (
          <Button key={b.k} type="button" variant="outline" size="icon" className={ICON} aria-label={b.label} onClick={() => onNudge(b.k)}>
            {b.icon}
          </Button>
        ))}
      <Button type="button" variant="outline" size="icon" className={ICON} aria-label={resetLabel} onClick={onReset}>
        <RotateCcw className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
