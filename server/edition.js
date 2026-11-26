'use strict';
/**
 * 2.4.0 LIMITED EDITION — GOD OF ABSOLUTE, THE UNRIVALED ONE (PHP 499, initially 100 verified owners).
 *
 *  - Supply, open / closed and the edition announcement are owner settings (server-side, owner + 2FA, audit-logged, ledgered).
 *  - A slot is HELD while a player pays: QR payment 30 min to send the reference number, PayMongo checkout 20 min.
 *    A reference number that was sent keeps its slot until the owner approves or rejects it. Expired holds are released.
 *  - available = supply − verified owners − active holds, so two players can never both get the last slot.
 *  - Ownership is a row in edition_owners with a serial number 1..supply. It is created ONLY by a verified payment
 *    (owner-approved QR payment or PayMongo-confirmed payment), inside one database transaction that re-checks the supply.
 *    The database refuses duplicates (PRIMARY KEY (ball, serial), UNIQUE (ball, user), UNIQUE purchase) and refuses
 *    any change or deletion of ownership rows and of the ledger (triggers).
 *  - A verified owner gets: the ball (permanent), its own level set to Lv 50 (only that ball), and the owner rewards
 *    (title & nameplate, aura, trail, golden cosmic elimination, victory). Restore re-applies all of it, never lowers a level.
 *  - Scarcity is never faked: every number shown comes from these tables.
 */
const { HttpError, bad } = require('./http');
const S_ = require('./security');

const EDITION_BALLS = {
  godofabsolute: { name: 'GOD OF ABSOLUTE – LIMITED EDITION', price: 499, startLevel: 50, defaultSupply: 100, title: 'title_absolute',
    rewards: ['title_absolute', 'aura_absolute', 'trail_absolute', 'hit_absolute', 'win_absolute'], soldOut: 'SOLD OUT – THE ABSOLUTE ERA IS COMPLETE.' },
  // 2.8.0 ANTI BALL: a PERMANENT 100-copy edition — the supply can never change, no new editions, no events, no free unlock.
  // Old free-version progress (levels, skill tree) comes back when the player buys a copy (migration 010 kept it).
  anti: { name: 'ANTI BALL – LIMITED EDITION', price: 999, startLevel: 1, defaultSupply: 100, fixedSupply: true, serialPrefix: 'ANTI-', title: 'title_nullbearer',
    rewards: ['title_nullbearer'], soldOut: 'SOLD OUT — all 100 ANTI BALLS have their owners. It will never return.' },
};
const serialLabel = (ball, n) => EDITION_BALLS[ball] && EDITION_BALLS[ball].serialPrefix ? EDITION_BALLS[ball].serialPrefix + String(n).padStart(3, '0') : '#' + String(n).padStart(3, '0');
const WILL_DEFAULT = { intelligence: 2, aggression: 60, transcend: true, hunt: true, retreat: true, explore: true, step: true, speech: true, maxRealm: 6, realmCd: 18 };   // same as gods3.js
const HOLD_QR_MS = 30 * 60e3, HOLD_CHECKOUT_MS = 20 * 60e3, MAX_SUPPLY = 100000;
const SOLD_OUT_MSG = 'SOLD OUT – THE ABSOLUTE ERA IS COMPLETE.';

function register(app, S) {
  const { db, core } = S;
  const now = () => Date.now();
  const setting = k => { const r = db.get('SELECT value FROM app_settings WHERE key = ?', k); return r ? r.value : null; };
  const setSetting = (k, v) => db.run('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', k, v, now());
  const isEdition = id => !!EDITION_BALLS[id];
  core.setXpTune(+setting('absolute_xp_mul') || 1);          // owner setting: EXP needed per level above Lv 50

  function cfgOf(ball) {
    let v = null; try { v = JSON.parse(setting('edition:' + ball) || 'null'); } catch { v = null; }
    const c = { supply: EDITION_BALLS[ball].defaultSupply, open: true, edition: 1, announcement: '', ...(v || {}) };
    if (EDITION_BALLS[ball].fixedSupply) { c.supply = EDITION_BALLS[ball].defaultSupply; c.edition = 1; }     // permanent: never more than 100
    return c;
  }
  const saveCfg = (ball, c) => setSetting('edition:' + ball, JSON.stringify({ supply: c.supply, open: !!c.open, edition: c.edition, announcement: c.announcement || '' }));
  const ledger = (ball, event, o = {}) => db.run('INSERT INTO edition_ledger (ball_id, event, user_id, purchase_id, actor_id, details, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ball, event, o.user ?? null, o.purchase ?? null, o.actor ?? null, o.details ? JSON.stringify(o.details) : null, now());
  const owners = ball => db.get('SELECT COUNT(*) AS n FROM edition_owners WHERE ball_id = ?', ball).n;
  /** slots held by players who are paying right now (QR reservation, sent reference, open checkout) */
  const holds = (ball, except = '') => db.get(`SELECT COUNT(*) AS n FROM shop_purchases WHERE product = ? AND id != ?
    AND ((status IN ('reserved', 'pending', 'creating') AND hold_until > ?) OR (status = 'awaiting' AND provider = 'manual'))`, ball, except, now()).n;
  function releaseExpired(ball) {
    const t = now();
    for (const r of db.all("SELECT id, user_id FROM shop_purchases WHERE product = ? AND status = 'reserved' AND hold_until <= ?", ball, t)) {
      db.run("UPDATE shop_purchases SET status = 'released', updated_at = ? WHERE id = ? AND status = 'reserved'", t, r.id);
      ledger(ball, 'release', { user: r.user_id, purchase: r.id, details: { why: 'not paid in time' } });
    }
  }
  const serialOf = (ball, uid) => { const r = db.get('SELECT serial FROM edition_owners WHERE ball_id = ? AND user_id = ?', ball, uid); return r ? r.serial : null; };
  function status(ball, uid) {
    releaseExpired(ball);
    const c = cfgOf(ball), o = owners(ball), hd = holds(ball);
    const mine = uid ? db.get(`SELECT id, status, hold_until FROM shop_purchases WHERE product = ? AND user_id = ?
      AND ((status IN ('reserved', 'pending', 'creating') AND hold_until > ?) OR (status = 'awaiting' AND provider = 'manual')) ORDER BY created_at DESC`, ball, uid, now()) : null;
    const E = EDITION_BALLS[ball], serial = uid ? serialOf(ball, uid) : null;
    return { ball, name: E.name, price: E.price, supply: c.supply, owners: o, reserved: hd, available: Math.max(0, c.supply - o - hd), open: !!c.open,
      soldOut: o >= c.supply, soldOutText: E.soldOut || SOLD_OUT_MSG, edition: c.edition, announcement: c.announcement || '', startLevel: E.startLevel, permanent: !!E.fixedSupply,
      mine: mine ? { purchaseId: mine.id, status: mine.status, holdUntil: mine.hold_until } : null, serial, serialLabel: serial ? serialLabel(ball, serial) : null };
  }
  /** throws unless a new slot can be held right now (call inside a transaction, then insert the hold) */
  function assertSlot(ball, uid, except) {
    releaseExpired(ball);
    const c = cfgOf(ball), o = owners(ball);
    if (serialOf(ball, uid)) throw new HttpError(409, 'You already own this edition — check "Restore purchases" if it does not show up', 'ALREADY_OWNED');
    if (o >= c.supply) throw new HttpError(409, EDITION_BALLS[ball].soldOut || SOLD_OUT_MSG, 'SOLD_OUT');
    if (!c.open) throw new HttpError(403, 'New purchases of this edition are paused by the game owner. Nothing was charged.', 'EDITION_CLOSED');
    if (o + holds(ball, except) >= c.supply) throw new HttpError(409, 'Every remaining slot is reserved by players who are paying right now. Please try again in a few minutes — nothing was charged.', 'ALL_RESERVED');
  }
  /** makes sure a verified owner has everything the edition gives (used by grant and by restore). Never lowers anything. */
  function ensure(uid, ball) {
    const E = EDITION_BALLS[ball], fixed = [], r = db.get('SELECT owned, level FROM user_balls WHERE user_id = ? AND ball_id = ?', uid, ball);
    if (!r) { db.run("INSERT INTO user_balls (user_id, ball_id, owned, level, exp, sp, source, unlocked_at) VALUES (?, ?, 1, ?, 0, ?, 'purchase', ?)", uid, ball, E.startLevel, E.startLevel, now()); fixed.push('ball', 'level'); }
    else {
      if (!r.owned) { db.run("UPDATE user_balls SET owned = 1, source = COALESCE(source, 'purchase'), unlocked_at = COALESCE(unlocked_at, ?) WHERE user_id = ? AND ball_id = ?", now(), uid, ball); fixed.push('ball'); }
      if (r.level < E.startLevel) { db.run('UPDATE user_balls SET level = ?, exp = 0, sp = MAX(sp, ?) WHERE user_id = ? AND ball_id = ?', E.startLevel, E.startLevel, uid, ball); fixed.push('level'); }
    }
    for (const c of E.rewards) if (!db.get('SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = ?', uid, c)) { db.run("INSERT INTO cosmetics_owned (user_id, cosmetic_id, acquired_at, source) VALUES (?, ?, ?, 'edition')", uid, c, now()); fixed.push(c); }
    return fixed;
  }
  /** the ONLY way to become an owner — call inside the transaction that marks a verified payment as paid.
   *  → { serial } | { already: serial } | { full: true } (then the payment must be refunded; nothing is granted) */
  function grant(uid, purchaseId, ball, { actor = null, source } = {}) {
    const have = serialOf(ball, uid); if (have) { ensure(uid, ball); return { already: have }; }
    const c = cfgOf(ball), o = owners(ball);
    if (o >= c.supply) { ledger(ball, 'sold_out_refund', { user: uid, purchase: purchaseId, actor, details: { source } }); return { full: true }; }
    const serial = db.get('SELECT COALESCE(MAX(serial), 0) AS m FROM edition_owners WHERE ball_id = ?', ball).m + 1;
    if (serial > c.supply) { ledger(ball, 'sold_out_refund', { user: uid, purchase: purchaseId, actor, details: { source } }); return { full: true }; }
    db.run('INSERT INTO edition_owners (ball_id, serial, user_id, purchase_id, edition, granted_at) VALUES (?, ?, ?, ?, ?, ?)', ball, serial, uid, purchaseId, c.edition, now());
    const fixed = ensure(uid, ball);
    S.updateProfile(uid, p => { const lo = p.loadout; if (!lo.title && EDITION_BALLS[ball].title) lo.title = EDITION_BALLS[ball].title; return { loadout: lo }; });   // the nameplate is shown right away
    ledger(ball, 'grant', { user: uid, purchase: purchaseId, actor, details: { serial, edition: c.edition, source, startLevel: EDITION_BALLS[ball].startLevel, rewards: fixed } });
    S.audit(actor ?? uid, 'edition.granted', purchaseId, null, { ball, serial, label: serialLabel(ball, serial), user: uid, source });
    return { serial };
  }
  /** restore purchases: re-applies every edition entitlement of this player */
  function restore(uid, ip) {
    let n = 0;
    for (const r of db.all('SELECT ball_id, serial, purchase_id FROM edition_owners WHERE user_id = ?', uid)) {
      const fixed = ensure(uid, r.ball_id);
      if (fixed.length) { n++; ledger(r.ball_id, 'restore', { user: uid, purchase: r.purchase_id, details: { serial: r.serial, fixed } }); }
      else ledger(r.ball_id, 'restore_check', { user: uid, purchase: r.purchase_id, details: { serial: r.serial } });
    }
    return n;
  }
  S.edition = { EDITION_BALLS, isEdition, status, assertSlot, grant, restore, ensure, ledger, releaseExpired, HOLD_QR_MS, HOLD_CHECKOUT_MS, SOLD_OUT_MSG, serialOf, serialLabel,
    /** public badge info for profiles / rankings / the save */
    badgesOf: uid => Object.fromEntries(db.all('SELECT ball_id, serial FROM edition_owners WHERE user_id = ?', uid).map(r => [r.ball_id, r.serial])) };

  /* ---------------- player: reserve a slot before paying by QR ---------------- */
  app.post('/api/godshop/edition/reserve', ctx => {
    const u = S.requirePlayable(ctx), ball = String(ctx.body.product || '');
    if (!isEdition(ball)) throw bad('Unknown product');
    if (u.role === 'owner') throw bad('The owner account already has every ball — nothing to buy');
    if (!S.shopStatus().manual) throw new HttpError(503, 'QR payments are not open right now. Please do not send money yet.', 'SHOP_DISABLED');
    S.limit(ctx, 'edres:' + u.id, 8, 600e3, 'Too many reservations. Please wait a few minutes.');
    let out;
    db.tx(() => {
      releaseExpired(ball);
      const open = db.get("SELECT id, hold_until FROM shop_purchases WHERE product = ? AND user_id = ? AND status = 'reserved' AND hold_until > ?", ball, u.id, now());
      if (open) { out = { purchaseId: open.id, holdUntil: open.hold_until, reused: true }; return; }
      if (db.get("SELECT 1 FROM shop_purchases WHERE product = ? AND user_id = ? AND status = 'awaiting'", ball, u.id)) throw new HttpError(409, 'You already sent a payment for this. Please wait for the owner to check it.', 'AWAITING');
      assertSlot(ball, u.id);
      const id = S_.randomId('pur_'), until = now() + HOLD_QR_MS;
      db.run("INSERT INTO shop_purchases (id, user_id, product, balls, amount, currency, provider, status, hold_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PHP', 'manual', 'reserved', ?, ?, ?)",
        id, u.id, ball, JSON.stringify([ball]), EDITION_BALLS[ball].price * 100, until, now(), now());
      ledger(ball, 'reserve', { user: u.id, purchase: id, details: { until, via: 'qr' } });
      out = { purchaseId: id, holdUntil: until };
    });
    S.audit(u.id, 'edition.reserved', out.purchaseId, ctx.ip, { ball });
    return { ...out, edition: status(ball, u.id) };
  });
  /** a player may cancel their own unpaid reservation (frees the slot at once) */
  app.post('/api/godshop/edition/cancel', ctx => {
    const u = S.requireUser(ctx), id = String(ctx.body.purchaseId || '');
    const r = db.get("SELECT * FROM shop_purchases WHERE id = ? AND user_id = ? AND status = 'reserved'", id, u.id);
    if (!r) return { ok: true };
    db.run("UPDATE shop_purchases SET status = 'released', updated_at = ? WHERE id = ? AND status = 'reserved'", now(), id);
    ledger(r.product, 'release', { user: u.id, purchase: id, details: { why: 'cancelled by the player' } });
    return { ok: true };
  });

  /* ---------------- owner: GOD OF ABSOLUTE management panel (owner + recent 2FA, audit-logged) ---------------- */
  const owner = ctx => S.requireOwner(ctx);
  /** which edition the owner is managing (?ball= or body.ball; God of Absolute by default) */
  const ballOf = ctx => { const b = String((ctx.query && ctx.query.ball) || (ctx.body && ctx.body.ball) || 'godofabsolute'); if (!isEdition(b)) throw bad('Unknown edition'); return b; };
  app.get('/api/admin/edition', ctx => {
    owner(ctx); const BALL = ballOf(ctx);
    const st = status(BALL), json = v => { try { return JSON.parse(v); } catch { return null; } };
    const rowsOf = sql => db.all(sql, BALL).map(p => ({ id: p.id, username: p.username, status: p.status, provider: p.provider, method: p.method, amount: p.amount / 100,
      reference: p.provider === 'manual' && p.payment_ref ? p.payment_ref.slice(7) : null, holdUntil: p.hold_until, createdAt: p.created_at, paidAt: p.paid_at, note: p.note, payerNote: p.payer_note }));
    const tune = db.get('SELECT settings FROM admin_ball_tuning WHERE ball_id = ?', BALL);
    return { ...st,
      owners: db.all('SELECT o.serial, o.edition, o.granted_at, o.purchase_id, u.username FROM edition_owners o JOIN users u ON u.id = o.user_id WHERE o.ball_id = ? ORDER BY o.serial', BALL).map(r => ({ ...r, label: serialLabel(BALL, r.serial) })),
      editions: Object.keys(EDITION_BALLS),
      pending: rowsOf(`SELECT p.*, u.username FROM shop_purchases p JOIN users u ON u.id = p.user_id WHERE p.product = ? AND (p.status IN ('reserved', 'awaiting') OR (p.status = 'pending' AND p.hold_until > ${now()})) ORDER BY p.created_at`),
      completed: rowsOf("SELECT p.*, u.username FROM shop_purchases p JOIN users u ON u.id = p.user_id WHERE p.product = ? AND p.status = 'paid' ORDER BY p.paid_at DESC LIMIT 200"),
      errors: rowsOf("SELECT p.*, u.username FROM shop_purchases p JOIN users u ON u.id = p.user_id WHERE p.product = ? AND p.status IN ('review', 'failed', 'rejected') ORDER BY p.updated_at DESC LIMIT 100"),
      restores: db.all("SELECT l.at, l.event, l.details, u.username FROM edition_ledger l LEFT JOIN users u ON u.id = l.user_id WHERE l.ball_id = ? AND l.event IN ('restore', 'restore_check') ORDER BY l.id DESC LIMIT 50", BALL).map(r => ({ ...r, details: json(r.details) })),
      ledger: db.all('SELECT l.id, l.at, l.event, l.purchase_id, l.details, u.username, a.username AS actor FROM edition_ledger l LEFT JOIN users u ON u.id = l.user_id LEFT JOIN users a ON a.id = l.actor_id WHERE l.ball_id = ? ORDER BY l.id DESC LIMIT 150', BALL).map(r => ({ ...r, details: json(r.details) })),
      securityEvents: db.all("SELECT kind, severity, details, created_at FROM security_events WHERE kind LIKE 'shop_%' ORDER BY id DESC LIMIT 30"),
      xpMul: core.xpTune(), ultDur: (tune && json(tune.settings) || {}).ultDur || 3.4, paymentsOpen: S.shopStatus(),
      will: { ...WILL_DEFAULT, ...((tune && json(tune.settings) || {}).will || {}) }, off: (tune && json(tune.settings) || {}).off || [], cdMul: (tune && json(tune.settings) || {}).cdMul || 1,
      skills: ((core.getBall(BALL) || {}).skills || []).map(s => s.name) };
  });
  app.post('/api/admin/edition/settings', ctx => {
    const me = owner(ctx), BALL = ballOf(ctx), b = ctx.body, c = cfgOf(BALL), o = owners(BALL), before = { ...c };
    if (b.supply != null && EDITION_BALLS[BALL].fixedSupply && Number(b.supply) !== c.supply) throw bad(`${EDITION_BALLS[BALL].name} is a permanent ${c.supply}-copy edition: its supply can never change`);
    if (b.supply != null && !EDITION_BALLS[BALL].fixedSupply) {
      const v = Number(b.supply);
      if (!Number.isInteger(v) || v < 1 || v > MAX_SUPPLY) throw bad(`Supply must be a whole number from 1 to ${MAX_SUPPLY}`);
      if (v < o) throw bad(`Supply cannot be lower than the ${o} verified owners`);
      if (o >= c.supply && v > c.supply) throw bad('This edition is sold out. Use "Release a new edition" to offer more slots.');
      c.supply = v;
    }
    if (b.open != null) c.open = !!b.open;
    if (b.announcement != null) c.announcement = String(b.announcement).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 240);
    saveCfg(BALL, c);
    ledger(BALL, 'settings', { actor: me.id, details: { before: { supply: before.supply, open: before.open, announcement: before.announcement }, after: { supply: c.supply, open: c.open, announcement: c.announcement } } });
    S.audit(me.id, 'admin.edition_settings', BALL, ctx.ip, { supply: c.supply, open: c.open });
    return { ok: true, edition: status(BALL) };
  });
  app.post('/api/admin/edition/release', ctx => {
    const me = owner(ctx), BALL = ballOf(ctx), c = cfgOf(BALL), add = Number(ctx.body.add);
    if (EDITION_BALLS[BALL].fixedSupply) throw bad(`${EDITION_BALLS[BALL].name} is permanently limited: it is never restocked`);
    if (!Number.isInteger(add) || add < 1 || c.supply + add > MAX_SUPPLY) throw bad('Choose how many new slots to release (a whole number, at least 1)');
    c.edition += 1; c.supply += add; c.open = true;
    c.announcement = String(ctx.body.announcement || `Edition ${c.edition} is here: ${add} new GOD OF ABSOLUTE slots.`).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 240);
    saveCfg(BALL, c);
    ledger(BALL, 'new_edition', { actor: me.id, details: { edition: c.edition, added: add, supply: c.supply } });
    S.audit(me.id, 'admin.edition_release', BALL, ctx.ip, { edition: c.edition, added: add });
    return { ok: true, edition: status(BALL) };
  });
  app.post('/api/admin/edition/tuning', ctx => {
    const me = owner(ctx), BALL = ballOf(ctx), b = ctx.body, out = {};
    if (BALL !== 'godofabsolute') throw bad('Set this ball\'s cooldowns and power in Admin → 🧬 Skills');
    if (b.xpMul != null) { const v = Number(b.xpMul); if (!(v >= 0.25 && v <= 4)) throw bad('EXP scale must be from 0.25 to 4'); setSetting('absolute_xp_mul', String(v)); core.setXpTune(v); out.xpMul = v; }
    // 2.5.0 AUTONOMOUS WILL: intelligence, personality, trips outside the arena, abilities — owner only, validated here
    const will = b.will != null && typeof b.will === 'object' ? (() => { const w = b.will, o = {};
      if (w.intelligence != null) { const v = Number(w.intelligence); if (![1, 2, 3].includes(v)) throw bad('Intelligence must be 1, 2 or 3'); o.intelligence = v; }
      if (w.aggression != null) { const v = Number(w.aggression); if (!(v >= 0 && v <= 100)) throw bad('Aggression must be from 0 to 100'); o.aggression = Math.round(v); }
      if (w.maxRealm != null) { const v = Number(w.maxRealm); if (!(v >= 3 && v <= 8)) throw bad('The longest fight outside the arena must be from 3 to 8 seconds'); o.maxRealm = Math.round(v * 10) / 10; }
      if (w.realmCd != null) { const v = Number(w.realmCd); if (!(v >= 12 && v <= 40)) throw bad('The cooldown between trips must be from 12 to 40 seconds'); o.realmCd = Math.round(v); }
      for (const k of ['transcend', 'hunt', 'retreat', 'explore', 'step', 'speech']) if (w[k] != null) o[k] = !!w[k];
      return o; })() : null;
    const nSkills = (core.getBall(BALL) || { skills: [] }).skills.length;
    const off = Array.isArray(b.off) ? [...new Set(b.off.filter(i => Number.isInteger(i) && i >= 0 && i < nSkills))].sort() : null;
    if (off && off.length >= nSkills) throw bad('Keep at least one ability switched on');
    const cdMul = b.cdMul != null ? Number(b.cdMul) : null; if (cdMul != null && !(cdMul >= 0.5 && cdMul <= 2)) throw bad('Cooldown multiplier must be from 0.5 to 2');
    if (will || off || cdMul != null) {
      const r = db.get('SELECT settings FROM admin_ball_tuning WHERE ball_id = ?', BALL); let t = {}; try { t = JSON.parse(r ? r.settings : '{}') || {}; } catch { t = {}; }
      if (will) t.will = { ...(t.will || {}), ...will }; if (off) t.off = off; if (cdMul != null) t.cdMul = Math.round(cdMul * 10) / 10;
      db.run('INSERT INTO admin_ball_tuning (ball_id, settings, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(ball_id) DO UPDATE SET settings = excluded.settings, updated_by = excluded.updated_by, updated_at = excluded.updated_at', BALL, JSON.stringify(t), me.id, now());
      Object.assign(out, { will: t.will, off: t.off, cdMul: t.cdMul });
    }
    if (b.ultDur != null) {
      const v = Math.round(Number(b.ultDur) * 10) / 10; if (!(v >= 2.4 && v <= 5)) throw bad('Ultimate duration must be from 2.4 to 5 seconds');
      const r = db.get('SELECT settings FROM admin_ball_tuning WHERE ball_id = ?', BALL); let t = {}; try { t = JSON.parse(r ? r.settings : '{}') || {}; } catch { t = {}; }
      t.ultDur = v; db.run('INSERT INTO admin_ball_tuning (ball_id, settings, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(ball_id) DO UPDATE SET settings = excluded.settings, updated_by = excluded.updated_by, updated_at = excluded.updated_at', BALL, JSON.stringify(t), me.id, now());
      out.ultDur = v;
    }
    ledger(BALL, 'settings', { actor: me.id, details: { tuning: out } });
    S.audit(me.id, 'admin.edition_tuning', BALL, ctx.ip, out);
    return { ok: true, ...out };
  });
}

module.exports = { register, EDITION_BALLS, SOLD_OUT_MSG };
