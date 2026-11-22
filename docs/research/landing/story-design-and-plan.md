---
title: "Does a story told in the owner's own scenes sell a concept-to-market SaaS better than a feature page?"
type: plan
created: 2026-11-22
updated: 2026-11-22
status: draft
author: mixed
methodology: mixed
design: "sections 1 to 4 of this file"
---

# The story: design and plan

Status **draft**, for the owner's sign-off on sections 2, 3 and 5. Work on section 3 has started because he asked for it now; the rest follows his answer. This sits on top of `proposition-brief.md` and `landing-page-plan.md` and replaces their page order where they differ.

## 1. Question

How should the welcome page tell one story, in the owner's own jokes and circumstances, so that makers, first-time founders and small product firms understand in one visit that this is a paid service that takes their idea from concept to product to market, with Baggage Claims as the worked example?

## 2. The story spine

One idea, five chapters. The visitor is the hero; Baggage Claims is the idea they watch go through.

| Chapter | What the visitor sees | What they should think |
|---|---|---|
| 0. The promise | Hero: your idea, built and on sale; AI drafts each stage and you decide; one action | "This is a service for my idea." |
| 1. It started as a joke | The owner's circumstances played as scenes: the check-in scale, the handler's toss, the handle, the dark hold, the carousel | "That is funny. And it is somebody's real idea." |
| 2. So he typed it in | The idea as one line going into the workbench; the brief, the challenge, the sourced answers coming back | "I could do that with mine tonight." |
| 3. It became a thing | The live engineering stage: parts list, schematic, layout, translucent 3D, enclosure and print, build sheet, cost | "This is real engineering." |
| 4. It went to market | Positioning, brand kit, ads per channel, landing page, launch plan, listing, channels, results | "It does not stop at a prototype." |
| 5. Your turn | Service levels and prices, sign up or request access, questions | "I know what it costs and how to start." |

The split-flap board becomes the chapter marker that runs through the page: each chapter opens with its row flapping to its status.

## 3. The scene bible: the owner's circumstances

Every detail below is from his documents: the launch video script (`BaggageClaims_LaunchVideo_Script_RevA.txt`, Act 2) and the ranked gag catalogue in his first note. Lines are verbatim. "Sensed" is the label the script supers on screen. Nothing may be added that is not in those files.

| # | Circumstance | How the gadget knows (his catalogue) | Beats | The line | Sensed |
|---|---|---|---|---|---|
| 1 | **Check-in scale.** The agent lifts the bag onto the scale. | Lift, held perfectly still 2 to 3 seconds, set down | Lift; set down; perfect stillness; the display climbs and stops at 62 lbs; one held beat; the line; the agent, straight-faced: "Sir, the bag is over the limit." | "Are you... calling me FAT?" | WEIGH_IN |
| 2 | **The handler's toss.** The bag arcs from cart to belt. | Free-fall over 0.3 s, then a hard impact spike | Wind-up; arc; mid-air freeze; THUD; the line; the handler turns toward the sound, confused | "OW! ...I felt that in my flip-flops." (script: "OW! Ow. Ow. Owww.") | FREEFALL + IMPACT |
| 3 | **The handle.** At the curb, a hand grabs the handle after the bag has sat idle. | Lifted and carried by the handle after idle | Bag at rest; hand closes on the handle; lift; a beat; the line; the owner pauses and glances down | "Whoa whoa whoa — are you gonna buy me dinner first?" | HANDLE_GRAB |
| 4 | **The dark hold.** On a cart in the dark; nothing moves. | No motion and no light for 2 hours or more | Lights down; slow push-in; long nothing; the sleepy line; "(beat) In the dark."; snoring | "Hello? ...Anyone? ...Cool, cool. I'll just be here." | DARK_IDLE, 2 hrs |
| 5 | **The carousel.** The bag rounds the bend, gadget visible. | Circular, periodic motion for about 30 s or more | Belt turning; the bag comes round the bend; leans into the turn; the line; a stranger: "Where did you GET that?" | "Wheeee! Again! Again!" (alt: "Is this the Tilt-A-Whirl?") | CAROUSEL |
| 6 | The scenic route. Conveyor or tarmac cart rumble. | Sustained low-frequency rumble | Slow ride; muttering | "Oh sure, I'll take the scenic route." | (rumble) |
| 7 | Inverted. | Tilted past about 90 degrees | Tip; hang upside down | "I'm— I'm inverted. Somebody call Goose." | (inverted) |
| 8 | **The button.** Back at the scale. | as 1 | Same set as 1; the display still reads 62 | "Sixty-two pounds? That's mostly SOUVENIRS." | WEIGH_IN |

Scenes 1 to 5 are the five that must reach 9 out of 10. Scene 8 closes the loop, as it closes his script. Scenes 6 and 7 are extras.

Rules of comedy taken from his playbook: the bag speaks in the first person and never the company; deadpan world, chaotic bag; the line lands after the trigger and a held beat, never before; one action per moment.

## 4. How the scenes are made: three approaches

| | Approach | For | Against |
|---|---|---|---|
| A | Flat drawn scenes (SVG with CSS animation) | Light, sharp, quick to build | Hard to make feel premium; reads as an illustration set; weakest odds of 9 |
| B | **Real-time 3D dioramas** in the stack the app already uses (three.js through React Three Fiber): a stylised set per circumstance, real lighting and shadow, a camera that cuts and pushes in as the script does, and the bag carrying the app's own 3D model of the gadget | The strongest look; the camera can do the script's shots (the push-in on the hold, the wide on the carousel); it uses the product's real model, so the joke and the engineering are one thing; consistent with the live 3D stage further down | Heavier; needs care on phones; more to build |
| C | Filmed or generated video | Closest to the script | No footage exists; generated imagery is ruled out by the owner |

**Recommendation: B**, with A's drawn stills as the fallback for reduce-motion, no-script and weak devices. It is the approach that pushes furthest and matches what the owner called the wow: the 3D.

Presentation: a full-width cinematic stage with a chapter list of the circumstances beside it; it plays through continuously; choosing a circumstance cuts to it. A lower third shows the sensed label as the script's supers do. Lines are typed on as subtitles in the bag's voice. No sound (a page that plays audio unasked is hostile), unless the owner wants an opt-in "sound on" later with recorded lines.

## 5. Hypotheses

**Part A (no pre-registration).** Building the page on this spine and these scenes.

**Part B (`pre-registered: true`, proposed).**
- **H1 (comprehension).** After 5 seconds on the first screen, at least 4 of 5 fresh reviewers say the site sells a service that takes a product idea to market, not a suitcase gadget.
- **H2 (the jokes land).** For each of scenes 1 to 5, at least 4 of 5 fresh reviewers shown the scene without its caption can say what is happening to the bag and why the line is funny.
- **H3 (visual bar).** Each of scenes 1 to 5 scores 9 or more from the owner. Reviewer scores are advisory; the owner's score is the measure.
- **Falsification.** Any of H1 to H3 unmet means the page is not done; the failing chapter or scene goes back.
- The earlier live-traffic hypothesis (the worked-example page beats the screenshot page) stands unchanged and waits for sign-up and traffic.

## 6. Data sources

- `seed/concepts/baggage-claims/files/BaggageClaims_LaunchVideo_Script_RevA.txt` (in the repository; read)
- `seed/concepts/baggage-claims/files/I have an idea for a quick gag and potential quick.md` (read)
- `seed/concepts/baggage-claims/files/BaggageClaims_Marketing_Playbook_RevA.txt` (brand rules)
- `src/lib/story/seed.ts` (the story's voice part)
- The app's 3D model of the example (`src/components/three/`, `src/components/welcome/exampleData.ts`)
- `docs/research/landing/proposition-brief.md`, `comparables.md`, `evidence.md`
- `docs/research/saas-pricing-and-platform-design.md` (service levels)

## 7. Tasks

### Task 1: Scenes 1 to 5 and 8 as 3D dioramas
**Files:** `src/components/welcome/scenes/*`
- [ ] One shared bag with the gadget strapped on, posed by code (lean, puff, wobble, droop)
- [ ] One set per circumstance; one camera move per beat, following the script
- [ ] Sensed lower third; subtitles typed after the beat
- [ ] Chapter list; continuous play; drawn still per scene as fallback
- [ ] Captures of four beats per scene; reviewed against H2

### Task 2: Hero to the proposition
**Files:** `src/components/welcome/Hero*.tsx`, `content.ts`
- [ ] Headline and one sentence about the visitor's idea and the outcome
- [ ] The idea-in, outputs-out visual from the example's real artefacts

### Task 3: Chapters 2 and 4
**Files:** `src/components/welcome/*`
- [ ] "So he typed it in": the one-line idea, the brief, the challenge, a sourced answer
- [ ] "It went to market": positioning, brand kit, ads, landing page, launch plan, listing, channels, at the weight of the engineering stage

### Task 4: Chapter 5, service levels and sign-up
**Files:** `src/components/welcome/Pricing.tsx`, `content.ts`
- [ ] The four levels with what each includes
- [ ] Prices as the owner sets them
- [ ] "Request access" per level now; real sign-up when accounts exist

### Task 5: The board as chapter marker
**Files:** `src/components/welcome/DeparturesBoard.tsx`, `page.tsx`

### Task 6: Review against H1 to H3
- [ ] Five fresh reviewers for H1 and H2
- [ ] The owner's scores for H3

## 8. Verification

- [ ] Scenes 1 to 5 each scored 9 or more by the owner
- [ ] H1 and H2 met with fresh reviewers
- [ ] Every line, number and sensed label on the scenes traced to its file and place
- [ ] The page still passes CI, the accessibility scan and the phone captures
- [ ] The scenes do not slow the first screen: the hero paints before any 3D loads

## 9. Risks

- **Quality.** A 9 is the owner's judgement, and real-time 3D built in code may land below it on the first attempt. Each scene is reviewed on its own, so a weak one does not hold the rest.
- **Weight on phones.** One live 3D stage at a time; drawn stills when the device struggles.
- **Honesty.** The scenes show the product working as designed. It has not been built yet; the page says the scenes are the storyboard for the idea, not footage.
- **No pause control**, by the owner's decision; reduce-motion visitors get the stills.

## 10. Out of scope

Sound, voice recording, filmed footage, generated imagery, and any claim that the gadget exists as a finished product.
