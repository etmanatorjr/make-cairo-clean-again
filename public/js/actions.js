/* ==========================================================================
   actions.js — Take Action screen.
   Tick off real actions each day (recycle, take the metro, don't burn trash).
   Each tick is saved on the phone AND sent to the Google Sheet.
   The streak counts days in a row with at least one action.
   ========================================================================== */
var Actions = (function () {
  'use strict';
  var KEY = 'actionDays';             // { "2026-11-11": ["recycle", "metro"], ... }
  var $ = function (id) { return document.getElementById(id); };

  function days() { return Store.get(KEY, {}); }
  function doneToday() { return days()[Store.today()] || []; }

  /** Days in a row with at least one action (today counts if done, else start from yesterday). */
  function streak() {
    var d = days();
    var count = 0;
    var date = new Date();
    if (!(d[Store.today(date)] || []).length) date.setDate(date.getDate() - 1);
    while ((d[Store.today(date)] || []).length) {
      count++;
      date.setDate(date.getDate() - 1);
    }
    return count;
  }

  function render() {
    var done = doneToday();
    $('streakNum').textContent = streak();
    $('todayCount').textContent = done.length;

    var list = $('actionList');
    list.innerHTML = '';
    DATA.ACTIONS.forEach(function (a) {
      var isDone = done.indexOf(a.id) !== -1;
      var card = document.createElement('article');
      card.className = 'action-row';
      card.innerHTML =
        '<svg class="action-icon" aria-hidden="true"><use href="#' + a.icon + '"/></svg>' +
        '<div class="action-text"><h2 class="action-name"></h2><p class="action-desc"></p></div>' +
        // BUTTON: tick this action as done today
        '<button class="action-btn" type="button"></button>';
      card.querySelector('.action-name').textContent = a.name;
      card.querySelector('.action-desc').textContent = a.desc;
      var btn = card.querySelector('.action-btn');
      btn.setAttribute('aria-pressed', isDone ? 'true' : 'false');
      btn.setAttribute('aria-label', isDone ? a.name + ': done today' : 'Mark "' + a.name + '" as done today');
      btn.innerHTML = isDone
        ? '<svg aria-hidden="true"><use href="#i-check"/></svg>Done'
        : 'Did it';
      btn.addEventListener('click', function () { tick(a, btn); });
      list.appendChild(card);
    });
    updateHome();
  }

  /** Tick an action for today (once per day) and send it to the sheet. */
  function tick(action, btn) {
    var d = days();
    var key = Store.today();
    d[key] = d[key] || [];
    if (d[key].indexOf(action.id) !== -1) return;     // already done today
    d[key].push(action.id);
    Store.set(KEY, d);
    btn.disabled = true;
    render();

    Api.sendAction(action.id).then(function (result) {
      if (result === 'sent') {
        App.toast('Nice. Added to the Cairo total.');
        App.refreshStats();
      } else if (result === 'queued') {
        App.toast(App.OFFLINE_MSG, 4000);
      }
    });
  }

  /** The little line on the Home "Take Action" button. */
  function updateHome() {
    var s = streak();
    $('homeStreak').textContent = s > 0 ? s + ' day streak · ' + doneToday().length + '/3 today' : 'Start a streak';
  }

  return { render: render, updateHome: updateHome, streak: streak };
})();
