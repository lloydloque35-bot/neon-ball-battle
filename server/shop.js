'use strict';
/**
 * PREMIUM GOD BALL SHOP — one-time purchases in Philippine pesos through PayMongo hosted checkout
 * (GCash, Maya, QR Ph, cards, online banking — whatever is enabled on the owner's PayMongo account).
 *
 *  - God of Guns PHP 99, God Portal PHP 99, both together PHP 198. Permanent ownership on the player's account.
 *  - A ball is granted ONLY after the server itself has fetched the checkout session from PayMongo and seen a
 *    paid payment of the right amount and currency for that exact purchase. The browser's return page,
 *    and even the webhook body, are never trusted on their own: the webhook (signature-verified) only triggers
 *    that server-side check.
 *  - Every webhook event is processed once; every PayMongo payment can complete only one purchase; a player can
 *    never start a purchase for a ball they already own; pending checkouts are reused instead of duplicated.
 *  - Card numbers, wallet logins, PINs and OTPs never reach this server (PayMongo-hosted pages).
 *    Secret keys live in environment variables (or, for the webhook secret, the server database) — never in the game files.
 *  - If PayMongo is not configured, checkout is unavailable. Purchases are never simulated.
 */
const crypto = require('node:crypto');
const S_ = require('./security');
const { HttpError, bad } = require('./http');

const PRODUCTS = {
  godofguns: { id: 'godofguns', name: 'God of Guns Ball', amount: 9900, balls: ['godofguns'] },
  godportal: { id: 'godportal', name: 'God Portal Ball', amount: 9900, balls: ['godportal'] },
  god_bundle: { id: 'god_bundle', name: 'God of Guns + God Portal', amount: 19800, balls: ['godofguns', 'godportal'] },
};
const METHODS = { gcash: 'GCash', paymaya: 'Maya', qrph: 'QR Ph (bank & e-wallet apps)', dob: 'Online banking (BPI / UnionBank)', card: 'Credit / debit card', grab_pay: 'GrabPay', billease: 'BillEase' };
const PAID_EVENTS = ['checkout_session.payment.paid'];
const now = () => Date.now();

/** Paymongo-Signature: "t=<unix>,te=<test sig>,li=<live sig>"; sig = hex HMAC-SHA256(`${t}.${rawBody}`, webhook secret) */
function verifyPaymongoSignature(raw, header, secret, livemode, toleranceSec = 300, t0 = now()) {
  if (!header || !secret) return false;
  const parts = {}; for (const p of String(header).split(',')) { const i = p.indexOf('='); if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
  const ts = Number(parts.t), sig = livemode ? parts.li : parts.te;
  if (!ts || !sig || Math.abs(t0 / 1000 - ts) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  return S_.safeEqual(sig, expected);
}

function register(app, S) {
  const { db, cfg } = S;
  const C = cfg.shop;
  const setting = k => { const r = db.get('SELECT value FROM app_settings WHERE key = ?', k); return r ? r.value : null; };
  const setSetting = (k, v) => db.run('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', k, v, now());
  const keyMode = () => C.secretKey.startsWith('sk_live_') ? 'live' : C.secretKey.startsWith('sk_test_') ? 'test' : null;
  const webhookSecret = () => C.webhookSecret || setting('paymongo_webhook_secret') || '';
  const methods = () => { const m = (setting('paymongo_methods') || '').split(',').filter(x => METHODS[x]); return m.length ? m : C.methods.filter(x => METHODS[x]); };
  /** why the shop is (not) open — shown to the owner, never any secret */
  function status() {
    const mode = keyMode(), problems = [];
    if (!mode) problems.push('PAYMONGO_SECRET_KEY is not set (sk_test_... for testing, sk_live_... for real payments)');
    if (mode === 'live' && !C.liveConfirmed) problems.push('Live payments are locked until PAYMONGO_LIVE_CONFIRMED=true (after PayMongo has verified your business)');
    if (mode === 'live' && !cfg.isProd) problems.push('Live payments only run with NODE_ENV=production');
    if (!webhookSecret()) problems.push('No webhook secret yet: register the webhook from the Admin Dashboard (or set PAYMONGO_WEBHOOK_SECRET)');
    if (!methods().length) problems.push('No payment methods selected');
    return { enabled: !problems.length, mode, problems };
  }
  S.shopStatus = status;

  async function paymongo(method, path, body) {
    const headers = { Authorization: 'Basic ' + Buffer.from(C.secretKey + ':').toString('base64'), Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    let r, data = {};
    try { r = await fetch(`${C.apiBase}/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) }); data = await r.json().catch(() => ({})); }
    catch (e) { S.log.error('[paymongo]', path, e.message); throw new HttpError(502, 'The payment provider could not be reached. You were not charged.', 'PROVIDER'); }
    if (!r.ok) { const msg = data.errors && data.errors[0] && (data.errors[0].detail || data.errors[0].code); S.log.error('[paymongo]', r.status, path, msg); throw new HttpError(502, 'The payment provider refused the request. You were not charged.', 'PROVIDER'); }
    return data;
  }
  const requireOpen = () => { const s = status(); if (!s.enabled) throw new HttpError(503, 'The Premium God Shop is not open yet: the owner has not finished setting up payments. Nothing was charged.', 'SHOP_DISABLED'); };
  const owns = (uid, ball) => !!db.get('SELECT 1 FROM user_balls WHERE user_id = ? AND ball_id = ? AND owned = 1', uid, ball);
  const purchaseView = p => ({ id: p.id, product: p.product, name: (PRODUCTS[p.product] || {}).name || p.product, amount: p.amount / 100, currency: p.currency, status: p.status, method: p.method || null, createdAt: p.created_at, paidAt: p.paid_at || null, note: p.note || null });

  function grantBalls(uid, balls, purchaseId) {
    for (const ball of balls) db.run(`INSERT INTO user_balls (user_id, ball_id, owned, source, unlocked_at) VALUES (?, ?, 1, 'purchase', ?)
      ON CONFLICT(user_id, ball_id) DO UPDATE SET owned = 1, source = COALESCE(user_balls.source, 'purchase'), unlocked_at = COALESCE(user_balls.unlocked_at, excluded.unlocked_at)`, uid, ball, now());
    S.audit(uid, 'shop.balls_granted', purchaseId, null, { balls });
  }
  /** the ONLY place a purchase becomes paid: PayMongo's own record of the checkout session must show the payment */
  async function confirmPurchase(p, source) {
    if (!p || p.status === 'paid' || !p.provider_ref) return p;
    const sess = await paymongo('GET', `checkout_sessions/${encodeURIComponent(p.provider_ref)}`);
    const A = (sess.data && sess.data.attributes) || {};
    if ((sess.data && sess.data.id) !== p.provider_ref || (A.reference_number && A.reference_number !== p.id) || (A.metadata && A.metadata.purchase_id && A.metadata.purchase_id !== p.id)) {
      S.secEvent(p.user_id, 'shop_session_mismatch', 3, { purchase: p.id, source }); return p;
    }
    const paid = (A.payments || []).filter(x => x && x.attributes && x.attributes.status === 'paid');
    if (!paid.length) {
      if (A.status === 'expired') db.run("UPDATE shop_purchases SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending'", now(), p.id);
      return db.get('SELECT * FROM shop_purchases WHERE id = ?', p.id);
    }
    const total = paid.reduce((s, x) => s + (x.attributes.amount | 0), 0), cur = paid.every(x => String(x.attributes.currency || '').toUpperCase() === p.currency);
    const pay = paid[0], ref = pay.id, method = (pay.attributes.source && pay.attributes.source.type) || (pay.attributes.payment_method_details && pay.attributes.payment_method_details.type) || null;
    if (!cur || total < p.amount) {
      db.run("UPDATE shop_purchases SET status = 'review', note = ?, updated_at = ? WHERE id = ?", `amount mismatch: ${total} ${paid[0].attributes.currency}`, now(), p.id);
      S.secEvent(p.user_id, 'shop_amount_mismatch', 3, { purchase: p.id, total, expected: p.amount, source });
      return db.get('SELECT * FROM shop_purchases WHERE id = ?', p.id);
    }
    db.tx(() => {
      const cur2 = db.get('SELECT status FROM shop_purchases WHERE id = ?', p.id); if (cur2.status === 'paid') return;
      if (db.get('SELECT 1 FROM shop_purchases WHERE payment_ref = ? AND id != ?', ref, p.id)) { S.secEvent(p.user_id, 'shop_payment_reused', 3, { purchase: p.id, ref }); db.run("UPDATE shop_purchases SET status = 'review', note = 'payment already used by another purchase', updated_at = ? WHERE id = ?", now(), p.id); return; }
      const balls = JSON.parse(p.balls), already = balls.every(b => owns(p.user_id, b));
      db.run("UPDATE shop_purchases SET status = 'paid', payment_ref = ?, method = ?, livemode = ?, paid_at = ?, updated_at = ?, note = ? WHERE id = ?", ref, method, A.livemode ? 1 : 0, now(), now(),
        already ? 'Paid twice for a ball already owned — refund this payment from the PayMongo dashboard' : null, p.id);
      grantBalls(p.user_id, balls, p.id);
      S.audit(p.user_id, 'shop.purchase_paid', p.id, null, { product: p.product, amount: p.amount, method, source, duplicate: already });
      if (already) S.secEvent(p.user_id, 'shop_duplicate_payment', 2, { purchase: p.id });
    });
    return db.get('SELECT * FROM shop_purchases WHERE id = ?', p.id);
  }

  /* ---------------- player API ---------------- */
  app.get('/api/godshop', ctx => {
    const s = status(), u = ctx.user;
    return { enabled: s.enabled, mode: s.mode, currency: 'PHP', methods: methods().map(id => ({ id, name: METHODS[id] })),
      products: Object.values(PRODUCTS).map(p => ({ id: p.id, name: p.name, price: p.amount / 100, balls: p.balls, owned: u ? p.balls.every(b => owns(u.id, b) || u.role === 'owner') : false })) };
  });
  app.post('/api/godshop/checkout', async ctx => {
    const u = S.requirePlayable(ctx); requireOpen();
    S.limit(ctx, 'shopco:' + u.id, 6, 600e3);
    const P = PRODUCTS[String(ctx.body.product || '')]; if (!P) throw bad('Unknown product');
    if (u.role === 'owner') throw bad('The owner account already has every ball — nothing to buy');
    const have = P.balls.filter(b => owns(u.id, b));
    if (have.length === P.balls.length) throw new HttpError(409, 'You already own this — check "Restore purchases" if it does not show up', 'ALREADY_OWNED');
    if (have.length) throw new HttpError(409, 'You already own one of these balls — buy the other one on its own (PHP 99)', 'PARTLY_OWNED');
    const open = db.get("SELECT * FROM shop_purchases WHERE user_id = ? AND product = ? AND status = 'pending' AND checkout_url IS NOT NULL AND created_at > ? ORDER BY created_at DESC", u.id, P.id, now() - 20 * 60e3);
    if (open) return { url: open.checkout_url, purchaseId: open.id, reused: true };
    const id = S_.randomId('pur_'), ms = methods();
    db.run("INSERT INTO shop_purchases (id, user_id, product, balls, amount, currency, provider, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PHP', 'paymongo', 'creating', ?, ?)", id, u.id, P.id, JSON.stringify(P.balls), P.amount, now(), now());
    let sess;
    try {
      sess = await paymongo('POST', 'checkout_sessions', { data: { attributes: {
        line_items: [{ name: P.name, amount: P.amount, currency: 'PHP', quantity: 1, description: 'Premium God Ball — permanent ownership' }],
        payment_method_types: ms, reference_number: id, description: `NEON BALL BATTLE — ${P.name}`, send_email_receipt: false, show_description: true, show_line_items: true,
        success_url: `${cfg.appOrigin}/?purchase=${id}#godshop`, cancel_url: `${cfg.appOrigin}/?purchase=${id}&cancelled=1#godshop`,
        metadata: { purchase_id: id, user_id: String(u.id), product: P.id } } } });
    } catch (e) { db.run("UPDATE shop_purchases SET status = 'failed', note = 'checkout could not be created', updated_at = ? WHERE id = ?", now(), id); throw e; }
    const sid = sess.data && sess.data.id, url = sess.data && sess.data.attributes && sess.data.attributes.checkout_url;
    if (!sid || !/^https:\/\//.test(String(url || ''))) { db.run("UPDATE shop_purchases SET status = 'failed', updated_at = ? WHERE id = ?", now(), id); throw new HttpError(502, 'The payment provider returned an unexpected answer. You were not charged.', 'PROVIDER'); }
    db.run("UPDATE shop_purchases SET status = 'pending', provider_ref = ?, checkout_url = ?, updated_at = ? WHERE id = ?", sid, url, now(), id);
    S.audit(u.id, 'shop.checkout_started', id, ctx.ip, { product: P.id, amount: P.amount });
    return { url, purchaseId: id };
  });
  app.get('/api/godshop/purchases', ctx => {
    const u = S.requireUser(ctx);
    return { purchases: db.all('SELECT * FROM shop_purchases WHERE user_id = ? AND status != \'creating\' ORDER BY created_at DESC LIMIT 50', u.id).map(purchaseView) };
  });
  /** after returning from the checkout page: asks PayMongo (server-side) whether this purchase was paid */
  app.post('/api/godshop/purchases/:id/check', async ctx => {
    const u = S.requireUser(ctx); S.limit(ctx, 'shopchk:' + u.id, 30, 300e3);
    const id = String(ctx.params.id || ''); if (!S_.isId(id)) throw bad('Bad purchase id');
    let p = db.get('SELECT * FROM shop_purchases WHERE id = ? AND user_id = ?', id, u.id); if (!p) throw new HttpError(404, 'Purchase not found');
    if (p.status === 'pending' && status().enabled) p = await confirmPurchase(p, 'return');
    return { purchase: purchaseView(p), owned: JSON.parse(p.balls).filter(b => owns(u.id, b)) };
  });
  /** restore purchases: re-grants everything paid and re-checks recent pending checkouts */
  app.post('/api/godshop/restore', async ctx => {
    const u = S.requireUser(ctx); S.limit(ctx, 'shoprest:' + u.id, 10, 600e3);
    const list = db.all('SELECT * FROM shop_purchases WHERE user_id = ? ORDER BY created_at', u.id);
    let restored = 0;
    for (const p of list) {
      if (p.status === 'paid') { const balls = JSON.parse(p.balls); if (!balls.every(b => owns(u.id, b))) { db.tx(() => grantBalls(u.id, balls, p.id)); restored++; } }
      else if ((p.status === 'pending' || p.status === 'expired') && p.created_at > now() - 7 * 86400e3 && status().enabled) { const q = await confirmPurchase(p, 'restore'); if (q.status === 'paid') restored++; }
    }
    S.audit(u.id, 'shop.restore', null, ctx.ip, { restored });
    return { restored, owned: Object.values(PRODUCTS).flatMap(p => p.balls).filter((b, i, a) => a.indexOf(b) === i && owns(u.id, b)) };
  });

  /* ---------------- PayMongo webhook (signature verified, each event once) ---------------- */
  app.post('/api/godshop/webhook/paymongo', { raw: true, noCsrf: true, bodyLimit: 512 * 1024 }, async ctx => {
    const raw = ctx.raw.toString('utf8');
    let evt; try { evt = JSON.parse(raw); } catch { throw bad('Invalid payload'); }
    const E = evt && evt.data, A = E && E.attributes;
    if (!E || !E.id || !A || !A.type) throw bad('Invalid event');
    if (!verifyPaymongoSignature(raw, ctx.headers['paymongo-signature'] || ctx.headers['x-paymongo-signature'], webhookSecret(), !!A.livemode)) {
      S.secEvent(null, 'shop_webhook_bad_signature', 3, { type: A.type }, ctx.ip);
      throw new HttpError(400, 'Invalid signature');
    }
    if ((keyMode() === 'live') !== !!A.livemode) return { ignored: 'event from the other mode' };
    const seen = db.get('SELECT processed_at FROM shop_events WHERE id = ?', E.id);
    if (seen && seen.processed_at) return { duplicate: true };
    if (!seen) db.run('INSERT INTO shop_events (id, type, received_at) VALUES (?, ?, ?)', E.id, A.type, now());
    try {
      if (PAID_EVENTS.includes(A.type)) {
        const sid = A.data && A.data.id, p = sid ? db.get('SELECT * FROM shop_purchases WHERE provider_ref = ?', sid) : null;
        if (!p) S.secEvent(null, 'shop_webhook_unknown_session', 1, { sid: String(sid || '').slice(0, 40) }, ctx.ip);
        else await confirmPurchase(p, 'webhook');
      }
      db.run('UPDATE shop_events SET processed_at = ?, error = NULL WHERE id = ?', now(), E.id);
    } catch (e) {
      db.run('UPDATE shop_events SET error = ? WHERE id = ?', String(e.message).slice(0, 300), E.id);
      S.log.error('[shop webhook]', A.type, e.message);
      throw new HttpError(500, 'Webhook processing failed');      // PayMongo retries
    }
    return { received: true };
  });

  /* ---------------- owner: setup & transactions (owner + recent 2FA, audit-logged) ---------------- */
  const owner = ctx => S.requireOwner(ctx);
  const mask = k => k ? k.slice(0, 8) + '••••' + k.slice(-4) : null;
  app.get('/api/admin/godshop', ctx => {
    owner(ctx);
    const s = status(), rows = db.all('SELECT p.*, u.username FROM shop_purchases p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 60');
    const paid = db.get("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM shop_purchases WHERE status = 'paid'");
    return { ...s, key: mask(C.secretKey), webhookSecret: C.webhookSecret ? 'environment' : setting('paymongo_webhook_secret') ? 'saved on the server' : null,
      webhookUrl: `${cfg.appOrigin}/api/godshop/webhook/paymongo`, events: PAID_EVENTS, liveConfirmed: C.liveConfirmed,
      methods: methods(), allMethods: Object.entries(METHODS).map(([id, name]) => ({ id, name })),
      totals: { paid: paid.n, revenue: paid.total / 100 }, purchases: rows.map(p => ({ ...purchaseView(p), username: p.username, ref: p.provider_ref ? p.provider_ref.slice(0, 12) + '…' : null })) };
  });
  app.post('/api/admin/godshop/test', async ctx => {
    const me = owner(ctx); if (!keyMode()) throw bad('Set PAYMONGO_SECRET_KEY first');
    const r = await paymongo('GET', 'webhooks');
    S.audit(me.id, 'admin.shop_test', null, ctx.ip);
    return { ok: true, mode: keyMode(), webhooks: (r.data || []).map(w => ({ url: w.attributes && w.attributes.url, status: w.attributes && w.attributes.status, events: w.attributes && w.attributes.events })) };
  });
  app.post('/api/admin/godshop/register-webhook', async ctx => {
    const me = owner(ctx); if (!keyMode()) throw bad('Set PAYMONGO_SECRET_KEY first');
    if (!/^https:\/\//.test(cfg.appOrigin)) throw bad('APP_ORIGIN must be your public https:// address so PayMongo can reach the webhook');
    const r = await paymongo('POST', 'webhooks', { data: { attributes: { url: `${cfg.appOrigin}/api/godshop/webhook/paymongo`, events: PAID_EVENTS } } });
    const secret = r.data && r.data.attributes && r.data.attributes.secret_key;
    if (!secret) throw new HttpError(502, 'PayMongo did not return a webhook secret', 'PROVIDER');
    setSetting('paymongo_webhook_secret', secret);        // kept on the server only — never sent to any browser
    S.audit(me.id, 'admin.shop_webhook_registered', r.data.id, ctx.ip);
    return { ok: true, status: status() };
  });
  app.post('/api/admin/godshop/methods', ctx => {
    const me = owner(ctx), list = Array.isArray(ctx.body.methods) ? [...new Set(ctx.body.methods.filter(m => METHODS[m]))] : [];
    if (!list.length) throw bad('Choose at least one payment method');
    setSetting('paymongo_methods', list.join(','));
    S.audit(me.id, 'admin.shop_methods', null, ctx.ip, { methods: list });
    return { ok: true, methods: list };
  });
}

module.exports = { register, PRODUCTS, METHODS, verifyPaymongoSignature };
