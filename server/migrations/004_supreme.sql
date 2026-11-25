-- 2.1.0 Supreme Admin Balls: owner tuning from the Admin Ball Control Panel
-- (cooldown multiplier, switched-off abilities, effect intensity, aura). Applied to every battle through the catalog snapshot.
CREATE TABLE IF NOT EXISTS admin_ball_tuning (
  ball_id     TEXT PRIMARY KEY,
  settings    TEXT NOT NULL,
  updated_by  INTEGER,
  updated_at  INTEGER NOT NULL
);
