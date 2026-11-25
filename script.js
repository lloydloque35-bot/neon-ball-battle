/* =====================================================================
   NEON BALL BATTLE: ULTIMATE GODS
   Autonomous physics ball-vs-ball battler. Every character is a BALL.
   Pure HTML5 Canvas + JavaScript. No engines, no image assets required.
   ---------------------------------------------------------------------
   Sections:
    1. Core utilities & constants
    2. Save system (localStorage, backup/restore)
    3. Procedural audio (WebAudio)
    4. Ball database (50 core + limited balls), rarities, skills
    5. Procedural ball renderer (patterns, sprites, decorations)
    6. Arena, particles & visual effects
    7. Fighter (combatant) + damage / status system
    8. Skills, ultimates, God Mode
    9. AI controllers
   10. Battle engine (physics, modes, HUD)
   11. Progression (levels, evolution, skill tree, achievements, events)
   12. UI screens (menu, selection, collection, shop, events, settings)
   13. Admin dashboard & Ball Creator
   14. Main loop & boot
   ===================================================================== */
'use strict';

/* =====================================================================
   1. CORE UTILITIES & CONSTANTS
   ===================================================================== */
const W = 1280, H = 720;                       // logical canvas size (landscape)
const ARENA = { x: 46, y: 112, w: 1188, h: 578 }; // inner playable rectangle
ARENA.r = ARENA.x + ARENA.w; ARENA.b = ARENA.y + ARENA.h;
ARENA.cx = ARENA.x + ARENA.w / 2; ARENA.cy = ARENA.y + ARENA.h / 2;
const WALL = 20;                                // visual wall thickness
const BASE_R = 46;                              // base ball radius
const TAU = Math.PI * 2;
const RAGE_HP = 20;                             // Rage Mode threshold (HP)
const DMG_SCALE = 0.5;                          // global damage tuning (battle length ~40-60s)

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
/* Battle LOGIC randomness is seeded per battle (deterministic replays for server-side verification).
   Purely VISUAL randomness (particles, shake, text jitter) uses vr() so it never disturbs the logic stream. */
let _rng = Math.random, _rngN = 0, _rngHook = null;
const RNG = () => { _rngN++; if (_rngHook) _rngHook(); return _rng(); };
function seedRNG(seed) { _rng = seed == null ? Math.random : mulberry32(seed >>> 0); }
const rand = (a = 1, b) => b === undefined ? RNG() * a : a + RNG() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(RNG() * arr.length)];
const vr = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const STEP = 1 / 240;                           // fixed simulation timestep
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const len = (x, y) => Math.sqrt(x * x + y * y);
/* Portable deterministic math. IEEE-754 + - * / and sqrt give bit-identical results in every JS engine,
   but Math.sin/cos/exp/atan2 may differ between engines (Chrome, Node, Safari, Firefox use different libm code).
   All battle LOGIC uses these versions so a battle replays identically on the server and on any device. */
const HPI = 1.5707963267948966, LN2 = 0.6931471805599453;
function dsin(x) {
  x = x - TAU * Math.round(x / TAU);
  if (x > HPI) x = Math.PI - x; else if (x < -HPI) x = -Math.PI - x;
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000 + x2 / 355687428096000))))))));
}
function dcos(x) { return dsin(x + HPI); }
function dexp(x) {
  if (x > 700) return Infinity; if (x < -700) return 0;
  const k = Math.round(x / LN2), r = x - k * LN2;
  let sum = 1, term = 1;
  for (let i = 1; i <= 14; i++) { term = term * r / i; sum += term; }
  if (k > 0) for (let i = 0; i < k; i++) sum *= 2; else for (let i = 0; i < -k; i++) sum *= 0.5;
  return sum;
}
function datan(z) {
  const neg = z < 0; if (neg) z = -z;
  const inv = z > 1; if (inv) z = 1 / z;
  z = z / (1 + Math.sqrt(1 + z * z)); z = z / (1 + Math.sqrt(1 + z * z));
  const z2 = z * z; let term = z, sum = z;
  for (let n = 3; n <= 27; n += 2) { term = -term * z2; sum += term / n; }
  let r = 4 * sum; if (inv) r = HPI - r;
  return neg ? -r : r;
}
function datan2(y, x) {
  if (x > 0) return datan(y / x);
  if (x < 0) return y >= 0 ? datan(y / x) + Math.PI : datan(y / x) - Math.PI;
  return y > 0 ? HPI : y < 0 ? -HPI : 0;
}
const angTo = (a, b) => datan2(b.y - a.y, b.x - a.x);
const now = () => performance.now() / 1000;
let UID = 1;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---- colour helpers ---- */
const _rgbCache = {};
function hexToRgb(hex) {
  if (_rgbCache[hex]) return _rgbCache[hex];
  let h = String(hex || '#ffffff').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return (_rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
function rgba(hex, a = 1) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function toHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function mixColor(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
function shade(hex, amt) { return amt >= 0 ? mixColor(hex, '#ffffff', amt) : mixColor(hex, '#000000', -amt); }
function luminance(hex) { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

/* ---- DOM helpers ---- */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) { if (kid == null || kid === false) continue; e.append(kid.nodeType ? kid : document.createTextNode(kid)); }
  return e;
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return (d ? d + 'd ' : '') + p(hh) + ':' + p(m) + ':' + p(s);
}
function fmtNum(n) { return Math.round(n).toLocaleString(); }
function toast(msg, cls = '') {
  const t = h('div', { class: 'toast ' + cls, html: msg });
  $('#toasts').append(t);
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 2600);
  setTimeout(() => t.remove(), 3100);
}

/* =====================================================================
   2. SAVE SYSTEM
   ===================================================================== */
const SAVE_KEY = 'neonBallBattle_ultimateGods_v1';
const DEFAULT_SETTINGS = {
  sfx: 0.6, music: 0.35, musicOn: true, shake: true, particles: 'high', dmgNumbers: true,
  labels: true, speed: 1, difficulty: 'normal', control: 'auto', fps: false, flashes: true,
};
const STARTERS = ['fire', 'ice', 'thunder', 'water', 'earth', 'wind'];
let SAVE = null;

function defaultSave() {
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    version: 1, created: Date.now(), coins: 600,
    balls: {}, customBalls: [], overrides: {}, disabled: {},
    settings: { ...DEFAULT_SETTINGS, ...(calm ? { shake: false, flashes: false } : {}) },
    achievements: {}, collectionClaimed: [],
    stats: { battles: 0, wins: 0, losses: 0, kills: 0, crits: 0, skills: 0, rages: 0, gods: 0, evolutions: 0,
      tourneyWins: 0, bossWins: 0, survivalBest: 0, endlessBest: 0, dmg: 0, summons: 0, insaneWins: 0, created: 0 },
    limited: {}, eventProgress: {}, customEvents: [], announcement: '',
    admin: { pin: '', loggedIn: false },
    last: { ball: 'fire', enemy: 'random', difficulty: 'normal' },
  };
}
function mergeDeep(base, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data ?? base;
  const out = Array.isArray(base) ? [] : { ...base };
  for (const k in data) {
    if (base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k]) && typeof data[k] === 'object' && data[k] !== null && !Array.isArray(data[k])) out[k] = mergeDeep(base[k], data[k]);
    else out[k] = data[k];
  }
  return out;
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) SAVE = mergeDeep(defaultSave(), JSON.parse(raw));
  } catch (e) { console.warn('Save load failed', e); }
  if (!SAVE) { SAVE = defaultSave(); STARTERS.forEach(id => prog(id).owned = true); persist(); }
  if (SAVE.admin.pin) SAVE.admin.loggedIn = false;   // admin must log in each session when a PIN is set
  SAVE.settings.difficulty = normDiff(SAVE.settings.difficulty); SAVE.last.difficulty = normDiff(SAVE.last.difficulty);
}
let _saveTimer = 0, _saveWarned = false;
function persist(immediate) {
  clearTimeout(_saveTimer);
  if (window.Online && window.Online.active) { window.Online.syncSettings(); return; }   // signed in: the server is the save
  const doSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { if (!_saveWarned) { _saveWarned = true; toast('⚠ This browser is blocking storage, so progress will not be kept after you close the page', 'bad'); } } };
  if (immediate) doSave(); else _saveTimer = setTimeout(doSave, 120);
}
function prog(id) {
  if (!SAVE.balls[id]) SAVE.balls[id] = { owned: false, level: 1, exp: 0, evo: 0, up: { hp: 0, atk: 0, def: 0, spd: 0, crit: 0 }, sp: 0, tree: {}, wins: 0, losses: 0 };
  const p = SAVE.balls[id]; p.up = p.up || { hp: 0, atk: 0, def: 0, spd: 0, crit: 0 }; p.tree = p.tree || {};
  return p;
}
function addCoins(n) { SAVE.coins = Math.max(0, Math.round(SAVE.coins + n)); persist(); refreshCoins(); }
function refreshCoins() { $$('.coinVal').forEach(e => e.textContent = fmtNum(SAVE.coins)); }
function exportSave() { return JSON.stringify({ game: 'NEON BALL BATTLE: ULTIMATE GODS', exported: new Date().toISOString(), save: SAVE }, null, 1); }
function importSave(text) {
  const d = JSON.parse(text);
  const s = d.save || d;
  if (!s || typeof s !== 'object' || !('balls' in s) || !('coins' in s)) throw new Error('Not a valid Neon Ball Battle backup');
  SAVE = mergeDeep(defaultSave(), s);
  if (SAVE.admin.pin) SAVE.admin.loggedIn = false;
  persist(true);
}
function downloadText(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* =====================================================================
   3. PROCEDURAL AUDIO
   ===================================================================== */
const Sound = {
  ctx: null, master: null, sfxGain: null, musicGain: null, last: {}, musicOn: false, musicTimer: 0, step: 0, nextT: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate * 0.6;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolume();
    } catch (e) { this.ctx = null; }
  },
  applyVolume() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = SAVE.settings.sfx;
    this.musicGain.gain.value = SAVE.settings.musicOn ? SAVE.settings.music * 0.5 : 0;
  },
  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0, dest) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  },
  noiseHit(dur, vol = 0.3, freq = 1200, q = 1, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t); s.stop(t + dur + 0.02);
  },
  play(name, p = 1, prof) {
    if (!this.ctx || SAVE.settings.sfx <= 0) return;
    if (BATTLE && BATTLE.cfg.demo && !BATTLE.cfg.loud && !['click', 'coin', 'evolve', 'win', 'lose', 'heal'].includes(name)) return;
    const tnow = performance.now();
    const minGap = { bounce: 45, hit: 50, crit: 90, skill: 60, beam: 80, boom: 90, click: 30, portal: 140, portalclose: 120, summon: 150, turret: 90, missile: 70, laser: 120, robot: 120, mech: 120, emp: 200, void: 120, absorb: 80, reverse: 80, titan: 300, holo: 150, repair: 300, overheat: 400, skynet: 500 }[name] || 60;
    if (this.last[name] && tnow - this.last[name] < minGap) return;
    this.last[name] = tnow;
    switch (name) {
      case 'bounce': this.tone(180 + p * 160, 0.07, 'sine', 0.12); break;
      case 'hit': this.tone(140, 0.12, 'triangle', 0.3, 0.5); this.noiseHit(0.09, 0.25, 900 + p * 600, 1.5); break;
      case 'crit': this.tone(900, 0.18, 'square', 0.12, 0.35); this.noiseHit(0.2, 0.35, 2500, 0.8); this.tone(90, 0.25, 'sine', 0.4, 0.5); break;
      case 'skill': { const w = prof?.wave || 'sawtooth', k = prof?.pitch || 1; this.tone(320 * k, 0.2, w, 0.08, 2.4); this.tone(640 * k, 0.15, 'sine', 0.08, 1.8, 0.03); break; }
      case 'ult': { const w = prof?.wave || 'sawtooth', k = prof?.pitch || 1; [1, 1.26, 1.5, 2].forEach((m, i) => this.tone(196 * k * m, 0.6, w, 0.07, 1, i * 0.07)); this.noiseHit(0.5, 0.2, 800 * k, 0.8); break; }
      case 'beam': { const k = prof?.pitch || 1; this.tone(220 * k, 0.45, prof?.wave || 'sawtooth', 0.09, 1.6); this.noiseHit(0.4, 0.12, 3000, 2); break; }
      case 'boom': this.tone(70, 0.6, 'sine', 0.5, 0.4); this.noiseHit(0.55, 0.4, 500, 0.6); break;
      case 'zap': this.noiseHit(0.18, 0.3, 4000, 3); this.tone(1200, 0.1, 'square', 0.07, 0.3); break;
      case 'heal': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.1, 1, i * 0.06)); break;
      case 'shield': this.tone(440, 0.35, 'triangle', 0.12, 1.5); break;
      case 'rage': this.tone(60, 0.8, 'sawtooth', 0.25, 1.8); this.noiseHit(0.7, 0.25, 300, 0.7); break;
      case 'god': [261, 329, 392, 523, 659].forEach((f, i) => this.tone(f, 1.4, 'sine', 0.09, 1, i * 0.08)); this.tone(55, 1.5, 'sawtooth', 0.15, 2); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, 1, i * 0.11)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.13, 1, i * 0.15)); break;
      case 'click': this.tone(660, 0.05, 'sine', 0.08); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.06); this.tone(1318, 0.15, 'square', 0.06, 1, 0.07); break;
      case 'death': this.tone(300, 0.9, 'sawtooth', 0.2, 0.15); this.noiseHit(0.8, 0.4, 700, 0.5); break;
      case 'portal': this.noiseHit(0.5, 0.2, 520, 0.6); this.tone(150, 0.55, 'sine', 0.2, 3.4); this.tone(75, 0.6, 'sawtooth', 0.05, 2.2); break;
      case 'portalclose': this.tone(600, 0.4, 'sine', 0.12, 0.22); this.noiseHit(0.3, 0.14, 900, 0.8); break;
      case 'summon': [196, 247, 294, 392].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.08, 1.02, i * 0.05)); this.noiseHit(0.4, 0.15, 700, 0.7); break;
      case 'clone': [880, 1175, 1568, 2093].forEach((f, i) => this.tone(f, 0.28, 'sine', 0.05, 0.98, i * 0.035)); break;
      case 'void': this.tone(220, 0.5, 'sawtooth', 0.1, 0.25); this.noiseHit(0.45, 0.22, 300, 0.7); this.tone(55, 0.6, 'sine', 0.3, 0.6); break;
      case 'nullzone': this.tone(70, 0.9, 'sawtooth', 0.12, 0.7); this.tone(140, 0.9, 'sine', 0.1, 0.5); this.noiseHit(0.8, 0.12, 200, 0.5); break;
      case 'absorb': this.tone(900, 0.35, 'sine', 0.1, 0.3); this.tone(300, 0.4, 'triangle', 0.1, 0.4, 0.05); break;
      case 'reverse': this.tone(500, 0.18, 'square', 0.07, 2.2); this.tone(1000, 0.2, 'sine', 0.08, 0.5, 0.06); break;
      case 'antievo': [784, 659, 523, 392, 262].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.06, 0.9, i * 0.05)); break;
      case 'robot': [1200, 900, 1500, 1100].forEach((f, i) => this.tone(f, 0.06, 'square', 0.05, 1, i * 0.05)); this.tone(180, 0.25, 'sawtooth', 0.08, 1.6); break;
      case 'mech': this.tone(110, 0.35, 'sawtooth', 0.12, 1.8); this.noiseHit(0.25, 0.15, 1800, 2, 0.05); this.tone(80, 0.3, 'square', 0.08, 0.7, 0.12); break;
      case 'missile': this.noiseHit(0.45, 0.2, 1500, 0.7); this.tone(400, 0.4, 'sawtooth', 0.05, 0.4); break;
      case 'laser': this.tone(1800, 0.3, 'sawtooth', 0.06, 0.4); this.tone(900, 0.35, 'square', 0.05, 0.6, 0.02); break;
      case 'emp': this.tone(60, 0.7, 'square', 0.25, 0.5); this.noiseHit(0.5, 0.3, 5000, 2); this.tone(2400, 0.25, 'sawtooth', 0.05, 0.2); break;
      case 'turret': this.tone(1400, 0.05, 'square', 0.04, 0.6); this.noiseHit(0.05, 0.08, 3500, 3); break;
      case 'overclock': [220, 330, 440, 660, 880].forEach((f, i) => this.tone(f, 0.16, 'sawtooth', 0.06, 1.4, i * 0.04)); break;
      case 'overheat': this.noiseHit(0.9, 0.25, 6000, 0.5); this.tone(300, 0.6, 'triangle', 0.08, 0.5); break;
      case 'repair': [440, 554, 659, 880, 1108].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, 1, i * 0.07)); this.tone(220, 0.4, 'square', 0.04, 1.2); break;
      case 'titan': this.tone(45, 1.2, 'sawtooth', 0.35, 0.6); this.noiseHit(1.0, 0.45, 250, 0.5); [110, 165, 220].forEach((f, i) => this.tone(f, 0.8, 'square', 0.06, 1, 0.1 + i * 0.1)); break;
      case 'holo': [1318, 1760, 2093].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.05, 0.8, i * 0.04)); this.noiseHit(0.2, 0.06, 7000, 2); break;
      case 'trapset': this.tone(700, 0.12, 'square', 0.05, 1.5); this.tone(1400, 0.12, 'square', 0.04, 1, 0.1); break;
      case 'skynet': [880, 660, 880, 660].forEach((f, i) => this.tone(f, 0.18, 'square', 0.07, 1, i * 0.18)); this.tone(55, 1.4, 'sawtooth', 0.2, 1.5); break;
      case 'evolve': [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, 1, i * 0.09)); break;
    }
  },
  /* tiny procedural synthwave loop */
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true; this.nextT = this.ctx.currentTime + 0.1; this.step = 0;
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const prog = [45, 41, 43, 40];                      // A F G E (midi roots)
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const tick = () => {
      if (!this.musicOn) return;
      while (this.nextT < this.ctx.currentTime + 0.25) {
        const s = this.step, bar = Math.floor(s / 16) % 4, root = prog[bar];
        const dt = this.nextT - this.ctx.currentTime;
        if (s % 4 === 0) this.tone(mtof(root - 12), 0.32, 'sawtooth', 0.12, 1, dt, this.musicGain);
        if (s % 2 === 0) this.tone(mtof(root + 12 + scale[(s * 3 + bar) % scale.length]), 0.14, 'triangle', 0.05, 1, dt, this.musicGain);
        if (s % 8 === 4) { const c = this.ctx, t = this.nextT, src = c.createBufferSource(); src.buffer = this.noise; const g = c.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); src.connect(g); g.connect(this.musicGain); src.start(t); src.stop(t + 0.1); }
        this.nextT += 0.125; this.step++;
      }
      this.musicTimer = setTimeout(tick, 60);
    };
    tick();
  },
  stopMusic() { this.musicOn = false; clearTimeout(this.musicTimer); },
};

/* =====================================================================
   4. BALL DATABASE
   Every entry is a spherical BALL. design = procedural look:
   c1 base colour, c2 accent, c3 glow, pat surface pattern,
   deco floating attachments (never limbs / humanoid parts), sym symbol.
   ===================================================================== */
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Ancient', 'Secret', 'Limited', 'God Tier', 'Admin Exclusive'];
const RARITY_INFO = {
  'Common': { col: '#b0bec5', price: 300 }, 'Uncommon': { col: '#69f0ae', price: 600 }, 'Rare': { col: '#40c4ff', price: 1000 },
  'Epic': { col: '#d500f9', price: 1800 }, 'Legendary': { col: '#ffab00', price: 3000 }, 'Mythical': { col: '#ff4081', price: 4500 },
  'Ancient': { col: '#ff6e40', price: 6000 }, 'Secret': { col: '#00e5ff', price: 8000 }, 'Limited': { col: '#ff1744', price: 2500 },
  'God Tier': { col: '#ffd740', price: 10000 }, 'Admin Exclusive': { col: '#e040fb', price: 0 },
};
const rarClass = r => 'rar-' + String(r).replace(/\s+/g, '');
/* each ball has its own sound signature (explicit in design.sfx, or derived from its id) */
function sfxOf(def) { const s = def.design && def.design.sfx; if (s && s.wave) return s; const hh = hashStr(def.id || 'x'); return { wave: ['sine', 'triangle', 'square', 'sawtooth'][hh % 4], pitch: 0.6 + (hh % 100) / 90 }; }
const CATEGORIES = ['Elemental', 'Special', 'Cosmic', 'Mythical', 'Secret', 'Limited', 'Premium', 'Tech', 'Admin', 'Custom', 'Fusion'];
const PATTERNS = ['solid', 'flame', 'ice', 'storm', 'water', 'earth', 'wind', 'radiant', 'darkness', 'toxic', 'plasma', 'web', 'grid', 'rings',
  'blood', 'stitches', 'nuclear', 'crystal', 'vortex', 'magnet', 'smoke', 'galaxy', 'blackhole', 'nebula', 'portal', 'clock', 'atom', 'eclipse',
  'constellation', 'scales', 'feather', 'eye', 'holy', 'chaos', 'runes', 'infinity', 'multiverse', 'genesis', 'cracks', 'glitch', 'souls',
  'yinyang', 'unknown', 'moon', 'aurora', 'sun', 'petals', 'stripes', 'spots', 'swirl', 'hex',
  'omega', 'phantom', 'core', 'void', 'maw', 'prism', 'mirror', 'reactor', 'sonic', 'magnetar', 'rift', 'starscale', 'miracle', 'dimensional', 'cell', 'bread', 'anti', 'mecha', 'circuit'];
const DECOS = ['ring', 'halo', 'crown', 'wings', 'sixwings', 'batwings', 'horns', 'spikes', 'orbit', 'crystals', 'flames', 'fangs', 'armor', 'eyes', 'portals', 'motes', 'holo', 'antenna'];
const AI_TYPES = ['aggressive', 'defensive', 'tactical', 'intelligent', 'adaptive', 'boss'];
const EFFECTS = ['none', 'burn', 'freeze', 'poison', 'stun', 'slow', 'weaken', 'drain', 'random'];
const SKILL_TYPES = {
  projectile: { ico: '●', label: 'Projectile', desc: 'Fires a glowing energy orb' },
  multishot: { ico: '⁂', label: 'Multi-Shot', desc: 'Fires a spread of orbs' },
  homing: { ico: '➹', label: 'Homing Orbs', desc: 'Orbs that track the target' },
  beam: { ico: '═', label: 'Laser Beam', desc: 'Charged neon beam to the wall' },
  shockwave: { ico: '◎', label: 'Shockwave', desc: 'Expanding energy ring with knockback' },
  explosion: { ico: '✸', label: 'Explosion', desc: 'Instant burst around the ball' },
  dash: { ico: '➤', label: 'Power Dash', desc: 'High-speed ram, double collision damage' },
  shield: { ico: '⬡', label: 'Shield', desc: 'Temporary damage reduction barrier' },
  heal: { ico: '✚', label: 'Heal', desc: 'Restores HP and cleanses effects' },
  trap: { ico: '⌗', label: 'Trap Zone', desc: 'Places a slowing hazard zone' },
  gravity: { ico: '◉', label: 'Gravity Pull', desc: 'Pulls enemies toward the ball' },
  lightning: { ico: 'ϟ', label: 'Lightning Strike', desc: 'Delayed strike on the target' },
  meteor: { ico: '☄', label: 'Meteor Rain', desc: 'Meteors crash around the target' },
  clone: { ico: '◐', label: 'Energy Clone', desc: 'Temporary energy duplicate sphere' },
  orbitals: { ico: '⊛', label: 'Orbitals', desc: 'Damaging orbs circle the ball' },
  timestop: { ico: '⌛', label: 'Time Stop', desc: 'Freezes enemies in time' },
  teleport: { ico: '⇝', label: 'Teleport Strike', desc: 'Blinks behind the target and strikes' },
  buff: { ico: '▲', label: 'Power Up', desc: 'Boosts attack and speed' },
  copy: { ico: '⧉', label: 'Copy', desc: 'Copies an enemy ability temporarily' },
  adaptive: { ico: '♺', label: 'Adaptive', desc: 'Analyses the enemy and adapts strategy' },
  resurrect: { ico: '✟', label: 'Resurrection', desc: 'Once per battle: revive / restore HP' },
  phase: { ico: '◌', label: 'Phase / Invisibility', desc: 'Turns intangible to abilities and leaves an illusion' },
  reflect: { ico: '⟲', label: 'Reflect', desc: 'Sends enemy projectiles back and halves beam damage' },
  portalgate: { ico: '⭘', label: 'Portal Gate', desc: 'Opens a portal in front of itself and one behind the enemy, then strikes through it' },
  dimescape: { ico: '⇱', label: 'Dimensional Escape', desc: 'Leaves the arena through a portal (untouchable) and returns through another' },
  summon: { ico: '⚇', label: 'Ball Summon', desc: 'Summons other balls through portals to fight for a while' },
  clonearmy: { ico: '⧈', label: 'Clone Army', desc: 'Creates several temporary clones, some disguised as other balls' },
  nullzone: { ico: '⊘', label: 'Null Zone', desc: 'A dark field around the ball: enemies inside deal less damage, and their abilities and projectiles are weakened' },
  absorb: { ico: '◉', label: 'Power Absorb', desc: 'Swallows some incoming energy projectiles (not ultimates or missiles) and stores the energy to power up its next attack' },
  reverse: { ico: '⇄', label: 'Reverse Impact', desc: 'For a short time, sends a limited number of enemy projectiles back at whoever fired them (not ultimates)' },
  minihole: { ico: '◍', label: 'Mini Black Hole', desc: 'A small gravitational vortex that pulls enemies in and deals controlled damage' },
  voidtp: { ico: '⤧', label: 'Void Teleport', desc: 'Vanishes into a dark distortion and reappears a short distance away, slowing enemies at the exit' },
  antievo: { ico: '⇣', label: 'Anti Evolution', desc: 'For a few seconds, cancels nearby enemies’ evolution, rage, God Mode and power-up bonuses (bosses: shorter)' },
  robots: { ico: '⚉', label: 'Robot Summon', desc: 'Deploys small combat robots that hunt enemies, shoot and follow their commander' },
  factory: { ico: '⌂', label: 'Mecha Factory', desc: 'Builds a robot factory that produces extra robots over time; it can be destroyed' },
  missiles: { ico: '➹', label: 'Missile Barrage', desc: 'Launches tracking missiles that explode on impact' },
  drone: { ico: '⛨', label: 'Defense Drone', desc: 'A drone follows the ball and blocks part of the damage it takes until destroyed' },
  fusionbot: { ico: '⚙', label: 'Robot Fusion', desc: 'Merges 2 or more summoned robots into one larger Mega Robot for a while' },
  lasergrid: { ico: '#', label: 'Laser Grid', desc: 'Laser lines lock around the target; crossing a laser deals damage' },
  hologram: { ico: '◫', label: 'Hologram Clone', desc: 'Two holographic copies mirror the ball’s moves and confuse enemy targeting (weak damage)' },
  emp: { ico: 'ϟ', label: 'EMP Pulse', desc: 'An electromagnetic pulse that briefly disables enemy abilities and shorts out robots and drones' },
  cybertrap: { ico: '⌖', label: 'Cyber Trap', desc: 'A sensor trap that zaps and slows enemies that come close (3 charges)' },
  turret: { ico: '⌯', label: 'Auto Turret', desc: 'Deploys an automatic laser turret that shoots nearby enemies; it can be destroyed' },
  overclock: { ico: '⏫', label: 'Overclock Mode', desc: 'Faster movement, attacks and cooldowns for a while — but abilities build heat 50% faster' },
};
const ULT_TYPES = {
  nova: 'Giant energy nova', supernova: 'Charged mega explosion', barrage: 'Spiral homing barrage', megabeam: 'Sustained mega beam',
  blackhole: 'Black hole vortex', meteorstorm: 'Meteor storm', storm: 'Lightning storm', judgment: 'Pillars of light', timestop: 'World freeze',
  swarm: 'Clone swarm', omniversal: 'Omniversal Supremacy (special)', apocalypse: 'Divine Apocalypse (special)',
  collapse: 'Omega Collapse — imploding singularity', phantomdim: 'Phantom Dimension — illusions & invisibility', infinitecore: 'Infinite Core — fortress & regeneration',
  infiniteportal: 'Infinite Portal — portal ring, summons, clones and a coordinated attack',
  absolutezero: 'Absolute Zero — anti-energy wave that suppresses enemy abilities', titan: 'Titan Overdrive — a giant battle robot joins the fight', skynet: 'Skynet Protocol — drones, turrets, synchronized lasers and volleys',
  chaoseruption: 'Chaos Eruption — random elemental storm', dragonnova: 'Dragon Nova — celestial fire & meteors', miracle: 'Miracle Overdrive — heal, cleanse & radiant blast',
};

function S(name, type, cd, power, color, effect = 'none', count) { const s = { name, type, cd, power, color, effect }; if (count) s.count = count; return s; }
function U(name, type, power, color, effect = 'none') { return { name, type, power, color, effect }; }
function B(id, name, category, rarity, st, design, skills, ult, ai, extra = {}) {
  return Object.assign({ id, name, category, rarity, hp: st[0], atk: st[1], def: st[2], spd: st[3], crit: st[4], design, skills, ult, ai, enabled: true }, extra);
}
const D = (c1, c2, c3, pat, deco = [], sym = '', extra = {}) => Object.assign({ c1, c2, c3, pat, deco, sym, glow: 1 }, extra);

const BUILTIN_BALLS = [
  /* ---------------- ELEMENTAL ---------------- */
  B('fire', 'Fire Ball', 'Elemental', 'Common', [100, 52, 40, 60, 15], D('#ff5a1f', '#ffd23f', '#ff7b00', 'flame', ['flames']),
    [S('Fireball', 'projectile', 4, 45, '#ff7b00', 'burn'), S('Flame Dash', 'dash', 6, 40, '#ff4500', 'burn'), S('Inferno Ring', 'shockwave', 9, 50, '#ff9100', 'burn')],
    U('Meteor Inferno', 'meteorstorm', 70, '#ff5a1f', 'burn'), 'aggressive', { desc: 'A blazing sphere of living flame that burns everything it touches.' }),
  B('ice', 'Ice Ball', 'Elemental', 'Common', [105, 45, 55, 52, 12], D('#7fe7ff', '#e8fbff', '#4cc9ff', 'ice', ['crystals']),
    [S('Ice Shards', 'multishot', 5, 35, '#9ff3ff', 'freeze', 3), S('Frost Armor', 'shield', 10, 50, '#bdf6ff'), S('Blizzard Trap', 'trap', 9, 40, '#7fe7ff', 'freeze')],
    U('Absolute Zero', 'timestop', 60, '#bdf6ff'), 'defensive', { desc: 'A frozen orb that slows enemies to a crawl.' }),
  B('thunder', 'Thunder Ball', 'Elemental', 'Uncommon', [95, 55, 38, 72, 20], D('#ffe14d', '#ffffff', '#ffd000', 'storm', ['orbit']),
    [S('Lightning Strike', 'lightning', 5, 50, '#fff27a', 'stun'), S('Volt Dash', 'dash', 6, 45, '#ffe14d', 'stun'), S('Chain Spark', 'homing', 7, 35, '#fffbcc', 'stun', 3)],
    U('Thunder God Storm', 'storm', 70, '#ffe14d', 'stun'), 'aggressive', { desc: 'Crackling with millions of volts. Fast and shocking.' }),
  B('water', 'Water Ball', 'Elemental', 'Common', [110, 44, 50, 56, 10], D('#1e90ff', '#8fd3ff', '#00b4ff', 'water', ['orbit']),
    [S('Water Jet', 'beam', 6, 40, '#4fc3ff', 'slow'), S('Healing Tide', 'heal', 12, 35, '#8fd3ff'), S('Tidal Wave', 'shockwave', 8, 45, '#1e90ff', 'slow')],
    U('Tsunami', 'nova', 65, '#00b4ff', 'slow'), 'defensive', { desc: 'Flowing, adaptable and hard to pin down.' }),
  B('earth', 'Earth Ball', 'Elemental', 'Common', [130, 48, 70, 40, 10], D('#8b5a2b', '#5fa83b', '#c08a4a', 'earth', ['spikes']),
    [S('Rock Throw', 'projectile', 4.5, 45, '#c08a4a', 'stun'), S('Stone Skin', 'shield', 11, 55, '#a0784a'), S('Earthquake', 'explosion', 9, 50, '#8b5a2b', 'slow')],
    U('Tectonic Crush', 'meteorstorm', 70, '#a0522d', 'stun'), 'tactical', { desc: 'A heavy boulder sphere. Slow, tough and crushing.' }),
  B('wind', 'Wind Ball', 'Elemental', 'Uncommon', [90, 46, 36, 85, 18], D('#a8ffcf', '#ffffff', '#5effa8', 'wind', ['orbit']),
    [S('Gale Blades', 'multishot', 4, 30, '#c8ffe4', 'none', 3), S('Tailwind', 'buff', 9, 50, '#5effa8'), S('Cyclone', 'gravity', 10, 40, '#a8ffcf')],
    U('Hurricane Fury', 'barrage', 65, '#5effa8'), 'tactical', { desc: 'The fastest of the elements, cutting like a storm.' }),
  B('light', 'Light Ball', 'Elemental', 'Rare', [100, 55, 45, 70, 20], D('#fffbe0', '#ffe066', '#fff4a3', 'radiant', ['halo']),
    [S('Light Ray', 'beam', 5, 50, '#fff4a3'), S('Flash Blind', 'explosion', 8, 30, '#ffffff', 'stun'), S('Radiant Heal', 'heal', 12, 30, '#fff9c4')],
    U('Solar Judgment', 'judgment', 70, '#ffe066'), 'intelligent', { desc: 'Pure radiance condensed into a perfect sphere.' }),
  B('dark', 'Dark Ball', 'Elemental', 'Rare', [100, 58, 45, 62, 22], D('#2a0b3d', '#8a2be2', '#9d4dff', 'darkness', ['orbit']),
    [S('Shadow Orb', 'homing', 4.5, 40, '#9d4dff', 'weaken', 1), S('Void Pulse', 'shockwave', 8, 45, '#7b2cff', 'weaken'), S('Dark Drain', 'projectile', 9, 35, '#b388ff', 'drain')],
    U('Eternal Night', 'blackhole', 70, '#6a00ff', 'weaken'), 'aggressive', { desc: 'Darkness that devours light and hope.' }),
  B('poison', 'Poison Ball', 'Elemental', 'Uncommon', [100, 45, 48, 58, 15], D('#7cff3a', '#2c5f0f', '#9dff00', 'toxic', ['orbit']),
    [S('Venom Spit', 'multishot', 4.5, 30, '#9dff00', 'poison', 3), S('Toxic Pool', 'trap', 8, 30, '#7cff3a', 'poison'), S('Plague Burst', 'explosion', 10, 35, '#b2ff59', 'poison')],
    U('Pandemic', 'barrage', 60, '#9dff00', 'poison'), 'tactical', { desc: 'Bubbling with deadly toxins.' }),
  B('plasma', 'Plasma Ball', 'Elemental', 'Rare', [95, 62, 40, 70, 22], D('#ff3cf2', '#3cf0ff', '#ff5cf7', 'plasma', ['ring']),
    [S('Plasma Bolt', 'projectile', 4, 50, '#ff5cf7', 'burn'), S('Plasma Field', 'orbitals', 9, 35, '#3cf0ff'), S('Ion Cannon', 'beam', 7, 55, '#ff3cf2')],
    U('Plasma Overload', 'supernova', 75, '#ff3cf2', 'burn'), 'intelligent', { desc: 'Superheated ionised energy contained in a sphere.' }),

  /* ---------------- SPECIAL ---------------- */
  B('spider', 'Spider Ball', 'Special', 'Rare', [105, 52, 48, 66, 20], D('#1a1a1a', '#ff2a2a', '#ff3355', 'web', ['spikes']),
    [S('Web Shot', 'projectile', 4, 30, '#ffffff', 'slow'), S('Web Trap', 'trap', 7, 25, '#ffffff', 'slow'), S('Venom Fang', 'dash', 7, 45, '#ff3355', 'poison')],
    U('Web Prison', 'timestop', 55, '#ffffff'), 'tactical', { desc: 'Weaves sticky neon webs to trap its prey.' }),
  B('laser', 'Laser Ball', 'Special', 'Epic', [95, 65, 42, 68, 25], D('#ff0040', '#ffffff', '#ff1050', 'grid', ['ring']),
    [S('Laser Beam', 'beam', 4.5, 55, '#ff1050'), S('Laser Grid', 'multishot', 7, 30, '#ff4d79', 'none', 5), S('Overcharge', 'buff', 10, 50, '#ff0040')],
    U('Death Ray', 'megabeam', 85, '#ff0040', 'burn'), 'tactical', { desc: 'A precision weapon sphere that fires focused lasers.' }),
  B('judgment', 'Judgment Ball', 'Special', 'Epic', [110, 60, 55, 60, 25], D('#f5f5f5', '#ffcc00', '#ffe680', 'rings', ['halo'], '⚖'),
    [S('Verdict Beam', 'beam', 6, 55, '#ffe680', 'stun'), S('Sentence', 'lightning', 6, 50, '#ffcc00'), S('Penance', 'explosion', 9, 35, '#fff3b0', 'weaken')],
    U('Final Judgment', 'judgment', 80, '#ffcc00', 'stun'), 'intelligent', { desc: 'Weighs every opponent and delivers the verdict.' }),
  B('vampire', 'Vampire Ball', 'Special', 'Epic', [100, 58, 45, 65, 22], D('#5a0010', '#ff1a3c', '#ff0033', 'blood', ['batwings', 'fangs']),
    [S('Blood Drain', 'projectile', 5, 45, '#ff1a3c', 'drain'), S('Bat Swarm', 'homing', 7, 25, '#b0002a', 'drain', 4), S('Crimson Dash', 'dash', 6, 45, '#ff0033', 'drain')],
    U('Blood Moon Feast', 'nova', 75, '#ff0033', 'drain'), 'aggressive', { desc: 'Feeds on the energy of other balls to heal itself.' }),
  B('zombie', 'Zombie Ball', 'Special', 'Uncommon', [140, 45, 50, 42, 10], D('#6b8e23', '#3d4f1a', '#9acd32', 'stitches'),
    [S('Rot Bite', 'dash', 6, 40, '#9acd32', 'poison'), S('Infect', 'projectile', 5, 30, '#9acd32', 'poison'), S('Rise Again', 'resurrect', 1, 30, '#c5e1a5')],
    U('Undead Horde', 'swarm', 50, '#9acd32', 'poison'), 'aggressive', { desc: 'Stitched together and refuses to stay down.' }),
  B('nuclear', 'Nuclear Ball', 'Special', 'Legendary', [100, 72, 45, 58, 25], D('#c6ff00', '#1a1a1a', '#d4ff00', 'nuclear', ['orbit']),
    [S('Radiation Leak', 'trap', 8, 35, '#d4ff00', 'poison'), S('Fission Bolt', 'projectile', 5, 55, '#eeff41', 'burn'), S('Meltdown', 'explosion', 10, 60, '#c6ff00', 'burn')],
    U('Nuclear Detonation', 'supernova', 95, '#d4ff00', 'burn'), 'aggressive', { desc: 'Unstable. Radioactive. Explosive.' }),
  B('crystal', 'Crystal Ball', 'Special', 'Rare', [110, 50, 65, 55, 30], D('#d58cff', '#7ef9ff', '#e0a8ff', 'crystal', ['crystals']),
    [S('Crystal Shards', 'multishot', 5, 30, '#e0a8ff', 'none', 4), S('Prism Shield', 'shield', 10, 60, '#7ef9ff'), S('Refraction Beam', 'beam', 7, 45, '#d58cff')],
    U('Diamond Storm', 'barrage', 70, '#e0a8ff'), 'defensive', { desc: 'Faceted gem sphere that refracts all energy.' }),
  B('gravity', 'Gravity Ball', 'Special', 'Epic', [115, 55, 60, 50, 18], D('#1b1b3a', '#6c63ff', '#7b6cff', 'vortex', ['ring']),
    [S('Gravity Well', 'gravity', 8, 40, '#7b6cff'), S('Crush', 'explosion', 8, 50, '#6c63ff', 'stun'), S('Mass Shift', 'dash', 7, 50, '#9d97ff')],
    U('Singularity', 'blackhole', 80, '#6c63ff'), 'tactical', { desc: 'Bends space around itself.' }),
  B('magnet', 'Magnet Ball', 'Special', 'Rare', [105, 52, 55, 60, 18], D('#d62828', '#1d4ed8', '#ff4d6d', 'magnet', ['orbit']),
    [S('Magnetic Pull', 'gravity', 7, 35, '#ff4d6d'), S('Polarity Shot', 'homing', 5, 40, '#5b8cff', 'none', 2), S('Repulse', 'shockwave', 8, 45, '#ff4d6d')],
    U('Electromagnetic Pulse', 'nova', 70, '#5b8cff', 'stun'), 'intelligent', { desc: 'Attracts and repels with polar force.' }),
  B('shadow', 'Shadow Ball', 'Special', 'Epic', [95, 62, 40, 78, 30], D('#0b0b12', '#4b2a7a', '#6a00ff', 'smoke'),
    [S('Shadow Step', 'teleport', 6, 45, '#6a00ff'), S('Shadow Clone', 'clone', 12, 30, '#4b2a7a'), S('Night Blades', 'multishot', 5, 35, '#9d4dff', 'none', 3)],
    U('Shadow Realm', 'timestop', 65, '#4b2a7a'), 'tactical', { desc: 'Strikes from the darkness, never where you expect.' }),

  /* ---------------- COSMIC ---------------- */
  B('galaxy', 'Galaxy Ball', 'Cosmic', 'Legendary', [110, 65, 55, 62, 25], D('#120a2e', '#ff6ec7', '#8a5cff', 'galaxy', ['orbit']),
    [S('Star Burst', 'multishot', 5, 30, '#ff6ec7', 'none', 5), S('Cosmic Ray', 'beam', 6, 55, '#8a5cff'), S('Nebula Shield', 'shield', 11, 55, '#c77dff')],
    U('Galactic Collapse', 'blackhole', 85, '#8a5cff'), 'intelligent', { desc: 'An entire spiral galaxy compressed into one ball.' }),
  B('blackhole', 'Black Hole Ball', 'Cosmic', 'Mythical', [120, 70, 60, 55, 25], D('#000000', '#ff8c00', '#ff6a00', 'blackhole', ['ring']),
    [S('Event Horizon', 'gravity', 7, 50, '#ff8c00'), S('Spaghettify', 'beam', 7, 55, '#ff6a00'), S('Hawking Burst', 'shockwave', 9, 50, '#ffb74d')],
    U('Singularity Consume', 'blackhole', 95, '#ff6a00'), 'tactical', { desc: 'Nothing escapes its pull, not even light.', godMode: true }),
  B('universe', 'Universe Ball', 'Cosmic', 'Mythical', [120, 70, 62, 60, 25], D('#0a0f3c', '#00e5ff', '#4d7cff', 'galaxy', ['ring', 'orbit']),
    [S('Big Bang', 'explosion', 9, 60, '#00e5ff'), S('Starfall', 'meteor', 7, 50, '#4d7cff'), S('Cosmic Expansion', 'shockwave', 8, 45, '#80d8ff')],
    U('Universal Reset', 'supernova', 90, '#00e5ff'), 'intelligent', { desc: 'Contains all of space and time.', godMode: true }),
  B('star', 'Star Ball', 'Cosmic', 'Legendary', [105, 66, 50, 66, 28], D('#fff3b0', '#ff9f1c', '#ffd166', 'radiant', ['orbit'], '★'),
    [S('Star Shot', 'homing', 5, 35, '#ffd166', 'none', 3), S('Solar Flare', 'explosion', 8, 50, '#ff9f1c', 'burn'), S('Starlight Heal', 'heal', 12, 30, '#fff3b0')],
    U('Supernova', 'supernova', 85, '#ffd166', 'burn'), 'aggressive', { desc: 'A newborn star burning with infinite fusion.' }),
  B('nebula', 'Nebula Ball', 'Cosmic', 'Legendary', [110, 60, 55, 62, 22], D('#5b2a86', '#ff7eb6', '#c77dff', 'nebula', ['orbit']),
    [S('Nebula Cloud', 'trap', 7, 35, '#ff7eb6', 'slow'), S('Stardust Barrage', 'multishot', 5, 28, '#c77dff', 'none', 4), S('Gas Giant', 'gravity', 9, 40, '#ff7eb6')],
    U('Stellar Nursery', 'barrage', 75, '#c77dff'), 'tactical', { desc: 'A colourful cloud where stars are born.' }),
  B('dimension', 'Dimension Ball', 'Cosmic', 'Mythical', [110, 68, 55, 70, 25], D('#00ffd5', '#ff00aa', '#00ffd5', 'portal', ['ring']),
    [S('Dimension Rift', 'teleport', 6, 50, '#00ffd5'), S('Portal Shot', 'homing', 5, 45, '#ff00aa', 'none', 2), S('Space Fold', 'shockwave', 8, 50, '#00ffd5')],
    U('Dimensional Collapse', 'megabeam', 85, '#ff00aa'), 'adaptive', { desc: 'Walks between dimensions at will.', godMode: true }),
  B('time', 'Time Ball', 'Cosmic', 'Mythical', [110, 62, 58, 65, 25], D('#c9a227', '#1d1d1d', '#ffd700', 'clock', ['ring']),
    [S('Time Stop', 'timestop', 12, 40, '#ffd700'), S('Rewind', 'heal', 12, 35, '#ffe082'), S('Chrono Bolt', 'projectile', 4.5, 50, '#ffd700', 'slow')],
    U('Eternity Freeze', 'timestop', 90, '#ffd700'), 'intelligent', { desc: 'Master of past, present and future.', godMode: true }),
  B('quantum', 'Quantum Ball', 'Cosmic', 'Legendary', [100, 64, 50, 75, 30], D('#00f5ff', '#7b2cbf', '#00f5ff', 'atom', ['orbit']),
    [S('Quantum Tunnel', 'teleport', 6, 45, '#00f5ff'), S('Superposition', 'clone', 12, 30, '#7b2cbf'), S('Particle Beam', 'beam', 6, 55, '#00f5ff')],
    U('Quantum Entanglement', 'barrage', 80, '#00f5ff'), 'adaptive', { desc: 'Exists in every position at once.' }),
  B('eclipse', 'Eclipse Ball', 'Cosmic', 'Legendary', [110, 66, 55, 62, 25], D('#0d0d0d', '#ffb703', '#ff9500', 'eclipse', ['halo']),
    [S('Corona Blast', 'shockwave', 8, 50, '#ffb703', 'burn'), S('Umbra', 'shield', 10, 50, '#ff9500'), S('Eclipse Beam', 'beam', 6, 55, '#ffb703')],
    U('Total Eclipse', 'judgment', 85, '#ff9500'), 'tactical', { desc: 'When sun and moon align, it awakens.' }),
  B('celestial', 'Celestial Ball', 'Cosmic', 'Mythical', [115, 66, 62, 62, 28], D('#e0f7ff', '#7ec8ff', '#bde0fe', 'constellation', ['halo', 'orbit']),
    [S('Star Lance', 'beam', 6, 55, '#bde0fe'), S('Constellation', 'homing', 6, 30, '#7ec8ff', 'none', 4), S('Heavenly Barrier', 'shield', 11, 55, '#e0f7ff')],
    U('Celestial Rain', 'meteorstorm', 85, '#7ec8ff'), 'intelligent', { desc: 'Woven from the constellations of the night sky.', godMode: true }),

  /* ---------------- MYTHICAL ---------------- */
  B('dragon', 'Dragon Ball', 'Mythical', 'Mythical', [125, 72, 62, 62, 25], D('#b91c1c', '#fbbf24', '#ff4500', 'scales', ['horns', 'batwings']),
    [S('Dragon Breath', 'beam', 6, 55, '#ff4500', 'burn'), S('Dragon Dash', 'dash', 6, 55, '#fbbf24', 'burn'), S('Dragon Scales', 'shield', 11, 55, '#b91c1c')],
    U('Dragon Emperor Inferno', 'supernova', 95, '#ff4500', 'burn'), 'aggressive', { desc: 'An armoured sphere of draconic scales and fire.', godMode: true }),
  B('phoenix', 'Phoenix Ball', 'Mythical', 'Mythical', [105, 68, 50, 72, 25], D('#ff6d00', '#ffd600', '#ff9100', 'feather', ['wings', 'flames']),
    [S('Phoenix Feathers', 'multishot', 5, 35, '#ffd600', 'burn', 3), S('Rebirth', 'resurrect', 1, 50, '#ffab40'), S('Blaze Dive', 'dash', 6, 55, '#ff6d00', 'burn')],
    U('Eternal Flame', 'meteorstorm', 85, '#ff9100', 'burn'), 'aggressive', { desc: 'Rises from its own ashes.', godMode: true }),
  B('demon', 'Demon Ball', 'Mythical', 'Ancient', [120, 76, 58, 64, 28], D('#3b0000', '#ff0000', '#ff1a1a', 'eye', ['horns', 'batwings']),
    [S('Hellfire', 'projectile', 4.5, 55, '#ff1a1a', 'burn'), S('Demonic Pact', 'buff', 10, 60, '#ff0000'), S('Soul Rend', 'projectile', 7, 50, '#ff5252', 'drain')],
    U('Abyssal Apocalypse', 'blackhole', 95, '#ff1a1a', 'burn'), 'aggressive', { desc: 'A cursed sphere from the abyss.', godMode: true }),
  B('angel', 'Angel Ball', 'Mythical', 'Mythical', [110, 62, 62, 64, 25], D('#ffffff', '#ffe58f', '#fff1b8', 'feather', ['wings', 'halo']),
    [S('Holy Light', 'beam', 5, 50, '#fff1b8'), S('Blessing', 'heal', 11, 35, '#ffe58f'), S('Guardian Shield', 'shield', 10, 55, '#ffffff')],
    U('Heavenly Choir', 'judgment', 80, '#ffe58f'), 'defensive', { desc: 'A gentle guardian sphere of holy light.' }),
  B('archangel', 'Archangel Ball', 'Mythical', 'Admin Exclusive', [120, 90, 100, 85, 90], D('#fff8e1', '#ffc107', '#ffd54f', 'holy', ['wings', 'crown', 'halo'], '', { glow: 1.5 }),
    [S('DIVINE JUDGMENT', 'beam', 4.5, 85, '#ffd54f', 'stun'), S('CELESTIAL SHIELD', 'shield', 9, 80, '#fff8e1'), S("HEAVEN'S WRATH", 'explosion', 8, 80, '#ffc107', 'burn'), S('RESURRECTION', 'resurrect', 1, 50, '#ffffff')],
    U('DIVINE APOCALYPSE', 'apocalypse', 110, '#ffd54f'), 'intelligent',
    { desc: 'ADMIN EXCLUSIVE / DIVINE GOD. A golden-white sphere with floating celestial wings and a glowing crown.', godMode: true, adminOnly: true, godName: 'DIVINE CELESTIAL SPHERE' }),
  B('seraphim', 'Seraphim Ball', 'Mythical', 'God Tier', [120, 78, 70, 70, 30], D('#fff0f5', '#ff4da6', '#ffb3d9', 'holy', ['sixwings', 'halo']),
    [S('Seraph Flame', 'homing', 5, 50, '#ff4da6', 'burn', 2), S('Sacred Fire Ring', 'shockwave', 8, 55, '#ffb3d9', 'burn'), S('Holy Barrier', 'shield', 10, 60, '#fff0f5')],
    U('Seraphic Purge', 'judgment', 90, '#ff4da6', 'burn'), 'intelligent', { desc: 'Six-winged sphere of burning holiness.', godMode: true }),
  B('chaos', 'Chaos Ball', 'Mythical', 'Ancient', [115, 78, 50, 70, 30], D('#ff006e', '#3a0ca3', '#ff006e', 'chaos', ['spikes', 'orbit']),
    [S('Chaos Bolt', 'projectile', 4, 55, '#ff006e', 'random'), S('Entropy', 'trap', 8, 40, '#3a0ca3', 'weaken'), S('Chaos Rift', 'teleport', 6, 55, '#ff006e')],
    U('Primordial Chaos', 'barrage', 95, '#ff006e', 'random'), 'adaptive', { desc: 'Pure unpredictable disorder.', godMode: true }),
  B('divine', 'Divine Ball', 'Mythical', 'God Tier', [125, 78, 72, 66, 30], D('#fffde7', '#ffd700', '#fff59d', 'radiant', ['halo', 'crown']),
    [S('Divine Ray', 'beam', 5, 60, '#fff59d'), S('Sanctuary', 'heal', 11, 40, '#fffde7'), S('Divine Wrath', 'lightning', 6, 60, '#ffd700', 'stun')],
    U('Divine Intervention', 'judgment', 95, '#ffd700'), 'intelligent', { desc: 'Blessed by the heavens themselves.', godMode: true }),
  B('immortal', 'Immortal Ball', 'Mythical', 'Ancient', [150, 66, 75, 55, 20], D('#2e7d32', '#ffd700', '#69f0ae', 'runes', ['ring']),
    [S('Eternal Body', 'resurrect', 1, 60, '#69f0ae'), S('Undying Strike', 'dash', 6, 55, '#ffd700'), S('Life Bloom', 'heal', 10, 40, '#69f0ae')],
    U('Immortal Ascension', 'nova', 80, '#69f0ae'), 'defensive', { desc: 'It has existed since the dawn of time and cannot die.', godMode: true }),
  B('ancientgod', 'Ancient God Ball', 'Mythical', 'God Tier', [140, 82, 75, 62, 30], D('#5d4037', '#ffb300', '#ffca28', 'runes', ['crown', 'ring', 'orbit']),
    [S('Primordial Ray', 'beam', 5, 65, '#ffca28'), S('Ancient Seal', 'timestop', 12, 45, '#ffb300'), S('Titan Quake', 'explosion', 8, 65, '#ffb300', 'stun')],
    U('Wrath of the Ancients', 'meteorstorm', 100, '#ffca28', 'stun'), 'boss', { desc: 'A forgotten deity sealed inside a stone sphere.', godMode: true }),

  /* ---------------- SECRET & SPECIAL ---------------- */
  B('oneaboveall', 'One Above All Ball', 'Secret', 'Admin Exclusive', [100, 100, 100, 95, 100], D('#0a0014', '#b026ff', '#9d00ff', 'galaxy', ['ring', 'orbit'], '', { glow: 1.6 }),
    [S('ABSOLUTE COPY', 'copy', 10, 80, '#b026ff'), S('INFINITY REPLICATION', 'clone', 12, 60, '#c77dff'), S('REALITY BREAK', 'shockwave', 7, 90, '#9d00ff', 'stun'), S('ADAPTIVE EVOLUTION', 'adaptive', 15, 60, '#e0aaff')],
    U('OMNIVERSAL SUPREMACY', 'omniversal', 120, '#b026ff'), 'adaptive',
    { desc: 'ADMIN EXCLUSIVE / SECRET GOD. A black-and-purple cosmic sphere with a glowing galaxy core and a purple energy ring.', godMode: true, adminOnly: true, godName: 'ULTIMATE COSMIC SPHERE' }),
  B('infinity', 'Infinity Ball', 'Secret', 'Secret', [130, 85, 70, 75, 35], D('#1a0033', '#00ffff', '#00e5ff', 'infinity', ['ring', 'orbit'], '∞'),
    [S('Infinite Loop', 'orbitals', 9, 50, '#00ffff'), S('Endless Barrage', 'multishot', 5, 30, '#00e5ff', 'none', 6), S('Infinity Guard', 'shield', 10, 65, '#80ffff')],
    U('Infinite Void', 'blackhole', 100, '#00e5ff'), 'adaptive', { desc: 'Without beginning and without end.', godMode: true }),
  B('omniverse', 'Omniverse Ball', 'Secret', 'Secret', [135, 86, 72, 72, 35], D('#020024', '#ff00ff', '#00d4ff', 'multiverse', ['ring', 'orbit', 'halo']),
    [S('Multiverse Rift', 'teleport', 6, 55, '#ff00ff'), S('Omni Beam', 'beam', 5, 65, '#00d4ff'), S('Parallel Selves', 'clone', 12, 40, '#ff00ff')],
    U('Omniversal Collapse', 'supernova', 100, '#ff00ff'), 'intelligent', { desc: 'Every universe, every timeline, one sphere.', godMode: true }),
  B('creator', 'Creator Ball', 'Secret', 'God Tier', [130, 82, 75, 70, 35], D('#ffffff', '#00e676', '#b9f6ca', 'genesis', ['halo', 'orbit']),
    [S('Genesis', 'heal', 10, 45, '#b9f6ca'), S('Creation Orbs', 'orbitals', 9, 50, '#00e676'), S('Let There Be Light', 'beam', 5, 65, '#ffffff')],
    U('Genesis Wave', 'nova', 95, '#00e676'), 'intelligent', { desc: 'The sphere that shaped the first worlds.', godMode: true }),
  B('destroyer', 'Destroyer Ball', 'Secret', 'God Tier', [125, 95, 60, 72, 35], D('#1a0000', '#ff3d00', '#ff1744', 'cracks', ['spikes', 'horns']),
    [S('Annihilate', 'projectile', 4, 65, '#ff3d00', 'burn'), S('Ruin', 'explosion', 7, 65, '#ff1744'), S('Doom Dash', 'dash', 6, 65, '#ff3d00', 'stun')],
    U('Omega Destruction', 'supernova', 110, '#ff1744', 'burn'), 'aggressive', { desc: 'Born only to end all things.', godMode: true }),
  B('reality', 'Reality Ball', 'Secret', 'Secret', [125, 84, 70, 72, 35], D('#e0e0e0', '#00b0ff', '#80d8ff', 'glitch', ['ring']),
    [S('Reality Warp', 'teleport', 6, 55, '#00b0ff'), S('Rewrite', 'heal', 11, 40, '#80d8ff'), S('Glitch Barrage', 'multishot', 5, 35, '#00b0ff', 'stun', 5)],
    U('Reality Shatter', 'megabeam', 100, '#00b0ff', 'stun'), 'adaptive', { desc: 'Rewrites the rules of the arena.', godMode: true }),
  B('soul', 'Soul Ball', 'Secret', 'Secret', [120, 80, 65, 74, 35], D('#a7ffeb', '#00bfa5', '#64ffda', 'souls', ['orbit']),
    [S('Soul Steal', 'homing', 5, 55, '#64ffda', 'drain', 1), S('Spirit Orbs', 'orbitals', 9, 45, '#a7ffeb'), S('Soul Shield', 'shield', 10, 60, '#64ffda')],
    U('Soul Harvest', 'nova', 95, '#64ffda', 'drain'), 'intelligent', { desc: 'Carries the glowing spirits of a thousand battles.', godMode: true }),
  B('dimensionking', 'Dimension King Ball', 'Secret', 'Secret', [135, 88, 75, 70, 35], D('#311b92', '#ffd700', '#7c4dff', 'portal', ['crown', 'ring']),
    [S('Royal Portal', 'teleport', 6, 60, '#7c4dff'), S("King's Decree", 'lightning', 5, 65, '#ffd700', 'stun'), S('Dimension Army', 'clone', 12, 45, '#7c4dff')],
    U('Throne of Dimensions', 'megabeam', 105, '#ffd700'), 'boss', { desc: 'Rules over every dimension from its crowned sphere.', godMode: true }),
  B('absolute', 'Absolute Ball', 'Secret', 'God Tier', [140, 90, 80, 75, 40], D('#fafafa', '#212121', '#ffffff', 'yinyang', ['ring', 'halo']),
    [S('Absolute Force', 'shockwave', 7, 70, '#ffffff'), S('Absolute Defense', 'shield', 10, 75, '#e0e0e0'), S('Absolute Strike', 'dash', 6, 70, '#ffffff', 'stun')],
    U('Absolute End', 'judgment', 110, '#ffffff', 'stun'), 'intelligent', { desc: 'Perfect balance. Perfect power.', godMode: true }),
  B('unknown', 'Unknown Ball', 'Secret', 'Secret', [125, 88, 70, 78, 40], D('#000000', '#00ff41', '#00ff41', 'unknown', ['orbit'], '?'),
    [S('???', 'copy', 10, 60, '#00ff41'), S('Null Zone', 'trap', 8, 50, '#00ff41', 'weaken'), S('ERR0R', 'multishot', 5, 45, '#00ff41', 'random', 4)],
    U('█████', 'supernova', 110, '#00ff41', 'random'), 'adaptive', { desc: 'Data corrupted. Origin unknown. ???', godMode: true }),
];

/* ---------------- LIMITED-TIME BALLS (event exclusives) ---------------- */
const LIMITED_BALLS = [
  B('bloodmoon', 'Blood Moon Ball', 'Limited', 'Limited', [120, 74, 58, 68, 30], D('#4a0000', '#ff1744', '#ff0033', 'moon', ['halo']),
    [S('Lunar Fang', 'dash', 6, 55, '#ff1744', 'drain'), S('Crimson Rain', 'meteor', 7, 50, '#ff0033'), S('Moonlit Veil', 'shield', 10, 55, '#ff8a80')],
    U('Blood Moon Eclipse', 'blackhole', 95, '#ff0033', 'drain'), 'aggressive', { desc: 'LIMITED: rises only during the Blood Moon event.', godMode: true, limited: true }),
  B('aurora', 'Aurora Ball', 'Limited', 'Limited', [115, 66, 62, 70, 28], D('#00264d', '#00ffa3', '#7cffcb', 'aurora', ['ring', 'orbit']),
    [S('Northern Lights', 'beam', 5, 55, '#7cffcb'), S('Polar Wind', 'multishot', 5, 35, '#a7ffeb', 'freeze', 3), S('Aurora Veil', 'heal', 11, 40, '#00ffa3')],
    U('Aurora Cascade', 'judgment', 90, '#00ffa3'), 'intelligent', { desc: 'LIMITED: shimmering polar lights in a sphere.', godMode: true, limited: true }),
  B('frostcrown', 'Frost Crown Ball', 'Limited', 'Limited', [125, 70, 70, 60, 25], D('#b3e5fc', '#0277bd', '#81d4fa', 'ice', ['crown', 'crystals']),
    [S('Glacier Spike', 'projectile', 4, 55, '#81d4fa', 'freeze'), S('Frozen Throne', 'shield', 10, 60, '#e1f5fe'), S('Snowstorm', 'trap', 8, 45, '#b3e5fc', 'freeze')],
    U('Eternal Winter', 'timestop', 90, '#81d4fa'), 'defensive', { desc: 'LIMITED: the crowned ruler of the winter festival.', godMode: true, limited: true }),
  B('solarflare', 'Solar Flare Ball', 'Limited', 'Limited', [110, 80, 52, 72, 30], D('#ff6f00', '#ffea00', '#ffab00', 'sun', ['flames', 'orbit']),
    [S('Flare Burst', 'explosion', 7, 55, '#ffea00', 'burn'), S('Sunspot', 'trap', 8, 40, '#ff6f00', 'burn'), S('Corona Dash', 'dash', 6, 55, '#ffab00', 'burn')],
    U('Solar Storm', 'meteorstorm', 95, '#ffab00', 'burn'), 'aggressive', { desc: 'LIMITED: summer event sphere of solar fury.', godMode: true, limited: true }),
  B('glitch', 'Cyber Glitch Ball', 'Limited', 'Limited', [105, 74, 55, 82, 35], D('#0d0221', '#00f0ff', '#ff2a6d', 'glitch', ['ring']),
    [S('Pixel Shot', 'multishot', 4, 35, '#00f0ff', 'stun', 4), S('Firewall', 'shield', 10, 55, '#ff2a6d'), S('Overclock', 'buff', 9, 60, '#00f0ff')],
    U('System Crash', 'megabeam', 95, '#ff2a6d', 'stun'), 'adaptive', { desc: 'LIMITED: a corrupted cyber-sphere from the neon net.', godMode: true, limited: true }),
  B('sakura', 'Sakura Spirit Ball', 'Limited', 'Limited', [110, 66, 58, 74, 30], D('#ffc1e3', '#ff5fa2', '#ffb7dd', 'petals', ['orbit', 'halo']),
    [S('Petal Storm', 'multishot', 4.5, 32, '#ff5fa2', 'none', 5), S('Bloom', 'heal', 11, 40, '#ffc1e3'), S('Spirit Dash', 'dash', 6, 50, '#ff5fa2')],
    U('Thousand Petals', 'barrage', 90, '#ff5fa2'), 'tactical', { desc: 'LIMITED: blossoms only during the spring festival.', godMode: true, limited: true }),
];

/* ---------------- ADMIN EXCLUSIVE EXPANSION (owner only) ---------------- */
const AD = { godMode: true, adminOnly: true };
const ADMIN_BALLS = [
  B('portalmaster', 'Portal Master Ball', 'Admin', 'Admin Exclusive', [150, 104, 92, 96, 72], D('#05000c', '#8e24ff', '#d18cff', 'dimensional', ['eyes', 'portals'], '', { glow: 1.75, sfx: { wave: 'sawtooth', pitch: 0.55 } }),
    [S('PORTAL GATE', 'portalgate', 6, 80, '#b026ff'), S('DIMENSIONAL ESCAPE', 'dimescape', 9, 70, '#d18cff'), S('BALL SUMMON', 'summon', 11, 75, '#9d4dff', 'none', 2), S('CLONE ARMY', 'clonearmy', 12, 70, '#c77dff')],
    U('INFINITE PORTAL', 'infiniteportal', 130, '#b026ff'), 'intelligent', { ...AD, desc: "ADMIN EXCLUSIVE — the game owner's personal character. Opens dimensional portals anywhere, slips out of the arena and back, copies other balls and summons an army through its portals.", godName: 'LORD OF INFINITE PORTALS', godDur: 14, noOpponent: true }),
  B('omega', 'Omega Ball', 'Admin', 'Admin Exclusive', [125, 96, 90, 82, 70], D('#05060f', '#00e5ff', '#3d5afe', 'omega', ['ring', 'orbit'], '', { glow: 1.5, sfx: { wave: 'sawtooth', pitch: 0.6 } }),
    [S('OMEGA BEAM', 'beam', 5, 85, '#00e5ff', 'stun'), S('COSMIC SURGE', 'shockwave', 7, 85, '#3d5afe'), S('OMEGA BARRIER', 'shield', 10, 80, '#80d8ff'), S('EVENT PULL', 'gravity', 9, 75, '#00e5ff')],
    U('OMEGA COLLAPSE', 'collapse', 120, '#00e5ff'), 'tactical', { ...AD, desc: 'ADMIN EXCLUSIVE. Commands the final cosmic energy at the end of the universe.', godName: 'OMEGA ASCENDANT' }),
  B('phantom', 'Phantom Ball', 'Admin', 'Admin Exclusive', [110, 92, 75, 98, 75], D('#0b1a1f', '#7df9ff', '#b2fff9', 'phantom', ['orbit'], '', { glow: 1.4, sfx: { wave: 'sine', pitch: 1.6 } }),
    [S('PHANTOM VEIL', 'phase', 9, 70, '#b2fff9'), S('ILLUSION DECOYS', 'clone', 11, 55, '#7df9ff'), S('SPECTRAL LANCES', 'homing', 5, 55, '#b2fff9', 'weaken', 3), S('GHOST STRIKE', 'teleport', 6, 75, '#7df9ff')],
    U('PHANTOM DIMENSION', 'phantomdim', 115, '#7df9ff'), 'tactical', { ...AD, desc: 'ADMIN EXCLUSIVE. Fades into invisible energy and fights with illusions.', godName: 'SPECTRE SOVEREIGN' }),
  B('infinitycore', 'Infinity Core Ball', 'Admin', 'Admin Exclusive', [150, 82, 110, 70, 55], D('#071a2b', '#ffd740', '#40c4ff', 'core', ['armor', 'ring'], '', { glow: 1.4, sfx: { wave: 'triangle', pitch: 0.8 } }),
    [S('CORE SHIELD', 'shield', 9, 90, '#40c4ff'), S('ENDLESS REGEN', 'heal', 11, 70, '#ffd740'), S('INFINITE ORBIT', 'orbitals', 9, 75, '#40c4ff'), S('CORE PULSE', 'shockwave', 7, 75, '#ffd740', 'slow')],
    U('INFINITE CORE', 'infinitecore', 110, '#ffd740'), 'defensive', { ...AD, desc: 'ADMIN EXCLUSIVE. An armoured reactor sphere of endless energy and defence.', godName: 'ETERNAL CORE' }),
  B('chaosemperor', 'Chaos Emperor Ball', 'Admin', 'Admin Exclusive', [125, 100, 78, 88, 80], D('#1a0010', '#ff1744', '#d500f9', 'chaos', ['crown', 'spikes', 'orbit'], '', { glow: 1.5, sfx: { wave: 'square', pitch: 0.9 } }),
    [S('ELEMENTAL CHAOS', 'multishot', 4.5, 55, '#ff1744', 'random', 5), S('CHAOS STORM', 'lightning', 5, 75, '#d500f9', 'random'), S("EMPEROR'S RIFT", 'teleport', 6, 75, '#ff1744'), S('ENTROPY FIELD', 'trap', 8, 60, '#d500f9', 'random')],
    U('CHAOS ERUPTION', 'chaoseruption', 120, '#ff1744', 'random'), 'adaptive', { ...AD, desc: 'ADMIN EXCLUSIVE. Rules every element at once, with no pattern anyone can predict.', godName: 'EMPEROR OF CHAOS' }),
  B('celestialdragon', 'Celestial Dragon Ball', 'Admin', 'Admin Exclusive', [140, 98, 88, 84, 70], D('#0d2a6b', '#ffd54f', '#64b5ff', 'starscale', ['horns', 'wings', 'orbit'], '', { glow: 1.5, sfx: { wave: 'sawtooth', pitch: 0.75 } }),
    [S('CELESTIAL FLAME', 'beam', 5, 85, '#64b5ff', 'burn'), S('STARFIRE BREATH', 'multishot', 5, 55, '#ffd54f', 'burn', 4), S('DRAGON ASCENT', 'dash', 6, 80, '#64b5ff', 'burn'), S('STAR SCALES', 'shield', 10, 75, '#ffd54f')],
    U('DRAGON NOVA', 'dragonnova', 120, '#64b5ff', 'burn'), 'aggressive', { ...AD, desc: 'ADMIN EXCLUSIVE. A star-scaled dragon sphere that breathes celestial fire.', godName: 'COSMIC DRAGON EMPEROR' }),
  B('miracle', 'Miracle Ball', 'Admin', 'Admin Exclusive', [135, 80, 100, 78, 60], D('#fff8fb', '#ff80ab', '#a7ffeb', 'miracle', ['halo', 'wings'], '', { glow: 1.4, sfx: { wave: 'sine', pitch: 1.3 } }),
    [S('MIRACLE HEAL', 'heal', 9, 85, '#a7ffeb'), S('BLESSED SHIELD', 'shield', 9, 85, '#ff80ab'), S('SECOND CHANCE', 'resurrect', 1, 60, '#ffffff'), S('RADIANT PULSE', 'shockwave', 7, 70, '#a7ffeb')],
    U('MIRACLE OVERDRIVE', 'miracle', 110, '#ff80ab'), 'defensive', { ...AD, desc: 'ADMIN EXCLUSIVE. Heals, shields and recovers from anything.', godName: 'MIRACLE INCARNATE' }),
  B('glitchgod', 'Glitch God Ball', 'Admin', 'Admin Exclusive', [120, 95, 80, 90, 80], D('#03000a', '#00ff9f', '#ff00e6', 'glitch', ['ring', 'orbit'], '', { glow: 1.5, sfx: { wave: 'square', pitch: 1.4 } }),
    [S('PIXEL STORM', 'multishot', 4.5, 55, '#00ff9f', 'stun', 6), S('SYSTEM OVERRIDE', 'timestop', 12, 60, '#ff00e6'), S('CORRUPTION', 'projectile', 4, 75, '#00ff9f', 'random'), S('BLUE SCREEN', 'explosion', 8, 80, '#2979ff', 'stun')],
    U('FATAL ERROR', 'storm', 120, '#ff00e6', 'random'), 'adaptive', { ...AD, desc: 'ADMIN EXCLUSIVE. A god-level bug that rewrites the arena.', godName: 'ROOT ACCESS' }),
  B('creatorgod', 'Creator God Ball', 'Admin', 'Admin Exclusive', [140, 90, 95, 78, 65], D('#fffef5', '#00e676', '#ffd54f', 'genesis', ['halo', 'crown', 'orbit'], '', { glow: 1.6, sfx: { wave: 'triangle', pitch: 1.1 } }),
    [S('GENESIS ORBS', 'orbitals', 8, 80, '#00e676'), S('CREATION RAY', 'beam', 5, 85, '#ffd54f'), S('WORLD SHIELD', 'shield', 10, 85, '#ffffff'), S('SPRING OF LIFE', 'heal', 11, 70, '#00e676')],
    U('BIG BANG GENESIS', 'nova', 125, '#ffd54f'), 'intelligent', { ...AD, desc: 'ADMIN EXCLUSIVE. The sphere that designed every other sphere.', godName: 'ARCHITECT OF WORLDS' }),
  B('voidemperor', 'Void Emperor Ball', 'Admin', 'Admin Exclusive', [130, 98, 85, 82, 70], D('#000000', '#7c4dff', '#651fff', 'void', ['crown', 'ring'], '', { glow: 1.5, sfx: { wave: 'sawtooth', pitch: 0.5 } }),
    [S('VOID GRASP', 'gravity', 7, 80, '#7c4dff'), S('NULL BEAM', 'beam', 5, 85, '#651fff', 'weaken'), S('ABYSS RIFT', 'teleport', 6, 80, '#7c4dff'), S('VOID ORBS', 'homing', 5, 60, '#b388ff', 'weaken', 3)],
    U('EMPEROR OF NOTHING', 'blackhole', 125, '#651fff', 'weaken'), 'boss', { ...AD, desc: 'ADMIN EXCLUSIVE. Crowned ruler of the empty space between worlds.', godName: 'ABSOLUTE VOID' }),
  B('chronos', 'Chronos Ball', 'Admin', 'Admin Exclusive', [125, 90, 88, 86, 70], D('#0b1d3a', '#ffd740', '#40c4ff', 'clock', ['ring', 'halo'], '', { glow: 1.5, sfx: { wave: 'triangle', pitch: 1.2 } }),
    [S('TIME LOCK', 'timestop', 11, 70, '#ffd740'), S('REWIND', 'heal', 10, 70, '#40c4ff'), S('TEMPORAL BOLTS', 'homing', 5, 60, '#ffd740', 'slow', 3), S('AGE OF RUIN', 'explosion', 8, 80, '#40c4ff', 'weaken')],
    U('END OF TIME', 'timestop', 125, '#ffd740'), 'intelligent', { ...AD, desc: 'ADMIN EXCLUSIVE. Holds every second of every battle in its gears.', godName: 'LORD OF TIME' }),
  B('devourer', 'Devourer Ball', 'Admin', 'Admin Exclusive', [145, 96, 80, 76, 70], D('#1a0000', '#ff3d00', '#ff1744', 'maw', ['spikes'], '', { glow: 1.4, sfx: { wave: 'sawtooth', pitch: 0.45 } }),
    [S('DEVOUR', 'projectile', 4, 75, '#ff3d00', 'drain'), S('CONSUME', 'gravity', 7, 80, '#ff1744'), S('HUNGER DASH', 'dash', 6, 80, '#ff3d00', 'drain'), S('GORGE', 'explosion', 8, 80, '#ff1744', 'drain')],
    U('WORLD DEVOURER', 'blackhole', 125, '#ff1744', 'drain'), 'aggressive', { ...AD, desc: 'ADMIN EXCLUSIVE. A spiralling maw of a sphere that feeds on energy.', godName: 'ENDLESS HUNGER' }),
  B('adminsupreme', 'Admin Supreme Ball', 'Admin', 'Admin Exclusive', [140, 100, 100, 90, 85], D('#0a0a12', '#ffd700', '#e040fb', 'runes', ['crown', 'ring', 'orbit', 'armor'], '♛', { glow: 1.7, sfx: { wave: 'square', pitch: 0.7 } }),
    [S('SUPREME DECREE', 'lightning', 5, 85, '#ffd700', 'stun'), S('SUPREME SHIELD', 'shield', 9, 90, '#e040fb'), S('SUPREME BARRAGE', 'multishot', 5, 60, '#ffd700', 'none', 6), S('SUPREME DASH', 'dash', 6, 85, '#e040fb')],
    U('SUPREME AUTHORITY', 'judgment', 130, '#ffd700', 'stun'), 'intelligent', { ...AD, desc: "ADMIN EXCLUSIVE. The owner's personal sphere of absolute authority.", godName: 'THE SUPREME ADMIN' }),
];

/* ---------------- PREMIUM BALLS (Ultimate Premium members; anyone can try them in Practice) ---------------- */
const PR = { premium: true, godMode: true };
const PREMIUM_BALLS = [
  B('prism', 'Prism Ball', 'Premium', 'Legendary', [110, 72, 60, 72, 35], D('#e8eaf6', '#ff4081', '#7c4dff', 'prism', ['crystals'], '', { sfx: { wave: 'sine', pitch: 1.5 } }),
    [S('Prism Ray', 'beam', 5, 60, '#7c4dff'), S('Spectrum Shards', 'multishot', 5, 35, '#ff4081', 'none', 5), S('Refract', 'reflect', 10, 60, '#e8eaf6')],
    U('Prismatic Judgment', 'judgment', 95, '#7c4dff'), 'intelligent', { ...PR, desc: 'PREMIUM. Splits light into a rainbow of lasers and reflects attacks.' }),
  B('mirror', 'Mirror Ball', 'Premium', 'Legendary', [115, 68, 70, 68, 35], D('#cfd8dc', '#ffffff', '#b3e5fc', 'mirror', ['orbit'], '', { sfx: { wave: 'triangle', pitch: 1.8 } }),
    [S('Mirror Shield', 'reflect', 9, 70, '#ffffff'), S('Copycat', 'copy', 10, 60, '#b3e5fc'), S('Shard Spray', 'multishot', 5, 35, '#cfd8dc', 'none', 5)],
    U('Hall of Mirrors', 'swarm', 90, '#b3e5fc'), 'adaptive', { ...PR, desc: 'PREMIUM. A chrome disco sphere that sends every attack back.' }),
  B('toxicreactor', 'Toxic Reactor Ball', 'Premium', 'Mythical', [120, 76, 62, 62, 30], D('#1b2a00', '#c6ff00', '#76ff03', 'reactor', ['armor'], '', { sfx: { wave: 'square', pitch: 0.65 } }),
    [S('Reactor Leak', 'trap', 7, 45, '#c6ff00', 'poison'), S('Meltdown Pulse', 'shockwave', 8, 55, '#76ff03', 'poison'), S('Isotope Bolt', 'projectile', 4, 55, '#c6ff00', 'poison')],
    U('Critical Mass', 'supernova', 100, '#c6ff00', 'poison'), 'aggressive', { ...PR, desc: 'PREMIUM. An armoured reactor core on the edge of meltdown.' }),
  B('sonic', 'Sonic Ball', 'Premium', 'Legendary', [100, 70, 50, 100, 35], D('#0d47a1', '#40c4ff', '#00e5ff', 'sonic', ['orbit'], '', { sfx: { wave: 'sawtooth', pitch: 1.7 } }),
    [S('Sonic Boom', 'shockwave', 6, 55, '#40c4ff', 'stun'), S('Mach Dash', 'dash', 5, 55, '#00e5ff'), S('Speed Burst', 'buff', 9, 60, '#40c4ff')],
    U('Supersonic', 'barrage', 95, '#00e5ff'), 'aggressive', { ...PR, desc: 'PREMIUM. Breaks the sound barrier every time it bounces.' }),
  B('magnetar', 'Magnetar Ball', 'Premium', 'Mythical', [120, 74, 66, 66, 30], D('#120024', '#00b0ff', '#e040fb', 'magnetar', ['ring'], '', { sfx: { wave: 'sine', pitch: 0.55 } }),
    [S('Magnetic Storm', 'gravity', 7, 55, '#e040fb'), S('Flux Beam', 'beam', 5, 60, '#00b0ff', 'stun'), S('Polar Bolts', 'homing', 5, 40, '#e040fb', 'none', 3)],
    U('Magnetar Flare', 'nova', 100, '#00b0ff', 'stun'), 'tactical', { ...PR, desc: 'PREMIUM. A collapsed star with the strongest magnetic field in the arena.' }),
  B('rift', 'Rift Ball', 'Premium', 'Mythical', [115, 76, 60, 80, 35], D('#05000f', '#ff00c8', '#7c4dff', 'rift', ['ring'], '', { sfx: { wave: 'square', pitch: 1.0 } }),
    [S('Rift Step', 'teleport', 5, 55, '#ff00c8'), S('Rift Bolts', 'homing', 5, 40, '#7c4dff', 'slow', 3), S('Space Tear', 'trap', 8, 45, '#ff00c8', 'slow')],
    U('Dimensional Rift', 'megabeam', 100, '#ff00c8'), 'tactical', { ...PR, desc: 'PREMIUM. Tears open space itself to strike from anywhere.' }),
];
/* ---------------- ANTI BALL & TECH BALLS UPDATE ----------------
   Anti Ball is FREE for every player, forever. The two Tech Balls are PREMIUM: they unlock with an active
   ULTIMATE PREMIUM membership (checked by the game server) and lock again — with progress kept — if it lapses. */
const UPDATE_BALLS = [
  B('anti', 'Anti Ball', 'Secret', 'Secret', [114, 72, 64, 74, 26], D('#040006', '#7c4dff', '#b388ff', 'anti', ['motes'], '', { glow: 1.35, sfx: { wave: 'sawtooth', pitch: 0.5 } }),
    [S('NULL ZONE', 'nullzone', 10, 60, '#9d4dff'), S('POWER ABSORB', 'absorb', 9, 60, '#ea80fc'), S('REVERSE IMPACT', 'reverse', 11, 55, '#e1bee7'),
      S('MINI BLACK HOLE', 'minihole', 9, 65, '#7c4dff'), S('VOID TELEPORT', 'voidtp', 6, 50, '#651fff'), S('ANTI EVOLUTION', 'antievo', 14, 60, '#ea80fc')],
    U('ABSOLUTE ZERO', 'absolutezero', 110, '#9d4dff', 'weaken'), 'tactical',
    { free: true, isNew: true, godMode: true, godName: 'NULL SOVEREIGN', passive: 'antiadapt',
      passiveInfo: { name: 'ANTI-ADAPTATION', desc: 'Builds resistance to the kinds of attacks that keep hitting it (projectiles, beams, impacts…), up to 30% each. Never full immunity; resets every battle.' },
      desc: 'FREE for every player. A mysterious null entity that negates, absorbs, reverses and manipulates enemy abilities — the ultimate counter-power specialist.' }),
  B('mecha', 'Mecha Commander Ball', 'Tech', 'Mythical', [118, 70, 66, 62, 26], D('#3a4654', '#2979ff', '#40c4ff', 'mecha', ['armor', 'antenna'], '', { glow: 1.3, sfx: { wave: 'square', pitch: 0.7 } }),
    [S('ROBOT SUMMON', 'robots', 12, 60, '#40c4ff', 'none', 3), S('MECHA FACTORY', 'factory', 16, 60, '#ffab00'), S('MISSILE BARRAGE', 'missiles', 7, 60, '#ff6d00', 'none', 6),
      S('DEFENSE DRONE', 'drone', 12, 60, '#80d8ff'), S('ROBOT FUSION', 'fusionbot', 13, 70, '#2979ff')],
    U('TITAN OVERDRIVE', 'titan', 115, '#2979ff'), 'tactical',
    { ...PR, isNew: true, techNo: 1, godName: 'MECHA EMPEROR', passive: 'repair',
      passiveInfo: { name: 'EMERGENCY REPAIR (automatic)', desc: 'At 20% HP or less a repair robot flies in, restores up to 22% HP over a few seconds and adds temporary armour. 40 s cooldown, max 3 per battle; the repair robot can be destroyed.' },
      desc: 'PREMIUM • TECH BALL 1. A futuristic mechanical ball that commands an army of combat robots.' }),
  B('cyber', 'Cyber Overlord Ball', 'Tech', 'Mythical', [114, 76, 62, 78, 32], D('#08020e', '#ff1744', '#d500f9', 'circuit', ['holo'], '', { glow: 1.4, sfx: { wave: 'sawtooth', pitch: 1.25 } }),
    [S('LASER GRID', 'lasergrid', 9, 60, '#ff1744'), S('HOLOGRAM CLONE', 'hologram', 12, 55, '#e040fb'), S('EMP PULSE', 'emp', 12, 60, '#40c4ff'),
      S('CYBER TRAP', 'cybertrap', 8, 50, '#ff4081', 'slow'), S('AUTO TURRET', 'turret', 13, 60, '#ff5252'), S('OVERCLOCK MODE', 'overclock', 15, 60, '#ff1744')],
    U('SKYNET PROTOCOL', 'skynet', 120, '#ff1744'), 'tactical',
    { ...PR, isNew: true, techNo: 2, godName: 'SKYNET OVERLORD', heat: true,
      passiveInfo: { name: 'HEAT SYSTEM', desc: 'Abilities build heat (50% faster in Overclock). At 100 heat it OVERHEATS for 3 s: Laser Grid, Hologram, EMP, Turret and Overclock cannot be used until it cools down.' },
      desc: 'PREMIUM • TECH BALL 2. Controls the battlefield with lasers, holograms, drones and automated defences.' }),
];
/* helpers that only ever appear through Portal Master Ball's portals: never playable, never sold, never AI opponents */
const SM = { adminOnly: true, summonOnly: true };
const SUMMON_BALLS = [
  B('electric', 'Electric Ball', 'Elemental', 'Rare', [92, 64, 48, 88, 26], D('#0a2a4a', '#ffee58', '#40c4ff', 'storm', ['orbit'], '', { sfx: { wave: 'square', pitch: 1.4 } }),
    [S('Volt Bolt', 'lightning', 5, 55, '#ffee58', 'stun'), S('Arc Shot', 'multishot', 4, 40, '#40c4ff', 'none', 3), S('Static Field', 'orbitals', 9, 45, '#ffee58')], U('Overcharge', 'storm', 85, '#ffee58'), 'aggressive',
    { ...SM, desc: "Summon only. Crackles out of Portal Master Ball's portals." }),
  B('spear', 'Spear Ball', 'Special', 'Rare', [96, 72, 58, 80, 30], D('#37474f', '#cfd8dc', '#ff7043', 'stripes', ['spikes', 'armor'], '', { sfx: { wave: 'triangle', pitch: 1.1 } }),
    [S('Spear Thrust', 'dash', 5, 60, '#ff7043'), S('Spear Volley', 'multishot', 5, 45, '#cfd8dc', 'weaken', 3), S('Impale', 'projectile', 6, 60, '#ff7043', 'weaken')], U('Thousand Spears', 'barrage', 85, '#ff7043'), 'aggressive',
    { ...SM, desc: "Summon only. A spiked iron sphere that charges out of a portal." }),
  B('cell', 'Cell Ball', 'Special', 'Rare', [110, 50, 60, 70, 18], D('#1b5e20', '#76ff03', '#b2ff59', 'cell', ['orbit'], '', { sfx: { wave: 'sine', pitch: 1.3 } }),
    [S('Mitosis', 'clone', 10, 45, '#76ff03'), S('Membrane', 'shield', 9, 55, '#b2ff59'), S('Cytoplasm Burst', 'explosion', 7, 50, '#76ff03', 'poison')], U('Cell Division', 'swarm', 80, '#76ff03'), 'adaptive',
    { ...SM, desc: "Summon only. A living cell that splits and bursts." }),
  B('bread', 'French Bread Ball', 'Special', 'Rare', [104, 62, 66, 64, 22], D('#d9a25a', '#8a4b14', '#ffcc80', 'bread', [], '', { sfx: { wave: 'triangle', pitch: 0.9 } }),
    [S('Baguette Bash', 'dash', 5, 60, '#ffcc80'), S('Crumb Shot', 'multishot', 4, 35, '#ffe0b2', 'none', 5), S('Fresh From The Oven', 'projectile', 6, 55, '#ff9100', 'burn')], U('Bakery Blast', 'nova', 85, '#ffcc80'), 'aggressive',
    { ...SM, desc: "Summon only. Crusty, golden and surprisingly dangerous." }),
];
const ALL_BUILTIN = [...BUILTIN_BALLS, ...LIMITED_BALLS, ...ADMIN_BALLS, ...PREMIUM_BALLS, ...UPDATE_BALLS, ...SUMMON_BALLS];

/* ---- registry: built-ins (+admin overrides) + custom admin balls ---- */
let _registry = null, CATALOG = null;
/* The ball catalog (admin overrides, custom balls, disabled list, a player's fusions) comes from
   the game server when signed in, otherwise from this device's guest save. */
function catalogData() { return CATALOG || { overrides: SAVE.overrides, customBalls: SAVE.customBalls, disabled: SAVE.disabled, fusions: SAVE.fusions || [] }; }
function setCatalog(c) { CATALOG = c; invalidateRegistry(); }
function invalidateRegistry() { _registry = null; SpriteCache.clear(); }
function registry() {
  if (_registry) return _registry;
  const list = [], C = catalogData();
  for (const b of ALL_BUILTIN) {
    const o = (C.overrides || {})[b.id];
    const merged = o ? { ...b, ...o, design: { ...b.design, ...(o.design || {}) }, builtin: true, overridden: true } : { ...b, builtin: true };
    if (b.supreme && o) { merged.skills = b.skills; merged.ult = b.ult; if (b.adminOnly) { merged.adminOnly = true; merged.rarity = 'Admin Exclusive'; } else { merged.free = b.free; merged.godBall = b.godBall; } }
    if (C.tuning && C.tuning[b.id] && b.supreme) merged.tuning = C.tuning[b.id];
    list.push(merged);
  }
  for (const c of C.customBalls || []) list.push({ ...c, custom: true });
  for (const c of C.fusions || []) list.push({ ...c, fusion: true, custom: true });
  const dis = C.disabled || {};
  for (const b of list) { b.enabled = !dis[b.id]; if (b.rarity === 'Admin Exclusive') b.adminOnly = true; }
  _registry = { list, map: Object.fromEntries(list.map(b => [b.id, b])) };
  return _registry;
}
const getBall = id => registry().map[id];
const allBalls = () => registry().list;
/* Admin = the verified game OWNER, signed in on the game server with 2-factor auth (never a local password).
   Premium = an active, server-verified ULTIMATE PREMIUM subscription. Premium never grants admin. */
const isAdmin = () => !!(window.Online && window.Online.isOwner && window.Online.isOwner());
const isPremium = () => !!(window.Online && window.Online.isPremium && window.Online.isPremium());
function canUseBall(b) {
  if (!b || !b.enabled && !isAdmin()) return false;
  if (b.adminOnly) return isAdmin();
  if (b.free) return true;                            // free for every player (Anti Ball)
  if (isAdmin() || prog(b.id).owned) return true;
  return isPremium() && !b.fusion;                    // premium: every non-admin ball, incl. premium & limited
}
/* balls a player may pick as their own fighter */
function playableBalls() { return allBalls().filter(b => !b.summonOnly && canUseBall(b) && (!b.draft || isAdmin())); }
/* balls that can appear as AI opponents */
function opponentPool(includeAdmin) { return allBalls().filter(b => b.enabled && !b.draft && !b.fusion && !b.summonOnly && !b.noOpponent && (!b.adminOnly || includeAdmin)); }

/* =====================================================================
   5. PROCEDURAL BALL RENDERER
   Surface texture is rendered once into an offscreen sprite (rotates as
   the ball rolls); lighting, aura and floating attachments are drawn live.
   ===================================================================== */
const SpriteCache = {
  map: new Map(),
  clear() { this.map.clear(); },
  get(key, make) { let c = this.map.get(key); if (!c) { c = make(); this.map.set(key, c); if (this.map.size > 260) this.map.delete(this.map.keys().next().value); } return c; },
};
function makeCanvas(w, hh) { const c = document.createElement('canvas'); c.width = w; c.height = hh || w; return c; }

/* god-form palette: brighter, golden-tinted version of the design */
function godDesign(d) {
  return { ...d, c1: d.godC1 || mixColor(d.c1, '#fff6d0', 0.35), c2: d.godC2 || mixColor(d.c2, '#ffd54f', 0.35), c3: d.godC3 || mixColor(d.c3, '#ffffff', 0.3) };
}
function rageColor(d) {
  if (d.rage) return d.rage;
  const [r, g, b] = hexToRgb(d.c1);
  return (r > 160 && g < 110) ? '#b026ff' : '#ff1a3c';
}

/* ---------- pattern painters: (g, R, d, rng) with origin at centre ---------- */
function _blob(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function _dots(g, R, n, col, r0, r1, a, rng) { g.fillStyle = rgba(col, a); for (let i = 0; i < n; i++) { const an = rng() * TAU, rr = Math.sqrt(rng()) * R; g.beginPath(); g.arc(Math.cos(an) * rr, Math.sin(an) * rr, r0 + rng() * (r1 - r0), 0, TAU); g.fill(); } }
function _stars(g, R, n, rng, cols = ['#ffffff']) { for (let i = 0; i < n; i++) { const an = rng() * TAU, rr = Math.sqrt(rng()) * R, s = rng() * R * 0.025 + R * 0.006; g.fillStyle = rgba(cols[i % cols.length], 0.5 + rng() * 0.5); g.beginPath(); g.arc(Math.cos(an) * rr, Math.sin(an) * rr, s, 0, TAU); g.fill(); } }
function _spiral(g, R, arms, col, width, twist, a, rng, dotted) {
  for (let k = 0; k < arms; k++) {
    const off = k / arms * TAU;
    if (dotted) {
      for (let i = 0; i < 160; i++) { const t = i / 160, an = off + t * twist, rr = t * R * 1.05; const sp = (rng() - 0.5) * R * 0.18 * t; g.fillStyle = rgba(col, a * (1 - t * 0.5) * (0.4 + rng() * 0.6)); g.beginPath(); g.arc(Math.cos(an) * rr + sp, Math.sin(an) * rr + sp, R * (0.012 + rng() * 0.03), 0, TAU); g.fill(); }
    } else {
      g.strokeStyle = rgba(col, a); g.lineWidth = width; g.lineCap = 'round'; g.beginPath();
      for (let i = 0; i <= 60; i++) { const t = i / 60, an = off + t * twist, rr = t * R * 1.1; i ? g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : g.moveTo(0, 0); }
      g.stroke();
    }
  }
}
function _rays(g, R, n, col, a, wfrac = 0.12, rot = 0) { g.fillStyle = rgba(col, a); for (let i = 0; i < n; i++) { const an = rot + i / n * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an - wfrac) * R * 1.2, Math.sin(an - wfrac) * R * 1.2); g.lineTo(Math.cos(an + wfrac) * R * 1.2, Math.sin(an + wfrac) * R * 1.2); g.fill(); } }
function _bolt(g, x0, y0, x1, y1, col, w, rng, seg = 8) { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x0, y0); for (let i = 1; i < seg; i++) { const t = i / seg; g.lineTo(lerp(x0, x1, t) + (rng() - 0.5) * 40 * w / 6, lerp(y0, y1, t) + (rng() - 0.5) * 40 * w / 6); } g.lineTo(x1, y1); g.stroke(); }
function _waves(g, R, n, col, a, amp, lw) { g.strokeStyle = rgba(col, a); g.lineWidth = lw; for (let k = 0; k < n; k++) { const y0 = -R + (k + 0.5) * (2 * R / n); g.beginPath(); for (let x = -R; x <= R; x += 4) { const y = y0 + Math.sin(x / R * 6 + k) * amp; x === -R ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); } }
function _poly(g, pts) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); }

const PATTERN_FN = {
  solid(g, R, d) { _blob(g, 0, 0, R * 0.8, d.c2, 0.25); },
  anti(g, R, d, rng) {       // black body, glowing purple core, dark energy cracks
    g.fillStyle = '#030005'; g.fillRect(-R, -R, 2 * R, 2 * R);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.62); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.12, d.c3); gr.addColorStop(0.45, rgba(d.c2, 0.75)); gr.addColorStop(1, rgba(d.c2, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.62, 0, TAU); g.fill();
    for (let i = 0; i < 9; i++) {
      let a = rng() * TAU, x = Math.cos(a) * R * 0.22, y = Math.sin(a) * R * 0.22; g.beginPath(); g.moveTo(x, y);
      const n = 4 + Math.floor(rng() * 3); for (let k = 0; k < n; k++) { a += (rng() - 0.5) * 0.9; const st = R * (0.12 + rng() * 0.14); x += Math.cos(a) * st; y += Math.sin(a) * st; g.lineTo(x, y); }
      g.strokeStyle = rgba(d.c3, 0.85); g.lineWidth = R * 0.03; g.shadowColor = d.c2; g.shadowBlur = R * 0.12; g.stroke(); g.shadowBlur = 0; g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = R * 0.012; g.stroke();
    }
    _stars(g, R, 26, rng, [d.c3, '#ffffff', d.c2]);
    const rim = g.createRadialGradient(0, 0, R * 0.7, 0, 0, R); rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = rim; g.fillRect(-R, -R, 2 * R, 2 * R);
  },
  mecha(g, R, d, rng) {      // metallic armour panels, rivets, blue energy core
    const gr = g.createLinearGradient(-R, -R, R, R); gr.addColorStop(0, '#9aa7b4'); gr.addColorStop(0.45, d.c1); gr.addColorStop(1, '#1c232b'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.strokeStyle = 'rgba(10,16,24,.85)'; g.lineWidth = R * 0.035;
    for (const y of [-0.55, 0.55]) { g.beginPath(); g.moveTo(-R, y * R); g.lineTo(R, y * R); g.stroke(); }
    for (const x of [-0.5, 0.5]) { g.beginPath(); g.moveTo(x * R, -R); g.lineTo(x * R, -0.55 * R); g.moveTo(x * R, 0.55 * R); g.lineTo(x * R, R); g.stroke(); }
    g.fillStyle = 'rgba(225,235,245,.85)'; for (let i = 0; i < 18; i++) { const x = (rng() - 0.5) * 1.8 * R, y = (rng() < 0.5 ? -1 : 1) * (0.55 * R + (rng() < 0.5 ? -1 : 1) * R * 0.07); g.beginPath(); g.arc(x, y, R * 0.022, 0, TAU); g.fill(); }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(8,12,18,.9)'; g.fillRect(s * R * 0.62 - R * 0.12, -R * 0.2 + k * R * 0.16, R * 0.24, R * 0.07); }
    const cg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.36); cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.35, d.c3); cg.addColorStop(1, rgba(d.c2, 0)); g.fillStyle = cg; g.beginPath(); g.arc(0, 0, R * 0.36, 0, TAU); g.fill();
    g.strokeStyle = d.c3; g.lineWidth = R * 0.04; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(0, 0, R * 0.3, i / 6 * TAU, i / 6 * TAU + 0.7); g.stroke(); }
  },
  circuit(g, R, d, rng) {    // black metal with glowing red / purple circuits and a processor core
    const gr = g.createLinearGradient(-R, -R, R, R); gr.addColorStop(0, '#2a2030'); gr.addColorStop(0.5, d.c1); gr.addColorStop(1, '#000000'); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    for (let i = 0; i < 20; i++) {
      let x = (rng() - 0.5) * 2 * R, y = (rng() - 0.5) * 2 * R; const col = rng() < 0.5 ? d.c2 : d.c3;
      g.strokeStyle = rgba(col, 0.9); g.lineWidth = R * 0.022; g.shadowColor = col; g.shadowBlur = R * 0.08; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { const dir = Math.floor(rng() * 8) * Math.PI / 4, st = R * (0.15 + rng() * 0.3); x += Math.cos(dir) * st; y += Math.sin(dir) * st; g.lineTo(x, y); }
      g.stroke(); g.shadowBlur = 0; g.fillStyle = col; g.beginPath(); g.arc(x, y, R * 0.035, 0, TAU); g.fill();
    }
    g.save(); g.rotate(Math.PI / 4); g.fillStyle = '#12001a'; g.fillRect(-R * 0.24, -R * 0.24, R * 0.48, R * 0.48); g.strokeStyle = d.c2; g.lineWidth = R * 0.03; g.strokeRect(-R * 0.24, -R * 0.24, R * 0.48, R * 0.48); g.restore();
    const cg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.2); cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.4, d.c2); cg.addColorStop(1, rgba(d.c2, 0)); g.fillStyle = cg; g.beginPath(); g.arc(0, 0, R * 0.2, 0, TAU); g.fill();
  },
  dimensional(g, R, d, rng) {
    g.fillStyle = shade(d.c1, -0.5); g.fillRect(-R, -R, 2 * R, 2 * R);
    _blob(g, 0, 0, R * 0.95, d.c2, 0.45); _spiral(g, R, 4, d.c2, 0, 6, 0.95, rng, true); _spiral(g, R, 4, d.c3, 0.4, 5, 0.55, rng, true);
    g.lineWidth = R * 0.035; for (let k = 1; k <= 4; k++) { g.strokeStyle = rgba(k % 2 ? d.c3 : d.c2, 0.75); g.setLineDash([R * 0.12, R * 0.08]); g.beginPath(); g.arc(0, 0, R * k / 4.6, k, k + 5.2); g.stroke(); }
    g.setLineDash([]); _stars(g, R, 45, rng, ['#ffffff', d.c3, d.c2]);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.36); gr.addColorStop(0, '#000000'); gr.addColorStop(0.7, 'rgba(0,0,0,.92)'); gr.addColorStop(1, rgba(d.c2, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.36, 0, TAU); g.fill();
  },
  cell(g, R, d, rng) {
    _blob(g, 0, 0, R, d.c2, 0.35);
    g.strokeStyle = rgba(d.c3, 0.7); g.lineWidth = R * 0.06; g.beginPath(); g.arc(0, 0, R * 0.92, 0, TAU); g.stroke();
    for (let i = 0; i < 9; i++) { const x = (rng() - 0.5) * 1.4 * R, y = (rng() - 0.5) * 1.4 * R, rr = R * (0.06 + rng() * 0.08); g.fillStyle = rgba(d.c3, 0.55); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = R * 0.015; g.stroke(); }
    for (let i = 0; i < 3; i++) { g.save(); g.translate((rng() - 0.5) * R, (rng() - 0.5) * R); g.rotate(rng() * TAU); g.fillStyle = rgba('#ff8a65', 0.6); g.beginPath(); g.ellipse(0, 0, R * 0.18, R * 0.07, 0, 0, TAU); g.fill(); g.restore(); }
    _blob(g, R * 0.1, -R * 0.05, R * 0.32, '#4a148c', 0.75); _blob(g, R * 0.1, -R * 0.05, R * 0.14, '#ce93d8', 0.9);
  },
  bread(g, R, d, rng) {
    const gr = g.createLinearGradient(-R, -R, R, R); gr.addColorStop(0, '#f2c47e'); gr.addColorStop(0.5, d.c1); gr.addColorStop(1, d.c2); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
    for (let k = -2; k <= 2; k++) { g.save(); g.translate(k * R * 0.42, k * R * 0.1); g.rotate(-0.6); g.fillStyle = 'rgba(255,236,190,.9)'; g.beginPath(); g.ellipse(0, 0, R * 0.36, R * 0.085, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(110,55,10,.8)'; g.lineWidth = R * 0.03; g.stroke(); g.restore(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(120,60,12,.55)' : 'rgba(255,230,170,.6)'; g.beginPath(); g.arc((rng() - 0.5) * 2 * R, (rng() - 0.5) * 2 * R, R * 0.015 + rng() * R * 0.015, 0, TAU); g.fill(); }
  },
  stripes(g, R, d) { g.fillStyle = rgba(d.c2, 0.6); for (let i = -4; i <= 4; i += 2) g.fillRect(-R, i * R / 5, 2 * R, R / 5); },
  spots(g, R, d, rng) { _dots(g, R, 14, d.c2, R * 0.06, R * 0.2, 0.8, rng); },
  swirl(g, R, d, rng) { _spiral(g, R, 2, d.c2, R * 0.2, 4, 0.55, rng); },
  hex(g, R, d) { g.strokeStyle = rgba(d.c2, 0.55); g.lineWidth = R * 0.03; const s = R * 0.22; for (let y = -R; y < R + s; y += s * 1.5) for (let x = -R; x < R + s; x += s * 1.732) { const ox = (Math.round((y + R) / (s * 1.5)) % 2) * s * 0.866; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; g.lineTo(x + ox + Math.cos(a) * s * 0.95, y + Math.sin(a) * s * 0.95); } g.closePath(); g.stroke(); } },
  flame(g, R, d, rng) {
    for (let i = 0; i < 14; i++) { const x = (rng() * 2 - 1) * R, w = R * (0.15 + rng() * 0.2), hgt = R * (0.7 + rng() * 1.1); const gr = g.createLinearGradient(0, R, 0, R - hgt); gr.addColorStop(0, rgba(d.c2, 0.9)); gr.addColorStop(1, rgba(d.c1, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, R); g.quadraticCurveTo(x - w * 0.6, R - hgt * 0.5, x + (rng() - 0.5) * w, R - hgt); g.quadraticCurveTo(x + w * 0.6, R - hgt * 0.5, x + w, R); g.fill(); }
    _blob(g, 0, R * 0.25, R * 0.7, '#fff3b0', 0.45);
  },
  ice(g, R, d, rng) {
    for (let i = 0; i < 9; i++) { const a = rng() * TAU, a2 = a + 0.4 + rng() * 0.6; g.fillStyle = rgba(i % 2 ? d.c2 : '#ffffff', 0.12 + rng() * 0.2); _poly(g, [[0, 0], [Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2], [Math.cos(a2) * R * 1.2, Math.sin(a2) * R * 1.2]]); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = R * 0.02; for (let i = 0; i < 6; i++) _bolt(g, (rng() - 0.5) * R * 0.4, (rng() - 0.5) * R * 0.4, Math.cos(i) * R, Math.sin(i * 1.7) * R, 'rgba(255,255,255,.55)', R * 0.018, rng, 4);
  },
  storm(g, R, d, rng) { _blob(g, 0, 0, R, '#fff9c4', 0.35); for (let i = 0; i < 4; i++) _bolt(g, (rng() - 0.5) * R, -R, (rng() - 0.5) * R, R, i % 2 ? '#ffffff' : d.c3, R * 0.06, rng, 7); },
  water(g, R, d, rng) { _waves(g, R, 7, d.c2, 0.6, R * 0.08, R * 0.06); _dots(g, R, 10, '#ffffff', R * 0.03, R * 0.08, 0.45, rng); },
  earth(g, R, d, rng) { for (let i = 0; i < 10; i++) _blob(g, (rng() - 0.5) * 2 * R, (rng() - 0.5) * 2 * R, R * (0.2 + rng() * 0.35), d.c2, 0.75); g.strokeStyle = rgba('#2b1a0a', 0.7); g.lineWidth = R * 0.03; for (let i = 0; i < 6; i++) _bolt(g, (rng() - 0.5) * 2 * R, (rng() - 0.5) * 2 * R, (rng() - 0.5) * 2 * R, (rng() - 0.5) * 2 * R, 'rgba(40,25,10,.7)', R * 0.025, rng, 5); },
  wind(g, R, d, rng) { g.lineCap = 'round'; for (let i = 0; i < 8; i++) { g.strokeStyle = rgba('#ffffff', 0.35 + rng() * 0.4); g.lineWidth = R * (0.03 + rng() * 0.05); const r0 = R * (0.2 + rng() * 0.75), a0 = rng() * TAU; g.beginPath(); g.arc(0, 0, r0, a0, a0 + 1.5 + rng() * 2); g.stroke(); } },
  radiant(g, R, d) { _rays(g, R, 12, d.c2, 0.45, 0.13); _blob(g, 0, 0, R * 0.75, '#ffffff', 0.8); },
  darkness(g, R, d, rng) { for (let i = 0; i < 8; i++) _blob(g, (rng() - 0.5) * 1.6 * R, (rng() - 0.5) * 1.6 * R, R * (0.3 + rng() * 0.4), d.c2, 0.45); _spiral(g, R, 3, d.c3, R * 0.05, 3, 0.4, rng); _blob(g, 0, 0, R * 0.35, '#000000', 0.8); },
  toxic(g, R, d, rng) { _dots(g, R, 12, d.c2, R * 0.08, R * 0.2, 0.7, rng); g.strokeStyle = 'rgba(230,255,200,.6)'; g.lineWidth = R * 0.025; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc((rng() - 0.5) * 1.6 * R, (rng() - 0.5) * 1.6 * R, R * (0.05 + rng() * 0.1), 0, TAU); g.stroke(); } },
  plasma(g, R, d, rng) { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { g.strokeStyle = rgba(i % 2 ? d.c2 : '#ffffff', 0.5); g.lineWidth = R * (0.02 + rng() * 0.04); g.beginPath(); g.moveTo(0, 0); const a = rng() * TAU; g.bezierCurveTo(Math.cos(a) * R * 0.5 + (rng() - 0.5) * R, Math.sin(a) * R * 0.5, Math.cos(a + 1) * R * 0.8, Math.sin(a + 1) * R * 0.8 + (rng() - 0.5) * R, Math.cos(a + 0.5) * R * 1.1, Math.sin(a + 0.5) * R * 1.1); g.stroke(); } g.globalCompositeOperation = 'source-over'; _blob(g, 0, 0, R * 0.4, '#ffffff', 0.7); },
  web(g, R, d) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = R * 0.025; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); } for (let k = 1; k <= 5; k++) { const rr = k / 5 * R; g.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU; const r2 = rr * (i % 2 ? 0.92 : 1); i ? g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2) : g.moveTo(r2, 0); } g.stroke(); } g.fillStyle = d.c2; _poly(g, [[0, -R * 0.28], [R * 0.13, 0], [0, R * 0.28], [-R * 0.13, 0]]); g.fill(); },
  grid(g, R, d) { g.strokeStyle = rgba(d.c2, 0.55); g.lineWidth = R * 0.02; for (let i = -R; i <= R; i += R / 4) { g.beginPath(); g.moveTo(i, -R); g.lineTo(i, R); g.moveTo(-R, i); g.lineTo(R, i); g.stroke(); } g.fillStyle = d.c2; for (let i = -R; i <= R; i += R / 2) for (let j = -R; j <= R; j += R / 2) { g.beginPath(); g.arc(i, j, R * 0.045, 0, TAU); g.fill(); } _blob(g, 0, 0, R * 0.5, '#ffffff', 0.4); },
  rings(g, R, d) { g.lineWidth = R * 0.06; for (let k = 1; k <= 4; k++) { g.strokeStyle = rgba(k % 2 ? d.c2 : '#ffffff', 0.6); g.beginPath(); g.arc(0, 0, k / 4.4 * R, 0, TAU); g.stroke(); } },
  blood(g, R, d, rng) { for (let i = 0; i < 7; i++) _blob(g, (rng() - 0.5) * 1.6 * R, (rng() - 0.5) * 1.6 * R, R * 0.4, d.c2, 0.4); g.strokeStyle = rgba(d.c2, 0.75); g.lineWidth = R * 0.035; for (let i = 0; i < 6; i++) _bolt(g, 0, 0, Math.cos(i * 1.05) * R, Math.sin(i * 1.05) * R, rgba(d.c2, 0.6), R * 0.03, rng, 6); },
  stitches(g, R, d, rng) { for (let i = 0; i < 5; i++) _blob(g, (rng() - 0.5) * 1.6 * R, (rng() - 0.5) * 1.6 * R, R * 0.45, d.c2, 0.7); g.strokeStyle = 'rgba(20,20,10,.85)'; g.lineWidth = R * 0.035; for (let s = 0; s < 3; s++) { const y0 = (rng() - 0.5) * R * 1.2, a = (rng() - 0.5) * 0.8; g.beginPath(); g.moveTo(-R, y0 - a * R); g.lineTo(R, y0 + a * R); g.stroke(); for (let x = -R * 0.8; x <= R * 0.8; x += R * 0.2) { const y = y0 + a * x; g.beginPath(); g.moveTo(x - R * 0.05, y - R * 0.08); g.lineTo(x + R * 0.05, y + R * 0.08); g.stroke(); } } },
  nuclear(g, R, d) { _blob(g, 0, 0, R, '#ffffff', 0.25); g.fillStyle = d.c2; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; g.beginPath(); g.moveTo(Math.cos(a - 0.5) * R * 0.22, Math.sin(a - 0.5) * R * 0.22); g.arc(0, 0, R * 0.72, a - 0.5, a + 0.5); g.arc(0, 0, R * 0.22, a + 0.5, a - 0.5, true); g.fill(); } g.beginPath(); g.arc(0, 0, R * 0.14, 0, TAU); g.fill(); },
  crystal(g, R, d, rng) { const pts = []; for (let i = 0; i < 14; i++) pts.push([(rng() - 0.5) * 2 * R, (rng() - 0.5) * 2 * R]); for (let i = 0; i < 18; i++) { const a = pts[i % 14], b = pts[(i * 3 + 1) % 14], c = pts[(i * 5 + 2) % 14]; g.fillStyle = rgba(rng() > 0.5 ? d.c2 : '#ffffff', 0.12 + rng() * 0.25); _poly(g, [a, b, c]); g.fill(); } g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = R * 0.015; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[(i + 3) % 14][0], pts[(i + 3) % 14][1]); g.stroke(); } },
  vortex(g, R, d, rng) { _spiral(g, R, 4, d.c2, R * 0.08, 5, 0.7, rng); _blob(g, 0, 0, R * 0.3, '#000000', 0.9); },
  magnet(g, R, d) { g.fillStyle = d.c2; g.fillRect(0, -R, R, 2 * R); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-R * 0.06, -R, R * 0.12, 2 * R); g.font = `900 ${R * 0.5}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', -R * 0.48, 0); g.fillText('S', R * 0.48, 0); },
  smoke(g, R, d, rng) { for (let i = 0; i < 14; i++) _blob(g, (rng() - 0.5) * 2 * R, (rng() - 0.5) * 2 * R, R * (0.2 + rng() * 0.4), i % 3 ? d.c2 : d.c3, 0.35); },
  galaxy(g, R, d, rng) { g.fillStyle = shade(d.c1, -0.4); g.fillRect(-R, -R, 2 * R, 2 * R); _blob(g, 0, 0, R * 0.9, d.c3, 0.35); _spiral(g, R, 3, d.c2, 0, 5, 0.9, rng, true); _spiral(g, R, 3, '#ffffff', 0, 5, 0.5, rng, true); _stars(g, R, 60, rng, ['#ffffff', d.c2, d.c3]); _blob(g, 0, 0, R * 0.32, '#ffffff', 0.9); },
  blackhole(g, R, d, rng) { g.fillStyle = '#000'; g.fillRect(-R, -R, 2 * R, 2 * R); g.save(); g.scale(1, 0.38); for (let k = 0; k < 3; k++) { g.strokeStyle = rgba(k === 1 ? '#ffffff' : d.c2, 0.75 - k * 0.15); g.lineWidth = R * (0.2 - k * 0.05); g.beginPath(); g.arc(0, 0, R * (0.62 + k * 0.14), 0, TAU); g.stroke(); } g.restore(); g.strokeStyle = rgba(d.c3, 0.9); g.lineWidth = R * 0.06; g.beginPath(); g.arc(0, 0, R * 0.42, 0, TAU); g.stroke(); g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, R * 0.38, 0, TAU); g.fill(); _stars(g, R, 25, rng); },
  nebula(g, R, d, rng) { for (let i = 0; i < 12; i++) _blob(g, (rng() - 0.5) * 2 * R, (rng() - 0.5) * 2 * R, R * (0.3 + rng() * 0.5), [d.c2, d.c3, '#5ad1ff'][i % 3], 0.4); _stars(g, R, 45, rng); },
  portal(g, R, d, rng) { for (let k = 7; k >= 1; k--) { g.strokeStyle = rgba(k % 2 ? d.c1 : d.c2, 0.85); g.lineWidth = R * 0.08; g.beginPath(); g.arc(0, 0, k / 7 * R, k * 0.6, k * 0.6 + 4.6); g.stroke(); } _blob(g, 0, 0, R * 0.35, '#ffffff', 0.85); },
  clock(g, R, d) { g.strokeStyle = d.c2; g.fillStyle = d.c2; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.lineWidth = R * (i % 3 ? 0.03 : 0.07); g.beginPath(); g.moveTo(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72); g.lineTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); g.stroke(); } g.lineCap = 'round'; g.lineWidth = R * 0.08; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -R * 0.55); g.stroke(); g.lineWidth = R * 0.05; g.beginPath(); g.moveTo(0, 0); g.lineTo(R * 0.4, R * 0.2); g.stroke(); g.beginPath(); g.arc(0, 0, R * 0.08, 0, TAU); g.fill(); g.strokeStyle = rgba(d.c2, 0.5); g.lineWidth = R * 0.03; g.beginPath(); g.arc(0, 0, R * 0.62, 0, TAU); g.stroke(); },
  atom(g, R, d) { g.strokeStyle = rgba(d.c2, 0.9); g.lineWidth = R * 0.045; for (let i = 0; i < 3; i++) { g.save(); g.rotate(i / 3 * Math.PI); g.beginPath(); g.ellipse(0, 0, R * 0.85, R * 0.3, 0, 0, TAU); g.stroke(); g.restore(); } _blob(g, 0, 0, R * 0.3, '#ffffff', 0.95); g.fillStyle = d.c2; g.beginPath(); g.arc(0, 0, R * 0.12, 0, TAU); g.fill(); },
  eclipse(g, R, d) { g.fillStyle = '#050505'; g.fillRect(-R, -R, 2 * R, 2 * R); const gr = g.createRadialGradient(0, 0, R * 0.55, 0, 0, R); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.7, rgba(d.c2, 0.9)); gr.addColorStop(1, rgba('#ffffff', 0.95)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(R * 0.06, -R * 0.04, R * 0.62, 0, TAU); g.fill(); },
  constellation(g, R, d, rng) { g.fillStyle = shade(d.c1, -0.55); g.fillRect(-R, -R, 2 * R, 2 * R); _blob(g, 0, 0, R, d.c2, 0.35); const pts = []; for (let i = 0; i < 11; i++) { const a = rng() * TAU, rr = Math.sqrt(rng()) * R * 0.9; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } g.strokeStyle = rgba('#ffffff', 0.45); g.lineWidth = R * 0.015; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); pts.forEach(p => _blob(g, p[0], p[1], R * 0.08, '#ffffff', 1)); _stars(g, R, 30, rng); },
  scales(g, R, d) { g.strokeStyle = rgba(d.c2, 0.8); g.lineWidth = R * 0.035; const s = R * 0.24; for (let y = -R; y < R + s; y += s * 0.6) for (let x = -R; x < R + s; x += s) { const ox = (Math.round((y + R) / (s * 0.6)) % 2) * s / 2; g.fillStyle = rgba(d.c1, 0.6); g.beginPath(); g.arc(x + ox, y, s / 2, 0, Math.PI); g.fill(); g.stroke(); } },
  feather(g, R, d, rng) { for (let i = 0; i < 9; i++) { g.save(); g.rotate(i / 9 * TAU + rng() * 0.3); g.translate(0, -R * 0.45); g.fillStyle = rgba(i % 2 ? d.c2 : '#ffffff', 0.55); g.beginPath(); g.ellipse(0, 0, R * 0.14, R * 0.5, 0, 0, TAU); g.fill(); g.strokeStyle = rgba(shade(d.c2, -0.3), 0.7); g.lineWidth = R * 0.015; g.beginPath(); g.moveTo(0, -R * 0.45); g.lineTo(0, R * 0.45); g.stroke(); g.restore(); } _blob(g, 0, 0, R * 0.5, '#ffffff', 0.7); },
  eye(g, R, d) { _blob(g, 0, 0, R, d.c2, 0.35); g.fillStyle = 'rgba(255,230,200,.92)'; g.beginPath(); g.moveTo(-R * 0.75, 0); g.quadraticCurveTo(0, -R * 0.62, R * 0.75, 0); g.quadraticCurveTo(0, R * 0.62, -R * 0.75, 0); g.fill(); const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.32); gr.addColorStop(0, '#ffeb3b'); gr.addColorStop(0.5, d.c2); gr.addColorStop(1, shade(d.c2, -0.5)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.3, 0, TAU); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.ellipse(0, 0, R * 0.06, R * 0.26, 0, 0, TAU); g.fill(); },
  holy(g, R, d) { _rays(g, R, 16, d.c2, 0.4, 0.09); _blob(g, 0, 0, R * 0.85, '#ffffff', 0.9); g.fillStyle = rgba(d.c2, 0.95); _poly(g, [[0, -R * 0.5], [R * 0.1, -R * 0.1], [R * 0.5, 0], [R * 0.1, R * 0.1], [0, R * 0.5], [-R * 0.1, R * 0.1], [-R * 0.5, 0], [-R * 0.1, -R * 0.1]]); g.fill(); },
  chaos(g, R, d, rng) { for (let i = 0; i < 16; i++) { g.fillStyle = rgba([d.c2, '#ffffff', d.c3, '#000000'][i % 4], 0.35 + rng() * 0.3); const a = rng() * TAU; _poly(g, [[0, 0], [Math.cos(a) * R * 1.3, Math.sin(a) * R * 1.3], [Math.cos(a + 0.25) * R * 0.7, Math.sin(a + 0.25) * R * 0.7]]); g.fill(); } _blob(g, 0, 0, R * 0.3, '#000', 0.8); },
  runes(g, R, d, rng) { g.strokeStyle = rgba(d.c2, 0.9); g.lineWidth = R * 0.035; g.beginPath(); g.arc(0, 0, R * 0.78, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, R * 0.5, 0, TAU); g.stroke(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.save(); g.rotate(a); g.translate(0, -R * 0.64); g.beginPath(); g.moveTo(-R * 0.05, -R * 0.07); g.lineTo(R * 0.05 * (rng() > 0.5 ? 1 : -1), 0); g.lineTo(-R * 0.04, R * 0.07); g.moveTo(R * 0.04, -R * 0.07); g.lineTo(R * 0.04, R * 0.07); g.stroke(); g.restore(); } _blob(g, 0, 0, R * 0.42, d.c2, 0.6); },
  infinity(g, R, d, rng) { _spiral(g, R, 2, d.c2, R * 0.12, 6, 0.5, rng); _blob(g, 0, 0, R * 0.6, d.c3, 0.4); },
  multiverse(g, R, d, rng) { _stars(g, R, 50, rng, ['#ffffff', d.c2, d.c3]); for (let i = 0; i < 7; i++) { const a = rng() * TAU, rr = rng() * R * 0.75, s = R * (0.08 + rng() * 0.14); _blob(g, Math.cos(a) * rr, Math.sin(a) * rr, s * 2, i % 2 ? d.c2 : d.c3, 0.6); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = R * 0.012; g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, s, 0, TAU); g.stroke(); } },
  genesis(g, R, d, rng) { _spiral(g, R, 5, d.c2, R * 0.06, 2.5, 0.6, rng); _rays(g, R, 10, '#ffffff', 0.3, 0.06); _blob(g, 0, 0, R * 0.6, '#ffffff', 0.85); },
  cracks(g, R, d, rng) { g.fillStyle = shade(d.c1, -0.3); g.fillRect(-R, -R, 2 * R, 2 * R); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const a = rng() * TAU; _bolt(g, Math.cos(a) * R * 0.1, Math.sin(a) * R * 0.1, Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1, rgba(d.c2, 0.85), R * (0.03 + rng() * 0.04), rng, 6); } g.globalCompositeOperation = 'source-over'; _blob(g, 0, 0, R * 0.35, d.c2, 0.8); },
  glitch(g, R, d, rng) { for (let i = 0; i < 18; i++) { g.fillStyle = rgba([d.c2, d.c3, '#ffffff', '#000000'][i % 4], 0.5 + rng() * 0.4); g.fillRect((rng() - 0.6) * 2 * R, (rng() - 0.5) * 2 * R, R * (0.2 + rng() * 1.1), R * (0.03 + rng() * 0.12)); } for (let i = 0; i < 30; i++) { g.fillStyle = rgba(i % 2 ? d.c2 : d.c3, 0.8); const s = R * 0.07; g.fillRect(Math.round((rng() - 0.5) * 2 * R / s) * s, Math.round((rng() - 0.5) * 2 * R / s) * s, s, s); } },
  souls(g, R, d, rng) { for (let i = 0; i < 8; i++) { const x = (rng() - 0.5) * 1.5 * R, y = (rng() - 0.5) * 1.5 * R, s = R * (0.1 + rng() * 0.12); _blob(g, x, y, s * 2.2, d.c2, 0.5); g.fillStyle = rgba('#ffffff', 0.8); g.beginPath(); g.arc(x, y, s * 0.6, 0, Math.PI); g.lineTo(x, y - s * 1.8); g.closePath(); g.fill(); } },
  yinyang(g, R, d) { g.fillStyle = d.c2; g.beginPath(); g.arc(0, 0, R, -Math.PI / 2, Math.PI / 2); g.arc(0, R / 2, R / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -R / 2, R / 2, Math.PI / 2, -Math.PI / 2); g.fill(); g.beginPath(); g.arc(0, -R / 2, R * 0.14, 0, TAU); g.fill(); g.fillStyle = d.c1; g.beginPath(); g.arc(0, R / 2, R * 0.14, 0, TAU); g.fill(); },
  unknown(g, R, d, rng) { g.fillStyle = '#000'; g.fillRect(-R, -R, 2 * R, 2 * R); g.font = `700 ${R * 0.16}px monospace`; g.textAlign = 'center'; for (let x = -R; x < R; x += R * 0.16) for (let y = -R; y < R; y += R * 0.18) { if (rng() > 0.55) continue; g.fillStyle = rgba(d.c2, 0.2 + rng() * 0.7); g.fillText(rng() > 0.8 ? '?' : String.fromCharCode(0x30A0 + Math.floor(rng() * 90)), x, y); } },
  moon(g, R, d, rng) { _blob(g, 0, 0, R, d.c2, 0.45); for (let i = 0; i < 9; i++) { const a = rng() * TAU, rr = Math.sqrt(rng()) * R * 0.8, s = R * (0.07 + rng() * 0.16); g.fillStyle = rgba('#000000', 0.35); g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, s, 0, TAU); g.fill(); g.strokeStyle = rgba(d.c2, 0.6); g.lineWidth = R * 0.02; g.stroke(); } },
  aurora(g, R, d, rng) { for (let k = 0; k < 6; k++) { const x0 = (rng() - 0.5) * 2 * R; const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, rgba(k % 2 ? d.c2 : d.c3, 0)); gr.addColorStop(0.5, rgba(k % 2 ? d.c2 : '#b388ff', 0.7)); gr.addColorStop(1, rgba(d.c2, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(x0, -R); for (let y = -R; y <= R; y += 8) g.lineTo(x0 + Math.sin(y / R * 4 + k) * R * 0.25, y); for (let y = R; y >= -R; y -= 8) g.lineTo(x0 + R * 0.25 + Math.sin(y / R * 4 + k) * R * 0.25, y); g.fill(); } _stars(g, R, 25, rng); },
  sun(g, R, d, rng) { _dots(g, R, 40, d.c2, R * 0.04, R * 0.12, 0.45, rng); _rays(g, R, 10, '#ffffff', 0.18, 0.08); _blob(g, 0, 0, R * 0.7, '#fffde7', 0.8); },
  omega(g, R, d, rng) { g.fillStyle = shade(d.c1, -0.4); g.fillRect(-R, -R, 2 * R, 2 * R); _blob(g, 0, 0, R * 0.95, d.c3, 0.5); g.strokeStyle = rgba(d.c2, 0.8); g.lineWidth = R * 0.035; for (let k = 1; k <= 3; k++) { g.beginPath(); g.ellipse(0, 0, R * (0.35 + k * 0.18), R * (0.12 + k * 0.07), k * 1.1, 0, TAU); g.stroke(); } _stars(g, R, 30, rng); g.font = `900 ${R * 1.05}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.92)'; g.fillText('Ω', 0, R * 0.06); },
  phantom(g, R, d, rng) { for (let i = 0; i < 10; i++) _blob(g, (rng() - 0.5) * 1.6 * R, (rng() - 0.5) * 1.6 * R, R * (0.3 + rng() * 0.4), i % 2 ? d.c2 : '#ffffff', 0.28); _spiral(g, R, 3, '#ffffff', R * 0.03, 4, 0.35, rng); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc((rng() - 0.5) * 1.4 * R, (rng() - 0.5) * 1.4 * R, R * (0.1 + rng() * 0.12), 0, TAU); g.fill(); } g.globalCompositeOperation = 'source-over'; },
  core(g, R, d, rng) { PATTERN_FN.hex(g, R, { ...d, c2: d.c3 }); for (let k = 4; k >= 1; k--) { g.strokeStyle = rgba(k % 2 ? d.c2 : d.c3, 0.8); g.lineWidth = R * 0.05; g.beginPath(); g.arc(0, 0, k / 4.6 * R, 0, TAU); g.stroke(); } _blob(g, 0, 0, R * 0.42, '#ffffff', 0.95); _blob(g, 0, 0, R * 0.6, d.c2, 0.6); },
  void(g, R, d, rng) { g.fillStyle = '#000'; g.fillRect(-R, -R, 2 * R, 2 * R); const gr = g.createRadialGradient(0, 0, R * 0.5, 0, 0, R); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, rgba(d.c2, 0.85)); g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R); _spiral(g, R, 5, d.c3, R * 0.025, 3.5, 0.55, rng); _stars(g, R, 18, rng, [d.c2, '#ffffff']); },
  maw(g, R, d, rng) { _spiral(g, R, 6, d.c2, R * 0.05, 3, 0.55, rng); g.fillStyle = '#fff3e0'; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; g.beginPath(); g.moveTo(Math.cos(a - 0.12) * R * 0.62, Math.sin(a - 0.12) * R * 0.62); g.lineTo(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38); g.lineTo(Math.cos(a + 0.12) * R * 0.62, Math.sin(a + 0.12) * R * 0.62); g.fill(); } _blob(g, 0, 0, R * 0.34, '#000000', 1); _blob(g, 0, 0, R * 0.16, d.c3, 0.8); },
  prism(g, R, d, rng) { const hues = ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#00b0ff', '#651fff', '#d500f9']; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + rng() * 0.2; g.fillStyle = rgba(hues[i % 7], 0.45); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 1.3, Math.sin(a) * R * 1.3); g.lineTo(Math.cos(a + 0.5) * R * 1.3, Math.sin(a + 0.5) * R * 1.3); g.fill(); } PATTERN_FN.crystal(g, R, { ...d, c2: '#ffffff' }, rng); _blob(g, 0, 0, R * 0.35, '#ffffff', 0.9); },
  mirror(g, R, d, rng) { const s = R * 0.2; for (let y = -R; y < R; y += s) for (let x = -R; x < R; x += s) { const l = 0.45 + rng() * 0.55; g.fillStyle = toHex(200 * l + 40, 210 * l + 40, 230 * l + 25); g.fillRect(x + 1, y + 1, s - 2, s - 2); } for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,.9)'; const x = (rng() - 0.5) * 1.6 * R, y = (rng() - 0.5) * 1.6 * R; g.fillRect(x, y, s - 2, s - 2); } },
  reactor(g, R, d, rng) { _blob(g, 0, 0, R, d.c2, 0.4); g.save(); g.beginPath(); g.arc(0, 0, R * 0.95, 0, TAU); g.arc(0, 0, R * 0.72, 0, TAU, true); g.clip(); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#111' : '#ffd600'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, i / 16 * TAU, (i + 1) / 16 * TAU); g.fill(); } g.restore(); PATTERN_FN.nuclear(g, R * 0.7, { ...d, c2: '#111111' }); _blob(g, 0, 0, R * 0.22, d.c3, 1); },
  sonic(g, R, d, rng) { for (let k = 1; k <= 6; k++) { g.strokeStyle = rgba(k % 2 ? d.c2 : '#ffffff', 0.7); g.lineWidth = R * 0.05; g.beginPath(); g.arc(-R * 0.6, 0, k * R * 0.28, -0.7, 0.7); g.stroke(); } g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = R * 0.03; for (let i = 0; i < 9; i++) { const y = (rng() - 0.5) * 1.6 * R; g.beginPath(); g.moveTo(-R, y); g.lineTo(-R + R * (0.4 + rng() * 0.8), y); g.stroke(); } },
  magnetar(g, R, d, rng) { _blob(g, 0, 0, R, d.c3, 0.35); g.lineWidth = R * 0.03; for (let k = 1; k <= 5; k++) { g.strokeStyle = rgba(k % 2 ? d.c2 : d.c3, 0.75); g.beginPath(); g.ellipse(-R * 0.45 * k / 5, 0, R * 0.45 * k / 5, R * 0.75 * k / 5 + R * 0.1, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(R * 0.45 * k / 5, 0, R * 0.45 * k / 5, R * 0.75 * k / 5 + R * 0.1, 0, 0, TAU); g.stroke(); } _blob(g, 0, -R * 0.8, R * 0.25, '#ffffff', 0.9); _blob(g, 0, R * 0.8, R * 0.25, '#ffffff', 0.9); _blob(g, 0, 0, R * 0.2, '#ffffff', 1); },
  rift(g, R, d, rng) { _stars(g, R, 30, rng, [d.c3, '#ffffff']); const pts = []; for (let i = 0; i <= 8; i++) pts.push([-R + i * R / 4, (rng() - 0.5) * R * 0.5 + (i - 4) * R * 0.12]); g.globalCompositeOperation = 'lighter'; for (const [w, c] of [[R * 0.32, rgba(d.c3, 0.4)], [R * 0.16, rgba(d.c2, 0.9)], [R * 0.05, '#ffffff']]) { g.strokeStyle = c; g.lineWidth = w; g.lineJoin = 'miter'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); } g.globalCompositeOperation = 'source-over'; },
  starscale(g, R, d, rng) { PATTERN_FN.scales(g, R, d); _stars(g, R, 40, rng, ['#ffffff', d.c2, d.c3]); _blob(g, 0, 0, R * 0.5, d.c3, 0.35); },
  miracle(g, R, d, rng) { _rays(g, R, 12, d.c3, 0.35, 0.1); _blob(g, 0, 0, R * 0.8, '#ffffff', 0.85); for (let i = 0; i < 12; i++) { const a = rng() * TAU, rr = rng() * R * 0.85, s = R * (0.04 + rng() * 0.05); g.fillStyle = rgba(i % 2 ? d.c2 : d.c3, 0.9); _poly(g, [[Math.cos(a) * rr, Math.sin(a) * rr - s * 2], [Math.cos(a) * rr + s, Math.sin(a) * rr], [Math.cos(a) * rr, Math.sin(a) * rr + s * 2], [Math.cos(a) * rr - s, Math.sin(a) * rr]]); g.fill(); } g.fillStyle = rgba(d.c2, 0.95); _poly(g, [[0, -R * 0.42], [R * 0.09, -R * 0.09], [R * 0.42, 0], [R * 0.09, R * 0.09], [0, R * 0.42], [-R * 0.09, R * 0.09], [-R * 0.42, 0], [-R * 0.09, -R * 0.09]]); g.fill(); },
  petals(g, R, d, rng) { for (let i = 0; i < 14; i++) { g.save(); g.translate((rng() - 0.5) * 1.7 * R, (rng() - 0.5) * 1.7 * R); g.rotate(rng() * TAU); g.fillStyle = rgba(i % 2 ? d.c2 : '#ffffff', 0.7); g.beginPath(); g.ellipse(0, 0, R * 0.16, R * 0.08, 0, 0, TAU); g.fill(); g.restore(); } _blob(g, 0, 0, R * 0.5, '#ffffff', 0.5); },
};

/* body texture sprite (rotating part) */
function bodySprite(def, size, variant = 'base', evo = 0) {
  const d = variant === 'god' ? godDesign(def.design) : def.design;
  const key = `${def.id}|${variant}|${size}|${evo}|${d.c1}${d.c2}${d.c3}${d.pat}${d.sym}`;
  return SpriteCache.get(key, () => {
    const c = makeCanvas(size), g = c.getContext('2d'), R = size / 2;
    g.translate(R, R); g.save(); g.beginPath(); g.arc(0, 0, R - 1, 0, TAU); g.clip();
    const bg = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    bg.addColorStop(0, shade(d.c1, 0.22)); bg.addColorStop(1, shade(d.c1, -0.32));
    g.fillStyle = bg; g.fillRect(-R, -R, size, size);
    const rng = mulberry32(hashStr(def.id + d.pat));
    try { (PATTERN_FN[d.pat] || PATTERN_FN.solid)(g, R, d, rng); } catch (e) { console.warn('pattern', d.pat, e); }
    if (evo >= 2) { g.strokeStyle = rgba(d.c2, 0.55); g.lineWidth = R * 0.05; g.setLineDash([R * 0.12, R * 0.08]); g.beginPath(); g.arc(0, 0, R * 0.86, 0, TAU); g.stroke(); g.setLineDash([]); }
    if (d.sym) { g.font = `900 ${R * 0.95}px "Segoe UI Symbol", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = rgba(luminance(d.c1) > 0.6 ? '#000000' : '#ffffff', 0.35); g.fillText(d.sym, 0, R * 0.05); }
    g.restore();
    return c;
  });
}
/* static lighting overlay shared by every ball */
function shadeSprite(size) {
  return SpriteCache.get('shade|' + size, () => {
    const c = makeCanvas(size), g = c.getContext('2d'), R = size / 2;
    g.translate(R, R);
    const sh = g.createRadialGradient(-R * 0.35, -R * 0.42, R * 0.04, 0, 0, R * 1.02);
    sh.addColorStop(0, 'rgba(255,255,255,0.42)'); sh.addColorStop(0.3, 'rgba(255,255,255,0.05)');
    sh.addColorStop(0.72, 'rgba(0,0,0,0.1)'); sh.addColorStop(1, 'rgba(0,0,0,0.62)');
    g.fillStyle = sh; g.beginPath(); g.arc(0, 0, R - 1, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-R * 0.38, -R * 0.48, R * 0.2, R * 0.1, -0.6, 0, TAU); g.fill();
    return c;
  });
}
/* soft glow dot (aura / particles / projectiles) */
function glowSprite(col) {
  if (col && col[0] === 'h') { const m = col.match(/hsl\((\d+)/); const hue = m ? +m[1] : 0; col = ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#00b0ff', '#651fff', '#d500f9'][Math.floor(hue / 52) % 7]; }
  return SpriteCache.get('glow|' + col, () => {
    const c = makeCanvas(64), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 0.9)); gr.addColorStop(0.25, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  });
}

/* ---------- floating attachments (wings, rings, crowns...) — the body always stays a sphere ---------- */
function _wing(ctx, side, r, flap, col, edge, feathers = 5, scale = 1, lift = 0) {
  ctx.save(); ctx.scale(side, 1); ctx.translate(r * 0.62, -r * 0.1 + lift); ctx.rotate(-flap - 0.15); ctx.scale(scale, scale);
  for (let i = 0; i < feathers; i++) {
    const a = -0.95 + i * (1.35 / (feathers - 1)), L = r * (1.25 - i * 0.12);
    ctx.save(); ctx.rotate(a);
    const gr = ctx.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, rgba(col, 0.95)); gr.addColorStop(1, rgba(edge, 0.75));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, -r * 0.07); ctx.quadraticCurveTo(L * 0.6, -r * 0.2, L, 0); ctx.quadraticCurveTo(L * 0.6, r * 0.14, 0, r * 0.07); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function _batwing(ctx, side, r, flap, col, edge) {
  ctx.save(); ctx.scale(side, 1); ctx.translate(r * 0.6, -r * 0.15); ctx.rotate(-flap * 0.8);
  const tips = [[r * 0.5, -r * 0.95], [r * 1.25, -r * 0.7], [r * 1.5, -r * 0.05]];
  const gr = ctx.createLinearGradient(0, 0, r * 1.5, 0); gr.addColorStop(0, rgba(col, 0.95)); gr.addColorStop(1, rgba(edge, 0.8));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, -r * 0.2);
  ctx.lineTo(tips[0][0], tips[0][1]); ctx.lineTo(tips[1][0], tips[1][1]); ctx.lineTo(tips[2][0], tips[2][1]);
  ctx.quadraticCurveTo(r * 1.05, r * 0.05, r * 0.95, r * 0.35); ctx.quadraticCurveTo(r * 0.6, r * 0.15, r * 0.4, r * 0.4); ctx.quadraticCurveTo(r * 0.2, r * 0.1, 0, r * 0.25); ctx.fill();
  ctx.strokeStyle = rgba(edge, 0.9); ctx.lineWidth = r * 0.04; ctx.beginPath(); tips.forEach(t => { ctx.moveTo(0, -r * 0.05); ctx.lineTo(t[0], t[1]); }); ctx.stroke();
  ctx.restore();
}
function _ringHalf(ctx, r, col, tilt, front, rx = 1.55, ry = 0.36, lw = 0.09) {
  ctx.save(); ctx.rotate(tilt); ctx.lineCap = 'round';
  const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = r * lw * 2.2; ctx.beginPath(); ctx.ellipse(0, 0, r * rx, r * ry, 0, a0, a1); ctx.stroke();
  ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = r * lw; ctx.beginPath(); ctx.ellipse(0, 0, r * rx, r * ry, 0, a0, a1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = r * lw * 0.3; ctx.beginPath(); ctx.ellipse(0, 0, r * rx, r * ry, 0, a0, a1); ctx.stroke();
  ctx.restore();
}
function _flames(ctx, r, col, t, n = 9, hmul = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (i + 0.5) / n * Math.PI * 2, fl = 0.5 + 0.5 * Math.sin(t * 9 + i * 2.3);
    const L = r * (0.35 + fl * 0.4) * hmul * (Math.sin(a) < 0 ? 1.25 : 0.7);
    ctx.save(); ctx.rotate(a + Math.PI / 2);
    const gr = ctx.createLinearGradient(0, -r * 0.85, 0, -r - L); gr.addColorStop(0, rgba(col, 0.75)); gr.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-r * 0.24, -r * 0.85); ctx.quadraticCurveTo(-r * 0.1, -r - L * 0.5, 0, -r - L); ctx.quadraticCurveTo(r * 0.1, -r - L * 0.5, r * 0.24, -r * 0.85); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function _crown(ctx, r, col1, col2, gem, bob, big = 1) {
  ctx.save(); ctx.translate(0, -r * 0.88 + bob); ctx.scale(big, big);
  const w = r * 0.62, hh = r * 0.55;
  const gr = ctx.createLinearGradient(0, -hh, 0, 0); gr.addColorStop(0, col1); gr.addColorStop(1, col2);
  ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(80,40,0,.7)'; ctx.lineWidth = r * 0.03;
  _poly(ctx, [[-w, 0], [-w * 1.05, -hh * 0.85], [-w * 0.5, -hh * 0.4], [0, -hh * 1.1], [w * 0.5, -hh * 0.4], [w * 1.05, -hh * 0.85], [w, 0]]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = gem; [[-w * 1.05, -hh * 0.85], [0, -hh * 1.1], [w * 1.05, -hh * 0.85]].forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.075, 0, TAU); ctx.fill(); });
  ctx.fillRect(-w, -r * 0.1, w * 2, r * 0.1);
  ctx.restore();
}
function _horns(ctx, r, col, edge) {
  for (const s of [-1, 1]) {
    ctx.save(); ctx.scale(s, 1);
    const gr = ctx.createLinearGradient(r * 0.3, -r * 0.6, r * 0.95, -r * 1.5); gr.addColorStop(0, col); gr.addColorStop(1, edge);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(r * 0.25, -r * 0.82); ctx.quadraticCurveTo(r * 0.95, -r * 1.0, r * 0.98, -r * 1.55); ctx.quadraticCurveTo(r * 0.75, -r * 1.05, r * 0.62, -r * 0.55); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function _halo(ctx, r, col, bob, scale = 1) {
  ctx.save(); ctx.translate(0, -r * 1.28 + bob); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = r * 0.2; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62 * scale, r * 0.17 * scale, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62 * scale, r * 0.17 * scale, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}
function _orbitDots(ctx, r, col, t, front, n = 4, rx = 1.6, ry = 0.5, tilt = -0.3, size = 0.11, speed = 2.2) {
  const gs = glowSprite(col);
  for (let i = 0; i < n; i++) {
    const a = t * speed + i / n * TAU, sn = Math.sin(a);
    if ((sn > 0) !== front) continue;
    const x = Math.cos(a) * r * rx, y = sn * r * ry, ct = Math.cos(tilt), st = Math.sin(tilt);
    const px = x * ct - y * st, py = x * st + y * ct, s = r * size * (front ? 1.15 : 0.8);
    ctx.drawImage(gs, px - s * 3, py - s * 3, s * 6, s * 6);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, s * 0.55, 0, TAU); ctx.fill();
  }
}
function _crystals(ctx, r, col, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 0.9 + i / 3 * TAU, x = Math.cos(a) * r * 1.5, y = Math.sin(a) * r * 1.5 * 0.55 - r * 0.2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 + i);
    ctx.fillStyle = rgba(col, 0.85); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = r * 0.025;
    _poly(ctx, [[0, -r * 0.24], [r * 0.12, 0], [0, r * 0.24], [-r * 0.12, 0]]); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
function _spikes(ctx, r, col, rot, n = 10) {
  ctx.save(); ctx.rotate(rot); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = r * 0.02;
  for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.17) * r * 0.93, Math.sin(a - 0.17) * r * 0.93); ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); ctx.lineTo(Math.cos(a + 0.17) * r * 0.93, Math.sin(a + 0.17) * r * 0.93); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function _fangs(ctx, r) {
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = r * 0.02;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.12, r * 0.48); ctx.lineTo(s * r * 0.3, r * 0.45); ctx.lineTo(s * r * 0.21, r * 0.78); ctx.closePath(); ctx.fill(); ctx.stroke(); }
}
function _armor(ctx, r, col, rot) {
  ctx.save(); ctx.rotate(rot * 0.35);
  const segs = 6, gr = ctx.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, '#eceff1'); gr.addColorStop(0.5, col); gr.addColorStop(1, '#37474f');
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * TAU + 0.1, a1 = (i + 1) / segs * TAU - 0.1, am = (a0 + a1) / 2;
    ctx.strokeStyle = gr; ctx.lineWidth = r * 0.15; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(0, 0, r * 1.03, a0, a1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = r * 0.025; ctx.beginPath(); ctx.arc(0, 0, r * 1.09, a0 + 0.05, a1 - 0.05); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(Math.cos(am) * r * 1.03, Math.sin(am) * r * 1.03, r * 0.035, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function _lightRays(ctx, r, col, t, n = 12, len = 2.4, a = 0.22) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.rotate(t * 0.5);
  const gr = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * len); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = gr;
  for (let i = 0; i < n; i++) { const an = i / n * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an - 0.09) * r * len, Math.sin(an - 0.09) * r * len); ctx.lineTo(Math.cos(an + 0.09) * r * len, Math.sin(an + 0.09) * r * len); ctx.fill(); }
  ctx.restore();
}

/**
 * Draws a complete ball at (x,y) radius r.
 * st: { rot, t, evo, god, rage, alpha, flash, scale, noAura, quality }
 */
/* Portal Master: two glowing eyes (fixed, they don't spin with the body) and floating portal symbols */
function _eyes(ctx, r, col, t, angry) {
  const blink = (t % 4.3) < 0.12 ? 0.15 : 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const sx of [-1, 1]) {
    const ex = sx * r * 0.32, ey = -r * 0.1;
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), ex - r * 0.36, ey - r * 0.3, r * 0.72, r * 0.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(sx * (angry ? 0.32 : 0.18)); ctx.scale(1, blink);
    ctx.shadowColor = col; ctx.shadowBlur = r * 0.25;
    ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.19, r * 0.085, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;   // violet glowing eye
    ctx.fillStyle = rgba(mixColor(col, '#ffffff', 0.55), 1); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.11, r * 0.045, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(r * 0.02, -r * 0.005, r * 0.035, r * 0.018, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function _portalSigils(ctx, r, col, t, front) {
  for (let k = 0; k < 3; k++) {
    const a = t * 0.9 + k / 3 * TAU, z = Math.sin(a);
    if ((z > 0) !== front) continue;
    const x = Math.cos(a) * r * 1.55, y = z * r * 0.42 - r * 0.15, s = r * (0.2 + 0.05 * z);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-t * 2.5 + k);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), -s * 1.8, -s * 1.8, s * 3.6, s * 3.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(6,0,14,.92)'; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.82, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = Math.max(1, s * 0.18); ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.82, 0, 0.2, TAU - 0.6); ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = Math.max(0.8, s * 0.08); ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.45, 0, 1, 4.5); ctx.stroke();
    ctx.restore();
  }
}
function drawBall(ctx, def, x, y, r, st = {}) {
  const t = st.t ?? now(), d = st.god ? godDesign(def.design) : def.design, deco = def.design.deco || [];
  const evo = st.evo || 0, glowMul = (def.design.glow || 1) * (1 + evo * 0.18) * (st.god ? 1.6 : 1);
  const flap = Math.sin(t * 5) * 0.18, bob = Math.sin(t * 3) * r * 0.04;
  ctx.save(); ctx.translate(x, y); if (st.alpha != null) ctx.globalAlpha = st.alpha;
  if (st.scale) ctx.scale(st.scale, st.scale);

  /* --- back layer: aura, rays, wings, flames, ring back --- */
  if (!st.noAura) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const pulse = 1 + Math.sin(t * 4) * 0.05, ar = Math.min(st.auraMax || 1e9, r * 2.1 * pulse * Math.min(1.7, 0.85 + glowMul * 0.25));
    ctx.drawImage(glowSprite(st.auraCol || d.c3), -ar, -ar, ar * 2, ar * 2);
    if (st.rage) { const rr = Math.min(st.auraMax || 1e9, r * 2.5 * (1 + Math.sin(t * 12) * 0.06)); ctx.drawImage(glowSprite(rageColor(def.design)), -rr, -rr, rr * 2, rr * 2); }
    ctx.restore();
  }
  if (st.god) {
    _lightRays(ctx, r, d.c2, t, 14, 2.8, 0.3);
    if (def.id === 'oneaboveall') { ctx.save(); ctx.rotate(-t * 0.8); ctx.strokeStyle = rgba('#e0aaff', 0.6); ctx.lineWidth = r * 0.05; for (let k = 0; k < 2; k++) { ctx.rotate(Math.PI / 3); _poly(ctx, [[0, -r * 1.9], [r * 1.65, r * 0.95], [-r * 1.65, r * 0.95]]); ctx.stroke(); } ctx.restore(); }
  } else if (evo >= 3) _lightRays(ctx, r, d.c3, t, 8, 1.9, 0.16);
  if (st.rage) _flames(ctx, r * 1.02, rageColor(def.design), t, 12, 1.3);
  if (deco.includes('flames')) _flames(ctx, r, d.c3, t + 1.3);
  const wingCol = st.god ? '#fff8e1' : mixColor(d.c1, '#ffffff', 0.55), wingEdge = st.god ? '#ffd54f' : d.c3;
  const six = deco.includes('sixwings') || (st.god && def.id === 'archangel');
  if (six) { for (const s of [-1, 1]) { _wing(ctx, s, r, flap, wingCol, wingEdge, 5, 1.05, -r * 0.35); _wing(ctx, s, r, flap * 0.7 - 0.5, wingCol, wingEdge, 4, 0.75, r * 0.35); _wing(ctx, s, r, flap * 0.5 + 0.55, wingCol, wingEdge, 4, 0.7, -r * 0.65); } }
  else if (deco.includes('wings')) for (const s of [-1, 1]) _wing(ctx, s, r, flap, wingCol, wingEdge, 6, st.god ? 1.25 : 1);
  if (deco.includes('batwings')) for (const s of [-1, 1]) _batwing(ctx, s, r, flap, shade(d.c1, -0.2), d.c2);
  if (deco.includes('ring')) _ringHalf(ctx, r, d.c2, -0.35, false);
  if (st.god) { _ringHalf(ctx, r, d.c2, 0.6 + t * 0.3, false, 1.75, 0.3, 0.06); }
  if (deco.includes('orbit')) _orbitDots(ctx, r, d.c3, t, false);
  if (deco.includes('portals')) _portalSigils(ctx, r, d.c3, t, false);
  if (def.design.sdeco && typeof drawSupDeco === 'function') drawSupDeco(ctx, def, r, t, st, false);
  if (evo >= 1 && !deco.includes('orbit') && !deco.includes('portals')) _orbitDots(ctx, r, d.c2, t * 0.8, false, 2, 1.45, 0.4, 0.4, 0.08);

  /* --- body: rotating texture + static lighting --- */
  if (deco.includes('spikes')) _spikes(ctx, r, shade(d.c2, -0.15), st.rot || 0);
  const big = st.spriteSize || (r > 70 || st.big ? 256 : (st.small ? 96 : 160));
  ctx.save(); ctx.rotate(st.rot || 0);
  ctx.drawImage(bodySprite(def, big, st.god ? 'god' : 'base', evo), -r, -r, r * 2, r * 2);
  ctx.restore();
  ctx.drawImage(shadeSprite(big), -r, -r, r * 2, r * 2);
  if (st.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, st.flash * 5)})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); }
  if (st.tint) { ctx.fillStyle = st.tint; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); }
  if (st.skin) { ctx.fillStyle = rgba(st.skin.tint, st.skin.amt); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(st.skin.tint === '#000000' ? '#b388ff' : st.skin.tint, 0.9); ctx.lineWidth = r * 0.06; ctx.stroke(); }
  ctx.lineWidth = Math.max(1.5, r * 0.055); ctx.strokeStyle = rgba(st.rage ? rageColor(def.design) : d.c3, 0.95);
  ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, TAU); ctx.stroke();
  if (evo >= 1) { ctx.lineWidth = Math.max(1, r * 0.025); ctx.strokeStyle = rgba(d.c2, 0.8); ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.stroke(); }

  /* --- front layer --- */
  if (deco.includes('ring')) _ringHalf(ctx, r, d.c2, -0.35, true);
  if (st.god) _ringHalf(ctx, r, d.c2, 0.6 + t * 0.3, true, 1.75, 0.3, 0.06);
  if (deco.includes('orbit')) _orbitDots(ctx, r, d.c3, t, true);
  if (deco.includes('portals')) _portalSigils(ctx, r, d.c3, t, true);
  if (def.design.sdeco && typeof drawSupDeco === 'function') drawSupDeco(ctx, def, r, t, st, true);
  if (evo >= 1 && !deco.includes('orbit') && !deco.includes('portals')) _orbitDots(ctx, r, d.c2, t * 0.8, true, 2, 1.45, 0.4, 0.4, 0.08);
  if (deco.includes('eyes')) _eyes(ctx, r, st.god ? '#ffd54f' : '#b14dff', t, st.rage);
  if (deco.includes('antenna')) _antenna(ctx, r, d.c3, t);
  if (deco.includes('holo')) _holoRing(ctx, r, d.c2, d.c3, t);
  if (deco.includes('motes')) _motes(ctx, r, d.c3, t);
  if (deco.includes('crystals')) _crystals(ctx, r, d.c2, t);
  if (deco.includes('armor')) _armor(ctx, r, d.c2, st.rot || 0);
  if (deco.includes('fangs')) _fangs(ctx, r);
  if (deco.includes('horns')) _horns(ctx, r, mixColor(d.c2, '#ffffff', 0.3), shade(d.c1, -0.4));
  if (deco.includes('halo') || (st.god && def.id === 'archangel')) _halo(ctx, r, st.god ? '#fff59d' : d.c2, bob, st.god ? 1.25 : 1);
  if (deco.includes('crown')) _crown(ctx, r, '#fff59d', '#ff9800', d.c2 === '#ffc107' ? '#ff4081' : d.c2, bob, st.god ? 1.2 : 1);
  if (evo >= 2) { ctx.save(); ctx.rotate(t * 0.6); ctx.strokeStyle = rgba(d.c2, 0.55); ctx.lineWidth = r * 0.04; ctx.setLineDash([r * 0.18, r * 0.14]); ctx.beginPath(); ctx.arc(0, 0, r * 1.22, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  ctx.restore();
}

/* resolve an equipped loadout {slot: cosmeticId} into drawable properties */
function resolveCos(lo) {
  const out = {};
  for (const [slot, id] of Object.entries(lo || {})) { const c = (typeof COSMETICS !== 'undefined' ? COSMETICS : []).find(x => x.id === id && x.slot === slot); if (c) out[slot] = c; }
  return Object.keys(out).length ? out : null;
}
const cosColor = (c, t) => c === 'rainbow' ? `hsl(${(t * 220) % 360},100%,62%)` : c;
/* draws a static/animated preview into a small canvas */
function drawPreview(canvas, def, opts = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = opts.size || canvas.clientWidth || canvas.width, chh = opts.size || canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(chh * dpr); }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cw, chh);
  const deco = def.design.deco || [], wide = deco.some(d => /wings/.test(d)) || deco.includes('ring');
  const r = Math.min(cw, chh) * (wide ? 0.25 : 0.3);
  drawBall(ctx, def, cw / 2, chh / 2 + r * 0.12, r, { t: opts.t ?? 1.2, rot: opts.rot || 0, evo: opts.evo || 0, god: opts.god, rage: opts.rage, small: cw < 120, big: cw > 200, auraMax: Math.min(cw, chh) / 2 - r * 0.12 });
}

/* =====================================================================
   6. ARENA, PARTICLES & VISUAL EFFECTS
   Arena = simple rectangular box: dark navy floor, thick dark-blue walls,
   glowing blue edges and slightly bevelled corners (reference screenshot).
   ===================================================================== */
function chamferPath(ctx, x, y, w, hh, c) {
  ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + hh - c);
  ctx.lineTo(x + w - c, y + hh); ctx.lineTo(x + c, y + hh); ctx.lineTo(x, y + hh - c); ctx.lineTo(x, y + c); ctx.closePath();
}
const Arena = {
  canvas: null, key: '', hits: [],
  render(pxScale) {
    const key = pxScale.toFixed(3); if (this.key === key && this.canvas) return; this.key = key;
    const c = this.canvas || (this.canvas = makeCanvas(1)); c.width = Math.round(W * pxScale); c.height = Math.round(H * pxScale);
    const g = c.getContext('2d'); g.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    g.fillStyle = '#040816'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.75); vg.addColorStop(0, 'rgba(20,40,110,.18)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const ox = ARENA.x - WALL, oy = ARENA.y - WALL, ow = ARENA.w + WALL * 2, oh = ARENA.h + WALL * 2;
    // outer glow + wall body
    g.save(); g.shadowColor = '#1f6bff'; g.shadowBlur = 28; chamferPath(g, ox, oy, ow, oh, 22);
    const wg = g.createLinearGradient(0, oy, 0, oy + oh); wg.addColorStop(0, '#12358f'); wg.addColorStop(0.5, '#0b2466'); wg.addColorStop(1, '#0a1f5a');
    g.fillStyle = wg; g.fill(); g.restore();
    g.lineWidth = 2.5; g.strokeStyle = '#3a86ff'; g.save(); g.shadowColor = '#3a86ff'; g.shadowBlur = 14; chamferPath(g, ox, oy, ow, oh, 22); g.stroke(); g.restore();
    // bevel: lighter top/left inner band, darker bottom/right band
    g.lineWidth = 2; g.strokeStyle = 'rgba(140,185,255,.28)'; chamferPath(g, ox + 6, oy + 6, ow - 12, oh - 12, 18); g.stroke();
    // floor
    chamferPath(g, ARENA.x, ARENA.y, ARENA.w, ARENA.h, 12);
    const fg = g.createRadialGradient(ARENA.cx, ARENA.cy, 40, ARENA.cx, ARENA.cy, ARENA.w * 0.62);
    fg.addColorStop(0, '#0e1f52'); fg.addColorStop(1, '#070f2c'); g.fillStyle = fg; g.fill();
    // inner shadow
    g.save(); chamferPath(g, ARENA.x, ARENA.y, ARENA.w, ARENA.h, 12); g.clip();
    g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 30; g.lineWidth = 30; g.strokeStyle = 'rgba(0,0,0,.6)'; chamferPath(g, ARENA.x - 15, ARENA.y - 15, ARENA.w + 30, ARENA.h + 30, 18); g.stroke(); g.restore();
    // glowing inner edge
    g.save(); g.shadowColor = '#4d9bff'; g.shadowBlur = 22; g.lineWidth = 3.5; g.strokeStyle = '#4d9bff'; chamferPath(g, ARENA.x, ARENA.y, ARENA.w, ARENA.h, 12); g.stroke(); g.restore();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(200,225,255,.85)'; chamferPath(g, ARENA.x, ARENA.y, ARENA.w, ARENA.h, 12); g.stroke();
  },
  wallHit(x, y, col) { if (this.hits.length < 24) this.hits.push({ x, y, col, t: 0 }); },
  draw(ctx, dt) {
    ctx.drawImage(this.canvas, 0, 0, W, H);
    if (!this.hits.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const hh = this.hits[i]; hh.t += dt; const a = 1 - hh.t / 0.4; if (a <= 0) { this.hits.splice(i, 1); continue; }
      const s = 70 * (1 + hh.t * 2); ctx.globalAlpha = a; ctx.drawImage(glowSprite(hh.col || '#4d9bff'), hh.x - s, hh.y - s, s * 2, s * 2);
    }
    ctx.restore();
  },
};

const FX = {
  parts: [], texts: [], rings: [], bolts: [], shake: 0, flash: 0, flashCol: '#ffffff', slowmo: 0,
  cap() { return { low: 140, medium: 380, high: 850 }[SAVE.settings.particles] || 380; },
  reset() { this.parts.length = 0; this.texts.length = 0; this.rings.length = 0; this.bolts.length = 0; this.shake = 0; this.flash = 0; this.slowmo = 0; Arena.hits.length = 0; },
  p(x, y, vx, vy, life, size, col, type = 'dot', drag = 2, grav = 0) {
    if (this.off) return;
    if (this.parts.length >= this.cap()) { if (type === 'dot' && Math.random() < 0.6) return; this.parts.shift(); }
    this.parts.push({ x, y, vx, vy, life, max: life, size, col, type, drag, grav, rot: vr(TAU), vr: vr(-8, 8) });
  },
  burst(x, y, col, n = 14, speed = 260, size = 5, life = 0.6, type = 'dot') {
    const q = SAVE.settings.particles === 'low' ? 0.4 : SAVE.settings.particles === 'medium' ? 0.7 : 1;
    n = Math.ceil(n * q);
    for (let i = 0; i < n; i++) { const a = vr(TAU), s = vr(0.25, 1) * speed; this.p(x, y, Math.cos(a) * s, Math.sin(a) * s, life * vr(0.6, 1.2), size * vr(0.6, 1.3), col, type); }
  },
  sparks(x, y, col, n = 8, speed = 420, dir) {
    for (let i = 0; i < n; i++) { const a = dir == null ? vr(TAU) : dir + vr(-0.9, 0.9), s = vr(0.4, 1) * speed; this.p(x, y, Math.cos(a) * s, Math.sin(a) * s, vr(0.2, 0.45), vr(1.5, 3), col, 'spark', 3); }
  },
  text(x, y, str, col = '#fff', size = 22, opts = {}) {
    if (this.off) return;
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, str, col, size, life: opts.life || 0.9, max: opts.life || 0.9, vy: opts.vy ?? -70, pop: opts.pop ?? 1, stroke: opts.stroke || '#000' });
  },
  ring(x, y, col, r1 = 120, life = 0.45, w = 8, r0 = 0) { if (this.off) return; if (this.rings.length < 40) this.rings.push({ x, y, col, r0, r1, life, max: life, w }); },
  bolt(x0, y0, x1, y1, col = '#fff27a', w = 5, life = 0.22) {
    if (this.off) return;
    const pts = [[x0, y0]], seg = Math.max(4, Math.round(len(x1 - x0, y1 - y0) / 40));
    const nx = -(y1 - y0), ny = x1 - x0, nl = len(nx, ny) || 1;
    for (let i = 1; i < seg; i++) { const t = i / seg, off = vr(-28, 28); pts.push([lerp(x0, x1, t) + nx / nl * off, lerp(y0, y1, t) + ny / nl * off]); }
    pts.push([x1, y1]); this.bolts.push({ pts, col, w, life, max: life });
  },
  addShake(m) { if (SAVE.settings.shake) this.shake = Math.min(22, this.shake + m); },
  addFlash(a, col = '#ffffff') { if (SAVE.settings.flashes) { this.flash = Math.min(0.32, this.flash + a); this.flashCol = col; } },
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt; if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; t.y += t.vy * dt; t.vy *= Math.exp(-2 * dt); if (t.life <= 0) this.texts.splice(i, 1); }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.life -= dt; if (r.life <= 0) this.rings.splice(i, 1); }
    for (let i = this.bolts.length - 1; i >= 0; i--) { const b = this.bolts[i]; b.life -= dt; if (b.life <= 0) this.bolts.splice(i, 1); }
    this.shake *= Math.exp(-9 * dt); if (this.shake < 0.1) this.shake = 0;
    this.flash *= Math.exp(-7 * dt);
  },
  drawWorld(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const t = 1 - r.life / r.max, rad = lerp(r.r0, r.r1, 1 - Math.pow(1 - t, 3));
      ctx.globalAlpha = (1 - t) * 0.9; ctx.strokeStyle = r.col; ctx.lineWidth = r.w * (1 - t * 0.6);
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
      ctx.globalAlpha *= 0.35; ctx.lineWidth = r.w * 3; ctx.stroke();
    }
    for (const b of this.bolts) {
      const a = b.life / b.max; ctx.globalAlpha = a; ctx.lineJoin = 'round';
      for (const [w, col] of [[b.w * 3, rgba(b.col, 0.35)], [b.w, b.col], [b.w * 0.35, '#ffffff']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); b.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      }
    }
    for (const p of this.parts) {
      const a = p.life / p.max; ctx.globalAlpha = Math.min(1, a * 1.4);
      if (p.type === 'spark') { ctx.strokeStyle = p.col; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke(); }
      else if (p.type === 'shard') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8); ctx.restore(); }
      else { const s = p.size * (p.type === 'smoke' ? (2 - a) * 2 : 1) * 2.6; ctx.drawImage(glowSprite(p.col), p.x - s, p.y - s, s * 2, s * 2); }
    }
    ctx.restore();
  },
  drawTexts(ctx) {
    if (!SAVE.settings.dmgNumbers && this.texts.every(t => t.dmg)) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const k = 1 - t.life / t.max, a = Math.min(1, t.life / t.max * 2.5), s = t.size * (1 + Math.max(0, 0.35 - k) * t.pop * 1.6);
      ctx.globalAlpha = a; ctx.font = `900 ${s}px "Segoe UI", Arial, sans-serif`;
      ctx.lineWidth = Math.max(3, s * 0.16); ctx.strokeStyle = t.stroke; ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.col; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  },
};

/* =====================================================================
   7. FIGHTER (COMBATANT) + DAMAGE / STATUS SYSTEM
   ===================================================================== */
let BATTLE = null;           // current running battle

class Fighter {
  constructor(def, o = {}) {
    this.uid = UID++; this.def = def; this.name = def.name; this.team = o.team ?? 0;
    this.isPlayer = !!o.isPlayer; this.isClone = !!o.clone; this.owner = o.owner || null; this.boss = !!o.boss;
    this.level = o.level || 1; this.evo = o.evo || 0; this.tree = o.tree || {};
    const up = o.up || {};
    const lv = 1 + 0.022 * (this.level - 1), ev = [1, 1.08, 1.18, 1.3][this.evo] || 1, m = o.statMul || 1, mast = this.tree.master ? 1.05 : 1;
    this.maxHp = Math.max(1, Math.round((def.hp + (up.hp || 0) * 4) * lv * ev * mast * m * (this.boss ? 3.2 : 1) * (o.hpMul || 1)));
    this.hp = this.maxHp;
    this.atk = (def.atk + (up.atk || 0) * 1.5) * lv * ev * mast * m;
    this.dfn = (def.def + (up.def || 0) * 1.5) * lv * ev * mast * m;
    this.spd = Math.min(140, (def.spd + (up.spd || 0)) * Math.sqrt(lv) * mast);
    this.crit = Math.min(100, def.crit + (up.crit || 0));
    this.r = BASE_R * (this.boss ? 1.5 : 1) * (o.rScale || 1);
    this.mass = this.r * this.r * (0.75 + this.dfn / 200);
    this.baseSpeed = 205 + this.spd * 2.5;
    this.x = o.x ?? ARENA.cx; this.y = o.y ?? ARENA.cy;
    const a = o.angle ?? rand(TAU); this.vx = dcos(a) * this.baseSpeed; this.vy = dsin(a) * this.baseSpeed;
    this.rot = rand(TAU); this.t = rand(10);
    const allUnlocked = def.adminOnly || def.unlockAll || o.allUnlocked;
    this.summon = !!o.summon;   // a ball summoned through a portal: temporary like a clone, but keeps its own abilities
    this.skills = this.isClone && !this.summon ? [] : (def.skills || []).map((s, i) => ({ ...s, cdLeft: rand(1.2, 2.4) + i * 0.9, locked: !allUnlocked && !s.always && ((i === 2 && !this.tree.slot3) || (i >= 3 && !this.tree.slot4)) }));   // s.always: a control that is never locked (Celestial Shift)
    this.ult = def.ult; this.ultMeter = 0;
    this.ultCharge = this.tree.ultcharge ? 1.25 : 1;
    this.powerMul = (this.tree.power1 ? 1.1 : 1) * (this.tree.power2 ? 1.15 : 1);
    this.cdTree = (this.tree.cd1 ? 0.9 : 1) * (this.tree.cd2 ? 0.85 : 1);
    this.lifesteal = this.tree.vamp ? 0.08 : 0; this.rageBonus = this.tree.rage ? 1.15 : 1;
    this.st = { burn: 0, poison: 0, freeze: 0, stun: 0, slow: 0, weaken: 0, shield: 0, shieldPow: 0, buff: 0, buffPow: 0, dash: 0, timestop: 0, invuln: 0.8, adapt: 0, phase: 0, reflect: 0, outside: 0, nulled: 0, absorb: 0, reverse: 0, silence: 0, antievo: 0, overclock: 0, overheat: 0 };
    this.burnDps = 0; this.poisonDps = 0; this.poisonStacks = 0; this.dotTick = 0.5; this.dotSrc = null; this.stunImm = 0;
    this.rage = false; this.god = 0; this.godUsed = false; this.resUsed = false;
    this.alive = true; this.life = o.life || Infinity; this.hitFlash = 0; this.deathT = 0;
    this.stats = { dmg: 0, taken: 0, crits: 0, skills: 0, hits: 0, kills: 0 };
    this.temp = null; this.casting = 0; this.castFn = null;
    this.steerX = 0; this.steerY = 0; this.steerPow = 0;
    this.ai = null; this.target = null; this.manual = false;
    this.recent = { collision: 0, skill: 0 };   // for adaptive AI
    this.cos = o.cos && !this.isClone ? resolveCos(o.cos) : null;   // cosmetics: visual only
    this.straightT = 0;
    this.evoMul = ev; this.energy = 0; this.heat = 0; this.absorbLeft = 0; this.reverseLeft = 0; this.silenceImm = 0; this.repairCd = 0; this.repairs = 0; this.guard = null;
    this.form = 0; this.fm = 1; this.xAtk = 1; this.xSpd = 1; this.pAtk = 1; this.pSpd = 1; this.pCd = 1; this.sid = BATTLE && BATTLE.sidN != null ? ++BATTLE.sidN : 0;   // 2.1.0 Supreme forms / admin edits / match id
    if (def.supreme && typeof supremeInit === 'function') supremeInit(this, o);
  }
  get hpRatio() { return this.hp / this.maxHp; }
  get credit() { return this.isClone && this.owner ? this.owner : this; }
  /* Anti Evolution (st.antievo) temporarily switches off evolution, rage, God Mode and power-up bonuses */
  evoOff() { return 1 + ((this.evoMul || 1) - 1) * 0.75; }
  effAtk() { const ae = this.st.antievo > 0; let a = this.atk; if (ae) a /= this.evoOff(); if (this.rage && !ae) a *= (this.def.rageAtk || 1.3) * this.rageBonus; if (this.god > 0 && !ae) a *= this.def.godBoost || 1.6; if (this.st.buff > 0 && !ae) a *= 1 + this.st.buffPow; if (this.st.weaken > 0) a *= 0.7; if (this.st.adapt > 0 && !ae) a *= 1 + (this.adaptPow || 0.15); if (this.st.overclock > 0 && !ae) a *= 1.12; if (this.st.nulled > 0) a *= this.boss ? 0.85 : 0.75; if (this.fm > 1 && !ae) a *= this.fm; if (this.xAtk !== 1) a *= this.xAtk; if (this.pAtk !== 1) a *= this.pAtk; return a; }
  effDef() { const ae = this.st.antievo > 0; let d = this.dfn; if (ae) d /= this.evoOff(); if (this.god > 0 && !ae) d *= 1 + ((this.def.godBoost || 1.6) - 1) * 0.67; if (this.st.adapt > 0 && !ae) d *= 1 + (this.adaptPow || 0.15); if (this.fm > 1 && !ae) d *= 1 + (this.fm - 1) * 0.8; return d; }
  speedMul() { const ae = this.st.antievo > 0; let m = 1; if (this.st.freeze > 0) m *= 0.3; else if (this.st.slow > 0) m *= 0.55; if (this.rage && !ae) m *= this.def.rageSpd || 1.22; if (this.god > 0 && !ae) m *= 1.22; if (this.st.buff > 0 && !ae) m *= 1 + this.st.buffPow * 0.5; if (this.st.overclock > 0 && !ae) m *= 1.3; if (this.st.dash > 0) m *= 2.3; if (this.fm > 1 && !ae) m *= 1 + (this.fm - 1) * 0.3; if (this.xSpd !== 1) m *= this.xSpd; if (this.pSpd !== 1) m *= this.pSpd; return m; }
  cdMul() { const ae = this.st.antievo > 0; let m = this.cdTree; if (this.rage && !ae) m *= 0.6; if (this.god > 0 && !ae) m *= 0.5; if (this.st.overclock > 0 && !ae) m *= 0.65; if (this.form && !ae) m *= this.def.godBall ? (this.form === 2 ? 0.9 : 0.95) : (this.form === 2 ? 0.8 : 0.9); if (this.sx && this.sx.energyT > 0) m *= 0.75; if (this.pCd !== 1) m *= this.pCd; return m; }
  canAct() { return this.alive && this.st.stun <= 0 && this.st.timestop <= 0 && this.casting <= 0 && !(this.st.outside > 0); }
  allSkills() { return this.temp ? this.skills.concat([this.temp]) : this.skills; }
  enemies() { return BATTLE ? BATTLE.fighters.filter(f => f.alive && f.team !== this.team) : []; }
}

function applyEffect(src, tgt, eff, power = 50) {
  if (!eff || eff === 'none' || !tgt.alive) return;
  if (eff === 'random') eff = pick(['burn', 'freeze', 'poison', 'stun', 'slow', 'weaken']);
  const s = tgt.st;
  switch (eff) {
    case 'burn': s.burn = 3; tgt.burnDps = Math.max(tgt.burnDps, 1.2 + power * 0.022); tgt.dotSrc = src; break;
    case 'poison': s.poison = 5; tgt.poisonStacks = Math.min(3, tgt.poisonStacks + 1); tgt.poisonDps = 0.7 * tgt.poisonStacks + power * 0.006; tgt.dotSrc = src; break;
    case 'freeze': if (s.freeze <= 0) FX.text(tgt.x, tgt.y - tgt.r - 16, 'FROZEN', '#bdf6ff', 16); s.freeze = Math.max(s.freeze, 0.9 + power / 110); break;
    case 'stun': if (tgt.stunImm <= 0 && !tgt.boss) { s.stun = 0.45 + power / 220; tgt.stunImm = s.stun + 1.8; FX.text(tgt.x, tgt.y - tgt.r - 16, 'STUNNED', '#fff27a', 16); } break;
    case 'slow': s.slow = Math.max(s.slow, 2); break;
    case 'weaken': if (s.weaken <= 0) FX.text(tgt.x, tgt.y - tgt.r - 16, 'WEAKENED', '#c77dff', 15); s.weaken = 4; break;
  }
}

function dealDamage(src, tgt, amt, o = {}) {
  if (!tgt.alive || amt <= 0 || !BATTLE || tgt.st.outside > 0) return 0;   // outside the arena (in a portal): untouchable
  if (tgt.st.invuln > 0 && o.kind !== 'dot') { if (Math.random() < 0.3) FX.text(tgt.x, tgt.y - tgt.r, 'IMMUNE', '#9fe8ff', 14, { life: 0.5 }); return 0; }
  const s = src && src.alive !== undefined ? src : null, cr = s ? s.credit : null;
  let crit = false;
  if (s && !o.noCrit && RNG() < s.crit / 100 * 0.45) { amt *= 1.75; crit = true; }
  if (!o.noDef) amt *= 70 / (70 + tgt.effDef() * 0.7);
  if (tgt.st.phase > 0 && o.kind !== 'dot') { if (o.kind === 'collision') amt *= 0.5; else { if (Math.random() < 0.4) FX.text(tgt.x, tgt.y - tgt.r, 'PHASED', '#b2fff9', 14, { life: 0.5 }); return 0; } }
  if (tgt.st.adapt > 0 && tgt.adaptVs && (o.kind === tgt.adaptVs || (tgt.adaptVs === 'skill' && o.kind === 'dot'))) amt *= 0.6;
  if (tgt.def.passive === 'antiadapt' && !tgt.isClone) amt *= antiAdapt(tgt, o, amt);            // Anti Ball passive
  if (tgt.guard && tgt.guard.alive && !(tgt.guard.st.stun > 0) && o.kind !== 'dot') {        // Defense Drone takes half the hit
    const g = tgt.guard, take = Math.min(amt * 0.5, g.hp); g.hp -= take; g.hitFlash = 0.1; amt -= take;
    if (!FX.off) FX.bolt(g.x, g.y, tgt.x, tgt.y, '#80d8ff', 2, 0.15);
    if (g.hp <= 0.5) killFighter(g, cr);
    if (amt <= 0.01) return take;
  }
  if ((tgt.sx || (s && s.sx)) && typeof supDamageHook === 'function') { amt = supDamageHook(s, tgt, amt, o); if (!(amt > 0)) return 0; }
  if (tgt.st.shield > 0 && o.kind !== 'dot') { amt *= 1 - tgt.st.shieldPow; FX.ring(tgt.x, tgt.y, '#9fe8ff', tgt.r * 1.45, 0.25, 4, tgt.r * 1.15); }
  amt = Math.max(0.5, amt * DMG_SCALE * (BATTLE.dmgMul || 1));
  if (BATTLE.infiniteHp && !tgt.isPlayer && tgt.team !== 0) { tgt.hp = Math.max(1, tgt.hp - amt); if (tgt.hp <= 1) tgt.hp = tgt.maxHp; }
  else tgt.hp -= amt;
  tgt.hitFlash = 0.1; tgt.stats.taken += amt;
  if (cr) {
    cr.stats.dmg += amt; if (crit) cr.stats.crits++; cr.stats.hits++;
    cr.recent[o.kind === 'collision' ? 'collision' : 'skill'] += amt;
    if (!cr.isClone && cr.ultMeter < 100) cr.ultMeter = Math.min(100, cr.ultMeter + amt * (tgt.isClone ? 0.3 : 1.6) * cr.ultCharge);
    if (o.effect === 'drain' && cr.alive) healFighter(cr, amt * 0.5, true);
    if (cr.lifesteal && o.kind === 'collision' && cr.alive) healFighter(cr, amt * cr.lifesteal, true);
  }
  if (!tgt.isClone && tgt.ultMeter < 100) tgt.ultMeter = Math.min(100, tgt.ultMeter + amt * 1.1 * tgt.ultCharge);
  if (o.effect && o.effect !== 'drain') applyEffect(cr || s, tgt, o.effect, o.power || 50);
  if (o.kind === 'skill' || o.kind === 'collision') tgt.ai?.onHit(cr, amt, o.kind);
  BATTLE.onDamage?.(cr, tgt, amt, crit);
  // visuals
  if (o.kind !== 'dot' || Math.random() < 0.5) {
    const col = crit ? '#ffea00' : (o.kind === 'dot' ? (tgt.st.poison > 0 ? '#9dff00' : '#ff9100') : '#ffffff');
    FX.text(tgt.x + vr(-14, 14), tgt.y - tgt.r - 8, (crit ? '✦' : '-') + Math.max(1, Math.round(amt)), col, crit ? 30 : (o.kind === 'dot' ? 15 : 21), { pop: crit ? 1.8 : 1 });
    const lt = FX.texts[FX.texts.length - 1]; if (lt) lt.dmg = true;
  }
  if (crit) {
    FX.text(tgt.x, tgt.y - tgt.r - 44, 'CRITICAL!', '#ffea00', 22, { life: 0.7, stroke: '#7a2a00' });
    FX.sparks(tgt.x, tgt.y, '#ffea00', 16, 560); FX.ring(tgt.x, tgt.y, '#ffea00', tgt.r * 2.4, 0.35, 6, tgt.r);
    FX.addShake(7); FX.slowmo = Math.max(FX.slowmo, 0.09); Sound.play('crit');
    if (cr?.isPlayer) SAVE.stats.crits++;
  }
  if (!tgt.rage && !tgt.isClone && tgt.hp > 0 && tgt.hp <= RAGE_HP) activateRage(tgt);
  if (tgt.hp <= 0) killFighter(tgt, cr);
  return amt;
}

function healFighter(f, amt, silent) {
  if (!f.alive || amt <= 0) return;
  if (BATTLE?.suddenDeath) amt *= 0.5;
  const before = f.hp; f.hp = Math.min(f.maxHp, f.hp + amt);
  const got = f.hp - before;
  if (!silent && got > 0.5) { FX.text(f.x, f.y - f.r - 10, '+' + Math.round(got), '#3dffa0', 22); FX.burst(f.x, f.y, '#3dffa0', 16, 160, 5, 0.8); }
  else if (got > 1.5 && Math.random() < 0.5) FX.text(f.x + vr(-10, 10), f.y - f.r, '+' + Math.round(got), '#3dffa0', 15, { life: 0.6 });
}

function activateRage(f) {
  f.rage = true; f.rageEver = true;
  const col = rageColor(f.def.design);
  FX.text(f.x, f.y - f.r - 30, 'RAGE MODE!', col, 30, { life: 1.4, pop: 2, stroke: '#200' });
  for (let i = 0; i < 3; i++) FX.ring(f.x, f.y, col, f.r * (2.5 + i), 0.5 + i * 0.15, 8 - i * 2, f.r);
  FX.burst(f.x, f.y, col, 40, 420, 6, 0.9); FX.sparks(f.x, f.y, '#ffffff', 14, 600);
  FX.addShake(9); FX.slowmo = Math.max(FX.slowmo, 0.4); Sound.play('rage');
  for (const e of f.enemies()) { const d = len(e.x - f.x, e.y - f.y) || 1; if (d < 260) { e.vx += (e.x - f.x) / d * 380; e.vy += (e.y - f.y) / d * 380; } }
  f.st.invuln = Math.max(f.st.invuln, 0.5);
  if (f.isPlayer) SAVE.stats.rages++;
  f.ai?.onRage();
}

function resurrect(f, pct) {
  f.resUsed = true; f.alive = true; f.hp = Math.max(f.hp, f.maxHp * pct); f.rage = f.hp <= RAGE_HP;
  f.st.invuln = 1.4; f.st.burn = f.st.poison = f.st.stun = f.st.freeze = f.st.slow = f.st.weaken = 0;
  FX.text(f.x, f.y - f.r - 34, 'RESURRECTION!', '#fff59d', 30, { life: 1.6, pop: 2, stroke: '#5a3b00' });
  for (let i = 0; i < 4; i++) FX.ring(f.x, f.y, '#fff59d', 140 + i * 60, 0.6 + i * 0.12, 10 - i * 2, f.r);
  FX.burst(f.x, f.y, '#fff59d', 50, 380, 7, 1.1); FX.addFlash(0.18, '#fff8e1'); Sound.play('heal'); Sound.play('god');
  for (const e of f.enemies()) { const d = len(e.x - f.x, e.y - f.y) || 1; if (d < 300) { e.vx += (e.x - f.x) / d * 450; e.vy += (e.y - f.y) / d * 450; } }
}

function killFighter(f, killer) {
  if (!f.alive) return;
  if (f.sx && typeof supPreventDeath === 'function' && supPreventDeath(f)) return;
  const res = !f.resUsed && !f.isClone && f.skills.find(s => s.type === 'resurrect' && !s.locked);
  if (res) { f.hp = 0; resurrect(f, clamp((res.power || 50) / 100, 0.2, 0.8)); return; }
  f.alive = false; f.hp = 0; f.deathT = 0;
  const d = f.def.design;
  if (f.isClone) { if (f.minionDeath) { const md = f.minionDeath; f.minionDeath = null; md(f); } if (f.unit) unitGone(f, true); else FX.burst(f.x, f.y, d.c3, 18, 260, 5, 0.6); return; }
  if (f.baseDef && typeof supremeDefeat === 'function') supremeDefeat(f);
  FX.burst(f.x, f.y, d.c3, 70, 620, 8, 1.2); FX.burst(f.x, f.y, d.c2, 40, 420, 6, 1.0, 'shard'); FX.sparks(f.x, f.y, '#ffffff', 24, 800);
  for (let i = 0; i < 3; i++) FX.ring(f.x, f.y, i ? d.c2 : '#ffffff', 220 + i * 80, 0.6 + i * 0.2, 12 - i * 3, f.r);
  FX.text(f.x, f.y - f.r - 20, 'K.O.!', '#ff3355', 40, { life: 1.6, pop: 2.2 });
  FX.addShake(16); FX.addFlash(0.22); FX.slowmo = Math.max(FX.slowmo, 0.8); Sound.play('death'); Sound.play('boom');
  if (killer) killer.stats.kills++;
  BATTLE?.onDeath(f, killer);
}

function tickFighter(f, dt) {
  f.t += dt;
  const s = f.st;
  for (const k of ['freeze', 'stun', 'slow', 'weaken', 'shield', 'buff', 'dash', 'timestop', 'invuln', 'adapt', 'phase', 'reflect', 'nulled', 'absorb', 'reverse', 'silence', 'antievo', 'overclock', 'overheat']) if (s[k] > 0) s[k] = Math.max(0, s[k] - dt);
  if (f.stunImm > 0) f.stunImm -= dt;
  if (s.burn > 0 || s.poison > 0) {
    f.dotTick -= dt;
    if (f.dotTick <= 0) { f.dotTick = 0.5; let d = 0; if (s.burn > 0) d += f.burnDps * 0.5; if (s.poison > 0) d += f.poisonDps * 0.5; dealDamage(f.dotSrc, f, d, { kind: 'dot', noCrit: true, noDef: true }); }
    s.burn = Math.max(0, s.burn - dt); s.poison = Math.max(0, s.poison - dt); if (s.poison <= 0) f.poisonStacks = 0; if (s.burn <= 0) f.burnDps = 0;
  }
  if (!f.alive) return;
  if (f.sx && typeof supremeTick === 'function') supremeTick(f, dt);
  if (f.silenceImm > 0) f.silenceImm -= dt;
  if (f.def.heat && f.heat > 0) f.heat = Math.max(0, f.heat - dt * (s.overheat > 0 ? 22 : s.overclock > 0 ? 6 : HEAT.DECAY));
  if (f.def.passive === 'repair' && !f.isClone && BATTLE) { if (f.repairCd > 0) f.repairCd -= dt; else if (f.hpRatio <= 0.2 && f.repairs < UNIT.REPAIR_MAX) emergencyRepair(f); }
  if (s.timestop <= 0) for (const sk of f.allSkills()) if (sk.cdLeft > 0) sk.cdLeft -= dt / f.cdMul();
  if (f.temp) { f.temp.expires -= dt; if (f.temp.expires <= 0) { FX.text(f.x, f.y - f.r - 14, 'COPY FADED', '#c77dff', 14); f.temp = null; } }
  if (f.god > 0) { f.god -= dt; if (f.god <= 0) { f.god = 0; FX.text(f.x, f.y - f.r - 20, 'GOD MODE ENDED', '#ffd54f', 18); FX.burst(f.x, f.y, '#ffd54f', 30, 300); } }
  if (!f.isClone && f.ultMeter < 100 && s.timestop <= 0) f.ultMeter = Math.min(100, f.ultMeter + dt * 1.8 * f.ultCharge * (f.rage ? 1.6 : 1));
  if (f.rage && f.hp > RAGE_HP + 10) { f.rage = false; FX.text(f.x, f.y - f.r - 14, 'calm', '#9fe8ff', 14); }
  if (f.isClone) { f.life -= dt; if (f.life <= 0 || !f.owner?.alive) { f.alive = false; FX.burst(f.x, f.y, f.def.design.c3, 16, 220, 5, 0.5);
    if (f.unit) unitGone(f); else if (f.summon && BATTLE) { openPortal(f.x, f.y, { r: f.r * 1.5, life: 0.6, col: f.owner ? f.owner.def.design.c3 : f.def.design.c3 }); portalGhost(f, f.x, f.y, f.x, f.y, 0.35, 'in'); if (!FX.off) Sound.play('portalclose'); } } }
  f.hitFlash = Math.max(0, f.hitFlash - dt);
  if (f.casting > 0) { f.casting -= dt; FX.p(f.x + vr(-f.r, f.r) * 2, f.y + vr(-f.r, f.r) * 2, 0, 0, 0.3, 4, f.def.design.c3); if (f.casting <= 0 && f.castFn) { const fn = f.castFn; f.castFn = null; fn(); } }
  // ambient status particles
  const q = SAVE.settings.particles === 'low' ? 0.35 : 1, d = f.def.design;
  if (f.rage && Math.random() < 0.6 * q) FX.p(f.x + vr(-f.r, f.r), f.y + vr(-f.r, f.r), vr(-30, 30), vr(-140, -60), 0.5, vr(3, 6), rageColor(d));
  if (f.god > 0 && Math.random() < 0.8 * q) { const a = vr(TAU); FX.p(f.x + dcos(a) * f.r * 1.2, f.y + dsin(a) * f.r * 1.2, dcos(a) * 90, dsin(a) * 90, 0.6, vr(3, 5), Math.random() < 0.5 ? '#fff59d' : godDesign(d).c2); }
  if (s.burn > 0 && Math.random() < 0.5 * q) FX.p(f.x + vr(-f.r, f.r) * 0.7, f.y + vr(-f.r, f.r) * 0.7, 0, -90, 0.45, 4, '#ff7b00');
  if (s.poison > 0 && Math.random() < 0.4 * q) FX.p(f.x + vr(-f.r, f.r) * 0.7, f.y + vr(-f.r, f.r) * 0.7, 0, -50, 0.6, 4, '#9dff00');
  if ((d.deco || []).includes('portals') && Math.random() < 0.55 * q) { const a = vr(TAU), rr = f.r * vr(1.4, 2.2); FX.p(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, -Math.cos(a) * rr * 1.8 - Math.sin(a) * 90, -Math.sin(a) * rr * 1.8 + Math.cos(a) * 90, 0.5, vr(2, 4), Math.random() < 0.6 ? d.c3 : '#ffffff'); }
  if (s.dash > 0 && Math.random() < 0.9 * q) FX.p(f.x, f.y, -f.vx * 0.1, -f.vy * 0.1, 0.35, f.r * 0.35, d.c3);
  if (s.stun > 0 && Math.random() < 0.3 * q) FX.sparks(f.x, f.y - f.r, '#fff27a', 1, 200);
}

/* =====================================================================
   8. SKILLS, ULTIMATES & GOD MODE
   ===================================================================== */
const skillDmg = (f, P) => P * 0.12 * (0.6 + f.effAtk() / 125);
function nearestEnemy(f) { let best = null, bd = Infinity; for (const e of f.enemies()) { if (e.st.outside > 0) continue; const d = dist2(f.x, f.y, e.x, e.y) * (e.isClone && !e.decoy ? 2.5 : 1); if (d < bd) { bd = d; best = e; } } return best; }
function predictPos(f, tgt, t) {
  const aim = f.ai ? f.ai.p.aim : 0.85;
  let x = tgt.x + tgt.vx * t * aim, y = tgt.y + tgt.vy * t * aim;
  return { x: clamp(x, ARENA.x + tgt.r, ARENA.r - tgt.r), y: clamp(y, ARENA.y + tgt.r, ARENA.b - tgt.r) };
}
function aimAngle(f, tgt, speed) { const d = len(tgt.x - f.x, tgt.y - f.y); const p = predictPos(f, tgt, d / speed); return datan2(p.y - f.y, p.x - f.x) + (f.ai ? rand(-1, 1) * (1 - f.ai.p.aim) * 0.25 : 0); }
function rayToWall(x, y, a) {
  const dx = dcos(a), dy = dsin(a); let t = Infinity;
  if (dx > 0) t = Math.min(t, (ARENA.r - x) / dx); if (dx < 0) t = Math.min(t, (ARENA.x - x) / dx);
  if (dy > 0) t = Math.min(t, (ARENA.b - y) / dy); if (dy < 0) t = Math.min(t, (ARENA.y - y) / dy);
  return { x: x + dx * t, y: y + dy * t };
}
function segDist(px, py, x0, y0, x1, y1) { const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy || 1; const t = clamp(((px - x0) * vx + (py - y0) * vy) / l2, 0, 1); return len(px - (x0 + vx * t), py - (y0 + vy * t)); }
function knock(e, fromX, fromY, force) { if (e.st && e.st.outside > 0) return; const d = len(e.x - fromX, e.y - fromY) || 1; const k = force * (e.boss ? 0.4 : 1); e.vx += (e.x - fromX) / d * k; e.vy += (e.y - fromY) / d * k; }

function spawnProj(f, ang, o) {
  BATTLE.projs.push({ owner: f, team: f.team, x: f.x + dcos(ang) * (f.r + 6), y: f.y + dsin(ang) * (f.r + 6), vx: dcos(ang) * o.speed, vy: dsin(ang) * o.speed,
    speed: o.speed, r: o.r || 10, dmg: o.dmg, col: o.col, effect: o.effect, power: o.power, life: o.life || 2.6, homing: o.homing || 0, target: o.target || f.target, style: o.style || null, boom: o.boom || 0, ult: o.ult ?? CUR_ULT });
}
function explodeAt(f, x, y, rad, dmg, col, effect, force = 520, power = 60) {
  FX.ring(x, y, col, rad, 0.45, 12, 10); FX.ring(x, y, '#ffffff', rad * 0.75, 0.35, 5, 10);
  FX.burst(x, y, col, 36, rad * 2.4, 7, 0.7); FX.sparks(x, y, '#ffffff', 12, rad * 3);
  FX.addShake(Math.min(16, rad / 25)); Sound.play('boom');
  for (const e of BATTLE.fighters) {
    if (!e.alive || e.team === f.team) continue;
    const d = len(e.x - x, e.y - y);
    if (d < rad + e.r) { dealDamage(f, e, dmg * (1 - 0.35 * clamp(d / rad, 0, 1)), { kind: 'skill', tag: 'explosion', effect, power }); knock(e, x, y, force); }
  }
}
function spawnClone(f, P, life = 6, angOff = 0) {
  const c = new Fighter(f.def, { team: f.team, clone: true, owner: f, level: f.level, evo: f.evo, rScale: 0.72, statMul: 0.5 + P / 300,
    x: clamp(f.x + dcos(angOff) * f.r * 2, ARENA.x + 40, ARENA.r - 40), y: clamp(f.y + dsin(angOff) * f.r * 2, ARENA.y + 40, ARENA.b - 40), angle: rand(TAU), life });
  c.maxHp = c.hp = Math.max(8, Math.round(f.maxHp * 0.3)); c.st.invuln = 0.3; c.godUsed = true;
  c.ai = new AIController(c, 'aggressive', f.ai ? f.ai.diff : 'normal');
  BATTLE.fighters.push(c);
  FX.burst(c.x, c.y, f.def.design.c3, 24, 300, 6, 0.6); FX.ring(c.x, c.y, f.def.design.c2, 90, 0.4, 6);
  return c;
}
const after = (t, fn) => BATTLE.timers.push({ t, fn, u: CUR_ULT });   // timers started by an ultimate stay part of it

/* =====================================================================
   PORTALS (Portal Master Ball) — all battle logic is deterministic; the
   swirling portals and "ghost" trails are visual only.
   ===================================================================== */
const PORTAL = { SUMMON_MAX: 3, CLONE_MAX: 4, ARMY_MAX: 8 };
const SUMMON_POOL = ['fire', 'ice', 'thunder', 'electric', 'spear', 'cell', 'zombie', 'vampire', 'bread'];
const inArenaX = (x, m = 50) => clamp(x, ARENA.x + m, ARENA.r - m), inArenaY = (y, m = 50) => clamp(y, ARENA.y + m, ARENA.b - m);
function openPortal(x, y, o = {}) {
  const p = { x, y, r: o.r || 52, t: 0, life: o.life || 1, col: o.col || '#b026ff', edge: o.edge || null, big: !!o.big, spin: RNG() < 0.5 ? 1 : -1, style: o.style || null };
  BATTLE.portals.push(p);
  if (!FX.off) { FX.ring(x, y, p.col, p.r * 1.6, 0.35, 5, p.r * 0.3); Sound.play(p.style === 'void' ? 'void' : 'portal'); }
  return p;
}
/* visual only: a ball sliding into / out of a portal */
function portalGhost(f, x0, y0, x1, y1, dur, mode, def) {
  if (FX.off || !BATTLE.ghosts) return;
  BATTLE.ghosts.push({ def: def || f.def, evo: f.evo, god: f.god > 0, r: f.r, x0, y0, x1, y1, t: 0, dur, mode });
}
/* the ball steps into a portal and is OUTSIDE the arena (no collisions, untargetable) until it re-emerges */
function enterPortal(f, x, y, dur, exit, ghostTo) {
  portalGhost(f, f.x, f.y, ghostTo ? ghostTo.x : x, ghostTo ? ghostTo.y : y, Math.min(0.35, dur), 'in');
  f.x = inArenaX(x, f.r); f.y = inArenaY(y, f.r); f.vx = f.vy = 0;
  f.st.outside = dur; f.portalExit = exit || { mode: 'safe' };
  f.st.burn = f.st.poison = 0; f.st.stun = f.st.freeze = f.st.slow = 0;
}
/* where to come back: far from every enemy */
function safeSpot(f) {
  const m = f.r + 40, cand = [];
  for (const fx of [0.12, 0.5, 0.88]) for (const fy of [0.15, 0.5, 0.85]) cand.push({ x: ARENA.x + ARENA.w * fx, y: ARENA.y + ARENA.h * fy });
  let best = cand[4], bs = -1;
  for (const c of cand) { let md = Infinity; for (const e of f.enemies()) if (!e.isClone) md = Math.min(md, len(e.x - c.x, e.y - c.y)); if (md > bs + 1) { bs = md; best = c; } }
  return { x: inArenaX(best.x, m), y: inArenaY(best.y, m) };
}
function behind(t, f, extra = 40) {
  const sp = len(t.vx, t.vy) || 1, back = datan2(-t.vy / sp, -t.vx / sp), dd = t.r + f.r + extra;
  return { x: inArenaX(t.x + dcos(back) * dd, f.r), y: inArenaY(t.y + dsin(back) * dd, f.r) };
}
function emergeFromPortal(f) {
  const ex = f.portalExit || { mode: 'safe' }; f.portalExit = null;
  const tgt = ex.tgt && ex.tgt.alive && !(ex.tgt.st.outside > 0) ? ex.tgt : nearestEnemy(f);
  const p = ex.mode === 'behind' && tgt ? behind(tgt, f) : ex.mode === 'point' ? { x: inArenaX(ex.x, f.r), y: inArenaY(ex.y, f.r) } : safeSpot(f);
  const col = ex.col || f.def.design.c3;
  openPortal(p.x, p.y, { r: f.r * 1.3, life: 0.75, col, style: ex.style });
  f.x = p.x; f.y = p.y; f.st.invuln = Math.max(f.st.invuln, 0.35);
  const a = tgt ? angTo(f, tgt) : rand(TAU), sp = f.baseSpeed * (ex.dash ? 2.3 : 1.1);
  f.vx = dcos(a) * sp; f.vy = dsin(a) * sp;
  if (ex.dash) { f.st.dash = 0.5; f.dashEffect = ex.dash.effect; f.dashPow = ex.dash.P; }
  portalGhost(f, p.x, p.y, p.x, p.y, 0.3, 'out');
  FX.burst(p.x, p.y, col, 26, 320, 6, 0.55); FX.ring(p.x, p.y, '#ffffff', f.r * 2.2, 0.3, 4, f.r);
  if (ex.onExit) ex.onExit(f, p, tgt);
}
/* the nearest arena wall: a portal there lets the ball leave the arena */
function edgePortal(f) {
  const d = [['l', f.x - ARENA.x], ['r', ARENA.r - f.x], ['t', f.y - ARENA.y], ['b', ARENA.b - f.y]].sort((a, b) => a[1] - b[1])[0][0];
  const x = d === 'l' ? ARENA.x : d === 'r' ? ARENA.r : inArenaX(f.x, 60), y = d === 't' ? ARENA.y : d === 'b' ? ARENA.b : inArenaY(f.y, 60);
  const out = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] }[d];
  return { x, y, side: d, ox: x + out[0] * 130, oy: y + out[1] * 130 };
}
function pickSummonDef() {
  let id;
  if (RNG() < 0.7) id = pick(SUMMON_POOL);
  else { const pool = opponentPool(false).filter(b => !b.summonOnly && !b.godMode).map(b => b.id); id = pool.length ? pick(pool) : pick(SUMMON_POOL); }
  return getBall(id) || getBall('fire');
}
function armyOf(f) { let s = 0, c = 0; for (const x of BATTLE.fighters) if (x.alive && x.isClone && x.owner === f) { if (x.summon) s++; else c++; } return { s, c }; }
function spawnSummon(f, def, x, y, P, life = 7) {
  if (!f.alive || armyOf(f).s + armyOf(f).c >= PORTAL.ARMY_MAX) return null;
  const tgt = nearestEnemy(f), a = tgt ? datan2(tgt.y - y, tgt.x - x) : rand(TAU);
  const c = new Fighter(def, { team: f.team, clone: true, summon: true, owner: f, level: Math.max(1, f.level - 5), evo: Math.min(2, f.evo), rScale: 0.7, statMul: 0.55 + P / 400,
    allUnlocked: true, x: inArenaX(x), y: inArenaY(y), angle: a, life: life + P / 30 });
  c.maxHp = c.hp = Math.max(10, Math.round(f.maxHp * 0.22)); c.st.invuln = 0.5; c.godUsed = true; c.defender = true;
  c.skills.forEach((k, i) => { k.cdLeft = 0.6 + i * 0.7; });
  c.ai = new AIController(c, RNG() < 0.5 ? 'aggressive' : 'intelligent', f.ai ? f.ai.diff : 'hard');
  BATTLE.fighters.push(c);
  portalGhost(c, c.x, c.y, c.x, c.y, 0.35, 'out');
  FX.burst(c.x, c.y, def.design.c3, 22, 300, 6, 0.5); FX.text(c.x, c.y - c.r - 18, def.name.replace(/ Ball$/, '') + '!', def.design.c3, 15, { life: 0.9 });
  if (!FX.off) Sound.play('summon');
  return c;
}
function spawnPortalClone(f, P, ang, disguise) {
  const c = spawnClone(f, P, 5.5 + P / 30, ang);
  c.maxHp = c.hp = Math.max(8, Math.round(f.maxHp * 0.2));
  if (disguise) { c.def = disguise; c.name = disguise.name; c.disguised = true; }
  openPortal(c.x, c.y, { r: 40, life: 0.6, col: f.def.design.c3 });
  return c;
}
/* a shot fired out of a portal (not from the ball itself) */
function portalShot(f, x, y, tgt, o) {
  const a = tgt ? datan2(tgt.y - y, tgt.x - x) : rand(TAU);
  BATTLE.projs.push({ owner: f, team: f.team, x, y, vx: dcos(a) * o.speed, vy: dsin(a) * o.speed, speed: o.speed, r: o.r || 10, dmg: o.dmg, col: o.col, effect: o.effect, power: o.power, life: o.life || 2.4, homing: o.homing || 0, target: tgt, ult: CUR_ULT });
}

/* =====================================================================
   ANTI BALL & TECH BALLS — counter powers, robots, drones, turrets,
   lasers, holograms and heat. Battle logic only uses the seeded RNG
   (RNG / rand), so online PvP and server verification stay exact;
   anything using Math.random / vr is visual only.
   ===================================================================== */
let CUR_ULT = false;   // true while an ultimate (or a timer it scheduled) runs: its shots cannot be absorbed or reversed
const ANTI = { RES_MAX: 0.3, ABSORB_MAX: 6, REVERSE_MAX: 5, ENERGY_BONUS: 0.6 };
const UNIT = { ROBOT_MAX: 5, TURRET_MAX: 2, FACTORY_MAX: 1, ALL_MAX: 10, FACTORY_BUILDS: 3, REPAIR_CD: 40, REPAIR_MAX: 3, REPAIR_HEAL: 0.22 };
const HEAT = { COST: { lasergrid: 26, hologram: 18, emp: 24, cybertrap: 12, turret: 22, overclock: 10 }, OVERHEAT: 3, DECAY: 10, BLOCK: ['lasergrid', 'hologram', 'emp', 'turret', 'overclock'] };
const TECH_SFX = { nullzone: 'nullzone', absorb: 'absorb', reverse: 'reverse', minihole: 'void', voidtp: 'void', antievo: 'antievo', robots: 'robot', factory: 'mech', missiles: 'missile', drone: 'robot',
  fusionbot: 'mech', lasergrid: 'laser', hologram: 'holo', emp: 'emp', cybertrap: 'trapset', turret: 'mech', overclock: 'overclock' };
const ANTI_LABEL = { projectile: 'PROJECTILES', beam: 'BEAMS', wave: 'WAVES', zone: 'FIELDS', strike: 'STRIKES', orb: 'ORBS', explosion: 'BLASTS', laser: 'LASERS', collision: 'IMPACTS', dot: 'BURN & POISON', skill: 'ABILITIES', emp: 'EMP' };
const ENERGY_TYPES = ['minihole', 'voidtp', 'projectile', 'multishot', 'homing', 'beam', 'shockwave', 'explosion', 'dash', 'lightning', 'meteor', 'gravity', 'teleport', 'missiles', 'lasergrid'];

/* mechanical units: never in the collection, the shop or the opponent list */
const UD = (id, name, st, c1, c2, c3) => B(id, name, 'Tech', 'Rare', st, D(c1, c2, c3, 'solid'), [], null, 'aggressive', { unit: true, summonOnly: true });
const UNIT_DEFS = {
  robot: UD('u_robot', 'Combat Robot', [60, 60, 30, 82, 12], '#546e7a', '#40c4ff', '#80d8ff'),
  megabot: UD('u_megabot', 'Mega Robot', [90, 80, 50, 62, 18], '#37474f', '#2979ff', '#40c4ff'),
  titan: UD('u_titan', 'Titan Mech', [140, 92, 60, 50, 20], '#263238', '#2979ff', '#00e5ff'),
  factory: UD('u_factory', 'Mecha Factory', [100, 20, 82, 0, 0], '#37474f', '#ffab00', '#40c4ff'),
  drone: UD('u_drone', 'Defense Drone', [60, 10, 70, 90, 0], '#455a64', '#80d8ff', '#e1f5fe'),
  repair: UD('u_repair', 'Repair Bot', [50, 10, 60, 90, 0], '#eceff1', '#00e676', '#69f0ae'),
  turret: UD('u_turret', 'Auto Turret', [80, 40, 72, 0, 0], '#1a1a24', '#ff1744', '#ff5252'),
  skydrone: UD('u_skydrone', 'Combat Drone', [50, 52, 50, 96, 10], '#120014', '#ff1744', '#e040fb'),
};
const UNIT_R = { robot: 0.5, megabot: 0.95, titan: 1.5, factory: 0.85, drone: 0.36, repair: 0.36, turret: 0.62, skydrone: 0.42 };

function unitsOf(f, kind) { let n = 0; if (BATTLE) for (const x of BATTLE.fighters) if (x.alive && x.owner === f && x.unit && (!kind || x.unit === kind)) n++; return n; }
function spawnUnit(f, kind, x, y, o = {}) {
  if (!f.alive || !BATTLE || (!o.force && unitsOf(f) >= UNIT.ALL_MAX)) return null;
  const def = o.def || UNIT_DEFS[kind], tgt = nearestEnemy(f);
  const u = new Fighter(def, { team: f.team, clone: true, summon: true, owner: f, level: f.level, evo: 0, allUnlocked: true, rScale: o.rScale || UNIT_R[kind] || 0.5,
    statMul: o.statMul || (0.6 + (o.P || 60) / 400), x: inArenaX(x, 36), y: inArenaY(y, 36), angle: tgt ? datan2(tgt.y - y, tgt.x - x) : rand(TAU), life: o.life || 8 });
  u.unit = kind; u.mech = true; u.unitP = o.P || 60; u.godUsed = true; u.defender = true;
  u.maxHp = u.hp = Math.max(6, Math.round(o.hpAbs || f.maxHp * (o.hp || 0.12)));
  u.anchored = !!o.anchored; u.tether = !!o.tether; u.noCollide = !!o.noCollide; u.decoy = !!o.decoy; u.holo = kind === 'holo'; u.sky = !!o.sky;
  u.buildT = u.buildMax = o.build || 0; u.st.invuln = Math.max(o.build || 0, 0.3);
  if (u.anchored) u.vx = u.vy = 0;
  u.ai = new UnitAI(u, f.ai ? f.ai.diff : 'hard');
  BATTLE.fighters.push(u);
  if (!FX.off) { FX.burst(u.x, u.y, def.design.c3, 16, 240, 5, 0.5); FX.ring(u.x, u.y, def.design.c2, u.r * 2.6, 0.35, 4, u.r); }
  return u;
}
/* a unit shot: credited to the commander, fired from the unit */
function unitShot(f, t, speed, r, k, col, homing = 0) {
  const a = aimAngle(f, t, speed);
  spawnProj(f, a, { speed, r, dmg: skillDmg(f.owner || f, f.unitP || 60) * k, col, power: f.unitP || 60, life: 2.4, homing, target: t });
  f.flashT = 0.12; f.aim = a;
  if (!FX.off) { FX.sparks(f.x + dcos(a) * f.r, f.y + dsin(a) * f.r, col, 4, 260, a); Sound.play('turret'); }
}
function unitGone(f, killed) {
  if (FX.off) return;
  const d = f.def.design; FX.sparks(f.x, f.y, d.c3, killed ? 14 : 8, 420); FX.burst(f.x, f.y, killed ? '#ff9100' : d.c3, killed ? 18 : 10, 260, 5, 0.5, killed ? 'shard' : 'dot');
  if (killed) { FX.ring(f.x, f.y, '#ffffff', f.r * 3, 0.3, 4, f.r); Sound.play('boom', 0.5); }
}
/* the closest threat, enemies near the commander first */
function unitTarget(f, range) {
  const o = f.owner; let best = null, bs = Infinity;
  for (const e of f.enemies()) {
    if (e.st.outside > 0) continue;
    const d = len(e.x - f.x, e.y - f.y); if (d > range) continue;
    const near = o && o.alive && len(e.x - o.x, e.y - o.y) < 260;
    const s = d * (e.isClone && !e.decoy ? 1.8 : 1) - (near ? 220 : 0);
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function unitBrain(f, A, dt) {
  const o = f.owner, k = f.unit;
  if (!o || !o.alive) { f.steerPow = 0; return; }
  if (f.buildT > 0) { f.buildT = Math.max(0, f.buildT - dt); f.steerPow = 0; if (!f.tether) return; }
  if (f.tether) {     // hovers around its commander
    const ang = f.t * (k === 'repair' ? -2.6 : 2.1) + A.slot, rad = o.r + f.r + 18;
    f.x = inArenaX(o.x + dcos(ang) * rad, f.r); f.y = inArenaY(o.y + dsin(ang) * rad, f.r); f.vx = o.vx; f.vy = o.vy;
    if (k === 'repair' && f.canAct() && f.buildT <= 0) {
      A.fireT -= dt;
      if (A.fireT <= 0 && f.healLeft > 0) { A.fireT = 0.4; const amt = Math.min(f.healLeft, o.maxHp * 0.018); f.healLeft -= amt; healFighter(o, amt, true); f.beamT = 0.3; if (!FX.off) FX.burst(o.x, o.y, '#69f0ae', 4, 120, 4, 0.4); }
      if (f.healLeft <= 0) f.life = Math.min(f.life, 0.4);
    }
    return;
  }
  if (!f.canAct()) { f.steerPow = 0; return; }
  if (k === 'holo') { f.vx = o.vx * f.mx; f.vy = o.vy * f.my; f.steerPow = 0; return; }   // mirrors its master's movement
  A.fireT -= dt; A.actT -= dt;
  if (k === 'turret' || k === 'factory') {
    if (k === 'factory') {
      f.buildP = clamp(1 - A.fireT / 2.4, 0, 1);
      if (A.fireT <= 0) { A.fireT = 2.4; if (f.builds < UNIT.FACTORY_BUILDS && unitsOf(o, 'robot') < UNIT.ROBOT_MAX) { f.builds++; const a = rand(TAU); spawnUnit(o, 'robot', f.x + dcos(a) * f.r * 1.6, f.y + dsin(a) * f.r * 1.6, { P: f.unitP, life: 6 + f.unitP / 30, hp: 0.045, build: 0.35 }); if (!FX.off) { FX.sparks(f.x, f.y - f.r, '#ffab00', 10, 300); Sound.play('robot'); } } }
      return;
    }
    const t = unitTarget(f, 580); f.target = t; if (t) f.aim = angTo(f, t);
    if (t && A.fireT <= 0) { A.fireT = 0.75; unitShot(f, t, 720, 6, 0.075, f.def.design.c3); }
    return;
  }
  const range = { robot: 520, megabot: 620, titan: 760, skydrone: 900 }[k] || 520;
  const t = unitTarget(f, range); f.target = t;
  let gx, gy, pow = 600;
  if (!t) { const a = A.slot + f.t * 0.6; gx = o.x + dcos(a) * (o.r + 80); gy = o.y + dsin(a) * (o.r + 80); pow = len(gx - f.x, gy - f.y) > 30 ? 520 : 0; }   // no enemy close: follow the commander
  else if (k === 'skydrone') { const a = A.slot + f.t * 1.4; gx = t.x + dcos(a) * 190; gy = t.y + dsin(a) * 150; pow = 700; }
  else { const p = predictPos(f, t, 0.25); gx = p.x; gy = p.y; }
  const dx = gx - f.x, dy = gy - f.y, dl = len(dx, dy) || 1; f.steerX = dx / dl; f.steerY = dy / dl; f.steerPow = pow;
  A.chk += dt;     // anti-stuck: barely moved for 1.2 s -> kick free and take another route
  if (A.chk >= 1.2) { if (len(f.x - A.cx, f.y - A.cy) < 18) { const a = rand(TAU); f.vx = dcos(a) * f.baseSpeed; f.vy = dsin(a) * f.baseSpeed; A.slot += 1.3; } A.chk = 0; A.cx = f.x; A.cy = f.y; }
  if (!t) return;
  const d = len(t.x - f.x, t.y - f.y);
  if (k === 'minion') { if (f.mshot && A.fireT <= 0 && d < f.mshot.range) { A.fireT = f.mshot.cd; f.mshot.fire(f, t); } return; }   // Supreme summons
  if (k === 'robot' && A.fireT <= 0 && d < 430) { A.fireT = 1.7; unitShot(f, t, 520, 6, 0.2, '#80d8ff'); }
  else if (k === 'skydrone' && A.fireT <= 0 && d < 620) { A.fireT = 1.5; unitShot(f, t, 620, 7, 0.08, '#ff1744'); }
  else if (k === 'megabot') {
    if (A.actT <= 0 && d < 230 + t.r) { A.actT = 2.6; megaSlam(f); }
    else if (A.fireT <= 0 && d > 190 && d < 540) { A.fireT = 3.4; const a = angTo(f, t); f.vx = dcos(a) * f.baseSpeed * 2.4; f.vy = dsin(a) * f.baseSpeed * 2.4; f.st.dash = 0.5; f.dashEffect = null; f.punchT = 0.5; if (!FX.off) { FX.text(f.x, f.y - f.r - 14, 'ROCKET FIST', '#80d8ff', 14, { life: 0.7 }); FX.sparks(f.x, f.y, '#ff9100', 10, 360, a + Math.PI); Sound.play('missile'); } }
  } else if (k === 'titan') {
    if (A.actT <= 0 && d < 300 + t.r) { A.actT = 2.8; titanStomp(f); }
    if (A.fireT <= 0 && d < 740) { A.fireT = 1.6; const base = aimAngle(f, t, 640); for (let i = -1; i <= 1; i++) spawnProj(f, base + i * 0.16, { speed: 640, r: 11, dmg: skillDmg(o, f.unitP) * 0.1, col: '#00e5ff', power: f.unitP, life: 2.4 }); f.flashT = 0.15; if (!FX.off) Sound.play('laser'); }
  }
}
function megaSlam(f) {
  const P = f.unitP || 60; f.slamT = 0.35;
  explodeAt(f, f.x, f.y, 170, skillDmg(f.owner || f, P) * 0.35, '#40c4ff', 'slow', 520, P);
  if (!FX.off) FX.text(f.x, f.y - f.r - 16, 'MEGA SLAM', '#80d8ff', 16, { life: 0.8 });
}
function titanStomp(f) {
  const P = f.unitP || 60; f.slamT = 0.4;
  BATTLE.waves.push({ owner: f, team: f.team, x: f.x, y: f.y, r: f.r, maxR: 300, speed: 760, w: 22, dmg: skillDmg(f.owner || f, P) * 0.3, col: '#00e5ff', effect: 'slow', power: P, hit: new Set(), force: 640, style: 'tech' });
  if (!FX.off) { FX.addShake(10); FX.ring(f.x, f.y, '#ffffff', f.r * 2.2, 0.3, 8, f.r); FX.text(f.x, f.y - f.r - 18, 'TITAN STOMP', '#00e5ff', 18, { life: 0.8 }); Sound.play('titan'); }
}
function emergencyRepair(f) {
  f.repairCd = UNIT.REPAIR_CD; f.repairs = (f.repairs || 0) + 1;
  f.st.shield = Math.max(f.st.shield, 4); f.st.shieldPow = Math.max(f.st.shieldPow, 0.5);   // temporary defensive armour
  const u = spawnUnit(f, 'repair', f.x, f.y - f.r - 30, { force: true, tether: true, noCollide: true, hp: 0.1, life: 7, P: 60, build: 0.3 });
  if (u) u.healLeft = f.maxHp * UNIT.REPAIR_HEAL;
  if (!FX.off) { FX.text(f.x, f.y - f.r - 44, 'EMERGENCY REPAIR!', '#69f0ae', 22, { life: 1.6, pop: 1.8 }); FX.ring(f.x, f.y, '#69f0ae', f.r * 3, 0.5, 6, f.r); FX.burst(f.x, f.y, '#69f0ae', 24, 260); Sound.play('repair'); }
}

/* ---- Anti Ball helpers ---- */
function antiAdapt(tgt, o, amt) {
  const cat = o.tag || o.kind || 'skill', R = tgt.antiRes || (tgt.antiRes = {});
  // grows with how hard it is hit (many tiny hits barely count), never past 30%
  const cur = R[cat] || 0, inc = clamp(amt / tgt.maxHp * (cat === 'dot' ? 0.25 : 0.6), 0.001, 0.025), nxt = Math.min(ANTI.RES_MAX, cur + inc);
  R[cat] = nxt;
  if (Math.floor(nxt * 10 + 1e-9) > Math.floor(cur * 10 + 1e-9)) FX.text(tgt.x, tgt.y - tgt.r - 58, `ANTI-ADAPT: ${ANTI_LABEL[cat] || cat.toUpperCase()} −${Math.round(nxt * 100)}%`, '#b388ff', 14, { life: 1.4 });
  return 1 - cur;   // resistance never reaches immunity (max 30 %), and resets every battle
}
function darkBurst(x, y, r, life = 0.8) { if (!FX.off && BATTLE && BATTLE.darks) BATTLE.darks.push({ x, y, r, t: 0, life }); }
function voidSpot(f, tgt, dist) {
  const m = f.r + 30, flee = f.hpRatio < 0.45 || !tgt; let best = { x: f.x, y: f.y }, bs = -Infinity;
  const base = tgt ? angTo(f, tgt) : 0;
  for (let i = 0; i < 8; i++) {
    const a = base + i / 8 * TAU, x = inArenaX(f.x + dcos(a) * dist, m), y = inArenaY(f.y + dsin(a) * dist, m);
    let md = 999; for (const e of f.enemies()) if (!e.isClone || e.decoy) md = Math.min(md, len(e.x - x, e.y - y));
    const moved = len(x - f.x, y - f.y), sc = flee ? md + moved * 0.3 : -Math.abs(md - 150) + moved * 0.2;
    if (sc > bs) { bs = sc; best = { x, y }; }
  }
  return best;
}
function absorbShot(e, p) {
  e.absorbLeft--; e.energy = Math.min(100, (e.energy || 0) + 12 + p.dmg * 2.2);
  if (!FX.off) { FX.ring(p.x, p.y, '#ea80fc', 46, 0.3, 4, 4); FX.ring(e.x, e.y, '#b388ff', e.r * 2.2, 0.35, 5, e.r * 1.1); FX.text(e.x, e.y - e.r - 30, `ABSORBED • ENERGY ${Math.round(e.energy)}`, '#ea80fc', 14, { life: 0.8 }); Sound.play('absorb'); }
}
function reverseShot(e, p) {
  const src = p.owner && p.owner.alive ? p.owner : null;
  e.reverseLeft--; p.reflected = true; p.team = e.team; p.owner = e; p.dmg *= 1.2; p.target = src; p.homing = Math.max(p.homing || 0, 5); p.life = Math.max(p.life, 2);
  const a = src ? datan2(src.y - p.y, src.x - p.x) : datan2(-p.vy, -p.vx); p.vx = dcos(a) * p.speed; p.vy = dsin(a) * p.speed;
  if (!FX.off) { FX.ring(p.x, p.y, '#e1bee7', 56, 0.3, 5); FX.sparks(p.x, p.y, '#ea80fc', 10, 420, a); FX.text(e.x, e.y - e.r - 30, 'REVERSED!', '#e1bee7', 15, { life: 0.7 }); Sound.play('reverse'); }
}
function silenceFoe(src, e, base, label) {
  if (!e.alive) return;
  if (e.mech) { e.st.stun = Math.max(e.st.stun, 2); dealDamage(src, e, e.maxHp * 0.25, { kind: 'skill', tag: 'emp', noDef: true, noCrit: true }); FX.text(e.x, e.y - e.r - 14, 'SHORT CIRCUIT', '#40c4ff', 13, { life: 0.8 }); return; }
  if (e.silenceImm > 0) { FX.text(e.x, e.y - e.r - 20, 'RESISTED', '#cfd8dc', 13, { life: 0.6 }); return; }
  const d = e.boss ? base * 0.5 : base;          // never permanent: short, then a resistance window
  e.st.silence = Math.max(e.st.silence, d); e.silenceImm = d + 4.5; e.st.overclock = 0;
  FX.text(e.x, e.y - e.r - 24, label, '#ff8a80', 16, { life: 1.1 });
}

/* ---- Cyber Overlord helpers ---- */
function addHeat(f, n) {
  if (!f.def.heat) return;
  f.heat = Math.min(100, (f.heat || 0) + n * (f.st.overclock > 0 ? 1.5 : 1));
  if (f.heat >= 100 && !(f.st.overheat > 0)) {
    f.st.overheat = HEAT.OVERHEAT;
    if (!FX.off) { FX.text(f.x, f.y - f.r - 40, 'OVERHEAT!', '#ff9100', 22, { life: 1.4, pop: 1.8 }); FX.burst(f.x, f.y, '#cfd8dc', 22, 200, 7, 1.0, 'smoke'); Sound.play('overheat'); }
  }
}
function addLaser(f, L, o) {
  BATTLE.lasers.push({ owner: f, team: f.team, x0: L[0], y0: L[1], x1: L[2], y1: L[3], t: 0, charge: o.charge, dur: o.dur, w: o.w, dmg: o.dmg, col: o.col, ticks: new Map(), sweep: o.sweep || null });
}
function syncVolley(f, dmg, col) {
  const t = nearestEnemy(f); if (!t) return;
  const shoot = (s, x, y) => { const a = datan2(t.y - y, t.x - x); BATTLE.projs.push({ owner: s, team: f.team, x: x + dcos(a) * s.r, y: y + dsin(a) * s.r, vx: dcos(a) * 640, vy: dsin(a) * 640, speed: 640, r: 9, dmg, col, power: 60, life: 2.4, homing: 2.4, target: t, ult: true }); s.flashT = 0.15; };
  for (const u of BATTLE.fighters) if (u.alive && u.owner === f && u.unit && !u.holo && !u.tether && u.canAct()) shoot(u, u.x, u.y);
  shoot(f, f.x, f.y);
  if (!FX.off) { FX.text(f.x, f.y - f.r - 40, 'SYNC FIRE', '#ff5252', 15, { life: 0.7 }); Sound.play('laser'); }
}

const TECH_SKILLS = {
  /* ---------------- ANTI BALL ---------------- */
  nullzone(f, s, P, col) {
    if (BATTLE.zones.some(z => z.kind === 'nullzone' && z.owner === f)) return false;
    const life = 4 + P / 50;
    BATTLE.zones.push({ kind: 'nullzone', owner: f, team: f.team, follow: f, x: f.x, y: f.y, r: 190 + P * 0.6, life, max: life, col, power: P, ticks: new Map() });
    FX.ring(f.x, f.y, col, 230, 0.5, 8, 30); darkBurst(f.x, f.y, 140, 0.6);
  },
  absorb(f, s, P) {
    if (f.st.absorb > 0) return false;
    f.st.absorb = 2.6 + P / 60; f.absorbLeft = Math.min(ANTI.ABSORB_MAX, 4 + Math.floor(P / 40));
    FX.ring(f.x, f.y, '#ea80fc', f.r * 1.2, 0.45, 6, f.r * 2.6);
  },
  reverse(f, s, P) {
    if (f.st.reverse > 0) return false;
    f.st.reverse = 2.2 + P / 50; f.reverseLeft = Math.min(ANTI.REVERSE_MAX, 3 + Math.floor(P / 30));
    FX.ring(f.x, f.y, '#e1bee7', f.r * 2, 0.4, 6, f.r);
  },
  minihole(f, s, P, col, tgt) {
    const p = predictPos(f, tgt, 0.45), life = 2.2 + P / 100;
    BATTLE.zones.push({ kind: 'minihole', owner: f, team: f.team, x: inArenaX(p.x, 90), y: inArenaY(p.y, 90), r: 220 + P * 0.4, life, max: life, col, pull: 760 + P * 5, dmg: skillDmg(f, P) * 0.14, ticks: new Map(), effect: 'none', power: P, endDmg: skillDmg(f, P) * 0.6 });
  },
  voidtp(f, s, P, col, tgt) {
    const dest = voidSpot(f, tgt, 240 + P);
    portalGhost(f, f.x, f.y, f.x, f.y, 0.22, 'in'); darkBurst(f.x, f.y, 90, 0.5);
    openPortal(f.x, f.y, { r: f.r * 1.2, life: 0.45, col, style: 'void' });
    f.st.outside = 0.24;
    f.portalExit = { mode: 'point', x: dest.x, y: dest.y, col, style: 'void', onExit: (m, p) => {
      darkBurst(p.x, p.y, 110, 0.55);
      for (const e of m.enemies()) if (!(e.st.outside > 0) && len(e.x - p.x, e.y - p.y) < 130 + e.r) dealDamage(m, e, skillDmg(m, P) * 0.6, { kind: 'skill', effect: 'slow', power: P });
    } };
  },
  antievo(f, s, P, col) {
    const hit = f.enemies().filter(e => !(e.st.outside > 0) && len(e.x - f.x, e.y - f.y) < 460 + e.r);
    if (!hit.length) return false;
    for (const e of hit) {
      e.st.antievo = Math.max(e.st.antievo, (e.boss ? 2 : 4) + P / 60);   // temporary: abilities come back
      let what = 'DE-EVOLVED';
      if (e.god > 0) { e.god = Math.max(0.5, e.god * (e.boss ? 0.75 : 0.5)); what = 'GOD MODE DISRUPTED'; }
      else if (e.st.overclock > 0) { e.st.overclock = 0; what = 'OVERCLOCK CANCELLED'; }
      else if (e.rage) what = 'RAGE SUPPRESSED';
      if (!FX.off) { FX.bolt(f.x, f.y, e.x, e.y, col, 4, 0.4); FX.ring(e.x, e.y, col, e.r * 1.1, 0.5, 6, e.r * 3); FX.text(e.x, e.y - e.r - 26, what, col, 16, { life: 1.2 }); }
    }
  },
  /* ---------------- MECHA COMMANDER ---------------- */
  robots(f, s, P) {
    const have = unitsOf(f, 'robot'); if (have >= UNIT.ROBOT_MAX || unitsOf(f) >= UNIT.ALL_MAX) return false;
    const n = Math.min(UNIT.ROBOT_MAX - have, clamp(s.count || 3, 1, 3));
    for (let i = 0; i < n; i++) { const a = f.rot + i / n * TAU; spawnUnit(f, 'robot', f.x + dcos(a) * f.r * 2.3, f.y + dsin(a) * f.r * 2.3, { P, life: 8 + P / 30, hp: 0.05, build: 0.45 }); }
    FX.text(f.x, f.y - f.r - 44, 'ROBOTS DEPLOYED', '#80d8ff', 16, { life: 1 });
  },
  factory(f, s, P) {
    if (unitsOf(f, 'factory') >= UNIT.FACTORY_MAX || unitsOf(f) >= UNIT.ALL_MAX) return false;
    const a = datan2(ARENA.cy - f.y, ARENA.cx - f.x), x = inArenaX(f.x + dcos(a) * 130, 90), y = inArenaY(f.y + dsin(a) * 130, 90);
    const u = spawnUnit(f, 'factory', x, y, { P, life: 9 + P / 25, hp: 0.12, anchored: true, build: 0.6 });
    if (!u) return false;
    u.builds = 0; u.ai.fireT = 1.0;
  },
  missiles(f, s, P, col, tgt) {
    const n = clamp(s.count || 6, 2, 8);
    for (let i = 0; i < n; i++) after(i * 0.09, () => {
      if (!f.alive) return;
      const t = tgt && tgt.alive && !(tgt.st.outside > 0) ? tgt : nearestEnemy(f), side = i % 2 ? 1 : -1;
      spawnProj(f, (t ? angTo(f, t) : f.rot) + side * (0.95 + (i >> 1) * 0.22), { speed: 400, r: 7, dmg: skillDmg(f, P) * 0.2, col, power: P, homing: 3.6, life: 3.2, target: t, style: 'missile', boom: 62 });
      if (!FX.off) Sound.play('missile');
    });
  },
  drone(f, s, P) {
    if (f.guard && f.guard.alive) return false;
    const u = spawnUnit(f, 'drone', f.x, f.y - f.r - 20, { P, life: 8 + P / 25, hp: 0.07 + P / 1000, tether: true, noCollide: true, build: 0.3, force: true });
    if (!u) return false;
    f.guard = u; FX.text(f.x, f.y - f.r - 44, 'DRONE ONLINE', '#80d8ff', 16, { life: 1 });
  },
  fusionbot(f, s, P, col) {
    const bots = BATTLE.fighters.filter(x => x.alive && x.owner === f && x.unit === 'robot');
    if (bots.length < 2) return false;
    let cx = 0, cy = 0, hp = 0; for (const b of bots) { cx += b.x; cy += b.y; hp += b.hp; }
    cx /= bots.length; cy /= bots.length;
    for (const b of bots) { b.alive = false; if (!FX.off) { FX.bolt(b.x, b.y, cx, cy, '#40c4ff', 3, 0.45); FX.burst(b.x, b.y, '#80d8ff', 10, 200); } }
    FX.ring(cx, cy, '#40c4ff', 20, 0.45, 8, 140); FX.text(cx, cy - 60, 'ROBOT FUSION!', '#80d8ff', 22, { life: 1.3, pop: 1.6 });
    const n = bots.length;
    after(0.4, () => {
      if (!f.alive) return;
      const u = spawnUnit(f, 'megabot', cx, cy, { P, force: true, life: 6 + n * 0.6 + P / 40, hpAbs: Math.min(f.maxHp * 0.22, hp * 1.0 + f.maxHp * 0.03), statMul: 0.5 + n * 0.05 + P / 600, build: 0.25 });
      if (u) { explodeAt(f, u.x, u.y, 130, skillDmg(f, P) * 0.3, col, null, 500, P); if (!FX.off) Sound.play('titan'); }
    });
  },
  /* ---------------- CYBER OVERLORD ---------------- */
  lasergrid(f, s, P, col, tgt) {
    const p = predictPos(f, tgt, 0.7), g = 95, dmg = skillDmg(f, P) * 0.2, dur = 2.4 + P / 60;
    const x0 = clamp(p.x - g, ARENA.x + 10, ARENA.r - 10), x1 = clamp(p.x + g, ARENA.x + 10, ARENA.r - 10), y0 = clamp(p.y - g, ARENA.y + 10, ARENA.b - 10), y1 = clamp(p.y + g, ARENA.y + 10, ARENA.b - 10);
    [[x0, ARENA.y, x0, ARENA.b], [x1, ARENA.y, x1, ARENA.b], [ARENA.x, y0, ARENA.r, y0], [ARENA.x, y1, ARENA.r, y1]].forEach((L, i) => addLaser(f, L, { charge: 0.65 + i * 0.06, dur, w: 9, dmg, col }));
  },
  hologram(f, s, P, col) {
    if (unitsOf(f, 'holo') > 0) return false;
    for (const [mx, my] of [[-1, 1], [1, -1]]) {
      const u = spawnUnit(f, 'holo', f.x + mx * 80, f.y + my * 80, { P, force: true, def: f.def, rScale: f.r / BASE_R, statMul: 0.3, life: 5.5 + P / 40, hp: 0.08, decoy: true });
      if (u) { u.mx = mx; u.my = my; u.rot = f.rot; u.evo = f.evo; }
    }
    FX.ring(f.x, f.y, col, f.r * 3, 0.4, 5, f.r);
  },
  emp(f, s, P, col) {
    BATTLE.waves.push({ owner: f, team: f.team, x: f.x, y: f.y, r: f.r, maxR: 300 + P * 1.6, speed: 820, w: 20, dmg: skillDmg(f, P) * 0.35, col, effect: 'none', power: P, hit: new Set(), force: 260, style: 'emp',
      onHit: e => silenceFoe(f, e, 2.2 * (0.8 + P / 300), 'SYSTEMS OFFLINE') });
    FX.addFlash(0.08, '#40c4ff'); FX.ring(f.x, f.y, '#ffffff', f.r * 1.8, 0.25, 6);
  },
  cybertrap(f, s, P, col, tgt) {
    const p = predictPos(f, tgt, 0.6);
    BATTLE.zones.push({ kind: 'cybertrap', owner: f, team: f.team, x: inArenaX(p.x, 60), y: inArenaY(p.y, 60), r: 62, detect: 175 + P * 0.4, life: 7, max: 7, arm: 0.4, col, power: P, dmg: skillDmg(f, P) * 0.3, charges: 3, ticks: new Map() });
  },
  turret(f, s, P, col, tgt) {
    if (unitsOf(f, 'turret') >= UNIT.TURRET_MAX || unitsOf(f) >= UNIT.ALL_MAX) return false;
    const a = (tgt ? angTo(f, tgt) : f.rot) + (RNG() < 0.5 ? 1.2 : -1.2);
    spawnUnit(f, 'turret', f.x + dcos(a) * 110, f.y + dsin(a) * 110, { P, life: 8 + P / 30, hp: 0.12, anchored: true, build: 0.4 });
  },
  overclock(f, s, P, col) {
    if (f.st.overclock > 0) return false;
    f.st.overclock = 4.5 + P / 50;
    FX.text(f.x, f.y - f.r - 44, 'OVERCLOCK!', col, 20, { life: 1.2, pop: 1.6 }); FX.ring(f.x, f.y, col, f.r * 2.8, 0.45, 8, f.r); FX.burst(f.x, f.y, col, 26, 320);
  },
};
const TECH_SELF = ['nullzone', 'absorb', 'reverse', 'voidtp', 'antievo', 'robots', 'factory', 'drone', 'fusionbot', 'hologram', 'emp', 'turret', 'overclock'];

const TECH_ULTS = {
  absolutezero(f, P, col, dmg) {
    f.casting = 0.7; FX.text(f.x, f.y - f.r - 30, 'ABSOLUTE ZERO', col, 22, { life: 0.9 }); darkBurst(f.x, f.y, 120, 0.8);
    if (!FX.off) { for (let i = 0; i < 24; i++) { const a = vr(TAU), d = vr(160, 320); FX.p(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, -Math.cos(a) * d * 1.4, -Math.sin(a) * d * 1.4, 0.65, vr(3, 6), Math.random() < 0.5 ? '#b388ff' : '#ffffff', 'dot', 0); } Sound.play('nullzone'); }
    f.castFn = () => {
      BATTLE.waves.push({ owner: f, team: f.team, x: f.x, y: f.y, r: f.r, maxR: 640, speed: 900, w: 34, dmg: dmg * 1.0, col, effect: 'weaken', power: P, hit: new Set(), force: 760, style: 'anti', clearProj: true,
        onHit: e => silenceFoe(f, e, 3, 'SUPPRESSED') });
      darkBurst(f.x, f.y, 300, 1.1); FX.addFlash(0.3, '#12001f'); FX.addShake(16);
      for (let i = 0; i < 4; i++) FX.ring(f.x, f.y, i % 2 ? '#ffffff' : col, 220 + i * 110, 0.6 + i * 0.12, 14 - i * 3, f.r);
      FX.burst(f.x, f.y, col, 60, 700, 8, 1.1, 'shard'); FX.burst(f.x, f.y, '#1a0033', 40, 500, 9, 1.0, 'smoke');
      if (!FX.off) { Sound.play('boom'); Sound.play('void'); }
    };
  },
  titan(f, P, col, dmg, eff, tgt) {
    const a = tgt ? angTo(f, tgt) : 0, x = inArenaX(f.x + dcos(a) * 160, 120), y = inArenaY(f.y + dsin(a) * 160, 120);
    FX.text(ARENA.cx, ARENA.cy - 40, '⚙ TITAN OVERDRIVE ⚙', '#80d8ff', 44, { life: 2, vy: 0, pop: 2, stroke: '#001233' }); FX.addFlash(0.15, '#2979ff');
    BATTLE.strikes.push({ kind: 'titan', owner: f, team: f.team, x, y, t: 0.95, max: 0.95, r: 120, dmg: dmg * 0.55, col, effect: 'none', power: P });
    if (!FX.off) Sound.play('mech');
    after(0.95, () => {
      if (!f.alive) return;
      spawnUnit(f, 'titan', x, y, { P, force: true, life: 8 + P / 60, hpAbs: f.maxHp * 0.25, statMul: 0.6 + P / 600 });
      FX.addShake(18); FX.addFlash(0.2, '#40c4ff'); if (!FX.off) Sound.play('titan');
    });
  },
  skynet(f, P, col, dmg, eff, tgt, T) {
    FX.text(ARENA.cx, ARENA.cy - 40, '⟁ SKYNET PROTOCOL ⟁', '#ff5252', 44, { life: 2.2, vy: 0, pop: 2, stroke: '#1a0006' }); FX.addFlash(0.2, '#ff1744');
    BATTLE.skynetT = 8; if (!FX.off) Sound.play('skynet');
    const cx = inArenaX(T.x, 160), cy = inArenaY(T.y, 140);
    for (let i = 0; i < 3; i++) after(0.15 + i * 0.15, () => { if (!f.alive) return; const a = i / 3 * TAU, u = spawnUnit(f, 'skydrone', cx + dcos(a) * 200, cy + dsin(a) * 160, { P, force: true, life: 7, hp: 0.06, noCollide: true, sky: true, build: 0.2 }); if (u) u.ai.slot = a; });
    for (let i = 0; i < 2; i++) after(0.3 + i * 0.2, () => { if (!f.alive) return; spawnUnit(f, 'turret', i ? ARENA.x + 90 : ARENA.r - 90, cy < ARENA.cy ? ARENA.b - 90 : ARENA.y + 90, { P, force: true, life: 7, hp: 0.1, anchored: true, build: 0.35, sky: true }); });
    after(0.9, () => { if (!f.alive) return; const t = nearestEnemy(f), p = t ? { x: t.x, y: t.y } : { x: cx, y: cy }; [[p.x, ARENA.y, p.x, ARENA.b], [ARENA.x, p.y, ARENA.r, p.y]].forEach(L => addLaser(f, L, { charge: 0.55, dur: 1.2, w: 14, dmg: dmg * 0.2, col })); });
    after(2.6, () => { if (!f.alive) return; for (let k = 0; k < 2; k++) addLaser(f, [0, 0, 0, 0], { charge: 0.5, dur: 3, w: 12, dmg: dmg * 0.1, col: '#e040fb', sweep: { cx: ARENA.cx, cy: ARENA.cy, a0: k * Math.PI / 2, av: 0.9, len: 900 } }); });
    for (let k = 0; k < 4; k++) after(1.6 + k * 1.5, () => { if (f.alive) syncVolley(f, dmg * 0.07, col); });
  },
};

const SKILL_FN = {
  projectile(f, s, P, col, tgt) { spawnProj(f, aimAngle(f, tgt, 640), { speed: 640, r: 9 + P / 14, dmg: skillDmg(f, P), col, effect: s.effect, power: P }); },
  multishot(f, s, P, col, tgt) {
    const n = clamp(s.count || 3, 2, 9), base = aimAngle(f, tgt, 600), spread = 0.2;
    for (let i = 0; i < n; i++) spawnProj(f, base + (i - (n - 1) / 2) * spread, { speed: 600, r: 7 + P / 20, dmg: skillDmg(f, P) * 0.55, col, effect: s.effect, power: P });
  },
  homing(f, s, P, col, tgt) {
    const n = clamp(s.count || 2, 1, 8), base = angTo(f, tgt);
    for (let i = 0; i < n; i++) spawnProj(f, base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2.2), { speed: 430, r: 8 + P / 18, dmg: skillDmg(f, P) * (n > 1 ? 0.6 : 1), col, effect: s.effect, power: P, homing: 4.2, life: 3.2, target: tgt });
  },
  beam(f, s, P, col, tgt) {
    BATTLE.beams.push({ owner: f, team: f.team, ang: aimAngle(f, tgt, 1400), t: 0, charge: 0.36, fire: 0.3, w: 12 + P / 7, dmg: skillDmg(f, P) * 1.15, col, effect: s.effect, power: P, hit: new Set(), mega: false });
    Sound.play('beam');
  },
  shockwave(f, s, P, col) {
    BATTLE.waves.push({ owner: f, team: f.team, x: f.x, y: f.y, r: f.r, maxR: 240 + P * 2.2, speed: 720, w: 18, dmg: skillDmg(f, P), col, effect: s.effect, power: P, hit: new Set(), force: 420 });
    FX.ring(f.x, f.y, '#ffffff', f.r * 1.6, 0.25, 6); Sound.play('boom');
  },
  explosion(f, s, P, col) { explodeAt(f, f.x, f.y, 130 + P * 1.1, skillDmg(f, P), col, s.effect, 540, P); },
  dash(f, s, P, col, tgt) {
    const p = predictPos(f, tgt, 0.25), a = datan2(p.y - f.y, p.x - f.x), sp = f.baseSpeed * 2.3;
    f.vx = dcos(a) * sp; f.vy = dsin(a) * sp; f.st.dash = 0.65; f.dashEffect = s.effect; f.dashPow = P;
    FX.ring(f.x, f.y, col, f.r * 2, 0.3, 6); FX.sparks(f.x, f.y, col, 12, 400, a + Math.PI);
  },
  shield(f, s, P) { f.st.shield = 2.2 + P / 30; f.st.shieldPow = clamp(0.4 + P / 250, 0.4, 0.82); Sound.play('shield'); FX.ring(f.x, f.y, '#9fe8ff', f.r * 1.6, 0.4, 6, f.r); },
  heal(f, s, P) { if (f.hpRatio > 0.92) return false; healFighter(f, f.maxHp * P / 380); f.st.burn = f.st.poison = f.st.slow = f.st.weaken = 0; f.poisonStacks = 0; Sound.play('heal'); FX.ring(f.x, f.y, '#3dffa0', f.r * 2.2, 0.5, 6, f.r); },
  trap(f, s, P, col, tgt) {
    const p = predictPos(f, tgt, 0.7);
    BATTLE.zones.push({ kind: 'trap', owner: f, team: f.team, x: p.x, y: p.y, r: 70 + P * 0.5, life: 6, max: 6, col, effect: s.effect, power: P, dmg: skillDmg(f, P) * 0.14, ticks: new Map(), style: f.def.design.pat === 'web' || s.effect === 'slow' ? 'web' : s.effect });
    FX.ring(p.x, p.y, col, 90, 0.35, 5);
  },
  gravity(f, s, P, col) { BATTLE.zones.push({ kind: 'gravity', owner: f, team: f.team, follow: f, x: f.x, y: f.y, r: 380, life: 1.7, max: 1.7, col, pull: 650 + P * 6, dmg: skillDmg(f, P) * 0.12, ticks: new Map(), effect: s.effect, power: P }); },
  lightning(f, s, P, col, tgt) { const p = predictPos(f, tgt, 0.5); BATTLE.strikes.push({ kind: 'lightning', owner: f, team: f.team, x: p.x, y: p.y, t: 0.5, max: 0.5, r: 62 + P * 0.3, dmg: skillDmg(f, P) * 1.2, col, effect: s.effect, power: P }); },
  meteor(f, s, P, col, tgt) {
    const n = clamp(s.count || 4, 2, 8);
    for (let i = 0; i < n; i++) { const p = predictPos(f, tgt, 0.6 + i * 0.15); BATTLE.strikes.push({ kind: 'meteor', owner: f, team: f.team, x: clamp(p.x + rand(-90, 90), ARENA.x + 30, ARENA.r - 30), y: clamp(p.y + rand(-80, 80), ARENA.y + 30, ARENA.b - 30), t: 0.6 + i * 0.16, max: 0.6 + i * 0.16, r: 60, dmg: skillDmg(f, P) * 0.55, col, effect: s.effect, power: P }); }
  },
  clone(f, s, P) {
    const mine = BATTLE.fighters.filter(c => c.isClone && c.owner === f && c.alive).length; if (mine >= 2) return false;
    spawnClone(f, P, 5 + P / 25, rand(TAU));
  },
  orbitals(f, s, P, col) { BATTLE.orbs.push({ owner: f, team: f.team, n: 3 + Math.floor(P / 35), life: 6, ang: 0, rad: f.r + 40, dmg: skillDmg(f, P) * 0.4, col, hitCd: new Map(), effect: s.effect, power: P }); },
  timestop(f, s, P, col) {
    const dur = Math.min(2.2, 0.9 + P / 70);
    for (const e of f.enemies()) { e.st.timestop = e.boss ? dur * 0.5 : dur; FX.ring(e.x, e.y, col, e.r * 1.8, 0.5, 5); }
    BATTLE.timeTint = Math.max(BATTLE.timeTint, dur); FX.text(ARENA.cx, ARENA.y + 60, 'TIME STOP', col, 34, { life: 1.1, vy: 0 }); Sound.play('god');
  },
  teleport(f, s, P, col, tgt) {
    FX.burst(f.x, f.y, col, 22, 260, 6, 0.5);
    const sp = len(tgt.vx, tgt.vy) || 1, back = datan2(-tgt.vy / sp, -tgt.vx / sp), dd = tgt.r + f.r + 30;
    f.x = clamp(tgt.x + dcos(back) * dd, ARENA.x + f.r, ARENA.r - f.r); f.y = clamp(tgt.y + dsin(back) * dd, ARENA.y + f.r, ARENA.b - f.r);
    const a = angTo(f, tgt); f.vx = dcos(a) * f.baseSpeed * 2; f.vy = dsin(a) * f.baseSpeed * 2; f.st.dash = 0.4; f.dashEffect = s.effect; f.dashPow = P;
    FX.burst(f.x, f.y, col, 26, 300, 6, 0.5); FX.ring(f.x, f.y, col, 110, 0.3, 6);
    if (len(tgt.x - f.x, tgt.y - f.y) < 140) dealDamage(f, tgt, skillDmg(f, P) * 0.6, { kind: 'skill', effect: s.effect, power: P });
    Sound.play('zap');
  },
  buff(f, s, P, col) { f.st.buff = 5; f.st.buffPow = 0.2 + P / 300; FX.ring(f.x, f.y, col, f.r * 2.2, 0.45, 8, f.r); FX.burst(f.x, f.y, col, 24, 250); FX.text(f.x, f.y - f.r - 44, 'POWER UP!', col, 18); },
  copy(f, s, P, col, tgt) {
    const opts = tgt.allSkills().filter(k => !['copy', 'adaptive', 'resurrect'].includes(k.type) && !k.copied);
    if (!opts.length) return false;
    const k = pick(opts);
    f.temp = { ...k, name: '⧉ ' + k.name, cdLeft: 0, copied: true, expires: 10, color: col, power: (k.power || 50) * 1.1 };
    FX.text(f.x, f.y - f.r - 46, 'COPIED: ' + k.name, col, 18, { life: 1.4 });
    FX.bolt(tgt.x, tgt.y, f.x, f.y, col, 4, 0.35);
    after(0.25, () => { if (f.alive && f.temp) { useSkill(f, f.temp); } });
  },
  adaptive(f, s, P, col, tgt) {
    if (!f.ai) return false;
    const style = f.ai.adaptTo(tgt);
    f.st.adapt = 10; f.adaptPow = 0.15 + P / 400; healFighter(f, f.maxHp * P / 400);
    f.adaptVs = tgt.recent.skill >= tgt.recent.collision ? 'skill' : 'collision';
    FX.text(f.x, f.y - f.r - 64, 'RESISTS ' + (f.adaptVs === 'skill' ? 'ABILITIES' : 'COLLISIONS'), '#ffffff', 14, { life: 1.5 });
    FX.text(f.x, f.y - f.r - 46, 'ADAPTED → ' + style.toUpperCase(), col, 18, { life: 1.5 });
    FX.ring(f.x, f.y, col, f.r * 2.6, 0.6, 6, f.r); FX.burst(f.x, f.y, col, 20, 240);
  },
  resurrect(f, s, P) { if (f.resUsed || f.hpRatio > 0.35) return false; resurrect(f, clamp(P / 100, 0.2, 0.8)); },
  phase(f, s, P, col) {
    f.st.phase = 1.4 + P / 70; FX.burst(f.x, f.y, col, 26, 260, 6, 0.6); FX.ring(f.x, f.y, col, f.r * 2.4, 0.5, 6, f.r);
    if (BATTLE.fighters.filter(c => c.isClone && c.owner === f && c.alive).length < 2) { const c = spawnClone(f, P * 0.4, 3, rand(TAU)); c.maxHp = c.hp = Math.max(5, Math.round(f.maxHp * 0.12)); }
  },
  portalgate(f, s, P, col, tgt) {
    const a = angTo(f, tgt), fx = f.x + dcos(a) * (f.r + 36), fy = f.y + dsin(a) * (f.r + 36), b = behind(tgt, f);
    openPortal(fx, fy, { r: f.r * 1.3, life: 0.7, col }); openPortal(b.x, b.y, { r: f.r * 1.3, life: 1.1, col });
    enterPortal(f, fx, fy, 0.32, { mode: 'behind', tgt, col, dash: { P, effect: s.effect }, onExit: (m, p, t) => {
      if (t && len(t.x - m.x, t.y - m.y) < 170) dealDamage(m, t, skillDmg(m, P) * 0.7, { kind: 'skill', effect: s.effect, power: P });
      for (let i = 0; i < 3; i++) portalShot(m, p.x, p.y, t, { speed: 470, r: 9, dmg: skillDmg(m, P) * 0.28, col, power: P, homing: 4, life: 2.6 });
    } });
  },
  dimescape(f, s, P, col, tgt) {
    const e = edgePortal(f), back = !!tgt && f.hpRatio > 0.4 && RNG() < 0.55;
    openPortal(e.x, e.y, { r: f.r * 1.45, life: 0.9, col, edge: e.side });
    enterPortal(f, e.x, e.y, 0.75 + P / 160, { mode: back ? 'behind' : 'safe', tgt, col, dash: back ? { P, effect: s.effect } : null, onExit: (m, p) => {
      BATTLE.waves.push({ owner: m, team: m.team, x: p.x, y: p.y, r: m.r, maxR: 170 + P, speed: 650, w: 16, dmg: skillDmg(m, P) * 0.5, col, effect: 'slow', power: P, hit: new Set(), force: 380 });
      healFighter(m, m.maxHp * 0.04, true);
    } }, { x: e.ox, y: e.oy });
  },
  summon(f, s, P, col) {
    const { s: have } = armyOf(f); if (have >= PORTAL.SUMMON_MAX) return false;
    const n = Math.min(PORTAL.SUMMON_MAX - have, clamp(s.count || 2, 1, 3));
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), x = inArenaX(f.x + dcos(a) * f.r * 2.8), y = inArenaY(f.y + dsin(a) * f.r * 2.8);
      openPortal(x, y, { r: 50, life: 1.0, col });
      after(0.3 + i * 0.2, () => spawnSummon(f, pickSummonDef(), x, y, P));
    }
  },
  clonearmy(f, s, P, col) {
    const { c: have } = armyOf(f); if (have >= PORTAL.CLONE_MAX) return false;
    const n = Math.min(PORTAL.CLONE_MAX - have, 3), base = rand(TAU);
    for (let i = 0; i < n; i++) spawnPortalClone(f, P, base + i / n * TAU, i === n - 1 && RNG() < 0.65 ? pickSummonDef() : null);
    if (!FX.off) Sound.play('clone');
  },
  reflect(f, s, P, col) { f.st.reflect = 2 + P / 40; FX.ring(f.x, f.y, '#ffffff', f.r * 1.8, 0.4, 6, f.r); Sound.play('shield'); },
};
Object.assign(SKILL_FN, TECH_SKILLS);

function useSkill(f, sk) {
  if (!f.canAct() || !sk || sk.locked || sk.cdLeft > 0) return false;
  if (f.st.silence > 0) { if (f.manual && !FX.off) FX.text(f.x, f.y - f.r - 26, 'SILENCED', '#ff8a80', 15, { life: 0.5 }); return false; }        // EMP / Absolute Zero
  if (f.st.overheat > 0 && HEAT.BLOCK.includes(sk.type)) { if (f.manual && !FX.off) FX.text(f.x, f.y - f.r - 26, 'OVERHEATED', '#ff9100', 15, { life: 0.5 }); return false; }
  const tgt = (f.target && f.target.alive && !(f.target.st.outside > 0)) ? f.target : nearestEnemy(f);
  const selfOnly = ['shield', 'heal', 'buff', 'resurrect', 'clone', 'orbitals', 'shockwave', 'explosion', 'gravity', 'dimescape', 'summon', 'clonearmy'].includes(sk.type) || TECH_SELF.includes(sk.type);
  if (!tgt && !selfOnly) return false;
  if (!tgt && sk.type === 'adaptive') return false;
  f.target = tgt || f.target;
  let P = (sk.power || 50) * f.powerMul * (f.god > 0 && !(f.st.antievo > 0) ? 1.5 : 1);
  if (f.st.nulled > 0) P *= f.boss ? 0.8 : 0.6;                                  // inside an enemy Null Zone
  const boost = f.energy > 4 && ENERGY_TYPES.includes(sk.type) ? 1 + f.energy / 100 * ANTI.ENERGY_BONUS : 1;   // Power Absorb's stored energy
  P *= boost;
  if (typeof supSkillPower === 'function') P = supSkillPower(f, sk, P);
  const col = sk.color || f.def.design.c3, fn = SKILL_FN[sk.type];
  if (!fn) return false;
  if (fn(f, sk, P, col, tgt) === false) return false;
  sk.cdLeft = sk.cd || 6;
  if (boost > 1) { FX.text(f.x, f.y - f.r - 46, `ENERGY RELEASE +${Math.round((boost - 1) * 100)}%`, '#ea80fc', 16, { life: 1 }); FX.ring(f.x, f.y, '#ea80fc', f.r * 2.4, 0.35, 6, f.r); f.energy = 0; }
  if (f.def.heat && HEAT.COST[sk.type]) addHeat(f, HEAT.COST[sk.type]);
  f.stats.skills++; if (f.isPlayer) SAVE.stats.skills++;
  if (!f.isClone) FX.text(f.x, f.y - f.r - 26, sk.name, col, 16, { life: 1.0, vy: -40 });
  Sound.play(TECH_SFX[sk.type] || (sk.type === 'beam' ? 'beam' : 'skill'), 1, sfxOf(f.def));
  return true;
}

/* ---------- Ultimates ---------- */
function useUltimate(f) {
  if (!f.ult || f.ultMeter < 100 || !f.canAct() || BATTLE.cinematic) return false;
  f.ultMeter = 0;
  if (f.isPlayer) SAVE.stats.skills++;
  if (f.baseDef && f.baseDef.forms && !f.isClone && typeof supremeUlt === 'function') supremeUlt(f);          // Supreme: Base → Awakened → Final God form
  else if (f.def.godMode && !f.godUsed && !f.isClone && !(f.st.antievo > 0)) startGodMode(f, () => performUlt(f));   // Anti Evolution postpones the transformation
  else performUlt(f);
  return true;
}
function startGodMode(f, then) {
  f.godUsed = true;
  BATTLE.cinematic = { f, t: 0, dur: 1.6, then };
  Sound.play('god'); FX.addFlash(0.15, '#fff8e1');
  if (f.isPlayer) SAVE.stats.gods++;
}
function finishGodMode(f) {
  f.god = f.def.godDur || (f.def.adminOnly ? 15 : 12); healFighter(f, f.maxHp * 0.15); f.st.invuln = 1; f.st.stun = f.st.freeze = f.st.timestop = 0;
  const name = f.def.godName || ('GOD ' + f.def.name.toUpperCase());
  FX.text(ARENA.cx, ARENA.y + 70, 'GOD MODE', '#ffd54f', 46, { life: 1.8, vy: 0, pop: 2, stroke: '#4a2a00' });
  FX.text(ARENA.cx, ARENA.y + 118, name, godDesign(f.def.design).c2, 24, { life: 1.8, vy: 0 });
  for (let i = 0; i < 5; i++) FX.ring(f.x, f.y, i % 2 ? '#ffffff' : '#ffd54f', 200 + i * 90, 0.6 + i * 0.12, 14 - i * 2, f.r);
  FX.burst(f.x, f.y, '#ffd54f', 70, 700, 8, 1.2); FX.addShake(14); FX.addFlash(0.3, '#fff8e1');
  for (const e of f.enemies()) knock(e, f.x, f.y, 600);
}
function performUlt(f) {
  const prev = CUR_ULT; CUR_ULT = true;
  try { performUltCore(f); } finally { CUR_ULT = prev; }
  if (f.castFn && !f.castFn.ult) { const fn = f.castFn; f.castFn = () => { const pv = CUR_ULT; CUR_ULT = true; try { fn(); } finally { CUR_ULT = pv; } }; f.castFn.ult = true; }
}
function performUltCore(f) {
  if (!f.alive || !BATTLE) return;
  const u = f.ult, col = u.color || f.def.design.c3, eff = u.effect;
  let P = (u.power || 80) * f.powerMul * (f.god > 0 && !(f.st.antievo > 0) ? 1.3 : 1);
  if (f.st.nulled > 0) P *= 0.75;
  if (f.energy > 4) { P *= 1 + f.energy / 100 * ANTI.ENERGY_BONUS; FX.text(f.x, f.y - f.r - 64, 'ENERGY RELEASE', '#ea80fc', 16, { life: 1 }); f.energy = 0; }
  const dmg = skillDmg(f, P);
  const tgt = (f.target && f.target.alive && !(f.target.st.outside > 0)) ? f.target : nearestEnemy(f);
  FX.text(ARENA.cx, ARENA.b - 40, '★ ' + u.name + ' ★', col, 30, { life: 1.8, vy: -10, pop: 1.6 });
  FX.ring(f.x, f.y, col, f.r * 3, 0.4, 10, f.r); Sound.play('ult', 1, sfxOf(f.def));
  if (f.isPlayer) BATTLE.ultsUsed++;
  const T = tgt || { x: ARENA.cx, y: ARENA.cy, vx: 0, vy: 0, r: 40, alive: false };
  if (TECH_ULTS[u.type]) { TECH_ULTS[u.type](f, P, col, dmg, eff, tgt, T); return; }
  switch (u.type) {
    case 'nova': explodeAt(f, f.x, f.y, 330, dmg * 1.25, col, eff, 720, P); FX.ring(f.x, f.y, '#ffffff', 380, 0.7, 6); break;
    case 'supernova':
      f.casting = 0.8; FX.text(f.x, f.y - f.r - 30, 'CHARGING...', col, 18, { life: 0.8 });
      f.castFn = () => { explodeAt(f, f.x, f.y, 470, dmg * 1.5, col, eff, 900, P); FX.addFlash(0.25, col); for (let i = 0; i < 3; i++) FX.ring(f.x, f.y, i ? col : '#fff', 520 - i * 80, 0.8, 16); };
      break;
    case 'barrage':
      for (let i = 0; i < 16; i++) after(i * 0.075, () => { if (f.alive) spawnProj(f, f.t * 6 + i * 0.7, { speed: 460, r: 9, dmg: dmg * 0.22, col, effect: eff, power: P, homing: 3.6, life: 3.4, target: tgt }); });
      break;
    case 'megabeam':
      BATTLE.beams.push({ owner: f, team: f.team, ang: tgt ? angTo(f, tgt) : 0, t: 0, charge: 0.55, fire: 1.4, w: 56, dmg: dmg * 0.24, col, effect: eff, power: P, hit: new Set(), mega: true, tick: 0, target: tgt });
      Sound.play('beam'); break;
    case 'blackhole': {
      const p = { x: clamp(T.x, ARENA.x + 120, ARENA.r - 120), y: clamp(T.y, ARENA.y + 120, ARENA.b - 120) };
      BATTLE.zones.push({ kind: 'blackhole', owner: f, team: f.team, x: p.x, y: p.y, r: 330, life: 3, max: 3, col, pull: 1500, dmg: dmg * 0.12, ticks: new Map(), effect: eff, power: P, endDmg: dmg * 0.7 });
      break;
    }
    case 'meteorstorm':
      for (let i = 0; i < 9; i++) after(i * 0.2, () => { if (!f.alive || !T) return; const p = tgt && tgt.alive ? predictPos(f, tgt, 0.6) : { x: rand(ARENA.x + 60, ARENA.r - 60), y: rand(ARENA.y + 60, ARENA.b - 60) }; BATTLE.strikes.push({ kind: 'meteor', owner: f, team: f.team, x: clamp(p.x + rand(-110, 110), ARENA.x + 30, ARENA.r - 30), y: clamp(p.y + rand(-90, 90), ARENA.y + 30, ARENA.b - 30), t: 0.6, max: 0.6, r: 78, dmg: dmg * 0.4, col, effect: eff, power: P }); });
      break;
    case 'storm':
      for (let i = 0; i < 7; i++) after(i * 0.26, () => { const tt = tgt && tgt.alive ? tgt : nearestEnemy(f); if (!f.alive || !tt) return; const p = predictPos(f, tt, 0.45); BATTLE.strikes.push({ kind: 'lightning', owner: f, team: f.team, x: p.x, y: p.y, t: 0.45, max: 0.45, r: 75, dmg: dmg * 0.38, col, effect: eff, power: P }); });
      break;
    case 'judgment':
      for (let i = 0; i < 5; i++) after(i * 0.28, () => { const tt = tgt && tgt.alive ? tgt : nearestEnemy(f); if (!f.alive || !tt) return; const p = predictPos(f, tt, 0.55); BATTLE.strikes.push({ kind: 'pillar', owner: f, team: f.team, x: p.x + (i ? rand(-60, 60) : 0), y: p.y, t: 0.55, max: 0.55, r: 70, dmg: dmg * 0.42, col, effect: eff, power: P }); });
      break;
    case 'timestop': {
      const dur = 2.6;
      for (const e of f.enemies()) e.st.timestop = e.boss ? dur * 0.6 : dur;
      BATTLE.timeTint = dur; FX.text(ARENA.cx, ARENA.y + 60, 'THE WORLD STOPS', col, 34, { life: 1.6, vy: 0 });
      after(dur, () => { if (!f.alive) return; FX.text(ARENA.cx, ARENA.y + 60, 'TIME RESUMES', '#ffffff', 30, { life: 1, vy: 0 }); for (const e of f.enemies()) { dealDamage(f, e, dmg * 0.85, { kind: 'skill', effect: eff, power: P }); FX.ring(e.x, e.y, col, 140, 0.5, 8); } FX.addShake(10); });
      break;
    }
    case 'swarm': for (let i = 0; i < 3; i++) spawnClone(f, P, 7, i / 3 * TAU); break;
    case 'infiniteportal': {
      FX.addFlash(0.3, '#b026ff'); FX.addShake(10); BATTLE.timeTint = Math.max(BATTLE.timeTint, 1.2);
      FX.text(ARENA.cx, ARENA.cy - 40, '∞ INFINITE PORTAL ∞', '#e1b3ff', 46, { life: 2.2, vy: 0, pop: 2, stroke: '#1a0033' });
      const n = 6, rad = 240, cx = inArenaX(T.x, 140), cy = inArenaY(T.y, 130), spots = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU + rand(-0.15, 0.15); spots.push({ x: inArenaX(cx + dcos(a) * rad), y: inArenaY(cy + dsin(a) * rad * 0.8) }); }
      spots.forEach((p, i) => after(i * 0.1, () => openPortal(p.x, p.y, { r: 58, life: 3.4, col, big: true })));
      // the army pours out of the portals…
      after(0.45, () => { for (let i = 0; i < 3; i++) spawnSummon(f, pickSummonDef(), spots[i * 2].x, spots[i * 2].y, P, 8); });
      after(0.6, () => { for (let i = 0; i < 2; i++) { if (armyOf(f).s + armyOf(f).c < PORTAL.ARMY_MAX) { const c = spawnPortalClone(f, P, i * Math.PI, i ? pickSummonDef() : null); c.x = spots[i * 2 + 1].x; c.y = spots[i * 2 + 1].y; } } });
      // …every portal fires a coordinated volley…
      spots.forEach((p, i) => { for (let k = 0; k < 2; k++) after(0.8 + i * 0.09 + k * 0.5, () => { if (!f.alive) return; const t = nearestEnemy(f); portalShot(f, p.x, p.y, t, { speed: 560, r: 12, dmg: dmg * 0.16, col, effect: eff, power: P, homing: 3.2, life: 2.4 }); }); });
      // …a dimensional rift drags the enemy in, and the master strikes through the last portal
      after(1.8, () => { if (f.alive) BATTLE.zones.push({ kind: 'blackhole', owner: f, team: f.team, x: cx, y: cy, r: 300, life: 1.6, max: 1.6, col, pull: 1300, dmg: dmg * 0.08, ticks: new Map(), effect: eff, power: P, endDmg: dmg * 0.45 }); });
      after(2.7, () => { if (f.alive && !(f.st.outside > 0)) enterPortal(f, f.x, f.y, 0.3, { mode: 'behind', col, dash: { P, effect: eff }, onExit: (m, p) => explodeAt(m, p.x, p.y, 190, dmg * 0.35, col, eff, 700, P) }); });
      break;
    }
    case 'omniversal':
      FX.text(f.x, f.y - f.r - 50, 'REALITY BREAK', '#e0aaff', 22, { life: 1.4 });
      BATTLE.waves.push({ owner: f, team: f.team, x: f.x, y: f.y, r: f.r, maxR: 900, speed: 900, w: 30, dmg: dmg * 0.9, col: '#b026ff', effect: 'stun', power: P, hit: new Set(), force: 700 });
      for (let i = 0; i < 2; i++) spawnClone(f, P, 9, i * Math.PI);
      for (let i = 0; i < 10; i++) after(0.4 + i * 0.08, () => { if (f.alive) spawnProj(f, i / 10 * TAU, { speed: 420, r: 10, dmg: dmg * 0.18, col: '#e0aaff', power: P, homing: 3.8, life: 3.5, target: tgt }); });
      break;
    case 'apocalypse':
      explodeAt(f, f.x, f.y, 300, dmg * 0.7, '#ffd54f', 'burn', 760, P);
      healFighter(f, f.maxHp * 0.12);
      for (let i = 0; i < 6; i++) after(0.3 + i * 0.22, () => { const es = f.enemies(); if (!f.alive || !es.length) return; const tt = es[i % es.length]; const p = predictPos(f, tt, 0.5); BATTLE.strikes.push({ kind: 'pillar', owner: f, team: f.team, x: p.x, y: p.y, t: 0.5, max: 0.5, r: 85, dmg: dmg * 0.35, col: '#ffd54f', effect: 'stun', power: P }); });
      break;
    case 'collapse': {
      const p = { x: clamp(T.x, ARENA.x + 120, ARENA.r - 120), y: clamp(T.y, ARENA.y + 120, ARENA.b - 120) };
      BATTLE.zones.push({ kind: 'blackhole', owner: f, team: f.team, x: p.x, y: p.y, r: 360, life: 2.4, max: 2.4, col, pull: 1700, dmg: dmg * 0.1, ticks: new Map(), effect: 'stun', power: P, endDmg: dmg * 0.95 });
      after(2.45, () => { if (!f.alive) return; FX.addFlash(0.25, col); for (let i = 0; i < 4; i++) FX.ring(p.x, p.y, i % 2 ? '#ffffff' : col, 200 + i * 110, 0.7 + i * 0.1, 14 - i * 3, 10); FX.text(p.x, p.y, 'Ω', '#ffffff', 90, { life: 1, vy: 0, pop: 2 }); });
      break;
    }
    case 'phantomdim':
      f.st.phase = 3.5; BATTLE.timeTint = Math.max(BATTLE.timeTint, 3);
      for (const e of f.enemies()) { applyEffect(f, e, 'weaken', P); e.st.slow = Math.max(e.st.slow, 3); }
      for (let i = 0; i < 3; i++) spawnClone(f, P * 0.6, 6, i / 3 * TAU);
      for (let i = 0; i < 8; i++) after(0.4 + i * 0.25, () => { if (f.alive) spawnProj(f, rand(TAU), { speed: 420, r: 9, dmg: dmg * 0.16, col, effect: 'weaken', power: P, homing: 3.6, life: 3.2, target: tgt }); });
      break;
    case 'infinitecore':
      f.st.shield = 5; f.st.shieldPow = 0.85; healFighter(f, f.maxHp * 0.25); f.st.burn = f.st.poison = f.st.weaken = 0;
      BATTLE.orbs.push({ owner: f, team: f.team, n: 6, life: 7, ang: 0, rad: f.r + 46, dmg: dmg * 0.18, col, hitCd: new Map(), effect: 'slow', power: P });
      BATTLE.waves.push({ owner: f, team: f.team, x: f.x, y: f.y, r: f.r, maxR: 520, speed: 760, w: 22, dmg: dmg * 0.55, col, effect: 'slow', power: P, hit: new Set(), force: 600 });
      break;
    case 'chaoseruption':
      for (let i = 0; i < 20; i++) after(i * 0.06, () => { if (f.alive) spawnProj(f, i * 0.9 + rand(0.4), { speed: 480, r: 9, dmg: dmg * 0.14, col: pick(['#ff1744', '#00e5ff', '#76ff03', '#ffd600', '#d500f9']), effect: 'random', power: P, homing: 2.5, life: 3.2, target: tgt }); });
      for (let i = 0; i < 4; i++) after(0.5 + i * 0.3, () => { if (!f.alive) return; const es = f.enemies(); const tt = es.length ? pick(es) : null; const p = tt ? predictPos(f, tt, 0.5) : { x: rand(ARENA.x + 80, ARENA.r - 80), y: rand(ARENA.y + 80, ARENA.b - 80) }; BATTLE.strikes.push({ kind: i % 2 ? 'meteor' : 'lightning', owner: f, team: f.team, x: p.x, y: p.y, t: 0.5, max: 0.5, r: 75, dmg: dmg * 0.3, col, effect: 'random', power: P }); });
      break;
    case 'dragonnova':
      f.casting = 0.7; FX.text(f.x, f.y - f.r - 30, 'DRAGON NOVA', col, 22, { life: 0.9 });
      f.castFn = () => {
        explodeAt(f, f.x, f.y, 430, dmg * 1.2, col, 'burn', 850, P); FX.addFlash(0.2, col);
        for (let i = 0; i < 6; i++) after(0.25 + i * 0.18, () => { const es = f.enemies(); if (!f.alive || !es.length) return; const tt = es[i % es.length], p = predictPos(f, tt, 0.6); BATTLE.strikes.push({ kind: 'meteor', owner: f, team: f.team, x: clamp(p.x + rand(-70, 70), ARENA.x + 30, ARENA.r - 30), y: clamp(p.y + rand(-60, 60), ARENA.y + 30, ARENA.b - 30), t: 0.6, max: 0.6, r: 80, dmg: dmg * 0.3, col: '#ffd54f', effect: 'burn', power: P }); });
      };
      break;
    case 'miracle':
      f.st.burn = f.st.poison = f.st.stun = f.st.freeze = f.st.slow = f.st.weaken = 0; f.poisonStacks = 0;
      healFighter(f, f.maxHp * 0.35); f.st.shield = Math.max(f.st.shield, 4); f.st.shieldPow = Math.max(f.st.shieldPow, 0.7); f.st.invuln = Math.max(f.st.invuln, 1.2);
      for (const a of BATTLE.fighters) if (a.alive && a.team === f.team && a !== f && !a.isClone) healFighter(a, a.maxHp * 0.15);
      explodeAt(f, f.x, f.y, 320, dmg * 0.8, col, 'none', 650, P); FX.ring(f.x, f.y, '#ffffff', 360, 0.8, 10);
      break;
    default: explodeAt(f, f.x, f.y, 300, dmg, col, eff, 700, P);
  }
}

/* =====================================================================
   9. AI CONTROLLERS
   Personalities: aggressive, defensive, tactical, intelligent, adaptive, boss.
   Difficulty controls reaction time, aim, dodge rate and skill judgement.
   ===================================================================== */
const DIFF = {
  easy: { label: 'Easy', react: 0.5, aim: 0.35, steer: 0.45, skill: 0.45, dodge: 0.1, ult: 0.3, statMul: 0.85, lvl: -2, reward: 0.7 },
  normal: { label: 'Normal', react: 0.3, aim: 0.65, steer: 0.7, skill: 0.72, dodge: 0.35, ult: 0.6, statMul: 1.0, lvl: 0, reward: 1 },
  hard: { label: 'Hard', react: 0.17, aim: 0.85, steer: 0.9, skill: 0.9, dodge: 0.6, ult: 0.85, statMul: 1.1, lvl: 2, reward: 1.4, rp: 14 },
  expert: { label: 'Expert', react: 0.11, aim: 0.93, steer: 1.0, skill: 0.95, dodge: 0.74, ult: 0.93, statMul: 1.16, lvl: 3, reward: 1.7, rp: 20 },
  godlike: { label: 'Godlike', react: 0.07, aim: 1.0, steer: 1.1, skill: 1.0, dodge: 0.86, ult: 1.0, statMul: 1.22, lvl: 4, reward: 2.2, rp: 30 },
};
DIFF.easy.rp = 5; DIFF.normal.rp = 9;
const normDiff = d => d === 'insane' ? 'godlike' : (DIFF[d] ? d : 'normal');
const RANGED = ['projectile', 'multishot', 'homing', 'beam', 'lightning', 'meteor'];

class AIController {
  constructor(f, personality = 'intelligent', diff = 'normal') {
    this.f = f; this.pers = AI_TYPES.includes(personality) ? personality : 'intelligent'; this.basePers = this.pers;
    this.diff = DIFF[diff] ? diff : 'normal'; this.p = DIFF[this.diff];
    this.timer = rand(0.3); this.mode = 'attack'; this.dx = 0; this.dy = 0; this.pow = 0; this.side = RNG() < 0.5 ? 1 : -1;
    this.skillGap = 0; this.ultWait = 0; this.phase = 1;
    this.adapt = { scores: { attack: 0, kite: 0, orbit: 0 }, t: 0, dealt: 0, taken: 0, mode: 'attack' };
  }
  onHit(src, amt) { this.adapt.taken += amt; if (this.pers === 'defensive' || this.pers === 'intelligent') this.timer = Math.min(this.timer, 0.05); }
  onRage() { this.timer = 0; }
  adaptTo(t) {
    const f = this.f, colAdv = this.colAdv(t);
    let style;
    if (t.recent.skill > t.recent.collision * 1.3) style = 'aggressive';        // ranged enemy: close the gap
    else if (colAdv < 0.85) style = 'tactical';                                   // stronger body: keep distance
    else if (f.hpRatio < t.hpRatio - 0.15) style = 'defensive';
    else style = colAdv > 1.15 ? 'aggressive' : 'intelligent';
    this.pers = style; this.timer = 0; return style;
  }
  colAdv(t) { const f = this.f; return (f.effAtk() / (t.effDef() + 60)) / Math.max(0.01, t.effAtk() / (f.effDef() + 60)); }
  pickTarget() {
    const f = this.f, es = f.enemies().filter(e => !(e.st.outside > 0)); if (!es.length) return null;
    const real = es.filter(e => !e.isClone || e.decoy), pool = real.length ? real : es;   // holograms fool the AI too
    if (f.defender && f.owner && f.owner.alive) {   // portal summons protect their master first
      let near = null, nd = 300; for (const e of pool) { const dd = len(e.x - f.owner.x, e.y - f.owner.y); if (dd < nd) { nd = dd; near = e; } }
      if (near) return near;
    }
    if (this.pers === 'boss') { const pl = pool.find(e => e.isPlayer); if (pl) return pl; }
    let best = null, bs = Infinity;
    for (const e of pool) {
      const d = len(e.x - f.x, e.y - f.y);
      const s = (this.pers === 'tactical' || this.pers === 'intelligent') ? d * 0.4 + e.hpRatio * 600 : d;
      if (s < bs) { bs = s; best = e; }
    }
    if (f.target && f.target.alive && pool.includes(f.target) && RNG() < 0.7) return f.target; // stickiness
    return best;
  }
  threat() {
    const f = this.f; let worst = null, wt = 1.2;
    for (const p of BATTLE.projs) {
      if (p.team === f.team) continue;
      const rx = f.x - p.x, ry = f.y - p.y, vv = p.vx * p.vx + p.vy * p.vy || 1, tt = (rx * p.vx + ry * p.vy) / vv;
      if (tt < 0 || tt > wt) continue;
      const cx = p.x + p.vx * tt - f.x, cy = p.y + p.vy * tt - f.y;
      if (len(cx, cy) < f.r + p.r + 25) { wt = tt; worst = { vx: p.vx, vy: p.vy, t: tt }; }
    }
    for (const b of BATTLE.beams) {
      if (b.team === f.team || b.t > b.charge) continue;
      const o = b.owner, end = rayToWall(o.x, o.y, b.ang);
      if (segDist(f.x, f.y, o.x, o.y, end.x, end.y) < f.r + b.w) worst = { vx: dcos(b.ang), vy: dsin(b.ang), t: 0.2, beam: true };
    }
    for (const s of BATTLE.strikes) if (s.team !== f.team && len(s.x - f.x, s.y - f.y) < s.r + f.r + 10) worst = { vx: f.x - s.x || 1, vy: f.y - s.y, t: s.t, away: true };
    return worst;
  }
  update(dt) {
    const f = this.f;
    if (!f.canAct()) { f.steerPow = 0; return; }
    this.skillGap -= dt; this.adapt.t += dt; this.timer -= dt;
    if (this.timer <= 0) { this.timer = this.p.react * rand(0.8, 1.25); this.think(); }
    f.steerX = this.dx; f.steerY = this.dy; f.steerPow = this.pow;
  }
  think() {
    const f = this.f, t = this.pickTarget(); f.target = t;
    if (!t) { this.pow = 0; return; }
    const p = this.p, d = len(t.x - f.x, t.y - f.y), myR = f.hpRatio, tR = t.hpRatio, adv = this.colAdv(t);
    const disabled = t.st.stun > 0 || t.st.timestop > 0 || t.st.freeze > 0;
    const rangedReady = f.allSkills().some(s => !s.locked && s.cdLeft <= 0 && RANGED.includes(s.type));
    // ---- boss phases ----
    if (this.pers === 'boss' || f.boss) {
      const ph = myR > 0.66 ? 1 : myR > 0.33 ? 2 : 3;
      if (ph > this.phase) {
        this.phase = ph; f.ultMeter = Math.min(100, f.ultMeter + 50); f.allSkills().forEach(s => s.cdLeft = Math.min(s.cdLeft, 0.5));
        FX.text(ARENA.cx, ARENA.y + 70, 'BOSS PHASE ' + ph, '#ff3355', 40, { life: 1.6, vy: 0, pop: 2 }); FX.addShake(10);
        for (let i = 0; i < ph - 1; i++) spawnClone(f, 60, 8, rand(TAU));
      }
    }
    // ---- adaptive learning (epsilon-greedy over strategies) ----
    if (this.basePers === 'adaptive' && this.pers === 'adaptive') {
      const A = this.adapt;
      if (A.t > 5) {
        const reward = A.dealt - A.taken * 1.1; A.scores[A.mode] = lerp(A.scores[A.mode], reward, 0.5);
        const keys = Object.keys(A.scores);
        const next = RNG() < 0.25 ? pick(keys) : keys.reduce((a, b) => A.scores[a] >= A.scores[b] ? a : b);
        if (next !== A.mode) FX.text(f.x, f.y - f.r - 30, 'ADAPTING…', '#e0aaff', 14);
        A.mode = next; A.t = 0; A.dealt = 0; A.taken = 0;
      }
      A.dealt = f.stats.dmg - (A.base ?? (A.base = f.stats.dmg)); if (A.t === 0) A.base = f.stats.dmg;
    }
    // ---- choose strategic mode ----
    let mode = 'attack';
    switch (this.pers) {
      case 'aggressive': mode = (myR < 0.25 && !f.rage && tR > 0.6 && RNG() < 0.3) ? 'kite' : 'attack'; break;
      case 'defensive': mode = (disabled || tR < 0.3 || f.st.shield > 0 || f.god > 0) ? 'attack' : (myR < tR - 0.05 ? 'kite' : (adv > 1.1 ? 'attack' : 'orbit')); break;
      case 'tactical': mode = (disabled || f.st.dash > 0 || f.god > 0) ? 'attack' : (rangedReady ? 'kite' : (adv > 0.9 ? 'attack' : 'orbit')); break;
      case 'intelligent': mode = (adv > 1.08 || f.st.shield > 0 || f.god > 0 || disabled || tR < 0.25) ? 'attack' : (rangedReady ? 'kite' : 'orbit'); break;
      case 'adaptive': mode = this.adapt.mode; break;
      case 'boss': mode = this.phase === 1 ? (rangedReady ? 'kite' : 'attack') : 'attack'; break;
    }
    if (f.rage && this.pers !== 'defensive') mode = 'attack';
    // react to enemy transformations: respect an enemy God Mode unless we are transformed too
    if (t.god > 0 && f.god <= 0 && !f.rage && this.pers !== 'aggressive' && !disabled) mode = rangedReady ? 'kite' : 'orbit';
    // ---- dodge incoming threats ----
    const th = this.threat();
    if (th && RNG() < p.dodge) {
      const sh = f.allSkills().find(s => (s.type === 'shield' || s.type === 'dimescape') && !s.locked && s.cdLeft <= 0);
      if (sh && th.t < 0.5 && RNG() < p.skill) useSkill(f, sh); else mode = 'dodge';
    }
    this.mode = mode;
    // ---- steering direction ----
    let dx = 0, dy = 0;
    const tx = t.x - f.x, ty = t.y - f.y, tl = d || 1, nx = tx / tl, ny = ty / tl;
    if (mode === 'attack') { const pp = predictPos(f, t, d / Math.max(200, f.baseSpeed * f.speedMul())); dx = pp.x - f.x; dy = pp.y - f.y; }
    else if (mode === 'kite') { const want = 380; if (d < want - 80) { dx = -nx + -ny * this.side * 0.6; dy = -ny + nx * this.side * 0.6; } else if (d > want + 90) { dx = nx; dy = ny; } else { dx = -ny * this.side; dy = nx * this.side; } }
    else if (mode === 'orbit') { dx = -ny * this.side + nx * 0.25; dy = nx * this.side + ny * 0.25; if (RNG() < 0.05) this.side *= -1; }
    else if (mode === 'dodge' && th) { if (th.away) { dx = th.vx; dy = th.vy; } else { dx = -th.vy * this.side; dy = th.vx * this.side; } }
    // wall avoidance
    const m = 120;
    if (f.x - ARENA.x < m) dx += (m - (f.x - ARENA.x)) / m * 1.4; if (ARENA.r - f.x < m) dx -= (m - (ARENA.r - f.x)) / m * 1.4;
    if (f.y - ARENA.y < m) dy += (m - (f.y - ARENA.y)) / m * 1.4; if (ARENA.b - f.y < m) dy -= (m - (ARENA.b - f.y)) / m * 1.4;
    const dl = len(dx, dy) || 1; this.dx = dx / dl; this.dy = dy / dl;
    this.pow = 640 * p.steer * (this.pers === 'aggressive' ? 1.1 : 1) * (mode === 'dodge' ? 1.6 : 1);
    if (mode === 'attack' && this.pers !== 'aggressive' && RNG() < 0.2) this.side *= -1;
    // ---- skills ----
    if (this.skillGap <= 0 && RNG() < p.skill + 0.15 && !(f.st.silence > 0)) {
      const ready = f.allSkills().filter(s => !s.locked && s.cdLeft <= 0);
      if (ready.length) {
        let best = null, bs = 0.35;
        const ctx = { d, myR, tR, adv, disabled, th, t };
        for (const s of ready) { const sc = this.scoreSkill(s, ctx) + rand(-1, 1) * (1 - p.skill) * 0.45; if (sc > bs) { bs = sc; best = s; } }
        if (this.diff === 'easy' && RNG() < 0.25) best = pick(ready);
        if (best && useSkill(f, best)) this.skillGap = 0.55 / p.skill + (f.boss ? 0 : 0.3);
      }
    }
    // ---- ultimate ----
    if (f.ult && f.ultMeter >= 100) {
      this.ultWait += this.p.react;
      const u = f.ult.type, close = d < 330;
      let good = tR < 0.5 || myR < 0.35 || this.ultWait > 6 || f.boss;
      if ((u === 'nova' || u === 'supernova') && !close) good = good && this.ultWait > 4;
      if (f.def.godMode && !f.godUsed && (myR < 0.65 || tR < 0.6)) good = true;
      if (RNG() > p.ult || good) { if (useUltimate(f)) this.ultWait = 0; }
    }
  }
  scoreSkill(s, c) {
    const f = this.f, P = s.power || 50, pers = this.pers;
    const tv = scoreTech(this, s, c); if (tv !== undefined) return tv;
    if (typeof supScore === 'function') { const sv = supScore(this, s, c); if (sv !== undefined) return sv; }
    const offensive = !['shield', 'heal', 'buff', 'resurrect', 'adaptive', 'clone', 'copy', 'dimescape', 'summon', 'clonearmy'].includes(s.type);
    if (offensive && (c.t.st.invuln > 0.3 || c.t.st.phase > 0.3)) return 0;                       // avoid wasting attacks on an invulnerable target
    if (s.type === 'shield' && c.t.god > 0 && f.st.shield <= 0) return 1.1;  // brace against a transformed enemy
    switch (s.type) {
      case 'projectile': case 'multishot': case 'homing': return 0.55 + (c.d > 200 ? 0.2 : 0) - (c.d < 90 ? 0.3 : 0) - (c.t.st.shield > 0 ? 0.3 : 0) + (s.type === 'homing' ? 0.1 : 0) + (s.effect === 'drain' && c.myR < 0.6 ? 0.25 : 0);
      case 'beam': return 0.5 + (c.d > 150 ? 0.25 : 0) + (c.disabled ? 0.3 : 0) - (c.t.st.shield > 0 ? 0.3 : 0);
      case 'lightning': case 'meteor': return 0.55 + (c.disabled || c.t.st.slow > 0 ? 0.3 : 0);
      case 'shockwave': return c.d < (240 + P * 2.2) * 0.65 ? 0.9 : 0.1;
      case 'explosion': return c.d < 130 + P * 1.1 + c.t.r - 15 ? 0.95 : 0.05;
      case 'dash': return (c.d > 150 && c.adv > 0.8 ? 0.7 : 0.25) + (c.disabled ? 0.25 : 0) + (pers === 'aggressive' ? 0.2 : 0) - (pers === 'defensive' ? 0.2 : 0) - (c.myR < 0.25 && !f.rage ? 0.2 : 0);
      case 'shield': return c.th ? 0.95 : (c.myR < 0.5 ? 0.6 : (c.d < 170 ? 0.5 : 0.15)) + (pers === 'defensive' ? 0.15 : 0);
      case 'heal': return c.myR > 0.85 ? 0 : (1 - c.myR) * 1.7 - 0.15;
      case 'trap': return 0.55 + (pers === 'tactical' ? 0.15 : 0);
      case 'gravity': return c.d < 380 ? (c.adv >= 0.9 ? 0.75 : 0.35) + (pers === 'aggressive' ? 0.15 : 0) : 0.1;
      case 'clone': return 0.65;
      case 'orbitals': return 0.55 + (c.d < 260 ? 0.25 : 0);
      case 'timestop': return 0.45 + (c.tR < 0.45 ? 0.3 : 0) + (f.allSkills().some(k => k !== s && !k.locked && k.cdLeft <= 0 && ['dash', 'beam', 'projectile'].includes(k.type)) ? 0.25 : 0);
      case 'teleport': return 0.55 + (c.adv > 1 ? 0.25 : 0);
      case 'buff': return 0.5 + (c.d < 300 ? 0.25 : 0);
      case 'copy': return 0.72;
      case 'adaptive': return f.st.adapt > 0 ? 0 : 0.8;
      case 'resurrect': return (!f.resUsed && c.myR < 0.3) ? 1.2 : 0;
      case 'phase': return c.th ? 1.0 : (c.myR < 0.5 ? 0.6 : 0.3);
      case 'portalgate': return 0.62 + (c.d > 260 ? 0.2 : 0) + (c.adv > 1 ? 0.12 : 0) + (c.disabled ? 0.2 : 0);
      case 'dimescape': return c.th ? 1.15 : (c.t.god > 0 && f.god <= 0 ? 0.95 : (c.myR < 0.3 ? 0.8 : (c.t.ultMeter >= 100 ? 0.6 : 0.12)));
      case 'summon': { const a = armyOf(f).s; return a < PORTAL.SUMMON_MAX ? 0.88 - a * 0.18 : 0; }
      case 'clonearmy': return armyOf(f).c < PORTAL.CLONE_MAX ? 0.7 : 0;
      case 'reflect': return c.th && !c.th.away ? 1.05 : (this.f.enemies().some(e => e.allSkills().some(k => RANGED.includes(k.type))) ? 0.45 : 0.15);
    }
    return 0.4;
  }
}

/* AI judgement for the Anti Ball and Tech Ball abilities (heat-aware) */
function scoreTech(ai, s, c) {
  const f = ai.f, t = c.t, k = s.type;
  if (!TECH_SKILLS[k]) return undefined;
  const heat = f.def.heat && HEAT.COST[k] && (f.heat || 0) + HEAT.COST[k] * (f.st.overclock > 0 ? 1.5 : 1) >= 100 ? 0.3 : 1;
  const ranged = t.allSkills().some(q => !q.locked && q.cdLeft <= 1 && RANGED.includes(q.type)), incoming = c.th && !c.th.away && !c.th.beam;
  let v;
  switch (k) {
    case 'nullzone': v = c.d < 320 ? 0.85 : ranged ? 0.45 : 0.15; break;
    case 'absorb': v = f.st.absorb > 0 ? 0 : incoming ? 1.15 : ranged ? 0.42 : 0.1; break;
    case 'reverse': v = f.st.reverse > 0 ? 0 : incoming ? 1.1 : ranged ? 0.38 : 0.1; break;
    case 'minihole': v = c.d < 520 ? 0.72 + (c.adv >= 0.9 ? 0.12 : 0) : 0.3; break;
    case 'voidtp': v = c.th ? 1.0 : c.myR < 0.35 ? 0.85 : c.d > 380 ? 0.55 : 0.25; break;
    case 'antievo': v = c.d > 460 + t.r ? 0 : (t.god > 0 || t.st.overclock > 0 || t.st.buff > 0 || t.st.adapt > 0) ? 1.2 : t.rage ? 0.95 : (t.def.godMode && !t.godUsed && t.ultMeter > 70) ? 0.8 : t.boss ? 0.55 : 0.2; break;
    case 'robots': { const n = unitsOf(f, 'robot'); v = n < UNIT.ROBOT_MAX ? 0.92 - n * 0.14 : 0; break; }
    case 'factory': v = unitsOf(f, 'factory') ? 0 : 0.78; break;
    case 'missiles': v = 0.68 + (c.d > 200 ? 0.12 : 0); break;
    case 'drone': v = f.guard && f.guard.alive ? 0 : c.th ? 1.0 : c.myR < 0.7 ? 0.75 : 0.45; break;
    case 'fusionbot': { const n = unitsOf(f, 'robot'); v = n >= 2 ? 0.55 + n * 0.1 : 0; break; }
    case 'lasergrid': v = 0.7 + (c.disabled || t.st.slow > 0 ? 0.2 : 0); break;
    case 'hologram': v = unitsOf(f, 'holo') ? 0 : c.th ? 0.9 : 0.6; break;
    case 'emp': v = t.st.silence > 0 ? 0.05 : (t.silenceImm > 0 ? 0.15 : 0.6) + (f.enemies().some(e => e.mech) ? 0.35 : 0) - (c.d > (300 + (s.power || 60) * 1.6) * 0.8 ? 0.5 : 0); break;
    case 'cybertrap': v = 0.6; break;
    case 'turret': v = unitsOf(f, 'turret') < UNIT.TURRET_MAX ? 0.75 : 0; break;
    case 'overclock': v = f.st.overclock > 0 ? 0 : (f.heat || 0) < 50 ? 0.7 : 0.2; break;
    default: return undefined;
  }
  return v * heat;
}
/* robots, drones, turrets and the factory: simple, robust machine brains (see unitBrain) */
class UnitAI extends AIController {
  constructor(f, diff) { super(f, 'aggressive', diff); this.fireT = rand(0.3, 0.9); this.actT = rand(1, 2); this.chk = 0; this.cx = f.x; this.cy = f.y; this.slot = rand(TAU); }
  update(dt) { unitBrain(this.f, this, dt); }
  onHit() {}
  onRage() {}
}

/* ---------- manual player input ---------- */
const Input = {
  keys: new Set(), pointer: null,
  init() {
    addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, select')) return;
      this.keys.add(e.key.toLowerCase());
      if (!BATTLE || UI.current) return;
      const k = e.key.toLowerCase();
      if (k === 'p' || k === 'escape') { BATTLE.togglePause(); e.preventDefault(); }
      if (k === 'm') toggleControl();
      const pl = BATTLE.player; if (!pl || !localManual() || BATTLE.paused) return;
      const idx = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, j: 0, k: 1, l: 2, ';': 3 }[k];
      if (k === ' ') { BATTLE.queue('u'); e.preventDefault(); }
      else if (idx != null) BATTLE.queue('k', idx);
      if (k === 'f' && pl.temp) BATTLE.queue('k', pl.skills.length);
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    const cv = $('#game');
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    cv.addEventListener('pointerdown', e => { if (BATTLE?.player && localManual()) { this.pointer = pos(e); cv.setPointerCapture(e.pointerId); } });
    cv.addEventListener('pointermove', e => { if (this.pointer) this.pointer = pos(e); });
    const up = () => { this.pointer = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  },
  /* returns quantised steering [x*100, y*100, power] so replays are bit-exact */
  read(f) {
    let x = 0, y = 0; const k = this.keys;
    if (k.has('arrowleft') || k.has('a')) x -= 1; if (k.has('arrowright') || k.has('d')) x += 1;
    if (k.has('arrowup') || k.has('w')) y -= 1; if (k.has('arrowdown') || k.has('s')) y += 1;
    if (this.pointer) { x = this.pointer.x - f.x; y = this.pointer.y - f.y; }
    const l = len(x, y);
    if (l < 0.01) return [0, 0, 0];
    return [Math.round(x / l * 100), Math.round(y / l * 100), 900];
  },
};

/* =====================================================================
   10. BATTLE ENGINE — physics, entities, modes
   ===================================================================== */
const TEAM_COLS = ['#29e3ff', '#ff3355', '#ffd54f', '#3dffa0', '#c77dff', '#ff9f1c'];
const MODES = {
  '1v1': { name: '1 VS 1', ico: '⚔', desc: 'The main event. Your ball versus an AI-controlled rival.', main: true },
  '2v2': { name: '2 VS 2', ico: '⚭', desc: 'Team up with an AI ally against two enemy balls.' },
  'ffa': { name: 'Free For All', ico: '✺', desc: '4-6 balls, every ball for itself. Last one rolling wins.' },
  'survival': { name: 'Survival', ico: '♨', desc: 'Survive endless waves. HP carries over between waves.' },
  'tournament': { name: 'Tournament', ico: '🏆', desc: '8-ball knockout bracket. Win 3 battles to be champion.' },
  'boss': { name: 'Boss Battle', ico: '☠', desc: 'Face a giant God-tier boss ball with phases and minions.' },
  'endless': { name: 'Endless Battle', ico: '∞', desc: 'One enemy after another, each stronger. How many KOs?' },
  'practice': { name: 'Practice', ico: '◎', desc: 'Train against any ball. No rewards, optional infinite HP.' },
  'pvp': { name: 'Online PvP', ico: '🌐', desc: 'Fight a real player online.', online: true },
};

class Battle {
  constructor(cfg) {
    this.cfg = cfg; this.mode = cfg.mode; this.difficulty = cfg.difficulty || 'normal';
    this.fighters = []; this.projs = []; this.beams = []; this.waves = []; this.zones = []; this.strikes = []; this.orbs = []; this.timers = []; this.pillars = [];
    this.portals = []; this.ghosts = []; this.lasers = []; this.darks = []; this.skynetT = 0;
    this.time = 0; this.paused = false; this.over = false; this.endTimer = -1; this.cinematic = null; this.timeTint = 0;
    this.pairCd = new Map(); this.ultsUsed = 0; this.wave = 1; this.kills = 0; this.infiniteHp = !!cfg.infiniteHp;
    this.speed = SAVE.settings.speed || 1; this.result = null;
    this.acc = 0; this.stepN = 0; this.actions = []; this.rec = []; this.replay = cfg.replay || null; this.ri = 0; this.lastSteer = null;
    FX.reset(); FX.off = !!cfg.headless; this.sidN = 0; BATTLE = this;
    this.seed = cfg.seed ?? ((Math.random() * 4294967296) >>> 0); seedRNG(this.seed);
    cfg.teams.forEach((team, ti) => team.forEach((spec, k) => this.spawn(spec, ti, k, team.length, cfg.teams.length)));
    this.pvp = !!cfg.pvp; this.limit = null; this.net = cfg.net || null;
    this.outOrder = [];       // teams in the order they were knocked out (for placements)
    if (this.pvp) {          // online: 2-5 human-controlled balls (plus AI seats), inputs tagged with each player's slot
      this.speed = 1;
      this.slots = this.fighters.filter(f => f.slot != null).sort((a, b) => a.slot - b.slot);
      for (const f of this.slots) { f.manual = false; f.inX = 0; f.inY = 0; f.inP = 0; }
      this.player = cfg.me != null ? this.slots[cfg.me] : null;
    } else {
      this.player = this.fighters.find(f => f.isPlayer) || null;
      if (this.player) { this.player.manual = !!cfg.manual && !cfg.demo; this.player.inX = 0; this.player.inY = 0; this.player.inP = 0; }
    }
    if (cfg.dummy) this.fighters.filter(f => f.team !== 0).forEach(f => { f.ai = null; f.skills = []; });
  }
  spawn(spec, ti, k, n, nTeams) {
    let x, y;
    if (nTeams === 2) { x = ti === 0 ? ARENA.x + 190 : ARENA.r - 190; y = ARENA.y + ARENA.h * (k + 1) / (n + 1); }
    else { const a = Math.PI + ti / nTeams * TAU; x = ARENA.cx + dcos(a) * ARENA.w * 0.36; y = ARENA.cy + dsin(a) * ARENA.h * 0.33; }
    if (spec.x != null) { x = spec.x; y = spec.y; }
    const toC = datan2(ARENA.cy - y, ARENA.cx - x) + rand(-0.7, 0.7);
    const f = new Fighter(spec.def, { ...spec, team: ti, x, y, angle: toC, rScale: spec.rScale || (nTeams > 2 || n > 1 ? 0.86 : 1) });
    if (!spec.isPlayer || spec.ai || this.cfg.demo) f.ai = new AIController(f, spec.ai || spec.def.ai || 'intelligent', spec.diff || this.difficulty);
    if (spec.isPlayer) { f.ai = new AIController(f, spec.def.ai === 'boss' ? 'intelligent' : (spec.def.ai || 'intelligent'), spec.playerDiff || 'hard'); }
    if (spec.hp != null) f.hp = Math.min(f.maxHp, spec.hp);
    if (spec.pvp) f.slot = spec.slot;
    if (spec.tag) f.tag = String(spec.tag).slice(0, 20);
    this.fighters.push(f);
    FX.ring(x, y, TEAM_COLS[ti % 6], 120, 0.6, 6, f.r); FX.burst(x, y, spec.def.design.c3, 20, 260);
    return f;
  }
  /* player actions are queued and applied at the start of the next fixed step, and recorded for replay */
  queue(type, a = 0) {
    if (this.net) { if (!this.over && this.player) this.net.local(type, a); return; }   // online: sent to the server, applied when confirmed
    if (!this.replay && !this.over && this.player) this.actions.push([type, a]);
  }
  applyAction(a, pl = this.player) {
    if (!pl) return;
    switch (a[0]) {
      case 'k': { const sk = pl.allSkills()[a[1]]; if (sk) useSkill(pl, sk); break; }
      case 'u': useUltimate(pl); break;
      case 'm': pl.manual = !!a[1]; if (!pl.manual) pl.inP = 0; break;
      case 's': pl.inX = a[1] / 100; pl.inY = a[2] / 100; pl.inP = a[3]; break;
      case 'x': if (typeof supremeCommand === 'function') supremeCommand(pl, a.slice(1)); break;   // ADMIN DELETE console (validated inside the engine)
    }
  }
  pumpInputs() {
    if (this.replay) {
      // PvP inputs are [step, slot, type, ...args]; single-player inputs are [step, type, ...args]
      while (this.ri < this.replay.length && this.replay[this.ri][0] === this.stepN) { const r = this.replay[this.ri++]; if (this.pvp) this.applyAction(r.slice(2), this.slots[r[1]]); else this.applyAction(r.slice(1)); }
      if (this.net) this.net.sample(this);
      return;
    }
    for (const a of this.actions) { this.rec.push([this.stepN, ...a]); this.applyAction(a); }
    this.actions.length = 0;
    const pl = this.player;
    if (pl && pl.manual && pl.alive && !this.result) {
      const st = Input.read(pl), key = st.join(',');
      if (key !== this.lastSteer) { this.lastSteer = key; const a = ['s', ...st]; this.rec.push([this.stepN, ...a]); this.applyAction(a); }
    }
  }
  togglePause(v) { if (this.over) return; if (this.pvp) { if (v === undefined) UI.pvpMenu?.(); return; } this.paused = v ?? !this.paused; UI.pauseMenu(this.paused); }
  teamsAlive() { const s = new Set(); for (const f of this.fighters) if (f.alive && !f.isClone) s.add(f.team); return s; }
  onDamage(src, tgt, amt) { if (src?.isPlayer) SAVE.stats.dmg += amt; }
  onDeath(f, killer) {
    if (f.isClone) return;
    if (!this.outOrder.includes(f.team) && !this.fighters.some(x => x.alive && !x.isClone && x.team === f.team)) this.outOrder.push(f.team);
    if (killer && killer.team === 0 && f.team !== 0) { this.kills++; if (this.player) SAVE.stats.kills++; }
    this.cfg.onDeath?.(this, f, killer);
  }
  update(realDt) {
    if (this.paused) return;
    FX.slowmo = Math.max(0, FX.slowmo - realDt);
    let scale = FX.slowmo > 0 ? 0.3 : 1;
    if (this.cinematic) {
      const c = this.cinematic; scale = 0.05;
      if (Math.random() < 0.9) { const a = vr(TAU), d = vr(150, 320); FX.p(c.f.x + dcos(a) * d, c.f.y + dsin(a) * d, -dcos(a) * d * 2.2, -dsin(a) * d * 2.2, 0.4, vr(3, 6), Math.random() < 0.5 ? '#ffd54f' : c.f.def.design.c3, 'dot', 0); }
    }
    if (this.clash) scale = Math.min(scale, 0.4);             // GOD CLASH: slow motion (visual only, the simulation is unchanged)
    this.acc += Math.min(0.05, realDt) * this.speed * scale;
    let n = 0;
    if (this.limit != null) {   // online lockstep: never simulate past the last step both players have confirmed
      const behind = this.limit - this.stepN - this.acc / STEP;
      if (behind > 96) this.acc += Math.min(0.05, realDt) * 0.5 * scale;   // catch up gently after a hiccup
      if (this.net) this.net.tick(this);
    }
    while (this.acc >= STEP && n < 48 && (this.limit == null || this.stepN < this.limit)) { this.step(STEP); this.acc -= STEP; n++; if (this.net) this.net.tick(this); }
    if (n >= 48 || (this.limit != null && this.stepN >= this.limit)) this.acc = Math.min(this.acc, STEP);
    FX.update(realDt * Math.max(this.cinematic ? 0.6 : scale, 0.3) * Math.min(2, this.speed));
    if (this.endTimer >= 0) { this.endTimer -= realDt; if (this.endTimer < 0) this.finish(); }
  }
  step(h) {
    this.time += h; this.stepN++;
    this.pumpInputs();
    if (this.cinematic) {        // God Mode transformation runs in simulation time (deterministic)
      const c = this.cinematic; c.t += h / 0.05;
      if (c.t >= c.dur) { this.cinematic = null; if (c.f.alive) { if (c.form != null) finishForm(c.f, c.form); else finishGodMode(c.f); c.then(); } }
    }
    const sdT = { boss: 150, survival: 0, endless: 0, practice: 0 }[this.mode] ?? 90;
    if (sdT && this.time > sdT) {
      if (!this.suddenDeath) { this.suddenDeath = true; FX.text(ARENA.cx, ARENA.cy - 40, 'SUDDEN DEATH!', '#ff3355', 54, { life: 2, vy: 0, pop: 2 }); FX.text(ARENA.cx, ARENA.cy + 14, 'damage rises • healing halved', '#ffb3c0', 20, { life: 2, vy: 0 }); FX.addShake(8); Sound.play('rage'); }
      this.dmgMul = 1 + (this.time - sdT) / 25;
    }
    if (this.timeTint > 0) this.timeTint -= h;
    if (this.timers.length) { const due = []; this.timers = this.timers.filter(t => (t.t -= h) > 0 || (due.push(t), false)); due.forEach(t => { const pv = CUR_ULT; CUR_ULT = !!t.u; try { t.fn(); } finally { CUR_ULT = pv; } }); }
    const F = this.fighters;
    for (const f of F) {
      if (!f.alive) continue;
      tickFighter(f, h);
      if (f.alive && f.st.outside > 0) { f.st.outside -= h; if (f.st.outside > 0) continue; f.st.outside = 0; emergeFromPortal(f); }   // travelling through a portal
      if (!f.alive || f.st.timestop > 0) continue;
      if (f.manual) { f.steerX = f.inX; f.steerY = f.inY; f.steerPow = f.inP; } else if (f.ai) f.ai.update(h);
      if ((this.cond || f.sx) && typeof supSteer === 'function') supSteer(f);
      if (f.anchored || f.tether) { if (f.anchored) f.vx = f.vy = 0; continue; }   // turrets / factories stand still, drones fly with their commander
      if (f.steerPow > 0 && f.st.stun <= 0) { f.vx += f.steerX * f.steerPow * h; f.vy += f.steerY * f.steerPow * h; }
      const target = f.baseSpeed * f.speedMul() * (f.casting > 0 ? 0.25 : 1) * (f.st.stun > 0 ? 0.6 : 1);
      let sp = len(f.vx, f.vy);
      if (sp < 1) { const a = rand(TAU); f.vx = dcos(a); f.vy = dsin(a); sp = 1; }
      const ns = sp + (target - sp) * (1 - dexp(-h * (sp > target ? 2.2 : 3.2)));
      f.vx *= ns / sp; f.vy *= ns / sp;
      // anti axis-lock: never bounce perfectly horizontal/vertical forever
      if (Math.abs(f.vx) < ns * 0.1 || Math.abs(f.vy) < ns * 0.1) { f.straightT += h; if (f.straightT > 2) { const a = datan2(f.vy, f.vx) + (RNG() < 0.5 ? 0.5 : -0.5); f.vx = dcos(a) * ns; f.vy = dsin(a) * ns; f.straightT = 0; } } else f.straightT = 0;
      f.x += f.vx * h; f.y += f.vy * h;
      f.rot += (Math.abs(f.vx) + Math.abs(f.vy)) * h / f.r * 0.45 * (f.vx >= 0 ? 1 : -1);
      this.walls(f);
    }
    // ball vs ball collisions
    for (let i = 0; i < F.length; i++) {
      const a = F[i]; if (!a.alive) continue;
      for (let j = i + 1; j < F.length; j++) { const b = F[j]; if (b.alive) this.collide(a, b); }
    }
    this.updateProjs(h); this.updateBeams(h); this.updateWaves(h); this.updateZones(h); this.updateStrikes(h); this.updateOrbs(h); this.updateLasers(h);
    if (typeof supremeStep === 'function') supremeStep(this, h);
    for (let i = this.pillars.length - 1; i >= 0; i--) if ((this.pillars[i].life -= h) <= 0) this.pillars.splice(i, 1);
    for (let i = this.portals.length - 1; i >= 0; i--) if ((this.portals[i].t += h) >= this.portals[i].life) this.portals.splice(i, 1);
    if (F.some(f => !f.alive && (f.isClone || (f.team !== 0 && f.deathT++ > 600 && (this.mode === 'survival' || this.mode === 'endless')))))
      this.fighters = F.filter(f => f.alive || (!f.isClone && (f.team === 0 || f.deathT <= 600 || (this.mode !== 'survival' && this.mode !== 'endless'))));
    this.checkEnd();
  }
  walls(f) {
    let hit = false;
    if (f.x - f.r < ARENA.x) { f.x = ARENA.x + f.r; if (f.vx < 0) { f.vx = -f.vx; hit = 'l'; } }
    else if (f.x + f.r > ARENA.r) { f.x = ARENA.r - f.r; if (f.vx > 0) { f.vx = -f.vx; hit = 'r'; } }
    if (f.y - f.r < ARENA.y) { f.y = ARENA.y + f.r; if (f.vy < 0) { f.vy = -f.vy; hit = 't'; } }
    else if (f.y + f.r > ARENA.b) { f.y = ARENA.b - f.r; if (f.vy > 0) { f.vy = -f.vy; hit = 'b'; } }
    if (hit) {
      const wx = hit === 'l' ? ARENA.x : hit === 'r' ? ARENA.r : f.x, wy = hit === 't' ? ARENA.y : hit === 'b' ? ARENA.b : f.y;
      Arena.wallHit(wx, wy, f.def.design.c3); if (f.baseDef && typeof supBounce === 'function') supBounce(f, wx, wy);
      if (!this.cfg.demo) Sound.play('bounce', clamp(len(f.vx, f.vy) / 600, 0, 1));
      if (f.st.dash > 0) FX.sparks(wx, wy, f.def.design.c3, 6, 300);
    }
  }
  collide(a, b) {
    if (a.st.outside > 0 || b.st.outside > 0 || a.noCollide || b.noCollide || (a.anchored && b.anchored)) return;
    const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d, overlap = rr - d;
    let ima = a.anchored || a.st.timestop > 0 ? 0 : 1 / a.mass, imb = b.anchored || b.st.timestop > 0 ? 0 : 1 / b.mass;
    if (!ima && !imb) { ima = a.anchored ? 0 : 1; imb = b.anchored ? 0 : 1; }
    const tot = ima + imb;
    a.x -= nx * overlap * ima / tot; a.y -= ny * overlap * ima / tot; b.x += nx * overlap * imb / tot; b.y += ny * overlap * imb / tot;
    this.walls(a); this.walls(b);
    const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rel <= 0) return;
    const appA = Math.max(0, a.vx * nx + a.vy * ny), appB = Math.max(0, -(b.vx * nx + b.vy * ny));
    const j = 2 * rel / tot;
    a.vx -= j * ima * nx; a.vy -= j * ima * ny; b.vx += j * imb * nx; b.vy += j * imb * ny;
    const cx = a.x + nx * a.r, cy = a.y + ny * a.r;
    if (a.team === b.team) { if (!this.cfg.demo) Sound.play('bounce', 0.3); return; }
    const key = a.uid < b.uid ? a.uid * 100000 + b.uid : b.uid * 100000 + a.uid;
    if ((this.pairCd.get(key) || 0) > this.time) return;
    this.pairCd.set(key, this.time + 0.28);
    const cd = (f, app) => f.effAtk() * 0.075 * (0.5 + app / 420) * (f.st.dash > 0 ? 1.8 : 1) * (f.isClone ? 0.7 : 1) * (f.st.timestop > 0 ? 0 : 1);
    const dA = cd(a, appA), dB = cd(b, appB);
    if (dA > 0) dealDamage(a, b, dA, { kind: 'collision', effect: a.st.dash > 0 ? a.dashEffect : null, power: a.dashPow });
    if (dB > 0) dealDamage(b, a, dB, { kind: 'collision', effect: b.st.dash > 0 ? b.dashEffect : null, power: b.dashPow });
    const sum = dA + dB || 1, kb = 150;
    if (imb) { b.vx += nx * kb * dA / sum; b.vy += ny * kb * dA / sum; }
    if (ima) { a.vx -= nx * kb * dB / sum; a.vy -= ny * kb * dB / sum; }
    if (a.st.dash > 0) a.st.dash = Math.min(a.st.dash, 0.08); if (b.st.dash > 0) b.st.dash = Math.min(b.st.dash, 0.08);
    if ((a.sx || b.sx) && typeof supCollide === 'function') { supCollide(a, b); supCollide(b, a); if (SUP.onCollideDash) { SUP.onCollideDash(a, b); SUP.onCollideDash(b, a); } }
    const strong = Math.max(appA, appB) / 500;
    FX.sparks(cx, cy, '#ffffff', 6 + Math.round(strong * 8), 380 + strong * 200);
    for (const f of [a, b]) if (f.cos && f.cos.hit) { FX.sparks(cx, cy, f.cos.hit.color, 12, 520); FX.ring(cx, cy, f.cos.hit.color, 70, 0.3, 5, 8); }
    FX.burst(cx, cy, dA > dB ? a.def.design.c3 : b.def.design.c3, 10, 260, 5, 0.4);
    FX.ring(cx, cy, '#ffffff', 50 + strong * 40, 0.22, 4, 8);
    FX.addShake(2 + strong * 4); Sound.play('hit', clamp(strong, 0, 1));
  }
  enemiesOf(team) { return this.fighters.filter(f => f.alive && f.team !== team); }
  updateProjs(h) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i]; p.life -= h;
      if (p.frozen > 0) { p.frozen -= h; p.life += h; continue; }   // Time Freeze
      if (p.tick) p.tick(p, h);
      if (p.homing) {
        if (!p.target || !p.target.alive) { let bd = Infinity; for (const e of this.enemiesOf(p.team)) { const dd = dist2(e.x, e.y, p.x, p.y); if (dd < bd) { bd = dd; p.target = e; } } }
        if (p.target && p.target.alive) { const want = datan2(p.target.y - p.y, p.target.x - p.x); let cur = datan2(p.vy, p.vx); const da = ((want - cur + Math.PI * 3) % TAU) - Math.PI; cur += clamp(da, -p.homing * h, p.homing * h); p.vx = dcos(cur) * p.speed; p.vy = dsin(cur) * p.speed; }
      }
      p.x += p.vx * h; p.y += p.vy * h;
      if (!p.nulled && this.zones.length) for (const z of this.zones) if (z.kind === 'nullzone' && z.team !== p.team && dist2(z.x, z.y, p.x, p.y) < z.r * z.r) { p.nulled = true; p.dmg *= 0.6; p.speed *= 0.65; p.vx *= 0.65; p.vy *= 0.65; if (!FX.off) FX.ring(p.x, p.y, '#7c4dff', 30, 0.3, 3, 4); break; }
      if (Math.random() < 0.35) FX.p(p.x, p.y, -p.vx * 0.05 + vr(-20, 20), -p.vy * 0.05 + vr(-20, 20), 0.28, p.r * 0.75, p.col);
      if (p.bounce > 0 && p.life > 0) { let b = false;
        if (p.x < ARENA.x + p.r || p.x > ARENA.r - p.r) { p.vx = -p.vx; p.x = clamp(p.x, ARENA.x + p.r, ARENA.r - p.r); b = true; }
        if (p.y < ARENA.y + p.r || p.y > ARENA.b - p.r) { p.vy = -p.vy; p.y = clamp(p.y, ARENA.y + p.r, ARENA.b - p.r); b = true; }
        if (b) { p.bounce--; if (p.hits) p.hits.clear(); if (!FX.off) FX.sparks(p.x, p.y, p.col, 5, 260); } }
      if (p.life <= 0 || p.x < ARENA.x + p.r * 0.5 || p.x > ARENA.r - p.r * 0.5 || p.y < ARENA.y + p.r * 0.5 || p.y > ARENA.b - p.r * 0.5) {
        FX.burst(p.x, p.y, p.col, 8, 170, 4, 0.35); if (p.life > 0) Arena.wallHit(clamp(p.x, ARENA.x, ARENA.r), clamp(p.y, ARENA.y, ARENA.b), p.col);
        if (p.onEnd) p.onEnd(p);
        this.projs.splice(i, 1); continue;
      }
      for (const e of this.fighters) {
        if (!e.alive || e.team === p.team || e.st.phase > 0 || e.st.outside > 0) continue;
        if (p.hits && p.hits.has(e.sid)) continue;
        if (dist2(e.x, e.y, p.x, p.y) < (e.r + p.r) * (e.r + p.r)) {
          const energy = !p.ult && p.style !== 'missile';   // only energy shots: never ultimates, never physical missiles
          if (e.st.absorb > 0 && e.absorbLeft > 0 && energy) { absorbShot(e, p); this.projs.splice(i, 1); break; }            // Power Absorb
          if (e.st.reverse > 0 && e.reverseLeft > 0 && !p.reflected && energy) { reverseShot(e, p); break; }               // Reverse Impact
          if (e.st.reflect > 0 && !p.reflected) {   // mirror: send it back
            p.reflected = true; p.team = e.team; p.owner = e; p.vx = -p.vx; p.vy = -p.vy; p.target = null; p.life = Math.max(p.life, 1.2);
            FX.ring(p.x, p.y, '#ffffff', 50, 0.25, 4); FX.sparks(p.x, p.y, '#e0f7fa', 8, 380); Sound.play('shield'); break;
          }
          dealDamage(p.owner, e, p.dmg, { kind: 'skill', tag: 'projectile', effect: p.effect, power: p.power });
          if (p.boom) explodeAt(p.owner, p.x, p.y, p.boom, p.dmg * 0.35, p.col, null, 240, p.power);   // missiles explode
          const k = e.boss ? 0.08 : 0.25; e.vx += p.vx * k; e.vy += p.vy * k;
          FX.burst(p.x, p.y, p.col, 14, 260, 5, 0.45); FX.sparks(p.x, p.y, '#ffffff', 6, 360); FX.ring(p.x, p.y, p.col, 46, 0.25, 4);
          Sound.play('hit', 0.6);
          if (p.onHit) p.onHit(p, e);
          if (p.pierce > 0) { p.pierce--; (p.hits || (p.hits = new Set())).add(e.sid); continue; }   // passes through
          this.projs.splice(i, 1); break;
        }
      }
    }
  }
  updateBeams(h) {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i], o = b.owner; b.t += h;
      if (!o.alive || b.t > b.charge + b.fire) { this.beams.splice(i, 1); continue; }
      if (b.mega && b.target && b.target.alive) { const want = angTo(o, b.target); const da = ((want - b.ang + Math.PI * 3) % TAU) - Math.PI; b.ang += clamp(da, -1.1 * h, 1.1 * h); }
      b.end = rayToWall(o.x, o.y, b.ang);
      if (b.t < b.charge) continue;
      let doHit = false;
      if (!b.mega) { if (!b.fired) { b.fired = true; doHit = true; FX.addShake(5); Sound.play('zap'); } }
      else { b.tick = (b.tick || 0) - h; if (b.tick <= 0) { b.tick = 0.12; doHit = true; FX.addShake(2); } }
      if (!doHit) continue;
      for (const e of this.fighters) {
        if (!e.alive || e.team === b.team) continue;
        if (e.st.phase > 0 || e.st.outside > 0) continue;
        if (segDist(e.x, e.y, o.x, o.y, b.end.x, b.end.y) < e.r + b.w / 2) {
          dealDamage(o, e, b.dmg * (e.st.reflect > 0 ? 0.5 : e.st.reverse > 0 ? 0.6 : 1), { kind: 'skill', tag: 'beam', effect: b.effect, power: b.power });
          const px = -dsin(b.ang), py = dcos(b.ang), sd = Math.sign((e.x - o.x) * px + (e.y - o.y) * py) || 1;
          e.vx += (dcos(b.ang) * 160 + px * sd * 120) * (e.boss ? 0.3 : 1); e.vy += (dsin(b.ang) * 160 + py * sd * 120) * (e.boss ? 0.3 : 1);
          FX.sparks(e.x, e.y, b.col, 10, 420); FX.burst(e.x, e.y, b.col, 10, 220, 5, 0.4);
        }
      }
      Arena.wallHit(b.end.x, b.end.y, b.col);
    }
  }
  updateWaves(h) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.r += w.speed * h;
      if (w.r > w.maxR) { this.waves.splice(i, 1); continue; }
      if (w.clearProj) for (let k = this.projs.length - 1; k >= 0; k--) { const p = this.projs[k]; if (p.team !== w.team && dist2(p.x, p.y, w.x, w.y) < w.r * w.r) { FX.burst(p.x, p.y, '#b388ff', 6, 160, 4, 0.3); this.projs.splice(k, 1); } }
      for (const e of this.fighters) {
        if (!e.alive || e.team === w.team || w.hit.has(e.uid) || e.st.outside > 0) continue;
        const d = len(e.x - w.x, e.y - w.y);
        if (Math.abs(d - w.r) < e.r + w.w / 2) { w.hit.add(e.uid); dealDamage(w.owner, e, w.dmg, { kind: 'skill', tag: 'wave', effect: w.effect, power: w.power }); knock(e, w.x, w.y, w.force); FX.sparks(e.x, e.y, w.col, 10, 400); if (w.onHit && e.alive) w.onHit(e); }
      }
    }
  }
  updateZones(h) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]; z.life -= h;
      if (z.follow) { if (!z.follow.alive) z.life = 0; else { z.x = z.follow.x; z.y = z.follow.y; } }
      if (z.life <= 0) {
        if (z.kind === 'blackhole') { explodeAt(z.owner, z.x, z.y, 280, z.endDmg, z.col, z.effect, 850, z.power); FX.addFlash(0.15, z.col); }
        else if (z.kind === 'minihole') { explodeAt(z.owner, z.x, z.y, 150, z.endDmg, z.col, 'slow', 420, z.power); darkBurst(z.x, z.y, 120, 0.5); }
        this.zones.splice(i, 1); continue;
      }
      for (const e of this.fighters) {
        if (!e.alive || e.team === z.team || e.st.outside > 0) continue;
        const dx = z.x - e.x, dy = z.y - e.y, d = len(dx, dy) || 1;
        if (z.custom) { if (z.onTick) z.onTick(z, e, d, h); continue; }
        if (z.kind === 'nullzone' || z.kind === 'cybertrap') { techZone(this, z, e, d, h); continue; }
        if (z.kind === 'trap') {
          if (d > z.r + e.r * 0.3) continue;
          e.st.slow = Math.max(e.st.slow, 0.3); const k = dexp(-1.6 * h); e.vx *= k; e.vy *= k;
        } else {
          if (d > z.r) continue;
          const a = z.pull * (0.35 + 0.65 * (1 - d / z.r)) * (e.boss ? 0.45 : 1);
          e.vx += dx / d * a * h; e.vy += dy / d * a * h;
        }
        const key = e.uid; if ((z.ticks.get(key) || 0) <= this.time) { z.ticks.set(key, this.time + (z.kind === 'trap' ? 0.5 : 0.4)); dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', effect: z.effect, power: z.power, noCrit: true }); }
      }
      if (!z.custom && z.kind !== 'trap' && z.kind !== 'nullzone' && z.kind !== 'cybertrap' && z.kind !== 'minihole' && Math.random() < 0.8) { const a = vr(TAU), rr = z.r * vr(0.6, 1); FX.p(z.x + dcos(a) * rr, z.y + dsin(a) * rr, -dcos(a) * rr * 1.6 - dsin(a) * 140, -dsin(a) * rr * 1.6 + dcos(a) * 140, 0.5, vr(2, 4), z.col, 'dot', 0.5); }
    }
  }
  updateStrikes(h) {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i]; s.t -= h;
      if (s.kind === 'meteor' && s.t < 0.35 && Math.random() < 0.8) { const k = s.t / 0.35; FX.p(s.x - 260 * k, s.y - 420 * k, 0, 0, 0.25, 9, s.col); }
      if (s.t > 0) continue;
      this.strikes.splice(i, 1);
      if (s.kind === 'lightning') { FX.bolt(s.x + vr(-40, 40), ARENA.y, s.x, s.y, s.col, 7); FX.bolt(s.x, ARENA.y, s.x + vr(-30, 30), s.y, '#ffffff', 3); Sound.play('zap'); }
      if (s.kind === 'meteor') { FX.burst(s.x, s.y, '#ff9100', 24, 360, 7, 0.6); FX.burst(s.x, s.y, s.col, 16, 260, 6, 0.6, 'shard'); Sound.play('boom'); }
      if (s.kind === 'titan') { FX.burst(s.x, s.y, '#40c4ff', 40, 520, 8, 0.8, 'shard'); FX.ring(s.x, s.y, '#ffffff', 260, 0.5, 10, 20); Sound.play('boom'); }
      if (s.kind === 'pillar') { this.pillars.push({ x: s.x, w: s.r * 1.3, col: s.col, life: 0.5, max: 0.5 }); Sound.play('beam'); }
      FX.ring(s.x, s.y, s.col, s.r * 1.5, 0.35, 8); FX.addShake(5);
      for (const e of this.fighters) {
        if (!e.alive || e.team === s.team || e.st.outside > 0) continue;
        const inPillar = s.kind === 'pillar' && Math.abs(e.x - s.x) < s.r * 0.65 + e.r;
        if (inPillar || len(e.x - s.x, e.y - s.y) < s.r + e.r) { dealDamage(s.owner, e, s.dmg, { kind: 'skill', tag: 'strike', effect: s.effect, power: s.power }); knock(e, s.x, s.y, s.kind === 'titan' ? 650 : 300); }
      }
    }
  }
  updateOrbs(h) {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i], f = o.owner; o.life -= h; o.ang += 4.2 * h;
      if (o.life <= 0 || !f.alive) { this.orbs.splice(i, 1); continue; }
      for (let k = 0; k < o.n; k++) {
        const a = o.ang + k / o.n * TAU, ox = f.x + dcos(a) * o.rad, oy = f.y + dsin(a) * o.rad;
        for (const e of this.fighters) {
          if (!e.alive || e.team === o.team || e.st.outside > 0) continue;
          if (dist2(e.x, e.y, ox, oy) < (e.r + 11) * (e.r + 11)) {
            const key = e.uid * 10 + k;
            if ((o.hitCd.get(key) || 0) <= this.time) { o.hitCd.set(key, this.time + 0.45); dealDamage(f, e, o.dmg, { kind: 'skill', tag: 'orb', effect: o.effect, power: o.power }); FX.sparks(ox, oy, o.col, 6, 300); }
          }
        }
      }
    }
  }
  checkEnd() {
    if (this.over || this.endTimer >= 0) return;
    this.cfg.checkEnd ? this.cfg.checkEnd(this) : this.defaultEnd();
  }
  defaultEnd() {
    const alive = this.teamsAlive();
    if (alive.size <= 1) this.endWith(alive.has(0), this.pvp ? { winner: alive.size === 1 ? [...alive][0] : -1 } : {});
  }
  endWith(win, extra = {}) {
    if (this.endTimer >= 0 || this.over) return;
    if (typeof supremeVictory === 'function') for (const f of this.fighters) if (f.alive && f.baseDef && !f.isClone) supremeVictory(f);
    const pl = this.player;
    this.result = { win, mode: this.mode, time: this.time, kills: this.kills, wave: this.wave, step: this.stepN, hpPct: pl ? Math.max(0, pl.hp) / pl.maxHp : 0, stats: pl ? { ...pl.stats } : {}, rage: !!(pl && pl.rageEver), god: !!(pl && pl.godUsed), ...extra };
    if (this.adminLog) this.result.adminCmds = this.adminLog;
    if (this.pvp) {
      this.result.slots = this.slots.map(f => ({ team: f.team, hpPct: Math.max(0, f.hp) / f.maxHp, stats: { ...f.stats }, rage: !!f.rageEver, god: !!f.godUsed }));
      this.result.places = this.placesOf(this.result.winner);
      if (this.player) this.result.win = this.result.winner === this.player.team;
    }
    this.endTimer = 1.8;
  }
  /* 1st = the winner (or every team still standing on a draw), then teams in reverse knock-out order */
  placesOf(winner) {
    const n = this.cfg.teams.length, pl = new Array(n).fill(1), standing = [...Array(n).keys()].filter(t => !this.outOrder.includes(t));
    let next = standing.length + 1;
    for (const t of this.outOrder.slice().reverse()) pl[t] = next++;
    if (winner >= 0) pl[winner] = 1;
    return pl;
  }
  finish() {
    if (this.over) return;
    this.over = true;
    const r = this.result || { win: false };
    r.player = this.player; r.stats = this.player ? { ...this.player.stats } : {}; r.ults = this.ultsUsed;
    this.cfg.onEnd?.(r, this);
  }
}

/* ---------- Anti Ball & Tech Balls: lasers (battle logic) ---------- */
Battle.prototype.updateLasers = function (h) {
  for (let i = this.lasers.length - 1; i >= 0; i--) {
    const L = this.lasers[i]; L.t += h;
    if (!L.owner.alive || L.t > L.charge + L.dur) { this.lasers.splice(i, 1); continue; }
    if (L.sweep) { const S = L.sweep, a = S.a0 + S.av * L.t; L.x0 = S.cx - dcos(a) * S.len; L.y0 = S.cy - dsin(a) * S.len; L.x1 = S.cx + dcos(a) * S.len; L.y1 = S.cy + dsin(a) * S.len; }
    if (L.t < L.charge) continue;
    for (const e of this.fighters) {
      if (!e.alive || e.team === L.team || e.st.outside > 0 || e.st.phase > 0) continue;
      if (segDist(e.x, e.y, L.x0, L.y0, L.x1, L.y1) < e.r + L.w / 2 && (L.ticks.get(e.uid) || 0) <= this.time) {
        L.ticks.set(e.uid, this.time + 0.45);
        dealDamage(L.owner, e, L.dmg, { kind: 'skill', tag: 'laser', power: 60, noCrit: true });
        if (!FX.off) { FX.sparks(e.x, e.y, L.col, 8, 380); Sound.play('zap'); }
      }
    }
  }
};
/* Null Zone and Cyber Trap: what they do to an enemy inside / near them */
function techZone(B, z, e, d, h) {
  if (z.kind === 'nullzone') { if (d <= z.r + e.r * 0.5) e.st.nulled = Math.max(e.st.nulled, 0.3); return; }
  if (z.max - z.life < z.arm || z.charges <= 0) return;      // cyber trap: arms first
  if (d <= z.r + e.r) { e.st.slow = Math.max(e.st.slow, 0.4); const k = dexp(-1.4 * h); e.vx *= k; e.vy *= k; }
  if (d <= z.detect + e.r && (z.ticks.get(e.uid) || 0) <= B.time) {
    z.ticks.set(e.uid, B.time + 1.1); z.charges--;
    e.st.slow = Math.max(e.st.slow, 2.4); e.vx *= 0.45; e.vy *= 0.45;
    dealDamage(z.owner, e, z.dmg, { kind: 'skill', tag: 'zone', power: z.power, noCrit: true });
    z.zapT = 0.3;
    if (!FX.off) { FX.bolt(z.x, z.y, e.x, e.y, z.col, 4, 0.3); FX.text(e.x, e.y - e.r - 20, 'TRAPPED', z.col, 14, { life: 0.7 }); Sound.play('zap'); }
    if (z.charges <= 0) z.life = Math.min(z.life, 0.45);
  }
}

/* ---------- Anti Ball & Tech Balls rendering (visual only) ---------- */
function _metalBall(ctx, r, base, rim) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, mixColor(base, '#ffffff', 0.55)); g.addColorStop(0.55, base); g.addColorStop(1, shade(base, -0.55));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1.2, r * 0.07); ctx.stroke();
}
function _motes(ctx, r, col, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const a = t * (0.35 + (i % 3) * 0.12) * (i % 2 ? 1 : -1) + i * 2.4, rr = r * (1.18 + ((i * 0.37) % 0.5)) + Math.sin(t * 2 + i) * r * 0.06;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.92, s = r * (0.05 + (i % 3) * 0.02) * (0.7 + 0.3 * Math.sin(t * 5 + i * 1.7));
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3 + i); ctx.drawImage(glowSprite(i % 3 ? col : '#ffffff'), x - s * 3, y - s * 3, s * 6, s * 6);
  }
  ctx.restore();
}
function _antenna(ctx, r, col, t) {
  ctx.save(); ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const bx = s * r * 0.45, by = -r * 0.85, tx = s * r * 0.72, ty = -r * 1.32, on = Math.sin(t * 6 + s) > 0;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = r * (on ? 0.32 : 0.18); ctx.drawImage(glowSprite(col), tx - g, ty - g, g * 2, g * 2); ctx.restore();
    ctx.fillStyle = on ? '#ffffff' : col; ctx.beginPath(); ctx.arc(tx, ty, r * 0.07, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function _holoRing(ctx, r, c2, c3, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.save(); ctx.rotate(-0.25); ctx.strokeStyle = rgba(c3, 0.55); ctx.lineWidth = Math.max(1, r * 0.035); ctx.setLineDash([r * 0.22, r * 0.1]); ctx.lineDashOffset = -t * r * 1.2;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * 0.38, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  for (let i = 0; i < 6; i++) { const a = t * 0.9 + i / 6 * TAU; ctx.fillStyle = rgba(i % 2 ? c2 : c3, 0.8); ctx.fillRect(Math.cos(a) * r * 1.5 - r * 0.05, Math.sin(a) * r * 0.38 - r * 0.05, r * 0.1, r * 0.1); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, TAU); ctx.clip();                 // holographic scan line across the sphere
  const y = ((t * 0.7) % 1) * 2.2 * r - 1.1 * r, g = ctx.createLinearGradient(0, y - r * 0.12, 0, y + r * 0.12);
  g.addColorStop(0, rgba(c2, 0)); g.addColorStop(0.5, rgba(c2, 0.45)); g.addColorStop(1, rgba(c2, 0)); ctx.fillStyle = g; ctx.fillRect(-r, y - r * 0.12, 2 * r, r * 0.24);
  ctx.restore();
}
/* robots, the Titan, turrets, the factory and drones: spherical machines */
function drawUnit(ctx, f, r) {
  const k = f.unit, d = f.def.design, t = f.t, o = f.owner, step = 1 / 60;
  const build = f.buildMax > 0 ? clamp(1 - f.buildT / f.buildMax, 0, 1) : 1;
  const face = f.target && f.target.alive ? Math.atan2(f.target.y - f.y, f.target.x - f.x) : Math.atan2(f.vy || 0.01, f.vx || 0.01);
  if (f.tether && o && o.alive) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(d.c3, f.beamT > 0 ? 0.9 : 0.35); ctx.lineWidth = f.beamT > 0 ? 4 : 1.5; ctx.setLineDash(f.beamT > 0 ? [] : [4, 6]);
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.restore();
  }
  if (f.beamT > 0) f.beamT -= step; if (f.flashT > 0) f.flashT -= step; if (f.slamT > 0) f.slamT -= step; if (f.punchT > 0) f.punchT -= step;
  ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = 0.35 + 0.65 * build;
  if (build < 1) for (let i = 0; i < 6; i++) {        // assembly: armour plates fly in and lock together
    const a = i / 6 * TAU + t * 5, dd = r * 2.4 * (1 - build); ctx.save(); ctx.translate(Math.cos(a) * dd, Math.sin(a) * dd); ctx.rotate(a + t * 6);
    ctx.fillStyle = i % 2 ? d.c2 : '#b0bec5'; ctx.fillRect(-r * 0.3, -r * 0.2, r * 0.6, r * 0.4); ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gs = r * (k === 'titan' ? 2.6 : 2.2); ctx.drawImage(glowSprite(d.c3), -gs, -gs, gs * 2, gs * 2); ctx.restore();
  if (build < 1) ctx.scale(0.5 + 0.5 * build, 0.5 + 0.5 * build);
  if (k === 'robot' || k === 'megabot' || k === 'titan') {
    if (k !== 'robot') for (const s of [-1, 1]) {           // fists (Mega Robot) / shoulder cannons (Titan)
      const a = face + s * (k === 'titan' ? 1.9 : 1.25), ext = r * 1.12 + (f.punchT > 0 && s > 0 ? r * 0.4 : 0);
      ctx.save(); ctx.translate(Math.cos(a) * ext, Math.sin(a) * ext); _metalBall(ctx, r * (k === 'titan' ? 0.36 : 0.34), '#607d8b', d.c2);
      if (k === 'titan') { ctx.rotate(face); ctx.fillStyle = '#263238'; ctx.fillRect(0, -r * 0.08, r * 0.45, r * 0.16); }
      ctx.restore();
    }
    _metalBall(ctx, r, k === 'robot' ? '#78909c' : '#546e7a', d.c2);
    ctx.strokeStyle = 'rgba(10,20,30,.7)'; ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.save(); ctx.rotate(face); ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.ellipse(r * 0.38, 0, r * 0.34, r * 0.5, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; const eye = f.slamT > 0 || f.punchT > 0 ? '#ff5252' : d.c3, es = r * 0.55;
    ctx.drawImage(glowSprite(eye), r * 0.45 - es, -es, es * 2, es * 2); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(r * 0.45, 0, r * 0.1, 0, TAU); ctx.fill(); ctx.restore();
    if (k === 'titan') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const cs = r * (0.5 + 0.08 * Math.sin(t * 6)); ctx.drawImage(glowSprite('#00e5ff'), -cs, -cs, cs * 2, cs * 2); ctx.restore();
      ctx.strokeStyle = rgba('#00e5ff', 0.8); ctx.lineWidth = r * 0.04; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * 0.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.86, a, a + 0.45); ctx.stroke(); }
    }
    if (k === 'robot') { ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, -r * 1.4); ctx.stroke(); ctx.fillStyle = Math.sin(t * 8) > 0 ? d.c3 : '#ffffff'; ctx.beginPath(); ctx.arc(0, -r * 1.45, r * 0.14, 0, TAU); ctx.fill(); }
  } else if (k === 'turret') {
    ctx.fillStyle = '#14141c'; ctx.strokeStyle = d.c2; ctx.lineWidth = r * 0.08; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(f.aim ?? face); ctx.fillStyle = '#37373f'; ctx.fillRect(r * 0.1, -r * 0.17, r * 1.25, r * 0.34); ctx.fillStyle = d.c3; ctx.fillRect(r * 1.15, -r * 0.2, r * 0.2, r * 0.4);
    if (f.flashT > 0) { ctx.globalCompositeOperation = 'lighter'; const s = r * 0.8; ctx.drawImage(glowSprite('#ff8a80'), r * 1.4 - s, -s, s * 2, s * 2); }
    ctx.restore();
    _metalBall(ctx, r * 0.62, '#2a2a35', d.c2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const es = r * 0.4; ctx.drawImage(glowSprite(d.c3), -es, -es, es * 2, es * 2); ctx.restore();
  } else if (k === 'factory') {
    ctx.fillStyle = '#263238'; ctx.strokeStyle = d.c2; ctx.lineWidth = r * 0.07; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); } ctx.closePath(); ctx.fill(); ctx.stroke();
    _metalBall(ctx, r * 0.72, '#455a64', '#90a4ae');
    ctx.save(); ctx.rotate(t * 2); ctx.strokeStyle = '#ffab00'; ctx.lineWidth = r * 0.12; ctx.setLineDash([r * 0.16, r * 0.12]); ctx.beginPath(); ctx.arc(0, 0, r * 0.48, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = d.c3; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.arc(0, 0, r * 1.3, -Math.PI / 2, -Math.PI / 2 + TAU * (f.buildP || 0)); ctx.stroke();
    if (Math.random() < 0.25) FX.p(f.x + vr(-r, r) * 0.4, f.y - r * 0.8, vr(-20, 20), -60, 0.6, vr(3, 6), '#90a4ae', 'smoke', 0.5);
  } else {   // drone / repair bot / combat drone
    _metalBall(ctx, r, k === 'repair' ? '#eceff1' : k === 'skydrone' ? '#1a0b1f' : '#546e7a', d.c2);
    ctx.strokeStyle = rgba(d.c3, 0.6); ctx.lineWidth = Math.max(1, r * 0.08);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = sx * r * 1.05, py = sy * r * 1.05; ctx.save(); ctx.translate(px, py); ctx.rotate(t * 40); ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke(); ctx.restore();
      ctx.fillStyle = rgba(d.c3, 0.15); ctx.beginPath(); ctx.arc(px, py, r * 0.5, 0, TAU); ctx.fill();
    }
    if (k === 'repair') { ctx.fillStyle = '#00e676'; ctx.fillRect(-r * 0.14, -r * 0.5, r * 0.28, r); ctx.fillRect(-r * 0.5, -r * 0.14, r, r * 0.28); }
    else { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const es = r * 0.7; ctx.drawImage(glowSprite(d.c3), -es, -es, es * 2, es * 2); ctx.restore(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, TAU); ctx.fill(); }
  }
  if (f.hitFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, f.hitFlash * 5)})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (k === 'skydrone' && f.target && f.target.alive) { ctx.save(); ctx.strokeStyle = 'rgba(255,23,68,.45)'; ctx.lineWidth = 1.2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 40; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.target.x, f.target.y); ctx.stroke(); ctx.restore(); }
  if (f.st.stun > 0 && Math.random() < 0.4) FX.sparks(f.x + vr(-r, r), f.y + vr(-r, r), '#40c4ff', 2, 200);
  if (!f.tether || k === 'drone') { const bw = Math.max(26, r * 1.7), y = f.y + r + 8; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(f.x - bw / 2, y, bw, 4); ctx.fillStyle = TEAM_COLS[f.team % 6]; ctx.fillRect(f.x - bw / 2, y, bw * clamp(f.hpRatio, 0, 1), 4); }
}
/* status visuals: absorb, reverse, overclock, null, anti-evolution, silence, overheat, hologram */
function drawTechStatus(ctx, f, r) {
  const s = f.st, t = f.t;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (s.absorb > 0) for (let i = 0; i < 3; i++) { const k = 1 - ((t * 1.6 + i / 3) % 1); ctx.strokeStyle = rgba('#ea80fc', 0.7 * (1 - k)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, r * (1.1 + k * 1.1), t * 4 + i, t * 4 + i + 4.4); ctx.stroke(); }
  if (s.reverse > 0) {
    ctx.strokeStyle = rgba('#e1bee7', 0.75); ctx.lineWidth = 4; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -t * 90; ctx.beginPath(); ctx.arc(f.x, f.y, r * 1.42, 0, TAU); ctx.stroke();
    ctx.lineDashOffset = t * 90; ctx.strokeStyle = rgba('#7c4dff', 0.7); ctx.beginPath(); ctx.arc(f.x, f.y, r * 1.6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (s.overclock > 0) { const gs = r * 2.6 * (1 + 0.08 * Math.sin(t * 20)); ctx.drawImage(glowSprite('#ff1744'), f.x - gs, f.y - gs, gs * 2, gs * 2); if (Math.random() < 0.6) FX.p(f.x + vr(-r, r) * 0.6, f.y + vr(-r, r) * 0.6, -f.vx * 0.3, -f.vy * 0.3, 0.25, vr(2, 4), '#ff5252', 'spark', 2); }
  if (s.nulled > 0) { ctx.strokeStyle = rgba('#7c4dff', 0.55); ctx.lineWidth = 2; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(f.x, f.y, r * (1.15 + i * 0.15) + Math.sin(t * 9 + i) * 3, t * 3 + i * 2, t * 3 + i * 2 + 2.6); ctx.stroke(); } }
  if (s.antievo > 0) { ctx.strokeStyle = rgba('#ea80fc', 0.7); ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + t; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * r * 1.5, f.y + Math.sin(a) * r * 1.5); ctx.lineTo(f.x + Math.cos(a) * r * 1.1, f.y + Math.sin(a) * r * 1.1); ctx.stroke(); } }
  if (f.energy > 4) { const gs = r * (1.2 + f.energy / 100); ctx.globalAlpha = 0.5; ctx.drawImage(glowSprite('#ea80fc'), f.x - gs, f.y - gs, gs * 2, gs * 2); ctx.globalAlpha = 1; }
  ctx.restore();
  if (s.silence > 0) {
    ctx.save(); ctx.font = `900 ${Math.round(r * 0.6)}px "Segoe UI Symbol", sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff5252'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 10); ctx.fillText('⊘', f.x, f.y - r - 12); ctx.restore();
    if (Math.random() < 0.25) FX.sparks(f.x + vr(-r, r), f.y + vr(-r, r), '#40c4ff', 1, 160);
  }
  if (s.overheat > 0 && Math.random() < 0.5) FX.p(f.x + vr(-r, r) * 0.6, f.y - r * 0.6, vr(-20, 20), -80, 0.7, vr(4, 8), '#cfd8dc', 'smoke', 0.8);
  if (f.holo) { ctx.save(); ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.clip(); ctx.fillStyle = 'rgba(224,64,251,.12)'; for (let y = f.y - r; y < f.y + r; y += 4) ctx.fillRect(f.x - r, y + ((t * 30) % 4), 2 * r, 1.4); ctx.restore(); }
}
function drawMissile(ctx, p) {
  const a = Math.atan2(p.vy, p.vx);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
  const fl = 10 + Math.random() * 6; ctx.drawImage(glowSprite('#ff9100'), -p.r * 2 - fl, -fl * 0.6, fl * 1.4, fl * 1.2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.6, p.r * 0.55, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = p.col; ctx.beginPath(); ctx.moveTo(p.r * 1.75, 0); ctx.lineTo(p.r * 0.9, -p.r * 0.5); ctx.lineTo(p.r * 0.9, p.r * 0.5); ctx.fill();
  ctx.fillStyle = '#607d8b'; ctx.beginPath(); ctx.moveTo(-p.r * 1.2, 0); ctx.lineTo(-p.r * 1.7, -p.r * 0.9); ctx.lineTo(-p.r * 0.8, 0); ctx.lineTo(-p.r * 1.7, p.r * 0.9); ctx.fill();
  ctx.restore();
  if (Math.random() < 0.7) FX.p(p.x - Math.cos(a) * p.r * 1.8, p.y - Math.sin(a) * p.r * 1.8, vr(-15, 15), vr(-15, 15), 0.5, vr(3, 5), '#9e9e9e', 'smoke', 1);
}
function drawWaveStyle(ctx, w) {
  if (w.style === 'emp') {
    ctx.strokeStyle = rgba('#40c4ff', 0.35); ctx.lineWidth = w.w * 2; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#e1f5fe'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, rr = w.r + (Math.random() - 0.5) * 16, x = w.x + Math.cos(a) * rr, y = w.y + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  } else if (w.style === 'anti') {
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(8,0,16,.75)'; ctx.lineWidth = w.w * 2.2; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = rgba(w.col, 0.9); ctx.lineWidth = w.w * 0.5; ctx.beginPath(); ctx.arc(w.x, w.y, w.r + w.w * 0.9, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w.x, w.y, Math.max(1, w.r - w.w * 0.9), 0, TAU); ctx.stroke();
  } else {
    ctx.strokeStyle = rgba(w.col, 0.35); ctx.lineWidth = w.w * 2; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = w.col; ctx.lineWidth = w.w * 0.6; ctx.setLineDash([18, 10]); ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawTechZone(ctx, z, t) {
  if (z.kind === 'nullzone') {
    const gr = ctx.createRadialGradient(0, 0, z.r * 0.1, 0, 0, z.r); gr.addColorStop(0, 'rgba(6,0,14,.55)'); gr.addColorStop(0.75, 'rgba(20,0,40,.35)'); gr.addColorStop(1, rgba(z.col, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) { ctx.strokeStyle = rgba(z.col, 0.35 + k * 0.12); ctx.lineWidth = 2.5; ctx.setLineDash([z.r * 0.18, z.r * 0.1]); ctx.lineDashOffset = (k % 2 ? 1 : -1) * t * 60; ctx.beginPath(); ctx.arc(0, 0, z.r * (0.55 + k * 0.22) + Math.sin(t * 5 + k) * 4, 0, TAU); ctx.stroke(); }
    ctx.setLineDash([]); ctx.strokeStyle = rgba('#ffffff', 0.22); ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - t * 0.8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * z.r * 0.95, Math.sin(a) * z.r * 0.95); ctx.lineTo(Math.cos(a + 0.4) * z.r * 0.35, Math.sin(a + 0.4) * z.r * 0.35); ctx.stroke(); }
    if (Math.random() < 0.7) { const a = vr(TAU), rr = z.r * vr(0.7, 1); FX.p(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, -Math.cos(a) * rr * 1.2, -Math.sin(a) * rr * 1.2, 0.6, vr(2, 4), z.col, 'dot', 0.5); }
  } else if (z.kind === 'minihole') {
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) { ctx.strokeStyle = rgba(z.col, 0.22 + k * 0.08); ctx.lineWidth = 3; ctx.beginPath(); const rr = z.r * (1 - ((t * 0.9 + k / 4) % 1)); ctx.arc(0, 0, Math.max(1, rr), t * 4 + k, t * 4 + k + 4); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; const core = 24 + 5 * Math.sin(t * 10);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, core, 0, TAU); ctx.fill();
    ctx.save(); ctx.rotate(-t * 3); ctx.scale(1, 0.42); ctx.strokeStyle = rgba('#ea80fc', 0.9); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, core * 1.8, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, core + 2, 0, TAU); ctx.stroke();
    if (Math.random() < 0.8) { const a = vr(TAU), rr = z.r * vr(0.5, 1); FX.p(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, -Math.cos(a) * rr * 2 - Math.sin(a) * 120, -Math.sin(a) * rr * 2 + Math.cos(a) * 120, 0.45, vr(2, 4), z.col, 'dot', 0.5); }
  } else {   // cyber trap: hex sensor, detection radius and a scanning sweep
    const armed = z.max - z.life >= z.arm;
    ctx.strokeStyle = rgba(z.col, armed ? 0.35 : 0.15); ctx.lineWidth = 1.5; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(0, 0, z.detect, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (armed && z.charges > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.rotate(t * 2.4); const g = ctx.createLinearGradient(0, 0, z.detect, 0); g.addColorStop(0, rgba(z.col, 0.35)); g.addColorStop(1, rgba(z.col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, z.detect, -0.35, 0.05); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = 'rgba(20,4,14,.85)'; ctx.strokeStyle = z.col; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; ctx.lineTo(Math.cos(a) * z.r * 0.55, Math.sin(a) * z.r * 0.55); } ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < z.charges ? z.col : 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc((i - 1) * 10, 0, 3.5, 0, TAU); ctx.fill(); }
    if (z.zapT > 0) { ctx.globalCompositeOperation = 'lighter'; const s = z.r * 1.4; ctx.drawImage(glowSprite(z.col), -s, -s, s * 2, s * 2); z.zapT -= 1 / 60; }
  }
}
function drawTitanDrop(ctx, s) {
  const k = 1 - s.t / s.max;
  ctx.save();
  ctx.strokeStyle = rgba('#40c4ff', 0.5 + k * 0.5); ctx.lineWidth = 3 + k * 3; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -k * 80; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.4})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * (0.3 + k * 0.6), s.r * (0.15 + k * 0.3), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba('#ffab00', 0.75 * (Math.floor(k * 12) % 2)); ctx.font = '900 20px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚠ TITAN INCOMING ⚠', s.x, s.y - s.r - 14);
  const y = s.y - (1 - k * k) * 700, r = BASE_R * 1.5 * (1.4 - 0.4 * k);
  ctx.save(); ctx.translate(s.x, y); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#00e5ff'), -r * 1.4, -r * 0.4, r * 2.8, r * 3.4); ctx.restore();
  ctx.save(); ctx.translate(s.x, y); _metalBall(ctx, r, '#37474f', '#2979ff'); ctx.globalCompositeOperation = 'lighter'; const cs = r * 0.6; ctx.drawImage(glowSprite('#00e5ff'), -cs, -cs, cs * 2, cs * 2); ctx.restore();
  ctx.restore();
}
function drawVoidRift(ctx, p, sc) {
  const r = p.r * sc;
  ctx.save(); ctx.translate(p.x, p.y);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4); gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(0.6, 'rgba(12,0,24,.85)'); gr.addColorStop(1, 'rgba(12,0,24,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(p.col, 0.9); ctx.lineWidth = 2;
  const rng = mulberry32(Math.floor(p.x * 7 + p.y * 13));
  for (let i = 0; i < 7; i++) { let a = i / 7 * TAU + rng(), x = 0, y = 0; ctx.beginPath(); ctx.moveTo(0, 0); for (let k = 0; k < 4; k++) { a += (rng() - 0.5) * 0.9; x += Math.cos(a) * r * 0.32; y += Math.sin(a) * r * 0.32; ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.restore();
}
Battle.prototype.drawLasers = function (ctx) {
  for (const L of this.lasers) {
    ctx.save(); ctx.lineCap = 'round';
    if (L.t < L.charge) {
      const k = L.t / L.charge; ctx.strokeStyle = rgba(L.col, 0.2 + k * 0.45); ctx.lineWidth = 1.5 + k * 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -L.t * 100;
      ctx.beginPath(); ctx.moveTo(L.x0, L.y0); ctx.lineTo(L.x1, L.y1); ctx.stroke(); ctx.setLineDash([]);
    } else {
      const ft = (L.t - L.charge) / L.dur, w = L.w * (1 + Math.sin(L.t * 50) * 0.1);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, (1 - ft) * 5);
      for (const [lw, col] of [[w * 2.6, rgba(L.col, 0.22)], [w, rgba(L.col, 0.9)], [w * 0.35, '#ffffff']]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(L.x0, L.y0); ctx.lineTo(L.x1, L.y1); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'lighter';
    const ends = L.sweep ? [[L.sweep.cx, L.sweep.cy]] : [[L.x0, L.y0], [L.x1, L.y1]];
    for (const [x, y] of ends) ctx.drawImage(glowSprite(L.col), x - 16, y - 16, 32, 32);
    ctx.restore();
  }
};
Battle.prototype.drawDarks = function (ctx, dt) {
  for (let i = this.darks.length - 1; i >= 0; i--) {
    const d = this.darks[i]; d.t += dt; const k = d.t / d.life; if (k >= 1) { this.darks.splice(i, 1); continue; }
    const r = d.r * (0.4 + 0.8 * Math.sqrt(k)), a = 1 - k, gr = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
    gr.addColorStop(0, `rgba(0,0,0,${0.85 * a})`); gr.addColorStop(0.7, `rgba(20,0,40,${0.6 * a})`); gr.addColorStop(1, 'rgba(60,0,120,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, TAU); ctx.fill();
  }
};
Battle.prototype.drawSkynet = function (ctx, dt) {
  this.skynetT -= dt; const a = Math.min(1, this.skynetT);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,23,68,${0.12 * a})`; ctx.lineWidth = 1;
  for (let x = ARENA.x; x < ARENA.r; x += 60) { ctx.beginPath(); ctx.moveTo(x, ARENA.y); ctx.lineTo(x, ARENA.b); ctx.stroke(); }
  for (let y = ARENA.y; y < ARENA.b; y += 60) { ctx.beginPath(); ctx.moveTo(ARENA.x, y); ctx.lineTo(ARENA.r, y); ctx.stroke(); }
  const sy = ARENA.y + ((this.time * 220) % ARENA.h), g = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
  g.addColorStop(0, 'rgba(255,23,68,0)'); g.addColorStop(0.5, `rgba(255,23,68,${0.3 * a})`); g.addColorStop(1, 'rgba(255,23,68,0)'); ctx.fillStyle = g; ctx.fillRect(ARENA.x, sy - 30, ARENA.w, 60);
  ctx.restore();
};

/* ---------- battle rendering ---------- */
Battle.prototype.draw = function (ctx, dt) {
  ctx.save();
  if (FX.shake > 0) ctx.translate(vr(-FX.shake, FX.shake), vr(-FX.shake, FX.shake));
  if (this.cam && typeof supCamera === 'function') supCamera(this, ctx, dt);
  Arena.draw(ctx, dt);
  ctx.save(); chamferPath(ctx, ARENA.x, ARENA.y, ARENA.w, ARENA.h, 12); ctx.clip();
  if (typeof supDrawUnder === 'function') supDrawUnder(this, ctx, dt);
  this.drawDarks(ctx, dt); this.drawZones(ctx); this.drawStrikes(ctx); this.drawLasers(ctx);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of this.pillars) {
    const a = p.life / p.max, gr = ctx.createLinearGradient(p.x - p.w, 0, p.x + p.w, 0);
    gr.addColorStop(0, rgba(p.col, 0)); gr.addColorStop(0.5, rgba('#ffffff', 0.95 * a)); gr.addColorStop(0.3, rgba(p.col, 0.6 * a)); gr.addColorStop(0.7, rgba(p.col, 0.6 * a)); gr.addColorStop(1, rgba(p.col, 0));
    ctx.fillStyle = gr; ctx.fillRect(p.x - p.w, ARENA.y, p.w * 2, ARENA.h);
  }
  ctx.restore();
  this.drawPortals(ctx, false);
  const order = this.fighters.filter(f => f.alive && !(f.st.outside > 0)).sort((a, b) => (a.isClone ? 0 : 1) - (b.isClone ? 0 : 1));
  for (const f of order) this.drawFighter(ctx, f);
  this.drawOrbs(ctx); this.drawProjs(ctx); this.drawBeams(ctx); this.drawWaves(ctx);
  FX.drawWorld(ctx);
  if (this.vfx && this.vfx.length && typeof supDrawOver === 'function') supDrawOver(this, ctx, dt);
  if (this.skynetT > 0) this.drawSkynet(ctx, dt);
  if (this.timeTint > 0) { ctx.fillStyle = `rgba(110,140,255,${Math.min(0.16, this.timeTint * 0.12)})`; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); }
  if (this.cinematic) {
    const c = this.cinematic, f = c.f, k = Math.min(1, c.t / 0.4);
    const gr = ctx.createRadialGradient(f.x, f.y, f.r * 1.5, f.x, f.y, 700); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,8,${0.65 * k})`);
    ctx.fillStyle = gr; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    ctx.save(); ctx.translate(f.x, f.y); _lightRays(ctx, f.r * (1 + c.t), '#ffd54f', c.t * 3, 18, 3.5, 0.35 * k); ctx.restore();
    this.drawFighter(ctx, f);
  }
  ctx.restore();
  this.drawPortals(ctx, true); this.drawGhosts(ctx, dt);   // wall portals and travellers can cross the arena edge
  FX.drawTexts(ctx);
  if (this.cinematic) {
    const c = this.cinematic; ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 38px "Segoe UI", sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#000';
    const txt = (c.form === 2 ? 'FINAL GOD FORM' : c.form === 1 ? 'AWAKENING' : 'TRANSFORMING') + '.'.repeat(1 + Math.floor(c.t * 4) % 3); ctx.strokeText(txt, ARENA.cx, ARENA.y + 70); ctx.fillStyle = '#ffd54f'; ctx.fillText(txt, ARENA.cx, ARENA.y + 70); ctx.restore();
  }
  ctx.restore();
  if (this.suddenDeath) { ctx.save(); ctx.globalAlpha = 0.45 + 0.35 * Math.sin(this.time * 5); ctx.strokeStyle = '#ff2244'; ctx.lineWidth = 5; ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 18; chamferPath(ctx, ARENA.x, ARENA.y, ARENA.w, ARENA.h, 12); ctx.stroke(); ctx.restore(); }
  if (FX.flash > 0.01) { ctx.fillStyle = rgba(FX.flashCol, FX.flash); ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); }
  this.drawHud(ctx);
};

Battle.prototype.drawFighter = function (ctx, f) {
  let r = f.r;
  if (this.cinematic && this.cinematic.f === f) r *= 1 + Math.min(1, this.cinematic.t / this.cinematic.dur) * 0.35;
  if (f.casting > 0) r *= 1 + Math.sin(f.t * 30) * 0.04 + 0.08;
  const st = { rot: f.rot, t: f.t, evo: f.evo, god: f.god > 0, rage: f.rage, flash: f.hitFlash, alpha: f.st.phase > 0 ? 0.22 + 0.1 * Math.sin(f.t * 20) : f.summon ? 0.95 : f.isClone ? 0.55 : (f.st.invuln > 0 && Math.floor(f.t * 16) % 2 ? 0.7 : 1), big: f.boss };
  if (f.cos) {
    if (f.cos.aura) st.auraCol = f.cos.aura.color;
    if (f.cos.skin) st.skin = f.cos.skin;
    if (f.cos.trail && Math.random() < 0.8) FX.p(f.x - f.vx * 0.03 + vr(-6, 6), f.y - f.vy * 0.03 + vr(-6, 6), -f.vx * 0.15, -f.vy * 0.15, 0.45, f.cos.trail.id === 'trail_pixel' ? 4 : vr(3, 6), cosColor(f.cos.trail.color, f.t), f.cos.trail.id === 'trail_pixel' ? 'shard' : 'dot', 1.5);
  }
  if (f.def.tuning && f.def.tuning.aura === false) st.noAura = true;   // owner setting (Admin Ball Control Panel)
  if (f.ghost) st.alpha = 0.55 + 0.18 * Math.sin(f.t * 17);           // holographic copies
  if (f.sx && f.sx.liftT > 0) { r *= 1 + Math.min(0.3, f.sx.liftT * 0.3); ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(f.x, f.y + r * 1.3, r * 0.8, r * 0.25, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  if (f.st.freeze > 0) st.tint = 'rgba(160,230,255,0.38)';
  if (f.st.timestop > 0) st.tint = 'rgba(110,120,160,0.5)';
  if (f.unit && !f.holo && !f.ballLook) { drawUnit(ctx, f, r); return; }
  if (f.holo) st.alpha = 0.72 + 0.2 * Math.sin(f.t * 23) * Math.sin(f.t * 7);
  if (f.st.antievo > 0 && !st.tint) st.tint = 'rgba(70,40,90,0.3)';
  if (f.st.overheat > 0 && !st.tint) st.tint = 'rgba(255,120,30,0.28)';
  if (this.cfg.teams.length > 2 || this.cfg.teams.some(t => t.length > 1)) {
    ctx.save(); ctx.strokeStyle = rgba(TEAM_COLS[f.team % 6], 0.75); ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -f.t * 30;
    ctx.beginPath(); ctx.arc(f.x, f.y, r + 7, 0, TAU); ctx.stroke(); ctx.restore();
  }
  drawBall(ctx, f.def, f.x, f.y, r, st);
  drawTechStatus(ctx, f, r);
  if (f.st.shield > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const a = Math.min(1, f.st.shield * 2);
    ctx.strokeStyle = `rgba(150,235,255,${0.7 * a})`; ctx.lineWidth = 3; ctx.beginPath();
    for (let k = 0; k <= 6; k++) { const an = k / 6 * TAU + f.t; ctx.lineTo(f.x + Math.cos(an) * r * 1.3, f.y + Math.sin(an) * r * 1.3); } ctx.stroke();
    ctx.fillStyle = `rgba(120,220,255,${0.12 * a})`; ctx.beginPath(); ctx.arc(f.x, f.y, r * 1.25, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (f.st.reflect > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(230,250,255,${0.5 + 0.3 * Math.sin(f.t * 12)})`; ctx.lineWidth = 4; ctx.setLineDash([14, 8]); ctx.lineDashOffset = f.t * 60; ctx.beginPath(); ctx.arc(f.x, f.y, r * 1.35, 0, TAU); ctx.stroke(); ctx.restore(); }
  if (f.st.stun > 0) { ctx.save(); ctx.fillStyle = '#fff27a'; ctx.font = '900 16px sans-serif'; ctx.textAlign = 'center'; for (let k = 0; k < 3; k++) { const an = f.t * 5 + k / 3 * TAU; ctx.fillText('✦', f.x + Math.cos(an) * r * 0.7, f.y - r - 8 + Math.sin(an) * 6); } ctx.restore(); }
  if (f.st.timestop > 0) { ctx.save(); ctx.strokeStyle = 'rgba(200,210,255,.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(f.x, f.y, r * 1.35, 0, TAU); ctx.stroke(); ctx.restore(); }
  if (f.summon && !f.holo) {   // summoned through a portal: violet ring + small HP bar
    ctx.save(); ctx.strokeStyle = rgba(f.owner ? f.owner.def.design.c3 : '#d18cff', 0.85); ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -f.t * 40;
    ctx.beginPath(); ctx.arc(f.x, f.y, r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const bw = r * 1.6; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(f.x - bw / 2, f.y + r + 9, bw, 5); ctx.fillStyle = '#d18cff'; ctx.fillRect(f.x - bw / 2, f.y + r + 9, bw * clamp(f.hpRatio, 0, 1), 5); ctx.restore();
  }
  if (f.isClone && !f.holo) return;
  // HP number INSIDE the ball (a hologram shows its master's HP)
  const hp = Math.max(0, Math.ceil(f.holo && f.owner ? f.owner.hp : f.hp)), txt = String(hp), fs = r * (txt.length >= 4 ? 0.46 : txt.length === 3 ? 0.58 : 0.72);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${fs}px "Segoe UI", Arial, sans-serif`; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, fs * 0.2); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(txt, f.x, f.y + fs * 0.04);
  ctx.fillStyle = f.rage ? (Math.floor(f.t * 6) % 2 ? '#ffd0d0' : '#ffffff') : '#ffffff'; ctx.fillText(txt, f.x, f.y + fs * 0.04);
  if (SAVE.settings.labels) {
    const deco = f.def.design.deco || [], top = deco.some(d => ['halo', 'crown', 'horns'].includes(d)) ? r * 1.62 : r * 1.12;
    ctx.font = '700 13px "Segoe UI", sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    const lbl = (f.isPlayer || (f.holo && f.owner?.isPlayer) || (f.slot != null && f === this.player) ? '★ ' : '') + (f.tag ? f.tag + ' • ' : '') + f.name + (f.boss ? ' [BOSS]' : '');
    ctx.strokeText(lbl, f.x, f.y - top - 8); const myTeam = this.player ? this.player.team : 0; ctx.fillStyle = f.team === myTeam ? '#bfefff' : (this.cfg.teams.length > 2 ? TEAM_COLS[f.team % 6] : '#ffc2cc'); ctx.fillText(lbl, f.x, f.y - top - 8);
  }
  ctx.restore();
};

/* dimensional portals: swirling violet rings around a black core; wall portals are flattened ovals on the arena edge */
Battle.prototype.drawPortals = function (ctx, outer) {
  for (const p of this.portals) {
    if (!!p.edge !== outer) continue;
    const open = clamp(p.t / 0.22, 0, 1), close = clamp((p.life - p.t) / 0.28, 0, 1), sc = Math.min(1 - Math.pow(1 - open, 3), close);
    if (sc <= 0.02) continue;
    if (p.style === 'void') { drawVoidRift(ctx, p, sc); continue; }
    const r = p.r * sc * (p.big ? 1.15 : 1), vert = p.edge === 'l' || p.edge === 'r';
    const rx = p.edge ? (vert ? r * 0.55 : r * 1.35) : r, ry = p.edge ? (vert ? r * 1.35 : r * 0.55) : r * 0.86, m = Math.max(rx, ry), tt = p.t * 3.2 * p.spin;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(p.col), -rx * 2.3, -ry * 2.3, rx * 4.6, ry * 4.6);
    ctx.strokeStyle = rgba(p.col, 0.28 * sc); ctx.lineWidth = 2; ctx.setLineDash([10, 9]); ctx.lineDashOffset = -tt * 20;   // space distortion
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.45, ry * 1.45, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.scale(rx / m, ry / m); const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, m);
    gr.addColorStop(0, '#000000'); gr.addColorStop(0.55, 'rgba(8,0,22,.96)'); gr.addColorStop(0.85, rgba(p.col, 0.55)); gr.addColorStop(1, rgba(p.col, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, m, 0, TAU); ctx.fill(); ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const k = 1 - i * 0.19, a0 = tt * (1 + i * 0.45) + i * 1.7;
      ctx.strokeStyle = rgba(i % 2 ? '#ffffff' : p.col, 0.95 - i * 0.16); ctx.lineWidth = Math.max(1.5, r * 0.085 * (1 - i * 0.12));
      ctx.beginPath(); ctx.ellipse(0, 0, rx * k, ry * k, 0, a0, a0 + 4.1); ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.6) { const a = vr(TAU), d = m * vr(1.2, 1.8), x = p.x + Math.cos(a) * d * rx / m, y = p.y + Math.sin(a) * d * ry / m; FX.p(x, y, (p.x - x) * 2.4, (p.y - y) * 2.4, 0.4, vr(2, 4), Math.random() < 0.7 ? p.col : '#ffffff'); }
  }
};
/* a ball sinking into a portal (shrinks, spins, slides — even past the arena wall) or rising out of one */
Battle.prototype.drawGhosts = function (ctx, dt) {
  for (let i = this.ghosts.length - 1; i >= 0; i--) {
    const g = this.ghosts[i]; g.t += dt;
    const k = clamp(g.t / g.dur, 0, 1); if (k >= 1) { this.ghosts.splice(i, 1); continue; }
    const e = k * k * (3 - 2 * k), x = lerp(g.x0, g.x1, e), y = lerp(g.y0, g.y1, e);
    const sc = g.mode === 'in' ? 1 - 0.8 * e : 0.2 + 0.8 * e, al = g.mode === 'in' ? 1 - 0.7 * e : 0.35 + 0.65 * e;
    drawBall(ctx, g.def, x, y, g.r * sc, { t: g.t * 3, rot: g.t * (g.mode === 'in' ? 16 : -16), evo: g.evo, god: g.god, alpha: al });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(g.def.design.c3, 0.85 * (1 - k)); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, g.r * sc * 1.35, g.t * 12, g.t * 12 + 4); ctx.stroke(); ctx.restore();
  }
};
Battle.prototype.drawZones = function (ctx) {
  for (const z of this.zones) {
    const a = Math.min(1, z.life / 0.4, (z.max - z.life) / 0.25 + 0.2), t = this.time;
    ctx.save(); ctx.translate(z.x, z.y); ctx.globalAlpha = a;
    if (z.custom) { if (z.draw) { try { z.draw(ctx, z, t); } catch (e) { /* visual only */ } } ctx.restore(); continue; }
    if (z.kind === 'nullzone' || z.kind === 'minihole' || z.kind === 'cybertrap') { drawTechZone(ctx, z, t); ctx.restore(); continue; }
    if (z.kind === 'trap') {
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, z.r); gr.addColorStop(0, rgba(z.col, 0.28)); gr.addColorStop(1, rgba(z.col, 0.05));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(z.style === 'web' ? '#ffffff' : z.col, 0.7); ctx.lineWidth = 1.6;
      if (z.style === 'web') { for (let i = 0; i < 10; i++) { const an = i / 10 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * z.r, Math.sin(an) * z.r); ctx.stroke(); } for (let k = 1; k <= 4; k++) { ctx.beginPath(); for (let i = 0; i <= 10; i++) { const an = i / 10 * TAU, rr = z.r * k / 4 * (i % 2 ? 0.9 : 1); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.stroke(); } }
      else { ctx.setLineDash([10, 8]); ctx.lineDashOffset = t * 30; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); for (let i = 0; i < 6; i++) { const an = t * 0.8 + i, rr = z.r * (0.3 + (i * 0.13 + t * 0.2) % 0.6); ctx.beginPath(); ctx.arc(Math.cos(an) * rr, Math.sin(an) * rr, 5 + i % 3 * 2, 0, TAU); ctx.stroke(); } }
    } else {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) { ctx.strokeStyle = rgba(z.col, 0.22 + k * 0.08); ctx.lineWidth = 3; ctx.beginPath(); const rr = z.r * (1 - ((t * 0.7 + k / 4) % 1)); ctx.arc(0, 0, Math.max(1, rr), t * 3 + k, t * 3 + k + 4); ctx.stroke(); }
      if (z.kind === 'blackhole') {
        ctx.globalCompositeOperation = 'source-over'; const core = 46 + 10 * Math.sin(t * 8);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, core, 0, TAU); ctx.fill();
        ctx.save(); ctx.rotate(t * 2); ctx.scale(1, 0.4); ctx.strokeStyle = rgba(z.col, 0.9); ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, core * 1.7, 0, TAU); ctx.stroke(); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, core + 3, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }
};
Battle.prototype.drawStrikes = function (ctx) {
  for (const s of this.strikes) {
    if (s.kind === 'titan') { drawTitanDrop(ctx, s); continue; }
    const k = 1 - s.t / s.max;
    ctx.save(); ctx.strokeStyle = rgba(s.col, 0.5 + k * 0.5); ctx.lineWidth = 2 + k * 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -k * 40;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = rgba(s.col, 0.08 + k * 0.22); ctx.beginPath(); ctx.arc(s.x, s.y, s.r * k, 0, TAU); ctx.fill();
    if (s.kind === 'pillar') { ctx.fillStyle = rgba(s.col, 0.15 * k); ctx.fillRect(s.x - s.r * 0.65, ARENA.y, s.r * 1.3, ARENA.h); }
    if (s.kind === 'meteor' && s.t < 0.35) { const q = s.t / 0.35, mx = s.x - 260 * q, my = s.y - 420 * q; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#ff9100'), mx - 40, my - 40, 80, 80); ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(mx, my, 12, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
};
Battle.prototype.drawProjs = function (ctx) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of this.projs) {
    if (p.style === 'missile') { drawMissile(ctx, p); continue; }
    if (p.style && typeof drawSupProj === 'function' && drawSupProj(ctx, p)) continue;
    const s = p.r * 3.4; ctx.drawImage(glowSprite(p.col), p.x - s, p.y - s, s * 2, s * 2);
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.85, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.45, 0, TAU); ctx.fill();
  }
  ctx.restore();
};
Battle.prototype.drawOrbs = function (ctx) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const o of this.orbs) { const f = o.owner; for (let k = 0; k < o.n; k++) { const a = o.ang + k / o.n * TAU, x = f.x + Math.cos(a) * o.rad, y = f.y + Math.sin(a) * o.rad; ctx.drawImage(glowSprite(o.col), x - 26, y - 26, 52, 52); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); } }
  ctx.restore();
};
Battle.prototype.drawBeams = function (ctx) {
  for (const b of this.beams) {
    const o = b.owner, end = b.end || rayToWall(o.x, o.y, b.ang);
    ctx.save(); ctx.lineCap = 'round';
    if (b.t < b.charge) {
      const k = b.t / b.charge; ctx.strokeStyle = rgba(b.col, 0.25 + k * 0.5); ctx.lineWidth = 2 + k * 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -b.t * 120;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; const s = 20 + k * 30; ctx.drawImage(glowSprite(b.col), o.x + Math.cos(b.ang) * o.r - s, o.y + Math.sin(b.ang) * o.r - s, s * 2, s * 2);
    } else {
      const ft = (b.t - b.charge) / b.fire, a = b.mega ? Math.min(1, (1 - ft) * 4) : 1 - ft, w = b.w * (b.mega ? 1 + Math.sin(b.t * 40) * 0.08 : 1 - ft * 0.5);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      for (const [lw, col] of [[w * 2.2, rgba(b.col, 0.25)], [w, rgba(b.col, 0.85)], [w * 0.38, '#ffffff']]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(end.x, end.y); ctx.stroke(); }
      const s = w * 2.2; ctx.drawImage(glowSprite(b.col), end.x - s, end.y - s, s * 2, s * 2);
    }
    ctx.restore();
  }
};
Battle.prototype.drawWaves = function (ctx) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const w of this.waves) {
    const a = 1 - w.r / w.maxR; ctx.globalAlpha = Math.min(1, a * 1.6);
    if (w.style) { drawWaveStyle(ctx, w); continue; }
    ctx.strokeStyle = rgba(w.col, 0.35); ctx.lineWidth = w.w * 2.4; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = w.col; ctx.lineWidth = w.w * 0.7; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
};

/* ---------- top HUD ---------- */
Battle.prototype.drawHud = function (ctx) {
  if (this.cfg.demo) return;
  let left = this.fighters.filter(f => !f.isClone && f.team === 0);
  let right = this.fighters.filter(f => !f.isClone && f.team !== 0);
  if (this.mode === 'survival' || this.mode === 'endless') { const al = right.filter(f => f.alive); right = al.length ? al : right.slice(-1); }
  if (this.cfg.teams.length > 2) { const all = left.concat(right), half = Math.ceil(all.length / 2); left = all.slice(0, half); right = all.slice(half); }
  if (left.length === 1 && right.length === 1) { hudPanel(ctx, left[0], false); hudPanel(ctx, right[0], true); }
  else { hudRows(ctx, left, false); hudRows(ctx, right.slice(-3), true); }
  ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 22px "Segoe UI", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 4; ctx.strokeStyle = '#000';
  const m = Math.floor(this.time / 60), s = Math.floor(this.time % 60);
  let top = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  if (this.mode === 'survival') top = 'WAVE ' + this.wave + '  ' + top;
  if (this.mode === 'endless') top = 'KO ' + this.kills + '  ' + top;
  if (this.mode === 'tournament') top = (this.cfg.roundName || 'ROUND') + '  ' + top;
  ctx.strokeText(top, W / 2, 30); ctx.fillText(top, W / 2, 30);
  ctx.font = '700 12px "Segoe UI", sans-serif'; ctx.fillStyle = '#8fa3cf'; ctx.fillText((this.pvp ? (PVP_MODES[this.cfg.pmode] || PVP_MODES.duel).name : MODES[this.mode]?.name) + ' • ' + (this.pvp ? (this.cfg.ranked ? 'RANKED' : 'FRIENDLY') : DIFF[this.difficulty].label.toUpperCase()), W / 2, 46);
  ctx.restore();
};
function hudBar(ctx, x, y, w, hh, frac, c1, c2, back = 'rgba(255,255,255,.1)') {
  ctx.fillStyle = back; ctx.fillRect(x, y, w, hh);
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(x, y, w * clamp(frac, 0, 1), hh);
  ctx.strokeStyle = 'rgba(120,170,255,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
}
function hudPanel(ctx, f, right) {
  const X = right ? W - 46 : 46, dir = right ? -1 : 1, bw = 300;
  const ix = X + dir * 36, bx = right ? X - 76 - bw : X + 76;
  drawBall(ctx, f.def, ix, 50, 26, { t: f.t, rot: f.rot, evo: f.evo, god: f.god > 0, rage: f.rage, small: true, alpha: f.alive ? 1 : 0.35 });
  ctx.save(); ctx.textAlign = right ? 'right' : 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = '800 18px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff';
  const nx = right ? bx + bw : bx;
  const nm = (f.isPlayer || (f.slot != null && f === BATTLE?.player) ? '★ ' : '') + (f.tag ? f.tag + ' • ' : '') + f.name; ctx.fillText(nm, nx, 26);
  const nw = ctx.measureText(nm).width;
  ctx.font = '700 11px "Segoe UI", sans-serif'; ctx.fillStyle = RARITY_INFO[f.def.rarity]?.col || '#aaa';
  const sub = `Lv ${f.level}${f.evo ? ' ★' + f.evo : ''} • ${f.def.rarity.toUpperCase()}${f.slot != null ? (f.manual ? ' • MANUAL' : ' • AUTO') : f.ai && !f.isPlayer ? ' • ' + f.ai.pers.toUpperCase() : ''}`;
  ctx.fillText(sub, nx + dir * (nw + 8), 25);
  const sw = ctx.measureText(sub).width;
  // chips
  const chips = []; if (f.rage) chips.push(['RAGE', rageColor(f.def.design)]); if (f.god > 0) chips.push(['GOD ' + Math.ceil(f.god) + 's', '#ffd54f']);
  if (f.st.shield > 0) chips.push(['SHIELD', '#9fe8ff']); if (f.st.buff > 0) chips.push(['POWER', '#ff9f1c']); if (f.st.adapt > 0) chips.push(['ADAPT', '#e0aaff']);
  if (f.st.phase > 0) chips.push(['PHASED', '#b2fff9']); if (f.st.outside > 0) chips.push(['IN THE VOID', '#d18cff']); if (f.st.reflect > 0) chips.push(['REFLECT', '#e0f7fa']);
  if (f.sx && typeof supChips === 'function') supChips(f, chips);
  if (f.st.silence > 0) chips.push(['SILENCED', '#ff8a80']); if (f.st.antievo > 0) chips.push(['DE-EVOLVED', '#ea80fc']); if (f.st.nulled > 0) chips.push(['NULLED', '#b388ff']);
  if (f.st.overheat > 0) chips.push(['OVERHEAT', '#ff9100']); else if (f.st.overclock > 0) chips.push(['OVERCLOCK', '#ff1744']);
  if (f.st.absorb > 0) chips.push(['ABSORB ' + f.absorbLeft, '#ea80fc']); if (f.st.reverse > 0) chips.push(['REVERSE ' + f.reverseLeft, '#e1bee7']); if (f.guard && f.guard.alive) chips.push(['DRONE', '#80d8ff']);
  if (f.st.burn > 0) chips.push(['BURN', '#ff7b00']); if (f.st.poison > 0) chips.push(['POISON', '#9dff00']); if (f.st.freeze > 0) chips.push(['FROZEN', '#bdf6ff']); if (f.st.stun > 0) chips.push(['STUN', '#fff27a']); if (f.st.weaken > 0) chips.push(['WEAK', '#c77dff']);
  let cx = nx + dir * (nw + sw + 16);
  ctx.font = '800 10px "Segoe UI", sans-serif';
  for (const [t, c] of chips.slice(0, 3)) { const w = ctx.measureText(t).width + 10; const x0 = right ? cx - w : cx; ctx.fillStyle = rgba(c, 0.25); ctx.fillRect(x0, 13, w, 15); ctx.strokeStyle = c; ctx.strokeRect(x0 + 0.5, 13.5, w - 1, 14); ctx.fillStyle = c; ctx.textAlign = 'left'; ctx.fillText(t, x0 + 5, 24); cx += dir * (w + 4); }
  // HP bar
  const hpf = f.hp / f.maxHp, hc = f.rage ? ['#ff1a3c', '#b026ff'] : hpf > 0.5 ? ['#1aff8c', '#29e3ff'] : ['#ff9f1c', '#ffd54f'];
  hudBar(ctx, bx, 34, bw, 17, hpf, right ? hc[1] : hc[0], right ? hc[0] : hc[1]);
  ctx.textAlign = 'center'; ctx.font = '800 12px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
  const ht = `${Math.max(0, Math.ceil(f.hp))} / ${f.maxHp} HP`; ctx.strokeText(ht, bx + bw / 2, 47); ctx.fillText(ht, bx + bw / 2, 47);
  // ULT bar
  const full = f.ultMeter >= 100;
  hudBar(ctx, bx, 56, bw, 8, f.ultMeter / 100, full ? '#ffd54f' : '#7b1fff', full ? '#ffffff' : '#ff3cf2');
  ctx.font = '800 10px "Segoe UI", sans-serif'; ctx.fillStyle = full ? '#ffd54f' : '#c9b6ff'; ctx.textAlign = right ? 'right' : 'left';
  ctx.fillText(full ? (f.def.godMode && !f.godUsed ? 'GOD MODE READY' : 'ULTIMATE READY') : 'ULT ' + Math.floor(f.ultMeter) + '%', right ? bx + bw : bx, 76);
  // skill cooldown pips
  const sk = f.allSkills(); ctx.textAlign = 'center';
  sk.slice(0, 7).forEach((s, i) => {
    const px = right ? bx + bw - 120 - i * 26 + 0 : bx + 120 + i * 26, py = 72, rr = 9;
    const ready = !s.locked && s.cdLeft <= 0, frac = s.locked ? 1 : clamp(s.cdLeft / (s.cd || 6), 0, 1);
    ctx.fillStyle = s.locked ? 'rgba(80,80,80,.5)' : rgba(s.color || f.def.design.c3, ready ? 0.9 : 0.25);
    ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
    if (!ready && !s.locked) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, rr, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = '700 10px "Segoe UI Symbol", sans-serif'; ctx.fillText(s.locked ? '🔒' : (SKILL_TYPES[s.type]?.ico || '•'), px, py + 4);
  });
  if (f.def.heat || f.energy > 0) {     // Cyber Overlord heat / Anti Ball stored energy
    const isHeat = !!f.def.heat, v = isHeat ? (f.heat || 0) / 100 : f.energy / 100, by = 84;
    hudBar(ctx, bx, by, 110, 4, v, isHeat ? '#ffd54f' : '#7c4dff', isHeat ? (f.st.overheat > 0 ? '#ff1744' : '#ff6d00') : '#ea80fc');
    ctx.font = '800 9px "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = isHeat ? (f.st.overheat > 0 ? '#ff5252' : '#ffcc80') : '#ea80fc';
    ctx.fillText(isHeat ? (f.st.overheat > 0 ? 'OVERHEATED' : 'HEAT ' + Math.round(f.heat || 0)) : 'ENERGY ' + Math.round(f.energy), bx + 116, by + 5);
  }
  ctx.restore();
}
function hudRows(ctx, list, right) {
  const X = right ? W - 46 : 46;
  list.slice(0, 3).forEach((f, i) => {
    const y = 12 + i * 26, bw = 210, ix = right ? X - 12 : X + 12;
    drawBall(ctx, f.def, ix, y + 10, 10, { t: f.t, rot: f.rot, small: true, noAura: true, alpha: f.alive ? 1 : 0.3, god: f.god > 0, rage: f.rage });
    ctx.save(); ctx.font = '800 13px "Segoe UI", sans-serif'; ctx.textAlign = right ? 'right' : 'left'; ctx.fillStyle = f.alive ? TEAM_COLS[f.team % 6] : '#666';
    const nx = right ? X - 30 : X + 30; ctx.fillText((f.isPlayer || (f.slot != null && f === BATTLE?.player) ? '★ ' : '') + (f.tag || f.name) + (f.rage ? ' 🔥' : '') + (f.god > 0 ? ' ✦' : ''), nx, y + 14);
    const bx = right ? X - 30 - 140 - bw : X + 30 + 140;
    hudBar(ctx, bx, y + 4, bw, 11, f.hp / f.maxHp, f.rage ? '#ff1a3c' : '#1aff8c', f.rage ? '#b026ff' : '#29e3ff');
    hudBar(ctx, bx, y + 16, bw, 3, f.ultMeter / 100, '#7b1fff', '#ff3cf2');
    ctx.textAlign = 'center'; ctx.font = '800 10px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(Math.max(0, Math.ceil(f.hp)) + '/' + f.maxHp, bx + bw / 2, y + 13);
    ctx.restore();
  });
}

/* =====================================================================
   11. PROGRESSION — levels, evolution, skill tree, achievements, events
   ===================================================================== */
const MAX_LVL = 50;
const expNeed = lv => 80 + lv * 35;
const EVO = [{ name: 'Base' }, { name: 'Evolved', lvl: 10, cost: 500 }, { name: 'Awakened', lvl: 25, cost: 1500 }, { name: 'Ascended', lvl: 40, cost: 4000 }];
const TREE = [
  { id: 'power1', name: 'Power Core I', desc: '+10% ability & ultimate power', cost: 1, lvl: 1 },
  { id: 'cd1', name: 'Quick Charge I', desc: '-10% ability cooldowns', cost: 1, lvl: 1 },
  { id: 'slot3', name: 'Unlock 3rd Ability', desc: 'Unlocks the third special ability', cost: 2, lvl: 5 },
  { id: 'ultcharge', name: 'Ultimate Surge', desc: '+25% ultimate charge rate', cost: 2, lvl: 5, req: 'power1' },
  { id: 'rage', name: 'Rage Fury', desc: '+15% attack in Rage Mode', cost: 2, lvl: 8, req: 'cd1' },
  { id: 'slot4', name: 'Unlock 4th Ability', desc: 'Unlocks a fourth ability (4-ability balls)', cost: 3, lvl: 12, req: 'slot3', need4: true },
  { id: 'power2', name: 'Power Core II', desc: '+15% ability & ultimate power', cost: 3, lvl: 15, req: 'power1' },
  { id: 'cd2', name: 'Quick Charge II', desc: '-15% ability cooldowns', cost: 3, lvl: 15, req: 'cd1' },
  { id: 'vamp', name: 'Vampiric Shell', desc: 'Heal 8% of collision damage dealt', cost: 3, lvl: 20, req: 'rage' },
  { id: 'master', name: 'Ball Mastery', desc: '+5% to all stats', cost: 5, lvl: 30, req: 'power2' },
];
const UPGRADE_CAPS = { hp: 25, atk: 25, def: 25, spd: 20, crit: 20 };
const UPGRADE_LABEL = { hp: '+4 HP', atk: '+1.5 ATK', def: '+1.5 DEF', spd: '+1 SPD', crit: '+1% CRIT' };
const upgradeCost = (k, pts) => Math.round((k === 'crit' ? 140 : 100) * (1 + pts * 0.45));

function evoName(def, evo) { return evo ? `${EVO[evo].name} ${def.name}` : def.name; }
function ownedCount(includeLimited = true) { return allBalls().filter(b => !b.adminOnly && prog(b.id).owned && (includeLimited || !b.limited)).length; }
function unlockBall(id, silent) {
  const p = prog(id); if (p.owned) return false;
  p.owned = true; p.sp = Math.max(p.sp, 1);
  const b = getBall(id); if (b?.limited) SAVE.limited[id] = SAVE.limited[id] || { at: Date.now(), event: currentEventFor(id)?.name || 'Admin grant' };
  persist(); if (!silent) toast(`🔓 <b>${esc(b?.name || id)}</b> unlocked!`, 'gold');
  checkAchievements(); return true;
}
function giveExp(id, amount) {
  const p = prog(id); let ups = 0;
  if (p.level >= MAX_LVL) return 0;
  p.exp += Math.round(amount);
  while (p.level < MAX_LVL && p.exp >= expNeed(p.level)) { p.exp -= expNeed(p.level); p.level++; p.sp++; ups++; }
  if (p.level >= MAX_LVL) p.exp = 0;
  return ups;
}
function canEvolve(id) { const p = prog(id), nx = EVO[p.evo + 1]; return nx && p.level >= nx.lvl && SAVE.coins >= nx.cost; }
function treeState(def, node) {
  const p = prog(def.id);
  if (p.tree[node.id]) return 'owned';
  if (node.need4 && (def.skills || []).length < 4) return 'na';
  if (node.id === 'slot3' && (def.skills || []).length < 3) return 'na';
  if (p.level < node.lvl || (node.req && !p.tree[node.req])) return 'locked';
  return p.sp >= node.cost ? 'buy' : 'nosp';
}

/* ---------------- achievements ---------------- */
const ACHIEVEMENTS = [
  { id: 'win1', name: 'First Victory', desc: 'Win your first battle', reward: 100, test: s => s.wins >= 1 },
  { id: 'win10', name: 'Rising Sphere', desc: 'Win 10 battles', reward: 300, test: s => s.wins >= 10 },
  { id: 'win50', name: 'Arena Veteran', desc: 'Win 50 battles', reward: 1000, test: s => s.wins >= 50 },
  { id: 'win200', name: 'Living Legend', desc: 'Win 200 battles', reward: 3000, test: s => s.wins >= 200 },
  { id: 'crit', name: 'Critical Strike', desc: 'Land 25 critical hits', reward: 150, test: s => s.crits >= 25 },
  { id: 'rage', name: 'Unleashed Fury', desc: 'Trigger Rage Mode', reward: 100, test: s => s.rages >= 1 },
  { id: 'god', name: 'Ascension', desc: 'Activate God Mode', reward: 250, test: s => s.gods >= 1 },
  { id: 'coll10', name: 'Collector', desc: 'Own 10 balls', reward: 300, test: () => ownedCount() >= 10 },
  { id: 'coll25', name: 'Ball Hoarder', desc: 'Own 25 balls', reward: 800, test: () => ownedCount() >= 25 },
  { id: 'coll48', name: 'Completionist', desc: 'Own all 48 standard balls', reward: 3000, test: () => BUILTIN_BALLS.filter(b => !b.adminOnly).every(b => prog(b.id).owned) },
  { id: 'evo', name: 'Evolution', desc: 'Evolve a ball', reward: 300, test: s => s.evolutions >= 1 },
  { id: 'tourney', name: 'Champion', desc: 'Win a Tournament', reward: 500, test: s => s.tourneyWins >= 1 },
  { id: 'boss', name: 'Boss Slayer', desc: 'Defeat a Boss Battle', reward: 500, test: s => s.bossWins >= 1 },
  { id: 'surv10', name: 'Survivor', desc: 'Reach wave 10 in Survival', reward: 600, test: s => s.survivalBest >= 10 },
  { id: 'endless20', name: 'Unstoppable', desc: 'Score 20 KOs in Endless Battle', reward: 600, test: s => s.endlessBest >= 20 },
  { id: 'insane', name: 'Godlike', desc: 'Win a battle on Godlike difficulty', reward: 800, test: s => s.insaneWins >= 1 },
  { id: 'b100', name: 'Centurion', desc: 'Fight 100 battles', reward: 700, test: s => s.battles >= 100 },
  { id: 'perfect', name: 'Perfect Victory', desc: 'Win a 1 VS 1 battle while keeping at least 90% HP', reward: 500, test: s => (s.perfect || 0) >= 1 },
  { id: 'creator', name: 'Ball Creator', desc: 'Create a custom ball in the Admin Ball Creator', reward: 200, test: s => s.created >= 1 },
  { id: 'rich', name: 'Ball Tycoon', desc: 'Hold 10,000 coins at once', reward: 500, test: () => SAVE.coins >= 10000 },
  { id: 'limited', name: 'Limited Edition', desc: 'Obtain a limited event ball', reward: 400, test: () => Object.keys(SAVE.limited).length >= 1 },
];
function checkAchievements() {
  if (online()) return;   // signed in: the server evaluates achievements
  for (const a of ACHIEVEMENTS) {
    const st = SAVE.achievements[a.id] || (SAVE.achievements[a.id] = { done: false, claimed: false });
    if (!st.done && a.test(SAVE.stats)) { st.done = true; toast(`🏅 Achievement: <b>${esc(a.name)}</b> — claim it in Limited Events › Achievements`, 'gold'); }
  }
  persist();
}
const COLLECTION_REWARDS = [[5, 200], [10, 400], [15, 600], [20, 900], [30, 1500], [40, 2500], [48, 5000]];

/* ---------------- limited events ---------------- */
const WEEK = 7 * 86400000, EPOCH = Date.UTC(2024, 0, 1);
const EVENT_INFO = {
  bloodmoon: ['Blood Moon Rising', 'The crimson moon awakens. Win battles to claim the Blood Moon Ball.'],
  aurora: ['Aurora Nights', 'Polar lights shimmer across the arena. Claim the Aurora Ball!'],
  frostcrown: ['Frost Festival', 'Winter has a king. Win to earn the Frost Crown Ball.'],
  solarflare: ['Solar Storm Week', 'Solar flares scorch the arena. Claim the Solar Flare Ball.'],
  glitch: ['Neon Net Glitch', 'A corrupted sphere broke out of the neon net. Capture the Cyber Glitch Ball.'],
  sakura: ['Sakura Spirit Festival', 'Petals drift through the arena. Earn the Sakura Spirit Ball.'],
};
function builtinEvents() {
  const idx = Math.floor((Date.now() - EPOCH) / WEEK);
  const make = i => { const b = LIMITED_BALLS[((i % 6) + 6) % 6]; const [name, desc] = EVENT_INFO[b.id]; return { id: 'wk' + i, name, desc, ball: b.id, start: EPOCH + i * WEEK, end: EPOCH + (i + 1) * WEEK, goal: 3, price: 2500, builtin: true }; };
  return [make(idx), make(idx + 1)];
}
function allEvents() { if (online() && window.Online.events) return window.Online.events.filter(e => getBall(e.ball)); return [...builtinEvents(), ...SAVE.customEvents.filter(e => getBall(e.ball))]; }
function activeEvents() { const t = Date.now(); return allEvents().filter(e => e.start <= t && t < e.end); }
function currentEventFor(ballId) { return activeEvents().find(e => e.ball === ballId); }
function evProg(id) { return SAVE.eventProgress[id] || (SAVE.eventProgress[id] = { wins: 0, claimed: false }); }

/* =====================================================================
   SHARED BATTLE SETUP — deterministic, serialisable "battle tickets".
   The guest client and the game server both use these functions, so the
   server can re-simulate any battle (seed + recorded inputs) to verify it.
   ===================================================================== */
function enemySpec(def, level, diff, extra = {}) {
  level = clamp(Math.round(level), 1, MAX_LVL);
  return { ball: def.id, level, evo: level >= 40 ? 3 : level >= 25 ? 2 : level >= 10 ? 1 : 0, diff, ai: def.ai, statMul: DIFF[diff].statMul, allUnlocked: true,
    tree: level >= 15 ? { power1: 1, cd1: 1, slot3: 1, slot4: 1 } : level >= 5 ? { slot3: 1 } : {}, ...extra };
}
function playerSpecFrom(def, p) {
  return { ball: def.id, isPlayer: true, level: p.level || 1, evo: p.evo || 0, up: { ...(p.up || {}) }, tree: { ...(p.tree || {}) }, allUnlocked: !!(def.adminOnly || def.unlockAll), playerDiff: 'hard', cos: p.cos || null };
}
const pickWith = (list, rnd) => list[Math.floor(rnd() * list.length) % list.length];
/** createTicket(setup, playerProgress, rnd, extra) → ticket (plain JSON) */
function createTicket(setup, prog0, rnd, extra = {}) {
  const S = setup, diff = normDiff(S.difficulty), D = DIFF[diff], me = getBall(S.ball);
  if (!me) throw new Error('Unknown ball');
  const pl = playerSpecFrom(me, prog0), plv = pl.level, elv = plv + D.lvl;
  if (((S.adminTest && me.adminOnly) || (S.godTest && me.godBall)) && me.supreme && S.startForm) pl.startForm = clamp(S.startForm | 0, 0, 2);   // test battles: start in a chosen form
  const pool = opponentPool(false).filter(b => !b.adminOnly && !b.fusion).map(b => b.id);
  const choose = excl => { const c = pool.filter(id => !excl.includes(id)); return pickWith(c.length ? c : pool, rnd); };
  const chosen = S.enemy && S.enemy !== 'random' && getBall(S.enemy) ? S.enemy : null;
  const E = (id, lv, ex) => enemySpec(getBall(id), lv, diff, ex);
  let teams;
  switch (S.mode) {
    case '2v2': { const ally = S.ally && S.ally !== 'random' && getBall(S.ally) ? S.ally : choose([me.id]); teams = [[pl, enemySpec(getBall(ally), plv, diff === 'easy' ? 'normal' : diff)], [E(chosen || choose([me.id]), elv), E(choose([me.id]), elv)]]; break; }
    case 'ffa': { teams = [[pl]]; const used = [me.id]; for (let i = 1; i < clamp(S.ffaCount || 4, 3, 6); i++) { const id = i === 1 && chosen ? chosen : choose(used); used.push(id); teams.push([E(id, elv)]); } break; }
    case 'boss': teams = [[pl], [E(getBall(S.boss) ? S.boss : 'ancientgod', elv + 3, { boss: true, ai: 'boss' })]]; break;
    case 'survival': teams = [[pl], [E(choose([me.id]), plv - 1)]]; break;
    case 'endless': teams = [[pl], [E(choose([me.id]), plv - 2)]]; break;
    case 'practice': teams = [[pl], [E(chosen || choose([me.id]), plv)]]; break;
    case 'tournament': teams = [[pl], [E(extra.opponent, elv + (extra.round || 0))]]; break;
    default: teams = [[pl], [E(chosen || choose([me.id]), elv)]];
  }
  return { v: 2, mode: MODES[S.mode] ? S.mode : '1v1', difficulty: diff, seed: (Math.floor(rnd() * 4294967296) >>> 0), manual: !!S.manual, teams, pool,
    opts: { infinite: !!S.infinite, dummy: !!S.dummy, roundName: extra.roundName || '', round: extra.round || 0, ...(S.adminTest && me.supreme && me.adminOnly ? { adminTest: true } : {}), ...(S.godTest && me.godBall && S.mode === 'practice' ? { godTest: true } : {}) } };
}
/* ---------- online PvP (shared by the game server and the browser) ---------- */
const PVP = { BLOCK: 12, MIN_DELAY: 2, MAX_DELAY: 10 };   // inputs are exchanged in blocks of 12 steps (50 ms)
/** createPvpTicket([{ball, level, evo, up, tree, cos, name}, …x2], seed) → ticket. Both balls run the same strong AI while on AUTO. */
/* online modes: seats per team. Empty seats are played by the AI */
const PVP_MODES = {
  duel: { name: '1 VS 1', ico: '⚔', seats: [0, 1], ranked: true },
  team: { name: '2 VS 2', ico: '👥', seats: [0, 0, 1, 1], ranked: true },
  ffa: { name: '5-PLAYER ARENA', ico: '✺', seats: [0, 1, 2, 3, 4], ranked: true },
  coop: { name: 'CO-OP vs AI', ico: '🤝', seats: [0, 0, 1, 1], humans: 2, ranked: false },
};
/* season rank tiers (season points) */
const RANK_TIERS = [
  { id: 'bronze', name: 'Bronze', min: 0, coins: 300, col: '#cd7f32', ico: '🥉' }, { id: 'silver', name: 'Silver', min: 150, coins: 600, col: '#cfd8dc', ico: '🥈' },
  { id: 'gold', name: 'Gold', min: 350, coins: 1000, col: '#ffd54f', ico: '🥇' }, { id: 'platinum', name: 'Platinum', min: 600, coins: 1600, col: '#80deea', ico: '💠' },
  { id: 'diamond', name: 'Diamond', min: 900, coins: 2500, col: '#82b1ff', ico: '💎' }, { id: 'master', name: 'Master', min: 1250, coins: 3500, col: '#ea80fc', ico: '🔮' },
  { id: 'legend', name: 'Legend', min: 1600, coins: 5000, col: '#ff5252', ico: '👑' },
];
function rankTier(points) {
  let i = 0; while (i + 1 < RANK_TIERS.length && points >= RANK_TIERS[i + 1].min) i++;
  const t = RANK_TIERS[i], nx = RANK_TIERS[i + 1] || null;
  return { ...t, index: i, next: nx, progress: nx ? clamp((points - t.min) / (nx.min - t.min), 0, 1) : 1 };
}
/** createPvpTicket(seats, seed, pmode) → ticket. A seat is a human player { ball, level, evo, up, tree, cos, name, team }
 *  or an AI seat { ai: true, ball, level, evo, tree, name, team }. Human seats get slots 0, 1, 2… in order and fight on AUTO
 *  with the strong AI until their player switches to MANUAL. Without teams, every seat is its own team (1 VS 1). */
function createPvpTicket(players, seed, pmode = 'duel') {
  const teamed = players.some(p => p.team != null), nTeams = teamed ? Math.max(...players.map(p => p.team | 0)) + 1 : players.length;
  const teams = Array.from({ length: nTeams }, () => []); let slot = 0;
  players.forEach((p, i) => {
    const def = getBall(p.ball); if (!def) throw new Error('Ball not available: ' + p.ball);
    const s = playerSpecFrom(def, p), ai = def.ai === 'boss' ? 'intelligent' : (def.ai || 'intelligent');
    let spec;
    if (p.ai) spec = { ...s, isPlayer: false, pvp: false, tag: String(p.name || 'AI').slice(0, 20), ai, diff: 'hard', cos: null };
    else { const sl = slot++; spec = { ...s, isPlayer: false, pvp: true, slot: sl, tag: p.name || 'Player ' + (sl + 1), ai, diff: 'hard' }; }
    teams[teamed ? p.team | 0 : i].push(spec);
  });
  if (teams.some(t => !t.length)) throw new Error('Every team needs at least one ball');
  return { v: 3, mode: 'pvp', pmode, difficulty: 'hard', seed: seed >>> 0, manual: false, teams, pool: [], opts: { pvp: true, pmode } };
}
/** merges both players' input frames for one block into replay entries [step, slot, type, ...args] (same order everywhere) */
function mergePvpBlock(b, frames) {
  const out = [];
  frames.forEach((acts, slot) => { for (const a of acts || []) out.push([b * PVP.BLOCK + a[0] + 1, slot, ...a.slice(1)]); });
  return out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}
/** validates one player's actions for a block: [[offset, type, ...args]] → cleaned copy, or null if invalid */
function cleanPvpActions(list) {
  if (!Array.isArray(list) || list.length > 24) return null;
  const out = [];
  for (const a of list) {
    if (!Array.isArray(a) || !Number.isInteger(a[0]) || a[0] < 0 || a[0] >= PVP.BLOCK) return null;
    switch (a[1]) {
      case 'k': if (!Number.isInteger(a[2]) || a[2] < 0 || a[2] > 6) return null; out.push([a[0], 'k', a[2]]); break;   // up to 6 abilities + a copied one
      case 'u': out.push([a[0], 'u', 0]); break;
      case 'm': out.push([a[0], 'm', a[2] ? 1 : 0]); break;
      case 'x': if (a.length !== 6 || !a.slice(2).every(v => Number.isInteger(v) && v >= -1000 && v <= 1000)) return null; out.push([a[0], 'x', a[2], a[3], a[4], a[5]]); break;   // owner console
      case 's': if (![a[2], a[3]].every(v => Number.isInteger(v) && v >= -100 && v <= 100) || (a[4] !== 0 && a[4] !== 900)) return null; out.push([a[0], 's', a[2], a[3], a[4]]); break;
      default: return null;
    }
  }
  if (out.some((a, i) => i && a[0] < out[i - 1][0])) return null;
  return out;
}
/** buildBattleConfig(ticket, hooks) → Battle config with mode rules (survival waves, endless, practice respawn) */
function buildBattleConfig(T, hooks = {}) {
  const mk = s => ({ ...s, def: getBall(s.ball) });
  for (const t of T.teams) for (const s of t) if (!getBall(s.ball)) throw new Error('Ball not available: ' + s.ball);
  const cfg = { mode: T.mode, difficulty: T.difficulty, seed: T.seed, manual: T.manual, teams: T.teams.map(t => t.map(mk)), infiniteHp: T.mode === 'practice' && !!T.opts.infinite,
    dummy: T.mode === 'practice' && !!T.opts.dummy, roundName: T.opts.roundName, onEnd: hooks.onEnd, replay: hooks.replay, headless: hooks.headless,
    pvp: T.mode === 'pvp', pmode: T.pmode || 'duel', me: hooks.me, net: hooks.net, ranked: !!hooks.ranked, adminTest: !!(T.opts && T.opts.adminTest), godTest: !!(T.opts && T.opts.godTest) };
  const pl = T.teams[0][0], diff = T.difficulty;
  const nextFrom = excl => { const c = T.pool.filter(id => !excl.includes(id)); return pick(c.length ? c : T.pool); };
  if (T.mode === 'survival') cfg.checkEnd = B => {
    if (!B.player.alive) return B.endWith(B.wave > 5, { wave: B.wave, cleared: B.wave - 1 });
    if (!B.fighters.some(f => f.alive && f.team !== 0 && !f.isClone) && !B.spawning) {
      B.spawning = true; B.wave++;
      FX.text(ARENA.cx, ARENA.cy, 'WAVE ' + B.wave, '#ffd54f', 56, { life: 1.6, vy: 0, pop: 2 });
      healFighter(B.player, B.player.maxHp * 0.25);
      after(1.8, () => {
        B.spawning = false; const n = Math.min(3, 1 + Math.floor(B.wave / 4));
        for (let i = 0; i < n; i++) { const s = enemySpec(getBall(nextFrom([pl.ball])), pl.level - 1 + B.wave, diff); s.statMul *= 1 + B.wave * 0.03; B.spawn(mk(s), 1, i, n, 2); }
      });
    }
  };
  if (T.mode === 'endless') { let lv = pl.level - 2; cfg.checkEnd = B => {
    if (!B.player.alive) return B.endWith(B.kills >= 5, { kills: B.kills });
    if (!B.fighters.some(f => f.alive && f.team !== 0 && !f.isClone) && !B.spawning) {
      B.spawning = true; lv++; healFighter(B.player, B.player.maxHp * 0.15);
      after(1.2, () => { B.spawning = false; const s = enemySpec(getBall(nextFrom([pl.ball])), lv, diff); s.statMul *= 1 + B.kills * 0.04; B.spawn(mk(s), 1, 0, 1, 2); });
    }
  }; }
  if (T.mode === 'practice') {
    cfg.onDeath = (B, f) => { if (f.team !== 0) after(1.2, () => { const n = B.spawn(mk(T.teams[1][0]), 1, 0, 1, 2); if (cfg.dummy) { n.ai = null; n.skills = []; } }); };
    cfg.checkEnd = B => { if (!B.player.alive) B.endWith(false); };
  }
  return cfg;
}
/** headless re-simulation used by the server (and by tests) */
function simulateTicket(T, inputs = [], maxSteps = 240 * 60 * 30) {
  const B = new Battle(buildBattleConfig(T, { replay: inputs, headless: true }));
  while (!B.result && B.stepN < maxSteps) B.step(STEP);
  const r = B.result;
  BATTLE = null;
  return r ? { ok: true, win: r.win, step: r.step, time: r.time, kills: r.kills, wave: r.wave, hpPct: r.hpPct, stats: r.stats, rage: r.rage, god: r.god, winner: r.winner, slots: r.slots, places: r.places } : { ok: false, reason: 'timeout', step: B.stepN };
}
/** rewards are computed from a (verified) result — identical on client (guest) and server */
function computeRewards(T, r, opt = {}) {
  if (T.mode === 'practice') return { coins: 0, exp: 0, rp: 0 };
  const D = DIFF[T.difficulty]; let coins = 0, exp = 0, rp = 0;
  switch (T.mode) {
    case '1v1': coins = r.win ? 60 : 15; exp = r.win ? 60 : 20; break;
    case '2v2': coins = r.win ? 70 : 18; exp = r.win ? 60 : 20; break;
    case 'ffa': coins = (r.win ? 100 : 15) + (r.kills || 0) * 10; exp = r.win ? 80 : 25; break;
    case 'boss': coins = r.win ? 320 : 30; exp = r.win ? 200 : 40; break;
    case 'survival': { const c = (r.wave || 1) - 1; coins = 25 * c + 10; exp = 30 * c + 10; rp = c * Math.round(D.rp / 3); break; }
    case 'endless': coins = 22 * (r.kills || 0) + 10; exp = 26 * (r.kills || 0) + 10; rp = (r.kills || 0) * Math.round(D.rp / 3); break;
    case 'tournament': coins = r.win ? 90 : 20; exp = r.win ? 70 : 25; break;
  }
  if (!['survival', 'endless'].includes(T.mode)) rp = r.win ? D.rp * (T.mode === 'boss' ? 2 : 1) : -4;
  const bonus = opt.premium ? 1.25 : 1;
  return { coins: Math.round(coins * D.reward * bonus), exp: Math.round(exp * D.reward * bonus), rp };
}
/* ---------- AI tournament (shared) ---------- */
function createTournament(ballId, rnd) {
  const pool = opponentPool(false).filter(b => !b.adminOnly && !b.fusion && b.id !== ballId).map(b => b.id);
  const players = [{ id: ballId, me: true }];
  while (players.length < 8) { const c = pool.filter(id => !players.some(p => p.id === id)); players.push({ id: pickWith(c.length ? c : pool, rnd) }); }
  for (let i = players.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [players[i], players[j]] = [players[j], players[i]]; }
  return { rounds: [players], round: 0, alive: true, done: false, champion: null };
}
function tournamentOpponent(T) { const list = T.rounds[T.round], idx = list.findIndex(p => p.me); return list[idx % 2 ? idx - 1 : idx + 1].id; }
function quickSim(a, b, lv, rnd) {
  const score = d => (d.hp + d.def * 0.8) * (d.atk + d.spd * 0.4 + d.crit * 0.2) * (1 + 0.022 * lv);
  const sa = score(getBall(a)), sb = score(getBall(b));
  return rnd() < sa / (sa + sb) ? a : b;
}
function advanceTournament(T, playerWon, lv, rnd) {
  const list = T.rounds[T.round], next = [];
  for (let i = 0; i < list.length; i += 2) {
    const a = list[i], b = list[i + 1];
    const w = (a.me || b.me) ? (playerWon ? (a.me ? a : b) : (a.me ? b : a)) : (quickSim(a.id, b.id, lv, rnd) === a.id ? a : b);
    a.res = a === w ? 'w' : 'l'; b.res = b === w ? 'w' : 'l';
    next.push({ id: w.id, me: !!w.me });
  }
  T.round++; T.rounds.push(next);
  if (!playerWon) T.alive = false;
  if (next.length === 1) { T.champion = next[0]; T.done = true; }
  return T;
}
const TOUR_NAMES = ['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'];

/* ---------- cosmetics (visual only — never affect battle results) ---------- */
const COSMETICS = [
  { id: 'aura_crimson', slot: 'aura', name: 'Crimson Aura', color: '#ff1744', price: 800 },
  { id: 'aura_emerald', slot: 'aura', name: 'Emerald Aura', color: '#00e676', price: 800 },
  { id: 'aura_void', slot: 'aura', name: 'Void Aura', color: '#7c4dff', price: 1200 },
  { id: 'aura_gold', slot: 'aura', name: 'Golden Premium Aura', color: '#ffd740', premium: true },
  { id: 'skin_shadow', slot: 'skin', name: 'Shadow Skin', tint: '#000000', amt: 0.4, price: 1500 },
  { id: 'skin_neon', slot: 'skin', name: 'Neon Skin', tint: '#00e5ff', amt: 0.3, price: 1500 },
  { id: 'skin_gold', slot: 'skin', name: 'Gilded Premium Skin', tint: '#ffd54f', amt: 0.38, premium: true },
  { id: 'trail_comet', slot: 'trail', name: 'Comet Trail', color: '#ff9100', price: 600 },
  { id: 'trail_stardust', slot: 'trail', name: 'Stardust Trail', color: '#ffffff', price: 900 },
  { id: 'trail_pixel', slot: 'trail', name: 'Pixel Trail', color: '#00ff9f', price: 900 },
  { id: 'trail_prism', slot: 'trail', name: 'Prism Premium Trail', color: 'rainbow', premium: true },
  { id: 'hit_stars', slot: 'hit', name: 'Star Burst Hits', color: '#ffea00', price: 700 },
  { id: 'hit_glitch', slot: 'hit', name: 'Glitch Hits', color: '#ff00e6', price: 900 },
  { id: 'hit_holy', slot: 'hit', name: 'Holy Premium Hits', color: '#fff59d', premium: true },
  { id: 'win_confetti', slot: 'victory', name: 'Confetti Victory', price: 700 },
  { id: 'win_fireworks', slot: 'victory', name: 'Fireworks Victory', price: 1000 },
  { id: 'win_supernova', slot: 'victory', name: 'Supernova Premium Victory', premium: true },
];
const COSMETIC_SLOTS = { aura: 'Aura colour', skin: 'Ball skin', trail: 'Trail', hit: 'Collision effect', victory: 'Victory effect' };
/* ---------- 7-day daily login rewards (premium: +50% coins) ---------- */
const DAILY_REWARDS = [{ coins: 100 }, { coins: 150 }, { exp: 150 }, { coins: 250 }, { cosmetic: 'trail_stardust', coins: 200 }, { coins: 400 }, { coins: 600, exp: 300 }];
/* ---------- ball fusion: two eligible balls → a brand-new spherical form (originals are kept) ---------- */
const FUSION_COST = 2000, FUSION_MIN_LEVEL = 10, FUSION_MAX = 12;
function fusionEligible(b) { return !!b && !b.adminOnly && !b.limited && !b.premium && !b.fusion && !b.draft; }
function makeFusionDef(a, b, id) {
  const ri = r => RARITIES.indexOf(r), rar = RARITIES[Math.min(ri('God Tier'), Math.max(ri(a.rarity), ri(b.rarity)) + 1)];
  const avg = k => Math.round((a[k] + b[k]) / 2 * 1.12);
  const short = n => n.replace(/ Ball$/, '');
  const s2 = a.skills[1] || a.skills[0], e2 = (b.skills[1] || b.skills[0]);
  const fused = { name: 'Fusion ' + (e2.name.split(' ').pop()), type: s2.type, cd: Math.round((s2.cd + e2.cd) / 2 * 2) / 2, power: Math.max(s2.power, e2.power) + 10, color: mixColor(a.design.c3, b.design.c3, 0.5), effect: e2.effect || s2.effect || 'none' };
  if (s2.count || e2.count) fused.count = Math.max(s2.count || 0, e2.count || 0) || 3;
  const ult = (a.ult.power >= b.ult.power ? a.ult : b.ult);
  return {
    id, name: `${short(a.name)}-${short(b.name)} Fusion Ball`, category: 'Fusion', rarity: rar, fusion: true, parents: [a.id, b.id],
    hp: avg('hp'), atk: avg('atk'), def: avg('def'), spd: avg('spd'), crit: Math.min(100, avg('crit')),
    design: { c1: a.design.c1, c2: b.design.c2, c3: mixColor(a.design.c3, b.design.c3, 0.5), pat: a.design.pat, deco: [...new Set([...(a.design.deco || []), ...(b.design.deco || []), 'ring'])].slice(0, 4), sym: '', glow: 1.3, sfx: { wave: sfxOf(a).wave, pitch: Math.round((sfxOf(a).pitch + sfxOf(b).pitch) / 2 * 100) / 100 } },
    skills: [{ ...a.skills[0] }, { ...b.skills[0] }, fused],
    ult: { ...ult, name: short(a.name).toUpperCase() + '-' + short(b.name).toUpperCase() + ' FUSION', power: ult.power + 10 },
    ai: a.ai, godMode: !!(a.godMode || b.godMode), desc: `A fusion of ${a.name} and ${b.name}. Both originals remain in the collection.`,
    ...(a.adminOnly || b.adminOnly ? { adminOnly: true } : {}),          // a fusion with an admin ball stays admin-exclusive
  };
}

/* =====================================================================
   GAME CONTROLLER (client) — guest mode runs locally; signed-in players
   get tickets from the server and the server verifies every result.
   ===================================================================== */
const online = () => !!(window.Online && window.Online.active);
const Game = {
  setup: { mode: '1v1', ball: 'fire', enemy: 'random', difficulty: 'normal', ffaCount: 4, boss: 'ancientgod', infinite: true, dummy: false, ally: 'random' },
  tour: null, demoTimer: 0, ticket: null, busy: false,
  async start(mode) {
    if (this.busy) return;
    Sound.init(); if (SAVE.settings.musicOn) Sound.startMusic();
    const S = this.setup; S.mode = mode; S.difficulty = normDiff(S.difficulty); S.manual = SAVE.settings.control === 'manual';
    if (mode === 'tournament') return this.startTournament();
    if (!S.trial) { SAVE.last = { ball: S.ball, enemy: S.enemy, difficulty: S.difficulty }; persist(); }
    if (S.trial && mode !== 'practice') S.trial = false;
    let ticket;
    try {
      this.busy = true;
      ticket = online() ? await window.Online.startBattle(S) : createTicket(S, S.trial ? { level: 10, evo: 1, tree: { slot3: 1, slot4: 1 } } : prog(S.ball), Math.random);
      S.trial = false;
    } catch (e) { toast('⚠ ' + esc(e.message || 'Could not start battle'), 'bad'); return; } finally { this.busy = false; }
    if (ticket) this.launch(ticket);
  },
  launch(ticket) {
    UI.hideAll(); $('#battleHud').classList.remove('hidden');
    this.ticket = ticket;
    new Battle(buildBattleConfig(ticket, { onEnd: (r, b) => this.endBattle(r, b) }));
    UI.syncHud();
  },
  /* premium trial / demo: play any non-admin ball in Practice (no rewards) */
  tryBall(id) {
    const b = getBall(id); if (!b || b.adminOnly) return;
    Object.assign(this.setup, { ball: id, enemy: 'random', dummy: false, infinite: false, trial: true });
    this.start('practice');
  },
  async startTournament() {
    const S = this.setup;
    try { this.tour = online() ? await window.Online.tourStart(S) : createTournament(S.ball, Math.random); }
    catch (e) { return toast('⚠ ' + esc(e.message), 'bad'); }
    if (this.tour) UI.show('bracket');
  },
  async tourMatch() {
    const T = this.tour, S = this.setup; if (!T) return;
    let ticket;
    try {
      ticket = online() ? await window.Online.tourTicket(S) : createTicket({ ...S, mode: 'tournament', manual: SAVE.settings.control === 'manual' }, prog(S.ball), Math.random, { opponent: tournamentOpponent(T), round: T.round, roundName: TOUR_NAMES[T.round] });
    } catch (e) { return toast('⚠ ' + esc(e.message), 'bad'); }
    if (ticket) this.launch(ticket);
  },
  async endBattle(r, B) {
    $('#battleHud').classList.add('hidden');
    const T = this.ticket;
    if (online() && T && T.id) {
      UI.showResults({ ...r, pending: true, ballId: T.teams[0][0].ball, coins: 0, exp: 0 }, B);
      try { const res = await window.Online.finishBattle(T, B); Sound.play(res.win ? 'win' : 'lose'); UI.showResults(res, B); }
      catch (e) { toast('⚠ ' + esc(e.message || 'Result could not be verified'), 'bad'); UI.showResults({ ...r, ballId: T.teams[0][0].ball, coins: 0, exp: 0, extraMsg: 'Result not verified — no rewards' }, B); }
      return;
    }
    // guest mode: rewards applied locally (guest progress stays on this device)
    const S = this.setup, id = T.teams[0][0].ball, mode = r.mode, st = SAVE.stats;
    const rw = computeRewards(T, r);
    let { coins, exp } = rw, tourMsg = '', extraMsg = '';
    if (mode !== 'practice') {
      st.battles++;
      const pp = prog(id);
      if (r.win) { st.wins++; pp.wins++; if (T.difficulty === 'godlike') st.insaneWins++; for (const ev of activeEvents()) evProg(ev.id).wins++; if (mode === '1v1' && r.hpPct >= 0.9) st.perfect = (st.perfect || 0) + 1; }
      else { st.losses++; pp.losses++; }
      if (mode === 'boss' && r.win) st.bossWins++;
      if (mode === 'survival') { st.survivalBest = Math.max(st.survivalBest, r.wave || 1); extraMsg = `Reached wave ${r.wave}`; }
      if (mode === 'endless') { st.endlessBest = Math.max(st.endlessBest, r.kills); extraMsg = `${r.kills} KOs`; }
    }
    if (mode === 'tournament' && this.tour) {
      advanceTournament(this.tour, r.win, prog(id).level, Math.random);
      if (this.tour.done && this.tour.champion?.me) { st.tourneyWins++; const b = Math.round(600 * DIFF[T.difficulty].reward); coins += b; exp += 200; tourMsg = '🏆 TOURNAMENT CHAMPION! +' + b + ' bonus coins'; }
      else if (!r.win) tourMsg = 'Eliminated in the ' + (['quarter-finals', 'semi-finals', 'final'][this.tour.round - 1] || 'tournament');
    }
    const ups = giveExp(id, exp); addCoins(coins);
    persist(); checkAchievements();
    Sound.play(r.win ? 'win' : 'lose');
    UI.showResults({ ...r, coins, exp, ups, extraMsg, tourMsg, ballId: id, level: prog(id).level }, B);
  },
  demo() {
    if (BATTLE && !BATTLE.cfg.demo && !BATTLE.over) return;
    const pool = opponentPool(false).filter(b => !b.adminOnly), a = pool[Math.floor(Math.random() * pool.length)], b = pool.filter(x => x.id !== a.id)[Math.floor(Math.random() * (pool.length - 1))];
    const T = { v: 2, mode: '1v1', difficulty: 'hard', seed: (Math.random() * 4294967296) >>> 0, manual: false, teams: [[enemySpec(a, 20, 'hard')], [enemySpec(b, 20, 'hard')]], pool: [], opts: {} };
    const cfg = buildBattleConfig(T, { onEnd: () => { this.demoTimer = 0.5; } }); cfg.demo = true;
    new Battle(cfg);
  },
};

/* =====================================================================
   12. UI SCREENS
   ===================================================================== */
const PARENT = { pvp: 'menu', play: 'menu', select: 'play', collection: 'menu', shop: 'menu', events: 'menu', admin: 'menu', creator: 'admin', settings: 'menu', bracket: 'menu', results: 'menu', account: 'menu', profile: 'menu', membership: 'menu', leaderboard: 'menu', fusion: 'menu' };
function ballCanvas(def, size = 84, opts = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = h('canvas', { width: Math.round(size * dpr), height: Math.round(size * dpr), style: { width: size + 'px', height: size + 'px' } });
  try { drawPreview(c, def, { ...opts, size }); } catch (e) { console.warn(e); }
  return c;
}
function rarityBadge(r) { return `<span class="rar ${rarClass(r)}">${esc(r)}</span>`; }
function statBar(label, val, max, extra = '') { return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${clamp(val / max * 100, 2, 100)}%"></i></div><b>${Math.round(val)}${extra}</b></div>`; }

const UI = {
  current: 'menu', live: [], clockTimer: 0, returnTo: null,
  init() {
    document.addEventListener('click', e => {
      const go = e.target.closest('[data-go]'); if (go) { Sound.init(); Sound.play('click'); this.show(go.dataset.go); }
      const bk = e.target.closest('[data-back]'); if (bk) { Sound.play('click'); this.back(); }
    });
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !this.modalLocked) this.closeModal(); });
    $('#btnPause').onclick = () => BATTLE && BATTLE.togglePause();
    $('#btnSpeed').onclick = () => { if (!BATTLE) return; const sp = [1, 1.5, 2, 3]; BATTLE.speed = sp[(sp.indexOf(BATTLE.speed) + 1) % sp.length]; SAVE.settings.speed = BATTLE.speed; persist(); this.syncHud(); };
    $('#btnAuto').onclick = () => toggleControl();
    $('#rotateDismiss').onclick = () => document.body.classList.add('rotate-ok');
  },
  show(name) {
    if (name === 'admin' && !isAdmin()) return this.adminLogin();
    $$('.screen').forEach(s => s.classList.remove('active'));
    const el = $('#scr-' + name); if (!el) return;
    el.classList.add('active'); this.current = name; this.live = []; clearInterval(this.clockTimer);
    if (BATTLE && !BATTLE.cfg.demo && !BATTLE.over && name !== 'results') { BATTLE = null; FX.reset(); }
    if (!BATTLE || BATTLE.over && !BATTLE.cfg.demo) Game.demo();
    $('#battleHud').classList.add('hidden');
    refreshCoins();
    const fn = this['render_' + name]; if (fn) fn.call(this);
    el.querySelector('.scr-body')?.scrollTo?.(0, 0);
  },
  hideAll() { $$('.screen').forEach(s => s.classList.remove('active')); this.current = null; this.live = []; clearInterval(this.clockTimer); this.closeModal(); },
  back() { if (this.current === 'bracket' && Game.tour && !Game.tour.done && Game.tour.alive) return this.confirm('Quit the tournament? Progress in this bracket will be lost.', () => { Game.tour = null; this.show('menu'); }); this.show(PARENT[this.current] || 'menu'); },
  modal(content, cls = '') {
    const box = $('#modalBox'); box.className = 'modal-box ' + cls; box.innerHTML = '';
    box.append(h('button', { class: 'close', onclick: () => this.closeModal() }, '×'));
    if (typeof content === 'string') box.insertAdjacentHTML('beforeend', content); else box.append(content);
    $('#modal').classList.remove('hidden'); return box;
  },
  closeModal() { $('#modal').classList.add('hidden'); this.modalLocked = false; this.live = this.live.filter(l => !l.modal); },
  confirm(msg, yes, yesLabel = 'Confirm') {
    const box = this.modal(`<h3>${msg}</h3>`);
    box.append(h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: () => this.closeModal() }, 'Cancel'), h('button', { class: 'btn danger', onclick: () => { this.closeModal(); yes(); } }, yesLabel)));
  },
  addLive(canvas, def, opts = {}) { this.live.push({ canvas, def, opts, rot: 0 }); },
  tickLive(dt) {
    for (const l of this.live) {
      if (!l.canvas.isConnected) continue;
      l.rot += dt * (l.opts.spin || 1.2);
      if (l.opts.draw) l.opts.draw(l, dt); else drawPreview(l.canvas, l.def, { ...l.opts, t: now(), rot: l.rot });
    }
  },

  /* ---------------- MAIN MENU ---------------- */
  render_menu() {
    $('#menuOwned').textContent = `◉ ${ownedCount()} balls`;
    $('#menuWins').textContent = `🏆 ${SAVE.stats.wins} wins`;
    const ev = activeEvents()[0], an = $('#menuAnnounce');
    const upd = () => { an.innerHTML = SAVE.announcement ? `📢 ${esc(SAVE.announcement)}` : ev ? `✦ LIMITED EVENT: <b>${esc(ev.name)}</b> — ${esc(getBall(ev.ball)?.name)} available! Ends in <b>${fmtTime((ev.end - Date.now()) / 1000)}</b>` : ''; };
    upd(); this.clockTimer = setInterval(upd, 1000);
    an.onclick = () => this.show('events');
    $('.btn.admin', $('#scr-menu')).innerHTML = isAdmin() ? '♛ Admin Dashboard' : '🔒 Admin Dashboard';
  },

  /* ---------------- MODE SELECT ---------------- */
  render_play() {
    const g = $('#modeGrid'); g.innerHTML = '';
    for (const [id, m] of Object.entries(MODES)) {
      if (m.online) continue;
      g.append(h('div', { class: 'mode-card' + (m.main ? ' main' : ''), onclick: () => { Sound.play('click'); Game.setup.mode = id; this.show('select'); } },
        m.main ? h('span', { class: 'tag' }, 'MAIN MODE') : null, h('div', { class: 'ico' }, m.ico), h('h3', {}, m.name), h('p', {}, m.desc)));
    }
  },

  /* ---------------- BALL SELECTION ---------------- */
  selTab: 'owned',
  render_select() {
    const S = Game.setup;
    S.difficulty = S.difficulty || SAVE.settings.difficulty;
    if (!getBall(S.ball) || !playableBalls().some(b => b.id === S.ball)) S.ball = playableBalls().find(b => b.id === SAVE.last.ball)?.id || playableBalls()[0]?.id;
    $('#selectTitle').textContent = 'Ball Selection — ' + MODES[S.mode].name;
    const tabs = $('#selectTabs'); tabs.innerHTML = '';
    const tabList = [['owned', 'My Balls'], ...CATEGORIES.filter(c => c !== 'Admin' && (c !== 'Fusion' || allBalls().some(b => b.fusion))).map(c => [c, c])];
    if (isAdmin()) tabList.push(['admin', '♛ ADMIN']);
    for (const [k, l] of tabList) tabs.append(h('button', { class: 'tab' + (this.selTab === k ? ' active' : '') + (k === 'admin' ? ' admin-tab' : ''), onclick: () => { this.selTab = k; this.render_select(); } }, l));
    const grid = $('#selectGrid'); grid.innerHTML = '';
    this.renderFeatured(grid);
    let list = playableBalls();
    if (this.selTab === 'admin') list = list.filter(b => b.adminOnly);
    else if (this.selTab !== 'owned') list = list.filter(b => b.category === this.selTab && !b.adminOnly);
    else list = list.filter(b => !b.adminOnly);
    if (!list.length) grid.append(h('p', { class: 'muted' }, this.selTab === 'admin' ? 'No admin balls.' : 'No balls here yet — unlock more in the Collection or Shop.'));
    for (const b of list) grid.append(this.ballCard(b, { selected: b.id === S.ball, onclick: () => { S.ball = b.id; Sound.play('click'); this.render_select(); } }));
    this.renderSetup();
  },
  /* the update's three new balls, always shown with their unlock status */
  renderFeatured(grid) {
    let box = $('#selectFeatured');
    if (!box) { box = h('div', { id: 'selectFeatured', class: 'featured' }); grid.parentNode.insertBefore(box, grid); }
    box.innerHTML = '';
    const list = UPDATE_BALLS.map(b => getBall(b.id)).filter(b => b && b.enabled !== false);
    if (!list.length) { box.remove(); return; }
    const row = h('div', { class: 'feat-row' });
    for (const b of list) {
      const ok = canUseBall(b), status = b.free ? 'FREE — UNLOCKED' : ok ? 'PREMIUM — UNLOCKED' : 'PREMIUM — LOCKED';
      const cv = ballCanvas(b, 60); this.addLive(cv, b, { size: 60 });
      row.append(h('button', { class: 'feat-card' + (Game.setup.ball === b.id ? ' selected' : '') + (ok ? '' : ' locked'), title: b.desc || '', onclick: () => { if (ok) { Game.setup.ball = b.id; Sound.play('click'); this.render_select(); } else this.openDetail(b.id); } },
        cv, h('div', { class: 'feat-txt' }, h('small', {}, b.techNo ? 'TECH BALL ' + b.techNo : 'SECRET • NEW'), h('b', {}, (b.techNo ? b.name.replace(/ Ball$/, '') : b.name).toUpperCase()),
          h('span', { class: 'feat-st ' + (b.free ? 'free' : ok ? 'on' : 'off') }, (ok ? '' : '🔒 ') + status))));
    }
    box.append(h('div', { class: 'feat-title' }, '✦ NEW UPDATE — ANTI BALL & TECH BALLS'), row);
  },
  renderSetup() {
    const S = Game.setup, box = $('#selectSetup'); box.innerHTML = '';
    const me = getBall(S.ball); if (!me) return;
    const p = prog(me.id), card = h('div', { class: 'card setup-card' });
    const myC = ballCanvas(me, 150, { evo: p.evo, big: true }); this.addLive(myC, me, { evo: p.evo, size: 150 });
    const oppPool = opponentPool(isAdmin()).filter(b => b.id !== me.id);
    const opp = S.enemy !== 'random' ? getBall(S.enemy) : null;
    const oppC = opp ? ballCanvas(opp, 110) : h('div', { style: { width: '110px', height: '110px', display: 'grid', placeItems: 'center', fontSize: '54px', color: '#8fa3cf' } }, '?');
    if (opp) this.addLive(oppC, opp, { size: 110 });
    card.append(h('div', { class: 'vs-line' }, myC, h('b', {}, 'VS'), oppC));
    card.insertAdjacentHTML('beforeend', `<div style="text-align:center"><h3 style="margin:0">${esc(evoName(me, p.evo))}</h3>${rarityBadge(me.rarity)} <span class="muted">Lv ${p.level} • ${esc(me.ai)} AI</span></div>`);
    const sel = (label, value, opts, onchange) => { const s = h('select', { onchange: e => onchange(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l))); return h('label', { class: 'field' }, h('span', {}, label), s); };
    if (S.mode !== 'tournament' && S.mode !== 'boss' && S.mode !== 'survival' && S.mode !== 'endless')
      card.append(sel(S.mode === 'ffa' ? 'Featured opponent' : 'Opponent', S.enemy, [['random', '🎲 Random opponent'], ...oppPool.map(b => [b.id, `${b.name} (${b.rarity})`])], v => { S.enemy = v; this.renderSetup(); }));
    if (S.mode === '2v2') card.append(sel('Ally', S.ally, [['random', '🎲 Random ally'], ...oppPool.map(b => [b.id, b.name])], v => { S.ally = v; }));
    if (S.mode === 'boss') card.append(sel('Boss', S.boss, opponentPool(isAdmin()).filter(b => ['God Tier', 'Secret', 'Ancient', 'Mythical', 'Admin Exclusive'].includes(b.rarity)).map(b => [b.id, b.name + ' — ' + b.rarity]), v => { S.boss = v; }));
    if (S.mode === 'ffa') { const o = h('div', { class: 'opts' }); [3, 4, 5, 6].forEach(n => o.append(h('button', { class: 'opt' + (S.ffaCount === n ? ' active' : ''), onclick: () => { S.ffaCount = n; this.renderSetup(); } }, n + ' balls'))); card.append(h('div', { class: 'field' }, h('span', {}, 'Balls in arena'), o)); }
    if (S.mode === 'practice') card.append(h('div', {}, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.infinite, onchange: e => S.infinite = e.target.checked }), 'Opponent infinite HP'), h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.dummy, onchange: e => S.dummy = e.target.checked }), 'Dummy (no AI)')));
    const d = h('div', { class: 'opts' });
    for (const k of Object.keys(DIFF)) d.append(h('button', { class: 'opt' + (S.difficulty === k ? ' active' : ''), onclick: () => { S.difficulty = k; this.renderSetup(); } }, DIFF[k].label));
    card.append(h('div', { class: 'field' }, h('span', {}, 'AI difficulty (enemy level ' + (DIFF[S.difficulty].lvl >= 0 ? '+' : '') + DIFF[S.difficulty].lvl + ', rewards ×' + DIFF[S.difficulty].reward + ')'), d));
    const ctl = h('div', { class: 'opts' });
    [['auto', '🤖 Auto battle'], ['manual', '🎮 Manual skills']].forEach(([k, l]) => ctl.append(h('button', { class: 'opt' + (SAVE.settings.control === k ? ' active' : ''), onclick: () => { SAVE.settings.control = k; persist(); this.renderSetup(); } }, l)));
    card.append(h('div', { class: 'field' }, h('span', {}, 'Your ball control'), ctl));
    if (SAVE.settings.control === 'manual') card.append(h('p', { class: 'muted', style: { fontSize: '12px', margin: 0 } }, 'Manual: steer with WASD/arrows or drag in the arena. Abilities 1-6, ultimate SPACE, or use the on-screen buttons.'));
    card.append(h('button', { class: 'btn big primary', onclick: () => { Sound.init(); Sound.play('click'); Game.start(S.mode); } }, '⚔ START BATTLE'));
    box.append(card);
  },
  ballCard(b, o = {}) {
    const p = prog(b.id), owned = canUseBall(b);
    const c = h('div', { class: 'ball-card' + (o.selected ? ' selected' : '') + (!owned && o.showLock ? ' locked' : '') + (!b.enabled ? ' disabled' : ''), onclick: o.onclick, title: b.desc || '' });
    c.append(ballCanvas(b, 84, { evo: owned ? p.evo : 0 }));
    if (owned && !b.adminOnly) c.append(h('span', { class: 'lv' }, 'Lv ' + p.level));
    if (p.evo) c.append(h('span', { class: 'evo' }, '★'.repeat(p.evo)));
    if (!owned && o.showLock) c.append(h('div', { class: 'lock' }, b.adminOnly ? '♛ ADMIN' : b.premium ? '★ PREMIUM' : b.limited ? '⏳ EVENT' : '🔒 ' + fmtNum(RARITY_INFO[b.rarity]?.price || 1000)));
    if (owned && !p.owned && !b.adminOnly && !b.free && isPremium()) c.append(h('span', { class: 'evo', title: 'Unlocked by Ultimate Premium' }, '★P'));
    if (b.free) c.append(h('span', { class: 'tag-free' }, 'FREE'));
    if (b.isNew) c.append(h('span', { class: 'tag-new' }, 'NEW'));
    c.append(h('div', { class: 'nm' }, b.name), h('div', { class: 'rar ' + rarClass(b.rarity) }, b.rarity));
    return c;
  },

  /* ---------------- COLLECTION ---------------- */
  coll: { cat: 'all', rar: 'all', status: 'all', q: '' },
  render_collection() {
    const C = this.coll, f = $('#collFilters'); f.innerHTML = '';
    const sel = (key, opts) => h('select', { onchange: e => { C[key] = e.target.value; this.renderCollGrid(); } }, opts.map(([v, l]) => h('option', { value: v, selected: C[key] === v }, l)));
    f.append(sel('cat', [['all', 'All categories'], ...CATEGORIES.map(c => [c, c])]), sel('rar', [['all', 'All rarities'], ...RARITIES.map(r => [r, r])]), sel('status', [['all', 'All'], ['owned', 'Owned'], ['locked', 'Locked']]),
      h('input', { type: 'text', placeholder: '🔍 Search balls…', value: C.q, oninput: e => { C.q = e.target.value.toLowerCase(); this.renderCollGrid(); } }));
    this.renderCollGrid();
  },
  renderCollGrid() {
    const C = this.coll, g = $('#collGrid'); g.innerHTML = '';
    const list = allBalls().filter(b => !b.summonOnly && (isAdmin() || (!b.adminOnly && b.enabled)) && (C.cat === 'all' || b.category === C.cat) && (C.rar === 'all' || b.rarity === C.rar) &&
      (C.status === 'all' || (C.status === 'owned') === !!prog(b.id).owned) && (!C.q || b.name.toLowerCase().includes(C.q)));
    $('#collCount').textContent = `${ownedCount()} / ${allBalls().filter(b => !b.adminOnly && b.enabled).length} owned`;
    for (const b of list) g.append(this.ballCard(b, { showLock: true, onclick: () => this.openDetail(b.id) }));
    if (!list.length) g.append(h('p', { class: 'muted' }, 'No balls match these filters.'));
  },
  openDetail(id) {
    const b = getBall(id); if (!b) return;
    const p = prog(id), owned = canUseBall(b);
    const wrap = h('div', { class: 'detail' }), L = h('div', { class: 'detail-left' }), R = h('div');
    const cv = ballCanvas(b, 260, { evo: p.evo, big: true }); this.live = this.live.filter(l => !l.modal); this.live.push({ canvas: cv, def: b, opts: { evo: p.evo, size: 260, big: true }, rot: 0, modal: true });
    L.append(cv);
    L.insertAdjacentHTML('beforeend', `<h2>${esc(evoName(b, owned ? p.evo : 0))}</h2><div>${rarityBadge(b.rarity)} <span class="muted">• ${esc(b.category)}${b.limited ? ' • LIMITED' : ''}${b.custom ? ' • CUSTOM' : ''}</span></div><p class="muted" style="font-size:13px">${esc(b.desc || 'A powerful battle sphere.')}</p>`);
    if (b.godMode) L.insertAdjacentHTML('beforeend', `<p style="font-size:13px;color:#ffd54f">✦ God Mode eligible — transforms into <b>${esc(b.godName || 'GOD ' + b.name.toUpperCase())}</b> on its first ultimate.</p>`);
    if (b.free || b.techNo) L.insertAdjacentHTML('beforeend', `<p style="font-size:13px;font-weight:800;color:${b.free ? '#69f0ae' : owned ? '#ffd54f' : '#ff8a80'}">${b.free ? '✔ FREE — UNLOCKED for every player' : owned ? '★ PREMIUM — UNLOCKED' : '🔒 PREMIUM — LOCKED (needs an active Ultimate Premium membership)'}</p>`);
    const btns = h('div', { class: 'row', style: { justifyContent: 'center' } });
    if (owned && b.isNew) btns.append(h('button', { class: 'btn', onclick: () => { this.closeModal(); Game.tryBall(id); } }, '▶ Ability showcase'));
    if (!owned) {
      if (b.adminOnly) btns.append(h('p', { class: 'muted' }, '♛ Admin exclusive — only the verified game owner can use this ball.'));
      else if (b.premium) btns.append(h('p', { class: 'muted', style: { width: '100%' } }, '★ Premium ball — included with ULTIMATE PREMIUM ($200 / year).'),
        h('button', { class: 'btn gold', onclick: () => { this.closeModal(); this.show('membership'); } }, '★ View Premium'),
        h('button', { class: 'btn', onclick: () => { this.closeModal(); Game.tryBall(id); } }, '▶ Try in Practice'));
      else if (b.limited) { const ev = currentEventFor(b.id); btns.append(h('button', { class: 'btn', onclick: () => { this.closeModal(); this.show('events'); } }, ev ? '⏳ Available in event now!' : '⏳ Event exclusive')); }
      else { const price = RARITY_INFO[b.rarity]?.price || 1000; btns.append(h('button', { class: 'btn gold', disabled: SAVE.coins < price, onclick: () => act(() => Econ.unlock(id), () => { toast(`🔓 <b>${esc(b.name)}</b> unlocked!`, 'gold'); this.openDetail(id); this.refreshCurrent(); }) }, `🔓 Unlock — 🪙 ${fmtNum(price)}`)); }
    } else {
      const nx = EVO[p.evo + 1];
      if (nx && !b.adminOnly) btns.append(h('button', { class: 'btn gold', disabled: !canEvolve(id), title: `Requires level ${nx.lvl}`, onclick: () => this.evolve(id) }, `✦ Evolve → ${nx.name} (Lv ${nx.lvl}, 🪙 ${fmtNum(nx.cost)})`));
      btns.append(h('button', { class: 'btn primary', onclick: () => { Game.setup.ball = id; this.closeModal(); this.show('play'); } }, '⚔ Battle'));
      if (!p.owned && !b.adminOnly) btns.append(h('p', { class: 'muted', style: { width: '100%', fontSize: '12px' } }, '★ Unlocked by your Ultimate Premium membership.'));
      if (p.maxed) btns.append(h('p', { class: 'muted', style: { width: '100%', fontSize: '12px', color: '#ffd54f' } }, '★ Premium ball: always at full power for Premium members — Lv 50, fully evolved, every upgrade and ability.'));
      else btns.append(h('button', { class: 'btn', onclick: () => { this.closeModal(); this.show('shop'); this.shopBall = id; this.render_shop(); } }, '⬆ Upgrade'));
    }
    L.append(btns);
    // right column
    const f = new Fighter(b, { level: p.level, evo: p.evo, up: p.up, tree: p.tree });
    let html = '';
    if (owned && !b.adminOnly) html += `<div class="row" style="justify-content:space-between"><b>Level ${p.level}${p.level >= MAX_LVL ? ' (MAX)' : ''}</b><span class="muted">${p.exp} / ${expNeed(p.level)} EXP • ${p.sp} skill points • ${p.wins}W / ${p.losses}L</span></div><div class="bar exp"><i style="width:${p.exp / expNeed(p.level) * 100}%"></i></div>`;
    html += `<h3 style="margin-top:12px">Stats</h3>${statBar('HP', f.maxHp, 260)}${statBar('ATK', f.atk, 160)}${statBar('DEF', f.dfn, 160)}${statBar('SPD', f.spd, 140)}${statBar('CRIT', f.crit, 100, '%')}`;
    html += `<h3 style="margin-top:12px">Abilities</h3>`;
    (b.skills || []).forEach((s, i) => {
      const locked = !b.adminOnly && !b.unlockAll && !s.always && ((i === 2 && !p.tree.slot3) || (i >= 3 && !p.tree.slot4));
      html += `<div class="skill-row ${locked ? 'locked' : ''}"><div class="sico" style="color:${esc(s.color)};background:${rgba(s.color, 0.25)}">${SKILL_TYPES[s.type]?.ico || '•'}</div><div><div class="sname">${esc(s.name)} ${locked ? '🔒' : ''}</div><div class="sdesc">${esc(SKILL_TYPES[s.type]?.label || s.type)} — ${esc(SKILL_TYPES[s.type]?.desc || '')}. Power ${s.power}, cooldown ${s.cd}s${s.effect && s.effect !== 'none' ? ', effect: ' + esc(s.effect) : ''}${locked ? ` — unlock in the skill tree (${i === 2 ? 'Lv 5' : 'Lv 12'})` : ''}</div></div></div>`;
    });
    if (b.ult) html += `<div class="skill-row" style="border:1px solid #ffd54f55"><div class="sico" style="color:#ffd54f;background:#ffd54f33">★</div><div><div class="sname">ULTIMATE: ${esc(b.ult.name)}</div><div class="sdesc">${esc(ULT_TYPES[b.ult.type] || b.ult.type)} — power ${b.ult.power}. Charges from time, damage dealt and damage taken.</div></div></div>`;
    if (b.passiveInfo) html += `<div class="skill-row" style="border:1px solid #b388ff55"><div class="sico" style="color:#b388ff;background:#b388ff33">◆</div><div><div class="sname">PASSIVE: ${esc(b.passiveInfo.name)}</div><div class="sdesc">${esc(b.passiveInfo.desc)}</div></div></div>`;
    html += `<p class="muted" style="font-size:12px">AI personality: <b>${esc(b.ai)}</b> • Rage Mode at ${RAGE_HP} HP or below (+attack, +speed, faster cooldowns).</p>`;
    R.insertAdjacentHTML('beforeend', html);
    if (owned && !b.adminOnly) {
      R.append(h('h3', {}, 'Skill Tree'));
      const tree = h('div', { class: 'tree' });
      for (const n of TREE) {
        const s = treeState(b, n);
        tree.append(h('div', { class: 'tnode ' + (s === 'owned' ? 'owned' : (s === 'buy' ? '' : 'na')), title: n.desc, onclick: () => { if (s !== 'buy') return; act(() => Econ.tree(id, n.id), () => { toast(`Learned <b>${esc(n.name)}</b>`); this.openDetail(id); }); } },
          h('b', {}, (s === 'owned' ? '✔ ' : '') + n.name), n.desc, h('div', { class: 'muted' }, s === 'owned' ? 'Learned' : s === 'na' ? 'Not available' : `${n.cost} SP • Lv ${n.lvl}${n.req ? ' • needs ' + TREE.find(t => t.id === n.req).name : ''}`)));
      }
      R.append(tree);
    }
    wrap.append(L, R); this.modal(wrap);
  },
  refreshCurrent() { if (this.current === 'collection') this.renderCollGrid(); refreshCoins(); },
  async evolve(id) {
    const b = getBall(id), p0 = prog(id), nx = EVO[p0.evo + 1]; if (!nx || !canEvolve(id)) return;
    if (!(await act(() => Econ.evolve(id)))) return;
    const p = prog(id);
    // evolution animation
    const cv = ballCanvas(b, 300, { evo: p.evo - 1, big: true }), box = this.modal(h('div', { style: { textAlign: 'center' } }, cv, h('h2', { id: 'evoTxt' }, 'EVOLVING…')));
    this.modalLocked = true; Sound.play('evolve');
    let t = 0; const ctx = cv.getContext('2d');
    this.live = [{ canvas: cv, def: b, modal: true, opts: { draw: (l, dt) => {
      t += dt; const k = Math.min(1, t / 2.4), ev = t < 1.6 ? p.evo - 1 : p.evo, dpr = Math.min(2, devicePixelRatio || 1);
      drawPreview(cv, b, { evo: ev, size: 300, big: true, t: now(), rot: t * t * 6, god: t > 1.4 && t < 1.8 });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.translate(150, 160); _lightRays(ctx, 60, b.design.c3, t * 3, 16, 2.4 + k * 2, 0.35 * k); ctx.restore();
      if (t > 1.45 && t < 1.9) { ctx.fillStyle = `rgba(255,255,255,${1 - Math.abs(t - 1.6) * 3})`; ctx.fillRect(0, 0, 300, 300); }
      ctx.globalCompositeOperation = 'source-over';
      if (t > 1.6 && !l.done) { l.done = true; $('#evoTxt').innerHTML = `✦ EVOLVED! ✦<br><small>${esc(evoName(b, p.evo))}</small>`; Sound.play('win'); }
      if (t > 3.2 && !l.closed) { l.closed = true; this.modalLocked = false; box.append(h('button', { class: 'btn gold', onclick: () => this.openDetail(id) }, 'Awesome!')); }
    } } }];
  },
};

/* ---------------- ECONOMY ACTIONS ----------------
   Guest mode applies actions to this device's save. Signed-in players send them to the game
   server, which validates them and returns the updated cloud save (the client is never trusted). */
const Econ = {
  async run(path, body, local) { if (online()) return window.Online.post(path, body); const r = local(); persist(); return r || {}; },
  unlock(id) { return this.run('/api/shop/unlock', { ball: id }, () => { const b = getBall(id), price = RARITY_INFO[b.rarity]?.price || 1000; if (SAVE.coins < price) throw new Error('Not enough coins'); addCoins(-price); unlockBall(id); }); },
  upgrade(id, k) { return this.run('/api/shop/upgrade', { ball: id, stat: k }, () => { const p = prog(id), pts = p.up[k] || 0, cost = upgradeCost(k, pts); if (pts >= UPGRADE_CAPS[k]) throw new Error('Maxed'); if (SAVE.coins < cost) throw new Error('Not enough coins'); addCoins(-cost); p.up[k] = pts + 1; }); },
  evolve(id) { return this.run('/api/ball/evolve', { ball: id }, () => { const p = prog(id), nx = EVO[p.evo + 1]; if (!nx || !canEvolve(id)) throw new Error('Cannot evolve yet'); addCoins(-nx.cost); p.evo++; SAVE.stats.evolutions++; checkAchievements(); }); },
  tree(id, node) { return this.run('/api/ball/tree', { ball: id, node }, () => { const n = TREE.find(t => t.id === node), p = prog(id); if (treeState(getBall(id), n) !== 'buy') throw new Error('Not available'); p.sp -= n.cost; p.tree[n.id] = 1; }); },
  summon(kind) { return this.run('/api/shop/summon', { orb: kind }, () => localSummon(kind)); },
  claimAch(id) { return this.run('/api/achievements/claim', { id }, () => { const a = ACHIEVEMENTS.find(x => x.id === id), st = SAVE.achievements[id]; if (!st || !st.done || st.claimed) throw new Error('Not available'); st.claimed = true; addCoins(a.reward); }); },
  claimCollection(m) { return this.run('/api/collection/claim', { milestone: m }, () => { const r = COLLECTION_REWARDS.find(x => x[0] === m); if (ownedCount() < m || SAVE.collectionClaimed.includes(m)) throw new Error('Not available'); SAVE.collectionClaimed.push(m); addCoins(r[1]); }); },
  eventClaim(e) { return this.run('/api/events/claim', { id: e.id }, () => { const ep = evProg(e.id); if (ep.wins < e.goal) throw new Error('Not enough event wins'); ep.claimed = true; unlockBall(e.ball); SAVE.limited[e.ball] = { at: Date.now(), event: e.name }; checkAchievements(); }); },
  eventBuy(e) { return this.run('/api/events/buy', { id: e.id }, () => { if (SAVE.coins < e.price) throw new Error('Not enough coins'); addCoins(-e.price); unlockBall(e.ball); SAVE.limited[e.ball] = { at: Date.now(), event: e.name }; checkAchievements(); }); },
};
/** runs an economy action with consistent feedback */
async function act(fn, after) { try { const r = await fn(); Sound.play('coin'); refreshCoins(); if (after) after(r); return r; } catch (e) { toast('⚠ ' + esc(e.message || 'Action failed'), 'bad'); } }

/* ---------------- UPGRADE SHOP ---------------- */
const ORBS = {
  mystery: { name: 'Mystery Orb', price: 250, ico: '🔮', desc: 'Summons a random standard ball. Duplicates refund 40% and give 150 EXP.', w: { Common: 40, Uncommon: 25, Rare: 16, Epic: 10, Legendary: 5, Mythical: 2.5, Ancient: 1, Secret: 0.3, 'God Tier': 0.2 } },
  cosmic: { name: 'Cosmic Orb', price: 1200, ico: '🌌', desc: 'Summons an Epic-or-better ball, with a chance of Secret and God Tier.', w: { Epic: 40, Legendary: 28, Mythical: 16, Ancient: 8, Secret: 5, 'God Tier': 3 } },
};
function localSummon(kind) {
  const O = ORBS[kind]; if (SAVE.coins < O.price) throw new Error('Not enough coins');
  const pool = allBalls().filter(b => b.enabled && !b.adminOnly && !b.limited && !b.premium && !b.fusion && !b.draft && O.w[b.rarity]);
  const total = pool.reduce((s, b) => s + O.w[b.rarity], 0); let r = Math.random() * total, got = pool[0];
  for (const b of pool) { r -= O.w[b.rarity]; if (r <= 0) { got = b; break; } }
  addCoins(-O.price); SAVE.stats.summons++;
  const dup = prog(got.id).owned;
  if (dup) { addCoins(Math.round(O.price * 0.4)); giveExp(got.id, 150); } else unlockBall(got.id, true);
  return { ball: got.id, duplicate: dup, refund: dup ? Math.round(O.price * 0.4) : 0, price: O.price };
}
async function summon(kind) {
  const O = ORBS[kind];
  const res = await act(() => Econ.summon(kind)); if (!res) return;
  const got = getBall(res.ball), dup = res.duplicate;
  Sound.play('evolve');
  const cv = ballCanvas(got, 220, { big: true }); UI.live.push({ canvas: cv, def: got, opts: { size: 220, big: true, spin: 3 }, rot: 0, modal: true });
  UI.modal(h('div', { style: { textAlign: 'center' } }, h('h2', {}, dup ? 'Duplicate!' : '✦ NEW BALL! ✦'), cv, h('h2', {}, got.name), h('div', { html: rarityBadge(got.rarity) }),
    h('p', { class: 'muted' }, dup ? `+${res.refund} coins refunded and +150 EXP for ${got.name}` : got.desc || ''),
    h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn gold', onclick: () => { UI.closeModal(); summon(kind); } }, `Summon again (🪙 ${res.price})`), h('button', { class: 'btn', onclick: () => { UI.closeModal(); UI.render_shop(); } }, 'Close'))));
  if (!online()) checkAchievements();
}
Object.assign(UI, {
  shopBall: null,
  render_shop() {
    const body = $('#shopBody'); body.innerHTML = ''; this.live = [];
    const owned = allBalls().filter(b => !b.adminOnly && prog(b.id).owned);
    if (!this.shopBall || !owned.some(b => b.id === this.shopBall)) this.shopBall = owned.some(b => b.id === Game.setup.ball) ? Game.setup.ball : owned[0]?.id;
    const grid = h('div', { class: 'shop-grid' });
    for (const [k, O] of Object.entries(ORBS)) grid.append(h('div', { class: 'card orb-card' }, h('div', { class: 'orb' }, O.ico), h('h3', {}, O.name), h('p', { class: 'muted', style: { fontSize: '13px' } }, O.desc), h('button', { class: 'btn gold', disabled: SAVE.coins < O.price, onclick: () => summon(k) }, `Summon — 🪙 ${fmtNum(O.price)}`)));
    const today = new Date().toDateString(), claimed = SAVE.lastDaily === today;
    grid.append(h('div', { class: 'card orb-card' }, h('div', { class: 'orb' }, '🎁'), h('h3', {}, 'Daily Coin Bonus'), h('p', { class: 'muted', style: { fontSize: '13px' } }, 'Claim free coins once per day.'),
      online() ? h('button', { class: 'btn green', onclick: () => this.show('profile') }, 'Open daily rewards') : h('button', { class: 'btn green', disabled: claimed, onclick: () => { SAVE.lastDaily = today; addCoins(200); Sound.play('coin'); toast('+200 coins!', 'gold'); this.render_shop(); } }, claimed ? 'Claimed today ✔' : 'Claim 🪙 200')));
    body.append(grid);
    const b = getBall(this.shopBall);
    if (!b) return;
    const p = prog(b.id), card = h('div', { class: 'card', style: { marginTop: '16px' } });
    card.append(h('h3', {}, '⬆ Stat Upgrades'));
    const sel = h('select', { style: { maxWidth: '320px' }, onchange: e => { this.shopBall = e.target.value; this.render_shop(); } }, owned.map(o => h('option', { value: o.id, selected: o.id === b.id }, `${o.name} (Lv ${prog(o.id).level})`)));
    const cv = ballCanvas(b, 120, { evo: p.evo }); this.addLive(cv, b, { evo: p.evo, size: 120 });
    const rows = h('div', { style: { flex: 1, minWidth: '260px' } });
    for (const k of Object.keys(UPGRADE_CAPS)) {
      const pts = p.up[k] || 0, cap = UPGRADE_CAPS[k], cost = upgradeCost(k, pts);
      rows.append(h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '6px 0' } },
        h('span', { style: { width: '70px', fontWeight: 700 } }, k.toUpperCase()), h('div', { class: 'bar', style: { flex: 1 } }, h('i', { style: { width: pts / cap * 100 + '%' } })), h('span', { class: 'muted', style: { width: '60px' } }, `${pts}/${cap}`),
        h('button', { class: 'btn small gold', disabled: pts >= cap || SAVE.coins < cost, onclick: () => act(() => Econ.upgrade(b.id, k), () => this.render_shop()) }, pts >= cap ? 'MAX' : `${UPGRADE_LABEL[k]} — 🪙 ${fmtNum(cost)}`)));
    }
    const nx = EVO[p.evo + 1];
    rows.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: () => this.openDetail(b.id) }, '🌳 Skill tree & details'),
      nx ? h('button', { class: 'btn gold', disabled: !canEvolve(b.id), onclick: () => this.evolve(b.id) }, `✦ Evolve → ${nx.name} (Lv ${nx.lvl}, 🪙 ${fmtNum(nx.cost)})`) : h('span', { class: 'muted' }, '✦ Fully evolved')));
    card.append(sel, h('div', { class: 'row', style: { alignItems: 'flex-start', marginTop: '10px' } }, cv, rows));
    body.append(card);
  },

  /* ---------------- EVENTS & REWARDS ---------------- */
  evTab: 'events',
  render_events() {
    const tabs = $('#eventTabs'); tabs.innerHTML = '';
    for (const [k, l] of [['events', '✦ Limited Events'], ['collection', '◉ Collection Rewards'], ['ach', '🏅 Achievements'], ['records', '📜 Records']])
      tabs.append(h('button', { class: 'tab' + (this.evTab === k ? ' active' : ''), onclick: () => { this.evTab = k; this.render_events(); } }, l));
    const body = $('#eventsBody'); body.innerHTML = ''; this.live = []; clearInterval(this.clockTimer);
    if (this.evTab === 'events') {
      const t = Date.now(), evs = allEvents().filter(e => e.end > t - 86400000).sort((a, b) => a.start - b.start);
      const clocks = [];
      for (const e of evs) {
        const b = getBall(e.ball); if (!b) continue;
        const active = e.start <= t && t < e.end, upcoming = e.start > t, ep = evProg(e.id), owned = prog(b.id).owned;
        const cv = ballCanvas(b, 170, { big: true }); this.addLive(cv, b, { size: 170, big: true });
        const cd = h('div', { class: 'countdown' }); clocks.push([cd, e]);
        const right = h('div', {}, h('div', { class: 'muted', style: { fontSize: '12px', letterSpacing: '2px' } }, active ? '● LIVE EVENT' : upcoming ? '◌ COMING SOON — LIMITED CHARACTER ANNOUNCEMENT' : 'ENDED'),
          h('h2', { style: { margin: '4px 0' } }, e.name, e.premiumOnly ? h('span', { class: 'pill', style: { marginLeft: '8px', fontSize: '12px' } }, '★ PREMIUM EVENT') : ''), h('p', { class: 'muted', style: { margin: '2px 0 8px' } }, e.desc || ''),
          h('div', { html: `Featured limited ball: <b>${esc(b.name)}</b> ${rarityBadge(b.rarity)}` }), cd);
        if (active && !owned) {
          right.append(h('div', { class: 'progress-line' }, h('span', {}, `Event wins: ${Math.min(ep.wins, e.goal)} / ${e.goal}`), h('div', { class: 'bar', style: { flex: 1 } }, h('i', { style: { width: Math.min(1, ep.wins / e.goal) * 100 + '%' } }))));
          right.append(h('div', { class: 'row', style: { marginTop: '8px' } },
            h('button', { class: 'btn gold', disabled: ep.wins < e.goal || e.locked, onclick: () => act(() => Econ.eventClaim(e), () => { toast(`🔓 <b>${esc(b.name)}</b> is yours!`, 'gold'); this.render_events(); }) }, '🎁 Claim free'),
            h('button', { class: 'btn', disabled: SAVE.coins < e.price || e.locked, onclick: () => act(() => Econ.eventBuy(e), () => { toast(`🔓 <b>${esc(b.name)}</b> is yours!`, 'gold'); this.render_events(); }) }, `Buy now — 🪙 ${fmtNum(e.price)}`),
            h('button', { class: 'btn primary', onclick: () => this.show('play') }, '⚔ Play event battles')));
        } else if (owned) right.append(h('p', { style: { color: '#3dffa0', fontWeight: 700 } }, '✔ In your collection'));
        body.append(h('div', { class: 'card event-card' + (upcoming ? ' upcoming' : active ? '' : ' ended') }, cv, right));
      }
      const tick = () => { const n = Date.now(); for (const [el, e] of clocks) el.textContent = e.start > n ? 'Starts in ' + fmtTime((e.start - n) / 1000) : e.end > n ? 'Ends in ' + fmtTime((e.end - n) / 1000) : 'Event ended'; };
      tick(); this.clockTimer = setInterval(tick, 1000);
      body.append(h('p', { class: 'muted', style: { fontSize: '12px' } }, 'Limited balls can only be obtained while their event is live. A new event begins every week. Admins can create custom limited events in the Admin Dashboard.'));
    } else if (this.evTab === 'collection') {
      const n = ownedCount();
      body.append(h('p', {}, `You own ${n} balls.`));
      for (const [need, reward] of COLLECTION_REWARDS) {
        const got = SAVE.collectionClaimed.includes(need);
        body.append(h('div', { class: 'ach' + (n >= need ? ' done' : '') + (got ? ' claimed' : '') }, h('div', {}, h('b', {}, `Own ${need} balls`), h('div', { class: 'muted' }, `${Math.min(n, need)} / ${need}`)),
          h('button', { class: 'btn small gold', disabled: got || n < need, onclick: () => act(() => Econ.claimCollection(need), () => this.render_events()) }, got ? 'Claimed' : `Claim 🪙 ${fmtNum(reward)}`)));
      }
    } else if (this.evTab === 'ach') {
      if (!online()) checkAchievements();
      for (const a of ACHIEVEMENTS) {
        const st = SAVE.achievements[a.id] || {};
        body.append(h('div', { class: 'ach' + (st.done ? ' done' : '') + (st.claimed ? ' claimed' : '') }, h('div', {}, h('b', {}, (st.done ? '🏅 ' : '◌ ') + a.name), h('div', { class: 'muted' }, a.desc)),
          h('button', { class: 'btn small gold', disabled: !st.done || st.claimed, onclick: () => act(() => Econ.claimAch(a.id), () => this.render_events()) }, st.claimed ? 'Claimed' : `Claim 🪙 ${fmtNum(a.reward)}`)));
      }
    } else {
      const s = SAVE.stats;
      body.append(h('div', { class: 'card' }, h('h3', {}, 'Battle Records'), h('div', { class: 'results-stats', html: [['Battles', s.battles], ['Wins', s.wins], ['Losses', s.losses], ['KOs', s.kills], ['Criticals', s.crits], ['Abilities used', s.skills], ['Rage Modes', s.rages], ['God Modes', s.gods], ['Evolutions', s.evolutions], ['Tournaments won', s.tourneyWins], ['Bosses defeated', s.bossWins], ['Best survival wave', s.survivalBest], ['Best endless KOs', s.endlessBest], ['Damage dealt', fmtNum(s.dmg)], ['Summons', s.summons]].map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('') })));
      const lim = h('div', { class: 'card', style: { marginTop: '14px' } }, h('h3', {}, 'Limited Collection Records'));
      const ids = Object.keys(SAVE.limited);
      if (!ids.length) lim.append(h('p', { class: 'muted' }, 'No limited balls collected yet.'));
      for (const id of ids) { const b = getBall(id); if (!b) continue; lim.append(h('div', { class: 'ach' }, h('div', { class: 'row' }, ballCanvas(b, 44), h('div', {}, h('b', {}, b.name), h('div', { class: 'muted' }, `${SAVE.limited[id].event} • obtained ${new Date(SAVE.limited[id].at).toLocaleDateString()}`))))); }
      body.append(lim);
    }
  },

  /* ---------------- SETTINGS ---------------- */
  render_settings() {
    const S = SAVE.settings, body = $('#settingsBody'); body.innerHTML = '';
    const save = () => { persist(); Sound.applyVolume(); };
    const range = (label, key, min, max, step) => h('label', { class: 'field' }, h('span', {}, label, ' ', h('span', { class: 'rv' }, Math.round(S[key] * 100) + '%')), h('input', { type: 'range', min, max, step, value: S[key], oninput: e => { S[key] = +e.target.value; e.target.previousSibling.lastChild.textContent = Math.round(S[key] * 100) + '%'; save(); } }));
    const chk = (label, key, after) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!S[key], onchange: e => { S[key] = e.target.checked; save(); after?.(); } }), label);
    const sel = (label, key, opts, num) => h('label', { class: 'field' }, h('span', {}, label), h('select', { onchange: e => { S[key] = num ? +e.target.value : e.target.value; save(); } }, opts.map(([v, l]) => h('option', { value: v, selected: S[key] == v }, l))));
    const audio = h('div', { class: 'card' }, h('h3', {}, '🔊 Audio'), range('Sound effects', 'sfx', 0, 1, 0.05), range('Music', 'music', 0, 1, 0.05), chk('Music on', 'musicOn', () => { if (S.musicOn) { Sound.init(); Sound.startMusic(); } else Sound.stopMusic(); }));
    const gfx = h('div', { class: 'card' }, h('h3', {}, '✨ Graphics'), sel('Particle quality', 'particles', [['low', 'Low (best for older phones)'], ['medium', 'Medium'], ['high', 'High']]),
      h('div', { style: { marginTop: '8px' } }, chk('Screen shake', 'shake'), chk('Impact flashes', 'flashes'), chk('Damage numbers', 'dmgNumbers'), chk('Ball name labels', 'labels'), chk('FPS counter', 'fps')));
    const gp = h('div', { class: 'card' }, h('h3', {}, '⚔ Gameplay'), sel('Default AI difficulty', 'difficulty', Object.keys(DIFF).map(k => [k, DIFF[k].label])), sel('Default battle speed', 'speed', [[1, '1x'], [1.5, '1.5x'], [2, '2x'], [3, '3x']], true), sel('Your ball control', 'control', [['auto', 'Auto battle (AI controls your ball)'], ['manual', 'Manual skills & steering']]));
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => this.doImport(t)); } });
    const ta = h('textarea', { rows: 3, placeholder: 'Or paste backup JSON here…' });
    const backup = h('div', { class: 'card' }, h('h3', {}, '💾 Save Data — Backup & Restore'), h('p', { class: 'muted', style: { fontSize: '13px' } }, 'Progress saves automatically in this browser (localStorage). Export a backup file to move or protect your collection, levels, coins, custom balls and settings.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { downloadText(`neon-ball-battle-backup-${new Date().toISOString().slice(0, 10)}.json`, exportSave()); toast('Backup downloaded'); } }, '⬇ Export backup file'),
        h('button', { class: 'btn', onclick: () => { navigator.clipboard?.writeText(exportSave()).then(() => toast('Backup copied to clipboard'), () => toast('Clipboard unavailable', 'bad')); } }, '⧉ Copy to clipboard'),
        h('button', { class: 'btn', onclick: () => fileIn.click() }, '⬆ Import file'), fileIn),
      h('div', { style: { marginTop: '8px' } }, ta), h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn', onclick: () => ta.value.trim() && this.doImport(ta.value) }, 'Restore from pasted text'),
        h('button', { class: 'btn danger', onclick: () => this.confirm('Reset ALL progress? This deletes coins, balls, levels and custom balls. Export a backup first!', () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } SAVE = null; loadSave(); invalidateRegistry(); toast('Progress reset'); this.show('menu'); }, 'Reset everything') }, '⚠ Reset progress')));
    const help = h('div', { class: 'card', html: `<h3>❓ How to play</h3><p class="muted" style="font-size:13px;line-height:1.5">Pick a ball and a mode. Balls move and bounce automatically inside the arena — collisions deal damage based on attack, impact speed and the target's defense. Each ball fires its special abilities and charges an <b>Ultimate</b>. At <b>${RAGE_HP} HP or below</b> a ball enters <b>Rage Mode</b>. God-tier balls transform into <b>God Mode</b> on their first ultimate. Win to earn coins &amp; EXP, level up, learn skill-tree nodes, evolve, and collect all balls.<br><br><b>Keys:</b> P/Esc pause • M toggle auto/manual • Manual: WASD/arrows steer, 1-4 abilities, SPACE ultimate.</p>` });
    body.append(h('div', { class: 'grid2' }, audio, gfx, gp, help), h('div', { style: { marginTop: '14px' } }, backup));
  },
  doImport(text) {
    try { importSave(text); invalidateRegistry(); Sound.applyVolume(); toast('✔ Save data restored', 'gold'); this.show('menu'); }
    catch (e) { toast('⚠ Import failed: ' + esc(e.message), 'bad'); }
  },

  /* ---------------- RESULTS ---------------- */
  showResults(r, B) {
    this.show('results');
    const body = $('#resultsBody'); body.innerHTML = '';
    if (r.pending) {
      body.append(h('h1', { class: 'results-title' }, 'BATTLE OVER'), h('div', { class: 'spinner', style: { margin: '18px auto' } }), h('p', { class: 'muted' }, 'Verifying the battle with the game server…'));
      return;
    }
    const b = getBall(r.ballId), p = prog(r.ballId);
    const surv = r.mode === 'survival' || r.mode === 'endless';
    const title = surv ? (r.mode === 'survival' ? `WAVE ${r.wave}` : `${r.kills} KOs`) : r.draw ? 'DRAW' : r.win ? 'VICTORY!' : r.pvp && r.pvp.mode === 'ffa' && r.pvp.place ? `#${r.pvp.place} PLACE` : 'DEFEAT';
    body.append(h('h1', { class: 'results-title ' + (r.win ? 'win' : 'lose') }, title));
    body.append(h('p', { class: 'muted', style: { margin: '2px' } }, r.pvp ? `🌐 ${(PVP_MODES[r.pvp.mode] || PVP_MODES.duel).name} • ${r.pvp.ranked ? 'Ranked' : 'Friendly'} • ${r.pvp.mode === 'ffa' ? (r.pvp.place ? `#${r.pvp.place} of ${r.pvp.teams}` : '') : /^(vs |with )/.test(r.pvp.opp || '') ? r.pvp.opp : 'vs ' + r.pvp.opp}` : `${MODES[r.mode]?.name} • ${DIFF[Game.setup.difficulty].label}${r.extraMsg ? ' • ' + r.extraMsg : ''}`));
    const cv = ballCanvas(b, 180, { evo: p.evo, big: true }); this.addLive(cv, b, { evo: p.evo, size: 180, big: true, spin: 2 });
    body.append(cv);
    const s = r.stats || {};
    body.append(h('div', { class: 'results-stats', html: [['Battle time', fmtTime(r.time).slice(3)], ['Damage dealt', fmtNum(s.dmg || 0)], ['Damage taken', fmtNum(s.taken || 0)], ['Critical hits', s.crits || 0], ['Abilities used', s.skills || 0], ['KOs', s.kills || 0]].map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('') }));
    if (r.mode !== 'practice') {
      body.append(h('div', { class: 'reward-line' }, `🪙 +${fmtNum(r.coins)} coins   ✦ +${fmtNum(r.exp)} EXP`));
      if (r.ups) body.append(h('div', { class: 'reward-line', style: { color: '#ffd54f', fontWeight: 800 } }, `⬆ LEVEL UP! ${b.name} reached Lv ${r.level} (+${r.ups} skill point${r.ups > 1 ? 's' : ''})`));
      const nx = EVO[p.evo + 1]; if (nx && p.level >= nx.lvl) body.append(h('div', { class: 'reward-line', style: { color: '#ff9f1c' } }, `✦ ${b.name} can now evolve into ${nx.name} form!`));
    } else body.append(h('p', { class: 'muted' }, 'Practice mode — no rewards.'));
    if (r.tourMsg) body.append(h('div', { class: 'reward-line', style: { color: '#ffd54f', fontWeight: 800 } }, r.tourMsg));
    if (r.pvp && r.pvp.ranked && r.pvp.rpBefore != null) body.append(h('div', { class: 'reward-line', style: { color: r.pvp.rpDelta >= 0 ? '#3dffa0' : '#ff8a9a', fontWeight: 800 } }, `🏅 Season points ${fmtNum(r.pvp.rpBefore)} → ${fmtNum(r.pvp.rpAfter)} (${r.pvp.rpDelta >= 0 ? '+' : ''}${r.pvp.rpDelta})${r.pvp.tier ? ' • ' + r.pvp.tier : ''}`));
    if (r.pvp && r.pvp.note) body.append(h('p', { class: 'muted' }, r.pvp.note));
    if (r.verified) body.append(h('p', { class: 'verified' }, '✔ Verified by the game server' + (r.mismatch ? ' — your device showed a different result, so the server result counts.' : '')));
    if (r.newAchievements && r.newAchievements.length) toast('🏅 Achievement: <b>' + r.newAchievements.map(esc).join(', ') + '</b> — claim it in Limited Events › Achievements', 'gold');
    if (r.win && window.Online && window.Online.victoryFx) window.Online.victoryFx(body);
    const row = h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } });
    if (r.pvp) row.append(h('button', { class: 'btn big primary', onclick: () => this.show('pvp') }, '🌐 Play online again'));
    else if (r.mode === 'tournament' && Game.tour) {
      row.append(h('button', { class: 'btn big primary', onclick: () => this.show('bracket') }, Game.tour.done || !Game.tour.alive ? '🏆 View Bracket' : '▶ Continue Tournament'));
    } else row.append(h('button', { class: 'btn big primary', onclick: () => Game.start(r.mode) }, '↻ Rematch'));
    if (!r.pvp) row.append(h('button', { class: 'btn', onclick: () => this.show('select') }, '◉ Change Ball'));
    row.append(h('button', { class: 'btn', onclick: () => this.show('menu') }, '⌂ Main Menu'));
    body.append(row);
  },

  /* ---------------- TOURNAMENT BRACKET ---------------- */
  render_bracket() {
    const T = Game.tour, body = $('#bracketBody'); body.innerHTML = '';
    if (!T) { body.append(h('p', {}, 'No tournament running.')); return; }
    const br = h('div', { class: 'bracket' }), names = ['Quarter-finals', 'Semi-finals', 'Final', 'Champion'];
    T.rounds.forEach((list, ri) => {
      const col = h('div', { class: 'bround' }, h('div', { class: 'muted', style: { textAlign: 'center', fontWeight: 700 } }, names[ri]));
      for (let i = 0; i < list.length; i += (list.length === 1 ? 1 : 2)) {
        const m = h('div', { class: 'bmatch' });
        for (const q of list.slice(i, i + (list.length === 1 ? 1 : 2))) { const b = getBall(q.id); m.append(h('div', { class: (q.res === 'w' ? 'w ' : q.res === 'l' ? 'l ' : '') + (q.me ? 'me' : '') }, ballCanvas(b, 22, { small: true }), (q.me ? '★ ' : '') + b.name)); }
        col.append(m);
      }
      br.append(col);
    });
    body.append(br);
    const foot = h('div', { style: { textAlign: 'center', marginTop: '18px' } });
    if (T.done) foot.append(h('h2', { style: { color: '#ffd54f' } }, `🏆 Champion: ${getBall(T.champion.id).name}${T.champion.me ? ' (YOU!)' : ''}`));
    if (T.alive && !T.done) foot.append(h('button', { class: 'btn big primary', onclick: () => Game.tourMatch() }, `⚔ Fight ${names[T.round]} match`));
    else foot.append(h('button', { class: 'btn big', onclick: () => { Game.tour = null; this.show('menu'); } }, '⌂ Back to Menu'), ' ', h('button', { class: 'btn big primary', onclick: () => { Game.setup.mode = 'tournament'; Game.startTournament(); } }, '↻ New Tournament'));
    body.append(foot);
  },

  /* ---------------- PAUSE & HUD ---------------- */
  pauseMenu(on) {
    if (!on) return this.closeModal();
    const box = this.modal(h('div', { style: { textAlign: 'center' } }, h('h2', {}, '❚❚ PAUSED'),
      h('div', { class: 'row', style: { justifyContent: 'center', flexDirection: 'column', alignItems: 'stretch', maxWidth: '300px', margin: 'auto' } },
        h('button', { class: 'btn big primary', onclick: () => BATTLE?.togglePause(false) }, '▶ Resume'),
        h('button', { class: 'btn', onclick: () => { this.closeModal(); if (BATTLE?.mode === 'tournament') Game.tourMatch(); else Game.start(BATTLE.mode); } }, '↻ Restart battle'),
        h('button', { class: 'btn', onclick: () => { SAVE.settings.musicOn = !SAVE.settings.musicOn; persist(); Sound.applyVolume(); SAVE.settings.musicOn ? Sound.startMusic() : Sound.stopMusic(); toast('Music ' + (SAVE.settings.musicOn ? 'on' : 'off')); } }, '♫ Toggle music'),
        h('button', { class: 'btn danger', onclick: () => { this.closeModal(); Game.tour = BATTLE?.mode === 'tournament' ? null : Game.tour; BATTLE = null; this.show('menu'); } }, '⌂ Quit to menu'))));
    this.modalLocked = true; void box;
  },
  syncHud() {
    if (!BATTLE) return;
    $('#btnSpeed').textContent = BATTLE.speed + 'x';
    const man = localManual(); $('#btnPause').textContent = BATTLE.pvp ? '✕' : '❚❚'; $('#btnSpeed').classList.toggle('hidden', !!BATTLE.pvp);
    $('#btnAuto').textContent = man ? 'MANUAL' : 'AUTO'; $('#btnAuto').classList.toggle('manual', !!man);
    const bar = $('#skillBar'); bar.classList.toggle('hidden', !man); bar.innerHTML = '';
    if (!man) return;
    const pl = BATTLE.player;
    pl.skills.forEach((s, i) => bar.append(h('button', { class: s.locked ? 'locked' : '', 'aria-label': 'Use ' + s.name, onpointerdown: e => { e.stopPropagation(); BATTLE.queue('k', i); } }, h('div', { class: 'cd' }), h('span', { class: 'lbl' }, `${i + 1}\n${s.name}`.slice(0, 26)))));
    bar.append(h('button', { class: 'ult', 'aria-label': 'Use ultimate', onpointerdown: e => { e.stopPropagation(); BATTLE.queue('u'); } }, h('div', { class: 'cd' }), h('span', { class: 'lbl' }, 'ULT\n★')));
  },
  updateSkillBar() {
    const pl = BATTLE?.player; if (!pl || !localManual()) return;
    const btns = $$('#skillBar button');
    pl.skills.forEach((s, i) => { const c = btns[i]?.firstChild; if (c) c.style.height = (s.locked ? 100 : clamp(s.cdLeft / (s.cd || 6), 0, 1) * 100) + '%'; });
    const u = btns[pl.skills.length]?.firstChild; if (u) u.style.height = (100 - pl.ultMeter) + '%';
  },
});
/* what the local player chose (online, the battle itself switches when both players have the input) */
function localManual() { return BATTLE ? (BATTLE.net ? !!BATTLE.net.localManual : !!BATTLE.player?.manual) : false; }
function toggleControl() {
  if (!BATTLE?.player || BATTLE.over) return;
  const want = !localManual(); BATTLE.queue('m', want ? 1 : 0); if (!BATTLE.net) BATTLE.player.manual = want; SAVE.settings.control = want ? 'manual' : 'auto'; persist();
  toast(want ? '🎮 Manual control — steer with WASD/drag, abilities 1-6, SPACE ultimate' : '🤖 Auto battle — AI controls your ball');
  UI.syncHud();
}

/* =====================================================================
   13. ADMIN DASHBOARD & BALL CREATOR
   ===================================================================== */
Object.assign(UI, {
  adminLogin() {
    if (window.Online && window.Online.ownerAccess) return window.Online.ownerAccess();
    return this.modal(`<h2>♛ Admin Dashboard</h2><p>The Admin Dashboard is private. It only opens for the <b>verified game owner</b>, signed in on the game server with a password and two-factor authentication.</p><p class="muted">Admin access is never controlled by a hidden button or a password stored in the browser. Start the game server (see <b>docs/DEPLOYMENT.md</b>) and sign in with the owner account.</p>`);
  },
  _legacyAdminLogin() {
    const pinSet = !!SAVE.admin.pin, inp = h('input', { type: 'password', placeholder: pinSet ? 'Admin PIN' : 'Optional: set a new admin PIN', maxlength: 32 });
    const go = () => {
      if (pinSet && inp.value !== SAVE.admin.pin) { toast('✖ Wrong PIN', 'bad'); inp.value = ''; return; }
      if (!pinSet && inp.value) { SAVE.admin.pin = inp.value; toast('Admin PIN saved'); }
      SAVE.admin.loggedIn = true; persist(); this.closeModal(); invalidateRegistry(); this.show('admin');
    };
    inp.addEventListener('keydown', e => e.key === 'Enter' && go());
    this.modal(h('div', { style: { maxWidth: '420px', margin: 'auto' } }, h('h2', {}, '♛ Admin Access'),
      h('p', { class: 'muted' }, pinSet ? 'Enter your admin PIN to manage balls, events and exclusive characters.' : 'You are the Admin. Optionally protect the dashboard with a PIN (leave empty for none).'),
      inp, h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, h('button', { class: 'btn admin', onclick: go }, pinSet ? 'Log in' : 'Enter Admin Mode'))));
    setTimeout(() => inp.focus(), 50);
  },
  adTab: 'balls', adQ: '',
  render_admin() {
    const tabs = $('#adminTabs'); tabs.innerHTML = '';
    for (const [k, l] of [['balls', '◉ Ball Manager'], ['events', '✦ Limited Events'], ['tools', '⚙ Admin Tools']]) tabs.append(h('button', { class: 'tab admin-tab' + (this.adTab === k ? ' active' : ''), onclick: () => { this.adTab = k; this.render_admin(); } }, l));
    tabs.append(h('button', { class: 'btn admin small', style: { marginLeft: 'auto' }, onclick: () => this.openCreator(null) }, '＋ Create New Ball'));
    const body = $('#adminBody'); body.innerHTML = '';
    if (this.adTab === 'balls') this.adminBalls(body); else if (this.adTab === 'events') this.adminEvents(body); else this.adminTools(body);
  },
  adminBalls(body) {
    const list = allBalls();
    body.append(h('div', { class: 'filters' }, h('input', { type: 'text', placeholder: '🔍 Search…', value: this.adQ, oninput: e => { this.adQ = e.target.value.toLowerCase(); this.render_admin(); setTimeout(() => { const i = $('#adminBody input'); i.focus(); i.setSelectionRange(99, 99); }); } }),
      h('span', { class: 'muted' }, `${list.length} balls • ${SAVE.customBalls.length} custom • ${Object.keys(SAVE.disabled).length} disabled • ${Object.keys(SAVE.overrides).length} edited built-ins`)));
    const tb = h('table', { class: 'admin-table' }), head = h('tr', {}, ['', 'Name', 'Category', 'Rarity', 'HP', 'ATK', 'DEF', 'SPD', 'CRIT', 'Abilities', 'Status', 'Actions'].map(t => h('th', {}, t)));
    tb.append(head);
    for (const b of list.filter(b => !this.adQ || b.name.toLowerCase().includes(this.adQ) || b.rarity.toLowerCase().includes(this.adQ))) {
      const p = prog(b.id);
      const acts = h('div', { class: 'acts' },
        h('button', { class: 'btn small', onclick: () => this.openCreator(b.id) }, '✎ Edit'),
        h('button', { class: 'btn small', onclick: () => this.duplicateBall(b.id) }, '⧉ Duplicate'),
        h('button', { class: 'btn small ' + (b.enabled ? '' : 'green'), onclick: () => { if (b.enabled) SAVE.disabled[b.id] = true; else delete SAVE.disabled[b.id]; persist(); invalidateRegistry(); this.render_admin(); } }, b.enabled ? '⏻ Disable' : '⏻ Enable'),
        b.adminOnly ? null : h('button', { class: 'btn small', onclick: () => { if (p.owned) { p.owned = false; } else unlockBall(b.id, true); persist(); this.render_admin(); } }, p.owned ? '✖ Revoke' : '🔓 Grant'),
        b.custom ? h('button', { class: 'btn small danger', onclick: () => this.confirm(`Delete custom ball "${esc(b.name)}"? This cannot be undone.`, () => this.deleteBall(b.id), 'Delete') }, '🗑 Delete') : null,
        b.overridden ? h('button', { class: 'btn small', onclick: () => this.confirm(`Restore "${esc(b.name)}" to its original design and stats?`, () => { delete SAVE.overrides[b.id]; persist(); invalidateRegistry(); this.render_admin(); }, 'Restore') }, '↺ Restore') : null);
      tb.append(h('tr', { style: { opacity: b.enabled ? 1 : 0.5 } }, h('td', {}, ballCanvas(b, 40, { small: true })), h('td', { html: `<b>${esc(b.name)}</b>${b.custom ? ' <small class="muted">custom</small>' : ''}${b.overridden ? ' <small class="muted">edited</small>' : ''}` }), h('td', {}, b.category), h('td', { html: rarityBadge(b.rarity) }),
        h('td', {}, b.hp), h('td', {}, b.atk), h('td', {}, b.def), h('td', {}, b.spd), h('td', {}, b.crit), h('td', { class: 'muted' }, (b.skills || []).length + ' + ult'), h('td', {}, b.enabled ? (b.adminOnly ? '♛ Admin' : p.owned ? 'Owned' : 'Locked') : 'Disabled'), h('td', {}, acts)));
    }
    body.append(h('div', { style: { overflowX: 'auto' } }, tb));
  },
  adminEvents(body) {
    const evs = SAVE.customEvents;
    const card = h('div', { class: 'card' }, h('h3', {}, 'Custom Limited Events'));
    if (!evs.length) card.append(h('p', { class: 'muted' }, 'No custom events. Built-in weekly events rotate automatically.'));
    for (const e of evs) card.append(h('div', { class: 'ach' }, h('div', {}, h('b', {}, e.name), h('div', { class: 'muted' }, `${getBall(e.ball)?.name || '?'} • ${new Date(e.start).toLocaleString()} → ${new Date(e.end).toLocaleString()} • goal ${e.goal} wins • price ${e.price}`)),
      h('button', { class: 'btn small danger', onclick: () => { SAVE.customEvents = evs.filter(x => x !== e); persist(); this.render_admin(); } }, 'Delete')));
    const toLocal = t => new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const nm = h('input', { type: 'text', placeholder: 'Event name' }), ds = h('input', { type: 'text', placeholder: 'Description / announcement' });
    const ballSel = h('select', {}, allBalls().filter(b => !b.adminOnly).map(b => h('option', { value: b.id }, `${b.name} (${b.rarity})`)));
    const st = h('input', { type: 'datetime-local', value: toLocal(Date.now()) }), en = h('input', { type: 'datetime-local', value: toLocal(Date.now() + 3 * 86400000) });
    const goal = h('input', { type: 'number', value: 3, min: 1, max: 50 }), price = h('input', { type: 'number', value: 2500, min: 0, step: 50 });
    const f = (l, i) => h('label', { class: 'field' }, h('span', {}, l), i);
    const form = h('div', { class: 'card', style: { marginTop: '14px' } }, h('h3', {}, '＋ Create Limited Event'), h('div', { class: 'fgrid' }, f('Name', nm), f('Featured ball', ballSel), f('Start', st), f('End', en), f('Wins to claim', goal), f('Coin price', price)), f('Description', ds),
      h('button', { class: 'btn admin', style: { marginTop: '10px' }, onclick: () => {
        const s0 = new Date(st.value).getTime(), e0 = new Date(en.value).getTime();
        if (!nm.value.trim() || !(e0 > s0)) return toast('Enter a name and a valid time range', 'bad');
        SAVE.customEvents.push({ id: 'cev_' + Date.now().toString(36), name: nm.value.trim(), desc: ds.value.trim(), ball: ballSel.value, start: s0, end: e0, goal: clamp(+goal.value || 3, 1, 50), price: Math.max(0, +price.value || 0) });
        persist(); toast('Event created'); this.render_admin();
      } }, 'Create event'));
    body.append(card, form);
  },
  adminTools(body) {
    const an = h('input', { type: 'text', value: SAVE.announcement, placeholder: 'Main-menu announcement (empty = show active event)' });
    const coins = h('input', { type: 'number', value: SAVE.coins, min: 0 });
    const pin = h('input', { type: 'password', placeholder: 'New PIN (empty removes PIN)' });
    body.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, '📢 Announcement'), an, h('button', { class: 'btn admin', style: { marginTop: '8px' }, onclick: () => { SAVE.announcement = an.value.trim(); persist(); toast('Announcement updated'); } }, 'Save announcement')),
      h('div', { class: 'card' }, h('h3', {}, '🪙 Coins'), h('div', { class: 'row' }, coins, h('button', { class: 'btn admin', onclick: () => { SAVE.coins = Math.max(0, Math.round(+coins.value || 0)); persist(); refreshCoins(); toast('Coins set'); } }, 'Set'), h('button', { class: 'btn', onclick: () => { addCoins(10000); coins.value = SAVE.coins; } }, '+10,000'))),
      h('div', { class: 'card' }, h('h3', {}, '◉ Collection'), h('div', { class: 'row' },
        h('button', { class: 'btn admin', onclick: () => { allBalls().forEach(b => !b.adminOnly && unlockBall(b.id, true)); toast('All balls unlocked'); } }, 'Unlock all balls'),
        h('button', { class: 'btn', onclick: () => { allBalls().forEach(b => { const p = prog(b.id); if (p.owned || b.adminOnly) { p.level = MAX_LVL; p.exp = 0; p.sp = Math.max(p.sp, 30); } }); persist(); toast('Owned balls set to max level'); } }, 'Max level owned balls'),
        h('button', { class: 'btn danger', onclick: () => this.confirm('Reset level, evolution, upgrades and skill trees of every ball?', () => { for (const id in SAVE.balls) { const o = SAVE.balls[id].owned; delete SAVE.balls[id]; prog(id).owned = o; if (o) prog(id).sp = 1; } persist(); toast('Progress reset'); }, 'Reset') }, 'Reset ball progress'))),
      h('div', { class: 'card' }, h('h3', {}, '🔐 Security'), pin, h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn admin', onclick: () => { SAVE.admin.pin = pin.value; persist(); toast(pin.value ? 'PIN changed' : 'PIN removed'); } }, 'Save PIN'), h('button', { class: 'btn', onclick: () => { SAVE.admin.loggedIn = false; persist(); invalidateRegistry(); this.show('menu'); } }, 'Log out of Admin'))),
      h('div', { class: 'card' }, h('h3', {}, '💾 Backup'), h('p', { class: 'muted', style: { fontSize: '13px' } }, 'Custom balls, events and all progress are included in save backups.'), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => downloadText('neon-ball-battle-backup.json', exportSave()) }, '⬇ Export backup'), h('button', { class: 'btn', onclick: () => this.show('settings') }, 'Restore in Settings')))));
  },
  duplicateBall(id) {
    const b = getBall(id), c = JSON.parse(JSON.stringify(b));
    for (const k of ['builtin', 'overridden', 'custom', 'enabled']) delete c[k];
    c.id = 'c_' + Date.now().toString(36); c.name = b.name.replace(/ Ball$/, '') + ' Copy Ball';
    if (c.rarity === 'Admin Exclusive') c.adminOnly = true; else delete c.adminOnly;
    if (c.limited) { c.limited = false; c.category = 'Custom'; c.rarity = 'Epic'; }
    SAVE.customBalls.push(c); prog(c.id).owned = !c.adminOnly; persist(); invalidateRegistry();
    toast(`Duplicated as <b>${esc(c.name)}</b>`); this.openCreator(c.id);
  },
  deleteBall(id) {
    SAVE.customBalls = SAVE.customBalls.filter(c => c.id !== id); delete SAVE.balls[id]; delete SAVE.disabled[id];
    SAVE.customEvents = SAVE.customEvents.filter(e => e.ball !== id); persist(); invalidateRegistry(); toast('Ball deleted'); this.render_admin();
  },

  /* ---------------- BALL CREATOR ---------------- */
  draft: null, editId: null, prevMode: 'normal',
  openCreator(id) {
    this.editId = id;
    const base = id ? getBall(id) : {
      id: 'draft', name: 'New Ball', desc: 'A brand new battle sphere.', category: 'Custom', rarity: 'Epic', hp: 100, atk: 55, def: 50, spd: 60, crit: 20, ai: 'intelligent',
      design: { c1: '#3a0ca3', c2: '#4cc9f0', c3: '#7b6cff', pat: 'swirl', deco: ['ring'], sym: '', glow: 1 },
      skills: [S('Energy Orb', 'projectile', 4, 45, '#4cc9f0'), S('Barrier', 'shield', 10, 50, '#9fe8ff'), S('Nova Ring', 'shockwave', 8, 50, '#7b6cff')],
      ult: U('Ultimate Burst', 'supernova', 80, '#7b6cff'), godMode: false, enabled: true,
    };
    const d = JSON.parse(JSON.stringify(base));
    for (const k of ['builtin', 'overridden', 'custom']) delete d[k];
    d.design.deco = d.design.deco || []; d.skills = d.skills || []; d.ult = d.ult || U('Ultimate', 'nova', 80, d.design.c3);
    this.draft = d; this.show('creator');
  },
  render_creator() {
    const d = this.draft; if (!d) return this.show('admin');
    $('#creatorTitle').textContent = this.editId ? `Edit Ball — ${d.name}` : 'Ball Creator — New Ball';
    const cv = $('#creatorCanvas');
    this.live = [{ canvas: cv, def: d, opts: { size: 320, big: true, draw: (l) => { drawPreview(cv, this.previewDef(), { size: 320, big: true, t: now(), rot: l.rot, rage: this.prevMode === 'rage', god: this.prevMode === 'god' }); } }, rot: 0 }];
    const sum = $('#creatorSummary'); sum.innerHTML = '';
    const pm = h('div', { class: 'opts', style: { justifyContent: 'center', margin: '8px 0' } });
    for (const [k, l] of [['normal', 'Normal'], ['rage', 'Rage Mode'], ['god', 'God Mode']]) pm.append(h('button', { class: 'opt' + (this.prevMode === k ? ' active' : ''), type: 'button', onclick: () => { this.prevMode = k; this.render_creator(); } }, l));
    sum.append(pm, h('div', { class: 'muted', style: { fontSize: '12px' } }, 'Live preview — every change updates instantly. All characters are procedurally drawn spheres.'));
    this.buildCreatorForm();
  },
  previewDef() { const d = this.draft; return { ...d, id: 'draft_' + (this.editId || 'new'), design: { ...d.design } }; },
  buildCreatorForm() {
    const d = this.draft, form = $('#creatorForm'); form.innerHTML = '';
    const lockAdmin = d.id === 'oneaboveall' || d.id === 'archangel';
    const F = (label, input, extra) => h('label', { class: 'field' }, h('span', {}, label, extra || ''), input);
    const text = (obj, key, ph = '', max = 40) => h('input', { type: 'text', value: obj[key] ?? '', placeholder: ph, maxlength: max, oninput: e => { obj[key] = e.target.value; } });
    const select = (obj, key, opts, after) => h('select', { disabled: lockAdmin && key === 'rarity', onchange: e => { obj[key] = e.target.value; after?.(); } }, opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: obj[key] === v }, l); }));
    const color = (obj, key) => h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(obj[key]) ? obj[key] : '#ffffff', oninput: e => { obj[key] = e.target.value; } });
    const num = (obj, key, min, max, step = 1) => { const rv = h('span', { class: 'rv' }, ' ' + obj[key]); const inp = h('input', { type: 'range', min, max, step, value: obj[key], oninput: e => { obj[key] = +e.target.value; rv.textContent = ' ' + obj[key]; } }); return [inp, rv]; };
    const chk = (obj, key, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!obj[key], onchange: e => { obj[key] = e.target.checked; this.buildCreatorForm(); } }), label);
    // identity
    form.append(h('div', { class: 'card' }, h('h3', {}, '1 · Identity'), h('div', { class: 'fgrid' },
      F('Name', text(d, 'name', 'e.g. Cosmic Fury Ball', 32)), F('Category', select(d, 'category', CATEGORIES)), F('Rarity', select(d, 'rarity', RARITIES)), F('AI personality', select(d, 'ai', AI_TYPES))),
      F('Description', text(d, 'desc', 'Short description', 160)),
      h('div', { style: { marginTop: '8px' } }, chk(d, 'unlockAll', 'All abilities unlocked from Lv 1'), chk(d, 'limited', 'Limited availability (event)'), chk(d, 'premium', 'Premium ball (subscribers)'),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !d.draft, onchange: e => { d.draft = !e.target.checked; } }), 'Published (visible to players)')),
      d.limited ? h('div', { class: 'fgrid' }, F('Event start', h('input', { type: 'datetime-local', value: d.limStart || '', onchange: e => d.limStart = e.target.value })), F('Event end', h('input', { type: 'datetime-local', value: d.limEnd || '', onchange: e => d.limEnd = e.target.value }))) : null,
      lockAdmin ? h('p', { class: 'muted', style: { fontSize: '12px' } }, '♛ This is an exclusive Admin character — its rarity stays Admin Exclusive.') : null));
    // design
    const ds = d.design, decoBox = h('div', {});
    for (const k of DECOS) decoBox.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: ds.deco.includes(k), onchange: e => { ds.deco = e.target.checked ? [...new Set([...ds.deco, k])] : ds.deco.filter(x => x !== k); } }), k));
    const [glowR, glowV] = num(ds, 'glow', 0.4, 2, 0.1);
    form.append(h('div', { class: 'card' }, h('h3', {}, '2 · Spherical Design'), h('div', { class: 'fgrid' },
      F('Base color', h('div', { class: 'color-row' }, color(ds, 'c1'), h('span', { class: 'muted' }, 'body'))), F('Accent color', h('div', { class: 'color-row' }, color(ds, 'c2'), h('span', { class: 'muted' }, 'pattern'))),
      F('Glow / aura color', h('div', { class: 'color-row' }, color(ds, 'c3'), h('span', { class: 'muted' }, 'energy'))), F('Rage aura color', h('div', { class: 'color-row' }, h('input', { type: 'color', value: ds.rage || rageColor(ds), oninput: e => ds.rage = e.target.value }))),
      F('Surface texture', select(ds, 'pat', PATTERNS)), F('Symbol (optional)', text(ds, 'sym', '★ ∞ ? ⚡', 2)), F('Glow intensity', glowR, glowV),
      F('Sound waveform', h('select', { onchange: e => { ds.sfx = { ...(ds.sfx || sfxOf(d)), wave: e.target.value }; } }, ['sine', 'triangle', 'square', 'sawtooth'].map(w => h('option', { value: w, selected: (ds.sfx || sfxOf(d)).wave === w }, w)))),
      F('Sound pitch', h('input', { type: 'range', min: 0.4, max: 2, step: 0.05, value: (ds.sfx || sfxOf(d)).pitch, oninput: e => { ds.sfx = { ...(ds.sfx || sfxOf(d)), pitch: +e.target.value }; } }), h('button', { class: 'btn small', type: 'button', style: { marginTop: '4px' }, onclick: () => { Sound.init(); Sound.play('skill', 1, ds.sfx || sfxOf(d)); } }, '♪ Test sound'))),
      h('div', { class: 'field', style: { marginTop: '8px' } }, h('span', {}, 'Floating attachments (wings, horns, crowns, rings…)'), decoBox)));
    // stats
    const statGrid = h('div', { class: 'fgrid' });
    for (const [k, l, mn, mx] of [['hp', 'HP', 20, 400], ['atk', 'Attack', 1, 150], ['def', 'Defense', 1, 150], ['spd', 'Movement speed', 1, 130], ['crit', 'Critical rate %', 0, 100]]) { const [r, v] = num(d, k, mn, mx); statGrid.append(F(l, r, v)); }
    form.append(h('div', { class: 'card' }, h('h3', {}, '3 · Stats'), statGrid));
    // transformation forms
    for (const [k, v] of [['rageAtk', 1.3], ['rageSpd', 1.22], ['godDur', 12], ['godBoost', 1.6]]) if (d[k] == null) d[k] = v;
    const [raR, raV] = num(d, 'rageAtk', 1, 1.8, 0.05), [rsR, rsV] = num(d, 'rageSpd', 1, 1.6, 0.02), [gdR, gdV] = num(d, 'godDur', 6, 20, 1), [gbR, gbV] = num(d, 'godBoost', 1.2, 2.2, 0.05);
    const gp = h('div', { class: 'fgrid' });
    if (d.godMode) for (const [k, l] of [['godC1', 'God form body'], ['godC2', 'God form accent'], ['godC3', 'God form aura']]) gp.append(F(l, h('input', { type: 'color', value: ds[k] || godDesign({ ...ds, [k]: null })[k.replace('god', '').toLowerCase()] || '#ffd54f', oninput: e => { ds[k] = e.target.value; } })));
    form.append(h('div', { class: 'card' }, h('h3', {}, '4 · Rage Mode & God Mode Transformation'),
      h('p', { class: 'muted', style: { fontSize: '12px', margin: '0 0 8px' } }, `Rage Mode always activates at ${RAGE_HP} HP or below. God Mode triggers on the first ultimate of a God Mode eligible ball.`),
      h('div', { class: 'fgrid' }, F('Rage attack ×', raR, raV), F('Rage speed ×', rsR, rsV)),
      h('div', { style: { margin: '8px 0' } }, chk(d, 'godMode', 'God Mode eligible')),
      d.godMode ? h('div', {}, h('div', { class: 'fgrid' }, F('God form name', text(d, 'godName', 'e.g. SUPREME COSMIC SPHERE', 40)), F('God Mode duration (s)', gdR, gdV), F('God stat boost ×', gbR, gbV)), gp) : null));
    // skills
    const sk = h('div', { class: 'card' }, h('h3', {}, '5 · Special Abilities (3 to 4)'));
    d.skills.forEach((s, i) => {
      const row = h('div', { class: 'skill-edit' },
        F('Name', text(s, 'name', 'Ability name', 28)),
        F('Type', select(s, 'type', Object.entries(SKILL_TYPES).map(([k, v]) => [k, v.label]), () => this.buildCreatorForm())),
        F('Power', h('input', { type: 'number', min: 1, max: 150, value: s.power, onchange: e => s.power = clamp(+e.target.value || 1, 1, 150) })),
        F('Cooldown s', h('input', { type: 'number', min: 1, max: 30, step: 0.5, value: s.cd, onchange: e => s.cd = clamp(+e.target.value || 1, 1, 30) })),
        F('Effect', select(s, 'effect', EFFECTS)),
        F('Color', color(s, 'color')),
        h('button', { class: 'btn small danger', type: 'button', onclick: () => { d.skills.splice(i, 1); this.buildCreatorForm(); } }, '✖'));
      if (['multishot', 'homing', 'meteor'].includes(s.type)) row.insertBefore(F('Count', h('input', { type: 'number', min: 1, max: 9, value: s.count || 3, onchange: e => s.count = clamp(+e.target.value || 3, 1, 9) })), row.lastChild);
      sk.append(row, h('div', { class: 'muted', style: { fontSize: '11px', margin: '-2px 0 6px 8px' } }, SKILL_TYPES[s.type]?.desc || ''));
    });
    if (d.skills.length < 4) sk.append(h('button', { class: 'btn small', type: 'button', onclick: () => { d.skills.push(S('New Ability', 'projectile', 5, 45, d.design.c3)); this.buildCreatorForm(); } }, '＋ Add ability'));
    form.append(sk);
    // ultimate
    const u = d.ult;
    form.append(h('div', { class: 'card' }, h('h3', {}, '6 · Ultimate Skill'), h('div', { class: 'fgrid' },
      F('Ultimate name', text(u, 'name', 'ULTIMATE NAME', 32)), F('Ultimate type', select(u, 'type', Object.entries(ULT_TYPES))),
      F('Power', h('input', { type: 'number', min: 10, max: 150, value: u.power, onchange: e => u.power = clamp(+e.target.value || 50, 10, 150) })), F('Effect', select(u, 'effect', EFFECTS)), F('Color', color(u, 'color')))));
    // actions
    form.append(h('div', { class: 'row', style: { position: 'sticky', bottom: '0', background: 'rgba(5,10,30,.95)', padding: '10px 0' } },
      h('button', { class: 'btn admin big', type: 'button', onclick: () => this.saveDraft(false) }, '💾 Save Ball'),
      this.editId ? h('button', { class: 'btn', type: 'button', onclick: () => this.saveDraft(true) }, '⧉ Save as new copy') : null,
      h('button', { class: 'btn primary', type: 'button', onclick: async () => { const id = await this.saveDraft(false, true); if (id) { Game.setup.ball = id; Game.setup.enemy = 'random'; Game.setup.mode = 'practice'; Game.setup.dummy = false; Game.start('practice'); } } }, '▶ Save & test battle'),
      h('button', { class: 'btn', type: 'button', onclick: () => this.show('admin') }, 'Cancel')));
  },
  saveDraft(asNew, quiet) {
    const d = JSON.parse(JSON.stringify(this.draft));
    d.name = (d.name || '').trim(); if (!d.name) { toast('Give your ball a name', 'bad'); return null; }
    if (d.skills.length < 3) { toast('Every ball needs at least 3 special abilities', 'bad'); return null; }
    for (const k of ['hp', 'atk', 'def', 'spd', 'crit']) d[k] = Math.round(+d[k] || 1);
    d.skills = d.skills.slice(0, 4).map(s => ({ ...s, name: (s.name || 'Ability').trim(), power: +s.power, cd: +s.cd }));
    if (d.id === 'oneaboveall' || d.id === 'archangel') d.rarity = 'Admin Exclusive';
    d.adminOnly = d.rarity === 'Admin Exclusive' || undefined;
    if (d.rarity === 'Limited') d.limited = true;
    const isBuiltin = !asNew && this.editId && ALL_BUILTIN.some(b => b.id === this.editId);
    let id;
    if (isBuiltin) {
      id = this.editId; const o = {};
      for (const k of ['name', 'desc', 'category', 'rarity', 'hp', 'atk', 'def', 'spd', 'crit', 'ai', 'design', 'skills', 'ult', 'godMode', 'godName', 'unlockAll', 'limited', 'premium', 'rageAtk', 'rageSpd', 'godDur', 'godBoost']) o[k] = d[k];
      SAVE.overrides[id] = o;
    } else {
      id = (!asNew && this.editId) ? this.editId : 'c_' + Date.now().toString(36) + randi(10, 99);
      d.id = id; delete d.enabled;
      const i = SAVE.customBalls.findIndex(c => c.id === id);
      if (i >= 0) SAVE.customBalls[i] = d; else { SAVE.customBalls.push(d); SAVE.stats.created++; if (!d.adminOnly && !d.limited) { prog(id).owned = true; prog(id).sp = 1; } }
    }
    if (d.limited && d.limStart && d.limEnd) {
      const s0 = new Date(d.limStart).getTime(), e0 = new Date(d.limEnd).getTime();
      if (e0 > s0) { SAVE.customEvents = SAVE.customEvents.filter(e => e.id !== 'auto_' + id); SAVE.customEvents.push({ id: 'auto_' + id, name: d.name + ' Limited Event', desc: d.desc, ball: id, start: s0, end: e0, goal: 3, price: RARITY_INFO.Limited.price }); }
    }
    persist(); invalidateRegistry(); checkAchievements();
    this.editId = id; this.draft = JSON.parse(JSON.stringify(getBall(id)));
    if (!quiet) { toast(`💾 <b>${esc(d.name)}</b> saved — available in Collection & Ball Selection`, 'gold'); this.render_creator(); }
    return id;
  },
});

/* =====================================================================
   14. MAIN LOOP & BOOT
   ===================================================================== */
const Main = {
  canvas: null, ctx: null, scale: 1, dpr: 1, last: 0, fps: 60, frames: 0, fpsT: 0,
  init() {
    this.canvas = $('#game'); this.ctx = this.canvas.getContext('2d', { alpha: false });
    addEventListener('resize', () => this.resize()); addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
    requestAnimationFrame(t => { this.last = t; this.loop(t); });
  },
  resize() {
    const vw = innerWidth, vh = innerHeight;
    this.scale = Math.min(vw / W, vh / H);
    const cw = W * this.scale, ch = H * this.scale, st = $('#stage').style;
    st.left = (vw - cw) / 2 + 'px'; st.top = (vh - ch) / 2 + 'px'; st.width = cw + 'px'; st.height = ch + 'px';
    this.dpr = Math.min(window.devicePixelRatio || 1, SAVE.settings.particles === 'low' ? 1 : 2);
    this.canvas.width = Math.round(cw * this.dpr); this.canvas.height = Math.round(ch * this.dpr);
    Arena.render(this.scale * this.dpr);
  },
  loop(ts) {
    const dt = Math.min(0.1, Math.max(0, (ts - this.last) / 1000)); this.last = ts;
    const ctx = this.ctx, k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    try {
      const demoVisible = !BATTLE?.cfg.demo || UI.current === 'menu';
      if (BATTLE && demoVisible) { BATTLE.update(dt); BATTLE.draw(ctx, dt); }
      else { Arena.draw(ctx, dt); }
      if (BATTLE?.cfg.demo && BATTLE.over && Game.demoTimer > 0) { Game.demoTimer -= dt; if (Game.demoTimer <= 0) { BATTLE = null; Game.demo(); } }
      if (!BATTLE && UI.current) Game.demo();
      UI.tickLive(dt); UI.updateSkillBar();
    } catch (e) { console.error(e); }
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    if (SAVE.settings.fps) { ctx.font = '700 12px monospace'; ctx.fillStyle = this.fps >= 50 ? '#3dffa0' : '#ffd54f'; ctx.textAlign = 'right'; ctx.fillText(this.fps + ' FPS', W - 50, H - 10); }
    requestAnimationFrame(t => this.loop(t));
  },
};

function boot() {
  loadSave();
  Main.init(); UI.init(); Input.init();
  Game.setup.ball = SAVE.last.ball; Game.setup.difficulty = SAVE.last.difficulty || SAVE.settings.difficulty;
  if (!getBall(Game.setup.ball)) Game.setup.ball = 'fire';
  UI.show('menu');
  const done = () => { const l = $('#loading'); if (l) { l.classList.add('gone'); setTimeout(() => l.remove(), 400); } };
  if (window.Online) window.Online.init().catch(e => console.warn('online init', e)).finally(done); else done();
  const first = () => { Sound.init(); if (SAVE.settings.musicOn) Sound.startMusic(); removeEventListener('pointerdown', first); removeEventListener('keydown', first); };
  addEventListener('pointerdown', first); addEventListener('keydown', first);
  document.addEventListener('visibilitychange', () => { if (document.hidden && BATTLE && !BATTLE.cfg.demo && !BATTLE.over && !BATTLE.paused) BATTLE.togglePause(true); });
  checkAchievements();
}
/* small debug / automation hook (used for testing) */
window.NBB = { Game, UI, get save() { return SAVE; }, get battle() { return BATTLE; }, registry: () => allBalls(), Fighter, Battle };
/* shared game core — the Node game server loads this file headlessly to verify battles */
window.NBB_CORE = {
  createTicket, buildBattleConfig, simulateTicket, computeRewards, createPvpTicket, mergePvpBlock, cleanPvpActions, PVP, PVP_MODES, RANK_TIERS, rankTier, createTournament, tournamentOpponent, advanceTournament, TOUR_NAMES,
  Battle, Fighter, setCatalog, getBall, useSkill, useUltimate, unitsOf, dealDamage, spawnProj, allBalls, opponentPool, normDiff, enemySpec, playerSpecFrom, defaultSave, mulberry32, prog,
  DIFF, MODES, EVO, TREE, MAX_LVL, expNeed, UPGRADE_CAPS, upgradeCost, RARITY_INFO, RARITIES, CATEGORIES, ORBS, ACHIEVEMENTS, COLLECTION_REWARDS,
  COSMETICS, COSMETIC_SLOTS, DAILY_REWARDS, FUSION_COST, FUSION_MIN_LEVEL, FUSION_MAX, fusionEligible, makeFusionDef, mixColor, hashStr, sfxOf,
  rngCount: () => _rngN, setRngHook: fn => { _rngHook = fn; }, BUILTIN_BALLS, LIMITED_BALLS, ADMIN_BALLS, PREMIUM_BALLS, UPDATE_BALLS, SUMMON_BALLS, ALL_BUILTIN, UNIT, ANTI, HEAT, PORTAL, SUMMON_POOL, SKILL_TYPES, ULT_TYPES, EFFECTS, PATTERNS, DECOS, AI_TYPES, EVENT_INFO, builtinEvents, RAGE_HP, STEP,
};
if (window.NBB_HEADLESS) SAVE = defaultSave();
else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
