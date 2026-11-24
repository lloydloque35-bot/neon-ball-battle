# Online multiplayer — prepared, not active

**Status: real-time player-vs-player is NOT implemented yet.** The game does not pretend otherwise: rankings and tournaments currently use server-verified battles against the AI, and the UI says so.

## What is already in place
- **Player accounts, sessions, profiles and friends-ready schema**: `users`, `profiles`, and `friends` (user_id, friend_id, status).
- **Room and match tables**: `rooms` (code, host, mode, status) and `matches` (seed, players, inputs, result).
- **A deterministic, server-authoritative simulation.** The same seed plus the same input stream gives the same battle on the server and in every browser. This is the hard part of PvP and it is done and tested.
- **Input format**: `[step, type, ...args]`, applied on fixed 1/240 s steps. This is ready to be sent over a network.

## Recommended design: deterministic lockstep with server authority
1. **Matchmaking / private rooms.** A player creates a room (`rooms.code`, a 6-character code) or joins a queue that matches players by `profiles.rp`. Friend invites become `friends` rows plus a room code.
2. **Transport.** Add a WebSocket endpoint (for example the `ws` package, or Node's built-in WebSocket client support on the browser side) at `/api/play`, authenticated by the existing session cookie.
3. **Lockstep.**
   - The server picks the seed and the fighters (from each player's server-side progress) and sends the ticket to both clients.
   - Clients send their inputs tagged with a step number a few steps ahead, as input delay.
   - The server relays the inputs and runs its own simulation (`simulateTicket` with merged inputs), so its result is authoritative.
4. **Fair play.**
   - The server drops inputs for steps that have already been simulated.
   - It checks input rate limits and assigns each player a fighter slot, so a player can only control their own ball.
   - Disconnects become an AI takeover.
5. **Results.** The server stores `matches.inputs` and `matches.result`, and updates both players' RP with an Elo formula.
6. **Player tournaments.** Brackets of rooms. The existing `tournaments` table and bracket UI can be reused, with `state` holding human participants.

## Work remaining
- WebSocket server, room lifecycle and a reconnection protocol.
- Mapping multiple human input streams onto fighters: today the input stream controls the single `isPlayer` fighter.
- A latency buffer and an input-delay setting.
- PvP rating (Elo/Glicko) and anti-abuse rules (win-trading detection).
- Load testing: one Node process can simulate roughly 5 concurrent battles per CPU core in real time with headroom. Larger scale means sharding rooms across processes.
