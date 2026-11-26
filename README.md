# NEON BALL BATTLE: ULTIMATE GODS

An autonomous, physics-based **ball-versus-ball** battle game in a glowing rectangular arena. **Every character is a ball**: no humans or humanoids. Wings, horns, crowns, rings and armour only float around the sphere.

It runs two ways:

| | Guest / offline | Game server |
|---|---|---|
| Start | open `index.html` | `npm start` (Node ≥ 22.5, no dependencies) |
| Progress | saved in this browser | cloud save, every device |
| Battles | local | **server-verified** (anti-cheat) |
| Accounts, Premium, rankings, fusion, cosmetics, Owner Dashboard | – | ✔ |
| **Online PvP** (fight real players) | – | ✔ |

**Windows, no typing:** double-click `CREATE-OWNER-ACCOUNT.bat` once, then `START-GAME-SERVER.bat` whenever you want to play or open the Admin Dashboard.

**Update to the newest version:** close the server window, then double-click `UPDATE-GAME.bat`. It downloads the latest game from GitHub and never touches your `data` folder, which holds your accounts and progress.

**Admin on your phone:** double-click `START-GAME-SERVER-PHONE.bat` on the PC, connect the phone to the **same home Wi-Fi**, and type the link it shows (for example `http://192.168.1.23:8080`) in the phone browser. The first time, Windows asks to allow Node.js: tick **Private networks** and click **Allow**. Use it only on your home Wi-Fi.

```bash
cp .env.example .env
npm test                                  # 44 automated tests
npm start                                 # http://localhost:8080
npm run owner -- create --username You    # the ONLY way to create the admin/owner account
```

Full setup, Stripe sandbox and going-live checklist, backups and recovery: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
Version **2.7.0**. Battle Pass & coin packs: **[docs/BATTLEPASS-2.7.0.md](docs/BATTLEPASS-2.7.0.md)**. Security and anti-cheat design: **[docs/SECURITY.md](docs/SECURITY.md)**. Online PvP: **[docs/MULTIPLAYER.md](docs/MULTIPLAYER.md)**. What's done: **[docs/CHECKLIST.md](docs/CHECKLIST.md)**.

## Gameplay
- Balls bounce on their own. Collisions deal damage based on attack, impact speed and defence, and **HP is shown inside each ball**.
- **Rage Mode** activates at **20 HP or below**. God-tier balls transform into **God Mode** on their first ultimate.
- **AI:**
  - Six personalities: aggressive, defensive, tactical, intelligent, adaptive (learns during the fight) and boss (3 phases).
  - Five difficulties: Easy, Normal, Hard, Expert and Godlike.
  - It dodges attacks, braces against an enemy's God Mode and never wastes attacks on invulnerable targets.
- **Modes:** 1 VS 1 (main), 2 VS 2, Free For All, Survival, Tournament, Boss, Endless and Practice. *Sudden Death* starts after 90 s.
- **🌐 Online & Ranked:** real-time battles against other players. The server checks every match. See [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md).
  - **Modes:** 1 VS 1, **2 VS 2** (play together with a friend), the **5-PLAYER ARENA** (everyone for themselves) and **CO-OP vs AI** (2 friends vs 2 AI balls).
  - **Ranked queues:** empty seats are filled with AI balls after 20 seconds. Friend rooms work with a 5-letter code.
  - **Monthly seasons:** rank tiers Bronze, Silver, Gold, Platinum, Diamond, Master and Legend, with coin rewards and a season ranking.
- **Balls:**
  - 50 core balls
  - 6 limited event balls
  - 6 Premium balls: Prism, Mirror, Toxic Reactor, Sonic, Magnetar, Rift
  - **NEW — Anti Ball & Tech Balls update** ([docs/TECH-BALLS.md](docs/TECH-BALLS.md)):
    - **Anti Ball** (Secret, **FREE for every player**): Null Zone, Power Absorb, Reverse Impact, Mini Black Hole, Void Teleport, Anti Evolution; ultimate **Absolute Zero**; passive Anti-Adaptation
    - **Tech Ball 1 — Mecha Commander** (Premium): combat robots, Mecha Factory, Missile Barrage, Defense Drone, Robot Fusion, automatic Emergency Repair; ultimate **Titan Overdrive**
    - **Tech Ball 2 — Cyber Overlord** (Premium): Laser Grid, Hologram Clone, EMP Pulse, Cyber Trap, Auto Turret, Overclock Mode with a heat system; ultimate **Skynet Protocol**
  - **NEW 2.5.0 — God of Absolute's AUTONOMOUS FREE WILL**: it is never controlled by a player — it picks its own strategies and targets, teleports out of danger, times its own ultimate, and leaves the arena by itself to hunt hiding enemies, recover or ambush (always returning). Owner-only AI settings.
  - **NEW 2.5.1 — it REALLY leaves the arena**: it smashes through the wall, flies in the open space outside the walls (the camera pulls back so everyone sees it), fires golden Beyond Lances through the wall, drags hiding enemies out to fight them outside, and crashes back in with a judgment shockwave.
  - **NEW 2.7.0 — BATTLE PASS & COIN PACKS** ([docs/BATTLEPASS-2.7.0.md](docs/BATTLEPASS-2.7.0.md)):
    - 🎫 Battle Pass PHP 299 (one-time): God of Chaos, God of War, AI Tech and Solar Eclipse, owned forever. Players who already played them keep them.
    - 🆓 Free Pass: Anti Ball stays free.
    - 🪙 Coin packs: PHP 99 = 10,000 coins, PHP 999 = 1,000,000 coins.
    - Paid by QR (owner approves) or PayMongo; everything is checked on the server.
  - **2.6.0 — ULTIMATE UNIQUE SKILL, MASTERY & EVOLUTION SYSTEM** ([docs/SKILLS-2.6.0.md](docs/SKILLS-2.6.0.md)): skill slots by rarity (Common 2 … God Tier 10, ultimate included), 187 new abilities that unlock as each ball levels up, a signature mechanic for every classic ability and ultimate (0 duplicate mechanics), skill mastery from verified battles, evolutions, 44 designed combinations, Skill Training mode, animated skill previews, and an owner-only Admin Skill Management panel with a duplicate audit.
  - **2.4.0 — GOD OF ABSOLUTE • THE UNRIVALED ONE — LIMITED EDITION, PHP 499** ([docs/GOD-OF-ABSOLUTE.md](docs/GOD-OF-ABSOLUTE.md), QA: [docs/QA-2.4.0.md](docs/QA-2.4.0.md)):
    - limited exclusive Supreme God Ball: 100 verified owners at first, numbered editions (#001…), real stock shown in the shop, reserved slots while paying, never oversold
    - starts at **Lv 50** after a verified purchase and levels to **Lv 100** (Celestial Sovereign at Lv 70, The Unrivaled One at Lv 100)
    - 5 skills × 3 versions, ultimate **Absolute Zero – End of All Dimensions**, final-form ultimate **Omniversal Absolute Dominion**, passive **Absolute Authority**
    - owner rewards: THE ABSOLUTE OWNER title & nameplate, edition emblem, lobby showcase, aura, trail, golden cosmic elimination, MVP victory
    - owner-only management panel (supply, pause, announcements, new editions, owners, payments, restores, permanent ledger)
  - **2.3.0 — 2 Premium God Balls, PHP 99 each (PHP 198 for both)** ([docs/PREMIUM-GOD-SHOP.md](docs/PREMIUM-GOD-SHOP.md)):
    - **God of Guns** (weapon master: floating arsenal, railguns, bullet storms, orbital cannon) and **God Portal** (portals, summons, dimensional traps)
    - God Portal's ultimate takes its opponent into the **Infinite Void**, a real second battle space with platforms, gravity, zones, hazards and a portal network
    - **Premium God Shop**: pay by **QR** to the owner's Maya / MariBank (any bank app or GCash can scan it; the owner approves each payment), or automatic PayMongo checkout. Permanent ownership, restore and history
  - **2.2.0 — 4 Supreme God Balls** (free until 2.6.0; Battle Pass since 2.7.0) ([docs/GOD-BALLS.md](docs/GOD-BALLS.md)):
    - **God of Chaos**, **God of War**, **AI Tech**, **Solar Eclipse** — 5 skills each with 3 versions (Base / Awakened / Final God), a regular and a final-form ultimate, 3 forms (Awakened at ball Lv 10, Final God Form at Lv 20) and a passive
    - **GOD CLASH**: two God ultimates at the same moment lock together and the battle state decides the winner
    - a ⚡ Supreme God Balls section in the Collection with an interactive form preview and free practice tests
  - **2.1.0 — 15 Supreme Admin Balls** (owner only, [docs/SUPREME-ADMIN-BALLS.md](docs/SUPREME-ADMIN-BALLS.md)):
    - Reality Controller (ultimate **ADMIN DELETE** opens an owner console), Supreme Skull King, Void Emperor, Thunder God, Archangel
    - Demon Lord, Glitch 404, Dragon Emperor, Blood Moon God, Time God, Infinity God, Phoenix God, Black Sun, Mirror God, Omega
    - each has 5 unique abilities, an ultimate, a final-form ultimate and 3 forms (Base → Awakened → Final God Form)
    - **Admin Ball Control Panel** in the Admin Dashboard: previews, abilities on/off, cooldowns, effects, Spawn & Test
  - 15 **Admin Exclusive** balls: One Above All, Archangel, **Portal Master**, Omega, Phantom, Infinity Core, Chaos Emperor, Celestial Dragon, Miracle, Glitch God, Creator God, Void Emperor, Chronos, Devourer, Admin Supreme
  - **Portal Master Ball** (owner only):
    - opens portals anywhere and slips out of the arena and back
    - summons other balls through portals (Fire, Ice, Thunder, Electric, Spear, Cell, Zombie, Vampire, French Bread and more), each using its own abilities
    - creates clone armies, some disguised as other balls
    - ultimate: **INFINITE PORTAL**
  - unlimited owner-created balls and player fusions
- **Progression:**
  - Levels up to 50, a skill tree that unlocks the 3rd ability (Lv 5) and the 4th+ abilities (Lv 12), and three evolutions per ball.
  - Upgrades and summons.
  - Achievements (including 100 battles and Perfect Victory), collection rewards, weekly limited events and 7-day daily rewards.
- **Online extras:** global rankings, public profiles, AI tournaments, Ball Fusion, and cosmetics (aura, skin, trail, hit and victory effects).

## ULTIMATE PREMIUM — PHP 499 / YEAR by QR (or $200 / year by Stripe card)
- **Pay by QR (2.3.1):** the player pays the owner's Maya / MariBank QR and sends the reference number; the owner approves it and Premium turns on for 365 days (no automatic renewal; the owner sets the price in the Admin Dashboard, default PHP 499).
- **What's included:**
  - Every regular, premium, legendary, mythical and non-admin limited ball, including both **Tech Balls**
  - **2,000 free coins every month**
  - **Premium balls at full power:** Lv 50, fully evolved, every upgrade and ability (while Premium is active)
  - Premium cosmetics, effects and badge
  - +25% battle rewards, +50% daily coins and 20% off summons
  - Premium events
- **How payment works:** checkout runs through Stripe. Premium activates **only after server-verified payment**, renews yearly until turned off, and can be cancelled at any time. Any premium ball can be tried in Practice first.
- **What Premium never includes:** admin access, admin-exclusive balls or owner abilities.

## Controls
- **Auto battle** (default), or **Manual** (press M or the AUTO button). In Manual: WASD, arrows or drag to steer; 1-6 for abilities (or the on-screen buttons); SPACE for the ultimate.
- P / Esc pauses. The speed button cycles 1x / 1.5x / 2x / 3x.

## Project structure
```
index.html  style.css  script.js     game (rendering, physics, AI, UI; shared deterministic core)
supreme.js                           2.1.0 Supreme Admin Balls + the forms / God Clash framework (also loaded by the server)
gods.js                              2.2.0 Supreme God Balls, 2.7.0 Battle Pass flags (also loaded by the server)
gods2.js                             2.3.0 Premium God Balls, the Infinite Void, the God Shop screen (also loaded by the server)
store.js                             2.7.0 shop screen: Battle Pass and coin packs (browser only)
online.js                            accounts, cloud save, premium, rankings, fusion, owner dashboard UI
server/                              Node game server (no dependencies)
  index.js app.js config.js          entry, wiring, environment config
  auth.js security.js http.js        sessions, 2FA, CSRF, rate limits, headers, static whitelist
  game.js economy.js verifier.js     cloud save, verified battles (worker threads), economy
  billing.js                         Stripe subscription + signed webhooks
  shop.js                            Premium God Shop: QR payments (owner-approved) + PayMongo checkout (verified server-side)
  admin.js                           owner-only API
  pvp.js ws.js                       online PvP: matchmaking, rooms, lockstep relay (WebSocket)
  core.js                            loads script.js + supreme.js + gods.js + gods2.js headlessly for server-side replays
  migrations/  cli/  test/
docs/                                deployment, security, multiplayer, checklist
assets/                              optional (everything is drawn procedurally)
```
