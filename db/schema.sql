-- SevaGo iOS waitlist schema (PostgreSQL 13+). Idempotent: safe to run more than once.
--   psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS ios_waitlist (
  id                 BIGSERIAL PRIMARY KEY,
  name               TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  contact_type       TEXT        NOT NULL CHECK (contact_type IN ('email', 'phone')),
  -- lower-cased email, or +<country><number> for phones. Unique => no duplicate sign-ups.
  contact_normalized TEXT        NOT NULL CHECK (char_length(contact_normalized) BETWEEN 5 AND 254),
  city               TEXT        NOT NULL CHECK (char_length(city) BETWEEN 2 AND 60),
  consent            BOOLEAN     NOT NULL CHECK (consent IS TRUE),
  consent_text_version TEXT      NOT NULL,
  consent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  source             TEXT,
  utm_source         TEXT,
  utm_medium         TEXT,
  utm_campaign       TEXT,
  user_agent         TEXT,
  ip_hash            TEXT,                -- HMAC of the IP, never the raw IP
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ios_waitlist_contact_uq ON ios_waitlist (contact_normalized);
CREATE INDEX IF NOT EXISTS ios_waitlist_created_idx ON ios_waitlist (created_at);

-- Every submit attempt, used only for rate limiting. Rows older than 7 days are purged by the API.
CREATE TABLE IF NOT EXISTS waitlist_attempts (
  id         BIGSERIAL PRIMARY KEY,
  ip_hash    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS waitlist_attempts_ip_idx ON waitlist_attempts (ip_hash, created_at);

-- Funnel / conversion events (no personal data).
CREATE TABLE IF NOT EXISTS waitlist_events (
  id         BIGSERIAL PRIMARY KEY,
  event      TEXT        NOT NULL,
  platform   TEXT        NOT NULL,
  session_id TEXT        NOT NULL,
  source     TEXT,
  ip_hash    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS waitlist_events_event_idx ON waitlist_events (event, created_at);
CREATE INDEX IF NOT EXISTS waitlist_events_ip_idx ON waitlist_events (ip_hash, created_at);
