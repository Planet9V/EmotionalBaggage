import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Fact, PrinterModel } from "@/lib/printers/models";
import { ADAPTER_LABEL, CONFIRMED_TEXT, monthText, volumeText } from "./format";

function Source({ href, label = "source" }: { href: string; label?: string }) {
  if (!href.startsWith("http")) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="ml-1.5 whitespace-nowrap text-xs text-link underline underline-offset-2" aria-label={`${label}, opens the page this fact came from`}>
      {label}
    </a>
  );
}

function Line({ label, fact, show }: { label: string; fact?: Fact<unknown>; show: (v: never) => React.ReactNode }) {
  if (!fact) return null;
  return (
    <div className="grid gap-x-4 sm:grid-cols-[8rem_1fr]">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-primary">
        {show(fact.value as never)}
        <Source href={fact.source} />
      </dd>
    </div>
  );
}

/**
 * Everything the list knows about one model, each fact with the page it came from. A fact the list could not source is not shown at all.
 * Used in Admin, Printers when a model is chosen and on the supported-printers page.
 */
export function ModelFacts({ model: m }: { model: PrinterModel }) {
  const fileOnly = m.adapter === "file-only";
  return (
    <div className="space-y-3 text-sm" data-testid={`model-facts-${m.id}`}>
      <dl className="space-y-1.5">
        <div className="grid gap-x-4 sm:grid-cols-[8rem_1fr]">
          <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted sm:pt-0.5">Connection</dt>
          <dd className="min-w-0 text-primary">
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusBadge tone={fileOnly ? "neutral" : "info"}>{ADAPTER_LABEL[m.adapter]}</StatusBadge>
              {m.experimental ? <StatusBadge tone="warning">Experimental</StatusBadge> : null}
            </span>
            <span className="mt-1 block text-secondary">
              {fileOnly ? "No connection was confirmed for this model. You download the file and carry it to the printer." : CONFIRMED_TEXT[m.confirmed]}
              <Source href={m.source} label="model page" />
            </span>
          </dd>
        </div>
        <Line label="Released" fact={m.released} show={(v: string) => monthText(v)} />
        <Line label="Build volume" fact={m.volume} show={(v: { x: number; y: number; z: number; note?: string }) => volumeText(v)} />
        <Line label="Nozzles" fact={m.nozzles} show={(v: number[]) => v.map((n) => `${n} mm`).join(", ")} />
        <Line label="Materials" fact={m.materials} show={(v: string[]) => v.join(", ")} />
        <Line label="Note" fact={m.note} show={(v: string) => v} />
      </dl>
      {m.atPrinter ? (
        <div>
          <h4 className="text-xs font-semibold text-primary">
            What to switch on at the printer
            <Source href={m.atPrinter.source} />
          </h4>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-secondary">
            {m.atPrinter.value.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {m.firmwareNote ? (
        <div>
          <h4 className="text-xs font-semibold text-primary">
            Firmware and Developer Mode
            <Source href={m.firmwareNote.source} />
          </h4>
          <p className="mt-1 text-secondary">{m.firmwareNote.value}</p>
        </div>
      ) : null}
    </div>
  );
}
