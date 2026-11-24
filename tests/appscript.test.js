'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeGoogleSandbox, registerMsg, ipHash, SECRET } = require('./helpers');

test('first registration creates the private sheet with headers and writes a plain-text row', () => {
  const g = makeGoogleSandbox();
  const out = g.post(registerMsg());
  assert.deepEqual(out, { ok: true, status: 'created' });
  assert.equal(g.log.sheetsCreated, 1);
  assert.equal(g.grid[0][2], 'Name');
  const row = g.grid[1];
  assert.equal(row[0], '2026-12-01 14:00:00');          // IST = UTC + 5:30
  assert.equal(row[1], '2026-12-01T08:30:00Z');
  assert.deepEqual(row.slice(2, 12), ['Asha Raman', '+919876543210', 'phone', 'Bengaluru', 'Yes', 'ios-waitlist-v1', 'Registered', '0', '', 'direct']);
  assert.ok(g.log.formats.includes('@'), 'columns must be plain text so +91... and any text is never parsed as a formula');
});

test('duplicate: no new row, original row records the attempt count, time and status', () => {
  const g = makeGoogleSandbox();
  g.post(registerMsg());
  assert.deepEqual(g.post(registerMsg({ name: 'Someone Else', ipHash: ipHash(2) })), { ok: true, status: 'duplicate' });
  assert.deepEqual(g.post(registerMsg({ ipHash: ipHash(3) })), { ok: true, status: 'duplicate' });
  assert.equal(g.grid.length, 2);
  assert.equal(g.grid[1][8], 'Registered, duplicate attempted');
  assert.equal(g.grid[1][9], '2');
  assert.equal(g.grid[1][10], '2026-12-01 14:00:00');
  assert.equal(g.grid[1][2], 'Asha Raman'); // original name untouched
});

test('different contacts create separate rows', () => {
  const g = makeGoogleSandbox();
  g.post(registerMsg());
  g.post(registerMsg({ contact: 'asha@example.com', type: 'email' }));
  assert.equal(g.grid.length, 3);
});

test('every write happens under the script lock (no race-created duplicates)', () => {
  const g = makeGoogleSandbox();
  g.post(registerMsg()); g.post(registerMsg());
  assert.equal(g.log.lockWaits, 2);
  assert.equal(g.log.lockReleases, 2);
});

test('wrong, missing or short secret is rejected before any sheet access', () => {
  const g = makeGoogleSandbox();
  assert.equal(g.post(registerMsg({ secret: 'nope' })).error, 'unauthorized');
  assert.equal(g.post(registerMsg({ secret: undefined })).error, 'unauthorized');
  assert.equal(g.log.sheetsCreated, 0);
  assert.equal(g.grid.length, 0);
  const unconfigured = makeGoogleSandbox({ secret: null });
  assert.equal(unconfigured.post(registerMsg()).error, 'not_configured');
  const short = makeGoogleSandbox({ secret: 'short' });
  assert.equal(short.post(registerMsg({ secret: 'short' })).error, 'not_configured');
});

test('ping works with the secret and touches no data; GET reveals nothing', () => {
  const g = makeGoogleSandbox();
  assert.deepEqual(g.post({ secret: SECRET, action: 'ping' }), { ok: true, status: 'pong' });
  assert.equal(g.log.sheetsCreated, 0);
  assert.deepEqual(JSON.parse(g.sandbox.doGet().text), { ok: true, service: 'sevago-waitlist' });
});

test('re-validates input even from an authenticated caller', () => {
  const g = makeGoogleSandbox();
  const bad = [
    { consent: false }, { consent: 'true' }, { name: '=HYPERLINK("http://x")' }, { name: 'A' }, { city: '+cmd' },
    { contact: '=1+1@x.com', type: 'email' }, { contact: '12345', type: 'phone' }, { contact: '+919876543210', type: 'email' },
    { type: 'fax' }, { ipHash: 'not-a-hash' }, { consentVersion: '' },
  ];
  for (const b of bad) assert.equal(g.post(registerMsg(b)).error, 'invalid', JSON.stringify(b));
  assert.equal(g.grid.length, 0);
  assert.equal(g.post('not json').error, 'bad_request');
  assert.equal(g.post({ secret: SECRET, action: 'dump' }).error, 'bad_request');
});

test('formula-looking source is dropped rather than written', () => {
  const g = makeGoogleSandbox();
  g.post(registerMsg({ source: '=IMPORTXML("x")' }));
  assert.equal(g.grid[1][11], '');
});

test('rate limit: 7th attempt from one visitor is refused, others are unaffected', () => {
  const g = makeGoogleSandbox();
  for (let i = 0; i < 6; i++) assert.equal(g.post(registerMsg({ contact: '+9198765432' + (10 + i) })).ok, true);
  assert.equal(g.post(registerMsg({ contact: '+919876543299' })).error, 'rate_limited');
  assert.equal(g.post(registerMsg({ contact: '+919876543298', ipHash: ipHash(9) })).ok, true);
});

test('global hourly cap stops a distributed flood', () => {
  const g = makeGoogleSandbox();
  g.cacheStore.set('g:2026120108', '300');
  assert.equal(g.post(registerMsg()).error, 'rate_limited');
});
