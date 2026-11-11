/* ==========================================================================
   rules.js — shared rules for nicknames, scores and actions.
   This ONE file is used by BOTH:
     - the app in the browser   (loaded with <script src="js/rules.js">)
     - the Vercel server in /api (loaded with require('../../public/js/rules.js'))
   so the app and the server can never disagree about what is allowed.
   ========================================================================== */
(function (root, factory) {
  var rules = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = rules;          // Node.js (Vercel serverless functions)
  } else {
    root.Rules = rules;              // Browser (window.Rules)
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NICK_MIN = 2;
  var NICK_MAX = 15;

  // Allowed score ranges. Game points are +10 (right bin) or -5 (wrong bin),
  // so a real game score is always a multiple of 5.
  var SCORE_RULES = {
    quiz: { min: 0, max: 10, step: 1 },
    game: { min: 0, max: 1000, step: 5 }
  };

  // The only actions a player can tick on the Take Action screen.
  var ACTIONS = ['recycle', 'metro', 'noburn'];
  var ACTION_NAMES = { recycle: 'Recycle', metro: 'Take the metro', noburn: "Don't burn trash" };

  // Words that are blocked inside nicknames (English + Egyptian Arabic).
  // SHORT words only block when they are a whole word (so "Bassem" is fine).
  var BAD_WORDS = [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'pussy', 'slut', 'whore',
    'nigger', 'nigga', 'faggot', 'retard', 'porn', 'penis', 'vagina', 'boobs',
    'hitler', 'wanker', 'twat', 'dildo', 'horny', 'sexy',
    'sharmota', 'sharmoota', 'sharmouta', 'sharmoot', 'khawal', '5awal', 'metnak',
    'mitnak', 'manyak', 'manyok', 'wes5a', 'weskha', 'khara', '5ara', 'a7be', 'kosom',
    'koskhtak', 'ibnelwes5a', '3ars', 'mtnak',
    'شرموط', 'خول', 'متناك', 'منيك', 'عرص', 'خرا', 'وسخة', 'كسم'
  ];
  var SHORT_BAD_WORDS = ['ass', 'sex', 'fag', 'dick', 'cock', 'tit', 'tits', 'kos', 'kus', 'koss',
    'kuss', 'ars', 'nazi', 'zeb', 'zob', 'zebi', 'tiz', 'teez', 'a7a', 'كس', 'زب', 'طيز'];

  // Turn "Sh!t_H34d" into "shithead" so tricks with numbers/symbols do not work.
  var LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

  function squash(text) {
    return String(text).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
  }
  function deLeet(text) {
    return String(text).toLowerCase().replace(/[013457@$!]/g, function (c) { return LEET[c]; });
  }
  function tokens(text) {
    return String(text).toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }

  /** True if the text contains a blocked word. */
  function hasBadWord(text) {
    var variants = [squash(text), squash(deLeet(text))];
    for (var i = 0; i < BAD_WORDS.length; i++) {
      for (var v = 0; v < variants.length; v++) {
        if (variants[v].indexOf(BAD_WORDS[i]) !== -1) return true;
      }
    }
    var words = tokens(text).concat(tokens(deLeet(text)));
    for (var w = 0; w < words.length; w++) {
      if (SHORT_BAD_WORDS.indexOf(words[w]) !== -1) return true;
    }
    return false;
  }

  /**
   * Check a nickname. Returns { ok: true, value } or { ok: false, error }.
   * Rules: 2–15 characters, letters/numbers/spaces/_ . - only, must start with a
   * letter or number, no emails, no links, no phone numbers, no bad words.
   */
  function validateNickname(raw) {
    if (typeof raw !== 'string') return { ok: false, error: 'Type a nickname.' };
    var value = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (value.length < NICK_MIN) return { ok: false, error: 'Use at least 2 letters.' };
    if (value.length > NICK_MAX) return { ok: false, error: 'Max 15 letters.' };
    if (/@|https?:|www\.|\.com\b/i.test(value)) return { ok: false, error: 'No emails or links, please.' };
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _.\-]*$/u.test(value)) {
      return { ok: false, error: 'Only letters, numbers and spaces.' };
    }
    if (/\d{6,}/.test(value)) return { ok: false, error: 'No phone numbers, please.' };
    if (hasBadWord(value)) return { ok: false, error: 'Please pick a kinder nickname.' };
    return { ok: true, value: value };
  }

  /** Check a score for "quiz" or "game". Returns { ok, value } or { ok:false, error }. */
  function validateScore(type, score) {
    var rule = Object.prototype.hasOwnProperty.call(SCORE_RULES, type) ? SCORE_RULES[type] : null;
    if (!rule) return { ok: false, error: 'type must be "quiz" or "game"' };
    var n = Number(score);
    if (typeof score === 'boolean' || score === null || score === '' || !Number.isInteger(n)) {
      return { ok: false, error: 'score must be a whole number' };
    }
    if (n < rule.min || n > rule.max) return { ok: false, error: 'score out of range' };
    if (n % rule.step !== 0) return { ok: false, error: 'score is not possible' };
    return { ok: true, value: n };
  }

  /** Check an action id. Returns { ok, value } or { ok:false, error }. */
  function validateAction(action) {
    if (ACTIONS.indexOf(action) === -1) return { ok: false, error: 'unknown action' };
    return { ok: true, value: action };
  }

  return {
    NICK_MIN: NICK_MIN,
    NICK_MAX: NICK_MAX,
    SCORE_RULES: SCORE_RULES,
    ACTIONS: ACTIONS,
    ACTION_NAMES: ACTION_NAMES,
    hasBadWord: hasBadWord,
    validateNickname: validateNickname,
    validateScore: validateScore,
    validateAction: validateAction
  };
});
