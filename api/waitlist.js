'use strict';
const { validateName, validateCity, normalizeContact, shortText } = require('./_lib/validate');
const { getClientIp, hashIp, originAllowed, send, readBody } = require('./_lib/security');
const { getDb } = require('./_lib/db');
const { resolveSalt, classifyDbError, statusFor } = require('./_lib/errors');
const { ensureSchema } = require('./_lib/schema');

const CONSENT_VERSION = 'ios-waitlist-v1';
const MIN_FILL_MS = 1500;      // a human can't read, fill and tick consent faster than this
const WINDOW_MINUTES = 10;
const MAX_ATTEMPTS_PER_WINDOW = 6;

async function run(db, body, req, ipHash) {
  const name = validateName(body.name);
  const contact = normalizeContact(body.contact);
  const city = validateCity(body.city);

  const recent = await db.query(
    'SELECT count(*)::int AS n FROM waitlist_attempts WHERE ip_hash = $1 AND created_at > $2',
    [ipHash, new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)]
  );
  if (recent.rows[0].n >= MAX_ATTEMPTS_PER_WINDOW) {
    return { status: 429, body: { ok: false, error: 'rate_limited' }, headers: { 'Retry-After': String(WINDOW_MINUTES * 60) } };
  }
  await db.query('INSERT INTO waitlist_attempts (ip_hash) VALUES ($1)', [ipHash]);
  if (Math.random() < 0.02) {
    await db.query('DELETE FROM waitlist_attempts WHERE created_at < $1', [new Date(Date.now() - 7 * 24 * 3600 * 1000)]);
  }

  // Fast path for the common case. The unique index + ON CONFLICT below still guards concurrent requests.
  const existing = await db.query('SELECT 1 FROM ios_waitlist WHERE contact_normalized = $1 LIMIT 1', [contact.normalized]);
  if (existing.rows.length) return { status: 200, body: { ok: true, status: 'duplicate' } };

  const ins = await db.query(
    `INSERT INTO ios_waitlist
       (name, contact_type, contact_normalized, city, consent, consent_text_version,
        source, utm_source, utm_medium, utm_campaign, user_agent, ip_hash)
     VALUES ($1,$2,$3,$4,TRUE,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (contact_normalized) DO NOTHING
     RETURNING id`,
    [
      name, contact.type, contact.normalized, city, CONSENT_VERSION,
      shortText(body.source, 60), shortText(body.utm_source, 80), shortText(body.utm_medium, 80),
      shortText(body.utm_campaign, 120), shortText((req.headers || {})['user-agent'], 300), ipHash,
    ]
  );
  const created = ins.rows.length > 0;
  return { status: created ? 201 : 200, body: { ok: true, status: created ? 'created' : 'duplicate' } };
}

function makeHandler(deps = {}) {
  const env = deps.env || process.env;
  const getDatabase = deps.getDb || (() => getDb(env));

  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
    if (!originAllowed(req, env)) return send(res, 403, { ok: false, error: 'forbidden' });
    if (!/^application\/json/i.test((req.headers || {})['content-type'] || '')) {
      return send(res, 415, { ok: false, error: 'unsupported_media_type' });
    }
    const body = readBody(req);
    if (!body || typeof body !== 'object') return send(res, 400, { ok: false, error: 'invalid_body' });

    // Honeypot: real users never see this field. Pretend success so bots learn nothing.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return send(res, 200, { ok: true, status: 'created' });
    }

    // Validate the visitor's input first, so people get field-level help even if our side is misconfigured.
    const elapsed = Number(body.elapsedMs);
    if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return send(res, 400, { ok: false, error: 'too_fast' });
    const fields = {};
    if (!validateName(body.name)) fields.name = 'Enter your name (letters only).';
    if (!normalizeContact(body.contact)) fields.contact = 'Enter a valid email or 10-digit mobile number.';
    if (!validateCity(body.city)) fields.city = 'Enter your city.';
    if (body.consent !== true) fields.consent = 'Please tick the box so we can notify you.';
    if (Object.keys(fields).length) return send(res, 422, { ok: false, error: 'validation', fields });

    const salt = resolveSalt(env);
    if (!salt) {
      console.error('waitlist: neither IP_HASH_SALT nor DATABASE_URL is configured');
      return send(res, 503, { ok: false, error: 'server_misconfigured' });
    }
    const ipHash = hashIp(getClientIp(req), salt);

    try {
      const db = getDatabase();
      try {
        const out = await run(db, body, req, ipHash);
        return send(res, out.status, out.body, out.headers);
      } catch (err) {
        // Opt-in self-healing: create our three tables once if they were never migrated.
        if (classifyDbError(err) === 'schema_missing' && env.WAITLIST_AUTO_MIGRATE === 'true') {
          await ensureSchema(db);
          const out = await run(db, body, req, ipHash);
          return send(res, out.status, out.body, out.headers);
        }
        throw err;
      }
    } catch (err) {
      const kind = classifyDbError(err);
      console.error('waitlist failed:', kind, err && err.code ? '(' + err.code + ')' : '');
      return send(res, statusFor(kind), { ok: false, error: kind });
    }
  };
}

module.exports = makeHandler();
module.exports.makeHandler = makeHandler;
module.exports.CONSENT_VERSION = CONSENT_VERSION;
