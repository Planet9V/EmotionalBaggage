# Deploying on Railway

How to run the whole stack on Railway as four services built from this repository. **This layout has not been deployed yet.** It is written from Railway's documentation and from the code, and every step below should be checked against a first real deployment before anyone relies on it. Nothing in this repository creates anything on Railway.

Each Railway fact below has the page of Railway's documentation it comes from beside it. The pages were found through a web search on 21 November 2026; their text could not be opened in the session that wrote this guide, so the wording of each fact is from Railway's documentation as it was known then, and the link is where to confirm it.

## The four services

| Service | Built from | Network | Needed |
|---|---|---|---|
| web | the root `Dockerfile` | public domain | yes |
| planner | `planner/Dockerfile` (root directory `planner`) | private only | yes (without it the order of operations, wire routing, the harness drawing and the YAPP enclosure generator are off) |
| db | the image `pgvector/pgvector:0.8.7-pg19-trixie`, with a volume | private only | yes |
| slicer | `slicer/Dockerfile` (root directory `slicer`) | private only | no (without it print jobs are sliced by hand, as the 3D printing page says) |

Railway can read a `docker-compose.yml` dropped onto a project canvas and turn its services into Railway services ([Docker Compose guide](https://docs.railway.com/guides/docker-compose)). The compose file here builds from local folders, uses a profile for the slicer and sets `shm_size`, which do not carry over, so creating the four services by hand as below is the clearer route. Use the compose file as the reference for what each service needs.

### web

- Source: this repository, root `Dockerfile`.
- The image listens on `0.0.0.0` and on the port in `PORT` (the Dockerfile sets `PORT=3000` and `HOSTNAME=0.0.0.0`; Next.js's standalone `server.js` reads both). Railway gives each service a `PORT` variable and routes its public domain to the port the app listens on ([public networking](https://docs.railway.com/public-networking)). Either leave `PORT` to Railway or set `PORT=3000` on the service and point the domain's target port at 3000; do not set one without the other.
- Health check path: `/api/health` ([health checks](https://docs.railway.com/guides/healthchecks)). It needs no sign-in and answers 200 only when the database answers, so a deployment that cannot reach its database is never put live.
- Variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://c2r:<password>@<db service>.railway.internal:5432/c2r` (the password is the db service's `POSTGRES_PASSWORD`; a reference variable such as `${{db.POSTGRES_PASSWORD}}` keeps them the same) |
| `PLANNER_URL` | `http://<planner service>.railway.internal:8000` |
| `SLICER_URL` | `http://<slicer service>.railway.internal:8000`, or leave it out with no slicer |
| `TRUST_PROXY` | `1`. Railway's edge sits in front of the app and adds `X-Forwarded-For`; with this set, sign-in throttling counts attempts per visitor instead of per proxy |
| `PERPLEXITY_API_KEY`, channel keys | optional; Admin, Credentials is the usual place for them |

The planner and slicer addresses can also be saved in Admin (Models for the planner, Printers for the slicer); a saved address takes precedence over the variable.

### planner

- Source: this repository. Railway builds a Dockerfile at another path when the service variable `RAILWAY_DOCKERFILE_PATH` names it ([Dockerfiles](https://docs.railway.com/builds/dockerfiles)), but the build context stays the repository root, and `planner/Dockerfile` copies `requirements.lock`, its Python files and `vendor` from its own folder (the compose file builds it with `./planner` as the context). `RAILWAY_DOCKERFILE_PATH=planner/Dockerfile` alone would therefore fail at the first `COPY`. Set the service's **root directory** to `planner` instead: the context is then the planner folder and Railway finds its `Dockerfile` there with no path variable. (If a later change makes the planner's Dockerfile build from the repository root, `RAILWAY_DOCKERFILE_PATH=planner/Dockerfile` becomes the way.) Check this on the first build.
- No public domain. Other services reach it at `<service name>.railway.internal` ([private networking](https://docs.railway.com/private-networking)).
- Variables: `HOST=::` and `PORT=8000`. The image reads both (`planner/Dockerfile`). Railway's private network has been IPv6 only in environments created before Railway added IPv4 to it, and a service listening on `0.0.0.0` alone cannot be reached there ([private networking, how it works](https://docs.railway.com/networking/private-networking/how-it-works)); `::` listens on IPv6 and, on Linux, on IPv4 too. Setting `PORT` yourself keeps the address in `PLANNER_URL` fixed.
- Health check path: `/health`.
- Size: the image adds Graphviz and OpenSCAD to `python:3.13-slim`. Its size has not been measured (no Docker daemon was available when this was written); OpenSCAD and its libraries are the bulk of it. Check the built size against your Railway plan's image limit.

### db

- Source: the Docker image `pgvector/pgvector:0.8.7-pg19-trixie`, the same image as `docker-compose.yml`.
- A volume mounted at `/var/lib/postgresql` ([volumes](https://docs.railway.com/volumes)). PostgreSQL 18 and later images keep their data in `/var/lib/postgresql/<major>/docker` and declare `/var/lib/postgresql` as the volume, so the whole of that folder is mounted, as in the compose file. Mounting `/var/lib/postgresql/data`, the older images' path, would leave the data outside the volume and lose it on every redeploy.
- Variables: `POSTGRES_DB=c2r`, `POSTGRES_USER=c2r`, `POSTGRES_PASSWORD=<a long random password>`. The password is read only when the volume is empty; changing it later does not change it inside the database.
- Start command, the same settings as the compose file, sized for 4 GB of memory:

```
postgres -c shared_buffers=1GB -c effective_cache_size=3GB -c maintenance_work_mem=1GB -c max_parallel_maintenance_workers=4 -c work_mem=32MB -c random_page_cost=1.1
```

- `RAILWAY_SHM_SIZE_BYTES=1073741824` (1 GB, matching the compose file's `shm_size: 1gb`). PostgreSQL's parallel index builds and parallel scans share memory through `/dev/shm`, which a container gets at 64 MB unless told otherwise; a vector index build with `maintenance_work_mem` above that fails with "could not resize shared memory segment". Railway sets the size from this variable ([PostgreSQL on Railway](https://docs.railway.com/databases/postgresql), [variables reference](https://docs.railway.com/variables/reference)).
- With less memory, use the smaller settings from `.env.example`, for the reasons in the Vector search page: `shared_buffers=256MB`, `effective_cache_size=768MB`, `maintenance_work_mem=256MB`, `max_parallel_maintenance_workers=1`, and `RAILWAY_SHM_SIZE_BYTES=536870912` (512 MB). Vector index builds are then slower; nothing else changes. Keep `shared_buffers` to about a quarter of the service's memory, `effective_cache_size` to about three quarters, and `/dev/shm` at least as large as `maintenance_work_mem`.
- No public domain and no TCP proxy: only the web service talks to it, over the private network. The image listens on every address (`listen_addresses='*'`), IPv6 included.
- Backups: Railway volumes can be backed up from the volume's settings ([volumes](https://docs.railway.com/volumes)); the Admin guide's `pg_dump` instructions work too, run from a machine that can reach the database.

### slicer (optional)

- Source: this repository with the service's root directory set to `slicer`, for the same reason as the planner: `slicer/Dockerfile` copies `app`, `profiles.json`, `tests` and `tools` from its own folder, so `RAILWAY_DOCKERFILE_PATH=slicer/Dockerfile` with the repository root as the context would not find them.
- Variables: `HOST=::` and `PORT=8000`. The image reads both (`slicer/Dockerfile`, changed for this guide in the same way as the planner's).
- Health check path: `/health`.
- The build downloads the OrcaSlicer AppImage and its profiles from GitHub and checks them against pinned checksums; it is large and slow. Build it only if you will slice in the hosted install.

## What does not work from a hosted install

- **A model host on your own machine.** Ollama or LM Studio at `http://localhost:11434` is your computer, not the Railway service. Use OpenRouter, or a model host with a public address you control. The app does not tunnel to your machine.
- **Printers on your home or workshop network.** OctoPrint, Moonraker, Bambu and Prusa Link at `192.168.x.x` cannot be reached from Railway. Download the sliced file and print by hand (the 3D printing page's "Prints by hand" path), or run the app on your own network for the printer.
- **`host.docker.internal`.** The compose file maps it for local printers; it means nothing on Railway.
- **The scripted test stand-ins.** The `tests/standins` services are for tests only.

## Before switching the public domain on

1. Deploy with no public domain first and check the deployment's health check passes.
2. Change the `demo` / `demo` password. Until you do, anyone who finds the address can sign in. Add a domain only after this (Account, Change the password; the Admin guide, "Signing in").
3. Know that credentials saved in Admin (model keys, Perplexity, channel tokens, printer keys) are stored in the database **unencrypted**, by the owner's decision. Anyone with the database password or a copy of a backup can read them. Keep the db service private, keep `DATABASE_URL` only in the web service's variables, and treat backups as secret.
4. Set `TRUST_PROXY=1` on web, so sign-in throttling counts each visitor separately.
5. The app has one account system and no sign-up page; every person you give the password to sees every concept.

## Checked in the code for this layout

| Concern | Finding |
|---|---|
| web listens on `0.0.0.0` and `$PORT` | Yes: the Dockerfile sets `PORT=3000` and `HOSTNAME=0.0.0.0`, and Next's standalone server reads both at start-up. |
| planner listens on `$HOST:$PORT` | Yes, since the lead's change to `planner/Dockerfile`. |
| slicer listens on `$HOST:$PORT` | It did not (`--host 0.0.0.0 --port 8000` was fixed in the command). Changed to read `HOST` and `PORT`; its own health check follows `PORT`. A test (`tests/ux/railway-images.test.ts`) holds both images to it. |
| database and planner clients over IPv6 | The database client (`pg`) and the planner and slicer calls (`safeFetch`, `src/lib/net/outbound.ts`) resolve the name with the system resolver and accept IPv6 answers. `safeFetch` allows private addresses, which include IPv6 unique-local addresses such as Railway's; it refuses only link-local, metadata and unspecified addresses. Not tested on an IPv6 network: the machine this was written on has none. |
| health check paths | web `/api/health`, planner `/health`, slicer `/health`. |
| planner image size | Not measured. |
