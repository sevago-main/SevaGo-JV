'use strict';
const { safeEqual, send } = require('./_lib/security');
const { getDb } = require('./_lib/db');
const { resolveSalt, classifyDbError } = require('./_lib/errors');

/**
 * GET /api/health
 *  - public: only {ok:true|false}
 *  - with `Authorization: Bearer <ADMIN_EXPORT_TOKEN>`: which pieces are configured/working
 *    (booleans and error codes only, never values).
 */
function makeHandler(deps = {}) {
  const env = deps.env || process.env;
  const getDatabase = deps.getDb || (() => getDb(env));
  return async function handler(req, res) {
    if (req.method !== 'GET') return send(res, 405, { ok: false }, { Allow: 'GET' });
    const m = /^Bearer (.+)$/.exec((req.headers || {}).authorization || '');
    const admin = !!(env.ADMIN_EXPORT_TOKEN && env.ADMIN_EXPORT_TOKEN.length >= 32 && m && safeEqual(m[1], env.ADMIN_EXPORT_TOKEN));

    const checks = {
      DATABASE_URL: !!env.DATABASE_URL,
      DATABASE_CA_or_NO_VERIFY: !!(env.DATABASE_CA || env.DATABASE_SSL_NO_VERIFY === 'true'),
      IP_HASH_SALT: !!(env.IP_HASH_SALT && env.IP_HASH_SALT.length >= 16),
      salt_available: !!resolveSalt(env),
      ADMIN_EXPORT_TOKEN: !!(env.ADMIN_EXPORT_TOKEN && env.ADMIN_EXPORT_TOKEN.length >= 32),
      database: 'not_checked',
      tables: 'not_checked',
    };
    let ok = checks.DATABASE_URL && checks.salt_available;
    if (checks.DATABASE_URL) {
      try {
        const db = getDatabase();
        await db.query('SELECT 1');
        checks.database = 'ok';
        const missing = [];
        for (const tbl of ['ios_waitlist', 'waitlist_attempts', 'waitlist_events']) {
          try { await db.query('SELECT 1 FROM ' + tbl + ' LIMIT 1'); } catch (e) { missing.push(tbl); }
        }
        checks.tables = missing.length ? 'missing or no access: ' + missing.join(', ') + ' (run db/schema.sql or npm run migrate)' : 'ok';
        if (missing.length) ok = false;
      } catch (err) { checks.database = classifyDbError(err); ok = false; }
    }
    return send(res, ok ? 200 : 503, admin ? { ok, checks } : { ok });
  };
}

module.exports = makeHandler();
module.exports.makeHandler = makeHandler;
