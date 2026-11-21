"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_PARAMS, LID_LABELS, LID_TYPES, NUMERIC_RULES, SCREW_SIZES, type EnclosureParams, type Issue } from "@/lib/enclosure/types";

export type Draft = Record<(typeof NUMERIC_RULES)[number]["key"], string> & Pick<EnclosureParams, "lidType" | "screwSize">;

export const toDraft = (p: EnclosureParams): Draft => ({
  wallThickness: String(p.wallThickness),
  floorThickness: String(p.floorThickness),
  lidThickness: String(p.lidThickness),
  cornerRadius: String(p.cornerRadius),
  clearance: String(p.clearance),
  openingMargin: String(p.openingMargin),
  lidType: p.lidType,
  screwSize: p.screwSize,
});

/** The numbers as typed. A field that is empty or not a number is NaN, and the form says so. */
export function fromDraft(d: Draft): Record<keyof EnclosureParams, number | string> {
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  return {
    wallThickness: num(d.wallThickness),
    floorThickness: num(d.floorThickness),
    lidThickness: num(d.lidThickness),
    cornerRadius: num(d.cornerRadius),
    clearance: num(d.clearance),
    openingMargin: num(d.openingMargin),
    lidType: d.lidType,
    screwSize: d.screwSize,
  };
}

const selectCls =
  "h-9 w-full rounded-md border border-hairline bg-surface px-2 text-sm text-primary focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange";

export function ParamsForm({ draft, onChange, issues }: { draft: Draft; onChange: (d: Draft) => void; issues: Issue[] }) {
  const problem = (key: string) => issues.find((i) => i.about === key && i.code === "param-range");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {NUMERIC_RULES.map((r) => {
          const bad = problem(r.key);
          const id = `enc-${r.key}`;
          return (
            <div key={r.key} className="space-y-1">
              <Label htmlFor={id} className="text-xs text-secondary">
                {r.label} ({r.unit})
              </Label>
              <Input
                id={id}
                inputMode="decimal"
                value={draft[r.key]}
                onChange={(e) => onChange({ ...draft, [r.key]: e.target.value })}
                aria-invalid={bad ? true : undefined}
                aria-describedby={`${id}-help`}
              />
              <p id={`${id}-help`} className={bad ? "text-xs text-danger" : "text-xs text-muted"}>
                {bad ? bad.message : `${r.help} Default ${DEFAULT_PARAMS[r.key]}.`}
              </p>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="enc-lid" className="text-xs text-secondary">
            Lid
          </Label>
          <select id="enc-lid" className={selectCls} value={draft.lidType} onChange={(e) => onChange({ ...draft, lidType: e.target.value as Draft["lidType"] })}>
            {LID_TYPES.map((t) => (
              <option key={t} value={t}>
                {LID_LABELS[t]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">Default {LID_LABELS[DEFAULT_PARAMS.lidType].toLowerCase()}.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="enc-screw" className="text-xs text-secondary">
            Screw size
          </Label>
          <select
            id="enc-screw"
            className={selectCls}
            value={draft.screwSize}
            disabled={draft.lidType !== "screw"}
            onChange={(e) => onChange({ ...draft, screwSize: e.target.value as Draft["screwSize"] })}
          >
            {SCREW_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">Used for the lid posts when the lid is screwed down. Default {DEFAULT_PARAMS.screwSize}.</p>
        </div>
      </div>
    </div>
  );
}
