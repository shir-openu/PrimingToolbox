/**
 * =====================================================
 * PrimingToolbox - Goal (Achievement) Priming (V2 _fab)
 * =====================================================
 *
 * Section 5.2 of the meta-disciplinary framework. Bargh & Gollwitzer (1994);
 * Shah & Kruglanski (2003).
 *
 * Achievement words embedded in a scrambled-sentence task activate a goal
 * without any instruction to pursue it. Participants then work harder and
 * longer on an unrelated puzzle - notably, they keep going after being told
 * they may stop.
 *
 * ABCD: A = achievement words embedded in the sentence task,
 *       B = performance on an unrelated problem-solving task,
 *       C = baseline persistence and accuracy,
 *       D = persistence and accuracy after the achievement cue.
 *
 * ---------------------------------------------------------------------------
 * TWO SUBSTITUTIONS, BOTH DELIBERATE AND BOTH SURFACED TO THE USER
 * ---------------------------------------------------------------------------
 * 1. TASK. Bargh & Gollwitzer used word-search grids. This uses anagrams. The
 *    dependent measure the study cared about - how long people keep working
 *    after being told they may stop - transfers directly, and anagrams are a
 *    standard substitute in the achievement-priming literature. The grid was
 *    not chosen for any property anagrams lack.
 *
 * 2. DESIGN. The original is BETWEEN participants: one person, one condition.
 *    That is still the right design for collecting data, and the builder
 *    offers it. But a single visitor in "Try an Experiment" would then see one
 *    number and no effect, so the default is a WITHIN-participant version:
 *    two blocks, achievement and neutral, order counterbalanced, different
 *    anagram sets. Carry-over is a genuine limitation of that version - an
 *    activated achievement goal does not switch off between blocks - and the
 *    results screen says so rather than hiding it.
 *
 * @module GoalPriming
 * @version 1.0
 * @requires PTA (js/core_fab.js), PTK (js/paradigm_kit_fab.js)
 */
window.GoalPriming = {

  data: {
    // Each set is five words; a grammatical four-word sentence drops one.
    // In the achievement sets one word carries the construct.
    achievementItems: [
      { words: ['he', 'succeed', 'will', 'certainly', 'lamp'], embedded: 'succeed' },
      { words: ['they', 'the', 'race', 'win', 'chair'], embedded: 'win' },
      { words: ['she', 'always', 'strives', 'harder', 'window'], embedded: 'strives' },
      { words: ['we', 'the', 'goal', 'achieved', 'carpet'], embedded: 'achieved' },
      { words: ['he', 'to', 'compete', 'loves', 'spoon'], embedded: 'compete' },
      { words: ['they', 'the', 'subject', 'mastered', 'curtain'], embedded: 'mastered' }
    ],
    neutralItems: [
      { words: ['she', 'the', 'ball', 'threw', 'clock'], embedded: null },
      { words: ['we', 'the', 'song', 'heard', 'stone'], embedded: null },
      { words: ['they', 'a', 'house', 'built', 'quickly'], embedded: null },
      { words: ['he', 'the', 'letter', 'wrote', 'window'], embedded: null },
      { words: ['birds', 'the', 'sky', 'crossed', 'yellow'], embedded: null },
      { words: ['we', 'the', 'river', 'reached', 'table'], embedded: null }
    ],
    // Two length-matched anagram sets, one per block.
    anagramsA: ['GARDEN', 'PLANET', 'SILVER', 'MARKET', 'CANDLE', 'FOREST', 'BUTTER', 'WINTER'],
    anagramsB: ['ORANGE', 'PENCIL', 'MONKEY', 'BASKET', 'FLOWER', 'SUMMER', 'DINNER', 'CASTLE']
  },

  timing: {
    stop_signal_ms: 45000,   // when "you may stop" appears, per block
    max_block_ms: 180000,    // hard ceiling so a block cannot run forever
    iti_ms: 350
  },

  betweenSubjects: false,    // builder switch; see the header
  practiceTrials: 0,

  state: {
    phase: 'setup',
    blocks: [], blockIndex: 0,
    primeItems: [], anagrams: [], anagramIndex: 0,
    blockStart: 0, stopSignalAt: 0, stopShown: false,
    results: [], primeResults: [], openedFromBuilder: false
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  _initDone: false,
  _participantId: '',

  spec: function () {
    var self = this;
    return {
      key: 'goal',
      name: 'Goal Priming',
      source: 'Bargh & Gollwitzer (1994); Shah & Kruglanski (2003)',
      urlParam: 'goal',
      template: 'goal-priming',
      accent: '#f59e0b',
      defaultExperimentId: 'goal_priming',
      startFn: 'GoalPriming.start()',
      closeFn: 'GoalPriming.close()',
      howToPlay: [
        'You will see <b>five scrambled words</b>. Click <b>four</b> of them, in the right order, to make a short sentence that makes sense. The fifth word is left over on purpose.',
        'After a few sentences you will get <b>anagrams</b> &ndash; jumbled letters to unscramble. Type the word and press Enter, or press Skip if nothing comes.',
        'At some point a message appears saying <b>you may stop</b>. You really may &ndash; nothing is lost by stopping. Carry on only if you feel like it.',
        'Then the whole thing runs once more with different words.'
      ],
      keyLegend: 'Nothing to memorise, and there is no time pressure on the sentences.',
      example: '<div style="display:flex;gap:26px;flex-wrap:wrap;justify-content:center;text-align:center;">' +
        '<div>' +
          '<div style="color:#9aa6b2;font-size:.82rem;margin-bottom:8px;">The sentence part</div>' +
          '<div style="font-size:1.05rem;color:#e5e7eb;letter-spacing:.5px;">' +
            '<span style="opacity:.35;">quickly</span> &nbsp; they &nbsp; a &nbsp; house &nbsp; built</div>' +
          '<div style="color:#4ade80;font-size:.9rem;margin-top:8px;">&rarr; &ldquo;they built a house&rdquo;</div>' +
          '<div style="color:#9aa6b2;font-size:.8rem;margin-top:4px;">one word left over</div>' +
        '</div>' +
        '<div>' +
          '<div style="color:#9aa6b2;font-size:.82rem;margin-bottom:8px;">The anagram part</div>' +
          '<div style="font-size:1.5rem;font-weight:700;color:#f59e0b;letter-spacing:8px;">N D G A E R</div>' +
          '<div style="color:#4ade80;font-size:.9rem;margin-top:8px;">&rarr; type GARDEN</div>' +
        '</div>' +
      '</div>',
      abcd: {
        A: 'Achievement words embedded in a scrambled-sentence task.',
        B: 'Performance on an unrelated anagram task.',
        C: 'Baseline persistence: how long you keep going after a neutral prime block.',
        D: 'Persistence after the achievement prime block.'
      },
      characteristics: {
        association: 'Achievement cues activate goal-related representations.',
        secondariness: 'The cues change no incentive and no task rule; you are never told the words matter.',
        modulation: 'Persistence, attempts and accuracy shift after exposure.'
      },
      instructions: 'Build sentences from scrambled words, then solve as many anagrams as you like.',
      stimulusGroups: [
        { key: 'achievementItems', label: 'Achievement sentence sets', type: 'rows', min: 2,
          fields: [{ key: 'wordsText', label: 'Five words, comma separated' },
                   { key: 'embedded', label: 'Which word is the cue' }],
          help: 'Five words per set; four of them must form a grammatical sentence. One word carries the achievement construct.' },
        { key: 'neutralItems', label: 'Neutral sentence sets', type: 'rows', min: 2,
          fields: [{ key: 'wordsText', label: 'Five words, comma separated' }],
          help: 'Same structure, no achievement word. These give the baseline.' },
        { key: 'anagramsA', label: 'Anagrams, block 1', type: 'words', min: 3,
          help: 'Solutions, in capitals. The letters are scrambled for the participant.' },
        { key: 'anagramsB', label: 'Anagrams, block 2', type: 'words', min: 3,
          help: 'A second, length-matched set so the two blocks are not the same puzzles.' }
      ],
      timingFields: [
        { key: 'stop_signal_ms', label: 'Show "you may stop" after', min: 5000, max: 300000, step: 5000,
          help: 'The measure the original study cared about is how long people keep working AFTER this appears.' },
        { key: 'max_block_ms', label: 'Hard block ceiling', min: 10000, max: 900000, step: 10000 },
        { key: 'iti_ms', label: 'Gap between items', min: 0, max: 3000, step: 50 }
      ],
      toConfig: function (mod) { return mod.toConfig(); },
      applyConfig: function (mod, config) {
        if (typeof config.betweenSubjects === 'boolean') mod.betweenSubjects = config.betweenSubjects;
      },
      afterApply: function (mod) { mod.absorbBuilderRows(); },
      asm: function (mod) {
        return {
          instructions: 'Make a sentence from four of the five words, then solve anagrams for as long as you wish.',
          primes: mod.data.achievementItems.map(function (i) { return i.embedded; }).filter(Boolean),
          targets: mod.data.anagramsA.concat(mod.data.anagramsB),
          conditions: ['achievement', 'neutral'],
          baseline: 'neutral',
          response: { 'typed anagram solution': 'text', 'stop working': 'click' }
        };
      }
    };
  },

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    PTK.timers(this);
    console.log('Goal Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('goal-overlay')) return;
    var el = document.createElement('div');
    el.id = 'goal-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="goal-setup"></div>' +
        '<div id="goal-block-intro" style="display:none;"></div>' +
        '<div id="goal-prime" style="display:none;"></div>' +
        '<div id="goal-anagram" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="goal-anagram-progress"></div>' +
          '<div id="goal-anagram-letters" style="font-size:2.6rem;font-weight:700;margin:30px 0;letter-spacing:10px;color:#f59e0b;"></div>' +
          '<input id="goal-anagram-answer" type="text" autocomplete="off" spellcheck="false" ' +
                 'style="font-size:1.5rem;padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.3);' +
                 'background:rgba(255,255,255,.08);color:#fff;text-align:center;letter-spacing:3px;text-transform:uppercase;width:280px;">' +
          '<div style="margin-top:18px;">' +
            '<button class="btn" onclick="GoalPriming.submitAnagram()">Submit</button> ' +
            '<button class="btn btn-secondary" onclick="GoalPriming.skipAnagram()">Skip this one</button>' +
          '</div>' +
          '<div id="goal-stop-notice" style="display:none;margin-top:26px;padding:16px 20px;border-radius:12px;' +
               'background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);max-width:520px;margin-left:auto;margin-right:auto;">' +
            '<div style="color:#fbbf24;line-height:1.7;">You have done enough. You may stop whenever you like, ' +
              'or keep going if you want to.</div>' +
            '<button class="btn btn-secondary" onclick="GoalPriming.stopBlock()" style="margin-top:12px;">Stop now</button>' +
          '</div>' +
        '</div>' +
        '<div id="goal-results" style="display:none;">' +
          '<h2 style="color:#f59e0b;">Complete</h2>' +
          '<div id="goal-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<div id="goal-interpretation"></div>' +
          '<div style="margin-top:20px;">' +
            '<button class="btn" onclick="GoalPriming.exportCSV()">Download CSV</button> ' +
            '<button class="btn" onclick="GoalPriming.exportXLSX()">Download Excel</button> ' +
            '<button class="btn" onclick="GoalPriming.restart()">Try Again</button> ' +
            '<button class="btn btn-secondary" onclick="GoalPriming.close()">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  show: function (which) {
    ['setup', 'block-intro', 'prime', 'anagram', 'results'].forEach(function (s) {
      var n = document.getElementById('goal-' + s);
      if (n) n.style.display = (s === which) ? 'block' : 'none';
    });
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('goal-overlay').style.display = 'block';
    PTK.paintSetup('goal-setup', this, this.spec());
    this.show('setup');
    var p = document.getElementById('goal-params');
    if (p) {
      p.textContent = this.betweenSubjects
        ? 'Between-participants: you will be assigned one condition at random. The effect is computed by comparing participants, not within you.'
        : 'Two blocks, achievement and neutral, in a random order. "You may stop" appears after ' +
          Math.round(this.timing.stop_signal_ms / 1000) + ' s in each block.';
    }
    this.state.phase = 'setup';
  },

  close: function () {
    this._clearTimers();
    var ov = document.getElementById('goal-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  start: function () {
    this.state.results = [];
    this.state.primeResults = [];
    this.state.blockIndex = 0;

    var achievement = { condition: 'achievement', anagramKey: 'anagramsA' };
    var neutral = { condition: 'neutral', anagramKey: 'anagramsB' };
    if (this.betweenSubjects) {
      // one condition, chosen at random, exactly as in the original design
      this.state.blocks = [PTA.shuffleArray([achievement, neutral])[0]];
    } else {
      this.state.blocks = PTA.shuffleArray([achievement, neutral]);
      // counterbalance which anagram set goes with which condition too, so the
      // puzzle set cannot be confounded with the prime
      if (Math.random() < 0.5) {
        this.state.blocks[0].anagramKey = 'anagramsB';
        this.state.blocks[1].anagramKey = 'anagramsA';
      }
    }
    this.runBlock();
  },

  runBlock: function () {
    var self = this;
    var block = this.state.blocks[this.state.blockIndex];
    if (!block) { this.showResults(); return; }

    var intro = document.getElementById('goal-block-intro');
    intro.innerHTML =
      '<h3 style="color:#f59e0b;">Part ' + (this.state.blockIndex + 1) + ' of ' + this.state.blocks.length + '</h3>' +
      '<p style="color:#9aa6b2;line-height:1.7;max-width:520px;margin:16px auto;">' +
        'First some sentences, then some anagrams.</p>';
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
    var items = (block.condition === 'achievement')
      ? this.data.achievementItems : this.data.neutralItems;

    PTK.scrambledPhase({
      mod: this,
      rootId: 'goal-prime',
      items: PTA.shuffleArray(items.slice()),
      pick: 4,
      iti: this.timing.iti_ms,
      onItem: function (item, selection, rt) {
        self.state.primeResults.push({
          block: self.state.blockIndex + 1,
          condition: block.condition,
          embedded: item.embedded || 'none',
          sentence: selection.join(' '),
          rt: rt
        });
      },
      onDone: function () { self.runAnagramPhase(block); }
    });
  },

  scramble: function (word) {
    var letters = word.split('');
    var out = letters.slice();
    // guarantee it does not come back identical
    for (var guard = 0; guard < 20 && out.join('') === word; guard++) {
      out = PTA.shuffleArray(letters);
    }
    return out.join(' ');
  },

  runAnagramPhase: function (block) {
    var self = this;
    this.state.phase = 'anagram';
    this.show('anagram');
    this.state.anagrams = PTA.shuffleArray(this.data[block.anagramKey].slice());
    this.state.anagramIndex = 0;
    this.state.blockStart = performance.now();
    this.state.stopShown = false;
    document.getElementById('goal-stop-notice').style.display = 'none';

    this._after(function () {
      if (self.state.phase !== 'anagram') return;
      self.state.stopShown = true;
      self.state.stopSignalAt = performance.now();
      document.getElementById('goal-stop-notice').style.display = 'block';
    }, this.timing.stop_signal_ms);

    this._after(function () {
      if (self.state.phase === 'anagram') self.stopBlock();
    }, this.timing.max_block_ms);

    this.renderAnagram(block);
  },

  renderAnagram: function (block) {
    var self = this;
    var word = this.state.anagrams[this.state.anagramIndex];
    if (!word) { this.stopBlock(); return; }   // ran out of puzzles
    document.getElementById('goal-anagram-progress').textContent =
      'Anagram ' + (this.state.anagramIndex + 1) + ' of ' + this.state.anagrams.length;
    document.getElementById('goal-anagram-letters').textContent = this.scramble(word);
    var input = document.getElementById('goal-anagram-answer');
    input.value = '';
    input.focus();
    input.onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); self.submitAnagram(); }
    };
    this.state.itemOnset = performance.now();
  },

  submitAnagram: function () {
    var input = document.getElementById('goal-anagram-answer');
    this.recordAnagram((input.value || '').trim().toUpperCase(), false);
  },

  skipAnagram: function () { this.recordAnagram('', true); },

  recordAnagram: function (answer, skipped) {
    if (this.state.phase !== 'anagram') return;
    var self = this;
    var block = this.state.blocks[this.state.blockIndex];
    var word = this.state.anagrams[this.state.anagramIndex];
    if (!word) return;

    var r = {
      block: this.state.blockIndex + 1,
      condition: block.condition,
      item: this.state.anagramIndex + 1,
      solution: word,
      answer: answer,
      solved: answer === word,
      skipped: !!skipped,
      afterStopSignal: this.state.stopShown,
      rt: performance.now() - this.state.itemOnset
    };
    this.state.results.push(r);
    this.saveTrial(r);

    this.state.anagramIndex++;
    this._after(function () {
      if (self.state.phase === 'anagram') self.renderAnagram(block);
    }, this.timing.iti_ms);
  },

  /** End of a block, either because the participant chose to stop, the ceiling
   *  was reached, or the puzzles ran out. */
  stopBlock: function () {
    if (this.state.phase !== 'anagram') return;
    this._clearTimers();
    var block = this.state.blocks[this.state.blockIndex];
    var now = performance.now();
    block.totalMs = now - this.state.blockStart;
    block.persistenceMs = this.state.stopShown ? (now - this.state.stopSignalAt) : 0;
    block.reachedStopSignal = this.state.stopShown;
    this.state.phase = 'between';
    this.state.blockIndex++;
    this.runBlock();
  },

  saveTrial: function (r) {
    PTK.save(PTK.row(this, this.spec(), {
      trial_number: this.state.results.length,
      prime_type: r.condition,
      target: r.solution,
      ink_color: r.condition,                      // repurposed: achievement / neutral
      word_meaning: r.afterStopSignal ? 'after-stop-signal' : 'before-stop-signal',
      congruent: r.condition === 'achievement',
      response: r.answer || null,
      correct: r.solved,
      rt: Math.round(r.rt * 100) / 100
    }));
  },

  analyse: function () {
    var self = this;
    function forCondition(c) {
      var rows = self.state.results.filter(function (r) { return r.condition === c; });
      var block = self.state.blocks.filter(function (b) { return b.condition === c; })[0];
      if (!rows.length && !block) return null;
      return {
        attempted: rows.length,
        solved: rows.filter(function (r) { return r.solved; }).length,
        accuracy: rows.length ? Math.round(100 * rows.filter(function (r) { return r.solved; }).length / rows.length) : null,
        afterSignal: rows.filter(function (r) { return r.afterStopSignal; }).length,
        persistenceS: block && block.persistenceMs !== undefined ? Math.round(block.persistenceMs / 100) / 10 : null,
        reachedSignal: block ? !!block.reachedStopSignal : false
      };
    }
    var a = forCondition('achievement');
    var n = forCondition('neutral');
    return {
      achievement: a, neutral: n,
      persistenceEffect: (a && n && a.persistenceS !== null && n.persistenceS !== null)
        ? Math.round((a.persistenceS - n.persistenceS) * 10) / 10 : null,
      solvedEffect: (a && n) ? (a.solved - n.solved) : null,
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
      return '<p>' + label + ': attempted ' + o.attempted + ', solved ' + o.solved +
        (o.accuracy !== null ? ' (' + o.accuracy + '%)' : '') +
        (o.persistenceS !== null ? ', kept going ' + o.persistenceS + ' s after being told to stop' : '') +
        '</p>';
    };

    var body =
      line('Achievement block', a.achievement) +
      line('Neutral block', a.neutral);

    if (a.betweenSubjects) {
      body += '<p style="color:#9aa6b2;margin-top:14px;">You ran one condition only, which is the original ' +
              'between-participants design. The effect comes from comparing this participant with others, ' +
              'so there is no within-person number to show.</p>';
    } else if (a.persistenceEffect !== null) {
      body += '<p style="color:#f59e0b;font-weight:700;font-size:1.05rem;margin-top:12px;">' +
              'Persistence effect (D &minus; C): ' + a.persistenceEffect + ' s</p>' +
              '<p style="color:#64748b;font-size:.86rem;">Anagrams solved, achievement minus neutral: ' +
              (a.solvedEffect > 0 ? '+' : '') + a.solvedEffect + '</p>';
    }
    document.getElementById('goal-results-body').innerHTML = body;

    document.getElementById('goal-interpretation').innerHTML = a.betweenSubjects
      ? '<p style="color:#9aa6b2;font-size:.92rem;line-height:1.75;max-width:560px;margin:14px auto 0;text-align:left;">' +
        'Your rows are saved with the condition you were assigned, so the comparison can be made once you have ' +
        'collected enough participants.</p>'
      : PTK.interpret({
          effect: a.persistenceEffect,
          unit: 's',
          effectName: 'persistence effect',
          expectedSign: 1,
          n: (a.achievement ? a.achievement.attempted : 0) + (a.neutral ? a.neutral.attempted : 0),
          small: 3,
          note: 'Two caveats worth knowing. The original study used word-search grids, not anagrams. And it ' +
                'ran between participants: here you did both blocks, and an activated achievement goal does not ' +
                'switch off between them, so a within-person number understates the real effect and can even ' +
                'reverse it depending on which block you did first. Use the between-participants setting in the ' +
                'builder for real data collection.'
        });
  },

  restart: function () { this.open(); this.start(); },

  csvParts: function () {
    return {
      headers: ['block', 'condition', 'item', 'solution', 'answer', 'solved', 'skipped',
                'after_stop_signal', 'rt_ms'],
      rows: this.state.results.map(function (r) {
        return [r.block, r.condition, r.item, r.solution, r.answer, r.solved, r.skipped,
                r.afterStopSignal, Math.round(r.rt)];
      })
    };
  },

  exportCSV: function () { var p = this.csvParts(); PTK.exportCSV(p.headers, p.rows, 'goal_priming'); },
  exportXLSX: function () { var p = this.csvParts(); PTK.exportXLSX(p.headers, p.rows, 'goal_priming'); },

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
      template: 'goal-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      betweenSubjects: this.betweenSubjects,
      timing: this.timing,
      stimuli: {
        achievementItems: this.data.achievementItems,
        neutralItems: this.data.neutralItems,
        anagramsA: this.data.anagramsA,
        anagramsB: this.data.anagramsB
      }
    };
  },

  /** The builder edits sentence sets as comma-separated text. */
  absorbBuilderRows: function () {
    ['achievementItems', 'neutralItems'].forEach(function (key) {
      var rows = this.data[key];
      if (!rows || !rows.length) return;
      if (rows[0].wordsText === undefined) return;   // not the flattened form
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
    // present the sentence sets in the flat shape the table can edit
    ['achievementItems', 'neutralItems'].forEach(function (key) {
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

document.addEventListener('DOMContentLoaded', function () { GoalPriming.init(); });
console.log('Goal Priming module loaded');
