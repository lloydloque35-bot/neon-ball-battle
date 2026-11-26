'use strict';
/**
 * 2.4.0 GOD OF ABSOLUTE in online multiplayer: only a verified owner can bring it (at its own Lv 50+, every skill unlocked,
 * with THE ABSOLUTE OWNER nameplate); both screens get the same battle and the server's replay decides the result —
 * including a player who disconnects mid-match (the AI takes over and the match still counts).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, Client, wsConnect } = require('./helpers');
const { loadCore } = require('../core');

const core = loadCore();
const K = core.PVP.BLOCK, ABS = 'godofabsolute';
let srv;
test.before(async () => { srv = await startServer(); srv.S.pvp.LIMITS.msgsPerSec = 1e6; });
test.after(async () => { await srv.stop(); });

async function player(name) {
  const c = new Client(srv.base); assert.equal((await c.register(name)).status, 200);
  const ws = await wsConnect(srv.base, '/api/pvp/ws', { cookie: c.cookie, origin: srv.base }); await ws.next('hello');
  return { c, ws, name };
}
/** a verified owner, exactly as a confirmed payment makes one (purchase row + edition grant in one transaction) */
function makeOwner(name) {
  const uid = srv.db.get('SELECT id FROM users WHERE username = ?', name).id, id = 'pur_test_' + name;
  srv.db.tx(() => {
    srv.db.run("INSERT INTO shop_purchases (id, user_id, product, balls, amount, currency, provider, status, created_at, updated_at, paid_at) VALUES (?, ?, ?, ?, 49900, 'PHP', 'manual', 'paid', ?, ?, ?)", id, uid, ABS, JSON.stringify([ABS]), Date.now(), Date.now(), Date.now());
    assert.ok(srv.S.edition.grant(uid, id, ABS, { source: 'test' }).serial);
  });
}
const plan = (slot, b) => { const a = []; if (slot === 1 && b % 90 === 45) a.push([K - 1, 'u', 0]); if (slot === 0 && b % 70 === 10) a.push([2, 'k', 0]); return a; };
function expected(start, upTo, cut) {
  core.setCatalog(start.catalog); const log = [];
  for (let b = start.delay; b <= upTo; b++) log.push(...core.mergePvpBlock(b, [cut && b >= cut.from ? (b === cut.from ? [[0, 'm', 0]] : []) : plan(0, b), plan(1, b)]));
  return core.simulateTicket(start.ticket, log);
}
async function play(P, from, to) {
  for (let b0 = from; b0 <= to; b0 += 50) {
    const b1 = Math.min(to, b0 + 49);
    for (const p of P) if (p.live) for (let b = b0; b <= b1; b++) p.ws.send({ t: 'f', b, a: plan(p.slot, b) });
    for (const p of P) if (p.live && P.every(q => q.live)) { await p.ws.next(m => m.t === 'f' && m.b === b1); p.ws.msgs = p.ws.msgs.filter(m => m.t !== 'f'); }
  }
}

test('only a verified owner can queue with God of Absolute', async () => {
  const p = await player('abs_pvp_nobody');
  p.ws.send({ t: 'queue', ball: ABS });
  assert.match((await p.ws.next('error')).msg, /own|not allowed|available/i);
  p.ws.close();
});

test('ranked match with God of Absolute: same battle on both screens, Lv 50, all skills, nameplate; the server replay decides', async () => {
  const A = await player('abs_pvp_owner'), B = await player('abs_pvp_rival'); makeOwner('abs_pvp_owner');
  A.ws.send({ t: 'queue', ball: ABS }); await A.ws.next('queued');
  B.ws.send({ t: 'queue', ball: 'ice' });
  const sa = await A.ws.next('start'), sb = await B.ws.next('start');
  assert.deepEqual(sa.ticket, sb.ticket);
  const spec = sa.ticket.teams[sa.slot][0];
  assert.equal(spec.ball, ABS); assert.equal(spec.level, 50); assert.equal(spec.cos && spec.cos.title, 'title_absolute');
  core.setCatalog(sa.catalog);
  const Bt = new core.Battle(core.buildBattleConfig(sa.ticket, { headless: true })), me = Bt.fighters.find(f => f.baseDef && f.baseDef.id === ABS);
  assert.equal(me.skills.filter(s => s.locked).length, 0, 'all five skills unlocked at Lv 50'); assert.equal(me.formCap, 0, 'forms come at Lv 70 / 100');
  A.slot = sa.slot; B.slot = sb.slot; A.live = B.live = true;
  const P = [A, B].sort((x, y) => x.slot - y.slot), sim = expected(sa, 40000);
  await play(P, sa.delay, Math.ceil(sim.step / K) + sa.delay + 1);
  P.forEach(p => p.ws.send({ t: 'end', step: sim.step }));
  const [ra, rb] = await Promise.all([A.ws.next('result', 30000), B.ws.next('result', 30000)]);
  assert.equal(ra.winner, sim.winner); assert.equal(rb.winner, sim.winner); assert.equal(ra.step, sim.step);
  A.ws.close(); B.ws.close();
});

test('a player who disconnects during a God of Absolute match is replaced by the AI; copies and the ultimate end cleanly, the result still counts', async () => {
  const A = await player('abs_room_host'), B = await player('abs_room_guest'); makeOwner('abs_room_host');
  A.ws.send({ t: 'host', ball: ABS }); const room = await A.ws.next('room');
  B.ws.send({ t: 'join', code: room.code, ball: 'thunder' });
  const sa = await A.ws.next('start'), sb = await B.ws.next('start');
  A.slot = sa.slot; B.slot = sb.slot; A.live = B.live = true;
  const P = [A, B].sort((x, y) => x.slot - y.slot), leaveAt = sa.delay + 160;      // ~8 s in: skills, copies and ultimates are under way
  await play(P, sa.delay, leaveAt);
  const gone = P[0], stay = P[1]; gone.ws.close(); gone.live = false; await stay.ws.next('left');
  const sim = expected(sa, 40000, { from: leaveAt + 1 });
  await play(P, leaveAt + 1, Math.ceil(sim.step / K) + sa.delay + 1);
  stay.ws.send({ t: 'end', step: sim.step });
  const r = await stay.ws.next('result', 30000);
  assert.equal(r.winner, sim.winner); assert.equal(r.step, sim.step);
  // the replay itself: no copy or ultimate state survives the match, and nothing exceeds the copy cap
  core.setCatalog(sa.catalog); const Bt = new core.Battle(core.buildBattleConfig(sa.ticket, { headless: true }));
  let maxCopies = 0; for (let i = 0; i < sim.step; i++) { Bt.step(core.STEP); maxCopies = Math.max(maxCopies, Bt.fighters.filter(f => f.absCopy && f.alive).length); }
  assert.ok(maxCopies <= 3, 'copies never exceed the cap');
  stay.ws.close();
});
