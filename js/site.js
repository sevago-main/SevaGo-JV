/* SevaGo site interactions: staggered reveals, task journey, service-card spotlight,
   sticky mobile CTA, iOS routing and CTA click tracking. Light by design (no libraries). */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var track = function (e) { if (window.SevaTrack) window.SevaTrack(e); };
  var platform = function () { return window.SevaPlatform || 'desktop'; };

  /* ── Staggered entrances ───────────────────────────── */
  $$('.stagger').forEach(function (g) {
    Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', i); });
  });
  if (hasIO && !reduce) {
    var sio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); sio.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    $$('.stagger').forEach(function (g) { sio.observe(g); });
  } else {
    $$('.stagger').forEach(function (g) { g.classList.add('in'); });
  }

  /* ── Animated task journey ─────────────────────────── */
  var jr = $('#journey');
  if (jr) {
    var steps = $$('.jr-step', jr), screens = $$('.scr', jr), cur = 0, timer = null, userPicked = false, visible = false;
    var DUR = 4200;
    jr.style.setProperty('--jr-dur', DUR + 'ms');
    var show = function (n) {
      cur = n;
      steps.forEach(function (s, i) { s.setAttribute('aria-selected', i === n ? 'true' : 'false'); });
      screens.forEach(function (s, i) { s.classList.toggle('on', i === n); });
    };
    var schedule = function () {
      clearTimeout(timer);
      if (reduce || userPicked || !visible || document.hidden) return;
      timer = setTimeout(function () { show((cur + 1) % steps.length); schedule(); }, DUR);
    };
    steps.forEach(function (s, i) {
      s.addEventListener('click', function () { userPicked = true; jr.classList.add('jr-paused'); show(i); clearTimeout(timer); });
    });
    show(0);
    if (reduce) jr.classList.add('jr-paused');
    if (hasIO) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; schedule(); }, { threshold: 0.35 }).observe(jr);
    } else { visible = true; schedule(); }
    document.addEventListener('visibilitychange', schedule);
  }

  /* ── Service-card cursor spotlight (hover devices only) ── */
  if (window.matchMedia && window.matchMedia('(hover:hover)').matches && !reduce) {
    $$('.svc-card').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    });
  }

  /* ── iOS: poster CTAs lead to the waitlist ─────────── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var ev = a.getAttribute('data-track');
    var toWaitlist = a.getAttribute('data-store') === 'poster' && platform() === 'ios' && !a.closest('#downloadPanel') && window.SevaOpenWaitlist;
    if (ev && !toWaitlist) track(ev);
    if (toWaitlist) {
      e.preventDefault();
      var m = document.getElementById('mobileMenu'); if (m && m.classList.contains('open') && window.closeMenu) window.closeMenu();
      window.SevaOpenWaitlist();
    }
  });

  /* ── Sticky mobile CTA ─────────────────────────────── */
  var bar = $('#stickyCta'), btn = $('#stickyCtaBtn');
  if (bar && btn) {
    var mq = window.matchMedia('(max-width: 768px)');
    var panel = $('#downloadPanel'), panelVisible = false, typing = false;
    var label = function () {
      if (platform() === 'ios') { btn.textContent = 'Join the iOS waitlist'; btn.setAttribute('href', '#downloadPanel'); btn.setAttribute('data-store', 'poster'); btn.removeAttribute('target'); btn.removeAttribute('rel'); }
    };
    var update = function () {
      var past = window.scrollY > Math.min(window.innerHeight * 0.7, 520);
      bar.classList.toggle('show', mq.matches && past && !panelVisible && !typing);
    };
    label(); setTimeout(label, 600); // platform is set once download.js has run
    window.addEventListener('scroll', update, { passive: true });
    document.addEventListener('focusin', function (e) { typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName); update(); });
    document.addEventListener('focusout', function () { typing = false; update(); });
    if (hasIO && panel) new IntersectionObserver(function (es) { panelVisible = es[0].isIntersecting; update(); }, { threshold: 0.2 }).observe(panel);
    update();
  }
})();
