import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FILE_ONLY_STEPS, modelsByMaker, type PrinterModel } from "@/lib/printers/models";
import { ADAPTER_LABEL, monthText, volumeText } from "./format";
import { ModelFacts } from "./ModelFacts";
import { slugify } from "@/lib/format";
import { Card } from "@/components/ui/Card";


function Row({ m }: { m: PrinterModel }) {
  const fileOnly = m.adapter === "file-only";
  return (
    <details className="group border-b border-hairline last:border-b-0" id={m.id}>
      <summary className="grid cursor-pointer list-none gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_8rem_10rem]">
        <span className="min-w-0 font-medium text-primary">
          {m.model}
          <span className="ml-2 text-xs font-normal text-muted group-open:hidden">Show how to connect</span>
          <span className="ml-2 hidden text-xs font-normal text-muted group-open:inline">Hide</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={fileOnly ? "neutral" : "info"}>{ADAPTER_LABEL[m.adapter]}</StatusBadge>
          {m.experimental ? <StatusBadge tone="warning">Experimental</StatusBadge> : null}
        </span>
        <span className="text-xs text-secondary">{m.released ? monthText(m.released.value) : "release not sourced"}</span>
        <span className="text-xs text-secondary">{m.volume ? volumeText(m.volume.value) : "volume not sourced"}</span>
      </summary>
      <div className="space-y-3 bg-subtle px-4 py-4">
        <ModelFacts model={m} />
      </div>
    </details>
  );
}

/** The supported-printer list as a documentation page: every model with its adapter and the page each fact came from (plan 6.0). */
export function SupportedPrinters() {
  const groups = modelsByMaker();
  const total = groups.reduce((n, g) => n + g.models.length, 0);
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Supported printers"
        blurb={`${total} models, from the makers' own pages where they publish one. Every fact has a link to the page it came from, and a fact that could not be sourced is left out rather than guessed.`}
        nextStep={false}
      />
      <div className="px-8 py-6">
      <p className="max-w-3xl text-sm text-secondary">
        A model with a connection says which one and what to switch on at the printer. A model whose connection could not be confirmed is file only: you download the file and carry it to the printer.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-secondary">
        Nothing here was tried against a real printer. Add the printer in <Link href="/admin?tab=printers" className="text-link underline underline-offset-2">Admin, Printers</Link> and use its Test button: that is the check.
        Models marked experimental are built to documentation that does not name them, and are labelled so.
      </p>

      <nav aria-label="Makers" className="mt-6 flex max-w-4xl flex-wrap gap-2">
        {groups.map((g) => (
          <a key={g.maker} href={`#${slugify(g.maker)}`} className="rounded-full border border-hairline px-3 py-1 text-xs text-secondary transition-colors hover:border-dutchOrange/40 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
            {g.maker}
          </a>
        ))}
      </nav>

      <div className="mt-8 max-w-5xl space-y-8">
        {groups.map((g) => (
          <section key={g.maker} id={slugify(g.maker)} aria-labelledby={`${slugify(g.maker)}-h`} className="scroll-mt-6">
            <h2 id={`${slugify(g.maker)}-h`} className="text-lg font-semibold tracking-tight text-primary">{g.maker}</h2>
            <Card variant="flat" className="mt-3 overflow-hidden">
              <div className="hidden gap-x-4 border-b border-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_8rem_10rem]" aria-hidden>
                <span>Model</span>
                <span>Connection</span>
                <span>Released</span>
                <span>Build volume</span>
              </div>
              {g.models.map((m) => (
                <Row key={m.id} m={m} />
              ))}
            </Card>
          </section>
        ))}

        <section aria-labelledby="by-hand-h" className="max-w-3xl">
          <h2 id="by-hand-h" className="text-lg font-semibold tracking-tight text-primary">A printer that is file only, or not on the list</h2>
          <p className="mt-2 text-sm text-secondary">The print flow gives you the sliced file to download. These are the steps for getting it onto the printer:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-secondary">
            {FILE_ONLY_STEPS.value.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      </div>
      </div>
    </>
  );
}
