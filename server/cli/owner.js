#!/usr/bin/env node
'use strict';
/**
 * Owner account management — the ONLY way to create or recover the owner (admin) account.
 * Runs on the server machine with direct database access; there is no web/API path to become owner.
 *
 *   npm run owner -- create --username <name>     create the single owner account (+ 2FA setup)
 *   npm run owner -- reset-2fa                    new 2FA secret for the owner (lost phone)
 *   npm run owner -- reset-password               set a new owner password
 *   npm run owner -- status                       show owner account status
 */
const readline = require('node:readline');
const { buildConfig } = require('../config');
const { DB } = require('../db');
const S_ = require('../security');

function ask(q, hidden) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(q); };
    rl.question(q, a => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
  });
}

async function createOwner(db, { username, password }) {
  if (db.get("SELECT 1 FROM users WHERE role = 'owner'")) throw new Error('An owner account already exists. Only one owner is allowed.');
  const err = S_.validatePassword(password, username) || (/^[A-Za-z0-9_]{3,20}$/.test(username) ? null : 'Username must be 3-20 letters, numbers or underscores');
  if (err) throw new Error(err);
  if (db.get('SELECT 1 FROM users WHERE username = ?', username)) throw new Error('That username is taken');
  const hash = await S_.hashPassword(password), secret = S_.newTotpSecret(), rc = S_.newRecoveryCodes(), t = Date.now();
  db.tx(() => {
    const r = db.run("INSERT INTO users (username, pass_hash, role, totp_pending, recovery_codes, created_at) VALUES (?, ?, 'owner', ?, ?, ?)", username, hash, secret, JSON.stringify(rc.hashes), t);
    const id = Number(r.lastInsertRowid);
    db.run('INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)', id, t);
    db.run("INSERT INTO subscriptions (user_id, status, updated_at) VALUES (?, 'free', ?)", id, t);
    db.run('INSERT INTO audit_logs (actor_id, action, target, created_at) VALUES (?, ?, ?, ?)', id, 'owner.created_by_cli', username, t);
  });
  return { secret, recoveryCodes: rc.codes, otpauth: S_.otpauthUrl(secret, username) };
}
/** activates the pending TOTP secret after the owner proves they scanned it */
function confirmTotp(db, code) {
  const u = db.get("SELECT id, totp_pending FROM users WHERE role = 'owner'");
  if (!u || !u.totp_pending) throw new Error('No pending 2FA setup');
  const ctr = S_.verifyTotp(u.totp_pending, code, 0);
  if (ctr < 0) return false;
  db.run('UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled = 1, totp_last_counter = ? WHERE id = ?', ctr, u.id);
  db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
  return true;
}

async function setup2fa(db, username) {
  const secret = S_.newTotpSecret();
  db.run("UPDATE users SET totp_pending = ?, totp_enabled = 0, totp_secret = NULL WHERE role = 'owner'", secret);
  console.log('\nScan this in an authenticator app (Google Authenticator, 1Password, Authy…):');
  console.log('  ' + S_.otpauthUrl(secret, username));
  console.log('or enter the secret manually:  ' + secret.match(/.{1,4}/g).join(' '));
  for (let i = 0; i < 5; i++) {
    const code = await ask('Enter the 6-digit code shown in the app: ');
    if (confirmTotp(db, code)) { console.log('✔ Two-factor authentication is active for the owner account.'); return; }
    console.log('That code did not match. Check the phone clock and try again.');
  }
  throw new Error('2FA was not confirmed — the owner cannot open the Admin Dashboard until it is. Run reset-2fa again.');
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = n => { const i = rest.indexOf('--' + n); return i >= 0 ? rest[i + 1] : undefined; };
  const db = new DB(buildConfig().dbFile); db.migrate();
  try {
    if (cmd === 'create') {
      const username = arg('username') || await ask('Owner username: ');
      const password = process.env.NBB_OWNER_PASSWORD || await ask('Owner password (min 10 chars): ', true);
      if (!process.env.NBB_OWNER_PASSWORD && password !== await ask('Repeat password: ', true)) throw new Error('Passwords do not match');
      const r = await createOwner(db, { username, password });
      console.log('\n✔ Owner account created:', username);
      console.log('\nRECOVERY CODES (store them offline; each works once):\n  ' + r.recoveryCodes.join('\n  '));
      db.run("UPDATE users SET totp_pending = NULL WHERE role = 'owner'");
      await setup2fa(db, username);
    } else if (cmd === 'reset-2fa') {
      const u = db.get("SELECT username FROM users WHERE role = 'owner'"); if (!u) throw new Error('No owner account');
      await setup2fa(db, u.username);
      db.run('INSERT INTO audit_logs (action, target, created_at) VALUES (?, ?, ?)', 'owner.2fa_reset_by_cli', u.username, Date.now());
    } else if (cmd === 'reset-password') {
      const u = db.get("SELECT id, username FROM users WHERE role = 'owner'"); if (!u) throw new Error('No owner account');
      const pw = await ask('New owner password: ', true); if (pw !== await ask('Repeat: ', true)) throw new Error('Passwords do not match');
      const err = S_.validatePassword(pw, u.username); if (err) throw new Error(err);
      db.run('UPDATE users SET pass_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?', await S_.hashPassword(pw), u.id);
      db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
      db.run('INSERT INTO audit_logs (actor_id, action, created_at) VALUES (?, ?, ?)', u.id, 'owner.password_reset_by_cli', Date.now());
      console.log('✔ Owner password changed; all owner sessions were signed out.');
    } else if (cmd === 'status') {
      const u = db.get("SELECT username, totp_enabled, last_login_at, locked_until FROM users WHERE role = 'owner'");
      console.log(u ? { username: u.username, twoFactor: !!u.totp_enabled, lastLogin: u.last_login_at && new Date(u.last_login_at).toISOString(), locked: !!(u.locked_until && u.locked_until > Date.now()) } : 'No owner account');
    } else {
      console.log('Usage: npm run owner -- create --username <name> | reset-2fa | reset-password | status');
    }
  } catch (e) { console.error('✖', e.message); process.exitCode = 1; } finally { db.close(); }
}

if (require.main === module) main();
module.exports = { createOwner, confirmTotp };
