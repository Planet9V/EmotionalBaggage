# Task board

Kept by the project manager; updated at every merge. Plan: `docs/plan-2026-11-22-parallel-delivery.md`. Owner decisions: `docs/PLAN.md` (D1 to D14) and section 1a of the plan.

## Running

| Task | Workstream | Model | Branch |
|---|---|---|---|
| Workspaces, invitations, members, two-factor requirement, first-run owner page, platform-admin functions, mail optional, settings in PostgreSQL | WS2 slice 2 | Fable-tier (security) | `ws2b-workspaces` |
| Admin area, part A: overview, Stripe, pricing and tiers, mail, channels, AI and embeddings, voice, other services | WS10 | Fable-tier (design) | `ws10-admin` |
| Slack step 1: event catalogue and message builders | WS11 | Sonnet | `ws11-slack` |

| Tag Rev C: product design, three directions, colourways, renders | WS8 | Fable-tier (design) | `/home/claude/work/tag/revC` |

## Next

| Task | Workstream | Model | Waits for |
|---|---|---|---|
| Voice-overs tool: generate, preview and store clips for the scenes (Kokoro or OpenRouter), played by the film | WS12 | Sonnet build, lead review | admin area, cut-over |
| Independent security review of slice 2 and the admin area | WS2, WS10 | Fable | their branches |
| Admin area, part B: users and organizations screens on the platform-admin functions | WS10 | Sonnet, to a written specification; Fable review | slice 2 |
| Sign-in cut-over: remove `demo`/`demo`, row-level security on concept tables | WS2 slice 3 | Fable-tier | owner go-ahead |
| Stripe subscriptions, plan limits from the catalogue, AI credits | WS6 | Fable-tier | slice 2, admin part A |
| Slack steps 2 to 5: admin section and platform channel; request checking, linking and buttons; workspace channels; commands and assistant | WS11 | Sonnet build, Fable for step 3 and review | admin part A, slice 2 |
| User guide pages for Status, the admin area and accounts | docs | Sonnet | the features landing |
| Re-sync the project documents | docs | lead | none |

## Owner decisions, 22 Nov (10:03)

- Sign-in cut-over: approved, once accounts slice 2 passes its second review. The owner creates `admin@oxot.nl` on the first-run page.
- Prices: Maker $29 and Studio $99 a month accepted. Tier limits come from the approved pricing design and are shown to the owner in Admin before prices go public.
- Workspace rules accepted: 5 owned workspaces per person, 50 people per workspace, 20 invitations an hour; members see the member list; an invited person keeps a workspace of their own.
- Tag: 80 x 60 x 42 mm from the documentation. Rev C in design: three directions with colourways, name and tagline as multi-material inlays in one print; the owner chooses.
- Voice: an option set in Admin; voice-overs generated through Kokoro or OpenRouter with a choice of model and voice.

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
