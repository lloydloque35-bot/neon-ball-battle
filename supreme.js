/* =====================================================================
   NEON BALL BATTLE 2.1.0 — SUPREME ADMIN BALLS (owner-only expansion)

   Loaded after script.js in the browser AND on the game server, so every battle stays deterministic and verifiable.
   Battle logic only uses the seeded RNG (RNG / rand / dcos / dsin…); Math.random and vr() are for visuals only.

   Every Supreme ball has: 5 skills, an ultimate, a final-form ultimate, 3 forms (Base → Awakened → Final God form,
   reached in battle at 60% / 30% HP or with the 1st / 2nd ultimate), its own art, idle / bounce / victory / defeat
   effects and its own sound profile. Admin-only access is enforced by the server (adminOnly balls → owner only).
   ===================================================================== */
const GAME_VERSION = '2.9.0';
const FORM_MUL = [1, 1.18, 1.38];                 // stats & skill power per form
const FORM_MUL_GOD = [1, 1.08, 1.16];
const GOD_SKILL_K = [1.1, 0.88, 0.62];            // free God Balls: their forms change the abilities themselves, so the stat boost is smaller
const SUP = { forms: {}, skills: {}, ults: {}, fx: {}, roles: {}, MINION_MAX: 4,
  passives: {}, scoreFn: {}, dmgHooks: [], collideHooks: [], steerHooks: [], worldHooks: [], chipHooks: [], condCols: {}, godIds: [] };   // 2.2.0 extension points (gods.js)
const GOD_UNLOCK = [10, 20];                       // free God Balls: Awakened form from ball Lv 10, Final God Form from Lv 20
const godFormCap = lv => lv >= GOD_UNLOCK[1] ? 2 : lv >= GOD_UNLOCK[0] ? 1 : 0;
let SUP_FXK = 1;                                   // visual intensity of the current ball being drawn (admin panel)

/* ---------------- small shared helpers ---------------- */
const supTarget = (f, tgt) => (tgt && tgt.alive && !(tgt.st.outside > 0)) ? tgt : nearestEnemy(f);
const supEnemies = f => f.enemies().filter(e => !(e.st.outside > 0));
const sx = f => f.sx || (f.sx = {});
function supShot(f, x, y, ang, o) {                // a projectile from any point (owner f), with optional behaviour hooks
  const p = { owner: f, team: f.team, x, y, vx: dcos(ang) * o.speed, vy: dsin(ang) * o.speed, speed: o.speed, r: o.r || 9, dmg: o.dmg, col: o.col, effect: o.effect, power: o.power || 60,
    life: o.life || 2.6, homing: o.homing || 0, target: o.target || null, style: o.style || null, ult: o.ult ?? CUR_ULT };
  for (const k of ['tick', 'onHit', 'onEnd', 'bounce', 'pierce', 'boom', 'data']) if (o[k] != null) p[k] = o[k];
  BATTLE.projs.push(p); return p;
}
function supWave(f, x, y, maxR, dmg, col, o = {}) {
  const w = { owner: f, team: f.team, x, y, r: o.r0 || 10, maxR, speed: o.speed || 760, w: o.w || 18, dmg, col, effect: o.effect || 'none', power: o.power || 60, hit: new Set(), force: o.force ?? 420, style: o.style || null };
  if (o.onHit) w.onHit = o.onHit;
  BATTLE.waves.push(w); return w;
}
function supStrike(f, x, y, delay, r, dmg, col, o = {}) {
  BATTLE.strikes.push({ kind: o.kind || 'lightning', owner: f, team: f.team, x: inArenaX(x, 20), y: inArenaY(y, 20), t: delay, max: delay, r, dmg, col, effect: o.effect || 'none', power: o.power || 60 });
}
function supZone(f, z) { const o = { owner: f, team: f.team, ticks: new Map(), power: 60, ...z }; o.max = o.max || o.life; BATTLE.zones.push(o); return o; }
/** hits every enemy within r of (x, y) once */
function supBlast(f, x, y, r, dmg, o = {}) {
  let n = 0;
  for (const e of supEnemies(f)) { const d = len(e.x - x, e.y - y); if (d < r + e.r) { dealDamage(f, e, dmg * (o.flat ? 1 : 1 - 0.3 * clamp(d / r, 0, 1)), { kind: 'skill', tag: o.tag || 'explosion', effect: o.effect, power: o.power || 60, noCrit: o.noCrit }); if (o.force) knock(e, x, y, o.force); n++; } }
  return n;
}
/* visual-only layer: big cinematic shapes (giant skull, gates, moons, wings, clocks…) */
/** 2.4.0 "Cinematic effects" setting: full | reduced | minimal (minimal keeps only gameplay warnings: vfx(..., { keep: true })) */
const cineLevel = () => (typeof SAVE !== 'undefined' && SAVE && SAVE.settings && SAVE.settings.cinematic) || 'full';
function vfx(draw, life, o = {}) { if (FX.off || !BATTLE) return; if (!o.keep && cineLevel() === 'minimal') return; (BATTLE.vfx || (BATTLE.vfx = [])).push({ draw, life, t: 0, ...o }); }
function camPunch(x, y, k = 0.14, dur = 0.7) { if (FX.off || !BATTLE) return; BATTLE.cam = { x, y, k, t: 0, dur }; }
function darkArena(t, col = '#000000', a = 0.6) { const c = cineLevel(); if (!FX.off && BATTLE && c !== 'minimal') BATTLE.darkFx = { t, max: t, col, a: c === 'reduced' ? a * 0.6 : a }; }
function supSay(f, txt, col, size = 16) { if (!FX.off) FX.text(f.x, f.y - f.r - 30, txt, col, size, { life: 1.1 }); }

/* ---------------- forms ---------------- */
function formDef(base, k, variant) {
  k = k | 0; if (!k && !variant) return base;
  const fm = base.forms[k] || {}, vs = variant && base.states && base.states[variant] ? (base.states[variant][k] || {}) : null;
  const cache = SUP.forms[base.id] || (SUP.forms[base.id] = {}), key = k + '|' + (variant || '') + '|' + (base.tuning ? JSON.stringify(base.tuning) : '');
  if (!cache[key]) cache[key] = { ...base, design: { ...base.design, ...(fm.design || {}), ...(vs || {}) }, formIndex: k, formName: fm.name || base.forms[0].name, variant: variant || null };
  return cache[key];
}
/** called at the end of the Fighter constructor for Supreme balls */
function supremeInit(f, o) {
  f.baseDef = f.def; f.form = 0; f.fm = 1; f.ults = 0; f.sx = {}; f.hist = []; f.r0 = f.r;
  const tn = f.def.tuning || {};
  if (f.skills && f.skills.length) {
    const mul = clamp(+tn.cdMul || 1, 0.2, 3), off = Array.isArray(tn.off) ? tn.off : [];
    f.skills.forEach((s, i) => { s.cd = Math.max(0.5, (s.cd || 6) * mul); if (off.includes(i)) { s.locked = true; s.disabled = true; } });
  }
  // free God Balls unlock their forms with the ball's level; owner / practice test battles can use every form
  const testB = !!(BATTLE && BATTLE.cfg && (BATTLE.cfg.godTest || BATTLE.cfg.adminTest)), fl = f.def.formLevels;
  f.formCap = testB ? 2 : fl ? (f.level >= fl[1] ? 2 : f.level >= fl[0] ? 1 : 0)      // 2.4.0 God of Absolute: forms unlock with its own level (Lv 70 / Lv 100)
    : f.def.godBall && !f.def.paid ? godFormCap(f.level) : 2;                           // free God Balls: Lv 10 / 20; bought Premium God Balls: every form at once
  if (f.def.godBall) f.ultCharge *= f.def.ultChargeMul || 0.7;            // free God Balls: ultimates charge a little slower (they also transform with them)
  const pv = SUP.passives[f.def.id]; if (pv && !f.isClone) { f.sx.passive = pv.tick; if (pv.init) pv.init(f); }
  // start form: a test battle's choice, else the owner's setting for Supreme admin balls (Admin Ball Control Panel, 2.4.2)
  const sf = o.startForm != null ? o.startForm | 0 : (f.def.adminOnly ? (+tn.startForm | 0) : 0);
  if (sf > 0 && !f.isClone) applyForm(f, clamp(sf, 0, f.formCap), true);
}
function applyForm(f, k, silent) {
  f.form = k; f.fm = (f.baseDef.formMul || (f.baseDef.godBall ? FORM_MUL_GOD : FORM_MUL))[k]; f.def = formDef(f.baseDef, k, f.sx && f.sx.variant);
  f.ult = k >= 2 && f.baseDef.finalUlt ? f.baseDef.finalUlt : f.baseDef.ult;
  f.r = (f.r0 || f.r) * (k === 2 ? 1.06 : 1);
  if (!silent) { f.godUsed = true; }
}
function startForm(f, k, then) {
  if (!BATTLE || BATTLE.cinematic || f.form >= k || !f.alive) { if (then) then(); return; }
  f.form = k;      // reserve: no double trigger while the cinematic runs
  BATTLE.cinematic = { f, t: 0, dur: k === 2 ? 2.0 : 1.4, form: k, then: then || (() => {}) };
  if (!FX.off) { Sound.play('god'); supSound(f, 'transform'); FX.addFlash(0.18, f.baseDef.forms[k].design?.c3 || '#ffffff'); camPunch(f.x, f.y, 0.22, 1.8); }
}
function finishForm(f, k) {
  applyForm(f, k);
  const fm = f.baseDef.forms[k], d = f.def.design;
  healFighter(f, f.maxHp * (f.baseDef.godBall ? (k === 2 ? 0.05 : 0.03) : (k === 2 ? 0.15 : 0.1))); f.st.invuln = Math.max(f.st.invuln, f.baseDef.godBall ? 0.6 : 1); f.st.stun = f.st.freeze = f.st.timestop = 0;
  for (const e of f.enemies()) knock(e, f.x, f.y, k === 2 ? 900 : 600);
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.y + 70, k === 2 ? 'FINAL GOD FORM' : 'AWAKENED', k === 2 ? '#ffd54f' : d.c3, 44, { life: 1.9, vy: 0, pop: 2, stroke: '#14001f' });
    FX.text(ARENA.cx, ARENA.y + 118, fm.name, d.c2, 26, { life: 1.9, vy: 0 });
    for (let i = 0; i < (k === 2 ? 7 : 4); i++) FX.ring(f.x, f.y, i % 2 ? '#ffffff' : d.c3, 160 + i * 90, 0.6 + i * 0.12, 14 - i, f.r);
    FX.burst(f.x, f.y, d.c3, k === 2 ? 110 : 70, 760, 8, 1.2); FX.burst(f.x, f.y, d.c2, 40, 520, 7, 1.0, 'shard'); FX.addShake(k === 2 ? 20 : 13); FX.addFlash(0.3, d.c3);
    if (k === 2) {       // special battlefield entrance of the final form
      darkArena(1.6, '#000000', 0.55);
      vfx((ctx, q) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const x = ARENA.x + ARENA.w * (i + 0.5) / 6, a = (1 - q) * 0.5; const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0); g.addColorStop(0, rgba(d.c3, 0)); g.addColorStop(0.5, rgba(d.c2, a)); g.addColorStop(1, rgba(d.c3, 0)); ctx.fillStyle = g; ctx.fillRect(x - 40, ARENA.y, 80, ARENA.h); } ctx.restore(); }, 1.4);
      (SUP.fx[f.baseDef.id] || {}).entrance?.(f);
    }
  }
}
function supremeTick(f, dt) {
  const s = f.sx;
  for (const k in s) if (typeof s[k] === 'number' && k.endsWith('T') && s[k] > 0) s[k] = Math.max(0, s[k] - dt);
  if (!f.baseDef || f.isClone || !f.alive || !BATTLE) return;      // the rest is for Supreme balls only
  // history for Time Rewind / Temporal Clone (sampled every 0.1 s)
  if ((f.histT = (f.histT || 0) - dt) <= 0) { f.histT = 0.1; f.hist.push({ x: f.x, y: f.y, hp: f.hp }); if (f.hist.length > 40) f.hist.shift(); }
  const cap = f.formCap ?? 2;
  // HP-based transformations (admin Supreme balls: 60% / 30%; free God Balls only awaken at 50% HP — their Final God Form needs the 2nd ultimate)
  if (f.baseDef.forms && !BATTLE.cinematic && !f.clashLock) { if (f.form === 0 && f.hpRatio <= (f.baseDef.godBall ? 0.5 : 0.6) && cap >= 1) startForm(f, 1); else if (f.form === 1 && f.hpRatio <= 0.3 && cap >= 2 && !f.baseDef.godBall) startForm(f, 2); }
  f.pAtk = 1; f.pSpd = 1; f.pCd = 1;                // passives / stances set these every tick
  if (!FX.off) { const fx = SUP.fx[f.baseDef.id]; if (fx && fx.idle && Math.random() < 0.6 * clamp((f.baseDef.tuning && +f.baseDef.tuning.fx) || 1, 0.2, 1.5)) fx.idle(f, f.def.design); }
  if (s.passive) s.passive(f, dt);
}
/* ultimates: 1st use awakens the ball, 2nd use reaches the final god form (then the final-form ultimate) */
function supremeUlt(f) {
  const B = BATTLE;
  // GOD CLASH: against an enemy God Ball the ultimate charges for a moment; if the enemy fires its own ultimate meanwhile, the two clash
  if (!f.isClone && !B.clash && B.fighters.some(x => x.alive && x.team !== f.team && !x.isClone && x.baseDef && x.baseDef.forms)) {
    const rival = (B.godCharge || []).find(c => c.f.team !== f.team && c.f.alive);
    if (rival) { B.godCharge = B.godCharge.filter(c => c !== rival); return startClash(rival.f, f); }
    (B.godCharge || (B.godCharge = [])).push({ f, t: CLASH.WINDOW });
    if (!FX.off) { FX.ring(f.x, f.y, f.def.design.c3, f.r * 3, CLASH.WINDOW, 6, f.r * 1.2); FX.text(f.x, f.y - f.r - 34, 'CHARGING ULTIMATE', f.def.design.c2, 14, { life: 0.5 }); }
    return;
  }
  releaseUlt(f);
}
/** the ultimate itself: 1st use awakens the ball, 2nd use reaches the Final God Form (if unlocked), then the final-form ultimate */
function releaseUlt(f) {
  f.ults++;
  const go = () => performUlt(f), cap = f.formCap ?? 2;
  if (f.st.antievo > 0) return go();              // Anti Evolution blocks transformations
  if (f.form === 0 && cap >= 1) return startForm(f, 1, go);
  if (f.form === 1 && f.ults >= 2 && cap >= 2) return startForm(f, 2, go);
  go();
}
/* ---------------- GOD CLASH ----------------
   Two God Balls firing ultimates within 0.4 s of each other lock together. The winner is decided by the battle state
   (ultimate power × attack × form × remaining HP, with a ±12% seeded swing): no ball is favoured. */
const CLASH = { WINDOW: 0.4, DUR: 1.6 };
function clashPower(f) { const u = f.ult || {}; return (u.power || 100) * f.effAtk() * (0.55 + 0.45 * clamp(f.hpRatio, 0, 1)) * (1 + 0.1 * f.form) * (0.88 + RNG() * 0.24); }
function startClash(a, b) {
  const B = BATTLE, pa = clashPower(a), pb = clashPower(b);
  const c = B.clash = { a, b, t: 0, dur: CLASH.DUR, pa, pb, m: (pa - pb) / (pa + pb), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ax: a.x, ay: a.y, bx: b.x, by: b.y };
  for (const f of [a, b]) { f.clashLock = true; f.st.invuln = Math.max(f.st.invuln, c.dur + 0.2); f.casting = Math.max(f.casting, c.dur); f.vx = f.vy = 0; }
  if (!FX.off) {
    camPunch(c.x, c.y, 0.22, c.dur); darkArena(c.dur, '#000010', 0.45); FX.addFlash(0.3, '#ffffff'); FX.addShake(12); Sound.play('god');
    FX.text(ARENA.cx, ARENA.y + 70, '⚡ GOD CLASH ⚡', '#ffffff', 50, { life: c.dur, vy: 0, pop: 2, stroke: '#2a0040' });
    FX.text(ARENA.cx, ARENA.y + 118, `${a.def.name.replace(/ Ball$/, '')}  ${a.ult.name}   VS   ${b.ult.name}  ${b.def.name.replace(/ Ball$/, '')}`, '#ffd54f', 18, { life: c.dur, vy: 0 });
    vfx((ctx, q) => vClash(ctx, c, q), c.dur);
  }
}
function clashStep(B, h) {
  const c = B.clash; c.t += h;
  for (const [f, x, y] of [[c.a, c.ax, c.ay], [c.b, c.bx, c.by]]) if (f.alive) { f.x = x; f.y = y; f.vx = f.vy = 0; }
  if (c.t >= c.dur || !c.a.alive || !c.b.alive) resolveClash(B, c);
}
function resolveClash(B, c) {
  B.clash = null;
  for (const f of [c.a, c.b]) { f.clashLock = false; f.casting = 0; f.st.invuln = Math.min(f.st.invuln, 0.25); }
  const live = [c.a, c.b].filter(f => f.alive);
  if (live.length < 2) { for (const f of live) releaseUlt(f); return; }
  if (!FX.off) { FX.addFlash(0.4, '#ffffff'); FX.addShake(22); for (let i = 0; i < 5; i++) FX.ring(c.x, c.y, i % 2 ? '#ffffff' : '#ffd54f', 260 + i * 140, 0.7, 14, 30); FX.burst(c.x, c.y, '#ffffff', 80, 900, 8, 1.1); Sound.play('boom'); }
  for (const e of B.fighters) if (e.alive && e !== c.a && e !== c.b && !(e.st.outside > 0)) knock(e, c.x, c.y, 500);
  if (Math.abs(c.m) < 0.04) {      // a perfect draw: both ultimates cancel out
    for (const [x, y] of [[c.a, c.b], [c.b, c.a]]) { y.st.invuln = 0; dealDamage(x, y, skillDmg(x, 80) * 0.5, { kind: 'skill', tag: 'explosion', power: 80 }); knock(y, c.x, c.y, 900); y.ultMeter = Math.max(y.ultMeter, 50); }
    if (!FX.off) FX.text(ARENA.cx, ARENA.cy - 30, 'DRAW — THE POWERS CANCEL OUT', '#ffffff', 34, { life: 1.6, vy: 0, pop: 2 });
    return;
  }
  const w = c.m > 0 ? c.a : c.b, l = w === c.a ? c.b : c.a;
  l.st.invuln = 0; w.clashWins = (w.clashWins || 0) + 1;
  dealDamage(w, l, skillDmg(w, (w.ult && w.ult.power) || 100) * (0.45 + Math.abs(c.m) * 2.5), { kind: 'skill', tag: 'explosion', power: 80 });
  knock(l, w.x, w.y, 1100); l.st.stun = Math.max(l.st.stun, 0.7); l.ultMeter = Math.max(l.ultMeter, 35);
  if (!FX.off) FX.text(ARENA.cx, ARENA.cy - 30, 'CLASH WON: ' + w.def.name.replace(/ Ball$/, '').toUpperCase(), w.def.design.c2, 36, { life: 1.6, vy: 0, pop: 2, stroke: '#000' });
  releaseUlt(w);
}
/* per-ball skill power tweaks (curse, form) — called from useSkill */
function supSkillPower(f, sk, P) {
  if (f.fm > 1 && !(f.st.antievo > 0)) P *= 1 + (f.fm - 1) * 0.5;   // (attack already rises with the form)
  if (f.baseDef && f.baseDef.godBall) P *= (f.baseDef.skillK || GOD_SKILL_K)[f.form] || 1;   // free God Balls: richer ability versions hit more often, so each hit is lighter
  const s = f.sx;
  if (s && s.curseT > 0) { P *= 0.65; if (BATTLE) dealDamage(s.curseBy || null, f, f.maxHp * 0.03, { kind: 'dot', noCrit: true, noDef: true }); }
  if (s && s.energyT > 0) P *= 1.15;
  return P;
}

/* ---------------- damage, collision, steering, step hooks ---------------- */
function supDamageHook(src, tgt, amt, o) {
  const s = tgt.sx;
  if (s) {
    if (s.dodgeT > 0 && s.dodges > 0 && o.kind === 'skill') {            // Time God: Future Prediction
      s.dodges--; const a = rand(TAU); tgt.x = inArenaX(tgt.x + dcos(a) * 90, tgt.r); tgt.y = inArenaY(tgt.y + dsin(a) * 90, tgt.r);
      if (!FX.off) { FX.text(tgt.x, tgt.y - tgt.r - 20, 'FORESEEN', '#ffd740', 14, { life: 0.6 }); FX.ring(tgt.x, tgt.y, '#40c4ff', 60, 0.3, 4, 10); }
      return 0;
    }
    if (s.counterT > 0 && o.kind === 'skill' && src && src.alive && src.team !== tgt.team) {   // Mirror: Attack Reflection
      s.counterT = 0; dealDamage(tgt, src, amt * 1.5, { kind: 'skill', tag: 'mirror', noCrit: true });
      if (!FX.off) { FX.bolt(tgt.x, tgt.y, src.x, src.y, '#e1f5fe', 4, 0.35); FX.text(tgt.x, tgt.y - tgt.r - 24, 'REFLECTED ×1.5', '#e1f5fe', 15); }
      return 0;
    }
    if (s.infShieldT > 0 && o.kind !== 'dot') { s.stored = (s.stored || 0) + amt * 0.3; amt *= 0.4; }
    if (s.scalesT > 0 && o.kind === 'collision' && src && src.alive) dealDamage(tgt, src, amt * 0.25, { kind: 'skill', tag: 'collision', noCrit: true, noDef: true });
    if (s.voidArmor > 0 && o.kind !== 'dot') { const take = Math.min(s.voidArmor, amt * 0.7); s.voidArmor -= take; s.voidStored = (s.voidStored || 0) + take; amt -= take; }
  }
  const ss = src && src.sx;
  if (ss && ss.bloodAuraT > 0 && src.alive) healFighter(src, amt * 0.25, true);
  if (ss && ss.predictT > 0 && o.kind === 'skill') amt *= 1.35;
  const ts = tgt.sx;
  for (const fn of SUP.dmgHooks) { amt = fn(src, tgt, amt, o); if (!(amt > 0)) return 0; }
  if (ts && ts.hemoN > 0 && o.kind !== 'dot' && src) { ts.hemoN--; if (BATTLE) after(0.05, () => { if (tgt.alive) { dealDamage(ts.hemoBy, tgt, tgt.maxHp * 0.025, { kind: 'dot', noCrit: true, noDef: true }); if (!FX.off) FX.burst(tgt.x, tgt.y, '#d50000', 10, 180, 4, 0.4); } }); }
  return amt;
}
function supCollide(a, b) {
  const s = a.sx; if (!s || !b.alive || a.team === b.team) return;
  if (s.overcharge > 0) {          // Thunder God: Overcharge
    s.overcharge--;
    for (const e of supEnemies(a).slice(0, 3)) { dealDamage(a, e, skillDmg(a, 60) * 0.35, { kind: 'skill', tag: 'strike', effect: 'stun', power: 60 }); if (!FX.off) FX.bolt(a.x, a.y, e.x, e.y, '#ffee58', 4, 0.3); }
  }
  for (const fn of SUP.collideHooks) fn(a, b);
}
function supSteer(f) {
  const c = BATTLE && BATTLE.cond;
  if (c && c.kind === 'shift' && c.team !== f.team && !f.isClone) { f.steerX = -f.steerX; f.steerY = -f.steerY; }
  for (const fn of SUP.steerHooks) fn(f);
  if (f.sx && f.sx.blindT > 0 && !f.isClone) { const a = BATTLE.time * 2.3 + f.sid * 1.7; f.steerX = dcos(a); f.steerY = dsin(a); f.steerPow = Math.max(f.steerPow, 500); }   // Eclipse: wanders blind
}
/** after movement & collisions each step: chains, portals, timed conditions, lag zones */
function supremeStep(B, h) {
  if (B.godCharge && B.godCharge.length) for (const c of B.godCharge.slice()) { c.t -= h; if (c.t <= 0 || !c.f.alive) { B.godCharge.splice(B.godCharge.indexOf(c), 1); if (c.f.alive) releaseUlt(c.f); } }
  if (B.clash) clashStep(B, h);
  supWorld(B, h);
  for (const fn of SUP.worldHooks) fn(B, h);
  for (const f of B.fighters) {
    if (!f.alive || !f.sx) continue;
    const s = f.sx;
    if (s.leashT > 0 && s.leash) {      // Soul Chains: cannot leave the anchor circle
      const L = s.leash, dx = f.x - L.x, dy = f.y - L.y, d = len(dx, dy);
      if (d > L.r) { f.x = L.x + dx / d * L.r; f.y = L.y + dy / d * L.r; const vn = (f.vx * dx + f.vy * dy) / d; if (vn > 0) { f.vx -= dx / d * vn; f.vy -= dy / d * vn; } }
      if ((s.leashTick = (s.leashTick || 0) - h) <= 0) { s.leashTick = 0.5; dealDamage(L.by, f, L.dmg, { kind: 'skill', tag: 'zone', noCrit: true }); }
    }
    if (s.pullT > 0 && s.pullTo && s.pullTo.alive) { const p = s.pullTo, a = datan2(p.y - f.y, p.x - f.x); f.vx += dcos(a) * 2400 * h; f.vy += dsin(a) * 2400 * h; }
    if (s.lagT > 0) { if ((s.lagStep = (s.lagStep || 0) - h) > 0) { f.x -= f.vx * h * 0.85; f.y -= f.vy * h * 0.85; } else s.lagStep = 0.35; }
  }
  if (B.portalPairs && B.portalPairs.length) {     // Reality Controller: Void Portal
    for (let i = B.portalPairs.length - 1; i >= 0; i--) {
      const P = B.portalPairs[i]; P.t -= h; if (P.t <= 0) { B.portalPairs.splice(i, 1); continue; }
      for (const f of B.fighters) {
        if (!f.alive || f.anchored || f.tether || f.st.outside > 0 || (f.portalCd || 0) > B.time || (f.dim || 0) !== (P.dim || 0)) continue;
        for (const [ax, ay, bx, by] of [[P.ax, P.ay, P.bx, P.by], [P.bx, P.by, P.ax, P.ay]]) if (len(f.x - ax, f.y - ay) < P.r) {
          const sp = len(f.vx, f.vy) || 1; f.x = inArenaX(bx + f.vx / sp * (P.r + f.r + 4), f.r); f.y = inArenaY(by + f.vy / sp * (P.r + f.r + 4), f.r); f.portalCd = B.time + 0.7;
          if (!FX.off) { FX.ring(bx, by, P.col2, P.r * 1.8, 0.3, 5, P.r); Sound.play('portal'); } break;
        }
      }
    }
  }
  const c = B.cond;
  if (c) {
    c.t -= h; if (c.t <= 0) { B.cond = null; if (!FX.off) FX.text(ARENA.cx, ARENA.y + 60, 'ARENA RESTORED', '#ffffff', 22, { life: 1, vy: 0 }); }
    else {
      c.tick = (c.tick || 0) - h;
      for (const e of B.fighters) {
        if (!e.alive || e.team === c.team || e.st.outside > 0) continue;
        if (c.kind === 'frozen') { e.st.slow = Math.max(e.st.slow, 0.3); }
        if (c.kind === 'inferno' && c.tick <= 0) dealDamage(c.by, e, e.maxHp * 0.02, { kind: 'dot', noCrit: true, noDef: true });
      }
      if (c.kind === 'storm' && c.tick <= 0 && c.by && c.by.alive) { const es = supEnemies(c.by); if (es.length) { const e = es[(B.stepN >> 4) % es.length]; supStrike(c.by, e.x, e.y, 0.4, 70, skillDmg(c.by, 60) * 0.3, '#ffee58'); } }
      if (c.tick <= 0) c.tick = c.kind === 'storm' ? 1.1 : 0.5;
    }
  }
}

/** moving fields, tracking lasers, mirror twins, packet loss, time-slow bubbles */
function supWorld(B, h) {
  for (const z of B.zones) {
    if (z.drift && z.drift.tgt && z.drift.tgt.alive) { const t = z.drift.tgt, d = len(t.x - z.x, t.y - z.y) || 1, s = Math.min(d, z.drift.sp * h); z.x += (t.x - z.x) / d * s; z.y += (t.y - z.y) / d * s; }
    if (z.domeOf) for (let k = B.projs.length - 1; k >= 0; k--) { const p = B.projs[k]; if (p.team !== z.team && dist2(p.x, p.y, z.x, z.y) < z.r * z.r) { B.projs.splice(k, 1); healFighter(z.domeOf, z.domeOf.maxHp * 0.012, true); if (!FX.off) FX.burst(p.x, p.y, '#ffd54f', 8, 200, 4, 0.3); } }
    if (z.slowField) for (const p of B.projs) if (p.team !== z.team && !p.slowed && dist2(p.x, p.y, z.x, z.y) < z.r * z.r) { p.slowed = true; p.vx *= 0.35; p.vy *= 0.35; p.speed *= 0.35; }
  }
  for (const L of B.lasers) {
    if (L.track && L.track.tgt.alive) { const s = clamp(L.track.tgt.x - L.x0, -L.track.sp * h, L.track.sp * h); L.x0 += s; L.x1 += s; }
    if (L.sweepX) { L.x0 = clamp(L.x0 + L.sweepX.v * h, ARENA.x, ARENA.r); L.x1 = L.x0; }
    if (L.clock) { const c = L.clock, a = c.a0 + c.av * L.t; L.x0 = c.f.x; L.y0 = c.f.y; L.x1 = c.f.x + dcos(a) * c.len; L.y1 = c.f.y + dsin(a) * c.len; }
    if (L.aim) {
      const A = L.aim, f = A.f; if (A.ang == null) A.ang = datan2(L.y1 - L.y0, L.x1 - L.x0);
      if (A.tgt && A.tgt.alive) { const want = datan2(A.tgt.y - f.y, A.tgt.x - f.x), da = ((want - A.ang + Math.PI * 3) % TAU) - Math.PI; A.ang += clamp(da, -A.turn * h, A.turn * h); }
      if (A.sweep) A.off = (A.off || 0) + A.sweep * h;
      const end = rayToWall(f.x, f.y, A.ang + (A.off || 0)); L.x0 = f.x; L.y0 = f.y; L.x1 = end.x; L.y1 = end.y; L.w = A.w0 + (A.w1 - A.w0) * clamp((L.t - L.charge) / L.dur, 0, 1);
    }
  }
  for (const m of B.fighters) if (m.mirrorOf && m.alive && m.mirrorOf.alive) { const o = m.mirrorOf; m.x = inArenaX(2 * ARENA.cx - o.x, m.r); m.y = inArenaY(2 * ARENA.cy - o.y, m.r); m.vx = -o.vx; m.vy = -o.vy; }
  for (const f of B.fighters) if (f.alive && f.sx && f.sx.packetT > 0) for (let k = B.projs.length - 1; k >= 0; k--) {     // Packet Loss
    const p = B.projs[k]; if (p.team === f.team || p.pl || dist2(p.x, p.y, f.x, f.y) > 220 * 220) continue;
    p.pl = true; if (RNG() < 0.5) { B.projs.splice(k, 1); if (!FX.off) { FX.burst(p.x, p.y, '#00ff41', 8, 200, 4, 0.3, 'shard'); FX.text(p.x, p.y - 14, 'PACKET LOST', '#00ff41', 12, { life: 0.5 }); } }
  }
}

/* ---------------- death & victory ---------------- */
function supPreventDeath(f) {
  const s = f.sx;
  if (s && s.rebirthT > 0 && !s.reborn) {          // Phoenix God: Rebirth
    s.reborn = true; s.rebirthT = 0; f.hp = f.maxHp * 0.4; f.alive = true; f.st.invuln = 1.5;
    if (!FX.off) { FX.text(f.x, f.y - f.r - 34, 'REBIRTH!', '#ffea00', 32, { life: 1.6, pop: 2 }); FX.burst(f.x, f.y, '#ff9100', 70, 520, 7, 1.1); for (let i = 0; i < 3; i++) FX.ring(f.x, f.y, i ? '#ff6d00' : '#ffffff', 200 + i * 80, 0.6, 10, f.r); Sound.play('heal'); supSound(f, 'ult'); }
    supBlast(f, f.x, f.y, 220, skillDmg(f, 80) * 0.6, { effect: 'burn', force: 600 });
    return true;
  }
  return false;
}
function supremeDefeat(f) { const fx = SUP.fx[f.baseDef ? f.baseDef.id : f.def.id]; if (fx && fx.defeat) fx.defeat(f, f.def.design); supSound(f, 'defeat'); }
function supremeVictory(f) { const fx = SUP.fx[f.baseDef ? f.baseDef.id : f.def.id]; if (fx && fx.victory && !FX.off) fx.victory(f, f.def.design); supSound(f, 'victory'); }
function supBounce(f, wx, wy) { if (FX.off) return; const fx = SUP.fx[f.baseDef ? f.baseDef.id : f.def.id]; if (fx && fx.bounce) fx.bounce(f, wx, wy, f.def.design); }

/* ---------------- sounds: one synth profile per ball ---------------- */
function supSound(f, kind, i = 0) { if (FX.off || !Sound.ctx) return; const pr = (f.baseDef || f.def).sound; if (pr) Sound.supPlay(pr, kind, i); }
Object.assign(Sound, {
  supLast: {},
  supPlay(pr, kind, i = 0) {
    if (!this.ctx || SAVE.settings.sfx <= 0) return;
    const key = pr.base + kind + i, tn = performance.now(); if (this.supLast[key] && tn - this.supLast[key] < 90) return; this.supLast[key] = tn;
    const b = pr.base * (1 + (i % 5) * 0.12), w = pr.wave, n = pr.noise;
    switch (kind) {
      case 'skill': this.tone(b * 2, 0.22, w, 0.08, pr.slide); this.tone(b * 3, 0.16, 'sine', 0.06, 1.5, 0.04); if (n) this.noiseHit(0.2, 0.12, n * (1 + i * 0.2), 1.2); break;
      case 'ult': [1, 1.25, 1.5, 2, 2.5].forEach((m, k) => this.tone(b * m, 0.9, w, 0.07, 1, k * 0.08)); this.tone(b / 2, 1.2, 'sawtooth', 0.18, 0.6); this.noiseHit(0.9, 0.3, n || 600, 0.6); break;
      case 'transform': [1, 1.5, 2, 3, 4].forEach((m, k) => this.tone(b * m, 0.6, w, 0.07, 1.02, k * 0.1)); this.noiseHit(1.2, 0.25, n || 900, 0.5); this.tone(b / 4, 1.4, 'sine', 0.3, 0.5); break;
      case 'victory': [1, 1.26, 1.5, 2].forEach((m, k) => this.tone(b * 2 * m, 0.45, w, 0.09, 1, k * 0.13)); break;
      case 'defeat': [2, 1.6, 1.25, 1].forEach((m, k) => this.tone(b * m, 0.5, w, 0.09, 0.8, k * 0.15)); this.noiseHit(0.8, 0.2, n || 400, 0.6); break;
    }
  },
});

/* ---------------- AI: how good is each Supreme skill right now ---------------- */
function supScore(ai, s, c) {
  if (SUP.scoreFn[s.type]) return SUP.scoreFn[s.type](ai, s, c);
  const role = SUP.roles[s.type]; if (!role) return undefined;
  const f = ai.f, d = c.d, t = c.t;
  switch (role) {
    case 'ranged': return 0.62 + (d > 180 ? 0.18 : 0) - (c.t.st.invuln > 0.3 ? 0.5 : 0);
    case 'aoe': return d < 300 ? 0.9 : 0.25;
    case 'melee': return d < 220 ? 0.85 : d < 420 ? 0.5 : 0.2;
    case 'control': return 0.7 + (t.god > 0 || t.form > 0 ? 0.15 : 0);
    case 'summon': return supMinions(f) < SUP.MINION_MAX ? 0.85 : 0;
    case 'defense': return c.th ? 1.05 : c.myR < 0.6 ? 0.7 : 0.35;
    case 'heal': return c.myR < 0.7 ? 1.0 - c.myR * 0.4 : 0;
    case 'mobility': return c.th ? 0.95 : d > 380 ? 0.6 : c.myR < 0.3 ? 0.8 : 0.3;
    case 'buff': return d < 360 ? 0.75 : 0.45;
    case 'curse': return t.sx && t.sx.curseT > 0 ? 0 : 0.72;
  }
  return 0.5;
}
const supMinions = f => BATTLE ? BATTLE.fighters.filter(x => x.alive && x.owner === f && x.minion).length : 0;
/* a summoned helper that looks like a ball and fights for its master */
function supMinion(f, def, x, y, o = {}) {
  if (!f.alive || supMinions(f) >= (o.cap || SUP.MINION_MAX)) return null;
  const u = spawnUnit(f, 'minion', x, y, { def, force: true, P: o.P || 70, life: o.life || 8, hp: o.hp || 0.1, statMul: o.statMul || 0.7, rScale: o.rScale || 0.55, build: 0.3 });
  if (!u) return null;
  u.minion = true; u.ballLook = true; u.mech = false;
  if (o.shot) u.mshot = o.shot;
  if (o.onDeath) u.minionDeath = o.onDeath;
  return u;
}

/* ---------------- ADMIN DELETE: owner commands, validated inside the engine ----------------
   An input ['x', cmd, sidTarget, a, b] is applied only while the commander's ADMIN DELETE window is open
   (opened by the ultimate, max 4 commands), so replays on the server reach exactly the same result. */
const ADMIN_CMDS = { delete: 1, restore: 2, transform: 3, prop: 4, arena: 5, setting: 6, testForm: 9, testUlt: 10, testCd: 11 };
const ARENA_CONDS = ['normal', 'frozen', 'inferno', 'storm', 'shift'];
const PROP_KEYS = ['hp', 'size', 'speed', 'attack'];
function supremeCommand(pl, a) {
  if (!pl || !BATTLE) return;
  const [cmd, sid, v1, v2] = a.map(x => x | 0), B = BATTLE;
  if (cmd >= 9) {                       // owner test controls (only in owner test battles)
    if (!(B.cfg.adminTest && pl.def.adminOnly) && !(B.cfg.godTest && pl.baseDef && pl.baseDef.godBall)) return;   // owner tests / free God Ball practice tests
    if (cmd === 9 && pl.baseDef && pl.baseDef.forms) { const k = clamp(v1, 0, 2); if (k > pl.form) startForm(pl, k); else if (k < pl.form) applyForm(pl, k); }
    if (cmd === 10) pl.ultMeter = 100;
    if (cmd === 11) for (const s of pl.allSkills()) s.cdLeft = 0;
    return;
  }
  const s = pl.sx; if (!s || !(s.adminT > 0) || !(s.adminLeft > 0) || !pl.alive) return;
  s.adminLeft--;
  const tgt = B.fighters.find(x => x.sid === sid);
  const say = (t, c = '#00e5ff') => { if (!FX.off) FX.text(ARENA.cx, ARENA.y + 96, t, c, 22, { life: 1.5, vy: 0 }); };
  switch (cmd) {
    case 1: if (tgt && tgt.alive && tgt !== pl) {
      (B.deleted || (B.deleted = [])).push(tgt);
      if (!FX.off) { FX.burst(tgt.x, tgt.y, '#00e5ff', 40, 420, 6, 0.8, 'shard'); FX.ring(tgt.x, tgt.y, '#ffffff', 160, 0.4, 6, tgt.r); vfx((ctx, q) => supDrawSelect(ctx, tgt.x, tgt.y, tgt.r * (1 + q), '#ff1744', 'DELETED', 1 - q), 0.8); }
      tgt.alive = false; tgt.deletedAt = B.time; B.fighters = B.fighters.filter(x => x !== tgt && !(x.owner === tgt));
      say('ADMIN: ' + (tgt.tag || tgt.name) + ' deleted from the match', '#ff8a80');
    } break;
    case 2: { const del = B.deleted || [], i = del.findIndex(x => x.sid === sid); if (i < 0) break;
      const r = del.splice(i, 1)[0]; r.alive = true; r.hp = Math.max(r.hp, r.maxHp * 0.25); r.x = inArenaX(ARENA.cx + rand(-200, 200), r.r); r.y = inArenaY(ARENA.cy + rand(-120, 120), r.r); r.st.invuln = 1;
      B.fighters.push(r); say('ADMIN: ' + (r.tag || r.name) + ' restored'); if (!FX.off) FX.burst(r.x, r.y, '#00e5ff', 30, 300); break; }
    case 3: { if (!tgt || !tgt.alive) break; const ids = allBalls().filter(b => b.enabled && !b.summonOnly && !b.unit && !b.draft).map(b => b.id), def = getBall(ids[clamp(v1, 0, ids.length - 1)]); if (!def) break;
      const ratio = tgt.hpRatio, nf = new Fighter(def, { team: tgt.team, level: tgt.level, evo: tgt.evo, x: tgt.x, y: tgt.y, angle: rand(TAU), isPlayer: tgt.isPlayer, allUnlocked: true, rScale: tgt.r / BASE_R });
      nf.hp = Math.max(1, nf.maxHp * ratio); nf.sid = tgt.sid; nf.slot = tgt.slot; nf.tag = tgt.tag; nf.manual = tgt.manual; nf.inX = tgt.inX || 0; nf.inY = tgt.inY || 0; nf.inP = tgt.inP || 0;
      nf.ai = new AIController(nf, def.ai === 'boss' ? 'intelligent' : (def.ai || 'intelligent'), tgt.ai ? tgt.ai.diff : 'hard');
      const i = B.fighters.indexOf(tgt); B.fighters[i] = nf; if (B.player === tgt) B.player = nf; if (B.slots) B.slots = B.slots.map(x => x === tgt ? nf : x);
      for (const x of B.fighters) if (x.target === tgt) x.target = nf;
      say('ADMIN: transformed into ' + def.name); if (!FX.off) { FX.burst(nf.x, nf.y, def.design.c3, 40, 420); FX.ring(nf.x, nf.y, '#ffffff', 140, 0.4, 6); } break; }
    case 4: { if (!tgt || !tgt.alive) break; const k = PROP_KEYS[clamp(v1, 0, 3)], v = clamp(v2, 10, 200) / 100;
      if (k === 'hp') tgt.hp = Math.max(1, Math.min(tgt.maxHp * 2, tgt.maxHp * v));
      if (k === 'size') { tgt.r = BASE_R * clamp(v, 0.5, 1.6); }
      if (k === 'speed') tgt.xSpd = clamp(v, 0.3, 2);
      if (k === 'attack') tgt.xAtk = clamp(v, 0.2, 2.5);
      say(`ADMIN: ${tgt.tag || tgt.name} ${k.toUpperCase()} → ${Math.round(v * 100)}%`); if (!FX.off) vfx((ctx, q) => supDrawSelect(ctx, tgt.x, tgt.y, tgt.r * 1.4, '#00e5ff', k.toUpperCase() + ' ' + Math.round(v * 100) + '%', 1 - q), 1.2); break; }
    case 5: { const kind = ARENA_CONDS[clamp(v1, 0, ARENA_CONDS.length - 1)];
      B.cond = kind === 'normal' ? null : { kind, team: pl.team, by: pl, t: clamp(v2, 3, 15) };
      say('ADMIN: arena → ' + kind.toUpperCase(), '#ffd54f'); if (!FX.off) FX.addFlash(0.15, '#00e5ff'); break; }
    case 6: { if (v1 === 0) { B.dmgMul = clamp(v2, 25, 300) / 100; say(`ADMIN: damage ×${(B.dmgMul).toFixed(2)}`, '#ffd54f'); }
      if (v1 === 1) { B.suddenDeath = !!v2; say('ADMIN: sudden death ' + (v2 ? 'ON' : 'OFF'), '#ffd54f'); } break; }
  }
  B.adminLog = (B.adminLog || 0) + 1;
}
/** the commander's AI (or a replay without commands): an automatic but temporary deletion of the strongest enemy */
function adminAutoDelete(f) {
  const es = supEnemies(f).filter(e => !e.isClone).sort((a, b) => b.maxHp * b.hpRatio - a.maxHp * a.hpRatio);
  const e = es[0]; if (!e) return;
  const dur = e.boss ? 2 : 4.5;
  e.st.outside = dur; e.portalExit = { mode: 'point', x: e.x, y: e.y, col: '#00e5ff' }; e.vx = e.vy = 0;
  if (!FX.off) { vfx((ctx, q) => supDrawSelect(ctx, e.x, e.y, e.r * 1.5, '#ff1744', 'DELETED (' + Math.ceil(dur * (1 - q)) + 's)', 1 - q * 0.3), dur); FX.burst(e.x, e.y, '#00e5ff', 30, 360, 5, 0.6, 'shard'); }
}
/* selection box used by Reality Controller visuals */
function supDrawSelect(ctx, x, y, r, col, label, a) {
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
  ctx.strokeRect(x - r, y - r, r * 2, r * 2); ctx.setLineDash([]);
  for (const [sx2, sy2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillStyle = col; ctx.fillRect(x + sx2 * r - 4, y + sy2 * r - 4, 8, 8); }
  ctx.font = '800 13px "Segoe UI", sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(label, x - r, y - r - 6); ctx.restore();
}

/* ---------------- drawing hooks ---------------- */
function supCamera(B, ctx, dt) {
  const c = B.cam; if (!c) return; c.t += dt; if (c.t >= c.dur) { B.cam = null; return; }
  const q = c.t / c.dur, k = 1 + c.k * Math.sin(Math.PI * q);
  ctx.translate(c.x, c.y); ctx.scale(k, k); ctx.translate(-c.x, -c.y);
}
function supDrawUnder(B, ctx, dt) {
  const d = B.darkFx;
  if (d) { d.t -= dt; if (d.t <= 0) B.darkFx = null; else { ctx.save(); ctx.globalAlpha = d.a * Math.min(1, d.t / 0.4, (d.max - d.t) / 0.25 + 0.1); ctx.fillStyle = d.col; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.restore(); } }
  if (B.cond) { const c = B.cond, col = { frozen: '#80d8ff', inferno: '#ff3d00', storm: '#ffee58', shift: '#e040fb', ...SUP.condCols }[c.kind] || '#ffffff'; ctx.save(); ctx.globalAlpha = 0.1 + 0.04 * Math.sin(B.time * 4); ctx.fillStyle = col; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.restore(); }
  for (const P of B.portalPairs || []) for (const [x, y, col] of [[P.ax, P.ay, P.col], [P.bx, P.by, P.col2]]) {
    ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), -P.r * 2, -P.r * 2, P.r * 4, P.r * 4);
    ctx.strokeStyle = col; ctx.lineWidth = 5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, P.r * (1 - i * 0.22), P.r * 0.8 * (1 - i * 0.22), 0, B.time * (3 + i), B.time * (3 + i) + 4.2); ctx.stroke(); }
    ctx.restore();
  }
  for (const f of B.fighters) if (f.alive && f.sx && f.sx.leashT > 0 && f.sx.leash) {   // soul chains
    const L = f.sx.leash; ctx.save(); ctx.strokeStyle = L.col ? rgba(L.col, 0.85) : 'rgba(206,147,216,.85)'; ctx.lineWidth = 3; ctx.setLineDash([10, 5]); ctx.lineDashOffset = -B.time * 40;
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(f.x, f.y); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = 'rgba(206,147,216,.35)'; ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#4a148c'; ctx.beginPath(); ctx.arc(L.x, L.y, 10, 0, TAU); ctx.fill(); ctx.restore();
  }
}
function supDrawOver(B, ctx, dt) {
  const list = B.vfx; if (!list || !list.length) return;
  for (let i = list.length - 1; i >= 0; i--) { const v = list[i]; v.t += dt; const q = v.t / v.life; if (q >= 1) { list.splice(i, 1); continue; } try { v.draw(ctx, q, v); } catch (e) { list.splice(i, 1); } }
}
function supChips(f, chips) {
  const s = f.sx; if (!s) return;
  if (s.curseT > 0) chips.push(['CURSED', '#ce93d8']); if (s.leashT > 0) chips.push(['CHAINED', '#ce93d8']); if (s.lagT > 0) chips.push(['LAGGING', '#00ff41']);
  if (s.infShieldT > 0) chips.push(['∞ SHIELD', '#00e5ff']); if (s.counterT > 0) chips.push(['COUNTER', '#e1f5fe']); if (s.bloodAuraT > 0) chips.push(['BLOOD AURA', '#ff1744']);
  if (s.predictT > 0) chips.push(['FORESIGHT', '#ffd740']); if (s.blindT > 0) chips.push(['BLINDED', '#ff6d00']); if (s.packetT > 0) chips.push(['PACKET LOSS', '#00ff41']); if (s.scalesT > 0) chips.push(['DRAGON SCALES', '#ffd54f']); if (s.voidArmor > 0) chips.push(['VOID ARMOR', '#7c4dff']); if (s.hemoN > 0) chips.push(['BLEEDING', '#d50000']); if (s.rebirthT > 0) chips.push(['REBIRTH', '#ffea00']); if (s.adminT > 0) chips.push(['ADMIN ' + s.adminLeft, '#00e5ff']);
  for (const fn of SUP.chipHooks) fn(f, chips);
  if (f.form) chips.push([f.form === 2 ? 'GOD FORM' : 'AWAKENED', f.def.design.c3]);
}
/* ---------------- registration helpers ---------------- */
SUP.ids = [];
const SD = (f, P) => skillDmg(f, P);
/** registers a skill type: role drives the AI; self = can be cast without a target */
function SK(type, role, ico, label, desc, fn, self) { SKILL_FN[type] = fn; SKILL_TYPES[type] = { ico, label, desc }; SUP.roles[type] = role; if (self) TECH_SELF.push(type); }
function UL(type, label, fn) { TECH_ULTS[type] = fn; ULT_TYPES[type] = label; }
/** adds a Supreme ball (or upgrades an existing one with the same id, keeping the owner's saved progress) */
function supBall(def, cfg) {
  Object.assign(def, { supreme: true, adminOnly: true, godMode: false, forms: cfg.forms, finalUlt: cfg.finalUlt, sound: cfg.sound, passiveInfo: cfg.passiveInfo });
  SUP.fx[def.id] = cfg.fx || {};
  let found = false;
  for (const list of [BUILTIN_BALLS, LIMITED_BALLS, ADMIN_BALLS, PREMIUM_BALLS, UPDATE_BALLS, ALL_BUILTIN]) { const i = list.findIndex(b => b.id === def.id); if (i >= 0) { list[i] = def; if (list !== ALL_BUILTIN) found = true; } }
  if (!found) ADMIN_BALLS.push(def);
  if (!ALL_BUILTIN.includes(def)) ALL_BUILTIN.push(def);
  SUP.ids.push(def.id);
  return def;
}
const UNITB = (id, name, st, d) => B(id, name, 'Admin', 'Admin Exclusive', st, d, [], null, 'aggressive', { unit: true, summonOnly: true, adminOnly: true });

/* =================== 1. REALITY CONTROLLER =================== */
SK('rc_edit', 'control', '⌖', 'Reality Edit', 'Selects an enemy and rewrites its properties for a few seconds (size, speed or attack)', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  const es = sx(e), dur = 4 + P / 50, picks = f.form >= 1 ? [RNG() * 3 | 0, RNG() * 3 | 0] : [RNG() * 3 | 0], labels = [];
  for (const k of new Set(picks)) {
    if (k === 0) { if (!es.editR) es.editR = e.r; e.r = es.editR * 0.7; labels.push('SIZE 70%'); }
    if (k === 1) { e.xSpd = 0.6; labels.push('SPEED 60%'); }
    if (k === 2) { e.xAtk = 0.65; labels.push('ATTACK 65%'); }
  }
  after(dur, () => { if (es.editR) { e.r = es.editR; es.editR = 0; } e.xSpd = 1; e.xAtk = 1; });
  dealDamage(f, e, SD(f, P) * 0.35, { kind: 'skill', tag: 'skill', power: P });
  if (!FX.off) { vfx((ctx, q) => supDrawSelect(ctx, e.x, e.y, e.r * 1.5, col, 'EDIT: ' + labels.join(' • '), 1 - q * q), 1.6); FX.bolt(f.x, f.y, e.x, e.y, col, 2, 0.3); supSound(f, 'skill', 0); }
});
SK('rc_shift', 'control', '⇆', 'Dimension Shift', 'Shifts the arena into an inverted dimension: enemies steer the wrong way for a while', (f, s, P) => {
  BATTLE.cond = { kind: 'shift', team: f.team, by: f, t: 3.5 + P / 60 };
  for (const e of supEnemies(f)) { e.vx = -e.vx; e.vy = -e.vy; }
  if (!FX.off) { FX.addFlash(0.2, '#e040fb'); vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.5 * (1 - q); ctx.strokeStyle = '#e040fb'; ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { const y = ARENA.y + ARENA.h * (i + 0.5) / 12, w = Math.sin(q * 12 + i) * 30; ctx.beginPath(); ctx.moveTo(ARENA.x, y); ctx.bezierCurveTo(ARENA.cx - 200, y + w, ARENA.cx + 200, y - w, ARENA.r, y); ctx.stroke(); } ctx.restore(); }, 1.2); supSound(f, 'skill', 1); }
}, true);
SK('rc_freeze', 'control', '⏸', 'Time Freeze', 'Pauses the whole battle except the Reality Controller: enemies, their shots and their fields stop', (f, s, P) => {
  const dur = 1.2 + P / 120;
  for (const e of supEnemies(f)) e.st.timestop = Math.max(e.st.timestop, e.boss ? dur * 0.5 : dur);
  for (const p of BATTLE.projs) if (p.team !== f.team) p.frozen = dur;
  BATTLE.timeTint = Math.max(BATTLE.timeTint, dur);
  if (!FX.off) { vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.7 * (1 - q); ctx.fillStyle = '#e1f5fe'; ctx.font = '900 120px "Segoe UI Symbol", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⏸', ARENA.cx, ARENA.cy + 40); ctx.restore(); }, dur); supSound(f, 'skill', 2); }
}, true);
SK('rc_dup', 'summon', '⧉', 'Ball Duplicator', 'Copies the strongest enemy: the copy fights for the Reality Controller for a few seconds', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e || (sx(f).dup && sx(f).dup.alive)) return false;
  const a = rand(TAU), c = new Fighter(e.baseDef || e.def, { team: f.team, clone: true, summon: true, owner: f, level: e.level, evo: e.evo, allUnlocked: true, x: inArenaX(f.x + dcos(a) * 110), y: inArenaY(f.y + dsin(a) * 110), angle: a, life: 6 + P / 30, rScale: e.r / BASE_R * 0.85, statMul: 0.6 });
  c.maxHp = c.hp = Math.max(10, Math.round(e.maxHp * 0.3)); c.godUsed = true; c.st.invuln = 0.5; c.ai = new AIController(c, 'aggressive', 'hard'); c.dupe = true;
  BATTLE.fighters.push(c); f.sx.dup = c;
  if (!FX.off) { FX.bolt(e.x, e.y, c.x, c.y, '#ffffff', 3, 0.4); vfx((ctx, q) => supDrawSelect(ctx, c.x, c.y, c.r * 1.4, '#ffffff', 'COPY OF ' + e.name.toUpperCase(), 1 - q), 1.2); supSound(f, 'skill', 3); }
});
SK('rc_portal', 'mobility', '◎', 'Void Portal', 'Opens two linked portals: anything that enters one comes out of the other (the caster jumps right away)', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt), sp = len(f.vx, f.vy) || 1, ax = inArenaX(f.x + f.vx / sp * (f.r + 40), 60), ay = inArenaY(f.y + f.vy / sp * (f.r + 40), 60);
  const b = e ? behind(e, f, 70) : { x: ARENA.cx, y: ARENA.cy };
  (BATTLE.portalPairs || (BATTLE.portalPairs = [])).push({ ax, ay, bx: inArenaX(b.x, 60), by: inArenaY(b.y, 60), r: 44, t: 5 + P / 40, col: '#00e5ff', col2: '#ff9100' });
  if (!FX.off) supSound(f, 'skill', 4);
}, true);
UL('admindelete', 'Admin Delete — the owner edits the match: delete, restore, transform, change properties and the arena', (f, P, col, dmg) => {
  camPunch(f.x, f.y, 0.16, 1.2);
  const s = sx(f); s.adminT = 12; s.adminLeft = 4;
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.cy - 40, '▣ ADMIN DELETE ▣', '#00e5ff', 48, { life: 2, vy: 0, pop: 2, stroke: '#001018' }); supSound(f, 'ult');
    vfx((ctx, q) => { const x = ARENA.x + ARENA.w * q; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(x - 60, 0, x + 10, 0); g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(1, 'rgba(0,229,255,.55)'); ctx.fillStyle = g; ctx.fillRect(x - 60, ARENA.y, 70, ARENA.h); ctx.restore(); }, 0.9);
  }
  after(0.5, () => { if (f.alive) for (const e of supEnemies(f)) dealDamage(f, e, dmg * 0.5, { kind: 'skill', tag: 'wave', power: P }); });
  if (f.isPlayer || f.slot != null) { if (!FX.off && typeof UI !== 'undefined' && UI.adminConsole && BATTLE.player === f) UI.adminConsole(f); }
  else after(0.8, () => { if (f.alive) adminAutoDelete(f); });
});
UL('godcommand', "God's Final Command — erases every enemy summon, shot and field, freezes the enemies and strikes them with command pillars", (f, P, col, dmg) => {
  darkArena(2.4, '#ffffff', 0.25); camPunch(f.x, f.y, 0.2, 1.6); FX.addFlash(0.35, '#ffffff');
  for (const x of BATTLE.fighters) if (x.alive && x.team !== f.team && x.isClone) { x.alive = false; if (!FX.off) FX.burst(x.x, x.y, '#ffffff', 14, 260); }
  BATTLE.projs = BATTLE.projs.filter(p => p.team === f.team); BATTLE.zones = BATTLE.zones.filter(z => z.team === f.team); BATTLE.lasers = BATTLE.lasers.filter(l => l.team === f.team);
  for (const e of supEnemies(f)) e.st.timestop = Math.max(e.st.timestop, e.boss ? 1 : 2);
  after(1.2, () => { if (!f.alive) return; for (const e of supEnemies(f)) { BATTLE.pillars.push({ x: e.x, w: 90, col: '#ffd54f', life: 0.7, max: 0.7 }); dealDamage(f, e, dmg * 0.95, { kind: 'skill', tag: 'strike', power: P }); } FX.addShake(16); });
  healFighter(f, f.maxHp * 0.2); const s = sx(f); s.adminT = 10; s.adminLeft = 2;
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.cy - 50, "GOD'S FINAL COMMAND", '#ffd54f', 46, { life: 2.2, vy: 0, pop: 2, stroke: '#1a1200' }); supSound(f, 'ult', 2);
    const lines = ['> sudo reality --override', '> delete enemy.summons', '> freeze enemy.time', '> execute judgment()'];
    vfx((ctx, q) => { ctx.save(); ctx.font = '700 18px Consolas, monospace'; ctx.fillStyle = '#00e5ff'; ctx.globalAlpha = 1 - q * 0.6; lines.slice(0, Math.ceil(q * 6)).forEach((l, i) => ctx.fillText(l, ARENA.x + 30, ARENA.y + 160 + i * 26)); ctx.restore(); }, 2.2);
  }
  if ((f.isPlayer || f.slot != null) && !FX.off && typeof UI !== 'undefined' && UI.adminConsole && BATTLE.player === f) UI.adminConsole(f);
});
supBall(B('realitycontroller', 'Reality Controller Ball', 'Admin', 'Admin Exclusive', [140, 98, 96, 92, 80], D('#070b14', '#00e5ff', '#ffffff', 'reality', [], '', { glow: 1.6, sdeco: ['cursor', 'codering'] }),
  [S('REALITY EDIT', 'rc_edit', 7, 80, '#00e5ff'), S('DIMENSION SHIFT', 'rc_shift', 12, 70, '#e040fb'), S('TIME FREEZE', 'rc_freeze', 13, 70, '#80d8ff'), S('BALL DUPLICATOR', 'rc_dup', 14, 75, '#ffffff'), S('VOID PORTAL', 'rc_portal', 8, 60, '#00e5ff')],
  U('ADMIN DELETE', 'admindelete', 130, '#00e5ff'), 'intelligent', { desc: "SUPREME ADMIN. Controls the battlefield itself — and its ultimate opens the owner's Admin console." }), {
  forms: [{ name: 'REALITY CONTROLLER' }, { name: 'REALITY ARCHITECT', design: { c2: '#ffd54f', c3: '#00e5ff', glow: 1.9 } }, { name: 'GOD OF REALITY', design: { c1: '#e8f4ff', c2: '#ffd54f', c3: '#00e5ff', glow: 2.2, sdeco: ['cursor', 'codering', 'godhalo'] } }],
  finalUlt: U("GOD'S FINAL COMMAND", 'godcommand', 150, '#ffd54f'), sound: { base: 330, wave: 'square', slide: 2.2, noise: 5200 },
  fx: {
    idle: (f, d) => FX.p(f.x + vr(-1, 1) * f.r * 1.6, f.y + vr(-1, 1) * f.r * 1.6, 0, -40, 0.6, vr(2, 4), Math.random() < 0.5 ? d.c3 : d.c2, 'shard', 1),
    bounce: (f, x, y, d) => { FX.ring(x, y, d.c3, 70, 0.3, 3, 6); FX.burst(x, y, '#ffffff', 6, 200, 3, 0.3, 'shard'); },
    victory: f => { vfx((ctx, q) => supDrawSelect(ctx, f.x, f.y, f.r * (1.5 + q), '#00e5ff', 'REALITY CONFIRMED ✔', 1 - q * 0.5), 1.8); FX.text(f.x, f.y - f.r - 60, 'REALITY CONFIRMED', '#00e5ff', 24, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, d.c3, 60, 500, 5, 1.0, 'shard'); FX.text(f.x, f.y - f.r - 30, 'CONNECTION LOST', '#ff8a80', 24, { life: 1.6 }); },
    entrance: f => FX.text(ARENA.cx, ARENA.y + 150, 'ADMIN ACCESS GRANTED', '#00e5ff', 22, { life: 1.8, vy: 0 }),
  },
});

/* =================== 2. SUPREME SKULL KING =================== */
const SKULL_GUARD = UNITB('u_skullguard', 'Skull Guardian', [70, 72, 55, 88, 10], D('#141018', '#e0e0e0', '#ce93d8', 'skullking', [], '', { glow: 1.2 }));
SK('sk_storm', 'ranged', '☠', 'Skull Storm', 'A storm of spectral skulls rains from the top of the arena onto the target', (f, s, P, col, tgt) => {
  const n = 10 + f.form * 3;
  for (let i = 0; i < n; i++) after(i * 0.07, () => {
    const t = supTarget(f, tgt); if (!f.alive || !t) return;
    const x = inArenaX(t.x + rand(-170, 170), 20), y0 = ARENA.y + 8;
    supShot(f, x, y0, datan2(t.y - y0, t.x - x) + rand(-0.12, 0.12), { speed: 520, r: 11, dmg: SD(f, P) * 0.2, col, style: 'skull', homing: 1.2, target: t, effect: 'weaken', power: P, boom: f.form >= 2 ? 45 : 0 });
  });
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('sk_army', 'summon', '💀', 'Bone Army', 'Raises skull guardians that hunt the enemy and burst into bone shards when destroyed', (f, s, P) => {
  if (supMinions(f) >= SUP.MINION_MAX) return false;
  const n = Math.min(SUP.MINION_MAX - supMinions(f), 2 + (f.form >= 1 ? 1 : 0));
  for (let i = 0; i < n; i++) { const a = f.rot + i / n * TAU; supMinion(f, SKULL_GUARD, f.x + dcos(a) * f.r * 2.4, f.y + dsin(a) * f.r * 2.4, { P, life: 8 + P / 30, hp: 0.08, onDeath: m => supBlast(f, m.x, m.y, 110, SD(f, P) * 0.3, { tag: 'explosion' }) }); }
  if (!FX.off) { for (let i = 0; i < n; i++) FX.burst(f.x, f.y, '#e0e0e0', 20, 300, 4, 0.6, 'shard'); supSound(f, 'skill', 1); }
}, true);
SK('sk_chains', 'control', '⛓', 'Soul Chains', 'Supernatural chains bind the target to the ground: it cannot move far and keeps taking damage', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  const es = sx(e); es.leash = { x: e.x, y: e.y, r: 70, by: f, dmg: SD(f, P) * 0.12 }; es.leashT = (e.boss ? 1.5 : 3) + P / 60;
  if (!FX.off) { FX.bolt(f.x, f.y, e.x, e.y, '#ce93d8', 4, 0.4); FX.ring(e.x, e.y, '#ce93d8', 90, 0.4, 5, 10); supSound(f, 'skill', 2); }
});
SK('sk_orbit', 'aoe', '◌', 'Death Orbit', 'Skulls circle the king, hitting anyone close — then launch themselves at the nearest enemy', (f, s, P, col) => {
  const n = 6 + f.form * 2, life = 5 + P / 60;
  for (let i = 0; i < n; i++) {
    const p = supShot(f, f.x, f.y, 0, { speed: 0, r: 12, dmg: SD(f, P) * 0.18, col, style: 'skull', life, pierce: 999, power: P, data: { a: i / n * TAU, cd: 0 } });
    p.tick = (p, h) => { const d = p.data; d.a += 3.2 * h; d.cd -= h; if (d.cd <= 0) { d.cd = 0.45; if (p.hits) p.hits.clear(); } p.x = inArenaX(f.x + dcos(d.a) * (f.r + 52), 14); p.y = inArenaY(f.y + dsin(d.a) * (f.r + 52), 14); p.vx = p.vy = 0; if (!f.alive) p.life = 0; };
    p.onEnd = p => { if (!f.alive) return; const t = nearestEnemy(f); if (t) supShot(f, p.x, p.y, datan2(t.y - p.y, t.x - p.x), { speed: 620, r: 11, dmg: SD(f, P) * 0.25, col, style: 'skull', homing: 3, target: t, power: P }); };
  }
  if (!FX.off) supSound(f, 'skill', 3);
}, true);
SK('sk_curse', 'curse', '♛', "King's Curse", "Curses the target: its abilities are 35% weaker and every ability it uses costs it HP", (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  const es = sx(e); es.curseT = (e.boss ? 2.5 : 5) + P / 60; es.curseBy = f;
  if (!FX.off) { vfx((ctx, q, v) => { if (!e.alive) return; vSkull(ctx, e.x, e.y - e.r - 34, 16, '#ce93d8', 0.9 * (1 - q * q), 0.3); }, es.curseT); FX.ring(e.x, e.y, '#8e24aa', e.r * 2.4, 0.5, 6, e.r); supSound(f, 'skill', 4); }
});
function skullApocalypse(f, P, col, dmg, god) {
  darkArena(3.6, '#000000', 0.72); camPunch(ARENA.cx, ARENA.cy, 0.12, 2.6);
  const tint = f.def.design.c3, cx = ARENA.cx, cy = ARENA.cy - 30;
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.y + 70, god ? '☠ APOCALYPSE OF THE SKULL GOD ☠' : '☠ APOCALYPSE OF SKULLS ☠', god ? '#ffd54f' : tint, 40, { life: 2.6, vy: 0, pop: 2, stroke: '#100010' }); supSound(f, 'ult', god ? 2 : 0);
    vfx((ctx, q) => { const rise = Math.min(1, q * 2.2), jaw = q > 0.36 ? Math.min(1, (q - 0.36) * 5) * (1 - Math.max(0, q - 0.8) * 5) : 0; vSkull(ctx, cx, cy + (1 - rise) * 260, 190 + 30 * rise, tint, 0.85 * rise * (1 - Math.max(0, q - 0.85) * 6), jaw, god); }, 2.8);
    vfx((ctx, q) => { for (let i = 0; i < 40; i++) { const a = i / 40 * TAU + q * 4, r = 380 + 120 * Math.sin(i * 1.7 + q * 6); vSkull(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.55, 10 + (i % 3) * 4, i % 2 ? '#ce93d8' : tint, 0.6 * Math.sin(Math.PI * q), 0.2); } }, 2.6);
  }
  after(1.25, () => {
    if (!f.alive) return;
    if (!FX.off) { FX.addFlash(0.35, tint); FX.addShake(20); for (let i = 0; i < 4; i++) FX.ring(cx, cy, i % 2 ? '#ffffff' : tint, 320 + i * 140, 0.8, 16 - i * 3, 30); FX.burst(cx, cy, tint, 90, 900, 8, 1.2, 'shard'); }
    for (const e of supEnemies(f)) { dealDamage(f, e, dmg * (god ? 0.85 : 0.7), { kind: 'skill', tag: 'explosion', effect: 'weaken', power: P }); knock(e, cx, cy, 700); }
    for (let i = 0; i < (god ? 18 : 12); i++) after(0.1 + i * 0.06, () => { const t = nearestEnemy(f); if (f.alive && t) supShot(f, cx, cy + 40, i / 12 * TAU, { speed: 460, r: 12, dmg: dmg * 0.09, col: tint, style: 'skull', homing: 3.4, target: t, power: P, life: 3.2 }); });
    if (god) {
      for (const e of supEnemies(f)) supStrike(f, e.x, e.y, 0.5, 80, dmg * 0.35, '#ffd54f', { kind: 'pillar' });
      for (let i = 0; i < 2; i++) supMinion(f, SKULL_GUARD, cx + (i ? 140 : -140), cy + 60, { P, life: 9, hp: 0.08 });
    }
  });
}
UL('skullapoc', 'Apocalypse of Skulls — the arena goes dark, a giant spectral skull rises and explodes', (f, P, col, dmg) => skullApocalypse(f, P, col, dmg, false));
UL('skullgodapoc', 'Apocalypse of the Skull God — the giant skull, graves erupting under every enemy and a bone guard', (f, P, col, dmg) => skullApocalypse(f, P, col, dmg, true));
supBall(B('skullking', 'Supreme Skull King Ball', 'Admin', 'Admin Exclusive', [155, 104, 92, 84, 78], D('#07020c', '#8e24aa', '#ff1744', 'skullking', [], '', { glow: 1.7, sdeco: ['spectral', 'miniskulls', 'darkcrown'] }),
  [S('SKULL STORM', 'sk_storm', 7, 75, '#ce93d8'), S('BONE ARMY', 'sk_army', 13, 70, '#e0e0e0'), S('SOUL CHAINS', 'sk_chains', 10, 65, '#ce93d8'), S('DEATH ORBIT', 'sk_orbit', 9, 70, '#ff1744'), S("KING'S CURSE", 'sk_curse', 12, 60, '#8e24aa')],
  U('APOCALYPSE OF SKULLS', 'skullapoc', 135, '#ff1744'), 'aggressive', { desc: 'SUPREME ADMIN. A floating skull sphere with crimson eyes, a dark crown and spectral flames.' }), {
  forms: [{ name: 'SKULL KING' }, { name: 'ANCIENT DEATH EMPEROR', design: { c2: '#33691e', c3: '#76ff03', glow: 1.9 } }, { name: 'SUPREME SKULL GOD', design: { c1: '#120000', c2: '#ffd54f', c3: '#ff1744', glow: 2.3 } }],
  finalUlt: U('APOCALYPSE OF THE SKULL GOD', 'skullgodapoc', 155, '#ffd54f'), sound: { base: 98, wave: 'sawtooth', slide: 0.5, noise: 380 },
  fx: {
    idle: (f, d) => FX.p(f.x + vr(-f.r, f.r) * 0.8, f.y + vr(-f.r, f.r) * 0.6, vr(-12, 12), vr(-110, -60), 0.7, vr(3, 6), Math.random() < 0.6 ? d.c2 : '#000000', 'smoke', 0.6),
    bounce: (f, x, y) => FX.burst(x, y, '#e0e0e0', 6, 180, 3, 0.35, 'shard'),
    victory: (f, d) => { vfx((ctx, q) => vSkull(ctx, f.x, f.y - f.r - 90 - q * 30, 46, d.c3, 1 - q * 0.7, Math.abs(Math.sin(q * 18)) * 0.8), 1.8); FX.text(f.x, f.y - f.r - 150, 'ALL HAIL THE SKULL KING', d.c3, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, '#e0e0e0', 50, 480, 6, 1.0, 'shard'); vfx((ctx, q) => vSkull(ctx, f.x, f.y - q * 140, 30, '#b0bec5', 0.7 * (1 - q), 0.5), 1.6); },
    entrance: f => FX.text(ARENA.cx, ARENA.y + 150, 'THE DEAD RISE FOR THEIR GOD', '#ffd54f', 22, { life: 1.8, vy: 0 }),
  },
});

/* =================== 3. VOID EMPEROR (upgraded) =================== */
SK('ve_hole', 'aoe', '●', 'Black Hole', 'A drifting black hole that slowly hunts the target, pulling everything in before it collapses', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const life = 3 + P / 80;
  const z = supZone(f, { kind: 'minihole', x: inArenaX(f.x + (t.x - f.x) * 0.4, 80), y: inArenaY(f.y + (t.y - f.y) * 0.4, 80), r: 250 + f.form * 30, life, col, pull: 820 + P * 5, dmg: SD(f, P) * 0.12, effect: 'none', power: P, endDmg: SD(f, P) * 0.55 });
  z.drift = { tgt: t, sp: 90 };
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('ve_crush', 'control', '⤓', 'Gravity Crush', 'Gravity converges on the target, then slams it into the floor: stopped dead and crushed', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  if (!FX.off) for (let i = 0; i < 3; i++) FX.ring(e.x, e.y, col, e.r * 0.8, 0.6, 5, e.r * (4 - i));
  after(0.6, () => { if (!f.alive || !e.alive) return; e.vx = e.vy = 0; e.st.slow = Math.max(e.st.slow, 1.5); dealDamage(f, e, SD(f, P) * 0.95, { kind: 'skill', tag: 'skill', power: P }); supWave(f, e.x, e.y, 180, SD(f, P) * 0.3, col, { force: 300 }); if (!FX.off) { FX.addShake(9); FX.burst(e.x, e.y, '#000000', 20, 200, 8, 0.6, 'smoke'); } });
  if (!FX.off) supSound(f, 'skill', 1);
});
SK('ve_tp', 'mobility', '⤳', 'Void Teleport', 'Blinks behind the target, leaving a void rift that implodes a moment later', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  const ox = f.x, oy = f.y, b = behind(e, f, 30);
  f.x = b.x; f.y = b.y; const a = angTo(f, e); f.vx = dcos(a) * f.baseSpeed * 2; f.vy = dsin(a) * f.baseSpeed * 2; f.st.dash = 0.35;
  darkBurst(ox, oy, 100, 1.1);
  after(1, () => { if (f.alive) { supBlast(f, ox, oy, 150, SD(f, P) * 0.6, { force: -500, tag: 'explosion' }); if (!FX.off) { FX.ring(ox, oy, col, 20, 0.4, 8, 160); Sound.play('void'); } } });
  if (!FX.off) { FX.burst(ox, oy, col, 20, 260); FX.burst(f.x, f.y, col, 20, 260); supSound(f, 'skill', 2); }
});
SK('ve_matter', 'ranged', '◉', 'Dark Matter', 'Three heavy orbs of dark matter drag nearby enemies along and burst into small singularities', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false; const base = aimAngle(f, t, 260);
  for (let i = -1; i <= 1; i++) supShot(f, f.x + dcos(base) * f.r, f.y + dsin(base) * f.r, base + i * 0.28, { speed: 260, r: 16, dmg: SD(f, P) * 0.3, col, style: 'darkorb', life: 3.2, power: P,
    tick: (p, h) => { for (const e of supEnemies(f)) { const dx = p.x - e.x, dy = p.y - e.y, d = len(dx, dy); if (d < 160 && d > 1) { e.vx += dx / d * 900 * h; e.vy += dy / d * 900 * h; } } },
    onEnd: p => supBlast(f, p.x, p.y, 110, SD(f, P) * 0.3, { tag: 'explosion', force: -400 }), onHit: p => supBlast(f, p.x, p.y, 110, SD(f, P) * 0.2, { tag: 'explosion', force: -400 }) });
  if (!FX.off) supSound(f, 'skill', 3);
});
SK('ve_armor', 'defense', '⛉', 'Void Armor', 'Void armour swallows most of the damage taken, then releases it as a dark wave', (f, s, P, col) => {
  const st = sx(f); if (st.voidArmor > 0) return false;
  st.voidArmor = f.maxHp * (0.18 + P / 1000); st.voidStored = 0;
  after(4.5, () => { if (!f.alive) return; const amt = (st.voidStored || 0) * 0.8 + SD(f, P) * 0.2; st.voidArmor = 0; supWave(f, f.x, f.y, 320, amt, col, { force: 600, style: 'anti' }); if (!FX.off) FX.text(f.x, f.y - f.r - 30, 'VOID RELEASE', col, 18); });
  if (!FX.off) { FX.ring(f.x, f.y, col, f.r * 2, 0.5, 8, f.r); supSound(f, 'skill', 4); }
}, true);
UL('endlessvoid', 'Endless Void — the arena edges dissolve into the void around a central singularity', (f, P, col, dmg) => {
  darkArena(4, '#05000f', 0.5); camPunch(ARENA.cx, ARENA.cy, 0.1, 2);
  supZone(f, { kind: 'blackhole', x: ARENA.cx, y: ARENA.cy, r: 380, life: 3.2, col, pull: 1500, dmg: dmg * 0.09, effect: 'weaken', power: P, endDmg: dmg * 0.75 });
  for (let k = 0; k < 8; k++) after(k * 0.4, () => { if (!f.alive) return; for (const e of supEnemies(f)) { const edge = Math.min(e.x - ARENA.x, ARENA.r - e.x, e.y - ARENA.y, ARENA.b - e.y); if (edge < 120) dealDamage(f, e, dmg * 0.06, { kind: 'skill', tag: 'zone', noCrit: true }); } });
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, '● ENDLESS VOID ●', '#b388ff', 44, { life: 2.4, vy: 0, pop: 2 }); supSound(f, 'ult');
    vfx((ctx, q) => { ctx.save(); const a = Math.sin(Math.PI * q) * 0.85, g = ctx.createRadialGradient(ARENA.cx, ARENA.cy, ARENA.h * 0.35, ARENA.cx, ARENA.cy, ARENA.w * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(20,0,40,${a})`); ctx.fillStyle = g; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.restore(); }, 3.6); }
});
UL('absolutevoid', 'Absolute Void — light disappears: every enemy buff, shot and summon is erased, enemies are silenced and torn apart', (f, P, col, dmg) => {
  darkArena(3, '#000000', 0.88); camPunch(f.x, f.y, 0.22, 1.8); FX.addFlash(0.3, '#000000');
  BATTLE.projs = BATTLE.projs.filter(p => p.team === f.team);
  for (const x of BATTLE.fighters) if (x.alive && x.team !== f.team && x.isClone) x.alive = false;
  for (const e of supEnemies(f)) { e.st.shield = e.st.buff = e.st.adapt = e.st.overclock = e.st.reflect = 0; silenceFoe(f, e, 2, 'ERASED'); }
  after(1, () => { if (!f.alive) return; for (const e of supEnemies(f)) { dealDamage(f, e, dmg * 1.0, { kind: 'skill', tag: 'explosion', effect: 'weaken', power: P }); darkBurst(e.x, e.y, 160, 1); } FX.addShake(18); });
  if (!FX.off) { FX.text(ARENA.cx, ARENA.cy - 40, 'ABSOLUTE VOID', '#ffffff', 50, { life: 2.4, vy: 0, pop: 2, stroke: '#000' }); supSound(f, 'ult', 2);
    vfx((ctx, q) => { ctx.save(); ctx.strokeStyle = `rgba(179,136,255,${1 - q})`; ctx.lineWidth = 2; const rng = mulberry32(7); for (let i = 0; i < 14; i++) { let x = ARENA.cx, y = ARENA.cy, a = rng() * TAU; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (rng() - 0.5); x += Math.cos(a) * 70 * q * 2; y += Math.sin(a) * 70 * q * 2; ctx.lineTo(x, y); } ctx.stroke(); } ctx.restore(); }, 2.4); }
});
supBall(B('voidemperor', 'Void Emperor Ball', 'Admin', 'Admin Exclusive', [150, 102, 94, 84, 72], D('#000000', '#7c4dff', '#651fff', 'void', ['crown', 'ring'], '', { glow: 1.6, sdeco: ['voidrift'] }),
  [S('BLACK HOLE', 've_hole', 9, 75, '#7c4dff'), S('GRAVITY CRUSH', 've_crush', 8, 80, '#b388ff'), S('VOID TELEPORT', 've_tp', 6, 70, '#651fff'), S('DARK MATTER', 've_matter', 6, 70, '#311b92'), S('VOID ARMOR', 've_armor', 13, 70, '#7c4dff')],
  U('ENDLESS VOID', 'endlessvoid', 130, '#651fff', 'weaken'), 'boss', { desc: 'SUPREME ADMIN. Crowned ruler of the empty space between worlds — gravity is its weapon.' }), {
  forms: [{ name: 'VOID EMPEROR' }, { name: 'ABYSSAL SOVEREIGN', design: { c2: '#b388ff', c3: '#d500f9', glow: 1.9 } }, { name: 'ABSOLUTE VOID', design: { c1: '#000000', c2: '#ffffff', c3: '#7c4dff', glow: 2.3 } }],
  finalUlt: U('ABSOLUTE VOID', 'absolutevoid', 150, '#ffffff'), sound: { base: 62, wave: 'sawtooth', slide: 0.4, noise: 220 },
  fx: {
    idle: (f, d) => { const a = vr(TAU), r = f.r * vr(1.6, 2.4); FX.p(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, -Math.cos(a) * r * 2, -Math.sin(a) * r * 2, 0.45, vr(2, 4), d.c3, 'dot', 0); },
    bounce: (f, x, y, d) => { darkBurst(x, y, 50, 0.4); FX.ring(x, y, d.c3, 60, 0.3, 4, 6); },
    victory: (f, d) => { darkArena(1.6, '#05000f', 0.4); FX.text(f.x, f.y - f.r - 60, 'ALL RETURNS TO THE VOID', d.c3, 22, { life: 1.8 }); FX.ring(f.x, f.y, d.c3, 20, 1.2, 10, 600); },
    defeat: (f, d) => { vfx((ctx, q) => { ctx.save(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - q), 0, TAU); ctx.fill(); ctx.restore(); }, 0.8); FX.burst(f.x, f.y, d.c3, 50, -300, 5, 0.8); },
    entrance: f => FX.text(ARENA.cx, ARENA.y + 150, 'NOTHING REMAINS', '#ffffff', 22, { life: 1.8, vy: 0 }),
  },
});

/* =================== 4. THUNDER GOD =================== */
SK('tg_clones', 'ranged', '⚡', 'Lightning Clones', 'Two lightning copies zig-zag between enemies, chaining from one to the next', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  for (let i = 0; i < 2; i++) {
    const a = angTo(f, t) + (i ? 0.9 : -0.9);
    supShot(f, f.x, f.y, a, { speed: 720, r: f.r * 0.6, dmg: SD(f, P) * 0.32, col, style: 'boltclone', homing: 6, target: t, life: 2.6, pierce: 2 + f.form, effect: 'stun', power: P, data: { def: f.def },
      onHit: (p, e) => { const nx = supEnemies(f).find(x => x !== e && !(p.hits && p.hits.has(x.sid))); p.target = nx || e; if (!FX.off) FX.bolt(e.x, e.y, p.x, p.y, '#ffee58', 4, 0.3); } });
  }
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('tg_rain', 'aoe', '⛈', 'Thunder Rain', 'A line of thunderbolts marches across the arena through the target', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const a = angTo(f, t), n = 9 + f.form * 2;
  for (let i = 0; i < n; i++) { const d = 90 + i * 70; supStrike(f, f.x + dcos(a) * d, f.y + dsin(a) * d, 0.35 + i * 0.07, 62, SD(f, P) * 0.32, col, { effect: 'stun', power: P }); }
  if (!FX.off) supSound(f, 'skill', 1);
});
SK('tg_dash', 'melee', '⇶', 'Electric Dash', 'An electric dash that chains: after each hit it redirects to the next enemy (up to 3 hits)', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const a = angTo(f, t), st = sx(f); st.chainDash = 3; st.chainP = P;
  f.vx = dcos(a) * f.baseSpeed * 2.6; f.vy = dsin(a) * f.baseSpeed * 2.6; f.st.dash = 0.7; f.dashEffect = 'stun'; f.dashPow = P;
  if (!FX.off) { FX.sparks(f.x, f.y, col, 14, 500, a + Math.PI); supSound(f, 'skill', 2); }
});
SK('tg_cage', 'control', '▦', 'Thunder Cage', 'Four lightning walls lock the target inside a cage; touching the bars hurts', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  const g = 110, x0 = clamp(e.x - g, ARENA.x + 5, ARENA.r - 5), x1 = clamp(e.x + g, ARENA.x + 5, ARENA.r - 5), y0 = clamp(e.y - g, ARENA.y + 5, ARENA.b - 5), y1 = clamp(e.y + g, ARENA.y + 5, ARENA.b - 5);
  const dur = 2.6 + P / 60, dmg = SD(f, P) * 0.3;
  for (const L of [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]) addLaser(f, L, { charge: 0.35, dur, w: 10, dmg, col });
  if (!FX.off) supSound(f, 'skill', 3);
});
SK('tg_charge', 'buff', '🜲', 'Overcharge', 'Charges the body with lightning: the next impacts release bolts at nearby enemies', (f, s, P, col) => {
  const st = sx(f); st.overcharge = 3 + f.form; f.st.buff = Math.max(f.st.buff, 4); f.st.buffPow = Math.max(f.st.buffPow, 0.25);
  if (!FX.off) { FX.ring(f.x, f.y, col, f.r * 2.6, 0.4, 7, f.r); FX.sparks(f.x, f.y, '#ffffff', 20, 500); supSound(f, 'skill', 4); }
}, true);
SUP.onCollideDash = (a, b) => {   // Electric Dash: redirect to the next enemy after each hit
  const s = a.sx; if (!s || !(s.chainDash > 0) || !(a.st.dash > 0) || a.team === b.team) return;
  s.chainDash--;
  const nx = supEnemies(a).filter(e => e !== b).sort((x, y) => len(x.x - a.x, x.y - a.y) - len(y.x - a.x, y.y - a.y))[0];
  if (nx && s.chainDash > 0) { const ang = angTo(a, nx); a.vx = dcos(ang) * a.baseSpeed * 2.6; a.vy = dsin(ang) * a.baseSpeed * 2.6; a.st.dash = 0.6; if (!FX.off) FX.bolt(a.x, a.y, nx.x, nx.y, '#ffee58', 3, 0.25); }
};
function divineThunder(f, P, col, dmg, king) {
  darkArena(king ? 3.2 : 2.6, '#020414', 0.6); camPunch(ARENA.cx, ARENA.cy, 0.1, 2);
  const es = () => supEnemies(f);
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, king ? '⚡ RAGNAROK THUNDER ⚡' : '⚡ DIVINE THUNDER ⚡', '#ffee58', 44, { life: 2.4, vy: 0, pop: 2, stroke: '#0d1640' }); supSound(f, 'ult', king ? 2 : 0);
    vfx((ctx, q) => vThunderSigil(ctx, ARENA.cx, ARENA.cy, 220 + 40 * q, f.def.design.c3, Math.sin(Math.PI * q)), 2.6); }
  for (let i = 0; i < 12; i++) after(0.3 + i * 0.13, () => { const l = es(); if (!f.alive || !l.length) return; const e = l[i % l.length]; supStrike(f, e.x + rand(-30, 30), e.y + rand(-30, 30), 0.2, 70, dmg * 0.11, '#ffee58', { effect: 'stun', power: P }); });
  after(2.0, () => { const e = es()[0]; if (f.alive && e) { BATTLE.pillars.push({ x: e.x, w: 120, col: '#ffffff', life: 0.6, max: 0.6 }); dealDamage(f, e, dmg * 0.4, { kind: 'skill', tag: 'strike', effect: 'stun', power: P }); FX.addShake(18); FX.addFlash(0.3, '#ffffff'); } });
  if (king) {
    for (let i = 0; i < 30; i++) after(0.2 + i * 0.07, () => { if (f.alive) supStrike(f, ARENA.x + 60 + (i * 157) % (ARENA.w - 120), ARENA.y + 60 + (i * 97) % (ARENA.h - 120), 0.35, 75, dmg * 0.12, '#ffffff', { effect: 'stun', power: P }); });
    after(1.4, () => { const l = es(); for (let i = 0; i < l.length; i++) { const a = l[i], b = l[(i + 1) % l.length]; if (!FX.off) FX.bolt(a.x, a.y, b.x, b.y, '#ffee58', 6, 0.5); dealDamage(f, a, dmg * 0.2, { kind: 'skill', tag: 'strike', effect: 'stun', power: P }); } });
  }
}
UL('divinethunder', 'Divine Thunder — a thunder sigil fills the sky and bolts strike every enemy in rhythm', (f, P, col, dmg) => divineThunder(f, P, col, dmg, false));
UL('thunderking', 'Ragnarok Thunder — a thousand bolts across the whole arena and chain lightning between all enemies', (f, P, col, dmg) => divineThunder(f, P, col, dmg, true));
supBall(B('thundergod', 'Thunder God Ball', 'Admin', 'Admin Exclusive', [138, 104, 86, 100, 80], D('#0d1640', '#ffee58', '#40c4ff', 'thundergod', ['orbit'], '', { glow: 1.7, sdeco: ['boltcrown'] }),
  [S('LIGHTNING CLONES', 'tg_clones', 8, 75, '#ffee58'), S('THUNDER RAIN', 'tg_rain', 7, 75, '#fff59d'), S('ELECTRIC DASH', 'tg_dash', 6, 80, '#40c4ff'), S('THUNDER CAGE', 'tg_cage', 11, 70, '#ffee58'), S('OVERCHARGE', 'tg_charge', 12, 60, '#ffffff')],
  U('DIVINE THUNDER', 'divinethunder', 135, '#ffee58', 'stun'), 'aggressive', { desc: 'SUPREME ADMIN. A storm in a sphere, crowned with lightning — fast, shocking and merciless.' }), {
  forms: [{ name: 'THUNDER GOD' }, { name: 'STORM SOVEREIGN', design: { c2: '#ffffff', c3: '#00e5ff', glow: 1.9 } }, { name: 'DIVINE THUNDER KING', design: { c1: '#1a1200', c2: '#ffd54f', c3: '#ffffff', glow: 2.3 } }],
  finalUlt: U('RAGNAROK THUNDER', 'thunderking', 155, '#ffffff', 'stun'), sound: { base: 440, wave: 'square', slide: 0.3, noise: 4200 },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.3) FX.sparks(f.x + vr(-f.r, f.r), f.y + vr(-f.r, f.r), d.c2, 1, 260); },
    bounce: (f, x, y, d) => FX.bolt(f.x, f.y, x, y, d.c2, 3, 0.15),
    victory: (f, d) => { for (let i = 0; i < 5; i++) FX.bolt(f.x + vr(-80, 80), ARENA.y, f.x, f.y - f.r, d.c2, 5, 0.6); FX.text(f.x, f.y - f.r - 60, 'THE STORM OBEYS', d.c2, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.sparks(f.x, f.y, d.c2, 40, 700); FX.burst(f.x, f.y, d.c3, 40, 500, 5, 0.8); },
    entrance: f => { for (let i = 0; i < 8; i++) FX.bolt(ARENA.x + ARENA.w * Math.random(), ARENA.y, f.x, f.y, '#ffffff', 5, 0.6); },
  },
});

/* =================== 5. ARCHANGEL (upgraded) =================== */
SK('aa_laser', 'ranged', '⇩', 'Holy Laser', 'A beam of holy light falls from the sky and follows the target', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  addLaser(f, [t.x, ARENA.y, t.x, ARENA.b], { charge: 0.45, dur: 1.4 + f.form * 0.4, w: 26, dmg: SD(f, P) * 0.32, col });
  BATTLE.lasers[BATTLE.lasers.length - 1].track = { tgt: t, sp: 260 };
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('aa_shield', 'defense', '⛨', 'Divine Shield', 'A golden dome destroys every enemy projectile that enters it and heals the angel for each one', (f, s, P, col) => {
  const life = 2.5 + P / 60;
  supZone(f, { kind: 'custom', custom: true, follow: f, x: f.x, y: f.y, r: f.r + 70, life, col, domeOf: f, draw: (ctx, z, t) => { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, z.r * 0.5, 0, 0, z.r); g.addColorStop(0, 'rgba(255,213,79,0)'); g.addColorStop(1, 'rgba(255,213,79,.35)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,248,225,.8)'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * TAU + t; ctx.lineTo(Math.cos(a) * z.r, Math.sin(a) * z.r); } ctx.stroke(); } });
  if (!FX.off) supSound(f, 'skill', 1);
}, true);
SK('aa_feathers', 'ranged', '🪶', 'Six-Wing Barrage', 'All six wings fire volleys of homing feathers', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  for (let w = 0; w < 6; w++) for (let k = 0; k < 3; k++) after(k * 0.12 + w * 0.03, () => {
    if (!f.alive) return; const a = angTo(f, t) + Math.PI + (w - 2.5) * 0.5, x = f.x + dcos(a) * f.r * 1.4, y = f.y + dsin(a) * f.r * 1.4;
    supShot(f, x, y, angTo({ x, y }, t) + rand(-0.2, 0.2), { speed: 560, r: 7, dmg: SD(f, P) * 0.09, col, style: 'feather', homing: 2.6, target: t, life: 2.4, power: P });
  });
  if (!FX.off) supSound(f, 'skill', 2);
});
SK('aa_heal', 'heal', '✚', 'Heavenly Healing', 'Heavenly light heals over a few seconds, removes bad effects and heals allies too', (f, s, P) => {
  if (f.hpRatio > 0.95) return false;
  f.st.burn = f.st.poison = f.st.slow = f.st.weaken = f.st.freeze = 0; f.poisonStacks = 0;
  for (let k = 0; k < 8; k++) after(k * 0.5, () => { if (f.alive) healFighter(f, f.maxHp * (0.025 + P / 4000), k > 0); });
  for (const a of BATTLE.fighters) if (a.alive && a.team === f.team && a !== f && !a.isClone) healFighter(a, a.maxHp * 0.15);
  if (!FX.off) { BATTLE.pillars.push({ x: f.x, w: 70, col: '#fff59d', life: 0.8, max: 0.8 }); supSound(f, 'skill', 3); }
}, true);
SK('aa_halo', 'ranged', '◯', 'Judgment Halo', 'Throws the halo like a disc: it flies out, cutting through enemies, and comes back', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  supShot(f, f.x, f.y, angTo(f, t), { speed: 640, r: 18, dmg: SD(f, P) * 0.4, col, style: 'halo', life: 2.2, pierce: 6, power: P, data: { t: 0 },
    tick: (p, h) => { p.data.t += h; if (p.data.t > 0.55) { if (!p.data.back) { p.data.back = true; if (p.hits) p.hits.clear(); } const a = datan2(f.y - p.y, f.x - p.x); p.vx = dcos(a) * 720; p.vy = dsin(a) * 720; if (len(f.x - p.x, f.y - p.y) < f.r) p.life = 0; } } });
  if (!FX.off) supSound(f, 'skill', 4);
});
function heavensJudgment(f, P, col, dmg) {
  darkArena(2.6, '#fff8e1', 0.18); camPunch(ARENA.cx, ARENA.cy, 0.08, 2.2);
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, "✝ HEAVEN'S JUDGMENT ✝", '#ffd54f', 44, { life: 2.4, vy: 0, pop: 2, stroke: '#4a2a00' }); supSound(f, 'ult');
    vfx((ctx, q) => vHeavenGate(ctx, ARENA.cx, ARENA.y + 8, 260, Math.sin(Math.PI * q)), 2.8); }
  for (let i = 0; i < 5; i++) after(0.4 + i * 0.22, () => {
    if (!f.alive) return; const fromLeft = i % 2 === 0, x = fromLeft ? ARENA.x + 20 : ARENA.r - 20;
    addLaser(f, [x, ARENA.y, x, ARENA.b], { charge: 0.3, dur: 1.6, w: 60, dmg: dmg * 0.16, col: '#fff59d' });
    BATTLE.lasers[BATTLE.lasers.length - 1].sweepX = { v: fromLeft ? 700 : -700 };
  });
}
UL('heavensjudgment', "Heaven's Judgment — the gate of heaven opens and giant pillars of light sweep the arena", heavensJudgment);
UL('creationlight', 'Light of Creation — the arena turns white: enemies are judged, allies are healed and cleansed', (f, P, col, dmg) => {
  FX.addFlash(0.45, '#ffffff'); darkArena(2.4, '#ffffff', 0.45); camPunch(f.x, f.y, 0.2, 1.8);
  heavensJudgment(f, P * 0.6, col, dmg * 0.6);
  after(0.6, () => { if (!f.alive) return; for (const e of supEnemies(f)) dealDamage(f, e, dmg * 0.75, { kind: 'skill', tag: 'explosion', effect: 'weaken', power: P });
    for (const a of BATTLE.fighters) if (a.alive && a.team === f.team && !a.isClone) { healFighter(a, a.maxHp * 0.3); a.st.burn = a.st.poison = a.st.slow = a.st.weaken = a.st.stun = 0; }
    f.st.invuln = Math.max(f.st.invuln, 1.5); });
  if (!FX.off) { FX.text(ARENA.cx, ARENA.cy - 40, 'LIGHT OF CREATION', '#ffffff', 50, { life: 2.4, vy: 0, pop: 2, stroke: '#4a2a00' }); supSound(f, 'ult', 2); for (let i = 0; i < 6; i++) FX.ring(f.x, f.y, i % 2 ? '#ffd54f' : '#ffffff', 300 + i * 120, 0.8 + i * 0.1, 12, f.r); }
});
supBall(B('archangel', 'Archangel Ball', 'Admin', 'Admin Exclusive', [142, 94, 104, 90, 80], D('#fff8e1', '#ffc107', '#ffd54f', 'holy', ['sixwings', 'crown', 'halo'], '', { glow: 1.6 }),
  [S('HOLY LASER', 'aa_laser', 7, 80, '#fff59d'), S('DIVINE SHIELD', 'aa_shield', 11, 75, '#ffd54f'), S('SIX-WING BARRAGE', 'aa_feathers', 8, 75, '#fffde7'), S('HEAVENLY HEALING', 'aa_heal', 14, 70, '#a7ffeb'), S('JUDGMENT HALO', 'aa_halo', 6, 70, '#ffd54f')],
  U("HEAVEN'S JUDGMENT", 'heavensjudgment', 135, '#ffd54f'), 'intelligent', { desc: 'SUPREME ADMIN. A golden-white sphere with six wings, a crown and a halo — light given form.' }), {
  forms: [{ name: 'ARCHANGEL' }, { name: 'SERAPHIC ARCHANGEL', design: { c2: '#ff80ab', c3: '#ffffff', glow: 1.9 } }, { name: 'ARCHANGEL OF CREATION', design: { c1: '#ffffff', c2: '#ffd700', c3: '#fff59d', glow: 2.4 } }],
  finalUlt: U('LIGHT OF CREATION', 'creationlight', 155, '#ffffff'), sound: { base: 523, wave: 'sine', slide: 1.5, noise: 0 },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.4) FX.p(f.x + vr(-f.r, f.r) * 1.5, f.y + f.r * 0.5, vr(-15, 15), vr(30, 60), 1.0, vr(3, 5), '#fffde7', 'shard', 0.4); },
    bounce: (f, x, y) => FX.ring(x, y, '#fff59d', 80, 0.35, 4, 8),
    victory: f => { BATTLE.pillars.push({ x: f.x, w: 90, col: '#fff59d', life: 1.5, max: 1.5 }); FX.text(f.x, f.y - f.r - 70, 'HEAVEN PREVAILS', '#ffd54f', 22, { life: 1.8 }); },
    defeat: f => { for (let i = 0; i < 30; i++) FX.p(f.x + vr(-40, 40), f.y + vr(-30, 30), vr(-60, 60), vr(20, 90), 1.6, vr(3, 5), '#fffde7', 'shard', 0.3); },
    entrance: f => BATTLE.pillars.push({ x: f.x, w: 160, col: '#ffffff', life: 1.2, max: 1.2 }),
  },
});
/* =================== 6. DEMON LORD =================== */
const DEMON_IMP = UNITB('u_imp', 'Demon Imp', [60, 70, 45, 92, 12], D('#3e0000', '#ff3d00', '#ff6e40', 'demonlord', ['horns'], '', { glow: 1.3 }));
SK('dl_hellfire', 'ranged', '🔥', 'Hellfire', 'Pillars of hellfire erupt one after another in a line toward the target', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const a = angTo(f, t), n = 6 + f.form;
  for (let i = 0; i < n; i++) after(0.08 + i * 0.1, () => {
    if (!f.alive) return; const x = inArenaX(f.x + dcos(a) * (80 + i * 75), 30), y = inArenaY(f.y + dsin(a) * (80 + i * 75), 30);
    supBlast(f, x, y, 62, SD(f, P) * 0.28, { effect: 'burn', power: P, tag: 'strike' });
    if (!FX.off) { BATTLE.pillars.push({ x, w: 40, col: '#ff3d00', life: 0.35, max: 0.35 }); FX.burst(x, y, '#ff6d00', 14, 260, 6, 0.5); }
  });
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('dl_summon', 'summon', '⛧', 'Demon Summoning', 'A burning pentagram opens and demon imps climb out to throw fireballs', (f, s, P, col) => {
  if (supMinions(f) >= SUP.MINION_MAX) return false;
  const n = Math.min(SUP.MINION_MAX - supMinions(f), 2 + (f.form >= 2 ? 1 : 0)), cx = f.x, cy = f.y;
  if (!FX.off) vfx((ctx, q) => vPentagram(ctx, cx, cy, 90, '#ff3d00', 1 - q), 1.2);
  for (let i = 0; i < n; i++) after(0.3 + i * 0.2, () => supMinion(f, DEMON_IMP, cx + (i - 0.5) * 70, cy + 20, { P, life: 8 + P / 30, hp: 0.07,
    shot: { cd: 1.5, range: 460, fire: (m, t) => supShot(m, m.x, m.y, aimAngle(m, t, 480), { speed: 480, r: 8, dmg: SD(f, P) * 0.15, col: '#ff6d00', effect: 'burn', style: 'fireball2', power: P }) } }));
  if (!FX.off) supSound(f, 'skill', 1);
}, true);
SK('dl_chains', 'control', '⛓', 'Infernal Chains', 'Burning chains hook the target and drag it toward the Demon Lord', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  const es = sx(e); es.pullTo = f; es.pullT = e.boss ? 0.5 : 1.1; applyEffect(f, e, 'burn', P);
  dealDamage(f, e, SD(f, P) * 0.3, { kind: 'skill', tag: 'skill', power: P });
  if (!FX.off) { vfx((ctx, q) => { if (!e.alive) return; ctx.save(); ctx.strokeStyle = '#ff6d00'; ctx.lineWidth = 4; ctx.setLineDash([12, 6]); ctx.lineDashOffset = q * 80; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore(); }, es.pullT); supSound(f, 'skill', 2); }
});
SK('dl_bomb', 'control', '✸', 'Dark Explosion', 'Plants a seed of darkness on the target that detonates a moment later', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  if (!FX.off) vfx((ctx, q) => { if (!e.alive) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = 10 + 30 * q; ctx.drawImage(glowSprite('#d50000'), e.x - r * 2, e.y - r * 2, r * 4, r * 4); ctx.restore(); }, 1.2);
  after(1.2, () => { if (!f.alive || !e.alive) return; supBlast(f, e.x, e.y, 170 + f.form * 30, SD(f, P) * 0.95, { effect: 'burn', force: 650, power: P }); darkBurst(e.x, e.y, 180, 0.8); if (!FX.off) { FX.addShake(12); Sound.play('boom'); FX.ring(e.x, e.y, '#ff1744', 200, 0.5, 12, 20); } });
  if (!FX.off) supSound(f, 'skill', 3);
});
SK('dl_feast', 'heal', '♨', 'Soul Feast', 'Feeds on every burning enemy: heals from their flames and makes them burn hotter', (f, s, P) => {
  const burning = supEnemies(f).filter(e => e.st.burn > 0);
  if (!burning.length) return false;
  for (const e of burning) { dealDamage(f, e, SD(f, P) * 0.3, { kind: 'skill', tag: 'skill', power: P }); e.burnDps = Math.min(e.burnDps * 1.3, 6); healFighter(f, f.maxHp * 0.05); if (!FX.off) FX.bolt(e.x, e.y, f.x, f.y, '#ff3d00', 3, 0.4); }
  if (!FX.off) supSound(f, 'skill', 4);
}, true);
function hellsGate(f, P, col, dmg, king) {
  const cx = ARENA.cx, cy = ARENA.cy; darkArena(3.6, '#1a0000', 0.55); camPunch(cx, cy, 0.12, 2.4);
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, king ? '⛧ THRONE OF HELL ⛧' : "⛧ HELL'S GATE ⛧", '#ff3d00', 44, { life: 2.6, vy: 0, pop: 2, stroke: '#1a0000' }); supSound(f, 'ult', king ? 2 : 0);
    vfx((ctx, q) => vHellGate(ctx, cx, cy, 170, Math.min(1, q * 3) * (q > 0.85 ? (1 - q) * 6.6 : 1)), 3.6); }
  supZone(f, { kind: 'gravity', x: cx, y: cy, r: 420, life: 3, col: '#ff3d00', pull: 900, dmg: dmg * 0.06, effect: 'burn', power: P });
  for (let i = 0; i < 10; i++) after(0.4 + i * 0.25, () => { if (f.alive) { const a = i * 2.4; supShot(f, cx, cy, a, { speed: 420, r: 12, dmg: dmg * 0.08, col: '#ff6d00', style: 'fireball2', effect: 'burn', homing: 2.5, target: nearestEnemy(f), power: P, life: 3 }); } });
  after(0.8, () => { for (let i = 0; i < 2; i++) supMinion(f, DEMON_IMP, cx + (i ? 60 : -60), cy, { P, life: 7, hp: 0.06 }); });
  after(3.1, () => { if (!f.alive) return; supBlast(f, cx, cy, 460, dmg * 0.55, { effect: 'burn', force: 800, power: P }); if (!FX.off) { FX.addFlash(0.3, '#ff3d00'); FX.addShake(20); for (let i = 0; i < 3; i++) FX.ring(cx, cy, '#ff3d00', 300 + i * 150, 0.7, 14, 30); } });
  if (king) { BATTLE.cond = { kind: 'inferno', team: f.team, by: f, t: 7 }; for (let i = 0; i < 6; i++) after(0.5 + i * 0.35, () => { const e = supEnemies(f)[i % Math.max(1, supEnemies(f).length)]; if (f.alive && e) supStrike(f, e.x, e.y, 0.5, 80, dmg * 0.14, '#ff3d00', { kind: 'meteor', effect: 'burn' }); }); }
}
UL('hellsgate', "Hell's Gate — a giant gate opens in the arena, drags enemies in, spits fire and demons, then slams shut", (f, P, col, dmg) => hellsGate(f, P, col, dmg, false));
UL('thronehell', 'Throne of Hell — the gate opens, the whole floor turns to lava and hellfire meteors fall', (f, P, col, dmg) => hellsGate(f, P, col, dmg, true));
supBall(B('demonlord', 'Demon Lord Ball', 'Admin', 'Admin Exclusive', [150, 106, 90, 86, 76], D('#1a0000', '#ff3d00', '#ff1744', 'demonlord', ['horns', 'batwings'], '', { glow: 1.7, sdeco: ['hellfire'] }),
  [S('HELLFIRE', 'dl_hellfire', 6, 75, '#ff3d00', 'burn'), S('DEMON SUMMONING', 'dl_summon', 13, 70, '#ff6e40'), S('INFERNAL CHAINS', 'dl_chains', 9, 70, '#ff6d00', 'burn'), S('DARK EXPLOSION', 'dl_bomb', 8, 85, '#d50000'), S('SOUL FEAST', 'dl_feast', 11, 70, '#ff3d00')],
  U("HELL'S GATE", 'hellsgate', 135, '#ff3d00', 'burn'), 'aggressive', { desc: 'SUPREME ADMIN. A horned, bat-winged sphere of molten hellfire that commands demons.' }), {
  forms: [{ name: 'DEMON LORD' }, { name: 'ARCHDEMON', design: { c2: '#ff9100', c3: '#ffd600', glow: 1.9 } }, { name: 'KING OF HELL', design: { c1: '#000000', c2: '#ff1744', c3: '#ff3d00', glow: 2.3 } }],
  finalUlt: U('THRONE OF HELL', 'thronehell', 155, '#ff1744', 'burn'), sound: { base: 73, wave: 'sawtooth', slide: 0.7, noise: 600 },
  fx: {
    idle: (f, d) => FX.p(f.x + vr(-f.r, f.r) * 0.7, f.y + vr(-f.r, f.r) * 0.4, vr(-10, 10), vr(-120, -70), 0.5, vr(3, 6), Math.random() < 0.5 ? '#ff3d00' : '#ffab00'),
    bounce: (f, x, y) => FX.burst(x, y, '#ff6d00', 10, 220, 5, 0.4),
    victory: (f, d) => { vfx((ctx, q) => vPentagram(ctx, f.x, f.y, f.r * 2.4, '#ff3d00', 1 - q * 0.6), 1.8); FX.text(f.x, f.y - f.r - 60, 'KNEEL BEFORE HELL', '#ff3d00', 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, '#ff3d00', 60, 500, 7, 1.0); FX.burst(f.x, f.y, '#000000', 30, 300, 8, 1.0, 'smoke'); },
    entrance: f => { BATTLE.cond = { kind: 'inferno', team: f.team, by: f, t: 3 }; },
  },
});

/* =================== 7. GLITCH 404 =================== */
SK('gl_corrupt', 'ranged', '▒', 'Digital Corruption', 'A pixel beam corrupts the target: it twitches in random directions and loses HP over time', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  supShot(f, f.x, f.y, aimAngle(f, t, 700), { speed: 700, r: 10, dmg: SD(f, P) * 0.4, col, style: 'pixel', power: P, onHit: (p, e) => {
    const es = sx(e); es.corruptT = 3 + f.form; applyEffect(f, e, 'poison', P);
    for (let k = 0; k < 6; k++) after(k * 0.4, () => { if (e.alive) { const a = rand(TAU); e.vx += dcos(a) * 380; e.vy += dsin(a) * 380; if (!FX.off) FX.burst(e.x, e.y, Math.random() < 0.5 ? '#00ff41' : '#ff00e6', 6, 160, 4, 0.3, 'shard'); } });
  } });
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('gl_clone', 'summon', '⧉', 'Error Clone', 'Two glitched copies of the enemy appear and run around; touching them makes them explode', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  for (let i = 0; i < 2; i++) {
    const m = supMinion(f, e.baseDef || e.def, e.x + (i ? 120 : -120), e.y + 40, { P, life: 6, hp: 0.04, statMul: 0.3, rScale: e.r / BASE_R * 0.9, onDeath: x => supBlast(f, x.x, x.y, 130, SD(f, P) * 0.55, { tag: 'explosion', force: 500 }) });
    if (m) { m.glitchy = true; m.decoy = true; }
  }
  if (!FX.off) supSound(f, 'skill', 1);
});
SK('gl_tp', 'mobility', '⌁', 'Glitch Teleport', 'Teleports three times in a stutter, leaving a damaging burst of pixels at each spot', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt);
  for (let k = 0; k < 3; k++) after(k * 0.12, () => {
    if (!f.alive) return; const ox = f.x, oy = f.y, a = t ? angTo(f, t) + rand(-1.2, 1.2) : rand(TAU);
    f.x = inArenaX(f.x + dcos(a) * 150, f.r + 10); f.y = inArenaY(f.y + dsin(a) * 150, f.r + 10);
    supBlast(f, ox, oy, 80, SD(f, P) * 0.22, { tag: 'explosion' });
    if (!FX.off) { FX.burst(ox, oy, Math.random() < 0.5 ? '#00ff41' : '#ff00e6', 16, 260, 5, 0.4, 'shard'); portalGhost(f, ox, oy, f.x, f.y, 0.1, 'out'); }
  });
  if (!FX.off) supSound(f, 'skill', 2);
}, true);
SK('gl_distort', 'control', '≋', 'System Distortion', 'A lag field: enemies inside stutter in place and their cooldowns run slower', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  supZone(f, { kind: 'custom', custom: true, x: inArenaX(t.x, 80), y: inArenaY(t.y, 80), r: 170 + f.form * 20, life: 4 + P / 60, col,
    onTick: (z, e, d, h) => { if (d < z.r + e.r) { const es = sx(e); es.lagT = Math.max(es.lagT || 0, 0.3); for (const k of e.allSkills()) if (k.cdLeft > 0) k.cdLeft += h * 0.5; } },
    draw: (ctx, z, t2) => { ctx.strokeStyle = 'rgba(0,255,65,.55)'; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { const y = -z.r + (i + 0.5) * z.r * 2 / 9, o = Math.sin(t2 * 13 + i * 2) * 12; ctx.strokeRect(-z.r + o, y - 6, z.r * 2 * (0.4 + 0.6 * ((i * 37) % 10) / 10), 12); } ctx.strokeStyle = 'rgba(255,0,230,.5)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.stroke(); } });
  if (!FX.off) supSound(f, 'skill', 3);
});
SK('gl_packet', 'defense', '⊘', 'Packet Loss', 'For a few seconds, half of the enemy projectiles near Glitch 404 are dropped as lost packets', (f, s, P) => {
  const st = sx(f); st.packetT = 4 + P / 60;
  if (!FX.off) { FX.ring(f.x, f.y, '#00ff41', f.r * 2.4, 0.4, 6, f.r); supSound(f, 'skill', 4); }
}, true);
function systemCrash(f, P, col, dmg, panic) {
  camPunch(ARENA.cx, ARENA.cy, 0.1, 1.6); FX.addFlash(0.3, '#2979ff');
  if (!FX.off) { supSound(f, 'ult', panic ? 2 : 0); vfx((ctx, q) => vBlueScreen(ctx, panic, q), panic ? 2.2 : 1.6); }
  for (const e of supEnemies(f)) { e.st.stun = Math.max(e.st.stun, e.boss ? 0.6 : 1.5); for (const k of e.allSkills()) k.cdLeft = Math.max(k.cdLeft, k.cd || 6); dealDamage(f, e, dmg * 0.55, { kind: 'skill', tag: 'skill', effect: 'random', power: P }); }
  if (panic) after(1.0, () => {
    if (!f.alive) return;
    for (const e of supEnemies(f)) { e.x = inArenaX(ARENA.x + 80 + RNG() * (ARENA.w - 160), e.r); e.y = inArenaY(ARENA.y + 80 + RNG() * (ARENA.h - 160), e.r); e.ultMeter = 0; dealDamage(f, e, dmg * 0.55, { kind: 'skill', tag: 'skill', power: P }); if (!FX.off) FX.burst(e.x, e.y, '#00ff41', 20, 300, 5, 0.5, 'shard'); }
    FX.addShake(16);
  });
}
UL('systemcrash', 'System Crash — the screen blue-screens: every enemy freezes, its cooldowns reset and corruption hits', (f, P, col, dmg) => systemCrash(f, P, col, dmg, false));
UL('kernelpanic', 'Kernel Panic — the arena reboots: enemies are scrambled to random spots and lose their ultimate charge', (f, P, col, dmg) => systemCrash(f, P, col, dmg, true));
supBall(B('glitch404', 'Glitch 404 Ball', 'Admin', 'Admin Exclusive', [132, 100, 84, 104, 85], D('#000000', '#00ff41', '#ff00e6', 'g404', [], '', { glow: 1.6, sdeco: ['errorpopups'] }),
  [S('DIGITAL CORRUPTION', 'gl_corrupt', 6, 75, '#00ff41', 'poison'), S('ERROR CLONE', 'gl_clone', 12, 75, '#ff00e6'), S('GLITCH TELEPORT', 'gl_tp', 6, 65, '#00ff41'), S('SYSTEM DISTORTION', 'gl_distort', 11, 65, '#00ff41'), S('PACKET LOSS', 'gl_packet', 12, 60, '#ff00e6')],
  U('SYSTEM CRASH', 'systemcrash', 135, '#2979ff', 'random'), 'adaptive', { desc: 'SUPREME ADMIN. ERROR 404: BALL NOT FOUND. A sphere of corrupted code that breaks the rules of the arena.' }), {
  forms: [{ name: 'GLITCH 404' }, { name: 'FATAL EXCEPTION', design: { c2: '#ff1744', c3: '#00e5ff', glow: 1.9 } }, { name: 'KERNEL PANIC GOD', design: { c1: '#0d47a1', c2: '#ffffff', c3: '#00ff41', glow: 2.3 } }],
  finalUlt: U('KERNEL PANIC', 'kernelpanic', 155, '#ffffff', 'random'), sound: { base: 260, wave: 'square', slide: 3.5, noise: 7000 },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.5) FX.p(f.x + vr(-f.r, f.r) * 1.3, f.y + vr(-f.r, f.r) * 1.3, 0, 0, 0.25, vr(3, 7), Math.random() < 0.5 ? d.c2 : d.c3, 'shard', 0); },
    bounce: (f, x, y, d) => FX.burst(x, y, d.c2, 8, 200, 5, 0.3, 'shard'),
    victory: f => { vfx((ctx, q) => vErrorWindow(ctx, f.x - 90, f.y - f.r - 120, 'TASK COMPLETE', 'Enemy.exe has stopped working', 1 - q * 0.6), 1.8); },
    defeat: (f, d) => { FX.burst(f.x, f.y, d.c2, 50, 500, 6, 1.0, 'shard'); vfx((ctx, q) => vErrorWindow(ctx, f.x - 90, f.y - 60, 'ERROR 404', 'Ball not found', 1 - q), 1.5); },
    entrance: () => vfx((ctx, q) => vBlueScreen(ctx, true, q * 0.5), 0.9),
  },
});

/* =================== 8. DRAGON EMPEROR =================== */
SK('de_breath', 'melee', '🐉', 'Dragon Breath', 'A cone of dragon fire pours out in front for a moment, burning everything in it', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const ticks = 8;
  for (let k = 0; k < ticks; k++) after(k * 0.12, () => {
    if (!f.alive) return; const tt = supTarget(f, t), a = tt ? angTo(f, tt) : 0, reach = 300 + f.form * 40;
    for (const e of supEnemies(f)) { const da = Math.abs(((datan2(e.y - f.y, e.x - f.x) - a + Math.PI * 3) % TAU) - Math.PI), d = len(e.x - f.x, e.y - f.y); if (da < 0.45 && d < reach + e.r) dealDamage(f, e, SD(f, P) * 0.11, { kind: 'skill', tag: 'projectile', effect: 'burn', power: P, noCrit: true }); }
    if (!FX.off) for (let i = 0; i < 10; i++) { const aa = a + vr(-0.4, 0.4), sp = vr(300, 600); FX.p(f.x + Math.cos(aa) * f.r, f.y + Math.sin(aa) * f.r, Math.cos(aa) * sp, Math.sin(aa) * sp, 0.5, vr(6, 11), Math.random() < 0.5 ? '#ff6d00' : '#ffd54f', 'dot', 1); }
  });
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('de_spirit', 'ranged', '〰', 'Dragon Spirit', 'A spectral dragon serpent flies a winding path through the target, hitting everything it crosses', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const a0 = angTo(f, t), n = 7;
  for (let i = 0; i < n; i++) after(i * 0.05, () => { if (f.alive) supShot(f, f.x, f.y, a0, { speed: 520, r: i ? 11 : 16, dmg: SD(f, P) * 0.13, col, style: i ? 'spirit' : 'spirithead', life: 2.2, pierce: 4, power: P, data: { t: 0, a0 },
    tick: (p, h) => { p.data.t += h; const a = p.data.a0 + Math.sin(p.data.t * 7) * 0.9; p.vx = dcos(a) * 520; p.vy = dsin(a) * 520; } }); });
  if (!FX.off) supSound(f, 'skill', 1);
});
SK('de_meteor', 'aoe', '☄', 'Meteor Strike', 'One giant meteor crashes onto the target and leaves burning ground behind', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const p = predictPos(f, t, 0.9);
  supStrike(f, p.x, p.y, 0.9, 120 + f.form * 15, SD(f, P) * 1.0, '#ff6d00', { kind: 'meteor', effect: 'burn', power: P });
  after(0.9, () => { if (f.alive) supZone(f, { kind: 'trap', x: p.x, y: p.y, r: 110, life: 3, col: '#ff3d00', effect: 'burn', power: P, dmg: SD(f, P) * 0.08, style: 'burn' }); });
  if (!FX.off) supSound(f, 'skill', 2);
});
SK('de_claw', 'melee', '⟋', 'Dragon Claw', 'Three huge claw slashes in front that tear and weaken', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  for (let k = 0; k < 3; k++) after(k * 0.15, () => {
    if (!f.alive) return; const a = angTo(f, supTarget(f, t) || t), cx = f.x + dcos(a) * (f.r + 60), cy = f.y + dsin(a) * (f.r + 60);
    supBlast(f, cx, cy, 90, SD(f, P) * 0.33, { effect: 'weaken', force: 300, power: P, tag: 'collision' });
    if (!FX.off) vfx((ctx, q) => vClaw(ctx, cx, cy, 80, a + (k - 1) * 0.4, '#ffd54f', 1 - q), 0.35);
  });
  if (!FX.off) supSound(f, 'skill', 3);
});
SK('de_scales', 'defense', '⛊', 'Dragon Scales', 'Hardened scales: immune to burning, and 25% of impact damage is returned to the attacker', (f, s, P) => {
  const st = sx(f); st.scalesT = 5 + P / 60; f.st.burn = 0; f.st.shield = Math.max(f.st.shield, 1.5); f.st.shieldPow = Math.max(f.st.shieldPow, 0.35);
  if (!FX.off) { FX.ring(f.x, f.y, '#ffd54f', f.r * 2.2, 0.5, 7, f.r); supSound(f, 'skill', 4); }
}, true);
function dragonRage(f, P, col, dmg, god) {
  darkArena(3, '#200000', 0.45); camPunch(f.x, f.y, 0.14, 2.4);
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, god ? '🐉 ETERNAL DRAGON GOD 🐉' : '🐉 ETERNAL DRAGON RAGE 🐉', '#ffd54f', 42, { life: 2.6, vy: 0, pop: 2, stroke: '#3e0000' }); supSound(f, 'ult', god ? 2 : 0);
    vfx((ctx, q) => vDragonHead(ctx, ARENA.cx, ARENA.y + 150, 120, god ? '#ffd54f' : '#ff3d00', Math.sin(Math.PI * q), q), 2.6); }
  for (let i = 0; i < 16; i++) after(0.5 + i * 0.12, () => { if (!f.alive) return; const es = supEnemies(f), e = es[i % Math.max(1, es.length)]; const x = e ? e.x + rand(-140, 140) : ARENA.x + RNG() * ARENA.w; supStrike(f, x, e ? e.y + rand(-100, 100) : ARENA.cy, 0.5, 70, dmg * 0.09, '#ff6d00', { kind: 'meteor', effect: 'burn', power: P }); });
  for (let k = 0; k < 3; k++) after(0.4 + k * 0.6, () => { const t = nearestEnemy(f); if (f.alive && t) SKILL_FN.de_spirit(f, { power: P }, P * 0.8, '#ffd54f', t); });
  if (god) after(2.4, () => {
    const t = nearestEnemy(f); if (!f.alive || !t) return;
    for (let i = 0; i < 24; i++) supShot(f, ARENA.cx + Math.cos(i / 24 * TAU) * 520, ARENA.cy + Math.sin(i / 24 * TAU) * 260, 0, { speed: 0, r: 14, dmg: dmg * 0.02, col: '#ffd54f', style: 'spirit', life: 0.6 + i * 0.03, power: P });
    after(0.8, () => { if (f.alive && t.alive) { supBlast(f, t.x, t.y, 260, dmg * 0.7, { effect: 'burn', force: 900, power: P }); if (!FX.off) { FX.addFlash(0.35, '#ffd54f'); FX.addShake(22); FX.burst(t.x, t.y, '#ffd54f', 90, 800, 8, 1.1); } } });
  });
}
UL('dragonrage', 'Eternal Dragon Rage — a roaring dragon fills the sky, meteors rain and dragon spirits hunt', (f, P, col, dmg) => dragonRage(f, P, col, dmg, false));
UL('dragongod', 'Eternal Dragon God — the dragon rage, then a golden dragon circles the arena and dives onto the target', (f, P, col, dmg) => dragonRage(f, P, col, dmg, true));
supBall(B('dragonemperor', 'Dragon Emperor Ball', 'Admin', 'Admin Exclusive', [158, 108, 96, 82, 74], D('#3e0000', '#ffd54f', '#ff6d00', 'dragonemp', ['horns', 'wings'], '', { glow: 1.7, sdeco: ['dragoneye'] }),
  [S('DRAGON BREATH', 'de_breath', 7, 80, '#ff6d00', 'burn'), S('DRAGON SPIRIT', 'de_spirit', 8, 75, '#ffd54f'), S('METEOR STRIKE', 'de_meteor', 10, 85, '#ff3d00', 'burn'), S('DRAGON CLAW', 'de_claw', 5, 80, '#ffd54f', 'weaken'), S('DRAGON SCALES', 'de_scales', 12, 65, '#ffd54f')],
  U('ETERNAL DRAGON RAGE', 'dragonrage', 135, '#ff6d00', 'burn'), 'aggressive', { desc: 'SUPREME ADMIN. The emperor of all dragons — golden scales, burning breath and a roar that shakes the arena.' }), {
  forms: [{ name: 'DRAGON EMPEROR' }, { name: 'ANCIENT WYRM', design: { c1: '#0d2a1a', c2: '#76ff03', c3: '#ffd54f', glow: 1.9 } }, { name: 'ETERNAL DRAGON GOD', design: { c1: '#3a2a00', c2: '#ffffff', c3: '#ffd54f', glow: 2.4 } }],
  finalUlt: U('ETERNAL DRAGON GOD', 'dragongod', 155, '#ffd54f', 'burn'), sound: { base: 82, wave: 'sawtooth', slide: 1.8, noise: 300 },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.4) FX.p(f.x + vr(-f.r, f.r), f.y + vr(-f.r, f.r) * 0.5, vr(-20, 20), vr(-80, -40), 0.6, vr(2, 4), d.c2, 'spark', 1); },
    bounce: (f, x, y, d) => FX.burst(x, y, d.c3, 10, 240, 5, 0.4),
    victory: (f, d) => { vfx((ctx, q) => vDragonHead(ctx, f.x, f.y - f.r - 90, 60, d.c2, 1 - q * 0.6, q), 1.8); FX.text(f.x, f.y - f.r - 170, 'THE DRAGON REIGNS', d.c2, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, d.c3, 60, 520, 8, 1.1); FX.burst(f.x, f.y, d.c2, 30, 400, 6, 1.0, 'shard'); },
    entrance: f => vfx((ctx, q) => vDragonHead(ctx, ARENA.cx, ARENA.cy, 200, '#ffd54f', Math.sin(Math.PI * q), q), 1.4),
  },
});

/* =================== 9. BLOOD MOON GOD =================== */
SK('bm_spikes', 'aoe', '✷', 'Crimson Explosion', 'Blood spikes burst out in every direction; each hit heals the Blood Moon', (f, s, P, col) => {
  const n = 12 + f.form * 4;
  for (let i = 0; i < n; i++) supShot(f, f.x, f.y, i / n * TAU, { speed: 640, r: 7, dmg: SD(f, P) * 0.12, col, style: 'blood', life: 0.7, power: P, onHit: () => healFighter(f, f.maxHp * 0.01, true) });
  if (!FX.off) { FX.ring(f.x, f.y, col, 160, 0.3, 8, f.r); supSound(f, 'skill', 0); }
}, true);
SK('bm_bats', 'ranged', '🦇', 'Bat Swarm', 'Bats circle the target, biting again and again, then fly home and heal their master with the blood', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const n = 8, drained = { v: 0 };
  for (let i = 0; i < n; i++) supShot(f, f.x, f.y, angTo(f, t) + (i - n / 2) * 0.2, { speed: 520, r: 8, dmg: SD(f, P) * 0.05, col, style: 'bat', life: 3.4, pierce: 99, power: P, data: { a: i / n * TAU, t: 0, cd: 0 },
    tick: (p, h) => { const d = p.data; d.t += h; d.cd -= h; if (d.cd <= 0) { d.cd = 0.4; if (p.hits) p.hits.clear(); }
      if (d.t < 2.4 && t.alive) { d.a += 5 * h; const tx = t.x + dcos(d.a) * 46, ty = t.y + dsin(d.a) * 46, a = datan2(ty - p.y, tx - p.x); p.vx = dcos(a) * 560; p.vy = dsin(a) * 560; }
      else { const a = datan2(f.y - p.y, f.x - p.x); p.vx = dcos(a) * 620; p.vy = dsin(a) * 620; if (len(f.x - p.x, f.y - p.y) < f.r) { p.life = 0; healFighter(f, drained.v / n + f.maxHp * 0.004, true); } } },
    onHit: (p, e) => { drained.v += p.dmg; } });
  if (!FX.off) supSound(f, 'skill', 1);
});
SK('bm_shadow', 'mobility', '◐', 'Shadow Clone', 'Leaves a shadow where it stands; a moment later the Blood Moon swaps places with its shadow', (f, s, P, col) => {
  const sxp = { x: f.x, y: f.y };
  if (!FX.off) vfx((ctx, q) => drawBall(ctx, f.def, sxp.x, sxp.y, f.r, { t: q * 3, alpha: 0.35 * (1 - q * 0.5), tint: 'rgba(0,0,0,0.6)', noAura: true }), 2);
  after(2, () => { if (!f.alive) return; const ox = f.x, oy = f.y; f.x = sxp.x; f.y = sxp.y; supBlast(f, ox, oy, 110, SD(f, P) * 0.45, { tag: 'explosion', effect: 'weaken' }); supBlast(f, f.x, f.y, 110, SD(f, P) * 0.3, { tag: 'explosion' }); if (!FX.off) { FX.burst(ox, oy, '#000000', 20, 300, 7, 0.6, 'smoke'); FX.burst(f.x, f.y, col, 20, 300); } });
  if (!FX.off) supSound(f, 'skill', 2);
}, true);
SK('bm_aura', 'buff', '◍', 'Blood Moon Aura', 'A crimson aura: nearby enemies slowly bleed and every hit heals the Blood Moon', (f, s, P, col) => {
  const st = sx(f); st.bloodAuraT = 6 + P / 60;
  supZone(f, { kind: 'custom', custom: true, follow: f, x: f.x, y: f.y, r: 200, life: st.bloodAuraT, col, onTick: (z, e, d, h) => { if (d < z.r && (z.ticks.get(e.sid) || 0) <= BATTLE.time) { z.ticks.set(e.sid, BATTLE.time + 0.5); dealDamage(f, e, SD(f, P) * 0.06, { kind: 'dot', noCrit: true, noDef: true }); } },
    draw: (ctx, z, t) => { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 10, 0, 0, z.r); g.addColorStop(0, 'rgba(255,23,68,.16)'); g.addColorStop(1, 'rgba(255,23,68,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill(); } });
  if (!FX.off) supSound(f, 'skill', 3);
}, true);
SK('bm_hemo', 'curse', '🩸', 'Hemorrhage', 'Marks the target: its next hits taken make it bleed extra', (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  const es = sx(e); es.hemoN = 4 + f.form * 2; es.hemoBy = f;
  if (!FX.off) { FX.ring(e.x, e.y, '#d50000', e.r * 2, 0.4, 6, e.r); supSound(f, 'skill', 4); }
});
function bloodMoon(f, P, col, dmg, god) {
  darkArena(5, '#2a0006', 0.45); camPunch(ARENA.cx, ARENA.y + 160, 0.08, 2.4);
  const st = sx(f); st.bloodAuraT = 6;
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, god ? '🌕 ETERNAL BLOOD GOD 🌕' : '🌕 ETERNAL BLOOD MOON 🌕', '#ff1744', 42, { life: 2.6, vy: 0, pop: 2, stroke: '#1a0003' }); supSound(f, 'ult', god ? 2 : 0);
    vfx((ctx, q) => vMoon(ctx, ARENA.cx, ARENA.y + 150, 110, '#d50000', Math.min(1, q * 3) * (1 - Math.max(0, q - 0.85) * 6)), 5); }
  for (let k = 0; k < 10; k++) after(0.3 + k * 0.5, () => { if (!f.alive) return; for (const e of supEnemies(f)) { const d = dealDamage(f, e, dmg * 0.05, { kind: 'dot', noCrit: true, noDef: true }); healFighter(f, d, true); if (!FX.off) FX.burst(e.x, e.y, '#d50000', 6, 120, 4, 0.4); } });
  if (god) for (let i = 0; i < 14; i++) after(0.6 + i * 0.18, () => { const es = supEnemies(f), e = es[i % Math.max(1, es.length)]; if (f.alive && e) supShot(f, e.x + rand(-60, 60), ARENA.y + 10, Math.PI / 2 + rand(-0.15, 0.15), { speed: 820, r: 9, dmg: dmg * 0.07, col: '#ff1744', style: 'blood', homing: 1.5, target: e, power: P, onHit: () => healFighter(f, f.maxHp * 0.01, true) }); });
}
UL('eternalbloodmoon', 'Eternal Blood Moon — a red moon rises: every enemy bleeds and every drop heals the Blood Moon', (f, P, col, dmg) => bloodMoon(f, P, col, dmg, false));
UL('bloodgod', 'Eternal Blood God — the blood moon plus a crimson rain of blood spears', (f, P, col, dmg) => bloodMoon(f, P, col, dmg, true));
supBall(B('bloodmoongod', 'Blood Moon God Ball', 'Admin', 'Admin Exclusive', [146, 102, 88, 94, 80], D('#2a0006', '#ff1744', '#ff5252', 'bloodgod', ['batwings', 'fangs'], '', { glow: 1.7, sdeco: ['bats'] }),
  [S('CRIMSON EXPLOSION', 'bm_spikes', 6, 75, '#ff1744'), S('BAT SWARM', 'bm_bats', 9, 70, '#d50000'), S('SHADOW CLONE', 'bm_shadow', 8, 65, '#ff5252'), S('BLOOD MOON AURA', 'bm_aura', 13, 70, '#ff1744'), S('HEMORRHAGE', 'bm_hemo', 9, 60, '#d50000')],
  U('ETERNAL BLOOD MOON', 'eternalbloodmoon', 135, '#ff1744', 'drain'), 'aggressive', { desc: 'SUPREME ADMIN. The god form of the blood moon — it bleeds the arena dry. (Owner-only; the normal Blood Moon Ball is unchanged.)' }), {
  forms: [{ name: 'BLOOD MOON' }, { name: 'CRIMSON NIGHT LORD', design: { c2: '#ff4081', c3: '#ff8a80', glow: 1.9 } }, { name: 'ETERNAL BLOOD GOD', design: { c1: '#000000', c2: '#ff1744', c3: '#ffffff', glow: 2.3 } }],
  finalUlt: U('ETERNAL BLOOD GOD', 'bloodgod', 155, '#ff1744', 'drain'), sound: { base: 110, wave: 'triangle', slide: 0.6, noise: 1500 },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.3) FX.p(f.x + vr(-f.r, f.r) * 0.6, f.y + f.r * 0.8, 0, vr(40, 90), 0.8, vr(2, 4), '#d50000', 'dot', 0, 200); },
    bounce: (f, x, y) => FX.burst(x, y, '#d50000', 8, 200, 4, 0.4),
    victory: (f, d) => { vfx((ctx, q) => vMoon(ctx, f.x, f.y - f.r - 100, 46, '#d50000', 1 - q * 0.5), 1.8); FX.text(f.x, f.y - f.r - 170, 'THE NIGHT IS ETERNAL', '#ff5252', 22, { life: 1.8 }); },
    defeat: (f, d) => { for (let i = 0; i < 10; i++) supBatFx(f.x, f.y); FX.burst(f.x, f.y, '#d50000', 50, 420, 6, 1.0); },
    entrance: () => vfx((ctx, q) => vMoon(ctx, ARENA.cx, ARENA.cy, 160, '#d50000', Math.sin(Math.PI * q)), 1.4),
  },
});
function supBatFx(x, y) { if (FX.off) return; const a = vr(TAU); FX.p(x, y, Math.cos(a) * 300, Math.sin(a) * 300 - 80, 1.0, 7, '#1a0003', 'shard', 1); }

/* =================== 10. TIME GOD =================== */
SK('tm_rewind', 'heal', '⟲', 'Time Rewind', "Rewinds its own time by 3 seconds: back to where it was, with the HP it had", (f, s, P) => {
  const h = f.hist; if (!h || h.length < 30) return false;
  const snap = h[h.length - 30]; if (snap.hp <= f.hp + 1) return false;
  if (!FX.off) { for (let i = h.length - 1; i >= h.length - 30; i -= 3) FX.p(h[i].x, h[i].y, 0, 0, 0.6, 6, '#ffd740', 'dot', 0); }
  f.x = inArenaX(snap.x, f.r); f.y = inArenaY(snap.y, f.r); f.hp = Math.min(f.maxHp, snap.hp * (BATTLE.suddenDeath ? 0.5 : 1) + f.hp * (BATTLE.suddenDeath ? 0.5 : 0)); f.st.burn = f.st.poison = 0;
  if (!FX.off) { FX.text(f.x, f.y - f.r - 30, 'REWIND', '#ffd740', 18); FX.ring(f.x, f.y, '#40c4ff', 20, 0.5, 6, 120); supSound(f, 'skill', 0); }
}, true);
SK('tm_slow', 'control', '⧗', 'Time Slow', 'A bubble where time crawls: enemies and their shots inside move at a third of their speed', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  supZone(f, { kind: 'custom', custom: true, x: inArenaX(t.x, 80), y: inArenaY(t.y, 80), r: 230 + f.form * 30, life: 4 + P / 60, col, slowField: true,
    onTick: (z, e, d) => { if (d < z.r) { e.st.slow = Math.max(e.st.slow, 0.3); e.vx *= 0.92; e.vy *= 0.92; } },
    draw: (ctx, z, t2) => { ctx.strokeStyle = 'rgba(255,215,64,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.stroke(); vClock(ctx, 0, 0, z.r * 0.4, '#ffd740', 0.35, t2 * 0.2); } });
  if (!FX.off) supSound(f, 'skill', 1);
});
SK('tm_clone', 'summon', '⧖', 'Temporal Clone', 'An echo from 2 seconds ago replays the Time God\'s path, hitting anything it passes', (f, s, P, col) => {
  const path = (f.hist || []).slice(-20).map(p => ({ x: p.x, y: p.y })); if (path.length < 10) return false;
  supShot(f, path[0].x, path[0].y, 0, { speed: 0, r: f.r * 0.9, dmg: SD(f, P) * 0.3, col, style: 'echo', life: path.length * 0.1, pierce: 6, power: P, data: { path, t: 0, def: f.def },
    tick: (p, h) => { const d = p.data; d.t += h; const i = Math.min(d.path.length - 1, Math.floor(d.t / 0.1)); p.x = d.path[i].x; p.y = d.path[i].y; p.vx = p.vy = 0; } });
  if (!FX.off) supSound(f, 'skill', 2);
}, true);
SK('tm_predict', 'defense', '👁', 'Future Prediction', 'Sees the future: dodges the next ability hits and its own attacks hit harder for a few seconds', (f, s, P) => {
  const st = sx(f); st.dodgeT = 4 + P / 60; st.dodges = 3 + f.form; st.predictT = st.dodgeT;
  if (!FX.off) { FX.text(f.x, f.y - f.r - 30, 'FUTURE SEEN', '#ffd740', 16); vfx((ctx, q) => { if (f.alive) vClock(ctx, f.x, f.y, f.r * 1.6, '#40c4ff', 0.5 * (1 - q), q * 6); }, st.dodgeT); supSound(f, 'skill', 3); }
}, true);
SK('tm_blades', 'aoe', '⌖', 'Clockwork Blades', 'Two giant clock hands sweep around the Time God, slicing anything they pass', (f, s, P, col) => {
  const dur = 3 + f.form * 0.5;
  for (let k = 0; k < 2; k++) { addLaser(f, [0, 0, 0, 0], { charge: 0.2, dur, w: 10, dmg: SD(f, P) * 0.22, col: k ? '#40c4ff' : '#ffd740' }); BATTLE.lasers[BATTLE.lasers.length - 1].clock = { f, a0: k * Math.PI, av: k ? 2.2 : 4.4, len: k ? 230 : 160 }; }
  if (!FX.off) supSound(f, 'skill', 4);
}, true);
function timeLoop(f, P, col, dmg, end) {
  camPunch(ARENA.cx, ARENA.cy, 0.08, 2); BATTLE.timeTint = Math.max(BATTLE.timeTint, end ? 3 : 1.5);
  const marks = supEnemies(f).map(e => ({ e, x: e.x, y: e.y, hp: e.hp }));
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, end ? '⌛ END OF ALL TIME ⌛' : '⌛ ETERNAL TIME LOOP ⌛', '#ffd740', 42, { life: 2.6, vy: 0, pop: 2, stroke: '#1a1200' }); supSound(f, 'ult', end ? 2 : 0);
    vfx((ctx, q) => vClock(ctx, ARENA.cx, ARENA.cy, 240, '#ffd740', 0.6 * Math.sin(Math.PI * q), -q * 20), 4); }
  if (end) for (const m of marks) m.e.st.timestop = Math.max(m.e.st.timestop, m.e.boss ? 1.5 : 3);
  if (end) for (let i = 0; i < 12; i++) after(0.2 + i * 0.2, () => { const es = supEnemies(f), e = es[i % Math.max(1, es.length)]; if (f.alive && e) { dealDamage(f, e, dmg * 0.05, { kind: 'skill', tag: 'strike', power: P }); if (!FX.off) vfx((ctx, q) => vClaw(ctx, e.x, e.y, 60, i * 0.7, '#ffd740', 1 - q), 0.3); } });
  after(4, () => {
    if (!f.alive) return;
    for (const m of marks) { const e = m.e; if (!e.alive) continue; const lost = Math.max(0, m.hp - e.hp); e.x = inArenaX(m.x, e.r); e.y = inArenaY(m.y, e.r); e.vx = e.vy = 0;
      dealDamage(f, e, lost * 0.8 + dmg * 0.4, { kind: 'skill', tag: 'skill', noDef: true, power: P }); if (!FX.off) { FX.ring(e.x, e.y, '#ffd740', 140, 0.5, 8, e.r); } }
    if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, 'THE LOOP CLOSES', '#ffffff', 34, { life: 1.4, vy: 0 }); FX.addShake(14); FX.addFlash(0.25, '#ffd740'); }
  });
}
UL('timeloop', 'Eternal Time Loop — time loops: enemies are pulled back to where they were and the damage they took repeats', (f, P, col, dmg) => timeLoop(f, P, col, dmg, false));
UL('endoftime', 'End of All Time — time stops for every enemy while clock blades cut, then the loop closes', (f, P, col, dmg) => timeLoop(f, P, col, dmg, true));
supBall(B('timegod', 'Time God Ball', 'Admin', 'Admin Exclusive', [140, 96, 96, 92, 82], D('#1a1200', '#ffd740', '#40c4ff', 'timegod', ['ring'], '', { glow: 1.6, sdeco: ['clockhands'] }),
  [S('TIME REWIND', 'tm_rewind', 14, 70, '#ffd740'), S('TIME SLOW', 'tm_slow', 10, 70, '#ffd740'), S('TEMPORAL CLONE', 'tm_clone', 9, 75, '#40c4ff'), S('FUTURE PREDICTION', 'tm_predict', 13, 70, '#40c4ff'), S('CLOCKWORK BLADES', 'tm_blades', 9, 75, '#ffd740')],
  U('ETERNAL TIME LOOP', 'timeloop', 135, '#ffd740'), 'tactical', { desc: 'SUPREME ADMIN. Past, present and future turn inside this golden clock sphere.' }), {
  forms: [{ name: 'TIME GOD' }, { name: 'LORD OF ERAS', design: { c2: '#ffffff', c3: '#ffd740', glow: 1.9 } }, { name: 'ETERNAL CHRONOS GOD', design: { c1: '#ffffff', c2: '#ffd740', c3: '#40c4ff', glow: 2.3 } }],
  finalUlt: U('END OF ALL TIME', 'endoftime', 155, '#ffffff'), sound: { base: 392, wave: 'triangle', slide: 1.0, noise: 3000 },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.3) FX.p(f.x + vr(-f.r, f.r) * 1.4, f.y + vr(-f.r, f.r) * 1.4, 0, 0, 0.8, vr(2, 3), d.c2, 'dot', 0); },
    bounce: (f, x, y, d) => FX.ring(x, y, d.c2, 50, 0.3, 3, 6),
    victory: (f, d) => { vfx((ctx, q) => vClock(ctx, f.x, f.y, f.r * 2.2, d.c2, 1 - q * 0.6, q * 12), 1.8); FX.text(f.x, f.y - f.r - 80, 'TIME IS ON MY SIDE', d.c2, 22, { life: 1.8 }); },
    defeat: (f, d) => { vfx((ctx, q) => vClock(ctx, f.x, f.y, f.r * 1.5, '#b0bec5', 1 - q, -q * 30), 1.2); FX.burst(f.x, f.y, d.c2, 40, 400, 5, 0.8, 'shard'); },
    entrance: f => { BATTLE.timeTint = Math.max(BATTLE.timeTint, 1.2); },
  },
});
/* =================== 11. INFINITY GOD (owner-only god version; the player Infinity Ball is unchanged) =================== */
SK('if_energy', 'buff', '∞', 'Infinite Energy', 'Endless energy: other abilities recharge 40% at once, the ultimate charges and abilities hit 15% harder', (f, s, P) => {
  const st = sx(f); st.energyT = 5 + P / 60;
  for (const k of f.allSkills()) if (k !== s && k.cdLeft > 0) k.cdLeft *= 0.6;
  f.ultMeter = Math.min(100, f.ultMeter + 12);
  if (!FX.off) { FX.ring(f.x, f.y, '#00ffff', f.r * 2.6, 0.5, 6, f.r); vfx((ctx, q) => { if (f.alive) vInfinity(ctx, f.x, f.y - f.r - 30, 24, '#00ffff', 1 - q); }, 1.2); supSound(f, 'skill', 0); }
}, true);
SK('if_shield', 'defense', '⬡', 'Infinity Shield', 'Takes 60% less damage and stores some of it — when the shield ends the stored energy explodes outward', (f, s, P, col) => {
  const st = sx(f); if (st.infShieldT > 0) return false;
  st.infShieldT = 4 + P / 60; st.stored = 0;
  after(st.infShieldT, () => { if (!f.alive) return; const amt = (st.stored || 0) * 1.4 + SD(f, P) * 0.35; st.stored = 0; supWave(f, f.x, f.y, 340, amt, col, { force: 700 }); if (!FX.off) { FX.text(f.x, f.y - f.r - 30, 'INFINITY RELEASE', col, 18); FX.addShake(8); } });
  if (!FX.off) supSound(f, 'skill', 1);
}, true);
SK('if_waves', 'aoe', '≋', 'Endless Waves', 'Three energy waves roll out from the Infinity God while a mirrored wave erupts under the target', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt);
  for (let k = 0; k < 3; k++) after(k * 0.3, () => { if (f.alive) supWave(f, f.x, f.y, 300 + k * 40, SD(f, P) * 0.24, k % 2 ? '#e040fb' : col, { force: 380 }); });
  if (t) after(0.45, () => { if (f.alive && t.alive) supWave(f, t.x, t.y, 200, SD(f, P) * 0.3, '#e040fb', { force: 300, r0: 4 }); });
  if (!FX.off) supSound(f, 'skill', 2);
}, true);
SK('if_expand', 'control', '⊚', 'Infinite Expansion', 'Space itself expands: every enemy nearby is hurled away and slowed', (f, s, P, col) => {
  const r = 430 + f.form * 40, es = supEnemies(f).filter(e => len(e.x - f.x, e.y - f.y) < r + e.r);
  if (!es.length) return false;
  for (const e of es) { knock(e, f.x, f.y, 1100); e.st.slow = Math.max(e.st.slow, 2); dealDamage(f, e, SD(f, P) * 0.4, { kind: 'skill', tag: 'wave', power: P }); }
  if (!FX.off) { for (let i = 0; i < 4; i++) FX.ring(f.x, f.y, i % 2 ? '#e040fb' : col, r * (0.5 + i * 0.17), 0.5 + i * 0.1, 8 - i, f.r); FX.addShake(8); supSound(f, 'skill', 3); }
}, true);
SK('if_loop', 'ranged', '♾', 'Eternal Loop', 'An orb flies an endless figure-eight between the Infinity God and the target, hitting on every pass', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const cx = (f.x + t.x) / 2, cy = (f.y + t.y) / 2, A = clamp(len(t.x - f.x, t.y - f.y) * 0.6 + 80, 160, 380), rot = angTo(f, t);
  for (let k = 0; k < 1 + (f.form >= 2 ? 1 : 0); k++)
    supShot(f, cx, cy, 0, { speed: 0, r: 13, dmg: SD(f, P) * 0.22, col, style: 'infloop', life: 3.6, pierce: 99, power: P, data: { t: k * Math.PI, cd: 0 },
      tick: (p, h) => { const d = p.data; d.t += h * 1.9; d.cd -= h; if (d.cd <= 0) { d.cd = 0.5; if (p.hits) p.hits.clear(); }
        const sn = dsin(d.t), cs = dcos(d.t), den = 1 + sn * sn, lx = A * cs / den, ly = A * sn * cs / den;
        p.x = inArenaX(cx + lx * dcos(rot) - ly * dsin(rot), 14); p.y = inArenaY(cy + lx * dsin(rot) + ly * dcos(rot), 14); p.vx = p.vy = 0; } });
  if (!FX.off) supSound(f, 'skill', 4);
});
function infiniteDominion(f, P, col, dmg, god) {
  darkArena(4, '#05001a', 0.55); camPunch(ARENA.cx, ARENA.cy, 0.1, 2.4);
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, god ? '∞ INFINITY BEYOND ∞' : '∞ INFINITE DOMINION ∞', '#00ffff', 44, { life: 2.6, vy: 0, pop: 2, stroke: '#05001a' }); supSound(f, 'ult', god ? 2 : 0);
    vfx((ctx, q) => vInfinity(ctx, ARENA.cx, ARENA.cy, 300, q > 0.5 ? '#e040fb' : '#00ffff', Math.sin(Math.PI * q) * 0.8, q * 8), 4); }
  for (const e of supEnemies(f)) { e.st.slow = Math.max(e.st.slow, 4); for (const k of e.allSkills()) k.cdLeft += 3; }
  for (let k = 0; k < 8; k++) after(0.3 + k * 0.4, () => { if (!f.alive) return; for (const e of supEnemies(f)) dealDamage(f, e, dmg * 0.09, { kind: 'skill', tag: 'wave', power: P, noCrit: true }); healFighter(f, f.maxHp * 0.02, true); if (!FX.off) FX.ring(ARENA.cx, ARENA.cy, k % 2 ? '#e040fb' : '#00ffff', 600, 0.5, 6, 40); });
  if (god) {
    for (let k = 0; k < 4; k++) after(0.5 + k * 0.3, () => { const t = nearestEnemy(f); if (f.alive && t) SKILL_FN.if_loop(f, {}, P * 0.7, '#e040fb', t); });
    after(3.6, () => { if (!f.alive) return; for (const e of supEnemies(f)) { dealDamage(f, e, dmg * 0.55, { kind: 'skill', tag: 'explosion', power: P }); knock(e, ARENA.cx, ARENA.cy, 800); } if (!FX.off) { FX.addFlash(0.3, '#00ffff'); FX.addShake(18); FX.burst(ARENA.cx, ARENA.cy, '#00ffff', 90, 900, 8, 1.1); } });
  }
}
UL('infinitedominion', 'Infinite Dominion — an endless ∞ spans the arena: enemies slow down, their cooldowns stretch and energy pulses hit forever', (f, P, col, dmg) => infiniteDominion(f, P, col, dmg, false));
UL('infinitygodult', 'Infinity Beyond — the dominion, four eternal loops, then the infinity collapses in one blast', (f, P, col, dmg) => infiniteDominion(f, P, col, dmg, true));
supBall(B('infinitygod', 'Infinity God Ball', 'Admin', 'Admin Exclusive', [145, 100, 92, 92, 80], D('#0a0020', '#00ffff', '#e040fb', 'infgod', ['ring', 'orbit'], '∞', { glow: 1.7, sdeco: ['infloop'] }),
  [S('INFINITE ENERGY', 'if_energy', 13, 65, '#00ffff'), S('INFINITY SHIELD', 'if_shield', 12, 70, '#00ffff'), S('ENDLESS WAVES', 'if_waves', 7, 75, '#00ffff'), S('INFINITE EXPANSION', 'if_expand', 9, 70, '#e040fb'), S('ETERNAL LOOP', 'if_loop', 8, 75, '#e040fb')],
  U('INFINITE DOMINION', 'infinitedominion', 135, '#00ffff'), 'intelligent', { desc: 'SUPREME ADMIN. The god form of infinity — owner only. (The normal Infinity Ball is unchanged.)' }), {
  forms: [{ name: 'INFINITY GOD' }, { name: 'ENDLESS ONE', design: { c2: '#ffffff', c3: '#00ffff', glow: 1.9 } }, { name: 'INFINITE DOMINION GOD', design: { c1: '#000000', c2: '#e040fb', c3: '#00ffff', glow: 2.4 } }],
  finalUlt: U('INFINITY BEYOND', 'infinitygodult', 155, '#e040fb'), sound: { base: 294, wave: 'sine', slide: 2.0, noise: 2400 },
  fx: {
    idle: (f, d) => { const a = f.t * 3, s2 = Math.sin(a), c = Math.cos(a), den = 1 + s2 * s2; FX.p(f.x + f.r * 1.8 * c / den, f.y + f.r * 1.8 * s2 * c / den, 0, 0, 0.5, 3, Math.random() < 0.5 ? d.c2 : d.c3, 'dot', 0); },
    bounce: (f, x, y, d) => FX.ring(x, y, d.c2, 60, 0.3, 4, 6),
    victory: (f, d) => { vfx((ctx, q) => vInfinity(ctx, f.x, f.y - f.r - 70, 60, d.c2, 1 - q * 0.5, q * 6), 1.8); FX.text(f.x, f.y - f.r - 130, 'INFINITY HAS NO END', d.c2, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, d.c2, 50, 480, 5, 1.0); FX.burst(f.x, f.y, d.c3, 30, 300, 5, 1.0, 'shard'); },
    entrance: () => vfx((ctx, q) => vInfinity(ctx, ARENA.cx, ARENA.cy, 340, '#00ffff', Math.sin(Math.PI * q), q * 4), 1.4),
  },
});

/* =================== 12. PHOENIX GOD (owner-only god version) =================== */
SK('ph_wings', 'melee', '🔥', 'Flame Wings', 'Both wings sweep forward, throwing two fans of flame', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const a = angTo(f, t);
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) after(i * 0.04, () => { if (f.alive) supShot(f, f.x + dcos(a + side * 1.4) * f.r, f.y + dsin(a + side * 1.4) * f.r, a + side * (0.9 - i * 0.16), { speed: 560, r: 9, dmg: SD(f, P) * 0.12, col, style: 'flame', life: 0.75, effect: 'burn', power: P }); });
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('ph_explode', 'aoe', '✺', 'Phoenix Explosion', 'Burns 8% of its own HP to explode in a fire nova that leaves a ring of flames', (f, s, P, col) => {
  if (f.hpRatio < 0.2) return false;
  f.hp -= f.maxHp * 0.08;
  supWave(f, f.x, f.y, 320, SD(f, P) * 0.75, col, { force: 700, effect: 'burn', power: P });
  supZone(f, { kind: 'trap', x: f.x, y: f.y, r: 170, life: 3, col: '#ff6d00', effect: 'burn', power: P, dmg: SD(f, P) * 0.07, style: 'burn' });
  if (!FX.off) { FX.burst(f.x, f.y, '#ffea00', 50, 600, 7, 0.8); FX.addShake(9); supSound(f, 'skill', 1); }
}, true);
SK('ph_rebirth', 'defense', '♨', 'Rebirth', 'For a few seconds, a killing blow will instead bring the phoenix back with 40% HP in an explosion of fire', (f, s, P) => {
  const st = sx(f); if (st.rebirthT > 0) return false;
  st.rebirthT = 8 + P / 30; st.reborn = false;
  if (!FX.off) { FX.text(f.x, f.y - f.r - 30, 'REBIRTH READY', '#ffea00', 16); FX.ring(f.x, f.y, '#ffea00', f.r * 2.4, 0.5, 6, f.r); supSound(f, 'skill', 2); }
}, true);
SK('ph_dive', 'mobility', '⤋', 'Sky Dive', 'Flies up out of the arena, then dives onto the target and leaves a burning crater', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  if (!FX.off) { FX.burst(f.x, f.y, col, 30, 400, 6, 0.6); FX.p(f.x, f.y, 0, -900, 0.4, f.r, col, 'dot', 0); }
  f.st.outside = 0.8; f.vx = f.vy = 0;
  f.portalExit = { mode: 'point', x: t.x, y: t.y, col, tgt: t, dash: { effect: 'burn', P }, onExit: (m, p) => {
    supBlast(f, p.x, p.y, 170 + f.form * 20, SD(f, P) * 0.9, { effect: 'burn', force: 650, power: P });
    supZone(f, { kind: 'trap', x: p.x, y: p.y, r: 120, life: 2.5, col: '#ff3d00', effect: 'burn', power: P, dmg: SD(f, P) * 0.06, style: 'burn' });
    if (!FX.off) { FX.addShake(12); FX.ring(p.x, p.y, '#ffea00', 220, 0.5, 12, 20); Sound.play('boom'); }
  } };
  if (!FX.off) supSound(f, 'skill', 3);
});
SK('ph_trail', 'buff', '〰', 'Burning Trail', 'Leaves a trail of fire wherever it rolls and moves faster for a few seconds', (f, s, P, col) => {
  const n = 14 + f.form * 4; f.st.buff = Math.max(f.st.buff, n * 0.22); f.st.buffPow = Math.max(f.st.buffPow, 0.15);
  for (let k = 0; k < n; k++) after(k * 0.22, () => { if (f.alive) supZone(f, { kind: 'trap', x: f.x, y: f.y, r: 46, life: 1.6, col: '#ff6d00', effect: 'burn', power: P, dmg: SD(f, P) * 0.05, style: 'burn' }); });
  if (!FX.off) supSound(f, 'skill', 4);
}, true);
function phoenixUlt(f, P, col, dmg, god) {
  camPunch(f.x, f.y, 0.16, 2); darkArena(3, god ? '#2a1000' : '#1a0800', 0.4);
  const st = sx(f); st.rebirthT = Math.max(st.rebirthT || 0, 10); st.reborn = false;
  healFighter(f, f.maxHp * (god ? 0.25 : 0.18)); f.st.burn = f.st.poison = 0;
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, god ? '☀ SOLAR FLAME GOD ☀' : '🔥 ETERNAL REBIRTH 🔥', '#ffea00', 44, { life: 2.6, vy: 0, pop: 2, stroke: '#3e1000' }); supSound(f, 'ult', god ? 2 : 0);
    vfx((ctx, q) => vPhoenix(ctx, f.x, f.y, 140 + q * 60, '#ff9100', Math.sin(Math.PI * q), q), 2.2); }
  supWave(f, f.x, f.y, 520, dmg * 0.45, '#ff9100', { force: 800, effect: 'burn', power: P, speed: 900 });
  for (let i = 0; i < 16; i++) after(0.4 + i * 0.1, () => { const es = supEnemies(f), e = es[i % Math.max(1, es.length)]; if (f.alive && e) supShot(f, e.x + rand(-80, 80), ARENA.y + 10, Math.PI / 2, { speed: 760, r: 10, dmg: dmg * 0.06, col: '#ffea00', style: 'feather', effect: 'burn', homing: 1.8, target: e, power: P }); });
  if (god) {
    BATTLE.cond = { kind: 'inferno', team: f.team, by: f, t: 6 };
    if (!FX.off) vfx((ctx, q) => vSun(ctx, ARENA.cx, ARENA.y + 150, 120, '#ffea00', Math.min(1, q * 3) * (1 - Math.max(0, q - 0.8) * 5), q, false), 3.5);
    for (let k = 0; k < 3; k++) after(1 + k * 0.6, () => { if (f.alive) for (const e of supEnemies(f)) supStrike(f, e.x, e.y, 0.4, 90, dmg * 0.18, '#ffea00', { kind: 'meteor', effect: 'burn', power: P }); });
  }
}
UL('eternalrebirth', 'Eternal Rebirth — the phoenix heals, prepares a rebirth, explodes in fire and rains burning feathers', (f, P, col, dmg) => phoenixUlt(f, P, col, dmg, false));
UL('solarflamegod', 'Solar Flame God — a second sun rises: the arena burns, and solar meteors fall three times', (f, P, col, dmg) => phoenixUlt(f, P, col, dmg, true));
supBall(B('phoenixgod', 'Phoenix God Ball', 'Admin', 'Admin Exclusive', [138, 104, 82, 100, 82], D('#3e1000', '#ffea00', '#ff6d00', 'phoenixgod', ['wings', 'flames'], '', { glow: 1.8, sdeco: ['firecrown'] }),
  [S('FLAME WINGS', 'ph_wings', 5, 75, '#ff9100', 'burn'), S('PHOENIX EXPLOSION', 'ph_explode', 9, 85, '#ffea00', 'burn'), S('REBIRTH', 'ph_rebirth', 22, 60, '#ffea00'), S('SKY DIVE', 'ph_dive', 8, 80, '#ff6d00', 'burn'), S('BURNING TRAIL', 'ph_trail', 11, 60, '#ff6d00', 'burn')],
  U('ETERNAL REBIRTH', 'eternalrebirth', 135, '#ff9100', 'burn'), 'aggressive', { desc: 'SUPREME ADMIN. The god of the phoenix line — owner only. (The normal Phoenix Ball is unchanged.)' }), {
  forms: [{ name: 'PHOENIX GOD' }, { name: 'SOLAR PHOENIX', design: { c2: '#ffffff', c3: '#ffea00', glow: 2.0 } }, { name: 'ETERNAL FLAME GOD', design: { c1: '#ffffff', c2: '#ff3d00', c3: '#ffea00', glow: 2.4 } }],
  finalUlt: U('SOLAR FLAME GOD', 'solarflamegod', 155, '#ffea00', 'burn'), sound: { base: 349, wave: 'sawtooth', slide: 1.6, noise: 1800 },
  fx: {
    idle: (f, d) => FX.p(f.x + vr(-f.r, f.r) * 0.9, f.y + vr(-f.r, f.r) * 0.5, vr(-20, 20), vr(-150, -80), 0.5, vr(4, 7), Math.random() < 0.5 ? d.c2 : d.c3),
    bounce: (f, x, y, d) => FX.burst(x, y, d.c3, 12, 260, 5, 0.4),
    victory: (f, d) => { vfx((ctx, q) => vPhoenix(ctx, f.x, f.y - 20, 120, d.c3, 1 - q * 0.5, q), 1.8); FX.text(f.x, f.y - f.r - 90, 'FROM THE ASHES, VICTORY', d.c2, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, '#9e9e9e', 50, 300, 6, 1.4, 'smoke'); FX.burst(f.x, f.y, d.c3, 30, 400, 5, 0.8); },
    entrance: f => { vfx((ctx, q) => vPhoenix(ctx, f.x, f.y, 200, '#ffea00', Math.sin(Math.PI * q), q), 1.4); },
  },
});

/* =================== 13. BLACK SUN =================== */
SK('bs_eclipse', 'control', '◑', 'Eclipse', 'A zone of total darkness: enemies inside are blinded — they wander, lose track and their abilities recharge slower', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  supZone(f, { kind: 'custom', custom: true, x: inArenaX(t.x, 80), y: inArenaY(t.y, 80), r: 200 + f.form * 25, life: 4 + P / 60, col,
    onTick: (z, e, d, h) => { if (d < z.r + e.r * 0.5) { const es = sx(e); es.blindT = Math.max(es.blindT || 0, 0.35); for (const k of e.allSkills()) if (k.cdLeft > 0) k.cdLeft += h * 0.4;
      if ((z.ticks.get(e.sid) || 0) <= BATTLE.time) { z.ticks.set(e.sid, BATTLE.time + 0.5); dealDamage(f, e, SD(f, P) * 0.07, { kind: 'skill', tag: 'zone', noCrit: true, power: P }); } } },
    draw: (ctx, z, t2) => { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, z.r); g.addColorStop(0, 'rgba(0,0,0,.92)'); g.addColorStop(0.8, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,109,0,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, z.r * 0.92, t2, t2 + 4.4); ctx.stroke(); } });
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('bs_flare', 'ranged', '☄', 'Solar Flare', 'Five flares arc out in curves and swing back in on the target', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const a = angTo(f, t);
  for (let i = 0; i < 5; i++) { const side = i - 2; supShot(f, f.x, f.y, a + side * 0.45, { speed: 520, r: 10, dmg: SD(f, P) * 0.18, col, style: 'flare', life: 2.4, effect: 'burn', power: P, target: t, data: { curve: side ? -Math.sign(side) * 2.2 : 0, t: 0 },
    tick: (p, h) => { p.data.t += h; if (p.data.t > 0.7) { p.homing = 3.5; return; } const c = p.data.curve * h, ca = dcos(c), sa = dsin(c), vx = p.vx; p.vx = vx * ca - p.vy * sa; p.vy = vx * sa + p.vy * ca; } }); }
  if (!FX.off) supSound(f, 'skill', 1);
});
SK('bs_gravity', 'control', '◎', 'Gravity Well', "The black sun's gravity grabs nearby enemies and spins them in orbit around it", (f, s, P, col) => {
  supZone(f, { kind: 'custom', custom: true, follow: f, x: f.x, y: f.y, r: 460, life: 2.8 + P / 80, col,
    onTick: (z, e, d, h) => { if (d > z.r || d < 1) return; const dx = (f.x - e.x) / d, dy = (f.y - e.y) / d, k = e.boss ? 0.4 : 1, want = f.r + e.r + 120;
      e.vx += (-dy * 1400 + dx * (d - want) * 6) * h * k; e.vy += (dx * 1400 + dy * (d - want) * 6) * h * k;
      if ((z.ticks.get(e.sid) || 0) <= BATTLE.time) { z.ticks.set(e.sid, BATTLE.time + 0.5); dealDamage(f, e, SD(f, P) * 0.08, { kind: 'skill', tag: 'zone', noCrit: true, power: P }); } },
    draw: (ctx, z, t2) => { ctx.strokeStyle = 'rgba(255,171,0,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, z.r * (0.45 + i * 0.2), z.r * (0.3 + i * 0.14), t2 * (1 + i * 0.4), 0, TAU); ctx.stroke(); } } });
  if (!FX.off) supSound(f, 'skill', 2);
}, true);
SK('bs_corona', 'aoe', '◯', 'Dark Corona', 'A ring of dark fire bursts around the black sun — deadly at mid range, harmless right next to it', (f, s, P, col) => {
  const r0 = 120, r1 = 290 + f.form * 20; let n = 0;
  for (const e of supEnemies(f)) { const d = len(e.x - f.x, e.y - f.y); if (d + e.r > r0 && d - e.r < r1) { dealDamage(f, e, SD(f, P) * 0.95, { kind: 'skill', tag: 'explosion', effect: 'burn', power: P }); knock(e, f.x, f.y, 500); n++; } }
  if (!FX.off) { vfx((ctx, q) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#ff6d00'; ctx.lineWidth = (r1 - r0) * (1 - q * 0.6); ctx.beginPath(); ctx.arc(f.x, f.y, (r0 + r1) / 2, 0, TAU); ctx.stroke(); ctx.restore(); }, 0.5); FX.addShake(7); supSound(f, 'skill', 3); }
}, true);
SK('bs_cme', 'ranged', '●', 'Coronal Mass Ejection', 'Hurls a huge ball of plasma that bursts into six smaller ones', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const split = p => { for (let i = 0; i < 6; i++) supShot(f, p.x, p.y, i / 6 * TAU, { speed: 480, r: 9, dmg: SD(f, P) * 0.16, col: '#ffab00', style: 'flare', life: 0.9, effect: 'burn', power: P }); if (!FX.off) FX.burst(p.x, p.y, '#ff6d00', 24, 360, 6, 0.5); };
  supShot(f, f.x, f.y, aimAngle(f, t, 330), { speed: 330, r: 22, dmg: SD(f, P) * 0.55, col, style: 'plasma', life: 1.6, effect: 'burn', power: P, onHit: split, onEnd: split });
  if (!FX.off) supSound(f, 'skill', 4);
});
function blackSunUlt(f, P, col, dmg, dead) {
  darkArena(dead ? 4.2 : 3.4, '#000000', 0.86); camPunch(ARENA.cx, ARENA.cy, 0.12, 2.6); FX.addFlash(0.25, '#000000');
  for (const e of supEnemies(f)) { e.st.buff = e.st.shield = e.st.overclock = e.st.adapt = 0; const es = sx(e); es.blindT = 3; }
  supZone(f, { kind: 'gravity', x: ARENA.cx, y: ARENA.cy, r: 520, life: 2.6, col: '#ff6d00', pull: 1200, dmg: dmg * 0.05, effect: 'burn', power: P });
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, dead ? '● DEAD STAR COLLAPSE ●' : '● CONSUME THE LIGHT ●', '#ffab00', 44, { life: 2.6, vy: 0, pop: 2, stroke: '#000000' }); supSound(f, 'ult', dead ? 2 : 0);
    vfx((ctx, q) => vSun(ctx, ARENA.cx, ARENA.cy, 120 + q * 40, '#ff6d00', Math.min(1, q * 3) * (1 - Math.max(0, q - 0.85) * 6), q, true), dead ? 3.4 : 2.8); }
  after(2.4, () => { if (!f.alive) return; for (const e of supEnemies(f)) { const d = len(e.x - ARENA.cx, e.y - ARENA.cy); dealDamage(f, e, dmg * (d < 300 ? 0.75 : 0.45), { kind: 'skill', tag: 'explosion', effect: 'burn', power: P }); } if (!FX.off) { FX.ring(ARENA.cx, ARENA.cy, '#ff6d00', 380, 0.6, 30, 120); FX.addShake(14); } });
  if (dead) after(3.3, () => {
    if (!f.alive) return;
    for (const e of supEnemies(f)) { dealDamage(f, e, dmg * 0.6, { kind: 'skill', tag: 'explosion', effect: 'burn', power: P }); knock(e, ARENA.cx, ARENA.cy, 1200); }
    if (!FX.off) { FX.addFlash(0.4, '#ffffff'); FX.addShake(22); for (let i = 0; i < 5; i++) FX.ring(ARENA.cx, ARENA.cy, i % 2 ? '#ffffff' : '#ffab00', 400 + i * 160, 0.8, 16, 40); FX.burst(ARENA.cx, ARENA.cy, '#ffab00', 120, 1100, 9, 1.2); FX.text(ARENA.cx, ARENA.cy - 40, 'SUPERNOVA', '#ffffff', 56, { life: 1.4, vy: 0, pop: 2 }); }
  });
}
UL('consumelight', 'Consume the Light — the light goes out: enemy buffs vanish, everything is pulled to the black sun and burnt by its corona', (f, P, col, dmg) => blackSunUlt(f, P, col, dmg, false));
UL('deadstar', 'Dead Star Collapse — the black sun consumes the light, then collapses into a supernova that hits the whole arena', (f, P, col, dmg) => blackSunUlt(f, P, col, dmg, true));
supBall(B('blacksun', 'Black Sun Ball', 'Admin', 'Admin Exclusive', [150, 104, 90, 84, 76], D('#000000', '#ff6d00', '#ffab00', 'blacksun', ['ring'], '', { glow: 1.8, sdeco: ['corona'] }),
  [S('ECLIPSE', 'bs_eclipse', 11, 70, '#ff6d00'), S('SOLAR FLARE', 'bs_flare', 6, 75, '#ffab00', 'burn'), S('GRAVITY WELL', 'bs_gravity', 12, 70, '#ffab00'), S('DARK CORONA', 'bs_corona', 7, 85, '#ff6d00', 'burn'), S('CORONAL MASS EJECTION', 'bs_cme', 8, 80, '#ff6d00', 'burn')],
  U('CONSUME THE LIGHT', 'consumelight', 135, '#ff6d00', 'burn'), 'boss', { desc: 'SUPREME ADMIN. A dead star that burns black — it swallows light and spits out fire.' }), {
  forms: [{ name: 'BLACK SUN' }, { name: 'DEAD STAR', design: { c2: '#ff1744', c3: '#ff6d00', glow: 2.0 } }, { name: 'CONSUMER OF LIGHT', design: { c1: '#000000', c2: '#ffffff', c3: '#ffab00', glow: 2.5 } }],
  finalUlt: U('DEAD STAR COLLAPSE', 'deadstar', 155, '#ffffff', 'burn'), sound: { base: 55, wave: 'sawtooth', slide: 0.5, noise: 260 },
  fx: {
    idle: (f, d) => { const a = vr(TAU), r = f.r * vr(1.05, 1.5); FX.p(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, Math.cos(a) * 40, Math.sin(a) * 40, 0.4, vr(3, 5), Math.random() < 0.6 ? d.c2 : d.c3, 'dot', 1); },
    bounce: (f, x, y, d) => FX.burst(x, y, d.c2, 10, 240, 5, 0.35),
    victory: (f, d) => { darkArena(1.8, '#000000', 0.5); vfx((ctx, q) => vSun(ctx, f.x, f.y, f.r * 1.6, d.c2, 1 - q * 0.5, q, true), 1.8); FX.text(f.x, f.y - f.r - 80, 'ALL LIGHT IS MINE', d.c3, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, d.c2, 70, 700, 7, 1.0); FX.addFlash(0.2, '#ffffff'); },
    entrance: () => darkArena(1.6, '#000000', 0.7),
  },
});

/* =================== 14. MIRROR GOD (owner-only god version) =================== */
SK('mi_reflect', 'defense', '⟲', 'Attack Reflection', 'A perfect mirror: the next ability hit is reflected ×1.5 and enemy shots bounce back for a moment', (f, s, P) => {
  const st = sx(f); st.counterT = 3 + P / 60; f.st.reflect = Math.max(f.st.reflect, 1.4);
  if (!FX.off) { FX.ring(f.x, f.y, '#e1f5fe', f.r * 2.2, 0.4, 6, f.r); supSound(f, 'skill', 0); }
}, true);
SK('mi_clone', 'summon', '⧉', 'Mirror Clone', 'A mirror twin appears on the opposite side of the arena, copying every move and firing shards', (f, s, P, col) => {
  if (supMinions(f) >= SUP.MINION_MAX) return false;
  const m = supMinion(f, f.baseDef || f.def, 2 * ARENA.cx - f.x, 2 * ARENA.cy - f.y, { P, life: 7 + P / 30, hp: 0.12, statMul: 0.6, rScale: 0.85,
    shot: { cd: 1.1, range: 700, fire: (m, t) => supShot(m, m.x, m.y, aimAngle(m, t, 620), { speed: 620, r: 8, dmg: SD(f, P) * 0.12, col, style: 'shard', power: P, bounce: 1 }) } });
  if (m) { m.mirrorOf = f; m.noCollide = false; }
  if (!FX.off) { FX.bolt(f.x, f.y, 2 * ARENA.cx - f.x, 2 * ARENA.cy - f.y, '#e1f5fe', 2, 0.4); supSound(f, 'skill', 1); }
}, true);
SK('mi_dimension', 'control', '⇋', 'Mirror Dimension', 'Flips every enemy to its mirror-image position across the arena, reversed and dazed', (f, s, P) => {
  const es = supEnemies(f); if (!es.length) return false;
  for (const e of es) { const ox = e.x, oy = e.y; e.x = inArenaX(2 * ARENA.cx - e.x, e.r); e.y = inArenaY(2 * ARENA.cy - e.y, e.r); e.vx = -e.vx; e.vy = -e.vy; e.st.slow = Math.max(e.st.slow, 1.5);
    dealDamage(f, e, SD(f, P) * 0.4, { kind: 'skill', tag: 'skill', power: P });
    if (!FX.off) { FX.burst(ox, oy, '#e1f5fe', 16, 260, 4, 0.4, 'shard'); FX.ring(e.x, e.y, '#80d8ff', 90, 0.35, 5, e.r); } }
  if (!FX.off) { FX.addFlash(0.18, '#e1f5fe'); vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.6 * (1 - q); ctx.strokeStyle = '#e1f5fe'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ARENA.cx, ARENA.y); ctx.lineTo(ARENA.cx, ARENA.b); ctx.moveTo(ARENA.x, ARENA.cy); ctx.lineTo(ARENA.r, ARENA.cy); ctx.stroke(); ctx.restore(); }, 0.8); supSound(f, 'skill', 2); }
}, true);
SK('mi_prism', 'ranged', '◆', 'Prism Beam', 'A beam of light hits a prism above the target and splits into five rainbow beams', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const px = t.x, py = t.y, a = angTo(f, t), cols = ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#d500f9'];
  addLaser(f, [f.x, f.y, px, py], { charge: 0.3, dur: 0.5, w: 16, dmg: SD(f, P) * 0.3, col: '#ffffff' });
  after(0.4, () => { if (!f.alive) return; for (let i = 0; i < 5; i++) { const b = a + (i - 2) * 0.32, end = rayToWall(px, py, b); addLaser(f, [px, py, end.x, end.y], { charge: 0.12, dur: 0.7, w: 12, dmg: SD(f, P) * 0.18, col: cols[i] }); } if (!FX.off) FX.burst(px, py, '#ffffff', 20, 300, 5, 0.4, 'shard'); });
  if (!FX.off) supSound(f, 'skill', 3);
});
SK('mi_shards', 'ranged', '✧', 'Shard Storm', 'Eight razor shards that ricochet off the walls', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); const a0 = t ? angTo(f, t) : f.rot, n = 8 + f.form * 2;
  for (let i = 0; i < n; i++) supShot(f, f.x, f.y, a0 + (i - n / 2) * 0.22, { speed: 640, r: 8, dmg: SD(f, P) * 0.13, col, style: 'shard', life: 2.4, pierce: 1, bounce: 3, power: P });
  if (!FX.off) supSound(f, 'skill', 4);
}, true);
function mirrorUlt(f, P, col, dmg, god) {
  darkArena(3, '#e1f5fe', 0.16); camPunch(ARENA.cx, ARENA.cy, 0.1, 2);
  for (const p of BATTLE.projs) if (p.team !== f.team) { p.team = f.team; p.owner = f; p.vx = -p.vx; p.vy = -p.vy; p.target = null; p.reflected = true; p.life = Math.max(p.life, 1.2); }
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, god ? "◆ MIRROR GOD'S JUDGMENT ◆" : '◆ INFINITE REFLECTION ◆', '#e1f5fe', 42, { life: 2.6, vy: 0, pop: 2, stroke: '#263238' }); supSound(f, 'ult', god ? 2 : 0);
    vfx((ctx, q) => vMirrorHall(ctx, Math.sin(Math.PI * q), q), 2.6); }
  for (let i = 0; i < 8; i++) after(0.3 + i * 0.18, () => {
    if (!f.alive) return; const a = i * 0.785 + 0.3, cx = ARENA.cx, cy = ARENA.cy, L = 900;
    addLaser(f, [cx - dcos(a) * L, cy - dsin(a) * L, cx + dcos(a) * L, cy + dsin(a) * L], { charge: 0.25, dur: 0.5, w: 14, dmg: dmg * 0.1, col: i % 2 ? '#80d8ff' : '#ffffff' });
  });
  if (god) after(1.9, () => {
    if (!f.alive) return;
    for (const e of supEnemies(f)) { const own = Math.min((e.stats.dmg || 0) * 0.3, e.maxHp * 0.3) + dmg * 0.35; dealDamage(f, e, own, { kind: 'skill', tag: 'mirror', noDef: true, power: P }); if (!FX.off) { FX.text(e.x, e.y - e.r - 40, 'YOUR OWN POWER', '#e1f5fe', 15, { life: 1.2 }); FX.burst(e.x, e.y, '#ffffff', 30, 420, 5, 0.6, 'shard'); } }
    f.ultMeter = Math.min(100, f.ultMeter + 25); FX.addShake(16);
  });
}
UL('infinitereflection', 'Infinite Reflection — every enemy shot turns around and endless mirror beams cut across the arena', (f, P, col, dmg) => mirrorUlt(f, P, col, dmg, false));
UL('mirrorgodult', "Mirror God's Judgment — the reflection, then every enemy is struck by a mirror of the damage it has dealt", (f, P, col, dmg) => mirrorUlt(f, P, col, dmg, true));
supBall(B('mirrorgod', 'Mirror God Ball', 'Admin', 'Admin Exclusive', [136, 98, 96, 96, 82], D('#b0bec5', '#ffffff', '#80d8ff', 'mirrorgod', ['orbit'], '', { glow: 1.7, sdeco: ['shards'] }),
  [S('ATTACK REFLECTION', 'mi_reflect', 10, 70, '#e1f5fe'), S('MIRROR CLONE', 'mi_clone', 14, 70, '#ffffff'), S('MIRROR DIMENSION', 'mi_dimension', 12, 70, '#80d8ff'), S('PRISM BEAM', 'mi_prism', 7, 80, '#ffffff'), S('SHARD STORM', 'mi_shards', 6, 70, '#80d8ff')],
  U('INFINITE REFLECTION', 'infinitereflection', 135, '#e1f5fe'), 'adaptive', { desc: 'SUPREME ADMIN. The god of all mirrors — owner only. (The normal Mirror Ball is unchanged.)' }), {
  forms: [{ name: 'MIRROR GOD' }, { name: 'PRISMATIC SOVEREIGN', design: { c2: '#ea80fc', c3: '#80d8ff', glow: 1.9 } }, { name: 'INFINITE REFLECTION GOD', design: { c1: '#ffffff', c2: '#80d8ff', c3: '#ea80fc', glow: 2.4 } }],
  finalUlt: U("MIRROR GOD'S JUDGMENT", 'mirrorgodult', 155, '#ffffff'), sound: { base: 659, wave: 'triangle', slide: 1.3, noise: 6000 },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.4) FX.p(f.x + vr(-f.r, f.r) * 1.5, f.y + vr(-f.r, f.r) * 1.5, 0, 0, 0.5, vr(2, 4), '#ffffff', 'shard', 0); },
    bounce: (f, x, y, d) => FX.burst(x, y, d.c3, 8, 220, 4, 0.3, 'shard'),
    victory: (f, d) => { vfx((ctx, q) => vMirrorHall(ctx, 0.6 * (1 - q), q), 1.8); FX.text(f.x, f.y - f.r - 70, 'REFLECTION IS PERFECTION', d.c3, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, '#ffffff', 70, 600, 6, 1.0, 'shard'); Sound.play('shield'); },
    entrance: () => vfx((ctx, q) => vMirrorHall(ctx, Math.sin(Math.PI * q), q), 1.4),
  },
});

/* =================== 15. OMEGA (upgraded) =================== */
SK('om_beam', 'ranged', 'Ω', 'Omega Beam', 'A charged beam that keeps aiming at the target and grows wider the longer it fires', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  addLaser(f, [f.x, f.y, t.x, t.y], { charge: 0.5, dur: 1.4 + f.form * 0.3, w: 10, dmg: SD(f, P) * 0.24, col });
  BATTLE.lasers[BATTLE.lasers.length - 1].aim = { f, tgt: t, turn: 1.4, w0: 10, w1: 46 };
  if (!FX.off) supSound(f, 'skill', 0);
});
SK('om_absorb', 'curse', '⟴', 'Omega Absorb', "Drains the target: steals 30 of its ultimate charge and heals from the stolen energy", (f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e) return false;
  const take = Math.min(e.ultMeter || 0, 30); e.ultMeter -= take; f.ultMeter = Math.min(100, f.ultMeter + take);
  dealDamage(f, e, SD(f, P) * 0.45, { kind: 'skill', tag: 'skill', power: P }); healFighter(f, f.maxHp * 0.05 + take * 0.4);
  if (!FX.off) { for (let i = 0; i < 4; i++) FX.bolt(e.x, e.y, f.x, f.y, i % 2 ? '#00e5ff' : '#3d5afe', 3, 0.4); FX.text(e.x, e.y - e.r - 30, `-${Math.round(take)} ULT`, '#00e5ff', 15); supSound(f, 'skill', 1); }
});
SK('om_evolve', 'buff', '⇧', 'Omega Evolution', 'A sudden evolution: +20% power and speed for a few seconds, released with an energy wave', (f, s, P, col) => {
  f.st.buff = Math.max(f.st.buff, 4 + P / 60); f.st.buffPow = Math.max(f.st.buffPow, 0.2);
  supWave(f, f.x, f.y, 260, SD(f, P) * 0.35, col, { force: 500 });
  if (!FX.off) { FX.text(f.x, f.y - f.r - 30, 'EVOLVE', col, 18); FX.burst(f.x, f.y, col, 40, 500, 6, 0.7); supSound(f, 'skill', 2); }
}, true);
SK('om_cosmic', 'aoe', '⛤', 'Cosmic Pentagram', 'Five cosmic fragments surround the target, then lasers connect them into a burning star', (f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const cx = inArenaX(t.x, 120), cy = inArenaY(t.y, 120), R = 150, pts = [];
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * TAU; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x, y] of pts) ctx.drawImage(glowSprite(col), x - 20, y - 20, 40, 40); ctx.restore(); }, 0.7);
  after(0.6, () => { if (!f.alive) return; for (let i = 0; i < 5; i++) { const a = pts[i], b = pts[(i + 2) % 5]; addLaser(f, [a[0], a[1], b[0], b[1]], { charge: 0.1, dur: 0.8, w: 12, dmg: SD(f, P) * 0.2, col: i % 2 ? '#3d5afe' : col }); } });
  if (!FX.off) supSound(f, 'skill', 3);
});
SK('om_field', 'defense', '⬢', 'Omega Field', 'A hexagonal field around Omega: enemies inside are weakened and Omega takes less damage', (f, s, P, col) => {
  const life = 4 + P / 60; f.st.shield = Math.max(f.st.shield, life); f.st.shieldPow = Math.max(f.st.shieldPow, 0.3);
  supZone(f, { kind: 'custom', custom: true, follow: f, x: f.x, y: f.y, r: 190, life, col, onTick: (z, e, d) => { if (d < z.r + e.r * 0.5) e.st.nulled = Math.max(e.st.nulled, 0.3); },
    draw: (ctx, z, t) => { ctx.strokeStyle = 'rgba(0,229,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU + t * 0.5; ctx.lineTo(Math.cos(a) * z.r, Math.sin(a) * z.r); } ctx.stroke(); ctx.fillStyle = 'rgba(61,90,254,.08)'; ctx.fill(); } });
  if (!FX.off) supSound(f, 'skill', 4);
}, true);
function omegaUlt(f, P, col, dmg, asc) {
  const t = nearestEnemy(f); darkArena(3.2, '#02030a', 0.6); camPunch(ARENA.cx, ARENA.cy, 0.12, 2.4);
  if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 70, asc ? 'Ω OMEGA ASCENDANT Ω' : 'Ω OMEGA TERMINATION Ω', '#00e5ff', 44, { life: 2.6, vy: 0, pop: 2, stroke: '#02030a' }); supSound(f, 'ult', asc ? 2 : 0);
    vfx((ctx, q) => vOmega(ctx, ARENA.cx, ARENA.cy, 200 + q * 40, asc ? '#ffffff' : '#00e5ff', Math.sin(Math.PI * q)), 3); }
  if (t) for (let i = 0; i < 5; i++) after(0.3 + i * 0.12, () => { if (!f.alive || !t.alive) return; const a = -Math.PI / 2 + i / 5 * TAU, x = ARENA.cx + Math.cos(a) * 520, y = ARENA.cy + Math.sin(a) * 300; addLaser(f, [x, y, t.x, t.y], { charge: 0.3, dur: 0.9, w: 22, dmg: dmg * 0.1, col: i % 2 ? '#3d5afe' : '#00e5ff' }); });
  after(1.8, () => { if (!f.alive) return; const tt = t && t.alive ? t : nearestEnemy(f); if (tt) { supBlast(f, tt.x, tt.y, 240, dmg * 0.75, { force: 900, power: P }); darkBurst(tt.x, tt.y, 220, 1); } if (!FX.off) { FX.addFlash(0.3, '#00e5ff'); FX.addShake(18); } });
  if (asc) {
    healFighter(f, f.maxHp * 0.2);
    for (let i = 0; i < 20; i++) after(0.3 + i * 0.1, () => { if (f.alive) supStrike(f, ARENA.x + 80 + (i * 193) % (ARENA.w - 160), ARENA.y + 80 + (i * 131) % (ARENA.h - 160), 0.35, 80, dmg * 0.1, '#00e5ff', { kind: 'pillar' }); });
    after(2.4, () => { if (f.alive) for (const e of supEnemies(f)) { e.ultMeter = 0; for (const k of e.allSkills()) k.cdLeft = Math.max(k.cdLeft, 4); } });
  }
}
UL('omegatermination', 'Omega Termination — five beams from a giant Ω sigil converge on the target, then it collapses', (f, P, col, dmg) => omegaUlt(f, P, col, dmg, false));
UL('omegaascendant', 'Omega Ascendant — the termination plus omega pillars across the arena; enemies lose their ultimate charge', (f, P, col, dmg) => omegaUlt(f, P, col, dmg, true));
supBall(B('omega', 'Omega Ball', 'Admin', 'Admin Exclusive', [148, 104, 94, 88, 78], D('#05060f', '#00e5ff', '#3d5afe', 'omega', ['ring', 'orbit'], '', { glow: 1.7, sdeco: ['omegasigil'] }),
  [S('OMEGA BEAM', 'om_beam', 7, 85, '#00e5ff'), S('OMEGA ABSORB', 'om_absorb', 10, 70, '#3d5afe'), S('OMEGA EVOLUTION', 'om_evolve', 12, 70, '#00e5ff'), S('COSMIC PENTAGRAM', 'om_cosmic', 9, 80, '#00e5ff'), S('OMEGA FIELD', 'om_field', 12, 70, '#3d5afe')],
  U('OMEGA TERMINATION', 'omegatermination', 135, '#00e5ff'), 'tactical', { desc: 'SUPREME ADMIN. Commands the final cosmic energy at the end of the universe.' }), {
  forms: [{ name: 'OMEGA' }, { name: 'OMEGA PRIME', design: { c2: '#ffffff', c3: '#00e5ff', glow: 1.9 } }, { name: 'OMEGA ASCENDANT', design: { c1: '#ffffff', c2: '#00e5ff', c3: '#3d5afe', glow: 2.4 } }],
  finalUlt: U('OMEGA ASCENDANT', 'omegaascendant', 155, '#ffffff'), sound: { base: 147, wave: 'sawtooth', slide: 0.7, noise: 900 },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.5) { const a = vr(TAU); FX.p(f.x + Math.cos(a) * f.r * 1.5, f.y + Math.sin(a) * f.r * 1.5, -Math.cos(a) * 60, -Math.sin(a) * 60, 0.5, vr(2, 4), d.c2, 'dot', 0); } },
    bounce: (f, x, y, d) => FX.ring(x, y, d.c2, 70, 0.3, 4, 6),
    victory: (f, d) => { vfx((ctx, q) => vOmega(ctx, f.x, f.y - f.r - 80, 50, d.c2, 1 - q * 0.5), 1.8); FX.text(f.x, f.y - f.r - 150, 'THE END OF ALL THINGS', d.c2, 22, { life: 1.8 }); },
    defeat: (f, d) => { FX.burst(f.x, f.y, d.c2, 60, 600, 6, 1.0); darkBurst(f.x, f.y, 140, 0.8); },
    entrance: () => vfx((ctx, q) => vOmega(ctx, ARENA.cx, ARENA.cy, 260, '#00e5ff', Math.sin(Math.PI * q)), 1.4),
  },
});
/* =====================================================================
   SUPREME VISUALS — body patterns, decorations, projectiles, cinematic shapes (visual only)
   ===================================================================== */
const _gl = (g, R, col, a = 0.6, x = 0, y = 0) => _blob(g, x, y, R, col, a);
function _skullShape(g, x, y, s, col, jaw = 0) {      // a stylised skull: cranium, eye sockets, nose, teeth
  g.save(); g.translate(x, y);
  g.fillStyle = col; g.beginPath(); g.arc(0, -s * 0.15, s * 0.62, Math.PI * 0.9, Math.PI * 2.1); g.lineTo(s * 0.42, s * 0.32); g.lineTo(-s * 0.42, s * 0.32); g.closePath(); g.fill();
  g.beginPath(); g.rect(-s * 0.36, s * 0.3 + jaw * s * 0.25, s * 0.72, s * 0.24); g.fill();
  g.fillStyle = 'rgba(0,0,0,.92)';
  for (const sx2 of [-1, 1]) { g.beginPath(); g.ellipse(sx2 * s * 0.24, -s * 0.12, s * 0.17, s * 0.2, sx2 * 0.2, 0, TAU); g.fill(); }
  g.beginPath(); g.moveTo(0, s * 0.06); g.lineTo(-s * 0.07, s * 0.22); g.lineTo(s * 0.07, s * 0.22); g.closePath(); g.fill();
  for (let i = -2; i <= 2; i++) g.fillRect(i * s * 0.13 - s * 0.012, s * 0.3, s * 0.024, s * 0.14 + jaw * s * 0.25);
  g.restore();
}
Object.assign(PATTERN_FN, {
  reality(g, R, d, rng) {          // dark glass with a cyan code grid and floating "selection" frames
    g.strokeStyle = rgba(d.c2, 0.28); g.lineWidth = R * 0.012;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * R / 6, -R); g.lineTo(i * R / 6, R); g.stroke(); g.beginPath(); g.moveTo(-R, i * R / 6); g.lineTo(R, i * R / 6); g.stroke(); }
    g.font = `700 ${R * 0.11}px Consolas, monospace`; g.fillStyle = rgba(d.c2, 0.55);
    for (let i = 0; i < 26; i++) g.fillText(rng() < 0.5 ? '0' : '1', (rng() - 0.5) * R * 1.8, (rng() - 0.5) * R * 1.8);
    for (let i = 0; i < 3; i++) { const s = R * (0.25 + rng() * 0.2), x = (rng() - 0.5) * R, y = (rng() - 0.5) * R; g.strokeStyle = rgba(d.c3, 0.7); g.setLineDash([R * 0.04, R * 0.03]); g.strokeRect(x - s / 2, y - s / 2, s, s); g.setLineDash([]); }
    _gl(g, R * 0.55, d.c2, 0.55); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-R * 0.1, -R * 0.2); g.lineTo(-R * 0.1, R * 0.18); g.lineTo(0, R * 0.08); g.lineTo(R * 0.08, R * 0.24); g.lineTo(R * 0.13, R * 0.2); g.lineTo(R * 0.05, R * 0.05); g.lineTo(R * 0.17, R * 0.04); g.closePath(); g.fill();
  },
  skullking(g, R, d, rng) {        // black-violet sphere, a big skull face with crimson eye-glow
    g.fillStyle = '#05000a'; g.fillRect(-R, -R, 2 * R, 2 * R); _gl(g, R, d.c2, 0.45);
    for (let i = 0; i < 18; i++) { const a = rng() * TAU, r = R * (0.6 + rng() * 0.4); _skullShape(g, Math.cos(a) * r, Math.sin(a) * r, R * 0.09, rgba(d.c2, 0.45)); }
    _skullShape(g, 0, R * 0.02, R * 0.72, '#e8e4ee');
    for (const sx2 of [-1, 1]) { _gl(g, R * 0.2, d.c3, 1, sx2 * R * 0.17, -R * 0.09); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(sx2 * R * 0.17, -R * 0.09, R * 0.03, 0, TAU); g.fill(); }
  },
  thundergod(g, R, d, rng) {       // storm clouds with forked lightning and a glowing core
    PATTERN_FN.storm ? PATTERN_FN.storm(g, R, d, rng) : _gl(g, R, d.c2, 0.4);
    for (let i = 0; i < 6; i++) { let a = rng() * TAU, x = 0, y = 0; g.beginPath(); g.moveTo(0, 0); for (let k = 0; k < 6; k++) { a += (rng() - 0.5) * 1.2; x += Math.cos(a) * R * 0.17; y += Math.sin(a) * R * 0.17; g.lineTo(x, y); } g.strokeStyle = rgba(d.c2, 0.95); g.lineWidth = R * 0.035; g.shadowColor = d.c2; g.shadowBlur = R * 0.15; g.stroke(); g.shadowBlur = 0; }
    _gl(g, R * 0.4, '#ffffff', 0.9);
  },
  demonlord(g, R, d, rng) {        // molten rock with lava cracks and a slit demon eye
    PATTERN_FN.cracks ? PATTERN_FN.cracks(g, R, { ...d, c2: '#ff3d00' }, rng) : 0;
    for (let i = 0; i < 14; i++) _gl(g, R * (0.08 + rng() * 0.12), rng() < 0.5 ? d.c2 : '#ffab00', 0.7, (rng() - 0.5) * R * 1.6, (rng() - 0.5) * R * 1.6);
    g.fillStyle = '#ffab00'; g.beginPath(); g.ellipse(0, 0, R * 0.42, R * 0.2, 0, 0, TAU); g.fill(); g.fillStyle = '#1a0000'; g.beginPath(); g.ellipse(0, 0, R * 0.06, R * 0.19, 0, 0, TAU); g.fill();
    _gl(g, R * 0.5, d.c2, 0.4);
  },
  g404(g, R, d, rng) {             // corrupted pixels, shifted RGB bands and the "404"
    g.fillStyle = '#000'; g.fillRect(-R, -R, 2 * R, 2 * R);
    for (let i = 0; i < 90; i++) { const s = R * (0.04 + rng() * 0.08); g.fillStyle = rgba(['#00ff41', '#ff00e6', '#00e5ff', '#ffffff'][i % 4], 0.3 + rng() * 0.6); g.fillRect((rng() - 0.5) * 2 * R, (rng() - 0.5) * 2 * R, s, s); }
    for (let i = 0; i < 7; i++) { const y = (rng() - 0.5) * 2 * R; g.fillStyle = rgba(i % 2 ? d.c2 : d.c3, 0.35); g.fillRect(-R + rng() * R * 0.4, y, R * 2, R * 0.06); }
    g.font = `900 ${R * 0.62}px Consolas, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = rgba('#ff00e6', 0.8); g.fillText('404', -R * 0.04, R * 0.02); g.fillStyle = rgba('#00ff41', 0.8); g.fillText('404', R * 0.04, -R * 0.02); g.fillStyle = '#ffffff'; g.fillText('404', 0, 0);
  },
  dragonemp(g, R, d, rng) {        // golden scales on crimson with a reptile eye
    PATTERN_FN.scales ? PATTERN_FN.scales(g, R, d, rng) : 0;
    _gl(g, R * 0.9, d.c3, 0.35);
    g.fillStyle = d.c2; g.beginPath(); g.ellipse(0, 0, R * 0.36, R * 0.26, 0, 0, TAU); g.fill();
    g.fillStyle = '#1a0800'; g.beginPath(); g.ellipse(0, 0, R * 0.05, R * 0.24, 0, 0, TAU); g.fill();
    g.strokeStyle = rgba('#ffffff', 0.6); g.lineWidth = R * 0.02; g.beginPath(); g.ellipse(0, 0, R * 0.36, R * 0.26, 0, 0, TAU); g.stroke();
  },
  bloodgod(g, R, d, rng) {         // a crimson moon with craters and dripping blood veins
    _gl(g, R, d.c2, 0.6); for (let i = 0; i < 12; i++) { const x = (rng() - 0.5) * R * 1.5, y = (rng() - 0.5) * R * 1.5, r = R * (0.06 + rng() * 0.12); g.fillStyle = rgba('#000000', 0.35); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = rgba(d.c3, 0.5); g.lineWidth = R * 0.012; g.stroke(); }
    for (let i = 0; i < 8; i++) { let x = (rng() - 0.5) * R * 1.6, y = -R; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * R * 0.15; y += R * 0.2; g.lineTo(x, y); } g.strokeStyle = rgba('#5d0010', 0.85); g.lineWidth = R * 0.03; g.stroke(); }
  },
  timegod(g, R, d, rng) {          // a golden clock face with roman ticks and gears
    PATTERN_FN.clock ? PATTERN_FN.clock(g, R, d, rng) : 0;
    g.strokeStyle = rgba(d.c2, 0.9); g.lineWidth = R * 0.03; g.beginPath(); g.arc(0, 0, R * 0.78, 0, TAU); g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.lineWidth = R * (i % 3 ? 0.02 : 0.05); g.beginPath(); g.moveTo(Math.cos(a) * R * 0.64, Math.sin(a) * R * 0.64); g.lineTo(Math.cos(a) * R * 0.76, Math.sin(a) * R * 0.76); g.stroke(); }
    for (let k = 0; k < 2; k++) { const gx = (k ? 0.32 : -0.3) * R, gy = (k ? 0.3 : -0.28) * R, gr = R * 0.16; g.strokeStyle = rgba(d.c3, 0.6); g.lineWidth = R * 0.025; g.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU, rr = gr * (i % 2 ? 0.75 : 1); g.lineTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr); } g.stroke(); }
    _gl(g, R * 0.2, '#ffffff', 0.9);
  },
  infgod(g, R, d, rng) {           // deep space with a glowing ∞ loop of two colours
    PATTERN_FN.galaxy ? PATTERN_FN.galaxy(g, R, d, rng) : 0;
    for (const [col, w] of [[d.c3, 0.16], [d.c2, 0.07], ['#ffffff', 0.025]]) { g.strokeStyle = rgba(col, 0.85); g.lineWidth = R * w; g.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60 * TAU, s = Math.sin(t), c = Math.cos(t), den = 1 + s * s; g.lineTo(R * 0.7 * c / den, R * 0.7 * s * c / den); } g.stroke(); }
  },
  phoenixgod(g, R, d, rng) {       // white-hot core with swirling flame feathers
    PATTERN_FN.flame ? PATTERN_FN.flame(g, R, d, rng) : 0;
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.save(); g.rotate(a); g.fillStyle = rgba(i % 2 ? d.c2 : d.c3, 0.7); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(R * 0.35, -R * 0.2, R * 0.95, 0); g.quadraticCurveTo(R * 0.35, R * 0.1, 0, 0); g.fill(); g.restore(); }
    _gl(g, R * 0.45, '#ffffff', 0.95);
  },
  blacksun(g, R, d, rng) {         // pitch-black disk with an orange corona rim and dark plasma
    g.fillStyle = '#000000'; g.fillRect(-R, -R, 2 * R, 2 * R);
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + rng() * 0.2; g.strokeStyle = rgba(i % 2 ? d.c2 : d.c3, 0.75); g.lineWidth = R * 0.03; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7); g.quadraticCurveTo(Math.cos(a + 0.2) * R * 0.95, Math.sin(a + 0.2) * R * 0.95, Math.cos(a + 0.05) * R * 1.05, Math.sin(a + 0.05) * R * 1.05); g.stroke(); }
    const rim = g.createRadialGradient(0, 0, R * 0.55, 0, 0, R); rim.addColorStop(0, 'rgba(0,0,0,1)'); rim.addColorStop(0.75, rgba(d.c2, 0.5)); rim.addColorStop(1, rgba(d.c3, 0.95)); g.fillStyle = rim; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, R * 0.6, 0, TAU); g.fill();
  },
  mirrorgod(g, R, d, rng) {        // faceted chrome with rainbow glints
    PATTERN_FN.mirror ? PATTERN_FN.mirror(g, R, d, rng) : 0;
    for (let i = 0; i < 9; i++) { const a = rng() * TAU, r1 = R * rng(); g.fillStyle = rgba(['#ff80ab', '#80d8ff', '#ffffff', '#b9f6ca'][i % 4], 0.35); g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.lineTo(Math.cos(a + 0.7) * R, Math.sin(a + 0.7) * R); g.lineTo(Math.cos(a - 0.5) * R, Math.sin(a - 0.5) * R); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = R * 0.02; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.lineTo(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42); } g.closePath(); g.stroke(); _gl(g, R * 0.3, '#ffffff', 0.9);
  },
});
for (const p of ['reality', 'skullking', 'thundergod', 'demonlord', 'g404', 'dragonemp', 'bloodgod', 'timegod', 'infgod', 'phoenixgod', 'blacksun', 'mirrorgod']) if (!PATTERNS.includes(p)) PATTERNS.push(p);

/* ---------------- decorations drawn around a Supreme ball (back = behind the body) ---------------- */
SUP.deco = {
  cursor(ctx, r, d, t, front) { if (!front) return; ctx.save(); const x = r * 0.95 + Math.sin(t * 2) * r * 0.08, y = -r * 0.95; ctx.translate(x, y); ctx.rotate(-0.2); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#001018'; ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, r * 0.5); ctx.lineTo(r * 0.12, r * 0.38); ctx.lineTo(r * 0.22, r * 0.58); ctx.lineTo(r * 0.3, r * 0.54); ctx.lineTo(r * 0.2, r * 0.34); ctx.lineTo(r * 0.36, r * 0.33); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); },
  codering(ctx, r, d, t, front) { ctx.save(); ctx.rotate(t * 0.5); ctx.font = `700 ${r * 0.17}px Consolas, monospace`; ctx.fillStyle = rgba(d.c2, front ? 0.8 : 0.35); ctx.textAlign = 'center'; const s = 'ADMIN.ROOT//REALITY//'; for (let i = 0; i < s.length; i++) { const a = i / s.length * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; ctx.save(); ctx.translate(Math.cos(a) * r * 1.38, sn * r * 0.5); ctx.fillText(s[i], 0, 0); ctx.restore(); } ctx.restore(); },
  godhalo(ctx, r, d, t, front) { if (front) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.rotate(t * 0.3); ctx.strokeStyle = rgba(d.c2, 0.7); ctx.lineWidth = r * 0.05; for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.strokeRect(-r * 1.45, -r * 1.45, r * 2.9, r * 2.9); } ctx.restore(); },
  spectral(ctx, r, d, t, front) { if (front) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, h = r * (0.6 + 0.3 * Math.sin(t * 5 + i * 2)); ctx.save(); ctx.rotate(a); ctx.fillStyle = rgba(i % 2 ? d.c2 : d.c3, 0.35); ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.92); ctx.quadraticCurveTo(0, -r * 0.92 - h * 1.4, r * 0.2, -r * 0.92); ctx.fill(); ctx.restore(); } ctx.restore(); },
  miniskulls(ctx, r, d, t, front) { for (let i = 0; i < 4; i++) { const a = t * 1.4 + i / 4 * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; _skullShape(ctx, Math.cos(a) * r * 1.45, sn * r * 0.55, r * 0.22, '#e0e0e0'); } },
  darkcrown(ctx, r, d, t, front) { if (!front) return; ctx.save(); ctx.translate(0, -r * 1.02 + Math.sin(t * 3) * r * 0.04); ctx.fillStyle = '#12001c'; ctx.strokeStyle = d.c3; ctx.lineWidth = r * 0.035; ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); for (let i = 0; i <= 6; i++) { const x = -r * 0.55 + i * r * 0.183; ctx.lineTo(x, i % 2 ? -r * 0.18 : -r * 0.46); } ctx.lineTo(r * 0.55, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); for (let i = 0; i < 3; i++) _gl(ctx, r * 0.09, d.c3, 1, -r * 0.37 + i * r * 0.37, -r * 0.08); ctx.restore(); },
  voidrift(ctx, r, d, t, front) { if (front) return; ctx.save(); ctx.rotate(-t * 0.6); for (let k = 0; k < 3; k++) { ctx.strokeStyle = rgba(k ? d.c2 : '#ffffff', 0.5 - k * 0.12); ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.ellipse(0, 0, r * (1.5 + k * 0.2), r * (0.4 + k * 0.1), k * 1.1, 0, TAU); ctx.stroke(); } ctx.restore(); },
  boltcrown(ctx, r, d, t, front) { if (!front) return; ctx.save(); ctx.translate(0, -r * 1.05); ctx.strokeStyle = d.c2; ctx.lineWidth = r * 0.06; ctx.shadowColor = d.c2; ctx.shadowBlur = r * 0.3; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.22, 0); ctx.lineTo(i * r * 0.22 + r * 0.08, -r * 0.2); ctx.lineTo(i * r * 0.22 - r * 0.04, -r * 0.22); ctx.lineTo(i * r * 0.22 + r * 0.04, -r * (0.42 + (i % 2 ? 0 : 0.12))); ctx.stroke(); } ctx.restore(); if (Math.random() < 0.08) { ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); let a = Math.random() * TAU, x = Math.cos(a) * r, y = Math.sin(a) * r; ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += Math.cos(a) * r * 0.2 + (Math.random() - 0.5) * r * 0.3; y += Math.sin(a) * r * 0.2 + (Math.random() - 0.5) * r * 0.3; ctx.lineTo(x, y); } ctx.stroke(); ctx.restore(); } },
  hellfire(ctx, r, d, t, front) { if (front) return; _flames(ctx, r * 1.05, '#ff3d00', t * 1.4, 14, 1.5); _flames(ctx, r * 0.98, '#ffab00', t * 1.9 + 2, 10, 1.1); },
  errorpopups(ctx, r, d, t, front) { if (!front) return; const k = Math.floor(t * 1.5); for (let i = 0; i < 2; i++) { const h2 = hashStr('e' + (k + i * 7)), x = ((h2 % 100) / 50 - 1) * r * 1.4, y = (((h2 >> 7) % 100) / 50 - 1) * r * 1.2; vErrorWindow(ctx, x - r * 0.4, y - r * 0.2, 'ERROR', '0x404', 0.75, r * 0.8); } },
  dragoneye(ctx, r, d, t, front) { if (front) return; ctx.save(); ctx.rotate(Math.sin(t) * 0.2); ctx.strokeStyle = rgba(d.c2, 0.5); ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const a = -Math.PI * 0.9 + i / 40 * Math.PI * 1.8; ctx.lineTo(Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.4 + Math.sin(i * 0.8 + t * 6) * r * 0.08); } ctx.stroke(); ctx.restore(); },
  bats(ctx, r, d, t, front) { for (let i = 0; i < 5; i++) { const a = t * 2 + i / 5 * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; _batShape(ctx, Math.cos(a) * r * 1.5, sn * r * 0.6 - r * 0.2, r * 0.22, '#1a0003', t * 18 + i); } },
  clockhands(ctx, r, d, t, front) { if (!front) return; ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 0.5 - 1.57) * r * 0.45, Math.sin(t * 0.5 - 1.57) * r * 0.45); ctx.stroke(); ctx.lineWidth = r * 0.04; ctx.strokeStyle = d.c2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 6 - 1.57) * r * 0.7, Math.sin(t * 6 - 1.57) * r * 0.7); ctx.stroke(); ctx.restore(); ctx.save(); ctx.rotate(-t * 0.4); ctx.strokeStyle = rgba(d.c2, 0.5); ctx.lineWidth = r * 0.03; ctx.setLineDash([r * 0.06, r * 0.18]); ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, TAU); ctx.stroke(); ctx.restore(); },
  infloop(ctx, r, d, t, front) { const n = 6; for (let i = 0; i < n; i++) { const a = t * 1.6 + i / n * TAU, s = Math.sin(a), c = Math.cos(a), den = 1 + s * s, z = Math.cos(a * 2); if ((z > 0) !== front) continue; _gl(ctx, r * 0.18, i % 2 ? d.c2 : d.c3, 0.9, r * 1.6 * c / den, r * 1.6 * s * c / den); } },
  firecrown(ctx, r, d, t, front) { if (!front) return; ctx.save(); ctx.translate(0, -r * 0.98); for (let i = -3; i <= 3; i++) { const h2 = r * (0.3 + 0.12 * Math.sin(t * 9 + i * 1.7)) * (i % 2 ? 0.7 : 1); ctx.fillStyle = rgba(i % 2 ? d.c3 : d.c2, 0.85); ctx.beginPath(); ctx.moveTo(i * r * 0.14 - r * 0.07, 0); ctx.quadraticCurveTo(i * r * 0.14, -h2 * 1.4, i * r * 0.14 + r * 0.07, 0); ctx.fill(); } ctx.restore(); },
  corona(ctx, r, d, t, front) { if (front) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + t * 0.3, l = r * (0.35 + 0.25 * Math.sin(t * 4 + i * 1.3)); ctx.strokeStyle = rgba(i % 2 ? d.c2 : d.c3, 0.6); ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a + 0.08) * (r + l), Math.sin(a + 0.08) * (r + l)); ctx.stroke(); } ctx.restore(); },
  shards(ctx, r, d, t, front) { for (let i = 0; i < 6; i++) { const a = t * 0.9 + i / 6 * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; ctx.save(); ctx.translate(Math.cos(a) * r * 1.45, sn * r * 0.55); ctx.rotate(t * 2 + i); ctx.fillStyle = rgba(i % 2 ? '#ffffff' : d.c3, 0.85); ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(r * 0.09, 0); ctx.lineTo(0, r * 0.2); ctx.lineTo(-r * 0.09, 0); ctx.closePath(); ctx.fill(); ctx.restore(); } },
  omegasigil(ctx, r, d, t, front) { if (front) return; ctx.save(); ctx.rotate(t * 0.25); ctx.strokeStyle = rgba(d.c2, 0.45); ctx.lineWidth = r * 0.035; ctx.beginPath(); for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + (k * 2) / 5 * TAU; ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5); } ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, TAU); ctx.stroke(); ctx.restore(); },
};
/** hook called from drawBall: back layer (front=false) and front layer (front=true) */
function drawSupDeco(ctx, def, r, t, st, front) {
  const list = def.design.sdeco; if (!list || st.noSupDeco) return;
  const d = def.design;
  for (const k of list) { const fn = SUP.deco[k]; if (fn) { try { fn(ctx, r, d, t, front); } catch (e) { /* visual only */ } } }
}
function _batShape(ctx, x, y, s, col, flap) {
  const w = Math.sin(flap) * 0.5 + 0.5; ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(255,23,68,.7)'; ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.6, -s * (0.2 + w * 0.6), -s * 1.2, -s * 0.1); ctx.quadraticCurveTo(-s * 0.8, s * 0.1, -s * 0.6, s * 0.3); ctx.quadraticCurveTo(-s * 0.3, s * 0.1, 0, s * 0.25);
  ctx.quadraticCurveTo(s * 0.3, s * 0.1, s * 0.6, s * 0.3); ctx.quadraticCurveTo(s * 0.8, s * 0.1, s * 1.2, -s * 0.1); ctx.quadraticCurveTo(s * 0.6, -s * (0.2 + w * 0.6), 0, 0); ctx.fill(); ctx.stroke(); ctx.restore();
}

/* ---------------- projectile looks ---------------- */
function drawSupProj(ctx, p) {
  const s = p.style, r = p.r, a = datan2(p.vy, p.vx), t = BATTLE ? BATTLE.time : 0;
  switch (s) {
    case 'skull': ctx.drawImage(glowSprite(p.col), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.globalCompositeOperation = 'source-over'; _skullShape(ctx, p.x, p.y, r * 1.6, '#f3e5f5'); ctx.globalCompositeOperation = 'lighter'; return true;
    case 'darkorb': ctx.drawImage(glowSprite(p.col), p.x - r * 4, p.y - r * 4, r * 8, r * 8); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r + 2, t * 6, t * 6 + 4); ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; return true;
    case 'boltclone': ctx.globalCompositeOperation = 'source-over'; if (p.data && p.data.def) drawBall(ctx, p.data.def, p.x, p.y, r, { t, alpha: 0.55, noAura: true, small: true, noSupDeco: true }); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#ffee58'), p.x - r * 2, p.y - r * 2, r * 4, r * 4); return true;
    case 'feather': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = p.col; ctx.beginPath(); ctx.moveTo(r * 2, 0); ctx.quadraticCurveTo(0, -r * 0.9, -r * 2, 0); ctx.quadraticCurveTo(0, r * 0.9, r * 2, 0); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * 2, 0); ctx.lineTo(r * 2, 0); ctx.stroke(); ctx.restore(); return true;
    case 'halo': ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.45); ctx.rotate(t * 10); ctx.strokeStyle = p.col; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); return true;
    case 'pixel': for (let i = 0; i < 5; i++) { const q = r * 0.8; ctx.fillStyle = ['#00ff41', '#ff00e6', '#ffffff', '#00e5ff', '#00ff41'][i]; ctx.fillRect(p.x - p.vx * 0.012 * i - q / 2 + Math.sin(t * 40 + i) * 3, p.y - p.vy * 0.012 * i - q / 2, q, q); } return true;
    case 'bat': ctx.globalCompositeOperation = 'source-over'; _batShape(ctx, p.x, p.y, r * 1.3, '#1a0003', t * 20 + p.x * 0.05); ctx.globalCompositeOperation = 'lighter'; return true;
    case 'echo': ctx.globalCompositeOperation = 'source-over'; if (p.data && p.data.def) drawBall(ctx, p.data.def, p.x, p.y, r, { t, alpha: 0.4, tint: 'rgba(255,215,64,0.35)', noAura: true, small: true, noSupDeco: true }); ctx.globalCompositeOperation = 'lighter'; return true;
    case 'spirithead': case 'spirit': ctx.drawImage(glowSprite(p.col), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.fillStyle = s === 'spirithead' ? '#ffffff' : p.col; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.8, 0, TAU); ctx.fill(); if (s === 'spirithead') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = '#ff3d00'; ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.35, r * 0.18, 0, TAU); ctx.arc(r * 0.3, r * 0.35, r * 0.18, 0, TAU); ctx.fill(); ctx.strokeStyle = p.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.7); ctx.lineTo(-r * 1.4, -r * 1.3); ctx.moveTo(-r * 0.2, r * 0.7); ctx.lineTo(-r * 1.4, r * 1.3); ctx.stroke(); ctx.restore(); } return true;
    case 'blood': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = '#d50000'; ctx.beginPath(); ctx.moveTo(r * 2.2, 0); ctx.lineTo(-r, -r * 0.6); ctx.lineTo(-r, r * 0.6); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.drawImage(glowSprite('#ff1744'), p.x - r * 2.5, p.y - r * 2.5, r * 5, r * 5); return true;
    case 'fireball2': case 'flame': case 'flare': case 'plasma': { const big = s === 'plasma' ? 4.5 : 3.4; ctx.drawImage(glowSprite(p.col), p.x - r * big, p.y - r * big, r * big * 2, r * big * 2); for (let i = 1; i <= 3; i++) ctx.drawImage(glowSprite(i % 2 ? '#ff6d00' : '#ffea00'), p.x - p.vx * 0.02 * i - r, p.y - p.vy * 0.02 * i - r, r * 2, r * 2); ctx.fillStyle = s === 'plasma' ? '#fff3e0' : '#fff59d'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.6, 0, TAU); ctx.fill(); return true; }
    case 'shard': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(r * 1.8, 0); ctx.lineTo(0, -r * 0.6); ctx.lineTo(-r * 1.2, 0); ctx.lineTo(0, r * 0.6); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.drawImage(glowSprite(p.col), p.x - r * 2.4, p.y - r * 2.4, r * 4.8, r * 4.8); return true;
    case 'infloop': ctx.drawImage(glowSprite(p.col), p.x - r * 3.4, p.y - r * 3.4, r * 6.8, r * 6.8); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.55, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba('#e040fb', 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.2, t * 8, t * 8 + 3); ctx.stroke(); return true;
  }
  const fn = SUP.projStyles && SUP.projStyles[s]; if (fn) { fn(ctx, p, t, r, a); return true; }
  return false;
}

/* ---------------- big cinematic shapes (vfx layer) ---------------- */
function vSkull(ctx, x, y, s, col, a, jaw = 0, god) {
  if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), x - s * 1.4, y - s * 1.4, s * 2.8, s * 2.8); ctx.globalCompositeOperation = 'source-over';
  _skullShape(ctx, x, y, s, god ? '#fff8e1' : '#ede7f6', jaw);
  ctx.globalCompositeOperation = 'lighter'; for (const sx2 of [-1, 1]) ctx.drawImage(glowSprite(god ? '#ffd54f' : '#ff1744'), x + sx2 * s * 0.24 - s * 0.2, y - s * 0.12 - s * 0.2, s * 0.4, s * 0.4);
  if (god) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.66); for (let i = 0; i <= 6; i++) ctx.lineTo(x - s * 0.5 + i * s / 6, y - s * (i % 2 ? 0.8 : 1.05)); ctx.lineTo(x + s * 0.5, y - s * 0.66); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function vThunderSigil(ctx, x, y, r, col, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.stroke(); for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(0, -r * 0.75); ctx.lineTo(r * 0.08, -r * 0.88); ctx.lineTo(-r * 0.03, -r * 0.9); ctx.lineTo(0, -r); ctx.stroke(); } ctx.fillStyle = rgba('#ffee58', 0.5); ctx.beginPath(); ctx.moveTo(r * 0.12, -r * 0.5); ctx.lineTo(-r * 0.2, r * 0.05); ctx.lineTo(0, r * 0.05); ctx.lineTo(-r * 0.12, r * 0.5); ctx.lineTo(r * 0.22, -r * 0.08); ctx.lineTo(0, -r * 0.08); ctx.closePath(); ctx.fill(); ctx.restore(); }
function vHeavenGate(ctx, x, y, w, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, y, 0, y + w * 1.4); g.addColorStop(0, 'rgba(255,248,225,.9)'); g.addColorStop(1, 'rgba(255,213,79,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.6, y + w * 1.4); ctx.lineTo(x - w * 0.6, y + w * 1.4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,215,0,.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y + w * 0.45, w * 0.45, Math.PI, 0); ctx.moveTo(x - w * 0.45, y + w * 0.45); ctx.lineTo(x - w * 0.45, y + w * 1.1); ctx.moveTo(x + w * 0.45, y + w * 0.45); ctx.lineTo(x + w * 0.45, y + w * 1.1); ctx.stroke(); ctx.restore(); }
function vPentagram(ctx, x, y, r, col, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.beginPath(); for (let k = 0; k <= 5; k++) { const an = -Math.PI / 2 + k * 2 / 5 * TAU; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.stroke(); ctx.restore(); }
function vHellGate(ctx, x, y, r, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#ffab00'); g.addColorStop(0.35, '#ff3d00'); g.addColorStop(0.7, '#3e0000'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.25, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#1a0000'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.ellipse(x, y, r * 1.05, r * 1.3, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#1a0000'; for (let i = 0; i < 10; i++) { const an = i / 10 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r * 1.1, y + Math.sin(an) * r * 1.35); ctx.lineTo(x + Math.cos(an + 0.15) * r * 1.4, y + Math.sin(an + 0.15) * r * 1.7); ctx.lineTo(x + Math.cos(an + 0.3) * r * 1.1, y + Math.sin(an + 0.3) * r * 1.35); ctx.fill(); } vPentagram(ctx, x, y, r * 0.6, '#ffab00', a * 0.8); ctx.restore(); }
function vBlueScreen(ctx, panic, q) {
  const a = q < 0.1 ? q * 10 : q > 0.8 ? (1 - q) * 5 : 1; if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = 0.82 * a; ctx.fillStyle = panic ? '#000000' : '#0d47a1'; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.globalAlpha = a;
  ctx.fillStyle = panic ? '#00ff41' : '#ffffff'; ctx.font = '900 64px "Segoe UI", sans-serif'; ctx.fillText(':(', ARENA.x + 60, ARENA.y + 110);
  ctx.font = '600 20px Consolas, monospace'; const lines = panic ? ['KERNEL PANIC — not syncing: arena.exe', 'Rebooting reality in 3… 2… 1…', 'STOP CODE: GLITCH_404_GOD'] : ['Your arena ran into a problem and needs to restart.', `${Math.min(100, Math.floor(q * 140))}% complete`, 'Stop code: ERROR_404_BALL_NOT_FOUND'];
  lines.forEach((l, i) => ctx.fillText(l, ARENA.x + 60, ARENA.y + 170 + i * 32));
  for (let i = 0; i < 6; i++) { ctx.fillStyle = rgba(i % 2 ? '#ff00e6' : '#00ff41', 0.25); ctx.fillRect(ARENA.x, ARENA.y + ((q * 900 + i * 137) % ARENA.h), ARENA.w, 6 + i); }
  ctx.restore();
}
function vErrorWindow(ctx, x, y, title, msg, a, w = 190) {
  if (a <= 0.01) return; const h = w * 0.42; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  ctx.fillStyle = '#c0c0c0'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#000080'; ctx.fillRect(x + 2, y + 2, w - 4, h * 0.26); ctx.fillStyle = '#ffffff'; ctx.font = `700 ${Math.max(8, h * 0.17)}px "Segoe UI", sans-serif`; ctx.textAlign = 'left'; ctx.fillText(title, x + 6, y + h * 0.2);
  ctx.fillStyle = '#000'; ctx.font = `600 ${Math.max(7, h * 0.15)}px "Segoe UI", sans-serif`; ctx.fillText(msg, x + 8, y + h * 0.58); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(x + w * 0.38, y + h * 0.68, w * 0.24, h * 0.22); ctx.fillText('OK', x + w * 0.46, y + h * 0.85);
  ctx.restore();
}
function vClaw(ctx, x, y, len2, ang, col, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); for (let i = -1; i <= 1; i++) { ctx.strokeStyle = col; ctx.lineWidth = 7 - Math.abs(i) * 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(i * 18 - len2 * 0.4, -len2); ctx.quadraticCurveTo(i * 18 + 10, 0, i * 18 - len2 * 0.4, len2); ctx.stroke(); } ctx.restore(); }
function vDragonHead(ctx, x, y, s, col, a, q) {
  if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y); const jaw = Math.abs(Math.sin(q * 12)) * 0.35;
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), -s * 2, -s * 2, s * 4, s * 4); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = shade(col, -0.45); ctx.strokeStyle = col; ctx.lineWidth = s * 0.05;
  ctx.beginPath(); ctx.moveTo(-s, -s * 0.2); ctx.quadraticCurveTo(-s * 0.2, -s * 0.9, s * 0.9, -s * 0.3); ctx.lineTo(s * 1.3, -s * 0.05); ctx.lineTo(s * 0.4, s * 0.05); ctx.quadraticCurveTo(-s * 0.4, s * 0.1, -s, -s * 0.2); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.rotate(jaw); ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.05); ctx.lineTo(s * 1.1, s * 0.12); ctx.lineTo(s * 0.4, s * 0.45); ctx.quadraticCurveTo(-s * 0.3, s * 0.45, -s * 0.6, s * 0.05); ctx.fill(); ctx.stroke(); ctx.restore();
  for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-s * (0.3 + i * 0.3), -s * 0.55); ctx.quadraticCurveTo(-s * (0.9 + i * 0.3), -s * 1.4, -s * (1.4 + i * 0.2), -s * 1.1); ctx.quadraticCurveTo(-s * (0.8 + i * 0.3), -s * 0.9, -s * (0.5 + i * 0.3), -s * 0.4); ctx.fill(); ctx.stroke(); }
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#ffea00'), s * 0.2, -s * 0.55, s * 0.4, s * 0.4); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s * 0.4, -s * 0.35, s * 0.06, 0, TAU); ctx.fill();
  if (jaw > 0.15) for (let i = 0; i < 4; i++) ctx.drawImage(glowSprite(i % 2 ? '#ff6d00' : '#ffea00'), s * (1.2 + i * 0.35) - s * 0.3, s * 0.1 - s * 0.3 + Math.sin(q * 30 + i) * s * 0.1, s * 0.6, s * 0.6);
  ctx.restore();
}
function vMoon(ctx, x, y, r, col, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2); ctx.globalCompositeOperation = 'source-over'; const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#ff8a80'); g.addColorStop(1, '#7f0000'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(60,0,0,.35)'; for (const [cx2, cy2, cr] of [[0.3, -0.2, 0.2], [-0.35, 0.25, 0.15], [0.1, 0.45, 0.12], [-0.2, -0.4, 0.1]]) { ctx.beginPath(); ctx.arc(x + cx2 * r, y + cy2 * r, cr * r, 0, TAU); ctx.fill(); } ctx.restore(); }
function vClock(ctx, x, y, r, col, a, rot = 0) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, r * 0.03); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.font = `700 ${Math.max(9, r * 0.13)}px Georgia, serif`; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const N = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU - Math.PI / 2; ctx.fillText(N[i], Math.cos(an) * r * 0.82, Math.sin(an) * r * 0.82); } ctx.lineCap = 'round'; ctx.lineWidth = Math.max(3, r * 0.05); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(rot - Math.PI / 2) * r * 0.5, Math.sin(rot - Math.PI / 2) * r * 0.5); ctx.stroke(); ctx.lineWidth = Math.max(2, r * 0.025); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(rot * 12 - Math.PI / 2) * r * 0.72, Math.sin(rot * 12 - Math.PI / 2) * r * 0.72); ctx.stroke(); ctx.restore(); }
function vInfinity(ctx, x, y, s, col, a, rot = 0) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); for (const [w, c] of [[s * 0.12, rgba(col, 0.35)], [s * 0.05, col], [s * 0.015, '#ffffff']]) { ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, w); ctx.beginPath(); for (let i = 0; i <= 80; i++) { const t2 = i / 80 * TAU, sn = Math.sin(t2), cs = Math.cos(t2), den = 1 + sn * sn; ctx.lineTo(s * cs / den, s * sn * cs / den); } ctx.stroke(); } const t2 = rot, sn = Math.sin(t2), cs = Math.cos(t2), den = 1 + sn * sn; ctx.drawImage(glowSprite('#ffffff'), s * cs / den - s * 0.1, s * sn * cs / den - s * 0.1, s * 0.2, s * 0.2); ctx.restore(); }
function vPhoenix(ctx, x, y, s, col, a, q) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); const flap = Math.sin(q * 14) * 0.25; for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd, 1); ctx.rotate(-flap); for (let i = 0; i < 7; i++) { ctx.fillStyle = rgba(i % 2 ? col : '#ffea00', 0.55); ctx.beginPath(); ctx.moveTo(s * 0.1, 0); ctx.quadraticCurveTo(s * (0.6 + i * 0.1), -s * (0.9 - i * 0.12), s * (1.2 + i * 0.05), -s * (0.4 - i * 0.12)); ctx.quadraticCurveTo(s * 0.7, -s * 0.1, s * 0.1, 0); ctx.fill(); } ctx.restore(); } ctx.fillStyle = rgba('#ff6d00', 0.6); ctx.beginPath(); ctx.moveTo(-s * 0.15, s * 0.1); ctx.quadraticCurveTo(0, s * 1.2, s * 0.15, s * 0.1); ctx.fill(); ctx.drawImage(glowSprite('#ffffff'), -s * 0.3, -s * 0.3, s * 0.6, s * 0.6); ctx.restore(); }
function vSun(ctx, x, y, r, col, a, q, black) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), x - r * 3, y - r * 3, r * 6, r * 6); ctx.translate(x, y); ctx.rotate(q * 2); for (let i = 0; i < 20; i++) { const an = i / 20 * TAU, l = r * (0.35 + 0.25 * Math.sin(q * 20 + i * 1.7)); ctx.strokeStyle = rgba(i % 2 ? col : '#ffea00', 0.8); ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); ctx.lineTo(Math.cos(an) * (r + l), Math.sin(an) * (r + l)); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = black ? '#000000' : '#fff8e1'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); if (black) { ctx.strokeStyle = col; ctx.lineWidth = r * 0.06; ctx.stroke(); } ctx.restore(); }
function vMirrorHall(ctx, a, q) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1) * 0.7; ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { const x = ARENA.x + ARENA.w * ((i + 0.5) / 7), w = 30 + 20 * Math.sin(q * 6 + i); const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, 'rgba(128,216,255,0)'); g.addColorStop(0.5, 'rgba(225,245,254,.5)'); g.addColorStop(1, 'rgba(234,128,252,0)'); ctx.fillStyle = g; ctx.save(); ctx.translate(x, ARENA.cy); ctx.transform(1, 0, 0.25 * Math.sin(q * 3 + i), 1, 0, 0); ctx.fillRect(-w, -ARENA.h / 2, w * 2, ARENA.h); ctx.restore(); } ctx.restore(); }
function vOmega(ctx, x, y, s, col, a) { if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.drawImage(glowSprite(col), -s * 1.4, -s * 1.4, s * 2.8, s * 2.8); ctx.strokeStyle = col; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke(); ctx.font = `900 ${s * 1.2}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(col, 0.9); ctx.fillText('Ω', 0, s * 0.05); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `900 ${s * 1.05}px Georgia, serif`; ctx.fillText('Ω', 0, s * 0.05); ctx.restore(); }

/* GOD CLASH: two ultimate beams meet; the contact point is pushed toward the weaker ball as the clash goes on */
function vClash(ctx, c, q) {
  const a = c.a, b = c.b, dx = c.bx - c.ax, dy = c.by - c.ay;
  const push = clamp(c.m, -0.6, 0.6) * Math.min(1, q * 1.4) * 0.8, mx = c.x + dx * push * 0.5, my = c.y + dy * push * 0.5, t = q * 40;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [f, x, y] of [[a, c.ax, c.ay], [b, c.bx, c.by]]) {
    const d = f.def.design, wob = 1 + 0.25 * Math.sin(t + (f === a ? 0 : 2));
    for (const [w, col] of [[46 * wob, rgba(d.c3, 0.25)], [22 * wob, rgba(d.c2, 0.8)], [8, '#ffffff']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mx, my); ctx.stroke(); }
    const r = 70 * wob; ctx.drawImage(glowSprite(d.c3), x - r, y - r, r * 2, r * 2);
  }
  const R = 90 + 40 * Math.sin(t * 1.7); ctx.drawImage(glowSprite('#ffffff'), mx - R, my - R, R * 2, R * 2);
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) { const an = i / 10 * TAU + t * 0.3, l = 60 + 50 * Math.abs(Math.sin(t + i)); ctx.beginPath(); ctx.moveTo(mx, my); let x = mx, y = my; for (let k = 0; k < 4; k++) { x += Math.cos(an + (Math.random() - 0.5)) * l / 4; y += Math.sin(an + (Math.random() - 0.5)) * l / 4; ctx.lineTo(x, y); } ctx.stroke(); }
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = rgba(i % 2 ? '#ffd54f' : '#ffffff', 0.5 * (1 - ((q * 3 + i / 3) % 1))); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(mx, my, 40 + ((q * 3 + i / 3) % 1) * 260, 0, TAU); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over'; ctx.font = '900 22px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#000';
  const shown = Math.min(1, q * 2), pa = Math.round(c.pa / 100 * shown), pb = Math.round(c.pb / 100 * shown);
  for (const [v, x, y, col] of [[pa, c.ax, c.ay - a.r - 46, a.def.design.c2], [pb, c.bx, c.by - b.r - 46, b.def.design.c2]]) { ctx.strokeText('⚡ ' + v, x, y); ctx.fillStyle = col; ctx.fillText('⚡ ' + v, x, y); }
  ctx.restore();
}
/* =====================================================================
   OWNER UI — ADMIN DELETE console, test-battle bar, Admin Ball Control Panel (browser only)
   Everything here is a view: each command is an engine input that the server replays and checks,
   and every settings change goes through owner-only server endpoints that validate and audit-log it.
   ===================================================================== */
if (!window.NBB_HEADLESS) {
  const css = `
  .sup-ov{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,8,16,.72);backdrop-filter:blur(3px);padding:12px}
  .sup-con{width:min(720px,100%);max-height:92vh;overflow:auto;background:#06121d;border:2px solid #00e5ff;border-radius:14px;box-shadow:0 0 40px rgba(0,229,255,.35);padding:14px 14px 10px;color:#e0f7ff;font:14px "Segoe UI",sans-serif}
  .sup-con h3{margin:0 0 4px;color:#00e5ff;font:800 20px Consolas,monospace;letter-spacing:1px}
  .sup-con .muted{color:#8fb3c4;font-size:12px}
  .sup-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0;border-top:1px solid rgba(0,229,255,.18)}
  .sup-row b{min-width:130px}.sup-row .tm{font-size:11px;padding:2px 6px;border-radius:6px;background:#0d2b3d}
  .sup-con select,.sup-con input[type=number]{background:#021018;color:#e0f7ff;border:1px solid #00e5ff66;border-radius:6px;padding:4px 6px;font-size:13px;max-width:170px}
  .sup-btn{background:#0b2a3a;color:#e0f7ff;border:1px solid #00e5ff88;border-radius:7px;padding:6px 10px;font-weight:700;cursor:pointer;font-size:13px}
  .sup-btn:hover{background:#0f3a50}.sup-btn.red{border-color:#ff5252;color:#ffcdd2;background:#3a0b12}.sup-btn.gold{border-color:#ffd54f;color:#fff3c4;background:#3a2c0b}
  .sup-test{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:40;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:96vw;background:rgba(4,14,24,.82);border:1px solid #00e5ff77;border-radius:12px;padding:6px 8px}
  .sup-test .sup-btn{padding:5px 8px;font-size:12px}
  .sup-panel .forms{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.sup-panel .forms figure{margin:0;text-align:center}.sup-panel .forms figcaption{font:800 12px "Segoe UI";color:#ffd54f}
  .sup-panel .abil{display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center}.sup-panel .abil small{color:#8fb3c4}
  .sup-panel .ctl{display:grid;grid-template-columns:1fr;gap:8px}.sup-panel label{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  @media (max-width:560px){.sup-row b{min-width:0;width:100%}.sup-con{padding:10px}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
}

/* ---------------- ADMIN DELETE console ---------------- */
const supTransformList = () => allBalls().filter(b => b.enabled && !b.summonOnly && !b.unit && !b.draft);
function supEl(tag, attrs, ...kids) { return h(tag, attrs || {}, ...kids); }
UI.adminConsole = function (f) {
  const B = BATTLE; if (!B || !f || !f.sx || B.cfg.demo || document.querySelector('.sup-ov')) return;
  const solo = !B.pvp, wasPaused = B.paused;
  if (solo) B.paused = true;                       // single player: the battle waits while the owner decides
  let left = f.sx.adminLeft | 0; const queued = [];
  const ov = supEl('div', { class: 'sup-ov' }), box = supEl('div', { class: 'sup-con' }); ov.append(box); ov._b = B; document.body.append(ov);
  const close = () => { ov.remove(); if (solo && BATTLE === B) B.paused = wasPaused; };
  const send = (cmd, sid, v1 = 0, v2 = 0, label = '') => {
    if (left <= 0) return toast('No admin commands left');
    const a = [cmd | 0, sid | 0, Math.round(v1) | 0, Math.round(v2) | 0];
    if (B.net) B.net.adminCmd(a); else B.actions.push(['x', ...a]);
    left--; queued.push(label); Sound.play('click'); render();
    if (left <= 0) setTimeout(close, 350);
  };
  const tl = supTransformList();
  function render() {
    box.innerHTML = '';
    box.append(supEl('h3', {}, '▣ ADMIN DELETE — owner console'),
      supEl('div', { class: 'muted' }, `Commands left: ${left} • Changes apply to THIS MATCH ONLY. ${solo ? 'The battle is paused while this is open.' : 'Online: the battle keeps running.'}`));
    if (queued.length) box.append(supEl('div', { class: 'muted', style: { color: '#9fffe0' } }, 'Queued: ' + queued.join(' • ')));
    const balls = B.fighters.filter(x => x.alive && !x.isClone && !(x.st.outside > 0));
    for (const x of balls) {
      const row = supEl('div', { class: 'sup-row' });
      const team = x.team === f.team ? 'ALLY' : 'ENEMY';
      row.append(ballCanvas(x.def, 34), supEl('b', {}, (x === f ? '★ ' : '') + (x.tag ? x.tag + ' • ' : '') + x.name), supEl('span', { class: 'tm' }, `${team} • ${Math.round(x.hpRatio * 100)}% HP`));
      if (x !== f) row.append(supEl('button', { class: 'sup-btn red', onclick: () => send(1, x.sid, 0, 0, 'delete ' + x.name) }, '✖ Delete'));
      const ts = supEl('select', {}, ...tl.map((b, i) => supEl('option', { value: i }, b.name)));
      row.append(ts, supEl('button', { class: 'sup-btn', onclick: () => send(3, x.sid, +ts.value, 0, 'transform ' + x.name) }, '⟳ Transform'));
      const ps = supEl('select', {}, ...PROP_KEYS.map((k, i) => supEl('option', { value: i }, k.toUpperCase()))), pv = supEl('input', { type: 'number', min: 10, max: 200, step: 5, value: 100, style: { width: '64px' } });
      row.append(ps, pv, supEl('span', { class: 'muted' }, '%'), supEl('button', { class: 'sup-btn', onclick: () => send(4, x.sid, +ps.value, clamp(+pv.value || 100, 10, 200), PROP_KEYS[+ps.value] + ' ' + x.name) }, '✎ Set'));
      box.append(row);
    }
    for (const x of B.deleted || []) box.append(supEl('div', { class: 'sup-row' }, ballCanvas(x.def, 34), supEl('b', { style: { opacity: 0.6 } }, x.name + ' (deleted)'), supEl('button', { class: 'sup-btn gold', onclick: () => send(2, x.sid, 0, 0, 'restore ' + x.name) }, '↺ Restore')));
    const ac = supEl('select', {}, ...ARENA_CONDS.map((k, i) => supEl('option', { value: i }, k.toUpperCase()))), as = supEl('input', { type: 'number', min: 3, max: 15, value: 8, style: { width: '56px' } });
    box.append(supEl('div', { class: 'sup-row' }, supEl('b', {}, 'Arena condition'), ac, as, supEl('span', { class: 'muted' }, 'seconds'), supEl('button', { class: 'sup-btn', onclick: () => send(5, 0, +ac.value, clamp(+as.value || 8, 3, 15), 'arena ' + ARENA_CONDS[+ac.value]) }, 'Apply')));
    const dm = supEl('input', { type: 'number', min: 25, max: 300, step: 25, value: Math.round((B.dmgMul || 1) * 100), style: { width: '64px' } });
    box.append(supEl('div', { class: 'sup-row' }, supEl('b', {}, 'Battle settings'), supEl('span', { class: 'muted' }, 'Damage ×%'), dm, supEl('button', { class: 'sup-btn', onclick: () => send(6, 0, 0, clamp(+dm.value || 100, 25, 300), 'damage ' + dm.value + '%') }, 'Set'),
      supEl('button', { class: 'sup-btn', onclick: () => send(6, 0, 1, B.suddenDeath ? 0 : 1, 'sudden death') }, B.suddenDeath ? 'Sudden death OFF' : 'Sudden death ON')));
    // a SEPARATE, explicit permanent action (never part of ADMIN DELETE itself)
    if (window.Online && Online.active && Online.isOwner && Online.isOwner()) {
      const pb = supEl('select', {}, ...balls.filter(x => x !== f && !x.def.adminOnly).map(x => supEl('option', { value: x.def.id }, x.name)));
      if (pb.options.length) box.append(supEl('div', { class: 'sup-row' }, supEl('b', {}, 'Permanent management'), pb,
        supEl('button', { class: 'sup-btn red', onclick: () => { const id = pb.value, b = getBall(id); if (!b) return; if (!confirm(`PERMANENTLY disable "${b.name}" for every player? This is a separate action from ADMIN DELETE and is written to the audit log. You can re-enable it in Admin Dashboard → Balls.`)) return; adminDo(() => API.post(`/api/admin/balls/${id}/flags`, { disabled: true })); } }, '⛔ Disable for all players…')));
    }
    box.append(supEl('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, supEl('button', { class: 'sup-btn', onclick: close }, left > 0 ? 'Close (keep remaining commands for later)' : 'Close')));
  }
  render();
};
/* reopen the console while the window is still open (button in the owner's HUD) */
function supConsoleButton() {
  const B = BATTLE, f = B && B.player;
  let btn = document.getElementById('supConBtn');
  const show = f && f.alive && f.sx && f.sx.adminT > 0 && f.sx.adminLeft > 0 && !document.querySelector('.sup-ov');
  if (!show) { if (btn) btn.remove(); return; }
  if (!btn) { btn = supEl('button', { id: 'supConBtn', class: 'sup-btn', style: { position: 'fixed', right: '12px', top: '110px', zIndex: 41 }, onclick: () => UI.adminConsole(BATTLE.player) }); document.body.append(btn); }
  btn.textContent = `▣ ADMIN (${f.sx.adminLeft}) ${Math.ceil(f.sx.adminT)}s`;
}

/* ---------------- owner test battle bar ---------------- */
function supTestBar() {
  const B = BATTLE, f = B && B.player; let bar = document.getElementById('supTest');
  if (!B || !(B.cfg.adminTest || B.cfg.godTest) || B.over || !f || !f.baseDef) { if (bar) bar.remove(); return; }
  if (bar && bar._b === B) { bar.querySelector('[data-k=form]').textContent = 'Form: ' + (f.baseDef.forms[f.form] || {}).name; return; }
  if (bar) bar.remove();
  bar = supEl('div', { id: 'supTest', class: 'sup-test' }); bar._b = B;
  const cmd = (c, v = 0) => B.actions.push(['x', c, f.sid, v, 0]);
  bar.append(supEl('span', { 'data-k': 'form', class: 'sup-btn gold', style: { cursor: 'default' } }, 'Form'));
  ['BASE', 'AWAKEN', 'GOD'].forEach((l, k) => bar.append(supEl('button', { class: 'sup-btn', onclick: () => cmd(9, k) }, l)));
  f.skills.forEach((s, i) => bar.append(supEl('button', { class: 'sup-btn', title: s.name, onclick: () => B.queue('k', i) }, `${i + 1} ${SKILL_TYPES[s.type]?.ico || ''}`)));
  bar.append(supEl('button', { class: 'sup-btn gold', onclick: () => cmd(10) }, 'ULT ready'), supEl('button', { class: 'sup-btn', onclick: () => cmd(11) }, 'Reset CD'));
  const fx = SUP.fx[f.baseDef.id] || {};
  for (const [k, l] of [['entrance', 'Entrance'], ['victory', 'Victory'], ['defeat', 'Defeat']]) bar.append(supEl('button', { class: 'sup-btn', onclick: () => { if (fx[k]) { fx[k](f, f.def.design); supSound(f, k === 'entrance' ? 'transform' : k); } } }, '▶ ' + l));
  if (B.cfg.godTest) bar.append(supEl('span', { class: 'muted', style: { alignSelf: 'center', fontSize: '11px' } }, 'PRACTICE TEST — no rewards'));
  document.body.append(bar);
}
if (!window.NBB_HEADLESS) setInterval(() => { try {
  const ov = document.querySelector('.sup-ov'); if (ov && (!BATTLE || ov._b !== BATTLE || BATTLE.over)) ov.remove();   // the console belongs to its own battle
  supTestBar(); supConsoleButton(); } catch (e) { /* UI only */ } }, 250);

/* ---------------- Admin Ball Control Panel (Admin Dashboard tab) ---------------- */
UI.admin_supreme = async function (body) {
  const r = await API.get('/api/admin/supreme');
  const tun = Object.fromEntries((r.balls || []).map(b => [b.id, b.tuning || {}]));
  body.innerHTML = '';
  const ids = SUP.ids.filter(id => getBall(id));
  if (!this.supSel || !ids.includes(this.supSel)) this.supSel = ids[0];
  const grid = supEl('div', { class: 'ball-grid' });
  for (const id of ids) grid.append(this.ballCard(getBall(id), { onclick: () => { this.supSel = id; this.admin_supreme(body); } }));
  body.append(supEl('div', { class: 'card' }, supEl('h3', {}, '👑 Supreme Admin Balls — Control Panel'), supEl('p', { class: 'muted' }, 'Owner only. Settings are saved on the server (audit-logged) and apply to every battle that uses these balls. Nobody else can buy, unlock, copy or equip them.'), grid));
  // 2.4.2: one setting for all of them — the form every Supreme admin ball starts its battles in
  const FORM_NAMES = ['Base form', 'Awakened form', 'Final God Form'];
  const allSel = supEl('select', {}, ...FORM_NAMES.map((l, k) => supEl('option', { value: k }, l)));
  body.append(supEl('div', { class: 'card' }, supEl('h4', { style: { margin: '0 0 6px' } }, '⚡ Start form for ALL Supreme admin balls'),
    supEl('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, 'Every battle starts in', allSel,
      supEl('button', { class: 'btn gold', onclick: () => this.confirm(`All ${ids.length} Supreme admin balls will start every battle in ${FORM_NAMES[+allSel.value]}. Their other settings stay the same.`, () => adminDo(() => API.post('/api/admin/supreme-start-form', { startForm: +allSel.value }), () => Online.refresh().then(() => this.render_admin())), 'Apply to all') }, `Apply to all ${ids.length}`)),
    supEl('p', { class: 'muted', style: { margin: '6px 0 0' } }, 'They still go further during battle: Awakened → Final God Form at 30% HP or with the 2nd ultimate. You can also pick a start form for one ball below.')));
  const id = this.supSel, def = getBall(id), t = { cdMul: 1, off: [], fx: 1, aura: true, startForm: 0, ...(tun[id] || {}) };
  const panel = supEl('div', { class: 'card sup-panel' });
  panel.append(supEl('h3', {}, def.name, ' ', supEl('span', { class: 'rar ' + rarClass(def.rarity) }, 'SUPREME ADMIN')), supEl('p', { class: 'muted' }, def.desc || ''));
  // live preview of the three forms
  const forms = supEl('div', { class: 'forms' });
  def.forms.forEach((fm, k) => { const fd = formDef(def, k), cv = ballCanvas(fd, 130); this.addLive(cv, fd, { size: 130, big: true }); forms.append(supEl('figure', {}, cv, supEl('figcaption', {}, ['BASE', 'AWAKENED', 'FINAL GOD FORM'][k] + ' — ' + fm.name))); });
  panel.append(forms);
  // abilities: enable / disable
  const ab = supEl('div', { class: 'abil' });
  def.skills.forEach((s, i) => { const on = !t.off.includes(i), cb = supEl('input', { type: 'checkbox', checked: on, onchange: e => { t.off = e.target.checked ? t.off.filter(x => x !== i) : [...new Set([...t.off, i])]; } });
    ab.append(cb, supEl('div', {}, supEl('b', {}, `${SKILL_TYPES[s.type]?.ico || ''} ${s.name}`), supEl('br'), supEl('small', {}, SKILL_TYPES[s.type]?.desc || '')), supEl('small', {}, `${(s.cd * (t.cdMul || 1)).toFixed(1)}s`)); });
  panel.append(supEl('h4', {}, 'Abilities (untick to switch off)'), ab,
    supEl('p', {}, supEl('b', {}, '★ Ultimate: '), def.ult.name, ' — ', supEl('small', { class: 'muted' }, ULT_TYPES[def.ult.type] || '')),
    supEl('p', {}, supEl('b', {}, '✦ Final-form ultimate: '), def.finalUlt.name, ' — ', supEl('small', { class: 'muted' }, ULT_TYPES[def.finalUlt.type] || '')));
  // tuning controls
  const val = (v, d) => supEl('b', {}, (+v).toFixed(d));
  const cdV = val(t.cdMul, 1), fxV = val(t.fx, 1);
  panel.append(supEl('h4', {}, 'Settings'), supEl('div', { class: 'ctl' },
    supEl('label', {}, 'Cooldown multiplier', supEl('input', { type: 'range', min: 0.2, max: 3, step: 0.1, value: t.cdMul, oninput: e => { t.cdMul = +e.target.value; cdV.textContent = t.cdMul.toFixed(1) + '×'; } }), cdV),
    supEl('label', {}, 'Effects intensity', supEl('input', { type: 'range', min: 0.2, max: 1.5, step: 0.1, value: t.fx, oninput: e => { t.fx = +e.target.value; fxV.textContent = t.fx.toFixed(1) + '×'; } }), fxV),
    supEl('label', {}, supEl('input', { type: 'checkbox', checked: t.aura !== false, onchange: e => { t.aura = e.target.checked; } }), 'Show aura glow'),
    supEl('label', {}, 'Start every battle in ', supEl('select', { onchange: e => { t.startForm = +e.target.value; } }, ...FORM_NAMES.map((l, k) => supEl('option', { value: k, selected: (t.startForm | 0) === k }, l)))),
    supEl('div', { class: 'row' }, supEl('button', { class: 'btn gold', onclick: () => adminDo(() => API.post('/api/admin/supreme/' + id, { cdMul: t.cdMul, off: t.off, fx: t.fx, aura: t.aura !== false, startForm: t.startForm | 0 }), () => Online.refresh().then(() => this.render_admin())) }, '💾 Save settings'),
      supEl('button', { class: 'btn', onclick: () => this.confirm(`Reset ${esc(def.name)} to default settings?`, () => adminDo(() => API.post('/api/admin/supreme/' + id, { reset: true }), () => Online.refresh().then(() => this.render_admin()))) }, 'Reset to default'))));
  // spawn & test
  const formSel = supEl('select', {}, ...['Base form', 'Awakened form', 'Final God form'].map((l, k) => supEl('option', { value: k }, l)));
  const opp = supEl('select', {}, supEl('option', { value: 'dummy' }, 'Training dummy (does not fight back)'), supEl('option', { value: 'random' }, 'Random AI opponent'),
    ...allBalls().filter(b => b.enabled && !b.summonOnly && !b.unit && !b.draft && b.id !== id).map(b => supEl('option', { value: b.id }, (b.supreme ? '👑 ' : '') + b.name)));
  const diff = supEl('select', {}, ...Object.keys(DIFF).map(k => supEl('option', { value: k, selected: k === 'hard' }, DIFF[k].name || k)));
  panel.append(supEl('h4', {}, 'Spawn & test'), supEl('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, formSel, opp, diff,
    supEl('button', { class: 'btn admin big', onclick: () => {
      const o = opp.value; Object.assign(Game.setup, { ball: id, enemy: o === 'dummy' ? 'random' : o, dummy: o === 'dummy', infinite: true, adminTest: true, startForm: +formSel.value, difficulty: diff.value, trial: false });
      Promise.resolve(Game.start('practice')).finally(() => { Game.setup.adminTest = false; Game.setup.startForm = 0; });
    } }, '⚔ Spawn & Test')),
    supEl('p', { class: 'muted' }, 'Test battles are Practice battles: no rewards. A bar at the top lets you switch forms, fire each ability, refill the ultimate, reset cooldowns and preview the entrance / victory / defeat animations.'));
  body.append(panel);
};

/* version label + engine exports */
if (!window.NBB_HEADLESS) {
  const addVer = () => { const ft = document.querySelector('.menu-footer'); if (ft && !document.getElementById('menuVer')) ft.append(supEl('span', { class: 'pill', id: 'menuVer', title: 'Game version' }, 'v' + GAME_VERSION)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addVer); else addVer();
}
if (window.NBB_CORE) Object.assign(window.NBB_CORE, { SUP, GAME_VERSION, ADMIN_CMDS, ARENA_CONDS, PROP_KEYS, FORM_MUL, formDef, supremeIds: () => SUP.ids.slice() });
invalidateRegistry();
