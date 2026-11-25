'use strict';
/**
 * Server-authoritative game API (cloud save + anti-cheat).
 *
 * The client never decides coins, EXP, unlocks, HP, premium status or results:
 *  - battles start from a server ticket (server picks opponents and the random seed);
 *  - the client returns only its recorded inputs; the server re-simulates the battle
 *    deterministically in a worker thread and grants rewards from ITS result;
 *  - every purchase / upgrade / claim is validated and applied in a database transaction.
 */
const S_ = require('./security');
const { HttpError, bad } = require('./http');
const { json } = require('./db');
const { Verifier } = require('./verifier');

const now = () => Date.now();
const utcDay = (t = now()) => new Date(t).toISOString().slice(0, 10);
const ACCOUNT_EXP = lv => 150 + lv * 60;

function register(app, S) {
  const { db, cfg, core } = S;
  S.verifier = new Verifier(cfg.verifyWorkers);
  const STEP = core.STEP, MAX_STEPS = cfg.maxBattleMinutes * 60 * 240;
  const isOwner = u => u.role === 'owner';

  /* ================= catalog & access ================= */
  function catalogFor(userId, owner) {
    const customBalls = db.all('SELECT def, published FROM custom_balls ORDER BY created_at').map(r => ({ ...json(r.def, {}), draft: !r.published })).filter(c => owner || !c.draft);
    const overrides = Object.fromEntries(db.all('SELECT ball_id, def FROM ball_overrides').map(r => [r.ball_id, json(r.def, {})]));
    const disabled = Object.fromEntries(db.all('SELECT ball_id FROM ball_flags WHERE disabled = 1').map(r => [r.ball_id, true]));
    const fusions = userId ? db.all('SELECT def FROM fusions WHERE user_id = ? ORDER BY created_at', userId).map(r => json(r.def, {})) : [];
    const tuning = Object.fromEntries(db.all('SELECT ball_id, settings FROM admin_ball_tuning').map(r => [r.ball_id, json(r.settings, {})]));   // Supreme ball settings (owner)
    return { overrides, customBalls, disabled, fusions, tuning };
  }
  /** runs fn with the shared core pointed at this user's catalog (synchronous only) */
  function withCatalog(user, fn) { core.setCatalog(catalogFor(user ? user.id : null, user ? isOwner(user) : false)); return fn(); }
  S.catalogFor = catalogFor; S.withCatalog = withCatalog;

  const ballRow = (uid, id) => db.get('SELECT * FROM user_balls WHERE user_id = ? AND ball_id = ?', uid, id);
  function ensureRow(uid, id) {
    let r = ballRow(uid, id);
    if (!r) { db.run('INSERT INTO user_balls (user_id, ball_id, owned) VALUES (?, ?, 0)', uid, id); r = ballRow(uid, id); }
    return r;
  }
  /* Premium balls cannot be bought or upgraded with coins, so for an ACTIVE Premium member (and the owner) they always
     fight at full power: Lv 50, fully evolved, every upgrade and skill-tree node. Nothing is written to the saved
     progress, so the boost ends with the subscription and the player's own progress is kept as it was. */
  const MAXED = () => ({ level: core.MAX_LVL, exp: 0, evo: core.EVO.length - 1, up: { ...core.UPGRADE_CAPS }, tree: Object.fromEntries(core.TREE.map(n => [n.id, 1])), sp: 0 });
  function premiumMaxed(uid, id) {
    const def = core.getBall(id);
    if (!def || !def.premium || def.fusion || def.adminOnly) return false;
    const u = db.get('SELECT role FROM users WHERE id = ?', uid);
    return !!(u && u.role === 'owner') || S.premiumOf(uid).active;
  }
  S.premiumMaxed = premiumMaxed;
  function progOf(uid, id) {
    const p = progRow(uid, id);
    return premiumMaxed(uid, id) ? { ...p, ...MAXED(), maxed: true } : p;
  }
  function progRow(uid, id) {
    const r = ballRow(uid, id);
    return r ? { owned: !!r.owned, level: r.level, exp: r.exp, evo: r.evo, up: json(r.up, {}), tree: json(r.tree, {}), sp: r.sp, wins: r.wins, losses: r.losses } : { owned: false, level: 1, exp: 0, evo: 0, up: {}, tree: {}, sp: 1, wins: 0, losses: 0 };
  }
  /** how (if at all) this user may use a ball: owned | free | premium | owner | trial | null.
   *  Premium balls need an ACTIVE subscription: when it lapses they lock again (progress rows are kept). */
  function access(user, def, { trial = false } = {}) {
    if (!def || def.summonOnly) return null;            // summon-only helpers exist only inside Portal Master Ball's portals
    const owner = isOwner(user);
    if (def.draft && !owner) return null;
    if (def.enabled === false && !owner && !ballRow(user.id, def.id)?.owned) return null;   // disabled: no NEW access, owners keep it
    if (def.adminOnly) return owner ? 'owner' : null;
    if (owner) return 'owner';
    if (ballRow(user.id, def.id)?.owned) return 'owned';
    if (def.free) return 'free';                         // free for every player (Anti Ball)
    if (!def.fusion && S.premiumOf(user.id).active) return 'premium';
    if (trial && !def.fusion) return 'trial';
    return null;
  }
  S.access = access;

  /* ================= profile / cloud save ================= */
  const profileRow = uid => db.get('SELECT * FROM profiles WHERE user_id = ?', uid);
  function updateProfile(uid, fn) {
    const p = profileRow(uid);
    const st = json(p.stats, {}), lo = json(p.loadout, {});
    const next = fn({ ...p, stats: st, loadout: lo }) || {};
    db.run('UPDATE profiles SET coins = ?, exp = ?, level = ?, rp = ?, stats = ?, loadout = ?, daily_streak = ?, daily_last = ?, updated_at = ? WHERE user_id = ?',
      Math.max(0, Math.round(next.coins ?? p.coins)), next.exp ?? p.exp, next.level ?? p.level, Math.max(0, Math.round(next.rp ?? p.rp)), JSON.stringify(next.stats ?? st), JSON.stringify(next.loadout ?? lo),
      next.daily_streak ?? p.daily_streak, next.daily_last ?? p.daily_last, now(), uid);
  }
  function spendCoins(uid, amount) {
    const r = db.run('UPDATE profiles SET coins = coins - ?, updated_at = ? WHERE user_id = ? AND coins >= ?', amount, now(), uid, amount);
    if (Number(r.changes) !== 1) throw new HttpError(402, 'Not enough coins', 'NO_COINS');
  }
  const addCoins = (uid, n) => db.run('UPDATE profiles SET coins = coins + ?, updated_at = ? WHERE user_id = ?', Math.max(0, Math.round(n)), now(), uid);
  function giveBallExp(uid, ballId, amount) {
    const r = ensureRow(uid, ballId); let { level, exp, sp } = r, ups = 0;
    if (level < core.MAX_LVL) {
      exp += Math.round(amount);
      while (level < core.MAX_LVL && exp >= core.expNeed(level)) { exp -= core.expNeed(level); level++; sp++; ups++; }
      if (level >= core.MAX_LVL) exp = 0;
      db.run('UPDATE user_balls SET level = ?, exp = ?, sp = ? WHERE user_id = ? AND ball_id = ?', level, exp, sp, uid, ballId);
    }
    return { ups, level };
  }
  function giveAccountExp(uid, amount) {
    updateProfile(uid, p => { let { exp, level } = p; exp += Math.round(amount); while (exp >= ACCOUNT_EXP(level)) { exp -= ACCOUNT_EXP(level); level++; } return { exp, level }; });
  }
  function unlockBall(uid, ballId, source, eventName) {
    const r = ensureRow(uid, ballId);
    if (r.owned) return false;
    db.run('UPDATE user_balls SET owned = 1, source = ?, unlocked_at = ?, sp = MAX(sp, 1) WHERE user_id = ? AND ball_id = ?', source, now(), uid, ballId);
    const def = core.getBall(ballId);
    if (def && def.limited) db.run('INSERT OR IGNORE INTO limited_records (user_id, ball_id, event_name, obtained_at) VALUES (?, ?, ?, ?)', uid, ballId, eventName || source, now());
    return true;
  }
  S.unlockBall = unlockBall; S.addCoins = addCoins; S.updateProfile = updateProfile;
  S.profileRow = profileRow; S.progOf = progOf; S.giveBallExp = giveBallExp; S.giveAccountExp = giveAccountExp; S.ensureBallRow = ensureRow;

  function dailyState(p) {
    const last = p.daily_last, t = utcDay(), y = utcDay(now() - 86400e3);
    const canClaim = last !== t;
    const streak = last === y || last === t ? p.daily_streak : 0;
    const nextIdx = canClaim ? (last === y ? p.daily_streak % 7 : 0) : (p.daily_streak - 1) % 7;
    return { canClaim, streak, nextDay: nextIdx + 1, rewards: core.DAILY_REWARDS };
  }
  function savePayload(user) {
    const uid = user.id, p = profileRow(uid);
    const balls = {};
    for (const r of db.all('SELECT * FROM user_balls WHERE user_id = ?', uid)) balls[r.ball_id] = { owned: !!r.owned, level: r.level, exp: r.exp, evo: r.evo, up: json(r.up, {}), tree: json(r.tree, {}), sp: r.sp, wins: r.wins, losses: r.losses };
    for (const d of withCatalog(user, () => core.allBalls().filter(b => b.premium && !b.fusion && !b.adminOnly))) if (premiumMaxed(uid, d.id)) balls[d.id] = { owned: false, wins: 0, losses: 0, ...(balls[d.id] || {}), ...MAXED(), maxed: true };
    const achievements = {}; for (const a of db.all('SELECT * FROM achievements WHERE user_id = ?', uid)) achievements[a.ach_id] = { done: true, claimed: !!a.claimed_at };
    const limited = {}; for (const l of db.all('SELECT * FROM limited_records WHERE user_id = ?', uid)) limited[l.ball_id] = { at: l.obtained_at, event: l.event_name };
    const eventProgress = {}; for (const e of db.all('SELECT * FROM event_progress WHERE user_id = ?', uid)) eventProgress[e.event_id] = { wins: e.wins, claimed: !!e.claimed };
    return {
      coins: p.coins, exp: p.exp, level: p.level, accountExpNeed: ACCOUNT_EXP(p.level), rp: p.rp, stats: json(p.stats, {}), balls, achievements, limited, eventProgress,
      collectionClaimed: db.all('SELECT milestone FROM collection_claims WHERE user_id = ?', uid).map(r => r.milestone),
      cosmetics: db.all('SELECT cosmetic_id FROM cosmetics_owned WHERE user_id = ?', uid).map(r => r.cosmetic_id),
      loadout: json(p.loadout, {}), settings: json(p.settings, {}), avatar: p.avatar_ball, favorite: p.favorite_ball,
      daily: dailyState(p), premium: S.premiumOf(uid), catalog: catalogFor(uid, isOwner(user)),
      season: S.seasonBrief ? S.seasonBrief(uid) : null, monthlyCoins: S.monthlyCoins ? S.monthlyCoins(uid) : null,
      tournament: (t => t ? { id: t.id, ...json(t.state, {}) } : null)(db.get("SELECT * FROM tournaments WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1", uid)),
    };
  }
  S.savePayload = savePayload;

  /* ================= achievements (server-evaluated) ================= */
  function evaluateAchievements(uid) {
    const p = profileRow(uid), s = json(p.stats, {});
    const owned = withCatalog(null, () => db.all('SELECT ball_id FROM user_balls WHERE user_id = ? AND owned = 1', uid).map(r => r.ball_id).filter(id => { const b = core.getBall(id); return b && !b.adminOnly; }));
    const ownedSet = new Set(owned);
    const tests = {
      win1: s.wins >= 1, win10: s.wins >= 10, win50: s.wins >= 50, win200: s.wins >= 200, crit: (s.crits || 0) >= 25, rage: (s.rages || 0) >= 1, god: (s.gods || 0) >= 1,
      coll10: owned.length >= 10, coll25: owned.length >= 25, coll48: core.BUILTIN_BALLS.filter(b => !b.adminOnly).every(b => ownedSet.has(b.id)), evo: (s.evolutions || 0) >= 1,
      tourney: (s.tourneyWins || 0) >= 1, boss: (s.bossWins || 0) >= 1, surv10: (s.survivalBest || 0) >= 10, endless20: (s.endlessBest || 0) >= 20, insane: (s.insaneWins || 0) >= 1,
      b100: (s.battles || 0) >= 100, perfect: (s.perfect || 0) >= 1, creator: (s.created || 0) >= 1, rich: p.coins >= 10000,
      limited: db.get('SELECT COUNT(*) n FROM limited_records WHERE user_id = ?', uid).n >= 1,
    };
    const fresh = [];
    for (const a of core.ACHIEVEMENTS) if (tests[a.id] && !db.get('SELECT 1 FROM achievements WHERE user_id = ? AND ach_id = ?', uid, a.id)) { db.run('INSERT INTO achievements (user_id, ach_id, done_at) VALUES (?, ?, ?)', uid, a.id, now()); fresh.push(a.name); }
    return fresh;
  }
  S.evaluateAchievements = evaluateAchievements;

  /* ================= events ================= */
  function allEvents() {
    const t = now();
    const built = core.builtinEvents().map(e => ({ ...e, premiumOnly: false }));
    const custom = db.all('SELECT * FROM limited_events WHERE end_at > ?', t - 86400e3).map(e => ({ id: e.id, name: e.name, desc: e.description, ball: e.ball_id, start: e.start_at, end: e.end_at, goal: e.goal, price: e.price, premiumOnly: !!e.premium_only }));
    return [...built, ...custom];
  }
  const activeEvents = () => { const t = now(); return allEvents().filter(e => e.start <= t && t < e.end); };
  S.allEvents = allEvents;

  /* ================= battles ================= */
  function validateInputs(inputs) {
    if (!Array.isArray(inputs) || inputs.length > 20000) return 'Too many inputs';
    let last = 0;
    for (const a of inputs) {
      if (!Array.isArray(a) || a.length < 2 || a.length > 6) return 'Malformed input';
      const [step, type] = a;
      if (!Number.isInteger(step) || step < 1 || step > MAX_STEPS || step < last) return 'Malformed input step';
      last = step;
      if (type === 'k') { if (!Number.isInteger(a[2]) || a[2] < 0 || a[2] > 6 || a.length !== 3) return 'Malformed ability input'; }   // up to 6 abilities + a copied one
      else if (type === 'u') { if (a.length !== 3 || a[2] !== 0) return 'Malformed ultimate input'; }
      else if (type === 'm') { if (a.length !== 3 || (a[2] !== 0 && a[2] !== 1)) return 'Malformed control input'; }
      else if (type === 'x') { if (a.length !== 6 || !Object.values(core.ADMIN_CMDS).includes(a[2]) || !a.slice(3).every(v => Number.isInteger(v) && v >= -1000 && v <= 1000)) return 'Malformed admin command'; }   // ADMIN DELETE console
      else if (type === 's') { if (a.length !== 5 || ![a[2], a[3]].every(v => Number.isInteger(v) && v >= -100 && v <= 100) || (a[4] !== 0 && a[4] !== 900)) return 'Malformed steering input'; }
      else return 'Unknown input type';
    }
    return null;
  }
  function forfeitOpen(user) {
    for (const b of db.all("SELECT id, mode, trial FROM battles WHERE user_id = ? AND status = 'open'", user.id)) {
      db.run("UPDATE battles SET status = 'abandoned', finished_at = ? WHERE id = ?", now(), b.id);
      if (!b.trial && b.mode !== 'practice') updateProfile(user.id, p => { p.stats.battles = (p.stats.battles || 0) + 1; p.stats.losses = (p.stats.losses || 0) + 1; p.stats.abandoned = (p.stats.abandoned || 0) + 1; return { stats: p.stats, rp: p.rp - 4 }; });
    }
  }
  function newTicket(user, setup, extra = {}, trial = false) {
    const def = core.getBall(setup.ball);
    const pr = trial ? { level: 10, evo: 1, up: {}, tree: { slot3: 1, slot4: 1 } } : progOf(user.id, def.id);
    pr.cos = json(profileRow(user.id).loadout, {});
    const ticket = core.createTicket(setup, pr, S_.secureRandom, extra);
    const id = S_.randomId('b_'); ticket.id = id;
    db.tx(() => {
      forfeitOpen(user);
      db.run('INSERT INTO battles (id, user_id, mode, difficulty, ticket, catalog, trial, tournament_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, user.id, ticket.mode, ticket.difficulty, JSON.stringify(ticket), JSON.stringify(catalogFor(user.id, isOwner(user))), trial ? 1 : 0, extra.tournamentId || null, now());
    });
    return ticket;
  }

  app.post('/api/battle/start', ctx => {
    const u = S.requirePlayable(ctx);
    S.limit(ctx, 'bstart:' + u.id, 40, 60e3);
    const b = ctx.body, mode = String(b.mode || '');
    if (!core.MODES[mode] || mode === 'tournament' || core.MODES[mode].online) throw bad('Unknown battle mode');
    return withCatalog(u, () => {
      const def = core.getBall(String(b.ball || ''));
      const trial = mode === 'practice' && !!b.trial;
      if (!access(u, def, { trial })) throw new HttpError(403, 'You do not have access to this ball', 'NO_ACCESS');
      const pool = new Set(core.opponentPool(isOwner(u)).map(x => x.id));
      for (const k of ['enemy', 'ally']) if (b[k] && b[k] !== 'random' && !pool.has(b[k])) throw bad('That opponent is not available');
      if (mode === 'boss' && b.boss && (!pool.has(b.boss))) throw bad('That boss is not available');
      const setup = { mode, ball: def.id, enemy: b.enemy || 'random', ally: b.ally || 'random', difficulty: core.normDiff(b.difficulty), ffaCount: S_.clampInt(b.ffaCount, 3, 6, 4), boss: b.boss || 'ancientgod', infinite: !!b.infinite, dummy: !!b.dummy, manual: !!b.manual };
      if (b.godTest) {       // free God Ball practice test (any form, test bar): every player, God Balls only, Practice only (no rewards)
        if (!def.godBall || mode !== 'practice') throw bad('Practice tests are only for the God Balls');
        setup.godTest = true; setup.startForm = S_.clampInt(b.startForm, 0, 2, 0);
      }
      if (b.adminTest) {     // Admin Ball Control Panel "Spawn & test": owner only, Supreme balls only, Practice only (no rewards)
        if (!isOwner(u) || !def.supreme || mode !== 'practice') throw new HttpError(403, 'Owner test battles are only for the game owner', 'NO_ACCESS');
        setup.adminTest = true; setup.startForm = S_.clampInt(b.startForm, 0, 2, 0);
        S.audit(u.id, 'admin.supreme_test', def.id, ctx.ip, { startForm: setup.startForm, enemy: setup.dummy ? 'dummy' : setup.enemy });
      }
      return { ticket: newTicket(u, setup, {}, trial) };
    });
  });

  app.post('/api/battle/finish', { bodyLimit: 1024 * 1024 }, async ctx => {
    const u = S.requirePlayable(ctx);
    S.limit(ctx, 'bfin:' + u.id, 40, 60e3);
    const { id, inputs, claimed } = ctx.body;
    if (!S_.isId(id)) throw bad('Bad battle id');
    const row = db.get('SELECT * FROM battles WHERE id = ? AND user_id = ?', id, u.id);
    if (!row) throw new HttpError(404, 'Battle not found');
    if (row.status !== 'open') throw new HttpError(409, 'This battle was already submitted', 'ALREADY_DONE');
    const err = validateInputs(inputs);
    if (err) { S.secEvent(u.id, 'bad_battle_inputs', 2, { id, err }, ctx.ip); db.run("UPDATE battles SET status = 'rejected', flags = ?, finished_at = ? WHERE id = ?", 'bad_inputs', now(), id); throw bad('Battle data was malformed and was not counted'); }
    const ticket = json(row.ticket);
    const cStep = S_.clampInt(claimed && claimed.step, 0, MAX_STEPS, 0);
    const adminCmds = inputs.filter(a => a[1] === 'x');
    const godTestOnly = adminCmds.length && row.mode === 'practice' && ticket.opts && ticket.opts.godTest && adminCmds.every(a => a[2] >= core.ADMIN_CMDS.testForm);   // free God Ball practice test bar
    if (adminCmds.length && !godTestOnly) {          // owner console commands: only the owner's own Supreme battles may contain them
      const ball = ticket.teams && ticket.teams[0] && ticket.teams[0][0] ? ticket.teams[0][0].ball : '';
      if (!isOwner(u) || !withCatalog(u, () => { const d = core.getBall(ball); return d && d.supreme; })) {
        S.secEvent(u.id, 'admin_command_forged', 3, { id, n: adminCmds.length }, ctx.ip);
        db.run("UPDATE battles SET status = 'rejected', flags = 'forged_admin', finished_at = ? WHERE id = ?", now(), id);
        throw new HttpError(403, 'Admin commands are only accepted from the game owner', 'NO_ACCESS');
      }
      S.audit(u.id, 'admin.delete_console', id, ctx.ip, { mode: row.mode, ball, commands: adminCmds.map(a => ({ step: a[0], cmd: Object.keys(core.ADMIN_CMDS).find(k => core.ADMIN_CMDS[k] === a[2]), target: a[3], v: [a[4], a[5]] })).slice(0, 40) });
    }
    if (row.trial || row.mode === 'practice') {
      db.run("UPDATE battles SET status = 'verified', finished_at = ?, result = ? WHERE id = ?", now(), JSON.stringify({ practice: true }), id);
      return { verified: true, practice: true, result: { win: !!(claimed && claimed.win), mode: row.mode }, rewards: { coins: 0, exp: 0, rp: 0 }, save: savePayload(u) };
    }
    // speed-hack / fabricated-result guard: the game runs at most 3x real time
    const elapsed = now() - row.created_at, minMs = (cStep * STEP / 3) * 1000 * 0.85 - 2500;
    if (elapsed < minMs) {
      db.run("UPDATE battles SET status = 'rejected', flags = 'too_fast', finished_at = ? WHERE id = ?", now(), id);
      S.secEvent(u.id, 'battle_too_fast', 2, { id, elapsed, claimedStep: cStep }, ctx.ip);
      throw new HttpError(422, 'Battle result rejected: it finished faster than the game allows', 'REJECTED');
    }
    let v;
    try { v = await S.verifier.verify(ticket, inputs, json(row.catalog), MAX_STEPS); }
    catch (e) { db.run("UPDATE battles SET status = 'rejected', flags = 'verify_error', finished_at = ? WHERE id = ?", now(), id); S.log.error('[verify]', e.message); throw new HttpError(503, 'The battle could not be verified right now, so it was not counted.', 'VERIFY_FAILED'); }
    const r = v.result;
    if (!r.ok) { db.run("UPDATE battles SET status = 'rejected', flags = 'no_result', finished_at = ? WHERE id = ?", now(), id); throw new HttpError(422, 'The battle did not finish within the time limit', 'REJECTED'); }
    const mismatch = !!claimed && (!!claimed.win !== r.win || cStep !== r.step);
    if (mismatch) S.secEvent(u.id, 'battle_mismatch', 2, { id, claimed: { win: !!claimed.win, step: cStep }, server: { win: r.win, step: r.step } }, ctx.ip);
    return db.tx(() => {
      if (db.get('SELECT status FROM battles WHERE id = ?', id).status !== 'open') throw new HttpError(409, 'This battle was already submitted', 'ALREADY_DONE');
      return withCatalog(u, () => applyBattle(u, row, ticket, r, mismatch, v.ms));
    });
  });

  function applyBattle(u, row, T, r, mismatch, ms) {
    const uid = u.id, premium = S.premiumOf(uid).active, D = core.DIFF[T.difficulty];
    const rw = core.computeRewards(T, r, { premium });
    const ballId = T.teams[0][0].ball;
    let tourMsg = '', tour = null;
    updateProfile(uid, p => {
      const s = p.stats;
      s.battles = (s.battles || 0) + 1;
      if (r.win) s.wins = (s.wins || 0) + 1; else s.losses = (s.losses || 0) + 1;
      s.kills = (s.kills || 0) + (r.stats.kills || 0); s.crits = (s.crits || 0) + (r.stats.crits || 0); s.skills = (s.skills || 0) + (r.stats.skills || 0);
      s.dmg = Math.round((s.dmg || 0) + (r.stats.dmg || 0)); if (r.rage) s.rages = (s.rages || 0) + 1; if (r.god) s.gods = (s.gods || 0) + 1;
      if (r.win && T.difficulty === 'godlike') s.insaneWins = (s.insaneWins || 0) + 1;
      if (r.win && T.mode === '1v1' && r.hpPct >= 0.9) s.perfect = (s.perfect || 0) + 1;
      if (r.win && T.mode === 'boss') s.bossWins = (s.bossWins || 0) + 1;
      if (T.mode === 'survival') s.survivalBest = Math.max(s.survivalBest || 0, r.wave || 1);
      if (T.mode === 'endless') s.endlessBest = Math.max(s.endlessBest || 0, r.kills || 0);
      return { stats: s, coins: p.coins + rw.coins, rp: p.rp + rw.rp };
    });
    if (row.tournament_id) {
      const t = db.get("SELECT * FROM tournaments WHERE id = ? AND user_id = ? AND status = 'active'", row.tournament_id, uid);
      if (t) {
        const st = json(t.state);
        core.advanceTournament(st, r.win, progOf(uid, ballId).level, S_.secureRandom);
        const status = st.done ? (st.champion && st.champion.me ? 'won' : 'lost') : (st.alive ? 'active' : 'lost');
        db.run('UPDATE tournaments SET state = ?, status = ?, updated_at = ? WHERE id = ?', JSON.stringify(st), status, now(), t.id);
        if (status === 'won') {
          const bonus = Math.round(600 * D.reward * (premium ? 1.25 : 1)); rw.coins += bonus; rw.exp += 200; addCoins(uid, bonus);
          updateProfile(uid, p => { p.stats.tourneyWins = (p.stats.tourneyWins || 0) + 1; return { stats: p.stats, rp: p.rp + D.rp * 3 }; });
          tourMsg = `🏆 TOURNAMENT CHAMPION! +${bonus} bonus coins`;
        } else if (!r.win) tourMsg = 'Eliminated in the ' + (['quarter-finals', 'semi-finals', 'final'][st.round - 1] || 'tournament');
        tour = { id: t.id, ...st };
      }
    }
    const br = ensureRow(uid, ballId);
    db.run(`UPDATE user_balls SET ${r.win ? 'wins = wins + 1' : 'losses = losses + 1'} WHERE user_id = ? AND ball_id = ?`, uid, br.ball_id);
    const { ups, level } = giveBallExp(uid, ballId, rw.exp);
    giveAccountExp(uid, rw.exp);
    if (r.win) for (const ev of activeEvents()) if (!ev.premiumOnly || premium) db.run('INSERT INTO event_progress (user_id, event_id, wins) VALUES (?, ?, 1) ON CONFLICT(user_id, event_id) DO UPDATE SET wins = wins + 1', uid, ev.id);
    const fresh = evaluateAchievements(uid);
    const result = { win: r.win, mode: T.mode, time: r.time, kills: r.kills, wave: r.wave, hpPct: r.hpPct, stats: r.stats, step: r.step };
    db.run("UPDATE battles SET status = 'verified', finished_at = ?, result = ?, rewards = ?, flags = ? WHERE id = ?", now(), JSON.stringify(result), JSON.stringify(rw), mismatch ? 'mismatch' : null, row.id);
    const extraMsg = T.mode === 'survival' ? `Reached wave ${r.wave}` : T.mode === 'endless' ? `${r.kills} KOs` : '';
    return { verified: true, mismatch, verifyMs: ms, result, rewards: rw, coins: rw.coins, exp: rw.exp, ups, level, ballId, tourMsg, extraMsg, tour, newAchievements: fresh, save: savePayload(u) };
  }

  /* ================= tournaments (AI) ================= */
  app.post('/api/tournament/start', ctx => {
    const u = S.requirePlayable(ctx); S.limit(ctx, 'tour:' + u.id, 10, 60e3);
    return withCatalog(u, () => {
      const def = core.getBall(String(ctx.body.ball || ''));
      if (!access(u, def)) throw new HttpError(403, 'You do not have access to this ball', 'NO_ACCESS');
      const st = core.createTournament(def.id, S_.secureRandom), id = S_.randomId('t_');
      db.run("UPDATE tournaments SET status = 'abandoned', updated_at = ? WHERE user_id = ? AND status = 'active'", now(), u.id);
      db.run('INSERT INTO tournaments (id, user_id, ball_id, difficulty, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, u.id, def.id, core.normDiff(ctx.body.difficulty), JSON.stringify(st), now(), now());
      return { tour: { id, ...st } };
    });
  });
  app.post('/api/tournament/ticket', ctx => {
    const u = S.requirePlayable(ctx); S.limit(ctx, 'bstart:' + u.id, 40, 60e3);
    const t = db.get("SELECT * FROM tournaments WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1", u.id);
    if (!t) throw bad('No active tournament');
    const st = json(t.state);
    return withCatalog(u, () => {
      if (!access(u, core.getBall(t.ball_id))) throw new HttpError(403, 'You no longer have access to this ball', 'NO_ACCESS');
      const setup = { mode: 'tournament', ball: t.ball_id, difficulty: t.difficulty, manual: !!ctx.body.manual };
      return { ticket: newTicket(u, setup, { opponent: core.tournamentOpponent(st), round: st.round, roundName: core.TOUR_NAMES[st.round], tournamentId: t.id }) };
    });
  });

  /* ================= profile, save, settings ================= */
  app.get('/api/save', ctx => savePayload(S.requireUser(ctx)));
  app.get('/api/catalog', ctx => catalogFor(ctx.user?.id, ctx.user ? isOwner(ctx.user) : false));
  app.post('/api/profile', ctx => {
    const u = S.requirePlayable(ctx);
    withCatalog(u, () => {
      for (const k of ['avatar', 'favorite']) {
        const id = ctx.body[k]; if (id == null) continue;
        if (!access(u, core.getBall(String(id)))) throw bad('Choose a ball you can use');
        db.run(`UPDATE profiles SET ${k === 'avatar' ? 'avatar_ball' : 'favorite_ball'} = ?, updated_at = ? WHERE user_id = ?`, String(id), now(), u.id);
      }
    });
    return savePayload(u);
  });
  const SETTING_KEYS = { sfx: 'num', music: 'num', musicOn: 'bool', shake: 'bool', particles: ['low', 'medium', 'high'], dmgNumbers: 'bool', labels: 'bool', speed: [1, 1.5, 2, 3], difficulty: ['easy', 'normal', 'hard', 'expert', 'godlike'], control: ['auto', 'manual'], fps: 'bool', flashes: 'bool' };
  app.post('/api/settings', ctx => {
    const u = S.requireUser(ctx); S.limit(ctx, 'settings:' + u.id, 30, 60e3);
    const out = {};
    for (const [k, t] of Object.entries(SETTING_KEYS)) {
      const v = ctx.body[k]; if (v === undefined) continue;
      if (t === 'num' && typeof v === 'number' && v >= 0 && v <= 1) out[k] = v;
      else if (t === 'bool' && typeof v === 'boolean') out[k] = v;
      else if (Array.isArray(t) && t.includes(v)) out[k] = v;
    }
    db.run('UPDATE profiles SET settings = ?, updated_at = ? WHERE user_id = ?', JSON.stringify(out), now(), u.id);
    return { ok: true, settings: out };
  });
  app.get('/api/players/:name', ctx => {
    const r = db.get(`SELECT u.username, u.role, u.created_at, p.level, p.rp, p.stats, p.avatar_ball, p.favorite_ball FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.username = ? AND u.status <> 'banned'`, ctx.params.name);
    if (!r) throw new HttpError(404, 'Player not found');
    const s = json(r.stats, {}), uid = db.get('SELECT id FROM users WHERE username = ?', r.username).id;
    return { username: r.username, owner: r.role === 'owner', premium: S.premiumOf(uid).active, level: r.level, rp: r.rp, avatar: r.avatar_ball, favorite: r.favorite_ball, since: r.created_at,
      record: { battles: s.battles || 0, wins: s.wins || 0, losses: s.losses || 0, kills: s.kills || 0, tourneyWins: s.tourneyWins || 0, bossWins: s.bossWins || 0, survivalBest: s.survivalBest || 0, endlessBest: s.endlessBest || 0 } };
  });

  /* ================= global rankings ================= */
  app.get('/api/leaderboard', ctx => {
    const by = ['rp', 'wins', 'level', 'tourney'].includes(ctx.query.by) ? ctx.query.by : 'rp';
    const order = { rp: 'p.rp DESC', level: 'p.level DESC, p.exp DESC', wins: "json_extract(p.stats, '$.wins') DESC", tourney: "json_extract(p.stats, '$.tourneyWins') DESC" }[by];
    const rows = db.all(`SELECT u.id, u.username, p.level, p.rp, p.stats, p.avatar_ball FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.status = 'active' AND u.role = 'player' AND json_extract(p.stats, '$.battles') > 0 ORDER BY ${order}, u.id LIMIT 100`);
    const list = rows.map((r, i) => { const s = json(r.stats, {}); return { rank: i + 1, username: r.username, level: r.level, rp: r.rp, wins: s.wins || 0, losses: s.losses || 0, battles: s.battles || 0, tourneyWins: s.tourneyWins || 0, avatar: r.avatar_ball, premium: S.premiumOf(r.id).active }; });
    let me = null;
    if (ctx.user) { const i = list.findIndex(x => x.username === ctx.user.username); if (i >= 0) me = list[i]; }
    return { by, list, me, note: 'Only server-verified battles count. The owner account is not ranked.' };
  });

  require('./economy').register(app, S, { access, progOf, ensureRow, ballRow, spendCoins, addCoins, unlockBall, giveBallExp, updateProfile, profileRow, savePayload, evaluateAchievements, withCatalog, allEvents, activeEvents, dailyState, utcDay });

  /* ================= background jobs ================= */
  const prevJobs = S.startJobs;
  S.startJobs = () => {
    prevJobs && prevJobs();
    S.every(600e3, () => {   // open battles older than 3h are forfeited
      for (const b of db.all("SELECT b.id, b.user_id FROM battles b WHERE b.status = 'open' AND b.created_at < ?", now() - 3 * 3600e3)) {
        const u = db.get('SELECT id, role FROM users WHERE id = ?', b.user_id); if (u) db.tx(() => forfeitOpen(u));
      }
    });
  };
}

module.exports = { register };
