# Online multiplayer & ranked seasons

**Status: implemented.** The online modes are 1 VS 1, 2 VS 2, the 5-player arena and co-op vs AI. Ranked seasons have tiers from Bronze to Legend.
- **Code:**
  - Server: `server/pvp.js`, `server/season.js` and `server/ws.js`.
  - Browser: the `LockstepNet` and `PvP` sections of `online.js`.
  - Shared engine: `PVP_MODES`, `RANK_TIERS` and `createPvpTicket` in `script.js`.
- **Server needed:** the free Guest copy (GitHub Pages) has no server, so its online screen says the feature needs the server.

## Modes (🌐 Online & Ranked)

| Mode | Players | Ranked queue | Friend room |
|---|---|---|---|
| ⚔ **1 VS 1** | 2 | yes | yes: starts when the friend joins |
| 👥 **2 VS 2** | 4 | yes | yes: up to 4 friends, pick Team A or B, host presses Start |
| ✺ **5-PLAYER ARENA** | 5, everyone for themselves | yes | yes: up to 5 friends, host presses Start |
| 🤝 **CO-OP vs AI** | 2 friends vs 2 AI balls | — | yes: starts when the friend joins (no season points) |

**Empty seats are AI balls.**
- **Ranked 2 VS 2 and 5-player arena:** they start as soon as every seat has a player. After **20 s** they start anyway with AI balls in the empty seats. The arena needs at least 2 players, and 2 VS 2 needs at least 1 player on each side.
- **Alone for 45 s:** you get an **unranked** match against AI balls, so nobody waits forever.
- **Friend rooms:** these also fill the empty seats with AI.

**Play 2 VS 2 with a friend (duo).** Create a 2 VS 2 room, let your friend join, and choose the same team. Then the host presses **⚡ Find opponents together**. You queue as one team.

**AI seats:**
- They use non-god balls at the players' average level.
- They never earn points.
- They only affect placements.

## Seasons and rank tiers
- **A season is one calendar month (UTC).** Ranked matches change **season points**, and your points decide your tier:

| Tier | Points | Season reward |
|---|---|---|
| 🥉 Bronze | 0+ | 300 coins |
| 🥈 Silver | 150+ | 600 |
| 🥇 Gold | 350+ | 1,000 |
| 💠 Platinum | 600+ | 1,600 |
| 💎 Diamond | 900+ | 2,500 |
| 🔮 Master | 1,250+ | 3,500 |
| 👑 Legend | 1,600+ | 5,000 |

- **1 VS 1 and 2 VS 2 points:** Elo with K = 32 against the other side's average, plus a **+4 win bonus**.
- **5-player arena points:** each pair of players is compared by placement (Elo, K = 32 split over the opponents). 1st place gets **+6** and 2nd gets **+2**.
- **Limits:** points never go below 0.
- **New season:** the next season starts from **half of your last season's points**, at most 600 (Platinum's start).
- **Season rewards:**
  - They pay coins for the **highest tier reached**, if you played at least **5 ranked matches**.
  - You claim them once the season is over, with the 🎁 button on the Online screen.
- **Season ranking:** the 🏆 button shows the top 50 of the current season.
- **Battle points:** the old "rank points" from single-player battles are now called **battle points**. They still drive the global Rankings screen. Online matches change season points only.

## Rewards per ranked match
- **1 VS 1 / 2 VS 2:** a win gives 80 coins + 60 EXP, a loss 20 + 20 and a draw 40 + 40.
- **5-player arena:**

| Place | Coins + EXP |
|---|---|
| 1st | 100 + 70 |
| 2nd | 60 + 45 |
| 3rd | 40 + 30 |
| 4th | 25 + 20 |
| 5th | 20 + 15 |

- **Premium:** members get +25%.
- **Friend rooms and co-op:** these are friendly, with no points or rewards.

## Premium monthly coins
- **Who and how much:** active Ultimate Premium members can claim **2,000 coins once per calendar month** in the ★ Premium screen.
- **Checks:** the server checks the subscription and records each month, so coins are claimed only once.

## How it works: deterministic lockstep, server-authoritative result
1. **The server builds the match.** It creates the **ticket**: a random seed and every ball, built from each player's *server-side* progress, plus the AI seats. It also takes a **catalog snapshot**.
2. **The same simulation everywhere.** Every browser runs the same deterministic battle as the server (fixed 1/240 s steps, portable math). Each player has a slot (0–4); AI seats have none.
3. **Inputs travel in blocks.** A block is 12 steps (50 ms).
   - A player's inputs for block *b* are sent `delay` blocks ahead.
   - The delay is 2–10 blocks, chosen from the two slowest pings.
   - A browser simulates block *b* only once it has **every** player's inputs for it, so all screens show exactly the same fight.
4. **What the server does with inputs.** It only **relays and records** them:
   - Each socket controls only its own slot.
   - Inputs are validated (`cleanPvpActions`) and must arrive in block order.
   - Flooding is rate-limited.
   - A player who breaks the protocol, disconnects or stalls for 15 s is handed to the AI.
5. **The server decides the result.** At the end it re-simulates the whole match from the ticket and the recorded inputs in a worker thread.
   - Its result decides the winner, placements, season points and rewards.
   - Browsers cannot report a result.

## Anti-abuse
- **Same opponent:** 1 VS 1 ranked points and rewards count at most **3 times per day against the same opponent**.
- **Daily rewards:** coins and EXP stop after **20 ranked matches per day** per player, across all modes. Points still change.
- **Unranked matches:** matches against AI only (lone player) are never ranked.
- **Connections:**
  - One live connection per account. Suspended or banned accounts cannot connect.
  - The socket requires the session cookie and a same-site `Origin`.
  - Admin-exclusive balls are allowed only in friend rooms, never in ranked.

## Hosting notes
- The socket is at `/api/pvp/ws`. A reverse proxy must pass WebSocket upgrades. Over HTTPS the browser uses `wss://`.
- The database changes for these features are in `server/migrations/003_multiplayer.sql` and apply automatically when the server starts.
- Everything runs in one Node process. Relaying costs very little; each finished match takes one verification of roughly 0.2–1 s in the worker pool (`VERIFY_WORKERS`).

## Not implemented yet
- Reconnecting to a match in progress. A dropped player's ball is finished by the AI.
- Spectating, chat and friends lists.
- Skill-based matchmaking: queues are first-come, first-served.
