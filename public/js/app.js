/* ==========================================================================
   app.js — starts the app and connects every button.
   ========================================================================== */
var App = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var device = $('device');

  /* ---------- Fit the phone screen on any laptop/monitor ---------- */
  function fitDevice() {
    if (window.innerWidth < 500) {               // real phone: fill the screen (CSS does this)
      device.style.removeProperty('--scale');
      return;
    }
    var s = Math.min(1, (window.innerHeight - 32) / 874, (window.innerWidth - 32) / 402);
    device.style.setProperty('--scale', s.toFixed(3));
  }
  window.addEventListener('resize', fitDevice);
  fitDevice();

  /* ---------- Fake status bar: live time and battery ---------- */
  function updateClock() {
    var d = new Date();
    var h = d.getHours() % 12 || 12;
    $('sbTime').textContent = h + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  updateClock();
  setInterval(updateClock, 10000);
  if (navigator.getBattery) {
    navigator.getBattery().then(function (b) {
      var show = function () { $('sbBattery').style.width = Math.max(8, Math.round(b.level * 100)) + '%'; };
      show();
      b.addEventListener('levelchange', show);
    }).catch(function () { /* not allowed: keep the default */ });
  }

  /* ---------- Toast (short message at the top) ---------- */
  var toastTimer = 0;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  /* ---------- Home: my name + "everyone together" totals ---------- */
  function renderStats(t) {
    if (!t) return;
    $('statActions').textContent = t.actions;
    $('statQuizzes').textContent = t.quizzes;
    $('statGames').textContent = t.games;
  }
  function refreshStats() {
    renderStats(Store.get('statsCache', null));
    return Api.stats().then(function (r) {
      if (!r.ok || !r.data.totals) throw new Error('stats');
      Store.set('statsCache', r.data.totals);
      renderStats(r.data.totals);
    }).catch(function () {
      if (!Store.get('statsCache', null)) {
        $('statActions').textContent = '–';
        $('statQuizzes').textContent = '–';
        $('statGames').textContent = '–';
      }
    });
  }

  /* ---------- Name screen: first name + last name initial ---------- */
  var firstInput = $('firstNameInput');
  var initialInput = $('initialInput');
  function clearErrors() { $('firstNameError').textContent = ''; $('initialError').textContent = ''; }
  function fillNameForm() {
    firstInput.value = Store.firstName();
    initialInput.value = Store.initial();
    clearErrors();
  }
  firstInput.addEventListener('input', clearErrors);
  initialInput.addEventListener('input', clearErrors);

  // BUTTON: Save (form submit)
  $('nameForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var check = Rules.validateName(firstInput.value, initialInput.value);
    if (!check.ok) {
      var isFirst = check.field === 'firstName';
      $(isFirst ? 'firstNameError' : 'initialError').textContent = check.error;
      (isFirst ? firstInput : initialInput).focus();
      return;
    }
    var firstTime = !Store.hasName();
    Store.setName(check.firstName, check.initial);
    toast(firstTime ? 'Hey ' + check.firstName + '!' : 'Saved. You\'re ' + check.display);
    Router.go('home', { replace: true });
  });

  /* ---------- Sources list ---------- */
  function renderSources() {
    var list = $('sourceList');
    DATA.SOURCES.forEach(function (s) {
      var li = document.createElement('li');
      // LINK: one source (opens in a new tab)
      li.innerHTML = '<a class="source-link" target="_blank" rel="noopener"><span class="source-name"></span><svg aria-hidden="true"><use href="#i-external"/></svg><span class="source-what"></span></a>';
      var a = li.firstChild;
      a.href = s.url;
      a.setAttribute('aria-label', s.name + ': ' + s.what + ' (opens in a new tab)');
      a.querySelector('.source-name').textContent = s.name;
      a.querySelector('.source-what').textContent = s.what;
      list.appendChild(li);
    });
  }
  renderSources();

  /* ---------- Connect every navigation button ---------- */
  // BUTTON: Start (splash)
  $('btnStart').addEventListener('click', function () {
    Router.go(Store.hasName() ? 'home' : 'name', { replace: true });
  });
  // BUTTON: Change name (home)
  $('btnEditName').addEventListener('click', function () {
    fillNameForm();
    Router.go('name');
  });
  // BUTTON: Refresh AQI (air)
  $('btnAqiRefresh').addEventListener('click', function () { Air.load(true); });

  // All buttons with data-go="screen" (home tiles, play cards, links)
  document.querySelectorAll('[data-go]').forEach(function (btn) {
    btn.addEventListener('click', function () { Router.go(btn.getAttribute('data-go')); });
  });
  // All Back buttons
  document.querySelectorAll('[data-back]').forEach(function (btn) {
    btn.addEventListener('click', Router.back);
  });
  // Tab bar buttons
  document.querySelectorAll('[data-tab-go]').forEach(function (btn) {
    btn.addEventListener('click', function () { Router.go(btn.getAttribute('data-tab-go')); });
  });

  /* ---------- What happens when each screen opens ---------- */
  Router.on('home', function () {
    $('homeName').textContent = Store.displayName() || 'friend';
    refreshStats();
    Actions.updateHome();
    Air.load(false);
  });
  Router.on('name', fillNameForm);
  Router.on('air', function () { Air.load(false); });
  Router.on('play', function () {
    var q = Store.bestQuiz(), g = Store.bestGame();
    $('playBestQuiz').textContent = q === null ? '–' : q + '/10';
    $('playBestGame').textContent = g === null ? '–' : g;
  });
  Router.on('quiz', Quiz.reset);
  Router.on('game', Game.reset, Game.leave);
  Router.on('action', Actions.render);
  Router.on('leaderboard', Leaderboard.load);

  /* ---------- Offline retry: send saved results ---------- */
  function flush() {
    Api.flushQueue().then(function (sent) {
      if (sent > 0) {
        toast('Sent ' + sent + ' saved result' + (sent > 1 ? 's' : '') + '.');
        refreshStats();
      }
    });
  }
  window.addEventListener('online', flush);

  /* ---------- PWA: service worker for offline use ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW failed', e); });
    });
  }

  /* ---------- Start the app ---------- */
  var hash = (location.hash || '').slice(1);
  var known = hash && document.getElementById('screen-' + hash);
  var first = Store.hasName() && known && hash !== 'splash' && hash !== 'name' ? hash : 'splash';
  Router.start(first);
  flush();
  Air.load(false);   // warm up the live AQI for the Home tile

  return { toast: toast, refreshStats: refreshStats };
})();
