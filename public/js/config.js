/* ==========================================================================
   config.js — app settings.
   API_BASE is the FULL Vercel address. The app always calls the API with the
   full address, so it still works when the app is packed into an Android APK
   (Capacitor), where the page is not served from Vercel.
   ========================================================================== */
window.APP_CONFIG = {
  // My live Vercel site (the /api routes live here)
  API_BASE: 'https://make-cairo-clean-again.vercel.app',

  // When I test on my own computer with "npm run dev", the API runs on the
  // same local server, so the app uses it instead of the live one.
  LOCAL_DEV_HOSTS: ['localhost:3000', '127.0.0.1:3000'],

  // Cairo for the live air quality (Open-Meteo, free, no key needed)
  CAIRO: { lat: 30.0444, lon: 31.2357 },

  // How long one game lasts (seconds)
  GAME_SECONDS: 60
};
