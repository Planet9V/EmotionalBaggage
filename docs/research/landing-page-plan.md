---
title: "Landing page for a paid concept-to-product workbench"
type: plan
created: 2026-11-21
updated: 2026-11-21
status: pre-registered
author: mixed
methodology: mixed
design: "section 1 of this file (no separate design doc exists)"
---

# Landing page for a paid concept-to-product workbench: research plan

Status is **pre-registered**. The owner confirmed the hypothesis on 21 November 2026 ("yes use the hypothesis"). He did not comment on the falsification figures (400 visitors per page, one quarter better), so they stand as written until he changes them, and any change is logged in section 7.

The research-plan method expects an approved design document first. None exists, and the owner asked for the plan directly, so section 1 is the design in brief. The method's template paths (a knowledge wiki, a BibTeX library) are for a different kind of project; this plan uses paths in this repository under `docs/research/landing/`.

## 0. Order of work (owner, 21 Nov 2026)

The landing page was third. On 21 November, after confirming the hypothesis, the owner asked for the page to be built now as an animated showcase of the full journey, so Task 8 was started ahead of the two gates, alongside Tasks 1 to 3. The gates still apply to the sign-up and payment work (Task 7) and to the live test (Task 9). This change of order is the first entry in the deviations log.

| Order | Work | Gate to pass |
|---|---|---|
| 1 | Reuse: one form pattern, one UI kit, one definition of each thing | Independent re-score of "Reuse of existing components" at 7 or more (was 5) |
| 2 | Wiring: every feature reads the same data and agrees with every other | The wiring checks in section 5 all pass on the Baggage Claims concept |
| 3 | Landing page, welcome and sign-up | This plan |

Tasks 1 to 4 of this plan are reading and deciding only. They touch no application code, so they can run alongside orders 1 and 2.

## 1. Design in brief

**What is being decided.** What the public welcome page, the sign-up path and the pricing page of this application should say, show and ask for, so that a person with a product idea signs up and pays.

**The product.** A workbench that takes a product concept through seven stages, concept to sales. Baggage Claims MK1 is the first concept run through it and is the worked example on the page.

**What exists today.**
- `/welcome` and `/welcome/overview`: a static page with screenshots and a "Request your own workspace" form that saves to `access_requests`.
- An independent reviewer on 21 Nov judged the page "competent, not fun, amazing and compelling": long, static, a hero image too dense to read, none of the product's humour, a defensive tone.
- One shared account (`demo` / `demo`). No sign-up, no per-person workspace, no plans, no payment code anywhere in the repository.

**What follows from that.** A page that asks people to sign up and pay needs something real behind the button. Accounts, workspaces, plans and payment are prerequisites, and they are product decisions before they are page decisions. Task 4 settles them. Until they are built, the page can honestly offer only a waiting list or a request form.

**Constraints already set by the owner.**
- Nothing invented: no made-up customers, testimonials or numbers.
- Tone: fun, amazing and compelling, carrying the product's own humour.
- English only.
- Reuse existing components and forms; no new one-off form or kit for this page.
- The Eigenia colours and type stay.

**Out of scope.** Search-engine work beyond the page's own title and description, paid advertising creative, email sequences after sign-up.

## 2. Research question, hypothesis and method

**Research question.** For a self-serve, paid web application that takes a physical-product idea from concept to sale, which page structure, proof, offer and sign-up path lead the most qualified visitors to start an account and to pay, and how should Baggage Claims MK1 be used as the worked example?

### Part A: desk research (no pre-registration)

**Method sketch.** Structured review of comparable live pages against one fixed audit sheet, plus a review of published evidence on landing, pricing and sign-up pages. Findings are recorded per source with what was read and when. A finding that rests on one source is marked as such.

**Iteration expectation.** The list of comparable pages will change as it is checked; additions and removals are logged in `docs/research/landing/log.md`.

### Part B: live test (`pre-registered: true`)

**Hypothesis (confirmed by the owner, 21 Nov 2026).** A welcome page that leads with one concrete worked example (Baggage Claims MK1 shown moving from idea to a printed part and a first ad), in the product's own voice, with one primary action, gets more visitors to start sign-up than the current page of feature screenshots.

**Falsification criteria.** The hypothesis is rejected if, with at least 400 unique visitors per page from the same traffic source over the same dates, the new page's rate of sign-up starts per unique visitor is not higher than the current page's by at least one quarter in relative terms. A difference smaller than that, in either direction, is reported as "no difference shown".

**Stop criterion.** 400 unique visitors per page, or 28 days, whichever comes first. If 28 days pass below 400, the result is reported as inconclusive and exploratory.

**What Part B cannot run without.**
- A source of visitors. The site has no traffic today; the owner decides whether that is paid ads, a post, or a list.
- Visit counting. The app records no page visits. Task 9 adds a first-party count with no third-party tracker.
- The 400 and the one-quarter figures are starting proposals, not derived from data. The owner sets them.

**Output target.** A decision document (`docs/research/landing/findings.md`), a page specification (`docs/research/landing/spec.md`), and the rebuilt page.

**Language.** English.

## 3. Data sources

Status is one of: in the repository, to read, to confirm it is live and comparable.

**The product's own material (in the repository)**
- `seed/concepts/baggage-claims/files/`: the 21 source documents, including the marketing playbook, the launch video script, the naming notes and the original idea with its gag catalogue.
- `src/lib/story/seed.ts`: the nine-part concept story written from those documents.
- `src/app/welcome/page.tsx`, `src/components/welcome/`: the current page and its copy.
- The 21 Nov user-experience review of the welcome page, summarised in the project handover note.

**Comparable live pages (each to confirm in Task 1; drop any that is gone or not comparable)**

| Group | Why it is comparable | Candidates |
|---|---|---|
| Idea to working software, self-serve and paid | Closest sign-up-and-pay pattern for "describe it, get it built" | Lovable, Bolt, v0, Replit |
| Hardware and electronics design tools | Same buyer, same subject matter | Flux, Onshape, Autodesk Fusion, tscircuit |
| Manufacturing and prototyping services | How quoting and "upload to part" is sold | Xometry, Protolabs, Fictiv, JLCPCB |
| Launch and pre-launch services for physical products | How validation before building is sold | Kickstarter creator pages, Prelaunch, LaunchBoom |
| Maker platforms | Voice and community for hobby builders | Printables, Thangs, Instructables |

**Published evidence (to read; each recorded with its date and what it measured)**
- Nielsen Norman Group articles on landing pages, pricing pages and sign-up forms.
- Baymard Institute research on checkout and account creation.
- Unbounce's conversion benchmark report, for rates by industry.
- CXL's published landing-page and pricing-page studies.
- Paddle (ProfitWell) and OpenView material on self-serve pricing and free-to-paid conversion.
- Stripe's documentation for Checkout, subscriptions and the customer portal, for what a payment step requires.
- The evidence already gathered on 20 Nov for the process review (Cooper on front-end homework; Camuffo and others on stating predictions before testing; Savoia on testing demand before building), in `docs/deep-dive/2026-11-20-remediation-plan.md`.

Every figure taken from these is quoted with its source and marked "not checked against our own traffic".

## 4. Tasks

### Task 1: Confirm the comparable pages
**Files:** `docs/research/landing/comparables.md`, `docs/research/landing/log.md`
- [ ] Open each candidate in section 3; record the address, the date, and whether it is live, self-serve and paid.
- [ ] Drop any that fails; add up to five found along the way, with the reason.
- [ ] Fix the final list at 12 to 16 pages.

### Task 2: Audit each page on one sheet
**Files:** `docs/research/landing/audit.csv`, `docs/research/landing/shots/`
- [ ] Write the sheet's columns once: headline and its promise, first action and its wording, what is shown above the fold, kinds of proof, a worked example or not, something to try without signing up, pricing shown or hidden, plan count and the free option, fields asked at sign-up, card required or not, page length, tone.
- [ ] Fill one row per page, with a screenshot of the first screen and of the pricing section.
- [ ] Record for each page the path from first click to paying, counted in steps.

### Task 3: Read the published evidence
**Files:** `docs/research/landing/evidence.md`
- [ ] One entry per source: what it measured, on whom, when, and the finding in one sentence.
- [ ] Mark each finding as measured, observed, or opinion.
- [ ] List where two sources disagree.

### Task 4: Settle the offer (owner decisions, each with options and their consequences)
**Files:** `docs/research/landing/offer.md`
- [ ] Who it is for first: hobby makers, first-time founders, small product firms, or agencies.
- [ ] What a person gets on sign-up: their own workspace, how many concepts, which AI features and whose model keys.
- [ ] Plans and price points, the free option, and whether a card is asked for up front.
- [ ] Payment provider and what it requires (taxes, refunds, terms, privacy notice).
- [ ] What is hosted for them and what stays on their own network (local models and printers cannot be reached from the hosted site).
- [ ] The product name on the page.

### Task 5: Synthesise the findings
**Files:** `docs/research/landing/findings.md`
- [ ] Patterns seen on at least half the audited pages, and patterns seen on the best-matched four.
- [ ] What the evidence supports, what it does not, and what is only convention.
- [ ] A recommendation for each sheet column, with its support.
- [ ] What to take from the Baggage Claims material: which gag lines, which images, which moment of the story.

### Task 6: Write the page specification
**Files:** `docs/research/landing/spec.md`
- [ ] Section order, with the one job of each section.
- [ ] Headline and first action: three candidates each, in the product's voice.
- [ ] The worked example: which five or six moments of Baggage Claims are shown, from real screens and real data.
- [ ] The interactive piece a visitor can try without an account.
- [ ] Pricing section and sign-up path, to the decisions in Task 4.
- [ ] For every section, the existing component it is built from; any gap is listed as an addition to the shared kit, not a one-off.
- [ ] A list of every claim on the page with where it comes from.

### Task 7: Build what the button leads to
**Files:** new migrations; `src/app/sign-up/`; `src/lib/auth/`; billing routes as decided in Task 4
- [ ] Individual accounts and one workspace per account, replacing the single shared account for hosted use.
- [ ] Sign-up, email confirmation and password reset, on the shared form pattern.
- [ ] Plans and payment as decided, tested against the provider's test mode.
- [ ] Access requests already collected are offered an invitation.

### Task 8: Rebuild the page to the specification
**Files:** `src/app/welcome/`, `src/components/welcome/`
- [ ] Build each section from the shared kit.
- [ ] Check by keyboard, on a phone width, in light and dark, and with reduced motion.
- [ ] An independent reviewer scores it against the owner's words and the specification.

### Task 9: Run the live test (after the owner confirms section 2, Part B)
**Files:** `migrations/` (visit counts), `docs/research/landing/test-result.md`
- [ ] Add a first-party count of unique visits and sign-up starts per page version.
- [ ] Serve the current page and the new page to alternate visitors from the same source.
- [ ] Stop at the stop criterion; report the counts, the rates and the verdict against the falsification criteria as written.

## 5. Wiring checks that gate this plan

"Wiring" here means how the features connect: one fact, stored once, read the same way everywhere. Each of these was reported as failing on 21 Nov and must pass first.

- [ ] One price and one margin: Pricing and Unit economics show the same margin for the same price and channel.
- [ ] One cost: the Optimise page and Unit economics show the same unit cost.
- [ ] A claim counts as verified only with a saved answer and a quote from a named source, and only then counts as proof for positioning or the landing page.
- [ ] Positioning with no proof cannot be approved.
- [ ] Changing a positioning line, a claim or a part lists the marketing and assembly rows that depend on it.
- [ ] Every gate check in every product type fails on an empty row (the story with no pitch, Files with no file).
- [ ] The schematic's net list and electrical checks agree with the drawing when wires have no net name.
- [ ] Parts drafted by the assistant do not duplicate parts entered in the wizard.

## 6. Verification

The plan is complete when:
- [ ] `comparables.md` lists 12 to 16 confirmed pages and `audit.csv` has one full row for each.
- [ ] `evidence.md` has an entry for every source in section 3 that could be opened, and names the ones that could not.
- [ ] `offer.md` has an owner decision recorded against all six questions.
- [ ] `spec.md` names an existing shared component for every section, and its claims list has no entry without a source.
- [ ] A new visitor can create an account and complete a payment in the provider's test mode, proven by an automated browser test.
- [ ] The rebuilt page passes the existing accessibility check in both themes.
- [ ] An independent reviewer scores the page 7 or more against the specification.
- [ ] The hypothesis is reported as supported, rejected, or inconclusive and exploratory.

## 7. Deviations

Changes to scope, method or sources after sign-off are appended to `docs/research/landing/log.md` with the date and the reason.
