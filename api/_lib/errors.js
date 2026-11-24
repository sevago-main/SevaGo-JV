'use strict';
const crypto = require('crypto');

/**
 * Salt for hashing IPs (rate limiting only). Prefers IP_HASH_SALT; if it was never set, derives a
 * stable secret from DATABASE_URL (itself a secret) so sign-ups do not fail closed on a missing
 * optional variable. Returns null only when neither exists.
 */
function resolveSalt(env) {
  if (env.IP_HASH_SALT && env.IP_HASH_SALT.length >= 16) return env.IP_HASH_SALT;
  if (env.DATABASE_URL) return crypto.createHash('sha256').update('sevago-ip-salt:' + env.DATABASE_URL).digest('hex');
  return null;
}

/**
 * Maps a thrown database/config error to a stable, non-sensitive code.
 * Only the code is ever logged or returned: never the message, host or credentials.
 */
function classifyDbError(err) {
  const code = err && err.code;
  const msg = String((err && err.message) || '');
  if (/DATABASE_URL is not set/.test(msg)) return 'server_misconfigured';
  if (code === '42P01' || /relation "[^"]+" does not exist/i.test(msg)) return 'schema_missing';                       // relation does not exist
  if (code === '28P01' || code === '28000') return 'db_auth_failed';   // bad password / role
  if (code === '3D000') return 'db_not_found';                         // database does not exist
  if (code === '42501') return 'db_permission_denied';
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', '57P03'].includes(code) || /timeout|terminated unexpectedly/i.test(msg)) return 'db_unreachable';
  if (/self.signed|certificate|SSL|TLS/i.test(msg) || /CERT_|SELF_SIGNED|UNABLE_TO_VERIFY/.test(String(code))) return 'db_tls_failed';
  return 'server_error';
}

/** HTTP status for a classified error: 503 = our infrastructure/config, 500 = unexpected. */
const statusFor = (kind) => (kind === 'server_error' ? 500 : 503);

module.exports = { resolveSalt, classifyDbError, statusFor };
