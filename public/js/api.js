/* ==========================================================================
   api.js — talks to my Vercel serverless API (/api/...).
   The Google Sheet URL and secret are NEVER in the app; only the server knows them.

   Offline retry: if sending a score or action fails (no internet, server down),
   it is kept in localStorage ("queue") and sent the next time the app opens
   or when the internet comes back.
   ========================================================================== */
var Api = (function () {
  'use strict';
  var cfg = window.APP_CONFIG;
  var QUEUE_KEY = 'queue';
  var flushing = false;

  /** Use the local server when testing on my computer, else the full Vercel URL. */
  function base() {
    if (cfg.LOCAL_DEV_HOSTS.indexOf(location.host) !== -1) return '';
    return cfg.API_BASE;
  }

  /** fetch() with a time limit so the app never hangs. */
  function request(path, options) {
    var ctrl = new AbortController();
    // 20 seconds: Google's script can be slow to wake up after a quiet time
    var timer = setTimeout(function () { ctrl.abort(); }, 20000);
    // cache: 'no-cache' = always ask the server for fresh scores
    var opts = Object.assign({ signal: ctrl.signal, cache: 'no-cache' }, options || {});
    return fetch(base() + path, opts)
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { status: res.status, ok: res.ok, data: data };
        });
      })
      .finally(function () { clearTimeout(timer); });
  }

  function post(path, body) {
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  /** Should this failed request be tried again later? (network error, rate limit, server error) */
  function isRetryable(result) {
    return !result || result.status === 0 || result.status === 429 || result.status >= 500;
  }

  // ----- the offline queue -----
  function queue() { return Store.get(QUEUE_KEY, []); }
  function saveQueue(q) { Store.set(QUEUE_KEY, q.slice(-50)); } // keep max 50 waiting items

  function enqueue(path, body) {
    var q = queue();
    q.push({ path: path, body: body, at: Date.now() });
    saveQueue(q);
  }

  /**
   * Send a score or action. If it fails, keep it for later.
   * Resolves to "sent", "queued" or "rejected".
   */
  function send(path, body) {
    return post(path, body).then(function (r) {
      if (r.ok) return 'sent';
      if (isRetryable(r)) { enqueue(path, body); return 'queued'; }
      console.warn('Server rejected', path, r.data);
      return 'rejected';
    }).catch(function () {
      // no connection: keep it, and tell the player simply
      // (Android's WebView doesn't always fire the "offline" event, so we say it here too)
      enqueue(path, body);
      if (window.App && App.toast) App.toast(App.OFFLINE_MSG, 4000);
      return 'queued';
    });
  }

  /** Try to send everything that is waiting. Resolves to how many were sent. */
  function flushQueue() {
    if (flushing) return Promise.resolve(0);
    var q = queue();
    if (!q.length) return Promise.resolve(0);
    flushing = true;
    var sent = 0;
    var i = 0;

    function next() {
      if (i >= q.length) return Promise.resolve();
      var item = q[i];
      return post(item.path, item.body).then(function (r) {
        if (r.ok) { sent++; i++; return next(); }
        if (isRetryable(r)) return; // stop, try again later
        i++; // bad data — drop it and keep going
        return next();
      }).catch(function () { /* still offline: stop */ });
    }

    return next().then(function () {
      // remove what was handled; keep the rest (and anything added meanwhile)
      var now = queue();
      saveQueue(now.slice(i));
      flushing = false;
      return sent;
    });
  }

  return {
    base: base,
    pendingCount: function () { return queue().length; },
    flushQueue: flushQueue,

    /** POST /api/score { firstName, initial, type, score } */
    sendScore: function (type, score) {
      return send('/api/score', { firstName: Store.firstName(), initial: Store.initial(), type: type, score: score });
    },

    /** POST /api/action { firstName, initial, action } */
    sendAction: function (action) {
      return send('/api/action', { firstName: Store.firstName(), initial: Store.initial(), action: action });
    },

    /** GET /api/leaderboard (with my name so the server can tell me my rank) */
    leaderboard: function () {
      var q = Store.hasName()
        ? '?firstName=' + encodeURIComponent(Store.firstName()) + '&initial=' + encodeURIComponent(Store.initial())
        : '';
      return request('/api/leaderboard' + q);
    },

    /** GET /api/stats — the "everyone together" totals */
    stats: function () {
      return request('/api/stats');
    }
  };
})();
