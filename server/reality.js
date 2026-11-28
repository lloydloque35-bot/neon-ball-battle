'use strict';
/**
 * 2.9.0 REALITY VS ABSOLUTE — server side.
 *
 *  - THE VOID BELOW and THE ABSOLUTE ABOVE cost 50,000 coins each. One database transaction:
 *      1. refuse if the player already owns the ball (or already bought it once — UNIQUE in coin_purchases);
 *      2. take the coins with a conditional update (only if the balance is high enough, so it can never go below 0);
 *      3. mark the ball owned (permanent, kept on every device), 4. record the purchase, 5. write the audit log.
 *    If any step fails, nothing happens (no coins taken, no ball). A double click / replayed request is refused.
 *  - FATE NOTE BALL is PHP 99 and goes through the verified shop (server/shop.js: PayMongo or an owner-approved QR
 *    payment). It is never sold for coins, never in summons or events.
 *  - God Mastery of the three Reality Gods: only from verified battles (the server's own re-simulation), looks and
 *    titles only, stored here. Never from practice battles.
 *  - THE FRACTURED ARCHON: the secret unlock is checked here (3 Boss Battle wins, or owning a Reality God). Rewards are
 *    given once per verified win (coins, God Mastery, the ARCHON BREAKER title and an aura) — never a paid ball.
 */
const S_ = require('./security');
const { HttpError, bad } = require('./http');
const now = () => Date.now();
const json = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const dayStart = (t = now()) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };

function register(app, S) {
  const { db } = S, core = S.core, RG = core.RG, GM = core.GM29, AR = core.ARCHON;
  const owns = (uid, ball) => !!(db.get('SELECT owned FROM user_balls WHERE user_id = ? AND ball_id = ?', uid, ball) || {}).owned;
  const ownsReality = uid => RG.IDS.some(id => owns(uid, id));
  const coinsOf = uid => (db.get('SELECT coins FROM profiles WHERE user_id = ?', uid) || {}).coins | 0;
  const bossWins = uid => (json((db.get('SELECT stats FROM profiles WHERE user_id = ?', uid) || {}).stats, {}).bossWins) | 0;
  const isOwnerUser = u => !!(u && u.role === 'owner');
  const archonUnlockedFor = u => isOwnerUser(u) || core.archonUnlocked(bossWins(u.id), ownsReality(u.id));

  /* ---------------- 50,000-coin purchase ---------------- */
  function buyWithCoins(u, ballId, ip) {
    const def = core.getBall(String(ballId || ''));
    if (!def || !def.coinGod) throw bad('This ball is not sold for coins');
    if (def.enabled === false) throw bad('This ball is not available right now');
    if (isOwnerUser(u)) throw bad('The owner account already has every ball — nothing to buy');
    const price = def.coinPrice | 0; if (!(price > 0)) throw bad('This ball has no coin price');
    return db.tx(() => {
      if (owns(u.id, def.id) || db.get('SELECT 1 FROM coin_purchases WHERE user_id = ? AND ball_id = ?', u.id, def.id)) throw new HttpError(409, `You already own ${def.name}`, 'ALREADY_OWNED');
      const before = coinsOf(u.id);
      const r = db.run('UPDATE profiles SET coins = coins - ?, updated_at = ? WHERE user_id = ? AND coins >= ?', price, now(), u.id, price);
      if (Number(r.changes) !== 1) throw new HttpError(402, `Not enough coins: ${def.name} costs ${price.toLocaleString('en-US')} coins`, 'NO_COINS');
      const after = coinsOf(u.id);
      if (after < 0 || after !== before - price) throw new HttpError(409, 'The purchase could not be completed. Nothing was charged.', 'CONFLICT');   // (rolls back)
      S.unlockBall(u.id, def.id, 'coins_2.9');
      const id = S_.randomId('cp_');
      db.run('INSERT INTO coin_purchases (id, user_id, ball_id, coins, coins_before, coins_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, u.id, def.id, price, before, after, now());
      S.audit(u.id, 'shop.coin_purchase', def.id, ip, { purchase: id, coins: price, before, after });
      return { purchase: id, ball: def.id, coins: price, balance: after };
    });
  }
  app.post('/api/reality/buy', ctx => {
    const u = S.requirePlayable(ctx);
    S.limit(ctx, 'rgbuy:' + u.id, 10, 60e3);
    const out = S.withCatalog(u, () => buyWithCoins(u, ctx.body.ball, ctx.ip));
    return { ok: true, ...out, save: S.savePayload(u) };
  });

  /* ---------------- God Mastery ---------------- */
  function masteryRow(uid, ball) { return db.get('SELECT * FROM god_mastery WHERE user_id = ? AND ball_id = ?', uid, ball); }
  function levelOf(uid, ball) { const r = masteryRow(uid, ball); return r ? core.gmLevelOf(r.xp).lv : 0; }
  function masteryView(uid) {
    const out = {};
    for (const id of RG.IDS) { const r = masteryRow(uid, id), L = core.gmLevelOf(r ? r.xp : 0); out[id] = { ...L, battles: r ? r.battles : 0, stats: r ? json(r.stats, {}) : {}, title: GM.TITLES[id], titleOwned: !!db.get('SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = ?', uid, GM.TITLES[id]) }; }
    return out;
  }
  /** adds mastery EXP from one verified battle; returns the new level (and a title at level 10) */
  function grantMastery(uid, ball, counts, win, mode, bonus = 0) {
    const def = core.getBall(ball); if (!def || !def.realityGod) return null;
    const gained = core.gmXpFor(counts, win, mode) + Math.max(0, bonus | 0);
    const r = masteryRow(uid, ball), st = r ? json(r.stats, {}) : {};
    for (const [k, v] of Object.entries(counts || {})) if (['skills', 'ults', 'forms', 'clash', 'combos', 'seals'].includes(k)) st[k] = (st[k] || 0) + Math.max(0, Math.min(500, v | 0));
    if (win) st.wins = (st.wins || 0) + 1; if (win && mode === 'boss') st.bosses = (st.bosses || 0) + 1;
    db.run('INSERT INTO god_mastery (user_id, ball_id, xp, battles, stats, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(user_id, ball_id) DO UPDATE SET xp = xp + excluded.xp, battles = battles + 1, stats = excluded.stats, updated_at = excluded.updated_at',
      uid, ball, gained, JSON.stringify(st), now());
    const L = core.gmLevelOf((r ? r.xp : 0) + gained); let title = null;
    if (L.lv >= 10 && GM.TITLES[ball]) { const t = db.run("INSERT OR IGNORE INTO cosmetics_owned (user_id, cosmetic_id, acquired_at, source) VALUES (?, ?, ?, 'mastery29')", uid, GM.TITLES[ball], now()); if (Number(t.changes)) title = GM.TITLES[ball]; }
    return { ball, gained, ...L, title };
  }

  /* ---------------- THE FRACTURED ARCHON ---------------- */
  function archonReward(uid, battleId, mode) {
    if (db.get('SELECT 1 FROM archon_clears WHERE user_id = ? AND battle_id = ?', uid, battleId)) return null;     // once per battle
    const first = !db.get('SELECT 1 FROM archon_clears WHERE user_id = ?', uid);
    const today = db.get('SELECT COUNT(*) AS n FROM archon_clears WHERE user_id = ? AND cleared_at >= ?', uid, dayStart()).n;
    const R = first ? AR.REWARD.first : AR.REWARD.repeat, coins = first || today < AR.REWARD.perDay ? R.coins : 0;
    db.run('INSERT INTO archon_clears (user_id, battle_id, mode, first, coins, cleared_at) VALUES (?, ?, ?, ?, ?, ?)', uid, battleId, mode, first ? 1 : 0, coins, now());
    if (coins) S.addCoins(uid, coins);
    const cosmetics = [];
    if (first) for (const c of AR.REWARD.first.cosmetics) { const t = db.run("INSERT OR IGNORE INTO cosmetics_owned (user_id, cosmetic_id, acquired_at, source) VALUES (?, ?, ?, 'archon')", uid, c, now()); if (Number(t.changes)) cosmetics.push(c); }
    S.audit(uid, 'archon.cleared', battleId, null, { mode, first, coins, cosmetics });
    return { first, coins, mastery: R.mastery, cosmetics, limited: !coins };
  }
  function archonView(u) {
    const clears = db.get('SELECT COUNT(*) AS n FROM archon_clears WHERE user_id = ?', u.id).n;
    return { unlocked: archonUnlockedFor(u), clears, today: db.get('SELECT COUNT(*) AS n FROM archon_clears WHERE user_id = ? AND cleared_at >= ?', u.id, dayStart()).n, perDay: AR.REWARD.perDay,
      need: { bossWins: AR.UNLOCK_BOSS_WINS, haveBossWins: bossWins(u.id), ownsRealityGod: ownsReality(u.id) }, reward: AR.REWARD };
  }

  /** called by server/game.js for every verified (non-practice) single-player battle, inside its transaction */
  function afterBattle(uid, row, T, r) {
    const ball = T.teams[0][0].ball, def = core.getBall(ball), out = {};
    let bonus = 0;
    if (T.opts && T.opts.archon && T.mode === 'boss' && r.win) { out.archon = archonReward(uid, row.id, 'boss'); if (out.archon) bonus = out.archon.mastery || 0; }
    const gm = r.gm && r.gm[0];
    if (def && def.realityGod) out.mastery = grantMastery(uid, ball, gm && gm.ball === ball ? gm.counts : {}, r.win, T.mode, bonus);
    return out;
  }
  /** called by server/pvp.js for a verified online match (God Mastery only when the match gave rewards; the Archon co-op win always counts) */
  function afterMatch(uid, matchId, M, slot, ball, win, rewarded) {
    const out = {}; let bonus = 0;
    if (M.ticket.opts && M.ticket.opts.archon && win) { out.archon = archonReward(uid, matchId, 'coop'); if (out.archon) bonus = out.archon.mastery || 0; }
    const def = core.getBall(ball);
    if (def && def.realityGod && (rewarded || out.archon)) { const gm = M.gm && M.gm[slot]; out.mastery = grantMastery(uid, ball, gm && gm.ball === ball ? gm.counts : {}, win, out.archon ? 'boss' : 'pvp', bonus); }
    return out;
  }

  app.get('/api/reality/me', ctx => {
    const u = S.requireUser ? S.requireUser(ctx) : S.requirePlayable(ctx);
    return S.withCatalog(u, () => ({
      version: RG.VER,
      gods: RG.IDS.map(id => { const d = core.getBall(id); return { id, name: d.name, owned: isOwnerUser(u) || owns(u.id, id), price: d.coinGod ? { coins: d.coinPrice } : { php: d.pricePhp }, forms: d.forms.map(f => f.name) }; }),
      coins: coinsOf(u.id), mastery: masteryView(u.id), archon: archonView(u),
      purchases: db.all('SELECT id, ball_id AS ball, coins, created_at AS at FROM coin_purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', u.id),
    }));
  });

  S.reality = { buyWithCoins, grantMastery, levelOf, masteryView, archonReward, archonUnlockedFor, afterBattle, afterMatch };
}

module.exports = { register };
