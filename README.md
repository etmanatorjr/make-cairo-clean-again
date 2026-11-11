# Make Cairo Clean Again

**Live app: https://make-cairo-clean-again.vercel.app**

An SDG 11.6 app for teens in Cairo about **air quality** and **waste**, both halves of the goal.
Made by **Mahmoud Etman 9E**.

- Learn about PM2.5, AQI and Cairo's **live air quality** (Open-Meteo API)
- Learn where Cairo's waste goes and how recycling is growing
- Play a **10-question quiz** and a timed **trash sorting game**
- Tick off real **daily actions** (recycle, take the metro, don't burn trash) and keep a streak
- Every score and action is saved to a **Google Sheet** and shown on a **leaderboard**

Works on a laptop (shows an iPhone 18 Pro screen) and on a real phone (fills the screen).
It can be installed as an app (PWA) and opens offline.

Evidence for my teacher (every extra skill, what I researched, and where it is in the code): **[EVIDENCE.md](EVIDENCE.md)**

---

## Screens

| Screen | What it does |
|---|---|
| Splash | App name, logo, Start button |
| Nickname | First time only: pick a safe nickname (max 15, no real names/emails, bad words blocked) |
| Home | Hello + nickname, "everyone together" totals from the sheet, big buttons |
| Air | PM2.5 and AQI explained, live Cairo AQI with a tip, bar chart, causes |
| Waste | Fact cards: how much waste, where it goes, recycling, solutions |
| Play | Choose Quiz or Game |
| Quiz | 10 random questions, shuffled answers, right/wrong with the fact, best score |
| Game | Sort falling trash into 4 bins in 60 seconds, drag or tap |
| Take Action | Tick real actions daily, streak counter |
| Leaderboard | Top 10 quiz and top 10 game, my rank highlighted |
| Sources | Works cited + Open-Meteo |

## How it works

```
 Phone / browser                Vercel (my server)                 Google
┌───────────────┐  POST/GET   ┌──────────────────────┐  POST/GET  ┌──────────────────┐
│ public/       │ ──────────▶ │ /api/score           │ ─────────▶ │ Apps Script      │
│ HTML CSS JS   │  /api/...   │ /api/action          │  + SECRET  │ (Code.gs)        │
│ localStorage  │ ◀────────── │ /api/leaderboard     │ ◀───────── │   ▼              │
│ offline queue │    JSON     │ /api/stats           │  302→JSON  │ Google Sheet     │
└───────────────┘             │ checks + rate limit  │            │ Scores / Actions │
        │                     └──────────────────────┘            └──────────────────┘
        └──▶ Open-Meteo Air Quality API (live AQI, no key)
```

The app never knows the Sheet URL or the secret. Only the Vercel server does (environment variables).

## Folders

```
public/                  the app (plain HTML, CSS, JavaScript, no frameworks)
  index.html             every screen
  css/styles.css         all styles
  js/config.js           the full Vercel URL (so the Android APK can call the API)
  js/rules.js            nickname/score/action rules, shared by the app AND the server
  js/*.js                one file per part (router, air, quiz, game, actions, ...)
  sw.js, manifest.webmanifest, icons/   PWA
api/                     Vercel serverless functions
  score.js action.js leaderboard.js stats.js
  _lib/http.js           CORS, rate limit, JSON helpers
  _lib/sheet.js          talks to Apps Script (handles the 302 redirect)
google-apps-script/Code.gs   paste into Google Apps Script
dev/                     local server + fake Apps Script for testing
tests/api.test.js        automatic tests (npm test)
```

## Run it on my computer

Needs [Node.js](https://nodejs.org) 20 or newer. Nothing to install.

```bash
npm run dev
```

Open http://localhost:3000. If `.env.local` has a `SHEET_URL`, it uses the real Google Sheet;
if not, it uses a fake Apps Script that runs my real `Code.gs`.

```bash
npm test
```

Runs 14 automatic tests on the rules, all four API routes, the 302 redirect, wrong secret, bad input, CORS and the rate limit.

## Set up the Google Sheet (step by step)

1. Go to **sheets.new**. Name it "Make Cairo Clean Again Results".
2. **Extensions → Apps Script**.
3. Delete the starter code, paste all of [`google-apps-script/Code.gs`](google-apps-script/Code.gs), press **Cmd/Ctrl + S**.
4. Make a secret: any long random text (I used 48 random characters). Keep it private.
5. **Project Settings** (gear) → **Script properties** → **Add script property**:
   Property `SHEET_SECRET`, Value = the secret → **Save script properties**.
6. Back in the **Editor**, choose `setup` in the function list → **Run** → allow access
   (Google shows "hasn't verified this app": **Advanced → Go to … (unsafe)**; it's my own script).
   The log says *"Tabs are ready. SHEET_SECRET is set."* and the tabs **Scores** and **Actions** appear.
7. **Deploy → New deployment** → gear → **Web app**.
   **Execute as: Me**. **Who has access: Anyone**. → **Deploy**.
8. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/…/exec`. This is `SHEET_URL`.

"Anyone" is needed so Vercel can reach it, but nobody can read or write without the secret.
If I change `Code.gs` later: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (the URL stays the same).

## Deploy on Vercel (step by step)

1. Push the code to GitHub (done: https://github.com/etmanatorjr/make-cairo-clean-again).
2. On **vercel.com** → **Add New… → Project** → **Import** `make-cairo-clean-again`.
3. Framework Preset: **Other**. Leave build and output settings empty (Vercel serves `public/` and turns `api/` into functions).
4. **Environment Variables**: add `SHEET_URL` and `SHEET_SECRET` (same values as above).
5. **Deploy**.
6. If I change an environment variable later: **Deployments → ⋯ → Redeploy** (variables only apply to new deployments).

Every `git push` to `main` deploys again automatically.

## API

| Route | Body / query | Answer |
|---|---|---|
| `POST /api/score` | `{ "nickname": "Eco Falcon", "type": "quiz", "score": 8 }` | `201 { ok: true }` |
| `POST /api/action` | `{ "nickname": "Eco Falcon", "action": "metro" }` | `201 { ok: true }` |
| `GET /api/leaderboard` | `?nickname=Eco Falcon` (optional) | top 10 quiz, top 10 game, my rank |
| `GET /api/stats` | | totals: actions, quizzes, games, players |

Rules checked on the server: nickname 2–15 characters, no emails/links/phone numbers/bad words;
type `quiz` (0–10) or `game` (0–1000, multiple of 5); action `recycle`, `metro` or `noburn`.
Errors: `400` bad input, `405` wrong method, `429` too many requests (10 writes per minute per IP), `502/504` sheet problem.

## Android APK later (Capacitor)

The app is plain files in `public/`, and `js/config.js` uses the full Vercel URL, so it can be wrapped as is:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Make Cairo Clean Again" com.mahmoudetman.cleancairo --web-dir public
npx cap add android
npx cap open android
```

The API already allows the Capacitor origins (`https://localhost`, `capacitor://localhost`).

## Sources

EcoHubMap · The Global Goals · IQAir · WHO · Egypt Today · ScienceDirect · Waste & Recycling Magazine · Open-Meteo.
Full list in the app (Sources screen) and in [`public/js/data.js`](public/js/data.js).
