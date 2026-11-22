# Admin guide

For the person who installs and looks after the workbench.

> **A public test.** One account with a published default password, and keys stored in the database unencrypted. Change the password after the first sign-in, and read "What sign-in does not protect" below before using it beyond your own machine.

## Admin

Open **Admin** from the sidebar. Only the application's administrator can open it (`src/lib/admin/guard.ts`; with the current sign-in, every signed-in account is the administrator). Everything set there is saved in this install's PostgreSQL database and used at once; no restart and no deploy is needed. The sections are listed down the left (a grid above the content on a phone); a link can open one directly with `/admin?tab=<section>`: `setup` (Overview), `payments`, `pricing`, `email`, `channels`, `models`, `voice`, `printers`, `services`, `credentials` (All keys), `audit` and `access`.

**Nothing in Admin is required.** The app starts and every page works with nothing set up. Each service that is missing says so in plain words where it is used, and the Overview says what is switched off without it.

Run with Docker Compose, the only setting outside Admin is the database connection, and `docker-compose.yml` supplies it. Every key and address is entered in Admin. The environment variables the app has always read still work as optional fallbacks, used only when Admin has nothing saved for the same purpose; Admin, Other services lists every one with whether it is set.

**Overview** shows every outside service on one line: *Configured*, *Not configured* or *Configured, but failing* (its last Test connection failed), where its values come from (saved in Admin, the environment, or built in), when it was last tested, and what is switched off without it. Changing a service's settings or keys clears its last test, so a fixed setting no longer shows as failing. Below it, **First run** is the short checklist of what is not set up yet, with your own password.

**Payments** holds the Stripe keys: publishable key, secret key and webhook signing secret. Keys must have Stripe's shape (`pk_test_`, `sk_live_`, `rk_test_`, `whsec_` and so on) or they are refused before saving. The mode (test or live) is read from the key prefix, and a test publishable key with a live secret key (or the other way round) counts as not configured. Test connection makes one harmless read (`GET /v1/balance`). The webhook address to paste into Stripe is shown with a Copy button. Nothing is charged from here: the billing code reads these settings through `getStripeSettings()` (`src/lib/admin/stripe.ts`).

**Pricing and tiers** is the plan catalogue: for each tier its name, key, monthly and yearly price and currency, whether it is shown on the public page and whether it is paid, the included limits (concepts, members, AI credits a month, storage in MB, print jobs a month; blank means not set), the Stripe price ids, and the words on its card. One switch shows prices on the public page. Save checks the whole catalogue (no negative price, unique keys, at least one tier shown) and the public welcome page shows it on the next visit. Until something is saved, the built-in catalogue applies: the four levels in `src/components/welcome/content.ts`, prices hidden. Reset to built-in removes the saved one. Every save is recorded in the audit log with the catalogue before and after. Nothing enforces the limits yet.

**Email** is "No mail" (the default: nothing is sent, and no confirmation or reset link is written to any log) or an SMTP server: sender name and address, server, port, security (STARTTLS, TLS or none) and user name; the password is on its own card below, write-only. Test connection connects and signs in without sending anything; Send test message sends one short message to the address you type. A saved password is only sent to the server it was saved for: moving to another server removes it, and the page says so. Code that sends mail calls `getMailSender()` (`src/lib/admin/mail.ts`).

**Sales channels** holds what the channel code reads: Amazon Selling Partner API, X and Instagram, each with its own Test connection and notes. The Integrations page (`/integrations`) is the read-only report of what is connected, for everyone; Admin is where the values are set.

**AI models** sets the reasoning model and the embedding model: the provider (Ollama, LM Studio or OpenRouter), its address, the model name and, for embeddings, the vector width. Choosing a provider fills in its usual address when the box is empty or still holds a default. **Start from** fills the embedding form from a preset (Qwen3 Embedding 8B at 4,096 on each provider) and shows what to do first; nothing is saved until Save. Test checks the values in the form, saved or not. Changing the embedding model or its width while vectors are stored asks you to type the new width: the stored vectors stop being used, and search by meaning finds nothing until every concept is indexed again. After saving an embedding model, the page offers "Index the current concept". **Platform keys** below are the model hosts' keys and the Perplexity research key, used for every workspace. The planner address is on the same section.

**Voice** is text to speech for narration: None (the default), any OpenAI-compatible speech endpoint (address, model, voice, speed) or ElevenLabs (model, voice ID, speed). The key is on its own card; its Test connection speaks one short sentence and plays it in the page (the audio is not kept). Narration code calls `getVoiceSettings()` and `getSpeechSynthesizer()` (`src/lib/voice/speech.ts`).

**Other services** has the planner and slicer addresses (Docker Compose gives `http://planner:8000` and `http://slicer:8000`; the slicer runs only with `docker compose --profile slicer up`), a database test, and every environment variable the app reads, with whether it is set. Secret values are never shown.

**All keys** has one card per service, every service in one place. Paste a key and choose Save. The app never shows a saved key again; it shows at most its last four characters (only for keys of 12 characters or more). Remove deletes the saved value after you confirm. Test connection checks the key you typed, or the saved one, and says in plain words whether it worked. Below the cards is the recent activity: saves, removals and tests, never values. A key saved here is used before any environment variable. Keys are stored in the database as they are, not encrypted (see "What sign-in does not protect").

Perplexity's Test connection asks Perplexity one very short question with the cheapest effort, because Perplexity offers no free way to check a key. Each test is billed to your Perplexity account like any question, a fraction of a cent at Perplexity's listed rates, and the result shows Perplexity's own estimate when it gives one.

**Printers** lists your printers with a switch to turn each on or off, Edit, Test and Remove. Add printer asks for a name and a family, then shows exactly the fields that family needs. Every family says what the app can do with it today: *Testable today* (OctoPrint, Klipper/Moonraker), *Saved but not driven* (Prusa, Duet, Bambu Lab: saved, but not tested or sent anything yet), *No documented fields* (Creality, Elegoo: use File only), or *No connection needed* (File only). When editing, leave a secret empty to keep the saved one.

**Audit log** lists every change, newest first: time, user, concept, action and summary. Filter by concept (deleted concepts are marked "deleted"), by kind of change, or by text. Load more shows older lines. Open a line to see its full detail. Download saves the lines that match the filters as a file, one JSON object per line; taking a copy is itself recorded.

Not verified: none of the connection tests has been pressed against a real OpenRouter, Ollama, LM Studio, Perplexity, Stripe, mail server, speech endpoint, ElevenLabs or printer; they are tested against stand-ins.

**Access requests** lists the requests sent from the welcome page, newest first: when, who (name, email, company), the level they chose on the welcome page (Free, Maker, Studio or Self-hosted; "Not chosen" when they left it open) and what they want to build. Set each one to New, Contacted or Declined; the change is saved at once and recorded in the audit log. Download CSV saves every request, and the download is recorded too. The app sends no email: reply from your own mail. While the account still uses the published demo password this tab shows nothing and says why, because anyone could sign in and read names and emails; change the password in Account first. Until then the requests can be read with `docker compose exec db psql -U c2r c2r -c "SELECT * FROM access_requests ORDER BY id DESC;"`. The form is limited per network address with the same growing waits as sign-in.

## What gets installed

Three containers, started together by Docker Compose:

| Container | What it does |
|---|---|
| `web` | The application, on port 3000. |
| `db` | PostgreSQL with the pgvector extension. Holds every concept, every file and the activity history. |
| `planner` | A small Python service that works out the order of operations. If it is down, the plan page lists the steps without an order and says so. |

## Install

1. Install Docker Desktop, or Docker Engine with Compose 2.24 or later.
2. Get the code: `git clone https://github.com/Planet9V/EmotionalBaggage` and open that folder.
3. Optional: copy `.env.example` to `.env` and fill in the keys you have. Without a `.env` the stack starts with defaults (database password `c2r`, port 3000). To keep a default, leave its line out; do not set it to an empty value.
4. Run `docker compose up -d --build --wait`. It returns once all three containers report healthy.
5. Open `http://localhost:3000`.

The first request brings the database up to date, turns on pgvector and loads the example concept.

**Status of this procedure:** GitHub Actions starts the three containers on every change, both without a `.env` and with one copied from `.env.example`, and checks that they are healthy, that the app answers, that pgvector is active, that the planner is reachable, and that backup and restore work. It has been run on Linux there; it has not yet been run on a Mac.

**Database version:** the default image is PostgreSQL 19.0 (the current release, 19 November 2026) with pgvector 0.8.7. Its memory settings are tuned for vector search and can be changed in `.env` (`PG_SHARED_BUFFERS`, `PG_EFFECTIVE_CACHE_SIZE`, `PG_MAINTENANCE_WORK_MEM`, `PG_MAX_PARALLEL_MAINTENANCE_WORKERS`, `PG_WORK_MEM`, `PG_RANDOM_PAGE_COST`, `PG_SHM_SIZE`); the defaults suit a machine that gives Docker 4 GB or more. The reasons and measurements are on the Vector search page under Documentation. A data volume created by one major version of PostgreSQL will not start under another, so choose before the first start (`PG_IMAGE` in `.env`).

## Signing in

A new install has one account: user `demo`, password `demo`. Opening the app takes you to the sign-in page, which reminds you of the default account while it is still in use. After signing in, the sidebar shows "Change the default password" until you do.

**Changing the password.** Choose "Change the default password", or your user name at the foot of the sidebar, to open Account. Enter the current password and the new one twice. The new password must be at least 8 characters and cannot be `demo`. Every other browser signed in to the account is signed out; this one stays signed in.

**Signing out.** "Sign out" at the foot of the sidebar ends the session on the server and removes the cookie.

**Too many failed attempts.** There is no lockout. After 3 wrong passwords for one name from one network address, each further try from that address has to wait: 1 second after the next failure, then 2, 4, 8 and so on, at most 15 minutes. After 20 wrong passwords from one address, whatever the names, that address waits the same way. A try made during a wait is refused with "Try again in ..." and does not count. The right password is always accepted once the wait that applies to it has passed, and it clears the count for that name and address. Someone guessing from another address does not slow you down. Counts are forgotten after an hour without a try. To clear them at once:

```
docker compose exec db psql -U c2r c2r -c "DELETE FROM sign_in_attempts;"
```

**Behind a reverse proxy.** The app takes the network address from the connection itself (the container starts with `node -r ./client-address.cjs server.js`, which records it). Behind a reverse proxy every request comes from the proxy, so set `TRUST_PROXY=1` for the web service: the app then reads the address from the right-most entry of `X-Forwarded-For`, which your proxy must append (nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`). Never set it without a proxy in front: anyone could then send their own `X-Forwarded-For` and escape the per-address limits. Run with `next dev` or `next start`, the address is not recorded and every request counts as one address.

The new sign-in (`AUTH2`) reads the address the same way, with one addition for a chain of proxies: list your own proxies in `TRUSTED_PROXIES` (addresses or ranges, comma-separated, for example `10.0.0.0/8`), and the app skips them from the right of `X-Forwarded-For` and takes the first address that is not one of them. Without `TRUSTED_PROXIES` it takes the right-most entry, as above. Entries further left are what the visitor's browser claimed and are never used. All of this holds only if the app cannot be reached except through the proxy: keep its port closed to everything but the proxy (on Railway, the public domain is the proxy).

**Lost password.** This puts the install back to `demo` / `demo`. It deletes the account and its sessions; concepts and their data do not belong to an account, so nothing else is lost. The app recreates the default account when it starts with no users:

```
docker compose exec db psql -U c2r c2r -c "DELETE FROM users;"
docker compose restart web
```

**What sign-in does not protect.** This is a public test with a published default password, and keys saved in Admin are stored in the database unencrypted.

- Over plain http, anyone on the same network can read the password as it is typed and the session cookie, and use that cookie for up to 30 days. To use the app beyond your own machine, put it behind an HTTPS reverse proxy that sends `X-Forwarded-Proto: https` and passes the original `Host` header (nginx: `proxy_set_header Host $host;`); the cookie is then marked Secure. A proxy that rewrites `Host` makes every save answer 403. This has not been run behind a real proxy.
- Sign-in attempts are slowed per name and address and per address (above), not locked. Someone sharing your network address (the same office or home router) shares its waits.
- There is one account and no roles: whoever signs in can read and change everything, including saved keys (which the app never shows in full, but which sit readable in the database).

### Signing out

Account, Sign out everywhere ends every session. A session ends 30 days after last use, and 90 days after sign-in in any case.

## The audit log

Every change is recorded with the time, the signed-in user, the concept and what changed: rows added, edited and removed, files, research, decisions, keys set or removed (never their values), settings, printers, sign-ins and password changes. Deleting a concept deletes its rows and files but not its lines in the audit log, and the deletion is itself a line. Nothing in the app edits or removes a line.

Read it in Admin, Audit log, and download it there as a file (one JSON object per line). Taking a copy is recorded too. The log is in the database, so the backup below includes it; an existing install starts with what was already in each concept's activity list.

Sign-in lines are hidden until you choose **Show** or pick the Sign-in kind; refused sign-ins are always listed. A download follows the filters on screen, hidden sign-ins included. The log can only be added to: the database itself refuses to change, delete or empty it, even from SQL.

## Settings (`.env`)

Every setting is optional except the database password. Keys, models, the planner address and printers are set in Admin; the matching environment variables are fallbacks, used only when Admin has nothing saved.

| Setting | Used for |
|---|---|
| `PGPASSWORD` | The database password. It applies when the database is first created; changing it later does not change an existing database. |
| `PGAPPPASSWORD` | The password of the request role `c2r_app` (see "Two database roles"). It applies when the app first creates the role. |
| `WEB_PORT`, `PG_IMAGE` | The port the app listens on (3000) and the database image. |
| `WEB_BIND` | The address the app is published on. Default `127.0.0.1`: this machine only. See "Opening it to the network". |
| `TRUST_PROXY` | `1` only behind a reverse proxy that appends `X-Forwarded-For`. See "Behind a reverse proxy" under Signing in. |
| `TRUSTED_PROXIES` | With `TRUST_PROXY=1` and more than one proxy in front: their addresses or ranges, comma-separated. See "Behind a reverse proxy". |
| `AUTH2` | Off unless `1`. Switches on the new sign-in with accounts (email and password, email confirmation, authenticator-app codes) beside the current one. See "The new sign-in (being built)". |
| `BETTER_AUTH_SECRET` | Needed only with `AUTH2=1`: at least 32 random characters (`openssl rand -base64 48`). Signs the new sign-in's cookies and encrypts authenticator secrets; changing it signs everyone out and makes enrolled authenticator apps unusable. |
| `BETTER_AUTH_URL` | With `AUTH2=1`: the address people open the app at, for example `https://app.example.com`. Links in emails point there, and cookies are marked Secure when it starts with `https://`. |
| `AUTH2_TRUSTED_ORIGINS` | With `AUTH2=1`, optional: other addresses the app is opened at, comma-separated. A form sent from any other address is refused. |
| `PERPLEXITY_API_KEY`, `OPENROUTER_API_KEY` | Fallbacks only. A key saved in Admin is used first. A key from the environment is only ever sent to the provider's own address (`https://openrouter.ai`, `https://api.perplexity.ai` or `PERPLEXITY_BASE_URL`); to use a key with another model address, save it in Admin. |
| `PRINTER_KIND`, `PRINTER_URL`, `PRINTER_API_KEY` | Printer status in Prototype, 3D printing. `PRINTER_KIND` is `octoprint` or `moonraker`. |
| `AMAZON_SP_REFRESH_TOKEN`, `AMAZON_SP_CLIENT_ID`, `AMAZON_SP_CLIENT_SECRET`, `X_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_ACCOUNT_ID` | Fallbacks for the channel credentials (Amazon orders, X, Instagram). Saving them in Admin, Credentials is the usual way. |

**Keys stay with their host.** Every key saved in Admin is recorded with the address (scheme, host and port) it was saved for, and is only ever sent there. A model key is saved for the model address in use at the time (Admin, Models). If you move a model to another host, the key is removed when no model uses the old host any more, and Admin says so; type the key again for the new address. A connection test at another address does not use the saved key: type the key in the test form (it is used for that test only and not saved). A printer whose address moves to another host needs its key, password or access code typed again in the same change.

## The new sign-in (being built)

Accounts for more than one person are being built beside the current sign-in. While `AUTH2` is not set, nothing of it answers: `/api/auth2/...` is not found, the screens under `/auth/...` are not found, and signing in works exactly as described above. With `AUTH2=1` (and `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` set), people can create an account at `/auth/sign-up`, confirm their email address, sign in at `/auth/sign-in`, set up an authenticator app with recovery codes, and change or reset their password. The current sign-in and `demo` keep working beside it; the switch-over is a later step.

No mail service is connected yet: confirmation and reset emails are written to the server log (lines starting `[auth2 mail, not sent]`) instead of being sent. Anyone who can read the log can follow those links, so in production (`NODE_ENV=production`, as in the Docker image) the app refuses to start with `AUTH2=1` until a mail service is set up, and says so. In production it also requires `BETTER_AUTH_URL` to be an `https://` address. All of these settings, and the secret, are checked when the app starts, so a wrong one fails the health check instead of someone's first sign-in.

## Two database roles

The app can connect to PostgreSQL as two roles:

- **The owner**, `DATABASE_URL`: owns the tables. Migrations, loading the example concept, the vector search table and the sign-in tables use it.
- **The request role**, `DATABASE_APP_URL`: owns nothing. Every page and API request runs its queries as this role. It may read and write the app's tables, but not the tables that hold passwords, session tokens, reset tokens and second-factor secrets, and it may only add lines to the audit log. This is what will let row-level security keep one workspace's data from another's: PostgreSQL never applies it to a superuser or a table's owner.

`docker-compose.yml` sets both. On its first start the app creates the request role with the password in `DATABASE_APP_URL` (from `PGAPPPASSWORD`, default `c2r_app`), and on every start it brings that role's grants up to date. It refuses to start if the request role is a superuser, may bypass row-level security, or owns a table, and says which.

Leave `DATABASE_APP_URL` out (or set it equal to `DATABASE_URL`) and everything runs as one role, as before. Installs that set only `DATABASE_URL` keep working unchanged.

If the owner may not create roles (some hosted databases), create the request role by hand, then set `DATABASE_APP_URL`:

```sql
CREATE ROLE c2r_app LOGIN PASSWORD 'a long random password';
```

The app adds the grants itself on its next start.

## Opening it to the network

The app is published on `127.0.0.1` by default, so only this machine can reach it. To open it to your network, first change the `demo` / `demo` password (Account), then set `WEB_BIND=0.0.0.0` in `.env` and run `docker compose up -d`. Over plain http anyone on that network can read what is typed; see "What sign-in does not protect".

## Memory for Docker

The database settings (`shared_buffers` 1 GB, `maintenance_work_mem` 1 GB, `/dev/shm` 1 GB) assume Docker may use 4 GB or more. On Docker Desktop set it under Settings, Resources, Memory. With 2 GB, put these lines in `.env`: `PG_SHARED_BUFFERS=256MB`, `PG_EFFECTIVE_CACHE_SIZE=768MB`, `PG_MAINTENANCE_WORK_MEM=256MB`, `PG_SHM_SIZE=512mb`, `PG_MAX_PARALLEL_MAINTENANCE_WORKERS=1`. Vector index builds are then slower. The compose file sets no memory limit of its own.

## Apple-silicon Macs

The database image is published for arm64 as well as amd64 (CI checks that it offers both); the web and planner images are built on your machine from base images that are published for both. The slicer builds natively too: OrcaSlicer 2.5.0 publishes an aarch64 AppImage, which the slicer image uses on arm64 with its own pinned checksum. None of the stack has been run on an Apple-silicon Mac yet. If the arm64 slicer image does not work, build the x86-64 one under emulation (slower): `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose --profile slicer build slicer`. Or run the OrcaSlicer wrapper (`slicer/`) on another machine and point `SLICER_URL` at it.

**Printers on the local network.** Names ending in `.local` (such as `octopi.local`) do not resolve inside the app's container. Use the printer's IP address.

## Models

The reviewer and search by meaning use the models you choose: a reasoning model and an embedding model, each served by Ollama, LM Studio or OpenRouter. Nothing is chosen at install, and the features that need a model say so until one is.

They are chosen in Admin, Models.

- Give the address of the server's OpenAI-compatible interface: Ollama `http://host.docker.internal:11434/v1`, LM Studio `http://host.docker.internal:1234/v1`, OpenRouter `https://openrouter.ai/api/v1`. Inside Docker, `localhost` is the app's own container, so a model server on this computer is reached at `host.docker.internal`.
- OpenRouter needs a key. Ollama and LM Studio usually do not.
- For the embedding model, also give its vector width (for example 768 or 1024). If it is wrong, indexing reports both widths.
- After choosing or changing the embedding model, index each concept again (the button in Admin, Models, or `POST /api/index` with the concept's id). Until then search falls back to matching text for that concept. Rows embedded with an earlier model stay in the database but are not used.
- Search by meaning needs the pgvector extension, which the supplied database image has.
- Qwen3 Embedding 8B gives 4,096 numbers per text, more than pgvector's ordinary index accepts. The app compares every vector in a small concept, and in a larger one compares a stored one-bit copy of each vector and then re-ranks the best by their full vectors. The measurements are on the Vector search page under Documentation.

None of this has been run against a real Ollama, LM Studio or OpenRouter yet; it is tested against a stand-in.

After changing `.env`, run `docker compose up -d` again.

**OpenRouter.** Test asks OpenRouter itself whether it accepts the key (`GET /key`), because OpenRouter gives its model list to anyone, key or no key. A refused key is reported with OpenRouter's own words and the last four characters of the key that was sent. OpenRouter keeps embedding models in a list of their own, so the embedding test looks there, and says so when a name is not in it. An embedding model typed under Reasoning model is named as one.

## Drafting, the reviewer and impact

Drafting, the reviewer and realignment all use the reasoning model chosen in Models. Without one, the buttons explain why and link there. The impact notice needs the planner service; when it cannot be reached the notice says so and nothing else is affected.

## Wire routing and harness drawings

Both need the planner service (`PLANNER_URL`). `ROUTE_PLANNER_SECONDS` (default 30) is how long routing may take. The planner image includes Graphviz and WireViz; WireViz is run as a separate program.

## Enclosure generation

YAPP_Box needs the planner service and OpenSCAD inside it (the planner image installs it). A planner without OpenSCAD answers 503 and the screen shows YAPP_Box as not available; CaseMaker still works. Generating is recorded in Activity with the checks.

## Printers

- **Bambu Lab:** at the printer turn on LAN Only mode and Developer Mode, then enter its IP address, access code and serial number. An X1 needs a microSD card to start a print from the network. The printer's certificate is self-signed, so the certificate check is skipped for this local connection only (MQTT on 8883, FTPS on 990); nothing else in the app does this. Anyone on that network able to answer as the printer could read the access code.
- **Prusa (PrusaLink):** the password under Settings, Network, PrusaLink; the user name defaults to `maker`. An API key also works.
- **Duet:** standalone or with a single-board computer is detected; an empty password works when none is set. The Duet protocol puts the password in the sign-in address sent to the printer; it is not logged or stored anywhere else.
- **OctoPrint and Klipper (Moonraker):** address and API key.
- **Creality and Elegoo:** Moonraker, usually port 7125, marked Experimental.

Starting and stopping a print always need a confirmation, and every printer action is written to the audit log without any secret. No adapter has been run against a real printer yet: the Test button on your own machine is the first real check.

## The slicer

The slicer is a separate, optional service: OrcaSlicer 2.5.0 (AGPL-3.0) run as its own program in its own container, never linked into the app. Start it with `docker compose --profile slicer up -d --build`; the web service looks for it at `http://slicer:8000` (change it in Admin, Printers). The first build downloads OrcaSlicer (about 215 MB, checksum pinned). The banner on 3D printing shows Ready, Not reachable or Not set up. Perplexity needs its key in Admin, Credentials for price and alternate research.

With no slicer address set, print jobs say "No slicer is set up" and can still be queued: slice by hand and attach the file (100 MB at most).

## The short link address

`/l/<code>` is the one open route outside `/api` and sign-in: it redirects to the saved destination and counts the click by day. It limits requests in memory per app instance (120 a minute per code, 1,200 in total, 30 a minute for unknown codes).

## Amazon, X and Instagram

- **Amazon:** a Professional selling account and a private SP-API app with the Inventory and Order Tracking role; save the refresh token, client ID and secret in Credentials.
- **X:** an OAuth 2.0 client ID (and secret for a Web App client). Register `<app address>/api/channels/x/callback` exactly in the X console, or set the callback address field when the app sits behind a proxy, then press Connect X account. X charges per use; the dated cost statement is shown before the first send, and Test connection costs one user read.
- **Instagram:** paste the long-lived token and the account ID, then work through the checklist. For an app serving only your own professional account, Meta's Standard Access is enough; App Review is for Advanced Access. Tokens last 60 days and there is no refresh button yet.

## Slicer address

Admin, Printers has the slicer address at the top: the saved address is used first and `SLICER_URL` is the fallback. Test calls the slicer's `/health`.

## Checking it is healthy

- `docker compose ps` should show `db`, `planner` and `web` as running and healthy. Each checks itself every few seconds: the database by accepting connections, the planner by answering, the app by reading its data.
- In the app, **Integrations** shows whether the database, pgvector and the planner are reachable, and which outside services have a key set. It also lists what is not built.

## Railway

The **Railway** page under Documentation walks through running the three services (database, web, planner) on Railway, with the settings that were used on the first deployment.

## Loading files into a concept

The example concept loads its story and its documents (the 21 of the owner's Drive folder, and five enclosure files he added on 22 November 2026) once per database at start-up, also on an install seeded earlier; a file added to the example later arrives once at the next start, and is not put back if you remove it. To load a folder of files into any concept: `node scripts/import-files.mjs <folder> --concept <id> --url <address>`. It asks for a sign-in, or takes `--cookie`, and sub-folders become folders.

## Backups

Everything lives in the database, including uploaded and generated files. To back up:

```
docker compose exec -T db pg_dump -U c2r c2r > backup.sql
```

To restore into an empty install:

```
docker compose exec -T db psql -U c2r c2r < backup.sql
```

Both commands are run by the automated checks on every change. The data is kept in a Docker volume. It survives `docker compose down` and is deleted by `docker compose down -v`.

## Updating

```
git pull
docker compose up -d --build
```

Database changes are applied at start-up, in order, and each is recorded so it runs once. Back up before updating all the same.

## Third-party code

The **Code use** page under Documentation lists every third-party library, image and font, its licence and how it is used. It is generated from what is installed. The owner approved the wording of its attestation on 20 November 2026.
