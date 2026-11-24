'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeHandler } = require('../api/waitlist');
const { ENV, makeDb, makeReq, makeRes, goodBody } = require('./helpers');

async function setup() {
  const db = await makeDb();
  const handler = makeHandler({ env: ENV, getDb: () => db });
  const post = async (body, headers) => { const res = makeRes(); await handler(makeReq({ body, headers }), res); return res; };
  return { db, handler, post };
}

test('creates a signup and stores the normalised contact, consent and hashed IP', async () => {
  const { db, post } = await setup();
  const res = await post(goodBody());
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json(), { ok: true, status: 'created' });
  const { rows } = await db.query('SELECT * FROM ios_waitlist');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].contact_normalized, '+919876543210');
  assert.equal(rows[0].contact_type, 'phone');
  assert.equal(rows[0].consent, true);
  assert.equal(rows[0].consent_text_version, 'ios-waitlist-v1');
  assert.match(rows[0].ip_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(rows[0].ip_hash, '1.2.3.4');
});

test('duplicates are not stored twice, whatever the formatting', async () => {
  const { db, post } = await setup();
  assert.equal((await post(goodBody({ contact: '9876543210' }))).statusCode, 201);
  const again = await post(goodBody({ contact: '+91 98765-43210', name: 'Someone Else' }));
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().status, 'duplicate');
  await post(goodBody({ contact: 'Asha@Example.com' }));
  const dup = await post(goodBody({ contact: ' asha@example.COM ' }));
  assert.equal(dup.json().status, 'duplicate');
  const { rows } = await db.query('SELECT count(*)::int AS n FROM ios_waitlist');
  assert.equal(rows[0].n, 2);
});

test('rejects invalid input with per-field messages and stores nothing', async () => {
  const { db, post } = await setup();
  const res = await post(goodBody({ name: '', contact: 'nope', city: '', consent: false }));
  assert.equal(res.statusCode, 422);
  assert.deepEqual(Object.keys(res.json().fields).sort(), ['city', 'consent', 'contact', 'name']);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM ios_waitlist')).rows[0].n, 0);
});

test('consent must be exactly true (not "true", not 1)', async () => {
  const { post } = await setup();
  assert.equal((await post(goodBody({ consent: 'true' }))).statusCode, 422);
  assert.equal((await post(goodBody({ consent: 1 }))).statusCode, 422);
});

test('honeypot: looks like success to the bot but nothing is stored', async () => {
  const { db, post } = await setup();
  const res = await post(goodBody({ website: 'http://spam.example' }));
  assert.equal(res.statusCode, 200);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM ios_waitlist')).rows[0].n, 0);
});

test('too-fast submissions are rejected', async () => {
  const { post } = await setup();
  assert.equal((await post(goodBody({ elapsedMs: 200 }))).statusCode, 400);
  assert.equal((await post(goodBody({ elapsedMs: undefined }))).statusCode, 400);
});

test('origin, method and content-type are enforced', async () => {
  const { handler } = await setup();
  let res = makeRes(); await handler(makeReq({ body: goodBody(), headers: { origin: 'https://evil.example' } }), res);
  assert.equal(res.statusCode, 403);
  res = makeRes(); await handler(makeReq({ body: goodBody(), headers: { origin: undefined } }), res);
  assert.equal(res.statusCode, 403);
  res = makeRes(); await handler(makeReq({ method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
  res = makeRes(); await handler(makeReq({ body: goodBody(), headers: { 'content-type': 'text/plain' } }), res);
  assert.equal(res.statusCode, 415);
  res = makeRes(); await handler(makeReq({ body: 'not json{' }), res);
  assert.equal(res.statusCode, 400);
});

test('rate limit: the 7th attempt from one visitor in 10 minutes gets 429', async () => {
  const { post } = await setup();
  for (let i = 0; i < 6; i++) {
    const r = await post(goodBody({ contact: `98765432${10 + i}` }));
    assert.ok([200, 201].includes(r.statusCode), 'attempt ' + i + ' got ' + r.statusCode);
  }
  const blocked = await post(goodBody({ contact: '9876543299' }));
  assert.equal(blocked.statusCode, 429);
  assert.ok(blocked.headers['retry-after']);
  // a different visitor is not affected
  const other = await post(goodBody({ contact: '9876543298' }), { 'x-real-ip': '9.9.9.9' });
  assert.equal(other.statusCode, 201);
});

test('database failure returns a generic 500 and does not leak details', async () => {
  const handler = makeHandler({ env: ENV, getDb: () => ({ query: async () => { throw Object.assign(new Error('secret host db.internal'), { code: 'ECONNREFUSED' }); } }) });
  const res = makeRes(); await handler(makeReq({ body: goodBody() }), res);
  assert.equal(res.statusCode, 500);
  assert.ok(!res.body.includes('secret'));
});

test('missing IP_HASH_SALT fails closed', async () => {
  const handler = makeHandler({ env: Object.assign({}, ENV, { IP_HASH_SALT: '' }), getDb: () => { throw new Error('should not be reached'); } });
  const res = makeRes(); await handler(makeReq({ body: goodBody() }), res);
  assert.equal(res.statusCode, 500);
});

test('concurrent identical sign-ups can never produce two rows (unique index)', async () => {
  const { db, post } = await setup();
  await Promise.all([0, 1, 2, 3].map((i) => post(goodBody({ contact: 'race@example.com' }), { 'x-real-ip': '10.0.0.' + i })));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM ios_waitlist WHERE contact_normalized = 'race@example.com'")).rows[0].n, 1);
});
