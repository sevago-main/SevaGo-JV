'use strict';
const { getClientIp, hashIp, originAllowed, send, readBody } = require('./_lib/security');
const { shortText } = require('./_lib/validate');
const { getDb } = require('./_lib/db');

const EVENTS = new Set([
  'download_view', 'play_store_click', 'partner_play_click', 'sticky_cta_click', 'app_store_click', 'waitlist_cta_click',
  'waitlist_open', 'waitlist_start', 'waitlist_submit', 'waitlist_success',
  'waitlist_duplicate', 'waitlist_error',
]);
const PLATFORMS = new Set(['android', 'ios', 'desktop', 'other']);
const MAX_EVENTS_PER_10_MIN = 120;

function makeHandler(deps = {}) {
  const env = deps.env || process.env;
  const getDatabase = deps.getDb || (() => getDb(env));

  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { ok: false }, { Allow: 'POST' });
    if (!originAllowed(req, env)) return send(res, 403, { ok: false });
    const body = readBody(req);
    if (!body || !EVENTS.has(body.event) || !PLATFORMS.has(body.platform) ||
        typeof body.sessionId !== 'string' || !/^[a-z0-9-]{8,64}$/i.test(body.sessionId)) {
      return send(res, 400, { ok: false });
    }
    if (!env.IP_HASH_SALT || env.IP_HASH_SALT.length < 16) return send(res, 500, { ok: false });
    const ipHash = hashIp(getClientIp(req), env.IP_HASH_SALT);
    const db = getDatabase();
    try {
      const recent = await db.query(
        `SELECT count(*)::int AS n FROM waitlist_events
          WHERE ip_hash = $1 AND created_at > $2`, [ipHash, new Date(Date.now() - 10 * 60 * 1000)]);
      if (recent.rows[0].n >= MAX_EVENTS_PER_10_MIN) return send(res, 429, { ok: false });
      await db.query(
        'INSERT INTO waitlist_events (event, platform, session_id, source, ip_hash) VALUES ($1,$2,$3,$4,$5)',
        [body.event, body.platform, body.sessionId, shortText(body.source, 60), ipHash]);
      return send(res, 204);
    } catch (err) {
      console.error('track failed', err && (err.code || err.message));
      return send(res, 500, { ok: false });
    }
  };
}

module.exports = makeHandler();
module.exports.makeHandler = makeHandler;
module.exports.EVENTS = EVENTS;
