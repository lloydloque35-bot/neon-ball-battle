'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { startServer, Client } = require('./helpers');
const { buildConfig, validateConfig } = require('../config');

const WHSEC = 'whsec_test_secret_123';
let srv, mock, mockCalls = [];

function sign(payload, secret = WHSEC, t = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return `t=${t},v1=${sig}`;
}
async function webhook(evt, opts = {}) {
  const body = JSON.stringify(evt);
  const r = await fetch(srv.base + '/api/billing/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': opts.sig || sign(body) }, body });
  return { status: r.status, data: await r.json() };
}
const evt = (type, object, id = 'evt_' + crypto.randomBytes(6).toString('hex')) => ({ id, type, livemode: false, data: { object } });

test.before(async () => {
  mock = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      mockCalls.push({ method: req.method, url: req.url, body: new URLSearchParams(b), auth: req.headers.authorization });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/v1/checkout/sessions') return res.end(JSON.stringify({ id: 'cs_test_' + mockCalls.length, url: 'https://checkout.stripe.com/c/pay/cs_test_' + mockCalls.length }));
      if (req.url.startsWith('/v1/subscriptions/')) return res.end(JSON.stringify({ id: req.url.split('/').pop(), cancel_at_period_end: true }));
      res.statusCode = 404; res.end('{}');
    });
  });
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  srv = await startServer({ payments: { mode: 'test', secretKey: 'sk_test_dummy', webhookSecret: WHSEC, priceId: 'price_test_200y', apiBase: `http://127.0.0.1:${mock.address().port}`, autoRenew: true } });
});
test.after(async () => { await srv.stop(); mock.close(); });

test('config refuses unsafe payment setups', () => {
  const base = buildConfig();
  const live = { ...base, isProd: true, cookieSecure: true, appOrigin: 'https://game.example', payments: { ...base.payments, mode: 'live', secretKey: 'sk_live_x', webhookSecret: 'whsec_x', priceId: 'price_x', liveConfirmed: false } };
  assert.ok(validateConfig(live).errors.some(e => /merchant verification/.test(e)), 'live payments are locked until confirmed');
  const leaked = { ...base, payments: { ...base.payments, mode: 'test', secretKey: 'sk_live_oops', webhookSecret: 'whsec_x', priceId: 'price_x' } };
  assert.ok(validateConfig(leaked).errors.length >= 1);
  const ok = { ...base, payments: { ...base.payments, mode: 'test', secretKey: 'sk_test_x', webhookSecret: 'whsec_x', priceId: 'price_x' } };
  assert.equal(validateConfig(ok).errors.length, 0);
});

test('membership dashboard discloses price, duration and auto-renewal', async () => {
  const c = new Client(srv.base); await c.register('payer_0');
  const s = (await c.get('/api/billing/status')).data;
  assert.equal(s.plan.priceUsd, 200); assert.equal(s.plan.durationDays, 365);
  assert.match(s.plan.disclosure, /renews automatically/);
  assert.match(s.plan.disclosure, /never includes admin/);
  assert.equal(s.subscription.status, 'free');
});

let payer, uid;
test('checkout creates a Stripe session server-side; nothing is activated before payment', async () => {
  payer = new Client(srv.base); await payer.register('payer_1');
  uid = srv.db.get("SELECT id FROM users WHERE username = 'payer_1'").id;
  const r = await payer.post('/api/billing/checkout');
  assert.equal(r.status, 200); assert.match(r.data.url, /^https:\/\/checkout\.stripe\.com\//);
  const call = mockCalls.find(c => c.url === '/v1/checkout/sessions');
  assert.equal(call.auth, 'Bearer sk_test_dummy', 'secret key is only used server-side');
  assert.equal(call.body.get('line_items[0][price]'), 'price_test_200y');
  assert.equal(call.body.get('mode'), 'subscription');
  const s = (await payer.get('/api/billing/status')).data;
  assert.equal(s.subscription.status, 'pending'); assert.equal(s.subscription.active, false);
  assert.equal((await payer.post('/api/battle/start', { mode: '1v1', ball: 'prism' })).status, 403, 'no premium balls before payment');
});

test('webhooks with a bad signature are rejected', async () => {
  const r = await webhook(evt('invoice.paid', { id: 'in_fake', subscription: 'sub_1', metadata: { user_id: String(uid) } }), { sig: 't=1,v1=deadbeef' });
  assert.equal(r.status, 400);
  assert.equal(srv.S.premiumOf(uid).active, false);
});

test('verified invoice.paid activates Premium for one year; duplicates are ignored', async () => {
  const end = Math.floor(Date.now() / 1000) + 365 * 86400;
  assert.equal((await webhook(evt('checkout.session.completed', { id: 'cs_test_1', client_reference_id: String(uid), customer: 'cus_1', subscription: 'sub_1', payment_status: 'paid', amount_total: 20000 }))).status, 200);
  const paid = evt('invoice.paid', { id: 'in_1', customer: 'cus_1', subscription: 'sub_1', amount_paid: 20000, currency: 'usd', lines: { data: [{ period: { start: end - 365 * 86400, end } }] } }, 'evt_invoice_1');
  assert.equal((await webhook(paid)).status, 200);
  assert.equal((await webhook(paid)).data.duplicate, true);
  assert.equal(srv.db.get("SELECT COUNT(*) n FROM payments WHERE provider_ref = 'in_1'").n, 1);
  const st = (await payer.get('/api/billing/status')).data;
  assert.equal(st.subscription.active, true); assert.equal(st.subscription.autoRenew, true);
  assert.ok(st.subscription.remainingDays >= 364);
  assert.equal((await payer.post('/api/battle/start', { mode: '1v1', ball: 'prism', difficulty: 'easy' })).status, 200, 'premium unlocks premium balls');
  assert.equal((await payer.post('/api/battle/start', { mode: '1v1', ball: 'bloodmoon', difficulty: 'easy' })).status, 200, 'premium unlocks non-admin limited balls');
  assert.equal((await payer.post('/api/battle/start', { mode: '1v1', ball: 'oneaboveall', difficulty: 'easy' })).status, 403, 'premium never unlocks admin balls');
  assert.equal((await payer.get('/api/auth/me')).data.user.isOwner, false, 'premium never grants admin');
});

test('turning off auto-renew keeps access until the period ends', async () => {
  const r = await payer.post('/api/billing/cancel');
  assert.equal(r.status, 200); assert.equal(r.data.subscription.autoRenew, false); assert.equal(r.data.subscription.active, true);
  assert.equal(mockCalls.at(-1).body.get('cancel_at_period_end'), 'true');
});

test('expiration removes premium access but keeps permanently owned balls', async () => {
  srv.db.run('UPDATE subscriptions SET current_period_end = ? WHERE user_id = ?', Date.now() - 1000, uid);
  srv.S.expireSubscriptions();
  assert.equal(srv.S.premiumOf(uid).status, 'expired');
  assert.equal((await payer.post('/api/battle/start', { mode: '1v1', ball: 'prism', difficulty: 'easy' })).status, 403);
  assert.equal((await payer.post('/api/battle/start', { mode: '1v1', ball: 'fire', difficulty: 'easy' })).status, 200);
});

test('refund revokes Premium immediately and is recorded in payment history', async () => {
  const end = Math.floor(Date.now() / 1000) + 365 * 86400;
  await webhook(evt('invoice.paid', { id: 'in_2', customer: 'cus_1', subscription: 'sub_1', amount_paid: 20000, currency: 'usd', lines: { data: [{ period: { end } }] } }));
  assert.equal(srv.S.premiumOf(uid).active, true);
  await webhook(evt('charge.refunded', { id: 'ch_2', customer: 'cus_1', amount_refunded: 20000, currency: 'usd' }));
  const st = (await payer.get('/api/billing/status')).data;
  assert.equal(st.subscription.status, 'refunded'); assert.equal(st.subscription.active, false);
  assert.ok(st.history.some(h => h.kind === 'refund' && h.amount === -200));
});

test('failed renewal payment is tracked', async () => {
  const c = new Client(srv.base); await c.register('payer_2');
  const id = srv.db.get("SELECT id FROM users WHERE username = 'payer_2'").id;
  await webhook(evt('checkout.session.completed', { id: 'cs_x', client_reference_id: String(id), customer: 'cus_2', subscription: 'sub_2', payment_status: 'unpaid' }));
  await webhook(evt('invoice.payment_failed', { id: 'in_f', customer: 'cus_2', subscription: 'sub_2', amount_due: 20000 }));
  assert.equal(srv.S.premiumOf(id).status, 'payment_failed');
  assert.equal(srv.S.premiumOf(id).active, false);
});

test('payments disabled → checkout is clearly unavailable', async () => {
  const s2 = await startServer();
  try {
    const c = new Client(s2.base); await c.register('payer_3');
    const r = await c.post('/api/billing/checkout');
    assert.equal(r.status, 503); assert.equal(r.data.code, 'PAYMENTS_DISABLED');
  } finally { await s2.stop(); }
});
