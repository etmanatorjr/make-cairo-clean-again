/* ==========================================================================
   router.js — moves between screens with smooth slide/fade transitions.

   - Tab screens (Home, Air, Waste, Play, Action) fade into each other.
   - Inner screens (Quiz, Game, Leaderboard, Sources, Name) slide in from
     the right and slide back out when you press Back.
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

  /** Show a screen. dir = "forward", "back" or "fade". */
  function show(name, dir) {
    if (!exists(name)) name = 'home';
    if (name === current) return;
    var next = el(name);
    var prev = current ? el(current) : null;

    if (current && hooks[current] && hooks[current].leave) hooks[current].leave();

    // animate the old screen out
    if (prev) {
      prev.className = prev.className.replace(/\banim-\S+/g, '').trim();
      prev.classList.add('anim-out-' + dir);
      var prevName = current;
      var done = function () {
        if (current !== prevName) prev.hidden = true; // (unless we came straight back)
        prev.classList.remove('anim-out-' + dir);
      };
      setTimeout(done, 360);
    }

    // animate the new screen in
    next.className = next.className.replace(/\banim-\S+/g, '').trim();
    next.hidden = false;
    next.classList.add('anim-in-' + dir);
    setTimeout(function () { next.classList.remove('anim-in-' + dir); }, 380);
    var body = next.querySelector('.screen-body');
    if (body && dir !== 'back') body.scrollTop = 0;

    current = name;
    updateChrome(name);

    // tell screen readers what screen this is: focus its title
    var title = next.querySelector('h1');
    if (title) setTimeout(function () { title.focus({ preventScroll: true }); }, 50);
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
    var dir = opts.dir || (isTab(name) && (!current || isTab(current)) ? 'fade' : 'forward');
    if (opts.replace || (isTab(name) && current && isTab(current))) {
      history.replaceState({ screen: name, i: index }, '', '#' + name);
    } else if (isTab(name) && current && !isTab(current)) {
      // going from an inner screen to a tab: start fresh at this tab
      history.replaceState({ screen: name, i: index }, '', '#' + name);
    } else {
      index++;
      history.pushState({ screen: name, i: index }, '', '#' + name);
    }
    show(name, dir);
  }

  /** The Back button on inner screens. */
  function back() {
    if (history.state && history.state.i > 0) {
      history.back();           // popstate below shows the previous screen
    } else {
      go(parentOf(current), { replace: true, dir: 'back' });
    }
  }

  // Browser / phone Back and Forward buttons
  window.addEventListener('popstate', function (e) {
    var state = e.state || { screen: (location.hash || '#home').slice(1), i: 0 };
    var dir = state.i < index ? 'back' : 'forward';
    index = state.i;
    // you need a name before you can use the other screens
    var target = state.screen;
    if (!Store.hasName() && target !== 'splash' && target !== 'name') target = 'splash';
    show(target, dir);
  });

  /** First screen when the app opens. */
  function start(firstScreen) {
    index = 0;
    tabBar.classList.add('no-anim');            // no slide on the very first screen
    setTimeout(function () { tabBar.classList.remove('no-anim'); }, 50);
    history.replaceState({ screen: firstScreen, i: 0 }, '', '#' + firstScreen);
    show(firstScreen, 'fade');
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
