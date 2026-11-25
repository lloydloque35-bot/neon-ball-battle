-- Online PvP matches (real-time, deterministic lockstep; the server re-simulates every match)
CREATE TABLE pvp_matches (
  id           TEXT PRIMARY KEY,
  ranked       INTEGER NOT NULL DEFAULT 0,
  p1_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  p2_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ball1        TEXT NOT NULL,
  ball2        TEXT NOT NULL,
  ticket       TEXT NOT NULL,
  catalog      TEXT NOT NULL,
  inputs       TEXT,
  delay_blocks INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',      -- active | done | error
  winner_slot  INTEGER,                             -- 0, 1, or -1 for a draw
  result       TEXT,
  changes      TEXT,                                -- rank points / rewards applied
  flags        TEXT,
  created_at   INTEGER NOT NULL,
  finished_at  INTEGER
);
CREATE INDEX pvp_matches_p1 ON pvp_matches(p1_id, finished_at);
CREATE INDEX pvp_matches_p2 ON pvp_matches(p2_id, finished_at);
