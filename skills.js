/* =====================================================================
   NEON BALL BATTLE 2.6.0 — ULTIMATE UNIQUE SKILL, MASTERY & EVOLUTION SYSTEM

   Loaded after gods3.js in the browser AND on the game server, so every battle stays deterministic and verifiable.
   Battle logic only uses the seeded RNG (RNG / rand / dcos / dsin…); Math.random and vr() are for visuals only.

   • Unique Skill Registry: every ability of every ball has a uid, a category, a fingerprint of its real mechanics,
     an unlock level, its own cast animation, sound motif and (for the classic abilities) a signature mechanic.
   • Skill slots by rarity (the ultimate included). Balls that already had more keep every ability they had.
   • New abilities unlock gradually with the ball's own level (and, for the rarest balls, its wins).
   • Mastery (looks only, from verified battles), evolutions (new mechanics, server-verified), designed combinations.
   • Balance rules: global cast pacing, kit-size power scaling, crowd-control and invulnerability limits.
   ===================================================================== */
const SKILLS_VERSION = '2.6.0';
/** maximum skill slots per rarity — the ultimate counts as one of them */
const SLOT_CAP = { Common: 2, Uncommon: 3, Rare: 4, Epic: 5, Legendary: 6, Mythical: 7, Ancient: 8, Secret: 8, Limited: 9, 'God Tier': 10 };
const SK_CATS = {
  offense: { name: 'Offensive', ico: '⚔', col: '#ff5252' }, defense: { name: 'Defensive', ico: '⛨', col: '#40c4ff' },
  counter: { name: 'Counterattack', ico: '⟲', col: '#ffd740' }, mobility: { name: 'Mobility', ico: '➤', col: '#69f0ae' },
  summon: { name: 'Summoning', ico: '⚇', col: '#b388ff' }, arena: { name: 'Arena Manipulation', ico: '▦', col: '#ff9100' },
  trap: { name: 'Trap', ico: '⌗', col: '#f06292' }, environment: { name: 'Environmental Control', ico: '☁', col: '#4dd0e1' },
  transform: { name: 'Transformation', ico: '✦', col: '#ffab40' }, passive: { name: 'Passive', ico: '◆', col: '#90a4ae' },
  autonomous: { name: 'Autonomous AI', ico: '🧠', col: '#e040fb' }, ultimate: { name: 'Ultimate', ico: '★', col: '#ffd54f' },
};
/** per-skill rarity (shown in the skill details): how far along the ball's progression it comes */
const SK_TIERS = [{ id: 'Common', lv: 1 }, { id: 'Rare', lv: 5 }, { id: 'Epic', lv: 15 }, { id: 'Legendary', lv: 30 }, { id: 'Mythical', lv: 45 }];
const MASTERY = [
  { id: 'beginner', name: 'Beginner', xp: 0, col: '#b0bec5' }, { id: 'skilled', name: 'Skilled', xp: 120, col: '#69f0ae' },
  { id: 'expert', name: 'Expert', xp: 450, col: '#40c4ff' }, { id: 'master', name: 'Master', xp: 1200, col: '#e040fb' },
  { id: 'grandmaster', name: 'Grandmaster', xp: 3000, col: '#ffd740' },
];
const MASTERY_REWARDS = ['—', 'Brighter cast effect', 'Mastery sigil animation on cast', 'Master aura colour and name banner', 'GRANDMASTER flourish, golden trail and the skill title'];
/** mastery XP from ONE verified battle: per use, capped (no farming), a bonus for a win; training / practice give none */
const MASTERY_XP = { perUse: 6, cap: 48, win: 10 };
const masteryXpOf = () => { const m = typeof skillsCfg === 'function' ? skillsCfg().mastery : null; return Array.isArray(m) && m.length === 5 ? m : MASTERY.map(x => x.xp); };      // the owner can change the XP per rank
const masteryRank = xp => { const T = masteryXpOf(); let i = 0; while (i + 1 < T.length && (xp | 0) >= T[i + 1]) i++; return i; };
/** evolution requirements by stage (ball level, mastery rank, coins); God of Absolute (Lv 50–100) uses its own levels */
const EVO_REQ = [{ lv: 15, rank: 1, coins: 1500 }, { lv: 30, rank: 2, coins: 4000 }, { lv: 45, rank: 3, coins: 9000 }];
const EVO_REQ_HIGH = [{ lv: 60, rank: 1, coins: 2500 }, { lv: 80, rank: 2, coins: 6000 }, { lv: 95, rank: 3, coins: 12000 }];
const SK_GCD = 0.45;            // global cast pacing (players and AI): no ability spam

/* ---------------- classic ability types: what they really do (for the duplicate audit) ---------------- */
const TYPE_META = {
  projectile: { m: ['projectile', 'single'], tg: 'aim', ac: 'instant', an: 'orb', cat: 'offense' },
  multishot: { m: ['projectile', 'spread'], tg: 'aim', ac: 'instant', an: 'orbfan', cat: 'offense' },
  homing: { m: ['projectile', 'homing'], tg: 'homing', ac: 'instant', an: 'seeker', cat: 'offense' },
  beam: { m: ['beam', 'line'], tg: 'aim', ac: 'charge', an: 'beam', cat: 'offense' },
  shockwave: { m: ['wave', 'radial', 'knockback'], tg: 'self', ac: 'instant', an: 'ring', cat: 'offense' },
  explosion: { m: ['burst', 'radial'], tg: 'self', ac: 'instant', an: 'blast', cat: 'offense' },
  dash: { m: ['ram', 'movement'], tg: 'aim', ac: 'instant', an: 'dash', cat: 'mobility' },
  shield: { m: ['damage-reduction', 'self-buff'], tg: 'self', ac: 'instant', an: 'barrier', cat: 'defense' },
  heal: { m: ['heal', 'cleanse'], tg: 'self', ac: 'instant', an: 'heal', cat: 'defense' },
  trap: { m: ['zone', 'ground', 'damage-over-time'], tg: 'area', ac: 'delay', an: 'zone', cat: 'trap' },
  gravity: { m: ['pull', 'zone'], tg: 'self', ac: 'channel', an: 'vortex', cat: 'environment' },
  lightning: { m: ['strike', 'delayed'], tg: 'area', ac: 'delay', an: 'bolt', cat: 'offense' },
  meteor: { m: ['strike', 'multi', 'delayed'], tg: 'area', ac: 'delay', an: 'meteor', cat: 'offense' },
  clone: { m: ['summon', 'copy-self'], tg: 'self', ac: 'instant', an: 'clone', cat: 'summon' },
  orbitals: { m: ['orbit', 'contact'], tg: 'self', ac: 'instant', an: 'orbit', cat: 'offense' },
  timestop: { m: ['freeze-all', 'control'], tg: 'global', ac: 'instant', an: 'clock', cat: 'arena' },
  teleport: { m: ['blink', 'behind', 'strike'], tg: 'target', ac: 'instant', an: 'blink', cat: 'mobility' },
  buff: { m: ['self-buff', 'attack', 'speed'], tg: 'self', ac: 'instant', an: 'powerup', cat: 'transform' },
  copy: { m: ['copy-enemy'], tg: 'target', ac: 'instant', an: 'copy', cat: 'counter' },
  adaptive: { m: ['analyse', 'resist', 'self-buff'], tg: 'target', ac: 'instant', an: 'adapt', cat: 'transform' },
  resurrect: { m: ['revive', 'once'], tg: 'self', ac: 'conditional', an: 'rebirth', cat: 'defense' },
  phase: { m: ['intangible', 'decoy'], tg: 'self', ac: 'instant', an: 'phase', cat: 'defense' },
  reflect: { m: ['reflect', 'projectiles'], tg: 'self', ac: 'instant', an: 'mirror', cat: 'counter' },
};
const ROLE_CAT = { ranged: 'offense', aoe: 'offense', melee: 'offense', control: 'environment', summon: 'summon', defense: 'defense', heal: 'defense', mobility: 'mobility', buff: 'transform', curse: 'trap' };
const TECH_CAT = { portalgate: 'mobility', dimescape: 'mobility', summon: 'summon', clonearmy: 'summon', nullzone: 'arena', absorb: 'counter', reverse: 'counter', minihole: 'environment', voidtp: 'mobility', antievo: 'counter',
  robots: 'summon', factory: 'summon', missiles: 'offense', drone: 'defense', fusionbot: 'summon', lasergrid: 'trap', hologram: 'summon', emp: 'counter', cybertrap: 'trap', turret: 'summon', overclock: 'transform' };
const ULT_META = {
  nova: ['nova', 'radial'], supernova: ['nova', 'charged'], barrage: ['projectile', 'spiral', 'homing'], megabeam: ['beam', 'sustained'], blackhole: ['pull', 'vortex'],
  meteorstorm: ['strike', 'multi'], storm: ['strike', 'chain'], judgment: ['pillar', 'strike'], timestop: ['freeze-all'], swarm: ['summon', 'clones'],
};
function catOf(s) { return s.cat || (TYPE_META[s.type] && TYPE_META[s.type].cat) || TECH_CAT[s.type] || ROLE_CAT[SUP.roles[s.type]] || 'offense'; }
function tierOf(lv) { let t = SK_TIERS[0].id; for (const x of SK_TIERS) if (lv >= x.lv) t = x.id; return t; }

/* ---------------- 2.6.0 content tables (filled by the next sections) ---------------- */
const NEW26 = {};       // ball id → [new unique skills]
const SIG = {};         // classic skill uid → { t: twist, a: params, n: signature name, d: description, type: expected type }
const ULT_SIG = {};     // ball id → { t, a, n, d } (unique ultimate mechanics on top of the classic ultimate types)
const EVO26 = {};       // skill uid → [stages { n, t, a, d, look }]
const TW = {};          // twist library: { dec(entry, kind, a, owner), post(f, sk, a, P, tgt), meta: [tokens] }
const CAST26 = [];      // (f, sk, uid) after every successful ability cast
const MOD26 = [];       // (f, s, m) per step: stat modifiers from 2.6.0 states → m.atk / m.def / m.spd / m.cd (cooldown time) / m.taken
/** adds a new unique skill to a ball: def = { uid, name, type, cd, power, color, effect, cat, desc, m, tg, ac, an, unlock, wins, fn, role, ico, self } */
function NS(ball, d) {
  if (d.fn) SK(d.type, d.role || 'ranged', d.ico || '✦', d.name, d.desc, d.fn, !!d.self);
  if (d.score) SUP.scoreFn[d.type] = d.score;
  (NEW26[ball] || (NEW26[ball] = [])).push({ name: d.name, type: d.type, cd: d.cd, power: d.power, color: d.color, effect: d.effect || 'none', uid: d.uid || ball + '.' + d.type,
    v26: true, cat: d.cat, desc: d.desc, m: d.m, tg: d.tg, ac: d.ac, an: d.an, unlockLv: d.unlock || null, unlockWins: d.wins || 0, inter: d.inter || null });
}

/* ---------------- unlock levels ---------------- */
const maxLvlFor = b => b.maxLevel || MAX_LVL;
function legacyUnlock(b, i) { return b.adminOnly || b.unlockAll ? 1 : i < 2 ? 1 : i === 2 ? 5 : 12; }
/** spreads a ball's new abilities over its level range (later ones for the rarest balls also need wins with that ball) */
function spreadUnlocks(b, list) {
  const hi = maxLvlFor(b), lo = hi > MAX_LVL ? 55 : 15, top = hi > MAX_LVL ? 96 : 48, n = list.length, rareWins = ['Ancient', 'Secret', 'Limited', 'God Tier'].includes(b.rarity);
  list.forEach((s, k) => {
    if (s.unlockLv == null) s.unlockLv = Math.round(n === 1 ? (lo + top) / 2 : lo + (top - lo) * k / (n - 1));
    if (!s.unlockWins && rareWins && k >= n - 2 && n >= 3) s.unlockWins = k === n - 1 ? 30 : 12;
  });
}
function skUnlocked(s, lv, wins, human) { return lv >= (s.unlockLv || 1) && (!human || !s.unlockWins || (wins | 0) >= s.unlockWins); }
function unlockText(s) {
  if (!s.v26) return s.unlockLv <= 1 ? 'Unlocked from the start' : `Skill tree: “Unlock ${s.slot === 2 ? '3rd' : '4th'} Ability” (Lv ${s.unlockLv})`;
  return `Ball Lv ${s.unlockLv}` + (s.unlockWins ? ` and ${s.unlockWins} wins with this ball` : '');
}

/* ---------------- the registry: every ball's abilities with their identity ---------------- */
function skillsCfg() { const C = typeof catalogData === 'function' ? catalogData() : null; return (C && C.skills26) || {}; }
function decorateBall(b, cfg) {
  if (b.summonOnly && !b.trainingTarget) return;
  const ov = cfg.overrides || {}, legacy = (b.skills || []).filter(s => !s.v26);
  const L = legacy.map((s, i) => {
    const uid = s.uid || b.id + '.' + i, sg = SIG[uid] && (!SIG[uid].type || SIG[uid].type === s.type) ? SIG[uid] : null;
    return { ...s, uid, slot: i, legacy: true, cat: catOf(s), unlockLv: legacyUnlock(b, i), sig: sg ? sg.n : null, sigDesc: sg ? sg.d : null };
  });
  let N = (b.custom || b.fusion) ? [] : (NEW26[b.id] || []).map(s => ({ ...s }));
  // owner-made skills assigned to this ball (Admin Skill Management)
  for (const c of cfg.custom || []) if (c.ball === b.id && c.type && SKILL_FN[c.type]) N.push({ name: String(c.name || 'Custom Skill').slice(0, 32), type: c.type, cd: clamp(+c.cd || 6, 1, 60), power: clamp(+c.power || 50, 5, 200),
    color: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : b.design.c3, effect: EFFECTS.includes(c.effect) ? c.effect : 'none', uid: String(c.uid), v26: true, custom26: true, cat: SK_CATS[c.cat] ? c.cat : catOf(c),
    desc: String(c.desc || '').slice(0, 200), twist26: c.twist && TW[c.twist] && !TW[c.twist].ult ? c.twist : null, m: (TYPE_META[c.type] || {}).m, tg: (TYPE_META[c.type] || {}).tg, ac: (TYPE_META[c.type] || {}).ac, an: (TYPE_META[c.type] || {}).an, unlockLv: c.unlockLv ? clamp(+c.unlockLv, 1, 100) : null, count: c.count ? clamp(c.count | 0, 1, 9) : undefined });
  spreadUnlocks(b, N.filter(s => !s.custom26));
  for (const s of N) if (s.unlockLv == null) s.unlockLv = Math.min(maxLvlFor(b), 20);
  const all = [...L, ...N];
  for (const s of all) {          // owner edits (validated on the server): cooldown, power, unlock level, on/off, name, description
    const o = ov[s.uid]; if (!o) continue;
    if (o.cd != null) s.cd = clamp(+o.cd, 0.5, 60);
    if (o.power != null) s.power = clamp(+o.power, 5, 250);
    if (o.unlockLv != null && s.v26) s.unlockLv = clamp(o.unlockLv | 0, 1, maxLvlFor(b));
    if (o.unlockWins != null && s.v26) s.unlockWins = clamp(o.unlockWins | 0, 0, 500);
    if (o.name) s.name = String(o.name).slice(0, 32);
    if (o.desc) s.desc = String(o.desc).slice(0, 200);
    if (o.off) s.off26 = true;
  }
  b.skills = all.map(s => s.off26 ? { ...s, disabled: true } : s);          // switched off by the owner: kept in place (stable ability buttons), never usable
  if (b.ult) { const uo = ov[b.id + '.ult'] || {}; b.ult = { ...b.ult, uid: b.id + '.ult', sig: ULT_SIG[b.id] ? ULT_SIG[b.id].n : null, sigDesc: ULT_SIG[b.id] ? ULT_SIG[b.id].d : null, ...(uo.power != null ? { power: clamp(+uo.power, 20, 300) } : {}) }; }
  b.slotCap = b.adminOnly ? b.skills.length + 1 : Math.max(SLOT_CAP[b.rarity] || 4, L.length + 1);
  b.slotsUsed = b.skills.filter(s => !s.disabled).length + (b.ult ? 1 : 0);
  b.sk26 = true;
}
const _registry26 = registry;
registry = function () {
  const R = _registry26();
  if (!R.sk26) { const cfg = skillsCfg(); for (const b of R.list) decorateBall(b, cfg); R.sk26 = true; }
  return R;
};

/** the Unique Skill Registry: one record per ability (and ultimate) of every collectible ball */
function skillRegistry(opts = {}) {
  const out = [];
  for (const b of allBalls()) {
    if (b.summonOnly || b.unit || (b.fusion && !opts.fusion) || (b.draft && !opts.drafts)) continue;
    for (const s of b.skills || []) out.push(skRecord(b, s));
    if (b.ult) out.push(skRecord(b, { ...b.ult, isUlt: true }));
  }
  return out;
}
function skRecord(b, s) {
  const tm = TYPE_META[s.type], twist = s.isUlt ? ULT_SIG[b.id] : (s.legacy && SIG[s.uid]) || (s.twist26 ? { t: s.twist26, n: s.twist26, d: TW[s.twist26].desc ? TW[s.twist26].desc({}) : '' } : null);
  const evo = !s.isUlt && EVO26[s.uid] ? EVO26[s.uid].map(e => e.n) : [];
  let m, tg, ac, an;
  if (s.isUlt) { m = [...(ULT_META[s.type] || ['custom-ult:' + s.type]), 'ultimate']; tg = 'global'; ac = 'charge'; an = 'ult:' + s.type; }
  else if (s.v26 && s.m && !s.custom26) { m = s.m.slice(); tg = s.tg || 'aim'; ac = s.ac || 'instant'; an = s.an || s.type; }
  else if (tm) { m = tm.m.slice(); tg = tm.tg; ac = tm.ac; an = tm.an; }
  else { m = ['custom:' + s.type, 'role:' + (SUP.roles[s.type] || 'special')]; tg = 'aim'; ac = 'instant'; an = s.type; }
  if (twist) { m.push('twist:' + twist.t); for (const k of (TW[twist.t] && TW[twist.t].meta) || []) m.push(k); an += '+' + twist.t; }
  const fx = [s.effect && s.effect !== 'none' ? s.effect : null, ...((twist && TW[twist.t] && TW[twist.t].fx) || [])].filter(Boolean);
  return { uid: s.uid, ball: b.id, ballName: b.name, rarity: b.rarity, name: s.name, type: s.type, cat: s.isUlt ? 'ultimate' : catOf(s), isUlt: !!s.isUlt, legacy: !!s.legacy, v26: !!s.v26, custom: !!s.custom26,
    cd: s.cd || null, power: s.power, effect: s.effect || 'none', unlockLv: s.isUlt ? 1 : s.unlockLv || 1, unlockWins: s.unlockWins || 0, tier: s.isUlt ? 'Ultimate' : tierOf(s.unlockLv || 1),
    sig: twist ? twist.n : null, sigDesc: twist ? twist.d : null, desc: s.desc || (tm ? SKILL_TYPES[s.type].desc : (SKILL_TYPES[s.type] || {}).desc) || (ULT_TYPES[s.type] || ''), evo, disabled: !!s.disabled,
    fp: { m: [...new Set(m)], tg, ac, fx, an, name: s.name } };
}

/* ---------------- DUPLICATE DETECTION (mechanics, targeting, activation, effects, animation and name — never the name alone) ---------------- */
const jac = (a, b) => { const A = new Set(a), Bs = new Set(b); if (!A.size && !Bs.size) return 1; let i = 0; for (const x of A) if (Bs.has(x)) i++; return i / (A.size + Bs.size - i); };
const nameToks = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['the', 'ball', 'of', 'and'].includes(w));
function skSimilarity(a, b) {
  const A = a.fp || a, Bf = b.fp || b;
  const parts = { mechanics: jac(A.m, Bf.m), targeting: A.tg === Bf.tg ? 1 : 0, activation: A.ac === Bf.ac ? 1 : 0, effects: jac(A.fx, Bf.fx), animation: A.an === Bf.an ? 1 : 0, name: jac(nameToks(A.name), nameToks(Bf.name)) };
  const score = parts.mechanics * 0.42 + parts.targeting * 0.14 + parts.activation * 0.1 + parts.effects * 0.12 + parts.animation * 0.12 + parts.name * 0.1;
  return { score: Math.round(score * 1000) / 1000, parts };
}
const DUP = { BLOCK: 0.86, WARN: 0.72 };
/** all pairs above the warning level (never compares a fusion with its parents) */
function skAudit(list = skillRegistry(), warn = DUP.WARN) {
  const out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; if (a.isUlt !== b.isUlt) continue;
    const s = skSimilarity(a, b); if (s.score >= warn) out.push({ a: a.uid, b: b.uid, an: a.name, bn: b.name, score: s.score, parts: s.parts, level: s.score >= DUP.BLOCK ? 'duplicate' : 'similar' });
  }
  return out.sort((x, y) => y.score - x.score);
}
/** checks one proposed skill against the whole registry (Admin Skill Management) */
function skCheckProposal(p, list = skillRegistry()) {
  const tm = TYPE_META[p.type] || {}, tw = p.twist && TW[p.twist];
  const fp = { m: [...(tm.m || ['custom:' + p.type]), ...(tw ? ['twist:' + p.twist, ...(tw.meta || [])] : [])], tg: tm.tg || 'aim', ac: tm.ac || 'instant', fx: [p.effect && p.effect !== 'none' ? p.effect : null].filter(Boolean), an: (tm.an || p.type) + (tw ? '+' + p.twist : ''), name: p.name };
  // compared with every ability AND with its basic mechanic (without its signature): copying an ability's base and renaming it is never unique
  const baseFp = r => { const tm = TYPE_META[r.type]; if (!r.legacy || !tm) return null; return { m: tm.m.slice(), tg: tm.tg, ac: tm.ac, fx: [r.effect && r.effect !== 'none' ? r.effect : null].filter(Boolean), an: tm.an, name: r.name }; };
  return list.filter(r => !r.isUlt && r.uid !== p.uid).map(r => { const a = skSimilarity({ fp }, r), bf = baseFp(r), b = bf ? skSimilarity({ fp }, { fp: bf }) : null; return { uid: r.uid, name: r.name, ball: r.ballName, ...(b && b.score > a.score ? { ...b, base: true } : a) }; })
    .filter(x => x.score >= DUP.WARN).sort((a, b) => b.score - a.score).slice(0, 8);
}

/* ---------------- fighters: unlocks, evolutions, pacing ---------------- */
function skillInit26(f, o) {
  f.skUse = {}; f.skDmg = {}; f.gcd = 0; f.ccT = 0; f.ccImm = 0; f.invT = 0; f.exposeT = 0;
  f.sevo = o.sevo && typeof o.sevo === 'object' ? o.sevo : null; f.mast = o.mast && typeof o.mast === 'object' ? o.mast : null;
  if (!f.skills || !f.skills.length) { f.kitK = 1; return; }
  const B = BATTLE, base = f.baseDef || f.def, test = !!(B && B.cfg && (B.cfg.adminTest || B.cfg.godTest)), all = test || base.adminOnly || o.maxed || o.unlockAll26, human = !!(o.isPlayer || o.pvp);
  for (const s of f.skills) {
    if (!s.v26) continue;
    s.locked = s.disabled ? true : !(all || skUnlocked(s, f.level, o.wins, human));
    if (o.only26 && s.uid === o.only26) s.locked = false;          // skill preview: this one skill only
  }
  const n = f.skills.filter(s => !s.locked).length;
  f.kitK = n > 5 ? Math.pow(5 / n, 0.2) : 1;          // a bigger kit casts more often, so each ability hits a little lighter
}
const _ssp26 = supSkillPower;
supSkillPower = function (f, sk, P) { P = _ssp26(f, sk, P); if (f.kitK && f.kitK !== 1) P *= f.kitK; const st = f.sevo && sk.uid ? f.sevo[sk.uid] | 0 : 0; if (st) P *= 1 + 0.04 * st; return P; };

/* every ability cast: pacing, identity, signature mechanics, evolution mechanics, its own animation and sound */
const _useSkill26 = useSkill;
useSkill = function (f, sk) {
  if (!f || !sk || !BATTLE) return false;
  const nested = CUR_SK != null;
  if (!nested && f.gcd > 0 && !sk.copied) return false;
  const B = BATTLE, L = skLens(B), pk = CUR_SK, uid = sk.uid || ((f.baseDef || f.def).id + '.' + sk.type);
  f.castFrom = { x: f.x, y: f.y }; CUR_SK = uid; let ok;
  try { ok = _useSkill26(f, sk); } finally { CUR_SK = pk; }
  if (!ok) return ok;
  skStamp(B, L, uid);
  if (!nested) f.gcd = SK_GCD;
  if (sk.type === 'dash' || sk.type === 'teleport') { f.dashSk = uid; f.dashSkT = 0.9; }          // its collision damage counts for this ability
  if (f.skUse && !f.isClone) f.skUse[uid] = (f.skUse[uid] || 0) + 1;
  const pv = CUR_SK; CUR_SK = uid;
  try { skPost(f, sk, uid); for (const fn of CAST26) fn(f, sk, uid); } finally { CUR_SK = pv; }
  if (!FX.off && !f.isClone) skCastFx(f, sk, uid);
  return ok;
};
/** the twists (signature + evolution stages) of a skill for this fighter */
function skTwists(f, uid) {
  const out = [], sg = SIG[uid], sk = f && f.skills ? f.skills.find(s => s.uid === uid) : null;
  if (sg && sk && sk.legacy && (!sg.type || sg.type === sk.type)) out.push(sg);
  if (sk && sk.twist26) out.push({ t: sk.twist26, a: {} });          // owner-made abilities: their chosen signature mechanic
  const st = f && f.sevo ? f.sevo[uid] | 0 : 0, ev = EVO26[uid];
  if (st && ev) for (let k = 0; k < Math.min(st, ev.length); k++) out.push(ev[k]);
  return out;
}
/** cached per fighter: the twists that react to hits */
function skTwistsC(f, uid) { const c = f.twc || (f.twc = {}); return c[uid] || (c[uid] = skTwists(f, uid).filter(t => TW[t.t] && TW[t.t].hit)); }
const _skStamp26 = skStamp;
skStamp = function (B, L, k) {
  const A = [B.projs, B.beams, B.waves, B.zones, B.strikes, B.orbs, B.lasers], KIND = ['proj', 'beam', 'wave', 'zone', 'strike', 'orb', 'laser'];
  A.forEach((a, i) => { for (let j = L[i]; j < a.length; j++) { const e = a[j]; if (!e) continue; if (e.sk == null) e.sk = k; if (e.sk === k && !e.tw26) { e.tw26 = true; const o = e.owner && e.owner.credit; if (!o) continue; const pw = CUR_TW; CUR_TW = true; try { for (const t of skTwists(o, k)) { const T = TW[t.t]; if (T && T.dec) T.dec(e, KIND[i], t.a || {}, o); } } finally { CUR_TW = pw; } } } });
};
function skPost(f, sk, uid) {
  const tw = skTwists(f, uid); if (!tw.length) return;
  const tgt = f.target && f.target.alive && !(f.target.st.outside > 0) ? f.target : nearestEnemy(f);
  const P = (sk.power || 50) * (f.powerMul || 1);
  const pw = CUR_TW; CUR_TW = true;
  try { for (const t of tw) { const T = TW[t.t]; if (T && T.post) T.post(f, sk, t.a || {}, P, tgt); } } finally { CUR_TW = pw; }
}

/* ultimates: identity, signature mechanic, cinematic entrance */
const _performUlt26 = performUlt;
performUlt = function (f) {
  const uid = f.ult && f.ult.uid ? f.ult.uid : (f.baseDef || f.def).id + '.ult', B = BATTLE, L = B ? skLens(B) : null, pk = CUR_SK;
  CUR_SK = uid; let r;
  try { r = _performUlt26(f); } finally { CUR_SK = pk; }
  if (!B) return r;
  skStamp(B, L, uid);
  if (f.castFn && !f.castFn.sk26) { const fn = f.castFn; f.castFn = function () { const pv = CUR_SK, L2 = skLens(BATTLE); CUR_SK = uid; try { fn(); } finally { CUR_SK = pv; skStamp(BATTLE, L2, uid); } }; f.castFn.sk26 = true; f.castFn.ult = fn.ult; }
  if (f.skUse && !f.isClone) f.skUse[uid] = (f.skUse[uid] || 0) + 1;
  const us = ULT_SIG[(f.baseDef || f.def).id];
  if (us && TW[us.t] && TW[us.t].ult && !f.isClone && !(f.baseDef && f.baseDef.forms)) { const pv = CUR_SK, pu = CUR_ULT, pw = CUR_TW, L2 = skLens(B); CUR_SK = uid; CUR_ULT = true; CUR_TW = true; try { TW[us.t].ult(f, us.a || {}, f.ult || {}); } finally { CUR_SK = pv; CUR_ULT = pu; CUR_TW = pw; skMark(B, L2, uid); } }
  if (!FX.off && !f.isClone && !(f.baseDef && f.baseDef.forms)) ultEntranceFx(f);
  return r;
};

/* damage credited per skill (training statistics, combinations) */
const _dealDamage26 = dealDamage;
dealDamage = function (src, tgt, amt, o = {}) {
  const sk = (o && o.sk) || CUR_SK || (o && o.kind === 'collision' && src && src.dashSkT > 0 ? src.dashSk : null), got = _dealDamage26(src, tgt, amt, o);
  if (got > 0 && sk) {
    const cr = src && src.credit; if (cr && cr.skDmg) cr.skDmg[sk] = (cr.skDmg[sk] || 0) + got;
    if (cr && cr.team !== tgt.team) { const pw = CUR_TW, pk = CUR_SK; CUR_TW = true; CUR_SK = sk; try { for (const t of skTwistsC(cr, sk)) { const T = TW[t.t]; if (T && T.hit) T.hit(cr, tgt, got, { ...o, sk }, t.a || {}); } if (COMBO_BY[sk]) comboHit(cr, tgt, sk, got, o); } finally { CUR_TW = pw; CUR_SK = pk; } }
  }
  return got;
};

/* balance rules every step: cast pacing, crowd-control limit (no stun loops), invulnerability limit (no permanent immunity) */
SUP.worldHooks.push((B, h) => {
  const scripted = B.cinematic || B.clash;
  for (const f of B.fighters) {
    if (!f.alive) continue;
    if (f.gcd > 0) f.gcd -= h;
    if (f.dashSkT > 0) f.dashSkT -= h;
    const st = f.st, cc = st.stun > 0 || st.freeze > 0 || st.timestop > 0;
    if (f.ccImm > 0) { f.ccImm -= h; if (cc && !scripted) { st.stun = 0; st.freeze = Math.min(st.freeze, 0); st.timestop = 0; } }
    else if (cc && !scripted) { f.ccT = (f.ccT || 0) + h; if (f.ccT > 3.2) { f.ccT = 0; f.ccImm = 2; st.stun = 0; st.freeze = 0; st.timestop = 0; if (!FX.off) { FX.text(f.x, f.y - f.r - 30, 'UNSTOPPABLE', '#ffffff', 16, { life: 0.9 }); FX.ring(f.x, f.y, '#ffffff', f.r * 2.4, 0.4, 5, f.r); } } }
    else if (f.ccT > 0) f.ccT = Math.max(0, f.ccT - h * 0.5);
    const exempt = scripted || f.beyond || st.outside > 0 || f.isClone || f.unit;
    if (f.exposeT > 0) { f.exposeT -= h; if (!exempt && st.invuln > 0) st.invuln = 0; }
    else if (st.invuln > 0 && !exempt) { f.invT = (f.invT || 0) + h; if (f.invT > 4.5) { f.invT = 0; f.exposeT = 2.5; st.invuln = 0; if (!FX.off) FX.text(f.x, f.y - f.r - 30, 'EXPOSED', '#ff8a80', 15, { life: 0.9 }); } }
    else if (f.invT > 0) f.invT = Math.max(0, f.invT - h * 0.35);
  }
});

/* ---------------- looks only: each skill's own cast sigil and sound motif, mastery effects, ultimate entrances ---------------- */
function skLook(uid) { const hh = hashStr(String(uid)); return { pts: 3 + hh % 6, rings: 1 + (hh >> 3) % 3, spin: ((hh >> 5) % 2 ? 1 : -1) * (1.5 + (hh >> 6) % 5 * 0.6), inner: (hh >> 9) % 4, motif: [1, 1 + ((hh >> 11) % 7) / 6, 1 + ((hh >> 14) % 9) / 5], wave: ['sine', 'triangle', 'square', 'sawtooth'][(hh >> 17) % 4], dur: 0.09 + ((hh >> 19) % 5) * 0.03 }; }
function skCastFx(f, sk, uid) {
  const lk = skLook(uid), col = sk.color || f.def.design.c3, xp = f.mast ? f.mast[uid] | 0 : 0, rank = masteryRank(xp), st = f.sevo ? f.sevo[uid] | 0 : 0;
  const ecol = st >= 3 ? '#ffffff' : st === 2 ? '#ffd740' : st === 1 ? '#e040fb' : col;
  vfx((ctx, q) => {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(q * lk.spin); ctx.globalAlpha = (1 - q) * 0.85; ctx.strokeStyle = ecol; ctx.lineWidth = 2 + st;
    const R = f.r * (1.5 + q * 0.9); ctx.beginPath();
    for (let i = 0; i <= lk.pts * 2; i++) { const a = i / (lk.pts * 2) * TAU, rr = i % 2 ? R * (0.55 + lk.inner * 0.08) : R; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(rr, 0); }
    ctx.stroke(); for (let k = 0; k < lk.rings; k++) { ctx.beginPath(); ctx.arc(0, 0, R * (0.35 + k * 0.22), 0, TAU); ctx.stroke(); }
    if (rank >= 2) { ctx.rotate(-q * lk.spin * 2); ctx.strokeStyle = MASTERY[rank].col; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(0, 0, R * 1.25, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }, 0.5);
  if (rank >= 1) FX.ring(f.x, f.y, MASTERY[rank].col, f.r * (2 + rank * 0.4), 0.4, 3 + rank, f.r);
  if (rank >= 3) FX.burst(f.x, f.y, MASTERY[rank].col, 10 + rank * 4, 240, 4, 0.5, rank >= 4 ? 'shard' : 'dot');
  if (rank >= 4) FX.text(f.x, f.y - f.r - 58, '✦ GRANDMASTER ✦', '#ffd740', 12, { life: 0.8 });
  if (st) FX.burst(f.x, f.y, ecol, 8 + st * 6, 200 + st * 60, 4, 0.5, st >= 2 ? 'shard' : 'dot');
  skSound(f, lk, st);
}
function skSound(f, lk, st) {
  if (!Sound.ctx || !SAVE.settings || SAVE.settings.sfx <= 0) return;
  const key = 'sk' + lk.pts + lk.rings + lk.wave, tn = performance.now(); Sound.last = Sound.last || {}; if (Sound.last[key] && tn - Sound.last[key] < 120) return; Sound.last[key] = tn;
  const b = 220 * (sfxOf(f.def).pitch || 1);
  lk.motif.forEach((m, k) => Sound.tone(b * m * (1 + st * 0.12), lk.dur, lk.wave, 0.035, 1.02, k * lk.dur * 0.8));
}
/** ultimate entrance: name card in the ball's colours, its symbol, a camera push and the ultimate's own motif */
function ultEntranceFx(f) {
  const d = f.def.design, u = f.ult || {}, us = ULT_SIG[(f.baseDef || f.def).id], lk = skLook((f.baseDef || f.def).id + '.ult');
  camPunch(f.x, f.y, 0.12, 0.9);
  vfx((ctx, q) => {
    const a = q < 0.15 ? q / 0.15 : q > 0.75 ? (1 - q) / 0.25 : 1; ctx.save(); ctx.globalAlpha = a;
    const y = ARENA.y + 34, g = ctx.createLinearGradient(ARENA.x, 0, ARENA.r, 0); g.addColorStop(0, rgba(d.c1, 0)); g.addColorStop(0.5, rgba(d.c1, 0.85)); g.addColorStop(1, rgba(d.c1, 0));
    ctx.fillStyle = g; ctx.fillRect(ARENA.x, y - 26, ARENA.w, 52); ctx.strokeStyle = d.c3; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ARENA.x + 80, y - 26); ctx.lineTo(ARENA.r - 80, y - 26); ctx.moveTo(ARENA.x + 80, y + 26); ctx.lineTo(ARENA.r - 80, y + 26); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = '900 26px "Segoe UI", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.shadowColor = d.c3; ctx.shadowBlur = 16;
    ctx.fillText('★ ' + String(u.name || 'ULTIMATE').toUpperCase() + ' ★', ARENA.cx + (1 - a) * 60, y + 9);
    if (us) { ctx.font = '700 12px "Segoe UI", sans-serif'; ctx.fillStyle = d.c2; ctx.fillText(us.n, ARENA.cx, y + 44); }
    ctx.restore();
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(q * 4); ctx.globalAlpha = (1 - q) * 0.7; ctx.strokeStyle = d.c2; ctx.lineWidth = 3;
    for (let k = 0; k < lk.pts; k++) { const aa = k / lk.pts * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(aa) * f.r * 1.4, Math.sin(aa) * f.r * 1.4); ctx.lineTo(Math.cos(aa) * f.r * (3 + q * 2), Math.sin(aa) * f.r * (3 + q * 2)); ctx.stroke(); }
    ctx.restore();
  }, 1.6);
  if (Sound.ctx && SAVE.settings && SAVE.settings.sfx > 0) { const b = 110 * (sfxOf(f.def).pitch || 1); lk.motif.forEach((m, k) => Sound.tone(b * m, 0.5, lk.wave, 0.05, 1, k * 0.12)); }
}
/* =====================================================================
   2.6.0 TWIST LIBRARY — real extra mechanics. Each classic ability gets ONE signature twist chosen for it alone
   (no two abilities of the same type share a twist), evolutions stack more of them, ultimates get their own.
   dec(entry, kind, a, owner)  changes what the ability creates (projectile / beam / wave / zone / strike / orb)
   post(f, sk, a, P, tgt)      runs right after the cast (self abilities)
   hit(owner, tgt, dmg, o, a)  runs when the ability damages an enemy
   ult(f, a, u)                an ultimate's own extra phase
   ===================================================================== */
const chainHook = (obj, key, fn) => { const prev = obj[key]; obj[key] = prev ? function (...x) { prev(...x); fn(...x); } : fn; };
const twReady = (o, key, t) => { const s = sx(o), now = BATTLE.time; s.twcd = s.twcd || {}; if ((s.twcd[key] || 0) > now) return false; s.twcd[key] = now + t; return true; };
const foesNear = (f, x, y, r) => supEnemies(f).filter(e => len(e.x - x, e.y - y) < r + e.r);
const twDmg = (f, P, k) => skillDmg(f, P || 50) * k;
function twShard(f, x, y, ang, dmg, col, o = {}) { return supShot(f, x, y, ang, { speed: o.speed || 480, r: o.r || 5, dmg, col, life: o.life || 0.7, power: 40, effect: o.effect, homing: o.homing || 0, target: o.target || null, style: o.style || null }); }
function twMiniZone(f, x, y, r, life, dmg, col, eff, extra = {}) { return supZone(f, { kind: 'trap', x: inArenaX(x, 10), y: inArenaY(y, 10), r, life, col, effect: eff || 'none', dmg: eff && eff !== 'none' ? Math.max(0.5, dmg) : dmg, style: eff === 'slow' ? 'web' : eff, power: 40, ...extra }); }
const twTxt = (f, t, col) => { if (!FX.off) FX.text(f.x, f.y - f.r - 40, t, col || '#ffffff', 14, { life: 0.8 }); };

/* ===== projectiles ===== */
Object.assign(TW, {
  split: { meta: ['fragment'], dec(p, k, a, o) { if (k !== 'proj') return; chainHook(p, 'onHit', (p, e) => { const n = a.n || 3, b = datan2(p.vy, p.vx); for (let i = 0; i < n; i++) twShard(o, p.x, p.y, b + (i - (n - 1) / 2) * 0.55 + Math.PI * 0, p.dmg * (a.k || 0.32), p.col, { speed: 420 }); if (!FX.off) FX.burst(p.x, p.y, p.col, 10, 300, 4, 0.4, 'shard'); }); },
    desc: a => `On impact it shatters into ${a.n || 3} shards that keep flying` },
  ricochet: { meta: ['bounce-walls'], dec(p, k, a) { if (k !== 'proj') return; p.bounce = (p.bounce || 0) + (a.n || 2); p.life += 0.7 * (a.n || 2); }, desc: a => `Ricochets off the arena walls ${a.n || 2} times` },
  pierce: { meta: ['pass-through'], dec(p, k, a) { if (k !== 'proj') return; p.pierce = (p.pierce || 0) + (a.n || 2); }, desc: a => `Passes through up to ${a.n || 2} enemies` },
  boomerang: { meta: ['return-path'], dec(p, k, a, o) { if (k !== 'proj') return; p.age26 = 0; chainHook(p, 'tick', (p, h) => { p.age26 += h; if (!p.back26 && p.age26 > (a.t || 0.55)) { p.back26 = true; p.hits = new Set(); p.target = o; p.homing = 9; p.life = Math.max(p.life, 1.4); p.pierce = Math.max(p.pierce || 0, 1); } if (p.back26 && o.alive && dist2(p.x, p.y, o.x, o.y) < (o.r + p.r) * (o.r + p.r)) p.life = 0; }); },
    desc: () => 'Flies out, then curves back to the caster, hitting again on the way back' },
  ember: { meta: ['lingering-ground'], fx: ['burn'], dec(p, k, a, o) { if (k !== 'proj') return; const go = p => twMiniZone(o, p.x, p.y, a.r || 55, a.t || 2.2, p.dmg * 0.1, p.col, a.eff || p.effect || 'burn'); chainHook(p, 'onHit', go); chainHook(p, 'onEnd', go); },
    desc: a => `Leaves a patch of ${a.eff === 'poison' ? 'toxic' : a.eff === 'slow' ? 'sticky' : 'burning'} ground where it lands` },
  grow: { meta: ['size-scaling'], dec(p, k, a) { if (k !== 'proj') return; const d0 = p.dmg, r0 = p.r; chainHook(p, 'tick', (p, h) => { p.r = Math.min(r0 * 2.2, p.r * (1 + h * (a.k || 1.2))); p.dmg = Math.min(d0 * 1.6, p.dmg * (1 + h * (a.k || 1.2) * 0.6)); }); }, desc: () => 'Grows bigger and stronger the longer it flies (up to +60%)' },
  accel: { meta: ['acceleration'], dec(p, k) { if (k !== 'proj') return; const s0 = p.speed; p.speed *= 0.4; p.vx *= 0.4; p.vy *= 0.4; chainHook(p, 'tick', (p, h) => { if (p.speed < s0 * 1.5) { const m = Math.min(s0 * 1.5, p.speed + s0 * 2.4 * h) / p.speed; p.speed *= m; p.vx *= m; p.vy *= m; } }); }, desc: () => 'Starts slow, then rockets to 150% speed' },
  zigzag: { meta: ['weaving-path'], dec(p, k, a) { if (k !== 'proj') return; p.age26 = 0; chainHook(p, 'tick', (p, h) => { p.age26 += h; const turn = dcos(p.age26 * (a.f || 14)) * (a.amp || 5) * h, c = dcos(turn), s = dsin(turn), vx = p.vx * c - p.vy * s, vy = p.vx * s + p.vy * c; p.vx = vx; p.vy = vy; }); }, desc: () => 'Weaves left and right in flight, hard to read' },
  lateHome: { meta: ['delayed-lock-on'], dec(p, k, a) { if (k !== 'proj') return; const hm = Math.max(p.homing || 0, a.h || 5); p.homing = 0; p.age26 = 0; p.life += 0.6; chainHook(p, 'tick', (p, h) => { p.age26 += h; if (p.age26 > (a.t || 0.35)) p.homing = hm; }); }, desc: () => 'Flies straight, then locks on to the nearest enemy' },
  fork: { meta: ['mid-air-split'], dec(p, k, a, o) { if (k !== 'proj') return; p.age26 = 0; chainHook(p, 'tick', (p, h) => { p.age26 += h; if (!p.forked && p.age26 > (a.t || 0.3)) { p.forked = true; const b = datan2(p.vy, p.vx); for (const s of [-1, 1]) twShard(o, p.x, p.y, b + s * 0.32, p.dmg * 0.6, p.col, { speed: p.speed, r: p.r * 0.8, life: Math.max(0.5, p.life), effect: p.effect }); p.life = 0; } }); }, desc: () => 'Forks into two diverging bolts mid-flight' },
  frostTrail: { meta: ['trail-zones'], fx: ['slow'], dec(p, k, a, o) { if (k !== 'proj') return; p.tt26 = 0; chainHook(p, 'tick', (p, h) => { if ((p.tt26 -= h) <= 0) { p.tt26 = 0.16; if ((BATTLE.zones.length) < 40) twMiniZone(o, p.x, p.y, 26, 1.4, 0, p.col, a.eff || 'slow'); } }); }, desc: a => `Leaves a ${a.eff === 'poison' ? 'toxic' : 'chilling'} trail that ${a.eff === 'poison' ? 'poisons' : 'slows'} anyone crossing it` },
  sticky: { meta: ['delayed-explosion'], dec(p, k, a, o) { if (k !== 'proj') return; chainHook(p, 'onHit', (p, e) => { const d = p.dmg * (a.k || 0.55), col = p.col; if (!FX.off) FX.ring(e.x, e.y, col, e.r * 1.6, a.t || 1, 3, e.r); after(a.t || 1, () => { if (!e.alive) return; supBlast(o, e.x, e.y, a.r || 90, d, { tag: 'explosion', force: 260 }); if (!FX.off) { FX.burst(e.x, e.y, col, 22, 380, 6, 0.5); FX.ring(e.x, e.y, col, a.r || 90, 0.35, 6, 10); } }); }); }, desc: () => 'Sticks to the target and explodes a second later' },
  gravOrb: { meta: ['pull-in-flight'], dec(p, k, a, o) { if (k !== 'proj') return; chainHook(p, 'tick', (p, h) => { for (const e of supEnemies(o)) { const d = len(e.x - p.x, e.y - p.y); if (d < (a.r || 130) && d > 1) { e.vx += (p.x - e.x) / d * (a.f || 700) * h; e.vy += (p.y - e.y) / d * (a.f || 700) * h; } } }); }, desc: () => 'Drags nearby enemies toward its path as it flies' },
  orbitFirst: { meta: ['orbit-then-launch'], dec(p, k, a, o) { if (k !== 'proj') return; const sp = p.speed; p.age26 = 0; p.orb26 = true; p.life += a.t || 0.45; p.a0 = datan2(p.y - o.y, p.x - o.x);
    chainHook(p, 'tick', (p, h) => { p.age26 += h; if (p.orb26) { if (p.age26 < (a.t || 0.45) && o.alive) { const an = p.a0 + p.age26 * 9, R = o.r + 34; p.x = o.x + dcos(an) * R - p.vx * h; p.y = o.y + dsin(an) * R - p.vy * h; } else { p.orb26 = false; const t = supTarget(o, p.target); const an = t ? datan2(t.y - p.y, t.x - p.x) : datan2(p.vy, p.vx); p.vx = dcos(an) * sp * 1.2; p.vy = dsin(an) * sp * 1.2; p.speed = sp * 1.2; } } }); },
    desc: () => 'Circles the caster first, then launches at full speed' },
});
/* ===== beams ===== */
Object.assign(TW, {
  prism: { meta: ['side-rays'], dec(b, k, a, o) { if (k !== 'beam') return; for (const s of [-1, 1]) { const c = { ...b, ang: b.ang + s * (a.spread || 0.3), dmg: b.dmg * (a.k || 0.4), w: b.w * 0.6, hit: new Set(), tw26: true }; BATTLE.beams.push(c); } }, desc: () => 'Splits into two extra side rays' },
  afterburn: { meta: ['ground-line'], fx: ['burn'], dec(b, k, a, o) { if (k !== 'beam') return; after(b.charge + 0.03, () => { if (!o.alive || !b.end) return; for (let i = 1; i <= 6; i++) { const q = i / 7; twMiniZone(o, o.x + (b.end.x - o.x) * q, o.y + (b.end.y - o.y) * q, 34, a.t || 2, b.dmg * 0.05, b.col, a.eff || b.effect || 'burn'); } }); },
    desc: a => `Scorches the ground along its path (${a.eff || 'burn'} for ${a.t || 2} s)` },
  refract: { meta: ['wall-bounce-beam'], dec(b, k, a, o) { if (k !== 'beam') return; after(b.charge + 0.03, () => { if (!o.alive || !b.end) return; const e = b.end, vx = dcos(b.ang), vy = dsin(b.ang), hx = e.x <= ARENA.x + 2 || e.x >= ARENA.r - 2, nvx = hx ? -vx : vx, nvy = hx ? vy : -vy, end = rayToWall(e.x + nvx * 4, e.y + nvy * 4, datan2(nvy, nvx));
    addLaser(o, [e.x, e.y, end.x, end.y], { charge: 0.08, dur: 0.22, w: Math.max(8, b.w * 0.7), dmg: b.dmg * 0.55, col: b.col }); }); }, desc: () => 'Reflects off the wall it hits and fires back across the arena' },
  twin: { meta: ['second-shot'], dec(b, k, a) { if (k !== 'beam') return; BATTLE.beams.push({ ...b, t: -(a.d || 0.4), dmg: b.dmg * (a.k || 0.5), hit: new Set(), fired: false, tw26: true }); }, desc: () => 'A second, lighter beam follows 0.4 s later' },
  widen: { meta: ['wide-beam'], dec(b, k, a) { if (k !== 'beam') return; b.w *= a.k || 1.8; b.dmg *= 0.85; }, desc: () => 'A much wider beam (hard to dodge, slightly weaker)' },
  linger: { meta: ['lingering-line'], dec(b, k, a, o) { if (k !== 'beam') return; after(b.charge + b.fire, () => { if (!o.alive || !b.end) return; addLaser(o, [o.x, o.y, b.end.x, b.end.y], { charge: 0, dur: a.t || 0.6, w: Math.max(6, b.w * 0.5), dmg: b.dmg * 0.15, col: b.col }); }); }, desc: () => 'Leaves a burning line in the air for a moment after firing' },
  sweep: { meta: ['sweeping-beam'], dec(b, k, a, o) { if (k !== 'beam') return; after(b.charge + b.fire, () => { if (!o.alive) return; addLaser(o, [0, 0, 0, 0], { charge: 0.05, dur: a.t || 0.7, w: Math.max(8, b.w * 0.55), dmg: b.dmg * 0.12, col: b.col, sweep: { cx: o.x, cy: o.y, a0: b.ang - (a.arc || 0.5), av: (a.arc || 0.5) * 2 / (a.t || 0.7), len: 900 } }); }); }, desc: () => 'After firing, it sweeps across in an arc' },
  focus: { meta: ['long-charge', 'heavy'], dec(b, k, a) { if (k !== 'beam') return; b.charge += a.c || 0.25; b.dmg *= a.k || 1.35; b.w *= 0.8; }, desc: () => 'Charges longer (clear warning), then hits much harder' },
});
/* ===== waves ===== */
Object.assign(TW, {
  echoWave: { meta: ['second-ring'], dec(w, k, a, o) { if (k !== 'wave') return; after(a.d || 0.35, () => { if (!o.alive) return; const c = supWave(o, w.x, w.y, w.maxR * 0.8, w.dmg * (a.k || 0.5), w.col, { speed: w.speed, w: w.w * 0.8, force: w.force * 0.5, effect: w.effect, power: w.power }); c.tw26 = true; }); }, desc: () => 'A second ring follows right behind' },
  implode: { meta: ['collapse-inward'], dec(w, k, a, o) { if (k !== 'wave') return; after(w.maxR / w.speed, () => { if (!o.alive) return; for (const e of foesNear(o, w.x, w.y, w.maxR)) knock(e, w.x, w.y, -(a.f || 520)); supBlast(o, w.x, w.y, 90, w.dmg * 0.35, { tag: 'wave' }); if (!FX.off) FX.ring(w.x, w.y, w.col, 20, 0.35, 8, w.maxR); }); }, desc: () => 'At full size the ring collapses back in, dragging enemies to its centre' },
  vacuum: { meta: ['inward-force'], dec(w, k) { if (k !== 'wave') return; w.force = -Math.abs(w.force) * 0.8; }, desc: () => 'The ring pulls enemies in instead of pushing them away' },
  aftershock: { meta: ['delayed-blasts'], dec(w, k, a, o) { if (k !== 'wave') return; const n = a.n || 4, ph = rand(TAU); for (let i = 0; i < n; i++) { const an = ph + i / n * TAU, x = w.x + dcos(an) * w.maxR * 0.6, y = w.y + dsin(an) * w.maxR * 0.6; supStrike(o, x, y, 0.45 + i * 0.08, 60, w.dmg * (a.k || 0.3), w.col, { kind: 'meteor', power: w.power }); } }, desc: a => `${a.n || 4} aftershocks erupt around it` },
  clearShots: { meta: ['projectile-clear'], dec(w, k) { if (k !== 'wave') return; w.clearProj = true; }, desc: () => 'Wipes out enemy projectiles it touches' },
  edgeStun: { meta: ['edge-control'], fx: ['stun'], dec(w, k, a, o) { if (k !== 'wave') return; chainHook(w, 'onHit', e => { if (len(e.x - w.x, e.y - w.y) > w.maxR * 0.6 && !e.boss) { e.st.slow = Math.max(e.st.slow, 1.2); if (twReady(e, 'edge', 2)) e.st.stun = Math.max(e.st.stun, 0.3); } }); }, desc: () => 'Enemies caught by the outer edge are staggered and slowed' },
  slowRing: { meta: ['ring-zone'], fx: ['slow'], dec(w, k, a, o) { if (k !== 'wave') return; after(w.maxR / w.speed * 0.8, () => { if (!o.alive) return; for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; twMiniZone(o, w.x + dcos(an) * w.maxR * 0.75, w.y + dsin(an) * w.maxR * 0.75, 38, a.t || 2.2, 0, w.col, 'slow'); } }); }, desc: () => 'Leaves a slowing ring on the ground' },
  spikeRing: { meta: ['inward-spikes'], dec(w, k, a, o) { if (k !== 'wave') return; after(w.maxR / w.speed, () => { if (!o.alive) return; const n = a.n || 8; for (let i = 0; i < n; i++) { const an = i / n * TAU; twShard(o, w.x + dcos(an) * w.maxR, w.y + dsin(an) * w.maxR, an + Math.PI, w.dmg * 0.25, w.col, { speed: 420, life: w.maxR / 420 }); } }); }, desc: a => `At full size ${a.n || 8} spikes fly back toward the centre` },
  healWave: { meta: ['heal-per-hit'], dec(w, k, a, o) { if (k !== 'wave') return; chainHook(w, 'onHit', () => healFighter(o, o.maxHp * (a.k || 0.025), true)); }, desc: () => 'Heals the caster for every enemy it hits' },
});
/* ===== zones (traps, gravity) ===== */
Object.assign(TW, {
  mines: { meta: ['proximity-mines'], dec(z, k, a, o) { if (k !== 'zone' || z.kind !== 'trap') return; const n = a.n || 3; for (let i = 0; i < n; i++) { const an = i / n * TAU; supZone(o, { kind: 'trap', x: inArenaX(z.x + dcos(an) * 70, 20), y: inArenaY(z.y + dsin(an) * 70, 20), r: 26, life: 7, col: z.col, effect: 'none', dmg: 0, style: z.style, mine26: z.dmg * 4, tw26: true, sk: z.sk }); } z.life = 0.01; }, desc: a => `Becomes ${a.n || 3} hidden mines that explode on contact` },
  root: { meta: ['root-first'], fx: ['root'], dec(z, k, a) { if (k !== 'zone') return; z.root26 = a.t || 0.6; }, desc: () => 'The first enemy to step in is rooted in place' },
  spread: { meta: ['growing-zone'], dec(z, k, a) { if (k !== 'zone') return; z.grow26 = a.k || 0.25; z.r0 = z.r; }, desc: () => 'Spreads wider every second' },
  drift: { meta: ['moving-zone'], dec(z, k, a) { if (k !== 'zone') return; z.drift26 = a.v || 70; }, desc: () => 'Creeps toward the nearest enemy' },
  detonate: { meta: ['end-explosion'], dec(z, k, a) { if (k !== 'zone') return; z.det26 = a.k || 3; }, desc: () => 'Detonates when it expires' },
  lure: { meta: ['zone-pull'], dec(z, k, a) { if (k !== 'zone') return; z.lure26 = a.f || 260; }, desc: () => 'Gently drags enemies toward its centre' },
  shardZone: { meta: ['turret-zone'], dec(z, k, a) { if (k !== 'zone') return; z.shard26 = a.t || 0.9; }, desc: () => 'Fires a shard at an enemy inside every second' },
  allyZone: { meta: ['ally-heal-zone'], dec(z, k, a) { if (k !== 'zone') return; z.ally26 = a.k || 0.02; }, desc: () => 'Heals its caster and allies standing in it' },
  crush: { meta: ['center-damage'], dec(z, k, a) { if (k !== 'zone' || z.kind !== 'gravity') return; z.crush26 = a.k || 1; }, desc: () => 'Crushes harder the closer enemies get to its centre' },
  repelEnd: { meta: ['end-fling'], dec(z, k, a) { if (k !== 'zone') return; z.repel26 = a.f || 900; }, desc: () => 'Ends by flinging everyone caught far away' },
  shotPull: { meta: ['projectile-eater'], dec(z, k) { if (k !== 'zone') return; z.eat26 = true; }, desc: () => 'Swallows enemy projectiles that fly near it' },
});
/* ===== strikes (lightning, meteors) and orbiting orbs ===== */
Object.assign(TW, {
  echoStrike: { meta: ['repeat-strike'], dec(s, k, a, o) { if (k !== 'strike') return; after(s.t + (a.d || 0.55), () => { if (o.alive) supStrike(o, s.x, s.y, 0.25, s.r, s.dmg * (a.k || 0.5), s.col, { kind: s.kind, effect: s.effect, power: s.power }); }); }, desc: () => 'Strikes the same spot a second time' },
  crater: { meta: ['crater-zone'], fx: ['slow'], dec(s, k, a, o) { if (k !== 'strike') return; after(s.t + 0.02, () => { if (o.alive) twMiniZone(o, s.x, s.y, s.r * 0.9, a.t || 2.5, s.dmg * 0.05, s.col, a.eff || 'slow'); }); }, desc: () => 'Leaves a crater that slows anyone inside' },
  fork2: { meta: ['second-target'], dec(s, k, a, o) { if (k !== 'strike') return; after(s.t + 0.05, () => { if (!o.alive) return; const es = supEnemies(o).filter(e => len(e.x - s.x, e.y - s.y) > s.r + e.r); const e = es.length ? es.reduce((x, y) => dist2(x.x, x.y, s.x, s.y) < dist2(y.x, y.y, s.x, s.y) ? x : y) : null; if (e) { supStrike(o, e.x, e.y, 0.3, s.r * 0.8, s.dmg * 0.6, s.col, { kind: s.kind, effect: s.effect, power: s.power }); if (!FX.off) FX.bolt(s.x, s.y, e.x, e.y, s.col, 3, 0.3); } }); }, desc: () => 'Forks to strike a second enemy too' },
  widenStrike: { meta: ['wide-area'], dec(s, k, a) { if (k !== 'strike') return; s.r *= a.k || 1.5; s.dmg *= 0.85; s.t += 0.1; s.max += 0.1; }, desc: () => 'A wider strike with a longer warning' },
  staticField: { meta: ['shock-zone'], fx: ['stun'], dec(s, k, a, o) { if (k !== 'strike') return; after(s.t + 0.02, () => { if (o.alive) { const z = twMiniZone(o, s.x, s.y, s.r, a.t || 2.4, s.dmg * 0.06, s.col, 'none'); z.zap26 = 0.8; } }); }, desc: () => 'Leaves a crackling field that jolts enemies inside' },
  expandOrbit: { meta: ['widening-orbit'], dec(b, k, a) { if (k !== 'orb') return; b.exp26 = a.v || 40; }, desc: () => 'Its orbit keeps widening' },
  launchOrbit: { meta: ['orbit-release'], dec(b, k) { if (k !== 'orb') return; b.launch26 = true; }, desc: () => 'When it ends, every orb launches at the nearest enemy' },
  blockOrbit: { meta: ['projectile-block'], dec(b, k, a) { if (k !== 'orb') return; b.block26 = a.n || 3; }, desc: a => `Its orbs destroy up to ${a.n || 3} enemy projectiles` },
  tightOrbit: { meta: ['tight-orbit'], dec(b, k) { if (k !== 'orb') return; b.rad = Math.max(b.owner.r + 18, b.rad - 16); b.dmg *= 1.15; b.n += 1; }, desc: () => 'A tighter ring with one more orb' },
  healOrbit: { meta: ['orbit-heal'], dec(b, k, a) { if (k !== 'orb') return; b.heal26 = a.k || 0.3; }, desc: () => 'Each orb hit heals the caster' },
});

/* ===== HIT twists (any ability that deals damage) ===== */
Object.assign(TW, {
  chain: { meta: ['chain-jump'], hit(o, t, d, x, a) { if (!twReady(t, 'chain' + o.sid, 0.6)) return; let from = t; const used = new Set([t]); for (let j = 0; j < (a.n || 2); j++) { const nx = supEnemies(o).filter(e => !used.has(e) && len(e.x - from.x, e.y - from.y) < (a.r || 240)).sort((p, q) => dist2(p.x, p.y, from.x, from.y) - dist2(q.x, q.y, from.x, from.y))[0]; if (!nx) break; used.add(nx); if (!FX.off) FX.bolt(from.x, from.y, nx.x, nx.y, a.col || '#fff59d', 3, 0.3); _dealDamage26(o, nx, d * (a.k || 0.45), { kind: 'skill', tag: 'strike', noCrit: true }); from = nx; } },
    desc: a => `Jumps to ${a.n || 2} more enemies nearby` },
  mark: { meta: ['mark-detonate'], hit(o, t, d, x, a) { const s = sx(t); if (s.markT > 0) return; s.markT = a.t || 2; s.markD = d * (a.k || 0.4); s.markBy = o; if (!FX.off) FX.text(t.x, t.y - t.r - 26, 'MARKED', a.col || '#ff8a80', 13, { life: 0.7 }); }, desc: () => 'Marks the enemy: the mark detonates 2 s later' },
  drain: { meta: ['lifesteal'], hit(o, t, d, x, a) { healFighter(o, d * (a.k || 0.3), true); }, desc: a => `Heals the caster for ${Math.round((a.k || 0.3) * 100)}% of the damage` },
  sunder: { meta: ['armor-break'], fx: ['vulnerable'], hit(o, t, d, x, a) { const s = sx(t); s.sunderT = a.t || 3; s.sunderK = a.k || 0.15; }, desc: a => `Breaks armour: the enemy takes ${Math.round((a.k || 0.15) * 100)}% more damage for ${a.t || 3} s` },
  blind: { meta: ['blind'], fx: ['blind'], hit(o, t, d, x, a) { if (t.boss || !twReady(t, 'blind', 4)) return; sx(t).blindT = a.t || 0.6; if (!FX.off) FX.text(t.x, t.y - t.r - 26, 'BLINDED', '#ffffff', 13, { life: 0.6 }); }, desc: () => 'Blinds the enemy: it wanders for a moment' },
  confuse: { meta: ['reverse-controls'], fx: ['confuse'], hit(o, t, d, x, a) { if (!twReady(t, 'conf', 4)) return; sx(t).confT = a.t || 1.2; if (!FX.off) FX.text(t.x, t.y - t.r - 26, 'CONFUSED', '#ea80fc', 13, { life: 0.6 }); }, desc: () => 'Confuses the enemy: its steering is reversed briefly' },
  hush: { meta: ['silence'], fx: ['silence'], hit(o, t, d, x, a) { if (!twReady(t, 'hush', 5)) return; silenceFoe(o, t, a.t || 0.8, 'HUSHED'); }, desc: () => 'Briefly silences the enemy’s abilities' },
  spin: { meta: ['deflect'], hit(o, t, d, x, a) { if (t.boss || !twReady(t, 'spin', 1.5)) return; const vx = t.vx; t.vx = -t.vy; t.vy = vx; t.st.slow = Math.max(t.st.slow, 0.6); }, desc: () => 'Sends the enemy spinning off course' },
  shove: { meta: ['big-knockback'], hit(o, t, d, x, a) { if (twReady(t, 'shove' + o.sid, 0.5)) knock(t, o.x, o.y, a.f || 700); }, desc: () => 'Blasts the enemy far away' },
  hook: { meta: ['pull-to-caster'], hit(o, t, d, x, a) { if (twReady(t, 'hook' + o.sid, 0.8)) knock(t, o.x, o.y, -(a.f || 560)); }, desc: () => 'Drags the enemy toward the caster' },
  ultFeed: { meta: ['ult-charge'], hit(o, t, d, x, a) { if (!o.isClone && o.ultMeter < 100) o.ultMeter = Math.min(100, o.ultMeter + (a.k || 5)); }, desc: () => 'Every hit charges the ultimate faster' },
  refund: { meta: ['cooldown-refund'], hit(o, t, d, x, a) { const s = o.skills && o.skills.find(k => k.uid === x.sk); if (s && twReady(o, 'ref' + x.sk, 0.5)) s.cdLeft = Math.max(0, s.cdLeft - (a.s || 1)); }, desc: a => `Each hit cuts its own cooldown by ${a.s || 1} s` },
  shatter: { meta: ['bonus-vs-frozen'], hit(o, t, d, x, a) { if (t.st.freeze > 0 || t.st.stun > 0) { if (t.st.freeze > 0) t.st.freeze = 0; _dealDamage26(o, t, d * (a.k || 0.5), { kind: 'skill', tag: 'skill', noCrit: true }); if (!FX.off) FX.burst(t.x, t.y, '#e1f5fe', 14, 300, 5, 0.4, 'shard'); } }, desc: () => 'Shatters frozen or stunned enemies for bonus damage' },
  execute: { meta: ['bonus-vs-low-hp'], hit(o, t, d, x, a) { if (t.hpRatio < (a.h || 0.3)) _dealDamage26(o, t, d * (a.k || 0.4), { kind: 'skill', tag: 'skill', noCrit: true }); }, desc: () => 'Deals bonus damage to badly hurt enemies' },
  breakShield: { meta: ['shield-break'], hit(o, t, d, x, a) { if (t.st.shield > 0) { t.st.shield = 0; if (!FX.off) FX.text(t.x, t.y - t.r - 26, 'SHIELD BROKEN', '#80d8ff', 13, { life: 0.7 }); } }, desc: () => 'Breaks the enemy’s shield' },
  spreadDot: { meta: ['spread-status'], hit(o, t, d, x, a) { if (!(t.st.burn > 0 || t.st.poison > 0) || !twReady(t, 'spread', 2)) return; const eff = t.st.burn > 0 ? 'burn' : 'poison'; for (const e of foesNear(o, t.x, t.y, a.r || 170)) if (e !== t) { applyEffect(o, e, eff, 50); if (!FX.off) FX.bolt(t.x, t.y, e.x, e.y, eff === 'burn' ? '#ff9100' : '#9dff00', 2, 0.25); } }, desc: () => 'Burning or poison on the target spreads to enemies next to it' },
  stackPoison: { meta: ['extra-stacks'], fx: ['poison'], hit(o, t, d, x, a) { applyEffect(o, t, 'poison', 60); }, desc: () => 'Adds an extra poison stack' },
  chill: { meta: ['stacking-freeze'], fx: ['freeze'], hit(o, t, d, x, a) { const s = sx(t); s.chillN = (s.chillT > 0 ? s.chillN || 0 : 0) + 1; s.chillT = 3; t.st.slow = Math.max(t.st.slow, 0.8); if (s.chillN >= (a.n || 3)) { s.chillN = 0; applyEffect(o, t, 'freeze', 60); } }, desc: a => `Chills: every ${a.n || 3} hits freeze the enemy` },
  echoHit: { meta: ['delayed-repeat'], hit(o, t, d, x, a) { if (!twReady(t, 'echo' + x.sk, 0.4)) return; after(a.d || 0.5, () => { if (t.alive && o.alive) { _dealDamage26(o, t, d * (a.k || 0.35), { kind: 'skill', tag: 'skill', noCrit: true }); if (!FX.off) FX.ring(t.x, t.y, a.col || '#ffffff', t.r * 2, 0.3, 4, t.r); } }); }, desc: () => 'The hit echoes again half a second later' },
  killNova: { meta: ['on-kill-burst'], hit(o, t, d, x, a) { if (t.hp <= 0 || !t.alive) { supBlast(o, t.x, t.y, a.r || 150, twDmg(o, 60, a.k || 0.6), { tag: 'explosion', force: 400 }); if (!FX.off) { FX.ring(t.x, t.y, a.col || '#ffab40', a.r || 150, 0.4, 8, 10); FX.burst(t.x, t.y, a.col || '#ffab40', 30, 420, 6, 0.6); } } }, desc: () => 'An enemy it finishes off explodes' },
  cripple: { meta: ['cooldown-debuff'], hit(o, t, d, x, a) { if (!twReady(t, 'crip', 3)) return; for (const s of t.skills || []) if (s.cdLeft > 0) s.cdLeft += a.s || 1; }, desc: () => 'Pushes back the enemy’s cooldowns by 1 s' },
  leech: { meta: ['ult-steal'], hit(o, t, d, x, a) { if (!twReady(t, 'leech', 1)) return; const k = Math.min(t.ultMeter, a.k || 6); t.ultMeter -= k; if (!o.isClone) o.ultMeter = Math.min(100, o.ultMeter + k); }, desc: () => 'Steals ultimate charge from the enemy' },
  bleed: { meta: ['bleed-dot'], fx: ['bleed'], hit(o, t, d, x, a) { const s = sx(t); s.bleedT = a.t || 3; s.bleedD = Math.max(s.bleedD || 0, d * (a.k || 0.08)); s.bleedBy = o; }, desc: () => 'Makes the enemy bleed for a few seconds' },
  tether: { meta: ['tether-link'], hit(o, t, d, x, a) { const s = sx(t); s.tethT = a.t || 2.5; s.tethBy = o; }, desc: () => 'Tethers the enemy: if it runs too far it is yanked back and hurt' },
  stagger: { meta: ['stagger'], hit(o, t, d, x, a) { if (t.boss || !twReady(t, 'stag', 2.5)) return; t.vx *= 0.1; t.vy *= 0.1; t.st.slow = Math.max(t.st.slow, 0.5); }, desc: () => 'Staggers the enemy, stopping it in its tracks' },
  scatter: { meta: ['side-sparks'], hit(o, t, d, x, a) { if (!twReady(t, 'scat' + x.sk, 0.4)) return; for (let i = 0; i < (a.n || 3); i++) twShard(o, t.x, t.y, rand(TAU), d * 0.18, a.col || '#ffffff', { speed: 380, homing: 3, life: 1 }); }, desc: () => 'Sparks fly off the target and seek other enemies' },
  pierceGuard: { meta: ['vs-shield-bonus'], hit(o, t, d, x, a) { if (t.st.shield > 0) _dealDamage26(o, t, d * (a.k || 0.45), { kind: 'skill', noDef: true, noCrit: true }); }, desc: () => 'Deals bonus damage through shields' },
});

/* ===== POST twists (after the cast) ===== */
const SHIELD_DUR = s => 2.2 + (s.power || 50) / 30;
Object.assign(TW, {
  thorns: { meta: ['thorns'], post(f, sk, a) { const s = sx(f); s.thornsT = SHIELD_DUR(sk); s.thornsK = a.k || 0.3; }, desc: a => `While it is up, attackers take ${Math.round((a.k || 0.3) * 100)}% of their damage back` },
  shieldBurst: { meta: ['end-burst'], post(f, sk, a, P) { after(SHIELD_DUR(sk), () => { if (!f.alive) return; supWave(f, f.x, f.y, 220, twDmg(f, P, a.k || 0.5), sk.color || f.def.design.c3, { force: 600 }); }); }, desc: () => 'When it ends it bursts outward, blasting enemies away' },
  frostArmor: { meta: ['freeze-attackers'], fx: ['freeze'], post(f, sk) { sx(f).frostT = SHIELD_DUR(sk); }, desc: () => 'Enemies that crash into it are frozen' },
  eatShots: { meta: ['projectile-eater'], post(f, sk, a) { const s = sx(f); s.eatT = SHIELD_DUR(sk); s.eatN = a.n || 3; }, desc: a => `Destroys up to ${a.n || 3} enemy projectiles before they land` },
  cleanseImm: { meta: ['cleanse', 'cc-immunity'], post(f, sk, a) { f.st.stun = f.st.freeze = f.st.slow = f.st.weaken = 0; f.ccImm = Math.max(f.ccImm || 0, a.t || 1.5); }, desc: () => 'Removes stuns and slows and makes the caster unstoppable for 1.5 s' },
  absorbHeal: { meta: ['store-heal'], post(f, sk, a) { const s = sx(f); s.storeT = SHIELD_DUR(sk); s.store = 0; after(SHIELD_DUR(sk), () => { if (f.alive && s.store > 0) { healFighter(f, s.store * (a.k || 0.35)); s.store = 0; } }); }, desc: () => 'Part of the damage it blocks heals the caster when it ends' },
  swiftGuard: { meta: ['speed-while-up'], post(f, sk, a) { const s = sx(f); s.swiftT = SHIELD_DUR(sk); s.swiftK = a.k || 1.25; }, desc: () => 'The caster moves 25% faster while it is up' },
  pulseGuard: { meta: ['damage-pulses'], post(f, sk, a, P) { const n = Math.floor(SHIELD_DUR(sk) / 0.8); for (let i = 1; i <= n; i++) after(i * 0.8, () => { if (f.alive) { supBlast(f, f.x, f.y, a.r || 120, twDmg(f, P, a.k || 0.12), { tag: 'wave' }); if (!FX.off) FX.ring(f.x, f.y, sk.color || '#ffffff', a.r || 120, 0.3, 4, f.r); } }); }, desc: () => 'Pulses damage around the caster while it is up' },
  mirrorGuard: { meta: ['reflect-window'], post(f, sk, a) { f.st.reflect = Math.max(f.st.reflect, a.t || 0.6); }, desc: () => 'For the first 0.6 s it reflects projectiles' },
  stunGuard: { meta: ['stun-rammers'], fx: ['stun'], post(f, sk) { sx(f).stunGT = SHIELD_DUR(sk); }, desc: () => 'Enemies that ram it are stunned' },
  growGuard: { meta: ['growing-block'], post(f, sk) { const d = SHIELD_DUR(sk); for (let i = 1; i < 4; i++) after(d * i / 4, () => { if (f.st.shield > 0) f.st.shieldPow = Math.min(0.88, f.st.shieldPow + 0.07); }); }, desc: () => 'Blocks more and more the longer it lasts' },
  orbitGuard: { meta: ['guard-orbs'], post(f, sk, a, P) { BATTLE.orbs.push({ owner: f, team: f.team, n: 2, life: SHIELD_DUR(sk), ang: 0, rad: f.r + 30, dmg: twDmg(f, P, 0.25), col: sk.color || '#ffffff', hitCd: new Map(), effect: 'none', power: P, block26: 2, tw26: true, sk: sk.uid }); }, desc: () => 'Two guard orbs circle the caster and block shots' },
  pushAura: { meta: ['repel-aura'], post(f, sk) { sx(f).repelT = SHIELD_DUR(sk); }, desc: () => 'Pushes nearby enemies away while it is up' },
  chargeGuard: { meta: ['block-to-ult'], post(f, sk) { sx(f).chargeGT = SHIELD_DUR(sk); }, desc: () => 'Damage it blocks charges the ultimate' },
  lanceGuard: { meta: ['end-lance'], post(f, sk, a, P) { after(SHIELD_DUR(sk), () => { const t = nearestEnemy(f); if (!f.alive || !t) return; addLaser(f, [f.x, f.y, t.x, t.y], { charge: 0.35, dur: 0.2, w: 14, dmg: twDmg(f, P, a.k || 0.55), col: sk.color || '#ffffff' }); }); }, desc: () => 'When it ends it fires a lance at the nearest enemy' },
  slowAura: { meta: ['slow-aura'], fx: ['slow'], post(f, sk) { sx(f).slowAT = SHIELD_DUR(sk); }, desc: () => 'Enemies near the caster are slowed while it is up' },
  decoyGuard: { meta: ['decoy'], post(f, sk, a, P) { if (BATTLE.fighters.filter(c => c.isClone && c.owner === f && c.alive).length >= 2) return; const c = spawnClone(f, P * 0.3, 2.5, rand(TAU)); c.maxHp = c.hp = Math.max(5, Math.round(f.maxHp * 0.1)); c.decoy = true; }, desc: () => 'Leaves a decoy that draws attacks' },
  phaseGuard: { meta: ['brief-intangible'], post(f, sk, a) { f.st.phase = Math.max(f.st.phase, a.t || 0.4); }, desc: () => 'The caster is intangible for 0.4 s as it rises' },
  healGuard: { meta: ['heal-while-up'], post(f, sk, a) { const s = sx(f); s.regenT = SHIELD_DUR(sk); s.regenK = a.k || 0.02; }, desc: () => 'Heals 2% HP per second while it is up' },
  rootGuard: { meta: ['unmovable'], post(f, sk) { sx(f).steadyT = SHIELD_DUR(sk); f.st.shieldPow = Math.min(0.88, f.st.shieldPow + 0.1); }, desc: () => 'The caster cannot be knocked around and blocks 10% more' },
  wardAllies: { meta: ['ally-shield'], post(f, sk) { for (const e of BATTLE.fighters) if (e.alive && e !== f && e.team === f.team && !e.isClone && len(e.x - f.x, e.y - f.y) < 380) { e.st.shield = Math.max(e.st.shield, 2); e.st.shieldPow = Math.max(e.st.shieldPow, 0.4); } }, desc: () => 'Also shields allies nearby' },
  // heals
  regen: { meta: ['heal-over-time'], post(f, sk, a) { const s = sx(f); s.regenT = a.t || 4; s.regenK = a.k || 0.015; }, desc: () => 'Keeps healing for 4 more seconds' },
  allyHeal: { meta: ['ally-heal'], post(f, sk, a) { for (const e of BATTLE.fighters) if (e.alive && e !== f && e.team === f.team && !e.isClone && len(e.x - f.x, e.y - f.y) < 420) healFighter(e, e.maxHp * (a.k || 0.1)); }, desc: () => 'Also heals allies nearby' },
  overShield: { meta: ['heal-shield'], post(f) { f.st.shield = Math.max(f.st.shield, 2); f.st.shieldPow = Math.max(f.st.shieldPow, 0.3); }, desc: () => 'Wraps the caster in a light shield too' },
  healPulse: { meta: ['damaging-heal'], post(f, sk, a, P) { supBlast(f, f.x, f.y, a.r || 160, twDmg(f, P, a.k || 0.35), { tag: 'wave', force: 300 }); if (!FX.off) FX.ring(f.x, f.y, sk.color || '#3dffa0', a.r || 160, 0.4, 6, f.r); }, desc: () => 'The healing light also burns enemies close by' },
  healHaste: { meta: ['post-heal-speed'], post(f, sk, a) { f.st.buff = Math.max(f.st.buff, a.t || 2.5); f.st.buffPow = Math.max(f.st.buffPow, 0.12); }, desc: () => 'A burst of speed after healing' },
  healCharge: { meta: ['heal-to-ult'], post(f, sk, a) { if (!f.isClone) f.ultMeter = Math.min(100, f.ultMeter + (a.k || 12)); }, desc: () => 'Charges the ultimate meter' },
  bloom: { meta: ['garden-zone'], post(f, sk, a) { const z = twMiniZone(f, f.x, f.y, a.r || 120, a.t || 4, 0, sk.color || '#69f0ae', 'slow'); z.ally26 = a.k || 0.015; z.tw26 = true; }, desc: () => 'Leaves a garden that heals allies and slows enemies' },
  healRefresh: { meta: ['cooldown-reset'], post(f, sk, a) { for (const s of f.skills) if (s !== sk && s.cdLeft > 0) s.cdLeft = Math.max(0, s.cdLeft - (a.s || 1.5)); }, desc: () => 'Cuts the other abilities’ cooldowns by 1.5 s' },
  healReflect: { meta: ['reflect-window'], post(f, sk, a) { f.st.reflect = Math.max(f.st.reflect, a.t || 0.9); }, desc: () => 'Reflects projectiles for a moment' },
  healBlast: { meta: ['heal-knockback'], post(f) { for (const e of foesNear(f, f.x, f.y, 200)) knock(e, f.x, f.y, 650); if (!FX.off) FX.ring(f.x, f.y, '#ffffff', 200, 0.35, 6, f.r); }, desc: () => 'Blows nearby enemies away' },
  lastStand: { meta: ['low-hp-bonus'], post(f, sk, a) { if (f.hpRatio < 0.5) healFighter(f, f.maxHp * (0.5 - f.hpRatio) * (a.k || 0.3)); }, desc: () => 'Heals much more when the caster is badly hurt' },
  purify: { meta: ['ally-cleanse'], post(f) { for (const e of BATTLE.fighters) if (e.alive && e.team === f.team && len(e.x - f.x, e.y - f.y) < 420) { e.st.burn = e.st.poison = e.st.slow = e.st.weaken = 0; e.poisonStacks = 0; } }, desc: () => 'Cleanses allies nearby too' },
  lifeLink: { meta: ['timed-lifesteal'], post(f, sk, a) { const s = sx(f); s.lsT = a.t || 3; s.lsK = a.k || 0.2; }, desc: () => 'For 3 s, 20% of the damage dealt heals the caster' },
  blinkHome: { meta: ['recall'], post(f) { const x = inArenaX(ARENA.cx + (f.x < ARENA.cx ? -200 : 200), f.r + 20), y = inArenaY(ARENA.cy, f.r + 20); if (!FX.off) FX.burst(f.x, f.y, '#ffffff', 14, 260); f.x = x; f.y = y; if (!FX.off) FX.burst(f.x, f.y, '#ffffff', 14, 260); }, desc: () => 'Recalls the caster to a safe spot' },
  // buffs
  hasteTrail: { meta: ['damage-trail'], post(f, sk, a) { sx(f).trailT = 5; sx(f).trailE = a.eff || 'none'; }, desc: () => 'While powered up, leaves a damaging trail' },
  critUp: { meta: ['crit-buff'], post(f, sk, a) { const s = sx(f); if (!(s.critT > 0)) { s.critB = a.k || 20; f.crit += s.critB; } s.critT = 5; }, desc: () => '+20% critical chance while powered up' },
  lsBuff: { meta: ['buff-lifesteal'], post(f, sk, a) { const s = sx(f); s.lsT = 5; s.lsK = a.k || 0.15; }, desc: () => 'While powered up, damage dealt heals the caster' },
  buffCharge: { meta: ['buff-ult'], post(f, sk, a) { if (!f.isClone) f.ultMeter = Math.min(100, f.ultMeter + (a.k || 15)); }, desc: () => 'Also charges the ultimate' },
  buffShock: { meta: ['end-shockwave'], post(f, sk, a, P) { after(5, () => { if (f.alive) supWave(f, f.x, f.y, 240, twDmg(f, P, a.k || 0.45), sk.color || '#ffffff', { force: 500 }); }); }, desc: () => 'When the power-up ends, it releases a shockwave' },
  // dashes and blinks
  dashTrail: { meta: ['dash-trail'], post(f, sk, a) { sx(f).trailT = 0.7; sx(f).trailE = a.eff || sk.effect || 'burn'; }, desc: a => `Leaves a ${a.eff || 'burning'} trail behind the dash` },
  afterimage: { meta: ['ghost-repeat'], post(f, sk, a, P, t) { if (!t) return; after(a.d || 0.45, () => { if (f.alive && t.alive) { supStrike(f, t.x, t.y, 0.18, 70, twDmg(f, P, a.k || 0.4), sk.color || f.def.design.c3, { kind: 'lightning', effect: sk.effect }); if (!FX.off) FX.bolt(f.x, f.y, t.x, t.y, sk.color || '#ffffff', 2, 0.25); } }); }, desc: () => 'An afterimage repeats the strike a moment later' },
  rebound: { meta: ['bounce-shield'], post(f) { after(0.6, () => { if (!f.alive) return; f.vx = -f.vx; f.vy = -f.vy; f.st.shield = Math.max(f.st.shield, 1.2); f.st.shieldPow = Math.max(f.st.shieldPow, 0.4); }); }, desc: () => 'Rebounds after the hit and raises a short shield' },
  dashShock: { meta: ['end-shockwave'], post(f, sk, a, P) { after(0.55, () => { if (f.alive) supWave(f, f.x, f.y, 170, twDmg(f, P, a.k || 0.4), sk.color || '#ffffff', { force: 450, effect: sk.effect }); }); }, desc: () => 'Ends with a shockwave' },
  dashHook: { meta: ['carry-target'], post(f, sk, a, P, t) { sx(f).carryT = 0.65; sx(f).carry = t || null; }, desc: () => 'Grabs the enemy and carries it along' },
  dashSplit: { meta: ['phantom-dashers'], post(f, sk, a, P, t) { if (!t) return; for (const s of [-1, 1]) { const an = angTo(f, t) + s * 0.5; twShard(f, f.x, f.y, an, twDmg(f, P, 0.3), sk.color || '#ffffff', { speed: 700, r: f.r * 0.5, life: 0.6, homing: 4, target: t }); } }, desc: () => 'Two phantom dashers rush in from the sides' },
  dashArmor: { meta: ['dash-armor'], post(f) { sx(f).armorT = 0.7; }, desc: () => 'Takes 50% less damage during the dash' },
  dashSpikes: { meta: ['side-spikes'], post(f, sk, a, P) { for (let i = 0; i < 3; i++) after(i * 0.15, () => { if (!f.alive) return; const b = datan2(f.vy, f.vx); for (const s of [-1, 1]) twShard(f, f.x, f.y, b + s * Math.PI / 2, twDmg(f, P, 0.15), sk.color || '#ffffff', { speed: 380 }); }); }, desc: () => 'Fires spikes sideways during the dash' },
  dashQuake: { meta: ['crack-line'], post(f, sk, a, P) { after(0.6, () => { if (!f.alive) return; const b = datan2(f.vy, f.vx); for (let i = 1; i <= 4; i++) supStrike(f, f.x + dcos(b) * i * 60, f.y + dsin(b) * i * 60, 0.12 + i * 0.07, 48, twDmg(f, P, 0.2), sk.color || '#c08a4a', { kind: 'meteor' }); }); }, desc: () => 'Ends with a line of ground cracks erupting ahead' },
  dashTwice: { meta: ['double-dash'], post(f, sk, a, P, t) { after(a.d || 0.75, () => { if (!f.alive || !t || !t.alive) return; const an = angTo(f, t), sp = f.baseSpeed * 2.1; f.vx = dcos(an) * sp; f.vy = dsin(an) * sp; f.st.dash = 0.45; f.dashEffect = sk.effect; f.dashPow = sk.power; }); }, desc: () => 'Dashes a second time' },
  dashWind: { meta: ['wind-wake'], post(f) { sx(f).windT = 0.8; }, desc: () => 'Its wake shoves enemies aside' },
  blinkChain: { meta: ['multi-blink'], post(f, sk, a, P, t) { after(0.35, () => { if (!f.alive) return; const es = supEnemies(f).filter(e => e !== t); const e = es[0] || t; if (!e || !e.alive) return; if (!FX.off) FX.burst(f.x, f.y, sk.color || '#ffffff', 12, 240); f.x = inArenaX(e.x - (e.vx || 1) / (len(e.vx, e.vy) || 1) * (e.r + f.r + 26), f.r); f.y = inArenaY(e.y - (e.vy || 0) / (len(e.vx, e.vy) || 1) * (e.r + f.r + 26), f.r); _dealDamage26(f, e, twDmg(f, P, 0.35), { kind: 'skill', tag: 'skill', effect: sk.effect }); if (!FX.off) FX.burst(f.x, f.y, sk.color || '#ffffff', 16, 260); }); }, desc: () => 'Blinks again to strike a second time' },
  swapPlace: { meta: ['position-swap'], post(f, sk, a, P, t) { if (!t || t.boss || t.anchored) return; const x = f.x, y = f.y; f.x = t.x; f.y = t.y; t.x = x; t.y = y; if (!FX.off) FX.bolt(f.x, f.y, t.x, t.y, sk.color || '#ffffff', 3, 0.3); }, desc: () => 'Swaps places with the target' },
  blinkShield: { meta: ['arrival-shield'], post(f) { f.st.shield = Math.max(f.st.shield, 1.5); f.st.shieldPow = Math.max(f.st.shieldPow, 0.45); }, desc: () => 'Arrives behind a shield' },
  blinkShock: { meta: ['arrival-wave'], post(f, sk, a, P) { supWave(f, f.x, f.y, 180, twDmg(f, P, a.k || 0.35), sk.color || '#ffffff', { force: 380 }); }, desc: () => 'Arrives with a shockwave' },
  blinkTrap: { meta: ['origin-trap'], post(f, sk, a, P) { const o = f.castFrom; if (!o) return; twMiniZone(f, o.x, o.y, 70, 4, twDmg(f, P, 0.1), sk.color || '#ffffff', a.eff || 'slow'); }, desc: () => 'Leaves a trap where it vanished' },
  blinkVolley: { meta: ['arrival-volley'], post(f, sk, a, P, t) { for (let i = 0; i < (a.n || 3); i++) twShard(f, f.x, f.y, rand(TAU), twDmg(f, P, 0.2), sk.color || '#ffffff', { speed: 430, homing: 4, life: 1.4, target: t }); }, desc: () => 'Arrives firing a volley of seeking bolts' },
  blinkEcho: { meta: ['return-blink'], post(f, sk) { const back = f.castFrom ? { ...f.castFrom } : null; if (!back) return; after(1.4, () => { if (!f.alive) return; if (!FX.off) FX.burst(f.x, f.y, sk.color || '#ffffff', 12, 220); f.x = inArenaX(back.x, f.r); f.y = inArenaY(back.y, f.r); }); }, desc: () => 'Snaps back to where it started 1.4 s later' },
  // summons and specials
  cloneBoom: { meta: ['exploding-clones'], post(f, sk, a, P) { for (const c of BATTLE.fighters) if (c.isClone && c.owner === f && c.alive && !c.boom26) c.boom26 = twDmg(f, P, a.k || 0.5); }, desc: () => 'Its clones explode when they vanish' },
  cloneVolley: { meta: ['clone-volley'], post(f, sk, a, P) { for (const c of BATTLE.fighters) if (c.isClone && c.owner === f && c.alive) { const t = nearestEnemy(c); if (t) twShard(c, c.x, c.y, angTo(c, t), twDmg(f, P, 0.25), sk.color || '#ffffff', { speed: 520, homing: 3, target: t, life: 1.5 }); } }, desc: () => 'Each clone fires a bolt as it appears' },
  cloneLink: { meta: ['clone-heal'], post(f) { for (const c of BATTLE.fighters) if (c.isClone && c.owner === f && c.alive) c.link26 = true; }, desc: () => 'Damage its clones deal heals the caster' },
  cloneTaunt: { meta: ['taunt'], post(f) { const cl = BATTLE.fighters.filter(c => c.isClone && c.owner === f && c.alive); if (!cl.length) return; for (const e of supEnemies(f)) if (!e.boss && e.ai) e.target = cl[0]; }, desc: () => 'Enemies are forced to target its clones' },
  cloneShield: { meta: ['clone-guard'], post(f) { sx(f).cguardT = 4; }, desc: () => 'While clones live, they take part of the damage aimed at the caster' },
  cloneHaste: { meta: ['clone-speed'], post(f) { for (const c of BATTLE.fighters) if (c.isClone && c.owner === f && c.alive) { c.st.buff = 4; c.st.buffPow = 0.3; } }, desc: () => 'Its clones are faster and hit harder' },
  shatterStop: { meta: ['end-shatter'], post(f, sk, a, P) { const dur = Math.min(2.2, 0.9 + (sk.power || 50) / 70); const hit = supEnemies(f); after(dur, () => { if (!f.alive) return; for (const e of hit) if (e.alive) { _dealDamage26(f, e, twDmg(f, P, a.k || 0.4), { kind: 'skill', tag: 'skill' }); if (!FX.off) FX.burst(e.x, e.y, '#e1f5fe', 14, 280, 5, 0.4, 'shard'); } }); }, desc: () => 'When time resumes, frozen enemies shatter for damage' },
  stopHeal: { meta: ['stop-heal'], post(f, sk, a) { healFighter(f, f.maxHp * (a.k || 0.08)); }, desc: () => 'The caster recovers while time is stopped' },
  stopPull: { meta: ['stop-gather'], post(f) { for (const e of supEnemies(f)) if (!e.boss) { const an = datan2(f.y - e.y, f.x - e.x); e.x = inArenaX(e.x + dcos(an) * 90, e.r); e.y = inArenaY(e.y + dsin(an) * 90, e.r); } }, desc: () => 'Stopped enemies are dragged closer' },
  stopMark: { meta: ['stop-mark'], post(f, sk, a, P) { for (const e of supEnemies(f)) { const s = sx(e); s.markT = 2.4; s.markD = twDmg(f, P, a.k || 0.35); s.markBy = f; } }, desc: () => 'Every stopped enemy is marked for a delayed blast' },
  rebirthBlast: { meta: ['revive-blast'], post(f, sk, a, P) { supWave(f, f.x, f.y, 280, twDmg(f, P, a.k || 0.6), sk.color || '#ffffff', { force: 700 }); }, desc: () => 'Coming back to life releases a blast' },
  rebirthShield: { meta: ['revive-shield'], post(f) { f.st.shield = Math.max(f.st.shield, 3); f.st.shieldPow = Math.max(f.st.shieldPow, 0.5); }, desc: () => 'Comes back shielded' },
  rebirthHaste: { meta: ['revive-speed'], post(f) { f.st.buff = Math.max(f.st.buff, 4); f.st.buffPow = Math.max(f.st.buffPow, 0.25); }, desc: () => 'Comes back powered up' },
  rebirthCleanse: { meta: ['revive-cleanse'], post(f) { f.ccImm = Math.max(f.ccImm || 0, 2.5); for (const s of f.skills) s.cdLeft = Math.min(s.cdLeft, 1); }, desc: () => 'Comes back unstoppable with its abilities ready' },
  copyAmp: { meta: ['copy-empower'], post(f) { if (f.temp) f.temp.power = (f.temp.power || 50) * 1.2; }, desc: () => 'The copied ability is 20% stronger' },
  copyTwice: { meta: ['copy-double'], post(f) { if (f.temp) after(1.2, () => { if (f.alive && f.temp) { f.temp.cdLeft = 0; useSkill(f, f.temp); } }); }, desc: () => 'Casts the copied ability twice' },
  copySteal: { meta: ['copy-lock'], post(f, sk, a, P, t) { if (!t) return; for (const s of t.skills || []) if (f.temp && s.name === f.temp.name.replace('⧉ ', '')) s.cdLeft = Math.max(s.cdLeft, 3); }, desc: () => 'The enemy loses that ability for 3 s' },
  reflectWave: { meta: ['end-wave'], post(f, sk, a, P) { after(2 + (sk.power || 50) / 40, () => { if (f.alive) supWave(f, f.x, f.y, 200, twDmg(f, P, 0.35), '#ffffff', { force: 500 }); }); }, desc: () => 'When the reflection ends, a mirror wave bursts out' },
  reflectStun: { meta: ['reflect-stun'], post(f, sk) { sx(f).rstunT = 2 + (sk.power || 50) / 40; }, desc: () => 'Shots it reflects stun their owner' },
  phaseBoom: { meta: ['decoy-blast'], post(f, sk, a, P) { for (const c of BATTLE.fighters) if (c.isClone && c.owner === f && c.alive && !c.boom26) c.boom26 = twDmg(f, P, a.k || 0.45); }, desc: () => 'The illusion it leaves explodes' },
  adaptHeal: { meta: ['adapt-shield'], post(f) { f.st.shield = Math.max(f.st.shield, 2.5); f.st.shieldPow = Math.max(f.st.shieldPow, 0.35); }, desc: () => 'Adapting also raises a shield' },
  // explosions
  doubleBlast: { meta: ['second-blast'], post(f, sk, a, P) { after(a.d || 0.5, () => { if (f.alive) explodeAt(f, f.x, f.y, (130 + P * 1.1) * 0.7, twDmg(f, P, a.k || 0.45), sk.color || '#ffffff', sk.effect, 400, P); }); }, desc: () => 'A second, smaller blast follows' },
  vacuumBlast: { meta: ['pre-pull'], post(f, sk, a) { for (const e of foesNear(f, f.x, f.y, a.r || 320)) knock(e, f.x, f.y, -(a.f || 800)); }, desc: () => 'Sucks enemies in before they are thrown out' },
  shrapnel: { meta: ['radial-shards'], post(f, sk, a, P) { const n = a.n || 8; for (let i = 0; i < n; i++) twShard(f, f.x, f.y, i / n * TAU, twDmg(f, P, 0.18), sk.color || '#ffffff', { speed: 460, life: 0.9, effect: sk.effect }); }, desc: a => `Sprays ${a.n || 8} shards in every direction` },
  craterPost: { meta: ['blast-crater'], post(f, sk, a, P) { twMiniZone(f, f.x, f.y, a.r || 110, a.t || 3, twDmg(f, P, 0.06), sk.color || '#ffffff', a.eff || sk.effect || 'slow'); }, desc: () => 'Leaves a crater of hazardous ground' },
  blastShield: { meta: ['blast-guard'], post(f) { f.st.shield = Math.max(f.st.shield, 1.8); f.st.shieldPow = Math.max(f.st.shieldPow, 0.4); }, desc: () => 'The blast also shields the caster' },
  wallSlam: { meta: ['wall-slam'], post(f, sk, a, P) { for (const e of foesNear(f, f.x, f.y, 260)) { sx(e).slamT = 0.8; sx(e).slamBy = f; sx(e).slamD = twDmg(f, P, a.k || 0.35); } }, desc: () => 'Enemies blasted into a wall take slam damage' },
  ringBlast: { meta: ['outer-ring'], post(f, sk, a, P) { const R = a.r || 300, n = 10; for (let i = 0; i < n; i++) { const an = i / n * TAU; supStrike(f, f.x + dcos(an) * R, f.y + dsin(an) * R, 0.5, 55, twDmg(f, P, 0.3), sk.color || '#ffffff', { kind: 'meteor', effect: sk.effect }); } }, desc: () => 'A second ring of blasts erupts farther out' },
  quakeLines: { meta: ['crack-lasers'], post(f, sk, a, P) { for (let i = 0; i < 4; i++) { const an = i / 4 * TAU + rand(0.6), e = rayToWall(f.x, f.y, an); addLaser(f, [f.x, f.y, e.x, e.y], { charge: 0.4, dur: 0.18, w: 12, dmg: twDmg(f, P, 0.3), col: sk.color || '#ffffff' }); } }, desc: () => 'Cracks race out to the walls in four directions' },
});

/* world hook: twist states (zones, orbs, statuses) — deterministic */
SUP.worldHooks.push((B, h) => {
  for (const z of B.zones) {
    if (!z.owner) continue;
    const o = z.owner;
    if (z.mine26 && z.life > 0) for (const e of supEnemies(o)) if (len(e.x - z.x, e.y - z.y) < z.r + e.r) { supBlast(o, z.x, z.y, 85, z.mine26, { tag: 'explosion', force: 380 }); if (!FX.off) { FX.burst(z.x, z.y, z.col, 22, 360, 6, 0.5); FX.ring(z.x, z.y, z.col, 85, 0.35, 6, 10); } z.life = 0; z.mine26 = 0; break; }
    if (z.root26 && !z.rooted) for (const e of supEnemies(o)) if (!e.boss && len(e.x - z.x, e.y - z.y) < z.r + e.r * 0.5) { z.rooted = true; sx(e).rootT = z.root26; e.vx = e.vy = 0; if (!FX.off) FX.text(e.x, e.y - e.r - 26, 'ROOTED', z.col, 13, { life: 0.6 }); break; }
    if (z.grow26 && z.r < z.r0 * 1.7) z.r += z.r0 * z.grow26 * h;
    if (z.drift26) { const t = nearestEnemy(o); if (t) { const d = len(t.x - z.x, t.y - z.y) || 1; z.x = inArenaX(z.x + (t.x - z.x) / d * z.drift26 * h, 10); z.y = inArenaY(z.y + (t.y - z.y) / d * z.drift26 * h, 10); } }
    if (z.lure26) for (const e of supEnemies(o)) { const d = len(e.x - z.x, e.y - z.y); if (d < z.r * 1.4 && d > 4) { e.vx += (z.x - e.x) / d * z.lure26 * h; e.vy += (z.y - e.y) / d * z.lure26 * h; } }
    if (z.shard26) { z.shT = (z.shT || 0) - h; if (z.shT <= 0) { z.shT = z.shard26; const e = supEnemies(o).find(e => len(e.x - z.x, e.y - z.y) < z.r + e.r); if (e) twShard(o, z.x, z.y, datan2(e.y - z.y, e.x - z.x), (z.dmg || twDmg(o, 50, 0.1)) * 2, z.col, { speed: 520, homing: 4, target: e }); } }
    if (z.ally26) for (const a of B.fighters) if (a.alive && a.team === o.team && !a.isClone && len(a.x - z.x, a.y - z.y) < z.r + a.r) healFighter(a, a.maxHp * z.ally26 * h, true);
    if (z.crush26) for (const e of supEnemies(o)) { const d = len(e.x - z.x, e.y - z.y); if (d < 110 && twReady(e, 'crush', 0.5)) _dealDamage26(o, e, (z.dmg || 2) * z.crush26 * (1 - d / 110) * 2, { kind: 'skill', tag: 'zone', noCrit: true }); }
    if (z.zap26) { z.zT = (z.zT || 0) - h; if (z.zT <= 0) { z.zT = z.zap26; for (const e of supEnemies(o)) if (len(e.x - z.x, e.y - z.y) < z.r + e.r) { e.st.slow = Math.max(e.st.slow, 0.5); if (!FX.off) FX.bolt(z.x, z.y, e.x, e.y, z.col, 2, 0.2); } } }
    if (z.eat26) for (let k = B.projs.length - 1; k >= 0; k--) { const p = B.projs[k]; if (p.team !== z.team && !p.ult && dist2(p.x, p.y, z.x, z.y) < (z.r * 1.3) * (z.r * 1.3)) { if (!FX.off) FX.burst(p.x, p.y, z.col, 5, 140, 3, 0.3); B.projs.splice(k, 1); } }
    if ((z.det26 || z.repel26) && z.life <= h * 1.5 && !z.end26) { z.end26 = true;
      if (z.det26) { supBlast(o, z.x, z.y, z.r + 30, (z.dmg || 2) * z.det26 * 4, { tag: 'explosion', force: 420 }); if (!FX.off) { FX.burst(z.x, z.y, z.col, 30, 420, 6, 0.6); FX.ring(z.x, z.y, z.col, z.r + 30, 0.4, 8, 10); } }
      if (z.repel26) { for (const e of foesNear(o, z.x, z.y, z.r + 60)) knock(e, z.x, z.y, z.repel26); if (!FX.off) FX.ring(z.x, z.y, '#ffffff', z.r + 60, 0.4, 6, 10); } }
  }
  for (const b of B.orbs) {
    if (b.exp26 && b.rad < 220) b.rad += b.exp26 * h;
    if (b.block26 > 0) for (let i = 0; i < b.n && b.block26 > 0; i++) { const a = b.ang + i / b.n * TAU, ox = b.owner.x + dcos(a) * b.rad, oy = b.owner.y + dsin(a) * b.rad;
      for (let k = B.projs.length - 1; k >= 0; k--) { const p = B.projs[k]; if (p.team !== b.team && !p.ult && dist2(p.x, p.y, ox, oy) < (p.r + 14) * (p.r + 14)) { B.projs.splice(k, 1); b.block26--; if (!FX.off) FX.burst(ox, oy, b.col, 6, 180, 3, 0.3); break; } } }
    if (b.launch26 && b.life <= h * 1.5 && !b.done26) { b.done26 = true; const t = nearestEnemy(b.owner); if (t) for (let i = 0; i < b.n; i++) { const a = b.ang + i / b.n * TAU; twShard(b.owner, b.owner.x + dcos(a) * b.rad, b.owner.y + dsin(a) * b.rad, datan2(t.y - b.owner.y, t.x - b.owner.x), b.dmg * 0.8, b.col, { speed: 520, homing: 4, target: t, life: 1.6 }); } }
  }
  for (const f of B.fighters) {
    const s = f.sx; if (!s || !f.alive) continue;
    if (s.markD && s.markT <= h * 1.5) { s.markT = 0; const by = s.markBy && s.markBy.alive ? s.markBy : null; _dealDamage26(by, f, s.markD, { kind: 'skill', tag: 'explosion', noCrit: true }); s.markD = 0; if (!FX.off) { FX.ring(f.x, f.y, '#ff8a80', f.r * 2.4, 0.35, 6, f.r); FX.burst(f.x, f.y, '#ff8a80', 16, 300, 5, 0.4); } }
    if (s.bleedT > 0 && s.bleedD) { s.blT = (s.blT || 0) - h; if (s.blT <= 0) { s.blT = 0.5; _dealDamage26(s.bleedBy || null, f, s.bleedD, { kind: 'dot', noCrit: true }); } } else s.bleedD = 0;
    if (s.tethT > 0 && s.tethBy && s.tethBy.alive) { const o = s.tethBy, d = len(f.x - o.x, f.y - o.y); if (d > 330 && twReady(f, 'teth', 0.8)) { knock(f, o.x, o.y, -700); _dealDamage26(o, f, twDmg(o, 50, 0.25), { kind: 'skill', noCrit: true }); if (!FX.off) FX.bolt(o.x, o.y, f.x, f.y, '#b388ff', 3, 0.3); } }
    if (s.rootT > 0) { f.vx *= 0.2; f.vy *= 0.2; }
    if (s.steadyT > 0) { const sp = len(f.vx, f.vy), mx = f.baseSpeed * 1.4; if (sp > mx) { f.vx *= mx / sp; f.vy *= mx / sp; } }
    if (s.regenT > 0) healFighter(f, f.maxHp * (s.regenK || 0.015) * h, true);
    if (s.critT <= 0 && s.critB) { f.crit -= s.critB; s.critB = 0; }
    if (s.repelT > 0) for (const e of supEnemies(f)) { const d = len(e.x - f.x, e.y - f.y); if (d < 170 && d > 1) { e.vx += (e.x - f.x) / d * 900 * h; e.vy += (e.y - f.y) / d * 900 * h; } }
    if (s.slowAT > 0) for (const e of supEnemies(f)) if (len(e.x - f.x, e.y - f.y) < 190) e.st.slow = Math.max(e.st.slow, 0.3);
    if (s.eatT > 0 && s.eatN > 0) for (let k = B.projs.length - 1; k >= 0; k--) { const p = B.projs[k]; if (p.team !== f.team && !p.ult && dist2(p.x, p.y, f.x, f.y) < (f.r + 40) * (f.r + 40)) { B.projs.splice(k, 1); s.eatN--; if (!FX.off) FX.burst(p.x, p.y, '#80d8ff', 6, 180, 3, 0.3); if (s.eatN <= 0) break; } }
    if ((s.trailT > 0) && (s.trT = (s.trT || 0) - h) <= 0) { s.trT = 0.14; if (B.zones.length < 48) twMiniZone(f, f.x, f.y, 28, 1.3, twDmg(f, 40, 0.06), f.def.design.c3, s.trailE || 'none'); }
    if (s.windT > 0) for (const e of supEnemies(f)) { const d = len(e.x - f.x, e.y - f.y); if (d < 120 && d > 1) { e.vx += (e.x - f.x) / d * 1200 * h; e.vy += (e.y - f.y) / d * 1200 * h; } }
    if (s.carryT > 0 && s.carry && s.carry.alive && !s.carry.boss && len(s.carry.x - f.x, s.carry.y - f.y) < f.r + s.carry.r + 30) { s.carry.vx = f.vx * 0.9; s.carry.vy = f.vy * 0.9; }
    if (s.slamT > 0 && s.slamD) { const w = f.x - f.r <= ARENA.x + 2 || f.x + f.r >= ARENA.r - 2 || f.y - f.r <= ARENA.y + 2 || f.y + f.r >= ARENA.b - 2; if (w) { _dealDamage26(s.slamBy && s.slamBy.alive ? s.slamBy : null, f, s.slamD, { kind: 'skill', tag: 'collision', noCrit: true }); s.slamD = 0; s.slamT = 0; if (!FX.off) { FX.text(f.x, f.y - f.r - 26, 'WALL SLAM', '#ffab40', 14, { life: 0.6 }); FX.addShake(5); } } }
  }
});
MOD26.push((f, s, m) => { if (s.swiftT > 0) m.spd *= s.swiftK || 1.25; });
SUP.steerHooks.push(f => { const s = f.sx; if (s && s.confT > 0 && !f.isClone) { f.steerX = -f.steerX; f.steerY = -f.steerY; } });
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const t = tgt.sx, s = src && src.sx;
  if (t) {
    if (t.sunderT > 0 && o.kind !== 'dot') amt *= 1 + (t.sunderK || 0.15);
    if (t.armorT > 0 && o.kind !== 'dot') amt *= 0.5;
    if (t.cguardT > 0 && o.kind !== 'dot') { const c = BATTLE.fighters.find(c => c.isClone && c.owner === tgt && c.alive); if (c) { const take = amt * 0.4; c.hp -= take; if (c.hp <= 0) killFighter(c, src); amt -= take; } }
    if (t.storeT > 0 && tgt.st.shield > 0) t.store = (t.store || 0) + amt * tgt.st.shieldPow;
    if (t.chargeGT > 0 && tgt.st.shield > 0 && !tgt.isClone) tgt.ultMeter = Math.min(100, tgt.ultMeter + amt * 0.6);
    if (t.thornsT > 0 && src && src.alive && src !== tgt && o.kind !== 'dot' && twReady(tgt, 'thorn' + src.sid, 0.3)) after(0, () => { if (src.alive) _dealDamage26(tgt, src, amt * (t.thornsK || 0.3), { kind: 'skill', tag: 'collision', noCrit: true }); });
  }
  if (s && s.lsT > 0 && src.alive && o.kind !== 'dot') healFighter(src, amt * (s.lsK || 0.15), true);
  if (src && src.link26 && src.owner && src.owner.alive) healFighter(src.owner, amt * 0.4, true);
  return amt;
});
SUP.collideHooks.push((a, b) => {
  const s = a.sx; if (!s) return;
  if (s.frostT > 0 && twReady(b, 'frost' + a.sid, 2)) applyEffect(a, b, 'freeze', 55);
  if (s.stunGT > 0 && twReady(b, 'stung' + a.sid, 2.5) && !b.boss) { b.st.stun = Math.max(b.st.stun, 0.4); if (!FX.off) FX.text(b.x, b.y - b.r - 24, 'STUNNED', '#fff27a', 13, { life: 0.5 }); }
});
SUP.deathHooks.push(f => { if (f.boom26 && BATTLE && f.owner) { supBlast(f.owner, f.x, f.y, 120, f.boom26, { tag: 'explosion', force: 420 }); if (!FX.off) { FX.burst(f.x, f.y, f.def.design.c3, 26, 380, 6, 0.6); FX.ring(f.x, f.y, f.def.design.c3, 120, 0.35, 6, 10); } } });
/* =====================================================================
   2.6.0 SIGNATURES — every classic ability gets its own signature mechanic (audited: no two abilities of the same
   type share one), and every classic ultimate its own extra phase (no two ultimates of the same kind play alike).
   [uid, expected type, twist, signature name, params]
   ===================================================================== */
[
  // ---- projectiles ----
  ['fire.0', 'projectile', 'ember', 'Ember Scatter', { eff: 'burn' }], ['earth.0', 'projectile', 'ricochet', 'Skipping Stone', { n: 2 }], ['dark.2', 'projectile', 'leech', 'Night Siphon'],
  ['plasma.0', 'projectile', 'split', 'Plasma Fission', { n: 3 }], ['spider.0', 'projectile', 'tether', 'Silk Line'], ['vampire.0', 'projectile', 'bleed', 'Open Wound'],
  ['zombie.1', 'projectile', 'spreadDot', 'Contagion'], ['nuclear.1', 'projectile', 'sticky', 'Fission Charge'], ['time.2', 'projectile', 'echoHit', 'Time Echo'],
  ['demon.0', 'projectile', 'grow', 'Hellfire Swell'], ['demon.2', 'projectile', 'execute', 'Soul Reaping'], ['chaos.0', 'projectile', 'zigzag', 'Chaotic Path'],
  ['destroyer.0', 'projectile', 'pierce', 'Annihilation Line', { n: 2 }], ['frostcrown.0', 'projectile', 'shatter', 'Glacial Shatter'], ['glitchgod.2', 'projectile', 'cripple', 'Corrupted Cooldowns'],
  ['devourer.0', 'projectile', 'gravOrb', 'Hungry Maw'], ['toxicreactor.2', 'projectile', 'frostTrail', 'Isotope Trail', { eff: 'poison' }],
  // ---- multi-shots ----
  ['ice.0', 'multishot', 'chill', 'Deep Chill', { n: 3 }], ['wind.0', 'multishot', 'boomerang', 'Returning Gale'], ['poison.0', 'multishot', 'stackPoison', 'Venom Stack'],
  ['laser.1', 'multishot', 'pierce', 'Penetrating Grid', { n: 1 }], ['crystal.0', 'multishot', 'ricochet', 'Bouncing Facets', { n: 1 }], ['shadow.2', 'multishot', 'blind', 'Night Blindness'],
  ['galaxy.0', 'multishot', 'orbitFirst', 'Orbiting Stars'], ['nebula.1', 'multishot', 'frostTrail', 'Dust Trail', { eff: 'slow' }], ['phoenix.0', 'multishot', 'ember', 'Burning Plumes', { eff: 'burn' }],
  ['infinity.1', 'multishot', 'refund', 'Endless Reload', { s: 1 }], ['reality.2', 'multishot', 'confuse', 'Glitched Controls'], ['unknown.2', 'multishot', 'zigzag', 'Unreadable Path'],
  ['aurora.1', 'multishot', 'accel', 'Polar Gust'], ['glitch.0', 'multishot', 'fork', 'Pixel Split'], ['sakura.0', 'multishot', 'lateHome', 'Drifting Petals'],
  ['chaosemperor.0', 'multishot', 'spreadDot', 'Elemental Spread'], ['celestialdragon.1', 'multishot', 'grow', 'Swelling Starfire'], ['glitchgod.0', 'multishot', 'hush', 'Pixel Mute'],
  ['adminsupreme.2', 'multishot', 'sunder', 'Supreme Erosion'], ['prism.1', 'multishot', 'split', 'Spectrum Split', { n: 2 }], ['mirror.2', 'multishot', 'spin', 'Mirror Spin'],
  // ---- homing ----
  ['thunder.2', 'homing', 'chain', 'Arc Chain', { col: '#fff27a' }], ['dark.0', 'homing', 'mark', 'Shadow Mark', { col: '#9d4dff' }], ['vampire.1', 'homing', 'scatter', 'Bat Scatter', { col: '#ff1a3c' }],
  ['magnet.1', 'homing', 'hook', 'Magnetic Hook'], ['star.0', 'homing', 'split', 'Twinkling Split', { n: 2 }], ['dimension.1', 'homing', 'fork', 'Dimensional Fork'],
  ['celestial.1', 'homing', 'orbitFirst', 'Constellation Ring'], ['seraphim.0', 'homing', 'ember', 'Seraph Embers', { eff: 'burn' }], ['soul.0', 'homing', 'leech', 'Soul Siphon'],
  ['phantom.2', 'homing', 'pierce', 'Phantom Pierce', { n: 2 }], ['chronos.2', 'homing', 'echoHit', 'Temporal Echo'], ['magnetar.2', 'homing', 'shove', 'Polar Repulse'], ['rift.1', 'homing', 'tether', 'Rift Tether'],
  // ---- beams ----
  ['water.0', 'beam', 'shove', 'Pressure Jet', { f: 600 }], ['light.0', 'beam', 'blind', 'Dazzling Ray'], ['plasma.2', 'beam', 'focus', 'Ion Charge'], ['laser.0', 'beam', 'refract', 'Ricochet Laser'],
  ['judgment.0', 'beam', 'mark', 'Verdict Mark', { col: '#ffcc00' }], ['crystal.2', 'beam', 'prism', 'True Refraction'], ['galaxy.1', 'beam', 'sweep', 'Cosmic Sweep'], ['blackhole.1', 'beam', 'hook', 'Spaghettification'],
  ['quantum.2', 'beam', 'twin', 'Entangled Pair'], ['eclipse.2', 'beam', 'sunder', 'Umbral Erosion'], ['celestial.0', 'beam', 'pierceGuard', 'Lance Through'], ['dragon.0', 'beam', 'afterburn', 'Scorched Earth', { eff: 'burn' }],
  ['angel.0', 'beam', 'drain', 'Mercy Ray', { k: 0.25 }], ['divine.0', 'beam', 'execute', 'Divine Verdict'], ['ancientgod.0', 'beam', 'widen', 'Primordial Breadth'], ['omniverse.1', 'beam', 'scatter', 'Omni Scatter'],
  ['creator.2', 'beam', 'linger', 'Lingering Dawn'], ['aurora.0', 'beam', 'chill', 'Polar Glow', { n: 2 }], ['celestialdragon.0', 'beam', 'spreadDot', 'Starfire Spread'], ['creatorgod.1', 'beam', 'ultFeed', 'Creative Spark'],
  ['prism.0', 'beam', 'breakShield', 'Prismatic Break'], ['magnetar.1', 'beam', 'cripple', 'Flux Overload'],
  // ---- shockwaves ----
  ['fire.2', 'shockwave', 'echoWave', 'Twin Inferno'], ['water.2', 'shockwave', 'slowRing', 'Undertow'], ['dark.1', 'shockwave', 'vacuum', 'Void Pull'], ['magnet.2', 'shockwave', 'clearShots', 'Repulsion Field'],
  ['blackhole.2', 'shockwave', 'implode', 'Hawking Collapse'], ['universe.2', 'shockwave', 'aftershock', 'Expanding Universe'], ['dimension.2', 'shockwave', 'spikeRing', 'Folded Space'], ['eclipse.0', 'shockwave', 'edgeStun', 'Corona Edge'],
  ['seraphim.1', 'shockwave', 'healWave', 'Sacred Mercy'], ['oneaboveall.2', 'shockwave', 'sunder', 'Reality Fracture'], ['absolute.0', 'shockwave', 'stagger', 'Absolute Halt'], ['infinitycore.3', 'shockwave', 'ultFeed', 'Core Resonance'],
  ['miracle.3', 'shockwave', 'blind', 'Radiant Glare'], ['toxicreactor.1', 'shockwave', 'stackPoison', 'Isotope Wave'], ['sonic.0', 'shockwave', 'hush', 'Deafening Boom'],
  // ---- explosions ----
  ['earth.2', 'explosion', 'quakeLines', 'Fault Lines'], ['light.1', 'explosion', 'confuse', 'Afterimage Daze'], ['poison.2', 'explosion', 'craterPost', 'Plague Ground', { eff: 'poison' }], ['judgment.2', 'explosion', 'wallSlam', 'Penitent Slam'],
  ['nuclear.2', 'explosion', 'doubleBlast', 'Chain Reaction'], ['gravity.1', 'explosion', 'vacuumBlast', 'Implosion'], ['universe.0', 'explosion', 'ringBlast', 'Cosmic Rings'], ['star.1', 'explosion', 'shrapnel', 'Solar Fragments'],
  ['ancientgod.2', 'explosion', 'echoHit', 'Titan Aftershock'], ['destroyer.1', 'explosion', 'execute', 'Ruination'], ['solarflare.0', 'explosion', 'blastShield', 'Flare Guard'], ['glitchgod.3', 'explosion', 'cripple', 'Fatal Exception'],
  ['chronos.3', 'explosion', 'sunder', 'Erosion of Ages'], ['devourer.3', 'explosion', 'killNova', 'Gorge Burst'],
  // ---- dashes ----
  ['fire.1', 'dash', 'dashTrail', 'Fire Trail', { eff: 'burn' }], ['thunder.1', 'dash', 'chain', 'Arc Dash', { col: '#ffe14d' }], ['spider.2', 'dash', 'stackPoison', 'Double Fang'], ['vampire.2', 'dash', 'bleed', 'Crimson Cut'],
  ['zombie.0', 'dash', 'spreadDot', 'Plague Bite'], ['gravity.2', 'dash', 'dashHook', 'Mass Drag'], ['dragon.1', 'dash', 'dashShock', 'Dragon Landing'], ['phoenix.2', 'dash', 'rebound', 'Phoenix Rebound'],
  ['immortal.1', 'dash', 'dashArmor', 'Undying Charge'], ['destroyer.2', 'dash', 'dashQuake', 'Doom Furrow'], ['absolute.2', 'dash', 'afterimage', 'Absolute Echo'], ['bloodmoon.0', 'dash', 'execute', 'Lunar Execution'],
  ['solarflare.2', 'dash', 'dashSpikes', 'Corona Spikes'], ['sakura.2', 'dash', 'dashSplit', 'Spirit Petals'], ['celestialdragon.2', 'dash', 'dashTwice', 'Twin Ascent'], ['devourer.2', 'dash', 'leech', 'Hunger'],
  ['adminsupreme.3', 'dash', 'breakShield', 'Supreme Breaker'], ['sonic.1', 'dash', 'dashWind', 'Sonic Wake'],
  // ---- shields ----
  ['ice.1', 'shield', 'frostArmor', 'Frostbite Shell'], ['earth.1', 'shield', 'rootGuard', 'Bedrock'], ['crystal.1', 'shield', 'mirrorGuard', 'Prismatic Facets'], ['galaxy.2', 'shield', 'orbitGuard', 'Orbiting Moons'],
  ['eclipse.1', 'shield', 'phaseGuard', 'Umbral Fade'], ['celestial.2', 'shield', 'wardAllies', 'Heaven’s Canopy'], ['dragon.2', 'shield', 'thorns', 'Spiked Scales'], ['angel.2', 'shield', 'healGuard', 'Guardian’s Grace'],
  ['seraphim.2', 'shield', 'shieldBurst', 'Seraph Burst'], ['infinity.2', 'shield', 'growGuard', 'Endless Layers'], ['soul.2', 'shield', 'absorbHeal', 'Soul Reservoir'], ['absolute.1', 'shield', 'stunGuard', 'Immovable Object'],
  ['bloodmoon.2', 'shield', 'decoyGuard', 'Moon Double'], ['frostcrown.1', 'shield', 'slowAura', 'Winter’s Court'], ['glitch.1', 'shield', 'eatShots', 'Packet Filter'], ['infinitycore.0', 'shield', 'chargeGuard', 'Core Capacitor'],
  ['celestialdragon.3', 'shield', 'lanceGuard', 'Star Lance Retort'], ['miracle.1', 'shield', 'cleanseImm', 'Blessed Purity'], ['creatorgod.2', 'shield', 'pulseGuard', 'World Pulse'], ['adminsupreme.1', 'shield', 'pushAura', 'Supreme Repulsion'],
  // ---- heals ----
  ['water.1', 'heal', 'regen', 'Rising Tide'], ['light.2', 'heal', 'healPulse', 'Searing Light'], ['star.2', 'heal', 'healCharge', 'Starlight Charge'], ['time.1', 'heal', 'blinkHome', 'Safe Rewind'],
  ['angel.1', 'heal', 'allyHeal', 'Shared Blessing'], ['divine.1', 'heal', 'bloom', 'Sanctuary Ground'], ['immortal.2', 'heal', 'lastStand', 'Defiant Bloom'], ['creator.0', 'heal', 'healRefresh', 'Genesis Renewal'],
  ['reality.1', 'heal', 'healReflect', 'Rewritten Fate'], ['aurora.2', 'heal', 'overShield', 'Aurora Mantle'], ['sakura.1', 'heal', 'purify', 'Cherry Cleanse'], ['infinitycore.1', 'heal', 'lifeLink', 'Endless Link'],
  ['miracle.0', 'heal', 'cleanseImm', 'Miracle Resolve'], ['creatorgod.3', 'heal', 'healBlast', 'Spring Surge'], ['chronos.1', 'heal', 'healHaste', 'Accelerated Time'],
  // ---- traps / gravity ----
  ['ice.2', 'trap', 'spread', 'Spreading Blizzard'], ['poison.1', 'trap', 'drift', 'Creeping Pool'], ['spider.1', 'trap', 'root', 'Sticky Snare'], ['nuclear.0', 'trap', 'detonate', 'Critical Leak'],
  ['nebula.0', 'trap', 'lure', 'Nebular Drift'], ['chaos.1', 'trap', 'confuse', 'Entropic Daze'], ['unknown.1', 'trap', 'hush', 'Null Silence'], ['frostcrown.2', 'trap', 'shardZone', 'Hailstorm'],
  ['solarflare.1', 'trap', 'mines', 'Sunspot Mines', { n: 3 }], ['chaosemperor.3', 'trap', 'shotPull', 'Entropy Sink'], ['toxicreactor.0', 'trap', 'stackPoison', 'Reactor Overflow'], ['rift.2', 'trap', 'tether', 'Torn Space'],
  ['wind.2', 'gravity', 'shotPull', 'Eye of the Storm'], ['gravity.0', 'gravity', 'crush', 'Crushing Well'], ['magnet.0', 'gravity', 'repelEnd', 'Polarity Flip'], ['blackhole.0', 'gravity', 'spread', 'Growing Horizon'],
  ['nebula.2', 'gravity', 'detonate', 'Gas Ignition'], ['devourer.1', 'gravity', 'drain', 'Consume Life', { k: 0.4 }], ['magnetar.0', 'gravity', 'cripple', 'Magnetic Lock'],
  // ---- strikes ----
  ['thunder.0', 'lightning', 'fork2', 'Forked Lightning'], ['judgment.1', 'lightning', 'mark', 'Sentenced', { col: '#ffcc00' }], ['divine.2', 'lightning', 'echoStrike', 'Wrath Twice'], ['dimensionking.1', 'lightning', 'widenStrike', 'Royal Decree'],
  ['chaosemperor.1', 'lightning', 'staticField', 'Storm Residue'], ['adminsupreme.0', 'lightning', 'crater', 'Decree Crater'], ['universe.1', 'meteor', 'crater', 'Impact Craters', { eff: 'burn' }], ['bloodmoon.1', 'meteor', 'bleed', 'Blood Rain'],
  // ---- summons, orbitals, time, blinks, buffs, specials ----
  ['shadow.1', 'clone', 'cloneBoom', 'Shadow Burst'], ['quantum.1', 'clone', 'cloneLink', 'Entangled Selves'], ['oneaboveall.1', 'clone', 'cloneHaste', 'Infinite Haste'], ['omniverse.2', 'clone', 'cloneVolley', 'Parallel Fire'],
  ['dimensionking.2', 'clone', 'cloneTaunt', 'Royal Guard'], ['phantom.1', 'clone', 'cloneShield', 'Phantom Guard'],
  ['plasma.1', 'orbitals', 'expandOrbit', 'Expanding Field'], ['infinity.0', 'orbitals', 'blockOrbit', 'Loop Guard'], ['creator.1', 'orbitals', 'launchOrbit', 'Creation Launch'], ['soul.1', 'orbitals', 'healOrbit', 'Spirit Mend'],
  ['infinitycore.2', 'orbitals', 'tightOrbit', 'Tight Orbit'], ['creatorgod.0', 'orbitals', 'chain', 'Genesis Arc', { col: '#b9f6ca' }],
  ['time.0', 'timestop', 'shatterStop', 'Shattered Moment'], ['ancientgod.1', 'timestop', 'stopMark', 'Sealed Fate'], ['glitchgod.1', 'timestop', 'stopPull', 'Forced Sync'], ['chronos.0', 'timestop', 'stopHeal', 'Borrowed Time'],
  ['shadow.0', 'teleport', 'blinkTrap', 'Shadow Snare'], ['dimension.0', 'teleport', 'blinkEcho', 'Return Rift'], ['quantum.0', 'teleport', 'echoHit', 'Quantum Echo'], ['chaos.2', 'teleport', 'confuse', 'Chaos Daze'],
  ['omniverse.0', 'teleport', 'blinkChain', 'Multiverse Hop'], ['reality.0', 'teleport', 'blinkShield', 'Warp Guard'], ['dimensionking.0', 'teleport', 'blinkShock', 'Royal Arrival'], ['phantom.3', 'teleport', 'blinkVolley', 'Ghost Volley'],
  ['chaosemperor.2', 'teleport', 'sunder', 'Emperor’s Mark'], ['rift.0', 'teleport', 'stagger', 'Rift Stagger'],
  ['wind.1', 'buff', 'hasteTrail', 'Gale Trail'], ['laser.2', 'buff', 'critUp', 'Overcharged Optics'], ['demon.1', 'buff', 'lsBuff', 'Blood Pact'], ['glitch.2', 'buff', 'buffCharge', 'Overclocked Core'], ['sonic.2', 'buff', 'buffShock', 'Sonic Release'],
  ['oneaboveall.0', 'copy', 'copyAmp', 'Absolute Mimicry'], ['unknown.0', 'copy', 'copySteal', 'Stolen Knowledge'], ['mirror.1', 'copy', 'copyTwice', 'Double Reflection'], ['oneaboveall.3', 'adaptive', 'adaptHeal', 'Adaptive Plating'],
  ['zombie.2', 'resurrect', 'rebirthHaste', 'Frenzied Return'], ['phoenix.1', 'resurrect', 'rebirthBlast', 'Phoenix Nova'], ['immortal.0', 'resurrect', 'rebirthShield', 'Eternal Aegis'], ['miracle.2', 'resurrect', 'rebirthCleanse', 'Clean Slate'],
  ['phantom.0', 'phase', 'phaseBoom', 'Exploding Illusion'], ['prism.2', 'reflect', 'reflectWave', 'Mirror Wave'], ['mirror.0', 'reflect', 'reflectStun', 'Stunning Return'],
].forEach(([uid, type, t, n, a]) => { SIG[uid] = { type, t, n, a: a || {}, get d() { const T = TW[t]; return T && T.desc ? T.desc(a || {}) : n; } }; });

/* ===== ULTIMATE twists: each classic ultimate gets an extra phase of its own ===== */
const UDK = (f, u, k) => skillDmg(f, (u && u.power) || 80) * k;
Object.assign(TW, {
  afterquake: { meta: ['aftershocks'], ult(f, a, u) { after(1.3, () => { if (!f.alive) return; for (const e of supEnemies(f)) for (let i = 0; i < 2; i++) supStrike(f, e.x + rand(-60, 60), e.y + rand(-50, 50), 0.3 + i * 0.2, 70, UDK(f, u, 0.14), u.color || f.def.design.c3, { kind: 'meteor', effect: u.effect }); }); }, desc: () => 'Aftershocks keep erupting under every enemy' },
  convergeRing: { meta: ['converging-ring'], ult(f, a, u) { after(1, () => { const t = nearestEnemy(f); if (!f.alive || !t) return; for (const e of foesNear(f, t.x, t.y, 260)) knock(e, t.x, t.y, -700); supBlast(f, t.x, t.y, 120, UDK(f, u, 0.3), { tag: 'wave' }); if (!FX.off) FX.ring(t.x, t.y, u.color || '#ffffff', 20, 0.5, 10, 260); }); }, desc: () => 'A ring of light collapses onto the enemy' },
  healingRain: { meta: ['team-regen'], ult(f) { for (const e of BATTLE.fighters) if (e.alive && e.team === f.team && !e.isClone) { const s = sx(e); s.regenT = 4; s.regenK = 0.03; } }, desc: () => 'Healing light rains on the caster and its allies for 4 s' },
  chainJudgment: { meta: ['chain-all'], ult(f, a, u) { after(1.2, () => { if (!f.alive) return; let from = f; for (const e of supEnemies(f)) { _dealDamage26(f, e, UDK(f, u, 0.22), { kind: 'skill', tag: 'strike', effect: 'stun', power: 60 }); if (!FX.off) FX.bolt(from.x, from.y, e.x, e.y, u.color || '#fff59d', 4, 0.35); from = e; } }); }, desc: () => 'Lightning chains through every enemy in turn' },
  prisonRing: { meta: ['cage-pillars'], ult(f, a, u) { const t = nearestEnemy(f); if (!t) return; for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; supStrike(f, t.x + dcos(an) * 120, t.y + dsin(an) * 120, 0.8 + i * 0.05, 46, UDK(f, u, 0.12), u.color || '#ffffff', { kind: 'lightning' }); } after(1.4, () => { if (f.alive && t.alive) supStrike(f, t.x, t.y, 0.35, 90, UDK(f, u, 0.35), u.color || '#ffffff', { kind: 'lightning', effect: u.effect }); }); }, desc: () => 'Pillars cage the enemy, then one strikes the centre' },
  sunburst: { meta: ['radial-lasers'], ult(f, a, u) { after(1.4, () => { if (!f.alive) return; for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + 0.2, e = rayToWall(f.x, f.y, an); addLaser(f, [f.x, f.y, e.x, e.y], { charge: 0.45, dur: 0.25, w: 14, dmg: UDK(f, u, 0.18), col: u.color || '#ffe066' }); } }); }, desc: () => 'Eight sun rays burst out in every direction' },
  frostField: { meta: ['arena-slow'], ult(f, a, u) { const z = twMiniZone(f, ARENA.cx, ARENA.cy, 300, 4, UDK(f, u, 0.02), u.color || '#bdf6ff', 'slow'); z.tw26 = true; }, desc: () => 'Freezes the middle of the arena into a slowing field' },
  collapseNova: { meta: ['delayed-nova'], ult(f, a, u) { const t = nearestEnemy(f); const p = t ? { x: t.x, y: t.y } : { x: ARENA.cx, y: ARENA.cy }; if (!FX.off) FX.ring(p.x, p.y, u.color || '#ffffff', 200, 2, 3, 190); after(2, () => { if (f.alive) explodeAt(f, p.x, p.y, 200, UDK(f, u, 0.4), u.color || '#ffffff', u.effect, 700, 80); }); }, desc: () => 'Everything collapses into a final explosion' },
  renewal: { meta: ['self-renew'], ult(f) { healFighter(f, f.maxHp * 0.12); f.st.burn = f.st.poison = f.st.weaken = f.st.slow = 0; }, desc: () => 'Restores 12% HP and cleanses the caster' },
  echoUlt: { meta: ['echo-wave'], ult(f, a, u) { after(2, () => { if (f.alive) supWave(f, f.x, f.y, 420, UDK(f, u, 0.3), u.color || '#ffffff', { force: 600, effect: u.effect }); }); }, desc: () => 'Echoes two seconds later as a second wave' },
  burningGround: { meta: ['hazard-ground'], fx: ['burn'], ult(f, a, u) { after(0.9, () => { if (!f.alive) return; for (const e of supEnemies(f)) twMiniZone(f, e.x, e.y, 90, 3, UDK(f, u, 0.03), u.color || '#ff7b00', u.effect && u.effect !== 'none' ? u.effect : 'burn'); }); }, desc: () => 'Leaves the ground burning under every enemy' },
  beamSweep: { meta: ['arena-sweep'], ult(f, a, u) { after(1.2, () => { if (f.alive) addLaser(f, [0, 0, 0, 0], { charge: 0.4, dur: 1.6, w: 16, dmg: UDK(f, u, 0.06), col: u.color || '#ff1050', sweep: { cx: f.x, cy: f.y, a0: rand(TAU), av: 2.2, len: 1100 } }); }); }, desc: () => 'Ends with a full sweep across the arena' },
  stormCrown: { meta: ['crown-orbs'], ult(f, a, u) { BATTLE.orbs.push({ owner: f, team: f.team, n: 3, life: 5, ang: 0, rad: f.r + 46, dmg: UDK(f, u, 0.1), col: u.color || '#ffe14d', hitCd: new Map(), effect: 'stun', power: 60, tw26: true }); }, desc: () => 'Leaves a crown of three charged orbs circling the caster' },
  novaVacuum: { meta: ['pre-pull'], ult(f) { for (const e of supEnemies(f)) knock(e, f.x, f.y, -900); }, desc: () => 'Drags every enemy in first' },
  shieldAfter: { meta: ['ult-shield'], ult(f) { f.st.shield = Math.max(f.st.shield, 3); f.st.shieldPow = Math.max(f.st.shieldPow, 0.4); }, desc: () => 'Wraps the caster in a strong shield' },
  markAll: { meta: ['mark-all'], ult(f, a, u) { for (const e of supEnemies(f)) { const s = sx(e); s.markT = 2.5; s.markD = UDK(f, u, 0.25); s.markBy = f; } }, desc: () => 'Marks every enemy for a delayed blast' },
  shatterAfter: { meta: ['end-shatter'], ult(f, a, u) { after(2.2, () => { if (!f.alive) return; for (const e of supEnemies(f)) if (e.st.freeze > 0 || e.st.timestop > 0) { _dealDamage26(f, e, UDK(f, u, 0.3), { kind: 'skill', tag: 'skill' }); if (!FX.off) FX.burst(e.x, e.y, '#e1f5fe', 20, 300, 5, 0.5, 'shard'); } }); }, desc: () => 'Frozen enemies shatter when time comes back' },
  edgeRain: { meta: ['edge-volley'], ult(f, a, u) { after(1, () => { if (!f.alive) return; for (let i = 0; i < 10; i++) { const top = i % 2 === 0, x = ARENA.x + ARENA.w * (i + 0.5) / 10, y = top ? ARENA.y + 12 : ARENA.b - 12; supShot(f, x, y, top ? Math.PI / 2 : -Math.PI / 2, { speed: 520, r: 8, dmg: UDK(f, u, 0.08), col: u.color || '#ffffff', life: 1.3 }); } }); }, desc: () => 'Bolts rain in from the arena walls' },
  lingeringRift: { meta: ['rift-zone'], ult(f, a, u) { const t = nearestEnemy(f); if (!t) return; const z = twMiniZone(f, t.x, t.y, 130, 4, UDK(f, u, 0.05), u.color || '#e040fb', u.effect && u.effect !== 'none' ? u.effect : 'slow'); z.lure26 = 200; z.tw26 = true; }, desc: () => 'Tears open a rift that drags enemies in and hurts them' },
  starfall: { meta: ['random-strikes'], ult(f, a, u) { for (let i = 0; i < 9; i++) supStrike(f, ARENA.x + 60 + rand(ARENA.w - 120), ARENA.y + 60 + rand(ARENA.h - 120), 0.8 + i * 0.18, 60, UDK(f, u, 0.12), u.color || '#ffffff', { kind: 'meteor' }); }, desc: () => 'Stars fall all over the arena' },
  lifeLinkUlt: { meta: ['ult-lifesteal'], ult(f) { const s = sx(f); s.lsT = 4; s.lsK = 0.25; }, desc: () => 'For 4 s, a quarter of the damage dealt heals the caster' },
  featherStorm: { meta: ['radial-feathers'], ult(f, a, u) { after(0.8, () => { if (!f.alive) return; for (let i = 0; i < 12; i++) supShot(f, f.x, f.y, i / 12 * TAU, { speed: 480, r: 7, dmg: UDK(f, u, 0.07), col: u.color || '#ffffff', life: 1.4, effect: u.effect }); }); }, desc: () => 'Twelve feathers fly out in a ring' },
  tideFromWalls: { meta: ['wall-waves'], ult(f, a, u) { after(1, () => { if (!f.alive) return; for (const [x, y] of [[ARENA.x, ARENA.cy], [ARENA.r, ARENA.cy]]) supWave(f, x, y, 520, UDK(f, u, 0.16), u.color || '#00b4ff', { speed: 600, effect: u.effect || 'slow', force: 300 }); }); }, desc: () => 'Tides crash in from both side walls' },
  crownOfThorns: { meta: ['ult-thorns'], ult(f) { const s = sx(f); s.thornsT = 4; s.thornsK = 0.3; }, desc: () => 'Attackers take damage back for 4 s' },
  hasteUlt: { meta: ['ult-haste'], ult(f) { f.st.buff = Math.max(f.st.buff, 4); f.st.buffPow = Math.max(f.st.buffPow, 0.25); }, desc: () => 'The caster is powered up for 4 s afterwards' },
  silenceAll: { meta: ['silence-all'], ult(f) { for (const e of supEnemies(f)) silenceFoe(f, e, 1, 'SILENCED'); }, desc: () => 'Silences every enemy for a moment' },
  ultCdReset: { meta: ['cooldown-reset'], ult(f) { for (const s of f.skills) s.cdLeft = Math.min(s.cdLeft, 0.5); }, desc: () => 'Refreshes the caster’s abilities' },
  decoyArmy: { meta: ['decoys'], ult(f) { for (let i = 0; i < 2; i++) { if (BATTLE.fighters.filter(c => c.isClone && c.owner === f && c.alive).length >= 3) break; const c = spawnClone(f, 30, 4, i * Math.PI); c.maxHp = c.hp = Math.max(5, Math.round(f.maxHp * 0.1)); c.decoy = true; } }, desc: () => 'Two decoys appear to confuse the enemy' },
  gravityWell: { meta: ['center-pull'], ult(f, a, u) { supZone(f, { kind: 'gravity', x: ARENA.cx, y: ARENA.cy, r: 380, life: 3, col: u.color || '#5effa8', pull: 520, dmg: UDK(f, u, 0.03), effect: 'none', power: 60, tw26: true }); }, desc: () => 'The arena’s centre becomes a whirlpool' },
  doubleStrike: { meta: ['heavy-pillar'], ult(f, a, u) { const t = supEnemies(f).reduce((x, y) => !x || threatTo(y) > threatTo(x) ? y : x, null); if (t) supStrike(f, t.x, t.y, 1.6, 110, UDK(f, u, 0.45), u.color || '#ffffff', { kind: 'lightning', effect: u.effect }); }, desc: () => 'A last, giant pillar falls on the most dangerous enemy' },
});
const threatTo = e => e.effAtk() * (0.5 + e.hpRatio);
[
  ['light', 'sunburst', 'Rays of Dawn'], ['judgment', 'markAll', 'Sentence for All'], ['eclipse', 'silenceAll', 'Blackout'], ['angel', 'healingRain', 'Choir’s Rain'], ['seraphim', 'burningGround', 'Purging Flames'],
  ['divine', 'shieldAfter', 'Divine Aegis'], ['absolute', 'doubleStrike', 'Absolute Pillar'], ['aurora', 'frostField', 'Polar Night'], ['adminsupreme', 'ultCdReset', 'Supreme Authority Reset'], ['prism', 'prisonRing', 'Prismatic Cage'],
  ['plasma', 'stormCrown', 'Plasma Crown'], ['nuclear', 'burningGround', 'Fallout'], ['universe', 'starfall', 'Starfall Reset'], ['star', 'sunburst', 'Stellar Rays'], ['dragon', 'afterquake', 'Emperor’s Tremor'],
  ['omniverse', 'echoUlt', 'Echoing Collapse'], ['destroyer', 'markAll', 'Marked for Destruction'], ['unknown', 'silenceAll', '█████ Silence'], ['toxicreactor', 'lingeringRift', 'Critical Rift'],
  ['water', 'tideFromWalls', 'Crashing Tides'], ['vampire', 'lifeLinkUlt', 'Endless Feast'], ['magnet', 'novaVacuum', 'Magnetic Vacuum'], ['immortal', 'shieldAfter', 'Immortal Shell'], ['creator', 'healingRain', 'Rain of Genesis'],
  ['soul', 'renewal', 'Harvested Life'], ['creatorgod', 'starfall', 'Newborn Stars'], ['magnetar', 'chainJudgment', 'Flare Chain'],
  ['wind', 'gravityWell', 'Eye of the Hurricane'], ['poison', 'lingeringRift', 'Plague Rift'], ['crystal', 'prisonRing', 'Diamond Cage'], ['nebula', 'starfall', 'Nursery Starfall'], ['quantum', 'echoUlt', 'Entangled Echo'],
  ['chaos', 'afterquake', 'Primordial Tremors'], ['sakura', 'featherStorm', 'Petal Ring'], ['sonic', 'hasteUlt', 'Afterburner'],
  ['dark', 'silenceAll', 'Silent Night'], ['gravity', 'collapseNova', 'Final Collapse'], ['galaxy', 'stormCrown', 'Galactic Crown'], ['blackhole', 'novaVacuum', 'Event Pull'], ['demon', 'burningGround', 'Hellfire Floor'],
  ['infinity', 'echoUlt', 'Infinite Echo'], ['bloodmoon', 'lifeLinkUlt', 'Blood Communion'], ['devourer', 'renewal', 'Digestion'],
  ['fire', 'burningGround', 'Burning Craters'], ['earth', 'afterquake', 'Tectonic Aftershocks'], ['celestial', 'prisonRing', 'Celestial Cage'], ['phoenix', 'featherStorm', 'Phoenix Plumage'], ['ancientgod', 'shieldAfter', 'Ancient Bulwark'], ['solarflare', 'sunburst', 'Solar Spokes'],
  ['ice', 'shatterAfter', 'Shatterpoint'], ['spider', 'prisonRing', 'Silk Cage'], ['shadow', 'decoyArmy', 'Shadow Doubles'], ['time', 'renewal', 'Turned-Back Clock'], ['frostcrown', 'frostField', 'Endless Winter'], ['chronos', 'markAll', 'Appointed Hour'],
  ['laser', 'beamSweep', 'Death Sweep'], ['dimension', 'lingeringRift', 'Open Rift'], ['reality', 'silenceAll', 'Muted Reality'], ['dimensionking', 'doubleStrike', 'Throne Strike'], ['glitch', 'ultCdReset', 'Hard Reboot'], ['rift', 'edgeRain', 'Rift Rain'],
  ['thunder', 'chainJudgment', 'Storm Chain'], ['glitchgod', 'silenceAll', 'Kernel Panic'], ['zombie', 'lifeLinkUlt', 'Feeding Horde'], ['mirror', 'decoyArmy', 'Mirror Doubles'],
].forEach(([ball, t, n]) => { ULT_SIG[ball] = { t, n, a: {}, get d() { return TW[t].desc({}); } }; });
/* =====================================================================
   2.6.0 NEW SKILL KIT — how the new abilities are declared, plus what several of them need:
   passive abilities (always on), autonomous abilities (they trigger themselves), arena walls, helpers' looks.
   ===================================================================== */
const PAS26 = {};          // type → { tick(f, h, sk) } for passive and autonomous abilities
/** declares one new unique ability for a ball */
function K(ball, d) {
  const passive = !!d.passive, auto = !!d.auto;
  let fn = d.fn;
  if (passive) fn = () => false;
  if (auto) { const real = d.fn; fn = (f, s, P, col, tgt) => f.autoCasting ? real(f, s, P, col, tgt) : false; }
  if (passive || auto) PAS26[d.t] = passive ? { tick: d.passive } : { tick: (f, h, sk) => { if (sk.cdLeft <= 0 && f.canAct() && !(f.st.silence > 0) && d.auto(f, sk)) autoFire(f, sk); } };
  NS(ball, { type: d.t, name: d.n, cat: d.c || (passive ? 'passive' : auto ? 'autonomous' : 'offense'), role: d.r || 'ranged', ico: d.i || '✦', cd: d.cd || (passive ? 1 : 8), power: d.p || 55, color: d.col, effect: d.e || 'none',
    desc: d.d, m: d.m, tg: d.tg || (passive ? 'self' : 'aim'), ac: d.ac || (passive ? 'passive' : auto ? 'conditional' : 'instant'), an: d.an || d.t, fn, self: !!d.self || passive || auto,
    score: passive || auto ? () => 0 : d.score, unlock: d.unlock, wins: d.wins });
  const last = NEW26[ball][NEW26[ball].length - 1]; if (passive) last.passive26 = true; if (auto) last.auto26 = true;
}
function autoFire(f, sk) { f.autoCasting = true; let ok = false; try { ok = useSkill(f, sk); } finally { f.autoCasting = false; } if (ok && !FX.off) FX.text(f.x, f.y - f.r - 52, '⟳ ' + sk.name, sk.color || '#e040fb', 13, { life: 0.9 }); return ok; }
const skP = (f, sk) => (sk.power || 50) * (f.powerMul || 1) * (f.kitK || 1);
/* passives & autonomous abilities run every step for the fighters that unlocked them */
SUP.worldHooks.push((B, h) => { for (const f of B.fighters) { if (!f.alive || !f.pas26) continue; for (const sk of f.pas26) { const P = PAS26[sk.type]; if (P && P.tick) P.tick(f, h, sk); } } });
const _skillInit26b = skillInit26;
skillInit26 = function (f, o) { _skillInit26b(f, o); f.pas26 = f.skills ? f.skills.filter(s => !s.locked && PAS26[s.type]) : null; if (f.pas26 && !f.pas26.length) f.pas26 = null; if (f.pas26 && !f.isClone) for (const s of f.pas26) if (s.passive26) f.skUse[s.uid] = 1; };   // a passive counts as used once per battle (mastery)
const hasPas = (f, type) => !!(f && f.pas26 && f.pas26.some(s => s.type === type));

/* ---------------- stat modifiers from 2.6.0 states (recomputed every step, deterministic) ---------------- */
SUP.worldHooks.push((B) => { for (const f of B.fighters) { if (!f.alive) continue; const s = f.sx; if (!s && !f.k26) continue; const m = { atk: 1, def: 1, spd: 1, cd: 1, taken: 1 }; if (s) for (const fn of MOD26) fn(f, s, m); f.k26 = (m.atk !== 1 || m.def !== 1 || m.spd !== 1 || m.cd !== 1 || m.taken !== 1) ? m : null; } });
{ const P = Fighter.prototype, ea = P.effAtk, ed = P.effDef, sm = P.speedMul, cm = P.cdMul;
  P.effAtk = function () { const v = ea.call(this); return this.k26 ? v * this.k26.atk : v; };
  P.effDef = function () { const v = ed.call(this); return this.k26 ? v * this.k26.def : v; };
  P.speedMul = function () { const v = sm.call(this); return this.k26 ? v * this.k26.spd : v; };
  P.cdMul = function () { const v = cm.call(this); return this.k26 ? v * this.k26.cd : v; }; }
SUP.dmgHooks.push((src, tgt, amt, o) => tgt.k26 && tgt.k26.taken !== 1 && o.kind !== 'dot' ? amt * tgt.k26.taken : amt);

/* ---------------- arena walls (barriers that block movement and/or shots) ---------------- */
function addWall26(f, x1, y1, x2, y2, o = {}) {
  const w = { reflect: !!o.reflect, dmg: o.dmg || 0, x1, y1, x2, y2, w: o.w || 16, life: o.life || 3, max: o.life || 3, team: f.team, owner: f, col: o.col || '#ffffff', move: o.move !== false, shots: o.shots !== false, onEnd: o.onEnd || null, hp: o.hp || 0 };
  (BATTLE.walls26 || (BATTLE.walls26 = [])).push(w);
  if (!FX.off) vfx((ctx, q) => { if (w.life <= 0) return; const a = Math.min(1, w.life / 0.4, (w.max - w.life) / 0.2 + 0.2); ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = rgba(w.col, 0.35); ctx.lineWidth = w.w * 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke(); ctx.strokeStyle = w.col; ctx.lineWidth = w.w * 0.7; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -BATTLE.time * 60; ctx.stroke(); ctx.restore(); }, w.life + 0.1, { keep: true });
  return w;
}
SUP.worldHooks.push((B, h) => {
  const W = B.walls26; if (!W || !W.length) return;
  for (let i = W.length - 1; i >= 0; i--) {
    const w = W[i]; w.life -= h;
    if (w.life <= 0) { W.splice(i, 1); if (w.onEnd) w.onEnd(w); continue; }
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = len(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    if (w.move) for (const f of B.fighters) {
      if (!f.alive || f.team === w.team || f.st.outside > 0 || f.beyond) continue;
      const d = segDist(f.x, f.y, w.x1, w.y1, w.x2, w.y2); if (d >= f.r + w.w / 2) continue;
      const side = Math.sign((f.x - w.x1) * nx + (f.y - w.y1) * ny) || 1, push = f.r + w.w / 2 - d + 1;
      f.x = inArenaX(f.x + nx * side * push, f.r); f.y = inArenaY(f.y + ny * side * push, f.r);
      const vn = f.vx * nx + f.vy * ny; if (vn * side < 0) { f.vx -= 2 * vn * nx; f.vy -= 2 * vn * ny; }
      if (w.dmg && twReady(f, 'wall' + w.max, 0.6)) _dealDamage26(w.owner, f, w.dmg, { kind: 'skill', tag: 'collision', noCrit: true, sk: w.sk });
    }
    if (w.shots) for (let k = B.projs.length - 1; k >= 0; k--) { const p = B.projs[k]; if (p.team === w.team || p.ult) continue; if (segDist(p.x, p.y, w.x1, w.y1, w.x2, w.y2) < p.r + w.w / 2) {
      if (w.reflect) { if (p.refl26 === w) continue; const vn = p.vx * nx + p.vy * ny; p.vx -= 2 * vn * nx; p.vy -= 2 * vn * ny; p.refl26 = w; p.hits = null; if (!FX.off) FX.sparks(p.x, p.y, '#ffffff', 6, 260); continue; }
      if (!FX.off) FX.burst(p.x, p.y, w.col, 6, 180, 3, 0.3); B.projs.splice(k, 1); } }
  }
});

/* ---------------- helpers for the new abilities ---------------- */
const MD = (id, name, c1, c2, c3, pat, deco = [], st = [70, 55, 40, 70, 12]) => UNITB('m26_' + id, name, st, D(c1, c2, c3, pat, deco));
function summon26(f, def, x, y, P, o = {}) { return supMinion(f, def, x, y, { P, life: o.life || 7, hp: o.hp || 0.08, statMul: o.statMul || 0.6, rScale: o.rScale || 0.5, shot: o.shot, onDeath: o.onDeath, cap: o.cap }); }
function anchor26(f, def, x, y, P, o = {}) { const u = spawnUnit(f, 'minion', x, y, { def, force: true, P, life: o.life || 6, hp: o.hp || 0.12, statMul: o.statMul || 0.5, rScale: o.rScale || 0.6, anchored: true, build: 0.3 }); if (u) { u.minion = true; u.ballLook = true; u.mech = false; if (o.shot) u.mshot = o.shot; if (o.tick) u.tick26 = o.tick; if (o.onDeath) u.minionDeath = o.onDeath; } return u; }
SUP.worldHooks.push((B, h) => { for (const u of B.fighters) if (u.tick26 && u.alive) u.tick26(u, h); });
const tele = (x, y, r, col, life = 0.8) => { if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.25 + 0.5 * q; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.fillStyle = rgba(col, 0.12 * q); ctx.fill(); ctx.restore(); }, life, { keep: true }); };
const teleLine = (x1, y1, x2, y2, col, life = 0.6, w = 10) => { if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.25 + 0.55 * q; ctx.strokeStyle = col; ctx.lineWidth = w * (0.4 + q * 0.6); ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); }, life, { keep: true }); };
const say26 = (f, t, col, size = 15) => { if (!FX.off) FX.text(f.x, f.y - f.r - 34, t, col || '#ffffff', size, { life: 1 }); };
const ring26 = (x, y, col, r, life = 0.4, w = 6, r0 = 10) => { if (!FX.off) FX.ring(x, y, col, r, life, w, r0); };
const burst26 = (x, y, col, n = 18, sp = 300, sz = 5, life = 0.5, type) => { if (!FX.off) FX.burst(x, y, col, n, sp, sz, life, type); };
const tgtOr = (f, tgt) => supTarget(f, tgt);
const weakestFoe = f => supEnemies(f).filter(e => !e.isClone || e.decoy).reduce((a, b) => !a || b.hpRatio < a.hpRatio ? b : a, null);
const strongestFoe = f => supEnemies(f).filter(e => !e.isClone).reduce((a, b) => !a || threatTo(b) > threatTo(a) ? b : a, null);
const allies = f => BATTLE.fighters.filter(e => e.alive && e.team === f.team && !e.isClone);

/* ---------------- new projectile looks ---------------- */
function _k26poly(ctx, x, y, r, n, rot, inner) { ctx.beginPath(); for (let i = 0; i <= n * 2; i++) { const a = rot + i / (n * 2) * TAU, rr = i % 2 ? r * inner : r; i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
SUP.projStyles = Object.assign(SUP.projStyles || {}, {
  k_crescent(ctx, p, t, r, a) { ctx.drawImage(glowSprite(p.col), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * 1.4, -1.3, 1.3); ctx.arc(-r * 0.5, 0, r * 1.1, 1.1, -1.1, true); ctx.fill(); ctx.restore(); },
  k_star(ctx, p, t, r) { ctx.drawImage(glowSprite(p.col), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.fillStyle = '#ffffff'; _k26poly(ctx, p.x, p.y, r * 1.3, 5, t * 6, 0.45); ctx.fill(); },
  k_rune(ctx, p, t, r) { ctx.drawImage(glowSprite(p.col), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(p.x - r * 0.8, p.y - r * 0.8, r * 1.6, r * 1.6); ctx.beginPath(); ctx.moveTo(p.x - r * 0.8, p.y); ctx.lineTo(p.x + r * 0.8, p.y); ctx.moveTo(p.x, p.y - r * 0.8); ctx.lineTo(p.x, p.y + r * 0.8); ctx.stroke(); },
  k_ring(ctx, p, t, r) { ctx.drawImage(glowSprite(p.col), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, r * 0.35); ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.1, 0, TAU); ctx.stroke(); },
  k_spear(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = p.col; ctx.fillRect(-r * 3, -r * 0.18, r * 3.4, r * 0.36); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.lineTo(r * 0.4, -r * 0.5); ctx.lineTo(r * 0.4, r * 0.5); ctx.fill(); ctx.restore(); },
  k_feather(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.6, r * 0.5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-r * 1.6, 0); ctx.lineTo(r * 1.6, 0); ctx.stroke(); ctx.restore(); },
  k_cube(ctx, p, t, r) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 5); ctx.fillStyle = p.col; ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); ctx.restore(); },
  k_comet(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); const g = ctx.createLinearGradient(-r * 7, 0, r, 0); g.addColorStop(0, rgba(p.col, 0)); g.addColorStop(1, rgba(p.col, 0.9)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(r, -r * 0.8); ctx.lineTo(-r * 7, 0); ctx.lineTo(r, r * 0.8); ctx.fill(); ctx.restore(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.9, 0, TAU); ctx.fill(); },
  k_petal(ctx, p, t, r) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 7 + p.x * 0.01); ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(r * 0.3, 0, r * 0.5, r * 0.2, 0, 0, TAU); ctx.fill(); ctx.restore(); },
  k_note(ctx, p, t, r) { ctx.drawImage(glowSprite(p.col), p.x - r * 2.6, p.y - r * 2.6, r * 5.2, r * 5.2); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.4, r * 0.7, r * 0.5, -0.4, 0, TAU); ctx.fill(); ctx.fillRect(p.x + r * 0.5, p.y - r * 1.4, r * 0.22, r * 1.8); },
  k_moon(ctx, p, t, r) { ctx.drawImage(glowSprite(p.col), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.fillStyle = rgba('#000000', 0.55); ctx.beginPath(); ctx.arc(p.x + r * 0.45, p.y - r * 0.2, r * 0.85, 0, TAU); ctx.fill(); },
  k_bullet(ctx, p, t, r, a) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.moveTo(r * 1.5, 0); ctx.lineTo(r * 0.3, -r * 0.5); ctx.lineTo(-r, -r * 0.5); ctx.lineTo(-r, r * 0.5); ctx.lineTo(r * 0.3, r * 0.5); ctx.fill(); ctx.restore(); ctx.drawImage(glowSprite(p.col), p.x - r * 2, p.y - r * 2, r * 4, r * 4); },
  k_nano(ctx, p, t, r) { ctx.fillStyle = p.col; for (let i = 0; i < 4; i++) { const a = t * 12 + i * 1.57; ctx.fillRect(p.x + Math.cos(a) * r - 1.5, p.y + Math.sin(a) * r - 1.5, 3, 3); } },
  k_anti(ctx, p, t, r) { const g = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r * 1.3); g.addColorStop(0, '#000000'); g.addColorStop(0.7, '#2a0040'); g.addColorStop(1, rgba('#ea80fc', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.3, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ea80fc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.05, t * 8, t * 8 + 4.2); ctx.stroke(); },
  k_bead(ctx, p, t, r) { ctx.drawImage(glowSprite('#ffffff'), p.x - r * 3.4, p.y - r * 3.4, r * 6.8, r * 6.8); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.8, 0, TAU); ctx.fill(); },
  k_snow(ctx, p, t, r) { ctx.drawImage(glowSprite(p.col), p.x - r * 1.8, p.y - r * 1.8, r * 3.6, r * 3.6); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.7, t * 3, t * 3 + 2); ctx.stroke(); },
  k_skullfire(ctx, p, t, r) { ctx.drawImage(glowSprite(p.col), p.x - r * 3, p.y - r * 3, r * 6, r * 6); ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.8, 0, TAU); ctx.fill(); ctx.fillStyle = '#3e0000'; ctx.fillRect(p.x - r * 0.45, p.y - r * 0.2, r * 0.3, r * 0.3); ctx.fillRect(p.x + r * 0.15, p.y - r * 0.2, r * 0.3, r * 0.3); },
});

/* ---------------- UNDERDOG SPIRIT — rarity is potential, never a guaranteed win ----------------
   A ball fighting enemies of a higher rarity gets +5% damage and takes 3% less damage per rarity step of difference
   (up to +40% / -24%). Shown on the battle HUD. Clones, summons and units use their master's value. */
const UNDERDOG = { DMG: 0.05, TAKEN: 0.6, MAX: 0.4 };
const rarIdx = d => { const i = RARITIES.indexOf(d && d.rarity); return i < 0 ? 4 : Math.min(i, 9); };
function underdogOf(f, B) { const me = f.owner || f; if (me.underdog26 != null && me.udT > B.time) return me.underdog26; let top = -1;
  for (const e of B.fighters) if (e.alive && e.team !== me.team && !e.isClone && !e.unit) top = Math.max(top, rarIdx(e.baseDef || e.def));
  const gap = top - rarIdx(me.baseDef || me.def); me.underdog26 = gap > 0 ? Math.min(UNDERDOG.MAX, gap * UNDERDOG.DMG) : 0; me.udT = B.time + 0.5; if (me.underdog26 && !me.sx) sx(me); return me.underdog26; }
SUP.worldHooks.push(B => { for (const f of B.fighters) if (f.alive && !f.isClone && !f.unit && (f.udT == null || f.udT <= B.time)) underdogOf(f, B); });
SUP.dmgHooks.push((src, tgt, amt, o) => { const B = BATTLE; if (!B || o.kind === 'dot') return amt; const a = src ? underdogOf(src.credit || src, B) : 0, d = underdogOf(tgt, B); return amt * (1 + a) * (1 - d * UNDERDOG.TAKEN); });
/* =====================================================================
   2.6.0 NEW SKILLS — EPIC (+1), LEGENDARY (+2), MYTHICAL (+3) balls. Every one is its own mechanic.
   ===================================================================== */
const SDk = (f, P, k) => skillDmg(f, P) * k;

/* ---------------- EPIC ---------------- */
K('laser', { t: 'k_lattice', n: 'Targeting Lattice', c: 'trap', r: 'control', i: '△', cd: 10, p: 55, col: '#ff4d79',
  d: 'Drops three laser emitters around the target; beams link them into a triangle for 2.5 s and burn anyone crossing a line',
  m: ['emitter-nodes', 'connected-lasers', 'area-denial'], tg: 'area', ac: 'delay', an: 'lattice',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const p = predictPos(f, t, 0.5), ph = rand(TAU);
    const pts = [0, 1, 2].map(i => { const a = ph + i / 3 * TAU; return { x: inArenaX(p.x + dcos(a) * 135, 20), y: inArenaY(p.y + dsin(a) * 135, 20) }; });
    for (let i = 0; i < 3; i++) { const A = pts[i], Bq = pts[(i + 1) % 3]; addLaser(f, [A.x, A.y, Bq.x, Bq.y], { charge: 0.6, dur: 2.5, w: 8, dmg: SDk(f, P, 0.2), col }); }
    for (const q of pts) ring26(q.x, q.y, col, 22, 3.1, 4, 8); } });
K('judgment', { t: 'k_scales', n: 'Scales of Balance', c: 'counter', r: 'defense', i: '⚖', cd: 13, p: 60, col: '#ffe680', self: true,
  d: 'For 3 s the scales weigh every hit taken; then a golden pillar returns 60% of it to the most dangerous enemy (or heals if nothing was taken)',
  m: ['damage-record', 'retribution', 'pillar'], tg: 'self', ac: 'delay', an: 'scales',
  fn(f, s, P, col) { const S = sx(f); S.scaleT = 3; S.scaleD = 0;
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 1 - q * 0.6; ctx.strokeStyle = col; ctx.lineWidth = 3; const y = f.y - f.r - 30, w = 34, tilt = Math.sin(q * 12) * 6; ctx.beginPath(); ctx.moveTo(f.x - w, y + tilt); ctx.lineTo(f.x + w, y - tilt); ctx.moveTo(f.x, y - 14); ctx.lineTo(f.x, y + 4); ctx.stroke(); ctx.restore(); }, 3);
    after(3, () => { if (!f.alive) return; const d = S.scaleD || 0, t = strongestFoe(f); S.scaleT = 0;
      if (d < 1 || !t) { healFighter(f, f.maxHp * 0.04); return; }
      supStrike(f, t.x, t.y, 0.35, 70, Math.min(t.maxHp * 0.25, Math.max(SDk(f, P, 0.3), d * 0.6)), col, { kind: 'lightning', power: P }); say26(f, 'THE SCALES TIP', col); }); } });
K('vampire', { t: 'k_hunger', n: 'Night Hunger', c: 'autonomous', i: '🦇', cd: 18, p: 55, col: '#ff1a3c',
  d: 'AUTONOMOUS — when an enemy nearby drops below 30% HP, it blinks behind it on its own and bites (drains life)',
  m: ['auto-trigger', 'execute-blink', 'bite'], tg: 'target', an: 'hunger',
  auto: f => supEnemies(f).some(e => e.hpRatio < 0.3 && len(e.x - f.x, e.y - f.y) < 420),
  fn(f, s, P, col) { const e = supEnemies(f).filter(e => e.hpRatio < 0.3).sort((a, b) => a.hpRatio - b.hpRatio)[0]; if (!e) return false; const b = behind(e, f, 50);
    burst26(f.x, f.y, col, 14, 240); f.x = inArenaX(b.x, f.r); f.y = inArenaY(b.y, f.r); burst26(f.x, f.y, col, 18, 280);
    dealDamage(f, e, SDk(f, P, 0.7), { kind: 'skill', tag: 'skill', effect: 'drain', power: P }); } });
K('gravity', { t: 'k_lift', n: 'Graviton Lift', c: 'arena', r: 'control', i: '⇲', cd: 13, p: 55, col: '#b388ff', self: true,
  d: 'Tilts the arena’s gravity: for 1.5 s enemies are hurled toward the nearest wall and take slam damage when they hit it',
  m: ['wall-push', 'wall-slam', 'global'], tg: 'global', an: 'lift',
  fn(f, s, P, col) { const es = supEnemies(f); if (!es.length) return false;
    for (const e of es) { const S = sx(e); S.liftT = e.boss ? 0.8 : 1.5; S.slamT = 1.6; S.slamBy = f; S.slamD = SDk(f, P, 0.55); }
    if (!FX.off) { FX.addShake(6); for (const e of es) ring26(e.x, e.y, col, e.r * 2.2, 0.5, 5, e.r); } } });
K('shadow', { t: 'k_mantle', n: 'Umbral Mantle', c: 'transform', r: 'buff', i: '◐', cd: 14, p: 55, col: '#7c4dff', self: true,
  d: 'Wraps itself in shadow for 4 s: enemies more than 260 px away lose track of it, and its next collision strikes 60% harder and weakens',
  m: ['stealth', 'ambush-bonus', 'self-transform'], tg: 'self', an: 'mantle',
  fn(f, s, P, col) { const S = sx(f); S.mantleT = 4; S.mantleP = P; burst26(f.x, f.y, col, 26, 260, 6, 0.6, 'smoke'); } });

/* ---------------- LEGENDARY ---------------- */
K('nuclear', { t: 'k_decay', n: 'Isotope Decay', c: 'trap', r: 'curse', i: '☢', cd: 11, p: 55, col: '#d4ff00',
  d: 'Irradiates the target: radiation pulses grow each time (×1, ×2, ×4) and spread to enemies nearby when it ends',
  m: ['escalating-dot', 'spread-on-expiry'], tg: 'target', ac: 'delay', an: 'decay',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; decayOn(f, t, SDk(f, P, 0.14), true); if (!FX.off) FX.bolt(f.x, f.y, t.x, t.y, col, 3, 0.3); } });
function decayOn(f, t, base, spread) { const S = sx(t); S.decay = { by: f, base, n: 0, spread, k: 0 }; S.decayT = 4.6; }
K('nuclear', { t: 'k_contain', n: 'Containment Field', c: 'defense', r: 'defense', i: '⬢', cd: 12, p: 55, col: '#eeff41', self: true,
  d: 'A lead dome surrounds it for 3 s: enemy shots that enter are swallowed and leak out as radioactive puddles',
  m: ['dome', 'absorb-projectiles', 'convert-to-zone'], tg: 'self', an: 'dome',
  fn(f, s, P, col) { const S = sx(f); S.domeT = 3; S.domeP = P; if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.55 * (1 - q * 0.5); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, 150, 0, TAU); ctx.stroke(); ctx.fillStyle = rgba(col, 0.08); ctx.fill(); ctx.restore(); }, 3); } });
K('galaxy', { t: 'k_spiral', n: 'Spiral Arm', c: 'offense', r: 'aoe', i: '֍', cd: 9, p: 55, col: '#b388ff', self: true,
  d: 'Spins out two arms of stars that sweep the area around it for 1.4 s',
  m: ['rotating-emitter', 'spiral-pattern'], tg: 'self', ac: 'channel', an: 'spiral',
  fn(f, s, P, col) { const a0 = rand(TAU); for (let i = 0; i < 14; i++) after(i * 0.1, () => { if (!f.alive) return; for (const k of [0, Math.PI]) supShot(f, f.x, f.y, a0 + i * 0.45 + k, { speed: 380, r: 7, dmg: SDk(f, P, 0.13), col, life: 1.3, style: 'k_star', power: P }); }); } });
K('galaxy', { t: 'k_lens', n: 'Gravitational Lens', c: 'counter', r: 'defense', i: '◎', cd: 12, p: 50, col: '#82b1ff',
  d: 'Places a gravity lens for 4 s: enemy shots passing through it are bent around and sent at the galaxy’s enemies',
  m: ['redirect-projectiles', 'placed-lens'], tg: 'area', an: 'lens',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt), a = t ? angTo(f, t) : f.rot, x = inArenaX(f.x + dcos(a) * 150, 60), y = inArenaY(f.y + dsin(a) * 150, 60);
    supZone(f, { kind: 'trap', custom: true, x, y, r: 90, life: 4, col, dmg: 0, lens26: true });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.6 * (1 - q); ctx.strokeStyle = col; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y, 90 - i * 20, 40 - i * 8, BATTLE.time * 2 + i, 0, TAU); ctx.stroke(); } ctx.restore(); }, 4); } });
K('star', { t: 'k_shootingstar', n: 'Shooting Star', c: 'mobility', r: 'mobility', i: '☄', cd: 10, p: 55, col: '#fff59d',
  d: 'Becomes a comet: streaks 360 px, hitting everything on the way, and leaves stardust that heals allies who touch it',
  m: ['comet-travel', 'path-damage', 'ally-trail'], tg: 'aim', an: 'comet',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); const a = t ? angTo(f, t) : f.rot, x0 = f.x, y0 = f.y, x1 = inArenaX(f.x + dcos(a) * 360, f.r), y1 = inArenaY(f.y + dsin(a) * 360, f.r);
    f.st.invuln = Math.max(f.st.invuln, 0.25); f.x = x1; f.y = y1; f.vx = dcos(a) * f.baseSpeed; f.vy = dsin(a) * f.baseSpeed;
    for (const e of supEnemies(f)) if (segDist(e.x, e.y, x0, y0, x1, y1) < e.r + 40) dealDamage(f, e, SDk(f, P, 0.8), { kind: 'skill', tag: 'skill', power: P });
    for (let i = 0; i <= 5; i++) { const z = twMiniZone(f, x0 + (x1 - x0) * i / 5, y0 + (y1 - y0) * i / 5, 34, 3, 0, col, 'none'); z.ally26 = 0.025; }
    if (!FX.off) { vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = col; ctx.lineWidth = 18 * (1 - q); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore(); }, 0.5); burst26(x1, y1, col, 24, 320, 5, 0.6, 'shard'); } } });
K('star', { t: 'k_twinkle', n: 'Twinkle Mines', c: 'trap', r: 'control', i: '✧', cd: 11, p: 55, col: '#ffe082',
  d: 'Scatters five twinkling stars around the target; they flash together and detonate 2 s later',
  m: ['timed-mines', 'scatter', 'synchronized'], tg: 'area', ac: 'delay', an: 'twinkle',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const p = predictPos(f, t, 1);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + rand(0.5), r = 50 + rand(70), x = inArenaX(p.x + dcos(a) * r, 20), y = inArenaY(p.y + dsin(a) * r, 20); tele(x, y, 55, col, 2); supStrike(f, x, y, 2, 55, SDk(f, P, 0.3), col, { kind: 'meteor', power: P }); } } });
K('nebula', { t: 'k_protostar', n: 'Protostar', c: 'arena', r: 'aoe', i: '✺', cd: 13, p: 60, col: '#ea80fc',
  d: 'Ignites a protostar that grows for 4 s, pulling enemies in; it bursts at the end — or early, smaller, if an enemy touches it',
  m: ['growing-core', 'delayed-burst', 'stationary', 'pull'], tg: 'area', ac: 'delay', an: 'protostar',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const p = predictPos(f, t, 0.8);
    supZone(f, { kind: 'trap', custom: true, x: inArenaX(p.x, 90), y: inArenaY(p.y, 90), r: 20, life: 4, col, dmg: 0, proto26: SDk(f, P, 1.1), t0: BATTLE.time }); } });
K('nebula', { t: 'k_ionfog', n: 'Ion Fog', c: 'environment', r: 'control', i: '☁', cd: 13, p: 50, col: '#ce93d8', self: true,
  d: 'Charged fog fills the area around it for 5 s: enemy shots that pass through it are thrown off course',
  m: ['fog', 'accuracy-debuff'], tg: 'self', an: 'fog',
  fn(f, s, P, col) { supZone(f, { kind: 'trap', custom: true, x: f.x, y: f.y, r: 230, life: 5, col, dmg: 0, fog26: true });
    if (!FX.off) for (let i = 0; i < 16; i++) { const a = vr(TAU), d = vr(230); FX.p(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, vr(-20, 20), vr(-20, 20), 4, vr(20, 40), rgba(col, 0.25), 'smoke', 0.2); } } });
K('quantum', { t: 'k_uncertain', n: 'Uncertainty Principle', c: 'defense', r: 'defense', i: '¿', cd: 12, p: 50, col: '#18ffff', self: true,
  d: 'For 3 s its position is uncertain: each incoming ability hit has a 50% chance to miss as it shifts 90 px sideways',
  m: ['probabilistic-dodge', 'reposition'], tg: 'self', an: 'uncertain',
  fn(f, s, P, col) { sx(f).uncT = 3; burst26(f.x, f.y, col, 16, 200, 4, 0.5); } });
K('quantum', { t: 'k_collapse', n: 'Wavefunction Collapse', c: 'offense', r: 'ranged', i: 'Ψ', cd: 10, p: 60, col: '#84ffff',
  d: 'Marks three places the target might be; after 1 s reality collapses: the mark closest to it explodes hard, the others weakly',
  m: ['predict-positions', 'collapse-strike'], tg: 'area', ac: 'delay', an: 'collapse',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const pts = [predictPos(f, t, 1), predictPos(f, t, 0.4), { x: t.x + rand(-120, 120), y: t.y + rand(-90, 90) }].map(p => ({ x: inArenaX(p.x, 40), y: inArenaY(p.y, 40) }));
    for (const p of pts) tele(p.x, p.y, 70, col, 1);
    after(1, () => { if (!f.alive || !t.alive) return; let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = len(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; bi = i; } });
      pts.forEach((p, i) => { const big = i === bi; supBlast(f, p.x, p.y, big ? 85 : 60, SDk(f, P, big ? 1.1 : 0.3), { tag: 'explosion', force: big ? 450 : 200, power: P }); if (!FX.off) { ring26(p.x, p.y, col, big ? 85 : 60, 0.35, big ? 9 : 4); burst26(p.x, p.y, col, big ? 30 : 10, 340); } }); }); } });
K('eclipse', { t: 'k_penumbra', n: 'Penumbra', c: 'environment', r: 'aoe', i: '◍', cd: 12, p: 55, col: '#ff6d00', self: true,
  d: 'Casts a ring of half-shadow for 4 s: enemies in the burning ring take fire damage, enemies in the dark core are blinded',
  m: ['annulus-zone', 'blind-core'], tg: 'self', an: 'penumbra',
  fn(f, s, P, col) { supZone(f, { kind: 'trap', custom: true, follow: f, x: f.x, y: f.y, r: 230, life: 4, col, dmg: SDk(f, P, 0.12), effect: 'burn', power: P, onTick: (z, e, d) => {
      if (d < 90) { if (twReady(e, 'pen', 2) && !e.boss) sx(e).blindT = 0.5; } else if (d < z.r && (z.ticks.get(e.uid) || 0) <= BATTLE.time) { z.ticks.set(e.uid, BATTLE.time + 0.5); dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', effect: 'burn', power: z.power, noCrit: true, sk: z.sk }); } } });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.5 * (1 - q * 0.6); ctx.strokeStyle = col; ctx.lineWidth = 140; ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(f.x, f.y, 160, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(f.x, f.y, 90, 0, TAU); ctx.fill(); ctx.restore(); }, 4); } });
K('eclipse', { t: 'k_corona', n: 'Corona Crown', c: 'transform', r: 'buff', i: '☀', cd: 15, p: 55, col: '#ffab00', self: true,
  d: 'Ignites a corona for 5 s: +15% attack and a burning halo that scorches enemies who come close',
  m: ['damage-aura', 'attack-buff', 'self-transform'], tg: 'self', an: 'corona',
  fn(f, s, P, col) { const S = sx(f); S.coronaT = 5; S.coronaD = SDk(f, P, 0.12); burst26(f.x, f.y, col, 30, 320, 6, 0.6); } });
K('prism', { t: 'k_colorwheel', n: 'Color Wheel', c: 'offense', r: 'ranged', i: '◑', cd: 6, p: 55, col: '#ff4081',
  d: 'Each cast fires the next colour of the wheel: red burns the ground, blue freezes, green spreads poison to nearby enemies',
  m: ['cycling-element', 'sequential-casts'], tg: 'aim', an: 'colorwheel',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(f), k = (S.wheel = ((S.wheel || 0) + 1) % 3), C = ['#ff5252', '#40c4ff', '#69f0ae'][k], E = ['burn', 'freeze', 'poison'][k];
    supShot(f, f.x, f.y, aimAngle(f, t, 620), { speed: 620, r: 11, dmg: SDk(f, P, 0.9), col: C, effect: E, power: P, style: 'k_ring', onHit: (p, e) => { if (k === 0) twMiniZone(f, p.x, p.y, 60, 2, SDk(f, P, 0.08), C, 'burn'); if (k === 2) for (const o of foesNear(f, e.x, e.y, 160)) if (o !== e) applyEffect(f, o, 'poison', 50); } }); } });
K('prism', { t: 'k_bridge', n: 'Rainbow Bridge', c: 'mobility', r: 'mobility', i: '⌒', cd: 11, p: 45, col: '#ffffff',
  d: 'Lays a rainbow bridge and races along it; allies on the bridge are faster for 3 s, enemies it crosses are dazzled',
  m: ['light-path', 'fast-travel', 'ally-speed'], tg: 'aim', an: 'bridge',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt), away = f.hpRatio < 0.35; const a = t ? angTo(f, t) + (away ? Math.PI : 0) : f.rot, x0 = f.x, y0 = f.y, x1 = inArenaX(x0 + dcos(a) * 380, f.r), y1 = inArenaY(y0 + dsin(a) * 380, f.r);
    f.vx = dcos(a) * f.baseSpeed * 3; f.vy = dsin(a) * f.baseSpeed * 3; f.st.dash = 0.35; f.dashEffect = 'none'; f.st.invuln = Math.max(f.st.invuln, 0.2);
    BATTLE.bridges26 = (BATTLE.bridges26 || []).concat([{ x0, y0, x1, y1, t: 3, team: f.team }]);
    for (const e of supEnemies(f)) if (segDist(e.x, e.y, x0, y0, x1, y1) < e.r + 30 && !e.boss) e.st.slow = Math.max(e.st.slow, 1);
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.7 * (1 - q); ctx.lineCap = 'round'; ['#ff5252', '#ffab40', '#ffee58', '#69f0ae', '#40c4ff', '#b388ff'].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 4; const o = (i - 2.5) * 4; ctx.beginPath(); ctx.moveTo(x0 + o, y0 + o); ctx.lineTo(x1 + o, y1 + o); ctx.stroke(); }); ctx.restore(); }, 3); } });
K('mirror', { t: 'k_maze', n: 'Mirror Maze', c: 'arena', r: 'control', i: '▱', cd: 15, p: 45, col: '#e0f7fa', self: true,
  d: 'Raises four mirror panels across the arena for 5 s: enemy shots that hit a panel bounce off it',
  m: ['reflective-panels', 'arena-objects'], tg: 'global', an: 'maze',
  fn(f, s, P, col) { const ph = rand(TAU); for (let i = 0; i < 4; i++) { const a = ph + i / 4 * TAU, cx = ARENA.cx + dcos(a) * 260, cy = ARENA.cy + dsin(a) * 160, o = a + Math.PI / 2; addWall26(f, cx - dcos(o) * 60, cy - dsin(o) * 60, cx + dcos(o) * 60, cy + dsin(o) * 60, { life: 5, w: 10, col, move: false, shots: true, reflect: true }); } } });
K('mirror', { t: 'k_reverseimg', n: 'Reverse Image', c: 'counter', r: 'control', i: '⇋', cd: 12, p: 50, col: '#b2ebf2',
  d: 'Shows the target its reverse image: its movement flips for 1.5 s and the mirror steals its active shield and power-up',
  m: ['steal-buffs', 'reverse-motion'], tg: 'target', an: 'reverseimg',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; t.vx = -t.vx; t.vy = -t.vy; sx(t).confT = t.boss ? 0.7 : 1.5;
    if (t.st.shield > 0) { f.st.shield = Math.max(f.st.shield, t.st.shield); f.st.shieldPow = Math.max(f.st.shieldPow, t.st.shieldPow); t.st.shield = 0; }
    if (t.st.buff > 0) { f.st.buff = Math.max(f.st.buff, t.st.buff); f.st.buffPow = Math.max(f.st.buffPow, t.st.buffPow); t.st.buff = 0; }
    if (!FX.off) { FX.bolt(t.x, t.y, f.x, f.y, col, 3, 0.35); ring26(t.x, t.y, col, t.r * 2.4, 0.4, 5, t.r); } } });
K('sonic', { t: 'k_barrier', n: 'Sound Barrier', c: 'defense', r: 'defense', i: '⊳', cd: 11, p: 55, col: '#40c4ff', self: true,
  d: 'Breaks the sound barrier for 3 s: hits from the front lose 60% of their damage and ramming an enemy at full speed sends out a boom',
  m: ['directional-guard', 'speed-condition', 'boom'], tg: 'self', an: 'barrier',
  fn(f, s, P, col) { const S = sx(f); S.barT = 3; S.barP = P; ring26(f.x, f.y, col, f.r * 2.4, 0.4, 6, f.r); } });
K('sonic', { t: 'k_resonance', n: 'Resonance', c: 'offense', r: 'control', i: '♫', cd: 12, p: 50, col: '#80d8ff', self: true,
  d: 'Tunes every enemy within 500 px to its frequency for 4 s: each ability it uses meanwhile makes them all vibrate for damage',
  m: ['resonance-tag', 'triggered-by-casts'], tg: 'area', an: 'resonance',
  fn(f, s, P, col) { const es = supEnemies(f).filter(e => len(e.x - f.x, e.y - f.y) < 500); if (!es.length) return false; for (const e of es) { const S = sx(e); S.resoT = 4; S.resoBy = f; S.resoD = SDk(f, P, 0.18); }
    if (!FX.off) for (const e of es) { FX.bolt(f.x, f.y, e.x, e.y, col, 2, 0.3); ring26(e.x, e.y, col, e.r * 2, 0.4, 4, e.r); } } });

/* ---------------- MYTHICAL ---------------- */
K('blackhole', { t: 'k_accretion', n: 'Accretion Disk', c: 'offense', r: 'aoe', i: '◌', cd: 12, p: 55, col: '#7c4dff', self: true,
  d: 'A wide disk of debris orbits it and slowly spirals inward over 5 s, grinding anything caught in it',
  m: ['inward-spiral-orbit', 'debris'], tg: 'self', an: 'accretion',
  fn(f, s, P, col) { BATTLE.orbs.push({ owner: f, team: f.team, n: 6, life: 5, ang: 0, rad: 210, dmg: SDk(f, P, 0.2), col, hitCd: new Map(), effect: 'none', power: P, shrink26: 30, tw26: true, sk: s.uid }); } });
K('blackhole', { t: 'k_tidallock', n: 'Tidal Lock', c: 'environment', r: 'control', i: '⟲', cd: 12, p: 50, col: '#b388ff',
  d: 'Locks the target into an orbit around the black hole for 2 s: it can only circle, taking damage each lap',
  m: ['forced-orbit'], tg: 'target', an: 'tidallock',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t || t.anchored) return false; const S = sx(t); S.lockT = t.boss ? 1 : 2; S.lockBy = f; S.lockR = clamp(len(t.x - f.x, t.y - f.y), 140, 260); S.lockA = datan2(t.y - f.y, t.x - f.x); S.lockD = SDk(f, P, 0.3); } });
K('blackhole', { t: 'k_hawking', n: 'Hawking Radiation', c: 'passive', i: '∵', p: 40, col: '#d1c4e9',
  d: 'PASSIVE — every 2 s, if an enemy is within 260 px, it radiates three particles at it',
  m: ['passive', 'proximity-emission'], an: 'hawking',
  passive(f, h, sk) { const S = sx(f); if ((S.hawkT = (S.hawkT || 2) - h) > 0) return; S.hawkT = 2; const e = supEnemies(f).find(e => len(e.x - f.x, e.y - f.y) < 260); if (!e) return; for (let i = -1; i <= 1; i++) supShot(f, f.x, f.y, angTo(f, e) + i * 0.25, { speed: 420, r: 5, dmg: SDk(f, skP(f, sk), 0.12), col: sk.color, life: 0.9, sk: sk.uid }); } });
K('universe', { t: 'k_darkweb', n: 'Dark Matter Web', c: 'trap', r: 'control', i: '⌘', cd: 12, p: 50, col: '#311b92',
  d: 'Ties the target to an invisible dark-matter anchor for 3 s: straying more than 150 px yanks it back and hurts; enemies near each other are pulled together',
  m: ['anchor-point', 'pull-together', 'tether'], tg: 'target', an: 'darkweb',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(t); S.webT = 3; S.webX = t.x; S.webY = t.y; S.webBy = f; S.webD = SDk(f, P, 0.2);
    const es = supEnemies(f); for (const a of es) for (const b of es) if (a !== b && len(a.x - b.x, a.y - b.y) < 300) knock(a, b.x, b.y, -260); tele(t.x, t.y, 150, '#7c4dff', 3); } });
K('universe', { t: 'k_inflation', n: 'Cosmic Inflation', c: 'arena', r: 'control', i: '⇱', cd: 14, p: 50, col: '#82b1ff', self: true,
  d: 'Space itself expands: every enemy is pushed away for 2 s while the universe accelerates (+30% speed for 3 s)',
  m: ['global-push', 'self-speed'], tg: 'global', an: 'inflation',
  fn(f, s, P, col) { for (const e of supEnemies(f)) sx(e).inflT = e.boss ? 1 : 2, sx(e).inflBy = f; sx(f).inflSelfT = 3;
    if (!FX.off) for (let i = 0; i < 3; i++) ring26(f.x, f.y, col, 600, 0.8 + i * 0.3, 6, f.r); } });
K('universe', { t: 'k_heatdeath', n: 'Heat Death', c: 'environment', r: 'curse', i: '❄', cd: 13, p: 45, col: '#90a4ae',
  d: 'Drains the target’s energy: for 4 s it moves 40% slower and its cooldowns run 40% slower',
  m: ['cooldown-slow', 'speed-slow', 'entropy'], tg: 'target', an: 'heatdeath',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; sx(t).heatDeathT = t.boss ? 2 : 4; if (!FX.off) { FX.bolt(f.x, f.y, t.x, t.y, col, 2, 0.3); FX.text(t.x, t.y - t.r - 26, 'ENTROPY', col, 14); } } });
K('dimension', { t: 'k_foldback', n: 'Fold Back', c: 'mobility', r: 'mobility', i: '↺', cd: 12, p: 55, col: '#00e5ff', self: true,
  d: 'Pins this spot in space; 2.5 s later the dimension snaps back to it, dragging nearby enemies along and hurting them',
  m: ['position-anchor', 'return-drag'], tg: 'self', ac: 'delay', an: 'foldback',
  fn(f, s, P, col) { const x = f.x, y = f.y; tele(x, y, 50, col, 2.5);
    after(2.5, () => { if (!f.alive) return; const near = foesNear(f, f.x, f.y, 170); burst26(f.x, f.y, col, 14, 240); f.x = x; f.y = y;
      for (const e of near) { if (!e.boss) { e.x = inArenaX(x + rand(-60, 60), e.r); e.y = inArenaY(y + rand(-60, 60), e.r); } dealDamage(f, e, SDk(f, P, 0.6), { kind: 'skill', tag: 'skill', power: P }); }
      ring26(x, y, col, 170, 0.4, 6); burst26(x, y, col, 24, 300); }); } });
K('dimension', { t: 'k_cut', n: 'Dimensional Cut', c: 'offense', r: 'ranged', i: '⫽', cd: 11, p: 55, col: '#18ffff',
  d: 'Slices space along a line through the target (clear warning); the cut stays open for 3 s and hurts anyone who crosses it',
  m: ['arena-line', 'cross-damage', 'lingering'], tg: 'aim', ac: 'charge', an: 'cut',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const a = angTo(f, t) + Math.PI / 2, A = rayToWall(t.x, t.y, a), Bq = rayToWall(t.x, t.y, a + Math.PI);
    addLaser(f, [A.x, A.y, Bq.x, Bq.y], { charge: 0.7, dur: 3, w: 10, dmg: SDk(f, P, 0.4), col }); } });
K('dimension', { t: 'k_parallel', n: 'Parallel Echo', c: 'autonomous', i: '⧉', cd: 12, p: 55, col: '#80deea',
  d: 'AUTONOMOUS — when a single hit takes 8% of its HP, a parallel self steps out behind the attacker and strikes back',
  m: ['auto-trigger', 'retaliate-behind'], tg: 'target', an: 'parallel',
  auto: f => { const S = f.sx; return !!(S && S.bigHitT > 0 && S.bigHitBy && S.bigHitBy.alive && S.bigHitBy.team !== f.team); },
  fn(f, s, P, col) { const S = sx(f), e = S.bigHitBy; S.bigHitT = 0; if (!e || !e.alive) return false; const b = behind(e, f, 40);
    if (!FX.off) { vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.6 * (1 - q); drawBall(ctx, f.def, b.x, b.y, f.r, { t: BATTLE.time, alpha: 0.5, noAura: true, small: true }); ctx.restore(); }, 0.6); FX.bolt(b.x, b.y, e.x, e.y, col, 3, 0.3); }
    dealDamage(f, e, SDk(f, P, 0.75), { kind: 'skill', tag: 'skill', power: P }); knock(e, b.x, b.y, 380); } });
K('time', { t: 'k_hastefield', n: 'Haste Field', c: 'environment', r: 'buff', i: '⌚', cd: 13, p: 50, col: '#40c4ff', self: true,
  d: 'Bends time in a 200 px field for 4 s: allies inside move 25% faster, enemies inside 25% slower',
  m: ['dual-speed-field', 'time-dilation'], tg: 'self', an: 'hastefield',
  fn(f, s, P, col) { supZone(f, { kind: 'trap', custom: true, x: f.x, y: f.y, r: 200, life: 4, col, dmg: 0, haste26: true });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.4 * (1 - q * 0.5); ctx.strokeStyle = col; ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + q * 6; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * 180, f.y + Math.sin(a) * 180); ctx.lineTo(f.x + Math.cos(a) * 200, f.y + Math.sin(a) * 200); ctx.stroke(); } ctx.beginPath(); ctx.arc(f.x, f.y, 200, 0, TAU); ctx.stroke(); ctx.restore(); }, 4); } });
K('time', { t: 'k_stopwatch', n: 'Stopwatch', c: 'trap', r: 'curse', i: '⏱', cd: 12, p: 50, col: '#ffd740',
  d: 'Starts a stopwatch on the target: 3 s later, 30% of all the damage it took meanwhile happens again',
  m: ['damage-replay', 'delayed'], tg: 'target', ac: 'delay', an: 'stopwatch',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(t); S.watchT = 3; S.watchD = 0; S.watchBy = f;
    after(3, () => { if (t.alive && S.watchD > 0) { _dealDamage26(f.alive ? f : null, t, S.watchD * 0.3, { kind: 'skill', noCrit: true, noDef: true }); if (!FX.off) { FX.text(t.x, t.y - t.r - 30, 'REPLAYED', col, 15); ring26(t.x, t.y, col, t.r * 2.6, 0.4, 6, t.r); } } S.watchD = 0; }); } });
K('time', { t: 'k_afterimage', n: 'Temporal Afterimage', c: 'passive', i: '⏳', p: 40, col: '#ffe57f',
  d: 'PASSIVE — every 6 s it leaves an afterimage in time; when an ability hits it hard, it slips back to that afterimage (8 s cooldown)',
  m: ['passive', 'position-history', 'auto-blink'], an: 'afterimage',
  passive(f, h, sk) { const S = sx(f); if ((S.aiT = (S.aiT || 0) - h) <= 0) { S.aiT = 6; S.aiPos = { x: f.x, y: f.y }; } } });
K('celestial', { t: 'k_zodiac', n: 'Zodiac Wheel', c: 'summon', r: 'summon', i: '♈', cd: 14, p: 50, col: '#ffd54f', self: true,
  d: 'Twelve zodiac sigils light up around the arena; one by one, each fires a star at the nearest enemy',
  m: ['arena-ring-emitters', 'sequential-fire'], tg: 'global', ac: 'channel', an: 'zodiac',
  fn(f, s, P, col) { const sym = '♈♉♊♋♌♍♎♏♐♑♒♓';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, x = ARENA.cx + dcos(a) * (ARENA.w / 2 - 50), y = ARENA.cy + dsin(a) * (ARENA.h / 2 - 40);
      if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = q < 0.8 ? 0.8 : (1 - q) * 4; ctx.fillStyle = col; ctx.font = '700 22px "Segoe UI Symbol", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(sym[i], x, y + 8); ctx.restore(); }, 0.4 + i * 0.25);
      after(0.4 + i * 0.25, () => { if (!f.alive) return; const t = nearestEnemy(f); if (t) supShot(f, x, y, datan2(t.y - y, t.x - x), { speed: 560, r: 7, dmg: SDk(f, P, 0.12), col, life: 2, homing: 2, target: t, style: 'k_star' }); }); } } });
K('celestial', { t: 'k_astral', n: 'Astral Projection', c: 'mobility', r: 'mobility', i: '⇢', cd: 11, p: 50, col: '#fff9c4',
  d: 'Sends its astral form flying ahead; wherever the projection ends, the celestial body teleports to it in a burst of light',
  m: ['projected-self', 'teleport-to-projection'], tg: 'aim', an: 'astral',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); const a = t ? angTo(f, t) : f.rot;
    const go = p => { if (!f.alive) return; burst26(f.x, f.y, col, 12, 220); f.x = inArenaX(p.x, f.r); f.y = inArenaY(p.y, f.r); supBlast(f, f.x, f.y, 110, SDk(f, P, 0.45), { tag: 'explosion', force: 350, power: P }); ring26(f.x, f.y, col, 110, 0.35, 6); };
    supShot(f, f.x, f.y, a, { speed: 560, r: 12, dmg: SDk(f, P, 0.3), col, life: 0.75, style: 'k_star', onHit: p => go(p), onEnd: p => go(p) }); } });
K('celestial', { t: 'k_starbind', n: 'Starbind', c: 'trap', r: 'control', i: '✶', cd: 12, p: 50, col: '#fff176',
  d: 'Two stars pin the target between them for 2.5 s: it cannot stray more than 170 px from their midpoint',
  m: ['bounded-area', 'tether-points'], tg: 'target', an: 'starbind',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(t), a = rand(TAU); S.bindT = t.boss ? 1.2 : 2.5; S.bindX = t.x; S.bindY = t.y; S.bindD = SDk(f, P, 0.12); S.bindBy = f;
    const p1 = { x: t.x + dcos(a) * 150, y: t.y + dsin(a) * 150 }, p2 = { x: t.x - dcos(a) * 150, y: t.y - dsin(a) * 150 };
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(t.x, t.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); for (const p of [p1, p2]) { ctx.fillStyle = '#ffffff'; _k26poly(ctx, p.x, p.y, 12, 5, q * 4, 0.45); ctx.fill(); } ctx.restore(); }, S.bindT); } });
K('dragon', { t: 'k_winggust', n: 'Wing Gust', c: 'counter', r: 'control', i: '⇶', cd: 10, p: 50, col: '#ff7043',
  d: 'A beat of its wings blasts a cone in front: enemies are thrown back and enemy shots in the cone are blown back at their owners',
  m: ['cone', 'push', 'projectile-reverse'], tg: 'aim', an: 'gust',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); const a = t ? angTo(f, t) : f.rot, inCone = (x, y, R) => { const d = len(x - f.x, y - f.y); if (d > R) return false; const da = Math.abs(((datan2(y - f.y, x - f.x) - a + Math.PI * 3) % TAU) - Math.PI); return da < 0.65; };
    for (const e of supEnemies(f)) if (inCone(e.x, e.y, 330 + e.r)) { knock(e, f.x, f.y, 850); dealDamage(f, e, SDk(f, P, 0.35), { kind: 'skill', tag: 'wave', power: P }); }
    for (const p of BATTLE.projs) if (p.team !== f.team && !p.ult && inCone(p.x, p.y, 330)) { p.team = f.team; p.owner = f; p.vx = -p.vx; p.vy = -p.vy; p.target = null; p.life = Math.max(p.life, 1); }
    if (!FX.off) for (let i = 0; i < 20; i++) { const b = a + vr(-0.6, 0.6), sp = vr(300, 600); FX.p(f.x, f.y, Math.cos(b) * sp, Math.sin(b) * sp, 0.5, vr(3, 6), col, 'spark', 1); } } });
K('dragon', { t: 'k_hoard', n: 'Dragon’s Hoard', c: 'defense', r: 'defense', i: '⛀', cd: 13, p: 55, col: '#ffd54f', self: true,
  d: 'Golden scales for 5 s: damage taken is 15% lower and every third hit releases a nova of dragonfire',
  m: ['hit-counter', 'nova-on-count', 'damage-reduction'], tg: 'self', an: 'hoard',
  fn(f, s, P, col) { const S = sx(f); S.hoardT = 5; S.hoardN = 0; S.hoardD = SDk(f, P, 0.45); burst26(f.x, f.y, col, 24, 260, 5, 0.5, 'shard'); } });
K('dragon', { t: 'k_tail', n: 'Tail Sweep', c: 'offense', r: 'melee', i: '↻', cd: 7, p: 60, col: '#ff5722', self: true,
  d: 'Spins its tail in a full circle, striking everything within 150 px twice and knocking it away',
  m: ['melee-spin', 'double-hit'], tg: 'self', an: 'tailsweep',
  fn(f, s, P, col) { if (!foesNear(f, f.x, f.y, 190).length) return false; const hit = () => { if (!f.alive) return; supBlast(f, f.x, f.y, 150, SDk(f, P, 0.45), { tag: 'collision', force: 420, power: P }); if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = col; ctx.lineWidth = 12 * (1 - q); ctx.beginPath(); ctx.arc(f.x, f.y, 140, q * 6, q * 6 + 4); ctx.stroke(); ctx.restore(); }, 0.3); };
    hit(); after(0.25, hit); } });
K('phoenix', { t: 'k_ash', n: 'Ash Cloud', c: 'environment', r: 'aoe', i: '☁', cd: 12, p: 50, col: '#ff8a65', self: true,
  d: 'Bursts into a cloud of ash for 4 s: enemies inside burn and are blinded once, the phoenix inside heals 2% HP per second',
  m: ['self-heal-zone', 'blind-zone', 'burn'], tg: 'self', an: 'ash',
  fn(f, s, P, col) { supZone(f, { kind: 'trap', custom: true, x: f.x, y: f.y, r: 170, life: 4, col, dmg: SDk(f, P, 0.1), effect: 'burn', power: P, ash26: true, onTick: (z, e, d) => { if (d < z.r && (z.ticks.get(e.uid) || 0) <= BATTLE.time) { z.ticks.set(e.uid, BATTLE.time + 0.5); dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', effect: 'burn', power: z.power, noCrit: true, sk: z.sk }); if (twReady(e, 'ash', 4) && !e.boss) sx(e).blindT = 0.4; } } });
    if (!FX.off) for (let i = 0; i < 18; i++) { const a = vr(TAU), d = vr(170); FX.p(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, vr(-15, 15), vr(-25, -5), 3, vr(16, 30), 'rgba(90,70,70,0.35)', 'smoke', 0.3); } } });
const FIREBIRD = MD('firebird', 'Firebird', '#ff6d00', '#ffd54f', '#ff9100', 'feather', ['wings']);
K('phoenix', { t: 'k_firebird', n: 'Firebird', c: 'summon', r: 'summon', i: '🜂', cd: 15, p: 55, col: '#ff9100', self: true,
  d: 'Hatches a firebird that hunts on its own, diving through enemies and setting them alight',
  m: ['minion', 'dive-attacks', 'burn'], tg: 'self', an: 'firebird',
  fn(f, s, P, col) { const u = summon26(f, FIREBIRD, f.x, f.y - f.r - 30, P, { life: 7, hp: 0.07, statMul: 0.55, rScale: 0.42, shot: { range: 340, cd: 1.6, fire: (m, t) => { const a = angTo(m, t); m.vx = dcos(a) * m.baseSpeed * 2.4; m.vy = dsin(a) * m.baseSpeed * 2.4; m.st.dash = 0.4; m.dashEffect = 'burn'; m.dashPow = P; } } }); if (!u) return false; } });
K('phoenix', { t: 'k_cinder', n: 'Cinder Wings', c: 'passive', i: '♨', p: 50, col: '#ff3d00',
  d: 'PASSIVE — below 50% HP its wings ignite: it moves 15% faster and anything it crashes into catches fire',
  m: ['passive', 'low-hp-trigger', 'burn-contact'], an: 'cinder',
  passive(f, h, sk) { const S = sx(f); S.cinderT = f.hpRatio < 0.5 ? 0.2 : 0; if (S.cinderT && !FX.off && Math.random() < 0.3) FX.p(f.x + vr(-f.r, f.r), f.y + vr(-f.r, f.r), 0, -60, 0.4, vr(3, 6), sk.color, 'dot', 1); } });
K('angel', { t: 'k_halo', n: 'Halo Throw', c: 'offense', r: 'ranged', i: '◯', cd: 10, p: 55, col: '#fff9c4',
  d: 'Throws its halo: it hovers over the target for 1.5 s pulsing holy light, then flies home and heals the angel',
  m: ['hovering-projectile', 'pulse-damage', 'return-heal'], tg: 'area', an: 'halo',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const p = predictPos(f, t, 0.6), x = inArenaX(p.x, 40), y = inArenaY(p.y, 40);
    for (let i = 0; i < 3; i++) after(0.35 + i * 0.5, () => { if (!f.alive) return; supBlast(f, x, y, 95, SDk(f, P, 0.3), { tag: 'wave', power: P }); ring26(x, y, col, 95, 0.3, 5, 20); });
    after(2, () => { if (f.alive) { healFighter(f, f.maxHp * 0.04); if (!FX.off) FX.bolt(x, y, f.x, f.y, col, 3, 0.3); } });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); const k = q < 0.12 ? q / 0.12 : q > 0.9 ? (1 - q) / 0.1 : 1, hx = q < 0.12 ? f.x + (x - f.x) * k : q > 0.9 ? x + (f.x - x) * (1 - k) : x, hy = q < 0.12 ? f.y + (y - f.y) * k : q > 0.9 ? y + (f.y - y) * (1 - k) : y;
      ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(hx, hy - 10, 48, 16, 0, 0, TAU); ctx.stroke(); ctx.restore(); }, 2); } });
K('angel', { t: 'k_guardian', n: 'Guardian Spirit', c: 'autonomous', i: '⛨', cd: 9, p: 45, col: '#ffffff',
  d: 'AUTONOMOUS — when an enemy shot is about to hit the angel or an ally, a guardian spirit appears on its own, destroys nearby shots and shields them',
  m: ['interceptor', 'auto-block', 'ally-guard'], tg: 'self', an: 'guardian',
  auto: f => { for (const a of allies(f)) for (const p of BATTLE.projs) if (p.team !== f.team && !p.ult && dist2(p.x, p.y, a.x, a.y) < (a.r + 70) * (a.r + 70)) { sx(f).guardFor = a; return true; } return false; },
  fn(f, s, P, col) { const a = (f.sx && f.sx.guardFor && f.sx.guardFor.alive) ? f.sx.guardFor : f;
    for (let k = BATTLE.projs.length - 1; k >= 0; k--) { const p = BATTLE.projs[k]; if (p.team !== f.team && !p.ult && dist2(p.x, p.y, a.x, a.y) < 140 * 140) { burst26(p.x, p.y, col, 6, 160); BATTLE.projs.splice(k, 1); } }
    a.st.shield = Math.max(a.st.shield, 1); a.st.shieldPow = Math.max(a.st.shieldPow, 0.3); ring26(a.x, a.y, col, a.r * 2.6, 0.45, 6, a.r); } });
K('angel', { t: 'k_featherfall', n: 'Feather Fall', c: 'mobility', r: 'mobility', i: '⇓', cd: 11, p: 55, col: '#fffde7',
  d: 'Rises out of reach and floats down beside the target 0.6 s later: the landing wave hurts enemies and heals allies',
  m: ['leap', 'landing-wave', 'ally-heal'], tg: 'target', ac: 'delay', an: 'featherfall',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const p = predictPos(f, t, 0.6), x = inArenaX(p.x + rand(-40, 40), f.r), y = inArenaY(p.y + rand(-40, 40), f.r);
    f.st.invuln = Math.max(f.st.invuln, 0.6); f.casting = Math.max(f.casting, 0.55); tele(x, y, 120, col, 0.6);
    after(0.6, () => { if (!f.alive) return; f.x = x; f.y = y; f.vx = f.vy = 0; supWave(f, x, y, 140, SDk(f, P, 0.55), col, { force: 450, power: P }); for (const a of allies(f)) if (len(a.x - x, a.y - y) < 160) healFighter(a, a.maxHp * 0.03); burst26(x, y, '#ffffff', 20, 260, 5, 0.6, 'shard'); }); } });
K('toxicreactor', { t: 'k_coolant', n: 'Coolant Purge', c: 'defense', r: 'defense', i: '❆', cd: 12, p: 45, col: '#18ffff', self: true,
  d: 'Vents coolant: removes its burns and poison, takes 20% less damage for 3 s, and leaves a freezing mist that slows enemies',
  m: ['self-cleanse', 'mist-slow', 'damage-reduction'], tg: 'self', an: 'coolant',
  fn(f, s, P, col) { f.st.burn = f.st.poison = 0; f.poisonStacks = 0; sx(f).coolT = 3; twMiniZone(f, f.x, f.y, 180, 4, 0, col, 'none');
    if (!FX.off) for (let i = 0; i < 20; i++) { const a = vr(TAU); FX.p(f.x, f.y, Math.cos(a) * vr(80, 260), Math.sin(a) * vr(80, 260), 0.9, vr(10, 22), 'rgba(178,235,242,0.35)', 'smoke', 1.5); } } });
K('toxicreactor', { t: 'k_fission', n: 'Chain Fission', c: 'offense', r: 'ranged', i: '⚛', cd: 9, p: 55, col: '#c6ff00',
  d: 'A neutron bolt: every enemy it hits splits it into two new bolts aimed at other enemies, for two generations',
  m: ['branching-split', 'generations', 'on-hit'], tg: 'aim', an: 'fission',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false;
    const shot = (x, y, a, gen, dmg) => supShot(f, x, y, a, { speed: 560, r: 9 - gen * 2, dmg, col, effect: 'poison', power: P, life: 1.4, homing: gen ? 3 : 0, style: 'k_ring', onHit: (p, e) => { if (gen >= 2) return; const others = supEnemies(f).filter(o => o !== e); for (let i = 0; i < 2; i++) { const o = others[i]; shot(p.x, p.y, o ? datan2(o.y - p.y, o.x - p.x) : rand(TAU), gen + 1, dmg * 0.55); } } });
    shot(f.x, f.y, aimAngle(f, t, 560), 0, SDk(f, P, 0.8)); } });
K('toxicreactor', { t: 'k_overdrive', n: 'Reactor Overdrive', c: 'transform', r: 'buff', i: '⚡', cd: 16, p: 55, col: '#76ff03', self: true,
  d: 'Pushes the reactor past its limit for 5 s: +25% attack and 20% faster cooldowns, but it loses 1% HP per second; ends with a toxic pulse',
  m: ['self-damage', 'power-buff', 'end-pulse'], tg: 'self', an: 'overdrive',
  fn(f, s, P, col) { sx(f).odT = 5; after(5, () => { if (f.alive) supWave(f, f.x, f.y, 260, SDk(f, P, 0.5), col, { effect: 'poison', force: 400, power: P }); }); burst26(f.x, f.y, col, 30, 340, 6, 0.6); } });
K('magnetar', { t: 'k_magnetize', n: 'Magnetize', c: 'environment', r: 'control', i: '⊕', cd: 12, p: 50, col: '#448aff',
  d: 'Magnetises the target for 3.5 s: the magnetar’s shots curve hard onto it, and other enemies are dragged toward it',
  m: ['magnetize-target', 'homing-boost', 'pull-others'], tg: 'target', an: 'magnetize',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(t); S.magT = 3.5; S.magBy = f; if (!FX.off) { FX.bolt(f.x, f.y, t.x, t.y, col, 3, 0.3); ring26(t.x, t.y, col, t.r * 2.4, 0.5, 5, t.r); } } });
K('magnetar', { t: 'k_filings', n: 'Iron Filings', c: 'trap', r: 'control', i: '⋯', cd: 10, p: 45, col: '#90a4ae',
  d: 'Scatters a line of iron filings toward the target: each patch an enemy crosses sticks more (3 patches root it for 0.6 s)',
  m: ['line-scatter', 'stacking-slow', 'root'], tg: 'aim', an: 'filings',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const a = angTo(f, t);
    for (let i = 1; i <= 6; i++) supZone(f, { kind: 'trap', custom: true, x: inArenaX(f.x + dcos(a) * i * 70, 20), y: inArenaY(f.y + dsin(a) * i * 70, 20), r: 34, life: 5, col, dmg: 0, onTick: (z, e, d) => { if (d < z.r + e.r * 0.4 && !z.got26) { z.got26 = true; const S = sx(e); S.filN = (S.filT > 0 ? S.filN || 0 : 0) + 1; S.filT = 3; e.st.slow = Math.max(e.st.slow, 1); if (S.filN >= 3 && !e.boss) { S.filN = 0; S.rootT = 0.6; } z.life = 0.05; } } }); } });
K('magnetar', { t: 'k_deflect', n: 'Magnetic Deflector', c: 'counter', r: 'defense', i: '⤺', cd: 11, p: 45, col: '#82b1ff', self: true,
  d: 'For 3 s a magnetic field bends enemy shots away: projectiles that come within 180 px curve off and miss',
  m: ['deflect-projectiles', 'curve'], tg: 'self', an: 'deflect',
  fn(f, s, P, col) { sx(f).deflT = 3; ring26(f.x, f.y, col, 180, 0.5, 4, f.r); } });
K('rift', { t: 'k_lash', n: 'Rift Lash', c: 'environment', r: 'control', i: '〰', cd: 11, p: 55, col: '#e040fb',
  d: 'Lashes the target with a rift whip and drags it through space to the far side of the rift ball',
  m: ['reposition-enemy', 'behind-throw', 'whip'], tg: 'target', an: 'lash',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t || len(t.x - f.x, t.y - f.y) > 520) return false; if (!FX.off) FX.bolt(f.x, f.y, t.x, t.y, col, 4, 0.4);
    dealDamage(f, t, SDk(f, P, 0.6), { kind: 'skill', tag: 'skill', power: P }); if (t.boss || t.anchored) return;
    const a = datan2(t.y - f.y, t.x - f.x) + Math.PI, d = f.r + t.r + 60; burst26(t.x, t.y, col, 12, 220); t.x = inArenaX(f.x + dcos(a) * d, t.r); t.y = inArenaY(f.y + dsin(a) * d, t.r); t.vx *= -0.3; t.vy *= -0.3; burst26(t.x, t.y, col, 14, 240); } });
K('rift', { t: 'k_fracture', n: 'Fracture Field', c: 'arena', r: 'control', i: '⟁', cd: 13, p: 50, col: '#ea80fc',
  d: 'Splits space into three jagged walls around the target for 3 s: they block movement and cut whoever touches them',
  m: ['barrier-walls', 'movement-block', 'contact-damage'], tg: 'area', an: 'fracture',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const ph = rand(TAU);
    for (let i = 0; i < 3; i++) { const a = ph + i / 3 * TAU, cx = t.x + dcos(a) * 110, cy = t.y + dsin(a) * 110, o = a + Math.PI / 2; const w = addWall26(f, cx - dcos(o) * 60, cy - dsin(o) * 60, cx + dcos(o) * 60, cy + dsin(o) * 60, { life: 3, w: 12, col, move: true, shots: false, dmg: SDk(f, P, 0.2) }); w.sk = s.uid; } } });
K('rift', { t: 'k_walker', n: 'Rift Walker', c: 'passive', i: '⤭', p: 40, col: '#ce93d8',
  d: 'PASSIVE — every third ability it casts folds space and moves it 150 px away from the closest enemy',
  m: ['passive', 'cast-counter', 'auto-reposition'], an: 'walker', passive() {} });
K('mecha', { t: 'k_nanites', n: 'Repair Nanites', c: 'defense', r: 'heal', i: '⚕', cd: 14, p: 50, col: '#69f0ae', self: true,
  d: 'Releases repair nanites: it heals 8% HP over 3 s, every robot, drone and factory heals 25% and takes 30% less damage for 4 s',
  m: ['heal-summons', 'unit-armor', 'regen'], tg: 'self', an: 'nanites',
  fn(f, s, P, col) { const S = sx(f); S.regenT = 3; S.regenK = 0.027; for (const u of BATTLE.fighters) if (u.alive && u.owner === f && u.unit) { healFighter(u, u.maxHp * 0.25, true); sx(u).armor26T = 4; if (!FX.off) FX.bolt(f.x, f.y, u.x, u.y, col, 2, 0.3); } } });

/* ---------------- states and hooks for the skills above ---------------- */
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const S = tgt.sx; if (!S) return amt;
  if (S.scaleT > 0 && o.kind !== 'dot') S.scaleD = (S.scaleD || 0) + amt;
  if (S.watchT > 0) S.watchD = (S.watchD || 0) + amt;
  if (S.uncT > 0 && o.kind === 'skill' && rand() < 0.5) { const a = rand(TAU); tgt.x = inArenaX(tgt.x + dcos(a) * 90, tgt.r); tgt.y = inArenaY(tgt.y + dsin(a) * 90, tgt.r); if (!FX.off) FX.text(tgt.x, tgt.y - tgt.r - 20, 'UNCERTAIN', '#18ffff', 13, { life: 0.5 }); return 0; }
  if (S.barT > 0 && src && o.kind !== 'dot') { const fa = datan2(tgt.vy, tgt.vx), aa = datan2(src.y - tgt.y, src.x - tgt.x), da = Math.abs(((aa - fa + Math.PI * 3) % TAU) - Math.PI); if (da < 1.05) amt *= 0.4; }
  if (S.hoardT > 0 && o.kind !== 'dot') { amt *= 0.85; S.hoardN = (S.hoardN || 0) + 1; if (S.hoardN % 3 === 0) after(0, () => { if (tgt.alive) { supWave(tgt, tgt.x, tgt.y, 200, S.hoardD, '#ff6d00', { effect: 'burn', force: 450 }); } }); }
  if (S.coolT > 0 && o.kind !== 'dot') amt *= 0.8;
  if (S.armor26T > 0) amt *= 0.7;
  if (S.aiPos && hasPas(tgt, 'k_afterimage') && o.kind === 'skill' && amt > tgt.maxHp * 0.05 && twReady(tgt, 'aiblink', 8)) { const p = S.aiPos; after(0, () => { if (!tgt.alive) return; burst26(tgt.x, tgt.y, '#ffe57f', 12, 220); tgt.x = inArenaX(p.x, tgt.r); tgt.y = inArenaY(p.y, tgt.r); burst26(tgt.x, tgt.y, '#ffe57f', 16, 260); }); }
  if (amt >= tgt.maxHp * 0.08 && src && src.alive && src.team !== tgt.team) { S.bigHitT = 1; S.bigHitBy = src.credit || src; }
  return amt;
});
SUP.collideHooks.push((a, b) => {
  const S = a.sx; if (!S) return;
  if (S.mantleT > 0) { S.mantleT = 0; dealDamage(a, b, SDk(a, S.mantleP || 55, 0.6), { kind: 'skill', tag: 'collision', effect: 'weaken', power: 60 }); burst26(b.x, b.y, '#7c4dff', 20, 300, 5, 0.5); }
  if (S.cinderT > 0 && twReady(b, 'cinder' + a.sid, 1)) applyEffect(a, b, 'burn', 55);
  if (S.barT > 0 && len(a.vx, a.vy) > a.baseSpeed * 1.2 && twReady(a, 'boom', 1.2)) supWave(a, a.x, a.y, 160, SDk(a, S.barP || 55, 0.35), '#40c4ff', { force: 500, effect: 'stun' });
});
MOD26.push((f, S, m) => {
  if (S.coronaT > 0) m.atk *= 1.15;
  if (S.odT > 0) { m.atk *= 1.25; m.cd *= 0.8; }
  if (S.heatDeathT > 0) { m.spd *= 0.6; m.cd *= 1.4; }
  if (S.inflSelfT > 0) m.spd *= 1.3;
  if (S.cinderT > 0) m.spd *= 1.15;
  if (S.hasteIn > 0) m.spd *= S.hasteIn > 1 ? 1.25 : 0.75;
  if (S.bridgeIn > 0) m.spd *= 1.25;
});
CAST26.push((f, sk) => {
  for (const e of BATTLE.fighters) { const S = e.sx; if (S && S.resoT > 0 && S.resoBy === f && e.alive && sk.type !== 'k_resonance') { _dealDamage26(f, e, S.resoD || 2, { kind: 'skill', noCrit: true }); if (!FX.off) ring26(e.x, e.y, '#80d8ff', e.r * 1.8, 0.25, 3, e.r); } }
  if (hasPas(f, 'k_walker') && !f.autoCasting) { const S = sx(f); S.walkN = (S.walkN || 0) + 1; if (S.walkN % 3 === 0) { const e = nearestEnemy(f); if (e) { const a = datan2(f.y - e.y, f.x - e.x); burst26(f.x, f.y, '#ce93d8', 10, 200); f.x = inArenaX(f.x + dcos(a) * 150, f.r); f.y = inArenaY(f.y + dsin(a) * 150, f.r); burst26(f.x, f.y, '#ce93d8', 12, 220); } } }
});
{ const pt = AIController.prototype.pickTarget;      // Umbral Mantle: far enemies cannot find a cloaked shadow
  AIController.prototype.pickTarget = function () { const t = pt.call(this); if (t && t.sx && t.sx.mantleT > 0 && len(t.x - this.f.x, t.y - this.f.y) > 260) { const o = this.f.enemies().filter(e => e !== t && !(e.st.outside > 0) && !(e.sx && e.sx.mantleT > 0)); return o[0] || null; } return t; }; }
SUP.worldHooks.push((B, h) => {
  for (const f of B.fighters) {
    const S = f.sx; if (!S || !f.alive) continue;
    if (S.liftT > 0) { const dl = f.x - ARENA.x, dr = ARENA.r - f.x, dt = f.y - ARENA.y, db = ARENA.b - f.y, m = Math.min(dl, dr, dt, db); const ax = m === dl ? -1 : m === dr ? 1 : 0, ay = m === dt ? -1 : m === db ? 1 : 0; f.vx += ax * 2400 * h; f.vy += ay * 2400 * h; }
    if (S.decay) { const D = S.decay; D.k += h; if (D.k >= 1.5 && D.n < 3) { D.k = 0; _dealDamage26(D.by && D.by.alive ? D.by : null, f, D.base * [1, 2, 4][D.n], { kind: 'skill', noCrit: true, effect: 'poison', power: 50 }); D.n++; if (!FX.off) ring26(f.x, f.y, '#d4ff00', f.r * (1.6 + D.n * 0.4), 0.3, 4, f.r); }
      if (S.decayT <= h * 1.5) { if (D.spread && D.by && D.by.alive) for (const e of foesNear(D.by, f.x, f.y, 200)) if (e !== f) decayOn(D.by, e, D.base * 0.5, false); S.decay = null; } }
    if (S.domeT > 0) for (let k = B.projs.length - 1; k >= 0; k--) { const p = B.projs[k]; if (p.team !== f.team && !p.ult && dist2(p.x, p.y, f.x, f.y) < 150 * 150) { B.projs.splice(k, 1); const a = datan2(p.y - f.y, p.x - f.x); twMiniZone(f, f.x + dcos(a) * 175, f.y + dsin(a) * 175, 40, 2.5, skillDmg(f, S.domeP || 55) * 0.07, '#eeff41', 'poison'); } }
    if (S.coronaT > 0 && twReady(f, 'corona', 0.5)) for (const e of foesNear(f, f.x, f.y, f.r + 70)) _dealDamage26(f, e, S.coronaD || 2, { kind: 'skill', effect: 'burn', power: 50, noCrit: true });
    if (S.lockT > 0 && S.lockBy && S.lockBy.alive) { S.lockA += 2.2 * h; const o = S.lockBy; f.x = inArenaX(o.x + dcos(S.lockA) * S.lockR, f.r); f.y = inArenaY(o.y + dsin(S.lockA) * S.lockR, f.r); f.vx = -dsin(S.lockA) * 300; f.vy = dcos(S.lockA) * 300; if (twReady(f, 'lock', 0.7)) _dealDamage26(o, f, S.lockD || 2, { kind: 'skill', noCrit: true }); }
    if (S.webT > 0 && S.webBy) { const d = len(f.x - S.webX, f.y - S.webY); if (d > 150 && twReady(f, 'web', 0.6)) { knock(f, S.webX, S.webY, -900); _dealDamage26(S.webBy.alive ? S.webBy : null, f, S.webD || 2, { kind: 'skill', noCrit: true }); if (!FX.off) FX.bolt(S.webX, S.webY, f.x, f.y, '#7c4dff', 2, 0.25); } }
    if (S.inflT > 0 && S.inflBy) { const o = S.inflBy, d = len(f.x - o.x, f.y - o.y) || 1; f.vx += (f.x - o.x) / d * 900 * h; f.vy += (f.y - o.y) / d * 900 * h; }
    if (S.bindT > 0) { const d = len(f.x - S.bindX, f.y - S.bindY); if (d > 170) { const k = 170 / d; f.x = S.bindX + (f.x - S.bindX) * k; f.y = S.bindY + (f.y - S.bindY) * k; f.vx *= -0.5; f.vy *= -0.5; if (twReady(f, 'bind', 0.6)) _dealDamage26(S.bindBy && S.bindBy.alive ? S.bindBy : null, f, S.bindD || 2, { kind: 'skill', noCrit: true }); } }
    if (S.magT > 0 && S.magBy && S.magBy.alive) { for (const p of B.projs) if (p.owner === S.magBy && !p.ult) { p.target = f; p.homing = Math.max(p.homing || 0, 6); } for (const e of B.fighters) if (e.alive && e !== f && e.team === f.team && !e.boss) { const d = len(e.x - f.x, e.y - f.y); if (d < 320 && d > 1) { e.vx += (f.x - e.x) / d * 500 * h; e.vy += (f.y - e.y) / d * 500 * h; } } }
    if (S.deflT > 0) for (const p of B.projs) { if (p.team === f.team || p.ult) continue; const dx = p.x - f.x, dy = p.y - f.y, d = len(dx, dy); if (d < 180 && d > 1) { const s = (dx * p.vy - dy * p.vx) > 0 ? 1 : -1, sp = p.speed || len(p.vx, p.vy); let a = datan2(p.vy, p.vx); a += s * 6 * h; p.vx = dcos(a) * sp; p.vy = dsin(a) * sp; } }
    if (S.hasteIn > 0) S.hasteIn = 0; if (S.bridgeIn > 0) S.bridgeIn = 0;
  }
  for (const z of B.zones) {
    if (z.proto26) { const age = B.time - z.t0; z.r = 20 + age * 18; for (const e of supEnemies(z.owner)) { const d = len(e.x - z.x, e.y - z.y); if (d < 260 && d > 1) { e.vx += (z.x - e.x) / d * 260 * h; e.vy += (z.y - e.y) / d * 260 * h; } }
      const touched = supEnemies(z.owner).some(e => len(e.x - z.x, e.y - z.y) < z.r + e.r);
      if ((touched || z.life <= h * 1.5) && !z.burst26) { z.burst26 = true; const k = clamp(age / 4, 0.3, 1); supBlast(z.owner, z.x, z.y, z.r + 70, z.proto26 * k, { tag: 'explosion', force: 600 }); if (!FX.off) { ring26(z.x, z.y, z.col, z.r + 70, 0.45, 10); burst26(z.x, z.y, z.col, 40, 460, 7, 0.7); } z.life = 0; }
      if (!FX.off && Math.random() < 0.5) FX.p(z.x + vr(-z.r, z.r), z.y + vr(-z.r, z.r), 0, 0, 0.3, vr(3, 7), z.col); }
    if (z.lens26) for (const p of B.projs) if (p.team !== z.team && !p.ult && !p.lensed && dist2(p.x, p.y, z.x, z.y) < z.r * z.r) { p.lensed = true; const t = nearestEnemy(z.owner); p.team = z.team; p.owner = z.owner; p.target = t; p.homing = Math.max(p.homing || 0, 5); if (!FX.off) burst26(p.x, p.y, z.col, 6, 160); }
    if (z.fog26) for (const p of B.projs) if (p.team !== z.team && !p.fogged && dist2(p.x, p.y, z.x, z.y) < z.r * z.r) { p.fogged = true; const a = datan2(p.vy, p.vx) + rand(-0.7, 0.7), sp = len(p.vx, p.vy); p.vx = dcos(a) * sp; p.vy = dsin(a) * sp; p.homing = 0; }
    if (z.haste26) for (const e of B.fighters) if (e.alive && !e.unit && len(e.x - z.x, e.y - z.y) < z.r + e.r) sx(e).hasteIn = e.team === z.team ? 2 : 1;
    if (z.ash26) { const o = z.owner; if (o.alive && len(o.x - z.x, o.y - z.y) < z.r) healFighter(o, o.maxHp * 0.02 * h, true); }
  }
  if (B.bridges26) { B.bridges26 = B.bridges26.filter(b => (b.t -= h) > 0); for (const b of B.bridges26) for (const e of B.fighters) if (e.alive && e.team === b.team && segDist(e.x, e.y, b.x0, b.y0, b.x1, b.y1) < e.r + 20) sx(e).bridgeIn = 1; }
  for (const o of B.orbs) if (o.shrink26 && o.rad > 60) o.rad -= o.shrink26 * h;
});
/* =====================================================================
   2.6.0 NEW SKILLS — ANCIENT (+4) and SECRET (+4, Anti Ball +1) balls.
   ===================================================================== */
/* ---------------- ANCIENT ---------------- */
K('demon', { t: 'k_hellchains', n: 'Hellgate Chains', c: 'trap', r: 'control', i: '⛓', cd: 12, p: 55, col: '#ff3d00',
  d: 'Chains burst from the ground under the target (warning first): it is rooted for 1 s, then dragged toward a burning hellgate',
  m: ['ground-chains', 'root', 'pull-to-gate'], tg: 'area', ac: 'delay', an: 'hellchains',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const p = predictPos(f, t, 0.4), gx = inArenaX((p.x + f.x) / 2, 60), gy = inArenaY((p.y + f.y) / 2, 60); tele(p.x, p.y, 70, col, 0.4);
    after(0.4, () => { if (!f.alive) return; for (const e of foesNear(f, p.x, p.y, 75)) { if (!e.boss) sx(e).rootT = 1; dealDamage(f, e, SDk(f, P, 0.5), { kind: 'skill', tag: 'strike', power: P }); const S = sx(e); S.gateT = 2; S.gateX = gx; S.gateY = gy; if (!FX.off) for (let i = 0; i < 4; i++) FX.bolt(e.x + vr(-50, 50), e.y + 50, e.x, e.y, '#4e342e', 3, 0.5); }
      twMiniZone(f, gx, gy, 80, 2.4, SDk(f, P, 0.1), col, 'burn'); }); } });
const IMP = MD('imp', 'Imp', '#4a0000', '#ff3d00', '#ff6e40', 'flame', ['horns']);
K('demon', { t: 'k_imps', n: 'Imp Legion', c: 'summon', r: 'summon', i: '♆', cd: 16, p: 50, col: '#ff6e40', self: true,
  d: 'Calls three imps from below; they keep their distance and lob little skull-fireballs at enemies',
  m: ['multi-minion', 'ranged-minions'], tg: 'self', an: 'imps',
  fn(f, s, P, col) { let n = 0; for (let i = 0; i < 3; i++) { const a = f.rot + i / 3 * TAU; if (summon26(f, IMP, f.x + dcos(a) * f.r * 2.6, f.y + dsin(a) * f.r * 2.6, P, { life: 7, hp: 0.05, statMul: 0.45, rScale: 0.38, shot: { range: 420, cd: 1.4, fire: (m, t) => supShot(m, m.x, m.y, aimAngle(m, t, 420), { speed: 420, r: 6, dmg: SDk(f, P, 0.12), col, effect: 'burn', power: P, style: 'k_skullfire', life: 1.6 }) } })) n++; } return n ? undefined : false; } });
K('demon', { t: 'k_contract', n: 'Infernal Contract', c: 'transform', r: 'buff', i: '✍', cd: 18, p: 55, col: '#d50000', self: true,
  d: 'Signs away 15% of its current HP: for 6 s its abilities are 20% stronger and leave hellfire where its target stands',
  m: ['hp-cost', 'empower-abilities', 'hellfire-patches'], tg: 'self', an: 'contract',
  fn(f, s, P, col) { if (f.hpRatio < 0.25) return false; f.hp -= f.hp * 0.15; sx(f).contractT = 6; burst26(f.x, f.y, col, 34, 360, 6, 0.7); say26(f, 'CONTRACT SIGNED', col); } });
K('demon', { t: 'k_brimstone', n: 'Brimstone Rain', c: 'environment', r: 'aoe', i: '☄', cd: 14, p: 55, col: '#ff9100',
  d: 'Sulphur rains on the half of the arena the target is in: ten burning strikes fall there over 3 s',
  m: ['half-arena', 'random-strikes', 'burn'], tg: 'global', ac: 'delay', an: 'brimstone',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const left = t.x < ARENA.cx, x0 = left ? ARENA.x + 40 : ARENA.cx, w = ARENA.w / 2 - 40;
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.18 * (1 - q); ctx.fillStyle = col; ctx.fillRect(x0, ARENA.y, w, ARENA.h); ctx.restore(); }, 3.2);
    for (let i = 0; i < 10; i++) supStrike(f, x0 + rand(w), ARENA.y + 40 + rand(ARENA.h - 80), 0.5 + i * 0.28, 55, SDk(f, P, 0.2), col, { kind: 'meteor', effect: 'burn', power: P }); } });
K('chaos', { t: 'k_dice', n: 'Dice of Fate', c: 'transform', r: 'buff', i: '⚄', cd: 11, p: 55, col: '#ff4081', self: true,
  d: 'Rolls the dice of fate: 1 heal • 2 shield • 3 giant bolt • 4 stunning nova • 5 a chaos clone • 6 JACKPOT (all of them, weaker)',
  m: ['random-outcome', 'six-results'], tg: 'self', an: 'dice',
  fn(f, s, P, col, tgt) { const roll = 1 + Math.floor(rand(6)), t = tgtOr(f, tgt), k = roll === 6 ? 0.6 : 1;
    const go = n => { if (n === 1) healFighter(f, f.maxHp * 0.1 * k); if (n === 2) { f.st.shield = Math.max(f.st.shield, 3); f.st.shieldPow = Math.max(f.st.shieldPow, 0.45 * k); }
      if (n === 3 && t) supShot(f, f.x, f.y, aimAngle(f, t, 520), { speed: 520, r: 16, dmg: SDk(f, P, 1.2 * k), col, power: P, style: 'k_cube' });
      if (n === 4) supWave(f, f.x, f.y, 220, SDk(f, P, 0.5 * k), col, { effect: 'stun', force: 500, power: P });
      if (n === 5 && BATTLE.fighters.filter(c => c.isClone && c.owner === f && c.alive).length < 2) spawnClone(f, P * k, 5, rand(TAU)); };
    if (roll === 6) for (let n = 1; n <= 5; n++) go(n); else go(roll);
    if (!FX.off) { FX.text(f.x, f.y - f.r - 56, '⚀⚁⚂⚃⚄⚅'[roll - 1] + ' ' + ['', 'HEAL', 'SHIELD', 'BOLT', 'NOVA', 'CLONE', 'JACKPOT!'][roll], col, roll === 6 ? 22 : 17, { life: 1.2, pop: 1.5 }); } } });
K('chaos', { t: 'k_chaosgrav', n: 'Chaos Gravity', c: 'arena', r: 'control', i: '⤡', cd: 14, p: 45, col: '#ea80fc', self: true,
  d: 'Unhinges gravity for 3.5 s: every 0.7 s it lurches in a new random direction, flinging enemies around',
  m: ['global-force', 'shifting-direction'], tg: 'global', an: 'chaosgrav',
  fn(f, s, P, col) { const S = BATTLE.chaosGrav26 = { team: f.team, t: 3.5, a: rand(TAU), k: 0.7, by: f }; if (!FX.off) FX.addShake(5); } });
K('chaos', { t: 'k_disorder', n: 'Disorder', c: 'counter', r: 'defense', i: '⇄', cd: 11, p: 50, col: '#f50057',
  d: 'Hands all its own burns, poison, slows, weakness and stuns to the target and is cleansed of them',
  m: ['transfer-debuffs', 'cleanse'], tg: 'target', an: 'disorder',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const st = f.st, moved = [];
    for (const k of ['burn', 'poison', 'slow', 'weaken', 'freeze', 'stun']) if (st[k] > 0) { moved.push(k); if (k === 'stun' && t.boss) continue; t.st[k] = Math.max(t.st[k], st[k]); st[k] = 0; }
    if (t.st.burn > 0) { t.burnDps = Math.max(t.burnDps, f.burnDps || 2); t.dotSrc = f; } if (t.st.poison > 0) { t.poisonStacks = Math.max(t.poisonStacks, f.poisonStacks || 1); t.poisonDps = Math.max(t.poisonDps, f.poisonDps || 1.5); t.dotSrc = f; } f.poisonStacks = 0;
    dealDamage(f, t, SDk(f, P, 0.25 + moved.length * 0.12), { kind: 'skill', tag: 'skill', power: P }); if (!FX.off) FX.bolt(f.x, f.y, t.x, t.y, col, 3, 0.35); } });
K('chaos', { t: 'k_butterfly', n: 'Butterfly Effect', c: 'passive', i: '🦋', p: 45, col: '#ff80ab',
  d: 'PASSIVE — every hit it lands has a 10% chance to cause a random extra effect (burn, freeze, poison, stun, slow or weakness)',
  m: ['passive', 'proc-chance', 'random-status'], an: 'butterfly', passive() {} });
const PHYLACTERY = MD('phylactery', 'Phylactery', '#1b5e20', '#b9f6ca', '#69f0ae', 'souls', ['halo'], [90, 10, 80, 0, 0]);
K('immortal', { t: 'k_phylactery', n: 'Phylactery', c: 'defense', r: 'defense', i: '⚱', cd: 18, p: 50, col: '#69f0ae', self: true,
  d: 'Hides part of its soul in a vessel nearby: while the vessel stands (8 s, it can be destroyed), the Immortal takes 30% less damage',
  m: ['vessel-unit', 'damage-reduction-link'], tg: 'self', an: 'phylactery',
  fn(f, s, P, col) { if (f.sx && f.sx.phyl && f.sx.phyl.alive) return false; const a = datan2(ARENA.cy - f.y, ARENA.cx - f.x); const u = anchor26(f, PHYLACTERY, f.x - dcos(a) * 120, f.y - dsin(a) * 120, P, { life: 8, hp: 0.14, rScale: 0.55 }); if (!u) return false; sx(f).phyl = u; } });
K('immortal', { t: 'k_return', n: 'Eternal Return', c: 'counter', r: 'defense', i: '∞', cd: 13, p: 50, col: '#b9f6ca', self: true,
  d: 'For 2.5 s every wound it takes starts to undo itself: half of each hit is healed back two seconds later',
  m: ['delayed-undo-heal'], tg: 'self', an: 'return',
  fn(f, s, P, col) { sx(f).returnT = 2.5; ring26(f.x, f.y, col, f.r * 2.6, 0.5, 5, f.r); } });
K('immortal', { t: 'k_ageless', n: 'Ageless Vigor', c: 'passive', i: '❦', p: 45, col: '#a5d6a7',
  d: 'PASSIVE — after 3 s without taking damage it regenerates 0.8% HP per second',
  m: ['passive', 'out-of-combat-regen'], an: 'ageless',
  passive(f, h, sk) { const S = sx(f); if (BATTLE.time - (S.hurtAt || 0) > 3) healFighter(f, f.maxHp * 0.008 * h, true); } });
K('immortal', { t: 'k_wrath', n: 'Undying Wrath', c: 'offense', r: 'melee', i: '✊', cd: 9, p: 60, col: '#76ff03',
  d: 'A crushing close-range blast whose damage grows with every bit of HP the Immortal is missing (up to double)',
  m: ['missing-hp-scaling', 'close-blast'], tg: 'target', an: 'wrath',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t || len(t.x - f.x, t.y - f.y) > 240 + t.r) return false; const k = 1 + (1 - f.hpRatio);
    supBlast(f, t.x, t.y, 90, SDk(f, P, 0.75 * k), { tag: 'explosion', force: 600, power: P }); if (!FX.off) { FX.bolt(f.x, f.y, t.x, t.y, col, 6, 0.3); ring26(t.x, t.y, col, 90, 0.35, 10); FX.addShake(6); } } });

/* ---------------- SECRET ---------------- */
K('infinity', { t: 'k_mobius', n: 'Möbius Strip', c: 'offense', r: 'aoe', i: '∞', cd: 11, p: 55, col: '#e040fb',
  d: 'Launches an orb that traces an endless figure-eight around the target for 3 s, cutting through everything on its loop',
  m: ['figure-eight-path', 'lingering-projectile'], tg: 'area', an: 'mobius',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const cx = inArenaX(t.x, 140), cy = inArenaY(t.y, 90);
    supShot(f, cx, cy, 0, { speed: 1, r: 13, dmg: SDk(f, P, 0.3), col, life: 3, power: P, pierce: 99, style: 'k_ring', data: { age: 0, cx, cy }, tick: (p, h) => { const D = p.data; D.age += h; const a = D.age * 2.4; p.vx = 0; p.vy = 0; p.x = D.cx + Math.sin(a) * 130; p.y = D.cy + Math.sin(a) * Math.cos(a) * 80; if ((D.reset = (D.reset || 0) - h) <= 0) { D.reset = 0.6; p.hits = new Set(); } } }); } });
K('infinity', { t: 'k_recursion', n: 'Recursion', c: 'transform', r: 'buff', i: '↻', cd: 10, p: 50, col: '#d500f9', self: true,
  d: 'Calls itself again: instantly re-casts the last other ability it used, at 55% power',
  m: ['repeat-last-own'], tg: 'self', an: 'recursion',
  fn(f, s, P, col) { const last = f.sx && f.sx.lastCast; const sk = last && f.skills.find(k => k.uid === last && k !== s && !k.passive26 && !k.auto26); if (!sk) return false;
    const copy = { ...sk, power: (sk.power || 50) * 0.55, cdLeft: 0, name: '↻ ' + sk.name, copied: true }; const ok = _useSkill26(f, copy); if (!ok) return false; } });
K('infinity', { t: 'k_looptrap', n: 'Loop Trap', c: 'trap', r: 'control', i: '⟳', cd: 13, p: 45, col: '#ea80fc',
  d: 'Closes space into a 160 px loop around the target for 4 s: whoever tries to leave comes back in on the opposite side',
  m: ['wraparound-zone', 'containment'], tg: 'area', an: 'looptrap',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; supZone(f, { kind: 'trap', custom: true, x: t.x, y: t.y, r: 160, life: t.boss ? 2 : 4, col, dmg: SDk(f, P, 0.06), loop26: true });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.6 * (1 - q * 0.5); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([16, 8]); ctx.lineDashOffset = q * 200; ctx.beginPath(); ctx.arc(t.x, t.y, 160, 0, TAU); ctx.stroke(); ctx.restore(); }, t.boss ? 2 : 4); } });
K('infinity', { t: 'k_limitless', n: 'Limitless', c: 'passive', i: '⧖', p: 40, col: '#f3e5f5',
  d: 'PASSIVE — its cooldowns run 15% faster for each enemy within 300 px (up to two)',
  m: ['passive', 'proximity-cdr'], an: 'limitless', passive() {} });
K('omniverse', { t: 'k_multibarrage', n: 'Multiversal Barrage', c: 'offense', r: 'ranged', i: '⟁', cd: 11, p: 55, col: '#7c4dff',
  d: 'Three parallel universes open windows around the arena and fire lasers that cross where the target is heading',
  m: ['remote-lasers', 'triangulate'], tg: 'area', ac: 'charge', an: 'multibarrage',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const p = predictPos(f, t, 0.7), ph = rand(TAU);
    for (let i = 0; i < 3; i++) { const a = ph + i / 3 * TAU, sx0 = inArenaX(p.x + dcos(a) * 420, 20), sy0 = inArenaY(p.y + dsin(a) * 300, 20), e = rayToWall(sx0, sy0, datan2(p.y - sy0, p.x - sx0)); addLaser(f, [sx0, sy0, e.x, e.y], { charge: 0.7, dur: 0.25, w: 12, dmg: SDk(f, P, 0.42), col }); ring26(sx0, sy0, col, 30, 0.9, 4, 6); } } });
K('omniverse', { t: 'k_rewrite', n: 'Cosmic Rewrite', c: 'environment', r: 'control', i: '✎', cd: 16, p: 50, col: '#b388ff', self: true,
  d: 'Rewrites the arena’s laws for 3.5 s in its favour: a random world — frozen (enemies slowed), storm (lightning on enemies) or inverted (enemies steer backwards)',
  m: ['arena-condition', 'random-biome'], tg: 'global', an: 'rewrite',
  fn(f, s, P, col) { if (BATTLE.cond) return false; const k = ['frozen', 'storm', 'shift'][Math.floor(rand(3))]; BATTLE.cond = { kind: k, team: f.team, by: f, t: 3.5 };
    if (!FX.off) { FX.text(ARENA.cx, ARENA.y + 60, 'REWRITTEN: ' + { frozen: 'FROZEN WORLD', storm: 'STORM WORLD', shift: 'INVERTED WORLD' }[k], col, 24, { life: 1.6, vy: 0 }); FX.addFlash(0.12, col); } } });
K('omniverse', { t: 'k_fatebranch', n: 'Fate Branch', c: 'defense', r: 'defense', i: '⑂', cd: 13, p: 50, col: '#9575cd', self: true,
  d: 'For 3 s fate branches: any heavy hit (over 5% HP) is halved and the other half splits off into a decoy self',
  m: ['decoy-on-hit', 'damage-halving'], tg: 'self', an: 'fatebranch',
  fn(f, s, P, col) { const S = sx(f); S.branchT = 3; S.branchN = 2; ring26(f.x, f.y, col, f.r * 2.4, 0.4, 5, f.r); } });
K('omniverse', { t: 'k_omniscience', n: 'Omniscience', c: 'passive', i: '👁', p: 40, col: '#d1c4e9',
  d: 'PASSIVE — sees every possible future: +10% critical chance and its aimed abilities never miss their prediction',
  m: ['passive', 'aim-assist', 'crit'], an: 'omniscience', passive() {} });
K('reality', { t: 'k_undomove', n: 'Undo Movement', c: 'environment', r: 'control', i: '⎌', cd: 11, p: 45, col: '#00e5ff',
  d: 'Presses undo on the target: it is snapped back to wherever it was 1.5 s ago',
  m: ['rewind-enemy-position'], tg: 'target', an: 'undomove',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t || t.boss || t.anchored || !t.hist26 || t.hist26.length < 6) return false; const p = t.hist26[0];
    if (!FX.off) { vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = col; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.restore(); }, 0.5); burst26(t.x, t.y, col, 12, 220); }
    t.x = inArenaX(p.x, t.r); t.y = inArenaY(p.y, t.r); dealDamage(f, t, SDk(f, P, 0.35), { kind: 'skill', tag: 'skill', power: P }); } });
K('reality', { t: 'k_paradox', n: 'Paradox', c: 'counter', r: 'defense', i: '⧗', cd: 12, p: 50, col: '#18ffff', self: true,
  d: 'For 2 s a paradox surrounds it: every enemy ability that hits it also hits its own caster for half the damage',
  m: ['mirror-damage-to-caster', 'abilities-only'], tg: 'self', an: 'paradox',
  fn(f, s, P, col) { sx(f).paradoxT = 2; ring26(f.x, f.y, col, f.r * 2.2, 0.4, 5, f.r); } });
K('reality', { t: 'k_tears', n: 'Reality Tears', c: 'arena', r: 'control', i: '⌇', cd: 14, p: 50, col: '#84ffff', self: true,
  d: 'Rips three tears in the arena for 5 s: an enemy that touches one is thrown out of another and hurt',
  m: ['teleport-hazards', 'arena-objects'], tg: 'global', an: 'tears',
  fn(f, s, P, col) { const pts = [0, 1, 2].map(() => ({ x: ARENA.x + 120 + rand(ARENA.w - 240), y: ARENA.y + 100 + rand(ARENA.h - 200) }));
    BATTLE.tears26 = { pts, t: 5, team: f.team, by: f, dmg: SDk(f, P, 0.35), sk: s.uid };
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.85 * (1 - q * 0.4); ctx.strokeStyle = col; ctx.lineWidth = 4; for (const p of pts) { ctx.beginPath(); ctx.moveTo(p.x, p.y - 34); ctx.lineTo(p.x + 8, p.y - 10); ctx.lineTo(p.x - 6, p.y + 8); ctx.lineTo(p.x + 4, p.y + 34); ctx.stroke(); } ctx.restore(); }, 5); } });
K('reality', { t: 'k_lucid', n: 'Lucid Dream', c: 'transform', r: 'buff', i: '☾', cd: 14, p: 45, col: '#b2ebf2', self: true,
  d: 'Drifts into a lucid dream for 4 s: a quarter of all hits pass through it and it moves 15% faster',
  m: ['miss-chance', 'speed-buff', 'self-transform'], tg: 'self', an: 'lucid',
  fn(f, s, P, col) { sx(f).lucidT = 4; burst26(f.x, f.y, col, 20, 220, 5, 0.6); } });
K('soul', { t: 'k_soullink', n: 'Soul Link', c: 'trap', r: 'curse', i: '⚯', cd: 12, p: 50, col: '#b388ff',
  d: 'Binds two enemies’ souls for 4 s: 40% of the damage one takes is also dealt to the other (alone, the enemy is bound to the Soul Ball’s wounds instead)',
  m: ['link-enemies', 'damage-share'], tg: 'target', an: 'soullink',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const o = supEnemies(f).filter(e => e !== t && !e.isClone).sort((a, b) => dist2(a.x, a.y, t.x, t.y) - dist2(b.x, b.y, t.x, t.y))[0];
    if (o) { sx(t).linkT = 4; sx(t).linkTo = o; sx(o).linkT = 4; sx(o).linkTo = t; } else { sx(f).mirrorLinkT = 4; sx(f).mirrorLink = t; }
    if (!FX.off) FX.bolt(t.x, t.y, (o || f).x, (o || f).y, col, 3, 0.5); } });
K('soul', { t: 'k_wandering', n: 'Wandering Souls', c: 'summon', r: 'summon', i: '☄', cd: 13, p: 50, col: '#ce93d8', self: true,
  d: 'Releases four lost souls that drift through the arena for 5 s; a soul that touches an enemy clings to it and drains it',
  m: ['wandering-minions', 'attach-drain'], tg: 'self', an: 'wandering',
  fn(f, s, P, col) { for (let i = 0; i < 4; i++) supShot(f, f.x, f.y, i / 4 * TAU + rand(0.5), { speed: 170, r: 9, dmg: SDk(f, P, 0.12), col, life: 5, homing: 0.9, style: 'spirit', power: P, onHit: (p, e) => { const S = sx(e); S.soulT = 2; S.soulD = SDk(f, P, 0.07); S.soulBy = f; } }); } });
K('soul', { t: 'k_spiritwalk', n: 'Spirit Walk', c: 'mobility', r: 'mobility', i: '👻', cd: 12, p: 50, col: '#e1bee7',
  d: 'Leaves its body (which cannot be hurt) and its spirit flies out and back through the enemy, hurting everything it passes; the body then heals 3%',
  m: ['out-of-body', 'path-return-strike'], tg: 'aim', an: 'spiritwalk',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; f.st.invuln = Math.max(f.st.invuln, 1.2); f.casting = Math.max(f.casting, 1.1);
    supShot(f, f.x, f.y, angTo(f, t), { speed: 620, r: 14, dmg: SDk(f, P, 0.45), col, life: 1.3, pierce: 9, style: 'spirit', power: P, data: { age: 0 }, tick: (p, h) => { p.data.age += h; if (p.data.age > 0.6 && !p.data.back) { p.data.back = true; p.hits = new Set(); p.target = f; p.homing = 12; } if (p.data.back && dist2(p.x, p.y, f.x, f.y) < (f.r + 14) * (f.r + 14)) p.life = 0; } });
    after(1.2, () => { if (f.alive) healFighter(f, f.maxHp * 0.03); }); } });
K('soul', { t: 'k_collector', n: 'Soul Collector', c: 'passive', i: '⚱', p: 40, col: '#b39ddb',
  d: 'PASSIVE — collects a soul whenever an enemy falls or loses another 25% of its HP: +3% attack per soul (up to 5)',
  m: ['passive', 'stacking-attack', 'soul-harvest'], an: 'collector', passive() {} });
const KNIGHT = MD('knight', 'Dimension Knight', '#1a237e', '#ffd54f', '#7c4dff', 'armor', ['crown'], [90, 60, 60, 70, 10]);
K('dimensionking', { t: 'k_knights', n: 'Royal Summons', c: 'summon', r: 'summon', i: '♞', cd: 16, p: 55, col: '#7c4dff', self: true,
  d: 'Two royal knights step out of a portal to guard the king; they charge any enemy that comes near him',
  m: ['bodyguard-minions', 'melee-minions'], tg: 'self', an: 'knights',
  fn(f, s, P, col) { let n = 0; for (const k of [-1, 1]) { openPortal(f.x + k * 90, f.y, { r: 40, life: 0.8, col }); if (summon26(f, KNIGHT, f.x + k * 90, f.y, P, { life: 8, hp: 0.1, statMul: 0.65, rScale: 0.55, shot: { range: 260, cd: 1.8, fire: (m, t) => { const a = angTo(m, t); m.vx = dcos(a) * m.baseSpeed * 2.2; m.vy = dsin(a) * m.baseSpeed * 2.2; m.st.dash = 0.4; } } })) n++; } return n ? undefined : false; } });
K('dimensionking', { t: 'k_exile', n: 'Edict of Exile', c: 'arena', r: 'control', i: '⛔', cd: 14, p: 50, col: '#651fff',
  d: 'Exiles the target to a pocket dimension for 1.2 s (it can neither act nor be hit), then drops it in a far corner',
  m: ['banish', 'reposition-enemy', 'portal'], tg: 'target', an: 'exile',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t || t.st.outside > 0 || t.beyond) return false; const cx = t.x < ARENA.cx ? ARENA.r - 90 : ARENA.x + 90, cy = t.y < ARENA.cy ? ARENA.b - 90 : ARENA.y + 90;
    openPortal(t.x, t.y, { r: t.r * 1.5, life: 0.6, col }); t.st.outside = t.boss ? 0.6 : 1.2; t.portalExit = { mode: 'point', x: cx, y: cy, col }; t.vx = t.vy = 0; say26(f, 'EXILED', col); } });
K('dimensionking', { t: 'k_crown', n: 'Crown of Dimensions', c: 'transform', r: 'buff', i: '♛', cd: 16, p: 50, col: '#b388ff', self: true,
  d: 'Wears the crown for 5 s: every ability it casts also opens a portal behind its target that fires a royal bolt',
  m: ['ability-echo-portals', 'self-transform'], tg: 'self', an: 'crown',
  fn(f, s, P, col) { const S = sx(f); S.crownT = 5; S.crownD = SDk(f, P, 0.3); burst26(f.x, f.y, '#ffd54f', 24, 280, 5, 0.6, 'shard'); } });
K('dimensionking', { t: 'k_sovereign', n: 'Sovereign Presence', c: 'passive', i: '♔', p: 40, col: '#ffd54f',
  d: 'PASSIVE — enemies within 260 px of the king deal 10% less damage',
  m: ['passive', 'damage-aura-debuff'], an: 'sovereign', passive() {} });
K('unknown', { t: 'k_redacted', n: 'Redacted', c: 'counter', r: 'defense', i: '▇', cd: 12, p: 45, col: '#212121', self: true,
  d: 'Its existence is [REDACTED] for 3 s: homing shots lose track of it and enemies aim at where it is not',
  m: ['untargetable-homing', 'obscure'], tg: 'self', an: 'redacted',
  fn(f, s, P, col) { sx(f).redactT = 3; for (const p of BATTLE.projs) if (p.target === f) { p.target = null; p.homing = 0; } burst26(f.x, f.y, '#000000', 20, 220, 6, 0.5, 'smoke'); } });
K('unknown', { t: 'k_missingtex', n: 'Missing Texture', c: 'environment', r: 'aoe', i: '▦', cd: 14, p: 50, col: '#ff00ff', self: true,
  d: 'Six broken purple-and-black tiles flicker across the arena for 5 s, jumping to new spots; enemies on a tile glitch out (slow + damage)',
  m: ['tile-zones', 'shifting'], tg: 'global', an: 'missingtex',
  fn(f, s, P, col) { for (let i = 0; i < 6; i++) supZone(f, { kind: 'trap', custom: true, x: ARENA.x + 100 + rand(ARENA.w - 200), y: ARENA.y + 80 + rand(ARENA.h - 160), r: 60, life: 5, col, dmg: SDk(f, P, 0.1), tile26: 1.2, onTick: (z, e, d) => { if (d < z.r + e.r * 0.3) { e.st.slow = Math.max(e.st.slow, 0.3); if ((z.ticks.get(e.uid) || 0) <= BATTLE.time) { z.ticks.set(e.uid, BATTLE.time + 0.5); dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', noCrit: true, sk: z.sk }); } } } });
    if (!FX.off) FX.addFlash(0.06, col); } });
K('unknown', { t: 'k_qswap', n: '?????', c: 'offense', r: 'ranged', i: '?', cd: 8, p: 55, col: '#9e9e9e',
  d: 'Something happens to the target. It is never the same thing twice in a row: weakness, confusion, silence or a sudden slowdown — always with damage',
  m: ['random-debuff-target'], tg: 'target', an: 'qswap',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(f); let k; do { k = Math.floor(rand(4)); } while (k === S.qLast); S.qLast = k;
    dealDamage(f, t, SDk(f, P, 0.7), { kind: 'skill', tag: 'skill', power: P, effect: k === 0 ? 'weaken' : k === 3 ? 'slow' : 'none' });
    if (k === 1) sx(t).confT = 1.2; if (k === 2) silenceFoe(f, t, 0.8, '?????'); if (!FX.off) FX.text(t.x, t.y - t.r - 26, '?', '#ffffff', 26, { life: 0.8, pop: 2 }); } });
K('unknown', { t: 'k_undefined', n: 'Undefined Behavior', c: 'passive', i: '⁇', p: 40, col: '#bdbdbd',
  d: 'PASSIVE — when an ability hits it, there is a 20% chance nothing happens and it glitches a short way off (3 s cooldown)',
  m: ['passive', 'proc-evade', 'glitch-blink'], an: 'undefined', passive() {} });
K('anti', { t: 'k_antimatter', n: 'Anti-Matter Annihilation', c: 'counter', r: 'ranged', i: '⊖', cd: 10, p: 55, col: '#ea80fc',
  d: 'Fires a slow orb of anti-matter: every enemy shot it touches is annihilated in a burst, and it detonates on the first enemy it reaches',
  m: ['annihilate-projectiles', 'burst-on-contact'], tg: 'aim', an: 'antimatter',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false;
    supShot(f, f.x, f.y, aimAngle(f, t, 300), { speed: 300, r: 16, dmg: SDk(f, P, 0.6), col, life: 3, style: 'k_anti', power: P, boom: 0, tick: p => { for (let k = BATTLE.projs.length - 1; k >= 0; k--) { const q = BATTLE.projs[k]; if (q.team !== p.team && !q.ult && dist2(q.x, q.y, p.x, p.y) < (q.r + p.r + 10) ** 2) { BATTLE.projs.splice(k, 1); supBlast(f, q.x, q.y, 60, SDk(f, P, 0.15), { tag: 'explosion' }); burst26(q.x, q.y, col, 10, 220); } } },
      onHit: p => { supBlast(f, p.x, p.y, 110, SDk(f, P, 0.4), { tag: 'explosion', force: 380 }); if (!FX.off) { ring26(p.x, p.y, col, 110, 0.35, 8); darkBurst(p.x, p.y, 90, 0.5); } } }); } });

/* ---------------- states and hooks ---------------- */
const _ssp26b = supSkillPower;
supSkillPower = function (f, sk, P) { P = _ssp26b(f, sk, P); const S = f.sx; if (S && S.contractT > 0) P *= 1.2; return P; };
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const S = tgt.sx, cs = src && src.credit;
  if (cs && hasPas(cs, 'k_butterfly') && o.kind !== 'dot' && rand() < 0.1) { const e = ['burn', 'freeze', 'poison', 'stun', 'slow', 'weaken'][Math.floor(rand(6))]; after(0, () => { if (tgt.alive) applyEffect(cs, tgt, e, 50); }); }
  if (cs && cs.alive && hasPas(cs, 'k_omniscience') && !cs.omniCrit) { cs.omniCrit = true; cs.crit = Math.min(100, cs.crit + 10); }
  if (src && src.alive && src.team !== tgt.team) for (const k of BATTLE.fighters) if (k.alive && k.team === tgt.team && hasPas(k, 'k_sovereign') && len(src.x - k.x, src.y - k.y) < 260) { amt *= 0.9; break; }
  if (!S) return amt;
  S.hurtAt = BATTLE.time;
  if (S.phyl && S.phyl.alive) amt *= 0.7;
  if (S.returnT > 0 && o.kind !== 'dot') { const back = amt * 0.5; after(2, () => { if (tgt.alive) healFighter(tgt, back, true); }); }
  if (S.lucidT > 0 && o.kind !== 'dot' && rand() < 0.25) { if (!FX.off) FX.text(tgt.x, tgt.y - tgt.r - 20, 'DREAMT', '#b2ebf2', 13, { life: 0.5 }); return 0; }
  if (S.branchT > 0 && S.branchN > 0 && amt > tgt.maxHp * 0.05 && o.kind !== 'dot') { S.branchN--; amt *= 0.5; after(0, () => { if (!tgt.alive) return; const c = spawnClone(tgt, 30, 3, rand(TAU)); c.maxHp = c.hp = Math.max(5, Math.round(tgt.maxHp * 0.08)); c.decoy = true; }); }
  if (S.paradoxT > 0 && o.kind === 'skill' && src && src.alive && src.team !== tgt.team) { const back = amt * 0.5; after(0, () => { if (src.alive) _dealDamage26(tgt, src, back, { kind: 'skill', noCrit: true, noDef: true }); }); }
  if (hasPas(tgt, 'k_undefined') && o.kind === 'skill' && rand() < 0.2 && twReady(tgt, 'undef', 3)) { after(0, () => { if (!tgt.alive) return; const a = rand(TAU); tgt.x = inArenaX(tgt.x + dcos(a) * 80, tgt.r); tgt.y = inArenaY(tgt.y + dsin(a) * 80, tgt.r); }); if (!FX.off) FX.text(tgt.x, tgt.y - tgt.r - 20, 'UNDEFINED', '#bdbdbd', 13, { life: 0.5 }); return 0; }
  if (S.linkT > 0 && S.linkTo && S.linkTo.alive && !o.link26) { const to = S.linkTo; after(0, () => { if (to.alive) _dealDamage26(src && src.alive ? src : null, to, amt * 0.4, { kind: 'skill', noCrit: true, noDef: true, link26: true }); }); }
  if (S.mirrorLinkT > 0 && S.mirrorLink && S.mirrorLink.alive && !o.link26) { const to = S.mirrorLink; after(0, () => { if (to.alive) _dealDamage26(tgt, to, amt * 0.4, { kind: 'skill', noCrit: true, noDef: true, link26: true }); }); }
  if (tgt.alive && !tgt.isClone) { const before = tgt.hp / tgt.maxHp, after2 = (tgt.hp - amt) / tgt.maxHp; if (Math.floor(before * 4) > Math.floor(after2 * 4) || after2 <= 0) for (const k of BATTLE.fighters) if (k.alive && k.team !== tgt.team && hasPas(k, 'k_collector')) { const C = sx(k); C.souls = Math.min(5, (C.souls || 0) + 1); } }
  return amt;
});
MOD26.push((f, S, m) => {
  if (S.lucidT > 0) m.spd *= 1.15;
  if (S.souls) m.atk *= 1 + 0.03 * S.souls;
  if (hasPas(f, 'k_limitless')) { let n = 0; for (const e of supEnemies(f)) if (len(e.x - f.x, e.y - f.y) < 300) n++; m.cd *= Math.pow(0.85, Math.min(2, n)); }
});
CAST26.push((f, sk) => {
  const S = f.sx; if (!sk.copied && sk.type !== 'k_recursion') sx(f).lastCast = sk.uid;
  if (S && S.contractT > 0 && f.target && f.target.alive) twMiniZone(f, f.target.x, f.target.y, 60, 2, skillDmg(f, 50) * 0.08, '#ff3d00', 'burn');
  if (S && S.crownT > 0 && sk.type !== 'k_crown') { const t = f.target && f.target.alive ? f.target : nearestEnemy(f); if (t) { const b = behind(t, f, 90); openPortal(b.x, b.y, { r: 30, life: 0.6, col: '#b388ff' }); supShot(f, b.x, b.y, datan2(t.y - b.y, t.x - b.x), { speed: 520, r: 8, dmg: S.crownD || 2, col: '#ffd54f', life: 1.2, homing: 3, target: t, style: 'k_star' }); } }
});
{ const aa = aimAngle; aimAngle = function (f, tgt, speed) { if (f && hasPas(f, 'k_omniscience')) { const d = len(tgt.x - f.x, tgt.y - f.y), p = predictPos(f, tgt, d / speed); return datan2(p.y - f.y, p.x - f.x); } return aa(f, tgt, speed); }; }
{ const pt = AIController.prototype.pickTarget; AIController.prototype.pickTarget = function () { const t = pt.call(this); if (t && t.sx && t.sx.redactT > 0 && RNG() < 0.6) return null; return t; }; }
SUP.worldHooks.push((B, h) => {
  const G = B.chaosGrav26;
  if (G) { G.t -= h; G.k -= h; if (G.k <= 0) { G.k = 0.7; G.a = rand(TAU); if (!FX.off) FX.text(ARENA.cx, ARENA.y + 50, '⤡', '#ea80fc', 30, { life: 0.5, vy: 0 }); }
    for (const e of B.fighters) if (e.alive && e.team !== G.team && !e.anchored && !(e.st.outside > 0)) { e.vx += dcos(G.a) * 1100 * h * (e.boss ? 0.4 : 1); e.vy += dsin(G.a) * 1100 * h * (e.boss ? 0.4 : 1); }
    if (G.t <= 0) B.chaosGrav26 = null; }
  const T = B.tears26;
  if (T) { T.t -= h; if (T.t <= 0) B.tears26 = null; else for (const e of B.fighters) { if (!e.alive || e.team === T.team || e.st.outside > 0 || e.anchored) continue; const i = T.pts.findIndex(p => len(e.x - p.x, e.y - p.y) < e.r + 26); if (i < 0 || !twReady(e, 'tear', 1)) continue; const j = (i + 1 + Math.floor(rand(T.pts.length - 1))) % T.pts.length, q = T.pts[j]; burst26(e.x, e.y, '#84ffff', 12, 220); e.x = inArenaX(q.x + 40, e.r); e.y = inArenaY(q.y, e.r); _dealDamage26(T.by && T.by.alive ? T.by : null, e, T.dmg, { kind: 'skill', noCrit: true }); burst26(e.x, e.y, '#84ffff', 14, 240); } }
  for (const f of B.fighters) {
    if (!f.alive) continue;
    if ((f.h26T = (f.h26T || 0) - h) <= 0) { f.h26T = 0.25; (f.hist26 || (f.hist26 = [])).push({ x: f.x, y: f.y }); if (f.hist26.length > 6) f.hist26.shift(); }
    const S = f.sx; if (!S) continue;
    if (S.gateT > 0 && !f.boss) { const d = len(S.gateX - f.x, S.gateY - f.y); if (d > 20) { f.vx += (S.gateX - f.x) / d * 900 * h; f.vy += (S.gateY - f.y) / d * 900 * h; } }
    if (S.soulT > 0 && S.soulBy) { if ((S.soT = (S.soT || 0) - h) <= 0) { S.soT = 0.5; const by = S.soulBy.alive ? S.soulBy : null; _dealDamage26(by, f, S.soulD || 1, { kind: 'dot', noCrit: true }); if (by) healFighter(by, (S.soulD || 1) * 0.5, true); } }
  }
  for (const z of B.zones) {
    if (z.loop26) for (const e of supEnemies(z.owner)) { const d = len(e.x - z.x, e.y - z.y); if (d > z.r - e.r * 0.3 && d < z.r + 60 && !e.boss && !e.anchored) { const a = datan2(e.y - z.y, e.x - z.x) + Math.PI; e.x = z.x + dcos(a) * (z.r - e.r - 8); e.y = z.y + dsin(a) * (z.r - e.r - 8); if (twReady(e, 'loop', 0.4)) { _dealDamage26(z.owner, e, z.dmg, { kind: 'skill', noCrit: true }); burst26(e.x, e.y, z.col, 8, 180); } } }
    if (z.tile26) { z.tileT = (z.tileT || z.tile26) - h; if (z.tileT <= 0) { z.tileT = z.tile26; z.x = ARENA.x + 100 + rand(ARENA.w - 200); z.y = ARENA.y + 80 + rand(ARENA.h - 160); } }
  }
});
/* =====================================================================
   2.6.0 NEW SKILLS — LIMITED balls (+5 each).
   ===================================================================== */
/* ---- Blood Moon ---- */
K('bloodmoon', { t: 'k_moonbeam', n: 'Moonbeam Ritual', c: 'environment', r: 'ranged', i: '☽', cd: 12, p: 55, col: '#ff1744',
  d: 'A blood-red moonbeam locks onto the target for 3 s, following it and burning it; every tick heals the Blood Moon',
  m: ['tracking-column', 'heal-from-damage'], tg: 'target', ac: 'channel', an: 'moonbeam',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const B0 = { x: t.x, y: t.y };
    for (let i = 1; i <= 6; i++) after(i * 0.5, () => { if (!f.alive || !t.alive) return; B0.x += (t.x - B0.x) * 0.7; B0.y += (t.y - B0.y) * 0.7; const n = foesNear(f, B0.x, B0.y, 55); for (const e of n) { const got = dealDamage(f, e, SDk(f, P, 0.16), { kind: 'skill', tag: 'strike', power: P }); healFighter(f, got * 0.5, true); } });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); const x = B0.x, y = B0.y; const g = ctx.createLinearGradient(x, ARENA.y, x, y); g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, 0.5)); ctx.fillStyle = g; ctx.fillRect(x - 30, ARENA.y, 60, y - ARENA.y); ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, 55, 0, TAU); ctx.stroke(); ctx.restore(); }, 3.1); } });
K('bloodmoon', { t: 'k_crimsontide', n: 'Crimson Tide', c: 'offense', r: 'aoe', i: '⌓', cd: 9, p: 55, col: '#d50000',
  d: 'Sweeps a crescent of blood in front of it: everything in the 140° arc is hit and drained',
  m: ['crescent-wave', 'front-arc', 'drain'], tg: 'aim', an: 'crimsontide',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const a = angTo(f, t);
    for (const e of supEnemies(f)) { const d = len(e.x - f.x, e.y - f.y), da = Math.abs(((datan2(e.y - f.y, e.x - f.x) - a + Math.PI * 3) % TAU) - Math.PI); if (d < 260 + e.r && da < 1.22) dealDamage(f, e, SDk(f, P, 0.75), { kind: 'skill', tag: 'wave', effect: 'drain', power: P }); }
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = col; ctx.lineWidth = 30 * (1 - q); ctx.beginPath(); ctx.arc(f.x, f.y, 60 + q * 200, a - 1.22, a + 1.22); ctx.stroke(); ctx.restore(); }, 0.45); } });
K('bloodmoon', { t: 'k_phases', n: 'Lunar Phases', c: 'passive', i: '🌗', p: 40, col: '#ff8a80',
  d: 'PASSIVE — cycles through the moon every 5 s: New Moon (+15% speed), Half Moon (+15% defence), Full Moon (+15% attack)',
  m: ['passive', 'cycling-buff'], an: 'phases',
  passive(f, h, sk) { const S = sx(f), k = Math.floor(BATTLE.time / 5) % 3; if (S.phase26 !== k) { S.phase26 = k; if (!FX.off) FX.text(f.x, f.y - f.r - 46, ['🌑 NEW MOON', '🌓 HALF MOON', '🌕 FULL MOON'][k], sk.color, 13, { life: 1 }); } } });
K('bloodmoon', { t: 'k_stalker', n: 'Nightstalker', c: 'autonomous', i: '🐺', cd: 10, p: 55, col: '#b71c1c',
  d: 'AUTONOMOUS — when a hurt enemy (below 50%) tries to run away from it, the Blood Moon pounces on its own',
  m: ['auto-trigger', 'pounce', 'anti-kite'], tg: 'target', an: 'stalker',
  auto: f => supEnemies(f).some(e => e.hpRatio < 0.5 && len(e.x - f.x, e.y - f.y) < 520 && ((e.x - f.x) * e.vx + (e.y - f.y) * e.vy) > 0),
  fn(f, s, P, col) { const e = supEnemies(f).filter(e => e.hpRatio < 0.5 && len(e.x - f.x, e.y - f.y) < 520).sort((a, b) => a.hpRatio - b.hpRatio)[0]; if (!e) return false; const a = angTo(f, e), sp = f.baseSpeed * 2.6;
    f.vx = dcos(a) * sp; f.vy = dsin(a) * sp; f.st.dash = 0.5; f.dashEffect = 'drain'; f.dashPow = P; f.dashSk = s.uid; f.dashSkT = 0.7; burst26(f.x, f.y, col, 14, 260); } });
K('bloodmoon', { t: 'k_hemoburst', n: 'Hemorrhage Burst', c: 'offense', r: 'ranged', i: '✹', cd: 12, p: 55, col: '#ff5252', self: true,
  d: 'Makes every bleeding, burning or poisoned enemy erupt: each one takes burst damage and its lingering effect is used up',
  m: ['consume-status', 'burst'], tg: 'global', an: 'hemoburst',
  fn(f, s, P, col) { let n = 0; for (const e of supEnemies(f)) { const S = e.sx || {}, bleed = S.bleedT > 0, dot = e.st.burn > 0 || e.st.poison > 0; if (!bleed && !dot) continue; n++;
      dealDamage(f, e, SDk(f, P, 0.6 + (bleed ? 0.3 : 0) + (dot ? 0.2 : 0)), { kind: 'skill', tag: 'explosion', power: P }); if (S.bleedT) S.bleedT = 0; e.st.burn = 0; e.st.poison = 0; e.poisonStacks = 0; burst26(e.x, e.y, col, 24, 340, 6, 0.5); }
    return n ? undefined : false; } });
/* ---- Aurora ---- */
K('aurora', { t: 'k_curtain', n: 'Curtain of Light', c: 'defense', r: 'defense', i: '▥', cd: 12, p: 45, col: '#64ffda',
  d: 'Hangs a shimmering curtain of light between itself and the target for 4 s; it blocks every enemy shot that hits it',
  m: ['barrier-wall', 'blocks-projectiles'], tg: 'aim', an: 'curtain',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const a = angTo(f, t), cx = f.x + dcos(a) * 90, cy = f.y + dsin(a) * 90, o = a + Math.PI / 2;
    addWall26(f, cx - dcos(o) * 95, cy - dsin(o) * 95, cx + dcos(o) * 95, cy + dsin(o) * 95, { life: 4, w: 14, col, move: false, shots: true }); } });
K('aurora', { t: 'k_solarwind', n: 'Solar Wind', c: 'environment', r: 'control', i: '🌬', cd: 13, p: 45, col: '#b9f6ca', self: true,
  d: 'A solar wind blows across the whole arena for 3 s: enemies are pushed downwind and allies ride it 20% faster',
  m: ['global-wind', 'ally-speed'], tg: 'global', an: 'solarwind',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); const a = t ? angTo(f, t) : rand(TAU); BATTLE.wind26 = { a, t: 3, team: f.team };
    if (!FX.off) for (let i = 0; i < 30; i++) FX.p(ARENA.x + vr(ARENA.w), ARENA.y + vr(ARENA.h), Math.cos(a) * 500, Math.sin(a) * 500, 0.8, vr(2, 4), col, 'spark', 0); } });
K('aurora', { t: 'k_ribbon', n: 'Ribbon Dance', c: 'mobility', r: 'mobility', i: '〜', cd: 10, p: 50, col: '#a7ffeb',
  d: 'Dances along a wavy path for 1 s, trailing ribbons of light that hurt and slow enemies who cross them',
  m: ['wavy-movement', 'ribbon-zones'], tg: 'aim', an: 'ribbon',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); const a0 = t ? angTo(f, t) : f.rot; sx(f).ribbonT = 1; sx(f).ribbonA = a0; sx(f).ribbonP = P; } });
K('aurora', { t: 'k_magnetosphere', n: 'Magnetosphere', c: 'counter', r: 'defense', i: '◉', cd: 12, p: 45, col: '#18ffff', self: true,
  d: 'For 3 s beams and lasers that hit it lose half their power, and each one recharges its cooldowns by 1 s',
  m: ['beam-resist', 'cooldown-recharge'], tg: 'self', an: 'magnetosphere',
  fn(f, s, P, col) { sx(f).magnetoT = 3; ring26(f.x, f.y, col, f.r * 2.6, 0.5, 5, f.r); } });
K('aurora', { t: 'k_polarnight', n: 'Polar Night', c: 'transform', r: 'buff', i: '❄', cd: 16, p: 50, col: '#82b1ff', self: true,
  d: 'Becomes the polar night for 5 s: its shots chill enemies (three chills freeze), and it moves 15% faster',
  m: ['self-transform', 'freeze-imbue'], tg: 'self', an: 'polarnight',
  fn(f, s, P, col) { sx(f).polarT = 5; if (!FX.off) { FX.addFlash(0.1, '#0d47a1'); burst26(f.x, f.y, col, 26, 280, 5, 0.6, 'shard'); } } });
/* ---- Frost Crown ---- */
K('frostcrown', { t: 'k_icewall', n: 'Ice Wall', c: 'arena', r: 'control', i: '▮', cd: 12, p: 50, col: '#b3e5fc',
  d: 'Raises a wall of ice between it and the target: it blocks movement and shots for 3 s, then shatters into flying shards',
  m: ['barrier-wall', 'shatter-shards', 'blocks-movement'], tg: 'aim', an: 'icewall',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const a = angTo(f, t), d = Math.min(len(t.x - f.x, t.y - f.y) / 2, 160), cx = f.x + dcos(a) * d, cy = f.y + dsin(a) * d, o = a + Math.PI / 2;
    addWall26(f, cx - dcos(o) * 80, cy - dsin(o) * 80, cx + dcos(o) * 80, cy + dsin(o) * 80, { life: 3, w: 18, col, move: true, shots: true, onEnd: w => { for (let i = 0; i < 8; i++) supShot(f, (w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, i / 8 * TAU, { speed: 420, r: 6, dmg: SDk(f, P, 0.14), col, effect: 'freeze', life: 0.8, style: 'shard', power: P }); burst26((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, col, 24, 320, 5, 0.5, 'shard'); } }); } });
K('frostcrown', { t: 'k_freezecmd', n: 'Freeze Command', c: 'counter', r: 'control', i: '⏸', cd: 13, p: 45, col: '#e1f5fe',
  d: 'A royal command freezes the target’s readiest ability: it is put back on its full cooldown',
  m: ['lock-enemy-ability'], tg: 'target', an: 'freezecmd',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t || !t.skills || !t.skills.length) return false; const k = t.skills.filter(x => !x.locked).sort((a, b) => a.cdLeft - b.cdLeft)[0]; if (!k) return false;
    k.cdLeft = Math.max(k.cdLeft, k.cd || 6); dealDamage(f, t, SDk(f, P, 0.3), { kind: 'skill', tag: 'skill', power: P, effect: 'slow' }); if (!FX.off) FX.text(t.x, t.y - t.r - 26, 'FROZEN: ' + k.name, col, 13, { life: 1 }); } });
const ICE_SENTINEL = MD('icesentinel', 'Ice Sentinel', '#e1f5fe', '#4fc3f7', '#b3e5fc', 'ice', ['crystals'], [60, 50, 50, 0, 10]);
K('frostcrown', { t: 'k_sentinels', n: 'Royal Icicle Guard', c: 'summon', r: 'summon', i: '♜', cd: 16, p: 50, col: '#81d4fa', self: true,
  d: 'Plants three ice sentinels around itself; they stand guard for 6 s and fire freezing shards at enemies in range',
  m: ['turret-minions', 'freeze-shots'], tg: 'self', an: 'sentinels',
  fn(f, s, P, col) { let n = 0; for (let i = 0; i < 3; i++) { const a = f.rot + i / 3 * TAU; if (anchor26(f, ICE_SENTINEL, f.x + dcos(a) * 120, f.y + dsin(a) * 120, P, { life: 6, hp: 0.05, rScale: 0.42, shot: { range: 420, cd: 1.3, fire: (m, t) => supShot(m, m.x, m.y, aimAngle(m, t, 520), { speed: 520, r: 6, dmg: SDk(f, P, 0.1), col, effect: 'slow', style: 'shard', life: 1.2, power: P }) } })) n++; } return n ? undefined : false; } });
K('frostcrown', { t: 'k_permafrost', n: 'Permafrost', c: 'environment', r: 'control', i: '⛸', cd: 13, p: 45, col: '#b2ebf2', self: true,
  d: 'Freezes the floor around it for 4 s: enemies on the ice slide helplessly (they can barely steer) while the Frost Crown skates 20% faster',
  m: ['slippery-floor', 'momentum'], tg: 'self', an: 'permafrost',
  fn(f, s, P, col) { supZone(f, { kind: 'trap', custom: true, x: f.x, y: f.y, r: 230, life: 4, col, dmg: 0, ice26: true });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.3 * (1 - q * 0.5); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(f.x, f.y, 230, 0, TAU); ctx.fill(); ctx.restore(); }, 4); } });
K('frostcrown', { t: 'k_avalanche', n: 'Avalanche', c: 'offense', r: 'ranged', i: '⬤', cd: 11, p: 60, col: '#ffffff',
  d: 'Rolls a snowball that gathers snow as it goes — it grows, speeds up and flattens whatever it hits with a huge knockback',
  m: ['rolling-boulder', 'growing', 'knockback'], tg: 'aim', an: 'avalanche',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false;
    supShot(f, f.x, f.y, aimAngle(f, t, 300), { speed: 300, r: 10, dmg: SDk(f, P, 0.6), col, life: 2.6, pierce: 2, style: 'k_snow', power: P, tick: (p, h) => { p.r = Math.min(34, p.r + 12 * h); p.dmg *= 1 + 0.25 * h; const m = 1 + 0.4 * h; p.vx *= m; p.vy *= m; p.speed *= m; }, onHit: (p, e) => knock(e, p.x, p.y, 700) }); } });
/* ---- Solar Flare ---- */
K('solarflare', { t: 'k_coronalloop', n: 'Coronal Loop', c: 'offense', r: 'ranged', i: '⌒', cd: 9, p: 55, col: '#ffab00',
  d: 'Throws an arc of plasma out to the target and back in a loop, burning everything along both halves of the arc',
  m: ['arc-path', 'return-loop'], tg: 'target', an: 'coronalloop',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const x0 = f.x, y0 = f.y, x1 = t.x, y1 = t.y;
    supShot(f, x0, y0, 0, { speed: 1, r: 11, dmg: SDk(f, P, 0.45), col, life: 1.2, pierce: 9, style: 'flare', effect: 'burn', power: P, data: { age: 0 }, tick: (p, h) => { const D = p.data; D.age += h; const q = D.age / 1.2, a = q * TAU, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, L = len(x1 - x0, y1 - y0) / 2, ang = datan2(y1 - y0, x1 - x0);
      const lx = -Math.cos(a) * L, ly = Math.sin(a) * L * 0.6; p.vx = 0; p.vy = 0; p.x = mx + lx * dcos(ang) - ly * dsin(ang); p.y = my + lx * dsin(ang) + ly * dcos(ang); if (q > 0.5 && !D.back) { D.back = true; p.hits = new Set(); } } }); } });
K('solarflare', { t: 'k_sunshield', n: 'Sun Shield', c: 'defense', r: 'defense', i: '☼', cd: 12, p: 50, col: '#ffd740', self: true,
  d: 'A blazing shield for 3 s: it blocks 35% (50% if enemies nearby are already burning) and sets attackers on fire',
  m: ['burning-guard', 'scales-with-burns'], tg: 'self', an: 'sunshield',
  fn(f, s, P, col) { const hot = supEnemies(f).some(e => e.st.burn > 0 && len(e.x - f.x, e.y - f.y) < 400); f.st.shield = Math.max(f.st.shield, 3); f.st.shieldPow = Math.max(f.st.shieldPow, hot ? 0.5 : 0.35); sx(f).sunShT = 3; ring26(f.x, f.y, col, f.r * 2.2, 0.4, 7, f.r); } });
K('solarflare', { t: 'k_solarcycle', n: 'Solar Cycle', c: 'passive', i: '🌞', p: 45, col: '#ffca28',
  d: 'PASSIVE — every 8 s the sun reaches its maximum: the next ability it uses is 40% stronger',
  m: ['passive', 'timed-empower'], an: 'solarcycle',
  passive(f, h, sk) { const S = sx(f); if (!S.solarMax && (S.solT = (S.solT || 8) - h) <= 0) { S.solarMax = true; S.solT = 8; if (!FX.off) { FX.text(f.x, f.y - f.r - 46, 'SOLAR MAXIMUM', sk.color, 13, { life: 1 }); ring26(f.x, f.y, sk.color, f.r * 2.4, 0.4, 5, f.r); } } } });
K('solarflare', { t: 'k_helios', n: 'Helios Beam', c: 'environment', r: 'aoe', i: '⇓', cd: 13, p: 55, col: '#fff176',
  d: 'A beam of sunlight from the sky sweeps across a band of the arena through the target’s position',
  m: ['sky-beam', 'column-sweep'], tg: 'area', ac: 'charge', an: 'helios',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const vert = RNG() < 0.5;
    addLaser(f, [0, 0, 0, 0], { charge: 0.6, dur: 1.4, w: 26, dmg: SDk(f, P, 0.3), col, sweep: vert ? { cx: t.x - 220, cy: ARENA.cy, a0: Math.PI / 2, av: 0, len: 400 } : { cx: ARENA.cx, cy: t.y - 160, a0: 0, av: 0, len: 700 } });
    const L = lastLaser(); if (L) { L.drift26 = vert ? { vx: 320, vy: 0 } : { vx: 0, vy: 230 }; } } });
K('solarflare', { t: 'k_minisun', n: 'Mini Sun', c: 'summon', r: 'summon', i: '☀', cd: 16, p: 50, col: '#ff6f00', self: true,
  d: 'Creates a miniature sun that circles the middle of the arena for 5 s, scorching any enemy that comes close to it',
  m: ['orbiting-hazard', 'burn-aura'], tg: 'global', an: 'minisun',
  fn(f, s, P, col) { const m = { by: f, team: f.team, t: 5, a: rand(TAU), dmg: SDk(f, P, 0.14), col }; BATTLE.minisun26 = (BATTLE.minisun26 || []).concat([m]);
    if (!FX.off) vfx((ctx, q) => { if (m.x == null || m.t <= 0) return; ctx.save(); ctx.drawImage(glowSprite(col), m.x - 70, m.y - 70, 140, 140); ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(m.x, m.y, 22, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(col, 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, 90, 0, TAU); ctx.stroke(); ctx.restore(); }, 5); } });
/* ---- Glitch ---- */
K('glitch', { t: 'k_lag', n: 'Lag Spike', c: 'environment', r: 'control', i: '⌛', cd: 12, p: 45, col: '#00e676',
  d: 'Gives the target a bad connection for 2.5 s: every half second it rubber-bands back to where it was',
  m: ['position-stutter'], tg: 'target', an: 'lag',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t || t.boss) return false; const S = sx(t); S.lagT = 2.5; S.lagP = { x: t.x, y: t.y }; S.lagK = 0.5; dealDamage(f, t, SDk(f, P, 0.25), { kind: 'skill', tag: 'skill', power: P }); } });
K('glitch', { t: 'k_undo', n: 'Ctrl+Z', c: 'defense', r: 'heal', i: '↶', cd: 14, p: 45, col: '#76ff03', self: true,
  d: 'Undoes the last 2 s: every point of damage it took in that time is restored',
  m: ['undo-damage', 'history'], tg: 'self', an: 'undo',
  fn(f, s, P, col) { const S = sx(f), now = BATTLE.time, back = (S.dmgLog || []).filter(x => now - x.t <= 2).reduce((a, x) => a + x.a, 0); if (back < f.maxHp * 0.02) return false; healFighter(f, back); S.dmgLog = []; if (!FX.off) FX.text(f.x, f.y - f.r - 46, 'CTRL+Z', col, 18, { life: 1 }); } });
K('glitch', { t: 'k_deadpixels', n: 'Dead Pixels', c: 'trap', r: 'control', i: '▪', cd: 11, p: 50, col: '#ff00e6',
  d: 'Scatters dead pixels that blink in and out of sight; touching one shorts the enemy out (damage and a 0.6 s silence)',
  m: ['blinking-mines', 'silence-trap'], tg: 'area', an: 'deadpixels',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + rand(0.7), r = 60 + rand(80);
    supZone(f, { kind: 'trap', custom: true, x: inArenaX(t.x + dcos(a) * r, 20), y: inArenaY(t.y + dsin(a) * r, 20), r: 22, life: 6, col, dmg: SDk(f, P, 0.35), blink26: true, onTick: (z, e, d) => { if (d < z.r + e.r && !z.used) { z.used = true; dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', power: 50, sk: z.sk }); silenceFoe(z.owner, e, 0.6, 'SHORTED'); z.life = 0.05; } } }); } } });
K('glitch', { t: 'k_overflow', n: 'Buffer Overflow', c: 'offense', r: 'ranged', i: '≣', cd: 10, p: 55, col: '#69f0ae',
  d: 'Streams six data packets at the target; each one that lands makes the next hit harder (×1.25 each)',
  m: ['stacking-damage-sequence'], tg: 'aim', ac: 'channel', an: 'overflow',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const st = { k: 1 };
    for (let i = 0; i < 6; i++) after(i * 0.13, () => { if (!f.alive || !t.alive) return; supShot(f, f.x, f.y, aimAngle(f, t, 640), { speed: 640, r: 6, dmg: 1, col, life: 1.2, style: 'k_cube', power: P, homing: 2, target: t, onHit: (p, e) => { _dealDamage26(f, e, SDk(f, P, 0.12) * st.k, { kind: 'skill', tag: 'projectile', noCrit: true }); st.k *= 1.25; } }); }); } });
K('glitch', { t: 'k_patch', n: 'Patch Notes', c: 'passive', i: '📋', p: 40, col: '#b9f6ca',
  d: 'PASSIVE — after being hit twice by the same ability, it patches itself and takes 25% less damage from that ability for the rest of the battle',
  m: ['passive', 'per-ability-resist'], an: 'patch', passive() {} });
/* ---- Sakura ---- */
K('sakura', { t: 'k_vortex', n: 'Blossom Vortex', c: 'environment', r: 'control', i: '🌀', cd: 12, p: 50, col: '#ff80ab',
  d: 'A whirl of petals spins around the target for 2 s, carrying it round in circles and cutting it',
  m: ['spin-vortex', 'petal-orbit'], tg: 'target', an: 'vortex',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(t); S.vortT = t.boss ? 1 : 2; S.vortX = t.x; S.vortY = t.y; S.vortA = 0; S.vortD = SDk(f, P, 0.14); S.vortBy = f;
    if (!FX.off) vfx((ctx, q) => { ctx.save(); for (let i = 0; i < 14; i++) { const a = q * 20 + i / 14 * TAU, r = 40 + (i % 3) * 18; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(S.vortX + Math.cos(a) * r, S.vortY + Math.sin(a) * r, 6, 3, a, 0, TAU); ctx.fill(); } ctx.restore(); }, S.vortT); } });
const SAKURA_TREE = MD('sakuratree', 'Cherry Tree', '#5d4037', '#ff80ab', '#f8bbd0', 'petals', ['halo'], [80, 10, 60, 0, 0]);
K('sakura', { t: 'k_garden', n: 'Hanami Garden', c: 'defense', r: 'heal', i: '🌸', cd: 16, p: 45, col: '#f8bbd0', self: true,
  d: 'Plants a blossoming cherry tree for 7 s: every second it heals Sakura and allies near it (enemies can cut it down)',
  m: ['healing-totem', 'unit'], tg: 'self', an: 'garden',
  fn(f, s, P, col) { const u = anchor26(f, SAKURA_TREE, f.x, f.y + 70, P, { life: 7, hp: 0.12, rScale: 0.6, tick: (u, h) => { u.hT = (u.hT || 1) - h; if (u.hT <= 0) { u.hT = 1; for (const a of allies(f)) if (len(a.x - u.x, a.y - u.y) < 220) healFighter(a, a.maxHp * 0.025, true); if (!FX.off) ring26(u.x, u.y, col, 220, 0.5, 3, 30); } } }); if (!u) return false; } });
K('sakura', { t: 'k_petalcut', n: 'Petal Cut', c: 'offense', r: 'ranged', i: '☾', cd: 8, p: 55, col: '#ff4081',
  d: 'A crescent slash flies out and scatters petals on its path; 1.5 s later every petal bursts',
  m: ['crescent-slash', 'delayed-petals'], tg: 'aim', an: 'petalcut',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const marks = [];
    supShot(f, f.x, f.y, aimAngle(f, t, 600), { speed: 600, r: 12, dmg: SDk(f, P, 0.6), col, life: 0.9, style: 'k_crescent', pierce: 2, power: P, data: { k: 0 }, tick: (p, h) => { if ((p.data.k -= h) <= 0 && marks.length < 6) { p.data.k = 0.12; marks.push({ x: p.x, y: p.y }); if (!FX.off) FX.p(p.x, p.y, 0, 0, 1.5, 6, col, 'dot', 0); } } });
    after(1.5, () => { if (!f.alive) return; for (const m of marks) { supBlast(f, m.x, m.y, 55, SDk(f, P, 0.14), { tag: 'explosion' }); burst26(m.x, m.y, col, 8, 200, 4, 0.4); } }); } });
K('sakura', { t: 'k_branches', n: 'Wind Through Branches', c: 'mobility', r: 'mobility', i: '⟿', cd: 10, p: 50, col: '#fce4ec',
  d: 'Three quick zig-zag hops toward the target, each landing with a little burst of petals',
  m: ['multi-hop', 'burst-per-hop'], tg: 'aim', an: 'branches',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; for (let i = 0; i < 3; i++) after(i * 0.18, () => { if (!f.alive) return; const tt = t.alive ? t : nearestEnemy(f); const a = (tt ? angTo(f, tt) : f.rot) + (i % 2 ? 0.7 : -0.7), d = 110;
      burst26(f.x, f.y, col, 6, 160); f.x = inArenaX(f.x + dcos(a) * d, f.r); f.y = inArenaY(f.y + dsin(a) * d, f.r); supBlast(f, f.x, f.y, 80, SDk(f, P, 0.22), { tag: 'explosion', force: 200, power: P }); burst26(f.x, f.y, col, 12, 240, 4, 0.4); }); } });
const SPIRIT_FOX = MD('spiritfox', 'Spirit Fox', '#fce4ec', '#ff4081', '#ff80ab', 'swirl', ['flames'], [60, 70, 30, 95, 20]);
K('sakura', { t: 'k_fox', n: 'Sakura Spirit', c: 'autonomous', i: '🦊', cd: 18, p: 50, col: '#ff80ab', self: true,
  d: 'AUTONOMOUS — whenever Sakura is in a fight, a spirit fox appears on its own for 8 s and always hunts the weakest enemy',
  m: ['companion', 'targets-weakest', 'auto-trigger'], tg: 'self', an: 'fox',
  auto: f => supEnemies(f).some(e => len(e.x - f.x, e.y - f.y) < 420),
  fn(f, s, P, col) { const u = summon26(f, SPIRIT_FOX, f.x, f.y - f.r - 30, P, { life: 8, hp: 0.07, statMul: 0.55, rScale: 0.4, shot: { range: 600, cd: 1.1, fire: (m, t) => { const w = weakestFoe(f) || t; supShot(m, m.x, m.y, angTo(m, w), { speed: 560, r: 6, dmg: SDk(f, P, 0.12), col, life: 1.4, homing: 4, target: w, style: 'k_petal' }); } } }); if (!u) return false; u.foxOf = f; } });

/* ---------------- states and hooks ---------------- */
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const S = tgt.sx;
  if (S) {
    if (S.magnetoT > 0 && (o.tag === 'beam' || o.tag === 'laser')) { amt *= 0.5; for (const k of tgt.skills || []) if (k.cdLeft > 0) k.cdLeft = Math.max(0, k.cdLeft - 1); }
    if (S.sunShT > 0 && src && src.alive && o.kind !== 'dot' && twReady(src, 'sunsh', 1)) applyEffect(tgt, src, 'burn', 55);
    (S.dmgLog || (S.dmgLog = [])).push({ t: BATTLE.time, a: amt }); if (S.dmgLog.length > 40) S.dmgLog.shift();
    if (hasPas(tgt, 'k_patch') && o.sk) { const P2 = S.patch || (S.patch = {}); P2[o.sk] = (P2[o.sk] || 0) + 1; if (P2[o.sk] >= 3) amt *= 0.75; else if (P2[o.sk] === 2 && !FX.off) FX.text(tgt.x, tgt.y - tgt.r - 30, 'PATCHED', '#b9f6ca', 13, { life: 0.8 }); }
    if (hasPas(tgt, 'k_phases') && S.phase26 === 1 && o.kind !== 'dot') amt *= 0.87;
  }
  const s2 = src && src.credit && src.credit.sx;
  if (s2 && s2.polarT > 0 && o.kind === 'skill' && tgt.alive) { const T = sx(tgt); T.chillN = (T.chillT > 0 ? T.chillN || 0 : 0) + 1; T.chillT = 3; tgt.st.slow = Math.max(tgt.st.slow, 0.6); if (T.chillN >= 3) { T.chillN = 0; after(0, () => { if (tgt.alive) applyEffect(src.credit, tgt, 'freeze', 60); }); } }
  return amt;
});
const _ssp26c = supSkillPower;
supSkillPower = function (f, sk, P) { P = _ssp26c(f, sk, P); const S = f.sx; if (S && S.solarMax && !sk.passive26) { S.solarMax = false; P *= 1.4; } return P; };
MOD26.push((f, S, m) => {
  if (hasPas(f, 'k_phases')) { const k = S.phase26 | 0; if (k === 0) m.spd *= 1.15; if (k === 2) m.atk *= 1.15; }
  if (S.polarT > 0) m.spd *= 1.15;
  if (S.windIn) { m.spd *= 1.2; S.windIn = 0; }
  if (S.iceSelf) { m.spd *= 1.2; S.iceSelf = 0; }
});
SUP.steerHooks.push(f => { const S = f.sx; if (S && S.onIce > 0 && !f.isClone) { f.steerPow *= 0.15; } });
SUP.worldHooks.push((B, h) => {
  const W = B.wind26;
  if (W) { W.t -= h; if (W.t <= 0) B.wind26 = null; else for (const e of B.fighters) { if (!e.alive || e.st.outside > 0 || e.anchored) continue; if (e.team === W.team) sx(e).windIn = 1; else { e.vx += dcos(W.a) * 700 * h * (e.boss ? 0.4 : 1); e.vy += dsin(W.a) * 700 * h * (e.boss ? 0.4 : 1); } } }
  if (B.minisun26 && B.minisun26.length) { B.minisun26 = B.minisun26.filter(m => (m.t -= h) > 0 && m.by.alive); for (const m of B.minisun26) { m.a += 1.3 * h; const x = ARENA.cx + dcos(m.a) * 260, y = ARENA.cy + dsin(m.a) * 160; m.x = x; m.y = y;
      for (const e of B.fighters) if (e.alive && e.team !== m.team && !(e.st.outside > 0) && len(e.x - x, e.y - y) < 90 + e.r && twReady(e, 'sun' + m.by.sid, 0.5)) _dealDamage26(m.by, e, m.dmg, { kind: 'skill', effect: 'burn', power: 55, noCrit: true });
      if (!FX.off) { FX.p(x + vr(-20, 20), y + vr(-20, 20), vr(-40, 40), vr(-40, 40), 0.4, vr(8, 16), m.col, 'dot', 1); if (Math.random() < 0.3) FX.ring(x, y, '#ffeb3b', 90, 0.3, 2, 70); } } }
  for (const L of B.lasers) if (L.drift26 && L.sweep && L.t >= L.charge) { L.sweep.cx += L.drift26.vx * h; L.sweep.cy += L.drift26.vy * h; }
  for (const f of B.fighters) {
    if (!f.alive) continue; const S = f.sx; if (!S) continue;
    if (S.onIce > 0) S.onIce -= h;
    if (S.ribbonT > 0) { const a = S.ribbonA + Math.sin(S.ribbonT * 14) * 0.9, sp = f.baseSpeed * 1.9; f.vx = dcos(a) * sp; f.vy = dsin(a) * sp; if ((S.rbT = (S.rbT || 0) - h) <= 0) { S.rbT = 0.1; if (B.zones.length < 50) twMiniZone(f, f.x, f.y, 30, 2.5, skillDmg(f, S.ribbonP || 50) * 0.08, '#a7ffeb', 'slow'); } }
    if (S.lagT > 0) { if ((S.lagK -= h) <= 0) { S.lagK = 0.5; const p = S.lagP; burst26(f.x, f.y, '#00e676', 6, 160); f.x = inArenaX(p.x, f.r); f.y = inArenaY(p.y, f.r); if (!FX.off) FX.text(f.x, f.y - f.r - 20, 'LAG', '#00e676', 12, { life: 0.4 }); } else if (S.lagK > 0.45) S.lagP = { x: f.x, y: f.y }; }
    if (S.vortT > 0 && S.vortBy) { S.vortA += 5 * h; f.x = inArenaX(S.vortX + dcos(S.vortA) * 50, f.r); f.y = inArenaY(S.vortY + dsin(S.vortA) * 50, f.r); f.vx = -dsin(S.vortA) * 250; f.vy = dcos(S.vortA) * 250; if (twReady(f, 'vort', 0.5)) _dealDamage26(S.vortBy.alive ? S.vortBy : null, f, S.vortD || 2, { kind: 'skill', noCrit: true }); }
  }
  for (const z of B.zones) {
    if (z.ice26) for (const e of B.fighters) { if (!e.alive || len(e.x - z.x, e.y - z.y) > z.r + e.r) continue; if (e.team === z.team) { if (e === z.owner) sx(e).iceSelf = 1; } else sx(e).onIce = 0.15; }
    if (z.blink26 && !FX.off) z.hidden = Math.floor(B.time * 2.5) % 2 === 0;
  }
});
/* =====================================================================
   2.6.0 NEW SKILLS — GOD TIER balls (+6 each for the classic gods; the Supreme God Balls +4; Solar Eclipse +3).
   ===================================================================== */
/* ---- Seraphim ---- */
K('seraphim', { t: 'k_sixwings', n: 'Six Wings', c: 'transform', r: 'buff', i: '𓆩', cd: 16, p: 50, col: '#ffe082', self: true,
  d: 'Unfurls all six wings for 5 s: it flies 30% faster and every second its wings shed a ring of burning feathers',
  m: ['self-transform', 'auto-volley'], tg: 'self', an: 'sixwings',
  fn(f, s, P, col) { const S = sx(f); S.wingsT = 5; S.wingsP = P; for (let i = 1; i <= 5; i++) after(i, () => { if (!f.alive) return; for (let k = 0; k < 6; k++) supShot(f, f.x, f.y, k / 6 * TAU + i * 0.3, { speed: 420, r: 6, dmg: SDk(f, P, 0.09), col, effect: 'burn', life: 0.9, style: 'k_feather', power: P }); }); } });
K('seraphim', { t: 'k_brand', n: 'Purifying Brand', c: 'trap', r: 'curse', i: '✠', cd: 13, p: 45, col: '#fff176',
  d: 'Brands the target for 3 s: any healing it receives is purified into damage instead',
  m: ['anti-heal', 'reverse-healing'], tg: 'target', an: 'brand',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(t); S.brandT = 3; S.brandBy = f; dealDamage(f, t, SDk(f, P, 0.3), { kind: 'skill', tag: 'skill', power: P }); if (!FX.off) FX.text(t.x, t.y - t.r - 26, '✠ BRANDED', col, 14); } });
K('seraphim', { t: 'k_halojudge', n: 'Halo of Judgment', c: 'trap', r: 'control', i: '◯', cd: 12, p: 55, col: '#ffd54f',
  d: 'A giant halo descends around the target (1 s warning) and snaps shut: everyone still inside is struck and stunned',
  m: ['closing-ring', 'stun-on-close'], tg: 'area', ac: 'delay', an: 'halojudge',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const x = t.x, y = t.y; tele(x, y, 140, col, 1);
    after(1, () => { if (!f.alive) return; for (const e of foesNear(f, x, y, 140)) { dealDamage(f, e, SDk(f, P, 0.8), { kind: 'skill', tag: 'strike', power: P }); if (!e.boss) e.st.stun = Math.max(e.st.stun, 0.6); } ring26(x, y, col, 30, 0.35, 10, 140); burst26(x, y, '#ffffff', 26, 300, 5, 0.5); }); } });
K('seraphim', { t: 'k_song', n: 'Seraph’s Song', c: 'environment', r: 'buff', i: '♬', cd: 15, p: 45, col: '#fff9c4', self: true,
  d: 'Sings for 4 s: allies within 400 px regenerate 1.5% HP per second and enemies within it recover their abilities 30% slower',
  m: ['ally-regen-aura', 'enemy-cd-slow'], tg: 'self', an: 'song',
  fn(f, s, P, col) { sx(f).songT = 4; if (!FX.off) for (let i = 0; i < 3; i++) ring26(f.x, f.y, col, 400, 1 + i * 0.5, 3, f.r); } });
K('seraphim', { t: 'k_sentinel', n: 'Choir Sentinel', c: 'autonomous', i: '✧', cd: 9, p: 50, col: '#ffffff',
  d: 'AUTONOMOUS — the moment the Seraphim is burned, poisoned, slowed, weakened, frozen or stunned, a choir sentinel cleanses it on its own and smites the nearest enemy',
  m: ['auto-cleanse', 'retaliation-zap'], tg: 'self', an: 'sentinel',
  auto: f => f.st.burn > 0 || f.st.poison > 0 || f.st.slow > 0.3 || f.st.weaken > 0 || f.st.freeze > 0 || f.st.stun > 0,
  fn(f, s, P, col) { f.st.burn = f.st.poison = f.st.slow = f.st.weaken = f.st.freeze = f.st.stun = 0; f.poisonStacks = 0; const e = nearestEnemy(f);
    if (e) { dealDamage(f, e, SDk(f, P, 0.5), { kind: 'skill', tag: 'strike', power: P }); if (!FX.off) FX.bolt(f.x, f.y - 30, e.x, e.y, col, 4, 0.35); } ring26(f.x, f.y, col, f.r * 2.4, 0.4, 5, f.r); } });
K('seraphim', { t: 'k_wrathspears', n: 'Wrath of Heaven', c: 'offense', r: 'ranged', i: '⇊', cd: 11, p: 55, col: '#ffecb3',
  d: 'Five holy spears fall one after another along the line from the Seraphim to the target',
  m: ['sequential-line-strikes'], tg: 'aim', ac: 'delay', an: 'wrathspears',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const a = angTo(f, t), d = len(t.x - f.x, t.y - f.y);
    for (let i = 1; i <= 5; i++) { const q = Math.min(1.25, i / 4), x = f.x + dcos(a) * d * q, y = f.y + dsin(a) * d * q; supStrike(f, x, y, 0.35 + i * 0.12, 48, SDk(f, P, 0.28), col, { kind: 'lightning', power: P }); } } });
/* ---- Divine ---- */
K('divine', { t: 'k_miracle', n: 'Miracle of Light', c: 'defense', r: 'defense', i: '✺', cd: 18, p: 45, col: '#fffde7', self: true,
  d: 'A flash of divine light: the Divine and every ally become untouchable for 0.8 s and are cleansed',
  m: ['team-invuln', 'brief', 'cleanse'], tg: 'self', an: 'miracle',
  fn(f, s, P, col) { for (const a of allies(f)) { a.st.invuln = Math.max(a.st.invuln, 0.8); a.st.burn = a.st.poison = a.st.slow = a.st.weaken = 0; a.poisonStacks = 0; ring26(a.x, a.y, col, a.r * 2.6, 0.5, 6, a.r); } if (!FX.off) FX.addFlash(0.15, col); } });
K('divine', { t: 'k_divscales', n: 'Divine Scales', c: 'counter', r: 'ranged', i: '⚖', cd: 12, p: 50, col: '#ffe57f',
  d: 'Weighs its health against the target’s: if the target is healthier it is struck by the difference, if not the Divine is healed by it',
  m: ['hp-comparison', 'balance'], tg: 'target', an: 'divscales',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const diff = t.hpRatio - f.hpRatio;
    if (diff > 0) dealDamage(f, t, Math.max(SDk(f, P, 0.3), Math.min(t.maxHp * 0.18, t.maxHp * diff * 0.5)), { kind: 'skill', tag: 'strike', power: P }); else healFighter(f, Math.min(f.maxHp * 0.1, f.maxHp * -diff * 0.4 + f.maxHp * 0.02));
    if (!FX.off) FX.bolt(f.x, f.y, t.x, t.y, col, 2, 0.4); } });
K('divine', { t: 'k_holyspear', n: 'Holy Spear', c: 'offense', r: 'ranged', i: '↟', cd: 10, p: 55, col: '#ffffff',
  d: 'Hurls a spear that skewers the first enemy and carries it along; if it is pinned against a wall it is rooted and takes extra damage',
  m: ['pin-to-wall', 'piercing', 'carry'], tg: 'aim', an: 'holyspear',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false;
    supShot(f, f.x, f.y, aimAngle(f, t, 700), { speed: 700, r: 10, dmg: SDk(f, P, 0.6), col, life: 1.4, style: 'k_spear', power: P, pierce: 1, onHit: (p, e) => { if (!e.boss && !p.carry) p.carry = e; },
      tick: p => { const e = p.carry; if (e && e.alive) { e.x = inArenaX(p.x, e.r); e.y = inArenaY(p.y, e.r); e.vx = p.vx * 0.3; e.vy = p.vy * 0.3; } },
      onEnd: p => { const e = p.carry; if (e && e.alive && p.life > 0) { sx(e).rootT = 1; _dealDamage26(f, e, SDk(f, P, 0.5), { kind: 'skill', noCrit: true }); if (!FX.off) FX.text(e.x, e.y - e.r - 26, 'PINNED', col, 14); } } }); } });
K('divine', { t: 'k_ascension', n: 'Ascension', c: 'mobility', r: 'mobility', i: '⇑', cd: 13, p: 45, col: '#fff8e1', self: true,
  d: 'Ascends out of reach for 1 s, then descends beside the weakest enemy in a burst of light',
  m: ['untargetable-rise', 'reposition-to-weakest'], tg: 'self', ac: 'delay', an: 'ascension',
  fn(f, s, P, col) { const w = weakestFoe(f); if (!w) return false; f.st.invuln = Math.max(f.st.invuln, 1); f.st.phase = Math.max(f.st.phase, 1); f.casting = Math.max(f.casting, 0.9);
    after(1, () => { if (!f.alive) return; const t = w.alive ? w : weakestFoe(f); if (!t) return; const b = behind(t, f, 50); f.x = inArenaX(b.x, f.r); f.y = inArenaY(b.y, f.r); supBlast(f, f.x, f.y, 120, SDk(f, P, 0.5), { tag: 'explosion', force: 380, power: P }); ring26(f.x, f.y, col, 120, 0.4, 8); }); } });
K('divine', { t: 'k_sacred', n: 'Sacred Ground', c: 'arena', r: 'aoe', i: '✝', cd: 15, p: 50, col: '#fff59d', self: true,
  d: 'Consecrates a wide circle for 5 s: enemies inside burn and cannot be healed, allies inside gain 20% defence',
  m: ['consecrated-zone', 'no-heal-enemies', 'ally-defense'], tg: 'self', an: 'sacred',
  fn(f, s, P, col) { supZone(f, { kind: 'trap', custom: true, x: f.x, y: f.y, r: 260, life: 5, col, dmg: SDk(f, P, 0.08), sacred26: true, onTick: (z, e, d) => { if (d < z.r && (z.ticks.get(e.uid) || 0) <= BATTLE.time) { z.ticks.set(e.uid, BATTLE.time + 0.5); dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', effect: 'burn', power: 50, noCrit: true, sk: z.sk }); } } });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.35 * (1 - q * 0.5); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 260, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(f.x, f.y - 60); ctx.lineTo(f.x, f.y + 60); ctx.moveTo(f.x - 40, f.y - 20); ctx.lineTo(f.x + 40, f.y - 20); ctx.stroke(); ctx.restore(); }, 5); } });
K('divine', { t: 'k_grace', n: 'Grace', c: 'passive', i: '❀', p: 40, col: '#fffde7',
  d: 'PASSIVE — the first time each battle it drops below 25% HP, grace wraps it in a 90% shield for 3 s',
  m: ['passive', 'once-per-battle', 'emergency-shield'], an: 'grace',
  passive(f, h, sk) { const S = sx(f); if (!S.graceUsed && f.hpRatio < 0.25) { S.graceUsed = true; f.st.shield = Math.max(f.st.shield, 3); f.st.shieldPow = 0.9; if (!FX.off) { FX.text(f.x, f.y - f.r - 46, 'GRACE', sk.color, 18); ring26(f.x, f.y, sk.color, f.r * 3, 0.6, 8, f.r); } } } });
/* ---- Ancient God ---- */
const MONOLITH = MD('monolith', 'Monolith', '#3e2723', '#bcaaa4', '#ffcc80', 'runes', ['crystals'], [120, 10, 90, 0, 0]);
K('ancientgod', { t: 'k_monolith', n: 'Monoliths', c: 'arena', r: 'control', i: '▯', cd: 18, p: 50, col: '#ffcc80', self: true,
  d: 'Raises three ancient monoliths for 7 s: they block the way and send out a shockwave every 1.5 s (they can be destroyed)',
  m: ['obstacle-units', 'periodic-waves'], tg: 'global', an: 'monolith',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt), c = t ? { x: (t.x + f.x) / 2, y: (t.y + f.y) / 2 } : { x: ARENA.cx, y: ARENA.cy }; let n = 0;
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + rand(0.5); if (anchor26(f, MONOLITH, c.x + dcos(a) * 150, c.y + dsin(a) * 110, P, { life: 7, hp: 0.1, rScale: 0.7, tick: (u, h) => { u.wT = (u.wT || 1.5) - h; if (u.wT <= 0) { u.wT = 1.5; supWave(f, u.x, u.y, 150, SDk(f, P, 0.15), col, { force: 300, power: P }); } } })) n++; } return n ? undefined : false; } });
K('ancientgod', { t: 'k_roar', n: 'Primordial Roar', c: 'environment', r: 'control', i: '♒', cd: 12, p: 45, col: '#ff8a65',
  d: 'A roar from before time: enemies in front of it are terrified and flee from it for 1.5 s',
  m: ['fear', 'cone'], tg: 'aim', an: 'roar',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); const a = t ? angTo(f, t) : f.rot; let n = 0;
    for (const e of supEnemies(f)) { const d = len(e.x - f.x, e.y - f.y), da = Math.abs(((datan2(e.y - f.y, e.x - f.x) - a + Math.PI * 3) % TAU) - Math.PI); if (d < 380 + e.r && da < 0.8) { n++; const S = sx(e); S.fearT = e.boss ? 0.6 : 1.5; S.fearBy = f; dealDamage(f, e, SDk(f, P, 0.2), { kind: 'skill', tag: 'wave', power: P }); } }
    if (!FX.off) { for (let i = 0; i < 3; i++) ring26(f.x, f.y, col, 380, 0.4 + i * 0.15, 6, f.r); FX.addShake(6); } return n ? undefined : false; } });
K('ancientgod', { t: 'k_runes', n: 'Ancient Runes', c: 'trap', r: 'control', i: 'ᚱ', cd: 13, p: 45, col: '#ffab40', self: true,
  d: 'Carves four runes into the ground around itself; each rune stuns the first enemy that steps on it',
  m: ['rune-traps', 'stun-once'], tg: 'self', an: 'runes',
  fn(f, s, P, col) { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; supZone(f, { kind: 'trap', custom: true, x: inArenaX(f.x + dcos(a) * 150, 30), y: inArenaY(f.y + dsin(a) * 150, 30), r: 30, life: 8, col, dmg: SDk(f, P, 0.25), onTick: (z, e, d) => { if (d < z.r + e.r * 0.5 && !z.used) { z.used = true; dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', power: 50, sk: z.sk }); if (!e.boss) e.st.stun = Math.max(e.st.stun, 0.6); z.life = 0.05; burst26(z.x, z.y, col, 16, 260); } } }); } } });
K('ancientgod', { t: 'k_grip', n: 'Titan Grip', c: 'offense', r: 'melee', i: '✋', cd: 10, p: 60, col: '#a1887f',
  d: 'Seizes the nearest enemy within 260 px, drags it in and slams it into the ground',
  m: ['grab-slam'], tg: 'target', an: 'grip',
  fn(f, s, P, col) { const e = supEnemies(f).filter(e => len(e.x - f.x, e.y - f.y) < 260 + e.r).sort((a, b) => dist2(a.x, a.y, f.x, f.y) - dist2(b.x, b.y, f.x, f.y))[0]; if (!e) return false;
    if (!e.boss) { const a = angTo(f, e); e.x = inArenaX(f.x + dcos(a) * (f.r + e.r + 10), e.r); e.y = inArenaY(f.y + dsin(a) * (f.r + e.r + 10), e.r); }
    dealDamage(f, e, SDk(f, P, 0.9), { kind: 'skill', tag: 'collision', power: P }); knock(e, f.x, f.y, 700); e.vx *= 0.3; e.vy *= 0.3; if (!FX.off) { FX.addShake(8); burst26(e.x, e.y, col, 22, 300, 6, 0.5, 'shard'); } } });
K('ancientgod', { t: 'k_wisdom', n: 'Elder Wisdom', c: 'passive', i: '👁', p: 40, col: '#ffe0b2',
  d: 'PASSIVE — every 10 s it foresees the next enemy ability and that hit does nothing',
  m: ['passive', 'periodic-negate'], an: 'wisdom',
  passive(f, h, sk) { const S = sx(f); if (!S.wisdomReady && (S.wisT = (S.wisT || 10) - h) <= 0) { S.wisdomReady = true; S.wisT = 10; } } });
K('ancientgod', { t: 'k_epoch', n: 'Epoch Shift', c: 'environment', r: 'control', i: '⌛', cd: 16, p: 50, col: '#d7ccc8', self: true,
  d: 'Ages the whole battlefield: every enemy trap, field and wall crumbles away, and enemy summons and clones lose half their health',
  m: ['clear-enemy-zones', 'damage-summons'], tg: 'global', an: 'epoch',
  fn(f, s, P, col) { const B = BATTLE; let n = 0; for (const z of B.zones) if (z.team !== f.team && z.life > 0) { z.life = 0.01; n++; } if (B.walls26) for (const w of B.walls26) if (w.team !== f.team) { w.life = 0.01; n++; }
    for (const u of B.fighters) if (u.alive && u.team !== f.team && (u.isClone || u.unit)) { n++; u.hp -= u.maxHp * 0.5; if (u.hp <= 0) killFighter(u, f); }
    if (!FX.off) { FX.addFlash(0.12, col); FX.text(ARENA.cx, ARENA.y + 60, 'AN EPOCH PASSES', col, 24, { life: 1.4, vy: 0 }); } return n ? undefined : false; } });
/* ---- Creator ---- */
const LIFE_SPRITE = MD('lifesprite', 'Life Sprite', '#e8f5e9', '#69f0ae', '#b9f6ca', 'radiant', ['wings'], [60, 40, 40, 90, 10]);
K('creator', { t: 'k_lifesprite', n: 'Breath of Life', c: 'summon', r: 'summon', i: '❦', cd: 16, p: 50, col: '#b9f6ca', self: true,
  d: 'Breathes life into a sprite that follows the Creator for 8 s, healing it every 1.5 s and pelting enemies with seeds of light',
  m: ['healer-minion'], tg: 'self', an: 'lifesprite',
  fn(f, s, P, col) { const u = summon26(f, LIFE_SPRITE, f.x, f.y - f.r - 30, P, { life: 8, hp: 0.07, rScale: 0.4, shot: { range: 380, cd: 1.5, fire: (m, t) => { healFighter(f, f.maxHp * 0.02, true); supShot(m, m.x, m.y, aimAngle(m, t, 480), { speed: 480, r: 5, dmg: SDk(f, P, 0.1), col, life: 1.2 }); if (!FX.off) FX.bolt(m.x, m.y, f.x, f.y, col, 2, 0.2); } } }); if (!u) return false; } });
K('creator', { t: 'k_terraform', n: 'Terraform', c: 'arena', r: 'control', i: '⬡', cd: 14, p: 45, col: '#a5d6a7',
  d: 'Raises a ring of earth around the target: for 2 s it is caged inside eight walls',
  m: ['cage-circle', 'containment-wall'], tg: 'target', an: 'terraform',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const R = 110, life = t.boss ? 1 : 2;
    for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU; addWall26(f, t.x + dcos(a0) * R, t.y + dsin(a0) * R, t.x + dcos(a1) * R, t.y + dsin(a1) * R, { life, w: 12, col, move: true, shots: false }); } } });
K('creator', { t: 'k_letstars', n: 'Let There Be Stars', c: 'offense', r: 'ranged', i: '✦', cd: 11, p: 55, col: '#fff59d', self: true,
  d: 'Creates five new stars around the arena; after a moment they all converge on the target',
  m: ['converging-projectiles', 'delayed-homing'], tg: 'global', ac: 'delay', an: 'letstars',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; for (let i = 0; i < 5; i++) { const x = ARENA.x + 80 + rand(ARENA.w - 160), y = ARENA.y + 70 + rand(ARENA.h - 140); burst26(x, y, col, 8, 120);
    after(1.1, () => { if (f.alive) supShot(f, x, y, datan2(t.y - y, t.x - x), { speed: 480, r: 8, dmg: SDk(f, P, 0.22), col, life: 2.5, homing: 5, target: t.alive ? t : null, style: 'k_star', power: P }); }); } } });
K('creator', { t: 'k_spark', n: 'Creative Spark', c: 'transform', r: 'buff', i: '✧', cd: 14, p: 50, col: '#ffffff', self: true,
  d: 'Invents something new: for 8 s it gains a brand-new ability borrowed from creation (a random classic ability of another ball)',
  m: ['grant-temp-ability'], tg: 'self', an: 'spark',
  fn(f, s, P, col) { if (f.temp) return false; const pool = allBalls().filter(b => !b.summonOnly && !b.adminOnly && b.id !== f.def.id && b.skills).flatMap(b => b.skills.filter(k => k.legacy && TYPE_META[k.type] && !['copy', 'resurrect', 'adaptive'].includes(k.type)).map(k => ({ k, b })));
    if (!pool.length) return false; const pk = pool[Math.floor(rand(pool.length))]; f.temp = { ...pk.k, name: '✧ ' + pk.k.name, cdLeft: 0, copied: true, expires: 8, color: col };
    if (!FX.off) FX.text(f.x, f.y - f.r - 46, 'CREATED: ' + pk.k.name, col, 15, { life: 1.4 }); } });
K('creator', { t: 'k_blueprint', n: 'Divine Blueprint', c: 'counter', r: 'curse', i: '⌗', cd: 12, p: 45, col: '#e0f2f1',
  d: 'Studies the target’s design: the Creator’s next three hits on it deal 40% more damage',
  m: ['analyze', 'armor-pierce', 'limited-charges'], tg: 'target', an: 'blueprint',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(t); S.bpN = 3; S.bpBy = f; if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = col; ctx.setLineDash([4, 4]); for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(t.x + i * 14, t.y - 40); ctx.lineTo(t.x + i * 14, t.y + 40); ctx.moveTo(t.x - 40, t.y + i * 14); ctx.lineTo(t.x + 40, t.y + i * 14); ctx.stroke(); } ctx.restore(); }, 0.8); } });
K('creator', { t: 'k_worldseed', n: 'World Seed', c: 'passive', i: '🌱', p: 40, col: '#ccff90',
  d: 'PASSIVE — whenever it is healed for a good amount, a seed falls and two seconds later blooms into a small healing garden',
  m: ['passive', 'heal-spawns-zone'], an: 'worldseed', passive() {} });
/* ---- Destroyer ---- */
K('destroyer', { t: 'k_oblit', n: 'Obliteration Mark', c: 'offense', r: 'ranged', i: '⊗', cd: 12, p: 60, col: '#ff1744',
  d: 'Marks a spot for obliteration (1.6 s warning): a column of destruction then erases everything standing there',
  m: ['telegraphed-area', 'heavy-column'], tg: 'area', ac: 'delay', an: 'oblit',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const p = predictPos(f, t, 1.2), x = inArenaX(p.x, 60), y = inArenaY(p.y, 60); tele(x, y, 110, col, 1.6);
    after(1.6, () => { if (!f.alive) return; supBlast(f, x, y, 110, SDk(f, P, 1.4), { tag: 'explosion', force: 700, power: P }); if (!FX.off) { FX.addShake(12); ring26(x, y, col, 110, 0.5, 14); burst26(x, y, col, 40, 500, 7, 0.7, 'shard'); } }); } });
K('destroyer', { t: 'k_unmaking', n: 'Unmaking', c: 'counter', r: 'aoe', i: '✕', cd: 13, p: 50, col: '#ff5252', self: true,
  d: 'Unmakes everything around it: enemy shields, power-ups and reflections within 350 px are erased and their clones destroyed',
  m: ['dispel', 'destroy-clones'], tg: 'self', an: 'unmaking',
  fn(f, s, P, col) { let n = 0; for (const e of BATTLE.fighters) { if (!e.alive || e.team === f.team || len(e.x - f.x, e.y - f.y) > 350 + e.r) continue; if (e.isClone && !e.unit) { killFighter(e, f); n++; continue; }
      for (const k of ['shield', 'buff', 'reflect', 'overclock', 'absorb', 'reverse', 'phase']) if (e.st[k] > 0) { e.st[k] = 0; n++; } dealDamage(f, e, SDk(f, P, 0.35), { kind: 'skill', tag: 'wave', power: P }); }
    ring26(f.x, f.y, col, 350, 0.45, 8, f.r); return undefined; } });
K('destroyer', { t: 'k_ravager', n: 'Ravager Form', c: 'transform', r: 'buff', i: '☠', cd: 16, p: 55, col: '#d50000', self: true,
  d: 'Becomes a ravager for 6 s: collisions hit 50% harder and send out a shockwave — but it takes 10% more damage',
  m: ['self-transform', 'collision-empower', 'vulnerability-cost'], tg: 'self', an: 'ravager',
  fn(f, s, P, col) { const S = sx(f); S.ravT = 6; S.ravP = P; burst26(f.x, f.y, col, 30, 360, 6, 0.6); } });
K('destroyer', { t: 'k_shatterground', n: 'Shatter Ground', c: 'arena', r: 'aoe', i: '✚', cd: 13, p: 55, col: '#ff6e40',
  d: 'Cracks the arena in a cross centred on the target; the four cracks keep burning for 2.5 s',
  m: ['cross-pattern', 'lingering-cracks'], tg: 'area', ac: 'charge', an: 'shatterground',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, e = rayToWall(t.x, t.y, a); addLaser(f, [t.x, t.y, e.x, e.y], { charge: 0.55, dur: 2.5, w: 14, dmg: SDk(f, P, 0.25), col }); } } });
K('destroyer', { t: 'k_doom', n: 'Doom Clock', c: 'trap', r: 'curse', i: '⏲', cd: 13, p: 45, col: '#ff8a80',
  d: 'Starts the doom clock on the target: when it runs out (5 s), the target suffers 30% of all the damage it dealt meanwhile',
  m: ['delayed-penalty', 'damage-dealt-tracking'], tg: 'target', ac: 'delay', an: 'doom',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const S = sx(t); S.doomT = 5; S.doomD = 0;
    after(5, () => { if (t.alive) { _dealDamage26(f.alive ? f : null, t, Math.max(SDk(f, P, 0.15), (S.doomD || 0) * 0.3), { kind: 'skill', noCrit: true, noDef: true }); if (!FX.off) { FX.text(t.x, t.y - t.r - 26, 'DOOM', col, 18); ring26(t.x, t.y, col, t.r * 3, 0.4, 8, t.r); } } }); } });
K('destroyer', { t: 'k_endless', n: 'Endless Destruction', c: 'passive', i: '∞', p: 40, col: '#ff1744',
  d: 'PASSIVE — every third hit in a row on the same enemy adds +4% attack for the rest of the battle (up to +20%)',
  m: ['passive', 'stacking-attack', 'same-target-stacks'], an: 'endless', passive() {} });
/* ---- Absolute ---- */
K('absolute', { t: 'k_zeropoint', n: 'Zero Point', c: 'environment', r: 'control', i: '•', cd: 12, p: 50, col: '#eceff1',
  d: 'Creates a point where motion is forbidden: enemies within 120 px of it cannot move for 1.6 s, then are expelled',
  m: ['velocity-null-zone'], tg: 'area', an: 'zeropoint',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; supZone(f, { kind: 'trap', custom: true, x: t.x, y: t.y, r: 120, life: 1.6, col, dmg: SDk(f, P, 0.15), zero26: true, repel26: 800,
    onTick: (z, e, d) => { if (d < z.r && !e.boss) { e.vx = 0; e.vy = 0; } if (d < z.r && (z.ticks.get(e.uid) || 0) <= BATTLE.time) { z.ticks.set(e.uid, BATTLE.time + 0.5); dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', noCrit: true, sk: z.sk }); } } }); } });
K('absolute', { t: 'k_order', n: 'Absolute Order', c: 'counter', r: 'defense', i: '⊟', cd: 14, p: 45, col: '#ffffff', self: true,
  d: 'Restores order: every enemy shot in the arena is erased, and each enemy whose shot was erased is stunned for a moment',
  m: ['clear-all-projectiles', 'punish-casters'], tg: 'global', an: 'order',
  fn(f, s, P, col) { const own = new Set(); let n = 0; for (let k = BATTLE.projs.length - 1; k >= 0; k--) { const p = BATTLE.projs[k]; if (p.team === f.team || p.ult) continue; n++; if (p.owner) own.add(p.owner.credit || p.owner); burst26(p.x, p.y, col, 5, 140); BATTLE.projs.splice(k, 1); }
    for (const e of own) if (e.alive && !e.boss) e.st.stun = Math.max(e.st.stun, 0.4); if (!FX.off) FX.addFlash(0.1, col); return n ? undefined : false; } });
K('absolute', { t: 'k_unyielding', n: 'Unyielding', c: 'defense', r: 'defense', i: '▣', cd: 14, p: 45, col: '#cfd8dc', self: true,
  d: 'For 3 s nothing moves it: immune to stuns and knockback, and enemies that ram it bounce off hurt',
  m: ['cc-immune', 'knockback-immune', 'collision-reflect'], tg: 'self', an: 'unyielding',
  fn(f, s, P, col) { f.ccImm = Math.max(f.ccImm || 0, 3); const S = sx(f); S.steadyT = 3; S.unyT = 3; S.unyP = P; f.st.stun = f.st.freeze = 0; ring26(f.x, f.y, col, f.r * 2.2, 0.4, 7, f.r); } });
K('absolute', { t: 'k_edge', n: 'Absolute Edge', c: 'offense', r: 'ranged', i: '／', cd: 9, p: 55, col: '#ffffff',
  d: 'A single perfect cut along a thin line through the target (0.5 s warning) — always a critical hit',
  m: ['precision-line', 'guaranteed-crit'], tg: 'aim', ac: 'charge', an: 'edge',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const a = angTo(f, t), e = rayToWall(f.x, f.y, a);
    addLaser(f, [f.x, f.y, e.x, e.y], { charge: 0.5, dur: 0.12, w: 5, dmg: SDk(f, P, 1.0 * 1.75), col }); } });
K('absolute', { t: 'k_presence', n: 'Absolute Presence', c: 'passive', i: '◆', p: 40, col: '#eceff1',
  d: 'PASSIVE — its shots cannot be reflected, absorbed or blocked, and its damage pushes 20% harder through shields',
  m: ['passive', 'unreflectable', 'shield-pierce'], an: 'presence', passive() {} });
K('absolute', { t: 'k_verdict', n: 'Final Verdict', c: 'offense', r: 'ranged', i: '⚔', cd: 12, p: 55, col: '#f5f5f5',
  d: 'Passes the final verdict: a light strike — but if the target is below 25% HP it is a devastating one',
  m: ['execute-threshold', 'single-target'], tg: 'target', an: 'verdict',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const low = t.hpRatio < 0.25; dealDamage(f, t, SDk(f, P, low ? 1.7 : 0.45), { kind: 'skill', tag: 'strike', power: P });
    if (!FX.off) { FX.bolt(t.x, ARENA.y, t.x, t.y, col, low ? 8 : 3, 0.4); if (low) { FX.text(t.x, t.y - t.r - 30, 'VERDICT', col, 22, { pop: 2 }); FX.addShake(10); } } } });
/* ---- God of Chaos ---- */
K('godofchaos', { t: 'k_chaostheory', n: 'Chaos Theory', c: 'environment', r: 'aoe', i: '≋', cd: 14, p: 55, col: '#d500f9', self: true,
  d: 'For 4 s, every 0.8 s a random hazard erupts next to an enemy: a lightning strike, a toxic pool, a bolt from the wall or a gravity snag',
  m: ['random-hazards', 'timed-spawns'], tg: 'global', an: 'chaostheory',
  fn(f, s, P, col) { for (let i = 0; i < 5; i++) after(0.2 + i * 0.8, () => { if (!f.alive) return; const es = supEnemies(f); if (!es.length) return; const e = es[Math.floor(rand(es.length))], k = Math.floor(rand(4));
    if (k === 0) supStrike(f, e.x, e.y, 0.45, 60, SDk(f, P, 0.3), col, { kind: 'lightning', power: P });
    else if (k === 1) twMiniZone(f, e.x, e.y, 70, 2.5, SDk(f, P, 0.08), '#76ff03', 'poison');
    else if (k === 2) { const x = e.x < ARENA.cx ? ARENA.x + 15 : ARENA.r - 15; supShot(f, x, e.y, datan2(0, e.x - x), { speed: 640, r: 9, dmg: SDk(f, P, 0.3), col, life: 2 }); }
    else { for (const o of foesNear(f, e.x, e.y, 180)) knock(o, e.x, e.y, -500); ring26(e.x, e.y, col, 20, 0.35, 5, 180); } }); } });
K('godofchaos', { t: 'k_fractal', n: 'Fractal Split', c: 'offense', r: 'ranged', i: '⑃', cd: 9, p: 55, col: '#ea80fc',
  d: 'A bolt that splits on a timer: into two after 0.35 s, and each of those into two more after 0.7 s',
  m: ['timed-fractal-split'], tg: 'aim', an: 'fractal',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false;
    const shot = (x, y, a, gen, dmg) => supShot(f, x, y, a, { speed: 520, r: 10 - gen * 2, dmg, col, life: 1.6, power: P, data: { age: 0 }, tick: (p, h) => { p.data.age += h; if (gen < 2 && p.data.age > 0.35 && !p.data.done) { p.data.done = true; const b = datan2(p.vy, p.vx); for (const k of [-0.35, 0.35]) shot(p.x, p.y, b + k, gen + 1, dmg * 0.6); p.life = 0; } } });
    shot(f.x, f.y, aimAngle(f, t, 520), 0, SDk(f, P, 0.55)); } });
K('godofchaos', { t: 'k_pandemonium', n: 'Pandemonium Shield', c: 'defense', r: 'defense', i: '⛉', cd: 13, p: 50, col: '#f50057', self: true,
  d: 'A crackling shield for 3 s (30% block); every hit on it makes chaos strike back at random — a bolt, a stunning zap or a slowing burst',
  m: ['random-retaliation', 'shield'], tg: 'self', an: 'pandemonium',
  fn(f, s, P, col) { f.st.shield = Math.max(f.st.shield, 3); f.st.shieldPow = Math.max(f.st.shieldPow, 0.3); const S = sx(f); S.pandT = 3; S.pandP = P; } });
K('godofchaos', { t: 'k_discord', n: 'Discord', c: 'environment', r: 'control', i: '⚡', cd: 14, p: 45, col: '#ff4081', self: true,
  d: 'Sows discord: for 3 s enemies turn on each other (in a duel the enemy staggers about aimlessly for 1.2 s)',
  m: ['turn-enemies', 'confusion'], tg: 'global', an: 'discord',
  fn(f, s, P, col) { const es = supEnemies(f).filter(e => !e.isClone); if (!es.length) return false;
    if (es.length >= 2) for (const e of es) { sx(e).discordT = 3; e.target = es.find(o => o !== e) || null; } else { const e = es[0]; if (!e.boss) sx(e).blindT = 1.2; }
    if (!FX.off) for (const e of es) FX.text(e.x, e.y - e.r - 26, 'DISCORD', col, 13); } });
/* ---- God of War ---- */
const WAR_BANNER = MD('banner', 'War Banner', '#b71c1c', '#ffd54f', '#ff5252', 'stripes', ['crown'], [90, 10, 70, 0, 0]);
K('godofwar', { t: 'k_banner', n: 'War Banner', c: 'summon', r: 'buff', i: '⚑', cd: 16, p: 50, col: '#ff5252', self: true,
  d: 'Plants a war banner for 6 s: allies near it hit 20% harder and enemies near it are 10% easier to hurt (it can be torn down)',
  m: ['banner-unit', 'ally-attack-aura'], tg: 'self', an: 'banner',
  fn(f, s, P, col) { const u = anchor26(f, WAR_BANNER, f.x, f.y, P, { life: 6, hp: 0.1, rScale: 0.55, tick: (u) => { for (const e of BATTLE.fighters) if (e.alive && !(e.st.outside > 0) && len(e.x - u.x, e.y - u.y) < 260) sx(e).bannerIn = e.team === u.team ? 2 : 1; } }); if (!u) return false; } });
K('godofwar', { t: 'k_shieldwall', n: 'Shield Wall', c: 'defense', r: 'defense', i: '⛊', cd: 12, p: 55, col: '#ffab40', self: true,
  d: 'Locks its shield to the front for 2.5 s (frontal hits lose 80%), then bashes forward into the enemy',
  m: ['frontal-block', 'bash'], tg: 'self', an: 'shieldwall',
  fn(f, s, P, col) { const S = sx(f); S.wallT = 2.5; after(2.5, () => { const t = nearestEnemy(f); if (!f.alive || !t) return; const a = angTo(f, t), sp = f.baseSpeed * 2.3; f.vx = dcos(a) * sp; f.vy = dsin(a) * sp; f.st.dash = 0.5; f.dashEffect = 'stun'; f.dashPow = P; f.dashSk = s.uid; f.dashSkT = 0.6; }); } });
K('godofwar', { t: 'k_challenge', n: 'Warlord’s Challenge', c: 'counter', r: 'control', i: '⚔', cd: 15, p: 45, col: '#ff1744',
  d: 'Challenges the most dangerous enemy to a duel for 4 s: it must fight the God of War, both deal each other 20% more, and anyone else interfering does 50% less to it',
  m: ['taunt', 'duel-bonus'], tg: 'target', an: 'challenge',
  fn(f, s, P, col) { const t = strongestFoe(f); if (!t) return false; const S = sx(f); S.duelT = 4; S.duelWith = t; sx(t).duelT = 4; sx(t).duelWith = f; if (t.ai && !t.boss) t.target = f; if (!FX.off) { FX.bolt(f.x, f.y, t.x, t.y, col, 3, 0.5); FX.text(t.x, t.y - t.r - 28, 'CHALLENGED', col, 15); } } });
K('godofwar', { t: 'k_spears', n: 'Spear Barrage', c: 'offense', r: 'ranged', i: '⇉', cd: 10, p: 55, col: '#ffcc80',
  d: 'Hurls five war spears in quick succession, each faster than the last; every spear that lands slows the target',
  m: ['rapid-sequence', 'pin-slow'], tg: 'aim', ac: 'channel', an: 'spears',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; for (let i = 0; i < 5; i++) after(i * 0.12, () => { if (!f.alive || !t.alive) return; const sp = 520 + i * 90; supShot(f, f.x, f.y, aimAngle(f, t, sp), { speed: sp, r: 7, dmg: SDk(f, P, 0.2), col, life: 1.4, style: 'k_spear', power: P, effect: 'slow' }); }); } });
/* ---- AI Tech ---- */
K('aitech', { t: 'k_predictive', n: 'Predictive Algorithm', c: 'counter', r: 'buff', i: '⌬', cd: 13, p: 45, col: '#00e5ff', self: true,
  d: 'Runs a prediction model for 4 s: its aimed shots lead their targets perfectly and enemy shots near it are slowed by 40%',
  m: ['perfect-lead', 'slow-incoming'], tg: 'self', an: 'predictive',
  fn(f, s, P, col) { sx(f).predT26 = 4; ring26(f.x, f.y, col, 200, 0.5, 3, f.r); } });
K('aitech', { t: 'k_hack', n: 'Neural Hack', c: 'counter', r: 'control', i: '⌨', cd: 13, p: 45, col: '#18ffff',
  d: 'Hacks the target’s brain for 1.2 s: its abilities are offline and it wanders where the virus tells it',
  m: ['hack', 'random-control'], tg: 'target', an: 'hack',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; silenceFoe(f, t, 1.2, 'HACKED'); if (!t.boss) sx(t).blindT = 1.2; dealDamage(f, t, SDk(f, P, 0.25), { kind: 'skill', tag: 'skill', power: P }); if (!FX.off) FX.bolt(f.x, f.y, t.x, t.y, col, 2, 0.3); } });
K('aitech', { t: 'k_nanoswarm', n: 'Nanoswarm', c: 'offense', r: 'ranged', i: '⁘', cd: 12, p: 50, col: '#80deea',
  d: 'Releases a swarm of nanobots that cloud around the target for 3 s, nibbling at it and eating 10% of its armour',
  m: ['swarm-cloud', 'defense-shred'], tg: 'target', an: 'nanoswarm',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; for (let i = 0; i < 8; i++) supShot(f, f.x, f.y, i / 8 * TAU, { speed: 1, r: 5, dmg: SDk(f, P, 0.07), col, life: 3.2, pierce: 99, style: 'k_nano', power: P, data: { a: i / 8 * TAU, age: 0 },
    tick: (p, h) => { const D = p.data; D.age += h; D.a += 4 * h; const tt = t.alive ? t : null; const cx = tt ? tt.x : p.x, cy = tt ? tt.y : p.y, R = D.age < 0.4 ? 0 : 34; p.vx = 0; p.vy = 0; p.x = D.age < 0.4 ? p.x + (cx - p.x) * Math.min(1, h * 8) : cx + dcos(D.a) * R; p.y = D.age < 0.4 ? p.y + (cy - p.y) * Math.min(1, h * 8) : cy + dsin(D.a) * R; if ((D.r = (D.r || 0) - h) <= 0) { D.r = 0.5; p.hits = new Set(); } },
    onHit: (p, e) => { const S = sx(e); S.sunderT = Math.max(S.sunderT || 0, 3); S.sunderK = Math.max(S.sunderK || 0, 0.1); } }); } });
K('aitech', { t: 'k_upgrade', n: 'Self-Upgrade', c: 'transform', r: 'buff', i: '⇪', cd: 15, p: 45, col: '#69f0ae', self: true,
  d: 'Installs an upgrade for the rest of the battle: +5% attack and speed each time (up to three versions)',
  m: ['permanent-stacks', 'self-improve'], tg: 'self', an: 'upgrade',
  fn(f, s, P, col) { const S = sx(f); if ((S.upg || 0) >= 3) return false; S.upg = (S.upg || 0) + 1; if (!FX.off) FX.text(f.x, f.y - f.r - 46, 'VERSION ' + (S.upg + 1) + '.0', col, 16); } });
/* ---- Solar Eclipse ---- */
K('solareclipse', { t: 'k_diamondring', n: 'Diamond Ring', c: 'offense', r: 'aoe', i: '💍', cd: 12, p: 55, col: '#ffffff', self: true,
  d: 'The diamond ring flashes: a blinding ray sweeps a full circle around the eclipse in 1.5 s',
  m: ['rotating-laser', 'full-circle'], tg: 'self', ac: 'charge', an: 'diamondring',
  fn(f, s, P, col) { addLaser(f, [0, 0, 0, 0], { charge: 0.4, dur: 1.5, w: 14, dmg: SDk(f, P, 0.35), col, sweep: { cx: f.x, cy: f.y, a0: rand(TAU), av: TAU / 1.5, len: 330 } }); const L = lastLaser(); if (L) L.follow26 = f; } });
K('solareclipse', { t: 'k_beads', n: 'Baily’s Beads', c: 'trap', r: 'aoe', i: '∘', cd: 11, p: 55, col: '#ffe082',
  d: 'Strings seven beads of light in an arc toward the target; they detonate one after another along the arc',
  m: ['bead-chain', 'sequential-detonation'], tg: 'aim', ac: 'delay', an: 'beads',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const a = angTo(f, t), d = Math.min(420, len(t.x - f.x, t.y - f.y) + 40);
    for (let i = 0; i < 7; i++) { const q = (i - 3) / 3, x = inArenaX(f.x + dcos(a + q * 0.5) * d, 30), y = inArenaY(f.y + dsin(a + q * 0.5) * d, 30); tele(x, y, 50, col, 0.6 + i * 0.15); supStrike(f, x, y, 0.6 + i * 0.15, 50, SDk(f, P, 0.25), col, { kind: 'meteor', power: P }); } } });
K('solareclipse', { t: 'k_totality', n: 'Totality Veil', c: 'environment', r: 'control', i: '◕', cd: 15, p: 45, col: '#212121', self: true,
  d: 'Totality falls in a 260 px dome for 4 s: enemies inside cannot see to aim at anyone, allies inside hit 10% harder',
  m: ['vision-denial', 'damage-zone-buff'], tg: 'self', an: 'totality',
  fn(f, s, P, col) { supZone(f, { kind: 'trap', custom: true, x: f.x, y: f.y, r: 260, life: 4, col, dmg: 0, veil26: true });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.45 * (1 - q * 0.4); ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(f.x, f.y, 260, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }, 4); } });
/* ---- God of Guns ---- */
K('godofguns', { t: 'k_revolver', n: 'Ricochet Revolver', c: 'offense', r: 'ranged', i: '⁍', cd: 10, p: 55, col: '#ffd54f',
  d: 'Fans six revolver rounds at the walls; after their first ricochet every round homes in on the target',
  m: ['six-shooter', 'smart-ricochet'], tg: 'aim', an: 'revolver',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const b = angTo(f, t);
    for (let i = 0; i < 6; i++) after(i * 0.07, () => { if (!f.alive) return; supShot(f, f.x, f.y, b + Math.PI + (i - 2.5) * 0.35, { speed: 760, r: 5, dmg: SDk(f, P, 0.2), col, life: 2.4, bounce: 2, style: 'k_bullet', power: P, data: { b0: 2 }, tick: p => { if (p.bounce < p.data.b0 && !p.data.home) { p.data.home = true; p.target = t.alive ? t : null; p.homing = 7; } } }); }); } });
K('godofguns', { t: 'k_snipe', n: 'Sniper’s Nest', c: 'transform', r: 'ranged', i: '⌖', cd: 13, p: 60, col: '#ff1744',
  d: 'Plants itself and aims for 1.5 s (a red laser sight shows the line), then fires one devastating high-velocity round',
  m: ['anchor-stance', 'charged-snipe'], tg: 'target', ac: 'charge', an: 'snipe',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; f.casting = Math.max(f.casting, 1.5); f.vx *= 0.1; f.vy *= 0.1;
    if (!FX.off) vfx((ctx, q) => { if (!t.alive) return; ctx.save(); ctx.globalAlpha = 0.3 + 0.6 * q; ctx.strokeStyle = col; ctx.lineWidth = 1 + q * 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.beginPath(); ctx.arc(t.x, t.y, 30 - q * 18, 0, TAU); ctx.stroke(); ctx.restore(); }, 1.5, { keep: true });
    after(1.5, () => { if (!f.alive || !t.alive) return; supShot(f, f.x, f.y, aimAngle(f, t, 1600), { speed: 1600, r: 7, dmg: SDk(f, P, 1.6), col, life: 1, style: 'k_bullet', power: P }); if (!FX.off) FX.addShake(6); }); } });
K('godofguns', { t: 'k_smoke', n: 'Smoke Grenade', c: 'environment', r: 'defense', i: '☁', cd: 13, p: 45, col: '#9e9e9e', self: true,
  d: 'Pops a smoke grenade (200 px, 4 s): enemy shots inside lose their lock, and the God of Guns dodges 30% of hits while inside',
  m: ['smoke', 'targeting-block'], tg: 'self', an: 'smoke',
  fn(f, s, P, col) { supZone(f, { kind: 'trap', custom: true, x: f.x, y: f.y, r: 200, life: 4, col, dmg: 0, smoke26: true });
    if (!FX.off) for (let i = 0; i < 26; i++) { const a = vr(TAU), d = vr(200); FX.p(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, vr(-12, 12), vr(-12, 12), 4, vr(26, 46), 'rgba(160,160,160,0.3)', 'smoke', 0.2); } } });
K('godofguns', { t: 'k_bullettime', n: 'Bullet Time', c: 'counter', r: 'defense', i: '⏲', cd: 14, p: 45, col: '#ffe57f', self: true,
  d: 'Bends time around it for 2.5 s: every enemy shot within 400 px crawls at a quarter of its speed',
  m: ['slow-projectiles', 'area'], tg: 'self', an: 'bullettime',
  fn(f, s, P, col) { sx(f).btT = 2.5; if (!FX.off) { BATTLE.timeTint = Math.max(BATTLE.timeTint, 0.6); ring26(f.x, f.y, col, 400, 0.6, 3, f.r); } } });
/* ---- God Portal ---- */
K('godportal', { t: 'k_portalbarrage', n: 'Portal Barrage', c: 'offense', r: 'ranged', i: '◎', cd: 10, p: 55, col: '#7c4dff',
  d: 'Opens four portals around the target; a void bolt shoots out of each one straight at it',
  m: ['portal-ring', 'surround-fire'], tg: 'target', an: 'portalbarrage',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const ph = rand(TAU);
    for (let i = 0; i < 4; i++) { const a = ph + i / 4 * TAU, x = inArenaX(t.x + dcos(a) * 190, 30), y = inArenaY(t.y + dsin(a) * 150, 30); openPortal(x, y, { r: 30, life: 0.9, col });
      after(0.4 + i * 0.08, () => { if (f.alive && t.alive) supShot(f, x, y, datan2(t.y - y, t.x - x), { speed: 600, r: 8, dmg: SDk(f, P, 0.24), col, life: 1, style: 'void', power: P }); }); } } });
K('godportal', { t: 'k_wormholes', n: 'Wormhole Network', c: 'mobility', r: 'mobility', i: '⥁', cd: 12, p: 50, col: '#b388ff',
  d: 'Jumps through three wormholes around the target in quick succession, leaving a void bomb behind at every exit',
  m: ['multi-wormhole', 'exit-bombs'], tg: 'target', an: 'wormholes',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const ph = rand(TAU);
    for (let i = 0; i < 3; i++) after(i * 0.3, () => { if (!f.alive) return; const tt = t.alive ? t : nearestEnemy(f); if (!tt) return; const a = ph + i / 3 * TAU, x = inArenaX(tt.x + dcos(a) * 160, f.r), y = inArenaY(tt.y + dsin(a) * 130, f.r);
      openPortal(f.x, f.y, { r: f.r * 1.2, life: 0.4, col }); f.x = x; f.y = y; openPortal(x, y, { r: f.r * 1.2, life: 0.4, col }); supStrike(f, x, y, 0.7, 70, SDk(f, P, 0.28), col, { kind: 'meteor', power: P }); }); } });
K('godportal', { t: 'k_horizongate', n: 'Event Horizon Gate', c: 'trap', r: 'control', i: '⊚', cd: 13, p: 50, col: '#651fff',
  d: 'Opens a gate in the target’s path for 5 s: the first enemy to touch it is swallowed for a second and spat out against the far wall',
  m: ['capture-gate', 'eject-far'], tg: 'area', an: 'horizongate',
  fn(f, s, P, col, tgt) { const t = tgtOr(f, tgt); if (!t) return false; const p = predictPos(f, t, 0.8);
    supZone(f, { kind: 'trap', custom: true, x: inArenaX(p.x, 60), y: inArenaY(p.y, 60), r: 55, life: 5, col, dmg: SDk(f, P, 0.4), onTick: (z, e, d) => { if (d < z.r + e.r * 0.5 && !z.used && !e.beyond && !(e.st.outside > 0)) { z.used = true; z.life = 0.05; dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', power: 50, sk: z.sk }); if (e.boss || e.anchored) return; e.st.outside = 1; e.portalExit = { mode: 'point', x: e.x < ARENA.cx ? ARENA.r - 70 : ARENA.x + 70, y: inArenaY(e.y, 70), col }; } } });
    if (!FX.off) vfx((ctx, q) => { ctx.save(); ctx.globalAlpha = 0.8 * (1 - q * 0.3); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(inArenaX(p.x, 60), inArenaY(p.y, 60), 55, q * 30, q * 30 + 5); ctx.stroke(); ctx.restore(); }, 5); } });
K('godportal', { t: 'k_anchor', n: 'Dimensional Anchor', c: 'counter', r: 'control', i: '⚓', cd: 14, p: 45, col: '#9575cd', self: true,
  d: 'Drops a dimensional anchor: for 4 s enemies within 500 px cannot use any movement ability (dashes, blinks, portals)',
  m: ['anti-mobility', 'lock-teleport'], tg: 'area', an: 'anchor',
  fn(f, s, P, col) { const es = supEnemies(f).filter(e => len(e.x - f.x, e.y - f.y) < 500); if (!es.length) return false; for (const e of es) sx(e).anchorT = 4; if (!FX.off) { ring26(f.x, f.y, col, 500, 0.6, 4, f.r); for (const e of es) FX.text(e.x, e.y - e.r - 26, 'ANCHORED', col, 13); } } });
/* ---- God of Absolute ---- */
K('godofabsolute', { t: 'k_mandate', n: 'Mandate of Heaven', c: 'environment', r: 'control', i: '☰', cd: 14, p: 50, col: '#ffd700', self: true,
  d: 'Issues a heavenly mandate: every enemy within 500 px has its cooldowns pushed back 2 s, and each one fuels the ultimate',
  m: ['global-cd-delay', 'meter-gain'], tg: 'area', an: 'mandate',
  fn(f, s, P, col) { const es = supEnemies(f).filter(e => len(e.x - f.x, e.y - f.y) < 500 && !e.isClone); if (!es.length) return false;
    for (const e of es) { for (const k of e.skills || []) k.cdLeft = Math.max(k.cdLeft, 0) + 2; if (!f.isClone) f.ultMeter = Math.min(100, f.ultMeter + 8); if (!FX.off) FX.bolt(f.x, f.y, e.x, e.y, col, 2, 0.4); } if (!FX.off) FX.text(f.x, f.y - f.r - 50, 'BY MY MANDATE', col, 16); } });
K('godofabsolute', { t: 'k_rebuke', n: 'Absolute Rebuke', c: 'counter', r: 'defense', i: '⟰', cd: 13, p: 55, col: '#fff8e1', self: true,
  d: 'For 1.5 s every enemy ability that strikes it is refused and answered with a golden lance at its caster',
  m: ['negate-and-return'], tg: 'self', an: 'rebuke',
  fn(f, s, P, col) { const S = sx(f); S.rebukeT = 1.5; S.rebukeP = P; ring26(f.x, f.y, col, f.r * 2.4, 0.4, 7, f.r); } });
K('godofabsolute', { t: 'k_starforge', n: 'Starforge Lances', c: 'offense', r: 'aoe', i: '⇓', cd: 12, p: 55, col: '#ffd54f', self: true,
  d: 'Forges six golden lances in the sky above the enemies; a second later they drop where the enemies stand',
  m: ['forged-lances', 'telegraphed-rain'], tg: 'global', ac: 'delay', an: 'starforge',
  fn(f, s, P, col) { const es = supEnemies(f); if (!es.length) return false; for (let i = 0; i < 6; i++) { const e = es[i % es.length], x = e.x + rand(-50, 50), y = e.y + rand(-40, 40); tele(x, y, 50, col, 1 + i * 0.08); supStrike(f, x, y, 1 + i * 0.08, 50, SDk(f, P, 0.3), col, { kind: 'lightning', power: P }); } } });
K('godofabsolute', { t: 'k_instinct', n: 'Divine Instinct', c: 'autonomous', i: '⚡', cd: 15, p: 50, col: '#ffe57f',
  d: 'AUTONOMOUS — the instant any enemy’s ultimate is fully charged, a golden bolt strikes it on its own and drains 30% of that charge',
  m: ['auto-trigger', 'ult-interrupt', 'meter-drain'], tg: 'target', an: 'instinct',
  auto: f => supEnemies(f).some(e => !e.isClone && e.ultMeter >= 100),
  fn(f, s, P, col) { const e = supEnemies(f).find(e => !e.isClone && e.ultMeter >= 100); if (!e) return false; e.ultMeter = Math.max(0, e.ultMeter - 30); dealDamage(f, e, SDk(f, P, 0.35), { kind: 'skill', tag: 'strike', power: P }); if (!FX.off) { FX.bolt(f.x, f.y, e.x, e.y, col, 4, 0.35); FX.text(e.x, e.y - e.r - 28, 'INTERRUPTED', col, 14); } } });

/* ---------------- states and hooks ---------------- */
const MOBILITY_TYPES = new Set(['dash', 'teleport', 'portalgate', 'dimescape', 'voidtp']);
{ const us = useSkill; useSkill = function (f, sk) { if (f && sk && f.sx && f.sx.anchorT > 0 && (MOBILITY_TYPES.has(sk.type) || catOf(sk) === 'mobility')) { if (f.manual && !FX.off) FX.text(f.x, f.y - f.r - 26, 'ANCHORED', '#9575cd', 13, { life: 0.5 }); return false; } return us(f, sk); }; }
{ const hf = healFighter; healFighter = function (f, amt, silent) {
  const S = f && f.sx;
  if (S && S.brandT > 0 && amt > 0 && BATTLE) { const by = S.brandBy && S.brandBy.alive ? S.brandBy : null; _dealDamage26(by, f, amt * 0.6, { kind: 'dot', noCrit: true, noDef: true }); return; }
  if (S && S.noHealIn > 0 && amt > 0) return;
  const before = f && f.hp; hf(f, amt, silent);
  if (f && BATTLE && hasPas(f, 'k_worldseed') && f.hp - before >= f.maxHp * 0.02 && twReady(f, 'seed', 3)) { const x = f.x, y = f.y; after(2, () => { if (!f.alive) return; const z = twMiniZone(f, x, y, 90, 3, 0, '#ccff90', 'none'); z.ally26 = 0.02; burst26(x, y, '#ccff90', 14, 180); }); }
}; }
SUP.dmgHooks.push((src, tgt, amt, o) => {
  const S = tgt.sx, cs = src && src.credit, C = cs && cs.sx;
  if (C && C.duelT > 0 && C.duelWith === tgt) amt *= 1.2;
  if (S && S.duelT > 0 && cs && S.duelWith && S.duelWith !== cs && cs.team !== tgt.team && tgt.def && tgt.def.id === 'godofwar') amt *= 0.5;
  if (cs && hasPas(cs, 'k_presence') && tgt.st.shield > 0) amt *= 1.2;
  if (cs && hasPas(cs, 'k_endless') && o.kind !== 'dot') { const E = sx(cs); E.endN = E.endTgt === tgt ? (E.endN || 0) + 1 : 1; E.endTgt = tgt; if (E.endN % 3 === 0) E.endStacks = Math.min(5, (E.endStacks || 0) + 1); }
  if (C && C.ravT > 0 && o.kind === 'collision') amt *= 1.5;
  if (S && S.bpN > 0 && cs && cs === S.bpBy && o.kind !== 'dot') { S.bpN--; amt *= 1.4; }
  if (C && C.doomT > 0) C.doomD = (C.doomD || 0) + amt;
  if (!S) return amt;
  if (S.ravT > 0) amt *= 1.1;
  if (S.wallT > 0 && src && o.kind !== 'dot') { const fa = datan2(tgt.vy, tgt.vx), aa = datan2(src.y - tgt.y, src.x - tgt.x), da = Math.abs(((aa - fa + Math.PI * 3) % TAU) - Math.PI); if (da < 1.2) amt *= 0.2; }
  if (S.wisdomReady && hasPas(tgt, 'k_wisdom') && o.kind === 'skill') { S.wisdomReady = false; if (!FX.off) FX.text(tgt.x, tgt.y - tgt.r - 20, 'FORESEEN', '#ffe0b2', 14, { life: 0.6 }); return 0; }
  if (S.rebukeT > 0 && o.kind === 'skill' && src && src.alive && src.team !== tgt.team) { const by = src.credit || src; after(0, () => { if (by.alive && tgt.alive) addLaser(tgt, [tgt.x, tgt.y, by.x, by.y], { charge: 0.12, dur: 0.18, w: 12, dmg: skillDmg(tgt, S.rebukeP || 55) * 0.4, col: '#ffd54f' }); }); return 0; }
  if (S.pandT > 0 && src && src.alive && src.team !== tgt.team && o.kind !== 'dot' && twReady(tgt, 'pand', 0.4)) { const k = Math.floor(rand(3)), by = src.credit || src, P = S.pandP || 50; after(0, () => { if (!tgt.alive || !by.alive) return; if (k === 0) supShot(tgt, tgt.x, tgt.y, angTo(tgt, by), { speed: 600, r: 8, dmg: skillDmg(tgt, P) * 0.3, col: '#f50057', life: 1.2, homing: 4, target: by }); else if (k === 1) { _dealDamage26(tgt, by, skillDmg(tgt, P) * 0.15, { kind: 'skill', noCrit: true }); if (!by.boss && twReady(by, 'pzap', 2)) by.st.stun = Math.max(by.st.stun, 0.3); if (!FX.off) FX.bolt(tgt.x, tgt.y, by.x, by.y, '#f50057', 2, 0.2); } else supWave(tgt, tgt.x, tgt.y, 140, skillDmg(tgt, P) * 0.15, '#f50057', { effect: 'slow', force: 260 }); }); }
  if (S.smokeIn && tgt.def && tgt.def.id === 'godofguns' && o.kind !== 'dot' && rand() < 0.3) { if (!FX.off) FX.text(tgt.x, tgt.y - tgt.r - 20, 'MISS', '#9e9e9e', 13, { life: 0.4 }); return 0; }
  return amt;
});
SUP.collideHooks.push((a, b) => {
  const S = a.sx; if (!S) return;
  if (S.ravT > 0 && twReady(a, 'rav', 0.6)) supWave(a, a.x, a.y, 130, skillDmg(a, S.ravP || 55) * 0.25, '#d50000', { force: 420 });
  if (S.unyT > 0 && twReady(b, 'uny' + a.sid, 0.8)) { _dealDamage26(a, b, skillDmg(a, S.unyP || 45) * 0.3, { kind: 'skill', tag: 'collision', noCrit: true }); knock(b, a.x, a.y, 500); }
});
MOD26.push((f, S, m) => {
  if (S.wingsT > 0) m.spd *= 1.3;
  if (S.upg) { m.atk *= 1 + 0.05 * S.upg; m.spd *= 1 + 0.05 * S.upg; }
  if (S.endStacks) m.atk *= 1 + 0.04 * S.endStacks;
  if (S.bannerIn) { if (S.bannerIn === 2) m.atk *= 1.2; else m.taken *= 1.1; S.bannerIn = 0; }
  if (S.songCd) { m.cd *= 1.3; S.songCd = 0; }
  if (S.sacredAlly) { m.def *= 1.2; S.sacredAlly = 0; }
  if (S.veilAlly) { m.atk *= 1.1; S.veilAlly = 0; }
});
SUP.steerHooks.push(f => { const S = f.sx; if (!S || f.isClone) return; if (S.fearT > 0 && S.fearBy && S.fearBy.alive) { const d = len(f.x - S.fearBy.x, f.y - S.fearBy.y) || 1; f.steerX = (f.x - S.fearBy.x) / d; f.steerY = (f.y - S.fearBy.y) / d; f.steerPow = Math.max(f.steerPow, 600); } });
{ const pt = AIController.prototype.pickTarget; AIController.prototype.pickTarget = function () {
  const f = this.f, S = f.sx;
  if (S && S.veilIn) return null;
  if (S && S.discordT > 0) { const o = BATTLE.fighters.filter(e => e.alive && e !== f && e.team !== f.team && !(e.st.outside > 0)); return o[0] || null; }
  if (S && S.duelT > 0 && S.duelWith && S.duelWith.alive && !f.boss) return S.duelWith;
  return pt.call(this); }; }
{ const aa = aimAngle; aimAngle = function (f, tgt, speed) { if (f && f.sx && f.sx.predT26 > 0) { const d = len(tgt.x - f.x, tgt.y - f.y), p = predictPos(f, tgt, d / speed); return datan2(p.y - f.y, p.x - f.x); } return aa(f, tgt, speed); }; }
SUP.worldHooks.push((B, h) => {
  for (const f of B.fighters) {
    if (!f.alive) continue; const S = f.sx; if (!S) continue;
    if (S.songT > 0) for (const e of B.fighters) { if (!e.alive || len(e.x - f.x, e.y - f.y) > 400) continue; if (e.team === f.team) healFighter(e, e.maxHp * 0.015 * h, true); else sx(e).songCd = 1; }
    if (S.btT > 0) for (const p of B.projs) if (p.team !== f.team && !p.slow26 && dist2(p.x, p.y, f.x, f.y) < 400 * 400) { p.slow26 = true; p.vx *= 0.25; p.vy *= 0.25; p.speed *= 0.25; p.life += 2; }
    if (S.predT26 > 0) for (const p of B.projs) if (p.team !== f.team && !p.slow27 && dist2(p.x, p.y, f.x, f.y) < 220 * 220) { p.slow27 = true; p.vx *= 0.6; p.vy *= 0.6; p.speed *= 0.6; }
    S.veilIn = 0; S.smokeIn = 0; S.noHealIn = 0;
  }
  for (const z of B.zones) {
    if (z.sacred26) for (const e of B.fighters) { if (!e.alive || len(e.x - z.x, e.y - z.y) > z.r + e.r) continue; if (e.team === z.team) sx(e).sacredAlly = 1; else sx(e).noHealIn = 0.1; }
    if (z.veil26) for (const e of B.fighters) { if (!e.alive || len(e.x - z.x, e.y - z.y) > z.r) continue; if (e.team === z.team) sx(e).veilAlly = 1; else sx(e).veilIn = 1; }
    if (z.smoke26) { for (const p of B.projs) if (p.team !== z.team && dist2(p.x, p.y, z.x, z.y) < z.r * z.r) { p.homing = 0; p.target = null; } const o = z.owner; if (o.alive && len(o.x - z.x, o.y - z.y) < z.r) sx(o).smokeIn = 1; }
    if (z.zero26 && z.life <= h * 1.5 && !z.zEnd) { z.zEnd = true; for (const e of foesNear(z.owner, z.x, z.y, z.r + 20)) knock(e, z.x, z.y, z.repel26 || 800); }
  }
  for (const L of B.lasers) if (L.follow26 && L.sweep && L.follow26.alive) { L.sweep.cx = L.follow26.x; L.sweep.cy = L.follow26.y; }
  for (const p of B.projs) if (!p.pres26 && p.owner && hasPas(p.owner.credit || p.owner, 'k_presence')) { p.pres26 = true; p.reflected = true; p.ult = true; }
});
/* =====================================================================
   2.6.0 SKILL EVOLUTION — every ball's signature ability (its first one) can evolve.
   Paths differ: Common–Rare balls have 1 stage (Awakened), Epic–Legendary 2 (Awakened → Ascended),
   Mythical and above 3 (Awakened → Ascended → Ultimate Variant). Each stage adds a NEW mechanic (never just numbers:
   power rises only +4% per stage), its own colour and a bigger cast animation. Requirements are checked on the server.
   ===================================================================== */
const EVO_STAGE_NAMES = ['Awakened', 'Ascended', 'Ultimate Variant'];
const EVO_LOOK = ['#e040fb', '#ffd740', '#ffffff'];
const EVO_POOL = {
  proj: ['split', 'ricochet', 'pierce', 'ember', 'grow', 'fork', 'sticky', 'chain', 'mark', 'drain', 'sunder', 'echoHit', 'execute', 'leech', 'bleed', 'scatter', 'lateHome', 'gravOrb'],
  beam: ['prism', 'afterburn', 'refract', 'twin', 'widen', 'linger', 'sweep', 'chain', 'mark', 'sunder', 'execute', 'echoHit'],
  wave: ['echoWave', 'implode', 'vacuum', 'aftershock', 'clearShots', 'edgeStun', 'slowRing', 'spikeRing', 'healWave', 'sunder', 'stagger'],
  blast: ['doubleBlast', 'vacuumBlast', 'shrapnel', 'craterPost', 'blastShield', 'ringBlast', 'quakeLines', 'sunder', 'execute', 'echoHit'],
  dash: ['dashTrail', 'afterimage', 'rebound', 'dashShock', 'dashSpikes', 'dashQuake', 'dashTwice', 'dashArmor', 'chain', 'bleed', 'mark'],
  shield: ['thorns', 'shieldBurst', 'frostArmor', 'eatShots', 'cleanseImm', 'absorbHeal', 'swiftGuard', 'pulseGuard', 'mirrorGuard', 'growGuard', 'healGuard', 'lanceGuard'],
  heal: ['regen', 'allyHeal', 'overShield', 'healPulse', 'healHaste', 'healCharge', 'bloom', 'healRefresh', 'purify', 'lifeLink'],
  zone: ['mines', 'root', 'spread', 'drift', 'detonate', 'lure', 'shardZone', 'repelEnd'],
  strike: ['echoStrike', 'crater', 'fork2', 'widenStrike', 'staticField', 'chain', 'mark'],
  orb: ['expandOrbit', 'launchOrbit', 'blockOrbit', 'tightOrbit', 'healOrbit', 'chain'],
  hit: ['chain', 'mark', 'drain', 'sunder', 'echoHit', 'execute', 'leech', 'bleed', 'scatter', 'ultFeed', 'refund', 'breakShield', 'stagger'],
};
const POOL_OF = { projectile: 'proj', multishot: 'proj', homing: 'proj', beam: 'beam', shockwave: 'wave', explosion: 'blast', dash: 'dash', teleport: 'dash', shield: 'shield', heal: 'heal', trap: 'zone', gravity: 'zone', lightning: 'strike', meteor: 'strike', orbitals: 'orb' };
function evoPathLen(b) { const i = RARITIES.indexOf(b.rarity); return i <= 2 ? 1 : i <= 4 ? 2 : 3; }
function buildEvo(b) {
  const s = b.skills && b.skills[0]; if (!s || !s.uid || EVO26[s.uid] && EVO26[s.uid].ball === b.id) return;
  const pool = EVO_POOL[POOL_OF[s.type] || 'hit'], used = new Set([SIG[s.uid] && SIG[s.uid].t]), out = [], n = evoPathLen(b);
  for (let k = 0; k < n; k++) {
    let h = hashStr(s.uid + ':' + k), t = null; for (let j = 0; j < pool.length; j++) { const c = pool[(h + j) % pool.length]; if (!used.has(c) && TW[c]) { t = c; break; } }
    if (!t) break; used.add(t);
    out.push({ stage: k + 1, n: k === 2 ? s.name + ' • Ultimate Variant' : EVO_STAGE_NAMES[k] + ' ' + s.name, label: EVO_STAGE_NAMES[k], t, a: {}, look: EVO_LOOK[k], get d() { return TW[t].desc({}); } });
  }
  out.ball = b.id; EVO26[s.uid] = out;
}
/** evolution requirements of one stage for this ball (level, mastery rank, coins) */
function evoReq(b, stage) { const cfg = skillsCfg(), R = (cfg.evoReq && Array.isArray(cfg.evoReq) ? cfg.evoReq : null) || (maxLvlFor(b) > MAX_LVL ? EVO_REQ_HIGH : EVO_REQ); return R[stage - 1] || null; }
const _decorate26 = decorateBall;
decorateBall = function (b, cfg) { _decorate26(b, cfg); if (!b.sk26 || b.adminOnly || b.custom || b.fusion || b.summonOnly) return; buildEvo(b); const s = b.skills[0], ov = (cfg.overrides || {})[s.uid]; if (s && EVO26[s.uid] && !(ov && ov.evoOff)) s.evoPath = EVO26[s.uid].map(e => e.n); };
/* mastery titles (exclusive: earned only through skill mastery, never bought) */
COSMETICS.push(
  { id: 'title_skilled', slot: 'title', name: 'SKILLED TECHNICIAN', color: '#69f0ae', exclusive: 'mastery', req: { rank: 1, count: 5 } },
  { id: 'title_expert', slot: 'title', name: 'SKILL EXPERT', color: '#40c4ff', exclusive: 'mastery', req: { rank: 2, count: 3 } },
  { id: 'title_master', slot: 'title', name: 'SKILL MASTER', color: '#e040fb', exclusive: 'mastery', req: { rank: 3, count: 1 } },
  { id: 'title_grandmaster', slot: 'title', name: 'GRANDMASTER', color: '#ffd740', exclusive: 'mastery', req: { rank: 4, count: 1 } });
const MASTERY_TITLES = COSMETICS.filter(c => c.exclusive === 'mastery');
/** which mastery titles a set of mastery XP values earns */
function masteryTitles(xpMap) { const ranks = Object.values(xpMap || {}).map(masteryRank); return MASTERY_TITLES.filter(c => ranks.filter(r => r >= c.req.rank).length >= c.req.count).map(c => c.id); }
/* =====================================================================
   2.6.0 SKILL COMBINATIONS — every one designed by hand (never universal):
   • follow-ups inside one ball's kit • counters (a defence answering a specific attack)
   • arena-object interactions • team reactions between two different balls
   ===================================================================== */
const COMBOS = [];                 // the list shown in the skill details and in training
const COMBO_BY = {};               // attacker skill uid → follow-up combos it can trigger
const PRIME26 = {};                // skill uid → marks the target so another skill can follow up
function CB(c) { COMBOS.push(c); if (c.kind === 'follow') for (const u of [].concat(c.on)) (COMBO_BY[u] || (COMBO_BY[u] = [])).push(c); return c; }
function comboHit(cr, tgt, sk, got, o) {
  for (const c of COMBO_BY[sk] || []) { if (!tgt.alive && !c.onKill) continue; if (!c.when(cr, tgt, got, o) || !twReady(tgt, 'cb' + c.id, c.cd || 3)) continue; c.fire(cr, tgt, got, o); comboFx(cr, tgt, c); }
}
function comboFx(cr, tgt, c) { cr.combos26 = (cr.combos26 || 0) + 1; (cr.comboLog || (cr.comboLog = {}))[c.id] = (cr.comboLog[c.id] || 0) + 1;
  if (FX.off) return; FX.text(tgt.x, tgt.y - tgt.r - 46, '✦ COMBO: ' + c.name.toUpperCase(), c.col || '#ffd740', 15, { life: 1.2, pop: 1.6, stroke: '#1a0f00' }); FX.ring(tgt.x, tgt.y, c.col || '#ffd740', tgt.r * 3, 0.45, 6, tgt.r); FX.burst(tgt.x, tgt.y, c.col || '#ffd740', 18, 320, 5, 0.5, 'shard'); }
const SD5 = (f, k) => skillDmg(f, 55) * k;

/* ---------------- follow-ups inside one ball's kit ---------------- */
CB({ id: 'wildfire', kind: 'follow', name: 'Wildfire', col: '#ff9100', balls: ['fire'], skills: ['fire.2', 'fire.0'], on: 'fire.2', desc: 'Inferno Ring hitting a burning enemy spreads the fire to every enemy near it',
  when: (f, t) => t.st.burn > 0, fire: (f, t) => { for (const e of foesNear(f, t.x, t.y, 200)) { applyEffect(f, e, 'burn', 60); if (e !== t && !FX.off) FX.bolt(t.x, t.y, e.x, e.y, '#ff9100', 2, 0.3); } _dealDamage26(f, t, SD5(f, 0.3), { kind: 'skill', noCrit: true }); } });
CB({ id: 'shatterstorm', kind: 'follow', name: 'Shatterstorm', col: '#bdf6ff', balls: ['ice'], skills: ['ice.0', 'ice.2'], on: 'ice.0', desc: 'Ice Shards hitting a frozen enemy shatter it into a ring of flying ice',
  when: (f, t) => t.st.freeze > 0, fire: (f, t) => { t.st.freeze = 0; for (let i = 0; i < 6; i++) supShot(f, t.x, t.y, i / 6 * TAU, { speed: 420, r: 6, dmg: SD5(f, 0.12), col: '#bdf6ff', life: 0.8, style: 'shard', effect: 'slow' }); } });
PRIME26['thunder.2'] = (f, t) => { sx(t).sparkT = 2.5; };
CB({ id: 'conductor', kind: 'follow', name: 'Conductor', col: '#fff27a', balls: ['thunder'], skills: ['thunder.0', 'thunder.2'], on: 'thunder.0', desc: 'Lightning Strike on an enemy still charged by Chain Spark arcs into two more enemies',
  when: (f, t) => t.sx && t.sx.sparkT > 0, fire: (f, t) => { t.sx.sparkT = 0; for (const e of supEnemies(f).filter(e => e !== t).slice(0, 2)) { _dealDamage26(f, e, SD5(f, 0.35), { kind: 'skill', effect: 'stun', power: 50 }); if (!FX.off) FX.bolt(t.x, t.y, e.x, e.y, '#fff27a', 3, 0.35); } } });
CB({ id: 'drowning', kind: 'follow', name: 'Drowning Pull', col: '#1e90ff', balls: ['water'], skills: ['water.2', 'water.0'], on: 'water.2', desc: 'Tidal Wave catching an already slowed enemy drags it back to the Water Ball',
  when: (f, t) => t.st.slow > 0, fire: (f, t) => { knock(t, f.x, f.y, -700); t.st.slow = Math.max(t.st.slow, 1.5); } });
CB({ id: 'rockslide', kind: 'follow', name: 'Rockslide', col: '#c08a4a', balls: ['earth'], skills: ['earth.2', 'earth.0'], on: 'earth.2', desc: 'Earthquake shaking a stunned enemy brings three rocks down on it',
  when: (f, t) => t.st.stun > 0, fire: (f, t) => { for (let i = 0; i < 3; i++) supStrike(f, t.x + rand(-40, 40), t.y + rand(-40, 40), 0.25 + i * 0.12, 50, SD5(f, 0.2), '#c08a4a', { kind: 'meteor' }); } });
CB({ id: 'pandemicburst', kind: 'follow', name: 'Pandemic Burst', col: '#9dff00', balls: ['poison'], skills: ['poison.2', 'poison.0'], on: 'poison.2', desc: 'Plague Burst on an enemy carrying three poison stacks makes them all burst at once',
  when: (f, t) => t.poisonStacks >= 3, fire: (f, t) => { t.poisonStacks = 0; t.st.poison = 0; _dealDamage26(f, t, SD5(f, 0.6), { kind: 'skill', noCrit: true }); } });
CB({ id: 'bloodfrenzy', kind: 'follow', name: 'Blood Frenzy', col: '#ff0033', balls: ['vampire'], skills: ['vampire.2', 'vampire.0'], on: 'vampire.2', desc: 'Crimson Dash into a bleeding enemy throws the Vampire into a frenzy that heals 6% HP', cd: 6,
  when: (f, t) => t.sx && t.sx.bleedT > 0, fire: f => healFighter(f, f.maxHp * 0.06) });
CB({ id: 'overloadgrid', kind: 'follow', name: 'Overload Grid', col: '#ff1050', balls: ['laser'], skills: ['laser.0', 'laser.k_lattice'], on: 'laser.0', desc: 'Laser Beam fired within 3 s of a Targeting Lattice overloads it: +40% damage and a short silence',
  when: f => f.sx && f.sx.latticeT > 0, fire: (f, t, got) => { _dealDamage26(f, t, got * 0.4, { kind: 'skill', noCrit: true }); silenceFoe(f, t, 0.6, 'OVERLOADED'); } });
CB({ id: 'finalsentence', kind: 'follow', name: 'Final Sentence', col: '#ffcc00', balls: ['judgment'], skills: ['judgment.1', 'judgment.k_scales'], on: 'judgment.1', desc: 'Sentence landing while the Scales of Balance are weighing stuns and marks the enemy',
  when: f => f.sx && f.sx.scaleT > 0, fire: (f, t) => { if (!t.boss) t.st.stun = Math.max(t.st.stun, 0.7); const s = sx(t); s.markT = 2; s.markD = SD5(f, 0.35); s.markBy = f; } });
CB({ id: 'criticalmass', kind: 'follow', name: 'Critical Mass', col: '#d4ff00', balls: ['nuclear'], skills: ['nuclear.2', 'nuclear.k_decay'], on: 'nuclear.2', desc: 'Meltdown on an irradiated enemy sets off all of its remaining decay at once (×4)',
  when: (f, t) => t.sx && t.sx.decay, fire: (f, t) => { const D = t.sx.decay; _dealDamage26(f, t, D.base * 4, { kind: 'skill', noCrit: true, effect: 'poison', power: 50 }); t.sx.decay = null; } });
PRIME26['dragon.k_winggust'] = (f, t) => { sx(t).gustT = 2.5; };
CB({ id: 'firestormgust', kind: 'follow', name: 'Firestorm Gust', col: '#ff5722', balls: ['dragon'], skills: ['dragon.0', 'dragon.k_winggust'], on: 'dragon.0', desc: 'Dragon Breath on an enemy still reeling from Wing Gust fans the flames into a firestorm',
  when: (f, t) => t.sx && t.sx.gustT > 0, fire: (f, t) => { applyEffect(f, t, 'burn', 80); twMiniZone(f, t.x, t.y, 110, 3, SD5(f, 0.06), '#ff5722', 'burn'); } });
CB({ id: 'ashendive', kind: 'follow', name: 'Ashen Dive', col: '#ff8a65', balls: ['phoenix'], skills: ['phoenix.2', 'phoenix.k_ash'], on: 'phoenix.2', desc: 'Blaze Dive through the phoenix’s own Ash Cloud blinds and scorches the enemy',
  when: (f, t) => BATTLE.zones.some(z => z.ash26 && z.owner === f && len(t.x - z.x, t.y - z.y) < z.r), fire: (f, t) => { if (!t.boss) sx(t).blindT = 0.8; applyEffect(f, t, 'burn', 80); } });
CB({ id: 'frozenmoment', kind: 'follow', name: 'Frozen Moment', col: '#ffd740', balls: ['time'], skills: ['time.2', 'time.k_stopwatch'], on: 'time.2', desc: 'Chrono Bolt on an enemy under the Stopwatch is recorded twice',
  when: (f, t) => t.sx && t.sx.watchT > 0, fire: (f, t, got) => { t.sx.watchD = (t.sx.watchD || 0) + got; } });
CB({ id: 'damnation', kind: 'follow', name: 'Damnation', col: '#ff3d00', balls: ['demon'], skills: ['demon.0', 'demon.k_hellchains'], on: 'demon.0', desc: 'Hellfire on an enemy held by Hellgate Chains burns 50% hotter',
  when: (f, t) => t.sx && t.sx.rootT > 0, fire: (f, t, got) => { _dealDamage26(f, t, got * 0.5, { kind: 'skill', noCrit: true, effect: 'burn', power: 70 }); } });
CB({ id: 'maelstrom', kind: 'follow', name: 'Petal Maelstrom', col: '#ff80ab', balls: ['sakura'], skills: ['sakura.0', 'sakura.k_vortex'], on: 'sakura.0', desc: 'Petal Storm into an enemy trapped in a Blossom Vortex whips up a maelstrom of petals',
  when: (f, t) => t.sx && t.sx.vortT > 0, fire: (f, t) => { _dealDamage26(f, t, SD5(f, 0.4), { kind: 'skill', noCrit: true }); for (let i = 0; i < 5; i++) supShot(f, t.x, t.y, i / 5 * TAU, { speed: 300, r: 6, dmg: SD5(f, 0.08), col: '#ff80ab', life: 0.7, style: 'k_petal' }); } });
CB({ id: 'deepfreeze', kind: 'follow', name: 'Deep Freeze', col: '#e1f5fe', balls: ['frostcrown'], skills: ['frostcrown.0', 'frostcrown.k_permafrost'], on: 'frostcrown.0', desc: 'Glacier Spike on an enemy sliding on Permafrost freezes it solid',
  when: (f, t) => t.sx && t.sx.onIce > 0, fire: (f, t) => applyEffect(f, t, 'freeze', 90) });
CB({ id: 'purgingfire', kind: 'follow', name: 'Purging Fire', col: '#fff176', balls: ['seraphim'], skills: ['seraphim.0', 'seraphim.k_brand'], on: 'seraphim.0', desc: 'Seraph Flame on a branded enemy erupts in holy fire and keeps the brand burning longer',
  when: (f, t) => t.sx && t.sx.brandT > 0, fire: (f, t) => { t.sx.brandT += 1; supBlast(f, t.x, t.y, 90, SD5(f, 0.4), { tag: 'explosion' }); } });
CB({ id: 'annihilationrun', kind: 'follow', name: 'Annihilation Run', col: '#ff1744', balls: ['destroyer'], skills: ['destroyer.2', 'destroyer.k_doom'], on: 'destroyer.2', desc: 'Doom Dash into an enemy on the Doom Clock makes the clock strike at once (×1.5)',
  when: (f, t) => t.sx && t.sx.doomT > 0, fire: (f, t) => { const d = t.sx.doomD || 0; t.sx.doomT = 0.01; _dealDamage26(f, t, Math.max(SD5(f, 0.3), d * 0.45), { kind: 'skill', noCrit: true, noDef: true }); } });
CB({ id: 'zerocut', kind: 'follow', name: 'Absolute Zero Cut', col: '#ffffff', balls: ['absolute'], skills: ['absolute.k_edge', 'absolute.k_zeropoint'], on: 'absolute.k_edge', desc: 'Absolute Edge through an enemy frozen in a Zero Point cuts 50% deeper',
  when: (f, t) => BATTLE.zones.some(z => z.zero26 && z.owner === f && len(t.x - z.x, t.y - z.y) < z.r), fire: (f, t, got) => _dealDamage26(f, t, got * 0.5, { kind: 'skill', noCrit: true }) });
CB({ id: 'matrix', kind: 'follow', name: 'Matrix', col: '#ffe57f', balls: ['godofguns'], skills: ['godofguns.k_revolver', 'godofguns.k_bullettime'], on: 'godofguns.k_revolver', desc: 'Ricochet Revolver rounds that land during Bullet Time hit 50% harder',
  when: f => f.sx && f.sx.btT > 0, cd: 0.3, fire: (f, t, got) => _dealDamage26(f, t, got * 0.5, { kind: 'skill', noCrit: true }) });
CB({ id: 'horizonsnap', kind: 'follow', name: 'Horizon Snap', col: '#7c4dff', balls: ['blackhole'], skills: ['blackhole.1', 'blackhole.k_tidallock'], on: 'blackhole.1', desc: 'Spaghettify on an enemy caught in Tidal Lock snaps it in: stun and extra damage',
  when: (f, t) => t.sx && t.sx.lockT > 0, fire: (f, t) => { if (!t.boss) t.st.stun = Math.max(t.st.stun, 0.5); _dealDamage26(f, t, SD5(f, 0.4), { kind: 'skill', noCrit: true }); } });
CB({ id: 'polarchain', kind: 'follow', name: 'Polar Chain', col: '#448aff', balls: ['magnetar'], skills: ['magnetar.2', 'magnetar.k_magnetize'], on: 'magnetar.2', desc: 'Polar Bolts on a magnetised enemy jump to every enemy stuck to it',
  when: (f, t) => t.sx && t.sx.magT > 0, cd: 1, fire: (f, t) => { for (const e of foesNear(f, t.x, t.y, 260)) if (e !== t) { _dealDamage26(f, e, SD5(f, 0.25), { kind: 'skill', noCrit: true }); if (!FX.off) FX.bolt(t.x, t.y, e.x, e.y, '#448aff', 2, 0.3); } } });
CB({ id: 'auroralock', kind: 'follow', name: 'Aurora Lock', col: '#64ffda', balls: ['aurora'], skills: ['aurora.0', 'aurora.1'], on: 'aurora.0', desc: 'Northern Lights on a chilled enemy locks it in ice',
  when: (f, t) => t.sx && t.sx.chillT > 0, fire: (f, t) => applyEffect(f, t, 'freeze', 70) });
CB({ id: 'redtide', kind: 'follow', name: 'Red Tide', col: '#d50000', balls: ['bloodmoon'], skills: ['bloodmoon.k_crimsontide', 'bloodmoon.0'], on: 'bloodmoon.k_crimsontide', desc: 'Crimson Tide on a bleeding enemy reopens the wound and drains twice as much',
  when: (f, t) => t.sx && t.sx.bleedT > 0, fire: (f, t, got) => { t.sx.bleedT = 3; healFighter(f, got * 0.5, true); } });
CB({ id: 'packetloss', kind: 'follow', name: 'Packet Loss', col: '#00e676', balls: ['glitch'], skills: ['glitch.0', 'glitch.k_lag'], on: 'glitch.0', desc: 'Pixel Shot on a lagging enemy drops its abilities offline for a moment',
  when: (f, t) => t.sx && t.sx.lagT > 0, fire: (f, t) => silenceFoe(f, t, 0.8, 'PACKET LOSS') });
CAST26.push((f, sk) => { if (sk.type === 'k_lattice') sx(f).latticeT = 3; });
const _comboHit0 = comboHit;
comboHit = function (cr, tgt, sk, got, o) { const pr = PRIME26[sk]; if (pr && tgt.alive) pr(cr, tgt); _comboHit0(cr, tgt, sk, got, o); };
for (const k in PRIME26) if (!COMBO_BY[k]) COMBO_BY[k] = [];

/* ---------------- counters: a defence answering one specific kind of attack ---------------- */
const COUNTER26 = [
  { id: 'mirrorbeam', name: 'Mirror Beam', col: '#e0f7fa', balls: ['mirror'], skills: ['mirror.0'], desc: 'A beam that hits the Mirror Ball while Mirror Shield is up is fired straight back at its caster',
    when: (s, t, a, o) => t.st.reflect > 0 && t.def.id === 'mirror' && (o.tag === 'beam' || o.tag === 'laser'), fire: (s, t, a) => addLaser(t, [t.x, t.y, s.x, s.y], { charge: 0.1, dur: 0.18, w: 14, dmg: a * 0.8, col: '#e0f7fa' }) },
  { id: 'refraction', name: 'Prismatic Refraction', col: '#ff80ab', balls: ['prism', 'crystal'], skills: ['prism.2', 'crystal.1'], desc: 'A beam striking a raised prism splits into two rays aimed back at the enemy',
    when: (s, t, a, o) => t.st.reflect > 0 && (t.def.id === 'prism' || t.def.id === 'crystal') && o.tag === 'beam', fire: (s, t, a) => { for (const k of [-0.25, 0.25]) { const an = datan2(s.y - t.y, s.x - t.x) + k, e = rayToWall(t.x, t.y, an); addLaser(t, [t.x, t.y, e.x, e.y], { charge: 0.1, dur: 0.18, w: 10, dmg: a * 0.45, col: '#ff80ab' }); } } },
  { id: 'coldsnap', name: 'Cold Snap', col: '#bdf6ff', balls: ['ice'], skills: ['ice.1'], desc: 'Dashing into the Ice Ball while Frost Armor is up freezes the attacker for longer and recharges the armour',
    when: (s, t, a, o) => o.kind === 'collision' && s.st.dash > 0 && t.sx && t.sx.frostT > 0, fire: (s, t) => { applyEffect(t, s, 'freeze', 120); const k = t.skills.find(x => x.uid === 'ice.1'); if (k) k.cdLeft = Math.max(0, k.cdLeft - 3); } },
  { id: 'bedrock', name: 'Bedrock Ricochet', col: '#a0784a', balls: ['earth'], skills: ['earth.1'], desc: 'Projectiles that hit the Earth Ball while Stone Skin is up ricochet 30% of their damage back',
    when: (s, t, a, o) => o.tag === 'projectile' && t.def.id === 'earth' && t.st.shield > 0, fire: (s, t, a) => _dealDamage26(t, s, a * 0.3, { kind: 'skill', noCrit: true }) },
  { id: 'packetdrop', name: 'Packet Drop', col: '#69f0ae', balls: ['glitch'], skills: ['glitch.1'], desc: 'Lasers aimed at the Glitch Ball while its Firewall is up are dropped like bad packets',
    when: (s, t, a, o) => (o.tag === 'laser' || o.tag === 'beam') && t.sx && t.sx.eatT > 0 && t.def.id === 'glitch', fire: () => {}, negate: true },
  { id: 'shieldbash', name: 'Shield Bash', col: '#ffab40', balls: ['godofwar'], skills: ['godofwar.k_shieldwall'], desc: 'Ramming the God of War’s Shield Wall stuns the attacker',
    when: (s, t, a, o) => o.kind === 'collision' && t.sx && t.sx.wallT > 0 && !s.boss, fire: s => { s.st.stun = Math.max(s.st.stun, 0.6); } },
  { id: 'riposte', name: 'Magnetic Riposte', col: '#82b1ff', balls: ['magnetar'], skills: ['magnetar.k_deflect'], desc: 'A shot that still gets through the Magnetic Deflector shocks the shooter',
    when: (s, t, a, o) => o.tag === 'projectile' && t.sx && t.sx.deflT > 0, fire: (s, t) => { _dealDamage26(t, s, skillDmg(t, 50) * 0.3, { kind: 'skill', noCrit: true, effect: 'stun', power: 50 }); if (!FX.off) FX.bolt(t.x, t.y, s.x, s.y, '#82b1ff', 3, 0.3); } },
];
for (const c of COUNTER26) COMBOS.push({ ...c, kind: 'counter' });
SUP.dmgHooks.push((src, tgt, amt, o) => {
  if (!src || !src.alive || src.team === tgt.team) return amt;
  for (const c of COUNTER26) if (c.when(src, tgt, amt, o) && twReady(tgt, 'ct' + c.id, 1.5)) { const s = src.credit || src; after(0, () => { if (s.alive && tgt.alive) c.fire(s, tgt, amt); }); comboFx(tgt, tgt, c); if (c.negate) return 0; }
  return amt;
});

/* ---------------- arena-object interactions ---------------- */
const ARENA26 = [
  { id: 'steamvent', name: 'Steam Vent', col: '#e0f7fa', balls: ['water'], skills: ['water.2'], desc: 'Tidal Wave rolling over burning ground puts it out and leaves slowing steam' },
  { id: 'faultrupture', name: 'Fault Rupture', col: '#c08a4a', balls: ['earth'], skills: ['earth.2'], desc: 'Earthquake shatters enemy traps, fields and walls close to it' },
  { id: 'firetornado', name: 'Fire Tornado', col: '#ff6d00', balls: ['wind'], skills: ['wind.2'], desc: 'A Cyclone that passes over burning ground catches fire and becomes a fire tornado' },
  { id: 'electricpool', name: 'Electrified Pool', col: '#fff27a', balls: ['thunder'], skills: ['thunder.0'], desc: 'Lightning Strike landing in a puddle or pool (any slowing or toxic ground) electrifies it' },
  { id: 'toxicblaze', name: 'Toxic Ignition', col: '#c6ff00', balls: ['fire', 'phoenix', 'solarflare', 'dragon', 'demon'], skills: [], desc: 'A burning shot flying through a toxic pool of an ally ignites it in an explosion' },
];
for (const c of ARENA26) COMBOS.push({ ...c, kind: 'arena' });
const arenaFx = (f, x, y, c) => { if (FX.off) return; FX.text(x, y - 40, '✦ ' + c.name.toUpperCase(), c.col, 15, { life: 1.2, pop: 1.5 }); FX.ring(x, y, c.col, 90, 0.4, 6, 10); };
CAST26.push((f, sk, uid) => {
  if (uid === 'water.2') for (const z of BATTLE.zones) if (z.effect === 'burn' && len(z.x - f.x, z.y - f.y) < 320) { z.effect = 'slow'; z.col = '#e0f7fa'; z.style = 'web'; z.dmg = 0; arenaFx(f, z.x, z.y, ARENA26[0]); }
  if (uid === 'earth.2') { for (const z of BATTLE.zones) if (z.team !== f.team && len(z.x - f.x, z.y - f.y) < 300) { z.life = 0.01; arenaFx(f, z.x, z.y, ARENA26[1]); } if (BATTLE.walls26) for (const w of BATTLE.walls26) if (w.team !== f.team && segDist(f.x, f.y, w.x1, w.y1, w.x2, w.y2) < 300) w.life = 0.01; }
});
SUP.worldHooks.push((B, h) => {
  for (const z of B.zones) {
    if (z.kind === 'gravity' && z.sk === 'wind.2' && !z.fire26 && B.zones.some(q => q.effect === 'burn' && len(q.x - z.x, q.y - z.y) < z.r * 0.6)) { z.fire26 = true; z.effect = 'burn'; z.dmg *= 1.6; z.col = '#ff6d00'; arenaFx(z.owner, z.x, z.y, ARENA26[2]); }
    if ((z.effect === 'poison') && !z.ign26) for (const p of B.projs) if (p.effect === 'burn' && p.team === z.team && dist2(p.x, p.y, z.x, z.y) < z.r * z.r) { z.ign26 = true; supBlast(p.owner, z.x, z.y, z.r + 60, skillDmg(p.owner, 55) * 0.45, { tag: 'explosion', force: 450 }); arenaFx(p.owner, z.x, z.y, ARENA26[4]); z.life = 0.05; break; }
  }
});
SUP.worldHooks.push((B) => { for (const s of B.strikes) if (s.sk === 'thunder.0' && s.t <= 0.02 && !s.pool26) { s.pool26 = true; for (const z of B.zones) if ((z.effect === 'slow' || z.effect === 'poison') && len(z.x - s.x, z.y - s.y) < z.r + s.r && !z.zap26) { z.zap26 = 0.6; z.team = s.team; z.owner = s.owner; arenaFx(s.owner, z.x, z.y, ARENA26[3]); } } });

/* ---------------- team reactions between two different balls ---------------- */
const FAM26 = { fire: ['fire', 'phoenix', 'solarflare', 'dragon', 'demon', 'celestialdragon'], ice: ['ice', 'frostcrown', 'aurora'], water: ['water'], thunder: ['thunder', 'magnetar', 'thundergod'],
  poison: ['poison', 'toxicreactor', 'zombie', 'nuclear'], light: ['light', 'angel', 'seraphim', 'divine', 'judgment'], dark: ['dark', 'shadow', 'eclipse', 'bloodmoon', 'vampire'], earth: ['earth', 'ancientgod'], gravity: ['gravity', 'blackhole', 'magnet', 'universe', 'galaxy'] };
const famOf = id => { for (const k in FAM26) if (FAM26[k].includes(id)) return k; return null; };
const REACT26 = [
  { id: 'steamburst', name: 'Steam Burst', col: '#eceff1', a: ['ice', 'freeze'], b: ['fire', 'burn'], desc: 'A Fire-family ball burning an enemy frozen by an Ice-family ally (or the reverse) makes it explode in scalding steam',
    fire: (s, t) => { t.st.freeze = 0; t.st.burn = 0; _dealDamage26(s, t, t.maxHp * 0.06, { kind: 'skill', noCrit: true, noDef: true }); if (!t.boss) sx(t).blindT = 0.5; } },
  { id: 'electrocute', name: 'Electrocute', col: '#fff27a', a: ['water', 'slow'], b: ['thunder', 'stun'], desc: 'A Thunder-family stun on an enemy soaked (slowed) by the Water Ball sends a shock through everyone around it',
    fire: (s, t) => { for (const e of foesNear(s, t.x, t.y, 220)) { _dealDamage26(s, e, skillDmg(s, 55) * 0.3, { kind: 'skill', noCrit: true }); if (!FX.off) FX.bolt(t.x, t.y, e.x, e.y, '#fff27a', 2, 0.3); } } },
  { id: 'toxicblaze', name: 'Toxic Blaze', col: '#c6ff00', a: ['poison', 'poison'], b: ['fire', 'burn'], desc: 'Fire touching poison from a Poison-family ally ignites it: an explosion around the enemy',
    fire: (s, t) => { supBlast(s, t.x, t.y, 140, skillDmg(s, 55) * 0.5, { tag: 'explosion', force: 400 }); t.st.poison = 0; t.poisonStacks = 0; } },
  { id: 'deepchill', name: 'Deep Chill', col: '#b3e5fc', a: ['water', 'slow'], b: ['ice', 'freeze'], desc: 'Freezing an enemy that the Water Ball soaked keeps it frozen 1.5 s longer',
    fire: (s, t) => { t.st.freeze += t.boss ? 0.5 : 1.5; } },
  { id: 'eclipseburst', name: 'Eclipse Burst', col: '#9d4dff', a: ['dark', 'weaken'], b: ['light', 'stun'], desc: 'Light stunning an enemy weakened by Darkness collapses both into an eclipse burst',
    fire: (s, t) => { supBlast(s, t.x, t.y, 160, skillDmg(s, 55) * 0.55, { tag: 'explosion', force: 500 }); } },
  { id: 'tectonic', name: 'Tectonic Collapse', col: '#a1887f', a: ['earth', 'stun'], b: ['gravity', 'stun'], desc: 'A Gravity-family stun on an enemy already stunned by an Earth-family ally crushes it into the ground',
    fire: (s, t) => { _dealDamage26(s, t, t.maxHp * 0.07, { kind: 'skill', noCrit: true, noDef: true }); t.vx = t.vy = 0; } },
  { id: 'frozenplague', name: 'Frozen Plague', col: '#a5d6a7', a: ['poison', 'poison'], b: ['ice', 'freeze'], desc: 'Freezing a poisoned enemy freezes the plague inside it: it spreads to every enemy nearby',
    fire: (s, t) => { for (const e of foesNear(s, t.x, t.y, 200)) if (e !== t) applyEffect(s, e, 'poison', 60); } },
];
for (const c of REACT26) COMBOS.push({ ...c, kind: 'reaction', balls: [...FAM26[c.a[0]], ...FAM26[c.b[0]]], skills: [] });
{ const ae = applyEffect; applyEffect = function (src, tgt, eff, power) {
  if (src && tgt && BATTLE && tgt.alive && eff && eff !== 'none') {
    const sf = famOf((src.baseDef || src.def || {}).id), T = tgt.stSrc26;
    if (sf && T) for (const c of REACT26) for (const [x, y] of [[c.a, c.b], [c.b, c.a]]) {
      if (sf !== y[0] || eff !== y[1]) continue; const prev = T[x[1]]; if (!prev || prev.fam !== x[0] || prev.id === (src.baseDef || src.def).id || prev.team !== src.team) continue;
      if (!(tgt.st[x[1]] > 0) && !(x[1] === 'poison' && tgt.poisonStacks > 0)) continue; if (!twReady(tgt, 'rx' + c.id, 3)) continue;
      after(0, () => { if (tgt.alive && src.alive) c.fire(src.credit || src, tgt); }); comboFx(src.credit || src, tgt, c);
    }
    if (sf) (tgt.stSrc26 || (tgt.stSrc26 = {}))[eff] = { fam: sf, id: (src.baseDef || src.def).id, team: src.team };
  }
  return ae(src, tgt, eff, power); }; }
/** the combinations a ball takes part in (skill details, training) */
const combosOf = id => COMBOS.filter(c => (c.balls || []).includes(id));
/* =====================================================================
   2.6.0 SCREENS — skill details, animated previews, the new-skill celebration, Skill Training mode, battle skill bar,
   mastery after battles. (Browser only: nothing here runs during a battle simulation.)
   ===================================================================== */
const sk26Save = () => (SAVE.skills26 || (SAVE.skills26 = { mastery: {}, evolutions: {} }));
const sk26Xp = uid => sk26Save().mastery[uid] | 0;
function sk26Stage(b, s, p) { if (!s || !s.evoPath) return 0; if (p && p.maxed) return s.evoPath.length; return Math.min(sk26Save().evolutions[s.uid] | 0, s.evoPath.length); }
/** fighter extras for battles built on this device (guest play, training, previews); online battles get them from the server */
function localExtras26(def, p) { const s0 = def.skills && def.skills[0], st = sk26Stage(def, s0, p); return { wins: p.wins | 0, maxed: !!p.maxed, sevo: st ? { [s0.uid]: st } : {}, mast: { ...sk26Save().mastery } }; }
if (!window.NBB_HEADLESS) { const ps = playerSpecFrom; playerSpecFrom = function (def, p) { if (p && p.sevo === undefined && def && def.skills) p = { ...p, ...localExtras26(def, p) }; return ps(def, p); }; }
const fmtCd = v => (Math.round(v * 10) / 10) + 's';
function unlockedFor26(b, s, p) {
  if (b.adminOnly || b.unlockAll || (p && p.maxed) || s.always) return true;
  if (s.v26) return skUnlocked(s, p.level || 1, p.wins | 0, true);
  return s.slot < 2 || (s.slot === 2 ? !!(p.tree && p.tree.slot3) : !!(p.tree && p.tree.slot4));
}
/* ---------- the skill list in Ball Details ---------- */
function skillPanel26(b, p, f, owned) {
  const wrap = h('div', { class: 'sk26' }), lv = p.level || 1, seen = seen26(b.id), fresh = [];
  const used = b.slotsUsed || (b.skills.length + 1), cap = b.slotCap || used;
  const pips = h('span', { class: 'sk26-pips' }); for (let i = 0; i < cap; i++) pips.append(h('i', { class: i < used ? 'on' : '' }));
  wrap.append(h('div', { class: 'sk26-head' }, h('h3', {}, 'Skills'), h('span', { class: 'muted small' }, b.adminOnly ? `${used} skills (admin ball)` : `${used} / ${cap} skill slots • ${b.rarity}${cap < used ? ' (kept from before 2.6.0)' : ''} • ultimate included`), pips));
  if (!b.adminOnly) wrap.append(h('p', { class: 'muted small', style: { margin: '2px 0 8px' } }, 'New skills unlock as this ball levels up. Locked skills can still be previewed.'));
  for (const s of b.skills) {
    if (s.disabled && !isAdmin()) continue;
    const un = owned && unlockedFor26(b, s, p); if (owned && un && s.v26 && !seen.includes(s.uid)) fresh.push(s.uid);
    wrap.append(skillCard26(b, s, p, f, owned, un, fresh.includes(s.uid)));
  }
  if (b.ult) wrap.append(skillCard26(b, { ...b.ult, isUlt: true }, p, f, owned, true, false));
  if (b.passiveInfo) wrap.append(h('div', { class: 'sk26-card pas' }, h('div', { class: 'sk26-ico', style: { color: '#b388ff' } }, '◆'), h('div', { class: 'sk26-main' }, h('div', { class: 'sk26-name' }, 'PASSIVE: ' + b.passiveInfo.name), h('div', { class: 'sk26-desc' }, b.passiveInfo.desc))));
  const cb = combosOf(b.id);
  if (cb.length) wrap.append(h('div', { class: 'sk26-combos' }, h('b', {}, '✦ Combinations'), ...cb.map(c => h('div', { class: 'sk26-combo' }, h('span', { class: 'sk26-chip', style: { borderColor: c.col || '#ffd740' } }, { follow: 'FOLLOW-UP', counter: 'COUNTER', arena: 'ARENA', reaction: 'TEAM REACTION' }[c.kind]), ' ', h('b', {}, c.name), ' — ', c.desc))));
  if (fresh.length) { wrap.prepend(h('div', { class: 'sk26-newbar' }, `✦ ${fresh.length} NEW SKILL${fresh.length > 1 ? 'S' : ''} UNLOCKED ✦`)); markSeen26(b.id, fresh); Sound.play && Sound.play('god'); }
  return wrap;
}
function skillCard26(b, s, p, f, owned, un, isNew) {
  const T = SKILL_TYPES[s.type] || {}, cat = s.isUlt ? 'ultimate' : catOf(s), C = SK_CATS[cat] || SK_CATS.offense;
  const xp = sk26Xp(s.uid), rank = masteryRank(xp), T5 = masteryXpOf(), stage = s.isUlt ? 0 : sk26Stage(b, s, p);
  const col = s.color || b.design.c3, dmg = f && s.power ? Math.round(skillDmg(f, s.power) * (s.isUlt ? 1 : (f.kitK || 1))) : null;
  const badges = [s.isUlt ? ['★ ULTIMATE', '#ffd54f'] : null, s.passive26 ? ['PASSIVE', '#90a4ae'] : null, s.auto26 ? ['AUTONOMOUS', '#e040fb'] : null, s.v26 ? ['NEW 2.6', '#69f0ae'] : null, s.disabled ? ['SWITCHED OFF', '#ff5252'] : null].filter(Boolean);
  const card = h('div', { class: 'sk26-card' + (un ? '' : ' locked') + (s.isUlt ? ' ult' : '') + (isNew ? ' fresh' : '') });
  const ico = h('div', { class: 'sk26-ico', style: { color: stage ? EVO_LOOK[stage - 1] : col, background: rgba(col, 0.18), borderColor: rgba(col, 0.6) } }, s.isUlt ? '★' : (T.ico || C.ico));
  const main = h('div', { class: 'sk26-main' });
  main.append(h('div', { class: 'sk26-name' }, (stage ? s.evoPath[stage - 1] : s.name) + (un ? '' : ' 🔒'), ...badges.map(([t, c]) => h('span', { class: 'sk26-badge', style: { color: c, borderColor: c } }, t))));
  main.append(h('div', { class: 'sk26-chips' },
    h('span', { class: 'sk26-chip', style: { borderColor: C.col, color: C.col } }, C.ico + ' ' + C.name),
    h('span', { class: 'sk26-chip' }, s.isUlt ? 'Ultimate' : tierOf(s.unlockLv || 1) + ' skill'),
    s.isUlt ? h('span', { class: 'sk26-chip' }, 'Charges in battle') : s.passive26 ? h('span', { class: 'sk26-chip' }, 'Always on') : h('span', { class: 'sk26-chip' }, '⏱ ' + fmtCd(s.cd || 6)),
    dmg != null && !s.passive26 ? h('span', { class: 'sk26-chip' }, (['shield', 'heal', 'buff'].includes(s.type) ? '⚡ power ' + s.power : '💥 ≈' + dmg + ' dmg')) : null,
    s.effect && s.effect !== 'none' ? h('span', { class: 'sk26-chip' }, '✦ ' + s.effect) : null));
  main.append(h('div', { class: 'sk26-desc' }, s.desc || (s.isUlt ? ULT_TYPES[s.type] : T.desc) || ''));
  if (s.sig) main.append(h('div', { class: 'sk26-sig' }, h('b', {}, '★ Signature: ' + s.sig), ' — ' + (s.sigDesc || '')));
  if (!un && owned) { const need = s.unlockLv || 1, k = Math.min(1, (p.level || 1) / need); main.append(h('div', { class: 'sk26-lock' }, '🔒 Unlocks at: ' + unlockText(s), h('div', { class: 'bar' }, h('i', { style: { width: k * 100 + '%' } })), s.unlockWins ? h('div', { class: 'muted small' }, `Wins with this ball: ${p.wins | 0} / ${s.unlockWins}`) : null)); }
  else if (!owned) main.append(h('div', { class: 'sk26-lock' }, '🔒 ' + unlockText(s)));
  if (owned && !b.adminOnly && !s.disabled) {
    const nx = T5[rank + 1], k = nx ? (xp - T5[rank]) / (nx - T5[rank]) : 1;
    main.append(h('div', { class: 'sk26-mast' }, h('span', { style: { color: MASTERY[rank].col } }, `◆ ${MASTERY[rank].name}`), h('div', { class: 'bar' }, h('i', { style: { width: k * 100 + '%', background: MASTERY[rank].col } })),
      h('span', { class: 'muted small' }, nx ? `${xp} / ${nx} XP → ${MASTERY[rank + 1].name}: ${MASTERY_REWARDS[rank + 1]}` : 'Highest mastery reached')));
  }
  if (s.evoPath && !s.isUlt) main.append(evoRow26(b, s, p, owned, stage));
  const btns = h('div', { class: 'sk26-btns' }, h('button', { class: 'btn small', onclick: () => previewSkill26(b, s.isUlt ? 'ult' : s.uid) }, '▶ Preview'));
  card.append(ico, main, btns);
  return card;
}
function evoRow26(b, s, p, owned, stage) {
  const row = h('div', { class: 'sk26-evo' }), path = ['Base', ...s.evoPath.map((n, i) => EVO_STAGE_NAMES[i])];
  row.append(h('span', { class: 'muted small' }, 'Evolution: '), ...path.map((n, i) => h('span', { class: 'sk26-stage' + (i <= stage ? ' on' : ''), style: i && i <= stage ? { borderColor: EVO_LOOK[i - 1], color: EVO_LOOK[i - 1] } : {} }, n)));
  if (owned && !p.maxed && stage < s.evoPath.length) {
    const req = evoReq(b, stage + 1), ev = EVO26[s.uid][stage], xp = sk26Xp(s.uid), ok = (p.level || 1) >= req.lv && masteryRank(xp) >= req.rank && SAVE.coins >= req.coins;
    row.append(h('div', { class: 'sk26-evoreq' }, h('b', {}, `Next: ${ev.n}`), ` — ${ev.d}. Needs Lv ${req.lv}, ${MASTERY[req.rank].name} mastery, 🪙 ${fmtNum(req.coins)}.`,
      h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } }, h('button', { class: 'btn small', onclick: () => previewSkill26(b, s.uid, { stage: stage + 1 }) }, '▶ Preview evolution'),
        h('button', { class: 'btn small gold', disabled: !ok, onclick: () => confirmEvolve26(b, s, stage + 1, req) }, '✦ Evolve'))));
  } else if (p.maxed && s.evoPath) row.append(h('span', { class: 'muted small' }, ' — full power: every evolution active'));
  return row;
}
function confirmEvolve26(b, s, stage, req) {
  const ev = EVO26[s.uid][stage - 1];
  const box = UI.modal(h('div', {}, h('h2', {}, `✦ Evolve ${s.name}?`), h('p', {}, h('b', { style: { color: ev.look } }, ev.n), ' — ', ev.d + '.'), h('p', { class: 'muted small' }, `Costs 🪙 ${fmtNum(req.coins)}. The new mechanic is added on top of what the ability already does (power +4% per stage). Evolutions are permanent.`)));
  const cv = h('canvas', { width: 640, height: 360, class: 'sk26-prev' }); box.append(cv); runPreview26(cv, b, s.uid, { stage });
  box.append(h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '8px', marginTop: '10px' } }, h('button', { class: 'btn', onclick: () => UI.openDetail(b.id) }, 'Not now'),
    h('button', { class: 'btn gold', onclick: () => act(() => Econ.evolve26(b.id, s.uid), () => { toast(`✦ <b>${esc(ev.n)}</b> unlocked!`, 'gold'); evolveFx26(b, ev); }) }, `✦ Evolve — 🪙 ${fmtNum(req.coins)}`)));
}
function evolveFx26(b, ev) {
  const cv = h('canvas', { width: 420, height: 300 }), box = UI.modal(h('div', { style: { textAlign: 'center' } }, h('h2', { style: { color: ev.look } }, '✦ EVOLUTION ✦'), cv, h('h3', {}, ev.n), h('p', { class: 'muted' }, ev.d)));
  let t = 0; const ctx = cv.getContext('2d'); const loop = () => { if (!cv.isConnected) return; t += 1 / 60; ctx.clearRect(0, 0, 420, 300); drawBall(ctx, b, 210, 150, 60, { t, rot: t }); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const r = ((t * 120 + i * 40) % 240); ctx.strokeStyle = rgba(ev.look, Math.max(0, 1 - r / 240)); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(210, 150, 60 + r * 0.6, 0, TAU); ctx.stroke(); } ctx.restore(); requestAnimationFrame(loop); };
  loop(); setTimeout(() => { if (box.isConnected) box.append(h('button', { class: 'btn primary', onclick: () => UI.openDetail(b.id) }, 'Back to the ball')); }, 900);
  if (Sound.play) Sound.play('god');
}
/* ---------- "seen" list for the unlock celebration (this device only) ---------- */
const SEEN_KEY = 'nbb_seen26';
function seenAll26() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { return {}; } }
const seen26 = id => seenAll26()[id] || [];
function markSeen26(id, uids) { const a = seenAll26(); a[id] = [...new Set([...(a[id] || []), ...uids])]; try { localStorage.setItem(SEEN_KEY, JSON.stringify(a)); } catch { /* private mode */ } }
/** after a battle: celebrate abilities that just became available */
function celebrateUnlocks26(ballId) {
  const b = getBall(ballId); if (!b || b.adminOnly || !canUseBall(b)) return;
  const p = prog(ballId), seen = seen26(ballId), fresh = b.skills.filter(s => s.v26 && !s.disabled && unlockedFor26(b, s, p) && !seen.includes(s.uid)); if (!fresh.length) return;
  markSeen26(ballId, fresh.map(s => s.uid));
  const box = UI.modal(h('div', { class: 'sk26-unlock' }, h('div', { class: 'sk26-unlock-title' }, `✦ NEW SKILL${fresh.length > 1 ? 'S' : ''} UNLOCKED ✦`), h('p', { class: 'muted' }, b.name + ' grew stronger. Keep playing it to unlock more.'),
    ...fresh.map(s => h('div', { class: 'sk26-unlock-card', style: { borderColor: s.color } }, h('span', { class: 'sk26-ico', style: { color: s.color } }, (SKILL_TYPES[s.type] || {}).ico || '✦'), h('div', {}, h('b', {}, s.name), h('div', { class: 'muted small' }, s.desc)))),
    h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', marginTop: '12px' } }, h('button', { class: 'btn', onclick: () => previewSkill26(b, fresh[0].uid) }, '▶ Preview'), h('button', { class: 'btn primary', onclick: () => { UI.closeModal(); Training26.start(b.id); } }, '🎯 Try it in Skill Training'))));
  if (Sound.play) Sound.play('god');
  return box;
}
/* ---------- animated preview: the ball uses one ability on a training target, over and over ---------- */
function previewSkill26(b, uid, o = {}) {
  const s = uid === 'ult' ? { ...b.ult, isUlt: true } : b.skills.find(x => x.uid === uid); if (!s) return;
  const cv = h('canvas', { width: 960, height: 540, class: 'sk26-prev' });
  const title = o.stage ? EVO26[s.uid][o.stage - 1].n : s.name;
  UI.modal(h('div', {}, h('h3', {}, '▶ ' + title + (s.isUlt ? ' (ultimate)' : '')), cv, h('p', { class: 'muted small' }, s.passive26 ? 'A passive skill works on its own all battle long.' : s.auto26 ? 'An autonomous skill triggers by itself when its moment comes; here it is shown on a training target.' : 'Preview on a training target — nothing here counts for progress.'),
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: () => UI.openDetail(b.id) }, '← Back'))), 'wide');
  runPreview26(cv, b, uid, o);
}
function runPreview26(cv, b, uid, o = {}) {
  const p = prog(b.id), ext = localExtras26(b, p), s = uid === 'ult' ? null : b.skills.find(x => x.uid === uid);
  if (o.stage && s) ext.sevo = { [s.uid]: o.stage };
  const pl = { ...playerSpecFrom(b, { ...p, ...ext, level: Math.max(p.level || 1, s ? s.unlockLv || 1 : 1) }), x: ARENA.x + 330, y: ARENA.cy, only26: s ? s.uid : null, startForm: o.form | 0 };
  const dummy = { ball: 'trainingdummy', level: pl.level, evo: 0, diff: 'easy', statMul: 1, allUnlocked: true, tree: {}, x: ARENA.x + 840, y: ARENA.cy };
  const T = { v: 2, mode: 'practice', difficulty: 'normal', seed: 4242, manual: false, teams: [[pl], [dummy]], pool: [], opts: { infinite: true, dummy: true } };
  let B; try { B = new Battle(buildBattleConfig(T, {})); } catch (e) { console.warn(e); return; }
  B.preview26 = true; B.speed = 1; const me = B.player, foe = B.fighters.find(f => f.team !== 0); me.ai = null; me.manual = false;
  let k = 0.6; const ctx = cv.getContext('2d'); let last = performance.now();
  const fire = () => { if (!me.alive) return; me.target = foe; if (uid === 'ult') { me.ultMeter = 100; useUltimate(me); return; } const sk = me.skills.find(x => x.uid === uid); if (!sk) return; sk.locked = false; sk.cdLeft = 0; me.gcd = 0;
    if (sk.auto26) autoFire(me, sk); else if (!sk.passive26) useSkill(me, sk); };
  const loop = ts => {
    if (!cv.isConnected || BATTLE !== B) { if (BATTLE === B) BATTLE = null; return; }
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts; k -= dt; if (k <= 0) { k = uid === 'ult' ? 6 : 2.6; fire(); }
    if (me.hp < me.maxHp * 0.6) me.hp = me.maxHp;
    try { B.update(dt); ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); B.draw(ctx, dt); } catch (e) { console.warn(e); BATTLE = null; return; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
/* ---------- SKILL TRAINING MODE: unlocked abilities only, training targets, live statistics, no rewards ---------- */
const Training26 = {
  B: null, ball: null, timing: {},
  start(ballId, o = {}) {
    const b = getBall(ballId); if (!b || !canUseBall(b)) return toast('⚠ Choose a ball you can use first', 'bad');
    Sound.init && Sound.init(); this.ball = ballId; this.timing = {};
    const p = prog(ballId), pl = { ...playerSpecFrom(b, { ...p, ...localExtras26(b, p) }), x: ARENA.x + 260, y: ARENA.cy };
    const n = o.targets || 1, targets = []; for (let i = 0; i < n; i++) targets.push({ ball: 'trainingdummy', level: pl.level, evo: 0, diff: 'easy', statMul: 1, allUnlocked: true, tree: {}, x: ARENA.x + 560 + (i % 2) * 130, y: ARENA.y + ARENA.h * (i + 1) / (n + 1) });
    const T = { v: 2, mode: 'practice', difficulty: 'normal', seed: (Math.random() * 4294967296) >>> 0, manual: SAVE.settings.control !== 'auto', teams: [[pl], targets], pool: [], opts: { infinite: true, dummy: true, training: true } };
    UI.hideAll(); $('#battleHud').classList.remove('hidden'); Game.ticket = T;
    const B = this.B = new Battle(buildBattleConfig(T, { onEnd: () => this.exit() })); B.training26 = { moving: !!o.moving, t0: 0, n };
    if (o.moving) for (const f of B.fighters) if (f.team !== 0) { f.ai = new AIController(f, 'defensive', 'easy'); f.skills = []; f.ult = null; }
    B.player.manual = T.manual; for (const s of B.player.skills) s.cdLeft = 0; UI.syncHud(); this.panel(); this.tick();
  },
  panel() {
    $('#train26')?.remove();
    const P = h('div', { id: 'train26', class: 'train26' }), B = this.B;
    const btn = (t, fn, cls = '') => h('button', { class: 'btn small ' + cls, onclick: e => { e.stopPropagation(); fn(); } }, t);
    P.append(h('div', { class: 'train26-head' }, h('b', {}, '🎯 SKILL TRAINING'), h('span', { class: 'muted small' }, 'No rewards • no rank points')),
      h('div', { class: 'train26-btns' }, btn('⟳ Reset cooldowns', () => { for (const s of B.player.skills) s.cdLeft = 0; B.player.gcd = 0; }), btn('★ Ultimate ready', () => { B.player.ultMeter = 100; }),
        btn('🗑 Reset stats', () => { B.player.skUse = {}; B.player.skDmg = {}; B.player.comboLog = {}; this.timing = {}; B.training26.t0 = B.time; }),
        btn('1 target', () => this.restart({ targets: 1 })), btn('3 targets', () => this.restart({ targets: 3 })), btn('Moving target', () => this.restart({ targets: 1, moving: true })), btn('✕ Exit', () => this.exit(), 'danger')),
      h('div', { id: 'train26stats' }));
    $('#stage').append(P);
  },
  restart(o) { const id = this.ball; this.end(true); this.start(id, o); },
  tick() {
    const B = this.B; if (!B || BATTLE !== B) return;
    const el = $('#train26stats'); if (el) {
      const me = B.player, secs = Math.max(1, B.time - (B.training26.t0 || 0)); el.innerHTML = '';
      const tbl = h('table', { class: 'train26-tbl' }, h('tr', {}, ...['Skill', 'Uses', 'Damage', 'Ready', 'Timing'].map(t => h('th', {}, t))));
      let total = 0;
      for (const s of me.skills) { if (s.disabled) continue; const d = Math.round(me.skDmg[s.uid] || 0); total += d; const tm = this.timing[s.uid];
        tbl.append(h('tr', { class: s.locked ? 'locked' : '' }, h('td', {}, (s.locked ? '🔒 ' : '') + s.name), h('td', {}, String(me.skUse[s.uid] || 0)), h('td', {}, String(d)),
          h('td', {}, s.locked ? '—' : s.passive26 ? 'passive' : s.auto26 ? 'auto' : s.cdLeft > 0 ? fmtCd(s.cdLeft) : '✔'), h('td', { style: { color: tm ? tm.col : '' } }, tm ? `${tm.grade} (${tm.perfect}× perfect)` : '—'))); }
      const ud = Math.round(me.skDmg[me.ult && me.ult.uid] || 0); total += ud;
      tbl.append(h('tr', {}, h('td', {}, '★ ' + (me.ult ? me.ult.name : 'Ultimate')), h('td', {}, String(me.skUse[me.ult && me.ult.uid] || 0)), h('td', {}, String(ud)), h('td', {}, Math.round(me.ultMeter) + '%'), h('td', {}, '—')));
      const combos = Object.entries(me.comboLog || {}).map(([k, v]) => (COMBOS.find(c => c.id === k) || { name: k }).name + ' ×' + v);
      el.append(tbl, h('div', { class: 'small' }, `Total ${fmtNum(total)} damage • ${Math.round(total / secs)} per second • combos: ${combos.length ? combos.join(', ') : 'none yet'}`));
      const mine = combosOf(this.ball).filter(c => c.kind !== 'reaction'); if (mine.length) el.append(h('div', { class: 'muted small' }, 'Try: ' + mine.map(c => c.name + ' (' + c.desc + ')').join(' • ')));
    }
    setTimeout(() => this.tick(), 300);
  },
  end(silent) { const B = this.B; this.B = null; $('#train26')?.remove(); if (B) { B.over = true; if (BATTLE === B) BATTLE = null; } $('#battleHud').classList.add('hidden'); if (!silent) { UI.show('menu'); } },
  exit() { const id = this.ball, B = this.B; const me = B && B.player; const sum = me ? Object.entries(me.skDmg || {}).sort((a, b) => b[1] - a[1]).slice(0, 5) : []; this.end(false);
    if (sum.length) UI.modal(h('div', {}, h('h3', {}, '🎯 Training summary'), ...sum.map(([u, d]) => h('div', {}, `${(getBall(id).skills.find(s => s.uid === u) || (getBall(id).ult && getBall(id).ult.uid === u && getBall(id).ult) || { name: u }).name}: ${fmtNum(Math.round(d))} damage`)), h('p', { class: 'muted small' }, 'Training never gives coins, EXP, mastery or rank points.'))); },
};
/* cooldown timing practice (training only): how quickly an ability was used once it was ready */
SUP.worldHooks.push(B => { if (!B.training26 || !B.player) return; for (const s of B.player.skills) { if (s.cdLeft <= 0 && s.ready26 == null && !s.locked) s.ready26 = B.time; } });
CAST26.push((f, sk, uid) => { const B = BATTLE; if (!B || !B.training26 || f !== B.player || sk.ready26 == null) return; const d = B.time - sk.ready26; sk.ready26 = null;
  const T = Training26.timing[uid] || (Training26.timing[uid] = { perfect: 0 }); T.grade = d <= 0.35 ? 'PERFECT' : d <= 1.2 ? 'GOOD' : 'LATE'; T.col = d <= 0.35 ? '#69f0ae' : d <= 1.2 ? '#ffd740' : '#ff8a80'; if (d <= 0.35) T.perfect++;
  if (!FX.off) FX.text(f.x, f.y - f.r - 70, T.grade, T.col, 13, { life: 0.7 }); });
SUP.worldHooks.push(B => { if (B.training26 && B.player && B.player.alive && B.player.hp < B.player.maxHp * 0.5) B.player.hp = B.player.maxHp; });
/* ---------- the battle skill bar: up to 9 abilities, passives and autonomous abilities shown but not pressable ---------- */
{ const sh = UI.syncHud; UI.syncHud = function () { sh.call(this); const pl = BATTLE && BATTLE.player, bar = $('#skillBar'); if (!pl || !bar) return; bar.classList.toggle('many', pl.skills.length > 6);
  const btns = $$('#skillBar button'); pl.skills.forEach((s, i) => { const b = btns[i]; if (!b) return; if (s.disabled) { b.style.display = 'none'; return; }
    if (s.passive26 || s.auto26) { b.classList.add('pas26'); b.disabled = true; const l = b.querySelector('.lbl'); if (l) l.textContent = (s.passive26 ? 'PASSIVE\n' : 'AUTO\n') + s.name.slice(0, 14); } }); }; }
/* ---------- results: mastery from verified battles, unlock celebration ---------- */
{ const sr = UI.showResults; UI.showResults = function (r, B) { sr.call(this, r, B); if (r.pending) return; const body = $('#resultsBody');
  if (r.mastery && r.mastery.gains && Object.keys(r.mastery.gains).length && body) { const b = getBall(r.ballId);
    body.append(h('div', { class: 'sk26-mres' }, h('b', {}, '◆ Skill mastery'), ...Object.entries(r.mastery.gains).slice(0, 6).map(([u, g]) => { const s = b && ((b.skills || []).find(x => x.uid === u) || (b.ult && b.ult.uid === u ? b.ult : null)); const xp = sk26Xp(u), rk = masteryRank(xp), up = masteryRank(xp - g) < rk;
      return h('div', { class: 'small' }, `${s ? s.name : u}: +${g} XP — ${MASTERY[rk].name}${up ? ' ✦ RANK UP!' : ''}`); })));
    for (const t of r.mastery.titles || []) { const c = COSMETICS.find(x => x.id === t); if (c) toast(`🏅 New title earned: <b>${esc(c.name)}</b>`, 'gold'); } }
  if (r.ballId && !r.pending) setTimeout(() => { if (UI.current === 'results') celebrateUnlocks26(r.ballId); }, 1400); }; }
/* guest play (no account): mastery is kept on this device */
{ const eb = Game.endBattle; Game.endBattle = async function (r, B) { const T = this.ticket; const out = await eb.call(this, r, B);
  if (!online() && T && T.mode !== 'practice' && !(T.opts && T.opts.training) && B && B.player && B.player.skUse) { const id = T.teams[0][0].ball, M = sk26Save().mastery; for (const [u, n] of Object.entries(B.player.skUse)) M[u] = (M[u] | 0) + Math.min(MASTERY_XP.cap, (n | 0) * MASTERY_XP.perUse) + (r.win ? MASTERY_XP.win : 0); persist(); setTimeout(() => celebrateUnlocks26(id), 1400); }
  return out; }; }
Econ.evolve26 = function (ballId, uid) {
  return this.run('/api/skills/evolve', { ball: ballId, uid }, () => {
    const b = getBall(ballId), s = b && b.skills[0], p = prog(ballId); if (!s || s.uid !== uid || !s.evoPath) throw new Error('This ability cannot evolve');
    const cur = sk26Save().evolutions[uid] | 0, next = cur + 1; if (next > s.evoPath.length) throw new Error('Already fully evolved');
    const req = evoReq(b, next); if ((p.level || 1) < req.lv) throw new Error('Needs ball level ' + req.lv); if (masteryRank(sk26Xp(uid)) < req.rank) throw new Error('Needs ' + MASTERY[req.rank].name + ' mastery');
    if (SAVE.coins < req.coins) throw new Error('Not enough coins'); addCoins(-req.coins); sk26Save().evolutions[uid] = next; return { ok: true, stage: next };
  });
};
/* the Ball Details screen uses the new skill list, and a "Skill Training" button */
UI.skillPanel26 = skillPanel26;
/* =====================================================================
   2.6.0 ADMIN SKILL MANAGEMENT (Admin Dashboard → 🧬 Skills). Owner only: every action is checked again on the
   server (owner role + recent 2FA) and written to the audit log. Hiding this tab is never the only protection.
   ===================================================================== */
ALL_BUILTIN.push(B('trainingdummy', 'Training Target', 'Special', 'Common', [500, 1, 70, 40, 0], D('#37474f', '#ff5252', '#eceff1', 'rings', [], '◎'), [], U('Training', 'nova', 1, '#ffffff'), 'defensive',
  { summonOnly: true, noOpponent: true, trainingTarget: true, desc: 'A training target for Skill Training and skill previews. It never attacks.' }));
{ const gs = Game.start; Game.start = function (mode) { if (this.setup.training) { this.setup.training = false; return Training26.start(this.setup.ball); } return gs.call(this, mode); }; }
UI.admin_skills26 = async function (body) {
  const d = await API.get('/api/admin/skills'); body.innerHTML = '';
  const reg = d.registry, dups = d.audit.filter(a => a.level === 'duplicate'), byCat = {};
  for (const r of reg) byCat[r.cat] = (byCat[r.cat] || 0) + 1;
  const refresh = async () => { try { Online.applySave(await API.get('/api/save')); } catch { /* the catalog refreshes on the next sign-in */ } UI.render_admin(); };
  const inp = (v, w = '80px', type = 'number', more = {}) => h('input', { type, value: v == null ? '' : String(v), style: { width: w }, ...more });
  const sel = (opts, v, more = {}) => h('select', more, ...opts.map(([k, l]) => h('option', { value: k, selected: k === v }, l)));
  // ---- overview + duplicate audit ----
  body.append(h('div', { class: 'card' }, h('h3', {}, `🧬 Unique Skill Registry — ${reg.length} abilities (v${d.version})`),
    h('p', { class: 'muted small' }, Object.entries(byCat).map(([k, n]) => `${(d.cats[k] || {}).ico || ''} ${(d.cats[k] || { name: k }).name}: ${n}`).join(' • ')),
    h('p', {}, h('b', { style: { color: dups.length ? '#ff5252' : '#69f0ae' } }, dups.length ? `⚠ ${dups.length} duplicate mechanics found` : '✔ No duplicate mechanics'), ` • ${d.audit.length - dups.length} pairs are similar (≥ ${Math.round(d.dup.WARN * 100)}%). The audit compares mechanics, targeting, activation, effects and animation — names count only 10%.`),
    d.audit.length ? h('div', { style: { maxHeight: '180px', overflow: 'auto' } }, h('table', { class: 'gshop-tbl' }, h('tr', {}, h('th', {}, 'Score'), h('th', {}, 'Ability'), h('th', {}, 'Ability'), h('th', {}, 'Mechanics / targeting / activation / effects / look / name')),
      ...d.audit.slice(0, 40).map(a => h('tr', {}, h('td', { style: { color: a.level === 'duplicate' ? '#ff5252' : '#ffd740' } }, Math.round(a.score * 100) + '%'), h('td', {}, a.an + ' (' + a.a + ')'), h('td', {}, a.bn + ' (' + a.b + ')'),
        h('td', { class: 'small' }, ['mechanics', 'targeting', 'activation', 'effects', 'animation', 'name'].map(k => Math.round(a.parts[k] * 100) + '%').join(' / ')))))) : null));
  // ---- browse & edit ----
  const q = inp('', '180px', 'text', { placeholder: 'Search name / ball / uid' }), catSel = sel([['', 'All categories'], ...Object.entries(d.cats).map(([k, c]) => [k, c.name])], ''), kindSel = sel([['', 'All abilities'], ['v26', 'New in 2.6.0'], ['legacy', 'Classic'], ['custom', 'Owner-made'], ['ult', 'Ultimates']], '');
  const list = h('div', { style: { maxHeight: '320px', overflow: 'auto' } }), editor = h('div');
  const draw = () => { list.innerHTML = ''; const t = q.value.trim().toLowerCase(), c = catSel.value, k = kindSel.value;
    const rows = reg.filter(r => (!t || (r.name + ' ' + r.ballName + ' ' + r.uid).toLowerCase().includes(t)) && (!c || r.cat === c) && (!k || (k === 'v26' ? r.v26 && !r.custom : k === 'legacy' ? r.legacy : k === 'custom' ? r.custom : r.isUlt))).slice(0, 250);
    list.append(h('table', { class: 'gshop-tbl' }, h('tr', {}, ...['Ability', 'Ball', 'Category', 'Cooldown', 'Power', 'Unlock', 'Status'].map(x => h('th', {}, x))),
      ...rows.map(r => h('tr', { style: { cursor: 'pointer', opacity: r.disabled ? 0.5 : 1 }, onclick: () => edit(r) }, h('td', {}, (r.isUlt ? '★ ' : '') + r.name), h('td', {}, r.ballName), h('td', {}, (d.cats[r.cat] || { name: r.cat }).name), h('td', {}, r.cd != null ? r.cd + 's' : '—'), h('td', {}, String(r.power ?? '—')),
        h('td', {}, r.isUlt ? '—' : 'Lv ' + r.unlockLv + (r.unlockWins ? ` + ${r.unlockWins}w` : '')), h('td', {}, r.disabled ? 'OFF' : r.custom ? 'owner-made' : r.v26 ? 'new' : 'classic'))))); };
  q.oninput = draw; catSel.onchange = draw; kindSel.onchange = draw;
  function edit(r) {
    const ov = d.config.overrides[r.uid] || {};
    const cd = inp(ov.cd ?? r.cd), pw = inp(ov.power ?? r.power), ul = inp(ov.unlockLv ?? r.unlockLv), uw = inp(ov.unlockWins ?? r.unlockWins), nm = inp(ov.name || '', '200px', 'text', { placeholder: r.name, maxlength: '32' }), ds = inp(ov.desc || '', '100%', 'text', { placeholder: r.desc, maxlength: '200' });
    const off = h('input', { type: 'checkbox', checked: !!ov.off, disabled: r.legacy || r.isUlt }), evoOff = h('input', { type: 'checkbox', checked: !!ov.evoOff, disabled: !r.evo.length });
    const ball = getBall(r.ball);
    editor.innerHTML = ''; editor.append(h('div', { class: 'card', style: { borderColor: '#7c4dff' } }, h('h3', {}, `✎ ${r.name} — ${r.ballName}`), h('p', { class: 'muted small' }, `${r.uid} • ${(d.cats[r.cat] || {}).name} • ${r.desc}${r.sig ? ' • Signature: ' + r.sig : ''}${r.evo.length ? ' • Evolutions: ' + r.evo.join(' → ') : ''}`),
      h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, h('label', {}, 'Cooldown (s) ', cd), h('label', {}, 'Power ', pw), r.v26 ? h('label', {}, 'Unlock level ', ul) : null, r.v26 ? h('label', {}, 'Wins needed ', uw) : null, h('label', {}, 'Name ', nm)),
      h('div', { style: { marginTop: '6px' } }, ds),
      h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' } }, h('label', { class: 'chk' }, off, ' Switched off (new abilities only)'), h('label', { class: 'chk' }, evoOff, ' Evolution switched off'),
        h('button', { class: 'btn gold', onclick: () => adminDo(() => API.post('/api/admin/skills/override', { uid: r.uid, cd: +cd.value, power: +pw.value, unlockLv: r.v26 ? +ul.value : undefined, unlockWins: r.v26 ? +uw.value : undefined, name: nm.value, desc: ds.value, off: off.checked, evoOff: evoOff.checked }), refresh) }, '💾 Save'),
        h('button', { class: 'btn', onclick: () => adminDo(() => API.post('/api/admin/skills/override', { uid: r.uid }), refresh) }, '↺ Reset to default'),
        ball ? h('button', { class: 'btn', onclick: () => previewSkill26(ball, r.isUlt ? 'ult' : r.uid) }, r.isUlt ? '★ Test ultimate' : '▶ Preview animation') : null)));
    editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  body.append(h('div', { class: 'card' }, h('h3', {}, 'Browse & edit abilities'), h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, q, catSel, kindSel), list, editor));
  draw();
  // ---- create an ability ----
  const balls = allBalls().filter(b => !b.summonOnly && !b.unit && !b.fusion).sort((a, b) => a.name.localeCompare(b.name));
  const cBall = sel(balls.map(b => [b.id, `${b.name} (${b.rarity}${b.slotCap ? ` • ${b.slotsUsed}/${b.slotCap}` : ''})`]), balls[0] && balls[0].id), cName = inp('', '180px', 'text', { maxlength: '32', placeholder: 'Ability name' });
  const cType = sel(d.types.map(t => [t.type, t.label]), d.types[0].type), cEff = sel(d.effects.map(e => [e, e]), 'none'), cCat = sel(Object.entries(d.cats).filter(([k]) => k !== 'ultimate').map(([k, c]) => [k, c.name]), 'offense');
  const cTw = sel([['', '— no signature mechanic —'], ...(d.twists || []).map(t => [t.id, `${t.id} (${t.kind}): ${t.desc}`])], '', { style: { maxWidth: '100%' } });
  const cCd = inp(8), cPow = inp(50), cLv = inp(20), cCount = inp(3), cCol = inp('#7c4dff', '70px', 'color'), cDesc = inp('', '100%', 'text', { maxlength: '200', placeholder: 'What it does' }), out = h('div');
  let editing = null;
  const proposal = () => ({ uid: editing, ball: cBall.value, name: cName.value, type: cType.value, twist: cTw.value || undefined, effect: cEff.value, cat: cCat.value, cd: +cCd.value, power: +cPow.value, unlockLv: +cLv.value, count: +cCount.value, color: cCol.value, desc: cDesc.value });
  const showMatches = m => { out.innerHTML = ''; if (!m.length) { out.append(h('p', { style: { color: '#69f0ae' } }, '✔ Nothing similar — this is a unique mechanic.')); return; }
    out.append(h('p', { class: 'small' }, 'Most similar existing abilities:'), ...m.map(x => h('div', { class: 'small', style: { color: x.score >= d.dup.BLOCK ? '#ff5252' : '#ffd740' } }, `${Math.round(x.score * 100)}% — ${x.name} (${x.ball}) • mechanics ${Math.round(x.parts.mechanics * 100)}%, effects ${Math.round(x.parts.effects * 100)}%, name ${Math.round(x.parts.name * 100)}%`))); };
  const save = force => Online.admin(() => API.post('/api/admin/skills/custom', { ...proposal(), force })).then(r => { toast('✔ Saved'); if (r.warnings && r.warnings.length) showMatches(r.warnings); refresh(); })
    .catch(e => { if (/similar/i.test(e.message)) UI.confirm(esc(e.message) + '<br><small>Save it anyway?</small>', () => save(true), 'Save anyway'); else toast('⚠ ' + esc(e.message), 'bad'); });
  body.append(h('div', { class: 'card' }, h('h3', {}, '＋ Create an ability'), h('p', { class: 'muted small' }, 'Built from the engine’s ability types and assigned to a ball. A ball must have a free skill slot (switch off one of its new abilities to make room). The duplicate check runs before saving.'),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('label', {}, 'Ball ', cBall), h('label', {}, 'Name ', cName), h('label', {}, 'Type ', cType), h('label', {}, 'Effect ', cEff), h('label', {}, 'Category ', cCat)),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' } }, h('label', {}, 'Cooldown ', cCd), h('label', {}, 'Power ', cPow), h('label', {}, 'Unlock Lv ', cLv), h('label', {}, 'Count ', cCount), h('label', {}, 'Colour ', cCol)),
    h('div', { style: { marginTop: '6px' } }, h('label', {}, 'Signature mechanic ', cTw), h('div', { class: 'muted small' }, 'A plain type copies existing abilities; a signature mechanic makes it unique.')),
    h('div', { style: { marginTop: '6px' } }, cDesc),
    h('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } }, h('button', { class: 'btn', onclick: () => Online.admin(() => API.post('/api/admin/skills/check', proposal())).then(r => showMatches(r.matches)).catch(e => toast('⚠ ' + esc(e.message), 'bad')) }, '🔍 Check duplicates'),
      h('button', { class: 'btn gold', onclick: () => save(false) }, '💾 Save ability')), out));
  const customs = d.config.custom || [];
  if (customs.length) body.append(h('div', { class: 'card' }, h('h3', {}, 'Owner-made abilities'), ...customs.map(c => h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, h('b', {}, c.name), h('span', { class: 'muted small' }, `${c.ball} • ${c.type} • ${c.uid}`),
    h('button', { class: 'btn small', onclick: () => { editing = c.uid; cBall.value = c.ball; cName.value = c.name; cType.value = c.type; cEff.value = c.effect; cCat.value = c.cat; cTw.value = c.twist || ''; cCd.value = c.cd; cPow.value = c.power; cLv.value = c.unlockLv; cCount.value = c.count || 3; cCol.value = c.color; cDesc.value = c.desc || ''; cName.focus(); } }, '✎ Edit'),
    h('button', { class: 'btn small danger', onclick: () => UI.confirm(`Delete “${esc(c.name)}”?`, () => adminDo(() => API.post('/api/admin/skills/custom/delete', { uid: c.uid }), refresh), 'Delete') }, '🗑')))));
  // ---- mastery & evolution settings ----
  const mx = (d.config.mastery || d.mastery.map(m => m.xp)).map((v, i) => inp(v, '80px', 'number', { disabled: i === 0 }));
  const er = (d.config.evoReq || d.evoReq).map(r => ({ lv: inp(r.lv, '60px'), rank: sel(d.mastery.map((m, i) => [String(i), m.name]), String(r.rank)), coins: inp(r.coins, '90px') }));
  body.append(h('div', { class: 'card' }, h('h3', {}, 'Mastery & evolution requirements'),
    h('p', { class: 'muted small' }, `Mastery XP per verified battle: ${d.masteryXp.perUse} per use (max ${d.masteryXp.cap} per ability) + ${d.masteryXp.win} for a win. Mastery changes looks and titles only, never damage.`),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, ...d.mastery.map((m, i) => h('label', {}, m.name + ' ', mx[i]))),
    ...er.map((r, i) => h('div', { class: 'row', style: { gap: '8px', alignItems: 'center', marginTop: '6px' } }, h('b', {}, ['Awakened', 'Ascended', 'Ultimate Variant'][i]), h('label', {}, 'Ball Lv ', r.lv), h('label', {}, 'Mastery ', r.rank), h('label', {}, 'Coins ', r.coins))),
    h('p', { class: 'muted small' }, 'God of Absolute (Lv 50–100) uses its own higher levels unless you change them here.'),
    h('button', { class: 'btn gold', onclick: () => adminDo(() => API.post('/api/admin/skills/config', { mastery: mx.map(x => +x.value), evoReq: er.map(r => ({ lv: +r.lv.value, rank: +r.rank.value, coins: +r.coins.value })) }), refresh) }, '💾 Save requirements')));
  body.append(h('div', { class: 'card' }, h('h3', {}, `✦ Designed combinations (${d.combos.length})`), ...d.combos.map(c => h('div', { class: 'small' }, h('b', {}, c.name), ` [${c.kind}] — ${c.desc}`))));
};
if (window.NBB_CORE) Object.assign(window.NBB_CORE, { useSkill, useUltimate, dealDamage, playerSpecFrom, SKILLS_VERSION, SLOT_CAP, SK_CATS, MASTERY, MASTERY_XP, MASTERY_REWARDS, masteryRank, EVO_REQ, EVO_REQ_HIGH, EVO26, SIG, ULT_SIG, NEW26, TW, skillRegistry, skAudit, skSimilarity, skCheckProposal, DUP, skUnlocked, unlockText, TYPE_META, maxLvlFor, COMBOS, combosOf, evoReq, evoPathLen, MASTERY_TITLES, masteryTitles, SK_GCD, twistList: () => Object.entries(TW).filter(([k, t]) => !t.ult && t.desc).map(([k, t]) => ({ id: k, desc: t.desc({}), kind: t.dec ? 'shape' : t.hit ? 'on hit' : 'after cast' })), Training26: typeof Training26 !== 'undefined' ? Training26 : null });
invalidateRegistry();
