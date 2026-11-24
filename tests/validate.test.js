'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateName, validateCity, normalizeContact } = require('../api/_lib/validate');
const { csvCell } = require('../api/_lib/security');

test('names: accepts unicode names, rejects URLs, digits and junk', () => {
  assert.equal(validateName('  Asha   Raman '), 'Asha Raman');
  assert.equal(validateName('கார்த்திக்'), 'கார்த்திக்');
  assert.equal(validateName("D'Souza-Rao Jr."), "D'Souza-Rao Jr.");
  assert.equal(validateName('A'), null);
  assert.equal(validateName('http://spam.com'), null);
  assert.equal(validateName('Bot123'), null);
  assert.equal(validateName(''), null);
  assert.equal(validateName(42), null);
});

test('cities', () => {
  assert.equal(validateCity('Bengaluru'), 'Bengaluru');
  assert.equal(validateCity('Navi Mumbai'), 'Navi Mumbai');
  assert.equal(validateCity('<script>'), null);
  assert.equal(validateCity('x'), null);
});

test('email contacts are lower-cased so duplicates collapse', () => {
  assert.deepEqual(normalizeContact(' Asha@Example.COM '), { type: 'email', normalized: 'asha@example.com' });
  assert.equal(normalizeContact('no-at-sign.com'), null);
  assert.equal(normalizeContact('a@b'), null);
  assert.equal(normalizeContact('a b@c.com'), null);
});

test('Indian phone numbers normalise to +91XXXXXXXXXX in every common format', () => {
  const want = { type: 'phone', normalized: '+919876543210' };
  for (const v of ['9876543210', '98765 43210', '+91 98765-43210', '91 9876543210', '09876543210', '(+91) 98765 43210']) {
    assert.deepEqual(normalizeContact(v), want, v);
  }
});

test('invalid phones are rejected; other countries need a + prefix', () => {
  for (const v of ['1234567890', '98765', '5876543210', 'abcdefghij', '98765432101234']) assert.equal(normalizeContact(v), null, v);
  assert.deepEqual(normalizeContact('+1 415 555 0132'), { type: 'phone', normalized: '+14155550132' });
});

test('csvCell blocks formula injection and quotes special characters', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('+91 98'), "'+91 98");
  assert.equal(csvCell('-1'), "'-1");
  assert.equal(csvCell('@sum'), "'@sum");
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(new Date('2026-01-02T03:04:05Z')), '2026-01-02T03:04:05.000Z');
});
