/* ==========================================================================
   GET /api/stats
   Returns the "everyone together" totals for the Home screen:
   { actions, quizzes, games, players, byAction: { recycle, metro, noburn } }
   ========================================================================== */
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

  try {
    const data = await readBoard('');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=30');
    return send(res, 200, { ok: true, totals: data.totals, updated: data.updated });
  } catch (e) {
    console.error('stats failed:', e.message);
    return send(res, e.status || 502, { ok: false, error: e.message });
  }
};
