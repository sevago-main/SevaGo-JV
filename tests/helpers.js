'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SECRET = 's3cret-'.repeat(4);
const ENV = {
  WAITLIST_WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbxTEST/exec',
  WAITLIST_WEBHOOK_SECRET: SECRET,
  ALLOWED_ORIGINS: 'https://sevago.co.in',
};

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

/** An in-memory stand-in for the Google services Code.gs uses, so the real script logic is tested. */
function makeGoogleSandbox({ secret = SECRET, now = new Date('2026-12-01T08:30:00Z') } = {}) {
  const grid = []; // rows of strings
  const log = { formats: [], lockWaits: 0, lockReleases: 0, sheetsCreated: 0 };
  const cacheStore = new Map();
  const props = secret === null ? {} : { WAITLIST_SECRET: secret };
  const range = (r, c, nr, nc) => ({
    setValues(v) { v.forEach((row, i) => row.forEach((val, j) => { (grid[r - 1 + i] = grid[r - 1 + i] || [])[c - 1 + j] = String(val); })); return this; },
    getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(((grid[r - 1 + i] || [])[c - 1 + j]) || ''); out.push(row); } return out; },
    getValue() { return ((grid[r - 1] || [])[c - 1]) || ''; },
    setFontWeight() { return this; },
    setNumberFormat(f) { log.formats.push(f); return this; },
  });
  let sheet = null;
  const sheetObj = {
    getLastRow: () => grid.length,
    getMaxRows: () => 1000,
    getRange: range,
    setFrozenRows() {},
  };
  const sandbox = {
    JSON, String, Math, parseInt, Date, Object, RegExp,
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ text: s, setMimeType() { return this; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
    LockService: { getScriptLock: () => ({ waitLock() { log.lockWaits++; }, releaseLock() { log.lockReleases++; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cacheStore.get(k) || null, put: (k, v) => cacheStore.set(k, v) }) },
    Utilities: {
      formatDate(d, tz, fmt) {
        const base = new Date(d.getTime() + (tz === 'Asia/Kolkata' ? 5.5 * 3600e3 : 0)).toISOString();
        if (fmt === 'yyyyMMddHH') return base.slice(0, 13).replace(/[-T]/g, '');
        if (fmt === 'yyyy-MM-dd HH:mm:ss') return base.slice(0, 19).replace('T', ' ');
        return base.slice(0, 19) + 'Z';
      },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => sheet,
        insertSheet: () => { sheet = sheetObj; log.sheetsCreated++; return sheetObj; },
      }),
    },
  };
  const OrigDate = Date;
  sandbox.Date = class extends OrigDate { constructor(...a) { super(...(a.length ? a : [now.getTime()])); } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8'), sandbox);
  const post = (obj) => JSON.parse(sandbox.doPost({ postData: { contents: typeof obj === 'string' ? obj : JSON.stringify(obj) } }).text);
  return { sandbox, grid, log, post, cacheStore };
}

const ipHash = (n = 1) => String(n).padStart(64, '0').replace(/[^0-9a-f]/g, 'a');
const registerMsg = (over = {}) => Object.assign({
  secret: SECRET, action: 'register', name: 'Asha Raman', contact: '+919876543210', type: 'phone', city: 'Bengaluru',
  consent: true, consentVersion: 'ios-waitlist-v1', source: 'direct', ipHash: ipHash(1),
}, over);

module.exports = { ENV, SECRET, makeReq, makeRes, goodBody, makeGoogleSandbox, registerMsg, ipHash };
