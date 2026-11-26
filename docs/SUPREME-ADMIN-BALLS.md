# Update 2.1.0 — Supreme Admin Balls (owner only)

15 Supreme balls for the game owner. Each one has:

- **5 abilities.** No ability is reused by another ball.
- **1 ultimate** and **1 final-form ultimate.**
- **3 forms:** Base → Awakened → Final God Form.
  - **Awakened** comes with the 1st ultimate, or at **60% HP**.
  - **Final God Form** comes with the 2nd ultimate, or at **30% HP**.
  - Each form has a new look and stronger stats: attack ×1.18 / ×1.38, plus faster cooldowns.
  - Each change plays a transformation cinematic.
  - The Final God Form also gets a special entrance on the battlefield.
- **Its own look:** body art, floating decorations, aura and idle particles.
- **Its own effects:** wall-bounce effect, projectiles, victory animation and defeat animation.
- **Its own sound profile:** abilities, ultimates, transformation, victory and defeat.

The code is in `supreme.js`. The browser and the game server load the same file, so every battle with these balls can still be replayed and verified by the server.

## The 15 balls

| Ball | Abilities | Ultimate → final-form ultimate | Forms |
|---|---|---|---|
| **Reality Controller** | Reality Edit, Dimension Shift, Time Freeze, Ball Duplicator, Void Portal | **ADMIN DELETE** (owner console) → **GOD'S FINAL COMMAND** | Reality Controller / Reality Architect / God of Reality |
| **Supreme Skull King** | Skull Storm, Bone Army, Soul Chains, Death Orbit, King's Curse | **APOCALYPSE OF SKULLS** → Apocalypse of the Skull God | Skull King / Ancient Death Emperor / Supreme Skull God |
| **Void Emperor** *(upgraded, same id)* | Black Hole, Gravity Crush, Void Teleport, Dark Matter, Void Armor | Endless Void → Absolute Void | Void Emperor / Abyssal Sovereign / Absolute Void |
| **Thunder God** | Lightning Clones, Thunder Rain, Electric Dash, Thunder Cage, Overcharge | Divine Thunder → Ragnarok Thunder | Thunder God / Storm Sovereign / Divine Thunder King |
| **Archangel** *(upgraded, same id)* | Holy Laser, Divine Shield, Six-Wing Barrage, Heavenly Healing, Judgment Halo | Heaven's Judgment → Light of Creation | Archangel / Seraphic Archangel / Archangel of Creation |
| **Demon Lord** | Hellfire, Demon Summoning, Infernal Chains, Dark Explosion, Soul Feast | Hell's Gate → Throne of Hell | Demon Lord / Archdemon / King of Hell |
| **Glitch 404** | Digital Corruption, Error Clone, Glitch Teleport, System Distortion, Packet Loss | System Crash → Kernel Panic | Glitch 404 / Fatal Exception / Kernel Panic God |
| **Dragon Emperor** | Dragon Breath, Dragon Spirit, Meteor Strike, Dragon Claw, Dragon Scales | Eternal Dragon Rage → Eternal Dragon God | Dragon Emperor / Ancient Wyrm / Eternal Dragon God |
| **Blood Moon God** | Crimson Explosion, Bat Swarm, Shadow Clone, Blood Moon Aura, Hemorrhage | Eternal Blood Moon → Eternal Blood God | Blood Moon / Crimson Night Lord / Eternal Blood God |
| **Time God** | Time Rewind, Time Slow, Temporal Clone, Future Prediction, Clockwork Blades | Eternal Time Loop → End of All Time | Time God / Lord of Eras / Eternal Chronos God |
| **Infinity God** | Infinite Energy, Infinity Shield, Endless Waves, Infinite Expansion, Eternal Loop | Infinite Dominion → Infinity Beyond | Infinity God / Endless One / Infinite Dominion God |
| **Phoenix God** | Flame Wings, Phoenix Explosion, Rebirth, Sky Dive, Burning Trail | Eternal Rebirth → Solar Flame God | Phoenix God / Solar Phoenix / Eternal Flame God |
| **Black Sun** | Eclipse, Solar Flare, Gravity Well, Dark Corona, Coronal Mass Ejection | Consume the Light → Dead Star Collapse | Black Sun / Dead Star / Consumer of Light |
| **Mirror God** | Attack Reflection, Mirror Clone, Mirror Dimension, Prism Beam, Shard Storm | Infinite Reflection → Mirror God's Judgment | Mirror God / Prismatic Sovereign / Infinite Reflection God |
| **Omega** *(upgraded, same id)* | Omega Beam, Omega Absorb, Omega Evolution, Cosmic Pentagram, Omega Field | Omega Termination → Omega Ascendant | Omega / Omega Prime / Omega Ascendant |

### What changed for the older balls

- **Archangel, Void Emperor and Omega** were upgraded in place. They keep their ids, so the owner's saved progress still works.
- **Phoenix, Mirror, Infinity and Blood Moon** keep their normal player versions. Those versions are unchanged.
  - The new **Phoenix God, Mirror God, Infinity God and Blood Moon God** are separate, owner-only balls.
  - The spec listed 4 abilities for some of these balls. Each one got a 5th ability, so every Supreme ball has 5.
- If an older ball design override exists, it can still change a Supreme ball's look and stats. The abilities and forms always come from the code.

## ADMIN DELETE (Reality Controller's ultimate)

Using the ultimate opens the **owner console** for 12 seconds. You can send up to 4 commands. In single player the battle pauses while the console is open. Online, the battle keeps running.

| Command | What it does |
|---|---|
| ✖ Delete | Removes a ball **from this match only**. Its summons go with it. |
| ↺ Restore | Brings a deleted ball back with at least 25% HP. |
| ⟳ Transform | Turns a ball into any other ball. Its HP % stays the same. |
| ✎ Set property | Sets HP, size, speed or attack (10–200%). |
| Arena condition | Normal, frozen (slow), inferno (burn), storm (lightning) or shift (inverted steering), for 3–15 s. |
| Battle settings | Sets the damage multiplier (25–300%) and turns sudden death on or off. |

**Permanent management** is a separate button. It disables a ball for every player, asks for confirmation first and is audit-logged. You can turn the ball back on in Admin Dashboard → Balls. ADMIN DELETE itself never changes anything outside the current match.

When Reality Controller is controlled by the AI (an enemy, or a replay without commands), it removes the strongest enemy for 4.5 seconds instead (2 seconds for a boss). The enemy then comes back.

## Admin Ball Control Panel

Find it in **Admin Dashboard → 👑 Supreme Balls**. It is owner only and needs 2FA, like the rest of the dashboard.

- **Pick a ball:** see a live preview of all 3 forms, every ability, the ultimate and the final-form ultimate.
- **Abilities:** switch any of the 5 abilities on or off. At least 1 must stay on.
- **Cooldowns:** a multiplier from 0.2× to 3×.
- **Effects:** idle effect intensity from 0.2× to 1.5×, and the aura glow on or off.
- **💾 Save:** stores the settings on the server and writes them to the audit log. Every battle uses them.
- **Start form (2.4.2):** choose whether a ball starts every battle in its Base form, Awakened form or Final God Form. **⚡ Apply to all** sets the same start form for all 15 balls at once (their other settings are kept). In battle they still go further on their own: Awakened → Final God Form at 30% HP or with the 2nd ultimate.
- **⚔ Spawn & Test:** starts a Practice battle, so there are no rewards.
  - Choose the starting form, the opponent (training dummy, random AI or any ball) and the difficulty.
  - A test bar at the top lets you:
    - switch forms (BASE / AWAKEN / GOD)
    - fire each ability
    - refill the ultimate ("ULT ready")
    - reset cooldowns
    - preview the entrance, victory and defeat animations

## Security

- **Server-side access:** `access()` only allows `adminOnly` balls for the owner account.
  - Battle start, PvP and test battles all check this.
  - Supreme balls are never random opponents, and players cannot pick them as an opponent.
- **Hidden from players:** they never appear in shops, collections, fusion, trials or the owned-ball count. Players cannot buy, unlock, copy or equip them.
- **Commands are checked on the server:**
  - Console commands are battle inputs (`['x', cmd, target, v1, v2]`). They are recorded and replayed by the server.
  - The engine only applies them while the owner's ADMIN DELETE window is open, with at most 4 commands.
  - Test-bar commands only work in owner test battles.
- **Forged commands are rejected:**
  - A finished battle with admin commands from anyone but the owner is rejected and logged as `admin_command_forged`.
  - In PvP, a player who sends admin commands is dropped from the match.
- **Audit log entries:** `admin.supreme_tuning`, `admin.supreme_reset`, `admin.supreme_test` and `admin.delete_console` (every command: step, command, target, values).
- **No secrets in the browser:** there are no admin passwords, keys or secrets in client code. The browser only shows the panel. The server decides.

## Database

Migration `004_supreme.sql` adds `admin_ball_tuning`, which holds the Control Panel settings. It runs automatically when the server restarts.

## Tests

`server/test/supreme.test.js`, all passing:

- every ball, all 75 abilities, every ultimate and form change, and the HP-based transformations
- deterministic AI battles, including a 5-ball FFA
- ADMIN DELETE: delete, restore, transform, property, arena and settings commands, replayed exactly
- commands sent without an open window are ignored
- server rules: owner only, forged commands rejected, settings validated and audit-logged, test battles
