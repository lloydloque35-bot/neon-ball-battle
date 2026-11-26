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
 *
 * 2.3.1 MANUAL QR PAYMENTS (Maya / MariBank / any QR Ph app) — for owners without a registered business:
 *  - The owner uploads their own receive-money QR in the Admin Dashboard (stored in the server database, never in the
 *    game files; shown only to signed-in players who open the payment screen).
 *  - The player pays, then sends the reference number from their receipt. Nothing is unlocked by that.
 *  - The OWNER checks their own Maya / MariBank app and presses Approve (owner + 2FA, audit-logged). Only then is the
 *    ball granted. A reference number can be used only once, ever (UNIQUE in the database).
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
/** ULTIMATE PREMIUM can also be paid by QR: 365 days, no automatic renewal, price set by the owner (default PHP 499) */
const PREMIUM = { id: 'premium_year', name: 'ULTIMATE PREMIUM — 1 year', days: 365, defaultPhp: 499, minPhp: 49, maxPhp: 100000 };
const MANUAL_KINDS = { maya: 'Maya', maribank: 'MariBank', gcash: 'GCash', qrph: 'Other bank / e-wallet (QR Ph)' };
const MAX_ACCOUNTS = 4, MAX_QR_BYTES = 400 * 1024, MAX_AWAITING = 3;
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
/** player-typed reference number: spaces and dashes removed, upper case, 6–32 letters/numbers */
const normRef = v => String(v == null ? '' : v).toUpperCase().replace(/[\s\-]/g, '');
/** only real PNG / JPEG / WEBP images (checked by their first bytes, not just the name) */
function parseQrImage(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw bad('The QR must be a PNG, JPG or WEBP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 64) throw bad('That image is empty');
  if (buf.length > MAX_QR_BYTES) throw bad('The QR image must be smaller than 400 KB');
  const real = { png: buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG', jpeg: buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
    webp: buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP' }[m[1]];
  if (!real) throw bad('That file is not a real image');
  return `data:image/${m[1]};base64,${buf.toString('base64')}`;
}
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
  /** why PayMongo checkout is (not) open — shown to the owner, never any secret */
  function pmStatus() {
    const mode = keyMode(), problems = [];
    if (!mode) problems.push('PAYMONGO_SECRET_KEY is not set (sk_test_... for testing, sk_live_... for real payments)');
    if (mode === 'live' && !C.liveConfirmed) problems.push('Live payments are locked until PAYMONGO_LIVE_CONFIRMED=true (after PayMongo has verified your business)');
    if (mode === 'live' && !cfg.isProd) problems.push('Live payments only run with NODE_ENV=production');
    if (!webhookSecret()) problems.push('No webhook secret yet: register the webhook from the Admin Dashboard (or set PAYMONGO_WEBHOOK_SECRET)');
    if (!methods().length) problems.push('No payment methods selected');
    return { enabled: !problems.length, mode, problems };
  }
  /* manual QR payment settings (owner-managed, server database only) */
  function manualCfg() {
    try { const v = JSON.parse(setting('manual_pay') || 'null'); if (v && Array.isArray(v.accounts)) return { enabled: !!v.enabled, accounts: v.accounts }; } catch { /* reset below */ }
    return { enabled: false, accounts: [] };
  }
  const saveManual = m => setSetting('manual_pay', JSON.stringify({ enabled: !!m.enabled, accounts: m.accounts }));
  const manualAccounts = () => manualCfg().accounts.filter(a => MANUAL_KINDS[a.kind] && a.qr);
  const manualOpen = () => manualCfg().enabled && manualAccounts().length > 0;
  const premiumPrice = () => { const v = parseInt(setting('premium_price_php') || '', 10); return v >= PREMIUM.minPhp && v <= PREMIUM.maxPhp ? v : PREMIUM.defaultPhp; };
  const premiumView = () => ({ id: PREMIUM.id, name: PREMIUM.name, price: premiumPrice(), days: PREMIUM.days });
  S.qrPremium = () => ({ enabled: manualOpen(), ...premiumView() });
  const accountView = a => ({ id: a.id, kind: a.kind, kindName: MANUAL_KINDS[a.kind], label: a.label || MANUAL_KINDS[a.kind], name: a.name || '', note: a.note || '' });
  /** the shop is open when at least one way to pay is ready */
  function status() { const p = pmStatus(), m = manualOpen(); return { ...p, enabled: p.enabled || m, paymongo: p.enabled, manual: m }; }
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
  const requireOpen = () => { const s = pmStatus(); if (!s.enabled) throw new HttpError(503, 'The Premium God Shop is not open yet: the owner has not finished setting up payments. Nothing was charged.', 'SHOP_DISABLED'); };
  const owns = (uid, ball) => !!db.get('SELECT 1 FROM user_balls WHERE user_id = ? AND ball_id = ? AND owned = 1', uid, ball);
  const purchaseView = p => ({ id: p.id, product: p.product, name: (PRODUCTS[p.product] || (p.product === PREMIUM.id ? PREMIUM : {})).name || p.product, amount: p.amount / 100, currency: p.currency, status: p.status,
    provider: p.provider, method: p.method || null, methodName: p.provider === 'manual' ? `${MANUAL_KINDS[p.method] || p.method} (QR)` : (METHODS[p.method] || p.method || null),
    reference: p.provider === 'manual' && p.payment_ref ? p.payment_ref.slice(7) : null, createdAt: p.created_at, paidAt: p.paid_at || null, note: p.note || null });

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
    return { enabled: s.enabled, mode: s.mode, currency: 'PHP', paymongo: s.paymongo, methods: s.paymongo ? methods().map(id => ({ id, name: METHODS[id] })) : [],
      manual: { enabled: s.manual, accounts: u && s.manual ? manualAccounts().map(accountView) : [] }, premium: premiumView(),
      awaitingCount: u && u.role === 'owner' ? db.get("SELECT COUNT(*) AS n FROM shop_purchases WHERE provider = 'manual' AND status = 'awaiting'").n : undefined,
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
    if (p.status === 'pending' && p.provider === 'paymongo' && pmStatus().enabled) p = await confirmPurchase(p, 'return');
    return { purchase: purchaseView(p), owned: JSON.parse(p.balls).filter(b => owns(u.id, b)) };
  });
  /** restore purchases: re-grants everything paid and re-checks recent pending checkouts */
  app.post('/api/godshop/restore', async ctx => {
    const u = S.requireUser(ctx); S.limit(ctx, 'shoprest:' + u.id, 10, 600e3);
    const list = db.all('SELECT * FROM shop_purchases WHERE user_id = ? ORDER BY created_at', u.id);
    let restored = 0;
    for (const p of list) {
      if (p.status === 'paid') { const balls = JSON.parse(p.balls); if (!balls.every(b => owns(u.id, b))) { db.tx(() => grantBalls(u.id, balls, p.id)); restored++; } }
      else if (p.provider === 'paymongo' && (p.status === 'pending' || p.status === 'expired') && p.created_at > now() - 7 * 86400e3 && pmStatus().enabled) { const q = await confirmPurchase(p, 'restore'); if (q.status === 'paid') restored++; }
    }
    S.audit(u.id, 'shop.restore', null, ctx.ip, { restored });
    return { restored, owned: Object.values(PRODUCTS).flatMap(p => p.balls).filter((b, i, a) => a.indexOf(b) === i && owns(u.id, b)) };
  });

  /* ---------------- manual QR payment (player side): pay the owner's QR, send the reference, wait for approval ---------------- */
  app.get('/api/godshop/manual/qr/:id', ctx => {
    const u = S.requireUser(ctx); S.limit(ctx, 'shopqr:' + u.id, 40, 600e3);
    const id = String(ctx.params.id || ''), a = manualCfg().accounts.find(x => x.id === id && x.qr);
    if (!a || (!manualOpen() && u.role !== 'owner')) throw new HttpError(404, 'This payment option is not available');
    return { image: a.qr, account: accountView(a) };
  });
  app.post('/api/godshop/manual/submit', ctx => {
    const u = S.requirePlayable(ctx);
    if (!manualOpen()) throw new HttpError(503, 'QR payments are not open right now. Please do not send money yet.', 'SHOP_DISABLED');
    S.limit(ctx, 'shopman:' + u.id, 10, 3600e3, 'Too many payment reports. Please wait for the owner to check the ones you sent.');
    const pid = String(ctx.body.product || ''), isPrem = pid === PREMIUM.id;
    const P = isPrem ? { id: PREMIUM.id, name: PREMIUM.name, amount: premiumPrice() * 100, balls: [] } : PRODUCTS[pid]; if (!P) throw bad('Unknown product');
    if (u.role === 'owner') throw bad('The owner account already has every feature — nothing to buy');
    const a = manualAccounts().find(x => x.id === String(ctx.body.account || '')); if (!a) throw bad('Choose where you sent the payment');
    const have = P.balls.filter(b => owns(u.id, b));
    if (!isPrem && have.length === P.balls.length) throw new HttpError(409, 'You already own this — check "Restore purchases" if it does not show up', 'ALREADY_OWNED');
    if (!isPrem && have.length) throw new HttpError(409, 'You already own one of these balls — buy the other one on its own (PHP 99)', 'PARTLY_OWNED');
    const ref = normRef(ctx.body.reference);
    if (!/^[A-Z0-9]{6,32}$/.test(ref)) throw bad('Type the reference number from your payment receipt (6 to 32 letters or numbers)');
    const waiting = db.all("SELECT product FROM shop_purchases WHERE user_id = ? AND provider = 'manual' AND status = 'awaiting'", u.id);
    const wBalls = waiting.filter(w => w.product !== PREMIUM.id);
    if (isPrem ? waiting.some(w => w.product === PREMIUM.id) : wBalls.some(w => w.product === P.id || w.product === 'god_bundle' || P.id === 'god_bundle')) throw new HttpError(409, 'You already sent a payment for this. Please wait for the owner to check it.', 'AWAITING');
    if (waiting.length >= MAX_AWAITING) throw new HttpError(429, 'Please wait for the owner to check the payments you already sent.', 'AWAITING');
    if (db.get('SELECT 1 FROM shop_purchases WHERE payment_ref = ?', 'manual:' + ref)) {
      S.secEvent(u.id, 'shop_manual_ref_reused', 2, { ref }, ctx.ip);
      throw new HttpError(409, 'This reference number was already used. Check the number on your receipt.', 'REF_USED');
    }
    const id = S_.randomId('pur_');
    try {
      db.run("INSERT INTO shop_purchases (id, user_id, product, balls, amount, currency, provider, status, payment_ref, method, payer_note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PHP', 'manual', 'awaiting', ?, ?, ?, ?, ?)",
        id, u.id, P.id, JSON.stringify(P.balls), P.amount, 'manual:' + ref, a.kind, clean(ctx.body.note, 60) || null, now(), now());
    } catch (e) { if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'This reference number was already used. Check the number on your receipt.', 'REF_USED'); throw e; }
    S.audit(u.id, 'shop.manual_submitted', id, ctx.ip, { product: P.id, amount: P.amount, method: a.kind });
    return { purchase: purchaseView(db.get('SELECT * FROM shop_purchases WHERE id = ?', id)) };
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
    const s = status(), rows = db.all('SELECT p.*, u.username FROM shop_purchases p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 60'), M = manualCfg();
    const awaiting = db.all("SELECT p.*, u.username FROM shop_purchases p JOIN users u ON u.id = p.user_id WHERE p.provider = 'manual' AND p.status = 'awaiting' ORDER BY p.created_at LIMIT 100");
    const paid = db.get("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM shop_purchases WHERE status = 'paid'");
    return { ...s, key: mask(C.secretKey), webhookSecret: C.webhookSecret ? 'environment' : setting('paymongo_webhook_secret') ? 'saved on the server' : null,
      webhookUrl: `${cfg.appOrigin}/api/godshop/webhook/paymongo`, events: PAID_EVENTS, liveConfirmed: C.liveConfirmed,
      methods: methods(), allMethods: Object.entries(METHODS).map(([id, name]) => ({ id, name })),
      totals: { paid: paid.n, revenue: paid.total / 100 }, purchases: rows.map(p => ({ ...purchaseView(p), username: p.username, payerNote: p.payer_note || null, ref: p.provider_ref ? p.provider_ref.slice(0, 12) + '…' : null })),
      manual: { enabled: M.enabled, open: s.manual, premiumPrice: premiumPrice(), kinds: Object.entries(MANUAL_KINDS).map(([id, name]) => ({ id, name })), maxAccounts: MAX_ACCOUNTS,
        accounts: M.accounts.map(a => ({ ...accountView(a), hasQr: !!a.qr })), awaiting: awaiting.map(p => ({ ...purchaseView(p), username: p.username, payerNote: p.payer_note || null })) } };
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

  /* ---------------- owner: manual QR payments (accounts, QR images, approve / reject) ---------------- */
  app.post('/api/admin/godshop/manual/settings', ctx => {
    const me = owner(ctx), M = manualCfg(), list = Array.isArray(ctx.body.accounts) ? ctx.body.accounts.slice(0, MAX_ACCOUNTS + 1) : [];
    if (list.length > MAX_ACCOUNTS) throw bad(`At most ${MAX_ACCOUNTS} payment accounts`);
    const accounts = list.map(x => {
      if (!x || !MANUAL_KINDS[x.kind]) throw bad('Choose Maya, MariBank, GCash or Other bank for every account');
      const old = M.accounts.find(a => a.id === x.id);
      return { id: old ? old.id : S_.randomId('qa_'), kind: x.kind, label: clean(x.label, 30) || MANUAL_KINDS[x.kind], name: clean(x.name, 40), note: clean(x.note, 140), qr: old ? old.qr : null };
    });
    const enabled = !!ctx.body.enabled;
    if (enabled && !accounts.some(a => a.qr)) throw bad('Upload at least one QR code before turning QR payments on');
    if (ctx.body.premiumPricePhp != null) {
      const v = Number(ctx.body.premiumPricePhp);
      if (!Number.isInteger(v) || v < PREMIUM.minPhp || v > PREMIUM.maxPhp) throw bad(`Premium price must be a whole number from PHP ${PREMIUM.minPhp} to ${PREMIUM.maxPhp}`);
      setSetting('premium_price_php', String(v));
    }
    saveManual({ enabled, accounts });
    S.audit(me.id, 'admin.shop_manual_settings', null, ctx.ip, { enabled, premiumPrice: premiumPrice(), accounts: accounts.map(a => ({ kind: a.kind, label: a.label, qr: !!a.qr })) });
    return { ok: true, manual: { enabled, open: manualOpen(), premiumPrice: premiumPrice(), accounts: accounts.map(a => ({ ...accountView(a), hasQr: !!a.qr })) } };
  });
  app.post('/api/admin/godshop/manual/qr', { bodyLimit: 700 * 1024 }, ctx => {
    const me = owner(ctx), M = manualCfg(), a = M.accounts.find(x => x.id === String(ctx.body.account || ''));
    if (!a) throw new HttpError(404, 'Save the account first, then upload its QR');
    a.qr = ctx.body.image == null ? null : parseQrImage(ctx.body.image);
    if (!M.accounts.some(x => x.qr)) M.enabled = false;
    saveManual(M);
    S.audit(me.id, a.qr ? 'admin.shop_manual_qr_uploaded' : 'admin.shop_manual_qr_removed', a.id, ctx.ip, { kind: a.kind });
    return { ok: true, open: manualOpen() };
  });
  const manualRow = ctx => { const id = String(ctx.params.id || ''); if (!S_.isId(id)) throw bad('Bad payment id'); const p = db.get('SELECT * FROM shop_purchases WHERE id = ?', id); if (!p || p.provider !== 'manual') throw new HttpError(404, 'Payment not found'); return p; };
  /** the ONLY way a manual payment unlocks a ball: the owner saw the money in their own app and approved it */
  app.post('/api/admin/godshop/manual/:id/approve', ctx => {
    const me = owner(ctx), p0 = manualRow(ctx);
    db.tx(() => {
      const p = db.get('SELECT * FROM shop_purchases WHERE id = ?', p0.id);
      if (p.status === 'paid') throw new HttpError(409, 'This payment was already approved');
      if (p.status !== 'awaiting' && p.status !== 'rejected') throw bad('This payment cannot be approved');
      const prem = p.product === PREMIUM.id, balls = JSON.parse(p.balls), already = !prem && balls.every(b => owns(p.user_id, b));
      db.run("UPDATE shop_purchases SET status = 'paid', paid_at = ?, updated_at = ?, reviewed_by = ?, reviewed_at = ?, note = ? WHERE id = ?", now(), now(), me.id, now(),
        already ? 'The player already owned this — please refund this payment' : null, p.id);
      if (prem) { if (!S.grantPremiumQr) throw new HttpError(500, 'Premium is not available on this server'); S.grantPremiumQr(p.user_id, PREMIUM.days, p.id, p.amount); }
      else grantBalls(p.user_id, balls, p.id);
      S.audit(me.id, 'shop.manual_approved', p.id, ctx.ip, { user: p.user_id, product: p.product, amount: p.amount, method: p.method, ref: p.payment_ref, duplicate: already });
    });
    return { ok: true, purchase: purchaseView(db.get('SELECT * FROM shop_purchases WHERE id = ?', p0.id)) };
  });
  app.post('/api/admin/godshop/manual/:id/reject', ctx => {
    const me = owner(ctx), p = manualRow(ctx);
    if (p.status !== 'awaiting') throw bad('Only payments that are waiting can be rejected');
    const reason = clean(ctx.body.reason, 120) || 'The payment was not found';
    db.run("UPDATE shop_purchases SET status = 'rejected', note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'awaiting'", reason, me.id, now(), now(), p.id);
    S.audit(me.id, 'shop.manual_rejected', p.id, ctx.ip, { user: p.user_id, product: p.product, ref: p.payment_ref, reason });
    S.secEvent(p.user_id, 'shop_manual_rejected', 1, { purchase: p.id });
    return { ok: true, purchase: purchaseView(db.get('SELECT * FROM shop_purchases WHERE id = ?', p.id)) };
  });
}

module.exports = { register, PRODUCTS, PREMIUM, METHODS, MANUAL_KINDS, verifyPaymongoSignature, parseQrImage, normRef };
