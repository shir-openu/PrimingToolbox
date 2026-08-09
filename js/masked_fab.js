/**
 * =====================================================
 * PrimingToolbox - Masked Lexical Decision (V2 _fab)
 * =====================================================
 *
 * Forster & Davis (1984). Each trial runs
 *     forward mask (#######)  ->  prime (lowercase, ~50 ms)  ->  target (UPPERCASE)
 * and the participant decides whether the TARGET is a real word or not. At a
 * 50 ms prime duration preceded by a mask, participants typically cannot report
 * the prime, yet repetition primes still speed the decision.
 *
 * Priming (ABCD): A = the masked prime, B = the lexical decision, C = unrelated
 * prime latency, D = repetition prime latency. Effect = C - D, positive means
 * facilitation.
 *
 * Conditions: repetition (prime === target), unrelated. Non-word targets are
 * present so the decision is real, but only WORD targets enter the effect.
 *
 * Self-contained (injects its own overlay). Saves through PTA.saveToSupabase
 * using only existing experiment_results columns.
 *
 * @module MaskedLexical
 */
window.MaskedLexical = {

  data: {
    words: ['TABLE', 'HORSE', 'RIVER', 'CHAIR', 'BREAD', 'CLOUD',
            'STONE', 'LIGHT', 'MUSIC', 'PLANT', 'HOUSE', 'DREAM'],
    // Pronounceable non-words, hand-checked: each is orthographically legal
    // English and matched in length to the word list above.
    nonwordList: ['MABLO', 'GORSA', 'NIVEL', 'PHAIL', 'SREAK', 'TROUF',
                  'DRONA', 'WIGHK', 'MUNIC', 'PLONT', 'HOUSK', 'DRAEM'],
    maskChar: '#'
  },

  state: {
    trials: [], currentTrial: 0, phase: 'setup',
    onset: 0, results: [], awaiting: false, openedFromBuilder: false
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
  _initDone: false,
  _participantId: '',
  _keyHandler: null,
  _timers: [],

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    console.log('Masked Lexical Decision module initialized');
  },

  /**
   * Every timer this module starts is tracked, and every timer is cancelled
   * when the trial it belongs to ends.
   *
   * Without this, the response-window timeout of trial N stayed pending after
   * an early response and fired in the middle of trial N+1, writing a false
   * "too slow" row stamped with N+1's number but N's target. At the default
   * 2000 ms window and an 800 ms ITI that happened on most trials.
   */
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
    if (document.getElementById('masked-overlay')) return;
    const el = document.createElement('div');
    el.id = 'masked-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        '<div id="masked-setup">' +
          '<h2 style="color:#a78bfa;">Masked Lexical Decision</h2>' +
          '<p style="color:#9aa6b2;line-height:1.7;">A row of ' + '#' + ' symbols flashes, then a letter string appears in <b>CAPITALS</b>.<br>' +
            'Decide as fast as you can whether the CAPITAL string is a real English word.</p>' +
          '<p style="color:#9aa6b2;"><b>J</b> = real word &nbsp;&nbsp;&nbsp; <b>F</b> = not a word</p>' +
          '<button class="btn" onclick="MaskedLexical.start()" style="margin-top:14px;">Start</button> ' +
          '<button class="btn btn-secondary" onclick="MaskedLexical.close()">Cancel</button>' +
        '</div>' +
        '<div id="masked-trial" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="masked-progress">Trial 1</div>' +
          '<div id="masked-display" style="height:190px;display:flex;align-items:center;justify-content:center;' +
               'font-size:3.4rem;font-weight:700;letter-spacing:4px;margin:22px 0;"></div>' +
          '<div style="color:#64748b;font-size:.85rem;">J = word &nbsp; | &nbsp; F = non-word</div>' +
        '</div>' +
        '<div id="masked-results" style="display:none;">' +
          '<h2 style="color:#a78bfa;">Complete</h2>' +
          '<div id="masked-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<p style="color:#9aa6b2;font-size:.82rem;max-width:560px;margin:10px auto;">Prime duration is ' +
            '<span id="masked-prime-note"></span> ms. Above roughly 60 ms primes start to become reportable, and the effect is no longer strictly masked.</p>' +
          '<button class="btn" onclick="MaskedLexical.exportCSV()">Download CSV</button> ' +
          '<button class="btn" onclick="MaskedLexical.restart()">Try Again</button> ' +
          '<button class="btn btn-secondary" onclick="MaskedLexical.close()">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('masked-overlay').style.display = 'block';
    document.getElementById('masked-setup').style.display = 'block';
    document.getElementById('masked-trial').style.display = 'none';
    document.getElementById('masked-results').style.display = 'none';
    this.state.phase = 'setup';
  },

  close: function () {
    this.detachKeys();
    this._clearTimers();
    this.state.awaiting = false;
    const ov = document.getElementById('masked-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  buildTrials: function () {
    const trials = [];
    const words = this.data.words;
    const nonwords = this.data.nonwordList;

    for (let r = 0; r < this.repetitions; r++) {
      words.forEach((w, i) => {
        // half of the word targets get a repetition prime, half an unrelated one
        if (i % 2 === 0) {
          trials.push({ prime: w.toLowerCase(), target: w, lexical: 'word', condition: 'repetition' });
        } else {
          const others = words.filter(x => x !== w);
          const p = others[Math.floor(Math.random() * others.length)];
          trials.push({ prime: p.toLowerCase(), target: w, lexical: 'word', condition: 'unrelated' });
        }
      });
      // non-word targets: needed so the decision is genuine, excluded from the effect
      nonwords.forEach(nw => {
        const p = words[Math.floor(Math.random() * words.length)];
        trials.push({ prime: p.toLowerCase(), target: nw, lexical: 'nonword', condition: 'filler' });
      });
    }
    return PTA.shuffleArray(trials);
  },

  start: function () {
    this.state.trials = this.buildTrials();
    this.state.currentTrial = 0;
    this.state.results = [];
    document.getElementById('masked-setup').style.display = 'none';
    document.getElementById('masked-results').style.display = 'none';
    document.getElementById('masked-trial').style.display = 'block';
    this.attachKeys();
    this.runTrial();
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

  runTrial: function () {
    this._clearTimers();                       // nothing from the last trial survives
    const index = this.state.currentTrial;
    const t = this.state.trials[index];
    if (!t) { this.showResults(); return; }
    const box = document.getElementById('masked-display');
    document.getElementById('masked-progress').textContent =
      'Trial ' + (index + 1) + ' of ' + this.state.trials.length;
    this.state.awaiting = false;

    // 1. forward mask
    box.style.color = '#64748b';
    box.textContent = this.data.maskChar.repeat(Math.max(t.target.length, 5));

    this._after(() => {
      // 2. masked prime
      box.style.color = '#cbd5e1';
      box.textContent = t.prime;

      this._after(() => {
        // 3. target
        box.style.color = '#ffffff';
        box.textContent = t.target;
        this.state.onset = performance.now();
        this.state.awaiting = true;

        // response window - belongs to THIS trial only
        this._after(() => {
          if (this.state.awaiting && this.state.currentTrial === index) {
            this.state.awaiting = false;
            this.record(t, index, null, this.timing.target_ms);
          }
        }, this.timing.target_ms);
      }, this.timing.prime_ms);
    }, this.timing.mask_ms);
  },

  onKey: function (e) {
    if (!this.state.awaiting) return;
    const key = (e.key || '').toUpperCase();
    if (key !== 'J' && key !== 'F') return;
    e.preventDefault();
    this.state.awaiting = false;
    const index = this.state.currentTrial;
    const t = this.state.trials[index];
    if (!t) return;
    this.record(t, index, key, performance.now() - this.state.onset);
  },

  /** index is the trial this row belongs to, so a row can never be stamped
   *  with a different trial's number than the target it actually showed. */
  record: function (t, index, key, rt) {
    this._clearTimers();
    const said = key === 'J' ? 'word' : (key === 'F' ? 'nonword' : 'none');
    const correct = said === t.lexical;
    const r = {
      trial: index + 1,
      prime: t.prime, target: t.target,
      lexical: t.lexical, condition: t.condition,
      response: said, correct: correct, rt: rt, timedOut: key === null
    };
    this.state.results.push(r);
    this.saveTrial(r);

    const box = document.getElementById('masked-display');
    box.style.color = key === null ? '#fbbf24' : (correct ? '#4ade80' : '#f87171');
    box.textContent = key === null ? 'too slow' : (correct ? 'ok' : 'x');

    this.state.currentTrial++;
    this._after(() => this.runTrial(), this.timing.iti_ms);
  },

  saveTrial: function (r) {
    if (!this._participantId) this._participantId = PTA.generateParticipantId();
    const trialData = {
      experiment_id: 'masked_lexical_decision',
      participant_id: this._participantId,
      trial_number: r.trial,
      language: 'en',
      prime_type: r.condition,      // repetition / unrelated / filler
      target: r.target,
      ink_color: r.condition,       // repurposed, kept for older dashboards
      word_meaning: r.prime,        // repurposed: the masked prime
      congruent: r.condition === 'repetition',
      response: r.response,
      correct: r.correct,
      rt: Math.round(r.rt * 100) / 100,
      soa: this.timing.prime_ms,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    };
    if (window.PTA && PTA.saveToSupabase) PTA.saveToSupabase(trialData);
  },

  showResults: function () {
    this.detachKeys();
    this._clearTimers();
    document.getElementById('masked-trial').style.display = 'none';
    document.getElementById('masked-results').style.display = 'block';
    const note = document.getElementById('masked-prime-note');
    if (note) note.textContent = String(this.timing.prime_ms);

    const good = this.state.results.filter(r => r.lexical === 'word' && r.correct && !r.timedOut);
    const rep = good.filter(r => r.condition === 'repetition').map(r => r.rt);
    const unr = good.filter(r => r.condition === 'unrelated').map(r => r.rt);
    const mR = rep.length ? Math.round(PTA.mean(rep)) : null;
    const mU = unr.length ? Math.round(PTA.mean(unr)) : null;
    const effect = (mR !== null && mU !== null) ? (mU - mR) : null;
    const acc = this.state.results.length
      ? Math.round(100 * this.state.results.filter(r => r.correct).length / this.state.results.length) : 0;

    document.getElementById('masked-results-body').innerHTML =
      '<p>Trials: ' + this.state.results.length + ' &nbsp;|&nbsp; accuracy ' + acc + '%</p>' +
      '<p>Word RT - repetition prime: ' + (mR !== null ? mR + ' ms' : '-') + '</p>' +
      '<p>Word RT - unrelated prime: ' + (mU !== null ? mU + ' ms' : '-') + '</p>' +
      '<p style="color:#a78bfa;font-weight:700;">Masked priming effect (D): ' +
        (effect !== null ? effect + ' ms' + (effect > 0 ? ' (faster after a repetition prime)' : '') : '-') + '</p>';
  },

  restart: function () { this.open(); this.start(); },

  exportCSV: function () {
    if (!this.state.results.length) { alert('No results to export'); return; }
    const headers = ['trial', 'prime', 'target', 'lexical', 'condition', 'response', 'correct', 'rt_ms', 'prime_ms'];
    const rows = this.state.results.map(r =>
      [r.trial, r.prime, r.target, r.lexical, r.condition, r.response, r.correct,
       Math.round(r.rt), this.timing.prime_ms]);
    const csv = [headers, ...rows].map(row => row.map(c => '"' + c + '"').join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const l = document.createElement('a');
    l.href = URL.createObjectURL(blob);
    l.download = 'masked_lexical_' + new Date().toISOString().slice(0, 10) + '.csv';
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
    const expId = prompt('Experiment ID (e.g. masked_pilot_1):', this.userExperimentId || '');
    if (expId === null) return;
    const pd = prompt('Prime duration in ms (classic masked range is 40-60):', String(this.timing.prime_ms));
    if (pd === null) return;
    this.experimenterEmail = email.trim();
    this.userExperimentId = expId.trim();
    const n = parseInt(pd, 10);
    if (n >= 10 && n <= 500) this.timing.prime_ms = n;
    const config = {
      template: 'masked-lexical',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      repetitions: this.repetitions,
      timing: this.timing
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
    const link = window.location.href.split('?')[0] + '?masked=' + encoded;
    window.prompt('Participant link (copy and send):', link);
  },

  checkUrlConfig: function () {
    const urlParams = new URLSearchParams(window.location.search);
    const raw = urlParams.get('masked');
    if (!raw) return false;
    try {
      const config = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (config.template !== 'masked-lexical') return false;
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
      console.error('MaskedLexical: bad participant config', e);
      return false;
    }
  }
};

document.addEventListener('DOMContentLoaded', function () { MaskedLexical.init(); });
console.log('Masked Lexical Decision module loaded');
