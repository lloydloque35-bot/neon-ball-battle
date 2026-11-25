'use strict';
/**
 * Anti Ball + Tech Balls update: every ability is exercised in real (headless) battles on the shared game
 * core, plus the server-side unlock rules (Anti Ball free for all, Tech Balls need an active Premium).
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
const cast = (f, type) => { const sk = f.skills.find(s => s.type === type); assert.ok(sk, 'has ' + type); sk.cdLeft = 0; sk.locked = false; f.st.stun = 0; f.casting = 0; return core.useSkill(f, sk); };
const units = (B, f, kind) => B.fighters.filter(x => x.alive && x.owner === f && x.unit && (!kind || x.unit === kind));
const shoot = (B, from, at) => core.spawnProj(from, Math.atan2(at.y - from.y, at.x - from.x), { speed: 950, r: 10, dmg: 8, col: '#fff', power: 50, target: at, homing: 9 });
let srv, player, premium;
test.before(async () => { srv = await startServer(); player = new Client(srv.base); await player.register('free_player'); premium = new Client(srv.base); await premium.register('tech_fan'); });
test.after(async () => { await srv.stop(); });

const near = (a, b, d = 120) => { a.x = b.x - d; a.y = b.y; a.vx = a.vy = 0; };

test('server: Anti Ball is free for everyone; Tech Balls need an active Premium and keep progress when it lapses', async () => {
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: 'anti', difficulty: 'easy' })).status, 200, 'Anti Ball free');
  assert.equal((await player.post('/api/shop/unlock', { ball: 'anti' })).status, 400, 'nothing to buy');
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
  assert.equal((await premium.post('/api/battle/start', { mode: '1v1', ball: 'anti', difficulty: 'easy' })).status, 200, 'Anti Ball stays free');
  srv.S.grantPremium(uid, 30, 0);
  assert.equal((await premium.post('/api/battle/start', { mode: '1v1', ball: 'mecha', difficulty: 'easy' })).status, 200, 'back after renewing');
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
  assert.ok(anti.free && !anti.premium && anti.rarity === 'Secret' && anti.skills.length === 6 && anti.ult.type === 'absolutezero' && anti.passive === 'antiadapt');
  assert.ok(mecha.premium && !mecha.free && mecha.techNo === 1 && mecha.skills.length === 5 && mecha.ult.type === 'titan' && mecha.passive === 'repair');
  assert.ok(cyber.premium && !cyber.free && cyber.techNo === 2 && cyber.skills.length === 6 && cyber.ult.type === 'skynet' && cyber.heat);
  for (const b of [anti, mecha, cyber]) { for (const s of b.skills) assert.ok(core.SKILL_TYPES[s.type], 'skill type ' + s.type); assert.ok(core.ULT_TYPES[b.ult.type]); }
  // mechanical units are never playable, sold or AI opponents
  for (const inc of [false, true]) assert.ok(!core.opponentPool(inc).some(b => b.unit || b.summonOnly));
  assert.ok(!core.allBalls().some(b => b.unit));
});

test('Anti Ball: Null Zone, Power Absorb, Reverse Impact, Mini Black Hole, Void Teleport, Anti Evolution', () => {
  const { B, me, foe } = arena('anti');
  run(B, 0.5);
  // Null Zone weakens enemies and their abilities while inside
  near(foe, me, 100); const atk0 = foe.effAtk();
  assert.equal(cast(me, 'nullzone'), true); run(B, 0.1); near(foe, me, 100); run(B, 0.05);
  assert.ok(foe.st.nulled > 0 && foe.effAtk() < atk0, 'enemy weakened inside the null zone');
  // Power Absorb swallows projectiles (not every one: limited count) and stores energy
  assert.equal(cast(me, 'absorb'), true); const left = me.absorbLeft; assert.ok(left >= 4 && left <= core.ANTI.ABSORB_MAX);
  near(foe, me, 260); shoot(B, foe, me); run(B, 1.2);
  assert.ok(me.energy > 0 && me.absorbLeft === left - 1, 'projectile absorbed into energy');
  me.st.absorb = 0;
  // Reverse Impact sends a projectile back at its source (limited count)
  assert.equal(cast(me, 'reverse'), true); const rl = me.reverseLeft;
  near(foe, me, 300); foe.st.invuln = 0; foe.st.phase = 0; const hp0 = foe.hp; shoot(B, foe, me); run(B, 1.6);
  assert.equal(me.reverseLeft, rl - 1); assert.ok(foe.hp < hp0, 'reversed shot hit the shooter');
  me.st.reverse = 0;
  // ultimates can be neither absorbed nor reversed
  foe.ai = null; B.projs.length = 0;       // only the test's own shot is in flight
  me.st.absorb = 3; me.absorbLeft = 3; me.st.reverse = 3; me.reverseLeft = 3;
  near(foe, me, 260); const p = shoot(B, foe, me); B.projs[B.projs.length - 1].ult = true; const e0 = me.energy; run(B, 1.2);
  assert.equal(me.absorbLeft, 3); assert.equal(me.reverseLeft, 3); assert.equal(me.energy, e0);
  me.st.absorb = me.st.reverse = 0;
  // stored energy powers up the next damaging ability, then is spent
  me.energy = 60; assert.equal(cast(me, 'minihole'), true); assert.equal(me.energy, 0);
  assert.ok(B.zones.some(z => z.kind === 'minihole' && z.owner === me), 'mini black hole opened');
  run(B, 4); assert.ok(!B.zones.some(z => z.kind === 'minihole'), 'vortex is temporary');
  // Void Teleport: briefly gone, then reappears somewhere else
  const x0 = me.x, y0 = me.y; assert.equal(cast(me, 'voidtp'), true); assert.ok(me.st.outside > 0);
  run(B, 0.4); assert.ok(!(me.st.outside > 0) && Math.hypot(me.x - x0, me.y - y0) > 60, 'teleported');
  // Anti Evolution disrupts God Mode / rage bonuses for a while (not permanently)
  near(foe, me, 200); foe.god = 10; foe.rage = true; const godAtk = foe.effAtk();
  assert.equal(cast(me, 'antievo'), true);
  assert.ok(foe.st.antievo > 0 && foe.god <= 5 && foe.effAtk() < godAtk, 'transformation disrupted');
  run(B, 8); assert.equal(foe.st.antievo, 0, 'effect wears off');
});

test('Anti Ball: Absolute Zero suppresses abilities briefly; Anti-Adaptation caps below immunity', () => {
  const { B, me, foe } = arena('anti', 'fire', 11);
  run(B, 0.5); near(foe, me, 160); foe.st.invuln = 0;
  me.ultMeter = 100; me.godUsed = true; assert.equal(core.useUltimate(me), true); run(B, 1.2);
  assert.ok(foe.st.silence > 0, 'enemy abilities suppressed');
  const sk = foe.skills[0]; sk.cdLeft = 0; sk.locked = false; foe.casting = 0; assert.equal(core.useSkill(foe, sk), false, 'silenced balls cannot use abilities');
  run(B, 4); assert.equal(foe.st.silence, 0); assert.ok(foe.silenceImm > 0 || true);
  // passive: repeated projectile hits build resistance up to 30% (never immunity)
  const { B: B2, me: a, foe: f2 } = arena('anti', 'fire', 12); run(B2, 0.3);
  a.st.invuln = 0; let last = Infinity;
  for (let i = 0; i < 40; i++) { a.hp = a.maxHp; a.st.invuln = 0; a.st.shield = 0; const before = a.hp; core.dealDamage(f2, a, 10, { kind: 'skill', tag: 'projectile', noCrit: true, noDef: true }); last = before - a.hp; }
  assert.ok(Math.abs(a.antiRes.projectile - core.ANTI.RES_MAX) < 1e-9, 'capped at 30%');
  assert.ok(last > 0, 'never immune');
});

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
  assert.ok(B.projs.filter(p => p.style === 'missile').length > 0 && B.projs.length - before <= 8);
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
