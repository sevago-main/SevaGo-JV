'use strict';
/**
 * Creates the waitlist tables (idempotent):   DATABASE_URL=... DATABASE_CA="$(cat rds-ca.pem)" npm run migrate
 * Only creates ios_waitlist, waitlist_attempts, waitlist_events. Touches nothing else.
 */
const { getDb } = require('../api/_lib/db');
const { ensureSchema } = require('../api/_lib/schema');
(async () => {
  const db = getDb(process.env);
  await ensureSchema(db);
  const r = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('ios_waitlist','waitlist_attempts','waitlist_events') ORDER BY 1");
  console.log('tables present:', r.rows.map((x) => x.table_name).join(', '));
  await db.end();
})().catch((e) => { console.error('migration failed:', e.code || e.message); process.exit(1); });
