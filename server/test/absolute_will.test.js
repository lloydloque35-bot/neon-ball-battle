'use strict';
/**
 * 2.5.0 GOD OF ABSOLUTE — AUTONOMOUS FREE WILL (engine).
 * Nobody can steer or command it; it picks its own strategies and targets; it breaks through the arena wall and hunts enemies
 * hiding outside the arena out in the open, always returns, respects the owner's settings, and stays deterministic.
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

const outsideBox = f => f.x < 46 || f.x > 1234 || f.y < 112 || f.y > 690;     // the arena walls (ARENA rect)
test('TRANSCENDENCE: it breaks through the wall, hunts an enemy hiding outside the arena out in the open, and both come back inside', () => {
  const { B, me, foe } = battle({ level: 70, will: { maxRealm: 4 } });
  steps(B, 0.05); me.will.realmCd = 0;
  foe.st.outside = 3; foe.portalExit = { mode: 'safe' }; foe.vx = foe.vy = 0;          // the enemy escapes outside the arena
  let wentOut = false, dragged = false, untargeted = true;
  for (let i = 0; i < 240 * 9 && (me.beyondS || i < 240); i++) { B.step(STEP);
    if (me.beyondS && outsideBox(me)) wentOut = true;
    if (foe.beyond && outsideBox(foe)) dragged = true;
    if (outsideBox(me) && !foe.beyond && foe.target === me) untargeted = false; }
  assert.ok(wentOut, 'it went outside the arena walls'); assert.ok(dragged, 'it dragged the hiding enemy out into the open');
  assert.ok(untargeted, 'balls inside the arena cannot target it while it is outside');
  assert.equal(me.beyondS, null); assert.ok(!me.beyond && !foe.beyond);
  assert.ok(!outsideBox(me) && !outsideBox(foe), 'both are back inside the arena'); assert.equal(foe.st.outside, 0);
});

test('safety: if it falls outside, everyone returns at once; a trip never lasts more than 8.5 s; cooldown respected; nobody else ever leaves the arena', () => {
  const { B, me, foe } = battle({ level: 70 });
  steps(B, 0.05); me.will.realmCd = 0; foe.st.outside = 3; foe.portalExit = { mode: 'safe' };
  for (let i = 0; i < 240 * 4 && !(me.beyondS && me.beyondS.phase === 'duel'); i++) B.step(STEP);
  assert.equal(me.beyondS && me.beyondS.phase, 'duel');
  me.st.invuln = 0; me.st.shield = 0; core.dealDamage(foe, me, 1e7, { kind: 'skill', noDef: true }); B.step(STEP); B.step(STEP);
  assert.equal(me.alive, false); assert.ok(!foe.beyond && !outsideBox(foe), 'the prey came back');
  const b2 = battle({ level: 100, enemy: 'portalmaster', will: { realmCd: 12 }, seed: 3 }); const trips = []; let cur = null, illegal = 0;
  for (let i = 0; i < 240 * 120 && !b2.B.result; i++) { b2.B.step(STEP); const S = b2.me.beyondS;
    if (S && !cur) cur = { a: b2.B.time }; if (!S && cur) { trips.push({ ...cur, b: b2.B.time }); cur = null; }
    for (const f of b2.B.fighters) if (f.alive && !f.beyond && outsideBox(f)) illegal++; }
  assert.ok(trips.length >= 1, 'it left the arena ' + trips.length + ' times');
  for (const t of trips) assert.ok(t.b - t.a <= 8.6, 'trip lasted ' + (t.b - t.a).toFixed(2));
  for (let i = 1; i < trips.length; i++) assert.ok(trips[i].a - trips[i - 1].a >= 12 - 0.01, 'cooldown respected');
  assert.equal(illegal, 0, 'no ball is ever outside the walls without being on a trip');
});

test('owner settings shape it: it never leaves the arena when switched off; intelligence sets how sharp it is', () => {
  const { B, me, foe } = battle({ level: 70, will: { transcend: false, intelligence: 3 } });
  steps(B, 0.05); me.will.realmCd = 0; foe.st.outside = 3; foe.portalExit = { mode: 'safe' };
  let out = false; for (let i = 0; i < 240 * 3; i++) { B.step(STEP); if (me.beyondS || outsideBox(me)) out = true; }
  assert.equal(out, false, 'it stays in the arena'); assert.equal(me.ai.diff, 'expert');
  const calm = battle({ will: { intelligence: 1 } }); steps(calm.B, 0.05); assert.equal(calm.me.ai.diff, 'normal');
});

test('deterministic: the same free-will battle replays identically (also with trips outside the arena and teleports)', () => {
  const run = () => { const { B, me } = battle({ level: 100, enemy: 'portalmaster', seed: 21, infinite: false }); let realms = 0, was = false; for (let i = 0; i < 240 * 90 && !B.result; i++) { B.step(STEP); if (me.beyondS && !was) realms++; was = !!me.beyondS; } return JSON.stringify([B.result && B.result.win, B.fighters.map(f => Math.round(f.hp)), B.time.toFixed(3), realms, me.will.strat]); };
  assert.equal(run(), run());
});
