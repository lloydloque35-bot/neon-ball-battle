'use strict';
/**
 * 2.8.0 ANTI BALL — LIMITED EDITION (100 copies worldwide, ANTI-001 … ANTI-100, PHP 999).
 * The new kit in real headless battles: every ability, the ultimate, NULL ASCENSION, Adaptive Null, the fairness limits,
 * mastery looks, determinism and battles against every rarity tier. The shop / server side is in anti_shop.test.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../core');

const core = loadCore(); core.setCatalog(null);
const AX = core.AX, STEP = core.STEP;
const MAXP = { level: 50, evo: 3, up: {}, tree: Object.fromEntries(core.TREE.map(n => [n.id, 1])) };
function arena(enemy = 'fire', seed = 7) {
  const T = core.createTicket({ mode: '1v1', ball: 'anti', enemy, difficulty: 'hard', manual: false }, MAXP, () => 0.37); T.seed = seed;
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  const me = B.fighters.find(f => f.team === 0 && !f.isClone), foe = B.fighters.find(f => f.team === 1 && !f.isClone);
  me.ai = null; foe.ai = null; return { B, me, foe };
}
const run = (B, sec) => { for (let i = 0; i < sec * 240 && !B.result; i++) B.step(STEP); };
const cast = (f, type) => { const sk = f.skills.find(s => s.type === type); assert.ok(sk, 'has ' + type); sk.cdLeft = 0; sk.locked = false; f.st.stun = 0; f.casting = 0; f.gcd = 0; return core.useSkill(f, sk); };
const near = (a, b, d = 120) => { a.x = b.x - d; a.y = b.y; a.vx = a.vy = 0; };
const hold = (...fs) => { for (const f of fs) { f.anchored = true; f.vx = f.vy = 0; } };     // keeps the geometry of a test exact
const calm = f => { f.st.invuln = 0; f.st.shield = 0; f.st.phase = 0; };
const shot = (B, from, at, o) => { core.spawnProj(from, Math.atan2(at.y - from.y, at.x - from.x), o); return B.projs[B.projs.length - 1]; };
const hit = (src, tgt, amt, o = {}) => { calm(tgt); const h0 = tgt.hp; core.dealDamage(src, tgt, amt, { kind: 'skill', tag: 'projectile', noCrit: true, noDef: true, ...o }); return h0 - tgt.hp; };

/* ================= the kit ================= */
test('the upgraded Anti Ball: same record, Limited rarity, 8 abilities + ANTI EXISTENCE, Adaptive Null, 9 slots', () => {
  const a = core.getBall('anti');
  assert.equal(core.allBalls().filter(b => b.id === 'anti').length, 1, 'no duplicate Anti Ball');
  assert.ok(a.edition && a.paid && !a.free && !a.premium && a.rarity === 'Limited' && a.passive === 'adaptivenull' && !a.godMode);
  assert.deepEqual([...a.skills.map(s => s.name)], ['NULL CORE', 'SKILL REJECTION', 'ADAPTIVE MATRIX', 'COUNTER PULSE', 'NULL ZONE', 'MIRROR PROTOCOL', 'SYSTEM OVERRIDE', 'ABSOLUTE RESISTANCE']);
  assert.equal(a.ult.name, 'ANTI EXISTENCE'); assert.equal(a.slotCap, 9); assert.equal(a.slotsUsed, 9);
  assert.equal(new Set(a.skills.map(s => s.type)).size, 8, 'every ability its own mechanic');
  for (const s of a.skills) { assert.ok(s.cd >= 10 && s.uid && core.SKILL_TYPES[s.type] && core.SKILL_TYPES[s.type].desc, s.name + ' has a cooldown, id and description'); assert.ok(!s.v26); }
  assert.ok(core.ULT_TYPES[a.ult.type]);
  const reg = core.skillRegistry().filter(r => r.ball === 'anti'); assert.equal(reg.length, 9);
  assert.equal(core.skAudit().filter(x => (x.a.startsWith('anti.') || x.b.startsWith('anti.')) && x.level === 'duplicate').length, 0, 'no copy of another ball\'s ability');
});

test('Null Core halves enemy shots that touch its shell and turns that into null charge; Counter Pulse spends it (max 3 pulses)', () => {
  const { B, me, foe } = arena('fire', 3); run(B, 0.4);
  assert.notEqual(cast(me, 'a_nullcore'), false);
  hold(me); near(foe, me, 400); B.projs.length = 0;
  const p = shot(B, foe, me, { speed: 600, r: 8, dmg: 20, col: '#fff', power: 50 }), d0 = p.dmg;
  for (let i = 0; i < 240 && !p.cored26 && B.projs.includes(p); i++) B.step(STEP);
  assert.ok(p.cored26 && Math.abs(p.dmg - d0 * AX.CORE.shot) < 1e-9, 'shot halved by the shell');
  assert.ok(me.sx.nullCharge > 0, 'null charge stored');
  run(B, 6); assert.ok(!(me.sx.coreT > 0), 'Null Core ends');
  // Counter Pulse: armed, fires when an enemy comes close, never more than 3 times
  me.sx.nullCharge = 30; foe.st.invuln = 0; near(foe, me, 400); assert.notEqual(cast(me, 'a_pulse'), false);
  const hp0 = foe.hp; near(foe, me, 60); B.step(STEP);
  assert.ok(foe.hp < hp0 && me.sx.nullCharge === 0, 'pulse hit and spent the stored charge');
  for (let k = 0; k < 6; k++) { near(foe, me, 60); run(B, 0.8); }
  assert.ok(me.sx.pulseN === 0 || !(me.sx.pulseT > 0), 'at most 3 pulses');
});

test('Skill Rejection blocks exactly one ability hit (never an ultimate, never burn ticks) and fires it back', () => {
  const { B, me, foe } = arena('fire', 4); run(B, 0.4);
  assert.notEqual(cast(me, 'a_reject'), false);
  assert.equal(hit(foe, me, 12, { kind: 'dot' }) > 0, true, 'burn / poison ticks are not rejected');
  assert.equal(hit(foe, me, 12, { sk: 'zz.ult' }) > 0, true, 'ultimates are never rejected');
  assert.equal(hit(foe, me, 12, { sk: 'zz.1' }), 0, 'the ability hit is rejected');
  assert.ok(hit(foe, me, 12, { sk: 'zz.1' }) > 0, 'only one hit');
  const shots = B.projs.length; run(B, 0.1); assert.ok(B.projs.length > shots || B.projs.some(q => q.owner === me), 'counter bolt fired back');
});

test('ADAPTIVE NULL learns repeated abilities in this match only: −10% per repeat, max −30%, forgotten after 8 s, never immune', () => {
  const { B, me, foe } = arena('fire', 5); run(B, 0.3);
  const d = []; for (let i = 0; i < 6; i++) { me.hp = me.maxHp; d.push(hit(foe, me, 20, { sk: 'zz.1' })); }
  assert.ok(Math.abs(d[1] / d[0] - 0.9) < 1e-6 && Math.abs(d[3] / d[0] - 0.7) < 1e-6 && Math.abs(d[5] / d[0] - 0.7) < 1e-6, 'steps of 10%, capped at 30%: ' + d.map(x => x.toFixed(2)));
  assert.equal(me.sx.anStacks, 3); assert.match(me.sx.anName, /./, 'the analysis indicator names the ability');
  const other = hit(foe, me, 20, { sk: 'zz.2' }); assert.ok(Math.abs(other - d[0]) < 1e-6, 'a different ability is not learned yet');
  run(B, AX.ADAPT.forget + 0.5); me.hp = me.maxHp; assert.ok(Math.abs(hit(foe, me, 20, { sk: 'zz.1' }) - d[0]) < 1e-6, 'forgotten after 8 s');
  const fresh = arena('fire', 5); run(fresh.B, 0.3); assert.ok(!fresh.me.sx.anLearn || !Object.keys(fresh.me.sx.anLearn).length, 'a new match starts with nothing learned');
  assert.ok(!foe.skills.some(s => s.locked && !s.disabled) && me.skills.length === 8, 'nothing copied, stolen or disabled');
});

test('Adaptive Matrix: learned abilities hit 15% softer and their shots are side-stepped; Absolute Resistance decays repeats to 40% at most', () => {
  const { B, me, foe } = arena('fire', 6); run(B, 0.3);
  for (let i = 0; i < 4; i++) { me.hp = me.maxHp; hit(foe, me, 20, { sk: 'zz.1' }); }
  me.hp = me.maxHp; const before = hit(foe, me, 20, { sk: 'zz.1' });
  assert.notEqual(cast(me, 'a_matrix'), false); me.hp = me.maxHp; const after = hit(foe, me, 20, { sk: 'zz.1' });
  assert.ok(Math.abs(after / before - (1 - AX.MATRIX.extra)) < 1e-6, 'extra 15%');
  near(foe, me, 300); hold(me, foe); B.projs.length = 0;
  const p = shot(B, foe, me, { speed: 500, r: 8, dmg: 5, col: '#fff', power: 50 }); p.sk = 'zz.1';
  let stepped = false; for (let i = 0; i < 120 && !stepped; i++) { B.step(STEP); stepped = me.sx.mxStepT > 0; }
  assert.ok(stepped, 'side-step against a learned ability');
  // Absolute Resistance
  const r = arena('thunder', 8); run(r.B, 0.3); assert.notEqual(cast(r.me, 'a_resist'), false);
  const hits = []; for (let i = 0; i < 6; i++) { r.me.hp = r.me.maxHp; hits.push(hit(r.foe, r.me, 20, { sk: 'zz.3', tag: 'x' + i })); }
  assert.ok(hits[5] > 0 && hits[5] / hits[0] >= AX.FLOOR - 1e-9, 'never below the floor, never immune');
  r.me.sx.anLearn = {}; run(r.B, 6); assert.ok(!(r.me.sx.resistT > 0), 'it ends');
});

test('Mirror Protocol: a decoy takes enemy targeting and homing shots, Anti blinks aside, the decoy bursts after 3 s', () => {
  const { B, me, foe } = arena('fire', 9); run(B, 0.3); near(foe, me, 300);
  const p = shot(B, foe, me, { speed: 200, r: 8, dmg: 5, col: '#fff', power: 50, target: me, homing: 3 });
  const x0 = me.x, y0 = me.y; assert.notEqual(cast(me, 'a_mirror'), false);
  const dec = B.fighters.find(u => u.nullMirror && u.owner === me);
  assert.ok(dec && dec.decoy && Math.hypot(me.x - x0, me.y - y0) > 100, 'decoy left behind, Anti moved');
  assert.equal(p.target, dec, 'homing shot now chases the decoy');
  assert.equal(cast(me, 'a_mirror'), false, 'one mirror at a time');
  run(B, AX.MIRROR.life + 0.5); assert.ok(!dec.alive && dec.mirrorDone, 'the mirror ends');
});

test('System Override: telegraphed, dodgeable bolt; cooldowns tick at half speed for 3 s, then 6 s immunity; abilities are never disabled', () => {
  const { B, me, foe } = arena('thunder', 10); run(B, 0.3); near(foe, me, 300); calm(foe); hold(me, foe);
  for (const s of foe.skills) s.cdLeft = 6;
  assert.notEqual(cast(me, 'a_override'), false);
  run(B, AX.OVERRIDE.charge + 0.6);
  assert.ok(foe.sx && foe.sx.ovrT > 0, 'override landed');
  const c0 = foe.skills[0].cdLeft; run(B, 1); const used = c0 - foe.skills[0].cdLeft;
  assert.ok(used > 0.3 && used < 0.75, 'cooldown ran at about half speed: ' + used.toFixed(2));
  assert.equal(cast(me, 'a_override'), false, 'no stacking or chaining');
  run(B, 3); assert.ok(!(foe.sx.ovrT > 0) && foe.sx.ovrImmT > 0, 'ends, then immunity');
  foe.skills[0].cdLeft = 0; foe.skills[0].locked = false; foe.casting = 0; foe.gcd = 0; foe.st.stun = 0; foe.st.silence = 0;
  assert.notEqual(core.useSkill(foe, foe.skills[0]), false, 'the enemy can still use its abilities');
  // a bolt that misses does nothing
  const m = arena('thunder', 11); run(m.B, 0.3); near(m.foe, m.me, 300); assert.notEqual(cast(m.me, 'a_override'), false); m.foe.y += 260; m.foe.vx = m.foe.vy = 0; m.foe.anchored = true;
  run(m.B, 2); assert.ok(!(m.foe.sx && m.foe.sx.ovrT > 0), 'dodged');
});

test('ANTI EXISTENCE: a warning first, then a 5 s domain (shots vanish, enemy cooldowns pause inside, team takes 30% less), a collapse, and NULL ASCENSION', () => {
  const { B, me, foe } = arena('fire', 12); run(B, 0.3); near(foe, me, 160); calm(foe);
  me.ultMeter = 100; assert.equal(core.useUltimate(me), true);
  assert.ok(me.sx.asc && me.def.design.pat === 'nullasc', 'NULL ASCENSION: black chrome, crimson core');
  const Z = B.antiDomains[0]; assert.ok(Z && Z.warn > 0, 'telegraphed');
  for (const s of foe.skills) s.cdLeft = 5;
  run(B, AX.EXIST.warn + 0.05); assert.ok(Z.warn <= 0);
  const sh = shot(B, foe, me, { speed: 10, r: 8, dmg: 9, col: '#fff', power: 50 }); sh.x = Z.x + 20; sh.y = Z.y; B.step(STEP);
  assert.ok(!B.projs.includes(sh), 'enemy shot erased inside');
  foe.x = Z.x + 80; foe.y = Z.y; foe.vx = foe.vy = 0; foe.anchored = true; const c0 = foe.skills[0].cdLeft; run(B, 1); assert.ok(Math.abs(foe.skills[0].cdLeft - c0) < 0.05, 'cooldowns paused inside');
  me.x = Z.x; me.y = Z.y; me.hp = me.maxHp; const cut = hit(foe, me, 20, { sk: 'x.0', tag: 'y' }); me.sx.anLearn = {};
  me.x = Z.x + 600; me.y = Z.y; me.hp = me.maxHp; const full = hit(foe, me, 20, { sk: 'x.9', tag: 'z' });
  assert.ok(cut < full * 0.75, 'damage cut inside the domain');
  me.x = Z.x; foe.anchored = false; foe.x = Z.x + 100; calm(foe); const hp0 = foe.hp;
  run(B, AX.EXIST.dur); assert.ok(!B.antiDomains.length, 'the domain ends'); assert.ok(foe.hp < hp0, 'collapse damage');
});

test('NULL ASCENSION also at 40% HP (once); Anti\'s own reductions never go below 45% of a hit', () => {
  const ref = (() => { const r = arena('fire', 13); run(r.B, 0.3); r.me.hp = r.me.maxHp; return hit(r.foe, r.me, 30, { sk: 'zz.9', noDef: false }); })();   // the same hit on a fresh Anti Ball
  const { B, me, foe } = arena('fire', 13); run(B, 0.3);
  me.hp = me.maxHp * 0.35; run(B, 0.05); assert.ok(me.sx.asc); const d1 = me.def;
  run(B, 1); assert.equal(me.def, d1, 'once');
  me.st.invuln = 0; for (let i = 0; i < 8; i++) { me.hp = me.maxHp; hit(foe, me, 30, { sk: 'zz.1' }); }
  assert.notEqual(cast(me, 'a_matrix'), false); assert.notEqual(cast(me, 'a_resist'), false);
  me.hp = me.maxHp; const got = hit(foe, me, 30, { sk: 'zz.1', noDef: false });
  assert.ok(got < ref && got >= ref * AX.FLOOR - 1e-6, 'floor holds: ' + got.toFixed(2) + ' vs ' + (ref * AX.FLOOR).toFixed(2));
});

test('full AI battles against every rarity tier finish, replay identically, and Anti Ball is strong but beatable', () => {
  const tiers = ['fire', 'thunder', 'crystal', 'vampire', 'star', 'phoenix', 'ancientgod', 'soul', 'aurora', 'divine', 'godofwar', 'mecha'];
  let wins = 0, n = 0;
  for (const enemy of tiers) {
    const T = core.createTicket({ mode: '1v1', ball: 'anti', enemy, difficulty: 'hard' }, MAXP, () => 0.4); T.seed = 4242 + enemy.length;
    const play = () => { const B = new core.Battle(core.buildBattleConfig(JSON.parse(JSON.stringify(T)), { headless: true })); while (!B.result && B.stepN < 240 * 240) B.step(STEP); return B; };   // Sudden Death after 90 s always ends it
    const B = play(); assert.ok(B.result, enemy + ' battle finished'); n++; if (B.result.win) wins++;
    for (const f of B.fighters) assert.ok(Number.isFinite(f.hp) && Number.isFinite(f.x));
    if (enemy === 'godofwar') { const B2 = play(); assert.equal(B2.stepN, B.stepN); assert.equal(!!B2.result.win, !!B.result.win); }
  }
  assert.ok(wins > 0 && wins < n, `wins ${wins}/${n}: competitive, not unbeatable`);
});

test('Anti Ball Mastery: 10 levels of looks from verified battles; the look changes, the power does not', () => {
  assert.equal(core.ANTI_MASTERY.length, 10);
  assert.equal(core.antiMasteryOf({}).lv, 1); assert.equal(core.antiMasteryOf({ 'anti.0': 1e6 }).lv, 10); assert.equal(core.antiMasteryOf({ 'fire.0': 1e6 }).lv, 1);
  const lo = core.antiDefFor(1, true), hi = core.antiDefFor(10, true);
  assert.notEqual(JSON.stringify(lo.design), JSON.stringify(hi.design));
  for (const k of ['hp', 'atk', 'def', 'spd', 'crit']) assert.equal(lo[k], hi[k], k + ' never changes with mastery');
  const run1 = mast => { const T = core.createTicket({ mode: '1v1', ball: 'anti', enemy: 'phoenix', difficulty: 'hard' }, { ...MAXP, mast }, () => 0.4); T.seed = 99; T.teams[0][0].mast = mast; const B = new core.Battle(core.buildBattleConfig(T, { headless: true })); while (!B.result && B.stepN < 240 * 160) B.step(STEP); return [B.stepN, !!B.result.win]; };
  assert.deepEqual(run1({}), run1({ 'anti.0': 1e6 }), 'a Grand mastery Anti Ball fights exactly like a new one');
});
