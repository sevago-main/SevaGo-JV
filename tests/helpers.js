'use strict';
const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');

const ENV = {
  IP_HASH_SALT: 'test-salt-test-salt-test-salt-1234',
  ADMIN_EXPORT_TOKEN: 'a'.repeat(40),
  ALLOWED_ORIGINS: 'https://sevago.co.in',
};

/** Real schema.sql executed on an in-memory Postgres. */
async function makeDb() {
  const mem = newDb();
  // pg-mem implements few built-ins; register the ones schema.sql uses
  mem.public.registerFunction({ name: 'char_length', args: ['text'], returns: 'integer', implementation: (s) => String(s).length });
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
  return pool;
}

function makeReq({ method = 'POST', headers = {}, body, url = '/' } = {}) {
  return {
    method, url, body,
    headers: Object.assign({ origin: 'https://sevago.co.in', 'content-type': 'application/json', 'x-real-ip': '1.2.3.4', 'user-agent': 'TestUA' }, headers),
  };
}

function makeRes() {
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = (b) => { res.body = b === undefined ? '' : b; res.ended = true; return res; };
  res.json = () => JSON.parse(res.body);
  return res;
}

const goodBody = (over = {}) => Object.assign({
  name: 'Asha Raman', contact: '98765 43210', city: 'Bengaluru', consent: true, website: '', elapsedMs: 5000,
}, over);

module.exports = { ENV, makeDb, makeReq, makeRes, goodBody };
