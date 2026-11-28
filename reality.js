/* =====================================================================
   NEON BALL BATTLE 2.9.0 — REALITY VS ABSOLUTE
   Three new Supreme God Balls (original designs, sounds, animations and lines):
     • THE VOID BELOW     — 50,000 coins. Crimson void: deletes, consumes and fractures reality.
     • THE ABSOLUTE ABOVE — 50,000 coins. Golden authority: restores reality, immunity, portals, rings.
     • FATE NOTE BALL     — PHP 99 (verified payment only). An ink notebook of destiny: seals, chains, sentences, a shade.
   Each one: 5 abilities with a Base / 2nd / 3rd form version, a passive with an energy meter, a regular ultimate and a
   final-form ultimate (cinematic; the arena is restored afterwards) and 3 transformations.

   Also here (shared battle rules, so the server re-simulates them exactly):
     REALITY COLLISION rivalry + timing clash • GOD SYNERGY • REALITY COLLISION ZONE arena •
     secret cosmic boss THE FRACTURED ARCHON • God Mastery counters (looks only) • the Fate Notebook target input.

   Loaded after anti.js in the browser AND on the game server. Battle logic only uses the seeded RNG
   (RNG / rand / dcos / dsin / datan2); Math.random is for visuals only. Ownership is decided by the server only.
   ===================================================================== */
const RG = {
  VER: '2.9.0', COIN_PRICE: 50000, FATE_PHP: 99,
  IDS: ['voidbelow', 'absoluteabove', 'fatenote'], COIN_IDS: ['voidbelow', 'absoluteabove'],
  CRIMSON: '#ff1744', BLOOD: '#9b0020', EMBER: '#ff5233', VOID: '#060003',
  GOLD: '#ffd54f', WHITE: '#fffde7', AMBER: '#ffb300', SKY: '#fff3c4',
  INK: '#0b0b12', PAPER: '#f3e5c0', FATE: '#e0103a', SPIRIT: '#9e7cff',
  // Void Below
  DELETE: { warn: 0.8, r: [90, 120, 130], dur: [1.0, 1.3, 1.6], imm: 8, dmg: [0.44, 0.42, 0.38] },
  CONSUME: { life: [2.2, 2.6, 2.6], r: [150, 175, 130], pull: [1100, 1250, 1350], eat: 0.6 },
  FRACTURE: { life: [4, 4.5, 5], r: [95, 95, 90], tick: 0.5, dmg: 0.055 },
  SUPPRESS: { warn: 0.5, dur: [3, 3, 3.5], imm: 10, speed: 760, ult: 15 },
  CORE: { charge: [1.0, 1.2, 1.4], r: [300, 320, 340], dmg: [0.85, 0.5, 0.36] },
  NEGATE: { gain: { hit: 2, eat: 3, del: 12 }, dur: [4, 5, 6], bonus: 0.12, guard: 0.15, shots: 6 },
  // Absolute Above
  RESTORE: { heal: [0.12, 0.12, 0.1], ally: 0.08, r: 320 },
  IMMUNE: { dur: [3, 3.5, 4], cut: 0.55 },
  REWRITE: { back: 15, heal: 0.08 },
  RINGS: { dur: [4, 4, 5], n: [6, 8, 10], R: 2.5 },
  AUTH: { cut: [0.4, 0.45, 0.5], counter: 0.5 },
  // Fate Note
  SEAL: { dur: [6, 7, 8], bonus: [0.08, 0.1, 0.12], enh: { extra: 3, cdSlow: 0.15, cdDur: 4 } },
  VISION: { dur: [5, 6, 7], bonus: 0.06 },
  BIND: { dur: [2, 2.5, 3], r: 110, imm: 5, speed: 720 },
  SENTENCE: { t: [5, 4.5, 4], hits: 3, cap: 0.3, capBoss: 0.15, imm: 6, dmg: [1.1, 1.05, 1.0] },
  SHADE: { life: [6, 7, 8] },
  FATE: { seal: 8, hit: 2, sentence: 25, bind: 10 },
};
/** is this fighter one of the three 2.9.0 Reality Gods (not a copy) */
const isRG = (f, id) => !!(f && f.baseDef && f.baseDef.realityGod && !f.isClone && (!id || f.baseDef.id === id));
const rgLord = f => (f && f.minion && f.owner) ? f.owner : f;
const rgK = f => (rgLord(f).form | 0);
const rgSay = (f, txt, col, size = 15) => { if (!FX.off) FX.text(f.x, f.y - f.r - 32, txt, col, size, { life: 1.0, pop: 1.3 }); };
const rgBanner = (txt, col, size = 40, sub, subCol) => { if (FX.off) return; FX.text(ARENA.cx, ARENA.y + 70, txt, col, size, { life: 2.2, vy: 0, pop: 2, stroke: '#000000' }); if (sub) FX.text(ARENA.cx, ARENA.y + 114, sub, subCol || col, 19, { life: 2.0, vy: 0 }); };
const rgFoes = f => supEnemies(f).filter(e => e.alive);
/** the energy meter of each passive (Destruction / Authority / Fate Energy), 0–100 */
function rgEnergy(f, n) {
  const L = rgLord(f); if (!isRG(L) || !L.sx) return;
  const S = L.sx; if (S.rgLockT > 0 && n > 0) return;
  S.rgE = clamp((S.rgE || 0) + n, 0, 100);
}
/** reality-manipulation immunity (The Absolute Above's Absolute Immunity) */
const rgImmune = e => !!(e && e.sx && e.sx.immT > 0);
/** a resistance window after a control effect (shown in the Fate Notebook) */
const rgResist = (e, key) => !!(e && e.sx && e.sx[key] > 0);
function rgBlocked(src, e, label) {
  if (!rgImmune(e)) return false;
  if (!FX.off) { FX.text(e.x, e.y - e.r - 30, 'ABSOLUTE IMMUNITY', RG.GOLD, 15, { life: 0.8 }); FX.ring(e.x, e.y, RG.GOLD, e.r * 2, 0.35, 5, e.r); }
  const S = e.sx; if (S.immK === 2 && !S.immRefl && src && src.alive) {        // 3rd-form immunity reflects the first blocked effect
    S.immRefl = true; const a = datan2(src.y - e.y, src.x - e.x);
    supShot(e, e.x, e.y, a, { speed: 820, r: 9, dmg: SD(e, 60) * 0.35, col: RG.GOLD, style: 'k_spear', homing: 2, target: src, power: 60, life: 1.6 });
  }
  return true;
}
/** God Mastery counters (looks only): kept on the fighter, read by the server from the verified simulation */
function gmCount(f, k, n = 1) { const L = rgLord(f); if (!isRG(L)) return; const g = L.gm29s || (L.gm29s = { skills: 0, ults: 0, forms: 0, clash: 0, combos: 0, seals: 0 }); g[k] = (g[k] || 0) + n; }
/** the Fate Notebook's log for this match only (shown to the Fate Note player; never anything outside the match) */
function fateLog(B, by, e, kind, extra) { if (!B) return; const L = B.fateLog || (B.fateLog = []); L.push({ t: Math.round(B.time * 10) / 10, by: by ? by.sid : -1, who: e ? e.sid : -1, name: e ? (e.tag || e.def.name) : '', kind, extra: extra || null }); if (L.length > 60) L.shift(); }

/* ---------------- sounds (original synthesis, one motif per ball) ---------------- */
function rgSound(kind, i = 0) {
  if (FX.off || typeof Sound === 'undefined' || !Sound.ctx || !Sound.tone || !SAVE || !SAVE.settings || SAVE.settings.sfx <= 0) return;
  try {
    const T = (f, d, w, v, s, dl) => Sound.tone(f, d, w, v, s, dl), N = (d, v, f, q, dl) => Sound.noiseHit(d, v, f, q, dl);
    switch (kind) {
      // THE VOID BELOW: low sawtooth growls, falling sweeps, crushed noise
      case 'vb_warn': T(48, 0.8, 'sawtooth', 0.12, 1.5); T(97, 0.5, 'square', 0.03, 0.7, 0.2); break;
      case 'vb_delete': T(220, 0.5, 'sawtooth', 0.1, 0.25); N(0.5, 0.18, 900, 0.6); T(55, 0.7, 'sine', 0.2, 0.6); break;
      case 'vb_hole': T(36, 1.6, 'sine', 0.22, 0.6); T(72, 1.2, 'sawtooth', 0.06, 0.5, 0.1); break;
      case 'vb_crack': [660, 330, 990].forEach((f, k) => T(f, 0.08, 'square', 0.05, 0.4, k * 0.05)); N(0.35, 0.14, 2400, 1); break;
      case 'vb_supp': T(1300, 0.1, 'square', 0.05, 0.3); T(160, 0.4, 'sawtooth', 0.09, 0.4, 0.05); break;
      case 'vb_charge': T(60, 1.2, 'sawtooth', 0.12, 3.4); T(120, 1.0, 'sine', 0.05, 3, 0.1); break;
      case 'vb_boom': T(32, 1.1, 'sawtooth', 0.24, 0.4); N(1.0, 0.32, 260, 0.4); break;
      case 'vb_ult': T(28, 2.6, 'sine', 0.28, 0.5); T(56, 2.2, 'sawtooth', 0.1, 0.45, 0.2); [440, 415, 392, 370].forEach((f, k) => T(f, 0.6, 'triangle', 0.04, 0.6, 0.3 + k * 0.18)); N(2.0, 0.24, 180, 0.4); break;
      // THE ABSOLUTE ABOVE: bright bells, rising fifths, warm pads
      case 'aa_bell': [1, 1.5, 2].forEach((m, k) => T(392 * m, 0.7, 'sine', 0.06, 1.0, k * 0.05)); T(196, 0.9, 'triangle', 0.08, 1); break;
      case 'aa_shield': T(587, 0.6, 'sine', 0.07, 1.5); T(880, 0.5, 'triangle', 0.04, 1.2, 0.08); break;
      case 'aa_gate': T(330, 0.4, 'triangle', 0.08, 2.2); T(660, 0.3, 'sine', 0.05, 1.6, 0.1); N(0.3, 0.08, 4200, 1.4); break;
      case 'aa_rewind': [880, 740, 587, 440].forEach((f, k) => T(f, 0.12, 'sine', 0.06, 1, k * 0.06)); break;
      case 'aa_ring': [1320, 1760].forEach((f, k) => T(f, 0.2, 'sine', 0.04, 1.02, k * 0.07)); break;
      case 'aa_counter': T(988, 0.25, 'square', 0.06, 0.6); T(247, 0.4, 'triangle', 0.1, 1); break;
      case 'aa_ult': [1, 1.25, 1.5, 2, 2.5, 3, 4].forEach((m, k) => T(196 * m, 1.6, 'sine', 0.055, 1, k * 0.1)); T(98, 2.4, 'triangle', 0.2, 0.6); N(1.4, 0.16, 5200, 1.2); break;
      // FATE NOTE: paper rustle, quill scratches, a slow minor music-box line
      case 'fn_write': for (let k = 0; k < 5; k++) N(0.06, 0.07, 3200 + k * 300, 3, k * 0.05); T(523, 0.3, 'triangle', 0.04, 0.99, 0.25); break;
      case 'fn_eye': T(110, 0.9, 'sawtooth', 0.08, 2); T(220, 0.7, 'sine', 0.05, 1.5, 0.1); break;
      case 'fn_chain': [880, 660, 990, 740].forEach((f, k) => T(f, 0.07, 'square', 0.04, 0.8, k * 0.04)); break;
      case 'fn_tick': T(1760, 0.04, 'square', 0.05, 1); break;
      case 'fn_burst': T(65, 0.9, 'sawtooth', 0.2, 0.4); N(0.8, 0.28, 500, 0.5); [587, 554, 523].forEach((f, k) => T(f, 0.4, 'triangle', 0.05, 1, 0.1 + k * 0.12)); break;
      case 'fn_shade': T(147, 0.8, 'triangle', 0.08, 0.7); T(73, 1.0, 'sine', 0.1, 0.6, 0.1); break;
      case 'fn_ult': [440, 415, 392, 349, 330].forEach((f, k) => T(f, 0.55, 'triangle', 0.06, 1, k * 0.22)); T(55, 2.4, 'sine', 0.24, 0.6); for (let k = 0; k < 8; k++) N(0.05, 0.06, 3000, 3, k * 0.12); break;
      // shared
      case 'transform': [1, 1.5, 2, 3, 4].forEach((m, k) => T(110 * m * (i === 1 ? 1.5 : i === 2 ? 0.75 : 1), 0.8, 'triangle', 0.06, 1.01, k * 0.1)); T(55, 1.6, 'sine', 0.3, 0.5); N(1.0, 0.2, 400, 0.5); break;
      case 'collision': T(40, 2.0, 'sawtooth', 0.2, 0.5); [392, 494, 587, 784].forEach((f, k) => T(f, 0.8, 'sine', 0.05, 1, 0.2 + k * 0.12)); N(1.4, 0.3, 300, 0.5); break;
      case 'press': T(1046, 0.12, 'square', 0.07, 1); break;
      case 'synergy': [523, 659, 784, 1046].forEach((f, k) => T(f, 0.4, 'triangle', 0.06, 1, k * 0.06)); break;
      case 'archon': T(30, 2.4, 'sawtooth', 0.26, 0.5); T(45, 2.0, 'square', 0.06, 0.6, 0.2); N(1.6, 0.3, 160, 0.4); break;
    }
  } catch (e) { /* audio is optional */ }
}

/* ---------------- registration: a God Ball bought with coins (Void Below / Absolute Above) or real money (Fate Note) ---------------- */
SUP.realityGodIds = SUP.realityGodIds || [];
function realityGodBall(def, cfg, buy) {
  godBall(def, cfg);
  Object.assign(def, { paid: true, free: false, realityGod: true, isNew: true, unlockAll: true, update29: true }, buy);
  SUP.godIds.splice(SUP.godIds.indexOf(def.id), 1); SUP.realityGodIds.push(def.id);
  return def;
}

/* =================== 1. THE VOID BELOW (50,000 coins) =================== */
/** removes enemy (non-ultimate) shots and zones inside a circle; returns how many were erased */
function rgErase(f, x, y, r, zones) {
  const B = BATTLE; let n = 0;
  for (let i = B.projs.length - 1; i >= 0; i--) { const p = B.projs[i]; if (p.team === f.team || p.ult || dist2(p.x, p.y, x, y) > r * r) continue; B.projs.splice(i, 1); n++; if (!FX.off) FX.burst(p.x, p.y, RG.CRIMSON, 5, 160, 3, 0.3); }
  if (zones) for (const z of B.zones) if (z.team !== f.team && z.life > 0 && dist2(z.x, z.y, x, y) < r * r && !z.arena29) { z.life = 0.01; n++; }
  return n;
}
/** jagged crimson reality cracks from a point (visual) */
function vVoidCracks(ctx, x, y, R, a, seed, col = RG.CRIMSON, n = 9) {
  if (a <= 0.01) return; let s = seed; const rr = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let px = x, py = y, ang = i / n * TAU + rr() * 0.6; const L = R * (0.55 + rr() * 0.45);
    ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, py);
    for (let d = 0; d < L; d += 26) { ang += (rr() - 0.5) * 0.9; px += Math.cos(ang) * 26; py += Math.sin(ang) * 26; ctx.lineTo(px, py); }
    ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}
function vBlackHole(ctx, x, y, r, a, t) {
  if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r); g.addColorStop(0, '#000000'); g.addColorStop(0.45, '#000000'); g.addColorStop(0.62, 'rgba(155,0,32,0.9)'); g.addColorStop(1, 'rgba(255,23,68,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(RG.CRIMSON, 0.8); ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x, y, r * (0.5 + i * 0.12), t * (3 - i * 0.5) + i, t * (3 - i * 0.5) + i + 2.2); ctx.stroke(); }
  ctx.restore();
}

GSK('vb_delete', 'control', '⌀', 'Reality Deletion', [
  'Marks the target with a crimson rift (0.8 s warning — walk out to escape). If it is still inside, it is pulled into an isolation rift for 1 s, takes void damage and returns to the same spot. Then 8 s deletion resistance.',
  'A wider rift; the target is isolated for 1.3 s, and enemy shots and zones inside the rift are deleted too.',
  'Two rifts: the target for 1.6 s and a second nearby enemy for 1 s; they come back cracked (+10% damage taken for 3 s).'],
(f, s, P, col, tgt) => {
  const k = gk(f), C = RG.DELETE; let t = supTarget(f, tgt);
  if (t && (rgResist(t, 'delImmT') || rgImmune(t))) t = rgFoes(f).find(e => !rgResist(e, 'delImmT') && !rgImmune(e)) || null;
  if (!t) return false;
  const marks = [{ e: t, x: t.x, y: t.y, R: C.r[k], dur: C.dur[k] }];
  if (k === 2) { const e2 = rgFoes(f).filter(e => e !== t && !rgResist(e, 'delImmT')).sort((a, b) => dist2(a.x, a.y, t.x, t.y) - dist2(b.x, b.y, t.x, t.y))[0]; if (e2) marks.push({ e: e2, x: e2.x, y: e2.y, R: 90, dur: 1.0 }); }
  for (const m of marks) {
    tele(m.x, m.y, m.R, RG.CRIMSON, C.warn);
    if (!FX.off) { const seed = (Math.random() * 1e6) | 0; vfx((ctx, q) => vVoidCracks(ctx, m.x, m.y, m.R * (0.4 + q * 0.6), 0.4 + q * 0.6, seed, RG.CRIMSON, 7), C.warn, { keep: true }); FX.text(m.e.x, m.e.y - m.e.r - 30, 'REALITY DELETION — MOVE!', '#ff8a80', 14, { life: 0.8 }); }
  }
  rgSound('vb_warn');
  after(C.warn, () => {
    if (!f.alive) return;
    for (const m of marks) {
      const e = m.e;
      if (k >= 1) rgEnergy(f, rgErase(f, m.x, m.y, m.R, true));
      if (!e.alive || e.st.outside > 0) continue;
      if (len(e.x - m.x, e.y - m.y) > m.R + e.r * 0.5) { rgSay(e, 'ESCAPED THE RIFT', '#ffffff', 13); continue; }
      if (rgBlocked(f, e) || rgResist(e, 'delImmT')) continue;
      const dur = m.dur * (e.boss ? 0.5 : 1), bx = e.x, by = e.y;
      sx(e).delImmT = C.imm + dur; e.st.outside = dur; e.vx = e.vy = 0;
      e.portalExit = { mode: 'point', x: bx, y: by, col: RG.CRIMSON, style: 'void', onExit: (m2) => {
        if (!f.alive) return; m2.st.invuln = 0;
        dealDamage(f, m2, SD(f, P) * C.dmg[k], { kind: 'skill', tag: 'skill', power: P });
        if (k === 2) sx(m2).fracT = 3;
        if (!FX.off) { FX.burst(m2.x, m2.y, RG.CRIMSON, 24, 340, 6, 0.6, 'shard'); FX.text(m2.x, m2.y - m2.r - 26, 'RETURNED', '#ffcdd2', 13, { life: 0.7 }); }
      } };
      rgEnergy(f, RG.NEGATE.gain.del);
      if (!FX.off) { rgSound('vb_delete'); darkBurst(bx, by, 140, 0.6); FX.text(bx, by - 46, 'DELETED FROM REALITY', RG.CRIMSON, 16, { life: 1.1, pop: 1.5 }); }
    }
  });
});

GSK('vb_consume', 'control', '◉', 'Void Consumption', [
  'Opens a black hole at the target for 2.2 s: it pulls enemies in and damages them while they are inside.',
  'A 2.6 s black hole that also swallows enemy shots that come close; every shot it eats feeds Destruction Energy and makes it bigger.',
  'Two black holes circle each other, merge into one singularity and burst.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), C = RG.CONSUME, life = C.life[k], cx = inArenaX(t.x, 80), cy = inArenaY(t.y, 80);
  const hole = (x, y, r, pull) => { const z = supZone(f, { kind: 'gravity', x, y, r, life, col: RG.BLOOD, pull, dmg: SD(f, P) * 0.032, power: P, vbHole: true, eat: k >= 1, r0: r });
    if (!FX.off) vfx((ctx, q) => { if (z.life > 0) vBlackHole(ctx, z.x, z.y, z.r * 0.55, Math.min(1, q * 6, (1 - q) * 8), BATTLE.time); }, life, { keep: true }); return z; };
  if (k < 2) hole(cx, cy, C.r[k], C.pull[k]);
  else { const a0 = rand(TAU); for (let i = 0; i < 2; i++) { const z = hole(cx, cy, C.r[k], C.pull[k]); z.orbit = { cx, cy, a: a0 + i * Math.PI, R0: 150, t0: BATTLE.time, life }; }
    after(life, () => { if (!f.alive) return; supBlast(f, cx, cy, 230, SD(f, P) * 0.5, { tag: 'explosion', force: 700, power: P }); if (!FX.off) { darkBurst(cx, cy, 230, 0.8); FX.ring(cx, cy, RG.CRIMSON, 280, 0.5, 12, 30); FX.addShake(12); rgSound('vb_boom'); } }); }
  rgSound('vb_hole');
});

/* Reality Fracture: zones where movement itself is broken */
const FRACT = {
  heavy: { name: 'HEAVY', col: '#b0002a', desc: 'strong gravity, slow' },
  slip: { name: 'SLIP', col: '#ff8a80', desc: 'no grip: movement drifts sideways' },
  reverse: { name: 'REVERSE', col: '#ff1744', desc: 'steering is reversed' },
};
function fractTick(z, e, d, h) {
  if (d > z.r + e.r * 0.3 || rgImmune(e)) return;
  const S = sx(e);
  if (z.fk === 'heavy') { const kk = dexp(-2.4 * h); e.vx *= kk; e.vy *= kk; e.st.slow = Math.max(e.st.slow, 0.25); }
  else if (z.fk === 'slip') { const a = 1.7 * h, ca = dcos(a), sa = dsin(a), vx = e.vx; e.vx = vx * ca - e.vy * sa; e.vy = vx * sa + e.vy * ca; }
  else if (z.fk === 'reverse') S.revT = 0.25;
  S.fractT = 0.2; S.fractName = FRACT[z.fk].name;
  if ((z.ticks.get(e.sid) || 0) <= BATTLE.time) { z.ticks.set(e.sid, BATTLE.time + RG.FRACTURE.tick); dealDamage(z.owner, e, SD(z.owner, z.power) * RG.FRACTURE.dmg * (z.k2 ? 1.2 : 1), { kind: 'skill', tag: 'zone', power: z.power, noCrit: true }); }
}
function fractDraw(ctx, z, t) {
  const F = FRACT[z.fk], a = Math.min(1, (z.max - z.life) * 4, z.life * 3);
  ctx.save(); ctx.globalAlpha = 0.55 * a;
  const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r); g.addColorStop(0, rgba(F.col, 0.05)); g.addColorStop(0.8, rgba(F.col, 0.22)); g.addColorStop(1, rgba(F.col, 0.5)); ctx.fillStyle = g;
  ctx.beginPath(); for (let i = 0; i <= 10; i++) { const an = i / 10 * TAU, rr = z.r * (0.92 + 0.08 * Math.sin(i * 7.3 + z.seed)); i ? ctx.lineTo(z.x + Math.cos(an) * rr, z.y + Math.sin(an) * rr) : ctx.moveTo(z.x + Math.cos(an) * rr, z.y + Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
  ctx.globalAlpha = a; ctx.strokeStyle = F.col; ctx.lineWidth = 2.5; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t * 30; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff'; ctx.font = '800 12px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(F.name, z.x, z.y - z.r - 6);
  if (z.fk === 'reverse') { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * 0.45, t * -2, t * -2 + 4.5); ctx.stroke(); }
  if (z.fk === 'slip') { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(z.x - z.r * 0.5, z.y + i * 16 + Math.sin(t * 4 + i) * 6); ctx.lineTo(z.x + z.r * 0.5, z.y + i * 16 - Math.sin(t * 4 + i) * 6); ctx.stroke(); } }
  if (z.fk === 'heavy') { ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 6; i++) { const yy = ((t * 60 + i * 30) % (z.r * 1.4)) - z.r * 0.7; ctx.fillRect(z.x - z.r * 0.5 + i * z.r * 0.2, z.y + yy, 2, 8); } }
  ctx.restore();
}
GSK('vb_fracture', 'control', '⟁', 'Reality Fracture', [
  'Fractures reality at the target into 2 zones for 4 s: HEAVY (strong gravity, slow) and SLIP (no grip, movement drifts). Damage while inside.',
  '3 zones for 4.5 s, adding a REVERSE zone that turns steering around.',
  '4 zones for 5 s that drift around the target; their damage is 20% higher.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), C = RG.FRACTURE, n = [2, 3, 4][k], kinds = ['heavy', 'slip', 'reverse', 'heavy'], R = C.r[k], a0 = rand(TAU);
  for (let i = 0; i < n; i++) {
    const a = a0 + i / n * TAU, d = i === 0 ? 0 : R * 1.75, x = inArenaX(t.x + dcos(a) * d, 40), y = inArenaY(t.y + dsin(a) * d, 40);
    supZone(f, { custom: true, kind: 'fracture', fk: kinds[i], x, y, r: R, life: C.life[k], col: FRACT[kinds[i]].col, power: P, k2: k === 2, seed: rand(1000) | 0,
      drift: k === 2 ? { a: a + HPI, sp: 46 } : null, onTick: fractTick, draw: fractDraw });
  }
  if (!FX.off) { const seed = (Math.random() * 1e6) | 0; vfx((ctx, q) => vVoidCracks(ctx, t.x, t.y, R * 2.4, 1 - q, seed, '#ff8a80', 11), 0.8); rgSound('vb_crack'); FX.addShake(5); }
 
});

/** Existence Suppression: seals ONE eligible ability (never the ultimate) for a short time */
function rgSuppress(f, e, k) {
  if (!e.alive || (e.isClone && !e.decoy) || e.minion) return;
  if (rgResist(e, 'suppImmT')) { rgSay(e, 'SUPPRESSION RESISTED', '#ffcdd2', 12); return; }
  if (rgBlocked(f, e)) return;
  const list = (e.skills || []).filter(x => !x.locked && !x.disabled && !(x.supp29 > BATTLE.time) && !x.passive26);
  if (!list.length) return;
  const pick = list.slice().sort((a, b) => (a.cdLeft - b.cdLeft) || ((b.power || 0) - (a.power || 0)))[0];
  const dur = RG.SUPPRESS.dur[k] * (e.boss ? 0.5 : 1), S = sx(e);
  pick.supp29 = BATTLE.time + dur; S.suppT = dur; S.suppName = pick.name; S.suppImmT = RG.SUPPRESS.imm + dur;
  if (k === 2) e.ultMeter = Math.max(0, e.ultMeter - RG.SUPPRESS.ult);
  rgEnergy(f, 4);
  if (!FX.off) { FX.text(e.x, e.y - e.r - 34, 'SUPPRESSED: ' + pick.name, RG.CRIMSON, 15, { life: 1.2, pop: 1.4 }); FX.ring(e.x, e.y, RG.CRIMSON, e.r * 2.2, 0.4, 5, e.r); }
}
GSK('vb_suppress', 'ranged', '⊗', 'Existence Suppression', [
  'After a 0.5 s warning line it fires a suppression bolt along that line (dodge it). The ball it hits has ONE ability sealed for 3 s (never its ultimate), then 10 s suppression resistance.',
  'The bolt pierces and can suppress 2 enemies; it seals the ability that is closest to ready.',
  'Three bolts in a fan; a suppressed enemy also loses 15 ultimate charge and its ability is sealed for 3.5 s.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), C = RG.SUPPRESS, a0 = aimAngle(f, t, C.speed), angs = k === 2 ? [-0.22, 0, 0.22] : [0];
  for (const da of angs) { const end = rayToWall(f.x, f.y, a0 + da); teleLine(f.x, f.y, end.x, end.y, RG.CRIMSON, C.warn, 8); }
  f.casting = C.warn;
  f.castFn = () => {
    if (!f.alive) return;
    for (const da of angs) supShot(f, f.x, f.y, a0 + da, { speed: C.speed, r: 10, dmg: SD(f, P) * 0.2, col: RG.CRIMSON, style: 'vb_supp', power: P, life: 1.8, pierce: k === 1 ? 1 : 0, onHit: (p, e) => rgSuppress(f, e, k) });
    rgSound('vb_supp');
  };
 
});

GSK('vb_core', 'aoe', '✹', 'Apocalypse Core', [
  'Charges a crimson core for 1 s (a ring shows its reach), then releases a shockwave. More Destruction Energy makes it stronger (up to +40%).',
  'Charges for 1.2 s while pulling enemies slightly inward, then a double shockwave.',
  'Charges for 1.4 s, then three shockwaves in a row and a ring of crimson shards.'],
(f, s, P, col) => {
  const k = gk(f), C = RG.CORE, ch = C.charge[k], R = C.r[k];
  if (!supEnemies(f).some(e => len(e.x - f.x, e.y - f.y) < R + 220)) return false;
  f.casting = ch;
  if (!FX.off) vfx((ctx, q) => { if (!f.alive) return; ctx.save(); ctx.globalAlpha = 0.3 + 0.5 * q; ctx.strokeStyle = RG.EMBER; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (1 + q * 1.4)); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, rgba(RG.EMBER, 0.8)); g.addColorStop(1, rgba(RG.CRIMSON, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + q * 1.4), 0, TAU); ctx.fill(); ctx.restore(); }, ch, { keep: true });
  if (k === 1) supZone(f, { kind: 'gravity', follow: f, x: f.x, y: f.y, r: R, life: ch, col: RG.BLOOD, pull: 380, dmg: 0, power: P });
  rgSound('vb_charge');
  f.castFn = () => {
    if (!f.alive) return; const mul = 1 + clamp(f.sx.rgE || 0, 0, 100) / 250;
    for (let i = 0; i <= k; i++) after(i * 0.22, () => { if (f.alive) supWave(f, f.x, f.y, R + i * 60, SD(f, P) * C.dmg[k] * mul, i % 2 ? '#ffffff' : RG.EMBER, { speed: 820 - i * 90, w: 24, force: 620, power: P }); });
    if (k === 2) for (let i = 0; i < 16; i++) supShot(f, f.x, f.y, i / 16 * TAU, { speed: 560, r: 7, dmg: SD(f, P) * 0.045 * mul, col: RG.CRIMSON, style: 'voidshard', power: P, life: 1.2 });
    if (!FX.off) { FX.addShake(14); FX.addFlash(0.18, RG.EMBER); darkBurst(f.x, f.y, R, 0.6); rgSound('vb_boom'); }
  };
 
}, true);

/* ultimates: END OF EXISTENCE / OMNIVERSAL COLLAPSE — reality cracks, everything is drawn into one void point, then the arena is restored */
function rgCentroid(list) { if (!list.length) return { x: ARENA.cx, y: ARENA.cy }; let x = 0, y = 0; for (const e of list) { x += e.x; y += e.y; } return { x: x / list.length, y: y / list.length }; }
function rgRestoreFx(col, label) {
  if (FX.off) return;
  vfx((ctx, q) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const x = ARENA.x + ARENA.w * q; const g = ctx.createLinearGradient(x - 120, 0, x + 20, 0); g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.8, rgba(col, 0.35)); g.addColorStop(1, 'rgba(255,255,255,0.6)');
    ctx.fillStyle = g; ctx.fillRect(x - 120, ARENA.y, 140, ARENA.h); ctx.restore(); }, 1.0);
  FX.text(ARENA.cx, ARENA.cy - 20, label || 'REALITY RESTORED', '#ffffff', 26, { life: 1.4, vy: 0, pop: 1.6, stroke: '#000000' });
}
function vbUlt(f, P, dmg, fin) {
  const B = BATTLE, c = rgCentroid(rgFoes(f)), cx = inArenaX(c.x, 140), cy = inArenaY(c.y, 110), R = fin ? 640 : 540;
  gmCount(f, 'ults');
  if (!FX.off) {
    rgBanner(fin ? '✖ OMNIVERSAL COLLAPSE ✖' : 'END OF EXISTENCE', fin ? '#ffffff' : RG.CRIMSON, fin ? 40 : 46, fin ? 'every reality folds into one point' : 'existence is denied', '#ff8a80');
    darkArena(fin ? 4.2 : 3.4, '#0a0000', 0.8); camPunch(cx, cy, 0.2, fin ? 3.4 : 2.6); rgSound('vb_ult'); FX.addShake(10);
    const seed = (Math.random() * 1e6) | 0, dur = fin ? 3.8 : 3.0;
    vfx((ctx, q) => { const a = q < 0.75 ? Math.min(1, q * 3) : (1 - q) * 4; vVoidCracks(ctx, cx, cy, Math.max(ARENA.w, ARENA.h) * Math.min(1, q * 1.6), a, seed, RG.CRIMSON, fin ? 16 : 12); vBlackHole(ctx, cx, cy, 70 + (fin ? 60 : 30) * Math.min(1, q * 3), a, q * 8); }, dur);
    if (fin) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * q) * 0.8; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + q * 2, d = (1 - q) * 520 + 40; vFragment(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, 18, a + q * 6, i % 2 ? '#ffffff' : RG.CRIMSON); } ctx.restore(); }, 2.6);
  }
  supZone(f, { kind: 'gravity', x: cx, y: cy, r: R, life: 1.4, col: RG.BLOOD, pull: fin ? 1700 : 1400, dmg: dmg * 0.02, power: P });
  after(1.2, () => {
    if (!f.alive) return; rgErase(f, ARENA.cx, ARENA.cy, 2000, false);
    for (const e of rgFoes(f)) { const d = len(e.x - cx, e.y - cy); if (d < R) { dealDamage(f, e, dmg * (fin ? 0.4 : 0.5) * (1 - 0.35 * clamp(d / R, 0, 1)), { kind: 'skill', tag: 'explosion', power: P }); knock(e, cx, cy, 700); } }
    if (!FX.off) { FX.addFlash(0.35, RG.CRIMSON); FX.addShake(20); FX.ring(cx, cy, '#ffffff', R, 0.6, 16, 40); rgSound('vb_boom'); }
  });
  if (fin) after(1.7, () => {      // every enemy is deleted for a moment and dropped back at the void point
    if (!f.alive) return; let i = 0;
    for (const e of rgFoes(f)) {
      if (rgBlocked(f, e)) continue; const a = (i++) / 4 * TAU, x = cx + dcos(a) * 90, y = cy + dsin(a) * 70;
      e.st.outside = e.boss ? 0.4 : 0.8; e.vx = e.vy = 0;
      e.portalExit = { mode: 'point', x, y, col: RG.CRIMSON, style: 'void', onExit: m => { if (!f.alive) return; m.st.invuln = 0; dealDamage(f, m, dmg * 0.25, { kind: 'skill', tag: 'explosion', power: P }); } };
    }
  });
  after(fin ? 2.7 : 2.0, () => { if (!f.alive) return; supWave(f, cx, cy, fin ? 700 : 560, dmg * (fin ? 0.22 : 0.3), RG.CRIMSON, { speed: 900, w: 34, force: 800, power: P });
    if (fin) after(0.3, () => { if (f.alive) supWave(f, cx, cy, 760, dmg * 0.16, '#ffffff', { speed: 1000, w: 28, force: 600, power: P }); }); });
  after(fin ? 3.7 : 2.9, () => rgRestoreFx(RG.CRIMSON, 'REALITY RESTORED'));
}
UL('vb_end', 'End of Existence — reality cracks across the arena, everything is pulled into one void point, existence is erased (enemy shots vanish) and the void collapses; then the arena is restored', (f, P, col, dmg) => vbUlt(f, P, dmg, false));
UL('vb_omni', 'Omniversal Collapse — the arena shatters into fragments, every enemy is deleted for a moment and dropped back into the void point, two collapse waves follow, then reality is restored', (f, P, col, dmg) => vbUlt(f, P, dmg, true));

realityGodBall(B('voidbelow', 'THE VOID BELOW', 'God', 'God Tier', [140, 94, 78, 80, 32], D(RG.VOID, RG.CRIMSON, '#ff5252', 'voidbelow', [], '', { glow: 1.7, sdeco: ['vbshards'], vbk: 0, sfx: { wave: 'sawtooth', pitch: 0.6 } }),
  [S('REALITY DELETION', 'vb_delete', 13, 70, RG.CRIMSON), S('VOID CONSUMPTION', 'vb_consume', 11, 65, '#b0002a'), S('REALITY FRACTURE', 'vb_fracture', 12, 55, '#ff5252'),
    S('EXISTENCE SUPPRESSION', 'vb_suppress', 14, 60, RG.CRIMSON), S('APOCALYPSE CORE', 'vb_core', 10, 85, RG.EMBER)],
  U('END OF EXISTENCE', 'vb_end', 115, RG.CRIMSON), 'aggressive', { desc: 'REALITY GOD • 50,000 COINS. The crimson void beneath every world: it deletes, consumes and fractures reality — and leaves nothing standing.' }), {
  godClass: 'REALITY GOD • DESTRUCTION', formMul: [1, 1.08, 1.14], skillK: [1.05, 0.88, 0.7],
  forms: [{ name: 'VOID ENTITY' },
    { name: 'REALITY DEVOURER', design: { c3: '#ff8a80', vbk: 1, glow: 2.0, sdeco: ['vbshards', 'vbhalo'] } },
    { name: 'THE END OF EVERYTHING', design: { c1: '#000000', c2: RG.CRIMSON, c3: '#ffffff', pat: 'voidbelow2', vbk: 2, glow: 2.6, sdeco: ['vbshards', 'vbhalo', 'vbeye'] } }],
  finalUlt: U('OMNIVERSAL COLLAPSE', 'vb_omni', 125, '#ffffff'), sound: { base: 73, wave: 'sawtooth', slide: 0.4, noise: 300 },
  passiveInfo: { name: 'ABSOLUTE NEGATION', desc: 'Hits, deletions and swallowed shots fill DESTRUCTION ENERGY. At 100 it unleashes NEGATION: for a few seconds its hits deal 12% more damage, it takes 15% less damage and enemy shots that touch it are negated (up to 6). Then the meter starts again.' },
  formPassive: ['Negation lasts 4 s.', 'Negation lasts 5 s.', 'Negation lasts 6 s.'],
  passive: {
    init(f) { f.sx.rgE = 0; rgMeter(f); },
    tick(f) {
      const S = f.sx;
      if (S.rgE >= 100 && !(S.negT > 0)) { S.negT = RG.NEGATE.dur[f.form]; S.negN = RG.NEGATE.shots; S.rgE = 0; S.rgLockT = S.negT;
        if (!FX.off) { FX.text(f.x, f.y - f.r - 44, 'ABSOLUTE NEGATION', RG.CRIMSON, 22, { life: 1.4, pop: 1.8, stroke: '#000000' }); FX.ring(f.x, f.y, RG.CRIMSON, f.r * 3.2, 0.5, 8, f.r); darkBurst(f.x, f.y, 160, 0.6); rgSound('vb_delete'); } }
    },
  },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.55) { const a = Math.random() * TAU, R = f.r * (1.6 + Math.random()); FX.p(f.x + Math.cos(a) * R, f.y + Math.sin(a) * R, -Math.cos(a) * R * 1.5, -Math.sin(a) * R * 1.5, 0.5, 2 + Math.random() * 2, Math.random() < 0.6 ? RG.CRIMSON : '#000000', 'dot', 0); } },
    bounce: (f, x, y) => { FX.sparks(x, y, RG.CRIMSON, 8, 320); },
    victory: (f) => { rgSound('vb_boom'); const seed = (Math.random() * 1e6) | 0; vfx((ctx, q) => vVoidCracks(ctx, f.x, f.y, 260 * q, 1 - q, seed), 1.6); FX.text(f.x, f.y - f.r - 70, f.form === 2 ? 'NOTHING REMAINS' : 'CONSUMED BY THE VOID', RG.CRIMSON, 22, { life: 1.8, stroke: '#000000' }); },
    defeat: (f) => { FX.burst(f.x, f.y, '#000000', 40, 300, 8, 0.9, 'smoke'); FX.burst(f.x, f.y, RG.CRIMSON, 24, 420, 5, 0.7, 'shard'); },
    entrance: (f) => { const seed = (Math.random() * 1e6) | 0; vfx((ctx, q) => vVoidCracks(ctx, f.x, f.y, ARENA.w * q, Math.sin(Math.PI * q), seed, RG.CRIMSON, 14), 1.6); },
  },
}, { coinGod: true, coinPrice: RG.COIN_PRICE, buyLabel: '50,000 coins' });

/* =================== 2. THE ABSOLUTE ABOVE (50,000 coins) =================== */
const RG_BAD = ['stun', 'slow', 'freeze', 'weaken', 'burn', 'poison', 'silence', 'nulled', 'antievo', 'timestop'];
/** removes harmful effects (the longest first); n = how many. Also lifts 2.9.0 reality effects and a Death Sentence */
function rgCleanse(f, n) {
  const st = f.st, S = sx(f); let done = 0;
  const list = RG_BAD.filter(k => st[k] > 0).sort((a, b) => st[b] - st[a]);
  for (const k of list) { if (done >= n) break; st[k] = 0; done++; }
  if (n >= 99 || !done) {
    if (S.revT > 0 || S.bindT > 0 || S.fateCdT > 0) { S.revT = 0; S.bindT = 0; S.fateCdT = 0; done++; }
    for (const s of f.skills || []) if (s.supp29 > BATTLE.time) { s.supp29 = 0; S.suppT = 0; done++; }
  }
  if (S.sentence && (n >= 99 || done < n + 1)) { fateLog(BATTLE, S.sentence.by, f, 'sentence cleansed'); S.sentence = null; done++; if (!FX.off) FX.text(f.x, f.y - f.r - 40, 'SENTENCE LIFTED', RG.GOLD, 15, { life: 1 }); }
  return done;
}
/** a spot is valid when it is inside the arena and not inside a REALITY COLLISION ZONE obstacle */
function rgValidSpot(x, y, r) { if (x < ARENA.x + r || x > ARENA.r - r || y < ARENA.y + r || y > ARENA.b - r) return false; return typeof rzFree === 'function' ? rzFree(x, y, r) : true; }
function vLawCircle(ctx, x, y, R, a, t, col = RG.GOLD) {
  if (a <= 0.01 || R < 4) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y);
  ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R * 0.86, 0, TAU); ctx.stroke();
  ctx.rotate(t * 0.4); ctx.beginPath(); for (let i = 0; i <= 6; i++) { const b = i / 6 * TAU * 2; i ? ctx.lineTo(Math.cos(b) * R * 0.86, Math.sin(b) * R * 0.86) : ctx.moveTo(Math.cos(b) * R * 0.86, Math.sin(b) * R * 0.86); } ctx.stroke();
  ctx.fillStyle = rgba('#ffffff', 0.8); for (let i = 0; i < 24; i++) { const b = i / 24 * TAU; ctx.fillRect(Math.cos(b) * R * 0.93 - 2, Math.sin(b) * R * 0.93 - 2, 4, 4); }
  ctx.restore();
}
function aaGate(x, y, r, life = 0.7) { if (!FX.off) vfx((ctx, q) => vPortalRing(ctx, x, y, r * (q < 0.2 ? q * 5 : 1), RG.GOLD, q > 0.7 ? (1 - q) / 0.3 : 1, q * 6), life); }

GSK('aa_restore', 'buff', '✚', 'Reality Restoration', [
  'Golden light restores it: heals 12% of the HP it has lost and removes one harmful effect; enemy zones near it dissolve.',
  'Also heals allies nearby (8% of their lost HP) and returns the arena around it to normal: enemy walls, zones and traps within 320 px are removed.',
  'Restores up to 10% of its max HP that it lost in the last 3 s, removes every harmful effect, and the light damages enemies inside.'],
(f, s, P, col) => {
  const k = gk(f), C = RG.RESTORE, B = BATTLE, lost = f.maxHp - f.hp, R = k ? C.r : 220;
  const zonesNear = B.zones.some(z => z.team !== f.team && z.life > 0 && !z.arena29 && dist2(z.x, z.y, f.x, f.y) < R * R);
  if (lost < f.maxHp * 0.05 && !RG_BAD.some(x => f.st[x] > 0) && !zonesNear && !(f.sx && f.sx.sentence)) return false;
  let heal = lost * C.heal[k];
  if (k === 2) { const h = f.hist, old = h.length >= 30 ? h[h.length - 30].hp : f.hp; heal = Math.max(lost * 0.06, Math.min(f.maxHp * 0.1, Math.max(0, old - f.hp))); }
  healFighter(f, heal); rgCleanse(f, k === 2 ? 99 : 1);
  for (const z of B.zones) if (z.team !== f.team && z.life > 0 && !z.arena29 && dist2(z.x, z.y, f.x, f.y) < R * R) z.life = 0.01;
  if (k >= 1) {
    if (B.walls26) for (const w of B.walls26) if (w.team !== f.team && segDist(f.x, f.y, w.x1, w.y1, w.x2, w.y2) < R) w.life = 0.01;
    for (const a of allies(f)) if (a !== f && len(a.x - f.x, a.y - f.y) < R) { healFighter(a, (a.maxHp - a.hp) * C.ally); rgCleanse(a, 1); if (!FX.off) FX.ring(a.x, a.y, RG.GOLD, a.r * 2, 0.4, 5, a.r); }
  }
  if (k === 2) supBlast(f, f.x, f.y, 260, SD(f, P) * 0.3, { tag: 'explosion', force: 380, power: P });
  rgEnergy(f, 6);
  if (!FX.off) { rgSound('aa_bell'); for (let i = 0; i < 3; i++) FX.ring(f.x, f.y, i % 2 ? '#ffffff' : RG.GOLD, R * (0.5 + i * 0.25), 0.5 + i * 0.1, 6, f.r); vfx((ctx, q) => vLawCircle(ctx, f.x, f.y, R * (0.6 + q * 0.4), 1 - q, q * 4), 0.8); FX.text(f.x, f.y - f.r - 36, 'REALITY RESTORED', RG.GOLD, 15, { life: 1 }); }
}, true);

GSK('aa_immune', 'defense', '⛨', 'Absolute Immunity', [
  'For 3 s it is immune to reality manipulation: deletion, ability suppression, fracture zones, fate chains, reversed steering, time stop and cooldown slow-downs, and abilities of its rival The Void Below hit it 55% softer. Other damage still hits it normally.',
  'For 3.5 s, and harmful effects already on it are halved.',
  'For 4 s, and the first reality effect it blocks is reflected back at the attacker as a golden lance.'],
(f, s, P) => {
  const k = gk(f), S = sx(f); if (S.immT > 0) return false;
  S.immT = RG.IMMUNE.dur[k]; S.immK = k; S.immRefl = false;
  S.revT = 0; S.bindT = 0; S.fateCdT = 0; f.st.timestop = 0;
  for (const x of f.skills || []) if (x.supp29 > BATTLE.time) x.supp29 = 0;
  if (k >= 1) for (const x of RG_BAD) if (f.st[x] > 0) f.st[x] *= 0.5;
  rgEnergy(f, 4);
  if (!FX.off) { rgSound('aa_shield'); FX.ring(f.x, f.y, RG.WHITE, f.r * 2.6, 0.5, 6, f.r); FX.text(f.x, f.y - f.r - 36, 'ABSOLUTE IMMUNITY', RG.GOLD, 16, { life: 1.1 }); }
}, true);

GSK('aa_authority', 'mobility', '⟐', 'Dimensional Authority', [
  'Opens two golden gates: it steps through one and comes out of the other behind the target, with a golden lance strike.',
  'Two gate jumps in a row (striking from both sides); the gates stay open for 3 s and carry anyone who enters them.',
  'Authority gates: it crosses to the other side of the arena, and three gates open around the target and fire golden lances at it (each lance is marked first).'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), B = BATTLE;
  const lance = (x, y, tt, mul) => supShot(f, x, y, aimAngle({ x, y }, tt, 900), { speed: 900, r: 9, dmg: SD(f, P) * mul, col: RG.GOLD, style: 'k_spear', power: P, life: 1.2 });
  const hop = (a, d) => {
    const ox = f.x, oy = f.y; let nx = inArenaX(t.x + dcos(a) * d, f.r + 6), ny = inArenaY(t.y + dsin(a) * d, f.r + 6);
    if (!rgValidSpot(nx, ny, f.r)) { nx = inArenaX(t.x - dcos(a) * d, f.r + 6); ny = inArenaY(t.y - dsin(a) * d, f.r + 6); }
    if (!rgValidSpot(nx, ny, f.r)) return null;
    aaGate(ox, oy, f.r * 1.4); aaGate(nx, ny, f.r * 1.4);
    f.x = nx; f.y = ny; const b = angTo(f, t); f.vx = dcos(b) * f.baseSpeed * 1.8; f.vy = dsin(b) * f.baseSpeed * 1.8; f.st.invuln = Math.max(f.st.invuln, 0.15);
    return { ox, oy, nx, ny };
  };
  const a0 = angTo(t, f);
  if (k === 0) { if (!hop(a0 + Math.PI, t.r + 90)) return false; lance(f.x, f.y, t, 0.4); }
  else if (k === 1) {
    const h1 = hop(a0 + HPI, t.r + 100); if (!h1) return false; lance(f.x, f.y, t, 0.26);
    after(0.35, () => { if (f.alive && t.alive && hop(a0 - HPI, t.r + 100)) lance(f.x, f.y, t, 0.26); });
    (B.portalPairs || (B.portalPairs = [])).push({ ax: inArenaX(h1.ox, 50), ay: inArenaY(h1.oy, 50), bx: inArenaX(h1.nx, 50), by: inArenaY(h1.ny, 50), r: 40, t: 3, col: RG.GOLD, col2: '#ffffff', dim: f.dim || 0 });
  } else {
    const mx = inArenaX(ARENA.cx * 2 - f.x, f.r + 10), my = inArenaY(f.y, f.r + 10);
    if (rgValidSpot(mx, my, f.r)) { aaGate(f.x, f.y, f.r * 1.5); aaGate(mx, my, f.r * 1.5); f.x = mx; f.y = my; }
    const g0 = rand(TAU);
    for (let i = 0; i < 3; i++) { const a = g0 + i / 3 * TAU, gx = inArenaX(t.x + dcos(a) * 200, 30), gy = inArenaY(t.y + dsin(a) * 200, 30);
      aaGate(gx, gy, 30, 1.0); teleLine(gx, gy, t.x, t.y, RG.GOLD, 0.4, 6);
      after(0.4, () => { if (f.alive && t.alive) lance(gx, gy, t, 0.2); }); }
  }
  rgEnergy(f, 3);
  if (!FX.off) rgSound('aa_gate');
});

GSK('aa_rewrite', 'defense', '↺', 'Existence Rewrite', [
  'Rewrites its own existence: removes every harmful effect and returns it to where it was 1.5 s ago (only to a valid spot inside the arena).',
  'Also cleanses one ally nearby, and leaves a golden afterimage at the old spot that slows enemies.',
  'Also gets back up to 8% max HP of what it lost since then, and the afterimage bursts with golden light.'],
(f, s, P) => {
  const k = gk(f), h = f.hist, i = h.length - RG.REWRITE.back;
  if (i < 0) return false;
  const old = h[i], ox = f.x, oy = f.y; let x = old.x, y = old.y;
  if (!rgValidSpot(x, y, f.r)) { x = f.x; y = f.y; }
  rgCleanse(f, 99);
  if (k >= 1) { supZone(f, { kind: 'trap', x: ox, y: oy, r: 90, life: 2, col: RG.GOLD, power: P, dmg: SD(f, P) * 0.02 });
    const a = allies(f).filter(q => q !== f && len(q.x - f.x, q.y - f.y) < 320)[0]; if (a) rgCleanse(a, 1); }
  if (k === 2) { healFighter(f, Math.min(f.maxHp * RG.REWRITE.heal, Math.max(0, old.hp - f.hp))); after(0.6, () => { if (f.alive) supBlast(f, ox, oy, 150, SD(f, P) * 0.35, { tag: 'explosion', force: 420, power: P }); if (!FX.off) FX.ring(ox, oy, RG.GOLD, 170, 0.5, 10, 20); }); }
  f.x = x; f.y = y; f.vx *= 0.3; f.vy *= 0.3; f.st.invuln = Math.max(f.st.invuln, 0.3);
  rgEnergy(f, 6);
  if (!FX.off) { rgSound('aa_rewind'); FX.burst(ox, oy, RG.GOLD, 20, 260, 5, 0.6); vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = RG.GOLD; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, y); ctx.stroke(); ctx.restore(); }, 0.6); FX.text(x, y - f.r - 30, 'EXISTENCE REWRITTEN', RG.GOLD, 14, { life: 0.9 }); }
}, true);

GSK('aa_rings', 'defense', '◎', 'Infinite Authority', [
  'Golden authority rings orbit it for 4 s: enemy shots that reach them are intercepted and destroyed (up to 6; never ultimates).',
  'Intercepted shots are sent back toward their owner (up to 8).',
  'Five rings for 5 s: each redirected shot splits in two, and every intercept builds extra Authority Energy (up to 10).'],
(f, s, P) => {
  const k = gk(f), S = sx(f); if (S.ringsT > 0) return false;
  S.ringsT = RG.RINGS.dur[k]; S.ringsK = k; S.ringsN = RG.RINGS.n[k];
  if (!FX.off) { rgSound('aa_ring'); const n = k === 2 ? 5 : 3; vfx((ctx) => { if (!(f.sx.ringsT > 0) || !f.alive) return; const R = f.r * RG.RINGS.R; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(BATTLE.time * (0.8 + i * 0.3) * (i % 2 ? -1 : 1) + i); ctx.scale(1, 0.4 + 0.12 * i); ctx.strokeStyle = rgba(i % 2 ? '#ffffff' : RG.GOLD, 0.85); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, R + i * 6, 0, TAU); ctx.stroke(); ctx.restore(); }
    ctx.restore(); }, S.ringsT + 0.1, { keep: true }); }
}, true);

/* ultimates: THE LAW ABOVE EVERYTHING / ETERNAL REALITY DOMINION */
function aaUlt(f, P, dmg, fin) {
  const B = BATTLE;
  gmCount(f, 'ults');
  if (!FX.off) {
    rgBanner(fin ? '✦ ETERNAL REALITY DOMINION ✦' : 'THE LAW ABOVE EVERYTHING', fin ? '#ffffff' : RG.GOLD, fin ? 38 : 42, fin ? 'reality answers to one authority' : 'every law returns to its place', RG.SKY);
    darkArena(fin ? 4.2 : 3.4, '#140d00', 0.5); camPunch(f.x, f.y, 0.16, 2.4); rgSound('aa_ult'); FX.addFlash(0.25, RG.GOLD);
    vfx((ctx, q) => vLawCircle(ctx, f.x, f.y, Math.max(ARENA.w, ARENA.h) * 0.75 * Math.min(1, q * 2.2), q < 0.8 ? 1 : (1 - q) * 5, q * 6, fin ? '#ffffff' : RG.GOLD), fin ? 3.8 : 3.0);
  }
  after(0.6, () => {
    if (!f.alive) return; rgErase(f, ARENA.cx, ARENA.cy, 2000, true);
    if (B.walls26) for (const w of B.walls26) if (w.team !== f.team) w.life = 0.01;
    for (const a of allies(f)) { healFighter(a, a.maxHp * 0.1); rgCleanse(a, 1); }
    for (const e of rgFoes(f)) e.st.slow = Math.max(e.st.slow, 2);
    if (!FX.off) { FX.text(ARENA.cx, ARENA.cy - 40, 'THE LAW IS RESTORED', '#ffffff', 26, { life: 1.2, vy: 0, stroke: '#3a2600' }); FX.addShake(8); }
  });
  const waves = fin ? 3 : 2, k = fin ? 0.18 : 0.24;
  for (let w = 0; w < waves; w++) after(1.0 + w * 0.7, () => {
    if (!f.alive) return;
    for (const e of rgFoes(f)) { supStrike(f, e.x, e.y, 0.6, 80, dmg * k, RG.GOLD, { kind: 'pillar', power: P }); if (!FX.off) vfx((ctx, q) => vReticle(ctx, e.x, e.y, 80 * (1.4 - q * 0.4), RG.GOLD, 1 - q * 0.3, q * 6, 'LAW'), 0.6, { keep: true }); }
  });
  if (fin) { const S = sx(f); S.domT = 4.5;
    supZone(f, { custom: true, kind: 'dominion', follow: f, x: f.x, y: f.y, r: 360, life: 4.5, col: RG.GOLD, power: P,
      onTick: (z, e, d) => { if (d < z.r) e.st.slow = Math.max(e.st.slow, 0.3); },
      draw: (ctx, z, t) => { ctx.save(); ctx.globalAlpha = Math.min(1, z.life) * 0.6; vLawCircle(ctx, z.x, z.y, z.r, 1, t, '#ffffff'); ctx.restore(); } }); }
  after(fin ? 3.2 : 2.6, () => { if (f.alive) supWave(f, f.x, f.y, 720, dmg * (fin ? 0.3 : 0.32), RG.WHITE, { speed: 950, w: 30, force: 650, power: P }); if (!FX.off) FX.addFlash(0.3, '#ffffff'); });
  after(fin ? 3.8 : 3.0, () => rgRestoreFx(RG.GOLD, fin ? 'ETERNAL REALITY' : 'THE LAW HOLDS'));
}
UL('aa_law', 'The Law Above Everything — a golden law circle covers the arena: enemy shots, zones and walls are erased, allies are healed and cleansed, enemies are slowed, then marked golden pillars fall twice and a final judgment wave', (f, P, col, dmg) => aaUlt(f, P, dmg, false));
UL('aa_dominion', 'Eternal Reality Dominion — the law circle plus a 4.5 s golden dominion around it (enemies inside are slowed, allies inside take 15% less damage), three rounds of marked pillars and a final wave; then reality is restored', (f, P, col, dmg) => aaUlt(f, P, dmg, true));

realityGodBall(B('absoluteabove', 'THE ABSOLUTE ABOVE', 'God', 'God Tier', [136, 78, 78, 74, 28], D('#fff8e1', RG.GOLD, '#ffffff', 'absabove', [], '', { glow: 1.8, sdeco: ['aahalo'], aak: 0, sfx: { wave: 'sine', pitch: 1.4 } }),
  [S('REALITY RESTORATION', 'aa_restore', 13, 60, RG.GOLD), S('ABSOLUTE IMMUNITY', 'aa_immune', 16, 50, RG.WHITE), S('DIMENSIONAL AUTHORITY', 'aa_authority', 10, 70, RG.GOLD),
    S('EXISTENCE REWRITE', 'aa_rewrite', 14, 55, '#fff59d'), S('INFINITE AUTHORITY', 'aa_rings', 12, 60, RG.AMBER)],
  U('THE LAW ABOVE EVERYTHING', 'aa_law', 115, RG.GOLD), 'defensive', { desc: 'REALITY GOD • 50,000 COINS. The golden authority above every world: it restores reality, cannot be rewritten and turns every attack back to its source.' }), {
  godClass: 'REALITY GOD • AUTHORITY', formMul: [1, 1.08, 1.14], skillK: [1.05, 0.88, 0.7],
  forms: [{ name: 'SUPREME GUARDIAN' },
    { name: 'REALITY ARCHITECT', design: { aak: 1, glow: 2.1, sdeco: ['aahalo', 'aarunes'] } },
    { name: 'THE ETERNAL ABSOLUTE', design: { c1: '#ffffff', c2: RG.AMBER, c3: '#fffde7', pat: 'absabove2', aak: 2, glow: 2.7, sdeco: ['aahalo', 'aarunes', 'aawings'] } }],
  finalUlt: U('ETERNAL REALITY DOMINION', 'aa_dominion', 125, '#ffffff'), sound: { base: 392, wave: 'sine', slide: 1.5, noise: 5200 },
  passiveInfo: { name: 'SUPREME EXISTENCE', desc: 'Damage it takes, intercepted shots and restorations fill AUTHORITY ENERGY. At 100 the next enemy ability or ultimate that hits it is cut by 40–50% and answered at once with a golden counter-lance (dodgeable). Then the meter starts again.' },
  formPassive: ['The armed counter cuts the hit by 40%.', 'The armed counter cuts the hit by 45%.', 'The armed counter cuts the hit by 50%.'],
  passive: {
    init(f) { f.sx.rgE = 0; rgMeter(f); },
    tick(f) { const S = f.sx; if (S.rgE >= 100 && !S.authReady) { S.authReady = true; if (!FX.off) { FX.text(f.x, f.y - f.r - 44, 'SUPREME EXISTENCE READY', RG.GOLD, 16, { life: 1.2 }); FX.ring(f.x, f.y, RG.GOLD, f.r * 2.6, 0.4, 6, f.r); } } },
  },
  fx: {
    idle: (f) => { if (Math.random() < 0.5) { const a = Math.random() * TAU; FX.p(f.x + Math.cos(a) * f.r * 1.3, f.y + Math.sin(a) * f.r * 1.3, 0, -40, 0.7, 2 + Math.random() * 2, Math.random() < 0.6 ? RG.GOLD : '#ffffff', 'spark', 0); } },
    bounce: (f, x, y) => { FX.ring(x, y, RG.GOLD, 50, 0.25, 4, 6); },
    victory: (f) => { rgSound('aa_bell'); vfx((ctx, q) => vLawCircle(ctx, f.x, f.y, f.r * (2 + q * 4), 1 - q, q * 4), 1.8); FX.text(f.x, f.y - f.r - 70, f.form === 2 ? 'ETERNAL AND ABSOLUTE' : 'ORDER IS RESTORED', RG.GOLD, 22, { life: 1.8, stroke: '#3a2600' }); },
    defeat: (f) => { FX.burst(f.x, f.y, RG.GOLD, 40, 360, 6, 0.9, 'shard'); FX.burst(f.x, f.y, '#ffffff', 20, 260, 5, 0.7); },
    entrance: (f) => vfx((ctx, q) => vLawCircle(ctx, f.x, f.y, ARENA.w * 0.6 * q, Math.sin(Math.PI * q), q * 5), 1.6),
  },
}, { coinGod: true, coinPrice: RG.COIN_PRICE, buyLabel: '50,000 coins' });

/* =================== 3. FATE NOTE BALL (PHP 99, verified payment only) =================== */
/** the enemy this Fate Note has sealed (alive, still sealed) */
function fnSealed(f) { const L = rgLord(f); return BATTLE ? BATTLE.fighters.find(e => e.alive && e.team !== L.team && e.sx && e.sx.seal && e.sx.seal.by === L && e.sx.sealT > 0 && !(e.st.outside > 0)) || null : null; }
/** what a revealed enemy is weak to right now (only facts from this match) */
function fnWeakness(e) {
  if (e.hpRatio < 0.35) return 'LOW HP';
  if (e.st.stun > 0 || e.st.freeze > 0) return 'STUNNED';
  if (e.st.slow > 0) return 'SLOWED';
  const sk = (e.skills || []).filter(s => !s.locked && !s.disabled);
  if (sk.length && sk.every(s => s.cdLeft > 1.5)) return 'ABILITIES ON COOLDOWN';
  if (e.ultMeter < 40) return 'ULTIMATE FAR AWAY';
  if (e.def.def < 60) return 'LOW DEFENSE';
  return 'NO OPEN WEAKNESS';
}
/** writes a name in the notebook: a DESTINY SEAL on that enemy (Absolute Seal when Fate Energy is full) */
function rgSeal(f, e, k, enh) {
  const C = RG.SEAL, S = sx(e), dur = C.dur[k] + (enh ? C.enh.extra : 0);
  S.seal = { by: f, k, bonus: C.bonus[k] * (enh ? 2 : 1), enh: !!enh, burnN: 0 }; S.sealT = dur;
  if (k >= 1) { S.revealT = Math.max(S.revealT || 0, dur); S.revealTeam = f.team; S.revealK = Math.max(S.revealK | 0, 0); }
  if (enh) { S.fateCdT = C.enh.cdDur * (e.boss ? 0.5 : 1); S.fateCdK = e.boss ? C.enh.cdSlow / 2 : C.enh.cdSlow; }
  if (!enh) rgEnergy(f, RG.FATE.seal);
  gmCount(f, 'seals'); fateLog(BATTLE, f, e, enh ? 'absolute seal' : 'seal');
  if (!FX.off) {
    rgSound('fn_write');
    const name = String(e.tag || e.def.name).toUpperCase().slice(0, 22);
    vfx((ctx, q) => { if (!e.alive) return; ctx.save(); ctx.globalAlpha = Math.min(1, q * 4) * (q > 0.8 ? (1 - q) * 5 : 1); ctx.font = 'italic 700 18px Georgia, serif'; ctx.textAlign = 'center';
      const shown = name.slice(0, Math.ceil(name.length * Math.min(1, q * 2.2))); ctx.lineWidth = 4; ctx.strokeStyle = '#000000'; ctx.strokeText(shown, e.x, e.y - e.r - 44); ctx.fillStyle = enh ? RG.GOLD : RG.PAPER; ctx.fillText(shown, e.x, e.y - e.r - 44);
      ctx.strokeStyle = RG.FATE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x - 60 * Math.min(1, q * 2.2), e.y - e.r - 38); ctx.lineTo(e.x + 60 * Math.min(1, q * 2.2), e.y - e.r - 38); ctx.stroke(); ctx.restore(); }, 1.6);
    FX.text(e.x, e.y - e.r - 66, enh ? 'ABSOLUTE SEAL' : 'DESTINY SEAL', enh ? RG.GOLD : RG.FATE, 15, { life: 1.2, pop: 1.4 });
  }
}
GSK('fn_name', 'control', '✎', 'Name of Destiny', [
  'Opens the Fate Notebook and writes one opponent’s name (you choose in the notebook; on AUTO it picks the most dangerous one): ink lightning strikes it and a DESTINY SEAL holds it for 6 s. The sealed ball takes 8% more damage from Fate Note and its shade, and hits on it build Fate Energy.',
  'The seal lasts 7 s, +10%, and the sealed ball is revealed (its cooldowns show above it).',
  'The seal lasts 8 s, +12%, and the written name burns: ink damage every second.'],
(f, s, P, col, tgt) => {
  const k = gk(f), S = sx(f), enh = !!S.fateReady, pick = S.fateTgt;
  let t = pick && pick.alive && pick.team !== f.team && !(pick.st.outside > 0) ? pick : null;
  if (!t) t = (f.ai && !f.manual ? strongestFoe(f) : null) || supTarget(f, tgt);
  if (!t) return false;
  rgSeal(f, t, k, enh); S.sealP = P;
  dealDamage(f, t, SD(f, P) * 0.32, { kind: 'skill', tag: 'strike', power: P });
  if (!FX.off) FX.bolt(t.x, t.y - 160, t.x, t.y, RG.FATE, 4, 0.3);
  if (enh) { S.fateReady = false; S.rgE = 0; }
});
GSK('fn_vision', 'buff', '◉', 'Shinigami Vision', [
  'Red eyes open: for 5 s every enemy is revealed — its harmful effects, ability cooldowns and current weakness are shown above it, and decoys are exposed.',
  'For 6 s, and revealed enemies take 6% more damage from Fate Note’s team.',
  'For 7 s; revealed enemies cannot phase out, and every revealed enemy feeds Fate Energy.'],
(f, s, P) => {
  const k = gk(f), dur = RG.VISION.dur[k], es = f.enemies(); if (!es.length) return false;
  for (const e of es) { const S = sx(e); S.revealT = Math.max(S.revealT || 0, dur); S.revealTeam = f.team; S.revealK = k; if (k === 2 && e.st.phase > 0) e.st.phase = 0; }
  sx(f).visionT = dur; if (k === 2) rgEnergy(f, 4 * es.filter(e => !e.isClone).length);
  if (!FX.off) {
    rgSound('fn_eye'); darkArena(0.9, '#1a0006', 0.35);
    vfx((ctx, q) => { const o = Math.sin(Math.PI * Math.min(1, q * 1.4)); ctx.save(); ctx.translate(f.x, f.y - f.r - 46); for (const sxn of [-1, 1]) { ctx.save(); ctx.translate(sxn * 26, 0); ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 11 * o + 0.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff1744'; ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(0, 0, 6 * o, 0, TAU); ctx.fill(); ctx.restore(); } ctx.restore(); }, 1.2);
    for (const e of es) FX.ring(e.x, e.y, '#ff1744', e.r * 2, 0.5, 4, e.r);
  }
}, true);

/** ink chains: hold a ball near where it was caught */
function rgBind(f, e, k, dur0) {
  if (!e.alive || e.minion || e.st.outside > 0) return false;
  if (rgResist(e, 'bindImmT')) { rgSay(e, 'CHAINS RESISTED', '#d1c4e9', 12); return false; }
  if (rgBlocked(f, e)) return false;
  const C = RG.BIND, S = sx(e), dur = (dur0 || C.dur[k]) * (e.boss ? 0.5 : 1);
  S.bindT = dur; S.bindX = e.x; S.bindY = e.y; S.bindR = e.boss ? 170 : C.r; S.bindBy = f; S.bindPull = k === 1; S.bindImmT = C.imm + dur;
  if (!dur0) rgEnergy(f, RG.FATE.bind);
  if (!FX.off) { rgSound('fn_chain'); FX.text(e.x, e.y - e.r - 30, 'BOUND BY FATE', RG.SPIRIT, 14, { life: 0.9 }); }
  return true;
}
GSK('fn_bind', 'control', '⛓', 'Fate Binding', [
  'Throws ink chains at the target (they can be dodged). A bound ball is held near the spot where it was caught for 2 s. Then 5 s binding resistance.',
  'Bound for 2.5 s, and the chains slowly drag it toward Fate Note.',
  'Two chains: the target and a second enemy are bound for 3 s and LINKED — 20% of the damage one of them takes from Fate Note’s team is also dealt to the other.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), C = RG.BIND, list = [t];
  if (k === 2) { const e2 = rgFoes(f).filter(e => e !== t && !e.minion).sort((a, b) => dist2(a.x, a.y, f.x, f.y) - dist2(b.x, b.y, f.x, f.y))[0]; if (e2) list.push(e2); }
  const link = k === 2 && list.length === 2 ? { a: list[0], b: list[1], hit: 0 } : null;
  for (const e of list) {
    const p = supShot(f, f.x, f.y, aimAngle(f, e, C.speed), { speed: C.speed, r: 9, dmg: SD(f, P) * 0.3, col: RG.SPIRIT, style: 'fn_chain', power: P, life: 1.3,
      onHit: (q, x) => { if (rgBind(f, x, k) && link) { link.hit++; if (link.hit === 2) { const until = BATTLE.time + C.dur[k]; sx(link.a).link = { other: link.b, until, by: f.team }; sx(link.b).link = { other: link.a, until, by: f.team }; if (!FX.off) FX.text(x.x, x.y - x.r - 46, 'FATES LINKED', RG.SPIRIT, 14, { life: 1 }); } } } });
    if (!FX.off) vfx((ctx) => { if (!f.alive || !BATTLE.projs.includes(p)) return; ctx.save(); ctx.strokeStyle = rgba(RG.SPIRIT, 0.8); ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.restore(); }, 1.3);
  }
  if (!FX.off) rgSound('fn_chain');
});

GSK('fn_sentence', 'ranged', '⌛', 'Death Sentence', [
  'Writes a 5 s DEATH SENTENCE on the sealed enemy (or the nearest one). Everyone sees the countdown. At zero it takes a heavy burst — never more than 30% of its max HP (15% for bosses). It is broken if that enemy hits Fate Note 3 times first, or cleanses itself. Then 6 s sentence resistance.',
  'A 4.5 s countdown; a finished sentence gives 25 Fate Energy.',
  'A 4 s countdown; the burst also binds the target for 1 s.'],
(f, s, P, col, tgt) => {
  const k = gk(f), C = RG.SENTENCE, ok = e => e && e.alive && !e.isClone && !e.minion && !(e.st.outside > 0) && !(e.sx && e.sx.sentence) && !rgResist(e, 'sentImmT');
  let t = fnSealed(f); if (!ok(t)) t = supTarget(f, tgt); if (!ok(t)) t = rgFoes(f).find(ok) || null;
  if (!t) return false;
  const S = sx(t); S.sentence = { by: f, t: C.t[k], max: C.t[k], hits: 0, k, P, tick: Math.ceil(C.t[k]), hitT: -1 }; S.sentImmT = C.t[k] + C.imm;
  fateLog(BATTLE, f, t, 'death sentence', { secs: C.t[k] });
  if (!FX.off) { rgSound('fn_write'); FX.text(t.x, t.y - t.r - 56, 'DEATH SENTENCE', RG.FATE, 18, { life: 1.4, pop: 1.6, stroke: '#000000' }); FX.text(t.x, t.y - t.r - 34, 'hit Fate Note 3 times to break it', '#ffcdd2', 12, { life: 1.6 }); }
});
/* a Reaper Shade: Fate Note's temporary shadow companion */
const REAPER_SHADE = UNITB('u_reapershade', 'Reaper Shade', [60, 70, 40, 96, 10], D('#120a1e', RG.SPIRIT, '#e1d5ff', 'reapershade', [], '', { glow: 1.4 }));
GSK('fn_shade', 'summon', '☾', 'Shinigami Summon', [
  'Summons a Reaper Shade for 6 s: a shadow companion that hunts the sealed enemy (or the nearest) and slashes it with ink scythes.',
  'The shade lasts 7 s and its scythes slow.',
  'Two shades for 8 s; when a shade fades it bursts into ink that binds nearby enemies for 0.6 s.'],
(f, s, P) => {
  const k = gk(f), n = k === 2 ? 2 : 1, life = RG.SHADE.life[k]; let made = 0;
  for (let i = 0; i < n; i++) {
    const a = f.rot + i * Math.PI, u = supMinion(f, REAPER_SHADE, f.x + dcos(a) * f.r * 2.4, f.y + dsin(a) * f.r * 2.4, { P, life, hp: 0.12, statMul: 0.55, rScale: 0.62, cap: 2,
      shot: { range: 430, cd: 1.1, fire: (u, t) => { const tt = fnSealed(f); const tg = tt && len(tt.x - u.x, tt.y - u.y) < 520 ? tt : t; if (!tg) return;
        supShot(u, u.x, u.y, aimAngle(u, tg, 640), { speed: 640, r: 9, dmg: SD(f, P) * 0.13, col: RG.SPIRIT, style: 'fn_scythe', effect: k >= 1 ? 'slow' : undefined, power: P, life: 1.2 }); } },
      onDeath: k === 2 ? (u) => { if (!f.alive) return; for (const e of rgFoes(f)) if (len(e.x - u.x, e.y - u.y) < 130 + e.r) rgBind(f, e, 0, 0.6); if (!FX.off) FX.burst(u.x, u.y, '#000000', 26, 300, 7, 0.7, 'smoke'); } : null });
    if (u) { u.fateShade = true; made++; if (!FX.off) { FX.burst(u.x, u.y, RG.SPIRIT, 18, 260, 5, 0.6); FX.burst(u.x, u.y, '#000000', 14, 200, 7, 0.7, 'smoke'); } }
  }
  if (!made) return false;
  if (!FX.off) rgSound('fn_shade');
}, true);

/* ultimates: THE FINAL ENTRY / THE LAST PAGE OF DESTINY */
function vNotebook(ctx, x, y, w, open, q, ink) {
  if (open <= 0.01) return; const h = w * 0.62, half = w / 2;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = clamp(open, 0, 1);
  ctx.fillStyle = '#0b0b12'; ctx.fillRect(-half - 10, -h / 2 - 10, w + 20, h + 20);
  for (const sgn of [-1, 1]) { ctx.save(); ctx.scale(sgn * Math.max(0.05, open), 1); const g = ctx.createLinearGradient(0, 0, half, 0); g.addColorStop(0, '#d9c9a0'); g.addColorStop(1, RG.PAPER); ctx.fillStyle = g; ctx.fillRect(0, -h / 2, half, h);
    ctx.strokeStyle = 'rgba(80,60,30,0.25)'; ctx.lineWidth = 1; for (let yy = -h / 2 + 24; yy < h / 2; yy += 18) { ctx.beginPath(); ctx.moveTo(14, yy); ctx.lineTo(half - 14, yy); ctx.stroke(); } ctx.restore(); }
  ctx.font = 'italic 700 16px Georgia, serif'; ctx.fillStyle = '#1a0006'; ctx.textAlign = 'left';
  (ink || []).forEach((nm, i) => { const shown = nm.slice(0, Math.ceil(nm.length * clamp(q * 3 - i * 0.4, 0, 1))); ctx.fillText(shown, 18, -h / 2 + 38 + i * 22); });
  ctx.fillStyle = RG.FATE; ctx.fillRect(-2, -h / 2, 4, h);
  ctx.restore();
}
function fnUlt(f, P, dmg, fin) {
  const es = rgFoes(f).filter(e => !e.isClone || e.decoy).slice(0, 6), k = rgK(f), names = es.map(e => String(e.tag || e.def.name).toUpperCase().slice(0, 20));
  gmCount(f, 'ults');
  if (!FX.off) {
    rgBanner(fin ? '✒ THE LAST PAGE OF DESTINY ✒' : 'THE FINAL ENTRY', fin ? '#ffffff' : RG.FATE, fin ? 36 : 44, fin ? 'every story ends on one page' : 'the names are written', RG.PAPER);
    darkArena(fin ? 4.6 : 3.6, fin ? '#1b170e' : '#000000', 0.72); rgSound('fn_ult'); camPunch(ARENA.cx, ARENA.cy, 0.12, 2.6);
    vfx((ctx, q) => vNotebook(ctx, ARENA.cx, ARENA.y + 150, 360, q < 0.15 ? q / 0.15 : q > 0.85 ? (1 - q) / 0.15 : 1, q, names), fin ? 3.4 : 2.8);
    if (fin) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * q) * 0.9; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + q * 3, d = 160 + (i % 3) * 120; ctx.save(); ctx.translate(ARENA.cx + Math.cos(a) * d * 1.6, ARENA.cy + Math.sin(a) * d * 0.7); ctx.rotate(a + q * 4); ctx.fillStyle = RG.PAPER; ctx.fillRect(-14, -18, 28, 36); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-9, -10, 18, 2); ctx.fillRect(-9, -4, 14, 2); ctx.restore(); } ctx.restore(); }, 3.6);
  }
  es.forEach((e, i) => after(0.5 + i * 0.3, () => {
    if (!f.alive || !e.alive || e.st.outside > 0) return;
    rgSeal(f, e, k, false);
    dealDamage(f, e, dmg * (fin ? 0.16 : 0.22), { kind: 'skill', tag: 'strike', power: P });
    if (!FX.off) { FX.bolt(e.x, ARENA.y, e.x, e.y, RG.FATE, 5, 0.35); FX.burst(e.x, e.y, '#000000', 20, 260, 6, 0.6, 'smoke'); }
  }));
  const t0 = 0.6 + es.length * 0.3;
  if (!fin) after(t0 + 0.5, () => { if (!f.alive) return; for (const e of rgFoes(f)) { supStrike(f, e.x, e.y, 0.6, 90, dmg * 0.4, RG.FATE, { kind: 'pillar', power: P }); if (!FX.off) vfx((ctx, q) => vReticle(ctx, e.x, e.y, 90 * (1.4 - q * 0.4), RG.FATE, 1 - q * 0.3, q * 6, 'FINAL'), 0.6, { keep: true }); } });
  else {
    after(t0, () => { if (f.alive) for (const e of rgFoes(f)) rgBind(f, e, 0, 1.5); });
    for (let w = 0; w < 3; w++) after(t0 + 0.4 + w * 0.6, () => { if (!f.alive) return; for (const e of rgFoes(f)) { supStrike(f, e.x + rand(-30, 30), e.y + rand(-30, 30), 0.6, 80, dmg * 0.16, RG.PAPER, { kind: 'pillar', power: P }); if (!FX.off) vfx((ctx, q) => vReticle(ctx, e.x, e.y, 80, RG.FATE, 1 - q * 0.3, q * 6, 'PAGE'), 0.6, { keep: true }); } });
    after(t0 + 2.4, () => { if (!f.alive) return; for (const e of rgFoes(f)) dealDamage(f, e, dmg * 0.34, { kind: 'skill', tag: 'explosion', power: P, noCrit: true, cap29: e.maxHp * (e.boss ? RG.SENTENCE.capBoss : RG.SENTENCE.cap) }); if (!FX.off) { FX.addFlash(0.4, '#ffffff'); FX.addShake(18); rgSound('fn_burst'); } });
  }
  after(fin ? t0 + 3.0 : t0 + 1.4, () => rgRestoreFx(RG.PAPER, fin ? 'THE STORY CONTINUES' : 'IT IS WRITTEN'));
}
UL('fn_entry', 'The Final Entry — the Fate Notebook opens over the arena and every enemy’s name is written: each is sealed and struck by ink lightning, then a marked final strike falls on each of them', (f, P, col, dmg) => fnUlt(f, P, dmg, false));
UL('fn_lastpage', 'The Last Page of Destiny — pages flood the arena: every enemy is sealed, struck and bound for 1.5 s, three rounds of marked page strikes fall, then the last page closes (never more than 30% of a ball’s max HP); the arena is restored', (f, P, col, dmg) => fnUlt(f, P, dmg, true));

realityGodBall(B('fatenote', 'FATE NOTE BALL', 'God', 'God Tier', [132, 96, 72, 86, 36], D(RG.INK, RG.PAPER, RG.FATE, 'fatenote', [], '', { glow: 1.5, sdeco: ['fnpages'], fnk: 0, sfx: { wave: 'triangle', pitch: 1.1 } }),
  [S('NAME OF DESTINY', 'fn_name', 11, 60, RG.FATE), S('SHINIGAMI VISION', 'fn_vision', 14, 45, '#ff5252'), S('FATE BINDING', 'fn_bind', 12, 55, RG.SPIRIT),
    S('DEATH SENTENCE', 'fn_sentence', 16, 90, RG.FATE), S('SHINIGAMI SUMMON', 'fn_shade', 15, 60, RG.SPIRIT)],
  U('THE FINAL ENTRY', 'fn_entry', 115, RG.FATE), 'tactical', { desc: 'REALITY GOD • PHP 99. A notebook of destiny bound in ink: it writes names, binds fates, passes sentences and calls a reaper shade.' }), {
  godClass: 'REALITY GOD • FATE', formMul: [1, 1.08, 1.14], skillK: [1.05, 0.88, 0.7],
  forms: [{ name: 'NOTE KEEPER' },
    { name: 'SHINIGAMI MASTER', design: { c3: '#ff5252', fnk: 1, glow: 1.9, sdeco: ['fnpages', 'fnquill'] } },
    { name: 'GOD OF FATE AND DEATH', design: { c1: '#000000', c2: '#fff8e1', c3: RG.FATE, pat: 'fatenote2', fnk: 2, glow: 2.4, sdeco: ['fnpages', 'fnquill', 'fnwings'] } }],
  finalUlt: U('THE LAST PAGE OF DESTINY', 'fn_lastpage', 125, '#ffffff'), sound: { base: 220, wave: 'triangle', slide: 0.7, noise: 3000 },
  passiveInfo: { name: 'RULE OF FATE', desc: 'Seals, chains, hits on its sealed enemy and finished sentences fill FATE ENERGY. At 100 FATE IS WRITTEN: the next Name of Destiny becomes an ABSOLUTE SEAL (3 s longer, double bonus, and the sealed ball’s cooldowns run 15% slower for 4 s — half on bosses).' },
  formPassive: ['Absolute Seal: 9 s.', 'Absolute Seal: 10 s, revealed.', 'Absolute Seal: 11 s, revealed and burning.'],
  passive: {
    init(f) { f.sx.rgE = 0; rgMeter(f); },
    tick(f) { const S = f.sx; if (S.rgE >= 100 && !S.fateReady) { S.fateReady = true; if (!FX.off) { FX.text(f.x, f.y - f.r - 44, 'FATE IS WRITTEN', RG.GOLD, 17, { life: 1.3, pop: 1.5 }); FX.ring(f.x, f.y, RG.FATE, f.r * 2.6, 0.4, 6, f.r); } } },
  },
  fx: {
    idle: (f) => { if (Math.random() < 0.35) { const a = Math.random() * TAU; FX.p(f.x + Math.cos(a) * f.r * 1.2, f.y + Math.sin(a) * f.r * 1.2, Math.cos(a) * 20, -30, 0.9, 2 + Math.random() * 2, Math.random() < 0.5 ? '#000000' : RG.FATE, 'dot', 0); } },
    bounce: (f, x, y) => { FX.burst(x, y, '#000000', 5, 120, 4, 0.4, 'smoke'); },
    victory: (f) => { rgSound('fn_write'); vfx((ctx, q) => vNotebook(ctx, f.x, f.y - f.r - 90, 160, Math.sin(Math.PI * q), q, ['THE END']), 1.8); FX.text(f.x, f.y - f.r - 30, f.form === 2 ? 'FATE IS FINAL' : 'IT IS WRITTEN', RG.FATE, 20, { life: 1.8, stroke: '#000000' }); },
    defeat: (f) => { for (let i = 0; i < 10; i++) FX.p(f.x, f.y, (Math.random() - 0.5) * 500, -Math.random() * 400, 1.4, 8, RG.PAPER, 'shard', 1, 500); FX.burst(f.x, f.y, '#000000', 30, 260, 7, 0.9, 'smoke'); },
    entrance: (f) => vfx((ctx, q) => vNotebook(ctx, f.x, f.y - 120, 240, Math.sin(Math.PI * q), q, ['FATE NOTE']), 1.6),
  },
}, { pricePhp: RG.FATE_PHP, buyLabel: 'PHP 99' });

/* =================== shared rules of the three Reality Gods =================== */
/* an ability that is suppressed cannot be used (the AI does not try it either); every cast counts for God Mastery */
{ const us = useSkill;
  useSkill = function (f, sk) {
    if (sk && sk.supp29 > (BATTLE ? BATTLE.time : 0)) { if (f && f.manual && !FX.off) FX.text(f.x, f.y - f.r - 26, 'SUPPRESSED', RG.CRIMSON, 15, { life: 0.5 }); return false; }
    const ok = us(f, sk); if (ok && isRG(f)) gmCount(f, 'skills'); return ok;
  };
  if (window.NBB_CORE) window.NBB_CORE.useSkill = useSkill; }
{ const sc = AIController.prototype.scoreSkill; AIController.prototype.scoreSkill = function (s, c) { if (s && s.supp29 > BATTLE.time) return -1; return sc.call(this, s, c); }; }
/* a form reached counts for God Mastery */
{ const ff = finishForm; finishForm = function (f, k) { ff(f, k); if (isRG(f)) { gmCount(f, 'forms'); if (!FX.off) { rgSound('transform', RG.IDS.indexOf(f.baseDef.id)); FX.text(f.x, f.y + f.r + 30, f.baseDef.forms[k].name, f.def.design.c3, 18, { life: 1.6 }); } } }; }
/* the player's God Mastery level (looks only) arrives with the battle ticket */
{ const si = supremeInit; supremeInit = function (f, o) { if (o && o.gm29 && f.def && f.def.realityGod) f.gm29 = clamp(o.gm29 | 0, 0, 10); si(f, o); }; }

/* reversed steering (REVERSE fracture zones) */
SUP.steerHooks.push(f => { const S = f.sx; if (S && S.revT > 0 && !rgImmune(f)) { f.steerX = -f.steerX; f.steerY = -f.steerY; } });
/* stat changes: enhanced seal (cooldowns slower), floating platforms (faster), Reality Dominance, the Archon's phases */
MOD26.push((f, s, m) => {
  if (s.fateCdT > 0 && !rgImmune(f)) m.cd *= 1 + (s.fateCdK || 0);
  if (s.plat29T > 0) m.spd *= 1.12;
  if (s.arCdK) m.cd *= s.arCdK;
});

/* ---------------- damage rules ---------------- */
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const B = BATTLE, T = tgt.sx, L = src ? rgLord(src) : null, LS = L && L.sx;
  if (o.syn29 || o.link29) return amt;
  if (T && T.fracT > 0) amt *= 1.1;                                                      // cracked by Reality Deletion (3rd form)
  if (LS && LS.negT > 0 && isRG(L, 'voidbelow') && o.kind !== 'dot') amt *= 1 + RG.NEGATE.bonus;   // ABSOLUTE NEGATION
  if (T && T.negT > 0 && isRG(tgt, 'voidbelow') && o.kind !== 'dot') amt *= 1 - RG.NEGATE.guard;     // (it also takes less damage while negating)
  if (T && T.immT > 0 && isRG(L, 'voidbelow') && L.team !== tgt.team && o.kind !== 'collision') amt *= 1 - RG.IMMUNE.cut;   // Absolute Immunity vs its rival's destruction (the rivalry counter)
  if (LS && LS.domin29T > 0 && o.kind !== 'dot') amt *= 1.1;                             // REALITY DOMINANCE (clash winner)
  // DESTINY SEAL: Fate Note and its shades hit the sealed ball harder, and every hit builds Fate Energy
  if (T && T.seal && T.sealT > 0 && L && T.seal.by === L && L.alive) { amt *= 1 + T.seal.bonus; if (!(LS.fateHitT > 0)) { LS.fateHitT = 0.2; rgEnergy(L, RG.FATE.hit); } }
  if (T && T.revealT > 0 && T.revealK >= 1 && src && src.team === T.revealTeam) amt *= 1 + RG.VISION.bonus;
  // a Death Sentence breaks when the sentenced ball hits Fate Note (or its shade) 3 times
  const SS = L && L.sx && L.sx.sentence;
  if (SS && SS.by && (tgt === SS.by || (tgt.fateShade && tgt.owner === SS.by)) && o.kind !== 'dot' && B.time - SS.hitT > 0.2) {
    SS.hitT = B.time; SS.hits++;
    if (!FX.off) FX.text(L.x, L.y - L.r - 50, `BREAKING THE SENTENCE ${Math.min(SS.hits, RG.SENTENCE.hits)}/${RG.SENTENCE.hits}`, '#ffffff', 13, { life: 0.6 });
  }
  // THE ABSOLUTE ABOVE: damage taken fills Authority Energy; the armed counter answers one ability or ultimate
  if (isRG(tgt, 'absoluteabove') && src && src.team !== tgt.team && o.kind !== 'dot') {
    if (T.authReady && o.kind === 'skill' && src.alive) {
      T.authReady = false; T.rgE = 0; amt *= 1 - RG.AUTH.cut[tgt.form | 0];
      const s0 = rgLord(src); supShot(tgt, tgt.x, tgt.y, datan2(s0.y - tgt.y, s0.x - tgt.x), { speed: 860, r: 10, dmg: SD(tgt, 70) * RG.AUTH.counter, col: RG.GOLD, style: 'k_spear', homing: 2.2, target: s0, power: 70, life: 1.6 });
      if (!FX.off) { rgSound('aa_counter'); FX.text(tgt.x, tgt.y - tgt.r - 40, 'SUPREME EXISTENCE', RG.GOLD, 18, { life: 1.1, pop: 1.6 }); FX.ring(tgt.x, tgt.y, RG.GOLD, tgt.r * 2.6, 0.4, 6, tgt.r); }
    } else if (!T.authReady) rgEnergy(tgt, amt / tgt.maxHp * 220);
  }
  // Eternal Reality Dominion: allies standing in it take 15% less damage
  if (B.dom29) for (const d of B.dom29) if (d.f.alive && d.f.sx.domT > 0 && d.f.team === tgt.team && dist2(tgt.x, tgt.y, d.f.x, d.f.y) < 360 * 360) { amt *= 0.85; break; }
  // THE VOID BELOW builds Destruction Energy with its hits
  if (LS && isRG(L, 'voidbelow') && tgt.team !== L.team && o.kind !== 'dot' && !(LS.vbHitT > 0)) { LS.vbHitT = 0.15; rgEnergy(L, RG.NEGATE.gain.hit); }
  return amt;
});
/* fates linked by Fate Binding (3rd form): 20% of the damage one takes from Fate Note's team is also dealt to the other */
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const T = tgt.sx; if (!T || !T.link || o.link29 || o.syn29 || !src || src.team !== T.link.by || BATTLE.time > T.link.until) return amt;
  const other = T.link.other; if (other && other.alive && !(other.st.outside > 0)) { const share = amt * 0.2; after(0, () => { if (other.alive) dealDamage(src.alive ? src : null, other, share, { kind: 'dot', noCrit: true, noDef: true, link29: true }); }); }
  return amt;
});

/* ---------------- GOD SYNERGY (allies only; team cooldowns; synergy hits never trigger another synergy) ---------------- */
const SYNERGY = {
  balance: { name: 'REALITY COLLISION', sub: 'void and law strike as one', ids: ['voidbelow', 'absoluteabove'], cd: 25, col: '#ffffff' },
  destiny: { name: 'DESTINY OF DESTRUCTION', sub: 'the sealed name is torn from reality', ids: ['voidbelow', 'fatenote'], cd: 12, col: RG.CRIMSON },
  judgment: { name: 'ETERNAL JUDGMENT', sub: 'the sealed name is judged', ids: ['absoluteabove', 'fatenote'], cd: 12, col: RG.GOLD },
};
function synReady(B, team, key) { const m = B.syn29 || (B.syn29 = {}), id = team + ':' + key; if ((m[id] || 0) > B.time) return false; m[id] = B.time + SYNERGY[key].cd; return true; }
function synFx(key, a, b) { const S = SYNERGY[key]; gmCount(a, 'combos'); if (b) gmCount(b, 'combos'); if (FX.off) return; rgSound('synergy'); FX.text(ARENA.cx, ARENA.y + 150, '✦ GOD SYNERGY: ' + S.name + ' ✦', S.col, 24, { life: 1.6, vy: 0, pop: 1.6, stroke: '#000000' }); FX.text(ARENA.cx, ARENA.y + 178, S.sub, '#ffffff', 15, { life: 1.4, vy: 0 }); if (b) FX.bolt(a.x, a.y, b.x, b.y, S.col, 4, 0.4); }
const rgAlly = (f, id) => BATTLE.fighters.find(x => x.alive && x !== f && x.team === f.team && isRG(x, id)) || null;
/* REALITY COLLISION synergy: when one of them releases an ultimate, the other joins with a twin beam */
{ const ru = releaseUlt; releaseUlt = function (f) {
  ru(f);
  if (!isRG(f) || !BATTLE) return; const id = f.baseDef.id;
  if (id !== 'voidbelow' && id !== 'absoluteabove') return;
  const p = rgAlly(f, id === 'voidbelow' ? 'absoluteabove' : 'voidbelow'); if (!p || !synReady(BATTLE, f.team, 'balance')) return;
  synFx('balance', f, p);
  after(0.9, () => { if (!p.alive) return; const e = nearestEnemy(p); if (!e) return;
    for (const [s0, col] of [[p, p.baseDef.id === 'voidbelow' ? RG.CRIMSON : RG.GOLD], [f, f.baseDef.id === 'voidbelow' ? RG.CRIMSON : RG.GOLD]]) if (s0.alive) { const end = rayToWall(s0.x, s0.y, angTo(s0, e)); addLaser(s0, [s0.x, s0.y, end.x, end.y], { charge: 0.3, dur: 0.4, w: 22, dmg: SD(s0, 80) * 0.35, col }); }
  });
}; }
SUP.dmgHooks.push((src, tgt, amt, o) => {
  if (o.syn29 || o.link29 || o.kind !== 'skill' || !src) return amt;
  const L = rgLord(src); if (!isRG(L) || !tgt.sx || !tgt.sx.seal || !(tgt.sx.sealT > 0)) return amt;
  const fn = tgt.sx.seal.by; if (!fn || fn === L || fn.team !== L.team || !fn.alive) return amt;
  const B = BATTLE;
  if (isRG(L, 'voidbelow') && synReady(B, L.team, 'destiny')) {         // DESTINY OF DESTRUCTION: a rupture tears through the sealed ball
    synFx('destiny', L, fn); const x = tgt.x, y = tgt.y;
    after(0.05, () => { if (!L.alive) return; for (const e of rgFoes(L)) if (len(e.x - x, e.y - y) < 150 + e.r) dealDamage(L, e, SD(L, 70) * 0.35, { kind: 'skill', tag: 'explosion', power: 70, syn29: true }); rgEnergy(L, 10); if (!FX.off) { darkBurst(x, y, 150, 0.6); FX.ring(x, y, RG.FATE, 170, 0.45, 8, 20); } });
  }
  if (isRG(L, 'absoluteabove') && synReady(B, L.team, 'judgment')) {    // ETERNAL JUDGMENT: a golden pillar judges the sealed ball, both gods are restored a little
    synFx('judgment', L, fn); const x = tgt.x, y = tgt.y;
    tele(x, y, 80, RG.GOLD, 0.5);
    after(0.5, () => { if (!L.alive) return; for (const e of rgFoes(L)) if (len(e.x - x, e.y - y) < 80 + e.r) dealDamage(L, e, SD(L, 70) * 0.4, { kind: 'skill', tag: 'strike', power: 70, syn29: true }); healFighter(L, L.maxHp * 0.03); if (fn.alive) healFighter(fn, fn.maxHp * 0.03); if (!FX.off) BATTLE.pillars.push({ x, w: 60, col: RG.GOLD, life: 0.6, max: 0.6 }); });
  }
  return amt;
});

/* ---------------- per-step rules ---------------- */
SUP.worldHooks.push((B, h) => {
  for (const f of B.fighters) {
    const S = f.sx; if (!S || !f.alive) continue;
    if (S.immT > 0) { f.st.timestop = 0; S.revT = 0; S.bindT = 0; S.fateCdT = 0; }
    // Fate Binding: held near the anchor (dragged toward Fate Note in the 2nd form)
    if (S.bindT > 0 && !(f.st.outside > 0)) {
      if (S.bindPull && S.bindBy && S.bindBy.alive) { const a = datan2(S.bindBy.y - S.bindY, S.bindBy.x - S.bindX); S.bindX += dcos(a) * 70 * h; S.bindY += dsin(a) * 70 * h; }
      const dx = f.x - S.bindX, dy = f.y - S.bindY, d = len(dx, dy);
      if (d > S.bindR) { const nx = dx / d, ny = dy / d; f.x = S.bindX + nx * S.bindR; f.y = S.bindY + ny * S.bindR; const vn = f.vx * nx + f.vy * ny; if (vn > 0) { f.vx -= 1.6 * vn * nx; f.vy -= 1.6 * vn * ny; } }
      f.st.slow = Math.max(f.st.slow, 0.15);
    }
    // Destiny Seal (3rd form): the written name burns
    if (S.seal && S.sealT > 0 && S.seal.k === 2 && S.seal.by.alive && (S.sealBurn = (S.sealBurn || 0) - h) <= 0) { S.sealBurn = 1; dealDamage(S.seal.by, f, SD(S.seal.by, 50) * 0.05, { kind: 'dot', noCrit: true, noDef: true }); }
    if (S.seal && !(S.sealT > 0)) S.seal = null;
    if (S.revealT > 0 && S.revealK === 2 && f.st.phase > 0) f.st.phase = 0;
    // Death Sentence countdown
    const D = S.sentence;
    if (D) {
      if (!D.by.alive) { S.sentence = null; fateLog(B, D.by, f, 'sentence ended'); }
      else if (D.hits >= RG.SENTENCE.hits) { S.sentence = null; fateLog(B, D.by, f, 'sentence broken'); if (!FX.off) { FX.text(f.x, f.y - f.r - 50, 'SENTENCE BROKEN', '#ffffff', 18, { life: 1.2, pop: 1.5 }); FX.ring(f.x, f.y, '#ffffff', f.r * 2.4, 0.4, 6, f.r); } }
      else {
        D.t -= h; const sec = Math.ceil(D.t);
        if (sec < D.tick && sec > 0) { D.tick = sec; if (!FX.off) { rgSound('fn_tick'); FX.text(f.x, f.y - f.r - 60, String(sec), RG.FATE, 30, { life: 0.6, pop: 1.8, stroke: '#000000' }); } }
        if (D.t <= 0) {
          S.sentence = null; const by = D.by, cap = f.maxHp * (f.boss ? RG.SENTENCE.capBoss : RG.SENTENCE.cap);
          dealDamage(by, f, SD(by, D.P) * RG.SENTENCE.dmg[D.k], { kind: 'skill', tag: 'explosion', power: D.P, noCrit: true, cap29: cap });
          if (D.k >= 1) rgEnergy(by, RG.FATE.sentence);
          if (D.k === 2 && f.alive) rgBind(by, f, 0, 1);
          fateLog(B, by, f, 'sentence carried out');
          if (!FX.off) { rgSound('fn_burst'); FX.burst(f.x, f.y, '#000000', 40, 420, 8, 0.9, 'smoke'); FX.burst(f.x, f.y, RG.FATE, 30, 520, 6, 0.7, 'shard'); FX.addShake(12); FX.text(f.x, f.y - f.r - 50, 'SENTENCE CARRIED OUT', RG.FATE, 18, { life: 1.2, pop: 1.5, stroke: '#000000' }); }
        }
      }
    }
    // Infinite Authority: rings intercept (and redirect) enemy shots
    if (S.ringsT > 0 && S.ringsN > 0) {
      const R = f.r * RG.RINGS.R + 8;
      for (let i = B.projs.length - 1; i >= 0 && S.ringsN > 0; i--) {
        const p = B.projs[i]; if (p.team === f.team || p.ult || p.aa29 || (p.dim || 0) !== (f.dim || 0) || dist2(p.x, p.y, f.x, f.y) > (R + p.r) * (R + p.r)) continue;
        S.ringsN--; rgEnergy(f, S.ringsK === 2 ? 7 : 4);
        if (S.ringsK === 0) { B.projs.splice(i, 1); if (!FX.off) FX.sparks(p.x, p.y, RG.GOLD, 8, 300); continue; }
        const src = p.owner && p.owner.alive && p.owner.team !== f.team ? p.owner : nearestEnemy(f); if (!src) { B.projs.splice(i, 1); continue; }
        const a = datan2(src.y - p.y, src.x - p.x), sp = Math.max(p.speed || 500, 620);
        Object.assign(p, { aa29: true, reflected: true, team: f.team, owner: f, vx: dcos(a) * sp, vy: dsin(a) * sp, speed: sp, homing: 2.4, target: src, life: Math.max(p.life, 1.5), onHit: null, onEnd: null, tick: null, hits: null });
        if (S.ringsK === 2) B.projs.push({ ...p, vx: dcos(a + 0.3) * sp, vy: dsin(a + 0.3) * sp, hits: null });
        if (!FX.off) { FX.ring(p.x, p.y, RG.GOLD, 30, 0.25, 3, 4); FX.sparks(p.x, p.y, '#ffffff', 6, 260); }
      }
    }
    // Absolute Negation: enemy shots that touch The Void Below are negated
    if (S.negT > 0 && S.negN > 0) {
      const R = f.r * 2.2;
      for (let i = B.projs.length - 1; i >= 0 && S.negN > 0; i--) { const p = B.projs[i]; if (p.team === f.team || p.ult || (p.dim || 0) !== (f.dim || 0) || dist2(p.x, p.y, f.x, f.y) > R * R) continue; B.projs.splice(i, 1); S.negN--; if (!FX.off) { FX.burst(p.x, p.y, '#000000', 6, 160, 4, 0.35, 'smoke'); FX.text(p.x, p.y - 12, 'NEGATED', RG.CRIMSON, 11, { life: 0.5 }); } }
    }
    // Reaper Shades hunt the sealed enemy
    if (f.fateShade && f.owner) { const t = fnSealed(f.owner); if (t) f.target = t; }
  }
  // black holes: orbiting pair (3rd form) and shot swallowing (2nd form +)
  for (const z of B.zones) {
    if (!z.vbHole || z.life <= 0) continue;
    if (z.orbit) { const O = z.orbit, q = clamp((B.time - O.t0) / O.life, 0, 1), R = O.R0 * (1 - q); z.x = O.cx + dcos(O.a + q * 7) * R; z.y = O.cy + dsin(O.a + q * 7) * R; }
    if (z.eat && z.owner.alive) for (let i = B.projs.length - 1; i >= 0; i--) { const p = B.projs[i]; if (p.team === z.team || p.ult || dist2(p.x, p.y, z.x, z.y) > (z.r * RG.CONSUME.eat) ** 2) continue; B.projs.splice(i, 1); z.r = Math.min(z.r0 + 90, z.r + 5); rgEnergy(z.owner, RG.NEGATE.gain.eat); if (!FX.off) FX.burst(p.x, p.y, RG.CRIMSON, 5, 120, 3, 0.3); }
  }
  // drifting fracture zones (3rd form)
  for (const z of B.zones) if (z.kind === 'fracture' && z.drift && z.life > 0) { z.drift.a += 0.6 * h; z.x = inArenaX(z.x + dcos(z.drift.a) * z.drift.sp * h, 40); z.y = inArenaY(z.y + dsin(z.drift.a) * z.drift.sp * h, 40); }
  // Eternal Reality Dominion fields (for the damage rule above)
  B.dom29 = B.fighters.some(f => f.alive && f.sx && f.sx.domT > 0) ? B.fighters.filter(f => f.alive && f.sx && f.sx.domT > 0).map(f => ({ f })) : null;
});

/* ---------------- HUD chips ---------------- */
SUP.chipHooks.push((f, chips) => {
  const S = f.sx; if (!S) return;
  if (isRG(f)) {
    const id = f.baseDef.id, E = Math.round(S.rgE || 0);
    if (id === 'voidbelow') chips.push([S.negT > 0 ? 'NEGATION ' + S.negT.toFixed(1) + 's' : 'DESTRUCTION ' + E + '%', RG.CRIMSON]);
    if (id === 'absoluteabove') chips.push([S.authReady ? 'AUTHORITY READY' : 'AUTHORITY ' + E + '%', RG.GOLD]);
    if (id === 'fatenote') chips.push([S.fateReady ? 'FATE IS WRITTEN' : 'FATE ' + E + '%', RG.FATE]);
    if (S.immT > 0) chips.push(['IMMUNE ' + S.immT.toFixed(1) + 's', RG.WHITE]);
  }
  if (S.suppT > 0) chips.push(['SUPPRESSED: ' + S.suppName, '#ff8a80']);
  if (S.seal && S.sealT > 0) chips.push([(S.seal.enh ? 'ABSOLUTE SEAL ' : 'SEALED ') + S.sealT.toFixed(1) + 's', RG.FATE]);
  if (S.sentence) chips.push(['SENTENCE ' + Math.max(0, S.sentence.t).toFixed(1) + 's', RG.FATE]);
  if (S.bindT > 0) chips.push(['BOUND', RG.SPIRIT]);
  if (S.fractT > 0) chips.push([S.fractName, '#ff8a80']);
  if (S.domin29T > 0) chips.push(['REALITY DOMINANCE', '#ffffff']);
});

/* ---------------- the energy meter, revealed enemies and sentence countdowns (drawn every frame) ---------------- */
function rgMeter(f) {
  if (FX.off || !BATTLE) return;
  vfx((ctx) => {
    if (!f.alive || f.st.outside > 0 || !f.sx) return; const S = f.sx, id = f.baseDef.id;
    const col = id === 'voidbelow' ? RG.CRIMSON : id === 'absoluteabove' ? RG.GOLD : RG.FATE, E = clamp(S.rgE || 0, 0, 100) / 100, full = S.negT > 0 || S.authReady || S.fateReady;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 9, -HPI, -HPI + TAU); ctx.stroke();
    ctx.strokeStyle = full ? '#ffffff' : col; ctx.shadowColor = col; ctx.shadowBlur = full ? 14 : 6; ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 9, -HPI, -HPI + TAU * (full ? 1 : E)); ctx.stroke(); ctx.shadowBlur = 0;
    if ((f.gm29 | 0) >= 5) { ctx.globalAlpha = 0.35 + 0.15 * Math.sin(BATTLE.time * 3); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.9, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    if (id === 'fatenote') {         // Shinigami Vision / seals: cooldown pips and weakness over revealed enemies; every sentence's countdown
      for (const e of BATTLE.fighters) {
        if (!e.alive || e.team === f.team || e.st.outside > 0 || !e.sx) continue; const T = e.sx;
        if (T.revealT > 0 && T.revealTeam === f.team) {
          const list = (e.skills || []).filter(s => !s.locked && !s.disabled).slice(0, 10), w = list.length * 9;
          list.forEach((s, i) => { const x = e.x - w / 2 + i * 9 + 4, y = e.y + e.r + 14, q = s.cdLeft > 0 ? clamp(1 - s.cdLeft / (s.cd || 6), 0, 1) : 1; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 3.5, y - 3.5, 7, 7); ctx.fillStyle = s.supp29 > BATTLE.time ? RG.CRIMSON : q >= 1 ? '#ffffff' : '#ff5252'; ctx.fillRect(x - 3, y + 3 - 6 * q, 6, 6 * q); });
          ctx.font = '700 10px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff8a80'; ctx.fillText(fnWeakness(e) + (e.decoy ? ' • DECOY' : ''), e.x, e.y + e.r + 30);
        }
        if (T.seal && T.sealT > 0 && T.seal.by === f) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(BATTLE.time * 0.8); ctx.strokeStyle = rgba(T.seal.enh ? RG.GOLD : RG.FATE, 0.85); ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(0, 0, e.r + 14, 0, TAU); ctx.stroke(); ctx.restore(); }
        if (T.sentence && T.sentence.by === f) { const q = clamp(T.sentence.t / T.sentence.max, 0, 1); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 22, 0, TAU); ctx.stroke(); ctx.strokeStyle = RG.FATE; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 22, -HPI, -HPI + TAU * q); ctx.stroke();
          ctx.font = '900 22px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000000'; const txt = Math.max(0, T.sentence.t).toFixed(1); ctx.strokeText(txt, e.x, e.y - e.r - 26); ctx.fillStyle = RG.FATE; ctx.fillText(txt, e.x, e.y - e.r - 26); }
      }
    }
    ctx.restore();
  }, 1e9, { keep: true });
  if ((f.gm29 | 0) >= 6) after(0.05, () => { const fx = SUP.fx[f.baseDef.id]; if (fx && fx.entrance && f.alive) fx.entrance(f); });   // God Mastery 6: own entrance
}

/* ---------------- inputs: the Fate Notebook target and the Reality Clash press (recorded, replayed by the server) ---------------- */
function rgInput(pl, a) {
  const B = BATTLE; if (!B || !pl) return;
  if (a[0] === 't') { const e = B.fighters.find(x => x.sid === (a[1] | 0)); if (e && e.alive && e.team !== pl.team && isRG(pl, 'fatenote')) { sx(pl).fateTgt = e; if (!FX.off) FX.text(e.x, e.y - e.r - 40, '✎ ' + String(e.tag || e.def.name).toUpperCase(), RG.FATE, 14, { life: 0.8 }); } }
  if (a[0] === 'c') { const c = B.clash; if (c && c.rc && (pl === c.a || pl === c.b)) rcPress(c, pl, true); }
}

/* =================== REALITY COLLISION: The Void Below vs The Absolute Above =================== */
/* When both are in a battle on opposite sides: a special announcement and entrances. When their ultimates meet, the GOD
   CLASH becomes a REALITY CLASH: a timing bar runs for 2.4 s and each side presses once. The result is 60% timing and
   40% battle state (ultimate power × attack × HP), so neither ball is favoured and picking a ball never decides it.
   Presses are battle inputs ('c'), so the server's re-simulation decides the result. The AI presses near a perfect
   moment from the seeded RNG; a player can press first (and a player on MANUAL presses alone). */
const RC = { DUR: 2.4, READY: 0.35, PERIOD: 1.1, W_TIME: 0.6, W_POWER: 0.4, SCALE: 0.3, DOM: 5, WINDOW: 1.2 };
const rcPair = (a, b) => isRG(a) && isRG(b) && [a.baseDef.id, b.baseDef.id].sort().join() === 'absoluteabove,voidbelow';
const rcPos = t => 0.5 + 0.5 * dsin(t * TAU / RC.PERIOD);
const rcAcc = t => t < RC.READY ? 0 : clamp(1 - Math.abs(rcPos(t) - 0.5) * 2, 0, 1);
function rcPress(c, f, human) {
  const R = c.rc, k = f === c.a ? 'a' : 'b'; if (!R || R[k] != null || c.t < RC.READY) return;
  R[k] = rcAcc(c.t); R[k + 'H'] = !!human;
  if (!FX.off) { rgSound('press'); const acc = R[k]; FX.text(f.x, f.y - f.r - 44, acc > 0.9 ? 'PERFECT!' : acc > 0.6 ? 'GREAT' : acc > 0.3 ? 'GOOD' : 'WEAK', acc > 0.9 ? '#ffffff' : f.def.design.c2, 22, { life: 0.9, pop: 1.8, stroke: '#000000' }); }
}
function vRealityBar(ctx, c) {
  const R = c.rc, w = 300, x0 = ARENA.cx - w / 2, y0 = ARENA.y + 168;
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x0 - 8, y0 - 8, w + 16, 34);
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, RG.CRIMSON); g.addColorStop(0.42, '#3a0010'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.58, '#3a2a00'); g.addColorStop(1, RG.GOLD);
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, 18); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(x0 + w * 0.45, y0 - 3, w * 0.1, 24);
  const mx = x0 + w * rcPos(c.t); ctx.fillStyle = c.t < RC.READY ? '#888888' : '#ffffff'; ctx.beginPath(); ctx.moveTo(mx, y0 - 6); ctx.lineTo(mx - 7, y0 - 16); ctx.lineTo(mx + 7, y0 - 16); ctx.fill(); ctx.fillRect(mx - 1.5, y0 - 4, 3, 26);
  ctx.font = '800 13px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
  for (const [k, f, x] of [['a', c.a, x0 - 4], ['b', c.b, x0 + w + 4]]) { const v = R[k]; ctx.textAlign = k === 'a' ? 'right' : 'left'; ctx.fillStyle = f.def.design.c2; ctx.fillText(v == null ? '…' : Math.round(v * 100) + '%', x, y0 + 14); }
  ctx.textAlign = 'center'; ctx.font = '900 15px "Segoe UI", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(c.t < RC.READY ? '⚔ REALITY CLASH — GET READY' : '⚔ REALITY CLASH — PRESS IN THE WHITE ZONE!', ARENA.cx, y0 + 40);
  ctx.restore();
}
{ const sc = startClash; startClash = function (a, b) {
  sc(a, b); const c = BATTLE.clash; if (!c || !rcPair(a, b)) return;
  c.dur = RC.DUR; for (const f of [a, b]) { f.st.invuln = Math.max(f.st.invuln, c.dur + 0.2); f.casting = Math.max(f.casting, c.dur); }
  const aiT = () => RC.PERIOD / 2 * (1 + ((RNG() * 3) | 0)) + rand(-0.09, 0.09);
  c.rc = { a: null, b: null, aiA: aiT(), aiB: aiT() };
  if (!FX.off) {
    rgSound('collision');
    vfx((ctx) => { if (BATTLE.clash === c) vRealityBar(ctx, c); }, c.dur + 0.1, { keep: true });
  }
}; }
{ const rs = resolveClash; resolveClash = function (B, c) {
  if (c.rc) { const R = c.rc, A = R.a ?? 0, Bv = R.b ?? 0, pw = (c.pa - c.pb) / (c.pa + c.pb), tm = (A - Bv) / Math.max(0.25, A + Bv); c.m = (RC.W_POWER * pw + RC.W_TIME * tm) * RC.SCALE; c.rcPw = pw; c.rcTm = tm; }
  rs(B, c);
  if (c.rc && c.a.alive && c.b.alive && Math.abs(c.m) >= 0.04) { const w = c.m > 0 ? c.a : c.b; sx(w).domin29T = RC.DOM; gmCount(w, 'clash'); if (!FX.off) FX.text(ARENA.cx, ARENA.cy + 16, 'REALITY DOMINANCE — +10% DAMAGE FOR 5 s', w.def.design.c2, 18, { life: 1.6, vy: 0 }); }
}; }
/* rivals get a longer window for their ultimates to meet */
{ const su = supremeUlt; supremeUlt = function (f) {
  su(f); const B = BATTLE; if (!B || !isRG(f) || !B.godCharge) return;
  const me = B.godCharge.find(c => c.f === f); if (me && B.fighters.some(x => x.alive && x.team !== f.team && rcPair(f, x))) me.t = Math.max(me.t, RC.WINDOW);
}; }
SUP.worldHooks.push((B, h) => {
  const c = B.clash;
  if (c && c.rc) for (const [k, f] of [['a', c.a], ['b', c.b]]) if (c.rc[k] == null && !f.manual && c.t >= c.rc['ai' + k.toUpperCase()]) rcPress(c, f, false);
  // the rival answers: an AI-controlled rival with a full ultimate fires it while the other one is charging, so the two meet
  if (!c && !B.cinematic && B.godCharge && B.godCharge.length) for (const gc of B.godCharge.slice()) {
    const f = gc.f; if (!isRG(f) || !f.alive) continue;
    const g = B.fighters.find(x => x.alive && x.team !== f.team && rcPair(f, x) && !x.manual && x.ultMeter >= 100 && x.canAct());
    if (g) { useUltimate(g); break; }
  }
  // the rivalry announcement (once per battle, when both are present on opposite sides)
  if (!B.rc29 && (B.rcChk = (B.rcChk || 0) - h) <= 0) {
    B.rcChk = 0.5;
    const vb = B.fighters.find(f => f.alive && isRG(f, 'voidbelow')), aa = vb && B.fighters.find(f => f.alive && isRG(f, 'absoluteabove') && f.team !== vb.team);
    if (vb && aa) { B.rc29 = { vb, aa, t: B.time };
      if (!FX.off) { rgSound('collision'); rgBanner('⚔ REALITY COLLISION ⚔', '#ffffff', 44, 'THE VOID BELOW  VS  THE ABSOLUTE ABOVE', RG.GOLD); FX.addShake(10); camPunch(ARENA.cx, ARENA.cy, 0.1, 1.6);
        vfx((ctx, q) => { const a = Math.sin(Math.PI * q) * 0.35; ctx.save(); ctx.fillStyle = rgba(RG.CRIMSON, a); ctx.fillRect(ARENA.x, ARENA.y, ARENA.w / 2, ARENA.h); ctx.fillStyle = rgba(RG.GOLD, a * 0.8); ctx.fillRect(ARENA.cx, ARENA.y, ARENA.w / 2, ARENA.h);
          ctx.strokeStyle = 'rgba(255,255,255,' + (a * 2.4) + ')'; ctx.lineWidth = 4; ctx.beginPath(); for (let y = ARENA.y; y <= ARENA.b; y += 24) ctx.lineTo(ARENA.cx + Math.sin(y * 0.09 + q * 20) * 10, y); ctx.stroke(); ctx.restore(); }, 2.4);
        for (const f of [vb, aa]) { const fx = SUP.fx[f.baseDef.id]; if (fx && fx.entrance) fx.entrance(f); } } }
  }
});

/* =================== THE REALITY COLLISION ZONE (a new arena; the classic arena is unchanged) =================== */
/* Crimson side (left): a gravity well and void rifts. Golden side (right): a repulsor and law pulses. Centre: the
   collision core (solid) that sends out a shockwave. Four solid crystal pillars (they block balls and non-ultimate shots),
   four floating platforms that drift around the centre (+12% speed while on one). Every hazard is telegraphed and hits
   every ball the same way, whichever side or ball it is. All of it runs on battle time and the seeded RNG. */
const ARENAS29 = { classic: { id: 'classic', name: 'Neon Arena' }, collision: { id: 'collision', name: 'REALITY COLLISION ZONE' } };
const RZ = { PILLAR_R: 34, CORE_R: 46, WELL_R: 105, WELL_PULL: 520, PLAT_R: 62, PLAT_SPEED: 0.18,
  RIFT: { first: 7, every: 8, warn: 1.0, r: 85, hp: 0.04 }, LAW: { first: 11, every: 8, warn: 1.0, r: 100, hp: 0.03, slow: 1.2 }, CORE: { first: 13, every: 13, warn: 1.0, r: 230, hp: 0.03, force: 620 } };
function rzBuild() {
  const P = (x, y) => ({ x: ARENA.x + ARENA.w * x, y: ARENA.y + ARENA.h * y });
  const pil = (x, y, side) => ({ ...P(x, y), r: RZ.PILLAR_R, side });
  return {
    solids: [pil(0.36, 0.22, 'crimson'), pil(0.36, 0.78, 'crimson'), pil(0.64, 0.22, 'gold'), pil(0.64, 0.78, 'gold'), { ...P(0.5, 0.5), r: RZ.CORE_R, side: 'core' }],
    wells: [{ ...P(0.24, 0.5), r: RZ.WELL_R, pull: RZ.WELL_PULL, side: 'crimson' }, { ...P(0.76, 0.5), r: RZ.WELL_R, pull: -RZ.WELL_PULL, side: 'gold' }],
    plats: [0, 1, 2, 3].map(i => ({ a: i / 4 * TAU + 0.4, rx: ARENA.w * 0.27, ry: ARENA.h * 0.33, r: RZ.PLAT_R, x: 0, y: 0 })),
    hazards: [], next: { rift: RZ.RIFT.first, law: RZ.LAW.first, core: RZ.CORE.first },
  };
}
/** true when a ball of radius r fits at (x, y) without touching a pillar or the core */
function rzFree(x, y, r) { const Z = BATTLE && BATTLE.rz29; if (!Z) return true; for (const s of Z.solids) if (len(x - s.x, y - s.y) < s.r + r + 4) return false; return true; }
function rzSpot(x, y, r) {      // the nearest free spot (spawns, teleports)
  if (rzFree(x, y, r)) return { x, y };
  for (let d = 20; d < 400; d += 20) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, nx = inArenaX(x + dcos(a) * d, r + 4), ny = inArenaY(y + dsin(a) * d, r + 4); if (rzFree(nx, ny, r)) return { x: nx, y: ny }; }
  return { x, y };
}
/* the arena is created with the battle (before anyone spawns), and spawns are moved off the solid parts */
{ const sp = Battle.prototype.spawn; Battle.prototype.spawn = function (spec, ti, k, n, nTeams) {
  if (this.cfg && this.cfg.arena === 'collision' && !this.rz29) this.rz29 = rzBuild();
  const f = sp.call(this, spec, ti, k, n, nTeams);
  if (this.rz29 && f) {
    if (nTeams === 2 && !spec.boss) { f.x = ARENA.x + ARENA.w * (ti === 0 ? 0.09 : 0.91); }
    if (spec.boss) { f.x = ARENA.x + ARENA.w * 0.8; f.y = ARENA.cy - 120; }
    const p = rzSpot(f.x, f.y, f.r); f.x = p.x; f.y = p.y;
  }
  return f;
}; }
function rzHazard(B, kind) {
  const Z = B.rz29, C = RZ[kind.toUpperCase()];
  let x, y;
  if (kind === 'core') { x = Z.solids[4].x; y = Z.solids[4].y; }
  else { for (let i = 0; i < 8; i++) { x = ARENA.x + ARENA.w * (kind === 'rift' ? rand(0.07, 0.45) : rand(0.55, 0.93)); y = ARENA.y + ARENA.h * rand(0.12, 0.88); if (rzFree(x, y, C.r * 0.5)) break; } }
  const hz = { kind, x, y, r: C.r, t: C.warn, max: C.warn };
  Z.hazards.push(hz);
  if (!FX.off) {
    const col = kind === 'rift' ? RG.CRIMSON : kind === 'law' ? RG.GOLD : '#ffffff';
    tele(x, y, C.r, col, C.warn);
    if (kind === 'core') FX.text(x, y - 70, 'COLLISION CORE', '#ffffff', 14, { life: C.warn });
  }
}
function rzFire(B, hz) {
  const C = RZ[hz.kind.toUpperCase()];
  for (const e of B.fighters) {
    if (!e.alive || e.st.outside > 0 || e.beyond) continue; const d = len(e.x - hz.x, e.y - hz.y); if (d > hz.r + e.r) continue;
    dealDamage(null, e, e.maxHp * C.hp / DMG_SCALE, { kind: 'skill', tag: 'hazard', noCrit: true, noDef: true });
    if (hz.kind === 'law') e.st.slow = Math.max(e.st.slow, C.slow);
    if (hz.kind === 'core' || hz.kind === 'rift') knock(e, hz.x, hz.y, hz.kind === 'core' ? C.force : 380);
  }
  if (!FX.off) {
    if (hz.kind === 'rift') { darkBurst(hz.x, hz.y, hz.r, 0.6); FX.burst(hz.x, hz.y, RG.CRIMSON, 24, 340, 6, 0.6, 'shard'); }
    else if (hz.kind === 'law') { FX.ring(hz.x, hz.y, RG.GOLD, hz.r * 1.3, 0.5, 8, 10); FX.burst(hz.x, hz.y, RG.GOLD, 18, 260, 5, 0.6); }
    else { FX.ring(hz.x, hz.y, '#ffffff', hz.r, 0.6, 12, 40); FX.ring(hz.x, hz.y, RG.CRIMSON, hz.r * 0.8, 0.5, 8, 30); FX.ring(hz.x, hz.y, RG.GOLD, hz.r * 1.1, 0.7, 8, 30); FX.addShake(8); }
  }
}
SUP.worldHooks.push((B, h) => {
  const Z = B.rz29; if (!Z) return;
  // floating platforms drift around the centre
  for (const p of Z.plats) { p.a += RZ.PLAT_SPEED * h; p.x = ARENA.cx + dcos(p.a) * p.rx; p.y = ARENA.cy + dsin(p.a) * p.ry; }
  for (const f of B.fighters) {
    if (!f.alive || f.st.outside > 0 || f.beyond || (f.dim || 0) !== 0) continue;
    // solid pillars and the core: balls bounce off them
    for (const s of Z.solids) {
      const dx = f.x - s.x, dy = f.y - s.y, d = len(dx, dy) || 0.01, min = s.r + f.r; if (d >= min) continue;
      const nx = dx / d, ny = dy / d; f.x = s.x + nx * min; f.y = s.y + ny * min; const vn = f.vx * nx + f.vy * ny; if (vn < 0) { f.vx -= 2 * vn * nx; f.vy -= 2 * vn * ny; }
      if (!FX.off && Math.random() < 0.5) FX.sparks(s.x + nx * s.r, s.y + ny * s.r, s.side === 'gold' ? RG.GOLD : s.side === 'core' ? '#ffffff' : RG.CRIMSON, 5, 220);
    }
    if (f.anchored || f.tether) continue;
    for (const w of Z.wells) { const dx = w.x - f.x, dy = w.y - f.y, d = len(dx, dy) || 1; if (d > w.r) continue; const a = w.pull * (0.4 + 0.6 * (1 - d / w.r)) * (f.boss ? 0.45 : 1); f.vx += dx / d * a * h; f.vy += dy / d * a * h; }
    for (const p of Z.plats) if (dist2(f.x, f.y, p.x, p.y) < p.r * p.r) { sx(f).plat29T = 0.1; break; }
  }
  for (let i = B.projs.length - 1; i >= 0; i--) { const p = B.projs[i]; if (p.ult || (p.dim || 0) !== 0) continue; for (const s of Z.solids) if (dist2(p.x, p.y, s.x, s.y) < (s.r + p.r) * (s.r + p.r)) { B.projs.splice(i, 1); if (!FX.off) FX.burst(p.x, p.y, p.col, 6, 180, 3, 0.3); break; } }
  // telegraphed hazards
  for (const k of ['rift', 'law', 'core']) if (B.time >= Z.next[k]) { Z.next[k] += RZ[k.toUpperCase()].every; rzHazard(B, k); }
  for (let i = Z.hazards.length - 1; i >= 0; i--) { const hz = Z.hazards[i]; hz.t -= h; if (hz.t <= 0) { Z.hazards.splice(i, 1); rzFire(B, hz); } }
});
/* drawing (under everything else in the arena) */
let RZ_FLOOR = null;
function rzFloor() {
  if (RZ_FLOOR || typeof document === 'undefined' || !document.createElement) return RZ_FLOOR;
  const c = document.createElement('canvas'); if (!c.getContext) return null; c.width = ARENA.r + 10; c.height = ARENA.b + 10; const g = c.getContext('2d'); if (!g) return null;
  const L = g.createLinearGradient(ARENA.x, 0, ARENA.r, 0); L.addColorStop(0, 'rgba(255,23,68,0.22)'); L.addColorStop(0.46, 'rgba(120,0,30,0.10)'); L.addColorStop(0.5, 'rgba(255,255,255,0.06)'); L.addColorStop(0.54, 'rgba(120,90,0,0.10)'); L.addColorStop(1, 'rgba(255,213,79,0.20)');
  g.fillStyle = L; g.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; for (let x = ARENA.x; x < ARENA.r; x += 48) { g.beginPath(); g.moveTo(x, ARENA.y); g.lineTo(x, ARENA.b); g.stroke(); } for (let y = ARENA.y; y < ARENA.b; y += 48) { g.beginPath(); g.moveTo(ARENA.x, y); g.lineTo(ARENA.r, y); g.stroke(); }
  g.font = '900 54px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,23,68,0.07)'; g.fillText('VOID', ARENA.x + ARENA.w * 0.2, ARENA.b - 30); g.fillStyle = 'rgba(255,213,79,0.07)'; g.fillText('LAW', ARENA.x + ARENA.w * 0.8, ARENA.b - 30);
  return (RZ_FLOOR = c);
}
function rzDraw(B, ctx) {
  const Z = B.rz29, t = B.time, fl = rzFloor();
  if (fl) ctx.drawImage(fl, 0, 0);
  ctx.save();
  // the collision fault line through the middle
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + 0.15 * Math.sin(t * 3)) + ')'; ctx.lineWidth = 3; ctx.beginPath();
  for (let y = ARENA.y; y <= ARENA.b; y += 18) ctx.lineTo(ARENA.cx + Math.sin(y * 0.07 + t * 2) * 8 + Math.sin(y * 0.21) * 5, y); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  for (const w of Z.wells) {      // gravity well (spiral) and repulsor (rings moving out)
    const col = w.pull > 0 ? RG.CRIMSON : RG.GOLD; ctx.strokeStyle = rgba(col, 0.45); ctx.lineWidth = 2;
    if (w.pull > 0) for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let a = 0; a < TAU * 1.5; a += 0.2) { const rr = w.r * (1 - a / (TAU * 1.5)); ctx.lineTo(w.x + Math.cos(a + t * 1.6 + i * 2.1) * rr, w.y + Math.sin(a + t * 1.6 + i * 2.1) * rr); } ctx.stroke(); }
    else for (let i = 0; i < 3; i++) { const rr = ((t * 50 + i * w.r / 3) % w.r); ctx.globalAlpha = 1 - rr / w.r; ctx.beginPath(); ctx.arc(w.x, w.y, rr, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.setLineDash([6, 6]); ctx.strokeStyle = rgba(col, 0.3); ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const p of Z.plats) {      // floating platforms with their shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(p.x + 10, p.y + 14, p.r, p.r * 0.85, 0, 0, TAU); ctx.fill();
    const left = p.x < ARENA.cx, col = left ? RG.CRIMSON : RG.GOLD;
    ctx.fillStyle = rgba(left ? '#2a0610' : '#2a2206', 0.55); ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 2.5;
    ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU + t * 0.3; i ? ctx.lineTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r) : ctx.moveTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r); } ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const s of Z.solids) {     // crystal pillars and the collision core
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(s.x + 8, s.y + 12, s.r, s.r * 0.8, 0, 0, TAU); ctx.fill();
    if (s.side === 'core') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(t * 0.8);
      ctx.fillStyle = RG.CRIMSON; ctx.beginPath(); ctx.arc(0, 0, s.r, HPI, HPI + Math.PI); ctx.fill(); ctx.fillStyle = RG.GOLD; ctx.beginPath(); ctx.arc(0, 0, s.r, -HPI, HPI); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, s.r * 0.35, 0, TAU); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 4 + Math.sin(t * 4) * 2, 0, TAU); ctx.stroke();
    } else {
      const gold = s.side === 'gold', g = ctx.createLinearGradient(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r);
      g.addColorStop(0, gold ? '#fff8e1' : '#3a0a14'); g.addColorStop(0.5, gold ? RG.GOLD : '#120206'); g.addColorStop(1, gold ? '#8a6200' : RG.BLOOD);
      ctx.fillStyle = g; ctx.strokeStyle = gold ? '#ffffff' : RG.CRIMSON; ctx.lineWidth = 2.5;
      ctx.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU + (gold ? 0.2 : 0), rr = s.r * (i % 2 ? 0.82 : 1); i ? ctx.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr) : ctx.moveTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}
{ const du = supDrawUnder; supDrawUnder = function (B, ctx, dt) { if (B.rz29) { try { rzDraw(B, ctx); } catch (e) { /* visual only */ } } du(B, ctx, dt); }; }

/* =================== SECRET COSMIC BOSS: THE FRACTURED ARCHON =================== */
/* A boss only (never a playable ball, never an opponent in other modes, never sold). Hidden in Boss Battle until the
   player has won 3 Boss Battles or owns one of the 2.9.0 Reality Gods (checked by the server). It always fights in the
   REALITY COLLISION ZONE. Three phases by HP: FRACTURED AWAKENING → COSMIC RUPTURE (66%) → ABSOLUTE COLLAPSE (33%).
   Every attack is marked before it lands. Co-op: two players can face it together in an Online CO-OP room. */
const ARCHON = { id: 'fracturedarchon', PH: [0.66, 0.33], NAMES: ['FRACTURED AWAKENING', 'COSMIC RUPTURE', 'ABSOLUTE COLLAPSE'], CD: [1, 0.85, 0.72], UNLOCK_BOSS_WINS: 3,
  REWARD: { first: { coins: 5000, mastery: 400, cosmetics: ['title_archonbreaker', 'aura_archon'] }, repeat: { coins: 800, mastery: 150 }, perDay: 5 },
  COL: '#b388ff', RIFT: '#ff1744', STAR: '#e1f5fe' };
/** the secret unlock rule (the server checks it with its own records) */
const archonUnlocked = (bossWins, ownsRealityGod) => (bossWins | 0) >= ARCHON.UNLOCK_BOSS_WINS || !!ownsRealityGod;
const arPh = f => { const L = f && f.minion && f.owner ? f.owner : f; return (L && L.sx && L.sx.arPh) | 0; };
const FRACTURE_SHARD = UNITB('u_fractureshard', 'Fracture Shard', [55, 64, 50, 80, 6], D('#0d0618', ARCHON.COL, '#ff80ab', 'archon', [], '', { glow: 1.2 }));
SK('ar_shards', 'aoe', '✶', 'Fracture Rain', 'Shards of a broken sky fall on marked spots around every enemy (5 / 7 / 9 by phase)', (f, s, P) => {
  const ph = arPh(f), n = [5, 7, 9][ph], es = rgFoes(f); if (!es.length) return false;
  for (let i = 0; i < n; i++) { const e = es[i % es.length], a = rand(TAU), d = i < es.length ? 0 : rand(60, 220), x = inArenaX(e.x + dcos(a) * d, 30), y = inArenaY(e.y + dsin(a) * d, 30);
    after(i * 0.08, () => { if (f.alive) supStrike(f, x, y, 0.9, 70, SD(f, P) * 0.24, ARCHON.COL, { kind: 'pillar', power: P }); }); }
  if (!FX.off) rgSound('vb_crack');
});
SK('ar_beam', 'ranged', '═', 'Rupture Beam', 'After a warning line, a rupture beam crosses the arena (2 beams in phase 2, 3 in phase 3)', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false; const ph = arPh(f), n = ph + 1, a0 = angTo(f, t), x0 = f.x, y0 = f.y;
  for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.35, end = rayToWall(x0, y0, a); teleLine(x0, y0, end.x, end.y, ARCHON.RIFT, 0.7, 12);
    after(0.7, () => { if (f.alive) addLaser(f, [x0, y0, end.x, end.y], { charge: 0.02, dur: 0.35, w: 26, dmg: SD(f, P) * 0.42, col: ARCHON.RIFT }); }); }
});
SK('ar_split', 'control', '⟋', 'Cosmic Split', 'A marked crack splits the arena through the target; after 1 s it opens and burns and slows anyone standing on it for 3 s', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false; const a = rand(TAU), dx = dcos(a), dy = dsin(a);
  const p1 = rayToWall(t.x, t.y, a), p2 = rayToWall(t.x, t.y, a + Math.PI); teleLine(p1.x, p1.y, p2.x, p2.y, ARCHON.COL, 1.0, 18);
  after(1.0, () => { if (!f.alive) return; const L = len(p2.x - p1.x, p2.y - p1.y); for (let d = 0; d <= L; d += 64) supZone(f, { kind: 'trap', x: p1.x - dx * d, y: p1.y - dy * d, r: 36, life: 3, col: ARCHON.COL, power: P, dmg: SD(f, P) * 0.03, effect: 'slow' }); if (!FX.off) FX.addShake(6); });
});
SK('ar_ring', 'aoe', '◌', 'Collapse Ring', 'A marked ring of collapse bursts out of the Archon (a second ring follows in phase 3)', (f, s, P) => {
  if (!supEnemies(f).some(e => len(e.x - f.x, e.y - f.y) < 420)) return false; const ph = arPh(f);
  tele(f.x, f.y, 320, ARCHON.COL, 0.8);
  after(0.8, () => { if (f.alive) supWave(f, f.x, f.y, 330, SD(f, P) * 0.5, ARCHON.COL, { speed: 760, w: 26, force: 640, power: P }); });
  if (ph === 2) after(1.4, () => { if (f.alive) supWave(f, f.x, f.y, 420, SD(f, P) * 0.32, ARCHON.RIFT, { speed: 640, w: 22, force: 500, power: P }); });
}, true);
UL('ar_collapse', 'Absolute Collapse — the Archon pulls the arena toward itself for 1.6 s inside a marked circle, then the circle collapses in a cosmic blast (run out of the circle)', (f, P, col, dmg) => {
  if (!FX.off) { rgBanner('ABSOLUTE COLLAPSE', '#ffffff', 42, 'escape the marked circle!', ARCHON.COL); darkArena(2.4, '#05000c', 0.7); rgSound('archon'); }
  supZone(f, { kind: 'gravity', x: f.x, y: f.y, r: 560, life: 1.6, col: ARCHON.COL, pull: 900, dmg: 0, power: P });
  tele(f.x, f.y, 300, '#ffffff', 1.6); const x = f.x, y = f.y;
  after(1.6, () => { if (!f.alive) return; supBlast(f, x, y, 300, dmg * 0.55, { tag: 'explosion', force: 900, power: P }); for (let i = 0; i < 18; i++) supShot(f, x, y, i / 18 * TAU, { speed: 520, r: 8, dmg: dmg * 0.04, col: ARCHON.STAR, style: 'voidshard', power: P, life: 1.4 });
    if (!FX.off) { FX.addFlash(0.45, '#ffffff'); FX.addShake(22); FX.ring(x, y, '#ffffff', 340, 0.6, 16, 30); } });
});
const ARCHON_DEF = B(ARCHON.id, 'THE FRACTURED ARCHON', 'God', 'God Tier', [160, 90, 74, 72, 18], D('#08040f', ARCHON.COL, ARCHON.RIFT, 'archon', [], '', { glow: 2.2, sdeco: ['archonshards'] }),
  [S('FRACTURE RAIN', 'ar_shards', 7, 60, ARCHON.COL), S('RUPTURE BEAM', 'ar_beam', 9, 70, ARCHON.RIFT), S('COSMIC SPLIT', 'ar_split', 13, 55, ARCHON.COL), S('COLLAPSE RING', 'ar_ring', 12, 65, ARCHON.COL)],
  U('ABSOLUTE COLLAPSE', 'ar_collapse', 120, '#ffffff'), 'boss',
  { desc: 'SECRET COSMIC BOSS. A sovereign of broken realities, cracked open by the collision of the Void and the Law.', archon: true, secretBoss: true, summonOnly: true, noOpponent: true, unlockAll: true, update29: true });
ALL_BUILTIN.push(ARCHON_DEF);
SUP.worldHooks.push((B, h) => {
  for (const f of B.fighters) {
    if (!f.alive || !f.def.archon || f.isClone) continue;
    const S = sx(f);
    if (!S.arInit) { S.arInit = true; S.arPh = 0; S.arCdK = ARCHON.CD[0]; S.arRain = 6;
      if (!FX.off) { rgBanner('THE FRACTURED ARCHON', ARCHON.COL, 44, 'PHASE 1 — ' + ARCHON.NAMES[0], '#ffffff'); rgSound('archon'); } }
    const want = f.hpRatio <= ARCHON.PH[1] ? 2 : f.hpRatio <= ARCHON.PH[0] ? 1 : 0;
    if (want > S.arPh) {
      S.arPh = want; S.arCdK = ARCHON.CD[want]; f.st.invuln = Math.max(f.st.invuln, 1.2); f.st.stun = f.st.freeze = 0;
      for (const e of rgFoes(f)) knock(e, f.x, f.y, 700);
      for (let i = 0; i < 2; i++) { const a = f.rot + i * Math.PI; const u = supMinion(f, FRACTURE_SHARD, f.x + dcos(a) * f.r * 2.2, f.y + dsin(a) * f.r * 2.2, { P: 60, life: 14, hp: 0.05, statMul: 0.5, rScale: 0.55, cap: 4,
        shot: { range: 460, cd: 1.6, fire: (u, t) => supShot(u, u.x, u.y, aimAngle(u, t, 560), { speed: 560, r: 8, dmg: SD(f, 60) * 0.08, col: ARCHON.COL, style: 'voidshard', power: 60, life: 1.4 }) } }); if (u) u.archonShard = true; }
      if (!FX.off) { rgBanner('PHASE ' + (want + 1) + ' — ' + ARCHON.NAMES[want], want === 2 ? '#ffffff' : ARCHON.COL, 40, want === 2 ? 'reality collapses toward the Archon' : 'the Archon splits the cosmos', ARCHON.RIFT); rgSound('archon'); FX.addShake(16); FX.addFlash(0.3, ARCHON.COL); darkArena(1.4, '#05000c', 0.6); }
    }
    if (S.arPh === 2) {     // ABSOLUTE COLLAPSE: a slow pull toward the Archon, and a marked shard rain every 6 s
      for (const e of rgFoes(f)) { const dx = f.x - e.x, dy = f.y - e.y, d = len(dx, dy) || 1; e.vx += dx / d * 90 * h; e.vy += dy / d * 90 * h; }
      if ((S.arRain = (S.arRain || 6) - h) <= 0) { S.arRain = 6; for (let i = 0; i < 6; i++) { const x = ARENA.x + ARENA.w * rand(0.08, 0.92), y = ARENA.y + ARENA.h * rand(0.1, 0.9); supStrike(f, x, y, 1.0, 64, SD(f, 60) * 0.2, ARCHON.RIFT, { kind: 'pillar', power: 60 }); } }
    }
  }
});
/* the Archon's look: a cracked cosmic sphere */
Object.assign(PATTERN_FN, {
  archon(g, R, d, rng) {
    const gr = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.05, 0, 0, R); gr.addColorStop(0, '#3b1c6e'); gr.addColorStop(0.6, '#12062a'); gr.addColorStop(1, '#030008'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    _stars(g, R, 40, rng, ['#ffffff', '#e1bee7', '#80d8ff']);
    g.strokeStyle = 'rgba(255,23,68,0.9)'; g.lineWidth = R * 0.05; for (let i = 0; i < 5; i++) { let x = 0, y = 0, a = i / 5 * TAU + rng(); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { a += (rng() - 0.5) * 1.2; x += Math.cos(a) * R * 0.25; y += Math.sin(a) * R * 0.25; g.lineTo(x, y); } g.stroke(); }
    _blob(g, 0, 0, R * 0.3, '#ffffff', 0.9); _blob(g, 0, 0, R * 0.5, '#b388ff', 0.5);
  },
});
if (!PATTERNS.includes('archon')) PATTERNS.push('archon');
SUP.deco = SUP.deco || {};
SUP.deco.archonshards = (ctx, r, d, t, front) => { ctx.save(); for (let i = 0; i < 6; i++) { const a = t * 0.7 + i / 6 * TAU, R = r * 1.5, y = Math.sin(a) * R * 0.45; if ((y > 0) !== !!front) continue; ctx.save(); ctx.translate(Math.cos(a) * R, y); ctx.rotate(a * 2); ctx.fillStyle = i % 2 ? ARCHON.COL : ARCHON.RIFT; ctx.beginPath(); ctx.moveTo(0, -r * 0.22); ctx.lineTo(r * 0.1, 0); ctx.lineTo(0, r * 0.22); ctx.lineTo(-r * 0.1, 0); ctx.fill(); ctx.restore(); } ctx.restore(); };

/* =================== GOD MASTERY (2.9.0 Reality Gods) — looks and titles only, saved by the server =================== */
/* Each verified battle with one of the three adds mastery EXP from what happened in it (abilities, ultimates, forms,
   boss wins, Reality Clashes won, God Synergy combos, seals) — all counted by the battle simulation, with per-battle caps.
   Levels 1–10 unlock looks only: mastery never changes stats or damage. */
const GM29 = {
  XP: [0, 500, 1400, 2800, 4800, 7500, 11000, 15500, 21000, 28000],
  GAIN: { battle: 40, win: 40, skill: 2, skillCap: 60, ult: 15, ultCap: 45, form: 20, formCap: 40, boss: 150, clash: 60, combo: 10, comboCap: 50, seal: 3, sealCap: 30 },
  PERKS: [[1, 'Energy meter ring'], [2, 'Mastery trail'], [3, 'Brighter form glow'], [4, 'Mastery badge on the ball card'], [5, 'Mastery aura'], [6, 'Own entrance at the start of every battle'],
    [7, 'Particle storm in the final form'], [8, 'Victory flourish'], [9, 'Animated title card in the collection'], [10, 'Mastery title']],
  TITLES: { voidbelow: 'title_voidsovereign', absoluteabove: 'title_eternallaw', fatenote: 'title_fatescribe' },
};
function gmLevelOf(xp) {
  xp = Math.max(0, +xp || 0); let lv = 1; for (let i = 0; i < GM29.XP.length; i++) if (xp >= GM29.XP[i]) lv = i + 1;
  const next = GM29.XP[lv] ?? null, prev = GM29.XP[lv - 1];
  return { lv, xp, next, prev, pct: next ? Math.min(1, (xp - prev) / (next - prev)) : 1 };
}
/** mastery EXP from one verified battle's counters (per-battle caps: no farming by spamming) */
function gmXpFor(c, win, mode) {
  c = c || {}; const G = GM29.GAIN, n = k => Math.max(0, Math.min(500, c[k] | 0));
  return G.battle + (win ? G.win : 0) + Math.min(G.skillCap, n('skills') * G.skill) + Math.min(G.ultCap, n('ults') * G.ult) + Math.min(G.formCap, n('forms') * G.form)
    + (win && mode === 'boss' ? G.boss : 0) + Math.min(2, n('clash')) * G.clash + Math.min(G.comboCap, n('combos') * G.combo) + Math.min(G.sealCap, n('seals') * G.seal);
}
/** the human players' counters in a finished battle: { slot: { ball, counts } } */
function gmOf(B) {
  const out = {}; const list = B.pvp ? (B.slots || []) : (B.player ? [B.player] : []);
  list.forEach((f, i) => { if (f && isRG(f)) out[B.pvp ? f.slot : 0] = { ball: f.baseDef.id, counts: { ...(f.gm29s || {}) } }; });
  return out;
}
if (typeof COSMETICS !== 'undefined' && !COSMETICS.some(c => c.id === 'title_voidsovereign')) COSMETICS.push(
  { id: 'title_voidsovereign', slot: 'title', name: 'VOID SOVEREIGN', color: RG.CRIMSON, exclusive: 'mastery29' },
  { id: 'title_eternallaw', slot: 'title', name: 'ETERNAL LAW', color: RG.GOLD, exclusive: 'mastery29' },
  { id: 'title_fatescribe', slot: 'title', name: 'SCRIBE OF FATE', color: RG.FATE, exclusive: 'mastery29' },
  { id: 'title_archonbreaker', slot: 'title', name: 'ARCHON BREAKER', color: ARCHON.COL, exclusive: 'archon' },
  { id: 'aura_archon', slot: 'aura', name: 'Fractured Cosmos Aura', color: ARCHON.COL, exclusive: 'archon' });

/* =================== looks: the three God Balls (original designs) =================== */
Object.assign(PATTERN_FN, {
  voidbelow(g, R, d, rng) {        // a black sphere split by crimson fracture veins around a slit of void light
    const gr = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R); gr.addColorStop(0, '#3a0d14'); gr.addColorStop(0.5, '#0c0204'); gr.addColorStop(1, '#000000'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    const k = d.vbk | 0; g.lineCap = 'round';
    for (let i = 0; i < 7 + k * 3; i++) { let x = (rng() - 0.5) * R * 0.3, y = (rng() - 0.5) * R * 0.3, a = rng() * TAU; g.strokeStyle = rgba(i % 3 ? '#ff1744' : '#ff8a80', 0.6 + k * 0.15); g.lineWidth = R * (0.035 + rng() * 0.03); g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { a += (rng() - 0.5) * 1.3; x += Math.cos(a) * R * 0.2; y += Math.sin(a) * R * 0.2; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = '#000000'; g.beginPath(); g.ellipse(0, 0, R * 0.16, R * 0.5, 0, 0, TAU); g.fill();
    _blob(g, 0, 0, R * 0.36, '#ff1744', 0.55); g.fillStyle = '#ff5252'; g.beginPath(); g.ellipse(0, 0, R * 0.05, R * 0.36, 0, 0, TAU); g.fill();
  },
  voidbelow2(g, R, d, rng) {       // THE END OF EVERYTHING: white-hot cracks over pure black, a crimson iris
    PATTERN_FN.voidbelow(g, R, { ...d, vbk: 2 }, rng);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = R * 0.02; for (let i = 0; i < 6; i++) { let x = 0, y = 0, a = i / 6 * TAU; g.beginPath(); g.moveTo(0, 0); for (let s = 0; s < 4; s++) { a += (rng() - 0.5); x += Math.cos(a) * R * 0.24; y += Math.sin(a) * R * 0.24; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = '#ff1744'; g.lineWidth = R * 0.06; g.beginPath(); g.arc(0, 0, R * 0.46, 0, TAU); g.stroke(); _blob(g, 0, 0, R * 0.2, '#ffffff', 1);
  },
  absabove(g, R, d, rng) {         // white-gold marble with a golden equator band and a radiant sun mark
    const gr = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#fff3c4'); gr.addColorStop(1, '#d4a017'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = R * 0.02; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-R, (rng() - 0.5) * R * 1.6); g.bezierCurveTo(-R * 0.3, (rng() - 0.5) * R, R * 0.3, (rng() - 0.5) * R, R, (rng() - 0.5) * R * 1.6); g.stroke(); }
    g.strokeStyle = '#ffb300'; g.lineWidth = R * 0.1; g.beginPath(); g.ellipse(0, 0, R, R * 0.2, 0, 0, TAU); g.stroke();
    g.fillStyle = '#ffb300'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, -R * 0.24); g.lineTo(R * 0.05, -R * 0.42); g.lineTo(-R * 0.05, -R * 0.42); g.fill(); g.restore(); }
    _blob(g, 0, 0, R * 0.26, '#ffffff', 1); g.strokeStyle = '#ffb300'; g.lineWidth = R * 0.03; g.beginPath(); g.arc(0, 0, R * 0.2, 0, TAU); g.stroke();
  },
  absabove2(g, R, d, rng) {        // THE ETERNAL ABSOLUTE: pure radiance with amber rings
    PATTERN_FN.absabove(g, R, d, rng);
    const gr = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.7, 'rgba(255,248,225,0.25)'); gr.addColorStop(1, 'rgba(255,213,79,0)'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    for (let i = 0; i < 3; i++) { g.strokeStyle = rgba(i === 1 ? '#ffffff' : '#ffb300', 0.8); g.lineWidth = R * 0.02; g.beginPath(); g.arc(0, 0, R * (0.55 + i * 0.12), 0, TAU); g.stroke(); }
  },
  fatenote(g, R, d, rng) {         // an ink-black cover with a parchment band, crimson script and a quill mark
    const gr = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R); gr.addColorStop(0, '#2b2b3a'); gr.addColorStop(0.6, '#0b0b12'); gr.addColorStop(1, '#000000'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.save(); g.rotate(-0.3); g.fillStyle = RG.PAPER; g.fillRect(-R, -R * 0.2, 2 * R, R * 0.4);
    g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = R * 0.012; for (let y = -R * 0.13; y < R * 0.2; y += R * 0.09) { g.beginPath(); g.moveTo(-R, y); g.lineTo(R, y); g.stroke(); }
    g.strokeStyle = RG.FATE; g.lineWidth = R * 0.03; g.lineCap = 'round'; let x = -R * 0.7; g.beginPath(); g.moveTo(x, 0); while (x < R * 0.7) { x += R * 0.06; g.lineTo(x, (rng() - 0.5) * R * 0.16); } g.stroke(); g.restore();
    g.strokeStyle = 'rgba(243,229,192,0.8)'; g.lineWidth = R * 0.025; g.beginPath(); g.moveTo(R * 0.2, -R * 0.75); g.quadraticCurveTo(R * 0.05, -R * 0.45, R * 0.28, -R * 0.3); g.stroke();
    if ((d.fnk | 0) >= 1) _blob(g, 0, R * 0.55, R * 0.2, RG.FATE, 0.6);
  },
  fatenote2(g, R, d, rng) {        // GOD OF FATE AND DEATH: glowing pages and a crimson eye
    PATTERN_FN.fatenote(g, R, d, rng);
    _blob(g, 0, 0, R * 0.5, '#fff8e1', 0.35); g.fillStyle = '#000000'; g.beginPath(); g.ellipse(0, 0, R * 0.3, R * 0.14, 0, 0, TAU); g.fill();
    _blob(g, 0, 0, R * 0.12, RG.FATE, 1); _blob(g, 0, 0, R * 0.05, '#ffffff', 1);
  },
  reapershade(g, R, d, rng) {      // the Reaper Shade: a dark violet hood with two pale eyes
    const gr = g.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R); gr.addColorStop(0, '#3a2a5a'); gr.addColorStop(1, '#07040c'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.fillStyle = '#000000'; g.beginPath(); g.moveTo(-R * 0.6, R * 0.6); g.quadraticCurveTo(0, -R * 1.1, R * 0.6, R * 0.6); g.closePath(); g.fill();
    _blob(g, -R * 0.16, -R * 0.02, R * 0.1, '#e1d5ff', 1); _blob(g, R * 0.16, -R * 0.02, R * 0.1, '#e1d5ff', 1);
  },
});
for (const p of ['voidbelow', 'voidbelow2', 'absabove', 'absabove2', 'fatenote', 'fatenote2', 'reapershade']) if (!PATTERNS.includes(p)) PATTERNS.push(p);
Object.assign(SUP.deco, {
  vbshards(ctx, r, d, t, front) {          // crimson shards orbiting on a tilted path
    const n = 3 + (d.vbk | 0) * 2; for (let i = 0; i < n; i++) { const a = t * (0.9 + i * 0.05) + i / n * TAU, R = r * (1.45 + (i % 2) * 0.15), y = Math.sin(a) * R * 0.4; if ((y > 0) !== !!front) continue;
      ctx.save(); ctx.translate(Math.cos(a) * R, y); ctx.rotate(a * 3); ctx.fillStyle = i % 3 ? RG.CRIMSON : '#000000'; ctx.strokeStyle = '#ff8a80'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -r * 0.16); ctx.lineTo(r * 0.07, 0); ctx.lineTo(0, r * 0.16); ctx.lineTo(-r * 0.07, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  },
  vbhalo(ctx, r, d, t, front) {            // a broken crimson halo behind the ball
    if (front) return; ctx.save(); ctx.rotate(t * 0.25); ctx.strokeStyle = rgba(RG.CRIMSON, 0.7); ctx.lineWidth = Math.max(2, r * 0.07);
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(0, 0, r * 1.75, i / 5 * TAU, i / 5 * TAU + 0.9); ctx.stroke(); } ctx.restore();
  },
  vbeye(ctx, r, d, t, front) {             // THE END OF EVERYTHING: a void crown of white cracks
    if (!front) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * 0.4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); ctx.lineTo(Math.cos(a + 0.12) * r * 1.45, Math.sin(a + 0.12) * r * 1.45); ctx.lineTo(Math.cos(a - 0.05) * r * 1.7, Math.sin(a - 0.05) * r * 1.7); ctx.stroke(); } ctx.restore();
  },
  aahalo(ctx, r, d, t, front) {            // a golden halo above the ball
    ctx.save(); ctx.translate(0, -r * 1.2); ctx.scale(1, 0.3); ctx.strokeStyle = rgba(RG.GOLD, front ? 0.95 : 0.4); ctx.lineWidth = Math.max(2, r * 0.1) / 0.3 * 0.35;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.65, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke(); ctx.restore();
  },
  aarunes(ctx, r, d, t, front) {           // a ring of rune marks turning around the ball
    ctx.save(); ctx.scale(1, 0.42); const R = r * 1.55; ctx.fillStyle = rgba(front ? '#ffffff' : RG.GOLD, front ? 0.95 : 0.45);
    for (let i = 0; i < 12; i++) { const a = t * 0.6 + i / 12 * TAU, y = Math.sin(a) * R; if ((y > 0) !== !!front) continue; ctx.fillRect(Math.cos(a) * R - r * 0.05, y - r * 0.12, r * 0.1, r * 0.24); }
    ctx.restore();
  },
  aawings(ctx, r, d, t, front) {           // THE ETERNAL ABSOLUTE: wings of golden light
    if (front) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const flap = Math.sin(t * 2) * 0.15;
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { ctx.save(); ctx.scale(s, 1); ctx.rotate(-0.5 - i * 0.28 + flap); const g = ctx.createLinearGradient(r * 0.8, 0, r * 2.6, 0); g.addColorStop(0, rgba(RG.GOLD, 0.7)); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(r * 1.7, 0, r * (0.95 - i * 0.12), r * 0.16, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
  },
  fnpages(ctx, r, d, t, front) {           // pages of the notebook orbiting the ball
    const n = 3 + (d.fnk | 0); for (let i = 0; i < n; i++) { const a = t * 0.8 + i / n * TAU, R = r * 1.5, y = Math.sin(a) * R * 0.45; if ((y > 0) !== !!front) continue;
      ctx.save(); ctx.translate(Math.cos(a) * R, y); ctx.rotate(Math.sin(t * 2 + i) * 0.4); ctx.fillStyle = RG.PAPER; ctx.fillRect(-r * 0.14, -r * 0.18, r * 0.28, r * 0.36); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-r * 0.09, -r * 0.08, r * 0.18, r * 0.03); ctx.fillRect(-r * 0.09, 0, r * 0.13, r * 0.03); ctx.restore(); }
  },
  fnquill(ctx, r, d, t, front) {           // a quill that writes in the air beside the ball
    if (!front) return; const a = t * 1.3; ctx.save(); ctx.translate(Math.cos(a) * r * 1.3, -r * 0.9 + Math.sin(a * 2) * r * 0.1); ctx.rotate(0.6);
    ctx.fillStyle = '#f5f5f5'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.08, r * 0.34, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = RG.FATE; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -r * 0.34); ctx.lineTo(0, r * 0.4); ctx.stroke(); ctx.restore();
  },
  fnwings(ctx, r, d, t, front) {           // GOD OF FATE AND DEATH: ink wings
    if (front) return; ctx.save(); const flap = Math.sin(t * 1.6) * 0.12;
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { ctx.save(); ctx.scale(s, 1); ctx.rotate(-0.4 - i * 0.22 + flap); ctx.fillStyle = i % 2 ? '#000000' : '#1b1b2b'; ctx.beginPath(); ctx.ellipse(r * 1.6, 0, r * (0.85 - i * 0.08), r * 0.13, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
  },
});
SUP.projStyles = Object.assign(SUP.projStyles || {}, {
  vb_supp(ctx, p, t, r) { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, RG.CRIMSON); g.addColorStop(1, 'rgba(255,23,68,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - r * 0.6, p.y - r * 0.6); ctx.lineTo(p.x + r * 0.6, p.y + r * 0.6); ctx.moveTo(p.x + r * 0.6, p.y - r * 0.6); ctx.lineTo(p.x - r * 0.6, p.y + r * 0.6); ctx.stroke(); },
  fn_chain(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.strokeStyle = RG.SPIRIT; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-i * r * 1.2, 0, r * 0.7, r * 0.4, 0, 0, TAU); ctx.stroke(); } ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(r * 0.3, -r * 0.6); ctx.lineTo(r * 0.3, r * 0.6); ctx.fill(); ctx.restore(); },
  fn_scythe(ctx, p, t, r) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 14); ctx.strokeStyle = RG.SPIRIT; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, Math.PI * 1.2); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0.2, Math.PI); ctx.stroke(); ctx.restore(); },
});
/* God Mastery looks: a trail from level 2, a particle storm in the final form from level 7, a victory flourish from level 8 */
for (const id of RG.IDS) { const fx = SUP.fx[id], idle = fx.idle, vic = fx.victory;
  fx.idle = (f, d) => { idle(f, d); const lv = f.gm29 | 0, col = id === 'voidbelow' ? RG.CRIMSON : id === 'absoluteabove' ? RG.GOLD : RG.FATE;
    if (lv >= 2 && Math.random() < 0.4) FX.p(f.x - f.vx * 0.03, f.y - f.vy * 0.03, 0, 0, 0.45, 3 + Math.random() * 2, col, 'dot', 0);
    if (lv >= 7 && f.form === 2 && Math.random() < 0.5) { const a = Math.random() * TAU; FX.p(f.x + Math.cos(a) * f.r * 2.4, f.y + Math.sin(a) * f.r * 2.4, -Math.cos(a) * 120, -Math.sin(a) * 120, 0.5, 2, '#ffffff', 'spark', 0); } };
  fx.victory = (f, d) => { vic(f, d); if ((f.gm29 | 0) >= 8) { FX.burst(f.x, f.y, '#ffffff', 60, 700, 6, 1.2, 'shard'); FX.text(f.x, f.y - f.r - 100, 'MASTER OF ' + (id === 'voidbelow' ? 'THE VOID' : id === 'absoluteabove' ? 'THE LAW' : 'FATE'), '#ffffff', 18, { life: 1.6 }); } };
}

/* =================== AI: when each ability is worth it =================== */
const rgIncoming = (f, r = 360) => BATTLE.projs.some(p => p.team !== f.team && !p.ult && dist2(p.x, p.y, f.x, f.y) < r * r && (p.vx * (f.x - p.x) + p.vy * (f.y - p.y)) > 0);
Object.assign(SUP.scoreFn, {
  vb_delete: (ai, s, c) => (rgResist(c.t, 'delImmT') || rgImmune(c.t) ? 0.1 : c.d < 650 ? 0.85 + (c.t.ultMeter > 80 ? 0.15 : 0) : 0.3),
  vb_consume: (ai, s, c) => (c.d < 600 ? 0.75 : 0.3),
  vb_fracture: (ai, s, c) => (c.d < 520 ? 0.7 : 0.25),
  vb_suppress: (ai, s, c) => (rgResist(c.t, 'suppImmT') || rgImmune(c.t) ? 0.1 : c.d < 760 ? 0.6 + (c.t.skills && c.t.skills.some(k => !k.locked && k.cdLeft < 1.5) ? 0.25 : 0) : 0.15),
  vb_core: (ai, s, c) => (c.d < 320 ? 0.95 + (ai.f.sx.rgE || 0) / 400 : c.d < 480 ? 0.5 : 0),
  aa_restore: (ai, s, c) => { const f = ai.f; const near = BATTLE.zones.some(z => z.team !== f.team && z.life > 0 && !z.arena29 && dist2(z.x, z.y, f.x, f.y) < 320 * 320); return (1 - c.myR) * 1.3 + (RG_BAD.some(k => f.st[k] > 0) ? 0.35 : 0) + (near ? 0.3 : 0) + (f.sx && f.sx.sentence ? 0.8 : 0); },
  aa_immune: (ai, s, c) => { const f = ai.f, S = f.sx || {}; if (S.immT > 0) return 0; return (S.revT > 0 || S.bindT > 0 || S.suppT > 0 || f.st.timestop > 0 ? 1.1 : 0) + (c.t.baseDef && c.t.baseDef.realityGod ? 0.35 : 0) + (c.th ? 0.3 : 0.1); },
  aa_authority: (ai, s, c) => (c.d > 300 ? 0.8 : 0.55),
  aa_rewrite: (ai, s, c) => { const f = ai.f; return (RG_BAD.some(k => f.st[k] > 0) ? 0.7 : 0) + (f.sx && (f.sx.bindT > 0 || f.sx.sentence) ? 0.7 : 0) + (c.myR < 0.4 ? 0.3 : 0); },
  aa_rings: (ai, s, c) => { const f = ai.f; if (f.sx && f.sx.ringsT > 0) return 0; return rgIncoming(f) ? 1.05 : c.d < 600 ? 0.4 : 0.15; },
  fn_name: (ai, s, c) => (fnSealed(ai.f) ? 0.15 : 0.9 + (ai.f.sx && ai.f.sx.fateReady ? 0.3 : 0)),
  fn_vision: (ai, s, c) => (ai.f.sx && ai.f.sx.visionT > 0 ? 0 : 0.55 + (c.t.st.phase > 0 || c.t.decoy ? 0.4 : 0)),
  fn_bind: (ai, s, c) => (rgResist(c.t, 'bindImmT') || rgImmune(c.t) ? 0.1 : c.d < 560 ? 0.7 : 0.25),
  fn_sentence: (ai, s, c) => (rgResist(c.t, 'sentImmT') && !fnSealed(ai.f) ? 0.1 : fnSealed(ai.f) ? 1.05 : 0.55),
  fn_shade: (ai, s, c) => (supMinions(ai.f) >= 2 ? 0 : c.d < 700 ? 0.75 : 0.4),
});

/* =================== 2.6.0 skill registry: the 2.9.0 kit is exactly 5 abilities + the ultimate =================== */
{ const db = decorateBall; decorateBall = function (b, cfg) { db(b, cfg); if (b.realityGod) b.slotCap = (b.skills || []).length + (b.ult ? 1 : 0); }; }
/* kit power of each Reality God (from the balance runs in docs/QA-2.9.0.md): their abilities hit fewer times than older God
   Balls' bullet storms, so each hit is stronger. Applies to their abilities, ultimates and summons — never to collisions. */
RG.POWER = { voidbelow: 2.7, absoluteabove: 1.4, fatenote: 3.8 };
SUP.dmgHooks.push((src, tgt, amt, o) => { if (!src || o.kind === 'collision') return amt; const L = rgLord(src); return isRG(L) && L.team !== tgt.team ? amt * (RG.POWER[L.baseDef.id] || 1) : amt; });
/* a hit can be capped (Death Sentence, the Last Page): never more than a share of the target's max HP */
SUP.dmgHooks.push((src, tgt, amt, o) => (o.cap29 ? Math.min(amt, o.cap29 / (DMG_SCALE * ((BATTLE && BATTLE.dmgMul) || 1))) : amt));

if (window.NBB_CORE) Object.assign(window.NBB_CORE, { RG, RC, RZ, ARENAS29, ARCHON, GM29, SYNERGY, gmLevelOf, gmXpFor, gmOf, archonUnlocked, rzFree, fnWeakness, rcAcc, rcPos,
  realityGodIds: () => SUP.realityGodIds.slice() });
invalidateRegistry();
