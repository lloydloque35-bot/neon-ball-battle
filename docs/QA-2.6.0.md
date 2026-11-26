# QA report — 2.6.0 Ultimate Unique Skill, Mastery & Evolution System

All checks were run on the game's own simulation (the same code the server uses to verify battles) and in a real browser.

## 1–2. Audit of every ball and every ability

- 97 battle balls checked (70 collectible player balls, 27 Admin Exclusive), 640 abilities and ultimates in the registry.
- Every collectible ball has exactly its rarity's skill slots (Common / Uncommon keep their four abilities).
- 224 classic abilities of the shared types (beam, projectile, shield, heal…) each got their own signature mechanic;
  65 ultimates of the shared types (judgment, nova, supernova, barrage, black hole…) each got their own phase.

## 3–5. Missing abilities, duplicate mechanics, new abilities

- 187 new abilities filled the empty slots (Epic +1, Legendary +2, Mythical +3, Ancient/Secret +4, Limited +5,
  God Tier +6 for the classic gods, +4/+3 for the Supreme God Balls).
- Duplicate audit (mechanics, targeting, activation, effects, animation, name): **0 duplicates, 0 similar pairs**.
- A renamed copy is caught (tested): a plain burning projectile scores 90% against Fireball-type abilities and is refused.

## 6–7. Every ability, transformation and ultimate

- Automated test: every one of the 187 new abilities is used on its own (cast, passive or autonomous) and must do something;
  numbers stay valid afterwards.
- Automated test: every classic ability (with its signature) and every ultimate of every ball runs without errors.
- Stress test: every ball fights 2v2 and 1v1 battles with every ability unlocked — 291 battles, 0 errors; all 187 new
  abilities were used.
- Browser test: every ball (97) fought with all abilities and its ultimate on screen — 0 page errors.
- Transformations / God balls: the 2.1–2.5 test suites (forms, God Clash, Infinite Void, God of Absolute free will and
  trips outside the arena) all pass.

## 8. Progression and mastery

- Unlocks follow the ball level (and wins for the rarest balls); Premium-maxed / owner balls fight at full power;
  AI opponents unlock by level only (tested).
- Mastery comes only from verified battles (server re-simulation), capped per battle; practice gives none; mastery
  titles are granted and cannot be bought (tested).
- Evolution: level, mastery rank and coins are all checked on the server; coins are paid once; Common balls have one stage;
  the evolution is part of the next server ticket; the evolution log cannot be changed (tested).

## 9. Save and loading

- `savePayload` includes `skills26` (mastery XP and evolutions); the client keeps them in `SAVE.skills26`.
- Migration 008 adds four tables only; the server backs up the database before migrating. Existing players keep
  their balls, levels, coins, purchases, editions and skill-tree nodes.

## 10. Existing gameplay

- Full test suite: **145 / 145 pass** (132 from before + 13 new).
- Same battle replays identically (with trips outside the arena, teleports, evolutions and mastery): tested.
- Online PvP inputs accept up to 10 ability buttons; the server validates them.

## Balance

See `SKILLS-2.6.0.md` → Balance rules. Measured win rates at Lv 50 against a 12-ball pool of mixed rarities
(36 battles per ball): see the table below.
