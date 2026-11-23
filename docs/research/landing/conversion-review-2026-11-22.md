# Welcome page: conversion review

22 November 2026. Analysis only; no code was changed. Builds on `evidence.md`, `comparables.md`, `audit.csv`, `proposition-brief.md` and `story-design-and-plan.md` in this folder and does not repeat them.

**How this was done.** The page source was read (`src/app/welcome/page.tsx`, `src/components/welcome/*`, `content.ts`, `Levels.tsx`, `AccessRequestForm.tsx`, `src/lib/admin/plans.ts`, `src/proxy.ts`, migrations 0028 and 0030). The live page, `/sign-in` and `/status` were fetched signed out on 22 Nov as text. **Not done:** no browser, no phone, no timing run. Everything said about mobile and load weight is a reading of the source, and is marked so.

**The goal it is judged against:** the owner's, "we need subscribers".

---

## 1. Verdict

**Conversion score: 3.5 out of 10.**

| What is scored | Score | Why |
|---|---|---|
| Turning a visitor into a paying subscriber | 0 | Nobody can pay or create an account. The page says so three times. |
| Turning a visitor into a lead (the only thing it can do today) | 4 | The one conversion is a five-field form eight sections down, with no price beside it and a promise that "the reply comes by hand". |
| First-screen message (the 5-second test) | 7 | Who, what and how are clear. The status line under the buttons takes the energy back out. |
| Proof | 6 | The worked example is real and unusual. It proves the engineering half and admits the selling half has not happened. |
| Pricing presentation | 2 | Four cards, two say "Free", two say "Price to be announced", although $29 and $99 were accepted on 22 Nov. |
| Length and focus | 4 | Fifteen blocks; the buyer's question ("what does it cost, how do I start") is block nine. Two blocks talk the buyer out of paying. |
| Measurability | 1 | The app records stored requests and nothing else. There is no visitor count, so no conversion rate can be worked out. |

The page is an honest, well-made product tour. It is not yet a selling page, mostly because there is nothing to buy and the page keeps apologising for it.

### The three bluntest critiques

1. **There is no way to subscribe, and the substitute is weak.** "Request access" is an anchor that jumps past seven sections to a form asking name, email, a description, company and level. The text beside it says no email is sent and the reply comes by hand. The other way in, "Try the live demo", lands on a bare username and password page with no link back, whose only help text reads like a server that was never set up ("This install still uses the default account: user demo, password demo. Change the password after signing in.").
2. **The page argues against its own paid plans.** Two of four cards are free. Directly after pricing comes "Can I run it myself?" with the Docker commands and "No account with us and no subscription". The FAQ then tells a hosted buyer that keys are stored "not encrypted" and that "an install has one account today", which contradicts the Studio card's "Team seats" and "Roles" two sections earlier.
3. **The headline promises "built and on sale"; the proof stops at "planned".** The page itself reports the example as 0 of 59 research claims verified, four ad drafts and none approved, and sales not started. That honesty is right, but it means the example proves "designed and costed", not "on sale". The headline should promise what the example can show, or the example needs one finished thing (a printed, working tag in a photograph) before the page can carry that line.

---

## 2. The page as it is

### 2.1 The first screen (5-second test)

| Question a visitor asks | What the page answers | Verdict |
|---|---|---|
| Who is it for? | Eyebrow: "For makers, first-time founders and small product firms" | Clear |
| What do I get? | "Your product idea, built and on sale." plus one sentence naming a costed prototype, a launch plan and a marketplace listing | Clear, and stronger than most comparables. Over-promises against the example (critique 3) |
| How? | "AI drafts each stage from the last. You decide what stands." | Clear |
| Why now? | Nothing | Missing. No founding-member offer, no opening date, no reason to act this week |
| What do I do next? | "Request access" (primary), "Try the live demo" (text link) | Weak. Neither is a sign-up. The primary button does not open anything; it scrolls |
| What will it cost me? | Nothing on the first screen | Missing. "Free" is not said, and 9 of 16 comparables say it in or beside the button (`comparables.md`, pattern a6) |

The status line under the buttons ("Sign-up with your own workspace is being built. Today you can try the shared demo or request access.") is honest and should stay true, but it is the last thing read before the visitor decides, and it says "not ready".

The hero visual (idea in, stage outputs out) does the job the proposition brief set. It is drawn by the server first, so the message does not wait for script.

### 2.2 Section by section

| # | Section (heading on the page) | Job for a buyer | What is weak or missing |
|---|---|---|---|
| 0 | Header | Orientation, the action always in reach | Not sticky. The section links show only at 1280 px and wider; the "Request access" button is hidden below 640 px, so a phone has no action in the header at all (source reading) |
| 1 | Hero | Who, what, how, next step | See 2.1 |
| 2 | "What do I end up with?" | Make the outcome concrete, stage by stage | Good. The strongest section. No action at its end |
| 3 | "How does it get me there faster?" and "What stays my decision?" | Mechanism and control | Good. Honest that no time saving is measured, which leaves "faster" in the heading unsupported. No action at its end |
| 4 | "It started as a joke" (the 3D film) | Charm, and the origin of the example | The most expensive block and the furthest from the sale. It sits before the engineering and market proof. No pause control (owner's choice; `evidence.md` S32 notes the WCAG point) |
| 5 | "Is the engineering real?" (six live tabs) | Proof that it is real engineering | Strong proof. Heavy. The orange note about "Rev D, chosen 22 Nov" is internal talk a buyer cannot parse |
| 6 | "Does it get me to market?" (seven tabs) | Proof it goes past the prototype | Several tabs say what the example does not have yet (no brand kit, no positioning statement, no drafted sections). Honest, but it reads as an unfinished example at the point the buyer asks "will it sell my product" |
| 7 | "Where is the example today?" (board, then every gate) | Honest status | Long. A status board of someone else's product, with most checks open, immediately before pricing |
| 8 | "What changes when I change one thing?" (map) | A real differentiator (change tracking) | Good idea, wrong place: a feature explanation between proof and price |
| 9 | "What does it cost, and how do I start?" | Price and the way in | See 2.4. It is the ninth block |
| 10 | "Is it for someone like me?" | Qualify the visitor | Useful, but comes after pricing. "Not a fit yet: several people need their own logins" contradicts Studio |
| 11 | "Can I run it myself?" | Serve self-hosters | Tells the paying audience how not to pay, with commands. Belongs on its own page |
| 12 | "What else should I ask?" (nine questions) | Remove objections | Answers install questions (keys, models, stand-ins). Misses buying questions (see 2.6) |
| 13 | "Ready to get your idea out?" | Last ask | Fine. Same two weak actions |
| 14 | Footer | Housekeeping | "A hosted service in the making; free to self-host today" repeats "not ready" and "free" as the last words |

Written but not shown: `content.ts` holds a `PROBLEM` block ("One product, ten tools that never talk to each other", five before-and-after pairs). `page.tsx` does not render it. The page therefore never states the problem; it goes from promise straight to outputs.

### 2.3 Calls to action

| Action | Where | Count | Goes to |
|---|---|---|---|
| "Request access" | header, hero, three level cards, closing | 6 | `#levels` or `#request` on the same page |
| "Request a workspace" | the form's submit button | 1 | stores the request |
| "Try the live demo" | hero, the box beside the form, closing | 3 | `/sign-in` |
| "Sign in" | header, footer | 2 | `/sign-in` |
| "Run it yourself" / "The source on GitHub" | level card, run section, footer | 3 | `#run`, GitHub |

Problems: the button says "Request access" and the form says "Request a workspace" (two names for one thing). Sections 2 to 8 have no action at all, which is most of the page. Three of the visible actions lead away from paying (demo, self-host, GitHub).

### 2.4 Pricing as shown today

Fetched live on 22 Nov: **Free** ("Free"), **Maker** ("Price to be announced"), **Studio** ("Price to be announced"), **Self-hosted** ("Free"). Prices are hidden because `showPrices` is off in the plan catalogue (Admin, Pricing and tiers).

- The owner accepted Maker $29 and Studio $99 a month on 22 Nov (`docs/TASKS.md`). The page and the FAQ still say prices are not announced. Hidden prices are the one pricing choice the evidence argues against for a self-serve product (`evidence.md`, "Pricing on the page versus hidden").
- Inclusions are vague where a buyer wants numbers: "Several concepts", "Monthly AI credits", "More concepts and storage". The catalogue only has seeded limits for Free (1 concept, 1 member).
- Nobody is told what an AI credit buys. Lovable's pricing FAQ prices example actions in credits; Bubble and Framer give a monthly credit number on each card.
- Maker is the filled button, which is the right plan to point at, but it carries no label saying so.
- Four cards with two free ones. Self-hosted is not a plan the business sells; as a card of equal weight it is a quarter of the pricing section.
- No yearly price, no "cancel any time", no statement of what happens to my concepts if I stop paying.

### 2.5 Proof

What exists is good and rare: one named product carried through every stage, with live viewers on its real rows. `comparables.md` (section d) found 0 of 19 pages do this. The figures on the page are the example's own (16 parts, 20 wires, a unit cost worked out per batch size), and nothing is invented.

What is missing: a person. There is no founder name, face or reason for building it, and for a product with no customers that is the cheapest trust available. There is also no photograph of anything physical. `comparables.md` notes Flux opens on a photo of a held board, the only one of 16 pages to show the physical result.

### 2.6 Objections

| Objection | Handled? |
|---|---|
| What does it cost? | No. "Not announced yet" |
| Can I cancel? What happens to my work? | No |
| Is my idea safe? Who can see it, who owns it? | Partly, and only for self-hosting. The hosted answer is missing, and the demo warning ("anyone can read or change what you type") is the only privacy statement a hosted visitor sees |
| Do I need to know electronics or CAD? | Partly ("Can it replace my CAD tool? No") |
| How long does it take? | Deliberately not claimed. Fair, but then "faster" should not be a heading |
| Is this a real company, will it be here in a year? | No |
| Does the AI make things up? | Yes, well (the four guarantees) |
| Is it only for electronics? | Yes |

### 2.7 Length, weight and mobile (source reading, not measured)

- The fetched page is about 110,000 characters of text. Fifteen blocks. `evidence.md` (S5) puts about three quarters of viewing time in the first two screens; pricing here is far below that.
- The heavy pieces are loaded late and well: the film, the six engineering views, the schematic and the map are separate chunks that load as they near the window, with drawn stills first and a slow-device fallback. The hero does not wait for 3D. This is the right engineering. It still needs field numbers (largest paint, interaction delay) from real phones before anyone calls it fast.
- Phones: no action in the header; four tall level cards stack before the form; the form sits below them. `evidence.md` (S14) reports 79% of SaaS landing-page visits as mobile, so the phone path is the main path.

### 2.8 The sign-up path, click by click

**Path A, "Request access" (primary):**
1. Click in the hero. The page scrolls to "What does it cost, and how do I start?", passing seven sections unread.
2. Four cards. Two prices missing. Click "Request access" on a card.
3. The page scrolls again to the form. Five visible fields: name, email, what you want to build, company (optional), level.
4. Submit ("Request a workspace"). A "Request received" box appears. No email arrives. Nothing says when a reply will come.
5. The owner reads the request in Admin and replies by hand.

Three steps of scrolling and reading to reach a form that ends in silence. The Lenny Rachitsky founder poll in section 3.3 found waitlist conversion falls sharply with waiting time; a list with no acknowledgement and no date starts that clock badly.

**Path B, "Try the live demo":**
1. Click. Leaves the page for `/sign-in`.
2. A username and password form. The visitor must read the notice, then type `demo` twice. No link back to the welcome page, no sentence about what the demo is.
3. Inside a shared account that anyone can edit, with the warning not to put a real idea in it.
4. No route from inside the demo back to "get my own workspace" was found on the pages read.

**`/status`:** a signed-out visit is sent to sign-in. It cannot serve as public proof today.

---

## 3. What strong pages do

Labels: **measured** (a dataset or survey), **observed** (pages read on this run or the 21 Nov audit), **opinion** (practitioner advice, no data). Sources are numbered in section 7.

### 3.1 Section order and hero

No source measured one section order against another. What was observed on the 19 pages in `comparables.md` and the six read today is a common order: outcome headline with one action and "free" said near it; proof; three to five steps of how it works; the product shown; pricing or a link to it; questions; the same action again. The best-matched four (Flux, Meshy, Replit, Lovable) all name the outcome and not the tool in the headline, and three of four say a free way in on the landing page. This page already does the first and does not do the second.

On copy, Unbounce's benchmark (measured, correlational, campaign pages) reports the best-converting SaaS pages at 250 to 725 words and simple reading level far ahead of professional register [1]. This page is many times that length. The practical reading is few words per section, not a short page.

### 3.2 Pricing pages for monthly subscriptions

| Question | What was found | Label |
|---|---|---|
| How many tiers? | In ChartMogul's 2020 read of over 600 B2B pricing pages, close to half had three tiers and most had three or four [2]. Notion, Framer, Lovable and Bubble each show a free plan, two or three paid plans and an enterprise contact [5][6][7][8] | measured (old, B2B); observed |
| Mark one plan? | Flux labels Build "Best for most", Notion marks Business "Recommended", Bubble marks Growth "Recommended" [4][5][8]. `evidence.md` S16: highlighting moves the eye; no source shows it raises revenue | observed; convention |
| Yearly switch? | Present on Notion (up to 20% off), Lovable (two months free), Bubble (up to 20%), Flux, Prelaunch (10 to 20%) [4][5][7][8][9]. ChartMogul 2020: under 60% of pages offered annual pricing at all [2]. No source read measures its effect on conversion | observed; convention |
| Show prices? | Over a quarter of B2B pages hid prices in 2020, mostly larger sales-led firms [2]. For self-serve, show them (`evidence.md` S7) | measured; observed |
| How to present AI credits? | A number on each card (Bubble 500 to 4,000 a month; Framer 500 on Free) or worked examples in the FAQ (Lovable prices four example actions in credits) [6][7][8]. Flux pools credits for teams, as Studio proposes [4] | observed |
| Button wording | "Start for Free", "Get started", "Start Free Trial". None of the six says "Request" [4] to [9] | observed |
| Free plan, trial or card-first trial? | ChartMogul's January 2026 survey of 200 B2B products models, per 1,000 visitors: free plan about 90 sign-ups and 5 paying; card-free trial 45 and 3.6; card-required trial 35 and 10.5 [3]. Self-reported, and products that choose a card wall differ from those that do not | measured (survey, modelled) |
| Reverse trial (paid features for a period, then drop to free) | Described by Amplitude's former head of growth; the figures in the article are the author's recollections, with no dataset [10] | opinion |

The owner's standing assumption (free plan, no card) is the common shape for this kind of product and is supported as a reasonable choice, not as the proven best. The card question stays open in `saas-pricing-and-platform-design.md` and is a business choice (section 6).

### 3.3 Benchmarks, so targets are realistic

| Step | Benchmark | Source and label |
|---|---|---|
| Landing page visit to any conversion, SaaS | median 3.8% (all industries 6.6%); email traffic 16.9%, paid search 4.1%, paid social 2.9%, display 0.3% | Unbounce [1], measured on pages built with its own tool |
| Visitor to free sign-up | free plan about 9%; card-free trial about 4.5%; card-required trial about 3.5% | ChartMogul 2026 [3], survey |
| Free or trial to paid | median 8% within six months; free plan "good" 3 to 5%; card-free trial "good" 4 to 6%; card-required "good" 25 to 35% | ChartMogul 2026 [3], survey |
| Waitlist to paid | 5 to 25%; about 20% when people get in within a month, under 10% after three months | Lenny Rachitsky 2022 [11], an informal poll of founders, sample size not given |

**What that means here.** With a free plan and no card, a sound first target is 5 to 9 free sign-ups and 0.3 to 0.5 paying subscribers per 100 visitors who are actually makers or founders. At $29 that is roughly $90 to $150 of monthly revenue per 1,000 such visitors. A hundred subscribers needs something like 20,000 to 30,000 qualified visits. **The page is a multiplier; traffic is the larger unknown, and no plan for it exists in the documents read.**

Until sign-up exists, the honest target for the request form is 2 to 4% of visitors (the SaaS landing median, for a harder ask than most), and its value depends on how fast requesters are let in.

### 3.4 Proof with no customers

No measured study of this was found; `evidence.md` reached the same gap. The searches returned founder forums and agency posts only, so everything below is **opinion or inference**:

- Weak proof is worse than none (`evidence.md` S8, S17): no small counts, no unknown logos, no unnamed quotes.
- What a new product can show truthfully: the product itself in use, the price, what happens after sign-up, the person behind it, the source code, and a dated record of what shipped. Linear places its changelog just above its customer quotes (`comparables.md`, c4); here it can stand in for them.

### 3.5 Comparable pages and what applies

| Page | What it does | What applies here |
|---|---|---|
| Flux pricing [4] | Individual plans with a free trial each; "Best for most" on the middle one; team credits pooled; pay-as-you-go top-ups; FAQ on trial length and card holds | Same shape as Free, Maker, Studio with credits. Copy the label and the FAQ topics |
| Lovable pricing [7] | Free, Pro $25, Business $50; yearly "2 months free"; "No credit card needed"; credits explained by pricing four example actions | Explain an AI credit by what it drafts ("one credit drafts about ...") once the cost is measured |
| Bubble pricing [8] | Each plan named by project stage ("under construction", "ready to launch", "gaining traction") | Name plans by where the idea is, which fits a seven-stage product |
| Framer pricing [6] | Free plan with a stated credit number; buttons "Start for Free", "Start with Basic" | Button names the plan; Free states its real limit |
| Notion pricing [5] | Four plans, one "Recommended", yearly switch, full comparison table and billing FAQ under the cards | The under-card order: comparison, then billing questions |
| Prelaunch pricing [9] | Sells to the same people (a physical-product idea before launch) at $279 to $1,399 a month; proof is two named product case studies | The audience pays real money for launch help. $29 is low against it; the worked example plays the role of their case studies |
| Replit (21 Nov audit) | Full plan cards with a monthly and yearly switch on the landing page; a worked chat example | Pricing can live on the landing page itself, as planned here |
| Meshy (21 Nov audit) | "No card needed" said on the landing page; before-and-after pairs of one object | Say the free terms beside the hero button |
| Linear (21 Nov audit) | One fictional team's data through every section; proof placed beside each claim; changelog as closing proof | Already done with Baggage Claims. Add the dated shipping record |
| Flux home (21 Nov audit) | Opens on a photograph of a person holding the finished board | One photograph of a printed, working tag would close the gap in critique 3 |

---

## 4. Recommended page

### 4.1 Target order

Twelve blocks instead of fifteen, price by the eighth, an action after every proof block. Draft wording is for the owner to edit; "after sign-up" means after the sign-in cut-over.

| # | Block | Job | Draft headline | Action |
|---|---|---|---|---|
| 0 | Header, sticky | The action always in reach, on phones too | Links: What you get, Example, Pricing, Questions | "Start free" (today: "Get early access"); "Sign in" |
| 1 | Hero | Who, what, how, next, cost | Keep "Your product idea, built and on sale." if a built tag can be shown; otherwise "Your product idea, designed, costed and ready to launch." | Primary: "Start free with one idea". Under it: "Free plan. No card. Your first concept in a few minutes." Today: an email field and "Get early access" in the hero itself. Secondary: "Open the live example" |
| 2 | Proof strip (in place of a logo row) | Something checkable at once | "One real product, shown in full: 16 parts, 20 wires, a unit cost at every batch size." Figures read from the example's rows, as now | Link: "See it below" |
| 3 | The problem | Name the pain before the cure | "One product, ten tools that never talk to each other" (already written in `content.ts`, not shown) with three of the five pairs | none |
| 4 | What you get | The outcome per stage | "What do I end up with?" (keep) | Primary action repeated |
| 5 | How it works | Mechanism and control | "AI drafts each stage. You approve it. The next stage starts from there." Then the four guarantees | none |
| 6 | The example, one showcase | Proof, engineering and market at equal weight | "Watch one idea go through it" with the film as the opening tab or a short lead-in, then Make it (the six views) and Sell it (the seven) | "Open this example in the workbench" (one click, no typing) |
| 7 | Where the example stands | Honest status, short | One row of seven statuses with "what is still open" behind a disclosure. The full gate list and the map move into the demo and the overview page | none |
| 8 | Pricing | Price and the way in | "What does it cost?" Three cards: Free, Maker (labelled "Most makers start here"), Studio. One line under them: "Prefer to run it yourself? It is open source and free to self-host." | A button per card that names the plan: "Start free", "Start Maker", "Start Studio" |
| 9 | Who it is for | Qualify | "Is it for someone like me?" (keep; fix the logins line) | none |
| 10 | Who built it, and what is real today | Trust without customers | "Built by [name], in the open." Three sentences, a face, what has shipped by date, what has not been run against live services | Link to the source and the shipping record |
| 11 | Questions | Buying objections first | Order: cost; cancel and export; who sees and owns my idea; what an AI credit buys; do I need electronics or CAD skill; is it only for electronics; what is not finished | none |
| 12 | Close | Last ask | "Ready to get your idea out?" (keep) | Primary action; "Open the live example" |

Moved off the page: "Can I run it myself?" with the commands, and the self-hosting questions (models, keys, stand-ins), to a self-hosting page linked from the pricing line and the footer.

### 4.2 Format rules

- One primary action, one name for it, the same words everywhere including the form's own button.
- Say the free terms next to the primary button.
- Each section answers one buyer question in under about 60 words before any interactive piece.
- Statements of "not built yet" belong in one place (block 10 and the FAQ), not under the hero buttons and in the footer.

---

## 5. Five increments, ranked by ICE

**Scoring:** Impact, Confidence and Ease are each 1 to 10 (Ease 10 is the least work). **ICE is the average of the three.** Impact is judged against "we need subscribers". Scores are judgement, not measurement.

| Rank | Increment | I | C | E | ICE |
|---|---|---|---|---|---|
| 1 | Count the funnel in PostgreSQL | 7 | 9 | 7 | 7.7 |
| 2 | Repair the two ways in (short early-access form in the hero; one-click example) | 8 | 7 | 8 | 7.7 |
| 3 | Show the prices and rebuild the pricing block | 7 | 7 | 8 | 7.3 |
| 4 | Self-serve sign-up to a Free plan, then Stripe checkout for Maker and Studio | 10 | 8 | 2 | 6.7 |
| 5 | Reorder and cut the page to the target order | 7 | 6 | 6 | 6.3 |

Ranks 1 and 2 tie; counting goes first because every later change is judged by it. Rank 4 scores lower only because it is the most work. It is the only increment that produces a subscriber, and the others exist to make it pay off.

### 1. Count the funnel in PostgreSQL

- **What changes.** A small first-party event table and one Admin screen (section 5.1). Nothing visible to visitors.
- **Why.** Today the app keeps `access_requests` rows and audit lines (`access.requested`, `access.refused`). No visit, click or scroll is recorded, so there is no denominator and no way to tell whether any change helped. The benchmarks in 3.3 are useless without a local number to set beside them.
- **Effort.** Small: one migration, one public route, a few lines in the page's client parts, one Admin view.
- **Measure.** The increment is done when Admin shows, per day: visits, share reaching pricing, share starting the form, share sending it, share opening the example.
- **Depends on.** Nothing. A privacy sentence on the page is needed (section 5.1).

### 2. Repair the two ways in

- **What changes.** (a) "Request access" becomes "Get early access": email plus one line ("What do you want to make?") in the hero and again at the close; level, name and company are asked after sending, as optional. (b) The confirmation says what happens next and by when, and a confirmation email is sent once the owner's mail server is set in Admin. (c) "Try the live demo" becomes "Open the live example" and opens the example in one click, without the sign-in form; the demo carries a visible "Get your own workspace" link back to the form. (d) One name for the action everywhere.
- **Why.** Path A takes three scrolls and five fields and ends in silence; path B drops the visitor on a login page with no context (section 2.8). Asking for the minimum first and the rest later is supported, with the caution that wording matters as much as count (`evidence.md`, "Number of sign-up fields"). The founder poll puts waitlist-to-paid near 20% when people get in within a month and under 10% after three [11], so speed and acknowledgement matter more than list size.
- **Effort.** Small to medium. The one-click example needs a security decision (a read-only demo session) because the shared account is writable today.
- **Measure.** `form_submit` divided by `page_view` (target 2 to 4%); `demo_open` divided by `page_view`; later, share of requesters who create an account when invited.
- **Depends on.** Mail configured in Admin for the confirmation (works without it, with the current on-page message). The read-only demo decision.

### 3. Show the prices and rebuild the pricing block

- **What changes.** Prices on ($29 and $99, already accepted). Three cards with numbers for concepts, seats, storage and monthly AI credits; Maker labelled as the usual start; one sentence on what a credit buys; self-hosting as a line under the cards; "cancel any time, export everything" if the owner will stand behind it; the FAQ's "What does it cost?" rewritten to match. A yearly price only if the owner sets one.
- **Why.** Hidden prices are the one choice the evidence argues against for self-serve (`evidence.md` S7). Every pricing page read today shows a number, a marked plan and concrete limits [4] to [9]. Prelaunch charges the same audience $279 and up [9], so $29 is not a price to be shy about.
- **Effort.** Small in code (a switch in Admin, limits in the catalogue, `Levels.tsx` copy). The real work is the owner settling the limits, which `TASKS.md` already requires before prices go public.
- **Measure.** Share of pricing viewers who click a plan button (`plan_click` divided by `section_view` of pricing), and the split of requests by level. Before and after, same traffic sources.
- **Depends on.** Tier limits approved by the owner in Admin. Honest wording while nothing can be bought: "Founding price, charged only when your workspace opens".

### 4. Self-serve sign-up to a Free plan, then Stripe checkout

- **What changes.** The primary action becomes account creation (email and password, or the existing sign-up screen under `/auth/sign-up`), landing in a private workspace with the Baggage Claims example and the new-concept wizard. Maker and Studio buttons lead to Stripe Checkout. Limits and AI credits enforced. The "being built" lines leave the page.
- **Why.** Nothing else creates a subscriber. On the 2026 survey, a free plan with no card signs up about 9% of visitors and converts 3 to 5% of them when done well [3].
- **Effort.** Large, and already planned: cut-over (task 1), workspace separation with row-level security (task 2), Stripe subscriptions, limits and the credit ledger (task 5, WS6).
- **Measure.** `signup_complete` divided by `page_view` (target 5 to 9%); first concept created within a day of sign-up (activation); `subscription_started` divided by `signup_complete` within 30 and 180 days (target 3 to 5% at 180); monthly revenue.
- **Depends on.** Tasks 1, 2 and 5 in `docs/TASKS.md`; the free-plan and card decisions; mail for verification; terms and privacy pages.

### 5. Reorder and cut the page

- **What changes.** The order in 4.1: sticky header with the action on phones; the unused problem block restored; engineering and market merged into one showcase with the film as its lead-in; the board, gates and map reduced to one status row; pricing moved up to block 8; "run it yourself" and the install questions moved to their own page; a founder block added; the FAQ reordered around buying.
- **Why.** Most viewing time is spent in the first two screens (`evidence.md` S5) and the common order on comparable pages puts price or its link well before the end (3.1). Confidence is only 6 because no source measured section order, and the owner has invested in the film and the board.
- **Effort.** Medium. Mostly moving existing components; the showcase merge and the self-hosting page are the new work.
- **Measure.** Share of visitors who reach pricing (`section_view` pricing divided by `page_view`), median depth reached, and the form or sign-up rate, compared before and after.
- **Depends on.** Increment 1, or the effect cannot be seen. A founder name and photograph from the owner.

### 5.1 The analytics the page needs

**Recorded today:** access requests (with level and status) and audit-log lines for stored and refused requests. Nothing on visits, sections, clicks or demo use from the welcome page.

**Needed, all in PostgreSQL, no outside service or key:**

| Event | Carries | Answers |
|---|---|---|
| `page_view` | path, referrer host, campaign tags from the address, device class (phone, tablet, desktop), theme | How many came, from where, on what |
| `section_view` | section id (get, fast, example, pricing, faq, close) | Where people stop |
| `cta_click` | which action, which block | Which button works |
| `plan_click` | plan key | Which plan people want |
| `form_start`, `form_submit`, `form_error` | level chosen | Where the form loses people |
| `demo_open` | from which block | Whether the example is used |
| `film_start`, `film_scene`, `sound_on` | scene id | Whether the film earns its place |
| later: `signup_start`, `signup_complete`, `first_concept`, `checkout_start`, `subscription_started` | plan key | The paid funnel |

Design notes for the builder: one table (`site_events`: time, event, path, section, detail as JSON, an anonymous visit id); the visit id is a random value kept for the browser session only, with no name, email or network address stored; known crawlers dropped; the public route rate-limited like the request form; rows older than a set period summarised and deleted; one Admin screen with the funnel per day and per source. The page needs one plain sentence saying visits are counted on this server and nothing is sent to anyone else. Real-device speed (largest paint, interaction delay) can be sent to the same table from the browser's own timing interface.

---

## 6. What cannot be claimed, and what to use instead

| Cannot be said | Why | Honest substitute |
|---|---|---|
| Testimonials, customer logos, "trusted by", user counts | There are no customers | The worked example on its real rows; the founder by name and face; the public source; a dated record of what shipped |
| "On sale", "launched", "sold" about Baggage Claims | Not manufactured or sold; sales stage not started | "Designed, costed and planned"; a photograph of a printed, working tag when one exists |
| "Faster", any time or percentage saved | Never measured | Time one real run (idea to costed parts list) and publish that number with how it was taken |
| "Works with Amazon, X, Instagram, your printer" as fact | Built to documentation, tested against stand-ins only | "Built to each service's published interface; not yet run on live accounts", in one place |
| "Team seats, roles" as available today | The live install has one account until the cut-over | Mark Studio as opening after workspaces ship, or hold the card until then |
| Scarcity ("only 50 places", countdowns) | Would be invented | A founding price that is real and written down: who gets it, for how long |
| "Secure", "private" without detail | The self-host FAQ says keys are not encrypted; hosted terms are unwritten | State exactly who can read a hosted workspace and how to export and delete it, once decided |

Open questions for the owner (business choices only):

1. Free plan, free trial, or both, and is a card asked for up front? (Still open in the pricing design; it changes the hero button and the targets.)
2. May the page show $29 and $99 now, before anything can be bought, as a founding price charged only when a workspace opens? If so, what does a founding member get, and for how long?
3. The limits for each plan: concepts, seats, storage, AI credits a month, and what a top-up costs.
4. Is there a yearly price, and at what discount?
5. Does self-hosting stay a free, public, equal option on the selling page, or move to its own page? (Linked to the open question of keeping the repository under Apache 2.0 once the service charges.)
6. Headline: keep "built and on sale", or promise what the example can show today?
7. Will the owner put his name, face and a short reason on the page?
8. How fast will access requests be answered, and can the page promise that time?
9. Is a cancel-any-time and export-everything promise acceptable, and any refund term?
10. Where will visitors come from first (maker communities, Kickstarter-preparation audiences, search, paid)? The targets in 3.3 need a traffic plan, and none was found.
11. Does Studio stay on the page before team workspaces are live?

---

## 7. Sources

Read on 22 Nov 2026 unless marked. Earlier sources (S1 to S37) are in `evidence.md` and are cited above by those numbers.

1. Unbounce, Conversion Benchmark Report, SaaS page (2024 edition): https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/ . Measured on landing pages built with Unbounce; correlational.
2. ChartMogul, The SaaS Pricing Report (13 Oct 2020), over 600 B2B pricing pages: https://chartmogul.com/blog/saas-pricing-report/ . Measured; six years old; B2B.
3. ChartMogul with Kyle Poyar and ProductLed, The SaaS Conversion Report (Jan 2026), 200 B2B products, self-reported: https://chartmogul.com/reports/saas-conversion-report/ . Figures read through Userpilot's summary: https://userpilot.com/blog/free-trial-conversion-rate/ , and `evidence.md` S21.
4. Flux pricing: https://www.flux.ai/p/pricing . Observed. Dollar amounts did not come through in the fetched text.
5. Notion pricing: https://www.notion.com/pricing . Observed.
6. Framer pricing: https://www.framer.com/pricing . Observed.
7. Lovable pricing: https://lovable.dev/pricing . Observed.
8. Bubble pricing: https://bubble.io/pricing . Observed.
9. Prelaunch pricing: https://prelaunch.com/pricing . Observed; price labels were partly garbled in the fetched text.
10. Amplitude blog, "Trial or freemium? Get the best of both with a reverse trial": https://amplitude.com/blog/reverse-trial . Opinion; its figures are the author's recollections.
11. Lenny Rachitsky, "What is good waitlist conversion" (1 Mar 2022): https://www.lennysnewsletter.com/p/what-is-good-waitlist-conversion . Informal founder poll, sample not stated; part of the article is behind a paywall and was not read.
12. ChartMogul, SaaS pricing pages 2017 (over 100 B2B pages): https://chartmogul.com/blog/saas-pricing-pages-2017/ . Read; it gave only one usable figure (about 70% show a feature table) and is not relied on above.

Replit, Meshy, Linear and the Flux home page are cited from the 21 Nov audit (`audit.csv`, `comparables.md`), not re-read today.

**Not found:** a measured study of proof for a product with no customers; a measured comparison of section orders; a measured effect of a yearly switch or a "most popular" label on revenue. Where the review recommends these, it says they are convention.

**Could not check:** the page in a real browser or on a phone; real load times; what the demo shows after sign-in; whether the GitHub repository is public to a visitor.
