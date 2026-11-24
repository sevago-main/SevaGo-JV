'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const trackMod = require('../api/track');
const { makeHandler: makeHealth } = require('../api/health');
const { ENV, SECRET, makeReq, makeRes } = require('./helpers');

const ev = (over = {}) => Object.assign({ event: 'download_view', platform: 'ios', sessionId: 'abcdef123456', source: 'direct' }, over);

test('track works with no database or waitlist settings at all, and logs one clean JSON line', async () => {
  trackMod._reset();
  const lines = [];
  const h = trackMod.makeHandler({ env: { ALLOWED_ORIGINS: 'https://sevago.co.in' }, log: (l) => lines.push(l) });
  const res = makeRes(); await h(makeReq({ body: ev() }), res);
  assert.equal(res.statusCode, 204);
  assert.equal(lines.length, 1);
  const rec = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(rec).sort(), ['at', 'event', 'platform', 'session', 'source', 'tag']);
  assert.equal(rec.tag, 'sevago_event');
  assert.ok(!lines[0].includes('1.2.3.4'), 'no IP in the log');
});

test('track validates events, platforms, session ids and origin; rejects the rest without logging', async () => {
  trackMod._reset();
  const lines = [];
  const h = trackMod.makeHandler({ env: ENV, log: (l) => lines.push(l) });
  const call = async (body, headers, method) => { const r = makeRes(); await h(makeReq({ body, headers, method }), r); return r.statusCode; };
  assert.equal(await call(ev({ event: 'drop_table' })), 400);
  assert.equal(await call(ev({ platform: 'toaster' })), 400);
  assert.equal(await call(ev({ sessionId: "x'; DROP" })), 400);
  assert.equal(await call(ev(), { origin: 'https://evil.example' }), 403);
  assert.equal(await call(undefined, {}, 'GET'), 405);
  assert.equal(lines.length, 0);
});

test('track rate-limits a flooding visitor (121st event in 10 minutes)', async () => {
  trackMod._reset();
  const h = trackMod.makeHandler({ env: ENV, log: () => {} });
  let last;
  for (let i = 0; i < 121; i++) { last = makeRes(); await h(makeReq({ body: ev() }), last); }
  assert.equal(last.statusCode, 429);
});

test('every event the site sends is accepted', () => {
  const sent = ['download_view', 'play_store_click', 'partner_play_click', 'sticky_cta_click', 'app_store_click', 'waitlist_cta_click',
    'waitlist_open', 'waitlist_start', 'waitlist_submit', 'waitlist_success', 'waitlist_duplicate', 'waitlist_error'];
  for (const e of sent) assert.ok(trackMod.EVENTS.has(e), e);
});

test('health: reports each part without exposing the URL or secret', async () => {
  const ok = makeRes();
  await makeHealth({ env: ENV, fetch: async () => ({ text: async () => '{"ok":true,"status":"pong"}' }) })(makeReq({ method: 'GET' }), ok);
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.json(), { ok: true, checks: { webhook_url_set: true, webhook_secret_set: true, script: 'ok' } });
  assert.ok(!ok.body.includes(SECRET) && !ok.body.includes('AKfycb'));

  const none = makeRes(); await makeHealth({ env: {} })(makeReq({ method: 'GET' }), none);
  assert.equal(none.statusCode, 503);
  assert.deepEqual(none.json().checks, { webhook_url_set: false, webhook_secret_set: false, script: 'not_checked' });

  const html = makeRes();
  await makeHealth({ env: ENV, fetch: async () => ({ text: async () => '<html>Sign in</html>' }) })(makeReq({ method: 'GET' }), html);
  assert.equal(html.statusCode, 503);
  assert.equal(html.json().checks.script, 'sheet_misconfigured');

  const wrong = makeRes();
  await makeHealth({ env: ENV, fetch: async () => ({ text: async () => '{"ok":false,"error":"unauthorized"}' }) })(makeReq({ method: 'GET' }), wrong);
  assert.equal(wrong.json().checks.script, 'sheet_unauthorized');
});
