'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pages } = require('../seo/pages');
const { urlOf } = require('../scripts/build-seo');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const htmlFiles = () => {
  const out = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (['node_modules', '.git', 'docs', 'tests', 'scripts', 'seo'].includes(e.name)) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  });
  walk(ROOT);
  return out;
};

test('generated pages, sitemap and robots.txt are up to date (run: node scripts/build-seo.js)', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-seo.js'), '--check'], { stdio: 'pipe' });
});

test('every landing page has a unique title/description, one h1, canonical and valid JSON-LD', () => {
  const titles = new Set(), descs = new Set();
  for (const p of pages) {
    const file = p.slug ? `coimbatore/${p.slug}.html` : 'coimbatore/index.html';
    const html = read(file);
    assert.ok(p.title.length <= 70, p.slug + ' title too long: ' + p.title.length);
    assert.ok(p.description.length >= 70 && p.description.length <= 160, p.slug + ' description length ' + p.description.length);
    assert.ok(!titles.has(p.title) && !descs.has(p.description), 'duplicate title/description on ' + file);
    titles.add(p.title); descs.add(p.description);
    assert.equal((html.match(/<h1>/g) || []).length, 1, file + ' h1 count');
    assert.ok(html.includes(`<link rel="canonical" href="https://sevago.co.in${urlOf(p)}">`), file + ' canonical');
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
    const types = ld['@graph'].map((x) => x['@type']);
    for (const t of ['BreadcrumbList', 'Service', 'WebPage', 'FAQPage']) assert.ok(types.includes(t), file + ' missing ' + t);
    const faq = ld['@graph'].find((x) => x['@type'] === 'FAQPage');
    assert.equal(faq.mainEntity.length, (html.match(/<details>/g) || []).length, file + ' FAQ schema must match visible FAQ');
    assert.ok(!/aggregateRating|"Review"/.test(html), file + ' must not contain review/rating markup');
  }
});

test('sitemap lists every landing page and robots.txt points to it', () => {
  const sm = read('sitemap.xml');
  for (const p of pages) assert.ok(sm.includes(`<loc>https://sevago.co.in${urlOf(p)}</loc>`), 'missing in sitemap: ' + urlOf(p));
  assert.ok(sm.includes('<loc>https://sevago.co.in/</loc>'));
  const robots = read('robots.txt');
  assert.match(robots, /Sitemap: https:\/\/sevago\.co\.in\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Disallow: \/api\//);
});

test('internal links resolve (files, clean URLs and #anchors) on every page', () => {
  const files = htmlFiles();
  const exists = (urlPath) => {
    const p = urlPath.replace(/^\//, '').replace(/\/$/, '');
    if (p === '') return 'index.html';
    for (const c of [p, p + '.html', p + '/index.html']) if (fs.existsSync(path.join(ROOT, c)) && fs.statSync(path.join(ROOT, c)).isFile()) return c;
    return null;
  };
  const bad = [];
  for (const f of files) {
    const html = read(f);
    for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
      const href = m[1].replace(/&amp;/g, '&');
      if (/^(https?:|mailto:|tel:|javascript:)/.test(href)) continue;
      if (href === '#' || href === '') { if (!/id="appStoreBtn"/.test(m[0])) bad.push(f + ': empty link ' + href); continue; }
      const [p, hash] = href.split('#');
      const target = p === '' ? f : exists(p.startsWith('/') ? p : path.posix.join(path.posix.dirname(f), p));
      if (!target) { bad.push(f + ' -> ' + href); continue; }
      if (hash && !read(target).includes('id="' + hash + '"')) bad.push(f + ' -> ' + href + ' (anchor missing)');
    }
  }
  assert.deepEqual(bad, []);
});

test('every Google Play link on the site points to one of the two live SevaGo apps', () => {
  const ok = new Set(['com.sevago.app', 'in.sevago.partner']);
  const bad = [];
  for (const f of htmlFiles().concat(['js/download.js', 'js/site.js', 'seo/site.json'])) {
    const text = read(f);
    for (const m of text.matchAll(/play\.google\.com\/store\/apps\/details\?id=([A-Za-z0-9._]+)/g)) if (!ok.has(m[1])) bad.push(f + ' ' + m[1]);
    assert.ok(!/initio/.test(text), f + ' still references the dead com.app.initio.sevago listing');
  }
  assert.deepEqual(bad, []);
});

test('home page: no investor content, no legal popup, no random-dot canvas, working store links', () => {
  const html = read('index.html');
  assert.ok(!/investor/i.test(html), 'investor mention left');
  assert.ok(!html.includes('openLegal') && !html.includes('legalModal'));
  assert.ok(!html.includes('<canvas id="hero-canvas"'));
  assert.ok(html.includes('href="/privacy"') && html.includes('href="/terms"'));
  assert.ok(html.includes('id="stickyCta"') && html.includes('id="journey"') && html.includes('id="services"'));
  assert.ok(/<div class="hero-art"/.test(html));
  assert.ok(Buffer.byteLength(html) < 400 * 1024, 'index.html should stay small (images are separate files)');
  // JS-built CTAs must also use the live apps
  assert.ok(html.includes("ctaBtn.href='https://play.google.com/store/apps/details?id=in.sevago.partner"));
  assert.ok(html.includes("ctaBtn.href='https://play.google.com/store/apps/details?id=com.sevago.app"));
});

test('landing pages avoid claims SevaGo has not published', () => {
  const banned = [/guarantee/i, /\bbest\b/i, /#1\b/, /instant(ly)?\b/i, /\d+\s*(\+|plus)?\s*partners/i, /within \d+ minutes/i, /free of cost/i];
  for (const p of pages) {
    const html = read(p.slug ? `coimbatore/${p.slug}.html` : 'coimbatore/index.html');
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    for (const re of banned) assert.ok(!re.test(text), (p.slug || 'hub') + ' contains unverified claim ' + re);
  }
});
