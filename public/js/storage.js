/* ==========================================================================
   storage.js — saves things on this device with localStorage.
   Every read/write is wrapped in try/catch so the app still works if
   storage is blocked (private mode).
   ========================================================================== */
var Store = (function () {
  'use strict';
  var PREFIX = 'mcca.';

  function get(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
  }

  /** Today's date as "YYYY-MM-DD" in the phone's own time zone. */
  function today(date) {
    var d = date || new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  /** Save a best score only if it beats the old one. Returns true if it is a new best. */
  function saveBest(type, score) {
    var key = type === 'quiz' ? 'bestQuiz' : 'bestGame';
    var old = get(key, null);
    if (old === null || score > old) {
      set(key, score);
      return true;
    }
    return false;
  }

  return {
    get: get,
    set: set,
    remove: remove,
    today: today,
    saveBest: saveBest,
    nickname: function () { return get('nickname', ''); },
    setNickname: function (n) { return set('nickname', n); },
    bestQuiz: function () { return get('bestQuiz', null); },
    bestGame: function () { return get('bestGame', null); }
  };
})();
