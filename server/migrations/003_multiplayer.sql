-- Online multiplayer: 2 VS 2, 5-player arena and co-op vs AI; season rank tiers; Premium monthly coins
ALTER TABLE pvp_matches ADD COLUMN mode TEXT NOT NULL DEFAULT 'duel';

-- every human player of an online match (1v1 matches already played are copied in)
CREATE TABLE pvp_match_players (
  match_id   TEXT NOT NULL REFERENCES pvp_matches(id) ON DELETE CASCADE,
  slot       INTEGER NOT NULL,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ball       TEXT NOT NULL,
  team       INTEGER NOT NULL,
  PRIMARY KEY (match_id, slot)
);
CREATE INDEX pvp_match_players_user ON pvp_match_players(user_id);
INSERT INTO pvp_match_players (match_id, slot, user_id, ball, team) SELECT id, 0, p1_id, ball1, 0 FROM pvp_matches;
INSERT INTO pvp_match_players (match_id, slot, user_id, ball, team) SELECT id, 1, p2_id, ball2, 1 FROM pvp_matches;

-- monthly ranked seasons: season points decide the tier (Bronze … Legend)
CREATE TABLE season_ranks (
  season          TEXT NOT NULL,                         -- 'YYYY-MM' (UTC)
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points          INTEGER NOT NULL DEFAULT 0,
  peak            INTEGER NOT NULL DEFAULT 0,
  wins            INTEGER NOT NULL DEFAULT 0,
  losses          INTEGER NOT NULL DEFAULT 0,
  draws           INTEGER NOT NULL DEFAULT 0,
  matches         INTEGER NOT NULL DEFAULT 0,
  reward_claimed  INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (season, user_id)
);
CREATE INDEX season_ranks_board ON season_ranks(season, points DESC);

-- Ultimate Premium: free coins once per calendar month
CREATE TABLE premium_monthly_coins (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  coins       INTEGER NOT NULL,
  claimed_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, month)
);
