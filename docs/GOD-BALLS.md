# Update 2.2.0 — Four Supreme God Balls

> **2.7.0:** these four are no longer free. They come with the **Battle Pass (PHP 299, one-time)**. Players who had
> already played them keep them. See [BATTLEPASS-2.7.0.md](BATTLEPASS-2.7.0.md).

**God of Chaos • God of War • AI Tech • Solar Eclipse**

All four are free for every player. You don't need to pay, buy Premium, spend premium currency or be an admin. They are in the normal ball selection, in a new **God** category, and in a new **⚡ Supreme God Balls** section in the Collection.

The code is in `gods.js`. The browser and the game server both load it, after `supreme.js`, so battles can still be replayed and checked on the server and online matches stay in sync. **God of Time and every existing ball are unchanged.**

## How the forms work

| Form | How you get it in a battle | Unlock with free progression |
|---|---|---|
| **Base** | from the start | always |
| **Awakened** | 1st ultimate, or dropping to 50% HP | ball **Lv 10** |
| **Final God Form** | 2nd ultimate | ball **Lv 20** |

- **Each change of form:**
  - plays a transformation animation and changes the ball's look
  - changes what **every ability** does: new patterns, extra effects, new movement
  - makes the passive stronger
- **The Final God Form** also:
  - unlocks a special final-form ultimate
  - shows a special victory animation
- **Every skill has 3 versions** (Base / Awakened / Final God). They are different mechanics, not just higher damage numbers. The in-game preview shows the text for each version.

## The four balls

### God of Chaos — SUPREME GOD (reality manipulation, unpredictable combat)
| Skill | Base | Awakened | Final God |
|---|---|---|---|
| Chaos Rift | 2 rifts fire at the target from different sides | 3 rifts circle the target and fire bursts | 4 rifts linked by crossfire beams, then they implode |
| Madness Orbs | 3 orbs circle, then hunt enemies and explode | 5 orbs; each explosion splits into 2 hunting orbs | 6 orbs spiral in around the target and blow up together |
| Reality Distortion | gravity pulls sideways in a turning direction | gravity pushes outward, enemies' movement is flipped, the field follows the target | physics scrambled: movement twists 90°, shots curve, small explosions |
| Chaos Clone | 2 holograms: a shooter and a rammer | 3 holograms: shooter, orb thrower, exploding rammer | 4 holograms around the target, and it swaps places with one of them |
| Entropy Wave | enemies lose control and their abilities are delayed | also erases enemy shots, then a second wave pulls inward | 3 waves: loss of control, a random effect, a silence |

- **Ultimate: APOCALYPSE OF CHAOS.**
  1. The arena warps and portals open.
  2. Gravity turns.
  3. Giant chaos spheres form overhead.
  4. A huge explosion, then reality returns to normal.
- **Final-form ultimate: INFINITE ANARCHY.** Overlapping distortions on every enemy and crossing rift beams, then a reality-shattering explosion.
- **Passive: UNSTABLE REALITY.**
  - Every 6 s (Base), 4.5 s (Awakened) or 3 s (Final God), its shot pattern changes between SPIRAL, SCATTER and HOMING.
  - At each change, a small rift opens next to an enemy and fires at it.

### God of War — SUPREME GOD (physical combat, weapon summoning)
| Skill | Base | Awakened | Final God |
|---|---|---|---|
| Blade Orbit | 3 swords circle it | 6 swords in two opposite rings, then they launch at an enemy | 6 swords that lunge outward, then fire in a fan |
| War Charge | a charge plus a shockwave | a burning trail, a stun, then a second charge | WARPATH: 3 blink-slashes through the target, then a shockwave |
| Berserker Mode | +20% attack, +15% speed, faster cooldowns, chases enemies | also burns enemies it hits and heals for 10% of impact damage | also makes every impact explode and makes it immune to stun, slow and freeze |
| Sword Rain | 12 swords fall around the target | 18 swords in a cross that stay in the ground as slowing barriers | a cage of 16 swords, then a giant sword falls in the middle |
| Conqueror's Impact | jumps and slams: a shockwave | jumps toward the enemy: 3 rings that crack the ground | pulls enemies in, slams, then 8 swords fly out |

- **Ultimate: THRONE OF DESTRUCTION.**
  1. The arena turns crimson and a spectral warrior rises.
  2. Six swords merge into one celestial blade.
  3. A giant slash crosses the battlefield, then a shockwave.
- **Final-form ultimate: ARMAGEDDON STRIKE.** A gigantic weapon descends and slashes the whole battlefield.
- **Passive: BATTLE INSTINCT.**
  - Every hit in a row adds a stack: +3% attack and +1.5% speed per stack.
  - Maximum stacks: 5 (Base), 7 (Awakened), 10 (Final God).

### AI Tech — SUPREME TECHNOLOGY GOD (adaptation, drones, precision)
| Skill | Base | Awakened | Final God |
|---|---|---|---|
| Neural Scan | marks the target: +15% damage taken from AI Tech | scans every enemy (+18%); shots home in on scanned enemies | +20%; strips shields and buffs, delays enemy abilities by 2 s |
| Drone Swarm | 3 laser drones | 4 drones firing together in formation | 4 drones firing homing micro-missiles, with an EMP when one is destroyed |
| Cyber Clone | a hologram copies its movement and fires when AI Tech uses an ability | 2 holograms that also copy its charges | 3 holograms that look like decoys and explode when destroyed |
| Adaptive Shield | each repeat of the same attack type is resisted more (max 30%) | +10% resistance from the start and reflects 20% of the damage it blocks | also absorbs 3 projectiles and releases a pulse |
| Quantum Laser | locks on, then a tracking laser | the laser bounces into 2 more enemies | 3 lasers meet on the target, plus a quantum mark that explodes |

- **Ultimate: SINGULARITY PROTOCOL.**
  1. The arena becomes a digital grid and targeting reticles lock on.
  2. Drones surround the target.
  3. An orbital station charges a giant laser.
- **Final-form ultimate: OMEGA SINGULARITY.** A combat network links every enemy, a drone fleet fires missiles, and a concentrated beam ends in an arena-wide pulse.
- **Passive: COMBAT LEARNING.**
  - It learns the attack types that keep hitting it: 4% more resistance each time.
  - The cap is 20% (Base), 22% (Awakened) or 25% (Final God) per attack type.
  - It slowly forgets.
  - With every resistance together it never takes more than **45% less damage**, so it is never invincible.

### Solar Eclipse — SUPREME COSMIC GOD (solar, lunar, gravity)
| Skill | Base | Awakened | Final God |
|---|---|---|---|
| Solar Flare | a beam, then a golden explosion | the beam sweeps across, with 3 explosions | 3 beams meet and form a mini-sun that detonates |
| Lunar Shadow | a slowing lunar field | a crescent field that follows the target and drains its ultimate | a growing field that stalls enemy shots and freezes enemies at the end |
| Eclipse Orbit | a sun and a moon orbit it and block 4 shots | the orbit breathes in and out, and the spheres fire beams | 2 suns + 2 moons; blocked shots are fired back |
| Gravity Eclipse | pulls enemies in, then a shockwave | a spinning pull, then a shockwave that stuns | two fields collide in an eclipse shockwave |
| Corona Explosion | charges, then a golden and crimson nova | double nova plus a ring of burning ground | 12 corona flares, then the nova; enemies are blinded |
| **Celestial Shift** (control, always available) | switches between SOLAR and ECLIPSE state | adds a burn or pull pulse | adds a bigger pulse and a 1 s shield |

- **Ultimate: TOTAL ECLIPSE.**
  1. The arena darkens and a gigantic black sun rises.
  2. Golden flames and two celestial rings surround it.
  3. An eclipse explosion spreads across the battlefield.
- **Final-form ultimate: APOCALYPSE OF THE BLACK SUN.**
  1. Solar Eclipse floats above the arena.
  2. Gravity shifts toward an artificial black sun.
  3. A golden and crimson shockwave spreads out.
- **Passive: CELESTIAL BALANCE.**
  - **SOLAR state:** golden aura, solar abilities +25%, cooldowns 10% faster.
  - **ECLIPSE state:** black and crimson aura, gravity and lunar abilities +25%, 10% less damage taken.

## GOD CLASH

When two God Balls fire their ultimates within 0.4 seconds of each other, they lock together for a short **God Clash**:
- the camera zooms in and the two energy beams meet
- the contact point is pushed toward the weaker ball
- a large shockwave goes off at the end

The battle itself decides the winner:
- The strength of each side comes from ultimate power × attack × form × remaining HP, with a small ±12% random swing.
- No ball is favoured, and **either side can win**.

The result:
- **Winner:** its ultimate goes through.
- **Loser:** takes shockwave damage, is stunned, and gets part of its ultimate charge back.
- **Perfect draw:** both ultimates cancel out.

The clash lasts 1.6 s and never stops the rest of the battle. "God Balls" here means the four free gods and the owner's Supreme balls.

## Collection and preview

- **Collection → ⚡ Supreme God Balls** shows, for each ball:
  - its name and class, with a live animated preview
  - its 5 skill icons and ultimate icons
  - its passive
  - its 3 form previews, with a lock until they are unlocked
  - a bar showing progress toward the next form (Lv 10 / Lv 20)
  - a FREE label
- **🔍 Inspect** opens an interactive preview:
  - switch between the 3 forms (and Solar Eclipse's two states) and see the art change live
  - read what every skill does in that form
  - **▶ Test in Practice:** a free practice battle in any form, with no rewards. The test bar lets you switch forms, fire each ability, refill the ultimate, reset cooldowns and preview the entrance, victory and defeat animations.
- **Selection screen:** a "NEW 2.2.0 — SUPREME GOD BALLS • FREE" row.

## Balance

The four are free for everyone and also appear as AI opponents, so they were tuned in simulated battles. Win rate at the same level against the **12 strongest balls** in the game:

| Form | Win rate | For comparison |
|---|---|---|
| Base | ~30–45% | |
| Awakened | ~55–85% | |
| Final God Form | ~80–94% | the premium Tech Balls are 85–88% |

How they were kept in check:
- Smaller stat boosts per form than the owner's Supreme balls, because their abilities themselves get stronger.
- Lighter hits for the richer skill versions.
- Smaller transformation heals.
- Ultimates charge 30% slower.
- AI Tech's resistances are capped at 45% in total.

## Server and security

- The server's ball access check gives `free` access to every signed-in player.
- Practice tests (`godTest`) are allowed for everyone, but only in **Practice** and only for God Balls. They never give rewards.
- The test bar sends commands 9, 10 and 11, which the server accepts in those practice battles.
- ADMIN DELETE commands are still owner-only, and forged commands are rejected.
- `gods.js` is added to the server's list of files it is allowed to send to browsers.

## Tests

`server/test/gods.test.js` covers:
- free access for every player
- the practice test rules
- all 20 skills in all 3 forms, and that each form really is different
- the regular and final-form ultimates
- the 12 forms and the level unlocks
- the 4 passives, including the learning cap
- God Clash, where either side can win
- PvP replay sync
- full AI battles, including a 4-god FFA

The full suite has 84 tests, all passing.
