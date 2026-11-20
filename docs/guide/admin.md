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

## Settings (`.env`)

Every setting is optional except the database password. A feature without its setting is switched off and says so on screen.

| Setting | Used for |
|---|---|
| `PGPASSWORD` | The database password. It applies when the database is first created; changing it later does not change an existing database. |
| `WEB_PORT`, `PG_IMAGE` | The port the app listens on (3000) and the database image. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | The AI reviewer in Concept, Challenge. |
| `PERPLEXITY_API_KEY`, `PERPLEXITY_MODEL` | Research, Ask. |
| `PRINTER_KIND`, `PRINTER_URL`, `PRINTER_API_KEY` | Printer status in Prototype, 3D printing. `PRINTER_KIND` is `octoprint` or `moonraker`. |

The AI reviewer works with one provider today. Choosing a reasoning model and an embedding model from Ollama, LM Studio or OpenRouter is item 2.5 of the plan.

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

The list of third-party components and how each is used is item 1.11 of the plan and is not written yet.
