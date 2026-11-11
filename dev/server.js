/* ==========================================================================
   dev/server.js — run the whole app on my computer (no install needed).
     npm run dev        -> http://localhost:3000
   - Serves the files in /public
   - Runs the /api functions the same way Vercel does
   - Reads SHEET_URL and SHEET_SECRET from .env.local (never committed).
     If .env.local is missing, it starts the mock Apps Script automatically.
     npm run dev:mock   -> always use the mock (never touches the real sheet)
   ========================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

// Load .env.local (KEY=value lines) if it exists
function loadEnv() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return false;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
  return true;
}

// Make Vercel-style req.body, req.query and res helpers
function runApi(name, req, res) {
  const file = path.join(ROOT, 'api', name + '.js');
  if (!/^[a-z]+$/.test(name) || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end('{"ok":false,"error":"no such route"}');
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    const url = new URL(req.url, 'http://localhost');
    req.query = Object.fromEntries(url.searchParams);
    req.body = raw;
    if ((req.headers['content-type'] || '').includes('application/json')) {
      try { req.body = JSON.parse(raw); } catch (e) { req.body = raw; }
    }
    try {
      await require(file)(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end('{"ok":false,"error":"crash"}');
    }
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(PUBLIC, p);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

async function main() {
  // --mock = always use the fake Apps Script (so testing never writes to my real sheet)
  const forceMock = process.argv.includes('--mock');
  if (forceMock || !loadEnv() || !process.env.SHEET_URL) {
    const mock = await require('./mock-apps-script.js').start({ port: 4100 });
    process.env.SHEET_URL = mock.url;
    process.env.SHEET_SECRET = mock.secret;
    console.log('Using the MOCK Apps Script at ' + mock.url);
  } else {
    console.log('Using the REAL Google Sheet from .env.local');
  }
  http.createServer((req, res) => {
    const m = req.url.match(/^\/api\/([^/?]+)/);
    if (m) return runApi(m[1], req, res);
    serveStatic(req, res);
  }).listen(PORT, () => console.log('App running at http://localhost:' + PORT));
}

main();
