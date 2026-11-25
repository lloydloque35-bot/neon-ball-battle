'use strict';
/**
 * Online 2 VS 2, the 5-player arena, co-op vs AI, AI-filled seats, ranked seasons and Premium monthly coins.
 * Whole matches are replayed through the real WebSocket server; the server's verified result must match a local replay.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, Client, wsConnect } = require('./helpers');
const { loadCore } = require('../core');

const core = loadCore();
const K = core.PVP.BLOCK;
let srv;
test.before(async () => { srv = await startServer(); srv.S.pvp.LIMITS.msgsPerSec = 1e6; });
test.after(async () => { await srv.stop(); });

async function player(name) {
  const c = new Client(srv.base); const r = await c.register(name); assert.equal(r.status, 200);
  const ws = await wsConnect(srv.base, '/api/pvp/ws', { cookie: c.cookie, origin: srv.base });
  assert.ok(ws.send, 'websocket accepted');
  await ws.next('hello');
  return { c, ws, name };
}
/** deterministic button presses for every slot */
function plan(slot, b) {
  const a = [];
  if (b === 20 + slot) a.push([0, 'm', 1]);
  if (b >= 25 && b % (12 + slot) === 0) a.push([2, 's', (slot * 37) % 200 - 100, (slot * 53) % 200 - 100, 900]);
  if (b % (60 + slot * 7) === 30) a.push([1, 'k', slot % 3]);
  if (b % 97 === 50 + slot) a.push([K - 1, 'u', 0]);
  return a.sort((x, y) => x[0] - y[0]);   // inputs inside a block must be in time order
}
function expected(start, upTo) {
  core.setCatalog(start.catalog);
  const log = [];
  for (let b = start.delay; b <= upTo; b++) log.push(...core.mergePvpBlock(b, Array.from({ length: start.humans }, (_, s) => plan(s, b))));
  return core.simulateTicket(start.ticket, log);
}
/** every player sends frames for blocks [from, to] in chunks, waiting until each has everyone else's frames */
async function play(P, from, to) {
  for (let b0 = from; b0 <= to; b0 += 50) {
    const b1 = Math.min(to, b0 + 49);
    for (const p of P) for (let b = b0; b <= b1; b++) p.ws.send({ t: 'f', b, a: plan(p.slot, b) });
    for (const p of P) {
      const seen = new Set();
      await p.ws.next(m => { if (m.t === 'f' && m.b === b1) seen.add(m.s); return seen.size === P.length - 1; }, 10000);
      p.ws.msgs = p.ws.msgs.filter(m => m.t !== 'f');
    }
  }
}
/** plays a started match to its end and returns every player's verified result */
async function finish(P, starts) {
  P.forEach((p, i) => { p.slot = starts[i].slot; p.team = starts[i].team; });
  const s0 = starts[0], sim = expected(s0, 40000);
  assert.ok(sim.ok, 'the match ends');
  await play([...P].sort((a, b) => a.slot - b.slot), s0.delay, Math.ceil(sim.step / K) + s0.delay + 1);
  P.forEach(p => p.ws.send({ t: 'end', step: sim.step }));
  const res = await Promise.all(P.map(p => p.ws.next('result', 30000)));
  for (const r of res) { assert.equal(r.step, sim.step, 'server result = local replay'); assert.equal(r.winner, sim.winner); assert.equal(r.place, sim.places[r.team]); }
  return { res, sim };
}
const close = P => P.forEach(p => p.ws.close());

test('5-player arena: five ranked players start at once, see the same match and get placements, coins and season points', async () => {
  const P = [], balls = ['fire', 'ice', 'thunder', 'water', 'earth'];
  for (let i = 0; i < 5; i++) P.push(await player('arena_' + i));
  for (let i = 0; i < 5; i++) { P[i].ws.send({ t: 'queue', mode: 'ffa', ball: balls[i] }); if (i < 4) assert.equal((await P[i].ws.next('queued')).mode, 'ffa'); }
  const st = await Promise.all(P.map(p => p.ws.next('start')));
  for (const s of st) { assert.deepEqual(s.ticket, st[0].ticket); assert.equal(s.mode, 'ffa'); assert.equal(s.humans, 5); assert.equal(s.ranked, true); }
  assert.equal(st[0].ticket.teams.length, 5);
  assert.deepEqual(st.map(s => s.slot).sort(), [0, 1, 2, 3, 4]);
  const { res } = await finish(P, st);
  const places = res.map(r => r.place).sort();
  assert.equal(places[0], 1);
  const first = res.find(r => r.place === 1);
  assert.ok(first.coins >= 100 && first.rpDelta > 0, 'the winner earns coins and season points');
  const hist = (await P[0].c.get('/api/pvp/history')).data.matches[0];
  assert.equal(hist.mode, 'ffa'); assert.ok(hist.place >= 1);
  close(P);
});

test('5-player arena: after the wait, AI balls fill the empty seats; a lone player gets an unranked match vs AI', async () => {
  const L = srv.S.pvp.LIMITS;
  L.fillAfterMs = 0;
  const P = [await player('fill_a'), await player('fill_b')];
  P[0].ws.send({ t: 'queue', mode: 'ffa', ball: 'fire' }); await P[0].ws.next('queued');
  P[1].ws.send({ t: 'queue', mode: 'ffa', ball: 'ice' });
  srv.S.pvp.tickNow();
  const st = await Promise.all(P.map(p => p.ws.next('start')));
  assert.equal(st[0].humans, 2); assert.equal(st[0].ticket.teams.length, 5); assert.equal(st[0].players.filter(x => x.ai).length, 3); assert.equal(st[0].ranked, true);
  await finish(P, st);
  close(P);
  // alone in the queue
  L.soloAfterMs = 0;
  const solo = await player('fill_solo');
  solo.ws.send({ t: 'queue', mode: 'ffa', ball: 'thunder' });
  srv.S.pvp.tickNow();
  const s = await solo.ws.next('start');
  assert.equal(s.ranked, false); assert.equal(s.humans, 1); assert.match(s.note, /not ranked/);
  solo.ws.send({ t: 'quit' });
  assert.match((await solo.ws.next('result', 30000)).note, /not ranked/);
  close([solo]);
  L.fillAfterMs = 20000; L.soloAfterMs = 45000;
});

test('2 VS 2: two friends search together from a room (same team) and meet two solo players', async () => {
  const [A, B, C, D] = [await player('duo_a'), await player('duo_b'), await player('solo_c'), await player('solo_d')];
  A.ws.send({ t: 'host', mode: 'team', ball: 'fire' });
  const room = (await A.ws.next('room')).room;
  assert.equal(room.mode, 'team'); assert.equal(room.cap, 4);
  B.ws.send({ t: 'join', code: room.code, ball: 'ice' });
  const r2 = (await A.ws.next(m => m.t === 'room' && m.room.members.length === 2)).room;
  assert.deepEqual(r2.members.map(m => m.team), [0, 1], 'new members balance the teams');
  B.ws.send({ t: 'team', team: 0 });
  await A.ws.next(m => m.t === 'room' && m.room.members.every(x => x.team === 0));
  B.ws.send({ t: 'go' });
  assert.match((await B.ws.next('error')).msg, /host/);
  A.ws.send({ t: 'seek' });
  assert.deepEqual((await A.ws.next('queued')).party, ['duo_a', 'duo_b']);
  C.ws.send({ t: 'queue', mode: 'team', ball: 'thunder' });
  D.ws.send({ t: 'queue', mode: 'team', ball: 'water' });
  const P = [A, B, C, D], st = await Promise.all(P.map(p => p.ws.next('start')));
  assert.equal(st[0].mode, 'team'); assert.equal(st[0].humans, 4); assert.equal(st[0].ranked, true);
  assert.equal(st[0].team, st[1].team, 'the duo plays together'); assert.equal(st[2].team, st[3].team); assert.notEqual(st[0].team, st[2].team);
  const { res, sim } = await finish(P, st);
  for (const r of res) assert.equal(r.win, sim.winner === r.team);
  if (sim.winner >= 0) for (const r of res.filter(x => x.win)) assert.ok(r.rpDelta > 0 && r.coins >= 80);
  close(P);
});

test('co-op vs AI starts when the friend joins; 2 VS 2 friend rooms keep the chosen teams and fill seats with AI', async () => {
  const [A, B] = [await player('coop_a'), await player('coop_b')];
  A.ws.send({ t: 'host', mode: 'coop', ball: 'fire' });
  const code = (await A.ws.next('room')).room.code;
  B.ws.send({ t: 'join', code, ball: 'ice' });
  const st = await Promise.all([A, B].map(p => p.ws.next('start')));
  assert.equal(st[0].mode, 'coop'); assert.equal(st[0].ranked, false); assert.equal(st[0].team, st[1].team);
  assert.equal(st[0].players.filter(x => x.ai).length, 2);
  const { res } = await finish([A, B], st);
  for (const r of res) { assert.equal(r.rpDelta, 0); assert.match(r.note, /Co-op/); }
  close([A, B]);
  // friendly 2 VS 2 with three friends: 1 + AI vs 2
  const [X, Y, Z] = [await player('room_x'), await player('room_y'), await player('room_z')];
  X.ws.send({ t: 'host', mode: 'team', ball: 'fire' });
  const rc = (await X.ws.next('room')).room.code;
  Y.ws.send({ t: 'join', code: rc, ball: 'ice' }); await X.ws.next(m => m.t === 'room' && m.room.members.length === 2);
  Z.ws.send({ t: 'join', code: rc, ball: 'thunder' }); await X.ws.next(m => m.t === 'room' && m.room.members.length === 3);
  Z.ws.send({ t: 'team', team: 1 }); await X.ws.next(m => m.t === 'room' && m.room.members.filter(x => x.team === 1).length === 2);
  X.ws.send({ t: 'go' });
  const s3 = await Promise.all([X, Y, Z].map(p => p.ws.next('start')));
  assert.equal(s3[0].ranked, false); assert.equal(s3[0].humans, 3);
  assert.equal(s3[1].team, s3[2].team); assert.notEqual(s3[0].team, s3[1].team);
  assert.equal(s3[0].players.filter(x => x.ai).length, 1);
  [X, Y, Z].forEach(p => p.ws.send({ t: 'quit' }));
  await Promise.all([X, Y, Z].map(p => p.ws.next('result', 30000)));
  close([X, Y, Z]);
});

test('seasons: tiers, soft reset into a new season, rewards claimed once for the best tier', async () => {
  const c = new Client(srv.base); await c.register('season_vet');
  const uid = srv.db.get("SELECT id FROM users WHERE username = 'season_vet'").id;
  srv.db.run('INSERT INTO season_ranks (season, user_id, points, peak, wins, losses, matches, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', '2000-01', uid, 1000, 1000, 8, 2, 10, Date.now());
  srv.db.run('INSERT INTO season_ranks (season, user_id, points, peak, wins, losses, matches, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', '2000-02', uid, 300, 300, 1, 1, 2, Date.now());
  const s = (await c.get('/api/season')).data;
  assert.equal(s.points, 0); assert.equal(s.tier.name, 'Bronze');
  assert.deepEqual(s.pending.map(p => [p.season, p.tier, p.coins]), [['2000-01', 'Diamond', 2500]], 'only seasons with enough matches pay out');
  assert.deepEqual(Array.from(core.RANK_TIERS, t => t.name), ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Legend']);
  const coins0 = srv.db.get('SELECT coins FROM profiles WHERE user_id = ?', uid).coins;
  const r = await c.post('/api/season/claim');
  assert.equal(r.status, 200); assert.equal(r.data.coins, 2500);
  assert.equal(srv.db.get('SELECT coins FROM profiles WHERE user_id = ?', uid).coins, coins0 + 2500);
  assert.equal((await c.post('/api/season/claim')).status, 409, 'claimed only once');
  // the first ranked result of the new season starts from half of the last season (capped at Platinum)
  const a = srv.S.seasonApply(uid, 10, 'win');
  assert.equal(a.before, 150); assert.equal(a.after, 160); assert.equal(a.tier, 'Silver');
  assert.equal(srv.S.seasonApply(uid, -500, 'loss').after, 0, 'never below zero');
});

test('Premium monthly coins: members claim once per month, others cannot', async () => {
  const c = new Client(srv.base); await c.register('monthly_fan');
  const uid = srv.db.get("SELECT id FROM users WHERE username = 'monthly_fan'").id;
  assert.equal((await c.post('/api/premium/monthly-coins')).status, 403);
  srv.S.grantPremium(uid, 30, 0);
  const me = (await c.get('/api/auth/me')).data;
  const save = me.save || (await c.get('/api/save')).data;
  if (save && save.monthlyCoins) assert.equal(save.monthlyCoins.available, true);
  const r = await c.post('/api/premium/monthly-coins');
  assert.equal(r.status, 200); assert.equal(r.data.coins, 2000); assert.equal(r.data.save.monthlyCoins.available, false);
  assert.equal((await c.post('/api/premium/monthly-coins')).status, 409);
});
