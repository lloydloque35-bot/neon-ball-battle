'use strict';
/**
 * PRIVATE ADMIN API — owner only.
 * Every route calls S.requireOwner(): owner role (DB) + TOTP enabled + 2FA verified within ADMIN_MFA_MAX_AGE_MIN.
 * Every state change is written to the audit log. The owner account itself can never be suspended or banned here.
 */
const S_ = require('./security');
const { HttpError, bad } = require('./http');
const { json } = require('./db');

const now = () => Date.now();
const HEX = /^#[0-9a-fA-F]{6}$/;

function register(app, S) {
  const { db, core, cfg } = S;
  const owner = ctx => S.requireOwner(ctx);
  const A = (method, path, fn) => app[method](path, { bodyLimit: 256 * 1024 }, ctx => { const u = owner(ctx); S.limit(ctx, 'admin:' + u.id, 240, 60e3); return fn(ctx, u); });
  const str = (v, max, d = '') => (typeof v === 'string' ? v.trim().slice(0, max) : d);
  const num = (v, min, max, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

  /** Validates an owner-created ball definition. Every character is rendered procedurally as a sphere. */
  function sanitizeBall(d, id) {
    if (!d || typeof d !== 'object') throw bad('Missing ball definition');
    const name = str(d.name, 32); if (!name) throw bad('Give the ball a name');
    const ds = d.design || {};
    const color = (v, f) => (HEX.test(v) ? v : f);
    const skills = Array.isArray(d.skills) ? d.skills.slice(0, 4) : [];
    if (skills.length < 3) throw bad('Every ball needs at least 3 special abilities');
    const out = {
      id, name, desc: str(d.desc, 200), category: core.CATEGORIES.includes(d.category) ? d.category : 'Custom', rarity: core.RARITIES.includes(d.rarity) ? d.rarity : 'Epic',
      hp: num(d.hp, 20, 400, 100), atk: num(d.atk, 1, 150, 50), def: num(d.def, 1, 150, 50), spd: num(d.spd, 1, 130, 60), crit: num(d.crit, 0, 100, 15),
      ai: core.AI_TYPES.includes(d.ai) ? d.ai : 'intelligent',
      design: {
        c1: color(ds.c1, '#3a0ca3'), c2: color(ds.c2, '#4cc9f0'), c3: color(ds.c3, '#7b6cff'), pat: core.PATTERNS.includes(ds.pat) ? ds.pat : 'solid',
        deco: Array.isArray(ds.deco) ? [...new Set(ds.deco.filter(x => core.DECOS.includes(x)))] : [], sym: str(ds.sym, 2), glow: num(ds.glow, 0.4, 2, 1),
        rage: HEX.test(ds.rage) ? ds.rage : undefined, godC1: HEX.test(ds.godC1) ? ds.godC1 : undefined, godC2: HEX.test(ds.godC2) ? ds.godC2 : undefined, godC3: HEX.test(ds.godC3) ? ds.godC3 : undefined,
        sfx: ds.sfx && ['sine', 'triangle', 'square', 'sawtooth'].includes(ds.sfx.wave) ? { wave: ds.sfx.wave, pitch: num(ds.sfx.pitch, 0.4, 2, 1) } : undefined,
      },
      skills: skills.map(s => {
        if (!core.SKILL_TYPES[s.type]) throw bad('Unknown ability type: ' + s.type);
        const k = { name: str(s.name, 28, 'Ability') || 'Ability', type: s.type, cd: num(s.cd, 1, 30, 6), power: num(s.power, 1, 150, 50), color: color(s.color, '#ffffff'), effect: core.EFFECTS.includes(s.effect) ? s.effect : 'none' };
        if (s.count != null) k.count = num(s.count, 1, 9, 3);
        return k;
      }),
      ult: (() => { const u = d.ult || {}; if (!core.ULT_TYPES[u.type]) throw bad('Unknown ultimate type'); return { name: str(u.name, 32, 'Ultimate') || 'Ultimate', type: u.type, power: num(u.power, 10, 150, 80), color: color(u.color, '#ffffff'), effect: core.EFFECTS.includes(u.effect) ? u.effect : 'none' }; })(),
      godMode: !!d.godMode, godName: str(d.godName, 40) || undefined, unlockAll: !!d.unlockAll, limited: !!d.limited || d.rarity === 'Limited', premium: !!d.premium,
      rageAtk: num(d.rageAtk, 1, 1.8, 1.3), rageSpd: num(d.rageSpd, 1, 1.6, 1.22), godDur: num(d.godDur, 6, 20, 12), godBoost: num(d.godBoost, 1.2, 2.2, 1.6),
    };
    if (out.rarity === 'Admin Exclusive') out.adminOnly = true;
    return JSON.parse(JSON.stringify(out));
  }

  /* ---------- overview & reports ---------- */
  A('get', '/api/admin/overview', () => {
    const t = now(), d30 = t - 30 * 86400e3, d7 = t - 7 * 86400e3, d1 = t - 86400e3;
    const c = sql => db.get(sql).n;
    return {
      users: { total: c("SELECT COUNT(*) n FROM users WHERE role = 'player'"), active7d: db.get("SELECT COUNT(*) n FROM users WHERE role = 'player' AND last_login_at > ?", d7).n,
        suspended: c("SELECT COUNT(*) n FROM users WHERE status = 'suspended'"), banned: c("SELECT COUNT(*) n FROM users WHERE status = 'banned'") },
      premium: { active: db.get("SELECT COUNT(*) n FROM subscriptions WHERE status = 'active' AND current_period_end > ?", t).n, byStatus: db.all('SELECT status, COUNT(*) n FROM subscriptions GROUP BY status') },
      revenue: { totalUsd: (db.get("SELECT COALESCE(SUM(amount_cents),0) s FROM payments WHERE (kind = 'invoice' AND status = 'paid') OR kind = 'refund'").s) / 100,
        last30Usd: (db.get("SELECT COALESCE(SUM(amount_cents),0) s FROM payments WHERE ((kind = 'invoice' AND status = 'paid') OR kind = 'refund') AND created_at > ?", d30).s) / 100, mode: cfg.payments.mode },
      battles: { total: c("SELECT COUNT(*) n FROM battles WHERE status = 'verified'"), today: db.get("SELECT COUNT(*) n FROM battles WHERE status = 'verified' AND finished_at > ?", d1).n,
        rejected7d: db.get("SELECT COUNT(*) n FROM battles WHERE status = 'rejected' AND finished_at > ?", d7).n, mismatches7d: db.get("SELECT COUNT(*) n FROM battles WHERE flags = 'mismatch' AND finished_at > ?", d7).n },
      security: { events7d: db.get('SELECT COUNT(*) n FROM security_events WHERE created_at > ?', d7).n, serious7d: db.get('SELECT COUNT(*) n FROM security_events WHERE severity >= 2 AND created_at > ?', d7).n },
      catalog: { custom: c('SELECT COUNT(*) n FROM custom_balls'), overrides: c('SELECT COUNT(*) n FROM ball_overrides'), disabled: c('SELECT COUNT(*) n FROM ball_flags WHERE disabled = 1') },
      recentAudit: db.all('SELECT a.*, u.username actor FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 12'),
    };
  });

  /* ---------- players ---------- */
  A('get', '/api/admin/players', ctx => {
    const q = str(ctx.query.q, 40), page = num(ctx.query.page, 0, 10000, 0);
    const rows = db.all(`SELECT u.id, u.username, u.email, u.role, u.status, u.suspended_until, u.created_at, u.last_login_at, p.level, p.rp, p.coins, p.stats,
        (SELECT COUNT(*) FROM security_events s WHERE s.user_id = u.id AND s.severity >= 2) flags
      FROM users u JOIN profiles p ON p.user_id = u.id WHERE (? = '' OR u.username LIKE ? OR u.email LIKE ?) ORDER BY u.id DESC LIMIT 50 OFFSET ?`, q, `%${q}%`, `%${q}%`, page * 50);
    return { page, players: rows.map(r => { const s = json(r.stats, {}); return { ...r, stats: undefined, battles: s.battles || 0, wins: s.wins || 0, premium: S.premiumOf(r.id) }; }) };
  });
  A('get', '/api/admin/players/:id', ctx => {
    const id = num(ctx.params.id, 1, 1e12, 0), u = db.get('SELECT id, username, email, role, status, suspended_until, status_reason, totp_enabled, created_at, last_login_at FROM users WHERE id = ?', id);
    if (!u) throw new HttpError(404, 'Player not found');
    return {
      user: u, premium: S.premiumOf(id), save: S.savePayload({ id, role: u.role }),
      battles: db.all('SELECT id, mode, difficulty, status, flags, created_at, finished_at, rewards FROM battles WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', id),
      security: db.all('SELECT * FROM security_events WHERE user_id = ? ORDER BY id DESC LIMIT 30', id),
      payments: db.all('SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 30', id),
    };
  });
  A('post', '/api/admin/players/:id/status', (ctx, me) => {
    const id = num(ctx.params.id, 1, 1e12, 0), u = db.get('SELECT id, username, role FROM users WHERE id = ?', id);
    if (!u) throw new HttpError(404, 'Player not found');
    if (u.role === 'owner') throw new HttpError(403, 'The owner account cannot be suspended or banned', 'FORBIDDEN');
    const status = ctx.body.status; if (!['active', 'suspended', 'banned'].includes(status)) throw bad('Unknown status');
    const until = status === 'suspended' ? now() + num(ctx.body.days, 1, 3650, 7) * 86400e3 : null, reason = str(ctx.body.reason, 200) || null;
    db.run('UPDATE users SET status = ?, suspended_until = ?, status_reason = ? WHERE id = ?', status, until, reason, id);
    if (status === 'banned') db.run('DELETE FROM sessions WHERE user_id = ?', id);
    S.audit(me.id, 'admin.player_status', u.username, ctx.ip, { status, until, reason });
    return { ok: true };
  });
  /** max level, final evolution, full stat upgrades and the whole skill tree. Players: only balls they own. Owner: any ball, admin balls included. */
  function maxOut(u, which) {
    const isOwnerAcc = u.role === 'owner';
    const owned = new Set(db.all('SELECT ball_id FROM user_balls WHERE user_id = ? AND owned = 1', u.id).map(r => r.ball_id));
    const list = which === '*all*'
      ? core.allBalls().filter(d => !d.draft && !d.summonOnly && !d.maxLevel && (owned.has(d.id) || d.free || (isOwnerAcc && !d.fusion)))
      : [core.getBall(which)].filter(Boolean);
    if (!list.length) throw bad('Choose a ball to upgrade');
    const tree = Object.fromEntries(core.TREE.map(n => [n.id, 1])), up = { ...core.UPGRADE_CAPS }, evo = core.EVO.length - 1;
    for (const d of list) {
      if (d.draft || d.summonOnly) throw bad('That ball cannot be upgraded');
      if (d.maxLevel) throw bad(`${d.name} levels up only through verified battles (Lv 50–${d.maxLevel})`);
      if (!owned.has(d.id) && !d.free && !(isOwnerAcc && !d.fusion)) throw bad(`${u.username} does not own ${d.name}`);
      S.ensureBallRow(u.id, d.id);
      db.run('UPDATE user_balls SET level = ?, exp = 0, evo = ?, up = ?, tree = ? WHERE user_id = ? AND ball_id = ?', core.MAX_LVL, evo, JSON.stringify(up), JSON.stringify(tree), u.id, d.id);
    }
    return which === '*all*' ? `all ${list.length} balls` : list[0].id;
  }
  A('post', '/api/admin/players/:id/grant', (ctx, me) => {
    const id = num(ctx.params.id, 1, 1e12, 0), u = db.get('SELECT id, username, role FROM users WHERE id = ?', id);
    if (!u) throw new HttpError(404, 'Player not found');
    const b = ctx.body, done = {};
    db.tx(() => S.withCatalog(u, () => {
      if (b.coins) { const n = num(b.coins, 1, 1000000, 0); S.addCoins(id, n); done.coins = n; }
      if (b.ball) { const d = core.getBall(String(b.ball)); if (!d || d.adminOnly || d.fusion) throw bad('That ball cannot be granted'); if (d.edition) throw bad(`${d.name} is a limited edition: it can only be obtained by a verified purchase`); S.unlockBall(id, d.id, 'grant', 'Granted by the owner'); done.ball = d.id; }
      if (b.premiumDays) { const n = num(b.premiumDays, 1, 3650, 0); S.grantPremium(id, n, me.id); done.premiumDays = n; }
      if (b.cosmetic) { const c = core.COSMETICS.find(x => x.id === b.cosmetic); if (!c) throw bad('Unknown cosmetic'); if (c.exclusive) throw bad('God of Absolute rewards come only with a verified purchase'); db.run("INSERT OR IGNORE INTO cosmetics_owned (user_id, cosmetic_id, acquired_at, source) VALUES (?, ?, ?, 'grant')", id, c.id, now()); done.cosmetic = c.id; }
      if (b.maxBall) done.maxed = maxOut(u, String(b.maxBall));
    }));
    if (!Object.keys(done).length) throw bad('Nothing to grant');
    S.audit(me.id, 'admin.grant', u.username, ctx.ip, { ...done, note: str(b.note, 200) });
    return { ok: true, granted: done };
  });

  /* ---------- subscriptions & payments ---------- */
  A('get', '/api/admin/subscriptions', ctx => {
    const st = str(ctx.query.status, 20);
    return { subscriptions: db.all(`SELECT s.*, u.username FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE s.status <> 'free' AND (? = '' OR s.status = ?) ORDER BY s.updated_at DESC LIMIT 200`, st, st) };
  });
  A('get', '/api/admin/payments', () => ({
    mode: cfg.payments.mode,
    monthly: db.all(`SELECT strftime('%Y-%m', created_at / 1000, 'unixepoch') month, SUM(CASE WHEN kind = 'invoice' AND status = 'paid' THEN amount_cents ELSE 0 END) / 100.0 gross,
      SUM(CASE WHEN kind = 'refund' THEN amount_cents ELSE 0 END) / 100.0 refunds, COUNT(CASE WHEN kind = 'invoice' AND status = 'paid' THEN 1 END) sales FROM payments GROUP BY month ORDER BY month DESC LIMIT 24`),
    payments: db.all('SELECT p.*, u.username FROM payments p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 200'),
  }));

  /* ---------- ball catalog ---------- */
  A('get', '/api/admin/balls', () => ({
    custom: db.all('SELECT id, def, published, created_at, updated_at FROM custom_balls ORDER BY created_at DESC').map(r => ({ ...json(r.def, {}), published: !!r.published, owners: db.get("SELECT COUNT(*) n FROM user_balls WHERE ball_id = ? AND owned = 1", r.id).n })),
    overrides: db.all('SELECT ball_id FROM ball_overrides').map(r => r.ball_id), disabled: db.all('SELECT ball_id FROM ball_flags WHERE disabled = 1').map(r => r.ball_id),
  }));
  A('post', '/api/admin/balls', (ctx, me) => {
    const b = ctx.body, builtin = core.ALL_BUILTIN.some(x => x.id === b.id);
    if (builtin) {   // edit a built-in ball → stored as an override (restorable)
      const def = sanitizeBall(b.def, b.id);
      const orig = core.ALL_BUILTIN.find(x => x.id === b.id);
      if (orig.adminOnly) { def.rarity = 'Admin Exclusive'; def.adminOnly = true; }
      db.run('INSERT INTO ball_overrides (ball_id, def, updated_at) VALUES (?, ?, ?) ON CONFLICT(ball_id) DO UPDATE SET def = excluded.def, updated_at = excluded.updated_at', b.id, JSON.stringify(def), now());
      S.audit(me.id, 'admin.ball_override', b.id, ctx.ip);
      return { id: b.id };
    }
    const id = b.id && S_.isId(b.id) && /^c_/.test(b.id) ? b.id : 'c_' + S_.randomToken(8).replace(/[^A-Za-z0-9]/g, 'x');
    const def = sanitizeBall(b.def, id), exists = db.get('SELECT 1 FROM custom_balls WHERE id = ?', id), pub = b.publish ? 1 : 0;
    if (exists) db.run('UPDATE custom_balls SET def = ?, published = ?, updated_at = ? WHERE id = ?', JSON.stringify(def), pub, now(), id);
    else {
      db.run('INSERT INTO custom_balls (id, def, published, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, JSON.stringify(def), pub, me.id, now(), now());
      S.updateProfile(me.id, p => { p.stats.created = (p.stats.created || 0) + 1; return { stats: p.stats }; });
    }
    S.audit(me.id, exists ? 'admin.ball_updated' : 'admin.ball_created', id, ctx.ip, { name: def.name, published: !!pub });
    return { id };
  });
  /* ---------- Admin Ball Control Panel: Supreme ball settings (owner only, validated, audit-logged) ---------- */
  const supremeIds = () => core.supremeIds ? core.supremeIds() : [];
  A('get', '/api/admin/supreme', () => {
    const rows = Object.fromEntries(db.all('SELECT ball_id, settings, updated_at FROM admin_ball_tuning').map(r => [r.ball_id, r]));
    return { balls: supremeIds().map(id => ({ id, tuning: rows[id] ? json(rows[id].settings, {}) : null, updatedAt: rows[id] ? rows[id].updated_at : null })) };
  });
  A('post', '/api/admin/supreme/:id', (ctx, me) => {
    const id = str(ctx.params.id, 64), b = ctx.body || {};
    if (!supremeIds().includes(id)) throw bad('Not a Supreme admin ball');
    if (b.reset) { db.run('DELETE FROM admin_ball_tuning WHERE ball_id = ?', id); S.audit(me.id, 'admin.supreme_reset', id, ctx.ip); return { ok: true }; }
    const nSkills = (core.ALL_BUILTIN.find(x => x.id === id) || { skills: [] }).skills.length;
    const off = Array.isArray(b.off) ? [...new Set(b.off.filter(i => Number.isInteger(i) && i >= 0 && i < nSkills))].sort() : [];
    if (off.length >= nSkills) throw bad('Keep at least one ability switched on');
    const t = { cdMul: Math.round(num(b.cdMul, 0.2, 3, 1) * 10) / 10, off, fx: Math.round(num(b.fx, 0.2, 1.5, 1) * 10) / 10, aura: b.aura !== false, startForm: Math.round(num(b.startForm, 0, 2, 0)) };
    db.run('INSERT INTO admin_ball_tuning (ball_id, settings, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(ball_id) DO UPDATE SET settings = excluded.settings, updated_by = excluded.updated_by, updated_at = excluded.updated_at', id, JSON.stringify(t), me.id, now());
    S.audit(me.id, 'admin.supreme_tuning', id, ctx.ip, t);
    return { ok: true, tuning: t };
  });
  /** 2.4.2: one click — every Supreme admin ball starts its battles in the same form (other settings are kept) */
  A('post', '/api/admin/supreme-start-form', (ctx, me) => {
    const startForm = Math.round(num(ctx.body.startForm, 0, 2, -1)); if (startForm < 0) throw bad('Choose Base, Awakened or Final God Form');
    const rows = Object.fromEntries(db.all('SELECT ball_id, settings FROM admin_ball_tuning').map(r => [r.ball_id, json(r.settings, {})]));
    db.tx(() => { for (const id of supremeIds()) { const t = { cdMul: 1, off: [], fx: 1, aura: true, ...(rows[id] || {}), startForm };
      db.run('INSERT INTO admin_ball_tuning (ball_id, settings, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(ball_id) DO UPDATE SET settings = excluded.settings, updated_by = excluded.updated_by, updated_at = excluded.updated_at', id, JSON.stringify(t), me.id, now()); } });
    S.audit(me.id, 'admin.supreme_start_form_all', null, ctx.ip, { startForm, balls: supremeIds().length });
    return { ok: true, startForm, balls: supremeIds().length };
  });
  A('post', '/api/admin/balls/:id/flags', (ctx, me) => {
    const id = str(ctx.params.id, 64), dis = !!ctx.body.disabled;
    db.run('INSERT INTO ball_flags (ball_id, disabled) VALUES (?, ?) ON CONFLICT(ball_id) DO UPDATE SET disabled = excluded.disabled', id, dis ? 1 : 0);
    S.audit(me.id, dis ? 'admin.ball_disabled' : 'admin.ball_enabled', id, ctx.ip);
    return { ok: true };
  });
  A('post', '/api/admin/balls/:id/restore', (ctx, me) => { db.run('DELETE FROM ball_overrides WHERE ball_id = ?', ctx.params.id); S.audit(me.id, 'admin.ball_restored', ctx.params.id, ctx.ip); return { ok: true }; });
  A('delete', '/api/admin/balls/:id', (ctx, me) => {
    const id = str(ctx.params.id, 64);
    if (!db.get('SELECT 1 FROM custom_balls WHERE id = ?', id)) throw bad('Only custom balls can be deleted');
    const owners = db.get("SELECT COUNT(*) n FROM user_balls ub JOIN users u ON u.id = ub.user_id WHERE ub.ball_id = ? AND ub.owned = 1 AND u.role = 'player'", id).n;
    if (owners) throw new HttpError(409, `${owners} player(s) own this ball. Players never lose legitimately unlocked balls — disable it instead to stop new unlocks.`, 'OWNED');
    db.run('DELETE FROM custom_balls WHERE id = ?', id); db.run('DELETE FROM limited_events WHERE ball_id = ?', id);
    S.audit(me.id, 'admin.ball_deleted', id, ctx.ip);
    return { ok: true };
  });

  /* ---------- limited events & announcements ---------- */
  A('get', '/api/admin/events', () => ({ events: db.all('SELECT * FROM limited_events ORDER BY start_at DESC LIMIT 200') }));
  A('post', '/api/admin/events', (ctx, me) => {
    const b = ctx.body, name = str(b.name, 60), start = num(b.start, 0, 9e15, 0), end = num(b.end, 0, 9e15, 0);
    if (!name || !(end > start)) throw bad('Enter a name and a valid time range');
    const ball = S.withCatalog(me, () => core.getBall(String(b.ball || '')));
    if (!ball || ball.adminOnly) throw bad('Choose a non-admin ball for the event');
    if (ball.edition || ball.paid || ball.pass) throw bad('Paid and limited-edition balls can never be event rewards (no restock through events)');
    const id = 'ev_' + S_.randomToken(8).replace(/[^A-Za-z0-9]/g, 'x');
    db.run('INSERT INTO limited_events (id, name, description, ball_id, start_at, end_at, goal, price, premium_only, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, name, str(b.desc, 300), ball.id, start, end, num(b.goal, 1, 50, 3), num(b.price, 0, 1000000, 2500), b.premiumOnly ? 1 : 0, me.id, now());
    S.audit(me.id, 'admin.event_created', id, ctx.ip, { name, ball: ball.id });
    return { id };
  });
  A('delete', '/api/admin/events/:id', (ctx, me) => { db.run('DELETE FROM limited_events WHERE id = ?', ctx.params.id); S.audit(me.id, 'admin.event_deleted', ctx.params.id, ctx.ip); return { ok: true }; });
  A('post', '/api/admin/announcement', (ctx, me) => {
    const text = str(ctx.body.text, 200);
    db.run("INSERT INTO settings (key, value) VALUES ('announcement', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", text);
    S.audit(me.id, 'admin.announcement', null, ctx.ip, { text });
    return { ok: true };
  });
  app.get('/api/announcement', () => ({ text: db.get("SELECT value FROM settings WHERE key = 'announcement'")?.value || '' }));

  /* ---------- audit, security, export, backup ---------- */
  A('get', '/api/admin/audit', ctx => ({ logs: db.all('SELECT a.*, u.username actor FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 100 OFFSET ?', num(ctx.query.page, 0, 1e6, 0) * 100) }));
  A('get', '/api/admin/security', ctx => ({ events: db.all('SELECT s.*, u.username FROM security_events s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.id DESC LIMIT 100 OFFSET ?', num(ctx.query.page, 0, 1e6, 0) * 100) }));
  A('get', '/api/admin/export', (ctx, me) => {
    S.audit(me.id, 'admin.export', null, ctx.ip);
    const t = (sql) => db.all(sql);
    return {
      exportedAt: new Date().toISOString(), version: S.version, note: 'Password hashes, 2FA secrets, recovery codes and session tokens are never exported.',
      users: t('SELECT id, username, email, role, status, suspended_until, created_at, last_login_at FROM users'), profiles: t('SELECT * FROM profiles'), userBalls: t('SELECT * FROM user_balls'),
      customBalls: t('SELECT * FROM custom_balls'), overrides: t('SELECT * FROM ball_overrides'), flags: t('SELECT * FROM ball_flags'), fusions: t('SELECT * FROM fusions'),
      achievements: t('SELECT * FROM achievements'), events: t('SELECT * FROM limited_events'), eventProgress: t('SELECT * FROM event_progress'), limitedRecords: t('SELECT * FROM limited_records'),
      subscriptions: t('SELECT * FROM subscriptions'), payments: t('SELECT * FROM payments'), cosmetics: t('SELECT * FROM cosmetics_owned'),
    };
  });
  A('post', '/api/admin/backup', (ctx, me) => {
    const file = require('node:path').join(cfg.backupDir, `game-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    db.backup(file); S.audit(me.id, 'admin.backup', require('node:path').basename(file), ctx.ip);
    return { file: require('node:path').basename(file) };
  });
}

module.exports = { register };
