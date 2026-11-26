'use strict';
/**
 * 2.5.0 GOD OF ABSOLUTE — AUTONOMOUS FREE WILL (engine).
 * Nobody can steer or command it; it picks its own strategies and targets; it hunts enemies hiding outside the arena
 * in its Outer Realm, always returns, never leaves anything behind, respects the owner's settings, and stays deterministic.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../core');

const core = loadCore(); core.setCatalog(null);
const STEP = core.STEP, ABS = 'godofabsolute', full = Object.fromEntries(core.TREE.map(n => [n.id, 1]));
const steps = (B, s) => { for (let i = 0; i < s * 240 && !B.result; i++) B.step(STEP); };
function battle({ level = 70, enemy = 'fire', mode = '1v1', will = null, seed = 5, infinite = true } = {}) {
  core.setCatalog(will ? { tuning: { [ABS]: { will } } } : null);
  const T = core.createTicket({ mode, ball: ABS, enemy, difficulty: 'normal', infinite }, { level, evo: 3, up: {}, tree: full }, () => 0.5); T.seed = seed;
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  return { B, me: B.player, foe: B.fighters.find(f => f.team !== B.player.team) };
}
test.after(() => core.setCatalog(null));

test('nobody can control it: steering, abilities, ultimate and manual mode are ignored (other balls still obey)', () => {
  const { B, me } = battle(); steps(B, 0.1);
  assert.equal(me.autonomous, true);
  B.applyAction(['m', 1]); assert.equal(me.manual, false, 'manual mode refused');
  B.applyAction(['s', 100, 0, 900]); assert.ok(!me.inP, 'steering ignored');
  const sk = me.skills[0]; sk.cdLeft = 0; B.applyAction(['k', 0]); assert.equal(sk.cdLeft, 0, 'ability command ignored');
  me.ultMeter = 100; B.applyAction(['u', 0]); assert.equal(me.ultMeter, 100, 'ultimate command ignored');
  // a normal ball still follows its player
  core.setCatalog(null); const T = core.createTicket({ mode: '1v1', ball: 'fire', enemy: 'ice', difficulty: 'normal' }, { level: 20, evo: 1, up: {}, tree: full }, () => 0.5);
  const B2 = new core.Battle(core.buildBattleConfig(T, { headless: true })); B2.applyAction(['m', 1]); assert.equal(B2.player.manual, true);
});

test('online: inputs for its slot change nothing — the same battle with or without them', () => {
  const T = core.createPvpTicket([{ ball: ABS, level: 80, evo: 3, up: {}, tree: full, name: 'a' }, { ball: 'dragon', level: 50, evo: 3, up: {}, tree: full, name: 'b' }], 4242);
  const spam = []; for (let b = 2; b < 400; b += 7) spam.push(...core.mergePvpBlock(b, [[[0, 'm', 1], [1, 's', 100, -50, 900], [2, 'k', b % 5], [3, 'u', 0]], []]));
  const a = core.simulateTicket(T, spam), b = core.simulateTicket(T, []);
  assert.deepEqual([a.winner, a.step], [b.winner, b.step]);
});

test('its own mind: several strategies over a fight and its own targets in a free-for-all', () => {
  const { B, me } = battle({ level: 90, mode: 'ffa', enemy: 'dragon', seed: 11 });
  const strats = new Set(), targets = new Set();
  for (let i = 0; i < 240 * 70 && !B.result; i++) { B.step(STEP); if (me.will) { strats.add(me.will.strat); if (me.target) targets.add(me.target.sid); } }
  assert.ok(strats.size >= 3, 'strategies used: ' + [...strats].join(','));
  assert.ok(targets.size >= 2, 'it chose different targets');
});

test('OUTER REALM HUNT: an enemy hiding outside the arena is pulled into its realm, fought, and everyone returns', () => {
  const { B, me, foe } = battle({ level: 70, will: { maxRealm: 4 } });
  steps(B, 0.05); me.will.realmCd = 0;
  foe.st.outside = 3; foe.portalExit = { mode: 'safe' }; foe.vx = foe.vy = 0;          // the enemy escapes outside the arena
  let R = null; for (let i = 0; i < 240 * 1.5 && !R; i++) { B.step(STEP); R = (B.absRealms || []).find(x => x.phase === 'inside'); }
  assert.ok(R, 'a realm opened'); assert.equal(R.kind, 'hunt'); assert.equal(R.prey, foe);
  assert.ok(me.dim && me.dim === foe.dim && me.dim === R.id, 'both are inside its realm'); assert.equal(foe.st.outside, 0, 'pulled out of hiding');
  const hp0 = foe.hp; steps(B, 4.6);
  assert.ok(foe.hp < hp0 || !foe.alive, 'it fought the prey');
  assert.equal((B.absRealms || []).length, 0, 'the realm closed on time'); assert.equal(me.dim || 0, 0); assert.equal(foe.dim || 0, 0);
  assert.ok(!B.projs.some(p => p.dim === R.id) && !B.fighters.some(f => f.dim === R.id), 'nothing left behind');
});

test('safety: if it falls inside, the realm closes at once and the prey returns; a realm never lasts more than 8 s and respects its cooldown', () => {
  const { B, me, foe } = battle({ level: 70 });
  steps(B, 0.05); me.will.realmCd = 0; foe.st.outside = 3; foe.portalExit = { mode: 'safe' };
  let R = null; for (let i = 0; i < 240 * 1.5 && !R; i++) { B.step(STEP); R = (B.absRealms || []).find(x => x.phase === 'inside'); }
  assert.ok(R); steps(B, 0.6); me.st.invuln = 0; me.st.shield = 0; core.dealDamage(foe, me, 1e7, { kind: 'skill', noDef: true }); B.step(STEP); B.step(STEP);
  assert.equal(me.alive, false); assert.equal((B.absRealms || []).length, 0); assert.equal(foe.dim || 0, 0, 'the prey came back');
  // long fight against an escaping opponent: every realm ≤ gate + 8 s, and a gap of at least the cooldown between realms
  const b2 = battle({ level: 100, enemy: 'portalmaster', will: { realmCd: 12 }, seed: 3 }); const spans = []; let cur = null;
  for (let i = 0; i < 240 * 120 && !b2.B.result; i++) { b2.B.step(STEP); const open = (b2.B.absRealms || [])[0];
    if (open && !cur) cur = { a: b2.B.time, id: open.id }; if (!open && cur) { spans.push({ ...cur, b: b2.B.time }); cur = null; } }
  assert.ok(spans.length >= 1, 'it used the Outer Realm ' + spans.length + ' times');
  for (const s of spans) assert.ok(s.b - s.a <= 8.6, 'realm lasted ' + (s.b - s.a).toFixed(2));
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i].a - spans[i - 1].a >= 12 - 0.01, 'cooldown respected');
  assert.ok(!b2.B.fighters.some(f => f.dim && b2.B.absRealmIds && b2.B.absRealmIds.has(f.dim) && !(b2.B.absRealms || []).some(R => R.id === f.dim)));
});

test('owner settings shape it: no Outer Realm when switched off; intelligence sets how sharp it is', () => {
  const { B, me, foe } = battle({ level: 70, will: { transcend: false, intelligence: 3 } });
  steps(B, 0.05); me.will.realmCd = 0; foe.st.outside = 3; foe.portalExit = { mode: 'safe' };
  steps(B, 2); assert.equal((B.absRealms || []).length, 0, 'it stays in the arena'); assert.equal(me.ai.diff, 'expert');
  const calm = battle({ will: { intelligence: 1 } }); steps(calm.B, 0.05); assert.equal(calm.me.ai.diff, 'normal');
});

test('deterministic: the same free-will battle replays identically (also with realms and teleports)', () => {
  const run = () => { const { B, me } = battle({ level: 100, enemy: 'portalmaster', seed: 21, infinite: false }); let realms = 0; for (let i = 0; i < 240 * 90 && !B.result; i++) { B.step(STEP); if ((B.absRealms || []).some(R => !R.c && (R.c = 1))) realms++; } return JSON.stringify([B.result && B.result.win, B.fighters.map(f => Math.round(f.hp)), B.time.toFixed(3), realms, me.will.strat]); };
  assert.equal(run(), run());
});
