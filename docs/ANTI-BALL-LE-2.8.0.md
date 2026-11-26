# Update 2.8.0 — ANTI BALL: Limited Edition

Anti Ball is upgraded in place: same ball, same id (`anti`), same saves. It is now a rare **defensive counter** ball,
sold as a **permanent limited edition of 100 copies worldwide**.

## The edition

| | |
|---|---|
| Price | **PHP 999**, one-time |
| Supply | **100 copies worldwide**, forever |
| Serial numbers | **ANTI-001 … ANTI-100**, one per owner |
| Restock | **Never**: the supply cannot be raised, there are no new editions, no events, no free copies, no admin grants |
| Sold out | When all 100 have owners, the shop shows **SOLD OUT — FOREVER** |

How buying works:
- The player sees the exact price and a confirmation screen before paying.
- The ball unlocks only after the payment is verified:
  - **QR payment:** the game owner checks it and presses Approve.
  - **PayMongo checkout:** the server confirms the payment with PayMongo itself.
- While a player is paying, one copy is **held** for them. Two players can never get the same last copy (tested with
  simultaneous buyers).
- Each copy is linked to one account and can never be moved: the database refuses any change to an ownership row.
- Ownership stays after logout and on other devices. "Restore purchases" re-checks it.
- Owners also get the **NULL BEARER** title.

Old players:
- Anti Ball was free before, so it is now **locked for everyone** who has not bought a copy.
- Their old Anti Ball levels, skill tree, wins and losses are **kept**. They come back if that player buys a copy.
  This is done in database migration `010_anti_edition.sql`, with an automatic backup first.

The Free Pass:
- Anti Ball was the Free Pass ball. For now the Free Pass has no ball.
- Tell the developer which ball should be free to add one.

## The 9 skills (8 abilities + ultimate = the Limited rarity's 9 slots)

| Skill | Cooldown | What it does | Limits / counterplay |
|---|---|---|---|
| **Null Core** | 11 s | A crimson shell for 4 s: enemy shots that touch it lose half their damage and speed. Part of that becomes **null charge** for Counter Pulse. Its own stuns and slows wear off twice as fast | Not ultimates; once per shot; small radius |
| **Skill Rejection** | 13 s | Arms a seal for 3 s: the next enemy **ability** hit is rejected and fired back as a null bolt | One hit only; never ultimates, never burn or poison ticks; the bolt can be dodged |
| **Adaptive Matrix** | 14 s | For 6 s, abilities it has learned hit 15% softer, and it side-steps their shots | Only learned abilities; at most one side-step every 0.8 s |
| **Counter Pulse** | 10 s | Armed for 5 s: when an enemy comes close it pushes, hurts and slows it, plus any null charge | Up to 3 pulses; the range is shown as a dashed circle |
| **Null Zone** | 12 s | A field around it: enemies inside are weakened | Limited time and range (classic Anti Ball ability, kept) |
| **Mirror Protocol** | 12 s | Leaves a null mirror and blinks aside. Enemy targeting and homing shots chase the mirror, which then bursts | 3 s; one mirror at a time; the mirror can be destroyed |
| **System Override** | 13 s | After a warning line, fires a null bolt. The ball it hits has its cooldowns tick at half speed for 3 s | Can be dodged; half as long on bosses; then 6 s immunity; never disables abilities |
| **Absolute Resistance** | 15 s | For 4 s, each repeat of the same attack from the same enemy hurts 20% less | Never below 40%; resets when it ends |
| **ANTI EXISTENCE** (ultimate) | — | A 0.7 s warning, then a 5 s null domain: enemy shots vanish inside, enemy cooldowns pause inside, Anti Ball's team takes 30% less damage inside. At the end it pulls inward and collapses into a burst that grows with what it absorbed | Enemies can walk out; the area is shown first |

Passive — **ADAPTIVE NULL**:
- Learns abilities that hit Anti Ball again and again in **this match**: −10% per repeat, at most −30%.
- The battle HUD shows what it is analysing ("ANALYSED: Fireball 2/3"), and crimson arcs around the ball show it too.
- It forgets an ability after 8 s without a repeat, and everything when the match ends.
- It never copies, steals or disables anything.

**NULL ASCENSION** (transformation):
- Black-chrome sphere, glowing crimson core, floating geometric rings, dark energy particles and space distortion.
- It has its own transformation animation and sound, its own entrance and its own victory.
- It triggers with the first ultimate, or once at 40% HP.
- Effect: 10% less damage taken and cooldowns 10% faster.
- It stays a ball (never a character).

**Fairness rules:**
- Every ability has a cooldown, a duration and a range.
- Anti Ball's own damage reductions can never cut a hit below **45%**.
- The 2.6.0 rules (cast pacing, stun-loop and invulnerability limits) apply to it as well.

## Anti Ball Mastery (looks only)

- Mastery EXP comes from verified battles with Anti Ball. It is the sum of its abilities' 2.6.0 mastery.
- There are 10 levels, about 100 battles to the top. The level and a progress bar are shown in the ball details and
  the shop.
- What each level unlocks:

  | Level | Unlocks |
  |---|---|
  | 1 | Null Core glow |
  | 2 | Crimson trail |
  | 3 | Null motes |
  | 4 | Second geometric ring |
  | 5 | Crimson analysis rings |
  | 6 | Black-chrome entrance |
  | 7 | Distortion aura |
  | 8 | Crimson victory nova |
  | 9 | Third ring |
  | 10 | **NULL MONARCH** title and a white-gold core |

- Mastery never changes stats or damage. This is tested: a level-10 Anti Ball fights exactly like a new one.

## Balance

Measured at Lv 50 against hard AI, 3 battles per opponent:

| Opponent rarity | Common | Uncommon | Rare | Epic | Legendary | Mythical | Ancient | Secret | Limited | God Tier |
|---|---|---|---|---|---|---|---|---|---|---|
| Anti Ball wins | 100% | 100% | 100% | 100% | 92% | 67% | 56% | 25% | 67% | 0% |

- Against the standard 12-ball test group it wins **75%**. For comparison:
  - the Limited average is 73%;
  - the old Anti Ball won 89% before 2.6.0 and 69% after it.

## Shop, collection and owner panel

- **Shop → 🛡 LIMITED EDITION** has:
  - a rotating cinematic preview with a light sweep, perspective rings and a floor shadow, which switches between the
    base form and NULL ASCENSION (tap it to transform);
  - a ▶ preview for every skill and the ultimate, and a free practice test;
  - the copies left out of 100 with a bar, the exact price, and the confirmation screen;
  - for owners: **✔ YOU OWN ANTI BALL** and the serial number (e.g. ANTI-007), plus mastery.
- **Ball details** show "YOUR COPY: ANTI-007", the mastery panel and all 9 skills.
- **Admin → 🛡 Anti Ball Edition** (owner + 2FA only) shows:
  - the supply and the owners with their serial numbers;
  - waiting and verified purchases, and payments that need attention;
  - the ledger, which cannot be changed;
  - a **Pause sales** button.
- Skill cooldowns and power are set in **Admin → 🧬 Skills**. Every change is audit-logged.

## Tests

The two test files have 17 tests in total.

`anti_edition.test.js` covers:
- every ability, the ultimate and NULL ASCENSION;
- Adaptive Null, including the cap, forgetting, and resetting between matches;
- the 45% floor;
- that mastery changes looks only;
- determinism;
- battles against every rarity tier.

`anti_shop.test.js` covers:
- no free unlock: not for coins, not from events, not by admin grant;
- serial numbers ANTI-001, ANTI-002 and ANTI-100;
- ownership after logging in again;
- simultaneous buyers for the last copy;
- permanently sold out, with the supply never raised and no new edition;
- owner-only management;
- migration 010;
- the mastery title.
