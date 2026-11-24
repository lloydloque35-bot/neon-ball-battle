'use strict';
/** Entry point: `npm start` */
const { buildConfig, validateConfig } = require('./config');
const os = require('node:os');
const { createGameServer } = require('./app');

/** This PC's addresses on the local network (Wi-Fi / LAN), home-router style addresses first. */
function lanAddresses() {
  const rank = ip => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return Object.values(os.networkInterfaces()).flat()
    .filter(a => a && (a.family === 'IPv4' || a.family === 4) && !a.internal)
    .map(a => a.address).sort((a, b) => rank(a) - rank(b));
}

const cfg = buildConfig();
const { errors, warnings } = validateConfig(cfg);
for (const w of warnings) console.warn('[config] warning:', w);
if (errors.length) { for (const e of errors) console.error('[config] ERROR:', e); console.error('Refusing to start. Fix the settings above (see .env.example).'); process.exit(1); }

const game = createGameServer(cfg);
game.server.listen(cfg.port, cfg.host, () => {
  console.log(`NEON BALL BATTLE server ${cfg.env} listening on http://${cfg.host}:${cfg.port}  (public origin ${cfg.appOrigin})`);
  console.log(`Payments: ${cfg.payments.mode.toUpperCase()}${cfg.payments.mode === 'live' ? '' : ' (no real charges)'}`);
  if (!cfg.isProd && (cfg.host === '0.0.0.0' || cfg.host === '::')) {
    const ips = lanAddresses();
    if (ips.length) {
      console.log('');
      console.log('PHONE / TABLET on the same Wi-Fi: type this link in the phone browser');
      ips.forEach((ip, i) => console.log(`   http://${ip}:${cfg.port}${i === 0 ? '' : '   (try this one if the first does not open)'}`));
      console.log('');
    } else console.log('No Wi-Fi / network address found. Connect this PC to Wi-Fi first.');
  }
  const owner = game.db.get("SELECT username, totp_enabled FROM users WHERE role = 'owner'");
  if (!owner) console.log('No owner account yet. Create it with:  npm run owner -- create --username <name>');
  else if (!owner.totp_enabled) console.log('Owner account has no 2FA yet. Run:  npm run owner -- reset-2fa');
});
const shutdown = sig => { console.log(`\n${sig} received, shutting down…`); game.close().then(() => process.exit(0)); setTimeout(() => process.exit(1), 8000).unref(); };
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));
