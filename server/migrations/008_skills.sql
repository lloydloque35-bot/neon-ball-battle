-- 2.6.0 ULTIMATE UNIQUE SKILL, MASTERY & EVOLUTION SYSTEM. Only new tables: existing rows are never changed.
--  * skill_mastery: mastery XP per player and ability, earned only from server-verified battles (looks and titles only)
--  * skill_evolution: the evolution stage a player has unlocked for an ability (requirements checked on the server)
--  * skill_evolution_log: every evolution with its coin cost (append-only)
--  * admin_skills: the owner's skill management (edits of existing abilities, owner-made abilities, global settings)
CREATE TABLE IF NOT EXISTS skill_mastery (
  user_id     INTEGER NOT NULL REFERENCES users(id),
  ball_id     TEXT NOT NULL,
  skill_uid   TEXT NOT NULL,
  xp          INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  uses        INTEGER NOT NULL DEFAULT 0,
  battles     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, skill_uid)
);
CREATE INDEX IF NOT EXISTS skill_mastery_ball ON skill_mastery(user_id, ball_id);
CREATE TABLE IF NOT EXISTS skill_evolution (
  user_id     INTEGER NOT NULL REFERENCES users(id),
  ball_id     TEXT NOT NULL,
  skill_uid   TEXT NOT NULL,
  stage       INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 3),
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, skill_uid)
);
CREATE TABLE IF NOT EXISTS skill_evolution_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  ball_id     TEXT NOT NULL,
  skill_uid   TEXT NOT NULL,
  stage       INTEGER NOT NULL,
  coins       INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS skill_evolution_log_no_update BEFORE UPDATE ON skill_evolution_log BEGIN SELECT RAISE(ABORT, 'the evolution log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS skill_evolution_log_no_delete BEFORE DELETE ON skill_evolution_log BEGIN SELECT RAISE(ABORT, 'the evolution log is append-only'); END;
CREATE TABLE IF NOT EXISTS admin_skills (
  skill_uid   TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('override', 'custom', 'config')),
  ball_id     TEXT,
  data        TEXT NOT NULL,
  updated_by  INTEGER,
  updated_at  INTEGER NOT NULL
);
