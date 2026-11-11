/* ==========================================================================
   router.js — moves between screens (instantly, no animation).

   - Tab screens: Home, Air, Waste, Play, Action (with the tab bar).
   - Inner screens: Quiz, Game, Leaderboard, Sources, Name (with a Back button).
   - Uses the browser history, so the phone/browser Back button also works
     (important for the Android APK later).
   ========================================================================== */
var Router = (function () {
  'use strict';

  var TABS = ['home', 'air', 'waste', 'play', 'action'];
  var hooks = {};        // screen name -> { enter: fn, leave: fn }
  var current = null;    // name of the visible screen
  var index = 0;         // position in browser history (to know back vs forward)

  var tabBar = document.getElementById('tabBar');

  function el(name) { return document.getElementById('screen-' + name); }
  function exists(name) { return !!el(name); }
  function isTab(name) { return TABS.indexOf(name) !== -1; }

  /** Where the Back button goes if there is no history (e.g. page was refreshed). */
  function parentOf(name) {
    if (name === 'name') return Store.hasName() ? 'home' : 'splash';
    return el(name).getAttribute('data-parent') || 'home';
  }

  /** Let other files run code when a screen opens or closes. */
  function on(name, enter, leave) { hooks[name] = { enter: enter, leave: leave }; }

  /** Show a screen straight away (no animation). */
  function show(name) {
    if (!exists(name)) name = 'home';
    if (name === current) return;
    var next = el(name);

    if (current && hooks[current] && hooks[current].leave) hooks[current].leave();
    if (current) el(current).hidden = true;
    next.hidden = false;
    var body = next.querySelector('.screen-body');
    if (body) body.scrollTop = 0;

    current = name;
    updateChrome(name);

    // tell screen readers what screen this is: focus its title
    var title = next.querySelector('h1');
    if (title) title.focus({ preventScroll: true });
    document.title = next.getAttribute('data-title') + ' · Make Cairo Clean Again';

    if (hooks[name] && hooks[name].enter) hooks[name].enter();
  }

  /** Show/hide the tab bar and highlight the active tab. */
  function updateChrome(name) {
    var tab = el(name).getAttribute('data-tab');
    tabBar.classList.toggle('is-hidden', !tab);
    tabBar.setAttribute('aria-hidden', tab ? 'false' : 'true');
    var tabs = tabBar.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      t.tabIndex = tab ? 0 : -1;
      if (t.getAttribute('data-tab-go') === tab) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    }
  }

  /**
   * Go to a screen.
   * Tabs replace each other in history; inner screens are pushed on top,
   * so Back returns to where you came from.
   */
  function go(name, opts) {
    opts = opts || {};
    if (!exists(name) || name === current) return;
    if (opts.replace || (isTab(name) && current && isTab(current))) {
      history.replaceState({ screen: name, i: index }, '', '#' + name);
    } else if (isTab(name) && current && !isTab(current)) {
      // going from an inner screen to a tab: start fresh at this tab
      history.replaceState({ screen: name, i: index }, '', '#' + name);
    } else {
      index++;
      history.pushState({ screen: name, i: index }, '', '#' + name);
    }
    show(name);
  }

  /** The Back button on inner screens. */
  function back() {
    if (history.state && history.state.i > 0) {
      history.back();           // popstate below shows the previous screen
    } else {
      go(parentOf(current), { replace: true });
    }
  }

  // Browser / phone Back and Forward buttons
  window.addEventListener('popstate', function (e) {
    var state = e.state || { screen: (location.hash || '#home').slice(1), i: 0 };
    index = state.i;
    // you need a name before you can use the other screens
    var target = state.screen;
    if (!Store.hasName() && target !== 'splash' && target !== 'name') target = 'splash';
    show(target);
  });

  /** First screen when the app opens. */
  function start(firstScreen) {
    index = 0;
    history.replaceState({ screen: firstScreen, i: 0 }, '', '#' + firstScreen);
    show(firstScreen);
  }

  return {
    TABS: TABS,
    on: on,
    go: go,
    back: back,
    start: start,
    current: function () { return current; }
  };
})();
