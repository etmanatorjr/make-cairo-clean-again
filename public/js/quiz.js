/* ==========================================================================
   quiz.js — 10 random questions from my Air and Waste facts.
   - Questions in a random order every time, answers shuffled.
   - Shows right/wrong with the fact.
   - Final score, best score saved, score sent to the Google Sheet.
   ========================================================================== */
var Quiz = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LETTERS = ['A', 'B', 'C', 'D'];

  var questions = [];
  var pos = 0;
  var score = 0;

  /** Show one part of the quiz screen: intro, question or end. */
  function showPart(id) {
    ['quizIntro', 'quizQuestion', 'quizEnd'].forEach(function (p) { $(p).hidden = p !== id; });
  }

  function bestText() {
    var b = Store.bestQuiz();
    return b === null ? '–' : b + '/10';
  }

  /** Called when the Quiz screen opens. */
  function reset() {
    $('quizBestIntro').textContent = bestText();
    showPart('quizIntro');
  }

  function start() {
    questions = shuffle(DATA.QUIZ).slice(0, DATA.QUIZ_LENGTH);
    pos = 0;
    score = 0;
    showPart('quizQuestion');
    showQuestion();
  }

  function showQuestion() {
    var item = questions[pos];
    $('quizCount').textContent = (pos + 1) + ' / ' + questions.length;
    $('quizScoreLive').textContent = score;
    $('quizProgressFill').style.width = (pos / questions.length * 100) + '%';
    $('quizProgress').setAttribute('aria-valuenow', pos);
    $('quizQText').textContent = item.q;
    $('quizFeedback').hidden = true;
    $('btnQuizNext').hidden = true;

    var box = $('quizAnswers');
    box.innerHTML = '';
    var options = shuffle([item.a].concat(item.wrong));
    options.forEach(function (text, i) {
      // BUTTON: one answer choice
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'answer';
      btn.setAttribute('aria-label', 'Answer ' + LETTERS[i] + ': ' + text);
      btn.innerHTML = '<span class="letter" aria-hidden="true">' + LETTERS[i] + '</span><span></span>';
      btn.lastChild.textContent = text;
      btn.dataset.correct = text === item.a ? '1' : '0';
      btn.addEventListener('click', function () { choose(btn); });
      box.appendChild(btn);
    });
    var body = $('screen-quiz').querySelector('.screen-body');
    body.scrollTop = 0;
  }

  function choose(btn) {
    var item = questions[pos];
    var right = btn.dataset.correct === '1';
    if (right) score++;

    var all = $('quizAnswers').querySelectorAll('.answer');
    for (var i = 0; i < all.length; i++) {
      all[i].disabled = true;
      if (all[i].dataset.correct === '1') all[i].classList.add('correct');
    }
    if (!right) btn.classList.add('wrong');

    var fb = $('quizFeedback');
    fb.className = 'feedback ' + (right ? 'right' : 'wrong');
    $('quizFeedbackTitle').innerHTML = '<svg aria-hidden="true"><use href="#' + (right ? 'i-check' : 'i-x') + '"/></svg><span></span>';
    $('quizFeedbackTitle').lastChild.textContent = right ? 'Yep!' : "Nope. It's " + item.a;
    $('quizFeedbackFact').textContent = item.fact;
    fb.hidden = false;
    $('quizScoreLive').textContent = score;

    var next = $('btnQuizNext');
    next.textContent = pos === questions.length - 1 ? 'See my score' : 'Next';
    next.hidden = false;
    next.focus({ preventScroll: true });
    setTimeout(function () { next.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 60);
  }

  function next() {
    pos++;
    if (pos < questions.length) showQuestion();
    else finish();
  }

  function finish() {
    var isBest = Store.saveBest('quiz', score);
    $('quizProgressFill').style.width = '100%';
    $('quizFinal').textContent = score;
    $('quizEndBest').textContent = isBest ? 'New best!' : 'Your best: ' + bestText();
    $('quizSync').textContent = '';
    showPart('quizEnd');

    Api.sendScore('quiz', score).then(function (result) {
      $('quizSync').textContent =
        result === 'sent' ? '' :
        result === 'queued' ? 'No internet, your scores will save later' :
        "Couldn't save this one.";
    });
  }

  // BUTTON handlers
  $('btnQuizStart').addEventListener('click', start);
  $('btnQuizNext').addEventListener('click', next);
  $('btnQuizAgain').addEventListener('click', start);

  return { reset: reset };
})();
