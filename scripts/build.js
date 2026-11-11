/* ==========================================================================
   scripts/build.js — makes the www folder for the Android app (Capacitor).
     npm run build
   It copies ONLY the front end (everything in public/) into www/,
   plus Capacitor's core script (www/js/capacitor.js).
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

// Capacitor's core script, so js/native.js can use the Android plugins
// (only loaded inside the app, never on the website)
fs.copyFileSync(path.join(ROOT, 'node_modules/@capacitor/core/dist/capacitor.js'), path.join(TO, 'js/capacitor.js'));

// count what was copied
let files = 0;
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(dir, f.name));
    else files++;
  }
})(TO);
console.log('Built www/ with ' + files + ' files from public/');
