/* ==========================================================================
   POST /api/action   { firstName, initial, action: "recycle" | "metro" | "noburn" }
   Checks everything, then adds a row to the "Actions" tab of my Google Sheet.
   ========================================================================== */
const Rules = require('../public/js/rules.js');
const { cors, send, rateLimit, readBody } = require('./_lib/http.js');
const { writeRow } = require('./_lib/sheet.js');

module.exports = async function handler(req, res) {
  if (cors(req, res, 'POST')) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  // max 10 actions per minute from one IP (a person only has 3 per day)
  const limit = rateLimit(req, 'action', 10, 60 * 1000);
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return send(res, 429, { ok: false, error: 'Too many requests. Wait a minute.' });
  }

  const body = readBody(req);
  if (!body) return send(res, 400, { ok: false, error: 'Send JSON' });

  const name = Rules.validateName(body.firstName, body.initial);
  if (!name.ok) return send(res, 400, { ok: false, error: name.field + ': ' + name.error });
  const action = Rules.validateAction(body.action);
  if (!action.ok) return send(res, 400, { ok: false, error: action.error });

  try {
    await writeRow({ kind: 'action', firstName: name.firstName, initial: name.initial, action: action.value });
    return send(res, 201, { ok: true, saved: { firstName: name.firstName, initial: name.initial, action: action.value } });
  } catch (e) {
    console.error('action failed:', e.message);
    return send(res, e.status || 502, { ok: false, error: e.message });
  }
};
