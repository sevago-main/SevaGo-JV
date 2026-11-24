# iOS waitlist + download section

## What was added

| Piece | File |
|---|---|
| Download panel (Play + iOS waitlist) in the "Get the app" section | `index.html`, `css/download.css`, `js/download.js` |
| Waitlist API (validation, dedupe, spam checks) | `api/waitlist.js` |
| Funnel tracking API | `api/track.js` |
| Admin CSV export + funnel summary API | `api/admin/waitlist-export.js` |
| Admin page (token prompt, CSV download, funnel) | `admin/waitlist.html` -> `/admin/waitlist` |
| PostgreSQL schema | `db/schema.sql` |
| iOS button switch | `site-config.json` |
| Tests | `tests/` (`npm test`) |

## One-time setup

1. **Create the tables** on the AWS PostgreSQL database:
   `psql "$DATABASE_URL" -f db/schema.sql`
   Use a dedicated DB user that only has `SELECT, INSERT, DELETE` on these three tables.
2. **Set environment variables** in Vercel (Project -> Settings -> Environment Variables, Production + Preview). See `.env.example`.
   - `DATABASE_URL`, `DATABASE_CA` (RDS CA bundle PEM, so TLS is verified)
   - `IP_HASH_SALT`, `ADMIN_EXPORT_TOKEN` (generate with `openssl rand -hex 32`)
   - `ALLOWED_ORIGINS` (defaults to sevago.co.in and www.sevago.co.in)
3. **Network access.** Vercel functions do not have a fixed IP. Either allow the RDS instance to be reached publicly with TLS + a strong password, or put it behind RDS Proxy / a public endpoint restricted another way. Ask whoever owns the AWS account which they prefer.
4. Deploy. `npm install` runs automatically because of `package.json`.

## Switching iOS to the App Store after approval

Edit `site-config.json` and push:

```json
{ "ios": { "mode": "appstore", "appStoreUrl": "https://apps.apple.com/in/app/sevago/idXXXXXXXXXX" } }
```

The iOS card turns into a gold "Download on the App Store" button and the form is hidden. Only `https://apps.apple.com/...` or `https://itunes.apple.com/...` links are accepted; anything else keeps the waitlist. Set `"mode": "waitlist"` to go back.

## How spam and duplicates are handled

- Unique index on the normalised contact (lower-cased email, or `+91XXXXXXXXXX`), so `98765 43210`, `+91 98765-43210` and `09876543210` are one person.
- Hidden honeypot field, minimum fill time (1.5 s), Origin check, JSON-only, 4 KB body limit.
- Max 6 attempts per visitor per 10 minutes (visitor = HMAC of the IP; raw IPs are never stored).
- Consent is required, stored with a timestamp and the consent text version (`ios-waitlist-v1`).

## Conversion tracking

Events (unique sessions): `download_view`, `play_store_click`, `app_store_click`, `waitlist_open`, `waitlist_start`, `waitlist_submit`, `waitlist_success`, `waitlist_duplicate`, `waitlist_error`.
They are stored in `waitlist_events`, and also pushed to `window.dataLayer` / `gtag` if you add Google Tag Manager or GA later.
Open `/admin/waitlist` -> "Show funnel" for views -> joined and the conversion rate.

## Admin CSV export

`/admin/waitlist` asks for `ADMIN_EXPORT_TOKEN`, then downloads `sevago-ios-waitlist-YYYY-MM-DD.csv`.
Direct call: `curl -H "Authorization: Bearer $ADMIN_EXPORT_TOKEN" https://sevago.co.in/api/admin/waitlist-export -o waitlist.csv`.
Cells starting with `= + - @` are prefixed with `'` so spreadsheets do not run them as formulas.
This repo has no existing admin dashboard, so this is a standalone page. If you have a separate dashboard, link to it or call the same endpoint from there.

## Before going live

- **Update the Privacy Policy.** `privacy.html` currently says the website only collects what visitors send through the hiring form and chat assistant. The waitlist now collects name, phone/email, city and consent. The policy text must be updated by whoever owns the legal wording.
- Run a test sign-up on a Vercel preview deployment and download the CSV.


## Troubleshooting a failing form (production)

1. `curl https://sevago.co.in/api/health` returns only `{"ok":false}` when something is missing.
   With the admin token it says exactly what: `curl -H "Authorization: Bearer $ADMIN_EXPORT_TOKEN" https://sevago.co.in/api/health`
   (booleans and error codes only, never values).
2. The form now shows a specific reason instead of a generic failure. The API returns these `error` codes:

| Code | HTTP | Meaning | Fix |
|---|---|---|---|
| `server_misconfigured` | 503 | `DATABASE_URL` (and `IP_HASH_SALT`) missing in Vercel | Add the variables in Vercel -> Settings -> Environment Variables (Production) and **redeploy**. Variables only apply to new deployments. |
| `db_unreachable` | 503 | RDS refused or timed out | RDS security group / public access, endpoint, region |
| `db_auth_failed`, `db_not_found`, `db_permission_denied` | 503 | wrong user/password/database, or the role lacks rights | Fix the user; it needs SELECT, INSERT, DELETE on the 3 tables |
| `db_tls_failed` | 503 | TLS verification failed | Set `DATABASE_CA` to the RDS CA bundle PEM |
| `schema_missing` | 503 | tables not created | `DATABASE_URL=... npm run migrate`, or set `WAITLIST_AUTO_MIGRATE=true` once (needs CREATE rights), then unset it |
| `rate_limited` | 429 | 6 attempts in 10 min from one visitor | wait |
| `forbidden` | 403 | request not from an allowed origin | `ALLOWED_ORIGINS` (defaults to sevago.co.in and www) |
| `server_error` | 500 | unexpected | check Vercel function logs (codes only, no personal data) |

`IP_HASH_SALT` is now optional: if unset, a salt is derived from `DATABASE_URL`. `ADMIN_EXPORT_TOKEN` is still required for `/admin/waitlist` (view, funnel, CSV).

## Data protection
Stored: name, normalised email/phone, city, consent + timestamp + consent text version, hashed IP, user agent, UTM source. Raw IPs are never stored. Data is encrypted in transit (TLS, verified with `DATABASE_CA`). Encryption at rest, backups and access control are RDS settings: enable storage encryption on the instance, restrict the DB user to these three tables, and limit who holds `ADMIN_EXPORT_TOKEN`. The privacy policy must mention the waitlist.
