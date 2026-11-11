/* ==========================================================================
   native.js — things that only happen inside the Android app (Capacitor).
   On the website this file does nothing.

   - Status bar: dark #0B2827 with light icons (@capacitor/status-bar).
     On Android 15+ the status bar is see-through (edge-to-edge), so the
     #0B2827 colour is painted behind it by styles.css (.is-native).
   - Android back button (@capacitor/app): goes back one screen;
     on Home it asks "Exit the app?".
   ========================================================================== */
var Native = (function () {
  'use strict';

  // Capacitor's native bridge adds window.Capacitor before any page script runs.
  var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var App = null;

  /** Load Capacitor's core script (copied into www/js by npm run build). */
  function loadCore(done) {
    if (window.Capacitor && window.Capacitor.registerPlugin) return done();
    var s = document.createElement('script');
    s.src = 'js/capacitor.js';
    s.onload = done;
    s.onerror = function () { console.warn('capacitor.js missing: run npm run build'); };
    document.head.appendChild(s);
  }

  /** What the Android back button does. */
  function onBack() {
    var screen = Router.current();
    // Home (or the very first screen): ask before leaving the app
    if (screen === 'home' || screen === 'splash') {
      if (window.confirm('Exit the app?')) App.exitApp();
      return;
    }
    // first-time name screen goes back to the start screen
    if (screen === 'name' && !Store.hasName()) {
      Router.go('splash', { replace: true });
      return;
    }
    // other tabs (Air, Waste, Play, Action) go back to Home
    if (Router.TABS.indexOf(screen) !== -1) {
      Router.go('home');
      return;
    }
    // inner screens (Quiz, Game, Leaderboard, Sources, Name): one screen back
    Router.back();
  }

  function init() {
    if (!isNative) return;
    loadCore(function () {
      var plugins = window.Capacitor;
      App = plugins.registerPlugin('App');
      var StatusBar = plugins.registerPlugin('StatusBar');
      var ignore = function () {};

      // light icons on the dark bar ("DARK" style = for dark backgrounds)
      StatusBar.setStyle({ style: 'DARK' }).catch(ignore);
      // Android 14 and older can still colour the bar itself
      StatusBar.setBackgroundColor({ color: '#0B2827' }).catch(ignore);

      App.addListener('backButton', onBack);
    });
  }

  return { isNative: isNative, init: init };
})();
