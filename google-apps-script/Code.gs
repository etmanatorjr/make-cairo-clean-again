/**
 * ==========================================================================
 * Make Cairo Clean Again — Google Sheets backend (Google Apps Script)
 * Made by Mahmoud Etman 9E
 *
 * Paste this whole file into Extensions > Apps Script of my Google Sheet.
 *
 * Tabs it uses (made automatically if missing):
 *   Scores  : time | nickname | type | score
 *   Actions : time | nickname | action
 *
 * doPost  -> adds ONE row (a score or an action)
 * doGet   -> returns JSON: top 10 quiz, top 10 game, totals (and my rank)
 *
 * Security:
 *   - Every request must include the SECRET key. Only my Vercel API knows it.
 *     The secret is stored in Project Settings > Script properties as
 *     SHEET_SECRET (so it is not written in this code).
 *   - LockService: only one write at a time, so two writes at once can't clash.
 * ==========================================================================
 */

var SCORES = 'Scores';
var ACTIONS = 'Actions';
var SCORE_HEADERS = ['time', 'nickname', 'type', 'score'];
var ACTION_HEADERS = ['time', 'nickname', 'action'];

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
   Body (JSON): { secret, kind: "score", nickname, type, score }
             or { secret, kind: "action", nickname, action }
   ------------------------------------------------------------------------ */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  if (!checkSecret_(body.secret)) return json_({ ok: false, error: 'unauthorized' });

  var nickname = cleanNickname_(body.nickname);
  if (!nickname) return json_({ ok: false, error: 'bad_nickname' });

  var row, sheetName;
  if (body.kind === 'score') {
    var rule = SCORE_RULES[body.type];
    var score = Number(body.score);
    if (!rule || !isFinite(score) || score % 1 !== 0 || score < rule.min || score > rule.max) {
      return json_({ ok: false, error: 'bad_score' });
    }
    sheetName = SCORES;
    row = [new Date(), nickname, body.type, score];
  } else if (body.kind === 'action') {
    if (ACTION_LIST.indexOf(body.action) === -1) return json_({ ok: false, error: 'bad_action' });
    sheetName = ACTIONS;
    row = [new Date(), nickname, body.action];
  } else {
    return json_({ ok: false, error: 'bad_kind' });
  }

  // LockService: wait up to 10 seconds for other writes to finish
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: 'busy' });
  try {
    var sheet = getSheet_(sheetName, sheetName === SCORES ? SCORE_HEADERS : ACTION_HEADERS);
    sheet.appendRow(row);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

/* ------------------------------------------------------------------------
   doGet: leaderboard + totals
   ?secret=...&nickname=Optional
   ------------------------------------------------------------------------ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!checkSecret_(p.secret)) return json_({ ok: false, error: 'unauthorized' });

  var scores = readRows_(SCORES, SCORE_HEADERS);
  var actions = readRows_(ACTIONS, ACTION_HEADERS);

  var quizAll = bestPerNickname_(scores, 'quiz');
  var gameAll = bestPerNickname_(scores, 'game');

  // totals for the "everyone together" card
  var players = {};
  var byAction = { recycle: 0, metro: 0, noburn: 0 };
  var quizzes = 0, games = 0;
  scores.forEach(function (r) {
    players[String(r[1]).toLowerCase()] = true;
    if (r[2] === 'quiz') quizzes++;
    if (r[2] === 'game') games++;
  });
  actions.forEach(function (r) {
    players[String(r[1]).toLowerCase()] = true;
    if (byAction.hasOwnProperty(r[2])) byAction[r[2]]++;
  });

  var me = p.nickname ? String(p.nickname).toLowerCase() : '';
  return json_({
    ok: true,
    quiz: quizAll.slice(0, 10),
    game: gameAll.slice(0, 10),
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

/** Get a tab, making it (with bold headers) if it does not exist yet. */
function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** All data rows of a tab (without the header row). */
function readRows_(name, headers) {
  var sheet = getSheet_(name, headers);
  var values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function (r) { return r[1] !== '' && r[1] !== null; });
}

/** Best score per nickname, highest first (ties: whoever got it first). */
function bestPerNickname_(rows, type) {
  var best = {};
  rows.forEach(function (r) {
    if (r[2] !== type) return;
    var name = String(r[1]);
    var key = name.toLowerCase();
    var score = Number(r[3]);
    var time = r[0] instanceof Date ? r[0].getTime() : new Date(r[0]).getTime();
    var old = best[key];
    if (!old || score > old.score || (score === old.score && time < old.t)) {
      best[key] = { nickname: name, score: score, t: time };
    }
  });
  return Object.keys(best).map(function (k) { return best[k]; })
    .sort(function (a, b) { return b.score - a.score || a.t - b.t; })
    .map(function (x) { return { nickname: x.nickname, score: x.score, key: x.nickname.toLowerCase() }; });
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
 * Last safety check on the nickname: 2-15 characters, and never let it start
 * with = + - @ (Google Sheets would treat that as a formula).
 */
function cleanNickname_(n) {
  if (typeof n !== 'string') return '';
  n = n.replace(/\s+/g, ' ').trim();
  if (n.length < 2 || n.length > 15) return '';
  if (/^[=+\-@]/.test(n)) n = "'" + n;
  return n;
}

/** Reply with JSON. */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
