'use strict';
const crypto = require('crypto');

/**
 * Salt for hashing IPs (rate limiting only, never stored raw). Prefers IP_HASH_SALT; otherwise derives
 * one from the webhook secret (itself private). Returns null if neither is configured.
 */
function resolveSalt(env) {
  if (env.IP_HASH_SALT && env.IP_HASH_SALT.length >= 16) return env.IP_HASH_SALT;
  if (env.WAITLIST_WEBHOOK_SECRET && env.WAITLIST_WEBHOOK_SECRET.length >= 16) {
    return crypto.createHash('sha256').update('sevago-ip-salt:' + env.WAITLIST_WEBHOOK_SECRET).digest('hex');
  }
  return null;
}

module.exports = { resolveSalt };
