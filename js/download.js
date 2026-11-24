/* SevaGo app download panel: device detection, configurable iOS button, waitlist form, funnel tracking. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SevaDownload = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 'ios' | 'android' | 'desktop' | 'other' */
  function detectPlatform(nav) {
    nav = nav || {};
    var ua = String(nav.userAgent || '');
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    // iPadOS 13+ reports itself as a Mac but has a touch screen
    if (/Macintosh/i.test(ua) && Number(nav.maxTouchPoints) > 1) return 'ios';
    if (/Windows|Macintosh|Linux|CrOS|X11/i.test(ua)) return 'desktop';
    return 'other';
  }

  /**
   * site-config.json -> what the iOS button should do.
   * Only a real https://apps.apple.com/... (or itunes.apple.com) URL switches it to the App Store.
   */
  function resolveIosConfig(cfg) {
    var ios = (cfg && cfg.ios) || {};
    if (ios.mode === 'appstore' && typeof ios.appStoreUrl === 'string') {
      try {
        var u = new URL(ios.appStoreUrl);
        if (u.protocol === 'https:' && /^(apps|itunes)\.apple\.com$/.test(u.hostname)) {
          return { mode: 'appstore', url: u.toString() };
        }
      } catch (e) { /* fall through */ }
    }
    return { mode: 'waitlist', url: null };
  }

  /** Light client-side check; the server validates again and is the source of truth. */
  function looksLikeContact(v) {
    v = String(v || '').trim();
    if (v.indexOf('@') > -1) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    var d = v.replace(/\D/g, '');
    return /^[\d\s+().-]+$/.test(v) && d.length >= 10 && d.length <= 15;
  }

  function sessionId() {
    var a = new Uint8Array(12);
    (self.crypto || window.crypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function init(doc) {
    var panel = doc.getElementById('downloadPanel');
    if (!panel) return;
    var nav = window.navigator;
    var platform = detectPlatform(nav);
    panel.setAttribute('data-platform', platform);

    var sid = sessionId();
    var params = new URLSearchParams(window.location.search);
    var source = params.get('utm_source') || (document.referrer ? new URL(document.referrer).hostname : 'direct');

    function track(event) {
      try {
        var payload = { event: event, platform: platform, sessionId: sid, source: String(source).slice(0, 60) };
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'sevago_' + event, platform: platform });
        if (typeof window.gtag === 'function') window.gtag('event', event, { platform: platform });
        var body = JSON.stringify(payload);
        if (nav.sendBeacon && nav.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))) return;
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
      } catch (e) { /* tracking must never break the page */ }
    }

    window.SevaTrack = track;
    window.SevaPlatform = platform;

    var playCard = panel.querySelector('.dl-play');
    var iosCard = panel.querySelector('.dl-ios');
    var detect = doc.getElementById('dlDetect');
    var openBtn = doc.getElementById('waitlistOpen');
    var storeBtn = doc.getElementById('appStoreBtn');
    var form = doc.getElementById('waitlistForm');
    var success = doc.getElementById('waitlistSuccess');
    var statusEl = doc.getElementById('waitlistStatus');
    var submitBtn = doc.getElementById('waitlistSubmit');
    var iosSub = doc.getElementById('iosSub');
    var iosMode = 'waitlist';

    // Prioritise the relevant store
    if (platform === 'ios') {
      iosCard.classList.add('is-primary');
      detect.textContent = 'Looks like you’re on an iPhone or iPad.';
      detect.hidden = false;
    } else if (platform === 'android') {
      playCard.classList.add('is-primary');
      detect.textContent = 'Looks like you’re on Android. SevaGo is ready for you.';
      detect.hidden = false;
    }

    // Config: waitlist by default, App Store after approval (edit site-config.json)
    function applyIosConfig(cfg) {
      var c = resolveIosConfig(cfg);
      iosMode = c.mode;
      if (c.mode === 'appstore') {
        storeBtn.href = c.url;
        storeBtn.hidden = false;
        openBtn.hidden = true;
        form.hidden = true;
        success.hidden = true;
        iosSub.textContent = 'SevaGo is now on the App Store.';
        iosCard.querySelector('.dl-chip').textContent = 'Available now';
      } else {
        storeBtn.hidden = true;
        var already = false;
        try { already = !!localStorage.getItem('sg_ios_wl'); } catch (e) { /* storage blocked */ }
        if (already) { form.hidden = true; openBtn.hidden = true; success.hidden = false; }
        else if (platform === 'ios') { openBtn.hidden = true; form.hidden = false; }
        else { openBtn.hidden = false; form.hidden = true; }
      }
    }
    applyIosConfig(null);
    fetch('/site-config.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { if (cfg) applyIosConfig(cfg); })
      .catch(function () { /* keep waitlist default */ });

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.SevaOpenWaitlist = function () {
      panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      if (iosMode === 'appstore') { track('app_store_click'); window.open(storeBtn.href, '_blank', 'noopener'); return; }
      if (!openBtn.hidden) { openBtn.click(); }
      else if (!form.hidden) { var f = form.querySelector('input[name="name"]'); if (f) f.focus({ preventScroll: true }); }
    };

    track('download_view');

    openBtn.addEventListener('click', function () {
      track('waitlist_open');
      openBtn.hidden = true;
      form.hidden = false;
      openBtn.setAttribute('aria-expanded', 'true');
      var first = form.querySelector('input[name="name"]');
      if (first) first.focus();
    });

    var started = false;
    var shownAt = Date.now();
    function markStarted() {
      if (!started) { started = true; shownAt = Date.now(); track('waitlist_start'); }
    }
    form.addEventListener('focusin', markStarted);
    form.addEventListener('input', markStarted);

    function fieldError(name, msg) {
      var input = form.elements[name];
      var err = doc.getElementById('err-' + name);
      if (input && input.setAttribute) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg || '';
    }
    ['name', 'contact', 'city', 'consent'].forEach(function (n) { fieldError(n, ''); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      statusEl.textContent = '';
      var d = {
        name: form.elements.name.value.trim(),
        contact: form.elements.contact.value.trim(),
        city: form.elements.city.value.trim(),
        consent: form.elements.consent.checked,
        website: form.elements.website.value,
      };
      var bad = false;
      fieldError('name', d.name.length < 2 ? 'Enter your name.' : ''); if (d.name.length < 2) bad = true;
      var okContact = looksLikeContact(d.contact);
      fieldError('contact', okContact ? '' : 'Enter a valid email or mobile number.'); if (!okContact) bad = true;
      fieldError('city', d.city.length < 2 ? 'Enter your city.' : ''); if (d.city.length < 2) bad = true;
      fieldError('consent', d.consent ? '' : 'Please tick the box so we can notify you.'); if (!d.consent) bad = true;
      if (bad) { var firstBad = form.querySelector('[aria-invalid="true"]'); if (firstBad) firstBad.focus(); return; }

      track('waitlist_submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Joining…';
      fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: d.name, contact: d.contact, city: d.city, consent: true, website: d.website,
          elapsedMs: Date.now() - shownAt, source: source,
          utm_source: params.get('utm_source') || '', utm_medium: params.get('utm_medium') || '',
          utm_campaign: params.get('utm_campaign') || '',
        }),
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.body && res.body.ok) {
            track(res.body.status === 'duplicate' ? 'waitlist_duplicate' : 'waitlist_success');
            try { localStorage.setItem('sg_ios_wl', '1'); } catch (e) { /* ignore */ }
            doc.getElementById('successTitle').textContent = res.body.status === 'duplicate' ? 'You’re already on the list' : 'You’re on the list!';
            form.hidden = true;
            success.hidden = false;
            success.focus();
            return;
          }
          track('waitlist_error');
          if (res.status === 422 && res.body.fields) {
            Object.keys(res.body.fields).forEach(function (k) { fieldError(k, res.body.fields[k]); });
          } else if (res.status === 429) {
            statusEl.textContent = 'Too many attempts. Please try again in a few minutes.';
          } else {
            statusEl.textContent = 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          track('waitlist_error');
          statusEl.textContent = 'Network problem. Please check your connection and try again.';
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Notify me when it’s live';
        });
    });
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
    else init(document);
  }

  return { detectPlatform: detectPlatform, resolveIosConfig: resolveIosConfig, looksLikeContact: looksLikeContact };
});
