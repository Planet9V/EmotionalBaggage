---
title: "Trial: Better Auth, workspaces, Stripe plugin and row-level security on this application"
type: findings
created: 2026-11-21
updated: 2026-11-21
status: for owner review
author: ai
design: docs/research/saas-pricing-and-platform-design.md
---

# Auth trial findings

**Verdict: adopt with changes.** Better Auth 1.7.27 (MIT) runs on this app's existing `pg` pool with no ORM, its tables fit in an ordinary node-pg-migrate SQL file, and every flow the owner required works against the trial database: sign-up with email confirmation, password reset and change, authenticator-app codes with recovery codes, workspaces created at sign-up, invitations and the three roles. All 586 existing auth and API tests still pass with the trial code in place. Three things must change from the plan as written: (1) row-level security does nothing while the app connects as the table owner or a superuser, which it does today, and the trial's workaround leaves any query that skips `q()`/`tx()` unconfined (shown below on a real route), so the real build must connect as a separate, non-owner database role; (2) the Stripe plugin covers subscriptions per workspace and nothing else: AI credits, top-ups and usage metering are ours to build; (3) several Better Auth defaults are weaker than what the app has now and must be set explicitly (listed under question 7).

Everything below was run on 21 November 2026 in `/home/claude/work/auth-trial`. Logs are in `docs/research/auth-trial-evidence/`.

## What was not done or did not work

- **Eigenia could not be read.** `git clone --depth 1 https://github.com/Planet9V/eigenia` failed with `fatal: could not read Username for 'https://github.com': terminal prompts disabled` (a private repository, and this machine has no credentials for it). Nothing in this document describes how Eigenia does sign-in. "As done for Eigenia" is therefore unchecked; see the open questions.
- **No real Stripe call was made**, as instructed. The plugin was run against a stand-in for Stripe's API on this machine (`tests/auth2/stripeStub.ts`). A test-mode subscription against Stripe itself is still to do.
- **No screens were built.** Sign-up, sign-in, the code prompt, invitation acceptance, workspace switcher and billing pages do not exist. The trial drives the same HTTP endpoints those screens would call.
- **The 49 browser tests were not run**, and `npm run build` was not run.
- **`X-Forwarded-For` behind a proxy was configured but not exercised**; only the app's own client-address header was tested.
- Things that went wrong on the way and are now handled: Better Auth silently skips its cross-site check when it detects a test run (question 7); the app's export route fails inside a workspace transaction (question 8); one new test failed once because it was picked up half-edited during a full run and passes on its own.

## 1. Licence, versions, requirements

| Package | Version installed | Licence | Evidence |
|---|---|---|---|
| better-auth | 1.7.27 | MIT, "Copyright (c) 2024 - present, Bereket Engida" | `node_modules/better-auth/LICENSE.md` |
| @better-auth/stripe | 1.7.27 | MIT, same holder | `node_modules/@better-auth/stripe/LICENSE.md` |
| stripe (Stripe's own Node library, required by the plugin) | 23.2.0 | MIT | `node_modules/stripe/LICENSE` |
| kysely (query builder Better Auth bundles) | 0.29.9 | MIT | `node_modules/kysely/LICENSE` |

- The three direct dependencies bring 23 packages in total; all 23 declare MIT in their `package.json` (walked from the three roots). The production tree grows from 690 to 711 packages (`tests/notices.test.ts` output).
- **Node:** `better-auth` and `@better-auth/stripe` declare no `engines`. Their dependency `kysely@0.29.9` declares `node >=22.0.0`; `stripe@23.2.0` declares `node >=20`. The app's Dockerfile uses `node:22-bookworm-slim` and this machine runs v22.23.5, so the requirement is met. Node 20 would not meet kysely's.
- **Next.js:** `better-auth` peer dependency `next: ^14.0.0 || ^15.0.0 || ^16.0.0`, `react: ^18.0.0 || ^19.0.0`, `pg: ^8.0.0` (all optional peers). The app has Next 16.4.6, React 19.3.0, pg 8.23. `@better-auth/stripe` peers: `stripe: ^18 … ^23`, `better-auth: ^1.7.27`.
- `npm audit` reports 14 findings after the install; none is in the 23 new packages (they are in `ftp-srv`, `ip`, `mermaid`, `node-pg-migrate` and others already present).
- Telemetry: the bundled `@better-auth/telemetry` is off unless `BETTER_AUTH_TELEMETRY` or `telemetry.enabled` is set (`node_modules/@better-auth/telemetry/dist/index.mjs` lines 353-354). The trial also sets `telemetry: { enabled: false }`.

## 2. Does it run on the existing `pg` pool with no ORM? How are tables created?

**Yes.** The whole database configuration is `database: db`, where `db` is the Pool from `src/lib/db.ts`. Working configuration: `src/lib/auth2/auth.ts`. The documentation says the same (fetched this run: https://better-auth.com/docs/adapters/postgresql). Internally Better Auth wraps the pool in its bundled Kysely; the app writes no Kysely code.

**Tables: SQL in a node-pg-migrate file, not the CLI.** Better Auth exports its migration planner: `getMigrations(options).compileMigrations()` from `better-auth/db/migration` returns the SQL as a string. `tests/auth2/schema.test.ts` ran it against an empty database and the output was pasted, unedited, into **`migrations/0030_better_auth.sql`**. The CLI (`npx auth generate`, `npx auth migrate`) was not used and the library creates nothing at run time.

- Tables created: `user`, `session`, `account`, `verification` (core); `twoFactor` (two-factor plugin, plus `user.twoFactorEnabled`); `organization`, `member`, `invitation` (organization plugin, plus `session.activeOrganizationId`); `subscription` (Stripe plugin, plus `user.stripeCustomerId` and `organization.stripeCustomerId`); `rateLimit` (because the throttle is set to store in the database). Nine indexes. The trial adds `auth_outbox` for captured emails.
- Names are Better Auth's defaults: singular, camelCase columns, quoted (`"user"`, `"emailVerified"`). They sit beside the app's snake_case tables and its older `users` and `sessions`. Table and column names can be remapped in the configuration; the trial did not try that.
- **Drift guard:** the first test in `tests/auth2/schema.test.ts` asks the planner what is missing from the migrated database and expects nothing. After a library upgrade or a new plugin it fails and names the table or column, and the difference becomes the next migration file.
- **Under the real server:** the handler was mounted for one run at `src/app/api/auth/[...all]/route.ts` with `toNextJsHandler`, `next dev -p 3322` was started, and sign-up, the 403 before confirmation, confirmation, sign-in, a workspace-confined `GET /api/projects` and a concept created into the new workspace all worked over HTTP (`docs/research/auth-trial-evidence/next-dev-smoke.log`). The route file was then removed, because `tests/auth/routes.test.ts` treats any new route that answers without a session as a decision to be made.
- Needed in the environment: `BETTER_AUTH_SECRET` (at least 32 random characters; Better Auth refuses to start in production with its default) and `BETTER_AUTH_URL` (https://better-auth.com/docs/installation).

## 3. Sign-up with required email confirmation, reset and change of password

Working. `tests/auth2/accounts.test.ts`, 11 tests, all pass against `c2r_auth_test`. Emails are captured by `src/lib/auth2/mail.ts`, which writes each one to the `auth_outbox` table instead of sending it.

Proved:
- Sign-up creates the account unconfirmed, starts no session and captures one confirmation email.
- Sign-in is refused with 403 `EMAIL_NOT_VERIFIED` until the link is followed; a wrong token is refused.
- A second sign-up for the same address answers 200 without creating a second account, so the form does not reveal which addresses are registered.
- The password is stored as a salted scrypt hash. Passwords under 8 characters are refused (`demo` would be).
- Change password needs the current one and can end the other sessions.
- Reset: the link is emailed, works once, ends every session; asking for an address nobody has gives the same answer and sends nothing.
- A state-changing request from another site is refused (403), once the check is switched on explicitly (question 7).
- Repeated sign-in tries from one address get 429 after three in ten seconds, counted in the `rateLimit` table; another address is unaffected.
- The app's own password hashing (`hashPassword`/`verifyPassword` in `src/lib/auth.ts`, scrypt N=2^17) can be plugged in in place of Better Auth's default (N=2^14, r=16), and sign-in works with it.

## 4. Two-factor: authenticator-app code and recovery codes

Working. `tests/auth2/twofactor.test.ts`, 10 tests, all pass. The codes in the tests are computed in `tests/auth2/helpers.ts` straight from RFC 6238 (HMAC-SHA1, 6 digits, 30 seconds), not with Better Auth's own code, so a pass means a real authenticator app would produce the same digits.

Proved, in order:
1. Enrolment (`POST /two-factor/enable`) needs the password and answers an `otpauth://totp/...` address (issuer "Concept to Realization", the user's email, a base32 secret) and ten recovery codes.
2. The address renders as a QR code with the `qrcode` package the app already has.
3. Two-factor is not switched on until a first correct code is entered; a wrong code leaves it off.
4. The secret and the recovery codes are stored encrypted, not as shown to the user.
5. Sign-in with the password alone answers `twoFactorRedirect: true` and starts **no** session; a wrong code is refused; the right code completes sign-in.
6. A code from another time window is refused. The second step cannot be done without the first.
7. A recovery code completes sign-in once and is then spent; the others keep working; generating new codes replaces the old ones.
8. Turning it off needs the password; sign-in is then one step again.

Observed and worth knowing:
- **The same code is accepted twice within its 30 seconds** (`tests/auth2/workspaces.test.ts`, last test). There is no replay guard. Someone who sees a code and already has the password can use it in that window.
- Wrong codes are limited to 3 per 10 seconds, and the plugin locks the second step after 10 consecutive failures per account (default, `two-factor/types.d.mts`).
- A "trust this device for 30 days" option exists and was not tested.
- Whether this matches Eigenia is unknown (it could not be read).

## 5. Organization plugin as workspaces

Working. `tests/auth2/workspaces.test.ts`, 14 tests, all pass.

- **Created on sign-up:** not built in. The trial adds a `databaseHooks.user.create.after` hook that calls `auth.api.createOrganization` for the new user (`src/lib/auth2/auth.ts`). Result: one workspace, the user is its owner.
- **Active workspace on the session:** `session.activeOrganizationId`. A `session.create.before` hook sets it to the workspace the user joined first, so every session starts in one. `POST /organization/set-active` switches it, and only to a workspace the user belongs to.
- **Invite by email:** `POST /organization/invite-member` records the invitation and calls `sendInvitationEmail`; the trial captures the email with a link `/accept-invitation/<id>`.
- **Accept:** only when signed in with the invited address and, as configured here, only once that address is confirmed. A different signed-in user gets 403; signed out gets 401; an invitation works once. Accepting switches that session to the joined workspace.
- **Roles:** owner, admin, member are the plugin's defaults. Proved: a member cannot invite, change roles or remove people; the owner can promote; an admin can invite but cannot remove the owner or delete the workspace; an outsider cannot read the member list.

Observed and worth knowing:
- An invited person who signs up also gets a workspace of their own (the sign-up hook runs for everyone). Whether that is wanted is an open question.
- A refused `set-active` clears the session's active workspace instead of leaving the old one. The route wrapper then answers 403 until the user picks a workspace. It fails closed, but the screen must handle it.
- Removing a member does not touch their open sessions, which still name the workspace. The trial's resolver (`src/lib/auth2/session.ts`) therefore reads the membership on every request and does not trust the session; a test proves a removed member loses access on the next request.
- The roles cover workspace administration only. Nothing in the app's 122 routes checks a role yet: a test shows a plain member calling `GET /api/admin/settings` and getting 200.

## 6. Stripe plugin

Answered from the plugin's code (`node_modules/@better-auth/stripe/dist/index.mjs`), its documentation (https://better-auth.com/docs/plugins/stripe, fetched this run) and `tests/auth2/stripe.test.ts` (10 tests, all pass, against the local stand-in; no key, no request to Stripe).

**What it needs**
- A Stripe client (`stripeClient`, so a secret key) and the webhook signing secret (`stripeWebhookSecret`).
- A webhook in Stripe pointing at `/api/auth/stripe/webhook` with at least `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- A plan list in code: `{ name, priceId or lookupKey, annualDiscountPriceId?, seatPriceId?, limits?, freeTrial?, lineItems? }`. Price ids come from the Stripe dashboard. The trial's list, with placeholder ids, is `src/lib/auth2/plans.ts`.

**Tables it adds:** `subscription` (plan, referenceId, stripeCustomerId, stripeSubscriptionId, status, periodStart, periodEnd, trialStart, trialEnd, cancelAtPeriodEnd, cancelAt, canceledAt, endedAt, seats, billingInterval, stripeScheduleId), and a `stripeCustomerId` column on `user` and on `organization`.

**How a subscription attaches to a workspace** (each step proved in the test):
1. With `organization: { enabled: true }`, the owner calls `POST /subscription/upgrade` with `referenceId` = the workspace id and `customerType: "organization"`.
2. `authorizeReference` (ours) decides who may: the trial allows owner and admin; a plain member gets 401.
3. The plugin creates a Stripe customer for the workspace (name, `metadata[organizationId]`), stores its id on `organization.stripeCustomerId`, creates a Checkout session in `subscription` mode with `client_reference_id` = the workspace id, and returns the hosted page's address. The user's own `stripeCustomerId` stays empty.
4. A `subscription` row exists with status `incomplete`. Nothing is unlocked.
5. Stripe's signed `checkout.session.completed` event makes the row `active` with its plan, period and Stripe id. An event with a wrong signature, or none, is refused (400).
6. `customer.subscription.deleted` sets it to `canceled`.
7. `POST /subscription/billing-portal` returns the hosted portal's address for the workspace's customer.

Stripe API calls the plugin made in the test: `GET /v1/customers/search`, `POST /v1/customers`, `GET /v1/prices/{id}`, `GET /v1/subscriptions`, `POST /v1/checkout/sessions`, `GET /v1/subscriptions/{id}`, `POST /v1/billing_portal/sessions`.

**How plan limits are read:** the plugin stores no limits. `limits` is a free-form object on the plan in code; `GET /subscription/list` returns each active subscription with its plan's `limits` attached. The app does not need that endpoint: `src/lib/auth2/limits.ts` reads the active `subscription` row for the workspace with one SQL query and looks the plan up in `plans.ts`; no subscription means the free plan. Enforcing a limit (refusing the eleventh concept, the sixth seat) is the app's code in the route; the plugin enforces nothing.

**What it cannot do that the design needs**

| Need in the design | Plugin | Consequence |
|---|---|---|
| Metered AI credits | Recognises a metered price and leaves its quantity off the Checkout line (`isMeteredPrice`, `lineItems`). It never reports usage to Stripe and keeps no balance. | A credits ledger (allowance, draws, balance per workspace) and, if billed by Stripe, the usage reports are ours. |
| Top-ups (one-off purchase) | Checkout is fixed to `mode: "subscription"`; the webhook ignores sessions in any other mode (`onCheckoutSessionCompleted`). | A separate Checkout session in `payment` mode and its webhook handling, written by us with the Stripe library. Other events reach an `onEvent` hook we can use. |
| Tax | Not handled, but `getCheckoutSessionParams` passes parameters through, so `automatic_tax: { enabled: true }` and `tax_id_collection` can be set. Needs tax registration in Stripe first. | Configuration, not code. Untested here. |
| Free plan with no card | No subscription row is needed for free; `limitsFor` treats "none" as free. | Works as assumed. |
| Seats | `seatPriceId` on a plan bills by member count and the plugin updates the quantity when members change. | Available; untested here. |
| Webhook delivered twice | No record of processed event ids was found in the plugin. Its handlers set state from Stripe's data, so a repeat is harmless for subscriptions. | Our own top-up and credit handlers must de-duplicate by event id themselves. |

Also: with the organization option on, the plugin blocks deleting a workspace that has an active subscription and syncs a renamed workspace to Stripe; both call Stripe.

## 7. Fit with this app

**Route wrapper.** `src/lib/api/route.ts` now does this when a request carries a Better Auth cookie (the old path is untouched otherwise):

1. `workspaceSessionFromRequest(req)` (`src/lib/auth2/session.ts`) calls `auth.api.getSession({ headers })`, which checks the cookie's signature, the session row and its expiry.
2. It reads the user's membership of `session.activeOrganizationId` with one query and answers `{ userId, email, workspaceId, role }`, or "signed-out" (401) or "no-workspace" (403).
3. The handler runs inside `asActor(email)` and `asWorkspace(workspaceId)`; `q()` and `tx()` pick the workspace up without any handler passing it (question 8).

In the real build this replaces `sessionFromRequest` outright. `sessionOf(req)` has 7 callers; the `Session` type's numeric `userId` and `sessionId` become text ids.

**Existing `users`, `sessions`, `sign_in_attempts` and the one user.**
- No name clash: Better Auth's tables are `user` and `session` (singular).
- `users` and `sessions`: dropped in a later migration once nothing reads them (`src/lib/auth.ts`, five routes under `src/app/api/auth/`, `ensureDefaultUser` in `db.ts`).
- The `demo` user is not carried over. It has no email address and a published password that Better Auth's 8-character minimum would refuse anyway. A hosted install starts with no accounts. What a self-hosted install does on first run is an open question.
- `sign_in_attempts` is also used by the public access-request form (`throttleOpenForm`, `src/app/api/access-requests/route.ts`). Keep it for that, or move that form onto another throttle, before dropping it.
- The old `POST /api/auth/sign-out` has the same address as Better Auth's sign-out and would shadow it; the five old routes go when the catch-all is mounted.

**Existing protections**

| Protection today | After | Evidence and note |
|---|---|---|
| Every route answers 401 without a session | **Kept.** The wrapper still decides. | `tests/auth/routes.test.ts` passes unchanged (all 122 routes). A forged Better Auth cookie and a real token with a wrong signature get 401 (`tests/auth2/isolation.test.ts`). The new catch-all route must be added to that test's list of open routes on purpose. |
| Cross-site request refusal (Origin must match Host) on app routes | **Kept**, same code. | A cross-site POST with a valid Better Auth cookie gets 403. |
| The same for the sign-in endpoints | **Replaced**, with a catch. Better Auth compares Origin with `BETTER_AUTH_URL` and `trustedOrigins`. **It skips the check when it detects a test run** (`create-context.mjs` line 211), which made the first version of the test pass a cross-site sign-out. The trial sets `advanced.disableOriginCheck: false` and `disableCSRFCheck: false` explicitly. | A self-hosted install reached under another host name must list it in `trustedOrigins`; the old check compared with whatever Host arrived. |
| Sign-in throttling: per name and address, 1 s doubling to 15 min, no lockout, in the database | **Replaced by something simpler.** Better Auth: per address and path, 3 tries per 10 seconds on sign-in, 100 per 10 seconds elsewhere. Off outside production and held in memory by default; the trial turns it on and stores it in the `rateLimit` table. | Proved: 4th try gets 429, another address is not held up. The growing delay and the per-name count are **lost** unless written as custom rules (`rateLimit.customRules` accepts a function). An unknown address still costs a full password hash (`sign-in.mjs` lines 323, 330), so answer time does not reveal which addresses exist. |
| TRUST_PROXY | **Kept by configuration.** `advanced.ipAddress.ipAddressHeaders` is set to `x-forwarded-for` when TRUST_PROXY is on, else to the app's `x-c2r-client-address`. | Tested with the app's header only. Better Auth skips an `X-Forwarded-For` with several addresses unless `trustedProxies` is listed, where the old code took the right-most entry; this needs a test behind a real proxy. |
| Only a hash of the session token in the database | **Lost.** `session.token` holds the token itself (checked: the token from the cookie finds its row). The cookie is the token plus an HMAC made with `BETTER_AUTH_SECRET`, so a copy of the database alone is not enough to sign in; the database plus the secret is. | No option to hash session tokens was found in 1.7.27's session options. Reset tokens can be hashed at rest (`verification.storeIdentifier: "hashed"`); not set in the trial, should be. |
| Session 30 days sliding, 90 days absolute | **Changed.** Default 7 days, extended daily when used; both configurable. No absolute limit option was found. | An absolute limit would need a small hook. |
| Password hashing scrypt N=2^17, r=8 (128 MiB) | **Weaker by default** (N=2^14, r=16: 32 MiB), **kept if configured**: passing the app's own functions works (test in `accounts.test.ts`). | Recommended. |
| Audit log lines for sign-in, refusal, password change, sign-out everywhere | **Lost unless added.** Better Auth writes nothing to `audit_log`. | Add with its `hooks.after` or `databaseHooks`. Not done in the trial. |
| Body size limit, NUL refusal, plain error sentences | **Kept** for app routes (wrapper). Better Auth's own endpoints answer in its format (`{ code, message }`). | The screens must map its codes to this app's wording. |
| Proxy redirect of signed-out pages (`src/proxy.ts`) | **Small change**: test for the cookie with `getSessionCookie(request)` from `better-auth/cookies`. | Used by the wrapper in the trial; the proxy itself was not changed. |

**How the 2,371 tests sign in, and what changes.** Today `tests/auth/session.setup.ts` creates a session row for `demo` before each test file and `tests/api/helpers.ts` puts its cookie on every request. Because that is one place, the swap is one place:

- `tests/auth2/session.setup.ts` signs a Better Auth user in as owner of the default workspace and hands the cookie to the same helper (one new function in `helpers.ts`). `vitest.auth2.config.mts` runs the suite with it.
- Run: `DATABASE_URL=…c2r_auth_test npx vitest run -c vitest.auth2.config.mts tests/api` → **347 of 361 pass with no test edited**, every route running confined to a workspace under row-level security. Log: `tests-api-signed-in-through-better-auth.log`.
- The 14 that fail, by cause:
  - 5 expect the name `demo` or the default-password rule (`process.test.ts` ×3, `audit.test.ts` ×1, `access-requests.test.ts` ×1): edit the tests.
  - 4 get 500 from `permission denied for table users`: `defaultPasswordInUse()` reads the old table, which the trial closes to workspace queries (`admin.test.ts` ×4). Goes away with the old sign-in.
  - 4 get 500 from `SET TRANSACTION ISOLATION LEVEL must be called before any query`: the export route sets its isolation level as the first statement of `tx()`, which now runs two statements first (`concepts.test.ts` ×3, `duplicate.test.ts` ×1). `tx()` needs an isolation option. A real bug the trial found.
  - 1 moves to a scratch database where the session does not exist (`concepts.test.ts`): the test must sign in there.
- Not measured: the other test folders under this setup, and the browser tests. `tests/auth/` (225 tests on the old sign-in: hashing, throttle, sessions, proxy) is rewritten or retired; `routes.test.ts` stays and gains the open-route entry.

## 8. Scoping: `workspace_id` and row-level security

**The migration:** `migrations/0031_workspace_scope.sql`.
- Creates the default workspace `ws_default` and puts every existing concept in it (backfill, then `NOT NULL`).
- `projects.workspace_id` defaults to the transaction's `app.workspace_id` setting, so **the app's existing INSERT statements are unchanged** and a concept created in a workspace's request lands in that workspace (proved through the real `POST /api/projects`).
- Turns row-level security on for `projects` (`workspace_id = app_workspace_id()`) and `items` (`project_id IN (SELECT id FROM projects)`, which the projects policy filters). The plan shows the sub-select evaluated once per query as a hashed sub-plan, not per row.
- Creates a role `c2r_app` that the policies apply to, and withholds from it the tables holding password hashes, session tokens, reset tokens and second-factor secrets.

**Why the role.** PostgreSQL never applies row-level security to a superuser, and not to a table's owner unless forced. This app connects as `c2r`, which owns every table and is a superuser both here (`\du`) and in `docker-compose.yml` (`POSTGRES_USER: c2r`). Policies alone would have changed nothing. In the trial each workspace transaction runs `set_config('app.workspace_id', $1, true)` and `SET LOCAL ROLE c2r_app` straight after `BEGIN` (`src/lib/auth2/scope.ts`).

**Proof:** `tests/auth2/isolation.test.ts`, 22 tests, all pass.
- Through real routes with two Better Auth sessions: A creates a concept and a row; A's list shows only A's concept; **B's list is empty, and B gets 404 for A's concept on GET, on its rows, on PATCH, on adding a row and on DELETE**; A's data is unchanged afterwards. B cannot reach the seeded example in the default workspace either.
- In plain SQL as the role: B's SELECT finds none of A's concept or rows, by concept id, by row id, or unfiltered; B's UPDATE and DELETE (committed) touch 0 rows; B's INSERT of a row under A's concept, of a concept labelled as A's, and B's attempts to move its own concept or row into A's are refused with "violates row-level security policy".
- With the role but no workspace named, nothing is visible and nothing can be written.
- The role cannot read `account`, `session`, `verification`, `twoFactor`, `auth_outbox`, `users`, `sessions`, and cannot switch a policy off.
- Pool: after a commit and after a failed transaction every pooled connection is back to no workspace and role `c2r`; 120 interleaved queries for two workspaces on the shared pool each see only their own rows.

**The catch with a shared connection pool.** A pooled connection is used by many requests in turn, so the workspace must never be set on the connection itself:
- A session-level `SET` would stay on the connection and be inherited by the next request that draws it, which may belong to another workspace. Only `SET LOCAL` / `set_config(..., true)` inside a transaction is safe, because COMMIT and ROLLBACK undo it.
- Therefore **every query must run inside a transaction that set the workspace first.** `pool().query(...)` on its own has no transaction and so no workspace.
- A transaction-mode pooler (PgBouncer) works with this; a session-level setting would not.

**How `q()` and `tx()` change** (done in the trial, `src/lib/db.ts`, about ten lines):
- `tx()`: after `BEGIN`, if the request has a workspace, confine the transaction to it.
- `q()`: if the request has a workspace, run the statement inside `tx()`; otherwise as before. Cost: each `q()` becomes four round trips (BEGIN, two settings, the statement, COMMIT; the two settings can be merged into the BEGIN round trip).
- The workspace travels in Node's AsyncLocalStorage, the same way the audit actor already does, so none of the 180 `q()` call sites or 91 `tx()` call sites changes.
- Still needed: an isolation-level option on `tx()` (the export route), and the same confinement for code that takes the pool directly.

**What the trial's arrangement does not stop, shown by tests that pass today and must fail when the work is done:**
- **A route that reads through the pool directly is not confined.** `GET /api/projects/[id]/process` passes `pool()` to its reader, and B receives A's concept name and stage (status 200). Four files use the pool directly: that route, `src/app/api/integrations/route.ts`, `src/lib/trace/historyRead.ts`, `src/lib/admin/connection.ts`.
- The cause is that the trial fails **open**: outside `q()`/`tx()` the connection is the owner's and sees everything. The fix is to make the app's pool sign in as a non-owner role, so that a query with no workspace sees nothing, and keep a second, owner connection for migrations, start-up seeding and Better Auth. That is the main change to the plan.
- Only 2 tables have a policy. `events` still shows A's history to B in SQL.
- The install-wide audit log shows B the name of A's concept through `GET /api/admin/audit`.
- Row-level security is a lock against a missed check, not against SQL injection: injected SQL could run `RESET ROLE`. With a non-owner sign-in role that door closes too.

Tables still to cover with the same policy shape (each has `project_id`): `files`, `events`, `messages`, `research`, `gates`, `drafts`, `pins`, `chats`, `campaign_results`, `tracked_links`, `source_chunks`, `embeddings` (12, with `items` 13); and through a parent, `chat_messages` (via `chats`) and `link_clicks` (via `tracked_links`).

**Concept ids are global.** A concept's id is a slug of its name and the primary key (`insertConcept`, `src/lib/api/concepts.ts`). Two workspaces naming a concept the same get `name` and `name-2`, which tells the second that the name exists elsewhere, and ids appear in addresses. Not fixed in the trial.

**Install-wide tables**

| Table | Today | Scoping it needs |
|---|---|---|
| `credentials` (provider, field, value; keys stored as entered) | one set for the install | `workspace_id` in the primary key `(workspace_id, provider, field)` and a policy: each workspace's own model, research, Amazon, X and Instagram keys. Possibly a second, platform-owned set (our hosted model key) that no workspace can read. Encryption at rest before any customer key is stored (already a risk in the design). |
| `settings` (key, value) | one set; also holds install markers such as `seed.example` | Split in two: per-workspace settings (default concept, chosen models, planner address) keyed `(workspace_id, key)` with a policy; and true install settings (seed markers, feature switches) that stay global and are closed to the request role. |
| `printers` (name unique across the install, address, access keys) | one list | `workspace_id` and a policy; name unique per workspace. A hosted install cannot reach a printer on a customer's network (noted in the design), so this may be self-hosted only. |
| `audit_log` (append-only, concept id and name kept as text) | one log | `workspace_id` on every line, a policy for reading, and the admin audit routes filtered by it. Lines with no workspace (sign-in, platform actions) visible to platform staff only. It stays append-only; the request role needs INSERT and SELECT only. |
| `access_requests` (the public "request access" form on /welcome) | one list | Not workspace data: it belongs to whoever runs the install. No `workspace_id`; closed to workspace roles and readable by a platform administrator only. Sign-up may replace the form altogether. |

## 9. Test counts

Command, as given: `DATABASE_URL=postgresql://c2r:c2r@localhost:5432/c2r_auth_test npx vitest run tests/auth tests/api`

| Run | Files | Tests | Result |
|---|---|---|---|
| Before any change (`tests-before.log`) | 21 | 586 | 586 passed |
| After, on a freshly created test database (`tests-after.log`) | 27 | 655 | 654 passed, 1 skipped, 0 failed |

- After, by folder: `tests/auth` 225 passed, `tests/api` 361 passed (the same 586), `tests/auth2` 68 passed and 1 skipped. The filter `tests/auth` also matches `tests/auth2`, which is why the trial's 6 files are in the count.
- The skipped test is the one that writes Better Auth's SQL to a file; it runs only when given an empty database.
- **Rerun effect, not caused by the trial:** running the command a second time on the same database fails 1 test, `tests/api/concepts.test.ts` "clears Admin's default concept…". It counts audit lines for a concept id that is the same in every run, and the audit log cannot be cleaned (append-only), so the second run finds 2. The two lines carry the timestamps of the two runs. The test database was recreated before the final run.

Also run, though not asked for: the whole suite after the changes on a fresh database (`tests-full-after.log`): 185 files, 2,443 tests, 2,434 passed, 5 skipped, 4 failed. There is no "before" figure for the whole suite. The four:
1. `tests/db/migrations.test.ts` "records each migration once": it lists migration names literally and now sees `0030_better_auth` and `0031_workspace_scope`. Expected; add the two names.
2. `tests/notices.test.ts` "are current": 690 → 711 packages. Expected; `npm run notices`.
3. `tests/notices.test.ts` "name every production dependency": `better-auth`, `@better-auth/stripe`, `stripe` are not yet on the code-use page. Expected.
4. `tests/auth2/accounts.test.ts` "can keep this app's own password hashing": the test was added while the run was in progress and met a stale copy of the configuration. It passes when run afterwards (it is in the 68).

## Files added or changed

Added:
- `migrations/0030_better_auth.sql`: Better Auth's tables (its own SQL) and `auth_outbox`
- `migrations/0031_workspace_scope.sql`: `workspace_id`, backfill, role, policies
- `src/lib/auth2/auth.ts`: the Better Auth configuration
- `src/lib/auth2/mail.ts`: stand-in mail sender
- `src/lib/auth2/session.ts`: user, workspace and role from a request
- `src/lib/auth2/scope.ts`: workspace in AsyncLocalStorage; confining a transaction
- `src/lib/auth2/plans.ts`, `src/lib/auth2/limits.ts`: plan list and limit reader
- `tests/auth2/helpers.ts`, `stripeStub.ts`, `session.setup.ts`
- `tests/auth2/accounts.test.ts`, `twofactor.test.ts`, `workspaces.test.ts`, `isolation.test.ts`, `stripe.test.ts`, `schema.test.ts`
- `vitest.auth2.config.mts`
- `docs/research/auth-trial-findings.md`, `docs/research/auth-trial-evidence/` (six logs)

Changed:
- `src/lib/db.ts`: `q()` and `tx()` honour the request's workspace (marked TRIAL)
- `src/lib/api/route.ts`: accepts a Better Auth session beside the old one; `workspaceSessionOf()` (marked TRIAL)
- `tests/api/helpers.ts`: `setTestCookie()`
- `package.json`, `package-lock.json`: `better-auth`, `@better-auth/stripe`, `stripe`
- `next-env.d.ts`, `tsconfig.tsbuildinfo`: rewritten by the tools, not by hand

Outside the copy: databases `c2r_auth` (holds one smoke-test account and concept) and `c2r_auth_test`; the role `c2r_app` on the local PostgreSQL server. `/home/claude/repos/EmotionalBaggage` and `/home/claude/work/landing` were not touched.

## Task list for the real implementation

In order. Sizes are rough: small is up to a day, medium a few days, large a week or more.

| # | Task | Size | Risks |
|---|---|---|---|
| 1 | Decide the open questions below that block design: Eigenia parity, self-hosted first run, concept ids, who owns AI keys. | small | Building before these are answered means rework in tasks 3, 6 and 9. |
| 2 | Two database roles: an owner for migrations, seeding and Better Auth; a non-owner sign-in role for the app's pool. Docker, environment, docs, the test setup. | medium | Existing installs connect as one superuser; the upgrade path must create the role and password. Start-up code that alters tables (`embeddings`) must use the owner connection. |
| 3 | Better Auth for real: migration 0030, production configuration (explicit origin check, database throttle with custom sign-in rules, own password hashing, hashed reset tokens, session lifetimes, secure cookies, trusted origins), catch-all route, proxy cookie test. | medium | Defaults that differ between test and production (found one). Secret handling and rotation. |
| 4 | Mail: a real sender behind `mail.ts`, templates for confirmation, reset and invitation, bounce handling. | small | Deliverability; choosing the service. |
| 5 | Screens: sign-up, confirm, sign-in, code prompt, enrol with QR and recovery codes, reset, change password, sessions, invitation acceptance, workspace switcher and members. Map Better Auth's error codes to plain sentences. | large | The largest piece of visible work. Accessibility and the browser tests. The cleared-active-workspace case. |
| 6 | Route wrapper cut-over: Better Auth only; remove `src/lib/auth.ts`, the five old routes, `ensureDefaultUser`, the default-password rule; ids become text; audit lines for sign-in events; keep or replace the access-request throttle. | medium | 7 `sessionOf` callers, 13 files that know about the default password. Self-hosted first run must exist before `demo` goes. |
| 7 | `q()`/`tx()` for real: confinement in one round trip, isolation option, remove direct pool use from the four files, a lint rule or test that forbids `pool()` outside `db.ts`. | medium | Extra round trips on every read; measure. Long-running handlers (streaming chat, slicing) holding transactions. |
| 8 | Policies on the remaining 12 concept tables and the 2 grandchildren; decide sub-select or a copied `workspace_id` column per table after measuring on realistic sizes. | medium | Performance on large tables (`embeddings`, `files`). Cascades and triggers running as the request role. |
| 9 | Install-wide tables: `credentials`, `settings`, `printers`, `audit_log`, `access_requests` as in the table above, with encryption of credentials at rest. | large | Changing primary keys on live tables; the settings split; every admin route and screen changes meaning. |
| 10 | Role checks in routes: which of the 122 routes need owner or admin; one helper in the wrapper; tests. | medium | Deciding the matrix. Today a member can call admin routes. |
| 11 | A test that walks every route as a second workspace and expects 404 or empty, alongside the existing "every route answers 401" test. | medium | Needs seeded data per route to be meaningful; finds real leaks, so expect follow-up work. |
| 12 | Tests: switch `session.setup.ts`; fix the 14 known failures; rewrite or retire `tests/auth/`; update `migrations.test.ts`, notices; browser-test sign-in. | medium | Other folders were not measured under the new sign-in. |
| 13 | Stripe subscriptions: products and prices in Stripe, plugin configuration, webhook endpoint, billing page, portal link, plan limits enforced in routes, one real test-mode run. | medium | Webhook reachability in development; plan changes and proration; tax registration. |
| 14 | AI credits: ledger table per workspace, monthly allowance on renewal, draw on each model, research and slicing call, top-up purchase (`payment` mode Checkout, own webhook handler with event de-duplication), bring-your-own-key switch. | large | Entirely ours; the plugin gives nothing here. Needs the cost measurement the design is waiting for. Abuse on the free plan. |
| 15 | Concept ids unique per workspace, or random suffixes for new ones. | medium, or small for suffixes | Ids are in addresses, exports and 13 foreign keys. |
| 16 | Workspace lifecycle: delete, leave, transfer ownership, what happens to concepts (the trial uses RESTRICT), data export. | medium | Stripe blocks deletion with an active subscription; account deletion duties. |

## Open questions for the owner

1. **Eigenia.** The repository could not be read from here. What exactly should match: only the authenticator code with recovery codes, or also things such as trusted devices, enforced two-factor for some roles, password rules, session length, the wording of emails? Which library does it use? Access to the repository, or a short description, settles it.
2. **Self-hosted installs.** With `demo`/`demo` gone, how does a self-hosted install get its first account: a first-run "create the owner" page, a command, or an environment variable? Must a self-hosted install send email at all, or may confirmation be switched off there?
3. **Does an invited person also get a workspace of their own?** The trial gives everyone one at sign-up.
4. **Should two-factor be optional for everyone, or required for owners and admins?** Better Auth does not enforce it by role; that would be ours.
5. **Authenticator code replay.** The same code is accepted twice inside 30 seconds. Accept, or add a guard (remember the last used time step per user)?
6. **Session tokens are stored unhashed** (the cookie is additionally signed). Accept, or ask upstream for hashing, or wrap it ourselves?
7. **Who holds AI and channel keys on the hosted service:** each workspace its own, a platform key, or both? This decides the shape of `credentials`.
8. **Printers on the hosted service:** offered at all, given a hosted install cannot reach a customer's network?
9. **Concept ids:** keep global slugs (a name used elsewhere becomes `name-2`), or make them per workspace?
10. **Deleting a workspace:** delete its concepts, or refuse until they are moved or deleted?
11. **Sign-in throttling:** is 3 tries per 10 seconds per address enough, or should the current growing delay per name and address be rebuilt as custom rules?
12. **The access-request form on /welcome:** keep it once sign-up exists?
13. **Mail service** (Resend, Postmark or other) and the sending domain.
14. Still open from the design: free plan, trial or both; card up front; price points (waiting on the cost measurement).
