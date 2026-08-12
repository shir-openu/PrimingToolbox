/**
 * =====================================================
 * PrimingToolbox - Moral Priming (V2 _fab)
 * =====================================================
 *
 * Section 5.3 of the framework. Aquino, Freeman, Reed, Lim & Felps (2009);
 * Shao, Aquino & Freeman (2008).
 *
 * Asking participants to recall and list moral rules - Aquino et al. drew on
 * the Ten Commandments - raises the accessibility of moral identity and shifts
 * later ethical intentions, even though the reminder is no part of the task
 * that follows.
 *
 * ABCD: A = recalling and listing moral rules,
 *       B = decisions in ethically relevant situations,
 *       C = baseline prosocial and ethical choice,
 *       D = the same decisions after the moral reminder.
 *
 * SUBSTITUTION, STATED OPENLY. The outcome here is a set of allocation and
 * intention items answered on a slider or by choice, not behaviour with real
 * stakes. Nothing a browser can offer has real consequences, so what is
 * measured is stated intention. That is a weaker outcome than the original and
 * the results screen says so.
 *
 * Design default is WITHIN participant, two counterbalanced blocks, so a single
 * visitor sees a number. The builder offers the original BETWEEN-participants
 * design. Carry-over is a real limitation of the within version: a moral
 * reminder does not switch off between blocks.
 *
 * @module MoralPriming
 * @version 1.0
 * @requires PTA (js/core_fab.js), PTK (js/paradigm_kit_fab.js)
 */
window.MoralPriming = {

  data: {
    moralPrompt: 'Take a moment and write down as many moral rules as you can recall - ' +
                 'commandments, principles, rules you were taught. One per line.',
    neutralPrompt: 'Take a moment and write down as many books or films as you can recall. ' +
                   'One per line.',
    // Each item: a situation, and the prosocial direction of the slider.
    itemsA: [
      { text: 'You are given 100 tokens to split between yourself and a stranger. How many do you give away?',
        kind: 'allocation', max: 100 },
      { text: 'A colleague asks for help on a task that will take an hour of your own time. How likely are you to help?',
        kind: 'likelihood', max: 100 },
      { text: 'You are undercharged at a shop and notice on the way out. How likely are you to go back and pay?',
        kind: 'likelihood', max: 100 }
    ],
    itemsB: [
      { text: 'You are given 100 tokens to split between yourself and a charity. How many do you give away?',
        kind: 'allocation', max: 100 },
      { text: 'A stranger drops their bag while you are already late. How likely are you to stop and help?',
        kind: 'likelihood', max: 100 },
      { text: 'You could take credit for work a quieter teammate did. How likely are you to correct the record?',
        kind: 'likelihood', max: 100 }
    ]
  },

  timing: {
    recall_ms: 60000,   // ceiling on the listing phase
    iti_ms: 300
  },

  betweenSubjects: false,

  state: {
    phase: 'setup', blocks: [], blockIndex: 0, itemIndex: 0,
    results: [], recalls: [], recallStart: 0, openedFromBuilder: false
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  _initDone: false,
  _participantId: '',

  spec: function () {
    return {
      key: 'moral',
      name: 'Moral Priming',
      source: 'Aquino et al. (2009); Shao et al. (2008)',
      urlParam: 'moral',
      template: 'moral-priming',
      accent: '#d41bb9',
      articleAnchor: '#s53',
      defaultExperimentId: 'moral_priming',
      startFn: 'MoralPriming.start()',
      closeFn: 'MoralPriming.close()',
      howToPlay: [
        'You will be asked to <b>write a short list from memory</b> into a text box &ndash; one item per line. Write as many as come to mind; there is no target number and nobody marks it.',
        'Then you will read a few <b>everyday situations</b>, one at a time.',
        'For each one, move the <b>slider</b> to show what you would actually do. There is no right answer and nothing is scored as correct.',
        'Then it runs once more, with a different list and different situations.'
      ],
      keyLegend: 'Everything is typed or dragged &ndash; no timing, no keyboard shortcuts.',
      example: '<div style="max-width:460px;margin:0 auto;text-align:left;">' +
        '<div style="color:#9aa6b2;font-size:.85rem;margin-bottom:8px;">A situation might read:</div>' +
        '<div style="color:#e5e7eb;font-size:1rem;line-height:1.6;margin-bottom:12px;">' +
          '&ldquo;You are given 100 tokens to split between yourself and a stranger. How many do you give away?&rdquo;</div>' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<span style="color:#64748b;font-size:.8rem;">0</span>' +
          '<div style="flex:1;height:6px;border-radius:999px;background:rgba(255,255,255,.12);position:relative;">' +
            '<div style="position:absolute;left:38%;top:-5px;width:16px;height:16px;border-radius:50%;background:#d41bb9;"></div>' +
          '</div>' +
          '<span style="color:#64748b;font-size:.8rem;">100</span>' +
        '</div>' +
        '<div style="color:#4ade80;font-size:.88rem;margin-top:10px;">Drag anywhere you like, then press Next.</div>' +
      '</div>',
      abcd: {
        A: 'Recalling and listing moral rules.',
        B: 'Decisions in ethically relevant situations.',
        C: 'Baseline: weaker moral-identity activation, lower prosocial intention.',
        D: 'After the reminder: stronger activation, more prosocial choices.'
      },
      characteristics: {
        association: 'Moral words activate moral identity schemas.',
        secondariness: 'The reminder is no part of the decisions that follow and changes none of their terms.',
        modulation: 'Decision tendencies shift toward the prosocial option.'
      },
      boundaryNote:
        'Outcome caveat: these are stated intentions on a slider, not behaviour with real stakes. ' +
        'A browser cannot make a choice cost anything, so the measure is weaker than the original.',
      instructions: 'List what you can recall, then answer a few situations on a slider.',
      stimulusGroups: [
        { key: 'itemsA', label: 'Decision items, block 1', type: 'rows', min: 2,
          fields: [{ key: 'text', label: 'The situation' }],
          help: 'Phrase each so that a HIGHER slider value is the more prosocial answer.' },
        { key: 'itemsB', label: 'Decision items, block 2', type: 'rows', min: 2,
          fields: [{ key: 'text', label: 'The situation' }],
          help: 'A second, comparable set so the two blocks are not the same questions.' }
      ],
      timingFields: [
        { key: 'recall_ms', label: 'Listing phase ceiling', min: 10000, max: 300000, step: 5000 },
        { key: 'iti_ms', label: 'Gap between items', min: 0, max: 3000, step: 50 }
      ],
      toConfig: function (mod) { return mod.toConfig(); },
      applyConfig: function (mod, config) {
        if (typeof config.betweenSubjects === 'boolean') mod.betweenSubjects = config.betweenSubjects;
        if (config.prompts) {
          if (config.prompts.moral) mod.data.moralPrompt = config.prompts.moral;
          if (config.prompts.neutral) mod.data.neutralPrompt = config.prompts.neutral;
        }
      },
      afterApply: function (mod) { mod.normaliseItems(); },
      asm: function (mod) {
        return {
          instructions: 'List what you can recall, then answer each situation.',
          primes: ['moral rules recalled'],
          targets: mod.data.itemsA.concat(mod.data.itemsB).map(function (i) { return i.text; }),
          conditions: ['moral', 'neutral'],
          baseline: 'neutral',
          response: { 'slider 0-100': 'slider' }
        };
      }
    };
  },

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    PTK.timers(this);
    console.log('Moral Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('moral-overlay')) return;
    var el = document.createElement('div');
    el.id = 'moral-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:700px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="moral-setup"></div>' +
        '<div id="moral-recall" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="moral-recall-block"></div>' +
          '<p id="moral-recall-prompt" style="color:#e5e7eb;line-height:1.7;max-width:520px;margin:18px auto;"></p>' +
          '<textarea id="moral-recall-text" rows="8" spellcheck="false" ' +
                    'style="width:100%;max-width:520px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);' +
                    'background:rgba(0,0,0,.32);color:#e5e7eb;font-family:inherit;font-size:1rem;line-height:1.7;"></textarea>' +
          '<div style="margin-top:14px;">' +
            '<button class="btn" onclick="MoralPriming.finishRecall()">Done</button>' +
          '</div>' +
        '</div>' +
        '<div id="moral-items" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="moral-item-progress"></div>' +
          PTK.progressHtml('moral-item-fill') +
          '<p id="moral-item-text" style="color:#e5e7eb;line-height:1.75;max-width:520px;margin:24px auto;font-size:1.08rem;"></p>' +
          '<input id="moral-slider" type="range" min="0" max="100" value="50" ' +
                 'style="width:100%;max-width:440px;accent-color:#d41bb9;">' +
          '<div id="moral-slider-value" style="color:#d41bb9;font-size:1.4rem;font-weight:700;margin-top:10px;">—</div>' +
          '<div id="moral-slider-hint" style="color:#9aa6b2;font-size:.82rem;margin-top:4px;">Move the slider to answer.</div>' +
          '<div style="margin-top:16px;">' +
            '<button class="btn" onclick="MoralPriming.submitItem()">Next</button>' +
          '</div>' +
        '</div>' +
        '<div id="moral-results" style="display:none;">' +
          '<h2 style="color:#d41bb9;">Complete</h2>' +
          '<div id="moral-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<div id="moral-interpretation"></div>' +
          '<div style="margin-top:20px;">' +
            '<button class="btn" onclick="MoralPriming.exportCSV()">Download CSV</button> ' +
            '<button class="btn" onclick="MoralPriming.exportXLSX()">Download Excel</button> ' +
            '<button class="btn" onclick="MoralPriming.restart()">Try Again</button> ' +
            '<button class="btn btn-secondary" onclick="MoralPriming.close()">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    var slider = document.getElementById('moral-slider');
    var self = this;
    slider.oninput = function () {
      // This is the only evidence that an answer was actually given. Without it
      // the reset-to-50 default was recorded as a deliberate midpoint choice.
      self.state.sliderMoved = true;
      document.getElementById('moral-slider-value').textContent = slider.value;
      var hint = document.getElementById('moral-slider-hint');
      if (hint) { hint.textContent = ''; hint.style.color = '#9aa6b2'; }
    };
  },

  show: function (which) {
    ['setup', 'recall', 'items', 'results'].forEach(function (s) {
      var n = document.getElementById('moral-' + s);
      if (n) n.style.display = (s === which) ? 'block' : 'none';
    });
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('moral-overlay').style.display = 'block';
    PTK.paintSetup('moral-setup', this, this.spec());
    this.show('setup');
    var p = document.getElementById('moral-params');
    if (p) {
      p.textContent = this.betweenSubjects
        ? 'Between-participants: one condition, assigned at random.'
        : 'Two blocks, moral and neutral, in a random order, with different situations in each.';
    }
    this.state.phase = 'setup';
  },

  close: function () {
    this._clearTimers();
    var ov = document.getElementById('moral-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  normaliseItems: function () {
    ['itemsA', 'itemsB'].forEach(function (k) {
      this.data[k] = (this.data[k] || [])
        .map(function (i) {
          return typeof i === 'string'
            ? { text: i, kind: 'likelihood', max: 100 }
            : { text: i.text, kind: i.kind || 'likelihood', max: i.max || 100 };
        })
        .filter(function (i) { return i.text && String(i.text).trim(); });
    }, this);
  },

  start: function () {
    this.normaliseItems();
    this.state.results = [];
    this.state.recalls = [];
    this.state.blockIndex = 0;
    var moral = { condition: 'moral', itemKey: 'itemsA' };
    var neutral = { condition: 'neutral', itemKey: 'itemsB' };
    if (this.betweenSubjects) {
      this.state.blocks = [PTA.shuffleArray([moral, neutral])[0]];
    } else {
      this.state.blocks = PTA.shuffleArray([moral, neutral]);
      if (Math.random() < 0.5) {
        this.state.blocks[0].itemKey = 'itemsB';
        this.state.blocks[1].itemKey = 'itemsA';
      }
    }
    this.runBlock();
  },

  runBlock: function () {
    var block = this.state.blocks[this.state.blockIndex];
    if (!block) { this.showResults(); return; }
    var self = this;
    this.state.phase = 'recall';
    this.show('recall');
    document.getElementById('moral-recall-block').textContent =
      'Part ' + (this.state.blockIndex + 1) + ' of ' + this.state.blocks.length;
    document.getElementById('moral-recall-prompt').textContent =
      block.condition === 'moral' ? this.data.moralPrompt : this.data.neutralPrompt;
    var ta = document.getElementById('moral-recall-text');
    ta.value = '';
    ta.focus();
    this.state.recallStart = performance.now();

    this._after(function () {
      if (self.state.phase === 'recall') self.finishRecall();
    }, this.timing.recall_ms);
  },

  finishRecall: function () {
    if (this.state.phase !== 'recall') return;
    this._clearTimers();
    var block = this.state.blocks[this.state.blockIndex];
    var text = document.getElementById('moral-recall-text').value || '';
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    this.state.recalls.push({
      block: this.state.blockIndex + 1,
      condition: block.condition,
      listed: lines.length,
      seconds: Math.round((performance.now() - this.state.recallStart) / 100) / 10
    });
    this.state.itemIndex = 0;
    this.state.phase = 'items';
    this.show('items');
    this.renderItem();
  },

  renderItem: function () {
    var block = this.state.blocks[this.state.blockIndex];
    var items = this.data[block.itemKey];
    var item = items[this.state.itemIndex];
    if (!item) {
      this.state.blockIndex++;
      this.state.phase = 'between';
      this.runBlock();
      return;
    }
    document.getElementById('moral-item-progress').textContent =
      'Situation ' + (this.state.itemIndex + 1) + ' of ' + items.length;
    PTK.setProgress('moral-item-fill', this.state.itemIndex, items.length);
    document.getElementById('moral-item-text').textContent = item.text;
    var slider = document.getElementById('moral-slider');
    slider.value = 50;
    // The slider resets to the midpoint for every item, and submitItem simply
    // read its value - so a participant who never touched it recorded 50, a
    // number indistinguishable from someone who deliberately chose the exact
    // middle. On a prosocial-intention scale the midpoint is a real answer, so
    // this manufactured "neutral" responses out of no response at all, and the
    // faster someone clicked through, the more of them there were.
    this.state.sliderMoved = false;
    document.getElementById('moral-slider-value').textContent = '—';
    var hint = document.getElementById('moral-slider-hint');
    if (hint) hint.textContent = 'Move the slider to answer.';
    this.state.itemOnset = performance.now();
  },

  submitItem: function () {
    if (this.state.phase !== 'items') return;
    var self = this;
    var block = this.state.blocks[this.state.blockIndex];
    var items = this.data[block.itemKey];
    var item = items[this.state.itemIndex];
    if (!item) return;
    // Refuse to record an answer nobody gave. Prompting is the right response
    // rather than storing a flagged 50: the participant is still here and can
    // simply answer, which is better data than a row marked unreliable.
    if (!this.state.sliderMoved) {
      var h = document.getElementById('moral-slider-hint');
      if (h) {
        h.textContent = 'Move the slider first - there is no default answer.';
        h.style.color = '#ff8fa3';
      }
      return;
    }
    var value = parseInt(document.getElementById('moral-slider').value, 10);
    var r = {
      block: this.state.blockIndex + 1,
      condition: block.condition,
      item: this.state.itemIndex + 1,
      text: item.text,
      kind: item.kind,
      value: value,
      rt: performance.now() - this.state.itemOnset
    };
    this.state.results.push(r);
    this.saveTrial(r);
    this.state.itemIndex++;

    // Clear it HERE, not only in renderItem.
    //
    // renderItem runs after the ITI, so between the click and that render the
    // phase is still 'items' and sliderMoved is still true. A second click in
    // that window passed both guards, read items[itemIndex] - which had just
    // advanced - and recorded the NEXT item with the value the participant gave
    // for this one, timed from this one's onset. Not a duplicate: an answer
    // attributed to an item they were never shown.
    //
    // Clearing it here also reads correctly on its own terms. The slider has
    // not been moved for the next item, because the next item has not been
    // asked yet.
    this.state.sliderMoved = false;

    this._after(function () {
      if (self.state.phase === 'items') self.renderItem();
    }, this.timing.iti_ms);
  },

  saveTrial: function (r) {
    PTK.save(PTK.row(this, this.spec(), {
      trial_number: this.state.results.length,
      prime_type: r.condition,
      target: r.kind,
      ink_color: r.condition,
      word_meaning: r.text.slice(0, 120),
      congruent: r.condition === 'moral',
      response: String(r.value),
      correct: null,
      rt: Math.round(r.rt * 100) / 100
    }));
  },

  analyse: function () {
    var self = this;
    function forCondition(c) {
      var rows = self.state.results.filter(function (r) { return r.condition === c; });
      if (!rows.length) return null;
      var recall = self.state.recalls.filter(function (x) { return x.condition === c; })[0];
      return {
        n: rows.length,
        mean: Math.round(PTA.mean(rows.map(function (r) { return r.value; }))),
        listed: recall ? recall.listed : null
      };
    }
    var m = forCondition('moral'), n = forCondition('neutral');
    return {
      moral: m, neutral: n,
      effect: (m && n) ? (m.mean - n.mean) : null,
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
      return '<p>' + label + ': mean response ' + o.mean + ' / 100 across ' + o.n + ' situations' +
        (o.listed !== null ? ', listed ' + o.listed + ' item' + (o.listed === 1 ? '' : 's') + ' from memory' : '') + '</p>';
    };
    var body = line('Moral block', a.moral) + line('Neutral block', a.neutral);

    if (a.betweenSubjects) {
      body += '<p style="color:#9aa6b2;margin-top:14px;">You ran one condition only - the original ' +
              'between-participants design. The comparison is made across participants.</p>';
    } else if (a.effect !== null) {
      body += '<p style="color:#d41bb9;font-weight:700;font-size:1.05rem;margin-top:12px;">' +
              'Moral priming effect (D &minus; C): ' + (a.effect > 0 ? '+' : '') + a.effect + ' points</p>';
    }
    document.getElementById('moral-results-body').innerHTML = body;

    document.getElementById('moral-interpretation').innerHTML = a.betweenSubjects
      ? '<p style="color:#9aa6b2;font-size:.92rem;line-height:1.75;max-width:560px;margin:14px auto 0;text-align:left;">' +
        'Your rows carry the condition you were assigned, so the comparison can be made once enough ' +
        'participants have run.</p>'
      : PTK.interpret({
          effect: a.effect,
          unit: 'points',
          effectName: 'moral priming effect',
          expectedSign: 1,
          n: (a.moral ? a.moral.n : 0) + (a.neutral ? a.neutral.n : 0),
          small: 5,
          note: 'Two limits worth naming. These are stated intentions on a slider, not behaviour with real ' +
                'stakes, which is a weaker outcome than the original used. And the two blocks used different ' +
                'situations, so some of any difference belongs to the questions rather than to the prime - ' +
                'the block order and item sets are counterbalanced to spread that out, not to remove it.'
        });
  },

  restart: function () { this.open(); this.start(); },

  csvParts: function () {
    var recalls = this.state.recalls;
    return {
      headers: ['block', 'condition', 'item', 'situation', 'kind', 'response_0_100',
                'items_listed_in_recall', 'rt_ms'],
      rows: this.state.results.map(function (r) {
        var rec = recalls.filter(function (x) { return x.block === r.block; })[0];
        return [r.block, r.condition, r.item, r.text, r.kind, r.value,
                rec ? rec.listed : '', Math.round(r.rt)];
      })
    };
  },

  exportCSV: function () { var p = this.csvParts(); PTK.exportCSV(p.headers, p.rows, 'moral_priming'); },
  exportXLSX: function () { var p = this.csvParts(); PTK.exportXLSX(p.headers, p.rows, 'moral_priming'); },

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
      template: 'moral-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      betweenSubjects: this.betweenSubjects,
      timing: this.timing,
      prompts: { moral: this.data.moralPrompt, neutral: this.data.neutralPrompt },
      stimuli: { itemsA: this.data.itemsA, itemsB: this.data.itemsB }
    };
  },

  openBuilder: function () {
    this.ensureOverlay();
    this.init();
    this.normaliseItems();
    PTK.openBuilder(this, this.spec());
  },

  closeBuilder: function () { PTK.closeBuilder(this.spec(), this); },   // `this` so afterApply runs: closing must leave the module runnable

  checkUrlConfig: function () {
    this.ensureOverlay();
    this.init();
    return PTK.checkUrlConfig(this, this.spec());
  }
};

document.addEventListener('DOMContentLoaded', function () { MoralPriming.init(); });
console.log('Moral Priming module loaded');
