/* =====================================================================
   NEON BALL BATTLE 2.7.0 — BATTLE PASS & COIN PACKS (shop screen only — loaded in the browser, not on the server)

   - BATTLE PASS (PHP 299, one-time): God of Chaos, God of War, AI Tech and Solar Eclipse, owned forever.
     Players who had already played them before 2.7.0 keep them (server migration 009).
   - (2.8.0: Anti Ball became a 100-copy limited edition, so the Free Pass has no ball for now.)
   - COIN PACKS: PHP 99 = 10,000 coins, PHP 999 = 1,000,000 coins.

   This file only draws the shop. Nothing here unlocks anything: balls and coins come ONLY from the server, after a
   verified PayMongo payment or after the owner approves a QR payment (server/shop.js).
   ===================================================================== */
(function () {
  if (window.NBB_HEADLESS || typeof UI === 'undefined' || typeof BATTLE_PASS === 'undefined') return;
  const css = `
  .bp-card{border-radius:16px;border:1px solid rgba(255,213,79,.6);background:linear-gradient(150deg,rgba(60,40,0,.55),rgba(20,8,48,.92) 45%,rgba(6,10,30,.95));padding:14px;display:flex;flex-direction:column;gap:10px;color:#fff;min-width:0;box-shadow:0 0 22px rgba(255,213,79,.18)}
  .bp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
  .bp-head .t{font-size:20px;font-weight:900;letter-spacing:1px;color:#ffe082}.bp-head .s{font-size:12px;color:#c8d6ea;font-weight:700}
  .bp-balls{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px}
  .bp-ball{border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.25);padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;cursor:pointer;color:#fff;font:inherit}
  .bp-ball b{font-size:12px;letter-spacing:.4px}.bp-ball small{font-size:10px;font-weight:900;letter-spacing:.4px}
  .bp-ball .on{color:#69f0ae}.bp-ball .off{color:#ffd54f}
  .bp-free{display:flex;align-items:center;gap:10px;border-radius:12px;border:1px solid rgba(105,240,174,.5);background:rgba(105,240,174,.08);padding:8px 10px}
  .bp-free .tg{background:#00c853;color:#00170a;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:900;letter-spacing:.6px}
  .coin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
  .coin-pack{border-radius:14px;border:1px solid rgba(255,213,79,.45);background:linear-gradient(160deg,rgba(48,36,0,.55),rgba(6,10,30,.95));padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
  .coin-pack .amt{font-size:24px;font-weight:900;color:#ffe082}.coin-pack .ico{font-size:34px;line-height:1}
  .coin-pack .price{font-size:16px;font-weight:900}.coin-pack .btn{width:100%}
  .coin-pack.best{border-color:#ffd54f;box-shadow:0 0 18px rgba(255,213,79,.35)}.coin-pack .tag{background:#ffd54f;color:#241a00;border-radius:6px;padding:1px 7px;font-size:10px;font-weight:900;letter-spacing:.6px}
  .shop-sec-t{font-size:15px;font-weight:900;letter-spacing:1px;margin:14px 0 6px}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const product = (shop, id) => shop && shop.products && shop.products.find(p => p.id === id);
  const waitingFor = (shop, id) => !!(shop && shop.waiting && shop.waiting.has(id));
  const canBuy = shop => !!(shop && shop.enabled);

  /** the Battle Pass card: the 4 God Balls, what the player already has and the buy button */
  function passCard(shop) {
    const balls = BATTLE_PASS.balls.map(id => getBall(id)).filter(Boolean), P = product(shop, BATTLE_PASS.id);
    const have = balls.filter(b => canUseBall(b)).length, all = balls.length && have === balls.length;
    const c = h('div', { class: 'bp-card' });
    c.append(h('div', { class: 'bp-head' },
      h('div', {}, h('div', { class: 't' }, '🎫 BATTLE PASS'), h('div', { class: 's' }, 'All 4 Supreme God Balls • pay once • yours forever, on every device')),
      all ? h('span', { class: 'gshop-owned' }, '✔ YOU OWN THE BATTLE PASS') : h('div', { class: 'gshop-price' }, 'PHP ' + BATTLE_PASS.pricePhp, ' ', h('small', {}, 'one-time'))));
    const grid = h('div', { class: 'bp-balls' });
    for (const b of balls) {
      const ok = canUseBall(b), cv = ballCanvas(b, 64, { big: true }); UI.addLive(cv, b, { size: 64 });
      grid.append(h('button', { class: 'bp-ball', title: 'Inspect ' + b.name, onclick: () => UI.openGod(b.id) }, cv, h('b', {}, b.name.replace(/ Ball$/, '').toUpperCase()),
        h('small', { class: ok ? 'on' : 'off' }, ok ? '✔ OWNED' : '🎫 IN THE PASS')));
    }
    c.append(grid);
    if (have && !all) c.append(h('small', { class: 'muted' }, `You already have ${have} of the 4 (you played them before the Battle Pass). The pass adds the other ${balls.length - have}.`));
    const row = h('div', { class: 'gshop-row' });
    if (!all) row.append(waitingFor(shop, BATTLE_PASS.id) ? h('button', { class: 'btn', disabled: true }, '⏳ Waiting for owner check')
      : h('button', { class: 'btn gold big', disabled: !(canBuy(shop) && P), onclick: () => godBuy(BATTLE_PASS.id) }, `🎫 Buy the Battle Pass — PHP ${BATTLE_PASS.pricePhp}`));
    if (!all && balls[0]) row.append(h('button', { class: 'btn', onclick: () => Game.tryGod(balls[0].id, 2) }, '▶ Free practice test'));
    c.append(row);
    c.append(h('small', { class: 'muted' }, 'Forms unlock as each God Ball levels up (Awakened at Lv 10, Final God Form at Lv 20). You can try any of them for free in Practice first.'));
    return c;
  }
  /** coin packs: added to the account once the payment is confirmed */
  function coinCard(shop) {
    const wrap = h('div', { class: 'coin-grid' });
    for (const [id, coins, php, best] of [['coins_10k', 10000, 99, false], ['coins_1m', 1000000, 999, true]]) {
      const P = product(shop, id), n = P ? P.coins : coins, price = P ? P.price : php;
      wrap.append(h('div', { class: 'coin-pack' + (best ? ' best' : '') }, best ? h('span', { class: 'tag' }, 'BEST VALUE') : null, h('div', { class: 'ico' }, best ? '💰' : '🪙'),
        h('div', { class: 'amt' }, fmtNum(n) + ' coins'), h('div', { class: 'price' }, 'PHP ' + price),
        waitingFor(shop, id) ? h('small', { class: 'muted' }, '⏳ One payment is waiting for the owner check') : null,
        h('button', { class: 'btn gold', disabled: !(canBuy(shop) && P), onclick: () => godBuy(id) }, `🪙 Buy — PHP ${price}`)));
    }
    return h('div', {}, wrap, h('small', { class: 'muted', style: { display: 'block', marginTop: '6px' } },
      'Coins are added to your account once the payment is confirmed. Use them for balls, upgrades, summons and evolutions. Coins cannot be turned back into money.'));
  }

  const rg = UI.render_godshop;
  UI.render_godshop = async function () {
    await rg.call(this);
    const body = $('#godShopBody'); if (!body) return;
    const shop = typeof godShopCache !== 'undefined' ? godShopCache : null;
    // goes right after the shop's notes (payment methods, waiting payments), before the God Ball cards
    const anchor = [...body.children].find(el => !el.matches('.card, .gshop-note, .gshop-methods')) || null;
    const box = h('div', { id: 'storePass' }, passCard(shop), h('div', { class: 'shop-sec-t' }, '🪙 COIN PACKS'), coinCard(shop), h('div', { class: 'shop-sec-t' }, '💎 PREMIUM GOD BALLS'));
    body.insertBefore(box, anchor);
  };

  /* the Upgrade Shop (spends coins) gets a shortcut to the coin packs */
  const rs = UI.render_shop;
  UI.render_shop = function (...a) {
    const r = rs.apply(this, a);
    const body = $('#shopBody'); if (body && !body.querySelector('.coin-link')) body.prepend(h('div', { class: 'gshop-note coin-link', style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' } },
      h('span', { style: { flex: 1 } }, '🪙 Need more coins? Coin packs: PHP 99 = 10,000 coins • PHP 999 = 1,000,000 coins.'), h('button', { class: 'btn gold small', onclick: () => this.show('godshop') }, 'Get coins')));
    return r;
  };
})();
