/**
 * =====================================================
 * PrimingToolbox - Syntactic (Structural) Priming (V2 _fab)
 * =====================================================
 *
 * Bock (1986). The participant reads a prime sentence built on one of two
 * structures, then describes a new event by choosing between the same two
 * structures. People tend to reuse the structure they just read, even though
 * both options mean the same thing and share no content words.
 *
 * Two alternations:
 *   dative : double-object   "the girl gave the boy a book"      (do)
 *            prepositional   "the girl gave a book to the boy"   (po, marked)
 *   voice  : active          "the dog chased the postman"        (active)
 *            passive         "the postman was chased by the dog" (passive, marked)
 *
 * ABCD: A = the structure of the prime, B = the description task,
 *       C = baseline structure choice, D = structure choice after the prime.
 *
 * ---------------------------------------------------------------------------
 * HOW THE EFFECT IS SCORED, AND WHY IT CHANGED (2026-08-10)
 * ---------------------------------------------------------------------------
 * The previous version reported "% structure reuse" and told the participant
 * that "50% = no priming". That is wrong, and the framework paper says why:
 * for Bock (1986), C is defined as "participants spontaneously use active or
 * passive forms according to natural distribution (MOSTLY ACTIVE)". Against a
 * baseline that is already heavily skewed toward active and double-object,
 * 50% is not the null - a participant who simply always picks the active form
 * scores 50% reuse while showing no priming whatsoever.
 *
 * This version reports the standard, baseline-free contrast instead:
 *
 *     effect = P(marked form | marked form was primed)
 *            - P(marked form | unmarked form was primed)
 *
 * The natural bias appears identically in both terms and cancels, so what is
 * left is the priming effect alone. Zero means no priming, whatever the
 * participant's underlying preference. The raw preference is reported
 * separately, because it is interesting rather than a confound.
 *
 * Previous version of this file (never published to GitHub; local branch
 * v2-four-paradigms): git show d313317:js/syntactic_fab.js
 *
 * @module SyntacticPriming
 * @version 2.0
 * @requires PTA (js/core_fab.js), PTK (js/paradigm_kit_fab.js)
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

  // The less-frequent member of each alternation. The effect is measured on
  // these, because they are the ones with room to move.
  marked: { dative: 'po', voice: 'passive' },

  state: {
    trials: [], currentTrial: 0, phase: 'setup', stage: 'prime',
    onset: 0, results: [], openedFromBuilder: false, isPractice: false
  },

  // Self-paced task, so the window is a safety net rather than a deadline:
  // it exists so a participant who walks away is recorded rather than leaving
  // the run open forever.
  timing: { iti_ms: 300, response_window_ms: 120000 },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  repetitions: 1,
  practiceTrials: 2,
  _initDone: false,
  _participantId: '',

  /** The spec PTK builds the Template Builder and the participant link from. */
  spec: function () {
    var self = this;
    return {
      key: 'syntactic',
      name: 'Syntactic Priming',
      source: 'Bock (1986); Pickering & Ferreira (2008)',
      urlParam: 'syntactic',
      template: 'syntactic-priming',
      accent: '#fbbf24',
      defaultExperimentId: 'syntactic_priming',
      startFn: 'SyntacticPriming.start()',
      closeFn: 'SyntacticPriming.close()',
      howToPlay: [
        'You will read <b>one sentence</b> on screen. Just read it, then press the button to say you have.',
        'Next you will see a few words describing a <b>new, unrelated event</b>.',
        'Two ways of saying that event are offered. <b>Both are correct English.</b> Click whichever feels more natural to you.',
        'There is <b>no right answer</b> and nothing is scored as correct. A couple of practice items run first.'
      ],
      keyLegend: 'Everything is clicked, and you can take as long as you like.',
      example: '<div style="max-width:520px;margin:0 auto;text-align:left;">' +
        '<div style="color:#9aa6b2;font-size:.82rem;margin-bottom:6px;">You read:</div>' +
        '<div style="color:#e5e7eb;font-size:1.02rem;margin-bottom:14px;">' +
          '&ldquo;The waiter handed a menu to the customer.&rdquo;</div>' +
        '<div style="color:#9aa6b2;font-size:.82rem;margin-bottom:6px;">Then describe:  the farmer &ndash; sold &ndash; the neighbour &ndash; a tractor</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">' +
          '<div style="border:1px solid rgba(255,255,255,.22);border-radius:9px;padding:10px 13px;color:#e5e7eb;font-size:.95rem;">' +
            'The farmer sold the neighbour a tractor.</div>' +
          '<div style="border:1px solid rgba(255,255,255,.22);border-radius:9px;padding:10px 13px;color:#e5e7eb;font-size:.95rem;">' +
            'The farmer sold a tractor to the neighbour.</div>' +
        '</div>' +
        '<div style="color:#4ade80;font-size:.88rem;margin-top:10px;">Pick either. Most people lean toward the ' +
          'shape they just read &ndash; that leaning is the effect.</div>' +
      '</div>',
      abcd: {
        A: 'The syntactic structure of the sentence just read.',
        B: 'Describing a new, unrelated event.',
        C: 'Structure choice with no prime - the natural distribution, mostly active / double-object.',
        D: 'Structure choice after the prime.'
      },
      characteristics: {
        association: 'The prime structure activates stored grammatical representations.',
        secondariness: 'The structure is not required to describe the target event; it is secondary to the message.',
        modulation: 'The prime shifts the probability of selecting that structure.'
      },
      instructions: 'Read a sentence, then choose the more natural way to describe a new event. Both options are correct English.',
      stimulusGroups: [{
        key: 'items',
        label: 'Prime sentences and target events',
        type: 'rows',
        min: 2,
        fields: [
          { key: 'set', label: 'dative | voice' },
          { key: 'primeA', label: 'Prime, unmarked form' },
          { key: 'primeB', label: 'Prime, marked form' },
          { key: 'agent', label: 'Agent' },
          { key: 'verb', label: 'Verb (past tense)' },
          { key: 'other', label: 'Patient  /  recipient + theme' }
        ],
        help: 'For "voice" items put the patient in the last box. For "dative" items put recipient and theme separated by a comma, e.g. "the neighbour, a tractor".'
      }],
      timingFields: [
        { key: 'iti_ms', label: 'Gap between items', min: 0, max: 3000, step: 50 },
        { key: 'response_window_ms', label: 'Safety time-out', min: 5000, max: 600000, step: 5000,
          help: 'Self-paced task. This only catches a participant who leaves mid-run.' }
      ],
      practice: { def: 2 },
      repetitions: { prop: 'repetitions', def: 1, min: 1, max: 5,
                     label: 'Passes through the item set',
                     help: 'Each pass shows every item once, with the primed structure alternating so both are tested equally.' },
      toConfig: function (mod) { return mod.toConfig(); },
      applyConfig: function (mod, config) {
        if (config.marked) mod.marked = config.marked;
      },
      asm: function (mod) {
        var items = mod.data.items || [];
        return {
          instructions: 'Read a sentence, then describe a new event. Both offered wordings are correct English.',
          primes: items.map(function (it) { return mod.primeText(it, mod.formsFor(it.set)[0]); }),
          targets: items.map(function (it) { return mod.cueText(it); }),
          conditions: ['primed-marked', 'primed-unmarked'],
          baseline: 'primed-unmarked',
          response: { 'unmarked structure': 'click', 'marked structure': 'click' }
        };
      }
    };
  },

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    PTK.timers(this);
    console.log('Syntactic Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('syntactic-overlay')) return;
    var el = document.createElement('div');
    el.id = 'syntactic-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="syntactic-setup"></div>' +
        '<div id="syntactic-trial" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="syntactic-progress">Item 1</div>' +
          PTK.progressHtml('syntactic-progress-fill') +
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
          '<div id="syntactic-interpretation"></div>' +
          '<div style="margin-top:20px;">' +
            '<button class="btn" onclick="SyntacticPriming.exportCSV()">Download CSV</button> ' +
            '<button class="btn" onclick="SyntacticPriming.exportXLSX()">Download Excel</button> ' +
            '<button class="btn" onclick="SyntacticPriming.restart()">Try Again</button> ' +
            '<button class="btn btn-secondary" onclick="SyntacticPriming.close()">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('syntactic-overlay').style.display = 'block';
    // paintSetup first: it creates the #syntactic-params element filled below.
    PTK.paintSetup('syntactic-setup', this, this.spec());
    document.getElementById('syntactic-setup').style.display = 'block';
    document.getElementById('syntactic-trial').style.display = 'none';
    document.getElementById('syntactic-results').style.display = 'none';
    // Requirement 4: the setup screen states the live parameters, so an
    // experimenter can see that what they configured is what will run.
    var n = this.data.items.length * this.repetitions;
    document.getElementById('syntactic-params').textContent =
      n + ' scored items (' + this.data.items.length + ' sentences x ' + this.repetitions + ' pass' +
      (this.repetitions === 1 ? '' : 'es') + ')' +
      (this.practiceTrials ? ', after ' + this.practiceTrials + ' practice items' : '') +
      '. Gap between items ' + this.timing.iti_ms + ' ms.';
    this.state.phase = 'setup';
  },

  close: function () {
    this._clearTimers();
    var ov = document.getElementById('syntactic-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  /** [unmarked, marked] for an alternation. */
  formsFor: function (set) {
    return set === 'dative' ? ['do', 'po'] : ['active', 'passive'];
  },

  primeText: function (item, form) {
    return (item.prime && item.prime[form]) || '';
  },

  cueText: function (item) {
    var t = item.target || {};
    return item.set === 'dative'
      ? [t.agent, t.verb, t.recipient, t.theme].join('  -  ')
      : [t.agent, t.verb, t.patient].join('  -  ');
  },

  optionsFor: function (item) {
    var t = item.target;
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

  cap: function (s) { return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1); },

  buildTrials: function (isPractice, howMany) {
    var self = this;
    var trials = [];
    var passes = isPractice ? 1 : this.repetitions;
    for (var r = 0; r < passes; r++) {
      this.data.items.forEach(function (item, i) {
        var forms = self.formsFor(item.set);
        // Alternate which structure primes so both are tested equally often.
        var primeForm = forms[(i + r) % 2];
        trials.push({ item: item, primeForm: primeForm, isPractice: !!isPractice });
      });
    }
    trials = PTA.shuffleArray(trials);
    return (isPractice && howMany) ? trials.slice(0, howMany) : trials;
  },

  start: function () {
    this.state.results = [];
    this.state.currentTrial = 0;
    document.getElementById('syntactic-setup').style.display = 'none';
    document.getElementById('syntactic-results').style.display = 'none';
    document.getElementById('syntactic-trial').style.display = 'block';

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

  runTrial: function () {
    this._clearTimers();
    var tr = this.state.trials[this.state.currentTrial];
    if (!tr) {
      if (this.state.isPractice) {
        var self = this;
        document.getElementById('syntactic-prime').style.display = 'none';
        document.getElementById('syntactic-choice').style.display = 'none';
        var cue = document.getElementById('syntactic-cue');
        cue.textContent = '';
        var box = document.getElementById('syntactic-options');
        box.innerHTML = '<p style="color:#9aa6b2;line-height:1.8;">Practice finished. The real items start now - ' +
                        'they are not scored any differently, just keep answering naturally.</p>';
        var go = document.createElement('button');
        go.className = 'btn';
        go.textContent = 'Begin';
        go.onclick = function () { self.beginScored(); };
        box.appendChild(go);
        document.getElementById('syntactic-choice').style.display = 'block';
        return;
      }
      this.showResults();
      return;
    }

    this.state.stage = 'prime';
    var label = this.state.isPractice ? 'Practice ' : '';
    document.getElementById('syntactic-progress').textContent =
      label + 'item ' + (this.state.currentTrial + 1) + ' of ' + this.state.trials.length;
    PTK.setProgress('syntactic-progress-fill', this.state.currentTrial, this.state.trials.length);
    document.getElementById('syntactic-prime').style.display = 'block';
    document.getElementById('syntactic-choice').style.display = 'none';
    document.getElementById('syntactic-prime-text').textContent =
      this.primeText(tr.item, tr.primeForm);
  },

  primeDone: function () {
    var self = this;
    var tr = this.state.trials[this.state.currentTrial];
    if (!tr) return;
    this.state.stage = 'choice';
    document.getElementById('syntactic-prime').style.display = 'none';
    document.getElementById('syntactic-choice').style.display = 'block';
    document.getElementById('syntactic-cue').textContent = this.cueText(tr.item);

    var opts = this.optionsFor(tr.item);
    var forms = PTA.shuffleArray(this.formsFor(tr.item.set).slice()); // order counterbalanced
    var box = document.getElementById('syntactic-options');
    box.innerHTML = '';
    forms.forEach(function (form) {
      var b = document.createElement('button');
      b.className = 'btn btn-secondary';
      b.textContent = opts[form];
      // text-align:left - these are English sentences. The previous version
      // right-aligned them, a leftover from a Hebrew layout.
      b.style.cssText = 'padding:14px 18px;font-size:1.02rem;line-height:1.5;text-align:left;white-space:normal;';
      b.onclick = function () { self.choose(form, opts[form]); };
      box.appendChild(b);
    });
    this.state.onset = performance.now();

    // Safety net, scoped to this item and cancelled the moment it is answered.
    var myTrial = this.state.currentTrial;
    this._after(function () {
      if (self.state.stage === 'choice' && self.state.currentTrial === myTrial) {
        self.choose(null, null, true);
      }
    }, this.timing.response_window_ms);
  },

  choose: function (form, text, timedOut) {
    // A second click - a double tap, or Enter on a focused button - used to
    // land here after currentTrial had already advanced.
    if (this.state.stage !== 'choice') return;
    var tr = this.state.trials[this.state.currentTrial];
    if (!tr) return;
    this.state.stage = 'locked';
    this._clearTimers();

    var box = document.getElementById('syntactic-options');
    if (box) Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.disabled = true; });

    var forms = this.formsFor(tr.item.set);
    var markedForm = this.marked[tr.item.set];
    var r = {
      trial: this.state.currentTrial + 1,
      isPractice: !!tr.isPractice,
      set: tr.item.set,
      primeForm: tr.primeForm,
      primedMarked: tr.primeForm === markedForm,
      chosenForm: timedOut ? null : form,
      chose: timedOut ? '' : text,
      choseMarked: timedOut ? null : (form === markedForm),
      matched: timedOut ? null : (form === tr.primeForm),
      timedOut: !!timedOut,
      rt: timedOut ? null : (performance.now() - this.state.onset)
    };

    // Practice items are shown, then discarded.
    if (!tr.isPractice) {
      this.state.results.push(r);
      this.saveTrial(r);
    }

    this.state.currentTrial++;
    var self = this;
    this._after(function () { self.runTrial(); }, this.timing.iti_ms);
  },

  saveTrial: function (r) {
    PTK.save(PTK.row(this, this.spec(), {
      trial_number: r.trial,
      prime_type: r.primeForm,          // do / po / active / passive
      target: r.set,                    // dative / voice
      ink_color: r.set,                 // repurposed, kept for older dashboards
      word_meaning: r.chosenForm,       // repurposed: the structure chosen
      congruent: r.primedMarked,        // was the marked structure the prime
      response: r.chose,
      correct: r.choseMarked,           // no right answer; stored so rate queries work
      rt: r.rt === null ? null : Math.round(r.rt * 100) / 100
    }));
  },

  /**
   * The baseline-free contrast. See the file header for why "% reuse vs 50%"
   * was wrong.
   * @returns {Object} rates per alternation plus the overall effect
   */
  analyse: function () {
    var self = this;
    var answered = this.state.results.filter(function (r) { return !r.timedOut && r.chosenForm; });

    function rate(rows) {
      if (!rows.length) return null;
      return 100 * rows.filter(function (r) { return r.choseMarked; }).length / rows.length;
    }
    function forSet(set) {
      var rows = set ? answered.filter(function (r) { return r.set === set; }) : answered;
      var afterMarked = rows.filter(function (r) { return r.primedMarked; });
      var afterUnmarked = rows.filter(function (r) { return !r.primedMarked; });
      var a = rate(afterMarked), u = rate(afterUnmarked);
      return {
        n: rows.length,
        nAfterMarked: afterMarked.length,
        nAfterUnmarked: afterUnmarked.length,
        afterMarked: a === null ? null : Math.round(a),
        afterUnmarked: u === null ? null : Math.round(u),
        effect: (a === null || u === null) ? null : Math.round(a - u),
        preference: rate(rows) === null ? null : Math.round(rate(rows))
      };
    }
    return {
      overall: forSet(null),
      dative: forSet('dative'),
      voice: forSet('voice'),
      answered: answered.length,
      timedOut: this.state.results.filter(function (r) { return r.timedOut; }).length
    };
  },

  showResults: function () {
    this._clearTimers();
    document.getElementById('syntactic-trial').style.display = 'none';
    document.getElementById('syntactic-results').style.display = 'block';
    PTK.setProgress('syntactic-progress-fill', 1, 1);

    var a = this.analyse();
    var pct = function (v) { return v === null ? '-' : v + '%'; };

    document.getElementById('syntactic-results-body').innerHTML =
      '<p>Items answered: ' + a.answered +
        (a.timedOut ? ' &nbsp;|&nbsp; timed out: ' + a.timedOut : '') + '</p>' +
      '<p style="color:#9aa6b2;font-size:.92rem;">Chose the less common structure after it was primed: ' +
        pct(a.overall.afterMarked) + '</p>' +
      '<p style="color:#9aa6b2;font-size:.92rem;">Chose it after the OTHER structure was primed: ' +
        pct(a.overall.afterUnmarked) + '</p>' +
      '<p style="color:#fbbf24;font-weight:700;font-size:1.05rem;margin-top:10px;">' +
        'Syntactic priming effect (D &minus; C): ' +
        (a.overall.effect === null ? '-' : a.overall.effect + ' percentage points') + '</p>' +
      '<p style="color:#64748b;font-size:.86rem;">Dative items: ' +
        (a.dative.effect === null ? '-' : a.dative.effect + ' pp') +
        ' &nbsp;|&nbsp; active/passive items: ' +
        (a.voice.effect === null ? '-' : a.voice.effect + ' pp') + '</p>' +
      '<p style="color:#64748b;font-size:.86rem;">Your overall preference for the less common structure, ' +
        'ignoring the prime: ' + pct(a.overall.preference) + '. This is the natural bias the effect above ' +
        'is measured against, and it cancels out of it.</p>';

    document.getElementById('syntactic-interpretation').innerHTML = PTK.interpret({
      effect: a.overall.effect,
      unit: 'percentage points',
      effectName: 'syntactic priming effect',
      expectedSign: 1,
      n: a.answered,
      small: 8,
      note: 'Zero means the prime made no difference to which structure you picked. ' +
            'Because the effect is a difference between two prime conditions, your own preference ' +
            'for one structure over the other cannot inflate or deflate it.'
    });
  },

  restart: function () { this.open(); this.start(); },

  csvParts: function () {
    return {
      headers: ['item', 'alternation', 'primed_structure', 'primed_marked_form',
                'chosen_structure', 'chose_marked_form', 'reused_primed_structure',
                'chosen_sentence', 'timed_out', 'decision_ms'],
      rows: this.state.results.map(function (r) {
        return [r.trial, r.set, r.primeForm, r.primedMarked, r.chosenForm, r.choseMarked,
                r.matched, r.chose, r.timedOut, r.rt === null ? '' : Math.round(r.rt)];
      })
    };
  },

  exportCSV: function () {
    var p = this.csvParts();
    PTK.exportCSV(p.headers, p.rows, 'syntactic_priming');
  },

  exportXLSX: function () {
    var p = this.csvParts();
    PTK.exportXLSX(p.headers, p.rows, 'syntactic_priming');
  },

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

  /** Stimuli travel with the link, so builder edits actually reach participants. */
  toConfig: function () {
    return {
      template: 'syntactic-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      repetitions: this.repetitions,
      practiceTrials: this.practiceTrials,
      marked: this.marked,
      timing: this.timing,
      stimuli: { items: this.data.items }
    };
  },

  openBuilder: function () {
    this.ensureOverlay();
    this.init();
    PTK.openBuilder(this, this.builderSpec());
  },

  closeBuilder: function () { PTK.closeBuilder(this.spec()); },

  /**
   * The builder edits a flattened view of data.items, because the nested
   * prime/target shape is unusable in a table. Converted back on apply.
   */
  builderSpec: function () {
    var self = this;
    var s = this.spec();

    s.stimulusGroups = [{
      key: '_flatItems',
      label: 'Prime sentences and target events',
      type: 'rows',
      min: 2,
      fields: s.stimulusGroups[0].fields,
      help: s.stimulusGroups[0].help
    }];

    // Present a flat copy for editing.
    this.data._flatItems = this.data.items.map(function (it) {
      var forms = self.formsFor(it.set);
      var t = it.target || {};
      return {
        set: it.set,
        primeA: it.prime[forms[0]] || '',
        primeB: it.prime[forms[1]] || '',
        agent: t.agent || '',
        verb: t.verb || '',
        other: it.set === 'dative' ? [t.recipient, t.theme].join(', ') : (t.patient || '')
      };
    });

    // PTK calls this at the end of every apply, so preview, link generation
    // and the A/S/M check all see the rebuilt items rather than the stale ones.
    s.afterApply = function (mod) { mod.absorbFlatItems(); };
    return s;
  },

  /** Fold the builder's flat table back into the nested item shape. */
  absorbFlatItems: function () {
    var flat = this.data._flatItems;
    if (!flat || !flat.length) return;
    var self = this;
    var rebuilt = [];
    flat.forEach(function (f) {
      var set = (String(f.set || '').trim().toLowerCase() === 'dative') ? 'dative' : 'voice';
      var forms = self.formsFor(set);
      var prime = {};
      prime[forms[0]] = String(f.primeA || '').trim();
      prime[forms[1]] = String(f.primeB || '').trim();
      if (!prime[forms[0]] || !prime[forms[1]]) return;

      var target = { agent: String(f.agent || '').trim(), verb: String(f.verb || '').trim() };
      var other = String(f.other || '').trim();
      if (set === 'dative') {
        var bits = other.split(',');
        target.recipient = (bits[0] || '').trim();
        target.theme = (bits[1] || '').trim();
        if (!target.recipient || !target.theme) return;
      } else {
        target.patient = other;
        if (!target.patient) return;
      }
      if (!target.agent || !target.verb) return;
      rebuilt.push({ set: set, prime: prime, target: target });
    });
    if (rebuilt.length >= 2) this.data.items = rebuilt;
  },

  checkUrlConfig: function () {
    this.ensureOverlay();
    this.init();
    return PTK.checkUrlConfig(this, this.spec());
  }
};

document.addEventListener('DOMContentLoaded', function () { SyntacticPriming.init(); });
console.log('Syntactic Priming module loaded');
