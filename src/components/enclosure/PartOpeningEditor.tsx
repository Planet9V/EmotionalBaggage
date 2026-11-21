"use client";

// A part's own enclosure settings, edited in a form rather than typed into the row's data: the opening for it
// (which wall, shape, size, shift, or none) and, for a circuit board, its mounting holes. Saved on the part row as
// data.opening and data.mountingHoles, which the enclosure spec reads.
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { ErrorLine } from "@/components/ui/states";
import { FACES } from "@/lib/enclosure/types";
import type { Item } from "@/lib/types";
import { libraryEntryById } from "@/lib/parts/library";
import { partTypeOf } from "@/lib/parts/pins";

const optNum = (msg: string, min0 = false) =>
  z.string().refine((v) => v.trim() === "" || (Number.isFinite(Number(v)) && (min0 ? Number(v) >= 0 : Number(v) > 0)), msg);
const anyNum = z.string().refine((v) => v.trim() === "" || Number.isFinite(Number(v)), "Enter a number in mm.");

const schema = z.object({
  mode: z.enum(["auto", "set", "off"]),
  face: z.string(),
  shape: z.enum(["rect", "circle"]),
  width: optNum("Width is a number of mm above 0."),
  height: optNum("Height is a number of mm above 0."),
  shiftA: anyNum,
  shiftB: anyNum,
  holesMode: z.enum(["assumed", "set"]),
  holes: z.array(z.object({ x: anyNum, z: anyNum, diameter: optNum("A diameter is a number of mm above 0.") })).max(12),
});
type Values = z.infer<typeof schema>;

const s = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const n = (v: string) => (v.trim() === "" ? undefined : Number(v));

function initial(item: Item): Values {
  const o = (item.data?.opening ?? null) as Record<string, unknown> | null;
  const holes = Array.isArray(item.data?.mountingHoles) ? (item.data.mountingHoles as Record<string, unknown>[]) : null;
  const shift = Array.isArray(o?.shift) ? (o!.shift as unknown[]) : [];
  return {
    mode: o?.off === true ? "off" : o && (o.face || o.width || o.height || o.shape || o.shift) ? "set" : "auto",
    face: typeof o?.face === "string" ? o.face : "",
    shape: o?.shape === "circle" ? "circle" : "rect",
    width: s(o?.width ?? o?.diameter),
    height: s(o?.height),
    shiftA: s(shift[0]),
    shiftB: s(shift[1]),
    holesMode: holes ? "set" : "assumed",
    holes: holes ? holes.map((h) => ({ x: s(h.x), z: s(h.z), diameter: s(h.diameter) })) : [],
  };
}

/** A pin of the part's library entry on the USB bus with a position: where a USB cable plugs in. */
export function usbPinOf(item: Item): { x: number; y: number; name: string } | null {
  const lib = libraryEntryById(partTypeOf(item).libraryId);
  const pin = lib?.pins.find((p) => (p.bus?.type === "usb" || /usb/i.test(p.name)) && p.position);
  return pin?.position ? { ...pin.position, name: pin.name } : null;
}

export function PartOpeningEditor({ item, isBoard, onSave }: { item: Item; isBoard: boolean; onSave: (data: Record<string, unknown>) => Promise<unknown> }) {
  const label = (typeof item.data?.ref === "string" && item.data.ref) || item.title;
  const { register, handleSubmit, control, setValue, setError, formState: { errors, isSubmitting, isSubmitSuccessful } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial(item) });
  const holes = useFieldArray({ control, name: "holes" });
  const mode = useWatch({ control, name: "mode" });
  const holesMode = useWatch({ control, name: "holesMode" });
  const usb = usbPinOf(item);

  const submit = handleSubmit(async (v) => {
    const opening =
      v.mode === "off"
        ? { off: true }
        : v.mode === "set"
          ? {
              ...(v.face ? { face: v.face } : {}),
              shape: v.shape,
              ...(n(v.width) !== undefined ? { width: n(v.width) } : {}),
              ...(v.shape === "rect" && n(v.height) !== undefined ? { height: n(v.height) } : {}),
              ...(n(v.shiftA) !== undefined || n(v.shiftB) !== undefined ? { shift: [n(v.shiftA) ?? 0, n(v.shiftB) ?? 0] } : {}),
            }
          : null;
    const mountingHoles = isBoard && v.holesMode === "set" ? v.holes.map((h) => ({ x: n(h.x) ?? 0, z: n(h.z) ?? 0, ...(n(h.diameter) !== undefined ? { diameter: n(h.diameter) } : {}) })) : null;
    try {
      await onSave({ opening, ...(isBoard ? { mountingHoles } : {}) });
    } catch (x) {
      setError("root", { message: (x as Error).message });
    }
  });

  const id = (k: string) => `po-${item.id}-${k}`;
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3" aria-label={`Enclosure settings for ${label}`}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-primary">Opening for {label}</legend>
        <div className="flex flex-wrap gap-4 text-sm text-primary">
          {(
            [
              ["auto", "Worked out from the part (a control or connector near a side wall or the lid)"],
              ["set", "Set here"],
              ["off", "No opening"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" value={v} {...register("mode")} className="accent-[#E05A10]" /> {l}
            </label>
          ))}
        </div>
        {usb && mode !== "set" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => { setValue("mode", "set"); setValue("face", usb.x < 0 ? "left" : usb.x > 0 ? "right" : usb.y < 0 ? "back" : "front"); }}>
            Add an opening for its USB connector ({usb.name})
          </Button>
        ) : null}
        {mode === "set" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id={id("face")} label="Wall">
              <NativeSelect id={id("face")} {...register("face")}>
                <option value="">The nearest wall</option>
                {FACES.map((f) => <option key={f} value={f}>{f}</option>)}
              </NativeSelect>
            </Field>
            <Field id={id("shape")} label="Shape">
              <NativeSelect id={id("shape")} {...register("shape")}>
                <option value="rect">Rectangle</option>
                <option value="circle">Circle</option>
              </NativeSelect>
            </Field>
            <Field id={id("width")} label="Width or diameter (mm)" hint="Empty: the part's size plus the opening margin." error={errors.width?.message}>
              <Input id={id("width")} inputMode="decimal" aria-invalid={!!errors.width} {...register("width")} />
            </Field>
            <Field id={id("height")} label="Height (mm)" error={errors.height?.message}>
              <Input id={id("height")} inputMode="decimal" aria-invalid={!!errors.height} {...register("height")} />
            </Field>
            <Field id={id("sa")} label="Shift along the wall (mm)" error={errors.shiftA?.message}>
              <Input id={id("sa")} inputMode="decimal" aria-invalid={!!errors.shiftA} {...register("shiftA")} />
            </Field>
            <Field id={id("sb")} label="Shift up or across (mm)" error={errors.shiftB?.message}>
              <Input id={id("sb")} inputMode="decimal" aria-invalid={!!errors.shiftB} {...register("shiftB")} />
            </Field>
          </div>
        ) : null}
      </fieldset>

      {isBoard ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-primary">Mounting holes</legend>
          <div className="flex flex-wrap gap-4 text-sm text-primary">
            <label className="flex items-center gap-2"><input type="radio" value="assumed" {...register("holesMode")} className="accent-[#E05A10]" /> Assumed: four, 3.5 mm in from the corners</label>
            <label className="flex items-center gap-2"><input type="radio" value="set" {...register("holesMode")} className="accent-[#E05A10]" /> The board&apos;s own holes</label>
          </div>
          {holesMode === "set" ? (
            <div className="space-y-2">
              <p className="text-xs text-secondary">Measured from the centre of the board, in mm: x to the right, z towards the front.</p>
              {holes.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                  <Field id={id(`hx${i}`)} label={`Hole ${i + 1} x`} error={errors.holes?.[i]?.x?.message}><Input id={id(`hx${i}`)} inputMode="decimal" {...register(`holes.${i}.x`)} /></Field>
                  <Field id={id(`hz${i}`)} label={`Hole ${i + 1} z`} error={errors.holes?.[i]?.z?.message}><Input id={id(`hz${i}`)} inputMode="decimal" {...register(`holes.${i}.z`)} /></Field>
                  <Field id={id(`hd${i}`)} label="Diameter" hint="Empty: 3.2" error={errors.holes?.[i]?.diameter?.message}><Input id={id(`hd${i}`)} inputMode="decimal" {...register(`holes.${i}.diameter`)} /></Field>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove hole ${i + 1}`} onClick={() => holes.remove(i)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => holes.append({ x: "", z: "", diameter: "" })} disabled={holes.fields.length >= 12}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add a hole
              </Button>
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {errors.root?.message ? <ErrorLine>{errors.root.message}</ErrorLine> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? "Saving" : "Save these settings"}</Button>
        {isSubmitSuccessful && !errors.root ? <span role="status" className="text-xs text-success">Saved. The parts list above follows.</span> : null}
      </div>
    </form>
  );
}
