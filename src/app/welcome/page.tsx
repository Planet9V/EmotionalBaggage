import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Minus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/welcome/ThemeToggle";
import { HeroFlow } from "@/components/welcome/HeroFlow";
import { WhatYouGet } from "@/components/welcome/WhatYouGet";
import { DraftChain } from "@/components/welcome/DraftChain";
import { OriginScenes } from "@/components/welcome/scenes/OriginScenes";
import { DeparturesBoard } from "@/components/welcome/DeparturesBoard";
import { Journey } from "@/components/welcome/Journey";
import { Engineering } from "@/components/welcome/Engineering";
import { Market } from "@/components/welcome/Market";
import { connection } from "next/server";
import { Levels } from "@/components/welcome/Levels";
import { publicLevels } from "@/lib/admin/plans";
import { exampleData } from "@/components/welcome/exampleData";
import { storyData } from "@/components/welcome/storyData";
import { LifecycleMap } from "@/components/welcome/LifecycleMap";
import { publicPageMetadata } from "@/components/welcome/meta";
import { AUDIENCE, BOARD, CLOSING, ENGINEERING, EXAMPLE, FAQ, FAST, GATES_NOTE, GET, HERO, JOURNEY_INTRO, MAP, MARKET, META, NAV, PRODUCT, REPO_URL, RUN_COMMANDS, RUNS_ON, YOUR_TURN, boardStates } from "@/components/welcome/content";

export const generateMetadata = () => publicPageMetadata({ title: META.title, description: META.description, path: "/welcome" });

/*
 * The public page about the service, for a visitor who is not signed in (a signed-out visit to / lands here).
 * It sells the service, not the example (docs/research/landing/proposition-brief.md): the visitor's idea, taken
 * from concept to product to market, with AI drafting each stage from the last and the visitor deciding. Baggage
 * Claims MK1 is the worked example: the data inside every proof, the origin story, and the honest status. Product
 * copy is plain; the only jokes are the bag's own lines, in "It started as a joke".
 *
 * A server component. Each moving piece is a small client component under src/components/welcome, drawn still
 * and complete by the server, so the page reads in full without script and under reduced motion.
 *
 *  0. Hero: the proposition, one primary action (request access), and the transformation itself: an idea typed
 *     as one line, then the stage outputs one after another, from Idea to On sale (HeroFlow).
 *  1. What you get: the outcome of each stage, as Make it and Sell it (WhatYouGet).
 *  2. How it goes fast: AI drafts, you approve, the next stage is drafted from it (DraftChain); the guarantees.
 *  3. It started as a joke: the origin of the example (OriginScenes, a wrapper the animated scenes go into).
 *  4. The engineering, live: one stage of six tabs, each the app's own view on the example's rows (Engineering).
 *  5. Then it went to market: one stage of seven tabs at the same weight (Market).
 *  6. Where Baggage Claims is today: the departures board, its statuses worked out from the true gates, and the
 *     journey gate by gate with every check (Journey).
 *  7. The whole trip on one map (React Flow).
 *  8. Your turn: the four service levels and the request form (Levels).
 *  9. Who it is for, run it yourself, questions, and the same primary action again.
 * Accounts and payment are not built, and the page says so: the levels ask for access, and prices stay off the
 * page until the owner turns them on in Admin, Pricing and tiers. The levels are read from that catalogue on each
 * request (connection() below), so a change there shows without a deploy; with nothing saved, or the database
 * unreachable, the built-in levels of content.ts show, prices hidden. No customers, counts or logos appear, because
 * none exist; the worked example is the proof.
 */

const WRAP = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
const H2 = "text-2xl font-semibold leading-tight tracking-tight text-primary sm:text-[1.75rem]";
const LEAD = "mt-3 max-w-[64ch] text-[15px] leading-relaxed text-secondary sm:text-base";

function PrimaryCta({ className = "" }: { className?: string }) {
  return (
    <Button asChild size="lg" className={`h-11 rounded-lg px-5 text-sm font-semibold ${className}`}>
      <a href="#levels">
        {HERO.primary} <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </Button>
  );
}

function DemoCta({ className = "" }: { className?: string }) {
  return (
    <Link href="/sign-in" className={`inline-flex h-11 items-center gap-1.5 text-sm font-medium text-link underline-offset-4 hover:underline ${className}`}>
      {HERO.secondary} <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

const EYEBROW = "mb-2 font-mono text-xs text-link";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};


const SECTION = "border-b border-hairline py-9 sm:py-11";

export default async function WelcomePage() {
  await connection(); // the plan catalogue is read per request, not frozen at build time
  const [example, levels] = await Promise.all([exampleData(), publicLevels()]);
  const story = storyData(example);
  return (
    <div className="min-h-[100dvh] bg-canvas text-primary">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-primary focus:ring-2 focus:ring-focus">
        Skip to the content
      </a>

      {/* Header and hero share the dark mood in both themes. */}
      <div className="dark bg-canvas text-primary">
        <header className="border-b border-hairline">
          <div className={`${WRAP} flex h-14 items-center justify-between gap-4`}>
            <Link href="/welcome" className="whitespace-nowrap text-sm font-semibold text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
              {PRODUCT}
            </Link>
            <nav aria-label="On this page" className="hidden items-center gap-4 whitespace-nowrap text-[13px] text-secondary xl:flex">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="hover:text-primary">{n.label}</a>
              ))}
            </nav>
            <div className="flex items-center gap-1 whitespace-nowrap">
              <ThemeToggle />
              <Link href="/sign-in" className="hidden h-9 items-center rounded-md px-2.5 text-sm font-medium text-primary hover:text-link md:inline-flex">
                Sign in
              </Link>
              <Button asChild size="sm" className="hidden h-9 rounded-md px-3.5 text-[13px] font-semibold sm:inline-flex">
                <a href="#levels">{HERO.primary}</a>
              </Button>
            </div>
          </div>
        </header>

        {/* 0. Hero: the proposition */}
        <section aria-labelledby="hero-title" className="border-b border-hairline pb-9 pt-8 sm:pb-11 sm:pt-10">
          <div className={`${WRAP} grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-12`}>
            <div>
              <p className={EYEBROW}>{HERO.eyebrow}</p>
              <h1 id="hero-title" className="max-w-[16ch] text-[1.9375rem] font-semibold leading-[1.1] tracking-[-0.025em] text-primary sm:text-4xl lg:text-[2.625rem]">
                {HERO.title}
              </h1>
              <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-secondary sm:text-base">{HERO.sub}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
                <PrimaryCta />
                <DemoCta />
              </div>
              <p className="mt-4 flex max-w-[56ch] items-start gap-2 font-mono text-[11px] leading-relaxed text-muted">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
                {HERO.status}
              </p>
            </div>
            <HeroFlow idea={story.origin.idea} facts={story.hero} />
          </div>
        </section>
      </div>

      <main id="main">
        {/* 1. What you get */}
        <section id="get" aria-labelledby="get-title" className={`${SECTION} scroll-mt-4`}>
          <div className={WRAP}>
            <p className={EYEBROW}>{GET.eyebrow}</p>
            <h2 id="get-title" className={H2}>{GET.title}</h2>
            <p className={LEAD}>{GET.lead}</p>
            <div className="mt-7">
              <WhatYouGet holds={story.holds} get={story.get} market={story.market} unit={example.unit} parts={example.parts} wires={example.wires} enclosure={example.enclosure} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">{GET.note}</p>
          </div>
        </section>

        {/* 2. How it goes fast */}
        <section id="fast" aria-labelledby="fast-title" className={`${SECTION} scroll-mt-4 bg-subtle`}>
          <div className={WRAP}>
            <p className={EYEBROW}>{FAST.eyebrow}</p>
            <h2 id="fast-title" className={H2}>{FAST.title}</h2>
            <p className={LEAD}>{FAST.lead}</p>
            <div className="mt-7">
              <DraftChain steps={story.chain} />
            </div>
            <h3 className="mt-9 text-lg font-semibold tracking-tight text-primary">{FAST.guaranteesTitle}</h3>
            <ul className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
              {FAST.guarantees.map((p) => (
                <li key={p.title} className="border-t border-hairline py-4">
                  <h4 className="flex items-start gap-2 text-sm font-semibold text-primary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-link" aria-hidden />
                    {p.title}
                  </h4>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. It started as a joke: the origin of the example, as a short film in six scenes */}
        <OriginScenes />

        {/* 4. The engineering, live: the app's own views on the example's rows */}
        <section id="engineering" aria-labelledby="engineering-title" className={`${SECTION} scroll-mt-4 bg-subtle`}>
          <div className={WRAP}>
            <p className={EYEBROW}>{ENGINEERING.eyebrow}</p>
            <h2 id="engineering-title" className={H2}>{ENGINEERING.title}</h2>
            <p className={LEAD}>{ENGINEERING.lead}</p>
            <p className="mt-3 flex max-w-[72ch] items-start gap-2 text-[13px] leading-relaxed text-secondary">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
              {ENGINEERING.tagNote}
            </p>
          </div>
          {/* the stage runs wider than the text column */}
          <div className="mx-auto mt-7 w-full max-w-[90rem] px-2 sm:px-6 lg:px-8">
            <Engineering parts={example.parts} wires={example.wires} enclosure={example.enclosure} />
            <p className="mt-3 max-w-[80ch] px-2 text-[13px] leading-relaxed text-muted sm:px-0">{ENGINEERING.note}</p>
          </div>
        </section>

        {/* 5. Then it went to market: the same weight as the engineering */}
        <section id="market" aria-labelledby="market-title" className={`${SECTION} scroll-mt-4`}>
          <div className={WRAP}>
            <p className={EYEBROW}>{MARKET.eyebrow}</p>
            <h2 id="market-title" className={H2}>{MARKET.title}</h2>
            <p className={LEAD}>{MARKET.lead}</p>
          </div>
          <div className="mx-auto mt-7 w-full max-w-[90rem] px-2 sm:px-6 lg:px-8">
            <Market data={story.market} />
            <p className="mt-3 max-w-[80ch] px-2 text-[13px] leading-relaxed text-muted sm:px-0">{MARKET.note}</p>
          </div>
        </section>

        {/* 6. Where the example is today: the board, then every gate with its checks */}
        <section id="today" aria-labelledby="board-title" className={`${SECTION} scroll-mt-4 bg-subtle`}>
          <div className={WRAP}>
            <p className={EYEBROW}>The example, as it stands</p>
            <h2 id="board-title" className={H2}>{BOARD.title}</h2>
            <p className={LEAD}>{BOARD.lead}</p>
          </div>
          {/* the board runs wider than the text column, so its flaps can be larger */}
          <div className="mx-auto mt-6 w-full max-w-[90rem] px-2 sm:px-6 lg:px-8">
            <DeparturesBoard states={boardStates(example.gates)} />
          </div>
          <div className={WRAP}>
            <p className="mt-3 max-w-[80ch] text-[13px] leading-relaxed text-muted">{BOARD.rule} {GATES_NOTE}</p>
            <div id="journey" className="mt-10 scroll-mt-4">
              <h3 id="journey-title" className="text-xl font-semibold tracking-tight text-primary">{JOURNEY_INTRO.title}</h3>
              <p className={LEAD}>{JOURNEY_INTRO.lead}</p>
              <div className="mt-8 lg:mt-10">
                <Journey rows={example} />
              </div>
            </div>
          </div>
        </section>

        {/* 7. The whole trip on one map */}
        <section id="map" aria-labelledby="map-title" className={`${SECTION} scroll-mt-4`}>
          <div className={WRAP}>
            <p className={EYEBROW}>The whole trip on one map</p>
            <h2 id="map-title" className={H2}>{MAP.title}</h2>
            <p className={LEAD}>{MAP.lead}</p>
            <div className="mt-6">
              <LifecycleMap />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">{MAP.note}</p>
          </div>
        </section>

        {/* 8. Your turn: the service levels and the way in */}
        <section id="levels" aria-labelledby="levels-title" className={`${SECTION} scroll-mt-4 bg-subtle`}>
          <div className={WRAP}>
            <p className={EYEBROW}>{YOUR_TURN.eyebrow}</p>
            <h2 id="levels-title" className={H2}>{YOUR_TURN.title}</h2>
            <p className={LEAD}>{YOUR_TURN.lead}</p>
            <Levels levels={levels.levels} showPrices={levels.showPrices} />
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
            <h2 id="run-title" className={H2}>Can I run it myself?</h2>
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
                  You need Docker Desktop, or Docker Engine with Compose 2.24 or later. The first start brings the database up to date and loads {EXAMPLE.name}. Then open <span className="font-mono text-primary">http://localhost:3000</span> and sign in as demo / demo. That install has one account, and it is yours: set your own password for it in Admin. The public demo on this site is a different thing, one account shared by every visitor.
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

        <section id="faq" aria-labelledby="faq-title" className={`${SECTION} scroll-mt-4`}>
          <div className={`${WRAP} grid grid-cols-1 gap-10 lg:grid-cols-12`}>
            <div className="lg:col-span-4">
              <h2 id="faq-title" className={H2}>What else should I ask?</h2>
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
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
                <PrimaryCta />
                <DemoCta />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="dark border-t border-hairline bg-canvas text-primary">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-muted`}>
          <p>{PRODUCT}. A hosted service in the making; free to self-host today, under Apache 2.0.</p>
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
