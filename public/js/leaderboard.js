/* ==========================================================================
   leaderboard.js — top 10 quiz and top 10 game scores from the Google Sheet
   (through GET /api/leaderboard). My own row is highlighted.
   ========================================================================== */
var Leaderboard = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CACHE_KEY = 'lbCache2';      // v2: rows have "name" (was "nickname")
  var view = 'quiz';                    // which list is showing: quiz | game
  var data = Store.get(CACHE_KEY, null);

  function isMe(name) {
    var me = Store.displayName();
    return me && String(name).toLowerCase() === me.toLowerCase();
  }

  function render() {
    var list = $('lbList');
    list.innerHTML = '';
    if (!data) return;
    var rows = data[view] || [];
    if (!rows.length) {
      list.innerHTML = '<li class="lb-empty">No scores yet. Go first!</li>';
    }
    rows.forEach(function (row, i) {
      var li = document.createElement('li');
      li.className = 'lb-row' + (isMe(row.name) ? ' is-me' : '');
      li.innerHTML = '<span class="lb-rank"></span><span class="lb-name"></span><span class="lb-score"></span>';
      li.children[0].textContent = i + 1;
      li.children[1].textContent = row.name + (isMe(row.name) ? ' (you)' : '');
      li.children[2].textContent = view === 'quiz' ? row.score + '/10' : row.score;
      li.setAttribute('aria-label', 'Rank ' + (i + 1) + ', ' + row.name + ', score ' + row.score);
      list.appendChild(li);
    });

    var rank = data.myRank ? data.myRank[view] : null;
    $('lbMe').textContent = !Store.hasName() ? '' :
      rank ? "You're #" + rank : 'Play to get on here.';
  }

  /** Switch between the Quiz and Game lists. */
  function setView(next) {
    view = next;
    ['quiz', 'game'].forEach(function (v) {
      var tab = $(v === 'quiz' ? 'lbTabQuiz' : 'lbTabGame');
      tab.classList.toggle('is-active', v === next);
      tab.setAttribute('aria-selected', v === next ? 'true' : 'false');
    });
    render();
  }

  /** Load the newest scores from the server. */
  function load() {
    $('lbStatus').textContent = 'Loading…';
    render();
    return Api.flushQueue().then(function () { return Api.leaderboard(); }).then(function (r) {
      if (!r.ok) throw new Error(r.data && r.data.error || 'HTTP ' + r.status);
      data = { quiz: r.data.quiz || [], game: r.data.game || [], myRank: r.data.myRank || {} };
      Store.set(CACHE_KEY, data);
      $('lbStatus').textContent = 'Live from the Google Sheet';
      render();
    }).catch(function () {
      $('lbStatus').textContent = data ? 'Offline. Showing the last scores.' : "Can't load. Check your internet.";
      render();
    });
  }

  // BUTTON handlers: the two tabs and refresh
  $('lbTabQuiz').addEventListener('click', function () { setView('quiz'); });
  $('lbTabGame').addEventListener('click', function () { setView('game'); });
  $('btnLbRefresh').addEventListener('click', load);

  return { load: load };
})();
