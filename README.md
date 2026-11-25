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
Version **2.1.0**. Security and anti-cheat design: **[docs/SECURITY.md](docs/SECURITY.md)**. Online PvP: **[docs/MULTIPLAYER.md](docs/MULTIPLAYER.md)**. What's done: **[docs/CHECKLIST.md](docs/CHECKLIST.md)**.

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
  - **NEW 2.1.0 — 15 Supreme Admin Balls** (owner only, [docs/SUPREME-ADMIN-BALLS.md](docs/SUPREME-ADMIN-BALLS.md)):
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

## ULTIMATE PREMIUM — $200 / YEAR
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
supreme.js                           2.1.0 Supreme Admin Balls (also loaded by the server)
online.js                            accounts, cloud save, premium, rankings, fusion, owner dashboard UI
server/                              Node game server (no dependencies)
  index.js app.js config.js          entry, wiring, environment config
  auth.js security.js http.js        sessions, 2FA, CSRF, rate limits, headers, static whitelist
  game.js economy.js verifier.js     cloud save, verified battles (worker threads), economy
  billing.js                         Stripe subscription + signed webhooks
  admin.js                           owner-only API
  pvp.js ws.js                       online PvP: matchmaking, rooms, lockstep relay (WebSocket)
  core.js                            loads script.js + supreme.js headlessly for server-side replays
  migrations/  cli/  test/
docs/                                deployment, security, multiplayer, checklist
assets/                              optional (everything is drawn procedurally)
```
