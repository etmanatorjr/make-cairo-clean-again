/* ==========================================================================
   tests/api.test.js — automatic tests.   Run with:  npm test
   1. The shared rules (first name, initial, score, action).
   2. The real /api functions talking to the mock Apps Script, which runs my
      real Code.gs and copies Google's 302 redirect.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const Rules = require('../public/js/rules.js');
const mockSheet = require('../dev/mock-apps-script.js');

// ---------- 1. rules ----------
test('name rules: first name + last name initial', () => {
  assert.deepStrictEqual(Rules.validateName('mahmoud', 'e'),
    { ok: true, firstName: 'Mahmoud', initial: 'E', display: 'Mahmoud E.' });
  assert.strictEqual(Rules.validateName(' Mahmoud ', 'E.').display, 'Mahmoud E.', 'trims, allows "E."');
  assert.ok(Rules.validateName('Bassem', 'K').ok, 'no false alarm on "ass" inside a name');
  assert.ok(Rules.validateName('Nazih', 'A').ok, 'no false alarm on "nazi" inside a name');
  assert.ok(!Rules.validateName('M', 'E').ok, 'first name too short');
  assert.ok(!Rules.validateName('Abcdefghijklmnop', 'E').ok, 'first name too long (16)');
  assert.ok(!Rules.validateName('Abd El', 'K').ok, 'letters only: no spaces');
  assert.ok(!Rules.validateName('Ali2', 'K').ok, 'letters only: no numbers');
  assert.ok(!Rules.validateName('محمود', 'E').ok, 'English letters only');
  assert.ok(!Rules.validateName('Mahmoud', 'ع').ok, 'initial: English letter only');
  assert.ok(!Rules.validateName('José', 'M').ok, 'English letters only (no accents)');
  assert.ok(!Rules.validateName('Mahmoud', 'EE').ok, 'initial is 1 letter');
  assert.ok(!Rules.validateName('Mahmoud', '').ok, 'initial is needed');
  assert.ok(!Rules.validateName('=SUM', 'A').ok, 'no formulas');
  assert.ok(!Rules.validateName('Fuckboy', 'A').ok, 'bad word inside');
  assert.ok(!Rules.validateName('Kos', 'A').ok, 'short bad word');
  assert.ok(!Rules.validateName(42, 'A').ok, 'must be text');
});

test('score and action rules', () => {
  assert.ok(Rules.validateScore('quiz', 7).ok);
  assert.ok(Rules.validateScore('game', 350).ok);
  assert.ok(!Rules.validateScore('quiz', 11).ok);
  assert.ok(!Rules.validateScore('quiz', -1).ok);
  assert.ok(!Rules.validateScore('quiz', 2.5).ok);
  assert.ok(!Rules.validateScore('game', 1005).ok);
  assert.ok(!Rules.validateScore('game', 13).ok, 'game scores are multiples of 5');
  assert.ok(!Rules.validateScore('chess', 3).ok);
  assert.ok(!Rules.validateScore('quiz', true).ok);
  assert.ok(Rules.validateAction('metro').ok);
  assert.ok(!Rules.validateAction('fly').ok);
});

// ---------- 2. API + mock sheet ----------
let ipCounter = 1;
function call(handler, { method = 'GET', body, query = {}, origin, ip } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    const req = {
      method, body, query,
      headers: { 'x-forwarded-for': ip || '10.0.0.' + ipCounter++, origin },
      socket: {}
    };
    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
      end: (text) => resolve({ status: res.statusCode, headers, json: text ? JSON.parse(text) : null })
    };
    handler(req, res);
  });
}

test('API routes with the mock Apps Script', async (t) => {
  const mock = await mockSheet.start({ port: 0, secret: 'test-secret' });
  process.env.SHEET_URL = mock.url;
  process.env.SHEET_SECRET = 'test-secret';
  const score = require('../api/score.js');
  const action = require('../api/action.js');
  const leaderboard = require('../api/leaderboard.js');
  const stats = require('../api/stats.js');

  // An OLD "Scores" tab with nickname columns, like the real sheet had before
  const old = mock.spreadsheet.insertSheet('Scores');
  old.appendRow(['time', 'nickname', 'type', 'score']);
  old.appendRow([new Date(), 'Old Nick', 'quiz', 9]);
  // An "Actions" tab made by hand with capital headers, like my real sheet
  const mine = mock.spreadsheet.insertSheet('Actions');
  mine.appendRow(['Time', 'Name', 'Action']);

  await t.test('POST /api/score saves a row (following the 302 redirect)', async () => {
    const r = await call(score, { method: 'POST', body: { firstName: 'mahmoud', initial: 'e', type: 'quiz', score: 8 } });
    assert.strictEqual(r.status, 201, JSON.stringify(r.json));
    const rows = mock.spreadsheet.tabs.Scores.rows;
    assert.deepStrictEqual(Array.from(rows[0]), ['Time', 'Name', 'Type', 'Score'], 'new headers');
    assert.deepStrictEqual(Array.from(rows[1]).slice(1), ['Mahmoud E.', 'quiz', 8], 'name saved as "Mahmoud E."');
    assert.ok(mock.stats.echoes >= 1, 'redirect was followed');
  });

  await t.test('the old nickname tab was kept as "Scores (old)", not deleted', async () => {
    const oldTab = mock.spreadsheet.tabs['Scores (old)'];
    assert.ok(oldTab);
    assert.strictEqual(oldTab.rows[1][1], 'Old Nick');
  });

  await t.test('more scores for the leaderboard', async () => {
    for (const [f, i, type, s] of [['Nour', 'H', 'quiz', 10], ['Mahmoud', 'E', 'quiz', 6], ['Sara', 'M', 'game', 240], ['Mahmoud', 'E', 'game', 310], ['Mahmoud', 'K', 'quiz', 3]]) {
      const r = await call(score, { method: 'POST', body: { firstName: f, initial: i, type, score: s } });
      assert.strictEqual(r.status, 201);
    }
  });

  await t.test('POST /api/action saves a row', async () => {
    const r = await call(action, { method: 'POST', body: { firstName: 'Mahmoud', initial: 'E', action: 'metro' } });
    assert.strictEqual(r.status, 201);
    await call(action, { method: 'POST', body: { firstName: 'Sara', initial: 'M', action: 'recycle' } });
    const tab = mock.spreadsheet.tabs.Actions;
    assert.strictEqual(tab, mine, 'my hand-made tab with capital headers was kept, not replaced');
    assert.ok(!mock.spreadsheet.tabs['Actions (old)'], 'it was not moved aside');
    assert.deepStrictEqual(Array.from(tab.rows[0]), ['Time', 'Name', 'Action'], 'my headers untouched');
    assert.deepStrictEqual(Array.from(tab.rows[1]).slice(1), ['Mahmoud E.', 'metro']);
  });

  await t.test('bad input is rejected with 400 and never reaches the sheet', async () => {
    const before = mock.stats.posts;
    const bad = [
      [score, { firstName: 'Mahmoud', initial: 'E', type: 'quiz', score: 99 }],
      [score, { firstName: 'Mahmoud', initial: 'E', type: 'golf', score: 1 }],
      [score, { firstName: 'M', initial: 'E', type: 'quiz', score: 1 }],
      [score, { firstName: 'Mahmoud', initial: 'EE', type: 'quiz', score: 1 }],
      [score, { firstName: 'Mahmoud', type: 'quiz', score: 1 }],
      [score, { firstName: 'محمود', initial: 'E', type: 'quiz', score: 1 }],
      [score, { nickname: 'Eco Falcon', type: 'quiz', score: 1 }],
      [score, { firstName: 'Kos', initial: 'A', type: 'quiz', score: 1 }],
      [action, { firstName: 'Mahmoud', initial: 'E', action: 'drive' }],
      [action, 'not json']
    ];
    for (const [h, body] of bad) {
      const r = await call(h, { method: 'POST', body });
      assert.strictEqual(r.status, 400, JSON.stringify(body));
    }
    assert.strictEqual(mock.stats.posts, before);
  });

  await t.test('GET /api/leaderboard returns "First I." names, best per person + my rank', async () => {
    const r = await call(leaderboard, { query: { firstName: 'mahmoud', initial: 'e' } });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.json.quiz, [
      { name: 'Nour H.', score: 10 }, { name: 'Mahmoud E.', score: 8 }, { name: 'Mahmoud K.', score: 3 }
    ], 'Mahmoud E. and Mahmoud K. are different people');
    assert.deepStrictEqual(r.json.game, [{ name: 'Mahmoud E.', score: 310 }, { name: 'Sara M.', score: 240 }]);
    assert.deepStrictEqual(r.json.myRank, { quiz: 2, game: 1 });
  });

  await t.test('GET /api/stats returns totals', async () => {
    const r = await call(stats);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.json.totals, {
      actions: 2, quizzes: 4, games: 2, players: 4, byAction: { recycle: 1, metro: 1, noburn: 0 }
    });
  });

  await t.test('wrong method = 405, CORS preflight = 204', async () => {
    assert.strictEqual((await call(score, { method: 'GET' })).status, 405);
    const pre = await call(score, { method: 'OPTIONS', origin: 'https://localhost' });
    assert.strictEqual(pre.status, 204);
    assert.strictEqual(pre.headers['access-control-allow-origin'], 'https://localhost');
    const evil = await call(stats, { origin: 'https://evil.example' });
    assert.strictEqual(evil.headers['access-control-allow-origin'], undefined);
  });

  await t.test('rate limit: 11th score in a minute from one IP = 429', async () => {
    let last;
    for (let i = 0; i < 11; i++) {
      last = await call(score, { method: 'POST', ip: '9.9.9.9', body: { firstName: 'Spam', initial: 'S', type: 'quiz', score: 1 } });
    }
    assert.strictEqual(last.status, 429);
    assert.ok(last.headers['retry-after']);
  });

  await t.test('wrong secret is refused by Code.gs', async () => {
    process.env.SHEET_SECRET = 'wrong-secret!';
    const r = await call(score, { method: 'POST', body: { firstName: 'Mahmoud', initial: 'E', type: 'quiz', score: 3 } });
    assert.strictEqual(r.status, 502);
    assert.strictEqual(r.json.error, 'sheet_unauthorized');
    process.env.SHEET_SECRET = 'test-secret';
  });

  await t.test('Code.gs refuses bad names even if they get past the API', async () => {
    for (const [firstName, initial] of [['=1+1', 'A'], ['Mahmoud', '5'], ['محمود', 'E']]) {
      const out = mock.gs.doPost({ postData: { contents: JSON.stringify({ secret: 'test-secret', kind: 'action', firstName, initial, action: 'metro' }) } });
      assert.strictEqual(JSON.parse(out.text).error, 'bad_name', firstName);
    }
  });

  await t.test('missing env vars = 500 server_not_configured', async () => {
    const saved = process.env.SHEET_URL;
    delete process.env.SHEET_URL;
    const r = await call(stats);
    assert.strictEqual(r.status, 500);
    process.env.SHEET_URL = saved;
  });

  mock.server.close();
});
