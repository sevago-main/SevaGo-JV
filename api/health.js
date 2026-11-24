'use strict';
const { send } = require('./_lib/security');
const { callScript, SheetError } = require('./_lib/sheets');

/**
 * GET /api/health: is the waitlist wired up? Shows only yes/no style facts, never URLs or secrets.
 *   { ok, checks: { webhook_url_set, webhook_secret_set, script } }
 * where script is "ok" or the failure kind (sheet_unreachable, sheet_misconfigured, sheet_unauthorized ...).
 * It pings the Apps Script; it does not read or write any registration.
 */
function makeHandler(deps = {}) {
  const env = deps.env || process.env;
  return async function handler(req, res) {
    if (req.method !== 'GET') return send(res, 405, { ok: false }, { Allow: 'GET' });
    const checks = {
      webhook_url_set: !!env.WAITLIST_WEBHOOK_URL,
      webhook_secret_set: !!(env.WAITLIST_WEBHOOK_SECRET && env.WAITLIST_WEBHOOK_SECRET.length >= 16),
      script: 'not_checked',
    };
    let ok = false;
    if (checks.webhook_url_set && checks.webhook_secret_set) {
      try { await callScript(env, { action: 'ping' }, deps.fetch); checks.script = 'ok'; ok = true; }
      catch (err) { checks.script = err instanceof SheetError ? err.kind : 'server_error'; }
    }
    return send(res, ok ? 200 : 503, { ok, checks });
  };
}

module.exports = makeHandler();
module.exports.makeHandler = makeHandler;
