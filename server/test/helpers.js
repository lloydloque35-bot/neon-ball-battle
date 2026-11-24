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
