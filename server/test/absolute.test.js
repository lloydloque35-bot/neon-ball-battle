'use strict';
/**
 * 2.4.0 GOD OF ABSOLUTE — LIMITED EDITION (PHP 499).
 * Server: reservation, the last slot, verified ownership with serial numbers, Lv 50, owner rewards, restore,
 * owner-only management, immutable records, PayMongo path, database backup before migrations.
 * Engine: 5 skills x 3 forms, level-gated forms (Lv 70 / 100), copies cap, both ultimates leave the arena as it was, determinism.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const S_ = require('../security');
const { startServer, Client } = require('./helpers');
const { createOwner, confirmTotp } = require('../cli/owner');
const { loadCore } = require('../core');
const { DB } = require('../db');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const ABS = 'godofabsolute';
let srv, owner, secret, ctr, acc;
const nextCode = () => S_.totpCode(secret, ++ctr);
const uidOf = name => srv.db.get('SELECT id FROM users WHERE username = ?', name).id;
const row = (name, ball = ABS) => srv.db.get('SELECT * FROM user_balls WHERE user_id = ? AND ball_id = ?', uidOf(name), ball);
async function player(name) { const c = new Client(srv.base); c.name = name; assert.equal((await c.register(name)).status, 200); return c; }
async function reserve(c) { return c.post('/api/godshop/edition/reserve', { product: ABS }); }
async function pay(c, ref) { const r = await reserve(c); if (r.status !== 200) return r; return c.post('/api/godshop/manual/submit', { product: ABS, account: acc, reference: ref, purchaseId: r.data.purchaseId }); }
const approve = id => owner.post(`/api/admin/godshop/manual/${id}/approve`);
const edition = async c => (await c.get('/api/godshop')).data.edition[ABS];

test.before(async () => {
  srv = await startServer({ shop: { secretKey: '', webhookSecret: '', methods: ['gcash'], liveConfirmed: false, apiBase: 'http://127.0.0.1:9' } });
  await createOwner(srv.db, { username: 'Boss', password: 'Owner-Pass-9876!' });
  const pending = srv.db.get("SELECT totp_pending FROM users WHERE role = 'owner'").totp_pending;
  ctr = Math.floor(Date.now() / 30000) - 1; assert.ok(confirmTotp(srv.db, S_.totpCode(pending, ctr))); secret = pending;
  owner = new Client(srv.base);
  assert.equal((await owner.post('/api/auth/login', { username: 'Boss', password: 'Owner-Pass-9876!', code: nextCode() })).status, 200);
});
test.after(async () => { await srv.stop(); });

test('the shop shows real edition numbers; nothing can be reserved until payments are set up', async () => {
  const a = await player('abs_early');
  const e = await edition(a);
  assert.deepEqual([e.supply, e.owners, e.reserved, e.available, e.soldOut, e.open, e.price, e.startLevel], [100, 0, 0, 100, false, true, 499, 50]);
  assert.equal((await reserve(a)).status, 503, 'QR payments are off → no reservation, no money');
  // set up QR payments (owner)
  let r = await owner.post('/api/admin/godshop/manual/settings', { enabled: false, accounts: [{ kind: 'maya', name: 'JUAN D.' }] });
  acc = r.data.manual.accounts[0].id;
  assert.equal((await owner.post('/api/admin/godshop/manual/qr', { account: acc, image: PNG })).status, 200);
  assert.equal((await owner.post('/api/admin/godshop/manual/settings', { enabled: true, accounts: [{ id: acc, kind: 'maya', name: 'JUAN D.' }] })).status, 200);
});

test('only the owner can see or change the edition; players cannot get it any other way', async () => {
  const p = await player('abs_sneaky');
  for (const [m, u, b] of [['get', '/api/admin/edition'], ['post', '/api/admin/edition/settings', { supply: 5 }], ['post', '/api/admin/edition/release', { add: 5 }], ['post', '/api/admin/edition/tuning', { xpMul: 0.25 }]])
    assert.ok([401, 403].includes((await p[m](u, b)).status), u);
  assert.equal((await p.post('/api/shop/unlock', { ball: ABS })).status, 400, 'not for coins');
  assert.equal((await p.post('/api/battle/start', { mode: '1v1', ball: ABS })).status, 403, 'not playable before a verified purchase');
  assert.equal((await p.post('/api/battle/start', { mode: 'practice', ball: ABS, trial: true, godTest: true, startForm: 2, dummy: true })).status, 200, 'free practice test');
  assert.equal((await p.post('/api/cosmetics/buy', { id: 'title_absolute' })).status, 400, 'owner rewards are not for sale');
  assert.equal((await p.post('/api/cosmetics/equip', { slot: 'title', id: 'title_absolute' })).status, 403);
  const pid = uidOf('abs_sneaky');
  assert.equal((await owner.post(`/api/admin/players/${pid}/grant`, { ball: ABS })).status, 400, 'the owner cannot hand out edition slots');
  assert.equal((await owner.post(`/api/admin/players/${pid}/grant`, { cosmetic: 'aura_absolute' })).status, 400);
  assert.equal(srv.db.get('SELECT COUNT(*) AS n FROM edition_owners').n, 0);
});

test('reserve → pay → owner approves: serial #1, permanent ownership, the ball (only it) at Lv 50, owner rewards', async () => {
  const p = await player('abs_first');
  srv.db.run("INSERT INTO user_balls (user_id, ball_id, owned, level, exp) VALUES (?, 'fire', 1, 23, 100) ON CONFLICT(user_id, ball_id) DO UPDATE SET owned = 1, level = 23, exp = 100", uidOf('abs_first'));
  const accLevel = srv.db.get('SELECT level, exp FROM profiles WHERE user_id = ?', uidOf('abs_first'));
  assert.equal((await p.post('/api/godshop/manual/submit', { product: ABS, account: acc, reference: 'ABS0000001' })).status, 400, 'pay only after reserving');
  const r = await reserve(p); assert.equal(r.status, 200); assert.ok(r.data.holdUntil > Date.now() + 25 * 60e3);
  assert.equal((await reserve(p)).data.purchaseId, r.data.purchaseId, 'the same reservation is reused');
  assert.deepEqual([(await edition(p)).reserved, (await edition(p)).available], [1, 99]);
  const s = await p.post('/api/godshop/manual/submit', { product: ABS, account: acc, reference: 'ABS 0000 0001', purchaseId: r.data.purchaseId });
  assert.equal(s.status, 200); assert.equal(s.data.purchase.status, 'awaiting'); assert.equal(s.data.purchase.amount, 499);
  assert.ok(!row('abs_first') || !row('abs_first').owned, 'nothing before approval');
  assert.equal((await approve(s.data.purchase.id)).status, 200);
  const b = row('abs_first'); assert.equal(b.owned, 1); assert.equal(b.level, 50, 'God of Absolute starts at Lv 50');
  assert.deepEqual(srv.db.get('SELECT level, exp FROM profiles WHERE user_id = ?', uidOf('abs_first')), accLevel, 'account level untouched');
  assert.equal(row('abs_first', 'fire').level, 23, 'other balls untouched');
  const own = srv.db.all('SELECT cosmetic_id FROM cosmetics_owned WHERE user_id = ?', uidOf('abs_first')).map(x => x.cosmetic_id).sort();
  assert.deepEqual(own, ['aura_absolute', 'hit_absolute', 'title_absolute', 'trail_absolute', 'win_absolute']);
  const save = (await p.get('/api/save')).data;
  assert.equal(save.editions[ABS], 1); assert.equal(save.loadout.title, 'title_absolute', 'the nameplate is equipped');
  const e = await edition(p); assert.deepEqual([e.owners, e.reserved, e.available, e.serial], [1, 0, 99, 1]);
  assert.equal((await p.post('/api/battle/start', { mode: '1v1', ball: ABS })).status, 200);
  const pub = (await p.get('/api/players/abs_first')).data; assert.equal(pub.editions[ABS], 1); assert.equal(pub.title, 'title_absolute');
  assert.equal((await approve(s.data.purchase.id)).status, 409, 'no second grant');
  assert.equal((await reserve(p)).status, 409, 'an owner cannot reserve again');
});

test('levels 50 → 100 come only from verified battles (EXP scale is an owner setting); restore never lowers a level', async () => {
  const uid = uidOf('abs_first');
  srv.S.giveBallExp(uid, ABS, 300); assert.equal(row('abs_first').level, 51);
  srv.S.giveBallExp(uid, ABS, 10e6); assert.equal(row('abs_first').level, 100, 'max level 100'); assert.equal(row('abs_first').exp, 0);
  srv.S.giveBallExp(uid, 'fire', 10e6); assert.equal(row('abs_first', 'fire').level, 50, 'other balls still stop at 50');
  // restore: re-applies entitlements without lowering anything
  srv.db.run('DELETE FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = ?', uid, 'aura_absolute');
  const p = new Client(srv.base); await p.post('/api/auth/login', { username: 'abs_first', password: 'Sup3r-Secret-Pass!' });
  const r = await p.post('/api/godshop/restore'); assert.equal(r.status, 200); assert.ok(r.data.restored >= 1);
  assert.equal(row('abs_first').level, 100); assert.ok(srv.db.get("SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = 'aura_absolute'", uid));
  srv.db.run('UPDATE user_balls SET level = 3 WHERE user_id = ? AND ball_id = ?', uid, ABS);       // e.g. a damaged save
  await p.post('/api/godshop/restore'); assert.equal(row('abs_first').level, 50, 'restore brings back the Lv 50 entitlement');
  assert.ok(srv.db.get("SELECT 1 FROM edition_ledger WHERE event = 'restore'"));
  // the owner's EXP scale
  assert.equal((await owner.post('/api/admin/edition/tuning', { xpMul: 9 })).status, 400);
  assert.equal((await owner.post('/api/admin/edition/tuning', { xpMul: 2, ultDur: 4 })).status, 200);
  assert.equal((await p.get('/api/save')).data.xpHigh, 2); assert.equal(srv.S.core.expNeed(60), 2 * (300 + 10 * 12));
  await owner.post('/api/admin/edition/tuning', { xpMul: 1 });
});

test('THE LAST SLOT: two players at once → exactly one gets it; expired holds are released; a late payment is never granted', async () => {
  await owner.post('/api/admin/edition/settings', { supply: 2 });          // 1 owner + 1 slot left
  const [a, b] = await Promise.all([player('abs_race_a'), player('abs_race_b')]);
  const [ra, rb] = await Promise.all([reserve(a), reserve(b)]);
  const ok = [ra, rb].filter(x => x.status === 200), no = [ra, rb].filter(x => x.status !== 200);
  assert.equal(ok.length, 1, 'only one reservation'); assert.equal(no[0].status, 409); assert.equal(no[0].data.code, 'ALL_RESERVED');
  const win = ra.status === 200 ? a : b, lose = win === a ? b : a, held = ok[0].data.purchaseId;
  assert.deepEqual([(await edition(lose)).available, (await edition(lose)).reserved], [0, 1]);
  // the hold runs out without a payment → released, the other player can take the slot
  srv.db.run('UPDATE shop_purchases SET hold_until = ? WHERE id = ?', Date.now() - 1000, held);
  const r2 = await reserve(lose); assert.equal(r2.status, 200);
  assert.equal(srv.db.get('SELECT status FROM shop_purchases WHERE id = ?', held).status, 'released');
  // the first player pays after their hold ended and the slot is taken → recorded for a refund, never granted
  const late = await win.post('/api/godshop/manual/submit', { product: ABS, account: acc, reference: 'LATE000001', purchaseId: held });
  assert.equal(late.status, 200); assert.equal(late.data.soldOut, true); assert.equal(late.data.purchase.status, 'review');
  const s2 = await lose.post('/api/godshop/manual/submit', { product: ABS, account: acc, reference: 'WIN0000002', purchaseId: r2.data.purchaseId });
  assert.equal((await approve(s2.data.purchase.id)).status, 200);
  assert.equal((await approve(late.data.purchase.id)).status, 409, 'the edition is full → the late payment cannot be approved');
  assert.equal(srv.db.get('SELECT COUNT(*) AS n FROM edition_owners').n, 2);
  assert.deepEqual(srv.db.all('SELECT serial FROM edition_owners ORDER BY serial').map(x => x.serial), [1, 2]);
  // sold out
  const e = await edition(win); assert.equal(e.soldOut, true); assert.equal(e.available, 0); assert.equal(e.soldOutText, 'SOLD OUT – THE ABSOLUTE ERA IS COMPLETE.');
  const c = await player('abs_too_late'); const rc = await reserve(c); assert.equal(rc.status, 409); assert.equal(rc.data.code, 'SOLD_OUT');
  assert.equal(rc.data.error, 'SOLD OUT – THE ABSOLUTE ERA IS COMPLETE.');
  assert.equal((await owner.post('/api/admin/edition/settings', { supply: 3 })).status, 400, 'more slots only through an official new edition');
  assert.equal((await owner.post('/api/admin/edition/settings', { supply: 1 })).status, 400, 'never below the verified owners');
  // the owner officially releases a new edition
  const rel = await owner.post('/api/admin/edition/release', { add: 1, announcement: 'Edition 2: one more slot.' });
  assert.equal(rel.status, 200); assert.deepEqual([rel.data.edition.edition, rel.data.edition.supply, rel.data.edition.available], [2, 3, 1]);
  assert.equal((await approve(late.data.purchase.id)).status, 200, 'now the waiting refund case can be honoured instead');
  assert.equal((await edition(c)).soldOut, true);
});

test('stress: 12 players race for 3 slots → exactly 3 reservations, never more owners than the supply', async () => {
  await owner.post('/api/admin/edition/release', { add: 3 });
  const ps = await Promise.all(Array.from({ length: 12 }, (_, i) => player('abs_rush_' + i)));
  const rs = await Promise.all(ps.map(reserve));
  assert.equal(rs.filter(r => r.status === 200).length, 3);
  const subs = await Promise.all(ps.map((p, i) => rs[i].status === 200 ? p.post('/api/godshop/manual/submit', { product: ABS, account: acc, reference: 'RUSH0000' + i, purchaseId: rs[i].data.purchaseId }) : null));
  for (const s of subs.filter(Boolean)) assert.equal((await approve(s.data.purchase.id)).status, 200);
  const st = (await owner.get('/api/admin/edition')).data;
  assert.equal(st.owners.length, st.supply); assert.equal(st.soldOut, true);
  assert.deepEqual(st.owners.map(o => o.serial), Array.from({ length: st.supply }, (_, i) => i + 1));
});

test('records are permanent: ownership rows and the ledger cannot be changed or deleted', () => {
  assert.throws(() => srv.db.run('DELETE FROM edition_owners'), /permanent/);
  assert.throws(() => srv.db.run('UPDATE edition_owners SET user_id = 1'), /permanent/);
  assert.throws(() => srv.db.run('DELETE FROM edition_ledger'), /append-only/);
  assert.throws(() => srv.db.run("UPDATE edition_ledger SET event = 'x'"), /append-only/);
  assert.throws(() => srv.db.run("INSERT INTO edition_owners (ball_id, serial, user_id, purchase_id, edition, granted_at) VALUES ('godofabsolute', 1, 1, 'pur_dup', 1, 0)"), /UNIQUE|constraint/i);
  const ev = srv.db.all('SELECT DISTINCT event FROM edition_ledger').map(r => r.event);
  for (const k of ['reserve', 'release', 'grant', 'sold_out_refund', 'restore', 'settings', 'new_edition']) assert.ok(ev.includes(k), k);
});

test('owner panel: owners, pending, completed, errors, restores, settings, announcements', async () => {
  const d = (await owner.get('/api/admin/edition')).data;
  assert.ok(d.owners[0].username && d.completed.length >= 3 && d.ledger.length > 5 && d.restores.length >= 1);
  assert.ok(Array.isArray(d.pending) && Array.isArray(d.errors) && Array.isArray(d.securityEvents));
  assert.equal(d.ultDur, 4);
  const s = await owner.post('/api/admin/edition/settings', { open: false, announcement: 'Paused for maintenance <b>' });
  assert.equal(s.data.edition.open, false); assert.equal(s.data.edition.announcement, 'Paused for maintenance b');
  const p = await player('abs_paused'); await owner.post('/api/admin/edition/release', { add: 1 });
  await owner.post('/api/admin/edition/settings', { open: false });
  assert.equal((await reserve(p)).status, 403, 'purchases paused');
  await owner.post('/api/admin/edition/settings', { open: true });
  assert.equal((await reserve(p)).status, 200);
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'admin.edition_settings'"));
});

/* ---------------- PayMongo path (fake API) ---------------- */
test('PayMongo checkout holds a slot; the signed webhook + server check grants serial & Lv 50; a payment after sell-out is never granted', async () => {
  const sessions = new Map(); let n = 0;
  const pm = http.createServer((req, res) => { let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    const send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && req.url === '/v1/checkout_sessions') { const a = JSON.parse(body).data.attributes, id = 'cs_abs_' + (++n); sessions.set(id, { id, attributes: { ...a, checkout_url: 'https://checkout.paymongo.com/' + id, status: 'active', payments: [], livemode: false } }); return send(200, { data: sessions.get(id) }); }
    const m = req.url.match(/^\/v1\/checkout_sessions\/(.+)$/); if (m) return send(200, { data: sessions.get(decodeURIComponent(m[1])) });
    send(404, {}); }); });
  await new Promise(r => pm.listen(0, '127.0.0.1', r));
  const SECRET = 'whsk_abs';
  const s2 = await startServer({ shop: { secretKey: 'sk_test_x', webhookSecret: SECRET, methods: ['gcash'], liveConfirmed: false, apiBase: `http://127.0.0.1:${pm.address().port}` } });
  try {
    s2.db.run("INSERT INTO app_settings (key, value, updated_at) VALUES ('edition:godofabsolute', ?, 0)", JSON.stringify({ supply: 1, open: true, edition: 1 }));
    const a = new Client(s2.base); await a.register('pm_abs_a'); const b = new Client(s2.base); await b.register('pm_abs_b');
    const ca = await a.post('/api/godshop/checkout', { product: ABS }); assert.equal(ca.status, 200);
    assert.equal((await b.post('/api/godshop/checkout', { product: ABS })).data.code, 'ALL_RESERVED', 'the only slot is held by the open checkout');
    const pay = (pid, uid) => { const row = s2.db.get('SELECT * FROM shop_purchases WHERE id = ?', pid); const s = sessions.get(row.provider_ref); s.attributes.payments.push({ id: 'pay_' + pid, attributes: { status: 'paid', amount: 49900, currency: 'PHP', source: { type: 'gcash' } } }); return row.provider_ref; };
    const hook = async sid => { const raw = JSON.stringify({ data: { id: 'evt_' + crypto.randomBytes(4).toString('hex'), attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: sid } } } }), t = Math.floor(Date.now() / 1000);
      return fetch(s2.base + '/api/godshop/webhook/paymongo', { method: 'POST', headers: { 'content-type': 'application/json', 'paymongo-signature': `t=${t},te=${crypto.createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex')},li=` }, body: raw }); };
    // b gets a checkout after a's hold expires (a never paid in time), then a pays late
    s2.db.run('UPDATE shop_purchases SET hold_until = ? WHERE id = ?', Date.now() - 1, ca.data.purchaseId);
    const cb = await b.post('/api/godshop/checkout', { product: ABS }); assert.equal(cb.status, 200);
    assert.equal((await hook(pay(cb.data.purchaseId))).status, 200);
    assert.equal(s2.db.get('SELECT status FROM shop_purchases WHERE id = ?', cb.data.purchaseId).status, 'paid');
    assert.equal(s2.db.get("SELECT serial FROM edition_owners WHERE user_id = (SELECT id FROM users WHERE username = 'pm_abs_b')").serial, 1);
    assert.equal(s2.db.get("SELECT level FROM user_balls WHERE ball_id = ? AND user_id = (SELECT id FROM users WHERE username = 'pm_abs_b')", ABS).level, 50);
    assert.equal((await hook(pay(ca.data.purchaseId))).status, 200);
    const late = s2.db.get('SELECT * FROM shop_purchases WHERE id = ?', ca.data.purchaseId);
    assert.equal(late.status, 'review'); assert.match(late.note, /refund/);
    assert.equal(s2.db.get('SELECT COUNT(*) AS n FROM edition_owners').n, 1, 'never more owners than the supply');
    assert.ok(!s2.db.get("SELECT owned FROM user_balls WHERE ball_id = ? AND user_id = (SELECT id FROM users WHERE username = 'pm_abs_a')", ABS)?.owned);
  } finally { await s2.stop(); pm.close(); }
});

test('existing player data is backed up before a database migration', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nbb-mig-')), file = path.join(dir, 'game.db'), mig = path.join(__dirname, '..', 'migrations'), part = path.join(dir, 'm');
  fs.mkdirSync(part); for (const f of fs.readdirSync(mig).filter(f => parseInt(f, 10) <= 6)) fs.copyFileSync(path.join(mig, f), path.join(part, f));
  let db = new DB(file); assert.equal(db.migrate(part).length, 6); assert.equal(db.lastBackup, null, 'a brand-new database has nothing to back up');
  db.run("INSERT INTO users (username, pass_hash, created_at) VALUES ('keepme', 'x', 0)");
  db.close(); db = new DB(file);
  const applied = db.migrate(mig); assert.ok(applied.includes('007_edition.sql'));
  assert.ok(db.lastBackup && fs.existsSync(db.lastBackup), 'backup file written');
  const bk = new DB(db.lastBackup); assert.equal(bk.get("SELECT username FROM users WHERE username = 'keepme'").username, 'keepme');
  assert.ok(!bk.get("SELECT 1 FROM sqlite_master WHERE name = 'edition_owners'"), 'the backup is the state before the migration');
  bk.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

/* ---------------- engine ---------------- */
const core = loadCore(); core.setCatalog(null);
const STEP = core.STEP, D = core.getBall(ABS);
function lab({ level = 50, form = 0, godTest = false, enemy = 'fire', seed = 9 } = {}) {
  const T = { v: 2, mode: 'practice', difficulty: 'hard', seed, manual: false, pool: [], opts: { infinite: true, ...(godTest ? { godTest: true } : {}) },
    teams: [[{ ...core.playerSpecFrom(D, { level, evo: 3, up: {}, tree: { slot3: 1, slot4: 1 } }), startForm: form }], [core.enemySpec(core.getBall(enemy), 50, 'hard')]] };
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  const me = B.fighters[0], foe = B.fighters[1]; me.ai = null; foe.ai = null; foe.skills = []; me.st.invuln = foe.st.invuln = 0;
  me.x = 500; me.y = 360; foe.x = 720; foe.y = 380;
  return { B, me, foe };
}
const run = (B, s) => { for (let i = 0; i < s * 240; i++) B.step(STEP); };

test('God of Absolute: identity, price, limited, never an AI opponent, not in fusion / orbs / Premium', () => {
  assert.equal(D.name, 'God of Absolute Ball'); assert.equal(D.godClass, 'LIMITED EXCLUSIVE SUPREME GOD');
  assert.ok(D.paid && D.edition && !D.free && !D.premium && D.noOpponent && !core.fusionEligible(D));
  assert.deepEqual([D.pricePhp, D.startLevel, D.maxLevel, ...D.formLevels], [499, 50, 100, 70, 100]);
  assert.deepEqual([...D.skills.map(s => s.name)], ['ABSOLUTE JUDGMENT', 'REALITY BREAKER', 'CELESTIAL DOMINION', 'INFINITY ERASURE', 'DIVINE REPLICATION']);
  assert.deepEqual([D.ult.name, D.finalUlt.name, D.passiveInfo.name], ['ABSOLUTE ZERO – END OF ALL DIMENSIONS', 'OMNIVERSAL ABSOLUTE DOMINION', 'ABSOLUTE AUTHORITY']);
  assert.deepEqual([...D.forms.map(f => f.name)], ['ABSOLUTE DIVINITY', 'CELESTIAL SOVEREIGN', 'THE UNRIVALED ONE']);
  assert.ok(!core.allBalls().filter(b => b.enabled && !b.noOpponent).some(b => b.id === ABS));
  assert.ok(core.limitedGodIds().includes(ABS));
});

test('a fresh Lv 50 owner has all five skills (no skill-tree slots needed)', () => {
  const T = core.createTicket({ mode: '1v1', ball: ABS, enemy: 'fire', difficulty: 'normal' }, { level: 50, evo: 0, up: {}, tree: {} }, () => 0.5);
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  assert.equal(B.player.skills.length, 5); assert.equal(B.player.skills.filter(s => s.locked).length, 0);
});

test('forms unlock with its own level: Lv 50 base only, Lv 70 Celestial Sovereign, Lv 100 The Unrivaled One', () => {
  for (const [lv, cap] of [[50, 0], [69, 0], [70, 1], [99, 1], [100, 2]]) assert.equal(lab({ level: lv }).me.formCap, cap, 'Lv ' + lv);
  assert.equal(lab({ level: 50, godTest: true }).me.formCap, 2, 'practice test shows every form');
  const a = lab({ level: 50 }).me, b = lab({ level: 100 }).me;
  assert.ok(b.maxHp > a.maxHp && b.maxHp < a.maxHp * 1.15, 'Lv 51–100 add only a little raw power');
});

test('all 5 skills × 3 forms do something different and leave nothing behind', () => {
  const sig = {};
  for (let form = 0; form < 3; form++) for (const s of D.skills) {
    const { B, me, foe } = lab({ level: 100, form }); const hp0 = foe.hp;
    const sk = me.skills.find(x => x.type === s.type); sk.locked = false; sk.cdLeft = 0; me.target = foe; assert.notEqual(core.useSkill(me, sk), false, s.type);
    run(B, 9);
    const after = [Math.round(hp0 - foe.hp), B.zones.length, B.lasers.length, B.projs.length, B.fighters.filter(f => f.absCopy && f.alive).length, !!(me.sx.dominion)];
    sig[s.type] = sig[s.type] || []; sig[s.type].push(JSON.stringify(after));
    assert.ok(hp0 - foe.hp > 0 || s.type === 'ab_dominion' || s.type === 'ab_replica', `${s.type} form ${form} deals damage`);
    assert.equal(B.zones.filter(z => z.absReality).length, 0, 'reality fields end'); assert.ok(!me.sx.dominion, 'rings end');
    assert.equal(B.fighters.filter(f => f.absCopy && f.alive).length, 0, 'copies vanish');
  }
});

test('Divine Replication: copies never exceed the cap (2 / 2 / 3, +1 from Lv 80, never more than 3); re-casting renews instead of adding', () => {
  for (const [lv, form, cap] of [[50, 0, 2], [79, 1, 2], [80, 0, 3], [80, 1, 3], [100, 2, 3]]) {
    const { B, me, foe } = lab({ level: lv, form }); const i = me.skills.findIndex(s => s.type === 'ab_replica');
    for (let k = 0; k < 4; k++) { me.skills[i].cdLeft = 0; me.skills[i].locked = false; me.target = foe; core.useSkill(me, me.skills[i]); B.step(STEP); }
    assert.equal(B.fighters.filter(f => f.absCopy && f.alive).length, cap, `Lv ${lv} form ${form}`);
    assert.ok(B.fighters.filter(f => f.absCopy).every(c => c.isClone && c.owner === me));
  }
});

test('ABSOLUTE ZERO and OMNIVERSAL ABSOLUTE DOMINION: full sequence, damage, then the arena is exactly as before', () => {
  for (const omni of [false, true]) {
    const { B, me, foe } = lab({ level: 100, form: omni ? 2 : 0 }); const hp0 = foe.hp, cond0 = JSON.stringify(B.cond || null), arena0 = JSON.stringify(B.arena || null);
    core.absUlt(me, omni, 120);
    assert.ok(me.sx.absUltT > 0 && me.casting > 0, 'it stops and rises');
    run(B, 6);
    assert.ok(foe.hp < hp0, 'damage dealt');
    assert.equal(me.sx.absUltT, 0); assert.equal(me.sx.liftT, 0);
    assert.equal(JSON.stringify(B.cond || null), cond0); assert.equal(JSON.stringify(B.arena || null), arena0);
    assert.equal(B.lasers.length + B.zones.length, 0, 'nothing left in the arena');
  }
});

test('determinism: the same God of Absolute battle replays identically (server verification), including PvP', () => {
  const play = seed => { const T = { v: 2, mode: '1v1', difficulty: 'hard', seed, manual: false, pool: [], opts: {}, teams: [[{ ...core.playerSpecFrom(D, { level: 100, evo: 3, up: {}, tree: { slot3: 1, slot4: 1 } }) }], [core.enemySpec(core.getBall('seraphim'), 50, 'hard')]] };
    const B = new core.Battle(core.buildBattleConfig(T, { headless: true })); for (let i = 0; i < 240 * 150 && !B.result; i++) B.step(STEP); return JSON.stringify([B.result && B.result.win, B.fighters.map(f => Math.round(f.hp)), B.time.toFixed(3)]); };
  assert.equal(play(31), play(31)); assert.equal(play(77), play(77));
  if (core.createPvpTicket) {
    const T = core.createPvpTicket([{ ball: ABS, level: 100, evo: 3, up: {}, tree: {}, name: 'a' }, { ball: 'godportal', level: 50, evo: 3, up: {}, tree: {}, name: 'b' }], 1234);
    const go = () => { const B = new core.Battle(core.buildBattleConfig(T, { headless: true })); for (let i = 0; i < 240 * 150 && !B.result; i++) B.step(STEP); return JSON.stringify([B.result && B.result.winner, B.fighters.map(f => Math.round(f.hp))]); };
    assert.equal(go(), go());
  }
});
