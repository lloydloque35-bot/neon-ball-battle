'use strict';
/**
 * Online PvP — real-time 1 vs 1 between two signed-in players.
 *
 * How it works (deterministic lockstep, server-authoritative result):
 *  - The server builds the match ticket (seed + both balls from each player's SERVER-SIDE progress) and sends it to both browsers.
 *  - Both browsers run the same deterministic simulation. Inputs travel in blocks of 12 steps (50 ms):
 *    a player's inputs for block b are sent `delay` blocks in advance and a browser may only simulate a block
 *    once it has both players' inputs for it, so both screens show the same fight.
 *  - The server only relays and records validated inputs, enforces that each player controls only their own ball,
 *    and replaces a player who disconnects or stalls with the AI (their ball keeps fighting on AUTO).
 *  - When the match ends the server re-simulates it from the ticket and the recorded inputs in a worker thread.
 *    ITS result decides the winner, rank points (Elo) and rewards. Browsers cannot report a result.
 */
const crypto = require('node:crypto');
const S_ = require('./security');
const { json } = require('./db');
const ws = require('./ws');

const now = () => Date.now();
const dayStart = (t = now()) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LIMITS = { dropAfterMs: 15000, maxMatchMs: 30 * 60e3, roomTtlMs: 10 * 60e3, idleCloseMs: 60000, rewardedPerDay: 20, samePairPerDay: 3, msgsPerSec: 300, maxInputs: 60000 };
const REWARDS = { win: { coins: 80, exp: 60 }, loss: { coins: 20, exp: 20 }, draw: { coins: 40, exp: 40 } };
const ELO_K = 32;

function register(app, S) {
  const { db, cfg, core } = S;
  const K = core.PVP.BLOCK, BLOCK_MS = K / 240 * 1000;
  const MAX_STEPS = cfg.maxBattleMinutes * 60 * 240, MAX_BLOCKS = Math.floor(MAX_STEPS / K);
  const conns = new Map();     // userId → connection
  const queue = [];            // ranked quick-match queue
  const rooms = new Map();     // code → { code, host, at }
  const matches = new Map();   // id → live match
  S.pvp = { conns, queue, rooms, matches, LIMITS };

  const isOwner = u => u.role === 'owner';
  const send = (p, msg) => { if (p && !p.ws.closed) p.ws.send(msg); };
  const err = (p, msg) => send(p, { t: 'error', msg });
  const rpOf = uid => (db.get('SELECT rp FROM profiles WHERE user_id = ?', uid) || { rp: 0 }).rp;
  const lobbyInfo = () => ({ online: conns.size, searching: queue.length });

  /* ================= connection ================= */
  S.onUpgrade = (req, socket, head) => {
    let path = ''; try { path = new URL(req.url, 'http://x').pathname; } catch { /* bad url */ }
    if (path !== '/api/pvp/ws') return ws.reject(socket, 404, 'Not Found');
    const ip = cfg.trustProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',').pop().trim() : req.socket.remoteAddress;
    if (!S.originAllowed(req.headers.origin, req.headers.host)) {
      S.secEvent(null, 'pvp_bad_origin', 2, { origin: String(req.headers.origin || '').slice(0, 120) }, ip);
      return ws.reject(socket, 403, 'Forbidden');
    }
    if (!S.limiter.hit('pvpws:' + ip, 30, 60e3)) return ws.reject(socket, 429, 'Too Many Requests');
    const user = S.userFromCookieHeader(req.headers.cookie);
    if (!user) return ws.reject(socket, 401, 'Unauthorized');
    const conn = ws.accept(req, socket, head);
    if (!conn) return;
    const old = conns.get(user.id);
    if (old) { err(old, 'Online battles were opened in another window, so this one was closed.'); old.ws.close(4000); onClose(old); }
    const p = { ws: conn, user, ip, state: 'idle', spec: null, room: null, match: null, slot: -1, rtt: 250, pingN: 0, pingAt: 0, bucket: LIMITS.msgsPerSec * 3, bucketAt: now() };
    conns.set(user.id, p);
    conn.on('message', m => { try { onMessage(p, m); } catch (e) { S.log.error('[pvp]', e); err(p, 'Something went wrong. Please try again.'); } });
    conn.on('close', () => onClose(p));
    send(p, { t: 'hello', you: { name: user.username, rp: rpOf(user.id) }, block: K, ...lobbyInfo() });
  };

  function onMessage(p, m) {
    const t = now();
    p.bucket = Math.min(LIMITS.msgsPerSec * 3, p.bucket + (t - p.bucketAt) / 1000 * LIMITS.msgsPerSec); p.bucketAt = t;
    if ((p.bucket -= 1) < 0) { S.secEvent(p.user.id, 'pvp_flood', 2, {}, p.ip); return p.ws.close(4008); }
    switch (m.t) {
      case 'pong': if (m.n === p.pingN && p.pingAt) { p.rtt = Math.round(p.rtt * 0.6 + Math.min(3000, t - p.pingAt) * 0.4); p.pingAt = 0; } return;
      case 'queue': return joinQueue(p, m);
      case 'host': return hostRoom(p, m);
      case 'join': return joinRoom(p, m);
      case 'leave': leaveLobby(p); return send(p, { t: 'idle', ...lobbyInfo() });
      case 'f': return onFrame(p, m);
      case 'end': return p.match && p.match.players[p.slot] === p ? dropSlot(p.match, p.slot, 'ended') : undefined;
      case 'quit': return p.match && p.match.players[p.slot] === p ? dropSlot(p.match, p.slot, 'quit') : undefined;
      default: return err(p, 'Unknown request');
    }
  }

  function onClose(p) {
    if (conns.get(p.user.id) === p) conns.delete(p.user.id);
    leaveLobby(p);
    if (p.match && !p.match.finishing && p.match.players[p.slot] === p) dropSlot(p.match, p.slot, 'disconnect');
  }

  /* ================= lobby: quick match & private rooms ================= */
  /** validates the chosen ball against the player's SERVER-SIDE access and builds their fighter from server progress */
  function prepare(p, ballId, ranked) {
    if (p.match) throw new Error('You are already in a match.');
    const row = db.get('SELECT status, suspended_until FROM users WHERE id = ?', p.user.id);
    if (!row || row.status === 'banned' || (row.status === 'suspended' && (!row.suspended_until || row.suspended_until > now()))) throw new Error('Your account cannot play online right now.');
    const u = { id: p.user.id, role: p.user.role };
    return S.withCatalog(u, () => {
      const def = core.getBall(String(ballId || ''));
      const acc = S.access(u, def);
      if (!def || !acc) throw new Error('Choose a ball you own.');
      if (def.draft) throw new Error('Draft balls cannot be used online.');
      if (def.adminOnly && (ranked || !isOwner(u))) throw new Error(ranked ? 'Admin balls are not allowed in ranked matches. Use a private room.' : 'That ball is not available.');
      const pr = S.progOf(u.id, def.id);
      return { ball: def.id, level: pr.level, evo: pr.evo, up: pr.up, tree: pr.tree, cos: json(S.profileRow(u.id).loadout, {}), name: p.user.username, fusion: !!def.fusion };
    });
  }
  function joinQueue(p, m) {
    leaveLobby(p);
    try { p.spec = prepare(p, m.ball, true); } catch (e) { return err(p, e.message); }
    const other = queue.find(q => q.user.id !== p.user.id && !q.ws.closed);
    if (other) { queue.splice(queue.indexOf(other), 1); return startMatch([other, p], true, null); }
    queue.push(p); p.state = 'queue';
    send(p, { t: 'queued', ...lobbyInfo() });
  }
  function hostRoom(p, m) {
    leaveLobby(p);
    try { p.spec = prepare(p, m.ball, false); } catch (e) { return err(p, e.message); }
    if (!S.limiter.hit('pvproom:' + p.user.id, 30, 3600e3)) return err(p, 'Too many rooms created. Try again later.');
    let code; do { code = Array.from({ length: 5 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(code));
    const room = { code, host: p, at: now() }; rooms.set(code, room);
    p.room = room; p.state = 'room';
    send(p, { t: 'room', code });
  }
  function joinRoom(p, m) {
    if (!S.limiter.hit('pvpjoin:' + p.user.id, 30, 600e3)) return err(p, 'Too many attempts. Wait a few minutes.');
    const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const room = rooms.get(code);
    if (!room || room.host.ws.closed) return err(p, 'Room not found. Check the code.');
    if (room.host.user.id === p.user.id) return err(p, 'You cannot join your own room.');
    leaveLobby(p);
    try { p.spec = prepare(p, m.ball, false); } catch (e) { return err(p, e.message); }
    rooms.delete(code); room.host.room = null;
    startMatch([room.host, p], false, code);
  }
  function leaveLobby(p) {
    const i = queue.indexOf(p); if (i >= 0) queue.splice(i, 1);
    if (p.room) { rooms.delete(p.room.code); p.room = null; }
    if (!p.match) p.state = 'idle';
  }

  /* ================= match lifecycle ================= */
  /** the ball catalog both browsers and the verifier use for this match (published balls + the players' own fusions) */
  function matchCatalog(players) {
    const base = S.catalogFor(null, false);
    base.fusions = players.filter(p => p.spec.fusion).map(p => S.catalogFor(p.user.id, false).fusions.find(f => f.id === p.spec.ball)).filter(Boolean);
    return base;
  }
  function startMatch(players, ranked, code) {
    if (crypto.randomInt(2)) players.reverse();
    const catalog = matchCatalog(players);
    let ticket;
    try {
      core.setCatalog(catalog);
      ticket = core.createPvpTicket(players.map(p => ({ ball: p.spec.ball, level: p.spec.level, evo: p.spec.evo, up: p.spec.up, tree: p.spec.tree, cos: p.spec.cos, name: p.spec.name })), crypto.randomInt(0, 2 ** 32));
    } catch (e) {
      S.log.error('[pvp start]', e.message);
      return players.forEach(p => { p.state = 'idle'; err(p, 'The match could not be started. Please try again.'); });
    }
    // input delay covers the round trip between the two players through the server
    const delay = Math.min(core.PVP.MAX_DELAY, Math.max(core.PVP.MIN_DELAY, Math.ceil((players[0].rtt / 2 + players[1].rtt / 2 + 80) / BLOCK_MS)));
    const id = S_.randomId('m_'), t = now();
    const M = { id, ranked, code, ticket, catalog, delay, players, frames: new Map(), next: [delay, delay], confirmed: delay - 1, log: [], inputs: 0,
      out: [false, false], why: [null, null], synth: [false, false], last: [t, t], at: t, finishing: false };
    matches.set(id, M);
    players.forEach((p, slot) => { p.state = 'match'; p.match = M; p.slot = slot; });
    db.run('INSERT INTO pvp_matches (id, ranked, p1_id, p2_id, ball1, ball2, ticket, catalog, delay_blocks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, ranked ? 1 : 0, players[0].user.id, players[1].user.id, players[0].spec.ball, players[1].spec.ball, JSON.stringify(ticket), JSON.stringify(catalog), delay, t);
    players.forEach((p, slot) => {
      const o = players[1 - slot];
      send(p, { t: 'start', id, ticket, catalog, slot, delay, block: K, ranked, room: code || null, you: { name: p.user.username, rp: rpOf(p.user.id) }, opp: { name: o.user.username, ball: o.spec.ball, level: o.spec.level, rp: rpOf(o.user.id) } });
    });
  }

  function onFrame(p, m) {
    const M = p.match; if (!M || M.finishing || M.players[p.slot] !== p) return;
    const s = p.slot; if (M.out[s]) return;
    const b = m.b;
    if (!Number.isInteger(b) || b !== M.next[s] || b > MAX_BLOCKS || b - M.confirmed > 600) return dropSlot(M, s, 'protocol', { b, expected: M.next[s] });
    const acts = core.cleanPvpActions(m.a == null ? [] : m.a);
    if (!acts) return dropSlot(M, s, 'bad_input');
    M.last[s] = now();
    storeFrame(M, s, b, acts);
  }
  function storeFrame(M, s, b, acts) {
    let f = M.frames.get(b); if (!f) M.frames.set(b, f = [undefined, undefined]);
    f[s] = acts; M.next[s] = b + 1; M.inputs += acts.length;
    const o = 1 - s;
    if (!M.out[o]) send(M.players[o], { t: 'f', s, b, a: acts });
    else synthUpTo(M, o, b);      // the other player is gone: their ball fights on AUTO
    while (true) {
      const nb = M.confirmed + 1, fr = M.frames.get(nb);
      if (!fr || fr[0] === undefined || fr[1] === undefined) break;
      for (const e of core.mergePvpBlock(nb, fr)) M.log.push(e);
      M.frames.delete(nb); M.confirmed = nb;
    }
    if (M.confirmed >= MAX_BLOCKS || M.inputs > LIMITS.maxInputs) finishMatch(M, 'limit');
  }
  /** fills a departed player's blocks with "no input" (the first one switches their ball back to AUTO) */
  function synthUpTo(M, x, b) {
    while (!M.finishing && M.next[x] <= b) { const acts = M.synth[x] ? [] : [[0, 'm', 0]]; M.synth[x] = true; storeFrame(M, x, M.next[x], acts); }
  }
  function dropSlot(M, s, why, details) {
    if (M.out[s] || M.finishing) return;
    M.out[s] = true; M.why[s] = why;
    const p = M.players[s];
    if (why === 'protocol' || why === 'bad_input') S.secEvent(p.user.id, 'pvp_' + why, 2, { match: M.id, ...(details || {}) }, p.ip);
    if (why !== 'ended') send(p, { t: 'dropped', why });
    const o = 1 - s;
    if (M.out[o]) return finishMatch(M, why);
    if (why !== 'ended') send(M.players[o], { t: 'oppLeft', why });
    synthUpTo(M, s, M.next[o] - 1);
  }

  async function finishMatch(M, reason) {
    if (M.finishing) return;
    M.finishing = true;
    if (closing) return;
    let v;
    try { v = await S.verifier.verify(M.ticket, M.log, M.catalog, MAX_STEPS); }
    catch (e) {
      if (closing) return;
      S.log.error('[pvp verify]', e.message);
      db.run("UPDATE pvp_matches SET status = 'error', flags = 'verify_error', inputs = ?, finished_at = ? WHERE id = ?", JSON.stringify(M.log), now(), M.id);
      M.players.forEach(p => { send(p, { t: 'result', id: M.id, error: 'The match could not be verified, so it was not counted.' }); release(p, M); });
      matches.delete(M.id); return;
    }
    if (closing) return;
    const r = v.result, winner = r.ok && (r.winner === 0 || r.winner === 1) ? r.winner : -1;
    let changes;
    try { changes = db.tx(() => applyResult(M, winner)); }
    catch (e) { S.log.error('[pvp apply]', e); changes = [{}, {}]; }
    const summary = { winner, step: r.step, time: r.time, slots: r.slots, reason, left: M.why };
    db.run("UPDATE pvp_matches SET status = 'done', winner_slot = ?, result = ?, changes = ?, inputs = ?, flags = ?, finished_at = ? WHERE id = ?",
      winner, JSON.stringify(summary), JSON.stringify(changes), JSON.stringify(M.log), M.why.filter(w => w && w !== 'ended').join(',') || null, now(), M.id);
    M.players.forEach((p, slot) => {
      send(p, { t: 'result', id: M.id, slot, winner, win: winner === slot, draw: winner === -1, ranked: M.ranked, time: r.time, step: r.step, slots: r.slots, opp: M.players[1 - slot].user.username, ...changes[slot], save: S.savePayload(p.user) });
      release(p, M);
    });
    matches.delete(M.id);
  }
  function release(p, M) { if (p.match === M) { p.match = null; p.slot = -1; p.state = 'idle'; } }

  /** rank points (Elo) and rewards — ranked matches only, with daily anti-farming limits */
  function applyResult(M, winner) {
    const ids = M.players.map(p => p.user.id), rps = ids.map(rpOf), since = dayStart();
    const out = [];
    let delta = [0, 0], rewarded = [false, false], notes = ['', ''];
    if (M.ranked) {
      const pair = db.get("SELECT COUNT(*) AS n FROM pvp_matches WHERE ranked = 1 AND status = 'done' AND finished_at >= ? AND ((p1_id = ? AND p2_id = ?) OR (p1_id = ? AND p2_id = ?))", since, ids[0], ids[1], ids[1], ids[0]).n;
      if (pair >= LIMITS.samePairPerDay) notes = notes.map(() => 'You already played this opponent several times today: no rank points or rewards.');
      else {
        const ea = 1 / (1 + 10 ** ((rps[1] - rps[0]) / 400)), sa = winner === 0 ? 1 : winner === 1 ? 0 : 0.5, d = Math.round(ELO_K * (sa - ea));
        delta = [d, -d];
        rewarded = ids.map((uid, s) => {
          const n = db.get("SELECT COUNT(*) AS n FROM pvp_matches WHERE ranked = 1 AND status = 'done' AND finished_at >= ? AND (p1_id = ? OR p2_id = ?)", since, uid, uid).n;
          if (n >= LIMITS.rewardedPerDay) { notes[s] = 'Daily online reward limit reached: rank points only.'; return false; }
          return true;
        });
      }
    } else notes = notes.map(() => 'Friendly match: no rank points or rewards.');
    M.players.forEach((p, s) => {
      const uid = ids[s], res = winner === -1 ? 'draw' : winner === s ? 'win' : 'loss', ball = p.spec.ball;
      const bonus = S.premiumOf(uid).active ? 1.25 : 1, base = rewarded[s] ? REWARDS[res] : { coins: 0, exp: 0 };
      const coins = Math.round(base.coins * bonus), exp = Math.round(base.exp * bonus);
      let ups = 0, level = null;
      if (M.ranked) {
        S.updateProfile(uid, pr => {
          const st = pr.stats; st.pvpBattles = (st.pvpBattles || 0) + 1;
          const k = { win: 'pvpWins', loss: 'pvpLosses', draw: 'pvpDraws' }[res]; st[k] = (st[k] || 0) + 1;
          return { stats: st, coins: pr.coins + coins, rp: pr.rp + delta[s] };
        });
        if (exp) { ({ ups, level } = S.giveBallExp(uid, ball, exp)); S.giveAccountExp(uid, exp); }
      }
      out.push({ result: res, ball, coins, exp, ups, level, rpBefore: rps[s], rpAfter: Math.max(0, rps[s] + delta[s]), rpDelta: delta[s], note: notes[s] });
    });
    return out;
  }

  /* ================= housekeeping: pings, stalled players, expired rooms ================= */
  const timer = setInterval(() => {
    const t = now();
    for (const M of matches.values()) {
      if (M.finishing) continue;
      if (t - M.at > LIMITS.maxMatchMs) { finishMatch(M, 'time_limit'); continue; }
      for (const s of [0, 1]) if (!M.out[s] && t - M.last[s] > LIMITS.dropAfterMs) dropSlot(M, s, 'timeout');
    }
    for (const [code, r] of rooms) if (t - r.at > LIMITS.roomTtlMs || r.host.ws.closed) { rooms.delete(code); r.host.room = null; if (!r.host.match) { r.host.state = 'idle'; err(r.host, 'Your room expired.'); send(r.host, { t: 'idle', ...lobbyInfo() }); } }
    for (const p of [...conns.values()]) {
      if (t - p.ws.lastSeen > LIMITS.idleCloseMs) { p.ws.close(4001); onClose(p); continue; }
      if (!p.pingAt || t - p.pingAt > 5000) { p.pingN++; p.pingAt = t; send(p, { t: 'ping', n: p.pingN, ...lobbyInfo() }); }
    }
  }, 1000);
  timer.unref?.();
  let closing = false;   // server shutting down: stop starting work that would touch the database
  (S.closers = S.closers || []).push(() => { closing = true; clearInterval(timer); for (const p of conns.values()) p.ws.close(1001); });

  /* ================= HTTP: lobby info and match history ================= */
  app.get('/api/pvp/status', ctx => { S.requireUser(ctx); return lobbyInfo(); });
  app.get('/api/pvp/history', ctx => {
    const u = S.requireUser(ctx);
    const rows = db.all(`SELECT m.id, m.ranked, m.p1_id, m.ball1, m.ball2, m.winner_slot, m.changes, m.finished_at, u1.username AS n1, u2.username AS n2
      FROM pvp_matches m LEFT JOIN users u1 ON u1.id = m.p1_id LEFT JOIN users u2 ON u2.id = m.p2_id
      WHERE (m.p1_id = ? OR m.p2_id = ?) AND m.status = 'done' ORDER BY m.finished_at DESC LIMIT 15`, u.id, u.id);
    return {
      matches: rows.map(r => {
        const me = r.p1_id === u.id ? 0 : 1, ch = (json(r.changes, []) || [])[me] || {};
        return { id: r.id, ranked: !!r.ranked, at: r.finished_at, opp: me ? r.n1 : r.n2, ball: me ? r.ball2 : r.ball1, oppBall: me ? r.ball1 : r.ball2,
          result: r.winner_slot === -1 ? 'draw' : r.winner_slot === me ? 'win' : 'loss', rpDelta: ch.rpDelta || 0, coins: ch.coins || 0 };
      }),
    };
  });
}

module.exports = { register, LIMITS };
