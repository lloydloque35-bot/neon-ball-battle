'use strict';
/** Shared services: logging, audit log, suspicious-activity log, mail. */

function createLogger(level = 'info') {
  const order = { debug: 10, info: 20, warn: 30, error: 40 };
  const min = order[level] ?? 20;
  const out = (lvl, args) => { if (order[lvl] >= min) (lvl === 'error' ? console.error : console.log)(new Date().toISOString(), lvl.toUpperCase(), ...args); };
  return { debug: (...a) => out('debug', a), info: (...a) => out('info', a), warn: (...a) => out('warn', a), error: (...a) => out('error', a) };
}

function createServices({ cfg, db, log }) {
  const S = { cfg, db, log };
  S.audit = (actorId, action, target, ip, details) =>
    db.run('INSERT INTO audit_logs (actor_id, action, target, ip, details, created_at) VALUES (?, ?, ?, ?, ?, ?)', actorId ?? null, action, target ?? null, ip ?? null, details ? JSON.stringify(details) : null, Date.now());
  S.secEvent = (userId, kind, severity, details, ip) => {
    db.run('INSERT INTO security_events (user_id, kind, severity, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)', userId ?? null, kind, severity, details ? JSON.stringify(details) : null, ip ?? null, Date.now());
    if (severity >= 2) log.warn('[security]', kind, 'user', userId, JSON.stringify(details || {}));
  };
  /** Sends mail through the Resend HTTP API when configured; otherwise (development only) prints it to the console. */
  S.mail = {
    enabled: !!(cfg.mail.resendKey && cfg.mail.from),
    async send(to, subject, text) {
      if (this.enabled) {
        const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${cfg.mail.resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: cfg.mail.from, to, subject, text }) });
        if (!r.ok) { log.error('[mail] send failed', r.status); return false; }
        return true;
      }
      if (!cfg.isProd) { log.info(`[mail:dev] to=${to} subject="${subject}"\n${text}`); return true; }
      return false;
    },
  };
  return S;
}

module.exports = { createLogger, createServices };
