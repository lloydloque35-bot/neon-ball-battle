/* =====================================================================
   NEON BALL BATTLE — ONLINE CLIENT (accounts, cloud save, premium, rankings,
   fusion, customization, owner dashboard).
   The game works fully offline in Guest mode. When the game server is reachable,
   players can sign in: their progress then lives on the server, and every battle,
   purchase and reward is verified there. Nothing here is trusted by the server.
   ===================================================================== */
'use strict';

/* ---------------- API client ---------------- */
const API = {
  csrf: '',
  async call(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && this.csrf) headers['X-CSRF-Token'] = this.csrf;
    const r = await fetch(path, { method, credentials: 'same-origin', headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let data = {}; try { data = await r.json(); } catch { /* no body */ }
    if (data && data.csrf) this.csrf = data.csrf;
    if (!r.ok) { const e = new Error(data.error || `Request failed (${r.status})`); e.status = r.status; e.code = data.code; throw e; }
    return data;
  },
  get(p) { return this.call('GET', p); },
  post(p, b = {}) { return this.call('POST', p, b); },
  del(p) { return this.call('DELETE', p); },
};
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const usd = n => '$' + Number(n).toFixed(2).replace(/\.00$/, '');
const dateStr = t => t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

/* ---------------- session & cloud save ---------------- */
const Online = {
  available: false, active: false, me: null, save: null, events: null, announcement: '', payments: null, guest: null, _st: 0,
  isOwner() { return !!(this.active && this.me && this.me.user && this.me.user.isOwner); },
  isPremium() { return !!(this.active && this.save && this.save.premium && this.save.premium.active); },
  async init() {
    if (location.protocol === 'file:') return;
    try { const hh = await withTimeout(API.get('/api/health'), 2500); this.available = !!hh.ok; } catch { return; }
    try { this.announcement = (await API.get('/api/announcement')).text || ''; } catch { /* optional */ }
    const me = await API.get('/api/auth/me');
    this.payments = me.payments;
    if (me.user) await this.enter(me, true);
    this.handleHash();
    if (UI.current) UI.show(UI.current);
  },
  async enter(me, quiet) {
    this.me = me; if (!this.guest) this.guest = SAVE; this.active = true;
    await this.refresh();
    if (!quiet) toast(`☁ Signed in as <b>${esc(me.user.username)}</b>. Your progress is saved in the cloud.`, 'gold');
  },
  async refresh() {
    this.applySave(await API.get('/api/save'));
    try { this.events = (await API.get('/api/events')).events; } catch { this.events = null; }
  },
  applySave(s) {
    this.save = s;
    if (s.monthlyCoins && s.monthlyCoins.available && !this._mcHint) { this._mcHint = true; setTimeout(() => toast(`🎁 Your ${fmtNum(s.monthlyCoins.amount)} monthly Premium coins are ready! Open ★ Premium to claim them.`, 'gold'), 1200); }
    if (s.season && s.season.pending && s.season.pending.length && !this._seasonHint) { this._seasonHint = true; setTimeout(() => toast('🏆 Last season is over: your season rewards are waiting in 🌐 Online &amp; Ranked.', 'gold'), 2400); }
    const base = defaultSave();
    SAVE = Object.assign(base, {
      coins: s.coins, balls: s.balls, stats: { ...base.stats, ...s.stats }, achievements: s.achievements, collectionClaimed: s.collectionClaimed,
      limited: s.limited, eventProgress: s.eventProgress, settings: { ...DEFAULT_SETTINGS, ...((this.guest && this.guest.settings) || {}), ...s.settings },
      last: (this.guest && this.guest.last) || base.last,
    });
    setCatalog(s.catalog);
    if (s.tournament) Game.tour = s.tournament; else if (Game.tour && Game.tour.id) Game.tour = null;
    refreshCoins(); Sound.applyVolume();
  },
  async logout(all) {
    try { await API.post(all ? '/api/auth/logout-all' : '/api/auth/logout'); } catch { /* already signed out */ }
    this.leave(); toast('Signed out. You are playing as Guest on this device.');
  },
  leave() { UI.acctTab = 'signin'; this.active = false; this.me = null; this.save = null; this.events = null; API.csrf = ''; CATALOG = null; loadSave(); invalidateRegistry(); this.guest = null; refreshCoins(); },
  syncSettings() {
    clearTimeout(this._st);
    this._st = setTimeout(() => { if (this.active) API.post('/api/settings', SAVE.settings).catch(() => {}); }, 800);
  },
  async post(path, body) { const r = await API.post(path, body); if (r.save) this.applySave(r.save); return r; },
  /* battles: the server issues the ticket and verifies the result */
  async startBattle(S) {
    const r = await API.post('/api/battle/start', { mode: S.mode, ball: S.ball, enemy: S.enemy, ally: S.ally, difficulty: S.difficulty, ffaCount: S.ffaCount, boss: S.boss, infinite: S.infinite, dummy: S.dummy, manual: S.manual, trial: !!S.trial, ...(S.adminTest ? { adminTest: true, startForm: S.startForm | 0 } : {}) });
    return r.ticket;
  },
  async tourStart(S) { return (await API.post('/api/tournament/start', { ball: S.ball, difficulty: S.difficulty })).tour; },
  async tourTicket() { return (await API.post('/api/tournament/ticket', { manual: SAVE.settings.control === 'manual' })).ticket; },
  async finishBattle(T, B) {
    const res = B.result, inputs = B.rec.filter(x => x[0] <= res.step);
    const r = await API.post('/api/battle/finish', { id: T.id, inputs, claimed: { win: res.win, step: res.step } });
    if (r.save) this.applySave(r.save);
    if (r.tour) Game.tour = r.tour;
    const sr = r.result || {};
    return { ...sr, mode: sr.mode || T.mode, stats: sr.stats || res.stats, time: sr.time ?? res.time, coins: r.coins || 0, exp: r.exp || 0, ups: r.ups || 0, level: r.level,
      ballId: T.teams[0][0].ball, extraMsg: r.extraMsg, tourMsg: r.tourMsg, verified: !!r.verified, mismatch: !!r.mismatch, newAchievements: r.newAchievements, win: !!sr.win };
  },
  /* owner dashboard gate: sign in → owner → fresh 2FA */
  async ownerAccess() {
    if (!this.available) return UI.modal(`<h2>♛ Admin Dashboard</h2><p>The Admin Dashboard is private and runs on the <b>game server</b>. It opens only for the verified game owner (password + two-factor authentication).</p><p class="muted">This copy of the game is not connected to a game server, so it runs in Guest mode. See <b>docs/DEPLOYMENT.md</b> to start the server and create the owner account.</p>`);
    if (!this.active) { toast('Sign in with the owner account to open the Admin Dashboard'); return UI.show('account'); }
    if (!this.isOwner()) return UI.modal('<h2>♛ Owner only</h2><p>The Admin Dashboard is only available to the verified game owner. Premium memberships never include admin access.</p>');
    if (!this.me.user.ownerVerified && !(await this.mfaPrompt())) return;
    UI.show('admin');
  },
  mfaPrompt() {
    return new Promise(resolve => {
      const inp = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 12, placeholder: '123456', id: 'mfaCode' });
      const go = async () => {
        try { this.me = await API.post('/api/auth/mfa', { code: inp.value.trim() }); UI.closeModal(); resolve(true); }
        catch (e) { toast('⚠ ' + esc(e.message), 'bad'); inp.select(); }
      };
      inp.addEventListener('keydown', e => e.key === 'Enter' && go());
      UI.modal(h('div', { style: { maxWidth: '420px', margin: 'auto' } }, h('h2', {}, '🔐 Two-factor check'), h('p', { class: 'muted' }, 'Enter the 6-digit code from your authenticator app (or a recovery code) to continue to the Admin Dashboard.'),
        h('label', { class: 'field' }, h('span', {}, 'Authenticator code'), inp), h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, h('button', { class: 'btn', onclick: () => { UI.closeModal(); resolve(false); } }, 'Cancel'), h('button', { class: 'btn admin', onclick: go }, 'Verify'))));
      setTimeout(() => inp.focus(), 50);
    });
  },
  /** retries an admin call once after a 2FA step-up when the server asks for it */
  async admin(fn) {
    try { return await fn(); }
    catch (e) { if (e.code === 'MFA_REQUIRED' && await this.mfaPrompt()) return fn(); throw e; }
  },
  handleHash() {
    const hs = location.hash;
    if (hs.startsWith('#billing=')) {
      history.replaceState(null, '', location.pathname);
      if (hs === '#billing=success') { toast('✔ Payment submitted. Premium switches on as soon as Stripe confirms it, usually within a minute.', 'gold'); this.pollPremium(); UI.show('membership'); }
      else toast('Checkout cancelled. You were not charged.');
    } else if (hs.startsWith('#reset=')) {
      const token = hs.slice(7); history.replaceState(null, '', location.pathname);
      UI.acctTab = 'reset'; UI.resetToken = token; UI.show('account');
    }
  },
  async pollPremium(n = 0) {
    if (!this.active || n > 12) return;
    await this.refresh();
    if (this.isPremium()) { toast('★ Ultimate Premium is active. Enjoy every ball!', 'gold'); if (UI.current === 'membership') UI.render_membership(); return; }
    setTimeout(() => this.pollPremium(n + 1), 5000);
  },
  victoryFx(container) {
    const kind = this.active && this.save && this.save.loadout && this.save.loadout.victory; if (!kind) return;
    const c = h('canvas', { class: 'victory-fx', width: 720, height: 260, 'aria-hidden': 'true' }); container.prepend(c);
    const ctx = c.getContext('2d'), parts = [], t0 = performance.now();
    const cols = kind === 'win_supernova' ? ['#fff59d', '#ffd54f', '#ffffff'] : ['#ff1744', '#ffea00', '#00e676', '#00b0ff', '#d500f9', '#ffffff'];
    const burst = (x, y, n, sp) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.4, c: cols[i % cols.length] }); } };
    if (kind === 'win_supernova') burst(360, 130, 160, 260);
    const step = () => {
      const t = (performance.now() - t0) / 1000; if (t > 4 || !c.isConnected) return;
      if (kind === 'win_fireworks' && Math.random() < 0.08) burst(80 + Math.random() * 560, 40 + Math.random() * 120, 50, 160);
      if (kind === 'win_confetti' && t < 2.5) for (let i = 0; i < 4; i++) parts.push({ x: Math.random() * 720, y: -10, vx: (Math.random() - 0.5) * 40, vy: 80 + Math.random() * 80, life: 3, c: cols[(Math.random() * cols.length) | 0], sq: true });
      ctx.clearRect(0, 0, 720, 260); ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= 1 / 60; if (p.life <= 0) { parts.splice(i, 1); continue; } p.x += p.vx / 60; p.y += p.vy / 60; p.vy += (p.sq ? 10 : 60) / 60; ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = p.c; if (p.sq) ctx.fillRect(p.x, p.y, 6, 9); else { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); } }
      requestAnimationFrame(step);
    };
    step();
  },
};
window.Online = Online;

/* ---------------- screens ---------------- */
const needServer = (title = 'Online feature') => h('div', { class: 'card notice' }, h('h3', {}, '☁ ' + title + ' needs the game server'),
  h('p', { class: 'muted' }, 'This copy of the game is running without a game server, so you are playing in Guest mode and your progress is saved on this device only. Accounts, cloud save, online PvP, Premium, rankings, fusion and customization become available when the game is opened from its server (see docs/DEPLOYMENT.md).'));
const needSignIn = what => h('div', { class: 'card notice' }, h('h3', {}, `Sign in to use ${what}`), h('p', { class: 'muted' }, 'Create a free account to keep your progress in the cloud and use it on any device.'), h('button', { class: 'btn primary', onclick: () => UI.show('account') }, '👤 Sign in or create an account'));
const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', { class: 'muted' }, hint) : null);
const input = (id, type = 'text', attrs = {}) => h('input', { id, type, ...attrs });

function showRecoveryCodes(codes, title = 'Save your recovery codes') {
  const text = codes.join('\n');
  UI.modalLocked = true;
  UI.modal(h('div', { style: { maxWidth: '520px', margin: 'auto' } }, h('h2', {}, '🔑 ' + title),
    h('p', {}, 'If you lose your password or change phones, one of these codes gets you back into your account. Each code works once. Store them somewhere safe and offline — they will not be shown again.'),
    h('pre', { class: 'codes', tabindex: '0' }, text),
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
      h('button', { class: 'btn', onclick: e => { navigator.clipboard?.writeText(text).then(() => toast('Codes copied'), () => { const pre = e.target.closest('.modal-box').querySelector('pre'); const r = document.createRange(); r.selectNodeContents(pre); getSelection().removeAllRanges(); getSelection().addRange(r); }); } }, '⧉ Copy'),
      h('button', { class: 'btn primary', onclick: () => { UI.modalLocked = false; UI.closeModal(); UI.show(UI.current || 'menu'); } }, 'I saved them'))));
}

Object.assign(UI, {
  acctTab: 'signin', resetToken: '',
  render_account() {
    const body = $('#accountBody'); body.innerHTML = '';
    if (!Online.available) return body.append(needServer('Accounts and cloud save'));
    if (Online.active) return this.renderAccountSignedIn(body);
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    for (const [k, l] of [['signin', 'Sign in'], ['register', 'Create account'], ['recover', 'Recover account'], ['reset', 'Reset by email']])
      tabs.append(h('button', { class: 'tab' + (this.acctTab === k ? ' active' : ''), role: 'tab', 'aria-selected': this.acctTab === k ? 'true' : 'false', onclick: () => { this.acctTab = k; this.render_account(); } }, l));
    const card = h('form', { class: 'card auth-card', onsubmit: e => e.preventDefault() });
    const submit = (label, fn) => h('button', { class: 'btn primary big', type: 'submit', onclick: async () => { try { await fn(); } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); } } }, label);
    if (this.acctTab === 'signin') {
      const code = input('loginCode', 'text', { inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: 'Only if 2FA is on' });
      card.append(h('h3', {}, 'Welcome back'), field('Username or email', input('loginUser', 'text', { autocomplete: 'username', maxlength: 64 })), field('Password', input('loginPass', 'password', { autocomplete: 'current-password', maxlength: 128 })), field('2FA code', code),
        submit('Sign in', async () => {
          try { const me = await API.post('/api/auth/login', { username: $('#loginUser').value.trim(), password: $('#loginPass').value, code: code.value.trim() || undefined }); await Online.enter(me); this.show('menu'); }
          catch (e) { if (e.code === 'MFA_REQUIRED') { toast('Enter the 6-digit code from your authenticator app'); code.focus(); } else throw e; }
        }));
    } else if (this.acctTab === 'register') {
      card.append(h('h3', {}, 'Create a free account'), h('p', { class: 'muted' }, 'Your account keeps your balls, levels, coins and achievements in the cloud. Progress from Guest mode stays on this device — server-verified accounts start fresh so rankings stay fair.'),
        field('Username', input('regUser', 'text', { autocomplete: 'username', maxlength: 20 }), '3-20 letters, numbers or _'), field('Email (optional)', input('regEmail', 'email', { autocomplete: 'email', maxlength: 254 }), 'Only used for password resets'),
        field('Password', input('regPass', 'password', { autocomplete: 'new-password', maxlength: 128 }), 'At least 10 characters'), field('Repeat password', input('regPass2', 'password', { autocomplete: 'new-password', maxlength: 128 })),
        submit('Create account', async () => {
          if ($('#regPass').value !== $('#regPass2').value) throw new Error('The passwords do not match');
          const r = await API.post('/api/auth/register', { username: $('#regUser').value.trim(), email: $('#regEmail').value.trim() || undefined, password: $('#regPass').value });
          await Online.enter(r); showRecoveryCodes(r.recoveryCodes);
        }));
    } else if (this.acctTab === 'recover') {
      card.append(h('h3', {}, 'Recover with a recovery code'), h('p', { class: 'muted' }, 'Use one of the recovery codes you saved when you created the account. This also works after changing phones.'),
        field('Username', input('recUser', 'text', { autocomplete: 'username' })), field('Recovery code', input('recCode', 'text', { placeholder: 'ABCDE-FGHIJ' })), field('New password', input('recPass', 'password', { autocomplete: 'new-password' })),
        submit('Reset password', async () => { await API.post('/api/auth/recover', { username: $('#recUser').value.trim(), recoveryCode: $('#recCode').value.trim(), newPassword: $('#recPass').value }); toast('✔ Password changed. Sign in with your new password.', 'gold'); this.acctTab = 'signin'; this.render_account(); }));
    } else {
      if (this.resetToken) card.append(h('h3', {}, 'Choose a new password'), field('New password', input('rsPass', 'password', { autocomplete: 'new-password' })),
        submit('Save new password', async () => { await API.post('/api/auth/reset', { token: this.resetToken, newPassword: $('#rsPass').value }); this.resetToken = ''; toast('✔ Password changed. Sign in again.', 'gold'); this.acctTab = 'signin'; this.render_account(); }));
      else card.append(h('h3', {}, 'Reset by email'), h('p', { class: 'muted' }, 'If your account has an email address, we will send a reset link (valid for 1 hour).'), field('Email', input('fgEmail', 'email', { autocomplete: 'email' })),
        submit('Send reset link', async () => { const r = await API.post('/api/auth/forgot', { email: $('#fgEmail').value.trim() }); toast(r.mail === false ? 'Email reset is not set up on this server. Use a recovery code instead.' : 'If that email belongs to an account, a reset link is on its way.'); }));
    }
    body.append(tabs, card, h('p', { class: 'muted small' }, 'Not ready? Keep playing as Guest — everything works offline and is saved on this device.'));
  },
  renderAccountSignedIn(body) {
    const u = Online.me.user, prem = Online.save.premium;
    const info = h('div', { class: 'card' }, h('h3', {}, (u.isOwner ? '♛ ' : '') + u.username + (prem.active ? ' ' : ''), prem.active ? h('span', { class: 'badge-premium' }, '★ PREMIUM') : null, u.isOwner ? h('span', { class: 'badge-owner' }, 'OWNER') : null),
      h('p', { class: 'muted' }, `☁ Cloud save active — level ${Online.save.level}, ${fmtNum(Online.save.coins)} coins, ${Object.values(Online.save.balls).filter(b => b.owned).length} balls.`),
      u.status === 'suspended' ? h('p', { class: 'warn' }, `Your account is suspended until ${dateStr(u.suspendedUntil)}${u.statusReason ? ': ' + u.statusReason : ''}.`) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => this.show('profile') }, '🎨 Profile'), h('button', { class: 'btn gold', onclick: () => this.show('membership') }, '★ Membership'),
        h('button', { class: 'btn', onclick: () => Online.logout(false).then(() => this.show('menu')) }, 'Sign out'), h('button', { class: 'btn danger', onclick: () => Online.logout(true).then(() => this.show('menu')) }, 'Sign out on all devices')));
    const sec = h('div', { class: 'card' }, h('h3', {}, '🔐 Security'));
    if (u.totpEnabled) sec.append(h('p', {}, '✔ Two-factor authentication is on.'), u.isOwner ? h('p', { class: 'muted small' }, 'The owner account must keep 2FA. A lost phone is handled with the server tool: npm run owner -- reset-2fa') : h('button', { class: 'btn small', onclick: () => this.disable2fa() }, 'Turn off 2FA'));
    else sec.append(h('p', { class: 'muted' }, 'Protect your collection with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).'), h('button', { class: 'btn primary', onclick: () => this.setup2fa() }, 'Turn on two-factor authentication'));
    sec.append(h('p', { class: 'muted small' }, `Recovery codes left: ${u.recoveryCodesLeft}`), h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => this.passwordPrompt('New recovery codes', 'Generate', async pw => { const r = await API.post('/api/auth/recovery-codes', { password: pw }); showRecoveryCodes(r.recoveryCodes, 'Your new recovery codes'); }) }, 'New recovery codes'),
      h('button', { class: 'btn small', onclick: () => this.changePassword() }, 'Change password')));
    body.append(h('div', { class: 'grid2' }, info, sec));
  },
  passwordPrompt(title, label, fn) {
    const pw = input('pwPrompt', 'password', { autocomplete: 'current-password' });
    this.modal(h('form', { style: { maxWidth: '420px', margin: 'auto' }, onsubmit: e => e.preventDefault() }, h('h2', {}, title), field('Your password', pw),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, h('button', { class: 'btn primary', type: 'submit', onclick: async () => { try { await fn(pw.value); } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); } } }, label))));
    setTimeout(() => pw.focus(), 50);
  },
  changePassword() {
    const cur = input('pwCur', 'password', { autocomplete: 'current-password' }), nx = input('pwNew', 'password', { autocomplete: 'new-password' });
    this.modal(h('form', { style: { maxWidth: '420px', margin: 'auto' }, onsubmit: e => e.preventDefault() }, h('h2', {}, 'Change password'), field('Current password', cur), field('New password', nx, 'At least 10 characters'),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, h('button', { class: 'btn primary', type: 'submit', onclick: async () => { try { await API.post('/api/auth/password', { current: cur.value, next: nx.value }); this.closeModal(); toast('✔ Password changed. Other devices were signed out.', 'gold'); } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); } } }, 'Change password'))));
  },
  async setup2fa() {
    try {
      const s = await API.post('/api/auth/2fa/setup');
      const code = input('tfCode', 'text', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6 });
      this.modal(h('div', { style: { maxWidth: '520px', margin: 'auto' } }, h('h2', {}, 'Turn on 2FA'),
        h('p', {}, '1. In your authenticator app, add an account with this key (or tap the link on your phone):'), h('pre', { class: 'codes', tabindex: '0' }, s.secret.match(/.{1,4}/g).join(' ')),
        h('p', {}, h('a', { href: s.otpauth }, 'Open in authenticator app')), h('p', {}, '2. Enter the 6-digit code it shows:'), field('Code', code),
        h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn primary', onclick: async () => { try { const r = await API.post('/api/auth/2fa/enable', { code: code.value.trim() }); Online.me = await API.get('/api/auth/me'); showRecoveryCodes(r.recoveryCodes, '2FA is on — save your recovery codes'); } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); } } }, 'Turn on'))));
    } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); }
  },
  disable2fa() {
    const pw = input('d2Pw', 'password'), code = input('d2Code', 'text', { inputmode: 'numeric' });
    this.modal(h('form', { style: { maxWidth: '420px', margin: 'auto' }, onsubmit: e => e.preventDefault() }, h('h2', {}, 'Turn off 2FA'), field('Password', pw), field('Authenticator code', code),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn danger', type: 'submit', onclick: async () => { try { await API.post('/api/auth/2fa/disable', { password: pw.value, code: code.value.trim() }); Online.me = await API.get('/api/auth/me'); this.closeModal(); this.render_account(); toast('2FA turned off'); } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); } } }, 'Turn off'))));
  },
});

/* ---------------- main menu status ---------------- */
const _renderMenu = UI.render_menu;
UI.render_menu = function () {
  _renderMenu.call(this);
  const acc = $('#menuAccount'), cloud = $('#menuCloud');
  if (Online.active) { acc.textContent = '👤 ' + Online.me.user.username + (Online.isPremium() ? ' ★' : ''); cloud.textContent = '☁ Cloud save'; }
  else { acc.textContent = Online.available ? '👤 Sign in' : '👤 Account'; cloud.textContent = '💾 Guest (this device)'; }
  if (Online.available && Online.announcement) $('#menuAnnounce').innerHTML = '📢 ' + esc(Online.announcement);
};

/* ---------------- profile, daily rewards, customization ---------------- */
Object.assign(UI, {
  render_profile() {
    const body = $('#profileBody'); body.innerHTML = '';
    if (!Online.available) return body.append(needServer('Profiles and customization'));
    if (!Online.active) return body.append(needSignIn('profiles, daily rewards and customization'));
    const s = Online.save, u = Online.me.user, st = s.stats || {};
    const avatar = getBall(s.avatar) || getBall('fire');
    const cv = ballCanvas(avatar, 150, { big: true }); this.addLive(cv, avatar, { size: 150, big: true, draw: l => { const lo = resolveCos(s.loadout) || {}; drawPreviewCos(cv, avatar, lo, l.rot); } });
    const usable = playableBalls().filter(b => !b.adminOnly || u.isOwner);
    const sel = (key, val) => h('select', { 'aria-label': key, onchange: e => act(() => Online.post('/api/profile', { [key]: e.target.value }), () => this.render_profile()) }, usable.map(b => h('option', { value: b.id, selected: b.id === val }, b.name)));
    const card = h('div', { class: 'card profile-card' }, cv, h('div', { style: { flex: 1, minWidth: '240px' } },
      h('h2', { style: { margin: '0 0 4px' } }, u.username, ' ', s.premium.active ? h('span', { class: 'badge-premium' }, '★ PREMIUM') : null, u.isOwner ? h('span', { class: 'badge-owner' }, 'OWNER') : null),
      h('div', { class: 'muted' }, `Player level ${s.level} • ${fmtNum(s.rp)} battle points`), s.season ? h('div', { class: 'tier-line', style: { color: s.season.tier.col } }, `${s.season.tier.ico} ${s.season.tier.name} • ${fmtNum(s.season.points)} season points`) : null, h('div', { class: 'bar exp', style: { margin: '6px 0 10px' } }, h('i', { style: { width: (s.exp / s.accountExpNeed * 100) + '%' } })),
      h('div', { class: 'fgrid' }, field('Avatar ball', sel('avatar', s.avatar)), field('Favorite ball', sel('favorite', s.favorite))),
      h('div', { class: 'results-stats', html: [['Battles', st.battles || 0], ['Wins', st.wins || 0], ['Losses', st.losses || 0], ['KOs', st.kills || 0], ['Tournaments', st.tourneyWins || 0], ['Bosses', st.bossWins || 0]].map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('') })));
    body.append(card);
    // daily rewards
    const d = s.daily, cal = h('div', { class: 'daily' });
    d.rewards.forEach((r, i) => {
      const day = i + 1, claimed = d.canClaim ? day < d.nextDay : day <= d.nextDay, today = d.canClaim && day === d.nextDay;
      cal.append(h('div', { class: 'dday' + (claimed ? ' done' : '') + (today ? ' today' : '') }, h('b', {}, 'Day ' + day), r.coins ? h('div', {}, `🪙 ${r.coins * (s.premium.active ? 1.5 : 1)}`) : null, r.exp ? h('div', {}, `✦ ${r.exp} EXP`) : null, r.cosmetic ? h('div', {}, '🎁 ' + (COSMETICS.find(c => c.id === r.cosmetic)?.name || 'Item')) : null));
    });
    body.append(h('div', { class: 'card' }, h('h3', {}, '🎁 Daily login rewards'), h('p', { class: 'muted small' }, `Streak: ${d.streak} day(s). Miss a day and the streak restarts.${s.premium.active ? ' Premium: +50% coins.' : ''}`), cal,
      h('button', { class: 'btn green', disabled: !d.canClaim, onclick: () => act(() => Online.post('/api/daily/claim'), r => { toast(`🎁 Day ${r.day}: ${r.coins ? '+' + r.coins + ' coins ' : ''}${r.exp ? '+' + r.exp + ' EXP ' : ''}${r.cosmetic ? '+ new cosmetic!' : ''}`, 'gold'); this.render_profile(); }) }, d.canClaim ? `Claim day ${d.nextDay}` : 'Claimed today — come back tomorrow')));
    // customization
    const owned = new Set(s.cosmetics), lo = s.loadout || {}, prem = s.premium.active || u.isOwner;
    const shop = h('div', { class: 'card' }, h('h3', {}, '🎨 Customization'), h('p', { class: 'muted small' }, 'Cosmetics change how your ball looks in battle — never its stats.'));
    for (const [slot, label] of Object.entries(COSMETIC_SLOTS)) {
      const row = h('div', { class: 'cos-row' }, h('b', { class: 'cos-slot' }, label));
      row.append(h('button', { class: 'opt' + (!lo[slot] ? ' active' : ''), onclick: () => act(() => Online.post('/api/cosmetics/equip', { slot, id: null }), () => this.render_profile()) }, 'Default'));
      for (const c of COSMETICS.filter(x => x.slot === slot)) {
        const have = c.premium ? prem : owned.has(c.id), on = lo[slot] === c.id;
        const sw = c.color && c.color !== 'rainbow' ? h('i', { class: 'swatch', style: { background: c.color } }) : c.tint ? h('i', { class: 'swatch', style: { background: c.tint } }) : null;
        row.append(have
          ? h('button', { class: 'opt' + (on ? ' active' : ''), onclick: () => act(() => Online.post('/api/cosmetics/equip', { slot, id: c.id }), () => this.render_profile()) }, sw, (c.premium ? '★ ' : '') + c.name)
          : c.premium ? h('button', { class: 'opt locked', onclick: () => this.show('membership') }, sw, '★ ' + c.name + ' (Premium)')
            : h('button', { class: 'opt', onclick: () => act(() => Online.post('/api/cosmetics/buy', { id: c.id }), () => this.render_profile()) }, sw, `${c.name} — 🪙 ${fmtNum(c.price)}`));
      }
      shop.append(row);
    }
    body.append(shop);
  },
});
/* preview with cosmetics applied (aura + skin) */
function drawPreviewCos(canvas, def, cos, rot) {
  const dpr = Math.min(2, devicePixelRatio || 1), size = 150; if (canvas.width !== size * dpr) { canvas.width = canvas.height = size * dpr; }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
  drawBall(ctx, def, size / 2, size / 2 + 4, size * 0.27, { t: performance.now() / 1000, rot, big: true, auraMax: size / 2, auraCol: cos.aura && cos.aura.color, skin: cos.skin });
}

/* ---------------- premium membership ---------------- */
Object.assign(UI, {
  async render_membership() {
    const body = $('#membershipBody'); body.innerHTML = '';
    const hero = h('div', { class: 'card premium-hero' }, h('div', { class: 'premium-price' }, h('span', { class: 'big' }, '$200'), h('span', {}, ' / YEAR')),
      h('h2', { style: { margin: '4px 0' } }, 'ULTIMATE PREMIUM'), h('p', { class: 'muted' }, 'One plan. Every eligible ball, premium cosmetics and bonuses for 365 days.'));
    body.append(hero);
    if (!Online.available) return body.append(needServer('Premium membership'));
    let st = null;
    if (Online.active) { try { st = await API.get('/api/billing/status'); } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); } }
    const plan = st ? st.plan : null, pay = (st && st.payments) || Online.payments || { enabled: false };
    const benefits = (plan && plan.benefits) || ['Unlock every regular, premium, legendary, mythical and non-admin limited ball', 'Premium cosmetics and particle effects', 'Premium badge', '+25% battle rewards', 'Premium-exclusive events'];
    hero.append(h('ul', { class: 'benefits' }, benefits.map(b => h('li', {}, '✔ ' + b))), h('p', { class: 'muted small' }, 'Admin access, admin-exclusive balls and owner-only abilities are never part of Premium.'));
    if (!Online.active) return body.append(needSignIn('Premium'));
    if (st.owner) { body.append(h('div', { class: 'card notice' }, h('h3', {}, '♛ Owner account'), h('p', {}, 'The owner account already has every feature. No subscription is needed.'))); return; }
    const sub = st.subscription, mc = Online.save && Online.save.monthlyCoins;
    if (sub.active && mc) body.append(h('div', { class: 'card monthly-coins' }, h('h3', {}, '🎁 Monthly Premium coins'), h('p', { class: 'muted' }, `Every month, Premium members get ${fmtNum(mc.amount)} free coins.`),
      h('button', { class: 'btn gold', disabled: !mc.available, onclick: () => act(() => Online.post('/api/premium/monthly-coins'), r => { toast(`🎁 +${fmtNum(r.coins)} coins! See you next month.`, 'gold'); this.render_membership(); }) },
        mc.available ? `Claim ${fmtNum(mc.amount)} 🪙 for this month` : 'Claimed this month — come back on the 1st')));
    const STATUS = { free: 'Free', pending: 'Pending payment', active: 'Active', expired: 'Expired', cancelled: 'Cancelled', refunded: 'Refunded', payment_failed: 'Payment failed' };
    const card = h('div', { class: 'card' }, h('h3', {}, 'Your membership'),
      h('div', { class: 'kv' }, ...[['Current plan', sub.active ? 'ULTIMATE PREMIUM' : 'Free'], ['Status', STATUS[sub.status] || sub.status], ['Purchase date', dateStr(sub.startedAt)], ['Expiration date', dateStr(sub.expiresAt)],
        ['Remaining days', sub.active ? String(sub.remainingDays) : '—'], ['Renewal', sub.active ? (sub.autoRenew ? 'Renews automatically' : 'Will not renew') : '—']].flatMap(([k, v]) => [h('span', {}, k), h('b', {}, v)])));
    if (sub.active) {
      if (sub.provider === 'stripe') card.append(sub.autoRenew
        ? h('button', { class: 'btn', onclick: () => this.confirm('Turn off automatic renewal? You keep Premium until ' + dateStr(sub.expiresAt) + '.', () => act(() => API.post('/api/billing/cancel'), () => this.render_membership()), 'Turn off renewal') }, 'Turn off automatic renewal')
        : h('button', { class: 'btn green', onclick: () => act(() => API.post('/api/billing/resume'), () => this.render_membership()) }, 'Turn renewal back on'));
      else card.append(h('p', { class: 'muted small' }, 'This is a promotional membership and does not renew.'));
    } else {
      const disclosure = h('p', { class: 'disclosure' }, plan.disclosure);
      const agree = h('input', { type: 'checkbox', id: 'agreeTerms' });
      card.append(disclosure, h('label', { class: 'chk' }, agree, 'I understand the price and renewal terms'),
        h('button', { class: 'btn gold big', disabled: !pay.enabled, onclick: async () => {
          if (!agree.checked) return toast('Please confirm the price and renewal terms first', 'bad');
          try { const r = await API.post('/api/billing/checkout'); location.href = r.url; } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); }
        } }, pay.enabled ? `Subscribe — $200 / year${pay.mode === 'test' ? ' (TEST MODE)' : ''}` : 'Checkout not available yet'),
        !pay.enabled ? h('p', { class: 'muted small' }, 'The owner has not finished payment setup. No payment can be taken yet.') : pay.mode === 'test' ? h('p', { class: 'muted small' }, 'Sandbox mode: use a Stripe test card. No real money moves.') : null,
        h('p', { class: 'muted small' }, 'Payments are handled by Stripe. Card details never touch the game server.'));
    }
    body.append(card);
    const tbl = h('table', { class: 'admin-table' }, h('tr', {}, ['Date', 'Item', 'Amount', 'Status'].map(t => h('th', {}, t))));
    for (const p of st.history) tbl.append(h('tr', {}, h('td', {}, dateStr(p.at)), h('td', {}, p.description || p.kind), h('td', {}, (p.amount < 0 ? '−' : '') + usd(Math.abs(p.amount)) + ' ' + p.currency), h('td', {}, p.status)));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Transaction history'), st.history.length ? h('div', { style: { overflowX: 'auto' } }, tbl) : h('p', { class: 'muted' }, 'No transactions yet.')));
    // premium trial
    const trial = h('div', { class: 'ball-grid' });
    for (const b of allBalls().filter(x => x.premium && x.enabled && !x.draft)) trial.append(this.ballCard(b, { onclick: () => Game.tryBall(b.id) }));
    body.append(h('div', { class: 'card' }, h('h3', {}, '▶ Try premium balls'), h('p', { class: 'muted small' }, 'Play any premium ball in Practice mode before you decide. Trial battles give no rewards.'), trial));
  },
});

/* ---------------- global rankings ---------------- */
Object.assign(UI, {
  lbBy: 'rp',
  async render_leaderboard() {
    const body = $('#leaderboardBody'); body.innerHTML = '';
    if (!Online.available) return body.append(needServer('Global rankings'));
    const tabs = h('div', { class: 'tabs' });
    for (const [k, l] of [['rp', 'Rank points'], ['wins', 'Wins'], ['level', 'Player level'], ['tourney', 'Tournament wins']]) tabs.append(h('button', { class: 'tab' + (this.lbBy === k ? ' active' : ''), onclick: () => { this.lbBy = k; this.render_leaderboard(); } }, l));
    body.append(tabs);
    let r; try { r = await API.get('/api/leaderboard?by=' + this.lbBy); } catch (e) { return body.append(h('p', { class: 'warn' }, e.message)); }
    const tbl = h('table', { class: 'admin-table lb' }, h('tr', {}, ['#', '', 'Player', 'Level', 'Rank pts', 'Wins', 'Losses', 'Tournaments'].map(t => h('th', {}, t))));
    for (const p of r.list) {
      const b = getBall(p.avatar) || getBall('fire');
      tbl.append(h('tr', { class: (Online.active && p.username === Online.me.user.username) ? 'me' : '', onclick: () => this.publicProfile(p.username), style: { cursor: 'pointer' } },
        h('td', {}, p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : p.rank), h('td', {}, ballCanvas(b, 32, { small: true })), h('td', {}, p.username, p.premium ? h('span', { class: 'badge-premium sm' }, '★') : ''),
        h('td', {}, p.level), h('td', {}, fmtNum(p.rp)), h('td', {}, p.wins), h('td', {}, p.losses), h('td', {}, p.tourneyWins)));
    }
    body.append(r.list.length ? h('div', { style: { overflowX: 'auto' } }, tbl) : h('p', { class: 'muted' }, 'No ranked players yet. Win a verified battle to appear here!'), h('p', { class: 'muted small' }, r.note));
    if (!Online.active) body.append(h('p', {}, h('button', { class: 'btn primary', onclick: () => this.show('account') }, 'Sign in to be ranked')));
    body.append(h('div', { class: 'card notice', style: { marginTop: '12px' } }, h('h3', {}, '🌐 Player-vs-player'), h('p', { class: 'muted' }, 'Real-time online multiplayer and player tournaments are not available yet. Rankings and tournaments currently use server-verified battles against the AI.')));
  },
  async publicProfile(name) {
    try {
      const p = await API.get('/api/players/' + encodeURIComponent(name)), b = getBall(p.avatar) || getBall('fire'), cv = ballCanvas(b, 140, { big: true });
      this.live.push({ canvas: cv, def: b, opts: { size: 140, big: true }, rot: 0, modal: true });
      this.modal(h('div', { style: { textAlign: 'center' } }, cv, h('h2', {}, p.username, ' ', p.premium ? h('span', { class: 'badge-premium' }, '★ PREMIUM') : null),
        h('p', { class: 'muted' }, `Level ${p.level} • ${fmtNum(p.rp)} rank points • favorite: ${getBall(p.favorite)?.name || '—'} • since ${dateStr(p.since)}`),
        h('div', { class: 'results-stats', html: Object.entries({ Battles: p.record.battles, Wins: p.record.wins, Losses: p.record.losses, KOs: p.record.kills, Tournaments: p.record.tourneyWins, 'Best wave': p.record.survivalBest }).map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('') })));
    } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); }
  },
});

/* ---------------- ball fusion ---------------- */
Object.assign(UI, {
  fuseA: null, fuseB: null,
  render_fusion() {
    const body = $('#fusionBody'); body.innerHTML = '';
    if (!Online.available) return body.append(needServer('Ball fusion'));
    if (!Online.active) return body.append(needSignIn('Ball Fusion'));
    const owner = isAdmin();
    const elig = owner ? playableBalls().filter(b => !b.fusion && !b.draft) : allBalls().filter(b => fusionEligible(b) && prog(b.id).owned);
    const ready = owner ? elig : elig.filter(b => prog(b.id).level >= FUSION_MIN_LEVEL);
    body.append(h('p', { class: 'muted' }, owner
      ? `♛ Owner fusion: you can fuse ANY two balls at any level, admin balls included (One Above All, Archangel…). A fusion with an admin ball stays admin-only. Cost: 🪙 ${fmtNum(FUSION_COST)}.`
      : `Combine two balls you own (level ${FUSION_MIN_LEVEL}+) into a brand-new spherical fusion with a new fused ability. Both original balls stay in your collection. Cost: 🪙 ${fmtNum(FUSION_COST)}. Admin, limited, premium and fusion balls cannot be fused.`));
    if (ready.length < 2) body.append(h('div', { class: 'card notice' }, h('p', {}, `You need two eligible balls at level ${FUSION_MIN_LEVEL} or higher. Eligible balls you own: ${elig.map(b => `${b.name} (Lv ${prog(b.id).level})`).join(', ') || 'none'}.`)));
    const pick = (key, label) => h('label', { class: 'field' }, h('span', {}, label), h('select', { onchange: e => { this[key] = e.target.value; this.render_fusion(); } }, h('option', { value: '' }, '— choose —'), ready.map(b => h('option', { value: b.id, selected: this[key] === b.id }, `${b.name} (Lv ${prog(b.id).level})`))));
    const A = getBall(this.fuseA), B = getBall(this.fuseB);
    const box = h('div', { class: 'card fusion-box' }, h('div', { class: 'fgrid' }, pick('fuseA', 'First ball'), pick('fuseB', 'Second ball')));
    if (A && B && A.id !== B.id) {
      const def = makeFusionDef(A, B, 'fusion_preview'), cv = ballCanvas(def, 200, { big: true });
      this.live = this.live.filter(l => l.canvas.isConnected); this.addLive(cv, def, { size: 200, big: true });
      box.append(h('div', { class: 'row', style: { alignItems: 'center', justifyContent: 'center', gap: '18px' } }, ballCanvas(A, 90), h('b', { class: 'plus' }, '+'), ballCanvas(B, 90), h('b', { class: 'plus' }, '='), cv),
        h('h3', { style: { textAlign: 'center' } }, def.name, ' ', h('span', { class: 'rar ' + rarClass(def.rarity) }, def.rarity)),
        h('p', { class: 'muted', style: { textAlign: 'center' } }, `HP ${def.hp} • ATK ${def.atk} • DEF ${def.def} • SPD ${def.spd} • CRIT ${def.crit}% • Abilities: ${def.skills.map(s => s.name).join(', ')} • Ultimate: ${def.ult.name}`),
        h('div', { style: { textAlign: 'center' } }, h('button', { class: 'btn gold big', disabled: SAVE.coins < FUSION_COST, onclick: () => act(() => Online.post('/api/fusion/create', { a: A.id, b: B.id }), r => { toast(`🧬 <b>${esc(r.name)}</b> created!`, 'gold'); Sound.play('evolve'); this.fuseA = this.fuseB = null; this.render_fusion(); }) }, `🧬 Fuse — 🪙 ${fmtNum(FUSION_COST)}`)));
    }
    body.append(box);
    const mine = allBalls().filter(b => b.fusion);
    if (mine.length) { const g = h('div', { class: 'ball-grid' }); mine.forEach(b => g.append(this.ballCard(b, { onclick: () => this.openDetail(b.id) }))); body.append(h('div', { class: 'card' }, h('h3', {}, 'Your fusions'), g)); }
  },
});

/* =====================================================================
   OWNER DASHBOARD (server-backed). Every request is re-checked on the server:
   owner role + 2FA verified recently. The UI is only a view.
   ===================================================================== */
const adminTable = (heads, rows) => { const t = h('table', { class: 'admin-table' }, h('tr', {}, heads.map(x => h('th', {}, x)))); rows.forEach(r => t.append(h('tr', {}, r.map(c => h('td', {}, c ?? ''))))); return h('div', { style: { overflowX: 'auto' } }, t); };
const statCard = (label, value, sub) => h('div', { class: 'stat-card' }, h('b', {}, value), h('span', {}, label), sub ? h('small', { class: 'muted' }, sub) : null);
const adminDo = (fn, after) => Online.admin(fn).then(r => { toast('✔ Done'); after && after(r); return r; }).catch(e => toast('⚠ ' + esc(e.message), 'bad'));
const fmtTs = t => t ? new Date(t).toLocaleString() : '—';

Object.assign(UI, {
  adTab: 'overview',
  render_admin() {
    const tabs = $('#adminTabs'); tabs.innerHTML = '';
    for (const [k, l] of [['overview', '📊 Overview'], ['players', '👥 Players'], ['balls', '◉ Balls'], ...(typeof SUP !== 'undefined' ? [['supreme', '👑 Supreme Balls']] : []), ['events', '✦ Events'], ['money', '★ Premium & Payments'], ['announce', '📢 Announcement'], ['logs', '🛡 Audit & Security'], ['data', '💾 Data']])
      tabs.append(h('button', { class: 'tab admin-tab' + (this.adTab === k ? ' active' : ''), onclick: () => { this.adTab = k; this.render_admin(); } }, l));
    tabs.append(h('button', { class: 'btn admin small', style: { marginLeft: 'auto' }, onclick: () => this.openCreator(null) }, '＋ Create New Ball'));
    const body = $('#adminBody'); body.innerHTML = '<p class="muted">Loading…</p>';
    Online.admin(() => this['admin_' + this.adTab](body)).catch(e => { body.innerHTML = ''; body.append(h('p', { class: 'warn' }, e.message)); });
  },
  async admin_overview(body) {
    const o = await API.get('/api/admin/overview'); body.innerHTML = '';
    const meU = Online.me.user;
    body.append(h('div', { class: 'card premium-hero', style: { marginBottom: '12px' } },
      h('div', { class: 'row', style: { alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' } },
        h('div', {}, h('h3', { style: { margin: 0 } }, `♛ Your account: ${meU.username}`), h('p', { class: 'muted', style: { margin: '4px 0 0' } }, `🪙 ${fmtNum(SAVE.coins)} coins • ${Object.values(SAVE.balls || {}).filter(b => b.owned).length} balls owned`)),
        h('button', { class: 'btn gold', onclick: () => this.adminGrant({ id: meU.id, username: meU.username, role: 'owner' }) }, '🎁 Give myself coins / max-upgrade balls'))));
    body.append(h('div', { class: 'stat-grid' },
      statCard('Players', fmtNum(o.users.total), `${o.users.active7d} active this week`), statCard('Premium members', fmtNum(o.premium.active)),
      statCard('Revenue (all time)', usd(o.revenue.totalUsd), `${usd(o.revenue.last30Usd)} last 30 days • payments ${o.revenue.mode}`),
      statCard('Verified battles', fmtNum(o.battles.total), `${o.battles.today} today`), statCard('Rejected battles (7d)', o.battles.rejected7d, `${o.battles.mismatches7d} result mismatches`),
      statCard('Security alerts (7d)', o.security.serious7d, `${o.security.events7d} events total`), statCard('Suspended / banned', `${o.users.suspended} / ${o.users.banned}`),
      statCard('Custom balls', o.catalog.custom, `${o.catalog.overrides} edited built-ins, ${o.catalog.disabled} disabled`)));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Recent admin activity'), adminTable(['When', 'Who', 'Action', 'Target'], o.recentAudit.map(a => [fmtTs(a.created_at), a.actor || 'system', a.action, a.target]))));
  },
  adQ: '',
  async admin_players(body) {
    const r = await API.get('/api/admin/players?q=' + encodeURIComponent(this.adQ)); body.innerHTML = '';
    const q = h('input', { type: 'search', placeholder: 'Search username or email', value: this.adQ, 'aria-label': 'Search players' });
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { this.adQ = q.value.trim(); this.render_admin(); } });
    body.append(h('div', { class: 'filters' }, q, h('button', { class: 'btn small', onclick: () => { this.adQ = q.value.trim(); this.render_admin(); } }, 'Search')));
    body.append(adminTable(['ID', 'Player', 'Status', 'Level', 'RP', 'Coins', 'Battles', 'Premium', 'Flags', 'Actions'], r.players.map(p => [
      p.id, h('span', {}, p.role === 'owner' ? '♛ ' : '', p.username, h('br'), h('small', { class: 'muted' }, p.email || '')), p.status + (p.suspended_until ? ' until ' + dateStr(p.suspended_until) : ''),
      p.level, p.rp, fmtNum(p.coins), p.battles, p.premium.active ? `★ until ${dateStr(p.premium.expiresAt)}` : p.premium.status, p.flags ? h('b', { class: 'warn' }, p.flags) : '0',
      h('div', { class: 'acts' }, h('button', { class: 'btn small', onclick: () => this.adminPlayer(p.id) }, 'View'),
        h('button', { class: 'btn small gold', onclick: () => this.adminGrant(p) }, 'Grant'),
        p.role === 'owner' ? null : p.status === 'active'
          ? [h('button', { class: 'btn small', onclick: () => this.adminStatus(p, 'suspended') }, 'Suspend'), h('button', { class: 'btn small danger', onclick: () => this.adminStatus(p, 'banned') }, 'Ban')]
          : h('button', { class: 'btn small green', onclick: () => adminDo(() => API.post(`/api/admin/players/${p.id}/status`, { status: 'active' }), () => this.render_admin()) }, 'Restore')),
    ])));
  },
  async adminPlayer(id) {
    try {
      const d = await Online.admin(() => API.get('/api/admin/players/' + id)), s = d.save;
      this.modal(h('div', {}, h('h2', {}, d.user.username, ' ', d.premium.active ? h('span', { class: 'badge-premium' }, '★ PREMIUM') : null),
        h('p', { class: 'muted' }, `#${d.user.id} • ${d.user.email || 'no email'} • joined ${dateStr(d.user.created_at)} • last login ${fmtTs(d.user.last_login_at)} • 2FA ${d.user.totp_enabled ? 'on' : 'off'} • status ${d.user.status}`),
        h('p', {}, `Level ${s.level} • ${fmtNum(s.coins)} coins • ${s.rp} RP • ${Object.values(s.balls).filter(b => b.owned).length} balls • ${s.stats.battles || 0} battles (${s.stats.wins || 0}W/${s.stats.losses || 0}L)`),
        h('h3', {}, 'Recent battles'), adminTable(['When', 'Mode', 'Difficulty', 'Status', 'Flags', 'Rewards'], d.battles.map(b => [fmtTs(b.created_at), b.mode, b.difficulty, b.status, b.flags || '', b.rewards || ''])),
        h('h3', {}, 'Security events'), d.security.length ? adminTable(['When', 'Kind', 'Severity', 'Details'], d.security.map(e => [fmtTs(e.created_at), e.kind, e.severity, e.details || ''])) : h('p', { class: 'muted' }, 'None'),
        h('h3', {}, 'Payments'), d.payments.length ? adminTable(['When', 'Kind', 'Amount', 'Status'], d.payments.map(p => [fmtTs(p.created_at), p.kind, usd(p.amount_cents / 100), p.status])) : h('p', { class: 'muted' }, 'None')));
    } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); }
  },
  adminStatus(p, status) {
    const days = h('input', { type: 'number', min: 1, max: 3650, value: 7 }), reason = h('input', { type: 'text', maxlength: 200, placeholder: 'Reason (shown to the player)' });
    this.modal(h('div', { style: { maxWidth: '440px', margin: 'auto' } }, h('h2', {}, `${status === 'banned' ? 'Ban' : 'Suspend'} ${p.username}`), status === 'suspended' ? field('Days', days) : h('p', { class: 'warn' }, 'Banning signs the player out everywhere and blocks sign-in.'), field('Reason', reason),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn danger', onclick: () => adminDo(() => API.post(`/api/admin/players/${p.id}/status`, { status, days: +days.value, reason: reason.value }), () => { this.closeModal(); this.render_admin(); }) }, 'Confirm'))));
  },
  adminGrant(p) {
    const coins = h('input', { type: 'number', min: 0, max: 1000000, value: 0 }), days = h('input', { type: 'number', min: 0, max: 3650, value: 0 }), note = h('input', { type: 'text', maxlength: 200, placeholder: 'Note for the audit log' });
    const ball = h('select', {}, h('option', { value: '' }, '— none —'), allBalls().filter(b => !b.adminOnly && !b.fusion && !b.draft).map(b => h('option', { value: b.id }, `${b.name} (${b.rarity})`)));
    const cos = h('select', {}, h('option', { value: '' }, '— none —'), COSMETICS.map(c => h('option', { value: c.id }, c.name)));
    const self = p.role === 'owner';
    const maxSel = h('select', {}, h('option', { value: '' }, '— none —'), h('option', { value: '*all*' }, self ? '★ ALL balls (admin balls too)' : '★ ALL balls this player owns'),
      allBalls().filter(b => !b.draft && (self || !b.adminOnly)).map(b => h('option', { value: b.id }, `${b.adminOnly ? '♛ ' : ''}${b.name}`)));
    this.modal(h('div', { style: { maxWidth: '480px', margin: 'auto' } }, h('h2', {}, self ? '🎁 Owner tools for your account' : `🎁 Promotional rewards for ${p.username}`), h('div', { class: 'fgrid' }, field('Coins', coins, 'Up to 1,000,000 at a time'), field('Max upgrade', maxSel, 'Level 50, final evolution, all upgrades and skills'), self ? null : field('Ball', ball), self ? null : field('Premium days', days, 'Promotional, no charge'), field('Cosmetic', cos)), field('Note', note),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, h('button', { class: 'btn gold', onclick: () => adminDo(() => API.post(`/api/admin/players/${p.id}/grant`, { coins: +coins.value || undefined, maxBall: maxSel.value || undefined, ball: ball.value || undefined, premiumDays: +days.value || undefined, cosmetic: cos.value || undefined, note: note.value }), async () => { this.closeModal(); if (self) await Online.refresh(); this.render_admin(); }) }, self ? 'Give to me' : 'Grant'))));
  },
  async admin_balls(body) {
    const r = await API.get('/api/admin/balls'); body.innerHTML = '';
    const custom = Object.fromEntries(r.custom.map(c => [c.id, c])), ov = new Set(r.overrides), dis = new Set(r.disabled);
    body.append(h('p', { class: 'muted small' }, `${allBalls().length} balls • ${r.custom.length} custom • drafts are only visible to you until published • players keep balls they unlocked even if you disable them`));
    body.append(adminTable(['', 'Name', 'Rarity', 'HP/ATK/DEF/SPD/CRIT', 'Status', 'Actions'], allBalls().filter(b => !b.fusion).map(b => {
      const c = custom[b.id];
      return [ballCanvas(b, 40, { small: true }), h('span', {}, h('b', {}, b.name), c ? h('small', { class: 'muted' }, c.published ? ' custom' : ' DRAFT') : ov.has(b.id) ? h('small', { class: 'muted' }, ' edited') : null), h('span', { class: 'rar ' + rarClass(b.rarity) }, b.rarity),
        `${b.hp}/${b.atk}/${b.def}/${b.spd}/${b.crit}`, (dis.has(b.id) ? 'Disabled' : 'Enabled') + (c ? ` • ${c.owners} owner(s)` : ''),
        h('div', { class: 'acts' }, h('button', { class: 'btn small', onclick: () => this.openCreator(b.id) }, '✎ Edit'), h('button', { class: 'btn small', onclick: () => this.duplicateBall(b.id) }, '⧉ Duplicate'),
          h('button', { class: 'btn small' + (dis.has(b.id) ? ' green' : ''), onclick: () => adminDo(() => API.post(`/api/admin/balls/${b.id}/flags`, { disabled: !dis.has(b.id) }), () => Online.refresh().then(() => this.render_admin())) }, dis.has(b.id) ? 'Enable' : 'Disable'),
          c ? h('button', { class: 'btn small', onclick: () => adminDo(() => API.post('/api/admin/balls', { id: b.id, def: c, publish: !c.published }), () => Online.refresh().then(() => this.render_admin())) }, c.published ? 'Unpublish' : 'Publish') : null,
          ov.has(b.id) ? h('button', { class: 'btn small', onclick: () => this.confirm(`Restore ${esc(b.name)} to its original design?`, () => adminDo(() => API.post(`/api/admin/balls/${b.id}/restore`), () => Online.refresh().then(() => this.render_admin())), 'Restore') }, '↺ Restore') : null,
          c ? h('button', { class: 'btn small danger', onclick: () => this.confirm(`Delete ${esc(b.name)}? This cannot be undone.`, () => adminDo(() => API.del('/api/admin/balls/' + b.id), () => Online.refresh().then(() => this.render_admin())), 'Delete') }, '🗑') : null)];
    })));
  },
  async admin_events(body) {
    const r = await API.get('/api/admin/events'); body.innerHTML = '';
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Your limited events'), r.events.length ? adminTable(['Name', 'Ball', 'Start', 'End', 'Goal', 'Price', 'Premium', ''], r.events.map(e => [e.name, getBall(e.ball_id)?.name || e.ball_id, fmtTs(e.start_at), fmtTs(e.end_at), e.goal, e.price, e.premium_only ? '★' : '',
      h('button', { class: 'btn small danger', onclick: () => adminDo(() => API.del('/api/admin/events/' + e.id), () => this.render_admin()) }, 'Delete')])) : h('p', { class: 'muted' }, 'No custom events. A built-in limited event also runs every week.')));
    const toLocal = t => new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const nm = h('input', { type: 'text', maxlength: 60 }), ds = h('input', { type: 'text', maxlength: 300 }), st = h('input', { type: 'datetime-local', value: toLocal(Date.now()) }), en = h('input', { type: 'datetime-local', value: toLocal(Date.now() + 7 * 86400e3) });
    const goal = h('input', { type: 'number', min: 1, max: 50, value: 3 }), price = h('input', { type: 'number', min: 0, value: 2500 }), prem = h('input', { type: 'checkbox' });
    const ball = h('select', {}, allBalls().filter(b => !b.adminOnly && !b.fusion).map(b => h('option', { value: b.id }, `${b.name} (${b.rarity})`)));
    body.append(h('div', { class: 'card' }, h('h3', {}, '＋ Create a limited event'), h('div', { class: 'fgrid' }, field('Name', nm), field('Featured ball', ball), field('Starts', st), field('Ends', en), field('Wins to claim', goal), field('Coin price', price)), field('Announcement text', ds),
      h('label', { class: 'chk' }, prem, 'Premium-exclusive event'), h('div', {}, h('button', { class: 'btn admin', onclick: () => adminDo(() => API.post('/api/admin/events', { name: nm.value, desc: ds.value, ball: ball.value, start: new Date(st.value).getTime(), end: new Date(en.value).getTime(), goal: +goal.value, price: +price.value, premiumOnly: prem.checked }), () => { Online.refresh(); this.render_admin(); }) }, 'Create event'))));
  },
  async admin_money(body) {
    const [p, s] = await Promise.all([API.get('/api/admin/payments'), API.get('/api/admin/subscriptions')]); body.innerHTML = '';
    body.append(h('div', { class: 'card notice' }, h('b', {}, `Payments mode: ${p.mode.toUpperCase()}`), h('p', { class: 'muted small' }, p.mode === 'live' ? 'Real charges are active.' : p.mode === 'test' ? 'Sandbox: only Stripe test cards work, no real money moves.' : 'Checkout is switched off (PAYMENTS_MODE=disabled).')));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Monthly report'), p.monthly.length ? adminTable(['Month', 'Sales', 'Gross', 'Refunds', 'Net'], p.monthly.map(m => [m.month, m.sales, usd(m.gross), usd(m.refunds), usd(m.gross + m.refunds)])) : h('p', { class: 'muted' }, 'No payments yet.')));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Subscriptions'), adminTable(['Player', 'Status', 'Provider', 'Started', 'Expires', 'Auto-renew'], s.subscriptions.map(x => [x.username, x.status, x.provider || '', dateStr(x.started_at), dateStr(x.current_period_end), x.auto_renew ? 'yes' : 'no']))));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Payments'), adminTable(['When', 'Player', 'Kind', 'Amount', 'Status', 'Reference'], p.payments.map(x => [fmtTs(x.created_at), x.username || '', x.kind, usd(x.amount_cents / 100) + ' ' + x.currency.toUpperCase(), x.status, x.provider_ref.slice(0, 18)]))));
  },
  async admin_announce(body) {
    body.innerHTML = '';
    const t = h('input', { type: 'text', maxlength: 200, value: Online.announcement || '', placeholder: 'Shown on everyone’s main menu (empty = show the current event)' });
    body.append(h('div', { class: 'card' }, h('h3', {}, '📢 Main-menu announcement'), t, h('button', { class: 'btn admin', style: { marginTop: '8px' }, onclick: () => adminDo(() => API.post('/api/admin/announcement', { text: t.value }), () => { Online.announcement = t.value; }) }, 'Publish announcement')));
  },
  async admin_logs(body) {
    const [a, s] = await Promise.all([API.get('/api/admin/audit'), API.get('/api/admin/security')]); body.innerHTML = '';
    body.append(h('div', { class: 'card' }, h('h3', {}, '🛡 Security events (suspicious activity)'), adminTable(['When', 'Player', 'Kind', 'Severity', 'IP', 'Details'], s.events.map(e => [fmtTs(e.created_at), e.username || '', e.kind, e.severity >= 3 ? h('b', { class: 'warn' }, e.severity) : e.severity, e.ip || '', (e.details || '').slice(0, 120)]))));
    body.append(h('div', { class: 'card' }, h('h3', {}, '📜 Audit log'), adminTable(['When', 'Who', 'Action', 'Target', 'IP', 'Details'], a.logs.map(l => [fmtTs(l.created_at), l.actor || 'system', l.action, l.target || '', l.ip || '', (l.details || '').slice(0, 120)]))));
  },
  async admin_data(body) {
    body.innerHTML = '';
    body.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, '⬇ Export game data'), h('p', { class: 'muted small' }, 'Players, progress, balls, events, subscriptions and payments as JSON. Passwords, 2FA secrets and session tokens are never exported.'),
        h('button', { class: 'btn', onclick: () => adminDo(() => API.get('/api/admin/export'), d => downloadText(`neon-ball-battle-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 1))) }, 'Export JSON')),
      h('div', { class: 'card' }, h('h3', {}, '💾 Database backup'), h('p', { class: 'muted small' }, 'Writes a consistent snapshot of the database into the server backup folder (BACKUP_DIR). See docs/DEPLOYMENT.md for restore steps.'),
        h('button', { class: 'btn', onclick: () => adminDo(() => API.post('/api/admin/backup'), r => toast('Backup saved: ' + esc(r.file), 'gold')) }, 'Back up now'))));
  },
  /* creator & catalog actions go to the server */
  async saveDraft(asNew, quiet) {
    const d = JSON.parse(JSON.stringify(this.draft));
    if (!(d.name || '').trim()) { toast('Give your ball a name', 'bad'); return null; }
    if ((d.skills || []).length < 3) { toast('Every ball needs at least 3 special abilities', 'bad'); return null; }
    const builtin = !asNew && this.editId && ALL_BUILTIN.some(b => b.id === this.editId);
    const id = builtin ? this.editId : (!asNew && this.editId && /^c_/.test(this.editId) ? this.editId : undefined);
    try {
      const r = await Online.admin(() => API.post('/api/admin/balls', { id, def: d, publish: !d.draft }));
      if (d.limited && d.limStart && d.limEnd && !builtin) await Online.admin(() => API.post('/api/admin/events', { name: d.name + ' Limited Event', desc: d.desc, ball: r.id, start: new Date(d.limStart).getTime(), end: new Date(d.limEnd).getTime(), goal: 3, price: RARITY_INFO.Limited.price }));
      await Online.refresh();
      this.editId = r.id; this.draft = JSON.parse(JSON.stringify(getBall(r.id)));
      if (!quiet) { toast(`💾 <b>${esc(d.name)}</b> saved${d.draft ? ' as a draft' : ' and published to players'}`, 'gold'); this.render_creator(); }
      return r.id;
    } catch (e) { toast('⚠ ' + esc(e.message), 'bad'); return null; }
  },
  async duplicateBall(id) {
    const b = getBall(id), c = JSON.parse(JSON.stringify(b));
    for (const k of ['id', 'builtin', 'overridden', 'custom', 'enabled', 'fusion']) delete c[k];
    c.name = b.name.replace(/ Ball$/, '') + ' Copy Ball'; c.draft = true;
    if (c.limited) { c.limited = false; c.category = 'Custom'; c.rarity = 'Epic'; }
    try { const r = await Online.admin(() => API.post('/api/admin/balls', { def: c, publish: false })); await Online.refresh(); toast(`Duplicated as <b>${esc(c.name)}</b> (draft)`); this.openCreator(r.id); }
    catch (e) { toast('⚠ ' + esc(e.message), 'bad'); }
  },
});

/* =====================================================================
   ONLINE PvP — real-time 1 vs 1 against another player.
   Both browsers run the same deterministic battle (lockstep): each player's
   button presses are sent to the server a few blocks ahead, and a block is only
   simulated once both players' inputs for it have arrived. The server re-plays
   the match at the end, and ITS result decides the winner and rewards.
   ===================================================================== */
class LockstepNet {
  constructor(m, send) {
    this.K = m.block; this.D = m.delay; this.slot = m.slot; this.send = send; this.n = m.humans || 2;   // number of human players
    this.replay = []; this.frames = new Map(); this.confirmed = m.delay - 1; this.sent = m.delay - 1;
    this.pending = []; this.lastSteer = '0,0,0'; this.localManual = false; this.dead = false;
  }
  /* local button press → goes out with the next frame (never applied directly) */
  local(type, a) {
    if (this.dead || this.pending.length >= 20) return;
    if (type === 'm') { this.localManual = !!a; this.pending.push(['m', a ? 1 : 0]); if (!a) this.lastSteer = '0,0,0'; }
    else if (type === 'k') this.pending.push(['k', Math.max(0, Math.min(6, a | 0))]);
    else if (type === 'u') this.pending.push(['u', 0]);
  }
  /* owner console (ADMIN DELETE): ['x', cmd, targetId, v1, v2], validated by the engine and the server */
  adminCmd(a) { if (!this.dead && this.pending.length < 20 && Array.isArray(a) && a.length === 4) this.pending.push(['x', ...a.map(v => Math.max(-1000, Math.min(1000, v | 0)))]); }
  /* steering while in MANUAL (sampled every simulated step, only changes are sent) */
  sample(B) {
    if (this.dead || !this.localManual || !B.player || !B.player.alive) return;
    const st = Input.read(B.player), key = st.join(',');
    if (key !== this.lastSteer) { this.lastSteer = key; this.pending = this.pending.filter(x => x[0] !== 's'); this.pending.push(['s', ...st]); }
  }
  /* sends our frame for block (current + delay) and limits the battle to confirmed blocks */
  tick(B) {
    if (!this.dead) {
      const cur = Math.floor(B.stepN / this.K);
      while (this.sent < cur + this.D) {
        this.sent++;
        const acts = (this.sent === cur + this.D ? this.pending.splice(0) : []).map(x => [0, ...x]);
        this.store(this.slot, this.sent, acts);
        this.send({ t: 'f', b: this.sent, a: acts });
      }
    }
    B.limit = (this.confirmed + 1) * this.K;
  }
  remote(m) { if (m.s !== this.slot && Number.isInteger(m.b) && m.b > this.confirmed) this.store(m.s, m.b, m.a || []); }
  store(s, b, acts) {
    let f = this.frames.get(b); if (!f) this.frames.set(b, f = new Array(this.n).fill(undefined));
    f[s] = acts;
    for (;;) {
      const nb = this.confirmed + 1, fr = this.frames.get(nb);
      if (!fr || fr.some(x => x === undefined)) break;
      for (const e of mergePvpBlock(nb, fr)) this.replay.push(e);
      this.frames.delete(nb); this.confirmed = nb;
    }
  }
}

const PvP = {
  ws: null, state: 'off', info: null, match: null, net: null, code: '', history: null, joinCode: '', waiting: false, mode: 'duel', room: null, queueInfo: null,
  mySpec(M) { return M ? M.ticket.teams.flat().find(s => s.pvp && s.slot === M.slot) : null; },
  url() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/pvp/ws'; },
  connect() {
    if (this.ws && this.ws.readyState <= 1) return this.ready || Promise.resolve();
    this.state = 'connecting';
    this.ready = new Promise((resolve, reject) => {
      let ws; try { ws = new WebSocket(this.url()); } catch (e) { return reject(e); }
      this.ws = ws;
      const t = setTimeout(() => { reject(new Error('The game server did not answer.')); ws.close(); }, 8000);
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t === 'hello') { clearTimeout(t); resolve(); } this.onMsg(m); };
      ws.onclose = () => { clearTimeout(t); reject(new Error('Could not connect to online battles.')); this.onClose(ws); };
    });
    return this.ready;
  },
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); },
  rerender() { if (UI.current === 'pvp') UI.render_pvp(); },
  onMsg(m) {
    switch (m.t) {
      case 'hello': this.info = m; this.state = 'idle'; this.rerender(); break;
      case 'ping': this.send({ t: 'pong', n: m.n }); if (this.info) { this.info.online = m.online; this.info.searching = m.searching; } const el = document.getElementById('pvpOnline'); if (el) el.textContent = this.onlineText(); break;
      case 'queued': this.state = 'queue'; this.queueInfo = { ...m, at: Date.now() }; this.rerender(); break;
      case 'room': this.state = 'room'; this.code = m.code; this.room = m.room || null; this.rerender(); break;
      case 'idle': if (this.state !== 'match') { this.state = 'idle'; this.rerender(); } break;
      case 'error': toast('⚠ ' + esc(m.msg), 'bad'); if (this.state !== 'match') { this.state = 'idle'; this.rerender(); } break;
      case 'start': this.start(m); break;
      case 'f': if (this.net) this.net.remote(m); break;
      case 'oppLeft': case 'left': if (this.match) toast(`📴 <b>${esc(m.name || this.match.opp.name)}</b> left. The AI is now controlling their ball, so keep fighting!`); break;
      case 'dropped': this.dropped(m); break;
      case 'result': this.result(m); break;
    }
  },
  onClose(ws) {
    if (this.ws !== ws) return;
    this.ws = null; this.ready = null;
    if (this.state === 'match' || this.waiting) {
      this.stopBattle();
      toast('📴 Connection lost. The AI finishes your match for you; the result will be in your match history.', 'bad');
      this.state = 'off'; this.waiting = false; this.match = null;
      if (UI.current === 'results' || !UI.current) UI.show('pvp');
    }
    this.state = 'off'; this.rerender();
  },
  onlineText() { const i = this.info || {}; return `🟢 ${i.online || 0} player${i.online === 1 ? '' : 's'} online • ${i.searching || 0} searching`; },
  start(m) {
    this.state = 'match'; this.match = m; this.waiting = false; this.code = '';
    UI.closeModal();
    setCatalog(m.catalog);                    // the exact balls both players (and the server) use for this match
    this.net = new LockstepNet(m, msg => this.send(msg));
    Sound.init(); if (SAVE.settings.musicOn) Sound.startMusic();
    UI.hideAll(); $('#battleHud').classList.remove('hidden');
    new Battle(buildBattleConfig(m.ticket, { me: m.slot, net: this.net, ranked: m.ranked, replay: this.net.replay, onEnd: (r, B) => this.localEnd(r, B) }));
    BATTLE.limit = m.delay * m.block;
    if (SAVE.settings.control === 'manual') this.net.local('m', 1);
    UI.syncHud();
    const md = PVP_MODES[m.mode || 'duel'] || PVP_MODES.duel;
    toast(m.mode && m.mode !== 'duel' ? `${md.ico} <b>${esc(md.name)}</b> — ${(m.players || []).filter(x => !x.ai).length} players${(m.players || []).some(x => x.ai) ? ' + AI' : ''} • ${m.ranked ? 'Ranked' : 'Friendly'}` : `⚔ <b>${esc(m.you.name)}</b> vs <b>${esc(m.opp.name)}</b> — ${m.ranked ? 'Ranked match' : 'Friendly match'}`, 'gold');
    if (m.note) toast(esc(m.note));
  },
  stopBattle() { if (this.net) this.net.dead = true; if (BATTLE && BATTLE.net && BATTLE.net === this.net) { BATTLE = null; FX.reset(); } $('#battleHud').classList.add('hidden'); },
  localEnd(r, B) {
    if (!this.match) return;
    $('#battleHud').classList.add('hidden');
    this.send({ t: 'end', step: r.step });
    this.waiting = true; this.localResult = { winner: r.winner, step: r.step };
    const me = this.mySpec(this.match);
    UI.showResults({ ...r, pending: true, ballId: me.ball }, B);
    const p = $('#resultsBody p.muted'); if (p) p.textContent = 'Checking the match result with the game server…';
  },
  quit() {
    UI.confirm('Leave this match? The AI will finish the fight for you, and the result still counts.', () => { this.send({ t: 'quit' }); }, 'Leave match');
  },
  dropped(m) {
    const why = { quit: 'You left the match.', timeout: 'Your connection was too slow or the game was paused too long.', disconnect: 'You were disconnected.' }[m.why] || 'There was a connection problem.';
    this.stopBattle(); this.waiting = true;
    toast(`📴 ${why} The AI is finishing the fight for you.`);
    if (this.match) UI.showResults({ pending: true, ballId: this.mySpec(this.match).ball, mode: 'pvp' }, null);
    const p = $('#resultsBody p.muted'); if (p) p.textContent = why + ' The AI is finishing your match. Waiting for the result…';
  },
  result(m) {
    const M = this.match; this.match = null; this.net = null; this.waiting = false; this.state = 'idle'; this.history = null;
    if (m.save) Online.applySave(m.save); else if (Online.save) setCatalog(Online.save.catalog);
    if (m.error) { toast('⚠ ' + esc(m.error), 'bad'); return UI.show('pvp'); }
    this.lastResult = m;
    if (this.localResult && (this.localResult.winner !== m.winner || this.localResult.step !== m.step)) console.warn('[pvp] this screen showed a different ending than the server', this.localResult, { winner: m.winner, step: m.step });
    this.localResult = null;
    Sound.play(m.win ? 'win' : 'lose');
    const mine = (m.slots && m.slots[m.slot]) || {};
    const res = { win: m.win, draw: m.draw, mode: 'pvp', time: m.time, stats: mine.stats || {}, coins: m.coins || 0, exp: m.exp || 0, ups: m.ups || 0, level: m.level, ballId: m.ball || (M && this.mySpec(M).ball), hpPct: mine.hpPct, verified: true, place: m.place,
      pvp: { ranked: m.ranked, opp: m.opp, mode: m.mode || 'duel', place: m.place, teams: m.teams, tier: m.tier, rpBefore: m.rpBefore, rpAfter: m.rpAfter, rpDelta: m.rpDelta, note: m.note } };
    if (UI.current === 'results' || !UI.current) UI.showResults(res, null);
    else toast(`🌐 Online match ${esc(m.opp)}: ${m.mode === 'ffa' ? '#' + m.place : m.draw ? 'Draw' : m.win ? 'Victory!' : 'Defeat'}${m.ranked ? ` (${m.rpDelta >= 0 ? '+' : ''}${m.rpDelta} pts)` : ''}`, m.win ? 'gold' : '');
  },
  leaveLobby() { if (this.state === 'queue' || this.state === 'room') { this.send({ t: 'leave' }); this.state = 'idle'; this.room = null; this.queueInfo = null; } },
};
window.PvP = PvP;

Object.assign(UI, {
  pvpBall: null,
  pvpMenu() { PvP.quit(); },
  async render_pvp() {
    const body = $('#pvpBody'); body.innerHTML = '';
    if (!Online.available) return body.append(needServer('Online battles'));
    if (!Online.active) return body.append(needSignIn('Online battles'));
    if (PvP.state === 'off' || PvP.state === 'connecting') {
      body.append(h('div', { class: 'card' }, h('div', { class: 'spinner', style: { margin: '10px auto' } }), h('p', { class: 'muted', style: { textAlign: 'center' } }, 'Connecting to online battles…')));
      try { await PvP.connect(); } catch (e) {
        if (UI.current !== 'pvp') return;
        body.innerHTML = '';
        return body.append(h('div', { class: 'card notice' }, h('h3', {}, '📴 Could not connect to online battles'), h('p', { class: 'muted' }, e.message + ' Check your internet connection, then try again.'), h('button', { class: 'btn primary', onclick: () => this.render_pvp() }, '↻ Try again')));
      }
      return;
    }
    const list = playableBalls().filter(b => !b.draft && (!b.adminOnly || isAdmin()));
    if (!this.pvpBall || !list.some(b => b.id === this.pvpBall)) this.pvpBall = (list.find(b => b.id === Game.setup.ball) || list[0] || {}).id;
    body.append(this.seasonCard());
    const S = PvP.state, MD = PVP_MODES;
    if (S === 'queue') {
      const q = PvP.queueInfo || {}, md = MD[q.mode] || MD.duel, left = q.fillIn != null ? Math.max(0, q.fillIn - Math.floor((Date.now() - q.at) / 1000)) : null;
      body.append(h('div', { class: 'card', style: { textAlign: 'center', marginTop: '12px' } }, h('div', { class: 'spinner', style: { margin: '8px auto' } }),
        h('h3', {}, `🔎 Ranked ${md.name} — searching…`),
        q.party ? h('p', {}, '👥 Your team: ', h('b', {}, q.party.join(' & '))) : null,
        q.seats > 2 ? h('div', { class: 'seat-dots' }, ...Array.from({ length: q.seats }, (_, i) => h('span', { class: i < (q.found || 1) ? 'on' : '' }))) : null,
        h('p', { class: 'muted' }, q.seats > 2 ? `${q.found || 1} of ${q.seats} players found.` + (left != null ? (left > 0 ? ` If the arena is not full in ${left} s, AI balls take the empty seats.` : ' AI balls are joining…') : '') : 'Keep this screen open. The battle starts as soon as another player joins.'),
        h('button', { class: 'btn', onclick: () => { PvP.leaveLobby(); this.render_pvp(); } }, 'Cancel')));
      return;
    }
    if (S === 'room') { body.append(this.roomCard(PvP.room)); return; }
    // ---- mode tabs ----
    const mode = MD[PvP.mode] ? PvP.mode : 'duel', md = MD[mode];
    const tabs = h('div', { class: 'pvp-modes', role: 'tablist' });
    for (const [k, m] of Object.entries(MD)) tabs.append(h('button', { class: 'tab' + (k === mode ? ' active' : ''), role: 'tab', 'aria-selected': String(k === mode), onclick: () => { PvP.mode = k; Sound.play('click'); this.render_pvp(); } }, m.ico + ' ' + m.name));
    const HELP = {
      duel: 'One against one. Ranked matches move you up or down the season ladder.',
      team: 'Two against two. Search alone, or create a room with a friend and press "Find opponents" to play on the same team. Empty seats are filled with AI after 20 seconds.',
      ffa: 'Five balls in one arena, everyone for themselves. If fewer than 5 players are searching, AI balls fill the empty seats after 20 seconds. Points depend on your placement.',
      coop: 'You and a friend on the same team against 2 AI balls. A friendly match: no season points.',
    };
    body.append(tabs, h('p', { class: 'muted small', style: { margin: '6px 2px 0' } }, HELP[mode]));
    const sel = getBall(this.pvpBall);
    body.append(h('h3', { style: { margin: '12px 0 6px' } }, 'Choose your ball'));
    const grid = h('div', { class: 'ball-grid pvp-grid' });
    for (const b of list) grid.append(this.ballCard(b, { selected: b.id === this.pvpBall, onclick: () => { this.pvpBall = b.id; Sound.play('click'); this.render_pvp(); } }));
    body.append(grid);
    const code = h('input', { type: 'text', id: 'pvpJoinCode', maxlength: 5, placeholder: 'CODE', value: PvP.joinCode, 'aria-label': 'Room code', class: 'code-input', autocapitalize: 'characters', autocomplete: 'off', oninput: e => { PvP.joinCode = e.target.value.toUpperCase(); } });
    const go = fn => () => { if (!this.pvpBall) return toast('Choose a ball first'); Sound.init(); Sound.play('click'); fn(); };
    const actions = h('div', { class: 'pvp-actions' });
    if (md.ranked) actions.append(h('div', { class: 'card' }, h('h3', {}, `⚡ Ranked ${md.name}`), h('p', { class: 'muted' }, mode === 'ffa' ? 'Climb the ladder: points and coins by placement.' : 'Win to earn season points and coins.'),
      h('button', { class: 'btn big primary', disabled: !sel || sel.adminOnly, onclick: go(() => PvP.send({ t: 'queue', mode, ball: this.pvpBall })) }, sel && sel.adminOnly ? 'Admin balls: friend rooms only' : `Find a match with ${sel ? sel.name : '…'}`)));
    actions.append(h('div', { class: 'card' }, h('h3', {}, mode === 'coop' ? '🤝 Team up with a friend' : '🏠 Play with friends'),
      h('p', { class: 'muted' }, mode === 'coop' ? 'Create a room and share the code. The match starts when your friend joins.' : `Friendly match, up to ${md.humans || md.seats.length} players. No season points.`),
      h('button', { class: 'btn', onclick: go(() => PvP.send({ t: 'host', mode, ball: this.pvpBall })) }, '＋ Create a room'),
      h('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, code, h('button', { class: 'btn', onclick: go(() => { if (!PvP.joinCode.trim()) return toast('Type the room code first'); PvP.send({ t: 'join', code: PvP.joinCode.trim(), ball: this.pvpBall }); }) }, 'Join room'))));
    body.append(actions);
    body.append(h('p', { class: 'muted small' }, 'Your ball fights on AUTO; tap AUTO to switch to MANUAL. If you leave or lose your connection, the AI finishes the fight for you and the result still counts. Admin balls can only be used in friend rooms.'));
    // ---- match history ----
    const hist = h('div', { class: 'card', style: { marginTop: '12px' } }, h('h3', {}, '📜 Your recent online matches'));
    body.append(hist);
    if (!PvP.history) { try { PvP.history = (await API.get('/api/pvp/history')).matches; } catch { PvP.history = []; } if (UI.current !== 'pvp') return; }
    if (!PvP.history.length) hist.append(h('p', { class: 'muted' }, 'No online matches yet.'));
    else {
      const tbl = h('table', { class: 'admin-table' }, h('tr', {}, ...['Result', 'Match', 'Your ball', 'Points', 'When'].map(t => h('th', {}, t))));
      for (const x of PvP.history) tbl.append(h('tr', {},
        h('td', {}, x.mode === 'ffa' && x.place ? (x.place === 1 ? '🏆 #1' : '#' + x.place) : x.result === 'win' ? '🏆 Win' : x.result === 'draw' ? '🤝 Draw' : '✖ Loss'),
        h('td', {}, (MD[x.mode] && x.mode !== 'duel' ? MD[x.mode].ico + ' ' : '') + (x.opp || '?') + (x.ranked ? '' : ' (friendly)')), h('td', {}, (getBall(x.ball) || {}).name || x.ball),
        h('td', {}, x.ranked ? (x.rpDelta >= 0 ? '+' : '') + x.rpDelta : '—'), h('td', {}, dateStr(x.at))));
      hist.append(h('div', { style: { overflowX: 'auto' } }, tbl));
    }
  },
  /* season ladder: tier badge, progress to the next tier, rewards and the season ranking */
  seasonCard() {
    const s = Online.save && Online.save.season, i = PvP.info || {};
    const card = h('div', { class: 'card season-card' });
    if (!s) return card.appendChild(h('p', { class: 'muted' }, '🌐 Fight real players online.')), card;
    const t = s.tier, days = Math.max(0, Math.ceil((s.endsAt - Date.now()) / 86400e3));
    card.style.setProperty('--tier', t.col);
    card.append(
      h('div', { class: 'tier-badge', 'aria-hidden': 'true' }, t.ico),
      h('div', { class: 'tier-info' },
        h('div', { class: 'tier-name' }, t.name, h('span', { class: 'muted small' }, `  Season ${s.season} • ends in ${days} day${days === 1 ? '' : 's'}`)),
        h('div', { class: 'tier-bar' }, h('i', { style: { width: Math.round(t.progress * 100) + '%' } })),
        h('div', { class: 'muted small' }, t.next ? `${fmtNum(s.points)} / ${fmtNum(t.next.min)} season points to ${t.next.name}` : `${fmtNum(s.points)} season points — the top tier!`, ` • ${s.wins}W / ${s.losses}L`),
        h('div', { class: 'row', style: { gap: '6px', marginTop: '6px', flexWrap: 'wrap' } },
          h('span', { class: 'pill', id: 'pvpOnline' }, PvP.onlineText()),
          h('button', { class: 'btn small', onclick: () => this.seasonBoard() }, '🏆 Season ranking'),
          s.pending && s.pending.length ? h('button', { class: 'btn small gold', onclick: () => act(() => API.post('/api/season/claim'), r => { Online.applySave(r.save); toast(`🎁 Season rewards: +${fmtNum(r.coins)} coins!`, 'gold'); this.render_pvp(); }) },
            `🎁 Claim season rewards (+${fmtNum(s.pending.reduce((n, p) => n + p.coins, 0))})`) : null)));
    return card;
  },
  async seasonBoard() {
    let d; try { d = await API.get('/api/season'); } catch (e) { return toast('⚠ ' + esc(e.message), 'bad'); }
    const tiers = h('div', { class: 'tier-list' }, ...d.tiers.map(t => h('div', { style: { color: t.col } }, h('b', {}, t.ico + ' ' + t.name), h('span', { class: 'muted small' }, ` ${fmtNum(t.min)}+ pts • reward ${fmtNum(t.coins)} 🪙`))));
    const tbl = h('table', { class: 'admin-table' }, h('tr', {}, ...['#', 'Player', 'Tier', 'Points', 'W / L'].map(t => h('th', {}, t))));
    for (const r of d.board) tbl.append(h('tr', { class: r.me ? 'me' : '' }, h('td', {}, r.rank), h('td', {}, r.username), h('td', {}, r.tier), h('td', {}, fmtNum(r.points)), h('td', {}, `${r.wins} / ${r.losses}`)));
    this.modal(h('div', {}, h('h2', {}, `🏆 Season ${d.season}`),
      h('p', { class: 'muted' }, d.place ? `You are #${d.place} with ${fmtNum(d.points)} points (${d.tier.name}).` : 'Play a ranked match to enter the season ranking.',
        ` Season rewards are paid for the highest tier you reach, once the season ends (at least ${d.minMatches} ranked matches).`),
      tiers, d.board.length ? h('div', { style: { overflowX: 'auto', marginTop: '10px' } }, tbl) : h('p', { class: 'muted' }, 'No ranked matches yet this season.')));
  },
  /* a friend room: code, members, teams, start */
  roomCard(R) {
    const card = h('div', { class: 'card room-card', style: { marginTop: '12px' } });
    if (!R) return card;
    const md = PVP_MODES[R.mode] || PVP_MODES.duel, me = R.members.find(m => m.you) || {};
    card.append(h('h3', {}, `🏠 ${md.ico} ${md.name} room`), h('p', {}, 'Tell your friends to open ', h('b', {}, '🌐 Online'), ', choose ', h('b', {}, md.name), ', tap ', h('b', {}, 'Join room'), ' and type this code:'),
      h('div', { class: 'room-code', 'aria-label': 'Room code' }, R.code));
    const row = m => h('div', { class: 'member' + (m.you ? ' you' : '') }, h('b', {}, (m.host ? '★ ' : '') + m.name), h('span', { class: 'muted small' }, ` ${(getBall(m.ball) || {}).name || m.ball} • ${m.ico || ''} ${m.tier || ''}`));
    if (R.mode === 'team') {
      const col = t => h('div', { class: 'team-col' }, h('h4', {}, t ? '🔴 Team B' : '🔵 Team A'), ...R.members.filter(m => m.team === t).map(row),
        ...Array.from({ length: Math.max(0, 2 - R.members.filter(m => m.team === t).length) }, () => h('div', { class: 'member empty muted' }, '🤖 AI (empty seat)')),
        me.team !== t ? h('button', { class: 'btn small', onclick: () => PvP.send({ t: 'team', team: t }) }, 'Join this team') : null);
      card.append(h('div', { class: 'teams' }, col(0), col(1)));
    } else {
      card.append(h('div', { class: 'members' }, ...R.members.map(row), ...Array.from({ length: R.cap - R.members.length }, () => h('div', { class: 'member empty muted' }, R.mode === 'duel' || R.mode === 'coop' ? '⏳ waiting for your friend…' : '🤖 AI (empty seat)'))));
      if (R.mode === 'coop') card.append(h('p', { class: 'muted small' }, 'Your team: both of you. Opponents: 2 AI balls.'));
    }
    const btns = h('div', { class: 'row', style: { gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '10px' } });
    if (R.isHost && (R.mode === 'team' || R.mode === 'ffa')) btns.append(h('button', { class: 'btn primary', disabled: R.members.length < 2, onclick: () => PvP.send({ t: 'go' }) }, R.members.length < 2 ? 'Waiting for friends…' : `▶ Start (${R.members.length} players${R.cap > R.members.length ? ' + ' + (R.cap - R.members.length) + ' AI' : ''})`));
    if (R.isHost && R.mode === 'team' && R.members.length === 2) btns.append(h('button', { class: 'btn gold', onclick: () => PvP.send({ t: 'seek' }) }, '⚡ Find opponents together (ranked)'));
    if (!R.isHost && (R.mode === 'team' || R.mode === 'ffa')) btns.append(h('p', { class: 'muted' }, 'Waiting for the host to start the match…'));
    if (R.mode === 'duel' || R.mode === 'coop') btns.append(h('p', { class: 'muted' }, 'The match starts as soon as your friend joins. The room closes after 10 minutes.'));
    btns.append(h('button', { class: 'btn', onclick: () => { PvP.leaveLobby(); this.render_pvp(); } }, 'Leave room'));
    card.append(btns);
    return card;
  },
});
/* leaving the PvP screen cancels a search or room */
const _showPvp = UI.show;
UI.show = function (name) { if (name !== 'pvp' && this.current === 'pvp') PvP.leaveLobby(); return _showPvp.call(this, name); };
