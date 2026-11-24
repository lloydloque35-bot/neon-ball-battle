'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, Client } = require('./helpers');
const { loadCore } = require('../core');

let srv, core;
test.before(async () => { srv = await startServer(); core = loadCore(); });
test.after(async () => { await srv.stop(); });

/** plays the ticket like an honest client would (auto battle, no inputs) */
function playLocally(ticket, catalog) { core.setCatalog(catalog); return core.simulateTicket(ticket, []); }
const age = (id, ms = 3600e3) => srv.db.run('UPDATE battles SET created_at = created_at - ? WHERE id = ?', ms, id);

test('new account gets a cloud save with the 6 starter balls', async () => {
  const c = new Client(srv.base); await c.register('gamer_1');
  const s = (await c.get('/api/save')).data;
  assert.equal(s.coins, 600);
  assert.deepEqual(Object.keys(s.balls).filter(k => s.balls[k].owned).sort(), ['earth', 'fire', 'ice', 'thunder', 'water', 'wind']);
  assert.equal(s.premium.active, false);
});

test('players cannot use balls they do not own, admin balls, or admin opponents', async () => {
  const c = new Client(srv.base); await c.register('gamer_2');
  assert.equal((await c.post('/api/battle/start', { mode: '1v1', ball: 'galaxy', difficulty: 'normal' })).status, 403);
  assert.equal((await c.post('/api/battle/start', { mode: '1v1', ball: 'oneaboveall', difficulty: 'normal' })).status, 403);
  assert.equal((await c.post('/api/battle/start', { mode: '1v1', ball: 'fire', enemy: 'archangel', difficulty: 'normal' })).status, 400);
  const trial = await c.post('/api/battle/start', { mode: 'practice', ball: 'prism', trial: true });
  assert.equal(trial.status, 200, 'premium balls can be tried in practice');
  assert.equal((await c.post('/api/battle/start', { mode: 'practice', ball: 'omega', trial: true })).status, 403, 'admin balls cannot be trialled');
});

test('honest battle is verified by server replay and rewards are granted server-side', async () => {
  const c = new Client(srv.base); await c.register('gamer_3');
  const { ticket } = (await c.post('/api/battle/start', { mode: '1v1', ball: 'fire', difficulty: 'normal' })).data;
  assert.equal(ticket.teams[0][0].level, 1);
  const save0 = (await c.get('/api/save')).data;
  const local = playLocally(ticket, save0.catalog);
  age(ticket.id);
  const r = await c.post('/api/battle/finish', { id: ticket.id, inputs: [], claimed: { win: local.win, step: local.step } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.verified, true);
  assert.equal(r.data.mismatch, false);
  assert.equal(r.data.result.win, local.win);
  assert.equal(r.data.save.coins, 600 + r.data.rewards.coins);
  assert.equal(r.data.save.stats.battles, 1);
  const again = await c.post('/api/battle/finish', { id: ticket.id, inputs: [], claimed: { win: true, step: local.step } });
  assert.equal(again.status, 409, 'a battle can only be submitted once');
});

test('a faked victory is overruled by the server simulation and flagged', async () => {
  const c = new Client(srv.base); await c.register('gamer_4');
  for (let i = 0; i < 6; i++) {
    const { ticket } = (await c.post('/api/battle/start', { mode: '1v1', ball: 'wind', difficulty: 'godlike' })).data;
    const local = playLocally(ticket, (await c.get('/api/save')).data.catalog);
    if (local.win) continue;
    age(ticket.id);
    const r = await c.post('/api/battle/finish', { id: ticket.id, inputs: [], claimed: { win: true, step: local.step } });
    assert.equal(r.data.result.win, false, 'server keeps the real result');
    assert.equal(r.data.mismatch, true);
    assert.ok(srv.db.get("SELECT COUNT(*) n FROM security_events WHERE kind = 'battle_mismatch'").n >= 1);
    return;
  }
  assert.fail('could not produce a losing battle to fake');
});

test('results submitted faster than the game allows are rejected', async () => {
  const c = new Client(srv.base); await c.register('gamer_5');
  const { ticket } = (await c.post('/api/battle/start', { mode: '1v1', ball: 'ice', difficulty: 'easy' })).data;
  const r = await c.post('/api/battle/finish', { id: ticket.id, inputs: [], claimed: { win: true, step: 240 * 120 } });
  assert.equal(r.status, 422);
  assert.equal(srv.db.get('SELECT status FROM battles WHERE id = ?', ticket.id).status, 'rejected');
});

test('malformed or oversized input logs are rejected', async () => {
  const c = new Client(srv.base); await c.register('gamer_6');
  const { ticket } = (await c.post('/api/battle/start', { mode: '1v1', ball: 'earth', difficulty: 'easy' })).data;
  age(ticket.id);
  const r = await c.post('/api/battle/finish', { id: ticket.id, inputs: [[5, 's', 999, 0, 900]], claimed: { win: true, step: 100 } });
  assert.equal(r.status, 400);
});

test('abandoning a ranked battle counts as a loss', async () => {
  const c = new Client(srv.base); await c.register('gamer_7');
  await c.post('/api/battle/start', { mode: '1v1', ball: 'fire', difficulty: 'normal' });
  await c.post('/api/battle/start', { mode: '1v1', ball: 'fire', difficulty: 'normal' });
  const s = (await c.get('/api/save')).data;
  assert.equal(s.stats.losses, 1);
  assert.equal(s.rp, 996);
});

test('economy: unlock, insufficient coins, upgrade, evolve and skill tree rules', async () => {
  const c = new Client(srv.base); await c.register('gamer_8');
  assert.equal((await c.post('/api/shop/unlock', { ball: 'galaxy' })).status, 402);
  const ok = await c.post('/api/shop/unlock', { ball: 'zombie' });
  assert.equal(ok.status, 200); assert.equal(ok.data.save.coins, 0); assert.equal(ok.data.save.balls.zombie.owned, true);
  assert.equal((await c.post('/api/shop/unlock', { ball: 'prism' })).status, 400, 'premium balls are not for sale');
  assert.equal((await c.post('/api/shop/unlock', { ball: 'archangel' })).status, 400, 'admin balls are not for sale');
  assert.equal((await c.post('/api/ball/evolve', { ball: 'fire' })).status, 400, 'level 10 required');
  assert.equal((await c.post('/api/ball/tree', { ball: 'fire', node: 'slot3' })).status, 400, 'level 5 required');
  assert.equal((await c.post('/api/ball/tree', { ball: 'fire', node: 'power1' })).status, 200);
  assert.equal((await c.post('/api/ball/tree', { ball: 'fire', node: 'power1' })).status, 400, 'cannot learn twice');
});

test('parallel requests cannot double-spend coins', async () => {
  const c = new Client(srv.base); await c.register('gamer_9');
  const res = await Promise.all(['dark', 'light', 'spider', 'magnet'].map(b => c.post('/api/shop/unlock', { ball: b })));
  assert.equal(res.filter(r => r.status === 200).length, 0, 'each costs 1000 and the player has 600');
  srv.db.run("UPDATE profiles SET coins = 1000 WHERE user_id = (SELECT id FROM users WHERE username = 'gamer_9')");
  const res2 = await Promise.all(['dark', 'light', 'spider', 'magnet'].map(b => c.post('/api/shop/unlock', { ball: b })));
  assert.equal(res2.filter(r => r.status === 200).length, 1);
  assert.equal((await c.get('/api/save')).data.coins, 0);
});

test('daily reward can be claimed once per day', async () => {
  const c = new Client(srv.base); await c.register('gamer_10');
  const a = await c.post('/api/daily/claim');
  assert.equal(a.status, 200); assert.equal(a.data.coins, 100);
  assert.equal((await c.post('/api/daily/claim')).status, 409);
});

test('fusion creates a new private ball and keeps both originals', async () => {
  const c = new Client(srv.base); await c.register('gamer_11');
  const uid = srv.db.get("SELECT id FROM users WHERE username = 'gamer_11'").id;
  assert.equal((await c.post('/api/fusion/create', { a: 'fire', b: 'ice' })).status, 400, 'needs level 10');
  srv.db.run("UPDATE user_balls SET level = 10 WHERE user_id = ? AND ball_id IN ('fire', 'ice')", uid);
  srv.db.run('UPDATE profiles SET coins = 5000 WHERE user_id = ?', uid);
  const r = await c.post('/api/fusion/create', { a: 'fire', b: 'ice' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const id = r.data.fusion;
  assert.ok(r.data.save.balls[id].owned && r.data.save.balls.fire.owned && r.data.save.balls.ice.owned);
  assert.equal(r.data.save.catalog.fusions[0].name, 'Fire-Ice Fusion Ball');
  assert.equal((await c.post('/api/battle/start', { mode: '1v1', ball: id, difficulty: 'easy' })).status, 200);
  const other = new Client(srv.base); await other.register('gamer_12');
  assert.equal((await other.post('/api/battle/start', { mode: '1v1', ball: id, difficulty: 'easy' })).status, 403, "other players cannot use someone else's fusion");
  assert.equal((await c.post('/api/fusion/create', { a: 'ice', b: 'fire' })).status, 400, 'same pair twice');
});

test('AI tournament runs on the server and advances with verified results', async () => {
  const c = new Client(srv.base); await c.register('gamer_13');
  const t = await c.post('/api/tournament/start', { ball: 'thunder', difficulty: 'easy' });
  assert.equal(t.status, 200); assert.equal(t.data.tour.rounds[0].length, 8);
  const { ticket } = (await c.post('/api/tournament/ticket', {})).data;
  assert.equal(ticket.mode, 'tournament');
  const local = playLocally(ticket, (await c.get('/api/save')).data.catalog);
  age(ticket.id);
  const r = await c.post('/api/battle/finish', { id: ticket.id, inputs: [], claimed: { win: local.win, step: local.step } });
  assert.equal(r.status, 200);
  assert.equal(r.data.tour.round, 1);
  assert.equal(r.data.tour.alive, local.win);
});

test('leaderboard ranks only verified players and never the owner', async () => {
  const r = await new Client(srv.base).get('/api/leaderboard?by=rp');
  assert.equal(r.status, 200);
  assert.ok(r.data.list.length >= 2);
  assert.ok(r.data.list.every(x => x.username !== 'TheOwner'));
});
