-- 2.3.1 Manual QR payments (Maya / MariBank / any QR Ph app): the player pays the owner's QR, sends the reference
-- number, and the OWNER approves it after seeing the money in their own app. payment_ref ("manual:<REF>") stays UNIQUE,
-- so one reference number can only ever be used once.
ALTER TABLE shop_purchases ADD COLUMN payer_note TEXT;
ALTER TABLE shop_purchases ADD COLUMN reviewed_by INTEGER;
ALTER TABLE shop_purchases ADD COLUMN reviewed_at INTEGER;
CREATE INDEX IF NOT EXISTS shop_purchases_status ON shop_purchases(status, created_at);
