'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, Client, S_ } = require('./helpers');
const { createOwner, confirmTotp } = require('../cli/owner');
const { loadCore } = require('../core');

let srv, owner, player, secret, ctr;
const nextCode = () => S_.totpCode(secret, ++ctr);
test.before(async () => {
  srv = await startServer();
  await createOwner(srv.db, { username: 'Boss', password: 'Owner-Pass-9876!' });
  const pending = srv.db.get("SELECT totp_pending FROM users WHERE role = 'owner'").totp_pending;
  ctr = Math.floor(Date.now() / 30000) - 1;
  assert.ok(confirmTotp(srv.db, S_.totpCode(pending, ctr)));
  secret = pending;
  owner = new Client(srv.base);
  assert.equal((await owner.post('/api/auth/login', { username: 'Boss', password: 'Owner-Pass-9876!', code: nextCode() })).status, 200);
  player = new Client(srv.base); await player.register('plain_player');
});
test.after(async () => { await srv.stop(); });

test('Portal Master Ball belongs to the owner only and is never an AI opponent', async () => {
  const core = loadCore(); core.setCatalog(null);
  const pm = core.getBall('portalmaster');
  assert.ok(pm && pm.adminOnly && pm.noOpponent);
  for (const inc of [false, true]) assert.ok(!core.opponentPool(inc).some(b => b.id === 'portalmaster' || b.summonOnly), 'not in any AI opponent pool');
  // ordinary players: cannot battle with it, buy it or use the summon-only helpers
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: 'portalmaster' })).status, 403);
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: 'bread' })).status, 403);
  assert.equal((await player.post('/api/shop/unlock', { ball: 'portalmaster' })).status, 400);
  assert.equal((await player.post('/api/battle/start', { mode: '1v1', ball: 'fire', enemy: 'portalmaster' })).status, 400);
  // the owner: cannot set it as an AI enemy either, and summon-only helpers are not playable characters
  assert.equal((await owner.post('/api/battle/start', { mode: '1v1', ball: 'fire', enemy: 'portalmaster' })).status, 400);
  assert.equal((await owner.post('/api/battle/start', { mode: '1v1', ball: 'spear' })).status, 403);
  // it cannot be granted to a player
  const pid = srv.db.get("SELECT id FROM users WHERE username = 'plain_player'").id;
  assert.equal((await owner.post(`/api/admin/players/${pid}/grant`, { ball: 'portalmaster' })).status, 400);
});

test('the owner battles with Portal Master Ball and the server verifies the result', async () => {
  const r = await owner.post('/api/battle/start', { mode: '1v1', ball: 'portalmaster', difficulty: 'hard' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const T = r.data.ticket;
  const core = loadCore(); core.setCatalog(JSON.parse(srv.db.get('SELECT catalog FROM battles WHERE id = ?', T.id).catalog));
  const sim = core.simulateTicket(T, []);
  assert.ok(sim.ok);
  srv.db.run('UPDATE battles SET created_at = created_at - 3600000 WHERE id = ?', T.id);   // skip the real-time speed guard
  const f = await owner.post('/api/battle/finish', { id: T.id, inputs: [], claimed: { win: sim.win, step: sim.step } });
  assert.equal(f.status, 200, JSON.stringify(f.data));
  assert.equal(f.data.verified, true); assert.equal(f.data.mismatch, false); assert.equal(f.data.result.win, sim.win);
});

test('portals, escapes, summons and clones are deterministic; battles always finish', () => {
  const core = loadCore(); core.setCatalog(null); const G = core.getBall;
  for (const [seed, opp] of [[1, 'omega'], [2, 'oneaboveall'], [3, 'phoenix']]) {
    const T = { v: 2, mode: '1v1', difficulty: 'hard', seed, manual: false, teams: [[core.enemySpec(G('portalmaster'), 35, 'hard')], [core.enemySpec(G(opp), 35, 'hard')]], pool: [], opts: {} };
    const a = core.simulateTicket(T, []), b = core.simulateTicket(T, []);
    assert.ok(a.ok, 'battle finished'); assert.deepEqual(a, b, 'identical replay');
  }
  // an owner's friendly online match: the step-by-step (lockstep) run matches the server's full replay
  const T = core.createPvpTicket([{ ball: 'portalmaster', level: 40, evo: 3, name: 'Boss' }, { ball: 'phoenix', level: 40, evo: 3, name: 'P2' }], 77);
  const inputs = [[100, 0, 'm', 1], [140, 0, 'k', 0], [400, 0, 'k', 2], [700, 0, 'k', 1], [900, 0, 'k', 3], [1200, 0, 'm', 0], [1500, 1, 'k', 0]];
  const full = core.simulateTicket(T, inputs);
  const replay = [], B = new core.Battle(core.buildBattleConfig(T, { replay, headless: true }));
  let i = 0;
  while (!B.result && B.stepN < 240 * 60 * 10) {
    while (i < inputs.length && inputs[i][0] <= B.stepN + 12) replay.push(inputs[i++]);
    B.limit = B.stepN + 12;
    while (!B.result && B.stepN < B.limit) B.step(core.STEP);
  }
  assert.equal(B.result.winner, full.winner); assert.equal(B.result.step, full.step);
});
