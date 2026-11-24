'use strict';
const fs = require('fs');
const path = require('path');

/** Idempotent: every statement in db/schema.sql is CREATE ... IF NOT EXISTS. */
async function ensureSchema(db) {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
  await db.query(sql);
}

module.exports = { ensureSchema };
