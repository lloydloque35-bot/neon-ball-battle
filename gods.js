/* =====================================================================
   NEON BALL BATTLE 2.2.0 — FOUR SUPREME GOD BALLS (FREE FOR EVERY PLAYER)
   God of Chaos • God of War • AI Tech • Solar Eclipse

   Built on the 2.1.0 Supreme framework (supreme.js) and loaded after it in the browser and on the game server,
   so every battle stays deterministic and verifiable. Battle logic only uses the seeded RNG / dcos / dsin.

   - 5 skills each; EVERY skill has three versions (Base / Awakened / Final God) with different patterns and behaviour
   - 3 forms; the Awakened form unlocks at ball Lv 10 and the Final God Form at Lv 20 (free progression)
   - a regular ultimate + an exclusive final-form ultimate, a passive that grows with the form
   - FREE: no payment, subscription, premium currency or admin rights needed
   ===================================================================== */
const GOD_BALLS = [];
/** registers a free God Ball (Supreme framework: forms, final ultimate, effects) */
function godBall(def, cfg) {
  Object.assign(def, { supreme: true, godBall: true, free: true, adminOnly: false, godMode: false, isNew: true, forms: cfg.forms, finalUlt: cfg.finalUlt, sound: cfg.sound,
    states: cfg.states || null, passiveInfo: cfg.passiveInfo, godClass: cfg.godClass, formPassive: cfg.formPassive, formMul: cfg.formMul || null, skillK: cfg.skillK || null, ultChargeMul: cfg.ultChargeMul || null });
  SUP.fx[def.id] = cfg.fx || {};
  if (cfg.passive) SUP.passives[def.id] = cfg.passive;
  const i = ALL_BUILTIN.findIndex(b => b.id === def.id); if (i >= 0) ALL_BUILTIN[i] = def; else ALL_BUILTIN.push(def);
  GOD_BALLS.push(def); SUP.godIds.push(def.id);
  return def;
}
/** a God skill: one type, three behaviours (descs[form]) */
function GSK(type, role, ico, label, descs, fn, self) { SK(type, role, ico, label, descs[0], fn, self); SKILL_TYPES[type].forms = descs; }
if (!CATEGORIES.includes('God')) CATEGORIES.splice(CATEGORIES.indexOf('Admin'), 0, 'God');
const lastLaser = () => BATTLE.lasers[BATTLE.lasers.length - 1];
const gk = f => (f.owner && f.minion ? f.owner.form : f.form) | 0;

/* =================== 1. GOD OF CHAOS =================== */
const CHAOS_MODES = ['SPIRAL', 'SCATTER', 'HOMING'];
const CHAOS_COL = ['#d500f9', '#ff1744', '#ff4081'];
function chaosSpiral(p, h) { const d = p.data; d.t += h; if (d.t < 0.55) { const c = d.s * h, ca = dcos(c), sa = dsin(c), vx = p.vx; p.vx = vx * ca - p.vy * sa; p.vy = vx * sa + p.vy * ca; } }
/** a chaos shot: its behaviour follows the current Unstable Reality pattern (spiral / scatter / homing) */
function chaosShot(f, x, y, ang, P, k, o = {}) {
  const lord = f.minion && f.owner ? f.owner : f, m = (lord.sx && lord.sx.chaosMode) | 0;
  const p = supShot(f, x, y, ang + (m === 1 ? rand(-0.22, 0.22) : 0), { speed: o.speed || 540, r: m === 1 ? 10 : 8, dmg: SD(lord, P) * k * (m === 1 ? 1.1 : 1), col: CHAOS_COL[m], style: 'chaos', power: P, life: o.life || 2.2, effect: o.effect });
  if (m === 2) { p.homing = 2.4; p.target = o.target || nearestEnemy(f); }
  else if (m === 0) { p.data = { t: 0, s: (RNG() < 0.5 ? -1 : 1) * 2.6 }; p.tick = chaosSpiral; }
  return p;
}
GSK('cr_rift', 'ranged', '⊛', 'Chaos Rift', [
  'Opens 2 unstable rifts around the target; each fires 3 chaos shots at it from a different side.',
  'Opens 3 rifts that CIRCLE the target and fire 4-shot bursts; the shots spiral, scatter or home with the Unstable Reality pattern.',
  'Opens 4 rifts around the target: crossfire beams link them, chaos shots pour out, then the rifts implode on the target.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), n = k + 2, a0 = rand(TAU), R = k === 2 ? 210 : 240, cx = t.x, cy = t.y, born = BATTLE.time, life = k === 2 ? 2.3 : 1.7;
  const rifts = []; for (let i = 0; i < n; i++) rifts.push(a0 + i / n * TAU);
  const at = (a, dt) => { const an = a + (k === 1 ? dt * 1.2 : 0); return { x: inArenaX(cx + dcos(an) * R, 40), y: inArenaY(cy + dsin(an) * R, 40) }; };
  if (!FX.off) vfx((ctx, q) => { for (const a of rifts) { const p = at(a, q * life); vRift(ctx, p.x, p.y, 30 + k * 7, k === 2 ? '#ff1744' : '#d500f9', Math.min(1, q * 6, (1 - q) * 5), q * life); } }, life);
  const shots = k === 0 ? 3 : 4;
  rifts.forEach((a, ri) => { for (let j = 0; j < shots; j++) after(0.25 + j * (k === 1 ? 0.1 : 0.28) + (k === 1 ? ri * 0.35 : 0), () => {
    const tt = supTarget(f, t); if (!f.alive || !tt) return; const p = at(a, BATTLE.time - born);
    chaosShot(f, p.x, p.y, datan2(tt.y - p.y, tt.x - p.x) + (k === 1 ? (j - 1.5) * 0.12 : 0), P, k === 0 ? 0.2 : 0.12);
  }); });
  if (k === 2) {
    after(0.5, () => { if (!f.alive) return; const pts = rifts.map(a => at(a, 0));
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]]) addLaser(f, [pts[i].x, pts[i].y, pts[j].x, pts[j].y], { charge: 0.3, dur: 0.6, w: 11, dmg: SD(f, P) * 0.1, col: (i + j) % 2 ? '#ff1744' : '#d500f9' }); });
    after(1.85, () => { if (!f.alive) return; supZone(f, { kind: 'gravity', x: cx, y: cy, r: 230, life: 0.4, col: '#d500f9', pull: 1700, dmg: 0, power: P });
      after(0.35, () => { if (!f.alive) return; supBlast(f, cx, cy, 170, SD(f, P) * 0.5, { effect: 'weaken', power: P }); if (!FX.off) { FX.ring(cx, cy, '#ff1744', 220, 0.4, 10, 10); FX.addShake(8); darkBurst(cx, cy, 160, 0.6); } }); });
  }
  if (!FX.off) supSound(f, 'skill', 0);
});
GSK('cr_orbs', 'aoe', '◉', 'Madness Orbs', [
  '3 explosive orbs circle the God of Chaos, then hunt the nearest enemies and explode.',
  '5 orbs circle, then hunt; every explosion splits into 2 smaller hunting orbs.',
  '6 orbs fly to the target and SPIRAL in around it, then all detonate at once in a huge chaos blast.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), n = [3, 5, 6][k];
  const boom = (x, y, r, mul, eff) => { supBlast(f, x, y, r, SD(f, P) * mul, { tag: 'explosion', power: P, effect: eff }); if (!FX.off) { FX.ring(x, y, '#ff1744', r, 0.3, 6, 8); FX.burst(x, y, '#d500f9', 14, 260, 5, 0.4); } };
  for (let i = 0; i < n; i++) {
    const p = supShot(f, f.x, f.y, 0, { speed: 0, r: 11, dmg: SD(f, P) * 0.1, col: i % 2 ? '#ff1744' : '#d500f9', style: 'madorb', life: k === 2 ? 2.4 : 3.4, power: P, data: { a: i / n * TAU, t: 0 } });
    if (k < 2) {
      p.tick = (p, h) => { const d = p.data; d.t += h;
        if (d.t < 1.1) { if (!f.alive) { p.life = 0; return; } d.a += 4 * h; p.x = inArenaX(f.x + dcos(d.a) * (f.r + 46), 12); p.y = inArenaY(f.y + dsin(d.a) * (f.r + 46), 12); p.vx = p.vy = 0; }
        else if (!d.go) { d.go = true; const es = supEnemies(f), e = es[i % Math.max(1, es.length)] || null; p.target = e; p.homing = 4.5; p.speed = 560; const a = e ? datan2(e.y - p.y, e.x - p.x) : d.a; p.vx = dcos(a) * 560; p.vy = dsin(a) * 560; } };
      p.onHit = p => { boom(p.x, p.y, 90, k ? 0.3 : 0.38); if (k === 1) for (let j = 0; j < 2; j++) supShot(f, p.x, p.y, rand(TAU), { speed: 420, r: 7, dmg: SD(f, P) * 0.08, col: '#ff4081', style: 'madorb', homing: 3, target: nearestEnemy(f), life: 1.5, power: P, onHit: q => boom(q.x, q.y, 60, 0.12) }); };
      p.onEnd = p.onHit;
    } else {
      p.pierce = 99;
      p.tick = (p, h) => { const d = p.data; d.t += h; const R = 150 * Math.max(0, 1 - d.t / 1.6) + 12; d.a += (3 + d.t * 3) * h;
        const cx = t.alive ? t.x : p.x, cy = t.alive ? t.y : p.y; p.x = inArenaX(cx + dcos(d.a) * R, 12); p.y = inArenaY(cy + dsin(d.a) * R, 12); p.vx = p.vy = 0; if (d.t >= 1.7) p.life = 0; };
      if (i === 0) p.onEnd = p => { if (!f.alive) return; const x = t.alive ? t.x : p.x, y = t.alive ? t.y : p.y; boom(x, y, 210, 0.7, 'weaken'); if (!FX.off) { FX.addShake(10); darkBurst(x, y, 200, 0.7); } };
    }
  }
  if (!FX.off) supSound(f, 'skill', 1);
});
GSK('cr_distort', 'control', '≈', 'Reality Distortion', [
  'Bends gravity sideways inside a field at the target: enemies are dragged in a slowly turning direction.',
  'Inverts gravity in a field that follows the target: enemies are flung outward and their momentum flips when they enter.',
  'Scrambles physics in a large field: enemy movement twists 90° every half second, their shots curve wildly and space itself explodes.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f);
  const z = supZone(f, { kind: 'custom', custom: true, x: inArenaX(t.x, 80), y: inArenaY(t.y, 80), r: [190, 220, 250][k], life: 3.5 + P / 80, col, dir: rand(TAU), k, flipped: new Set(), boomT: 0.7,
    onTick: (z, e, d, h) => {
      if (d > z.r + e.r * 0.5) return;
      const bk = e.boss ? 0.4 : 1;
      if (z.k === 0) { e.vx += dcos(z.dir) * 1500 * h * bk; e.vy += dsin(z.dir) * 1500 * h * bk; }
      else if (z.k === 1) { const dx = e.x - z.x, dy = e.y - z.y, dl = len(dx, dy) || 1; e.vx += dx / dl * 1700 * h * bk; e.vy += dy / dl * 1700 * h * bk; if (!z.flipped.has(e.sid)) { z.flipped.add(e.sid); e.vx = -e.vx; e.vy = -e.vy; } }
      else if ((z.ticks.get('r' + e.sid) || 0) <= BATTLE.time) { z.ticks.set('r' + e.sid, BATTLE.time + 0.5); const sg = RNG() < 0.5 ? 1 : -1, vx = e.vx; e.vx = -e.vy * sg; e.vy = vx * sg; }
      e.st.slow = Math.max(e.st.slow, 0.2);
      if ((z.ticks.get(e.sid) || 0) <= BATTLE.time) { z.ticks.set(e.sid, BATTLE.time + 0.5); dealDamage(f, e, SD(f, P) * (z.k ? 0.07 : 0.09), { kind: 'skill', tag: 'zone', noCrit: true, power: P }); }
    },
    stepFn: (z, h) => {
      z.dir += h * 1.4;
      if (z.k === 2) {
        for (const p of BATTLE.projs) if (p.team !== z.team && !p.warped && dist2(p.x, p.y, z.x, z.y) < z.r * z.r) { p.warped = true; const a = rand(-1.6, 1.6), ca = dcos(a), sa = dsin(a), vx = p.vx; p.vx = vx * ca - p.vy * sa; p.vy = vx * sa + p.vy * ca; p.homing = 0; }
        if ((z.boomT -= h) <= 0) { z.boomT = 0.7; const a = rand(TAU), r = rand(z.r * 0.8); supBlast(f, z.x + dcos(a) * r, z.y + dsin(a) * r, 70, SD(f, P) * 0.08, { tag: 'explosion' }); if (!FX.off) FX.burst(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, '#ff1744', 10, 220, 5, 0.35); }
      }
    },
    draw: (ctx, z, t2) => vDistortZone(ctx, z, t2) });
  if (k === 1) z.drift = { tgt: t, sp: 75 };
  if (!FX.off) supSound(f, 'skill', 2);
});
const chaosPatterns = {
  spread: (f, P) => ({ cd: 1.4, range: 520, fire: (m, t) => { const a = aimAngle(m, t, 520); for (let i = -1; i <= 1; i++) supShot(m, m.x, m.y, a + i * 0.22, { speed: 520, r: 7, dmg: SD(f, P) * 0.07, col: '#d500f9', style: 'chaos', power: P }); } }),
  orbs: (f, P) => ({ cd: 2.2, range: 560, fire: (m, t) => supShot(m, m.x, m.y, aimAngle(m, t, 300), { speed: 300, r: 11, dmg: SD(f, P) * 0.16, col: '#ff1744', style: 'madorb', homing: 2.5, target: t, power: P, life: 2.4, onHit: p => supBlast(f, p.x, p.y, 80, SD(f, P) * 0.12, { tag: 'explosion' }) }) }),
  ram: () => ({ cd: 1.8, range: 380, fire: (m, t) => { const a = angTo(m, t); m.vx = dcos(a) * m.baseSpeed * 2.6; m.vy = dsin(a) * m.baseSpeed * 2.6; m.st.dash = 0.45; } }),
  beam: (f, P) => ({ cd: 2.6, range: 620, fire: (m, t) => addLaser(m, [m.x, m.y, t.x, t.y], { charge: 0.35, dur: 0.35, w: 9, dmg: SD(f, P) * 0.14, col: '#ff4081' }) }),
};
GSK('cr_clone', 'summon', '⧉', 'Chaos Clone', [
  '2 holographic copies appear: one fires spreads of chaos shots, the other rams enemies.',
  '3 copies: a spread shooter, an orb thrower and a rammer that explodes when it is destroyed.',
  '4 copies surround the target (spread, orbs, rammer, beam) and the God of Chaos swaps places with one of them.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt), k = gk(f), free = SUP.MINION_MAX - supMinions(f); if (free <= 0) return false;
  const kinds = [['spread', 'ram'], ['spread', 'orbs', 'ram'], ['spread', 'orbs', 'ram', 'beam']][k], made = [];
  kinds.slice(0, free).forEach((kd, i) => {
    const a = i / kinds.length * TAU + rand(0.5), cx = k === 2 && t ? t.x : f.x, cy = k === 2 && t ? t.y : f.y, R = k === 2 ? 220 : f.r * 2.6;
    const m = supMinion(f, f.baseDef || f.def, cx + dcos(a) * R, cy + dsin(a) * R, { P, life: 5.5 + k, hp: 0.06, statMul: 0.45, rScale: 0.62, shot: chaosPatterns[kd](f, P),
      onDeath: kd === 'ram' && k >= 1 ? x => supBlast(f, x.x, x.y, 110, SD(f, P) * 0.3, { tag: 'explosion', effect: 'weaken' }) : null });
    if (m) { m.ghost = true; m.decoy = k === 2; made.push(m); }
  });
  if (k === 2 && made.length) after(1.5, () => { const m = made.find(x => x.alive); if (!f.alive || !m) return; const ox = f.x, oy = f.y; f.x = m.x; f.y = m.y; m.x = ox; m.y = oy; if (!FX.off) { FX.bolt(ox, oy, f.x, f.y, '#d500f9', 4, 0.3); FX.burst(f.x, f.y, '#ff1744', 20, 300); } });
  if (!FX.off) supSound(f, 'skill', 3);
}, true);
GSK('cr_entropy', 'aoe', '∿', 'Entropy Wave', [
  'A huge spreading wave: enemies hit lose control of their movement for 2 s and their abilities recharge 1.2 s later.',
  'The wave also erases enemy shots, then a second inward wave drags everyone back toward the God of Chaos.',
  'Three waves in a row: control loss, a random status effect and a 1 s silence; all enemy shots in range vanish.'],
(f, s, P) => {
  const k = gk(f);
  const scramble = (e, dur) => { const es = sx(e); es.entropyT = Math.max(es.entropyT || 0, dur); for (const q of e.allSkills()) q.cdLeft += 1.2; };
  const w1 = supWave(f, f.x, f.y, 360 + k * 40, SD(f, P) * 0.4, '#d500f9', { force: 500, speed: 700, onHit: e => scramble(e, 2.2) });
  if (k >= 1) { w1.clearProj = true; after(0.6, () => { if (f.alive) supWave(f, f.x, f.y, 380, SD(f, P) * 0.22, '#ff1744', { force: -650 }); }); }
  if (k === 2) after(0.3, () => { if (!f.alive) return; const w = supWave(f, f.x, f.y, 420, SD(f, P) * 0.22, '#ffffff', { force: 300, effect: 'random', power: P, onHit: e => silenceFoe(f, e, 1, 'ENTROPY') }); w.clearProj = true; });
  if (!FX.off) { FX.addShake(6); supSound(f, 'skill', 4); }
}, true);
SUP.steerHooks.push(f => {      // Entropy: lost control
  const s = f.sx; if (!s || !(s.entropyT > 0) || f.isClone) return;
  const a = BATTLE.time * 3.1 + f.sid * 2.3; f.steerX = -f.steerX * 0.4 + dcos(a) * 0.6; f.steerY = -f.steerY * 0.4 + dsin(a) * 0.6; f.steerPow = Math.max(f.steerPow, 600);
});
function chaosApocalypse(f, P, col, dmg, final) {
  const B = BATTLE, cx = ARENA.cx, cy = ARENA.cy, dur = final ? 3.6 : 3.0;
  camPunch(cx, cy, 0.12, dur); darkArena(dur + 0.4, '#0a0014', 0.5);
  B.cond = { kind: 'chaosgrav', team: f.team, by: f, t: dur, dir: rand(TAU) };
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.y + 70, final ? '✺ INFINITE ANARCHY ✺' : '✺ APOCALYPSE OF CHAOS ✺', final ? '#ffffff' : '#ff1744', 44, { life: 2.8, vy: 0, pop: 2, stroke: '#14001f' }); supSound(f, 'ult', final ? 2 : 0);
    vfx((ctx, q) => vDistortArena(ctx, Math.sin(Math.PI * q) * (final ? 1 : 0.7), q * dur), dur);
    vfx((ctx, q) => { for (let i = 0; i < 3; i++) vChaosSphere(ctx, ARENA.cx + (i - 1) * 260, ARENA.y + 120 + (i % 2) * 30, 40 + 70 * Math.min(1, q * 1.4), q * dur + i, Math.min(1, q * 4) * (q > 0.8 ? (1 - q) * 5 : 1)); }, 2.6);
    if (final) vfx((ctx, q) => vCracks(ctx, Math.min(1, q * 2.5) * (q > 0.85 ? (1 - q) * 6 : 1), 7), dur + 0.6);
  }
  // portals spit chaos at every enemy
  const portals = []; for (let i = 0; i < (final ? 7 : 5); i++) portals.push({ x: ARENA.x + ARENA.w * (0.1 + 0.8 * i / ((final ? 7 : 5) - 1)), y: i % 2 ? ARENA.b - 70 : ARENA.y + 70 });
  if (!FX.off) vfx((ctx, q) => { for (const p of portals) vRift(ctx, p.x, p.y, 38, '#d500f9', Math.min(1, q * 5, (1 - q) * 5), q * 3); }, 2.6);
  for (let j = 0; j < 4; j++) after(0.4 + j * 0.45, () => { if (!f.alive) return; const es = supEnemies(f); portals.forEach((p, i) => { const e = es[(i + j) % Math.max(1, es.length)]; if (e) supShot(f, p.x, p.y, datan2(e.y - p.y, e.x - p.x), { speed: 600, r: 10, dmg: dmg * 0.035, col: i % 2 ? '#ff1744' : '#d500f9', style: 'chaos', power: P, homing: 1.5, target: e }); }); });
  if (final) {
    after(0.5, () => { if (!f.alive) return; for (const e of supEnemies(f).slice(0, 3)) SKILL_FN.cr_distort(f, {}, P * 0.5, '#d500f9', e); });
    for (let i = 0; i < 6; i++) after(1.2 + i * 0.15, () => { const es = supEnemies(f), e = es[i % Math.max(1, es.length)]; if (!f.alive || !e) return; const a = rand(TAU); addLaser(f, [e.x - dcos(a) * 1400, e.y - dsin(a) * 1400, e.x + dcos(a) * 1400, e.y + dsin(a) * 1400], { charge: 0.25, dur: 0.3, w: 16, dmg: dmg * 0.06, col: i % 2 ? '#ff1744' : '#ffffff' }); });
  }
  after(2.5, () => { if (!f.alive) return; for (const e of supEnemies(f)) supStrike(f, e.x, e.y, 0.3, 110, dmg * 0.15, '#d500f9', { kind: 'meteor', power: P }); });
  after(final ? 3.1 : 2.8, () => {
    if (!f.alive) return;
    for (const e of supEnemies(f)) { dealDamage(f, e, dmg * (final ? 0.6 : 0.55), { kind: 'skill', tag: 'explosion', effect: final ? 'random' : 'weaken', power: P }); knock(e, cx, cy, 900); }
    if (!FX.off) { FX.addFlash(0.4, final ? '#ffffff' : '#d500f9'); FX.addShake(22); for (let i = 0; i < 5; i++) FX.ring(cx, cy, i % 2 ? '#ff1744' : '#d500f9', 340 + i * 150, 0.8, 16, 30); FX.burst(cx, cy, '#ff1744', 100, 1000, 9, 1.2); darkBurst(cx, cy, 400, 1.2); }
  });
}
UL('chaosapoc', 'Apocalypse of Chaos — the arena warps, rifts open everywhere, gravity turns, giant chaos spheres form overhead and explode; then reality returns to normal', (f, P, col, dmg) => chaosApocalypse(f, P, col, dmg, false));
UL('infiniteanarchy', 'Infinite Anarchy — overlapping reality distortions on every enemy, crossing rift beams, then a reality-shattering explosion', (f, P, col, dmg) => chaosApocalypse(f, P, col, dmg, true));
godBall(B('godofchaos', 'God of Chaos Ball', 'God', 'God Tier', [132, 84, 68, 80, 32], D('#14001f', '#d500f9', '#ff1744', 'chaosgod', [], '', { glow: 1.6, sdeco: ['chaosrings', 'chaoseyes'], rings: 2, sfx: { wave: 'sawtooth', pitch: 0.8 } }),
  [S('CHAOS RIFT', 'cr_rift', 6, 70, '#d500f9'), S('MADNESS ORBS', 'cr_orbs', 8, 70, '#ff1744'), S('REALITY DISTORTION', 'cr_distort', 11, 65, '#d500f9'), S('CHAOS CLONE', 'cr_clone', 13, 65, '#ff4081'), S('ENTROPY WAVE', 'cr_entropy', 10, 70, '#d500f9')],
  U('APOCALYPSE OF CHAOS', 'chaosapoc', 110, '#d500f9', 'weaken'), 'adaptive', { desc: 'SUPREME GOD • FREE. Reality manipulation and unpredictable combat: rifts, madness orbs, distorted gravity and copies of itself.' }), {
  godClass: 'SUPREME GOD', formMul: [1, 1.08, 1.06], skillK: [1.1, 0.88, 0.55], forms: [{ name: 'CHAOS CORE' }, { name: 'ABSOLUTE ANARCHY', design: { c2: '#e040fb', rings: 3, glow: 1.9, sdeco: ['chaosrings', 'chaoseyes', 'distortion'] } },
    { name: 'GOD OF PURE CHAOS', design: { c1: '#0a0010', c2: '#ea80fc', c3: '#ff1744', pat: 'chaosgod2', rings: 5, glow: 2.4, sdeco: ['chaosrings', 'chaoseyes', 'chaosflames', 'distortion'] } }],
  finalUlt: U('INFINITE ANARCHY', 'infiniteanarchy', 105, '#ffffff', 'random'), sound: { base: 116, wave: 'sawtooth', slide: 2.4, noise: 2800 },
  passiveInfo: { name: 'UNSTABLE REALITY', desc: 'Every few seconds its energy pattern changes (SPIRAL, SCATTER or HOMING shots) and a small rift opens near an enemy, firing at it.' },
  formPassive: ['Pattern changes every 6 s; the rift fires 2 shots.', 'Every 4.5 s; the rift fires 3 shots.', 'Every 3 s; the rift fires 4 shots that home.'],
  passive: {
    init(f) { f.sx.chaosMode = 0; f.sx.unstableT = 3; },
    tick(f, dt) {
      const s = f.sx; if (s.unstableT > 0) return;
      s.unstableT = [6, 4.5, 3][f.form];
      s.chaosMode = (s.chaosMode + 1 + (RNG() * 2 | 0)) % 3;
      const es = supEnemies(f), e = es.length ? es[RNG() * es.length | 0] : null;
      if (!FX.off) FX.text(f.x, f.y - f.r - 40, 'UNSTABLE: ' + CHAOS_MODES[s.chaosMode], CHAOS_COL[s.chaosMode], 14, { life: 0.9 });
      if (!e) return;
      const a = rand(TAU), x = inArenaX(e.x + dcos(a) * 200, 40), y = inArenaY(e.y + dsin(a) * 200, 40), n = f.form + 2;
      if (!FX.off) vfx((ctx, q) => vRift(ctx, x, y, 22, CHAOS_COL[s.chaosMode], Math.min(1, q * 6, (1 - q) * 4), q), 1);
      for (let i = 0; i < n; i++) after(0.25 + i * 0.12, () => { if (f.alive && e.alive) { const p = chaosShot(f, x, y, datan2(e.y - y, e.x - x), 60, 0.07); if (f.form === 2) { p.homing = 3; p.target = e; } } });
    },
  },
  fx: {
    idle: (f, d) => { const a = vr(TAU), r = f.r * vr(1.2, 2); FX.p(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, vr(-60, 60), vr(-60, 60), 0.35, vr(2, 4), Math.random() < 0.5 ? d.c2 : d.c3, Math.random() < 0.3 ? 'shard' : 'dot', 0); },
    bounce: (f, x, y, d) => { FX.burst(x, y, d.c3, 10, 260, 5, 0.35, 'shard'); FX.ring(x, y, d.c2, 60, 0.25, 4, 6); },
    victory: (f, d) => { vfx((ctx, q) => { vRift(ctx, f.x, f.y, f.r * (1.6 + q), d.c2, 1 - q * 0.6, q * 3); if (f.form === 2) vDistortArena(ctx, 0.4 * (1 - q), q * 3); }, 1.8); FX.text(f.x, f.y - f.r - 70, f.form === 2 ? 'ALL IS CHAOS' : 'CHAOS REIGNS', d.c3, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, d.c2, 60, 520, 6, 1.0, 'shard'); darkBurst(f.x, f.y, 160, 1); vfx((ctx, q) => vRift(ctx, f.x, f.y, f.r * (1 - q), d.c3, 1 - q, q * 4), 0.9); },
    entrance: () => vfx((ctx, q) => vDistortArena(ctx, Math.sin(Math.PI * q), q * 3), 1.4),
  },
});

/* =================== 2. GOD OF WAR =================== */
const SWORD = '#ffd54f';
GSK('wr_blades', 'melee', '⚔', 'Blade Orbit', [
  '3 spectral swords circle the God of War for 4 s, cutting every enemy close by.',
  '6 swords in two counter-rotating rings; when they fade they launch themselves at the nearest enemy.',
  '6 great swords orbit and LUNGE outward again and again to strike enemies far away, then fire in a fan at the target.'],
(f, s, P) => {
  const k = gk(f), n = k ? 6 : 3, life = 4 + k * 0.5;
  for (let i = 0; i < n; i++) {
    const ring = k === 1 ? i % 2 : 0;
    const p = supShot(f, f.x, f.y, 0, { speed: 0, r: 13, dmg: SD(f, P) * (k ? 0.12 : 0.16), col: ring ? '#ff1744' : SWORD, style: 'sword', life, pierce: 999, power: P, data: { a: i / n * TAU, t: 0, cd: 0, ring } });
    p.tick = (p, h) => { const d = p.data; d.t += h; d.cd -= h; if (d.cd <= 0) { d.cd = 0.4; if (p.hits) p.hits.clear(); }
      if (!f.alive) { p.life = 0; return; }
      const dir = d.ring ? -1 : 1; d.a += (k === 2 ? 2.6 : 3.4) * dir * h;
      const R = k === 2 ? f.r + 60 + 150 * Math.max(0, dsin(d.t * 3.5)) : f.r + (d.ring ? 95 : 50);
      p.x = inArenaX(f.x + dcos(d.a) * R, 12); p.y = inArenaY(f.y + dsin(d.a) * R, 12); p.vx = dcos(d.a + HPI * dir); p.vy = dsin(d.a + HPI * dir); };
    if (k >= 1) p.onEnd = p => { if (!f.alive) return; const t = nearestEnemy(f); if (!t) return;
      const a = k === 2 ? angTo(f, t) + (i - n / 2) * 0.12 : datan2(t.y - p.y, t.x - p.x);
      supShot(f, k === 2 ? f.x : p.x, k === 2 ? f.y : p.y, a, { speed: 760, r: 11, dmg: SD(f, P) * 0.17, col: SWORD, style: 'sword', homing: k === 1 ? 3 : 0, target: t, power: P, life: 1.4 }); };
  }
  if (!FX.off) supSound(f, 'skill', 0);
}, true);
GSK('wr_charge', 'melee', '➹', 'War Charge', [
  'A high-speed charge; the first impact releases a powerful shockwave.',
  'A burning charge that leaves a trail of fire; the impact stuns, then the God of War charges again for a second shockwave.',
  'WARPATH: three blink-slashes straight through the target from alternating sides, then a crimson shockwave.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), st = sx(f);
  if (k < 2) {
    const a = angTo(f, t); f.vx = dcos(a) * f.baseSpeed * 2.8; f.vy = dsin(a) * f.baseSpeed * 2.8; f.st.dash = 0.7; f.dashEffect = k ? 'burn' : null; f.dashPow = P;
    st.warCharge = { P, k, n: k ? 2 : 1 }; st.warChargeT = 1.4;
    if (k === 1) for (let i = 0; i < 8; i++) after(i * 0.07, () => { if (f.alive) supZone(f, { kind: 'trap', x: f.x, y: f.y, r: 40, life: 1.4, col: '#ff6d00', effect: 'burn', power: P, dmg: SD(f, P) * 0.04, style: 'burn' }); });
  } else {
    for (let j = 0; j < 3; j++) after(j * 0.2, () => {
      if (!f.alive || !t.alive) return; const a = angTo(t, f) + Math.PI * (j % 2) + (j - 1) * 0.7, ox = f.x, oy = f.y;
      const ax = inArenaX(t.x + dcos(a) * 150, f.r), ay = inArenaY(t.y + dsin(a) * 150, f.r), ex = inArenaX(t.x - dcos(a) * 150, f.r), ey = inArenaY(t.y - dsin(a) * 150, f.r);
      f.x = ex; f.y = ey; f.vx = -dcos(a) * 420; f.vy = -dsin(a) * 420;
      addLaser(f, [ax, ay, ex, ey], { charge: 0.02, dur: 0.12, w: 30, dmg: SD(f, P) * 0.24, col: SWORD });
      if (!FX.off) { portalGhost(f, ox, oy, ax, ay, 0.1, 'out'); FX.bolt(ax, ay, ex, ey, '#ffffff', 6, 0.25); FX.sparks(t.x, t.y, SWORD, 14, 500); vfx((ctx, q) => vSlash(ctx, ax, ay, ex, ey, SWORD, 1 - q), 0.35); }
    });
    after(0.65, () => { if (f.alive && t.alive) { supWave(f, t.x, t.y, 260, SD(f, P) * 0.4, '#ff1744', { force: 650 }); if (!FX.off) FX.addShake(10); } });
  }
  if (!FX.off) supSound(f, 'skill', 1);
});
SUP.collideHooks.push((a, b) => {
  const s = a.sx; if (!s || a.team === b.team) return;
  if (s.warCharge && s.warChargeT > 0 && a.st.dash > 0) {           // War Charge impact
    const wc = s.warCharge; wc.n--; if (wc.n <= 0) s.warCharge = null;
    supWave(a, b.x, b.y, 220 + wc.k * 40, SD(a, wc.P) * 0.45, SWORD, { force: 700 });
    if (wc.k >= 1) { if (!b.boss) b.st.stun = Math.max(b.st.stun, 0.6); if (wc.n > 0) after(0.45, () => { if (a.alive && b.alive) { const ang = angTo(a, b); a.vx = dcos(ang) * a.baseSpeed * 2.6; a.vy = dsin(ang) * a.baseSpeed * 2.6; a.st.dash = 0.6; s.warChargeT = 1; } }); }
    if (!FX.off) { FX.addShake(9); vfx((ctx, q) => vSlash(ctx, b.x - 70, b.y - 70, b.x + 70, b.y + 70, SWORD, 1 - q), 0.3); }
  }
  if (s.berserkT > 0 && s.berserkK >= 1) { applyEffect(a, b, 'burn', 60); if (s.berserkK === 2) supWave(a, (a.x + b.x) / 2, (a.y + b.y) / 2, 150, skillDmg(a, 60) * 0.2, '#ff1744', { force: 450 }); }
});
GSK('wr_berserk', 'buff', '☬', 'Berserker Mode', [
  'Rage takes over: +20% attack, +15% speed, abilities recharge 25% faster and it charges straight at enemies.',
  'Berserk also burns whatever it hits and heals it for 10% of its impact damage.',
  'Berserk also makes every impact explode in a shockwave and makes it immune to stun, slow and freeze.'],
(f, s, P) => {
  const st = sx(f); st.berserkT = 5 + P / 60 + gk(f); st.berserkK = gk(f);
  if (st.berserkK === 2) f.st.stun = f.st.slow = f.st.freeze = 0;
  if (!FX.off) { FX.text(f.x, f.y - f.r - 30, 'BERSERK!', '#ff1744', 22, { pop: 1.6 }); FX.ring(f.x, f.y, '#ff1744', f.r * 2.8, 0.5, 8, f.r); FX.burst(f.x, f.y, '#ff3d00', 30, 400, 6, 0.6); supSound(f, 'skill', 2); }
}, true);
SUP.steerHooks.push(f => {      // Berserk: always charges at the nearest enemy
  const s = f.sx; if (!s || !(s.berserkT > 0) || f.manual || f.isClone) return;
  const t = nearestEnemy(f); if (!t) return; const a = angTo(f, t); f.steerX = dcos(a); f.steerY = dsin(a); f.steerPow = Math.max(f.steerPow, 950);
});
GSK('wr_rain', 'aoe', '⇊', 'Sword Rain', [
  '12 spectral swords fall around the target.',
  '18 swords fall in a cross over the target and stay embedded as barriers that slow enemies.',
  'A ring of 16 swords cages the target (it cannot leave the ring), then a giant sword falls in the middle.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), cx = t.x, cy = t.y;
  const drop = (x, y, delay, r, mul, embed, big) => { x = inArenaX(x, 20); y = inArenaY(y, 20);
    supStrike(f, x, y, delay, r, SD(f, P) * mul, big ? '#ffffff' : SWORD, { kind: 'sword', power: P });
    if (!FX.off) vfx((ctx, q) => vFallingSword(ctx, x, y, big ? 3.2 : 1, Math.min(1, q * (delay + 0.25) / delay), big), delay + 0.25);
    if (embed) after(delay, () => { if (f.alive) supZone(f, { kind: 'trap', x, y, r: 34, life: 3, col: SWORD, power: P, dmg: SD(f, P) * 0.03 }); });
  };
  if (k === 0) for (let i = 0; i < 12; i++) drop(cx + rand(-170, 170), cy + rand(-170, 170), 0.3 + i * 0.08, 48, 0.2);
  else if (k === 1) for (let i = 0; i < 18; i++) { const a = (i % 4) * HPI, d = 40 + Math.floor(i / 4) * 48; drop(cx + dcos(a) * d, cy + dsin(a) * d, 0.3 + i * 0.05, 44, 0.16, true); }
  else {
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; drop(cx + dcos(a) * 160, cy + dsin(a) * 160, 0.25 + i * 0.04, 40, 0.1); }
    after(0.9, () => { if (!f.alive) return; for (const e of supEnemies(f)) if (len(e.x - cx, e.y - cy) < 175) { const es = sx(e); es.leash = { x: cx, y: cy, r: 150, by: f, dmg: SD(f, P) * 0.05, col: SWORD }; es.leashT = e.boss ? 1 : 2.2; } });
    drop(cx, cy, 1.4, 120, 0.85, false, true);
  }
  if (!FX.off) supSound(f, 'skill', 3);
});
GSK('wr_impact', 'aoe', '⊕', "Conqueror's Impact", [
  'Leaps up and slams down: a massive circular shockwave.',
  'Leaps toward the enemy and slams: three expanding shockwave rings crack the ground.',
  'Pulls enemies in, slams down and bursts out: shockwave plus 8 swords flying in every direction.'],
(f, s, P, col, tgt) => {
  const k = gk(f), t = supTarget(f, tgt), st = sx(f), leap = 0.45;
  st.liftT = leap; f.st.invuln = Math.max(f.st.invuln, leap);
  if (t && k >= 1) { const a = angTo(f, t); f.vx = dcos(a) * f.baseSpeed * 1.6; f.vy = dsin(a) * f.baseSpeed * 1.6; }
  if (k === 2) supZone(f, { kind: 'gravity', follow: f, x: f.x, y: f.y, r: 320, life: leap, col: '#ff1744', pull: 1700, dmg: 0, power: P });
  after(leap, () => {
    if (!f.alive) return; const x = f.x, y = f.y;
    supBlast(f, x, y, 200, SD(f, P) * 0.55, { force: 700, power: P, tag: 'explosion' });
    supWave(f, x, y, 320, SD(f, P) * 0.28, SWORD, { force: 500 });
    if (k >= 1) for (let i = 1; i <= 2; i++) after(i * 0.25, () => { if (f.alive) supWave(f, x, y, 320 + i * 60, SD(f, P) * 0.16, i % 2 ? '#ff1744' : SWORD, { force: 400 }); });
    if (k === 2) for (let i = 0; i < 8; i++) supShot(f, x, y, i / 8 * TAU, { speed: 640, r: 11, dmg: SD(f, P) * 0.14, col: SWORD, style: 'sword', life: 0.9, pierce: 2, power: P });
    if (!FX.off) { FX.addShake(12); FX.burst(x, y, SWORD, 40, 500, 6, 0.6, 'shard'); if (k >= 1) vfx((ctx, q) => vGroundCracks(ctx, x, y, 260, 1 - q), 1.4); Sound.play('boom'); }
  });
  if (!FX.off) supSound(f, 'skill', 4);
}, true);
function warUlt(f, P, col, dmg, final) {
  const t = nearestEnemy(f) || { x: ARENA.cx, y: ARENA.cy, alive: false };
  darkArena(3, '#2a0000', 0.55); camPunch(final ? ARENA.cx : f.x, final ? ARENA.cy : f.y, 0.14, 2.6);
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.y + 70, final ? '⚔ ARMAGEDDON STRIKE ⚔' : '⚔ THRONE OF DESTRUCTION ⚔', final ? '#ffffff' : SWORD, 44, { life: 2.6, vy: 0, pop: 2, stroke: '#3a0000' }); supSound(f, 'ult', final ? 2 : 0);
    vfx((ctx, q) => vWarrior(ctx, f.x, f.y - 30, final ? 230 : 190, Math.min(1, q * 3) * (q > 0.85 ? (1 - q) * 6 : 1), q), 2.6);
    if (!final) vfx((ctx, q) => vSixSwords(ctx, f.x, f.y - 160, q), 1.8);
    else vfx((ctx, q) => vGiantBlade(ctx, ARENA.cx, ARENA.y - 120 + Math.min(1, q * 1.5) * 300, 1.4, Math.min(1, q * 3) * (q > 0.9 ? (1 - q) * 10 : 1)), 1.9);
  }
  if (!final) {
    after(1.75, () => { if (!f.alive) return; const tx = t.alive ? t.x : t.x, ty = t.alive ? t.y : t.y, a = datan2(ty - f.y, tx - f.x) + HPI * 0.5;
      addLaser(f, [tx - dcos(a) * 1500, ty - dsin(a) * 1500, tx + dcos(a) * 1500, ty + dsin(a) * 1500], { charge: 0.15, dur: 0.35, w: 80, dmg: dmg * 0.7, col: SWORD });
      if (!FX.off) vfx((ctx, q) => vSlash(ctx, tx - Math.cos(a) * 1500, ty - Math.sin(a) * 1500, tx + Math.cos(a) * 1500, ty + Math.sin(a) * 1500, '#ffffff', 1 - q, 60), 0.6); });
    after(2.1, () => { if (!f.alive) return; const x = t.alive ? t.x : ARENA.cx, y = t.alive ? t.y : ARENA.cy; supWave(f, x, y, 380, dmg * 0.3, '#ff1744', { force: 900 }); if (!FX.off) { FX.addShake(20); FX.addFlash(0.3, '#ff1744'); } });
  } else {
    after(1.6, () => {
      if (!f.alive) return;
      for (const L of [[ARENA.x, ARENA.y, ARENA.r, ARENA.b], [ARENA.r, ARENA.y, ARENA.x, ARENA.b], [ARENA.x, ARENA.cy, ARENA.r, ARENA.cy]]) addLaser(f, L, { charge: 0.1, dur: 0.35, w: 70, dmg: dmg * 0.18, col: '#ffffff' });
      for (const e of supEnemies(f)) dealDamage(f, e, dmg * 0.6, { kind: 'skill', tag: 'strike', effect: 'burn', power: P });
      supWave(f, ARENA.cx, ARENA.cy, 900, dmg * 0.2, SWORD, { force: 900, speed: 1100 });
      if (!FX.off) { FX.addShake(22); FX.addFlash(0.45, '#ffffff'); vfx((ctx, q) => { vSlash(ctx, ARENA.x, ARENA.y, ARENA.r, ARENA.b, '#ffffff', 1 - q, 70); vSlash(ctx, ARENA.r, ARENA.y, ARENA.x, ARENA.b, SWORD, 1 - q, 70); }, 0.7); }
    });
  }
}
UL('thronedestruction', 'Throne of Destruction — the arena turns crimson, a spectral warrior rises, six swords merge into a celestial blade and one giant slash crosses the battlefield', (f, P, col, dmg) => warUlt(f, P, col, dmg, false));
UL('armageddon', 'Armageddon Strike — a gigantic celestial weapon descends and slashes the ENTIRE battlefield', (f, P, col, dmg) => warUlt(f, P, col, dmg, true));
godBall(B('godofwar', 'God of War Ball', 'God', 'God Tier', [132, 82, 70, 72, 34], D('#5a0a0a', '#ffd54f', '#ff1744', 'wargod', ['crown'], '', { glow: 1.5, sdeco: ['warswords', 'warflames'], swords: 2, sfx: { wave: 'square', pitch: 0.6 } }),
  [S('BLADE ORBIT', 'wr_blades', 8, 70, SWORD), S('WAR CHARGE', 'wr_charge', 6, 75, '#ff1744'), S('BERSERKER MODE', 'wr_berserk', 14, 60, '#ff3d00'), S('SWORD RAIN', 'wr_rain', 9, 70, SWORD), S("CONQUEROR'S IMPACT", 'wr_impact', 10, 75, '#ff1744')],
  U('THRONE OF DESTRUCTION', 'thronedestruction', 110, SWORD), 'aggressive', { desc: 'SUPREME GOD • FREE. Physical combat, weapon summoning and relentless aggression in red-and-gold armour.' }), {
  godClass: 'SUPREME GOD', forms: [{ name: 'BATTLE KNIGHT' }, { name: 'WAR OVERLORD', design: { swords: 6, glow: 1.9, sdeco: ['warswords', 'warflames', 'armorplates'] } },
    { name: 'GOD OF CONQUEST', design: { c1: '#7a5200', c2: '#fff59d', c3: '#ff3d00', pat: 'wargod2', swords: 8, glow: 2.4, sdeco: ['warswords', 'warflames', 'armorplates', 'wartrails'] } }],
  finalUlt: U('ARMAGEDDON STRIKE', 'armageddon', 120, '#ffffff', 'burn'), sound: { base: 92, wave: 'square', slide: 0.6, noise: 1400 },
  passiveInfo: { name: 'BATTLE INSTINCT', desc: 'Every successful hit in a row adds a stack (+3% attack, +1.5% speed). Stacks fade 2.5 s after the last hit.' },
  formPassive: ['Up to 5 stacks.', 'Up to 7 stacks.', 'Up to 10 stacks (+30% attack).'],
  passive: {
    init(f) { f.sx.inst = 0; },
    tick(f, dt) {
      const s = f.sx, max = [5, 7, 10][f.form];
      if (s.inst > 0 && !(s.instT > 0)) { s.instDecay = (s.instDecay || 0) + dt; if (s.instDecay >= 0.5) { s.instDecay = 0; s.inst--; } }
      if (s.inst > max) s.inst = max;
      f.pAtk *= 1 + 0.03 * s.inst; f.pSpd *= 1 + 0.015 * s.inst;
      if (s.berserkT > 0) { f.pAtk *= 1.2; f.pSpd *= 1.15; f.pCd *= 0.75; if (s.berserkK === 2) { f.st.stun = 0; f.st.slow = 0; f.st.freeze = 0; } }
    },
  },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.5) FX.p(f.x + vr(-f.r, f.r), f.y + f.r * vr(0.2, 0.9), vr(-20, 20), vr(-140, -70), 0.5, vr(3, 6), Math.random() < 0.5 ? d.c2 : d.c3); },
    bounce: (f, x, y, d) => { FX.sparks(x, y, d.c2, 10, 420); FX.ring(x, y, d.c3, 70, 0.3, 5, 6); },
    victory: (f, d) => { vfx((ctx, q) => { vWarrior(ctx, f.x, f.y - 20, f.form === 2 ? 170 : 120, 1 - q * 0.6, q); if (f.form === 2) vSixSwords(ctx, f.x, f.y - 130, Math.min(1, q * 2)); }, 1.8); FX.text(f.x, f.y - f.r - 80, f.form === 2 ? 'CONQUEST IS COMPLETE' : 'VICTORY BY THE SWORD', d.c2, 22, { life: 1.8 }); },
    defeat: (f, d) => { for (let i = 0; i < 6; i++) FX.p(f.x, f.y, vr(-300, 300), vr(-400, -100), 1.2, 10, d.c2, 'shard', 1, 600); FX.burst(f.x, f.y, d.c3, 50, 480, 6, 1.0); },
    entrance: f => vfx((ctx, q) => vSixSwords(ctx, f.x, f.y - 140, Math.min(1, q * 2)), 1.4),
  },
});
SUP.dmgHooks.push((src, tgt, amt, o) => {      // Battle Instinct: consecutive successful hits
  const ss = src && src.sx;
  if (ss && ss.inst != null && src.alive && o.kind !== 'dot' && src.team !== tgt.team && !(ss.instCdT > 0)) { ss.instCdT = 0.3; ss.inst = Math.min([5, 7, 10][src.form], ss.inst + 1); ss.instT = 2.5; }
  if (ss && ss.berserkT > 0 && ss.berserkK >= 1 && o.kind === 'collision' && src.alive) healFighter(src, amt * 0.1, true);
  return amt;
});

/* =================== 3. AI TECH =================== */
const AI_DRONE = UNITB('u_aidrone', 'Combat Drone', [40, 60, 40, 100, 10], D('#0a0f2a', '#2979ff', '#d500f9', 'aidrone', [], '', { glow: 1.3 }));
const LEARN_CAP = [0.2, 0.22, 0.25];
const kindKey = o => o.kind === 'collision' ? 'impact' : o.kind === 'dot' ? 'dot' : (o.tag || 'skill');
GSK('ai_scan', 'curse', '◎', 'Neural Scan', [
  'Scans the target for 5 s: its weak points are exposed (+15% damage from AI Tech) and it cannot stay phased.',
  'Scans every enemy in range (+18% damage) — AI Tech\'s shots home in on scanned enemies.',
  'Scans every enemy (+20% damage), strips their shields and buffs, and delays all their abilities by 2 s.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), list = k === 0 ? [t] : supEnemies(f).filter(e => len(e.x - f.x, e.y - f.y) < 650);
  for (const e of list) {
    const es = sx(e); es.scanT = 5 + P / 60; es.scanBy = f; es.scanPow = [1.15, 1.18, 1.2][k]; es.scanK = k; e.st.phase = 0;
    if (k === 2) { e.st.shield = e.st.buff = e.st.adapt = e.st.overclock = 0; for (const q of e.allSkills()) q.cdLeft += 2; }
    dealDamage(f, e, SD(f, P) * 0.15, { kind: 'skill', tag: 'beam', power: P });
    if (!FX.off) { vfx((ctx, q) => { if (e.alive && f.alive) vScanBeam(ctx, f.x, f.y, e.x, e.y, '#40c4ff', 1 - q, q); }, 0.6); vfx((ctx, q) => { if (e.alive) vReticle(ctx, e.x, e.y, e.r * 1.7, '#00e5ff', Math.min(1, (1 - q) * 4), q * 6, 'WEAK POINT'); }, es.scanT); }
  }
  if (!FX.off) supSound(f, 'skill', 0);
});
function aiDroneShot(f, P, k) {
  if (k === 0) return { cd: 1.2, range: 520, fire: (m, t) => supShot(m, m.x, m.y, aimAngle(m, t, 700), { speed: 700, r: 6, dmg: SD(f, P) * 0.085, col: '#40c4ff', style: 'dronebolt', power: P, life: 1.2 }) };
  if (k === 1) return { cd: 1.5, range: 600, fire: (m, t) => { for (const j of [-1, 1]) supShot(m, m.x, m.y, aimAngle(m, t, 700) + j * 0.06, { speed: 700, r: 6, dmg: SD(f, P) * 0.055, col: '#00e5ff', style: 'dronebolt', power: P, life: 1.2, homing: t.sx && t.sx.scanT > 0 ? 3 : 0, target: t }); } };
  return { cd: 1.8, range: 680, fire: (m, t) => supShot(m, m.x, m.y, angTo(m, t) + rand(-0.6, 0.6), { speed: 420, r: 7, dmg: SD(f, P) * 0.1, col: '#d500f9', style: 'missile', homing: 4, target: t, power: P, life: 2.2, boom: 50 }) };
}
GSK('ai_drones', 'summon', '⋄', 'Drone Swarm', [
  '3 autonomous combat drones hunt enemies and fire laser bolts.',
  '4 drones fly in formation and fire synchronised twin volleys (homing at scanned enemies).',
  '4 drones fire homing micro-missiles; a destroyed drone releases an EMP that slows enemies nearby.'],
(f, s, P) => {
  const k = gk(f), n = [3, 4, 4][k], cap = Math.max(SUP.MINION_MAX, n), have = supMinions(f); if (have >= cap) return false;
  for (let i = 0; i < Math.min(n, cap - have); i++) {
    const a = i / n * TAU;
    const m = supMinion(f, AI_DRONE, f.x + dcos(a) * f.r * 2.2, f.y + dsin(a) * f.r * 2.2, { P, life: 7 + k, hp: 0.045, statMul: 0.5, rScale: 0.38, shot: aiDroneShot(f, P, k), cap,
      onDeath: k === 2 ? x => { for (const e of supEnemies(f)) if (len(e.x - x.x, e.y - x.y) < 130) e.st.slow = Math.max(e.st.slow, 1.5); if (!FX.off) FX.ring(x.x, x.y, '#40c4ff', 130, 0.3, 4, 6); } : null });
    if (m && k === 1 && m.ai) m.ai.fireT = 0.8;          // formation: all drones fire together
  }
  if (!FX.off) supSound(f, 'skill', 1);
}, true);
GSK('ai_clone', 'summon', '⧉', 'Cyber Clone', [
  'A hologram copies AI Tech\'s movement beside it and fires a laser every time AI Tech uses an ability.',
  '2 holograms that also copy its charges and collide with enemies.',
  '3 holograms that enemies mistake for the real AI Tech; destroyed holograms glitch-explode.'],
(f, s, P) => {
  const k = gk(f), n = k + 1, cap = SUP.MINION_MAX; if (supMinions(f) >= cap) return false;
  for (let i = 0; i < n; i++) {
    const m = supMinion(f, f.baseDef || f.def, f.x, f.y, { P, life: 6 + k, hp: 0.07, statMul: 0.4, rScale: 0.7, cap,
      onDeath: k === 2 ? x => { supBlast(f, x.x, x.y, 110, SD(f, P) * 0.3, { tag: 'explosion' }); if (!FX.off) FX.burst(x.x, x.y, '#00e5ff', 24, 320, 5, 0.5, 'shard'); } : null });
    if (m) { m.ghost = true; m.echoOf = f; m.echoA = (i + 1) / (n + 1) * TAU; m.echoK = k; m.echoSk = f.stats.skills; m.echoP = P; m.decoy = k === 2; m.noCollide = k === 0; }
  }
  if (!FX.off) supSound(f, 'skill', 2);
}, true);
GSK('ai_shield', 'defense', '⬡', 'Adaptive Shield', [
  'For 5 s it analyses incoming attacks: each repeat of the same kind of attack is resisted 10% more (up to 30%).',
  'Starts with 10% resistance and reflects 20% of every resisted hit back at the attacker.',
  'Also absorbs the first 3 projectiles completely and releases their energy as a pulse when the shield ends.'],
(f, s, P) => {
  const st = sx(f); if (st.adaptT > 0) return false;
  const k = gk(f); st.adaptT = 5 + P / 60; st.adaptK = k; st.adaptHits = {}; st.absorbN = k === 2 ? 3 : 0; st.absorbE = 0;
  if (k === 2) after(st.adaptT, () => { if (f.alive && st.absorbE > 0) { supWave(f, f.x, f.y, 300, st.absorbE * 0.8 + SD(f, P) * 0.2, '#40c4ff', { force: 600 }); st.absorbE = 0; } });
  if (!FX.off) { FX.ring(f.x, f.y, '#40c4ff', f.r * 2.2, 0.4, 6, f.r); supSound(f, 'skill', 3); }
}, true);
GSK('ai_laser', 'ranged', '⌁', 'Quantum Laser', [
  'Locks on, then fires a precision laser that keeps tracking the target.',
  'The laser ricochets from the target into the 2 nearest other enemies (or off the walls).',
  'Three lasers from AI Tech and two orbital points converge on the target and leave a quantum mark that explodes.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f);
  if (!FX.off) vfx((ctx, q) => { if (t.alive) vReticle(ctx, t.x, t.y, t.r * (2.4 - q), '#ff00e6', 1 - q * 0.3, q * 8, 'LOCK'); }, 0.6);
  if (k < 2) {
    addLaser(f, [f.x, f.y, t.x, t.y], { charge: 0.55, dur: 0.4, w: 12, dmg: SD(f, P) * (k ? 0.5 : 0.6), col: '#40c4ff' }); lastLaser().aim = { f, tgt: t, turn: 5, w0: 12, w1: 18 };
    if (k === 1) after(0.75, () => { if (!f.alive) return; const px = t.alive ? t.x : f.x, py = t.alive ? t.y : f.y, others = supEnemies(f).filter(e => e !== t).slice(0, 2);
      const dirs = others.length ? others.map(e => datan2(e.y - py, e.x - px)) : [angTo(f, t) + 1.0, angTo(f, t) - 1.0];
      for (const a of dirs) { const end = rayToWall(px, py, a); addLaser(f, [px, py, end.x, end.y], { charge: 0.1, dur: 0.3, w: 9, dmg: SD(f, P) * 0.22, col: '#d500f9' }); } });
  } else {
    for (const [x, y] of [[f.x, f.y], [ARENA.x + 40, ARENA.y + 40], [ARENA.r - 40, ARENA.y + 40]]) { addLaser(f, [x, y, t.x, t.y], { charge: 0.5, dur: 0.45, w: 12, dmg: SD(f, P) * 0.22, col: '#40c4ff' }); lastLaser().conv = { tgt: t, from: x === f.x && y === f.y ? f : null }; }
    after(1.0, () => { if (!f.alive || !t.alive) return; supBlast(f, t.x, t.y, 130, SD(f, P) * 0.35, { tag: 'explosion', power: P }); if (!FX.off) { FX.burst(t.x, t.y, '#00e5ff', 30, 360, 5, 0.5, 'shard'); FX.ring(t.x, t.y, '#ff00e6', 150, 0.35, 6, 10); } });
  }
  if (!FX.off) supSound(f, 'skill', 4);
});
function singularity(f, P, col, dmg, omega) {
  const t = nearestEnemy(f); if (!t) return;
  camPunch(t.x, t.y, 0.12, 2.6); darkArena(3, '#000818', 0.5);
  const satX = ARENA.cx, satY = ARENA.y + 60;
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.y + 70, omega ? '◈ OMEGA SINGULARITY ◈' : '◈ SINGULARITY PROTOCOL ◈', omega ? '#ff00e6' : '#00e5ff', 44, { life: 2.6, vy: 0, pop: 2, stroke: '#000818' }); supSound(f, 'ult', omega ? 2 : 0);
    vfx((ctx, q) => vDigitalGrid(ctx, Math.min(1, q * 3) * (q > 0.85 ? (1 - q) * 6 : 1), q), 3.2);
    vfx((ctx, q) => vSatellite(ctx, satX, satY, omega ? 1.4 : 1, Math.min(1, q * 2.5) * (q > 0.9 ? (1 - q) * 10 : 1), q), 3);
    vfx((ctx, q) => { for (const e of supEnemies(f)) vReticle(ctx, e.x, e.y, e.r * 1.9, '#ff00e6', Math.min(1, q * 4), q * 9, 'TARGET'); if (omega) { ctx.save(); ctx.strokeStyle = 'rgba(0,229,255,.5)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); const es = supEnemies(f); for (const e of es) { ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(e.x, e.y); ctx.stroke(); } ctx.restore(); } }, 2.4);
  }
  const n = omega ? 5 : 4;
  for (let i = 0; i < n; i++) { const a = i / n * TAU; supMinion(f, AI_DRONE, t.x + dcos(a) * 190, t.y + dsin(a) * 190, { P, life: omega ? 4 : 3, hp: 0.04, statMul: 0.5, rScale: 0.38, cap: 12,
    shot: omega ? { cd: 0.9, range: 700, fire: (m, tt) => supShot(m, m.x, m.y, angTo(m, tt) + rand(-0.5, 0.5), { speed: 460, r: 7, dmg: dmg * 0.025, col: '#ff00e6', style: 'missile', homing: 4, target: tt, power: P, life: 2 }) }
      : { cd: 0.5, range: 600, fire: (m, tt) => supShot(m, m.x, m.y, angTo(m, tt), { speed: 760, r: 6, dmg: dmg * 0.018, col: '#40c4ff', style: 'dronebolt', power: P, life: 1 }) } }); }
  addLaser(f, [satX, satY, t.x, t.y], { charge: 1.5, dur: omega ? 1.0 : 0.7, w: omega ? 120 : 80, dmg: dmg * (omega ? 0.2 : 0.28), col: omega ? '#ff00e6' : '#40c4ff' }); lastLaser().conv = { tgt: t };
  after(2.3, () => { if (!f.alive) return; const x = t.alive ? t.x : ARENA.cx, y = t.alive ? t.y : ARENA.cy;
    supBlast(f, x, y, 230, dmg * 0.5, { tag: 'explosion', power: P, force: 800 });
    if (omega) for (const e of supEnemies(f)) { dealDamage(f, e, dmg * 0.2, { kind: 'skill', tag: 'wave', power: P }); e.ultMeter = Math.max(0, e.ultMeter - 25); }
    if (!FX.off) { FX.addFlash(0.35, omega ? '#ff00e6' : '#00e5ff'); FX.addShake(18); for (let i = 0; i < 4; i++) FX.ring(x, y, i % 2 ? '#ffffff' : '#00e5ff', 200 + i * 120, 0.6, 10, 20); FX.burst(x, y, '#00e5ff', 80, 800, 7, 1, 'shard'); } });
}
UL('singularity', 'Singularity Protocol — the arena turns digital, drones surround the target, an orbital station charges and fires a giant laser', (f, P, col, dmg) => singularity(f, P, col, dmg, false));
UL('omegasingularity', 'Omega Singularity — the AI combat network links every enemy, a drone fleet fires missiles and a concentrated orbital beam detonates across the arena', (f, P, col, dmg) => singularity(f, P, col, dmg, true));
godBall(B('aitech', 'AI Tech Ball', 'God', 'God Tier', [134, 82, 76, 76, 30], D('#060a1f', '#2979ff', '#d500f9', 'aicore', [], '', { glow: 1.5, sdeco: ['mechrings', 'holocircuits', 'minidrones'], mrings: 1, drones: 2, sfx: { wave: 'square', pitch: 1.3 } }),
  [S('NEURAL SCAN', 'ai_scan', 9, 60, '#40c4ff'), S('DRONE SWARM', 'ai_drones', 13, 65, '#2979ff'), S('CYBER CLONE', 'ai_clone', 13, 60, '#00e5ff'), S('ADAPTIVE SHIELD', 'ai_shield', 12, 65, '#40c4ff'), S('QUANTUM LASER', 'ai_laser', 7, 80, '#ff00e6')],
  U('SINGULARITY PROTOCOL', 'singularity', 110, '#00e5ff'), 'tactical', { desc: 'SUPREME TECHNOLOGY GOD • FREE. Adaptation, drones, holograms and precision lasers — it learns how you fight.' }), {
  godClass: 'SUPREME TECHNOLOGY GOD', formMul: [1, 1.08, 1.06], skillK: [1.1, 0.88, 0.55], forms: [{ name: 'PROTOTYPE AI' }, { name: 'QUANTUM INTELLIGENCE', design: { c2: '#00e5ff', mrings: 2, drones: 3, glow: 1.9 } },
    { name: 'AI OVERLORD X', design: { c1: '#0d0221', c2: '#00e5ff', c3: '#ff00e6', pat: 'aicore2', mrings: 3, drones: 4, glow: 2.4, sdeco: ['mechrings', 'holocircuits', 'minidrones', 'mechwings', 'floatweapons'] } }],
  finalUlt: U('OMEGA SINGULARITY', 'omegasingularity', 105, '#ff00e6'), sound: { base: 523, wave: 'square', slide: 1.8, noise: 5200 },
  passiveInfo: { name: 'COMBAT LEARNING', desc: 'Studies the attacks that hit it: every repeat of the same kind is resisted a little more (4% each), with a hard cap. It forgets slowly and can never become invincible.' },
  formPassive: ['Up to 20% resistance per attack type.', 'Up to 22%.', 'Up to 25%.'],
  passive: {
    init(f) { f.sx.learn = {}; f.sx.forgetT = 3; },
    tick(f) { const s = f.sx; if (!(s.forgetT > 0)) { s.forgetT = 3; for (const k in s.learn) s.learn[k] = Math.max(0, s.learn[k] - 1); } },
  },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.5) FX.p(f.x + vr(-f.r, f.r) * 1.4, f.y + vr(-f.r, f.r) * 1.4, 0, -30, 0.5, vr(2, 4), Math.random() < 0.5 ? d.c2 : d.c3, 'shard', 1); },
    bounce: (f, x, y, d) => { FX.ring(x, y, d.c2, 60, 0.25, 3, 6); FX.sparks(x, y, d.c2, 6, 300); },
    victory: (f, d) => { vfx((ctx, q) => { vDigitalGrid(ctx, 0.5 * (1 - q), q); vReticle(ctx, f.x, f.y, f.r * (2 + q), d.c2, 1 - q * 0.5, q * 6, f.form === 2 ? 'OVERLORD ONLINE' : 'MISSION COMPLETE'); }, 1.8); },
    defeat: (f, d) => { FX.burst(f.x, f.y, d.c2, 50, 480, 5, 1.0, 'shard'); FX.sparks(f.x, f.y, '#ffffff', 30, 600); FX.text(f.x, f.y - f.r - 30, 'SYSTEM FAILURE', '#ff8a80', 20, { life: 1.4 }); },
    entrance: () => vfx((ctx, q) => vDigitalGrid(ctx, Math.sin(Math.PI * q), q), 1.4),
  },
});
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const s = tgt.sx; if (!s) return amt;
  if (s.scanT > 0 && src && (src.credit || src) === s.scanBy) amt *= s.scanPow || 1.15;          // Neural Scan
  let res = 0;
  if (s.learn) { const key = kindKey(o); res += Math.min(LEARN_CAP[tgt.form] || 0.2, (s.learn[key] || 0) * 0.04); s.learn[key] = (s.learn[key] || 0) + 1; }   // Combat Learning
  if (s.adaptT > 0 && o.kind !== 'dot') {                                                       // Adaptive Shield
    if (s.absorbN > 0 && o.tag === 'projectile') { s.absorbN--; s.absorbE += amt; if (!FX.off) FX.text(tgt.x, tgt.y - tgt.r - 20, 'ABSORBED', '#40c4ff', 13, { life: 0.6 }); return 0; }
    const key = kindKey(o), H = s.adaptHits; H[key] = (H[key] || 0) + 1;
    res += Math.min(0.3, (H[key] - 1) * 0.1) + (s.adaptK >= 1 ? 0.1 : 0);
  }
  if (s.variant === 'eclipse') res += 0.1;                                                     // Solar Eclipse: eclipse state
  res = Math.min(0.45, res);                                                                    // never invincible: at most 45% less damage
  if (res > 0) { const cut = amt * res; amt -= cut;
    if (s.adaptT > 0 && s.adaptK >= 1 && src && src.alive && src.team !== tgt.team && o.tag !== 'mirror' && o.kind !== 'dot') dealDamage(tgt, src, cut * 0.2, { kind: 'skill', tag: 'mirror', noCrit: true, noDef: true }); }
  return amt;
});

/* =================== 4. SOLAR ECLIPSE =================== */
const seMul = (f, kind) => { const ecl = !!(f.sx && f.sx.variant); return kind === 'solar' ? (ecl ? 1 : 1.25) : (ecl ? 1.25 : 1); };
GSK('se_flare', 'ranged', '☀', 'Solar Flare', [
  'A concentrated solar beam at the target, ending in a big golden-orange explosion. (+25% in SOLAR state)',
  'The beam SWEEPS across the target, leaving three explosions along its path.',
  'Three beams converge on the target; a miniature sun forms there and detonates.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f); P *= seMul(f, 'solar');
  const boom = (x, y, r, m) => { supBlast(f, x, y, r, SD(f, P) * m, { tag: 'explosion', effect: 'burn', power: P, force: 400 }); if (!FX.off) { FX.burst(x, y, '#ffb300', 30, 420, 7, 0.6); FX.ring(x, y, '#ff6d00', r * 1.2, 0.35, 8, 10); } };
  if (k === 0) { addLaser(f, [f.x, f.y, t.x, t.y], { charge: 0.35, dur: 0.6, w: 20, dmg: SD(f, P) * 0.28, col: '#ffb300' }); lastLaser().aim = { f, tgt: t, turn: 1.6, w0: 18, w1: 28 };
    after(0.95, () => { if (f.alive && t.alive) boom(t.x, t.y, 150, 0.55); }); }
  else if (k === 1) { addLaser(f, [f.x, f.y, t.x, t.y], { charge: 0.3, dur: 1.0, w: 22, dmg: SD(f, P) * 0.22, col: '#ffb300' }); lastLaser().aim = { f, tgt: t, turn: 9, w0: 20, w1: 30, off: -0.4, sweep: 0.8 };
    for (let j = 0; j < 3; j++) after(0.5 + j * 0.3, () => { if (!f.alive || !t.alive) return; const a = angTo(f, t) - 0.4 + (0.2 + j * 0.3) * 0.8 * 1.25, d = Math.min(len(t.x - f.x, t.y - f.y), 420); boom(inArenaX(f.x + dcos(a) * d, 20), inArenaY(f.y + dsin(a) * d, 20), 110, 0.22); }); }
  else {
    const a = angTo(f, t);
    for (const sd of [-1, 0, 1]) { const x = f.x + dcos(a + HPI) * 110 * sd, y = f.y + dsin(a + HPI) * 110 * sd; addLaser(f, [x, y, t.x, t.y], { charge: 0.35, dur: 0.7, w: 14, dmg: SD(f, P) * 0.15, col: sd ? '#ff6d00' : '#ffd54f' }); lastLaser().conv = { tgt: t, from: sd ? null : f }; }
    if (!FX.off) vfx((ctx, q) => { if (t.alive) vSun(ctx, t.x, t.y, 10 + 50 * q, '#ffb300', Math.min(1, q * 3), q, false); }, 1.2);
    after(1.2, () => { if (f.alive && t.alive) { boom(t.x, t.y, 230, 0.6); if (!FX.off) { FX.addShake(12); FX.addFlash(0.2, '#ffb300'); } } });
  }
  if (!FX.off) supSound(f, 'skill', 0);
});
GSK('se_shadow', 'control', '☾', 'Lunar Shadow', [
  'A dark lunar field at the target slows every enemy inside. (+25% in ECLIPSE state)',
  'A crescent field that FOLLOWS the target, slowing it and draining its ultimate charge.',
  'A lunar field grows around Solar Eclipse: enemy shots inside stall and fade, and enemies still inside at the end freeze.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), mul = seMul(f, 'lunar'); P *= mul;
  const z = supZone(f, { kind: 'custom', custom: true, x: k === 2 ? f.x : inArenaX(t.x, 80), y: k === 2 ? f.y : inArenaY(t.y, 80), r: (k === 2 ? 120 : 180) * (mul > 1 ? 1.15 : 1), life: 4 + P / 80, col: '#7c4dff', k, follow: k === 2 ? f : null,
    onTick: (z, e, d, h) => { if (d > z.r + e.r * 0.5) return; e.st.slow = Math.max(e.st.slow, 0.3); if (z.k === 1) e.ultMeter = Math.max(0, e.ultMeter - 4 * h);
      if ((z.ticks.get(e.sid) || 0) <= BATTLE.time) { z.ticks.set(e.sid, BATTLE.time + 0.5); dealDamage(f, e, SD(f, P) * 0.06, { kind: 'skill', tag: 'zone', noCrit: true, power: P }); } },
    stepFn: (z, h) => { if (z.k !== 2) return; z.r = Math.min(300, z.r + 45 * h);
      for (const p of BATTLE.projs) if (p.team !== z.team && !p.lunar && dist2(p.x, p.y, z.x, z.y) < z.r * z.r) { p.lunar = true; p.vx *= 0.15; p.vy *= 0.15; p.speed *= 0.15; p.homing = 0; p.life = Math.min(p.life, 0.6); } },
    draw: (ctx, z, t2) => vLunarField(ctx, z, t2) });
  if (k === 1) z.drift = { tgt: t, sp: 130 };
  if (k === 2) after(z.life - 0.1, () => { if (f.alive) for (const e of supEnemies(f)) if (len(e.x - z.x, e.y - z.y) < z.r) applyEffect(f, e, 'freeze', P); });
  if (!FX.off) supSound(f, 'skill', 1);
});
GSK('se_orbit', 'defense', '◐', 'Eclipse Orbit', [
  'A sun and a moon orbit Solar Eclipse for 6 s: they hit nearby enemies and block up to 4 enemy shots.',
  'The orbit breathes wider and narrower, and both spheres fire small beams at enemies within reach.',
  'Two suns and two moons in counter-rotating orbits; blocked shots are fired back at their owner as solar bolts.'],
(f, s, P) => {
  const k = gk(f), n = k === 2 ? 4 : 2, st = sx(f);
  st.interceptN = (k === 2 ? 8 : 4) + (st.variant ? 2 : 0);
  for (let i = 0; i < n; i++) {
    const sun = i % 2 === 0, dir = k === 2 && i >= 2 ? -1 : 1, outer = k === 2 && i >= 2;
    const p = supShot(f, f.x, f.y, 0, { speed: 0, r: 14, dmg: SD(f, P) * 0.14, col: sun ? '#ffb300' : '#b388ff', style: sun ? 'sunorb' : 'moonorb', life: 6, pierce: 999, power: P, data: { a: i / n * TAU, t: 0, cd: 0, fire: 0.6 } });
    p.tick = (p, h) => { const d = p.data; d.t += h; d.cd -= h; if (d.cd <= 0) { d.cd = 0.45; if (p.hits) p.hits.clear(); } if (!f.alive) { p.life = 0; return; }
      d.a += 2.6 * dir * h; const R = k === 1 ? f.r + 70 + 50 * dsin(d.t * 3) : f.r + (outer ? 115 : 62);
      p.x = inArenaX(f.x + dcos(d.a) * R, 14); p.y = inArenaY(f.y + dsin(d.a) * R, 14); p.vx = p.vy = 0;
      if (st.interceptN > 0) for (const q of BATTLE.projs) {
        if (q.team === f.team || !(q.life > 0) || q.ult || dist2(q.x, q.y, p.x, p.y) > (q.r + p.r + 4) * (q.r + p.r + 4)) continue;
        q.life = 0; q.onEnd = null; q.dmg = 0; st.interceptN--;
        if (!FX.off) { FX.ring(q.x, q.y, p.col, 40, 0.25, 4, 4); FX.sparks(q.x, q.y, p.col, 6, 300); }
        if (k === 2 && q.owner && q.owner.alive) supShot(f, p.x, p.y, datan2(q.owner.y - p.y, q.owner.x - p.x), { speed: 700, r: 8, dmg: SD(f, P) * 0.15, col: '#ffd54f', style: 'sunorb', power: P, life: 1.4 });
        if (st.interceptN <= 0) break;
      }
      if (k >= 1 && (d.fire -= h) <= 0) { d.fire = 1; const e = supEnemies(f).find(e => dist2(e.x, e.y, p.x, p.y) < 320 * 320); if (e) supShot(f, p.x, p.y, datan2(e.y - p.y, e.x - p.x), { speed: 640, r: 6, dmg: SD(f, P) * 0.07, col: sun ? '#ffd54f' : '#e1bee7', style: 'dronebolt', power: P, life: 1 }); }
    };
  }
  if (!FX.off) supSound(f, 'skill', 2);
}, true);
GSK('se_gravity', 'control', '◉', 'Gravity Eclipse', [
  'A gravity field at the target pulls enemies to its centre, then bursts in a shockwave. (+25% in ECLIPSE state)',
  'The field spins enemies around its centre; the shockwave also stuns.',
  'A sun field and a moon field pull from both sides, drift together and collide in a huge eclipse shockwave.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), mul = seMul(f, 'lunar'); P *= mul;
  const pull = 1500 * mul;
  const shock = (x, y, r, m, stun) => { supWave(f, x, y, r, SD(f, P) * m, '#ffd54f', { force: 900 }); if (stun) for (const e of supEnemies(f)) if (len(e.x - x, e.y - y) < r && !e.boss) e.st.stun = Math.max(e.st.stun, 0.5); if (!FX.off) { FX.addShake(10); FX.ring(x, y, '#b388ff', r, 0.4, 10, 20); darkBurst(x, y, r * 0.6, 0.6); } };
  if (k === 0) { const x = inArenaX(t.x, 100), y = inArenaY(t.y, 100); supZone(f, { kind: 'gravity', x, y, r: 250, life: 1.8, col: '#b388ff', pull, dmg: SD(f, P) * 0.05, power: P }); after(1.8, () => { if (f.alive) shock(x, y, 300, 0.45); }); }
  else if (k === 1) { const x = inArenaX((f.x + t.x) / 2, 100), y = inArenaY((f.y + t.y) / 2, 100);
    supZone(f, { kind: 'custom', custom: true, x, y, r: 280, life: 1.8, col: '#b388ff', onTick: (z, e, d, h) => { if (d > z.r || d < 1) return; const dx = (z.x - e.x) / d, dy = (z.y - e.y) / d, bk = e.boss ? 0.4 : 1; e.vx += (dx * pull * 0.8 - dy * 1100) * h * bk; e.vy += (dy * pull * 0.8 + dx * 1100) * h * bk; }, draw: (ctx, z, t2) => vGravityWell(ctx, z, t2) });
    after(1.8, () => { if (f.alive) shock(x, y, 320, 0.5, true); }); }
  else { const mx = inArenaX(t.x, 160), my = inArenaY(t.y, 120), mid = { x: mx, y: my, alive: true };
    for (const sd of [-1, 1]) { const z = supZone(f, { kind: 'gravity', x: inArenaX(mx + sd * 170, 60), y: my, r: 220, life: 1.8, col: sd < 0 ? '#ffb300' : '#b388ff', pull: pull * 0.8, dmg: SD(f, P) * 0.04, power: P }); z.drift = { tgt: mid, sp: 100 }; }
    after(1.8, () => { if (!f.alive) return; shock(mx, my, 380, 0.7, true); if (!FX.off) { FX.addFlash(0.25, '#ffd54f'); vfx((ctx, q) => vSun(ctx, mx, my, 60 + q * 80, '#ffd54f', 1 - q, q, true), 0.8); } }); }
  if (!FX.off) supSound(f, 'skill', 3);
});
GSK('se_corona', 'aoe', '✹', 'Corona Explosion', [
  'Charges the solar corona for half a second, then explodes in a golden and crimson ring. (+25% in SOLAR state)',
  'A double nova (gold, then crimson) that leaves a ring of burning ground.',
  'Twelve corona flares burst out like solar prominences before the nova; enemies close by are blinded.'],
(f, s, P) => {
  const k = gk(f); P *= seMul(f, 'solar');
  f.casting = 0.5;
  f.castFn = () => {
    if (!f.alive) return;
    supWave(f, f.x, f.y, 290, SD(f, P) * (k ? 0.6 : 0.72), '#ffd54f', { force: 650, effect: 'burn', power: P, speed: 820 });
    after(0.18, () => { if (f.alive) supWave(f, f.x, f.y, 320, SD(f, P) * (k ? 0.32 : 0.18), '#ff1744', { force: 400 }); });
    if (k >= 1) supZone(f, { kind: 'trap', x: f.x, y: f.y, r: 190, life: 2.5, col: '#ff6d00', effect: 'burn', power: P, dmg: SD(f, P) * 0.05, style: 'burn' });
    if (k === 2) { for (let i = 0; i < 12; i++) supShot(f, f.x, f.y, i / 12 * TAU, { speed: 600, r: 10, dmg: SD(f, P) * 0.1, col: i % 2 ? '#ff1744' : '#ffd54f', style: 'flarejet', life: 0.8, power: P, effect: 'burn', data: { c: (i % 2 ? 1 : -1) * 1.6 },
        tick: (p, h) => { const c = p.data.c * h, ca = dcos(c), sa = dsin(c), vx = p.vx; p.vx = vx * ca - p.vy * sa; p.vy = vx * sa + p.vy * ca; } });
      for (const e of supEnemies(f)) if (len(e.x - f.x, e.y - f.y) < 340) sx(e).blindT = 1; }
    if (!FX.off) { FX.addShake(10); FX.addFlash(0.2, '#ffd54f'); FX.burst(f.x, f.y, '#ffd54f', 60, 700, 7, 0.8); }
  };
  if (!FX.off) { vfx((ctx, q) => { if (f.alive) vCoronaCharge(ctx, f.x, f.y, f.r, q); }, 0.5); supSound(f, 'skill', 4); }
}, true);
GSK('se_shift', 'toggle', '☯', 'Celestial Shift', [
  'Switches between SOLAR state (solar attacks +25%, faster cooldowns) and ECLIPSE state (gravity and lunar abilities +25%, 10% less damage taken, more shots blocked).',
  'Switching also releases a pulse: SOLAR burns enemies around it, ECLIPSE pulls them in.',
  'Switching releases a bigger pulse and a 1-second celestial shield.'],
(f, s, P) => {
  if (!f.baseDef || !f.baseDef.states) return false;                      // only Solar Eclipse has the two states (a copied Celestial Shift does nothing)
  const st = sx(f), k = gk(f); st.variant = st.variant ? '' : 'eclipse'; f.def = formDef(f.baseDef, f.form, st.variant);
  if (k >= 1) { if (st.variant) supWave(f, f.x, f.y, 260 + k * 40, SD(f, P) * 0.15, '#b388ff', { force: -600 }); else supWave(f, f.x, f.y, 260 + k * 40, SD(f, P) * 0.15, '#ffd54f', { force: 300, effect: 'burn', power: P }); }
  if (k === 2) { f.st.shield = Math.max(f.st.shield, 1); f.st.shieldPow = Math.max(f.st.shieldPow, 0.3); }
  if (!FX.off) { FX.text(f.x, f.y - f.r - 34, st.variant ? '☾ ECLIPSE STATE' : '☀ SOLAR STATE', st.variant ? '#ff1744' : '#ffd54f', 18, { life: 1 }); FX.burst(f.x, f.y, st.variant ? '#7c4dff' : '#ffd54f', 30, 380, 6, 0.6); FX.ring(f.x, f.y, st.variant ? '#ff1744' : '#ffd54f', f.r * 2.6, 0.4, 8, f.r); supSound(f, 'transform', st.variant ? 3 : 1); }
}, true);
SUP.scoreFn.se_shift = (ai, s, c) => { const f = ai.f, ecl = !!(f.sx && f.sx.variant), close = c.d < 300 || c.myR < 0.45; return ecl ? (close ? 0 : 0.7) : (close ? 0.85 : 0); };
function totalEclipse(f, P, col, dmg, apoc) {
  const cx = ARENA.cx, cy = apoc ? ARENA.cy : ARENA.y + 170, boomT = apoc ? 2.7 : 2.3;
  camPunch(cx, cy, 0.1, boomT + 0.5);
  if (apoc) { sx(f).liftT = boomT; f.st.invuln = Math.max(f.st.invuln, 1.2); BATTLE.cond = { kind: 'gravshift', team: f.team, by: f, t: boomT, x: cx, y: cy }; }
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.y + 70, apoc ? '● APOCALYPSE OF THE BLACK SUN ●' : '● TOTAL ECLIPSE ●', '#ffd54f', apoc ? 38 : 44, { life: 2.8, vy: 0, pop: 2, stroke: '#1a0000' }); supSound(f, 'ult', apoc ? 2 : 0);
    vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.78 * Math.min(1, q * 2) * (q > 0.82 ? (1 - q) / 0.18 : 1); ctx.fillStyle = '#05000a'; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.restore(); }, boomT + 1.2);
    vfx((ctx, q) => { const a = Math.min(1, q * 2.2) * (q > 0.8 ? (1 - q) * 5 : 1); vCelestialRings(ctx, cx, cy, apoc ? 300 : 230, a, q * 4); vSun(ctx, cx, cy, (apoc ? 120 : 90) * Math.min(1, 0.3 + q * 1.4), '#ffb300', a, q, true); }, boomT + 0.4);
  }
  after(boomT, () => {
    if (!f.alive) return;
    for (const e of supEnemies(f)) { dealDamage(f, e, dmg * (apoc ? 0.7 : 0.62), { kind: 'skill', tag: 'explosion', effect: 'burn', power: P }); knock(e, cx, cy, apoc ? 1100 : 800); }
    supWave(f, cx, cy, 900, dmg * 0.12, '#ffd54f', { force: 600, speed: 1000 }); after(0.2, () => { if (f.alive) supWave(f, cx, cy, 900, dmg * 0.1, '#ff1744', { force: 400, speed: 900 }); });
    if (!FX.off) { FX.addFlash(0.45, '#ffd54f'); FX.addShake(22); for (let i = 0; i < 5; i++) FX.ring(cx, cy, i % 2 ? '#ff1744' : '#ffd54f', 360 + i * 160, 0.9, 16, 40); FX.burst(cx, cy, '#ffd54f', 110, 1100, 9, 1.2); }
  });
}
UL('totaleclipse', 'Total Eclipse — the arena darkens, a gigantic black sun with golden flames and two celestial rings rises, then explodes across the battlefield', (f, P, col, dmg) => totalEclipse(f, P, col, dmg, false));
UL('blacksunapoc', 'Apocalypse of the Black Sun — Solar Eclipse rises above the arena, gravity shifts to an artificial black sun and it bursts in a golden-crimson shockwave', (f, P, col, dmg) => totalEclipse(f, P, col, dmg, true));
godBall(B('solareclipse', 'Solar Eclipse Ball', 'God', 'God Tier', [128, 82, 68, 74, 30], D('#ff8f00', '#ffd54f', '#ff6d00', 'solarcore', [], '', { glow: 1.7, sdeco: ['solarcorona', 'celestialrings'], crings: 1, sfx: { wave: 'triangle', pitch: 0.9 } }),
  [S('SOLAR FLARE', 'se_flare', 7, 80, '#ffb300', 'burn'), S('LUNAR SHADOW', 'se_shadow', 10, 65, '#7c4dff', 'slow'), S('ECLIPSE ORBIT', 'se_orbit', 12, 65, '#ffd54f'), S('GRAVITY ECLIPSE', 'se_gravity', 10, 70, '#b388ff'), S('CORONA EXPLOSION', 'se_corona', 9, 80, '#ff6d00', 'burn'),
    { ...S('CELESTIAL SHIFT', 'se_shift', 3, 50, '#ffd54f'), always: true }],
  U('TOTAL ECLIPSE', 'totaleclipse', 110, '#ffd54f', 'burn'), 'intelligent', { desc: 'SUPREME COSMIC GOD • FREE. Solar and lunar power with gravity control — switch between SOLAR and ECLIPSE state at will.' }), {
  godClass: 'SUPREME COSMIC GOD', forms: [{ name: 'SOLAR GUARDIAN' }, { name: 'ECLIPSE EMPEROR', design: { c1: '#000000', c2: '#ffd54f', c3: '#ff1744', pat: 'eclipsecore', crings: 2, glow: 2.0, sdeco: ['solarcorona', 'celestialrings', 'eclipseflames'] } },
    { name: 'GOD OF THE ETERNAL ECLIPSE', design: { c1: '#000000', c2: '#ffe082', c3: '#d500f9', pat: 'eclipsecore', crings: 3, glow: 2.5, corona: 1.6, sdeco: ['solarcorona', 'celestialrings', 'eclipseflames', 'fragments'] } }],
  states: { eclipse: [{ c1: '#120018', c2: '#b388ff', c3: '#ff1744', pat: 'eclipsecore', lunar: 1 }, { c2: '#b388ff', c3: '#ff1744', lunar: 1 }, { c2: '#d1c4e9', c3: '#ff1744', lunar: 1 }] },
  finalUlt: U('APOCALYPSE OF THE BLACK SUN', 'blacksunapoc', 120, '#ffb300', 'burn'), sound: { base: 196, wave: 'triangle', slide: 1.2, noise: 1100 },
  passiveInfo: { name: 'CELESTIAL BALANCE', desc: 'Two energy states, switched with CELESTIAL SHIFT (always available). SOLAR: golden aura, solar attacks +25%, cooldowns 10% faster. ECLIPSE: black-crimson aura, gravity and lunar abilities +25%, 10% less damage taken.' },
  formPassive: ['Switching changes the state.', 'Switching also releases a solar or lunar pulse.', 'Switching releases a bigger pulse and a 1 s celestial shield.'],
  passive: { init(f) { f.sx.variant = ''; }, tick(f) { if (!f.sx.variant) f.pCd *= 0.9; } },
  fx: {
    idle: (f, d) => { const ecl = !!(f.sx && f.sx.variant), a = vr(TAU), r = f.r * vr(1.05, 1.6); FX.p(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, Math.cos(a) * (ecl ? -50 : 50), Math.sin(a) * (ecl ? -50 : 50), 0.5, vr(2, 5), ecl ? (Math.random() < 0.5 ? '#b388ff' : '#ff1744') : (Math.random() < 0.5 ? '#ffd54f' : '#ff6d00'), 'dot', 0); },
    bounce: (f, x, y, d) => { FX.burst(x, y, d.c2, 10, 260, 5, 0.35); FX.ring(x, y, d.c3, 60, 0.3, 4, 6); },
    victory: (f, d) => { vfx((ctx, q) => { vCelestialRings(ctx, f.x, f.y, f.r * 2.4, 1 - q * 0.5, q * 3); if (f.form === 2) vSun(ctx, f.x, f.y - f.r - 110, 40, '#ffb300', 1 - q * 0.5, q, true); }, 1.8); FX.text(f.x, f.y - f.r - 70, f.form === 2 ? 'THE ETERNAL ECLIPSE' : 'THE SUN NEVER SETS', d.c2, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, d.c2, 60, 520, 7, 1.0); vfx((ctx, q) => vSun(ctx, f.x, f.y, f.r * (1 - q), '#ffb300', 1 - q, q, true), 1); },
    entrance: () => vfx((ctx, q) => vCelestialRings(ctx, ARENA.cx, ARENA.cy, 320, Math.sin(Math.PI * q), q * 4), 1.4),
  },
});

/* ---------------- shared God Ball world rules ---------------- */
SUP.condCols.chaosgrav = '#d500f9'; SUP.condCols.gravshift = '#ffb300';
SUP.worldHooks.push((B, h) => {
  for (const z of B.zones) if (z.stepFn) z.stepFn(z, h);
  const c = B.cond;
  if (c && c.kind === 'chaosgrav') { c.dir += h * 1.8; for (const e of B.fighters) if (e.alive && e.team !== c.team && !(e.st.outside > 0)) { const k = e.boss ? 0.4 : 1; e.vx += dcos(c.dir) * 1100 * h * k; e.vy += dsin(c.dir) * 1100 * h * k; } }
  if (c && c.kind === 'gravshift') for (const e of B.fighters) if (e.alive && e.team !== c.team && !(e.st.outside > 0)) { const dx = c.x - e.x, dy = c.y - e.y, d = len(dx, dy) || 1, k = e.boss ? 0.4 : 1; e.vx += dx / d * 1300 * h * k; e.vy += dy / d * 1300 * h * k; }
  for (const L of B.lasers) if (L.conv && L.conv.tgt && L.conv.tgt.alive) { if (L.conv.from) { L.x0 = L.conv.from.x; L.y0 = L.conv.from.y; } L.x1 = L.conv.tgt.x; L.y1 = L.conv.tgt.y; }
  for (const m of B.fighters) if (m.echoOf && m.alive) {         // Cyber Clone holograms
    const o = m.echoOf; if (!o.alive) continue;
    const a = m.echoA + o.t * 0.6, sx2 = inArenaX(o.x + dcos(a) * (o.r + 90), m.r), sy2 = inArenaY(o.y + dsin(a) * (o.r + 90), m.r);
    if (m.echoK === 0) { m.x = sx2; m.y = sy2; m.vx = o.vx; m.vy = o.vy; }
    else { const kk = Math.min(1, 6 * h); m.x += (sx2 - m.x) * kk; m.y += (sy2 - m.y) * kk; if (o.st.dash > 0) { m.vx = o.vx; m.vy = o.vy; m.st.dash = o.st.dash; } }
    if (o.stats.skills > m.echoSk) { m.echoSk = o.stats.skills; const t = nearestEnemy(m); if (t) addLaser(m, [m.x, m.y, t.x, t.y], { charge: 0.15, dur: 0.25, w: 8, dmg: skillDmg(o, m.echoP || 60) * 0.09, col: '#40c4ff' }); }
  }
});
SUP.chipHooks.push((f, chips) => {
  const s = f.sx;
  if (s.inst > 0) chips.push(['INSTINCT ×' + s.inst, '#ffd54f']); if (s.berserkT > 0) chips.push(['BERSERK', '#ff1744']);
  if (s.learn) { const best = Math.max(0, ...Object.values(s.learn)); if (best) chips.push([`LEARNED ${Math.round(Math.min(LEARN_CAP[f.form], best * 0.04) * 100)}%`, '#40c4ff']); }
  if (s.adaptT > 0) chips.push(['ADAPTING', '#40c4ff']); if (s.scanT > 0) chips.push(['SCANNED', '#00e5ff']); if (s.entropyT > 0) chips.push(['ENTROPY', '#d500f9']);
  if (f.baseDef && f.baseDef.id === 'godofchaos') chips.push([CHAOS_MODES[s.chaosMode | 0], CHAOS_COL[s.chaosMode | 0]]);
  if (f.baseDef && f.baseDef.id === 'solareclipse') chips.push([s.variant ? '☾ ECLIPSE' : '☀ SOLAR', s.variant ? '#ff1744' : '#ffd54f']);
});

/* =====================================================================
   GOD BALL VISUALS (visual only) — body art, floating decorations, projectiles, cinematic shapes
   ===================================================================== */
Object.assign(PATTERN_FN, {
  chaosgod(g, R, d, rng) {        // purple-crimson nebula torn by distortion lines
    g.fillStyle = '#0a0010'; g.fillRect(-R, -R, 2 * R, 2 * R);
    for (let i = 0; i < 26; i++) _blob(g, (rng() - 0.5) * R * 1.8, (rng() - 0.5) * R * 1.8, R * (0.2 + rng() * 0.35), rng() < 0.5 ? d.c2 : d.c3, 0.35);
    for (let i = 0; i < 9; i++) { g.strokeStyle = rgba(i % 2 ? d.c3 : d.c2, 0.7); g.lineWidth = R * 0.025; g.beginPath(); const y0 = (rng() - 0.5) * R * 1.8; g.moveTo(-R, y0); for (let x = -R; x <= R; x += R / 8) g.lineTo(x, y0 + Math.sin(x / R * 6 + i) * R * 0.12 + (rng() - 0.5) * R * 0.06); g.stroke(); }
    _stars(g, R, 30, rng, ['#ffffff', d.c2, d.c3]); _blob(g, 0, 0, R * 0.35, '#ffffff', 0.5);
  },
  chaosgod2(g, R, d, rng) { PATTERN_FN.chaosgod(g, R, d, rng); for (let i = 0; i < 7; i++) { let a = rng() * TAU, x = 0, y = 0; g.beginPath(); g.moveTo(0, 0); for (let k = 0; k < 6; k++) { a += (rng() - 0.5) * 1.3; x += Math.cos(a) * R * 0.16; y += Math.sin(a) * R * 0.16; g.lineTo(x, y); } g.strokeStyle = rgba('#ea80fc', 0.9); g.lineWidth = R * 0.03; g.stroke(); } },
  wargod(g, R, d, rng) {          // crimson armour plates with gold rims and a glowing core
    const gr = g.createLinearGradient(-R, -R, R, R); gr.addColorStop(0, shade(d.c1, 0.35)); gr.addColorStop(1, shade(d.c1, -0.4)); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.strokeStyle = rgba(d.c2, 0.95); g.lineWidth = R * 0.05;
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); }
    for (const rr of [0.42, 0.72]) { g.beginPath(); g.arc(0, 0, R * rr, 0, TAU); g.stroke(); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.26; g.fillStyle = d.c2; g.beginPath(); g.arc(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86, R * 0.035, 0, TAU); g.fill(); }
    _blob(g, 0, 0, R * 0.42, d.c3, 1); _blob(g, 0, 0, R * 0.2, '#ffffff', 0.9);
  },
  wargod2(g, R, d, rng) { PATTERN_FN.wargod(g, R, d, rng); g.strokeStyle = rgba('#ffffff', 0.7); g.lineWidth = R * 0.02; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38); g.stroke(); } },
  aicore(g, R, d, rng) {          // a dark robotic core: circuit traces, mechanical segments and a lens eye
    g.fillStyle = shade(d.c1, -0.2); g.fillRect(-R, -R, 2 * R, 2 * R);
    g.strokeStyle = rgba(d.c2, 0.55); g.lineWidth = R * 0.018;
    for (let i = 0; i < 22; i++) { let x = (rng() - 0.5) * 2 * R, y = (rng() - 0.5) * 2 * R; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { if (rng() < 0.5) x += (rng() - 0.5) * R * 0.6; else y += (rng() - 0.5) * R * 0.6; g.lineTo(x, y); } g.stroke(); g.fillStyle = d.c2; g.fillRect(x - R * 0.02, y - R * 0.02, R * 0.04, R * 0.04); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.strokeStyle = rgba(d.c3, 0.6); g.lineWidth = R * 0.05; g.beginPath(); g.arc(0, 0, R * 0.62, a + 0.08, a + TAU / 8 - 0.08); g.stroke(); }
    g.fillStyle = '#02040c'; g.beginPath(); g.arc(0, 0, R * 0.36, 0, TAU); g.fill(); _blob(g, 0, 0, R * 0.34, d.c2, 1); _blob(g, 0, 0, R * 0.14, '#ffffff', 1);
  },
  aicore2(g, R, d, rng) { PATTERN_FN.aicore(g, R, d, rng); g.strokeStyle = rgba('#ffffff', 0.8); g.lineWidth = R * 0.015; g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU; g.lineTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5); } g.stroke(); _blob(g, 0, 0, R * 0.2, d.c3, 0.8); },
  aidrone(g, R, d) { g.fillStyle = '#1a2238'; g.fillRect(-R, -R, 2 * R, 2 * R); g.strokeStyle = d.c2; g.lineWidth = R * 0.12; g.beginPath(); g.arc(0, 0, R * 0.62, 0, TAU); g.stroke(); _blob(g, 0, 0, R * 0.45, d.c3, 1); _blob(g, 0, 0, R * 0.2, '#ffffff', 1); },
  solarcore(g, R, d, rng) {       // a golden sun: granulation, sunspots and a white-hot centre
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, '#fffde7'); gr.addColorStop(0.45, '#ffd54f'); gr.addColorStop(1, '#ff6d00'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    for (let i = 0; i < 90; i++) { const a = rng() * TAU, r = Math.sqrt(rng()) * R; g.fillStyle = rgba(rng() < 0.5 ? '#ff8f00' : '#fff59d', 0.35); g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, R * (0.03 + rng() * 0.05), 0, TAU); g.fill(); }
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(80,30,0,.45)'; g.beginPath(); g.arc((rng() - 0.5) * R, (rng() - 0.5) * R, R * 0.06, 0, TAU); g.fill(); }
  },
  eclipsecore(g, R, d, rng) {     // black core with a glowing corona rim and eclipse flames
    g.fillStyle = '#000'; g.fillRect(-R, -R, 2 * R, 2 * R);
    const rim = g.createRadialGradient(0, 0, R * 0.55, 0, 0, R); rim.addColorStop(0, 'rgba(0,0,0,1)'); rim.addColorStop(0.7, rgba(d.c3, 0.55)); rim.addColorStop(1, rgba(d.c2, 1)); g.fillStyle = rim; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    for (let i = 0; i < 30; i++) { const a = rng() * TAU; g.strokeStyle = rgba(i % 2 ? d.c2 : d.c3, 0.6); g.lineWidth = R * 0.02; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62); g.quadraticCurveTo(Math.cos(a + 0.15) * R * 0.8, Math.sin(a + 0.15) * R * 0.8, Math.cos(a + 0.05) * R * 0.95, Math.sin(a + 0.05) * R * 0.95); g.stroke(); }
    g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, R * 0.58, 0, TAU); g.fill(); g.strokeStyle = rgba(d.c2, 0.9); g.lineWidth = R * 0.02; g.stroke();
  },
});
for (const p of ['chaosgod', 'chaosgod2', 'wargod', 'wargod2', 'aicore', 'aicore2', 'aidrone', 'solarcore', 'eclipsecore']) if (!PATTERNS.includes(p)) PATTERNS.push(p);

function _swordShape(ctx, len, w, col, glow) {    // a spectral sword pointing along +x
  ctx.fillStyle = col; ctx.strokeStyle = glow || '#ffffff'; ctx.lineWidth = Math.max(1, w * 0.18);
  ctx.beginPath(); ctx.moveTo(len * 0.62, 0); ctx.lineTo(len * 0.05, -w * 0.5); ctx.lineTo(len * 0.05, w * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillRect(-len * 0.02, -w * 1.1, w * 0.5, w * 2.2); ctx.fillStyle = shade(col, -0.4); ctx.fillRect(-len * 0.32, -w * 0.22, len * 0.3, w * 0.44);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-len * 0.34, 0, w * 0.35, 0, TAU); ctx.fill();
}
Object.assign(SUP.deco, {
  chaosrings(ctx, r, d, t, front) { const n = d.rings || 2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < n; i++) { const tilt = i * 1.1 + t * (0.4 + i * 0.13), jit = 1 + 0.04 * Math.sin(t * 13 + i * 3); ctx.save(); ctx.rotate(tilt); ctx.strokeStyle = rgba(i % 2 ? d.c3 : d.c2, 0.75); ctx.lineWidth = r * 0.045; ctx.beginPath(); if (front) ctx.ellipse(0, 0, r * (1.45 + i * 0.12) * jit, r * 0.36, 0, 0, Math.PI); else ctx.ellipse(0, 0, r * (1.45 + i * 0.12) * jit, r * 0.36, 0, Math.PI, TAU); ctx.stroke(); ctx.restore(); } ctx.restore(); },
  chaoseyes(ctx, r, d, t, front) { if (!front) return; const blink = Math.abs(Math.sin(t * 0.9)) > 0.97 ? 0.15 : 1, flick = 0.8 + 0.2 * Math.sin(t * 23); for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * r * 0.3, -r * 0.08); ctx.scale(1, blink); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(sd < 0 ? d.c3 : d.c2), -r * 0.3, -r * 0.3, r * 0.6, r * 0.6); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = rgba('#ffffff', flick); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.12, r * 0.06, sd * 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.025, r * 0.055, 0, 0, TAU); ctx.fill(); ctx.restore(); } },
  distortion(ctx, r, d, t, front) { if (front) return; ctx.save(); ctx.strokeStyle = rgba(d.c2, 0.35); ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { const rr = r * (1.7 + ((t * 0.6 + i / 4) % 1) * 0.9); ctx.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * TAU, w = 1 + 0.06 * Math.sin(a * 5 + t * 6 + i); ctx.lineTo(Math.cos(a) * rr * w, Math.sin(a) * rr * w); } ctx.stroke(); } ctx.restore(); },
  chaosflames(ctx, r, d, t, front) { if (front) { if (Math.random() < 0.15) { ctx.save(); ctx.strokeStyle = '#ea80fc'; ctx.lineWidth = 2; ctx.beginPath(); let a = Math.random() * TAU, x = Math.cos(a) * r, y = Math.sin(a) * r; ctx.moveTo(x, y); for (let k = 0; k < 5; k++) { x += Math.cos(a) * r * 0.2 + (Math.random() - 0.5) * r * 0.35; y += Math.sin(a) * r * 0.2 + (Math.random() - 0.5) * r * 0.35; ctx.lineTo(x, y); } ctx.stroke(); ctx.restore(); } return; } _flames(ctx, r * 1.04, d.c3, t * 1.5, 14, 1.4); _flames(ctx, r * 0.98, '#7c00b8', t * 1.9 + 1, 10, 1.1); },
  warswords(ctx, r, d, t, front) { const n = d.swords || 2; for (let i = 0; i < n; i++) { const a = t * 1.3 + i / n * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; ctx.save(); ctx.translate(Math.cos(a) * r * 1.5, sn * r * 0.55 - r * 0.15); ctx.rotate(-HPI + Math.cos(a) * 0.3); ctx.globalAlpha = 0.85; _swordShape(ctx, r * 0.9, r * 0.12, i % 2 ? d.c3 : d.c2, '#ffffff'); ctx.restore(); } },
  warflames(ctx, r, d, t, front) { if (front) return; _flames(ctx, r * 1.02, d.c3, t * 1.3, 12, 1.25); _flames(ctx, r * 0.96, d.c2, t * 1.7 + 2, 8, 0.9); },
  armorplates(ctx, r, d, t, front) { if (!front) return; ctx.save(); ctx.rotate(t * 0.2); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.save(); ctx.rotate(a); ctx.fillStyle = rgba(d.c2, 0.85); ctx.strokeStyle = shade(d.c1, -0.4); ctx.lineWidth = r * 0.02; ctx.beginPath(); ctx.moveTo(r * 1.02, -r * 0.16); ctx.lineTo(r * 1.16, -r * 0.1); ctx.lineTo(r * 1.16, r * 0.1); ctx.lineTo(r * 1.02, r * 0.16); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); } ctx.restore(); },
  wartrails(ctx, r, d, t, front) { if (front) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; ctx.strokeStyle = rgba(i % 2 ? d.c3 : d.c2, 0.45); ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(0, 0, r * (1.25 + i * 0.12), a, a + 1.6); ctx.stroke(); } ctx.restore(); },
  mechrings(ctx, r, d, t, front) { const n = d.mrings || 1; for (let i = 0; i < n; i++) { ctx.save(); ctx.rotate(0.5 + i * 0.9); const rr = r * (1.35 + i * 0.16), dir = i % 2 ? -1 : 1; ctx.strokeStyle = rgba(i % 2 ? d.c3 : d.c2, 0.85); ctx.lineWidth = r * 0.05; ctx.beginPath(); if (front) ctx.ellipse(0, 0, rr, rr * 0.3, 0, 0, Math.PI); else ctx.ellipse(0, 0, rr, rr * 0.3, 0, Math.PI, TAU); ctx.stroke(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + t * dir; if ((Math.sin(a) > 0) !== front) continue; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.cos(a) * rr - 2, Math.sin(a) * rr * 0.3 - 2, 4, 4); } ctx.restore(); } },
  holocircuits(ctx, r, d, t, front) { if (!front) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = `700 ${r * 0.16}px Consolas, monospace`; ctx.fillStyle = rgba(d.c2, 0.6); for (let i = 0; i < 6; i++) { const a = t * 0.8 + i, rr = r * (1.25 + 0.15 * Math.sin(t * 2 + i)); ctx.fillText(['01', '⟨⟩', 'AI', '∑', '10', '◈'][i], Math.cos(a) * rr, Math.sin(a) * rr); } ctx.restore(); },
  minidrones(ctx, r, d, t, front) { const n = d.drones || 2; for (let i = 0; i < n; i++) { const a = -t * 1.8 + i / n * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; const x = Math.cos(a) * r * 1.7, y = sn * r * 0.7 - r * 0.6; ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#1a2238'; ctx.strokeStyle = d.c2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.11, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = d.c3; ctx.fillRect(-r * 0.2, -r * 0.02, r * 0.4, r * 0.04); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(d.c2), -r * 0.12, -r * 0.12, r * 0.24, r * 0.24); ctx.restore(); } },
  mechwings(ctx, r, d, t, front) { if (front) return; const flap = Math.sin(t * 3) * 0.12; for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd, 1); ctx.rotate(-flap); ctx.strokeStyle = d.c2; ctx.lineWidth = r * 0.05; for (let k = 0; k < 4; k++) { const a = -0.9 + k * 0.35, L = r * (1.9 - k * 0.2); ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.1); ctx.lineTo(r * 0.7 + Math.cos(a) * L, -r * 0.1 + Math.sin(a) * L); ctx.stroke(); ctx.fillStyle = rgba(d.c3, 0.25); ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.1); ctx.lineTo(r * 0.7 + Math.cos(a) * L, -r * 0.1 + Math.sin(a) * L); ctx.lineTo(r * 0.7 + Math.cos(a + 0.35) * L * 0.9, -r * 0.1 + Math.sin(a + 0.35) * L * 0.9); ctx.closePath(); ctx.fill(); } ctx.restore(); } },
  floatweapons(ctx, r, d, t, front) { if (!front) return; for (let i = 0; i < 3; i++) { const a = t * 0.7 + i / 3 * TAU; ctx.save(); ctx.translate(Math.cos(a) * r * 1.65, Math.sin(a) * r * 1.65); ctx.rotate(a + HPI); ctx.fillStyle = '#263238'; ctx.strokeStyle = d.c3; ctx.lineWidth = 1.5; ctx.fillRect(-r * 0.06, -r * 0.22, r * 0.12, r * 0.44); ctx.strokeRect(-r * 0.06, -r * 0.22, r * 0.12, r * 0.44); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(d.c3), -r * 0.1, -r * 0.34, r * 0.2, r * 0.2); ctx.restore(); } },
  solarcorona(ctx, r, d, t, front) { if (front) return; const k = d.corona || 1; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 22; i++) { const a = i / 22 * TAU + t * 0.25, l = r * k * (0.3 + 0.28 * Math.sin(t * 3 + i * 1.7)); ctx.strokeStyle = rgba(d.lunar ? (i % 2 ? '#b388ff' : '#ff1744') : (i % 2 ? d.c2 : '#ff6d00'), 0.6); ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.quadraticCurveTo(Math.cos(a + 0.1) * (r + l * 0.6), Math.sin(a + 0.1) * (r + l * 0.6), Math.cos(a + 0.04) * (r + l), Math.sin(a + 0.04) * (r + l)); ctx.stroke(); } ctx.restore(); },
  celestialrings(ctx, r, d, t, front) { const n = d.crings || 1; for (let i = 0; i < n; i++) { ctx.save(); ctx.rotate(-0.4 + i * 1.05 + t * 0.15 * (i % 2 ? -1 : 1)); const rr = r * (1.42 + i * 0.15); ctx.strokeStyle = rgba(i % 2 ? d.c3 : d.c2, 0.8); ctx.lineWidth = r * 0.035; ctx.beginPath(); if (front) ctx.ellipse(0, 0, rr, rr * 0.28, 0, 0, Math.PI); else ctx.ellipse(0, 0, rr, rr * 0.28, 0, Math.PI, TAU); ctx.stroke(); const a = t * (1.2 + i * 0.4); if ((Math.sin(a) > 0) === front) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(i % 2 ? '#b388ff' : '#ffd54f'), Math.cos(a) * rr - r * 0.13, Math.sin(a) * rr * 0.28 - r * 0.13, r * 0.26, r * 0.26); } ctx.restore(); } },
  eclipseflames(ctx, r, d, t, front) { if (front) return; _flames(ctx, r * 1.04, '#ff1744', t * 1.4, 12, 1.2); _flames(ctx, r * 0.98, '#aa00ff', t * 1.8 + 2, 9, 1.0); },
  fragments(ctx, r, d, t, front) { for (let i = 0; i < 7; i++) { const a = t * 0.5 + i / 7 * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; ctx.save(); ctx.translate(Math.cos(a) * r * 1.85, sn * r * 0.85); ctx.rotate(t * 1.5 + i); ctx.fillStyle = rgba(i % 2 ? d.c2 : '#b388ff', 0.85); ctx.beginPath(); ctx.moveTo(0, -r * 0.12); ctx.lineTo(r * 0.08, 0); ctx.lineTo(0, r * 0.1); ctx.lineTo(-r * 0.07, -r * 0.02); ctx.closePath(); ctx.fill(); ctx.restore(); } },
});

/* ---------------- projectiles ---------------- */
SUP.projStyles = Object.assign(SUP.projStyles || {}, {
  chaos(ctx, p, t, r) { ctx.drawImage(glowSprite(p.col), p.x - r * 3.2, p.y - r * 3.2, r * 6.4, r * 6.4); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 9); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ctx.lineTo(Math.cos(a) * r * (k % 2 ? 0.5 : 1.1), Math.sin(a) * r * (k % 2 ? 0.5 : 1.1)); } ctx.closePath(); ctx.stroke(); ctx.restore(); },
  madorb(ctx, p, t, r) { const pul = 1 + 0.2 * Math.sin(t * 18 + p.x * 0.05); ctx.drawImage(glowSprite(p.col), p.x - r * 3.6 * pul, p.y - r * 3.6 * pul, r * 7.2 * pul, r * 7.2 * pul); ctx.fillStyle = '#14001f'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.8, 0, TAU); ctx.fill(); ctx.strokeStyle = p.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, r, t * 8, t * 8 + 4); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.25, 0, TAU); ctx.fill(); },
  sword(ctx, p, t, r, a) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(p.col), p.x - r * 2.6, p.y - r * 2.6, r * 5.2, r * 5.2); ctx.globalCompositeOperation = 'source-over'; ctx.translate(p.x, p.y); ctx.rotate(a); _swordShape(ctx, r * 4.4, r * 0.62, p.col, '#ffffff'); ctx.restore(); },
  dronebolt(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = p.col; ctx.fillRect(-r * 2.2, -r * 0.35, r * 3.2, r * 0.7); ctx.fillStyle = '#ffffff'; ctx.fillRect(-r * 0.6, -r * 0.18, r * 1.4, r * 0.36); ctx.restore(); ctx.drawImage(glowSprite(p.col), p.x - r * 2, p.y - r * 2, r * 4, r * 4); },
  sunorb(ctx, p, t, r) { ctx.drawImage(glowSprite('#ffb300'), p.x - r * 3.4, p.y - r * 3.4, r * 6.8, r * 6.8); const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, '#fffde7'); g.addColorStop(1, '#ff8f00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); },
  moonorb(ctx, p, t, r) { ctx.drawImage(glowSprite('#b388ff'), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.fillStyle = '#ede7f6'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#120018'; ctx.beginPath(); ctx.arc(p.x + r * 0.4, p.y - r * 0.2, r * 0.85, 0, TAU); ctx.fill(); },
  flarejet(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); const g = ctx.createLinearGradient(-r * 4, 0, r, 0); g.addColorStop(0, rgba(p.col, 0)); g.addColorStop(1, p.col); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.quadraticCurveTo(-r, -r, -r * 4, 0); ctx.quadraticCurveTo(-r, r, r * 1.2, 0); ctx.fill(); ctx.restore(); ctx.drawImage(glowSprite('#fff59d'), p.x - r * 1.6, p.y - r * 1.6, r * 3.2, r * 3.2); },
});

/* ---------------- cinematic shapes ---------------- */
function vRift(ctx, x, y, r, col, a, t) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), -r * 2.2, -r * 2.2, r * 4.4, r * 4.4); ctx.globalCompositeOperation = 'source-over'; ctx.rotate(t * 2); ctx.fillStyle = '#050008'; ctx.beginPath(); for (let k = 0; k <= 16; k++) { const an = k / 16 * TAU, rr = r * (0.7 + 0.3 * Math.sin(an * 3 + t * 9)); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr * 0.75); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r * 0.4, t * 5, t * 5 + 3); ctx.stroke(); ctx.restore(); }
function vDistortZone(ctx, z, t) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 0, 0, 0, z.r); g.addColorStop(0, 'rgba(213,0,249,.14)'); g.addColorStop(1, 'rgba(255,23,68,.05)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(234,128,252,.55)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); for (let k = 0; k <= 30; k++) { const x = -z.r + k / 30 * z.r * 2, y = (i - 2.5) * z.r / 3.2 + Math.sin(x / z.r * 4 + t * 4 + i) * 10; if (x * x + y * y < z.r * z.r) ctx.lineTo(x, y); } ctx.stroke(); } if (z.k === 0) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(z.dir) * z.r * 0.6, Math.sin(z.dir) * z.r * 0.6); ctx.stroke(); } ctx.setLineDash([10, 8]); ctx.strokeStyle = z.k === 2 ? 'rgba(255,23,68,.8)' : 'rgba(213,0,249,.8)'; ctx.beginPath(); ctx.arc(0, 0, z.r, t, t + TAU); ctx.stroke(); ctx.restore(); }
function vDistortArena(ctx, a, t) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1) * 0.6; ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { ctx.strokeStyle = i % 2 ? '#d500f9' : '#ff1744'; ctx.beginPath(); const y0 = ARENA.y + ARENA.h * (i + 0.5) / 14; for (let x = ARENA.x; x <= ARENA.r; x += 30) ctx.lineTo(x, y0 + Math.sin(x * 0.012 + t * 5 + i) * 18 + Math.sin(x * 0.03 - t * 3) * 6); ctx.stroke(); } ctx.restore(); }
function vChaosSphere(ctx, x, y, r, t, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#d500f9'), x - r * 2, y - r * 2, r * 4, r * 4); ctx.globalCompositeOperation = 'source-over'; const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#ff80ab'); g.addColorStop(0.5, '#6a0080'); g.addColorStop(1, '#0a0010'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 3; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r * 0.35, t * (1 + i) + i, 0, TAU); ctx.stroke(); } ctx.restore(); }
function vCracks(ctx, a, seed) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); const rng = mulberry32(seed); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.5; for (let i = 0; i < 12; i++) { let x = ARENA.cx + (rng() - 0.5) * 200, y = ARENA.cy + (rng() - 0.5) * 140, an = rng() * TAU; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 7; k++) { an += (rng() - 0.5) * 1.1; x += Math.cos(an) * 70; y += Math.sin(an) * 70; ctx.lineTo(x, y); } ctx.stroke(); } ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(213,0,249,.15)'; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.restore(); }
function vSlash(ctx, x0, y0, x1, y1, col, a, w = 18) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; for (const [lw, c] of [[w * 2.2, rgba(col, 0.25)], [w, rgba(col, 0.85)], [w * 0.3, '#ffffff']]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); } ctx.restore(); }
function vFallingSword(ctx, x, y, s, q, big) { const fall = Math.min(1, q * 1.25), yy = y - (1 - fall) * 420; ctx.save(); ctx.globalAlpha = q > 0.85 ? (1 - q) / 0.15 : 1; ctx.translate(x, yy); ctx.rotate(HPI); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(big ? '#ffffff' : '#ffd54f'), -40 * s, -40 * s, 80 * s, 80 * s); ctx.globalCompositeOperation = 'source-over'; _swordShape(ctx, 70 * s, 9 * s, big ? '#fff8e1' : '#ffd54f', '#ffffff'); ctx.restore(); }
function vGroundCracks(ctx, x, y, r, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.strokeStyle = '#ff6d00'; ctx.lineWidth = 3; ctx.shadowColor = '#ff3d00'; ctx.shadowBlur = 8; const rng = mulberry32(Math.round(x * 7 + y)); for (let i = 0; i < 9; i++) { let an = i / 9 * TAU + rng() * 0.3, px = x, py = y; ctx.beginPath(); ctx.moveTo(px, py); for (let k = 0; k < 5; k++) { an += (rng() - 0.5) * 0.7; px += Math.cos(an) * r / 5; py += Math.sin(an) * r / 5; ctx.lineTo(px, py); } ctx.stroke(); } ctx.restore(); }
function vWarrior(ctx, x, y, s, a, q) {        // a spectral warrior silhouette: helmet, shoulders, cape, raised sword
  if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1) * 0.75; ctx.translate(x, y - s * 0.2); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, -s, 0, s); g.addColorStop(0, 'rgba(255,213,79,.55)'); g.addColorStop(1, 'rgba(255,23,68,.1)'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, -s * 0.62, s * 0.17, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.35); ctx.quadraticCurveTo(0, -s * 0.52, s * 0.5, -s * 0.35); ctx.lineTo(s * 0.62, s * 0.7); ctx.lineTo(-s * 0.62, s * 0.7); ctx.closePath(); ctx.fill();
  ctx.fillRect(-s * 0.2, -s * 0.85, s * 0.4, s * 0.06);
  ctx.save(); ctx.translate(s * 0.5, -s * 0.35); ctx.rotate(-1.2 - Math.sin(q * 6) * 0.1); ctx.globalAlpha *= 1.2; _swordShape(ctx, s * 1.1, s * 0.07, '#ffd54f', '#ffffff'); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 0.64); ctx.lineTo(s * 0.08, -s * 0.64); ctx.stroke();
  ctx.restore();
}
function vSixSwords(ctx, x, y, q) {            // six swords appear in a fan, then merge into one celestial blade
  const merge = clamp((q - 0.6) / 0.35, 0, 1);
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < 6; i++) { const a0 = -HPI + (i - 2.5) * 0.32, a = a0 + (-HPI - a0) * merge, show = clamp(q * 6 - i * 0.5, 0, 1); if (show <= 0) continue; ctx.save(); ctx.globalAlpha = show * (1 - merge * 0.85); ctx.rotate(a); ctx.translate(40, 0); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#ffd54f'), -10, -40, 160, 80); ctx.globalCompositeOperation = 'source-over'; _swordShape(ctx, 150, 13, i % 2 ? '#ff1744' : '#ffd54f', '#ffffff'); ctx.restore(); }
  if (merge > 0) { ctx.save(); ctx.globalAlpha = merge; ctx.rotate(-HPI); ctx.translate(30, 0); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#ffffff'), -40, -90, 360, 180); ctx.globalCompositeOperation = 'source-over'; _swordShape(ctx, 300 * (0.6 + merge * 0.4), 30, '#fff8e1', '#ffd54f'); ctx.restore(); }
  ctx.restore();
}
function vGiantBlade(ctx, x, y, s, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y); ctx.rotate(HPI); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#ffd54f'), -200 * s, -150 * s, 700 * s, 300 * s); ctx.globalCompositeOperation = 'source-over'; _swordShape(ctx, 420 * s, 40 * s, '#fff8e1', '#ffd54f'); ctx.restore(); }
function vScanBeam(ctx, x0, y0, x1, y1, col, a, q) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; const an = Math.atan2(y1 - y0, x1 - x0), d = Math.hypot(x1 - x0, y1 - y0), sp = 0.12 + 0.05 * Math.sin(q * 20); ctx.fillStyle = rgba(col, 0.18); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(an - sp) * d * 1.05, y0 + Math.sin(an - sp) * d * 1.05); ctx.lineTo(x0 + Math.cos(an + sp) * d * 1.05, y0 + Math.sin(an + sp) * d * 1.05); ctx.closePath(); ctx.fill(); ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; const sy = (q * 3 % 1) * 2 - 1; ctx.beginPath(); ctx.moveTo(x1 + Math.cos(an + HPI) * 50 * sy - 30, y1 + Math.sin(an + HPI) * 50 * sy); ctx.lineTo(x1 + Math.cos(an + HPI) * 50 * sy + 30, y1 + Math.sin(an + HPI) * 50 * sy); ctx.stroke(); ctx.restore(); }
function vReticle(ctx, x, y, r, col, a, t, label) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.rotate(t * 0.5); for (let i = 0; i < 4; i++) { ctx.rotate(HPI); ctx.beginPath(); ctx.arc(0, 0, r, -0.5, 0.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.lineTo(r * 1.15, 0); ctx.stroke(); } ctx.rotate(-t * 0.5); if (label) { ctx.font = '800 11px Consolas, monospace'; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(label, 0, -r - 8); } ctx.restore(); }
function vDigitalGrid(ctx, a, q) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(0,229,255,.16)'; ctx.lineWidth = 1; for (let x = ARENA.x; x <= ARENA.r; x += 48) { ctx.beginPath(); ctx.moveTo(x, ARENA.y); ctx.lineTo(x, ARENA.b); ctx.stroke(); } for (let y = ARENA.y; y <= ARENA.b; y += 48) { ctx.beginPath(); ctx.moveTo(ARENA.x, y); ctx.lineTo(ARENA.r, y); ctx.stroke(); } ctx.fillStyle = 'rgba(0,229,255,.5)'; ctx.font = '700 12px Consolas, monospace'; for (let i = 0; i < 18; i++) ctx.fillText(((i * 7919 + Math.floor(q * 40)) % 2 ? '1' : '0') + ((i * 104729) % 2 ? '1' : '0'), ARENA.x + ((i * 173) % ARENA.w), ARENA.y + ((i * 97 + q * 300) % ARENA.h)); const sy = ARENA.y + (q * 1.6 % 1) * ARENA.h, g = ctx.createLinearGradient(0, sy - 30, 0, sy + 30); g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(0.5, 'rgba(0,229,255,.25)'); g.addColorStop(1, 'rgba(0,229,255,0)'); ctx.fillStyle = g; ctx.fillRect(ARENA.x, sy - 30, ARENA.w, 60); ctx.restore(); }
function vSatellite(ctx, x, y, s, a, q) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#1c2541'; ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2; for (const sd of [-1, 1]) { ctx.fillRect(sd * 60 - 45, -14, 90, 28); ctx.strokeRect(sd * 60 - 45, -14, 90, 28); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(sd * 60 - 45 + k * 22.5, -14); ctx.lineTo(sd * 60 - 45 + k * 22.5, 14); ctx.stroke(); } } ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill(); ctx.stroke(); ctx.rotate(q * 4); ctx.strokeStyle = '#ff00e6'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 4); ctx.stroke(); ctx.rotate(-q * 4); const ch = Math.min(1, q * 2.2); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#00e5ff'), -60 * ch, -60 * ch + 30, 120 * ch, 120 * ch); ctx.restore(); }
function vLunarField(ctx, z, t) { ctx.save(); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, z.r); g.addColorStop(0, 'rgba(18,0,40,.55)'); g.addColorStop(0.8, 'rgba(60,20,120,.3)'); g.addColorStop(1, 'rgba(124,77,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(209,196,233,.35)'; ctx.beginPath(); ctx.arc(0, 0, z.r * 0.45, 0, TAU); ctx.arc(z.r * 0.15, -z.r * 0.08, z.r * 0.4, 0, TAU, true); ctx.fill(); ctx.strokeStyle = 'rgba(179,136,255,.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.arc(0, 0, z.r, -t, -t + TAU); ctx.stroke(); ctx.restore(); }
function vGravityWell(ctx, z, t) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(179,136,255,.5)'; ctx.lineWidth = 3; for (let k = 0; k < 5; k++) { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const an = i / 40 * TAU * 1.2 + t * 3 + k * 1.25, rr = z.r * (1 - i / 40); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); ctx.restore(); }
function vCoronaCharge(ctx, x, y, r, q) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 16; i++) { const an = i / 16 * TAU + q * 3, d = r * (3.2 - q * 2.1); ctx.drawImage(glowSprite(i % 2 ? '#ffd54f' : '#ff1744'), x + Math.cos(an) * d - 10, y + Math.sin(an) * d - 10, 20, 20); } const R = r * (1.3 + q * 0.8); ctx.drawImage(glowSprite('#ffb300'), x - R * 1.5, y - R * 1.5, R * 3, R * 3); ctx.restore(); }
function vCelestialRings(ctx, x, y, r, a, t) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); for (let i = 0; i < 2; i++) { ctx.save(); ctx.rotate(t * (i ? -0.6 : 0.45) + i * 0.9); ctx.strokeStyle = i ? 'rgba(179,136,255,.75)' : 'rgba(255,213,79,.85)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, r * (1 + i * 0.12), r * 0.3, 0, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, r * (1.06 + i * 0.12), r * 0.33, 0, 0, TAU); ctx.stroke(); for (let k = 0; k < 8; k++) { const an = k / 8 * TAU + t; ctx.drawImage(glowSprite(i ? '#b388ff' : '#ffd54f'), Math.cos(an) * r * (1 + i * 0.12) - 8, Math.sin(an) * r * 0.3 - 8, 16, 16); } ctx.restore(); } ctx.restore(); }

/* =====================================================================
   GOD BALL UI — collection section, interactive preview, selection row, practice test
   ===================================================================== */
const GOD_FORM_LABELS = ['BASE FORM', 'AWAKENED FORM', 'FINAL GOD FORM'];
const godFormOpen = (b, k) => k === 0 || prog(b.id).level >= GOD_UNLOCK[k - 1];
if (!window.NBB_HEADLESS) {
  const css = `
  .god-sec{margin:0 0 14px;padding:10px;border-radius:14px;border:1px solid rgba(255,213,79,.5);background:linear-gradient(120deg,rgba(213,0,249,.14),rgba(255,23,68,.10),rgba(41,121,255,.12),rgba(255,179,0,.12))}
  .god-sec .god-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:900;letter-spacing:1.5px;color:#ffe9a8;text-shadow:0 0 10px rgba(255,213,79,.7);margin:0 2px 8px}
  .god-free{background:#00c853;color:#00170a;border-radius:6px;padding:2px 7px;font-size:11px;letter-spacing:.6px;box-shadow:0 0 8px rgba(0,230,118,.6)}
  .god-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}
  .god-card{position:relative;border-radius:12px;border:1px solid rgba(120,170,255,.35);background:rgba(6,12,36,.8);padding:10px;color:#fff;display:flex;flex-direction:column;gap:6px}
  .god-card .gtop{display:flex;gap:10px;align-items:center}.god-card .gtop canvas{flex:none}
  .god-card .gname{font-weight:900;font-size:16px;letter-spacing:.5px}.god-card .gclass{font-size:11px;font-weight:800;color:#ffd54f;letter-spacing:1px}
  .god-icons{display:flex;gap:4px;flex-wrap:wrap}.god-icons span{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;border:1px solid rgba(255,255,255,.18)}
  .god-forms{display:flex;gap:6px;justify-content:space-between}.god-forms figure{margin:0;text-align:center;flex:1;font-size:9px;font-weight:800;color:#bcd}.god-forms figure.lock canvas{filter:grayscale(.7) brightness(.55)}
  .god-prog{height:7px;border-radius:4px;background:#14203f;position:relative;overflow:hidden}.god-prog i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#29e3ff,#ffd54f)}
  .god-prog b{position:absolute;top:0;bottom:0;width:2px;background:#fff}
  .god-card .gbtns{display:flex;gap:6px;flex-wrap:wrap}.god-card .gbtns .btn{flex:1;padding:7px 8px;font-size:13px}
  .god-modal{display:grid;grid-template-columns:minmax(240px,1fr) 1.3fr;gap:16px}.god-modal .gl{text-align:center}
  .god-tabs{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:6px 0}.god-tabs button{font-size:12px;padding:6px 10px}
  .god-tabs button.active{border-color:#ffd54f;box-shadow:0 0 10px rgba(255,213,79,.5)}
  .god-sk{display:grid;grid-template-columns:34px 1fr;gap:8px;align-items:start;padding:6px 0;border-top:1px solid rgba(255,255,255,.08)}
  .god-sk .ic{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:17px}
  .god-sk small{color:#9fb6d4;display:block;margin-top:2px;line-height:1.35}
  @media (max-width:640px){.god-modal{grid-template-columns:1fr}.god-row{grid-template-columns:1fr}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
}
function godProgressBar(b) {
  const lv = prog(b.id).level, pct = clamp(lv / GOD_UNLOCK[1], 0, 1) * 100;
  return h('div', {}, h('div', { class: 'god-prog' }, h('i', { style: { width: pct + '%' } }), h('b', { style: { left: (GOD_UNLOCK[0] / GOD_UNLOCK[1] * 100) + '%' } })),
    h('small', { class: 'muted', style: { fontSize: '11px' } }, `Ball Lv ${lv} • Awakened ${lv >= GOD_UNLOCK[0] ? '✔' : 'at Lv ' + GOD_UNLOCK[0]} • Final God Form ${lv >= GOD_UNLOCK[1] ? '✔' : 'at Lv ' + GOD_UNLOCK[1]}`));
}
Object.assign(UI, {
  godCard(b) {
    const c = h('div', { class: 'god-card' }), cv = ballCanvas(b, 86, { big: true }); this.addLive(cv, b, { size: 86 });
    c.append(h('div', { class: 'gtop' }, cv, h('div', {}, h('div', { class: 'gclass' }, b.godClass), h('div', { class: 'gname' }, b.name.replace(/ Ball$/, '').toUpperCase()), h('span', { class: 'god-free' }, 'FREE'))));
    const icons = h('div', { class: 'god-icons' });
    b.skills.forEach(s => icons.append(h('span', { title: s.name, style: { color: s.color, background: rgba(s.color, 0.18) } }, SKILL_TYPES[s.type]?.ico || '•')));
    icons.append(h('span', { title: 'Ultimate: ' + b.ult.name, style: { color: '#ffd54f', background: '#ffd54f2e' } }, '★'), h('span', { title: 'Final-form ultimate: ' + b.finalUlt.name, style: { color: '#fff', background: '#ffffff22' } }, '✦'));
    c.append(icons, h('small', { class: 'muted' }, '◆ ' + b.passiveInfo.name));
    const forms = h('div', { class: 'god-forms' });
    b.forms.forEach((fm, k) => forms.append(h('figure', { class: godFormOpen(b, k) ? '' : 'lock' }, ballCanvas(formDef(b, k), 46), h('figcaption', {}, (godFormOpen(b, k) ? '' : '🔒 ') + fm.name))));
    c.append(forms, godProgressBar(b), h('div', { class: 'gbtns' },
      h('button', { class: 'btn gold', onclick: () => this.openGod(b.id) }, '🔍 Inspect'),
      h('button', { class: 'btn primary', onclick: () => { Game.setup.ball = b.id; this.show('play'); } }, '⚔ Battle')));
    return c;
  },
  godSection(container) {
    container.innerHTML = '';
    const list = SUP.godIds.map(id => getBall(id)).filter(b => b && b.enabled !== false); if (!list.length) return;
    const row = h('div', { class: 'god-row' }); list.forEach(b => row.append(this.godCard(b)));
    container.append(h('div', { class: 'god-sec' }, h('div', { class: 'god-title' }, '⚡ SUPREME GOD BALLS', h('span', { class: 'god-free' }, 'FREE FOR EVERY PLAYER'), h('small', { class: 'muted', style: { letterSpacing: '0' } }, 'Awakened form at ball Lv 10 • Final God Form at Lv 20')), row));
  },
  /** interactive God Ball preview: every form (and Solar Eclipse's two states), every skill version, practice test */
  openGod(id, form = 0, variant = '') {
    const b = getBall(id); if (!b) return;
    const k = clamp(form, 0, 2), def = formDef(b, k, variant), wrap = h('div', { class: 'god-modal' }), L = h('div', { class: 'gl' }), R = h('div');
    const cv = ballCanvas(def, 240, { big: true }); this.live = this.live.filter(l => !l.modal); this.live.push({ canvas: cv, def, opts: { size: 240, big: true }, rot: 0, modal: true });
    L.append(h('div', { class: 'gclass', style: { color: '#ffd54f', fontWeight: 900, letterSpacing: '1px', fontSize: '12px' } }, b.godClass), h('h2', { style: { margin: '2px 0' } }, b.name.replace(/ Ball$/, '')), h('span', { class: 'god-free' }, 'FREE — UNLOCKED FOR EVERY PLAYER'), cv);
    const tabs = h('div', { class: 'god-tabs' });
    b.forms.forEach((fm, i) => tabs.append(h('button', { class: 'btn small' + (i === k ? ' active' : ''), onclick: () => this.openGod(id, i, variant) }, (godFormOpen(b, i) ? '' : '🔒 ') + GOD_FORM_LABELS[i])));
    L.append(tabs, h('div', { style: { fontWeight: 900, color: def.design.c2, letterSpacing: '1px' } }, b.forms[k].name));
    if (b.states) L.append(h('div', { class: 'god-tabs' }, h('button', { class: 'btn small' + (!variant ? ' active' : ''), onclick: () => this.openGod(id, k, '') }, '☀ SOLAR STATE'), h('button', { class: 'btn small' + (variant ? ' active' : ''), onclick: () => this.openGod(id, k, 'eclipse') }, '☾ ECLIPSE STATE')));
    L.append(godProgressBar(b));
    L.append(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '6px' } },
      h('button', { class: 'btn admin', onclick: () => { this.closeModal(); Game.tryGod(id, k); } }, `▶ Test ${['Base', 'Awakened', 'Final God'][k]} form in Practice`),
      h('button', { class: 'btn primary', onclick: () => { Game.setup.ball = id; this.closeModal(); this.show('play'); } }, '⚔ Battle'),
      h('button', { class: 'btn', onclick: () => this._godDetail(id) }, '⬆ Stats & skill tree')));
    L.append(h('p', { class: 'muted', style: { fontSize: '12px' } }, 'Practice tests are free and give no rewards: a bar at the top lets you switch forms, fire each ability, refill the ultimate and preview the entrance, victory and defeat animations.'));
    const sk = h('div');
    sk.append(h('h3', { style: { margin: '0 0 4px' } }, `Abilities — ${GOD_FORM_LABELS[k]}`));
    b.skills.forEach(s => { const T = SKILL_TYPES[s.type] || {}; sk.append(h('div', { class: 'god-sk' }, h('div', { class: 'ic', style: { color: s.color, background: rgba(s.color, 0.2) } }, T.ico || '•'), h('div', {}, h('b', {}, s.name + (s.always ? ' (always available)' : '')), h('small', {}, (T.forms ? T.forms[k] : T.desc) || '')))); });
    const u = k === 2 ? b.finalUlt : b.ult;
    sk.append(h('div', { class: 'god-sk' }, h('div', { class: 'ic', style: { color: '#ffd54f', background: '#ffd54f33' } }, '★'), h('div', {}, h('b', {}, (k === 2 ? 'FINAL-FORM ULTIMATE: ' : 'ULTIMATE: ') + u.name), h('small', {}, ULT_TYPES[u.type] || ''))));
    if (k !== 2) sk.append(h('div', { class: 'god-sk' }, h('div', { class: 'ic', style: { color: '#fff', background: '#ffffff22' } }, '✦'), h('div', {}, h('b', {}, 'FINAL-FORM ULTIMATE: ' + b.finalUlt.name), h('small', {}, (ULT_TYPES[b.finalUlt.type] || '') + ' (Final God Form only)'))));
    sk.append(h('div', { class: 'god-sk' }, h('div', { class: 'ic', style: { color: '#b388ff', background: '#b388ff33' } }, '◆'), h('div', {}, h('b', {}, 'PASSIVE: ' + b.passiveInfo.name), h('small', {}, b.passiveInfo.desc + ' ' + (b.formPassive ? b.formPassive[k] : '')))));
    sk.append(h('p', { class: 'muted', style: { fontSize: '12px' } }, 'Transformations: the 1st ultimate (or dropping to 50% HP) awakens the ball; the 2nd ultimate reaches the Final God Form. When two God Balls fire their ultimates at the same moment, a GOD CLASH decides which one goes through. Each form changes how every ability behaves.'));
    R.append(sk); wrap.append(L, R);
    this.modal(wrap, 'wide');
  },
});
/* the God Balls in the Collection, the selection screen and the ball detail */
{
  const rc = UI.render_collection, rf = UI.renderFeatured, od = UI.openDetail;
  UI._godDetail = function (id) { od.call(this, id); };
  UI.openDetail = function (id) { const b = getBall(id); if (b && b.godBall) return this.openGod(id); return od.call(this, id); };
  UI.render_collection = function () {
    rc.call(this);
    const grid = $('#collGrid'); if (!grid) return;
    let sec = document.getElementById('godSection'); if (!sec) { sec = h('div', { id: 'godSection' }); grid.parentNode.insertBefore(sec, grid); }
    this.godSection(sec);
  };
  UI.renderFeatured = function (grid) {
    rf.call(this, grid);
    let box = document.getElementById('selectGods');
    if (!box) { box = h('div', { id: 'selectGods', class: 'featured' }); grid.parentNode.insertBefore(box, document.getElementById('selectFeatured') || grid); }
    box.innerHTML = '';
    const list = SUP.godIds.map(id => getBall(id)).filter(b => b && b.enabled !== false); if (!list.length) { box.remove(); return; }
    const row = h('div', { class: 'feat-row' });
    for (const b of list) { const cv = ballCanvas(b, 60); this.addLive(cv, b, { size: 60 });
      row.append(h('button', { class: 'feat-card' + (Game.setup.ball === b.id ? ' selected' : ''), title: b.desc || '', onclick: () => { Game.setup.ball = b.id; Sound.play('click'); this.render_select(); } },
        cv, h('div', { class: 'feat-txt' }, h('small', {}, b.godClass), h('b', {}, b.name.replace(/ Ball$/, '').toUpperCase()), h('span', { class: 'feat-st free' }, 'FREE — UNLOCKED')))); }
    box.append(h('div', { class: 'feat-title' }, '⚡ NEW 2.2.0 — SUPREME GOD BALLS • FREE FOR EVERYONE'), row);
  };
}
/** free practice test of a God Ball in any form (no rewards) */
Game.tryGod = function (id, form = 0) {
  const b = getBall(id); if (!b || !b.godBall) return;
  Object.assign(this.setup, { ball: id, enemy: 'random', dummy: true, infinite: true, trial: false, godTest: true, startForm: clamp(form | 0, 0, 2) });
  Promise.resolve(this.start('practice')).finally(() => { this.setup.godTest = false; this.setup.startForm = 0; this.setup.dummy = false; });
};

if (window.NBB_CORE) Object.assign(window.NBB_CORE, { GOD_BALLS, GOD_UNLOCK, godFormCap, godIds: () => SUP.godIds.slice(), CLASH });
invalidateRegistry();
