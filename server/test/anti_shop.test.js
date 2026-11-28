'use strict';
/**
 * 2.8.0 ANTI BALL — LIMITED EDITION, server side: verified purchases only, serial numbers ANTI-001 … ANTI-100, the supply is
 * never exceeded (also with simultaneous buyers), permanently sold out, no free unlock / events / admin grants, ownership
 * kept across logins, old free-version progress kept (migration 010), mastery title. The kit is in anti_edition.test.js.
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

/* ================= server ================= */
function fakePaymongo() {
  const sessions = new Map(); let n = 0;
  const srv = http.createServer((req, res) => { let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'POST' && req.url === '/v1/checkout_sessions') { const a = JSON.parse(body).data.attributes, id = 'cs_anti_' + (++n); sessions.set(id, { id, attributes: { ...a, checkout_url: 'https://checkout.paymongo.com/' + id, status: 'active', payments: [], livemode: false } }); return send(200, { data: sessions.get(id) }); }
    const m = req.url.match(/^\/v1\/checkout_sessions\/(.+)$/); if (req.method === 'GET' && m) { const s = sessions.get(decodeURIComponent(m[1])); return s ? send(200, { data: s }) : send(404, {}); }
    send(404, {}); }); });
  return { srv, sessions, pay(id, amount) { const s = sessions.get(id); s.attributes.payments.push({ id: 'pay_' + id + '_' + s.attributes.payments.length, attributes: { status: 'paid', amount, currency: 'PHP', source: { type: 'gcash' } } }); } };
}
const SECRET = 'whsk_anti_secret';
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
async function buy(c) {
  const co = await c.post('/api/godshop/checkout', { product: 'anti' }); if (co.status !== 200) return co;
  const row = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co.data.purchaseId); pm.pay(row.provider_ref, 99900);
  assert.equal(await webhook(srv.base, row.provider_ref), 200); return { status: 200, row };
}
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

test('server: no free unlock — not playable, not for coins, not from events, not grantable by the admin; the practice preview works', async () => {
  const p = await player('anti_window');
  assert.equal((await p.post('/api/battle/start', { mode: '1v1', ball: 'anti', difficulty: 'easy' })).status, 403);
  assert.equal((await p.post('/api/shop/unlock', { ball: 'anti' })).status, 400);
  assert.equal((await p.post('/api/battle/start', { mode: 'practice', ball: 'anti', trial: true, dummy: true })).status, 200, 'full preview before buying');
  assert.equal((await owner.post('/api/admin/events', { name: 'Anti Fest', ball: 'anti', start: Date.now(), end: Date.now() + 864e5 })).status, 400, 'no event restock');
  assert.equal((await owner.post(`/api/admin/players/${uidOf('anti_window')}/grant`, { ball: 'anti' })).status, 400, 'no admin grant');
  const s = (await p.get('/api/godshop')).data, e = s.edition.anti;
  assert.equal(s.products.find(x => x.id === 'anti').price, 999);
  assert.deepEqual([e.price, e.supply, e.owners, e.available, e.soldOut, e.permanent], [999, 100, 0, 100, false, true]);
});

test('server: verified purchase → ANTI-001, ANTI-002…; ownership survives logout / another device; restore; no second copy', async () => {
  const a = await player('null_one'), b = await player('null_two');
  assert.equal((await buy(a)).status, 200); assert.equal((await buy(b)).status, 200);
  const sa = (await a.get('/api/godshop')).data.edition.anti; assert.equal(sa.serial, 1); assert.equal(sa.serialLabel, 'ANTI-001');
  assert.equal((await b.get('/api/godshop')).data.edition.anti.serialLabel, 'ANTI-002');
  assert.equal((await a.post('/api/battle/start', { mode: '1v1', ball: 'anti', difficulty: 'easy' })).status, 200);
  assert.equal((await a.post('/api/godshop/checkout', { product: 'anti' })).status, 409, 'one copy per account');
  const again = new Client(srv.base); assert.equal((await again.post('/api/auth/login', { username: 'null_one', password: 'Sup3r-Secret-Pass!' })).status, 200);
  const save = (await again.get('/api/save')).data; assert.ok(save.balls.anti.owned); assert.equal(save.editions.anti, 1);
  assert.equal((await again.post('/api/godshop/restore')).status, 200); assert.ok(srv.db.get("SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = 'title_nullbearer'", uidOf('null_one')), 'owner title');
  assert.throws(() => srv.db.run("UPDATE edition_owners SET user_id = 1 WHERE ball_id = 'anti'"), /permanent/, 'serials can never be moved');
});

test('server: simultaneous buyers for the last copy — exactly one gets it; then SOLD OUT forever (no raise, no new edition, no restock)', async () => {
  // fill the edition up to 99 owners (simulated earlier buyers)
  const have = srv.db.get("SELECT COUNT(*) AS n FROM edition_owners WHERE ball_id = 'anti'").n;
  for (let i = have + 1; i <= 99; i++) { srv.db.run('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, 0)', 'seed' + i, 'x'); srv.db.run("INSERT INTO edition_owners (ball_id, serial, user_id, purchase_id, edition, granted_at) VALUES ('anti', ?, ?, ?, 1, 0)", i, uidOf('seed' + i), 'pur_seed_' + i); }
  const x = await player('last_x'), y = await player('last_y');
  const [rx, ry] = await Promise.all([x.post('/api/godshop/edition/reserve', { product: 'anti' }), y.post('/api/godshop/edition/reserve', { product: 'anti' })]);
  assert.deepEqual([rx.status, ry.status].sort(), [200, 409], 'only one slot can be held');
  const winner = rx.status === 200 ? x : y, loser = winner === x ? y : x, rid = (rx.status === 200 ? rx : ry).data.purchaseId;
  assert.equal((await loser.post('/api/godshop/checkout', { product: 'anti' })).status, 409, 'checkout also refused while the last slot is held');
  const acc = (await winner.get('/api/godshop')).data.manual.accounts[0];
  const sub = await winner.post('/api/godshop/manual/submit', { product: 'anti', account: acc.id, reference: 'ANTILAST000100', purchaseId: rid }); assert.equal(sub.status, 200);
  assert.equal((await owner.post(`/api/admin/godshop/manual/${rid}/approve`)).status, 200);
  const st = (await winner.get('/api/godshop')).data.edition.anti; assert.equal(st.serialLabel, 'ANTI-100'); assert.equal(st.soldOut, true); assert.equal(st.available, 0);
  assert.equal(srv.db.get("SELECT COUNT(*) AS n FROM edition_owners WHERE ball_id = 'anti'").n, 100);
  assert.equal((await loser.post('/api/godshop/edition/reserve', { product: 'anti' })).status, 409, 'sold out');
  assert.equal((await owner.post('/api/admin/edition/settings', { ball: 'anti', supply: 150 })).status, 400, 'the supply can never be raised');
  assert.equal((await owner.post('/api/admin/edition/release', { ball: 'anti', add: 10 })).status, 400, 'never a new edition');
  const adm = (await owner.get('/api/admin/edition?ball=anti')).data; assert.equal(adm.owners.length, 100); assert.equal(adm.owners[99].label, 'ANTI-100'); assert.equal(adm.supply, 100);
  assert.equal(new Set(adm.owners.map(o => o.serial)).size, 100, 'every serial once');
});

test('server: only the owner can see or manage the edition; the owner can pause the listing; God of Absolute is unaffected', async () => {
  const p = await player('curious_one');
  assert.ok([401, 403].includes((await p.get('/api/admin/edition?ball=anti')).status));
  assert.ok([401, 403].includes((await p.post('/api/admin/edition/settings', { ball: 'anti', open: false })).status));
  assert.equal((await owner.post('/api/admin/edition/settings', { ball: 'anti', open: false })).status, 200);
  assert.equal((await owner.get('/api/admin/edition?ball=anti')).data.open, false);
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'admin.edition_settings' AND target = 'anti'"), 'logged');
  const abs = (await owner.get('/api/admin/edition')).data; assert.equal(abs.ball, 'godofabsolute'); assert.equal(abs.price, 499);
});

test('migration 010: Anti Ball rows that were owned while it was free are locked again, with all progress kept', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nbb-anti-')), file = path.join(dir, 'game.db'), mig = path.join(__dirname, '..', 'migrations'), part = path.join(dir, 'm');
  fs.mkdirSync(part); for (const f of fs.readdirSync(mig).filter(f => parseInt(f, 10) <= 9)) fs.copyFileSync(path.join(mig, f), path.join(part, f));
  let db = new DB(file); db.migrate(part);
  for (const u of ['summoner', 'player2']) db.run('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, 0)', u, 'x');
  const id = n => db.get('SELECT id FROM users WHERE username = ?', n).id;
  db.run("INSERT INTO user_balls (user_id, ball_id, owned, level, exp, wins, tree, source) VALUES (?, 'anti', 1, 22, 40, 31, '{\"slot4\":1}', 'summon')", id('summoner'));
  db.run("INSERT INTO user_balls (user_id, ball_id, owned, level) VALUES (?, 'anti', 0, 7)", id('player2'));
  db.run("INSERT INTO user_balls (user_id, ball_id, owned, level) VALUES (?, 'fire', 1, 9)", id('player2'));
  db.close(); db = new DB(file);
  const applied = db.migrate(mig); assert.equal(applied[0], '010_anti_edition.sql', 'later migrations (2.9.0: 011) may follow'); assert.ok(db.lastBackup && fs.existsSync(db.lastBackup));
  const r = db.get("SELECT * FROM user_balls WHERE user_id = ? AND ball_id = 'anti'", id('summoner'));
  assert.equal(r.owned, 0); assert.equal(r.level, 22); assert.equal(r.wins, 31); assert.equal(r.tree, '{"slot4":1}'); assert.equal(r.source, 'locked_2.8:summon');
  assert.equal(db.get("SELECT level FROM user_balls WHERE user_id = ? AND ball_id = 'anti'", id('player2')).level, 7);
  assert.equal(db.get("SELECT owned FROM user_balls WHERE user_id = ? AND ball_id = 'fire'", id('player2')).owned, 1, 'other balls untouched');
  assert.ok(db.get("SELECT 1 FROM audit_logs WHERE action = 'migration.anti_locked'"));
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test('server: Anti Ball mastery comes from verified battles; level 10 gives the NULL MONARCH title (looks only)', async () => {
  const p = await player('null_master'); const uid = uidOf('null_master');
  srv.db.run("INSERT INTO skill_mastery (user_id, ball_id, skill_uid, xp, uses, battles, updated_at) VALUES (?, 'anti', 'anti.0', 36000, 1, 1, 0)", uid);
  srv.S.skills26.grant(uid, 'anti', { 'anti.1': 2 }, true);
  assert.ok(srv.db.get("SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = 'title_nullmonarch'", uid));
  assert.ok(!srv.db.get("SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = 'title_nullmonarch'", uidOf('null_one')));
  assert.ok(p);
});
