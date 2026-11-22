"use client";

// A model and a voice from the configured voice service's live list, with what the model accepts shown under it:
// how a direction reaches it, its supported parameters and its price per character. Without a list (the service
// cannot be reached, or lists nothing) both are typed.
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/ui/field";
import type { Catalog, CatalogModel } from "@/lib/voice/catalog";
import { MODE_LABEL } from "./useVoiceovers";

const price = (m: CatalogModel) => (m.pricePerChar === null ? "price per character unknown" : m.pricePerChar === 0 ? "free" : `$${(m.pricePerChar * 1_000_000).toFixed(2)} per million characters`);

/** One line on what a model takes. */
export function ModelFacts({ model }: { model: CatalogModel | undefined }) {
  if (!model) return null;
  return (
    <p className="text-xs leading-relaxed text-muted">
      Direction: <span className="text-secondary">{MODE_LABEL[model.mode]}</span>. {model.modeWhy} Parameters: {model.parameters.length ? model.parameters.join(", ") : "not listed"}; {price(model)}.
      {model.note ? <span className="font-medium text-warning"> {model.note}</span> : null}
    </p>
  );
}

export function ModelPicker({
  id,
  catalog,
  model,
  voice,
  onModel,
  onVoice,
  placeholder,
}: {
  id: string;
  catalog: Catalog | undefined;
  model: string;
  voice: string;
  onModel: (v: string) => void;
  onVoice: (v: string) => void;
  /** shown when the field is left empty: whose choice is then used */
  placeholder?: string;
}) {
  const models = catalog?.ok ? catalog.models : [];
  const chosen = models.find((m) => m.id === model);
  const voices = chosen?.voices ?? [];
  return (
    <>
      <Field id={`${id}-model`} label="Model">
        {models.length ? (
          <NativeSelect id={`${id}-model`} value={chosen ? model : ""} onChange={(e) => onModel(e.target.value)}>
            <option value="">{placeholder ?? "Choose a model"}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ? `${m.name} (${m.id})` : m.id}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <Input id={`${id}-model`} spellCheck={false} placeholder={placeholder} value={model} onChange={(e) => onModel(e.target.value)} />
        )}
      </Field>
      <Field id={`${id}-voice`} label="Voice">
        {voices.length ? (
          <NativeSelect id={`${id}-voice`} value={voices.includes(voice) ? voice : ""} onChange={(e) => onVoice(e.target.value)}>
            <option value="">{placeholder ?? "Choose a voice"}</option>
            {voices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <Input id={`${id}-voice`} spellCheck={false} placeholder={placeholder} value={voice} onChange={(e) => onVoice(e.target.value)} />
        )}
      </Field>
    </>
  );
}
