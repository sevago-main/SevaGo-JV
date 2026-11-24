'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeHandler: makeAdmin } = require('../api/admin/waitlist-export');
const { makeHandler: makeWaitlist } = require('../api/waitlist');
const { makeHandler: makeTrack } = require('../api/track');
const { ENV, makeDb, makeReq, makeRes, goodBody } = require('./helpers');

const auth = (t = ENV.ADMIN_EXPORT_TOKEN) => ({ authorization: 'Bearer ' + t });

test('export requires the bearer token; wrong or missing token gets 401', async () => {
  const db = await makeDb();
  const h = makeAdmin({ env: ENV, getDb: () => db });
  for (const headers of [{}, auth('wrong'), { authorization: 'Basic abc' }]) {
    const res = makeRes(); await h(makeReq({ method: 'GET', headers: Object.assign({ 'x-real-ip': '7.7.7.' + Math.random() }, headers) }), res);
    assert.equal(res.statusCode, 401);
    assert.ok(!/csv/.test(res.headers['content-type'] || ''));
  }
});

test('export is disabled (503) when no strong token is configured', async () => {
  const h = makeAdmin({ env: Object.assign({}, ENV, { ADMIN_EXPORT_TOKEN: 'short' }), getDb: () => { throw new Error('no'); } });
  const res = makeRes(); await h(makeReq({ method: 'GET', headers: auth('short') }), res);
  assert.equal(res.statusCode, 503);
});

test('five wrong tokens lock that visitor out, even for the right token', async () => {
  const db = await makeDb();
  const h = makeAdmin({ env: ENV, getDb: () => db });
  const headers = (t) => Object.assign({ 'x-real-ip': '5.5.5.5' }, auth(t));
  for (let i = 0; i < 5; i++) { const r = makeRes(); await h(makeReq({ method: 'GET', headers: headers('bad' + i) }), r); assert.equal(r.statusCode, 401); }
  const locked = makeRes(); await h(makeReq({ method: 'GET', headers: headers(ENV.ADMIN_EXPORT_TOKEN) }), locked);
  assert.equal(locked.statusCode, 429);
});

test('CSV export: header, BOM, escaping, formula-injection protection, download headers', async () => {
  const db = await makeDb();
  const wl = makeWaitlist({ env: ENV, getDb: () => db });
  const post = async (b, ip) => { const r = makeRes(); await wl(makeReq({ body: b, headers: { 'x-real-ip': ip } }), r); return r; };
  await post(goodBody({ name: 'Asha Raman', contact: 'asha@example.com', city: 'Chennai' }), '1.1.1.1');
  await post(goodBody({ name: "Ravi O'Neil", contact: '9876543210', city: 'Kochi, Kerala' }), '2.2.2.2');

  const h = makeAdmin({ env: ENV, getDb: () => db, now: () => Date.parse('2026-12-01T00:00:00Z') });
  const res = makeRes(); await h(makeReq({ method: 'GET', headers: auth() }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /^text\/csv/);
  assert.equal(res.headers['content-disposition'], 'attachment; filename="sevago-ios-waitlist-2026-12-01.csv"');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.ok(res.body.startsWith('﻿id,created_at,name,contact_type,contact_normalized,city'));
  const lines = res.body.trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /,Asha Raman,email,asha@example.com,Chennai,true,/);
  // phone starts with "+" -> must be neutralised for spreadsheets; comma city is quoted
  assert.match(lines[2], /,phone,'\+919876543210,"Kochi, Kerala",true,/);
});

test('summary view returns the funnel and conversion rate', async () => {
  const db = await makeDb();
  const track = makeTrack({ env: ENV, getDb: () => db });
  const fire = async (event, sid) => { const r = makeRes(); await track(makeReq({ body: { event, platform: 'ios', sessionId: sid } }), r); return r; };
  for (const s of ['aaaaaaaa1', 'aaaaaaaa2', 'aaaaaaaa3', 'aaaaaaaa4']) await fire('download_view', s);
  await fire('waitlist_success', 'aaaaaaaa1');
  await fire('waitlist_success', 'aaaaaaaa1'); // same session counted once
  const h = makeAdmin({ env: ENV, getDb: () => db });
  const res = makeRes(); await h(makeReq({ method: 'GET', url: '/api/admin/waitlist-export?view=summary&days=7', headers: auth() }), res);
  assert.equal(res.statusCode, 200);
  const j = res.json();
  assert.equal(j.sessions.download_view, 4);
  assert.equal(j.sessions.waitlist_success, 1);
  assert.equal(j.conversionRate, 25);
});

test('track: stores allow-listed events only and validates inputs', async () => {
  const db = await makeDb();
  const track = makeTrack({ env: ENV, getDb: () => db });
  const call = async (body, headers) => { const r = makeRes(); await track(makeReq({ body, headers }), r); return r; };
  assert.equal((await call({ event: 'download_view', platform: 'android', sessionId: 'abcdef123456' })).statusCode, 204);
  assert.equal((await call({ event: 'drop_table', platform: 'android', sessionId: 'abcdef123456' })).statusCode, 400);
  assert.equal((await call({ event: 'download_view', platform: 'toaster', sessionId: 'abcdef123456' })).statusCode, 400);
  assert.equal((await call({ event: 'download_view', platform: 'ios', sessionId: "x'; DROP" })).statusCode, 400);
  assert.equal((await call({ event: 'download_view', platform: 'ios', sessionId: 'abcdef123456' }, { origin: 'https://evil.example' })).statusCode, 403);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM waitlist_events')).rows[0].n, 1);
});
