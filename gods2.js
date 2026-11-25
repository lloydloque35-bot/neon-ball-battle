/* =====================================================================
   NEON BALL BATTLE 2.3.0 — PREMIUM SUPREME GOD BALLS: GOD OF GUNS • GOD PORTAL (PHP 99 each)
   Loaded after gods.js in the browser and on the game server (deterministic, verifiable).
   Ownership comes ONLY from a server-verified PayMongo payment (server/shop.js) — never from the client.
   ===================================================================== */
SUP.paidGodIds = [];
const PAID_PRICE_PHP = 99, BUNDLE_PRICE_PHP = 198;
/** registers a paid Premium God Ball: God Ball framework + bought once, owned forever, every form unlocked */
function paidGodBall(def, cfg) {
  godBall(def, cfg);
  Object.assign(def, { paid: true, free: false, pricePhp: PAID_PRICE_PHP, isNew: true });
  SUP.godIds.splice(SUP.godIds.indexOf(def.id), 1); SUP.paidGodIds.push(def.id);
  return def;
}
const GUN_BLUE = '#40c4ff', GUN_GOLD = '#ffd54f', GUN_PURPLE = '#d500f9';

/* =================== GOD OF GUNS =================== */
const GUN_TYPES = {      // floating arsenal weapons: each picks its own target
  pistol: { range: 480, cd: 0.7, fire: (f, x, y, a, P) => supShot(f, x, y, a, { speed: 760, r: 5, dmg: SD(f, P) * 0.06, col: GUN_BLUE, style: 'gunbolt', power: P, life: 1.2 }) },
  blaster: { range: 420, cd: 0.8, fire: (f, x, y, a, P) => { for (const j of [-1, 1]) supShot(f, x, y, a + j * 0.08, { speed: 700, r: 5, dmg: SD(f, P) * 0.042, col: GUN_PURPLE, style: 'gunbolt', power: P, life: 1.1 }); } },
  sniper: { range: 720, cd: 1.4, fire: (f, x, y, a, P) => supShot(f, x, y, a, { speed: 1150, r: 5, dmg: SD(f, P) * 0.11, col: GUN_GOLD, style: 'tracer', pierce: 1, power: P, life: 1 }) },
  rocket: { range: 620, cd: 1.8, fire: (f, x, y, a, P, t) => supShot(f, x, y, a + rand(-0.4, 0.4), { speed: 430, r: 7, dmg: SD(f, P) * 0.09, col: '#ff6d00', style: 'missile', homing: 3.5, target: t, boom: 55, power: P, life: 2.2 }) },
};
const arsenalPos = (f, A, g, i) => { const a = g.a + A.t * (A.k === 2 ? 0.8 : 1.1), R = f.r + (A.k ? 64 : 48) + (A.k === 1 ? 18 * dsin(A.t * 2 + i) : A.k === 2 ? 26 * dsin(A.t * 1.3 + i * 0.8) : 0); return { x: inArenaX(f.x + dcos(a) * R, 12), y: inArenaY(f.y + dsin(a) * R, 12), a }; };
GSK('gn_arsenal', 'summon', '⚙', 'Arsenal Summon', [
  'Six floating energy pistols circle the God of Guns; each one picks its own target and fires on its own.',
  'Six weapons in two kinds — twin blasters and piercing snipers — that sway out to flank their targets.',
  'Eight weapons — blasters, snipers and homing rocket pods — and every 2.4 s all of them fire one synchronised volley.'],
(f, s, P) => {
  const k = gk(f), st = sx(f), n = k === 2 ? 8 : 6, types = k === 0 ? ['pistol'] : k === 1 ? ['blaster', 'sniper'] : ['blaster', 'sniper', 'rocket'];
  st.arsenal = { t: 0, life: 5 + k, k, P, sync: 2.4, guns: Array.from({ length: n }, (_, i) => ({ a: i / n * TAU, type: types[i % types.length], cd: 0.3 + i * 0.08 })) };
  if (!FX.off) { vfx((ctx, q) => { const A = f.sx && f.sx.arsenal; if (!A || !f.alive) return; A.guns.forEach((g, i) => { const p = arsenalPos(f, A, g, i); vGun(ctx, p.x, p.y, g.aim ?? p.a, g.type, A.k === 2 ? 1.15 : 1, A.k === 2 ? GUN_GOLD : GUN_BLUE, g.flash || 0); }); }, 5 + k); FX.ring(f.x, f.y, GUN_BLUE, f.r * 3, 0.4, 6, f.r); supSound(f, 'skill', 0); }
}, true);
GSK('gn_storm', 'ranged', '⁂', 'Infinite Bullet Storm', [
  'Three aimed waves of energy bullets sweep over the target.',
  'A rotating SPIRAL of 36 bullets pours out of the weapon ring in every direction, alternating clockwise and counter-clockwise.',
  'A BULLET CURTAIN: 32 bullets burst outward, freeze in mid-air, then all re-aim at the nearest enemies at high speed.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f);
  if (k === 0) for (let w = 0; w < 3; w++) after(w * 0.15, () => { if (!f.alive) return; const tt = supTarget(f, t); if (!tt) return; const a = aimAngle(f, tt, 760); for (let i = 0; i < 8; i++) supShot(f, f.x, f.y, a + (i - 3.5) * 0.09, { speed: 760, r: 5, dmg: SD(f, P) * 0.05, col: GUN_BLUE, style: 'gunbolt', power: P, life: 1.3 }); });
  else if (k === 1) for (let i = 0; i < 36; i++) after(i * 0.042, () => { if (!f.alive) return; const dir = Math.floor(i / 12) % 2 ? -1 : 1, a = i * 0.55 * dir; supShot(f, f.x + dcos(a) * (f.r + 30), f.y + dsin(a) * (f.r + 30), a, { speed: 620, r: 6, dmg: SD(f, P) * 0.05, col: i % 2 ? GUN_PURPLE : GUN_BLUE, style: 'gunbolt', power: P, life: 1.4 }); });
  else for (let i = 0; i < 32; i++) supShot(f, f.x, f.y, i / 32 * TAU, { speed: 520, r: 6, dmg: SD(f, P) * 0.045, col: GUN_GOLD, style: 'gunbolt', power: P, life: 2.2, data: { t: 0 },
    tick: (p, h) => { const d = p.data; d.t += h; if (d.t < 0.35) return; if (d.t < 0.7) { p.vx = p.vy = 0; return; } if (!d.go) { d.go = true; const e = nearestEnemy(f); const a = e ? datan2(e.y - p.y, e.x - p.x) : rand(TAU); p.speed = 900; p.vx = dcos(a) * 900; p.vy = dsin(a) * 900; p.homing = 1.5; p.target = e; } } });
  if (!FX.off) supSound(f, 'skill', 1);
});
function railLaser(f, x, y, a, P, mul, w, col) { const end = rayToWall(x, y, a); addLaser(f, [x, y, end.x, end.y], { charge: 0.02, dur: 0.25, w, dmg: SD(f, P) * mul, col }); if (!FX.off) { vfx((ctx, q) => vSlash(ctx, x, y, end.x, end.y, col, 1 - q, w * 0.8), 0.45); FX.sparks(end.x, end.y, col, 14, 500); } return end; }
GSK('gn_rail', 'ranged', '═', 'Railgun Blast', [
  'Charges for 0.6 s, then a railgun beam pierces through everything in a straight line to the wall.',
  'The railgun shot RICOCHETS off the wall it hits and crosses the arena a second time.',
  'Three railguns fire at once in a fan and leave an ionised trail that keeps burning enemies for 2 s.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f); f.casting = [0.6, 0.55, 0.7][k];
  f.castFn = () => {
    if (!f.alive) return; const tt = supTarget(f, t); const a = tt ? angTo(f, tt) : f.rot;
    const end = railLaser(f, f.x, f.y, a, P, k === 2 ? 0.42 : k ? 0.55 : 0.75, 16, GUN_BLUE);
    if (k === 1) { const vx = dcos(a), vy = dsin(a), hitX = end.x <= ARENA.x + 1 || end.x >= ARENA.r - 1; railLaser(f, end.x, end.y, datan2(hitX ? vy : -vy, hitX ? -vx : vx), P, 0.45, 14, GUN_PURPLE); }
    if (k === 2) { for (const j of [-1, 1]) railLaser(f, f.x, f.y, a + j * 0.18, P, 0.32, 12, GUN_GOLD);
      const L = len(end.x - f.x, end.y - f.y); for (let d = 70; d < L; d += 70) supZone(f, { kind: 'trap', x: f.x + dcos(a) * d, y: f.y + dsin(a) * d, r: 36, life: 2, col: GUN_BLUE, power: P, dmg: SD(f, P) * 0.03, effect: 'burn' }); }
    if (!FX.off) { FX.addShake(8); Sound.play('beam'); }
  };
  if (!FX.off) { vfx((ctx, q) => { if (f.alive) vRailCharge(ctx, f.x, f.y, f.r, q, k); }, f.casting); supSound(f, 'skill', 2); }
});
const GUN_COPYABLE = ['projectile', 'multishot', 'homing', 'missiles', 'beam', 'lightning', 'meteor'];
GSK('gn_copy', 'ranged', '⧉', 'Weapon Copy', [
  'Copies the strongest projectile attack of the nearest enemy for 6 s and fires it right away (the copy fades — nothing is stolen).',
  'The copy lasts 8 s, is 10% stronger and fires twice in a row.',
  'Scans every enemy for the strongest projectile attack: a 20% stronger copy for 10 s that fires three times.'],
(f, s, P, col, tgt) => {
  const k = gk(f), t = supTarget(f, tgt); if (!t) return false;
  const pool = (k === 2 ? supEnemies(f) : [t]).flatMap(e => e.allSkills().filter(x => !x.locked && !x.copied && !x.type.startsWith('gn_') && (GUN_COPYABLE.includes(x.type) || SUP.roles[x.type] === 'ranged')));
  if (!pool.length) return false;
  const best = pool.reduce((a, b) => ((b.power || 0) > (a.power || 0) ? b : a));
  f.temp = { ...best, name: '⧉ ' + best.name, cdLeft: 0, copied: true, expires: [6, 8, 10][k], color: GUN_GOLD, power: (best.power || 50) * [1, 1.1, 1.2][k] };
  for (let i = 0; i < k + 1; i++) after(0.2 + i * 0.4, () => { if (f.alive && f.temp && f.temp.copied) { f.temp.cdLeft = 0; useSkill(f, f.temp); } });
  if (!FX.off) { FX.bolt(t.x, t.y, f.x, f.y, GUN_GOLD, 4, 0.4); FX.text(f.x, f.y - f.r - 46, 'WEAPON COPIED: ' + best.name, GUN_GOLD, 16, { life: 1.4 }); supSound(f, 'skill', 3); }
});
GSK('gn_orbital', 'aoe', '⊙', 'Orbital Cannon', [
  'A giant energy cannon appears above the God of Guns and fires a huge shell that explodes on the target.',
  'The shell bursts into 5 cluster bombs that scatter and explode around the target.',
  'An ORBITAL STRIKE: the target is marked, then a beam from orbit tracks it and detonates, followed by the shell.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), cx = f.x, cy = f.y;
  const boom = (x, y, r, mul) => { supBlast(f, x, y, r, SD(f, P) * mul, { tag: 'explosion', force: 600, power: P }); if (!FX.off) { FX.burst(x, y, '#ff9100', 36, 480, 7, 0.6); FX.ring(x, y, GUN_GOLD, r * 1.2, 0.4, 10, 10); FX.addShake(8); } };
  if (!FX.off) vfx((ctx, q) => vGiantCannon(ctx, cx, cy - 110, t.alive ? Math.atan2(t.y - (cy - 110), t.x - cx) : 0, 1, Math.min(1, q * 4) * (1 - Math.max(0, q - 0.8) * 5), q), 1.1);
  after(0.8, () => {
    if (!f.alive) return; const tt = supTarget(f, t); if (!tt) return;
    const shell = p => { boom(p.x, p.y, 170, 0.5); if (k >= 1) for (let i = 0; i < 5; i++) supShot(f, p.x, p.y, i / 5 * TAU + 0.3, { speed: 300, r: 7, dmg: SD(f, P) * 0.05, col: '#ff6d00', style: 'cannonshell', life: 0.5, power: P, onEnd: q => boom(q.x, q.y, 70, 0.12), onHit: q => boom(q.x, q.y, 70, 0.12) }); };
    supShot(f, cx, cy - 110, datan2(tt.y - (cy - 110), tt.x - cx), { speed: 420, r: 24, dmg: SD(f, P) * 0.3, col: GUN_GOLD, style: 'cannonshell', life: 2.4, power: P, onHit: shell, onEnd: shell });
  });
  if (k === 2) { if (!FX.off) vfx((ctx, q) => { if (t.alive) vReticle(ctx, t.x, t.y, t.r * (2.6 - q), '#ff1744', 1, q * 8, 'ORBITAL LOCK'); }, 1.1);
    addLaser(f, [t.x, ARENA.y, t.x, ARENA.b], { charge: 1.0, dur: 0.5, w: 70, dmg: SD(f, P) * 0.28, col: GUN_BLUE }); lastLaser().track = { tgt: t, sp: 320 };
    after(1.55, () => { if (f.alive && t.alive) boom(t.x, t.y, 200, 0.38); }); }
  if (!FX.off) supSound(f, 'skill', 4);
});
function godsArsenal(f, P, col, dmg, apoc) {
  const t = nearestEnemy(f); darkArena(apoc ? 3.6 : 3.2, '#02030f', 0.55); camPunch(f.x, f.y, 0.12, 3);
  const hexes = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; hexes.push({ x: inArenaX(f.x + dcos(a) * 190, 40), y: inArenaY(f.y + dsin(a) * 190, 40) }); }
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.y + 70, apoc ? '✦ INFINITE WEAPON APOCALYPSE ✦' : "⚙ GOD'S FINAL ARSENAL ⚙", apoc ? '#ffffff' : GUN_GOLD, apoc ? 38 : 44, { life: 2.8, vy: 0, pop: 2, stroke: '#02030f' }); supSound(f, 'ult', apoc ? 2 : 0);
    vfx((ctx, q) => vWeaponRealm(ctx, Math.min(1, q * 3) * (q > 0.85 ? (1 - q) * 6 : 1), q, apoc), apoc ? 3.6 : 3.2);
    if (!apoc) vfx((ctx, q) => { for (const p of hexes) { const e = nearestEnemy(f); vGiantCannon(ctx, p.x, p.y, e ? Math.atan2(e.y - p.y, e.x - p.x) : 0, 0.8, Math.min(1, q * 3) * (q > 0.9 ? (1 - q) * 10 : 1), q); } }, 2.8);
    vfx((ctx, q) => { for (const e of supEnemies(f)) vReticle(ctx, e.x, e.y, e.r * 1.8, '#ff1744', Math.min(1, q * 4), q * 10, 'LOCKED'); }, 2.6);
  }
  // hundreds of weapons: barrages converge from the edges of the realm
  const volleys = apoc ? 3 : 2, per = apoc ? 24 : 30;
  for (let v = 0; v < volleys; v++) after(0.9 + v * 0.65, () => { if (!f.alive) return; const es = supEnemies(f); if (!es.length) return;
    for (let i = 0; i < per; i++) { const e = es[i % es.length], a = i / per * TAU + v, R = apoc ? 560 : 480, x = inArenaX(ARENA.cx + dcos(a) * R, 10), y = inArenaY(ARENA.cy + dsin(a) * R * 0.55, 10);
      supShot(f, x, y, datan2(e.y - y, e.x - x), { speed: 820, r: 6, dmg: dmg * (apoc ? 0.011 : 0.012), col: i % 3 ? GUN_BLUE : GUN_GOLD, style: 'gunbolt', homing: 2, target: e, power: P, life: 2 }); } });
  if (!apoc) after(2.2, () => { if (!f.alive) return; const es = supEnemies(f); hexes.forEach((p, i) => { const e = es[i % Math.max(1, es.length)]; if (!e) return; const shell = q => { supBlast(f, q.x, q.y, 150, dmg * 0.1, { tag: 'explosion', force: 500 }); if (!FX.off) FX.burst(q.x, q.y, '#ff9100', 24, 400, 6, 0.5); };
    supShot(f, p.x, p.y, datan2(e.y - p.y, e.x - p.x), { speed: 700, r: 16, dmg: dmg * 0.04, col: GUN_GOLD, style: 'cannonshell', power: P, life: 1.5, onHit: shell, onEnd: shell }); }); });
  else after(2.6, () => { if (!f.alive) return; const es = supEnemies(f); for (let i = 0; i < 6; i++) { const e = es[i % Math.max(1, es.length)]; if (!e) break; const a = i / 6 * TAU, x = ARENA.cx + dcos(a) * 600, y = ARENA.cy + dsin(a) * 330; addLaser(f, [x, y, e.x, e.y], { charge: 0.25, dur: 0.5, w: 26, dmg: dmg * 0.07, col: i % 2 ? GUN_GOLD : GUN_BLUE }); lastLaser().conv = { tgt: e }; } });
  after(apoc ? 3.2 : 2.85, () => {
    if (!f.alive) return;
    if (apoc) for (const e of supEnemies(f)) { dealDamage(f, e, dmg * 0.42, { kind: 'skill', tag: 'explosion', power: P }); knock(e, ARENA.cx, ARENA.cy, 900); }
    else { const e = t && t.alive ? t : nearestEnemy(f); if (e) supBlast(f, e.x, e.y, 260, dmg * 0.4, { tag: 'explosion', force: 900, power: P }); }
    if (!FX.off) { FX.addFlash(0.4, apoc ? '#ffffff' : GUN_GOLD); FX.addShake(22); const x = apoc ? ARENA.cx : (t ? t.x : ARENA.cx), y = apoc ? ARENA.cy : (t ? t.y : ARENA.cy); for (let i = 0; i < 5; i++) FX.ring(x, y, i % 2 ? GUN_BLUE : GUN_GOLD, 300 + i * 150, 0.8, 14, 30); FX.burst(x, y, GUN_GOLD, 110, 1000, 9, 1.2); }
  });
}
UL('gn_finalarsenal', "God's Final Arsenal — the battle becomes a weapon realm: hundreds of weapons and six giant cannons lock on and fire one synchronised barrage that ends in a massive explosion", (f, P, col, dmg) => godsArsenal(f, P, col, dmg, false));
UL('gn_apocalypse', 'Infinite Weapon Apocalypse — a celestial arsenal rings the whole arena: three synchronised volleys, six converging cannon beams and an arena-wide detonation', (f, P, col, dmg) => godsArsenal(f, P, col, dmg, true));
paidGodBall(B('godofguns', 'God of Guns Ball', 'God', 'God Tier', [128, 84, 70, 78, 34], D('#0b1030', GUN_BLUE, GUN_PURPLE, 'gunscore', [], '', { glow: 1.6, sdeco: ['gunring', 'floatguns'], guns: 4, gunrings: 1, sfx: { wave: 'square', pitch: 0.9 } }),
  [S('ARSENAL SUMMON', 'gn_arsenal', 12, 65, GUN_BLUE), S('INFINITE BULLET STORM', 'gn_storm', 7, 70, GUN_PURPLE), S('RAILGUN BLAST', 'gn_rail', 8, 85, GUN_BLUE), S('WEAPON COPY', 'gn_copy', 12, 65, GUN_GOLD), S('ORBITAL CANNON', 'gn_orbital', 10, 80, GUN_GOLD)],
  U("GOD'S FINAL ARSENAL", 'gn_finalarsenal', 110, GUN_GOLD), 'tactical', { desc: 'SUPREME PREMIUM GOD • PHP 99. The ultimate weapon master: a floating arsenal, railguns, bullet storms and orbital cannons.' }), {
  godClass: 'SUPREME PREMIUM GOD', formMul: [1, 1.08, 1.14], skillK: [1.05, 0.88, 0.7],
  forms: [{ name: 'ARSENAL GUARDIAN' }, { name: 'SUPREME WEAPON EMPEROR', design: { c3: GUN_GOLD, guns: 6, gunrings: 2, glow: 1.9, sdeco: ['gunring', 'floatguns', 'mechplates'] } },
    { name: 'GOD OF INFINITE ARMAMENTS', design: { c1: '#120a2a', c2: GUN_GOLD, c3: GUN_BLUE, pat: 'gunscore2', guns: 8, gunrings: 3, glow: 2.4, sdeco: ['gunring', 'floatguns', 'mechplates', 'floatcannons'] } }],
  finalUlt: U('INFINITE WEAPON APOCALYPSE', 'gn_apocalypse', 120, '#ffffff'), sound: { base: 233, wave: 'square', slide: 0.45, noise: 3600 },
  passiveInfo: { name: 'WEAPON MASTERY', desc: 'Every successful hit builds weapon energy: up to 25% faster abilities and +10% attack. At 100 energy it goes into OVERDRIVE and its floating weapons fire twice as fast. Energy fades 2 s after the last hit.' },
  formPassive: ['+4 energy per hit, 3 s Overdrive.', '+5 energy per hit, 4 s Overdrive.', '+6 energy per hit, 5 s Overdrive.'],
  passive: {
    init(f) { f.sx.wm = 0; },
    tick(f, dt) {
      const s = f.sx;
      if (!(s.wmIdleT > 0)) s.wm = Math.max(0, s.wm - 10 * dt);
      if (s.wm >= 100) { s.wm = 0; s.overdriveT = 3 + f.form; if (!FX.off) { FX.text(f.x, f.y - f.r - 40, 'OVERDRIVE!', GUN_GOLD, 22, { pop: 1.6 }); FX.ring(f.x, f.y, GUN_GOLD, f.r * 3, 0.5, 8, f.r); } }
      f.pCd *= 1 - s.wm / 400 - (s.overdriveT > 0 ? 0.1 : 0); f.pAtk *= 1 + s.wm / 1000;
    },
  },
  fx: {
    idle: (f, d) => { if (Math.random() < 0.5) { const a = vr(TAU); FX.p(f.x + Math.cos(a) * f.r * 1.4, f.y + Math.sin(a) * f.r * 1.4, Math.cos(a) * 40, Math.sin(a) * 40, 0.35, vr(2, 3), Math.random() < 0.5 ? d.c2 : GUN_GOLD, 'spark', 1); } },
    bounce: (f, x, y, d) => { FX.sparks(x, y, GUN_GOLD, 10, 440); FX.ring(x, y, d.c2, 60, 0.25, 4, 6); },
    victory: (f, d) => { vfx((ctx, q) => { for (let i = 0; i < (f.form === 2 ? 10 : 6); i++) { const a = i / (f.form === 2 ? 10 : 6) * Math.PI * 2 + q * 2; vGun(ctx, f.x + Math.cos(a) * (f.r + 60), f.y + Math.sin(a) * (f.r + 60), -Math.PI / 2, i % 3 === 2 ? 'rocket' : i % 2 ? 'sniper' : 'blaster', 1, i % 2 ? GUN_GOLD : GUN_BLUE, Math.sin(q * 30 + i) > 0.7 ? 1 : 0); } }, 1.8);
      FX.text(f.x, f.y - f.r - 90, f.form === 2 ? 'INFINITE ARMAMENTS' : 'LOCKED AND LOADED', GUN_GOLD, 22, { life: 1.8 }); },
    defeat: (f, d) => { for (let i = 0; i < 8; i++) FX.p(f.x, f.y, vr(-320, 320), vr(-420, -80), 1.2, 9, i % 2 ? GUN_GOLD : '#90a4ae', 'shard', 1, 600); FX.burst(f.x, f.y, d.c2, 40, 420, 5, 0.9); FX.sparks(f.x, f.y, '#ffffff', 30, 600); },
    entrance: f => vfx((ctx, q) => vWeaponRealm(ctx, Math.sin(Math.PI * q), q, false), 1.4),
  },
});
SUP.dmgHooks.push((src, tgt, amt, o) => {      // Weapon Mastery: hits build weapon energy
  const ss = src && src.sx;
  if (ss && ss.wm != null && src.alive && o.kind !== 'dot' && src.team !== tgt.team && !(ss.wmCdT > 0)) { ss.wmCdT = 0.15; ss.wm = Math.min(100, ss.wm + [4, 5, 6][src.form]); ss.wmIdleT = 2; }
  return amt;
});
SUP.worldHooks.push((B, h) => {      // the floating arsenal: every weapon aims and fires on its own
  for (const f of B.fighters) {
    const A = f.alive && f.sx && f.sx.arsenal; if (!A) continue;
    A.t += h; if (A.t >= A.life) { f.sx.arsenal = null; continue; }
    const od = f.sx.overdriveT > 0 ? 2 : 1, es = supEnemies(f);
    if (A.k === 2 && (A.sync -= h) <= 0) { A.sync = 2.4; for (const g of A.guns) g.cd = 0; if (!FX.off) FX.text(f.x, f.y - f.r - 30, 'SYNC VOLLEY', GUN_GOLD, 13, { life: 0.6 }); }
    A.guns.forEach((g, i) => {
      if (g.flash > 0) g.flash -= h * 6;
      if ((g.cd -= h * od) > 0 || !es.length) return;
      const T = GUN_TYPES[g.type], p = arsenalPos(f, A, g, i);
      let best = null, bd = T.range * T.range; for (const e of es) { const d2 = dist2(e.x, e.y, p.x, p.y); if (d2 < bd) { bd = d2; best = e; } }
      if (!best) { g.cd = 0.2; return; }
      const a = datan2(best.y - p.y, best.x - p.x); g.aim = a; g.flash = 1; g.cd = T.cd;
      T.fire(f, p.x, p.y, a, A.P, best);
    });
  }
});

/* =================== GOD PORTAL =================== */
const PT_PURPLE = '#7c4dff', PT_RED = '#ff1744', PT_BLUE = '#2979ff';
function dimEnergy(f, n = 1) { const s = f.sx; if (!s || s.dm == null) return; s.dm = Math.min([5, 7, 9][f.form] || 5, s.dm + n); s.dmT = 6; }
function portalFx(x, y, r, col, life = 0.7, big) { if (!FX.off) vfx((ctx, q) => vPortalRing(ctx, x, y, r * (q < 0.2 ? q * 5 : 1) * (big ? 1.2 : 1), col, q > 0.7 ? (1 - q) / 0.3 : 1, q * 6), life); }
GSK('pt_dash', 'mobility', '⇢', 'Portal Dash', [
  'Opens two connected portals: God Portal steps into one and instantly bursts out of the other next to the target.',
  'Two hops through linked portals around the target, each exit releasing a shockwave; the portals stay open for 3 s and carry anyone through.',
  'Three hops in a triangle around the target, cutting straight through it each time, then a portal burst.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f);
  const hop = (a, d, cut) => { const ox = f.x, oy = f.y, nx = inArenaX(t.x + dcos(a) * d, f.r + 6), ny = inArenaY(t.y + dsin(a) * d, f.r + 6);
    portalFx(ox, oy, f.r * 1.4, PT_PURPLE); portalFx(nx, ny, f.r * 1.4, PT_RED);
    if (!FX.off) portalGhost(f, ox, oy, nx, ny, 0.12, 'out');
    f.x = nx; f.y = ny; const b = angTo(f, t); f.vx = dcos(b) * f.baseSpeed * 2.2; f.vy = dsin(b) * f.baseSpeed * 2.2; f.st.dash = 0.35;
    if (cut) { addLaser(f, [ox, oy, nx, ny], { charge: 0.02, dur: 0.12, w: 26, dmg: SD(f, P) * 0.26, col: PT_PURPLE }); if (!FX.off) vfx((ctx, q) => vSlash(ctx, ox, oy, nx, ny, PT_PURPLE, 1 - q), 0.3); }
    else supBlast(f, nx, ny, 100, SD(f, P) * (k ? 0.22 : 0.3), { tag: 'explosion', force: 380, power: P });
    return { ox, oy, nx, ny }; };
  const a0 = angTo(t, f);
  if (k === 0) hop(a0 + Math.PI + rand(-0.5, 0.5), t.r + 70);
  else if (k === 1) { const h1 = hop(a0 + HPI, t.r + 90); after(0.35, () => { if (f.alive && t.alive) hop(a0 - HPI, t.r + 90); });
    (BATTLE.portalPairs || (BATTLE.portalPairs = [])).push({ ax: inArenaX(h1.ox, 50), ay: inArenaY(h1.oy, 50), bx: inArenaX(h1.nx, 50), by: inArenaY(h1.ny, 50), r: 40, t: 3, col: PT_PURPLE, col2: PT_RED, dim: f.dim || 0 }); }
  else { for (let j = 0; j < 3; j++) after(j * 0.2, () => { if (f.alive && t.alive) hop(a0 + Math.PI + j * TAU / 3, t.r + 130, true); });
    after(0.7, () => { if (f.alive) { supBlast(f, f.x, f.y, 150, SD(f, P) * 0.3, { tag: 'explosion', force: 500 }); portalFx(f.x, f.y, 70, PT_BLUE, 0.6, true); } }); }
  dimEnergy(f);
  if (!FX.off) supSound(f, 'skill', 0);
});
const voidCopyPool = () => allBalls().filter(b => b.enabled && !b.adminOnly && !b.paid && !b.supreme && !b.summonOnly && !b.unit && !b.draft && !b.fusion && !b.boss);
const voidCopies = f => BATTLE.fighters.filter(x => x.alive && x.owner === f && x.voidCopy);
/** a temporary allied copy of another ball, pulled out of a portal (keeps that ball's own abilities) */
function summonVoidCopy(f, def, x, y, life, P) {
  const a = rand(TAU), c = new Fighter(def, { team: f.team, clone: true, summon: true, owner: f, level: f.level, evo: 0, allUnlocked: true, x: inArenaX(x, 40), y: inArenaY(y, 40), angle: a, life, rScale: 0.72, statMul: 0.34 });
  c.maxHp = c.hp = Math.max(10, Math.round(f.maxHp * 0.1)); c.godUsed = true; c.st.invuln = 0.5; c.voidCopy = true; c.dim = f.dim || 0;
  c.ai = new AIController(c, 'aggressive', 'hard'); BATTLE.fighters.push(c);
  if (!FX.off) { portalFx(c.x, c.y, c.r * 1.8, PT_PURPLE, 0.8, true); FX.burst(c.x, c.y, PT_PURPLE, 20, 300); }
  return c;
}
GSK('pt_summon', 'summon', '◈', 'Void Summon', [
  'Opens a portal and pulls out a temporary copy of another ball to fight beside God Portal.',
  'Opens two portals: two copies of different balls.',
  'Opens three portals: two copies of different balls plus a copy of the strongest enemy.'],
(f, s, P, col, tgt) => {
  const k = gk(f), cap = k === 2 ? 3 : 2, have = voidCopies(f).length; if (have >= cap) return false;
  const pool = voidCopyPool(), n = Math.min(cap - have, k + 1), out = [];
  for (let i = 0; i < n; i++) {
    let def = pool[RNG() * pool.length | 0];
    if (k === 2 && i === 2) { const e = supEnemies(f).filter(x => !x.isClone).sort((a, b) => b.maxHp * b.hpRatio - a.maxHp * a.hpRatio)[0]; if (e) def = e.baseDef || e.def; }
    const a = f.rot + i / n * TAU; out.push(summonVoidCopy(f, def, f.x + dcos(a) * f.r * 2.6, f.y + dsin(a) * f.r * 2.6, 5 + k, P));
  }
  dimEnergy(f, n);
  if (!FX.off) supSound(f, 'skill', 1);
}, true);
GSK('pt_trap', 'control', '⊚', 'Dimensional Trap', [
  'A portal opens beneath the target and swallows it into a dimensional prison for 1.2 s; it is spat back out with void damage.',
  'The prison throws the target out right in front of God Portal, stunned.',
  'A 1.8 s prison; the target returns inside a collapsing void that blasts everything around it and weakens it.'],
(f, s, P, col, tgt) => {
  const e = supTarget(f, tgt); if (!e || e.st.outside > 0) return false;
  const k = gk(f), dur = (e.boss ? 0.5 : 1) * [1.2, 1.2, 1.8][k], ex = e.x, ey = e.y;
  portalFx(ex, ey, e.r * 1.8, PT_RED, 0.6, true);
  const to = k === 1 ? { x: f.x + dcos(angTo(f, e)) * (f.r + e.r + 30), y: f.y + dsin(angTo(f, e)) * (f.r + e.r + 30) } : { x: ex, y: ey };
  e.st.outside = dur; e.vx = e.vy = 0;
  e.portalExit = { mode: 'point', x: to.x, y: to.y, col: PT_PURPLE, style: 'void', onExit: (m, p) => {
    if (!f.alive) return; m.st.invuln = 0;
    dealDamage(f, m, SD(f, P) * [0.4, 0.36, 0.42][k], { kind: 'skill', tag: 'skill', power: P, effect: k === 2 ? 'weaken' : undefined });
    if (k === 1 && !m.boss) m.st.stun = Math.max(m.st.stun, 0.6);
    if (k === 2) { supBlast(f, p.x, p.y, 160, SD(f, P) * 0.35, { tag: 'explosion', force: 500 }); darkBurst(p.x, p.y, 160, 0.7); }
    if (!FX.off) FX.burst(p.x, p.y, PT_PURPLE, 26, 340, 6, 0.6);
  } };
  if (k === 2) supZone(f, { kind: 'gravity', x: to.x, y: to.y, r: 200, life: dur, col: PT_PURPLE, pull: 900, dmg: 0, power: P });
  dimEnergy(f);
  if (!FX.off) { FX.text(e.x, e.y - e.r - 26, 'TRAPPED IN A DIMENSION', PT_RED, 14, { life: 0.9 }); supSound(f, 'skill', 2); }
});
GSK('pt_reflect', 'defense', '⟲', 'Portal Reflection', [
  'For 4 s, up to 5 enemy shots that come close fall into a portal and fly out of another portal right next to their owner.',
  'Redirected shots home in on their owner (up to 6 shots).',
  'A portal network: every redirected shot splits in two and homes in (up to 8 shots).'],
(f, s, P) => {
  const st = sx(f), k = gk(f); st.reflectT = 4 + k; st.reflectK = k; st.reflectN = [5, 6, 8][k];
  if (!FX.off) { FX.ring(f.x, f.y, PT_PURPLE, 170, 0.4, 6, f.r); supSound(f, 'skill', 3); }
}, true);
GSK('pt_collapse', 'aoe', '✺', 'Void Collapse', [
  '3 portals around the target drag enemies into the middle, then a dimensional explosion.',
  '4 portals drag enemies in while firing void shards at the centre; the explosion is bigger and slows.',
  '6 portals and TWO collapses in a row, leaving a void rift behind.'],
(f, s, P, col, tgt) => {
  const t = supTarget(f, tgt); if (!t) return false;
  const k = gk(f), n = [3, 4, 6][k], cx = inArenaX(t.x, 90), cy = inArenaY(t.y, 90), R = 210;
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + rand(0.5); pts.push({ x: inArenaX(cx + dcos(a) * R, 30), y: inArenaY(cy + dsin(a) * R, 30) }); }
  if (!FX.off) vfx((ctx, q) => { for (const p of pts) vPortalRing(ctx, p.x, p.y, 30, k === 2 ? PT_RED : PT_PURPLE, q > 0.85 ? (1 - q) * 6 : Math.min(1, q * 6), q * 8); ctx.save(); ctx.strokeStyle = rgba(PT_PURPLE, 0.5); ctx.lineWidth = 2; ctx.setLineDash([6, 8]); for (const p of pts) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(cx, cy); ctx.stroke(); } ctx.restore(); }, k === 2 ? 2.4 : 1.6);
  supZone(f, { kind: 'gravity', x: cx, y: cy, r: R + 40, life: k === 2 ? 2.2 : 1.4, col: PT_PURPLE, pull: 1500, dmg: SD(f, P) * 0.04, power: P });
  if (k >= 1) for (let j = 0; j < 3; j++) after(0.2 + j * 0.35, () => { if (f.alive) for (const p of pts) supShot(f, p.x, p.y, datan2(cy - p.y, cx - p.x), { speed: 520, r: 7, dmg: SD(f, P) * 0.05, col: PT_RED, style: 'voidshard', life: 0.45, power: P }); });
  const boom = (r, mul, eff) => { if (!f.alive) return; supBlast(f, cx, cy, r, SD(f, P) * mul, { tag: 'explosion', force: 650, effect: eff, power: P }); if (!FX.off) { darkBurst(cx, cy, r, 0.8); FX.ring(cx, cy, PT_RED, r * 1.2, 0.5, 12, 20); FX.addShake(10); } };
  if (k < 2) after(1.4, () => boom(k ? 230 : 200, k ? 0.48 : 0.55, k ? 'slow' : undefined));
  else { after(1.2, () => boom(180, 0.4)); after(2.2, () => { boom(260, 0.5, 'weaken'); if (f.alive) supZone(f, { kind: 'trap', x: cx, y: cy, r: 120, life: 2.5, col: PT_PURPLE, power: P, dmg: SD(f, P) * 0.04 }); }); }
  dimEnergy(f);
  if (!FX.off) supSound(f, 'skill', 4);
});
SUP.worldHooks.push(B => {      // Portal Reflection: enemy shots fall into a portal and come out next to their owner
  for (const f of B.fighters) {
    const s = f.alive && f.sx; if (!s || !(s.reflectT > 0) || !(s.reflectN > 0)) continue;
    const R = 150 + s.reflectK * 20, fd = f.dim || 0;
    for (const q of B.projs) {
      if (q.team === f.team || !(q.life > 0) || q.ult || q.portaled || (q.dim ?? ((q.owner && q.owner.dim) || 0)) !== fd || dist2(q.x, q.y, f.x, f.y) > R * R) continue;
      const src = q.owner && q.owner.alive && (q.owner.dim || 0) === fd && q.owner.team !== f.team ? q.owner : nearestEnemy(f); if (!src) continue;
      const ox = q.x, oy = q.y, a = datan2(f.y - src.y, f.x - src.x) + (s.reflectN % 2 ? 0.6 : -0.6), ex = inArenaX(src.x + dcos(a) * 190, 20), ey = inArenaY(src.y + dsin(a) * 190, 20), b = datan2(src.y - ey, src.x - ex), sp = Math.max(q.speed || 500, 600);
      q.portaled = true; q.reflected = true; q.team = f.team; q.owner = f; q.dim = fd; q.x = ex; q.y = ey; q.vx = dcos(b) * sp; q.vy = dsin(b) * sp; q.speed = sp; q.life = Math.max(q.life, 1.5); q.target = src; q.onEnd = null; q.onHit = null; q.tick = null;
      if (s.reflectK >= 1) q.homing = 2.5;
      if (s.reflectK === 2) B.projs.push({ ...q, vx: dcos(b + 0.25) * sp, vy: dsin(b + 0.25) * sp, hits: null });
      s.reflectN--; if (!(s.dmCdT > 0)) { s.dmCdT = 0.4; dimEnergy(f); }
      if (!FX.off) { portalFx(ox, oy, 22, PT_PURPLE, 0.4); portalFx(ex, ey, 22, PT_RED, 0.4); }
      if (s.reflectN <= 0) break;
    }
  }
});

/* ---------------- THE INFINITE VOID: a separate battle dimension inside the match ----------------
   Members (God Portal + the opponent(s) it takes) get fighter.dim = the void's id. Fighters in different dimensions never
   collide, target or damage each other (script.js), so the normal arena — and everyone still in it — is untouched.
   Everything is driven by simulation time and the seeded RNG, so it replays identically on the server and in PvP. */
const VOID_KINDS = { well: { name: 'GRAVITY WELL', col: '#7c4dff' }, mire: { name: 'STASIS FIELD', col: '#40c4ff' }, storm: { name: 'RIFT STORM', col: '#ff1744' } };
const VOID_BANDS = [{ kind: 'nebula', name: 'NEBULA EXPANSE', col: '#2979ff' }, { kind: 'crimson', name: 'CRIMSON RIFT', col: '#ff1744' }, { kind: 'crystal', name: 'CRYSTAL GRAVITY', col: '#b388ff' }];
function buildVoid(d) {
  const W2 = ARENA.w, pX = x => ARENA.x + W2 * x, pY = y => ARENA.y + ARENA.h * y;
  d.platforms = [[0.14, 0.5, 95], [0.86, 0.5, 95], [0.5, 0.22, 80], [0.5, 0.78, 80], [0.5, 0.5, 70]].map(([x, y, r]) => ({ x: pX(x) + rand(-20, 20), y: pY(y) + rand(-15, 15), r }));
  d.portals = [[0.3, 0.15, 0.7, 0.85], [0.3, 0.85, 0.7, 0.15]].concat(d.final ? [[0.06, 0.2, 0.94, 0.8]] : []).map(([a, b, c, e], i) => ({ ax: pX(a), ay: pY(b), bx: pX(c), by: pY(e), r: 38, col: i % 2 ? PT_RED : PT_PURPLE, col2: PT_BLUE }));
  d.zones = [{ kind: 'well', x: pX(0.33), y: pY(0.5), r: 120 }, { kind: 'mire', x: pX(0.67), y: pY(0.3), r: 110 }, { kind: 'storm', x: pX(0.67), y: pY(0.72), r: 120, tick: 1 }];
  d.hazards = Array.from({ length: d.final ? 4 : 3 }, (_, i) => { const a = rand(TAU); return { x: pX(0.2 + 0.2 * i), y: pY(rand(0.2, 0.8)), vx: dcos(a) * 150, vy: dsin(a) * 150, r: 24 }; });
  if (d.final) d.bands = VOID_BANDS.map((b, i) => ({ ...b, x0: ARENA.x + W2 * i / 3, x1: ARENA.x + W2 * (i + 1) / 3 }));
}
const voidMembers = (B, d) => B.fighters.filter(x => x.alive && x.dim === d.id);
function voidFallback(f, P, dmg) {         // only one Infinite Void at a time: a second cast becomes a dimensional rupture
  const es = supEnemies(f); if (!FX.off) FX.text(ARENA.cx, ARENA.y + 70, '◈ DIMENSIONAL RUPTURE ◈', PT_PURPLE, 36, { life: 1.8, vy: 0, pop: 2 });
  es.forEach((e, i) => after(0.3 + i * 0.2, () => { if (f.alive && e.alive) { portalFx(e.x, e.y, 60, PT_RED, 0.8, true); supBlast(f, e.x, e.y, 170, dmg * 0.55, { tag: 'explosion', force: 600, power: P }); } }));
}
function startVoid(f, P, col, dmg, final) {
  const B = BATTLE;
  if (B.voidDim || (f.dim || 0) !== 0) return voidFallback(f, P, dmg);
  const foes = supEnemies(f).filter(e => !e.isClone && !(e.st.outside > 0)).sort((a, b) => dist2(a.x, a.y, f.x, f.y) - dist2(b.x, b.y, f.x, f.y)).slice(0, final ? 2 : 1);
  if (!foes.length) return voidFallback(f, P, dmg);
  const d = B.voidDim = { id: (B.dimN = (B.dimN || 0) + 1), owner: f, foes, t: 0, phase: 'gate', dur: final ? 7 : 6, final, P, dmg, gx: f.x, gy: f.y, gdir: rand(TAU), saved: new Map(), volley: 1.8, copies: false, shiftT: 2.2, beamT: 1.6 };
  d.pre = { zones: new Set(B.zones), lasers: new Set(B.lasers), waves: new Set(B.waves), strikes: new Set(B.strikes) };
  buildVoid(d);
  camPunch(d.gx, d.gy, 0.2, 1);
  if (!FX.off) {
    FX.text(ARENA.cx, ARENA.y + 70, final ? '◈ OMNIVERSAL INFINITE VOID ◈' : '◈ INFINITE VOID REALM ◈', final ? '#ffffff' : '#b388ff', 40, { life: 1.6, vy: 0, pop: 2, stroke: '#05000c' }); supSound(f, 'ult', final ? 2 : 0);
    vfx((ctx, q) => vGateway(ctx, d.gx, d.gy, 40 + 160 * Math.min(1, q * 1.6), Math.min(1, q * 4) * (q > 0.85 ? (1 - q) * 6 : 1), q * 3, final), 1.1);
    for (const e of foes) vfx((ctx, q) => vPortalRing(ctx, e.x, e.y, e.r * (1 + q), PT_RED, Math.min(1, q * 3), q * 9), 0.9);
  }
}
function enterVoid(B, d) {
  const f = d.owner; d.foes = d.foes.filter(e => e.alive && !(e.st.outside > 0));
  if (!f.alive || !d.foes.length) { B.voidDim = null; return; }
  const P0 = d.platforms;
  for (const [i, m] of [f, ...d.foes].entries()) {
    d.saved.set(m.sid, { x: m.x, y: m.y }); m.dim = d.id; m.target = null;
    const pl = i === 0 ? P0[0] : P0[i === 1 ? 1 : 2]; m.x = inArenaX(pl.x, m.r); m.y = inArenaY(pl.y, m.r); const a = rand(TAU); m.vx = dcos(a) * 60; m.vy = dsin(a) * 60; m.st.invuln = Math.max(m.st.invuln, 0.5);
  }
  d.phase = 'battle';
  if (!FX.off) { FX.addFlash(0.5, '#120024'); FX.text(ARENA.cx, ARENA.cy - 20, 'ENTERING THE INFINITE VOID', '#ea80fc', 30, { life: 1.4, vy: 0, pop: 2 }); camPunch(ARENA.cx, ARENA.cy, 0.08, 1.2); }
}
function leaveVoid(B, d) {
  const all = B.fighters.filter(x => x.dim === d.id);
  let i = 0;
  for (const m of all) {
    if (m.voidCopy && m.owner === d.owner) { m.alive = false; if (!FX.off) FX.burst(m.x, m.y, PT_PURPLE, 14, 260); continue; }
    const s = d.saved.get(m.sid) || { x: d.gx, y: d.gy };
    m.dim = 0; m.x = inArenaX(s.x + (i % 2 ? 30 : -30) * (i > 1 ? 1 : 0), m.r); m.y = inArenaY(s.y, m.r); i++;
    if (m.alive) { m.st.invuln = Math.max(m.st.invuln, 0.6); const a = rand(TAU); m.vx = dcos(a) * m.baseSpeed; m.vy = dsin(a) * m.baseSpeed; }
  }
  for (const m of B.fighters) if (m.dim === d.id) m.dim = 0;          // anything left (fallen members) returns too
  // nothing created inside the void leaks into the arena
  B.projs = B.projs.filter(p => p.dim !== d.id);
  for (const key of ['zones', 'lasers', 'waves', 'strikes']) B[key] = B[key].filter(x => d.pre[key].has(x) || !(x.owner && (x.owner === d.owner || d.foes.includes(x.owner) || x.owner.voidCopy)));
  B.voidDim = null;
  if (!FX.off) { FX.text(ARENA.cx, ARENA.cy - 20, 'RETURNED TO THE ARENA', '#ffffff', 26, { life: 1.2, vy: 0 }); vfx((ctx, q) => vGateway(ctx, d.gx, d.gy, 200 * (1 - q), 1 - q, q * 3, d.final), 0.7); }
}
SUP.worldHooks.push((B, h) => {
  const d = B.voidDim; if (!d) return;
  d.t += h; const f = d.owner;
  if (d.phase === 'gate') { if (d.t >= 0.9) enterVoid(B, d); return; }
  const mem = voidMembers(B, d), foes = mem.filter(m => m.team !== f.team);
  f.ultMeter = 0;                                  // the ultimate cannot charge while its own void is open
  if (!f.alive || !foes.length || d.t >= d.dur) { if (d.t < d.dur && !d.endT) { d.endT = d.t + (f.alive ? 0.5 : 0.05); } if (d.t >= d.dur || (d.endT && d.t >= d.endT)) leaveVoid(B, d); return; }
  // 7. temporary copies of different balls come out of the portals
  if (!d.copies && d.t >= 1.4) { d.copies = true; const pool = voidCopyPool(), ends = d.portals.flatMap(p => [[p.ax, p.ay], [p.bx, p.by]]);
    const n = Math.max(0, (d.final ? 3 : 2) - voidCopies(f).length);          // never more than 2-3 copies in total
    for (let i = 0; i < n; i++) { const [x, y] = ends[i % ends.length]; summonVoidCopy(f, pool[RNG() * pool.length | 0], x, y, d.dur - d.t, d.P); } }
  // 8. coordinated dimensional attacks from every portal
  if ((d.volley -= h) <= 0 && d.t < d.dur - 1.3) { d.volley = 0.9;
    for (const p of d.portals) for (const [x, y] of [[p.ax, p.ay], [p.bx, p.by]]) { const e = foes.reduce((a, b) => (dist2(b.x, b.y, x, y) < dist2(a.x, a.y, x, y) ? b : a)); supShot(f, x, y, datan2(e.y - y, e.x - x), { speed: 640, r: 9, col: PT_RED, style: 'voidbolt', homing: 1.5, target: e, power: d.P, life: 1.6, dmg: d.dmg * 0.006 }); } }
  // gravity that keeps turning, platforms, spatial zones, drifting hazards, portal travel
  d.gdir += h * 0.45;
  for (const m of mem) {
    const isLord = m === f || (m.voidCopy && m.owner === f);
    const onPl = d.platforms.some(p => dist2(m.x, m.y, p.x, p.y) < (p.r + m.r * 0.3) * (p.r + m.r * 0.3));
    let gd = d.gdir, gp = 700;
    if (d.bands) { const bi = clamp(Math.floor((m.x - ARENA.x) / (ARENA.w / 3)), 0, 2), bk = d.bands[bi].kind;
      if (bk === 'nebula') gp = 450; else if (bk === 'crystal') { const cx = (d.bands[2].x0 + d.bands[2].x1) / 2; gd = datan2(ARENA.cy - m.y, cx - m.x); gp = 800; } else gd = HPI; }
    if (!isLord && !onPl) { const k = m.boss ? 0.4 : 1; m.vx += dcos(gd) * gp * h * k; m.vy += dsin(gd) * gp * h * k; }   // off the platforms: the void's gravity drags you
    for (const z of d.zones) { if (isLord || dist2(m.x, m.y, z.x, z.y) > z.r * z.r) continue;
      if (z.kind === 'well') { const a = datan2(z.y - m.y, z.x - m.x); m.vx += dcos(a) * 1300 * h; m.vy += dsin(a) * 1300 * h; }
      if (z.kind === 'mire') m.st.slow = Math.max(m.st.slow, 0.3); }
    for (const p of d.portals) { if ((m.portalCd || 0) > B.time) continue;
      for (const [ax, ay, bx, by] of [[p.ax, p.ay, p.bx, p.by], [p.bx, p.by, p.ax, p.ay]]) if (dist2(m.x, m.y, ax, ay) < p.r * p.r) { const sp = len(m.vx, m.vy) || 1; m.x = inArenaX(bx + m.vx / sp * (p.r + m.r + 4), m.r); m.y = inArenaY(by + m.vy / sp * (p.r + m.r + 4), m.r); m.portalCd = B.time + 0.7; if (!FX.off) FX.ring(bx, by, p.col2, p.r * 1.8, 0.3, 5, p.r); break; }
    }
  }
  const st = d.zones.find(z => z.kind === 'storm'); if (st && (st.tick -= h) <= 0) { st.tick = 1; const inside = foes.filter(m => dist2(m.x, m.y, st.x, st.y) < st.r * st.r); if (inside.length) supStrike(f, inside[0].x, inside[0].y, 0.35, 60, d.dmg * 0.05, PT_RED); }
  for (const z of d.hazards) { z.x += z.vx * h; z.y += z.vy * h; if (z.x < ARENA.x + z.r || z.x > ARENA.r - z.r) z.vx = -z.vx; if (z.y < ARENA.y + z.r || z.y > ARENA.b - z.r) z.vy = -z.vy;
    for (const m of foes) if (dist2(m.x, m.y, z.x, z.y) < (m.r + z.r) * (m.r + z.r) && !((m.sx || (m.sx = {})).meteorT > 0)) { m.sx.meteorT = 0.6; dealDamage(f, m, d.dmg * 0.025, { kind: 'skill', tag: 'collision', power: d.P }); knock(m, z.x, z.y, 500); } }
  // OMNIVERSAL: the dimensions are linked — enemies get pulled from one dimension to the next, giant portal gates fire across them
  if (d.final) {
    if ((d.shiftT -= h) <= 0) { d.shiftT = 2; for (const m of foes) { const w = ARENA.w / 3, bi = clamp(Math.floor((m.x - ARENA.x) / w), 0, 2), nx = m.x + w * (bi === 2 ? -2 : 1); if (!FX.off) portalFx(m.x, m.y, m.r * 1.6, PT_BLUE, 0.5); m.x = inArenaX(nx, m.r); if (!FX.off) portalFx(m.x, m.y, m.r * 1.6, PT_RED, 0.5); } }
    if ((d.beamT -= h) <= 0 && d.t < d.dur - 1.3) { d.beamT = 1.5; for (const e of foes) { const x = ARENA.x + 20, y = e.y + rand(-60, 60); addLaser(f, [x, y, e.x, e.y], { charge: 0.3, dur: 0.4, w: 22, dmg: d.dmg * 0.03, col: PT_BLUE }); lastLaser().conv = { tgt: e }; } }
  }
  // 9. the void collapses in one massive explosion
  if (!d.boomed && d.t >= d.dur - 0.5) { d.boomed = true;
    for (const m of foes) { dealDamage(f, m, d.dmg * (d.final ? 0.26 : 0.26), { kind: 'skill', tag: 'explosion', effect: 'weaken', power: d.P }); knock(m, ARENA.cx, ARENA.cy, 900); }
    if (!FX.off) { FX.addFlash(0.45, '#ea80fc'); FX.addShake(22); for (let i = 0; i < 5; i++) FX.ring(ARENA.cx, ARENA.cy, i % 2 ? PT_RED : PT_PURPLE, 320 + i * 160, 0.8, 16, 30); FX.burst(ARENA.cx, ARENA.cy, '#ea80fc', 100, 1000, 9, 1.1); } }
});
UL('pt_voidrealm', 'Infinite Void Realm — God Portal opens a gigantic gateway and takes its opponent into its own dimension: floating platforms, turning gravity, spatial zones, hazards and a portal network; copies of other balls and every portal attack, then the void explodes and the survivors return', (f, P, col, dmg) => startVoid(f, P, col, dmg, false));
UL('pt_omniverse', 'Omniversal Infinite Void — two opponents are taken into three linked dimensions (Nebula Expanse, Crimson Rift, Crystal Gravity) with their own gravity; the network keeps dragging them between dimensions while giant gates fire across', (f, P, col, dmg) => startVoid(f, P, col, dmg, true));
paidGodBall(B('godportal', 'God Portal Ball', 'God', 'God Tier', [128, 78, 70, 82, 30], D('#05000c', PT_PURPLE, PT_RED, 'portalcore', [], '', { glow: 1.7, sdeco: ['portalrings', 'miniportals', 'dimshards'], prings: 2, minis: 3, sfx: { wave: 'sawtooth', pitch: 0.65 } }),
  [S('PORTAL DASH', 'pt_dash', 6, 70, PT_PURPLE), S('VOID SUMMON', 'pt_summon', 14, 65, PT_BLUE), S('DIMENSIONAL TRAP', 'pt_trap', 10, 70, PT_RED), S('PORTAL REFLECTION', 'pt_reflect', 11, 60, PT_PURPLE), S('VOID COLLAPSE', 'pt_collapse', 9, 80, PT_RED)],
  U('INFINITE VOID REALM', 'pt_voidrealm', 110, '#b388ff', 'weaken'), 'intelligent', { desc: 'SUPREME PREMIUM GOD • PHP 99. Ruler of infinite dimensions: portals, summons, dimensional traps — and its own Infinite Void world.' }), {
  godClass: 'SUPREME PREMIUM GOD', formMul: [1, 1.05, 1.08], skillK: [1.05, 0.75, 0.5], ultChargeMul: 0.5,
  forms: [{ name: 'PORTAL GUARDIAN' }, { name: 'VOID EMPEROR', design: { c3: PT_BLUE, prings: 3, minis: 5, glow: 2.0 } },
    { name: 'GOD OF INFINITE DIMENSIONS', design: { c1: '#000000', c2: PT_BLUE, c3: PT_RED, pat: 'portalcore2', prings: 4, minis: 7, glow: 2.5, sdeco: ['portalrings', 'miniportals', 'dimshards', 'portalgates'] } }],
  finalUlt: U('OMNIVERSAL INFINITE VOID', 'pt_omniverse', 120, '#ffffff', 'weaken'), sound: { base: 98, wave: 'sawtooth', slide: 2.8, noise: 700 },
  passiveInfo: { name: 'DIMENSIONAL MASTERY', desc: 'Every portal it uses (dash, summon, trap, redirected shot, collapse) adds dimensional energy for 6 s: each stack makes abilities 5% faster and hits 2% harder.' },
  formPassive: ['Up to 5 stacks.', 'Up to 7 stacks.', 'Up to 9 stacks.'],
  passive: {
    init(f) { f.sx.dm = 0; },
    tick(f, dt) { const s = f.sx; if (s.dm > 0 && !(s.dmT > 0)) { s.dmDecay = (s.dmDecay || 0) + dt; if (s.dmDecay >= 1) { s.dmDecay = 0; s.dm--; } } f.pCd *= 1 - 0.05 * s.dm; f.pAtk *= 1 + 0.02 * s.dm; },
  },
  fx: {
    idle: (f, d) => { const a = vr(TAU), r = f.r * vr(1.5, 2.3); FX.p(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, -Math.cos(a) * r * 1.6 - Math.sin(a) * 80, -Math.sin(a) * r * 1.6 + Math.cos(a) * 80, 0.5, vr(2, 4), Math.random() < 0.5 ? d.c2 : d.c3, 'dot', 0); },
    bounce: (f, x, y, d) => { FX.ring(x, y, d.c2, 60, 0.3, 4, 6); FX.burst(x, y, d.c3, 8, 220, 4, 0.35); },
    victory: (f, d) => { vfx((ctx, q) => { vGateway(ctx, f.x, f.y, f.r * (f.form === 2 ? 3.4 : 2.4), 1 - q * 0.5, q * 3, f.form === 2); }, 1.8); FX.text(f.x, f.y - f.r - 90, f.form === 2 ? 'ALL DIMENSIONS ARE MINE' : 'THE VOID IS WATCHING', d.c2, 22, { life: 1.8 }); },
    defeat: (f, d) => { vfx((ctx, q) => vPortalRing(ctx, f.x, f.y, f.r * 1.6 * (1 - q), d.c3, 1 - q, q * 12), 1); FX.burst(f.x, f.y, d.c2, 50, 480, 6, 1.0); darkBurst(f.x, f.y, 150, 0.9); },
    entrance: f => vfx((ctx, q) => vGateway(ctx, f.x, f.y, 220 * Math.sin(Math.PI * q), Math.sin(Math.PI * q), q * 4, true), 1.4),
  },
});
SUP.chipHooks.push((f, chips) => {
  const s = f.sx;
  if (s.wm > 0) chips.push(['WEAPON ' + Math.round(s.wm) + '%', GUN_GOLD]); if (s.overdriveT > 0) chips.push(['OVERDRIVE', '#ff6d00']); if (s.arsenal) chips.push(['ARSENAL', GUN_BLUE]);
  if (s.dm > 0) chips.push(['DIMENSION ×' + s.dm, PT_PURPLE]); if (s.reflectT > 0) chips.push(['PORTAL REFLECT', PT_PURPLE]);
  if (f.dim) chips.push(['IN THE INFINITE VOID', '#ea80fc']);
});

/* =====================================================================
   2.3.0 VISUALS (visual only): God of Guns / God Portal art, projectiles, cinematic shapes, the Infinite Void world
   ===================================================================== */
Object.assign(PATTERN_FN, {
  gunscore(g, R, d, rng) {          // a floating mechanical core: gear teeth, gold bolts, energy chamber, cooling vents
    const gr = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R); gr.addColorStop(0, shade(d.c1, 0.35)); gr.addColorStop(1, shade(d.c1, -0.3)); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.fillStyle = rgba('#90a4ae', 0.55); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.save(); g.rotate(a); g.fillRect(R * 0.74, -R * 0.06, R * 0.22, R * 0.12); g.restore(); }
    g.strokeStyle = rgba(GUN_GOLD, 0.9); g.lineWidth = R * 0.05; g.beginPath(); g.arc(0, 0, R * 0.7, 0, TAU); g.stroke(); g.lineWidth = R * 0.025; g.beginPath(); g.arc(0, 0, R * 0.52, 0, TAU); g.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; g.fillStyle = GUN_GOLD; g.beginPath(); g.arc(Math.cos(a) * R * 0.61, Math.sin(a) * R * 0.61, R * 0.035, 0, TAU); g.fill(); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; g.strokeStyle = rgba(d.c3, 0.7); g.lineWidth = R * 0.04; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2); g.lineTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5); g.stroke(); }
    _blob(g, 0, 0, R * 0.42, d.c2, 1); _blob(g, 0, 0, R * 0.18, '#ffffff', 1);
  },
  gunscore2(g, R, d, rng) { PATTERN_FN.gunscore(g, R, d, rng); g.strokeStyle = rgba('#ffffff', 0.75); g.lineWidth = R * 0.02; g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU; g.lineTo(Math.cos(a) * R * 0.34, Math.sin(a) * R * 0.34); } g.stroke(); _blob(g, 0, 0, R * 0.26, GUN_GOLD, 0.8); },
  portalcore(g, R, d, rng) {        // a black core with a glowing dimensional portal symbol
    g.fillStyle = '#020006'; g.fillRect(-R, -R, 2 * R, 2 * R); _stars(g, R, 40, rng, ['#ffffff', d.c2, d.c3]);
    for (let i = 0; i < 6; i++) { g.strokeStyle = rgba(i % 2 ? d.c3 : d.c2, 0.75 - i * 0.08); g.lineWidth = R * (0.07 - i * 0.008); g.beginPath(); g.ellipse(0, 0, R * (0.82 - i * 0.12), R * (0.55 - i * 0.08), i * 0.5, 0, TAU); g.stroke(); }
    _blob(g, 0, 0, R * 0.34, d.c2, 1); g.fillStyle = '#000'; g.beginPath(); g.ellipse(0, 0, R * 0.16, R * 0.1, 0.3, 0, TAU); g.fill();
  },
  portalcore2(g, R, d, rng) { PATTERN_FN.portalcore(g, R, d, rng); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; g.strokeStyle = rgba(d.c2, 0.8); g.lineWidth = R * 0.03; g.beginPath(); g.ellipse(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, R * 0.14, R * 0.09, a, 0, TAU); g.stroke(); } },
});
for (const p of ['gunscore', 'gunscore2', 'portalcore', 'portalcore2']) if (!PATTERNS.includes(p)) PATTERNS.push(p);

/** a floating energy weapon pointing along `ang` */
function vGun(ctx, x, y, ang, type, s, col, flash) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  const L = type === 'sniper' ? 30 : type === 'rocket' ? 22 : 20;
  ctx.fillStyle = '#263238'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  if (type === 'rocket') { ctx.fillRect(-10, -7, 24, 14); ctx.strokeRect(-10, -7, 24, 14); ctx.fillStyle = '#ff6d00'; for (const yy of [-4, 0, 4]) { ctx.beginPath(); ctx.arc(14, yy, 2, 0, TAU); ctx.fill(); } }
  else { ctx.fillRect(-10, -4, L, 8); ctx.strokeRect(-10, -4, L, 8); ctx.fillRect(-6, 3, 6, 8); ctx.fillStyle = col; ctx.fillRect(L - 14, -2, 4, 4); if (type === 'blaster') { ctx.fillStyle = '#263238'; ctx.fillRect(-4, -8, L - 8, 4); } }
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), -12, -12, 24, 24);
  if (flash > 0) ctx.drawImage(glowSprite('#ffffff'), L - 18, -8, 16 * (1 + flash), 16);
  ctx.restore();
}
function vGiantCannon(ctx, x, y, ang, s, a, q) {
  if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y); ctx.scale(s, s);
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(GUN_GOLD), -70, -70, 140, 140); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#1c2541'; ctx.strokeStyle = GUN_GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.rotate(ang); ctx.fillStyle = '#37474f'; ctx.fillRect(0, -13, 78, 26); ctx.strokeRect(0, -13, 78, 26); ctx.fillStyle = GUN_BLUE; for (let i = 0; i < 3; i++) ctx.fillRect(18 + i * 18, -13, 5, 26);
  const ch = (q * 3) % 1; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(GUN_BLUE), 68 - 20 * ch, -20 * ch, 40 * ch, 40 * ch);
  ctx.restore();
}
function vRailCharge(ctx, x, y, r, q, k) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + q * 8, d = r * (3 - q * 2.2); ctx.drawImage(glowSprite(k === 2 ? GUN_GOLD : GUN_BLUE), x + Math.cos(a) * d - 8, y + Math.sin(a) * d - 8, 16, 16); } const R = r * (1 + q); ctx.strokeStyle = rgba(GUN_BLUE, 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, R, -HPI, -HPI + TAU * q); ctx.stroke(); ctx.restore(); }
function vWeaponRealm(ctx, a, q, apoc) {
  if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  const g = ctx.createLinearGradient(0, ARENA.y, 0, ARENA.b); g.addColorStop(0, 'rgba(10,16,48,.75)'); g.addColorStop(1, 'rgba(30,8,48,.75)'); ctx.fillStyle = g; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  ctx.strokeStyle = 'rgba(64,196,255,.16)'; ctx.lineWidth = 1;
  for (let x = ARENA.x; x <= ARENA.r; x += 56) { ctx.beginPath(); ctx.moveTo(x, ARENA.y); ctx.lineTo(x + 40, ARENA.b); ctx.stroke(); }
  const n = apoc ? 140 : 100, rng = mulberry32(1234);
  for (let i = 0; i < n; i++) { const bx = ARENA.x + rng() * ARENA.w, by = ARENA.y + rng() * ARENA.h, drift = Math.sin(q * 6 + i) * 6, ang = Math.atan2(ARENA.cy - by, ARENA.cx - bx) + (apoc ? q * 2 : 0);
    vGun(ctx, bx + drift, by, ang, ['pistol', 'blaster', 'sniper', 'rocket'][i % 4], 0.55 + (i % 3) * 0.15, i % 3 ? GUN_BLUE : GUN_GOLD, (Math.sin(q * 40 + i) > 0.85) ? 1 : 0); }
  if (apoc) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(GUN_GOLD, 0.6); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(ARENA.cx, ARENA.cy, ARENA.w * 0.46, ARENA.h * 0.44, q * 0.5, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function vPortalRing(ctx, x, y, r, col, a, t) {
  if (a <= 0.01 || r <= 0.5) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), -r * 2, -r * 2, r * 4, r * 4); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#030008'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.82, r * 0.64, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = i ? rgba(col, 0.75 - i * 0.2) : '#ffffff'; ctx.lineWidth = Math.max(1.5, r * (0.12 - i * 0.03)); ctx.beginPath(); ctx.ellipse(0, 0, r * (1 - i * 0.18), r * 0.78 * (1 - i * 0.18), 0, t * (1 + i * 0.4), t * (1 + i * 0.4) + 4.6); ctx.stroke(); }
  ctx.restore();
}
function vGateway(ctx, x, y, r, a, t, final) {     // the gigantic dimensional gateway
  if (a <= 0.01 || r <= 1) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(final ? '#ffffff' : PT_PURPLE), -r * 2.2, -r * 2.2, r * 4.4, r * 4.4); ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, '#000'); g.addColorStop(0.7, '#12002a'); g.addColorStop(1, rgba(PT_PURPLE, 0.6)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.15, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.clip(); for (let i = 0; i < 40; i++) { const an = i * 2.4 + t, rr = (i * 37 % 100) / 100 * r; ctx.fillStyle = i % 3 ? '#ffffff' : '#ea80fc'; ctx.fillRect(Math.cos(an) * rr, Math.sin(an) * rr * 1.15, 2, 2); } ctx.restore();
  for (let i = 0; i < (final ? 4 : 3); i++) { ctx.strokeStyle = [PT_PURPLE, PT_RED, PT_BLUE, '#ffffff'][i]; ctx.lineWidth = Math.max(2, r * 0.05); ctx.beginPath(); ctx.ellipse(0, 0, r * (1.05 + i * 0.12), r * 1.15 * (1.05 + i * 0.12), 0, t * (i % 2 ? -1 : 1) + i, t * (i % 2 ? -1 : 1) + i + 4.8); ctx.stroke(); }
  ctx.fillStyle = rgba('#ea80fc', 0.9); for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + t * 0.5; ctx.save(); ctx.translate(Math.cos(an) * r * 1.35, Math.sin(an) * r * 1.5); ctx.rotate(an); ctx.fillRect(-4, -12, 8, 24); ctx.restore(); }
  ctx.restore();
}

Object.assign(SUP.deco, {
  gunring(ctx, r, d, t, front) { const n = d.gunrings || 1; for (let i = 0; i < n; i++) { ctx.save(); ctx.rotate(0.35 + i * 1.0); const rr = r * (1.35 + i * 0.14); ctx.strokeStyle = rgba(i % 2 ? GUN_GOLD : d.c2, 0.8); ctx.lineWidth = r * 0.045; ctx.setLineDash([r * 0.18, r * 0.08]); ctx.lineDashOffset = -t * 40 * (i % 2 ? -1 : 1); ctx.beginPath(); if (front) ctx.ellipse(0, 0, rr, rr * 0.3, 0, 0, Math.PI); else ctx.ellipse(0, 0, rr, rr * 0.3, 0, Math.PI, TAU); ctx.stroke(); ctx.restore(); } },
  floatguns(ctx, r, d, t, front) { const n = d.guns || 4; for (let i = 0; i < n; i++) { const a = t * 0.9 + i / n * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; const x = Math.cos(a) * r * 1.55, y = sn * r * 0.62; vGun(ctx, x, y, Math.atan2(y, x) + Math.sin(t * 3 + i) * 0.3, ['pistol', 'blaster', 'sniper', 'rocket'][i % 4], r / 55, i % 2 ? GUN_GOLD : d.c2, 0); } },
  mechplates(ctx, r, d, t, front) { if (!front) return; ctx.save(); ctx.rotate(-t * 0.3); ctx.fillStyle = rgba('#90a4ae', 0.85); ctx.strokeStyle = GUN_GOLD; ctx.lineWidth = r * 0.02; for (let i = 0; i < 4; i++) { ctx.rotate(HPI); ctx.beginPath(); ctx.moveTo(r * 0.92, -r * 0.25); ctx.lineTo(r * 1.12, -r * 0.18); ctx.lineTo(r * 1.12, r * 0.18); ctx.lineTo(r * 0.92, r * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke(); } ctx.restore(); },
  floatcannons(ctx, r, d, t, front) { if (front) return; for (let i = 0; i < 2; i++) { const sd = i ? 1 : -1; vGiantCannon(ctx, sd * r * 1.55, -r * 0.9, -HPI + sd * 0.4 + Math.sin(t * 2 + i) * 0.1, r / 110, 0.9, t); } },
  portalrings(ctx, r, d, t, front) { const n = d.prings || 2; for (let i = 0; i < n; i++) { ctx.save(); ctx.rotate(i * 0.8 + t * 0.2 * (i % 2 ? -1 : 1)); const rr = r * (1.3 + i * 0.13); ctx.strokeStyle = rgba([d.c2, d.c3, PT_BLUE, '#ffffff'][i % 4], 0.8); ctx.lineWidth = r * 0.04; ctx.beginPath(); if (front) ctx.ellipse(0, 0, rr, rr * 0.34, 0, 0, Math.PI); else ctx.ellipse(0, 0, rr, rr * 0.34, 0, Math.PI, TAU); ctx.stroke(); ctx.restore(); } },
  miniportals(ctx, r, d, t, front) { const n = d.minis || 3; for (let i = 0; i < n; i++) { const a = -t * 0.8 + i / n * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; vPortalRing(ctx, Math.cos(a) * r * 1.75, sn * r * 0.8, r * 0.18, i % 2 ? d.c3 : d.c2, 0.95, t * 3 + i); } },
  dimshards(ctx, r, d, t, front) { for (let i = 0; i < 6; i++) { const a = t * 0.6 + i / 6 * TAU, sn = Math.sin(a); if ((sn > 0) !== front) continue; ctx.save(); ctx.translate(Math.cos(a) * r * 2.05, sn * r * 0.95); ctx.rotate(t * 2 + i); ctx.fillStyle = rgba(i % 2 ? d.c2 : PT_BLUE, 0.85); ctx.beginPath(); ctx.moveTo(0, -r * 0.1); ctx.lineTo(r * 0.07, 0); ctx.lineTo(0, r * 0.12); ctx.lineTo(-r * 0.06, 0); ctx.closePath(); ctx.fill(); ctx.restore(); } },
  portalgates(ctx, r, d, t, front) { if (front) return; for (const sd of [-1, 1]) vGateway(ctx, sd * r * 1.9, 0, r * 0.55, 0.85, t, false); },
});
SUP.projStyles = Object.assign(SUP.projStyles || {}, {
  gunbolt(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = p.col; ctx.fillRect(-r * 2.6, -r * 0.4, r * 3.4, r * 0.8); ctx.fillStyle = '#ffffff'; ctx.fillRect(-r * 0.4, -r * 0.22, r * 1.2, r * 0.44); ctx.restore(); ctx.drawImage(glowSprite(p.col), p.x - r * 2, p.y - r * 2, r * 4, r * 4); },
  tracer(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); const g = ctx.createLinearGradient(-r * 9, 0, r, 0); g.addColorStop(0, rgba(p.col, 0)); g.addColorStop(1, p.col); ctx.fillStyle = g; ctx.fillRect(-r * 9, -r * 0.35, r * 10, r * 0.7); ctx.restore(); ctx.drawImage(glowSprite('#ffffff'), p.x - r * 1.5, p.y - r * 1.5, r * 3, r * 3); },
  cannonshell(ctx, p, t, r, a) { ctx.drawImage(glowSprite(p.col), p.x - r * 2.6, p.y - r * 2.6, r * 5.2, r * 5.2); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.75, 0, 0, TAU); ctx.fill(); ctx.fillStyle = p.col; ctx.fillRect(-r * 0.3, -r * 0.75, r * 0.25, r * 1.5); ctx.restore(); },
  voidbolt(ctx, p, t, r) { ctx.drawImage(glowSprite(p.col), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.fillStyle = '#05000c'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.7, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ea80fc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r, t * 9, t * 9 + 4); ctx.stroke(); },
  voidshard(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = p.col; ctx.beginPath(); ctx.moveTo(r * 2, 0); ctx.lineTo(0, -r * 0.6); ctx.lineTo(-r * 1.4, 0); ctx.lineTo(0, r * 0.6); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.drawImage(glowSprite(PT_PURPLE), p.x - r * 2.2, p.y - r * 2.2, r * 4.4, r * 4.4); },
});

/* ---------------- the Infinite Void world (drawn instead of the arena for whoever is inside) ---------------- */
function drawVoidWorld(ctx, B, d, dt) {
  const t = B.time, g = ctx.createRadialGradient(ARENA.cx, ARENA.cy, 40, ARENA.cx, ARENA.cy, W * 0.75);
  g.addColorStop(0, '#120526'); g.addColorStop(0.55, '#06010f'); g.addColorStop(1, '#000000'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const rng = mulberry32(99 + d.id);
  for (let i = 0; i < 160; i++) { const x = rng() * W, y = rng() * H, s = rng() * 2 + 0.4, tw = 0.5 + 0.5 * Math.sin(t * (1 + rng() * 3) + i); ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * tw})`; ctx.fillRect((x + t * (4 + s * 6)) % W, y, s, s); }
  for (let i = 0; i < 3; i++) {    // animated spiral galaxies
    const gx = [W * 0.2, W * 0.78, W * 0.55][i], gy = [H * 0.28, H * 0.7, H * 0.18][i], rot = t * (0.15 + i * 0.05);
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(rot); ctx.scale(1, 0.55);
    for (let k = 0; k < 160; k++) { const arm = k % 2, rr = (k / 160) * 110, an = rr * 0.05 + arm * Math.PI; ctx.fillStyle = k % 5 ? rgba(['#b388ff', '#40c4ff', '#ff80ab'][i], 0.5) : 'rgba(255,255,255,.8)'; ctx.fillRect(Math.cos(an) * rr, Math.sin(an) * rr, 2, 2); }
    ctx.drawImage(glowSprite(['#b388ff', '#40c4ff', '#ff80ab'][i]), -40, -40, 80, 80); ctx.restore();
  }
  for (let i = 0; i < 4; i++) { const nx = W * (0.15 + 0.25 * i) + Math.sin(t * 0.2 + i) * 30, ny = H * (0.5 + 0.25 * Math.sin(i * 1.7)); ctx.drawImage(glowSprite(i % 2 ? '#3a0ca3' : '#7c0040'), nx - 260, ny - 200, 520, 400); }
  ctx.restore();
  if (d.bands) for (const b of d.bands) { ctx.save(); ctx.fillStyle = rgba(b.col, 0.08 + 0.03 * Math.sin(t * 2)); ctx.fillRect(b.x0, ARENA.y, b.x1 - b.x0, ARENA.h); ctx.strokeStyle = rgba(b.col, 0.5); ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.moveTo(b.x1, ARENA.y); ctx.lineTo(b.x1, ARENA.b); ctx.stroke(); ctx.setLineDash([]); ctx.font = '900 15px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(b.col, 0.85); ctx.fillText(b.name, (b.x0 + b.x1) / 2, ARENA.b - 14);
    if (b.kind === 'crystal') { const cx = (b.x0 + b.x1) / 2; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#b388ff'), cx - 60, ARENA.cy - 60, 120, 120); ctx.fillStyle = '#e1bee7'; ctx.beginPath(); ctx.moveTo(cx, ARENA.cy - 34); ctx.lineTo(cx + 18, ARENA.cy); ctx.lineTo(cx, ARENA.cy + 34); ctx.lineTo(cx - 18, ARENA.cy); ctx.closePath(); ctx.fill(); }
    if (b.kind === 'crimson') { ctx.strokeStyle = 'rgba(255,23,68,.35)'; ctx.lineWidth = 2; for (let k = 0; k < 6; k++) { const yy = ARENA.y + ((t * 120 + k * 90) % ARENA.h); ctx.beginPath(); ctx.moveTo(b.x0, yy); ctx.lineTo(b.x1, yy + 30); ctx.stroke(); } }
    ctx.restore(); }
  // the dimension's edge: a faint energy boundary instead of walls
  ctx.save(); ctx.strokeStyle = `rgba(179,136,255,${0.25 + 0.15 * Math.sin(t * 3)})`; ctx.lineWidth = 2; ctx.setLineDash([4, 10]); ctx.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.restore();
  // gravity currents
  ctx.save(); ctx.strokeStyle = 'rgba(234,128,252,.18)'; ctx.lineWidth = 1.5; for (let i = 0; i < 26; i++) { const x0 = ARENA.x + ((i * 97 + t * 60 * Math.cos(d.gdir)) % ARENA.w + ARENA.w) % ARENA.w, y0 = ARENA.y + ((i * 53 + t * 60 * Math.sin(d.gdir)) % ARENA.h + ARENA.h) % ARENA.h; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(d.gdir) * 26, y0 + Math.sin(d.gdir) * 26); ctx.stroke(); } ctx.restore();
  // spatial zones
  for (const z of d.zones) { const K = VOID_KINDS[z.kind]; ctx.save(); ctx.translate(z.x, z.y); ctx.globalCompositeOperation = 'lighter'; const gz = ctx.createRadialGradient(0, 0, 0, 0, 0, z.r); gz.addColorStop(0, rgba(K.col, 0.22)); gz.addColorStop(1, rgba(K.col, 0)); ctx.fillStyle = gz; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(K.col, 0.6); ctx.lineWidth = 2; if (z.kind === 'well') for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(0, 0, z.r * (1 - ((t * 0.6 + k / 4) % 1)), 0, TAU); ctx.stroke(); } else { ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(0, 0, z.r, t, t + TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.font = '800 11px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(K.col, 0.95); ctx.fillText(K.name, 0, -z.r - 6); ctx.restore(); }
  // floating platforms: glowing rock islands
  for (const p of d.platforms) { ctx.save(); ctx.translate(p.x, p.y + Math.sin(t * 1.5 + p.x) * 2);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(6, 14, p.r, p.r * 0.86, 0, 0, TAU); ctx.fill();
    const gp = ctx.createRadialGradient(-p.r * 0.3, -p.r * 0.3, 4, 0, 0, p.r); gp.addColorStop(0, '#3a2f5c'); gp.addColorStop(1, '#151027'); ctx.fillStyle = gp; ctx.beginPath(); for (let k = 0; k <= 12; k++) { const an = k / 12 * TAU, rr = p.r * (0.92 + 0.08 * Math.sin(k * 2.3 + p.x)); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(179,136,255,.8)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(64,196,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, 0, TAU); ctx.stroke(); ctx.restore(); }
  for (const p of d.portals) { vPortalRing(ctx, p.ax, p.ay, p.r, p.col, 1, t * 3); vPortalRing(ctx, p.bx, p.by, p.r, p.col2, 1, -t * 3); ctx.save(); ctx.strokeStyle = rgba(p.col, 0.12); ctx.setLineDash([3, 12]); ctx.beginPath(); ctx.moveTo(p.ax, p.ay); ctx.lineTo(p.bx, p.by); ctx.stroke(); ctx.restore(); }
  for (const z of d.hazards) { ctx.save(); ctx.translate(z.x, z.y); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#ff1744'), -z.r * 2.4, -z.r * 2.4, z.r * 4.8, z.r * 4.8); ctx.globalCompositeOperation = 'source-over'; ctx.rotate(t * 2); ctx.fillStyle = '#1a0010'; ctx.beginPath(); for (let k = 0; k <= 8; k++) { const an = k / 8 * TAU, rr = z.r * (k % 2 ? 0.7 : 1); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
  // the collapse: the void gathers before it explodes
  const left = d.dur - d.t; if (left < 1.2 && left > 0) { const q = 1 - left / 1.2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 20; i++) { const an = i / 20 * TAU + q * 4, rr = (1 - q) * 520; ctx.drawImage(glowSprite(i % 2 ? '#ea80fc' : '#ff1744'), ARENA.cx + Math.cos(an) * rr - 14, ARENA.cy + Math.sin(an) * rr * 0.6 - 14, 28, 28); } ctx.drawImage(glowSprite('#ffffff'), ARENA.cx - 80 * q, ARENA.cy - 80 * q, 160 * q, 160 * q); ctx.restore(); }
  ctx.save(); ctx.font = '900 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(234,128,252,.9)'; ctx.fillText(`◈ ${d.final ? 'OMNIVERSAL ' : ''}INFINITE VOID — ${Math.max(0, Math.ceil(d.dur - d.t))}s`, ARENA.cx, ARENA.y + 22); ctx.restore();
}
/** what the viewer sees: the void when their own ball is inside it (or when there is no player), the arena otherwise */
function voidViewDim(B) { const d = B.voidDim; if (!d || d.phase === 'gate') return 0; const p = B.player; if (p) return p.alive || p.dim ? (p.dim || 0) : 0; return d.id; }
/** a small window into the void for players left in the arena */
function drawVoidInset(ctx, B, d) {
  const w = 300, hh = 170, x0 = W - w - 18, y0 = 96, s = w / ARENA.w;
  ctx.save(); ctx.fillStyle = '#05000c'; ctx.strokeStyle = '#b388ff'; ctx.lineWidth = 2; ctx.fillRect(x0, y0, w, hh); ctx.strokeRect(x0, y0, w, hh);
  ctx.beginPath(); ctx.rect(x0, y0, w, hh); ctx.clip(); ctx.translate(x0, y0 + (hh - ARENA.h * s) / 2); ctx.scale(s, s); ctx.translate(-ARENA.x, -ARENA.y);
  for (const p of d.platforms) { ctx.fillStyle = '#2a2147'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  for (const p of d.portals) { vPortalRing(ctx, p.ax, p.ay, p.r, p.col, 1, B.time * 3); vPortalRing(ctx, p.bx, p.by, p.r, p.col2, 1, B.time * 3); }
  for (const f of B.fighters) if (f.alive && f.dim === d.id) drawBall(ctx, f.def, f.x, f.y, f.r, { t: f.t, rot: f.rot, noAura: true, small: true, noSupDeco: true });
  ctx.restore();
  ctx.save(); ctx.font = '800 12px "Segoe UI", sans-serif'; ctx.fillStyle = '#ea80fc'; ctx.fillText('◈ INFINITE VOID — ' + Math.max(0, Math.ceil(d.dur - d.t)) + 's', x0 + 8, y0 + 16); ctx.restore();
}
if (typeof Battle !== 'undefined') {
  const baseDraw = Battle.prototype.draw, noHud = () => {};
  Battle.prototype.draw = function (ctx, dt) {
    const d = this.voidDim; if (!d) return baseDraw.call(this, ctx, dt);
    const vd = voidViewDim(this), dimOf = x => (x && x.dim) || 0;
    const keep = { fighters: this.fighters, projs: this.projs, zones: this.zones, lasers: this.lasers, waves: this.waves, strikes: this.strikes, beams: this.beams, orbs: this.orbs };
    this.fighters = keep.fighters.filter(f => dimOf(f) === vd);
    this.projs = keep.projs.filter(p => (p.dim ?? dimOf(p.owner)) === vd);
    for (const k of ['zones', 'lasers', 'waves', 'strikes', 'beams', 'orbs']) this[k] = keep[k].filter(x => dimOf(x.owner) === vd);
    this._vd = vd; this.drawHud = noHud;
    try { baseDraw.call(this, ctx, dt); } finally { Object.assign(this, keep); this._vd = 0; delete this.drawHud; }
    if (vd === 0 && d.phase !== 'gate') drawVoidInset(ctx, this, d);
    this.drawHud(ctx);
  };
  const baseArena = Arena.draw;
  Arena.draw = function (ctx, dt) { const B = BATTLE; if (B && B._vd && B.voidDim) return drawVoidWorld(ctx, B, B.voidDim, dt); return baseArena.call(this, ctx, dt); };
}

/* =====================================================================
   PREMIUM GOD SHOP UI — shop screen, purchase return, history, restore; owner setup panel.
   The page only shows what the server says: it never marks anything as bought by itself.
   ===================================================================== */
if (!window.NBB_HEADLESS) {
  const css = `
  .gshop-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
  .gshop-card{border-radius:14px;border:1px solid rgba(255,213,79,.45);background:linear-gradient(160deg,rgba(20,12,48,.92),rgba(6,10,30,.92));padding:12px;display:flex;flex-direction:column;gap:8px;color:#fff;min-width:0}
  .gshop-card.bundle{border-color:rgba(234,128,252,.6);background:linear-gradient(160deg,rgba(48,8,60,.92),rgba(6,10,30,.92))}
  .gshop-card .top{display:flex;gap:12px;align-items:center}.gshop-card .top canvas{flex:none}
  .gshop-card .cls{font-size:11px;font-weight:900;letter-spacing:1px;color:#ffd54f}.gshop-card .nm{font-size:18px;font-weight:900}
  .gshop-price{font-size:22px;font-weight:900;color:#ffe082}.gshop-price small{font-size:12px;color:#9fb6d4;font-weight:700}
  .gshop-owned{background:#00c853;color:#00170a;border-radius:7px;padding:3px 9px;font-weight:900;font-size:12px;display:inline-block}
  .gshop-methods{display:flex;gap:6px;flex-wrap:wrap}.gshop-methods span{border:1px solid rgba(255,255,255,.25);border-radius:7px;padding:3px 8px;font-size:12px;font-weight:800;background:rgba(255,255,255,.06)}
  .gshop-note{border-radius:10px;padding:10px 12px;border:1px solid rgba(255,213,79,.4);background:rgba(255,213,79,.08);font-size:13px}
  .gshop-row{display:flex;gap:8px;flex-wrap:wrap}.gshop-row .btn{flex:1;min-width:120px}
  .gshop-tbl{width:100%;border-collapse:collapse;font-size:13px}.gshop-tbl td,.gshop-tbl th{padding:6px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const mount = () => {
    if (!document.getElementById('scr-godshop')) { const sec = h('section', { id: 'scr-godshop', class: 'screen' }, h('header', { class: 'scr-head' }, h('button', { class: 'back', 'data-back': '' }, '‹ Back'), h('h2', {}, '💎 Premium God Shop'), h('div', { class: 'pill' }, '🪙 ', h('b', { class: 'coinVal' }, '0'))), h('div', { class: 'scr-body' }, h('div', { id: 'godShopBody' })));
      const anchor = document.getElementById('scr-shop') || document.querySelector('.screen'); if (anchor) anchor.after(sec); }
    const mb = document.querySelector('.menu-buttons'); if (mb && !mb.querySelector('[data-go="godshop"]')) { const b = h('button', { class: 'btn gold', 'data-go': 'godshop' }, '💎 Premium God Shop'); const prem = mb.querySelector('[data-go="membership"]'); prem ? prem.after(b) : mb.append(b); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  PARENT.godshop = 'menu';
}
const shopOnline = () => !!(window.Online && Online.available);
async function shopApi(method, path, body) { return method === 'GET' ? API.get(path) : API.post(path, body || {}); }
function paidGodCard(b, shop, o = {}) {
  const owned = canUseBall(b), c = h('div', { class: 'gshop-card' }), cv = ballCanvas(b, 92, { big: true }); UI.addLive(cv, b, { size: 92 });
  c.append(h('div', { class: 'top' }, cv, h('div', {}, h('div', { class: 'cls' }, b.godClass), h('div', { class: 'nm' }, b.name.replace(/ Ball$/, '').toUpperCase()),
    owned ? h('span', { class: 'gshop-owned' }, '✔ OWNED — PERMANENT') : h('div', { class: 'gshop-price' }, 'PHP ' + b.pricePhp, ' ', h('small', {}, 'one-time • yours forever')))));
  const icons = h('div', { class: 'god-icons' }); b.skills.forEach(s => icons.append(h('span', { title: s.name, style: { color: s.color, background: rgba(s.color, 0.18) } }, SKILL_TYPES[s.type]?.ico || '•')));
  icons.append(h('span', { title: 'Ultimate: ' + b.ult.name, style: { color: '#ffd54f', background: '#ffd54f2e' } }, '★'), h('span', { title: 'Final-form ultimate: ' + b.finalUlt.name, style: { color: '#fff', background: '#ffffff22' } }, '✦'));
  const forms = h('div', { class: 'god-forms' }); b.forms.forEach((fm, k) => forms.append(h('figure', {}, ballCanvas(formDef(b, k), 50), h('figcaption', {}, fm.name))));
  c.append(h('small', { class: 'muted' }, b.desc), icons, h('small', { class: 'muted' }, '◆ ' + b.passiveInfo.name + ' • all 3 forms unlocked from the start'), forms);
  const row = h('div', { class: 'gshop-row' });
  if (!owned && !o.noBuy) row.append(h('button', { class: 'btn gold', disabled: !(shop && shop.enabled), onclick: () => godBuy(b.id) }, `💎 Buy — PHP ${b.pricePhp}`));
  row.append(h('button', { class: 'btn', onclick: () => UI.openGod(b.id) }, '🔍 Inspect'), owned ? h('button', { class: 'btn primary', onclick: () => { Game.setup.ball = b.id; UI.show('play'); } }, '⚔ Battle') : h('button', { class: 'btn', onclick: () => Game.tryGod(b.id, 2) }, '▶ Free practice test'));
  c.append(row); return c;
}
async function godBuy(product) {
  if (!shopOnline()) return toast('Purchases need the online game server', 'bad');
  if (!Online.active) { toast('Sign in first — your purchase is saved to your account', 'bad'); return UI.show('account'); }
  try { const r = await shopApi('POST', '/api/godshop/checkout', { product }); toast('Opening the secure PayMongo checkout…'); location.assign(r.url); }
  catch (e) { toast('⚠ ' + esc(e.message), 'bad'); }
}
UI.render_godshop = async function () {
  const body = $('#godShopBody'); if (!body) return; body.innerHTML = '';
  const gods = SUP.paidGodIds.map(id => getBall(id)).filter(Boolean);
  let shop = null; if (shopOnline()) { try { shop = await shopApi('GET', '/api/godshop'); } catch { shop = null; } }
  body.append(h('div', { class: 'card' }, h('h3', { style: { margin: '0 0 4px' } }, 'Supreme Premium God Balls'), h('p', { class: 'muted', style: { margin: 0 } }, 'One-time purchase in Philippine pesos. The ball is saved to your account permanently, on every device. Payments are handled by PayMongo — the game never sees your card, wallet login, PIN or OTP.')));
  if (!shopOnline()) body.append(h('div', { class: 'gshop-note' }, 'Purchases need the online game. Open the game from its website and sign in to buy.'));
  else if (!shop || !shop.enabled) body.append(h('div', { class: 'gshop-note' }, '⏳ The shop is not open yet: the owner is still setting up payments. Nothing can be charged until then. You can already inspect both balls and try them for free in Practice.'));
  else if (!Online.active) body.append(h('div', { class: 'gshop-note' }, 'Sign in to buy — your purchase is linked to your account. ', h('button', { class: 'btn small', onclick: () => UI.show('account') }, 'Sign in')));
  if (shop && shop.enabled) body.append(h('div', { class: 'gshop-methods' }, h('small', { class: 'muted', style: { alignSelf: 'center' } }, 'Pay with:'), ...shop.methods.map(m => h('span', {}, m.name)), shop.mode === 'test' ? h('span', { style: { borderColor: '#ff9100', color: '#ffcc80' } }, 'TEST MODE — no real money') : null));
  const grid = h('div', { class: 'gshop-grid' }); gods.forEach(b => grid.append(paidGodCard(b, shop)));
  const bundleOwned = gods.every(b => canUseBall(b)), anyOwned = gods.some(b => canUseBall(b));
  const bc = h('div', { class: 'gshop-card bundle' }, h('div', { class: 'cls' }, 'BUNDLE'), h('div', { class: 'nm' }, 'GOD OF GUNS + GOD PORTAL'), h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center' } }, ...gods.map(b => { const cv = ballCanvas(b, 80, { big: true }); UI.addLive(cv, b, { size: 80 }); return cv; })),
    bundleOwned ? h('span', { class: 'gshop-owned' }, '✔ YOU OWN BOTH') : h('div', { class: 'gshop-price' }, 'PHP ' + BUNDLE_PRICE_PHP, ' ', h('small', {}, 'both balls • one-time')),
    anyOwned && !bundleOwned ? h('small', { class: 'muted' }, 'You already own one of them — buy the other one on its own.') : null,
    !anyOwned ? h('button', { class: 'btn gold', disabled: !(shop && shop.enabled), onclick: () => godBuy('god_bundle') }, `💎 Buy both — PHP ${BUNDLE_PRICE_PHP}`) : null);
  grid.append(bc); body.append(grid);
  if (shopOnline() && Online.active) body.append(h('div', { class: 'gshop-row', style: { marginTop: '12px' } },
    h('button', { class: 'btn', onclick: async () => { try { const r = await shopApi('POST', '/api/godshop/restore'); await Online.refresh(); toast(r.restored ? `✔ Restored ${r.restored} purchase(s)` : '✔ Your purchases are up to date', 'gold'); this.render_godshop(); } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); } } }, '↺ Restore purchases'),
    h('button', { class: 'btn', onclick: () => godHistory() }, '🧾 Transaction history')));
};
async function godHistory() {
  let r; try { r = await shopApi('GET', '/api/godshop/purchases'); } catch (e) { return toast('⚠ ' + esc(e.message), 'bad'); }
  const lbl = { paid: '✔ Paid', pending: '⏳ Waiting for payment', expired: 'Expired (not paid)', failed: 'Not started', review: '⚠ Under review' };
  const t = h('table', { class: 'gshop-tbl' }, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Item'), h('th', {}, 'Amount'), h('th', {}, 'Status'), h('th', {}, 'Method')));
  for (const p of r.purchases) t.append(h('tr', {}, h('td', {}, new Date(p.createdAt).toLocaleString()), h('td', {}, p.name), h('td', {}, `PHP ${p.amount}`), h('td', {}, lbl[p.status] || p.status), h('td', {}, p.method || '—')));
  UI.modal(h('div', {}, h('h2', {}, '🧾 Transaction history'), r.purchases.length ? h('div', { style: { overflowX: 'auto' } }, t) : h('p', { class: 'muted' }, 'No purchases yet.'), h('p', { class: 'muted', style: { fontSize: '12px' } }, 'Purchase ids are kept for support. Contact the game owner with the date if something looks wrong.')));
}
/* back from the PayMongo checkout page: ask the SERVER whether the payment went through */
async function godShopReturn() {
  const q = new URLSearchParams(location.search), id = q.get('purchase'); if (!id || godShopReturn.done) return; godShopReturn.done = true;
  history.replaceState(null, '', location.pathname);
  if (q.get('cancelled')) { toast('Payment cancelled — you were not charged.'); return UI.show('godshop'); }
  if (!shopOnline() || !Online.active) return;
  const box = UI.modal(h('div', { style: { textAlign: 'center' } }, h('h2', {}, '💎 Confirming your payment…'), h('p', { class: 'muted', id: 'gsWait' }, 'Checking with PayMongo. This usually takes a few seconds.')));
  UI.modalLocked = true;
  for (let i = 0; i < 20; i++) {
    let r = null; try { r = await API.post(`/api/godshop/purchases/${encodeURIComponent(id)}/check`, {}); } catch { /* try again */ }
    if (r && r.purchase.status === 'paid') { await Online.refresh(); UI.closeModal(); Sound.play('evolve'); UI.modal(h('div', { style: { textAlign: 'center' } }, h('h2', {}, '✔ Payment confirmed!'), h('p', {}, `${r.purchase.name} is now yours forever.`), h('button', { class: 'btn gold big', onclick: () => { UI.closeModal(); UI.show('godshop'); } }, 'Open the God Shop'))); return; }
    if (r && ['expired', 'failed', 'review'].includes(r.purchase.status)) break;
    await new Promise(res => setTimeout(res, 3000));
  }
  UI.closeModal(); toast('Your payment is not confirmed yet. If you paid, it will unlock automatically as soon as PayMongo confirms — or tap "Restore purchases" later.'); UI.show('godshop');
}
if (!window.NBB_HEADLESS) { let n = 0; const iv = setInterval(() => { n++; if (window.Online && (Online.active || (Online.available && n > 6) || n > 40)) { clearInterval(iv); godShopReturn(); } }, 500); }

/* paid God Balls in the Collection, the God preview, the selection row and the free practice test */
{
  const gs = UI.godSection, og = UI.openGod, tg = Game.tryGod, rf = UI.renderFeatured;
  UI.godSection = function (container) {
    gs.call(this, container);
    const gods = SUP.paidGodIds.map(id => getBall(id)).filter(b => b && b.enabled !== false); if (!gods.length) return;
    const row = h('div', { class: 'gshop-grid' }); gods.forEach(b => row.append(paidGodCard(b, null, { noBuy: true })));
    container.append(h('div', { class: 'god-sec', style: { borderColor: 'rgba(234,128,252,.6)' } }, h('div', { class: 'god-title' }, '💎 PREMIUM GOD BALLS', h('span', { class: 'god-free', style: { background: '#ffd54f' } }, 'PHP 99 EACH'), h('button', { class: 'btn gold small', onclick: () => this.show('godshop') }, 'Open the shop')), row));
  };
  UI.openGod = function (id, form, variant) {
    og.call(this, id, form, variant); const b = getBall(id); if (!b || !b.paid) return;
    const L = document.querySelector('.god-modal .gl'); if (!L) return;
    const free = L.querySelector('.god-free'); if (free) { free.textContent = canUseBall(b) ? '✔ OWNED — PERMANENT' : `💎 PREMIUM — PHP ${b.pricePhp} (one-time)`; free.style.background = canUseBall(b) ? '#00c853' : '#ffd54f'; }
    if (!canUseBall(b)) L.append(h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn gold', onclick: () => { this.closeModal(); this.show('godshop'); } }, `💎 Get it in the Premium God Shop — PHP ${b.pricePhp}`)));
  };
  Game.tryGod = function (id, form = 0) {
    const b = getBall(id); if (!b || !b.godBall) return;
    if (!b.paid || canUseBall(b)) return tg.call(this, id, form);
    Object.assign(this.setup, { ball: id, enemy: 'random', dummy: true, infinite: true, trial: true, godTest: true, startForm: clamp(form | 0, 0, 2) });   // free try-before-you-buy (practice, no rewards)
    Promise.resolve(this.start('practice')).finally(() => { this.setup.godTest = false; this.setup.startForm = 0; this.setup.dummy = false; this.setup.trial = false; });
  };
  UI.renderFeatured = function (grid) {
    rf.call(this, grid);
    let box = document.getElementById('selectPaidGods');
    if (!box) { box = h('div', { id: 'selectPaidGods', class: 'featured' }); grid.parentNode.insertBefore(box, document.getElementById('selectGods') || grid); }
    box.innerHTML = '';
    const row = h('div', { class: 'feat-row' });
    for (const b of SUP.paidGodIds.map(id => getBall(id)).filter(Boolean)) { const ok = canUseBall(b), cv = ballCanvas(b, 60); this.addLive(cv, b, { size: 60 });
      row.append(h('button', { class: 'feat-card' + (Game.setup.ball === b.id ? ' selected' : '') + (ok ? '' : ' locked'), onclick: () => { if (ok) { Game.setup.ball = b.id; Sound.play('click'); this.render_select(); } else this.show('godshop'); } },
        cv, h('div', { class: 'feat-txt' }, h('small', {}, 'SUPREME PREMIUM GOD'), h('b', {}, b.name.replace(/ Ball$/, '').toUpperCase()), h('span', { class: 'feat-st ' + (ok ? 'on' : 'off') }, ok ? 'OWNED' : `💎 PHP ${b.pricePhp}`)))); }
    box.append(h('div', { class: 'feat-title' }, '💎 NEW 2.3.0 — PREMIUM GOD BALLS'), row);
  };
}

/* ---------------- owner: payment setup & transactions (Admin Dashboard tab) ---------------- */
UI.admin_shopph = async function (body) {
  const s = await API.get('/api/admin/godshop'); body.innerHTML = '';
  const ok = s.enabled;
  body.append(h('div', { class: 'card' }, h('h3', {}, '💳 Premium God Shop — PayMongo setup'),
    h('p', {}, ok ? h('b', { style: { color: '#69f0ae' } }, `✔ The shop is OPEN (${s.mode === 'live' ? 'LIVE — real payments' : 'TEST mode — no real money'})`) : h('b', { style: { color: '#ffab40' } }, '⏳ The shop is closed until everything below is done. Nothing can be charged.')),
    s.problems.length ? h('ul', {}, ...s.problems.map(p => h('li', {}, p))) : null,
    h('table', { class: 'gshop-tbl' },
      h('tr', {}, h('td', {}, 'Secret key'), h('td', {}, s.key || 'not set (PAYMONGO_SECRET_KEY)')), h('tr', {}, h('td', {}, 'Mode'), h('td', {}, s.mode || '—')),
      h('tr', {}, h('td', {}, 'Webhook secret'), h('td', {}, s.webhookSecret || 'not set')), h('tr', {}, h('td', {}, 'Webhook address'), h('td', {}, h('code', { style: { wordBreak: 'break-all' } }, s.webhookUrl))),
      h('tr', {}, h('td', {}, 'Event'), h('td', {}, s.events.join(', '))), h('tr', {}, h('td', {}, 'Live confirmed'), h('td', {}, s.liveConfirmed ? 'yes' : 'no (PAYMONGO_LIVE_CONFIRMED)'))),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
      h('button', { class: 'btn', onclick: () => adminDo(() => API.post('/api/admin/godshop/test'), r => UI.modal(h('div', {}, h('h3', {}, '✔ PayMongo key works (' + r.mode + ')'), h('p', {}, 'Webhooks on this account:'), h('ul', {}, ...(r.webhooks.length ? r.webhooks.map(w => h('li', {}, `${w.url} — ${w.status} — ${(w.events || []).join(', ')}`)) : [h('li', {}, 'none yet')]))))) }, '🔌 Test connection'),
      h('button', { class: 'btn gold', onclick: () => adminDo(() => API.post('/api/admin/godshop/register-webhook'), () => this.render_admin()) }, '🔗 Register webhook automatically'))));
  const sel = new Set(s.methods), boxes = h('div', { class: 'gshop-methods' });
  for (const m of s.allMethods) boxes.append(h('label', {}, h('input', { type: 'checkbox', checked: sel.has(m.id), onchange: e => { e.target.checked ? sel.add(m.id) : sel.delete(m.id); } }), ' ' + m.name));
  body.append(h('div', { class: 'card' }, h('h3', {}, 'Payment methods shown at checkout'), h('p', { class: 'muted' }, 'Tick only the methods that are ACTIVATED on your PayMongo account (Settings → Payment Methods). QR Ph works with most bank apps and e-wallets.'), boxes,
    h('button', { class: 'btn', style: { marginTop: '8px' }, onclick: () => adminDo(() => API.post('/api/admin/godshop/methods', { methods: [...sel] }), () => this.render_admin()) }, '💾 Save methods')));
  body.append(h('div', { class: 'card' }, h('h3', {}, `Sales — ${s.totals.paid} paid • PHP ${s.totals.revenue.toFixed(2)}`),
    s.purchases.length ? h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'gshop-tbl' }, h('tr', {}, ...['Date', 'Player', 'Item', 'PHP', 'Status', 'Method', 'Checkout', 'Note'].map(x => h('th', {}, x))),
      ...s.purchases.map(p => h('tr', {}, h('td', {}, new Date(p.createdAt).toLocaleString()), h('td', {}, p.username), h('td', {}, p.name), h('td', {}, p.amount), h('td', {}, p.status), h('td', {}, p.method || '—'), h('td', {}, p.ref || '—'), h('td', {}, p.note || ''))))) : h('p', { class: 'muted' }, 'No purchases yet.')));
  body.append(h('div', { class: 'card' }, h('h3', {}, 'How to open the shop'), h('ol', {},
    h('li', {}, 'Create a PayMongo account and finish business verification (needed for live payments).'),
    h('li', {}, 'Put your SECRET key on the game server as PAYMONGO_SECRET_KEY (start with the sk_test_ key). Never put it in the game files.'),
    h('li', {}, 'Restart the server, open this tab and press "Register webhook automatically" (APP_ORIGIN must be your https address).'),
    h('li', {}, 'Tick the payment methods that are active on your PayMongo account, then test a purchase in TEST mode.'),
    h('li', {}, 'For real money: switch to the sk_live_ key, set PAYMONGO_LIVE_CONFIRMED=true, restart and register the webhook again.'))));
};

if (window.NBB_CORE) Object.assign(window.NBB_CORE, { paidGodIds: () => SUP.paidGodIds.slice(), PAID_PRICE_PHP, BUNDLE_PRICE_PHP });
invalidateRegistry();
