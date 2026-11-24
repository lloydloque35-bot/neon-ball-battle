'use strict';
/**
 * Accounts, sessions, 2FA, recovery and role checks.
 *
 * Security model
 *  - Passwords: scrypt. Sessions: random 256-bit token in an HttpOnly, SameSite=Strict (and Secure in production) cookie;
 *    only its SHA-256 is stored. Each session has its own CSRF token required on every state-changing request.
 *  - Roles: 'player' (everyone) and 'owner' (exactly one, created ONLY with the server CLI). No API can change a role.
 *  - Owner dashboard access requires: owner role + TOTP 2FA enabled + a 2FA check within ADMIN_MFA_MAX_AGE_MIN.
 *  - Premium is a subscription flag and never grants any admin permission.
 */
const S_ = require('./security');
const { HttpError, bad, cookie } = require('./http');

const SID = 'nbb_sid';
const STARTERS = ['fire', 'ice', 'thunder', 'water', 'earth', 'wind'];
const now = () => Date.now();

function register(app, S) {
  const { db, cfg, limiter } = S;

  /* ---------- session + CSRF middleware ---------- */
  app.use(async ctx => {
    ctx.user = null; ctx.session = null;
    const tok = ctx.cookies[SID];
    if (tok && tok.length < 200) {
      const row = db.get(`SELECT s.*, u.username, u.role, u.status, u.suspended_until, u.status_reason, u.totp_enabled, u.email
        FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, S_.sha256(tok));
      if (row && row.expires_at > now() && row.status !== 'banned') {
        ctx.session = row;
        ctx.user = { id: row.user_id, username: row.username, role: row.role, status: row.status, suspendedUntil: row.suspended_until, totpEnabled: !!row.totp_enabled, email: row.email };
        if (row.status === 'suspended' && row.suspended_until && row.suspended_until <= now()) {
          db.run("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?", row.user_id); ctx.user.status = 'active';
        }
        if (now() - row.last_seen > 30000) db.run('UPDATE sessions SET last_seen = ? WHERE id = ?', now(), row.id);
      } else if (row) {
        db.run('DELETE FROM sessions WHERE id = ?', row.id);
        ctx.setCookies.push(cookie(SID, '', { secure: cfg.cookieSecure, maxAge: 0 }));
      }
    }
    if (ctx.method !== 'GET' && !ctx.route.opts.noCsrf) {
      const origin = ctx.headers.origin;
      if (origin) {
        let host = ''; try { host = new URL(origin).host; } catch { /* invalid */ }
        if (origin !== cfg.appOrigin && host !== ctx.headers.host) throw new HttpError(403, 'Cross-site request blocked', 'BAD_ORIGIN');
      }
      if (ctx.session && !S_.safeEqual(ctx.headers['x-csrf-token'] || '', ctx.session.csrf)) throw new HttpError(403, 'Security token missing or expired. Reload the page.', 'CSRF');
    }
  });

  /* ---------- helpers ---------- */
  function limit(ctx, key, max, windowMs, msg = 'Too many requests. Please slow down.') {
    if (!limiter.hit(key, max, windowMs)) { S.secEvent(ctx.user?.id, 'rate_limited', 1, { key: key.replace(/:[^:]*$/, '') }, ctx.ip); throw new HttpError(429, msg, 'RATE_LIMIT'); }
  }
  function createSession(ctx, user, mfaVerified) {
    const token = S_.randomToken(32), csrf = S_.randomToken(24), t = now();
    const ttl = user.role === 'owner' ? 12 * 3600e3 : cfg.sessionDays * 86400e3;
    db.run('INSERT INTO sessions (id, user_id, csrf, created_at, last_seen, expires_at, mfa_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      S_.sha256(token), user.id, csrf, t, t, t + ttl, mfaVerified ? t : null, ctx.ip || null, String(ctx.headers['user-agent'] || '').slice(0, 200));
    ctx.setCookies.push(cookie(SID, token, { secure: cfg.cookieSecure, maxAge: ttl / 1000 }));
    return csrf;
  }
  function useRecoveryCode(userId, code) {
    const u = db.get('SELECT recovery_codes FROM users WHERE id = ?', userId);
    const list = JSON.parse(u.recovery_codes || '[]'), h = S_.sha256(S_.normCode(code));
    const i = list.indexOf(h); if (i < 0) return false;
    list.splice(i, 1); db.run('UPDATE users SET recovery_codes = ? WHERE id = ?', JSON.stringify(list), userId);
    return true;
  }
  /** TOTP or (single-use) recovery code; updates the replay counter */
  function checkSecondFactor(userRow, code) {
    const ctr = S_.verifyTotp(userRow.totp_secret, code, userRow.totp_last_counter);
    if (ctr > 0) { db.run('UPDATE users SET totp_last_counter = ? WHERE id = ?', ctr, userRow.id); return true; }
    if (String(code || '').replace(/[^A-Za-z0-9]/g, '').length >= 10) return useRecoveryCode(userRow.id, code);
    return false;
  }
  function me(ctx) {
    if (!ctx.user) return { user: null, payments: S.paymentsPublic() };
    const u = ctx.user, rc = JSON.parse(db.get('SELECT recovery_codes FROM users WHERE id = ?', u.id).recovery_codes || '[]').length;
    return {
      user: {
        id: u.id, username: u.username, isOwner: u.role === 'owner', ownerVerified: S.ownerVerified(ctx), status: u.status, statusReason: ctx.session.status_reason || null,
        suspendedUntil: u.suspendedUntil, totpEnabled: u.totpEnabled, email: u.email ? u.email.replace(/^(.).*(@.*)$/, '$1***$2') : null, recoveryCodesLeft: rc,
      },
      csrf: ctx.session.csrf, premium: S.premiumOf(u.id), payments: S.paymentsPublic(),
    };
  }
  S.ownerVerified = ctx => !!(ctx.user && ctx.user.role === 'owner' && ctx.user.totpEnabled && ctx.session.mfa_at && now() - ctx.session.mfa_at < cfg.adminMfaMaxAgeMin * 60e3);
  S.requireUser = ctx => { if (!ctx.user) throw new HttpError(401, 'Please sign in', 'AUTH'); return ctx.user; };
  S.requirePlayable = ctx => {
    const u = S.requireUser(ctx);
    if (u.status === 'suspended') throw new HttpError(403, `Your account is suspended${u.suspendedUntil ? ' until ' + new Date(u.suspendedUntil).toUTCString() : ''}.`, 'SUSPENDED');
    return u;
  };
  /** Owner-only gate (server side). The UI hiding a button is never relied on. */
  S.requireOwner = ctx => {
    const u = S.requireUser(ctx);
    if (u.role !== 'owner') { S.secEvent(u.id, 'admin_denied', 2, { path: ctx.path }, ctx.ip); throw new HttpError(403, 'Owner access only', 'FORBIDDEN'); }
    if (!u.totpEnabled) throw new HttpError(403, 'Two-factor authentication must be enabled for the owner account', 'MFA_SETUP');
    if (!S.ownerVerified(ctx)) throw new HttpError(401, 'Enter your 2FA code to continue', 'MFA_REQUIRED');
    db.run('UPDATE sessions SET mfa_at = ? WHERE id = ?', now(), ctx.session.id);   // sliding idle window
    return u;
  };
  S.limit = limit;
  S.STARTERS = STARTERS;

  /* ---------- routes ---------- */
  app.get('/api/auth/me', ctx => me(ctx));

  app.post('/api/auth/register', async ctx => {
    limit(ctx, 'reg:' + ctx.ip, cfg.limits.registerPerHour, 3600e3, 'Too many accounts created from this network. Try again later.');
    const { username, password, email } = ctx.body;
    const err = S_.validateUsername(username) || S_.validatePassword(password, username) || S_.validateEmail(email);
    if (err) throw bad(err);
    if (db.get('SELECT 1 FROM users WHERE username = ?', username)) throw bad('That username is taken');
    if (email && db.get('SELECT 1 FROM users WHERE email = ?', email)) throw bad('That email is already registered');
    const hash = await S_.hashPassword(password), rc = S_.newRecoveryCodes(), t = now();
    const user = db.tx(() => {
      const r = db.run("INSERT INTO users (username, email, pass_hash, role, recovery_codes, created_at, last_login_at) VALUES (?, ?, ?, 'player', ?, ?, ?)", username, email || null, hash, JSON.stringify(rc.hashes), t, t);
      const id = Number(r.lastInsertRowid);
      db.run('INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)', id, t);
      for (const b of STARTERS) db.run("INSERT INTO user_balls (user_id, ball_id, owned, source, unlocked_at) VALUES (?, ?, 1, 'starter', ?)", id, b, t);
      db.run("INSERT INTO subscriptions (user_id, status, updated_at) VALUES (?, 'free', ?)", id, t);
      return { id, role: 'player' };
    });
    S.audit(user.id, 'account.register', username, ctx.ip);
    const csrf = createSession(ctx, user, false);
    ctx.user = { id: user.id, username, role: 'player', status: 'active', totpEnabled: false, email };
    ctx.session = { csrf, status_reason: null, mfa_at: null };
    return { ...me(ctx), recoveryCodes: rc.codes };
  });

  app.post('/api/auth/login', async ctx => {
    const { username, password, code } = ctx.body;
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || password.length > 128) throw bad('Enter your username and password');
    limit(ctx, 'login:' + ctx.ip, 20, 600e3, 'Too many sign-in attempts. Wait a few minutes.');
    limit(ctx, 'loginu:' + username.toLowerCase(), 10, 600e3, 'Too many sign-in attempts for this account. Wait a few minutes.');
    const u = db.get('SELECT * FROM users WHERE username = ? OR email = ?', username, username);
    if (!u) { await S_.dummyVerify(password); throw new HttpError(401, 'Wrong username or password', 'BAD_LOGIN'); }
    if (u.locked_until && u.locked_until > now()) throw new HttpError(429, `Account temporarily locked after failed attempts. Try again in ${Math.ceil((u.locked_until - now()) / 60000)} min.`, 'LOCKED');
    const fail = () => {
      const n = u.failed_logins + 1, lock = n >= 8 ? now() + 15 * 60e3 : null;
      db.run('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', lock ? 0 : n, lock, u.id);
      if (lock) S.secEvent(u.id, 'login_lockout', u.role === 'owner' ? 3 : 2, {}, ctx.ip);
      throw new HttpError(401, 'Wrong username, password or code', 'BAD_LOGIN');
    };
    if (!(await S_.verifyPassword(password, u.pass_hash))) fail();
    let mfa = false;
    if (u.totp_enabled) {
      if (!code) throw new HttpError(401, 'Enter the 6-digit code from your authenticator app', 'MFA_REQUIRED');
      if (!checkSecondFactor(u, code)) fail();
      mfa = true;
    }
    if (u.status === 'banned') throw new HttpError(403, 'This account has been banned' + (u.status_reason ? ': ' + u.status_reason : ''), 'BANNED');
    db.run('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', now(), u.id);
    if (u.role === 'owner') S.audit(u.id, 'owner.login', null, ctx.ip, { mfa });
    const csrf = createSession(ctx, u, mfa);
    ctx.user = { id: u.id, username: u.username, role: u.role, status: u.status, suspendedUntil: u.suspended_until, totpEnabled: !!u.totp_enabled, email: u.email };
    ctx.session = { csrf, status_reason: u.status_reason, mfa_at: mfa ? now() : null };
    return me(ctx);
  });

  app.post('/api/auth/logout', ctx => {
    if (ctx.session) db.run('DELETE FROM sessions WHERE id = ?', ctx.session.id);
    ctx.setCookies.push(cookie(SID, '', { secure: cfg.cookieSecure, maxAge: 0 }));
    return { ok: true };
  });
  app.post('/api/auth/logout-all', ctx => {
    const u = S.requireUser(ctx); db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
    ctx.setCookies.push(cookie(SID, '', { secure: cfg.cookieSecure, maxAge: 0 }));
    return { ok: true };
  });

  /* step-up 2FA (owner dashboard) */
  app.post('/api/auth/mfa', ctx => {
    const u = S.requireUser(ctx);
    limit(ctx, 'mfa:' + u.id, 8, 300e3);
    const row = db.get('SELECT * FROM users WHERE id = ?', u.id);
    if (!row.totp_enabled) throw bad('Two-factor authentication is not enabled');
    if (!checkSecondFactor(row, ctx.body.code)) { S.secEvent(u.id, 'mfa_failed', u.role === 'owner' ? 2 : 1, {}, ctx.ip); throw new HttpError(401, 'Wrong code', 'BAD_CODE'); }
    db.run('UPDATE sessions SET mfa_at = ? WHERE id = ?', now(), ctx.session.id);
    ctx.session.mfa_at = now();
    if (u.role === 'owner') S.audit(u.id, 'owner.mfa_verified', null, ctx.ip);
    return me(ctx);
  });

  app.post('/api/auth/2fa/setup', ctx => {
    const u = S.requireUser(ctx);
    if (u.totpEnabled) throw bad('Two-factor authentication is already on');
    const secret = S_.newTotpSecret();
    db.run('UPDATE users SET totp_pending = ? WHERE id = ?', secret, u.id);
    return { secret, otpauth: S_.otpauthUrl(secret, u.username) };
  });
  app.post('/api/auth/2fa/enable', ctx => {
    const u = S.requireUser(ctx);
    const row = db.get('SELECT totp_pending FROM users WHERE id = ?', u.id);
    const ctr = S_.verifyTotp(row.totp_pending, ctx.body.code, 0);
    if (ctr < 0) throw bad('That code did not match. Check your authenticator app clock and try again.');
    const rc = S_.newRecoveryCodes();
    db.run('UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled = 1, totp_last_counter = ?, recovery_codes = ? WHERE id = ?', ctr, JSON.stringify(rc.hashes), u.id);
    db.run('UPDATE sessions SET mfa_at = ? WHERE id = ?', now(), ctx.session.id);
    S.audit(u.id, 'account.2fa_enabled', null, ctx.ip);
    return { ok: true, recoveryCodes: rc.codes };
  });
  app.post('/api/auth/2fa/disable', async ctx => {
    const u = S.requireUser(ctx);
    if (u.role === 'owner') throw new HttpError(403, 'The owner account must keep 2FA. Use the server CLI to reset it.', 'FORBIDDEN');
    const row = db.get('SELECT * FROM users WHERE id = ?', u.id);
    if (!(await S_.verifyPassword(ctx.body.password || '', row.pass_hash)) || !checkSecondFactor(row, ctx.body.code)) throw new HttpError(401, 'Password or code is wrong', 'BAD_LOGIN');
    db.run('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', u.id);
    S.audit(u.id, 'account.2fa_disabled', null, ctx.ip);
    return { ok: true };
  });

  app.post('/api/auth/password', async ctx => {
    const u = S.requireUser(ctx);
    limit(ctx, 'pw:' + u.id, 5, 600e3);
    const row = db.get('SELECT pass_hash FROM users WHERE id = ?', u.id);
    if (!(await S_.verifyPassword(ctx.body.current || '', row.pass_hash))) throw new HttpError(401, 'Current password is wrong', 'BAD_LOGIN');
    const err = S_.validatePassword(ctx.body.next, u.username); if (err) throw bad(err);
    db.run('UPDATE users SET pass_hash = ? WHERE id = ?', await S_.hashPassword(ctx.body.next), u.id);
    db.run('DELETE FROM sessions WHERE user_id = ? AND id <> ?', u.id, ctx.session.id);
    S.audit(u.id, 'account.password_changed', null, ctx.ip);
    return { ok: true };
  });
  app.post('/api/auth/recovery-codes', async ctx => {
    const u = S.requireUser(ctx);
    const row = db.get('SELECT pass_hash FROM users WHERE id = ?', u.id);
    if (!(await S_.verifyPassword(ctx.body.password || '', row.pass_hash))) throw new HttpError(401, 'Password is wrong', 'BAD_LOGIN');
    const rc = S_.newRecoveryCodes(); db.run('UPDATE users SET recovery_codes = ? WHERE id = ?', JSON.stringify(rc.hashes), u.id);
    S.audit(u.id, 'account.recovery_codes_regenerated', null, ctx.ip);
    return { recoveryCodes: rc.codes };
  });

  /* account recovery with a recovery code (works without email — e.g. after changing phones) */
  app.post('/api/auth/recover', async ctx => {
    limit(ctx, 'recover:' + ctx.ip, 10, 3600e3);
    const { username, recoveryCode, newPassword } = ctx.body;
    if (typeof username !== 'string' || typeof recoveryCode !== 'string') throw bad('Enter your username and a recovery code');
    const u = db.get('SELECT * FROM users WHERE username = ?', username);
    if (!u || u.role === 'owner') { await S_.dummyVerify('x'); throw new HttpError(401, 'Recovery failed. Check the username and code.', 'BAD_RECOVERY'); }
    const err = S_.validatePassword(newPassword, username); if (err) throw bad(err);
    if (!useRecoveryCode(u.id, recoveryCode)) { S.secEvent(u.id, 'recovery_failed', 1, {}, ctx.ip); throw new HttpError(401, 'Recovery failed. Check the username and code.', 'BAD_RECOVERY'); }
    db.run('UPDATE users SET pass_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?', await S_.hashPassword(newPassword), u.id);
    db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
    S.audit(u.id, 'account.recovered', null, ctx.ip);
    return { ok: true };
  });
  /* email reset (only when a mail provider is configured) */
  app.post('/api/auth/forgot', async ctx => {
    limit(ctx, 'forgot:' + ctx.ip, 5, 3600e3);
    const email = String(ctx.body.email || '').slice(0, 254);
    if (!S.mail.enabled && cfg.isProd) return { ok: true, mail: false };
    const u = email && db.get("SELECT id, username FROM users WHERE email = ? AND role = 'player'", email);
    if (u) {
      const token = S_.randomToken(32);
      db.run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', S_.sha256(token), u.id, now() + 3600e3);
      await S.mail.send(email, 'Reset your Neon Ball Battle password', `Hi ${u.username},\n\nUse this link within 1 hour to choose a new password:\n${cfg.appOrigin}/#reset=${token}\n\nIf you did not ask for this, ignore this email.`);
    }
    return { ok: true, mail: true };
  });
  app.post('/api/auth/reset', async ctx => {
    limit(ctx, 'reset:' + ctx.ip, 10, 3600e3);
    const row = db.get('SELECT * FROM password_resets WHERE token_hash = ?', S_.sha256(String(ctx.body.token || '')));
    if (!row || row.used_at || row.expires_at < now()) throw bad('This reset link is invalid or has expired');
    const u = db.get('SELECT username FROM users WHERE id = ?', row.user_id);
    const err = S_.validatePassword(ctx.body.newPassword, u.username); if (err) throw bad(err);
    db.tx(() => {
      db.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', now(), row.token_hash);
      db.run('DELETE FROM sessions WHERE user_id = ?', row.user_id);
    });
    db.run('UPDATE users SET pass_hash = ? WHERE id = ?', await S_.hashPassword(ctx.body.newPassword), row.user_id);
    S.audit(row.user_id, 'account.password_reset', null, ctx.ip);
    return { ok: true };
  });
}

module.exports = { register, STARTERS };
