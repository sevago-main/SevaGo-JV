'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const handlerMod = require('../api/waitlist');
const { makeHandler } = handlerMod;
const { ENV, SECRET, makeReq, makeRes, goodBody, makeGoogleSandbox } = require('./helpers');

/** fetch stand-in that routes straight into the real Code.gs running in the sandbox. */
function fetchTo(g, calls) {
  return async (url, opts) => {
    const payload = JSON.parse(opts.body);
    calls.push({ url, opts, payload });
    return { text: async () => JSON.stringify(g.post(payload)) };
  };
}
async function setup(envOver = {}) {
  handlerMod._resetLocalLimits();
  const g = makeGoogleSandbox(); const calls = [];
  const handler = makeHandler({ env: Object.assign({}, ENV, envOver), fetch: fetchTo(g, calls) });
  const post = async (body, headers) => { const res = makeRes(); await handler(makeReq({ body, headers }), res); return res; };
  return { g, calls, handler, post };
}
const raw = (fetchImpl, envOver) => async (body, headers) => {
  handlerMod._resetLocalLimits();
  const res = makeRes();
  await makeHandler({ env: Object.assign({}, ENV, envOver), fetch: fetchImpl })(makeReq({ body: body || goodBody(), headers }), res);
  return res;
};

test('end to end: sign-up lands in the sheet with normalised contact, consent and IST/UTC times', async () => {
  const { g, post } = await setup();
  const res = await post(goodBody());
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json(), { ok: true, status: 'created' });
  assert.equal(g.grid.length, 2);
  assert.deepEqual(g.grid[1].slice(2, 9), ['Asha Raman', '+919876543210', 'phone', 'Bengaluru', 'Yes', 'ios-waitlist-v1', 'Registered']);
});

test('the secret is sent to Google only, the IP is hashed, and no raw IP, user agent or origin reaches the sheet', async () => {
  const { calls, post } = await setup();
  await post(goodBody());
  const c = calls[0];
  assert.match(c.url, /^https:\/\/script\.google\.com\//);
  assert.equal(c.payload.secret, SECRET);
  assert.match(c.payload.ipHash, /^[0-9a-f]{64}$/);
  const sent = JSON.stringify(c.payload);
  assert.ok(!sent.includes('1.2.3.4') && !sent.includes('TestUA'));
  assert.equal(c.opts.redirect, 'follow');
  const res = makeRes(); // the secret never comes back to the browser
  await makeHandler({ env: ENV, fetch: async () => ({ text: async () => '{"ok":true,"status":"created"}' }) })(makeReq({ body: goodBody() }), res);
  assert.ok(!res.body.includes(SECRET));
});

test('duplicates are reported as duplicate however the contact is written', async () => {
  const { g, post } = await setup();
  assert.equal((await post(goodBody({ contact: '9876543210' }))).statusCode, 201);
  const again = await post(goodBody({ contact: '+91 98765-43210', name: 'Someone Else' }));
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().status, 'duplicate');
  await post(goodBody({ contact: 'Asha@Example.com' }));
  assert.equal((await post(goodBody({ contact: ' asha@example.COM ' }))).json().status, 'duplicate');
  assert.equal(g.grid.length, 3);
});

test('invalid input gives per-field messages and never reaches Google', async () => {
  const { calls, post } = await setup();
  const res = await post(goodBody({ name: '', contact: 'nope', city: '', consent: false }));
  assert.equal(res.statusCode, 422);
  assert.deepEqual(Object.keys(res.json().fields).sort(), ['city', 'consent', 'contact', 'name']);
  assert.equal((await post(goodBody({ consent: 'true' }))).statusCode, 422);
  assert.equal((await post(goodBody({ contact: '=1+1@x.com' }))).statusCode, 422);
  assert.equal(calls.length, 0);
});

test('honeypot, fill-time, origin, method, content-type and JSON checks', async () => {
  const { calls, handler, post } = await setup();
  assert.equal((await post(goodBody({ website: 'http://spam.example' }))).statusCode, 200);
  assert.equal((await post(goodBody({ elapsedMs: 200 }))).statusCode, 400);
  assert.equal((await post(goodBody({ elapsedMs: undefined }))).statusCode, 400);
  let res = makeRes(); await handler(makeReq({ body: goodBody(), headers: { origin: 'https://evil.example' } }), res); assert.equal(res.statusCode, 403);
  res = makeRes(); await handler(makeReq({ body: goodBody(), headers: { origin: undefined } }), res); assert.equal(res.statusCode, 403);
  res = makeRes(); await handler(makeReq({ method: 'GET' }), res); assert.equal(res.statusCode, 405);
  res = makeRes(); await handler(makeReq({ body: goodBody(), headers: { 'content-type': 'text/plain' } }), res); assert.equal(res.statusCode, 415);
  res = makeRes(); await handler(makeReq({ body: 'not json{' }), res); assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test('server-side rate limit: 7th attempt from one visitor gets 429 before Google is called again', async () => {
  const { calls, post } = await setup();
  for (let i = 0; i < 6; i++) assert.equal((await post(goodBody({ contact: '98765432' + (10 + i) }))).statusCode, 201);
  const blocked = await post(goodBody({ contact: '9876543299' }));
  assert.equal(blocked.statusCode, 429);
  assert.ok(blocked.headers['retry-after']);
  assert.equal(calls.length, 6);
  assert.equal((await post(goodBody({ contact: '9876543298' }), { 'x-real-ip': '9.9.9.9' })).statusCode, 201);
});

test('Apps Script rate limit (shared across servers) is passed through as 429', async () => {
  const res = await raw(async () => ({ text: async () => '{"ok":false,"error":"rate_limited"}' }))();
  assert.equal(res.statusCode, 429);
  assert.equal(res.json().error, 'rate_limited');
});

test('failure modes return specific codes (503 = our setup), never a generic failure or any secret', async () => {
  const cases = [
    ['network error', async () => { throw new Error('ENOTFOUND script.google.com ' + SECRET); }, 'sheet_unreachable'],
    ['HTML login page (script not shared with Anyone / wrong URL)', async () => ({ text: async () => '<!DOCTYPE html><title>Sign in</title>' }), 'sheet_misconfigured'],
    ['secret mismatch', async () => ({ text: async () => '{"ok":false,"error":"unauthorized"}' }), 'sheet_unauthorized'],
    ['script has no secret', async () => ({ text: async () => '{"ok":false,"error":"not_configured"}' }), 'sheet_not_configured'],
    ['script busy', async () => ({ text: async () => '{"ok":false,"error":"busy"}' }), 'sheet_busy'],
    ['script crash', async () => ({ text: async () => '{"ok":false,"error":"script_error"}' }), 'sheet_error'],
  ];
  for (const [label, f, kind] of cases) {
    const res = await raw(f)();
    assert.equal(res.statusCode, 503, label);
    assert.equal(res.json().error, kind, label);
    assert.ok(!res.body.includes(SECRET) && !res.body.includes('script.google.com'), label);
  }
});

test('missing or unsafe configuration fails closed with 503 server_misconfigured', async () => {
  for (const over of [{ WAITLIST_WEBHOOK_URL: '' }, { WAITLIST_WEBHOOK_SECRET: '' }, { WAITLIST_WEBHOOK_SECRET: 'short' },
    { WAITLIST_WEBHOOK_URL: 'https://evil.example/exec' }, { WAITLIST_WEBHOOK_URL: 'http://script.google.com/macros/s/x/exec' }, { WAITLIST_WEBHOOK_URL: 'not a url' }]) {
    let called = false;
    const res = await raw(async () => { called = true; return { text: async () => '{}' }; }, over)();
    assert.equal(res.statusCode, 503, JSON.stringify(over));
    assert.equal(res.json().error, 'server_misconfigured');
    assert.equal(called, false, 'must not send the secret to ' + JSON.stringify(over));
  }
});

test('timeouts are reported as sheet_unreachable', async () => {
  const res = await raw((url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted')))), {})();
  assert.equal(res.json().error, 'sheet_unreachable');
}, { timeout: 15000 });

test('concurrent identical sign-ups produce exactly one row', async () => {
  const { g, post } = await setup();
  const rs = await Promise.all([0, 1, 2, 3].map((i) => post(goodBody({ contact: 'race@example.com' }), { 'x-real-ip': '10.0.0.' + i })));
  assert.equal(g.grid.length, 2);
  assert.equal(rs.filter((r) => r.json().status === 'created').length, 1);
});
