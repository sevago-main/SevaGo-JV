/* Landing pages: platform-aware CTA order and click tracking (same /api/track events as the home page). */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  var platform = /Android/i.test(ua) ? 'android' : ios ? 'ios' : /Windows|Macintosh|Linux|CrOS|X11/i.test(ua) ? 'desktop' : 'other';
  if (ios) document.body.classList.add('is-ios');
  var sid = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(12)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-track]');
    if (!a) return;
    try {
      var body = JSON.stringify({ event: a.getAttribute('data-track'), platform: platform, sessionId: sid, source: 'seo:' + location.pathname.slice(0, 50) });
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' })))) {
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
      }
    } catch (err) { /* never block navigation */ }
  });
})();
