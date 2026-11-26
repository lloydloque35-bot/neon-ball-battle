/* =====================================================================
   NEON BALL BATTLE 2.8.0 — ANTI BALL LIMITED EDITION: screens only (browser; never on the server)
   Shop showcase (rotating cinematic preview, NULL ASCENSION preview, skill previews, copies left, exact price,
   purchase confirmation), the owner's serial number, Anti Ball Mastery, selection / collection labels and the owner's
   edition panel. Nothing here unlocks anything: ownership comes only from the server (server/edition.js).
   ===================================================================== */
(function () {
  if (window.NBB_HEADLESS || typeof UI === 'undefined' || typeof AX === 'undefined' || !ANTI_DEF) return;
  const css = `
  .anti-card{border-radius:16px;border:1px solid rgba(255,23,68,.6);background:radial-gradient(circle at 25% 30%,rgba(255,23,68,.16),transparent 55%),linear-gradient(150deg,#07070a,#14060b 55%,#060610);padding:14px;color:#fff;box-shadow:0 0 26px rgba(255,23,68,.18);display:grid;grid-template-columns:minmax(0,260px) minmax(0,1fr);gap:14px}
  @media (max-width:720px){.anti-card{grid-template-columns:minmax(0,1fr)}}
  .anti-show{width:100%;max-width:260px;aspect-ratio:1;display:block;margin:0 auto;border-radius:14px;background:#050507;cursor:pointer}
  .anti-cls{font-size:11px;font-weight:900;letter-spacing:1.4px;color:#ff8a80}.anti-nm{font-size:22px;font-weight:900;letter-spacing:1px}
  .anti-stock{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.anti-stock span{border:1px solid rgba(255,23,68,.45);border-radius:7px;padding:3px 8px;font-size:12px;font-weight:800;background:rgba(255,23,68,.08)}
  .anti-bar{height:8px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden}.anti-bar i{display:block;height:100%;background:linear-gradient(90deg,#ff1744,#ff8a80)}
  .anti-sold{background:#000;border:2px solid #ff1744;color:#ff1744;font-weight:900;letter-spacing:2px;text-align:center;padding:8px;border-radius:10px}
  .anti-serial{display:inline-block;background:#000;border:1px solid #ff1744;color:#fff;font-weight:900;letter-spacing:2px;border-radius:8px;padding:4px 10px;box-shadow:0 0 10px rgba(255,23,68,.5)}
  .anti-sk{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}
  .anti-sk .ic{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-weight:900;background:rgba(255,23,68,.16);color:#ff8a80}
  .anti-sk b{font-size:13px}.anti-sk small{display:block;color:#b0bec5;font-size:12px}
  .anti-mast{border:1px solid rgba(255,23,68,.4);border-radius:12px;padding:10px;background:rgba(255,23,68,.05)}
  .anti-perk{font-size:12px;color:#90a4ae}.anti-perk.on{color:#ffcdd2}
  .feat-st.anti{color:#ff8a80}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const edState = () => (typeof godShopCache !== 'undefined' && godShopCache && godShopCache.edition && godShopCache.edition.anti) || null;
  const mySerial = () => (window.Online && Online.save && Online.save.editions && Online.save.editions.anti) || (edState() && edState().serial) || null;
  const myMastery = () => antiMasteryOf(typeof SAVE !== 'undefined' && SAVE && SAVE.skills26 ? SAVE.skills26.mastery : null);
  const owned = () => canUseBall(getBall('anti'));

  /* ---------- cinematic rotating showcase (pseudo-3D: perspective rings, floor shadow, light sweep) ---------- */
  function antiShowcase(size = 260, o = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), c = h('canvas', { class: 'anti-show', width: Math.round(size * dpr), height: Math.round(size * dpr), title: 'Tap to see NULL ASCENSION' });
    const lv = myMastery().lv; let asc = !!o.asc, flash = 0, last = performance.now(), t = 0, started = false;
    c.transform = () => { asc = !asc; flash = 1; antiSound(asc ? 'ascend' : 'core'); };
    c.onclick = () => c.transform();
    const loop = () => {
      if (!c.isConnected) { if (started) return; requestAnimationFrame(loop); return; }
      started = true;
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      if (o.auto && t > 4) { t = 0; c.transform(); }
      const g = c.getContext('2d'), S = size, R = S * 0.25, cx = S / 2, cy = S * 0.47 + Math.sin(now / 700) * S * 0.015;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
      const bg = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, S * 0.7); bg.addColorStop(0, asc ? '#2a0008' : '#12001f'); bg.addColorStop(1, '#030305'); g.fillStyle = bg; g.fillRect(0, 0, S, S);
      g.save(); g.globalAlpha = 0.35; g.fillStyle = '#000'; g.beginPath(); g.ellipse(cx, S * 0.84, R * 1.1, R * 0.22, 0, 0, Math.PI * 2); g.fill(); g.restore();      // floor shadow
      g.save(); g.strokeStyle = asc ? 'rgba(255,23,68,.35)' : 'rgba(157,77,255,.35)'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(cx, cy, R * (1.9 + i * 0.35), R * (0.5 + i * 0.1), now / 4000 * (i % 2 ? -1 : 1), 0, Math.PI * 2); g.stroke(); } g.restore();
      try { drawBall(g, antiDefFor(lv, asc), cx, cy, R, { t: now / 1000, rot: now / 900, big: true }); } catch (e) { /* visual only */ }
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip(); const sx = cx - R * 2 + ((now / 2200) % 1) * R * 4; const lg = g.createLinearGradient(sx - R * 0.3, 0, sx + R * 0.3, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.22)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(cx - R, cy - R, R * 2, R * 2); g.restore();     // light sweep
      if (flash > 0) { g.save(); g.globalAlpha = flash; g.fillStyle = asc ? '#ff1744' : '#7c4dff'; g.fillRect(0, 0, S, S); g.strokeStyle = '#fff'; g.lineWidth = 3; for (let k = 0; k < 3; k++) antiPoly(g, cx, cy, R * (1.2 + (1 - flash) * (2 + k)), 6 - k, k); g.restore(); flash = Math.max(0, flash - dt * 1.6); }
      g.fillStyle = asc ? '#ff8a80' : '#b388ff'; g.font = '900 12px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(asc ? 'NULL ASCENSION' : 'ANTI BALL', cx, S - 12);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop); return c;
  }
  /* ---------- the 9 abilities with a live preview each ---------- */
  function skillList(b, o = {}) {
    const wrap = h('div');
    for (const s of b.skills) { const T = SKILL_TYPES[s.type] || {};
      wrap.append(h('div', { class: 'anti-sk' }, h('div', { class: 'ic' }, T.ico || '•'), h('div', {}, h('b', {}, `${s.name} `, h('span', { class: 'muted' }, `• ${s.cd}s cooldown`)), h('small', {}, T.desc || '')),
        typeof previewSkill26 === 'function' && !o.noPreview ? h('button', { class: 'btn small', onclick: () => previewSkill26(b, s.uid) }, '▶') : h('span'))); }
    wrap.append(h('div', { class: 'anti-sk' }, h('div', { class: 'ic', style: { color: '#ffd54f' } }, '★'), h('div', {}, h('b', {}, `ULTIMATE: ${b.ult.name}`), h('small', {}, ULT_TYPES[b.ult.type] || '')),
      typeof previewSkill26 === 'function' && !o.noPreview ? h('button', { class: 'btn small', onclick: () => previewSkill26(b, 'ult') }, '▶') : h('span')));
    wrap.append(h('div', { class: 'anti-sk' }, h('div', { class: 'ic' }, '◆'), h('div', {}, h('b', {}, 'PASSIVE: ' + b.passiveInfo.name), h('small', {}, b.passiveInfo.desc)), h('span')));
    wrap.append(h('div', { class: 'anti-sk' }, h('div', { class: 'ic' }, '✦'), h('div', {}, h('b', {}, 'TRANSFORMATION: NULL ASCENSION'), h('small', {}, 'Black-chrome body, glowing crimson core, floating geometric rings. With its first ultimate or at 40% HP: takes 10% less damage and recovers cooldowns 10% faster.')), h('span')));
    return wrap;
  }
  /* ---------- Anti Ball Mastery (looks only) ---------- */
  function masteryPanel() {
    const m = myMastery();
    return h('div', { class: 'anti-mast' }, h('b', {}, `🛡 ANTI BALL MASTERY — Level ${m.lv} / 10`),
      h('div', { class: 'anti-bar', style: { margin: '6px 0' } }, h('i', { style: { width: Math.round(m.pct * 100) + '%' } })),
      h('small', { class: 'muted' }, m.next ? `${fmtNum(m.xp)} / ${fmtNum(m.next)} mastery EXP — earned in verified battles with Anti Ball` : `${fmtNum(m.xp)} mastery EXP — maximum level`),
      h('div', { style: { marginTop: '6px', display: 'grid', gap: '2px' } }, ...ANTI_MASTERY_PERKS.map(([lv, txt]) => h('div', { class: 'anti-perk' + (m.lv >= lv ? ' on' : '') }, `${m.lv >= lv ? '✔' : '🔒'} Lv ${lv}: ${txt}`))),
      h('small', { class: 'muted', style: { display: 'block', marginTop: '6px' } }, 'Mastery changes how Anti Ball looks, never how strong it is.'));
  }
  /* ---------- purchase: exact price, confirmation, then the verified payment flow ---------- */
  function confirmBuy() {
    const E = edState();
    UI.modal(h('div', { class: 'gshop-pay' }, h('h2', {}, '🛡 Confirm your purchase'),
      h('p', {}, h('b', {}, 'ANTI BALL – LIMITED EDITION'), ' for ', h('b', { style: { color: '#ff8a80', fontSize: '18px' } }, 'PHP 999.00'), ' (one-time payment).'),
      h('ul', { style: { paddingLeft: '18px', lineHeight: 1.5 } },
        h('li', {}, 'One copy per account, saved to your account forever (logout or a new phone keeps it).'),
        h('li', {}, `You get your own serial number${E && !E.soldOut ? ` — the next free one is ${AX.SERIAL(E.owners + 1)}` : ''}.`),
        h('li', {}, 'Only 100 copies will ever exist. No restock, no events, no free copies.'),
        h('li', {}, 'It unlocks only after your payment is verified (a QR payment is checked by the game owner; a card / e-wallet checkout is confirmed by PayMongo).'),
        h('li', {}, 'Under 18? Ask a parent or guardian before you pay.')),
      h('div', { class: 'gshop-row' }, h('button', { class: 'btn gold big', onclick: () => { UI.closeModal(); godBuy('anti'); } }, '✔ Yes — buy for PHP 999'), h('button', { class: 'btn', onclick: () => UI.closeModal() }, 'Cancel'))));
  }
  { const _gb = godBuy;      // QR: reserve one of the 100 slots first (the server holds it while you pay); PayMongo: the checkout holds it
    godBuy = async function (product) {
      if (product !== 'anti') return _gb(product);
      if (!shopOnline()) return toast('Purchases need the online game server', 'bad');
      if (!Online.active) { toast('Sign in first — your copy is saved to your account', 'bad'); return UI.show('account'); }
      let shop = godShopCache; try { shop = godShopCache = await shopApi('GET', '/api/godshop'); } catch { /* keep the last answer */ }
      if (!shop || !shop.enabled) return toast('The shop is not open yet. Nothing was charged.', 'bad');
      const qr = shop.manual && shop.manual.enabled && shop.manual.accounts.length;
      const viaQr = async () => { let r; try { r = await API.post('/api/godshop/edition/reserve', { product: 'anti' }); } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); return UI.render_godshop(); } manualPay('anti', shop, { purchaseId: r.purchaseId, holdUntil: r.holdUntil }); };
      if (qr && shop.paymongo) return UI.modal(h('div', { class: 'gshop-pay' }, h('h2', {}, '🛡 How do you want to pay?'), h('div', { class: 'gshop-tabs' },
        h('button', { class: 'btn gold', onclick: () => { UI.closeModal(); viaQr(); } }, '📱 Scan QR — Maya / MariBank / any bank app'),
        h('button', { class: 'btn', onclick: () => { UI.closeModal(); paymongoBuy('anti'); } }, '💳 Automatic checkout (PayMongo)'))));
      return qr ? viaQr() : paymongoBuy('anti');
    };
  }
  /* ---------- the shop card ---------- */
  function shopCard(shop) {
    const b = getBall('anti'), E = edState(), mine = owned(), serial = mySerial();
    const left = h('div', {}, antiShowcase(260, { auto: true }), h('div', { class: 'gshop-row', style: { marginTop: '8px' } },
      h('button', { class: 'btn small', onclick: e => { const cv = e.target.closest('.anti-card').querySelector('canvas'); if (cv && cv.transform) cv.transform(); } }, '✦ Transformation preview'),
      h('button', { class: 'btn small', onclick: () => Game.tryBall('anti') }, '▶ Free practice test')));
    const right = h('div', {}, h('div', { class: 'anti-cls' }, '🛡 LIMITED EDITION • 100 COPIES WORLDWIDE'), h('div', { class: 'anti-nm' }, 'ANTI BALL'),
      h('small', { class: 'muted' }, 'A rare defensive counter ball: it rejects, analyses and outlasts abilities — it never disables everyone.'));
    if (E) {
      const left100 = E.supply - E.owners;
      right.append(h('div', { class: 'anti-stock' }, h('span', {}, `${left100} of ${E.supply} left`), h('span', {}, `${E.owners} owned`), E.reserved ? h('span', {}, `${E.reserved} being paid now`) : null, h('span', {}, 'never restocked')),
        h('div', { class: 'anti-bar' }, h('i', { style: { width: Math.round((E.owners / E.supply) * 100) + '%' } })));
      if (E.soldOut && !mine) right.append(h('div', { class: 'anti-sold', style: { marginTop: '8px' } }, 'SOLD OUT — FOREVER'));
      else if (!E.open && !mine) right.append(h('div', { class: 'gshop-note', style: { marginTop: '8px' } }, '⏸ Sales are paused by the game owner for now. Nothing can be charged.'));
    } else right.append(h('div', { class: 'gshop-note', style: { marginTop: '8px' } }, 'Copies left are shown when you are online.'));
    if (mine) right.append(h('div', { style: { margin: '10px 0' } }, h('span', { class: 'gshop-owned' }, '✔ YOU OWN ANTI BALL'), ' ', serial ? h('span', { class: 'anti-serial' }, AX.SERIAL(serial)) : null));
    else right.append(h('div', { class: 'gshop-price', style: { margin: '8px 0' } }, 'PHP 999', ' ', h('small', {}, 'one-time • your own serial number • yours forever')));
    if (E && E.mine && !mine) right.append(h('div', { class: 'gshop-note gshop-wait' }, E.mine.status === 'awaiting' ? '⏳ Your payment is waiting for the owner\'s check. Your copy is kept for you.' : '⏳ You have a copy reserved — finish paying to keep it.'));
    const row = h('div', { class: 'gshop-row' });
    const blocked = !E || E.soldOut || !E.open || (E.mine && E.mine.status === 'awaiting');
    if (!mine) row.append(h('button', { class: 'btn gold big', disabled: !(shop && shop.enabled) || blocked, onclick: () => confirmBuy() }, E && E.mine && E.mine.status !== 'awaiting' ? '🛡 Continue paying — PHP 999' : '🛡 Buy — PHP 999'));
    else row.append(h('button', { class: 'btn primary', onclick: () => { Game.setup.ball = 'anti'; UI.show('play'); } }, '⚔ Battle'));
    right.append(row, h('div', { class: 'shop-sec-t', style: { fontSize: '13px' } }, 'Skills — tap ▶ to preview'), skillList(b), mine ? masteryPanel() : null);
    return h('div', { class: 'anti-card', id: 'antiShop' }, left, right);
  }
  const rg = UI.render_godshop;
  UI.render_godshop = async function () {
    await rg.call(this);
    const body = $('#godShopBody'), box = document.getElementById('storePass'); if (!body) return;
    const sec = h('div', {}, h('div', { class: 'shop-sec-t' }, '🛡 LIMITED EDITION'), shopCard(typeof godShopCache !== 'undefined' ? godShopCache : null));
    const anchor = box ? [...box.children].reverse().find(el => el.classList.contains('shop-sec-t')) : null;
    if (box && anchor) box.insertBefore(sec, anchor); else body.prepend(sec);
  };
  /* ---------- ball details: serial number, mastery, abilities ---------- */
  const od = UI.openDetail;
  UI.openDetail = function (id) {
    const r = od.call(this, id); if (id !== 'anti') return r;
    const mb = document.getElementById('modalBox'); if (!mb) return r;
    const serial = mySerial(), mine = owned();
    mb.append(h('div', { class: 'card', style: { marginTop: '10px' } },
      h('div', { class: 'anti-cls' }, '🛡 LIMITED EDITION • 100 COPIES WORLDWIDE • NEVER RESTOCKED'),
      mine ? h('div', { style: { margin: '6px 0' } }, h('span', { class: 'gshop-owned' }, '✔ OWNED'), ' ', serial ? h('span', { class: 'anti-serial' }, 'YOUR COPY: ' + AX.SERIAL(serial)) : null) : h('p', {}, 'Not owned yet — PHP 999 in the Shop.'),
      mine ? masteryPanel() : null, h('div', { style: { marginTop: '8px' } }, skillList(getBall('anti')))));
    return r;
  };
  /* ---------- owner: ANTI BALL edition panel (the server checks owner + 2FA for every request) ---------- */
  UI.admin_antied = async function (body) {
    const d = await API.get('/api/admin/edition?ball=anti'); body.innerHTML = '';
    const dt = t => t ? new Date(t).toLocaleString() : '—';
    const tbl = (cols, rows) => rows.length ? h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'gshop-tbl' }, h('tr', {}, ...cols.map(c => h('th', {}, c[0]))), ...rows.map(r => h('tr', {}, ...cols.map(c => h('td', {}, String(c[1](r) ?? '—'))))))) : h('p', { class: 'muted' }, 'None yet.');
    body.append(h('div', { class: 'anti-card', style: { display: 'block' } }, h('div', { class: 'anti-cls' }, '🛡 ANTI BALL — LIMITED EDITION (PHP 999)'),
      h('div', { class: 'anti-stock' }, h('span', {}, `${d.owners.length} / ${d.supply} owners`), h('span', {}, `${d.available} available`), h('span', {}, `${d.reserved} being paid now`), h('span', {}, d.open ? '✔ on sale' : '⏸ paused'), h('span', {}, d.soldOut ? 'SOLD OUT (permanent)' : 'supply fixed at 100')),
      h('p', { class: 'muted small' }, 'The supply is permanent: it can never be raised and there are no new editions. You can pause sales if something goes wrong. Cooldowns and power are set in 🧬 Skills.'),
      h('div', { class: 'gshop-row' }, h('button', { class: 'btn ' + (d.open ? 'danger' : 'gold'), onclick: () => adminDo(() => API.post('/api/admin/edition/settings', { ball: 'anti', open: !d.open }), () => UI.render_admin()) }, d.open ? '⏸ Pause sales' : '▶ Resume sales'),
        h('button', { class: 'btn', onclick: () => { UI.adTab = 'skills26'; UI.render_admin(); } }, '🧬 Skill balance'))));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Serial numbers'), tbl([['Serial', r => r.label], ['Player', r => r.username], ['Since', r => dt(r.granted_at)], ['Purchase', r => r.purchase_id]], d.owners)));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Waiting / reserved'), tbl([['Player', r => r.username], ['Status', r => r.status], ['Method', r => r.method || r.provider], ['Ref', r => r.reference], ['Since', r => dt(r.createdAt)]], d.pending)));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Verified purchases'), tbl([['Player', r => r.username], ['PHP', r => r.amount], ['Method', r => r.method || r.provider], ['Ref', r => r.reference], ['Paid', r => dt(r.paidAt)]], d.completed)));
    if (d.errors.length) body.append(h('div', { class: 'card' }, h('h3', {}, 'Needs attention (refund / review)'), tbl([['Player', r => r.username], ['Status', r => r.status], ['Note', r => r.note], ['When', r => dt(r.createdAt)]], d.errors)));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Ledger (cannot be changed)'), tbl([['When', r => dt(r.at)], ['Event', r => r.event], ['Player', r => r.username], ['By', r => r.actor], ['Details', r => r.details ? JSON.stringify(r.details).slice(0, 80) : '']], d.ledger.slice(0, 60))));
  };
})();
