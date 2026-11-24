# Development checklist — v2.0 master upgrade

Legend: ✅ done and tested · 🟡 done, needs the owner's setup · ⛔ not implemented (by design, see notes)

## Phase 1 — Core game preserved
- ✅ Rectangular arena, physics, collision damage, HP inside the balls, Rage at ≤ 20 HP, God Mode, collection, evolution, all modes
- ✅ Every character is a procedurally drawn sphere (attachments only float around it)
- ✅ Guest/offline mode still runs from `index.html` with no server

## Phase 2 — Admin ball collection
- ✅ One Above All and Archangel stay Admin Exclusive
- ✅ New admin balls: Omega, Phantom, Infinity Core, Chaos Emperor, Celestial Dragon, Miracle, each with a signature ultimate (Omega Collapse, Phantom Dimension, Infinite Core, Chaos Eruption, Dragon Nova, Miracle Overdrive)
- ✅ Requested "preserved" balls were **not in the project**, so they were created new:
  - Glitch God, Creator God, Void Emperor, Chronos, Devourer, Admin Supreme → **Admin Exclusive**
  - Prism, Mirror, Toxic Reactor, Sonic, Magnetar, Rift → **Premium**
- ✅ New ability types: Phase (invisibility + illusion) and Reflect. New spherical armour attachment. A unique sound signature per ball.
- ✅ Every ball has 3+ abilities, an ultimate, Rage and God Mode, and an AI personality

## Phase 3 — Private admin control
- ✅ Server-side owner authentication with scrypt, TOTP 2FA, secure sessions, CSRF, rate limits, audit logs and a single-owner DB constraint
- ✅ The old browser-stored admin PIN was removed; the owner is created only with the CLI
- ✅ Dashboard: overview, players (view, suspend, ban, restore, grant), balls (create, edit, duplicate, publish, disable, restore, delete), events, subscriptions & payment reports, announcements, audit & security log, JSON export, DB backup
- ✅ Tests: players, Premium members and unauthenticated users are refused; stale 2FA forces re-verification; the owner cannot be banned

## Phase 4 — Ball Creator
- ✅ Live preview (normal / rage / god), colours, 64 textures, glow, attachments (rings, armour, wings, horns, crowns…), stats, 3–4 abilities, ultimate, AI, rarity, limited dates, premium flag
- ✅ Rage tuning, God form name, duration, boost and palette, and a sound signature
- ✅ Draft → Publish workflow; definitions are sanitised on the server

## Phase 5–6 — Premium & payments
- ✅ ULTIMATE PREMIUM, $200 USD / year (365 days), shown as "$200 / YEAR" with an auto-renewal disclosure
- ✅ Stripe Checkout created server-side; activation only via a signature-verified `invoice.paid`
- ✅ Statuses: free, pending, active, expired, cancelled, refunded, payment_failed
- ✅ Membership dashboard (plan, status, dates, remaining days, renewal, history); renewal can be turned off and on again
- ✅ Duplicate-event protection, refunds, expiry job, failed payments
- ✅ Premium unlocks all non-admin balls (regular, premium, legendary, mythical, limited), premium cosmetics, +25% rewards, +50% daily coins, 20% off summons and premium events. It never grants admin.
- ✅ Premium trial: any premium ball can be played in Practice
- 🟡 **Owner:** create the Stripe product and price, add the test keys, run the sandbox checklist. Live mode is locked until `PAYMENTS_LIVE_CONFIRMED=true` (see DEPLOYMENT.md)

## Phase 7 — Limited collection
- ✅ Weekly rotating events with countdowns and "coming soon" announcements, owner-created events, premium-only events, collection rewards and limited history
- ✅ Players never lose balls they unlocked: deletion is refused if anyone owns the ball, and disabling only stops new unlocks

## Phase 8 — AI
- ✅ Aggressive, defensive, tactical, intelligent, adaptive (learning) and boss personalities
- ✅ Difficulties: Easy, Normal, Hard, **Expert**, **Godlike** (old "Insane" saves migrate to Godlike)
- ✅ Reacts to enemy God Mode (braces with shields and keeps its distance); never wastes attacks on invulnerable or phased targets

## Phase 9 — Battle modes
- ✅ 1v1 (main), 2v2, Free For All, Survival, Tournament, Boss, Endless and Practice. All work offline and server-verified.

## Phase 10 — New features
- ✅ Global rankings (rank points, wins, level, tournaments; verified battles only, owner excluded)
- ✅ 7-day daily login rewards (coins, EXP, a cosmetic)
- ✅ Achievements, including 100 battles and Perfect Victory (win a 1v1 keeping ≥ 90% HP)
- ✅ Player profiles (avatar ball, favourite ball, level, record, premium badge) with public profile pages
- ✅ AI tournaments verified on the server, with a tournament leaderboard
- ✅ Ball Fusion (two owned level-10+ balls → a new sphere with a fused ability; originals kept)
- ✅ Customization: aura colours, skins, trails, collision effects and victory effects (visual only)
- ✅ Cloud save: progress, unlocks, upgrades, achievements and settings live on the server and sync across devices
- ✅ Guest mode, a premium trial, and account recovery (recovery codes plus optional email)

## Phase 11 — Multiplayer preparation
- ✅ Accounts, rooms, matches and friends schema, plus a deterministic server simulation (see MULTIPLAYER.md)
- ⛔ Real-time PvP, matchmaking and player tournaments are **not implemented**, and the UI says so

## Phase 12 — Security & anti-cheat
- ✅ Battle results re-simulated on the server, mismatch flagging, a too-fast guard, single submission, forfeit-on-abandon, input validation, transactional economy, crypto RNG, security event log

## Phase 13 — Backend & database
- ✅ Node 22 with no dependencies, SQLite in WAL mode, numbered migrations, and 26 tables (users, sessions, profiles, user_balls, custom_balls, overrides, battles, tournaments, achievements, events, subscriptions, payments, webhook_events, audit_logs, security_events, …)

## Phase 14–15 — Visuals, performance, accessibility
- ✅ Loading screen, keyboard focus outlines, ARIA labels, reduced-motion support (also turns off shake and flashes by default)
- ✅ Battle verification runs in worker threads (~0.2 s per battle) so it never blocks other players

## Phase 16 — Testing & deployment
- ✅ `npm test`: 39 automated tests (auth, escalation, CSRF, lockout, recovery, 2FA, anti-cheat, economy races, fusion, tournaments, rankings, billing lifecycle, admin access)
- ✅ Browser end-to-end runs: sign up → verified battle → daily reward → premium page → rankings → owner 2FA login → dashboard → creator publish
- ✅ Cross-engine determinism: live Chrome battles replay bit-for-bit in Node
- ✅ `.env.example`, migrations, backup and restore, deployment, error logging and recovery runbooks (docs/DEPLOYMENT.md)
- 🟡 **Owner before launch:** host with HTTPS, create the owner account, set up Stripe (sandbox, then live), publish Terms, Privacy and refund policies, and set up off-site backups
