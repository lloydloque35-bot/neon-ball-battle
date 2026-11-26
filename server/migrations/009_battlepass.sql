-- 2.7.0 BATTLE PASS & COIN PACKS
--  * The four Supreme God Balls (God of Chaos, God of War, AI Tech, Solar Eclipse) are no longer free: they come with
--    the Battle Pass (PHP 299, one-time). Players who had ALREADY played or upgraded one of them (a progress row exists)
--    keep it forever: it is marked as owned here, once. Nothing else in user_balls changes.
--  * Coin packs (PHP 99 = 10,000 coins, PHP 999 = 1,000,000 coins): shop_purchases.coins records how many coins a
--    purchase adds; they are added once, in the same transaction that marks the purchase paid.
UPDATE user_balls
   SET owned = 1,
       source = COALESCE(source, 'kept_free_2.2'),
       unlocked_at = COALESCE(unlocked_at, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
 WHERE owned = 0 AND ball_id IN ('godofchaos', 'godofwar', 'aitech', 'solareclipse');
ALTER TABLE shop_purchases ADD COLUMN coins INTEGER;
INSERT INTO audit_logs (actor_id, action, target, details, created_at)
  SELECT NULL, 'migration.battlepass_kept', 'battlepass', json_object('rows', (SELECT COUNT(*) FROM user_balls WHERE source = 'kept_free_2.2')), CAST(strftime('%s', 'now') AS INTEGER) * 1000;
