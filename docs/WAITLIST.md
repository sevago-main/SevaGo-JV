# iOS waitlist (Google Sheets)

Sign-ups go from the website form to a **private Google Sheet**. There is no database: nothing here touches AWS, the SevaGo app backend or any app data.

```
Browser form --> /api/waitlist (Vercel, validates + spam checks) --> Google Apps Script (secret, lock, dedupe) --> private Sheet
```

The Sheet is never shared and has no public link. The Apps Script web app runs *as you* and only accepts calls that carry a long shared secret, so the web-app URL alone reveals nothing and writes nothing.

## Setup (about 10 minutes, once)

1. **Create the Sheet.** In Google Sheets create a blank spreadsheet named e.g. "SevaGo iOS waitlist". Leave sharing as *Restricted* (only you).
2. **Add the script.** In the Sheet: Extensions -> Apps Script. Replace the contents of `Code.gs` with `google-apps-script/Code.gs` from this repo. Save.
3. **Set the secret.** Apps Script -> Project Settings (gear) -> Script properties -> Add: name `WAITLIST_SECRET`, value a random string of 32+ characters (e.g. run `openssl rand -hex 32`). Keep a copy for step 5.
4. **Deploy.** Deploy -> New deployment -> type *Web app*. Description: `waitlist`. **Execute as: Me.** **Who has access: Anyone** (the Vercel server has no Google login, so it must be "Anyone"; the secret is what protects it, and the Sheet itself stays private). Deploy, approve the permission prompt once, and copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).
5. **Set Vercel variables** (Project -> Settings -> Environment Variables, Production):
   - `WAITLIST_WEBHOOK_URL` = the Web app URL
   - `WAITLIST_WEBHOOK_SECRET` = the same secret as step 3
   - optional: `IP_HASH_SALT` (random 32+ chars; otherwise one is derived from the secret)
   - optional: `ALLOWED_ORIGINS` (defaults to `https://sevago.co.in,https://www.sevago.co.in`)
   You can delete the old `DATABASE_*`, `ADMIN_EXPORT_TOKEN`, `IP_HASH_SALT` (if unused) and `WAITLIST_AUTO_MIGRATE` variables.
6. **Redeploy** (variables only apply to new deployments).
7. **Check:** `curl https://sevago.co.in/api/health` should return `{"ok":true,"checks":{"webhook_url_set":true,"webhook_secret_set":true,"script":"ok"}}`.
8. **Test:** submit the form with a test name/email, open the Sheet and confirm a new row in the `Waitlist` tab (created automatically). Submit the same email again: the form says "You're already on the waitlist." and the row's *Duplicate attempts* becomes 1. Delete the test row.

**If you change `Code.gs` later:** Deploy -> Manage deployments -> Edit (pencil) -> Version: New version -> Deploy. The URL stays the same.

## What is saved (tab `Waitlist`)

| Column | Notes |
|---|---|
| Registered at (IST) / (UTC) | server time of the first registration |
| Name, Phone or email, Type, City | contact is normalised (`+919876543210`, lower-case email) and is the duplicate key |
| Notification consent | always `Yes` (a sign-up without consent is rejected) |
| Consent text version | `ios-waitlist-v1`, so you can prove which wording was agreed |
| Status | `Registered`, or `Registered, duplicate attempted` |
| Duplicate attempts / Last duplicate attempt (IST) | updated on the original row; no extra rows or extra personal data |
| Source | `utm_source` or referrer host |

Everything is written as plain text, so a name or email can never be run as a spreadsheet formula. IP addresses are **not** stored. A salted hash is used only for rate limiting and is not written to the Sheet.

**Viewing and exporting:** open the Sheet. File -> Download -> CSV (or Excel). To control who can see it, use the Sheet's normal Share settings (keep it to a few named people).

## Protection against spam and duplicates

- Server (`api/waitlist.js`): allowed-origin check, JSON only, 4 KB body limit, hidden honeypot field, minimum fill time (1.5 s), strict validation of name, city, email/phone and consent, per-visitor limit.
- Apps Script: re-validates everything, shared rate limit per visitor (6 per 10 min) and a global cap of 300 sign-ups per hour, all inside a script lock, so two simultaneous identical sign-ups can only ever create one row.
- The secret is only sent to `script.google.com` / `googleusercontent.com`; any other URL is refused. The secret and URL are never logged or returned to browsers.

## Visitor messages

| Situation | Message |
|---|---|
| Saved | "You're on the list. We'll notify you when SevaGo launches on iOS." |
| Already registered | "You're already on the waitlist." |
| Bad field | inline message under that field |
| Too many attempts | "Too many attempts from this device. Please wait a few minutes and try again." |
| Our setup problem (503) | "Sign-ups are temporarily unavailable on our side. Your details were not saved..." |
| No connection | "We couldn't reach SevaGo. Check your internet connection and try again." |

## Troubleshooting with `/api/health`

| `script` value | Meaning | Fix |
|---|---|---|
| `ok` | everything wired | none |
| `not_checked` | URL or secret missing in Vercel | step 5, then redeploy |
| `sheet_misconfigured` | Google returned a web page, not JSON: wrong URL or "Who has access" is not *Anyone*, or the deployment is stale | redo step 4; copy the URL again |
| `sheet_unauthorized` | secret in Vercel differs from the script property | make `WAITLIST_SECRET` and `WAITLIST_WEBHOOK_SECRET` identical |
| `sheet_not_configured` | `WAITLIST_SECRET` not set in the script | step 3 |
| `sheet_unreachable` | timeout or network | retry; check Google status |
| `sheet_busy` / `sheet_error` | script under heavy load / crashed | check Apps Script -> Executions |
| `server_misconfigured` | URL is not a Google Apps Script URL, or secret shorter than 16 chars | steps 3-5 |

## Conversion tracking

`/api/track` no longer uses any database. Each event is one JSON line in the Vercel runtime logs (`sevago_event`, with event, platform, anonymous session and page source; no personal data). View it in Vercel -> Logs (search `sevago_event`), or attach a log drain for longer retention. The `waitlist_success` / `waitlist_duplicate` events plus the Sheet's row count give you views -> sign-ups. Events are also pushed to `dataLayer`/`gtag` if you add Google Tag Manager or Analytics.

## Before going live

- The privacy policy must mention the waitlist (name, phone or email, city, consent, stored in Google Sheets / Google Workspace, deletion on request). The CA-reviewed text does not yet.
- Decide who may open the Sheet, and delete rows when someone asks.
- Google Apps Script has quotas (consumer accounts: about 20,000 web-app calls/day, plus 6 minutes per execution); a Google Workspace account has higher limits. Plenty for a waitlist.
