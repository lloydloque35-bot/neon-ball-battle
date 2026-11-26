-- 2.8.0 ANTI BALL — LIMITED EDITION (100 copies worldwide, serials ANTI-001 … ANTI-100, PHP 999).
-- Anti Ball was free for everyone before. From now on only verified buyers (edition_owners) can use it.
--  * Rows that were marked as owned (for example from a summon orb while it was free) are locked again. Their levels,
--    EXP, skill tree, wins and losses are KEPT: they come back if that player buys a copy.
--  * The old source is kept inside the new source text so nothing is lost.
--  * Only the 'anti' rows of user_balls change. Nothing is deleted.
INSERT INTO audit_logs (actor_id, action, target, details, created_at)
  SELECT NULL, 'migration.anti_locked', 'anti', json_object('rows', (SELECT COUNT(*) FROM user_balls WHERE ball_id = 'anti' AND owned = 1)), CAST(strftime('%s', 'now') AS INTEGER) * 1000;
UPDATE user_balls
   SET owned = 0,
       source = 'locked_2.8:' || COALESCE(source, '')
 WHERE ball_id = 'anti' AND owned = 1
   AND user_id NOT IN (SELECT user_id FROM edition_owners WHERE ball_id = 'anti');
