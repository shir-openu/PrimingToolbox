/**
 * =====================================================
 * PrimingToolbox - Negative Priming (V2 _fab)
 * =====================================================
 *
 * Tipper (1985). Each display holds two overlapping letters: a GREEN target to
 * be named and a RED distractor to be ignored. Displays come in prime/probe
 * pairs. On "ignored repetition" probes the letter that was the distractor in
 * the prime becomes the target - and responses are reliably SLOWER than on
 * control probes, because the ignored item was actively suppressed.
 *
 * ABCD: A = the suppressed distractor, B = the selective-attention task,
 * C = control-probe latency, D = ignored-repetition latency. The effect is
 * D - C, and unlike most priming it is expected to be POSITIVE: interference,
 * not facilitation. The results screen and the generated interpretation both
 * treat a positive number as the predicted direction.
 *
 * Previous version (never published to GitHub; local branch v2-four-paradigms):
 *     git show d313317:js/negative_fab.js
 *
 * @module NegativePriming
 * @version 2.0
 * @requires PTA (js/core_fab.js), PTK (js/paradigm_kit_fab.js)
 */
window.NegativePriming = {

  data: {
    // Visually distinct letters, all easy to type. At least four are needed:
    // a control probe must share no letter with its prime, which costs two.
    letters: ['B', 'C', 'F', 'H']
  },

  state: {
    pairs: [], currentPair: 0, phase: 'setup',
    stage: 'prime',          // 'prime' | 'probe'
    onset: 0, results: [], awaiting: false, openedFromBuilder: false, isPractice: false
  },

  timing: {
    fixation_ms: 500,
    display_ms: 2000,        // display stays until response, capped here
    iti_ms: 700
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  repetitions: 4,            // pairs per condition
  practiceTrials: 2,         // practice PAIRS
  _initDone: false,
  _participantId: '',
  _keyHandler: null,

  spec: function () {
    return {
      key: 'negative',
      name: 'Negative Priming',
      source: 'Tipper (1985)',
      urlParam: 'negative',
      template: 'negative-priming',
      accent: '#61a3ed',
      articleAnchor: '#s2',
      defaultExperimentId: 'negative_priming',
      startFn: 'NegativePriming.start()',
      closeFn: 'NegativePriming.close()',
      howToPlay: [
        'Two letters appear <b>on top of each other</b>: one <b style="color:#4ade80;">green</b>, one <b style="color:#f87171;">red</b>.',
        'Press the key of the <b style="color:#4ade80;">GREEN</b> letter as fast as you can. <b>Ignore the red one completely</b> &ndash; it is there to get in your way.',
        'Displays come in <b>pairs</b>. Sometimes the letter you just ignored becomes the green one you have to name. That is the point of the experiment.',
        'A few practice pairs run first and are not recorded.'
      ],
      keyLegend: 'Expect to feel slower on some displays than others. That slowing is the result being measured &ndash; it is not you doing badly.',
      example: '<div style="display:flex;gap:34px;flex-wrap:wrap;justify-content:center;align-items:center;text-align:center;">' +
        '<div>' +
          '<div style="position:relative;width:110px;height:110px;margin:0 auto;">' +
            '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
                 'font-size:4.2rem;font-weight:700;color:#f87171;opacity:.85;">C</div>' +
            '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
                 'font-size:4.2rem;font-weight:700;color:#4ade80;">B</div>' +
          '</div>' +
          '<div style="color:#4ade80;font-size:.92rem;margin-top:8px;">press <b>B</b></div>' +
          '<div style="color:#9aa6b2;font-size:.8rem;">green = B, ignore the red C</div>' +
        '</div>' +
        '<div style="color:#64748b;font-size:1.6rem;">&rarr;</div>' +
        '<div>' +
          '<div style="position:relative;width:110px;height:110px;margin:0 auto;">' +
            '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
                 'font-size:4.2rem;font-weight:700;color:#f87171;opacity:.85;">F</div>' +
            '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
                 'font-size:4.2rem;font-weight:700;color:#4ade80;">C</div>' +
          '</div>' +
          '<div style="color:#4ade80;font-size:.92rem;margin-top:8px;">press <b>C</b></div>' +
          '<div style="color:#fbbf24;font-size:.8rem;">the C you just ignored &ndash; this one feels harder</div>' +
        '</div>' +
      '</div>',
      abcd: {
        A: 'The red distractor that had to be ignored on the prime display.',
        B: 'Naming the green letter on the probe display.',
        C: 'Probe latency when the probe shares no letter with the prime (control).',
        D: 'Probe latency when the ignored letter is now the one to name.'
      },
      characteristics: {
        association: 'On ignored-repetition probes the target is identical to the item just suppressed; on control probes there is no relation.',
        secondariness: 'The red letter is explicitly to be ignored and is never required for the response.',
        modulation: 'Having suppressed the letter makes naming it slower a moment later - the effect is a cost, not a benefit.'
      },
      instructions: 'Name the green letter as fast as you can and ignore the red one.',
      stimulusGroups: [
        { key: 'letters', label: 'Letters', type: 'words', min: 4,
          help: 'At least four are required: a control probe must share no letter with its prime, which uses up two of them. Single characters work best - they are also the response keys.' }
      ],
      timingFields: [
        { key: 'fixation_ms', label: 'Fixation', min: 0, max: 3000, step: 50 },
        { key: 'display_ms', label: 'Response window', min: 500, max: 10000, step: 100 },
        { key: 'iti_ms', label: 'Gap between displays', min: 100, max: 5000, step: 50 }
      ],
      practice: { def: 2 },
      repetitions: { prop: 'repetitions', def: 4, min: 1, max: 10,
                     label: 'Pairs per condition',
                     help: 'Each unit builds one ignored-repetition pair and one control pair per letter, so the two conditions stay balanced.' },
      toConfig: function (mod) { return mod.toConfig(); },
      asm: function (mod) {
        return {
          instructions: 'Name the GREEN letter and ignore the red one.',
          primes: mod.data.letters.slice(),
          targets: mod.data.letters.slice(),
          conditions: ['ignored-repetition', 'control'],
          baseline: 'control',
          response: mod.data.letters.reduce(function (acc, l) { acc['letter ' + l] = l; return acc; }, {})
        };
      }
    };
  },

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    PTK.timers(this);
    console.log('Negative Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('negative-overlay')) return;
    var el = document.createElement('div');
    el.id = 'negative-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="negative-setup"></div>' +
        '<div id="negative-trial" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="negative-progress">Pair 1</div>' +
          PTK.progressHtml('negative-progress-fill') +
          '<div id="negative-stage" style="color:#64748b;font-size:.8rem;letter-spacing:2px;margin-top:6px;"></div>' +
          '<div id="negative-display" style="position:relative;height:190px;display:flex;align-items:center;justify-content:center;margin:22px 0;"></div>' +
          '<div id="negative-keyhint" style="color:#64748b;font-size:.85rem;"></div>' +
        '</div>' +
        '<div id="negative-results" style="display:none;">' +
          '<h2 style="color:#61a3ed;">Complete</h2>' +
          '<div id="negative-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<div id="negative-interpretation"></div>' +
          '<div style="margin-top:20px;">' +
            '<button class="btn" onclick="NegativePriming.exportCSV()">Download CSV</button> ' +
            '<button class="btn" onclick="NegativePriming.exportXLSX()">Download Excel</button> ' +
            '<button class="btn" onclick="NegativePriming.restart()">Try Again</button> ' +
            '<button class="btn btn-secondary" onclick="NegativePriming.close()">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  /** Requirement 4: the legend follows the live letter set. */
  paintLegend: function () {
    var keys = this.data.letters.join('   ');
    var legend = document.getElementById('negative-keylegend');
    if (legend) legend.innerHTML = 'Keys in use: <b>' + PTK.esc(keys) + '</b>';
    var hint = document.getElementById('negative-keyhint');
    if (hint) hint.textContent = 'Press ' + this.data.letters.join(', ');
    var params = document.getElementById('negative-params');
    if (params) {
      var pairs = this.data.letters.length * this.repetitions * 2;
      params.textContent =
        'About ' + pairs + ' scored pairs (' + (pairs * 2) + ' displays)' +
        (this.practiceTrials ? ', after ' + this.practiceTrials + ' practice pairs' : '') +
        '. Fixation ' + this.timing.fixation_ms + ' ms, response window ' +
        this.timing.display_ms + ' ms.';
    }
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('negative-overlay').style.display = 'block';
    // paintSetup first: it creates the #negative-params element paintLegend fills.
    PTK.paintSetup('negative-setup', this, this.spec());
    document.getElementById('negative-setup').style.display = 'block';
    document.getElementById('negative-trial').style.display = 'none';
    document.getElementById('negative-results').style.display = 'none';
    this.paintLegend();
    this.state.phase = 'setup';
  },

  close: function () {
    this.detachKeys();
    this._clearTimers();
    this.state.awaiting = false;
    var ov = document.getElementById('negative-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  /**
   * A pair is prime(target,distractor) + probe(target,distractor).
   *   ignored-repetition : probe target === prime distractor
   *   control            : no letter is shared between prime and probe
   *
   * Control pairs need two letters that appear in neither role of the prime, so
   * fewer than four letters yields ignored-repetition pairs only and no
   * baseline at all. The builder enforces a minimum of four; this guards the
   * case of a hand-edited participant link.
   */
  buildPairs: function (isPractice, howMany) {
    var L = this.data.letters;
    var pairs = [];
    var passes = isPractice ? 1 : this.repetitions;

    for (var r = 0; r < passes; r++) {
      L.forEach(function (primeTarget) {
        var rest = L.filter(function (x) { return x !== primeTarget; });
        if (!rest.length) return;
        var primeDist = rest[Math.floor(Math.random() * rest.length)];

        // ignored repetition: the ignored letter is now the one to name
        var irRest = L.filter(function (x) { return x !== primeDist; });
        if (irRest.length) {
          pairs.push({
            condition: 'ignored-repetition',
            prime: { target: primeTarget, distractor: primeDist },
            probe: { target: primeDist, distractor: irRest[Math.floor(Math.random() * irRest.length)] }
          });
        }

        // control: probe shares nothing with the prime
        var free = L.filter(function (x) { return x !== primeTarget && x !== primeDist; });
        if (free.length >= 2) {
          var shuffled = PTA.shuffleArray(free.slice());
          pairs.push({
            condition: 'control',
            prime: { target: primeTarget, distractor: primeDist },
            probe: { target: shuffled[0], distractor: shuffled[1] }
          });
        }
      });
    }
    pairs = PTA.shuffleArray(pairs);
    return (isPractice && howMany) ? pairs.slice(0, howMany) : pairs;
  },

  start: function () {
    this.state.results = [];
    this.state.currentPair = 0;
    this.state.stage = 'prime';
    document.getElementById('negative-setup').style.display = 'none';
    document.getElementById('negative-results').style.display = 'none';
    document.getElementById('negative-trial').style.display = 'block';
    this.paintLegend();
    this.attachKeys();

    if (this.practiceTrials > 0) {
      this.state.isPractice = true;
      this.state.pairs = this.buildPairs(true, this.practiceTrials);
    } else {
      this.state.isPractice = false;
      this.state.pairs = this.buildPairs(false);
    }
    this.runStage();
  },

  beginScored: function () {
    this.state.isPractice = false;
    this.state.pairs = this.buildPairs(false);
    this.state.currentPair = 0;
    this.state.stage = 'prime';
    this.runStage();
  },

  attachKeys: function () {
    if (this._keyHandler) return;
    var self = this;
    this._keyHandler = function (e) { self.onKey(e); };
    document.addEventListener('keydown', this._keyHandler);
  },

  detachKeys: function () {
    if (!this._keyHandler) return;
    document.removeEventListener('keydown', this._keyHandler);
    this._keyHandler = null;
  },

  runStage: function () {
    this._clearTimers();
    var self = this;
    var box = document.getElementById('negative-display');
    var pair = this.state.pairs[this.state.currentPair];

    if (!pair) {
      if (this.state.isPractice) {
        this.state.awaiting = false;
        document.getElementById('negative-stage').textContent = '';
        box.innerHTML = '<div style="color:#9aa6b2;font-size:1.05rem;line-height:1.7;">' +
          'Practice finished.<br>Press any of the response keys to begin the real displays.</div>';
        var go = function (e) {
          if (self.data.letters.indexOf((e.key || '').toUpperCase()) === -1) return;
          document.removeEventListener('keydown', go);
          self.beginScored();
        };
        document.addEventListener('keydown', go);
        return;
      }
      this.showResults();
      return;
    }

    var disp = pair[this.state.stage];
    var myPair = this.state.currentPair;
    var myStage = this.state.stage;

    var label = this.state.isPractice ? 'Practice ' : '';
    document.getElementById('negative-progress').textContent =
      label + 'pair ' + (this.state.currentPair + 1) + ' of ' + this.state.pairs.length;
    PTK.setProgress('negative-progress-fill', this.state.currentPair, this.state.pairs.length);
    document.getElementById('negative-stage').textContent =
      this.state.stage === 'prime' ? 'PRIME' : 'PROBE';

    box.innerHTML = '<div style="font-size:2.4rem;color:#64748b;">+</div>';
    this.state.awaiting = false;

    this._after(function () {
      // the two letters are overlaid, which is what forces selection by colour
      box.innerHTML =
        '<div style="position:relative;width:150px;height:150px;">' +
          '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
               'font-size:6rem;font-weight:700;color:#f87171;opacity:.85;">' + PTK.esc(disp.distractor) + '</div>' +
          '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
               'font-size:6rem;font-weight:700;color:#4ade80;">' + PTK.esc(disp.target) + '</div>' +
        '</div>';
      self.state.onset = performance.now();
      self.state.awaiting = true;

      // response window, scoped to this display only
      self._after(function () {
        if (self.state.awaiting &&
            self.state.currentPair === myPair && self.state.stage === myStage) {
          self.state.awaiting = false;
          self.commit(disp, null, null, true);
        }
      }, self.timing.display_ms);
    }, this.timing.fixation_ms);
  },

  onKey: function (e) {
    if (!this.state.awaiting) return;
    var key = (e.key || '').toUpperCase();
    if (this.data.letters.indexOf(key) === -1) return;
    e.preventDefault();
    this.state.awaiting = false;
    var pair = this.state.pairs[this.state.currentPair];
    if (!pair) return;
    this.commit(pair[this.state.stage], key, performance.now() - this.state.onset, false);
  },

  /** Single place where a display is written down, whether the participant
   *  answered or the response window ran out. */
  commit: function (disp, key, rt, timedOut) {
    this._clearTimers();
    var self = this;
    var pair = this.state.pairs[this.state.currentPair];
    if (!pair) return;
    var isPractice = this.state.isPractice;
    var correct = !timedOut && key === disp.target;

    // Only PROBE latencies carry the effect; prime rows are kept for completeness.
    var row = {
      pair: this.state.currentPair + 1,
      isPractice: isPractice,
      stage: this.state.stage,
      condition: pair.condition,
      target: disp.target,
      distractor: disp.distractor,
      response: key || 'none',
      correct: correct,
      rt: rt,
      timedOut: !!timedOut
    };

    if (!isPractice) {
      this.state.results.push(row);
      this.saveTrial(row);
    }

    document.getElementById('negative-display').innerHTML =
      '<div style="font-size:2rem;color:' +
        (timedOut ? '#fbbf24' : (correct ? '#4ade80' : '#f87171')) + ';">' +
        (timedOut ? 'too slow' : (correct ? 'ok' : 'wrong key')) + '</div>';

    this._after(function () {
      if (self.state.stage === 'prime') {
        self.state.stage = 'probe';
      } else {
        self.state.stage = 'prime';
        self.state.currentPair++;
      }
      self.runStage();
    }, this.timing.iti_ms);
  },

  saveTrial: function (r) {
    PTK.save(PTK.row(this, this.spec(), {
      trial_number: this.state.results.length,
      ink_color: r.condition,        // repurposed: ignored-repetition / control
      word_meaning: r.stage,         // repurposed: prime / probe
      prime_type: r.condition,
      target: r.target,
      congruent: r.condition === 'ignored-repetition',
      response: r.response,
      correct: r.correct,
      rt: r.rt === null ? null : Math.round(r.rt * 100) / 100
    }));
  },

  analyse: function () {
    var probes = this.state.results.filter(function (r) {
      return r.stage === 'probe' && r.correct && !r.timedOut;
    });
    var ir = probes.filter(function (r) { return r.condition === 'ignored-repetition'; }).map(function (r) { return r.rt; });
    var ct = probes.filter(function (r) { return r.condition === 'control'; }).map(function (r) { return r.rt; });
    var mIR = ir.length ? Math.round(PTA.mean(ir)) : null;
    var mCT = ct.length ? Math.round(PTA.mean(ct)) : null;
    var total = this.state.results.length;
    return {
      n: total,
      usable: probes.length,
      ignoredRepetitionRT: mIR,
      controlRT: mCT,
      effect: (mIR !== null && mCT !== null) ? (mIR - mCT) : null,
      accuracy: total ? Math.round(100 * this.state.results.filter(function (r) { return r.correct; }).length / total) : 0,
      noControl: ct.length === 0
    };
  },

  showResults: function () {
    this.detachKeys();
    this._clearTimers();
    document.getElementById('negative-trial').style.display = 'none';
    document.getElementById('negative-results').style.display = 'block';
    PTK.setProgress('negative-progress-fill', 1, 1);

    var a = this.analyse();
    document.getElementById('negative-results-body').innerHTML =
      '<p>Displays completed: ' + a.n + ' &nbsp;|&nbsp; accuracy ' + a.accuracy + '%</p>' +
      '<p>Probe RT - ignored repetition: ' + (a.ignoredRepetitionRT !== null ? a.ignoredRepetitionRT + ' ms' : '-') + '</p>' +
      '<p>Probe RT - control: ' + (a.controlRT !== null ? a.controlRT + ' ms' : '-') + '</p>' +
      '<p style="color:#61a3ed;font-weight:700;font-size:1.05rem;">Negative priming effect (D &minus; C): ' +
        (a.effect !== null ? a.effect + ' ms' : '-') + '</p>';

    document.getElementById('negative-interpretation').innerHTML = PTK.interpret({
      effect: a.effect,
      unit: 'ms',
      effectName: 'negative priming effect',
      // Positive IS the prediction here: suppressing the letter makes naming it
      // slower. A positive number is the result, not a problem.
      expectedSign: 1,
      accuracy: a.accuracy,
      n: a.usable,
      small: 12,
      note: a.noControl
        ? 'No control probes were generated, so there is no baseline to compare against. That happens when fewer than four letters are configured.'
        : 'A POSITIVE number is the expected result here: having just suppressed a letter makes it harder to name a moment later. This is the one paradigm in the toolbox where the effect is a cost rather than a benefit.'
    });
  },

  restart: function () { this.open(); this.start(); },

  csvParts: function () {
    return {
      headers: ['pair', 'stage', 'condition', 'target', 'distractor', 'response',
                'correct', 'timed_out', 'rt_ms'],
      rows: this.state.results.map(function (r) {
        return [r.pair, r.stage, r.condition, r.target, r.distractor, r.response,
                r.correct, r.timedOut, r.rt === null ? '' : Math.round(r.rt)];
      })
    };
  },

  exportCSV: function () { var p = this.csvParts(); PTK.exportCSV(p.headers, p.rows, 'negative_priming'); },
  exportXLSX: function () { var p = this.csvParts(); PTK.exportXLSX(p.headers, p.rows, 'negative_priming'); },

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
      template: 'negative-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      repetitions: this.repetitions,
      practiceTrials: this.practiceTrials,
      timing: this.timing,
      stimuli: { letters: this.data.letters }
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

document.addEventListener('DOMContentLoaded', function () { NegativePriming.init(); });
console.log('Negative Priming module loaded');
