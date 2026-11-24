'use strict';
const { validateName, validateCity, normalizeContact, shortText } = require('./_lib/validate');
const { getClientIp, hashIp, originAllowed, send, readBody } = require('./_lib/security');
const { resolveSalt } = require('./_lib/errors');
const { callScript, SheetError } = require('./_lib/sheets');

const CONSENT_VERSION = 'ios-waitlist-v1';
const MIN_FILL_MS = 1500;          // a human can't read, fill and tick consent faster than this
const LOCAL_WINDOW_MS = 10 * 60 * 1000;
const LOCAL_MAX = 6;               // first-line limit per server instance; the Apps Script enforces the shared limit
const attempts = new Map();        // ipHash -> [timestamps]

function localLimited(ipHash, now) {
  const list = (attempts.get(ipHash) || []).filter((t) => now - t < LOCAL_WINDOW_MS);
  if (list.length >= LOCAL_MAX) { attempts.set(ipHash, list); return true; }
  list.push(now);
  attempts.set(ipHash, list);
  if (attempts.size > 5000) attempts.clear();
  return false;
}

function makeHandler(deps = {}) {
  const env = deps.env || process.env;
  const fetchImpl = deps.fetch;
  const now = deps.now || (() => Date.now());

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

    const elapsed = Number(body.elapsedMs);
    if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return send(res, 400, { ok: false, error: 'too_fast' });

    const name = validateName(body.name);
    const contact = normalizeContact(body.contact);
    const city = validateCity(body.city);
    const fields = {};
    if (!name) fields.name = 'Enter your name (letters only).';
    if (!contact) fields.contact = 'Enter a valid email or 10-digit mobile number.';
    if (!city) fields.city = 'Enter your city.';
    if (body.consent !== true) fields.consent = 'Please tick the box so we can notify you.';
    if (Object.keys(fields).length) return send(res, 422, { ok: false, error: 'validation', fields });

    const salt = resolveSalt(env);
    if (!salt) {
      console.error('waitlist: WAITLIST_WEBHOOK_SECRET / IP_HASH_SALT not configured');
      return send(res, 503, { ok: false, error: 'server_misconfigured' });
    }
    const ipHash = hashIp(getClientIp(req), salt);
    if (localLimited(ipHash, now())) {
      return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '600' });
    }

    try {
      const out = await callScript(env, {
        action: 'register',
        name, contact: contact.normalized, type: contact.type, city,
        consent: true, consentVersion: CONSENT_VERSION,
        source: shortText(body.source, 60) || '',
        ipHash,
      }, fetchImpl);
      return send(res, out.status === 'created' ? 201 : 200, { ok: true, status: out.status === 'created' ? 'created' : 'duplicate' });
    } catch (err) {
      const kind = err instanceof SheetError ? err.kind : 'server_error';
      const status = err instanceof SheetError ? err.status : 500;
      console.error('waitlist failed:', kind);
      return send(res, status, { ok: false, error: kind });
    }
  };
}

module.exports = makeHandler();
module.exports.makeHandler = makeHandler;
module.exports.CONSENT_VERSION = CONSENT_VERSION;
module.exports._resetLocalLimits = () => attempts.clear();
