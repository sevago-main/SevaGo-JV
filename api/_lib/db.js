'use strict';
let pool;

/** Lazily-created pg Pool. Kept tiny (max 2) because each serverless instance holds its own pool. */
function getDb(env = process.env) {
  if (pool) return pool;
  const { Pool } = require('pg');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  let ssl;
  if (env.DATABASE_CA) ssl = { ca: env.DATABASE_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  else if (env.DATABASE_SSL_NO_VERIFY === 'true') ssl = { rejectUnauthorized: false };
  else ssl = { rejectUnauthorized: true };
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (e) => console.error('pg pool error', e.code || e.message));
  return pool;
}

module.exports = { getDb };
