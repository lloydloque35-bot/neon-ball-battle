'use strict';
/**
 * Configuration from environment variables (optionally a local .env file).
 * Secrets are NEVER hard-coded and NEVER sent to the browser.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
if (!process.env.NBB_SKIP_DOTENV) loadEnvFile(path.join(ROOT, '.env'));

const env = process.env;
const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));
const int = (v, d) => (v === undefined || v === '' || isNaN(+v) ? d : Math.trunc(+v));

function buildConfig() {
  const isProd = env.NODE_ENV === 'production';
  const port = int(env.PORT, 8080);
  const cfg = {
    root: ROOT,
    env: env.NODE_ENV || 'development',
    isProd,
    port,
    host: env.HOST || (isProd ? '0.0.0.0' : '127.0.0.1'),
    // APP_ORIGIN, or the public URL that Render provides automatically
    appOrigin: (env.APP_ORIGIN || env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
    dbFile: env.DB_FILE || path.join(ROOT, 'data', 'game.db'),
    backupDir: env.BACKUP_DIR || path.join(ROOT, 'data', 'backups'),
    cookieSecure: bool(env.COOKIE_SECURE, isProd),
    trustProxy: bool(env.TRUST_PROXY, false),
    sessionDays: int(env.SESSION_DAYS, 30),
    adminMfaMaxAgeMin: int(env.ADMIN_MFA_MAX_AGE_MIN, 30),
    adminIdleMin: int(env.ADMIN_IDLE_MIN, 30),
    verifyWorkers: Math.max(1, int(env.VERIFY_WORKERS, 1)),
    maxBattleMinutes: int(env.MAX_BATTLE_MINUTES, 30),
    payments: {
      mode: (env.PAYMENTS_MODE || 'disabled').toLowerCase(),        // disabled | test | live
      secretKey: env.STRIPE_SECRET_KEY || '',
      webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
      priceId: env.STRIPE_PRICE_ID || '',
      liveConfirmed: bool(env.PAYMENTS_LIVE_CONFIRMED, false),
      apiBase: (env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/+$/, ''),
      autoRenew: bool(env.PREMIUM_AUTO_RENEW, true),
    },
    mail: { resendKey: env.RESEND_API_KEY || '', from: env.MAIL_FROM || '' },
    logLevel: env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    limits: { registerPerHour: int(env.LIMIT_REGISTER_PER_HOUR, 5) },
  };
  return cfg;
}

/** Refuses to start with unsafe or half-configured settings. */
function validateConfig(cfg) {
  const errors = [], warnings = [];
  const P = cfg.payments;
  if (!['disabled', 'test', 'live'].includes(P.mode)) errors.push('PAYMENTS_MODE must be disabled, test or live');
  if (P.mode === 'test') {
    if (!P.secretKey.startsWith('sk_test_')) errors.push('PAYMENTS_MODE=test requires a Stripe TEST secret key (sk_test_...)');
    if (!P.webhookSecret.startsWith('whsec_')) errors.push('STRIPE_WEBHOOK_SECRET (whsec_...) is required');
    if (!P.priceId.startsWith('price_')) errors.push('STRIPE_PRICE_ID (price_...) for the $200/year plan is required');
  }
  if (P.mode === 'live') {
    if (!P.liveConfirmed) errors.push('Live payments are locked. Complete Stripe merchant verification and compliance, then set PAYMENTS_LIVE_CONFIRMED=true');
    if (!P.secretKey.startsWith('sk_live_')) errors.push('PAYMENTS_MODE=live requires a LIVE secret key (sk_live_...)');
    if (!P.webhookSecret.startsWith('whsec_')) errors.push('STRIPE_WEBHOOK_SECRET is required');
    if (!P.priceId.startsWith('price_')) errors.push('STRIPE_PRICE_ID is required');
    if (!cfg.isProd) errors.push('Live payments only run with NODE_ENV=production');
  }
  if (P.mode !== 'live' && P.secretKey.startsWith('sk_live_')) errors.push('A LIVE Stripe key was supplied while PAYMENTS_MODE is not live — refusing to start');
  if (cfg.isProd && !cfg.cookieSecure) errors.push('COOKIE_SECURE must be true in production (serve the game over HTTPS)');
  if (cfg.isProd && !/^https:\/\//.test(cfg.appOrigin)) errors.push('APP_ORIGIN must be an https:// URL in production');
  if (!cfg.isProd && P.mode === 'disabled') warnings.push('Payments are disabled (PAYMENTS_MODE=disabled). Premium checkout will show as unavailable.');
  return { errors, warnings };
}

module.exports = { buildConfig, validateConfig, ROOT };
