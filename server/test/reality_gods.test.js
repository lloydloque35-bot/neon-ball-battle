'use strict';
/**
 * 2.9.0 REALITY VS ABSOLUTE — the battle side (the same core the browser and the server run):
 * every ability in all 3 forms, passives and energy meters, both ultimates, the 3 transformations, the safety limits
 * (deletion / suppression / chains / sentence: warnings, resistance, caps, counterplay), the Fate Notebook input,
 * the REALITY CLASH (timing decides, not the ball), GOD SYNERGY (cooldowns, no loops), the REALITY COLLISION ZONE
 * (solid geometry, spawns, neutral hazards, determinism, classic arena unchanged), THE FRACTURED ARCHON (3 phases,
 * co-op ticket) and God Mastery (looks only).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../core');

const core = loadCore(); core.setCatalog(null);
const STEP = core.STEP, full = Object.fromEntries(core.TREE.map(n => [n.id, 1]));
const run = (B, s) => { for (let i = 0; i < s * 240 && !B.result; i++) B.step(STEP); };
const J = x => JSON.stringify(x);
function lab(ball, o = {}) {
  const T = core.createTicket({ mode: o.mode || '1v1', ball, enemy: o.enemy || 'fire', ally: o.ally, difficulty: 'normal', infinite: true, arena: o.arena, boss: o.boss }, { level: o.level || 30, evo: 3, up: {}, tree: full, wins: 999, gm29: o.gm29 }, () => 0.5);
  T.seed = o.seed || 7; if (o.form != null) T.teams[0][0].startForm = o.form;
  const B = new core.Battle(core.buildBattleConfig(T, { headless: true, replay: o.replay }));
  const me = B.player, foe = B.fighters.find(f => f.team !== me.team);
  if (!o.keepAi) { me.ai = null; if (foe) foe.ai = null; }
  me.st.invuln = 0; if (foe) foe.st.invuln = 0;
  return { B, T, me, foe };
}
const cast = (B, me, type) => { const sk = me.skills.find(s => s.type === type); sk.cdLeft = 0; sk.supp29 = 0; me.gcd = 0; me.casting = 0; return core.useSkill(me, sk); };
const hold = (f, x, y) => { f.x = x; f.y = y; f.vx = f.vy = 0; };

test('the three Reality Gods: 5 abilities with 3 form versions each, a passive, two ultimates, 3 forms — prices and rules', () => {
  const want = { voidbelow: ['VOID ENTITY', 'REALITY DEVOURER', 'THE END OF EVERYTHING'], absoluteabove: ['SUPREME GUARDIAN', 'REALITY ARCHITECT', 'THE ETERNAL ABSOLUTE'], fatenote: ['NOTE KEEPER', 'SHINIGAMI MASTER', 'GOD OF FATE AND DEATH'] };
  for (const [id, forms] of Object.entries(want)) {
    const b = core.getBall(id);
    assert.ok(b && b.realityGod && b.godBall && b.paid && !b.free && !b.premium && !b.edition && b.enabled, id);
    assert.equal(b.skills.length, 5); assert.equal(J(b.forms.map(f => f.name)), J(forms));
    for (const s of b.skills) assert.equal(core.SKILL_TYPES[s.type].forms.length, 3, s.name + ' has 3 form versions');
    assert.ok(b.passiveInfo && b.passiveInfo.name && b.ult && b.finalUlt && b.ult.type !== b.finalUlt.type);
  }
  assert.equal(core.getBall('voidbelow').coinPrice, 50000); assert.equal(core.getBall('absoluteabove').coinPrice, 50000);
  assert.equal(core.getBall('fatenote').pricePhp, 99); assert.ok(!core.getBall('fatenote').coinGod);
  assert.equal(J(core.getBall('voidbelow').skills.map(s => s.name)), J(['REALITY DELETION', 'VOID CONSUMPTION', 'REALITY FRACTURE', 'EXISTENCE SUPPRESSION', 'APOCALYPSE CORE']));
  assert.equal(J(core.getBall('absoluteabove').skills.map(s => s.name)), J(['REALITY RESTORATION', 'ABSOLUTE IMMUNITY', 'DIMENSIONAL AUTHORITY', 'EXISTENCE REWRITE', 'INFINITE AUTHORITY']));
  assert.equal(J(core.getBall('fatenote').skills.map(s => s.name)), J(['NAME OF DESTINY', 'SHINIGAMI VISION', 'FATE BINDING', 'DEATH SENTENCE', 'SHINIGAMI SUMMON']));
  assert.equal(core.getBall(core.ARCHON.id).summonOnly, true, 'the Archon is never a playable or summonable ball');
  assert.ok(!core.opponentPool(true).some(b => b.id === core.ARCHON.id), 'never an ordinary opponent');
});

test('every ability works in every form and keeps the battle healthy; the ultimate of each form is used (final-form ultimate in form 3)', () => {
  const failed = [];
  for (const id of ['voidbelow', 'absoluteabove', 'fatenote']) for (const form of [0, 1, 2]) {
    try {
      const { B, me, foe } = lab(id, { form, seed: 21 + form }); run(B, 0.3);
      assert.equal(me.form, form);
      for (const sk of me.skills) {
        hold(foe, me.x + 240, me.y); me.target = foe;
        if (sk.type === 'aa_restore') { me.hp = me.maxHp * 0.6; me.st.burn = 2; }
        const fp = () => J([Math.round(foe.hp), Math.round(me.hp), B.projs.length, B.zones.length, B.fighters.length, B.timers.length, Object.keys(me.sx).length, Object.keys(foe.sx || {}).length, Math.round(me.x), me.casting > 0]), before = fp();
        assert.notEqual(cast(B, me, sk.type), false, `${id} ${sk.name} (form ${form}) can be used`);
        const after = fp();
        assert.notEqual(before, after, `${id} ${sk.name} (form ${form}) does something`);
        run(B, 2.5);
        for (const f of B.fighters) assert.ok(Number.isFinite(f.hp) && Number.isFinite(f.x) && Number.isFinite(f.y), `${id} ${sk.name}: numbers stay valid`);
      }
      const ult = me.ult.type; me.ultMeter = 100; assert.ok(core.useUltimate(me)); run(B, 6);
      assert.equal(ult, form === 2 ? core.getBall(id).finalUlt.type : core.getBall(id).ult.type, 'the final-form ultimate belongs to form 3');
      for (const f of B.fighters) assert.ok(Number.isFinite(f.hp));
    } catch (e) { failed.push(`${id} form ${form}: ${e.message}`); }
  }
  assert.deepEqual(failed, []);
});

test('transformations: the 1st ultimate reaches form 2, the 2nd ultimate form 3 (bought God Balls have every form)', () => {
  for (const id of ['voidbelow', 'absoluteabove', 'fatenote']) {
    const { B, me } = lab(id); run(B, 0.2); assert.equal(me.formCap, 2);
    me.ultMeter = 100; core.useUltimate(me); run(B, 6); assert.equal(me.form, 1, id);
    me.ultMeter = 100; core.useUltimate(me); run(B, 6); assert.equal(me.form, 2, id);
    assert.equal(me.gm29s.forms, 2, 'forms reached are counted for God Mastery');
  }
});

test('passives: Destruction Energy → NEGATION; Authority Energy → one armed counter; Fate Energy → an ABSOLUTE SEAL', () => {
  { const { B, me, foe } = lab('voidbelow'); run(B, 0.1); me.sx.rgE = 99.5; hold(foe, me.x + 200, me.y); core.dealDamage(me, foe, 5, { kind: 'skill' }); run(B, 0.05);
    assert.ok(me.sx.negT > 0, 'negation starts at 100'); assert.equal(me.sx.rgE, 0);
    B.projs.push({ owner: foe, team: foe.team, x: me.x + 20, y: me.y, vx: -10, vy: 0, speed: 10, r: 8, dmg: 10, col: '#fff', life: 2 }); run(B, 0.02);
    assert.ok(!B.projs.some(q => q.owner === foe), 'enemy shots touching it are negated'); }
  { const { B, me, foe } = lab('absoluteabove'); run(B, 0.1); me.sx.rgE = 100; run(B, 0.05); assert.equal(me.sx.authReady, true);
    const h0 = me.hp; core.dealDamage(foe, me, 40, { kind: 'skill', noCrit: true, noDef: true }); const cut = h0 - me.hp;
    assert.equal(me.sx.authReady, false); assert.ok(B.projs.some(q => q.owner === me && q.target), 'golden counter-lance');
    const h1 = me.hp; core.dealDamage(foe, me, 40, { kind: 'skill', noCrit: true, noDef: true }); assert.ok(cut < (h1 - me.hp) * 0.7, 'the armed hit was cut'); }
  { const { B, me, foe } = lab('fatenote'); run(B, 0.1); me.sx.rgE = 100; run(B, 0.05); assert.equal(me.sx.fateReady, true);
    hold(foe, me.x + 200, me.y); cast(B, me, 'fn_name');
    assert.ok(foe.sx.seal && foe.sx.seal.enh, 'absolute seal'); assert.ok(foe.sx.fateCdT > 0); assert.equal(me.sx.rgE, 0); assert.equal(me.sx.fateReady, false); }
});

test('Reality Deletion: warned first, escapable, never on an immune ball, then a resistance window; the ball comes back to the same spot', () => {
  { const { B, me, foe } = lab('voidbelow'); run(B, 0.1); hold(foe, me.x + 260, me.y); cast(B, me, 'vb_delete');
    run(B, 0.4); hold(foe, foe.x + 400 > 1200 ? foe.x - 400 : foe.x + 400, foe.y); run(B, 0.5);
    assert.ok(!(foe.st.outside > 0), 'moving out of the warned rift escapes it'); }
  { const { B, me, foe } = lab('voidbelow'); run(B, 0.1); hold(foe, me.x + 260, me.y); const x0 = foe.x, y0 = foe.y; cast(B, me, 'vb_delete');
    for (let i = 0; i < 240 * 0.85; i++) { hold(foe, x0, y0); B.step(STEP); }
    assert.ok(foe.st.outside > 0, 'isolated in the rift'); assert.ok(foe.sx.delImmT > 7);
    for (let i = 0; i < 240 * 2 && foe.st.outside > 0; i++) B.step(STEP);
    assert.ok(!(foe.st.outside > 0)); assert.ok(Math.abs(foe.x - x0) < 30 && Math.abs(foe.y - y0) < 30, 'returned to where it was');
    me.skills.find(s => s.type === 'vb_delete').cdLeft = 0; me.gcd = 0; assert.equal(core.useSkill(me, me.skills.find(s => s.type === 'vb_delete')), false, 'resistance: no second deletion right away'); }
  { const { B, me, foe } = lab('voidbelow', { enemy: 'absoluteabove' }); run(B, 0.1); hold(foe, me.x + 260, me.y); foe.sx.immT = 5;
    assert.equal(cast(B, me, 'vb_delete'), false, 'Absolute Immunity: not even targeted'); }
});

test('Existence Suppression: one ability (never the ultimate) for a short time, resistance afterwards, blocked by Absolute Immunity', () => {
  const { B, me, foe } = lab('voidbelow', { enemy: 'thunder' }); run(B, 0.1); const mx = me.x, my = me.y; hold(foe, mx + 220, my);
  for (const s of foe.skills) s.cdLeft = 0;
  cast(B, me, 'vb_suppress'); for (let i = 0; i < 240 * 1.2; i++) { hold(me, mx, my); hold(foe, mx + 220, my); B.step(STEP); }
  const sealed = foe.skills.filter(s => s.supp29 > B.time); assert.equal(sealed.length, 1, 'exactly one ability');
  assert.equal(core.useSkill(foe, sealed[0]), false, 'it cannot be used'); assert.ok(foe.ult && !foe.ult.supp29, 'never the ultimate');
  assert.ok(foe.sx.suppImmT > 9); run(B, 3.6); assert.ok(!(sealed[0].supp29 > B.time), 'it comes back');
  const n0 = foe.skills.filter(s => s.supp29).length; hold(me, mx, my); hold(foe, mx + 220, my); cast(B, me, 'vb_suppress');
  for (let i = 0; i < 240 * 1.2; i++) { hold(me, mx, my); hold(foe, mx + 220, my); B.step(STEP); } assert.ok(!foe.skills.some(s => s.supp29 > B.time), 'resistance window');
  assert.ok(n0 >= 1);
});

test('Death Sentence: a visible countdown, capped at 30% max HP (15% for bosses), broken by 3 hits on Fate Note or a cleanse', () => {
  { const { B, me, foe } = lab('fatenote'); run(B, 0.1); hold(foe, me.x + 250, me.y); foe.st.invuln = 0; foe.skills = [];
    cast(B, me, 'fn_sentence'); assert.ok(foe.sx.sentence && foe.sx.sentence.t === core.RG.SENTENCE.t[0]);
    foe.maxHp = foe.hp = 20; const h0 = foe.hp;
    for (let i = 0; i < 240 * 5.2 && foe.sx.sentence; i++) { hold(foe, me.x + 250, me.y); foe.hp = Math.max(foe.hp, h0); B.step(STEP); }
    assert.ok(!foe.sx.sentence, 'carried out'); const lost = h0 - foe.hp;
    assert.ok(lost > 5.9 && lost <= 6.01, 'capped at exactly 30% of max HP: ' + lost.toFixed(2) + ' of ' + foe.maxHp); }
  { const { B, me, foe } = lab('fatenote'); run(B, 0.1); hold(foe, me.x + 250, me.y); cast(B, me, 'fn_sentence');
    for (let k = 0; k < 3; k++) { core.dealDamage(foe, me, 1, { kind: 'skill' }); run(B, 0.3); }
    run(B, 0.1); assert.ok(!foe.sx.sentence, 'broken by hitting Fate Note 3 times'); assert.ok(B.fateLog.some(x => x.kind === 'sentence broken')); }
  { const { B, me, foe } = lab('fatenote', { enemy: 'absoluteabove' }); run(B, 2); hold(foe, me.x + 250, me.y); cast(B, me, 'fn_sentence'); assert.ok(foe.sx.sentence);
    foe.hp = foe.maxHp * 0.7; const sk = foe.skills.find(s => s.type === 'aa_rewrite'); sk.cdLeft = 0; foe.gcd = 0; core.useSkill(foe, sk);
    assert.ok(!foe.sx.sentence, 'cleansed by Existence Rewrite'); }
});

test('Fate Binding holds a ball near the anchor (bosses wider and shorter), then resistance; Name of Destiny follows the notebook input', () => {
  const { B, me, foe } = lab('fatenote'); run(B, 0.1); const mx = me.x, my = me.y; hold(foe, mx + 200, my);
  cast(B, me, 'fn_bind'); for (let i = 0; i < 240 * 0.6 && !(foe.sx && foe.sx.bindT > 0); i++) { hold(me, mx, my); hold(foe, mx + 200, my); B.step(STEP); }
  assert.ok(foe.sx.bindT > 0); const ax = foe.sx.bindX, ay = foe.sx.bindY;
  for (let i = 0; i < 240; i++) { foe.vx = 900; B.step(STEP); } assert.ok(Math.hypot(foe.x - ax, foe.y - ay) <= foe.sx.bindR + 1, 'cannot leave the chain radius');
  run(B, 2); assert.ok(!(foe.sx.bindT > 0)); assert.ok(foe.sx.bindImmT > 0, 'then resistance');
  // the notebook target: an input picks which enemy gets the seal (ffa: several opponents)
  const L = lab('fatenote', { mode: 'ffa' }); run(L.B, 0.1); const foes = L.B.fighters.filter(f => f.team !== L.me.team);
  const pick = foes[foes.length - 1]; L.B.applyAction(['t', pick.sid], L.me); cast(L.B, L.me, 'fn_name');
  assert.ok(pick.sx.seal && pick.sx.seal.by === L.me, 'the chosen name is written'); assert.ok(L.B.fateLog.some(x => x.who === pick.sid && x.kind === 'seal'));
});

test('REALITY CLASH: the timing presses decide it (not the ball); presses are replayable inputs; the winner gets Reality Dominance', () => {
  function clash(pressA, pressB) {
    const { B, me, foe } = lab('voidbelow', { enemy: 'absoluteabove', seed: 3 }); run(B, 0.2);
    me.manual = true; foe.manual = true;      // both sides press by hand in this test
    me.ultMeter = 100; foe.ultMeter = 100; core.useUltimate(me); B.step(STEP); core.useUltimate(foe);
    assert.ok(B.clash && B.clash.rc, 'a REALITY CLASH started');
    const t0 = B.clash.t;
    for (let i = 0; i < 240 * 3 && B.clash; i++) {
      const c = B.clash, t = c.t;
      if (pressA != null && c.rc.a == null && t >= pressA) B.applyAction(['c', 0], c.a === me ? me : foe);
      if (pressB != null && c.rc.b == null && t >= pressB) B.applyAction(['c', 0], c.b === me ? me : foe);
      B.step(STEP);
    }
    return { me, foe, B, t0 };
  }
  const good = core.RC.PERIOD / 2, bad = core.RC.PERIOD / 4 + 0.02;
  const r1 = clash(good, bad), w1 = r1.me.sx.domin29T > 0 ? 'first' : r1.foe.sx.domin29T > 0 ? 'second' : 'none';
  const r2 = clash(bad, good), w2 = r2.me.sx.domin29T > 0 ? 'first' : r2.foe.sx.domin29T > 0 ? 'second' : 'none';
  assert.equal(w1, 'first'); assert.equal(w2, 'second', 'the same two balls: the better timing wins either way');
  assert.ok(r1.me.gm29s.clash === 1, 'a clash won counts for God Mastery');
  assert.ok(core.rcAcc(good) > 0.95 && core.rcAcc(bad) < 0.2);
});

test('rivalry: both on opposite sides → the REALITY COLLISION announcement once per battle (and only then)', () => {
  const a = lab('voidbelow', { enemy: 'absoluteabove' }); run(a.B, 1); assert.ok(a.B.rc29 && a.B.rc29.vb === a.me);
  const b = lab('voidbelow', { enemy: 'fire' }); run(b.B, 1); assert.ok(!b.B.rc29);
});

test('GOD SYNERGY: allies only, team cooldowns, a synergy hit never triggers another one', () => {
  const { B, me } = lab('fatenote', { mode: '2v2', ally: 'voidbelow', seed: 9, keepAi: true });
  const vb = B.fighters.find(f => f.team === me.team && f !== me); assert.ok(vb && vb.baseDef.id === 'voidbelow');
  const foe = B.fighters.find(f => f.team !== me.team);
  run(B, 0.2); foe.st.invuln = 0;
  core.useSkill(me, Object.assign(me.skills.find(s => s.type === 'fn_name'), { cdLeft: 0 })); me.gcd = 0;
  const target = B.fighters.find(f => f.sx && f.sx.seal && f.sx.seal.by === me); assert.ok(target);
  target.sx.sealT = 30; target.st.invuln = 0; target.st.outside = 0;
  const t0 = B.time; core.dealDamage(vb, target, 5, { kind: 'skill' }); core.dealDamage(vb, target, 5, { kind: 'skill' });
  assert.ok((B.syn29 || {})[vb.team + ':destiny'] > t0, 'DESTINY OF DESTRUCTION fired'); const until = B.syn29[vb.team + ':destiny'];
  run(B, 0.2); core.dealDamage(vb, target, 5, { kind: 'skill' }); assert.equal(B.syn29[vb.team + ':destiny'], until, 'cooldown: no second trigger, no loop');
  assert.ok(vb.gm29s.combos >= 1 && me.gm29s.combos >= 1);
  const { B: B2, me: e1 } = lab('voidbelow', { enemy: 'fatenote' }); const f2 = B2.fighters.find(f => f.team !== e1.team); run(B2, 0.2);
  f2.sx.seal = { by: f2, k: 0, bonus: 0.08 }; f2.sx.sealT = 5; f2.st.invuln = 0; core.dealDamage(e1, f2, 5, { kind: 'skill' });
  assert.ok(!B2.syn29, 'a seal from an enemy Fate Note never gives The Void Below a synergy');
});

test('REALITY COLLISION ZONE: solid pillars and core block balls and shots, spawns are free, hazards are marked and hit both sides; classic arena unchanged', () => {
  const { B, me, foe } = lab('fire', { enemy: 'ice', arena: 'collision' }); const Z = B.rz29; assert.ok(Z && Z.solids.length === 5 && Z.wells.length === 2 && Z.plats.length === 4);
  for (const f of B.fighters) assert.ok(core.rzFree(f.x, f.y, f.r), 'spawned on a free spot');
  const s = Z.solids[0]; me.x = s.x + 5; me.y = s.y; me.vx = -300; me.vy = 0; B.step(STEP);
  assert.ok(Math.hypot(me.x - s.x, me.y - s.y) >= s.r + me.r - 0.5, 'pushed out of the pillar');
  B.projs.push({ owner: foe, team: foe.team, x: s.x + s.r + 4, y: s.y, vx: -600, vy: 0, speed: 600, r: 8, dmg: 5, col: '#fff', life: 2 }); run(B, 0.1);
  assert.ok(!B.projs.some(p => p.owner === foe && p.dmg === 5), 'a non-ultimate shot is stopped');
  const L = lab('fire', { enemy: 'ice', arena: 'collision', keepAi: true, seed: 4 }); let marks = 0;
  for (let i = 0; i < 240 * 16; i++) { if (L.B.rz29.hazards.length) marks++; L.B.step(STEP); }
  assert.ok(marks > 0, 'hazards are marked before they fire');
  const r1 = core.simulateTicket(L.T, []), r2 = core.simulateTicket(L.T, []); assert.equal(J(r1), J(r2), 'deterministic');
  const c = lab('fire', { enemy: 'ice' }); assert.ok(!c.B.rz29, 'the classic arena has no 2.9.0 geometry');
  const T0 = core.createTicket({ mode: '1v1', ball: 'fire', enemy: 'ice', difficulty: 'normal' }, { level: 5, evo: 0, up: {}, tree: {} }, () => 0.5);
  assert.ok(!T0.opts.arena, 'the classic arena stays the default');
});

test('THE FRACTURED ARCHON: three phases with banners and fracture shards; marked attacks; co-op ticket with a boss seat runs the same everywhere', () => {
  const { B, me, foe } = lab('fire', { mode: 'boss', boss: core.ARCHON.id, keepAi: true }); assert.ok(foe.def.archon && foe.boss && B.rz29, 'the Archon fights in the Reality Collision Zone');
  run(B, 0.5); assert.equal(foe.sx.arPh, 0);
  foe.hp = foe.maxHp * 0.6; run(B, 0.1); assert.equal(foe.sx.arPh, 1); assert.ok(B.fighters.some(f => f.archonShard && f.alive), 'fracture shards');
  foe.hp = foe.maxHp * 0.3; run(B, 0.1); assert.equal(foe.sx.arPh, 2); assert.equal(foe.sx.arCdK, core.ARCHON.CD[2]);
  foe.st.invuln = 0; const sk = foe.skills.find(s => s.type === 'ar_shards'); sk.cdLeft = 0; foe.gcd = 0; core.useSkill(foe, sk); run(B, 0.8);
  assert.ok(B.strikes.length > 0 && B.strikes.every(s => s.max >= 0.9), 'every shard is marked ≥ 0.9 s before it lands');
  const seats = [{ ball: 'fire', level: 20, evo: 1, up: {}, tree: full, name: 'A', team: 0 }, { ball: 'ice', level: 20, evo: 1, up: {}, tree: full, name: 'B', team: 0 }, { ai: true, boss: true, ball: core.ARCHON.id, level: 23, evo: 1, up: {}, tree: full, name: 'THE FRACTURED ARCHON', team: 1 }];
  const T = core.createPvpTicket(seats, 1234, 'coop', { arena: 'collision', archon: true });
  assert.ok(T.opts.archon && T.opts.arena === 'collision' && T.teams[1][0].boss);
  const a = core.simulateTicket(T, [], 240 * 60 * 4), b = core.simulateTicket(T, [], 240 * 60 * 4); assert.equal(J(a), J(b));
});

test('God Mastery changes looks only: a level-10 Reality God fights exactly like a new one; counters come out of the simulation', () => {
  const go = lv => { const L = lab('fatenote', { gm29: lv, keepAi: true, seed: 5 }); assert.equal(L.me.gm29 | 0, lv); run(L.B, 20); return J(L.B.fighters.map(f => [Math.round(f.hp * 100), Math.round(f.x)])); };   // (one battle at a time: the engine has one current battle)
  assert.equal(go(10), go(0));
  const T = core.createTicket({ mode: '1v1', ball: 'absoluteabove', enemy: 'fire', difficulty: 'normal' }, { level: 30, evo: 3, up: {}, tree: full }, () => 0.5); T.seed = 77;
  const r = core.simulateTicket(T, []); assert.equal(r.gm[0].ball, 'absoluteabove'); assert.ok(r.gm[0].counts.skills > 0);
  assert.ok(core.gmXpFor(r.gm[0].counts, true, '1v1') > core.gmXpFor({}, false, '1v1'));
  assert.equal(core.gmXpFor({ skills: 100000, ults: 100000, forms: 100000, combos: 100000, seals: 100000, clash: 100000 }, true, 'boss'), 40 + 40 + 60 + 45 + 40 + 150 + 120 + 50 + 30, 'per-battle caps: no farming');
  assert.equal(core.gmLevelOf(0).lv, 1); assert.equal(core.gmLevelOf(28000).lv, 10);
});
