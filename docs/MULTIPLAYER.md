# Online multiplayer (PvP)

**Status: real-time 1 VS 1 player-versus-player is implemented** (`server/pvp.js`, `server/ws.js`, the `LockstepNet` and `PvP` sections of `online.js`).
It needs the game server. The free Guest copy, such as GitHub Pages, has no server, so its Online PvP screen says that the feature needs the server.

## What players get
- **⚡ Quick Match (ranked):** pairs two waiting players.
  - The winner gains rank points (Elo, K = 32) and 80 coins + 60 EXP. The loser gets 20 coins + 20 EXP. Premium gets +25%.
  - Admin-exclusive balls are not allowed.
- **🏠 Private rooms (friendly):**
  - One player creates a room and gets a 5-character code. The friend types the code to join.
  - No rank points or rewards. The owner may use admin balls here.
- **During the battle:** both balls fight on **AUTO**. Either player can switch to **MANUAL** to steer and use abilities and the ultimate. There is no pause.
- **Leaving:** a player who leaves, disconnects or stalls for 15 s is replaced by the AI. Their ball keeps fighting on AUTO and the result still counts.
- **History:** the last 15 matches appear on the Online PvP screen.

## How it works: deterministic lockstep, server-authoritative result
1. **The server builds the match.** It creates the **ticket**: a random seed plus both fighters, built from each player's *server-side* progress (level, evolution, upgrades, skill tree). It also takes a **catalog snapshot**: the published balls and the players' own fusions.
2. **The same simulation everywhere.** Both browsers run the same deterministic battle as the server (fixed 1/240 s steps, portable math).
3. **Inputs travel in blocks.** A block is 12 steps (50 ms).
   - A player's inputs for block *b* are sent while they simulate block *b − delay*.
   - The delay is 2–10 blocks, chosen from both players' measured ping.
   - A browser simulates block *b* only once it has both players' inputs for it, so both screens show exactly the same fight.
4. **What the server does with inputs.** It only **relays and records** them:
   - Each socket controls only its own slot.
   - Inputs are validated (`cleanPvpActions`) and must arrive in block order.
   - Flooding is rate-limited.
   - A player who breaks the protocol is dropped and replaced by the AI. This is also logged as a security event.
5. **The server decides the result.** At the end it re-simulates the whole match from the ticket and recorded inputs in a worker thread.
   - Its result decides the winner, rank points and rewards.
   - Browsers cannot report a result. A browser that shows a different ending logs a warning in the console.

## Anti-abuse
- **Ranked reward limits:**
  - Rank points and rewards are given at most **3 times per day for the same pair** of players.
  - Coins and EXP stop after **20 ranked matches per day** per player. Rank points still change.
- **Connections:**
  - One live connection per account. A second window takes over and the first is closed.
  - Suspended or banned accounts cannot connect.
  - The socket requires the session cookie and a same-site `Origin`.

## Hosting notes
- The socket is at `/api/pvp/ws`. A reverse proxy must pass WebSocket upgrades (Caddy does this automatically). Over HTTPS the browser uses `wss://`.
- Everything runs in one Node process. Relaying costs very little; each finished match takes one verification of roughly 0.2–0.5 s in the worker pool (`VERIFY_WORKERS`).
- Players are matched through the server, so with a laptop server only devices that can reach the laptop can play. That means the same Wi-Fi for `START-GAME-SERVER-PHONE.bat`. For players anywhere, host the server online (see DEPLOYMENT.md).

## Not implemented yet
- Reconnecting to a match in progress. A dropped player's ball is finished by the AI instead.
- 2 VS 2, Free For All or player tournaments online.
- Spectating, chat, friends lists and skill-based queue matching (the queue is first-come, first-served).
