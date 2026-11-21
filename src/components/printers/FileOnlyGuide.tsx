import Link from "next/link";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FILE_ONLY_STEPS } from "@/lib/printers/models";
import type { PrinterModel } from "@/lib/printers/models";

/**
 * "Download the file and how to get it to this printer" (plan 6.7). For a printer this app does not talk to: the file, and the steps.
 * The steps are the general ones the list carries, with the model's own page named so the person can read the maker's instructions.
 * `downloadHref` is the sliced file's address when the caller has one; without it the sentence says where the file comes from.
 */
export function FileOnlyGuide({ printerName, model, downloadHref, downloadLabel = "Download the file" }: { printerName: string; model?: PrinterModel; downloadHref?: string; downloadLabel?: string }) {
  return (
    <section aria-label={`Getting a file to ${printerName}`} className="space-y-2 rounded-md border border-hairline bg-subtle px-3 py-3 text-sm">
      <h3 className="text-sm font-semibold text-primary">Download the file and how to get it to this printer</h3>
      <p className="text-secondary">
        This app does not talk to {printerName}, so you carry the file there yourself.
        {downloadHref ? "" : " The sliced file is on the print job."}
      </p>
      {downloadHref ? (
        <a href={downloadHref} download className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Download className="h-3.5 w-3.5" aria-hidden /> {downloadLabel}
        </a>
      ) : null}
      <ol className="list-decimal space-y-1 pl-5 text-secondary">
        {FILE_ONLY_STEPS.value.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {model ? (
        <p className="text-xs text-muted">
          The maker&apos;s page for the {model.maker} {model.model}:{" "}
          <a href={model.source} target="_blank" rel="noreferrer" className="break-all text-link underline underline-offset-2">
            {model.source}
          </a>
        </p>
      ) : (
        <p className="text-xs text-muted">
          Pick the model in <Link href="/admin?tab=printers" className="text-link underline underline-offset-2">Admin, Printers</Link> to see the maker&apos;s page for it here.
        </p>
      )}
    </section>
  );
}
