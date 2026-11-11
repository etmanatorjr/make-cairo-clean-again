# Evidence — Make Cairo Clean Again (Criterion C)

**Mahmoud Etman 9E** · SDG 11.6 (air quality **and** waste)
Live app: https://make-cairo-clean-again.vercel.app · Code: https://github.com/etmanatorjr/make-cairo-clean-again

This file lists every skill beyond basic UI, what had to be learned for it, the official docs,
and exactly where it is in the code (file:line). The Git commit history shows the order the work was done.

---

## 1. Extra skills

### 1.1 Live API data (Open-Meteo Air Quality API)
- **What it does:** shows Cairo's air quality right now (US AQI and PM2.5), colour-coded, with a tip for the day. Saves the last result so it still shows offline.
- **What I researched:** what an API is; how `fetch()` and JSON work; how to build a URL with query parameters (latitude, longitude, `current=us_aqi,pm2_5`); the US AQI colour levels; handling errors when there is no internet.
- **Docs:** https://open-meteo.com/en/docs/air-quality-api · https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- **Code:** `public/js/air.js:22` (API URL), `public/js/air.js:54` (load + cache), `public/js/air.js:62` (fetch), AQI levels and tips in `public/js/data.js` (`AQI_LEVELS`).

### 1.2 Serverless backend (Vercel Functions)
- **What it does:** four API routes run on Vercel's servers, so the Google Sheet URL and secret are hidden from users.
  `POST /api/score`, `POST /api/action`, `GET /api/leaderboard`, `GET /api/stats`.
- **What I researched:** what a serverless function is; request methods (GET/POST); status codes (200, 201, 400, 405, 429, 502); environment variables; why secrets must never be in front-end code.
- **Docs:** https://vercel.com/docs/functions/runtimes/node-js · https://vercel.com/docs/environment-variables
- **Code:** `api/score.js:9`, `api/action.js:9`, `api/leaderboard.js:10`, `api/stats.js:9`.

### 1.3 Server validation, rate limit and CORS
- **What it does:** the server checks every input again (never trust the app): nickname 2–15 characters, no emails, links, phone numbers or bad words; type and action from a fixed list; score in a sane range (quiz 0–10, game 0–1000 and a multiple of 5). Max 10 writes per minute per IP. Only my site and the Android app may call the API from a browser.
- **What I researched:** input validation; HTTP 429 "Too Many Requests" and `Retry-After`; CORS and preflight (`OPTIONS`) requests; the Capacitor app origin (`https://localhost`).
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS · https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
- **Code:** shared rules `public/js/rules.js:79` (nickname), `public/js/rules.js:60` (bad words), `public/js/rules.js:94` (score). Rate limit `api/_lib/http.js:56`. CORS `api/_lib/http.js:22`.
- **Note:** `rules.js` is ONE file used by both the app and the server (`require('../public/js/rules.js')`), so they can never disagree.

### 1.4 Google Sheets database (Google Apps Script)
- **What it does:** a Google Sheet is the database. Tabs `Scores` (time, nickname, type, score) and `Actions` (time, nickname, action) are made automatically. `doPost` adds a row, `doGet` returns the top 10 quiz, top 10 game, totals and my rank as JSON.
- **What I researched:**
  - Apps Script web apps (`doGet`, `doPost`, "Execute as me", "Anyone").
  - `ContentService` to return JSON.
  - `LockService`, so two writes at the same moment can't clash.
  - `PropertiesService`, to keep the secret out of the code.
  - **Formula injection:** a nickname starting with `=` would run as a formula in Sheets, so it gets an `'` in front.
- **Docs:** https://developers.google.com/apps-script/guides/web · https://developers.google.com/apps-script/guides/content · https://developers.google.com/apps-script/reference/lock/lock-service · https://developers.google.com/apps-script/guides/properties · https://owasp.org/www-community/attacks/CSV_Injection
- **Code (`google-apps-script/Code.gs`):**
  - `doPost` at line 45, with the lock at 75–82
  - `doGet` at line 91
  - tabs and headers at line 135
  - best score per nickname at line 154
  - secret check at line 180
  - formula guard at line 192

### 1.5 Handling the Apps Script redirect
- **What it does:** Google answers a web app request with **302 Found** and a `Location` header; the JSON is at that second address. The server follows it by hand (`redirect: 'manual'`) and GETs the Location, so the POST that adds the row runs exactly once.
- **What I researched:** HTTP redirects (302), the `redirect` option of `fetch`, why a POST must not be repeated.
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302 · https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#redirect
- **Code:** `api/_lib/sheet.js:31` (follow the redirect), `api/_lib/sheet.js:36` and `:59` (`redirect: 'manual'`).

### 1.6 localStorage with offline retry
- **What it does:** saves the nickname, best scores, daily actions, streak, last AQI and leaderboard on the phone. If sending a score or action fails (no internet, server down), it is kept in a queue and sent the next time the app opens or the internet comes back. Bad data is dropped instead of retried forever.
- **What I researched:** `localStorage` and JSON; `try/catch` (private mode can block storage); the browser `online` event; which errors are worth retrying (network, 429, 5xx) and which are not (400).
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage · https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event
- **Code:** `public/js/storage.js:6`; queue in `public/js/api.js:53` (enqueue), `:63` (send or queue), `:76` (flush); retry triggers in `public/js/app.js:171` (online) and `:185` (app opens).

### 1.7 Randomized quiz
- **What it does:** 10 questions picked from a bank of 15 (all from my Air and Waste facts), in a new random order every time; the 4 answers are shuffled too. Shows right/wrong with the fact, final score, best score, and sends the score to the sheet.
- **What I researched:** the Fisher–Yates shuffle (fair random order); building buttons with JavaScript.
- **Docs:** https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
- **Code:** shuffle `public/js/data.js:103`; `public/js/quiz.js:32` (start), `:69` (check answer), `:102` (finish + save + send).

### 1.8 Timed drag-and-drop game
- **What it does:** trash falls faster over 60 seconds; sort it into Plastic, Paper, Metal or Organic by **dragging** it, or **tapping** it then a bin (keys 1–4 also work). +10 right, −5 wrong. Pauses when the app goes to the background.
- **What I researched:** `requestAnimationFrame` game loops and delta time; Pointer Events (one code for mouse and touch); `setPointerCapture`; checking if a point is inside a bin; fixing coordinates when the screen is scaled.
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame · https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- **Code (`public/js/game.js`):**
  - game loop at line 145
  - spawning items at 173
  - scoring at 238
  - bin hit test at 265
  - drag at 278
  - auto-pause at 344

### 1.9 Smooth screen transitions
- **What it does:** inner screens slide in from the right and slide back on Back; tabs fade. Uses the browser History API, so the phone's Back button works too (needed for Android). Motion is reduced if the user turns it off in their settings.
- **What I researched:** CSS `@keyframes` and `transform`; `history.pushState` and `popstate`; `prefers-reduced-motion`.
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animations · https://developer.mozilla.org/en-US/docs/Web/API/History_API · https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- **Code:** `public/js/router.js:34` (show + animate), `:103` (pushState), `:118` (popstate); `public/css/styles.css:110` and `:116` (animations), `:483` (reduced motion).

### 1.10 PWA (manifest + service worker)
- **What it does:** the app can be installed on a phone's home screen and opens offline. The service worker saves the app files; app files are loaded network-first (always fresh online), fonts cache-first, API calls are never cached.
- **What I researched:** the web app manifest; service worker install/activate/fetch events; caching strategies; maskable icons.
- **Docs:** https://web.dev/learn/pwa/ · https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API · https://developer.mozilla.org/en-US/docs/Web/Manifest
- **Code:** `public/manifest.webmanifest`, `public/sw.js:32` (install), `public/sw.js:44` (fetch), registration `public/js/app.js:174`, link `public/index.html:11`, icons in `public/icons/`.

### 1.11 iPhone 18 Pro screen + responsive layout
- **What it does:** on a laptop it shows only the 402 × 874 screen (55px corners, Dynamic Island, live clock, signal, real battery level when allowed, home indicator), scaled to fit. On a real phone (under 500px) it fills the whole screen and respects the notch (safe areas).
- **What I researched:** CSS `transform: scale`; media queries; `env(safe-area-inset-*)`; `100dvh`; the Battery Status API.
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/CSS/env · https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API
- **Code:** `public/css/styles.css:47` (screen), `:470` (real phone), `public/js/app.js:10` (scale to fit).

### 1.12 Labels and accessibility
- **What it does:** every screen has a clear `<h1>` title; every button has visible text and/or an `aria-label`; every image has `alt` text; icons are `aria-hidden`; the screen title gets focus when a screen opens (screen readers); live regions announce scores and toasts. A comment above every screen and button in `public/index.html` says what it is.
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-label
- **Checked:** an automatic check in the browser found **47 buttons, 0 without a label; 11 screens, 0 without a title; 0 images without alt; 0 inputs without a label**.

### 1.13 Automatic tests
- **What it does:** `npm test` runs 14 tests. They cover the rules and all four API routes against a fake Apps Script that runs my **real** `Code.gs` and copies Google's 302 redirect: wrong secret, bad input, CORS, rate limit, formula nicknames and missing settings.
- **Docs:** https://nodejs.org/api/test.html
- **Code:** `tests/api.test.js`, `dev/mock-apps-script.js`, `dev/server.js`.

---

## 2. Google Sheets setup (what I did)

1. Made a new Google Sheet, opened **Extensions → Apps Script**, pasted `google-apps-script/Code.gs`, saved.
2. Made a 48-character random secret (`openssl rand -hex 24`) and saved it in **Project Settings → Script properties** as `SHEET_SECRET`.
3. Ran `setup` once to create the **Scores** and **Actions** tabs and give permission.
4. **Deploy → New deployment → Web app**, Execute as **Me**, access **Anyone** → copied the `/exec` URL.

Problem I hit: the first live test returned `sheet_unauthorized`. Testing the script directly showed the Script property didn't match my secret. I pasted it again with no extra spaces, and it worked straight away (no redeploy needed).

## 3. API + deploy steps (what I did)

1. `gh repo create make-cairo-clean-again --public --source . --push` (GitHub CLI).
2. vercel.com → **Add New → Project → Import** the repo, Framework **Other**.
3. Added the environment variables `SHEET_URL` and `SHEET_SECRET`, then deployed. Every `git push` now deploys automatically.
4. `.gitignore` keeps `.env.local`, `.vercel` and Android build files out of GitHub, so the secret and script URL were never committed.

Docs: https://cli.github.com/manual/gh_repo_create · https://vercel.com/docs/deployments/git

## 4. Testing

### On my computer (`npm run dev`, fake Apps Script)
- **Navigation:** an automatic click-through of every tab, every Home button, every Play card, every Back button, the browser Back button, and Back after a refresh. **29/29 passed.**
- **Quiz:**
  - all 10 questions were different
  - the right score was shown
  - the best score was saved
  - feedback with the fact showed every time
  - first question and correct-answer position changed every round
- **Game:**
  - drag to the right bin gave +10, the wrong bin −5, and the bin lit up while dragging
  - tap-then-bin worked
  - the timer ended the round
  - the best score was saved
  - leaving the screen stopped the game
- **Offline:**
  - with the API switched off, a score and an action were queued
  - when it came back, both were sent
  - bad data in the queue was dropped
- **Phone width (375px):** the app filled the screen with no frame.
- **PWA:** the service worker was active and 21 files were cached.
- **Automatic tests:** 14/14 passed.

### Live on https://make-cairo-clean-again.vercel.app (11 Nov 2026)

| Test | Result |
|---|---|
| `POST /api/score` quiz 7 / game 120 | 201 saved |
| `POST /api/action` metro | 201 saved |
| `GET /api/leaderboard?nickname=API Test` | 200, my rank #1 |
| `GET /api/stats` | 200, totals |
| 9 kinds of bad input (score 11, game 13, type chess, 16-letter nickname, email, bad word, `=formula`, action fly, not JSON) | all 400 |
| `GET /api/score` | 405 |
| CORS preflight from the Android app origin | 204, allowed |
| request from an unknown website | no CORS header (blocked) |
| 14 quick requests from one computer | 429 after the limit, `Retry-After` header |
| Full quiz in the live app | 8/10, "Score saved to the leaderboard" |
| Full 60-second game in the live app (23 taps + 22 drags) | 450 points, saved |
| Ticked "Recycle" in the live app | saved, streak 1 |
| Leaderboard screen | "Live from the Google Sheet", my row highlighted, rank #1 |
| Google Sheet checked directly | exactly 6 new rows (2 quizzes, 2 games, 2 actions); none of the bad or blocked requests got in |

**Bug found in live testing and fixed:** right after a write, the Home totals lagged up to 40 seconds because Vercel's CDN cached `/api/stats`. I shortened the cache to 5 seconds (commit "Fresher live totals…") and checked again: the totals matched the Sheet straight away.

---

## 5. Design improvements (version 2)

After testing version 1, I made two big improvements.

### 5.1 Real names on the leaderboard (first name + last name initial)
- **Why:** classmates couldn't tell who "Eco Falcon 42" was. A first name plus one letter ("Mahmoud E.") is easy to recognise, but still doesn't give away a full name.
- **What changed:**
  - The Name screen asks for a first name (English letters A–Z only, 2–15 letters) and a last name initial (exactly 1 letter). They're saved in localStorage and can be edited from Home.
  - Home and the leaderboard show names like "Mahmoud E.".
  - The server checks the same rules again. In my Google Sheet I made the headers myself: `Time | Name | Type | Score` and `Time | Name | Action`. `Code.gs` saves the name as one value ("Mahmoud E.") and matches the headers without caring about capitals, so my own header formatting stays.
  - Old tabs with the nickname columns are renamed "(old)" instead of deleted, so no data is lost.
- **What I researched:** regular expressions for "letters only" (`/^[A-Za-z]+$/`); keeping app and server rules the same with one shared file; changing a database's columns without losing old data.
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions · https://developers.google.com/apps-script/reference/spreadsheet/sheet#setName(String)
- **Code:**
  - Rules (`public/js/rules.js`): first name at line 79, initial at 91, whole name at 102, "Mahmoud E." at 112.
  - App: `public/js/storage.js:61`, `public/js/app.js:69`, `public/index.html:123`.
  - Server: `api/score.js:23`, `api/action.js:23`, `api/leaderboard.js:22`.
  - Sheet (`google-apps-script/Code.gs`): columns at line 31, "Mahmoud E." at 63, moving old tabs aside at 149, best score per person at 186, A–Z check at 227.
- **Tests:** `tests/api.test.js:13` (name rules, including rejecting Arabic letters, spaces, numbers and bad words). Other tests check that an old nickname tab is kept as "Scores (old)" and that a tab I made by hand with capital headers is kept. 15/15 pass.

### 5.2 Colours and style from my SDG 11.6 PowerPoint
- **Why:** version 1 looked like a generic app template. Version 2 matches my presentation, so the app and the slides feel like one project.
- **Colours:**
  - Only the 13 colours from my PowerPoint are used anywhere. They're CSS variables in `:root`, with a comment saying where they come from (`public/css/styles.css:7–22`).
  - Every other colour was replaced, including greens, reds, greys, black, gradients, see-through overlays and soft shadows.
  - Checked with a search of all CSS, HTML and JS files: no colour outside the 13 is left.
- **Style:**
  - Flat colours only, with no gradients, glass blur, glows or soft shadows.
  - Headings in UPPERCASE DM Sans, like "CAUSES OF POOR AIR QUALITY" (`styles.css:143`).
  - Olive blob and dash shapes in the corners, like my slides (`styles.css:33`, `:108`).
  - Simple flat icons in dark circles with a label next to them, like my Causes slide (`styles.css:175`, `index.html:290`).
  - The PM2.5 chart copies my slide (`index.html:278`, `styles.css:296`):
    - orange Cairo bars and a light-teal WHO bar
    - values on top
    - "Source: IQAir" underneath
    - title "Cairo air pollution (PM2.5) is 8x the safe limit"
  - Fewer animations: a simple slide between screens, nothing bouncy (`styles.css:132`).
  - Mixed layouts instead of rows of identical cards: dark bands, uneven split rows and list rows (`styles.css:232`).
  - All app text rewritten short and casual, like a teen talking to teens. My research facts are still word for word.
  - The splash screen says "by Mahmoud Etman" at the bottom (`index.html:119`).
- **What I researched:** CSS custom properties (variables); SVG shapes as CSS backgrounds; CSS Grid for uneven layouts.
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties · https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout

### 5.3 Checks after the redesign
- **Navigation:** clicking through every tab, every Home button, every Play card, every Back button and the browser Back button passed **28/28**.
- **Labels:** **46 buttons, 0 without a label**; 0 images without alt text; 0 screens without a title; 0 inputs without a label. The comments above every screen and button are still there.
- **Phone width (375px):** the app fills the screen with no frame and no sideways scrolling.
- **Screenshots of every screen:**
  - `01-splash.jpg`
  - `02-name.jpg` (with an error showing)
  - `03-home.jpg`
  - `04-air.jpg`
  - `05-air-chart-causes.jpg`
  - `06-waste.jpg`
  - `07-play.jpg`
  - `08-quiz-question.jpg` (wrong answer + fact)
  - `09-quiz-score.jpg`
  - `10-game.jpg`
  - `11-action.jpg`
  - `12-leaderboard.jpg`
  - `13-sources.jpg`

  They're all in the [`screenshots/`](screenshots/) folder.
- **Bugs found and fixed while testing:**
  1. Items inside scrolling screens could shrink to 0 height (the "Cairo 40%" bar disappeared).
  2. The tab bar flashed on the splash while the page loaded.
  3. The olive blob was cut off by the status bar.

### 5.4 Live test of version 2 (11 Nov 2026)
After pasting the new `Code.gs` and deploying it as a **new version** (Deploy → Manage deployments → Edit → New version, same URL), I tested on https://make-cairo-clean-again.vercel.app:

| Test | Result |
|---|---|
| Checked which `Code.gs` the Sheet was running | New version (the old one asked for a nickname) |
| Entered my name on the Name screen | Home shows "MAHMOUD E." |
| Full quiz | 8/10, "Saved to the leaderboard" |
| Full 60-second game (23 taps + 22 drags) | 450 points, saved |
| Ticked "Take the metro" | "Nice. Added to the Cairo total.", streak 1 |
| Leaderboard screen | "Mahmoud E. (you)" #1 on Quiz and Game, read live from the Google Sheet ([`screenshots/14-live-leaderboard.jpg`](screenshots/14-live-leaderboard.jpg)) |
| Google Sheet checked directly | Exactly 3 new rows (1 quiz, 1 game, 1 action), all with **"Mahmoud E."** in the **Name** column |

**Problem I hit:** after pasting the new code, the Sheet still ran the old version. Saving code in Apps Script doesn't change the live web app; you have to deploy it as a new version. Choosing "New deployment" instead would make a new URL that Vercel doesn't know about.
