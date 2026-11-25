'use strict';
/* Test harness: real server on a random port with a throw-away database. */
process.env.NBB_SKIP_DOTENV = '1';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildConfig } = require('../config');
const { createGameServer } = require('../app');
const S_ = require('../security');

const quiet = { info() {}, warn() {}, debug() {}, error: (...a) => console.error(...a) };

async function startServer(over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nbb-test-'));
  const cfg = { ...buildConfig(), dbFile: path.join(dir, 'test.db'), cookieSecure: false, logLevel: 'error', limits: { registerPerHour: 1000 }, ...over };
  cfg.payments = { ...buildConfig().payments, ...(over.payments || {}) };
  const game = createGameServer(cfg, { log: quiet });
  await new Promise(r => game.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${game.server.address().port}`;
  return { ...game, base, cfg, dir, async stop() { await game.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

class Client {
  constructor(base) { this.base = base; this.cookie = ''; this.csrf = ''; }
  async req(method, url, body, headers = {}) {
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (body !== undefined) h['content-type'] = 'application/json';
    if (method !== 'GET' && this.csrf && !('x-csrf-token' in h)) h['x-csrf-token'] = this.csrf;
    const r = await fetch(this.base + url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    const sc = r.headers.getSetCookie?.() || [];
    for (const c of sc) { const m = c.match(/^nbb_sid=([^;]*)/); if (m) this.cookie = m[1] ? 'nbb_sid=' + m[1] : ''; }
    let data = null; try { data = await r.json(); } catch { /* not json */ }
    if (data && data.csrf) this.csrf = data.csrf;
    return { status: r.status, data };
  }
  get(u, h) { return this.req('GET', u, undefined, h); }
  post(u, b = {}, h) { return this.req('POST', u, b, h); }
  async register(username, password = 'Sup3r-Secret-Pass!') { return this.post('/api/auth/register', { username, password }); }
}

module.exports = { startServer, Client, S_ };

/* Tiny WebSocket test client (masked text frames) so tests can send any Cookie / Origin header. */
const http = require('node:http');
const crypto = require('node:crypto');
function wsConnect(base, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + path, { headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), ...headers } });
    req.on('response', r => { resolve({ rejected: r.statusCode }); r.resume(); });
    req.on('error', reject);
    req.on('upgrade', (res, socket, head) => {
      const c = { socket, msgs: [], waiters: [], closed: false, buf: Buffer.alloc(0) };
      const deliver = m => { const i = c.waiters.findIndex(w => w.pred(m)); if (i >= 0) { const w = c.waiters.splice(i, 1)[0]; clearTimeout(w.timer); w.resolve(m); } else c.msgs.push(m); };
      const onData = d => {
        c.buf = Buffer.concat([c.buf, d]);
        for (;;) {
          const b = c.buf; if (b.length < 2) break;
          let len = b[1] & 0x7f, off = 2;
          if (len === 126) { if (b.length < 4) break; len = b.readUInt16BE(2); off = 4; } else if (len === 127) { if (b.length < 10) break; len = Number(b.readBigUInt64BE(2)); off = 10; }
          if (b.length < off + len) break;
          const op = b[0] & 0x0f, data = b.subarray(off, off + len); c.buf = b.subarray(off + len);
          if (op === 0x1) deliver(JSON.parse(data.toString()));
          if (op === 0x8) { c.closeCode = data.length >= 2 ? data.readUInt16BE(0) : 0; }
        }
      };
      socket.on('data', onData);
      if (head && head.length) setImmediate(() => onData(head));
      socket.on('close', () => { c.closed = true; });
      c.send = (obj, { unmasked = false } = {}) => {
        const p = Buffer.from(JSON.stringify(obj)), n = p.length, mask = crypto.randomBytes(4);
        const head = n < 126 ? Buffer.from([0x81, (unmasked ? 0 : 0x80) | n]) : Buffer.from([0x81, (unmasked ? 0 : 0x80) | 126, n >> 8, n & 255]);
        const body = Buffer.from(p); if (!unmasked) for (let i = 0; i < n; i++) body[i] ^= mask[i & 3];
        socket.write(Buffer.concat(unmasked ? [head, body] : [head, mask, body]));
      };
      c.next = (pred = () => true, ms = 5000) => {
        if (typeof pred === 'string') { const t = pred; pred = m => m.t === t; }
        const i = c.msgs.findIndex(pred); if (i >= 0) return Promise.resolve(c.msgs.splice(i, 1)[0]);
        return new Promise((res2, rej2) => { const w = { pred, resolve: res2, timer: setTimeout(() => { c.waiters.splice(c.waiters.indexOf(w), 1); rej2(new Error('timeout waiting for message')); }, ms) }; c.waiters.push(w); });
      };
      c.close = () => socket.destroy();
      resolve(c);
    });
    req.end();
  });
}
module.exports.wsConnect = wsConnect;
