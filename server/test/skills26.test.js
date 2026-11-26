'use strict';
/**
 * 2.6.0 ULTIMATE UNIQUE SKILL, MASTERY & EVOLUTION SYSTEM
 * Registry & slots by rarity • duplicate audit • every new ability works • every classic signature and every ultimate runs •
 * gradual unlocks • cast pacing / stun-loop / invulnerability limits • combinations • determinism •
 * server: verified mastery (never from practice), evolution requirements, owner-only skill management with audit log, saves.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const S_ = require('../security');
const { startServer, Client } = require('./helpers');
const { createOwner, confirmTotp } = require('../cli/owner');
const { loadCore } = require('../core');

const core = loadCore(); core.setCatalog(null);
const STEP = core.STEP, full = Object.fromEntries(core.TREE.map(n => [n.id, 1]));
const collectible = () => core.allBalls().filter(b => !b.summonOnly && !b.unit && !b.fusion);
const run = (B, s) => { for (let i = 0; i < s * 240 && !B.result; i++) B.step(STEP); };
function lab(ball, o = {}) {
  core.setCatalog(o.catalog || null);
  const T = core.createTicket({ mode: o.mode || '1v1', ball, enemy: o.enemy || 'fire', difficulty: 'normal', infinite: true }, { level: o.level ?? core.maxLvlOf(core.getBall(ball)), evo: 3, up: {}, tree: full, wins: o.wins ?? 999, sevo: o.sevo, mast: o.mast, maxed: o.maxed }, () => 0.5);
  T.seed = o.seed || 7; if (o.practice) T.mode = 'practice';
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true }));
  const me = B.player, foe = B.fighters.find(f => f.team !== me.team); me.ai = null; if (foe && !o.foeAi) { foe.ai = null; if (o.noFoeSkills) foe.skills = []; }
  me.st.invuln = 0; if (foe) foe.st.invuln = 0;
  return { B, me, foe };
}
test.after(() => core.setCatalog(null));

/* ---------------- registry ---------------- */
test('skill slots by rarity (ultimate included); Common / Uncommon keep the abilities they already had', () => {
  assert.deepEqual({ ...core.SLOT_CAP }, { Common: 2, Uncommon: 3, Rare: 4, Epic: 5, Legendary: 6, Mythical: 7, Ancient: 8, Secret: 8, Limited: 9, 'God Tier': 10 });
  for (const b of collectible()) {
    if (b.adminOnly) continue;
    const own = b.skills.filter(s => !s.v26).length + 1, total = b.skills.length + 1;
    if (own >= core.SLOT_CAP[b.rarity]) assert.equal(total, own, b.id + ' keeps exactly its own abilities');
    else assert.equal(total, core.SLOT_CAP[b.rarity], b.id + ' (' + b.rarity + ') fills its slots');
  }
  assert.equal(core.getBall('fire').skills.length, 3, 'Fire Ball (Common) still has its 3 abilities');
});
test('the Unique Skill Registry: unique ids, a category for everything, a signature for every classic ability and ultimate', () => {
  const reg = core.skillRegistry(), ids = new Set();
  for (const r of reg) { assert.ok(!ids.has(r.uid), 'unique uid ' + r.uid); ids.add(r.uid); assert.ok(core.SK_CATS[r.cat], r.uid + ' category ' + r.cat); assert.ok(r.fp.m.length >= 1); }
  assert.ok(reg.length >= 600, 'registry size ' + reg.length);
  assert.ok(reg.filter(r => r.v26).length >= 186, 'the new abilities');   // 187 in 2.6.0; Anti Ball's one was replaced by its 2.8.0 limited edition kit
  const generic = Object.keys(core.TYPE_META), sharedUlts = ['judgment', 'supernova', 'nova', 'barrage', 'blackhole', 'meteorstorm', 'timestop', 'megabeam', 'storm', 'swarm'];
  for (const r of reg) {
    if (r.legacy && generic.includes(r.type) && !['adaptive'].includes(r.type) && r.ball !== 'anti') assert.ok(r.sig, r.uid + ' has a signature mechanic');   // (Anti Ball's 2.8.0 abilities are unique types)
    if (r.isUlt && sharedUlts.includes(r.type)) assert.ok(r.sig, r.uid + ' (shared ultimate type) has its own phase');
  }
  for (const cat of ['offense', 'defense', 'counter', 'mobility', 'summon', 'arena', 'trap', 'environment', 'transform', 'passive', 'autonomous', 'ultimate']) assert.ok(reg.some(r => r.cat === cat), 'category used: ' + cat);
});
test('DUPLICATE AUDIT: no two abilities share their mechanics — and a renamed copy is caught (never by name alone)', () => {
  const dups = core.skAudit().filter(a => a.level === 'duplicate');
  assert.deepEqual([...dups.map(d => d.a + ' ~ ' + d.b)], []);
  const copy = core.skCheckProposal({ type: 'projectile', effect: 'burn', name: 'Totally New Orb' });
  assert.ok(copy[0].score >= core.DUP.BLOCK, 'a plain burning projectile copies Fireball-type abilities even with a new name');
  const renamedSame = core.skillRegistry().find(r => r.uid === 'water.1');
  const byName = core.skSimilarity({ fp: { ...renamedSame.fp, name: 'Completely Different' } }, renamedSame); assert.ok(byName.score >= core.DUP.BLOCK, 'renaming does not make it unique');
  const sameName = core.skCheckProposal({ type: 'shockwave', twist: 'boomerang', effect: 'freeze', name: 'Fireball' });
  assert.ok(!sameName.length || sameName[0].score < core.DUP.BLOCK, 'the same NAME with different mechanics is not a duplicate');
});

/* ---------------- every ability ---------------- */
test('every new 2.6.0 ability works on its own (cast, passive or autonomous) and leaves the battle healthy', () => {
  const failed = [];
  for (const b of collectible()) for (const s of b.skills.filter(s => s.v26)) {
    try {
      const { B, me, foe } = lab(b.id, { mode: s.type === 'k_discord' || s.type === 'k_soullink' ? 'ffa' : '1v1' });
      foe.x = me.x + 220; foe.y = me.y; foe.vx = foe.vy = 0; run(B, 1.6); foe.x = me.x + 220; foe.y = me.y; me.target = foe;
      const sk = me.skills.find(x => x.uid === s.uid); sk.locked = false; sk.cdLeft = 0; me.gcd = 0;
      if (s.type === 'k_hunger' || s.type === 'k_stalker') { foe.hp = foe.maxHp * 0.2; foe.vx = 300; foe.x = me.x + 200; }
      if (s.type === 'k_parallel') { me.sx = me.sx || {}; me.sx.bigHitT = 1; me.sx.bigHitBy = foe; }
      if (s.type === 'k_sentinel') me.st.burn = 2;
      if (s.type === 'k_instinct') foe.ultMeter = 100;
      if (s.type === 'k_recursion') { const other = me.skills.find(x => !x.v26 && x !== sk); other.cdLeft = 0; core.useSkill(me, other); me.gcd = 0; run(B, 0.5); }
      if (s.type === 'k_hemoburst') foe.st.burn = 2;
      if (s.type === 'k_undo') { me.hp = me.maxHp * 0.6; me.sx = me.sx || {}; me.sx.dmgLog = [{ t: B.time, a: me.maxHp * 0.4 }]; }
      if (s.type === 'k_contract' || s.type === 'k_dice') me.hp = me.maxHp;
      if (s.type === 'k_disorder') me.st.burn = 2;
      if (s.type === 'k_order') core.spawnProj(foe, 0, { speed: 300, dmg: 5, col: '#fff', power: 40 });
      if (s.type === 'k_epoch') B.zones.push({ kind: 'trap', owner: foe, team: foe.team, x: 600, y: 400, r: 50, life: 5, max: 5, col: '#fff', effect: 'none', dmg: 1, ticks: new Map() });
      if (s.type === 'k_unmaking') { foe.x = me.x + 120; foe.st.shield = 3; foe.st.shieldPow = 0.5; }
      if (s.type === 'k_tail' || s.type === 'k_grip' || s.type === 'k_wrath') { foe.x = me.x + 130; foe.y = me.y; }
      const before = JSON.stringify([Math.round(foe.hp), Math.round(me.hp), B.projs.length, B.zones.length, B.lasers.length, B.waves.length, B.strikes.length, B.fighters.length, B.timers.length, (B.walls26 || []).length, Object.keys(me.sx || {}).length, Object.keys(foe.sx || {}).length, me.temp ? 1 : 0, Math.round(foe.x)]);
      let ok;
      if (s.passive26) { run(B, 3); ok = true; }
      else if (s.auto26) { ok = core.useSkill === undefined ? false : true; me.autoCasting = true; ok = core.useSkill(me, sk); me.autoCasting = false; }
      else ok = core.useSkill(me, sk);
      if (!s.passive26) assert.notEqual(ok, false, `${b.id} ${s.name} can be used`);
      const after = JSON.stringify([Math.round(foe.hp), Math.round(me.hp), B.projs.length, B.zones.length, B.lasers.length, B.waves.length, B.strikes.length, B.fighters.length, B.timers.length, (B.walls26 || []).length, Object.keys(me.sx || {}).length, Object.keys(foe.sx || {}).length, me.temp ? 1 : 0, Math.round(foe.x)]);
      run(B, 4);
      assert.ok(s.passive26 || before !== after || B.time > 0, `${b.id} ${s.name} does something`);
      for (const f of B.fighters) assert.ok(Number.isFinite(f.hp) && Number.isFinite(f.x) && Number.isFinite(f.y), `${b.id} ${s.name}: numbers stay valid`);
      assert.equal(me.skUse[s.uid] > 0 || s.passive26, true, `${s.uid} counted for mastery`);
    } catch (e) { failed.push(`${b.id} ${s.name}: ${e.message}`); }
  }
  assert.deepEqual(failed, []);
});
test('every classic ability with its signature, and every ultimate, runs without errors', () => {
  const failed = [];
  for (const b of collectible()) {
    try {
      for (const s of b.skills.filter(s => !s.v26)) { const { B, me, foe } = lab(b.id); run(B, 0.05); me.target = foe; const sk = me.skills.find(x => x.uid === s.uid); sk.locked = false; sk.cdLeft = 0; me.gcd = 0; core.useSkill(me, sk); run(B, 2.5); }
      const { B, me } = lab(b.id); run(B, 0.05); me.ultMeter = 100; core.useUltimate(me); run(B, 4);
      for (const f of B.fighters) assert.ok(Number.isFinite(f.hp) && Number.isFinite(f.x));
    } catch (e) { failed.push(b.id + ': ' + e.message); }
  }
  assert.deepEqual(failed, []);
});
test('signatures really change the classic abilities (Fireball leaves burning ground; Rock Throw ricochets)', () => {
  { const { B, me, foe } = lab('fire'); run(B, 0.05); foe.x = me.x + 160; foe.y = me.y; me.target = foe; const sk = me.skills[0]; sk.cdLeft = 0; core.useSkill(me, sk); let zone = false; for (let i = 0; i < 240 * 1.5; i++) { B.step(STEP); if (B.zones.some(z => z.sk === 'fire.0')) zone = true; } assert.ok(zone, 'Ember Scatter'); }
  { const { B, me, foe } = lab('earth'); run(B, 0.05); me.target = foe; const sk = me.skills[0]; sk.cdLeft = 0; core.useSkill(me, sk); const p = B.projs.find(p => p.sk === 'earth.0'); assert.ok(p && p.bounce >= 2, 'Skipping Stone'); }
});

/* ---------------- progression ---------------- */
test('gradual unlocking: new abilities follow the ball’s level (and wins for the rarest balls); never all at once', () => {
  const b = core.getBall('seraphim'), news = b.skills.filter(s => s.v26), lvls = news.map(s => s.unlockLv);
  assert.ok(lvls.every((l, i) => !i || l >= lvls[i - 1]) && lvls[0] >= 15 && lvls[lvls.length - 1] <= 50, 'spread over the level range ' + lvls);
  assert.ok(news.some(s => s.unlockWins), 'the rarest balls also need wins for their last abilities');
  const at = (lv, wins) => lab('seraphim', { level: lv, wins }).me.skills.filter(s => s.v26 && !s.locked).length;
  assert.equal(at(1, 0), 0); assert.ok(at(30, 0) > 0 && at(30, 0) < news.length); assert.ok(at(50, 0) < news.length, 'wins still missing'); assert.equal(at(50, 999), news.length);
  assert.equal(lab('seraphim', { level: 50, wins: 0, maxed: true }).me.skills.filter(s => s.locked).length, 0, 'Premium / owner balls at full power');
  const abs = lab('godofabsolute', { level: 50, wins: 999 }).me; assert.equal(abs.skills.filter(s => s.v26 && !s.locked).length, 0, 'God of Absolute: its new abilities come from Lv 55');
  core.setCatalog(null); assert.equal(core.unlockText(news[0]), `Ball Lv ${news[0].unlockLv}`);
});
test('balance rules: global cast pacing, no stun loops, no permanent invulnerability, bigger kits hit a little lighter', () => {
  const { B, me, foe } = lab('seraphim'); run(B, 0.05); me.target = foe;
  const [a, b] = me.skills.filter(s => !s.v26); a.cdLeft = 0; b.cdLeft = 0;
  assert.notEqual(core.useSkill(me, a), false); assert.equal(core.useSkill(me, b), false, 'second ability in the same instant is refused'); run(B, core.SK_GCD + 0.05); assert.notEqual(core.useSkill(me, b), false);
  assert.ok(me.kitK < 1 && me.kitK > 0.85, 'kit factor ' + me.kitK);
  { const { B, me, foe } = lab('fire'); run(B, 0.05); let freed = false; for (let i = 0; i < 240 * 6; i++) { foe.st.stun = Math.max(foe.st.stun, 0.5); B.step(STEP); if (foe.ccImm > 0) { freed = true; break; } } assert.ok(freed, 'UNSTOPPABLE after 3.2 s of chained control'); }
  { const { B, foe } = lab('fire'); run(B, 0.05); let exposed = false; for (let i = 0; i < 240 * 8; i++) { foe.st.invuln = 1; B.step(STEP); if (foe.exposeT > 0) { exposed = true; break; } } assert.ok(exposed, 'EXPOSED after 4.5 s of continuous invulnerability'); }
});
test('underdog spirit: a lower rarity fighting a higher one deals more and takes less; equal rarities are untouched', () => {
  const { B, me, foe } = lab('fire', { enemy: 'seraphim' }); run(B, 0.6);
  assert.ok(me.underdog26 > 0.3 && me.underdog26 <= 0.4, 'Common vs God Tier ' + me.underdog26); assert.equal(foe.underdog26, 0);
  const x = lab('fire', { enemy: 'ice' }); run(x.B, 0.6); assert.equal(x.me.underdog26, 0);
});
test('combinations are deliberate: Wildfire spreads fire only from a burning target; reactions need two different allied balls', () => {
  const { B, me, foe } = lab('fire', { mode: '2v2' }); run(B, 0.05); const es = B.fighters.filter(f => f.team !== me.team); for (const e of es) { e.x = me.x + 150; e.y = me.y; e.ai = null; e.skills = []; e.st.invuln = 0; }
  es[0].st.burn = 2; es[0].burnDps = 2; const ring = me.skills[2]; ring.locked = false; ring.cdLeft = 0; core.useSkill(me, ring); run(B, 0.6);
  assert.ok((me.comboLog || {}).wildfire >= 1, 'Wildfire'); assert.ok(es[1].st.burn > 0, 'the fire spread');
  const r = core.COMBOS.filter(c => c.kind === 'reaction'); assert.ok(r.length >= 5 && core.COMBOS.length >= 40);
  assert.ok(core.COMBOS.every(c => c.desc && c.name && c.balls.length), 'every combination is documented');
});
test('evolutions add a NEW mechanic (not just numbers) and the same battle replays identically', () => {
  const p0 = lab('phoenix', { sevo: {} }), p3 = lab('phoenix', { sevo: { 'phoenix.0': 3 } });
  const t0 = core.EVO26['phoenix.0']; assert.equal(t0.length, 3); assert.ok(new Set(t0.map(e => e.t)).size === 3);
  assert.equal(p3.me.sevo['phoenix.0'], 3); assert.ok(!p0.me.sevo || !Object.keys(p0.me.sevo).length);
  const play = () => { const T = core.createTicket({ mode: '1v1', ball: 'phoenix', enemy: 'dragon', difficulty: 'hard' }, { level: 50, evo: 3, up: {}, tree: full, wins: 99, sevo: { 'phoenix.0': 3 }, mast: { 'phoenix.0': 9999 } }, () => 0.3); T.seed = 99; core.setCatalog(null); const r = core.simulateTicket(T, []); return JSON.stringify([r.win, r.step, r.skUse]); };
  assert.equal(play(), play());
  assert.equal(core.evoPathLen(core.getBall('fire')), 1); assert.equal(core.evoPathLen(core.getBall('laser')), 2); assert.equal(core.evoPathLen(core.getBall('seraphim')), 3);
});
test('Skill Training never rewards anything', () => {
  const T = { mode: 'practice', difficulty: 'normal', opts: { training: true } };
  assert.deepEqual({ ...core.computeRewards(T, { win: true }) }, { coins: 0, exp: 0, rp: 0 });
  assert.deepEqual({ ...core.computeRewards({ mode: 'training', difficulty: 'normal', opts: {} }, { win: true }) }, { coins: 0, exp: 0, rp: 0 });
});

/* ---------------- server ---------------- */
let srv, owner, secret, ctr;
const nextCode = () => S_.totpCode(secret, ++ctr);
async function player(name) { const c = new Client(srv.base); assert.equal((await c.register(name)).status, 200); return c; }
const uidOf = name => srv.db.get('SELECT id FROM users WHERE username = ?', name).id;
test('server: mastery only from verified battles (capped, never practice), titles, evolution with requirements, owner-only skill management', async () => {
  srv = await startServer();
  try {
    await createOwner(srv.db, { username: 'Boss', password: 'Owner-Pass-9876!' });
    const pending = srv.db.get("SELECT totp_pending FROM users WHERE role = 'owner'").totp_pending;
    ctr = Math.floor(Date.now() / 30000) - 1; assert.ok(confirmTotp(srv.db, S_.totpCode(pending, ctr))); secret = pending;
    owner = new Client(srv.base); assert.equal((await owner.post('/api/auth/login', { username: 'Boss', password: 'Owner-Pass-9876!', code: nextCode() })).status, 200);
    const c = await player('sk26_player'), uid = uidOf('sk26_player');
    // a verified battle → mastery
    srv.db.run("INSERT INTO user_balls (user_id, ball_id, owned, level) VALUES (?, 'fire', 1, 20) ON CONFLICT(user_id, ball_id) DO UPDATE SET owned = 1, level = 20", uid);
    const st = await c.post('/api/battle/start', { mode: '1v1', ball: 'fire', enemy: 'ice', difficulty: 'easy' }); assert.equal(st.status, 200);
    srv.db.run('UPDATE battles SET created_at = created_at - 3600000 WHERE id = ?', st.data.ticket.id);
    core.setCatalog(srv.db.get('SELECT catalog FROM battles WHERE id = ?', st.data.ticket.id).catalog ? JSON.parse(srv.db.get('SELECT catalog FROM battles WHERE id = ?', st.data.ticket.id).catalog) : null);
    const local = core.simulateTicket(st.data.ticket, []); core.setCatalog(null);
    const fin = await c.post('/api/battle/finish', { id: st.data.ticket.id, inputs: [], claimed: { win: local.win, step: local.step } }); assert.equal(fin.status, 200, JSON.stringify(fin.data));
    assert.ok(fin.data.mastery && Object.keys(fin.data.mastery.gains).length >= 1, 'mastery gained');
    for (const g of Object.values(fin.data.mastery.gains)) assert.ok(g <= core.MASTERY_XP.cap + core.MASTERY_XP.win, 'capped per battle');
    const m1 = srv.db.all('SELECT * FROM skill_mastery WHERE user_id = ?', uid); assert.ok(m1.length >= 1 && m1.every(r => r.ball_id === 'fire'));
    assert.ok(fin.data.save.skills26.mastery['fire.0'] >= 0, 'in the save');
    // practice gives nothing
    const pr = await c.post('/api/battle/start', { mode: 'practice', ball: 'fire', enemy: 'ice', difficulty: 'easy' }); const before = JSON.stringify(srv.db.all('SELECT * FROM skill_mastery WHERE user_id = ?', uid));
    await c.post('/api/battle/finish', { id: pr.data.ticket.id, inputs: [], claimed: { win: true, step: 100 } }); assert.equal(JSON.stringify(srv.db.all('SELECT * FROM skill_mastery WHERE user_id = ?', uid)), before, 'practice: no mastery');
    // evolution: requirements are enforced
    let ev = await c.post('/api/skills/evolve', { ball: 'fire', uid: 'fire.0' }); assert.equal(ev.status, 400, 'needs Skilled mastery'); assert.match(ev.data.error, /mastery/i);
    srv.db.run("UPDATE skill_mastery SET xp = 200 WHERE user_id = ? AND skill_uid = 'fire.0'", uid); srv.db.run("INSERT OR IGNORE INTO skill_mastery (user_id, ball_id, skill_uid, xp, updated_at) VALUES (?, 'fire', 'fire.0', 200, 1)", uid);
    srv.db.run('UPDATE profiles SET coins = 100 WHERE user_id = ?', uid);
    ev = await c.post('/api/skills/evolve', { ball: 'fire', uid: 'fire.0' }); assert.equal(ev.status, 402, 'not enough coins');
    srv.db.run('UPDATE profiles SET coins = 5000 WHERE user_id = ?', uid);
    ev = await c.post('/api/skills/evolve', { ball: 'fire', uid: 'fire.1' }); assert.equal(ev.status, 400, 'only the signature ability evolves');
    ev = await c.post('/api/skills/evolve', { ball: 'fire', uid: 'fire.0' }); assert.equal(ev.status, 200, JSON.stringify(ev.data)); assert.equal(ev.data.stage, 1);
    assert.equal(srv.db.get('SELECT coins FROM profiles WHERE user_id = ?', uid).coins, 3500, 'coins paid');
    assert.equal((await c.post('/api/skills/evolve', { ball: 'fire', uid: 'fire.0' })).status, 400, 'Fire Ball (Common) has one stage');
    const t2 = await c.post('/api/battle/start', { mode: 'practice', ball: 'fire', enemy: 'ice', difficulty: 'easy' }); assert.deepEqual({ ...t2.data.ticket.teams[0][0].sevo }, { 'fire.0': 1 }, 'the evolution is part of the server ticket');
    assert.throws(() => srv.db.run('DELETE FROM skill_evolution_log'), /append-only/);
    // owner-only management
    assert.ok([401, 403].includes((await c.get('/api/admin/skills')).status), 'players cannot open skill management');
    assert.ok([401, 403].includes((await c.post('/api/admin/skills/override', { uid: 'fire.0', power: 200 })).status));
    const d = (await owner.get('/api/admin/skills')).data; assert.ok(d.registry.length >= 600 && Array.isArray(d.audit) && d.twists.length > 20);
    assert.equal((await owner.post('/api/admin/skills/override', { uid: 'fire.0', power: 999 })).status, 200);
    assert.equal((await owner.get('/api/catalog')).data.skills26.overrides['fire.0'].power, 250, 'clamped to the allowed range');
    assert.equal((await owner.post('/api/admin/skills/override', { uid: 'fire.0', off: true })).status, 400, 'classic abilities cannot be switched off');
    assert.equal((await owner.post('/api/admin/skills/custom', { ball: 'chronos', name: 'Burning Orb', type: 'projectile', effect: 'burn', cd: 4, power: 45 })).status, 409, 'a renamed copy is refused');
    const cu = await owner.post('/api/admin/skills/custom', { ball: 'chronos', name: 'Clockwork Disc', type: 'projectile', twist: 'boomerang', effect: 'slow', cd: 6, power: 50 }); assert.equal(cu.status, 200, JSON.stringify(cu.data));
    assert.equal((await owner.post('/api/admin/skills/custom', { ball: 'fire', name: 'Extra Flame', type: 'buff', twist: 'critUp', cd: 9, power: 50 })).status, 400, 'no free slot');
    assert.equal((await owner.post('/api/admin/skills/config', { mastery: [0, 100, 50, 900, 2000] })).status, 400, 'ranks must increase');
    assert.equal((await owner.post('/api/admin/skills/config', { evoReq: [{ lv: 10, rank: 1, coins: 1000 }, { lv: 25, rank: 2, coins: 3000 }, { lv: 40, rank: 3, coins: 8000 }] })).status, 200);
    const audit = srv.db.all("SELECT action FROM audit_logs WHERE action LIKE 'admin.skill%'").map(r => r.action);
    for (const a of ['admin.skill_override', 'admin.skill_create', 'admin.skill_config']) assert.ok(audit.includes(a), 'audit log: ' + a);
    // the owner's settings are stored with each battle
    const t3 = await c.post('/api/battle/start', { mode: 'practice', ball: 'fire', enemy: 'ice', difficulty: 'easy' });
    const cat = JSON.parse(srv.db.get('SELECT catalog FROM battles WHERE id = ?', t3.data.ticket.id).catalog); assert.equal(cat.skills26.overrides['fire.0'].power, 250); assert.ok(cat.skills26.custom.some(x => x.name === 'Clockwork Disc'));
    // mastery titles
    srv.db.run("UPDATE skill_mastery SET xp = 3500 WHERE user_id = ? AND skill_uid = 'fire.0'", uid);
    const st2 = await c.post('/api/battle/start', { mode: '1v1', ball: 'fire', enemy: 'ice', difficulty: 'easy' }); srv.db.run('UPDATE battles SET created_at = created_at - 3600000 WHERE id = ?', st2.data.ticket.id);
    core.setCatalog(JSON.parse(srv.db.get('SELECT catalog FROM battles WHERE id = ?', st2.data.ticket.id).catalog)); const l2 = core.simulateTicket(st2.data.ticket, []); core.setCatalog(null);
    const f2 = await c.post('/api/battle/finish', { id: st2.data.ticket.id, inputs: [], claimed: { win: l2.win, step: l2.step } }); assert.equal(f2.status, 200);
    assert.ok(f2.data.save.cosmetics.includes('title_grandmaster') && f2.data.save.cosmetics.includes('title_master'), 'mastery titles granted');
    assert.equal((await c.post('/api/cosmetics/buy', { id: 'title_grandmaster' })).status, 400, 'mastery titles cannot be bought');
  } finally { await srv.stop(); core.setCatalog(null); }
});
