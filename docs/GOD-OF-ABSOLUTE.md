# Update 2.4.0 — GOD OF ABSOLUTE • THE UNRIVALED ONE

**Limited exclusive Supreme God Ball — PHP 499 — limited edition (100 verified owners at first) — starts at Lv 50 — max Lv 100 — permanent.**

Nothing existing was removed, reset or overwritten:
- God of Time, the free God Balls, God of Guns, God Portal and every other ball, arena and save work as before.
- All of 2.4.0 is added on top: `gods3.js`, `server/edition.js` and migration `007_edition.sql`.

## The ball

- A perfectly round cosmic core in black, white, gold and purple, with:
  - rotating golden celestial rings and floating golden fragments
  - divine symbols, sparkles and a white-gold glow
- **Form 2** adds a turning sigil of symbols.
- **Form 3** adds orbiting celestial spheres, a huge halo with eight spires and a cosmic trail.
- It is always a ball, never a character.

### Skills

Every skill works differently in each form:

| Skill | Absolute Divinity | Celestial Sovereign | The Unrivaled One |
|---|---|---|---|
| **Absolute Judgment** | A golden judgment wave with turning rings and a shockwave | A double wave, plus 6 homing celestial bolts | 3 waves at 3 speeds, plus judgment pillars on up to 3 enemies (marked before they fall) |
| **Reality Breaker** | Broken space at the target: golden cracks, drifting movement, slow and steady damage. The edge is drawn, so you can walk out. The arena goes back to normal afterwards. | 2 fields; enemies caught at the start have their movement reversed for 1 s | 3 fields that explode at the end; the edge flashes 0.8 s before |
| **Celestial Dominion** | 3 giant rings that orbit and shoot; 30% barrier | 4 rings that also catch enemy shots (up to 3); 38% barrier | 6 rings: a synchronised volley every 1.9 s; catch up to 4 shots |
| **Infinity Erasure** | A charging sphere with a golden **warning line**, then a slow sphere that explodes on impact. Step off the line to dodge. | The sphere goes through its first target and sheds 5 homing fragments | An erasure beam runs along the warning line, then a bigger blast |
| **Divine Replication** | 2 spherical copies (6 s). They circle the ball in formation and repeat its Judgment and Erasure at reduced power. | 2 stronger copies (7 s) | 3 copies (8 s); each releases a small judgment wave when it fades |

Divine Replication rules:
- From Lv 80 you get +1 copy, and copies shoot celestial bolts. There are never more than 3 copies.
- Casting again renews the copies that exist; it never adds more than the limit.
- Copies exist only inside the battle. They vanish on their own and can't give ownership or rewards.

### Ultimate: ABSOLUTE ZERO – END OF ALL DIMENSIONS

Always in this order:
1. The ball stops and rises. Nothing can hit it while it rises.
2. The arena lights dim.
3. Golden symbols appear.
4. Giant rings emerge.
5. A cosmic sphere forms.
6. A dimensional distortion slows enemies for 1 s.
7. Every ring fires a beam that follows its target.
8. The sphere ends in a massive explosion.
9. The light comes back.

Nothing in the arena is changed for good. The owner can set the length (2.4–5 s, default 3.4 s).

### Final-form ultimate: OMNIVERSAL ABSOLUTE DOMINION

1. A connected celestial dimension surrounds the battlefield: 8 linked nodes, a starfield and constellation lines.
2. The nodes fire two synchronised volleys.
3. The whole dimension converges on every enemy at once.
4. The arena is restored.

### Passive: ABSOLUTE AUTHORITY

- **Authority over other gods:**
  - Its power ignores 55% of a God Ball's defense.
  - It takes 15% less damage from God Balls.
- **Absolute Energy:** every hit builds energy (3 / 4 / 5 per hit by form).
  - Cap: 100 (120 from Lv 90).
  - Energy fades 2 s after the last hit.

| Energy | Effect |
|---|---|
| 40 | Abilities are 10% faster |
| 70 | +6% attack and 8% less damage taken |
| Full | **CELESTIAL ASCENSION** for 4 s: +12% attack and abilities 20% faster. Form 2 also gets a barrier; form 3 also fires a celestial burst. The energy then resets. |

### Levels 50 → 100 (its own level only — never the account or other balls)

| Level | Unlocks |
|---|---|
| 50 | Absolute Divinity, all 5 skills (no skill-tree slots needed) |
| 60 | Celestial combinations:<br>• **Celestial Judgment:** Judgment while the rings are up makes every ring release a wave<br>• **Reality Collapse:** an Erasure exploding inside a Reality field becomes bigger and pulls enemies in |
| 70 | **Celestial Sovereign** form |
| 80 | Enhanced Divine Replication |
| 90 | Cosmic trail; energy cap 120 |
| 100 | **The Unrivaled One** form and Omniversal Absolute Dominion |

- EXP comes only from verified battles (the server).
- One level above 50 costs `(300 + 12 × levels above 50) × EXP scale`. The EXP scale is an owner setting (0.25–4, default 1).
- Reaching Lv 70 takes about 8,300 EXP; Lv 100 about 29,700 EXP.
- Levels above 50 add very little raw power (each is worth 5% of a normal level). Their value is the features.

### Owner rewards (only with a verified purchase)

- **THE ABSOLUTE OWNER** title and black-gold nameplate:
  - shown over the ball in battles (online too)
  - shown on the public profile
- 👑 **edition emblem** (#001…) on the profile and in Rankings.
- **Lobby showcase** on the main menu (live ball, edition number, level).
- Celestial **aura** and **trail**.
- **Golden Cosmic Elimination:** a golden cosmic "ERASED" effect when an enemy is finished.
- **Absolute Ascension victory** with the **MVP • THE ABSOLUTE OWNER** presentation.
- A special **battle entrance**: the ball descends through rings of light.

These can't be bought with coins or handed out by the owner tools; they come only with the edition.

### Visual quality

Settings → Graphics → **Cinematic effects: Full / Reduced / Minimal**.
- Minimal removes the cinematic layers and keeps the gameplay warnings: the Erasure line, judgment marks and Reality edges.
- It works together with Particle quality.
- Gameplay is the same at every setting.

## 2.5.0 — Autonomous free will

God of Absolute is **never controlled by a player**: not steering, not abilities, not the ultimate, not manual mode.
- In battle its button shows **🧠 OWN WILL** and can't be pressed.
- The engine ignores player commands for it, online too. The server replays the same decisions, so matches stay in sync.

**How it thinks**
- **5 strategies.** It switches every 6–10 s, or at once after a hard hit, at half health, or when its focus falls. It is deliberately a little unpredictable (a weighted choice), and it never just follows its allies.

  | Strategy | What it does |
  |---|---|
  | **DOMINATE** | Hunts the most dangerous enemy |
  | **JUDGE** | Holds the centre |
  | **ORBIT** | Watches and circles |
  | **EXECUTE** | Finishes the weakest enemy |
  | **WARD** | Patient defence against a stronger foe |

- **Danger sense.** It rates every enemy by attack, form, god status, a charged ultimate and health. It says "A WORTHY FOE." and plays safer against strong ones.
- **Divine Step.** It teleports out of a shot or strike about to hit it, or behind a target that runs away.
- **Ultimate timing.** It holds its ultimate while the target is far away, untouchable or hidden. It fires anyway when it is about to fall.
- **Personality.**
  - When there is nobody to fight, it drifts in a slow majestic circle.
  - It reacts with lines such as "INTERESTING…", "I AM ABSOLUTE.", "WITNESS." and "JUDGMENT IS COMPLETE."
  - It has its own transformation burst and a golden-purple cosmic aura.

### 2.5.1 — It really leaves the arena

It does not go to a hidden place anymore. It smashes through the arena wall and flies in the open space **outside** the walls, where every player can see it.

**What everyone sees**
- **The camera pulls back** while it is outside, so the space around the arena (stars and cosmos) comes into view. It eases back in when it returns.
- **Breach:** it dashes into the wall and leaves golden cracks where it broke through.
- **Outside:** it flies around the arena beyond the walls with a golden trail.
- **Beyond Lances:** from outside it fires golden beams straight through the wall at its target. Every beam has a short warning before it hits, so it can be dodged.
- **Return:** it crashes back in through the wall with a judgment shockwave and says "I HAVE RETURNED." (or "JUDGMENT IS COMPLETE." after a hunt).

**Why it leaves** (its own choice):

| Reason | What happens |
|---|---|
| **Hunt** | An enemy hides outside the arena (a portal escape, a dimensional trap…). It breaks out, races round the arena to it, **drags it out into the open** ("DRAGGED BEYOND THE ARENA") and fights it there, outside the walls. Then both come back in. |
| **Recover** | Badly hurt and pressed, it escapes through the wall to the side farthest from its enemies, heals a little, and comes back in somewhere else. |
| **Ambush** | With nobody near it, it leaves the arena, circles outside firing Beyond Lances, then crashes in on its target. |

**How it stays fair and safe**
- **Time limit:** a trip never lasts more than 8 s. A fight outside lasts 6 s by default.
- **Cooldown:** 18 s between trips by default.
- **Always returns:** it, and any enemy it dragged out, always come back inside. If it falls outside, the enemy is returned at once.
- **Can't be targeted from inside:** while it is outside, balls in the arena can't target it or bump into it, and it can't bump into them. Only an enemy it dragged out fights it out there.
- **Nobody else leaves:** no other ball ever goes outside the walls unless it was dragged out.
- **Who it can hunt:** only real enemy balls. Never allies, copies, summons, turrets or anything in God Portal's void.
- **Other matches:** everything happens inside its own match only.
- **Same on every screen:** the whole trip is part of the battle simulation. Online matches stay in sync and the server replays it the same way.

**Owner settings — Admin Dashboard → 👑 God of Absolute → 🧠 Autonomous will** (server-checked, audit-logged):
- intelligence: Calm / Strategic / Supreme
- aggression: 0–100
- on/off: May break out of the arena, Hunts enemies hiding outside the arena, Recovers outside the arena when badly hurt, Ambushes from beyond the walls
- on/off: Divine Step, speech
- Longest fight outside (3–8 s), Cooldown between trips (12–40 s)
- which abilities it may use, and an ability cooldown multiplier

Balance with free will and the trips outside (same method as below):

| | vs top-12 balls | vs God Balls (average) |
|---|---|---|
| Lv 50 | 81% | 52% |
| Lv 70 | 92% | — |
| Lv 100 | 100% | 79% (God of War still wins most fights) |

## The limited edition

- **Price:** PHP 499, one time. Owners appear in the shop as "37 / 100 verified owners • 60 available now • 3 reserved by players paying right now".
- **Real numbers only:** everything shown comes from the database. Nothing is invented.
- **Reserving a slot:** pressing Buy reserves a slot.
  - QR payment: 30 minutes to pay and send the reference number. The countdown is on screen.
  - PayMongo: the checkout holds the slot for 20 minutes.
  - A reference that was sent keeps its slot until the owner approves or rejects it.
  - Unpaid reservations are released automatically.
  - available = supply − verified owners − active reservations.
- **The last slot can never be sold twice:**
  - Reservations are checked and created inside one database transaction.
  - Ownership is a numbered row (#1 … supply). The database refuses duplicates.
  - If a payment arrives after the edition sold out, it is **never granted**. It is marked for refund.
- **Verified purchase only:**
  - QR: the owner sees the money in their Maya / MariBank app and presses Approve (owner + 2FA).
  - PayMongo: a signed webhook, then the server re-checks the payment with PayMongo.
  - Then, in one transaction, the player gets:
    - the next edition number
    - the ball (permanent)
    - Lv 50 for this ball only
    - the owner rewards
- **Permanent records:** edition owners and the edition ledger can't be changed or deleted (database triggers).
- **Restore purchases** re-applies everything. It never lowers a level and never creates a second slot.
- **Sold out:** the shop shows **SOLD OUT – THE ABSOLUTE ERA IS COMPLETE.** More slots only come when the owner officially releases a new edition.

## Owner: Admin Dashboard → 👑 God of Absolute

- **Overview:** verified owners, available, reserved, edition number, purchases on/off.
- **Edition settings:**
  - supply (never below the verified owners)
  - accept new purchases
  - the announcement shown in the shop
- **Release a new edition:** adds slots, raises the edition number and posts an announcement.
- **Gameplay settings:** ultimate length; EXP scale above Lv 50.
- **Lists:**
  - pending (reserved / waiting for your check / open checkouts)
  - verified owners with edition numbers
  - completed transactions
  - payment errors and refunds, plus security events
  - purchase restorations
  - the full edition ledger

QR payments are approved where the others are: 💳 God Shop (PHP).

Every action is checked on the server (owner role + recent 2FA) and audit-logged. Hiding buttons is never the only protection.

## Database safety

Before applying any new database migration, the server writes a backup copy of the existing database to `data/backups/`. Migration 007 only adds tables, columns and triggers; existing rows are never changed.

## Balance

Measured on this server with the game's own simulation.
- **vs the 12 strongest balls:** 36 battles per row, opponents at Lv 50 with every upgrade.
- **vs God Balls:** 8 battles per opponent; the opponent has every form.

| God of Absolute | vs top-12 balls | vs other God Balls (average) |
|---|---|---|
| Lv 50 (Absolute Divinity) | 75% | 42% (God of Guns: 45%) |
| Lv 70 (+ Celestial Sovereign) | 86% | — |
| Lv 100 (+ The Unrivaled One) | 94% | 65% (God Portal: 68%) |

It is extraordinarily strong but beatable: God of War still beats it most of the time.
