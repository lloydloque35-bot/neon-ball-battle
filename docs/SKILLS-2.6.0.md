# Update 2.6.0 — ULTIMATE UNIQUE SKILL, MASTERY & EVOLUTION SYSTEM

> **2.8.0:** Anti Ball got its own limited-edition kit (9 unique skills), so its 2.6.0 extra ability (Anti-Matter Annihilation) was removed: 186 new abilities remain.

An upgrade of the existing game. No ball, purchase, level, transformation or saved progress was removed or reset:
everything below is added on top (`skills.js`, `server/skills.js`, migration `008_skills.sql`).

## In short

- **Every ball is its own fighter.** 187 brand-new abilities, a signature mechanic for each of the 224 classic abilities,
  and an extra phase for each of the 65 classic ultimates that used to share a type.
- **Skill slots by rarity** (the ultimate counts as one slot).
- **New abilities unlock gradually** with the ball's own level (the rarest balls also need wins with that ball).
- **Mastery** (5 ranks, earned only in verified battles — looks and titles, never damage).
- **Evolution** of each ball's signature ability (1–3 stages, each adds a new mechanic).
- **44 designed combinations**: follow-ups, counters, arena-object interactions and team reactions.
- **Skill Training** mode, new **skill details** screen with animated previews, **unlock celebration**.
- **Admin Skill Management** for the owner, with an automatic **duplicate-mechanics audit**.
- **Balance rules**: global cast pacing, no stun loops, no endless invulnerability, lighter hits for big kits, Underdog Spirit.

## Skill slots by rarity

| Rarity | Slots (ultimate included) |
|---|---|
| Common | 2 |
| Uncommon | 3 |
| Rare | 4 |
| Epic | 5 |
| Legendary | 6 |
| Mythical | 7 |
| Ancient | 8 |
| Secret | 8 |
| Limited | 9 |
| God Tier | 10 |

- **Common and Uncommon balls keep all four of their abilities** (owner decision: nothing is taken away from players).
  They get no new ones — the limit only stops new abilities from being added.
- Every other collectible ball is filled up to its limit. Admin Exclusive balls keep their kits.
- Slots are a maximum, not a gift: new abilities still have to be unlocked.

## The Unique Skill Registry

Every ability and ultimate of every ball has a record: id (e.g. `fire.0`, `seraphim.k_song`), name, category, ball,
cooldown, power, effect, unlock level/condition, skill rarity (Common → Mythical by when it unlocks), evolution path,
its signature and a **fingerprint of its real mechanics** (mechanic tokens, targeting, activation, effects, animation).

Categories (all in use): Offensive, Defensive, Counterattack, Mobility, Summoning, Arena Manipulation, Trap,
Environmental Control, Transformation, Passive, Autonomous AI, Ultimate. They are categories only — never shared templates.

- **Passive** abilities work on their own all battle long (they cannot be pressed).
- **Autonomous** abilities trigger themselves when their moment comes (e.g. *Guardian Spirit* blocks a shot that is about
  to hit; *Divine Instinct* interrupts an enemy whose ultimate is ready). Players cannot steer them.

Every ability also has **its own cast animation** (a sigil built from its id), **its own sound motif**, and most new
ones have their own projectile look (crescent, star, rune, spear, feather, comet, petal, note, moon, bullet, nano…).
Ultimates of the classic balls open with a **name card in the ball's colours** and a camera push.

## Duplicate detection

The audit compares **mechanics (42%), targeting (14%), activation (10%), effects (12%), animation (12%) and name (10%)** —
the name alone can never make two abilities count as the same or as different.
- 86% or more = duplicate (blocked), 72% or more = similar (warned).
- New proposals (Admin Skill Management) are also compared with every ability's **basic mechanic without its
  signature**: a renamed copy of a classic ability is caught.
- Result for 2.6.0: **0 duplicates and 0 similar pairs among all 640 abilities and ultimates.**

## Gradual unlocking

- Classic abilities unlock as before (1st/2nd from the start, 3rd and 4th through the skill tree) — nothing already
  unlocked is ever locked again.
- New abilities are spread over levels 15–48 (God of Absolute: 55–96). The last one or two abilities of Ancient, Secret,
  Limited and God Tier balls also need **12 / 30 wins with that ball**.
- Locked abilities show their preview, the level/wins needed and a progress bar.
- When an ability becomes available, a **NEW SKILL UNLOCKED** celebration appears after the battle, and the cards glow in
  the ball's details.
- AI opponents unlock theirs by level only. Premium-maxed balls and the owner's balls fight at full power.

## Mastery (looks only)

| Rank | XP | Reward |
|---|---|---|
| Beginner | 0 | — |
| Skilled | 120 | Brighter cast effect |
| Expert | 450 | Mastery sigil animation on cast |
| Master | 1200 | Master aura colour and name banner |
| Grandmaster | 3000 | GRANDMASTER flourish, golden trail and the skill title |

- XP per **verified** battle (server re-simulation): 6 per use (max 48 per ability) + 10 for a win. Practice, Skill
  Training and unverified battles give nothing. Ranked online matches count within the daily reward limits.
- **Mastery titles** (cannot be bought): SKILLED TECHNICIAN (5 abilities Skilled), SKILL EXPERT (3 Expert),
  SKILL MASTER (1 Master), GRANDMASTER (1 Grandmaster).
- Mastery never adds damage.

## Evolution

- Each ball's signature ability (its first one) can evolve. Common–Rare: Awakened. Epic–Legendary: Awakened → Ascended.
  Mythical and above: Awakened → Ascended → Ultimate Variant.
- Each stage adds a **new mechanic** (listed below), its own colour, a bigger cast animation and +4% power — never just numbers.
- Requirements (owner can change them): Awakened Lv 15 + Skilled + 1,500 coins; Ascended Lv 30 + Expert + 4,000;
  Ultimate Variant Lv 45 + Master + 9,000 (God of Absolute: Lv 60 / 80 / 95, 2,500 / 6,000 / 12,000).
- A **preview** runs before you confirm. The server checks everything in one transaction and keeps an append-only log.

## Skill Training mode

Play → **🎯 Skill Training** (or the button in a ball's details):
- 1 target, 3 targets or a moving target; only the abilities you have unlocked; cooldowns start ready.
- Live table: uses, damage, ready state, **cooldown timing** (PERFECT / GOOD / LATE), damage per second, combos found,
  combo hints for that ball; buttons to reset cooldowns, fill the ultimate, reset statistics.
- Never gives coins, EXP, mastery or rank points (runs on the device; the rules engine also returns zero rewards).

## Balance rules

- **Cast pacing:** one ability every 0.45 s per ball (players and AI). No spam.
- **Bigger kits hit a little lighter:** with more than 5 unlocked damage abilities each hits slightly softer, (5/n)^0.2.
  Guards, dashes, buffs and passives do not count (they add options, not damage).
- **No stun loops:** after 3.2 s of chained stuns/freezes/time stops a ball becomes UNSTOPPABLE for 2 s.
- **No permanent invulnerability:** after 4.5 s of near-continuous invulnerability a ball is EXPOSED for 2.5 s
  (scripted moments — transformations, clashes, portals, God of Absolute's trips — are exempt).
- **Underdog Spirit:** a ball fighting an enemy two or more rarity steps higher deals +4% damage and takes 2% less
  per step beyond the first (max +32% / −16%). Neighbouring rarities get no bonus.
- Telegraphs: big new area attacks show their area before they land.

## New abilities by ball (187)

Every one has its own mechanic, look and sound. Unlock = the ball level needed (and wins with that ball for the last abilities of the rarest balls).

### Epic — 5 skill slots

| Ball | Ability | Type | Unlock | What it does |
|---|---|---|---|---|
| Laser Ball | **Targeting Lattice** | Trap | Lv 32 | Drops three laser emitters around the target; beams link them into a triangle for 2.5 s and burn anyone crossing a line |
| Judgment Ball | **Scales of Balance** | Counterattack | Lv 32 | For 3 s the scales weigh every hit taken; then a golden pillar returns 60% of it to the most dangerous enemy (or heals if nothing was taken) |
| Vampire Ball | **Night Hunger** | Autonomous AI | Lv 32 | AUTONOMOUS — when an enemy nearby drops below 30% HP, it blinks behind it on its own and bites (drains life) |
| Gravity Ball | **Graviton Lift** | Arena Manipulation | Lv 32 | Tilts the arena’s gravity: for 1.5 s enemies are hurled toward the nearest wall and take slam damage when they hit it |
| Shadow Ball | **Umbral Mantle** | Transformation | Lv 32 | Wraps itself in shadow for 4 s: enemies more than 260 px away lose track of it, and its next collision strikes 60% harder and weakens |

### Legendary — 6 skill slots

| Ball | Ability | Type | Unlock | What it does |
|---|---|---|---|---|
| Nuclear Ball | **Isotope Decay** | Trap | Lv 15 | Irradiates the target: radiation pulses grow each time (×1, ×2, ×4) and spread to enemies nearby when it ends |
| Nuclear Ball | **Containment Field** | Defensive | Lv 48 | A lead dome surrounds it for 3 s: enemy shots that enter are swallowed and leak out as radioactive puddles |
| Galaxy Ball | **Spiral Arm** | Offensive | Lv 15 | Spins out two arms of stars that sweep the area around it for 1.4 s |
| Galaxy Ball | **Gravitational Lens** | Counterattack | Lv 48 | Places a gravity lens for 4 s: enemy shots passing through it are bent around and sent at the galaxy’s enemies |
| Star Ball | **Shooting Star** | Mobility | Lv 15 | Becomes a comet: streaks 360 px, hitting everything on the way, and leaves stardust that heals allies who touch it |
| Star Ball | **Twinkle Mines** | Trap | Lv 48 | Scatters five twinkling stars around the target; they flash together and detonate 2 s later |
| Nebula Ball | **Protostar** | Arena Manipulation | Lv 15 | Ignites a protostar that grows for 4 s, pulling enemies in; it bursts at the end — or early, smaller, if an enemy touches it |
| Nebula Ball | **Ion Fog** | Environmental Control | Lv 48 | Charged fog fills the area around it for 5 s: enemy shots that pass through it are thrown off course |
| Quantum Ball | **Uncertainty Principle** | Defensive | Lv 15 | For 3 s its position is uncertain: each incoming ability hit has a 50% chance to miss as it shifts 90 px sideways |
| Quantum Ball | **Wavefunction Collapse** | Offensive | Lv 48 | Marks three places the target might be; after 1 s reality collapses: the mark closest to it explodes hard, the others weakly |
| Eclipse Ball | **Penumbra** | Environmental Control | Lv 15 | Casts a ring of half-shadow for 4 s: enemies in the burning ring take fire damage, enemies in the dark core are blinded |
| Eclipse Ball | **Corona Crown** | Transformation | Lv 48 | Ignites a corona for 5 s: +15% attack and a burning halo that scorches enemies who come close |
| Prism Ball | **Color Wheel** | Offensive | Lv 15 | Each cast fires the next colour of the wheel: red burns the ground, blue freezes, green spreads poison to nearby enemies |
| Prism Ball | **Rainbow Bridge** | Mobility | Lv 48 | Lays a rainbow bridge and races along it; allies on the bridge are faster for 3 s, enemies it crosses are dazzled |
| Mirror Ball | **Mirror Maze** | Arena Manipulation | Lv 15 | Raises four mirror panels across the arena for 5 s: enemy shots that hit a panel bounce off and fly back as the Mirror’s own shots |
| Mirror Ball | **Reverse Image** | Counterattack | Lv 48 | Shows the target its reverse image: its movement flips for 1.5 s and the mirror steals its active shield and power-up |
| Sonic Ball | **Sound Barrier** | Defensive | Lv 15 | Breaks the sound barrier for 3 s: hits from the front lose 60% of their damage and ramming an enemy at full speed sends out a boom |
| Sonic Ball | **Resonance** | Offensive | Lv 48 | Tunes every enemy within 500 px to its frequency for 4 s: each ability it uses meanwhile makes them all vibrate for damage |

### Mythical — 7 skill slots

| Ball | Ability | Type | Unlock | What it does |
|---|---|---|---|---|
| Black Hole Ball | **Accretion Disk** | Offensive | Lv 15 | A wide disk of debris orbits it and slowly spirals inward over 5 s, grinding anything caught in it |
| Black Hole Ball | **Tidal Lock** | Environmental Control | Lv 32 | Locks the target into an orbit around the black hole for 2 s: it can only circle, taking damage each lap |
| Black Hole Ball | **Hawking Radiation** | Passive | Lv 48 | PASSIVE — every 2 s, if an enemy is within 260 px, it radiates three particles at it |
| Universe Ball | **Dark Matter Web** | Trap | Lv 15 | Ties the target to an invisible dark-matter anchor for 3 s: straying more than 150 px yanks it back and hurts; enemies near each other are pulled together |
| Universe Ball | **Cosmic Inflation** | Arena Manipulation | Lv 32 | Space itself expands: every enemy is pushed away for 2 s while the universe accelerates (+30% speed for 3 s) |
| Universe Ball | **Heat Death** | Environmental Control | Lv 48 | Drains the target’s energy: for 4 s it moves 40% slower and its cooldowns run 40% slower |
| Dimension Ball | **Fold Back** | Mobility | Lv 15 | Pins this spot in space; 2.5 s later the dimension snaps back to it, dragging nearby enemies along and hurting them |
| Dimension Ball | **Dimensional Cut** | Offensive | Lv 32 | Slices space along a line through the target (clear warning); the cut stays open for 3 s and hurts anyone who crosses it |
| Dimension Ball | **Parallel Echo** | Autonomous AI | Lv 48 | AUTONOMOUS — when a single hit takes 8% of its HP, a parallel self steps out behind the attacker and strikes back |
| Time Ball | **Haste Field** | Environmental Control | Lv 15 | Bends time in a 200 px field for 4 s: allies inside move 25% faster, enemies inside 25% slower |
| Time Ball | **Stopwatch** | Trap | Lv 32 | Starts a stopwatch on the target: 3 s later, 30% of all the damage it took meanwhile happens again |
| Time Ball | **Temporal Afterimage** | Passive | Lv 48 | PASSIVE — every 6 s it leaves an afterimage in time; when an ability hits it hard, it slips back to that afterimage (8 s cooldown) |
| Celestial Ball | **Zodiac Wheel** | Summoning | Lv 15 | Twelve zodiac sigils light up around the arena; one by one, each fires a star at the nearest enemy |
| Celestial Ball | **Astral Projection** | Mobility | Lv 32 | Sends its astral form flying ahead; wherever the projection ends, the celestial body teleports to it in a burst of light |
| Celestial Ball | **Starbind** | Trap | Lv 48 | Two stars pin the target between them for 2.5 s: it cannot stray more than 170 px from their midpoint |
| Dragon Ball | **Wing Gust** | Counterattack | Lv 15 | A beat of its wings blasts a cone in front: enemies are thrown back and enemy shots in the cone are blown back at their owners |
| Dragon Ball | **Dragon’s Hoard** | Defensive | Lv 32 | Golden scales for 5 s: damage taken is 15% lower and every third hit releases a nova of dragonfire |
| Dragon Ball | **Tail Sweep** | Offensive | Lv 48 | Spins its tail in a full circle, striking everything within 150 px twice and knocking it away |
| Phoenix Ball | **Ash Cloud** | Environmental Control | Lv 15 | Bursts into a cloud of ash for 4 s: enemies inside burn and are blinded once, the phoenix inside heals 2% HP per second |
| Phoenix Ball | **Firebird** | Summoning | Lv 32 | Hatches a firebird that hunts on its own, diving through enemies and setting them alight |
| Phoenix Ball | **Cinder Wings** | Passive | Lv 48 | PASSIVE — below 50% HP its wings ignite: it moves 15% faster and anything it crashes into catches fire |
| Angel Ball | **Halo Throw** | Offensive | Lv 15 | Throws its halo: it hovers over the target for 1.5 s pulsing holy light, then flies home and heals the angel |
| Angel Ball | **Guardian Spirit** | Autonomous AI | Lv 32 | AUTONOMOUS — when an enemy shot is about to hit the angel or an ally, a guardian spirit appears on its own, destroys nearby shots and shields them |
| Angel Ball | **Feather Fall** | Mobility | Lv 48 | Rises out of reach and floats down beside the target 0.6 s later: the landing wave hurts enemies and heals allies |
| Toxic Reactor Ball | **Coolant Purge** | Defensive | Lv 15 | Vents coolant: removes its burns and poison, takes 20% less damage for 3 s, and leaves a freezing mist that slows enemies |
| Toxic Reactor Ball | **Chain Fission** | Offensive | Lv 32 | A neutron bolt: every enemy it hits splits it into two new bolts aimed at other enemies, for two generations |
| Toxic Reactor Ball | **Reactor Overdrive** | Transformation | Lv 48 | Pushes the reactor past its limit for 5 s: +25% attack and 20% faster cooldowns, but it loses 1% HP per second; ends with a toxic pulse |
| Magnetar Ball | **Magnetize** | Environmental Control | Lv 15 | Magnetises the target for 3.5 s: the magnetar’s shots curve hard onto it, and other enemies are dragged toward it |
| Magnetar Ball | **Iron Filings** | Trap | Lv 32 | Scatters a line of iron filings toward the target: each patch an enemy crosses sticks more (3 patches root it for 0.6 s) |
| Magnetar Ball | **Magnetic Deflector** | Counterattack | Lv 48 | For 3 s a magnetic field bends enemy shots away: projectiles that come within 180 px curve off and miss |
| Rift Ball | **Rift Lash** | Environmental Control | Lv 15 | Lashes the target with a rift whip and drags it through space to the far side of the rift ball |
| Rift Ball | **Fracture Field** | Arena Manipulation | Lv 32 | Splits space into three jagged walls around the target for 3 s: they block movement and cut whoever touches them |
| Rift Ball | **Rift Walker** | Passive | Lv 48 | PASSIVE — every third ability it casts folds space and moves it 150 px away from the closest enemy |
| Mecha Commander Ball | **Repair Nanites** | Defensive | Lv 32 | Releases repair nanites: it heals 8% HP over 3 s, every robot, drone and factory heals 25% and takes 30% less damage for 4 s |

### Ancient — 8 skill slots

| Ball | Ability | Type | Unlock | What it does |
|---|---|---|---|---|
| Demon Ball | **Hellgate Chains** | Trap | Lv 15 | Chains burst from the ground under the target (warning first): it is rooted for 1 s, then dragged toward a burning hellgate |
| Demon Ball | **Imp Legion** | Summoning | Lv 26 | Calls three imps from below; they keep their distance and lob little skull-fireballs at enemies |
| Demon Ball | **Infernal Contract** | Transformation | Lv 37 + 12 wins | Signs away 15% of its current HP: for 6 s its abilities are 20% stronger and leave hellfire where its target stands |
| Demon Ball | **Brimstone Rain** | Environmental Control | Lv 48 + 30 wins | Sulphur rains on the half of the arena the target is in: ten burning strikes fall there over 3 s |
| Chaos Ball | **Dice of Fate** | Transformation | Lv 15 | Rolls the dice of fate: 1 heal • 2 shield • 3 giant bolt • 4 stunning nova • 5 a chaos clone • 6 JACKPOT (all of them, weaker) |
| Chaos Ball | **Chaos Gravity** | Arena Manipulation | Lv 26 | Unhinges gravity for 3.5 s: every 0.7 s it lurches in a new random direction, flinging enemies around |
| Chaos Ball | **Disorder** | Counterattack | Lv 37 + 12 wins | Hands all its own burns, poison, slows, weakness and stuns to the target and is cleansed of them |
| Chaos Ball | **Butterfly Effect** | Passive | Lv 48 + 30 wins | PASSIVE — every hit it lands has a 10% chance to cause a random extra effect (burn, freeze, poison, stun, slow or weakness) |
| Immortal Ball | **Phylactery** | Defensive | Lv 15 | Hides part of its soul in a vessel nearby: while the vessel stands (8 s, it can be destroyed), the Immortal takes 30% less damage |
| Immortal Ball | **Eternal Return** | Counterattack | Lv 26 | For 2.5 s every wound it takes starts to undo itself: half of each hit is healed back two seconds later |
| Immortal Ball | **Ageless Vigor** | Passive | Lv 37 + 12 wins | PASSIVE — after 3 s without taking damage it regenerates 0.8% HP per second |
| Immortal Ball | **Undying Wrath** | Offensive | Lv 48 + 30 wins | A crushing close-range blast whose damage grows with every bit of HP the Immortal is missing (up to double) |

### Secret — 8 skill slots

| Ball | Ability | Type | Unlock | What it does |
|---|---|---|---|---|
| Infinity Ball | **Möbius Strip** | Offensive | Lv 15 | Launches an orb that traces an endless figure-eight around the target for 3 s, cutting through everything on its loop |
| Infinity Ball | **Recursion** | Transformation | Lv 26 | Calls itself again: instantly re-casts the last other ability it used, at 55% power |
| Infinity Ball | **Loop Trap** | Trap | Lv 37 + 12 wins | Closes space into a 160 px loop around the target for 4 s: whoever tries to leave comes back in on the opposite side |
| Infinity Ball | **Limitless** | Passive | Lv 48 + 30 wins | PASSIVE — its cooldowns run 15% faster for each enemy within 300 px (up to two) |
| Omniverse Ball | **Multiversal Barrage** | Offensive | Lv 15 | Three parallel universes open windows around the arena and fire lasers that cross where the target is heading |
| Omniverse Ball | **Cosmic Rewrite** | Environmental Control | Lv 26 | Rewrites the arena’s laws for 3.5 s in its favour: a random world — frozen (enemies slowed), storm (lightning on enemies) or inverted (enemies steer backwards) |
| Omniverse Ball | **Fate Branch** | Defensive | Lv 37 + 12 wins | For 3 s fate branches: any heavy hit (over 5% HP) is halved and the other half splits off into a decoy self |
| Omniverse Ball | **Omniscience** | Passive | Lv 48 + 30 wins | PASSIVE — sees every possible future: +10% critical chance and its aimed abilities never miss their prediction |
| Reality Ball | **Undo Movement** | Environmental Control | Lv 15 | Presses undo on the target: it is snapped back to wherever it was 1.5 s ago |
| Reality Ball | **Paradox** | Counterattack | Lv 26 | For 2 s a paradox surrounds it: every enemy ability that hits it also hits its own caster for half the damage |
| Reality Ball | **Reality Tears** | Arena Manipulation | Lv 37 + 12 wins | Rips three tears in the arena for 5 s: an enemy that touches one is thrown out of another and hurt |
| Reality Ball | **Lucid Dream** | Transformation | Lv 48 + 30 wins | Drifts into a lucid dream for 4 s: a quarter of all hits pass through it and it moves 15% faster |
| Soul Ball | **Soul Link** | Trap | Lv 15 | Binds two enemies’ souls for 4 s: 40% of the damage one takes is also dealt to the other (alone, the enemy is bound to the Soul Ball’s wounds instead) |
| Soul Ball | **Wandering Souls** | Summoning | Lv 26 | Releases four lost souls that drift through the arena for 5 s; a soul that touches an enemy clings to it and drains it |
| Soul Ball | **Spirit Walk** | Mobility | Lv 37 + 12 wins | Leaves its body (which cannot be hurt) and its spirit flies out and back through the enemy, hurting everything it passes; the body then heals 3% |
| Soul Ball | **Soul Collector** | Passive | Lv 48 + 30 wins | PASSIVE — collects a soul whenever an enemy falls or loses another 25% of its HP: +3% attack per soul (up to 5) |
| Dimension King Ball | **Royal Summons** | Summoning | Lv 15 | Two royal knights step out of a portal to guard the king; they charge any enemy that comes near him |
| Dimension King Ball | **Edict of Exile** | Arena Manipulation | Lv 26 | Exiles the target to a pocket dimension for 1.2 s (it can neither act nor be hit), then drops it in a far corner |
| Dimension King Ball | **Crown of Dimensions** | Transformation | Lv 37 + 12 wins | Wears the crown for 5 s: every ability it casts also opens a portal behind its target that fires a royal bolt |
| Dimension King Ball | **Sovereign Presence** | Passive | Lv 48 + 30 wins | PASSIVE — enemies within 260 px of the king deal 10% less damage |
| Unknown Ball | **Redacted** | Counterattack | Lv 15 | Its existence is [REDACTED] for 3 s: homing shots lose track of it and enemies aim at where it is not |
| Unknown Ball | **Missing Texture** | Environmental Control | Lv 26 | Six broken purple-and-black tiles flicker across the arena for 5 s, jumping to new spots; enemies on a tile glitch out (slow + damage) |
| Unknown Ball | **?????** | Offensive | Lv 37 + 12 wins | Something happens to the target. It is never the same thing twice in a row: weakness, confusion, silence or a sudden slowdown — always with damage |
| Unknown Ball | **Undefined Behavior** | Passive | Lv 48 + 30 wins | PASSIVE — when an ability hits it, there is a 20% chance nothing happens and it glitches a short way off (3 s cooldown) |
| Anti Ball | **Anti-Matter Annihilation** | Counterattack | Lv 32 | Fires a slow orb of anti-matter: every enemy shot it touches is annihilated in a burst, and it detonates on the first enemy it reaches |

### Limited — 9 skill slots

| Ball | Ability | Type | Unlock | What it does |
|---|---|---|---|---|
| Blood Moon Ball | **Moonbeam Ritual** | Environmental Control | Lv 15 | A blood-red moonbeam locks onto the target for 3 s, following it and burning it; every tick heals the Blood Moon |
| Blood Moon Ball | **Crimson Tide** | Offensive | Lv 23 | Sweeps a crescent of blood in front of it: everything in the 140° arc is hit and drained |
| Blood Moon Ball | **Lunar Phases** | Passive | Lv 32 | PASSIVE — cycles through the moon every 5 s: New Moon (+15% speed), Half Moon (+15% defence), Full Moon (+15% attack) |
| Blood Moon Ball | **Nightstalker** | Autonomous AI | Lv 40 + 12 wins | AUTONOMOUS — when a hurt enemy (below 50%) tries to run away from it, the Blood Moon pounces on its own |
| Blood Moon Ball | **Hemorrhage Burst** | Offensive | Lv 48 + 30 wins | Makes every bleeding, burning or poisoned enemy erupt: each one takes burst damage and its lingering effect is used up |
| Aurora Ball | **Curtain of Light** | Defensive | Lv 15 | Hangs a shimmering curtain of light between itself and the target for 4 s; it blocks every enemy shot that hits it |
| Aurora Ball | **Solar Wind** | Environmental Control | Lv 23 | A solar wind blows across the whole arena for 3 s: enemies are pushed downwind and allies ride it 20% faster |
| Aurora Ball | **Ribbon Dance** | Mobility | Lv 32 | Dances along a wavy path for 1 s, trailing ribbons of light that hurt and slow enemies who cross them |
| Aurora Ball | **Magnetosphere** | Counterattack | Lv 40 + 12 wins | For 3 s beams and lasers that hit it lose half their power, and each one recharges its cooldowns by 1 s |
| Aurora Ball | **Polar Night** | Transformation | Lv 48 + 30 wins | Becomes the polar night for 5 s: its shots chill enemies (three chills freeze), and it moves 15% faster |
| Frost Crown Ball | **Ice Wall** | Arena Manipulation | Lv 15 | Raises a wall of ice between it and the target: it blocks movement and shots for 3 s, then shatters into flying shards |
| Frost Crown Ball | **Freeze Command** | Counterattack | Lv 23 | A royal command freezes the target’s readiest ability: it is put back on its full cooldown |
| Frost Crown Ball | **Royal Icicle Guard** | Summoning | Lv 32 | Plants three ice sentinels around itself; they stand guard for 6 s and fire freezing shards at enemies in range |
| Frost Crown Ball | **Permafrost** | Environmental Control | Lv 40 + 12 wins | Freezes the floor around it for 4 s: enemies on the ice slide helplessly (they can barely steer) while the Frost Crown skates 20% faster |
| Frost Crown Ball | **Avalanche** | Offensive | Lv 48 + 30 wins | Rolls a snowball that gathers snow as it goes — it grows, speeds up and flattens whatever it hits with a huge knockback |
| Solar Flare Ball | **Coronal Loop** | Offensive | Lv 15 | Throws an arc of plasma that bends after the target and loops back, burning everything along both halves of the arc |
| Solar Flare Ball | **Sun Shield** | Defensive | Lv 23 | A blazing shield for 3 s: it blocks 35% (50% if enemies nearby are already burning) and sets attackers on fire |
| Solar Flare Ball | **Solar Cycle** | Passive | Lv 32 | PASSIVE — every 8 s the sun reaches its maximum: the next ability it uses is 40% stronger |
| Solar Flare Ball | **Helios Beam** | Environmental Control | Lv 40 + 12 wins | A beam of sunlight from the sky sweeps across a band of the arena through the target’s position |
| Solar Flare Ball | **Mini Sun** | Summoning | Lv 48 + 30 wins | Creates a miniature sun that circles the middle of the arena for 5 s, scorching any enemy that comes close to it |
| Cyber Glitch Ball | **Lag Spike** | Environmental Control | Lv 15 | Gives the target a bad connection for 2.5 s: every half second it rubber-bands back to where it was |
| Cyber Glitch Ball | **Ctrl+Z** | Defensive | Lv 23 | Undoes the last 2 s: every point of damage it took in that time is restored |
| Cyber Glitch Ball | **Dead Pixels** | Trap | Lv 32 | Scatters dead pixels that blink in and out of sight; touching one shorts the enemy out (damage and a 0.6 s silence) |
| Cyber Glitch Ball | **Buffer Overflow** | Offensive | Lv 40 + 12 wins | Streams six data packets at the target; each one that lands makes the next hit harder (×1.25 each) |
| Cyber Glitch Ball | **Patch Notes** | Passive | Lv 48 + 30 wins | PASSIVE — after being hit twice by the same ability, it patches itself and takes 25% less damage from that ability for the rest of the battle |
| Sakura Spirit Ball | **Blossom Vortex** | Environmental Control | Lv 15 | A whirl of petals spins around the target for 2 s, carrying it round in circles and cutting it |
| Sakura Spirit Ball | **Hanami Garden** | Defensive | Lv 23 | Plants a blossoming cherry tree for 7 s: every second it heals Sakura and allies near it (enemies can cut it down) |
| Sakura Spirit Ball | **Petal Cut** | Offensive | Lv 32 | A crescent slash flies out and scatters petals on its path; 1.5 s later every petal bursts |
| Sakura Spirit Ball | **Wind Through Branches** | Mobility | Lv 40 + 12 wins | Three quick zig-zag hops toward the target, each landing with a little burst of petals |
| Sakura Spirit Ball | **Sakura Spirit** | Autonomous AI | Lv 48 + 30 wins | AUTONOMOUS — whenever Sakura is in a fight, a spirit fox appears on its own for 8 s and always hunts the weakest enemy |

### God Tier — 10 skill slots

| Ball | Ability | Type | Unlock | What it does |
|---|---|---|---|---|
| Seraphim Ball | **Six Wings** | Transformation | Lv 15 | Unfurls all six wings for 5 s: it flies 30% faster and every second its wings shed a ring of burning feathers |
| Seraphim Ball | **Purifying Brand** | Trap | Lv 22 | Brands the target for 3 s: any healing it receives is purified into damage instead |
| Seraphim Ball | **Halo of Judgment** | Trap | Lv 28 | A giant halo descends around the target (1 s warning) and snaps shut: everyone still inside is struck and stunned |
| Seraphim Ball | **Seraph’s Song** | Environmental Control | Lv 35 | Sings for 4 s: allies within 400 px regenerate 1.5% HP per second and enemies within it recover their abilities 30% slower |
| Seraphim Ball | **Choir Sentinel** | Autonomous AI | Lv 41 + 12 wins | AUTONOMOUS — the moment the Seraphim is burned, poisoned, slowed, weakened, frozen or stunned, a choir sentinel cleanses it on its own and smites the nearest enemy |
| Seraphim Ball | **Wrath of Heaven** | Offensive | Lv 48 + 30 wins | Five holy spears fall one after another along the line from the Seraphim to the target |
| Divine Ball | **Miracle of Light** | Defensive | Lv 15 | A flash of divine light: the Divine and every ally become untouchable for 0.8 s and are cleansed |
| Divine Ball | **Divine Scales** | Counterattack | Lv 22 | Weighs its health against the target’s: if the target is healthier it is struck by the difference, if not the Divine is healed by it |
| Divine Ball | **Holy Spear** | Offensive | Lv 28 | Hurls a spear that skewers the first enemy and carries it along; if it is pinned against a wall it is rooted and takes extra damage |
| Divine Ball | **Ascension** | Mobility | Lv 35 | Ascends out of reach for 1 s, then descends beside the weakest enemy in a burst of light |
| Divine Ball | **Sacred Ground** | Arena Manipulation | Lv 41 + 12 wins | Consecrates a wide circle for 5 s: enemies inside burn and cannot be healed, allies inside gain 20% defence |
| Divine Ball | **Grace** | Passive | Lv 48 + 30 wins | PASSIVE — the first time each battle it drops below 25% HP, grace wraps it in a 90% shield for 3 s |
| Ancient God Ball | **Monoliths** | Arena Manipulation | Lv 15 | Raises three ancient monoliths for 7 s: they block the way and send out a shockwave every 1.5 s (they can be destroyed) |
| Ancient God Ball | **Primordial Roar** | Environmental Control | Lv 22 | A roar from before time: enemies in front of it are terrified and flee from it for 1.5 s |
| Ancient God Ball | **Ancient Runes** | Trap | Lv 28 | Carves four runes into the ground around itself; each rune stuns the first enemy that steps on it |
| Ancient God Ball | **Titan Grip** | Offensive | Lv 35 | Seizes the nearest enemy within 260 px, drags it in and slams it into the ground |
| Ancient God Ball | **Elder Wisdom** | Passive | Lv 41 + 12 wins | PASSIVE — every 10 s it foresees the next enemy ability and that hit does nothing |
| Ancient God Ball | **Epoch Shift** | Environmental Control | Lv 48 + 30 wins | Ages the whole battlefield: every enemy trap, field and wall crumbles away, and enemy summons and clones lose half their health |
| Creator Ball | **Breath of Life** | Summoning | Lv 15 | Breathes life into a sprite that follows the Creator for 8 s, healing it every 1.5 s and pelting enemies with seeds of light |
| Creator Ball | **Terraform** | Arena Manipulation | Lv 22 | Raises a ring of earth around the target: for 2 s it is caged inside eight walls |
| Creator Ball | **Let There Be Stars** | Offensive | Lv 28 | Creates five new stars around the arena; after a moment they all converge on the target |
| Creator Ball | **Creative Spark** | Transformation | Lv 35 | Invents something new: for 8 s it gains a brand-new ability borrowed from creation (a random classic ability of another ball) |
| Creator Ball | **Divine Blueprint** | Counterattack | Lv 41 + 12 wins | Studies the target’s design: the Creator’s next three hits on it deal 40% more damage |
| Creator Ball | **World Seed** | Passive | Lv 48 + 30 wins | PASSIVE — whenever it is healed for a good amount, a seed falls and two seconds later blooms into a small healing garden |
| Destroyer Ball | **Obliteration Mark** | Offensive | Lv 15 | Marks a spot for obliteration (1.6 s warning): a column of destruction then erases everything standing there |
| Destroyer Ball | **Unmaking** | Counterattack | Lv 22 | Unmakes everything around it: enemy shields, power-ups and reflections within 350 px are erased and their clones destroyed |
| Destroyer Ball | **Ravager Form** | Transformation | Lv 28 | Becomes a ravager for 6 s: collisions hit 50% harder and send out a shockwave — but it takes 10% more damage |
| Destroyer Ball | **Shatter Ground** | Arena Manipulation | Lv 35 | Cracks the arena in a cross centred on the target; the four cracks keep burning for 2.5 s |
| Destroyer Ball | **Doom Clock** | Trap | Lv 41 + 12 wins | Starts the doom clock on the target: when it runs out (5 s), the target suffers 30% of all the damage it dealt meanwhile |
| Destroyer Ball | **Endless Destruction** | Passive | Lv 48 + 30 wins | PASSIVE — every third hit in a row on the same enemy adds +4% attack for the rest of the battle (up to +20%) |
| Absolute Ball | **Zero Point** | Environmental Control | Lv 15 | Creates a point where motion is forbidden: enemies within 120 px of it cannot move for 1.6 s, then are expelled |
| Absolute Ball | **Absolute Order** | Counterattack | Lv 22 | Restores order: every enemy shot in the arena is erased, and each enemy whose shot was erased is stunned for a moment |
| Absolute Ball | **Unyielding** | Defensive | Lv 28 | For 3 s nothing moves it: immune to stuns and knockback, and enemies that ram it bounce off hurt |
| Absolute Ball | **Absolute Edge** | Offensive | Lv 35 | A single perfect cut along a thin line through the target (0.5 s warning) — always a critical hit |
| Absolute Ball | **Absolute Presence** | Passive | Lv 41 + 12 wins | PASSIVE — its shots cannot be reflected, absorbed or blocked, and its damage pushes 20% harder through shields |
| Absolute Ball | **Final Verdict** | Offensive | Lv 48 + 30 wins | Passes the final verdict: a light strike — but if the target is below 25% HP it is a devastating one |
| God of Chaos Ball | **Chaos Theory** | Environmental Control | Lv 15 | For 4 s, every 0.8 s a random hazard erupts next to an enemy: a lightning strike, a toxic pool, a bolt from the wall or a gravity snag |
| God of Chaos Ball | **Fractal Split** | Offensive | Lv 26 | A bolt that splits on a timer: into two after 0.35 s, and each of those into two more after 0.7 s |
| God of Chaos Ball | **Pandemonium Shield** | Defensive | Lv 37 + 12 wins | A crackling shield for 3 s (30% block); every hit on it makes chaos strike back at random — a bolt, a stunning zap or a slowing burst |
| God of Chaos Ball | **Discord** | Environmental Control | Lv 48 + 30 wins | Sows discord: for 3 s enemies turn on each other (in a duel the enemy staggers about aimlessly for 1.2 s) |
| God of War Ball | **War Banner** | Summoning | Lv 15 | Plants a war banner for 6 s: allies near it hit 20% harder and enemies near it are 10% easier to hurt (it can be torn down) |
| God of War Ball | **Shield Wall** | Defensive | Lv 26 | Locks its shield to the front for 2.5 s (frontal hits lose 80%), then bashes forward into the enemy |
| God of War Ball | **Warlord’s Challenge** | Counterattack | Lv 37 + 12 wins | Challenges the most dangerous enemy to a duel for 4 s: it must fight the God of War, both deal each other 20% more, and anyone else interfering does 50% less to it |
| God of War Ball | **Spear Barrage** | Offensive | Lv 48 + 30 wins | Hurls five war spears in quick succession, each faster than the last; every spear that lands slows the target |
| AI Tech Ball | **Predictive Algorithm** | Counterattack | Lv 15 | Runs a prediction model for 4 s: its aimed shots lead their targets perfectly and enemy shots near it are slowed by 40% |
| AI Tech Ball | **Neural Hack** | Counterattack | Lv 26 | Hacks the target’s brain for 1.2 s: its abilities are offline and it wanders where the virus tells it |
| AI Tech Ball | **Nanoswarm** | Offensive | Lv 37 + 12 wins | Releases a swarm of nanobots that cloud around the target for 3 s, nibbling at it and eating 10% of its armour |
| AI Tech Ball | **Self-Upgrade** | Transformation | Lv 48 + 30 wins | Installs an upgrade for the rest of the battle: +5% attack and speed each time (up to three versions) |
| Solar Eclipse Ball | **Diamond Ring** | Offensive | Lv 15 | The diamond ring flashes: a blinding ray sweeps a full circle around the eclipse in 1.5 s |
| Solar Eclipse Ball | **Baily’s Beads** | Trap | Lv 32 + 12 wins | Strings seven beads of light in an arc toward the target; they detonate one after another along the arc |
| Solar Eclipse Ball | **Totality Veil** | Environmental Control | Lv 48 + 30 wins | Totality falls in a 260 px dome for 4 s: enemies inside cannot see to aim at anyone, allies inside hit 10% harder |
| God of Guns Ball | **Ricochet Revolver** | Offensive | Lv 15 | Fans six revolver rounds at the walls; after their first ricochet every round homes in on the target |
| God of Guns Ball | **Sniper’s Nest** | Transformation | Lv 26 | Plants itself and aims for 1.5 s (a red laser sight shows the line), then fires one devastating high-velocity round |
| God of Guns Ball | **Smoke Grenade** | Environmental Control | Lv 37 + 12 wins | Pops a smoke grenade (200 px, 4 s): enemy shots inside lose their lock, and the God of Guns dodges 30% of hits while inside |
| God of Guns Ball | **Bullet Time** | Counterattack | Lv 48 + 30 wins | Bends time around it for 2.5 s: every enemy shot within 400 px crawls at a quarter of its speed |
| God Portal Ball | **Portal Barrage** | Offensive | Lv 15 | Opens four portals around the target; a void bolt shoots out of each one straight at it |
| God Portal Ball | **Wormhole Network** | Mobility | Lv 26 | Jumps through three wormholes around the target in quick succession, leaving a void bomb behind at every exit |
| God Portal Ball | **Event Horizon Gate** | Trap | Lv 37 + 12 wins | Opens a gate in the target’s path for 5 s: the first enemy to touch it is swallowed for a second and spat out against the far wall |
| God Portal Ball | **Dimensional Anchor** | Counterattack | Lv 48 + 30 wins | Drops a dimensional anchor: for 4 s enemies within 500 px cannot use any movement ability (dashes, blinks, portals) |
| God of Absolute Ball | **Mandate of Heaven** | Environmental Control | Lv 55 | Issues a heavenly mandate: every enemy within 500 px has its cooldowns pushed back 2 s, and each one fuels the ultimate |
| God of Absolute Ball | **Absolute Rebuke** | Counterattack | Lv 69 | For 1.5 s every enemy ability that strikes it is refused and answered with a golden lance at its caster |
| God of Absolute Ball | **Starforge Lances** | Offensive | Lv 82 + 12 wins | Forges six golden lances in the sky above the enemies; a second later they drop where the enemies stand |
| God of Absolute Ball | **Divine Instinct** | Autonomous AI | Lv 96 + 30 wins | AUTONOMOUS — the instant any enemy’s ultimate is fully charged, a golden bolt strikes it on its own and drains 30% of that charge |

## Signature mechanics of the classic abilities

No two abilities of the same type share a signature, so a beam is never just another beam.

| Ball | Ability | Signature | What it adds |
|---|---|---|---|
| Fire Ball | Fireball | **Ember Scatter** | Leaves a patch of burning ground where it lands |
| Fire Ball | Flame Dash | **Fire Trail** | Leaves a burn trail behind the dash |
| Fire Ball | Inferno Ring | **Twin Inferno** | A second ring follows right behind |
| Ice Ball | Ice Shards | **Deep Chill** | Chills: every 3 hits freeze the enemy |
| Ice Ball | Frost Armor | **Frostbite Shell** | Enemies that crash into it are frozen |
| Ice Ball | Blizzard Trap | **Spreading Blizzard** | Spreads wider every second |
| Thunder Ball | Lightning Strike | **Forked Lightning** | Forks to strike a second enemy too |
| Thunder Ball | Volt Dash | **Arc Dash** | Jumps to 2 more enemies nearby |
| Thunder Ball | Chain Spark | **Arc Chain** | Jumps to 2 more enemies nearby |
| Water Ball | Water Jet | **Pressure Jet** | Blasts the enemy far away |
| Water Ball | Healing Tide | **Rising Tide** | Keeps healing for 4 more seconds |
| Water Ball | Tidal Wave | **Undertow** | Leaves a slowing ring on the ground |
| Earth Ball | Rock Throw | **Skipping Stone** | Ricochets off the arena walls 2 times |
| Earth Ball | Stone Skin | **Bedrock** | The caster cannot be knocked around and blocks 10% more |
| Earth Ball | Earthquake | **Fault Lines** | Cracks race out to the walls in four directions |
| Wind Ball | Gale Blades | **Returning Gale** | Flies out, then curves back to the caster, hitting again on the way back |
| Wind Ball | Tailwind | **Gale Trail** | While powered up, leaves a damaging trail |
| Wind Ball | Cyclone | **Eye of the Storm** | Swallows enemy projectiles that fly near it |
| Light Ball | Light Ray | **Dazzling Ray** | Blinds the enemy: it wanders for a moment |
| Light Ball | Flash Blind | **Afterimage Daze** | Confuses the enemy: its steering is reversed briefly |
| Light Ball | Radiant Heal | **Searing Light** | The healing light also burns enemies close by |
| Dark Ball | Shadow Orb | **Shadow Mark** | Marks the enemy: the mark detonates 2 s later |
| Dark Ball | Void Pulse | **Void Pull** | The ring pulls enemies in instead of pushing them away |
| Dark Ball | Dark Drain | **Night Siphon** | Steals ultimate charge from the enemy |
| Poison Ball | Venom Spit | **Venom Stack** | Adds an extra poison stack |
| Poison Ball | Toxic Pool | **Creeping Pool** | Creeps toward the nearest enemy |
| Poison Ball | Plague Burst | **Plague Ground** | Leaves a crater of hazardous ground |
| Plasma Ball | Plasma Bolt | **Plasma Fission** | On impact it shatters into 3 shards that keep flying |
| Plasma Ball | Plasma Field | **Expanding Field** | Its orbit keeps widening |
| Plasma Ball | Ion Cannon | **Ion Charge** | Charges longer (clear warning), then hits much harder |
| Spider Ball | Web Shot | **Silk Line** | Tethers the enemy: if it runs too far it is yanked back and hurt |
| Spider Ball | Web Trap | **Sticky Snare** | The first enemy to step in is rooted in place |
| Spider Ball | Venom Fang | **Double Fang** | Adds an extra poison stack |
| Laser Ball | Laser Beam | **Ricochet Laser** | Reflects off the wall it hits and fires back across the arena |
| Laser Ball | Laser Grid | **Penetrating Grid** | Passes through up to 1 enemies |
| Laser Ball | Overcharge | **Overcharged Optics** | +20% critical chance while powered up |
| Judgment Ball | Verdict Beam | **Verdict Mark** | Marks the enemy: the mark detonates 2 s later |
| Judgment Ball | Sentence | **Sentenced** | Marks the enemy: the mark detonates 2 s later |
| Judgment Ball | Penance | **Penitent Slam** | Enemies blasted into a wall take slam damage |
| Vampire Ball | Blood Drain | **Open Wound** | Makes the enemy bleed for a few seconds |
| Vampire Ball | Bat Swarm | **Bat Scatter** | Sparks fly off the target and seek other enemies |
| Vampire Ball | Crimson Dash | **Crimson Cut** | Makes the enemy bleed for a few seconds |
| Zombie Ball | Rot Bite | **Plague Bite** | Burning or poison on the target spreads to enemies next to it |
| Zombie Ball | Infect | **Contagion** | Burning or poison on the target spreads to enemies next to it |
| Zombie Ball | Rise Again | **Frenzied Return** | Comes back powered up |
| Nuclear Ball | Radiation Leak | **Critical Leak** | Detonates when it expires |
| Nuclear Ball | Fission Bolt | **Fission Charge** | Sticks to the target and explodes a second later |
| Nuclear Ball | Meltdown | **Chain Reaction** | A second, smaller blast follows |
| Crystal Ball | Crystal Shards | **Bouncing Facets** | Ricochets off the arena walls 1 times |
| Crystal Ball | Prism Shield | **Prismatic Facets** | For the first 0.6 s it reflects projectiles |
| Crystal Ball | Refraction Beam | **True Refraction** | Splits into two extra side rays |
| Gravity Ball | Gravity Well | **Crushing Well** | Crushes harder the closer enemies get to its centre |
| Gravity Ball | Crush | **Implosion** | Sucks enemies in before they are thrown out |
| Gravity Ball | Mass Shift | **Mass Drag** | Grabs the enemy and carries it along |
| Magnet Ball | Magnetic Pull | **Polarity Flip** | Ends by flinging everyone caught far away |
| Magnet Ball | Polarity Shot | **Magnetic Hook** | Drags the enemy toward the caster |
| Magnet Ball | Repulse | **Repulsion Field** | Wipes out enemy projectiles it touches |
| Shadow Ball | Shadow Step | **Shadow Snare** | Leaves a trap where it vanished |
| Shadow Ball | Shadow Clone | **Shadow Burst** | Its clones explode when they vanish |
| Shadow Ball | Night Blades | **Night Blindness** | Blinds the enemy: it wanders for a moment |
| Galaxy Ball | Star Burst | **Orbiting Stars** | Circles the caster first, then launches at full speed |
| Galaxy Ball | Cosmic Ray | **Cosmic Sweep** | After firing, it sweeps across in an arc |
| Galaxy Ball | Nebula Shield | **Orbiting Moons** | Two guard orbs circle the caster and block shots |
| Black Hole Ball | Event Horizon | **Growing Horizon** | Spreads wider every second |
| Black Hole Ball | Spaghettify | **Spaghettification** | Drags the enemy toward the caster |
| Black Hole Ball | Hawking Burst | **Hawking Collapse** | At full size the ring collapses back in, dragging enemies to its centre |
| Universe Ball | Big Bang | **Cosmic Rings** | A second ring of blasts erupts farther out |
| Universe Ball | Starfall | **Impact Craters** | Leaves a crater that slows anyone inside |
| Universe Ball | Cosmic Expansion | **Expanding Universe** | 4 aftershocks erupt around it |
| Star Ball | Star Shot | **Twinkling Split** | On impact it shatters into 2 shards that keep flying |
| Star Ball | Solar Flare | **Solar Fragments** | Sprays 8 shards in every direction |
| Star Ball | Starlight Heal | **Starlight Charge** | Charges the ultimate meter |
| Nebula Ball | Nebula Cloud | **Nebular Drift** | Gently drags enemies toward its centre |
| Nebula Ball | Stardust Barrage | **Dust Trail** | Leaves a chilling trail that slows anyone crossing it |
| Nebula Ball | Gas Giant | **Gas Ignition** | Detonates when it expires |
| Dimension Ball | Dimension Rift | **Return Rift** | Snaps back to where it started 1.4 s later |
| Dimension Ball | Portal Shot | **Dimensional Fork** | Forks into two diverging bolts mid-flight |
| Dimension Ball | Space Fold | **Folded Space** | At full size 8 spikes fly back toward the centre |
| Time Ball | Time Stop | **Shattered Moment** | When time resumes, frozen enemies shatter for damage |
| Time Ball | Rewind | **Safe Rewind** | Recalls the caster to a safe spot |
| Time Ball | Chrono Bolt | **Time Echo** | The hit echoes again half a second later |
| Quantum Ball | Quantum Tunnel | **Quantum Echo** | The hit echoes again half a second later |
| Quantum Ball | Superposition | **Entangled Selves** | Damage its clones deal heals the caster |
| Quantum Ball | Particle Beam | **Entangled Pair** | A second, lighter beam follows 0.4 s later |
| Eclipse Ball | Corona Blast | **Corona Edge** | Enemies caught by the outer edge are staggered and slowed |
| Eclipse Ball | Umbra | **Umbral Fade** | The caster is intangible for 0.4 s as it rises |
| Eclipse Ball | Eclipse Beam | **Umbral Erosion** | Breaks armour: the enemy takes 15% more damage for 3 s |
| Celestial Ball | Star Lance | **Lance Through** | Deals bonus damage through shields |
| Celestial Ball | Constellation | **Constellation Ring** | Circles the caster first, then launches at full speed |
| Celestial Ball | Heavenly Barrier | **Heaven’s Canopy** | Also shields allies nearby |
| Dragon Ball | Dragon Breath | **Scorched Earth** | Scorches the ground along its path (burn for 2 s) |
| Dragon Ball | Dragon Dash | **Dragon Landing** | Ends with a shockwave |
| Dragon Ball | Dragon Scales | **Spiked Scales** | While it is up, attackers take 30% of their damage back |
| Phoenix Ball | Phoenix Feathers | **Burning Plumes** | Leaves a patch of burning ground where it lands |
| Phoenix Ball | Rebirth | **Phoenix Nova** | Coming back to life releases a blast |
| Phoenix Ball | Blaze Dive | **Phoenix Rebound** | Rebounds after the hit and raises a short shield |
| Demon Ball | Hellfire | **Hellfire Swell** | Grows bigger and stronger the longer it flies (up to +60%) |
| Demon Ball | Demonic Pact | **Blood Pact** | While powered up, damage dealt heals the caster |
| Demon Ball | Soul Rend | **Soul Reaping** | Deals bonus damage to badly hurt enemies |
| Angel Ball | Holy Light | **Mercy Ray** | Heals the caster for 25% of the damage |
| Angel Ball | Blessing | **Shared Blessing** | Also heals allies nearby |
| Angel Ball | Guardian Shield | **Guardian’s Grace** | Heals 2% HP per second while it is up |
| Seraphim Ball | Seraph Flame | **Seraph Embers** | Leaves a patch of burning ground where it lands |
| Seraphim Ball | Sacred Fire Ring | **Sacred Mercy** | Heals the caster for every enemy it hits |
| Seraphim Ball | Holy Barrier | **Seraph Burst** | When it ends it bursts outward, blasting enemies away |
| Chaos Ball | Chaos Bolt | **Chaotic Path** | Weaves left and right in flight, hard to read |
| Chaos Ball | Entropy | **Entropic Daze** | Confuses the enemy: its steering is reversed briefly |
| Chaos Ball | Chaos Rift | **Chaos Daze** | Confuses the enemy: its steering is reversed briefly |
| Divine Ball | Divine Ray | **Divine Verdict** | Deals bonus damage to badly hurt enemies |
| Divine Ball | Sanctuary | **Sanctuary Ground** | Leaves a garden that heals allies and slows enemies |
| Divine Ball | Divine Wrath | **Wrath Twice** | Strikes the same spot a second time |
| Immortal Ball | Eternal Body | **Eternal Aegis** | Comes back shielded |
| Immortal Ball | Undying Strike | **Undying Charge** | Takes 50% less damage during the dash |
| Immortal Ball | Life Bloom | **Defiant Bloom** | Heals much more when the caster is badly hurt |
| Ancient God Ball | Primordial Ray | **Primordial Breadth** | A much wider beam (hard to dodge, slightly weaker) |
| Ancient God Ball | Ancient Seal | **Sealed Fate** | Every stopped enemy is marked for a delayed blast |
| Ancient God Ball | Titan Quake | **Titan Aftershock** | The hit echoes again half a second later |
| One Above All Ball | ABSOLUTE COPY | **Absolute Mimicry** | The copied ability is 20% stronger |
| One Above All Ball | INFINITY REPLICATION | **Infinite Haste** | Its clones are faster and hit harder |
| One Above All Ball | REALITY BREAK | **Reality Fracture** | Breaks armour: the enemy takes 15% more damage for 3 s |
| One Above All Ball | ADAPTIVE EVOLUTION | **Adaptive Plating** | Adapting also raises a shield |
| Infinity Ball | Infinite Loop | **Loop Guard** | Its orbs destroy up to 3 enemy projectiles |
| Infinity Ball | Endless Barrage | **Endless Reload** | Each hit cuts its own cooldown by 1 s |
| Infinity Ball | Infinity Guard | **Endless Layers** | Blocks more and more the longer it lasts |
| Omniverse Ball | Multiverse Rift | **Multiverse Hop** | Blinks again to strike a second time |
| Omniverse Ball | Omni Beam | **Omni Scatter** | Sparks fly off the target and seek other enemies |
| Omniverse Ball | Parallel Selves | **Parallel Fire** | Each clone fires a bolt as it appears |
| Creator Ball | Genesis | **Genesis Renewal** | Cuts the other abilities’ cooldowns by 1.5 s |
| Creator Ball | Creation Orbs | **Creation Launch** | When it ends, every orb launches at the nearest enemy |
| Creator Ball | Let There Be Light | **Lingering Dawn** | Leaves a burning line in the air for a moment after firing |
| Destroyer Ball | Annihilate | **Annihilation Line** | Passes through up to 2 enemies |
| Destroyer Ball | Ruin | **Ruination** | Deals bonus damage to badly hurt enemies |
| Destroyer Ball | Doom Dash | **Doom Furrow** | Ends with a line of ground cracks erupting ahead |
| Reality Ball | Reality Warp | **Warp Guard** | Arrives behind a shield |
| Reality Ball | Rewrite | **Rewritten Fate** | Reflects projectiles for a moment |
| Reality Ball | Glitch Barrage | **Glitched Controls** | Confuses the enemy: its steering is reversed briefly |
| Soul Ball | Soul Steal | **Soul Siphon** | Steals ultimate charge from the enemy |
| Soul Ball | Spirit Orbs | **Spirit Mend** | Each orb hit heals the caster |
| Soul Ball | Soul Shield | **Soul Reservoir** | Part of the damage it blocks heals the caster when it ends |
| Dimension King Ball | Royal Portal | **Royal Arrival** | Arrives with a shockwave |
| Dimension King Ball | King's Decree | **Royal Decree** | A wider strike with a longer warning |
| Dimension King Ball | Dimension Army | **Royal Guard** | Enemies are forced to target its clones |
| Absolute Ball | Absolute Force | **Absolute Halt** | Staggers the enemy, stopping it in its tracks |
| Absolute Ball | Absolute Defense | **Immovable Object** | Enemies that ram it are stunned |
| Absolute Ball | Absolute Strike | **Absolute Echo** | An afterimage repeats the strike a moment later |
| Unknown Ball | ??? | **Stolen Knowledge** | The enemy loses that ability for 3 s |
| Unknown Ball | Null Zone | **Null Silence** | Briefly silences the enemy’s abilities |
| Unknown Ball | ERR0R | **Unreadable Path** | Weaves left and right in flight, hard to read |
| Blood Moon Ball | Lunar Fang | **Lunar Execution** | Deals bonus damage to badly hurt enemies |
| Blood Moon Ball | Crimson Rain | **Blood Rain** | Makes the enemy bleed for a few seconds |
| Blood Moon Ball | Moonlit Veil | **Moon Double** | Leaves a decoy that draws attacks |
| Aurora Ball | Northern Lights | **Polar Glow** | Chills: every 2 hits freeze the enemy |
| Aurora Ball | Polar Wind | **Polar Gust** | Starts slow, then rockets to 150% speed |
| Aurora Ball | Aurora Veil | **Aurora Mantle** | Wraps the caster in a light shield too |
| Frost Crown Ball | Glacier Spike | **Glacial Shatter** | Shatters frozen or stunned enemies for bonus damage |
| Frost Crown Ball | Frozen Throne | **Winter’s Court** | Enemies near the caster are slowed while it is up |
| Frost Crown Ball | Snowstorm | **Hailstorm** | Fires a shard at an enemy inside every second |
| Solar Flare Ball | Flare Burst | **Flare Guard** | The blast also shields the caster |
| Solar Flare Ball | Sunspot | **Sunspot Mines** | Becomes 3 hidden mines that explode on contact |
| Solar Flare Ball | Corona Dash | **Corona Spikes** | Fires spikes sideways during the dash |
| Cyber Glitch Ball | Pixel Shot | **Pixel Split** | Forks into two diverging bolts mid-flight |
| Cyber Glitch Ball | Firewall | **Packet Filter** | Destroys up to 3 enemy projectiles before they land |
| Cyber Glitch Ball | Overclock | **Overclocked Core** | Also charges the ultimate |
| Sakura Spirit Ball | Petal Storm | **Drifting Petals** | Flies straight, then locks on to the nearest enemy |
| Sakura Spirit Ball | Bloom | **Cherry Cleanse** | Cleanses allies nearby too |
| Sakura Spirit Ball | Spirit Dash | **Spirit Petals** | Two phantom dashers rush in from the sides |
| Phantom Ball | PHANTOM VEIL | **Exploding Illusion** | The illusion it leaves explodes |
| Phantom Ball | ILLUSION DECOYS | **Phantom Guard** | While clones live, they take part of the damage aimed at the caster |
| Phantom Ball | SPECTRAL LANCES | **Phantom Pierce** | Passes through up to 2 enemies |
| Phantom Ball | GHOST STRIKE | **Ghost Volley** | Arrives firing a volley of seeking bolts |
| Infinity Core Ball | CORE SHIELD | **Core Capacitor** | Damage it blocks charges the ultimate |
| Infinity Core Ball | ENDLESS REGEN | **Endless Link** | For 3 s, 20% of the damage dealt heals the caster |
| Infinity Core Ball | INFINITE ORBIT | **Tight Orbit** | A tighter ring with one more orb |
| Infinity Core Ball | CORE PULSE | **Core Resonance** | Every hit charges the ultimate faster |
| Chaos Emperor Ball | ELEMENTAL CHAOS | **Elemental Spread** | Burning or poison on the target spreads to enemies next to it |
| Chaos Emperor Ball | CHAOS STORM | **Storm Residue** | Leaves a crackling field that jolts enemies inside |
| Chaos Emperor Ball | EMPEROR'S RIFT | **Emperor’s Mark** | Breaks armour: the enemy takes 15% more damage for 3 s |
| Chaos Emperor Ball | ENTROPY FIELD | **Entropy Sink** | Swallows enemy projectiles that fly near it |
| Celestial Dragon Ball | CELESTIAL FLAME | **Starfire Spread** | Burning or poison on the target spreads to enemies next to it |
| Celestial Dragon Ball | STARFIRE BREATH | **Swelling Starfire** | Grows bigger and stronger the longer it flies (up to +60%) |
| Celestial Dragon Ball | DRAGON ASCENT | **Twin Ascent** | Dashes a second time |
| Celestial Dragon Ball | STAR SCALES | **Star Lance Retort** | When it ends it fires a lance at the nearest enemy |
| Miracle Ball | MIRACLE HEAL | **Miracle Resolve** | Removes stuns and slows and makes the caster unstoppable for 1.5 s |
| Miracle Ball | BLESSED SHIELD | **Blessed Purity** | Removes stuns and slows and makes the caster unstoppable for 1.5 s |
| Miracle Ball | SECOND CHANCE | **Clean Slate** | Comes back unstoppable with its abilities ready |
| Miracle Ball | RADIANT PULSE | **Radiant Glare** | Blinds the enemy: it wanders for a moment |
| Glitch God Ball | PIXEL STORM | **Pixel Mute** | Briefly silences the enemy’s abilities |
| Glitch God Ball | SYSTEM OVERRIDE | **Forced Sync** | Stopped enemies are dragged closer |
| Glitch God Ball | CORRUPTION | **Corrupted Cooldowns** | Pushes back the enemy’s cooldowns by 1 s |
| Glitch God Ball | BLUE SCREEN | **Fatal Exception** | Pushes back the enemy’s cooldowns by 1 s |
| Creator God Ball | GENESIS ORBS | **Genesis Arc** | Jumps to 2 more enemies nearby |
| Creator God Ball | CREATION RAY | **Creative Spark** | Every hit charges the ultimate faster |
| Creator God Ball | WORLD SHIELD | **World Pulse** | Pulses damage around the caster while it is up |
| Creator God Ball | SPRING OF LIFE | **Spring Surge** | Blows nearby enemies away |
| Chronos Ball | TIME LOCK | **Borrowed Time** | The caster recovers while time is stopped |
| Chronos Ball | REWIND | **Accelerated Time** | A burst of speed after healing |
| Chronos Ball | TEMPORAL BOLTS | **Temporal Echo** | The hit echoes again half a second later |
| Chronos Ball | AGE OF RUIN | **Erosion of Ages** | Breaks armour: the enemy takes 15% more damage for 3 s |
| Devourer Ball | DEVOUR | **Hungry Maw** | Drags nearby enemies toward its path as it flies |
| Devourer Ball | CONSUME | **Consume Life** | Heals the caster for 40% of the damage |
| Devourer Ball | HUNGER DASH | **Hunger** | Steals ultimate charge from the enemy |
| Devourer Ball | GORGE | **Gorge Burst** | An enemy it finishes off explodes |
| Admin Supreme Ball | SUPREME DECREE | **Decree Crater** | Leaves a crater that slows anyone inside |
| Admin Supreme Ball | SUPREME SHIELD | **Supreme Repulsion** | Pushes nearby enemies away while it is up |
| Admin Supreme Ball | SUPREME BARRAGE | **Supreme Erosion** | Breaks armour: the enemy takes 15% more damage for 3 s |
| Admin Supreme Ball | SUPREME DASH | **Supreme Breaker** | Breaks the enemy’s shield |
| Prism Ball | Prism Ray | **Prismatic Break** | Breaks the enemy’s shield |
| Prism Ball | Spectrum Shards | **Spectrum Split** | On impact it shatters into 2 shards that keep flying |
| Prism Ball | Refract | **Mirror Wave** | When the reflection ends, a mirror wave bursts out |
| Mirror Ball | Mirror Shield | **Stunning Return** | Shots it reflects stun their owner |
| Mirror Ball | Copycat | **Double Reflection** | Casts the copied ability twice |
| Mirror Ball | Shard Spray | **Mirror Spin** | Sends the enemy spinning off course |
| Toxic Reactor Ball | Reactor Leak | **Reactor Overflow** | Adds an extra poison stack |
| Toxic Reactor Ball | Meltdown Pulse | **Isotope Wave** | Adds an extra poison stack |
| Toxic Reactor Ball | Isotope Bolt | **Isotope Trail** | Leaves a toxic trail that poisons anyone crossing it |
| Sonic Ball | Sonic Boom | **Deafening Boom** | Briefly silences the enemy’s abilities |
| Sonic Ball | Mach Dash | **Sonic Wake** | Its wake shoves enemies aside |
| Sonic Ball | Speed Burst | **Sonic Release** | When the power-up ends, it releases a shockwave |
| Magnetar Ball | Magnetic Storm | **Magnetic Lock** | Pushes back the enemy’s cooldowns by 1 s |
| Magnetar Ball | Flux Beam | **Flux Overload** | Pushes back the enemy’s cooldowns by 1 s |
| Magnetar Ball | Polar Bolts | **Polar Repulse** | Blasts the enemy far away |
| Rift Ball | Rift Step | **Rift Stagger** | Staggers the enemy, stopping it in its tracks |
| Rift Ball | Rift Bolts | **Rift Tether** | Tethers the enemy: if it runs too far it is yanked back and hurt |
| Rift Ball | Space Tear | **Torn Space** | Tethers the enemy: if it runs too far it is yanked back and hurt |

## Ultimate signatures

Ultimates that used to share a type now each have their own extra phase (plus a name card entrance in the ball's colours).

| Ball | Ultimate | Its own phase |
|---|---|---|
| Fire Ball | Meteor Inferno | **Burning Craters** — Leaves the ground burning under every enemy |
| Ice Ball | Absolute Zero | **Shatterpoint** — Frozen enemies shatter when time comes back |
| Thunder Ball | Thunder God Storm | **Storm Chain** — Lightning chains through every enemy in turn |
| Water Ball | Tsunami | **Crashing Tides** — Tides crash in from both side walls |
| Earth Ball | Tectonic Crush | **Tectonic Aftershocks** — Aftershocks keep erupting under every enemy |
| Wind Ball | Hurricane Fury | **Eye of the Hurricane** — The arena’s centre becomes a whirlpool |
| Light Ball | Solar Judgment | **Rays of Dawn** — Eight sun rays burst out in every direction |
| Dark Ball | Eternal Night | **Silent Night** — Silences every enemy for a moment |
| Poison Ball | Pandemic | **Plague Rift** — Tears open a rift that drags enemies in and hurts them |
| Plasma Ball | Plasma Overload | **Plasma Crown** — Leaves a crown of three charged orbs circling the caster |
| Spider Ball | Web Prison | **Silk Cage** — Pillars cage the enemy, then one strikes the centre |
| Laser Ball | Death Ray | **Death Sweep** — Ends with a full sweep across the arena |
| Judgment Ball | Final Judgment | **Sentence for All** — Marks every enemy for a delayed blast |
| Vampire Ball | Blood Moon Feast | **Endless Feast** — For 4 s, a quarter of the damage dealt heals the caster |
| Zombie Ball | Undead Horde | **Feeding Horde** — For 4 s, a quarter of the damage dealt heals the caster |
| Nuclear Ball | Nuclear Detonation | **Fallout** — Leaves the ground burning under every enemy |
| Crystal Ball | Diamond Storm | **Diamond Cage** — Pillars cage the enemy, then one strikes the centre |
| Gravity Ball | Singularity | **Final Collapse** — Everything collapses into a final explosion |
| Magnet Ball | Electromagnetic Pulse | **Magnetic Vacuum** — Drags every enemy in first |
| Shadow Ball | Shadow Realm | **Shadow Doubles** — Two decoys appear to confuse the enemy |
| Galaxy Ball | Galactic Collapse | **Galactic Crown** — Leaves a crown of three charged orbs circling the caster |
| Black Hole Ball | Singularity Consume | **Event Pull** — Drags every enemy in first |
| Universe Ball | Universal Reset | **Starfall Reset** — Stars fall all over the arena |
| Star Ball | Supernova | **Stellar Rays** — Eight sun rays burst out in every direction |
| Nebula Ball | Stellar Nursery | **Nursery Starfall** — Stars fall all over the arena |
| Dimension Ball | Dimensional Collapse | **Open Rift** — Tears open a rift that drags enemies in and hurts them |
| Time Ball | Eternity Freeze | **Turned-Back Clock** — Restores 12% HP and cleanses the caster |
| Quantum Ball | Quantum Entanglement | **Entangled Echo** — Echoes two seconds later as a second wave |
| Eclipse Ball | Total Eclipse | **Blackout** — Silences every enemy for a moment |
| Celestial Ball | Celestial Rain | **Celestial Cage** — Pillars cage the enemy, then one strikes the centre |
| Dragon Ball | Dragon Emperor Inferno | **Emperor’s Tremor** — Aftershocks keep erupting under every enemy |
| Phoenix Ball | Eternal Flame | **Phoenix Plumage** — Twelve feathers fly out in a ring |
| Demon Ball | Abyssal Apocalypse | **Hellfire Floor** — Leaves the ground burning under every enemy |
| Angel Ball | Heavenly Choir | **Choir’s Rain** — Healing light rains on the caster and its allies for 4 s |
| Seraphim Ball | Seraphic Purge | **Purging Flames** — Leaves the ground burning under every enemy |
| Chaos Ball | Primordial Chaos | **Primordial Tremors** — Aftershocks keep erupting under every enemy |
| Divine Ball | Divine Intervention | **Divine Aegis** — Wraps the caster in a strong shield |
| Immortal Ball | Immortal Ascension | **Immortal Shell** — Wraps the caster in a strong shield |
| Ancient God Ball | Wrath of the Ancients | **Ancient Bulwark** — Wraps the caster in a strong shield |
| Infinity Ball | Infinite Void | **Infinite Echo** — Echoes two seconds later as a second wave |
| Omniverse Ball | Omniversal Collapse | **Echoing Collapse** — Echoes two seconds later as a second wave |
| Creator Ball | Genesis Wave | **Rain of Genesis** — Healing light rains on the caster and its allies for 4 s |
| Destroyer Ball | Omega Destruction | **Marked for Destruction** — Marks every enemy for a delayed blast |
| Reality Ball | Reality Shatter | **Muted Reality** — Silences every enemy for a moment |
| Soul Ball | Soul Harvest | **Harvested Life** — Restores 12% HP and cleanses the caster |
| Dimension King Ball | Throne of Dimensions | **Throne Strike** — A last, giant pillar falls on the most dangerous enemy |
| Absolute Ball | Absolute End | **Absolute Pillar** — A last, giant pillar falls on the most dangerous enemy |
| Unknown Ball | █████ | **█████ Silence** — Silences every enemy for a moment |
| Blood Moon Ball | Blood Moon Eclipse | **Blood Communion** — For 4 s, a quarter of the damage dealt heals the caster |
| Aurora Ball | Aurora Cascade | **Polar Night** — Freezes the middle of the arena into a slowing field |
| Frost Crown Ball | Eternal Winter | **Endless Winter** — Freezes the middle of the arena into a slowing field |
| Solar Flare Ball | Solar Storm | **Solar Spokes** — Eight sun rays burst out in every direction |
| Cyber Glitch Ball | System Crash | **Hard Reboot** — Refreshes the caster’s abilities |
| Sakura Spirit Ball | Thousand Petals | **Petal Ring** — Twelve feathers fly out in a ring |
| Glitch God Ball | FATAL ERROR | **Kernel Panic** — Silences every enemy for a moment |
| Creator God Ball | BIG BANG GENESIS | **Newborn Stars** — Stars fall all over the arena |
| Chronos Ball | END OF TIME | **Appointed Hour** — Marks every enemy for a delayed blast |
| Devourer Ball | WORLD DEVOURER | **Digestion** — Restores 12% HP and cleanses the caster |
| Admin Supreme Ball | SUPREME AUTHORITY | **Supreme Authority Reset** — Refreshes the caster’s abilities |
| Prism Ball | Prismatic Judgment | **Prismatic Cage** — Pillars cage the enemy, then one strikes the centre |
| Mirror Ball | Hall of Mirrors | **Mirror Doubles** — Two decoys appear to confuse the enemy |
| Toxic Reactor Ball | Critical Mass | **Critical Rift** — Tears open a rift that drags enemies in and hurts them |
| Sonic Ball | Supersonic | **Afterburner** — The caster is powered up for 4 s afterwards |
| Magnetar Ball | Magnetar Flare | **Flare Chain** — Lightning chains through every enemy in turn |
| Rift Ball | Dimensional Rift | **Rift Rain** — Bolts rain in from the arena walls |

## Evolution paths

| Ball | Ability | Path |
|---|---|---|
| Fire Ball | Fireball | **Awakened**: Grows bigger and stronger the longer it flies (up to +60%) |
| Ice Ball | Ice Shards | **Awakened**: Breaks armour: the enemy takes 15% more damage for 3 s |
| Thunder Ball | Lightning Strike | **Awakened**: Jumps to 2 more enemies nearby |
| Water Ball | Water Jet | **Awakened**: Marks the enemy: the mark detonates 2 s later |
| Earth Ball | Rock Throw | **Awakened**: Sparks fly off the target and seek other enemies |
| Wind Ball | Gale Blades | **Awakened**: Steals ultimate charge from the enemy |
| Light Ball | Light Ray | **Awakened**: The hit echoes again half a second later |
| Dark Ball | Shadow Orb | **Awakened**: Ricochets off the arena walls 2 times |
| Poison Ball | Venom Spit | **Awakened**: Leaves a patch of burning ground where it lands |
| Plasma Ball | Plasma Bolt | **Awakened**: Steals ultimate charge from the enemy |
| Spider Ball | Web Shot | **Awakened**: Flies straight, then locks on to the nearest enemy |
| Laser Ball | Laser Beam | **Awakened**: Splits into two extra side rays → **Ascended**: The hit echoes again half a second later |
| Judgment Ball | Verdict Beam | **Awakened**: Breaks armour: the enemy takes 15% more damage for 3 s → **Ascended**: Deals bonus damage to badly hurt enemies |
| Vampire Ball | Blood Drain | **Awakened**: Sparks fly off the target and seek other enemies → **Ascended**: Flies straight, then locks on to the nearest enemy |
| Zombie Ball | Rot Bite | **Awakened**: Fires spikes sideways during the dash |
| Nuclear Ball | Radiation Leak | **Awakened**: Gently drags enemies toward its centre → **Ascended**: Spreads wider every second |
| Crystal Ball | Crystal Shards | **Awakened**: Drags nearby enemies toward its path as it flies |
| Gravity Ball | Gravity Well | **Awakened**: The first enemy to step in is rooted in place → **Ascended**: Fires a shard at an enemy inside every second |
| Magnet Ball | Magnetic Pull | **Awakened**: Creeps toward the nearest enemy |
| Shadow Ball | Shadow Step | **Awakened**: Marks the enemy: the mark detonates 2 s later → **Ascended**: Makes the enemy bleed for a few seconds |
| Galaxy Ball | Star Burst | **Awakened**: Jumps to 2 more enemies nearby → **Ascended**: Marks the enemy: the mark detonates 2 s later |
| Black Hole Ball | Event Horizon | **Awakened**: Creeps toward the nearest enemy → **Ascended**: Gently drags enemies toward its centre → **Ultimate Variant**: Detonates when it expires |
| Universe Ball | Big Bang | **Awakened**: Sprays 8 shards in every direction → **Ascended**: Sucks enemies in before they are thrown out → **Ultimate Variant**: The blast also shields the caster |
| Star Ball | Star Shot | **Awakened**: The hit echoes again half a second later → **Ascended**: Deals bonus damage to badly hurt enemies |
| Nebula Ball | Nebula Cloud | **Awakened**: Spreads wider every second → **Ascended**: Fires a shard at an enemy inside every second |
| Dimension Ball | Dimension Rift | **Awakened**: Dashes a second time → **Ascended**: Ends with a line of ground cracks erupting ahead → **Ultimate Variant**: Jumps to 2 more enemies nearby |
| Time Ball | Time Stop | **Awakened**: Heals the caster for 30% of the damage → **Ascended**: Breaks armour: the enemy takes 15% more damage for 3 s → **Ultimate Variant**: The hit echoes again half a second later |
| Quantum Ball | Quantum Tunnel | **Awakened**: Takes 50% less damage during the dash → **Ascended**: Jumps to 2 more enemies nearby |
| Eclipse Ball | Corona Blast | **Awakened**: Leaves a slowing ring on the ground → **Ascended**: At full size 8 spikes fly back toward the centre |
| Celestial Ball | Star Lance | **Awakened**: Scorches the ground along its path (burn for 2 s) → **Ascended**: Reflects off the wall it hits and fires back across the arena → **Ultimate Variant**: A second, lighter beam follows 0.4 s later |
| Dragon Ball | Dragon Breath | **Awakened**: Reflects off the wall it hits and fires back across the arena → **Ascended**: A second, lighter beam follows 0.4 s later → **Ultimate Variant**: A much wider beam (hard to dodge, slightly weaker) |
| Phoenix Ball | Phoenix Feathers | **Awakened**: Makes the enemy bleed for a few seconds → **Ascended**: Steals ultimate charge from the enemy → **Ultimate Variant**: Deals bonus damage to badly hurt enemies |
| Demon Ball | Hellfire | **Awakened**: Makes the enemy bleed for a few seconds → **Ascended**: Steals ultimate charge from the enemy → **Ultimate Variant**: Deals bonus damage to badly hurt enemies |
| Angel Ball | Holy Light | **Awakened**: Deals bonus damage to badly hurt enemies → **Ascended**: Breaks armour: the enemy takes 15% more damage for 3 s → **Ultimate Variant**: Splits into two extra side rays |
| Seraphim Ball | Seraph Flame | **Awakened**: Grows bigger and stronger the longer it flies (up to +60%) → **Ascended**: Forks into two diverging bolts mid-flight → **Ultimate Variant**: Sticks to the target and explodes a second later |
| Chaos Ball | Chaos Bolt | **Awakened**: Forks into two diverging bolts mid-flight → **Ascended**: Sticks to the target and explodes a second later → **Ultimate Variant**: Leaves a patch of burning ground where it lands |
| Divine Ball | Divine Ray | **Awakened**: Reflects off the wall it hits and fires back across the arena → **Ascended**: Scorches the ground along its path (burn for 2 s) → **Ultimate Variant**: A much wider beam (hard to dodge, slightly weaker) |
| Immortal Ball | Eternal Body | **Awakened**: Sparks fly off the target and seek other enemies → **Ascended**: Every hit charges the ultimate faster → **Ultimate Variant**: Each hit cuts its own cooldown by 1 s |
| Ancient God Ball | Primordial Ray | **Awakened**: A second, lighter beam follows 0.4 s later → **Ascended**: Leaves a burning line in the air for a moment after firing → **Ultimate Variant**: Scorches the ground along its path (burn for 2 s) |
| Infinity Ball | Infinite Loop | **Awakened**: Jumps to 2 more enemies nearby → **Ascended**: Its orbit keeps widening → **Ultimate Variant**: When it ends, every orb launches at the nearest enemy |
| Omniverse Ball | Multiverse Rift | **Awakened**: Jumps to 2 more enemies nearby → **Ascended**: Takes 50% less damage during the dash → **Ultimate Variant**: Dashes a second time |
| Creator Ball | Genesis | **Awakened**: Also heals allies nearby → **Ascended**: Wraps the caster in a light shield too → **Ultimate Variant**: For 3 s, 20% of the damage dealt heals the caster |
| Destroyer Ball | Annihilate | **Awakened**: Grows bigger and stronger the longer it flies (up to +60%) → **Ascended**: Leaves a patch of burning ground where it lands → **Ultimate Variant**: Sticks to the target and explodes a second later |
| Reality Ball | Reality Warp | **Awakened**: Marks the enemy: the mark detonates 2 s later → **Ascended**: Makes the enemy bleed for a few seconds → **Ultimate Variant**: An afterimage repeats the strike a moment later |
| Soul Ball | Soul Steal | **Awakened**: Flies straight, then locks on to the nearest enemy → **Ascended**: Sparks fly off the target and seek other enemies → **Ultimate Variant**: On impact it shatters into 3 shards that keep flying |
| Dimension King Ball | Royal Portal | **Awakened**: Takes 50% less damage during the dash → **Ascended**: Jumps to 2 more enemies nearby → **Ultimate Variant**: Makes the enemy bleed for a few seconds |
| Absolute Ball | Absolute Force | **Awakened**: At full size the ring collapses back in, dragging enemies to its centre → **Ascended**: The ring pulls enemies in instead of pushing them away → **Ultimate Variant**: 4 aftershocks erupt around it |
| Unknown Ball | ??? | **Awakened**: Jumps to 2 more enemies nearby → **Ascended**: Staggers the enemy, stopping it in its tracks → **Ultimate Variant**: Breaks the enemy’s shield |
| Blood Moon Ball | Lunar Fang | **Awakened**: Dashes a second time → **Ascended**: Takes 50% less damage during the dash → **Ultimate Variant**: Fires spikes sideways during the dash |
| Aurora Ball | Northern Lights | **Awakened**: Breaks armour: the enemy takes 15% more damage for 3 s → **Ascended**: Deals bonus damage to badly hurt enemies → **Ultimate Variant**: The hit echoes again half a second later |
| Frost Crown Ball | Glacier Spike | **Awakened**: Deals bonus damage to badly hurt enemies → **Ascended**: The hit echoes again half a second later → **Ultimate Variant**: Breaks armour: the enemy takes 15% more damage for 3 s |
| Solar Flare Ball | Flare Burst | **Awakened**: Sprays 8 shards in every direction → **Ascended**: Sucks enemies in before they are thrown out → **Ultimate Variant**: A second ring of blasts erupts farther out |
| Cyber Glitch Ball | Pixel Shot | **Awakened**: Grows bigger and stronger the longer it flies (up to +60%) → **Ascended**: Leaves a patch of burning ground where it lands → **Ultimate Variant**: Passes through up to 2 enemies |
| Sakura Spirit Ball | Petal Storm | **Awakened**: Passes through up to 2 enemies → **Ascended**: Ricochets off the arena walls 2 times → **Ultimate Variant**: On impact it shatters into 3 shards that keep flying |
| Prism Ball | Prism Ray | **Awakened**: After firing, it sweeps across in an arc → **Ascended**: Leaves a burning line in the air for a moment after firing |
| Mirror Ball | Mirror Shield | **Awakened**: The hit echoes again half a second later → **Ascended**: Deals bonus damage to badly hurt enemies |
| Toxic Reactor Ball | Reactor Leak | **Awakened**: Fires a shard at an enemy inside every second → **Ascended**: The first enemy to step in is rooted in place → **Ultimate Variant**: Becomes 3 hidden mines that explode on contact |
| Sonic Ball | Sonic Boom | **Awakened**: Heals the caster for every enemy it hits → **Ascended**: At full size 8 spikes fly back toward the centre |
| Magnetar Ball | Magnetic Storm | **Awakened**: Detonates when it expires → **Ascended**: Ends by flinging everyone caught far away → **Ultimate Variant**: Spreads wider every second |
| Rift Ball | Rift Step | **Awakened**: Makes the enemy bleed for a few seconds → **Ascended**: Marks the enemy: the mark detonates 2 s later → **Ultimate Variant**: Takes 50% less damage during the dash |
| Anti Ball | NULL ZONE | **Awakened**: Steals ultimate charge from the enemy → **Ascended**: Deals bonus damage to badly hurt enemies → **Ultimate Variant**: The hit echoes again half a second later |
| Mecha Commander Ball | ROBOT SUMMON | **Awakened**: Sparks fly off the target and seek other enemies → **Ascended**: Makes the enemy bleed for a few seconds → **Ultimate Variant**: Each hit cuts its own cooldown by 1 s |
| Cyber Overlord Ball | LASER GRID | **Awakened**: Each hit cuts its own cooldown by 1 s → **Ascended**: Breaks the enemy’s shield → **Ultimate Variant**: Sparks fly off the target and seek other enemies |
| God of Chaos Ball | CHAOS RIFT | **Awakened**: Heals the caster for 30% of the damage → **Ascended**: Breaks armour: the enemy takes 15% more damage for 3 s → **Ultimate Variant**: The hit echoes again half a second later |
| God of War Ball | BLADE ORBIT | **Awakened**: Jumps to 2 more enemies nearby → **Ascended**: Marks the enemy: the mark detonates 2 s later → **Ultimate Variant**: Breaks the enemy’s shield |
| AI Tech Ball | NEURAL SCAN | **Awakened**: The hit echoes again half a second later → **Ascended**: Breaks armour: the enemy takes 15% more damage for 3 s → **Ultimate Variant**: Steals ultimate charge from the enemy |
| Solar Eclipse Ball | SOLAR FLARE | **Awakened**: Makes the enemy bleed for a few seconds → **Ascended**: Steals ultimate charge from the enemy → **Ultimate Variant**: Jumps to 2 more enemies nearby |
| God of Guns Ball | ARSENAL SUMMON | **Awakened**: Every hit charges the ultimate faster → **Ascended**: Sparks fly off the target and seek other enemies → **Ultimate Variant**: Breaks the enemy’s shield |
| God Portal Ball | PORTAL DASH | **Awakened**: Each hit cuts its own cooldown by 1 s → **Ascended**: Every hit charges the ultimate faster → **Ultimate Variant**: Staggers the enemy, stopping it in its tracks |
| God of Absolute Ball | ABSOLUTE JUDGMENT | **Awakened**: Every hit charges the ultimate faster → **Ascended**: Sparks fly off the target and seek other enemies → **Ultimate Variant**: Makes the enemy bleed for a few seconds |

## Combinations (44)

| Name | Kind | How |
|---|---|---|
| **Wildfire** | Follow-up | Inferno Ring hitting a burning enemy spreads the fire to every enemy near it |
| **Shatterstorm** | Follow-up | Ice Shards hitting a frozen enemy shatter it into a ring of flying ice |
| **Conductor** | Follow-up | Lightning Strike on an enemy still charged by Chain Spark arcs into two more enemies |
| **Drowning Pull** | Follow-up | Tidal Wave catching an already slowed enemy drags it back to the Water Ball |
| **Rockslide** | Follow-up | Earthquake shaking a stunned enemy brings three rocks down on it |
| **Pandemic Burst** | Follow-up | Plague Burst on an enemy carrying three poison stacks makes them all burst at once |
| **Blood Frenzy** | Follow-up | Crimson Dash into a bleeding enemy throws the Vampire into a frenzy that heals 6% HP |
| **Overload Grid** | Follow-up | Laser Beam fired within 3 s of a Targeting Lattice overloads it: +40% damage and a short silence |
| **Final Sentence** | Follow-up | Sentence landing while the Scales of Balance are weighing stuns and marks the enemy |
| **Critical Mass** | Follow-up | Meltdown on an irradiated enemy sets off all of its remaining decay at once (×4) |
| **Firestorm Gust** | Follow-up | Dragon Breath on an enemy still reeling from Wing Gust fans the flames into a firestorm |
| **Ashen Dive** | Follow-up | Blaze Dive through the phoenix’s own Ash Cloud blinds and scorches the enemy |
| **Frozen Moment** | Follow-up | Chrono Bolt on an enemy under the Stopwatch is recorded twice |
| **Damnation** | Follow-up | Hellfire on an enemy held by Hellgate Chains burns 50% hotter |
| **Petal Maelstrom** | Follow-up | Petal Storm into an enemy trapped in a Blossom Vortex whips up a maelstrom of petals |
| **Deep Freeze** | Follow-up | Glacier Spike on an enemy sliding on Permafrost freezes it solid |
| **Purging Fire** | Follow-up | Seraph Flame on a branded enemy erupts in holy fire and keeps the brand burning longer |
| **Annihilation Run** | Follow-up | Doom Dash into an enemy on the Doom Clock makes the clock strike at once (×1.5) |
| **Absolute Zero Cut** | Follow-up | Absolute Edge through an enemy frozen in a Zero Point cuts 50% deeper |
| **Matrix** | Follow-up | Ricochet Revolver rounds that land during Bullet Time hit 50% harder |
| **Horizon Snap** | Follow-up | Spaghettify on an enemy caught in Tidal Lock snaps it in: stun and extra damage |
| **Polar Chain** | Follow-up | Polar Bolts on a magnetised enemy jump to every enemy stuck to it |
| **Aurora Lock** | Follow-up | Northern Lights on a chilled enemy locks it in ice |
| **Red Tide** | Follow-up | Crimson Tide on a bleeding enemy reopens the wound and drains twice as much |
| **Packet Loss** | Follow-up | Pixel Shot on a lagging enemy drops its abilities offline for a moment |
| **Mirror Beam** | Counter | A beam that hits the Mirror Ball while Mirror Shield is up is fired straight back at its caster |
| **Prismatic Refraction** | Counter | A beam striking a raised prism splits into two rays aimed back at the enemy |
| **Cold Snap** | Counter | Dashing into the Ice Ball while Frost Armor is up freezes the attacker for longer and recharges the armour |
| **Bedrock Ricochet** | Counter | Projectiles that hit the Earth Ball while Stone Skin is up ricochet 30% of their damage back |
| **Packet Drop** | Counter | Lasers aimed at the Glitch Ball while its Firewall is up are dropped like bad packets |
| **Shield Bash** | Counter | Ramming the God of War’s Shield Wall stuns the attacker |
| **Magnetic Riposte** | Counter | A shot that still gets through the Magnetic Deflector shocks the shooter |
| **Steam Vent** | Arena object | Tidal Wave rolling over burning ground puts it out and leaves slowing steam |
| **Fault Rupture** | Arena object | Earthquake shatters enemy traps, fields and walls close to it |
| **Fire Tornado** | Arena object | A Cyclone that passes over burning ground catches fire and becomes a fire tornado |
| **Electrified Pool** | Arena object | Lightning Strike landing in a puddle or pool (any slowing or toxic ground) electrifies it |
| **Toxic Ignition** | Arena object | A burning shot flying through a toxic pool of an ally ignites it in an explosion |
| **Steam Burst** | Team reaction | A Fire-family ball burning an enemy frozen by an Ice-family ally (or the reverse) makes it explode in scalding steam |
| **Electrocute** | Team reaction | A Thunder-family stun on an enemy soaked (slowed) by the Water Ball sends a shock through everyone around it |
| **Toxic Blaze** | Team reaction | Fire touching poison from a Poison-family ally ignites it: an explosion around the enemy |
| **Deep Chill** | Team reaction | Freezing an enemy that the Water Ball soaked keeps it frozen 1.5 s longer |
| **Eclipse Burst** | Team reaction | Light stunning an enemy weakened by Darkness collapses both into an eclipse burst |
| **Tectonic Collapse** | Team reaction | A Gravity-family stun on an enemy already stunned by an Earth-family ally crushes it into the ground |
| **Frozen Plague** | Team reaction | Freezing a poisoned enemy freezes the plague inside it: it spreads to every enemy nearby |

## Admin Skill Management (owner only)

Admin Dashboard → **🧬 Skills** (server-checked: owner role + recent 2FA; every change in the audit log):
- Registry overview by category and the duplicate audit (pairs, scores and which parts match).
- Browse every ability; edit cooldown, power, unlock level, wins needed, name, description; switch new abilities off;
  switch an evolution off; reset to default; **preview the animation**; **test any ultimate**.
- **Create abilities** from the engine's ability types, with an optional **signature mechanic** from the mechanics library,
  and assign them to a ball (only if it has a free slot). The duplicate check runs first; a too-similar ability is refused
  unless the owner saves it anyway (logged).
- Mastery XP per rank and evolution requirements.
- The owner's settings are stored with every battle, so the server replays each battle with exactly the settings it was played with.

## Data protection

- Migration `008_skills.sql` only adds tables (mastery, evolutions, evolution log, admin skills). The server backs up the
  database before applying it. No player rows, balls, levels, purchases or editions are changed.
- God of Absolute keeps its autonomous free will and everything from 2.4–2.5.1; its four new abilities unlock from Lv 55.
