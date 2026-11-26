'use strict';
/**
 * 2.3.1 MANUAL QR PAYMENTS (Maya / MariBank / any QR Ph app).
 * The player pays the owner's QR and sends the reference number; ONLY the owner's approval (owner + 2FA) unlocks the ball.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const S_ = require('../security');
const { startServer, Client } = require('./helpers');
const { createOwner, confirmTotp } = require('../cli/owner');
const { parseQrImage, normRef } = require('../shop');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let srv, owner, buyer, buyer2, guest, secret, ctr;
const nextCode = () => S_.totpCode(secret, ++ctr);
const owns = (c, ball) => { const u = srv.db.get('SELECT id FROM users WHERE username = ?', c.name); return !!srv.db.get('SELECT 1 FROM user_balls WHERE user_id = ? AND ball_id = ? AND owned = 1', u.id, ball); };

test.before(async () => {
  srv = await startServer({ shop: { secretKey: '', webhookSecret: '', methods: ['gcash'], liveConfirmed: false, apiBase: 'http://127.0.0.1:9' } });
  await createOwner(srv.db, { username: 'Boss', password: 'Owner-Pass-9876!' });
  const pending = srv.db.get("SELECT totp_pending FROM users WHERE role = 'owner'").totp_pending;
  ctr = Math.floor(Date.now() / 30000) - 1;
  assert.ok(confirmTotp(srv.db, S_.totpCode(pending, ctr))); secret = pending;
  owner = new Client(srv.base);
  assert.equal((await owner.post('/api/auth/login', { username: 'Boss', password: 'Owner-Pass-9876!', code: nextCode() })).status, 200);
  buyer = new Client(srv.base); buyer.name = 'qr_buyer'; await buyer.register(buyer.name);
  buyer2 = new Client(srv.base); buyer2.name = 'qr_buyer2'; await buyer2.register(buyer2.name);
  guest = new Client(srv.base); await guest.get('/api/auth/me');
});
test.after(async () => { await srv.stop(); });

test('closed until the owner sets it up: no QR, nothing can be sent or granted', async () => {
  const s = (await buyer.get('/api/godshop')).data;
  assert.equal(s.enabled, false); assert.equal(s.manual.enabled, false); assert.deepEqual(s.manual.accounts, []);
  assert.equal((await buyer.post('/api/godshop/manual/submit', { product: 'godofguns', account: 'x', reference: '123456789012' })).status, 503);
  assert.equal(srv.db.get('SELECT COUNT(*) AS n FROM shop_purchases').n, 0);
});

test('only the owner can set up accounts, upload QR codes, approve or reject', async () => {
  assert.ok([401, 403].includes((await buyer.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: [{ kind: 'maya' }] })).status));
  assert.ok([401, 403].includes((await buyer.post('/api/admin/godshop/manual/qr', { account: 'x', image: PNG })).status));
  assert.ok([401, 403].includes((await buyer.post('/api/admin/godshop/manual/pur_x/approve')).status));
  assert.ok([401, 403].includes((await buyer.post('/api/admin/godshop/manual/pur_x/reject')).status));
  assert.ok([401, 403].includes((await guest.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: [] })).status));
});

test('owner setup: accounts, real images only, cannot open without a QR', async () => {
  let r = await owner.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: [{ kind: 'maya', name: 'L. L.' }] });
  assert.equal(r.status, 400, 'no QR yet → cannot open');
  r = await owner.post('/api/admin/godshop/manual/settings', { enabled: false, accounts: [{ kind: 'maya', name: 'L. L.', note: 'Send exactly PHP 99' }, { kind: 'maribank', name: 'L. L.' }] });
  assert.equal(r.status, 200); const [maya, mari] = r.data.manual.accounts;
  assert.equal(maya.kindName, 'Maya'); assert.equal(mari.kindName, 'MariBank');
  assert.equal((await owner.post('/api/admin/godshop/manual/settings', { enabled: false, accounts: [{ kind: 'paypal' }] })).status, 400);
  // fake or oversized images are refused
  assert.equal((await owner.post('/api/admin/godshop/manual/qr', { account: maya.id, image: 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>'.repeat(4)).toString('base64') })).status, 400);
  assert.equal((await owner.post('/api/admin/godshop/manual/qr', { account: maya.id, image: 'data:text/html;base64,PGgxPmhpPC9oMT4=' })).status, 400);
  assert.equal((await owner.post('/api/admin/godshop/manual/qr', { account: maya.id, image: 'data:image/png;base64,' + Buffer.alloc(420 * 1024, 1).toString('base64') })).status, 400);
  assert.equal((await owner.post('/api/admin/godshop/manual/qr', { account: maya.id, image: PNG })).status, 200);
  assert.equal((await owner.post('/api/admin/godshop/manual/qr', { account: mari.id, image: PNG })).status, 200);
  // saving again keeps the uploaded QR codes; then turn it on
  r = await owner.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: [{ id: maya.id, kind: 'maya', name: 'L. L.', note: 'Send exactly PHP 99' }, { id: mari.id, kind: 'maribank', name: 'L. L.' }] });
  assert.equal(r.status, 200); assert.equal(r.data.manual.open, true); assert.ok(r.data.manual.accounts.every(a => a.hasQr));
  // the QR and account details are only for signed-in players, never in the public shop data
  const pub = (await guest.get('/api/godshop')).data; assert.equal(pub.manual.enabled, true); assert.deepEqual(pub.manual.accounts, []);
  assert.equal((await guest.get('/api/godshop/manual/qr/' + maya.id)).status, 401);
  const s = (await buyer.get('/api/godshop')).data;
  assert.equal(s.enabled, true); assert.equal(s.paymongo, false); assert.deepEqual(s.manual.accounts.map(a => a.kind), ['maya', 'maribank']);
  assert.ok(!JSON.stringify(s).includes('base64'), 'no QR image in the shop list');
  const q = (await buyer.get('/api/godshop/manual/qr/' + maya.id)).data; assert.equal(q.image, PNG);
  assert.equal(srv.db.get("SELECT COUNT(*) AS n FROM audit_logs WHERE action LIKE 'admin.shop_manual%'").n >= 3, true, 'setup is audit-logged');
});

test('player sends a reference: nothing unlocks until the owner approves; one reference = one payment', async () => {
  const s = (await buyer.get('/api/godshop')).data, maya = s.manual.accounts[0];
  assert.equal((await buyer.post('/api/godshop/manual/submit', { product: 'godofguns', account: maya.id, reference: '12' })).status, 400, 'too short');
  assert.equal((await buyer.post('/api/godshop/manual/submit', { product: 'godofguns', account: 'qa_nope', reference: '123456789012' })).status, 400, 'unknown account');
  assert.equal((await buyer.post('/api/godshop/manual/submit', { product: 'nope', account: maya.id, reference: '123456789012' })).status, 400);
  const r = await buyer.post('/api/godshop/manual/submit', { product: 'godofguns', account: maya.id, reference: '1234 5678 9012', note: 'Juan D. 0917' });
  assert.equal(r.status, 200); assert.equal(r.data.purchase.status, 'awaiting'); assert.equal(r.data.purchase.reference, '123456789012');
  // the "sent" screen grants NOTHING
  assert.equal(owns(buyer, 'godofguns'), false);
  assert.equal((await buyer.post('/api/battle/start', { mode: '1v1', ball: 'godofguns' })).status, 403);
  assert.equal((await buyer.post('/api/godshop/restore')).data.owned.includes('godofguns'), false, 'restore does not unlock a waiting payment');
  assert.equal((await buyer.post(`/api/godshop/purchases/${r.data.purchase.id}/check`)).data.purchase.status, 'awaiting');
  // no second report for the same ball while one is waiting, no bundle either
  assert.equal((await buyer.post('/api/godshop/manual/submit', { product: 'godofguns', account: maya.id, reference: '999999999999' })).status, 409);
  assert.equal((await buyer.post('/api/godshop/manual/submit', { product: 'god_bundle', account: maya.id, reference: '999999999999' })).status, 409);
  // the same reference (any spacing / dashes / case) can never be used again, by anyone
  const dup = await buyer2.post('/api/godshop/manual/submit', { product: 'godofguns', account: maya.id, reference: '1234-5678-9012' });
  assert.equal(dup.status, 409); assert.equal(dup.data.code, 'REF_USED');
  assert.ok(srv.db.get("SELECT 1 FROM security_events WHERE kind = 'shop_manual_ref_reused'"));
  // history shows it to the player as waiting
  const h = (await buyer.get('/api/godshop/purchases')).data.purchases[0];
  assert.equal(h.status, 'awaiting'); assert.equal(h.methodName, 'Maya (QR)'); assert.equal(h.reference, '123456789012');
  // the owner sees it in the waiting list
  const a = (await owner.get('/api/admin/godshop')).data;
  assert.equal(a.manual.awaiting.length, 1); assert.equal(a.manual.awaiting[0].username, 'qr_buyer'); assert.equal(a.manual.awaiting[0].payerNote, 'Juan D. 0917');
  assert.equal((await owner.get('/api/godshop')).data.awaitingCount, 1);
  assert.equal((await buyer.get('/api/godshop')).data.awaitingCount, undefined, 'players never see the owner queue');
});

test('owner approves → permanent ownership; approving twice does nothing more', async () => {
  const p = (await owner.get('/api/admin/godshop')).data.manual.awaiting[0];
  const r = await owner.post(`/api/admin/godshop/manual/${p.id}/approve`);
  assert.equal(r.status, 200); assert.equal(r.data.purchase.status, 'paid');
  assert.equal(owns(buyer, 'godofguns'), true);
  assert.equal((await buyer.post('/api/battle/start', { mode: '1v1', ball: 'godofguns' })).status, 200);
  assert.equal((await owner.post(`/api/admin/godshop/manual/${p.id}/approve`)).status, 409);
  assert.equal((await owner.post(`/api/admin/godshop/manual/${p.id}/reject`)).status, 400, 'an approved payment cannot be rejected');
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'shop.manual_approved' AND target = ?", p.id));
  // already owned → cannot report another payment for it
  const maya = (await buyer.get('/api/godshop')).data.manual.accounts[0];
  assert.equal((await buyer.post('/api/godshop/manual/submit', { product: 'godofguns', account: maya.id, reference: 'ABC123456' })).status, 409);
  assert.equal((await buyer.post('/api/godshop/manual/submit', { product: 'god_bundle', account: maya.id, reference: 'ABC123456' })).status, 409);
  // ownership survives "restore" and shows in the shop list
  assert.ok((await buyer.post('/api/godshop/restore')).data.owned.includes('godofguns'));
  assert.equal((await buyer.get('/api/godshop')).data.products.find(x => x.id === 'godofguns').owned, true);
});

test('owner rejects → nothing granted, the reference stays blocked; the owner can still approve it later', async () => {
  const mari = (await buyer2.get('/api/godshop')).data.manual.accounts[1];
  const r = await buyer2.post('/api/godshop/manual/submit', { product: 'god_bundle', account: mari.id, reference: 'mb20261126x1' });
  assert.equal(r.status, 200);
  const rj = await owner.post(`/api/admin/godshop/manual/${r.data.purchase.id}/reject`, { reason: 'No payment with this number in my MariBank' });
  assert.equal(rj.status, 200); assert.equal(rj.data.purchase.status, 'rejected');
  assert.equal(owns(buyer2, 'godportal'), false);
  const h = (await buyer2.get('/api/godshop/purchases')).data.purchases[0];
  assert.equal(h.status, 'rejected'); assert.equal(h.note, 'No payment with this number in my MariBank');
  assert.equal((await buyer2.post('/api/godshop/manual/submit', { product: 'god_bundle', account: mari.id, reference: 'MB20261126X1' })).status, 409, 'rejected reference cannot be reused');
  // the owner found the money after all: approving the rejected one grants both balls of the bundle
  assert.equal((await owner.post(`/api/admin/godshop/manual/${r.data.purchase.id}/approve`)).status, 200);
  assert.equal(owns(buyer2, 'godportal'), true); assert.equal(owns(buyer2, 'godofguns'), true);
});

test('owner turning QR payments off closes them at once; helpers validate input', async () => {
  const a = (await owner.get('/api/admin/godshop')).data.manual;
  assert.equal((await owner.post('/api/admin/godshop/manual/settings', { enabled: false, accounts: a.accounts })).status, 200);
  const s = (await buyer.get('/api/godshop')).data; assert.equal(s.manual.enabled, false); assert.equal(s.enabled, false);
  assert.equal((await buyer.post('/api/godshop/manual/submit', { product: 'godportal', account: a.accounts[0].id, reference: 'ZZZ999999' })).status, 503);
  assert.equal((await buyer.get('/api/godshop/manual/qr/' + a.accounts[0].id)).status, 404);
  assert.equal(normRef(' ab-12 34 cd '), 'AB1234CD');
  assert.throws(() => parseQrImage('data:image/jpeg;base64,' + Buffer.from('not a jpeg at all, just some text that is long enough to pass the size check').toString('base64')));
  assert.equal(parseQrImage(PNG), PNG);
});

test('ULTIMATE PREMIUM by QR: owner-set PHP price, nothing before approval, approve = 365 days (adds to an active year), no auto-renew', async () => {
  const fan = new Client(srv.base); fan.name = 'prem_fan'; await fan.register(fan.name);
  const a = (await owner.get('/api/admin/godshop')).data.manual;
  assert.equal(a.premiumPrice, 499, 'default PHP 499');
  assert.equal((await owner.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: a.accounts, premiumPricePhp: 5 })).status, 400, 'too cheap');
  assert.equal((await owner.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: a.accounts, premiumPricePhp: 499.5 })).status, 400, 'whole pesos only');
  assert.equal((await fan.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: a.accounts, premiumPricePhp: 1 })).status, 403, 'players cannot set the price');
  assert.equal((await owner.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: a.accounts, premiumPricePhp: 499 })).status, 200);
  const st = (await fan.get('/api/billing/status')).data;
  assert.deepEqual([st.qr.enabled, st.qr.price, st.qr.days], [true, 499, 365]); assert.equal(st.subscription.active, false);
  const shop = (await fan.get('/api/godshop')).data; assert.equal(shop.premium.price, 499);
  const acc = shop.manual.accounts[0].id;
  assert.equal((await owner.post('/api/godshop/manual/submit', { product: 'premium_year', account: acc, reference: 'OWNER12345' })).status, 400, 'owner needs nothing');
  const r = await fan.post('/api/godshop/manual/submit', { product: 'premium_year', account: acc, reference: 'PREM 2026 0001' });
  assert.equal(r.status, 200); assert.equal(r.data.purchase.amount, 499); assert.equal(r.data.purchase.name, 'ULTIMATE PREMIUM — 1 year');
  assert.equal((await fan.get('/api/billing/status')).data.subscription.active, false, 'nothing before approval');
  assert.equal((await fan.post('/api/godshop/manual/submit', { product: 'premium_year', account: acc, reference: 'PREM20260002' })).status, 409, 'one waiting premium payment at a time');
  // a waiting Premium payment does not block buying a ball, and vice versa
  const gp = await fan.post('/api/godshop/manual/submit', { product: 'godportal', account: acc, reference: 'GP20260001' });
  assert.equal(gp.status, 200);
  // a price change later does not change what this player was asked to pay
  await owner.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: a.accounts, premiumPricePhp: 599 });
  assert.equal((await owner.post(`/api/admin/godshop/manual/${r.data.purchase.id}/approve`)).status, 200);
  let sub = (await fan.get('/api/billing/status')).data;
  assert.equal(sub.subscription.active, true); assert.equal(sub.subscription.autoRenew, false); assert.equal(sub.subscription.provider, 'qr');
  assert.ok(sub.subscription.remainingDays >= 364 && sub.subscription.remainingDays <= 365);
  assert.ok(sub.history.some(h => h.currency === 'PHP' && h.amount === 499 && h.status === 'paid'));
  assert.equal(owns(fan, 'godportal'), false, 'Premium never includes the paid God Balls');
  // a second year adds to the end of the first
  const r2 = await fan.post('/api/godshop/manual/submit', { product: 'premium_year', account: acc, reference: 'PREM20260003' });
  assert.equal(r2.data.purchase.amount, 599);
  await owner.post(`/api/admin/godshop/manual/${r2.data.purchase.id}/approve`);
  sub = (await fan.get('/api/billing/status')).data.subscription; assert.ok(sub.remainingDays >= 729 && sub.remainingDays <= 730, String(sub.remainingDays));
  assert.equal((await owner.post(`/api/admin/godshop/manual/${r2.data.purchase.id}/approve`)).status, 409, 'cannot add a year twice');
  await owner.post(`/api/admin/godshop/manual/${gp.data.purchase.id}/approve`); assert.equal(owns(fan, 'godportal'), true);
});
