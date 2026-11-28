-- 2.9.0 REALITY VS ABSOLUTE.
-- Only NEW tables. No existing row is changed or deleted (the server backs the database up before this runs).
--  * god_mastery: God Mastery of the three Reality Gods (looks and titles only), from verified battles.
--  * coin_purchases: every ball bought with coins in 2.9.0 (The Void Below / The Absolute Above, 50,000 coins each).
--    One row per player and ball: the database itself refuses a second purchase of the same ball.
--  * archon_clears: verified wins against the secret boss THE FRACTURED ARCHON (rewards are given once per battle).
CREATE TABLE IF NOT EXISTS god_mastery (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ball_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  battles INTEGER NOT NULL DEFAULT 0,
  stats TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, ball_id)
);
CREATE TABLE IF NOT EXISTS coin_purchases (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ball_id TEXT NOT NULL,
  coins INTEGER NOT NULL CHECK (coins > 0),
  coins_before INTEGER NOT NULL,
  coins_after INTEGER NOT NULL CHECK (coins_after >= 0),
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, ball_id)
);
CREATE TABLE IF NOT EXISTS archon_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  battle_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  first INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  cleared_at INTEGER NOT NULL,
  UNIQUE (user_id, battle_id)
);
CREATE INDEX IF NOT EXISTS idx_archon_user ON archon_clears (user_id, cleared_at);
INSERT INTO audit_logs (actor_id, action, target, details, created_at)
  SELECT NULL, 'migration.reality_2.9.0', 'reality', json_object('players', (SELECT COUNT(*) FROM users)), CAST(strftime('%s', 'now') AS INTEGER) * 1000;
