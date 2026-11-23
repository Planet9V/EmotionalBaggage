import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/welcome/ThemeToggle";
import { HeroStage } from "@/components/welcome/HeroStage";
import { ProblemArt } from "@/components/welcome/ProblemArt";
import { WhatYouGet } from "@/components/welcome/WhatYouGet";
import { OriginScenes } from "@/components/welcome/scenes/OriginScenes";
import { Showcase } from "@/components/welcome/Showcase";
import { StageStatus } from "@/components/welcome/StageStatus";
import { PlanCards, paidPlans } from "@/components/welcome/Pricing";
import { EarlyAccess } from "@/components/welcome/early/EarlyAccess";
import { Tracker, TrackSection } from "@/components/welcome/early/track";
import { publicBuilder } from "@/components/welcome/builder";
import { publicLevels } from "@/lib/admin/plans";
import { publicVoiceovers } from "@/lib/voice/voiceovers";
import { exampleData } from "@/components/welcome/exampleData";
import { storyData } from "@/components/welcome/storyData";
import { publicPageMetadata } from "@/components/welcome/meta";
import { BrandLink, Wordmark } from "@/components/brand/ShipwrightMark";
import { ACTION, BUILDER, CLOSING, FOOTER, GET, HERO, MECHANISM, META, NAV, PRICING, PROBLEM, PROOF, questions } from "@/components/welcome/content";

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
 *  3. problem  Why the idea is still in the drawer: three before-and-after pairs.
 *  4. get      What each stage leaves you with (WhatYouGet), and how: AI drafts, you approve; the four guarantees.
 *  5. proof    One showcase of the example, Make it and Sell it (Showcase), then where it stands (StageStatus).
 *  6. pricing  The early-access offer, then the paid plans of the catalogue in force (Pricing.tsx).
 *  7. builder  Who built it: only when the setting holds a name and a text (builder.ts); no placeholder otherwise.
 *  8. faq      The buying questions (content.ts, questions()).
 *  9. close    The same action again, with the fuller form.
 *
 * The form, the count of places left and the visit counting are in src/components/welcome/early (EarlyAccess and
 * its tracking helpers; docs/design/early-access.md). Every action on this page is a link to the nearest form
 * (#early-access-hero, -pricing or -close, the ids EarlyAccess gives itself) and carries data-track; every block
 * has a stable id and sits in a TrackSection of the same name, so a visit is counted block by block. The plans are read from the catalogue on each request (connection() below), so a change
 * in Admin shows without a deploy. Nothing here says the service costs nothing, runs anywhere else, or is quicker
 * than anything: no customers, counts, logos or time savings appear, because none exist; the worked example is
 * the proof.
 */

const WRAP = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
// One scale for the page: a section's question, its lead at reading size, a small line above it where the section
// has one, and the text under a sub-heading. Body text is 16 px or more and the smallest line is 13 px.
const H2 = "text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.02em] text-primary sm:text-[2.125rem]";
const H3 = "text-xl font-semibold leading-snug tracking-tight text-primary";
const LEAD = "mt-3.5 max-w-[62ch] text-base leading-relaxed text-secondary sm:text-[17px]";
const EYEBROW = "mb-2.5 text-[13px] font-medium text-link";
/** the sticky header is 56 px tall: an anchor stops below it */
const SECTION = "scroll-mt-14 border-b border-hairline py-10 sm:py-14";

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
      <Tracker />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-primary focus:ring-2 focus:ring-focus">
        Skip to the content
      </a>

      {/* 0. Header: dark in both themes, like the hero under it, and always in reach. */}
      <header className="dark sticky top-0 z-40 border-b border-hairline bg-canvas text-primary">
        <div className={`${WRAP} flex h-14 items-center justify-between gap-3`}>
          <BrandLink href="/welcome" size={26} textClassName="text-base" />
          <nav aria-label="On this page" className="hidden items-center gap-6 whitespace-nowrap text-sm text-secondary lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} data-track={`cta:nav-${n.href.slice(1)}`} className="hover:text-primary">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-0.5 whitespace-nowrap sm:gap-1">
            <ThemeToggle compact />
            <Link href="/sign-in" data-track="cta:header-signin" className="hidden h-9 items-center rounded-md px-2.5 text-sm font-medium text-primary hover:text-link min-[440px]:inline-flex">
              Sign in
            </Link>
            <Button asChild size="sm" className="ml-1 h-9 rounded-md px-3.5 text-[13px] font-semibold">
              <a href="#early-access-hero" data-track="cta:header">
                <span className="sm:hidden">{ACTION.short}</span>
                <span className="hidden sm:inline">{ACTION.label}</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* 1. Hero: the proposition and the form. Dark in both themes. */}
        <TrackSection id="hero" className="dark bg-canvas text-primary">
          <section id="hero" aria-labelledby="hero-title" className="overflow-x-clip border-b border-hairline pb-10 pt-8 sm:pb-14 sm:pt-11">
            <div className={`${WRAP} grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-12`}>
              <div>
                <p className={EYEBROW}>{HERO.eyebrow}</p>
                <h1 id="hero-title" className="max-w-[14ch] text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.03em] text-primary sm:text-[2.75rem] lg:text-[3.25rem]">
                  {HERO.title}
                </h1>
                <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-secondary sm:text-[17px]">{HERO.sub}</p>
                <div className="mt-6 max-w-[440px]">
                  <EarlyAccess placement="hero" />
                </div>
                <a href="#proof" data-track="example:hero" className="mt-4 inline-flex h-11 items-center gap-1.5 text-[15px] font-medium text-link underline-offset-4 hover:underline">
                  {HERO.secondary} <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <HeroStage idea={story.origin.idea} facts={story.hero} product={story.product} />
            </div>
          </section>
        </TrackSection>

        {/* 2. Where it came from: the film, as the hook. It loads only as it nears the window. */}
        <TrackSection id="origin">
          <OriginScenes voice={voice} className="scroll-mt-14" />
        </TrackSection>

        {/* 3. The problem */}
        <TrackSection id="problem">
          <section id="problem" aria-labelledby="problem-title" className={`${SECTION} bg-subtle`}>
            <div className={WRAP}>
              <h2 id="problem-title" className={H2}>{PROBLEM.title}</h2>
              <p className={LEAD}>{PROBLEM.lead}</p>
              <div className="mt-8">
                <ProblemArt />
              </div>
              <ul className="mt-5 grid gap-4 md:grid-cols-3">
                {PROBLEM.shown.map((i) => PROBLEM.pairs[i]!).map((p) => (
                  <li key={p.before} className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface">
                    <div className="border-b border-dashed border-hairline bg-subtle px-5 py-4">
                      <p className="text-[13px] font-medium text-muted">{PROBLEM.before}</p>
                      <p className="mt-1 text-base leading-snug text-secondary">{p.before}</p>
                    </div>
                    <div className="flex-1 px-5 py-4">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-link">
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        {PROBLEM.after}
                      </p>
                      <p className="mt-1 text-base font-medium leading-snug text-primary">{p.after}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </TrackSection>

        {/* 4. What you get, and how */}
        <TrackSection id="get">
          <section id="get" aria-labelledby="get-title" className={SECTION}>
            <div className={WRAP}>
              <p className={EYEBROW}>{GET.eyebrow}</p>
              <h2 id="get-title" className={H2}>{GET.title}</h2>
              <p className={LEAD}>{GET.lead}</p>
              <div className="mt-7">
                <WhatYouGet holds={story.holds} get={story.get} market={story.market} unit={example.unit} parts={example.parts} wires={example.wires} enclosure={example.enclosure} product={story.product} />
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-muted">{GET.note}</p>

              <h3 className={`mt-12 max-w-[36ch] ${H3}`}>{MECHANISM.title}</h3>
              <ul className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
                {MECHANISM.guarantees.map((p) => (
                  <li key={p.title} className="border-t border-hairline py-4">
                    <h4 className="flex items-start gap-2 text-base font-semibold leading-snug text-primary">
                      <Check className="mt-[3px] h-4 w-4 shrink-0 text-link" aria-hidden />
                      {p.title}
                    </h4>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-secondary">{p.text}</p>
                  </li>
                ))}
              </ul>
              <Action href="#early-access-hero" where="get" className="mt-5" />
            </div>
          </section>
        </TrackSection>

        {/* 5. Proof: one showcase of the example, then where it stands */}
        <TrackSection id="proof">
          <section id="proof" aria-labelledby="proof-title" className={`${SECTION} bg-subtle`}>
            <div className={WRAP}>
              <p className={EYEBROW}>{PROOF.eyebrow}</p>
              <h2 id="proof-title" className={H2}>{PROOF.title}</h2>
              <p className={LEAD}>{PROOF.lead(example.parts.length, example.wires.length)}</p>
            </div>
            {/* the stage runs wider than the text column; the showcase lays both out */}
            <div className="mt-8">
              <Showcase parts={example.parts} wires={example.wires} market={story.market} product={story.product} printed={story.printed} />
            </div>
            <div className={`${WRAP} mt-12`}>
              <h3 className={H3}>{PROOF.status.title}</h3>
              <p className="mt-2 max-w-[68ch] text-base leading-relaxed text-secondary">{PROOF.status.lead}</p>
              <div className="mt-5">
                <StageStatus gates={example.gates} />
              </div>
              <Action href="#early-access-close" where="proof" className="mt-7" />
            </div>
          </section>
        </TrackSection>

        {/* 6. Pricing: the early-access offer, then the plans that follow it */}
        <TrackSection id="pricing">
          <section id="pricing" aria-labelledby="pricing-title" className={SECTION}>
            <div className={WRAP}>
              <p className={EYEBROW}>{PRICING.eyebrow}</p>
              <h2 id="pricing-title" className={H2}>{PRICING.title}</h2>
              <p className={LEAD}>{plans.length ? `${PRICING.lead} ${PRICING.plansLead}` : PRICING.lead}</p>
              <div className="relative mt-8 grid gap-6 overflow-hidden rounded-2xl border border-hairline bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8 md:grid-cols-2 md:items-center md:gap-12">
                {/* the one offer open today: the accent marks it, once */}
                <span className="absolute inset-y-0 left-0 w-1 bg-dutchOrange" aria-hidden />
                <div>
                  <h3 className={H3}>{PRICING.offerTitle}</h3>
                  <p className="mt-2 max-w-[46ch] text-base leading-relaxed text-secondary">{PRICING.offerText}</p>
                </div>
                <EarlyAccess placement="pricing" />
              </div>
              {plans.length ? (
                <>
                  <h3 className={`mt-12 ${H3}`}>{PRICING.plansTitle}</h3>
                  <PlanCards plans={plans} href="#early-access-pricing" />
                </>
              ) : null}
              <p className="mt-6 flex max-w-[80ch] items-start gap-2.5 text-[15px] leading-relaxed text-secondary">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
                {PRICING.first}
              </p>
            </div>
          </section>
        </TrackSection>

        {/* 7. Who built it: only when the owner's name and text are saved; a public page carries no placeholder */}
        {builder ? (
          <TrackSection id="builder">
            <section id="builder" aria-labelledby="builder-title" className={`${SECTION} bg-subtle`}>
              <div className={`${WRAP} grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10`}>
                <div className="lg:col-span-4">
                  <h2 id="builder-title" className={H2}>{BUILDER.title}</h2>
                </div>
                <div className="lg:col-span-8">
                  <p className="text-lg font-semibold text-primary">{builder.name}</p>
                  {builder.role ? <p className="mt-0.5 text-[13px] font-medium text-link">{builder.role}</p> : null}
                  <p className="mt-3 max-w-[64ch] whitespace-pre-line text-base leading-relaxed text-secondary">{builder.text}</p>
                </div>
              </div>
            </section>
          </TrackSection>
        ) : null}

        {/* 8. Questions a buyer asks */}
        <TrackSection id="faq">
          <section id="faq" aria-labelledby="faq-title" className={`${SECTION} ${builder ? "" : "bg-subtle"}`}>
            <div className={`${WRAP} grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10`}>
              <div className="lg:col-span-4">
                <h2 id="faq-title" className={H2}>{PRICING.questionsTitle}</h2>
              </div>
              <div className="divide-y divide-[var(--border-hairline)] overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[var(--shadow-card)] lg:col-span-8">
                {faq.map((f) => (
                  <details key={f.q} className="group px-5 sm:px-6">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-base font-medium text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus sm:text-[17px] [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <Plus className="h-[18px] w-[18px] shrink-0 text-link transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none" aria-hidden />
                    </summary>
                    <p className="max-w-[68ch] pb-5 text-base leading-relaxed text-secondary">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
          </section>
        </TrackSection>

        {/* 9. Close: the same action the page opened with, and the fuller form */}
        <TrackSection id="close">
          <section id="close" aria-labelledby="close-title" className="dark scroll-mt-14 bg-canvas py-10 text-primary sm:py-12">
            <div className={`${WRAP} grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12`}>
              <div>
                <h2 id="close-title" className={H2}>{CLOSING.title}</h2>
                <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-secondary sm:text-base">{CLOSING.text}</p>
              </div>
              <EarlyAccess placement="close" />
            </div>
          </section>
        </TrackSection>
      </main>

      <footer className="dark border-t border-hairline bg-canvas text-primary">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-8 text-[15px] text-muted`}>
          <p className="text-secondary"><Wordmark size={20} textClassName="text-[15px] font-medium" /></p>
          <p className="max-w-[60ch]">{FOOTER.privacy}</p>
          <Link href="/sign-in" data-track="cta:footer-signin" className="text-secondary hover:text-primary">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
