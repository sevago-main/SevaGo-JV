'use strict';

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]{1,79}$/u;
const CITY_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.,'’()-]{1,59}$/u;
const EMAIL_RE = /^[A-Za-z0-9][^\s@]*@[^\s@]+\.[^\s@]{2,}$/; // must not start with = + - @ (spreadsheet formulas)

function clean(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function validateName(raw) {
  const name = clean(raw);
  if (name.length < 2 || name.length > 80 || !NAME_RE.test(name)) return null;
  return name;
}

function validateCity(raw) {
  const city = clean(raw);
  if (city.length < 2 || city.length > 60 || !CITY_RE.test(city)) return null;
  return city;
}

/**
 * Accepts one field holding an email OR a phone number.
 * Returns { type, normalized } or null. `normalized` is what the unique index uses,
 * so "A@B.com" / "a@b.com" and "98765 43210" / "+91 9876543210" collapse to one row.
 */
function normalizeContact(raw) {
  const value = clean(raw);
  if (!value) return null;

  if (value.includes('@')) {
    const email = value.toLowerCase();
    const local = email.split('@')[0];
    if (email.length > 254 || local.length > 64 || !EMAIL_RE.test(email)) return null;
    return { type: 'email', normalized: email };
  }

  if (!/^[\d\s+().-]+$/.test(value) || (value.match(/\+/g) || []).length > 1) return null;
  const hasPlus = value.includes('+');
  let digits = value.replace(/\D/g, '');

  if (hasPlus) {
    if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
    else if (digits.length >= 8 && digits.length <= 15) return { type: 'phone', normalized: '+' + digits };
    else return null;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(digits)) return null; // Indian mobile numbers
  return { type: 'phone', normalized: '+91' + digits };
}

function shortText(raw, max) {
  const v = clean(raw).slice(0, max);
  return v || null;
}

module.exports = { validateName, validateCity, normalizeContact, shortText, clean };
