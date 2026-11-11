/* ==========================================================================
   tests/api.test.js — automatic tests.   Run with:  npm test
   1. The shared rules (nickname, score, action).
   2. The real /api functions talking to the mock Apps Script, which runs my
      real Code.gs and copies Google's 302 redirect.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const Rules = require('../public/js/rules.js');
const mockSheet = require('../dev/mock-apps-script.js');

// ---------- 1. rules ----------
test('nickname rules', () => {
  assert.ok(Rules.validateNickname('Eco Falcon 7').ok);
  assert.ok(Rules.validateNickname('محمود').ok, 'Arabic letters are allowed');
  assert.ok(Rules.validateNickname('Bassem').ok, 'no false alarm on "ass" inside a name');
  assert.ok(Rules.validateNickname('Nazih').ok, 'no false alarm on Arabic names');
  assert.strictEqual(Rules.validateNickname('  Ali   Z  ').value, 'Ali Z');
  assert.ok(!Rules.validateNickname('a').ok, 'too short');
  assert.ok(!Rules.validateNickname('abcdefghijklmnop').ok, 'too long (16)');
  assert.ok(!Rules.validateNickname('me@mail.com').ok, 'no emails');
  assert.ok(!Rules.validateNickname('=HYPERLINK(1)').ok, 'no formulas');
  assert.ok(!Rules.validateNickname('01012345678').ok, 'no phone numbers');
  assert.ok(!Rules.validateNickname('sh1t head').ok, 'bad word with numbers');
  assert.ok(!Rules.validateNickname('Fuckboy').ok, 'bad word inside');
  assert.ok(!Rules.validateNickname('kos').ok, 'short bad word');
  assert.ok(!Rules.validateNickname(42).ok, 'must be text');
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

  await t.test('POST /api/score saves a row (following the 302 redirect)', async () => {
    const r = await call(score, { method: 'POST', body: { nickname: 'Eco Falcon', type: 'quiz', score: 8 } });
    assert.strictEqual(r.status, 201, JSON.stringify(r.json));
    const rows = mock.spreadsheet.tabs.Scores.rows;
    assert.deepStrictEqual(Array.from(rows[0]), ['time', 'nickname', 'type', 'score'], 'headers made automatically');
    assert.deepStrictEqual(Array.from(rows[1]).slice(1), ['Eco Falcon', 'quiz', 8]);
    assert.ok(mock.stats.echoes >= 1, 'redirect was followed');
  });

  await t.test('more scores for the leaderboard', async () => {
    for (const [n, type, s] of [['Nile Hawk', 'quiz', 10], ['Eco Falcon', 'quiz', 6], ['Sky Lion', 'game', 240], ['Eco Falcon', 'game', 310]]) {
      const r = await call(score, { method: 'POST', body: { nickname: n, type, score: s } });
      assert.strictEqual(r.status, 201);
    }
  });

  await t.test('POST /api/action saves a row', async () => {
    const r = await call(action, { method: 'POST', body: { nickname: 'Eco Falcon', action: 'metro' } });
    assert.strictEqual(r.status, 201);
    await call(action, { method: 'POST', body: { nickname: 'Sky Lion', action: 'recycle' } });
    assert.strictEqual(mock.spreadsheet.tabs.Actions.rows.length, 3);
  });

  await t.test('bad input is rejected with 400 and never reaches the sheet', async () => {
    const before = mock.stats.posts;
    const bad = [
      [score, { nickname: 'Eco Falcon', type: 'quiz', score: 99 }],
      [score, { nickname: 'Eco Falcon', type: 'golf', score: 1 }],
      [score, { nickname: 'x', type: 'quiz', score: 1 }],
      [score, { nickname: 'sh1t', type: 'quiz', score: 1 }],
      [score, { nickname: 'way too long nickname', type: 'quiz', score: 1 }],
      [action, { nickname: 'Eco Falcon', action: 'drive' }],
      [action, 'not json']
    ];
    for (const [h, body] of bad) {
      const r = await call(h, { method: 'POST', body });
      assert.strictEqual(r.status, 400, JSON.stringify(body));
    }
    assert.strictEqual(mock.stats.posts, before);
  });

  await t.test('GET /api/leaderboard returns best score per nickname + my rank', async () => {
    const r = await call(leaderboard, { query: { nickname: 'eco falcon' } });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.json.quiz.map((x) => [x.nickname, x.score]), [['Nile Hawk', 10], ['Eco Falcon', 8]]);
    assert.deepStrictEqual(r.json.game.map((x) => [x.nickname, x.score]), [['Eco Falcon', 310], ['Sky Lion', 240]]);
    assert.deepStrictEqual(r.json.myRank, { quiz: 2, game: 1 });
  });

  await t.test('GET /api/stats returns totals', async () => {
    const r = await call(stats);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.json.totals, {
      actions: 2, quizzes: 3, games: 2, players: 3, byAction: { recycle: 1, metro: 1, noburn: 0 }
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
      last = await call(score, { method: 'POST', ip: '9.9.9.9', body: { nickname: 'Spammer', type: 'quiz', score: 1 } });
    }
    assert.strictEqual(last.status, 429);
    assert.ok(last.headers['retry-after']);
  });

  await t.test('wrong secret is refused by Code.gs', async () => {
    process.env.SHEET_SECRET = 'wrong-secret!';
    const r = await call(score, { method: 'POST', body: { nickname: 'Eco Falcon', type: 'quiz', score: 3 } });
    assert.strictEqual(r.status, 502);
    assert.strictEqual(r.json.error, 'sheet_unauthorized');
    process.env.SHEET_SECRET = 'test-secret';
  });

  await t.test('Code.gs blocks formula nicknames even if they get past the API', async () => {
    const out = mock.gs.doPost({ postData: { contents: JSON.stringify({ secret: 'test-secret', kind: 'action', nickname: '=1+1', action: 'metro' }) } });
    assert.strictEqual(JSON.parse(out.text).ok, true);
    const rows = mock.spreadsheet.tabs.Actions.rows;
    assert.strictEqual(rows[rows.length - 1][1], "'=1+1");
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
