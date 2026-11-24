'use strict';
/**
 * Generates the indexable static pages (no client-side rendering needed for crawlers):
 *   coimbatore/index.html + coimbatore/<slug>.html, sitemap.xml, robots.txt,
 * and writes Search Console / Bing verification tags (seo/site.json) into index.html.
 *
 *   node scripts/build-seo.js          write files
 *   node scripts/build-seo.js --check  exit 1 if committed files differ (used by npm test)
 */
const fs = require('fs');
const path = require('path');
const site = require('../seo/site.json');
const { pages, UPDATED } = require('../seo/pages');

const ROOT = path.join(__dirname, '..');
const O = site.origin;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (s) => esc(s)
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => '<a href="' + u.replace(/&amp;/g, '&amp;') + '">' + t + '</a>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const plain = (s) => String(s).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '');
const urlOf = (p) => (p.slug ? '/coimbatore/' + p.slug : '/coimbatore');
const playP = esc(site.playPoster), playR = esc(site.playPartner);

const GP = '<svg width="22" height="24" viewBox="0 0 26 28" aria-hidden="true"><path d="M1.5 0.4 L1.5 27.6 L14.8 14 Z" fill="#4FC3F7"/><path d="M1.5 0.4 L19.2 10.4 L14.8 14 Z" fill="#81C784"/><path d="M14.8 14 L19.2 17.6 L1.5 27.6 Z" fill="#F48FB1"/><path d="M19.2 10.4 L23.5 14 L19.2 17.6 L14.8 14 Z" fill="#FFD54F"/></svg>';
const APPLE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>';

function ctaBlock(p) {
  if (p.cta === 'partner') {
    return `<section class="cta" aria-labelledby="cta-h"><h2 id="cta-h">Start earning with SevaGo Partner</h2>
  <p>Android app. KYC verified. Choose tasks near you.</p>
  <div class="cta-row"><a class="btn btn-gold" href="${playR}" data-track="partner_play_click" target="_blank" rel="noopener">${GP}<span>Get SevaGo Partner on Google Play</span></a></div>
  <p class="cta-note">Want to post a task instead? <a href="/coimbatore/errand-services">See how posting works</a>.</p></section>`;
  }
  return `<section class="cta" aria-labelledby="cta-h"><h2 id="cta-h">Get SevaGo</h2>
  <p>Post your task and get help nearby.</p>
  <div class="cta-row">
    <a class="btn btn-gold btn-play" href="${playP}" data-track="play_store_click" target="_blank" rel="noopener">${GP}<span>Get it on Google Play</span></a>
    <a class="btn btn-dark btn-ios" href="/#download" data-track="waitlist_cta_click">${APPLE}<span>Join the iOS waitlist</span></a>
  </div>
  <p class="cta-note">Coming soon on the App Store. Want to earn instead? <a href="/coimbatore/part-time-jobs">Become a Partner</a>.</p></section>`;
}

function section(s) {
  let h = '<section class="block"><h2>' + esc(s.h2) + '</h2>';
  (s.paras || []).forEach((x) => { h += '<p>' + fmt(x) + '</p>'; });
  if (s.list) h += '<ul>' + s.list.map((x) => '<li>' + fmt(x) + '</li>').join('') + '</ul>';
  if (s.ol) h += '<ol>' + s.ol.map((x) => '<li>' + fmt(x) + '</li>').join('') + '</ol>';
  return h + '</section>';
}

function renderPage(p) {
  const url = O + urlOf(p);
  const crumbs = [{ n: 'Home', u: O + '/' }, { n: 'Coimbatore', u: O + '/coimbatore' }];
  if (p.slug) crumbs.push({ n: p.crumb, u: url });
  const ld = [
    { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.n, item: c.u })) },
    { '@type': 'WebPage', '@id': url + '#page', url, name: p.title, description: p.description, inLanguage: 'en-IN', isPartOf: { '@id': O + '/#site' }, dateModified: UPDATED },
  ];
  if (p.kind !== 'hub' || true) {
    ld.push({
      '@type': 'Service', '@id': url + '#service', name: p.service || 'Errands and local help',
      serviceType: p.service || 'Errands and local help', provider: { '@id': O + '/#org' },
      areaServed: { '@type': 'City', name: 'Coimbatore', address: { '@type': 'PostalAddress', addressRegion: 'Tamil Nadu', addressCountry: 'IN' } },
      url, description: p.description,
    });
  }
  if (p.faqs && p.faqs.length) {
    ld.push({ '@type': 'FAQPage', mainEntity: p.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })) });
  }
  const related = (p.related || []).map((s) => pages.find((x) => x.slug === s)).filter(Boolean);
  const verif = verificationTags();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0539A2">
${verif}<meta property="og:type" content="website">
<meta property="og:site_name" content="SevaGo">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${O}/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/assets/logo.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/pages.css">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld })}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-nav">
  <a class="brand" href="/" aria-label="SevaGo home"><img src="/assets/logo.jpg" alt="" width="34" height="34">SevaGo</a>
  <nav aria-label="Main"><a href="/#journey">How it works</a><a href="/#services">Services</a><a href="/coimbatore"${p.slug ? '' : ' aria-current="page"'}>Coimbatore</a><a href="/careers">Careers</a></nav>
</header>
<main id="main">
  <div class="hero"><div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span>${p.slug ? '<a href="/coimbatore">Coimbatore</a><span aria-hidden="true">›</span><span aria-current="page">' + esc(p.crumb) + '</span>' : '<span aria-current="page">Coimbatore</span>'}</nav>
    <h1>${esc(p.h1)}</h1>
    ${p.intro.map((x) => '<p class="lead">' + fmt(x) + '</p>').join('\n    ')}
  </div></div>
  <div class="wrap content">
    ${p.sections.map(section).join('\n    ')}
    ${ctaBlock(p)}
    ${p.faqs ? '<section class="block faq"><h2>Frequently asked questions</h2>' + p.faqs.map((f) => '<details><summary>' + esc(f.q) + '</summary><p>' + fmt(f.a) + '</p></details>').join('') + '</section>' : ''}
    ${related.length ? '<section class="block related"><h2>Related</h2><ul>' + related.map((r) => '<li><a href="' + urlOf(r) + '">' + esc(r.h1) + '</a></li>').join('') + '</ul></section>' : ''}
    <p class="updated">Last updated ${UPDATED}. Questions? <a href="mailto:${site.email}">${site.email}</a></p>
  </div>
</main>
<footer class="footer"><div class="wrap">
  <div class="f-links"><a href="/">Home</a><a href="/coimbatore">Coimbatore</a><a href="/coimbatore/errand-services">Errand services</a><a href="/coimbatore/part-time-jobs">Earn with SevaGo</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></div>
  <p>© 2026 ${esc(site.orgName)}</p>
</div></footer>
<script src="/js/pages.js" defer></script>
</body>
</html>
`;
}

function verificationTags() {
  let h = '';
  if (site.verification.google) h += '<meta name="google-site-verification" content="' + esc(site.verification.google) + '">\n';
  if (site.verification.bing) h += '<meta name="msvalidate.01" content="' + esc(site.verification.bing) + '">\n';
  return h;
}

function sitemap() {
  const urls = [{ loc: O + '/', lastmod: UPDATED, priority: '1.0' }]
    .concat(pages.map((p) => ({ loc: O + urlOf(p), lastmod: UPDATED, priority: p.slug ? '0.8' : '0.9' })))
    .concat(site.staticPages.map((s) => ({ loc: O + s.path, lastmod: s.lastmod, priority: s.priority })));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => '  <url>\n    <loc>' + u.loc + '</loc>\n    <lastmod>' + u.lastmod + '</lastmod>\n    <priority>' + u.priority + '</priority>\n  </url>').join('\n') + '\n</urlset>\n';
}

const robots = () => 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ' + O + '/sitemap.xml\n';

function homepageWithVerification() {
  const f = path.join(ROOT, 'index.html');
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.replace(/\r\n/g, '\n');
  const block = '<!-- verification:start -->\n' + verificationTags() + '<!-- verification:end -->';
  if (/<!-- verification:start -->[\s\S]*?<!-- verification:end -->/.test(t)) t = t.replace(/<!-- verification:start -->[\s\S]*?<!-- verification:end -->/, block);
  else t = t.replace('</head>', block + '\n</head>');
  return crlf ? t.replace(/\n/g, '\r\n') : t;
}

function outputs() {
  const o = {};
  pages.forEach((p) => { o[p.slug ? 'coimbatore/' + p.slug + '.html' : 'coimbatore/index.html'] = renderPage(p); });
  o['sitemap.xml'] = sitemap();
  o['robots.txt'] = robots();
  o['index.html'] = homepageWithVerification();
  return o;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const out = outputs();
  let bad = 0;
  for (const [rel, content] of Object.entries(out)) {
    const f = path.join(ROOT, rel);
    const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    const lf = (s) => s.split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
    if (check) { if (cur === null || lf(cur) !== lf(content)) { console.error('out of date:', rel); bad++; } continue; }
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
  }
  if (check) process.exit(bad ? 1 : 0);
  console.log('wrote', Object.keys(out).length, 'files');
}

module.exports = { outputs, renderPage, sitemap, urlOf };
