/* ==========================================================================
   GET /api/leaderboard?nickname=Optional
   Returns the top 10 quiz and top 10 game scores (best score per nickname),
   plus my rank if a nickname is given.
   ========================================================================== */
const Rules = require('../public/js/rules.js');
const { cors, send, rateLimit } = require('./_lib/http.js');
const { readBoard } = require('./_lib/sheet.js');

module.exports = async function handler(req, res) {
  if (cors(req, res, 'GET')) return;
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Use GET' });

  const limit = rateLimit(req, 'read', 60, 60 * 1000);
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return send(res, 429, { ok: false, error: 'Too many requests. Wait a minute.' });
  }

  // nickname is optional; ignore it if it is not a valid nickname
  const raw = req.query && typeof req.query.nickname === 'string' ? req.query.nickname : '';
  const nick = raw ? Rules.validateNickname(raw) : { ok: false };

  try {
    const data = await readBoard(nick.ok ? nick.value : '');
    // let Vercel's CDN keep the answer for 10 seconds so the sheet is not hit too often
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=30');
    return send(res, 200, {
      ok: true,
      quiz: data.quiz || [],
      game: data.game || [],
      myRank: data.myRank || { quiz: null, game: null },
      updated: data.updated
    });
  } catch (e) {
    console.error('leaderboard failed:', e.message);
    return send(res, e.status || 502, { ok: false, error: e.message });
  }
};
