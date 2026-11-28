'use strict';
/**
 * 2.9.0 online: a CO-OP room against THE FRACTURED ARCHON (sealed until the host has found it) in the REALITY COLLISION
 * ZONE, played through the real WebSocket server; the server's verified result must equal a local replay, and the Archon's
 * rewards follow that verified result only.
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
  assert.ok(ws.send, 'websocket accepted'); await ws.next('hello');
  return { c, ws, name };
}
const plan = (slot, b) => (b % (70 + slot * 9) === 35 ? [[1, 'k', slot % 2]] : []);
function expected(start, upTo) {
  core.setCatalog(start.catalog);
  const log = []; for (let b = start.delay; b <= upTo; b++) log.push(...core.mergePvpBlock(b, Array.from({ length: start.humans }, (_, s) => plan(s, b))));
  return core.simulateTicket(start.ticket, log);
}
async function play(P, from, to) {
  for (let b0 = from; b0 <= to; b0 += 50) {
    const b1 = Math.min(to, b0 + 49);
    for (const p of P) for (let b = b0; b <= b1; b++) p.ws.send({ t: 'f', b, a: plan(p.slot, b) });
    for (const p of P) { const seen = new Set(); await p.ws.next(m => { if (m.t === 'f' && m.b === b1) seen.add(m.s); return seen.size === P.length - 1; }, 10000); p.ws.msgs = p.ws.msgs.filter(m => m.t !== 'f'); }
  }
}

test('co-op vs THE FRACTURED ARCHON: sealed for a new host; once found, two friends face one boss seat in the Reality Collision Zone; verified result = local replay', async () => {
  const [A, B] = [await player('arch_host'), await player('arch_friend')];
  A.ws.send({ t: 'host', mode: 'coop', ball: 'fire', boss: 'archon' });
  const e = await A.ws.next('error'); assert.match(e.message || e.error || JSON.stringify(e), /sealed/i);
  srv.db.run('UPDATE profiles SET stats = ? WHERE user_id = (SELECT id FROM users WHERE username = ?)', JSON.stringify({ bossWins: 3 }), 'arch_host');
  A.ws.send({ t: 'host', mode: 'coop', ball: 'fire', boss: 'archon' });
  const room = (await A.ws.next('room')).room; assert.equal(room.archon, true); assert.equal(room.arena, 'collision');
  B.ws.send({ t: 'join', code: room.code, ball: 'ice' });
  const st = await Promise.all([A, B].map(p => p.ws.next('start')));
  const T = st[0].ticket;
  assert.equal(T.opts.archon, true); assert.equal(T.opts.arena, 'collision');
  assert.equal(T.teams.length, 2); assert.equal(T.teams[1].length, 1, 'one boss seat');
  assert.equal(T.teams[1][0].ball, core.ARCHON.id); assert.equal(T.teams[1][0].boss, true);
  assert.equal(st[0].team, st[1].team, 'the two friends are on the same team');
  [A, B].forEach((p, i) => { p.slot = st[i].slot; });
  const sim = expected(st[0], 40000); assert.ok(sim.ok, 'the match ends');
  await play([A, B].sort((a, b) => a.slot - b.slot), st[0].delay, Math.ceil(sim.step / K) + st[0].delay + 1);
  [A, B].forEach(p => p.ws.send({ t: 'end', step: sim.step }));
  const res = await Promise.all([A, B].map(p => p.ws.next('result', 30000)));
  for (const r of res) { assert.equal(r.step, sim.step, 'server result = local replay'); assert.equal(r.winner, sim.winner); }
  const won = sim.winner === st[0].team, clears = srv.db.get('SELECT COUNT(*) AS n FROM archon_clears').n;
  assert.equal(clears, won ? 2 : 0, 'Archon rewards only for a verified win (one per player)');
  for (const r of res) assert.equal(!!(r.reality && r.reality.archon), won);
  A.ws.close(); B.ws.close();
});
