# QA report — 2.9.0 REALITY VS ABSOLUTE

Everything below was actually run. It was checked in two ways:
- the game's own simulation, which is the same code the server uses to verify battles;
- a real browser (Chromium) on a PC screen and a phone screen.

Nothing here is a claim without a run behind it. Section 7 lists what was **not** tested.

## 1. Automated tests

| File | Tests | What they check |
|---|---|---|
| `reality_gods.test.js` | 14 | the kits, forms, passives, safety limits, clash, synergy, arena, boss and mastery (detail below) |
| `reality_shop.test.js` | 10 | purchases, ownership, mastery, the Archon and the migration (detail below) |
| `reality_pvp.test.js` | 1 | online co-op against the Archon (detail below) |
| all older test files | 167 | everything from before 2.9.0 |
| **Full suite** | **192** | **192 pass, 0 fail** |

**`reality_gods.test.js` (14):**
- all 15 abilities in all 3 forms;
- both ultimates of each ball, and the 3 transformations;
- the 3 passives and their energy meters;
- Reality Deletion: warning, escape, resistance and immunity;
- Existence Suppression: one ability only, never the ultimate, and resistance;
- Death Sentence: the 30% cap, breaking it with 3 hits, and a cleanse;
- Fate Binding and the notebook input;
- Reality Clash: the timing decides;
- the rivalry announcement;
- God Synergy cooldowns and no loops;
- the arena geometry, spawns, hazards and determinism;
- the Archon's 3 phases and the co-op ticket;
- mastery is looks only.

**`reality_shop.test.js` (10):**
- locked before buying, never from summon orbs or events, and Fate Note is never sold for coins;
- the 50,000-coin purchase: exact charge, recorded, audited, never twice;
- simultaneous purchases: charged once, the balance never goes negative;
- the owner cannot buy, and a forged client cannot grant itself a ball;
- PHP 99 by PayMongo: underpayment, duplicate webhooks, restore and a second login;
- PHP 99 by QR: owner approval, double approval, reused reference;
- God Mastery: practice gives none, verified battles give it, the level-10 title;
- the Archon's seal, arena and rewards once per battle;
- the new inputs are validated;
- migration 011.

**`reality_pvp.test.js` (1):**
- a full online co-op match against THE FRACTURED ARCHON through the real WebSocket server;
- the server's verified result equals a local replay;
- the Archon's rewards follow that result only.

Three older tests were updated, because they count the game's balls, products and migrations:
- the Premium God Shop test now also expects the `fatenote` product (PHP 99);
- the 2.6.0 skill-slot test now accepts the Reality Gods' 5-ability design (6 slots with the ultimate).
- the 2.8.0 migration test now allows later migrations (011) to run after 010.

## 2. The three balls

- Each has:
  - 5 abilities, each with 3 form versions (Base / 2nd / 3rd form) that really behave differently;
  - a passive with an energy meter (a ring around the ball, a HUD chip, and the notebook for Fate Note);
  - a regular ultimate, and a final-form ultimate (used in form 3 — tested);
  - 3 forms (1st ultimate → form 2, 2nd ultimate → form 3 — tested).
- Each ultimate ends with an arena-restore animation.
- Original looks, made for this game: ball patterns, orbiting decorations, form changes, projectiles.
- Original sounds: each ball has its own motif, made with the game's own sound synthesis.
- Determinism: the same battle run twice gives identical results (tested, including the new arena).

## 3. Safety limits (what keeps the new effects fair)

| Effect | Limit (tested) |
|---|---|
| Reality Deletion | 0.8 s marked warning. Walking out escapes it. Never on an immune ball. The ball comes back to the same spot. 8 s resistance. Bosses half as long. A battle effect only: accounts, saves, ownership and items are never touched. |
| Existence Suppression | Dodgeable bolt after a warning line. Exactly one ability, never the ultimate, 3–3.5 s. 10 s resistance. |
| Fate Binding | Dodgeable chains. Held within 110 px. 2–3 s. 5 s resistance. |
| Death Sentence | Visible countdown. Burst capped at **30% max HP (15% bosses)**. Broken by 3 hits on Fate Note, or by a cleanse. 6 s resistance. |
| Absolute Seal (cooldowns slower) | 15% for 4 s (half on bosses). Absolute Immunity cancels it. |
| Reality Clash | 60% timing + 40% battle state. With the same two balls, the better timing won both ways (tested). |
| God Synergy | Allies only, team cooldowns of 12–25 s, a synergy hit never starts another. |
| God Mastery | Looks only: a level-10 god fights exactly like a new one (tested). |

## 4. Balance (measured)

How it was measured:
- Lv 30, every ball fully trained, AI on both sides.
- **"Top tiers"** = 14 opponents from the Mythical, Ancient, Secret, Limited and God Tier rarities, 2 battles each, against the
  Hard AI.
- The older God Balls were measured the same way, for comparison.

| Ball | Wins vs top tiers |
|---|---|
| God of War | 100% |
| God of Guns | 96% |
| God Portal | 75% |
| Anti Ball | 75% |
| **The Absolute Above** | **92%** |
| **The Void Below** | **71%** |
| **Fate Note Ball** | **75%** |

**Rivalry fairness.** This used online 1 VS 1 battles: both balls had identical progress, the same AI, alternating sides,
and half the battles were in the Reality Collision Zone.

| Match-up | Result |
|---|---|
| The Void Below vs The Absolute Above | The Void Below wins **47%** of 32 (The Absolute Above 53%) |
| Fate Note vs The Void Below | Fate Note wins 69% of 32 |
| Fate Note vs The Absolute Above | Fate Note wins 39% of 31 |

Together this is a fair triangle, with no ball that beats both others:
- The Absolute Above beats Fate Note;
- Fate Note beats The Void Below;
- the rivalry pair is close to 50 / 50.

What the balance work changed:
- **Kit power per ball.** The new abilities hit fewer times than the older gods' bullet storms, so each hit is stronger.
  The setting is `RG.POWER` in `reality.js`.
- **Absolute Immunity** also softens The Void Below's abilities by 55% while it is active. It is the real counter in the rivalry; the first measurement had The Void Below winning 96%.
- **The Void Below's NEGATION** also cuts damage taken by 15%.
- **Fate Note** got real hits: ink lightning on Name of Destiny, and stronger chains and scythes.
- Stat changes:
  - The Void Below: HP 140, ATK 94, DEF 78.
  - Fate Note: HP 132, ATK 96, DEF 72.

One thing found while measuring: in a normal single-player battle, the side playing as "the player" wins much more often.
That is why the rivalry was measured with fair online-style battles.

## 5. Browser checks (real Chromium)

| Screen | Size | Result |
|---|---|---|
| Main menu: REALITY VS ABSOLUTE showcase and the ✦ Supreme God Collection button | PC 1280×800 | ✔ 0 errors |
| Supreme God Collection: 11 God Balls; search "fate" → 1 card; filters and sort | PC | ✔ |
| Practice test of Fate Note → 📖 NOTEBOOK → seal, sentence, resistance, history shown; ✎ WRITE sets the target | PC | ✔ |
| The Void Below vs The Absolute Above in the REALITY COLLISION ZONE: arena drawn, rivalry announced, both ultimates → REALITY CLASH timing bar + ⚔ PRESS! button | PC | ✔ 0 errors |
| Signed-in player with 60,000 coins → Shop → ✦ REALITY GODS → Buy The Void Below → confirmation → bought | PC | ✔ 60,000 → 10,000 coins, ball owned, 0 errors |
| Phone, portrait (iPhone 13) | 390 px | ✔ no sideways scrolling; the game asks to rotate (as before) |
| Phone, landscape | 750 px | ✔ the notebook becomes a side panel; WRITE button 110×44 px; tapping works |

## 6. Security

- **Ownership:** the browser never decides ownership, coins, EXP or mastery. A forged client could not grant itself a
  ball (tested).
- **50,000-coin purchase:**
  - one transaction, with a conditional coin update, so the balance is never below 0;
  - `UNIQUE (user_id, ball_id)` and `CHECK (coins_after >= 0)` in the database;
  - audit log;
  - 6 simultaneous requests → 1 purchase (tested).
- **PHP 99 purchase:** the existing verified shop (PayMongo checked by the server itself; QR only after the owner
  approves). No bank details are in the files.
- **New battle inputs:**
  - `t` (the notebook target) and `c` (the clash press) are validated in both single-player and online;
  - malformed inputs reject the battle (tested).
- **Fate Notebook:** shows only data from the current match.
- **The Archon:**
  - its unlock is checked by the server;
  - its rewards are coins, mastery and cosmetics only, once per verified battle;
  - it is never a playable ball or an ordinary opponent.
- **Migration 011:** new tables only, with a backup first (tested).

## 7. Not tested / limits (honest list)

- **Real payments:** no real PayMongo payment was made; tests use a fake PayMongo server. Before selling, do one real
  PHP 99 test purchase on the live site.
- **Online co-op:** tested through the real WebSocket server with scripted players. Two real phones were not tested.
- **The balance numbers** come from AI-vs-AI battles at Lv 30. Real players (MANUAL control, the clash button) can do
  better or worse. The power values are easy to change later.
- **Admin controls:** the new balls' abilities can be tuned in Admin → Skills (the 2.6.0 skill registry). `RG.POWER`
  can only be changed in the code; there is no admin panel for it.
- **Sounds:** checked only for errors, not listened to (the test browser has no speakers).
