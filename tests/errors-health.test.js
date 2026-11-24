'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSalt, classifyDbError, statusFor } = require('../api/_lib/errors');
const { makeHandler: makeWaitlist } = require('../api/waitlist');
const { makeHandler: makeHealth } = require('../api/health');
const { makeHandler: makeAdmin } = require('../api/admin/waitlist-export');
const { makeHandler: makeTrack } = require('../api/track');
const dl = require('../js/download');
const { ENV, makeDb, makeReq, makeRes, goodBody } = require('./helpers');
const { newDb } = require('pg-mem');

test('salt: uses IP_HASH_SALT, else derives from DATABASE_URL, else null', () => {
  assert.equal(resolveSalt({ IP_HASH_SALT: 'x'.repeat(20) }), 'x'.repeat(20));
  const derived = resolveSalt({ DATABASE_URL: 'postgres://u:p@h/db' });
  assert.match(derived, /^[0-9a-f]{64}$/);
  assert.equal(derived, resolveSalt({ DATABASE_URL: 'postgres://u:p@h/db' }));
  assert.notEqual(derived, resolveSalt({ DATABASE_URL: 'postgres://u:q@h/db' }));
  assert.equal(resolveSalt({ IP_HASH_SALT: 'short' }), null);
  assert.equal(resolveSalt({}), null);
});

test('database errors map to stable codes and 503/500', () => {
  const cases = [
    [{ message: 'DATABASE_URL is not set' }, 'server_misconfigured', 503],
    [{ code: '42P01' }, 'schema_missing', 503],
    [{ code: '28P01' }, 'db_auth_failed', 503],
    [{ code: '3D000' }, 'db_not_found', 503],
    [{ code: '42501' }, 'db_permission_denied', 503],
    [{ code: 'ECONNREFUSED' }, 'db_unreachable', 503],
    [{ code: 'ETIMEDOUT' }, 'db_unreachable', 503],
    [{ message: 'self-signed certificate in certificate chain' }, 'db_tls_failed', 503],
    [new Error('boom'), 'server_error', 500],
  ];
  for (const [err, kind, status] of cases) { assert.equal(classifyDbError(err), kind); assert.equal(statusFor(kind), status); }
});

test('waitlist works when only DATABASE_URL is set (no IP_HASH_SALT)', async () => {
  const db = await makeDb();
  const env = { ALLOWED_ORIGINS: ENV.ALLOWED_ORIGINS, DATABASE_URL: 'postgres://u:p@h/db' };
  const res = makeRes(); await makeWaitlist({ env, getDb: () => db })(makeReq({ body: goodBody() }), res);
  assert.equal(res.statusCode, 201);
});

test('nothing configured -> 503 server_misconfigured, but visitor input errors still come first as 422', async () => {
  const env = { ALLOWED_ORIGINS: ENV.ALLOWED_ORIGINS };
  const h = makeWaitlist({ env, getDb: () => { throw new Error('DATABASE_URL is not set'); } });
  let res = makeRes(); await h(makeReq({ body: goodBody() }), res);
  assert.equal(res.statusCode, 503); assert.equal(res.json().error, 'server_misconfigured');
  res = makeRes(); await h(makeReq({ body: goodBody({ name: '' }) }), res);
  assert.equal(res.statusCode, 422);
});

test('missing tables -> 503 schema_missing with a clear code; no details leak', async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const empty = new Pool(); // no schema applied
  const res = makeRes(); await makeWaitlist({ env: ENV, getDb: () => empty })(makeReq({ body: goodBody() }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.json().error, 'schema_missing');
  assert.ok(!/relation|postgres|pg_/i.test(res.body));
});

test('WAITLIST_AUTO_MIGRATE=true creates the tables once and the sign-up succeeds', async () => {
  const mem = newDb();
  mem.public.registerFunction({ name: 'char_length', args: ['text'], returns: 'integer', implementation: (s) => String(s).length });
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const env = Object.assign({}, ENV, { WAITLIST_AUTO_MIGRATE: 'true' });
  const res = makeRes(); await makeWaitlist({ env, getDb: () => pool })(makeReq({ body: goodBody() }), res);
  assert.equal(res.statusCode, 201);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM ios_waitlist')).rows[0].n, 1);
});

test('health: public view is just ok/not ok; admin view lists checks without secrets', async () => {
  const db = await makeDb();
  const h = makeHealth({ env: ENV, getDb: () => db });
  const pub = makeRes(); await h(makeReq({ method: 'GET', headers: {} }), pub);
  assert.equal(pub.statusCode, 503); // DATABASE_URL missing in ENV
  assert.deepEqual(Object.keys(pub.json()), ['ok']);

  const env = Object.assign({}, ENV, { DATABASE_URL: 'postgres://secret-user:secret-pass@db.internal/x' });
  const good = makeHealth({ env, getDb: () => db });
  const adm = makeRes(); await good(makeReq({ method: 'GET', headers: { authorization: 'Bearer ' + ENV.ADMIN_EXPORT_TOKEN } }), adm);
  assert.equal(adm.statusCode, 200);
  assert.equal(adm.json().checks.database, 'ok');
  assert.equal(adm.json().checks.tables, 'ok');
  assert.ok(!adm.body.includes('secret-pass') && !adm.body.includes('db.internal'));

  const bad = makeHealth({ env, getDb: () => ({ query: async () => { throw Object.assign(new Error('x'), { code: 'ECONNREFUSED' }); } }) });
  const r = makeRes(); await bad(makeReq({ method: 'GET', headers: { authorization: 'Bearer ' + ENV.ADMIN_EXPORT_TOKEN } }), r);
  assert.equal(r.statusCode, 503); assert.equal(r.json().checks.database, 'db_unreachable');
});

test('admin list view returns recent sign-ups (admin only)', async () => {
  const db = await makeDb();
  const wl = makeWaitlist({ env: ENV, getDb: () => db });
  for (const [i, n] of ['Asha Raman', 'Ravi Kumar'].entries()) {
    await wl(makeReq({ body: goodBody({ name: n, contact: 'u' + i + '@example.com' }), headers: { 'x-real-ip': '8.8.8.' + i } }), makeRes());
  }
  const h = makeAdmin({ env: ENV, getDb: () => db });
  let res = makeRes(); await h(makeReq({ method: 'GET', url: '/api/admin/waitlist-export?view=list', headers: {} }), res);
  assert.equal(res.statusCode, 401);
  res = makeRes(); await h(makeReq({ method: 'GET', url: '/api/admin/waitlist-export?view=list', headers: { authorization: 'Bearer ' + ENV.ADMIN_EXPORT_TOKEN, 'x-real-ip': '9.9.9.9' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().total, 2);
  assert.equal(res.json().rows[0].name, 'Ravi Kumar'); // newest first
});

test('track no longer fails when IP_HASH_SALT is unset', async () => {
  const db = await makeDb();
  const env = { ALLOWED_ORIGINS: ENV.ALLOWED_ORIGINS, DATABASE_URL: 'postgres://u:p@h/db' };
  const res = makeRes(); await makeTrack({ env, getDb: () => db })(makeReq({ body: { event: 'download_view', platform: 'ios', sessionId: 'abcdef123456' } }), res);
  assert.equal(res.statusCode, 204);
});

test('visitor-facing copy: success, duplicate and specific error messages', () => {
  assert.deepEqual(dl.successCopy('created'), { title: "You're on the list.", text: "We'll notify you when SevaGo launches on iOS." });
  assert.equal(dl.successCopy('duplicate').title, "You're already on the waitlist.");
  assert.match(dl.errorMessage(429, { error: 'rate_limited' }), /Too many attempts/);
  assert.match(dl.errorMessage(403, { error: 'forbidden' }), /sevago\.co\.in/);
  assert.match(dl.errorMessage(503, { error: 'server_misconfigured' }), /temporarily unavailable.*not saved/);
  assert.match(dl.errorMessage(0, null), /internet connection/);
  assert.match(dl.errorMessage(500, { error: 'server_error' }), /team@sevago\.co\.in/);
  for (const [s, b] of [[500, {}], [503, {}], [0, null], [429, {}], [403, {}], [400, { error: 'too_fast' }]]) {
    assert.ok(!/Something went wrong/.test(dl.errorMessage(s, b)), 'generic message for ' + s);
  }
});
