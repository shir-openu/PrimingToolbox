/**
 * =====================================================
 * PrimingToolbox - Social Priming (V2 _fab)
 * =====================================================
 *
 * Bargh, Chen & Burrows (1996), scrambled-sentence version. Each item is five
 * scrambled words; the participant forms a grammatical four-word sentence.
 * "Prime" items embed an elderly / politeness stereotype word; "neutral" items
 * do not. Priming (ABCD): A = stereotype embedded in the task, B = the task
 * itself, C = baseline behaviour, D = the modulated behaviour.
 *
 * The classic dependent measure (walking speed) is not observable in a browser,
 * so the online-feasible proxy here is item completion latency (time to build
 * each sentence). This substitution is deliberate and surfaced to the user.
 *
 * Self-contained (injects its own overlay). Saves through PTA.saveToSupabase
 * using only existing experiment_results columns.
 *
 * @module Social
 */
window.Social = {

  // Each item: 5 words; a grammatical 4-word sentence can be formed by dropping one.
  data: {
    primeItems: [
      { words: ['he', 'it', 'old', 'was', 'finds'], stereotype: 'old' },
      { words: ['grey', 'the', 'sky', 'seemed', 'runs'], stereotype: 'grey' },
      { words: ['they', 'wise', 'her', 'were', 'jump'], stereotype: 'wise' },
      { words: ['polite', 'she', 'is', 'always', 'green'], stereotype: 'polite' },
      { words: ['forgetful', 'grew', 'he', 'quite', 'car'], stereotype: 'forgetful' },
      { words: ['retired', 'they', 'have', 'now', 'loud'], stereotype: 'retired' }
    ],
    neutralItems: [
      { words: ['she', 'the', 'ball', 'threw', 'clock'], stereotype: null },
      { words: ['we', 'the', 'song', 'heard', 'stone'], stereotype: null },
      { words: ['they', 'a', 'house', 'built', 'quickly'], stereotype: null },
      { words: ['he', 'the', 'letter', 'wrote', 'window'], stereotype: null },
      { words: ['birds', 'the', 'sky', 'crossed', 'yellow'], stereotype: null },
      { words: ['we', 'the', 'river', 'reached', 'table'], stereotype: null }
    ]
  },

  state: {
    trials: [], currentTrial: 0, results: [],
    itemOnset: 0, selection: [], phase: 'setup', openedFromBuilder: false
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  repetitions: 1,
  _initDone: false,

  spec: function () {
    return {
      key: 'social',
      name: 'Social Priming',
      source: 'Bargh, Chen & Burrows (1996)',
      urlParam: 'social',
      template: 'social-priming',
      accent: '#ff9b1e',
      articleAnchor: '#s33',
      defaultExperimentId: 'social_priming',
      startFn: 'Social.start()',
      closeFn: 'Social.close()',
      abcd: {
        A: 'Stereotype words hidden among the scrambled sentences.',
        B: 'The behaviour that follows - in the original, walking speed.',
        C: 'Behaviour after sentences containing no stereotype words.',
        D: 'Behaviour after sentences containing them.'
      },
      characteristics: {
        association: 'The hidden words are associated with a stereotype that is never named.',
        secondariness: 'The words are not required to build the sentences, and you are never told they matter.',
        modulation: 'The activated stereotype shifts the behaviour measured afterwards.'
      },
      boundaryNote:
        'Measurement caveat: the original measured walking speed down a corridor, which a browser cannot ' +
        'observe. The stand-in here is how long each sentence takes to build. That is a weaker proxy, and ' +
        '"Start this one again" resets its clock, so treat the latency as illustrative.',
      instructions: 'Build a grammatical four-word sentence from each set of five words.',
      howToPlay: [
        'You will see <b>five scrambled words</b>.',
        'Click <b>four</b> of them, in the right order, to make a short sentence that makes sense. One word is left over on purpose.',
        'If you misclick, press <b>Start this one again</b> and the set resets.',
        'Work quickly and naturally. There is no scoring and nothing to memorise.'
      ],
      keyLegend: 'Everything is clicked - no keyboard, no time limit.',
      example: '<div style="text-align:center;">' +
        '<div style="color:#9aa6b2;font-size:.82rem;margin-bottom:10px;">You see these five words:</div>' +
        '<div style="font-size:1.15rem;color:#e5e7eb;letter-spacing:.5px;">' +
          'clock &nbsp; she &nbsp; the &nbsp; ball &nbsp; threw</div>' +
        '<div style="color:#4ade80;font-size:1rem;margin-top:12px;">&rarr; click: she &middot; threw &middot; the &middot; ball</div>' +
        '<div style="color:#9aa6b2;font-size:.82rem;margin-top:6px;">&ldquo;clock&rdquo; is the leftover word</div>' +
      '</div>',
      stimulusGroups: [
        { key: 'primeItems', label: 'Stereotype sentence sets', type: 'rows', min: 2,
          fields: [{ key: 'wordsText', label: 'Five words, comma separated' },
                   { key: 'stereotype', label: 'Which word is the cue' }],
          help: 'Five words; four must form a grammatical sentence. One carries the stereotype.' },
        { key: 'neutralItems', label: 'Neutral sentence sets', type: 'rows', min: 2,
          fields: [{ key: 'wordsText', label: 'Five words, comma separated' }],
          help: 'Same structure, no stereotype word. These give the baseline.' }
      ],
      timingFields: [],
      repetitions: { prop: 'repetitions', def: 1, min: 1, max: 5,
                     label: 'Passes through the item set',
                     help: 'Each pass shows every sentence set once.' },
      toConfig: function (mod) { return mod.toConfig(); },
      afterApply: function (mod) { mod.absorbBuilderRows(); },
      asm: function (mod) {
        return {
          instructions: 'Make a grammatical four-word sentence from each set of five words.',
          primes: mod.data.primeItems.map(function (i) { return i.stereotype; }).filter(Boolean),
          targets: ['sentence construction latency'],
          conditions: ['prime', 'neutral'],
          baseline: 'neutral',
          response: { 'click four words in order': 'click' }
        };
      }
    };
  },

  toConfig: function () {
    return {
      template: 'social-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      repetitions: this.repetitions,
      stimuli: { primeItems: this.data.primeItems, neutralItems: this.data.neutralItems }
    };
  },

  /** The builder edits sentence sets as comma-separated text. */
  absorbBuilderRows: function () {
    ['primeItems', 'neutralItems'].forEach(function (key) {
      var rows = this.data[key];
      if (!rows || !rows.length || rows[0].wordsText === undefined) return;
      var rebuilt = [];
      rows.forEach(function (r) {
        var words = String(r.wordsText || '').split(',')
          .map(function (w) { return w.trim(); }).filter(Boolean);
        if (words.length < 5) return;
        rebuilt.push({ words: words, stereotype: (r.stereotype || '').trim() || null });
      });
      if (rebuilt.length >= 2) this.data[key] = rebuilt;
    }, this);
  },

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    PTK.timers(this);
    console.log('Social Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('social-overlay')) return;
    const el = document.createElement('div');
    el.id = 'social-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="social-setup"></div>' +
        '<div id="social-trial" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="social-progress">Item 1</div>' +
          '<div id="social-built" style="min-height:44px;font-size:1.5rem;margin:24px 0;color:#4ade80;letter-spacing:1px;"></div>' +
          '<div id="social-chips" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:20px 0;"></div>' +
          '<button class="btn btn-secondary" onclick="Social.resetItem()">Reset this item</button>' +
        '</div>' +
        '<div id="social-results" style="display:none;">' +
          '<h2 style="color:#ff9b1e;">Complete</h2>' +
          '<div id="social-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<p style="color:#9aa6b2;font-size:.82rem;max-width:520px;margin:10px auto;">Note: online measure is sentence-completion latency, a proxy for the classic walking-speed measure.</p>' +
          '<button class="btn" onclick="Social.exportCSV()">Download CSV</button> ' +
          '<button class="btn" onclick="Social.exportXLSX()">Download Excel</button> ' +
          '<button class="btn" onclick="Social.restart()">Try Again</button> ' +
          '<button class="btn btn-secondary" onclick="Social.close()">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('social-overlay').style.display = 'block';
    PTK.paintSetup('social-setup', this, this.spec());
    document.getElementById('social-setup').style.display = 'block';
    document.getElementById('social-trial').style.display = 'none';
    document.getElementById('social-results').style.display = 'none';
    var p = document.getElementById('social-params');
    if (p) {
      p.textContent = ((this.data.primeItems.length + this.data.neutralItems.length) * this.repetitions) +
        ' sentence sets, in a random order.';
    }
    this.state.phase = 'setup';
  },

  close: function () {
    this._clearTimers();
    const ov = document.getElementById('social-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  buildTrials: function () {
    const all = [];
    for (let r = 0; r < this.repetitions; r++) {
      this.data.primeItems.forEach(it => all.push({ ...it, condition: 'prime' }));
      this.data.neutralItems.forEach(it => all.push({ ...it, condition: 'neutral' }));
    }
    return PTA.shuffleArray(all);
  },

  start: function () {
    this.state.trials = this.buildTrials();
    this.state.currentTrial = 0;
    this.state.results = [];
    document.getElementById('social-setup').style.display = 'none';
    document.getElementById('social-results').style.display = 'none';
    document.getElementById('social-trial').style.display = 'block';
    this.renderItem();
  },

  renderItem: function () {
    const t = this.state.trials[this.state.currentTrial];
    if (!t) { this.showResults(); return; }
    this.state.selection = [];
    this.state.itemOnset = performance.now();
    document.getElementById('social-progress').textContent =
      'Item ' + (this.state.currentTrial + 1) + ' of ' + this.state.trials.length;
    document.getElementById('social-built').textContent = '';

    const chips = document.getElementById('social-chips');
    chips.innerHTML = '';
    PTA.shuffleArray(t.words).forEach(word => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = word;
      b.style.cssText = 'background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:#fff;padding:10px 18px;border-radius:10px;font-size:1.1rem;cursor:pointer;';
      b.onclick = () => this.pickWord(word, b);
      chips.appendChild(b);
    });
  },

  pickWord: function (word, btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.style.opacity = '0.35';
    this.state.selection.push(word);
    document.getElementById('social-built').textContent = this.state.selection.join(' ');
    if (this.state.selection.length >= 4) {
      const rt = performance.now() - this.state.itemOnset;
      this.recordItem(this.state.trials[this.state.currentTrial], this.state.selection.slice(), rt);
    }
  },

  resetItem: function () { this.renderItem(); },

  recordItem: function (t, selection, rt) {
    const congruent = t.condition === 'prime'; // prime = stereotype embedded
    const result = {
      condition: t.condition,
      stereotype: t.stereotype || 'neutral',
      sentence: selection.join(' '),
      congruent: congruent,
      rt: rt
    };
    this.state.results.push(result);
    this.saveTrial(result);
    this.state.currentTrial++;
    this._after(() => this.renderItem(), 350);
  },

  saveTrial: function (result) {
    if (!this._participantId) {
      this._participantId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    const trialData = {
      experiment_id: 'social_priming',
      participant_id: this._participantId,
      trial_number: this.state.currentTrial + 1,
      language: 'en',
      ink_color: result.condition,        // repurposed: prime/neutral condition
      word_meaning: result.stereotype,    // repurposed: embedded stereotype word
      congruent: result.congruent,
      response: result.sentence,
      correct: result.sentence.split(' ').length === 4,
      rt: Math.round(result.rt * 100) / 100,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    };
    if (window.PTA && PTA.saveToSupabase) PTA.saveToSupabase(trialData);
  },

  showResults: function () {
    document.getElementById('social-trial').style.display = 'none';
    document.getElementById('social-results').style.display = 'block';
    const prime = this.state.results.filter(r => r.condition === 'prime').map(r => r.rt);
    const neutral = this.state.results.filter(r => r.condition === 'neutral').map(r => r.rt);
    const mP = prime.length ? Math.round(PTA.mean(prime)) : null;
    const mN = neutral.length ? Math.round(PTA.mean(neutral)) : null;
    const effect = (mP !== null && mN !== null) ? (mP - mN) : null;
    document.getElementById('social-results-body').innerHTML =
      '<p>Items completed: ' + this.state.results.length + '</p>' +
      '<p>Mean completion time — stereotype-primed: ' + (mP !== null ? mP + ' ms' : '—') + '</p>' +
      '<p>Mean completion time — neutral: ' + (mN !== null ? mN + ' ms' : '—') + '</p>' +
      '<p style="color:#4ade80;font-weight:700;">Priming effect (D): ' +
        (effect !== null ? effect + ' ms' + (effect > 0 ? ' (slower after stereotype primes)' : '') : '—') + '</p>';
  },

  restart: function () { this.open(); this.start(); },

  exportCSV: function () {
    if (!this.state.results.length) { alert('No results to export'); return; }
    const headers = ['item', 'condition', 'stereotype_word', 'sentence', 'completion_ms'];
    const rows = this.state.results.map((r, i) => [i + 1, r.condition, r.stereotype, r.sentence, Math.round(r.rt)]);
    const csv = [headers, ...rows].map(row => row.map(c => '"' + c + '"').join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const l = document.createElement('a');
    l.href = URL.createObjectURL(blob);
    l.download = 'social_priming_' + new Date().toISOString().slice(0, 10) + '.csv';
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

  exportXLSX: function () {
    if (!this.state.results.length) { alert('No results to export.'); return; }
    const headers = ['item', 'condition', 'stereotype_word', 'sentence', 'completion_ms'];
    const rows = this.state.results.map((r, i) =>
      [i + 1, r.condition, r.stereotype, r.sentence, Math.round(r.rt)]);
    PTK.exportXLSX(headers, rows, 'social_priming');
  },

  openBuilder: function () {
    this.ensureOverlay();
    this.init();
    var self = this;
    // present the sentence sets in the flat shape the table can edit
    ['primeItems', 'neutralItems'].forEach(function (key) {
      self.data[key] = self.data[key].map(function (it) {
        return it.wordsText !== undefined ? it
          : { wordsText: it.words.join(', '), stereotype: it.stereotype || '' };
      });
    });
    PTK.openBuilder(this, this.spec());
  },

  closeBuilder: function () { PTK.closeBuilder(this.spec(), this); },   // `this` so afterApply runs: closing must leave the module runnable

  checkUrlConfig: function () {
    this.ensureOverlay();
    this.init();
    return PTK.checkUrlConfig(this, this.spec());
  }
};

document.addEventListener('DOMContentLoaded', function () { Social.init(); });
console.log('Social Priming module loaded');
