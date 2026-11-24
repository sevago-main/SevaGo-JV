'use strict';
const { getClientIp, hashIp, originAllowed, send, readBody } = require('./_lib/security');
const { shortText } = require('./_lib/validate');

/**
 * Conversion events from the website. No database: each valid event is written as one JSON line to the
 * Vercel runtime logs (Vercel -> Logs, or a log drain), tagged "sevago_event". No personal data is
 * included, only the event, platform, anonymous session id, page source and a salted hash used for
 * rate limiting. This endpoint can never fail because of the waitlist's storage.
 */
const EVENTS = new Set([
  'download_view', 'play_store_click', 'partner_play_click', 'sticky_cta_click', 'app_store_click', 'waitlist_cta_click',
  'waitlist_open', 'waitlist_start', 'waitlist_submit', 'waitlist_success',
  'waitlist_duplicate', 'waitlist_error',
]);
const PLATFORMS = new Set(['android', 'ios', 'desktop', 'other']);
const MAX_EVENTS_PER_10_MIN = 120;
const WINDOW_MS = 10 * 60 * 1000;
const seen = new Map();

function makeHandler(deps = {}) {
  const env = deps.env || process.env;
  const log = deps.log || ((line) => console.log(line));
  const now = deps.now || (() => Date.now());

  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { ok: false }, { Allow: 'POST' });
    if (!originAllowed(req, env)) return send(res, 403, { ok: false });
    const body = readBody(req);
    if (!body || !EVENTS.has(body.event) || !PLATFORMS.has(body.platform) ||
        typeof body.sessionId !== 'string' || !/^[a-z0-9-]{8,64}$/i.test(body.sessionId)) {
      return send(res, 400, { ok: false });
    }
    const ipHash = hashIp(getClientIp(req), env.IP_HASH_SALT || env.WAITLIST_WEBHOOK_SECRET || 'sevago-track');
    const t = now();
    const list = (seen.get(ipHash) || []).filter((x) => t - x < WINDOW_MS);
    if (list.length >= MAX_EVENTS_PER_10_MIN) return send(res, 429, { ok: false });
    list.push(t);
    seen.set(ipHash, list);
    if (seen.size > 5000) seen.clear();
    log(JSON.stringify({ tag: 'sevago_event', event: body.event, platform: body.platform, session: body.sessionId, source: shortText(body.source, 60) || '', at: new Date(t).toISOString() }));
    return send(res, 204);
  };
}

module.exports = makeHandler();
module.exports.makeHandler = makeHandler;
module.exports.EVENTS = EVENTS;
module.exports._reset = () => seen.clear();
