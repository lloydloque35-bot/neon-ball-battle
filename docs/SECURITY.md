# Security & anti-cheat model

## Principles
- **The server is the authority.** HP, battle results, coins, EXP, unlocks, premium status and admin rights are never accepted from the browser.
- **Secrets never reach the browser.** Stripe keys, webhook secrets and API keys live in server environment variables only.
- **Least privilege:**
  - Two roles exist: `player` and `owner`.
  - The database enforces a single owner.
  - No API creates or changes a role; the owner is created only with the server CLI.
  - Premium is a subscription status, not a role, and never grants admin.

## Accounts & sessions
| Control | Implementation |
|---|---|
| Password hashing | scrypt (N=32768, r=8, p=1, 16-byte salt) |
| Password policy | 10–128 characters, common passwords and the username are rejected |
| Sessions | 256-bit random token in an `HttpOnly; SameSite=Strict` cookie (also `Secure` in production). Only its SHA-256 is stored. The owner's session lasts at most 12 hours. |
| CSRF | Per-session token required on every state-changing request, plus Origin checking |
| Two-factor authentication | TOTP (RFC 6238). Required for the owner, optional for players. A used code is rejected if replayed. |
| Owner dashboard | Owner role, 2FA enabled, and 2FA verified within 30 minutes (sliding), checked by the server on every admin request |
| Brute force | Per-IP and per-account rate limits. The account locks for 15 minutes after 8 failed logins. Unknown users take the same time to reject as real ones (no username probing). |
| Recovery | 10 single-use recovery codes (stored hashed), optional email reset links (1 hour, single use) |
| Bans / suspensions | A ban deletes all sessions and blocks sign-in. A suspension blocks battles and the economy until it expires. The owner cannot be banned. |
| Headers | CSP (`script-src 'self'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production |
| Static files | Whitelist: only the game's front-end files and `assets/` are served. `server/`, `.env` and the database are never served. |
| Audit | Owner actions, logins, payments and account security changes are logged in `audit_logs`. Suspicious activity is logged in `security_events`. |

## Anti-cheat: server-verified battles
1. The player asks to start a battle. The server checks the player may use that ball, picks the opponents, the levels and the **random seed** (crypto RNG), and stores a *ticket* together with a snapshot of the ball catalog.
2. The browser plays the battle with exactly that ticket. Player actions (steering, abilities, ultimate, auto/manual switches) are queued and applied on fixed 1/240 s simulation steps, and recorded.
3. At the end the browser sends **only the recorded inputs** and its claimed result.
4. A worker thread on the server re-runs the same deterministic simulation from the ticket and the inputs. **The server's result decides the rewards.** A different claimed result is logged as a `battle_mismatch` security event.
5. Results that arrive faster than the game can run (3× maximum speed) are rejected. Each ticket can be submitted once. Starting a new ranked battle while one is open counts the open one as a loss, which stops players fishing for good random seeds.

**Determinism across browsers.**
- Battle logic draws only from a seeded random generator, so visual effects can never change the outcome.
- It uses portable sin/cos/exp/atan2 built from `+ − × ÷ √`. These are bit-identical in every JavaScript engine, while engine-provided `Math.sin` and friends are not.
- Tests confirm that live Chrome battles replay bit-for-bit in Node.

**Known limits:**
- Battles are against the AI, so a determined cheater could run the simulation offline to choose good manual inputs, the equivalent of a "bot". The verified result is still a real, legal battle, so it can never award more than an honestly played game.
- Single-player battles are against the AI, so a determined cheater could run the simulation offline to choose good manual inputs.

## Online PvP
- **Connecting:** the WebSocket needs the session cookie and a same-site `Origin`. Suspended and banned accounts are refused, and each account has one live connection.
- **The match:** the server builds the match from each player's server-side progress. Browsers only send their own button presses. These are validated, must arrive in block order, and are rate-limited.
- **The result:** the server re-simulates every match, and only its result changes rank points or rewards.
- **Protocol abuse:** the player is dropped (their ball finishes on AUTO) and the event is logged.
- **Known limit:** both browsers know the whole battle state (lockstep). A modified client could show or predict more than the normal UI does, but it cannot change the outcome beyond pressing buttons.

## Economy
- Every purchase, upgrade, evolution, skill-tree node, summon, claim, cosmetic and fusion runs in a database transaction that re-reads the balance.
- Coin spending is a conditional `UPDATE … WHERE coins >= price`. Tests confirm that parallel requests cannot double-spend.
- Server-side rolls (summons, opponents, seeds) use `crypto.randomInt`.

## Payments
- Stripe Checkout is hosted by Stripe, so no card data touches this server.
- Premium is activated **only** by a webhook with a valid signature (HMAC-SHA256, 5-minute tolerance).
- Every event id is processed exactly once, and payment references are unique.
- Test-mode events are ignored in live mode and vice versa.
- The server refuses to start with a live key unless `PAYMENTS_MODE=live` **and** `PAYMENTS_LIVE_CONFIRMED=true` **and** production HTTPS settings are all set.
- Refunds remove Premium immediately, and expiration is enforced on every request.

## Reporting
If you find a vulnerability, contact the owner privately; do not open a public issue.
