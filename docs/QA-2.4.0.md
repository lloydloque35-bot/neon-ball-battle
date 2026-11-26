# QA report — Update 2.4.0 GOD OF ABSOLUTE

**Date:** 26 November 2026 • **Build:** 2.4.0 • **Where:** the development server (Linux, Node 22) and headless Chromium (Playwright).

**Overall result:**
- **122 automated tests, 122 passed, 0 failed:** 102 from earlier updates plus 20 new.
- **Browser checks:** about 20 screenshots, no page errors.

Every line below says how it was tested. Anything that could not be tested here is listed under "Not tested here".

## How to read this

- ✅ **Passed** — executed here, and it worked.
- 🟡 **Partly** — executed here, but in a simulated form (for example a fake payment provider). The limits are explained.
- ⛔ **Not tested here** — needs something this server doesn't have (real money, a real phone).

## The 20 required checks

| # | Check | Result | How it was tested |
|---|---|---|---|
| 1 | God of Absolute purchase | ✅ | `absolute.test.js` "reserve → pay → owner approves". Browser: a phone-size player pressed Buy, saw the reserved-slot countdown, sent a reference, and the owner approved it in the dashboard. |
| 2 | PHP 499 checkout | ✅ / 🟡 | QR checkout: amount 49900 centavos (PHP 499) recorded and shown ("Send exactly PHP 499.00"). PayMongo checkout tested against a **fake** PayMongo API with the same request/response shapes. |
| 3 | Actual payment verification | 🟡 | **QR:** a ball is granted only by the owner's Approve (owner + 2FA). Reference numbers are single-use, including spaces, dashes and lower-case variants. **PayMongo:** signed webhook, then a server re-check, tested with the fake API. **No real money was moved.** |
| 4 | Limited-edition stock | ✅ | Real counts (supply / owners / reserved / available) checked through the API and the shop card. Expired reservations release. Reserve is refused when paused or sold out. "SOLD OUT – THE ABSOLUTE ERA IS COMPLETE." is shown. |
| 5 | Concurrent final-slot purchases | ✅ | **2 players** reserved the last slot at the same moment → exactly 1 got it (the other got "ALL_RESERVED"). **12 players** raced for 3 slots → exactly 3 reservations and 3 owners, numbered #1…#n with no gaps. A payment that arrived after the hold expired and the slot was taken → marked for refund, never granted (QR and PayMongo paths). |
| 6 | Permanent ownership | ✅ | Database triggers refuse UPDATE/DELETE on owners and on the ledger. Duplicate edition numbers and second grants are refused. A second approval returns 409. |
| 7 | Instant Level 50 | ✅ | After approval: the ball is Lv 50, account level and EXP are unchanged, and another ball (Lv 23) is unchanged. All 5 skills are unlocked at Lv 50 (this check found and fixed a bug, see below). |
| 8 | Level 50–100 progression | ✅ | EXP given through the same server function verified battles use: Lv 51 after 300 EXP, stops at 100, other balls still stop at 50. The owner's EXP scale is validated (0.25–4) and reaches the player's save. Form gates checked at Lv 50 / 69 / 70 / 99 / 100. Not checked by playing ~370 real battles. |
| 9 | All five skills | ✅ | `absolute.test.js` casts every skill in all 3 forms: each does damage (or its defensive / summon job) and leaves nothing behind. Browser screenshots of all five. |
| 10 | Three transformation stages | ✅ | Form caps by level. Form art for all 3 forms rendered. Transformation cinematic seen in the ultimate screenshots (Celestial Sovereign). |
| 11 | Regular ultimate | ✅ | Absolute Zero: stop/rise, damage dealt, and afterwards no lasers, zones or arena changes remain. Browser: 4 frames of the sequence (dim, symbols, rings, sphere, beams). |
| 12 | Final-form ultimate | ✅ | Omniversal Absolute Dominion: same checks. Browser: 3 frames (dimension, nodes, convergence). |
| 13 | Exclusive animations | ✅ / ⛔ | **Screenshots:** battle entrance, all skills, both ultimates, transformation, victory (crown of light + "THE UNRIVALED ONE"), golden cosmic elimination ("ERASED"), MVP on the results screen, lobby showcase, shop card, in-battle nameplate. **Not visually checked:** the defeat animation and the selection-screen card (the code ran in battles and the menu without errors, but no screenshot was taken). |
| 14 | Multiplayer synchronization | ✅ | `absolute_pvp.test.js`: a ranked match over the real WebSocket gives both players an identical ticket. The server replay decides the winner and matches the local simulation. Non-owners are refused. Determinism replays (same seed → same result, also a PvP ticket against God Portal). |
| 15 | Admin access protection | ✅ | Players get 401/403 on every edition owner route. The owner can't give edition slots or owner rewards with the grant tool. Level-maxing tools skip God of Absolute. |
| 16 | Purchase restoration | ✅ | A deleted reward is restored; a ball damaged to Lv 3 goes back to Lv 50; a Lv 100 ball stays Lv 100. Restorations are recorded and shown in the owner panel. |
| 17 | Mobile performance | 🟡 | Headless Chromium at phone size (844×390), FFA with every skill and the final ultimate running. Drawing cost per frame: God of Absolute **3.0 ms** (Full), **2.8 ms** (Reduced), **2.5 ms** (Minimal). God of Guns 3.7 ms, God Portal 3.4 ms. Simulation 0.06–0.07 ms per step. **Not measured on a real phone.** |
| 18 | Existing God Ball compatibility | ✅ | All earlier suites pass: `supreme` (11), `gods` (10, includes God of Time), `gods2` (10, God of Guns / God Portal), `techballs`, `portal`. `gods.js` (God of Time and the free God Balls) is byte-for-byte unchanged. |
| 19 | Existing player data preservation | ✅ | Test: a database with a player row was migrated → a backup was written first and contains the player and the pre-migration state. Migration 007 only adds tables, a column and triggers. |
| 20 | 2.3.0 regression | ✅ | `gods2.test.js` and `manualpay.test.js` pass. One expectation was updated on purpose: the shop's product list now also contains `godofabsolute`. |

## Problems found during QA and fixed

1. **Crash:** when the Mirror ball copied *Divine Replication*, the game crashed. Copied skills now do nothing harmful, and only God of Absolute can replicate.
2. **Skills locked:** a fresh Lv 50 owner had 3 of 5 skills locked behind the normal skill tree. All 5 are now unlocked from Lv 50, with a test so it stays that way.
3. **Ultimate missed:** the beams aimed where the enemy *was*, so moving enemies dodged almost all of them. They now follow their target, like God of Guns' tracking beams.
4. **AI wasted Judgment:** the computer cast Absolute Judgment from too far away. Skill choice for the AI and AUTO mode is now distance-aware.
5. **Balance:**
   - At first it was far too weak at Lv 50 (13%) and too strong at Lv 100 (100%).
   - Tuned: skill power per form, the copies, the final-form rings, much less raw power per level above 50, and a short safety window while it rises for the ultimate.
   - Final numbers are in GOD-OF-ABSOLUTE.md.
6. **Display:** a stray "null" text appeared under the account name in the QR window and in the Premium screen. Fixed.

## Not tested here (needs the live site)

- A real payment of PHP 499 with real Maya / MariBank / GCash / PayMongo money.
- Real phones (low-end Android, iPhone): frame rate and touch.
- Real players connecting from different networks (all multiplayer tests used real WebSockets on one machine).

## Observation (not changed)

Buyers of the 2.3.0 God Balls (God of Guns, God Portal) start at their ball's own level. Their 3rd–5th skills still unlock through the normal skill tree (Lv 5 / Lv 12). That is how 2.3.0 was built, and this update doesn't change it.
