/* ==========================================================================
   scripts/build.js — makes the www folder for the Android app (Capacitor).
     npm run build
   It copies ONLY the front end (everything in public/) into www/.
   The /api folder, node_modules and google-apps-script are never copied,
   because they are not inside public/.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FROM = path.join(ROOT, 'public');
const TO = path.join(ROOT, 'www');

fs.rmSync(TO, { recursive: true, force: true });
fs.cpSync(FROM, TO, { recursive: true });

// count what was copied
let files = 0;
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(dir, f.name));
    else files++;
  }
})(TO);
console.log('Built www/ with ' + files + ' files from public/');
