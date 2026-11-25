# Deployment, payments, backups and recovery

The game has two ways to run:

| Mode | How | What works |
|---|---|---|
| **Guest / offline** | Open `index.html` directly, or host the 3 front-end files on any static host | The full game: all modes, AI, collection, progression. Progress is saved in that browser only. No accounts, Premium, rankings or admin. |
| **Game server** | `npm start` (Node 22.5+) | Everything: accounts, cloud save, server-verified battles, rankings, Premium, fusion, cosmetics and the private Owner Dashboard. |

The server has **no third-party dependencies**. It uses Node's built-in HTTP server, SQLite (`node:sqlite`), crypto and worker threads, so there is nothing to `npm install`.

## 1. Local development

```bash
cp .env.example .env          # edit if needed; defaults work locally
npm test                      # 39 security, anti-cheat, billing and admin tests
npm start                     # http://localhost:8080
```

### Create the owner (admin) account

The owner can **only** be created on the server machine. There is no web page or API for it, and the database allows exactly one owner.

```bash
npm run owner -- create --username YourName
```

1. Enter a strong password twice.
2. Store the printed **recovery codes** offline.
3. Scan the 2FA secret into an authenticator app and type the 6-digit code to confirm.

Then sign in on the game's **Account** screen with your username, password and authenticator code, and open **♛ Admin Dashboard**. The dashboard asks for a fresh 2FA code after 30 minutes of inactivity (`ADMIN_MFA_MAX_AGE_MIN`).

Other owner commands:

```bash
npm run owner -- status
npm run owner -- reset-2fa        # lost phone
npm run owner -- reset-password   # signs out all owner sessions
```

## 2. Payments — sandbox first

Premium is **ULTIMATE PREMIUM, $200 USD / year (365 days)**, sold through Stripe Checkout as a yearly subscription. It renews automatically until the player turns renewal off, and this is disclosed on the Premium screen before checkout.

1. In the Stripe Dashboard, in **Test mode**:
   1. Create a product called "Ultimate Premium" with a **recurring price of 200.00 USD, billed yearly**. Copy the `price_...` id.
   2. Under Developers → API keys, copy the **test secret key** (`sk_test_...`).
   3. Under Developers → Webhooks, add an endpoint at `https://YOUR-DOMAIN/api/billing/webhook` with these events:
      - `checkout.session.completed`
      - `invoice.paid`
      - `invoice.payment_failed`
      - `customer.subscription.updated`
      - `customer.subscription.deleted`
      - `charge.refunded`

      Copy the signing secret (`whsec_...`).
2. Put these in `.env`:
   ```
   PAYMENTS_MODE=test
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID=price_...
   ```
3. For local webhook testing, use the Stripe CLI: `stripe listen --forward-to localhost:8080/api/billing/webhook`, and put the `whsec_` it prints in `.env`.
4. Buy Premium with test card `4242 4242 4242 4242`. Premium switches on only when the signed `invoice.paid` webhook arrives.

Test these before going live: refund from the Stripe dashboard (Premium is removed), turning renewal off in the game, a failed payment (card `4000 0000 0000 0341`), and an expiry. Expiry can be simulated by advancing a Stripe test clock.

### Going live — checklist (do not skip)

The server **refuses to start** in live mode until all of this is true:

- [ ] Stripe account activated: business details verified, bank account added, identity checks complete.
- [ ] Tax settings reviewed (sales tax / VAT for your players' countries; Stripe Tax can help).
- [ ] Terms of Service, Privacy Policy and refund policy published and linked from your site. Subscription auto-renewal terms are required in many places, including US state auto-renewal laws and EU consumer law.
- [ ] Live product and yearly $200 price created, with a live webhook endpoint for the same events.
- [ ] Production `.env`: `NODE_ENV=production`, `APP_ORIGIN=https://...`, `COOKIE_SECURE=true`, `PAYMENTS_MODE=live`, live `sk_live_`, `whsec_`, `price_`, and **`PAYMENTS_LIVE_CONFIRMED=true`**.
- [ ] One real purchase and refund done end-to-end with your own card.

Never put Stripe keys in front-end files. The browser only ever receives a Stripe-hosted checkout URL, and card details never reach this server.

## 3. Production deployment

Any Linux VPS or container host that runs Node 22.5+ works, for example a $5–10/month VPS. The game must be served over **HTTPS**.

```bash
# on the server
git clone <your repo> neon-ball-battle && cd neon-ball-battle
cp .env.example .env && nano .env     # production values (see above)
npm run migrate
npm run owner -- create --username YourName
npm start
```

**HTTPS reverse proxy (Caddy — automatic certificates):**
```
game.example.com {
    reverse_proxy 127.0.0.1:8080
}
```
Set `TRUST_PROXY=true` only when the game sits behind a proxy like this, so rate limits see real client IPs.
Online PvP uses a WebSocket at `/api/pvp/ws`, so the proxy must pass WebSocket upgrades. Caddy does this automatically; for nginx, add `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.

**Keep it running (systemd):**
```ini
# /etc/systemd/system/neon-ball-battle.service
[Unit]
Description=Neon Ball Battle game server
After=network.target
[Service]
WorkingDirectory=/opt/neon-ball-battle
ExecStart=/usr/bin/npm start
Restart=always
User=nbb
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now neon-ball-battle
journalctl -u neon-ball-battle -f      # logs
```

### Free hosting on alwaysdata (no server to manage)
Tested setup. The free plan asks for a card to verify the account, but the Free plan is not charged.
1. Create the account; its name becomes the address `https://<account>.alwaysdata.net`.
2. Under **Environment**, check that the Node.js version is 22 or newer (24 works).
3. **Remote access › SSH**:
   - Add your SSH public key, or set the SSH password.
   - Connect with `ssh <account>@ssh-<account>.alwaysdata.net`.
   - Run `git clone https://github.com/<you>/neon-ball-battle.git`.
4. **Create the owner.** Use a **new** owner account; never reuse a 2FA secret that has been shown anywhere:
   `cd neon-ball-battle && npm run owner -- create --username <name>`
   (you can set `NBB_OWNER_PASSWORD` to avoid the hidden password prompt).
5. **Web › Sites ›** your site: set **Type** to **Node.js** and fill in:
   - **Command:** `node --disable-warning=ExperimentalWarning server/index.js`
   - **Working directory:** `neon-ball-battle`
   - **Environment** (one line): `NODE_ENV=production APP_ORIGIN=https://<account>.alwaysdata.net TRUST_PROXY=true HOST=::`

   alwaysdata requires listening on IPv6 `::` (hence `HOST=::`). It provides `PORT` itself.
6. In the site's **SSL** tab, turn on forcing HTTPS. Sign-in cookies are `Secure`, so the game must be opened with `https://`.
7. **Updating later:** run `cd neon-ball-battle && git pull` over SSH, then restart the site. `data/` (the database) is not in git, so updates never touch it.

## 4. Database migrations

Migrations are numbered SQL files in `server/migrations/`, and each is applied once. They run automatically on start, or manually with `npm run migrate`. To change the schema, add a new file such as `002_something.sql`. Never edit a migration that has already shipped.

## 5. Backups

- **Manual / cron:** `npm run backup` writes a consistent snapshot to `BACKUP_DIR` and keeps the newest 30. Example cron entry, every 6 hours:
  `0 */6 * * * cd /opt/neon-ball-battle && /usr/bin/npm run backup >> data/backup.log 2>&1`
- **From the dashboard:** Owner Dashboard → Data → *Back up now*.
- **Off-site:** copy `BACKUP_DIR` to separate storage (e.g. `rclone` to S3/B2) every day. A backup on the same disk does not survive disk loss.
- **Export:** Owner Dashboard → Data → *Export JSON*. This is a readable export of all game data; password hashes and 2FA secrets are never included.

## 6. Error logging

Logs go to stdout/stderr with timestamps and levels (`LOG_LEVEL=debug|info|warn|error`); with systemd, read them with `journalctl`. Unexpected server errors are logged with a stack trace, and players only see a generic message.

Security-relevant events go to the `security_events` table and appear in Owner Dashboard → Audit & Security:
- lockouts, failed 2FA and denied admin attempts
- rejected or mismatched battles
- rate limiting
- bad webhook signatures

Every owner action and every payment change also goes to `audit_logs`.

## 7. Recovery runbook

| Situation | What to do |
|---|---|
| Server crashed | `systemctl restart neon-ball-battle`. SQLite WAL mode keeps committed data. Check `journalctl` for the cause. |
| Corrupted / lost database | Stop the server, then `npm run backup -- restore data/backups/<newest>.db`. The restore checks integrity first and keeps the old file. Start again. |
| Owner lost phone (2FA) | On the server: `npm run owner -- reset-2fa`, or sign in with a recovery code. |
| Owner forgot password | On the server: `npm run owner -- reset-password`. |
| Player lost password / phone | Player uses **Account → Recover account** with a recovery code, or the email reset (if `RESEND_API_KEY` is set). |
| Suspected leaked Stripe key | Roll the key in the Stripe dashboard, update `.env`, then restart. |
| Suspected leaked database | Rotate the Stripe webhook secret, force all users to sign in again (`DELETE FROM sessions;`) and notify players as your local law requires. Passwords are scrypt-hashed. |
| Webhook missed while offline | Stripe retries for 3 days. Each event is processed exactly once, so replays are safe. You can also resend events from the Stripe dashboard. |
