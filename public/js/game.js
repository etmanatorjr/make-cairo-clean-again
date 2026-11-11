/* ==========================================================================
   game.js — "Sort the Trash": trash falls down, put it in the right bin
   (plastic, paper, metal, organic) before the 60 second timer runs out.

   Ways to sort:
     1. Drag an item onto a bin (mouse or finger, using Pointer Events).
     2. Tap an item to select it, then tap a bin.
     3. Tap a bin with nothing selected = sorts the lowest item.
     4. Keyboard: keys 1-4 sort the lowest item into bin 1-4.
   Points: +10 right bin, -5 wrong bin (never below 0).
   ========================================================================== */
var Game = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var area = $('gameArea');
  var layer = $('gameItems');
  var binsBox = $('bins');
  var bins = Array.prototype.slice.call(binsBox.querySelectorAll('.bin'));
  var overlay = $('gameOverlay');
  var mainBtn = $('btnGameMain');

  var ITEM_W = 72;
  var state = 'idle';          // idle | playing | paused | over
  var items = [];
  var selected = null;
  var drag = null;             // { item, dx, dy, startX, startY, moved }
  var score = 0;
  var timeLeft = 0;
  var spawnTimer = 0;
  var lastFrame = 0;
  var raf = 0;
  var nextId = 1;
  var lastLabel = '';

  // ---------- helpers ----------
  function duration() { return window.APP_CONFIG.GAME_SECONDS; }
  function progress() { return 1 - timeLeft / duration(); }        // 0 → 1 during the game
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** How much the screen is scaled (the phone frame is scaled to fit on small laptops). */
  function scale() {
    var r = area.getBoundingClientRect();
    return r.width / area.offsetWidth || 1;
  }

  /** Convert a mouse/finger position to a position inside the game area. */
  function local(e) {
    var r = area.getBoundingClientRect();
    var s = scale();
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  }

  function binsTop() { return binsBox.offsetTop; }

  function setHud() {
    $('gameScore').textContent = score;
    $('gameTime').textContent = Math.ceil(timeLeft);
    var best = Store.bestGame();
    $('gameBest').textContent = best === null ? 0 : best;
  }

  // ---------- overlay (start / pause / game over) ----------
  function showOverlay(title, text, buttonText, buttonLabel, showRules) {
    $('gameOverlayTitle').textContent = title;
    $('gameOverlayText').textContent = text;
    $('gameRules').hidden = !showRules;
    mainBtn.textContent = buttonText;
    mainBtn.setAttribute('aria-label', buttonLabel);
    overlay.hidden = false;
    mainBtn.focus({ preventScroll: true });
  }

  /** Called when the Game screen opens. */
  function reset() {
    stopLoop();
    clearItems();
    state = 'idle';
    score = 0;
    timeLeft = duration();
    setHud();
    $('gameSync').textContent = '';
    showOverlay('Sort the trash', "Drag each thing into the right bin. Or tap it, then tap a bin. You've got 60 seconds.", 'Start', 'Start the game', true);
  }

  function start() {
    clearItems();
    score = 0;
    timeLeft = duration();
    spawnTimer = 0.3;
    state = 'playing';
    overlay.hidden = true;
    $('gameSync').textContent = '';
    setHud();
    startLoop();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    stopLoop();
    endDrag(null);
    showOverlay('Paused', "Timer's stopped.", 'Keep going', 'Resume the game', false);
  }

  function resume() {
    state = 'playing';
    overlay.hidden = true;
    startLoop();
  }

  function finish() {
    state = 'over';
    stopLoop();
    endDrag(null);
    clearItems();
    var isBest = Store.saveBest('game', score);
    setHud();
    showOverlay("Time's up",
      'You got ' + score + ' points. ' + (isBest ? 'New best!' : 'Your best: ' + Store.bestGame() + '.'),
      'Go again', 'Play the game again', false);
    $('gameSync').textContent = '';
    Api.sendScore('game', score).then(function (result) {
      $('gameSync').textContent =
        result === 'sent' ? '' :
        result === 'queued' ? "No internet. It'll send later." :
        "Couldn't save this one.";
    });
  }

  /** Called when you leave the Game screen: stop everything, nothing is saved. */
  function leave() {
    stopLoop();
    endDrag(null);
    clearItems();
    state = 'idle';
  }

  // ---------- the game loop ----------
  function startLoop() {
    lastFrame = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

  function tick(now) {
    if (state !== 'playing') return;                       // stopped, paused or left the screen
    var dt = Math.min(0.05, (now - lastFrame) / 1000);   // seconds since last frame
    lastFrame = now;

    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; setHud(); finish(); return; }

    // new trash appears faster as time goes on
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawn();
      spawnTimer = lerp(1.5, 0.7, progress());
    }

    // move every item down
    var floor = binsTop() - 70;
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (drag && drag.item === it) continue;
      it.y += it.speed * dt;
      if (it.y >= floor) { miss(it); continue; }
      place(it);
    }
    setHud();
    raf = requestAnimationFrame(tick);
  }

  // ---------- trash items ----------
  function spawn() {
    var pick;
    do { pick = DATA.TRASH[Math.floor(Math.random() * DATA.TRASH.length)]; } while (pick.label === lastLabel);
    lastLabel = pick.label;

    // BUTTON: one falling trash item (drag it or tap it)
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'trash';
    el.setAttribute('aria-label', pick.label + '. Tap, then tap a bin.');
    el.innerHTML = '<svg aria-hidden="true"><use href="#' + pick.icon + '"/></svg><span></span>';
    el.lastChild.textContent = pick.label;

    var width = area.offsetWidth;
    var item = {
      id: nextId++, el: el, type: pick.bin, label: pick.label,
      x: 8 + Math.random() * (width - ITEM_W - 16),
      y: -80,
      speed: lerp(70, 150, progress()) * (0.85 + Math.random() * 0.3)
    };
    el.addEventListener('pointerdown', function (e) { startDrag(e, item); });
    // keyboard users: Enter/Space on an item selects it (e.detail is 0 for keyboard clicks)
    el.addEventListener('click', function (e) { if (e.detail === 0 && state === 'playing') select(item); });
    items.push(item);
    layer.appendChild(el);
    place(item);
  }

  function place(it) {
    it.el.style.transform = 'translate(' + it.x + 'px,' + it.y + 'px)';
  }

  function removeItem(it) {
    items.splice(items.indexOf(it), 1);
    if (selected === it) selected = null;
    it.el.remove();
  }

  function clearItems() {
    items = [];
    selected = null;
    layer.innerHTML = '';
  }

  function miss(it) {
    floatText(it.x + 10, it.y, 'Missed', 'bad');
    removeItem(it);
  }

  /** Lowest item on screen (closest to the bins). */
  function lowest() {
    var low = null;
    items.forEach(function (it) { if (!low || it.y > low.y) low = it; });
    return low;
  }

  function select(it) {
    if (selected) selected.el.classList.remove('is-selected');
    selected = selected === it ? null : it;
    if (selected) selected.el.classList.add('is-selected');
  }

  /** Put an item in a bin and score it. */
  function sort(it, binName) {
    if (!it || state !== 'playing') return;
    var binEl = binsBox.querySelector('[data-bin="' + binName + '"]');
    var right = it.type === binName;
    if (right) score += 10;
    else score = Math.max(0, score - 5);
    floatText(it.x + 14, it.y, right ? '+10' : '−5', right ? 'good' : 'bad');
    // outline the bin green-ish (right) or red (wrong) for a moment
    binEl.classList.remove('flash-right', 'flash-wrong');
    binEl.classList.add(right ? 'flash-right' : 'flash-wrong');
    clearTimeout(binEl._flash);
    binEl._flash = setTimeout(function () { binEl.classList.remove('flash-right', 'flash-wrong'); }, 350);
    removeItem(it);
    if (navigator.vibrate && !right) navigator.vibrate(40);
    setHud();
  }

  function floatText(x, y, text, kind) {
    var f = document.createElement('span');
    f.className = 'float-text ' + kind;
    f.textContent = text;
    f.setAttribute('aria-hidden', 'true');
    f.style.left = x + 'px';
    f.style.top = Math.max(10, y) + 'px';
    area.appendChild(f);
    setTimeout(function () { f.remove(); }, 600);
  }

  /** Which bin is under this point (or null)? */
  function binAt(p) {
    var s = scale();
    var areaRect = area.getBoundingClientRect();
    for (var i = 0; i < bins.length; i++) {
      var r = bins[i].getBoundingClientRect();
      var left = (r.left - areaRect.left) / s, right = (r.right - areaRect.left) / s;
      var top = (r.top - areaRect.top) / s - 30;                     // a little help above the bin
      if (p.x >= left && p.x <= right && p.y >= top) return bins[i];
    }
    return null;
  }

  // ---------- drag and drop (Pointer Events: works for mouse AND touch) ----------
  function startDrag(e, it) {
    if (state !== 'playing') return;
    e.preventDefault();
    var p = local(e);
    drag = { item: it, dx: p.x - it.x, dy: p.y - it.y, startX: p.x, startY: p.y, moved: false, pointerId: e.pointerId };
    it.el.classList.add('is-dragging');
    try { area.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    var p = local(e);
    if (Math.abs(p.x - drag.startX) + Math.abs(p.y - drag.startY) > 8) drag.moved = true;
    drag.item.x = p.x - drag.dx;
    drag.item.y = p.y - drag.dy;
    place(drag.item);
    var over = binAt(p);
    bins.forEach(function (b) { b.classList.toggle('is-hover', b === over); });
  }

  function endDrag(e) {
    if (!drag) return;
    var d = drag;
    drag = null;
    d.item.el.classList.remove('is-dragging');
    bins.forEach(function (b) { b.classList.remove('is-hover'); });
    if (!e) return;
    if (!d.moved) { select(d.item); return; }          // it was a tap: select it
    var over = binAt(local(e));
    if (over) sort(d.item, over.getAttribute('data-bin'));
    // else: let go somewhere else — it keeps falling from there
  }

  area.addEventListener('pointermove', moveDrag);
  area.addEventListener('pointerup', endDrag);
  area.addEventListener('pointercancel', function () { endDrag(null); });

  // BUTTON handlers: tapping a bin
  bins.forEach(function (bin) {
    bin.addEventListener('click', function () {
      if (state !== 'playing') return;
      sort(selected || lowest(), bin.getAttribute('data-bin'));
    });
  });

  // Keyboard: 1-4 = bins, P = pause
  document.addEventListener('keydown', function (e) {
    if (Router.current() !== 'game') return;
    if (state === 'playing' && e.key >= '1' && e.key <= '4') {
      sort(selected || lowest(), bins[Number(e.key) - 1].getAttribute('data-bin'));
    } else if (e.key === 'p' || e.key === 'P') {
      if (state === 'playing') pause(); else if (state === 'paused') resume();
    }
  });

  // BUTTON: Start / Resume / Play again (one button, label changes)
  mainBtn.addEventListener('click', function () {
    if (state === 'paused') resume();
    else start();
  });
  // BUTTON: Pause
  $('btnGamePause').addEventListener('click', function () {
    if (state === 'playing') pause(); else if (state === 'paused') resume();
  });

  // Pause automatically if the app goes to the background
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
  });

  return { reset: reset, leave: leave };
})();
