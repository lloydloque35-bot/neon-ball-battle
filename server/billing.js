'use strict';
/**
 * ULTIMATE PREMIUM — $200 USD / year (365-day billing period), Stripe Checkout + signed webhooks.
 *
 *  - Premium is activated ONLY by a signature-verified `invoice.paid` webhook from Stripe.
 *    The browser can never mark itself premium.
 *  - Each webhook event id is processed exactly once (duplicate protection); payment references are unique.
 *  - No card data ever touches this server (Stripe-hosted checkout). Secret keys stay in environment variables.
 *  - Statuses: free, pending, active, expired, cancelled, refunded, payment_failed.
 *  - Auto-renewal is disclosed before checkout and can be turned off at any time (access continues until the period ends).
 *  - Premium NEVER grants admin permissions; the owner already has every feature without a subscription.
 */
const crypto = require('node:crypto');
const S_ = require('./security');
const { HttpError, bad } = require('./http');

const PLAN = { id: 'ultimate_premium', name: 'ULTIMATE PREMIUM', priceUsd: 200, priceCents: 20000, currency: 'usd', interval: 'year', durationDays: 365 };
const BENEFITS = [
  'Unlock every regular, premium, legendary, mythical and non-admin limited ball',
  '2,000 free coins every month',
  'Premium balls at full power: Lv 50, fully evolved, every upgrade',
  'All standard battle modes', 'Premium cosmetics: Golden Aura, Gilded Skin, Prism Trail, Holy Hits, Supernova Victory',
  'Premium particle effects and a Premium profile badge', '+25% coins and EXP from verified battles, +50% daily coins',
  '20% off summon orbs', 'Premium-exclusive limited events', 'No advertisements (the game has none)',
];
const now = () => Date.now();

function verifyStripeSignature(raw, header, secret, toleranceSec = 300, t0 = now()) {
  if (!header || !secret) return false;
  let ts = null; const sigs = [];
  for (const part of String(header).split(',')) { const [k, v] = part.split('='); if (k === 't') ts = Number(v); else if (k === 'v1' && v) sigs.push(v); }
  if (!ts || !sigs.length || Math.abs(t0 / 1000 - ts) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  return sigs.some(s => S_.safeEqual(s, expected));
}
function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object') flatten(v, key, out); else if (v !== undefined && v !== null) out.push([key, String(v)]);
  }
  return out;
}

function register(app, S) {
  const { db, cfg } = S;
  const P = cfg.payments, enabled = P.mode === 'test' || P.mode === 'live';

  S.premiumOf = userId => {
    const s = db.get('SELECT * FROM subscriptions WHERE user_id = ?', userId) || { status: 'free' };
    const active = s.status === 'active' && (s.current_period_end || 0) > now();
    return { active, status: s.status, startedAt: s.started_at || null, expiresAt: s.current_period_end || null, autoRenew: !!s.auto_renew, provider: s.provider || null,
      remainingDays: active ? Math.ceil((s.current_period_end - now()) / 86400e3) : 0 };
  };
  S.paymentsPublic = () => ({ enabled, mode: P.mode, priceUsd: PLAN.priceUsd, interval: PLAN.interval, autoRenew: P.autoRenew });

  const subOf = uid => db.get('SELECT * FROM subscriptions WHERE user_id = ?', uid);
  function setSub(uid, fields) {
    if (!subOf(uid)) db.run("INSERT INTO subscriptions (user_id, status, updated_at) VALUES (?, 'free', ?)", uid, now());
    const keys = Object.keys(fields);
    db.run(`UPDATE subscriptions SET ${keys.map(k => k + ' = ?').join(', ')}, updated_at = ? WHERE user_id = ?`, ...keys.map(k => fields[k]), now(), uid);
  }
  function recordPayment(uid, ref, kind, amount, status, description, currency = 'usd') {
    db.run(`INSERT INTO payments (user_id, provider, provider_ref, kind, amount_cents, currency, status, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_ref) DO UPDATE SET status = excluded.status`, uid, kind === 'promo' ? 'promo' : 'stripe', ref, kind, amount, currency, status, description || null, now());
  }
  /** promotional premium granted by the owner (audited, $0) */
  S.grantPremium = (uid, days, actorId) => {
    const cur = subOf(uid), base = cur && cur.status === 'active' && cur.current_period_end > now() ? cur.current_period_end : now();
    setSub(uid, { status: 'active', provider: cur && cur.provider === 'stripe' && cur.status === 'active' ? 'stripe' : 'promo', started_at: cur?.started_at || now(), current_period_end: base + days * 86400e3, auto_renew: cur?.provider === 'stripe' ? cur.auto_renew : 0 });
    recordPayment(uid, 'promo_' + S_.randomToken(9), 'promo', 0, 'granted', `${days} days promotional premium (granted by owner #${actorId})`);
  };

  /** ULTIMATE PREMIUM paid by QR (PHP) — called only from the owner's Approve in the God Shop panel. Adds `days` to any active period, never renews by itself. */
  S.grantPremiumQr = (uid, days, ref, amountCentavos) => {
    const cur = subOf(uid), active = !!(cur && cur.status === 'active' && cur.current_period_end > now()), stripe = active && cur.provider === 'stripe';
    setSub(uid, { status: 'active', provider: stripe ? 'stripe' : 'qr', started_at: active ? cur.started_at : now(), current_period_end: (active ? cur.current_period_end : now()) + days * 86400e3, auto_renew: stripe ? cur.auto_renew : 0 });
    db.run("INSERT INTO payments (user_id, provider, provider_ref, kind, amount_cents, currency, status, description, created_at) VALUES (?, 'qr', ?, 'checkout', ?, 'php', 'paid', ?, ?)",
      uid, ref, amountCentavos, `ULTIMATE PREMIUM — ${days} days (QR payment approved by the owner)`, now());
  };

  async function stripe(method, path, params, idem) {
    const headers = { Authorization: `Bearer ${P.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' };
    if (idem) headers['Idempotency-Key'] = idem;
    const r = await fetch(`${P.apiBase}/v1/${path}`, { method, headers, body: params ? new URLSearchParams(flatten(params)).toString() : undefined });
    let data = {}; try { data = await r.json(); } catch { /* empty */ }
    if (!r.ok) { S.log.error('[stripe]', r.status, data.error && data.error.message); throw new HttpError(502, 'The payment provider is unavailable. You were not charged.', 'PROVIDER'); }
    return data;
  }
  const requireEnabled = () => { if (!enabled) throw new HttpError(503, 'Premium checkout is not available yet. The owner has not finished payment setup.', 'PAYMENTS_DISABLED'); };

  /* ---------- membership dashboard ---------- */
  app.get('/api/billing/status', ctx => {
    const u = S.requireUser(ctx);
    const history = db.all('SELECT provider_ref, kind, amount_cents, currency, status, description, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', u.id)
      .map(p => ({ ref: p.provider_ref.slice(0, 14) + '…', kind: p.kind, amount: p.amount_cents / 100, currency: p.currency.toUpperCase(), status: p.status, description: p.description, at: p.created_at }));
    return {
      plan: { ...PLAN, autoRenew: P.autoRenew, benefits: BENEFITS,
        disclosure: `ULTIMATE PREMIUM costs $${PLAN.priceUsd} USD per year (365 days). ${P.autoRenew ? 'It renews automatically every year until you turn renewal off. You can turn off renewal at any time and keep Premium until the end of the paid year.' : 'It does not renew automatically.'} Premium never includes admin access or admin-exclusive balls.` },
      payments: S.paymentsPublic(), qr: S.qrPremium ? S.qrPremium() : null, subscription: S.premiumOf(u.id), owner: u.role === 'owner', history,
    };
  });

  app.post('/api/billing/checkout', async ctx => {
    const u = S.requirePlayable(ctx); requireEnabled();
    S.limit(ctx, 'checkout:' + u.id, 5, 600e3);
    if (u.role === 'owner') throw bad('The owner account already has every feature — no subscription needed');
    if (S.premiumOf(u.id).active) throw new HttpError(409, 'You already have an active Premium membership', 'ACTIVE');
    const sub = subOf(u.id);
    const params = {
      mode: 'subscription', 'line_items': [{ price: P.priceId, quantity: 1 }], client_reference_id: String(u.id),
      success_url: `${cfg.appOrigin}/#billing=success`, cancel_url: `${cfg.appOrigin}/#billing=cancel`,
      metadata: { user_id: String(u.id) }, subscription_data: { metadata: { user_id: String(u.id) } },
    };
    if (sub && sub.provider_customer) params.customer = sub.provider_customer;
    const session = await stripe('POST', 'checkout/sessions', params, `checkout_${u.id}_${Math.floor(now() / 60000)}`);
    db.tx(() => {
      recordPayment(u.id, session.id, 'checkout', PLAN.priceCents, 'pending', 'ULTIMATE PREMIUM checkout started');
      if (!S.premiumOf(u.id).active) setSub(u.id, { status: 'pending' });
    });
    S.audit(u.id, 'billing.checkout_started', session.id, ctx.ip);
    return { url: session.url };
  });

  async function setRenewal(ctx, renew) {
    const u = S.requireUser(ctx); requireEnabled();
    const sub = subOf(u.id);
    if (!sub || sub.provider !== 'stripe' || !sub.provider_subscription || !S.premiumOf(u.id).active) throw bad('No renewable Premium subscription');
    await stripe('POST', `subscriptions/${encodeURIComponent(sub.provider_subscription)}`, { cancel_at_period_end: renew ? 'false' : 'true' });
    setSub(u.id, { auto_renew: renew ? 1 : 0 });
    S.audit(u.id, renew ? 'billing.renewal_on' : 'billing.renewal_off', sub.provider_subscription, ctx.ip);
    return { subscription: S.premiumOf(u.id) };
  }
  app.post('/api/billing/cancel', ctx => setRenewal(ctx, false));
  app.post('/api/billing/resume', ctx => setRenewal(ctx, true));

  /* ---------- Stripe webhook (signature verified, idempotent) ---------- */
  app.post('/api/billing/webhook', { raw: true, noCsrf: true, bodyLimit: 1024 * 1024 }, ctx => {
    if (!enabled) throw new HttpError(503, 'Payments disabled');
    const raw = ctx.raw.toString('utf8');
    if (!verifyStripeSignature(raw, ctx.headers['stripe-signature'], P.webhookSecret)) {
      S.secEvent(null, 'webhook_bad_signature', 3, {}, ctx.ip);
      throw new HttpError(400, 'Invalid signature');
    }
    let evt; try { evt = JSON.parse(raw); } catch { throw bad('Invalid payload'); }
    if (!evt || !evt.id || !evt.type) throw bad('Invalid event');
    if (P.mode === 'live' && evt.livemode === false) return { ignored: 'test event in live mode' };
    if (P.mode === 'test' && evt.livemode === true) return { ignored: 'live event in test mode' };
    const seen = db.get('SELECT processed_at FROM webhook_events WHERE id = ?', evt.id);
    if (seen && seen.processed_at) return { duplicate: true };
    if (!seen) db.run('INSERT INTO webhook_events (id, type, received_at) VALUES (?, ?, ?)', evt.id, evt.type, now());
    try {
      db.tx(() => handleEvent(evt));
      db.run('UPDATE webhook_events SET processed_at = ?, error = NULL WHERE id = ?', now(), evt.id);
    } catch (e) {
      db.run('UPDATE webhook_events SET error = ? WHERE id = ?', String(e.message).slice(0, 300), evt.id);
      S.log.error('[webhook]', evt.type, e.message);
      throw new HttpError(500, 'Webhook processing failed');   // Stripe retries
    }
    return { received: true };
  });

  function userFrom(obj) {
    const meta = obj.metadata || obj.subscription_details?.metadata || obj.lines?.data?.[0]?.metadata || {};
    const id = Number(meta.user_id || obj.client_reference_id);
    if (id && db.get('SELECT 1 FROM users WHERE id = ?', id)) return id;
    const subId = typeof obj.subscription === 'string' ? obj.subscription : (obj.object === 'subscription' ? obj.id : null);
    if (subId) { const r = db.get('SELECT user_id FROM subscriptions WHERE provider_subscription = ?', subId); if (r) return r.user_id; }
    if (obj.customer) { const r = db.get('SELECT user_id FROM subscriptions WHERE provider_customer = ?', obj.customer); if (r) return r.user_id; }
    return null;
  }
  function handleEvent(evt) {
    const o = evt.data && evt.data.object || {};
    switch (evt.type) {
      case 'checkout.session.completed': {
        const uid = userFrom(o); if (!uid) throw new Error('checkout without user');
        const fields = { provider: 'stripe' };
        if (o.customer) fields.provider_customer = o.customer;
        if (o.subscription) fields.provider_subscription = o.subscription;
        setSub(uid, fields);
        recordPayment(uid, o.id, 'checkout', o.amount_total ?? PLAN.priceCents, o.payment_status === 'paid' ? 'completed' : 'awaiting_payment', 'Checkout completed');
        S.audit(uid, 'billing.checkout_completed', o.id);
        break;
      }
      case 'invoice.paid': case 'invoice.payment_succeeded': {
        const uid = userFrom(o); if (!uid) throw new Error('invoice without user');
        const line = o.lines && o.lines.data && o.lines.data[0];
        const periodEnd = line && line.period && line.period.end ? line.period.end * 1000 : now() + PLAN.durationDays * 86400e3;
        if ((o.currency || 'usd') !== 'usd' || (o.amount_paid ?? PLAN.priceCents) < PLAN.priceCents * 0.5) S.secEvent(uid, 'billing_unexpected_amount', 2, { invoice: o.id, amount: o.amount_paid, currency: o.currency });
        const cur = subOf(uid) || {};
        setSub(uid, { status: 'active', provider: 'stripe', provider_customer: o.customer || cur.provider_customer || null, provider_subscription: o.subscription || cur.provider_subscription || null,
          started_at: cur.started_at || now(), current_period_end: Math.max(periodEnd, cur.status === 'active' && cur.provider === 'promo' ? cur.current_period_end : 0), auto_renew: cur.auto_renew === 0 && cur.status === 'active' ? 0 : (P.autoRenew ? 1 : 0) });
        recordPayment(uid, o.id, 'invoice', o.amount_paid ?? PLAN.priceCents, 'paid', 'ULTIMATE PREMIUM — 1 year', o.currency || 'usd');
        S.audit(uid, 'billing.premium_activated', o.id, null, { until: periodEnd });
        break;
      }
      case 'invoice.payment_failed': {
        const uid = userFrom(o); if (!uid) throw new Error('invoice without user');
        const cur = subOf(uid);
        if (!cur || cur.status !== 'active' || cur.current_period_end < now()) setSub(uid, { status: 'payment_failed' });
        recordPayment(uid, o.id, 'invoice', o.amount_due ?? PLAN.priceCents, 'failed', 'Payment failed');
        break;
      }
      case 'customer.subscription.updated': {
        const uid = userFrom(o); if (!uid) throw new Error('subscription without user');
        const f = { auto_renew: o.cancel_at_period_end ? 0 : 1 };
        if (o.current_period_end) f.current_period_end = o.current_period_end * 1000;
        if (['past_due', 'unpaid', 'incomplete_expired'].includes(o.status)) f.status = 'payment_failed';
        if (o.status === 'canceled') f.status = 'cancelled';
        setSub(uid, f);
        break;
      }
      case 'customer.subscription.deleted': {
        const uid = userFrom(o); if (!uid) throw new Error('subscription without user');
        const cur = subOf(uid);
        setSub(uid, { status: cur && cur.current_period_end > now() ? 'cancelled' : 'expired', auto_renew: 0, current_period_end: Math.min(cur?.current_period_end || now(), now()) });
        S.audit(uid, 'billing.subscription_ended', o.id);
        break;
      }
      case 'charge.refunded': {
        const uid = userFrom(o); if (!uid) throw new Error('refund without user');
        setSub(uid, { status: 'refunded', auto_renew: 0, current_period_end: now() });
        recordPayment(uid, (o.id || 'ch') + '_refund', 'refund', -(o.amount_refunded || PLAN.priceCents), 'refunded', 'Refund — Premium access removed', o.currency || 'usd');
        S.audit(uid, 'billing.refunded', o.id);
        break;
      }
      default: break;   // other events are acknowledged and ignored
    }
  }

  /* expire memberships whose paid year has ended (renewals extend the period through invoice.paid) */
  const prev = S.startJobs;
  S.startJobs = () => {
    prev && prev();
    S.every(600e3, () => db.run("UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE status = 'active' AND current_period_end < ? - (CASE WHEN auto_renew = 1 THEN 259200000 ELSE 0 END)", now(), now()));
  };
  S.expireSubscriptions = () => db.run("UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE status = 'active' AND current_period_end < ? - (CASE WHEN auto_renew = 1 THEN 259200000 ELSE 0 END)", now(), now());
}

module.exports = { register, verifyStripeSignature, PLAN };
