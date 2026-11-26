# Development checklist — v2.0 master upgrade (+ 2.1.0, 2.2.0, 2.3.0, 2.3.1, 2.4.0)

## 2.4.0 — GOD OF ABSOLUTE, limited edition ([GOD-OF-ABSOLUTE.md](GOD-OF-ABSOLUTE.md), QA report: [QA-2.4.0.md](QA-2.4.0.md))
- ✅ The ball: 5 skills × 3 versions, 2 ultimates (full cinematic order, arena restored), passive, 3 forms by its own level (Lv 70 / 100)
- ✅ Lv 50 → 100 progression for this ball only (verified battles, owner EXP scale); Lv 60 / 80 / 90 features
- ✅ Limited edition: real stock, reservations, last-slot safety, numbered owners, permanent ledger, sold out, new editions
- ✅ Verified purchase → Lv 50, all skills, owner rewards; restore; PayMongo path with sell-out protection
- ✅ Owner-only management panel; "Cinematic effects" quality setting
- ✅ Database backup before every migration
- ✅ 122 tests pass (20 new); browser QA with screenshots
- 🟡 Owner: real PHP 499 payment test on the live site; check on a real phone

## 2.3.0 — God of Guns + God Portal, Premium God Shop ([PREMIUM-GOD-SHOP.md](PREMIUM-GOD-SHOP.md))
- ✅ God of Guns and God Portal: 5 skills × 3 versions, regular + final-form ultimates, 3 forms, passives, art, effects, sounds
- ✅ Infinite Void: a real, isolated battle dimension (platforms, turning gravity, zones, hazards, portal network, copies, collapse, safe return); bystanders and other matches untouched; final form = three linked dimensions
- ✅ Premium God Shop: PHP 99 each / PHP 198 bundle via PayMongo (GCash, Maya, QR Ph, online banking, cards)
- ✅ Server-verified payments (signed webhooks + re-fetching the checkout session), idempotent events, unique payments, no duplicate purchases, permanent ownership, restore, history, audit log
- 🟡 Owner setup: PayMongo account + keys, then "Register webhook" in the Admin Dashboard. Until then the shop stays closed (never simulated)
- ✅ Tests: `server/test/gods2.test.js` with a local fake PayMongo API
- ✅ 2.3.1 QR payments (Maya / MariBank / any QR Ph app): owner uploads QR, player sends the reference number, owner approves or rejects; one reference = one payment; tests in `server/test/manualpay.test.js`
- ✅ 2.3.1 ULTIMATE PREMIUM by QR: PHP 499 / year (owner-set price), 365 days per approved payment, adds to an active year, no automatic renewal
- 🟡 Owner: upload your QR codes in Admin Dashboard → 💳 God Shop (PHP) and turn QR payments ON

## 2.2.0 — Four Supreme God Balls, FREE ([GOD-BALLS.md](GOD-BALLS.md))
- ✅ God of Chaos, God of War, AI Tech, Solar Eclipse: free for every player (no payment, subscription, premium currency or admin rights)
- ✅ 20 skills × 3 versions (Base / Awakened / Final God) with different mechanics; 4 ultimates + 4 final-form ultimates with cinematic sequences
- ✅ 12 forms (3 each) with their own art; forms unlock with free progression (Lv 10 / Lv 20); every form changes the abilities, not just the colour
- ✅ Passives: Unstable Reality, Battle Instinct, Combat Learning (capped — never invincible), Celestial Balance with a dedicated always-available state switch
- ✅ GOD CLASH: simultaneous God ultimates clash; the battle state decides; either side can win; never blocks gameplay
- ✅ Collection section, interactive preview (forms / states / skill versions), free practice tests with a test bar, selection-screen row
- ✅ Deterministic: server verification and PvP lockstep; balance simulated; God of Time and all existing balls unchanged
- ✅ Tests: `server/test/gods.test.js`

## 2.1.0 — Supreme Admin Balls ([SUPREME-ADMIN-BALLS.md](SUPREME-ADMIN-BALLS.md))
- ✅ 15 owner-only Supreme balls, each with 5 unique abilities, an ultimate, a final-form ultimate and 3 forms changing in real time (Base / Awakened / Final God Form)
- ✅ Transformation cinematic, special battlefield entrance, unique victory and defeat animations, aura, idle particles, wall-bounce effects and a sound profile for each ball
- ✅ Archangel, Void Emperor and Omega upgraded in place (same ids, saved progress kept); Phoenix / Mirror / Infinity / Blood Moon have separate owner-only God versions, and the player balls are unchanged
- ✅ ADMIN DELETE owner console: delete / restore / transform / properties / arena / settings — current match only; permanent disabling is a separate, confirmed, audit-logged action
- ✅ Admin Ball Control Panel: previews, abilities on/off, cooldown multiplier, effects intensity, aura, Spawn & Test with a test bar
- ✅ Server: owner-only access, validated admin commands (replayed in verification), forged commands rejected and logged, audit log, migration 004
- ✅ Tests: `server/test/supreme.test.js` (75 abilities, all ultimates and forms, determinism, console replay, server rules)

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
  - **Anti Ball → FREE for everyone**; Tech Ball 1 **Mecha Commander** and Tech Ball 2 **Cyber Overlord** → **Premium** (see [TECH-BALLS.md](TECH-BALLS.md))
- ✅ New ability types: Phase (invisibility + illusion) and Reflect. New spherical armour attachment. A unique sound signature per ball.
- ✅ Every ball has 3+ abilities, an ultimate, Rage and God Mode, and an AI personality

## Owner-exclusive character — Portal Master Ball
- ✅ **Look:** a dark purple and black sphere with glowing violet eyes, floating portal symbols and a dimensional aura
- ✅ **Abilities:**
  - Portal Gate: opens a portal in front of itself and one behind the enemy, then strikes through it
  - Dimensional Escape: leaves the arena through a wall portal, untouchable, and comes back through another portal
  - Ball Summon: at most 3 summons at once; each keeps its own abilities and defends its master
  - Clone Army: at most 4 clones, some disguised as other balls
  - Ultimate: INFINITE PORTAL (ring of portals, army, coordinated volley, rift, finishing strike)
- ✅ **Battle safety:** the AI uses every ability, including escaping danger. While "in the void" the ball has no collisions and takes no damage; it only *looks* like it leaves the arena. Summons and clones are temporary and never count as the main fighters
- ✅ **New summon-only balls:** Electric, Spear, Cell, French Bread. They exist only inside the portals: never playable, sold, granted or AI opponents
- ✅ **Exclusivity:** the server only allows the owner account to use it. It is hidden from players, never an AI opponent (not even for the owner), and not allowed in ranked PvP. It is balanced against One Above All (about 50/50) and beats every other ball
- ✅ **Tests:** owner-only access, server-verified owner battles, deterministic replays and online lockstep

## Phase 3 — Private admin control
- ✅ Server-side owner authentication with scrypt, TOTP 2FA, secure sessions, CSRF, rate limits, audit logs and a single-owner DB constraint
- ✅ The old browser-stored admin PIN was removed; the owner is created only with the CLI
- ✅ Owner tools: give yourself or any player coins; max-upgrade any ball (level 50, final evolution, all upgrades and skills; admin balls for the owner only); the owner can fuse any two balls at any level (fusions with an admin ball stay admin-only). Everything is audit-logged
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

## Phase 11 — Online multiplayer
- ✅ Real-time 1 VS 1 PvP over WebSocket: ranked Quick Match (Elo rank points, rewards) and private rooms with a code (see MULTIPLAYER.md)
- ✅ Deterministic lockstep; the server relays validated inputs and re-simulates every match, so its result decides the winner
- ✅ Leavers, disconnects and stalls are replaced by the AI; protocol abuse is dropped and logged; daily anti-farming limits
- ⛔ Reconnecting mid-match, online 2v2 / FFA / player tournaments, spectating and chat are **not implemented**

## Phase 12 — Security & anti-cheat
- ✅ Battle results re-simulated on the server, mismatch flagging, a too-fast guard, single submission, forfeit-on-abandon, input validation, transactional economy, crypto RNG, security event log

## Phase 13 — Backend & database
- ✅ Node 22 with no dependencies, SQLite in WAL mode, numbered migrations, and 26 tables (users, sessions, profiles, user_balls, custom_balls, overrides, battles, tournaments, achievements, events, subscriptions, payments, webhook_events, audit_logs, security_events, …)

## Phase 14–15 — Visuals, performance, accessibility
- ✅ Loading screen, keyboard focus outlines, ARIA labels, reduced-motion support (also turns off shake and flashes by default)
- ✅ Battle verification runs in worker threads (~0.2 s per battle) so it never blocks other players

## Phase 16 — Testing & deployment
- ✅ `npm test`: 44 automated tests (auth, escalation, CSRF, lockout, recovery, 2FA, anti-cheat, economy races, fusion, tournaments, rankings, billing lifecycle, admin access, online PvP)
- ✅ Two-browser online matches (PC + phone): same fight on both screens, server result matches, leaving mid-match handled
- ✅ Browser end-to-end runs: sign up → verified battle → daily reward → premium page → rankings → owner 2FA login → dashboard → creator publish
- ✅ Cross-engine determinism: live Chrome battles replay bit-for-bit in Node
- ✅ `.env.example`, migrations, backup and restore, deployment, error logging and recovery runbooks (docs/DEPLOYMENT.md)
- 🟡 **Owner before launch:** host with HTTPS, create the owner account, set up Stripe (sandbox, then live), publish Terms, Privacy and refund policies, and set up off-site backups

## Anti Ball & Tech Balls update
- ✅ Anti Ball (free): 6 counter abilities, Absolute Zero, Anti-Adaptation passive (capped at 30%)
- ✅ Mecha Commander (premium): robots with their own AI, factory, missiles, defense drone, robot fusion, automatic Emergency Repair, Titan Overdrive
- ✅ Cyber Overlord (premium): laser grid, holograms, EMP, cyber trap, auto turret, overclock + heat/overheat, Skynet Protocol
- ✅ Server-side unlock rules (free / active premium; locked again on expiry with progress kept), unit caps, no infinite heal/summon/reflect, no permanent silence
- ✅ Selection screen "NEW UPDATE" strip with FREE / PREMIUM — LOCKED / UNLOCKED status, ability + ultimate + passive details, ability showcase, 1–6 manual keys
- ✅ Tests: every ability in real battles, determinism (AI + online PvP), balance simulations, premium access on the server

## Online modes, ranked seasons & monthly coins
- ✅ Online 2 VS 2 (solo queue or duo from a room), 5-player arena and co-op vs AI; 1 VS 1 kept
- ✅ AI balls fill empty seats after 20 s; a lone player gets an unranked match vs AI after 45 s
- ✅ Friend rooms for every mode (up to 5 players, team picking, host start)
- ✅ Monthly seasons: Bronze → Legend tiers, Elo/placement points, soft reset, tier rewards, season ranking
- ✅ Premium monthly coins (2,000 per month, server-checked)
- ✅ Tests: every mode played through the real WebSocket server; five-browser end-to-end run
