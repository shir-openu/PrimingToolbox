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
 * Priming (ABCD): A = the suppressed distractor, B = the selective-attention
 * task, C = control-probe latency, D = ignored-repetition latency. The effect
 * is the D - C difference, and unlike most priming it is expected to be
 * POSITIVE (interference, not facilitation).
 *
 * Self-contained (injects its own overlay). Saves through PTA.saveToSupabase
 * using only existing experiment_results columns.
 *
 * @module NegativePriming
 */
window.NegativePriming = {

  data: {
    // Four visually distinct letters, all easy to type.
    letters: ['B', 'C', 'F', 'H'],
    keyHint: 'Press the key of the GREEN letter'
  },

  state: {
    pairs: [], currentPair: 0, phase: 'setup',
    stage: 'prime',          // 'prime' | 'probe'
    onset: 0, results: [], awaiting: false, openedFromBuilder: false
  },

  // timing, overridable by a participant link
  timing: {
    fixation_ms: 500,
    display_ms: 2000,        // display stays until response, capped here
    iti_ms: 700
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  repetitions: 4,            // pairs per condition
  _initDone: false,
  _participantId: '',
  _keyHandler: null,
  _timers: [],

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    console.log('Negative Priming module initialized');
  },

  /** Same discipline as the other timed paradigms: every timer belongs to one
   *  display and is cancelled when that display ends, so nothing from a
   *  finished trial can fire into the next one. */
  _after: function (fn, ms) {
    const id = setTimeout(fn, ms);
    this._timers.push(id);
    return id;
  },

  _clearTimers: function () {
    this._timers.forEach(clearTimeout);
    this._timers = [];
  },

  ensureOverlay: function () {
    if (document.getElementById('negative-overlay')) return;
    const el = document.createElement('div');
    el.id = 'negative-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        '<div id="negative-setup">' +
          '<h2 style="color:#22d3ee;">Negative Priming</h2>' +
          '<p style="color:#9aa6b2;line-height:1.7;">Two letters appear on top of each other: one <b style="color:#4ade80;">green</b>, one <b style="color:#f87171;">red</b>.<br>' +
            'Press the key of the <b style="color:#4ade80;">GREEN</b> letter as fast as you can, and ignore the red one entirely.</p>' +
          '<p style="color:#9aa6b2;">Keys in use: <b>B &nbsp; C &nbsp; F &nbsp; H</b></p>' +
          '<button class="btn" onclick="NegativePriming.start()" style="margin-top:14px;">Start</button> ' +
          '<button class="btn btn-secondary" onclick="NegativePriming.close()">Cancel</button>' +
        '</div>' +
        '<div id="negative-trial" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="negative-progress">Pair 1</div>' +
          '<div id="negative-stage" style="color:#64748b;font-size:.8rem;letter-spacing:2px;margin-top:6px;"></div>' +
          '<div id="negative-display" style="position:relative;height:190px;display:flex;align-items:center;justify-content:center;margin:22px 0;"></div>' +
          '<div style="color:#64748b;font-size:.85rem;">' + 'Press B, C, F or H' + '</div>' +
        '</div>' +
        '<div id="negative-results" style="display:none;">' +
          '<h2 style="color:#22d3ee;">Complete</h2>' +
          '<div id="negative-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<p style="color:#9aa6b2;font-size:.82rem;max-width:560px;margin:10px auto;">A POSITIVE effect is the expected result here: suppressing the distractor makes it harder to name a moment later.</p>' +
          '<button class="btn" onclick="NegativePriming.exportCSV()">Download CSV</button> ' +
          '<button class="btn" onclick="NegativePriming.restart()">Try Again</button> ' +
          '<button class="btn btn-secondary" onclick="NegativePriming.close()">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('negative-overlay').style.display = 'block';
    document.getElementById('negative-setup').style.display = 'block';
    document.getElementById('negative-trial').style.display = 'none';
    document.getElementById('negative-results').style.display = 'none';
    this.state.phase = 'setup';
  },

  close: function () {
    this.detachKeys();
    this._clearTimers();
    this.state.awaiting = false;
    const ov = document.getElementById('negative-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  /**
   * A pair is prime(target,distractor) + probe(target,distractor).
   *   ignored-repetition : probe target === prime distractor
   *   control            : no letter is shared between prime and probe
   */
  buildPairs: function () {
    const L = this.data.letters;
    const pairs = [];
    for (let r = 0; r < this.repetitions; r++) {
      L.forEach(primeTarget => {
        const rest = L.filter(x => x !== primeTarget);
        const primeDist = rest[Math.floor(Math.random() * rest.length)];

        // ignored repetition: the ignored letter is now the one to name
        const irRest = L.filter(x => x !== primeDist);
        pairs.push({
          condition: 'ignored-repetition',
          prime: { target: primeTarget, distractor: primeDist },
          probe: { target: primeDist, distractor: irRest[Math.floor(Math.random() * irRest.length)] }
        });

        // control: probe shares nothing with the prime
        const free = L.filter(x => x !== primeTarget && x !== primeDist);
        if (free.length >= 2) {
          const shuffled = PTA.shuffleArray(free.slice());
          pairs.push({
            condition: 'control',
            prime: { target: primeTarget, distractor: primeDist },
            probe: { target: shuffled[0], distractor: shuffled[1] }
          });
        }
      });
    }
    return PTA.shuffleArray(pairs);
  },

  start: function () {
    this.state.pairs = this.buildPairs();
    this.state.currentPair = 0;
    this.state.stage = 'prime';
    this.state.results = [];
    document.getElementById('negative-setup').style.display = 'none';
    document.getElementById('negative-results').style.display = 'none';
    document.getElementById('negative-trial').style.display = 'block';
    this.attachKeys();
    this.runStage();
  },

  attachKeys: function () {
    if (this._keyHandler) return;
    this._keyHandler = (e) => this.onKey(e);
    document.addEventListener('keydown', this._keyHandler);
  },

  detachKeys: function () {
    if (!this._keyHandler) return;
    document.removeEventListener('keydown', this._keyHandler);
    this._keyHandler = null;
  },

  runStage: function () {
    this._clearTimers();
    const pair = this.state.pairs[this.state.currentPair];
    if (!pair) { this.showResults(); return; }
    const disp = pair[this.state.stage];
    const myPair = this.state.currentPair;
    const myStage = this.state.stage;

    document.getElementById('negative-progress').textContent =
      'Pair ' + (this.state.currentPair + 1) + ' of ' + this.state.pairs.length;
    document.getElementById('negative-stage').textContent =
      this.state.stage === 'prime' ? 'PRIME' : 'PROBE';

    const box = document.getElementById('negative-display');
    box.innerHTML = '<div style="font-size:2.4rem;color:#64748b;">+</div>';
    this.state.awaiting = false;

    this._after(() => {
      // the two letters are overlaid, which is what forces selection by colour
      box.innerHTML =
        '<div style="position:relative;width:150px;height:150px;">' +
          '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
               'font-size:6rem;font-weight:700;color:#f87171;opacity:.85;">' + disp.distractor + '</div>' +
          '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
               'font-size:6rem;font-weight:700;color:#4ade80;">' + disp.target + '</div>' +
        '</div>';
      this.state.onset = performance.now();
      this.state.awaiting = true;

      // response window, scoped to this display only
      this._after(() => {
        if (this.state.awaiting &&
            this.state.currentPair === myPair && this.state.stage === myStage) {
          this.state.awaiting = false;
          this.commit(disp, null, this.timing.display_ms, true);
        }
      }, this.timing.display_ms);
    }, this.timing.fixation_ms);
  },

  onKey: function (e) {
    if (!this.state.awaiting) return;
    const key = (e.key || '').toUpperCase();
    if (this.data.letters.indexOf(key) === -1) return;
    e.preventDefault();
    this.state.awaiting = false;
    const pair = this.state.pairs[this.state.currentPair];
    if (!pair) return;
    this.commit(pair[this.state.stage], key, performance.now() - this.state.onset, false);
  },

  /** Single place where a display is written down, whether the participant
   *  answered or the response window ran out. */
  commit: function (disp, key, rt, timedOut) {
    this._clearTimers();
    const pair = this.state.pairs[this.state.currentPair];
    if (!pair) return;
    const correct = !timedOut && key === disp.target;

    // Only PROBE latencies carry the effect; prime rows are kept for completeness.
    const row = {
      pair: this.state.currentPair + 1,
      stage: this.state.stage,
      condition: pair.condition,
      target: disp.target,
      distractor: disp.distractor,
      response: key || 'none',
      correct: correct,
      rt: rt,
      timedOut: !!timedOut
    };
    this.state.results.push(row);
    this.saveTrial(row);

    document.getElementById('negative-display').innerHTML =
      '<div style="font-size:2rem;color:' +
        (timedOut ? '#fbbf24' : (correct ? '#4ade80' : '#f87171')) + ';">' +
        (timedOut ? 'too slow' : (correct ? 'ok' : 'wrong key')) + '</div>';

    this._after(() => {
      if (this.state.stage === 'prime') {
        this.state.stage = 'probe';
      } else {
        this.state.stage = 'prime';
        this.state.currentPair++;
      }
      this.runStage();
    }, this.timing.iti_ms);
  },

  saveTrial: function (r) {
    if (!this._participantId) this._participantId = PTA.generateParticipantId();
    const trialData = {
      experiment_id: 'negative_priming',
      participant_id: this._participantId,
      trial_number: this.state.results.length,
      language: 'en',
      ink_color: r.condition,        // repurposed: ignored-repetition / control
      word_meaning: r.stage,         // repurposed: prime / probe
      congruent: r.condition === 'ignored-repetition',
      response: r.response,
      correct: r.correct,
      rt: Math.round(r.rt * 100) / 100,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    };
    if (window.PTA && PTA.saveToSupabase) PTA.saveToSupabase(trialData);
  },

  showResults: function () {
    this.detachKeys();
    this._clearTimers();
    document.getElementById('negative-trial').style.display = 'none';
    document.getElementById('negative-results').style.display = 'block';

    const probes = this.state.results.filter(r => r.stage === 'probe' && r.correct && !r.timedOut);
    const ir = probes.filter(r => r.condition === 'ignored-repetition').map(r => r.rt);
    const ct = probes.filter(r => r.condition === 'control').map(r => r.rt);
    const mIR = ir.length ? Math.round(PTA.mean(ir)) : null;
    const mCT = ct.length ? Math.round(PTA.mean(ct)) : null;
    const effect = (mIR !== null && mCT !== null) ? (mIR - mCT) : null;
    const acc = this.state.results.length
      ? Math.round(100 * this.state.results.filter(r => r.correct).length / this.state.results.length) : 0;

    document.getElementById('negative-results-body').innerHTML =
      '<p>Displays completed: ' + this.state.results.length + ' &nbsp;|&nbsp; accuracy ' + acc + '%</p>' +
      '<p>Probe RT - ignored repetition: ' + (mIR !== null ? mIR + ' ms' : '-') + '</p>' +
      '<p>Probe RT - control: ' + (mCT !== null ? mCT + ' ms' : '-') + '</p>' +
      '<p style="color:#22d3ee;font-weight:700;">Negative priming effect (D): ' +
        (effect !== null ? effect + ' ms' +
          (effect > 0 ? ' (slower after ignoring - the expected direction)' : ' (no suppression cost)') : '-') + '</p>';
  },

  restart: function () { this.open(); this.start(); },

  exportCSV: function () {
    if (!this.state.results.length) { alert('No results to export'); return; }
    const headers = ['pair', 'stage', 'condition', 'target', 'distractor', 'response', 'correct', 'rt_ms'];
    const rows = this.state.results.map(r =>
      [r.pair, r.stage, r.condition, r.target, r.distractor, r.response, r.correct, Math.round(r.rt)]);
    const csv = [headers, ...rows].map(row => row.map(c => '"' + c + '"').join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const l = document.createElement('a');
    l.href = URL.createObjectURL(blob);
    l.download = 'negative_priming_' + new Date().toISOString().slice(0, 10) + '.csv';
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

  openBuilder: function () {
    this.ensureOverlay();
    const email = prompt('Your email (for data attribution):', this.experimenterEmail || '');
    if (email === null) return;
    const expId = prompt('Experiment ID (e.g. negative_pilot_1):', this.userExperimentId || '');
    if (expId === null) return;
    const reps = prompt('Pairs per condition (1-10):', String(this.repetitions));
    if (reps === null) return;
    this.experimenterEmail = email.trim();
    this.userExperimentId = expId.trim();
    const n = parseInt(reps, 10);
    this.repetitions = (n >= 1 && n <= 10) ? n : this.repetitions;
    const config = {
      template: 'negative-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      repetitions: this.repetitions,
      timing: this.timing
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
    const link = window.location.href.split('?')[0] + '?negative=' + encoded;
    window.prompt('Participant link (copy and send):', link);
  },

  checkUrlConfig: function () {
    const urlParams = new URLSearchParams(window.location.search);
    const raw = urlParams.get('negative');
    if (!raw) return false;
    try {
      const config = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (config.template !== 'negative-priming') return false;
      this.isParticipantMode = true;
      this.experimenterEmail = config.experimenterEmail || '';
      this.userExperimentId = config.userExperimentId || '';
      this.repetitions = config.repetitions || this.repetitions;
      if (config.timing) Object.assign(this.timing, config.timing);
      const layout = document.querySelector('.layout');
      if (layout) layout.style.display = 'none';
      this.open();
      return true;
    } catch (e) {
      console.error('NegativePriming: bad participant config', e);
      return false;
    }
  }
};

document.addEventListener('DOMContentLoaded', function () { NegativePriming.init(); });
console.log('Negative Priming module loaded');
