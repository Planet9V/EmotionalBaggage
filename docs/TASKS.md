# Task board

Kept by the project manager; updated at every merge. Plan: `docs/plan-2026-11-22-parallel-delivery.md`. Owner decisions: `docs/PLAN.md` (D1 to D14) and section 1a of the plan.

## Running

| Task | Workstream | Model | Branch |
|---|---|---|---|
| Workspaces, invitations, members, two-factor requirement, first-run owner page, platform-admin functions, mail optional, settings in PostgreSQL | WS2 slice 2 | Fable-tier (security) | `ws2b-workspaces` |
| Admin area, part A: overview, Stripe, pricing and tiers, mail, channels, AI and embeddings, voice, other services | WS10 | Fable-tier (design) | `ws10-admin` |
| Slack step 1: event catalogue and message builders | WS11 | Sonnet | `ws11-slack` |

| Tag Rev C: product design, three directions, colourways, renders | WS8 | Fable-tier (design) | `/home/claude/work/tag/revC` |

## Next, in the owner's order of 22 Nov (11:44)

The build machine is at its limit with seven agents (load 10 on 2 processors), so each of these starts when a running agent finishes.

| # | Task | Workstream | Model | Starts after |
|---|---|---|---|---|
| 1 | Cut-over: turn the new sign-in on; owner creates `admin@oxot.nl` | WS2 | lead, with the owner | accounts integration passes review |
| 2 | Concepts separated per workspace: `workspace_id` and row-level security on every concept table; a test that walks every route as a second workspace | WS2 slice 3 | Fable-tier, security review | accounts integration merges |
| 3 | Admin screens for users and organizations on the platform-admin functions | WS10 part B | Sonnet to a written specification, lead review | accounts integration merges |
| 4 | Smaller faults from the handover: enclosure page blocks with no route to the fix; drafts show raw JSON; "Ask the assistant" missing on some rows; first next step is "Add a file"; audit-log flooding from the public form; no way to delete an access request; no upper bound on part quantity; export builds every file in memory; the two forms needing a wording decision | app | Sonnet, lead review | a free place |
| 5 | Stripe subscriptions from the plan catalogue, plan limits enforced, AI credits ledger, billing page | WS6 | Fable-tier, security review | slice 3 |
| 6 | User guide pages: Status, Admin, accounts and workspaces, voice-overs, the public page | docs | Sonnet | a free place; each page when its feature lands |
| 7 | Voice clips and scenes ready for the owner's review | WS12, WS13 | lead | those agents finishing |
| 8 | Slack steps 2 to 5 | WS11 | phase 2, by the owner's ruling | after the above |

## Owner decisions, 22 Nov (10:03)

- Sign-in cut-over: approved, once accounts slice 2 passes its second review. The owner creates `admin@oxot.nl` on the first-run page.
- Prices: Maker $29 and Studio $99 a month accepted. Tier limits come from the approved pricing design and are shown to the owner in Admin before prices go public.
- Workspace rules accepted: 5 owned workspaces per person, 50 people per workspace, 20 invitations an hour; members see the member list; an invited person keeps a workspace of their own.
- Tag: 80 x 60 x 42 mm from the documentation. Rev C in design: three directions with colourways, name and tagline as multi-material inlays in one print; the owner chooses.
- Voice: an option set in Admin; voice-overs generated through Kokoro or OpenRouter with a choice of model and voice.

## Owner rulings on Baggage Claims, 22 Nov (11:15)

Standing rule: do not ask the owner about things already decided or that engineering can settle. Unknown numbers are estimated with reasonable figures and labelled as estimates. Most effort goes into the design, printing and BOM of the device; marketing and sales stay general (outlets, channels, enabling steps).

- Stack settled: Next.js, React, Tailwind, PostgreSQL with pgvector, PostgreSQL for files and embeddings. No Shopify: Stripe and Amazon marketplace. Own mail server, set by the admin. Referral engine built in.
- Device: 2 x AA; Adafruit MPU6050 breakout; an off switch; an Arduino sketch is needed; integrated print with minimal user intervention; prototype costs are added up as estimates.
- Detection: free-fall over 0.3 s; carousel = circular, periodic motion for about 15 s or more; handle grab = tilt and quick motion, then sustained tilt and steady carry; hard impact as documented; the best way to detect a throw is to be worked out.
- Marketing budget 5,000 USD. Voice packs and holiday packs to be evaluated, including a "New Yorker" pack. The funniest lines and new circumstances to be proposed.

Running from these: WS14 device engineering and firmware (`ws14-device`), WS15 rulings, lines, packs and channels (`ws15-rulings`), WS13 character animation (`ws13-characters`).

## Held for the owner

| Task | Needs |
|---|---|
| The handle tag in the app and in the scenes (WS8) | choice of Rev C direction and colourway, and the tagline |
| Enter the Baggage Claims content (WS9) | review of the 491-row sheet |
| Sound in the scenes | the Voice-overs tool (WS12), after Admin lands |

## Done, 22 Nov

| Task | Workstream |
|---|---|
| Scenes, third pass; slow-device fallback | WS1 |
| Accounts slice 1 behind its switch; security review and 12 fixes | WS2 |
| Eight wiring faults, each with a test | WS3 |
| Contrast, request form level, owner files seeded, unused bag removed | WS4 |
| Status page at `/status` | WS5 |
| One source for status colours and channel names; 14 forms converted; unused exports 54 to 18 | WS7 |
| 11 more forms converted by a Sonnet agent, lead-reviewed (hand-wired 26 to 17) | WS7 |
