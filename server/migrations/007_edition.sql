-- 2.4.0 GOD OF ABSOLUTE — LIMITED EDITION (PHP 499). The database itself enforces the edition's rules:
--  * one serial number per owner and per ball (PRIMARY KEY (ball_id, serial), UNIQUE (ball_id, user_id), UNIQUE purchase)
--  * ownership rows and the edition ledger can never be changed or deleted (triggers)
ALTER TABLE shop_purchases ADD COLUMN hold_until INTEGER;            -- slot reserved for an unpaid purchase until this time
CREATE INDEX IF NOT EXISTS shop_purchases_product ON shop_purchases(product, status);
CREATE TABLE IF NOT EXISTS edition_owners (
  ball_id      TEXT NOT NULL,
  serial       INTEGER NOT NULL CHECK (serial >= 1),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  purchase_id  TEXT NOT NULL UNIQUE,
  edition      INTEGER NOT NULL,
  granted_at   INTEGER NOT NULL,
  PRIMARY KEY (ball_id, serial),
  UNIQUE (ball_id, user_id)
);
CREATE TABLE IF NOT EXISTS edition_ledger (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ball_id      TEXT NOT NULL,
  event        TEXT NOT NULL,          -- reserve | release | rehold | grant | sold_out_refund | restore | settings | new_edition
  user_id      INTEGER,
  purchase_id  TEXT,
  actor_id     INTEGER,
  details      TEXT,
  at           INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS edition_owners_no_update BEFORE UPDATE ON edition_owners BEGIN SELECT RAISE(ABORT, 'edition ownership is permanent'); END;
CREATE TRIGGER IF NOT EXISTS edition_owners_no_delete BEFORE DELETE ON edition_owners BEGIN SELECT RAISE(ABORT, 'edition ownership is permanent'); END;
CREATE TRIGGER IF NOT EXISTS edition_ledger_no_update BEFORE UPDATE ON edition_ledger BEGIN SELECT RAISE(ABORT, 'the edition ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS edition_ledger_no_delete BEFORE DELETE ON edition_ledger BEGIN SELECT RAISE(ABORT, 'the edition ledger is append-only'); END;
