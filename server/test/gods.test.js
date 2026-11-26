'use strict';
/**
 * 2.2.0 FOUR SUPREME GOD BALLS (free): God of Chaos, God of War, AI Tech, Solar Eclipse.
 * Every skill in every form, both ultimates, the 12 forms, the passives, God Clash, PvP determinism,
 * free access for every player, and the practice test bar.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, Client } = require('./helpers');
const { loadCore } = require('../core');
const { VERSION } = require('../app');

const core = loadCore(); core.setCatalog(null);
const STEP = core.STEP, GODS = ['godofchaos', 'godofwar', 'aitech', 'solareclipse'];
const run = (B, sec) => { for (let i = 0; i < sec * 240 && !B.result; i++) B.step(STEP); };
const prog = lv => ({ level: lv, evo: 1, up: {}, tree: { slot3: 1, slot4: 1 } });

function lab(id, { form = 0, level = 30, godTest = true, enemy = 'fire', seed = 7 } = {}) {
  const T = { v: 2, mode: 'practice', difficulty: 'hard', seed, manual: false, pool: [], opts: { infinite: true, godTest },
    teams: [[{ ...core.playerSpecFrom(core.getBall(id), prog(level)), startForm: form }], [core.enemySpec(core.getBall(enemy), level, 'hard')]] };
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  const me = B.fighters[0], foe = B.fighters[1];
  me.ai = null; foe.ai = null; foe.skills = []; me.st.invuln = foe.st.invuln = 0;
  me.x = 500; me.y = 360; foe.x = 760; foe.y = 380; me.vx = 120; me.vy = 60; foe.vx = -100; foe.vy = 40;
  return { B, me, foe };
}
const snap = (B, me, foe) => JSON.stringify([Math.round(foe.hp), Math.round(me.hp), B.projs.length, B.zones.length, B.lasers.length, B.waves.length, B.strikes.length, B.fighters.length, B.timers.length, B.cond && B.cond.kind,
  Object.keys(me.sx).filter(k => me.sx[k] > 0 || typeof me.sx[k] === 'string'), Object.keys(foe.sx || {}).filter(k => foe.sx[k] > 0), Object.keys(foe.st).filter(k => foe.st[k] > 0), Object.keys(me.st).filter(k => k !== 'invuln' && me.st[k] > 0), Math.round(foe.x), Math.round(me.x), me.casting > 0, me.sx.variant]);

/* ---------------- server: free for every player ---------------- */
let srv, player;
test.before(async () => { srv = await startServer(); player = new Client(srv.base); await player.register('free_god_fan'); });
test.after(async () => { await srv.stop(); });

test('every player can battle with all four God Balls for free (no premium, no purchase)', async () => {
  for (const id of GODS) {
    const r = await player.post('/api/battle/start', { mode: '1v1', ball: id, difficulty: 'easy' });
    assert.equal(r.status, 200, id + ' is free');
    assert.equal(r.data.ticket.teams[0][0].ball, id);
  }
  const save = (await player.get('/api/save')).data;
  assert.ok(save, 'save loads');
});

test('free practice tests: any form + test bar, Practice only; test commands are accepted, others are not', async () => {
  const st = await player.post('/api/battle/start', { mode: 'practice', ball: 'solareclipse', godTest: true, startForm: 2, dummy: true, infinite: true });
  assert.equal(st.status, 200);
  const T = st.data.ticket; assert.equal(T.opts.godTest, true); assert.equal(T.teams[0][0].startForm, 2);
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  assert.equal(B.player.form, 2, 'a level-1 player can TEST the Final God Form in practice');
  B.applyAction(['x', 9, B.player.sid, 1, 0]); assert.equal(B.player.form, 1);
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: 'solareclipse', godTest: true })).status, 400, 'not outside Practice');
  assert.equal((await player.post('/api/battle/start', { mode: 'practice', ball: 'fire', godTest: true })).status, 400, 'only God Balls');
  assert.equal((await player.post('/api/battle/finish', { id: T.id, inputs: [[3, 'x', 9, 1, 1, 0], [4, 'x', 10, 1, 0, 0]], claimed: { win: false, step: 5 } })).status, 200);
  const st2 = await player.post('/api/battle/start', { mode: 'practice', ball: 'godofwar', godTest: true });
  assert.equal((await player.post('/api/battle/finish', { id: st2.data.ticket.id, inputs: [[3, 'x', 1, 2, 0, 0]], claimed: { win: false, step: 5 } })).status, 403, 'ADMIN DELETE commands stay owner-only');
});

/* ---------------- engine ---------------- */
test('four free God Balls: 5 skills (+ Solar Eclipse\'s state control), 2 ultimates, 3 forms, passives', () => {
  assert.equal(core.GAME_VERSION, VERSION);
  assert.deepEqual([...core.godIds()], GODS);
  const seen = new Set();
  for (const id of GODS) {
    const d = core.getBall(id);
    assert.ok(d.free && d.godBall && !d.adminOnly && !d.premium, id + ' is free');
    assert.equal(d.category, 'God'); assert.ok(d.godClass);
    const regular = d.skills.filter(s => !s.always && !s.v26);
    assert.equal(regular.length, 5, id + ' has 5 skills');
    for (const s of [...d.skills, d.ult, d.finalUlt]) { assert.ok(!seen.has(s.type), s.type + ' unique'); seen.add(s.type); }
    for (const s of regular) assert.equal(core.SKILL_TYPES[s.type].forms.length, 3, s.type + ' has 3 versions');
    assert.equal(d.forms.length, 3); assert.ok(d.passiveInfo && d.formPassive.length === 3);
    for (let k = 1; k < 3; k++) assert.notEqual(JSON.stringify(core.formDef(d, k).design), JSON.stringify(d.design));
  }
  for (const id of ['timegod', 'chronos']) assert.ok(core.getBall(id), id + ' untouched');
  assert.ok(core.getBall('solareclipse').skills[5].always, 'Celestial Shift is always available');
  assert.ok(core.opponentPool(false).some(b => b.godBall), 'God Balls also appear as normal opponents');
});

test('all 20 skills work in all 3 forms, and every form behaves differently', () => {
  const sig = {};
  for (const id of GODS) for (let form = 0; form < 3; form++) core.getBall(id).skills.forEach((s, i) => {
    if (s.always || s.v26) return;      // (the 2.6.0 abilities have their own tests)
    const { B, me, foe } = lab(id, { form });
    assert.equal(me.form, form);
    run(B, 0.05);
    const before = snap(B, me, foe), hp0 = foe.hp; me.skills[i].cdLeft = 0;
    assert.ok(core.useSkill(me, me.skills[i]), `${id} ${s.name} @${form}`);
    const after = snap(B, me, foe); let maxP = 0, maxZ = 0, maxL = 0, minions = 0;
    for (let k = 0; k < 240 * 4; k++) { B.step(STEP); maxP = Math.max(maxP, B.projs.length); maxZ = Math.max(maxZ, B.zones.length); maxL = Math.max(maxL, B.lasers.length); minions = Math.max(minions, B.fighters.filter(x => x.minion && x.alive).length); }
    assert.ok(before !== after || hp0 - foe.hp > 0.5, `${id} ${s.name} @${form} does something`);
    for (const f of B.fighters) assert.ok(Number.isFinite(f.hp) && Number.isFinite(f.x));
    (sig[id + s.type] || (sig[id + s.type] = [])).push(`${Math.round(hp0 - foe.hp)}|${maxP}|${maxZ}|${maxL}|${minions}`);
  });
  for (const [k, v] of Object.entries(sig)) assert.ok(!(v[0] === v[1] && v[1] === v[2]), k + ' changes between forms');
});

test('ultimates: 1st awakens, 2nd reaches the Final God Form with its exclusive ultimate', () => {
  for (const id of GODS) {
    const { B, me, foe } = lab(id, { seed: 9 });
    me.ultMeter = 100; assert.ok(core.useUltimate(me)); run(B, 5); assert.equal(me.form, 1, id);
    me.ultMeter = 100; assert.ok(core.useUltimate(me)); run(B, 5); assert.equal(me.form, 2, id);
    assert.equal(me.ult.type, me.baseDef.finalUlt.type);
    const hp0 = foe.hp; me.ultMeter = 100; assert.ok(core.useUltimate(me)); run(B, 6);
    assert.ok(foe.hp !== hp0, id + ' final-form ultimate hits');
  }
});

test('forms unlock with free progression: Awakened at ball Lv 10, Final God Form at Lv 20', () => {
  for (const [lv, cap] of [[1, 0], [9, 0], [10, 1], [19, 1], [20, 2], [50, 2]]) {
    const { B, me } = lab('godofwar', { level: lv, godTest: false });
    assert.equal(me.formCap, cap, 'Lv ' + lv);
    me.ultMeter = 100; core.useUltimate(me); run(B, 4); me.ultMeter = 100; core.useUltimate(me); run(B, 4);
    assert.equal(me.form, cap, `Lv ${lv} reaches form ${cap}`);
  }
  const { B, me } = lab('aitech', { level: 15, godTest: false }); me.hp = me.maxHp * 0.45; run(B, 2); assert.equal(me.form, 1, 'awakens at 50% HP');
  me.hp = me.maxHp * 0.2; run(B, 2); assert.equal(me.form, 1, 'the Final God Form needs the 2nd ultimate (and Lv 20)');
});

test('passives: Unstable Reality, Battle Instinct, Combat Learning (capped), Celestial Balance', () => {
  { const { B, me } = lab('godofchaos'); const modes = new Set(); for (let i = 0; i < 12; i++) { run(B, 1.5); modes.add(me.sx.chaosMode); } assert.ok(modes.size >= 2, 'Unstable Reality changes the pattern'); }
  { const { B, me, foe } = lab('godofwar'); const a0 = me.effAtk(); for (let i = 0; i < 6; i++) { core.dealDamage(me, foe, 1, { kind: 'skill', tag: 'projectile' }); run(B, 0.35); }
    assert.ok(me.sx.inst >= 4, 'stacks build'); assert.ok(me.effAtk() > a0 * 1.1, 'stacks raise attack');
    me.anchored = foe.anchored = true; me.ai = foe.ai = null; me.x = 200; foe.x = 1000; run(B, 6); assert.equal(me.sx.inst, 0, 'stacks fade without hits'); }
  { const { B, me, foe } = lab('aitech', { form: 2 }); const hits = []; for (let i = 0; i < 20; i++) { const h0 = me.hp; core.dealDamage(foe, me, 20, { kind: 'skill', tag: 'projectile', noCrit: true }); hits.push(h0 - me.hp); me.hp = me.maxHp; }
    assert.ok(hits[19] < hits[0], 'learns'); assert.ok(hits[19] >= hits[0] * 0.74, 'but never more than the cap (25%)');
    const st = me.skills.find(s => s.type === 'ai_shield'); st.cdLeft = 0; core.useSkill(me, st);
    const hs = []; for (let i = 0; i < 12; i++) { const h0 = me.hp; core.dealDamage(foe, me, 20, { kind: 'skill', tag: 'beam', noCrit: true }); hs.push(h0 - me.hp); me.hp = me.maxHp; }
    assert.ok(Math.min(...hs) >= hs[0] * 0.5 && Math.min(...hs) > 0, 'adaptive shield + learning never make it invincible (max 45% less)'); }
  { const { B, me } = lab('solareclipse'); const sh = me.skills.find(s => s.type === 'se_shift'); assert.ok(!sh.locked);
    const d0 = me.def; sh.cdLeft = 0; assert.ok(core.useSkill(me, sh)); assert.equal(me.sx.variant, 'eclipse'); assert.notEqual(me.def.design.c3, d0.design.c3, 'eclipse aura');
    run(B, 3.1); sh.cdLeft = 0; core.useSkill(me, sh); assert.equal(me.sx.variant, ''); }
});

test('GOD CLASH: simultaneous God ultimates clash, the battle state decides, either side can win', () => {
  const clash = (hpA, hpB, seed) => {
    const T = { v: 2, mode: '1v1', difficulty: 'hard', seed, manual: false, pool: [], opts: {}, teams: [[core.playerSpecFrom(core.getBall('godofchaos'), prog(30))], [core.enemySpec(core.getBall('godofwar'), 30, 'hard')]] };
    const B = new core.Battle(core.buildBattleConfig(T, { headless: true })); const [a, b] = B.fighters; a.ai = b.ai = null;
    a.hp = a.maxHp * hpA; b.hp = b.maxHp * hpB; run(B, 1); a.st.invuln = b.st.invuln = 0;
    a.ultMeter = 100; core.useUltimate(a); B.step(STEP); B.step(STEP); b.ultMeter = 100; core.useUltimate(b);
    assert.ok(B.clash, 'the clash starts'); const c = B.clash;
    run(B, 1.7); assert.ok(!B.clash, 'the clash resolves (gameplay continues)');
    return { m: c.m, aForm: a.form, bForm: b.form, aMeter: a.ultMeter, bMeter: b.ultMeter };
  };
  const r1 = clash(1, 0.25, 5), r2 = clash(0.25, 1, 5);
  assert.ok(r1.m > 0 && r1.aForm === 1 && r1.bMeter >= 35, 'healthy God of Chaos wins: its ultimate fires, the loser gets part of its charge back');
  assert.ok(r2.m < 0 && r2.bForm === 1 && r2.aMeter >= 35, 'healthy God of War wins the same clash the other way round');
  // no lone ultimate is delayed when no rival God Ball is present
  const { B, me } = lab('godofchaos', { seed: 3 }); me.ultMeter = 100; core.useUltimate(me); assert.ok(!(B.godCharge && B.godCharge.length));
});

test('PvP: a God vs God online match replays identically (multiplayer sync)', () => {
  const pl = id => ({ ball: id, level: 25, evo: 2, up: {}, tree: { slot3: 1, slot4: 1 }, name: id });
  const T = core.createPvpTicket([pl('solareclipse'), pl('aitech')], 1234, 'duel');
  const inputs = [[30, 0, 'm', 1], [31, 0, 's', 100, 0, 900], [200, 0, 'k', 5], [400, 1, 'k', 0], [480, 0, 'k', 0], [800, 1, 'u', 0], [801, 0, 'u', 0]];
  const r1 = core.simulateTicket(T, inputs, 240 * 150), r2 = core.simulateTicket(JSON.parse(JSON.stringify(T)), inputs, 240 * 150);
  assert.ok(r1.ok); assert.deepEqual([r1.winner, r1.step, Math.round(r1.hpPct * 1e6)], [r2.winner, r2.step, Math.round(r2.hpPct * 1e6)]);
  assert.equal(core.cleanPvpActions([[0, 'k', 5]]).length, 1, 'the 6th skill slot is allowed online');
});

test('full AI battles with God Balls finish (also 5-ball FFA) and existing balls are unaffected', () => {
  for (const [a, b] of [['godofchaos', 'infinity'], ['godofwar', 'anti'], ['aitech', 'mecha'], ['solareclipse', 'phoenix']]) {
    const T = { v: 2, mode: '1v1', difficulty: 'hard', seed: 42, manual: false, pool: [], opts: {}, teams: [[core.playerSpecFrom(core.getBall(a), prog(22))], [core.enemySpec(core.getBall(b), 22, 'hard')]] };
    assert.ok(core.simulateTicket(T, [], 240 * 150).ok, `${a} vs ${b}`);
  }
  const T = core.createTicket({ mode: 'ffa', ball: 'godofchaos', difficulty: 'hard', ffaCount: 5 }, prog(25), () => 0.4);
  T.teams[1] = [core.enemySpec(core.getBall('godofwar'), 25, 'hard')]; T.teams[2] = [core.enemySpec(core.getBall('aitech'), 25, 'hard')]; T.teams[3] = [core.enemySpec(core.getBall('solareclipse'), 25, 'hard')];
  const r1 = core.simulateTicket(T, [], 240 * 150), r2 = core.simulateTicket(JSON.parse(JSON.stringify(T)), [], 240 * 150);
  assert.ok(r1.ok); assert.deepEqual([r1.win, r1.step], [r2.win, r2.step]);
  assert.equal(core.getBall('fire').skills.length, 3); assert.ok(!core.getBall('fire').forms);
});
