/* =====================================================================
   NEON BALL BATTLE 2.4.0 — GOD OF ABSOLUTE • THE UNRIVALED ONE (LIMITED EXCLUSIVE SUPREME GOD, PHP 499)
   Loaded after gods2.js in the browser AND on the game server (deterministic, verifiable).
   Battle logic only uses the seeded RNG (rand / dcos / dsin / datan2); Math.random / vr are visual only.

   - Ownership: ONLY a server-verified purchase inside the limited edition (server/shop.js + server/edition.js).
   - It starts at Lv 50 and levels to Lv 100 by verified battles. Its own level unlocks:
       Lv 50 Absolute Divinity • Lv 60 celestial combinations • Lv 70 Celestial Sovereign form •
       Lv 80 enhanced Divine Replication • Lv 90 cosmic effects + higher energy cap • Lv 100 The Unrivaled One + final ultimate
   ===================================================================== */
const ABS = { id: 'godofabsolute', PRICE_PHP: 499, START_LEVEL: 50, MAX_LEVEL: 100, FORM_LEVELS: [70, 100], COMBO_LV: 60, REPLICA_LV: 80, COSMIC_LV: 90,
  GOLD: '#ffd54f', WHITE: '#fffde7', PURPLE: '#9c6bff', BLACK: '#07040f', ULT_DUR: 3.4, GOD_PIERCE: 0.55, GOD_RESIST: 0.15 };
/** the level that unlocks features: practice / owner test battles show everything */
const absLv = f => { const m = f && f.owner && (f.minion || f.absCopy) ? f.owner : f; return BATTLE && BATTLE.cfg && (BATTLE.cfg.godTest || BATTLE.cfg.adminTest) ? ABS.MAX_LEVEL : ((m && m.level) | 0); };
const absLord = f => (f && f.absCopy && f.owner) ? f.owner : f;
const absCopies = f => BATTLE ? BATTLE.fighters.filter(x => x.alive && x.owner === f && x.absCopy) : [];
const ultDurOf = f => clamp(+(((f.baseDef || f.def).tuning || {}).ultDur) || ABS.ULT_DUR, 2.4, 5);   // owner setting (Admin → God of Absolute)
/** the God Ball's own sounds: celestial chimes over a deep bell (original synthesis) */
function absSound(kind, i = 0) {
  if (FX.off || typeof Sound === 'undefined' || !Sound.ctx || !Sound.tone) return;
  const b = 196 * (1 + i * 0.06);
  try {
    if (kind === 'judgment') { [1, 1.5, 2, 3].forEach((m, k) => Sound.tone(b * m * 2, 0.5, 'sine', 0.06, 1.0, k * 0.04)); Sound.tone(b / 2, 0.7, 'triangle', 0.12, 0.7); Sound.noiseHit(0.35, 0.12, 5200, 1.4); }
    else if (kind === 'reality') { Sound.tone(b * 1.41, 0.8, 'sawtooth', 0.05, 0.55); Sound.tone(b * 2.83, 0.6, 'sine', 0.05, 1.6, 0.1); Sound.noiseHit(0.6, 0.1, 900, 0.8); }
    else if (kind === 'rings') { [1, 1.25, 1.5].forEach((m, k) => Sound.tone(b * 4 * m, 0.35, 'triangle', 0.05, 1.02, k * 0.07)); }
    else if (kind === 'charge') { Sound.tone(b, 0.9, 'sine', 0.08, 3.2); Sound.tone(b * 1.5, 0.9, 'triangle', 0.05, 3.2, 0.05); }
    else if (kind === 'erase') { Sound.tone(b * 0.5, 0.9, 'sawtooth', 0.12, 0.45); Sound.noiseHit(0.9, 0.24, 700, 0.6); [2, 3, 4].forEach((m, k) => Sound.tone(b * m, 0.5, 'sine', 0.05, 0.8, 0.05 * k)); }
    else if (kind === 'replica') { [1, 1.33, 1.78, 2.37].forEach((m, k) => Sound.tone(b * 2 * m, 0.25, 'sine', 0.05, 1, k * 0.05)); }
    else if (kind === 'ult') { [1, 1.25, 1.5, 2, 2.5, 3].forEach((m, k) => Sound.tone(b * m, 1.4, 'sine', 0.06, 1, k * 0.12)); Sound.tone(b / 4, 2.2, 'triangle', 0.2, 0.5); Sound.noiseHit(1.4, 0.2, 400, 0.5); }
    else if (kind === 'boom') { Sound.tone(b / 3, 1.2, 'sawtooth', 0.22, 0.4); Sound.noiseHit(1.2, 0.35, 300, 0.4); }
    else if (kind === 'transform') { [1, 1.5, 2, 2.5, 3, 4].forEach((m, k) => Sound.tone(b * m, 0.8, 'triangle', 0.06, 1.01, k * 0.09)); Sound.tone(b / 4, 1.6, 'sine', 0.3, 0.55); }
  } catch (e) { /* audio is optional */ }
}
SUP.limitedGodIds = SUP.limitedGodIds || [];
/** registers a LIMITED EXCLUSIVE God Ball: God Ball framework + paid (verified purchase only) + limited edition + its own level range */
function limitedGodBall(def, cfg) {
  godBall(def, cfg);
  Object.assign(def, { paid: true, free: false, edition: true, isNew: true });
  SUP.godIds.splice(SUP.godIds.indexOf(def.id), 1); SUP.limitedGodIds.push(def.id);
  return def;
}
const absSay = (f, txt, col = ABS.GOLD, size = 16) => { if (!FX.off) FX.text(f.x, f.y - f.r - 34, txt, col, size, { life: 1.1, pop: 1.4 }); };
/** Lv 60+: celestial combinations — a skill that follows another within 3 s gains an extra effect */
function absCombo(f, name) { if (absLv(f) < ABS.COMBO_LV || f.absCopy) return null; const s = sx(f), prev = s.absLast, ok = prev && s.absLastT > 0 ? prev : null; s.absLast = name; s.absLastT = 3; return ok; }
function absComboFx(f, label) { if (!FX.off) { FX.text(f.x, f.y - f.r - 56, '✦ ' + label + ' ✦', ABS.WHITE, 17, { life: 1.2, pop: 1.8, stroke: '#2a1a00' }); FX.ring(f.x, f.y, ABS.GOLD, f.r * 3.2, 0.5, 6, f.r); } }

/* =================== SKILL 1: ABSOLUTE JUDGMENT =================== */
GSK('ab_judgment', 'aoe', '☉', 'Absolute Judgment', [
  'A circular wave of divine golden energy expands outward while celestial rings turn around the ball; it ends in a cinematic shockwave.',
  'A double judgment: a second wave follows, and six celestial bolts fly out of the rings and home in on enemies.',
  'Three waves at three speeds, then golden judgment pillars fall on up to three enemies (each pillar is marked before it lands).'],
(f, s, P) => {
  const k = gk(f), L = absLord(f), mini = !!f.absCopy, m = mini ? 0.32 : 1;
  const wave = (r, dmg, sp, col) => supWave(f, f.x, f.y, r, SD(L, P) * dmg * m, col, { speed: sp, w: 22, force: 520, power: P, style: 'judgment' });
  if (k === 0) wave(320, 0.9, 760, ABS.GOLD);
  else if (k === 1) { wave(330, 0.62, 760, ABS.GOLD); after(0.28, () => { if (!f.alive) return; wave(420, 0.38, 640, ABS.WHITE); });
    if (!mini) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; supShot(f, f.x + dcos(a) * (f.r + 30), f.y + dsin(a) * (f.r + 30), a, { speed: 520, r: 7, dmg: SD(L, P) * 0.09, col: ABS.WHITE, style: 'celestialbolt', homing: 2.6, power: P, life: 2 }); } }
  else { [0, 0.18, 0.36].forEach((d, i) => after(d, () => { if (f.alive) wave(300 + i * 90, [0.42, 0.32, 0.24][i], [900, 700, 540][i], i === 1 ? ABS.WHITE : ABS.GOLD); }));
    if (!mini) supEnemies(f).slice(0, 3).forEach(e => { supStrike(f, e.x, e.y, 0.65, 70, SD(L, P) * 0.3, ABS.GOLD, { kind: 'pillar', power: P }); if (!FX.off) vfx((ctx, q) => vReticle(ctx, e.x, e.y, 70 * (1.4 - q * 0.4), ABS.GOLD, 1 - q * 0.3, q * 6, 'JUDGMENT'), 0.65, { keep: true }); }); }
  // Lv 60 combination: Judgment while Celestial Dominion is up → every ring releases its own judgment wave
  if (!mini && absCombo(f, 'judgment') === 'dominion' && f.sx && f.sx.dominion) { absComboFx(f, 'CELESTIAL JUDGMENT'); for (const p of absRingPos(f)) supWave(f, p.x, p.y, 170, SD(L, P) * 0.14, ABS.WHITE, { speed: 600, w: 14, force: 260, power: P }); }
  if (!FX.off) { vfx((ctx, q) => vCelestialRings(ctx, f.x, f.y, f.r * (1.6 + q * 2.4), 1 - q, q * 6, k + 2, ABS.GOLD), 0.7); FX.ring(f.x, f.y, ABS.WHITE, 340, 0.45, 10, f.r); FX.burst(f.x, f.y, ABS.GOLD, mini ? 10 : 40, 520, 6, 0.6); FX.addShake(mini ? 2 : 7); absSound('judgment', k); }
});

/* =================== SKILL 2: REALITY BREAKER =================== */
/** a distorted-reality field: slowed, scrambled movement and damage while inside; every field is drawn with its edge so it can be escaped */
function realityField(f, x, y, r, life, P, o = {}) {
  const L = absLord(f);
  return supZone(f, { custom: true, kind: 'reality', x: inArenaX(x, 30), y: inArenaY(y, 30), r, life, col: ABS.GOLD, power: P, absReality: true, seed: rand(1000) | 0, detonate: o.detonate || 0,
    onTick: (z, e, d, h) => {
      if (d > z.r + e.r * 0.3) return;
      e.st.slow = Math.max(e.st.slow, 0.3); const kk = dexp(-1.2 * h); e.vx *= kk; e.vy *= kk;
      const a = BATTLE.time * 3 + z.seed; e.vx += dcos(a) * 260 * h; e.vy += dsin(a) * 260 * h;      // the space itself drifts
      const key = e.uid; if ((z.ticks.get(key) || 0) <= BATTLE.time) { z.ticks.set(key, BATTLE.time + 0.5); dealDamage(z.owner, e, SD(L, P) * 0.1, { kind: 'skill', tag: 'zone', power: P, noCrit: true }); }
    },
    draw: (ctx, z, t) => vRealityField(ctx, z, t) });
}
GSK('ab_reality', 'control', '⌬', 'Reality Breaker', [
  'Breaks reality around the target: golden dimensional cracks, a drifting space that slows and pulls at everyone inside, and steady damage. Walk out of the edge to escape.',
  'Two broken fields, and enemies caught at the start have their movement reversed for 1 s.',
  'Three fields in a triangle that collapse at the end in golden explosions (the edge flashes 0.8 s before).'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), L = absLord(f);
  if (k === 0) realityField(f, t.x, t.y, 175, 3.5, P);
  else if (k === 1) { const a = angTo(f, t); realityField(f, t.x, t.y, 165, 3.8, P); realityField(f, t.x + dcos(a) * 200, t.y + dsin(a) * 200, 140, 3.8, P);
    for (const e of supEnemies(f)) if (len(e.x - t.x, e.y - t.y) < 190) { e.st.reverse = Math.max(e.st.reverse, 1); if (!FX.off) FX.text(e.x, e.y - e.r - 22, 'REVERSED', ABS.PURPLE, 13, { life: 0.8 }); } }
  else { const zs = []; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + rand(TAU); zs.push(realityField(f, t.x + dcos(a) * 120, t.y + dsin(a) * 120, 135, 3.4, P, { detonate: 3.4 })); }
    after(2.6, () => { if (!FX.off) for (const z of zs) FX.ring(z.x, z.y, '#ffffff', z.r, 0.8, 5, z.r * 0.95); });
    after(3.35, () => { if (!f.alive) return; for (const z of zs) { supBlast(f, z.x, z.y, 150, SD(L, P) * 0.35, { tag: 'explosion', force: 520, power: P }); if (!FX.off) { FX.burst(z.x, z.y, ABS.GOLD, 30, 460, 7, 0.6); FX.ring(z.x, z.y, ABS.WHITE, 190, 0.4, 8, 20); } } }); }
  absCombo(f, 'reality');
  if (!FX.off) { darkArena(k === 2 ? 3.4 : 3.0, '#12052a', 0.28); vfx((ctx, q) => vArenaCracks(ctx, q, k), k === 2 ? 3.4 : 3.0); FX.addShake(5); absSound('reality', k); }
});

/* =================== SKILL 3: CELESTIAL DOMINION =================== */
function absRingPos(f) {
  const D = f.sx && f.sx.dominion; if (!D) return [];
  const out = []; for (let i = 0; i < D.n; i++) { const a = D.a + i / D.n * TAU, R = f.r + D.R; out.push({ x: f.x + dcos(a) * R, y: f.y + dsin(a) * R * 0.86, a }); }
  return out;
}
GSK('ab_dominion', 'defense', '◎', 'Celestial Dominion', [
  'Three giant celestial rings orbit God of Absolute and fire golden bolts on their own; a celestial barrier blocks 30% of damage for 3 s.',
  'Four rings and a 38% barrier: the rings also catch enemy projectiles that touch them (up to 3).',
  'Six enormous rings fire one synchronised volley every 1.9 s and catch up to 4 projectiles; 38% barrier.'],
(f, s, P) => {
  const k = gk(f);
  sx(f).dominion = { k, P, t: 0, life: [5, 6, 6][k], n: [3, 4, 6][k], R: [62, 72, 92][k], a: 0, cd: 0.6, sync: 1.9, blocks: [0, 3, 4][k] };
  f.st.shield = Math.max(f.st.shield, 3); f.st.shieldPow = Math.max(f.st.shieldPow, [0.3, 0.38, 0.38][k]);
  absCombo(f, 'dominion');
  if (!FX.off) { FX.ring(f.x, f.y, ABS.GOLD, f.r * 3, 0.5, 8, f.r); absSound('rings', k); }
}, true);

/* =================== SKILL 4: INFINITY ERASURE =================== */
GSK('ab_erasure', 'ranged', '◉', 'Infinity Erasure', [
  'Compresses cosmic energy into a sphere (a golden warning line shows where it will go), then fires it forward; it explodes on impact. Step off the line to dodge it.',
  'The sphere pierces through its first target and sheds five golden fragments that home in.',
  'A compressed erasure beam runs along the warning line first, then the sphere detonates at its end in a much larger blast.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), L = absLord(f), mini = !!f.absCopy, m = mini ? 0.3 : 1, a = aimAngle(f, t, 480);
  f.casting = [0.75, 0.7, 0.75][k]; const warn = f.casting;
  if (!FX.off) { const x0 = f.x, y0 = f.y, end = rayToWall(x0, y0, a); vfx((ctx, q) => vEraseWarn(ctx, f, a, end, q, k), warn, { keep: true }); absSound('charge', k); }
  f.castFn = () => {
    if (!f.alive) return;
    const boomR = k === 2 ? 220 : 150, boomD = k === 2 ? 0.6 : 0.6;
    const blow = p => { if (p.data && p.data.done) return; if (p.data) p.data.done = true;
      let r = boomR, d = boomD;
      // Lv 60 combination: an erasure that blows up inside a Reality Breaker field collapses that reality (bigger blast, pulls enemies in)
      if (!mini && absLv(f) >= ABS.COMBO_LV && BATTLE.zones.some(z => z.absReality && z.owner === f && len(z.x - p.x, z.y - p.y) < z.r + 40)) { r += 70; d += 0.08; absComboFx(f, 'REALITY COLLAPSE'); for (const e of supEnemies(f)) if (len(e.x - p.x, e.y - p.y) < r + 120) knock(e, p.x + (p.x - e.x), p.y + (p.y - e.y), 420); }
      supBlast(f, p.x, p.y, r, SD(L, P) * d * m, { tag: 'explosion', force: 640, power: P });
      if (!FX.off) { FX.burst(p.x, p.y, ABS.GOLD, mini ? 14 : 60, 620, 8, 0.8); FX.ring(p.x, p.y, ABS.WHITE, r * 1.2, 0.5, 10, 20); FX.ring(p.x, p.y, ABS.PURPLE, r * 0.8, 0.6, 6, 10); FX.addShake(mini ? 3 : 12); FX.addFlash(mini ? 0.04 : 0.12, ABS.GOLD); absSound('boom'); } };
    if (k === 2 && !mini) { const end = rayToWall(f.x, f.y, a); addLaser(f, [f.x, f.y, end.x, end.y], { charge: 0.05, dur: 0.3, w: 30, dmg: SD(L, P) * 0.35, col: ABS.WHITE }); }
    const sp = supShot(f, f.x + dcos(a) * (f.r + 10), f.y + dsin(a) * (f.r + 10), a, { speed: k === 2 ? 620 : 470, r: mini ? 12 : 24, dmg: SD(L, P) * 0.2 * m, col: ABS.GOLD, style: 'erasure', power: P, life: 2.4,
      pierce: k === 1 ? 1 : 0, data: { done: false, shed: false }, onEnd: blow,
      onHit: p => { if (k === 1 && !mini && !p.data.shed) { p.data.shed = true; for (let i = 0; i < 5; i++) supShot(f, p.x, p.y, p.vx ? datan2(p.vy, p.vx) + (i - 2) * 0.5 : i, { speed: 360, r: 6, dmg: SD(L, P) * 0.09, col: ABS.GOLD, style: 'celestialbolt', homing: 3.2, power: P, life: 1.8 }); return; } blow(p); } });
    absCombo(f, 'erasure');
    if (!FX.off) { FX.burst(f.x, f.y, ABS.WHITE, 24, 400, 5, 0.4); absSound('erase', k); }
  };
});

/* =================== SKILL 5: DIVINE REPLICATION =================== */
/** temporary spherical copies of God of Absolute: they move in formation, copy Judgment and Erasure, and vanish on their own.
    Copies are battle-only fighters (no ownership, no rewards); the cap is enforced every cast, so they can never multiply. */
function absCopyCap(f) { return Math.min(3, [2, 2, 3][gk(f)] + (absLv(f) >= ABS.REPLICA_LV ? 1 : 0)); }    // never more than 3 copies
function summonAbsCopy(f, life, i, n) {
  const a = i / n * TAU, c = new Fighter(f.baseDef, { team: f.team, clone: true, owner: f, level: f.level, evo: 0, allUnlocked: true, x: inArenaX(f.x + dcos(a) * 110, 40), y: inArenaY(f.y + dsin(a) * 110, 40), angle: a, life, rScale: 0.62, statMul: gk(f) ? 0.34 : 0.32 });
  c.maxHp = c.hp = Math.max(10, Math.round(f.maxHp * 0.08)); c.godUsed = true; c.st.invuln = 0.4; c.absCopy = true; c.absSlot = i; c.dim = f.dim || 0; c.form = f.form; c.def = f.def;
  c.ai = new AIController(c, 'aggressive', 'hard'); BATTLE.fighters.push(c);
  if (!FX.off) { FX.burst(c.x, c.y, ABS.GOLD, 18, 300, 5, 0.5); FX.ring(c.x, c.y, ABS.WHITE, c.r * 2.4, 0.4, 5, c.r); }
  return c;
}
GSK('ab_replica', 'summon', '❂', 'Divine Replication', [
  'Creates two spherical copies of God of Absolute for 6 s. They circle it in formation and repeat its Judgment and Erasure at reduced power.',
  'Two copies for 7 s that hit harder (+1 copy from Lv 80).',
  'Three copies for 8 s; when a copy fades it releases a small judgment wave (Lv 80: they also shoot celestial bolts).'],
(f, s, P) => {
  if (f.absCopy || !f.baseDef || f.baseDef.id !== ABS.id) return false;      // only God of Absolute itself can replicate (a copied skill does nothing)
  const k = gk(f), cap = absCopyCap(f), have = absCopies(f), life = [6, 7, 8][k];
  for (const c of have) c.life = Math.max(c.life, life);                  // re-cast refreshes the copies that exist …
  const n = cap - have.length; if (n <= 0) { if (have.length) { absSay(f, 'REPLICAS RENEWED', ABS.WHITE, 14); return; } return false; }   // … never more than the cap
  for (let i = 0; i < n; i++) summonAbsCopy(f, life, have.length + i, cap);
  absCombo(f, 'replica');
  if (!FX.off) { absSay(f, 'DIVINE REPLICATION', ABS.WHITE, 16); absSound('replica', k); }
}, true);

/* during the first part of the ultimate God of Absolute holds still in the air */
SUP.steerHooks.push(f => { if (f.sx && f.sx.absUltT > 0 && f.casting > 0) { f.steerPow = 0; f.vx *= 0.8; f.vy *= 0.8; } });
/* copies keep formation around their original (synchronised movement) */
SUP.steerHooks.push(f => {
  if (!f.absCopy || !f.owner || !f.owner.alive) return;
  const o = f.owner, n = Math.max(1, absCopyCap(o)), a = BATTLE.time * 1.7 + f.absSlot / n * TAU, R = o.r + 95;
  const tx = inArenaX(o.x + dcos(a) * R, 30), ty = inArenaY(o.y + dsin(a) * R, 30), dx = tx - f.x, dy = ty - f.y, d = len(dx, dy) || 1;
  f.steerX = dx / d; f.steerY = dy / d; f.steerPow = Math.max(f.steerPow || 0, 300 + Math.min(900, d * 6));
});
/* copies repeat the eligible attacks (Judgment, Erasure) of their original, weaker; nothing else is copied */
const ABS_MIMIC = ['ab_judgment', 'ab_erasure'];
function absMimic(f, type, P) {
  for (const c of absCopies(f)) {
    const fn = SKILL_FN[type]; if (!fn || !c.alive) continue;
    const tgt = nearestEnemy(c); if (type === 'ab_erasure' && !tgt) continue;
    try { fn(c, { type, power: P }, P, ABS.GOLD, tgt); } catch (e) { /* a copy never breaks the battle */ }
  }
}
/* when copies fade: a small judgment (final form), and Lv 80 copies shoot celestial bolts while they live */
SUP.worldHooks.push((B, h) => {
  for (const c of B.fighters) {
    if (!c.absCopy) continue;
    const o = c.owner;
    if (!c.alive || !o || !o.alive) { if (!c.absFaded) { c.absFaded = true; if (o && o.alive && gk(o) === 2) { supWave(o, c.x, c.y, 150, SD(o, 70) * 0.08, ABS.WHITE, { speed: 560, w: 12, force: 220, power: 70 }); } } continue; }
    if (c.life < 0.05) { c.absFaded = true; if (gk(o) === 2) supWave(o, c.x, c.y, 150, SD(o, 70) * 0.08, ABS.WHITE, { speed: 560, w: 12, force: 220, power: 70 }); }
    if (absLv(o) >= ABS.REPLICA_LV && (c.absBoltT = (c.absBoltT ?? 1.5) - h) <= 0) { c.absBoltT = 1.5; const e = nearestEnemy(c); if (e && len(e.x - c.x, e.y - c.y) < 520) supShot(c, c.x, c.y, angTo(c, e), { speed: 560, r: 6, dmg: SD(o, 70) * 0.04, col: ABS.WHITE, style: 'celestialbolt', homing: 2.4, power: 70, life: 1.6 }); }
  }
});

/* =================== CELESTIAL DOMINION rings (world) =================== */
SUP.worldHooks.push((B, h) => {
  for (const f of B.fighters) {
    const D = f.alive && f.sx && f.sx.dominion; if (!D) continue;
    D.t += h; D.a += h * (D.k === 2 ? 0.9 : 1.3); if (D.t >= D.life) { f.sx.dominion = null; continue; }
    const pos = absRingPos(f), es = supEnemies(f), L = f;
    // catch enemy projectiles that touch a ring (Awakened / Final forms)
    if (D.blocks > 0) for (let i = B.projs.length - 1; i >= 0 && D.blocks > 0; i--) { const p = B.projs[i]; if (p.team === f.team || (p.dim || 0) !== (f.dim || 0)) continue;
      for (const q of pos) if (dist2(p.x, p.y, q.x, q.y) < (26 + (p.r || 8)) ** 2) { B.projs.splice(i, 1); D.blocks--; if (!FX.off) { FX.ring(q.x, q.y, ABS.WHITE, 40, 0.3, 4, 6); FX.sparks(q.x, q.y, ABS.GOLD, 8, 300); } break; } }
    if (!es.length) continue;
    const fire = q => { let best = null, bd = 560 * 560; for (const e of es) { const d2 = dist2(e.x, e.y, q.x, q.y); if (d2 < bd) { bd = d2; best = e; } } if (!best) return; supShot(f, q.x, q.y, datan2(best.y - q.y, best.x - q.x), { speed: 640, r: 6, dmg: SD(L, D.P) * (D.k === 2 ? 0.07 : 0.09), col: ABS.GOLD, style: 'celestialbolt', homing: 1.8, target: best, power: D.P, life: 1.6 }); };
    if (D.k === 2) { if ((D.sync -= h) <= 0) { D.sync = 1.9; pos.forEach(fire); if (!FX.off) FX.text(f.x, f.y - f.r - 30, 'DOMINION VOLLEY', ABS.GOLD, 13, { life: 0.6 }); } }
    else if ((D.cd -= h) <= 0) { D.cd = D.k ? 0.5 : 0.6; fire(pos[Math.floor(D.t * 7) % pos.length]); }
  }
});

/* =================== ULTIMATES =================== */
/** ABSOLUTE ZERO – END OF ALL DIMENSIONS (and, in the final form, OMNIVERSAL ABSOLUTE DOMINION).
    Fixed cinematic order: stop → lights dim → celestial symbols → giant rings → the ball rises → a cosmic sphere forms →
    dimensional distortion → coordinated divine attack → massive explosion → the arena's light comes back. Nothing in the arena is changed for good. */
function absoluteUlt(f, P, col, dmg, omni) {
  const D = ultDurOf(f) + (omni ? 0.6 : 0), T = x => x * D / 3.4, L = f;
  f.vx = f.vy = 0; f.casting = T(1.2); f.castFn = () => {}; f.st.invuln = Math.max(f.st.invuln, T(1.2));   // 1. God of Absolute stops moving (and is out of reach while it rises)
  const s = sx(f); s.liftT = T(2.9); s.absUltT = D; s.absUltMax = D; s.absOmni = !!omni;
  const nodes = []; const n = omni ? 8 : 6;
  for (let i = 0; i < n; i++) { const a = i / n * TAU - HPI; nodes.push(omni ? { x: inArenaX(ARENA.cx + dcos(a) * ARENA.w * 0.44, 40), y: inArenaY(ARENA.cy + dsin(a) * ARENA.h * 0.42, 40) } : { x: inArenaX(f.x + dcos(a) * 210, 40), y: inArenaY(f.y + dsin(a) * 210, 40) }); }
  if (!FX.off) {
    darkArena(D, '#020108', omni ? 0.72 : 0.62);                                     // 2. the arena lighting gradually dims (and returns at the end)
    FX.text(ARENA.cx, ARENA.y + 70, omni ? '✦ OMNIVERSAL ABSOLUTE DOMINION ✦' : 'ABSOLUTE ZERO', omni ? '#ffffff' : ABS.GOLD, omni ? 36 : 46, { life: 2.8, vy: 0, pop: 2, stroke: '#0b0618' });
    if (!omni) FX.text(ARENA.cx, ARENA.y + 116, '— END OF ALL DIMENSIONS —', ABS.WHITE, 20, { life: 2.6, vy: 0 });
    vfx((ctx, q) => vAbsoluteSequence(ctx, f, nodes, q, D, omni), D);
    camPunch(f.x, f.y, 0.1, D * 0.8); absSound('ult');
  }
  // 7. dimensional distortion: everyone else is briefly slowed (movement only)
  after(T(1.6), () => { if (!f.alive) return; for (const e of supEnemies(f)) e.st.slow = Math.max(e.st.slow, 1.0); if (!FX.off) FX.addShake(8); });
  // 8. the coordinated divine attack: every ring / node fires a beam at an enemy, in one or two synchronised volleys
  const volleys = omni ? 2 : 1;
  for (let v = 0; v < volleys; v++) after(T(2.1) + v * 0.45, () => { if (!f.alive) return; const es = supEnemies(f); if (!es.length) return;
    nodes.forEach((p, i) => { const e = es[(i + v) % es.length]; addLaser(f, [p.x, p.y, e.x, e.y], { charge: 0.3, dur: 0.35, w: omni ? 22 : 26, dmg: dmg * (omni ? 0.06 : 0.12), col: i % 2 ? ABS.WHITE : ABS.GOLD }); lastLaser().track = { tgt: e, sp: 520 }; }); });
  if (!omni) after(T(2.2), () => { if (!f.alive) return; const e = nearestEnemy(f); if (!e) return;
    supShot(f, f.x, f.y - 20, angTo(f, e), { speed: 620, r: 30, dmg: dmg * 0.2, col: ABS.GOLD, style: 'erasure', homing: 2.2, target: e, power: P, life: 1.6, data: { done: false },
      onHit: p => absUltBlast(f, p.x, p.y, 300, dmg * 0.8, P, p), onEnd: p => absUltBlast(f, p.x, p.y, 300, dmg * 0.8, P, p) }); });
  // 9. a massive explosion (the final form: the whole celestial dimension converges on every enemy at once)
  else after(T(3.15), () => { if (!f.alive) return;
    for (const e of supEnemies(f)) { dealDamage(f, e, dmg * 0.55, { kind: 'skill', tag: 'explosion', power: P }); knock(e, ARENA.cx, ARENA.cy, 820); }
    if (!FX.off) { FX.addFlash(0.5, '#ffffff'); FX.addShake(24); for (let i = 0; i < 6; i++) FX.ring(ARENA.cx, ARENA.cy, i % 2 ? ABS.GOLD : ABS.WHITE, 320 + i * 160, 0.9, 16, 30); FX.burst(ARENA.cx, ARENA.cy, ABS.GOLD, 140, 1100, 9, 1.3); absSound('boom'); } });
  // 10. restore: the dimming ends with the sequence; nothing it created stays behind
  after(D, () => { if (f.sx) { f.sx.absUltT = 0; f.sx.liftT = 0; } });
}
function absUltBlast(f, x, y, r, dmg, P, p) {
  if (p.data.done) return; p.data.done = true;
  supBlast(f, x, y, r, dmg, { tag: 'explosion', force: 900, power: P });
  if (!FX.off) { FX.addFlash(0.4, ABS.GOLD); FX.addShake(20); for (let i = 0; i < 5; i++) FX.ring(x, y, i % 2 ? ABS.WHITE : ABS.GOLD, 260 + i * 120, 0.8, 14, 24); FX.burst(x, y, ABS.GOLD, 110, 960, 9, 1.2); absSound('boom'); }
}
UL('ab_zero', 'Absolute Zero – End of All Dimensions — the arena dims, celestial symbols and giant rings appear, the ball rises over a forming cosmic sphere, reality distorts, every ring fires at once and the sphere ends in a massive explosion', (f, P, col, dmg) => absoluteUlt(f, P, col, dmg, false));
UL('ab_omni', 'Omniversal Absolute Dominion — an interconnected celestial dimension surrounds the battlefield; eight linked nodes fire two synchronised volleys and the whole dimension converges on every enemy', (f, P, col, dmg) => absoluteUlt(f, P, col, dmg, true));

/* AI: when each skill is worth using (used by the computer and by AUTO mode) */
Object.assign(SUP.scoreFn, {
  ab_judgment: (ai, s, c) => c.d < 330 ? 0.95 : c.d < 420 ? 0.4 : 0.1,
  ab_replica: (ai, s, c) => absCopies(ai.f).length < absCopyCap(ai.f) ? 0.9 : 0.05,
  ab_dominion: (ai, s, c) => ai.f.sx && ai.f.sx.dominion ? 0.05 : c.th ? 1.05 : 0.75,
  ab_erasure: (ai, s, c) => c.d > 140 && c.d < 700 ? 0.85 : 0.3,
});

/* =================== THE BALL =================== */
const ABS_DEF = limitedGodBall(B(ABS.id, 'God of Absolute Ball', 'God', 'God Tier', [156, 90, 84, 80, 32],
  D(ABS.BLACK, ABS.GOLD, ABS.PURPLE, 'absolutecore', [], '', { glow: 1.8, sdeco: ['absrings', 'absfragments'], arings: 2, afrags: 5, aspheres: 0, sfx: { wave: 'triangle', pitch: 0.8 } }),
  [S('ABSOLUTE JUDGMENT', 'ab_judgment', 7, 80, ABS.GOLD), S('REALITY BREAKER', 'ab_reality', 10, 75, ABS.PURPLE), S('CELESTIAL DOMINION', 'ab_dominion', 11, 70, ABS.GOLD), S('INFINITY ERASURE', 'ab_erasure', 8, 90, ABS.WHITE), S('DIVINE REPLICATION', 'ab_replica', 14, 70, ABS.WHITE)],
  U('ABSOLUTE ZERO – END OF ALL DIMENSIONS', 'ab_zero', 115, ABS.GOLD), 'intelligent', { desc: 'LIMITED EXCLUSIVE SUPREME GOD • PHP 499. A supreme cosmic entity with absolute authority over divine energy, spatial reality and celestial power.' }), {
  godClass: 'LIMITED EXCLUSIVE SUPREME GOD', formMul: [1, 1.0, 0.96], skillK: [1.5, 0.82, 0.3], ultChargeMul: 0.65,
  forms: [{ name: 'ABSOLUTE DIVINITY' },
    { name: 'CELESTIAL SOVEREIGN', design: { c3: ABS.WHITE, arings: 3, afrags: 8, glow: 2.1, sdeco: ['absrings', 'absfragments', 'abssymbols'] } },
    { name: 'THE UNRIVALED ONE', design: { c1: '#0d0820', c2: ABS.WHITE, c3: ABS.GOLD, pat: 'absolutecore2', arings: 4, afrags: 10, aspheres: 4, glow: 2.6, sdeco: ['absrings', 'absfragments', 'abssymbols', 'absspheres', 'absstructure'] } }],
  finalUlt: U('OMNIVERSAL ABSOLUTE DOMINION', 'ab_omni', 125, '#ffffff'), sound: { base: 196, wave: 'triangle', slide: 0.6, noise: 5200 },
  passiveInfo: { name: 'ABSOLUTE AUTHORITY', desc: 'Authority over other gods: its power ignores 55% of a God Ball\'s defense, and it takes 15% less damage from God Balls. Every successful hit builds Absolute Energy (cap 100, 120 from Lv 90). At 40: abilities 10% faster. At 70: +6% attack and 8% less damage taken. Full: CELESTIAL ASCENSION for 4 s (+12% attack, abilities 20% faster), then the energy resets. Energy fades 2 s after the last hit.' },
  formPassive: ['+3 energy per hit.', '+4 energy per hit; Ascension also restores a 30% barrier.', '+5 energy per hit; Ascension also fires a celestial burst.'],
  passive: {
    init(f) { f.sx.ae = 0; },
    tick(f, dt) {
      const s = f.sx, cap = absLv(f) >= ABS.COSMIC_LV ? 120 : 100;
      if (!(s.aeIdleT > 0)) s.ae = Math.max(0, s.ae - 9 * dt);
      if (s.ae >= cap) { s.ae = 0; s.ascendT = 4;
        if (f.form >= 1) { f.st.shield = Math.max(f.st.shield, 2.5); f.st.shieldPow = Math.max(f.st.shieldPow, 0.3); }
        if (f.form === 2) for (let i = 0; i < 8; i++) supShot(f, f.x, f.y, i / 8 * TAU, { speed: 560, r: 6, dmg: SD(f, 70) * 0.04, col: ABS.WHITE, style: 'celestialbolt', homing: 2, power: 70, life: 1.5 });
        if (!FX.off) { FX.text(f.x, f.y - f.r - 44, 'CELESTIAL ASCENSION', ABS.GOLD, 20, { pop: 1.8, life: 1.2 }); FX.ring(f.x, f.y, ABS.WHITE, f.r * 3.6, 0.6, 9, f.r); FX.burst(f.x, f.y, ABS.GOLD, 40, 480, 6, 0.8); } }
      const e = s.ae; f.pCd *= 1 - (e >= 40 ? 0.1 : 0) - (s.ascendT > 0 ? 0.2 : 0); f.pAtk *= 1 + (e >= 70 ? 0.06 : 0) + (s.ascendT > 0 ? 0.12 : 0);
    },
  },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.5) { const a = vr(TAU); FX.p(f.x + Math.cos(a) * f.r * 1.5, f.y + Math.sin(a) * f.r * 1.5, Math.cos(a) * 30, Math.sin(a) * 30 - 20, 0.5, vr(2, 3.5), Math.random() < 0.6 ? ABS.GOLD : Math.random() < 0.5 ? ABS.WHITE : ABS.PURPLE, 'spark', 1); }
      if (absLv(f) >= ABS.COSMIC_LV && Math.random() < 0.35) FX.p(f.x - f.vx * 0.04 + vr(-8, 8), f.y - f.vy * 0.04 + vr(-8, 8), -f.vx * 0.1, -f.vy * 0.1, 0.7, vr(2, 4), Math.random() < 0.5 ? ABS.GOLD : ABS.WHITE, 'dot', 1.4); },
    bounce: (f, x, y, d) => { FX.sparks(x, y, ABS.GOLD, 12, 460); FX.ring(x, y, ABS.WHITE, 70, 0.3, 4, 6); },
    victory: (f, d) => { vfx((ctx, q) => vAbsoluteVictory(ctx, f, q), 2.4); FX.text(f.x, f.y - f.r - 100, f.form === 2 ? 'THE UNRIVALED ONE' : 'ABSOLUTE', ABS.GOLD, 24, { life: 2 }); absSound('transform'); },
    defeat: (f, d) => { for (let i = 0; i < 10; i++) FX.p(f.x, f.y, vr(-320, 320), vr(-420, -60), 1.3, 9, i % 2 ? ABS.GOLD : ABS.WHITE, 'shard', 1, 520); FX.burst(f.x, f.y, ABS.PURPLE, 40, 420, 5, 0.9); FX.ring(f.x, f.y, ABS.GOLD, 180, 0.8, 6, f.r); },
    entrance: f => { vfx((ctx, q) => vCelestialRings(ctx, f.x, f.y, f.r * (5 - q * 3), Math.sin(Math.PI * q), q * 8, 6, ABS.GOLD), 1.6); absSound('transform'); },
  },
});
Object.assign(ABS_DEF, { pricePhp: ABS.PRICE_PHP, edition: true, maxLevel: ABS.MAX_LEVEL, startLevel: ABS.START_LEVEL, formLevels: ABS.FORM_LEVELS, noOpponent: true, godTitle: 'THE UNRIVALED ONE',
  unlockAll: true });      // Lv 50 owners have all five skills from the start (no skill-tree slots needed)

/* Absolute Authority: every hit builds energy; at 70+ it also softens incoming hits */
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const ss = src && src.sx;
  if (ss && ss.ae != null && src.alive && o.kind !== 'dot' && src.team !== tgt.team && !(ss.aeCdT > 0)) { ss.aeCdT = 0.15; const cap = absLv(src) >= ABS.COSMIC_LV ? 120 : 100; ss.ae = Math.min(cap, ss.ae + [3, 4, 5][src.form | 0]); ss.aeIdleT = 2; }
  const ts = tgt && tgt.sx; if (ts && ts.ae >= 70 && src && src.team !== tgt.team) amt *= 0.92;
  // divine authority over other gods: against a God Ball, its power ignores part of that god's defense
  const lord = src && (src.absCopy ? src.owner : src);
  if (lord && lord.baseDef && lord.baseDef.id === ABS.id && tgt.baseDef && tgt.baseDef.forms && !o.noDef && o.kind !== 'dot') { const d = tgt.effDef() * 0.7; amt *= (70 + d) / (70 + d * (1 - ABS.GOD_PIERCE)); }
  const foeLord = src && (src.owner && (src.minion || src.absCopy || src.voidCopy) ? src.owner : src);
  if (tgt.baseDef && tgt.baseDef.id === ABS.id && !tgt.isClone && foeLord && foeLord.baseDef && foeLord.baseDef.forms && foeLord.baseDef.id !== ABS.id) amt *= 1 - ABS.GOD_RESIST;
  return amt;
});
/* copies repeat Judgment and Erasure (hooked after the skill runs, only for the original) */
{
  for (const type of ABS_MIMIC) { const fn = SKILL_FN[type]; SKILL_FN[type] = function (f, s, P, col, tgt) { const r = fn(f, s, P, col, tgt); if (r !== false && !f.absCopy && f.sx && absCopies(f).length) after(0.12, () => { if (f.alive) absMimic(f, type, P); }); return r; }; }
}
/* =====================================================================
   2.4.0 VISUALS (visual only): God of Absolute art, celestial rings, projectiles, the Absolute Zero cinematic,
   battle entrance, golden cosmic elimination, victory. Every count scales with the graphics settings.
   ===================================================================== */
/** how much decoration to draw: Particle quality × Cinematic effects */
const absQ = () => { const S = (typeof SAVE !== 'undefined' && SAVE && SAVE.settings) || {}; return (S.particles === 'low' ? 0.45 : S.particles === 'medium' ? 0.75 : 1) * (S.cinematic === 'minimal' ? 0.35 : S.cinematic === 'reduced' ? 0.65 : 1); };
const ABS_GLYPHS = ['☉', '♁', '⚶', '✶', '⊕', '☽', '♄', '✧', '⚹', '♃', '⊛', '❂'];

Object.assign(PATTERN_FN, {
  absolutecore(g, R, d, rng) {      // a black-and-purple cosmic core, a gold equator band, divine symbols and a white-gold heart
    const gr = g.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.05, 0, 0, R); gr.addColorStop(0, '#2a1650'); gr.addColorStop(0.55, '#0e0620'); gr.addColorStop(1, '#030108'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    _stars(g, R, 46, rng, ['#ffffff', '#ffe082', '#b39ddb']);
    g.strokeStyle = rgba(ABS.GOLD, 0.95); g.lineWidth = R * 0.07; g.beginPath(); g.ellipse(0, 0, R * 0.98, R * 0.22, -0.35, 0, TAU); g.stroke();
    g.strokeStyle = rgba('#fff8e1', 0.7); g.lineWidth = R * 0.02; g.beginPath(); g.ellipse(0, 0, R * 0.98, R * 0.3, -0.35, 0, TAU); g.stroke();
    g.fillStyle = rgba(ABS.GOLD, 0.95); g.font = `bold ${Math.round(R * 0.16)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.save(); g.translate(Math.cos(a) * R * 0.64, Math.sin(a) * R * 0.64); g.rotate(a + Math.PI / 2); g.fillText(ABS_GLYPHS[i], 0, 0); g.restore(); }
    for (let i = 0; i < 3; i++) { g.strokeStyle = rgba(i === 1 ? '#ffffff' : ABS.GOLD, 0.6); g.lineWidth = R * 0.018; g.beginPath(); g.arc(0, 0, R * (0.4 + i * 0.07), 0, TAU); g.stroke(); }
    _blob(g, 0, 0, R * 0.42, ABS.GOLD, 0.95); _blob(g, 0, 0, R * 0.22, '#ffffff', 1);
  },
  absolutecore2(g, R, d, rng) {     // the Unrivaled One: white-gold radiance over the cosmic core
    PATTERN_FN.absolutecore(g, R, d, rng);
    const gr = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R); gr.addColorStop(0, 'rgba(255,253,231,.55)'); gr.addColorStop(0.6, 'rgba(255,213,79,.12)'); gr.addColorStop(1, 'rgba(255,213,79,0)'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.strokeStyle = rgba('#ffffff', 0.85); g.lineWidth = R * 0.025; g.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * TAU, rr = k % 2 ? R * 0.3 : R * 0.48; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke();
    _blob(g, 0, 0, R * 0.3, '#ffffff', 1);
  },
});
for (const p of ['absolutecore', 'absolutecore2']) if (!PATTERNS.includes(p)) PATTERNS.push(p);

/** tilted golden celestial rings with tick marks (also used for skills and the ultimate) */
function vCelestialRings(ctx, x, y, R, a, t, n, col) {
  if (a <= 0.01 || R <= 1) return; const q = absQ(); n = Math.max(1, Math.round(n * Math.max(0.5, q)));
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { ctx.save(); ctx.rotate(t * (i % 2 ? -0.4 : 0.5) + i * 0.7); ctx.scale(1, 0.38 + 0.12 * (i % 3));
    ctx.strokeStyle = rgba(i % 2 ? '#ffffff' : col, 0.85); ctx.lineWidth = 3 / (0.4 + 0.12 * (i % 3)) * 0.5; ctx.beginPath(); ctx.arc(0, 0, R * (1 - i * 0.07), 0, TAU); ctx.stroke();
    ctx.fillStyle = col; for (let k = 0; k < 12; k++) { const b = k / 12 * TAU; ctx.fillRect(Math.cos(b) * R * (1 - i * 0.07) - 2, Math.sin(b) * R * (1 - i * 0.07) - 2, 4, 4); }
    ctx.restore(); }
  ctx.restore();
}
/** one divine fragment (a faceted golden shard) */
function vFragment(ctx, x, y, s, rot, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.55, 0); ctx.lineTo(0, s * 0.9); ctx.lineTo(-s * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.55, 0); ctx.lineTo(0, 0); ctx.fill(); ctx.restore(); }

Object.assign(SUP.deco, {
  absrings(ctx, r, d, t, front) {          // rotating golden celestial rings (front and back halves for depth)
    const n = d.arings || 2;
    for (let i = 0; i < n; i++) { ctx.save(); ctx.rotate(-0.4 + i * 0.75 + t * 0.12 * (i % 2 ? -1 : 1)); const rr = r * (1.42 + i * 0.16), sq = 0.3 + 0.07 * i;
      ctx.strokeStyle = rgba(i % 2 ? d.c2 : ABS.GOLD, front ? 0.95 : 0.45); ctx.lineWidth = Math.max(1.5, r * (0.06 - i * 0.008));
      ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * sq, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
      if (front) { const b = t * (1.2 + i * 0.3); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(Math.cos(b) * rr, Math.abs(Math.sin(b)) * rr * sq, Math.max(1.5, r * 0.05), 0, TAU); ctx.fill(); }
      ctx.restore(); }
  },
  absfragments(ctx, r, d, t, front) {      // floating golden fragments
    const n = Math.max(2, Math.round((d.afrags || 5) * absQ()));
    for (let i = 0; i < n; i++) { const a = t * 0.7 + i / n * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; vFragment(ctx, Math.cos(a) * r * 1.85, sn * r * 0.75 - r * 0.1 * Math.sin(t * 2 + i), r * 0.13, t * 2 + i, i % 3 ? ABS.GOLD : '#fff8e1'); }
  },
  abssymbols(ctx, r, d, t, front) {        // a slowly turning sigil of divine symbols behind the ball
    if (front) return; ctx.save(); ctx.rotate(t * 0.25); ctx.globalAlpha = 0.75; ctx.strokeStyle = rgba(ABS.GOLD, 0.7); ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath(); ctx.arc(0, 0, r * 2.15, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 1.95, 0, TAU); ctx.stroke();
    ctx.fillStyle = ABS.GOLD; ctx.font = `bold ${Math.max(9, Math.round(r * 0.28))}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.save(); ctx.translate(Math.cos(a) * r * 2.05, Math.sin(a) * r * 2.05); ctx.rotate(a + Math.PI / 2); ctx.fillText(ABS_GLYPHS[i], 0, 0); ctx.restore(); }
    ctx.restore();
  },
  absspheres(ctx, r, d, t, front) {        // small orbiting celestial spheres
    const n = d.aspheres || 0; for (let i = 0; i < n; i++) { const a = -t * 0.9 + i / n * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; const x = Math.cos(a) * r * 2.3, y = sn * r * 0.9, s = r * 0.2;
      ctx.drawImage(glowSprite(i % 2 ? '#ffffff' : ABS.GOLD), x - s * 2.4, y - s * 2.4, s * 4.8, s * 4.8); const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.1, x, y, s); g.addColorStop(0, '#ffffff'); g.addColorStop(1, i % 2 ? '#b39ddb' : ABS.GOLD); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
  },
  absstructure(ctx, r, d, t, front) {      // the final form's advanced floating structure: a great halo with eight spires
    if (front) return; ctx.save(); ctx.rotate(-t * 0.15); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(ABS.GOLD), -r * 3.2, -r * 3.2, r * 6.4, r * 6.4); ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = Math.max(1.5, r * 0.04); ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(ABS.GOLD, 0.9); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(r * 2.45, -r * 0.08); ctx.lineTo(r * 3.05, 0); ctx.lineTo(r * 2.45, r * 0.08); ctx.fill(); ctx.restore(); }
    ctx.restore();
  },
});
SUP.projStyles = Object.assign(SUP.projStyles || {}, {
  celestialbolt(ctx, p, t, r, a) { ctx.drawImage(glowSprite(p.col), p.x - r * 2.8, p.y - r * 2.8, r * 5.6, r * 5.6); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
    const g = ctx.createLinearGradient(-r * 6, 0, r, 0); g.addColorStop(0, rgba(ABS.GOLD, 0)); g.addColorStop(1, rgba(ABS.GOLD, 0.9)); ctx.fillStyle = g; ctx.fillRect(-r * 6, -r * 0.35, r * 6, r * 0.7);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(0, -r * 0.7); ctx.lineTo(-r * 0.8, 0); ctx.lineTo(0, r * 0.7); ctx.fill(); ctx.restore(); },
  erasure(ctx, p, t, r) { ctx.drawImage(glowSprite(ABS.GOLD), p.x - r * 3, p.y - r * 3, r * 6, r * 6);
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.1, p.x, p.y, r); g.addColorStop(0, '#000000'); g.addColorStop(0.6, '#1a0a33'); g.addColorStop(1, ABS.GOLD); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.05, t * 6, t * 6 + 4); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = t * 4 + i / 4 * TAU; vFragment(ctx, p.x + Math.cos(a) * r * 1.5, p.y + Math.sin(a) * r * 1.5, r * 0.28, a, ABS.GOLD); } },
});
{ const _dws = drawWaveStyle;      // the judgment wave: a double golden ring with divine marks
  drawWaveStyle = function (ctx, w) {
    if (w.style !== 'judgment') return _dws(ctx, w);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(w.col, 0.35); ctx.lineWidth = w.w * 2.2; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fffde7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(w.col, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w.x, w.y, w.r * 0.9, 0, TAU); ctx.stroke();
    ctx.fillStyle = w.col; const n = 16; for (let i = 0; i < n; i++) { const a = i / n * TAU + w.r * 0.004; ctx.fillRect(w.x + Math.cos(a) * w.r - 2.5, w.y + Math.sin(a) * w.r - 2.5, 5, 5); }
    ctx.restore();
  };
}

/** a Reality Breaker field (ctx is already at the field's centre): broken space, golden cracks and a bright edge you can escape through */
function vRealityField(ctx, z, t) {
  const r = z.r, rng = mulberry32(1000 + z.seed);
  const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r); g.addColorStop(0, 'rgba(40,10,80,.45)'); g.addColorStop(0.8, 'rgba(20,6,40,.35)'); g.addColorStop(1, 'rgba(255,213,79,.12)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(ABS.GOLD, 0.85); ctx.lineWidth = 2;
  for (let i = 0; i < Math.round(7 * Math.max(0.5, absQ())); i++) { let x = 0, y = 0, a = rng() * TAU; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 5; k++) { a += (rng() - 0.5) * 1.1; const L = r * (0.12 + rng() * 0.14); x += Math.cos(a) * L; y += Math.sin(a) * L; ctx.lineTo(x, y); } ctx.stroke(); }
  for (let i = 0; i < 3; i++) { const rr = r * (((t * 0.6 + i / 3) % 1)); ctx.strokeStyle = rgba('#b388ff', 0.35 * (1 - rr / r)); ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = rgba(z.detonate && z.life < 0.8 ? '#ffffff' : ABS.GOLD, 0.9); ctx.lineWidth = 3; ctx.setLineDash([14, 8]); ctx.lineDashOffset = -t * 40; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
}
/** Reality Breaker: the whole arena tints and cracks for a moment, then returns to normal */
function vArenaCracks(ctx, q, k) {
  const a = Math.min(1, q * 6, (1 - q) * 5) * 0.55 * absQ(); if (a <= 0.01) return;
  const rng = mulberry32(77 + k); ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = ABS.GOLD; ctx.lineWidth = 1.6;
  for (let i = 0; i < 10; i++) { let x = ARENA.x + rng() * ARENA.w, y = ARENA.y + rng() * ARENA.h, an = rng() * TAU; ctx.beginPath(); ctx.moveTo(x, y); for (let s = 0; s < 6; s++) { an += (rng() - 0.5); x += Math.cos(an) * 40; y += Math.sin(an) * 40; ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.restore();
}
/** Infinity Erasure warning: a golden line with moving chevrons and a charging sphere */
function vEraseWarn(ctx, f, a, end, q, k) {
  if (!f.alive) return; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(k === 2 ? '#ffffff' : ABS.GOLD, 0.35 + 0.5 * q); ctx.lineWidth = k === 2 ? 30 * q + 2 : 3; ctx.setLineDash(k === 2 ? [] : [16, 10]); ctx.lineDashOffset = -q * 80;
  ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
  const L = len(end.x - f.x, end.y - f.y); ctx.fillStyle = rgba(ABS.GOLD, 0.8);
  for (let d = (q * 120) % 60 + 40; d < L; d += 60) { const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -7); ctx.lineTo(-4, 7); ctx.fill(); ctx.restore(); }
  const R = f.r * (0.4 + q * 0.9); ctx.drawImage(glowSprite(ABS.GOLD), f.x - R * 2, f.y - R * 2, R * 4, R * 4);
  for (let i = 0; i < 6; i++) { const b = i / 6 * TAU + q * 5, rr = f.r * (2.6 - q * 1.8); vFragment(ctx, f.x + Math.cos(b) * rr, f.y + Math.sin(b) * rr, 6, b, ABS.GOLD); }
  ctx.restore();
  if (q > 0.5 && Math.floor(q * 10) % 2) { ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', end.x - Math.cos(a) * 20, end.y - Math.sin(a) * 20); }
}
/** ABSOLUTE ZERO / OMNIVERSAL DOMINION: symbols → rings → rising ball over a forming sphere → distortion → (attack) → light returns */
function vAbsoluteSequence(ctx, f, nodes, q, D, omni) {
  const tt = q * 3.4, Q = absQ(), x = f.x, y = f.y;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (omni) {        // the interconnected celestial dimension around the battlefield
    const a = Math.min(1, tt * 1.5, (3.4 - tt) * 2.5); ctx.globalAlpha = clamp(a, 0, 1);
    const rng = mulberry32(4242); for (let i = 0; i < Math.round(120 * Q); i++) { const sx = ARENA.x + rng() * ARENA.w, sy = ARENA.y + rng() * ARENA.h; ctx.fillStyle = i % 4 ? 'rgba(255,255,255,.7)' : rgba(ABS.GOLD, 0.9); ctx.fillRect(sx, sy, 2, 2); }
    ctx.strokeStyle = rgba(ABS.GOLD, 0.55); ctx.lineWidth = 1.5; ctx.beginPath(); nodes.forEach((p, i) => { const n2 = nodes[(i + 1) % nodes.length], n3 = nodes[(i + 3) % nodes.length]; ctx.moveTo(p.x, p.y); ctx.lineTo(n2.x, n2.y); ctx.moveTo(p.x, p.y); ctx.lineTo(n3.x, n3.y); }); ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.4); ctx.beginPath(); for (const p of nodes) { ctx.moveTo(p.x, p.y); ctx.lineTo(x, y); } ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (tt > 0.25) {   // 3. golden celestial symbols appear
    const a = Math.min(1, (tt - 0.25) * 2, (3.4 - tt) * 2.5); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = ABS.GOLD; ctx.font = 'bold 26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) { const b = i / 12 * TAU + tt * 0.3; ctx.fillText(ABS_GLYPHS[i], x + Math.cos(b) * 150, y + Math.sin(b) * 150); }
    ctx.globalAlpha = 1;
  }
  if (tt > 0.5) {    // 4. giant celestial rings emerge (around the ball, and at every node)
    const a = Math.min(1, (tt - 0.5) * 2, (3.4 - tt) * 2.5);
    vCelestialRings(ctx, x, y - 30, 120 + Math.min(1, tt - 0.5) * 90, a, tt, 5, ABS.GOLD);
    for (const p of nodes) vCelestialRings(ctx, p.x, p.y, 34 + Math.min(1, tt - 0.5) * 16, a, tt * 1.3, 2, ABS.GOLD);
  }
  if (tt > 0.9 && tt < 2.45) {    // 6. a giant cosmic sphere forms above the risen ball
    const g = Math.min(1, (tt - 0.9) / 1.2), R = 20 + g * (omni ? 90 : 70), sy = y - 120;
    ctx.drawImage(glowSprite(ABS.GOLD), x - R * 2.6, sy - R * 2.6, R * 5.2, R * 5.2);
    const gr = ctx.createRadialGradient(x, sy, R * 0.1, x, sy, R); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, '#2a1650'); gr.addColorStop(1, ABS.GOLD); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, sy, R, 0, TAU); ctx.fill();
    for (let i = 0; i < Math.round(10 * Q); i++) { const b = i / 10 * TAU + tt * 3, rr = R * (2.4 - g); vFragment(ctx, x + Math.cos(b) * rr, sy + Math.sin(b) * rr * 0.6, 7, b, ABS.GOLD); }
  }
  if (tt > 1.55 && tt < 2.2) {    // 7. dimensional distortion: ripples across the battlefield
    const k = (tt - 1.55) / 0.65; for (let i = 0; i < 3; i++) { ctx.strokeStyle = rgba(i % 2 ? '#b388ff' : '#ffffff', 0.5 * (1 - k)); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, (k + i * 0.25) * ARENA.w * 0.6, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
}
/** victory: rings rise and a crown of light forms over the ball */
function vAbsoluteVictory(ctx, f, q) {
  const x = f.x, y = f.y; vCelestialRings(ctx, x, y - q * 60, f.r * (1.8 + q), 1 - q * 0.5, q * 8, 4, ABS.GOLD);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, q * 3) * (1 - q * 0.4);
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.22; ctx.strokeStyle = rgba(i % 2 ? '#ffffff' : ABS.GOLD, 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * f.r * 1.3, y - f.r * 0.2 + Math.sin(a) * f.r * 1.3); ctx.lineTo(x + Math.cos(a) * f.r * (2.4 + (i % 2) * 0.5), y - f.r * 0.2 + Math.sin(a) * f.r * (2.4 + (i % 2) * 0.5)); ctx.stroke(); }
  ctx.restore();
}
/* battle entrance: God of Absolute descends through rings of light (visual only, once per battle) */
SUP.worldHooks.push(B => {
  if (FX.off || B.time > 0.2) return;
  for (const f of B.fighters) if (f.alive && f.baseDef && f.baseDef.id === ABS.id && !f.isClone && !f.absEntered) {
    f.absEntered = true;
    vfx((ctx, q) => { vCelestialRings(ctx, f.x, f.y, f.r * (4.5 - q * 3), Math.sin(Math.PI * q), q * 6, 5, ABS.GOLD); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - q; ctx.drawImage(glowSprite('#ffffff'), f.x - 40, f.y - 260 * (1 - q) - 40, 80, 80 + 260 * (1 - q)); ctx.restore(); }, 1.6);
    FX.text(f.x, f.y - f.r - 60, 'THE UNRIVALED ONE', ABS.GOLD, 18, { life: 1.6, pop: 1.6 });
  }
});
/* golden cosmic elimination: when God of Absolute (or an owner wearing Golden Cosmic Elimination) finishes an enemy */
SUP.deathHooks = SUP.deathHooks || [];
SUP.deathHooks.push((f, killer) => {
  if (FX.off || !killer) return; const k = absLord(killer);
  const own = (k.baseDef && k.baseDef.id === ABS.id) || (k.cos && k.cos.hit && k.cos.hit.id === 'hit_absolute'); if (!own || f.isClone) return;
  const x = f.x, y = f.y;
  vfx((ctx, q) => { vCelestialRings(ctx, x, y, 90 * (1 - q) + 10, 1 - q, q * 10, 3, ABS.GOLD); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - q; const R = 30 + q * 120; ctx.drawImage(glowSprite(ABS.GOLD), x - R, y - R, R * 2, R * 2); ctx.restore(); }, 1.0);
  FX.burst(x, y, ABS.GOLD, Math.round(50 * absQ()), 520, 6, 0.9, 'shard'); FX.burst(x, y, '#ffffff', Math.round(30 * absQ()), 380, 4, 0.7);
  FX.text(x, y - 40, 'ERASED', ABS.GOLD, 20, { life: 1.1, pop: 1.8, stroke: '#1a0f00' });
});
/* =====================================================================
   2.4.0 GOD OF ABSOLUTE — screens: the limited-edition shop card (live edition numbers, reservation, sold out),
   collection / selection / preview with the Lv 50–100 roadmap, the owner's lobby showcase, and the owner-only
   GOD OF ABSOLUTE management panel. The page only shows what the server says; it never grants anything.
   ===================================================================== */
const ABS_ROADMAP = [[50, 'Absolute Divinity — all 5 skills'], [60, 'Celestial combinations (Celestial Judgment, Reality Collapse)'], [70, 'CELESTIAL SOVEREIGN transformation'],
  [80, 'Enhanced Divine Replication (+1 copy, copies shoot)'], [90, 'Cosmic trail + Absolute Energy cap 120'], [100, 'THE UNRIVALED ONE + Omniversal Absolute Dominion']];
if (!window.NBB_HEADLESS) {
  const css = `
  .abs-card{position:relative;border-radius:16px;padding:14px;color:#fff;border:2px solid #ffd54f;background:radial-gradient(120% 140% at 50% 0%,#2a1650 0%,#0b0618 55%,#030108 100%);box-shadow:0 0 28px rgba(255,213,79,.25),inset 0 0 40px rgba(156,107,255,.15);overflow:hidden}
  .abs-card:before{content:"";position:absolute;inset:-2px;border-radius:16px;padding:2px;background:conic-gradient(from var(--abs-a,0deg),#ffd54f,#fffde7,#9c6bff,#ffd54f);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:absSpin 6s linear infinite;pointer-events:none}
  @property --abs-a{syntax:'<angle>';initial-value:0deg;inherits:false}@keyframes absSpin{to{--abs-a:360deg}}
  .abs-top{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.abs-top canvas{flex:none}
  .abs-cls{font-size:11px;font-weight:900;letter-spacing:2px;color:#ffd54f}.abs-name{font-size:24px;font-weight:900;letter-spacing:1px;background:linear-gradient(90deg,#ffd54f,#fffde7,#ffd54f);-webkit-background-clip:text;background-clip:text;color:transparent}
  .abs-title{font-size:13px;font-weight:800;color:#d1c4e9;letter-spacing:2px}
  .abs-stock{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.abs-stock span{border-radius:8px;padding:4px 10px;font-weight:900;font-size:13px;background:rgba(255,213,79,.12);border:1px solid rgba(255,213,79,.5)}
  .abs-bar{height:10px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden}.abs-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd54f,#fffde7)}.abs-bar b{display:block;height:100%;background:rgba(156,107,255,.7);float:left}
  .abs-soldout{margin:8px 0;padding:12px;border-radius:12px;text-align:center;font-weight:900;letter-spacing:1px;background:linear-gradient(90deg,#000,#2a1650,#000);border:1px solid #ffd54f;color:#ffd54f}
  .abs-road{list-style:none;padding:0;margin:6px 0;font-size:13px}.abs-road li{padding:3px 0;opacity:.6}.abs-road li.on{opacity:1;color:#ffe082}.abs-road li b{display:inline-block;width:56px}
  .abs-plate{display:inline-block;padding:2px 10px;border-radius:7px;background:linear-gradient(90deg,#000,#2a1a00 40%,#000);border:1px solid #ffd54f;color:#ffd54f;font-weight:900;font-size:11px;letter-spacing:1.5px;vertical-align:middle}
  .abs-badge{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:6px;background:#000;border:1px solid #ffd54f;color:#ffd54f;font-weight:900;font-size:11px;vertical-align:middle}
  .abs-show{margin:10px auto 0;max-width:520px;display:flex;gap:12px;align-items:center;padding:10px 14px;border-radius:14px;border:1px solid #ffd54f;background:radial-gradient(120% 140% at 0% 50%,rgba(42,22,80,.95),rgba(5,3,12,.95));cursor:pointer;color:#fff}
  .abs-show canvas{flex:none}.abs-feat{border:2px solid #ffd54f !important;box-shadow:0 0 16px rgba(255,213,79,.35)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
}
const absDef = () => getBall(ABS.id);
const absOwned = () => { const b = absDef(); return !!(b && canUseBall(b)); };
const absSerial = () => window.Online && Online.save && Online.save.editions ? Online.save.editions[ABS.id] || null : null;
const pad3 = n => String(n).padStart(3, '0');

/** the limited-edition card: real numbers from the server only */
function absShopCard(shop, o = {}) {
  const b = absDef(); if (!b) return null;
  const E = shop && shop.edition && shop.edition[ABS.id], owned = absOwned(), serial = (E && E.serial) || absSerial();
  const c = h('div', { class: 'abs-card' }), cv = ballCanvas(b, 120, { big: true }); UI.addLive(cv, b, { size: 120 });
  const lv = prog(ABS.id).level || ABS.START_LEVEL;
  c.append(h('div', { class: 'abs-top' }, cv, h('div', { style: { flex: '1', minWidth: '200px' } },
    h('div', { class: 'abs-cls' }, '👑 LIMITED EXCLUSIVE SUPREME GOD'), h('div', { class: 'abs-name' }, 'GOD OF ABSOLUTE'), h('div', { class: 'abs-title' }, 'THE UNRIVALED ONE'),
    owned ? h('div', { style: { marginTop: '6px' } }, h('span', { class: 'gshop-owned' }, serial ? `✔ OWNED — EDITION #${pad3(serial)}` : '✔ OWNED — PERMANENT'), ' ', h('span', { class: 'abs-plate' }, `Lv ${lv} / ${ABS.MAX_LEVEL}`))
      : h('div', { class: 'gshop-price', style: { marginTop: '6px' } }, 'PHP 499 ', h('small', {}, 'one-time • starts at Lv 50 • yours forever')))));
  if (E) {
    const pctO = Math.min(100, E.owners / Math.max(1, E.supply) * 100), pctR = Math.min(100 - pctO, E.reserved / Math.max(1, E.supply) * 100);
    c.append(h('div', { class: 'abs-stock' }, h('span', {}, `${E.owners} / ${E.supply} verified owners`), h('span', {}, `${E.available} available now`),
      E.reserved ? h('span', {}, `${E.reserved} reserved by players paying right now`) : null, E.edition > 1 ? h('span', {}, `Edition ${E.edition}`) : null),
      h('div', { class: 'abs-bar', title: 'gold = verified owners, purple = reserved' }, h('i', { style: { width: pctO + '%', float: 'left' } }), h('b', { style: { width: pctR + '%' } })));
    if (E.announcement) c.append(h('div', { class: 'gshop-note', style: { marginTop: '8px' } }, '📢 ' + E.announcement));
    if (E.soldOut && !owned) c.append(h('div', { class: 'abs-soldout' }, E.soldOutText || 'SOLD OUT – THE ABSOLUTE ERA IS COMPLETE.'));
    else if (!E.open && !owned) c.append(h('div', { class: 'gshop-note' }, '⏸ New purchases are paused by the game owner.'));
    if (E.mine && !owned) c.append(h('div', { class: 'gshop-note gshop-wait', style: { marginTop: '8px' } }, E.mine.status === 'awaiting' ? '⏳ Your payment is waiting for the owner\'s check. Your slot is kept for you.' : `⏳ You have a slot reserved until ${new Date(E.mine.holdUntil).toLocaleTimeString()}.`));
  }
  c.append(h('small', { class: 'muted', style: { display: 'block', marginTop: '8px' } }, b.desc),
    h('ul', { class: 'abs-road' }, ...ABS_ROADMAP.map(([l, t]) => h('li', { class: owned && lv >= l ? 'on' : '' }, h('b', {}, (owned && lv >= l ? '✔ ' : '') + 'Lv ' + l), t))),
    h('small', { class: 'muted', style: { display: 'block' } }, '◆ ' + b.passiveInfo.name + ' • 👑 Owner rewards: THE ABSOLUTE OWNER title & black-gold nameplate, profile emblem, lobby showcase, celestial aura & trail, golden cosmic elimination, Absolute Ascension victory.'));
  const row = h('div', { class: 'gshop-row', style: { marginTop: '10px' } });
  const blocked = E && (E.soldOut || !E.open || (E.mine && E.mine.status === 'awaiting'));
  if (!owned && !o.noBuy) row.append(h('button', { class: 'btn gold', disabled: !(shop && shop.enabled) || blocked, onclick: () => godBuy(ABS.id) }, E && E.mine && E.mine.status !== 'awaiting' ? '💎 Continue paying — PHP 499' : '💎 Buy — PHP 499'));
  row.append(h('button', { class: 'btn', onclick: () => UI.openGod(ABS.id) }, '🔍 Inspect'),
    owned ? h('button', { class: 'btn primary', onclick: () => { Game.setup.ball = ABS.id; UI.show('play'); } }, '⚔ Battle') : h('button', { class: 'btn', onclick: () => Game.tryGod(ABS.id, 2) }, '▶ Free practice test'));
  c.append(row);
  return c;
}

/* buying the limited edition: QR → reserve a slot first (the server holds it while you pay); PayMongo → the checkout holds it */
{
  const _godBuy = godBuy;
  godBuy = async function (product) {
    if (product !== ABS.id) return _godBuy(product);
    if (!shopOnline()) return toast('Purchases need the online game server', 'bad');
    if (!Online.active) { toast('Sign in first — your edition is saved to your account', 'bad'); return UI.show('account'); }
    let shop = godShopCache; try { shop = godShopCache = await shopApi('GET', '/api/godshop'); } catch { /* keep the last answer */ }
    if (!shop || !shop.enabled) return toast('The shop is not open yet. Nothing was charged.', 'bad');
    const qr = shop.manual && shop.manual.enabled && shop.manual.accounts.length;
    const viaQr = async () => {
      let r; try { r = await API.post('/api/godshop/edition/reserve', { product: ABS.id }); } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); return UI.render_godshop(); }
      manualPay(ABS.id, shop, { purchaseId: r.purchaseId, holdUntil: r.holdUntil });
    };
    if (qr && shop.paymongo) return UI.modal(h('div', { class: 'gshop-pay' }, h('h2', {}, '👑 How do you want to pay?'), h('div', { class: 'gshop-tabs' },
      h('button', { class: 'btn gold', onclick: () => { UI.closeModal(); viaQr(); } }, '📱 Scan QR — Maya / MariBank / any bank app'),
      h('button', { class: 'btn', onclick: () => { UI.closeModal(); _godBuy(product); } }, '💳 Automatic checkout (PayMongo)'))));
    return qr ? viaQr() : _godBuy(product);
  };
}

/* the shop, collection, preview, selection and lobby */
{
  const rg = UI.render_godshop, gs = UI.godSection, og = UI.openGod, rf = UI.renderFeatured, rm = UI.render_menu;
  UI.render_godshop = async function () {
    await rg.call(this);
    const body = $('#godShopBody'); if (!body || !absDef()) return;
    const card = absShopCard(godShopCache); if (!card) return;
    const grid = body.querySelector('.gshop-grid'); body.insertBefore(h('div', { style: { margin: '12px 0' } }, card), grid || null);
  };
  UI.godSection = function (container) {
    gs.call(this, container); if (!absDef()) return;
    container.append(h('div', { class: 'god-sec', style: { borderColor: '#ffd54f' } }, h('div', { class: 'god-title' }, '👑 LIMITED EXCLUSIVE GOD', h('span', { class: 'god-free', style: { background: '#ffd54f' } }, 'PHP 499 • LIMITED'), h('button', { class: 'btn gold small', onclick: () => this.show('godshop') }, 'Open the shop')), absShopCard(godShopCache, { noBuy: true })));
  };
  UI.openGod = function (id, form, variant) {
    og.call(this, id, form, variant); if (id !== ABS.id) return;
    const L = document.querySelector('.god-modal .gl'); if (!L) return;
    const free = L.querySelector('.god-free'); const owned = absOwned(), lv = prog(ABS.id).level || ABS.START_LEVEL;
    if (free) { free.textContent = owned ? `✔ OWNED — Lv ${lv} / ${ABS.MAX_LEVEL}` : '👑 LIMITED EDITION — PHP 499'; free.style.background = owned ? '#00c853' : '#ffd54f'; }
    L.append(h('div', { class: 'card', style: { marginTop: '8px' } }, h('b', {}, 'Level roadmap (its own level, Lv 50 → 100)'), h('ul', { class: 'abs-road' }, ...ABS_ROADMAP.map(([l, t]) => h('li', { class: owned && lv >= l ? 'on' : '' }, h('b', {}, (owned && lv >= l ? '✔ ' : '') + 'Lv ' + l), t)))));
  };
  UI.renderFeatured = function (grid) {
    rf.call(this, grid); const b = absDef(); if (!b) return;
    const box = document.getElementById('selectPaidGods'); if (!box) return;
    const ok = canUseBall(b), cv = ballCanvas(b, 60); this.addLive(cv, b, { size: 60 });
    const row = box.querySelector('.feat-row'); if (!row) return;
    row.prepend(h('button', { class: 'feat-card abs-feat' + (Game.setup.ball === b.id ? ' selected' : '') + (ok ? '' : ' locked'), onclick: () => { if (ok) { Game.setup.ball = b.id; Sound.play('god'); this.render_select(); } else this.show('godshop'); } },
      cv, h('div', { class: 'feat-txt' }, h('small', {}, 'LIMITED EXCLUSIVE GOD'), h('b', {}, 'GOD OF ABSOLUTE'), h('span', { class: 'feat-st ' + (ok ? 'on' : 'off') }, ok ? `Lv ${prog(b.id).level} / 100` : '👑 PHP 499'))));
  };
  /* the owner's lobby showcase */
  UI.render_menu = function () {
    rm.call(this);
    const wrap = document.querySelector('#scr-menu .menu-wrap'); if (!wrap) return;
    let box = document.getElementById('absShowcase'); if (box) box.remove();
    const serial = absSerial(); if (!serial || !absOwned()) return;
    const b = absDef(), cv = ballCanvas(b, 64, { big: true }); this.addLive(cv, b, { size: 64 });
    box = h('div', { id: 'absShowcase', class: 'abs-show', onclick: () => this.openGod(ABS.id) }, cv, h('div', {},
      h('div', { class: 'abs-plate' }, '👑 THE ABSOLUTE OWNER'), h('div', { style: { fontWeight: 900, marginTop: '4px' } }, `GOD OF ABSOLUTE • EDITION #${pad3(serial)}`),
      h('small', { class: 'muted' }, `Lv ${prog(ABS.id).level} / ${ABS.MAX_LEVEL} • tap to view`)));
    const logo = wrap.querySelector('.logo'); logo ? logo.after(box) : wrap.prepend(box);
  };
}

/* ---------------- owner: GOD OF ABSOLUTE management panel (server checks owner + 2FA for every action) ---------------- */
UI.admin_absolute = async function (body) {
  const d = await API.get('/api/admin/edition'); body.innerHTML = '';
  const tbl = (cols, rows) => rows.length ? h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'gshop-tbl' }, h('tr', {}, ...cols.map(c => h('th', {}, c[0]))), ...rows.map(r => h('tr', {}, ...cols.map(c => h('td', {}, String(c[1](r) ?? '—'))))))) : h('p', { class: 'muted' }, 'Nothing yet.');
  const dt = t => t ? new Date(t).toLocaleString() : '—';
  body.append(h('div', { class: 'abs-card' }, h('div', { class: 'abs-cls' }, '👑 GOD OF ABSOLUTE — LIMITED EDITION'),
    h('div', { class: 'abs-stock' }, h('span', {}, `${d.owners.length} / ${d.supply} verified owners`), h('span', {}, `${d.available} available`), h('span', {}, `${d.reserved} reserved now`), h('span', {}, `Edition ${d.edition}`), h('span', {}, d.open ? '✔ purchases ON' : '⏸ purchases PAUSED'), d.soldOut ? h('span', {}, 'SOLD OUT') : null),
    !d.paymentsOpen.enabled ? h('div', { class: 'gshop-note' }, '⚠ No payment method is open yet: set up QR payments in the 💳 God Shop (PHP) tab first.') : null));
  // settings
  const supply = h('input', { type: 'number', min: String(Math.max(1, d.owners.length)), step: '1', value: String(d.supply), style: { width: '110px' } });
  const open = h('input', { type: 'checkbox', checked: d.open }), ann = h('input', { type: 'text', maxlength: '240', value: d.announcement || '', placeholder: 'Edition announcement shown in the shop (optional)', style: { width: '100%' } });
  const add = h('input', { type: 'number', min: '1', step: '1', value: '50', style: { width: '90px' } }), annNew = h('input', { type: 'text', maxlength: '240', placeholder: 'Announcement for the new edition', style: { width: '100%' } });
  const ult = h('input', { type: 'number', min: '2.4', max: '5', step: '0.1', value: String(d.ultDur), style: { width: '80px' } }), xp = h('input', { type: 'number', min: '0.25', max: '4', step: '0.05', value: String(d.xpMul), style: { width: '80px' } });
  body.append(h('div', { class: 'card' }, h('h3', {}, 'Edition settings'),
    h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, h('label', {}, 'Supply ', supply), h('label', { class: 'chk' }, open, ' Accept new purchases'),
      h('button', { class: 'btn gold', onclick: () => adminDo(() => API.post('/api/admin/edition/settings', { supply: +supply.value, open: open.checked, announcement: ann.value }), () => UI.render_admin()) }, '💾 Save')),
    h('div', { style: { marginTop: '8px' } }, ann),
    h('p', { class: 'muted small' }, 'The supply can never go below the verified owners. Once the edition is sold out, more slots can only be offered as an official new edition:'),
    h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, h('label', {}, 'New slots ', add), h('button', { class: 'btn', onclick: () => UI.confirm(`Release edition ${d.edition + 1} with ${esc(add.value)} new slots? This is announced in the shop.`, () => adminDo(() => API.post('/api/admin/edition/release', { add: +add.value, announcement: annNew.value || undefined }), () => UI.render_admin()), 'Release') }, '✦ Release a new edition')),
    h('div', { style: { marginTop: '6px' } }, annNew)));
  body.append(h('div', { class: 'card' }, h('h3', {}, 'Gameplay settings'), h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap', alignItems: 'center' } },
    h('label', {}, 'Ultimate duration (s) ', ult), h('label', {}, 'EXP needed above Lv 50 (×) ', xp),
    h('button', { class: 'btn', onclick: () => adminDo(() => API.post('/api/admin/edition/tuning', { ultDur: +ult.value, xpMul: +xp.value }), () => UI.render_admin()) }, '💾 Save')),
    h('p', { class: 'muted small' }, 'EXP for one level above 50 = (300 + 12 per level) × this number. Levels come only from verified battles.')));
  // 2.5.0 AUTONOMOUS WILL — only the owner can tune how it thinks; nobody can steer it in battle
  const W = { ...d.will }, off = new Set(d.off || []);
  const chk = (k, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!W[k], onchange: e => { W[k] = e.target.checked; } }), ' ' + label);
  const intel = h('select', { onchange: e => { W.intelligence = +e.target.value; } }, ...[[1, 'Calm'], [2, 'Strategic (default)'], [3, 'Supreme']].map(([v, l]) => h('option', { value: v, selected: W.intelligence === v }, l)));
  const aggV = h('b', {}, String(W.aggression)), agg = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(W.aggression), oninput: e => { W.aggression = +e.target.value; aggV.textContent = e.target.value; } });
  const realmT = h('input', { type: 'number', min: '3', max: '8', step: '0.5', value: String(W.maxRealm), style: { width: '70px' }, onchange: e => { W.maxRealm = +e.target.value; } });
  const realmCd = h('input', { type: 'number', min: '12', max: '40', step: '1', value: String(W.realmCd), style: { width: '70px' }, onchange: e => { W.realmCd = +e.target.value; } });
  const cdm = h('input', { type: 'number', min: '0.5', max: '2', step: '0.1', value: String(d.cdMul || 1), style: { width: '70px' } });
  const abil = h('div', { class: 'gshop-methods' }, ...(d.skills || []).map((n, i) => h('label', {}, h('input', { type: 'checkbox', checked: !off.has(i), onchange: e => { e.target.checked ? off.delete(i) : off.add(i); } }), ' ' + n)));
  body.append(h('div', { class: 'card' }, h('h3', {}, '🧠 Autonomous will — it makes its own decisions'),
    h('p', { class: 'muted small' }, 'Players can never steer or command God of Absolute. These owner settings shape how it thinks. They apply to every battle and are checked on the server.'),
    h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap', alignItems: 'center' } }, h('label', {}, 'Intelligence ', intel), h('label', {}, 'Aggression ', agg, ' ', aggV)),
    h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginTop: '6px' } }, chk('transcend', 'May leave the arena (Outer Realm)'), chk('hunt', 'Hunts enemies hiding outside the arena'), chk('retreat', 'Recovers in the Outer Realm when badly hurt'), chk('explore', 'Explores the Outer Realm'), chk('step', 'Divine Step teleport'), chk('speech', 'Speaks / reacts')),
    h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' } }, h('label', {}, 'Longest hunt (s) ', realmT), h('label', {}, 'Outer Realm cooldown (s) ', realmCd), h('label', {}, 'Ability cooldown × ', cdm)),
    h('div', { style: { marginTop: '6px' } }, h('b', {}, 'Abilities it may use: '), abil),
    h('button', { class: 'btn gold', style: { marginTop: '8px' }, onclick: () => adminDo(() => API.post('/api/admin/edition/tuning', { will: W, off: [...off], cdMul: +cdm.value }), () => UI.render_admin()) }, '💾 Save its will')));
  body.append(h('div', { class: 'card' }, h('h3', {}, `⏳ Pending (${d.pending.length})`), h('p', { class: 'muted small' }, 'QR payments are approved in the 💳 God Shop (PHP) tab — the approval gives the serial number, Lv 50 and the rewards.'),
    tbl([['Player', r => r.username], ['Status', r => r.status], ['Via', r => r.provider], ['Reference', r => r.reference], ['Reserved until', r => r.holdUntil ? dt(r.holdUntil) : 'until checked'], ['Created', r => dt(r.createdAt)]], d.pending)));
  body.append(h('div', { class: 'card' }, h('h3', {}, `👑 Verified owners (${d.owners.length})`), tbl([['#', r => '#' + pad3(r.serial)], ['Player', r => r.username], ['Edition', r => r.edition], ['Since', r => dt(r.granted_at)], ['Purchase', r => r.purchase_id]], d.owners)));
  body.append(h('div', { class: 'card' }, h('h3', {}, `✔ Completed transactions (${d.completed.length})`), tbl([['Paid', r => dt(r.paidAt)], ['Player', r => r.username], ['PHP', r => r.amount], ['Via', r => r.provider + (r.method ? ' / ' + r.method : '')], ['Reference', r => r.reference], ['Note', r => r.note]], d.completed)));
  body.append(h('div', { class: 'card' }, h('h3', {}, `⚠ Payment errors & refunds (${d.errors.length})`), tbl([['When', r => dt(r.createdAt)], ['Player', r => r.username], ['Status', r => r.status], ['Reference', r => r.reference], ['Note', r => r.note]], d.errors),
    d.securityEvents.length ? h('details', {}, h('summary', {}, 'Security events'), tbl([['When', r => dt(r.created_at)], ['Kind', r => r.kind], ['Level', r => r.severity]], d.securityEvents)) : null));
  body.append(h('div', { class: 'card' }, h('h3', {}, `↺ Purchase restorations (${d.restores.length})`), tbl([['When', r => dt(r.at)], ['Player', r => r.username], ['Result', r => r.event === 'restore' ? 'fixed: ' + ((r.details && r.details.fixed) || []).join(', ') : 'checked, all fine']], d.restores)));
  body.append(h('div', { class: 'card' }, h('h3', {}, 'Edition ledger (permanent, cannot be edited)'), tbl([['#', r => r.id], ['When', r => dt(r.at)], ['Event', r => r.event], ['Player', r => r.username], ['By', r => r.actor], ['Details', r => r.details ? JSON.stringify(r.details).slice(0, 90) : '']], d.ledger)));
};
/* =====================================================================
   2.5.0 GOD OF ABSOLUTE — AUTONOMOUS FREE WILL
   It is never steered or commanded by a player: it reads the battle, picks its own targets and strategies,
   dodges by teleporting, times its own ultimate, and decides by itself when to leave the arena for the OUTER REALM
   (to hunt enemies hiding outside the arena, to recover, or to explore) — and it always comes back.
   Everything here is part of the deterministic battle simulation (seeded RNG only), so online matches stay in sync
   and the server replays the same decisions. Visual reactions use FX only. The owner tunes it (Admin → God of Absolute).
   ===================================================================== */
const WILL_DEFAULT = { intelligence: 2, aggression: 60, transcend: true, hunt: true, retreat: true, explore: true, step: true, speech: true, maxRealm: 6, realmCd: 18 };
const willCfg = f => { const w = (((f.baseDef || f.def).tuning || {}).will) || {}; const c = { ...WILL_DEFAULT, ...w };
  c.intelligence = clamp(c.intelligence | 0, 1, 3); c.aggression = clamp(+c.aggression || 0, 0, 100); c.maxRealm = clamp(+c.maxRealm || 6, 3, 8); c.realmCd = clamp(+c.realmCd || 18, 12, 40); return c; };
const isWill = f => !!(f && f.autonomous && f.alive);
const STRATS = {
  DOMINATE: { pers: 'aggressive', col: ABS.GOLD, line: 'BOW BEFORE THE ABSOLUTE.' },
  JUDGE: { pers: 'tactical', col: ABS.WHITE, line: 'I WILL JUDGE YOU FROM HERE.' },
  ORBIT: { pers: 'intelligent', col: ABS.PURPLE, line: 'I SEE EVERY MOVE YOU MAKE.' },
  EXECUTE: { pers: 'aggressive', col: '#ff8a80', line: 'YOUR END HAS BEEN DECIDED.' },
  WARD: { pers: 'defensive', col: '#80d8ff', line: 'A WORTHY FOE… I WILL BE PATIENT.' },
};
const willSay = (f, txt, col = ABS.GOLD, size = 15) => { if (FX.off || !f.will || !f.will.cfg.speech) return; FX.text(f.x, f.y - f.r - 56, txt, col, size, { life: 1.5, pop: 1.3, stroke: '#0b0618' }); };
/** how dangerous a ball is right now (attack, form, a charged ultimate, being a god, remaining health) */
function threatOf(e) { return e.effAtk() * (1 + (e.form | 0) * 0.2 + (e.god > 0 ? 0.3 : 0)) * (e.ultMeter >= 85 ? 1.35 : 1) * (e.baseDef && e.baseDef.forms ? 1.25 : 1) * (0.5 + e.hpRatio * 0.5); }
const powerOf = f => f.effAtk() * (1 + (f.form | 0) * 0.2) * (0.5 + f.hpRatio * 0.5);
const willFoes = f => f.enemies().filter(e => !e.isClone && !e.unit && !(e.st.outside > 0));

/* ---------- 1. autonomy: no player input ever reaches it (steering, abilities, ultimate, manual mode) ---------- */
{
  const apply = Battle.prototype.applyAction;
  Battle.prototype.applyAction = function (a, pl = this.player) {
    if (pl && pl.autonomous && (a[0] === 'k' || a[0] === 'u' || a[0] === 'm' || a[0] === 's')) { if (a[0] !== 's') pl.manual = false; return; }
    return apply.call(this, a, pl);
  };
}

/* ---------- 2. the will: strategies, danger sense, its own targets, reactions ---------- */
function willInit(f) {
  const cfg = willCfg(f);
  f.autonomous = true; f.manual = false;
  f.will = { cfg, strat: 'ORBIT', stratT: 1.5 + rand(1.5), focus: null, said: {}, stepCd: 3, realmCd: 6 + rand(4), decT: 0.5, lastHp: f.hp, idleT: 0, lowSaid: false, form: f.form };
  if (f.ai) { const diff = ['normal', 'hard', 'expert'][cfg.intelligence - 1]; f.ai.diff = diff; f.ai.p = DIFF[diff]; }
}
function chooseStrategy(f, W) {
  const es = willFoes(f); if (!es.length) return W.strat;
  const A = W.cfg.aggression / 100, top = es.reduce((a, b) => threatOf(b) > threatOf(a) ? b : a), danger = threatOf(top) / Math.max(1, powerOf(f));
  const weakest = es.reduce((a, b) => b.hpRatio < a.hpRatio ? b : a);
  const w = {
    DOMINATE: (0.3 + A * 1.4) * (0.4 + f.hpRatio) * (danger < 1.2 ? 1.2 : 0.6),
    JUDGE: (1.2 - A) * 0.7 + (es.length > 1 ? 0.5 : 0),
    ORBIT: (1.2 - A) * 0.8 * (danger > 1 ? 1.3 : 1),
    EXECUTE: weakest.hpRatio < 0.35 ? 1.6 : 0.08,
    WARD: danger > 1.35 && f.hpRatio < 0.65 ? 1.3 : 0.05,
  };
  if (danger > 1.3 && !W.said['worthy' + top.sid]) { W.said['worthy' + top.sid] = true; willSay(f, 'A WORTHY FOE.', '#80d8ff'); }
  // independent and unpredictable: a weighted choice, never simply "follow the others"
  let sum = 0; for (const k in w) sum += w[k]; let r = rand(sum);
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'ORBIT';
}
/* its own target, by its own strategy (it does not copy its allies' target) */
{
  const pick = AIController.prototype.pickTarget;
  AIController.prototype.pickTarget = function () {
    const f = this.f, W = f.will; if (!isWill(f) || !W) return pick.call(this);
    const es = willFoes(f).filter(e => (e.dim || 0) === (f.dim || 0)); if (!es.length) return null;
    if (W.focus && W.focus.alive && es.includes(W.focus)) return W.focus;
    let t;
    if (W.strat === 'DOMINATE' || W.strat === 'WARD') t = es.reduce((a, b) => threatOf(b) > threatOf(a) ? b : a);
    else if (W.strat === 'EXECUTE') t = es.reduce((a, b) => b.hpRatio < a.hpRatio ? b : a);
    else if (W.strat === 'JUDGE') t = es.reduce((a, b) => dist2(b.x, b.y, ARENA.cx, ARENA.cy) < dist2(a.x, a.y, ARENA.cx, ARENA.cy) ? b : a);
    else t = pick.call(this);
    W.focus = t; return t;
  };
}
/* it times its own ultimate: never into an untouchable or far-away target, unless it is about to fall */
{
  const ult = useUltimate;
  useUltimate = function (f) {
    if (isWill(f) && f.will) {
      const t = f.target && f.target.alive ? f.target : nearestEnemy(f);
      const bad = !t || t.st.invuln > 0.3 || t.st.outside > 0 || len(t.x - f.x, t.y - f.y) > 560;
      if (bad && f.hpRatio > 0.25) return false;
    }
    return ult(f);
  };
}
/* the strategy, reactions, idle behaviour and the realm decisions — every step, in the simulation */
SUP.worldHooks.push((B, h) => {
  for (const f of B.fighters) {
    if (!f.alive || f.isClone || !f.baseDef || f.baseDef.id !== ABS.id) continue;
    if (!f.will) willInit(f);
    const W = f.will; f.manual = false;
    W.stepCd -= h; W.realmCd -= h;
    // strategy: re-thought every 6–10 s, at once on big events (a hard hit, half health, the focus falls)
    const big = W.lastHp - f.hp > f.maxHp * 0.08, half = W.lastHp > f.maxHp * 0.5 && f.hp <= f.maxHp * 0.5;
    if (big) willSay(f, 'INTERESTING…', ABS.WHITE, 13);
    if (!W.lowSaid && f.hpRatio < 0.25) { W.lowSaid = true; willSay(f, 'I AM ABSOLUTE.', ABS.GOLD, 17); }
    W.lastHp = f.hp;
    if ((W.stratT -= h) <= 0 || big || half || (W.focus && !W.focus.alive)) {
      const s = chooseStrategy(f, W); W.stratT = 6 + rand(4); W.focus = null;
      const talk = rand() < 0.35;      // rolled in the simulation (same on every screen and on the server), shown only where there is a screen
      if (s !== W.strat) { W.strat = s; if (!FX.off) { FX.text(f.x, f.y + f.r + 26, '◈ ' + s, STRATS[s].col, 12, { life: 1.1 }); if (talk) willSay(f, STRATS[s].line, STRATS[s].col, 13); } }
    }
    if (f.ai) { f.ai.pers = STRATS[W.strat].pers; f.ai.basePers = f.ai.pers; }
    if (W.form !== f.form) { W.form = f.form; willSay(f, f.form === 2 ? 'WITNESS THE UNRIVALED ONE.' : 'WITNESS.', ABS.GOLD, 17); absTransformFx(f); }
    // DIVINE STEP: it teleports out of danger, or behind a target that tries to run
    if (W.cfg.step && W.stepCd <= 0 && f.canAct() && !f.casting) divineStep(f, W);
    // OUTER REALM decisions (every 0.5 s)
    if ((W.decT -= h) <= 0) { W.decT = 0.5; realmDecide(B, f, W); }
  }
  realmStep(B, h);
});
/* idle behaviour: with nobody to fight, it drifts in a slow, majestic circle and the symbols pulse */
SUP.steerHooks.push(f => {
  if (!isWill(f) || !f.will) return;
  if (f.manual) f.manual = false;
  if (willFoes(f).some(e => (e.dim || 0) === (f.dim || 0))) { f.will.idleT = 0; return; }
  const W = f.will, a = BATTLE.time * 0.6 + f.sid, tx = ARENA.cx + dcos(a) * 170, ty = ARENA.cy + dsin(a) * 120, dx = tx - f.x, dy = ty - f.y, d = len(dx, dy) || 1;
  f.steerX = dx / d; f.steerY = dy / d; f.steerPow = 260; W.idleT += 1 / 240;
  if (!FX.off && Math.random() < 0.02) FX.ring(f.x, f.y, ABS.GOLD, f.r * 2.6, 0.8, 3, f.r * 1.2);
});
function divineStep(f, W) {
  const B = BATTLE, dm = f.dim || 0;
  let danger = null, tt = 0.6;
  for (const p of B.projs) {
    if (p.team === f.team || (p.dim ?? ((p.owner && p.owner.dim) || 0)) !== dm || (p.r || 8) < 5) continue;
    const rx = f.x - p.x, ry = f.y - p.y, vv = p.vx * p.vx + p.vy * p.vy || 1, t = (rx * p.vx + ry * p.vy) / vv;
    if (t < 0 || t > tt) continue;
    if (len(p.x + p.vx * t - f.x, p.y + p.vy * t - f.y) < f.r + (p.r || 8) + 10 && (p.dmg || 0) > f.maxHp * 0.015) { tt = t; danger = p; }
  }
  // a marked strike about to land on it
  if (!danger) for (const s of B.strikes) if (s.team !== f.team && ((s.owner && s.owner.dim) || 0) === dm && s.t < 0.5 && len(s.x - f.x, s.y - f.y) < s.r + f.r) { danger = { vx: f.x - s.x || 1, vy: f.y - s.y }; break; }
  let to = null;
  if (danger) { const a = datan2(danger.vy, danger.vx) + (rand() < 0.5 ? HPI : -HPI); to = { x: f.x + dcos(a) * 200, y: f.y + dsin(a) * 200 }; }
  else if (W.strat === 'EXECUTE' && f.target && f.target.alive && len(f.target.x - f.x, f.target.y - f.y) > 480) to = behind(f.target, f, 50);
  if (!to) return;
  const x0 = f.x, y0 = f.y; f.x = inArenaX(to.x, f.r); f.y = inArenaY(to.y, f.r); f.st.invuln = Math.max(f.st.invuln, 0.15);
  W.stepCd = W.cfg.intelligence === 3 ? 5.5 : 7;
  if (!FX.off) { absPortalFx(x0, y0, f.r * 1.6, 0.4); absPortalFx(f.x, f.y, f.r * 1.6, 0.5); FX.text(f.x, f.y - f.r - 26, 'DIVINE STEP', ABS.WHITE, 12, { life: 0.6 }); absSound('replica', 2); }
}

/* ---------- 3. the OUTER REALM: its own dimension beyond the arena ---------- */
const REALM_RETREAT = 2.5, REALM_EXPLORE = 2.5, REALM_GATE = 0.5;
const absRealmOf = (B, f) => (B.absRealms || []).find(R => R.owner === f);
/** an enemy hiding outside the arena (a portal escape, a dimensional trap…) that it may hunt */
const huntable = (f, e) => e.alive && e.team !== f.team && !e.isClone && !e.unit && !e.minion && !e.summonOnly && e.st.outside > 0.15 && (e.dim || 0) === 0 && !(BATTLE.voidDim && BATTLE.voidDim.foes && BATTLE.voidDim.foes.includes(e));
function realmDecide(B, f, W) {
  const C = W.cfg;
  if (!C.transcend || W.realmCd > 0 || absRealmOf(B, f) || (f.dim || 0) !== 0 || f.casting > 0 || B.cinematic || B.clash || f.st.outside > 0 || f.sx.absUltT > 0) return;
  // a) HUNT: an enemy is hiding outside the arena → it follows it into the Outer Realm
  if (C.hunt) { const prey = B.fighters.filter(e => huntable(f, e)); if (prey.length) return openRealm(B, f, 'hunt', prey.reduce((a, b) => threatOf(b) > threatOf(a) ? b : a)); }
  const es = willFoes(f).filter(e => (e.dim || 0) === 0), near = es.filter(e => len(e.x - f.x, e.y - f.y) < 300);
  // b) RECOVER: badly hurt and pressed → it steps out of the arena to recover for a moment
  if (C.retreat && f.hpRatio < 0.3 && near.length && rand() < 0.45) return openRealm(B, f, 'retreat');
  // c) EXPLORE: nothing worth its attention nearby → it explores the Outer Realm and gathers cosmic energy
  if (C.explore && f.hpRatio > 0.6 && es.length && !es.some(e => len(e.x - f.x, e.y - f.y) < 420) && rand() < 0.025) return openRealm(B, f, 'explore');
}
function openRealm(B, f, kind, prey) {
  const R = { id: (B.dimN = (B.dimN || 0) + 1), owner: f, kind, prey: prey || null, phase: 'gate', t: 0, dur: kind === 'hunt' ? f.will.cfg.maxRealm : kind === 'retreat' ? REALM_RETREAT : REALM_EXPLORE,
    gx: f.x, gy: f.y, saved: new Map(), pre: null, ambush: kind === 'explore' && rand() < 0.5 };
  (B.absRealms || (B.absRealms = [])).push(R); (B.absRealmIds || (B.absRealmIds = new Set())).add(R.id);
  f.will.realmCd = f.will.cfg.realmCd;
  if (!FX.off) {
    vfx((ctx, q) => absGateway(ctx, R.gx, R.gy, 30 + 120 * Math.min(1, q * 2), Math.min(1, q * 4), q * 4), REALM_GATE + 0.3, { keep: true });
    FX.text(f.x, f.y - f.r - 40, kind === 'hunt' ? 'NONE ESCAPE THE ABSOLUTE.' : kind === 'retreat' ? 'TRANSCEND.' : 'BEYOND THE ARENA…', ABS.GOLD, 15, { life: 1.3, pop: 1.5 });
    if (prey) vfx((ctx, q) => absGateway(ctx, prey.x, prey.y, prey.r * (1.2 + q), Math.min(1, q * 3), q * 6), REALM_GATE + 0.2, { keep: true });
    absSound('reality', 2);
  }
}
function enterRealm(B, R) {
  const f = R.owner;
  if (!f.alive || (f.dim || 0) !== 0) return closeRealm(B, R, true);
  const members = [f, ...absCopies(f)];
  if (R.kind === 'hunt') {
    const e = R.prey;
    if (!e || !e.alive || (e.dim || 0) !== 0 || e.isClone) return closeRealm(B, R, true);
    if (e.st.outside > 0) { e.st.outside = 0; e.portalExit = null; }       // pulled out of its hiding place
    members.push(e);
  }
  R.pre = { zones: new Set(B.zones), lasers: new Set(B.lasers), waves: new Set(B.waves), strikes: new Set(B.strikes) };
  members.forEach((m, i) => {
    R.saved.set(m.sid, { x: m.x, y: m.y });
    m.dim = R.id; m.target = null;
    const enemy = R.prey && m === R.prey;
    m.x = inArenaX(ARENA.cx + (enemy ? 230 : -230) + (i > 0 && !enemy ? rand(-60, 60) : 0), m.r); m.y = inArenaY(ARENA.cy + (i > 0 && !enemy ? rand(-80, 80) : 0), m.r);
    m.vx = m.vy = 0; m.st.invuln = Math.max(m.st.invuln, 0.4);
  });
  R.phase = 'inside'; R.t = 0;
  if (!FX.off) { FX.addFlash(0.25, '#1a0a33'); absSound('transform'); }
}
/** always brings everyone back to the arena, and removes everything that was created inside */
function closeRealm(B, R, aborted) {
  const f = R.owner, members = B.fighters.filter(m => m.dim === R.id);
  for (const m of members) {
    let s = R.saved.get(m.sid) || { x: R.gx, y: R.gy };
    if (m === f && R.kind === 'explore' && f.alive && R.ambush) { const t = nearestEnemy(f); if (t) s = behind(t, f, 80); }        // it chooses where to come back: sometimes right behind its enemy
    if (m === f && R.kind === 'retreat' && f.alive) s = safeSpot(f);
    m.dim = 0; m.x = inArenaX(s.x, m.r); m.y = inArenaY(s.y, m.r);
    if (m.alive) { m.st.invuln = Math.max(m.st.invuln, 0.5); m.vx = m.vy = 0; }
  }
  if (R.phase === 'inside') {
    B.projs = B.projs.filter(p => (p.dim ?? ((p.owner && p.owner.dim) || 0)) !== R.id && !(p.owner && members.includes(p.owner) && p.dim === R.id));
    for (const key of ['zones', 'lasers', 'waves', 'strikes']) B[key] = B[key].filter(x => R.pre[key].has(x) || !(x.owner && members.includes(x.owner)));
  }
  B.absRealms = B.absRealms.filter(x => x !== R);
  if (!FX.off && !aborted) { absPortalFx(f.x, f.y, f.r * 2.4, 0.7); FX.text(f.x, f.y - f.r - 40, R.kind === 'hunt' ? 'JUDGMENT IS COMPLETE.' : 'I HAVE RETURNED.', ABS.GOLD, 14, { life: 1.2 }); }
}
function realmStep(B, h) {
  for (const R of (B.absRealms || []).slice()) {
    R.t += h; const f = R.owner;
    if (R.phase === 'gate') { if (!f.alive) { closeRealm(B, R, true); continue; } f.vx *= 0.85; f.vy *= 0.85; if (R.t >= REALM_GATE) enterRealm(B, R); continue; }
    // inside: the owner recovers (retreat) or gathers cosmic energy (explore); a hunt lasts until the prey falls or time runs out
    if (R.kind === 'retreat' && f.alive) healFighter(f, f.maxHp * 0.015 * h, true);
    if ((R.kind === 'explore' || R.kind === 'retreat') && f.alive && f.sx && f.sx.ae != null) f.sx.ae = Math.min(100, f.sx.ae + 7 * h);
    const preyGone = R.kind === 'hunt' && (!R.prey || !R.prey.alive || R.prey.dim !== R.id);
    if (!f.alive || R.t >= Math.min(8, R.dur) || (preyGone && (R.endT ??= R.t + 0.6) <= R.t)) closeRealm(B, R, false);
  }
  // safety net: nobody can ever be left in a closed realm
  if (B.absRealmIds && B.absRealmIds.size) { const open = new Set((B.absRealms || []).map(R => R.id)); for (const m of B.fighters) if (m.dim && B.absRealmIds.has(m.dim) && !open.has(m.dim)) { m.dim = 0; m.st.invuln = Math.max(m.st.invuln, 0.5); } }
}
/* the Outer Realm on screen: the world for whoever is inside it, a small window for everyone else */
SUP.dimViews.push(B => (B.absRealms || []).filter(R => R.phase === 'inside').map(R => ({ id: R.id, world: (ctx, dt) => drawOuterRealm(ctx, B, R, dt), inset: (ctx, slot) => drawRealmInset(ctx, B, R, slot), spectate: !B.player })));
/* =====================================================================
   2.5.0 FREE WILL — visuals and screens (visual only): golden-purple cosmic aura, dimensional portals,
   the Outer Realm world, the window into it, its transformation burst, and the "OWN WILL" battle controls.
   ===================================================================== */
Object.assign(SUP.deco, {
  absaura(ctx, r, d, t, front) {        // a living golden and purple cosmic aura that breathes behind the ball
    if (front) return; const q = absQ();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const pulse = 1 + 0.08 * Math.sin(t * 2.2);
    const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.4 * pulse); g.addColorStop(0, 'rgba(156,107,255,.35)'); g.addColorStop(0.55, 'rgba(255,213,79,.16)'); g.addColorStop(1, 'rgba(156,107,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.4 * pulse, 0, TAU); ctx.fill();
    for (let i = 0; i < Math.round(3 * Math.max(0.5, q)); i++) { ctx.save(); ctx.rotate(t * (0.4 + i * 0.15) * (i % 2 ? -1 : 1) + i); ctx.strokeStyle = i % 2 ? 'rgba(156,107,255,.5)' : 'rgba(255,213,79,.45)'; ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath(); ctx.arc(0, 0, r * (1.7 + i * 0.18), 0, Math.PI * 0.7); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  },
});
for (const fm of [ABS_DEF.design, ...ABS_DEF.forms.map(x => x.design).filter(Boolean)]) if (fm.sdeco && !fm.sdeco.includes('absaura')) fm.sdeco.unshift('absaura');
if (!ABS_DEF.design.sdeco.includes('absaura')) ABS_DEF.design.sdeco.unshift('absaura');
delete SUP.forms[ABS.id];

/** a golden-purple dimensional portal (gateway) */
function absGateway(ctx, x, y, r, a, t) {
  if (a <= 0.01 || r <= 1) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r); g.addColorStop(0, '#000000'); g.addColorStop(0.6, '#1a0a33'); g.addColorStop(0.92, 'rgba(156,107,255,.85)'); g.addColorStop(1, 'rgba(255,213,79,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.15, 0, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = i === 1 ? '#fffde7' : i ? ABS.PURPLE : ABS.GOLD; ctx.lineWidth = 3 - i * 0.6; ctx.setLineDash([r * 0.3, r * 0.12]); ctx.lineDashOffset = -t * 30 * (i + 1);
    ctx.beginPath(); ctx.ellipse(0, 0, r * (1 - i * 0.12), r * 1.15 * (1 - i * 0.12), t * 0.3 * (i % 2 ? -1 : 1), 0, TAU); ctx.stroke(); }
  ctx.setLineDash([]); ctx.fillStyle = ABS.GOLD; ctx.font = `bold ${Math.max(10, r * 0.22) | 0}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) { const b = i / 8 * TAU + t; ctx.fillText(ABS_GLYPHS[i], Math.cos(b) * r * 1.15, Math.sin(b) * r * 1.3); }
  ctx.restore();
}
function absPortalFx(x, y, r, life) { if (FX.off) return; vfx((ctx, q) => absGateway(ctx, x, y, r * (q < 0.3 ? q / 0.3 : 1 - (q - 0.3) / 0.7 * 0.8), 1 - q * 0.6, q * 6), life); FX.burst(x, y, ABS.PURPLE, Math.round(18 * absQ()), 300, 5, 0.5); FX.burst(x, y, ABS.GOLD, Math.round(12 * absQ()), 240, 4, 0.5); }
/** its own transformation burst: a celestial explosion of rings, symbols and purple-gold light */
function absTransformFx(f) {
  if (FX.off) return;
  vfx((ctx, q) => { vCelestialRings(ctx, f.x, f.y, f.r * (1.5 + q * 6), 1 - q, q * 8, 6, ABS.GOLD); absGateway(ctx, f.x, f.y, f.r * (1.2 + q * 2.5), (1 - q) * 0.7, q * 5); }, 1.4);
  FX.burst(f.x, f.y, ABS.PURPLE, Math.round(60 * absQ()), 640, 7, 1); FX.burst(f.x, f.y, ABS.GOLD, Math.round(60 * absQ()), 520, 6, 1, 'shard'); absSound('transform');
}
/** the OUTER REALM: the space beyond the arena — a golden-purple cosmos, the arena floating far away, drifting fragments and a timer */
function drawOuterRealm(ctx, B, R, dt) {
  const t = B.time, g = ctx.createRadialGradient(ARENA.cx, ARENA.cy, 30, ARENA.cx, ARENA.cy, W * 0.8);
  g.addColorStop(0, '#2a1650'); g.addColorStop(0.5, '#0e0620'); g.addColorStop(1, '#020007'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rng = mulberry32(777 + R.id), q = absQ();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < Math.round(170 * q); i++) { const x = rng() * W, y = rng() * H, s = rng() * 2 + 0.4, tw = 0.5 + 0.5 * Math.sin(t * (1 + rng() * 3) + i); ctx.fillStyle = i % 5 ? `rgba(255,255,255,${0.2 + 0.6 * tw})` : `rgba(255,213,79,${0.3 + 0.6 * tw})`; ctx.fillRect((x + t * 6 * s) % W, y, s, s); }
  for (let i = 0; i < 3; i++) { const nx = [W * 0.18, W * 0.82, W * 0.5][i], ny = [H * 0.25, H * 0.72, H * 0.12][i], ng = ctx.createRadialGradient(nx, ny, 10, nx, ny, 260); ng.addColorStop(0, i === 1 ? 'rgba(255,213,79,.18)' : 'rgba(156,107,255,.22)'); ng.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ng; ctx.fillRect(nx - 260, ny - 260, 520, 520); }
  // the arena it left behind, floating far away
  ctx.save(); ctx.translate(ARENA.cx, ARENA.cy); ctx.scale(0.22, 0.22); ctx.rotate(Math.sin(t * 0.3) * 0.05); ctx.strokeStyle = 'rgba(64,196,255,.55)'; ctx.lineWidth = 14; ctx.strokeRect(-ARENA.w / 2, -ARENA.h / 2, ARENA.w, ARENA.h); ctx.restore();
  // drifting golden fragments and constellation lines
  for (let i = 0; i < Math.round(14 * q); i++) { const a = t * (0.1 + (i % 4) * 0.03) + i * 1.7, rr = 220 + (i * 53) % 330; vFragment(ctx, ARENA.cx + Math.cos(a) * rr * 1.4, ARENA.cy + Math.sin(a) * rr * 0.75, 7 + (i % 3) * 3, a * 2, i % 3 ? ABS.GOLD : '#fff8e1'); }
  ctx.strokeStyle = 'rgba(255,213,79,.18)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + t * 0.05; ctx.lineTo(ARENA.cx + Math.cos(a) * 520, ARENA.cy + Math.sin(a) * 300); } ctx.closePath(); ctx.stroke();
  ctx.restore();
  // the realm's limits are soft golden walls (it is still a bounded, safe space)
  ctx.save(); ctx.strokeStyle = 'rgba(255,213,79,.25)'; ctx.setLineDash([18, 14]); ctx.lineDashOffset = -t * 20; ctx.lineWidth = 2; ctx.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.restore();
  const left = Math.max(0, Math.ceil(Math.min(8, R.dur) - R.t));
  ctx.save(); ctx.font = '900 15px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = ABS.GOLD;
  ctx.fillText(`✦ OUTER REALM — ${R.kind === 'hunt' ? 'THE HUNT' : R.kind === 'retreat' ? 'TRANSCENDENCE' : 'EXPLORATION'} — ${left}s ✦`, ARENA.cx, ARENA.y + 22); ctx.restore();
}
/** a small window into the Outer Realm for everyone still in the arena */
function drawRealmInset(ctx, B, R, slot) {
  const w = 260, hh = 146, x0 = 18, y0 = 96 + slot * (hh + 14), s = w / ARENA.w;
  ctx.save(); ctx.fillStyle = '#0b0618'; ctx.strokeStyle = ABS.GOLD; ctx.lineWidth = 2; ctx.fillRect(x0, y0, w, hh); ctx.strokeRect(x0, y0, w, hh);
  ctx.beginPath(); ctx.rect(x0, y0, w, hh); ctx.clip(); ctx.translate(x0, y0 + (hh - ARENA.h * s) / 2); ctx.scale(s, s); ctx.translate(-ARENA.x, -ARENA.y);
  ctx.fillStyle = 'rgba(156,107,255,.12)'; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  for (const f of B.fighters) if (f.alive && f.dim === R.id) drawBall(ctx, f.def, f.x, f.y, f.r, { t: f.t, rot: f.rot, noAura: true, small: true, noSupDeco: true });
  ctx.restore();
  ctx.save(); ctx.font = '800 12px "Segoe UI", sans-serif'; ctx.fillStyle = ABS.GOLD; ctx.fillText('✦ OUTER REALM — ' + Math.max(0, Math.ceil(Math.min(8, R.dur) - R.t)) + 's', x0 + 8, y0 + 16); ctx.restore();
}

/* battle controls: God of Absolute cannot be steered or commanded — the AUTO button shows its own will */
if (!window.NBB_HEADLESS) {
  const willBall = () => !!(BATTLE && BATTLE.player && BATTLE.player.baseDef && BATTLE.player.baseDef.id === ABS.id);
  const sync = UI.syncHud;
  UI.syncHud = function () {
    sync.call(this);
    if (!willBall()) { const b = $('#btnAuto'); if (b) b.disabled = false; return; }
    const b = $('#btnAuto'); if (b) { b.textContent = '🧠 OWN WILL'; b.disabled = true; b.classList.remove('manual'); b.title = 'God of Absolute makes its own decisions'; }
    const bar = $('#skillBar'); if (bar) { bar.classList.add('hidden'); bar.innerHTML = ''; }
  };
  const tc = toggleControl;
  toggleControl = function () { if (willBall()) return toast('🧠 GOD OF ABSOLUTE makes its own decisions. It cannot be controlled.', 'gold'); return tc(); };
}

if (window.NBB_CORE) Object.assign(window.NBB_CORE, { ABS, limitedGodIds: () => SUP.limitedGodIds.slice(), absUlt: (f, omni, dmg) => absoluteUlt(f, 110, ABS.GOLD, dmg, omni), SUP });
invalidateRegistry();
