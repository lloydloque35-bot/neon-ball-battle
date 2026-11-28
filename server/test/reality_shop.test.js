'use strict';
/**
 * 2.9.0 REALITY VS ABSOLUTE — server side:
 *  - The Void Below / The Absolute Above: 50,000 coins, atomic (never below 0, never twice, simultaneous requests charge once, recorded, audited)
 *  - Fate Note Ball: PHP 99 only through a verified payment (PayMongo checkout + webhook, or an owner-approved QR payment); never for coins
 *  - none of the three: not playable before buying, not from summon orbs, not from events; ownership survives logging in again
 *  - God Mastery from verified battles only (never practice), looks only; the Fractured Archon's secret unlock and once-per-battle rewards
 *  - the new battle inputs are validated; migration 011 adds tables only (with a backup) and keeps every old row
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
const { DB } = require('../db');

function fakePaymongo() {
  const sessions = new Map(); let n = 0;
  const srv = http.createServer((req, res) => { let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'POST' && req.url === '/v1/checkout_sessions') { const a = JSON.parse(body).data.attributes, id = 'cs_rg_' + (++n); sessions.set(id, { id, attributes: { ...a, checkout_url: 'https://checkout.paymongo.com/' + id, status: 'active', payments: [], livemode: false } }); return send(200, { data: sessions.get(id) }); }
    const m = req.url.match(/^\/v1\/checkout_sessions\/(.+)$/); if (req.method === 'GET' && m) { const s = sessions.get(decodeURIComponent(m[1])); return s ? send(200, { data: s }) : send(404, {}); }
    send(404, {}); }); });
  return { srv, sessions, pay(id, amount) { const s = sessions.get(id); s.attributes.payments.push({ id: 'pay_' + id + '_' + s.attributes.payments.length, attributes: { status: 'paid', amount, currency: 'PHP', source: { type: 'gcash' } } }); } };
}
const SECRET = 'whsk_rg_secret';
async function webhook(base, sid) {
  const raw = JSON.stringify({ data: { id: 'evt_' + crypto.randomBytes(4).toString('hex'), type: 'event', attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: sid } } } }), t = Math.floor(Date.now() / 1000);
  const r = await fetch(base + '/api/godshop/webhook/paymongo', { method: 'POST', headers: { 'content-type': 'application/json', 'paymongo-signature': `t=${t},te=${crypto.createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex')},li=` }, body: raw });
  return r.status;
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let pm, srv, owner, secret, ctr;
const nextCode = () => S_.totpCode(secret, ++ctr);
async function player(name, pass = 'Sup3r-Secret-Pass!') { const c = new Client(srv.base); c.name = name; await c.register(name, pass); return c; }
const uidOf = name => srv.db.get('SELECT id FROM users WHERE username = ?', name).id;
const coins = c => srv.db.get('SELECT coins FROM profiles WHERE user_id = ?', uidOf(c.name)).coins;
const setCoins = (c, n) => srv.db.run('UPDATE profiles SET coins = ? WHERE user_id = ?', n, uidOf(c.name));
const owns = (c, b) => !!(srv.db.get('SELECT owned FROM user_balls WHERE user_id = ? AND ball_id = ?', uidOf(c.name), b) || {}).owned;

test.before(async () => {
  pm = fakePaymongo(); await new Promise(r => pm.srv.listen(0, '127.0.0.1', r));
  srv = await startServer({ shop: { secretKey: 'sk_test_fake', webhookSecret: SECRET, methods: ['gcash'], liveConfirmed: false, apiBase: `http://127.0.0.1:${pm.srv.address().port}` } });
  await createOwner(srv.db, { username: 'Boss', password: 'Owner-Pass-9876!' });
  const pending = srv.db.get("SELECT totp_pending FROM users WHERE role = 'owner'").totp_pending;
  ctr = Math.floor(Date.now() / 30000) - 1; assert.ok(confirmTotp(srv.db, S_.totpCode(pending, ctr))); secret = pending;
  owner = new Client(srv.base); assert.equal((await owner.post('/api/auth/login', { username: 'Boss', password: 'Owner-Pass-9876!', code: nextCode() })).status, 200);
  let r = await owner.post('/api/admin/godshop/manual/settings', { enabled: false, accounts: [{ kind: 'maya', name: 'JUAN D.' }] }); const acc = r.data.manual.accounts[0];
  await owner.post('/api/admin/godshop/manual/qr', { account: acc.id, image: PNG });
  await owner.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: [{ id: acc.id, kind: 'maya', name: 'JUAN D.' }] });
});
test.after(async () => { await srv.stop(); pm.srv.close(); });

test('before buying: none of the three Reality Gods is playable, none comes from summon orbs, Fate Note is never sold for coins', async () => {
  const p = await player('rg_window');
  for (const b of ['voidbelow', 'absoluteabove', 'fatenote']) assert.equal((await p.post('/api/battle/start', { mode: '1v1', ball: b, difficulty: 'easy' })).status, 403, b + ' locked');
  setCoins(p, 1e7);
  assert.equal((await p.post('/api/reality/buy', { ball: 'fatenote' })).status, 400, 'Fate Note: not for coins');
  assert.equal((await p.post('/api/shop/unlock', { ball: 'fatenote' })).status, 400, 'Fate Note: not through the coin unlock either');
  assert.equal(coins(p), 1e7, 'nothing was charged');
  for (let i = 0; i < 25; i++) { const r = await p.post('/api/shop/summon', { orb: 'legendary' }); if (r.status !== 200) break; }
  for (const b of ['voidbelow', 'absoluteabove', 'fatenote']) assert.equal(owns(p, b), false, b + ' never comes from a summon orb');
  const me = (await p.get('/api/reality/me')).data;
  assert.deepEqual(me.gods.map(g => [g.id, g.owned, g.price]), [['voidbelow', false, { coins: 50000 }], ['absoluteabove', false, { coins: 50000 }], ['fatenote', false, { php: 99 }]]);
  assert.deepEqual(me.gods[0].forms, ['VOID ENTITY', 'REALITY DEVOURER', 'THE END OF EVERYTHING']);
  for (const ball of ['voidbelow', 'absoluteabove', 'fatenote']) { const ev = await owner.post('/api/admin/events', { name: 'Free god', ball, goal: 3, price: 10, start: Date.now(), end: Date.now() + 3 * 86400e3 }); assert.equal(ev.status, 400); assert.match(ev.data.error || ev.data.message || '', /never be event rewards/); }
});

test('50,000 coins: refused without enough coins (nothing taken), then bought once — exact charge, recorded and audited, never twice', async () => {
  const p = await player('rg_buyer');
  setCoins(p, 49999);
  let r = await p.post('/api/reality/buy', { ball: 'voidbelow' });
  assert.equal(r.status, 402); assert.equal(coins(p), 49999, 'not enough coins: nothing taken'); assert.equal(owns(p, 'voidbelow'), false);
  setCoins(p, 120000);
  r = await p.post('/api/reality/buy', { ball: 'voidbelow' });
  assert.equal(r.status, 200); assert.equal(r.data.coins, 50000); assert.equal(r.data.balance, 70000);
  assert.equal(coins(p), 70000); assert.equal(owns(p, 'voidbelow'), true);
  const rec = srv.db.all('SELECT * FROM coin_purchases WHERE user_id = ?', uidOf('rg_buyer'));
  assert.equal(rec.length, 1); assert.equal(rec[0].coins, 50000); assert.equal(rec[0].coins_before, 120000); assert.equal(rec[0].coins_after, 70000);
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'shop.coin_purchase' AND target = 'voidbelow'"));
  r = await p.post('/api/reality/buy', { ball: 'voidbelow' });
  assert.equal(r.status, 409); assert.equal(coins(p), 70000, 'a second purchase is refused and charges nothing');
  assert.equal((await p.post('/api/battle/start', { mode: '1v1', ball: 'voidbelow', difficulty: 'easy' })).status, 200, 'now playable');
  // the classic coin-unlock route also works for the other one, with the same rules
  r = await p.post('/api/shop/unlock', { ball: 'absoluteabove' });
  assert.equal(r.status, 200); assert.equal(coins(p), 20000); assert.equal(owns(p, 'absoluteabove'), true);
  assert.equal(srv.db.get('SELECT COUNT(*) AS n FROM coin_purchases WHERE user_id = ?', uidOf('rg_buyer')).n, 2);
});

test('simultaneous purchases: only one goes through, the coins are taken once, the balance never goes below 0', async () => {
  const p = await player('rg_racer'); setCoins(p, 60000);
  const rs = await Promise.all(Array.from({ length: 6 }, () => p.post('/api/reality/buy', { ball: 'absoluteabove' })));
  assert.equal(rs.filter(r => r.status === 200).length, 1, 'exactly one purchase');
  assert.equal(coins(p), 10000); assert.equal(srv.db.get('SELECT COUNT(*) AS n FROM coin_purchases WHERE user_id = ?', uidOf('rg_racer')).n, 1);
  const q = await player('rg_racer2'); setCoins(q, 50000);
  const rs2 = await Promise.all([q.post('/api/reality/buy', { ball: 'voidbelow' }), q.post('/api/reality/buy', { ball: 'absoluteabove' })]);
  assert.deepEqual(rs2.map(r => r.status).sort(), [200, 402], 'enough coins for one of them only');
  assert.equal(coins(q), 0, 'exactly 0 — never negative');
  assert.ok(srv.db.get('SELECT MIN(coins) AS m FROM profiles').m >= 0);
});

test('the owner account cannot buy (it already has every ball); a forged client cannot grant itself a ball', async () => {
  assert.equal((await owner.post('/api/reality/buy', { ball: 'voidbelow' })).status, 400);
  const p = await player('rg_forger'); setCoins(p, 0);
  for (const [u, b] of [['/api/shop/unlock', { ball: 'voidbelow', free: true }], ['/api/reality/buy', { ball: 'absoluteabove', price: 0, coins: 0 }], ['/api/godshop/restore', { balls: ['fatenote'] }]]) await p.post(u, b);
  for (const b of ['voidbelow', 'absoluteabove', 'fatenote']) assert.equal(owns(p, b), false);
});

test('Fate Note Ball (PHP 99): checkout → signed webhook → the server checks PayMongo itself → owned once; duplicates and restore never add twice', async () => {
  const p = await player('rg_fate');
  const co = await p.post('/api/godshop/checkout', { product: 'fatenote' }); assert.equal(co.status, 200);
  const row = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co.data.purchaseId);
  assert.equal(row.amount, 9900); assert.deepEqual(JSON.parse(row.balls), ['fatenote']);
  assert.equal(await webhook(srv.base, row.provider_ref), 200);
  assert.equal(owns(p, 'fatenote'), false, 'a webhook without a real paid payment unlocks nothing');
  pm.pay(row.provider_ref, 5000); assert.equal(await webhook(srv.base, row.provider_ref), 200);
  assert.equal(owns(p, 'fatenote'), false, 'paying too little unlocks nothing');
  const p2 = await player('rg_fate2'); const co2 = await p2.post('/api/godshop/checkout', { product: 'fatenote' }); const row2 = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co2.data.purchaseId);
  pm.pay(row2.provider_ref, 9900);
  for (let i = 0; i < 3; i++) assert.equal(await webhook(srv.base, row2.provider_ref), 200);
  assert.equal(owns(p2, 'fatenote'), true);
  assert.equal((await p2.post('/api/godshop/restore')).status, 200);
  assert.equal(srv.db.get("SELECT COUNT(*) AS n FROM shop_purchases WHERE user_id = ? AND product = 'fatenote' AND status = 'paid'", uidOf('rg_fate2')).n, 1);
  assert.equal((await p2.post('/api/godshop/checkout', { product: 'fatenote' })).status, 409, 'cannot buy it twice');
  // ownership survives logging in again (another device)
  const again = new Client(srv.base); assert.equal((await again.post('/api/auth/login', { username: 'rg_fate2', password: 'Sup3r-Secret-Pass!' })).status, 200);
  assert.equal((await again.post('/api/battle/start', { mode: '1v1', ball: 'fatenote', difficulty: 'easy' })).status, 200);
  assert.equal((await again.get('/api/reality/me')).data.gods.find(g => g.id === 'fatenote').owned, true, 'shown as owned (not locked)');
});

test('Fate Note Ball by QR: nothing until the owner approves; one reference = one payment; approving twice gives it once', async () => {
  const p = await player('rg_qr'); const acc = (await p.get('/api/godshop')).data.manual.accounts[0];
  const r = await p.post('/api/godshop/manual/submit', { product: 'fatenote', account: acc.id, reference: 'MAYA 9090 1212 3434' });
  assert.equal(r.status, 200); assert.equal(owns(p, 'fatenote'), false, 'nothing until approved');
  const pid = r.data.purchase.id;
  assert.equal((await owner.post(`/api/admin/godshop/manual/${pid}/approve`)).status, 200);
  assert.equal(owns(p, 'fatenote'), true);
  assert.ok((await owner.post(`/api/admin/godshop/manual/${pid}/approve`)).status >= 400, 'a second approval is refused');
  const q = await player('rg_qr2');
  assert.equal((await q.post('/api/godshop/manual/submit', { product: 'fatenote', account: acc.id, reference: 'MAYA-9090-1212-3434' })).status, 409, 'the same reference cannot be used again');
});

test('God Mastery: from verified battles only (never practice), saved on the server, looks only; level 10 gives the title once', async () => {
  const p = await player('rg_master'); const uid = uidOf('rg_master'); setCoins(p, 50000);
  assert.equal((await p.post('/api/reality/buy', { ball: 'voidbelow' })).status, 200);
  let t = await p.post('/api/battle/start', { mode: 'practice', ball: 'voidbelow', difficulty: 'easy' }); assert.equal(t.status, 200);
  assert.equal((await p.post('/api/battle/finish', { id: t.data.ticket.id, inputs: [] })).status, 200);
  assert.equal(srv.db.get('SELECT COUNT(*) AS n FROM god_mastery WHERE user_id = ?', uid).n, 0, 'practice gives no mastery');
  t = await p.post('/api/battle/start', { mode: '1v1', ball: 'voidbelow', enemy: 'fire', difficulty: 'easy' }); assert.equal(t.status, 200);
  const f = await p.post('/api/battle/finish', { id: t.data.ticket.id, inputs: [] }); assert.equal(f.status, 200, JSON.stringify(f.data));
  const row = srv.db.get("SELECT * FROM god_mastery WHERE user_id = ? AND ball_id = 'voidbelow'", uid);
  assert.ok(row && row.xp > 0 && row.battles === 1, 'mastery from the verified battle'); assert.ok(JSON.parse(row.stats).skills > 0, 'counted abilities from the server simulation');
  assert.ok(f.data.reality && f.data.reality.mastery && f.data.reality.mastery.gained === row.xp);
  srv.db.run("UPDATE god_mastery SET xp = 27990 WHERE user_id = ? AND ball_id = 'voidbelow'", uid);
  t = await p.post('/api/battle/start', { mode: '1v1', ball: 'voidbelow', enemy: 'fire', difficulty: 'easy' });
  assert.equal(t.data.ticket.teams[0][0].gm29, 9, 'the mastery level travels with the ticket (looks)');
  const f2 = await p.post('/api/battle/finish', { id: t.data.ticket.id, inputs: [] }); assert.equal(f2.status, 200);
  assert.equal(f2.data.reality.mastery.lv, 10); assert.equal(f2.data.reality.mastery.title, 'title_voidsovereign');
  assert.ok(srv.db.get("SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = 'title_voidsovereign'", uid));
  const me = (await p.get('/api/reality/me')).data; assert.equal(me.mastery.voidbelow.lv, 10); assert.equal(me.mastery.voidbelow.titleOwned, true);
  assert.equal((await p.post('/api/cosmetics/buy', { id: 'title_voidsovereign' })).status >= 400, true, 'mastery titles cannot be bought');
});

test('THE FRACTURED ARCHON: sealed until 3 boss wins or a Reality God; always in the Reality Collision Zone; rewards once per verified battle', async () => {
  const p = await player('rg_archon'); const uid = uidOf('rg_archon');
  assert.equal((await p.post('/api/battle/start', { mode: 'boss', ball: 'fire', boss: 'fracturedarchon', difficulty: 'easy' })).status, 403, 'sealed for a new player');
  assert.equal((await p.get('/api/reality/me')).data.archon.unlocked, false);
  srv.db.run('UPDATE profiles SET stats = ? WHERE user_id = ?', JSON.stringify({ bossWins: 3 }), uid);
  const t = await p.post('/api/battle/start', { mode: 'boss', ball: 'fire', boss: 'fracturedarchon', difficulty: 'easy' }); assert.equal(t.status, 200);
  assert.equal(t.data.ticket.opts.archon, true); assert.equal(t.data.ticket.opts.arena, 'collision'); assert.equal(t.data.ticket.teams[1][0].ball, 'fracturedarchon'); assert.equal(t.data.ticket.teams[1][0].boss, true);
  const c0 = coins(p), R = srv.S.core.ARCHON.REWARD;
  const a = srv.db.tx(() => srv.S.reality.archonReward(uid, 'b_test_1', 'boss'));
  assert.equal(a.first, true); assert.equal(a.coins, R.first.coins); assert.deepEqual(a.cosmetics.sort(), [...R.first.cosmetics].sort());
  assert.equal(coins(p), c0 + R.first.coins);
  assert.equal(srv.db.tx(() => srv.S.reality.archonReward(uid, 'b_test_1', 'boss')), null, 'the same battle never pays twice');
  const b = srv.db.tx(() => srv.S.reality.archonReward(uid, 'b_test_2', 'boss')); assert.equal(b.first, false); assert.equal(b.coins, R.repeat.coins); assert.deepEqual(b.cosmetics, []);
  for (const id of RG_PAID) assert.equal(!!(srv.db.get('SELECT owned FROM user_balls WHERE user_id = ? AND ball_id = ?', uid, id) || {}).owned, false, 'never a paid ball');
  const q = await player('rg_archon2'); setCoins(q, 50000); await q.post('/api/reality/buy', { ball: 'absoluteabove' });
  assert.equal((await q.post('/api/battle/start', { mode: 'boss', ball: 'absoluteabove', boss: 'fracturedarchon', difficulty: 'easy' })).status, 200, 'owning a Reality God also unseals it');
  assert.equal((await q.post('/api/battle/start', { mode: '1v1', ball: 'absoluteabove', enemy: 'fracturedarchon', difficulty: 'easy' })).status, 400, 'never an ordinary opponent');
});
const RG_PAID = ['voidbelow', 'absoluteabove', 'fatenote', 'godofguns', 'godportal', 'godofabsolute', 'anti'];

test('battle inputs: the notebook target and the clash press are accepted; malformed ones reject the battle', async () => {
  const p = await player('rg_inputs'); setCoins(p, 50000); await p.post('/api/reality/buy', { ball: 'absoluteabove' });
  let t = await p.post('/api/battle/start', { mode: '1v1', ball: 'absoluteabove', enemy: 'fire', difficulty: 'easy' });
  let f = await p.post('/api/battle/finish', { id: t.data.ticket.id, inputs: [[10, 't', 2], [20, 'c', 0]] }); assert.equal(f.status, 200);
  t = await p.post('/api/battle/start', { mode: '1v1', ball: 'absoluteabove', enemy: 'fire', difficulty: 'easy' });
  f = await p.post('/api/battle/finish', { id: t.data.ticket.id, inputs: [[10, 't', -5]] }); assert.equal(f.status, 400);
  t = await p.post('/api/battle/start', { mode: '1v1', ball: 'absoluteabove', enemy: 'fire', difficulty: 'easy' });
  f = await p.post('/api/battle/finish', { id: t.data.ticket.id, inputs: [[10, 'c', 7]] }); assert.equal(f.status, 400);
  const core = srv.S.core;
  assert.equal(JSON.stringify(core.cleanPvpActions([[0, 't', 3], [1, 'c', 0]])), JSON.stringify([[0, 't', 3], [1, 'c', 0]]));
  assert.equal(core.cleanPvpActions([[0, 't', 'x']]), null);
});

test('migration 011: adds the 2.9.0 tables only, after a backup — every old row is kept exactly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nbb-rg-')), file = path.join(dir, 'game.db'), mig = path.join(__dirname, '..', 'migrations'), part = path.join(dir, 'm');
  fs.mkdirSync(part); for (const f of fs.readdirSync(mig).filter(f => parseInt(f, 10) <= 10)) fs.copyFileSync(path.join(mig, f), path.join(part, f));
  let db = new DB(file); db.migrate(part);
  db.run('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, 0)', 'veteran', 'x'); const id = db.get("SELECT id FROM users WHERE username = 'veteran'").id;
  db.run("INSERT INTO user_balls (user_id, ball_id, owned, level, exp, wins, source) VALUES (?, 'godofwar', 1, 33, 12, 40, 'kept_free_2.2')", id);
  db.run("INSERT INTO user_balls (user_id, ball_id, owned, level) VALUES (?, 'fire', 1, 9)", id);
  const before = JSON.stringify(db.all('SELECT * FROM user_balls ORDER BY ball_id'));
  db.close(); db = new DB(file);
  assert.deepEqual(db.migrate(mig), ['011_reality.sql']); assert.ok(db.lastBackup && fs.existsSync(db.lastBackup), 'backed up first');
  assert.equal(JSON.stringify(db.all('SELECT * FROM user_balls ORDER BY ball_id')), before, 'old rows unchanged');
  for (const t of ['god_mastery', 'coin_purchases', 'archon_clears']) assert.ok(db.get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", t), t);
  db.run('INSERT INTO coin_purchases (id, user_id, ball_id, coins, coins_before, coins_after, created_at) VALUES (?, ?, ?, 50000, 50000, 0, 0)', 'cp_1', id, 'voidbelow');
  assert.throws(() => db.run('INSERT INTO coin_purchases (id, user_id, ball_id, coins, coins_before, coins_after, created_at) VALUES (?, ?, ?, 50000, 50000, 0, 0)', 'cp_2', id, 'voidbelow'), 'one purchase per player and ball');
  assert.throws(() => db.run('INSERT INTO coin_purchases (id, user_id, ball_id, coins, coins_before, coins_after, created_at) VALUES (?, ?, ?, 50000, 10, -49990, 0)', 'cp_3', id, 'absoluteabove'), 'never a negative balance');
  assert.ok(db.get("SELECT 1 FROM audit_logs WHERE action = 'migration.reality_2.9.0'"));
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});
