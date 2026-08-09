/**
 * =====================================================
 * PrimingToolbox - Syntactic (Structural) Priming (V2 _fab)
 * =====================================================
 *
 * Bock (1986). The participant first reads a prime sentence built on one of two
 * structures, then describes a new event by choosing between the same two
 * structures. People tend to reuse the structure they just read, even though
 * the two options mean the same thing and share no content words.
 *
 * Two alternations are included:
 *   dative   : double-object   "the girl gave the boy a book"
 *              prepositional   "the girl gave a book to the boy"
 *   voice    : active          "the dog chased the postman"
 *              passive         "the postman was chased by the dog"
 *
 * Priming (ABCD): A = the structure of the prime, B = the description task,
 * C = baseline structure choice, D = structure choice after the prime. The
 * dependent measure is a RATE, not a latency - this is the first paradigm in
 * the toolbox whose effect is a proportion, so the results panel reports both
 * the choice rate and the decision latency.
 *
 * Self-contained (injects its own overlay). Saves through PTA.saveToSupabase
 * using only existing experiment_results columns.
 *
 * @module SyntacticPriming
 */
window.SyntacticPriming = {

  data: {
    items: [
      { set: 'dative',
        prime: { do: 'The waiter handed the customer a menu.',
                 po: 'The waiter handed a menu to the customer.' },
        target: { verb: 'sold', agent: 'the farmer', recipient: 'the neighbour', theme: 'a tractor' } },
      { set: 'dative',
        prime: { do: 'The teacher showed the class a photograph.',
                 po: 'The teacher showed a photograph to the class.' },
        target: { verb: 'sent', agent: 'the lawyer', recipient: 'the client', theme: 'a contract' } },
      { set: 'dative',
        prime: { do: 'The nurse brought the patient a blanket.',
                 po: 'The nurse brought a blanket to the patient.' },
        target: { verb: 'threw', agent: 'the captain', recipient: 'the sailor', theme: 'a rope' } },
      { set: 'dative',
        prime: { do: 'The uncle bought the twins a puzzle.',
                 po: 'The uncle bought a puzzle for the twins.' },
        target: { verb: 'read', agent: 'the mother', recipient: 'the child', theme: 'a story' } },

      { set: 'voice',
        prime: { active: 'The lightning struck the church tower.',
                 passive: 'The church tower was struck by the lightning.' },
        target: { verb: 'chased', agent: 'the dog', patient: 'the postman' } },
      { set: 'voice',
        prime: { active: 'The referee stopped the match.',
                 passive: 'The match was stopped by the referee.' },
        target: { verb: 'painted', agent: 'the artist', patient: 'the wall' } },
      { set: 'voice',
        prime: { active: 'The storm damaged the harbour.',
                 passive: 'The harbour was damaged by the storm.' },
        target: { verb: 'carried', agent: 'the river', patient: 'the branch' } },
      { set: 'voice',
        prime: { active: 'The committee rejected the proposal.',
                 passive: 'The proposal was rejected by the committee.' },
        target: { verb: 'solved', agent: 'the student', patient: 'the problem' } }
    ]
  },

  state: {
    trials: [], currentTrial: 0, phase: 'setup', stage: 'prime',
    onset: 0, results: [], openedFromBuilder: false
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  repetitions: 1,
  _initDone: false,
  _participantId: '',

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    console.log('Syntactic Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('syntactic-overlay')) return;
    const el = document.createElement('div');
    el.id = 'syntactic-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        '<div id="syntactic-setup">' +
          '<h2 style="color:#fbbf24;">Sentence Structure</h2>' +
          '<p style="color:#9aa6b2;line-height:1.7;">You will read a sentence, then describe a new event.<br>' +
            'Two ways of saying it will be offered - both are correct English. ' +
            'Just pick the one that feels more natural to you. There is no right answer.</p>' +
          '<button class="btn" onclick="SyntacticPriming.start()" style="margin-top:14px;">Start</button> ' +
          '<button class="btn btn-secondary" onclick="SyntacticPriming.close()">Cancel</button>' +
        '</div>' +
        '<div id="syntactic-trial" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="syntactic-progress">Item 1</div>' +
          '<div id="syntactic-prime" style="display:none;">' +
            '<div style="color:#64748b;font-size:.8rem;letter-spacing:2px;margin-top:18px;">READ THIS SENTENCE</div>' +
            '<div id="syntactic-prime-text" style="font-size:1.45rem;margin:26px 0;color:#e5e7eb;line-height:1.6;"></div>' +
            '<button class="btn" onclick="SyntacticPriming.primeDone()">I have read it</button>' +
          '</div>' +
          '<div id="syntactic-choice" style="display:none;">' +
            '<div style="color:#64748b;font-size:.8rem;letter-spacing:2px;margin-top:18px;">NOW DESCRIBE THIS EVENT</div>' +
            '<div id="syntactic-cue" style="font-size:1.15rem;margin:20px 0;color:#fbbf24;"></div>' +
            '<div id="syntactic-options" style="display:flex;flex-direction:column;gap:14px;max-width:560px;margin:0 auto;"></div>' +
          '</div>' +
        '</div>' +
        '<div id="syntactic-results" style="display:none;">' +
          '<h2 style="color:#fbbf24;">Complete</h2>' +
          '<div id="syntactic-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<button class="btn" onclick="SyntacticPriming.exportCSV()">Download CSV</button> ' +
          '<button class="btn" onclick="SyntacticPriming.restart()">Try Again</button> ' +
          '<button class="btn btn-secondary" onclick="SyntacticPriming.close()">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('syntactic-overlay').style.display = 'block';
    document.getElementById('syntactic-setup').style.display = 'block';
    document.getElementById('syntactic-trial').style.display = 'none';
    document.getElementById('syntactic-results').style.display = 'none';
    this.state.phase = 'setup';
  },

  close: function () {
    const ov = document.getElementById('syntactic-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  /** The two structure labels for an item set, in a fixed order. */
  formsFor: function (set) {
    return set === 'dative' ? ['do', 'po'] : ['active', 'passive'];
  },

  /** Build the two candidate descriptions of the target event. */
  optionsFor: function (item) {
    const t = item.target;
    if (item.set === 'dative') {
      return {
        do: this.cap(t.agent) + ' ' + t.verb + ' ' + t.recipient + ' ' + t.theme + '.',
        po: this.cap(t.agent) + ' ' + t.verb + ' ' + t.theme + ' to ' + t.recipient + '.'
      };
    }
    return {
      active: this.cap(t.agent) + ' ' + t.verb + ' ' + t.patient + '.',
      passive: this.cap(t.patient) + ' was ' + t.verb + ' by ' + t.agent + '.'
    };
  },

  cap: function (s) { return s.charAt(0).toUpperCase() + s.slice(1); },

  buildTrials: function () {
    const trials = [];
    for (let r = 0; r < this.repetitions; r++) {
      this.data.items.forEach((item, i) => {
        const forms = this.formsFor(item.set);
        // alternate which structure primes, so both are tested equally often
        const primeForm = forms[(i + r) % 2];
        trials.push({ item: item, primeForm: primeForm });
      });
    }
    return PTA.shuffleArray(trials);
  },

  start: function () {
    this.state.trials = this.buildTrials();
    this.state.currentTrial = 0;
    this.state.results = [];
    document.getElementById('syntactic-setup').style.display = 'none';
    document.getElementById('syntactic-results').style.display = 'none';
    document.getElementById('syntactic-trial').style.display = 'block';
    this.runTrial();
  },

  runTrial: function () {
    const tr = this.state.trials[this.state.currentTrial];
    if (!tr) { this.showResults(); return; }
    this.state.stage = 'prime';
    document.getElementById('syntactic-progress').textContent =
      'Item ' + (this.state.currentTrial + 1) + ' of ' + this.state.trials.length;
    document.getElementById('syntactic-prime').style.display = 'block';
    document.getElementById('syntactic-choice').style.display = 'none';
    document.getElementById('syntactic-prime-text').textContent = tr.item.prime[tr.primeForm];
  },

  primeDone: function () {
    const tr = this.state.trials[this.state.currentTrial];
    this.state.stage = 'choice';
    document.getElementById('syntactic-prime').style.display = 'none';
    document.getElementById('syntactic-choice').style.display = 'block';

    const t = tr.item.target;
    document.getElementById('syntactic-cue').textContent =
      tr.item.set === 'dative'
        ? [t.agent, t.verb, t.recipient, t.theme].join('  -  ')
        : [t.agent, t.verb, t.patient].join('  -  ');

    const opts = this.optionsFor(tr.item);
    const forms = PTA.shuffleArray(this.formsFor(tr.item.set).slice()); // order counterbalanced
    const box = document.getElementById('syntactic-options');
    box.innerHTML = '';
    forms.forEach(form => {
      const b = document.createElement('button');
      b.className = 'btn btn-secondary';
      b.textContent = opts[form];
      b.style.cssText = 'padding:14px 18px;font-size:1.02rem;line-height:1.5;text-align:right;white-space:normal;';
      b.onclick = () => this.choose(form, opts[form]);
      box.appendChild(b);
    });
    this.state.onset = performance.now();
  },

  choose: function (form, text) {
    // A second click - a double tap, or Enter on a focused button - used to
    // land here after currentTrial had already advanced, throwing on
    // tr.primeForm and, on a slower machine, writing the item twice.
    if (this.state.stage !== 'choice') return;
    const tr = this.state.trials[this.state.currentTrial];
    if (!tr) return;
    this.state.stage = 'locked';
    const box = document.getElementById('syntactic-options');
    if (box) Array.from(box.querySelectorAll('button')).forEach(b => { b.disabled = true; });
    const rt = performance.now() - this.state.onset;
    const matched = form === tr.primeForm;
    const r = {
      trial: this.state.currentTrial + 1,
      set: tr.item.set,
      primeForm: tr.primeForm,
      chosenForm: form,
      chosen: text,
      matched: matched,
      rt: rt
    };
    this.state.results.push(r);
    this.saveTrial(r);
    this.state.currentTrial++;
    setTimeout(() => this.runTrial(), 300);
  },

  saveTrial: function (r) {
    if (!this._participantId) this._participantId = PTA.generateParticipantId();
    const trialData = {
      experiment_id: 'syntactic_priming',
      participant_id: this._participantId,
      trial_number: r.trial,
      language: 'en',
      prime_type: r.primeForm,     // do / po / active / passive
      target: r.set,               // dative / voice
      ink_color: r.set,            // repurposed, kept for older dashboards
      word_meaning: r.chosenForm,  // repurposed: the structure actually chosen
      congruent: r.matched,        // did the choice reuse the primed structure
      response: r.chosen,
      correct: r.matched,          // no right answer; stored so rate queries work
      rt: Math.round(r.rt * 100) / 100,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    };
    if (window.PTA && PTA.saveToSupabase) PTA.saveToSupabase(trialData);
  },

  showResults: function () {
    document.getElementById('syntactic-trial').style.display = 'none';
    document.getElementById('syntactic-results').style.display = 'block';
    const all = this.state.results;
    const rate = set => {
      const s = set ? all.filter(r => r.set === set) : all;
      if (!s.length) return null;
      return Math.round(100 * s.filter(r => r.matched).length / s.length);
    };
    const overall = rate(null);
    const dat = rate('dative');
    const voi = rate('voice');
    const mrt = all.length ? Math.round(PTA.mean(all.map(r => r.rt))) : null;

    document.getElementById('syntactic-results-body').innerHTML =
      '<p>Items completed: ' + all.length + '</p>' +
      '<p>Structure reused - dative items: ' + (dat !== null ? dat + '%' : '-') + '</p>' +
      '<p>Structure reused - active/passive items: ' + (voi !== null ? voi + '%' : '-') + '</p>' +
      '<p style="color:#fbbf24;font-weight:700;">Syntactic priming (D): ' +
        (overall !== null ? overall + '% structure reuse' : '-') +
        (overall !== null ? ' <span style="color:#9aa6b2;font-weight:400;">(50% = no priming)</span>' : '') + '</p>' +
      '<p style="color:#9aa6b2;">Mean decision time: ' + (mrt !== null ? mrt + ' ms' : '-') + '</p>';
  },

  restart: function () { this.open(); this.start(); },

  exportCSV: function () {
    if (!this.state.results.length) { alert('No results to export'); return; }
    const headers = ['item', 'alternation', 'primed_structure', 'chosen_structure',
                     'reused_primed_structure', 'chosen_sentence', 'decision_ms'];
    const rows = this.state.results.map(r =>
      [r.trial, r.set, r.primeForm, r.chosenForm, r.matched, r.chosen, Math.round(r.rt)]);
    const csv = [headers, ...rows].map(row => row.map(c => '"' + c + '"').join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const l = document.createElement('a');
    l.href = URL.createObjectURL(blob);
    l.download = 'syntactic_priming_' + new Date().toISOString().slice(0, 10) + '.csv';
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
    const expId = prompt('Experiment ID (e.g. syntactic_pilot_1):', this.userExperimentId || '');
    if (expId === null) return;
    const reps = prompt('Passes through the item set (1-5):', String(this.repetitions));
    if (reps === null) return;
    this.experimenterEmail = email.trim();
    this.userExperimentId = expId.trim();
    const n = parseInt(reps, 10);
    this.repetitions = (n >= 1 && n <= 5) ? n : this.repetitions;
    const config = {
      template: 'syntactic-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      repetitions: this.repetitions
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
    const link = window.location.href.split('?')[0] + '?syntactic=' + encoded;
    window.prompt('Participant link (copy and send):', link);
  },

  checkUrlConfig: function () {
    const urlParams = new URLSearchParams(window.location.search);
    const raw = urlParams.get('syntactic');
    if (!raw) return false;
    try {
      const config = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (config.template !== 'syntactic-priming') return false;
      this.isParticipantMode = true;
      this.experimenterEmail = config.experimenterEmail || '';
      this.userExperimentId = config.userExperimentId || '';
      this.repetitions = config.repetitions || this.repetitions;
      const layout = document.querySelector('.layout');
      if (layout) layout.style.display = 'none';
      this.open();
      return true;
    } catch (e) {
      console.error('SyntacticPriming: bad participant config', e);
      return false;
    }
  }
};

document.addEventListener('DOMContentLoaded', function () { SyntacticPriming.init(); });
console.log('Syntactic Priming module loaded');
