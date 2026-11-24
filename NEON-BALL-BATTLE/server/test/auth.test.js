'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, Client, S_ } = require('./helpers');
const { createOwner, confirmTotp } = require('../cli/owner');

let srv;
test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv.stop(); });

test('register, session cookie, me, logout', async () => {
  const c = new Client(srv.base);
  const r = await c.register('alice_1');
  assert.equal(r.status, 200);
  assert.equal(r.data.user.username, 'alice_1');
  assert.equal(r.data.user.isOwner, false);
  assert.equal(r.data.recoveryCodes.length, 10);
  const me = await c.get('/api/auth/me');
  assert.equal(me.data.user.username, 'alice_1');
  assert.ok(me.data.csrf);
  await c.post('/api/auth/logout');
  assert.equal((await c.get('/api/auth/me')).data.user, null);
});

test('weak passwords and duplicate / reserved usernames are rejected', async () => {
  const c = new Client(srv.base);
  assert.equal((await c.post('/api/auth/register', { username: 'bob_1', password: 'short' })).status, 400);
  assert.equal((await c.post('/api/auth/register', { username: 'bob_1', password: 'password123' })).status, 400);
  assert.equal((await c.post('/api/auth/register', { username: 'admin_x', password: 'Sup3r-Secret-Pass!' })).status, 400);
  assert.equal((await c.register('bob_1')).status, 200);
  assert.equal((await new Client(srv.base).register('BOB_1')).status, 400);
});

test('CSRF token and same-origin are required for state changes', async () => {
  const c = new Client(srv.base);
  await c.register('carol_1');
  const noToken = await c.post('/api/auth/logout-all', {}, { 'x-csrf-token': 'wrong' });
  assert.equal(noToken.status, 403);
  assert.equal(noToken.data.code, 'CSRF');
  const evil = await c.post('/api/auth/logout-all', {}, { origin: 'https://evil.example' });
  assert.equal(evil.status, 403);
  assert.equal(evil.data.code, 'BAD_ORIGIN');
});

test('players cannot promote themselves (mass assignment ignored, single owner enforced by DB)', async () => {
  const c = new Client(srv.base);
  const r = await c.post('/api/auth/register', { username: 'mallory_1', password: 'Sup3r-Secret-Pass!', role: 'owner', isOwner: true });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.isOwner, false);
  assert.equal(srv.db.get('SELECT role FROM users WHERE username = ?', 'mallory_1').role, 'player');
  await createOwner(srv.db, { username: 'TheOwner', password: 'Owner-Pass-9876!' });
  await assert.rejects(createOwner(srv.db, { username: 'Owner2', password: 'Owner-Pass-9876!' }), /already exists/);
  assert.throws(() => srv.db.run("UPDATE users SET role = 'owner' WHERE username = 'mallory_1'"), /UNIQUE/);
});

test('owner login requires the TOTP code; codes cannot be replayed', async () => {
  const u = srv.db.get("SELECT totp_pending FROM users WHERE role = 'owner'");
  const code = S_.totpCode(u.totp_pending, Math.floor(Date.now() / 30000));
  assert.equal(confirmTotp(srv.db, code), true);
  const c = new Client(srv.base);
  const noCode = await c.post('/api/auth/login', { username: 'TheOwner', password: 'Owner-Pass-9876!' });
  assert.equal(noCode.status, 401);
  assert.equal(noCode.data.code, 'MFA_REQUIRED');
  const secret = srv.db.get("SELECT totp_secret FROM users WHERE role = 'owner'").totp_secret;
  const replay = await c.post('/api/auth/login', { username: 'TheOwner', password: 'Owner-Pass-9876!', code });
  assert.equal(replay.status, 401, 'the code used during setup must not work twice');
  const next = S_.totpCode(secret, Math.floor(Date.now() / 30000) + 1);
  const ok = await c.post('/api/auth/login', { username: 'TheOwner', password: 'Owner-Pass-9876!', code: next });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.isOwner, true);
  assert.equal(ok.data.user.ownerVerified, true);
});

test('failed logins lock the account; unknown users get the same error', async () => {
  const c = new Client(srv.base);
  await c.register('dave_1');
  const other = new Client(srv.base);
  const unknown = await other.post('/api/auth/login', { username: 'nobody_here', password: 'whatever-123' });
  assert.equal(unknown.status, 401);
  let last;
  for (let i = 0; i < 9; i++) last = await other.post('/api/auth/login', { username: 'dave_1', password: 'wrong-password-' + i });
  assert.ok([401, 429].includes(last.status));
  const locked = await other.post('/api/auth/login', { username: 'dave_1', password: 'Sup3r-Secret-Pass!' });
  assert.equal(locked.status, 429);
  assert.ok(srv.db.get("SELECT COUNT(*) n FROM security_events WHERE kind = 'login_lockout'").n >= 1);
});

test('account recovery with a single-use recovery code', async () => {
  const c = new Client(srv.base);
  const reg = await c.register('erin_1');
  const code = reg.data.recoveryCodes[0];
  const anon = new Client(srv.base);
  const ok = await anon.post('/api/auth/recover', { username: 'erin_1', recoveryCode: code, newPassword: 'Brand-New-Pass-42' });
  assert.equal(ok.status, 200);
  const again = await anon.post('/api/auth/recover', { username: 'erin_1', recoveryCode: code, newPassword: 'Another-Pass-4242' });
  assert.equal(again.status, 401);
  assert.equal((await c.get('/api/auth/me')).data.user, null, 'old sessions are revoked after recovery');
  assert.equal((await anon.post('/api/auth/login', { username: 'erin_1', password: 'Brand-New-Pass-42' })).status, 200);
});

test('player 2FA setup / enable', async () => {
  const c = new Client(srv.base);
  await c.register('frank_1');
  const s = await c.post('/api/auth/2fa/setup');
  assert.match(s.data.otpauth, /^otpauth:\/\/totp\//);
  const en = await c.post('/api/auth/2fa/enable', { code: S_.totpCode(s.data.secret, Math.floor(Date.now() / 30000)) });
  assert.equal(en.status, 200);
  assert.equal(en.data.recoveryCodes.length, 10);
  assert.equal((await c.get('/api/auth/me')).data.user.totpEnabled, true);
});

test('registration is rate limited per network', async () => {
  const s2 = await startServer({ limits: { registerPerHour: 5 } });
  try {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await new Client(s2.base).register('rl_user_' + i)).status);
    assert.deepEqual(statuses.slice(0, 5), [200, 200, 200, 200, 200]);
    assert.equal(statuses[5], 429);
  } finally { await s2.stop(); }
});
