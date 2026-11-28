'use strict';
/**
 * Online battles between signed-in players: 1 VS 1, 2 VS 2, the 5-player arena and co-op vs AI.
 *
 * How it works (deterministic lockstep, server-authoritative result):
 *  - The server builds the match ticket (seed + every ball from each player's SERVER-SIDE progress; empty seats get AI balls)
 *    and sends it to every player's browser.
 *  - All browsers run the same deterministic simulation. Inputs travel in blocks of 12 steps (50 ms): a player's inputs for
 *    block b are sent `delay` blocks in advance, and a browser may only simulate a block once it has every player's inputs
 *    for it, so all screens show the same fight.
 *  - The server only relays and records validated inputs, makes sure each player controls only their own ball, and hands
 *    the ball of a player who disconnects or stalls to the AI.
 *  - When the match ends the server re-simulates it from the ticket and the recorded inputs in a worker thread.
 *    ITS result decides the winner, placements, season points and rewards. Browsers cannot report a result.
 *  - Ranked queues: 1 VS 1 pairs two players; 2 VS 2 and the 5-player arena start as soon as the seats are full, or after
 *    `fillAfterMs` with AI balls in the empty seats (at least one player per side / two players). Someone who is alone for
 *    `soloAfterMs` gets an unranked match against AI balls.
 */
const crypto = require('node:crypto');
const S_ = require('./security');
const { json } = require('./db');
const ws = require('./ws');

const now = () => Date.now();
const dayStart = (t = now()) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LIMITS = { dropAfterMs: 15000, maxMatchMs: 30 * 60e3, roomTtlMs: 10 * 60e3, idleCloseMs: 60000, rewardedPerDay: 20, samePairPerDay: 3, msgsPerSec: 300, maxInputs: 60000,
  fillAfterMs: 20000, soloAfterMs: 45000 };
const REWARDS = { win: { coins: 1000, exp: 60 }, loss: { coins: 300, exp: 20 }, draw: { coins: 600, exp: 40 } };          // 2.4.1 owner setting: big online coins
const PLACE_REWARDS = [{ coins: 1000, exp: 70 }, { coins: 600, exp: 45 }, { coins: 400, exp: 30 }, { coins: 300, exp: 20 }, { coins: 300, exp: 15 }];
const AI_NAMES = ['AI Nova', 'AI Blitz', 'AI Orbit', 'AI Vortex', 'AI Spark'];

function register(app, S) {
  const { db, cfg, core } = S;
  const K = core.PVP.BLOCK, BLOCK_MS = K / 240 * 1000, MODES = core.PVP_MODES;
  const MAX_STEPS = cfg.maxBattleMinutes * 60 * 240, MAX_BLOCKS = Math.floor(MAX_STEPS / K);
  const FULL_TREE = Object.fromEntries(core.TREE.map(n => [n.id, 1]));
  const conns = new Map();                            // userId → connection
  const queues = { duel: [], team: [], ffa: [] };     // ranked queues of groups { mode, members: [p], at } (a 2 VS 2 duo is one group)
  const rooms = new Map();                            // code → { code, mode, host, members: [p], at }
  const matches = new Map();                          // id → live match
  S.pvp = { conns, queues, rooms, matches, LIMITS };

  const isOwner = u => u.role === 'owner';
  const send = (p, msg) => { if (p && !p.ws.closed) p.ws.send(msg); };
  const err = (p, msg) => send(p, { t: 'error', msg });
  const ptsOf = uid => S.seasonPoints(uid);
  const rankOf = uid => { const pts = ptsOf(uid), t = core.rankTier(pts); return { rp: pts, tier: t.name, ico: t.ico }; };
  const searching = () => Object.values(queues).reduce((n, q) => n + q.reduce((m, g) => m + g.members.length, 0), 0);
  const lobbyInfo = () => ({ online: conns.size, searching: searching() });
  const shuffle = list => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const capOf = mode => MODES[mode].humans || MODES[mode].seats.length;

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
    const p = { ws: conn, user, ip, state: 'idle', spec: null, room: null, group: null, team: 0, match: null, slot: -1, rtt: 250, pingN: 0, pingAt: 0, bucket: LIMITS.msgsPerSec * 3, bucketAt: now() };
    conns.set(user.id, p);
    conn.on('message', m => { try { onMessage(p, m); } catch (e) { S.log.error('[pvp]', e); err(p, 'Something went wrong. Please try again.'); } });
    conn.on('close', () => onClose(p));
    send(p, { t: 'hello', you: { name: user.username, ...rankOf(user.id) }, block: K, ...lobbyInfo() });
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
      case 'team': return setTeam(p, m);
      case 'go': return startRoom(p);
      case 'seek': return seekFromRoom(p);
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

  /* ================= lobby ================= */
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
      const pr = S.progOf(u.id, def.id), x = S.skills26 ? S.skills26.specExtras(u.id, def, pr) : {};      // 2.6.0: skill unlocks (wins), evolutions, mastery looks
      return { ball: def.id, level: pr.level, evo: pr.evo, up: pr.up, tree: pr.tree, cos: json(S.profileRow(u.id).loadout, {}), name: p.user.username, fusion: !!def.fusion, ...x };
    });
  }

  /* ---- ranked queues ---- */
  function joinQueue(p, m) {
    const mode = String(m.mode || 'duel');
    if (!queues[mode]) return err(p, 'That mode has no ranked queue.');
    leaveLobby(p);
    try { p.spec = prepare(p, m.ball, true); } catch (e) { return err(p, e.message); }
    enqueue(mode, [p]);
  }
  function enqueue(mode, members) {
    const g = { mode, members, at: now() };
    for (const p of members) { p.state = 'queue'; p.group = g; }
    queues[mode].push(g);
    matchmake(mode, false);
    queueStatus(mode);
  }
  function queueStatus(mode) {
    const Q = queues[mode]; if (!Q.length) return;
    const humans = Q.reduce((n, g) => n + g.members.length, 0), seats = MODES[mode].seats.length;
    const fillIn = mode === 'duel' ? null : Math.max(0, Math.ceil((Q[0].at + LIMITS.fillAfterMs - now()) / 1000));
    for (const g of Q) for (const p of g.members) send(p, { t: 'queued', mode, found: Math.min(humans, seats), seats, fillIn, party: g.members.length > 1 ? g.members.map(x => x.user.username) : null, ...lobbyInfo() });
  }
  const take = (mode, groups) => { const Q = queues[mode]; for (const g of groups) { const i = Q.indexOf(g); if (i >= 0) Q.splice(i, 1); for (const x of g.members) x.group = null; } };
  /** 2 VS 2: fills team A then team B with the longest-waiting groups that fit (a duo stays together) */
  function teamUp(Q) {
    const A = [], B = [], used = [];
    for (const g of Q) {
      const n = g.members.length;
      if (A.length + n <= 2 && (A.length <= B.length || B.length + n > 2)) { A.push(...g.members); used.push(g); }
      else if (B.length + n <= 2) { B.push(...g.members); used.push(g); }
      if (A.length + B.length === 4) break;
    }
    return { A, B, used };
  }
  function matchmake(mode, timed) {
    const Q = queues[mode]; if (!Q.length) return;
    if (mode === 'duel') {
      while (Q.length >= 2) { const a = Q[0], b = Q[1]; take(mode, [a, b]); launch('duel', shuffle([a.members[0], b.members[0]]).map((p, i) => ({ p, team: i })), true, null); }
      return;
    }
    const waited = now() - Q[0].at;
    if (mode === 'ffa') {
      const humans = Q.flatMap(g => g.members);
      if (humans.length >= 5) { const groups = Q.slice(0, 5); take(mode, groups); return launchFfa(groups.flatMap(g => g.members), true); }
      if (!timed) return;
      if (humans.length >= 2 && waited >= LIMITS.fillAfterMs) { const groups = Q.slice(); take(mode, groups); return launchFfa(humans, true); }
      if (humans.length === 1 && waited >= LIMITS.soloAfterMs) { take(mode, Q.slice()); return launchFfa(humans, false, 'Nobody else was searching, so you fought AI balls. This match is not ranked.'); }
      return;
    }
    const { A, B, used } = teamUp(Q);       // 2 VS 2
    const go = (ranked, note) => { take(mode, used); const flip = crypto.randomInt(2); launch('team', [...A.map(p => ({ p, team: flip })), ...B.map(p => ({ p, team: 1 - flip }))], ranked, null, note); };
    if (A.length + B.length === 4) return go(true);
    if (!timed) return;
    if (A.length && B.length && waited >= LIMITS.fillAfterMs) return go(true);
    if (waited >= LIMITS.soloAfterMs) return go(false, 'Not enough players were searching, so AI balls filled the empty seats. This match is not ranked.');
  }
  const launchFfa = (humans, ranked, note) => launch('ffa', shuffle(humans).map((p, i) => ({ p, team: i })), ranked, null, note);

  /* ---- private rooms (friendly) ---- */
  function hostRoom(p, m) {
    const mode = MODES[m.mode] ? String(m.mode) : 'duel';
    leaveLobby(p);
    try { p.spec = prepare(p, m.ball, false); } catch (e) { return err(p, e.message); }
    if (!S.limiter.hit('pvproom:' + p.user.id, 30, 3600e3)) return err(p, 'Too many rooms created. Try again later.');
    let code; do { code = Array.from({ length: 5 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(code));
    // 2.9.0: a co-op room can fight THE FRACTURED ARCHON (if the host has found it); any room can use the REALITY COLLISION ZONE
    const archon = mode === 'coop' && m.boss === 'archon';
    if (archon && !(S.reality && S.reality.archonUnlockedFor(p.user))) return err(p, 'THE FRACTURED ARCHON is still sealed for you. Win 3 Boss Battles (or own a Reality God) first.');
    const room = { code, mode, host: p, members: [p], at: now(), archon, arena: archon || m.arena === 'collision' ? 'collision' : null }; rooms.set(code, room);
    p.room = room; p.state = 'room'; p.team = 0;
    roomUpdate(room);
  }
  function roomUpdate(room) {
    for (const p of room.members) send(p, { t: 'room', code: room.code, room: { code: room.code, mode: room.mode, cap: capOf(room.mode), isHost: p === room.host, archon: !!room.archon, arena: room.arena || 'classic',
      members: room.members.map(x => ({ name: x.user.username, ball: x.spec.ball, team: x.team, you: x === p, host: x === room.host, ...rankOf(x.user.id) })) } });
  }
  function joinRoom(p, m) {
    if (!S.limiter.hit('pvpjoin:' + p.user.id, 30, 600e3)) return err(p, 'Too many attempts. Wait a few minutes.');
    const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const room = rooms.get(code);
    if (!room || room.host.ws.closed) return err(p, 'Room not found. Check the code.');
    if (room.members.some(x => x.user.id === p.user.id)) return err(p, 'You are already in this room.');
    if (room.members.length >= capOf(room.mode)) return err(p, 'This room is full.');
    leaveLobby(p);
    try { p.spec = prepare(p, m.ball, false); } catch (e) { return err(p, e.message); }
    p.team = room.mode === 'team' ? (room.members.filter(x => x.team === 0).length <= room.members.filter(x => x.team === 1).length ? 0 : 1) : 0;
    room.members.push(p); p.room = room; p.state = 'room';
    if (room.mode === 'duel' || (room.mode === 'coop' && room.members.length === 2)) return startRoom(room.host);   // full: start right away
    roomUpdate(room);
  }
  function setTeam(p, m) {
    const room = p.room; if (!room || room.mode !== 'team') return;
    const t = m.team === 1 ? 1 : 0;
    if (room.members.filter(x => x !== p && x.team === t).length >= 2) return err(p, 'That team is full.');
    p.team = t; roomUpdate(room);
  }
  function closeRoom(room) { rooms.delete(room.code); for (const x of room.members) x.room = null; }
  function startRoom(p) {
    const room = p.room;
    if (!room || room.host !== p) return err(p, 'Only the room host can start the match.');
    if (room.members.length < 2) return err(p, 'Wait for at least one friend to join.');
    closeRoom(room);
    const M = room.members;
    const opts = { arena: room.arena || null, archon: !!room.archon };
    if (room.mode === 'coop') return launch('coop', M.map(x => ({ p: x, team: 0 })), false, room.code, room.archon ? 'Co-op vs THE FRACTURED ARCHON: a verified win gives every player the Archon rewards (no rank points).' : 'Co-op vs AI: a friendly match, so no rank points or rewards.', opts);
    if (room.mode === 'team') return launch('team', M.map(x => ({ p: x, team: x.team })), false, room.code, undefined, opts);
    return launch(room.mode, shuffle(M).map((x, i) => ({ p: x, team: i })), false, room.code, undefined, opts);
  }
  /** a 2 VS 2 room with exactly two friends: search ranked opponents together (same team) */
  function seekFromRoom(p) {
    const room = p.room;
    if (!room || room.host !== p || room.mode !== 'team') return err(p, 'Only the host of a 2 VS 2 room can search for opponents.');
    if (room.members.length !== 2) return err(p, 'Ranked search needs exactly 2 players in the room (you and your teammate).');
    for (const x of room.members) { try { x.spec = prepare(x, x.spec.ball, true); } catch (e) { return err(p, `${x.user.username}: ${e.message}`); } }
    const M = room.members; closeRoom(room);
    enqueue('team', M);
  }
  function leaveLobby(p) {
    if (p.group) {
      const g = p.group; take(g.mode, [g]);
      for (const x of g.members) if (x !== p && !x.match) { x.state = 'idle'; err(x, `${p.user.username} left, so the search was cancelled.`); send(x, { t: 'idle', ...lobbyInfo() }); }
      queueStatus(g.mode);
    }
    if (p.room) {
      const room = p.room; p.room = null; room.members = room.members.filter(x => x !== p);
      if (room.host === p || !room.members.length) {
        closeRoom(room);
        for (const x of room.members) if (!x.match) { x.state = 'idle'; err(x, 'The host closed the room.'); send(x, { t: 'idle', ...lobbyInfo() }); }
      } else roomUpdate(room);
    }
    if (!p.match) p.state = 'idle';
  }

  /* ================= match lifecycle ================= */
  /** the ball catalog every browser and the verifier use for this match (published balls + the players' own fusions) */
  function matchCatalog(players) {
    const base = S.catalogFor(null, false);
    base.fusions = players.filter(p => p.spec.fusion).map(p => S.catalogFor(p.user.id, false).fusions.find(f => f.id === p.spec.ball)).filter(Boolean);
    return base;
  }
  /** humans: [{ p, team }] → seats (players first in each team, AI balls in the empty seats) */
  function launch(mode, humans, ranked, code, note, opts = {}) {
    const layout = MODES[mode].seats, nTeams = Math.max(...layout) + 1, seats = [];
    for (let t = 0; t < nTeams; t++) {
      const mine = humans.filter(h => h.team === t), cap = layout.filter(x => x === t).length;
      for (const h of mine) seats.push({ p: h.p, team: t });
      for (let k = mine.length; k < cap; k++) seats.push({ team: t });
    }
    startMatch(mode, seats, ranked, code, note, opts);
  }
  function startMatch(mode, seats, ranked, code, note, opts = {}) {
    if (opts.archon) seats = [...seats.filter(s => s.p), { team: 1, boss: true }];      // 2.9.0: the two AI seats become THE FRACTURED ARCHON
    const humans = seats.filter(s => s.p).map(s => s.p), slotTeam = seats.filter(s => s.p).map(s => s.team);
    const catalog = matchCatalog(humans);
    let ticket, list;
    try {
      core.setCatalog(catalog);
      const avg = k => humans.reduce((n, p) => n + (p.spec[k] || 0), 0) / humans.length;
      const lv = Math.min(core.MAX_LVL, Math.max(1, Math.round(avg('level')))), evo = Math.min(2, Math.round(avg('evo')));
      const pool = core.opponentPool(false).filter(b => !b.godMode && !b.fusion && !b.draft && !b.summonOnly).map(b => b.id);
      let ai = 0;
      list = seats.map(s => s.p ? { ...s.p.spec, team: s.team }
        : s.boss ? { ai: true, boss: true, ball: core.ARCHON.id, level: Math.min(core.MAX_LVL, lv + 3), evo, up: {}, tree: FULL_TREE, name: 'THE FRACTURED ARCHON', team: s.team }
        : { ai: true, ball: pool[crypto.randomInt(pool.length)], level: lv, evo, up: {}, tree: lv >= 15 ? FULL_TREE : lv >= 5 ? { slot3: 1 } : {}, name: AI_NAMES[ai++ % AI_NAMES.length], team: s.team });
      ticket = core.createPvpTicket(list, crypto.randomInt(0, 2 ** 32), mode, { arena: opts.arena, archon: opts.archon });
    } catch (e) {
      S.log.error('[pvp start]', e.message);
      return humans.forEach(p => { p.state = 'idle'; err(p, 'The match could not be started. Please try again.'); });
    }
    // input delay covers the slowest round trip between two players through the server
    const rtts = humans.map(p => p.rtt).sort((a, b) => b - a);
    const delay = Math.min(core.PVP.MAX_DELAY, Math.max(core.PVP.MIN_DELAY, Math.ceil(((rtts[0] || 0) / 2 + (rtts[1] ?? rtts[0] ?? 0) / 2 + 80) / BLOCK_MS)));
    const id = S_.randomId('m_'), t = now(), n = humans.length;
    const M = { id, mode, ranked, code, note: note || null, ticket, catalog, delay, players: humans, n, teams: slotTeam, frames: new Map(), next: new Array(n).fill(delay), confirmed: delay - 1, log: [], inputs: 0,
      out: new Array(n).fill(false), why: new Array(n).fill(null), synth: new Array(n).fill(false), last: new Array(n).fill(t), at: t, finishing: false };
    matches.set(id, M);
    humans.forEach((p, slot) => { p.state = 'match'; p.match = M; p.slot = slot; p.group = null; p.room = null; });
    const firstAi = list.find(x => x.ai);
    db.run('INSERT INTO pvp_matches (id, ranked, mode, p1_id, p2_id, ball1, ball2, ticket, catalog, delay_blocks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, ranked ? 1 : 0, mode, humans[0].user.id, humans[1] ? humans[1].user.id : null, humans[0].spec.ball, humans[1] ? humans[1].spec.ball : (firstAi ? firstAi.ball : humans[0].spec.ball),
      JSON.stringify(ticket), JSON.stringify(catalog), delay, t);
    humans.forEach((p, slot) => db.run('INSERT INTO pvp_match_players (match_id, slot, user_id, ball, team) VALUES (?, ?, ?, ?, ?)', id, slot, p.user.id, p.spec.ball, slotTeam[slot]));
    const roster = list.map(x => ({ name: x.ai ? x.name : x.name, ball: x.ball, level: x.level, team: x.team, ai: !!x.ai }));
    humans.forEach((p, slot) => {
      const foe = humans.find((o, i) => slotTeam[i] !== slotTeam[slot]) || null, foeAi = !foe && list.find(x => x.team !== slotTeam[slot]);
      send(p, { t: 'start', id, mode, ticket, catalog, slot, team: slotTeam[slot], humans: n, delay, block: K, ranked, room: code || null, note: M.note, players: roster,
        you: { name: p.user.username, ...rankOf(p.user.id) },
        opp: foe ? { name: foe.user.username, ball: foe.spec.ball, level: foe.spec.level, ...rankOf(foe.user.id) } : { name: foeAi ? foeAi.name : 'AI', ball: foeAi ? foeAi.ball : null, ai: true } });
    });
  }

  function onFrame(p, m) {
    const M = p.match; if (!M || M.finishing || M.players[p.slot] !== p) return;
    const s = p.slot; if (M.out[s]) return;
    const b = m.b;
    if (!Number.isInteger(b) || b !== M.next[s] || b > MAX_BLOCKS || b - M.confirmed > 600) return dropSlot(M, s, 'protocol', { b, expected: M.next[s] });
    const acts = core.cleanPvpActions(m.a == null ? [] : m.a);
    if (!acts) return dropSlot(M, s, 'bad_input');
    if (acts.some(a => a[1] === 'x') && p.user.role !== 'owner') { S.secEvent(p.user.id, 'admin_command_forged', 3, { match: M.id }, null); return dropSlot(M, s, 'bad_input'); }   // owner console only
    M.last[s] = now();
    storeFrame(M, s, b, acts);
  }
  function storeFrame(M, s, b, acts) {
    let f = M.frames.get(b); if (!f) M.frames.set(b, f = new Array(M.n).fill(undefined));
    f[s] = acts; M.next[s] = b + 1; M.inputs += acts.length;
    for (let o = 0; o < M.n; o++) if (o !== s && !M.out[o]) send(M.players[o], { t: 'f', s, b, a: acts });
    for (let o = 0; o < M.n; o++) if (o !== s && M.out[o]) synthUpTo(M, o, b);      // departed players: their balls fight on AUTO
    while (true) {
      const nb = M.confirmed + 1, fr = M.frames.get(nb);
      if (!fr || fr.some(x => x === undefined)) break;
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
    if (M.out.every(Boolean)) return finishMatch(M, why);
    if (why !== 'ended') for (let o = 0; o < M.n; o++) if (!M.out[o]) send(M.players[o], { t: 'left', slot: s, name: p.user.username, why });
    synthUpTo(M, s, Math.max(...M.next.filter((_, i) => !M.out[i])) - 1);
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
    const r = v.result, nTeams = M.ticket.teams.length; M.gm = r.gm || null;      // 2.9.0 God Mastery counters from the verified re-simulation
    const winner = r.ok && Number.isInteger(r.winner) && r.winner >= 0 && r.winner < nTeams ? r.winner : -1;
    const places = r.ok && Array.isArray(r.places) && r.places.length === nTeams ? r.places : new Array(nTeams).fill(1);
    let changes;
    try { changes = db.tx(() => applyResult(M, winner, places, r)); }
    catch (e) { S.log.error('[pvp apply]', e); changes = M.players.map(() => ({})); }
    const summary = { mode: M.mode, winner, places, step: r.step, time: r.time, slots: r.slots, reason, left: M.why };
    db.run("UPDATE pvp_matches SET status = 'done', winner_slot = ?, result = ?, changes = ?, inputs = ?, flags = ?, finished_at = ? WHERE id = ?",
      winner, JSON.stringify(summary), JSON.stringify(changes), JSON.stringify(M.log), M.why.filter(w => w && w !== 'ended').join(',') || null, now(), M.id);
    M.players.forEach((p, slot) => {
      const team = M.teams[slot];
      send(p, { t: 'result', id: M.id, mode: M.mode, slot, team, winner, place: places[team], teams: nTeams, win: winner === team, draw: winner === -1, ranked: M.ranked,
        time: r.time, step: r.step, slots: r.slots, opp: label(M, slot), ...changes[slot], save: S.savePayload(p.user) });
      release(p, M);
    });
    matches.delete(M.id);
  }
  function release(p, M) { if (p.match === M) { p.match = null; p.slot = -1; p.state = 'idle'; } }
  /** "vs Bob", "with Ann vs Bob & AI Nova", "5-player arena" … for the result screen */
  function label(M, slot) {
    const names = M.ticket.teams.map(t => t.map(s => s.tag || 'AI')), mine = M.teams[slot], me = M.players[slot].user.username;
    if (M.mode === 'ffa') return '5-player arena';
    const mates = names[mine].filter(n => n !== me), foes = names.filter((_, t) => t !== mine).flat();
    return (mates.length ? 'with ' + mates.join(' & ') + ' ' : '') + 'vs ' + foes.join(' & ');
  }

  /** season points and rewards — ranked matches only, with daily anti-farming limits */
  function applyResult(M, winner, places, r = {}) {
    const n = M.n, ids = M.players.map(p => p.user.id), teams = M.teams, pts = ids.map(ptsOf), since = dayStart();
    const res = teams.map(t => winner === -1 ? 'draw' : winner === t ? 'win' : 'loss');
    const delta = new Array(n).fill(0); let rewarded = new Array(n).fill(false), notes = new Array(n).fill(''), counted = M.ranked;
    if (M.ranked) {
      if (M.mode === 'duel') {
        const pair = db.get(`SELECT COUNT(*) AS n FROM pvp_matches WHERE ranked = 1 AND mode = 'duel' AND status = 'done' AND finished_at >= ? AND ((p1_id = ? AND p2_id = ?) OR (p1_id = ? AND p2_id = ?))`, since, ids[0], ids[1], ids[1], ids[0]).n;
        if (pair >= LIMITS.samePairPerDay) { counted = false; notes = notes.map(() => 'You already played this opponent several times today: no rank points or rewards.'); }
      }
      if (counted) {
        // 2.4.1 owner rule (same for every battle): victory +4, draw +3, defeat +2. FFA: 1st place +4, everyone else +2.
        for (let i = 0; i < n; i++) delta[i] = M.mode === 'ffa' ? (places[teams[i]] === 1 ? core.RANK_POINTS.win : core.RANK_POINTS.loss) : (core.RANK_POINTS[res[i]] ?? core.RANK_POINTS.loss);
        rewarded = ids.map((uid, s) => {
          const c = db.get(`SELECT COUNT(*) AS n FROM pvp_match_players mp JOIN pvp_matches m ON m.id = mp.match_id WHERE mp.user_id = ? AND m.ranked = 1 AND m.status = 'done' AND m.finished_at >= ?`, uid, since).n;
          if (c >= LIMITS.rewardedPerDay) { notes[s] = 'Daily online reward limit reached: rank points only.'; return false; }
          return true;
        });
      }
    } else notes = notes.map(() => M.note || 'Friendly match: no rank points or rewards.');
    return M.players.map((p, s) => {
      const uid = ids[s], place = places[teams[s]], result = res[s], ball = p.spec.ball;
      const base = !rewarded[s] ? { coins: 0, exp: 0 } : M.mode === 'ffa' ? (PLACE_REWARDS[place - 1] || PLACE_REWARDS[4]) : REWARDS[result];
      const bonus = S.premiumOf(uid).active ? 1.25 : 1, coins = Math.round(base.coins * bonus), exp = Math.round(base.exp * bonus);
      let ups = 0, level = null, season = null;
      if (M.ranked) {
        S.updateProfile(uid, pr => {
          const st = pr.stats; st.pvpBattles = (st.pvpBattles || 0) + 1;
          const k = { win: 'pvpWins', loss: 'pvpLosses', draw: 'pvpDraws' }[M.mode === 'ffa' && result === 'loss' && place === 1 ? 'win' : result]; st[k] = (st[k] || 0) + 1;
          return { stats: st, coins: pr.coins + coins };
        });
        if (counted) season = S.seasonApply(uid, delta[s], result);
        if (exp) { ({ ups, level } = S.giveBallExp(uid, ball, exp)); S.giveAccountExp(uid, exp); }
      }
      if (M.ranked && counted && rewarded[s] && S.skills26 && r.skUse) S.withCatalog({ id: uid, role: p.user.role }, () => S.skills26.grant(uid, ball, r.skUse[s], result === 'win'));      // 2.6.0: skill mastery (ranked, verified, within the daily limits)
      const reality = S.reality ? S.withCatalog({ id: uid, role: p.user.role }, () => S.reality.afterMatch(uid, M.id, M, s, ball, result === 'win', !!(M.ranked && counted && rewarded[s]))) : null;   // 2.9.0
      return { reality, result, place, ball, coins: coins + ((reality && reality.archon && reality.archon.coins) || 0), exp, ups, level, rpBefore: pts[s], rpAfter: season ? season.after : pts[s], rpDelta: season ? season.after - season.before : 0, tier: season ? season.tier : null, note: notes[s] };
    });
  }

  /* ================= housekeeping: queues, pings, stalled players, expired rooms ================= */
  let tick = 0;
  const timer = setInterval(() => {
    const t = now(); tick++;
    for (const mode of ['team', 'ffa']) { matchmake(mode, true); if (tick % 2 === 0) queueStatus(mode); }
    for (const M of matches.values()) {
      if (M.finishing) continue;
      if (t - M.at > LIMITS.maxMatchMs) { finishMatch(M, 'time_limit'); continue; }
      for (let s = 0; s < M.n; s++) if (!M.out[s] && t - M.last[s] > LIMITS.dropAfterMs) dropSlot(M, s, 'timeout');
    }
    for (const r of [...rooms.values()]) if (t - r.at > LIMITS.roomTtlMs || r.host.ws.closed) {
      closeRoom(r);
      for (const x of r.members) if (!x.match) { x.state = 'idle'; err(x, 'The room expired.'); send(x, { t: 'idle', ...lobbyInfo() }); }
    }
    for (const p of [...conns.values()]) {
      if (t - p.ws.lastSeen > LIMITS.idleCloseMs) { p.ws.close(4001); onClose(p); continue; }
      if (!p.pingAt || t - p.pingAt > 5000) { p.pingN++; p.pingAt = t; send(p, { t: 'ping', n: p.pingN, ...lobbyInfo() }); }
    }
  }, 1000);
  timer.unref?.();
  let closing = false;   // server shutting down: stop starting work that would touch the database
  (S.closers = S.closers || []).push(() => { closing = true; clearInterval(timer); for (const p of conns.values()) p.ws.close(1001); });
  S.pvp.tickNow = () => { for (const mode of ['team', 'ffa']) matchmake(mode, true); };   // tests

  /* ================= HTTP: lobby info and match history ================= */
  app.get('/api/pvp/status', ctx => { S.requireUser(ctx); return lobbyInfo(); });
  app.get('/api/pvp/history', ctx => {
    const u = S.requireUser(ctx);
    const rows = db.all(`SELECT m.id, m.mode, m.ranked, m.winner_slot, m.changes, m.result, m.finished_at, mp.slot, mp.team, mp.ball
      FROM pvp_match_players mp JOIN pvp_matches m ON m.id = mp.match_id WHERE mp.user_id = ? AND m.status = 'done' ORDER BY m.finished_at DESC LIMIT 15`, u.id);
    const others = rows.length ? db.all(`SELECT mp.match_id, mp.team, us.username FROM pvp_match_players mp LEFT JOIN users us ON us.id = mp.user_id WHERE mp.match_id IN (${rows.map(() => '?').join(',')})`, ...rows.map(r => r.id)) : [];
    return {
      matches: rows.map(r => {
        const ch = (json(r.changes, []) || [])[r.slot] || {}, mode = r.mode || 'duel';
        const result = ch.result || (r.winner_slot === -1 ? 'draw' : r.winner_slot === r.team ? 'win' : 'loss');
        const foes = others.filter(o => o.match_id === r.id && o.team !== r.team).map(o => o.username || '?');
        return { id: r.id, mode, ranked: !!r.ranked, at: r.finished_at, ball: r.ball, result, place: ch.place || null, rpDelta: ch.rpDelta || 0, coins: ch.coins || 0,
          opp: mode === 'duel' ? (foes[0] || '?') : (MODES[mode] ? MODES[mode].name : mode) + (foes.length ? ' vs ' + foes.join(', ') : '') };
      }),
    };
  });
}

module.exports = { register, LIMITS };
