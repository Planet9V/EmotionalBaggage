-- BAGGAGE CLAIMS MK1 - Postgres 16 schema (Prisma-ready DDL), Rev A
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role      AS ENUM ('fan','moderator','admin');
CREATE TYPE order_source   AS ENUM ('web','kickstarter','gate_desk','wholesale');
CREATE TYPE order_status   AS ENUM ('pending','paid','fulfilled','cancelled','refunded');
CREATE TYPE ticket_state   AS ENUM ('pending_review','approved','rejected');
CREATE TYPE referral_state AS ENUM ('pending','verified','rewarded','flagged');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  role          user_role NOT NULL DEFAULT 'fan',
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE leads (                       -- pre-signup gate captures
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  source        text NOT NULL,             -- gate | hotline | board | shame_ad
  utm           jsonb, consent_eu boolean NOT NULL DEFAULT false,
  converted_to  uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE claim_tickets (               -- Lost Baggage Hotline
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number  text UNIQUE NOT NULL,      -- e.g. BC-2026-04811
  lead_id       uuid REFERENCES leads(id),
  location      text NOT NULL,             -- airport/zones
  insult        text NOT NULL,
  trauma        smallint NOT NULL CHECK (trauma BETWEEN 1 AND 5),
  audio_key     text, image_key text,      -- S3 objects (worker-rendered)
  status        ticket_state NOT NULL DEFAULT 'pending_review',
  age_attested  boolean NOT NULL DEFAULT false,
  reuse_license boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE referrals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   uuid NOT NULL REFERENCES users(id),
  referee_email citext NOT NULL, UNIQUE(referrer_id, referee_email),
  status        referral_state NOT NULL DEFAULT 'pending',
  milestone     smallint NOT NULL DEFAULT 0,   -- 0/3/10/25
  verified_at   timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE units (
  serial        text PRIMARY KEY,          -- printed on compliance card
  sku           text NOT NULL, batch text NOT NULL,
  mfg_date      date, voice_pack_default smallint NOT NULL DEFAULT 1
);
CREATE TABLE products (
  sku  text PRIMARY KEY, name text NOT NULL, kind text NOT NULL,   -- unit|pack|bundle
  price_cents int NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE voice_packs (
  sku         text PRIMARY KEY REFERENCES products(sku),
  folder_name text NOT NULL,               -- /01 /02 /03 map
  clip_map    jsonb NOT NULL,              -- event->clip numbering
  file_key    text NOT NULL                -- S3 zip for digital fulfillment
);
CREATE TABLE orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id),
  email         citext NOT NULL,
  source        order_source NOT NULL DEFAULT 'web',
  status        order_status NOT NULL DEFAULT 'pending',
  stripe_session text, ks_backer_id text,  -- one of these set, not both
  total_cents   int NOT NULL, currency char(3) NOT NULL DEFAULT 'USD',
  created_at    timestamptz NOT NULL DEFAULT now(),
  fulfilled_at  timestamptz
);
CREATE TABLE order_items (
  order_id  uuid REFERENCES orders(id) ON DELETE CASCADE,
  sku       text REFERENCES products(sku), qty int NOT NULL,
  unit_price_cents int NOT NULL, PRIMARY KEY (order_id, sku)
);
CREATE TABLE entitlements (                -- DLC grants (paid, free, KS, promo)
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  pack_sku   text NOT NULL REFERENCES voice_packs(sku),
  source     text NOT NULL,                -- purchase|registration|ks_stretch
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, pack_sku)
);
CREATE TABLE registrations (               -- Platinum Status QR flow
  unit_serial  text PRIMARY KEY REFERENCES units(serial),
  user_id      uuid NOT NULL REFERENCES users(id),
  channel      text NOT NULL, travel_freq smallint,
  registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE wholesale_leads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company    text NOT NULL, contact_email citext NOT NULL,
  channel_type text NOT NULL, est_doors int,
  stage      text NOT NULL DEFAULT 'new', notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE events (                      -- first-party analytics
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid, session_id text, kind text NOT NULL, props jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_kind   ON events(kind, created_at);
CREATE INDEX idx_orders_email  ON orders(email);
CREATE INDEX idx_tickets_state ON claim_tickets(status);
