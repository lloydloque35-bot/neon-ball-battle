-- NEON BALL BATTLE: ULTIMATE GODS — initial schema
-- All timestamps are Unix epoch milliseconds.

-- ---------- accounts & security ----------
CREATE TABLE users (
  id               INTEGER PRIMARY KEY,
  username         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email            TEXT UNIQUE COLLATE NOCASE,
  pass_hash        TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'owner')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  suspended_until  INTEGER,
  status_reason    TEXT,
  totp_secret      TEXT,
  totp_pending     TEXT,
  totp_enabled     INTEGER NOT NULL DEFAULT 0,
  totp_last_counter INTEGER NOT NULL DEFAULT 0,
  recovery_codes   TEXT NOT NULL DEFAULT '[]',           -- JSON array of sha256 hashes (unused codes)
  failed_logins    INTEGER NOT NULL DEFAULT 0,
  locked_until     INTEGER,
  created_at       INTEGER NOT NULL,
  last_login_at    INTEGER
);
-- Only ONE owner can ever exist (enforced by the database itself).
CREATE UNIQUE INDEX one_owner ON users(role) WHERE role = 'owner';

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,                          -- sha256(session token); the raw token only lives in the HttpOnly cookie
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  mfa_at      INTEGER,                                   -- last successful 2FA verification in this session
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE password_resets (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);

CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY,
  actor_id    INTEGER,
  action      TEXT NOT NULL,
  target      TEXT,
  ip          TEXT,
  details     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX audit_time ON audit_logs(created_at);

CREATE TABLE security_events (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER,
  kind        TEXT NOT NULL,                             -- e.g. battle_mismatch, too_fast, login_lockout, rate_limited
  severity    INTEGER NOT NULL DEFAULT 1,
  details     TEXT,
  ip          TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX security_user ON security_events(user_id, created_at);

-- ---------- player profile & progression (cloud save) ----------
CREATE TABLE profiles (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_ball    TEXT NOT NULL DEFAULT 'fire',
  favorite_ball  TEXT NOT NULL DEFAULT 'fire',
  coins          INTEGER NOT NULL DEFAULT 600 CHECK (coins >= 0),
  exp            INTEGER NOT NULL DEFAULT 0,
  level          INTEGER NOT NULL DEFAULT 1,
  rp             INTEGER NOT NULL DEFAULT 1000,          -- ranking points
  stats          TEXT NOT NULL DEFAULT '{}',             -- JSON battle statistics
  daily_streak   INTEGER NOT NULL DEFAULT 0,
  daily_last     TEXT,                                   -- YYYY-MM-DD (UTC)
  loadout        TEXT NOT NULL DEFAULT '{}',             -- equipped cosmetics
  settings       TEXT NOT NULL DEFAULT '{}',             -- synced game settings
  updated_at     INTEGER NOT NULL
);
CREATE INDEX profiles_rp ON profiles(rp DESC);

CREATE TABLE user_balls (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ball_id     TEXT NOT NULL,
  owned       INTEGER NOT NULL DEFAULT 0,                -- permanently unlocked (never removed)
  level       INTEGER NOT NULL DEFAULT 1,
  exp         INTEGER NOT NULL DEFAULT 0,
  evo         INTEGER NOT NULL DEFAULT 0,
  up          TEXT NOT NULL DEFAULT '{}',
  tree        TEXT NOT NULL DEFAULT '{}',
  sp          INTEGER NOT NULL DEFAULT 1,
  wins        INTEGER NOT NULL DEFAULT 0,
  losses      INTEGER NOT NULL DEFAULT 0,
  source      TEXT,                                      -- starter | purchase | summon | event | grant | fusion
  unlocked_at INTEGER,
  PRIMARY KEY (user_id, ball_id)
);

CREATE TABLE achievements (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ach_id     TEXT NOT NULL,
  done_at    INTEGER NOT NULL,
  claimed_at INTEGER,
  PRIMARY KEY (user_id, ach_id)
);

CREATE TABLE collection_claims (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone  INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, milestone)
);

CREATE TABLE cosmetics_owned (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  source      TEXT,
  PRIMARY KEY (user_id, cosmetic_id)
);

CREATE TABLE fusions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  def         TEXT NOT NULL,
  parents     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX fusions_user ON fusions(user_id);

-- ---------- ball catalog managed by the owner ----------
CREATE TABLE custom_balls (
  id          TEXT PRIMARY KEY,
  def         TEXT NOT NULL,
  published   INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE TABLE ball_overrides (
  ball_id     TEXT PRIMARY KEY,
  def         TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE TABLE ball_flags (
  ball_id     TEXT PRIMARY KEY,
  disabled    INTEGER NOT NULL DEFAULT 0
);

-- ---------- battles (server-verified) ----------
CREATE TABLE battles (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode          TEXT NOT NULL,
  difficulty    TEXT NOT NULL,
  ticket        TEXT NOT NULL,
  catalog       TEXT NOT NULL,                           -- catalog snapshot used for replay verification
  trial         INTEGER NOT NULL DEFAULT 0,
  tournament_id TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'verified', 'rejected', 'abandoned')),
  created_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  result        TEXT,
  rewards       TEXT,
  flags         TEXT
);
CREATE INDEX battles_user ON battles(user_id, created_at);

CREATE TABLE tournaments (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ball_id     TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  state       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'abandoned')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- ---------- limited events ----------
CREATE TABLE limited_events (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  ball_id      TEXT NOT NULL,
  start_at     INTEGER NOT NULL,
  end_at       INTEGER NOT NULL,
  goal         INTEGER NOT NULL DEFAULT 3,
  price        INTEGER NOT NULL DEFAULT 2500,
  premium_only INTEGER NOT NULL DEFAULT 0,
  created_by   INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE TABLE event_progress (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id  TEXT NOT NULL,
  wins      INTEGER NOT NULL DEFAULT 0,
  claimed   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, event_id)
);
CREATE TABLE limited_records (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ball_id     TEXT NOT NULL,
  event_name  TEXT,
  obtained_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, ball_id)
);

-- ---------- premium subscription & payments ----------
CREATE TABLE subscriptions (
  user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan                  TEXT NOT NULL DEFAULT 'ultimate_premium',
  status                TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'pending', 'active', 'expired', 'cancelled', 'refunded', 'payment_failed')),
  provider              TEXT,                            -- stripe | promo
  provider_customer     TEXT,
  provider_subscription TEXT UNIQUE,
  started_at            INTEGER,
  current_period_end    INTEGER,
  auto_renew            INTEGER NOT NULL DEFAULT 0,
  updated_at            INTEGER NOT NULL
);
CREATE TABLE payments (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  provider      TEXT NOT NULL,
  provider_ref  TEXT NOT NULL UNIQUE,                    -- checkout session / invoice / refund id (duplicate protection)
  kind          TEXT NOT NULL CHECK (kind IN ('checkout', 'invoice', 'refund', 'promo')),
  amount_cents  INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'usd',
  status        TEXT NOT NULL,
  description   TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX payments_user ON payments(user_id, created_at);
CREATE TABLE webhook_events (
  id           TEXT PRIMARY KEY,                         -- provider event id: each event is processed exactly once
  type         TEXT NOT NULL,
  received_at  INTEGER NOT NULL,
  processed_at INTEGER,
  error        TEXT
);

-- ---------- misc ----------
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- ---------- online multiplayer preparation (not active yet; see docs/MULTIPLAYER.md) ----------
CREATE TABLE friends (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
CREATE TABLE rooms (
  id         TEXT PRIMARY KEY,
  host_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  mode       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'waiting',
  created_at INTEGER NOT NULL
);
CREATE TABLE matches (
  id         TEXT PRIMARY KEY,
  room_id    TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  seed       INTEGER NOT NULL,
  players    TEXT NOT NULL,
  inputs     TEXT,
  result     TEXT,
  created_at INTEGER NOT NULL
);
