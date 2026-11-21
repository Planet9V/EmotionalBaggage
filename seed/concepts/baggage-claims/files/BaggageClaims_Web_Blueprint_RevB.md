BAGGAGE CLAIMS — WEB BLUEPRINT REV B (Next.js 16 · PG 18.7 + pgvector · no S3)
Date: 19 Nov 2026. Artifacts: docker-compose.yml (Rev B), db_schema.sql (Rev B),
web_architecture_blueprint.png (rev-A layout; storage tier now Postgres).
Supersedes Rev A storage design. Pin rationale & versions below.
0. VERSION PINS (as of today)
PostgreSQL 18.7 via image pgvector/pgvector:pg18-trixie (mature; PG 19 released TODAY 2026-11-19 — do NOT ride .0 on launch week; upgrade window = after Kickstarter, pg_upgrade w/ retained stats is the 18->19 path)
pgvector 0.8.7 (includes IVFFlat buffer-overflow fix — never ship 0.8.4-0.8.6)
Next.js 16.x, React 19, Tailwind v4, TypeScript
Better Auth (self-hosted) — NOT Clerk (per-user billing hostile to gag-scale lists)
Stripe Checkout + webhooks (payments) | Drizzle ORM
Redis 7 + BullMQ workers (same pattern as Rev A)
Listmonk (campaigns) + Postiz v2.11.3 (social media mgmt) as compose services
1. STARTER TEMPLATE — BASE + GRAFT PLAN

BASE: Vercel nextjs/saas-starter (≈16k stars, MIT). Gives: Drizzle+Postgres wiring, Stripe subscriptions->adapted to one-time SKU checkout, teams shell, activity log, dashboard skeleton. Known gap: pins Next 15 canary -> bump to Next.js 16 (App Router API-stable for this surface; react 19 already aligned). GRAFT 1 (auth): swap template's custom JWT for Better Auth (magic link + admin roles + impersonation) — keeps everything self-hosted/docker-only. GRAFT 2 (dashboard): next-shadcn-dashboard-starter (Next 16) components for the back-office: data tables (claims moderation, units, orders), charts (funnel one-pager), form patterns. Component-level graft, not a second app. NOT chosen and why:

Open SaaS (16k): Wasp DSL, not Next.js — violates the stack constraint.
Clerk-based starters: hosted per-MAU billing fights 100k-email-list economics.
next-betterauth-saas: right shape (Next 16.2, Better Auth, dynamic Stripe pricing engine, admin) but single-author repo; mine its dynamic-pricing pattern, don't bet the product on it.
2. POSTGRES FILE STORAGE (S3 removed by requirement)

media table: bytea payload, sha256 unique (integrity+dedup), 8 MB CHECK (TOAST handles the rest; tickets' audio 200 KB, images ~150 KB, voice-pack zips ~5-15 MB -> SPLIT packs >8 MB into chunks table if ever exceeded — v1: keep master zips on release media = press/backup volume, DB stores per-clip manifest only for packs). Serving: GET /api/media/[id] — ranged streaming (substring on bytea), ETag=sha256, Cache-Control immutable, Caddy HTTP cache in front. Backup story SIMPLIFIES: pg_dump = full restore (no S3 cross-sync). Watch-items: pgdata growth (+35 MB/10k tickets — trivial), no CDN — Caddy cache covers until traffic justifies Cloudflare in front (free tier).

3. PGVECTOR IN THIS PRODUCT (three real uses, not hype)
Moderation dedupe: claim_tickets.embedding vector(1024) + HNSW cosine — flag near-dupes of approved gags (concept repeats), speed the queue.
Semantic FAQ/support: knowledge table — deflect tickets with ORDER BY embedding <=> $query LIMIT 3 before hitting support macros.
Campaign retrieval: caption/insult library search for social posts (find past winners semantically, feed Postiz drafts). Embeddings: batched by worker (audio-stitch chain step 9b), provider pluggable via EMBEDDINGS_PROVIDER (local bge-large / hosted) — fail-open: vector cols nullable, search degrades to SQL LIKE.
4. CAMPAIGNS — LISTMONK (self-hosted, its own DB in same cluster)
All email journeys from Website Plan §5.1 become Listmonk campaigns + transactional stays on Resend from the Next worker (welcome/receipt/pack).
Sync: worker 'listmonk-sync' queue calls Listmonk API on events (gate_signup, buyer, registered) -> lists mirror Klaviyo segmentation.
campaigns table mirrors send metadata for the dashboard one-pager (spend vs. sends vs. UTM conversions in events).
5. SOCIAL MEDIA MGMT — POSTIZ (self-hosted, PINNED v2.11.3)
v2.11.3 = last release without Temporal (v2.12+ adds Temporal + ES stack — deliberate complexity dodge for a 1-brand deployment).
Runs at social.
30+ channels incl. TikTok/IG/YouTube/X — maps to Four Gates + character account ops. Queue: Postiz handles; our worker pushes claim-of-the-week drafts to Postiz via its API (campaign_assets.postiz_post_id).
AGPL-3.0: we RUN it, we neither fork nor embed code — no source-disclosure obligation triggered. If ever forked, publish modifications.
Data: own database 'postiz' in the shared cluster (isolated by schema/db).
6. ADMIN / DASHBOARD (back-office, role-gated)

Modules unchanged from Rev A (moderation, units, packs, coupons, KS import, wholesale, analytics) — now on shadcn dashboard graft + two new tiles: campaigns table (Listmonk/Postiz/spend roll-up) and media browser (Postgres media w/ sha256 dedup view). Embeddings power the moderation "similar complaints" sidebar. Impersonation (Better Auth) for support.

7. COMPOSE REV B — SERVICE MAP (7 containers, 1 network)

db (pgvector/pgvector:pg18-trixie) - 4 DBs: bagclaims, listmonk, postiz + 02_extra_dbs.sql init script redis | web (Next 16, MEDIA_BACKEND=postgres) | worker (ffmpeg+BullMQ) listmonk (campaigns) | postiz:v2.11.3 (social) | caddy (3 vhosts) Wildcards: web :3000, social.* :5000(postiz), mail.* :9000(listmonk).

8. MIGRATION FROM REV A (+ what to delete)

DELETE: minio service, S3 SDK + presigned-URL code paths, S3_* env vars. REPLACE: audio_key/image_key -> audio_media/image_media FKs; GET /api/packs/[sku]/dl -> /api/media/[id] w/ entitlement JOIN. KEEP: everything else (queues, flows, state machines, IDs).

9. SELF-HOST COST (single VPS, 4 vCPU/8 GB)

~$24-40/mo VPS + domain. Zero per-seat SaaS: email (Listmonk + Resend free 3k/mo), social (Postiz), vectors (in-DB). Breakeven vs. SaaS stack (Klaviyo+Buffer+S3+Pinecone-class) at ~5k contacts: ~$100-150/mo saved.
