/* ==========================================================================
   air.js — live Cairo air quality from the free Open-Meteo Air Quality API.
   Docs: https://open-meteo.com/en/docs/air-quality-api  (no key needed)
   The last result is saved so the screen still shows something offline.
   ========================================================================== */
var Air = (function () {
  'use strict';
  var CACHE_KEY = 'aqiCache';
  var FRESH_MS = 15 * 60 * 1000;   // reuse a result for 15 minutes
  var loading = false;

  var $ = function (id) { return document.getElementById(id); };

  /** Find the colour, name and tip for an AQI number. */
  function levelFor(aqi) {
    for (var i = 0; i < DATA.AQI_LEVELS.length; i++) {
      if (aqi <= DATA.AQI_LEVELS[i].max) return DATA.AQI_LEVELS[i];
    }
    return DATA.AQI_LEVELS[DATA.AQI_LEVELS.length - 1];
  }

  function url() {
    var c = window.APP_CONFIG.CAIRO;
    return 'https://air-quality-api.open-meteo.com/v1/air-quality' +
      '?latitude=' + c.lat + '&longitude=' + c.lon +
      '&current=us_aqi,pm2_5,pm10&timezone=Africa%2FCairo';
  }

  /** Put an AQI result on the Air screen and the Home tile. */
  function render(result, note) {
    var aqi = Math.round(result.aqi);
    var level = levelFor(aqi);
    $('aqiCard').style.setProperty('--aqi', level.color);
    $('aqiNum').textContent = aqi;
    $('aqiNum').setAttribute('aria-label', 'AQI ' + aqi);
    $('aqiLevel').textContent = level.name;
    $('aqiPm').textContent = 'PM2.5 ' + result.pm25.toFixed(1) + ' µg/m³';
    $('aqiTip').textContent = level.tip;
    var t = new Date(result.fetchedAt);
    $('aqiTime').textContent = (note ? note + ' · ' : 'Live · ') + 'updated ' +
      t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · Open-Meteo';
    $('homeAqi').textContent = 'AQI ' + aqi + ' · ' + level.name;
  }

  function renderError() {
    $('aqiNum').textContent = '--';
    $('aqiLevel').textContent = 'No live data';
    $('aqiPm').textContent = 'Check your internet';
    $('aqiTip').textContent = 'Take the metro and never burn trash.';
    $('aqiTime').textContent = 'Tap refresh to try again';
  }

  /** Load the live AQI (uses the saved one if it is fresh, unless force = true). */
  function load(force) {
    var cached = Store.get(CACHE_KEY, null);
    if (cached) render(cached, Date.now() - cached.fetchedAt > FRESH_MS ? 'Saved' : null);
    if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) return Promise.resolve(cached);
    if (loading) return Promise.resolve(cached);
    loading = true;
    if (!cached) $('aqiLevel').textContent = 'Loading…';

    return fetch(url())
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (!json.current || typeof json.current.us_aqi !== 'number') throw new Error('No AQI');
        var result = { aqi: json.current.us_aqi, pm25: json.current.pm2_5 || 0, fetchedAt: Date.now() };
        Store.set(CACHE_KEY, result);
        render(result);
        return result;
      })
      .catch(function (err) {
        console.warn('AQI failed:', err.message);
        if (!cached) renderError();
        else render(cached, 'Offline');
      })
      .finally(function () { loading = false; });
  }

  return { load: load, levelFor: levelFor };
})();
