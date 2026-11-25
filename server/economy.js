'use strict';
/**
 * Server-side economy: unlocks, stat upgrades, summons, evolution, skill trees, daily rewards,
 * achievements, collection rewards, limited events, cosmetics and ball fusion.
 * Every action re-reads state inside a transaction, so double-clicks and parallel requests
 * cannot spend the same coins twice or claim a reward twice.
 */
const S_ = require('./security');
const { HttpError, bad } = require('./http');
const { json } = require('./db');

const now = () => Date.now();

function register(app, S, H) {
  const { db, core } = S;
  const { access, progOf, ensureRow, spendCoins, addCoins, unlockBall, giveBallExp, updateProfile, profileRow, savePayload, evaluateAchievements, withCatalog, allEvents, activeEvents, dailyState, utcDay } = H;
  const isOwner = u => u.role === 'owner';
  /** wraps a mutating action: auth, rate limit, transaction, fresh save payload in the response */
  const action = (path, fn, lim = 60) => app.post(path, ctx => {
    const u = S.requirePlayable(ctx);
    S.limit(ctx, 'eco:' + u.id, lim, 60e3);
    const extra = db.tx(() => withCatalog(u, () => fn(u, ctx.body, ctx)));
    return { ok: true, ...(extra || {}), save: savePayload(u) };
  });
  const ballOrThrow = id => { const b = core.getBall(String(id || '')); if (!b) throw bad('Unknown ball'); return b; };

  /* ---------- collection & upgrades ---------- */
  action('/api/shop/unlock', (u, b) => {
    const def = ballOrThrow(b.ball);
    if (def.adminOnly || def.limited || def.premium || def.fusion || def.draft || def.enabled === false) throw bad('This ball cannot be bought with coins');
    if (H.ballRow(u.id, def.id)?.owned) throw bad('You already own this ball');
    spendCoins(u.id, core.RARITY_INFO[def.rarity]?.price || 1000);
    unlockBall(u.id, def.id, 'purchase');
    return { unlocked: def.id };
  });
  action('/api/shop/upgrade', (u, b) => {
    const def = ballOrThrow(b.ball), stat = String(b.stat || '');
    if (!access(u, def) || def.adminOnly) throw new HttpError(403, 'You cannot upgrade this ball', 'NO_ACCESS');
    if (!(stat in core.UPGRADE_CAPS)) throw bad('Unknown stat');
    const r = ensureRow(u.id, def.id), up = json(r.up, {}), pts = up[stat] || 0;
    if (pts >= core.UPGRADE_CAPS[stat]) throw bad('This stat is maxed');
    spendCoins(u.id, core.upgradeCost(stat, pts));
    up[stat] = pts + 1;
    db.run('UPDATE user_balls SET up = ? WHERE user_id = ? AND ball_id = ?', JSON.stringify(up), u.id, def.id);
  });
  action('/api/ball/evolve', (u, b) => {
    const def = ballOrThrow(b.ball);
    if (!access(u, def) || def.adminOnly) throw new HttpError(403, 'You cannot evolve this ball', 'NO_ACCESS');
    const p = progOf(u.id, def.id), nx = core.EVO[p.evo + 1];
    if (!nx) throw bad('Already fully evolved');
    if (p.level < nx.lvl) throw bad(`Reach level ${nx.lvl} first`);
    spendCoins(u.id, nx.cost);
    ensureRow(u.id, def.id);
    db.run('UPDATE user_balls SET evo = evo + 1 WHERE user_id = ? AND ball_id = ?', u.id, def.id);
    updateProfile(u.id, pr => { pr.stats.evolutions = (pr.stats.evolutions || 0) + 1; return { stats: pr.stats }; });
    evaluateAchievements(u.id);
    return { evo: p.evo + 1 };
  });
  action('/api/ball/tree', (u, b) => {
    const def = ballOrThrow(b.ball), node = core.TREE.find(n => n.id === b.node);
    if (!node) throw bad('Unknown skill');
    if (!access(u, def) || def.adminOnly) throw new HttpError(403, 'You cannot train this ball', 'NO_ACCESS');
    const r = ensureRow(u.id, def.id), tree = json(r.tree, {});
    if (tree[node.id]) throw bad('Already learned');
    if (node.need4 && (def.skills || []).length < 4) throw bad('This ball has no 4th ability');
    if (r.level < node.lvl) throw bad(`Requires level ${node.lvl}`);
    if (node.req && !tree[node.req]) throw bad('Learn the previous skill first');
    if (r.sp < node.cost) throw bad('Not enough skill points');
    tree[node.id] = 1;
    db.run('UPDATE user_balls SET tree = ?, sp = sp - ? WHERE user_id = ? AND ball_id = ?', JSON.stringify(tree), node.cost, u.id, def.id);
  });
  action('/api/shop/summon', (u, b) => {
    const O = core.ORBS[b.orb]; if (!O) throw bad('Unknown orb');
    const premium = S.premiumOf(u.id).active, price = Math.round(O.price * (premium ? 0.8 : 1));
    const pool = core.allBalls().filter(x => x.enabled && !x.adminOnly && !x.limited && !x.premium && !x.fusion && !x.draft && O.w[x.rarity]);
    spendCoins(u.id, price);
    const total = pool.reduce((s, x) => s + O.w[x.rarity], 0); let roll = S_.secureRandom() * total, got = pool[0];
    for (const x of pool) { roll -= O.w[x.rarity]; if (roll <= 0) { got = x; break; } }
    const dup = !!H.ballRow(u.id, got.id)?.owned;
    if (dup) { addCoins(u.id, Math.round(price * 0.4)); giveBallExp(u.id, got.id, 150); } else unlockBall(u.id, got.id, 'summon');
    updateProfile(u.id, pr => { pr.stats.summons = (pr.stats.summons || 0) + 1; return { stats: pr.stats }; });
    evaluateAchievements(u.id);
    return { ball: got.id, duplicate: dup, refund: dup ? Math.round(price * 0.4) : 0, price };
  }, 30);

  /* ---------- daily rewards ---------- */
  action('/api/daily/claim', u => {
    const p = profileRow(u.id), d = dailyState(p);
    if (!d.canClaim) throw new HttpError(409, 'Daily reward already claimed today. Come back tomorrow!', 'CLAIMED');
    const day = d.nextDay, rw = core.DAILY_REWARDS[day - 1], premium = S.premiumOf(u.id).active;
    const coins = Math.round((rw.coins || 0) * (premium ? 1.5 : 1));
    if (coins) addCoins(u.id, coins);
    if (rw.exp) giveBallExp(u.id, p.favorite_ball, rw.exp);
    let cosmetic = null;
    if (rw.cosmetic && !db.get('SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = ?', u.id, rw.cosmetic)) { db.run("INSERT INTO cosmetics_owned (user_id, cosmetic_id, acquired_at, source) VALUES (?, ?, ?, 'daily')", u.id, rw.cosmetic, now()); cosmetic = rw.cosmetic; }
    updateProfile(u.id, () => ({ daily_streak: day, daily_last: utcDay() }));
    return { day, coins, exp: rw.exp || 0, cosmetic };
  }, 10);

  /* ---------- achievements & collection ---------- */
  action('/api/achievements/claim', (u, b) => {
    const a = core.ACHIEVEMENTS.find(x => x.id === b.id); if (!a) throw bad('Unknown achievement');
    evaluateAchievements(u.id);
    const r = db.get('SELECT * FROM achievements WHERE user_id = ? AND ach_id = ?', u.id, a.id);
    if (!r) throw bad('Not completed yet');
    const upd = db.run('UPDATE achievements SET claimed_at = ? WHERE user_id = ? AND ach_id = ? AND claimed_at IS NULL', now(), u.id, a.id);
    if (Number(upd.changes) !== 1) throw new HttpError(409, 'Already claimed', 'CLAIMED');
    addCoins(u.id, a.reward);
    return { reward: a.reward };
  });
  action('/api/collection/claim', (u, b) => {
    const m = core.COLLECTION_REWARDS.find(x => x[0] === Number(b.milestone)); if (!m) throw bad('Unknown milestone');
    const owned = db.all('SELECT ball_id FROM user_balls WHERE user_id = ? AND owned = 1', u.id).filter(r => { const d = core.getBall(r.ball_id); return d && !d.adminOnly; }).length;
    if (owned < m[0]) throw bad(`Own ${m[0]} balls first`);
    try { db.run('INSERT INTO collection_claims (user_id, milestone, claimed_at) VALUES (?, ?, ?)', u.id, m[0], now()); } catch { throw new HttpError(409, 'Already claimed', 'CLAIMED'); }
    addCoins(u.id, m[1]);
    return { reward: m[1] };
  });

  /* ---------- limited events ---------- */
  app.get('/api/events', ctx => {
    const u = ctx.user, premium = u ? S.premiumOf(u.id).active : false;
    return { now: now(), events: allEvents().map(e => ({ ...e, progress: u ? (db.get('SELECT wins, claimed FROM event_progress WHERE user_id = ? AND event_id = ?', u.id, e.id) || { wins: 0, claimed: 0 }) : null, owned: u ? !!H.ballRow(u.id, e.ball)?.owned : false, locked: e.premiumOnly && !premium })) };
  });
  const activeEvent = (id, u) => {
    const ev = activeEvents().find(e => e.id === id); if (!ev) throw bad('This event is not running');
    if (ev.premiumOnly && !S.premiumOf(u.id).active) throw new HttpError(403, 'This is a Premium-exclusive event', 'PREMIUM_ONLY');
    if (H.ballRow(u.id, ev.ball)?.owned) throw bad('You already own this ball');
    return ev;
  };
  action('/api/events/claim', (u, b) => {
    const ev = activeEvent(String(b.id || ''), u);
    const pr = db.get('SELECT wins, claimed FROM event_progress WHERE user_id = ? AND event_id = ?', u.id, ev.id) || { wins: 0, claimed: 0 };
    if (pr.wins < ev.goal) throw bad(`Win ${ev.goal - pr.wins} more battle(s) during the event`);
    db.run('UPDATE event_progress SET claimed = 1 WHERE user_id = ? AND event_id = ?', u.id, ev.id);
    unlockBall(u.id, ev.ball, 'event', ev.name); evaluateAchievements(u.id);
    return { unlocked: ev.ball };
  });
  action('/api/events/buy', (u, b) => {
    const ev = activeEvent(String(b.id || ''), u);
    spendCoins(u.id, ev.price);
    unlockBall(u.id, ev.ball, 'event', ev.name); evaluateAchievements(u.id);
    return { unlocked: ev.ball };
  });

  /* ---------- cosmetics (visual only) ---------- */
  action('/api/cosmetics/buy', (u, b) => {
    const c = core.COSMETICS.find(x => x.id === b.id); if (!c) throw bad('Unknown item');
    if (c.premium) throw bad('Premium cosmetics are included with Ultimate Premium');
    if (db.get('SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = ?', u.id, c.id)) throw bad('Already owned');
    spendCoins(u.id, c.price);
    db.run("INSERT INTO cosmetics_owned (user_id, cosmetic_id, acquired_at, source) VALUES (?, ?, ?, 'purchase')", u.id, c.id, now());
  });
  action('/api/cosmetics/equip', (u, b) => {
    const slot = String(b.slot || ''); if (!core.COSMETIC_SLOTS[slot]) throw bad('Unknown slot');
    const id = b.id == null ? null : String(b.id);
    if (id) {
      const c = core.COSMETICS.find(x => x.id === id && x.slot === slot); if (!c) throw bad('Unknown item');
      const ok = c.premium ? (S.premiumOf(u.id).active || isOwner(u)) : !!db.get('SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = ?', u.id, id);
      if (!ok) throw new HttpError(403, c.premium ? 'Requires Ultimate Premium' : 'You do not own this item', 'NO_ACCESS');
    }
    updateProfile(u.id, p => { const lo = p.loadout; if (id) lo[slot] = id; else delete lo[slot]; return { loadout: lo }; });
  });

  /* ---------- ball fusion ---------- */
  function fusionCheck(u, a, b) {
    const A = ballOrThrow(a), B = ballOrThrow(b), owner = u.role === 'owner';
    if (A.id === B.id) throw bad('Choose two different balls');
    if (owner) {
      // the game owner may fuse any balls they can use (admin balls included) at any level; fusions with an admin parent stay owner-only
      for (const d of [A, B]) if (d.fusion || d.draft || !S.access(u, d)) throw bad(`${d.name} cannot be fused`);
    } else {
      if (!core.fusionEligible(A) || !core.fusionEligible(B)) throw bad('Admin, limited, premium and fusion balls cannot be fused');
      for (const d of [A, B]) { const r = H.ballRow(u.id, d.id); if (!r || !r.owned) throw bad(`You must own ${d.name}`); if (r.level < core.FUSION_MIN_LEVEL) throw bad(`${d.name} must be level ${core.FUSION_MIN_LEVEL}+`); }
    }
    const pair = [A.id, B.id].sort().join('+');
    if (db.all('SELECT parents FROM fusions WHERE user_id = ?', u.id).some(r => json(r.parents, []).slice().sort().join('+') === pair)) throw bad('You already fused these two balls');
    if (!owner && db.get('SELECT COUNT(*) n FROM fusions WHERE user_id = ?', u.id).n >= core.FUSION_MAX) throw bad(`Fusion limit reached (${core.FUSION_MAX})`);
    return { A, B };
  }
  app.post('/api/fusion/preview', ctx => {
    const u = S.requirePlayable(ctx);
    return withCatalog(u, () => { const { A, B } = fusionCheck(u, ctx.body.a, ctx.body.b); return { def: core.makeFusionDef(A, B, 'fusion_preview'), cost: core.FUSION_COST }; });
  });
  action('/api/fusion/create', (u, b) => {
    const { A, B } = fusionCheck(u, b.a, b.b);
    spendCoins(u.id, core.FUSION_COST);
    const id = 'fusion_' + u.id + '_' + S_.randomToken(6).replace(/[^A-Za-z0-9]/g, 'x');
    const def = core.makeFusionDef(A, B, id);
    db.run('INSERT INTO fusions (id, user_id, def, parents, created_at) VALUES (?, ?, ?, ?, ?)', id, u.id, JSON.stringify(def), JSON.stringify([A.id, B.id]), now());
    db.run("INSERT INTO user_balls (user_id, ball_id, owned, source, unlocked_at) VALUES (?, ?, 1, 'fusion', ?)", u.id, id, now());
    return { fusion: id, name: def.name };
  }, 10);
}

module.exports = { register };
