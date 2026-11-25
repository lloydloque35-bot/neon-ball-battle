'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, Client, S_ } = require('./helpers');
const { createOwner, confirmTotp } = require('../cli/owner');

let srv, owner, player, secret, ctr;
const nextCode = () => S_.totpCode(secret, ++ctr);
const BALL = { name: 'Nova Test Ball', desc: 'Test', category: 'Custom', rarity: 'Epic', hp: 110, atk: 60, def: 50, spd: 60, crit: 20, ai: 'tactical',
  design: { c1: '#112233', c2: '#44aaff', c3: '#88ccff', pat: 'galaxy', deco: ['ring', 'armor', 'not-a-deco'], sym: '', glow: 1.2 },
  skills: [{ name: 'A', type: 'projectile', cd: 4, power: 50, color: '#ffffff', effect: 'burn' }, { name: 'B', type: 'shield', cd: 9, power: 60, color: '#ffffff' }, { name: 'C', type: 'phase', cd: 9, power: 60, color: '#ffffff' }],
  ult: { name: 'NOVA', type: 'collapse', power: 100, color: '#88ccff' }, godMode: true };

test.before(async () => {
  srv = await startServer();
  await createOwner(srv.db, { username: 'Boss', password: 'Owner-Pass-9876!' });
  const pending = srv.db.get("SELECT totp_pending FROM users WHERE role = 'owner'").totp_pending;
  ctr = Math.floor(Date.now() / 30000) - 1;
  assert.ok(confirmTotp(srv.db, S_.totpCode(pending, ctr)));
  secret = pending;
  owner = new Client(srv.base);
  const r = await owner.post('/api/auth/login', { username: 'Boss', password: 'Owner-Pass-9876!', code: nextCode() });
  assert.equal(r.status, 200);
  player = new Client(srv.base); await player.register('regular_1');
});
test.after(async () => { await srv.stop(); });

test('only the verified owner can open the admin API', async () => {
  assert.equal((await new Client(srv.base).get('/api/admin/overview')).status, 401);
  const p = await player.get('/api/admin/overview');
  assert.equal(p.status, 403);
  const uid = srv.db.get("SELECT id FROM users WHERE username = 'regular_1'").id;
  srv.S.grantPremium(uid, 30, 0);
  assert.equal((await player.get('/api/admin/overview')).status, 403, 'premium players are never admins');
  assert.ok(srv.db.get("SELECT COUNT(*) n FROM security_events WHERE kind = 'admin_denied'").n >= 2);
  const o = await owner.get('/api/admin/overview');
  assert.equal(o.status, 200); assert.ok(o.data.users.total >= 1);
});

test('stale 2FA requires re-verification (step-up) before admin actions', async () => {
  srv.db.run("UPDATE sessions SET mfa_at = ? WHERE user_id = (SELECT id FROM users WHERE role = 'owner')", Date.now() - 3 * 3600e3);
  const r = await owner.get('/api/admin/overview');
  assert.equal(r.status, 401); assert.equal(r.data.code, 'MFA_REQUIRED');
  assert.equal((await owner.post('/api/auth/mfa', { code: '000000' })).status, 401);
  assert.equal((await owner.post('/api/auth/mfa', { code: nextCode() })).status, 200);
  assert.equal((await owner.get('/api/admin/overview')).status, 200);
});

let ballId;
test('owner creates balls: drafts are private, published balls reach players', async () => {
  const r = await owner.post('/api/admin/balls', { def: BALL, publish: false });
  assert.equal(r.status, 200); ballId = r.data.id;
  assert.equal((await player.get('/api/catalog')).data.customBalls.length, 0, 'drafts are hidden from players');
  const saved = JSON.parse(srv.db.get('SELECT def FROM custom_balls WHERE id = ?', ballId).def);
  assert.deepEqual(saved.design.deco, ['ring', 'armor'], 'definitions are sanitised');
  assert.equal((await owner.post('/api/admin/balls', { id: ballId, def: BALL, publish: true })).status, 200);
  assert.equal((await player.get('/api/catalog')).data.customBalls[0].name, 'Nova Test Ball');
  assert.equal((await owner.post('/api/admin/balls', { def: { ...BALL, skills: BALL.skills.slice(0, 2) } })).status, 400, 'balls need 3+ abilities');
});

test('players keep balls they unlocked: delete refused, disable only stops new unlocks', async () => {
  const uid = srv.db.get("SELECT id FROM users WHERE username = 'regular_1'").id;
  srv.db.run("UPDATE subscriptions SET status = 'expired' WHERE user_id = ?", uid);
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: ballId, difficulty: 'easy' })).status, 403);
  assert.equal((await owner.post(`/api/admin/players/${uid}/grant`, { ball: ballId, coins: 500, note: 'launch gift' })).status, 200);
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: ballId, difficulty: 'easy' })).status, 200);
  assert.equal((await owner.req('DELETE', `/api/admin/balls/${ballId}`)).status, 409);
  assert.equal((await owner.post(`/api/admin/balls/${ballId}/flags`, { disabled: true })).status, 200);
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: ballId, difficulty: 'easy' })).status, 200, 'owners keep disabled balls');
  assert.ok(srv.db.get("SELECT COUNT(*) n FROM audit_logs WHERE action = 'admin.grant'").n === 1);
});

test('ban signs the player out and blocks login; the owner cannot be banned', async () => {
  const bad = new Client(srv.base); await bad.register('cheater_1');
  const id = srv.db.get("SELECT id FROM users WHERE username = 'cheater_1'").id;
  assert.equal((await owner.post(`/api/admin/players/${id}/status`, { status: 'banned', reason: 'cheating' })).status, 200);
  assert.equal((await bad.get('/api/auth/me')).data.user, null);
  assert.equal((await new Client(srv.base).post('/api/auth/login', { username: 'cheater_1', password: 'Sup3r-Secret-Pass!' })).status, 403);
  const ownerId = srv.db.get("SELECT id FROM users WHERE role = 'owner'").id;
  assert.equal((await owner.post(`/api/admin/players/${ownerId}/status`, { status: 'banned' })).status, 403);
});

test('suspension blocks battles until it ends', async () => {
  const s = new Client(srv.base); await s.register('timeout_1');
  const id = srv.db.get("SELECT id FROM users WHERE username = 'timeout_1'").id;
  await owner.post(`/api/admin/players/${id}/status`, { status: 'suspended', days: 3, reason: 'spam' });
  const r = await s.post('/api/battle/start', { mode: '1v1', ball: 'fire', difficulty: 'easy' });
  assert.equal(r.status, 403); assert.equal(r.data.code, 'SUSPENDED');
});

test('events, announcements, export and backup', async () => {
  const ev = await owner.post('/api/admin/events', { name: 'Test Fest', ball: 'aurora', start: Date.now() - 1000, end: Date.now() + 86400e3, goal: 2, price: 999 });
  assert.equal(ev.status, 200);
  assert.ok((await player.get('/api/events')).data.events.some(e => e.name === 'Test Fest'));
  assert.equal((await owner.post('/api/admin/events', { name: 'Bad', ball: 'oneaboveall', start: 1, end: 2 })).status, 400);
  await owner.post('/api/admin/announcement', { text: 'Season 1 is live!' });
  assert.equal((await player.get('/api/announcement')).data.text, 'Season 1 is live!');
  const ex = await owner.get('/api/admin/export');
  assert.equal(ex.status, 200);
  assert.ok(!JSON.stringify(ex.data).includes('scrypt$'), 'password hashes are never exported');
  assert.ok(ex.data.users.every(u => !('totp_secret' in u)));
  const bk = await owner.post('/api/admin/backup');
  assert.equal(bk.status, 200); assert.match(bk.data.file, /^game-.*\.db$/);
});

test('owner tools: coins and max upgrades for themselves; fusion at any level incl. admin balls (stays admin-only)', async () => {
  const bossId = srv.db.get("SELECT id FROM users WHERE role = 'owner'").id;
  const before = srv.db.get('SELECT coins FROM profiles WHERE user_id = ?', bossId).coins;
  const g = await owner.post(`/api/admin/players/${bossId}/grant`, { coins: 50000, maxBall: 'oneaboveall', note: 'testing' });
  assert.equal(g.status, 200);
  assert.equal(srv.db.get('SELECT coins FROM profiles WHERE user_id = ?', bossId).coins, before + 50000);
  const oaa = srv.db.get("SELECT * FROM user_balls WHERE user_id = ? AND ball_id = 'oneaboveall'", bossId);
  assert.equal(oaa.level, 50); assert.equal(oaa.evo, 3);
  assert.equal(JSON.parse(oaa.up).atk, 25); assert.equal(JSON.parse(oaa.tree).master, 1);
  assert.ok(srv.db.get("SELECT COUNT(*) n FROM audit_logs WHERE action = 'admin.grant'").n >= 1);
  // the owner fuses One Above All with a level-1 starter
  const f = await owner.post('/api/fusion/create', { a: 'oneaboveall', b: 'fire' });
  assert.equal(f.status, 200, JSON.stringify(f.data));
  const def = JSON.parse(srv.db.get('SELECT def FROM fusions WHERE id = ?', f.data.fusion).def);
  assert.equal(def.adminOnly, true, 'a fusion with an admin ball stays admin-exclusive');
  // regular players: still level 10+, no admin balls, and cannot max a ball they do not own
  const pid = srv.db.get("SELECT id FROM users WHERE username = 'regular_1'").id;
  srv.S.addCoins(pid, 10000);
  const pf = await player.post('/api/fusion/create', { a: 'fire', b: 'ice' });
  assert.equal(pf.status, 400); assert.match(pf.data.error, /level 10/);
  assert.equal((await player.post('/api/fusion/create', { a: 'oneaboveall', b: 'fire' })).status, 400);
  assert.equal((await owner.post(`/api/admin/players/${pid}/grant`, { maxBall: 'oneaboveall' })).status, 400);
  assert.equal((await owner.post(`/api/admin/players/${pid}/grant`, { maxBall: '*all*' })).status, 200);
  assert.equal(srv.db.get("SELECT level FROM user_balls WHERE user_id = ? AND ball_id = 'fire'", pid).level, 50);
  assert.equal(srv.db.get("SELECT COUNT(*) n FROM user_balls WHERE user_id = ? AND ball_id = 'oneaboveall'", pid).n, 0);
  // players can never use the owner's grant endpoint on themselves
  assert.equal((await player.post(`/api/admin/players/${pid}/grant`, { coins: 99999 })).status, 403);
});
