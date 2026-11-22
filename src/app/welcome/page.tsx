import Link from "next/link";
import { ArrowDown, ArrowRight, Check, ExternalLink, Minus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/welcome/ThemeToggle";
import { AccessRequestForm } from "@/components/welcome/AccessRequestForm";
import { HeroBag } from "@/components/welcome/HeroBag";
import { DeparturesBoard } from "@/components/welcome/DeparturesBoard";
import { Journey } from "@/components/welcome/Journey";
import { Engineering } from "@/components/welcome/Engineering";
import { exampleData } from "@/components/welcome/exampleData";
import { LifecycleMap } from "@/components/welcome/LifecycleMap";
import { Sixty } from "@/components/welcome/Sixty";
import { PokeTheBag } from "@/components/welcome/PokeTheBag";
import { publicPageMetadata } from "@/components/welcome/meta";
import { AUDIENCE, BOARD, CLOSING, DEMO_NOTE, ENGINEERING, EXAMPLE, FAQ, GATES_NOTE, HERO, JOURNEY_INTRO, MAP, META, POKE, SIXTY, PRINCIPLES, PRODUCT, REPO_URL, RUN_COMMANDS, RUNS_ON } from "@/components/welcome/content";

export const generateMetadata = () => publicPageMetadata({ title: META.title, description: META.description, path: "/welcome" });

/*
 * The public page about the workbench, for a visitor who is not signed in (a signed-out visit to / lands here).
 * It tells one story: one idea, Baggage Claims MK1, followed from a joke to a product
 * (docs/ux-discovery/journey-idea-to-product.md). The motif is an airport: the stages have gates and the product
 * is luggage. Product copy is plain; the only jokes are the bag's own lines.
 *
 * A server component. Each moving piece is a small client component under src/components/welcome, drawn still
 * and complete by the server, so the page reads in full without script and under reduced motion.
 *
 *  1. Hero: the outcome in plain words, one primary action, and the bag speaking for itself.
 *  2. Departures board: the seven stages at a glance.
 *     Then the engineering, live: one dark stage of six tabs, each the app's own view on the example's rows
 *     (Engineering.tsx): 3D, schematic, physical layout, enclosure and print, parts list, build sheet.
 *  3. The trip in 60 seconds: six slides, one line and one drawing each (the make-or-break moments).
 *  4. The journey: one panel per stage: a screenshot, the example's own seeded rows (StageRows.tsx) or drawings
 *     with a link up to the live views, then the example's real figures and each stage's gate checks.
 *     On a phone it is a deck, one stage per slide.
 *  5. The whole trip on one map (React Flow): what feeds what; pick a node to see what depends on it.
 *     Then what it will not do, who it is for, what it runs on, and the toy as a small strip.
 *  6. What it will not do, who it is for, what it runs on.
 *  7. Get started (the demo, or the request form), questions, and the same primary action again.
 * There is no pricing or sign-up: the app has one shared demo account and no payment. No customers, counts or
 * logos appear, because none exist; the worked example is the proof.
 */

const WRAP = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
const H2 = "text-2xl font-semibold leading-tight tracking-tight text-primary sm:text-[1.75rem]";
const LEAD = "mt-3 max-w-[64ch] text-[15px] leading-relaxed text-secondary sm:text-base";

function PrimaryCta({ className = "" }: { className?: string }) {
  return (
    <Button asChild size="lg" className={`h-11 rounded-lg px-5 text-sm font-semibold ${className}`}>
      <Link href="/sign-in">
        Try the live workbench <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </Button>
  );
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};


const SECTION = "border-b border-hairline py-9 sm:py-11";

export default async function WelcomePage() {
  const example = await exampleData();
  return (
    <div className="min-h-[100dvh] bg-canvas text-primary">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-primary focus:ring-2 focus:ring-focus">
        Skip to the content
      </a>

      {/* Header and hero share the dark mood in both themes. */}
      <div className="dark bg-canvas text-primary">
        <header className="border-b border-hairline">
          <div className={`${WRAP} flex h-14 items-center justify-between gap-4`}>
            <Link href="/welcome" className="text-sm font-semibold text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
              {PRODUCT}
            </Link>
            <nav aria-label="On this page" className="hidden items-center gap-6 text-sm text-secondary md:flex">
              <a href="#engineering" className="hover:text-primary">The engineering</a>
              <a href="#journey" className="hover:text-primary">The journey</a>
              <a href="#map" className="hover:text-primary">The map</a>
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

        {/* 1. Hero */}
        <section aria-labelledby="hero-title" className="border-b border-hairline pb-9 pt-8 sm:pb-11 sm:pt-11">
          <div className={`${WRAP} grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-12`}>
            <div>
              <h1 id="hero-title" className="max-w-[20ch] text-[1.9375rem] font-semibold leading-[1.1] tracking-[-0.025em] text-primary sm:text-4xl lg:text-[2.625rem]">
                {HERO.title}
              </h1>
              <p className="mt-4 max-w-[76ch] text-[15px] leading-relaxed text-secondary sm:text-base">{HERO.sub}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
                <PrimaryCta />
                <a href="#journey" className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-link underline-offset-4 hover:underline">
                  {HERO.journeyLink} <ArrowDown className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <p className="mt-4 flex items-start gap-2 font-mono text-[11px] text-muted">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
                {HERO.status}
              </p>
            </div>
            <HeroBag />
          </div>
        </section>
      </div>

      <main id="main">
        {/* 2. Departures board */}
        <section id="board" aria-labelledby="board-title" className={`${SECTION} scroll-mt-4 bg-subtle`}>
          <div className={WRAP}>
            <h2 id="board-title" className={H2}>{BOARD.title}</h2>
            <p className={LEAD}>{BOARD.lead}</p>
          </div>
          {/* the board runs wider than the text column, so its flaps can be larger */}
          <div className="mx-auto mt-6 w-full max-w-[90rem] px-2 sm:px-6 lg:px-8">
            <DeparturesBoard />
          </div>
          <div className={WRAP}>
            <p className="mt-3 max-w-[72ch] text-[13px] leading-relaxed text-muted">{GATES_NOTE}</p>
          </div>
        </section>

        {/* The trip in 60 seconds */}
        <section id="sixty" aria-labelledby="sixty-title" className={`${SECTION} scroll-mt-4`}>
          <div className={WRAP}>
            <h2 id="sixty-title" className={H2}>{SIXTY.title}</h2>
            <p className={LEAD}>{SIXTY.lead}</p>
            <div className="mt-6">
              <Sixty cta={<PrimaryCta />} />
            </div>
          </div>
        </section>

        {/* The engineering, live: the app's own views on the example's rows */}
        <section id="engineering" aria-labelledby="engineering-title" className="dark scroll-mt-4 border-b border-hairline bg-canvas py-9 text-primary sm:py-11">
          <div className={WRAP}>
            <h2 id="engineering-title" className={H2}>{ENGINEERING.title}</h2>
            <p className={LEAD}>{ENGINEERING.lead}</p>
          </div>
          {/* the stage runs wider than the text column */}
          <div className="mx-auto mt-7 w-full max-w-[90rem] px-2 sm:px-6 lg:px-8">
            <Engineering parts={example.parts} wires={example.wires} enclosure={example.enclosure} />
            <p className="mt-3 max-w-[80ch] px-2 text-[13px] leading-relaxed text-muted sm:px-0">{ENGINEERING.note}</p>
          </div>
        </section>

        {/* 3. The journey */}
        <section id="journey" aria-labelledby="journey-title" className={`${SECTION} scroll-mt-4`}>
          <div className={WRAP}>
            <h2 id="journey-title" className={H2}>{JOURNEY_INTRO.title}</h2>
            <p className={LEAD}>{JOURNEY_INTRO.lead}</p>
            <div className="mt-9 lg:mt-11">
              <Journey rows={example} />
            </div>
          </div>
        </section>

        {/* 4. The whole trip on one map */}
        <section id="map" aria-labelledby="map-title" className={`${SECTION} scroll-mt-4 bg-subtle`}>
          <div className={WRAP}>
            <h2 id="map-title" className={H2}>{MAP.title}</h2>
            <p className={LEAD}>{MAP.lead}</p>
            <div className="mt-6">
              <LifecycleMap />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">{MAP.note}</p>
          </div>
        </section>

        {/* 6. What it will not do, who it is for, what it runs on */}
        <section aria-labelledby="trust-title" className={SECTION}>
          <div className={WRAP}>
            <h2 id="trust-title" className={H2}>What it will not do behind your back</h2>
            <p className={LEAD}>AI drafts. You decide. These rules hold on every screen.</p>
            <ul className="mt-6 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-5">
              {PRINCIPLES.map((p) => (
                <li key={p.title} className="border-t border-hairline py-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Check className="h-4 w-4 shrink-0 text-link" aria-hidden />
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="who-title" className={SECTION}>
          <div className={`${WRAP} grid grid-cols-1 gap-10 lg:grid-cols-12`}>
            <div className="lg:col-span-5">
              <h2 id="who-title" className={H2}>{AUDIENCE.title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-secondary">{AUDIENCE.types}</p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:col-span-7">
              <div>
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
              <div>
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

        <section id="run" aria-labelledby="run-title" className={`${SECTION} scroll-mt-4 bg-subtle`}>
          <div className={WRAP}>
            <h2 id="run-title" className={H2}>Runs on your machine, with your models and your keys</h2>
            <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2 sm:gap-y-6 lg:grid-cols-5">
              {RUNS_ON.map((r) => (
                <div key={r.title}>
                  <dt className="text-sm font-semibold text-primary">{r.title}</dt>
                  <dd className="mt-1.5 text-[13px] leading-relaxed text-secondary">{r.text}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
              <div className="lg:col-span-5">
                <h3 className="text-lg font-semibold tracking-tight text-primary">Run it yourself</h3>
                <p className="mt-3 text-sm leading-relaxed text-secondary">
                  You need Docker Desktop, or Docker Engine with Compose 2.24 or later. The first start brings the database up to date and loads {EXAMPLE.name}. Then open <span className="font-mono text-primary">http://localhost:3000</span>, sign in as demo / demo and choose your own password.
                </p>
                <p className="mt-4 text-sm">
                  <a href={REPO_URL} className="inline-flex items-center gap-1.5 font-medium text-link underline-offset-4 hover:underline" rel="noopener noreferrer">
                    The source on GitHub <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </p>
              </div>
              <div className="dark min-w-0 lg:col-span-7">
                <pre className="overflow-x-auto rounded-xl border border-hairline bg-canvas p-4 font-mono text-[13px] leading-6 text-secondary" aria-label="Commands to run the workbench with Docker" tabIndex={0}>
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

        {/* The toy, kept small */}
        <section id="poke" aria-labelledby="poke-title" className={`${SECTION} scroll-mt-4`}>
          <div className={`${WRAP} grid items-center gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10`}>
            <div>
              <h2 id="poke-title" className={H2}>{POKE.title}</h2>
              <p className={LEAD}>{POKE.lead}</p>
            </div>
            <PokeTheBag />
          </div>
        </section>

        {/* 7. Get started: the demo, or a workspace of one's own */}
        <section id="request" aria-labelledby="start-title" className={`${SECTION} scroll-mt-4 bg-subtle`}>
          <div className={`${WRAP} grid grid-cols-1 gap-12 lg:grid-cols-12`}>
            <div className="lg:col-span-5">
              <h2 id="start-title" className={H2}>Try it now, or ask for your own workspace</h2>
              <div className="mt-6 rounded-xl border border-hairline bg-surface p-6">
                <h3 className="text-base font-semibold text-primary">The live workbench</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">{DEMO_NOTE}</p>
                <p className="mt-2 text-sm leading-relaxed text-secondary">
                  Sign in as <span className="font-mono text-primary">demo</span> with the password <span className="font-mono text-primary">demo</span>. The account is public and shared: anyone who visits can read and change what is in it, and so can you. Please keep private ideas out of it.
                </p>
                <PrimaryCta className="mt-5" />
              </div>
            </div>
            <div className="lg:col-span-7">
              <h3 id="request-title" className="text-lg font-semibold tracking-tight text-primary">Request your own workspace</h3>
              <p className="mb-6 mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
                Tell us who you are and what you want to build. The request is stored here and the owner reads it in Admin. Nothing is sent by email yet, so the reply comes by hand.
              </p>
              <AccessRequestForm />
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title" className={`${SECTION} scroll-mt-4`}>
          <div className={`${WRAP} grid grid-cols-1 gap-10 lg:grid-cols-12`}>
            <div className="lg:col-span-4">
              <h2 id="faq-title" className={H2}>Straight answers</h2>
              <p className="mt-4 text-sm leading-relaxed text-secondary">
                A short form of these answers, with where to see each one in the app, is on the{" "}
                <Link href="/welcome/overview" className="text-link underline-offset-4 hover:underline">one-page overview</Link>, which prints on one sheet.
              </p>
            </div>
            <div className="divide-y divide-[var(--border-hairline)] rounded-xl border border-hairline bg-surface lg:col-span-8">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-5 py-0.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[15px] font-medium text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
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

        {/* The same action the page opened with. */}
        <section aria-labelledby="close-title" className="dark bg-canvas py-10 text-primary sm:py-12">
          <div className={WRAP}>
            <div className="max-w-3xl">
              <h2 id="close-title" className={H2}>{CLOSING.title}</h2>
              <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-secondary sm:text-base">{CLOSING.text}</p>
              <PrimaryCta className="mt-6" />
            </div>
          </div>
        </section>
      </main>

      <footer className="dark border-t border-hairline bg-canvas text-primary">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-muted`}>
          <p>{PRODUCT}. Free and self-hosted, under Apache 2.0.</p>
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
