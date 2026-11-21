BAGGAGE CLAIMS — WEB ARCHITECTURE BLUEPRINT (Next.js 15 · React · Docker) — Rev A
Artifacts: web_architecture_blueprint.png, db_schema.sql, docker-compose.yml
Supersedes "Shopify system-of-record" for the custom build path; Shopify
remains the documented fallback (Website Plan Rev A §2). Checkout = Stripe.
1. SYSTEM SHAPE

Next.js 15 monolith ("modular monolith"): one repo, one Next app, one Docker image with two entrypoints (web + worker). Postgres = system of record, Redis = queues/cache, S3 = media, Caddy = edge. Scale path: web replicas behind Caddy; worker replicas by queue. No Kubernetes until >$1M GMV.

2. FRONT-END (React 19 RSC, App Router, TypeScript, Tailwind)

app/ (marketing)/ page.tsx / Gate: split-flap departure board + kiosk CTA how-it-works/page.tsx Safety Card (6 panels) moments/page.tsx 8 trigger vignettes (scroll-driven, Framer Motion) stories/page.tsx UGC wall (approved tickets + contest) wholesale/page.tsx buyers form press/page.tsx kit faq/page.tsx Complaint Department hotline/page.tsx STEP WIZARD (client island): map -> insult -> trauma board/page.tsx Departure Board (SSR + 5s polling of rank) product/[sku]/page.tsx Spec placard + scale-readout price + bundles claim/page.tsx Platinum Status serial registration checkout/success|cancel Stripe returns (auth)/signin magic link (Auth.js v5) back-office/ layout.tsx role-gate (moderator|admin via middleware) moderation/page.tsx ticket queue (approve/reject inline audio player) units/page.tsx CSV import + batch table packs/page.tsx voice-pack CRUD + S3 upload coupons/page.tsx creator codes (10% payout report) wholesale/page.tsx CRM pipeline analytics/page.tsx one-pager (funnel, CAC, attach) components/ ui/ (shadcn) flap-board/ kiosk/ wizard/ audio-player/ scale-price/ claim-ticket-canvas/ lib/ db.ts (Prisma) queue.ts (BullMQ) s3.ts stripe.ts klaviyo.ts auth.ts (Auth.js) rate.ts tts-fragments.ts events.ts

RSC default; client islands ONLY for: flap animation, hotline wizard, audio playback, board polling. Server Actions for mutations (form posts); Route Handlers under /api only for webhooks + polling endpoints.

3. USER FLOWS
3.1 Gate -> referral loop

anon -(UTM)-> / -> enter email -> upsert(leads) [source,utm] -> enqueue(email.welcome) -> welcome email w/ magic signin -> signed-in -> unique ref link /r/[refCode] -> referee lands (same flow) -> on referee consent: referrals(status=verified) -> recount -> milestone hit (3/10/25): enqueue(reward issue: code|price-lock) -> /board renders rank from Redis cache (recomputed 60s cron in worker)

3.2 Hotline ticket

/hotline wizard -> POST action createTicket -> row(pending_review) -> enqueue(ticket-render): worker stitches TTS fragments (ffmpeg concat, 3 fixed intros x 12 locations x 15 insults x 5 traumas) -> S3 audio+image -> email-gated reveal -> share image (OG tags per ticket) -> moderator approves -> appears on /stories wall

3.3 Purchase (Stripe)

/product -> Server Action createCheckout -> Stripe Checkout Session -> webhook /api/stripe (signature-verified) -> orders(paid) + items

entitlements for any voice_pack SKUs -> Klaviyo 'buyer' + receipt email -> fulfillment: physical -> pick list; digital pack -> signed S3 URL.
3.4 Platinum Status registration

QR -> /claim?u=BC-#### -> auth -> validate units.serial (unused) -> registrations insert + entitlement(free pack, source=registration) -> show pack download + travel_freq ask -> Klaviyo 'registered'.

3.5 Kickstarter import (admin)

/back-office: upload backer CSV -> worker ks-import -> orders(source=kickstarter, status=prepaid via total_cents=0 flag / paid) + tags -> batch fulfillment export (CSV to 3PL). Idempotent on ks_backer_id.

4. API SURFACE (Route Handlers; mutations otherwise = Server Actions)

POST /api/stripe webhook (raw body, sig check, idempotent) POST /api/resend (optional) bounce/unsub events GET /api/board/rank {refCode} -> rank JSON (5s cache) - polled GET /api/claim-ticket/[cn] public ticket JSON (approved only) GET /api/health liveness (compose healthcheck) GET /api/packs/[sku]/dl entitlement-checked -> 302 presigned S3 Admin actions guarded by requireRole('admin') on Action level.

5. WORKER QUEUES (BullMQ on Redis)

audio-stitch ffmpeg concat + loudnorm (-16 LUFS) -> S3 ticket-render canvas render claim-ticket PNG (satori/resvg) -> S3 email Resend templates (welcome, receipt, pack, upgrade) klaviyo-sync list membership + custom events (flow triggers) ks-import CSV -> orders (batch 500) rank-recompute referral board cache refresh (*/60s) dlq all queues -> dead-letter + admin alert

6. DATABASE

Postgres 16 via Prisma; DDL in db_schema.sql (14 tables + 5 enums). Design notes:

leads vs users split: gate captures never force account creation; conversion links leads.converted_to (preserves pre-signup attribution).
claim_number public id = 'BC-' + year + seq (no uuid leakage).
entitlements UNIQUE(user,pack) -> idempotent grants (webhook retries!).
orders carries BOTH stripe_session and ks_backer_id: KS imports and Stripe sales share fulfillment pipeline; idempotency keys on both.
events table = first-party funnel data; GA4 is reference, not truth.
7. AUTH & SECURITY

Auth.js v5, magic-link email (Resend), JWT sessions, role claim. Middleware: /back-office/* requires moderator|admin; /claim requires auth. Rate limits: /hotline create 10/IP/hr (Redis), /api/board 30/min, signin 5/IP/15min. Zod-validate EVERY input (client+server). CSP: default-src self; media S3; Stripe.js allow-list. Signed S3 URLs, 15-min TTL. Webhook raw-body + signature verification, replay guard via processed_events unique table. Secrets in .env/vault, never in image. GDPR: DSAR endpoint deletes users + rows where email across leads/orders/registrations/claim_tickets (export JSON first).

8. DOCKERFILE (multi-stage, one image, two modes)

FROM node:22-alpine AS deps -> npm ci FROM deps AS build -> next build (output:'standalone') FROM node:22-alpine AS app ARG APP_MODE=web ENV APP_MODE=$APP_MODE NODE_ENV=production COPY --from=build /app/.next/standalone ./ COPY --from=build /app/.next/static ./.next/static COPY --from=build /app/public ./public

ffmpeg present for worker mode: apk add --no-cache ffmpeg

USER node EXPOSE 3000 (web CMD: node server.js | worker CMD: node dist/worker.js)

9. ENV VARS (contract)

DATABASE_URL REDIS_URL S3_ENDPOINT S3_BUCKET S3_KEY S3_SECRET STRIPE_SECRET STRIPE_WEBHOOK_SECRET RESEND_KEY KLAVIYO_KEY NEXT_PUBLIC_GA4 AUTH_SECRET PGPASSWORD MINIO_PASSWORD ADMIN_EMAILS

10. DEPLOY & RUNBOOK

Prod: single VPS (4 vCPU/8GB) or Fly.io machines; compose --profile prod. CI: GitHub Actions: lint,typecheck,prisma migrate deploy on main -> buildx push ghcr.io -> ssh compose pull && up -d. Nightly pg_dump -> S3. Rollback: previous image tag + prisma migrate resolve. SLOs: p95 page <800ms, webhook loss = 0 (idempotent replay), worker backlog <2min alert.
