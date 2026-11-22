---
title: "How should Concept to Realization become a paid, multi-user service: platform route, pricing tiers and integrations?"
type: design
created: 2026-11-21
updated: 2026-11-21
tags: [saas, pricing, accounts, billing, integrations]
status: approved
author: mixed
---

# Paid service: platform route, pricing tiers and integrations

Approved by the owner on 21 November 2026. Nothing here is built yet.

## Decisions (owner, 21 Nov 2026)

| # | Decision |
|---|---|
| S1 | Route B: keep the application; add accounts, workspaces and billing with maintained libraries. No move onto a starter kit. |
| S2 | Sign-in must offer multi-factor with an authenticator-app code, invitations, and change and reset of password, as done for Eigenia. |
| S3 | Pricing approach accepted: subscription plus AI credits, with the four tiers below. Price points wait for the cost measurement. |
| S4 | First audience: makers, first-time founders and small product firms. The promise: use AI to get an idea to market fast, because an idea that is not pursued is never realised. |
| S5 | Payment through Stripe. Amazon stays a major integration for selling (and more to come), not for taking payment. |
| S6 | Pages keep the Eigenia colour scheme and component styles. Visuals are drawn (SVG, React Flow, real screens), never generated images. |

Still open: free plan, free trial or both, and whether a card is asked for up front. Until decided, the build assumes a free plan with no card.

## Question

Three decisions, in the order they depend on each other:

1. **Platform route.** Move the application onto a Next.js SaaS starter kit, or add accounts, workspaces and billing to the application as it stands?
2. **Pricing.** Which tiers, limited by what, and how is AI use paid for?
3. **Integrations.** Which outside services does a paid, hosted version need, and which are worth adding?

## Where things stand (measured in the repository, 21 Nov 2026)

| Fact | Value |
|---|---|
| Application code | about 83,000 lines of TypeScript, 122 API route files |
| Stack | Next.js 16, React 19, Tailwind 4, shadcn/ui, zod 4, TanStack Query |
| Database | 23 tables in PostgreSQL through `pg` with hand-written SQL; migrations by node-pg-migrate; no ORM |
| Tests | 2,371 Vitest tests against a real database, 49 browser tests |
| Sign-in | built in: scrypt passwords, sessions in PostgreSQL, one account, no sign-up, email, reset or roles |
| Ownership | no table has an owner. `projects` (a concept) has no user or workspace; 12 tables hang off `project_id` |
| Install-wide data | `credentials`, `settings`, `printers`, `audit_log`, `access_requests` belong to the install, not to a person |
| Payment | none |
| Licence and visibility | Apache-2.0, public repository: anyone may run it themselves at no charge |

## Platform route: three options

### A. Move onto a starter kit
Take a starter (the free official `nextjs/saas-starter`, or a paid multi-tenant kit such as MakerKit or supastarter) and port the application into it.

- **For:** accounts, teams, a pricing page, Stripe Checkout and a webhook exist on day one.
- **Against:**
  - The official starter uses Drizzle and its own JWT-cookie sign-in, and describes itself as intentionally minimal and a learning resource. The application uses hand-written SQL through `pg`. Porting means rewriting the data layer of 122 routes, or running two data layers side by side.
  - The paid kits are monorepos built round their own ORM or Supabase. The same rewrite, plus a restructure.
  - The 2,371 tests are written against the current data layer and route wrapper; most would need rework.
  - A starter contributes a few thousand lines. The application is 83,000. The small part would set the shape of the large part.
  - The hard part is not in any starter: giving every concept, file, credential, printer and audit line an owner, and checking it on every request.

### B. Keep the application; add the service layer with maintained libraries (recommended)
Keep the code, database layer and tests. Replace the hand-built sign-in with an auth library that stores its data in our own PostgreSQL, and add billing through the payment provider's hosted pages.

- **Sign-in and workspaces:** Better Auth, self-hosted, with its organization plugin (workspaces, invitations, roles) and its Stripe plugin (subscriptions tied to a user or an organization, seat counts). To confirm in a trial before committing: that it runs on our existing `pg` pool and migrations without an ORM, and its licence.
- **Payment:** Stripe Checkout for sign-up, Stripe Billing for subscriptions and metered use, the hosted customer portal for cards and cancellations, Stripe Tax.
- **Ownership:** add `workspace_id` to `projects` and to the five install-wide tables; resolve the workspace once in the route wrapper (every route already passes through it); add PostgreSQL row-level security as a second lock, so a missed check cannot leak another workspace's data.
- **For:** no rewrite; tests keep their value; the security-sensitive flows (reset, verification, sessions, webhooks) come from maintained code. The demo password goes away, which was the only reason a library was avoided before.
- **Against:** the pricing page, plan limits and billing screens are ours to build (on the existing UI kit). Row-level security needs care with the connection pool.

### C. Keep the application; extend the hand-built sign-in
- **For:** no new dependency.
- **Against:** hand-writing email verification, password reset, invitations and session rotation for a service that takes money. Not recommended.

### Recommendation
**B.** Use the starters as reference for the Stripe flow, not as a base. The trial that decides it: Better Auth with the organization and Stripe plugins on a copy of this database, one concept scoped to one workspace, one test-mode subscription, with the existing test suite still passing.

## Pricing

### What costs money to run
- **AI drafting, chat and embeddings:** every call to a hosted model. Not yet measured per concept.
- **Slicing:** OrcaSlicer compute per print job.
- **Storage:** files are kept in PostgreSQL.
- **Research:** Perplexity calls.

A hosted install cannot reach a customer's own Ollama or printers on their network, so hosted AI is either our key (our cost) or their key (their cost).

### Three approaches
1. **Flat tiers by number of concepts.** Simple to explain. A heavy AI user costs more than they pay.
2. **Subscription plus AI credits (recommended).** A monthly plan sets concepts, seats and storage and includes a monthly credit allowance; heavier drafting, research and slicing draw credits; top-ups are sold. This is where AI products have been settling. A "bring your own model key" switch on every plan removes our AI cost for people who want that.
3. **Free self-hosted, paid hosted only.** Already true because of the licence. It is a positioning line, not a price list; it combines with approach 2.

### Proposed shape (to test, not derived from data)
| Tier | For | Limits | AI |
|---|---|---|---|
| Free | trying it with one idea | 1 concept, 1 person, small storage; the Baggage Claims example to explore | own key, or a small one-off allowance |
| Maker | one person taking an idea to a prototype and a launch | several concepts, slicing, exports, channels | monthly credits, top-ups |
| Studio | a small team or a consultancy with several products | seats, shared workspace, roles, more concepts and storage | larger pooled credits |
| Self-hosted | people who run it themselves | none | their own models |

Price points are deliberately not set here. They need two inputs that do not exist yet: the measured cost of taking one concept through drafting (run Baggage Claims end to end on a real model and count), and what comparable tools charge (from `docs/research/landing/audit.csv`, where most pages did not show prices and need a second pass on their pricing pages).

### Decisions the owner must make
1. Who it is for first: makers, first-time founders, small product firms, or consultancies.
2. Free plan, free trial, or both; card asked up front or not. The evidence review found card-first trials get fewer sign-ups and more paying customers per visitor (self-reported survey).
3. Whether the public repository stays open under Apache-2.0 once the hosted service charges.
4. The product name on the invoice and the page.

## Integrations

### Built, tested against stand-ins only
Model hosts (OpenRouter, Ollama, LM Studio), Perplexity research, printers (OctoPrint, Moonraker and Klipper, PrusaLink, Duet, Bambu Lab; Creality and Elegoo experimental), OrcaSlicer, KiCad export, WireViz, Amazon Selling Partner orders, X and Instagram posting.

### Needed for a paid service
| Need | Candidate | Note |
|---|---|---|
| Payment, tax, billing portal | Stripe | hosted pages; no card data touches the app |
| Sign-in, workspaces, roles | Better Auth | subject to the trial above |
| Transactional email | a mail service such as Resend or Postmark | confirmation, reset, invitations, receipts |
| Sign in with Google | through the auth library | optional; cuts sign-up friction |
| Terms, privacy notice, refund policy | written documents | required by the payment provider |

### Worth adding, each to verify before promising
| Idea | Why | To verify |
|---|---|---|
| Import from Google Drive | the first concept arrived as a Drive folder; this is how ideas start | Drive API scopes and Google's verification process |
| Manufacturing quotes | closes the gap from prototype to batch | whether PCB and parts makers offer a public quoting interface |
| Storefront | selling beyond Amazon | Shopify's app requirements |
| Crowdfunding | the example launches on Kickstarter | whether any platform offers a creator interface; none is known |

Amazon as a way to pay (Amazon Pay) is possible but adds a second billing system for no clear gain; Stripe Checkout already offers cards and wallets.

## Risks
- **Data separation.** One missed check shows one customer another's concept. Row-level security and a test that walks every route as a second workspace are the guard.
- **Cost before revenue.** Hosted AI on our key with a free tier can be abused. Credits, rate limits and bring-your-own-key bound it.
- **Unencrypted credentials.** Acceptable for a private test; not for customers' keys. They need encryption at rest before launch.
- **Nothing has run against a real service.** Models, printers, Amazon, X and Instagram need one real run each before they are sold.
- **Open source and paid.** The licence lets anyone host a copy.

## Out of scope
Mobile apps, enterprise single sign-on, a marketplace for third-party add-ons, and reselling manufacturing.

## Next step
On sign-off: a plan with tasks, starting with the Better Auth trial and the cost measurement on Baggage Claims.

## Sources read on 21 Nov 2026
- Next.js SaaS Starter, Vercel template page and repository: https://vercel.com/templates/next.js/next-js-saas-starter and https://github.com/nextjs/saas-starter
- Better Auth Stripe plugin documentation: https://better-auth.com/docs/plugins/stripe
- MakerKit, Better Auth SaaS starter kit: https://makerkit.dev/better-auth-saas-starter-kit
- MakerKit's comparison of Next.js SaaS boilerplates (written by a vendor): https://makerkit.dev/blog/saas/best-nextjs-saas-boilerplate
- Metronome, trends from cataloguing 50 AI pricing models: https://metronome.com/blog/2026-trends-from-cataloging-50-ai-pricing-models
- Chargebee, pricing AI products: https://www.chargebee.com/blog/the-new-rules-of-pricing-ai-products/
- High Alpha, how SaaS companies are monetising AI: https://www.highalpha.com/blog/how-saas-companies-are-monetizing-ai-and-5-predictions-for-2026
- Evidence review in this repository: `docs/research/landing/evidence.md`

Read from search results and page extracts, not from full pages. Better Auth's fit with a plain `pg` pool and its licence were not confirmed and are the first thing the trial checks.
