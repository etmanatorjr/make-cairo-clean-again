/**
 * ==========================================================================
 * Make Cairo Clean Again — Google Sheets backend (Google Apps Script)
 * by Mahmoud Etman
 *
 * Paste this whole file into Extensions > Apps Script of my Google Sheet.
 *
 * Tabs it uses (made automatically if missing):
 *   Scores  : time | first name | initial | type | score
 *   Actions : time | first name | initial | action
 * Names show as "Mahmoud E." on the leaderboard.
 *
 * If a tab still has the OLD columns (time | nickname | ...), it is renamed to
 * "Scores (old)" / "Actions (old)" and a fresh tab is made. Nothing is deleted.
 *
 * doPost  -> adds ONE row (a score or an action)
 * doGet   -> returns JSON: top 10 quiz, top 10 game, totals (and my rank)
 *
 * Security:
 *   - Every request must include the SECRET key. Only my Vercel API knows it.
 *     It is stored in Project Settings > Script properties as SHEET_SECRET.
 *   - LockService: only one write at a time, so two writes at once can't clash.
 * ==========================================================================
 */

var SCORES = 'Scores';
var ACTIONS = 'Actions';
var SCORE_HEADERS = ['time', 'first name', 'initial', 'type', 'score'];
var ACTION_HEADERS = ['time', 'first name', 'initial', 'action'];

// Same rules as the app and the Vercel API (a second check, just in case)
var SCORE_RULES = { quiz: { min: 0, max: 10 }, game: { min: 0, max: 1000 } };
var ACTION_LIST = ['recycle', 'metro', 'noburn'];

/** Run this once from the editor (select "setup" > Run) to make the tabs and allow access. */
function setup() {
  getSheet_(SCORES, SCORE_HEADERS);
  getSheet_(ACTIONS, ACTION_HEADERS);
  var hasSecret = !!PropertiesService.getScriptProperties().getProperty('SHEET_SECRET');
  Logger.log('Tabs are ready. SHEET_SECRET is ' + (hasSecret ? 'set.' : 'NOT set yet!'));
}

/* ------------------------------------------------------------------------
   doPost: add a row
   Body (JSON): { secret, kind: "score", firstName, initial, type, score }
             or { secret, kind: "action", firstName, initial, action }
   ------------------------------------------------------------------------ */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  if (!checkSecret_(body.secret)) return json_({ ok: false, error: 'unauthorized' });

  var firstName = cleanFirstName_(body.firstName);
  var initial = cleanInitial_(body.initial);
  if (!firstName || !initial) return json_({ ok: false, error: 'bad_name' });

  var row, sheetName, headers;
  if (body.kind === 'score') {
    var rule = SCORE_RULES[body.type];
    var score = Number(body.score);
    if (!rule || !isFinite(score) || score % 1 !== 0 || score < rule.min || score > rule.max) {
      return json_({ ok: false, error: 'bad_score' });
    }
    sheetName = SCORES;
    headers = SCORE_HEADERS;
    row = [new Date(), firstName, initial, body.type, score];
  } else if (body.kind === 'action') {
    if (ACTION_LIST.indexOf(body.action) === -1) return json_({ ok: false, error: 'bad_action' });
    sheetName = ACTIONS;
    headers = ACTION_HEADERS;
    row = [new Date(), firstName, initial, body.action];
  } else {
    return json_({ ok: false, error: 'bad_kind' });
  }

  // LockService: wait up to 10 seconds for other writes to finish
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: 'busy' });
  try {
    getSheet_(sheetName, headers).appendRow(row);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

/* ------------------------------------------------------------------------
   doGet: leaderboard + totals
   ?secret=...&firstName=Optional&initial=Optional
   ------------------------------------------------------------------------ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!checkSecret_(p.secret)) return json_({ ok: false, error: 'unauthorized' });

  // rows: [time, first name, initial, type, score] and [time, first name, initial, action]
  var scores = readRows_(SCORES, SCORE_HEADERS);
  var actions = readRows_(ACTIONS, ACTION_HEADERS);

  var quizAll = bestPerPerson_(scores, 'quiz');
  var gameAll = bestPerPerson_(scores, 'game');

  // totals for the "everyone together" card
  var players = {};
  var byAction = { recycle: 0, metro: 0, noburn: 0 };
  var quizzes = 0, games = 0;
  scores.forEach(function (r) {
    players[keyOf_(r[1], r[2])] = true;
    if (r[3] === 'quiz') quizzes++;
    if (r[3] === 'game') games++;
  });
  actions.forEach(function (r) {
    players[keyOf_(r[1], r[2])] = true;
    if (byAction.hasOwnProperty(r[3])) byAction[r[3]]++;
  });

  var me = p.firstName ? keyOf_(p.firstName, p.initial || '') : '';
  return json_({
    ok: true,
    quiz: quizAll.slice(0, 10).map(publicRow_),
    game: gameAll.slice(0, 10).map(publicRow_),
    myRank: { quiz: rankOf_(quizAll, me), game: rankOf_(gameAll, me) },
    totals: {
      actions: actions.length,
      quizzes: quizzes,
      games: games,
      players: Object.keys(players).length,
      byAction: byAction
    },
    updated: new Date().toISOString()
  });
}

/* ----------------------------- helpers ----------------------------- */

/**
 * Get a tab with the right headers.
 * - Missing tab: make it.
 * - Tab with OLD headers: rename it to "<name> (old)" and make a fresh one.
 */
function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (sheet && sheet.getLastRow() > 0) {
    var first = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (first.join('|') !== headers.join('|')) {
      var oldName = name + ' (old)';
      if (ss.getSheetByName(oldName)) oldName = name + ' (old ' + new Date().getTime() + ')';
      sheet.setName(oldName);
      sheet = null;
    }
  }
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** All data rows of a tab (without the header row). */
function readRows_(name, headers) {
  var values = getSheet_(name, headers).getDataRange().getValues();
  return values.slice(1).filter(function (r) { return r[1] !== '' && r[1] !== null; });
}

/** "Mahmoud", "E" -> "mahmoud|e" (so the same person is counted once) */
function keyOf_(firstName, initial) {
  return String(firstName).toLowerCase() + '|' + String(initial).toLowerCase();
}

/** Best score per person, highest first (ties: whoever got it first). */
function bestPerPerson_(rows, type) {
  var best = {};
  rows.forEach(function (r) {
    if (r[3] !== type) return;
    var key = keyOf_(r[1], r[2]);
    var score = Number(r[4]);
    var time = r[0] instanceof Date ? r[0].getTime() : new Date(r[0]).getTime();
    var old = best[key];
    if (!old || score > old.score || (score === old.score && time < old.t)) {
      best[key] = { name: String(r[1]) + ' ' + String(r[2]) + '.', score: score, t: time, key: key };
    }
  });
  return Object.keys(best).map(function (k) { return best[k]; })
    .sort(function (a, b) { return b.score - a.score || a.t - b.t; });
}

/** Only send the name and score. */
function publicRow_(x) {
  return { name: x.name, score: x.score };
}

/** My position (1, 2, 3, ...) in a sorted list, or null. */
function rankOf_(list, me) {
  if (!me) return null;
  for (var i = 0; i < list.length; i++) if (list[i].key === me) return i + 1;
  return null;
}

/** Compare the secret with the one saved in Script properties. */
function checkSecret_(given) {
  var real = PropertiesService.getScriptProperties().getProperty('SHEET_SECRET');
  if (!real || typeof given !== 'string' || given.length !== real.length) return false;
  var diff = 0;
  for (var i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/**
 * Last safety check: English letters only (A–Z), 2–15 letters.
 * Letters only also means a name can never start with = + - @ (a formula in Sheets).
 */
function cleanFirstName_(n) {
  if (typeof n !== 'string') return '';
  n = n.trim();
  if (!/^[A-Za-z]{2,15}$/.test(n)) return '';
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Exactly 1 English letter, as a capital. */
function cleanInitial_(i) {
  if (typeof i !== 'string') return '';
  i = i.trim();
  if (!/^[A-Za-z]$/.test(i)) return '';
  return i.toUpperCase();
}

/** Reply with JSON. */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
