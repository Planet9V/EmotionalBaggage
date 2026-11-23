import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/welcome/ThemeToggle";
import { HeroFlow } from "@/components/welcome/HeroFlow";
import { WhatYouGet } from "@/components/welcome/WhatYouGet";
import { OriginScenes } from "@/components/welcome/scenes/OriginScenes";
import { Showcase } from "@/components/welcome/Showcase";
import { StageStatus } from "@/components/welcome/StageStatus";
import { PlanCards, paidPlans } from "@/components/welcome/Pricing";
import { EarlyAccess } from "@/components/welcome/early/EarlyAccess";
import { publicBuilder } from "@/components/welcome/builder";
import { publicLevels } from "@/lib/admin/plans";
import { publicVoiceovers } from "@/lib/voice/voiceovers";
import { exampleData } from "@/components/welcome/exampleData";
import { storyData } from "@/components/welcome/storyData";
import { publicPageMetadata } from "@/components/welcome/meta";
import { ACTION, BUILDER, CLOSING, FOOTER, GET, HERO, MECHANISM, META, NAV, PRICING, PROBLEM, PRODUCT, PROOF, questions } from "@/components/welcome/content";

export const generateMetadata = () => publicPageMetadata({ title: META.title, description: META.description, path: "/welcome" });

/*
 * The public page about the service, for a visitor who is not signed in (a signed-out visit to / lands here).
 * Its one job is early-access sign-ups (owner, 22 Nov): one action, "Claim an early-access place", in nine blocks.
 * It sells the service, not the example (docs/research/landing/proposition-brief.md); Baggage Claims MK1 is the
 * worked example: the origin story, the data inside every proof, and the honest status. Product copy is plain; the
 * only jokes are the bag's own lines, in the film.
 *
 * A server component. Each moving piece is a small client component under src/components/welcome, drawn still
 * and complete by the server, so the page reads in full without script and under reduced motion.
 *
 *  0. Header, sticky: the brand, four section links from 1024 px, Sign in, and the action at every width.
 *  1. hero     The proposition, the early-access form (EarlyAccess) and the transformation itself (HeroFlow).
 *  2. origin   Where the first idea came from: the film (OriginScenes), which loads only as it nears the window.
 *  3. problem  One product, ten tools: three before-and-after pairs.
 *  4. get      What each stage leaves you with (WhatYouGet), and how: AI drafts, you approve; the four guarantees.
 *  5. proof    One showcase of the example, Make it and Sell it (Showcase), then where it stands (StageStatus).
 *  6. pricing  The early-access offer, then the paid plans of the catalogue in force (Pricing.tsx).
 *  7. builder  Who built it: only when the setting holds a name and a text (builder.ts); no placeholder otherwise.
 *  8. faq      The buying questions (content.ts, questions()).
 *  9. close    The same action again, with the fuller form.
 *
 * The form, the count of places left and the visit counting are in src/components/welcome/early (EarlyAccess and
 * its tracking helpers). Every action on this page is a link to the nearest form and carries data-track; every
 * block has a stable id. The plans are read from the catalogue on each request (connection() below), so a change
 * in Admin shows without a deploy. Nothing here says the service costs nothing, runs anywhere else, or is quicker
 * than anything: no customers, counts, logos or time savings appear, because none exist; the worked example is
 * the proof.
 */

const WRAP = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
const H2 = "text-2xl font-semibold leading-tight tracking-tight text-primary sm:text-[1.75rem]";
const LEAD = "mt-3 max-w-[64ch] text-[15px] leading-relaxed text-secondary sm:text-base";
const EYEBROW = "mb-2 font-mono text-xs text-link";
/** the sticky header is 56 px tall: an anchor stops below it */
const SECTION = "scroll-mt-14 border-b border-hairline py-9 sm:py-11";
const FORM_ANCHOR = "scroll-mt-24";

/** The page's one action: a link to the nearest form. `where` names the block for the visit counts. */
function Action({ href, where, className = "" }: { href: string; where: string; className?: string }) {
  return (
    <Button asChild size="lg" className={`h-11 rounded-lg px-5 text-sm font-semibold ${className}`}>
      <a href={href} data-track={`cta:${where}`}>
        {ACTION.label} <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </Button>
  );
}

export default async function WelcomePage() {
  await connection(); // the plan catalogue is read per request, not frozen at build time
  const [example, levels, voice, builder] = await Promise.all([exampleData(), publicLevels(), publicVoiceovers(), publicBuilder()]);
  const story = storyData(example);
  const plans = paidPlans(levels.levels, levels.showPrices);
  const faq = questions(plans);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="min-h-[100dvh] bg-canvas text-primary">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-primary focus:ring-2 focus:ring-focus">
        Skip to the content
      </a>

      {/* 0. Header: dark in both themes, like the hero under it, and always in reach. */}
      <header className="dark sticky top-0 z-40 border-b border-hairline bg-canvas text-primary">
        <div className={`${WRAP} flex h-14 items-center justify-between gap-3`}>
          <Link href="/welcome" className="whitespace-nowrap text-sm font-semibold text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
            {PRODUCT}
          </Link>
          <nav aria-label="On this page" className="hidden items-center gap-5 whitespace-nowrap text-[13px] text-secondary lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} data-track={`cta:header-nav-${n.href.slice(1)}`} className="hover:text-primary">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-0.5 whitespace-nowrap sm:gap-1">
            <ThemeToggle compact />
            <Link href="/sign-in" data-track="cta:header-signin" className="hidden h-9 items-center rounded-md px-2.5 text-sm font-medium text-primary hover:text-link min-[440px]:inline-flex">
              Sign in
            </Link>
            <Button asChild size="sm" className="ml-1 h-9 rounded-md px-3.5 text-[13px] font-semibold">
              <a href="#early" data-track="cta:header">
                <span className="sm:hidden">{ACTION.short}</span>
                <span className="hidden sm:inline">{ACTION.label}</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* 1. Hero: the proposition and the form. Dark in both themes. */}
        <div className="dark bg-canvas text-primary">
          <section id="hero" aria-labelledby="hero-title" className="border-b border-hairline pb-9 pt-8 sm:pb-11 sm:pt-10">
            <div className={`${WRAP} grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-12`}>
              <div>
                <p className={EYEBROW}>{HERO.eyebrow}</p>
                <h1 id="hero-title" className="max-w-[16ch] text-[1.9375rem] font-semibold leading-[1.1] tracking-[-0.025em] text-primary sm:text-4xl lg:text-[2.625rem]">
                  {HERO.title}
                </h1>
                <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-secondary sm:text-base">{HERO.sub}</p>
                <div id="early" className={`mt-6 max-w-[420px] ${FORM_ANCHOR}`}>
                  <EarlyAccess placement="hero" />
                </div>
                <a href="#proof" data-track="cta:hero-example" className="mt-4 inline-flex h-11 items-center gap-1.5 text-sm font-medium text-link underline-offset-4 hover:underline">
                  {HERO.secondary} <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <HeroFlow idea={story.origin.idea} facts={story.hero} />
            </div>
          </section>
        </div>

        {/* 2. Where it came from: the film, as the hook. It loads only as it nears the window. */}
        <OriginScenes voice={voice} className="scroll-mt-14" />

        {/* 3. The problem */}
        <section id="problem" aria-labelledby="problem-title" className={`${SECTION} bg-subtle`}>
          <div className={WRAP}>
            <h2 id="problem-title" className={H2}>{PROBLEM.title}</h2>
            <p className={LEAD}>{PROBLEM.lead}</p>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {PROBLEM.shown.map((i) => PROBLEM.pairs[i]!).map((p) => (
                <li key={p.before} className="rounded-xl border border-hairline bg-surface p-5">
                  <p className="font-mono text-[11px] text-muted">{PROBLEM.before}</p>
                  <p className="mt-1 text-sm leading-snug text-secondary">{p.before}</p>
                  <p className="mt-4 font-mono text-[11px] text-link">{PROBLEM.after}</p>
                  <p className="mt-1 text-sm font-medium leading-snug text-primary">{p.after}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. What you get, and how */}
        <section id="get" aria-labelledby="get-title" className={SECTION}>
          <div className={WRAP}>
            <p className={EYEBROW}>{GET.eyebrow}</p>
            <h2 id="get-title" className={H2}>{GET.title}</h2>
            <p className={LEAD}>{GET.lead}</p>
            <div className="mt-7">
              <WhatYouGet holds={story.holds} get={story.get} market={story.market} unit={example.unit} parts={example.parts} wires={example.wires} enclosure={example.enclosure} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">{GET.note}</p>

            <h3 className="mt-9 max-w-[40ch] text-lg font-semibold leading-snug tracking-tight text-primary">{MECHANISM.title}</h3>
            <ul className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
              {MECHANISM.guarantees.map((p) => (
                <li key={p.title} className="border-t border-hairline py-4">
                  <h4 className="flex items-start gap-2 text-sm font-semibold text-primary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-link" aria-hidden />
                    {p.title}
                  </h4>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{p.text}</p>
                </li>
              ))}
            </ul>
            <Action href="#early" where="get" className="mt-4" />
          </div>
        </section>

        {/* 5. Proof: one showcase of the example, then where it stands */}
        <section id="proof" aria-labelledby="proof-title" className={`${SECTION} bg-subtle`}>
          <div className={WRAP}>
            <p className={EYEBROW}>{PROOF.eyebrow}</p>
            <h2 id="proof-title" className={H2}>{PROOF.title}</h2>
            <p className={LEAD}>{PROOF.lead}</p>
          </div>
          {/* the stage runs wider than the text column; the showcase lays both out */}
          <div className="mt-6">
            <Showcase parts={example.parts} wires={example.wires} enclosure={example.enclosure} market={story.market} />
          </div>
          <div className={`${WRAP} mt-9`}>
            <h3 className="text-lg font-semibold tracking-tight text-primary">{PROOF.status.title}</h3>
            <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-secondary">{PROOF.status.lead}</p>
            <div className="mt-4">
              <StageStatus gates={example.gates} />
            </div>
            <Action href="#early-close" where="proof" className="mt-7" />
          </div>
        </section>

        {/* 6. Pricing: the early-access offer, then the plans that follow it */}
        <section id="pricing" aria-labelledby="pricing-title" className={SECTION}>
          <div className={WRAP}>
            <p className={EYEBROW}>{PRICING.eyebrow}</p>
            <h2 id="pricing-title" className={H2}>{PRICING.title}</h2>
            <p className={LEAD}>{PRICING.lead}</p>
            <div className="mt-7 grid gap-6 rounded-xl border border-dutchOrange bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6 md:grid-cols-2 md:items-center md:gap-10">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-primary">{PRICING.offerTitle}</h3>
                <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-secondary">{PRICING.offerText}</p>
              </div>
              <div id="early-pricing" className={FORM_ANCHOR}>
                <EarlyAccess placement="pricing" />
              </div>
            </div>
            {plans.length ? (
              <>
                <h3 className="mt-9 text-lg font-semibold tracking-tight text-primary">{PRICING.plansTitle}</h3>
                <PlanCards plans={plans} href="#early-pricing" />
              </>
            ) : null}
            <p className="mt-5 flex max-w-[80ch] items-start gap-2 text-sm leading-relaxed text-secondary">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
              {PRICING.first}
            </p>
          </div>
        </section>

        {/* 7. Who built it: only when the owner's name and text are saved; a public page carries no placeholder */}
        {builder ? (
          <section id="builder" aria-labelledby="builder-title" className={`${SECTION} bg-subtle`}>
            <div className={`${WRAP} grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10`}>
              <div className="lg:col-span-4">
                <h2 id="builder-title" className={H2}>{BUILDER.title}</h2>
              </div>
              <div className="lg:col-span-8">
                <p className="text-base font-semibold text-primary">{builder.name}</p>
                {builder.role ? <p className="mt-0.5 font-mono text-[11px] text-link">{builder.role}</p> : null}
                <p className="mt-3 max-w-[64ch] whitespace-pre-line text-[15px] leading-relaxed text-secondary">{builder.text}</p>
              </div>
            </div>
          </section>
        ) : null}

        {/* 8. Questions a buyer asks */}
        <section id="faq" aria-labelledby="faq-title" className={`${SECTION} ${builder ? "" : "bg-subtle"}`}>
          <div className={`${WRAP} grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10`}>
            <div className="lg:col-span-4">
              <h2 id="faq-title" className={H2}>{PRICING.questionsTitle}</h2>
            </div>
            <div className="divide-y divide-[var(--border-hairline)] rounded-xl border border-hairline bg-surface lg:col-span-8">
              {faq.map((f) => (
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

        {/* 9. Close: the same action the page opened with, and the fuller form */}
        <section id="close" aria-labelledby="close-title" className="dark scroll-mt-14 bg-canvas py-10 text-primary sm:py-12">
          <div className={`${WRAP} grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12`}>
            <div>
              <h2 id="close-title" className={H2}>{CLOSING.title}</h2>
              <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-secondary sm:text-base">{CLOSING.text}</p>
            </div>
            <div id="early-close" className={FORM_ANCHOR}>
              <EarlyAccess placement="close" />
            </div>
          </div>
        </section>
      </main>

      <footer className="dark border-t border-hairline bg-canvas text-primary">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-8 text-sm text-muted`}>
          <p className="font-medium text-secondary">{PRODUCT}</p>
          <p className="max-w-[60ch]">{FOOTER.privacy}</p>
          <Link href="/sign-in" data-track="cta:footer-signin" className="text-secondary hover:text-primary">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
