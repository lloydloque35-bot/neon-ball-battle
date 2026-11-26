'use strict';
/** Assembles the game server: database, services, security middleware and feature modules. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DB } = require('./db');
const { App } = require('./http');
const { RateLimiter } = require('./security');
const { createLogger, createServices } = require('./services');
const { loadCore } = require('./core');

const VERSION = '2.3.1';

function createGameServer(cfg, opts = {}) {
  const log = opts.log || createLogger(cfg.logLevel);
  const db = new DB(cfg.dbFile);
  const applied = db.migrate();
  if (applied.length) log.info('[db] applied migrations:', applied.join(', '));
  const S = createServices({ cfg, db, log });
  S.limiter = new RateLimiter();
  S.core = loadCore();
  S.version = VERSION;
  const app = new App({ root: cfg.root, secure: cfg.cookieSecure, trustProxy: cfg.trustProxy, log });
  // order matters: billing defines premium helpers used by auth/game; auth installs the session middleware
  for (const mod of ['billing', 'auth', 'game', 'admin', 'season', 'pvp', 'shop']) {
    const file = path.join(__dirname, mod + '.js');
    if (fs.existsSync(file)) require(file).register(app, S);
  }
  app.get('/api/health', () => ({ ok: true, version: VERSION, time: Date.now(), payments: S.paymentsPublic ? S.paymentsPublic().enabled : false }));
  const server = http.createServer((req, res) => app.handle(req, res));
  server.on('upgrade', (req, socket, head) => { socket.on('error', () => socket.destroy()); if (S.onUpgrade) S.onUpgrade(req, socket, head); else socket.destroy(); });
  server.requestTimeout = 30000; server.headersTimeout = 15000; server.keepAliveTimeout = 5000;
  const timers = [];
  S.every = (ms, fn) => { const t = setInterval(() => { try { fn(); } catch (e) { log.error('[job]', e); } }, ms); t.unref?.(); timers.push(t); };
  S.every(3600e3, () => db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now()));
  if (S.startJobs) S.startJobs();
  return {
    app, server, db, S,
    async close() { timers.forEach(clearInterval); (S.closers || []).forEach(fn => fn()); await new Promise(r => server.close(() => r())); if (S.verifier) await S.verifier.close(); db.close(); },
  };
}

module.exports = { createGameServer, VERSION };
