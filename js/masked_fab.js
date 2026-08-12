/**
 * =====================================================
 * PrimingToolbox - Masked Lexical Decision (V2 _fab)
 * =====================================================
 *
 * Forster & Davis (1984). Each trial runs
 *     forward mask (#######)  ->  prime (lowercase, ~50 ms)  ->  target (UPPERCASE)
 * and the participant decides whether the TARGET is a real word. At a 50 ms
 * prime preceded by a mask, participants typically cannot report the prime, yet
 * repetition primes still speed the decision.
 *
 * ABCD: A = the masked prime, B = the lexical decision, C = unrelated-prime
 * latency, D = repetition-prime latency. Effect = C - D; positive is facilitation.
 *
 * Non-word targets are present so the decision is genuine, but only WORD targets
 * enter the effect.
 *
 * ---------------------------------------------------------------------------
 * FIXED 2026-08-10 - ITEM WAS CONFOUNDED WITH CONDITION
 * ---------------------------------------------------------------------------
 * The previous buildTrials assigned the condition from the word's position in
 * the list: `words.forEach((w, i) => { if (i % 2 === 0) repetition else unrelated })`.
 * So TABLE was the repetition item for every participant who ever ran the task,
 * and HORSE was always unrelated. The repetition-vs-unrelated contrast was
 * therefore also a contrast between two fixed sets of words, and any difference
 * between them in frequency, length or orthographic neighbourhood went straight
 * into the "priming effect". With one participant there is no way to separate
 * the two afterwards.
 *
 * The assignment is now shuffled per run, and alternates across passes when
 * more than one pass is requested, so each word serves in both conditions.
 *
 * Previous version (never published to GitHub; local branch v2-four-paradigms):
 *     git show d313317:js/masked_fab.js
 *
 * @module MaskedLexical
 * @version 2.0
 * @requires PTA (js/core_fab.js), PTK (js/paradigm_kit_fab.js)
 */
window.MaskedLexical = {

  data: {
    words: ['TABLE', 'HORSE', 'RIVER', 'CHAIR', 'BREAD', 'CLOUD',
            'STONE', 'LIGHT', 'MUSIC', 'PLANT', 'HOUSE', 'DREAM'],
    // Pronounceable non-words: each is orthographically legal English and
    // length-matched to the word list above.
    nonwordList: ['MABLO', 'GORSA', 'NIVEL', 'PHAIL', 'SREAK', 'TROUF',
                  'DRONA', 'WIGHK', 'MUNIC', 'PLONT', 'HOUSK', 'DRAEM']
  },

  maskChar: '#',
  responseKeys: { word: 'J', nonword: 'F' },

  state: {
    trials: [], currentTrial: 0, phase: 'setup',
    onset: 0, results: [], awaiting: false, openedFromBuilder: false, isPractice: false
  },

  timing: {
    mask_ms: 500,
    prime_ms: 50,          // the parameter that matters - keep it short
    target_ms: 2000,
    iti_ms: 800
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  repetitions: 1,
  practiceTrials: 4,
  _initDone: false,
  _participantId: '',
  _keyHandler: null,

  spec: function () {
    var self = this;
    return {
      key: 'masked',
      name: 'Masked Lexical Decision',
      source: 'Forster & Davis (1984)',
      urlParam: 'masked',
      template: 'masked-lexical',
      accent: '#bb7be6',
      articleAnchor: '#s2',
      defaultExperimentId: 'masked_lexical_decision',
      startFn: 'MaskedLexical.start()',
      closeFn: 'MaskedLexical.close()',
      howToPlay: [
        'A row of <b>#</b> symbols flashes on the screen.',
        'Then a letter string appears in <b>CAPITALS</b>.',
        'Decide as fast as you can whether that CAPITAL string is a <b>real English word</b>, and press the matching key.',
        'A few practice trials run first and are not recorded.'
      ],
      keyLegend: 'Between the # symbols and the capitals there is a third word, shown for about 50 ms. You are not expected to see it &ndash; most people cannot, and that is exactly the point.',
      example: '<div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;align-items:center;text-align:center;">' +
        '<div><div style="font-size:1.8rem;font-weight:700;letter-spacing:4px;color:#64748b;">#####</div>' +
          '<div style="color:#9aa6b2;font-size:.78rem;margin-top:6px;">mask</div></div>' +
        '<div style="color:#64748b;">&rarr;</div>' +
        '<div><div style="font-size:1.8rem;font-weight:700;letter-spacing:4px;color:#cbd5e1;opacity:.5;">table</div>' +
          '<div style="color:#9aa6b2;font-size:.78rem;margin-top:6px;">~50 ms, unseen</div></div>' +
        '<div style="color:#64748b;">&rarr;</div>' +
        // The keys come from the live configuration, never a literal - an
        // experimenter can change them in the builder and this must follow.
        '<div><div style="font-size:1.8rem;font-weight:700;letter-spacing:4px;color:#ffffff;">' +
            (self.data.words[0] || 'TABLE') + '</div>' +
          '<div style="color:#4ade80;font-size:.85rem;margin-top:6px;">a real word &rarr; press ' +
            self.responseKeys.word + '</div></div>' +
        '<div style="width:100%;height:1px;"></div>' +
        '<div><div style="font-size:1.8rem;font-weight:700;letter-spacing:4px;color:#ffffff;">' +
            (self.data.nonwordList[0] || 'MABLO') + '</div>' +
          '<div style="color:#f87171;font-size:.85rem;margin-top:6px;">not a word &rarr; press ' +
            self.responseKeys.nonword + '</div></div>' +
      '</div>',
      abcd: {
        A: 'The masked prime, shown for ~50 ms between a forward mask and the target.',
        B: 'Deciding whether the CAPITAL string is a real English word.',
        C: 'Decision latency after an unrelated prime.',
        D: 'Decision latency after a repetition prime.'
      },
      characteristics: {
        association: 'A repetition prime is maximally associated with its target; an unrelated prime is not.',
        secondariness: 'The prime is never reported and is irrelevant to the word / non-word decision.',
        modulation: 'Repetition primes shorten the decision latency relative to unrelated primes.'
      },
      instructions: 'A row of # flashes, then a letter string in capitals. Decide whether it is a real English word.',
      stimulusGroups: [
        { key: 'words', label: 'Word targets', type: 'words', min: 4,
          help: 'Real English words, uppercase. Each one appears once per pass, half with a repetition prime and half with an unrelated prime - which half is decided at random on every run.' },
        { key: 'nonwordList', label: 'Non-word targets', type: 'words', min: 4,
          help: 'Pronounceable non-words, uppercase. They make the decision genuine and are excluded from the effect.' }
      ],
      timingFields: [
        { key: 'mask_ms', label: 'Forward mask', min: 100, max: 2000, step: 50 },
        { key: 'prime_ms', label: 'Prime', min: 10, max: 500, step: 5,
          help: 'The parameter that matters. Above roughly 60 ms primes start to become reportable and the effect is no longer strictly masked.' },
        { key: 'target_ms', label: 'Response window', min: 500, max: 10000, step: 100 },
        { key: 'iti_ms', label: 'Gap between trials', min: 100, max: 5000, step: 100 }
      ],
      practice: { def: 4 },
      repetitions: { prop: 'repetitions', def: 1, min: 1, max: 5,
                     label: 'Passes through the item set',
                     help: 'Each pass shows every word and every non-word once. More passes give a steadier estimate but a longer session.' },
      toConfig: function (mod) { return mod.toConfig(); },
      applyConfig: function (mod, config) {
        if (config.responseKeys) mod.responseKeys = config.responseKeys;
        if (config.maskChar) mod.maskChar = config.maskChar;
      },
      asm: function (mod) {
        return {
          instructions: 'Decide whether the CAPITAL string is a real English word.',
          primes: mod.data.words.map(function (w) { return w.toLowerCase(); }),
          targets: mod.data.words.concat(mod.data.nonwordList),
          conditions: ['repetition', 'unrelated'],
          baseline: 'unrelated',
          response: { word: mod.responseKeys.word, 'non-word': mod.responseKeys.nonword }
        };
      }
    };
  },

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    PTK.timers(this);
    console.log('Masked Lexical Decision module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('masked-overlay')) return;
    var el = document.createElement('div');
    el.id = 'masked-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="masked-setup"></div>' +
        '<div id="masked-trial" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="masked-progress">Trial 1</div>' +
          PTK.progressHtml('masked-progress-fill') +
          '<div id="masked-display" style="height:190px;display:flex;align-items:center;justify-content:center;' +
               'font-size:3.4rem;font-weight:700;letter-spacing:4px;margin:22px 0;"></div>' +
          '<div id="masked-keyhint" style="color:#64748b;font-size:.85rem;"></div>' +
        '</div>' +
        '<div id="masked-results" style="display:none;">' +
          '<h2 style="color:#bb7be6;">Complete</h2>' +
          '<div id="masked-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<div id="masked-interpretation"></div>' +
          '<div style="margin-top:20px;">' +
            '<button class="btn" onclick="MaskedLexical.exportCSV()">Download CSV</button> ' +
            '<button class="btn" onclick="MaskedLexical.exportXLSX()">Download Excel</button> ' +
            '<button class="btn" onclick="MaskedLexical.restart()">Try Again</button> ' +
            '<button class="btn btn-secondary" onclick="MaskedLexical.close()">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  /** Requirement 4: the legend follows the live configuration, never hardcoded text. */
  paintLegend: function () {
    var k = this.responseKeys;
    var legend = document.getElementById('masked-keylegend');
    if (legend) {
      legend.innerHTML = '<b>' + PTK.esc(k.word) + '</b> = real word &nbsp;&nbsp;&nbsp; <b>' +
                         PTK.esc(k.nonword) + '</b> = not a word';
    }
    var hint = document.getElementById('masked-keyhint');
    if (hint) {
      hint.textContent = k.word + ' = word   |   ' + k.nonword + ' = non-word';
    }
    var params = document.getElementById('masked-params');
    if (params) {
      var n = (this.data.words.length + this.data.nonwordList.length) * this.repetitions;
      params.textContent =
        n + ' scored trials' + (this.practiceTrials ? ', after ' + this.practiceTrials + ' practice trials' : '') +
        '. Mask ' + this.timing.mask_ms + ' ms, prime ' + this.timing.prime_ms +
        ' ms, response window ' + this.timing.target_ms + ' ms.' +
        (this.timing.prime_ms > 60 ? ' Note: above about 60 ms the prime becomes reportable and the effect is no longer strictly masked.' : '');
    }
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('masked-overlay').style.display = 'block';
    // paintSetup first: it creates the #masked-params element paintLegend fills.
    PTK.paintSetup('masked-setup', this, this.spec());
    document.getElementById('masked-setup').style.display = 'block';
    document.getElementById('masked-trial').style.display = 'none';
    document.getElementById('masked-results').style.display = 'none';
    this.paintLegend();
    this.state.phase = 'setup';
  },

  close: function () {
    this.detachKeys();
    this._clearTimers();
    this.state.awaiting = false;
    var ov = document.getElementById('masked-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  /**
   * Condition assignment is shuffled per run - see the header. Each pass takes
   * a fresh shuffle and flips which half gets the repetition prime, so across
   * passes every word serves in both conditions.
   */
  buildTrials: function (isPractice, howMany) {
    var trials = [];
    var words = this.data.words;
    var nonwords = this.data.nonwordList;
    var passes = isPractice ? 1 : this.repetitions;

    for (var r = 0; r < passes; r++) {
      var order = PTA.shuffleArray(words.slice());
      var half = Math.floor(order.length / 2);
      order.forEach(function (w, i) {
        var isRepetition = (r % 2 === 0) ? (i < half) : (i >= half);
        if (isRepetition) {
          trials.push({ prime: w.toLowerCase(), target: w, lexical: 'word', condition: 'repetition' });
        } else {
          var others = words.filter(function (x) { return x !== w; });
          var p = others[Math.floor(Math.random() * others.length)];
          trials.push({ prime: p.toLowerCase(), target: w, lexical: 'word', condition: 'unrelated' });
        }
      });
      nonwords.forEach(function (nw) {
        var p = words[Math.floor(Math.random() * words.length)];
        trials.push({ prime: p.toLowerCase(), target: nw, lexical: 'nonword', condition: 'filler' });
      });
    }
    trials = PTA.shuffleArray(trials);
    return (isPractice && howMany) ? trials.slice(0, howMany) : trials;
  },

  start: function () {
    this.state.results = [];
    this.state.currentTrial = 0;
    document.getElementById('masked-setup').style.display = 'none';
    document.getElementById('masked-results').style.display = 'none';
    document.getElementById('masked-trial').style.display = 'block';
    this.paintLegend();
    this.attachKeys();

    if (this.practiceTrials > 0) {
      this.state.isPractice = true;
      this.state.trials = this.buildTrials(true, this.practiceTrials);
    } else {
      this.state.isPractice = false;
      this.state.trials = this.buildTrials(false);
    }
    this.runTrial();
  },

  beginScored: function () {
    this.state.isPractice = false;
    this.state.trials = this.buildTrials(false);
    this.state.currentTrial = 0;
    this.runTrial();
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

  runTrial: function () {
    this._clearTimers();
    var self = this;
    var index = this.state.currentTrial;
    var t = this.state.trials[index];
    var box = document.getElementById('masked-display');

    if (!t) {
      if (this.state.isPractice) {
        this.state.awaiting = false;
        box.style.fontSize = '1.05rem';
        box.style.letterSpacing = 'normal';
        box.style.color = '#9aa6b2';
        box.innerHTML = 'Practice finished.<br>Press <b>' + PTK.esc(this.responseKeys.word) +
                        '</b> to begin the real trials.';
        var go = function (e) {
          if ((e.key || '').toUpperCase() !== self.responseKeys.word.toUpperCase()) return;
          document.removeEventListener('keydown', go);
          box.style.fontSize = '3.4rem';
          box.style.letterSpacing = '4px';
          self.beginScored();
        };
        document.addEventListener('keydown', go);
        return;
      }
      this.showResults();
      return;
    }

    var label = this.state.isPractice ? 'Practice ' : '';
    document.getElementById('masked-progress').textContent =
      label + 'trial ' + (index + 1) + ' of ' + this.state.trials.length;
    PTK.setProgress('masked-progress-fill', index, this.state.trials.length);
    this.state.awaiting = false;

    // 1. forward mask
    box.style.color = '#64748b';
    box.textContent = this.maskChar.repeat(Math.max(t.target.length, 5));

    this._after(function () {
      // 2. masked prime
      box.style.color = '#cbd5e1';
      box.textContent = t.prime;

      self._after(function () {
        // 3. target
        box.style.color = '#ffffff';
        box.textContent = t.target;
        self.state.onset = performance.now();
        self.state.awaiting = true;

        // response window - belongs to THIS trial only
        self._after(function () {
          if (self.state.awaiting && self.state.currentTrial === index) {
            self.state.awaiting = false;
            self.record(t, index, null, null);
          }
        }, self.timing.target_ms);
      }, self.timing.prime_ms);
    }, this.timing.mask_ms);
  },

  onKey: function (e) {
    if (!this.state.awaiting) return;
    var key = (e.key || '').toUpperCase();
    if (key !== this.responseKeys.word.toUpperCase() &&
        key !== this.responseKeys.nonword.toUpperCase()) return;
    e.preventDefault();
    this.state.awaiting = false;
    var index = this.state.currentTrial;
    var t = this.state.trials[index];
    if (!t) return;
    this.record(t, index, key, performance.now() - this.state.onset);
  },

  /** index is the trial this row belongs to, so a row can never be stamped with
   *  a different trial's number than the target it actually showed. */
  record: function (t, index, key, rt) {
    this._clearTimers();
    var isPractice = this.state.isPractice;
    var said = key === null ? 'none'
      : (key === this.responseKeys.word.toUpperCase() ? 'word' : 'nonword');
    var correct = said === t.lexical;
    var r = {
      trial: index + 1,
      isPractice: isPractice,
      prime: t.prime, target: t.target,
      lexical: t.lexical, condition: t.condition,
      response: said, correct: correct, rt: rt, timedOut: key === null
    };

    // Practice trials are shown, then discarded.
    if (!isPractice) {
      this.state.results.push(r);
      this.saveTrial(r);
    }

    var box = document.getElementById('masked-display');
    box.style.color = key === null ? '#fbbf24' : (correct ? '#4ade80' : '#f87171');
    box.textContent = key === null ? 'too slow' : (correct ? 'ok' : 'x');

    this.state.currentTrial++;
    var self = this;
    this._after(function () { self.runTrial(); }, this.timing.iti_ms);
  },

  saveTrial: function (r) {
    PTK.save(PTK.row(this, this.spec(), {
      trial_number: r.trial,
      prime_type: r.condition,      // repetition / unrelated / filler
      target: r.target,
      ink_color: r.condition,       // repurposed, kept for older dashboards
      word_meaning: r.prime,        // repurposed: the masked prime
      congruent: r.condition === 'repetition',
      response: r.response,
      correct: r.correct,
      rt: r.rt === null ? null : Math.round(r.rt * 100) / 100,
      soa: this.timing.prime_ms
    }));
  },

  analyse: function () {
    var good = this.state.results.filter(function (r) {
      return r.lexical === 'word' && r.correct && !r.timedOut;
    });
    var rep = good.filter(function (r) { return r.condition === 'repetition'; }).map(function (r) { return r.rt; });
    var unr = good.filter(function (r) { return r.condition === 'unrelated'; }).map(function (r) { return r.rt; });
    var mR = rep.length ? Math.round(PTA.mean(rep)) : null;
    var mU = unr.length ? Math.round(PTA.mean(unr)) : null;
    var total = this.state.results.length;
    return {
      n: total,
      usable: good.length,
      repetitionRT: mR,
      unrelatedRT: mU,
      effect: (mR !== null && mU !== null) ? (mU - mR) : null,
      accuracy: total ? Math.round(100 * this.state.results.filter(function (r) { return r.correct; }).length / total) : 0,
      timedOut: this.state.results.filter(function (r) { return r.timedOut; }).length
    };
  },

  showResults: function () {
    this.detachKeys();
    this._clearTimers();
    document.getElementById('masked-trial').style.display = 'none';
    document.getElementById('masked-results').style.display = 'block';
    PTK.setProgress('masked-progress-fill', 1, 1);

    var a = this.analyse();
    document.getElementById('masked-results-body').innerHTML =
      '<p>Trials: ' + a.n + ' &nbsp;|&nbsp; accuracy ' + a.accuracy + '%' +
        (a.timedOut ? ' &nbsp;|&nbsp; timed out: ' + a.timedOut : '') + '</p>' +
      '<p>Word RT - repetition prime: ' + (a.repetitionRT !== null ? a.repetitionRT + ' ms' : '-') + '</p>' +
      '<p>Word RT - unrelated prime: ' + (a.unrelatedRT !== null ? a.unrelatedRT + ' ms' : '-') + '</p>' +
      '<p style="color:#bb7be6;font-weight:700;font-size:1.05rem;">Masked priming effect (C &minus; D): ' +
        (a.effect !== null ? a.effect + ' ms' : '-') + '</p>';

    document.getElementById('masked-interpretation').innerHTML = PTK.interpret({
      effect: a.effect,
      unit: 'ms',
      effectName: 'masked priming effect',
      expectedSign: 1,
      accuracy: a.accuracy,
      n: a.usable,
      small: 12,
      note: 'The prime ran for ' + this.timing.prime_ms + ' ms.' +
            (this.timing.prime_ms > 60
              ? ' That is above the usual masked range, so the prime may have been visible and this is not strictly a masked effect.'
              : ' At this duration the prime is normally not reportable.')
    });
  },

  restart: function () { this.open(); this.start(); },

  csvParts: function () {
    var pm = this.timing.prime_ms;
    return {
      headers: ['trial', 'prime', 'target', 'lexical', 'condition', 'response',
                'correct', 'timed_out', 'rt_ms', 'prime_ms'],
      rows: this.state.results.map(function (r) {
        return [r.trial, r.prime, r.target, r.lexical, r.condition, r.response,
                r.correct, r.timedOut, r.rt === null ? '' : Math.round(r.rt), pm];
      })
    };
  },

  exportCSV: function () { var p = this.csvParts(); PTK.exportCSV(p.headers, p.rows, 'masked_lexical'); },
  exportXLSX: function () { var p = this.csvParts(); PTK.exportXLSX(p.headers, p.rows, 'masked_lexical'); },

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
      template: 'masked-lexical',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      repetitions: this.repetitions,
      practiceTrials: this.practiceTrials,
      responseKeys: this.responseKeys,
      maskChar: this.maskChar,
      timing: this.timing,
      stimuli: { words: this.data.words, nonwordList: this.data.nonwordList }
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

document.addEventListener('DOMContentLoaded', function () { MaskedLexical.init(); });
console.log('Masked Lexical Decision module loaded');
