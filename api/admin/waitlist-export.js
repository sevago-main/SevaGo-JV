'use strict';
const { safeEqual, csvCell, send } = require('../_lib/security');
const { getDb } = require('../_lib/db');
const { classifyDbError, statusFor } = require('../_lib/errors');

const COLUMNS = [
  'id', 'created_at', 'name', 'contact_type', 'contact_normalized', 'city',
  'consent', 'consent_at', 'consent_text_version', 'source',
  'utm_source', 'utm_medium', 'utm_campaign', 'notified_at',
];
const MAX_ROWS = 100000;
const failures = new Map(); // per-instance brute-force throttle: ip -> { n, until }

function throttled(ip, now) {
  const f = failures.get(ip);
  return !!(f && f.until > now && f.n >= 5);
}
function noteFailure(ip, now) {
  const f = failures.get(ip) || { n: 0, until: 0 };
  f.n += 1;
  f.until = now + 15 * 60 * 1000;
  failures.set(ip, f);
}

function toCsv(rows) {
  const lines = [COLUMNS.join(',')];
  for (const r of rows) lines.push(COLUMNS.map((c) => csvCell(r[c])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n'; // BOM so Excel reads UTF-8 names correctly
}

function makeHandler(deps = {}) {
  const env = deps.env || process.env;
  const getDatabase = deps.getDb || (() => getDb(env));
  const now = deps.now || (() => Date.now());

  return async function handler(req, res) {
    if (req.method !== 'GET') return send(res, 405, { ok: false }, { Allow: 'GET' });
    const token = env.ADMIN_EXPORT_TOKEN;
    if (!token || token.length < 32) return send(res, 503, { ok: false, error: 'admin_not_configured' });

    const h = req.headers || {};
    const ip = String(h['x-vercel-forwarded-for'] || h['x-real-ip'] || 'unknown').split(',')[0].trim();
    if (throttled(ip, now())) return send(res, 429, { ok: false, error: 'too_many_attempts' });

    const m = /^Bearer (.+)$/.exec(h.authorization || '');
    if (!m || !safeEqual(m[1], token)) {
      noteFailure(ip, now());
      return send(res, 401, { ok: false, error: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
    }
    failures.delete(ip);

    const url = new URL(req.url || '/', 'http://localhost');
    const db = getDatabase();
    try {
      if (url.searchParams.get('view') === 'list') {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit'), 10) || 100, 1), 500);
        const rows = await db.query(
          'SELECT id, created_at, name, contact_type, contact_normalized, city, source FROM ios_waitlist ORDER BY id DESC LIMIT ' + limit);
        const total = await db.query('SELECT count(*)::int AS n FROM ios_waitlist');
        return send(res, 200, { ok: true, total: total.rows[0].n, shown: rows.rows.length, rows: rows.rows });
      }
      if (url.searchParams.get('view') === 'summary') {
        const days = Math.min(Math.max(parseInt(url.searchParams.get('days'), 10) || 30, 1), 365);
        const ev = await db.query(
          `SELECT event, count(DISTINCT session_id)::int AS sessions
             FROM waitlist_events WHERE created_at > $1 GROUP BY event`, [new Date(now() - days * 24 * 3600 * 1000)]);
        const total = await db.query('SELECT count(*)::int AS n FROM ios_waitlist');
        const byCity = await db.query(
          'SELECT city, count(*)::int AS n FROM ios_waitlist GROUP BY city ORDER BY n DESC LIMIT 10');
        const sessions = Object.fromEntries(ev.rows.map((r) => [r.event, r.sessions]));
        const views = sessions.download_view || 0;
        const success = sessions.waitlist_success || 0;
        return send(res, 200, {
          ok: true, days, totalSignups: total.rows[0].n, sessions,
          conversionRate: views ? Math.round((success / views) * 10000) / 100 : null,
          topCities: byCity.rows,
        });
      }

      const result = await db.query(
        `SELECT ${COLUMNS.join(', ')} FROM ios_waitlist ORDER BY id LIMIT ${MAX_ROWS}`);
      console.log('waitlist export', result.rows.length, 'rows');
      const stamp = new Date(now()).toISOString().slice(0, 10);
      return send(res, 200, toCsv(result.rows), {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sevago-ios-waitlist-${stamp}.csv"`,
      });
    } catch (err) {
      const kind = classifyDbError(err);
      console.error('export failed:', kind);
      return send(res, statusFor(kind), { ok: false, error: kind });
    }
  };
}

module.exports = makeHandler();
module.exports.makeHandler = makeHandler;
module.exports.toCsv = toCsv;
