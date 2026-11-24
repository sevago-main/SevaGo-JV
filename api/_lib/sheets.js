'use strict';

const TIMEOUT_MS = 9000;

class SheetError extends Error {
  constructor(kind, status) { super(kind); this.kind = kind; this.status = status || 503; }
}

/**
 * POSTs one JSON message to the Google Apps Script web app (it answers via a redirect that fetch follows).
 * Throws SheetError with a stable, non-sensitive `kind`. The URL and secret are never logged or returned.
 */
async function callScript(env, payload, fetchImpl) {
  const url = env.WAITLIST_WEBHOOK_URL, secret = env.WAITLIST_WEBHOOK_SECRET;
  if (!url || !secret || secret.length < 16) throw new SheetError('server_misconfigured', 503);
  let host;
  try { host = new URL(url); } catch (e) { throw new SheetError('server_misconfigured', 503); }
  if (host.protocol !== 'https:' || !/(^|\.)google\.com$|(^|\.)googleusercontent\.com$/.test(host.hostname)) {
    throw new SheetError('server_misconfigured', 503); // refuse to send the secret anywhere but Google
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res, text;
  try {
    res = await (fetchImpl || fetch)(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS preflight in Apps Script
      body: JSON.stringify(Object.assign({ secret }, payload)),
      redirect: 'follow',
      signal: ctl.signal,
    });
    text = await res.text();
  } catch (e) {
    throw new SheetError('sheet_unreachable', 503);
  } finally {
    clearTimeout(timer);
  }

  let data;
  try { data = JSON.parse(text); } catch (e) { throw new SheetError('sheet_misconfigured', 503); } // HTML = login/permission/URL problem
  if (data && data.ok) return data;
  switch (data && data.error) {
    case 'rate_limited': throw new SheetError('rate_limited', 429);
    case 'invalid': case 'bad_request': throw new SheetError('invalid', 400);
    case 'unauthorized': throw new SheetError('sheet_unauthorized', 503);
    case 'not_configured': throw new SheetError('sheet_not_configured', 503);
    case 'busy': throw new SheetError('sheet_busy', 503);
    default: throw new SheetError('sheet_error', 503);
  }
}

module.exports = { callScript, SheetError };
