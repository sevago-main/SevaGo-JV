'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { detectPlatform, resolveIosConfig, looksLikeContact } = require('../js/download');

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
  ipadMacUa: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
};

test('detects Android, iPhone, iPad, iPadOS-as-Mac and desktops', () => {
  assert.equal(detectPlatform({ userAgent: UA.android, maxTouchPoints: 5 }), 'android');
  assert.equal(detectPlatform({ userAgent: UA.iphone, maxTouchPoints: 5 }), 'ios');
  assert.equal(detectPlatform({ userAgent: UA.ipad, maxTouchPoints: 5 }), 'ios');
  assert.equal(detectPlatform({ userAgent: UA.ipadMacUa, maxTouchPoints: 5 }), 'ios');
  assert.equal(detectPlatform({ userAgent: UA.mac, maxTouchPoints: 0 }), 'desktop');
  assert.equal(detectPlatform({ userAgent: UA.windows, maxTouchPoints: 0 }), 'desktop');
  assert.equal(detectPlatform({}), 'other');
  assert.equal(detectPlatform(), 'other');
});

test('iOS button stays on the waitlist unless a real App Store https URL is configured', () => {
  assert.deepEqual(resolveIosConfig(null), { mode: 'waitlist', url: null });
  assert.deepEqual(resolveIosConfig({ ios: { mode: 'waitlist', appStoreUrl: 'https://apps.apple.com/in/app/sevago/id1' } }), { mode: 'waitlist', url: null });
  assert.deepEqual(resolveIosConfig({ ios: { mode: 'appstore', appStoreUrl: '' } }), { mode: 'waitlist', url: null });
  assert.deepEqual(resolveIosConfig({ ios: { mode: 'appstore', appStoreUrl: 'javascript:alert(1)' } }), { mode: 'waitlist', url: null });
  assert.deepEqual(resolveIosConfig({ ios: { mode: 'appstore', appStoreUrl: 'http://apps.apple.com/app/id1' } }), { mode: 'waitlist', url: null });
  assert.deepEqual(resolveIosConfig({ ios: { mode: 'appstore', appStoreUrl: 'https://evil.example/apps.apple.com' } }), { mode: 'waitlist', url: null });
  const ok = resolveIosConfig({ ios: { mode: 'appstore', appStoreUrl: 'https://apps.apple.com/in/app/sevago/id1234567890' } });
  assert.equal(ok.mode, 'appstore');
  assert.equal(ok.url, 'https://apps.apple.com/in/app/sevago/id1234567890');
});

test('shipped site-config.json is valid and defaults to waitlist', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site-config.json'), 'utf8'));
  assert.equal(resolveIosConfig(cfg).mode, 'waitlist');
});

test('client-side contact check accepts email or phone only', () => {
  assert.ok(looksLikeContact('a@b.co'));
  assert.ok(looksLikeContact('98765 43210'));
  assert.ok(looksLikeContact('+91 98765 43210'));
  assert.ok(!looksLikeContact('hello'));
  assert.ok(!looksLikeContact('12345'));
  assert.ok(!looksLikeContact(''));
});

test('index.html wires the panel: IDs used by download.js exist and Play link is kept', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of ['downloadPanel', 'dlDetect', 'waitlistOpen', 'appStoreBtn', 'waitlistForm', 'waitlistSuccess',
    'waitlistStatus', 'waitlistSubmit', 'iosSub', 'successTitle', 'playBtn', 'err-name', 'err-contact', 'err-city', 'err-consent']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing #' + id);
  }
  assert.ok(html.includes('play.google.com/store/apps/details?id=com.sevago.app'));
  assert.ok(html.includes('/js/download.js') && html.includes('/css/download.css'));
  assert.ok(html.includes('name="website"') && html.includes('name="consent"'));
});
