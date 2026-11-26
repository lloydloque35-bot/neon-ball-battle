'use strict';
/**
 * Minimal HTTP framework: router, body limits, JSON responses, security headers,
 * cookies and a whitelisted static file server (server code, database and .env are never served).
 */
const fs = require('node:fs');
const path = require('node:path');

class HttpError extends Error {
  constructor(status, message, code, extra) { super(message); this.status = status; this.code = code || undefined; this.extra = extra; }
}
const bad = (msg, code) => new HttpError(400, msg, code);

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    const k = part.slice(0, i).trim(); if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}
function cookie(name, value, opts = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Strict`;
  if (opts.httpOnly !== false) c += '; HttpOnly';
  if (opts.secure) c += '; Secure';
  if (opts.maxAge != null) c += `; Max-Age=${Math.floor(opts.maxAge)}`;
  return c;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const PUBLIC_FILES = new Set(['/index.html', '/style.css', '/script.js', '/supreme.js', '/gods.js', '/gods2.js', '/gods3.js', '/skills.js', '/online.js', '/manifest.webmanifest']);

class App {
  constructor({ root, secure, trustProxy, log }) {
    this.routes = []; this.root = root; this.secure = secure; this.trustProxy = trustProxy; this.before = []; this.log = log || console;
  }
  use(fn) { this.before.push(fn); }
  route(method, pattern, opts, handler) {
    if (typeof opts === 'function') { handler = opts; opts = {}; }
    const keys = []; const re = new RegExp('^' + pattern.replace(/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    this.routes.push({ method, re, keys, handler, opts });
  }
  get(p, o, h) { this.route('GET', p, o, h); }
  post(p, o, h) { this.route('POST', p, o, h); }
  delete(p, o, h) { this.route('DELETE', p, o, h); }

  async handle(req, res) {
    const started = Date.now();
    const url = new URL(req.url, 'http://local');
    const ctx = { req, res, method: req.method, path: decodeURIComponent(url.pathname), query: Object.fromEntries(url.searchParams), params: {}, cookies: parseCookies(req.headers.cookie), headers: req.headers, setCookies: [] };
    // behind a trusted proxy, the LAST X-Forwarded-For entry is the one the proxy added (earlier entries can be forged by clients)
    ctx.ip = this.trustProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',').pop().trim() : req.socket.remoteAddress;
    try {
      if (ctx.path.startsWith('/api/')) {
        const r = this.routes.find(rt => rt.method === req.method && rt.re.test(ctx.path));
        if (!r) throw new HttpError(404, 'Not found');
        const m = ctx.path.match(r.re); r.keys.forEach((k, i) => { ctx.params[k] = m[i + 1]; });
        ctx.route = r;
        if (req.method !== 'GET') {
          const limit = r.opts.bodyLimit || 64 * 1024;
          ctx.raw = await readBody(req, limit);
          if (!r.opts.raw) {
            const ct = String(req.headers['content-type'] || '');
            if (ctx.raw.length && !ct.includes('application/json')) throw new HttpError(415, 'Content-Type must be application/json');
            try { ctx.body = ctx.raw.length ? JSON.parse(ctx.raw.toString('utf8')) : {}; } catch { throw bad('Invalid JSON body'); }
            if (!ctx.body || typeof ctx.body !== 'object' || Array.isArray(ctx.body)) throw bad('JSON body must be an object');
          }
        }
        for (const fn of this.before) await fn(ctx);
        const out = await r.handler(ctx);
        if (!res.headersSent) this.json(ctx, 200, out ?? { ok: true });
      } else this.serveStatic(ctx);
    } catch (e) {
      if (!(e instanceof HttpError)) { this.log.error('[error]', req.method, ctx.path, e && e.stack || e); e = new HttpError(500, 'Something went wrong. Please try again.'); }
      if (!res.headersSent) this.json(ctx, e.status, { error: e.message, code: e.code, ...(e.extra || {}) });
    } finally {
      if (ctx.path.startsWith('/api/')) this.log.debug?.(`${req.method} ${ctx.path} ${res.statusCode} ${Date.now() - started}ms`);
    }
  }
  headers(ctx, extra = {}) {
    const h = { ...SECURITY_HEADERS, ...extra };
    if (this.secure) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    if (ctx.setCookies.length) h['Set-Cookie'] = ctx.setCookies;
    return h;
  }
  json(ctx, status, obj) {
    const body = JSON.stringify(obj);
    ctx.res.writeHead(status, this.headers(ctx, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) }));
    ctx.res.end(body);
  }
  serveStatic(ctx) {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    let p = ctx.path === '/' ? '/index.html' : ctx.path;
    const allowed = PUBLIC_FILES.has(p) || (/^\/assets\/[A-Za-z0-9_\-./]+$/.test(p) && !p.includes('..'));
    if (!allowed) throw new HttpError(404, 'Not found');
    const file = path.join(this.root, p);
    if (!file.startsWith(this.root + path.sep)) throw new HttpError(404, 'Not found');
    let st; try { st = fs.statSync(file); } catch { throw new HttpError(404, 'Not found'); }
    if (!st.isFile()) throw new HttpError(404, 'Not found');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    ctx.res.writeHead(200, this.headers(ctx, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' }));
    if (ctx.method === 'HEAD') return ctx.res.end();
    fs.createReadStream(file).pipe(ctx.res);
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Request body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = { App, HttpError, bad, cookie, parseCookies };
