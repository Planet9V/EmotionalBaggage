import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Minus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/welcome/ThemeToggle";
import { Shot } from "@/components/welcome/Shot";
import { AccessRequestForm } from "@/components/welcome/AccessRequestForm";
import { publicPageMetadata } from "@/components/welcome/meta";
import { AUDIENCE, CLOSING, FAQ, FEATURES, GATES_NOTE, HERO, META, PRINCIPLES, PROBLEM, PRODUCT, REPO_URL, RUN_COMMANDS, RUNS_ON, STAGES } from "@/components/welcome/content";

export const generateMetadata = () => publicPageMetadata({ title: META.title, description: META.description, path: "/welcome" });

/*
 * The public page about the workbench, for a visitor who is not signed in (a signed-out visit to / lands here).
 * A server component: the only browser code is the theme switch and the request form.
 *
 * Order, and why (landing-page-generator, copywriting-psychologist, sales-enablement):
 *  1. Hero: one promise (idea to tested prototype and launch plan) and one primary action, the live demo, which is
 *     the lowest-effort next step. The demo's sharing is stated beside the button, where doubt starts.
 *  2. The problem: the reader is problem-aware (ten tools); before and after pairs name the pain in their words.
 *  3. How it works: the seven stages, so the reader sees the whole path before the detail.
 *  4. What you get: real screenshots, proof placed where scepticism rises, in the order a product moves.
 *  5. What it will not do: the reader of AI tools is sceptical; the guarantees answer that before it is asked.
 *  6. Who it is for, and who it is not for yet: self-selection keeps the promise honest.
 *  7. What it runs on: self-hosted, own models and keys, free; then the commands to run it.
 *  8. Get started: try the demo now, or request a workspace (the real form).
 *  9. FAQ: the remaining objections. 10. Closing call to action.
 * There is deliberately no row of headline numbers anywhere on the page.
 */

const WRAP = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.2em] text-link";
const H2 = "text-display-3 font-semibold tracking-tight text-primary";
const LEAD = "mt-4 max-w-3xl text-base leading-relaxed text-secondary sm:text-lg";

function PrimaryCta({ className = "" }: { className?: string }) {
  return (
    <Button asChild size="lg" className={`h-11 rounded-xl px-6 text-sm font-semibold ${className}`}>
      <Link href="/sign-in">
        Try the live workbench <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </Button>
  );
}

function SecondaryCta() {
  return (
    <Button asChild variant="outline" size="lg" className="h-11 rounded-xl bg-transparent px-6 text-sm font-semibold text-primary">
      <a href="#request">Request your own workspace</a>
    </Button>
  );
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function WelcomePage() {
  return (
    <div className="min-h-[100dvh] bg-canvas text-primary">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-primary focus:ring-2 focus:ring-focus">
        Skip to the content
      </a>

      {/* Header and hero share the dark mood in both themes. */}
      <div className="dark bg-canvas text-primary">
        <header className="border-b border-hairline">
          <div className={`${WRAP} flex h-16 items-center justify-between gap-4`}>
            <Link href="/welcome" className="flex flex-col leading-tight focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Concept to realization</span>
              <span className="text-sm font-semibold text-primary">Product workbench</span>
            </Link>
            <nav aria-label="On this page" className="hidden items-center gap-6 text-sm text-secondary md:flex">
              <a href="#how" className="hover:text-primary">How it works</a>
              <a href="#what" className="hover:text-primary">What you get</a>
              <a href="#run" className="hover:text-primary">Run it yourself</a>
              <a href="#faq" className="hover:text-primary">Questions</a>
            </nav>
            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <Link href="/sign-in" className="hidden h-9 items-center rounded-md px-3 text-sm font-medium text-primary hover:text-link sm:inline-flex">
                Sign in
              </Link>
            </div>
          </div>
        </header>

        <section aria-labelledby="hero-title" className="border-b border-hairline pb-16 pt-14 sm:pt-20">
          <div className={WRAP}>
            <div className="max-w-4xl">
              <p className="inline-flex items-center rounded-full border border-[var(--accent-orange-border)] bg-[var(--accent-orange-subtle)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-link">
                {HERO.eyebrow}
              </p>
              <h1 id="hero-title" className="mt-6 text-3xl font-semibold leading-[1.12] tracking-tight text-primary sm:text-4xl lg:text-5xl">
                {HERO.titleBefore}
                <span className="text-dutchOrange">{HERO.titleAccent}</span>
                {HERO.titleAfter}
              </h1>
              <p className="mt-6 max-w-3xl text-base font-light leading-relaxed text-secondary sm:text-lg">{HERO.sub}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <PrimaryCta className="animate-glow motion-reduce:animate-none" />
                <SecondaryCta />
              </div>
              <p className="mt-5 flex items-start gap-2 font-mono text-xs text-muted">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-dutchOrange motion-safe:animate-pulse" aria-hidden />
                {HERO.status}
              </p>
            </div>
            <figure className="mt-12">
              <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-2.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-hairline)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-hairline)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-hairline)]" />
                  <span className="ml-3 font-mono text-[11px] text-muted">/s/design/schematic</span>
                </div>
                <Shot name="schematic" theme="dark" eager alt={FEATURES[0]!.alt} />
              </div>
              <figcaption className="mt-3 text-xs text-muted">The schematic of the example concept, Baggage Claims MK1, as the app draws it. Screenshot of the running app.</figcaption>
            </figure>
          </div>
        </section>
      </div>

      <main id="main">
        {/* 2. The problem */}
        <section aria-labelledby="problem-title" className="border-b border-hairline py-20">
          <div className={WRAP}>
            <p className={EYEBROW}>The problem</p>
            <h2 id="problem-title" className={`mt-3 max-w-3xl ${H2}`}>{PROBLEM.title}</h2>
            <p className={LEAD}>{PROBLEM.lead}</p>
            <div className="mt-10 overflow-hidden rounded-2xl border border-hairline bg-surface">
              <div className="hidden grid-cols-2 border-b border-hairline bg-subtle px-6 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted sm:grid">
                <span>Spread over separate tools</span>
                <span>In the workbench</span>
              </div>
              <ul>
                {PROBLEM.pairs.map((p) => (
                  <li key={p.before} className="grid gap-2 border-b border-hairline px-6 py-5 last:border-b-0 sm:grid-cols-2 sm:gap-8">
                    <p className="flex gap-3 text-sm text-secondary">
                      <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <span><span className="sr-only">Spread over separate tools: </span>{p.before}</span>
                    </p>
                    <p className="flex gap-3 text-sm text-primary">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-link" aria-hidden />
                      <span><span className="sr-only">In the workbench: </span>{p.after}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 3. How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-4 border-b border-hairline bg-subtle py-20">
          <div className={WRAP}>
            <p className={EYEBROW}>How it works</p>
            <h2 id="how-title" className={`mt-3 ${H2}`}>Seven stages, the same for every product</h2>
            <p className={LEAD}>Every concept moves through the same seven stages with the same structure, so what you learn on one product carries to the next. Work down the stages in order, or jump to the one you need.</p>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-[var(--border-hairline)] sm:grid-cols-2 lg:grid-cols-4">
              {STAGES.map((s) => (
                <li key={s.n} className="bg-surface p-6">
                  <p className="font-mono text-xs text-link">{s.n}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-primary">{s.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{s.text}</p>
                </li>
              ))}
              <li className="bg-surface p-6">
                <p className="font-mono text-xs text-link">Gates</p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-primary">Between the stages</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">{GATES_NOTE}</p>
              </li>
            </ol>
          </div>
        </section>

        {/* 4. What you get */}
        <section id="what" aria-labelledby="what-title" className="scroll-mt-4 border-b border-hairline py-20">
          <div className={WRAP}>
            <p className={EYEBROW}>What you get</p>
            <h2 id="what-title" className={`mt-3 ${H2}`}>Shown as the app draws it</h2>
            <p className={LEAD}>
              Every picture below is a screenshot of the running app with its example concept, Baggage Claims MK1: a motion-reactive audio gadget that straps to a suitcase. Nothing is mocked up. Switch the theme at the top and the pictures switch with it.
            </p>
            <div className="mt-14 space-y-20">
              {FEATURES.map((f, i) => (
                <article key={f.shot} aria-labelledby={`f-${f.shot}`} className="grid items-center gap-8 grid-cols-1 lg:grid-cols-12 lg:gap-12">
                  <div className={`lg:col-span-4 ${i % 2 ? "lg:order-2" : ""}`}>
                    <p className="font-mono text-xs text-link">{f.stage}</p>
                    <h3 id={`f-${f.shot}`} className="mt-2 text-xl font-semibold tracking-tight text-primary sm:text-2xl">{f.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-secondary sm:text-base">{f.text}</p>
                    {f.note ? <p className="mt-3 rounded-lg border border-hairline bg-subtle px-3 py-2 text-xs leading-relaxed text-secondary">{f.note}</p> : null}
                  </div>
                  <figure className={`lg:col-span-8 ${i % 2 ? "lg:order-1" : ""}`}>
                    <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)]">
                      <Shot name={f.shot} alt={f.alt} />
                    </div>
                  </figure>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. What it will not do */}
        <section aria-labelledby="trust-title" className="border-b border-hairline bg-subtle py-20">
          <div className={WRAP}>
            <p className={EYEBROW}>Trust</p>
            <h2 id="trust-title" className={`mt-3 ${H2}`}>What it will not do behind your back</h2>
            <p className={LEAD}>AI helps with the drafting. You keep the decisions. These rules hold on every screen.</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PRINCIPLES.map((p) => (
                <li key={p.title} className="rounded-xl border border-hairline bg-surface p-6">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-primary">
                    <Check className="h-4 w-4 text-link" aria-hidden />
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6. Who it is for */}
        <section aria-labelledby="who-title" className="border-b border-hairline py-20">
          <div className={`${WRAP} grid gap-12 grid-cols-1 lg:grid-cols-12`}>
            <div className="lg:col-span-5">
              <p className={EYEBROW}>Who it is for</p>
              <h2 id="who-title" className={`mt-3 ${H2}`}>{AUDIENCE.title}</h2>
              <p className="mt-4 text-base leading-relaxed text-secondary">{AUDIENCE.lead}</p>
              <p className="mt-4 text-sm leading-relaxed text-secondary">{AUDIENCE.types}</p>
            </div>
            <div className="grid gap-6 lg:col-span-7 sm:grid-cols-2">
              <div className="rounded-xl border border-hairline bg-surface p-6">
                <h3 className="text-base font-semibold text-primary">A good fit</h3>
                <ul className="mt-3 space-y-3">
                  {AUDIENCE.fit.map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm text-secondary">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-link" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-hairline bg-surface p-6">
                <h3 className="text-base font-semibold text-primary">Not a fit yet</h3>
                <ul className="mt-3 space-y-3">
                  {AUDIENCE.notYet.map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm text-secondary">
                      <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 7. What it runs on, and running it */}
        <section id="run" aria-labelledby="run-title" className="scroll-mt-4 border-b border-hairline bg-subtle py-20">
          <div className={WRAP}>
            <p className={EYEBROW}>Self-hosted</p>
            <h2 id="run-title" className={`mt-3 ${H2}`}>Runs on your machine, with your models and your keys</h2>
            <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {RUNS_ON.map((r) => (
                <div key={r.title} className="border-l-2 border-dutchOrange pl-4">
                  <dt className="text-base font-semibold text-primary">{r.title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-secondary">{r.text}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-12 grid gap-8 grid-cols-1 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">
                <h3 className="text-xl font-semibold tracking-tight text-primary">Run it yourself</h3>
                <p className="mt-3 text-sm leading-relaxed text-secondary">
                  You need Docker Desktop, or Docker Engine with Compose 2.24 or later. The first start brings the database up to date and loads the example concept. Then open <span className="font-mono text-primary">http://localhost:3000</span>, sign in as demo / demo and choose your own password.
                </p>
                <p className="mt-4 text-sm">
                  <a href={REPO_URL} className="inline-flex items-center gap-1.5 font-medium text-link underline-offset-4 hover:underline" rel="noopener noreferrer">
                    The source on GitHub <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </p>
              </div>
              <div className="dark min-w-0 lg:col-span-7">
                <pre className="overflow-x-auto rounded-xl border border-hairline bg-canvas p-5 font-mono text-[13px] leading-7 text-secondary" aria-label="Commands to run the workbench with Docker" tabIndex={0}>
                  <code>
                    {RUN_COMMANDS.map((c) => (
                      <span key={c} className="block">
                        <span className="select-none text-dutchOrange" aria-hidden>$ </span>
                        <span className="text-primary">{c}</span>
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Get started: the demo, or a workspace of one's own */}
        <section id="request" aria-labelledby="start-title" className="scroll-mt-4 border-b border-hairline py-20">
          <div className={`${WRAP} grid gap-12 grid-cols-1 lg:grid-cols-12`}>
            <div className="lg:col-span-5">
              <p className={EYEBROW}>Get started</p>
              <h2 id="start-title" className={`mt-3 ${H2}`}>Try it now, or ask for your own workspace</h2>
              <div className="mt-6 rounded-xl border border-hairline bg-surface p-6">
                <h3 className="text-base font-semibold text-primary">The live workbench</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">
                  Sign in as <span className="font-mono text-primary">demo</span> with the password <span className="font-mono text-primary">demo</span>. The account is public and shared: anyone who visits can read and change what is in it, and so can you. Please keep private ideas out of it.
                </p>
                <PrimaryCta className="mt-5" />
              </div>
            </div>
            <div className="lg:col-span-7">
              <h3 id="request-title" className="text-xl font-semibold tracking-tight text-primary">Request your own workspace</h3>
              <p className="mt-2 mb-6 max-w-2xl text-sm leading-relaxed text-secondary">
                Tell us who you are and what you want to build. The request is stored here and the owner reads it in Admin. Nothing is sent by email yet, so the reply comes by hand.
              </p>
              <AccessRequestForm />
            </div>
          </div>
        </section>

        {/* 9. Questions */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-4 border-b border-hairline bg-subtle py-20">
          <div className={`${WRAP} grid gap-10 grid-cols-1 lg:grid-cols-12`}>
            <div className="lg:col-span-4">
              <p className={EYEBROW}>Questions</p>
              <h2 id="faq-title" className={`mt-3 ${H2}`}>Straight answers</h2>
              <p className="mt-4 text-sm leading-relaxed text-secondary">
                A short form of these answers, with where to see each one in the app, is on the{" "}
                <Link href="/welcome/overview" className="text-link underline-offset-4 hover:underline">one-page overview</Link>, which prints on one sheet.
              </p>
            </div>
            <div className="divide-y divide-[var(--border-hairline)] rounded-xl border border-hairline bg-surface lg:col-span-8">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-6 py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-medium text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
                  </summary>
                  <p className="pb-5 text-sm leading-relaxed text-secondary">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
        </section>

        {/* 10. Closing */}
        <section aria-labelledby="close-title" className="dark bg-canvas py-20 text-primary">
          <div className={WRAP}>
            <div className="max-w-3xl">
              <h2 id="close-title" className={H2}>{CLOSING.title}</h2>
              <p className="mt-4 text-base leading-relaxed text-secondary sm:text-lg">{CLOSING.text}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryCta />
                <SecondaryCta />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="dark border-t border-hairline bg-canvas text-primary">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-muted`}>
          <p>{PRODUCT} · free and self-hosted · Apache 2.0</p>
          <nav aria-label="More" className="flex flex-wrap items-center gap-5">
            <Link href="/welcome/overview" className="inline-flex items-center gap-1.5 hover:text-primary">
              <Printer className="h-3.5 w-3.5" aria-hidden /> One-page overview
            </Link>
            <a href={REPO_URL} rel="noopener noreferrer" className="hover:text-primary">Source on GitHub</a>
            <Link href="/sign-in" className="hover:text-primary">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
