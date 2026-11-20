# Admin guide

For the person who installs and looks after the workbench.

> **Not built yet:** the Admin area in the app. Today every setting below is a line in a file, and changing one means restarting. The Admin area (credentials, model choice, printers, each with a Test button) is items 2.4 to 2.6 of the plan. This page will be rewritten when it lands.

> **No sign-in yet.** Anyone who can reach the app's address can read and change everything, and can use any AI or research key you have set. Keep it on your own machine or network. Sign-in is item 2.3 of the plan.

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

**Database version:** the default image is PostgreSQL 19 with pgvector 0.8.7. A data volume created by one major version of PostgreSQL will not start under another, so choose before the first start (`PG_IMAGE` in `.env`).

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

## Settings (`.env`)

Every setting is optional except the database password. A feature without its setting is switched off and says so on screen.

| Setting | Used for |
|---|---|
| `PGPASSWORD` | The database password. It applies when the database is first created; changing it later does not change an existing database. |
| `WEB_PORT`, `PG_IMAGE` | The port the app listens on (3000) and the database image. |
| `PERPLEXITY_API_KEY`, `OPENROUTER_API_KEY` | Fallbacks only. A key saved in Admin is used first. |
| `PRINTER_KIND`, `PRINTER_URL`, `PRINTER_API_KEY` | Printer status in Prototype, 3D printing. `PRINTER_KIND` is `octoprint` or `moonraker`. |

## Models

The reviewer and search by meaning use the models you choose: a reasoning model and an embedding model, each served by Ollama, LM Studio or OpenRouter. Nothing is chosen at install, and the features that need a model say so until one is.

The Admin screens are not built yet (plan items 2.4 to 2.6). Until they are, the choice is saved with `PUT /api/admin/settings` and keys with `PUT /api/admin/credentials/<provider>`; `POST /api/admin/test` checks a connection.

- Give the address of the server's OpenAI-compatible interface: Ollama `http://host.docker.internal:11434/v1`, LM Studio `http://host.docker.internal:1234/v1`, OpenRouter `https://openrouter.ai/api/v1`. Inside Docker, `localhost` is the app's own container, so a model server on this computer is reached at `host.docker.internal`.
- OpenRouter needs a key. Ollama and LM Studio usually do not.
- For the embedding model, also give its vector width (for example 768 or 1024). If it is wrong, indexing reports both widths.
- After choosing or changing the embedding model, index each concept again (`POST /api/index` with the concept's id). Until then search falls back to matching text for that concept. Rows embedded with an earlier model stay in the database but are not used.
- Search by meaning needs the pgvector extension, which the supplied database image has.

None of this has been run against a real Ollama, LM Studio or OpenRouter yet; it is tested against a stand-in.

After changing `.env`, run `docker compose up -d` again.

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

The **Code use** page under Documentation lists every third-party library, image and font, its licence and how it is used. It is generated from what is installed. Its attestation at the end is a draft until the person who gave the legal sign-off approves the wording.
