'use strict';
/** Entry point: `npm start` */
const { buildConfig, validateConfig } = require('./config');
const { createGameServer } = require('./app');

const cfg = buildConfig();
const { errors, warnings } = validateConfig(cfg);
for (const w of warnings) console.warn('[config] warning:', w);
if (errors.length) { for (const e of errors) console.error('[config] ERROR:', e); console.error('Refusing to start. Fix the settings above (see .env.example).'); process.exit(1); }

const game = createGameServer(cfg);
game.server.listen(cfg.port, cfg.host, () => {
  console.log(`NEON BALL BATTLE server ${cfg.env} listening on http://${cfg.host}:${cfg.port}  (public origin ${cfg.appOrigin})`);
  console.log(`Payments: ${cfg.payments.mode.toUpperCase()}${cfg.payments.mode === 'live' ? '' : ' (no real charges)'}`);
  const owner = game.db.get("SELECT username, totp_enabled FROM users WHERE role = 'owner'");
  if (!owner) console.log('No owner account yet. Create it with:  npm run owner -- create --username <name>');
  else if (!owner.totp_enabled) console.log('Owner account has no 2FA yet. Run:  npm run owner -- reset-2fa');
});
const shutdown = sig => { console.log(`\n${sig} received, shutting down…`); game.close().then(() => process.exit(0)); setTimeout(() => process.exit(1), 8000).unref(); };
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));
