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
| `planner` | A small Python service that works out the order of operations. If it is down, the app works the order out itself and says so. |

## Install

1. Install Docker Desktop.
2. Get the code: `git clone https://github.com/Planet9V/EmotionalBaggage`.
3. In that folder, copy `.env.example` to `.env`.
4. Run `docker compose up -d --build`.
5. Open `http://localhost:3000`.

The first start creates the database tables and loads the example concept.

**Status of this procedure:** the application build and its tests run on every change. The three-container start-up itself has not yet been run end to end (item 0.1 of the plan). If it fails, the error it prints is the thing to report.

## Settings (`.env`)

Every setting is optional except the database password. A feature without its setting is switched off and says so on screen.

| Setting | Used for |
|---|---|
| `PGPASSWORD` | The database password. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | The AI reviewer in Concept, Challenge. |
| `PERPLEXITY_API_KEY`, `PERPLEXITY_MODEL` | Research, Ask. |
| `PRINTER_KIND`, `PRINTER_URL`, `PRINTER_API_KEY` | Printer status in Prototype, 3D printing. `PRINTER_KIND` is `octoprint` or `moonraker`. |

The AI reviewer works with one provider today. Choosing a reasoning model and an embedding model from Ollama, LM Studio or OpenRouter is item 2.5 of the plan.

After changing `.env`, run `docker compose up -d` again.

## Checking it is healthy

Open **Integrations** in the sidebar. It shows, live, whether the database, pgvector and the planner are reachable, and which outside services have a key set. It also lists what is not built.

## Backups

Everything lives in the database, including uploaded and generated files. To back up:

```
docker compose exec db pg_dump -U c2r c2r > backup.sql
```

To restore into an empty install:

```
docker compose exec -T db psql -U c2r c2r < backup.sql
```

These two commands are standard PostgreSQL and have not been exercised against this install yet.

## Updating

```
git pull
docker compose up -d --build
```

Database changes are applied at start-up. There is no migration tool yet (item 1.8 of the plan), so back up before updating.

## Third-party code

The list of third-party components and how each is used is item 1.11 of the plan and is not written yet.
