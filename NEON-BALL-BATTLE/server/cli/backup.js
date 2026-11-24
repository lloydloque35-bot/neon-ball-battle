#!/usr/bin/env node
'use strict';
/**
 * Database backup & restore.
 *   npm run backup                         consistent snapshot into BACKUP_DIR (keeps the newest 30)
 *   npm run backup -- restore <file.db>    restore a snapshot (STOP THE SERVER FIRST)
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildConfig } = require('../config');
const { DB } = require('../db');

const cfg = buildConfig();
const [cmd, file] = process.argv.slice(2);
if (cmd === 'restore') {
  if (!file || !fs.existsSync(file)) { console.error('✖ Usage: npm run backup -- restore <path/to/backup.db>'); process.exit(1); }
  const check = new DB(file); const ok = check.get('PRAGMA integrity_check'); check.close();
  if (!ok || Object.values(ok)[0] !== 'ok') { console.error('✖ Backup failed the integrity check; not restoring.'); process.exit(1); }
  if (fs.existsSync(cfg.dbFile)) { const keep = cfg.dbFile + '.before-restore-' + Date.now(); fs.renameSync(cfg.dbFile, keep); console.log('Previous database kept at', keep); }
  for (const ext of ['-wal', '-shm']) fs.rmSync(cfg.dbFile + ext, { force: true });
  fs.copyFileSync(file, cfg.dbFile);
  console.log('✔ Restored', file, '→', cfg.dbFile, '\nStart the server again: npm start');
} else {
  const db = new DB(cfg.dbFile); db.migrate();
  const target = path.join(cfg.backupDir, `game-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  db.backup(target); db.close();
  const all = fs.readdirSync(cfg.backupDir).filter(f => /^game-.*\.db$/.test(f)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.rmSync(path.join(cfg.backupDir, old));
  console.log('✔ Backup written:', target);
}
