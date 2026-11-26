# Update 2.7.0 — Battle Pass & Coin Packs

## What changed

| Item | Price | What the player gets |
|---|---|---|
| 🎫 **Battle Pass** | **PHP 299** (one-time) | God of Chaos, God of War, AI Tech and Solar Eclipse, owned forever |
| 🆓 **Free Pass** | free | Anti Ball, unlocked for every player (until 2.8.0 — now a [limited edition](ANTI-BALL-LE-2.8.0.md)) |
| 🪙 **10,000 coins** | **PHP 99** | 10,000 coins added to the account |
| 💰 **1,000,000 coins** | **PHP 999** | 1,000,000 coins added to the account |

- The four Supreme God Balls were free from 2.2.0 to 2.6.0. From 2.7.0 they come with the Battle Pass.
- **Players who already played them keep them.** When the server updates, every player who had played or upgraded one
  of these balls gets it as owned, with all their levels and progress. This happens once, in database migration
  `009_battlepass.sql`. A backup of the database is made first.
- A player who kept some of them can still buy the pass to get the rest.
- Anyone can still **try** the four God Balls for free in a Practice test (no rewards).
- The God Balls' forms still unlock as each ball levels up (Awakened at Lv 10, Final God Form at Lv 20), so the update
  does not change battles.
- The four God Balls can't be bought with coins or won from summon orbs.

## Where players find it

- **Main menu → 💎 Shop • Battle Pass • Coins.** At the top is the Battle Pass card, with the 4 God Balls and the Free
  Pass, then the coin packs, then the Premium God Balls.
  (Since 2.8.0 the Free Pass row is gone: Anti Ball became a limited edition.)
- **Ball selection:** the row "🎫 BATTLE PASS — SUPREME GOD BALLS • PHP 299" shows **🎫 BATTLE PASS** or **✔ OWNED**.
  (Until 2.8.0 Anti Ball showed **FREE PASS — UNLOCKED** here; now it shows its limited-edition price or OWNED.)
- **Collection → Supreme God Balls** and the God Ball preview show the price and a **Get the Battle Pass** button.
- **Upgrade Shop:** a "Need more coins?" shortcut to the coin packs.

## How payments work (same as the other shop items)

- **QR (Maya / MariBank / GCash / any bank app):**
  1. The player scans your QR, pays, and sends the reference number.
  2. Nothing unlocks until **you** press Approve in Admin Dashboard → 💳 God Shop.
  3. Approving adds the coins (or the 4 balls) **once**. Approving the same payment again is refused.
  4. Each reference number works only once.
- **PayMongo checkout (if you set it up):** the server itself asks PayMongo whether the exact amount was paid before it
  adds anything. Paying too little puts the purchase "under review". Repeated webhooks, "Check" and "Restore purchases"
  never add coins twice.
- Every purchase, approval and coin grant is written to the audit log.
- No bank details are in the game files. Your QR stays in the server database.

## Tests

`server/test/battlepass.test.js` (7 tests):
- the four balls are locked without the pass;
- a free practice test still works;
- Anti Ball is free;
- Battle Pass by checkout and by QR;
- coin packs added exactly once, including:
  - duplicate webhooks;
  - restore;
  - double approve;
  - rejected payments;
  - paying too little;
- a player who kept one ball buys the rest;
- the database migration keeps veterans' balls and gives nothing to anyone else.

Full suite: 152 / 152 pass.
