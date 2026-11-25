'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, Client, wsConnect } = require('./helpers');
const { loadCore } = require('../core');

const core = loadCore();
const K = core.PVP.BLOCK;
let srv;
test.before(async () => { srv = await startServer(); srv.S.pvp.LIMITS.msgsPerSec = 1e6; });   // tests replay whole matches in a few seconds
test.after(async () => { await srv.stop(); });

async function player(name) {
  const c = new Client(srv.base); const r = await c.register(name); assert.equal(r.status, 200);
  const ws = await wsConnect(srv.base, '/api/pvp/ws', { cookie: c.cookie, origin: srv.base });
  assert.ok(ws.send, 'websocket accepted');
  await ws.next('hello');
  return { c, ws, name };
}
/** deterministic "button presses" for a slot in a block */
function plan(slot, b) {
  const a = [];
  if (slot === 0 && b === 20) a.push([0, 'm', 1]);
  if (slot === 0 && b >= 20 && b % 15 === 0) a.push([3, 's', b % 2 ? 60 : -80, b % 3 ? 40 : -30, 900]);
  if (slot === 1 && b % 90 === 45) a.push([K - 1, 'u', 0]);
  if (slot === 1 && b % 70 === 10) a.push([2, 'k', 0]);
  return a;
}
function expected(start, upTo, opts = {}) {
  core.setCatalog(start.catalog);
  const log = [];
  for (let b = start.delay; b <= upTo; b++) log.push(...core.mergePvpBlock(b, [opts.only === 1 ? (b < opts.from ? plan(0, b) : b === opts.from ? [[0, 'm', 0]] : []) : plan(0, b), plan(1, b)]));
  return core.simulateTicket(start.ticket, log);
}
/** sends frames for blocks [from, to] for both players, interleaved in chunks like real browsers would */
async function play(P, from, to) {
  for (let b0 = from; b0 <= to; b0 += 50) {
    const b1 = Math.min(to, b0 + 49);
    for (const p of P) if (p.live) for (let b = b0; b <= b1; b++) p.ws.send({ t: 'f', b, a: plan(p.slot, b) });
    for (const p of P) if (p.live && P.every(q => q.live)) { await p.ws.next(m => m.t === 'f' && m.b === b1); p.ws.msgs = p.ws.msgs.filter(m => m.t !== 'f'); }
  }
}

test('PvP socket refuses guests, other websites and unknown paths', async () => {
  assert.equal((await wsConnect(srv.base, '/api/pvp/ws', { origin: srv.base })).rejected, 401);
  const c = new Client(srv.base); await c.register('wsguard');
  assert.equal((await wsConnect(srv.base, '/api/pvp/ws', { cookie: c.cookie, origin: 'https://evil.example' })).rejected, 403);
  assert.equal((await wsConnect(srv.base, '/api/pvp/ws', { cookie: c.cookie })).rejected, 403);
  assert.equal((await wsConnect(srv.base, '/api/nope', { cookie: c.cookie, origin: srv.base })).rejected, 404);
  // the single-player battle API cannot be used to create PvP tickets
  const r = await c.post('/api/battle/start', { mode: 'pvp', ball: 'fire' });
  assert.equal(r.status, 400);
});

test('unmasked frames close the connection; admin balls are refused in ranked', async () => {
  const p = await player('maskless');
  p.ws.send({ t: 'queue', ball: 'oneaboveall' });
  assert.match((await p.ws.next('error')).msg, /own|not allowed/);
  p.ws.send({ t: 'queue', ball: 'fire' }, { unmasked: true });
  await new Promise(r => setTimeout(r, 200));
  assert.ok(p.ws.closed || p.ws.closeCode === 1002);
});

test('ranked quick match: both screens get the same battle, the server decides the result and rank points', async () => {
  const A = await player('alice_pvp'), B = await player('bobby_pvp');
  A.ws.send({ t: 'queue', ball: 'fire' }); await A.ws.next('queued');
  B.ws.send({ t: 'queue', ball: 'ice' });
  const sa = await A.ws.next('start'), sb = await B.ws.next('start');
  assert.deepEqual(sa.ticket, sb.ticket);
  assert.equal(sa.delay, sb.delay);
  assert.notEqual(sa.slot, sb.slot);
  assert.equal(sa.ranked, true);
  assert.equal(sa.ticket.teams[sa.slot][0].ball, 'fire');
  assert.equal(sa.opp.name, 'bobby_pvp');
  A.slot = sa.slot; B.slot = sb.slot; A.live = B.live = true;
  const P = [A, B].sort((x, y) => x.slot - y.slot);
  const sim = expected(sa, 40000);
  assert.ok(sim.ok);
  const endBlock = Math.ceil(sim.step / K) + sa.delay + 1;
  await play(P, sa.delay, endBlock);
  P.forEach(p => p.ws.send({ t: 'end', step: sim.step }));
  const [ra, rb] = await Promise.all([A.ws.next('result', 20000), B.ws.next('result', 20000)]);
  assert.equal(ra.winner, sim.winner);
  assert.equal(ra.step, sim.step);
  assert.equal(ra.win, sim.winner === A.slot);
  assert.equal(rb.win, sim.winner === B.slot);
  const [w, l] = ra.win ? [ra, rb] : [rb, ra];
  assert.equal(w.rpDelta, 16); assert.equal(l.rpDelta, -16);
  assert.equal(w.coins, 80); assert.equal(l.coins, 20);
  assert.equal(w.rpAfter, w.rpBefore + 16);
  assert.ok(ra.save && typeof ra.save.coins === 'number');
  const hist = await A.c.get('/api/pvp/history');
  assert.equal(hist.data.matches.length, 1);
  assert.equal(hist.data.matches[0].opp, 'bobby_pvp');
  A.ws.close(); B.ws.close();
});

test('private room by code; a player who disconnects is replaced by the AI and the match still counts', async () => {
  const A = await player('host_room'), B = await player('guest_room');
  A.ws.send({ t: 'host', ball: 'thunder' });
  const room = await A.ws.next('room');
  assert.match(room.code, /^[A-Z2-9]{5}$/);
  B.ws.send({ t: 'join', code: 'ZZZZZ', ball: 'water' });
  assert.match((await B.ws.next('error')).msg, /not found/i);
  B.ws.send({ t: 'join', code: room.code.toLowerCase(), ball: 'water' });
  const sa = await A.ws.next('start'), sb = await B.ws.next('start');
  assert.equal(sa.ranked, false);
  A.slot = sa.slot; B.slot = sb.slot; A.live = B.live = true;
  const P = [A, B].sort((x, y) => x.slot - y.slot);
  const leaveAt = sa.delay + 40;
  await play(P, sa.delay, leaveAt);
  // slot 0 leaves: from its next block on, the server plays "no input" and switches it back to AUTO
  const gone = P[0], stay = P[1];
  gone.ws.close(); gone.live = false;
  await stay.ws.next('oppLeft');
  const sim = expected(sa, 40000, { only: 1, from: leaveAt + 1 });
  const endBlock = Math.ceil(sim.step / K) + sa.delay + 1;
  await play(P, leaveAt + 1, endBlock);
  stay.ws.send({ t: 'end', step: sim.step });
  const r = await stay.ws.next('result', 20000);
  assert.equal(r.winner, sim.winner);
  assert.equal(r.step, sim.step);
  assert.equal(r.rpDelta, 0);
  assert.match(r.note, /Friendly/);
  stay.ws.close();
});

test('a player who sends inputs for the wrong block is dropped, not trusted', async () => {
  const A = await player('cheat_a'), B = await player('cheat_b');
  A.ws.send({ t: 'queue', ball: 'fire' }); await A.ws.next('queued');
  B.ws.send({ t: 'queue', ball: 'earth' });
  const sa = await A.ws.next('start'); await B.ws.next('start');
  A.ws.send({ t: 'f', b: sa.delay + 5, a: [] });                       // skips blocks
  assert.equal((await A.ws.next('dropped')).why, 'protocol');
  await B.ws.next('oppLeft');
  B.ws.send({ t: 'f', b: sa.delay, a: [[0, 'x', 1]] });                // unknown input type
  assert.equal((await B.ws.next('dropped')).why, 'bad_input');
  const r = await A.ws.next('result', 20000);                          // both gone: the AI finishes the fight
  assert.ok(r.winner === 0 || r.winner === 1 || r.winner === -1);
  const ev = srv.db.all("SELECT kind FROM security_events WHERE kind LIKE 'pvp_%'").map(e => e.kind);
  assert.ok(ev.includes('pvp_protocol') && ev.includes('pvp_bad_input'));
  A.ws.close(); B.ws.close();
});
