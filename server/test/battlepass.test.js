'use strict';
/**
 * 2.7.0 BATTLE PASS & COIN PACKS
 *  - God of Chaos, God of War, AI Tech and Solar Eclipse are no longer free: Battle Pass, PHP 299, one-time, owned forever.
 *  - Players who had already played them keep them (migration 009). Anti Ball stays free (the Free Pass).
 *  - Coin packs: PHP 99 = 10,000 coins, PHP 999 = 1,000,000 coins, added exactly once per verified payment.
 * Ownership and coins come only from a server-verified PayMongo payment or the owner's approval of a QR payment.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const S_ = require('../security');
const { startServer, Client } = require('./helpers');
const { createOwner, confirmTotp } = require('../cli/owner');
const { loadCore } = require('../core');
const { DB } = require('../db');
const { PRODUCTS } = require('../shop');

const core = loadCore(); core.setCatalog(null);
const PASS = ['godofchaos', 'godofwar', 'aitech', 'solareclipse'];
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/* ---------------- a fake PayMongo API (same behaviour as the real one for what the server uses) ---------------- */
function fakePaymongo() {
  const sessions = new Map(); let n = 0;
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
      const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (!/^Basic /.test(req.headers.authorization || '')) return send(401, { errors: [{ code: 'unauthorized' }] });
      if (req.method === 'POST' && req.url === '/v1/checkout_sessions') { const a = JSON.parse(body).data.attributes, id = 'cs_bp_' + (++n);
        sessions.set(id, { id, attributes: { ...a, checkout_url: 'https://checkout.paymongo.com/' + id, status: 'active', payments: [], livemode: false } }); return send(200, { data: sessions.get(id) }); }
      const m = req.url.match(/^\/v1\/checkout_sessions\/(.+)$/); if (req.method === 'GET' && m) { const s = sessions.get(decodeURIComponent(m[1])); return s ? send(200, { data: s }) : send(404, { errors: [{ code: 'not_found' }] }); }
      send(404, {});
    });
  });
  return { srv, sessions, pay(id, amount) { const s = sessions.get(id); s.attributes.payments.push({ id: 'pay_' + id + '_' + s.attributes.payments.length, attributes: { status: 'paid', amount, currency: 'PHP', source: { type: 'gcash' } } }); s.attributes.status = 'completed'; } };
}
const SECRET = 'whsk_bp_secret';
const paidEvent = sid => ({ data: { id: 'evt_' + crypto.randomBytes(4).toString('hex'), type: 'event', attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: sid, type: 'checkout_session' } } } });
async function webhook(base, evt) {
  const raw = JSON.stringify(evt), t = Math.floor(Date.now() / 1000), sig = `t=${t},te=${crypto.createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex')},li=`;
  const r = await fetch(base + '/api/godshop/webhook/paymongo', { method: 'POST', headers: { 'content-type': 'application/json', 'paymongo-signature': sig }, body: raw });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

let pm, srv, owner, secret, ctr;
const nextCode = () => S_.totpCode(secret, ++ctr);
const uid = c => srv.db.get('SELECT id FROM users WHERE username = ?', c.name).id;
const owns = (c, ball) => !!srv.db.get('SELECT 1 FROM user_balls WHERE user_id = ? AND ball_id = ? AND owned = 1', uid(c), ball);
const coins = c => srv.db.get('SELECT coins FROM profiles WHERE user_id = ?', uid(c)).coins;
async function player(name) { const c = new Client(srv.base); c.name = name; await c.register(name); return c; }

test.before(async () => {
  pm = fakePaymongo(); await new Promise(r => pm.srv.listen(0, '127.0.0.1', r));
  srv = await startServer({ shop: { secretKey: 'sk_test_fake', webhookSecret: SECRET, methods: ['gcash', 'paymaya', 'qrph'], liveConfirmed: false, apiBase: `http://127.0.0.1:${pm.srv.address().port}` } });
  await createOwner(srv.db, { username: 'Boss', password: 'Owner-Pass-9876!' });
  const pending = srv.db.get("SELECT totp_pending FROM users WHERE role = 'owner'").totp_pending;
  ctr = Math.floor(Date.now() / 30000) - 1; assert.ok(confirmTotp(srv.db, S_.totpCode(pending, ctr))); secret = pending;
  owner = new Client(srv.base);
  assert.equal((await owner.post('/api/auth/login', { username: 'Boss', password: 'Owner-Pass-9876!', code: nextCode() })).status, 200);
  // the owner turns on QR payments with one Maya QR
  let r = await owner.post('/api/admin/godshop/manual/settings', { enabled: false, accounts: [{ kind: 'maya', name: 'JUAN D.' }] }); assert.equal(r.status, 200);
  const acc = r.data.manual.accounts[0];
  assert.equal((await owner.post('/api/admin/godshop/manual/qr', { account: acc.id, image: PNG })).status, 200);
  assert.equal((await owner.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: [{ id: acc.id, kind: 'maya', name: 'JUAN D.' }] })).status, 200);
});
test.after(async () => { await srv.stop(); pm.srv.close(); });

test('the four Supreme God Balls are Battle Pass balls (Anti Ball became a limited edition in 2.8.0)', () => {
  assert.deepEqual([...core.BATTLE_PASS.balls], PASS); assert.equal(core.BATTLE_PASS.pricePhp, 299);
  assert.deepEqual(PRODUCTS.battlepass.balls, [...core.BATTLE_PASS.balls], 'the shop sells exactly the Battle Pass balls');
  assert.equal(PRODUCTS.battlepass.amount, 29900);
  for (const id of PASS) { const d = core.getBall(id); assert.ok(d.godBall && d.pass === 'battlepass' && !d.free && !d.paid && !d.premium, id); }
  assert.ok(core.getBall('anti').edition && !core.getBall('anti').free, 'Anti Ball: 100-copy limited edition since 2.8.0');
  assert.deepEqual([PRODUCTS.coins_10k.amount, PRODUCTS.coins_10k.coins], [9900, 10000]);
  assert.deepEqual([PRODUCTS.coins_1m.amount, PRODUCTS.coins_1m.coins], [99900, 1000000]);
});

test('without the pass: not playable, not for coins; the free practice test still works', async () => {
  const p = await player('no_pass_yet');
  for (const id of PASS) assert.equal((await p.post('/api/battle/start', { mode: '1v1', ball: id, difficulty: 'easy' })).status, 403, id + ' is locked');
  assert.equal((await p.post('/api/shop/unlock', { ball: 'godofwar' })).status, 400, 'not for coins');
  assert.equal((await p.post('/api/battle/start', { mode: 'practice', ball: 'solareclipse', trial: true, godTest: true, startForm: 2, dummy: true })).status, 200, 'free practice test');
  const s = (await p.get('/api/godshop')).data;
  const view = Object.fromEntries(s.products.map(x => [x.id, x]));
  assert.equal(view.battlepass.price, 299); assert.deepEqual(view.battlepass.balls, PASS); assert.equal(view.battlepass.owned, false); assert.equal(view.battlepass.pass, true);
  assert.deepEqual([view.coins_10k.price, view.coins_10k.coins, view.coins_10k.owned], [99, 10000, false]);
  assert.deepEqual([view.coins_1m.price, view.coins_1m.coins, view.coins_1m.owned], [999, 1000000, false]);
});

test('Battle Pass by checkout: verified payment → all four God Balls, forever; no second purchase', async () => {
  const p = await player('pass_buyer');
  const co = await p.post('/api/godshop/checkout', { product: 'battlepass' }); assert.equal(co.status, 200);
  const row = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co.data.purchaseId); assert.equal(row.amount, 29900); assert.equal(row.coins, null);
  assert.equal(pm.sessions.get(row.provider_ref).attributes.line_items[0].description, 'Battle Pass — 4 Supreme God Balls, yours forever');
  // a webhook before the money arrives grants nothing; paying less is never enough
  assert.equal((await webhook(srv.base, paidEvent(row.provider_ref))).status, 200); assert.ok(!owns(p, 'godofwar'));
  pm.pay(row.provider_ref, 29900);
  assert.equal((await webhook(srv.base, paidEvent(row.provider_ref))).status, 200);
  assert.equal(srv.db.get('SELECT status FROM shop_purchases WHERE id = ?', row.id).status, 'paid');
  for (const id of PASS) { assert.ok(owns(p, id), id); assert.equal((await p.post('/api/battle/start', { mode: '1v1', ball: id, difficulty: 'easy' })).status, 200); }
  assert.equal((await p.post('/api/godshop/checkout', { product: 'battlepass' })).status, 409, 'already owned');
  assert.equal((await p.get('/api/godshop')).data.products.find(x => x.id === 'battlepass').owned, true);
  assert.ok((await p.get('/api/save')).data.balls.aitech.owned, 'in the save on every device');
});

test('coin packs by checkout: coins added exactly once per verified payment (webhooks, return check and restore never add twice)', async () => {
  const p = await player('coin_buyer'); const c0 = coins(p);
  const co = await p.post('/api/godshop/checkout', { product: 'coins_10k' }); assert.equal(co.status, 200);
  const row = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co.data.purchaseId); assert.equal(row.amount, 9900); assert.equal(row.coins, 10000);
  assert.equal((await p.post(`/api/godshop/purchases/${row.id}/check`)).data.purchase.status, 'pending'); assert.equal(coins(p), c0, 'nothing before paying');
  pm.pay(row.provider_ref, 9900);
  const evt = paidEvent(row.provider_ref);
  assert.equal((await webhook(srv.base, evt)).status, 200);
  assert.equal(coins(p), c0 + 10000);
  assert.equal((await webhook(srv.base, evt)).data.duplicate, true);
  assert.equal((await webhook(srv.base, paidEvent(row.provider_ref))).status, 200, 'a second event for the same payment');
  assert.equal((await p.post(`/api/godshop/purchases/${row.id}/check`)).data.purchase.status, 'paid');
  assert.equal((await p.post('/api/godshop/restore')).status, 200);
  assert.equal(coins(p), c0 + 10000, 'still exactly +10,000');
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'shop.coins_granted' AND target = ?", row.id), 'logged');
  // coin packs can be bought again (a new purchase, a new payment)
  const co2 = await p.post('/api/godshop/checkout', { product: 'coins_1m' }); assert.equal(co2.status, 200);
  const row2 = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co2.data.purchaseId); assert.equal(row2.coins, 1000000);
  pm.pay(row2.provider_ref, 50000);     // paid too little → under review, no coins
  assert.equal((await webhook(srv.base, paidEvent(row2.provider_ref))).status, 200);
  assert.equal(srv.db.get('SELECT status FROM shop_purchases WHERE id = ?', row2.id).status, 'review'); assert.equal(coins(p), c0 + 10000);
  const co3 = await p.post('/api/godshop/checkout', { product: 'coins_1m' }); const row3 = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co3.data.purchaseId);
  pm.pay(row3.provider_ref, 99900); assert.equal((await webhook(srv.base, paidEvent(row3.provider_ref))).status, 200);
  assert.equal(coins(p), c0 + 1010000);
  assert.equal((await p.get('/api/save')).data.coins, c0 + 1010000);
  const hist = (await p.get('/api/godshop/purchases')).data.purchases; assert.ok(hist.some(h => h.coins === 1000000 && h.status === 'paid'));
});

test('QR payments: coins and the pass only after the owner approves; once only; rejected = nothing', async () => {
  const p = await player('qr_coins'); const c0 = coins(p);
  const s = (await p.get('/api/godshop')).data, acc = s.manual.accounts[0]; assert.ok(acc);
  let r = await p.post('/api/godshop/manual/submit', { product: 'coins_10k', account: acc.id, reference: 'MAYA 1111 2222 3333' });
  assert.equal(r.status, 200); assert.equal(r.data.purchase.status, 'awaiting'); assert.equal(r.data.purchase.coins, 10000);
  assert.equal(coins(p), c0, 'nothing until the owner approves');
  assert.equal((await p.post('/api/godshop/manual/submit', { product: 'coins_1m', account: acc.id, reference: 'MAYA-1111-2222-3333' })).status, 409, 'one reference = one payment');
  assert.ok([401, 403].includes((await p.post(`/api/admin/godshop/manual/${r.data.purchase.id}/approve`)).status), 'players cannot approve');
  assert.equal((await owner.post(`/api/admin/godshop/manual/${r.data.purchase.id}/approve`)).status, 200);
  assert.equal(coins(p), c0 + 10000);
  assert.equal((await owner.post(`/api/admin/godshop/manual/${r.data.purchase.id}/approve`)).status, 409, 'cannot add the coins twice');
  assert.equal(coins(p), c0 + 10000);
  // a rejected payment adds nothing
  r = await p.post('/api/godshop/manual/submit', { product: 'coins_1m', account: acc.id, reference: 'FAKE000000001' }); assert.equal(r.status, 200);
  assert.equal((await owner.post(`/api/admin/godshop/manual/${r.data.purchase.id}/reject`, { reason: 'Not in my Maya app' })).status, 200);
  assert.equal(coins(p), c0 + 10000);
  // the Battle Pass by QR
  r = await p.post('/api/godshop/manual/submit', { product: 'battlepass', account: acc.id, reference: 'MAYA299000001' }); assert.equal(r.status, 200);
  assert.ok(!owns(p, 'godofchaos'));
  assert.equal((await p.post('/api/godshop/manual/submit', { product: 'battlepass', account: acc.id, reference: 'MAYA299000002' })).status, 409, 'already waiting for the pass');
  assert.equal((await owner.post(`/api/admin/godshop/manual/${r.data.purchase.id}/approve`)).status, 200);
  for (const id of PASS) assert.ok(owns(p, id), id);
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'shop.manual_approved' AND target = ?", r.data.purchase.id));
});

test('a player who kept some God Balls can still buy the pass and gets the rest', async () => {
  const p = await player('kept_one');
  srv.db.run("INSERT INTO user_balls (user_id, ball_id, owned, level, source) VALUES (?, 'godofwar', 1, 12, 'kept_free_2.2')", uid(p));
  const view = (await p.get('/api/godshop')).data.products.find(x => x.id === 'battlepass'); assert.equal(view.have, 1); assert.equal(view.owned, false);
  assert.equal((await p.post('/api/battle/start', { mode: '1v1', ball: 'godofwar', difficulty: 'easy' })).status, 200, 'the kept ball is playable');
  assert.equal((await p.post('/api/battle/start', { mode: '1v1', ball: 'aitech', difficulty: 'easy' })).status, 403);
  const co = await p.post('/api/godshop/checkout', { product: 'battlepass' }); assert.equal(co.status, 200);
  const row = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co.data.purchaseId); pm.pay(row.provider_ref, 29900);
  assert.equal((await webhook(srv.base, paidEvent(row.provider_ref))).status, 200);
  for (const id of PASS) assert.ok(owns(p, id), id);
  assert.equal(srv.db.get("SELECT level FROM user_balls WHERE user_id = ? AND ball_id = 'godofwar'", uid(p)).level, 12, 'progress kept');
});

test('migration 009: players who already played a God Ball keep it; nobody else gets one; a backup is made first', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nbb-bp-')), file = path.join(dir, 'game.db'), mig = path.join(__dirname, '..', 'migrations'), part = path.join(dir, 'm');
  fs.mkdirSync(part); for (const f of fs.readdirSync(mig).filter(f => parseInt(f, 10) <= 8)) fs.copyFileSync(path.join(mig, f), path.join(part, f));
  let db = new DB(file); db.migrate(part);
  for (const u of ['veteran', 'newbie', 'buyer']) db.run('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, 0)', u, 'x');
  const id = n => db.get('SELECT id FROM users WHERE username = ?', n).id;
  db.run("INSERT INTO user_balls (user_id, ball_id, owned, level, exp, wins) VALUES (?, 'godofwar', 0, 14, 30, 9)", id('veteran'));
  db.run("INSERT INTO user_balls (user_id, ball_id, owned, level) VALUES (?, 'aitech', 0, 1)", id('veteran'));
  db.run("INSERT INTO user_balls (user_id, ball_id, owned, level) VALUES (?, 'fire', 0, 3)", id('veteran'));
  db.run("INSERT INTO user_balls (user_id, ball_id, owned, source, unlocked_at) VALUES (?, 'godofguns', 1, 'purchase', 5)", id('buyer'));
  db.close(); db = new DB(file);
  assert.deepEqual(db.migrate(mig).slice(0, 1), ['009_battlepass.sql']);
  assert.ok(db.lastBackup && fs.existsSync(db.lastBackup), 'backup before the migration');
  const row = (n, b) => db.get('SELECT * FROM user_balls WHERE user_id = ? AND ball_id = ?', id(n), b);
  assert.equal(row('veteran', 'godofwar').owned, 1); assert.equal(row('veteran', 'godofwar').level, 14, 'progress kept'); assert.equal(row('veteran', 'godofwar').source, 'kept_free_2.2');
  assert.equal(row('veteran', 'aitech').owned, 1);
  assert.equal(row('veteran', 'godofchaos'), undefined, 'never played → not given');
  assert.equal(row('veteran', 'fire').owned, 0, 'other balls untouched');
  assert.equal(db.get('SELECT COUNT(*) AS n FROM user_balls WHERE user_id = ?', id('newbie')).n, 0, 'new players get nothing');
  assert.deepEqual({ ...row('buyer', 'godofguns') }, { ...row('buyer', 'godofguns'), owned: 1, source: 'purchase', unlocked_at: 5 }, 'purchases untouched');
  assert.ok(db.get("SELECT 1 FROM audit_logs WHERE action = 'migration.battlepass_kept'"), 'logged');
  assert.ok(db.get("SELECT 1 FROM pragma_table_info('shop_purchases') WHERE name = 'coins'"));
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});
