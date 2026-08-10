/**
 * =====================================================
 * PrimingToolbox - Money Priming (V2 _fab)
 * =====================================================
 *
 * Section 5.4 of the framework. Vohs, Mead & Goode (2006); Caruso et al. (2017).
 *
 * Money cues embedded in a scrambled-sentence task make people behave more
 * self-sufficiently on a later, unrelated task: they seek less help, offer less
 * help, and prefer to work alone.
 *
 * ABCD: A = money words embedded in the sentence task,
 *       B = economic and interpersonal behaviour,
 *       C = baseline help-seeking and preference for joint work,
 *       D = the same measures after the money cue.
 *
 * SUBSTITUTION, STATED OPENLY. Two of the original dependent measures -
 * physical interpersonal distance and how many chairs a participant sets out -
 * cannot be observed in a browser. The two that can are kept and are the ones
 * measured here:
 *   1. HELP-SEEKING: how long the participant works on an unsolvable anagram
 *      before asking for a hint. Longer = more self-sufficient.
 *   2. PREFERENCE for working alone versus with a partner, asked directly.
 *
 * NOTE ON THE LITERATURE. Caruso et al. (2017) is cited in the framework beside
 * Vohs et al. (2006). It is a large systematic exploration of money-priming
 * manipulations and moderators, and its findings are considerably more mixed
 * than the original. This is one of the paradigms where the replication record
 * matters, and an experimenter should read it before drawing conclusions.
 *
 * Design default is WITHIN participant (two counterbalanced blocks) so a single
 * visitor sees a number; the builder offers the original BETWEEN-participants
 * design for real data collection. Carry-over caveat as in goal_fab.js.
 *
 * @module MoneyPriming
 * @version 1.0
 * @requires PTA (js/core_fab.js), PTK (js/paradigm_kit_fab.js)
 */
window.MoneyPriming = {

  data: {
    moneyItems: [
      { words: ['he', 'the', 'salary', 'raised', 'lamp'], embedded: 'salary' },
      { words: ['she', 'the', 'invoice', 'paid', 'window'], embedded: 'invoice' },
      { words: ['they', 'the', 'profit', 'counted', 'carpet'], embedded: 'profit' },
      { words: ['we', 'the', 'price', 'discussed', 'spoon'], embedded: 'price' },
      { words: ['he', 'a', 'fortune', 'inherited', 'curtain'], embedded: 'fortune' },
      { words: ['she', 'the', 'cash', 'withdrew', 'garden'], embedded: 'cash' }
    ],
    neutralItems: [
      { words: ['she', 'the', 'ball', 'threw', 'clock'], embedded: null },
      { words: ['we', 'the', 'song', 'heard', 'stone'], embedded: null },
      { words: ['they', 'a', 'house', 'built', 'quickly'], embedded: null },
      { words: ['he', 'the', 'letter', 'wrote', 'window'], embedded: null },
      { words: ['birds', 'the', 'sky', 'crossed', 'yellow'], embedded: null },
      { words: ['we', 'the', 'river', 'reached', 'table'], embedded: null }
    ],
    // Deliberately unsolvable letter strings: no English word uses these
    // letters. The dependent measure is how long someone persists before
    // asking for help, so the puzzle must not be solvable by luck.
    unsolvableA: ['QXZJVK', 'WKZQXV'],
    unsolvableB: ['ZQVXKJ', 'XJKVZQ']
  },

  timing: {
    hint_available_ms: 8000,    // the Ask for a hint button appears after this
    max_puzzle_ms: 120000,      // ceiling per puzzle
    iti_ms: 400
  },

  betweenSubjects: false,

  state: {
    phase: 'setup', blocks: [], blockIndex: 0,
    puzzleIndex: 0, puzzleStart: 0, hintShownAt: 0,
    results: [], primeResults: [], preferences: [], openedFromBuilder: false
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  _initDone: false,
  _participantId: '',

  spec: function () {
    return {
      key: 'money',
      name: 'Money Priming',
      source: 'Vohs, Mead & Goode (2006); Caruso et al. (2017)',
      urlParam: 'money',
      template: 'money-priming',
      accent: '#4ade80',
      defaultExperimentId: 'money_priming',
      startFn: 'MoneyPriming.start()',
      closeFn: 'MoneyPriming.close()',
      howToPlay: [
        'You will see <b>five scrambled words</b>. Click <b>four</b> of them, in the right order, to make a short sentence that makes sense. One word is left over on purpose.',
        'After a few sentences you get a <b>word puzzle</b>: jumbled letters to unscramble. Type your answer and press Enter.',
        'A <b>hint button</b> appears after a while. Use it whenever you want, or press <b>Move on</b> instead &ndash; both are perfectly fine.',
        'You will then be asked one question about how you would prefer to work, and the whole thing runs once more.'
      ],
      keyLegend: 'Fair warning, so it is not a trick: the puzzle has no solution. What is being recorded is how long you choose to stay with it, not whether you solve it.',
      example: '<div style="display:flex;gap:26px;flex-wrap:wrap;justify-content:center;text-align:center;">' +
        '<div>' +
          '<div style="color:#9aa6b2;font-size:.82rem;margin-bottom:8px;">The sentence part</div>' +
          '<div style="font-size:1.05rem;color:#e5e7eb;letter-spacing:.5px;">' +
            '<span style="opacity:.35;">stone</span> &nbsp; we &nbsp; the &nbsp; song &nbsp; heard</div>' +
          '<div style="color:#4ade80;font-size:.9rem;margin-top:8px;">&rarr; &ldquo;we heard the song&rdquo;</div>' +
        '</div>' +
        '<div>' +
          '<div style="color:#9aa6b2;font-size:.82rem;margin-bottom:8px;">The puzzle part</div>' +
          '<div style="font-size:1.5rem;font-weight:700;color:#4ade80;letter-spacing:8px;">Q X Z J V K</div>' +
          '<div style="color:#9aa6b2;font-size:.88rem;margin-top:8px;">stay with it, or ask for a hint</div>' +
        '</div>' +
      '</div>',
      abcd: {
        A: 'Money-related words embedded in a scrambled-sentence task.',
        B: 'Help-seeking and the preference for working alone on a later task.',
        C: 'Baseline: asks for help sooner, prefers to work with someone.',
        D: 'After the money cue: waits longer before asking, prefers to work alone.'
      },
      characteristics: {
        association: 'Money cues activate schemas of independence, exchange and self-sufficiency.',
        secondariness: 'The cues are irrelevant to the instructions, goals and rules of the later task.',
        modulation: 'Help-seeking latency and the solo-versus-joint preference shift.'
      },
      boundaryNote:
        'Replication note: Caruso et al. (2017) examined money-priming manipulations systematically and ' +
        'reported a considerably more mixed picture than Vohs et al. (2006). Treat a positive result here ' +
        'as a demonstration of the design, not as evidence the effect is settled.',
      instructions: 'Build sentences from scrambled words, then work on a word puzzle. A hint is available if you want one.',
      stimulusGroups: [
        { key: 'moneyItems', label: 'Money sentence sets', type: 'rows', min: 2,
          fields: [{ key: 'wordsText', label: 'Five words, comma separated' },
                   { key: 'embedded', label: 'Which word is the cue' }],
          help: 'Five words; four form a grammatical sentence. One word carries the money construct.' },
        { key: 'neutralItems', label: 'Neutral sentence sets', type: 'rows', min: 2,
          fields: [{ key: 'wordsText', label: 'Five words, comma separated' }],
          help: 'Same structure, no money word.' },
        { key: 'unsolvableA', label: 'Unsolvable puzzles, block 1', type: 'words', min: 1,
          help: 'These must NOT be solvable - the measure is how long someone persists before asking for help.' },
        { key: 'unsolvableB', label: 'Unsolvable puzzles, block 2', type: 'words', min: 1 }
      ],
      timingFields: [
        { key: 'hint_available_ms', label: 'Hint button appears after', min: 1000, max: 60000, step: 1000 },
        { key: 'max_puzzle_ms', label: 'Puzzle ceiling', min: 10000, max: 600000, step: 10000 },
        { key: 'iti_ms', label: 'Gap between items', min: 0, max: 3000, step: 50 }
      ],
      toConfig: function (mod) { return mod.toConfig(); },
      applyConfig: function (mod, config) {
        if (typeof config.betweenSubjects === 'boolean') mod.betweenSubjects = config.betweenSubjects;
      },
      afterApply: function (mod) { mod.absorbBuilderRows(); },
      asm: function (mod) {
        return {
          instructions: 'Make a sentence from four of the five words, then try to solve a word puzzle.',
          primes: mod.data.moneyItems.map(function (i) { return i.embedded; }).filter(Boolean),
          targets: mod.data.unsolvableA.concat(mod.data.unsolvableB),
          conditions: ['money', 'neutral'],
          baseline: 'neutral',
          response: { 'ask for a hint': 'click', 'give up': 'click', 'work alone or together': 'choice' }
        };
      }
    };
  },

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    PTK.timers(this);
    console.log('Money Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('money-overlay')) return;
    var el = document.createElement('div');
    el.id = 'money-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="money-setup"></div>' +
        '<div id="money-block-intro" style="display:none;"></div>' +
        '<div id="money-prime" style="display:none;"></div>' +
        '<div id="money-puzzle" style="display:none;">' +
          '<div style="color:#64748b;font-size:.8rem;letter-spacing:2px;margin-top:10px;">UNSCRAMBLE THIS WORD</div>' +
          '<div id="money-puzzle-letters" style="font-size:2.6rem;font-weight:700;margin:26px 0;letter-spacing:10px;color:#4ade80;"></div>' +
          '<input id="money-puzzle-answer" type="text" autocomplete="off" spellcheck="false" ' +
                 'style="font-size:1.4rem;padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.3);' +
                 'background:rgba(255,255,255,.08);color:#fff;text-align:center;letter-spacing:3px;text-transform:uppercase;width:280px;">' +
          '<div id="money-puzzle-feedback" style="min-height:22px;margin-top:10px;color:#f87171;font-size:.9rem;"></div>' +
          '<div style="margin-top:14px;">' +
            '<button class="btn" onclick="MoneyPriming.tryAnswer()">Submit</button>' +
          '</div>' +
          '<div id="money-hint-wrap" style="display:none;margin-top:26px;">' +
            '<button class="btn btn-secondary" onclick="MoneyPriming.askHint()">Ask for a hint</button> ' +
            '<button class="btn btn-secondary" onclick="MoneyPriming.giveUp()">Move on</button>' +
          '</div>' +
        '</div>' +
        '<div id="money-preference" style="display:none;">' +
          '<h3 style="color:#4ade80;">One question</h3>' +
          '<p style="color:#9aa6b2;line-height:1.7;max-width:520px;margin:16px auto;">' +
            'If there were another task like that one, how would you rather do it?</p>' +
          '<div id="money-preference-options" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;"></div>' +
        '</div>' +
        '<div id="money-results" style="display:none;">' +
          '<h2 style="color:#4ade80;">Complete</h2>' +
          '<div id="money-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<div id="money-interpretation"></div>' +
          '<div style="margin-top:20px;">' +
            '<button class="btn" onclick="MoneyPriming.exportCSV()">Download CSV</button> ' +
            '<button class="btn" onclick="MoneyPriming.exportXLSX()">Download Excel</button> ' +
            '<button class="btn" onclick="MoneyPriming.restart()">Try Again</button> ' +
            '<button class="btn btn-secondary" onclick="MoneyPriming.close()">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  show: function (which) {
    ['setup', 'block-intro', 'prime', 'puzzle', 'preference', 'results'].forEach(function (s) {
      var n = document.getElementById('money-' + s);
      if (n) n.style.display = (s === which) ? 'block' : 'none';
    });
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('money-overlay').style.display = 'block';
    PTK.paintSetup('money-setup', this, this.spec());
    this.show('setup');
    var p = document.getElementById('money-params');
    if (p) {
      p.textContent = this.betweenSubjects
        ? 'Between-participants: one condition, assigned at random.'
        : 'Two blocks, money and neutral, in a random order. A hint becomes available after ' +
          Math.round(this.timing.hint_available_ms / 1000) + ' s.';
    }
    this.state.phase = 'setup';
  },

  close: function () {
    this._clearTimers();
    var ov = document.getElementById('money-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  start: function () {
    this.state.results = [];
    this.state.primeResults = [];
    this.state.preferences = [];
    this.state.blockIndex = 0;
    var money = { condition: 'money', puzzleKey: 'unsolvableA' };
    var neutral = { condition: 'neutral', puzzleKey: 'unsolvableB' };
    if (this.betweenSubjects) {
      this.state.blocks = [PTA.shuffleArray([money, neutral])[0]];
    } else {
      this.state.blocks = PTA.shuffleArray([money, neutral]);
      if (Math.random() < 0.5) {
        this.state.blocks[0].puzzleKey = 'unsolvableB';
        this.state.blocks[1].puzzleKey = 'unsolvableA';
      }
    }
    this.runBlock();
  },

  runBlock: function () {
    var self = this;
    var block = this.state.blocks[this.state.blockIndex];
    if (!block) { this.showResults(); return; }
    var intro = document.getElementById('money-block-intro');
    intro.innerHTML =
      '<h3 style="color:#4ade80;">Part ' + (this.state.blockIndex + 1) + ' of ' + this.state.blocks.length + '</h3>' +
      '<p style="color:#9aa6b2;line-height:1.7;max-width:520px;margin:16px auto;">Sentences first, then a puzzle.</p>';
    var go = document.createElement('button');
    go.className = 'btn';
    go.textContent = 'Begin';
    go.onclick = function () { self.runPrimePhase(block); };
    intro.appendChild(go);
    this.show('block-intro');
  },

  runPrimePhase: function (block) {
    var self = this;
    this.state.phase = 'prime';
    this.show('prime');
    var items = (block.condition === 'money') ? this.data.moneyItems : this.data.neutralItems;
    PTK.scrambledPhase({
      mod: this,
      rootId: 'money-prime',
      items: PTA.shuffleArray(items.slice()),
      pick: 4,
      iti: this.timing.iti_ms,
      onItem: function (item, selection, rt) {
        self.state.primeResults.push({
          block: self.state.blockIndex + 1, condition: block.condition,
          embedded: item.embedded || 'none', sentence: selection.join(' '), rt: rt
        });
      },
      onDone: function () { self.runPuzzle(block); }
    });
  },

  runPuzzle: function (block) {
    var self = this;
    this.state.phase = 'puzzle';
    this.show('puzzle');
    var pool = this.data[block.puzzleKey];
    var puzzle = pool[Math.floor(Math.random() * pool.length)];
    block.puzzle = puzzle;
    document.getElementById('money-puzzle-letters').textContent = puzzle.split('').join(' ');
    document.getElementById('money-puzzle-answer').value = '';
    document.getElementById('money-puzzle-feedback').textContent = '';
    document.getElementById('money-hint-wrap').style.display = 'none';
    document.getElementById('money-puzzle-answer').focus();
    document.getElementById('money-puzzle-answer').onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); self.tryAnswer(); }
    };

    this.state.puzzleStart = performance.now();
    block.hintAsked = false;
    block.attempts = 0;

    this._after(function () {
      if (self.state.phase !== 'puzzle') return;
      document.getElementById('money-hint-wrap').style.display = 'block';
    }, this.timing.hint_available_ms);

    this._after(function () {
      if (self.state.phase === 'puzzle') self.endPuzzle(block, 'ceiling');
    }, this.timing.max_puzzle_ms);
  },

  tryAnswer: function () {
    if (this.state.phase !== 'puzzle') return;
    var block = this.state.blocks[this.state.blockIndex];
    block.attempts = (block.attempts || 0) + 1;
    var input = document.getElementById('money-puzzle-answer');
    document.getElementById('money-puzzle-feedback').textContent = 'Not quite - keep trying.';
    input.value = '';
    input.focus();
  },

  askHint: function () { this.endPuzzle(this.state.blocks[this.state.blockIndex], 'hint'); },
  giveUp: function () { this.endPuzzle(this.state.blocks[this.state.blockIndex], 'gave-up'); },

  endPuzzle: function (block, how) {
    if (this.state.phase !== 'puzzle') return;
    this._clearTimers();
    block.helpLatencyMs = performance.now() - this.state.puzzleStart;
    block.endedBy = how;
    var r = {
      block: this.state.blockIndex + 1,
      condition: block.condition,
      puzzle: block.puzzle,
      attempts: block.attempts || 0,
      endedBy: how,
      helpLatencyS: Math.round(block.helpLatencyMs / 100) / 10
    };
    this.state.results.push(r);
    this.saveTrial(r);
    this.askPreference(block);
  },

  askPreference: function (block) {
    var self = this;
    this.state.phase = 'preference';
    this.show('preference');
    var box = document.getElementById('money-preference-options');
    box.innerHTML = '';
    [{ k: 'alone', t: 'On my own' }, { k: 'together', t: 'With a partner' }].forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'btn btn-secondary';
      b.textContent = o.t;
      b.style.cssText += ';padding:14px 26px;';
      b.onclick = function () {
        self.state.preferences.push({ block: self.state.blockIndex + 1, condition: block.condition, choice: o.k });
        block.preference = o.k;
        self.state.blockIndex++;
        self.state.phase = 'between';
        self.runBlock();
      };
      box.appendChild(b);
    });
  },

  saveTrial: function (r) {
    PTK.save(PTK.row(this, this.spec(), {
      trial_number: this.state.results.length,
      prime_type: r.condition,
      target: r.puzzle,
      ink_color: r.condition,
      word_meaning: r.endedBy,
      congruent: r.condition === 'money',
      response: r.endedBy,
      correct: null,
      rt: Math.round(r.helpLatencyS * 1000)
    }));
  },

  analyse: function () {
    var self = this;
    function forCondition(c) {
      var row = self.state.results.filter(function (r) { return r.condition === c; })[0];
      var pref = self.state.preferences.filter(function (p) { return p.condition === c; })[0];
      if (!row) return null;
      return { helpLatencyS: row.helpLatencyS, attempts: row.attempts,
               endedBy: row.endedBy, preference: pref ? pref.choice : null };
    }
    var m = forCondition('money'), n = forCondition('neutral');
    return {
      money: m, neutral: n,
      latencyEffect: (m && n) ? Math.round((m.helpLatencyS - n.helpLatencyS) * 10) / 10 : null,
      soloShift: (m && n) ? ((m.preference === 'alone' ? 1 : 0) - (n.preference === 'alone' ? 1 : 0)) : null,
      betweenSubjects: this.betweenSubjects
    };
  },

  showResults: function () {
    this._clearTimers();
    this.state.phase = 'results';
    this.show('results');
    var a = this.analyse();
    var line = function (label, o) {
      if (!o) return '';
      return '<p>' + label + ': worked ' + o.helpLatencyS + ' s before ' +
        (o.endedBy === 'hint' ? 'asking for a hint' : o.endedBy === 'gave-up' ? 'moving on' : 'the time ran out') +
        ', ' + o.attempts + ' attempts, preferred to work ' + (o.preference || '-') + '.</p>';
    };
    var body = line('Money block', a.money) + line('Neutral block', a.neutral);

    if (a.betweenSubjects) {
      body += '<p style="color:#9aa6b2;margin-top:14px;">You ran one condition only - the original ' +
              'between-participants design. The comparison is made across participants.</p>';
    } else if (a.latencyEffect !== null) {
      body += '<p style="color:#4ade80;font-weight:700;font-size:1.05rem;margin-top:12px;">' +
              'Self-sufficiency effect (D &minus; C): ' + a.latencyEffect + ' s longer before asking for help</p>' +
              '<p style="color:#64748b;font-size:.86rem;">Solo-work preference shift: ' +
              (a.soloShift > 0 ? 'toward working alone after the money cue'
                : a.soloShift < 0 ? 'toward working with a partner after the money cue'
                : 'no change') + '</p>';
    }
    document.getElementById('money-results-body').innerHTML = body;

    document.getElementById('money-interpretation').innerHTML = a.betweenSubjects
      ? '<p style="color:#9aa6b2;font-size:.92rem;line-height:1.75;max-width:560px;margin:14px auto 0;text-align:left;">' +
        'Your rows carry the condition you were assigned, so the comparison can be made once enough ' +
        'participants have run.</p>'
      : PTK.interpret({
          effect: a.latencyEffect,
          unit: 's',
          effectName: 'self-sufficiency effect',
          expectedSign: 1,
          n: 2,
          small: 3,
          note: 'This is two puzzles, one per condition, so it is a demonstration and not a measurement. ' +
                'Two further cautions: the puzzle was unsolvable by design, and money priming has a mixed ' +
                'replication record - Caruso et al. (2017) found the effect considerably less robust than ' +
                'Vohs et al. (2006) reported. Use the between-participants setting for real data.'
        });
  },

  restart: function () { this.open(); this.start(); },

  csvParts: function () {
    var prefs = this.state.preferences;
    return {
      headers: ['block', 'condition', 'puzzle', 'attempts', 'ended_by', 'help_latency_s', 'work_preference'],
      rows: this.state.results.map(function (r) {
        var p = prefs.filter(function (x) { return x.block === r.block; })[0];
        return [r.block, r.condition, r.puzzle, r.attempts, r.endedBy, r.helpLatencyS, p ? p.choice : ''];
      })
    };
  },

  exportCSV: function () { var p = this.csvParts(); PTK.exportCSV(p.headers, p.rows, 'money_priming'); },
  exportXLSX: function () { var p = this.csvParts(); PTK.exportXLSX(p.headers, p.rows, 'money_priming'); },

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
      template: 'money-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      betweenSubjects: this.betweenSubjects,
      timing: this.timing,
      stimuli: {
        moneyItems: this.data.moneyItems,
        neutralItems: this.data.neutralItems,
        unsolvableA: this.data.unsolvableA,
        unsolvableB: this.data.unsolvableB
      }
    };
  },

  absorbBuilderRows: function () {
    ['moneyItems', 'neutralItems'].forEach(function (key) {
      var rows = this.data[key];
      if (!rows || !rows.length || rows[0].wordsText === undefined) return;
      var rebuilt = [];
      rows.forEach(function (r) {
        var words = String(r.wordsText || '').split(',')
          .map(function (w) { return w.trim(); }).filter(Boolean);
        if (words.length < 5) return;
        rebuilt.push({ words: words, embedded: (r.embedded || '').trim() || null });
      });
      if (rebuilt.length >= 2) this.data[key] = rebuilt;
    }, this);
  },

  openBuilder: function () {
    this.ensureOverlay();
    this.init();
    var self = this;
    ['moneyItems', 'neutralItems'].forEach(function (key) {
      self.data[key] = self.data[key].map(function (it) {
        return it.wordsText !== undefined ? it
          : { wordsText: it.words.join(', '), embedded: it.embedded || '' };
      });
    });
    PTK.openBuilder(this, this.spec());
  },

  closeBuilder: function () { PTK.closeBuilder(this.spec()); },

  checkUrlConfig: function () {
    this.ensureOverlay();
    this.init();
    return PTK.checkUrlConfig(this, this.spec());
  }
};

document.addEventListener('DOMContentLoaded', function () { MoneyPriming.init(); });
console.log('Money Priming module loaded');
