# Update 2.3.0 — God of Guns + God Portal (Premium God Balls, PHP 99 each)

There are two new **Supreme Premium God Balls**. You buy them once in Philippine pesos and own them forever on your account.

| Product | Price |
|---|---|
| God of Guns | **PHP 99** |
| God Portal | **PHP 99** |
| Both together | **PHP 198** |

- **Permanent ownership.** It is saved on the server, so it works on every device and after reinstalling.
- **All 3 forms are unlocked right away** for owners.
- **Not part of anything else.** These two balls are **not** included in the Ultimate Premium subscription. They also can't be bought with coins, won from summon orbs, or used in fusions.
- **Free practice test.** Anyone can try them in Practice (no rewards) before buying.
- **Nothing else changes.** All other balls, God of Time and the free God Balls are unchanged.

The code is in `gods2.js` (balls, Infinite Void, shop screen) and `server/shop.js` (payments).

---

## God of Guns — SUPREME PREMIUM GOD (weapon master)

Each skill has three versions, one per form: Base / Awakened / Final God.

| Skill | Base | Awakened | Final God |
|---|---|---|---|
| Arsenal Summon | 6 floating pistols, each aiming at its own target | 6 twin blasters and piercing snipers that flank | 8 weapons including homing rocket pods, plus a synchronised volley every 2.4 s |
| Infinite Bullet Storm | 3 aimed waves of bullets | a rotating spiral of 36 bullets in every direction | a bullet curtain: 32 bullets freeze in mid-air, then all re-aim at enemies |
| Railgun Blast | charges, then a piercing beam | the beam bounces off the wall | three railguns at once, leaving a burning ion trail |
| Weapon Copy | copies the nearest enemy's strongest projectile attack for 6 s | 8 s, 10% stronger, fires twice | the best attack from all enemies, 20% stronger, fires 3 times |
| Orbital Cannon | a giant cannon fires a huge shell | the shell splits into 5 cluster bombs | an orbital strike: lock-on, a tracking beam from orbit, then the shell |

- Weapon Copy only *copies* an attack, and the copy fades after a few seconds. Nothing is stolen.
- **Ultimate: GOD'S FINAL ARSENAL.**
  1. The battle turns into a weapon realm, full of floating weapons.
  2. Six giant cannons surround the ball and lock onto their targets.
  3. A synchronised barrage ends in a massive explosion.
- **Final-form ultimate: INFINITE WEAPON APOCALYPSE.** A celestial arsenal rings the whole arena and fires three synchronised volleys plus six converging cannon beams, then the whole arena detonates.
- **Passive: WEAPON MASTERY.**
  - Every hit builds weapon energy: up to 25% faster abilities and +10% attack.
  - At 100 energy it goes into **OVERDRIVE** and its weapons fire twice as fast.

## God Portal — SUPREME PREMIUM GOD (dimensional control)

| Skill | Base | Awakened | Final God |
|---|---|---|---|
| Portal Dash | one jump through two linked portals | two jumps with shockwaves; the portals stay open for anyone for 3 s | three slashing jumps in a triangle, then a portal burst |
| Void Summon | a copy of another ball | 2 copies | 3 copies, one of them a copy of the strongest enemy |
| Dimensional Trap | swallows the target into a dimension for 1.2 s | it is thrown back out in front of God Portal, stunned | 1.8 s, and it returns inside a collapsing void |
| Portal Reflection | up to 5 enemy shots go through a portal and come out next to their owner | the shots home in (up to 6) | the shots split in two and home in (up to 8) |
| Void Collapse | 3 portals pull enemies in, then an explosion | 4 portals firing void shards, then a bigger explosion | 6 portals and two collapses, leaving a rift |

- **Passive: DIMENSIONAL MASTERY.** Every portal used adds a stack: abilities 5% faster and hits 2% harder per stack. The maximum is 5, 7 or 9 stacks depending on the form.

### Ultimate: INFINITE VOID REALM — a real second battle space

1. A gigantic gateway opens and God Portal goes through it.
2. The nearest opponent is pulled in with it.
3. They land in the **Infinite Void**, a separate battle arena with:
   - an endless cosmic background with moving galaxies and stars
   - **floating platforms**; off the platforms, the void's **gravity** (which keeps turning) drags you
   - three **spatial zones**: Gravity Well (pulls you in), Stasis Field (slows you) and Rift Storm (lightning strikes)
   - drifting **void meteors** that hurt on contact
   - a **portal network** that carries anyone who enters a portal to its partner
4. Copies of different balls come out of the portals.
5. Every portal fires a coordinated volley.
6. After 6 seconds the void collapses in a huge explosion, and the survivors return to their original spots in the normal arena.

How it stays safe:
- **Inside and outside never mix.** Fighters inside the void and fighters still in the arena can't see, target, touch or damage each other, so other players are never affected.
- **The normal arena is untouched.** Nothing created inside the void leaks out when it ends: shots, fields, lasers and copies are all removed.
- **If God Portal falls inside,** the void closes at once and the survivor returns.
- **Players left in the arena** see a small live window into the void.
- **Only one void at a time.** A second cast while a void is open becomes a "dimensional rupture" instead.
- **Its ultimate can't recharge while the void is open.**
- **Online play:**
  - Everything runs on the shared simulation, so PvP stays in sync and the server can replay and check it.
  - A player who disconnects keeps fighting on AUTO, and the void always ends on its timer and brings them back.
  - Each match has its own void, so it can never affect another match.

**Final-form ultimate: OMNIVERSAL INFINITE VOID.**
- Takes up to **two** opponents into **three linked dimensions**, each with its own environment and gravity:
  - Nebula Expanse: light drift
  - Crimson Rift: gravity pulls downward
  - Crystal Gravity: gravity pulls toward a crystal
- Every 2 s the portal network drags the opponents into the next dimension, and giant gates fire across them.

---

## The Premium God Shop

- **Open it from:** the main menu (**💎 Premium God Shop**), the Collection, or the God Ball preview.
- **Each ball shows:** price, class, live animation, skills, forms, passive, and an "owned" badge.
- **Buttons:**
  - **Buy** opens PayMongo's secure checkout. The payment methods shown are the ones you switched on: GCash, Maya, QR Ph (most bank and e-wallet apps), online banking (BPI / UnionBank), cards, and others.
  - **↺ Restore purchases** re-checks your account.
  - **🧾 Transaction history** lists every purchase.
- **After paying,** the game comes back and asks the **server** to confirm the payment with PayMongo. The page itself never unlocks anything.

### Security

- **Ownership comes only from the server's own check.**
  - The server fetches the checkout session **from PayMongo** and checks that it shows a payment that is `paid`, in PHP, for at least the right amount, for this exact purchase.
  - The success page, the browser and even the webhook body are never trusted on their own.
- **Webhooks are checked carefully:**
  - The `Paymongo-Signature` header (HMAC-SHA256) is verified, and old timestamps are rejected (5 minutes maximum).
  - Each event is processed only once.
  - A webhook that arrives before the payment exists grants nothing.
- **Each PayMongo payment can complete only one purchase.**
  - A wrong amount is put on hold for review, never granted.
  - If someone pays twice, the owner is told to refund the extra payment.
- **No duplicate purchases.**
  - You can't buy a ball you already own.
  - You can't buy the bundle if you own one of the two balls.
  - An open checkout is reused instead of creating a second one.
- **No sensitive data and no secrets in the game.**
  - The server never sees cards, wallet logins, PINs or OTPs; PayMongo hosts the payment pages.
  - Secret keys stay on the server (environment variables). The webhook secret is kept in the server database if you register it from the dashboard.
  - No bank account details are anywhere in the game files.
- **Not set up yet = shop closed.** Until PayMongo is configured, the shop is closed and says so. Purchases are never simulated.
- **Logged and protected.**
  - Every purchase, grant, restore and setup change is audit-logged.
  - Bad signatures and wrong amounts create security events.

### Owner setup (Admin Dashboard → 💳 God Shop (PHP))

1. **Create a PayMongo account** and finish business verification (needed for real payments).
2. **Add the test key to the server** (Web → Sites → your site → Environment), then restart:
   ```
   PAYMONGO_SECRET_KEY=sk_test_...
   ```
3. **Register the webhook.** Open **Admin Dashboard → 💳 God Shop (PHP)** and press **Register webhook automatically**. `APP_ORIGIN` must be your `https://` address.
4. **Choose payment methods.** Tick only the methods that are activated on your PayMongo account (Settings → Payment Methods), then press **Save methods**.
5. **Test.** Make a test purchase. Test mode uses no real money.
6. **Go live.** Switch to `PAYMONGO_SECRET_KEY=sk_live_...`, add `PAYMONGO_LIVE_CONFIRMED=true`, restart, and register the webhook again.

Optional settings:
- `PAYMONGO_WEBHOOK_SECRET` — use this instead of registering the webhook from the dashboard.
- `PAYMONGO_METHODS` — the default payment methods: `gcash,paymaya,qrph,card`.

The tab also shows:
- the shop's status and what is still missing
- your key, masked so it is never shown in full
- the webhook address
- a **Test connection** button
- every sale with its status, method and notes

## Tests

`server/test/gods2.test.js` uses a local fake PayMongo API with the same shapes. It covers:
- the shop is closed when not configured
- the free trial
- no coin or orb unlocks
- the full checkout → signed webhook → server check → ownership flow
- bad and replayed signatures, an early webhook, a duplicate event, a wrong amount
- a missed webhook recovered by "check", restore, the bundle, and another player's purchase staying private
- the owner panel being owner-only
- all 10 skills in all 3 forms, both ultimates and the forms
- the Infinite Void: entry, isolation from bystanders, copies, damage, safe return, God Portal dying inside, the 3-dimension final form, and PvP replay

The full suite has 94 tests, all passing.

## Balance

Win rate against the **12 strongest balls** at Lv 30. These are owned balls, so all forms are always unlocked:

| Ball | Base | Awakened | Final God |
|---|---|---|---|
| God of Guns | 50% | 64% | 83% |
| God Portal | 53% | 81% | ~94% |

God Portal's final form is about as strong as the strongest free God Ball final forms.
