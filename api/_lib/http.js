/* ==========================================================================
   api/_lib/http.js — small helpers shared by every /api route.
   (Files in folders starting with "_" are NOT turned into routes by Vercel.)
   - CORS: lets the Android APK (Capacitor) and my Vercel site call the API.
   - Rate limit: stops people spamming the API.
   - JSON body reading and replies.
   ========================================================================== */

// Websites/apps that may call this API from a browser
const ALLOWED_ORIGINS = [
  'https://make-cairo-clean-again.vercel.app',
  'https://localhost',          // Capacitor Android app
  'capacitor://localhost',      // Capacitor iOS app
  'http://localhost',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
// Vercel preview links look like make-cairo-clean-again-abc123-name.vercel.app
const PREVIEW_ORIGIN = /^https:\/\/make-cairo-clean-again[a-z0-9-]*\.vercel\.app$/;

/** Add CORS headers. Returns true if this was a preflight (OPTIONS) request that is now answered. */
function cors(req, res, methods) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods + ', OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

/** Send a JSON reply. */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/** The caller's IP address (Vercel puts it in x-forwarded-for). */
function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// ----- Basic rate limit: a counter per IP in memory -----
// Each Vercel function instance has its own memory, so this is "basic" (as asked):
// it stops one person spamming, it is not a perfect global limit.
const buckets = new Map();
function rateLimit(req, name, limit, windowMs) {
  const key = name + ':' + clientIp(req);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > 5000) {               // clean up old entries now and then
    for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k);
  }
  return {
    ok: b.count <= limit,
    retryAfter: Math.ceil((b.start + windowMs - now) / 1000)
  };
}

/** Get the JSON body (Vercel usually parses it; this also handles a raw string). */
function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body;
}

module.exports = { cors, send, clientIp, rateLimit, readBody };
