-- 2.3.0 Premium God Ball Shop: one-time PHP purchases through PayMongo (server-verified, permanent ownership)
CREATE TABLE IF NOT EXISTS shop_purchases (
  id            TEXT PRIMARY KEY,                       -- pur_... (also the PayMongo reference_number)
  user_id       INTEGER NOT NULL REFERENCES users(id),
  product       TEXT NOT NULL,                          -- godofguns | godportal | god_bundle
  balls         TEXT NOT NULL,                          -- JSON list of ball ids granted
  amount        INTEGER NOT NULL,                       -- centavos (PHP 99 = 9900)
  currency      TEXT NOT NULL,
  provider      TEXT NOT NULL,
  provider_ref  TEXT UNIQUE,                            -- PayMongo checkout session id
  checkout_url  TEXT,
  status        TEXT NOT NULL,                          -- creating | pending | paid | expired | failed | review
  payment_ref   TEXT UNIQUE,                            -- PayMongo payment id: one payment completes one purchase
  method        TEXT,
  livemode      INTEGER,
  note          TEXT,
  created_at    INTEGER NOT NULL,
  paid_at       INTEGER,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS shop_purchases_user ON shop_purchases(user_id, created_at);
CREATE TABLE IF NOT EXISTS shop_events (id TEXT PRIMARY KEY, type TEXT, received_at INTEGER NOT NULL, processed_at INTEGER, error TEXT);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
