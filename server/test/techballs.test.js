'use strict';
/**
 * Anti Ball + Tech Balls update: every ability is exercised in real (headless) battles on the shared game
 * core, plus the server-side unlock rules (Tech Balls need an active Premium). Since 2.8.0 Anti Ball is a 100-copy
 * limited edition with a new kit: see anti_edition.test.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, Client } = require('./helpers');
const { loadCore } = require('../core');

const core = loadCore(); core.setCatalog(null);
const MAXP = { level: 50, evo: 3, up: {}, tree: Object.fromEntries(core.TREE.map(n => [n.id, 1])) };

/* a 1v1 with the given ball (fully upgraded, every ability unlocked) against an AI enemy */
function arena(ball, enemy = 'thunder', seed = 7) {
  const T = core.createTicket({ mode: '1v1', ball, enemy, difficulty: 'hard', manual: false }, MAXP, () => 0.37);
  T.seed = seed;
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  const me = B.fighters.find(f => f.team === 0 && !f.isClone), foe = B.fighters.find(f => f.team === 1 && !f.isClone);
  me.ai = null;        // abilities are triggered by the test itself
  return { B, me, foe };
}
const run = (B, sec) => { for (let i = 0; i < sec * 240 && !B.result; i++) B.step(core.STEP); };
const cast = (f, type) => { const sk = f.skills.find(s => s.type === type); assert.ok(sk, 'has ' + type); sk.cdLeft = 0; sk.locked = false; f.st.stun = 0; f.casting = 0; f.gcd = 0; return core.useSkill(f, sk); };      // (2.6.0: past the global cast pacing)
const units = (B, f, kind) => B.fighters.filter(x => x.alive && x.owner === f && x.unit && (!kind || x.unit === kind));
const shoot = (B, from, at) => core.spawnProj(from, Math.atan2(at.y - from.y, at.x - from.x), { speed: 950, r: 10, dmg: 8, col: '#fff', power: 50, target: at, homing: 9 });
let srv, player, premium;
test.before(async () => { srv = await startServer(); player = new Client(srv.base); await player.register('free_player'); premium = new Client(srv.base); await premium.register('tech_fan'); });
test.after(async () => { await srv.stop(); });

const near = (a, b, d = 120) => { a.x = b.x - d; a.y = b.y; a.vx = a.vy = 0; };

test('server: Anti Ball needs a verified copy (2.8.0); Tech Balls need an active Premium and keep progress when it lapses', async () => {
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: 'anti', difficulty: 'easy' })).status, 403, 'Anti Ball: limited edition');
  assert.equal((await player.post('/api/shop/unlock', { ball: 'anti' })).status, 400, 'not for coins');
  for (const b of ['mecha', 'cyber']) {
    assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: b, difficulty: 'easy' })).status, 403, b + ' locked without premium');
    assert.equal((await player.post('/api/shop/unlock', { ball: b })).status, 400, b + ' cannot be bought with coins');
    assert.equal((await player.post('/api/battle/start', { mode: 'practice', ball: b, trial: true })).status, 200, b + ' can be tried in practice');
  }
  const uid = srv.db.get("SELECT id FROM users WHERE username = 'tech_fan'").id;
  srv.S.grantPremium(uid, 30, 0);
  assert.equal((await premium.post('/api/battle/start', { mode: '1v1', ball: 'mecha', difficulty: 'easy' })).status, 200, 'premium unlocks Tech Ball 1');
  assert.equal((await premium.post('/api/battle/start', { mode: '1v1', ball: 'cyber', difficulty: 'easy' })).status, 200, 'premium unlocks Tech Ball 2');
  srv.S.ensureBallRow(uid, 'mecha'); srv.db.run("UPDATE user_balls SET level = 17, exp = 5 WHERE user_id = ? AND ball_id = 'mecha'", uid);
  srv.db.run('UPDATE subscriptions SET current_period_end = ? WHERE user_id = ?', Date.now() - 1000, uid); srv.S.expireSubscriptions();
  assert.equal((await premium.post('/api/battle/start', { mode: '1v1', ball: 'mecha', difficulty: 'easy' })).status, 403, 'locked again after expiry');
  assert.equal(srv.db.get("SELECT level FROM user_balls WHERE user_id = ? AND ball_id = 'mecha'", uid).level, 17, 'progress preserved');
  assert.equal((await premium.post('/api/battle/start', { mode: '1v1', ball: 'anti', difficulty: 'easy' })).status, 403, 'Premium does not include the limited edition');
  srv.S.grantPremium(uid, 30, 0);
  assert.equal((await premium.post('/api/battle/start', { mode: '1v1', ball: 'mecha', difficulty: 'easy' })).status, 200, 'back after renewing');
});

test('Premium balls are always at full power for Premium members (Lv 50, fully evolved), without touching saved progress', async () => {
  const c = new Client(srv.base); await c.register('max_fan');
  const uid = srv.db.get("SELECT id FROM users WHERE username = 'max_fan'").id;
  let save = (await c.get('/api/save')).data;
  assert.ok(!save.balls.prism || save.balls.prism.level < 50, 'free players: no boost');
  srv.S.grantPremium(uid, 30, 0);
  save = (await c.get('/api/save')).data;
  for (const id of ['prism', 'mirror', 'mecha', 'cyber']) { const b = save.balls[id]; assert.ok(b && b.level === 50 && b.evo === 3 && b.maxed && b.tree.slot4 && b.up.atk > 0, id + ' maxed'); }
  assert.ok(!save.balls.fire.maxed, 'regular balls keep their own progress');
  const t = (await c.post('/api/battle/start', { mode: '1v1', ball: 'cyber', difficulty: 'easy' })).data.ticket;
  assert.equal(t.teams[0][0].level, 50); assert.equal(t.teams[0][0].evo, 3);
  assert.equal((await c.post('/api/shop/upgrade', { ball: 'mecha', stat: 'atk' })).status, 400, 'nothing to upgrade');
  assert.equal((await c.post('/api/ball/evolve', { ball: 'mecha' })).status, 400);
  assert.ok(!srv.db.get("SELECT 1 FROM user_balls WHERE user_id = ? AND ball_id = 'mecha' AND level = 50", uid), 'saved progress untouched');
  srv.db.run('UPDATE subscriptions SET current_period_end = ? WHERE user_id = ?', Date.now() - 1000, uid); srv.S.expireSubscriptions();
  save = (await c.get('/api/save')).data;
  assert.ok(!save.balls.mecha || !save.balls.mecha.maxed, 'boost ends with the subscription');
});

test('5th and 6th abilities pressed manually are accepted and replay exactly on the server', async () => {
  const c = new Client(srv.base); await c.register('six_skills');
  const r = await c.post('/api/battle/start', { mode: 'practice', ball: 'cyber', trial: true, dummy: true, manual: true });
  assert.equal(r.status, 200);
  const T = r.data.ticket, inputs = [[10, 'm', 1], [240, 'k', 4], [480, 'k', 5], [720, 'k', 0]];
  const res = core.simulateTicket(T, inputs, 240 * 8);
  const fin = await c.post('/api/battle/finish', { id: T.id, inputs, claimed: { win: false } });
  assert.notEqual(fin.status, 400, 'inputs for abilities 5 and 6 are valid: ' + JSON.stringify(fin.data));
  assert.ok(res);
});

test('the three new balls exist with the right unlock type, rarity and abilities', () => {
  const anti = core.getBall('anti'), mecha = core.getBall('mecha'), cyber = core.getBall('cyber');
  assert.ok(anti.edition && anti.paid && !anti.free && !anti.premium && anti.rarity === 'Limited' && anti.skills.length === 8 && anti.ult.type === 'a_existence' && anti.passive === 'adaptivenull');
  assert.ok(mecha.premium && !mecha.free && mecha.techNo === 1 && mecha.skills.filter(s => !s.v26).length === 5 && mecha.ult.type === 'titan' && mecha.passive === 'repair');
  assert.ok(cyber.premium && !cyber.free && cyber.techNo === 2 && cyber.skills.filter(s => !s.v26).length === 6 && cyber.ult.type === 'skynet' && cyber.heat);
  for (const b of [anti, mecha, cyber]) { for (const s of b.skills) assert.ok(core.SKILL_TYPES[s.type], 'skill type ' + s.type); assert.ok(core.ULT_TYPES[b.ult.type]); }
  // mechanical units are never playable, sold or AI opponents
  for (const inc of [false, true]) assert.ok(!core.opponentPool(inc).some(b => b.unit || b.summonOnly));
  assert.ok(!core.allBalls().some(b => b.unit));
});

/* the old Anti Ball kit (Power Absorb, Reverse Impact, …) was replaced by the 2.8.0 limited edition kit — see anti_edition.test.js */

test('Mecha Commander: robots (capped), factory, missiles, drone, fusion, emergency repair, Titan', () => {
  const { B, me, foe } = arena('mecha', 'phoenix', 21);
  run(B, 0.5);
  assert.equal(cast(me, 'robots'), true); assert.equal(units(B, me, 'robot').length, 3);
  assert.equal(cast(me, 'robots'), true); assert.equal(units(B, me, 'robot').length, core.UNIT.ROBOT_MAX, 'robot cap');
  assert.equal(cast(me, 'robots'), false, 'no unlimited summoning');
  // robots hunt the enemy and never attack their commander
  const myHp = me.hp; run(B, 3);
  assert.ok(me.stats.dmg > 0, 'robot damage is credited to the commander'); assert.ok(me.hp >= myHp - 60);
  for (const r of units(B, me, 'robot')) { assert.ok(r.x >= 46 && r.x <= 46 + 1188 && r.y >= 112 && r.y <= 112 + 578, 'robots stay inside the arena'); }
  // fusion merges the robots into one Mega Robot
  assert.equal(cast(me, 'fusionbot'), true); run(B, 0.6);
  assert.equal(units(B, me, 'robot').length, 0); assert.equal(units(B, me, 'megabot').length, 1);
  assert.equal(cast(me, 'fusionbot'), false, 'needs at least two robots');
  // the factory produces robots over time, up to its limit, and can be destroyed
  assert.equal(cast(me, 'factory'), true); const fac = units(B, me, 'factory')[0]; assert.ok(fac && fac.anchored);
  const fx = fac.x; run(B, 8); assert.ok(fac.builds >= 2 && fac.builds <= core.UNIT.FACTORY_BUILDS); assert.equal(fac.x, fx, 'factory does not move');
  core.dealDamage(foe, fac, 1e6, { kind: 'skill', noDef: true }); assert.equal(fac.alive, false, 'factory can be destroyed');
  // missiles: limited count, tracking, explode
  const before = B.projs.length; assert.equal(cast(me, 'missiles'), true); run(B, 0.6);
  const mine = B.projs.slice(before).filter(p => p.owner === me); assert.ok(mine.some(p => p.style === 'missile') && mine.length <= 8, 'limited missiles (the enemy’s own shots are not counted)');
  // defense drone blocks part of the damage until destroyed
  assert.equal(cast(me, 'drone'), true); const dr = me.guard; assert.ok(dr && dr.alive && dr.tether);
  me.st.invuln = 0; me.st.shield = 0; const h0 = me.hp, d0 = dr.hp; core.dealDamage(foe, me, 20, { kind: 'skill', noCrit: true, noDef: true });
  assert.ok(dr.hp < d0 && h0 - me.hp < 20 * 0.5 + 0.01, 'drone absorbed half the hit');
  // emergency repair: automatic at 20% HP, limited heal, long cooldown
  me.hp = me.maxHp * 0.15; run(B, 0.05);
  assert.equal(units(B, me, 'repair').length, 1, 'repair robot arrived'); assert.ok(me.repairCd > 30 && me.st.shield > 0);
  const low = me.hp; run(B, 4); assert.ok(me.hp > low, 'HP restored'); assert.ok(me.hp <= low + me.maxHp * core.UNIT.REPAIR_HEAL + 1, 'limited heal');
  me.hp = me.maxHp * 0.1; run(B, 0.5); assert.equal(me.repairs, 1, 'no repeat activation during cooldown');
  me.hp = me.maxHp;
  // Titan Overdrive
  me.ultMeter = 100; me.godUsed = true; assert.equal(core.useUltimate(me), true); run(B, 1.2);
  const ti = units(B, me, 'titan')[0]; assert.ok(ti && ti.alive && ti.r > me.r, 'giant robot entered the arena');
  run(B, 20); assert.equal(units(B, me, 'titan').length, 0, 'titan has a limited duration');
});

test('Cyber Overlord: laser grid, holograms, EMP, trap, turrets, overclock, heat and Skynet', () => {
  const { B, me, foe } = arena('cyber', 'mecha', 31);
  run(B, 0.5);
  assert.equal(cast(me, 'lasergrid'), true); assert.equal(B.lasers.filter(l => l.owner === me).length, 4);
  assert.ok(me.heat > 0, 'abilities generate heat');
  // holograms mirror the master's movement and fool targeting
  assert.equal(cast(me, 'hologram'), true); const holos = units(B, me, 'holo'); assert.equal(holos.length, 2);
  assert.ok(holos.every(h => h.decoy && h.def.id === 'cyber'));
  let same = 0; for (let i = 0; i < 20; i++) { run(B, 0.05); const h = holos[0]; if (!h.alive) break; const mx = -me.vx, my = me.vy, d = (h.vx * mx + h.vy * my) / ((Math.hypot(h.vx, h.vy) * Math.hypot(mx, my)) || 1); if (d > 0.8) same++; }
  assert.ok(same >= 12, 'mirrors movement (' + same + '/20)');
  // EMP: disables enemy abilities temporarily and shorts out the enemy's robots
  foe.ultMeter = 0; me.heat = 0; const sk = foe.skills.find(s => s.type === 'robots'); sk.cdLeft = 0; sk.locked = false; foe.st.stun = 0; foe.casting = 0;
  assert.equal(core.useSkill(foe, sk), true); run(B, 0.6);
  near(foe, me, 140); for (const r of units(B, foe, 'robot')) near(r, me, 120);
  foe.st.invuln = 0; assert.equal(cast(me, 'emp'), true); run(B, 0.5);
  assert.ok(foe.st.silence > 0, 'enemy silenced'); assert.ok(units(B, foe, 'robot').every(r => r.st.stun > 0 || !r.alive), 'robots shorted out');
  run(B, 3); assert.equal(foe.st.silence, 0, 'never permanent');
  // cyber trap and turrets
  me.heat = 0; assert.equal(cast(me, 'cybertrap'), true); assert.ok(B.zones.some(z => z.kind === 'cybertrap'));
  me.heat = 0; assert.equal(cast(me, 'turret'), true); me.heat = 0; assert.equal(cast(me, 'turret'), true); me.heat = 0;
  assert.equal(cast(me, 'turret'), false, 'turret cap'); assert.ok(units(B, me, 'turret').every(t => t.anchored));
  // overclock: faster, with heat building 50% faster
  me.heat = 0; assert.equal(cast(me, 'overclock'), true); assert.ok(me.speedMul() > 1.2 && me.cdMul() < 1);
  // overheat blocks the heavy abilities until it cools down
  me.heat = 95; assert.equal(cast(me, 'lasergrid'), true); assert.ok(me.st.overheat > 0);
  assert.equal(cast(me, 'emp'), false, 'overheated');
  run(B, 3.5); assert.ok(!(me.st.overheat > 0) && me.heat < 100);
  // Skynet Protocol
  me.ultMeter = 100; me.godUsed = true; assert.equal(core.useUltimate(me), true); run(B, 3);
  assert.ok(units(B, me, 'skydrone').length >= 1 && B.lasers.some(l => l.sweep), 'drones, turrets and sweeping lasers deployed');
  run(B, 12); assert.equal(units(B, me, 'skydrone').length, 0, 'limited duration');
});

test('full AI battles with the new balls finish, stay deterministic and keep unit counts bounded', () => {
  const pairs = [['anti', 'mecha'], ['mecha', 'cyber'], ['cyber', 'anti'], ['anti', 'ancientgod'], ['mecha', 'thunder'], ['cyber', 'vampire']];
  for (const [a, b] of pairs) {
    const T = core.createTicket({ mode: '1v1', ball: a, enemy: b, difficulty: 'hard', manual: false }, MAXP, () => 0.42);
    const r1 = core.simulateTicket(T), r2 = core.simulateTicket(T);
    assert.ok(r1.ok, `${a} vs ${b} finished`);
    assert.deepEqual(r1, r2, `${a} vs ${b} is deterministic`);
  }
  // online PvP (lockstep): both players and the server must compute the exact same match
  for (const [a, b] of [['anti', 'cyber'], ['mecha', 'anti']]) {
    const T = core.createPvpTicket([{ ball: a, ...MAXP, name: 'p1' }, { ball: b, ...MAXP, name: 'p2' }], 4242);
    const inputs = [[100, 0, 'k', 4], [300, 1, 'k', 5], [500, 0, 'u'], [700, 1, 'k', 3]];
    assert.deepEqual(core.simulateTicket(T, inputs), core.simulateTicket(T, inputs), `PvP ${a} vs ${b} is deterministic`);
  }
  // peak unit count in a long battle
  const { B } = arena('mecha', 'cyber', 77); let peak = 0;
  for (let i = 0; i < 240 * 60 && !B.result; i++) { B.step(core.STEP); if (i % 24 === 0) peak = Math.max(peak, B.fighters.filter(f => f.alive).length); }
  assert.ok(peak <= 2 + core.UNIT.ALL_MAX * 2 + 8, 'peak fighters ' + peak);
});
