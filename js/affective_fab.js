/**
 * =====================================================
 * PrimingToolbox - Affective Priming (V2 _fab)
 * =====================================================
 *
 * Fazio et al. (1986). Prime = an evaluatively charged word (positive/negative);
 * target = an adjective the participant classifies as positive or negative.
 * Priming (ABCD): A = prime valence, B = target adjective, C = baseline RT,
 * D = RT when prime and target valence match vs mismatch. Faster/ more accurate
 * on congruent trials = affective priming.
 *
 * Self-contained: injects its own overlay, so index_fab.html needs only a
 * dropdown entry, a showTryExperiment/showTemplateBuilder branch, and the
 * <script> include. Saves each trial through PTA.saveToSupabase using only the
 * existing experiment_results columns.
 *
 * @module Affective
 */
window.Affective = {

  data: {
    positivePrimes: ['LOVE', 'HAPPY', 'PEACE', 'JOY', 'SUNSHINE', 'FRIEND'],
    negativePrimes: ['HATE', 'DEATH', 'PAIN', 'FEAR', 'DISEASE', 'ENEMY'],
    positiveTargets: ['WONDERFUL', 'EXCELLENT', 'PLEASANT', 'BEAUTIFUL', 'DELIGHTFUL', 'LOVELY'],
    negativeTargets: ['HORRIBLE', 'AWFUL', 'DISGUSTING', 'TERRIBLE', 'UGLY', 'NASTY']
  },

  // SOA = fixation + primeDuration + isi. Fazio used a short SOA (~300 ms).
  timing: { fixation: 500, primeDuration: 200, isi: 100, responseTimeout: 2500, feedbackDuration: 300, iti: 1000 },

  responseKeys: { positive: 'p', negative: 'n' },

  state: {
    trials: [], currentTrial: 0, results: [],
    stimulusOnset: 0, awaitingResponse: false, openedFromBuilder: false, phase: 'setup'
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  trialsPerCondition: 5,
  showFeedback: true,
  _initDone: false,

  practiceTrials: 4,

  /* ---------- spec: drives the setup screen and the Template Builder ---------- */

  spec: function () {
    var self = this;
    return {
      key: 'affective',
      name: 'Affective Priming',
      source: 'Fazio, Sanbonmatsu, Powell & Kardes (1986)',
      urlParam: 'affective',
      template: 'affective-priming',
      accent: '#ea5cd5',
      articleAnchor: '#s32',
      defaultExperimentId: 'affective_priming',
      startFn: 'Affective.start()',
      closeFn: 'Affective.close()',
      abcd: {
        A: 'A briefly flashed word carrying positive or negative feeling.',
        B: 'Judging whether the adjective that follows is positive or negative.',
        C: 'Judgement latency when prime and target carry opposite feeling.',
        D: 'Judgement latency when they carry the same feeling.'
      },
      characteristics: {
        association: 'Prime and target share an evaluative dimension - both are positive, or both negative, or they clash.',
        secondariness: 'The first word is never judged and is irrelevant to the decision about the adjective.',
        modulation: 'Matching feeling speeds the judgement; clashing feeling slows it.'
      },
      instructions: 'A word flashes, then an adjective. Judge the adjective as positive or negative.',
      howToPlay: [
        'A <b>+</b> appears in the middle of the screen. Look at it.',
        'A word flashes very briefly. <b>Ignore it</b> &ndash; it is not part of your task.',
        'Then an <b>adjective</b> appears. Decide as fast as you can whether it is a <b>good</b> thing or a <b>bad</b> thing, and press the matching key.',
        'A few practice trials run first and are not recorded.'
      ],
      keyLegend: 'Keys: <b>' + String(self.responseKeys.positive).toUpperCase() + '</b> = positive &nbsp;&nbsp; <b>' +
                 String(self.responseKeys.negative).toUpperCase() + '</b> = negative',
      example: '<div style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;align-items:center;text-align:center;">' +
        '<div><div style="font-size:1.9rem;color:#ffffff;">+</div>' +
          '<div style="color:#9aa6b2;font-size:.78rem;margin-top:6px;">look here</div></div>' +
        '<div style="color:#64748b;">&rarr;</div>' +
        '<div><div style="font-size:1.6rem;font-weight:700;color:#a78bfa;">PUPPY</div>' +
          '<div style="color:#9aa6b2;font-size:.78rem;margin-top:6px;">flashes &ndash; ignore it</div></div>' +
        '<div style="color:#64748b;">&rarr;</div>' +
        '<div><div style="font-size:1.6rem;font-weight:700;color:#ffffff;">LOVELY</div>' +
          '<div style="color:#4ade80;font-size:.85rem;margin-top:6px;">good thing &rarr; press ' +
            String(self.responseKeys.positive).toUpperCase() + '</div></div>' +
      '</div>',
      stimulusGroups: [
        { key: 'positivePrimes', label: 'Positive primes', type: 'words', min: 2 },
        { key: 'negativePrimes', label: 'Negative primes', type: 'words', min: 2 },
        { key: 'positiveTargets', label: 'Positive target adjectives', type: 'words', min: 2,
          help: 'These are what the participant judges.' },
        { key: 'negativeTargets', label: 'Negative target adjectives', type: 'words', min: 2 }
      ],
      timingFields: [
        { key: 'fixation', label: 'Fixation', min: 0, max: 3000, step: 50 },
        { key: 'primeDuration', label: 'Prime', min: 10, max: 2000, step: 10,
          help: 'Fazio et al. used a short SOA; fixation + prime + ISI is the SOA.' },
        { key: 'isi', label: 'Blank after the prime', min: 0, max: 2000, step: 10 },
        { key: 'responseTimeout', label: 'Response window', min: 500, max: 10000, step: 100 },
        { key: 'iti', label: 'Gap between trials', min: 0, max: 5000, step: 50 }
      ],
      practice: { def: 4 },
      repetitions: { prop: 'trialsPerCondition', def: 5, min: 1, max: 20,
                     label: 'Trials per condition',
                     help: 'Four conditions, so the scored block is four times this number.' },
      toConfig: function (mod) { return mod.toConfig(); },
      applyConfig: function (mod, config) {
        if (config.responseKeys) mod.responseKeys = config.responseKeys;
      },
      asm: function (mod) {
        return {
          instructions: 'Judge whether the adjective is positive or negative.',
          primes: mod.data.positivePrimes.concat(mod.data.negativePrimes),
          targets: mod.data.positiveTargets.concat(mod.data.negativeTargets),
          conditions: ['congruent', 'incongruent'],
          baseline: 'incongruent',
          response: { positive: mod.responseKeys.positive, negative: mod.responseKeys.negative }
        };
      }
    };
  },

  toConfig: function () {
    return {
      template: 'affective-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      trialsPerCondition: this.trialsPerCondition,
      practiceTrials: this.practiceTrials,
      responseKeys: this.responseKeys,
      timing: this.timing,
      stimuli: {
        positivePrimes: this.data.positivePrimes,
        negativePrimes: this.data.negativePrimes,
        positiveTargets: this.data.positiveTargets,
        negativeTargets: this.data.negativeTargets
      }
    };
  },

  /* ---------- setup ---------- */

  init: function () {
    if (this._initDone) return;
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    PTK.timers(this);
    this._initDone = true;
    console.log('Affective Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('affective-overlay')) return;
    const el = document.createElement('div');
    el.id = 'affective-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:48px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="affective-setup"></div>' +
        '<div id="affective-trial" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="affective-progress">Trial 1</div>' +
          '<div id="affective-stimulus" style="font-size:3rem;font-weight:700;margin:80px 0;min-height:80px;letter-spacing:2px;">+</div>' +
          '<div id="affective-feedback" style="min-height:24px;color:#9aa6b2;"></div>' +
          '<p style="color:#9aa6b2;font-size:.9rem;"><b style="color:#4ade80;">P</b> positive &nbsp; / &nbsp; <b style="color:#f87171;">N</b> negative</p>' +
        '</div>' +
        '<div id="affective-results" style="display:none;">' +
          '<h2 style="color:#ea5cd5;">Complete</h2>' +
          '<div id="affective-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<button class="btn" onclick="Affective.exportCSV()" style="margin-top:10px;">Download CSV</button> ' +
          '<button class="btn" onclick="Affective.exportXLSX()">Download Excel</button> ' +
          '<button class="btn" onclick="Affective.restart()">Try Again</button> ' +
          '<button class="btn btn-secondary" onclick="Affective.close()">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('affective-overlay').style.display = 'block';
    PTK.paintSetup('affective-setup', this, this.spec());
    document.getElementById('affective-setup').style.display = 'block';
    document.getElementById('affective-trial').style.display = 'none';
    document.getElementById('affective-results').style.display = 'none';
    var p = document.getElementById('affective-params');
    if (p) {
      p.textContent = (this.trialsPerCondition * 4) + ' scored trials' +
        (this.practiceTrials ? ', after ' + this.practiceTrials + ' practice trials' : '') +
        '. Prime ' + this.timing.primeDuration + ' ms, response window ' +
        this.timing.responseTimeout + ' ms.';
    }
    this.state.phase = 'setup';
  },

  close: function () {
    // Was: only _timeout was ever cleared. The nested fixation/prime/ISI chain
    // in runTrial and the advance timer in record were untracked, so closing
    // mid-trial left them running into a hidden overlay.
    this._clearTimers();
    clearTimeout(this._timeout);
    const ov = document.getElementById('affective-overlay');
    if (ov) ov.style.display = 'none';
    this.state.awaitingResponse = false;
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  /* ---------- trial construction ---------- */

  buildTrials: function () {
    const D = this.data;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const conditions = [
      { primes: D.positivePrimes, targets: D.positiveTargets, primeVal: 'positive', targetVal: 'positive' },
      { primes: D.positivePrimes, targets: D.negativeTargets, primeVal: 'positive', targetVal: 'negative' },
      { primes: D.negativePrimes, targets: D.positiveTargets, primeVal: 'negative', targetVal: 'positive' },
      { primes: D.negativePrimes, targets: D.negativeTargets, primeVal: 'negative', targetVal: 'negative' }
    ];
    const trials = [];
    conditions.forEach(c => {
      for (let i = 0; i < this.trialsPerCondition; i++) {
        trials.push({
          prime: pick(c.primes),
          target: pick(c.targets),
          primeVal: c.primeVal,
          targetVal: c.targetVal,
          congruent: c.primeVal === c.targetVal
        });
      }
    });
    return PTA.shuffleArray(trials);
  },

  start: function () {
    this.state.currentTrial = 0;
    this.state.results = [];
    document.getElementById('affective-setup').style.display = 'none';
    document.getElementById('affective-results').style.display = 'none';
    document.getElementById('affective-trial').style.display = 'block';

    if (this.practiceTrials > 0) {
      this.state.isPractice = true;
      this.state.trials = PTA.shuffleArray(this.buildTrials()).slice(0, this.practiceTrials);
    } else {
      this.state.isPractice = false;
      this.state.trials = this.buildTrials();
    }
    this.runTrial();
  },

  beginScored: function () {
    this.state.isPractice = false;
    this.state.trials = this.buildTrials();
    this.state.currentTrial = 0;
    this.state.results = [];
    this.runTrial();
  },

  runTrial: function () {
    this._clearTimers();
    const self = this;
    const t = this.state.trials[this.state.currentTrial];
    const stimEl = document.getElementById('affective-stimulus');

    if (!t) {
      if (this.state.isPractice) {
        this.state.awaitingResponse = false;
        document.getElementById('affective-feedback').textContent = '';
        stimEl.style.fontSize = '1.05rem';
        stimEl.innerHTML = 'Practice finished.<br>Press <b>' +
          String(this.responseKeys.positive).toUpperCase() + '</b> to begin the real trials.';
        const go = function (e) {
          if ((e.key || '').toLowerCase() !== self.responseKeys.positive) return;
          document.removeEventListener('keydown', go);
          stimEl.style.fontSize = '3rem';
          self.beginScored();
        };
        document.addEventListener('keydown', go);
        return;
      }
      this.showResults();
      return;
    }

    const stim = stimEl;
    const fb = document.getElementById('affective-feedback');
    fb.textContent = '';
    document.getElementById('affective-progress').textContent =
      (this.state.isPractice ? 'Practice trial ' : 'Trial ') +
      (this.state.currentTrial + 1) + ' of ' + this.state.trials.length;

    this.state.phase = 'fixation';
    this.state.awaitingResponse = false;
    stim.textContent = '+';
    stim.style.color = '#ffffff';

    // Every step of the chain is tracked, so close() can cancel all of it.
    const myTrial = this.state.currentTrial;
    this._after(() => {
      this.state.phase = 'prime';
      stim.textContent = t.prime;
      stim.style.color = '#a78bfa';
      this._after(() => {
        this.state.phase = 'isi';
        stim.textContent = '';
        this._after(() => {
          this.state.phase = 'target';
          stim.textContent = t.target;
          stim.style.color = '#ffffff';
          this.state.stimulusOnset = performance.now();
          this.state.awaitingResponse = true;
          this._after(() => {
            // scoped to THIS trial, so it can never fire into a later one
            if (this.state.awaitingResponse && this.state.currentTrial === myTrial) {
              this.record(null);
            }
          }, this.timing.responseTimeout);
        }, this.timing.isi);
      }, this.timing.primeDuration);
    }, this.timing.fixation);
  },

  handleKeydown: function (e) {
    if (this.state.phase !== 'target' || !this.state.awaitingResponse) return;
    const k = e.key.toLowerCase();
    if (k !== this.responseKeys.positive && k !== this.responseKeys.negative) return;
    e.preventDefault();
    const response = (k === this.responseKeys.positive) ? 'positive' : 'negative';
    this.record(response);
  },

  record: function (response) {
    if (!this.state.awaitingResponse) return;
    this._clearTimers();
    this.state.awaitingResponse = false;
    const t = this.state.trials[this.state.currentTrial];
    const rt = response ? (performance.now() - this.state.stimulusOnset) : null;
    const correct = response ? (response === t.targetVal) : false;

    // Practice trials are shown, then discarded - they must not reach results
    // or Supabase, or they inflate the baseline and shrink the effect.
    if (!this.state.isPractice) {
      this.state.results.push({ ...t, response, correct, rt });
      this.saveTrial(t, response, correct, rt);
    }

    if (this.showFeedback) {
      const fb = document.getElementById('affective-feedback');
      fb.textContent = response ? (correct ? 'Correct' : 'Incorrect') : 'Too slow';
      fb.style.color = correct ? '#4ade80' : '#f87171';
    }
    this.state.currentTrial++;
    this._after(() => this.runTrial(), this.timing.feedbackDuration + this.timing.iti / 2);
  },

  /* ---------- persistence (existing columns only) ---------- */

  saveTrial: function (t, response, correct, rt) {
    const experimentId = 'affective_priming';
    if (!this._participantId) {
      this._participantId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    const trialData = {
      experiment_id: experimentId,
      participant_id: this._participantId,
      trial_number: this.state.currentTrial + 1,
      language: 'en',
      ink_color: t.target,          // repurposed: target adjective
      word_meaning: t.prime,        // repurposed: prime word
      congruent: t.congruent,
      response: response,
      correct: correct,
      rt: rt === null ? null : Math.round(rt * 100) / 100,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    };
    if (window.PTA && PTA.saveToSupabase) PTA.saveToSupabase(trialData);
  },

  /* ---------- results ---------- */

  showResults: function () {
    document.getElementById('affective-trial').style.display = 'none';
    const box = document.getElementById('affective-results');
    box.style.display = 'block';

    const valid = this.state.results.filter(r => r.rt !== null && r.correct);
    const con = valid.filter(r => r.congruent).map(r => r.rt);
    const inc = valid.filter(r => !r.congruent).map(r => r.rt);
    const mCon = con.length ? Math.round(PTA.mean(con)) : null;
    const mInc = inc.length ? Math.round(PTA.mean(inc)) : null;
    const effect = (mCon !== null && mInc !== null) ? (mInc - mCon) : null;
    const acc = Math.round(100 * this.state.results.filter(r => r.correct).length / this.state.results.length);

    document.getElementById('affective-results-body').innerHTML =
      '<p>Trials: ' + this.state.results.length + ' &nbsp; Accuracy: ' + acc + '%</p>' +
      '<p>Mean RT congruent: ' + (mCon !== null ? mCon + ' ms' : '—') + '</p>' +
      '<p>Mean RT incongruent: ' + (mInc !== null ? mInc + ' ms' : '—') + '</p>' +
      '<p style="color:#4ade80;font-weight:700;">Affective priming effect (D): ' +
        (effect !== null ? effect + ' ms' + (effect > 0 ? ' (faster when congruent)' : '') : '—') + '</p>';
  },

  restart: function () { this.open(); this.start(); },

  exportCSV: function () {
    if (!this.state.results.length) { alert('No results to export'); return; }
    const headers = ['trial', 'prime', 'prime_valence', 'target', 'target_valence', 'congruent', 'response', 'correct', 'rt_ms'];
    const rows = this.state.results.map((r, i) =>
      [i + 1, r.prime, r.primeVal, r.target, r.targetVal, r.congruent, r.response || 'none', r.correct, r.rt === null ? '' : Math.round(r.rt)]);
    const csv = [headers, ...rows].map(row => row.map(c => '"' + c + '"').join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const l = document.createElement('a');
    l.href = URL.createObjectURL(blob);
    l.download = 'affective_priming_' + new Date().toISOString().slice(0, 10) + '.csv';
    l.click();
  },

  showThankYou: function () {
    window.history.replaceState({}, document.title, window.location.pathname);
    this.isParticipantMode = false;
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:3000;display:flex;justify-content:center;align-items:center;';
    m.innerHTML = '<div style="background:rgba(17,24,39,.97);border:1px solid rgba(74,222,128,.5);border-radius:20px;padding:44px;max-width:460px;text-align:center;color:#e5e7eb;">' +
      '<h2 style="color:#4ade80;">Thank You!</h2><p style="color:#c0c0c0;">Your responses were recorded. You may close this window.</p>' +
      '<button class="btn" onclick="this.closest(\'div\').parentElement.remove()">Close</button></div>';
    document.body.appendChild(m);
  },

  /* ---------- builder + participant link ---------- */

  exportXLSX: function () {
    if (!this.state.results.length) { alert('No results to export.'); return; }
    const headers = ['trial', 'prime', 'prime_valence', 'target', 'target_valence',
                     'congruent', 'response', 'correct', 'rt_ms'];
    const rows = this.state.results.map((r, i) =>
      [i + 1, r.prime, r.primeVal, r.target, r.targetVal, r.congruent,
       r.response || 'none', r.correct, r.rt === null ? '' : Math.round(r.rt)]);
    PTK.exportXLSX(headers, rows, 'affective_priming');
  },

  openBuilder: function () {
    this.ensureOverlay();
    this.init();
    // Fold in any timing planned on the interactive timeline before the builder
    // reads this.timing, so the two cannot disagree on screen.
    if (window.currentConfig && window.currentConfig.presentation) {
      const p = window.currentConfig.presentation;
      if (typeof p.fixation_ms === 'number') this.timing.fixation = p.fixation_ms;
      if (typeof p.prime_duration_ms === 'number') this.timing.primeDuration = p.prime_duration_ms;
      if (typeof p.ISI_ms === 'number') this.timing.isi = p.ISI_ms;
    }
    PTK.openBuilder(this, this.spec());
  },

  closeBuilder: function () { PTK.closeBuilder(this.spec()); },

  checkUrlConfig: function () {
    this.ensureOverlay();
    this.init();
    return PTK.checkUrlConfig(this, this.spec());
  }
};

document.addEventListener('DOMContentLoaded', function () { Affective.init(); });
console.log('Affective Priming module loaded');
