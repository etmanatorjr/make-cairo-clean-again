/* ==========================================================================
   dev/mock-apps-script.js — a FAKE Google Apps Script web app for testing
   on my computer. It runs my REAL google-apps-script/Code.gs inside Node,
   with pretend versions of SpreadsheetApp, LockService, etc.

   It copies how Google really answers:
     POST /exec  -> runs doPost, then replies 302 with a Location header
     GET  /exec  -> runs doGet,  then replies 302 with a Location header
     GET  /echo  -> the JSON result (like script.googleusercontent.com)

   Usage: node dev/mock-apps-script.js   (port 4100, secret "dev-secret")
   ========================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function createMockSheets() {
  const tabs = {};
  function makeSheet(name) {
    const rows = [];
    const sheet = {
      name,
      rows,
      setName: (n) => { delete tabs[sheet.name]; sheet.name = n; tabs[n] = sheet; return sheet; },
      getLastRow: () => rows.length,
      appendRow: (r) => { rows.push(r.slice()); return sheet; },
      setFrozenRows: () => sheet,
      getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
      getRange: (row, col, nRows, nCols) => {
        const range = {
          setValues: (vals) => {
            vals.forEach((v, i) => { rows[row - 1 + i] = v.slice(0, nCols); });
            return range;
          },
          setFontWeight: () => range,
          getValues: () => Array.from({ length: nRows }, (_, i) => (rows[row - 1 + i] || []).slice(col - 1, col - 1 + nCols))
        };
        return range;
      }
    };
    return sheet;
  }
  return {
    tabs,
    getSheetByName: (n) => tabs[n] || null,
    insertSheet: (n) => (tabs[n] = makeSheet(n)),
    makeSheet
  };
}

function loadCodeGs(secret, spreadsheet) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');
  let locked = false;
  const sandbox = {
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush: () => {} },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { if (locked) return false; locked = true; return true; },
        releaseLock: () => { locked = false; }
      })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'SHEET_SECRET' ? secret : null) }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } })
    },
    Logger: { log: (...a) => console.log('[Code.gs]', ...a) },
    Date, JSON, Math, Number, String, Object, isFinite
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'Code.gs' });
  return sandbox;
}

function start({ port = 4100, secret = 'dev-secret' } = {}) {
  const spreadsheet = createMockSheets();
  const gs = loadCodeGs(secret, spreadsheet);
  const results = new Map();
  const stats = { posts: 0, gets: 0, echoes: 0 };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const redirectWith = (output) => {
      const id = crypto.randomUUID();
      results.set(id, output.text);
      res.writeHead(302, { Location: `http://127.0.0.1:${server.address().port}/macros/echo?user_content_key=${id}` });
      res.end();
    };
    if (url.pathname === '/macros/s/dev/exec' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        stats.posts++;
        redirectWith(gs.doPost({ postData: { contents: body, type: req.headers['content-type'] } }));
      });
      return;
    }
    if (url.pathname === '/macros/s/dev/exec' && req.method === 'GET') {
      stats.gets++;
      redirectWith(gs.doGet({ parameter: Object.fromEntries(url.searchParams) }));
      return;
    }
    if (url.pathname === '/macros/echo' && req.method === 'GET') {
      stats.echoes++;
      const text = results.get(url.searchParams.get('user_content_key'));
      if (!text) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(text);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html>Not a script URL</html>');
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/macros/s/dev/exec`;
      resolve({ server, url, secret, spreadsheet, stats, gs });
    });
  });
}

if (require.main === module) {
  start().then(({ url, secret }) => {
    console.log('Mock Apps Script running at ' + url);
    console.log('Use: SHEET_URL=' + url + ' SHEET_SECRET=' + secret);
  });
}

module.exports = { start };
