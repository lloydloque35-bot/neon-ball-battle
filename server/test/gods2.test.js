'use strict';
/**
 * 2.3.0 PREMIUM GOD BALLS: God of Guns + God Portal (PHP 99 each), the Infinite Void, and the PayMongo shop.
 * A local fake PayMongo API stands in for the real one (same request/response shapes), so the whole purchase flow —
 * checkout, signed webhook, server-side verification, ownership, restore — is exercised without real money.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { startServer, Client } = require('./helpers');
const { loadCore } = require('../core');
const { VERSION } = require('../app');
const { verifyPaymongoSignature } = require('../shop');

const core = loadCore(); core.setCatalog(null);
const STEP = core.STEP, PAID = ['godofguns', 'godportal'];
const run = (B, sec) => { for (let i = 0; i < sec * 240 && !B.result; i++) B.step(STEP); };
const prog = lv => ({ level: lv, evo: 1, up: {}, tree: { slot3: 1, slot4: 1 } });

/* ---------------- a fake PayMongo API ---------------- */
function fakePaymongo() {
  const sessions = new Map(); let n = 0, auth = null;
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
      auth = req.headers.authorization; const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (!/^Basic /.test(auth || '')) return send(401, { errors: [{ code: 'unauthorized' }] });
      if (req.method === 'POST' && req.url === '/v1/checkout_sessions') { const a = JSON.parse(body).data.attributes, id = 'cs_test_' + (++n);
        sessions.set(id, { id, attributes: { ...a, checkout_url: 'https://checkout.paymongo.com/' + id, status: 'active', payments: [], livemode: false } }); return send(200, { data: sessions.get(id) }); }
      const m = req.url.match(/^\/v1\/checkout_sessions\/(.+)$/); if (req.method === 'GET' && m) { const s = sessions.get(decodeURIComponent(m[1])); return s ? send(200, { data: s }) : send(404, { errors: [{ code: 'not_found' }] }); }
      if (req.method === 'GET' && req.url === '/v1/webhooks') return send(200, { data: [{ attributes: { url: 'https://example.test/api/godshop/webhook/paymongo', status: 'enabled', events: ['checkout_session.payment.paid'] } }] });
      if (req.method === 'POST' && req.url === '/v1/webhooks') return send(200, { data: { id: 'hook_1', attributes: { secret_key: 'whsk_registered_secret', url: JSON.parse(body).data.attributes.url } } });
      send(404, {});
    });
  });
  return { srv, sessions, pay(id, amount, currency = 'PHP') { const s = sessions.get(id); s.attributes.payments.push({ id: 'pay_' + id + '_' + s.attributes.payments.length, attributes: { status: 'paid', amount, currency, source: { type: 'gcash' } } }); s.attributes.status = 'completed'; } };
}
const SECRET = 'whsk_test_secret_123';
function signed(evt, secret = SECRET, t = Math.floor(Date.now() / 1000)) { const raw = JSON.stringify(evt); return { raw, sig: `t=${t},te=${crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')},li=` }; }
const paidEvent = (sessionId, id = 'evt_' + crypto.randomBytes(4).toString('hex')) => ({ data: { id, type: 'event', attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: sessionId, type: 'checkout_session' } } } });
async function postWebhook(base, evt, opt = {}) { const { raw, sig } = signed(evt, opt.secret, opt.t); const r = await fetch(base + '/api/godshop/webhook/paymongo', { method: 'POST', headers: { 'content-type': 'application/json', 'paymongo-signature': opt.sig || sig }, body: raw }); return { status: r.status, data: await r.json().catch(() => ({})) }; }

let pm, pmBase, srv, closed, buyer, other;
test.before(async () => {
  pm = fakePaymongo(); await new Promise(r => pm.srv.listen(0, '127.0.0.1', r)); pmBase = `http://127.0.0.1:${pm.srv.address().port}`;
  srv = await startServer({ shop: { secretKey: 'sk_test_fake', webhookSecret: SECRET, methods: ['gcash', 'paymaya', 'qrph'], liveConfirmed: false, apiBase: pmBase } });
  closed = await startServer({ shop: { secretKey: '', webhookSecret: '', methods: ['gcash'], liveConfirmed: false, apiBase: pmBase } });
  buyer = new Client(srv.base); await buyer.register('gun_buyer'); other = new Client(srv.base); await other.register('portal_fan');
});
test.after(async () => { await srv.stop(); await closed.stop(); pm.srv.close(); });

test('shop not configured: closed, nothing can be charged or granted (never simulated)', async () => {
  const c = new Client(closed.base); await c.register('early_bird');
  const s = (await c.get('/api/godshop')).data; assert.equal(s.enabled, false);
  assert.equal((await c.post('/api/godshop/checkout', { product: 'godofguns' })).status, 503);
  assert.equal((await c.post('/api/battle/start', { mode: '1v1', ball: 'godofguns' })).status, 403);
  assert.equal(closed.db.get('SELECT COUNT(*) AS n FROM shop_purchases').n, 0);
});

test('before buying: not playable, not for coins, not from orbs; a free practice trial works', async () => {
  const s = (await buyer.get('/api/godshop')).data;
  assert.equal(s.enabled, true); assert.deepEqual(s.products.map(p => [p.id, p.price]), [['godofguns', 99], ['godportal', 99], ['god_bundle', 198], ['godofabsolute', 499], ['anti', 999], ['battlepass', 299], ['coins_10k', 99], ['coins_1m', 999], ['fatenote', 99]]);   // 2.4.0 adds the limited edition, 2.7.0 the Battle Pass and coin packs, 2.8.0 Anti Ball, 2.9.0 Fate Note
  assert.deepEqual(s.methods.map(m => m.id), ['gcash', 'paymaya', 'qrph']);
  assert.equal((await buyer.post('/api/battle/start', { mode: '1v1', ball: 'godofguns' })).status, 403);
  assert.equal((await buyer.post('/api/shop/unlock', { ball: 'godofguns' })).status, 400, 'no coin unlock');
  assert.equal((await buyer.post('/api/battle/start', { mode: 'practice', ball: 'godportal', trial: true, godTest: true, startForm: 2, dummy: true })).status, 200, 'free practice test');
  for (const id of PAID) { const d = core.getBall(id); assert.ok(d.paid && !d.free && !d.premium && !core.fusionEligible(d)); }
});

test('purchase: checkout → signed webhook → server verifies with PayMongo → permanent ownership', async () => {
  const co = await buyer.post('/api/godshop/checkout', { product: 'godofguns' });
  assert.equal(co.status, 200); assert.match(co.data.url, /^https:\/\/checkout\.paymongo\.com\//);
  const row = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co.data.purchaseId); assert.equal(row.status, 'pending'); assert.equal(row.amount, 9900);
  const sess = pm.sessions.get(row.provider_ref);
  assert.equal(sess.attributes.reference_number, row.id); assert.deepEqual(sess.attributes.line_items.map(l => [l.amount, l.currency]), [[9900, 'PHP']]); assert.deepEqual(sess.attributes.payment_method_types, ['gcash', 'paymaya', 'qrph']);
  // the same checkout is reused instead of opening a second one
  assert.equal((await buyer.post('/api/godshop/checkout', { product: 'godofguns' })).data.purchaseId, row.id);
  // returning from the checkout page WITHOUT paying grants nothing
  assert.equal((await buyer.post(`/api/godshop/purchases/${row.id}/check`)).data.purchase.status, 'pending');
  // a webhook with a bad signature, or a replayed old one, is rejected
  assert.equal((await postWebhook(srv.base, paidEvent(row.provider_ref), { secret: 'wrong' })).status, 400);
  assert.equal((await postWebhook(srv.base, paidEvent(row.provider_ref), { t: Math.floor(Date.now() / 1000) - 3600 })).status, 400);
  // a correctly signed webhook BEFORE the payment exists at PayMongo grants nothing (the server checks PayMongo itself)
  assert.equal((await postWebhook(srv.base, paidEvent(row.provider_ref))).status, 200);
  assert.equal(srv.db.get('SELECT status FROM shop_purchases WHERE id = ?', row.id).status, 'pending');
  // now the player pays PHP 99 with GCash
  pm.pay(row.provider_ref, 9900);
  const evt = paidEvent(row.provider_ref);
  assert.equal((await postWebhook(srv.base, evt)).status, 200);
  const done = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', row.id);
  assert.equal(done.status, 'paid'); assert.equal(done.method, 'gcash');
  assert.ok(srv.db.get("SELECT 1 FROM user_balls u JOIN users x ON x.id = u.user_id WHERE x.username = 'gun_buyer' AND u.ball_id = 'godofguns' AND u.owned = 1"));
  assert.equal((await postWebhook(srv.base, evt)).data.duplicate, true, 'each event is processed once');
  assert.equal((await buyer.post('/api/battle/start', { mode: '1v1', ball: 'godofguns', difficulty: 'easy' })).status, 200, 'playable after purchase');
  assert.equal((await buyer.post('/api/godshop/checkout', { product: 'godofguns' })).status, 409, 'no duplicate purchase');
  assert.equal((await buyer.post('/api/godshop/checkout', { product: 'god_bundle' })).status, 409, 'bundle blocked when one is owned');
  // ownership survives a new session (another device)
  const again = new Client(srv.base); assert.equal((await again.post('/api/auth/login', { username: 'gun_buyer', password: 'Sup3r-Secret-Pass!' })).status, 200);
  assert.ok((await again.get('/api/save')).data.balls.godofguns.owned);
  const hist = (await again.get('/api/godshop/purchases')).data.purchases; assert.equal(hist[0].status, 'paid'); assert.equal(hist[0].amount, 99);
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'shop.purchase_paid'"));
});

test('wrong amount is never granted; a missed webhook is recovered by "check" / "restore"; the bundle grants both', async () => {
  const co = await other.post('/api/godshop/checkout', { product: 'godportal' }); const row = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', co.data.purchaseId);
  pm.pay(row.provider_ref, 100);       // PHP 1 instead of PHP 99
  await postWebhook(srv.base, paidEvent(row.provider_ref));
  assert.equal(srv.db.get('SELECT status FROM shop_purchases WHERE id = ?', row.id).status, 'review');
  assert.ok(srv.db.get("SELECT 1 FROM security_events WHERE kind = 'shop_amount_mismatch'"));
  assert.equal((await other.post('/api/battle/start', { mode: '1v1', ball: 'godportal' })).status, 403);
  // bundle: paid at PayMongo, but the webhook never arrives — "check" after returning confirms it server-side
  const c3 = new Client(srv.base); await c3.register('bundle_buyer');
  const b = await c3.post('/api/godshop/checkout', { product: 'god_bundle' }); const br = srv.db.get('SELECT * FROM shop_purchases WHERE id = ?', b.data.purchaseId);
  assert.equal(br.amount, 19800); pm.pay(br.provider_ref, 19800);
  const chk = await c3.post(`/api/godshop/purchases/${br.id}/check`); assert.equal(chk.data.purchase.status, 'paid'); assert.deepEqual(chk.data.owned.slice().sort(), PAID.slice().sort());
  // restore re-grants ownership if it ever went missing
  srv.db.run("UPDATE user_balls SET owned = 0 WHERE ball_id = 'godportal' AND user_id = (SELECT id FROM users WHERE username = 'bundle_buyer')");
  const rs = await c3.post('/api/godshop/restore'); assert.equal(rs.data.restored, 1); assert.ok(rs.data.owned.includes('godportal'));
  // another player cannot check or see someone else's purchase
  assert.equal((await other.post(`/api/godshop/purchases/${br.id}/check`)).status, 404);
});

test('owner setup panel: status without secrets, test connection, webhook registration; players are refused', async () => {
  assert.ok([401, 403].includes((await buyer.get('/api/admin/godshop')).status));
  assert.ok([401, 403].includes((await buyer.post('/api/admin/godshop/register-webhook')).status));
  assert.equal(verifyPaymongoSignature('{}', 't=1,te=abc', 'k', false), false);
  const t = Math.floor(Date.now() / 1000), raw = '{"a":1}', li = crypto.createHmac('sha256', 'k').update(`${t}.${raw}`).digest('hex');
  assert.ok(verifyPaymongoSignature(raw, `t=${t},te=,li=${li}`, 'k', true)); assert.ok(!verifyPaymongoSignature(raw, `t=${t},te=${li},li=`, 'k', true), 'live events need the live signature');
});

/* ---------------- engine ---------------- */
function lab(id, { form = 0, enemy = 'fire', seed = 7 } = {}) {
  const T = { v: 2, mode: 'practice', difficulty: 'hard', seed, manual: false, pool: [], opts: { infinite: true },
    teams: [[{ ...core.playerSpecFrom(core.getBall(id), prog(30)), startForm: form }], [core.enemySpec(core.getBall(enemy), 30, 'hard')]] };
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  const me = B.fighters[0], foe = B.fighters[1];
  me.ai = null; foe.ai = null; foe.skills = []; me.st.invuln = foe.st.invuln = 0;
  me.x = 500; me.y = 360; foe.x = 760; foe.y = 380; me.vx = 120; me.vy = 60; foe.vx = -100; foe.vy = 40;
  return { B, me, foe };
}
const snap = (B, me, foe) => JSON.stringify([Math.round(foe.hp), Math.round(me.hp), B.projs.length, B.zones.length, B.lasers.length, B.waves.length, B.strikes.length, B.fighters.length, B.timers.length,
  Object.keys(me.sx).filter(k => me.sx[k] && typeof me.sx[k] !== 'function'), Object.keys(foe.st).filter(k => foe.st[k] > 0), Math.round(foe.x), Math.round(me.x), me.casting > 0, !!me.temp]);

test('both Premium God Balls: 5 skills x 3 versions, every form different, all forms unlocked for owners', () => {
  assert.equal(core.GAME_VERSION, VERSION); assert.deepEqual([...core.paidGodIds()], PAID);
  const sig = {};
  for (const id of PAID) {
    const d = core.getBall(id); assert.equal(d.skills.filter(s => !s.v26).length, 5); assert.equal(d.forms.length, 3); assert.ok(d.finalUlt && d.ult);
    const T = { v: 2, mode: '1v1', difficulty: 'hard', seed: 1, manual: false, pool: [], opts: {}, teams: [[core.playerSpecFrom(d, prog(1))], [core.enemySpec(core.getBall('fire'), 1, 'easy')]] };
    assert.equal(new core.Battle(core.buildBattleConfig(T, { headless: true })).fighters[0].formCap, 2, 'bought: every form from Lv 1');
    for (let form = 0; form < 3; form++) d.skills.forEach((s, i) => {
      if (s.v26) return;      // (the 2.6.0 abilities have their own tests)
      const { B, me, foe } = lab(id, { form, enemy: s.type === 'gn_copy' ? 'thunder' : 'fire' });
      if (s.type === 'gn_copy') foe.skills = core.getBall('thunder').skills.map(x => ({ ...x, cdLeft: 5 }));
      run(B, 0.05); const before = snap(B, me, foe), hp0 = foe.hp; me.skills[i].cdLeft = 0;
      assert.ok(core.useSkill(me, me.skills[i]), `${id} ${s.name} @${form}`);
      const after = snap(B, me, foe); let mp = 0, ml = 0, mz = 0;
      for (let k = 0; k < 240 * 4; k++) { B.step(STEP); mp = Math.max(mp, B.projs.length); ml = Math.max(ml, B.lasers.length); mz = Math.max(mz, B.zones.length); }
      assert.ok(before !== after || hp0 - foe.hp > 0.5, `${id} ${s.name} @${form} does something`);
      (sig[id + s.type] || (sig[id + s.type] = [])).push(`${Math.round(hp0 - foe.hp)}|${mp}|${ml}|${mz}`);
    });
  }
  for (const [k, v] of Object.entries(sig)) assert.ok(!(v[0] === v[1] && v[1] === v[2]), k + ' changes between forms');
});

test('ultimates: God of Guns arsenal + apocalypse; forms through ultimates', () => {
  const { B, me, foe } = lab('godofguns', { seed: 9 });
  me.ultMeter = 100; core.useUltimate(me); run(B, 4); assert.equal(me.form, 1);
  me.ultMeter = 100; core.useUltimate(me); run(B, 4); assert.equal(me.form, 2); assert.equal(me.ult.type, 'gn_apocalypse');
  const hp0 = foe.hp; me.ultMeter = 100; core.useUltimate(me); run(B, 5); assert.ok(foe.hp < hp0 || foe.hp === foe.maxHp, 'apocalypse hits');
});

test('INFINITE VOID: a separate dimension — enter, fight, hazards, copies, collapse, safe return; bystanders untouched', () => {
  const T = core.createTicket({ mode: 'ffa', ball: 'godportal', difficulty: 'hard', ffaCount: 3 }, prog(30), () => 0.5); T.seed = 77;
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  const gp = B.player, [a, c] = B.fighters.filter(f => f.team !== 0);
  gp.ai = null; a.ai = null; c.ai = null; a.skills = []; c.skills = []; gp.st.invuln = a.st.invuln = c.st.invuln = 0;
  gp.x = 400; gp.y = 360; a.x = 520; a.y = 360; c.x = 1120; c.y = 170; c.anchored = true;     // the bystander waits in a far corner
  run(B, 0.1); gp.ultMeter = 100; assert.ok(core.useUltimate(gp)); run(B, 0.3);      // awakening cinematic + ultimate
  let d = B.voidDim; assert.ok(d && d.phase === 'gate', 'the gateway opens');
  const cBefore = { x: c.x, hp: c.hp };
  run(B, 1.0); d = B.voidDim; assert.equal(d.phase, 'battle');
  assert.equal(gp.dim, d.id); assert.equal(a.dim, d.id, 'the nearest opponent is taken'); assert.equal(c.dim || 0, 0, 'the other player stays in the arena');
  assert.ok(!c.enemies().includes(gp) && !gp.enemies().includes(c), 'different dimensions never see each other');
  assert.equal(core.dealDamage(c, gp, 50, { kind: 'skill' }), 0, 'no damage across dimensions');
  run(B, 1.2); const copies = B.fighters.filter(f => f.voidCopy && f.alive); assert.ok(copies.length >= 2 && copies.every(x => x.dim === d.id), 'copies of other balls appear inside the void');
  const ah = a.hp; run(B, 2.5); assert.ok(a.hp < ah, 'portal attacks / hazards / gravity hurt the opponent');
  assert.ok(Math.abs(c.hp - cBefore.hp) < 1e-9, 'the bystander is untouched by anything in the void');
  run(B, 4); assert.ok(!B.voidDim, 'the void ends');
  assert.equal(gp.dim, 0); assert.equal(a.dim, 0); assert.ok(!B.fighters.some(f => f.alive && f.voidCopy), 'no summoned copies are left behind');
  assert.ok(!B.projs.some(p => p.dim), 'nothing from the void leaks into the arena');
});

test('INFINITE VOID: God Portal falling inside ends it at once; the final form takes two opponents into three linked dimensions', () => {
  const { B, me, foe } = lab('godportal', { seed: 3 });
  run(B, 0.1); me.ultMeter = 100; core.useUltimate(me); run(B, 1.4);
  assert.ok(B.voidDim && me.dim === B.voidDim.id);
  me.st.invuln = 0; me.hp = 1; core.dealDamage(foe, me, 5000, { kind: 'skill', noDef: true });
  for (let i = 0; i < 72; i++) B.step(STEP);       // keep simulating past the end of the battle
  assert.ok(!me.alive); assert.ok(!B.voidDim, 'the void closes when its ruler falls'); assert.equal(foe.dim, 0, 'the survivor returns');
  const T = core.createTicket({ mode: 'ffa', ball: 'godportal', difficulty: 'hard', ffaCount: 4 }, prog(30), () => 0.3); T.seed = 21; T.teams[0][0].startForm = 2;
  const B2 = new core.Battle(core.buildBattleConfig(T, { headless: true })); const g = B2.player; g.ai = null; g.formCap = 2;
  run(B2, 0.1); g.ultMeter = 100; assert.equal(g.ult.type, 'pt_omniverse'); core.useUltimate(g); run(B2, 1.3);
  const d = B2.voidDim; assert.ok(d && d.final && d.bands.length === 3);
  assert.equal(B2.fighters.filter(f => f.alive && f.dim === d.id && !f.isClone && f !== g).length, 2, 'two opponents are taken');
  run(B2, 9); assert.ok(!B2.voidDim); assert.ok(B2.fighters.every(f => !f.dim));
});

test('PvP with the Infinite Void replays identically, and deterministic AI battles finish', () => {
  const pl = id => ({ ball: id, level: 25, evo: 2, up: {}, tree: { slot3: 1, slot4: 1 }, name: id });
  const T = core.createPvpTicket([pl('godportal'), pl('godofguns')], 4321, 'duel');
  const inputs = [[60, 0, 'k', 0], [240, 1, 'k', 0], [480, 0, 'k', 2], [700, 0, 'u', 0], [701, 1, 'u', 0], [1500, 0, 'k', 4]];
  const r1 = core.simulateTicket(T, inputs, 240 * 150), r2 = core.simulateTicket(JSON.parse(JSON.stringify(T)), inputs, 240 * 150);
  assert.ok(r1.ok); assert.deepEqual([r1.winner, r1.step, Math.round(r1.hpPct * 1e6)], [r2.winner, r2.step, Math.round(r2.hpPct * 1e6)]);
  for (const [a, b] of [['godportal', 'infinity'], ['godofguns', 'godofchaos']]) {
    const T2 = { v: 2, mode: '1v1', difficulty: 'hard', seed: 5, manual: false, pool: [], opts: {}, teams: [[core.playerSpecFrom(core.getBall(a), prog(25))], [core.enemySpec(core.getBall(b), 25, 'hard')]] };
    const x = core.simulateTicket(T2, [], 240 * 150), y = core.simulateTicket(JSON.parse(JSON.stringify(T2)), [], 240 * 150);
    assert.ok(x.ok); assert.deepEqual([x.win, x.step], [y.win, y.step]);
  }
});
