# Admin guide

For the person who installs and looks after the workbench.

> **A public test.** One account with a published default password, and keys stored in the database unencrypted. Change the password after the first sign-in, and read "What sign-in does not protect" below before using it beyond your own machine.

## Admin

Open **Admin** from the sidebar. Everything set there is saved in this install's database and used at once; no restart is needed. A link can open one tab directly: `/admin?tab=credentials`, `models`, `printers` or `audit`.

**Setup** lists what is not set up yet: the reasoning model, the embedding model, the research key, a printer, the planner and your own password. Each line says what it switches on and has a button to the place it is set. Nothing is required; skip anything and come back later.

**Credentials** has one card per service. Paste a key and choose Save. The app never shows a saved key again; it shows at most its last four characters (only for keys of 12 characters or more). Remove deletes the saved value after you confirm. Test connection checks the key you typed, or the saved one, and says in plain words whether it worked. Below the cards is the recent activity: saves, removals and tests, never values. A key saved here is used before any environment variable.

Perplexity's Test connection asks Perplexity one very short question with the cheapest effort, because Perplexity offers no free way to check a key. Each test is billed to your Perplexity account like any question, a fraction of a cent at Perplexity's listed rates, and the result shows Perplexity's own estimate when it gives one.

**Models** sets the reasoning model and the embedding model: the provider (Ollama, LM Studio or OpenRouter), its address, the model name and, for embeddings, the vector width. Choosing a provider fills in its usual address when the box is empty or still holds a default. **Start from** fills the embedding form from a preset (Qwen3 Embedding 8B at 4,096 on each provider) and shows what to do first; nothing is saved until Save. Test checks the values in the form, saved or not. After saving an embedding model, every concept must be indexed again; the page offers "Index the current concept" and shows the counts or the reason it could not run. The planner address is set on the same tab; when it is empty, the `PLANNER_URL` environment variable applies.

**Printers** lists your printers with a switch to turn each on or off, Edit, Test and Remove. Add printer asks for a name and a family, then shows exactly the fields that family needs. Every family says what the app can do with it today: *Testable today* (OctoPrint, Klipper/Moonraker), *Saved but not driven* (Prusa, Duet, Bambu Lab: saved, but not tested or sent anything yet), *No documented fields* (Creality, Elegoo: use File only), or *No connection needed* (File only). When editing, leave a secret empty to keep the saved one.

**Audit log** lists every change, newest first: time, user, concept, action and summary. Filter by concept (deleted concepts are marked "deleted"), by kind of change, or by text. Load more shows older lines. Open a line to see its full detail. Download saves the lines that match the filters as a file, one JSON object per line; taking a copy is itself recorded.

Not verified: none of the connection tests has been pressed against a real OpenRouter, Ollama, LM Studio, Perplexity or printer; they are tested against stand-ins.

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

**Too many failed attempts.** After 5 wrong passwords for a name within 15 minutes, that name is refused until 15 minutes after the first failure. Wait, or clear the count:

```
docker compose exec db psql -U c2r c2r -c "DELETE FROM sign_in_attempts;"
```

**Lost password.** This puts the install back to `demo` / `demo`. It deletes the account and its sessions; concepts and their data do not belong to an account, so nothing else is lost. The app recreates the default account when it starts with no users:

```
docker compose exec db psql -U c2r c2r -c "DELETE FROM users;"
docker compose restart web
```

**What sign-in does not protect.** This is a public test with a published default password, and keys saved in Admin are stored in the database unencrypted.

- Over plain http, anyone on the same network can read the password as it is typed and the session cookie, and use that cookie for up to 30 days. To use the app beyond your own machine, put it behind an HTTPS reverse proxy that sends `X-Forwarded-Proto: https` and passes the original `Host` header (nginx: `proxy_set_header Host $host;`); the cookie is then marked Secure. A proxy that rewrites `Host` makes every save answer 403. This has not been run behind a real proxy.
- Anyone who can reach the app can lock the account for 15 minutes by sending 5 wrong passwords, and can do it again. There is no limit per network address.
- There is one account and no roles: whoever signs in can read and change everything, including saved keys (which the app never shows in full, but which sit readable in the database).

## The audit log

Every change is recorded with the time, the signed-in user, the concept and what changed: rows added, edited and removed, files, research, decisions, keys set or removed (never their values), settings, printers, sign-ins and password changes. Deleting a concept deletes its rows and files but not its lines in the audit log, and the deletion is itself a line. Nothing in the app edits or removes a line.

Read it in Admin, Audit log, and download it there as a file (one JSON object per line). Taking a copy is recorded too. The log is in the database, so the backup below includes it; an existing install starts with what was already in each concept's activity list.

## Settings (`.env`)

Every setting is optional except the database password. Keys, models, the planner address and printers are set in Admin; the matching environment variables are fallbacks, used only when Admin has nothing saved.

| Setting | Used for |
|---|---|
| `PGPASSWORD` | The database password. It applies when the database is first created; changing it later does not change an existing database. |
| `WEB_PORT`, `PG_IMAGE` | The port the app listens on (3000) and the database image. |
| `PERPLEXITY_API_KEY`, `OPENROUTER_API_KEY` | Fallbacks only. A key saved in Admin is used first. |
| `PRINTER_KIND`, `PRINTER_URL`, `PRINTER_API_KEY` | Printer status in Prototype, 3D printing. `PRINTER_KIND` is `octoprint` or `moonraker`. |

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

The slicer is a separate, optional service: OrcaSlicer 2.5.0 (AGPL-3.0) run as its own program in its own container, never linked into the app. Start it with `docker compose --profile slicer up -d --build` and set `SLICER_URL=http://slicer:8000` for the web service. The first build downloads OrcaSlicer (about 215 MB, checksum pinned). The banner on 3D printing shows Ready, Not reachable or Not set up. Perplexity needs its key in Admin, Credentials for price and alternate research.

## Checking it is healthy

- `docker compose ps` should show `db`, `planner` and `web` as running and healthy. Each checks itself every few seconds: the database by accepting connections, the planner by answering, the app by reading its data.
- In the app, **Integrations** shows whether the database, pgvector and the planner are reachable, and which outside services have a key set. It also lists what is not built.

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
