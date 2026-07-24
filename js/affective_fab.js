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

  /* ---------- setup ---------- */

  init: function () {
    if (this._initDone) return;
    document.addEventListener('keydown', this.handleKeydown.bind(this));
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
        '<div id="affective-setup">' +
          '<h2 style="color:#ff4db8;">Affective Priming</h2>' +
          '<p style="color:#9aa6b2;">A word flashes, then an adjective appears. Judge the <b>adjective</b> as fast as you can:</p>' +
          '<p style="font-size:1.05rem;margin:18px 0;"><b style="color:#4ade80;">P</b> = positive &nbsp;&nbsp; <b style="color:#f87171;">N</b> = negative</p>' +
          '<p style="color:#9aa6b2;font-size:.9rem;">Ignore the first word — it is not part of the task.</p>' +
          '<button class="btn" onclick="Affective.start()" style="margin-top:14px;">Start</button> ' +
          '<button class="btn btn-secondary" onclick="Affective.close()">Cancel</button>' +
        '</div>' +
        '<div id="affective-trial" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="affective-progress">Trial 1</div>' +
          '<div id="affective-stimulus" style="font-size:3rem;font-weight:700;margin:80px 0;min-height:80px;letter-spacing:2px;">+</div>' +
          '<div id="affective-feedback" style="min-height:24px;color:#9aa6b2;"></div>' +
          '<p style="color:#9aa6b2;font-size:.9rem;"><b style="color:#4ade80;">P</b> positive &nbsp; / &nbsp; <b style="color:#f87171;">N</b> negative</p>' +
        '</div>' +
        '<div id="affective-results" style="display:none;">' +
          '<h2 style="color:#ff4db8;">Complete</h2>' +
          '<div id="affective-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<button class="btn" onclick="Affective.exportCSV()" style="margin-top:10px;">Download CSV</button> ' +
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
    document.getElementById('affective-setup').style.display = 'block';
    document.getElementById('affective-trial').style.display = 'none';
    document.getElementById('affective-results').style.display = 'none';
    this.state.phase = 'setup';
  },

  close: function () {
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
    this.state.trials = this.buildTrials();
    this.state.currentTrial = 0;
    this.state.results = [];
    document.getElementById('affective-setup').style.display = 'none';
    document.getElementById('affective-results').style.display = 'none';
    document.getElementById('affective-trial').style.display = 'block';
    this.runTrial();
  },

  runTrial: function () {
    const t = this.state.trials[this.state.currentTrial];
    if (!t) { this.showResults(); return; }
    const stim = document.getElementById('affective-stimulus');
    const fb = document.getElementById('affective-feedback');
    fb.textContent = '';
    document.getElementById('affective-progress').textContent =
      'Trial ' + (this.state.currentTrial + 1) + ' of ' + this.state.trials.length;

    this.state.phase = 'fixation';
    this.state.awaitingResponse = false;
    stim.textContent = '+';
    stim.style.color = '#ffffff';

    setTimeout(() => {
      this.state.phase = 'prime';
      stim.textContent = t.prime;
      stim.style.color = '#a78bfa';
      setTimeout(() => {
        this.state.phase = 'isi';
        stim.textContent = '';
        setTimeout(() => {
          this.state.phase = 'target';
          stim.textContent = t.target;
          stim.style.color = '#ffffff';
          this.state.stimulusOnset = performance.now();
          this.state.awaitingResponse = true;
          this._timeout = setTimeout(() => {
            if (this.state.awaitingResponse) this.record(null);
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
    clearTimeout(this._timeout);
    this.state.awaitingResponse = false;
    const t = this.state.trials[this.state.currentTrial];
    const rt = response ? (performance.now() - this.state.stimulusOnset) : null;
    const correct = response ? (response === t.targetVal) : false;

    this.state.results.push({ ...t, response, correct, rt });
    this.saveTrial(t, response, correct, rt);

    if (this.showFeedback) {
      const fb = document.getElementById('affective-feedback');
      fb.textContent = response ? (correct ? 'Correct' : 'Incorrect') : 'Too slow';
      fb.style.color = correct ? '#4ade80' : '#f87171';
    }
    this.state.currentTrial++;
    setTimeout(() => this.runTrial(), this.timing.feedbackDuration + this.timing.iti / 2);
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

  openBuilder: function () {
    // Minimal builder: collect experimenter identity + generate a shareable link.
    this.ensureOverlay();
    const email = prompt('Your email (for data attribution):', this.experimenterEmail || '');
    if (email === null) return;
    const expId = prompt('Experiment ID (e.g. affective_pilot_1):', this.userExperimentId || '');
    if (expId === null) return;
    this.experimenterEmail = email.trim();
    this.userExperimentId = expId.trim();

    const config = {
      template: 'affective-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      trialsPerCondition: this.trialsPerCondition,
      timing: { ...this.timing }
    };
    // Fold in any timing planned on the interactive timeline.
    if (window.currentConfig && window.currentConfig.presentation) {
      const p = window.currentConfig.presentation;
      if (typeof p.fixation_ms === 'number') config.timing.fixation = p.fixation_ms;
      if (typeof p.prime_duration_ms === 'number') config.timing.primeDuration = p.prime_duration_ms;
      if (typeof p.ISI_ms === 'number') config.timing.isi = p.ISI_ms;
    }
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
    const link = window.location.href.split('?')[0] + '?affective=' + encoded;
    window.prompt('Participant link (copy and send):', link);
  },

  checkUrlConfig: function () {
    const urlParams = new URLSearchParams(window.location.search);
    const raw = urlParams.get('affective');
    if (!raw) return false;
    try {
      const config = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (config.template !== 'affective-priming') return false;
      this.isParticipantMode = true;
      this.experimenterEmail = config.experimenterEmail || '';
      this.userExperimentId = config.userExperimentId || '';
      this.trialsPerCondition = config.trialsPerCondition || 5;
      if (config.timing) {
        this.timing.fixation = config.timing.fixation || 500;
        this.timing.primeDuration = config.timing.primeDuration || 200;
        this.timing.isi = config.timing.isi || 100;
      }
      const layout = document.querySelector('.layout');
      if (layout) layout.style.display = 'none';
      this.open();
      return true;
    } catch (e) {
      console.error('Affective: bad participant config', e);
      return false;
    }
  }
};

document.addEventListener('DOMContentLoaded', function () { Affective.init(); });
console.log('Affective Priming module loaded');
