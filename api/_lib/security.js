'use strict';
const crypto = require('crypto');

function getClientIp(req) {
  const h = req.headers || {};
  const raw = h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'] || '';
  return String(raw).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '';
}

/** One-way HMAC so we can rate-limit per visitor without storing IP addresses. */
function hashIp(ip, salt) {
  return crypto.createHmac('sha256', salt).update(String(ip || 'unknown')).digest('hex');
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || 'https://sevago.co.in,https://www.sevago.co.in')
    .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

/** Browsers always send Origin on cross-origin and same-origin POSTs; require it (or Referer) to match. */
function originAllowed(req, env) {
  const h = req.headers || {};
  const allowed = allowedOrigins(env);
  if (h.origin) return allowed.includes(String(h.origin).replace(/\/$/, ''));
  if (h.referer) {
    try { return allowed.includes(new URL(h.referer).origin); } catch (e) { return false; }
  }
  return false;
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Neutralise spreadsheet formula injection and quote CSV fields. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function send(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  Object.entries(extraHeaders || {}).forEach(([k, v]) => res.setHeader(k, v));
  if (body === undefined) return res.end();
  if (typeof body === 'string') return res.end(body);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string' || Buffer.isBuffer(b)) {
    const text = b.toString();
    if (text.length > 4096) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }
  return null;
}

module.exports = { getClientIp, hashIp, originAllowed, safeEqual, csvCell, send, readBody };
