/* =====================================================================
   NEON BALL BATTLE 2.9.0 — REALITY VS ABSOLUTE: screens (browser only — not loaded on the game server)

   - Lobby showcase of the three Reality Gods on the main menu.
   - ✦ SUPREME GOD COLLECTION: every God Ball (Battle Pass, Premium, Limited, Reality Gods) with owned / locked status,
     how it is obtained, previews, God Mastery, titles; search, sort and filters.
   - Shop: The Void Below / The Absolute Above for 50,000 coins (the server takes the coins, never this page),
     Fate Note Ball for PHP 99 through the verified shop (PayMongo or an owner-approved QR payment).
   - In battle: the FATE NOTEBOOK (Fate Note players: choose the name to write, see this match's seals, countdowns,
     resistances, revealed cooldowns, Fate Energy and the seal history — only things inside the current match) and the
     REALITY CLASH press button. Both send battle inputs that the server replays; nothing here decides a result.
   - Battle setup: arena choice (Neon Arena / REALITY COLLISION ZONE) and THE FRACTURED ARCHON once it is found.

   Nothing in this file unlocks anything: balls, coins and mastery come ONLY from the server.
   ===================================================================== */
(function () {
  if (window.NBB_HEADLESS || typeof UI === 'undefined' || typeof RG === 'undefined') return;
  const css = `
  .rg-show{position:relative;border-radius:16px;overflow:hidden;margin:6px 0 10px;padding:12px;border:1px solid rgba(255,255,255,.18);
    background:linear-gradient(110deg,rgba(80,0,18,.9),rgba(10,4,14,.95) 38%,rgba(14,12,6,.95) 62%,rgba(90,64,0,.85));color:#fff;cursor:pointer}
  .rg-show::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 40%,rgba(255,255,255,.18) 50%,transparent 60%);background-size:250% 100%;animation:rgSweep 4.5s linear infinite;pointer-events:none}
  @keyframes rgSweep{from{background-position:120% 0}to{background-position:-120% 0}}
  .rg-show .t{font-weight:900;letter-spacing:2px;font-size:13px;color:#ffe082}.rg-show .v{font-weight:900;font-size:19px;letter-spacing:1px}
  .rg-row{display:flex;gap:8px;justify-content:space-around;align-items:flex-end;margin-top:6px;flex-wrap:wrap}
  .rg-mini{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:90px;text-align:center}
  .rg-mini b{font-size:11px;letter-spacing:.6px}.rg-mini small{font-size:10px;font-weight:900}
  .rg-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
  .rg-card{border-radius:14px;border:1px solid rgba(255,255,255,.16);padding:12px;display:flex;flex-direction:column;gap:6px;color:#fff;min-width:0;background:rgba(6,8,22,.92)}
  .rg-card.void{border-color:rgba(255,23,68,.65);background:linear-gradient(160deg,rgba(70,0,16,.7),rgba(6,4,10,.96))}
  .rg-card.law{border-color:rgba(255,213,79,.7);background:linear-gradient(160deg,rgba(80,58,0,.6),rgba(10,8,4,.96))}
  .rg-card.fate{border-color:rgba(224,16,58,.6);background:linear-gradient(160deg,rgba(40,30,20,.75),rgba(6,6,10,.97))}
  .rg-card .nm{font-weight:900;letter-spacing:1px;font-size:15px}.rg-card .cls{font-size:10px;font-weight:900;letter-spacing:1px;color:#c8d6ea}
  .rg-card .forms{font-size:11px;color:#d7dff0}.rg-card .price{font-weight:900;font-size:16px;color:#ffe082}
  .rg-card .row{display:flex;gap:6px;flex-wrap:wrap}.rg-card .row .btn{flex:1;min-width:110px}
  .rg-own{color:#69f0ae;font-weight:900;font-size:12px}.rg-lock{color:#ffd54f;font-weight:900;font-size:12px}
  .rg-mbar{height:6px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}.rg-mbar i{display:block;height:100%;background:linear-gradient(90deg,#ff1744,#ffd54f)}
  .rg-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center}.rg-tools input,.rg-tools select{min-height:40px;border-radius:10px;padding:0 10px;background:#0c1330;color:#fff;border:1px solid rgba(255,255,255,.2);font:inherit}
  .rg-tools input{flex:1;min-width:160px}
  .rg-chip{min-height:36px;border-radius:18px;padding:0 12px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
  .rg-chip.on{background:#ffd54f;color:#1b1400;border-color:#ffd54f}
  #rgHud{position:fixed;right:12px;bottom:calc(150px + env(safe-area-inset-bottom));z-index:60;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none}
  #rgHud .btn{pointer-events:auto;min-height:48px;min-width:48px}
  #rgClashWrap{position:fixed;left:0;right:0;bottom:calc(110px + env(safe-area-inset-bottom));display:flex;justify-content:center;z-index:62;pointer-events:none}
  #rgClash{pointer-events:auto;font-size:22px;font-weight:900;letter-spacing:2px;min-height:64px;padding:0 28px;border-radius:32px;border:2px solid #fff;color:#fff;background:linear-gradient(90deg,#ff1744,#ffffff 50%,#ffd54f);text-shadow:0 0 6px #000;animation:rgPulse .5s ease-in-out infinite alternate}
  @keyframes rgPulse{from{transform:scale(1)}to{transform:scale(1.08)}}
  #rgBook{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom));width:min(560px,calc(100vw - 16px));max-height:62vh;overflow:auto;z-index:61;border-radius:16px;
    background:linear-gradient(180deg,#f3e5c0,#e2cf9e);color:#1a0d06;border:3px solid #0b0b12;box-shadow:0 10px 40px rgba(0,0,0,.6);padding:12px;font-family:Georgia,serif}
  #rgBook h3{margin:0 0 4px;font-size:18px;letter-spacing:1px}#rgBook .sub{font-size:11px;color:#5a4630;margin-bottom:8px}
  #rgBook .foe{border-top:1px dashed rgba(60,40,20,.4);padding:8px 0;display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center}
  #rgBook .foe b{font-size:15px}#rgBook .meta{font-size:12px;line-height:1.45;font-family:"Segoe UI",sans-serif}
  #rgBook .write{min-height:44px;min-width:110px;border-radius:10px;border:2px solid #0b0b12;background:#0b0b12;color:#f3e5c0;font-weight:900;cursor:pointer}
  #rgBook .write.chosen{background:#e0103a;border-color:#e0103a;color:#fff}
  #rgBook .cd{display:inline-block;margin:1px 2px;padding:0 5px;border-radius:5px;background:rgba(0,0,0,.12);font-size:11px}
  #rgBook .log{font-size:12px;font-family:"Segoe UI",sans-serif;color:#3a2a18;max-height:110px;overflow:auto}
  #rgBook .close{float:right;min-height:40px;min-width:40px;border-radius:10px;border:2px solid #0b0b12;background:transparent;font-weight:900;cursor:pointer}
  @media (max-height:520px){#rgBook{left:auto;right:8px;transform:none;top:8px;bottom:8px;width:min(420px,52vw);max-height:none;padding:8px}#rgBook h3{font-size:15px}#rgBook .sub{display:none}#rgBook .meta{font-size:11px}#rgBook .foe b{font-size:13px}}
  .rg-energy{height:10px;border-radius:5px;background:rgba(0,0,0,.2);overflow:hidden;margin:4px 0 6px}.rg-energy i{display:block;height:100%;background:#e0103a}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const IDS = RG.IDS, CLASS = { voidbelow: 'void', absoluteabove: 'law', fatenote: 'fate' };
  let ME = null, meAt = 0;      // GET /api/reality/me (mastery, Archon status), cached for 20 s
  async function loadMe(force) {
    if (!online()) return ME = null;
    if (!force && ME && Date.now() - meAt < 20000) return ME;
    try { ME = await API.get('/api/reality/me'); meAt = Date.now(); } catch (e) { ME = null; }
    return ME;
  }
  const godIds = () => [...SUP.godIds, ...(SUP.paidGodIds || []), ...(SUP.limitedGodIds || []), 'anti', ...(SUP.realityGodIds || [])].filter((v, i, a) => a.indexOf(v) === i);
  const godList = () => godIds().map(id => getBall(id)).filter(b => b && (b.enabled !== false || isAdmin()));
  function howToGet(b) {
    if (b.coinGod) return { kind: 'coins', text: '🪙 ' + fmtNum(b.coinPrice) + ' coins', sort: b.coinPrice / 500 };
    if (b.realityGod) return { kind: 'money', text: '💎 PHP ' + b.pricePhp, sort: b.pricePhp };
    if (b.pass) return { kind: 'pass', text: '🎫 Battle Pass • PHP ' + (typeof BATTLE_PASS !== 'undefined' ? BATTLE_PASS.pricePhp : 299), sort: 299 };
    if (b.edition) return { kind: 'limited', text: '🛡 Limited edition • PHP ' + (b.pricePhp || 0), sort: b.pricePhp || 0 };
    if (b.paid) return { kind: 'money', text: '💎 PHP ' + (b.pricePhp || 99), sort: b.pricePhp || 99 };
    return { kind: 'free', text: 'FREE', sort: 0 };
  }
  function masteryOf(b) {
    if (b.realityGod && ME && ME.mastery && ME.mastery[b.id]) return ME.mastery[b.id];
    if (b.id === 'anti' && typeof antiMasteryOf === 'function' && SAVE.mastery26) return antiMasteryOf(SAVE.mastery26);
    return null;
  }
  const titleName = b => { const c = typeof COSMETICS !== 'undefined' && COSMETICS.find(x => x.id === GM29.TITLES[b.id]); return c ? c.name : '—'; };
  /** achievements with this ball (from the player's own saved record) */
  const achLine = b => { const p = prog(b.id), w = p.wins | 0, l = p.losses | 0; return `Battles won: ${fmtNum(w)}${w + l ? ` / ${fmtNum(w + l)}` : ''}${p.level > 1 && canUseBall(b) ? ` • Lv ${p.level}` : ''}`; };
  async function buyCoins(b) {
    if (!online()) return toast('Sign in first: Reality Gods are bought on your account (the server saves them).', 'bad');
    if (canUseBall(b)) return toast('You already own ' + esc(b.name), 'gold');
    const bal = SAVE.coins | 0;
    UI.confirm(`Buy <b>${esc(b.name)}</b> for <b>🪙 ${fmtNum(b.coinPrice)} coins</b>?<br><small>You have ${fmtNum(bal)} coins${bal < b.coinPrice ? ' — that is not enough yet' : ''}. The coins are taken once, by the server. It is yours forever, on every device.</small>`,
      () => act(() => Online.post('/api/reality/buy', { ball: b.id }), r => { toast(`🔓 <b>${esc(b.name)}</b> is yours! (−${fmtNum(r.coins)} coins)`, 'gold'); Sound.play('evolve'); ME = null; UI.refreshCurrent ? UI.refreshCurrent() : null; if (UI.current === 'gods29') UI.render_gods29(); if (UI.current === 'godshop') UI.render_godshop(); }),
      `🪙 Buy — ${fmtNum(b.coinPrice)} coins`);
  }
  const buyPhp = b => { if (!online()) return toast('Sign in first: purchases are saved on your account.', 'bad'); if (typeof godBuy === 'function') godBuy(b.id); };
  function buyButton(b) {
    if (canUseBall(b)) return h('span', { class: 'rg-own' }, '✔ OWNED');
    if (b.coinGod) return h('button', { class: 'btn gold', onclick: e => { e.stopPropagation(); buyCoins(b); } }, '🪙 Buy — ' + fmtNum(b.coinPrice));
    if (b.realityGod) return h('button', { class: 'btn gold', onclick: e => { e.stopPropagation(); buyPhp(b); } }, '💎 Buy — PHP ' + b.pricePhp);
    return h('button', { class: 'btn', onclick: e => { e.stopPropagation(); UI.show('godshop'); } }, 'Open the shop');
  }
  function realityCard(b) {
    const ok = canUseBall(b), cv = ballCanvas(b, 92, { big: true }), m = masteryOf(b); UI.addLive(cv, b, { size: 92 });
    return h('div', { class: 'rg-card ' + CLASS[b.id] },
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, cv, h('div', { style: { minWidth: 0 } },
        h('div', { class: 'cls' }, (b.godClass || 'REALITY GOD') + ' • NEW 2.9.0'), h('div', { class: 'nm' }, b.name), h('div', { class: 'price' }, ok ? h('span', { class: 'rg-own' }, '✔ YOU OWN IT') : howToGet(b).text))),
      h('div', { class: 'forms' }, 'Forms: ' + b.forms.map(f => f.name).join(' → ')),
      h('div', { class: 'forms' }, 'Passive: ' + (b.passiveInfo ? b.passiveInfo.name : '') + ' • Ultimates: ' + b.ult.name + ' / ' + b.finalUlt.name),
      m ? h('div', {}, h('small', {}, `God Mastery Lv ${m.lv}${m.next ? ` • ${fmtNum(m.xp)} / ${fmtNum(m.next)} EXP` : ' • MAX'}`), h('div', { class: 'rg-mbar' }, h('i', { style: { width: Math.round(m.pct * 100) + '%' } }))) : null,
      h('div', { class: 'forms' }, achLine(b) + ' • Title: ' + titleName(b) + (m && m.titleOwned ? ' ✔' : ' (God Mastery 10)')),
      h('div', { class: 'row' }, buyButton(b), h('button', { class: 'btn', onclick: () => UI.openGod(b.id) }, '👁 Preview'), h('button', { class: 'btn', onclick: () => Game.tryGod(b.id, 2) }, '▶ Free practice test')));
  }

  /* ---------------- lobby showcase ---------------- */
  const rm = UI.render_menu;
  UI.render_menu = function (...a) {
    const r = rm.apply(this, a);
    try {
      const wrap = $('.menu-wrap'); if (!wrap) return r;
      $('#rgShow')?.remove();
      const gods = IDS.map(id => getBall(id)).filter(Boolean); if (!gods.length) return r;
      const row = h('div', { class: 'rg-row' });
      for (const b of gods) { const cv = ballCanvas(b, 58, { big: true }); this.addLive(cv, b, { size: 58 }); row.append(h('div', { class: 'rg-mini' }, cv, h('b', {}, b.name.replace(/ BALL$/, '')), h('small', { style: { color: canUseBall(b) ? '#69f0ae' : '#ffd54f' } }, canUseBall(b) ? '✔ OWNED' : howToGet(b).text))); }
      const box = h('div', { id: 'rgShow', class: 'rg-show', role: 'button', tabindex: '0', title: 'Open the Supreme God Collection', onclick: () => UI.show('gods29') },
        h('div', { class: 't' }, 'UPDATE ' + RG.VER + ' • EXCLUSIVE SHOWCASE'), h('div', { class: 'v' }, 'REALITY VS ABSOLUTE'), row,
        h('small', { style: { display: 'block', marginTop: '6px', color: '#e0e6f5' } }, 'The Void Below • The Absolute Above • Fate Note Ball — tap to see the Supreme God Collection'));
      const btns = wrap.querySelector('.menu-buttons'); wrap.insertBefore(box, btns);
      if (btns && !$('#menuGods29')) btns.insertBefore(h('button', { class: 'btn gold', id: 'menuGods29', onclick: () => UI.show('gods29') }, '✦ Supreme God Collection'), btns.children[2] || null);
    } catch (e) { /* the showcase is optional */ }
    return r;
  };

  /* ---------------- ✦ SUPREME GOD COLLECTION (own screen) ---------------- */
  { const sec = document.createElement('section'); sec.id = 'scr-gods29'; sec.className = 'screen';
    sec.innerHTML = '<header class="scr-head"><button class="back" data-back>‹ Back</button><h2>✦ Supreme God Collection <small id="gods29Count"></small></h2><div class="pill">🪙 <b class="coinVal">0</b></div></header><div class="scr-body" id="gods29Body"></div>';
    ($('#screens') || document.body).appendChild(sec);
    sec.querySelector('[data-back]').addEventListener('click', () => UI.show('menu')); }
  const F = { q: '', sort: 'default', filter: 'all' };
  UI.render_gods29 = async function () {
    const body = $('#gods29Body'); if (!body) return; body.innerHTML = '';
    loadMe().then(() => { if (UI.current === 'gods29' && ME && !body.dataset.me) { body.dataset.me = 1; UI.render_gods29(); } });
    const tools = h('div', { class: 'rg-tools' });
    const q = h('input', { type: 'search', placeholder: '🔍 Search God Balls, forms, skills…', value: F.q, 'aria-label': 'Search', oninput: e => { F.q = e.target.value; draw(); } });
    const so = h('select', { 'aria-label': 'Sort', onchange: e => { F.sort = e.target.value; draw(); } }, [['default', 'Sort: newest'], ['name', 'Sort: name'], ['owned', 'Sort: owned first'], ['price', 'Sort: price'], ['mastery', 'Sort: mastery']].map(([v, l]) => h('option', { value: v, selected: F.sort === v }, l)));
    tools.append(q, so);
    const chips = h('div', { class: 'rg-tools' });
    for (const [k, l] of [['all', 'All'], ['owned', 'Owned'], ['locked', 'Locked'], ['coins', '🪙 Coins'], ['money', '💎 Real money'], ['pass', '🎫 Battle Pass'], ['limited', '🛡 Limited'], ['reality', '✦ 2.9.0 Reality Gods']])
      chips.append(h('button', { class: 'rg-chip' + (F.filter === k ? ' on' : ''), onclick: () => { F.filter = k; UI.render_gods29(); } }, l));
    const grid = h('div', { class: 'god-grid rg-cards' });
    body.append(h('div', { class: 'gshop-note' }, 'Every God Ball in the game is here. Owned ones show ✔ OWNED (checked by the server). Locked ones show how to get them. You can try any of them for free in Practice.'), tools, chips, grid);
    function draw() {
      let list = godList();
      const ql = F.q.trim().toLowerCase();
      if (ql) list = list.filter(b => [b.name, b.godClass, b.desc, ...(b.forms || []).map(f => f.name), ...(b.skills || []).map(s => s.name), b.ult && b.ult.name].filter(Boolean).join(' ').toLowerCase().includes(ql));
      const fk = F.filter;
      if (fk === 'owned') list = list.filter(canUseBall); else if (fk === 'locked') list = list.filter(b => !canUseBall(b));
      else if (fk === 'reality') list = list.filter(b => b.realityGod); else if (fk !== 'all') list = list.filter(b => howToGet(b).kind === fk);
      const order = godIds();
      const key = { default: b => -order.indexOf(b.id), name: b => b.name, owned: b => (canUseBall(b) ? 0 : 1) + b.name, price: b => howToGet(b).sort, mastery: b => -((masteryOf(b) || {}).lv || 0) };
      const kf = key[F.sort] || key.default; list.sort((a, b) => { const x = kf(a), y = kf(b); return x < y ? -1 : x > y ? 1 : 0; });
      grid.innerHTML = ''; $('#gods29Count').textContent = `(${godList().filter(canUseBall).length} / ${godList().length} owned)`;
      if (!list.length) grid.append(h('p', { class: 'muted' }, 'No God Ball matches.'));
      for (const b of list) grid.append(b.realityGod ? realityCard(b) : godCard(b));
    }
    function godCard(b) {
      const ok = canUseBall(b), cv = ballCanvas(b, 76, { big: true }), how = howToGet(b), m = masteryOf(b); UI.addLive(cv, b, { size: 76 });
      const ed = b.edition && typeof godShopCache !== 'undefined' && godShopCache && godShopCache.edition ? godShopCache.edition[b.id] : null;
      return h('div', { class: 'rg-card', style: { borderColor: rgba(b.design.c2, 0.55) } },
        h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, cv, h('div', { style: { minWidth: 0 } },
          h('div', { class: 'cls' }, (b.godClass || (b.edition ? 'LIMITED EDITION' : 'SUPREME GOD')) + ' • ' + b.rarity), h('div', { class: 'nm' }, b.name), ok ? h('span', { class: 'rg-own' }, '✔ OWNED') : h('span', { class: 'rg-lock' }, '🔒 ' + how.text))),
        b.forms ? h('div', { class: 'forms' }, 'Forms: ' + b.forms.map(f => f.name).join(' → ')) : b.ascension ? h('div', { class: 'forms' }, 'Transformation: ' + b.ascension.name) : null,
        ed && ed.serialLabel ? h('div', { class: 'forms' }, 'Your copy: ' + ed.serialLabel) : null,
        m ? h('small', {}, `Mastery Lv ${m.lv}`) : null,
        h('div', { class: 'forms' }, achLine(b)),
        h('div', { class: 'row' }, ok ? null : h('button', { class: 'btn', onclick: () => UI.show('godshop') }, '💎 Shop'), h('button', { class: 'btn', onclick: () => (b.forms ? UI.openGod(b.id) : UI.openDetail(b.id)) }, '👁 Preview'), b.godBall ? h('button', { class: 'btn', onclick: () => Game.tryGod(b.id, 2) }, '▶ Try') : null));
    }
    draw();
  };

  /* ---------------- shop: the Reality Gods section ---------------- */
  const rgs = UI.render_godshop;
  UI.render_godshop = async function (...a) {
    await rgs.apply(this, a);
    const body = $('#godShopBody'); if (!body) return; $('#rgShop')?.remove();
    await loadMe();
    const gods = IDS.map(id => getBall(id)).filter(b => b && b.enabled !== false); if (!gods.length) return;
    const box = h('div', { id: 'rgShop' }, h('div', { class: 'shop-sec-t' }, '✦ REALITY GODS — UPDATE ' + RG.VER), h('div', { class: 'rg-cards' }, ...gods.map(realityCard)),
      ME && ME.purchases && ME.purchases.length ? h('div', { class: 'gshop-note' }, h('b', {}, 'Your coin purchases: '), ME.purchases.map(p => `${(getBall(p.ball) || { name: p.ball }).name} — 🪙 ${fmtNum(p.coins)} on ${new Date(p.at).toLocaleDateString()}`).join(' • ')) : null,
      h('small', { class: 'muted', style: { display: 'block', margin: '6px 0 12px' } }, 'The Void Below and The Absolute Above: 50,000 coins each (coins only). Fate Note Ball: PHP 99 (GCash, Maya, bank apps — the ball unlocks only after the payment is verified). All three: pay once, yours forever, every form unlocked.'));
    body.insertBefore(box, body.querySelector('#storePass') || body.firstChild);
  };
  /* the lock label of a coin-bought God Ball */
  const bc = UI.ballCard;
  UI.ballCard = function (b, o = {}) { const c = bc.call(this, b, o); if (b && b.coinGod) { const l = c.querySelector('.lock'); if (l) l.textContent = '🪙 ' + fmtNum(b.coinPrice); } return c; };

  /* ---------------- battle setup: arena + the secret Archon ---------------- */
  const rset = UI.renderSetup;
  UI.renderSetup = function (...a) {
    const r = rset.apply(this, a);
    try {
      const S = Game.setup, card = $('#selectSetup .setup-card'); if (!card) return r;
      const start = [...card.querySelectorAll('button.btn.big')].pop();
      if (S.mode === 'boss') {
        const sel = [...card.querySelectorAll('label.field')].find(l => l.textContent.startsWith('Boss'))?.querySelector('select');
        const open = online() ? !!(ME && ME.archon && ME.archon.unlocked) : archonUnlocked(SAVE.stats.bossWins, IDS.some(id => canUseBall(getBall(id))));
        if (sel) { sel.append(h('option', { value: open ? 'fracturedarchon' : '', disabled: !open, selected: S.boss === 'fracturedarchon' && open }, open ? '✦ THE FRACTURED ARCHON — SECRET COSMIC BOSS' : '??? — sealed (win 3 Boss Battles or own a Reality God)'));
          if (!open && S.boss === 'fracturedarchon') S.boss = 'ancientgod'; }
        if (!ME && online()) loadMe().then(() => { if (UI.current === 'select' && Game.setup.mode === 'boss') UI.renderSetup(); });
        if (S.boss === 'fracturedarchon') card.insertBefore(h('p', { class: 'muted', style: { fontSize: '12px', margin: 0 } }, 'THE FRACTURED ARCHON always fights in the REALITY COLLISION ZONE. Three phases: Fractured Awakening → Cosmic Rupture (66%) → Absolute Collapse (33%). Every attack is marked before it lands. Rewards: coins, God Mastery, the ARCHON BREAKER title and an aura.'), start);
      }
      if (S.mode !== 'tournament' && !(S.mode === 'boss' && S.boss === 'fracturedarchon')) {
        const o = h('div', { class: 'opts' });
        for (const [k, l] of [['classic', 'Neon Arena'], ['collision', '✦ REALITY COLLISION ZONE']]) o.append(h('button', { class: 'opt' + ((S.arena || 'classic') === k ? ' active' : ''), onclick: () => { S.arena = k; this.renderSetup(); } }, l));
        card.insertBefore(h('div', { class: 'field' }, h('span', {}, 'Arena'), o), start);
        if (S.arena === 'collision') card.insertBefore(h('p', { class: 'muted', style: { fontSize: '12px', margin: 0 } }, 'Crimson side: gravity well and void rifts. Golden side: repulsor and law pulses. Centre: the collision core. Crystal pillars block balls and shots; floating platforms give +12% speed. Every hazard is marked first and hits everyone the same way.'), start);
      }
    } catch (e) { /* setup extras are optional */ }
    return r;
  };

  /* ---------------- in battle: Fate Notebook + Reality Clash ---------------- */
  const hud = h('div', { id: 'rgHud' }); document.body.appendChild(hud);
  const bookBtn = h('button', { class: 'btn', title: 'Fate Notebook', onclick: () => toggleBook() }, '📖 NOTEBOOK');
  const clashBtn = h('button', { id: 'rgClash', onclick: () => press() }, '⚔ PRESS!'), clashWrap = h('div', { id: 'rgClashWrap' }); document.body.appendChild(clashWrap);
  let book = null, bookT = 0;
  const me = () => (BATTLE && !BATTLE.cfg.demo && !BATTLE.over ? BATTLE.player : null);
  function press() { const B = BATTLE, pl = me(); if (!B || !pl || !B.clash || !B.clash.rc) return; B.queue('c', 0); Sound.play('click'); }
  addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === 'c' || e.key === 'C') && BATTLE && BATTLE.clash && BATTLE.clash.rc && me()) { press(); } });
  function toggleBook(force) { if (book && force !== true) { book.remove(); book = null; return; } if (!book) { book = h('div', { id: 'rgBook', role: 'dialog', 'aria-label': 'Fate Notebook' }); document.body.appendChild(book); } drawBook(); }
  const fmtT = v => (Math.max(0, v || 0)).toFixed(1) + 's';
  function drawBook() {
    const B = BATTLE, pl = me(); if (!book) return;
    if (!B || !pl || !isRG(pl, 'fatenote')) { book.remove(); book = null; return; }
    const S = pl.sx || {}, E = Math.round(S.rgE || 0);
    book.innerHTML = '';
    book.append(h('button', { class: 'close', 'aria-label': 'Close', onclick: () => toggleBook() }, '✕'), h('h3', {}, '📖 FATE NOTEBOOK'),
      h('div', { class: 'sub' }, 'Only what happens in this match. Write a name, then use NAME OF DESTINY (on AUTO it writes the most dangerous name by itself).'),
      h('div', { class: 'meta' }, S.fateReady ? '✦ FATE IS WRITTEN — the next seal is an ABSOLUTE SEAL' : 'Fate Energy ' + E + '%'), h('div', { class: 'rg-energy' }, h('i', { style: { width: (S.fateReady ? 100 : E) + '%' } })));
    const foes = B.fighters.filter(e => e.alive && e.team !== pl.team && !e.isClone && !e.minion);
    if (!foes.length) book.append(h('div', { class: 'meta' }, 'No opponent left.'));
    for (const e of foes) {
      const T = e.sx || {}, rev = T.revealT > 0 && T.revealTeam === pl.team, chosen = S.fateTgt === e;
      const status = RG_BAD.filter(k => e.st[k] > 0).map(k => k.toUpperCase() + ' ' + fmtT(e.st[k]));
      const res = [['DELETION', T.delImmT], ['SUPPRESSION', T.suppImmT], ['CHAINS', T.bindImmT], ['SENTENCE', T.sentImmT]].filter(([, v]) => v > 0).map(([k, v]) => k + ' ' + fmtT(v));
      const meta = h('div', { class: 'meta' },
        h('b', {}, String(e.tag || e.def.name)), h('br'), `${e.def.name} • HP ${Math.round(e.hpRatio * 100)}%${e.boss ? ' • BOSS' : ''}`, h('br'),
        T.seal && T.sealT > 0 ? (T.seal.by === pl ? `✎ ${T.seal.enh ? 'ABSOLUTE ' : ''}SEALED ${fmtT(T.sealT)}` : 'sealed by another Fate Note') : 'not sealed',
        T.sentence ? ` • ⌛ SENTENCE ${fmtT(T.sentence.t)} (broken at ${RG.SENTENCE.hits} hits: ${T.sentence.hits}/${RG.SENTENCE.hits})` : '', T.bindT > 0 ? ' • ⛓ BOUND ' + fmtT(T.bindT) : '', h('br'),
        status.length ? 'Effects: ' + status.join(', ') : 'Effects: none', h('br'),
        res.length ? 'Resistance: ' + res.join(', ') : 'Resistance: none', h('br'),
        rev ? h('span', {}, '👁 ', fnWeakness(e), ' • ', ...(e.skills || []).filter(s => !s.locked && !s.disabled).map(s => h('span', { class: 'cd' }, s.name + ' ' + (s.supp29 > B.time ? 'SEALED' : s.cdLeft > 0 ? fmtT(s.cdLeft) : 'READY'))), h('span', { class: 'cd' }, 'ULT ' + Math.round(e.ultMeter) + '%'))
          : h('i', {}, 'Cooldowns hidden — use SHINIGAMI VISION to reveal them.'));
      book.append(h('div', { class: 'foe' }, meta, h('button', { class: 'write' + (chosen ? ' chosen' : ''), onclick: () => { B.queue('t', e.sid); Sound.play('click'); setTimeout(drawBook, 80); } }, chosen ? '✎ CHOSEN' : '✎ WRITE')));
    }
    const log = (B.fateLog || []).filter(x => x.by === pl.sid).slice(-12).reverse();
    book.append(h('div', { class: 'sub', style: { marginTop: '8px' } }, 'SEAL HISTORY (this match)'), h('div', { class: 'log' }, log.length ? log.map(x => h('div', {}, `${x.t}s — ${x.kind}: ${x.name}`)) : 'Nothing written yet.'));
  }
  function tick() {
    const pl = me(), B = BATTLE;
    const fate = !!(pl && isRG(pl, 'fatenote')), c = B && B.clash, k = c && c.rc && pl ? (pl === c.a ? 'a' : pl === c.b ? 'b' : null) : null;
    const showClash = !!(k && c.rc[k] == null);
    if (fate && !hud.contains(bookBtn)) hud.append(bookBtn); if (!fate && hud.contains(bookBtn)) bookBtn.remove();
    if (showClash && !clashWrap.contains(clashBtn)) clashWrap.append(clashBtn); if (!showClash && clashWrap.contains(clashBtn)) clashBtn.remove();
    if (book && (!fate || Date.now() - bookT > 250)) { bookT = Date.now(); drawBook(); }
  }
  setInterval(tick, 100);

  /* ---------------- battle results: God Mastery and the Archon's rewards ---------------- */
  if (window.Online) {
    const rx = Online.submitBattle || null;   // (only if this build exposes it)
    if (rx) Online.submitBattle = async function (...a) { const r = await rx.apply(this, a); try { showRewards(r); } catch (e) { /* optional */ } return r; };
  }
  function showRewards(r) {
    const R = r && r.reality; if (!R) return; ME = null;
    if (R.archon) toast(`✦ THE FRACTURED ARCHON DEFEATED${R.archon.first ? ' — FIRST CLEAR!' : ''}${R.archon.coins ? ' +' + fmtNum(R.archon.coins) + ' coins' : ' (daily coin limit reached)'}${R.archon.cosmetics && R.archon.cosmetics.length ? ' + ARCHON BREAKER title & aura' : ''}`, 'gold');
    if (R.mastery) toast(`God Mastery +${fmtNum(R.mastery.gained)} EXP • Lv ${R.mastery.lv}${R.mastery.title ? ' — new title unlocked!' : ''}`, 'gold');
  }
  window.RG_UI = { showRewards, loadMe, godList, howToGet };
})();
