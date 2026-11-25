'use strict';
/**
 * Ranked seasons and Premium monthly coins.
 *
 *  - A season is one calendar month (UTC), id 'YYYY-MM'. Ranked online matches (1 VS 1, 2 VS 2, 5-player arena)
 *    change SEASON POINTS; the points decide the tier: Bronze, Silver, Gold, Platinum, Diamond, Master, Legend.
 *  - A new season starts from half of last season's points (at most Platinum's start), so the climb begins again.
 *  - Season rewards: coins for the HIGHEST tier reached, for players with at least MIN_MATCHES ranked matches.
 *    They can be claimed once the season is over.
 *  - Premium monthly coins: an active, server-verified Ultimate Premium member can claim MONTHLY_COINS once per month.
 */
const { HttpError } = require('./http');

const MIN_MATCHES = 5, MONTHLY_COINS = 2000, START_CAP = 600;
const monthId = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);
const monthEnd = (t = Date.now()) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); };

function register(app, S) {
  const { db, core } = S, now = () => Date.now();
  const tierOf = p => core.rankTier(p);

  /** the player's row for the current season (created on demand with the soft reset) */
  function row(uid, create = false) {
    const season = monthId();
    let r = db.get('SELECT * FROM season_ranks WHERE season = ? AND user_id = ?', season, uid);
    if (!r && create) {
      const prev = db.get('SELECT points FROM season_ranks WHERE user_id = ? AND season < ? ORDER BY season DESC LIMIT 1', uid, season);
      const start = prev ? Math.min(START_CAP, Math.floor(prev.points * 0.5)) : 0;
      db.run('INSERT OR IGNORE INTO season_ranks (season, user_id, points, peak, updated_at) VALUES (?, ?, ?, ?, ?)', season, uid, start, start, now());
      r = db.get('SELECT * FROM season_ranks WHERE season = ? AND user_id = ?', season, uid);
    }
    return r || { season, user_id: uid, points: 0, peak: 0, wins: 0, losses: 0, draws: 0, matches: 0 };
  }
  S.seasonPoints = uid => row(uid).points;
  /** applies one ranked result: points never go below 0; the peak decides the season reward */
  S.seasonApply = (uid, delta, res) => {
    const r = row(uid, true), points = Math.max(0, r.points + delta);
    db.run(`UPDATE season_ranks SET points = ?, peak = MAX(peak, ?), matches = matches + 1, wins = wins + ?, losses = losses + ?, draws = draws + ?, updated_at = ? WHERE season = ? AND user_id = ?`,
      points, points, res === 'win' ? 1 : 0, res === 'loss' ? 1 : 0, res === 'draw' ? 1 : 0, now(), r.season, uid);
    return { before: r.points, after: points, tier: tierOf(points).name };
  };
  function pending(uid) {
    return db.all('SELECT season, peak, matches FROM season_ranks WHERE user_id = ? AND season < ? AND reward_claimed = 0 AND matches >= ? ORDER BY season', uid, monthId(), MIN_MATCHES)
      .map(r => { const t = tierOf(r.peak); return { season: r.season, tier: t.name, ico: t.ico, coins: t.coins }; });
  }
  /** small summary sent with the player's save */
  S.seasonBrief = uid => {
    const r = row(uid), t = tierOf(r.points);
    return { season: r.season, endsAt: monthEnd(), points: r.points, peak: r.peak, matches: r.matches, wins: r.wins, losses: r.losses, draws: r.draws,
      tier: { id: t.id, name: t.name, ico: t.ico, col: t.col, progress: t.progress, next: t.next ? { name: t.next.name, min: t.next.min } : null }, pending: pending(uid), minMatches: MIN_MATCHES };
  };
  S.monthlyCoins = uid => {
    const month = monthId(), got = !!db.get('SELECT 1 FROM premium_monthly_coins WHERE user_id = ? AND month = ?', uid, month);
    return { amount: MONTHLY_COINS, month, claimed: got, available: !got && S.premiumOf(uid).active };
  };

  app.get('/api/season', ctx => {
    const u = S.requireUser(ctx), season = monthId();
    const board = db.all(`SELECT s.user_id, s.points, s.wins, s.losses, u.username, p.avatar_ball FROM season_ranks s JOIN users u ON u.id = s.user_id LEFT JOIN profiles p ON p.user_id = s.user_id
      WHERE s.season = ? AND s.matches > 0 AND u.status != 'banned' ORDER BY s.points DESC, s.wins DESC LIMIT 50`, season);
    const me = row(u.id), place = me.matches ? db.get('SELECT COUNT(*) AS n FROM season_ranks WHERE season = ? AND matches > 0 AND points > ?', season, me.points).n + 1 : null;
    return { ...S.seasonBrief(u.id), place, tiers: core.RANK_TIERS.map(t => ({ name: t.name, min: t.min, coins: t.coins, ico: t.ico, col: t.col })),
      board: board.map((r, i) => ({ rank: i + 1, username: r.username, points: r.points, wins: r.wins, losses: r.losses, avatar: r.avatar_ball, tier: tierOf(r.points).name, me: r.user_id === u.id })) };
  });
  app.post('/api/season/claim', ctx => {
    const u = S.requirePlayable(ctx);
    S.limit(ctx, 'season:' + u.id, 10, 60e3);
    const list = pending(u.id);
    if (!list.length) throw new HttpError(409, 'No season rewards to claim yet', 'NOTHING');
    const coins = db.tx(() => {
      let total = 0;
      for (const p of list) { const r = db.run('UPDATE season_ranks SET reward_claimed = 1 WHERE season = ? AND user_id = ? AND reward_claimed = 0', p.season, u.id); if (Number(r.changes) === 1) total += p.coins; }
      if (total) S.addCoins(u.id, total);
      return total;
    });
    S.audit(u.id, 'season.reward', null, null, { seasons: list.map(p => p.season), coins });
    return { coins, rewards: list, save: S.savePayload(u) };
  });
  app.post('/api/premium/monthly-coins', ctx => {
    const u = S.requirePlayable(ctx);
    S.limit(ctx, 'monthly:' + u.id, 10, 60e3);
    if (!S.premiumOf(u.id).active) throw new HttpError(403, 'Monthly coins are part of Ultimate Premium', 'PREMIUM_ONLY');
    const month = monthId();
    const ok = db.tx(() => {
      const r = db.run('INSERT OR IGNORE INTO premium_monthly_coins (user_id, month, coins, claimed_at) VALUES (?, ?, ?, ?)', u.id, month, MONTHLY_COINS, now());
      if (Number(r.changes) !== 1) return false;
      S.addCoins(u.id, MONTHLY_COINS); return true;
    });
    if (!ok) throw new HttpError(409, 'You already claimed this month\'s Premium coins', 'ALREADY');
    S.audit(u.id, 'premium.monthly_coins', null, null, { month, coins: MONTHLY_COINS });
    return { coins: MONTHLY_COINS, month, save: S.savePayload(u) };
  });
}

module.exports = { register, monthId, MIN_MATCHES, MONTHLY_COINS };
