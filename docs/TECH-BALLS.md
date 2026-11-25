# Anti Ball & Tech Balls update

Three new playable **balls**. They are spherical ball characters, like every other ball in the game.

| Ball | Unlock | Rarity | Abilities | Ultimate | Special |
|---|---|---|---|---|---|
| **Anti Ball** | **FREE** for every player, forever | Secret | 6 | Absolute Zero | Passive: Anti-Adaptation |
| **Tech Ball 1 — Mecha Commander** | **PREMIUM** (active Ultimate Premium) | Mythical | 5 | Titan Overdrive | Automatic Emergency Repair |
| **Tech Ball 2 — Cyber Overlord** | **PREMIUM** (active Ultimate Premium) | Mythical | 6 | Skynet Protocol | Heat system |

Abilities unlock like on every other ball:
- The first two are ready at level 1.
- The 3rd unlocks in the skill tree at Lv 5.
- The 4th, 5th and 6th unlock at Lv 12.

All of them can be tested in Practice (**▶ Ability showcase** / **Try in Practice**).

In Manual mode, use keys **1–6** or the on-screen buttons. SPACE fires the ultimate.

## Anti Ball — the null entity (free)
- **Null Zone:** a dark field around the ball. Enemies inside deal less damage (−25%) and their abilities are weaker (−40%). Enemy projectiles that fly through it lose damage and speed. Bosses are affected less.
- **Power Absorb:** for a few seconds it swallows up to 4–6 incoming **energy** projectiles and stores the energy (max 100).
  - The next damaging ability or ultimate is boosted by up to +60%, then the energy is spent.
  - It cannot absorb ultimates, missiles, beams or waves.
- **Reverse Impact:** for a few seconds it sends up to 3–5 energy projectiles back at whoever fired them (+20% damage). It never reverses ultimates or missiles. Beams hitting it lose 40%.
- **Mini Black Hole:** a small vortex that pulls enemies in, deals controlled damage over ~2–3 s, then collapses with a small blast.
- **Void Teleport:** vanishes into a dark rift (briefly untouchable) and reappears a short distance away.
  - It picks a safe spot when low on HP, otherwise a flanking spot.
  - Enemies near the exit are slowed.
- **Anti Evolution:** for 4 s (bosses 2 s), enemies within range lose their evolution, rage, God Mode, power-up and overclock bonuses.
  - A running God Mode is cut in half (bosses: −25%).
  - Starting God Mode is postponed while the effect lasts.
  - Nothing is removed permanently.
- **Ultimate — Absolute Zero:** a huge black-and-purple anti-energy wave.
  - It deals heavy area damage and wipes enemy projectiles in its path.
  - It suppresses enemy abilities for 3 s (bosses 1.5 s) and shorts out robots and drones.
  - A resistance window afterwards prevents permanent lock-down.
- **Passive — Anti-Adaptation:** each kind of attack that keeps hitting Anti Ball does less damage over time (projectiles, beams, impacts, fields…).
  - Resistance grows with how hard it is hit.
  - It is capped at **30%** per kind, so it is never immune, and it resets every battle.

## Tech Ball 1 — Mecha Commander (premium)
- **Robot Summon:** 3 small combat robots.
  - They hunt enemies (those near their commander first), shoot and ram.
  - They follow the commander when no enemy is near and get un-stuck automatically.
  - Each has its own HP and timer.
  - Max 5 robots.
- **Mecha Factory:** a stationary factory that builds a robot every 2.4 s (max 3, within the robot cap). It can be destroyed.
- **Missile Barrage:** 6 tracking missiles that explode on impact. They are physical, so Power Absorb and Reverse Impact cannot catch them.
- **Defense Drone:** orbits the ball and takes **half of each hit** until its own HP runs out or it expires. EMP stops it.
- **Robot Fusion:** merges 2+ robots into one **Mega Robot** (more HP, Mega Slam, Rocket Fist) for a few seconds.
- **Emergency Repair (automatic):** at 20% HP or less, a repair robot flies in.
  - It restores up to 22% HP over a few seconds and adds temporary armour.
  - 40 s cooldown, max 3 per battle. The repair robot can be destroyed.
- **Ultimate — Titan Overdrive:** a giant battle robot drops in with a landing marker.
  - It stomps (shockwave), fires 3-shot energy volleys and protects the commander.
  - It has its own HP and lasts ~9 s.

## Tech Ball 2 — Cyber Overlord (premium)
- **Laser Grid:** four laser lines lock around the target. Crossing a laser deals damage (once every 0.45 s per enemy).
- **Hologram Clone:** two holograms mirror the ball's movement and show its HP.
  - They fool enemy AI targeting and homing shots, but deal weak damage.
  - EMP or a few hits destroy them.
- **EMP Pulse:** an electromagnetic wave.
  - It disables enemy abilities for ~2 s (bosses half).
  - It shorts out robots, turrets, drones and holograms (stun + damage).
  - A resistance window afterwards means it is never permanent.
- **Cyber Trap:** a sensor that arms, then zaps and slows up to 3 enemies that come near.
- **Auto Turret:** a stationary laser turret that targets the nearest enemy. Max 2; it can be destroyed.
- **Overclock Mode:** +30% speed, faster cooldowns, +12% attack and a red glow — but heat builds 50% faster.
- **Heat system:**
  - Abilities add heat.
  - At 100 the ball **overheats** for 3 s. Laser Grid, Hologram, EMP, Turret and Overclock are then blocked.
  - Heat cools down over time. The HUD shows a HEAT bar.
- **Ultimate — Skynet Protocol:** 3 combat drones and 2 corner turrets deploy.
  - A laser cross snaps onto the target, then two rotating lasers sweep the arena.
  - Every unit fires synchronized volleys. Lasts ~8 s.

## Limits that keep battles fair and fast
- At most 10 units per ball; robots max 5, turrets max 2, factory max 1.
- All units are temporary and vanish when their commander is defeated.
- No infinite healing: Emergency Repair has a 40 s cooldown, a 22% cap and max 3 uses, and healing is halved in Sudden Death.
- No unlimited reflection: Reverse Impact is limited per use and never reflects ultimates.
- No permanent lock-down: every silence, EMP and Anti Evolution has a duration plus a resistance window, and bosses get shorter effects.
- Units never attack their own team, stay inside the arena walls, and turrets and factories never move.

## Premium access (server-side)
- **Anti Ball:** the game server treats it as usable by every account (`free`). It cannot be bought, because there is nothing to buy.
- **Mecha Commander / Cyber Overlord:** these are `premium` balls.
  - The server allows them only with an **active, server-verified** Ultimate Premium subscription. Practice trials work for everyone.
  - Hiding a button in the browser is never what protects them: `/api/battle/start` and online PvP both check access on the server.
- **When Premium expires:** the Tech Balls lock again. Their saved level, EXP, evolution and skill tree stay in the database and come back as soon as Premium is active again.
- **Same subscription:** there is no new subscription system; the Tech Balls use the existing ULTIMATE PREMIUM membership.

## Balance check
Simulated hard-AI 1v1s at level 30 (evolved, full skill tree) against the 12 strongest existing balls:

| Ball | Win rate | Comparison |
|---|---|---|
| Anti Ball | ≈ 77% | |
| Mecha Commander | ≈ 88% | |
| Cyber Overlord | ≈ 85% | |
| Infinity Ball (Secret) | 86% | similar tier |
| Seraphim (God Tier) | 100% | still beats them most of the time |

Between the three, Cyber Overlord's EMP and lasers are the natural counter to Mecha Commander's robots.

## Tests
`server/test/techballs.test.js` checks the following:
- **Every ability is triggered in real headless battles**, with these results:
  - **Caps:** robot, turret and summon limits hold.
  - **Robots:** they stay in the arena; the factory never moves and can be destroyed.
  - **Defense Drone:** it takes half of each hit.
  - **Emergency Repair:** it triggers once, has a heal cap and a cooldown.
  - **Limited effects:** the Titan and Skynet expire; silence and EMP wear off.
  - **Overheat:** it blocks abilities.
  - **Anti-Adaptation:** it caps at 30%.
  - **Ultimates:** they can be neither absorbed nor reversed.
- **Deterministic full AI battles and online PvP matches.**
- **Server unlock rules:**
  - Anti Ball is free.
  - The Tech Balls are locked without Premium and unlocked with it.
  - They are locked again when it expires, with progress kept.
- **Manual input for abilities 5–6** is accepted by the server's battle replay.
