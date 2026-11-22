# Landing page comparables for "Concept to realization"

Read on 2026-11-21. Row-level detail is in `audit.csv` (19 rows: 16 comparables, 3 standouts).

## How to read this

- Every page was read with a text fetcher that returns the page as text. It does not run the page or show it. So **motion was never seen directly**. Where this file says something moves, it is either (a) stated by the page's own text or file names (a video duration, a `.webm` file, a carousel counter), (b) inferred from text that only makes sense as animation states, or (c) taken from a third-party write-up fetched on this run. Each case is labelled.
- A direct download of the raw HTML was tried for ten of the sites and refused by this session's network policy, so no CSS or script was inspected.
- "Could not read" in the CSV means the fetched text did not contain the answer.
- Counts are out of the 16 comparables ("of 16") or the 3 standouts ("of 3").

## Final list

### Comparables (16)

| # | Page | URL | Why it is comparable |
|---|------|-----|----------------------|
| 1 | Lovable | https://lovable.dev/ | Paid self-serve tool that takes a plain-language idea to a deployed product; same promise in software. |
| 2 | Bolt | https://bolt.new/ | Idea-to-app by chat, with the prompt box as the hero; free tier then paid. |
| 3 | v0 | https://v0.app/ | Prompt-to-app with a template gallery as proof; free tier then per-user plans. |
| 4 | Replit | https://replit.com/ | Idea-to-app page that shows a worked chat example and puts pricing on the landing page. |
| 5 | Flux | https://www.flux.ai/ | Closest product match: AI takes a hardware idea through schematic, board, mechanical and manufacturing. |
| 6 | Onshape | https://www.onshape.com/en/ | Browser CAD with a free tier and self-serve trial; covers our Design stage. |
| 7 | Autodesk Fusion | https://www.autodesk.com/products/fusion-360/overview | Design, electronics, simulation and manufacturing in one paid tool; multi-stage pitch. |
| 8 | tscircuit | https://tscircuit.com/ | Electronics design shown through real example boards and code; strong example-led page (free, open source). |
| 9 | Meshy (added) | https://www.meshy.ai/ | Sketch or text to printable 3D model; paid credits; before-and-after worked examples. |
| 10 | Zoo (added) | https://zoo.dev/ | Hardware design-to-machining stack presented as a numbered five-stage roadmap. |
| 11 | Shopify (added) | https://www.shopify.com/ | The Sales end of our lifecycle; self-serve paid; sells an outcome rather than features. |
| 12 | Xometry | https://www.xometry.com/ | Self-serve instant quoting for prototype and production parts; our Prototype and Production stages. |
| 13 | Protolabs | https://www.protolabs.com/ | Prototype-to-production manufacturing with a product life-cycle section. |
| 14 | Fictiv | https://www.fictiv.com/ | Prototype-to-production manufacturing sold on a single growth story. |
| 15 | JLCPCB | https://jlcpcb.com/ | Board fabrication with a live quote configurator and prices on the landing page. |
| 16 | Prelaunch | https://prelaunch.com/ | Product-demand validation before launch; hero shows three sample physical products with results. |

### Standouts for animated product storytelling (3)

| # | Page | URL | Why chosen, and who cites it |
|---|------|-----|------------------------------|
| 17 | Linear | https://linear.app/ | Named as an example of story-led heroes by https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples and for its animations and in-browser demo by https://line25.com/articles/best-landing-page-design-examples-2026/ . |
| 18 | Stripe | https://stripe.com/ | Named by the line25 article for its animated hero gradient; its 2026 rebuild is discussed by its design lead, summarised at https://stationlm.com/analysis/99a88bcb-1514-4f61-a540-e685300d53a3 . |
| 19 | Framer | https://www.framer.com/ | Named beside Linear and Notion for story-led heroes by the saasframe article. |

Pricing detail for seven rows came from each product's own pricing page, fetched on this run: https://lovable.dev/pricing , https://bolt.new/pricing , https://v0.app/pricing , https://www.flux.ai/p/pricing , https://www.meshy.ai/pricing , https://www.onshape.com/en/pricing , https://prelaunch.com/pricing .

## Dropped, and why

| Candidate | URL tried | Reason |
|-----------|-----------|--------|
| Kickstarter creator pages | https://www.kickstarter.com/creators , https://www.kickstarter.com/start | Both refused the fetch (client error). A creator-facing comparison page did load (https://launch.kickstarter.com/vs/indiegogo): text-only, fee table, FAQ, a "Start a project" button. It is a comparison page, not the landing page, so it is not in the audit. |
| Indiegogo launch page | https://www.indiegogo.com/en/launch | Tried as a substitute; fetch refused. |
| LaunchBoom | https://www.launchboom.com/ | Live, but not self-serve: every path leads to a conversation with a person, and no price or signup is shown. Worth noting only for its gallery of funded campaigns with amounts. |
| Printables | https://www.printables.com/ | Live, but the home page is a community feed (contests, clubs, articles) with no pitch, no primary action and no pricing in the fetched text. |
| Thangs | https://thangs.com/ | Live, but a marketplace home feed. One subscription bundle is advertised; no product story. |
| Instructables | https://www.instructables.com/ , https://www.instructables.com/about/ | Only page metadata came back (the page builds itself in the browser). Could not audit. |
| Tinkercad (considered as an addition) | https://www.tinkercad.com/ | Only metadata came back. Could not audit. |
| Arc (suggested standout) | https://arc.net/ | No longer a product page. It now announces the browser's end date and sends visitors to a successor. |
| Notion (considered as a standout) | https://www.notion.com/ | Fetched; the page text showed one hero video and static feature images, with no worked example data. Less to learn than the three kept. |

## Patterns

### (a) Seen on at least half of the 16 comparables

1. **Numbers as proof** (13 of 16; 3 of 3 standouts). User counts, parts shipped, projects built, multipliers. Only one page (Shopify) attributes any figure to an outside study; Flux's multipliers carry no source.
2. **No prices on the landing page** (13 of 16; Linear and Framer the same, Stripe gives a one-line summary). Pricing sits one click away. Exceptions: Replit (full plan cards with a monthly/yearly switch), JLCPCB ("from" prices on each product), Fusion (plan names, figures failed to render).
3. **Customer quotes or stories** (11 of 16; 2 of 3 standouts). Usually three to five, each tied to a named company, often with a metric.
4. **A short stepped "how it works"** (10 of 16). Three to five steps in verbs: describe, build, refine, deploy (Lovable); brainstorm, design, make (Flux); a five-stage numbered roadmap (Zoo); four ordering steps (JLCPCB); five steps (Prelaunch).
5. **The page ends by repeating the opening action** (9 of 16; 3 of 3 standouts). Bolt and Framer repeat the prompt box itself at the foot.
6. **"Free" is said on the landing page** (9 of 16: Bolt, Replit, Flux, Onshape, Fusion, tscircuit, Meshy, Zoo, Shopify). Usually inside the button wording.
7. **A logo strip** (9 of 16; on Protolabs and Fictiv only the heading came through in text).
8. **Nothing the visitor can verifiably use before signing up** (0 of 16 confirmed a no-account trial in page text). tscircuit's playground link and JLCPCB's on-page configurator are the nearest.

Seen on fewer than half, but relevant:

- A named worked example (6 of 16: v0, Replit, Flux, tscircuit, Meshy, Prelaunch; Shopify shows unnamed product mock-ups).
- The hero is the input itself: a prompt box, upload or configurator (5 of 16: Bolt, Replit, Meshy, JLCPCB, and v0 by implication).
- A question as headline, addressed to the visitor (4 of 16: Bolt, v0, Replit, Meshy).
- Audience or role cards (6 of 16: Bolt, Flux, Onshape, Fusion, Meshy, Zoo).
- FAQ on the page (5 of 16: Flux, Fusion, tscircuit, JLCPCB, Prelaunch).
- Embedded video (5 of 16: v0, tscircuit, Xometry, Fictiv, JLCPCB).
- "No card needed" said on the landing page itself (2 of 16: Onshape, Meshy). Three more say it only on the pricing page (Lovable, Bolt, Prelaunch).

### (b) The four best-matched pages

Chosen for the same promise as ours (one person, one idea, one tool, a finished thing) and a paid self-serve model: **Flux, Meshy, Replit, Lovable**.

1. **The headline names the outcome, not the tool** (4 of 4). An idea made real, in the visitor's terms.
2. **Usage is metered in credits or units, on top of plan tiers** (4 of 4; Flux compute units on the landing page, Lovable and Meshy credits on pricing pages, Replit usage limits in its free mode).
3. **Counts plus named customer quotes or stories** (4 of 4).
4. **An "end to end" claim** (3 of 4: Flux, Lovable, Replit). The page says the tool covers everything; none shows every stage.
5. **A worked example with a name** (3 of 4: Flux's wearable camera, Replit's mood-board chat, Meshy's bust, lion and wolf). Each example appears in one section only.
6. **A verb-led step sequence** (3 of 4: Flux, Lovable, Replit). Meshy orders by use case instead.
7. **A free way in, said on the landing page** (3 of 4: Flux, Meshy, Replit; Lovable says it on its pricing page).
8. **The input as hero** (2 of 4: Replit, Meshy). Flux leads with a photograph of a person holding the finished board, the only page of the 16 to open on the physical result.
9. **Prices on the landing page** (1 of 4: Replit).
10. **Card needed for a trial** (1 of 4: Flux's top individual trial, per its pricing page; Lovable and Meshy state no card for free plans; Replit could not read).

### (c) Animation and storytelling techniques on the standout pages

Each item says what the evidence is. Build notes are a suggestion for how to make the same effect, not a claim about how the site built it.

**Linear (https://linear.app/)**

1. **One fictional team's data in every section** (seen in page text). The mock issue in the hero, the intake backlog, the roadmap, the agent chat and the code-review diff all belong to the same invented product team, with consistent issue numbers. Sections follow the product's own life-cycle order: intake, plan, delegate to an agent, build and review. *Build:* one JSON fixture for the example; every section's mock panel renders from it.
2. **Mock product panels that carry state** (state text seen; motion inferred; a third-party preview at https://departmentofproduct.substack.com/p/deep-homepage-ux-explored calls them live widgets that animate each step). Cards show a working label, then a "worked for" duration; an activity line records a status move; an agent prompt appears as typed text followed by its result. *Build:* real HTML components, not screenshots or video. Each has a small scripted timeline (prompt types in, status pill changes, result line appears) that starts when the panel scrolls into view and holds its final state.
3. **Figure captions** (seen). Three value statements are each paired with a numbered "Fig" label, like plates in a manual. *Build:* a small caption under each illustration; cheap, and it frames marketing art as evidence.
4. **Changelog as a closing proof** (seen). Recent dated releases sit just above the customer quotes.
5. **Proof placed inside the argument** (third-party, https://webtrends.pages.dev/news/2026-04-28-linear-homepage-redesign ). Each claim is followed by its supporting customer figure rather than saving proof for one block.

**Framer (https://www.framer.com/)**

6. **Short hero film** (seen: a 0:36 duration on the hero video). *Build:* muted, captioned video with a poster frame and a visible pause control.
7. **Prompt, thinking, result** (seen as text). An agent panel shows a one-sentence request about the example studio site, then thinking lines, then a completed-plan line with a seconds count, then the result. *Build:* three-state component on a timer: typewriter prompt, pulsing status rows, cross-fade to the result image.
8. **A scripted terminal log** (seen: 11 status lines from connecting to import complete). *Build:* lines appended one at a time at 300 to 600 ms, each turning from pending to done.
9. **Prompt chips at the foot of the page** (seen: four chips above a prompt form). Clicking a chip is the sign-up action, with the visitor's intent already captured. *Build:* chips prefill a text field whose submit goes to signup carrying the text.
10. **Logo and site strips** (inferred: the same lists appear twice in the markup, the usual sign of a looping marquee). *Build:* duplicated row with a CSS translate loop, paused on hover and under reduced-motion.

**Stripe (https://stripe.com/)**

11. **A moving hero background with a still fallback** (seen: image files named as wave fallbacks; the interview summary at https://stationlm.com/analysis/99a88bcb-1514-4f61-a540-e685300d53a3 says the wave was tuned to run smoothly on ordinary machines). Third parties disagree on detail: https://line25.com/articles/best-landing-page-design-examples-2026/ says the gradient shifts with scroll, https://uirip.pages.dev/blog/teardowns/stripe describes an animated gradient mesh. *Build:* canvas or CSS gradient behind the headline, static image for small screens and reduced-motion.
12. **A staged analysis panel** (text seen; motion inferred). A mock payment form sits beside a checklist whose lines each end in an ellipsis and then resolve to a finished line with scores. *Build:* rows that tick over in sequence, then a score that counts up.
13. **Cards that open in place** (interview summary). Product cards in a grid open an overlay with more detail, so the visitor never leaves the page. The same source says accordions tested poorly because few people open them.
14. **A helper input with a live quality checklist** (seen). A field asks for a company address or description, with a character counter and four ticks showing what a good answer includes. *Build:* textarea, counter, and four checks driven by simple keyword tests.
15. **A numbered news carousel** (seen: an item counter over eight items with a thumbnail list).

**Also seen on the comparables**

- Rotating final words in the headline (Shopify, inferred from the list of alternates).
- Before-and-after image pairs of one object (Meshy).
- A validation checklist panel shown mid-run (Flux).
- An on-page configurator that leads straight to a price (JLCPCB).
- Interactive 3D previews of real example boards (tscircuit).
- Monthly/yearly pricing switch (Replit).

**Not found.** No fetched page gave evidence of the pattern in the brief's example: a pinned section whose picture changes as numbered steps scroll past. It may exist on these pages; a text fetch cannot show it. The saasframe article lists the general motion vocabulary in use (sections that fade and slide in on scroll, icons that move as their block enters view, a hover pulse on the main button, a draggable before/after slider) without tying a pinned sequence to any of the three standouts.

### (d) What none of them do, that a concept-to-product page could

Each is 0 of 19 unless noted.

1. **Carry one example product through every stage.** Linear comes closest (1 of 19) with one team's data across four software stages. No page follows one physical product from first sketch to first sale.
2. **Show the artefact each stage produces.** Pages show the tool's screen. None lines up the outputs: brief, research note, 3D model, schematic, parts list, printed part, wired prototype, production quote, advert, listing.
3. **Cross from screen to object and back.** Software pages stop at deploy; manufacturing pages start at an uploaded file; launch pages start at a finished product. Flux's hero photograph of a held board is the only bridge (1 of 19).
4. **Keep a running tally.** No page shows cost, parts count or elapsed time building up across the journey, though the manufacturing pages quote single prices.
5. **Let the visitor choose which example to follow.** Prelaunch shows three sample products side by side (1 of 19) but the visitor cannot steer a story with them.
6. **Tie price to the story.** No page says which stages a free or paid plan covers at the point where the stage is shown. Pricing is either absent or a separate table.
7. **Be plain about what the tool does and what the person still does.** "End to end" claims are common; no page marks the hand-offs (ordering parts, soldering, shipping).
8. **Offer a verifiable no-account taste of a middle stage.** Hero prompt boxes exist (5 of 16) but none confirmed in text that they run before signup, and all start at stage one.
9. **State motion controls.** No page text mentioned a pause control or reduced-motion handling; one third-party article praises another site for a hero pause button (https://www.framer.com/blog/tech-website-design-examples/).

## Could not verify

- Any motion, timing, easing, pinning or hover behaviour, on any page (text fetch only; raw HTML download refused).
- Lovable's hero input and button wording; the fetched text held neither.
- Flux's plan prices (figures did not render) and whether it has a permanent free plan.
- Fusion's on-page prices (template placeholders in the fetched text).
- Sign-up fields or methods for most pages (named only by Fusion, Stripe and, in part, v0); they sit behind the signup link.
- Whether a card is required for paid plans, on most pages.
- Kickstarter's and Instructables' landing pages.
- The Department of Product write-up is paywalled; only its preview was read.
