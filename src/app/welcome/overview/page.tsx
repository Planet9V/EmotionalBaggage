import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/welcome/ThemeToggle";
import { PrintButton } from "@/components/welcome/PrintButton";
import { publicPageMetadata } from "@/components/welcome/meta";
import { FAQ, PRINCIPLES, PROBLEM, PRODUCT, REPO_URL, RUN_COMMANDS, RUNS_ON, STAGES } from "@/components/welcome/content";

export const generateMetadata = () =>
  publicPageMetadata({
    title: "Concept to Realization: one-page overview",
    description: "What the workbench is, the seven stages, what it will not do, what it runs on, and straight answers to the usual objections. Prints on one sheet.",
    path: "/welcome/overview",
  });

/*
 * The one-page overview (sales-enablement: the leave-behind a champion forwards). Problem in one line, what it
 * is, the seven stages, three differences, what it runs on, the objections as a quick-reference table with where
 * to see each answer in the app, and the next step. It prints on A4 or Letter with the print rules in
 * globals.css (.no-print hides the controls). No logos, customers, figures or prices: none exist to cite.
 */
export default function OverviewPage() {
  const differences = PRINCIPLES.slice(0, 3);
  return (
    <div className="min-h-[100dvh] bg-canvas text-primary print:bg-white">
      <div className="no-print border-b border-hairline">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/welcome" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the welcome page
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <PrintButton />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-10 text-[13px] leading-relaxed sm:px-6 print:max-w-none print:p-0 print:text-[8.5pt] print:leading-snug">
        {/* One sheet: A4 and Letter both fit with these margins at this size (checked by printing to PDF). */}
        <style>{"@page { margin: 11mm 12mm; }"}</style>
        <header className="border-b border-hairline pb-5 print:pb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">One-page overview · free · self-hosted</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary print:text-[16pt]">{PRODUCT}</h1>
          <p className="mt-2 max-w-3xl text-base text-secondary print:text-[9.5pt]">
            A workbench that takes one product idea from the first brief to a tested prototype, a costed parts list and a launch plan, in seven stages.
          </p>
        </header>

        <section aria-labelledby="ov-problem" className="mt-6 print:mt-2">
          <h2 id="ov-problem" className="text-sm font-semibold uppercase tracking-wider text-primary">The problem</h2>
          <p className="mt-1 text-secondary">{PROBLEM.lead}</p>
        </section>

        <section aria-labelledby="ov-stages" className="mt-6 print:mt-2">
          <h2 id="ov-stages" className="text-sm font-semibold uppercase tracking-wider text-primary">The seven stages</h2>
          <ol className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 print:grid-cols-2">
            {STAGES.map((s) => (
              <li key={s.n} className="text-secondary">
                <span className="font-mono text-link">{s.n}</span> <span className="font-semibold text-primary">{s.name}.</span> {s.text}
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 print:mt-2 print:grid-cols-2 print:gap-4">
          <section aria-labelledby="ov-diff">
            <h2 id="ov-diff" className="text-sm font-semibold uppercase tracking-wider text-primary">Three differences</h2>
            <ul className="mt-2 space-y-1.5">
              {differences.map((p) => (
                <li key={p.title} className="text-secondary">
                  <span className="font-semibold text-primary">{p.title}.</span> {p.text}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="ov-runs">
            <h2 id="ov-runs" className="text-sm font-semibold uppercase tracking-wider text-primary">What it runs on</h2>
            <ul className="mt-2 space-y-1.5">
              {RUNS_ON.slice(0, 4).map((r) => (
                <li key={r.title} className="text-secondary">
                  <span className="font-semibold text-primary">{r.title}.</span> {r.text}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="ov-objections" className="mt-6 print:mt-2">
          <h2 id="ov-objections" className="text-sm font-semibold uppercase tracking-wider text-primary">Objections, answered</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="py-1.5 pr-4 print:py-1 font-normal">Question</th>
                  <th scope="col" className="py-1.5 pr-4 print:py-1 font-normal">Answer</th>
                  <th scope="col" className="py-1.5 font-normal">Where to see it</th>
                </tr>
              </thead>
              <tbody>
                {FAQ.map((f) => (
                  <tr key={f.q} className="border-b border-hairline align-top">
                    <th scope="row" className="py-1.5 pr-4 print:py-1 font-medium text-primary">{f.q}</th>
                    <td className="py-1.5 pr-4 print:py-1 text-secondary">{f.short}</td>
                    <td className="py-1.5 text-muted print:py-1">{f.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="ov-next" className="mt-6 print:mt-2 print:break-inside-avoid">
          <h2 id="ov-next" className="text-sm font-semibold uppercase tracking-wider text-primary">Next step</h2>
          <ul className="mt-2 space-y-1.5 text-secondary">
            <li>
              <span className="font-semibold text-primary">Try the live workbench:</span> open <span className="font-mono">/sign-in</span> on this site and sign in as demo / demo. The account is shared with everyone; keep private ideas out of it.
            </li>
            <li>
              <span className="font-semibold text-primary">Run it yourself:</span> <span className="font-mono">{RUN_COMMANDS.join(" && ")}</span>, then open http://localhost:3000. Source: <span className="font-mono">{REPO_URL}</span>
            </li>
            <li>
              <span className="font-semibold text-primary">Ask for a workspace:</span> the form at <span className="font-mono">/welcome#request</span>. Requests are stored for the owner; no email is sent by the app.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
