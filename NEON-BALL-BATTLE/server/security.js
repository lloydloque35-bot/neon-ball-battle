'use strict';
/**
 * Security primitives — Node's crypto module only.
 *  - scrypt password hashing (memory-hard, per-user salt)
 *  - random tokens; only SHA-256 hashes of tokens are stored server-side
 *  - RFC 6238 TOTP two-factor codes with replay protection
 *  - single-use recovery codes
 *  - sliding-window rate limiter
 *  - input validation
 */
const crypto = require('node:crypto');

/* ---------------- passwords ---------------- */
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(String(password).normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem }, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`);
    });
  });
}
function verifyPassword(password, stored) {
  return new Promise(resolve => {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return resolve(false);
    const [, N, r, p, saltB64, keyB64] = parts;
    const expected = Buffer.from(keyB64, 'base64');
    crypto.scrypt(String(password).normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem }, (err, key) => {
      if (err) return resolve(false);
      resolve(key.length === expected.length && crypto.timingSafeEqual(key, expected));
    });
  });
}
/* a dummy hash so unknown usernames take as long as wrong passwords (no user enumeration by timing) */
let DUMMY_HASH = null;
async function dummyVerify(password) { if (!DUMMY_HASH) DUMMY_HASH = await hashPassword('dummy-password-for-timing'); return verifyPassword(password, DUMMY_HASH); }

/* ---------------- tokens ---------------- */
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const randomId = (prefix = '') => prefix + crypto.randomBytes(12).toString('base64url');
const secureRandom = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;     // crypto-grade [0,1) for server-side rolls
function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/* ---------------- TOTP (RFC 6238) ---------------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
const newTotpSecret = () => base32Encode(crypto.randomBytes(20));
function totpCode(secret, counter) {
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const off = hmac[hmac.length - 1] & 15;
  const bin = ((hmac[off] & 127) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3];
  return String(bin % 1e6).padStart(6, '0');
}
/** returns the matched time-step counter (> lastCounter, to block replays) or -1 */
function verifyTotp(secret, code, lastCounter = 0, now = Date.now()) {
  const c = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c) || !secret) return -1;
  const cur = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) {
    const ctr = cur + d;
    if (ctr <= lastCounter) continue;
    if (safeEqual(totpCode(secret, ctr), c)) return ctr;
  }
  return -1;
}
const otpauthUrl = (secret, account, issuer = 'Neon Ball Battle') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

/* ---------------- recovery codes ---------------- */
function newRecoveryCodes(n = 10) {
  const codes = [];
  for (let i = 0; i < n; i++) { const raw = base32Encode(crypto.randomBytes(7)).slice(0, 10); codes.push(raw.slice(0, 5) + '-' + raw.slice(5)); }
  return { codes, hashes: codes.map(c => sha256(normCode(c))) };
}
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z2-7]/g, '');

/* ---------------- rate limiting (sliding window, in memory) ---------------- */
class RateLimiter {
  constructor() { this.hits = new Map(); this.timer = setInterval(() => this.sweep(), 60000); this.timer.unref?.(); }
  /** returns true if allowed */
  hit(key, limit, windowMs) {
    const now = Date.now(); let arr = this.hits.get(key);
    if (!arr) { arr = []; this.hits.set(key, arr); }
    while (arr.length && arr[0] <= now - windowMs) arr.shift();
    if (arr.length >= limit) return false;
    arr.push(now); return true;
  }
  reset(key) { this.hits.delete(key); }
  sweep() { const now = Date.now(); for (const [k, a] of this.hits) if (!a.length || a[a.length - 1] < now - 3600000) this.hits.delete(k); }
}

/* ---------------- validation ---------------- */
const COMMON_PASSWORDS = new Set(['password', 'password1', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'iloveyou12', 'letmein123', 'admin12345', 'welcome123', 'football12', 'baseball12', 'neonball123', 'qwerty1234', 'abc1234567']);
function validateUsername(u) {
  if (typeof u !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(u)) return 'Username must be 3-20 letters, numbers or underscores';
  if (/^(admin|owner|root|system|support|moderator)/i.test(u)) return 'That username is reserved';
  return null;
}
function validatePassword(p, username = '') {
  if (typeof p !== 'string' || p.length < 10) return 'Password must be at least 10 characters';
  if (p.length > 128) return 'Password must be at most 128 characters';
  if (COMMON_PASSWORDS.has(p.toLowerCase()) || (username && p.toLowerCase().includes(username.toLowerCase()))) return 'Password is too easy to guess';
  if (new Set(p).size < 5) return 'Password needs more variety';
  return null;
}
function validateEmail(e) {
  if (e == null || e === '') return null;
  if (typeof e !== 'string' || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Email address is not valid';
  return null;
}
const isId = (v, max = 64) => typeof v === 'string' && v.length > 0 && v.length <= max && /^[A-Za-z0-9_\-]+$/.test(v);
const clampInt = (v, min, max, d = min) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

module.exports = {
  hashPassword, verifyPassword, dummyVerify, randomToken, sha256, randomId, secureRandom, safeEqual,
  base32Encode, base32Decode, newTotpSecret, totpCode, verifyTotp, otpauthUrl, newRecoveryCodes, normCode,
  RateLimiter, validateUsername, validatePassword, validateEmail, isId, clampInt,
};
