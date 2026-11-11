/* ==========================================================================
   api/_lib/sheet.js — talks to my Google Apps Script web app.
   SHEET_URL and SHEET_SECRET come from Vercel environment variables,
   so they are never in the app or on GitHub.

   THE APPS SCRIPT REDIRECT:
   A Google Apps Script web app does not answer directly. It runs doPost/doGet,
   then replies "302 Found" with a Location header pointing to
   script.googleusercontent.com, where the JSON result waits.
   We handle that by hand (redirect: 'manual') and fetch the Location with GET.
   This way the POST (which adds the row) runs exactly once.
   ========================================================================== */

const TIMEOUT_MS = 15000;

class SheetError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status || 502;
  }
}

function config() {
  const url = process.env.SHEET_URL;
  const secret = process.env.SHEET_SECRET;
  if (!url || !secret) throw new SheetError('server_not_configured', 500);
  return { url, secret };
}

/** Follow the Apps Script 302 redirect (if there is one) and read the JSON. */
async function readAppsScriptReply(res) {
  let final = res;
  for (let hops = 0; hops < 3 && final.status >= 300 && final.status < 400; hops++) {
    const location = final.headers.get('location');
    if (!location) throw new SheetError('redirect_without_location');
    final = await fetch(location, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
  }
  const text = await final.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    // Google returns an HTML page when the script crashes or is not shared with "Anyone"
    throw new SheetError('sheet_not_json');
  }
  if (!final.ok) throw new SheetError('sheet_http_' + final.status);
  if (!data || data.ok !== true) throw new SheetError('sheet_' + (data && data.error ? data.error : 'error'));
  return data;
}

/** Add a row: payload is { kind: 'score', firstName, initial, type, score } or { kind: 'action', firstName, initial, action } */
async function writeRow(payload) {
  const { url, secret } = config();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, payload, { secret })),
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    return await readAppsScriptReply(res);
  } catch (e) {
    throw wrap(e);
  }
}

/** Read the leaderboard and totals. me = { firstName, initial } (optional) to get "my rank". */
async function readBoard(me) {
  const { url, secret } = config();
  const u = new URL(url);
  u.searchParams.set('secret', secret);
  if (me) {
    u.searchParams.set('firstName', me.firstName);
    u.searchParams.set('initial', me.initial);
  }
  try {
    const res = await fetch(u, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    return await readAppsScriptReply(res);
  } catch (e) {
    throw wrap(e);
  }
}

function wrap(e) {
  if (e instanceof SheetError) return e;
  if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) return new SheetError('sheet_timeout', 504);
  return new SheetError('sheet_unreachable');
}

module.exports = { writeRow, readBoard, SheetError };
