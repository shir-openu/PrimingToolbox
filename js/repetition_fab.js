/**
 * =====================================================
 * PrimingToolbox - Repetition Priming (V2 _fab)
 * =====================================================
 *
 * Word-fragment completion. Two phases:
 *
 *   STUDY : words are shown one at a time and rated for pleasantness. The
 *           rating is a cover task - nobody is told there will be a later test,
 *           which is what makes the effect implicit.
 *   TEST  : word fragments (E _ E _ H A N T) are completed. Half come from
 *           studied words, half from words never seen. Studied fragments are
 *           completed more often, even by participants who cannot recall the
 *           study list.
 *
 * ABCD: A = the studied word, B = the fragment task, C = completion rate for
 * unstudied fragments, D = completion rate for studied fragments.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE FRAMEWORK'S COUNTER-EXAMPLE, NOT AN ORDINARY PARADIGM
 * ---------------------------------------------------------------------------
 * Section 4 of the meta-disciplinary definition argues that repetition priming
 * is NOT priming. Association holds (prime and target are identical, so the
 * link is maximal) and modulation holds (the completion rate really does move),
 * but SECONDARINESS FAILS: because the participant acts on the first
 * presentation, that item has already been processed as primary for its own
 * response. It is a pre-activation of direct rather than indirect processing.
 *
 * The previous version presented this as an ordinary paradigm and printed
 * "Repetition priming effect (D)" with no qualification, which contradicted the
 * paper the platform is built on. The task still runs - it is the diagnostic
 * demonstration - but the results screen now returns the A/S/M verdict, and the
 * builder carries the same warning.
 *
 * ALSO FIXED 2026-08-10: timing.study_ms was declared, exposed through the
 * participant link, and never read anywhere in the file. The study word waited
 * indefinitely for a rating, so an experimenter who set it got silence. It is
 * now a real auto-advance timeout.
 *
 * Previous version (never published to GitHub; local branch v2-four-paradigms):
 *     git show d313317:js/repetition_fab.js
 *
 * @module RepetitionPriming
 * @version 2.0
 * @requires PTA (js/core_fab.js), PTK (js/paradigm_kit_fab.js)
 */
window.RepetitionPriming = {

  data: {
    // fragment: the letters kept; blanks marked with _
    items: [
      { word: 'ELEPHANT', fragment: 'E _ E _ H A N T' },
      { word: 'BALLOON',  fragment: 'B A _ _ O O N' },
      { word: 'DIAMOND',  fragment: '_ I A _ O N D' },
      { word: 'PYRAMID',  fragment: 'P _ R A _ I D' },
      { word: 'HARVEST',  fragment: 'H A _ V _ S T' },
      { word: 'JOURNEY',  fragment: 'J O _ R _ E Y' },
      { word: 'MAGNET',   fragment: 'M A _ N _ T' },
      { word: 'VOLCANO',  fragment: 'V O _ C _ N O' },
      { word: 'LANTERN',  fragment: 'L A _ T _ R N' },
      { word: 'COMPASS',  fragment: 'C O _ P _ S S' },
      { word: 'TRUMPET',  fragment: 'T R _ M _ E T' },
      { word: 'BLANKET',  fragment: 'B L _ N _ E T' }
    ]
  },

  state: {
    studyList: [], testList: [], currentIndex: 0,
    phase: 'setup',           // setup | study | bridge | test | results
    onset: 0, results: [], studyRatings: []
  },

  timing: {
    study_ms: 6000,           // auto-advance if the word is not rated
    iti_ms: 400
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  practiceTrials: 0,          // not meaningful here - see spec()
  _initDone: false,
  _participantId: '',
  _locked: false,

  spec: function () {
    return {
      key: 'repetition',
      name: 'Repetition Priming',
      source: 'Word-fragment completion; Scarborough et al. (1977) for the RT form',
      urlParam: 'repetition',
      template: 'repetition-priming',
      accent: '#e38b82',
      articleAnchor: '#s4',
      defaultExperimentId: 'repetition_priming',
      startFn: 'RepetitionPriming.start()',
      closeFn: 'RepetitionPriming.close()',
      howToPlay: [
        'First, words appear one at a time. For each, rate <b>how pleasant it feels</b> on a 1&ndash;5 scale. There is no right answer.',
        '<b>Do not try to memorise anything.</b> That matters &ndash; the rating is a cover task, and the experiment only works if you are not deliberately learning the list.',
        'Then you will see <b>word fragments</b> with letters missing.',
        'Type the <b>first complete word that comes to mind</b>. If nothing comes, press &ldquo;I do not know&rdquo; and move on &ndash; that is a perfectly normal answer.'
      ],
      keyLegend: 'Some fragments come from words you rated earlier and some from words you have never seen. You are not meant to be able to tell which is which.',
      example: '<div style="text-align:center;">' +
        '<div style="color:#9aa6b2;font-size:.82rem;margin-bottom:8px;">A fragment looks like this:</div>' +
        '<div style="font-size:2rem;font-weight:700;letter-spacing:6px;color:#e38b82;">E _ E _ H A N T</div>' +
        '<div style="color:#4ade80;font-size:.92rem;margin-top:10px;">&rarr; type ELEPHANT</div>' +
        '<div style="color:#9aa6b2;font-size:.82rem;margin-top:6px;">the underscores are the missing letters</div>' +
      '</div>',
      abcd: {
        A: 'The word shown and rated during the study phase.',
        B: 'Completing a word fragment.',
        C: 'Completion rate for fragments of words never seen.',
        D: 'Completion rate for fragments of words studied earlier.'
      },
      characteristics: {
        association: 'MET - prime and target are the same word, so the association is maximal.',
        secondariness: 'NOT MET - the participant responds to the word during the study phase, so it has already been processed as primary for its own response.',
        modulation: 'MET - studied fragments are completed more often than unstudied ones.'
      },
      boundaryNote:
        'This design is the framework\'s counter-example. Two of the three characteristics hold, ' +
        'but secondariness fails, so under the definition this is NOT an instance of priming. ' +
        'It is included so the boundary can be demonstrated rather than asserted.',
      instructions: 'Rate some words for pleasantness, then complete word fragments.',
      stimulusGroups: [
        { key: 'items', label: 'Words and their fragments', type: 'rows', min: 4,
          fields: [{ key: 'word', label: 'Word' }, { key: 'fragment', label: 'Fragment' }],
          help: 'Use _ for a missing letter and put a space between every character, e.g. "E _ E _ H A N T". Half the list is studied and half is not, chosen at random each run, so every word serves in both roles across participants.' }
      ],
      timingFields: [
        { key: 'study_ms', label: 'Study word timeout', min: 1000, max: 30000, step: 500,
          help: 'How long a study word waits for a pleasantness rating before moving on.' },
        { key: 'iti_ms', label: 'Gap between items', min: 0, max: 3000, step: 50 }
      ],
      toConfig: function (mod) { return mod.toConfig(); },
      asm: function (mod) {
        var words = (mod.data.items || []).map(function (i) { return i.word; });
        return {
          instructions: 'Complete each word fragment with the first word that comes to mind.',
          primes: words,
          // Deliberately identical to primes. That identity is exactly what the
          // validator's secondariness check should catch, and exactly what the
          // paper says disqualifies this design.
          targets: words,
          conditions: ['studied', 'unstudied'],
          baseline: 'unstudied',
          response: { 'typed completion': 'text' }
        };
      }
    };
  },

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    PTK.timers(this);
    console.log('Repetition Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('repetition-overlay')) return;
    var el = document.createElement('div');
    el.id = 'repetition-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="repetition-setup"></div>' +

        '<div id="repetition-study" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="repetition-study-progress"></div>' +
          PTK.progressHtml('repetition-study-fill') +
          '<div style="color:#64748b;font-size:.8rem;letter-spacing:2px;margin-top:18px;">HOW PLEASANT IS THIS WORD?</div>' +
          '<div id="repetition-study-word" style="font-size:3rem;font-weight:700;margin:34px 0;letter-spacing:3px;"></div>' +
          '<div id="repetition-scale" style="display:flex;gap:10px;justify-content:center;"></div>' +
        '</div>' +

        '<div id="repetition-bridge" style="display:none;">' +
          '<h3 style="color:#e38b82;">Part 2</h3>' +
          '<p style="color:#9aa6b2;line-height:1.7;max-width:520px;margin:14px auto;">Some letters are missing from each word below.<br>' +
            'Type the first complete word that comes to mind. If nothing comes, leave it blank and continue.</p>' +
          '<button class="btn" onclick="RepetitionPriming.beginTest()">Continue</button>' +
        '</div>' +

        '<div id="repetition-test" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="repetition-test-progress"></div>' +
          PTK.progressHtml('repetition-test-fill') +
          '<div id="repetition-fragment" style="font-size:2.6rem;font-weight:700;margin:30px 0;letter-spacing:6px;color:#e38b82;"></div>' +
          '<input id="repetition-answer" type="text" autocomplete="off" spellcheck="false" ' +
                 'style="font-size:1.5rem;padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.3);' +
                 'background:rgba(255,255,255,.08);color:#fff;text-align:center;letter-spacing:3px;text-transform:uppercase;width:280px;">' +
          '<div style="margin-top:18px;">' +
            '<button class="btn" onclick="RepetitionPriming.submitAnswer()">Next</button> ' +
            '<button class="btn btn-secondary" onclick="RepetitionPriming.skipAnswer()">I do not know</button>' +
          '</div>' +
        '</div>' +

        '<div id="repetition-results" style="display:none;">' +
          '<h2 style="color:#e38b82;">Complete</h2>' +
          '<div id="repetition-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<div id="repetition-verdict"></div>' +
          '<div id="repetition-interpretation"></div>' +
          '<div style="margin-top:20px;">' +
            '<button class="btn" onclick="RepetitionPriming.exportCSV()">Download CSV</button> ' +
            '<button class="btn" onclick="RepetitionPriming.exportXLSX()">Download Excel</button> ' +
            '<button class="btn" onclick="RepetitionPriming.restart()">Try Again</button> ' +
            '<button class="btn btn-secondary" onclick="RepetitionPriming.close()">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('repetition-overlay').style.display = 'block';
    // paintSetup first: it creates the #repetition-params element filled below.
    PTK.paintSetup('repetition-setup', this, this.spec());
    ['setup', 'study', 'bridge', 'test', 'results'].forEach(function (s) {
      var n = document.getElementById('repetition-' + s);
      if (n) n.style.display = (s === 'setup') ? 'block' : 'none';
    });
    var params = document.getElementById('repetition-params');
    if (params) {
      var n = this.data.items.length;
      params.textContent = Math.floor(n / 2) + ' words studied, then ' + n +
        ' fragments tested. Study words move on after ' + this.timing.study_ms + ' ms if not rated.';
    }
    this.state.phase = 'setup';
  },

  close: function () {
    this._clearTimers();
    var ov = document.getElementById('repetition-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  /** Half the items are studied; every item is tested. Which half is random per run. */
  buildLists: function () {
    var shuffled = PTA.shuffleArray(this.data.items.slice());
    var half = Math.floor(shuffled.length / 2);
    var studied = shuffled.slice(0, half);
    var unstudied = shuffled.slice(half);
    this.state.studyList = PTA.shuffleArray(studied.slice());
    this.state.testList = PTA.shuffleArray(
      studied.map(function (it) { return { word: it.word, fragment: it.fragment, studied: true }; })
        .concat(unstudied.map(function (it) { return { word: it.word, fragment: it.fragment, studied: false }; }))
    );
  },

  start: function () {
    this.buildLists();
    this.state.currentIndex = 0;
    this.state.results = [];
    this.state.studyRatings = [];
    this.state.phase = 'study';
    document.getElementById('repetition-setup').style.display = 'none';
    document.getElementById('repetition-study').style.display = 'block';
    this.renderStudy();
  },

  renderStudy: function () {
    this._clearTimers();
    var self = this;
    var it = this.state.studyList[this.state.currentIndex];
    if (!it) { this.endStudy(); return; }

    document.getElementById('repetition-study-progress').textContent =
      'Word ' + (this.state.currentIndex + 1) + ' of ' + this.state.studyList.length;
    PTK.setProgress('repetition-study-fill', this.state.currentIndex, this.state.studyList.length);
    document.getElementById('repetition-study-word').textContent = it.word;

    var scale = document.getElementById('repetition-scale');
    scale.innerHTML = '';
    for (var v = 1; v <= 5; v++) {
      (function (value) {
        var b = document.createElement('button');
        b.className = 'btn btn-secondary';
        b.textContent = String(value);
        b.style.cssText = 'min-width:56px;font-size:1.1rem;';
        b.onclick = function () { self.rate(it, value); };
        scale.appendChild(b);
      })(v);
    }
    this.state.onset = performance.now();

    // timing.study_ms is now actually used - see the file header.
    var myIndex = this.state.currentIndex;
    this._after(function () {
      if (self.state.phase === 'study' && self.state.currentIndex === myIndex) {
        self.rate(it, null);
      }
    }, this.timing.study_ms);
  },

  rate: function (it, value) {
    this._clearTimers();
    var self = this;
    this.state.studyRatings.push({
      word: it.word,
      rating: value,
      timedOut: value === null,
      rt: performance.now() - this.state.onset
    });
    this.state.currentIndex++;
    this._after(function () { self.renderStudy(); }, this.timing.iti_ms);
  },

  endStudy: function () {
    this._clearTimers();
    this.state.phase = 'bridge';
    document.getElementById('repetition-study').style.display = 'none';
    document.getElementById('repetition-bridge').style.display = 'block';
  },

  beginTest: function () {
    this.state.phase = 'test';
    this.state.currentIndex = 0;
    document.getElementById('repetition-bridge').style.display = 'none';
    document.getElementById('repetition-test').style.display = 'block';
    this.renderTest();
  },

  renderTest: function () {
    this._clearTimers();
    var self = this;
    this._locked = false;
    var it = this.state.testList[this.state.currentIndex];
    if (!it) { this.showResults(); return; }
    document.getElementById('repetition-test-progress').textContent =
      'Fragment ' + (this.state.currentIndex + 1) + ' of ' + this.state.testList.length;
    PTK.setProgress('repetition-test-fill', this.state.currentIndex, this.state.testList.length);
    document.getElementById('repetition-fragment').textContent = it.fragment;
    var input = document.getElementById('repetition-answer');
    input.value = '';
    input.focus();
    input.onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); self.submitAnswer(); }
    };
    this.state.onset = performance.now();
  },

  submitAnswer: function () {
    var input = document.getElementById('repetition-answer');
    this.record((input.value || '').trim().toUpperCase());
  },

  skipAnswer: function () { this.record(''); },

  record: function (answer) {
    // Enter and the Next button both land here; without the lock a fast double
    // press records the same fragment twice.
    if (this._locked) return;
    var self = this;
    var it = this.state.testList[this.state.currentIndex];
    if (!it) return;
    this._locked = true;
    var rt = performance.now() - this.state.onset;
    var completed = answer === it.word;
    var r = {
      trial: this.state.currentIndex + 1,
      word: it.word,
      fragment: it.fragment.replace(/ /g, ''),
      studied: it.studied,
      answer: answer,
      completed: completed,
      rt: rt
    };
    this.state.results.push(r);
    this.saveTrial(r);
    this.state.currentIndex++;
    this._after(function () { self.renderTest(); }, this.timing.iti_ms);
  },

  saveTrial: function (r) {
    PTK.save(PTK.row(this, this.spec(), {
      trial_number: r.trial,
      prime_type: r.studied ? 'studied' : 'unstudied',
      target: r.word,
      ink_color: r.studied ? 'studied' : 'unstudied',  // repurposed
      word_meaning: r.fragment,                        // repurposed: the fragment shown
      congruent: r.studied,
      response: r.answer || null,
      correct: r.completed,
      rt: Math.round(r.rt * 100) / 100
    }));
  },

  analyse: function () {
    var st = this.state.results.filter(function (r) { return r.studied; });
    var un = this.state.results.filter(function (r) { return !r.studied; });
    var rate = function (a) {
      return a.length ? Math.round(100 * a.filter(function (r) { return r.completed; }).length / a.length) : null;
    };
    var rS = rate(st), rU = rate(un);
    return {
      n: this.state.results.length,
      studied: st.length,
      studiedRate: rS,
      unstudiedRate: rU,
      effect: (rS !== null && rU !== null) ? (rS - rU) : null,
      meanRT: this.state.results.length
        ? Math.round(PTA.mean(this.state.results.map(function (r) { return r.rt; }))) : null
    };
  },

  showResults: function () {
    this._clearTimers();
    this.state.phase = 'results';
    document.getElementById('repetition-test').style.display = 'none';
    document.getElementById('repetition-results').style.display = 'block';
    PTK.setProgress('repetition-test-fill', 1, 1);

    var a = this.analyse();
    var pct = function (v) { return v === null ? '-' : v + '%'; };

    document.getElementById('repetition-results-body').innerHTML =
      '<p>Fragments attempted: ' + a.n + ' &nbsp;|&nbsp; words studied earlier: ' + a.studied + '</p>' +
      '<p>Completed - studied words: ' + pct(a.studiedRate) + '</p>' +
      '<p>Completed - never seen: ' + pct(a.unstudiedRate) + '</p>' +
      '<p style="color:#e38b82;font-weight:700;font-size:1.05rem;">Completion advantage (D &minus; C): ' +
        (a.effect !== null ? a.effect + ' percentage points' : '-') + '</p>' +
      '<p style="color:#9aa6b2;">Mean time per fragment: ' + (a.meanRT !== null ? a.meanRT + ' ms' : '-') + '</p>';

    // The verdict this paradigm exists to demonstrate.
    document.getElementById('repetition-verdict').innerHTML =
      '<div style="border-left:3px solid #e38b82;background:rgba(153,15,35,.14);border-radius:0 12px 12px 0;' +
             'padding:18px 22px;margin:22px auto 0;max-width:600px;text-align:left;">' +
        '<div style="color:#ff8fa3;font-weight:700;margin-bottom:10px;">Design check: this is NOT priming</div>' +
        '<div style="color:#d6c2c6;font-size:.92rem;line-height:1.8;">' +
          '<div><b style="color:#4ade80;">Association &mdash; met.</b> Prime and target are the same word, so the link is maximal.</div>' +
          '<div><b style="color:#4ade80;">Modulation &mdash; met.</b> The completion rate really does move.</div>' +
          '<div><b style="color:#f87171;">Secondariness &mdash; not met.</b> You responded to the word during the rating phase, ' +
            'so it had already been processed as primary for its own response. That is a pre-activation of direct rather than ' +
            'indirect processing.</div>' +
          '<div style="margin-top:10px;color:#b6c0cc;">Two of three characteristics hold, so under the framework this effect ' +
            'is real but is not an instance of priming. It is the boundary case the definition is designed to exclude.</div>' +
        '</div>' +
      '</div>';

    document.getElementById('repetition-interpretation').innerHTML = PTK.interpret({
      effect: a.effect,
      unit: 'percentage points',
      effectName: 'completion advantage',
      expectedSign: 1,
      n: a.n,
      small: 10,
      note: 'Read this as a memory effect rather than a priming effect - see the design check above.'
    });
  },

  restart: function () { this.open(); this.start(); },

  csvParts: function () {
    return {
      headers: ['trial', 'fragment', 'solution', 'studied_earlier', 'answer', 'completed', 'time_ms'],
      rows: this.state.results.map(function (r) {
        return [r.trial, r.fragment, r.word, r.studied, r.answer, r.completed, Math.round(r.rt)];
      })
    };
  },

  exportCSV: function () { var p = this.csvParts(); PTK.exportCSV(p.headers, p.rows, 'repetition_priming'); },
  exportXLSX: function () { var p = this.csvParts(); PTK.exportXLSX(p.headers, p.rows, 'repetition_priming'); },

  showThankYou: function () {
    window.history.replaceState({}, document.title, window.location.pathname);
    this.isParticipantMode = false;
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:3000;display:flex;justify-content:center;align-items:center;';
    m.innerHTML = '<div style="background:rgba(17,24,39,.97);border:1px solid rgba(74,222,128,.5);border-radius:20px;padding:44px;max-width:460px;text-align:center;color:#e5e7eb;">' +
      '<h2 style="color:#4ade80;">Thank You!</h2><p style="color:#c0c0c0;">Your responses were recorded. You may close this window.</p>' +
      '<button class="btn" onclick="this.closest(\'div\').parentElement.remove()">Close</button></div>';
    document.body.appendChild(m);
  },

  toConfig: function () {
    return {
      template: 'repetition-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      timing: this.timing,
      stimuli: { items: this.data.items }
    };
  },

  openBuilder: function () {
    this.ensureOverlay();
    this.init();
    PTK.openBuilder(this, this.spec());
  },

  closeBuilder: function () { PTK.closeBuilder(this.spec(), this); },   // `this` so afterApply runs: closing must leave the module runnable

  checkUrlConfig: function () {
    this.ensureOverlay();
    this.init();
    return PTK.checkUrlConfig(this, this.spec());
  }
};

document.addEventListener('DOMContentLoaded', function () { RepetitionPriming.init(); });
console.log('Repetition Priming module loaded');
