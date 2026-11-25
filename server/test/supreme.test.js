'use strict';
/**
 * 2.1.0 SUPREME ADMIN BALLS: every ball, ability, ultimate and transformation is exercised on the shared
 * (headless) game core; the ADMIN DELETE console is checked as replayable inputs; and the server keeps the
 * whole collection owner-only (battles, test battles, tuning, admin commands).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const S_ = require('../security');
const { startServer, Client } = require('./helpers');
const { createOwner, confirmTotp } = require('../cli/owner');
const { loadCore } = require('../core');
const { VERSION } = require('../app');

const core = loadCore(); core.setCatalog(null);
const STEP = core.STEP;
const IDS = ['realitycontroller', 'skullking', 'voidemperor', 'thundergod', 'archangel', 'demonlord', 'glitch404', 'dragonemperor', 'bloodmoongod', 'timegod', 'infinitygod', 'phoenixgod', 'blacksun', 'mirrorgod', 'omega'];
const MAXP = { level: 50, evo: 3, up: {}, tree: {} };
const run = (B, sec) => { for (let i = 0; i < sec * 240 && !B.result; i++) B.step(STEP); };

/* a practice battle against a passive target so every ability can be measured */
function lab(id, enemy = 'fire', seed = 7) {
  const T = { v: 2, mode: 'practice', difficulty: 'hard', seed, manual: false, pool: [], opts: { infinite: true },
    teams: [[core.playerSpecFrom(core.getBall(id), MAXP)], [core.enemySpec(core.getBall(enemy), 50, 'hard')]] };
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  const me = B.fighters[0], foe = B.fighters[1];
  me.ai = null; foe.ai = null; foe.skills = []; me.st.invuln = foe.st.invuln = 0;
  me.x = 500; me.y = 360; foe.x = 760; foe.y = 380; me.vx = 120; me.vy = 60; foe.vx = -100; foe.vy = 40;
  return { B, me, foe };
}
const world = (B, me, foe) => JSON.stringify([Math.round(foe.hp), Math.round(me.hp), B.projs.length, B.zones.length, B.lasers.length, B.waves.length, B.strikes.length, B.fighters.length, B.timers.length, (B.portalPairs || []).length,
  B.cond && B.cond.kind, Object.keys(me.sx).filter(k => me.sx[k] > 0), Object.keys(foe.sx || {}).filter(k => foe.sx[k] > 0), Object.keys(foe.st).filter(k => foe.st[k] > 0), Object.keys(me.st).filter(k => k !== 'invuln' && me.st[k] > 0),
  Math.round(foe.x), Math.round(foe.y), Math.round(me.x), Math.round(me.y)]);

/* ---------------- server: owner-only everything ---------------- */
let srv, owner, player, secret, ctr;
const nextCode = () => S_.totpCode(secret, ++ctr);
test.before(async () => {
  srv = await startServer();
  await createOwner(srv.db, { username: 'Boss', password: 'Owner-Pass-9876!' });
  const pending = srv.db.get("SELECT totp_pending FROM users WHERE role = 'owner'").totp_pending;
  ctr = Math.floor(Date.now() / 30000) - 1;
  assert.ok(confirmTotp(srv.db, S_.totpCode(pending, ctr)));
  secret = pending;
  owner = new Client(srv.base);
  assert.equal((await owner.post('/api/auth/login', { username: 'Boss', password: 'Owner-Pass-9876!', code: nextCode() })).status, 200);
  player = new Client(srv.base); await player.register('normal_joe');
});
test.after(async () => { await srv.stop(); });

test('players cannot use, test, fight against or tune Supreme balls', async () => {
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: 'skullking', difficulty: 'normal' })).status, 403);
  assert.equal((await player.post('/api/battle/start', { mode: 'practice', ball: 'skullking', adminTest: true })).status, 403);
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: 'fire', enemy: 'realitycontroller' })).status, 400, 'not even as an opponent');
  assert.ok([401, 403].includes((await player.get('/api/admin/supreme')).status));
  assert.ok([401, 403].includes((await player.post('/api/admin/supreme/skullking', { cdMul: 0.2 })).status));
  const save = (await player.get('/api/save')).data;
  for (const id of IDS) assert.ok(!(save.balls && save.balls[id] && save.balls[id].owned), id + ' never owned by a player');
});

test('forged admin commands from a player are rejected and logged', async () => {
  const st = await player.post('/api/battle/start', { mode: '1v1', ball: 'fire', difficulty: 'easy' });
  assert.equal(st.status, 200);
  const r = await player.post('/api/battle/finish', { id: st.data.ticket.id, inputs: [[5, 'x', 1, 2, 0, 0]], claimed: { win: true, step: 10 } });
  assert.equal(r.status, 403);
  assert.ok(srv.db.get("SELECT 1 FROM security_events WHERE kind = 'admin_command_forged'"));
  const bad = await player.post('/api/battle/start', { mode: '1v1', ball: 'fire', difficulty: 'easy' });
  assert.equal((await player.post('/api/battle/finish', { id: bad.data.ticket.id, inputs: [[5, 'x', 77, 2, 0, 0]], claimed: { win: true, step: 10 } })).status, 400, 'unknown commands are malformed');
});

test('owner: Control Panel settings are validated, audit-logged and reach the battle catalog', async () => {
  const l = await owner.get('/api/admin/supreme');
  assert.equal(l.status, 200); assert.equal(l.data.balls.length, 15);
  assert.equal((await owner.post('/api/admin/supreme/fire', { cdMul: 1 })).status, 400, 'only Supreme balls');
  assert.equal((await owner.post('/api/admin/supreme/skullking', { off: [0, 1, 2, 3, 4] })).status, 400, 'at least one ability stays on');
  const ok = await owner.post('/api/admin/supreme/skullking', { cdMul: 9, off: [1, 1, 7, -1], fx: 0.5, aura: false });
  assert.equal(ok.status, 200); assert.deepEqual(ok.data.tuning, { cdMul: 3, off: [1], fx: 0.5, aura: false });
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'admin.supreme_tuning' AND target = 'skullking'"));
  const cat = (await owner.get('/api/catalog')).data;
  assert.deepEqual(cat.tuning.skullking.off, [1]);
  // the tuning is applied inside the engine (cooldowns ×3, ability 2 switched off)
  core.setCatalog(cat);
  const T = core.createTicket({ mode: '1v1', ball: 'skullking', enemy: 'fire', difficulty: 'normal' }, MAXP, () => 0.5);
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true })); const me = B.player;
  assert.equal(me.skills[0].cd, core.getBall('skullking').skills[0].cd * 3);
  assert.ok(me.skills[1].locked);
  core.setCatalog(null);
  assert.equal((await owner.post('/api/admin/supreme/skullking', { reset: true })).status, 200);
});

test('owner: Spawn & Test battles start in the chosen form; admin commands are audit-logged', async () => {
  const st = await owner.post('/api/battle/start', { mode: 'practice', ball: 'timegod', adminTest: true, startForm: 2, dummy: true, infinite: true });
  assert.equal(st.status, 200);
  const T = st.data.ticket; assert.equal(T.opts.adminTest, true); assert.equal(T.teams[0][0].startForm, 2);
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  assert.equal(B.player.form, 2, 'starts in the Final God form'); assert.equal(B.player.ult.type, 'endoftime');
  B.applyAction(['x', 9, B.player.sid, 0, 0]); assert.equal(B.player.form, 0, 'test bar: back to base');
  B.applyAction(['x', 10, B.player.sid, 0, 0]); assert.equal(B.player.ultMeter, 100, 'test bar: ultimate ready');
  assert.equal((await owner.post('/api/battle/start', { mode: '1v1', ball: 'timegod', adminTest: true })).status, 403, 'test battles are Practice only');
  const fin = await owner.post('/api/battle/finish', { id: T.id, inputs: [[3, 'x', 9, 1, 1, 0]], claimed: { win: false, step: 4 } });
  assert.equal(fin.status, 200);
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'admin.delete_console'"));
  assert.ok(srv.db.get("SELECT 1 FROM audit_logs WHERE action = 'admin.supreme_test'"));
  const h = (await owner.get('/api/health')).data; assert.equal(h.version, VERSION);
});

/* ---------------- engine (long synchronous simulations run after the server tests) ---------------- */
test('15 Supreme Admin balls: owner-only, 5 unique abilities, 2 ultimates and 3 forms each', () => {
  assert.equal(core.GAME_VERSION, VERSION);
  assert.deepEqual([...core.supremeIds()].sort(), IDS.slice().sort());
  const seen = new Map();
  for (const id of IDS) {
    const d = core.getBall(id);
    assert.ok(d && d.supreme && d.adminOnly, id + ' is a Supreme admin ball');
    assert.equal(d.rarity, 'Admin Exclusive');
    assert.equal(d.skills.length, 5, id + ' has 5 abilities');
    assert.equal(d.forms.length, 3, id + ' has 3 forms');
    assert.ok(d.finalUlt && d.finalUlt.type !== d.ult.type && core.ULT_TYPES[d.finalUlt.type] && core.ULT_TYPES[d.ult.type], id + ' has an ultimate and a final-form ultimate');
    for (const s of [...d.skills, d.ult, d.finalUlt]) { assert.ok(!seen.has(s.type), `${s.type} is used only once (${id}, ${seen.get(s.type)})`); seen.set(s.type, id); }
    for (const s of d.skills) assert.ok(core.SKILL_TYPES[s.type], s.type + ' registered');
    for (let k = 1; k < 3; k++) assert.notEqual(JSON.stringify(core.formDef(d, k).design), JSON.stringify(d.design), `${id} form ${k} looks different`);
    assert.ok(d.sound && d.sound.base, id + ' has its own sound profile');
  }
  assert.ok(!core.opponentPool(false).some(b => b.supreme && b.adminOnly), 'never a random opponent for players');
});

test('upgraded balls keep their ids; god versions leave the player balls untouched', () => {
  for (const id of ['archangel', 'voidemperor', 'omega']) assert.ok(core.getBall(id).supreme, id + ' upgraded in place (saved progress keeps working)');
  for (const id of ['phoenix', 'mirror', 'infinity', 'bloodmoon']) {
    const d = core.getBall(id); assert.ok(d && !d.supreme && !d.adminOnly, id + ' still a normal player ball');
    assert.ok(d.skills.length <= 4);
  }
  assert.equal(core.ALL_BUILTIN.filter(b => b.id === 'archangel').length, 1, 'no duplicates');
});

test('every one of the 75 abilities does something in battle', () => {
  for (const id of IDS) {
    core.getBall(id).skills.forEach((s, i) => {
      const { B, me, foe } = lab(id);
      if (['tm_rewind', 'aa_heal', 'tm_clone'].includes(s.type)) { run(B, 3.2); me.hp = me.maxHp * 0.4; }
      if (s.type === 'dl_feast') { foe.st.burn = 3; foe.burnDps = 3; }
      run(B, 0.05);
      const before = world(B, me, foe), hp0 = foe.hp;
      me.skills[i].cdLeft = 0;
      assert.ok(core.useSkill(me, me.skills[i]), `${id}: ${s.name} can be used`);
      const after = world(B, me, foe);
      run(B, 4);
      assert.ok(before !== after || hp0 - foe.hp > 0.5, `${id}: ${s.name} changes the battle`);
      for (const f of B.fighters) assert.ok(Number.isFinite(f.hp) && Number.isFinite(f.x) && Number.isFinite(f.y), `${id}: ${s.name} keeps numbers finite`);
    });
  }
});

test('ultimates: 1st awakens, 2nd reaches the Final God form, then the final-form ultimate', () => {
  for (const id of IDS) {
    const { B, me, foe } = lab(id, 'fire', 9);
    me.ultMeter = 100; assert.ok(core.useUltimate(me)); run(B, 5);
    assert.equal(me.form, 1, id + ' awakened');
    me.ultMeter = 100; assert.ok(core.useUltimate(me)); run(B, 5);
    assert.equal(me.form, 2, id + ' final form');
    assert.equal(me.ult.type, me.baseDef.finalUlt.type);
    const hp0 = foe.hp; me.ultMeter = 100; assert.ok(core.useUltimate(me)); run(B, 6);
    assert.ok(foe.hp !== hp0 || B.fighters.length > 2 || foe.st.outside > 0, id + ' final-form ultimate hits');
    assert.ok(me.effAtk() > me.atk, 'forms raise attack');
  }
});

test('transformations happen in battle at 60% and 30% HP', () => {
  for (const id of IDS) {
    const { B, me } = lab(id, 'fire', 11);
    me.hp = me.maxHp * 0.55; run(B, 2); assert.equal(me.form, 1, id);
    me.hp = me.maxHp * 0.25; run(B, 2); assert.equal(me.form, 2, id);
    assert.equal(me.def.formName, me.baseDef.forms[2].name);
  }
});

test('AI battles with Supreme balls finish and are fully deterministic (also 5-ball FFA)', () => {
  const sim = (T) => { const n0 = core.rngCount(); const r = core.simulateTicket(T, [], 240 * 150); return { ...r, rng: core.rngCount() - n0 }; };
  for (const [a, b] of [['realitycontroller', 'mirrorgod'], ['glitch404', 'timegod'], ['phoenixgod', 'blacksun'], ['skullking', 'dragonemperor']]) {
    const T = { v: 2, mode: '1v1', difficulty: 'hard', seed: 4242, manual: false, pool: [], opts: {}, teams: [[core.playerSpecFrom(core.getBall(a), MAXP)], [core.enemySpec(core.getBall(b), 50, 'hard')]] };
    const r1 = sim(T), r2 = sim(JSON.parse(JSON.stringify(T)));
    assert.ok(r1.ok, `${a} vs ${b} finished`);
    assert.deepEqual([r1.win, r1.step, Math.round(r1.hpPct * 1e6), r1.rng], [r2.win, r2.step, Math.round(r2.hpPct * 1e6), r2.rng], `${a} vs ${b} deterministic`);
  }
  const T = core.createTicket({ mode: 'ffa', ball: 'omega', difficulty: 'hard', ffaCount: 5 }, MAXP, () => 0.21);
  T.teams[1] = [core.enemySpec(core.getBall('voidemperor'), 50, 'hard')]; T.teams[2] = [core.enemySpec(core.getBall('thundergod'), 50, 'hard')];
  const r1 = sim(T), r2 = sim(JSON.parse(JSON.stringify(T)));
  assert.deepEqual([r1.win, r1.step, r1.rng], [r2.win, r2.step, r2.rng]);
});

test('ADMIN DELETE console: delete, restore, transform, properties, arena and settings replay exactly', () => {
  const T = core.createTicket({ mode: 'ffa', ball: 'realitycontroller', difficulty: 'hard', ffaCount: 6 }, MAXP, () => 0.33);
  T.seed = 99;
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  const me = B.player, list = core.allBalls().filter(b => b.enabled && !b.summonOnly && !b.unit && !b.draft);
  let opened = -1, e1, e2, e3, r3, ti; const plan = [];
  // ultimate charges on its own; the AI fires it, the window opens, then the owner sends commands
  while (!B.result && B.stepN < 240 * 150) {
    if (opened < 0 && me.sx.adminT > 0) {
      opened = B.stepN;
      [e1, e2, e3] = B.fighters.filter(f => f.alive && f.team !== 0 && !f.isClone); r3 = e3.r;
      ti = list.findIndex(b => b.id === (e2.def.id === 'fire' ? 'ice' : 'fire'));
      plan.push([1, e1.sid, 0, 0], [3, e2.sid, ti, 0], [4, e3.sid, 1, 150], [2, e1.sid, 0, 0]);
    }
    if (plan.length && B.stepN > opened + 2) B.actions.push(['x', ...plan.shift()]);
    if (opened >= 0 && B.stepN === opened + 40) { B.actions.push(['x', 5, 0, 1, 6]); }   // one more than allowed: ignored
    B.step(STEP);
    if (opened >= 0 && B.stepN === opened + 42) assert.notEqual(B.cond && B.cond.kind, 'frozen', 'the 5th command was refused (no commands left)');
    if (opened >= 0 && B.stepN === opened + 8) {
      assert.equal(B.deleted ? B.deleted.length : 0, 0, 'deleted then restored');
      assert.ok(B.fighters.includes(e1) && e1.alive, 'restored ball is back');
      const t2 = B.fighters.find(f => f.sid === e2.sid); assert.ok(t2 && t2 !== e2 && t2.def.id !== e2.def.id, 'transformed');
      assert.ok(e3.r > r3 * 1.5, 'size changed');
      assert.equal(me.sx.adminLeft, 0, 'all 4 commands used');
    }
  }
  assert.ok(opened > 0, 'the Admin Delete window opened');
  const rec = B.rec.slice(), res = B.result;
  assert.equal(rec.filter(a => a[1] === 'x').length, 5);
  const r2 = core.simulateTicket(T, rec, 240 * 150);
  assert.deepEqual([r2.win, r2.step, Math.round(r2.hpPct * 1e6)], [res.win, res.step, Math.round(res.hpPct * 1e6)], 'the server replay reaches the same result');
  // the same commands without an open window change nothing
  const plain = core.simulateTicket(T, [], 240 * 150), forged = core.simulateTicket(T, [[5, 'x', 1, 3, 0, 0], [6, 'x', 6, 0, 0, 300]], 240 * 150);
  assert.deepEqual([forged.win, forged.step], [plain.win, plain.step], 'commands without the Admin Delete window are ignored');
  assert.equal(core.cleanPvpActions([[0, 'x', 1, 2, 0, 0]]).length, 1);
  assert.equal(core.cleanPvpActions([[0, 'x', 1, 2, 0]]), null);
});

