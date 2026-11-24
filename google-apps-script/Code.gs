/**
 * SevaGo iOS waitlist -> private Google Sheet.
 *
 * Bound to the spreadsheet (Extensions > Apps Script). Deployed as a Web app that runs AS YOU,
 * so the spreadsheet itself never has to be shared with anyone. The only caller is the SevaGo
 * server (api/waitlist.js on Vercel), which must send the shared secret stored in the script
 * property WAITLIST_SECRET. Requests without it are rejected before any data is touched.
 *
 * What it does (all under a script lock so two people can never create the same row):
 *   - re-validates every field (the server validates too; this is defence in depth)
 *   - rate-limits per visitor (hashed IP) and globally per hour
 *   - blocks duplicates on the normalised phone/email and records the attempt on the original row
 *   - writes every cell as plain text, so nothing is ever evaluated as a formula
 */
var SHEET_NAME = 'Waitlist';
var HEADERS = [
  'Registered at (IST)', 'Registered at (UTC)', 'Name', 'Phone or email', 'Type', 'City',
  'Notification consent', 'Consent text version', 'Status', 'Duplicate attempts',
  'Last duplicate attempt (IST)', 'Source'
];
var COL = { IST: 1, UTC: 2, NAME: 3, CONTACT: 4, TYPE: 5, CITY: 6, CONSENT: 7, CVER: 8, STATUS: 9, DUPS: 10, LASTDUP: 11, SOURCE: 12 };
var RATE_LIMIT = 6;            // attempts per visitor
var RATE_WINDOW_SEC = 600;     // per 10 minutes
var GLOBAL_LIMIT_PER_HOUR = 300;
var TZ = 'Asia/Kolkata';

function doGet() {
  // Deliberately returns nothing about the sheet.
  return respond_({ ok: true, service: 'sevago-waitlist' });
}

function doPost(e) {
  var out;
  try { out = handle_(e); } catch (err) { out = { ok: false, error: 'script_error' }; }
  return respond_(out);
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function str_(v, min, max) {
  if (typeof v !== 'string') return null;
  var s = v.replace(/\s+/g, ' ').trim();
  return s.length >= min && s.length <= max ? s : null;
}

function handle_(e) {
  var body;
  try { body = JSON.parse(e && e.postData && e.postData.contents); } catch (x) { return { ok: false, error: 'bad_request' }; }
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad_request' };

  var secret = PropertiesService.getScriptProperties().getProperty('WAITLIST_SECRET');
  if (!secret || secret.length < 16) return { ok: false, error: 'not_configured' };
  if (!safeEqual_(body.secret, secret)) return { ok: false, error: 'unauthorized' };
  if (body.action === 'ping') return { ok: true, status: 'pong' };
  if (body.action !== 'register') return { ok: false, error: 'bad_request' };

  var name = str_(body.name, 2, 80), contact = str_(body.contact, 5, 254), city = str_(body.city, 2, 60);
  var type = body.type === 'email' || body.type === 'phone' ? body.type : null;
  var version = str_(body.consentVersion, 1, 40), source = body.source ? str_(String(body.source), 1, 60) : '';
  var ipHash = typeof body.ipHash === 'string' && /^[0-9a-f]{64}$/.test(body.ipHash) ? body.ipHash : null;
  var okName = name && /^[A-Za-zÀ-ɏऀ-෿][A-Za-zÀ-ɏऀ-෿\s.'’-]*$/.test(name);
  var okCity = city && /^[A-Za-zÀ-ɏऀ-෿][A-Za-zÀ-ɏऀ-෿\s.,'()’-]*$/.test(city);
  var okContact = contact && (type === 'phone' ? /^\+\d{8,15}$/.test(contact) : /^[A-Za-z0-9][^\s@]*@[^\s@]+\.[^\s@]{2,}$/.test(contact));
  if (!okName || !okCity || !okContact || !version || body.consent !== true || !ipHash || source === null) {
    return { ok: false, error: 'invalid' };
  }
  if (source && /^[=+\-@]/.test(source)) source = '';

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (x) { return { ok: false, error: 'busy' }; }
  try {
    var cache = CacheService.getScriptCache();
    var now = new Date();
    var hourKey = 'g:' + Utilities.formatDate(now, 'UTC', 'yyyyMMddHH');
    var perKey = 'rl:' + ipHash;
    var perN = parseInt(cache.get(perKey) || '0', 10);
    var globalN = parseInt(cache.get(hourKey) || '0', 10);
    if (perN >= RATE_LIMIT || globalN >= GLOBAL_LIMIT_PER_HOUR) return { ok: false, error: 'rate_limited' };
    cache.put(perKey, String(perN + 1), RATE_WINDOW_SEC);
    cache.put(hourKey, String(globalN + 1), 3600);

    var sheet = sheet_();
    var istNow = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss');
    var last = sheet.getLastRow();
    if (last > 1) {
      var keys = sheet.getRange(2, COL.CONTACT, last - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i][0]) === contact) {
          var row = i + 2;
          var prev = parseInt(String(sheet.getRange(row, COL.DUPS).getValue() || '0'), 10) || 0;
          sheet.getRange(row, COL.STATUS, 1, 3).setValues([['Registered, duplicate attempted', String(prev + 1), istNow]]);
          return { ok: true, status: 'duplicate' };
        }
      }
    }
    sheet.getRange(last + 1, 1, 1, HEADERS.length).setValues([[
      istNow, Utilities.formatDate(now, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'"), name, contact, type, city,
      'Yes', version, 'Registered', '0', '', source || ''
    ]]);
    return { ok: true, status: 'created' };
  } finally {
    lock.releaseLock();
  }
}

/** Creates the tab, header row and plain-text formatting on first use. */
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).setNumberFormat('@'); // plain text: no formulas, '+91...' stays text
  }
  return sheet;
}
