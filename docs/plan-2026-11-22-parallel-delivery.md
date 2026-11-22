# Parallel delivery plan, 22 November 2026

Owner instruction: a formal plan that uses several agents and a project manager, and works all open items in parallel.

## 1. How the work is run

- **Project manager:** the lead session. It writes each agent's brief, owns the order of merges, reviews every result against the brief, runs the checks, merges to `main`, deploys to Railway and reports to the owner. No agent merges or deploys.
- **Agents:** one per workstream, each in its own working copy and branch under `/home/claude/ws/`, with its own database and port, so no two agents edit the same checkout.
- **Definition of done for a workstream slice:** type check, lint and unused-code check clean; the tests for the touched area pass locally; all five CI jobs pass on the branch; the project manager has looked at the result in a browser; then it is merged and deployed.
- **Capacity:** the build machine has 2 processors and 7 GB of memory, and has restarted under load before, losing running agents. Four agents run at once. The rest start as places free up. Agents run only the tests for their own area; the full suite runs in CI.
- **Shared files:** each workstream has a list of folders it owns. Migrations must apply in number order, so the ranges in the table are working numbers only: the project manager renumbers each branch's migrations to the next free number when it merges. Anything outside the list is changed only through the project manager.
- **Owner decisions:** work that needs a decision is prepared up to the decision and then held; it never blocks another workstream.

## 1a. Deployment rule (owner, 22 Nov)

Docker first. The app runs with `docker compose up` and nothing else, and equally on Railway. The only configuration outside PostgreSQL is the database connection, which the compose file supplies. Every key, secret, address and switch, including the switch for the new sign-in, is entered in the admin area and stored in PostgreSQL. No step tells anyone to set a platform variable. The platform administrator is `admin@oxot.nl`.

## 2. Workstreams

| # | Workstream | Agent | Owns | Migrations | Wave |
|---|---|---|---|---|---|
| WS1 | Scenes, third pass: five scenes to 9 out of 10 | animation specialist | `src/components/welcome/scenes/`, scenes block in `globals.css` | none | 1 |
| WS2 | Accounts: sign-up, workspaces, invitations, two-factor | web developer | `src/lib/auth2/`, `src/app/(account)/`, `tests/auth2/` | 0030 to 0039 | 1 |
| WS3 | The eight wiring faults | general | `src/lib/` economics, claims, positioning, gates, schematic nets, drafts; their tests | 0040 to 0044 | 1 |
| WS4 | Small fixes and the owner's new files | general | `DecisionFlow.tsx` contrast, request form, `seed/` | 0045 | 1 |
| WS5 | Concept-to-production status dashboard | web developer | new `src/app/.../status`, `src/components/status/` | 0046 to 0047 | 2 |
| WS6 | Billing: Stripe subscriptions, plan limits, AI credits | web developer | `src/lib/billing/`, billing routes and page | 0050 to 0059 | 2, after WS2 slice 1 |
| WS7 | Reuse: forms onto the shared pattern, one place for status colours and channel names | refactorer | forms and shared kit | none | 2, after WS3 |
| WS10 | Platform admin area: settings for Stripe, pricing and tiers, mail, Amazon and channels, AI and embeddings, voice, other services; then full control of users and organizations | web developer | `src/app/admin/`, `src/lib/admin/`, `src/lib/auth2/adminOps.ts` | next free | 2 and 3 |
| WS8 | The handle tag in the app: form-factor decision, enclosure, print job | general | enclosure generator, concept rows | 0048 | held for owner |
| WS9 | Enter the Baggage Claims content | general | concept rows only | none | held for owner |

### WS1. Scenes, third pass
Goal: handle, scale, hold, carousel and button each reach 9 against the same rubric the toss met. Fixes named in the second-pass report: bystander's reaction (handle), agent clipped and faint puff (scale), grey bag and faint light shaft (hold), bag hidden in the stranger shot (carousel), its own set or staging (button). Also: prove the slow-machine fallback fires, and screenshot the no-script view.
Done when: a fresh reviewer who has not seen the work scores five scenes at 9 or above from frames at 1288 and 390 pixels wide.

### WS2. Accounts
Follows `docs/research/auth-trial-findings.md` tasks 2, 3, 4, 5, 10 and the owner's rulings: authenticator code with recovery codes only; an organization admin can require two-factor for the organization or for one user; an organization role that adds and invites users; first-run "create the owner" page for self-hosted installs.
- Slice 1: two database roles; Better Auth beside the current sign-in behind a switch that is off in production; sign-up with email confirmation, reset and change of password; replay guard on codes; hashed tokens.
- Slice 2: workspaces, invitations, members screen, the two-factor requirement, first-run owner page.
- Slice 3: cut-over (tasks 6 to 12), which removes `demo`/`demo`. Held until the owner says so, because it changes how he signs in.
Mail goes through one interface that writes to the log until the owner names a mail service.

### WS3. Wiring faults
The eight checks from section 5 of the landing-page plan: one price and one margin; one unit cost; a claim is verified only with a saved answer and a quote from a named source; positioning with no proof cannot be approved; changing a positioning line, claim or part lists the dependent rows; every gate check fails on an empty row; net list and electrical checks agree with the drawing when wires have no net name; assistant-drafted parts do not duplicate wizard parts.
Each fault: a failing test first, then the fix. One commit per fault.

### WS4. Small fixes and files
White-on-orange contrast at 390 pixels in `DecisionFlow.tsx`; the request form records the chosen level; the owner's generator script, materials sheet and voxel arrays added to the concept's Files and the seed; the 121 MB clamshell model reduced below the 25 MB limit or left out with a note; re-sync of the project documents.

### WS10. Platform admin area (owner instruction, 22 Nov)
An area for the application's administrator only. No service is allowed to block the app from running: every setting has a "not configured" state and the app says what is switched off.
- Part A, settings: an overview of every service and its state; Stripe keys and webhook secret; the plan catalogue (tiers, prices, limits, shown or hidden) read by the public page; mail server; Amazon and the other sales channels; AI models and embeddings; voice; other services. Secrets are write-only and audited.
- Part B, people: the platform administrator creates, changes, disables and deletes users and organizations; confirms a user without any email; sets passwords; requires, disables or resets two-factor; adds people to organizations and hands over invitation links directly. The functions are built in accounts slice 2; the screens follow when it lands.
- Mail is optional: with no mail server, sign-ups wait for an administrator to confirm them and no link is written to the log.

### WS5 to WS7
Briefs are written when their wave starts, from the state of `main` at that time.

## 3. Held for the owner

| Decision | Blocks |
|---|---|
| Tag Variant A or B; 80 × 60 × 42 or 90 × 68 × 42 mm; colours and outward face | WS8, the tag's proportions in the scenes |
| Prices for Maker and Studio; free plan, trial or both; card up front | prices on the page, WS6 products in Stripe |
| Review of the 491-row content sheet | WS9 |
| Voice-over: record, produce as Eigenia's were, or a named text-to-speech service | sound in the scenes |
| Mail service and sending domain | real confirmation and invitation emails |
| Stripe test keys, entered by the owner in the admin area | a real test-mode payment |
| Go-ahead for the sign-in cut-over | WS2 slice 3 |

## 4. Merge order and risk

Merges go one at a time: small fixes first, then scenes, then wiring faults one fault at a time, then accounts slice 1. Each merge is followed by a deploy and a check of the live site.

| Risk | Handling |
|---|---|
| Machine restarts and kills agents | Agents commit to their branch after every finished step; a restarted agent resumes from the branch |
| Two workstreams need the same file | Reserved folders and migration ranges; the project manager makes cross-cutting edits |
| Accounts work breaks the live sign-in | New sign-in stays behind a switch that is off until cut-over |
| A fix changes numbers the welcome page shows | Welcome page reads the same functions; its browser tests run in CI on every branch |

## 5. Reporting

The owner gets a report when each workstream lands on the live site, and a combined status when a wave finishes. Status of each item is kept in this file.

## 6. Status

| # | State |
|---|---|
| WS1 | done 22 Nov, live: third pass on five scenes; slow-device fallback fixed and tested |
| WS2 | slice 1 merged 22 Nov behind `AUTH2` (off in production): two database roles, Better Auth, mail interface, screens, tests; independent security review done and its 12 findings fixed. Slice 2 started. Turning it on needs only the owner's go-ahead once slice 2 lands (secret and addresses are kept in PostgreSQL; mail is optional) |
| WS3 | done 22 Nov, live: all eight wiring faults confirmed and fixed, each with a test (migration 0031) |
| WS4 | done 22 Nov, live: contrast fix, request form records the level (migration 0030), five owner files seeded, unused bag removed |
| WS5 | done 22 Nov, live at `/status` |
| WS6 | queued behind WS2 slice 2 and the owner's prices and Stripe keys |
| WS7 | built 22 Nov, in CI: one source for status colours and channel names, 14 of 40 hand-wired forms converted, held-back exports 54 to 18 |
| WS10 | part A started 22 Nov; part B functions added to accounts slice 2 |
| WS8, WS9 | held for owner |
