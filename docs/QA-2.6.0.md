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
  abilities were used. Re-run after the balance fixes: 194 battles, 0 errors.
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

See `SKILLS-2.6.0.md` → Balance rules. Measured win rates at Lv 50 (1v1, hard AI on both sides) against a fixed
12-ball pool of mixed rarities, 33 battles per ball, all 69 collectible battle balls, before and after 2.6.0:

| Rarity | Balls | Before 2.6.0 | After 2.6.0 |
|---|---|---|---|
| Common | 4 | 15% | 16% |
| Uncommon | 4 | 13% | 13% |
| Rare | 6 | 16% | 13% |
| Epic | 5 | 25% | 26% |
| Legendary | 9 | 41% | 40% |
| Mythical | 13 | 58% | 54% |
| Ancient | 3 | 80% | 73% |
| Secret | 7 | 89% | 80% |
| Limited | 6 | 79% | 73% |
| God Tier | 12 | 90% | 83% |

- Rarity still means more potential, but the gap is smaller (spread of win rates 32 → 29 points); no rarity moved
  by more than 9 points. The pool itself got the new skills too, so every number is measured against stronger opponents.
- Biggest gains: Vampire 28 → 58, Time 50 → 69, Universe 25 → 36, Star 36 → 45. Biggest drops: Anti Ball 89 → 69,
  Mecha Commander 92 → 72, Celestial 53 → 33, Mirror 64 → 48, God Portal 97 → 83.
- Fixes made from this measurement:
  - **Bigger kits** only count abilities that deal damage (guards, dashes, buffs and passives no longer make a
    ball's attacks lighter).
  - **Underdog Spirit** starts at a two-rarity gap and is smaller per step (+4% / −2%, max +32% / −16%): with the
    first version, mid-rarity balls beat the Secret, God Tier and Premium balls too often.
  - Frost Crown, Solar Flare and Aurora: their new damage abilities hit harder (Avalanche, Ice Wall shards,
    Icicle Guard, Freeze Command, Coronal Loop, Helios Beam, Mini Sun, Ribbon Dance). Coronal Loop now bends after the
    target (it used to miss almost every time).
  - Mirror Maze panels now send bounced shots back as the Mirror's own shots (before, a bounced enemy shot could
    still hit the Mirror).
  - Skill Training shows damage from walls, summons, arena effects and bounced shots ("Effects & passives").
  - Together these moved the Limited balls from 61% (first measurement) to 73%.
- Numbers vary by about ±8 points per ball between runs (33 battles each); the per-rarity averages are stable.
