/* =====================================================================
   NEON BALL BATTLE 2.8.0 — ANTI BALL: LIMITED EDITION (100 copies worldwide, serials ANTI-001 … ANTI-100)

   An upgrade of the existing Anti Ball (same id 'anti', same saves): a rare DEFENSIVE COUNTER ball.
   It never permanently disables, copies or steals anything. Every ability has a cooldown, a duration and a range,
   big effects are telegraphed, and its own damage reduction can never go below 45% of a hit.

   Kit (8 abilities + ultimate = the Limited rarity's 9 slots):
     NULL CORE · SKILL REJECTION · ADAPTIVE MATRIX · COUNTER PULSE · NULL ZONE · MIRROR PROTOCOL · SYSTEM OVERRIDE ·
     ABSOLUTE RESISTANCE · ultimate ANTI EXISTENCE
   Passive ADAPTIVE NULL: learns abilities that hit it again and again during ONE match (−10% per repeat, max −30%),
     forgets them after 8 s without a repeat and resets every match.
   NULL ASCENSION: black-chrome body, crimson core, floating geometric rings (first ultimate, or at 40% HP once).
   Anti Ball Mastery: looks only (rings, trail, entrance, victory, title) from verified battles — never extra power.

   Loaded after skills.js in the browser AND on the game server (deterministic: battle logic only uses the seeded RNG).
   Ownership (100 copies, serial numbers) is decided ONLY by the server (server/edition.js).
   ===================================================================== */
const AX = {
  PRICE_PHP: 999, SUPPLY: 100, SERIAL: n => 'ANTI-' + String(n | 0).padStart(3, '0'),
  CORE: { dur: 4, rk: 3.4, shot: 0.5, slow: 0.5, charge: 0.6, cap: 1.2 },  // Null Core: shell radius = ball radius × rk; weakened shots become null charge
  REJECT: { arm: 3, back: 0.6, cap: 1.3 },                                 // Skill Rejection: blocks ONE ability hit (never an ultimate) and fires it back as a null bolt
  MATRIX: { dur: 6, extra: 0.15, step: 0.8 },                              // Adaptive Matrix: +15% vs learned abilities, side-steps them
  PULSE: { arm: 5, r: 165, max: 3, gap: 0.7, dmg: 0.6 },                   // Counter Pulse: up to 3 pulses while armed (null charge adds to them)
  MIRROR: { life: 3, blink: 175, burst: 95, dmg: 0.5 },                    // Mirror Protocol: decoy + short blink
  OVERRIDE: { dur: 3, slow: 0.5, imm: 6, speed: 640, charge: 0.3, dmg: 0.35 }, // System Override: cooldowns tick at half speed for 3 s
  RESIST: { dur: 4, step: 0.2, floor: 0.4 },                               // Absolute Resistance: each repeat −20%, never below 40%
  EXIST: { r: 330, dur: 5, warn: 0.7, cut: 0.3, store: 0.5, pull: 0.7 },   // Anti Existence: 5 s domain after a 0.7 s warning; pulls inward in its last 0.7 s
  ADAPT: { per: 0.1, max: 3, forget: 8 },                                  // Adaptive Null
  ASC: { hp: 0.4, dr: 0.1, cd: 0.1 },                                      // NULL ASCENSION: −10% damage taken, cooldowns 10% faster
  FLOOR: 0.45,                                                             // Anti's own reductions never cut a hit below 45%
  CRIMSON: '#ff1744', CHROME: '#cfd8dc', CORE_HOT: '#ff8a80',
};
/** Anti Ball Mastery: total mastery EXP of its abilities (server-verified battles) → level 1–10. Looks only. */
const ANTI_MASTERY = [0, 600, 1800, 3600, 6400, 10000, 15000, 21000, 28000, 36000];   // ≈ 100 battles to level 10
const ANTI_MASTERY_PERKS = [
  [1, 'Null Core glow'], [2, 'Crimson null trail'], [3, 'Orbiting null motes'], [4, 'Second geometric ring in NULL ASCENSION'],
  [5, 'Crimson analysis rings'], [6, 'Black-chrome entrance'], [7, 'Distortion aura'], [8, 'Crimson victory nova'],
  [9, 'Third geometric ring'], [10, 'NULL MONARCH title and white-gold core'],
];
function antiMasteryOf(mast) {
  let xp = 0; if (mast && typeof mast === 'object') for (const k in mast) if (k.startsWith('anti.')) xp += Math.max(0, +mast[k] || 0);
  let lv = 1; for (let i = 0; i < ANTI_MASTERY.length; i++) if (xp >= ANTI_MASTERY[i]) lv = i + 1;
  const next = ANTI_MASTERY[lv] ?? null, prev = ANTI_MASTERY[lv - 1];
  return { lv, xp, next, prev, pct: next ? Math.min(1, (xp - prev) / (next - prev)) : 1 };
}
const isAntiF = f => !!(f && f.def && f.def.antiLE && !f.isClone);
const antiLv = f => (f && f.antiMastLv) || 1;

/* ---------------- the ball itself (upgrade of the existing record) ---------------- */
const ANTI_DEF = ALL_BUILTIN.find(b => b.id === 'anti');
const ANTI_ASC_DESIGN = D('#050507', '#ff1744', '#ff5252', 'nullasc', [], '', { glow: 1.9, sdeco: ['nullrings', 'nullmotes'], rings: 2, chrome: true });
if (ANTI_DEF) {
  Object.assign(ANTI_DEF, {
    rarity: 'Limited', hp: 118, atk: 80, def: 68, spd: 76, crit: 28, free: false, paid: true, edition: true, antiLE: true, isNew: true, pricePhp: AX.PRICE_PHP, godMode: false, godName: null,
    passive: 'adaptivenull', sound: { base: 98, wave: 'sawtooth', noise: 260 },
    passiveInfo: { name: 'ADAPTIVE NULL', desc: 'Learns abilities that hit it again and again in this match: each repeat makes that ability 10% weaker against it (max 30%). Forgets an ability after 8 s without a repeat, and everything when the match ends. Never copies, steals or disables anything.' },
    desc: 'LIMITED EDITION • 100 copies worldwide (ANTI-001 to ANTI-100). A rare defensive counter ball: it rejects, analyses and outlasts abilities instead of disabling everyone. Transforms into NULL ASCENSION.',
    skills: [
      S('NULL CORE', 'a_nullcore', 11, 60, '#ff1744'), S('SKILL REJECTION', 'a_reject', 13, 55, '#ff5252'),
      S('ADAPTIVE MATRIX', 'a_matrix', 14, 55, '#ff8a80'), S('COUNTER PULSE', 'a_pulse', 10, 60, '#ff1744'),
      S('NULL ZONE', 'nullzone', 12, 60, '#9d4dff'), S('MIRROR PROTOCOL', 'a_mirror', 12, 50, '#e0e0e0'),
      S('SYSTEM OVERRIDE', 'a_override', 13, 55, '#ff1744'), S('ABSOLUTE RESISTANCE', 'a_resist', 15, 55, '#b0bec5')],
    ult: U('ANTI EXISTENCE', 'a_existence', 115, '#ff1744', 'weaken'),
    ascension: { name: 'NULL ASCENSION', design: ANTI_ASC_DESIGN },
  });
}
/* a mastery level changes only the LOOK of each form (rings, core colour, motes) */
const ANTI_LOOK = {};
function antiDefFor(lv, asc) {
  const key = lv + '|' + (asc ? 1 : 0); if (ANTI_LOOK[key]) return ANTI_LOOK[key];
  const base = ANTI_DEF, d = asc ? { ...base.design, ...ANTI_ASC_DESIGN } : { ...base.design };
  if (asc) { d.rings = lv >= 9 ? 3 : lv >= 4 ? 2 : 1; d.gold = lv >= 10; if (d.gold) d.c3 = '#ffd54f'; }
  else if (lv >= 3) d.sdeco = ['nullmotes'];
  if (lv >= 7) d.sdeco = [...(d.sdeco || []), 'nulldistort'];
  return (ANTI_LOOK[key] = { ...base, design: d, formName: asc ? 'NULL ASCENSION' : null });
}
/* Mirror Protocol's decoy: looks like Anti Ball, has no abilities and never counts as a real ball */
const NULL_DECOY = ANTI_DEF ? { ...ANTI_DEF, id: 'nulldecoy', name: 'Null Mirror', antiLE: false, skills: [], ult: null, passive: null, summonOnly: true, adminOnly: true, edition: false, paid: false } : null;

/* ---------------- sounds (each ability has its own motif) ---------------- */
function antiSound(kind) {
  if (FX.off || !Sound.ctx || !SAVE || !SAVE.settings || SAVE.settings.sfx <= 0) return;
  try {
    const T = (f, d, w, v, s, dl) => Sound.tone(f, d, w, v, s, dl);
    switch (kind) {
      case 'core': T(65, 0.8, 'sine', 0.16, 0.6); T(130, 0.6, 'sawtooth', 0.05, 0.7, 0.05); break;
      case 'reject': T(880, 0.12, 'square', 0.07, 0.4); T(220, 0.25, 'sawtooth', 0.08, 0.5, 0.06); break;
      case 'rejected': T(1320, 0.08, 'square', 0.06, 0.3); T(110, 0.3, 'sawtooth', 0.1, 0.4, 0.04); Sound.noiseHit(0.25, 0.12, 1800, 0.4); break;
      case 'matrix': [440, 554, 659, 880].forEach((f, i) => T(f, 0.14, 'triangle', 0.05, 1, i * 0.06)); break;
      case 'pulse': T(90, 0.35, 'sine', 0.18, 0.5); Sound.noiseHit(0.3, 0.12, 500, 0.5); break;
      case 'mirror': T(1200, 0.25, 'sine', 0.05, 0.6); T(600, 0.3, 'triangle', 0.05, 1.6, 0.05); break;
      case 'override': [1600, 400, 1200, 300].forEach((f, i) => T(f, 0.06, 'square', 0.05, 1, i * 0.04)); break;
      case 'resist': T(180, 0.6, 'triangle', 0.08, 1.2); T(360, 0.4, 'sine', 0.05, 1.1, 0.1); break;
      case 'warn': T(55, 0.7, 'sawtooth', 0.12, 1.6); break;
      case 'exist': T(40, 2.0, 'sine', 0.25, 0.5); T(80, 1.6, 'sawtooth', 0.08, 0.6, 0.1); [660, 990, 1320].forEach((f, i) => T(f, 0.9, 'sine', 0.04, 0.7, 0.2 + i * 0.1)); Sound.noiseHit(1.2, 0.2, 260, 0.5); break;
      case 'collapse': T(30, 1.0, 'sawtooth', 0.22, 0.4); Sound.noiseHit(1.0, 0.35, 220, 0.4); break;
      case 'ascend': [1, 1.5, 2, 3, 4].forEach((m, i) => T(98 * m, 0.7, 'triangle', 0.06, 1.01, i * 0.1)); T(49, 1.6, 'sine', 0.3, 0.5); Sound.noiseHit(1.0, 0.2, 400, 0.5); break;
      case 'entrance': T(30, 1.2, 'sine', 0.22, 2.6); [784, 587, 392].forEach((f, i) => T(f, 0.4, 'sine', 0.04, 0.9, 0.5 + i * 0.12)); break;
      case 'victory': [392, 494, 587, 784].forEach((f, i) => T(f, 0.45, 'triangle', 0.08, 1, i * 0.13)); T(98, 1.2, 'sine', 0.15, 0.6); break;
    }
  } catch (e) { /* audio is optional */ }
}
const antiSay = (f, txt, col = AX.CRIMSON, size = 15) => { if (!FX.off) FX.text(f.x, f.y - f.r - 30, txt, col, size, { life: 1.0, pop: 1.4 }); };

/* ---------------- NULL ASCENSION ---------------- */
function antiAscend(f, why) {
  const S = sx(f); if (S.asc || !f.alive) return;
  S.asc = true; f.def = antiDefFor(antiLv(f), true);
  f.st.invuln = Math.max(f.st.invuln, 0.8); f.st.stun = f.st.freeze = 0;
  for (const e of supEnemies(f)) if (len(e.x - f.x, e.y - f.y) < 260 + e.r) knock(e, f.x, f.y, 520);
  if (FX.off) return;
  antiSound('ascend'); darkArena(1.2, '#000000', 0.55); camPunch(f.x, f.y, 0.2, 1.2); FX.addFlash(0.25, AX.CRIMSON); FX.addShake(12);
  FX.text(ARENA.cx, ARENA.y + 70, 'NULL ASCENSION', AX.CRIMSON, 42, { life: 1.8, vy: 0, pop: 2, stroke: '#000000' });
  FX.text(ARENA.cx, ARENA.y + 114, why === 'hp' ? 'the null core breaks open' : 'existence denied', '#ff8a80', 20, { life: 1.6, vy: 0 });
  for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, d = 120 + Math.random() * 200; FX.p(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, -Math.cos(a) * d * 2.4, -Math.sin(a) * d * 2.4, 0.45, 2 + Math.random() * 3, i % 3 ? '#000000' : AX.CRIMSON, 'dot', 0); }
  vfx((ctx, q) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { ctx.strokeStyle = rgba(k === 1 ? '#ffffff' : AX.CRIMSON, (1 - q) * 0.9); ctx.lineWidth = 4 - k; antiPoly(ctx, f.x, f.y, f.r * (1.4 + q * (3 + k)), 6 - k, q * 3 + k); } ctx.restore(); }, 1.1);
  FX.burst(f.x, f.y, AX.CRIMSON, 60, 620, 7, 1.0, 'shard'); FX.burst(f.x, f.y, '#000000', 40, 420, 9, 1.1, 'smoke');
}
/** a regular polygon outline (geometric rings, warnings, analysis display) */
function antiPoly(ctx, x, y, r, n, rot) { ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = rot + i / n * TAU; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }

/* ---------------- abilities ---------------- */
const antiTgt = (f, tgt) => supTarget(f, tgt);
SK('a_nullcore', 'defense', '◉', 'Null Core',
  'For 4 s a crimson shell around the ball halves the damage and speed of enemy shots that touch it (not ultimates) and stores part of it as null charge for Counter Pulse; its own stuns and slows wear off twice as fast',
  (f, s, P, col) => {
    const S = sx(f); if (S.coreT > 0) return false;
    S.coreT = AX.CORE.dur + P / 120; S.coreP = P;
    for (const k of ['stun', 'slow', 'freeze', 'weaken', 'burn', 'poison']) if (f.st[k] > 0) f.st[k] *= 0.5;
    if (!FX.off) { antiSound('core'); FX.ring(f.x, f.y, col, f.r * AX.CORE.rk, 0.45, 6, f.r); darkBurst(f.x, f.y, 90, 0.4); }
  }, true);
SK('a_reject', 'defense', '⊘', 'Skill Rejection',
  'Arms a rejection seal for 3 s: the next enemy ABILITY hit (never an ultimate, never burn or poison ticks) is rejected completely and fired back at the attacker as a dodgeable null bolt. One hit only',
  (f, s, P, col) => {
    const S = sx(f); if (S.rejectT > 0) return false;
    S.rejectT = AX.REJECT.arm + P / 150; S.rejectP = P; S.rejectSk = CUR_SK;
    if (!FX.off) { antiSound('reject'); FX.ring(f.x, f.y, col, f.r * 1.6, 0.35, 5, f.r * 2.6); antiSay(f, 'REJECTION ARMED', col, 13); }
  }, true);
SK('a_matrix', 'buff', '⌬', 'Adaptive Matrix',
  'Runs the analysis for 6 s: abilities it has already learned this match hit it 15% softer, and it side-steps their shots when they come close',
  (f, s, P, col) => {
    const S = sx(f); if (S.matrixT > 0) return false;
    S.matrixT = AX.MATRIX.dur + P / 120; S.mxStepT = 0;
    if (!FX.off) { antiSound('matrix'); vfx((ctx, q) => { ctx.save(); ctx.strokeStyle = rgba(col, 1 - q); ctx.lineWidth = 2; for (let i = 0; i < 3; i++) antiPoly(ctx, f.x, f.y, f.r * (1.6 + i * 0.5 + q), 3 + i, q * (i % 2 ? -4 : 4)); ctx.restore(); }, 0.8); antiSay(f, 'ANALYSING PATTERNS', col, 13); }
  }, true);
SK('a_pulse', 'aoe', '◎', 'Counter Pulse',
  'Arms for 5 s: whenever an enemy comes within range it fires a null pulse that pushes it away, hurts and slows it (up to 3 pulses). The range is shown while armed',
  (f, s, P, col) => {
    const S = sx(f); if (S.pulseT > 0) return false;
    S.pulseT = AX.PULSE.arm; S.pulseN = AX.PULSE.max; S.pulseCdT = 0; S.pulseP = P;
    if (!FX.off) { antiSound('pulse'); FX.ring(f.x, f.y, col, AX.PULSE.r, 0.35, 4, f.r); }
  }, true);
SK('a_mirror', 'mobility', '◐', 'Mirror Protocol',
  'Leaves a null mirror of itself behind and blinks aside: enemy targeting and homing shots go after the mirror for up to 3 s, then the mirror bursts',
  (f, s, P, col, tgt) => {
    if (!NULL_DECOY || BATTLE.fighters.some(u => u.alive && u.owner === f && u.nullMirror)) return false;
    const t = antiTgt(f, tgt), base = t ? angTo(t, f) : f.rot, side = RNG() < 0.5 ? 1 : -1, a = base + side * Math.PI / 2;
    const ox = f.x, oy = f.y, nx = inArenaX(f.x + dcos(a) * AX.MIRROR.blink, f.r), ny = inArenaY(f.y + dsin(a) * AX.MIRROR.blink, f.r);
    const u = spawnUnit(f, 'nullmirror', ox, oy, { def: NULL_DECOY, force: true, anchored: true, decoy: true, life: AX.MIRROR.life, hp: 0.06, statMul: 0.2, rScale: f.r / BASE_R });
    if (!u) return false;
    u.nullMirror = true; u.ballLook = true; u.mech = false; u.mirrorP = P; u.mirrorSk = CUR_SK;
    f.x = nx; f.y = ny;
    for (const p of BATTLE.projs) if (p.team !== f.team && p.target === f) p.target = u;
    for (const e of BATTLE.fighters) if (e.alive && e.team !== f.team && e.target === f) e.target = u;
    if (!FX.off) { antiSound('mirror'); FX.burst(ox, oy, '#ffffff', 14, 260, 4, 0.4); FX.ring(nx, ny, col, f.r * 2.2, 0.3, 4, f.r); FX.bolt(ox, oy, nx, ny, col, 2, 0.2); }
  }, true);
SK('a_override', 'control', '⌁', 'System Override',
  'After a short warning line, fires a dodgeable null bolt: the ball it hits has its cooldowns tick at half speed for 3 s (half as long on bosses). Then that ball cannot be overridden again for 6 s',
  (f, s, P, col, tgt) => {
    const t = antiTgt(f, tgt); if (!t || len(t.x - f.x, t.y - f.y) > 900) return false;
    const T = sx(t); if (T.ovrImmT > 0 || T.ovrT > 0) return false;
    const aim = predictPos(f, t, AX.OVERRIDE.charge + len(t.x - f.x, t.y - f.y) / AX.OVERRIDE.speed), tx = aim.x, ty = aim.y;     // the warning line points at this spot
    if (!FX.off) vfx((ctx, q) => { const a = Math.atan2(ty - f.y, tx - f.x); ctx.save(); ctx.globalAlpha = 0.7 * (1 - q); ctx.strokeStyle = col; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * 700, f.y + Math.sin(a) * 700); ctx.stroke(); ctx.restore(); }, AX.OVERRIDE.charge, { keep: true });
    after(AX.OVERRIDE.charge, () => {
      if (!f.alive) return;
      const a = datan2(ty - f.y, tx - f.x);
      supShot(f, f.x, f.y, a, { speed: AX.OVERRIDE.speed, r: 9, dmg: SD(f, P) * AX.OVERRIDE.dmg, col, life: 1.6, style: 'a_override', power: P,
        onHit: (p, e) => { const E = sx(e); if (E.ovrImmT > 0 || E.ovrT > 0) return; E.ovrT = AX.OVERRIDE.dur * (e.boss ? 0.5 : 1); E.ovrImmT = E.ovrT + AX.OVERRIDE.imm;
          if (!FX.off) { antiSound('override'); FX.text(e.x, e.y - e.r - 26, 'SYSTEM OVERRIDE', col, 15, { life: 1, pop: 1.4 }); } } });
      if (!FX.off) antiSound('override');
    });
  });
SK('a_resist', 'defense', '⬡', 'Absolute Resistance',
  'For 4 s every repeat of the same attack from the same enemy hurts 20% less than the last one (never below 40%). Resets when it ends',
  (f, s, P, col) => {
    const S = sx(f); if (S.resistT > 0) return false;
    S.resistT = AX.RESIST.dur + P / 150; S.resHits = {};
    if (!FX.off) { antiSound('resist'); vfx((ctx, q) => { ctx.save(); ctx.strokeStyle = rgba(col, 0.9 * (1 - q)); ctx.lineWidth = 3; antiPoly(ctx, f.x, f.y, f.r * (1.3 + q * 0.6), 6, q); ctx.restore(); }, 0.6); }
  }, true);
UL('a_existence', 'Anti Existence — a telegraphed null domain: enemy shots vanish inside, enemy cooldowns stop inside, Anti Ball and its team take 30% less damage inside; at the end it pulls inward and collapses into a null burst that grows with what it absorbed',
  (f, P, col, dmg) => {
    if (!sx(f).asc) antiAscend(f, 'ult');
    const Z = { owner: f, team: f.team, x: f.x, y: f.y, r: AX.EXIST.r, warn: AX.EXIST.warn, t: AX.EXIST.dur, max: AX.EXIST.dur, dmg, stored: 0, col, sk: (f.ult && f.ult.uid) || null };
    (BATTLE.antiDomains || (BATTLE.antiDomains = [])).push(Z);
    if (!FX.off) { antiSound('warn'); FX.text(ARENA.cx, ARENA.y + 160, 'ANTI EXISTENCE', AX.CRIMSON, 34, { life: 1.6, vy: 0, pop: 1.8, stroke: '#000000' }); }
  });
/* Null Zone keeps its classic mechanic (enemies inside the field are weakened); only its colour follows the form */

/* ---------------- damage: rejection, resistance, adaptive null, ascension, domain ---------------- */
function antiPatternOf(src, o) {
  const s = src ? (src.credit || src) : null;
  if (o && o.sk) {
    let name = null; if (s) { const k = (s.allSkills ? s.allSkills() : []).find(q => q.uid === o.sk); name = k ? k.name : (s.ult && s.ult.uid === o.sk ? s.ult.name : null); }
    return { key: o.sk, name: name || (typeof ANTI_LABEL !== 'undefined' && ANTI_LABEL[o.tag]) || 'ABILITY' };
  }
  const tag = (o && (o.tag || o.kind)) || 'hit';
  return { key: (s ? s.def.id : 'world') + ':' + tag, name: (typeof ANTI_LABEL !== 'undefined' && ANTI_LABEL[tag]) || tag.toUpperCase() };
}
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const S = tgt.sx; if (!S || !BATTLE) return amt;
  const dot = o.kind === 'dot', isUlt = !!(CUR_ULT || (o.sk && String(o.sk).endsWith('.ult')));
  // Skill Rejection: one ability hit, never an ultimate
  if (S.rejectT > 0 && !dot && !isUlt && o.kind !== 'collision' && src && src.team !== tgt.team) {
    S.rejectT = 0;
    const att = src.credit || src, me = tgt, P = S.rejectP || 55, back = Math.min(SD(me, P) * AX.REJECT.cap, SD(me, P) * 0.5 + amt * AX.REJECT.back), skU = S.rejectSk || null;
    if (att && att.alive) after(0.05, () => { if (!me.alive || !att.alive) return; const p = supShot(me, me.x, me.y, angTo(me, att), { speed: 760, r: 10, dmg: back, col: AX.CRIMSON, life: 1.6, homing: 2.2, target: att, style: 'a_override', power: P }); p.sk = skU; });
    if (!FX.off) { antiSound('rejected'); FX.text(tgt.x, tgt.y - tgt.r - 28, 'REJECTED', AX.CRIMSON, 18, { life: 0.9, pop: 1.8, stroke: '#000000' }); FX.ring(tgt.x, tgt.y, AX.CRIMSON, tgt.r * 2, 0.3, 6, tgt.r); }
    return 0;
  }
  let k = 1;
  if (!dot && src && src.team !== tgt.team) {
    const pat = (S.resistT > 0 || isAntiF(tgt)) ? antiPatternOf(src, o) : null;
    if (S.resistT > 0) { const key = (src.credit || src).sid + '|' + pat.key; const n = (S.resHits[key] = (S.resHits[key] || 0) + 1); k *= Math.max(AX.RESIST.floor, 1 - AX.RESIST.step * (n - 1)); }
    if (isAntiF(tgt)) {     // ADAPTIVE NULL (this match only)
      const L = S.anLearn || (S.anLearn = {}), r = L[pat.key];
      if (r && BATTLE.time - r.last <= AX.ADAPT.forget) { r.n++; r.last = BATTLE.time; } else L[pat.key] = { n: 1, last: BATTLE.time, name: pat.name };
      const stacks = Math.min(AX.ADAPT.max, L[pat.key].n - 1);
      if (stacks > 0) { k *= 1 - AX.ADAPT.per * stacks; if (S.matrixT > 0) k *= 1 - AX.MATRIX.extra; }
      S.anKey = pat.key; S.anName = pat.name; S.anStacks = stacks; S.anShowT = 2.5;
    }
  }
  if (S.asc && isAntiF(tgt)) k *= 1 - AX.ASC.dr;
  if (BATTLE.antiDomains) for (const Z of BATTLE.antiDomains) if (Z.warn <= 0 && Z.team === tgt.team && len(tgt.x - Z.x, tgt.y - Z.y) < Z.r) { k *= 1 - AX.EXIST.cut; Z.stored += amt * AX.EXIST.cut * AX.EXIST.store; break; }
  if (S.coreT > 0 && o.tag !== 'collision' && !dot) k *= 1;      // (Null Core works on the shots themselves, see below)
  return amt * Math.max(AX.FLOOR, k);
});
/* chips on the battle HUD: the analysis indicator, and every active effect with its time */
SUP.chipHooks.push((f, chips) => {
  const S = f.sx; if (!S) return;
  if (isAntiF(f)) {
    if (S.anShowT > 0 && S.anStacks > 0) chips.push([`ANALYSED: ${S.anName} ${S.anStacks}/${AX.ADAPT.max}`, '#ff8a80']);
    else if (S.anShowT > 0) chips.push([`ANALYSING: ${S.anName}`, '#ffcdd2']);
    if (S.asc) chips.push(['NULL ASCENSION', AX.CRIMSON]);
  }
  if (S.coreT > 0) chips.push(['NULL CORE ' + S.coreT.toFixed(1), AX.CRIMSON]);
  if (S.nullCharge > 1) chips.push(['NULL CHARGE ' + Math.round(S.nullCharge), '#ff8a80']);
  if (S.rejectT > 0) chips.push(['REJECTION ARMED', '#ff5252']);
  if (S.matrixT > 0) chips.push(['MATRIX ' + S.matrixT.toFixed(1), '#ff8a80']);
  if (S.pulseT > 0) chips.push([`COUNTER PULSE ×${S.pulseN | 0}`, AX.CRIMSON]);
  if (S.resistT > 0) chips.push(['RESISTANCE ' + S.resistT.toFixed(1), '#b0bec5']);
  if (S.ovrT > 0) chips.push(['OVERRIDDEN ' + S.ovrT.toFixed(1), '#ff5252']);
});

/* ---------------- every step: shells, pulses, side-steps, overrides, the domain, ascension ---------------- */
SUP.worldHooks.push((B, h) => {
  for (const f of B.fighters) {
    if (!f.alive) continue;
    const S = f.sx; if (!S) continue;
    if (S.ovrT > 0 && !(f.st.timestop > 0)) { const back = h / f.cdMul() * AX.OVERRIDE.slow; for (const q of f.allSkills()) if (q.cdLeft > 0) q.cdLeft += back; }   // System Override
    if (S.coreT > 0) {       // Null Core: enemy shots touching the shell lose half their damage and speed (once); own statuses wear off faster
      const R = f.r * AX.CORE.rk;
      for (const p of B.projs) if (p.team !== f.team && !p.cored26 && !p.ult && dist2(p.x, p.y, f.x, f.y) < (R + p.r) * (R + p.r)) { p.cored26 = true; S.nullCharge = Math.min(SD(f, S.coreP || 60) * AX.CORE.cap, (S.nullCharge || 0) + (p.dmg || 0) * (1 - AX.CORE.shot) * AX.CORE.charge); p.dmg *= AX.CORE.shot; p.vx *= AX.CORE.slow; p.vy *= AX.CORE.slow; p.speed = (p.speed || 0) * AX.CORE.slow; if (!FX.off) FX.sparks(p.x, p.y, AX.CRIMSON, 4, 160); }
      for (const k of ['stun', 'slow', 'freeze', 'weaken']) if (f.st[k] > 0) f.st[k] = Math.max(0, f.st[k] - h);
    }
    if (S.pulseT > 0 && S.pulseN > 0 && !(S.pulseCdT > 0) && f.canAct()) {     // Counter Pulse
      const near = supEnemies(f).filter(e => len(e.x - f.x, e.y - f.y) < AX.PULSE.r + e.r);
      if (near.length) {
        S.pulseN--; S.pulseCdT = AX.PULSE.gap; if (S.pulseN <= 0) S.pulseT = 0;
        const P = S.pulseP || 60, sk = f.skills.find(q => q.type === 'a_pulse'), extra = (S.nullCharge || 0) / near.length; S.nullCharge = 0;
        for (const e of near) { dealDamage(f, e, SD(f, P) * AX.PULSE.dmg + extra, { kind: 'skill', tag: 'wave', effect: 'slow', power: P, sk: sk && sk.uid }); knock(e, f.x, f.y, 760); }
        if (!FX.off) { antiSound('pulse'); FX.ring(f.x, f.y, AX.CRIMSON, AX.PULSE.r + 40, 0.3, 8, f.r); FX.ring(f.x, f.y, '#000000', AX.PULSE.r, 0.35, 5, f.r); }
      }
    }
    if (!isAntiF(f)) continue;
    // Adaptive Matrix: side-step shots of abilities it has learned (at most once per 0.8 s)
    if (S.matrixT > 0 && !(S.mxStepT > 0) && S.anLearn) {
      for (const p of B.projs) {
        if (p.team === f.team || !p.sk || !S.anLearn[p.sk] || S.anLearn[p.sk].n < 2) continue;
        const dx = f.x - p.x, dy = f.y - p.y, d = len(dx, dy); if (d > 150 || (p.vx * dx + p.vy * dy) <= 0) continue;
        const sp = Math.hypot(p.vx, p.vy) || 1, nx = -p.vy / sp, ny = p.vx / sp, side = (nx * dx + ny * dy) >= 0 ? 1 : -1;
        f.vx += nx * side * f.baseSpeed * 2.2; f.vy += ny * side * f.baseSpeed * 2.2; S.mxStepT = AX.MATRIX.step;
        if (!FX.off) { FX.sparks(f.x, f.y, '#ff8a80', 6, 220); antiSay(f, 'PREDICTED', '#ff8a80', 12); }
        break;
      }
    }
    if (S.asc && !(f.st.timestop > 0)) for (const q of f.allSkills()) if (q.cdLeft > 0) q.cdLeft -= h / f.cdMul() * AX.ASC.cd;     // NULL ASCENSION: cooldowns 10% faster
    if (!S.asc && f.hpRatio <= AX.ASC.hp && !B.cinematic) antiAscend(f, 'hp');
  }
  // ANTI EXISTENCE domains
  if (B.antiDomains && B.antiDomains.length) {
    for (let i = B.antiDomains.length - 1; i >= 0; i--) {
      const Z = B.antiDomains[i], o = Z.owner;
      if (Z.warn > 0) { Z.warn -= h; if (Z.warn <= 0 && !FX.off) { antiSound('exist'); FX.addFlash(0.2, AX.CRIMSON); camPunch(Z.x, Z.y, 0.16, 1.0); darkArena(Z.t, '#000000', 0.35); } continue; }
      Z.t -= h;
      if (Z.t < AX.EXIST.pull) for (const e of B.fighters) if (e.alive && e.team !== Z.team && !(e.st.outside > 0) && !e.anchored) { const dx = Z.x - e.x, dy = Z.y - e.y, d = len(dx, dy); if (d < Z.r + e.r && d > 10) { e.vx += dx / d * 1500 * h; e.vy += dy / d * 1500 * h; } }   // the collapse pulls inward
      for (let k = B.projs.length - 1; k >= 0; k--) { const p = B.projs[k]; if (p.team === Z.team || dist2(p.x, p.y, Z.x, Z.y) > Z.r * Z.r) continue;
        if (p.ult) { if (!p.exist26) { p.exist26 = true; p.dmg *= 0.5; } continue; }
        Z.stored += (p.dmg || 0) * AX.EXIST.store; B.projs.splice(k, 1); if (!FX.off) FX.burst(p.x, p.y, '#000000', 5, 120, 3, 0.3); }
      for (const e of B.fighters) if (e.alive && e.team !== Z.team && !(e.st.outside > 0) && !(e.st.timestop > 0) && len(e.x - Z.x, e.y - Z.y) < Z.r + e.r) { const back = h / e.cdMul() * (e.boss ? 0.5 : 1); for (const q of e.allSkills()) if (q.cdLeft > 0) q.cdLeft += back; }
      if (Z.t <= 0 || !o.alive) {
        B.antiDomains.splice(i, 1);
        if (!o.alive) continue;
        const amt = Z.dmg * 0.9 + Math.min(Z.stored, Z.dmg * 0.8);
        for (const e of supEnemies(o)) if (len(e.x - Z.x, e.y - Z.y) < Z.r + e.r) { dealDamage(o, e, amt, { kind: 'skill', tag: 'explosion', effect: 'weaken', power: 115, noCrit: true, sk: Z.sk }); knock(e, Z.x, Z.y, 820); }
        if (!FX.off) { antiSound('collapse'); FX.addShake(14); FX.burst(Z.x, Z.y, AX.CRIMSON, 90, 820, 7, 1.0, 'shard'); FX.burst(Z.x, Z.y, '#000000', 60, 560, 10, 1.2, 'smoke'); FX.ring(Z.x, Z.y, '#ffffff', Z.r * 1.2, 0.5, 10, Z.r * 0.2); FX.text(Z.x, Z.y - 40, 'NULLIFIED', AX.CRIMSON, 26, { life: 1.2, pop: 2, stroke: '#000000' }); }
      }
    }
  }
});
/* the decoy bursts when it ends (or is destroyed) */
SUP.worldHooks.push(B => {
  for (const u of B.fighters) if (u.nullMirror && !u.mirrorDone && (!u.alive || u.life <= 0.05)) {
    u.mirrorDone = true; const f = u.owner; if (!f || !f.alive) continue;
    for (const e of supEnemies(f)) if (len(e.x - u.x, e.y - u.y) < AX.MIRROR.burst + e.r) dealDamage(f, e, SD(f, u.mirrorP || 50) * AX.MIRROR.dmg, { kind: 'skill', tag: 'explosion', effect: 'slow', power: u.mirrorP || 50, sk: u.mirrorSk || null });
    if (!FX.off) { FX.burst(u.x, u.y, '#ffffff', 18, 300, 4, 0.5, 'shard'); FX.ring(u.x, u.y, AX.CRIMSON, AX.MIRROR.burst, 0.3, 5, u.r); }
  }
});
/* each Anti Ball fighter: mastery look, entrance, persistent visual layer (shell, analysis rings, warnings, the domain) */
SUP.worldHooks.push(B => {
  for (const f of B.fighters) {
    if (!isAntiF(f) || f.anti26) continue;
    f.anti26 = true; sx(f);
    if (!f.baseDef) { f.baseDef = ANTI_DEF; f.form = 0; f.fm = 1; f.ults = 0; f.hist = f.hist || []; f.r0 = f.r0 || f.r; }   // the shared visual hooks (victory, defeat, idle, bounce)
    f.antiMastLv = antiMasteryOf(f.mast).lv; f.def = antiDefFor(f.antiMastLv, false);
    if (FX.off) continue;
    antiEntrance(f);
    vfx(ctx => antiLayer(ctx, f), 1e9, { keep: true });
  }
});
function antiEntrance(f) {
  const lv = antiLv(f); antiSound('entrance');
  vfx((ctx, q) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const R = f.r * (5 - q * 4);
    ctx.strokeStyle = rgba(lv >= 6 ? '#e0e0e0' : AX.CRIMSON, 1 - q); ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) antiPoly(ctx, f.x, f.y, R * (1 - i * 0.18), 3 + i * 3, q * (i % 2 ? -5 : 5));
    if (lv >= 6) { ctx.fillStyle = rgba('#cfd8dc', 0.5 * (1 - q)); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + q * 4, d = R * 0.8; ctx.fillRect(f.x + Math.cos(a) * d - 4, f.y + Math.sin(a) * d - 4, 8, 8); } }
    ctx.restore();
  }, 1.4);
  FX.text(f.x, f.y - f.r - 58, 'ANTI BALL • LIMITED EDITION', AX.CRIMSON, 16, { life: 1.6, pop: 1.5 });
}
function antiLayer(ctx, f) {
  if (!f.alive) return; const S = f.sx || {}, t = BATTLE ? BATTLE.time : 0;
  ctx.save();
  if (S.coreT > 0) {      // Null Core shell
    const R = f.r * AX.CORE.rk; ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 10); ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.8; ctx.strokeStyle = AX.CRIMSON; ctx.lineWidth = 2.5; antiPoly(ctx, f.x, f.y, R, 12, t);
  }
  if (S.pulseT > 0) { ctx.globalAlpha = 0.55; ctx.strokeStyle = AX.CRIMSON; ctx.setLineDash([6, 10]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, AX.PULSE.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }   // Counter Pulse range warning
  if (S.rejectT > 0) { ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.45, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(f.x - f.r, f.y + f.r); ctx.lineTo(f.x + f.r, f.y - f.r); ctx.stroke(); }
  if (S.resistT > 0) { ctx.globalAlpha = 0.7; ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) antiPoly(ctx, f.x, f.y, f.r * (1.25 + i * 0.14), 6, i * 0.3); }
  if (S.anShowT > 0 && S.anStacks > 0) {      // ADAPTIVE NULL analysis indicator: one crimson arc per learned repeat
    const lv = antiLv(f), col = lv >= 5 ? AX.CRIMSON : '#ff8a80';
    ctx.globalAlpha = Math.min(1, S.anShowT); ctx.strokeStyle = col; ctx.lineWidth = 3;
    for (let i = 0; i < AX.ADAPT.max; i++) { ctx.globalAlpha = i < S.anStacks ? Math.min(1, S.anShowT) : 0.18; const a0 = -Math.PI / 2 + i * TAU / 3 + t * 0.8; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.9, a0 + 0.12, a0 + TAU / 3 - 0.12); ctx.stroke(); }
  }
  if (S.matrixT > 0) { ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ff8a80'; ctx.lineWidth = 1.5; antiPoly(ctx, f.x, f.y, f.r * 2.3, 3, t * 2); antiPoly(ctx, f.x, f.y, f.r * 2.3, 3, -t * 2 + Math.PI); }
  ctx.restore();
}
/* the domain (and its warning) are drawn for everyone, every frame */
SUP.worldHooks.push(B => {
  if (FX.off || !B.antiDomains) return;
  for (const Z of B.antiDomains) if (!Z.drawn) {
    Z.drawn = true;
    vfx((ctx) => {
      if (!BATTLE || !BATTLE.antiDomains || !BATTLE.antiDomains.includes(Z)) return;
      const tm = BATTLE.time; ctx.save();
      if (Z.warn > 0) {       // warning: the exact area, before anything happens
        const q = 1 - Z.warn / AX.EXIST.warn; ctx.globalAlpha = 0.25 + 0.25 * Math.sin(tm * 30); ctx.strokeStyle = AX.CRIMSON; ctx.setLineDash([14, 10]); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(Z.x, Z.y, Z.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 0.2; ctx.fillStyle = AX.CRIMSON; ctx.beginPath(); ctx.arc(Z.x, Z.y, Z.r * q, 0, TAU); ctx.fill();
      } else {
        const g = ctx.createRadialGradient(Z.x, Z.y, Z.r * 0.1, Z.x, Z.y, Z.r); g.addColorStop(0, 'rgba(255,23,68,0.30)'); g.addColorStop(0.55, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Z.x, Z.y, Z.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = AX.CRIMSON; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(Z.x, Z.y, Z.r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.6; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) antiPoly(ctx, Z.x, Z.y, Z.r * (0.35 + i * 0.16), 3 + i, tm * (i % 2 ? -0.7 : 0.7));
        ctx.globalAlpha = 0.35; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + tm * 0.4, w = Math.sin(tm * 3 + i) * 10; ctx.beginPath(); ctx.arc(Z.x, Z.y, Z.r - 12 + w, a, a + 0.3); ctx.stroke(); }   // space distortion
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.font = '900 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ANTI EXISTENCE ' + Math.max(0, Z.t).toFixed(1), Z.x, Z.y - Z.r - 10);
      }
      ctx.restore();
    }, 1e9, { keep: true });
  }
});

/* ---------------- AI: when each ability is worth it ---------------- */
const incoming = (f, r = 360) => BATTLE.projs.some(p => p.team !== f.team && !p.ult && dist2(p.x, p.y, f.x, f.y) < r * r && (p.vx * (f.x - p.x) + p.vy * (f.y - p.y)) > 0);
Object.assign(SUP.scoreFn, {
  a_nullcore: (ai, s, c) => { const f = ai.f; if (f.sx && f.sx.coreT > 0) return 0; return incoming(f) || c.th ? 1.05 : (f.st.stun > 0 || f.st.slow > 0 ? 0.8 : c.d < 480 ? 0.45 : 0.15); },
  a_reject: (ai, s, c) => { const f = ai.f; if (f.sx && f.sx.rejectT > 0) return 0; return c.th || incoming(f, 300) ? 1.0 : c.d < 420 && c.t.skills && c.t.skills.some(k => !k.locked && k.cdLeft < 1) ? 0.6 : 0.2; },
  a_matrix: (ai, s, c) => { const f = ai.f, S = f.sx || {}; if (S.matrixT > 0) return 0; const learned = S.anLearn ? Object.values(S.anLearn).filter(r => r.n >= 2 && BATTLE.time - r.last < AX.ADAPT.forget).length : 0; return learned ? 0.75 + learned * 0.1 : 0.1; },
  a_pulse: (ai, s, c) => { const f = ai.f; if (f.sx && f.sx.pulseT > 0) return 0; return c.d < 260 ? 0.95 : c.d < 420 ? 0.55 : 0.12; },
  a_mirror: (ai, s, c) => (c.th || incoming(ai.f, 240) ? 0.95 : c.myR < 0.5 ? 0.7 : 0.25),
  a_override: (ai, s, c) => { const T = c.t.sx || {}; if (T.ovrImmT > 0 || T.ovrT > 0 || c.d > 820) return 0; return 0.5 + (c.t.skills && c.t.skills.some(k => !k.locked && k.cdLeft < 2) ? 0.3 : 0) + (c.t.ultMeter >= 80 ? 0.1 : 0); },
  a_resist: (ai, s, c) => { const f = ai.f, S = f.sx || {}; if (S.resistT > 0) return 0; const rep = S.anLearn && Object.values(S.anLearn).some(r => r.n >= 2 && BATTLE.time - r.last < 3); return rep ? 0.9 : c.myR < 0.6 ? 0.55 : 0.2; },
});

/* ---------------- looks: NULL ASCENSION body, geometric rings, motes, distortion, the override bolt ---------------- */
Object.assign(PATTERN_FN, {
  nullasc(g, R, d) {        // black chrome with a glowing crimson core
    const gr = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R); gr.addColorStop(0, '#6b6f7a'); gr.addColorStop(0.25, '#1d1f26'); gr.addColorStop(0.7, '#050507'); gr.addColorStop(1, '#2a2c33');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = R * 0.04; g.beginPath(); g.arc(-R * 0.1, -R * 0.1, R * 0.78, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
    g.strokeStyle = 'rgba(255,23,68,0.55)'; g.lineWidth = R * 0.025; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3); g.lineTo(Math.cos(a + 0.15) * R * 0.92, Math.sin(a + 0.15) * R * 0.92); g.stroke(); }
    _blob(g, 0, 0, R * 0.55, d.gold ? '#ffd54f' : '#ff1744', 0.55); _blob(g, 0, 0, R * 0.3, d.gold ? '#fff8e1' : '#ff5252', 0.9); _blob(g, 0, 0, R * 0.14, '#ffffff', 1);
  },
});
Object.assign(SUP.deco, {
  nullrings(ctx, r, d, t, front) {        // floating geometric rings (pseudo-3D: back half behind the ball, front half in front)
    const n = d.rings || 1;
    for (let k = 0; k < n; k++) {
      const tilt = 0.32 + k * 0.22, rot = t * (0.7 + k * 0.35) * (k % 2 ? -1 : 1), R = r * (1.55 + k * 0.32), sides = [6, 3, 8][k];
      ctx.save(); ctx.rotate(k * 0.9 + t * 0.15); ctx.scale(1, tilt); ctx.lineWidth = Math.max(1.5, r * 0.05) / tilt * 0.6;
      ctx.strokeStyle = d.gold && k === n - 1 ? '#ffd54f' : k === 1 ? '#cfd8dc' : '#ff1744'; ctx.globalAlpha = front ? 0.95 : 0.4;
      ctx.beginPath(); for (let i = 0; i <= sides; i++) { const a = rot + i / sides * TAU, px = Math.cos(a) * R, py = Math.sin(a) * R; if ((py > 0) !== !!front && i) { ctx.moveTo(px, py); continue; } i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
      if (front) { ctx.fillStyle = '#ffffff'; for (let i = 0; i < sides; i++) { const a = rot + i / sides * TAU; if (Math.sin(a) > 0) { ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R, r * 0.05, 0, TAU); ctx.fill(); } } }
      ctx.restore();
    }
  },
  nullmotes(ctx, r, d, t, front) {        // dark energy particles circling the ball
    if (!front) return; ctx.save();
    for (let i = 0; i < 9; i++) { const a = t * (0.9 + (i % 3) * 0.3) + i * 0.7, R = r * (1.25 + (i % 4) * 0.12); ctx.globalAlpha = 0.75; ctx.fillStyle = i % 3 ? '#000000' : d.c2; ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R * 0.8, r * (0.05 + (i % 2) * 0.03), 0, TAU); ctx.fill(); }
    ctx.restore();
  },
  nulldistort(ctx, r, d, t, front) {      // space distortion around the ball (mastery 7)
    if (front) return; ctx.save(); ctx.strokeStyle = d.c2; ctx.globalAlpha = 0.25; ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, w = Math.sin(a * 6 + t * 4 + k) * r * 0.08; const R = r * (1.35 + k * 0.2) + w; i ? ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R) : ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); } ctx.stroke(); }
    ctx.restore();
  },
});
if (typeof SUP.projStyles === 'object') SUP.projStyles.a_override = (ctx, p) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = AX.CRIMSON; ctx.lineWidth = 3; const a = Math.atan2(p.vy, p.vx); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * (10 + i * 8), p.y - Math.sin(a) * (10 + i * 8) + (i - 1) * 4); ctx.lineTo(p.x, p.y); ctx.stroke(); } ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, TAU); ctx.fill(); ctx.restore(); };
/* idle (trail from mastery 2), victory (nova from mastery 8), defeat */
SUP.fx.anti = {
  idle(f) { if (antiLv(f) >= 2 && Math.random() < 0.5) FX.p(f.x - f.vx * 0.03 + (Math.random() - 0.5) * f.r, f.y - f.vy * 0.03 + (Math.random() - 0.5) * f.r, 0, 0, 0.5, 3 + Math.random() * 3, Math.random() < 0.5 ? '#000000' : AX.CRIMSON, 'dot', 0); },
  victory(f) {
    const big = antiLv(f) >= 8; antiSound('victory');
    vfx((ctx, q) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(big ? '#ffd54f' : AX.CRIMSON, 1 - q); ctx.lineWidth = 4; for (let i = 0; i < (big ? 5 : 3); i++) antiPoly(ctx, f.x, f.y, f.r * (1.5 + q * (4 + i * 1.5)), 3 + i, q * 3 * (i % 2 ? -1 : 1)); ctx.restore(); }, 1.6);
    FX.burst(f.x, f.y, AX.CRIMSON, big ? 90 : 50, 600, 6, 1.1, 'shard'); FX.text(f.x, f.y - f.r - 50, big ? 'NULL MONARCH' : 'NULLIFIED', big ? '#ffd54f' : AX.CRIMSON, 22, { life: 1.6, pop: 1.8, stroke: '#000000' });
  },
  defeat(f) { FX.burst(f.x, f.y, '#000000', 40, 300, 8, 0.9, 'smoke'); FX.burst(f.x, f.y, AX.CRIMSON, 24, 420, 5, 0.7, 'shard'); },
  bounce(f, wx, wy) { if (Math.random() < 0.5) FX.sparks(wx, wy, AX.CRIMSON, 5, 200); },
};

/* ---------------- 2.6.0 skill registry: the new kit is 9 unique abilities (no extra "new 2.6.0" ability for Anti Ball) ---------------- */
if (typeof NEW26 === 'object') delete NEW26.anti;
if (typeof TYPE_META === 'object') Object.assign(TYPE_META, {
  a_nullcore: { m: ['self-shell', 'halve-incoming-shots', 'status-decay'], tg: 'self', ac: 'instant', an: 'nullcore', cat: 'defense' },
  a_reject: { m: ['block-one-ability', 'armed-seal'], tg: 'self', ac: 'armed', an: 'rejectseal', cat: 'counter' },
  a_matrix: { m: ['pattern-analysis', 'learned-resist', 'auto-sidestep'], tg: 'self', ac: 'instant', an: 'matrix', cat: 'counter' },
  a_pulse: { m: ['proximity-trigger', 'knockback-pulse', 'charges'], tg: 'self', ac: 'armed', an: 'counterpulse', cat: 'counter' },
  a_mirror: { m: ['stationary-decoy', 'retarget-homing', 'side-blink'], tg: 'self', ac: 'instant', an: 'nullmirror', cat: 'mobility' },
  a_override: { m: ['cooldown-slowdown', 'dodgeable-bolt', 'override-immunity'], tg: 'aim', ac: 'charge', an: 'override', cat: 'counter' },
  a_resist: { m: ['repeat-decay', 'per-source-stacks'], tg: 'self', ac: 'instant', an: 'resist', cat: 'defense' },
});
if (typeof ULT_META === 'object') ULT_META.a_existence = ['domain', 'erase-projectiles', 'freeze-enemy-cooldowns', 'team-damage-cut', 'collapse-burst'];
if (typeof TECH_CAT === 'object') TECH_CAT.nullzone = TECH_CAT.nullzone || 'arena';
/* owner reward and mastery title (granted by the server only) */
if (typeof COSMETICS !== 'undefined' && !COSMETICS.some(c => c.id === 'title_nullbearer')) COSMETICS.push(
  { id: 'title_nullbearer', slot: 'title', name: 'NULL BEARER', color: '#ff1744', exclusive: 'anti' },
  { id: 'title_nullmonarch', slot: 'title', name: 'NULL MONARCH', color: '#ffd54f', exclusive: 'anti' });

if (window.NBB_CORE) Object.assign(window.NBB_CORE, { AX, ANTI_MASTERY, ANTI_MASTERY_PERKS, antiMasteryOf, antiDefFor, ANTI_DEF });
invalidateRegistry();
