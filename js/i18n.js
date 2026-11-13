/* DailyVet i18n — English <-> Bangla toggle (standalone; touches no other script).
 * Looks up exact English text in window.DV_BN (js/i18n-bn.js) and swaps it in the DOM.
 * Anything without a dictionary entry stays English. Originals are kept so EN restores perfectly.
 * Console helpers:  DVI18N.missing()  -> English strings seen on this page that have no Bangla yet.
 */
(function () {
  'use strict';
  var KEY = 'dv_lang';
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, SVG: 1 };
  var DICT = {}, PATTERNS = [];
  var lang = 'en';
  var nodeOrig = new WeakMap();   // text node -> {en, bn}
  var attrOrig = new WeakMap();   // element -> {attr: {en, bn}}
  var seenMissing = {};
  var busy = false;

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  function loadDict() {
    var src = window.DV_BN || {};
    DICT = {}; LOWER = {};
    Object.keys(src).forEach(function (k) { var n = norm(k); DICT[n] = src[k]; var l = n.toLowerCase(); if (!LOWER.hasOwnProperty(l)) LOWER[l] = src[k]; });
    PATTERNS = window.DV_BN_PATTERNS || [];
  }

  // Split "🐕 Dog" / "Step 1/2:" style strings into prefix + core + suffix, so emoji/punctuation need no own entry.
  var EDGE = /^([^A-Za-z0-9ঀ-৿]*)([\s\S]*?)([^A-Za-z0-9ঀ-৿%)]*)$/;

  var BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  function bnDigits(t) { return t.replace(/[0-9]/g, function (d) { return BN_DIGITS.charAt(+d); }); }
  // a bare number with an optional short unit: "40", "79.0 THI", "149 AQI", "52%"
  var NUMLIKE = /^[\s\d.,:%+\-–\/°]*\d[\s\d.,:%+\-–\/°]*[A-Za-z%°]{0,6}$/;
  var LOWER = {};

  function lookup(k) {
    if (DICT.hasOwnProperty(k)) return DICT[k];
    var l = k.toLowerCase();
    if (LOWER.hasOwnProperty(l)) return LOWER[l];
    return null;
  }

  function translate(text) {
    var core = norm(text);
    if (!core) return null;
    if (!/[A-Za-z]{2}/.test(core)) return null;
    var hit = lookup(core);
    if (hit !== null) return hit;
    var pm = core.match(/^([^A-Za-z0-9ঀ-৿]+)([\s\S]+)$/);
    if (pm && (hit = lookup(pm[2])) !== null) return pm[1] + hit;
    var m = core.match(EDGE);
    if (m && m[2] && (m[1] || m[3]) && (hit = lookup(m[2])) !== null) return m[1] + hit + m[3];
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i];
      if (p[0].test(core)) return bnDigits(core.replace(p[0], p[1]));
    }
    // "Gulshan, Dhaka" / "Dhaka, Bangladesh": translate each comma-separated part we know
    if (core.length < 120 && core.indexOf(',') > 0) {
      var parts = core.split(/\s*,\s*/);
      if (parts.length <= 6) {
        var hits = 0;
        var outp = parts.map(function (x) { var h = lookup(x); if (h !== null) { hits++; return h; } return x; });
        if (hits * 2 >= parts.length) return outp.join(', ');
      }
    }
    return null;
  }

  // Bangla sentences that embed an English animal name (e.g. "cow-এর টিকার সময়...")
  var WORDS = {
    cow: 'গরু', cows: 'গরু', cattle: 'গবাদিপশু', bull: 'ষাঁড়', calf: 'বাছুর', buffalo: 'মহিষ', goat: 'ছাগল', goats: 'ছাগল',
    sheep: 'ভেড়া', chicken: 'মুরগি', hen: 'মুরগি', poultry: 'হাঁস-মুরগি', duck: 'হাঁস', dog: 'কুকুর', cat: 'বিড়াল',
    horse: 'ঘোড়া', rabbit: 'খরগোশ', pigeon: 'কবুতর', fish: 'মাছ', bird: 'পাখি', parrot: 'টিয়া', quail: 'কোয়েল'
  };
  function translateMixed(text) {
    if (!/[ঀ-৿]/.test(text) || !/[A-Za-z]/.test(text)) return null;
    var changed = false;
    var out = text.replace(/([A-Za-z]+)(-এর|-কে|-র)?/g, function (all, w, suf) {
      var v = WORDS[w.toLowerCase()];
      if (!v) return all;
      changed = true;
      if (!suf) return v;
      if (suf === '-কে') return v + 'কে';
      return v + (/[ুিা]$/.test(v) ? 'র' : 'ের');   // ু ি া -> র, otherwise -ের
    });
    return changed ? bnDigits(out) : null;
  }

  // numbers like "40" or "79.0 THI" -> Bangla digits (only plain number-ish text)
  function translateNumber(text) {
    var core = norm(text);
    if (core && /[0-9]/.test(core) && (NUMLIKE.test(core) || /[ঀ-৿]/.test(core))) return bnDigits(core);
    return null;
  }

  function keepSpacing(orig, bn) {
    var lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0];
    return lead + bn + trail;
  }

  function skipEl(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (SKIP_TAGS[n.tagName.toUpperCase()]) return true;
      if (n.classList && n.classList.contains('notranslate')) return true;
      if (n.getAttribute && (n.getAttribute('translate') === 'no' || n.isContentEditable)) return true;
      if (n.classList && n.classList.contains('dv-lang-dd')) return true;
    }
    return false;
  }

  function doTextNode(node) {
    var rec = nodeOrig.get(node);
    var cur = node.nodeValue;
    if (rec && cur === rec.bn) { // already ours
      if (lang === 'en') { node.nodeValue = rec.en; }
      return;
    }
    // new text, or the page changed it after we translated: treat as new original
    if (lang === 'en') { if (rec) nodeOrig.delete(node); noteMissingIfNeeded(cur, false); return; }
    var bn = translate(cur);
    if (bn == null) bn = translateMixed(cur);
    if (bn == null) bn = translateNumber(cur);
    if (bn == null) { nodeOrig.delete(node); noteMissingIfNeeded(cur, true); return; }
    var out = keepSpacing(cur, bn);
    nodeOrig.set(node, { en: cur, bn: out });
    node.nodeValue = out;
  }

  function noteMissingIfNeeded(t, count) {
    var c = norm(t);
    if (c && /[A-Za-z]{3}/.test(c) && !translate(c)) seenMissing[c] = 1;
  }

  function doAttrs(el) {
    var store = attrOrig.get(el) || {};
    var names = ATTRS.slice();
    if (el.tagName === 'INPUT' && /^(submit|button|reset)$/i.test(el.type)) names.push('value');
    names.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var cur = el.getAttribute(a), rec = store[a];
      if (rec && cur === rec.bn) { if (lang === 'en') el.setAttribute(a, rec.en); return; }
      if (lang === 'en') { delete store[a]; noteMissingIfNeeded(cur); return; }
      var bn = translate(cur);
      if (bn == null) { delete store[a]; noteMissingIfNeeded(cur); return; }
      store[a] = { en: cur, bn: bn };
      el.setAttribute(a, bn);
    });
    attrOrig.set(el, store);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && !skipEl(root.parentNode)) doTextNode(root); return; }
    if (root.nodeType !== 1 || skipEl(root)) return;
    doAttrs(root);
    var w = document.createTreeWalker(root, 1 | 4, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return skipEl(n) ? 2 /*REJECT subtree*/ : 1;
        return 1;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) doTextNode(n); else doAttrs(n);
    }
  }

  var titleEn = null, titleBn = null;
  function doTitle() {
    var cur = document.title;
    // first run, or the page set a brand-new title itself: remember it as the English original
    if (titleEn === null || (cur !== titleEn && cur !== titleBn)) titleEn = cur;
    if (lang === 'bn') {
      titleBn = translate(titleEn) || titleEn;
      document.title = titleBn;
    } else {
      document.title = titleEn;
    }
  }

  function run() {
    busy = true;
    try { walk(document.body); doTitle(); } catch (e) { /* never break the page */ }
    busy = false;
  }

  var mo = null, pending = [], timer = null;
  function onMutations(list) {
    if (busy) return;
    list.forEach(function (m) {
      if (m.type === 'childList') m.addedNodes.forEach(function (n) { pending.push(n); });
      else if (m.type === 'characterData') pending.push(m.target);
      else if (m.type === 'attributes') pending.push(m.target);
    });
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      var batch = pending; pending = [];
      busy = true;
      try { batch.forEach(function (n) { if (n.isConnected) walk(n); }); } catch (e) {}
      busy = false;
    }, 30);
  }
  function startObserver() {
    if (mo || !document.body) return;
    mo = new MutationObserver(onMutations);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // ---- UI ----
  // Language is chosen from a dropdown that sits in the top navbar (next to Sign In / bell).
  var CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%230f5132' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";
  var GLOBE = '<svg class="dv-lang-globe" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

  function injectStyle() {
    if (document.getElementById('dv-lang-style')) return;
    var s = document.createElement('style'); s.id = 'dv-lang-style';
    s.textContent =
      '.dv-lang-dd{position:relative;display:inline-flex;align-items:center;flex-shrink:0;margin:0}' +
      '.dv-lang-dd .dv-lang-globe{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#0f5132;pointer-events:none}' +
      '.dv-lang-dd select{-webkit-appearance:none;-moz-appearance:none;appearance:none;height:40px;margin:0;' +
      'padding:0 30px 0 32px;border:1.5px solid #c9ded6;border-radius:9999px;cursor:pointer;color:#0f5132;' +
      'background:#e8f5f0 ' + CHEVRON + ' no-repeat right 11px center/10px 6px;font:700 13px/1 Inter,system-ui,sans-serif;' +
      'transition:background-color .15s,border-color .15s;max-width:none;width:auto}' +
      '.dv-lang-dd select:hover{background-color:#d1e7dd;border-color:#0e7c7b}' +
      '.dv-lang-dd select:focus-visible{outline:2px solid #0e7c7b;outline-offset:2px}' +
      '.dv-lang-dd select option{color:#0f5132;background:#fff;font-weight:600}' +
      '.dv-lang-dd .dv-lang-select{position:absolute;inset:0;opacity:0;pointer-events:none;width:100%}' +
      '.dv-lang-dd .dv-lang-trigger{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 12px 0 34px;border:1.5px solid #c9ded6;border-radius:9999px;cursor:pointer;color:#0f5132;background:#e8f5f0;font:700 13px/1 Inter,"Noto Sans Bengali",system-ui,sans-serif;transition:background-color .15s,border-color .15s,box-shadow .15s}' +
      '.dv-lang-dd .dv-lang-trigger:hover,.dv-lang-dd.dv-open .dv-lang-trigger{background:#d1e7dd;border-color:#0e7c7b}' +
      '.dv-lang-dd.dv-open .dv-lang-trigger{box-shadow:0 0 0 3px rgba(14,124,123,.15)}' +
      '.dv-lang-dd .dv-lang-trigger:focus-visible{outline:2px solid #0e7c7b;outline-offset:2px}' +
      '.dv-lang-dd .dv-lang-caret{width:10px;height:6px;transition:transform .2s}' +
      '.dv-lang-dd.dv-open .dv-lang-caret{transform:rotate(180deg)}' +
      '.dv-lang-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:100%;width:max-content;margin:0;padding:6px;list-style:none;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 12px 32px rgba(15,23,42,.16),0 2px 6px rgba(15,23,42,.06);z-index:100000;opacity:0;visibility:hidden;transform:translateY(-6px) scale(.97);transform-origin:top right;transition:opacity .15s,transform .15s,visibility .15s}' +
      '.dv-lang-dd.dv-open .dv-lang-menu{opacity:1;visibility:visible;transform:none}' +
      '.dv-lang-menu li{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 12px;border-radius:9px;cursor:pointer;color:#0f172a;font:600 13.5px/1.2 Inter,"Noto Sans Bengali",system-ui,sans-serif;white-space:nowrap}' +
      '.dv-lang-menu li:hover,.dv-lang-menu li:focus-visible{background:#f0fdfa;outline:none}' +
      '.dv-lang-menu li[aria-selected="true"]{background:#e8f5f0;color:#0e7c7b;font-weight:700}' +
      '.dv-lang-menu li .dv-lang-tick{width:14px;height:14px;opacity:0;color:#0e7c7b}' +
      '.dv-lang-menu li[aria-selected="true"] .dv-lang-tick{opacity:1}' +
      '@media (prefers-color-scheme:dark){.dv-lang-menu{background:#1e293b;border-color:#334155}.dv-lang-menu li{color:#e2e8f0}.dv-lang-menu li:hover{background:#0f2f33}.dv-lang-menu li[aria-selected="true"]{background:#134e4a;color:#5eead4}}' +
      '.dv-lang-dd.dv-lang-fixed{position:fixed;top:12px;right:12px;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,.18);border-radius:9999px}' +
      '.auth-lang-toggle{display:none!important}' +
      '.dv-auth-right{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}' +
      '@media (max-width:479px){.dv-lang-dd .dv-lang-trigger{height:36px;padding:0 10px 0 29px;font-size:12px}.dv-lang-dd select{height:36px;padding:0 24px 0 27px;font-size:12px;background-position:right 8px center}.dv-lang-dd .dv-lang-globe{left:9px;width:13px;height:13px}}' +
      '@media (max-width:359px){.dv-lang-dd .dv-lang-globe{display:none}.dv-lang-dd select{padding-left:10px;padding-right:22px;height:32px}}' +
      'html[lang="bn"] body,html[lang="bn"] input,html[lang="bn"] button,html[lang="bn"] select,html[lang="bn"] textarea' +
      '{font-family:"Noto Sans Bengali",Inter,system-ui,sans-serif}' +
      'html[lang="bn"] body{line-height:1.7}' +
      '@media print{.dv-lang-dd{display:none!important}}';
    document.head.appendChild(s);
    if (!document.querySelector('link[href*="Noto+Sans+Bengali"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap';
      document.head.appendChild(l);
    }
  }

  function makeDropdown() {
    var wrap = document.createElement('label');
    wrap.className = 'dv-lang-dd notranslate';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML = GLOBE +
      '<select class="dv-lang-select" aria-label="Language" title="Language">' +
      '<option value="en">English</option><option value="bn">বাংলা</option></select>' +
      '<button type="button" class="dv-lang-trigger" aria-haspopup="listbox" aria-expanded="false"><span class="dv-lang-label"></span>' +
      '<svg class="dv-lang-caret" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg></button>' +
      '<ul class="dv-lang-menu" role="listbox" tabindex="-1">' +
      [['en','English'],['bn','বাংলা']].map(function (o) {
        return '<li role="option" tabindex="0" data-v="' + o[0] + '">' + o[1] +
          '<svg class="dv-lang-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg></li>';
      }).join('') + '</ul>';
    var sel = wrap.querySelector('select'), trg = wrap.querySelector('.dv-lang-trigger'), menu = wrap.querySelector('.dv-lang-menu');
    function close() { wrap.classList.remove('dv-open'); trg.setAttribute('aria-expanded', 'false'); }
    trg.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var open = !wrap.classList.contains('dv-open');
      [].forEach.call(document.querySelectorAll('.dv-lang-dd.dv-open'), function (d) { d.classList.remove('dv-open'); });
      wrap.classList.toggle('dv-open', open); trg.setAttribute('aria-expanded', String(open));
    });
    function pick(li) { if (!li) return; close(); setLang(li.getAttribute('data-v')); trg.focus(); }
    menu.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); pick(e.target.closest('li')); });
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e.target.closest('li')); }
      if (e.key === 'ArrowDown' && e.target.nextElementSibling) { e.preventDefault(); e.target.nextElementSibling.focus(); }
      if (e.key === 'ArrowUp' && e.target.previousElementSibling) { e.preventDefault(); e.target.previousElementSibling.focus(); }
    });
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); trg.focus(); } });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
    sel.addEventListener('change', function (e) { setLang(e.target.value); });
    return wrap;
  }

  // Where the dropdown goes, in priority order. Each host gets its own copy; all copies stay in sync.
  var HOSTS = [
    { sel: '.page-actions',      mode: 'first' },   // landing page: before "Sign In"
    { sel: '.dv-nav-actions',    mode: 'first' },   // app navbar: before the bell
    { sel: '.auth-mobile-actions', mode: 'first' }, // login / signup (mobile bar)
    { sel: '.auth-top-nav',      mode: 'authtop' }  // login / signup (desktop bar)
  ];

  function mountInto(host, mode) {
    if (host.querySelector('.dv-lang-dd')) return 0;
    var dd = makeDropdown();
    if (mode === 'authtop') {
      var sw = host.querySelector('.auth-top-switch');
      var wrap = document.createElement('div'); wrap.className = 'dv-auth-right';
      if (sw) { host.insertBefore(wrap, sw); wrap.appendChild(dd); wrap.appendChild(sw); }
      else { host.appendChild(wrap); wrap.appendChild(dd); }
    } else {
      host.insertBefore(dd, host.firstChild);
    }
    return 1;
  }

  function mountAll() {
    var n = 0;
    HOSTS.forEach(function (h) {
      [].forEach.call(document.querySelectorAll(h.sel), function (el) { n += mountInto(el, h.mode); });
    });
    return n;
  }

  function buildToggle() {
    mountAll();
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.auth-lang-btn[data-lang]');
      if (b) setLang(b.getAttribute('data-lang'));
    });
    // The app navbar is injected by dailyvet-nav.js; if it isn't there yet, wait for it, then fall back to a fixed corner dropdown.
    if (!document.querySelector('.dv-lang-dd')) {
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        mountAll();
        if (document.querySelector('.dv-lang-dd')) { clearInterval(t); paintToggle(); }
        else if (tries >= 10) {
          clearInterval(t);
          var dd = makeDropdown(); dd.classList.add('dv-lang-fixed'); document.body.appendChild(dd); paintToggle();
        }
      }, 100);
    }
    paintToggle();
  }

  function paintToggle() {
    [].forEach.call(document.querySelectorAll('.auth-lang-btn[data-lang]'), function (b) {
      b.classList.toggle('auth-lang-active', b.getAttribute('data-lang') === lang);
    });
    [].forEach.call(document.querySelectorAll('.dv-lang-select'), function (s) { if (s.value !== lang) s.value = lang; });
    [].forEach.call(document.querySelectorAll('.dv-lang-dd'), function (d) {
      var l = d.querySelector('.dv-lang-label'); if (l) l.textContent = lang === 'bn' ? 'বাংলা' : 'English';
      [].forEach.call(d.querySelectorAll('.dv-lang-menu li'), function (li) { li.setAttribute('aria-selected', String(li.getAttribute('data-v') === lang)); });
    });
  }

  function setLang(l) {
    if (l !== 'bn') l = 'en';
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    document.documentElement.setAttribute('lang', l);
    paintToggle();
    run();
    try { document.dispatchEvent(new CustomEvent('dv-lang-change', { detail: { lang: l } })); } catch (e) {}
  }

  function init() {
    loadDict();
    injectStyle();
    buildToggle();
    startObserver();
    var saved = 'en';
    try { saved = localStorage.getItem(KEY) || 'en'; } catch (e) {}
    setLang(saved);
  }

  // Browser popups (alert/confirm/prompt) are not in the DOM; translate their message text too.
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function (msg) {
      var a = arguments;
      try {
        if (lang === 'bn' && typeof msg === 'string') {
          var t = translate(msg);
          if (t) { a = [].slice.call(arguments); a[0] = t; }
        }
      } catch (e) {}
      return orig.apply(window, a);
    };
  });

  window.DVI18N = {
    get lang() { return lang; },
    set: setLang,
    t: function (s) { return lang === 'bn' ? (translate(s) || s) : s; },
    refresh: function () { loadDict(); run(); },
    missing: function () { var k = Object.keys(seenMissing); console.log(k.length + ' untranslated strings'); return k; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
