/*
 * PREVIOUS VERSIONS ON GITHUB, newest first. Every change to this file adds a
 * line here, so any earlier state can be recovered if something goes wrong.
 *
 *   before the experimenter-layer event logging, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/e93dccf/js/scratch_builder_fab.js
 */
/**
 * =====================================================
 * PrimingToolbox - Build From Scratch (V2 _fab)
 * =====================================================
 *
 * Every other builder in this toolbox starts from a finished paradigm: you
 * open Stroop, or Semantic Priming, and edit the stimuli it already has. This
 * module starts from nothing. It asks for the pieces an online experiment
 * actually needs, assembles them into the same config object the rest of the
 * platform speaks, and hands back a participant link.
 *
 * One module, two pages:
 *
 *   build/from-scratch.html   mode 'full'      -> timing is typed in numbers
 *   build/timeline.html       mode 'timeline'  -> timing comes from the drag
 *                                                 timeline (TimelinePlanner),
 *                                                 which is shown first
 *
 * Everything else on the two pages is identical, which is the point of putting
 * it here rather than in two <script> blocks that would drift apart.
 *
 * WHAT IT PRODUCES
 * ----------------
 * A config for PTA.Engine's generic (non-Stroop) path:
 *
 *   { id, name, description, type:'custom',
 *     primes:{type:'text', items:[...]}, targets:{type:'text', items:[...]},
 *     trials:{ randomize, repetitions, pairings:[{primeIndex,targetIndex,condition,correctResponse}] },
 *     conditions:[...], baseline:'<condition name>' | undefined,
 *     presentation:{...ms...}, response:{type:'key_press', keys:{label:KEY}},
 *     feedback:{...}, data:{save_to_supabase, table_name},
 *     experimenter:{email, experiment_id},
 *     abcd:{...the author's own declaration, optional...} }
 *
 * The pairings list is what makes conditions possible: without it the engine
 * pairs every prime with every target, which is not a design.
 *
 * THE ABCD DECLARATION (optional, section 7)
 * ------------------------------------------
 * The platform can already CHECK a design against the definition
 * (js/asm_validator.js reads the config and reports on association,
 * secondariness and modulation). What it could not do is let the author SAY
 * what they think A, B, C and D are. That declaration is what this section
 * collects, and it is optional on purpose: an experiment runs either way.
 *
 * Two things follow from collecting it:
 *
 *   1. The three characteristics are offered as CHOICES, not as free text.
 *      Most people arriving here can define priming loosely but cannot say
 *      which part of their own design is the association and which is the
 *      modulation. A dropdown of the possible answers is a much smaller step
 *      than a blank box, and "not sure - work it out from my design" is a
 *      legitimate option: choosing it fills the answer in from the automatic
 *      check.
 *
 *   2. Declaration and check can then DISAGREE, and the disagreement is worth
 *      more than either alone. Saying "the prime is incidental" while the
 *      design responds to the prime is the single most common way a student
 *      design stops being priming, and it is invisible until the two are put
 *      side by side.
 *
 * A is a list, not a field: the framework allows more than one prime stimulus
 * and more than one presentation of it, so the box takes one per line and has
 * its own "presented more than once per trial" flag.
 *
 * Nothing here blocks anything. Every check is advisory, exactly as
 * asm_validator.js is.
 *
 * @module ScratchBuilder
 * @requires PTA (core_fab.js), PTA.validateASM (asm_validator.js)
 * @requires PTK (paradigm_kit_fab.js) for the link modal and escaping
 * @requires TimelinePlanner (timeline_fab.js) in 'timeline' mode only
 * =====================================================
 */
window.ScratchBuilder = (function () {
  'use strict';

  var SB = {};
  SB.version = '1.0';

  /* ------------------------------------------------------------------ *
   * palette - the platform family, one colour per section              *
   * ------------------------------------------------------------------ */

  var C = {
    sky: '#61a3ed', salmon: '#e38b82', orange: '#ff9b1e', pink: '#ea5cd5',
    green: '#39d461', amber: '#ffd166', lilac: '#bb7be6', teal: '#2fd4c4'
  };

  /* ------------------------------------------------------------------ *
   * state                                                              *
   * ------------------------------------------------------------------ */

  var S = null;
  var MODE = 'full';
  var ROOT = null;

  function blankState() {
    return {
      email: '', expId: '',
      name: '', description: '', instructions: '',
      keys: [
        { label: 'word', key: 'ArrowRight' },
        { label: 'nonword', key: 'ArrowLeft' }
      ],
      rows: [
        { prime: '', target: '', condition: 'related', correct: '' },
        { prime: '', target: '', condition: 'unrelated', correct: '' }
      ],
      baseline: '',
      reps: 2,
      randomize: true,
      feedback: false,
      mode: 'sequential',
      timing: {
        fixation_ms: 500, prime_duration_ms: 200, ISI_ms: 50,
        target_duration_ms: 250, response_window_ms: 1500, ITI_ms: 1000
      },
      abcd: {
        A: '', Amulti: false, B: '', C: '', D: '',
        assoc: '', sec: '', mod: '', notes: ''
      }
    };
  }

  var STORE_KEY = 'ptbx_scratch_draft_fab';

  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }

    // E in the DHSS proposal: experiments created, DRAFTS INCLUDED. This is the
    // only place a from-scratch design is ever written down, so it is where a
    // draft becomes countable. Debounced hard - persist() runs on every
    // keystroke, and a design is one draft however many characters it took.
    if (window.PTA && PTA.logEvent) {
      clearTimeout(persist._t);
      persist._t = setTimeout(function () {
        PTA.logEvent('draft_saved', {
          experimentType: 'scratch-' + MODE,
          email: S.email || null,
          userExperimentId: S.expId || null,
          rows: (S.rows || []).length,
          named: !!(S.name || '').trim()
        });
      }, 3000);
    }
  }

  function restore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      // A draft written by an older version may be missing whole branches;
      // merge onto a blank state rather than trusting what came back.
      var base = blankState();
      Object.keys(base).forEach(function (k) {
        if (o[k] === undefined || o[k] === null) o[k] = base[k];
      });
      Object.keys(base.abcd).forEach(function (k) {
        if (!o.abcd || o.abcd[k] === undefined) { o.abcd = o.abcd || {}; o.abcd[k] = base.abcd[k]; }
      });
      if (!Array.isArray(o.rows) || !o.rows.length) o.rows = base.rows;
      if (!Array.isArray(o.keys) || !o.keys.length) o.keys = base.keys;
      return o;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ *
   * option lists for the three characteristics                         *
   * ------------------------------------------------------------------ *
   * Wording matters here: each option is phrased as something the author
   * can recognise in their own design, and carries the verdict rather than
   * asking for it. "Respond to the prime itself" is not labelled "bad" - it
   * is labelled with what it costs.                                       */

  var ASSOC_OPTIONS = [
    ['', 'Choose how A and B are related...'],
    ['semantic', 'By meaning - A and B belong to the same concept (DOCTOR / NURSE)'],
    ['affective', 'By feeling - A and B share a valence (a smile / the word JOY)'],
    ['perceptual', 'By form - A and B share a shape, sound or spelling'],
    ['structural', 'By structure - A and B share a grammatical form or sequence'],
    ['conceptual', 'By concept - A activates a trait, goal, norm or category that fits B'],
    ['numeric', 'By quantity - A is a magnitude that fits or clashes with B'],
    ['identity', 'A and B are the same item (repetition)'],
    ['none', 'No relation at all - A and B are unconnected'],
    ['unsure', 'Not sure - work it out from my design']
  ];

  var SEC_OPTIONS = [
    ['', 'Choose what the participant does with A...'],
    ['nothing', 'Nothing - A simply appears; the task is only about B'],
    ['incidental', 'Notices it, but never responds to it'],
    ['unaware', 'Cannot report it at all (masked or subliminal)'],
    ['respond', 'Responds to A itself - names, judges or rates it'],
    ['learn', 'Learns or memorises A because it is needed later'],
    ['unsure', 'Not sure - work it out from my design']
  ];

  var MOD_OPTIONS = [
    ['', 'Choose what A changes...'],
    ['rt', 'Speed - responses to B get faster or slower'],
    ['accuracy', 'Accuracy - responses to B get more or less correct'],
    ['choice', 'Choice - a different response to B is selected'],
    ['rating', 'Judgement - B is rated differently'],
    ['none', 'Nothing measurable yet - there is no outcome to compare'],
    ['unsure', 'Not sure - work it out from my design']
  ];

  // Which options mean the characteristic is NOT satisfied. Used only to
  // narrate the author's own answers back to them; nothing is blocked.
  var SEC_BREAKS = { respond: 1, learn: 1 };
  var ASSOC_BREAKS = { none: 1 };
  var MOD_BREAKS = { none: 1 };

  var CONDITION_SUGGESTIONS = [
    'related', 'unrelated', 'congruent', 'incongruent',
    'neutral', 'baseline', 'no-prime', 'repetition'
  ];

  /* ------------------------------------------------------------------ *
   * small helpers                                                      *
   * ------------------------------------------------------------------ */

  function esc(s) {
    if (window.PTK && PTK.esc) return PTK.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'style') n.style.cssText = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n[k] = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function field(labelText, helpText, input) {
    var l = el('label', { class: 'sb-f' }, [el('span', { class: 'sb-lab', text: labelText })]);
    l.appendChild(input);
    if (helpText) l.appendChild(el('span', { class: 'sb-help', text: helpText }));
    return l;
  }

  function textInput(value, onInput, placeholder, type) {
    var i = el('input', { type: type || 'text' });
    i.value = value == null ? '' : value;           // .value, never an attribute:
    if (placeholder) i.placeholder = placeholder;   // no escaping question arises
    i.addEventListener('input', function () { onInput(i.value); persist(); });
    return i;
  }

  function numInput(value, onInput, min, step) {
    var i = el('input', { type: 'number', min: String(min == null ? 0 : min), step: String(step || 1) });
    i.value = value;
    i.addEventListener('input', function () {
      var v = Number(i.value);
      onInput(isFinite(v) ? v : 0);
      persist();
    });
    return i;
  }

  function selectInput(options, value, onChange) {
    var s = el('select');
    options.forEach(function (o) {
      var opt = el('option', { text: o[1] });
      opt.value = o[0];
      s.appendChild(opt);
    });
    s.value = value || '';
    s.addEventListener('change', function () { onChange(s.value); persist(); });
    return s;
  }

  function areaInput(value, onInput, placeholder) {
    var t = el('textarea');
    t.value = value == null ? '' : value;
    if (placeholder) t.placeholder = placeholder;
    t.addEventListener('input', function () { onInput(t.value); persist(); });
    return t;
  }

  function checkbox(labelText, checked, onChange) {
    var i = el('input', { type: 'checkbox' });
    i.checked = !!checked;
    i.addEventListener('change', function () { onChange(i.checked); persist(); });
    var l = el('label', { class: 'sb-check' }, [i]);
    l.appendChild(el('span', { text: labelText }));
    return l;
  }

  function section(num, title, accent, noteText) {
    var s = el('section', { class: 'sb-sec' });
    s.style.setProperty('--sb-accent', accent);
    var h = el('h2', {}, [el('span', { class: 'sb-num', text: 'STEP ' + num })]);
    h.appendChild(document.createTextNode(title));
    s.appendChild(h);
    if (noteText) s.appendChild(el('p', { class: 'sb-note', text: noteText }));
    return s;
  }

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (v) {
      var k = String(v);
      if (!k) return;
      if (seen[k]) return;
      seen[k] = 1; out.push(k);
    });
    return out;
  }

  /**
   * timeline_fab.js ends with `const TimelinePlanner = (function(){...})()` at
   * the top level of a classic script. A top-level `const` creates a binding in
   * the script's lexical scope but NOT a property on window - so
   * `window.TimelinePlanner` is undefined while the bare name resolves fine.
   * Testing the window property silently fell through to the typed defaults and
   * every timing drawn on the timeline was discarded.
   */
  function planner() {
    try {
      return (typeof TimelinePlanner !== 'undefined') ? TimelinePlanner : null;
    } catch (e) {
      return null;
    }
  }

  function say(msg, kind) {
    var m = document.getElementById('sb-msg');
    if (!m) return;
    m.className = 'sb-msg ' + (kind || '');
    m.textContent = msg;
  }

  /* ------------------------------------------------------------------ *
   * sections                                                           *
   * ------------------------------------------------------------------ */

  function secIdentity() {
    var s = section(1, 'Who you are', C.sky,
      'These two fields are how your results are found again. They are stored on every row you collect, ' +
      'and "Get My Data" on the front page filters on exactly this pair - so an experiment with no ID is ' +
      'data you cannot retrieve.');

    var g = el('div', { class: 'sb-grid' });
    g.appendChild(field('Your email', 'Used only to group your rows. Not shown to participants.',
      textInput(S.email, function (v) { S.email = v; }, 'you@university.ac.il', 'email')));

    var idIn = textInput(S.expId, function (v) { S.expId = v; }, 'e.g. my-first-priming-2026');
    var gen = el('button', { class: 'sb-btn ghost small', type: 'button', text: 'Generate one' });
    gen.onclick = function () {
      S.expId = (window.PTK && PTK.generateExperimentId)
        ? PTK.generateExperimentId('scratch')
        : 'scratch-' + Math.random().toString(36).slice(2, 8);
      idIn.value = S.expId;
      persist();
    };
    var idWrap = el('div', {}, [field('Experiment ID', 'At least 3 characters. Any participant who opens your link is filed under it.', idIn)]);
    idWrap.appendChild(el('div', { style: 'margin-top:8px;' }, [gen]));
    g.appendChild(idWrap);

    s.appendChild(g);
    return s;
  }

  function secAbout() {
    var s = section(2, 'What the participant sees first', C.salmon,
      'The title, the one-line description and the instructions on the opening screen. Write the ' +
      'instructions as if the reader has never heard of priming - because a participant has not, and ' +
      'must not be told what the prime is doing.');

    s.appendChild(field('Experiment title',
      'Shown at the top of the opening screen.',
      textInput(S.name, function (v) { S.name = v; }, 'Lexical Decision with Semantic Primes')));

    s.appendChild(el('div', { style: 'height:14px' }));
    s.appendChild(field('One-line description',
      'Shown under the title.',
      textInput(S.description, function (v) { S.description = v; }, 'Decide whether each letter string is a real word.')));

    s.appendChild(el('div', { style: 'height:14px' }));
    s.appendChild(field('Instructions to the participant',
      'What they must do, in plain language. One instruction per line.',
      areaInput(S.instructions, function (v) { S.instructions = v; },
        'A cross appears in the middle of the screen.\nA word flashes briefly.\n' +
        'A second letter string appears - decide as fast as you can whether it is a real word.')));

    return s;
  }

  function secResponse() {
    var s = section(3, 'The task: what they answer, and with which key', C.orange,
      'This is B, the main task. Each row is one response the participant can make: a label you will see ' +
      'in your data, and the key that produces it. The label is also what you put in the "correct answer" ' +
      'column of the trial table below.');

    var body = el('div', { id: 'sb-keys' });
    s.appendChild(body);

    var add = el('button', { class: 'sb-btn ghost small', type: 'button', text: '+ add a response' });
    add.onclick = function () { S.keys.push({ label: '', key: '' }); persist(); paintKeys(); };
    s.appendChild(el('div', { class: 'sb-actions' }, [add]));

    paintKeys(body);
    return s;
  }

  function paintKeys(host) {
    host = host || document.getElementById('sb-keys');
    if (!host) return;
    host.textContent = '';

    var t = el('table', { class: 'sb-table' });
    var head = el('tr', {}, [
      el('th', { text: 'Response label (appears in your data)' }),
      el('th', { text: 'Key' }),
      el('th', { text: '' })
    ]);
    t.appendChild(el('thead', {}, [head]));
    var tb = el('tbody');

    S.keys.forEach(function (k, i) {
      var lab = textInput(k.label, function (v) { k.label = v; }, 'word');
      var key = textInput(k.key, function (v) { k.key = v; }, 'ArrowRight');
      key.title = 'A single character (F, J, 1) or a key name (ArrowLeft, ArrowRight, Space).';
      var x = el('button', { class: 'sb-x', type: 'button', text: 'remove', title: 'Remove this response' });
      x.onclick = function () {
        if (S.keys.length <= 1) { say('An experiment needs at least one response key.', 'warn'); return; }
        S.keys.splice(i, 1); persist(); paintKeys();
      };
      tb.appendChild(el('tr', {}, [
        el('td', {}, [lab]), el('td', {}, [key]), el('td', {}, [x])
      ]));
    });

    t.appendChild(tb);
    host.appendChild(t);
  }

  function secTrials() {
    var s = section(4, 'The trials: prime (A), target (B), condition', C.green,
      'One row per pairing. The prime is what appears first and is never responded to; the target is what ' +
      'the participant answers about. The condition is the label that separates your trial types - it is ' +
      'what the whole analysis rests on, so at least two different conditions are needed for the design to ' +
      'say anything.');

    var body = el('div', { class: 'sb-scroll', id: 'sb-rows' });
    s.appendChild(body);

    var add = el('button', { class: 'sb-btn ghost small', type: 'button', text: '+ add a trial' });
    add.onclick = function () {
      var last = S.rows[S.rows.length - 1] || {};
      S.rows.push({ prime: '', target: '', condition: last.condition || '', correct: last.correct || '' });
      persist(); paintRows();
    };

    var demo = el('button', { class: 'sb-btn ghost small', type: 'button', text: 'Fill with a worked example' });
    demo.onclick = function () {
      S.rows = [
        { prime: 'DOCTOR', target: 'NURSE', condition: 'related', correct: 'word' },
        { prime: 'BREAD', target: 'BUTTER', condition: 'related', correct: 'word' },
        { prime: 'TABLE', target: 'WING', condition: 'unrelated', correct: 'word' },
        { prime: 'BIRD', target: 'CHAIR', condition: 'unrelated', correct: 'word' },
        { prime: 'XXXXX', target: 'NURSE', condition: 'neutral', correct: 'word' },
        { prime: 'XXXXX', target: 'BUTTER', condition: 'neutral', correct: 'word' },
        { prime: 'DOCTOR', target: 'PLARN', condition: 'related', correct: 'nonword' },
        { prime: 'XXXXX', target: 'TRUNE', condition: 'neutral', correct: 'nonword' }
      ];
      S.baseline = 'neutral';
      persist(); paintRows(); paintBaseline();
      say('Filled in a small lexical-decision design. Edit anything - it is only a starting point.', 'ok');
    };

    var clear = el('button', { class: 'sb-btn ghost small', type: 'button', text: 'Clear all trials' });
    clear.onclick = function () {
      if (!window.confirm('Remove every trial row?')) return;
      S.rows = [{ prime: '', target: '', condition: '', correct: '' }];
      persist(); paintRows(); paintBaseline();
    };

    s.appendChild(el('div', { class: 'sb-actions' }, [add, demo, clear]));

    var g = el('div', { class: 'sb-grid', style: 'margin-top:18px' });
    g.appendChild(field('Repetitions', 'How many times the whole trial list is run through.',
      numInput(S.reps, function (v) { S.reps = Math.max(1, Math.round(v)); }, 1, 1)));

    var baseHost = el('div', { id: 'sb-baseline-host' });
    g.appendChild(baseHost);

    var flags = el('div', {}, [
      checkbox('Shuffle the trial order', S.randomize, function (v) { S.randomize = v; }),
      checkbox('Show "correct / incorrect" after each response', S.feedback, function (v) { S.feedback = v; })
    ]);
    g.appendChild(flags);
    s.appendChild(g);

    paintRows(body);
    paintBaseline(baseHost);
    return s;
  }

  function paintRows(host) {
    host = host || document.getElementById('sb-rows');
    if (!host) return;
    host.textContent = '';

    var dl = el('datalist', { id: 'sb-cond-list' });
    CONDITION_SUGGESTIONS.forEach(function (c) {
      var o = el('option'); o.value = c; dl.appendChild(o);
    });
    host.appendChild(dl);

    var t = el('table', { class: 'sb-table' });
    t.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { text: '#' }),
      el('th', { text: 'Prime (A)' }),
      el('th', { text: 'Target (B)' }),
      el('th', { text: 'Condition' }),
      el('th', { text: 'Correct answer' }),
      el('th', { text: '' })
    ])]));
    var tb = el('tbody');

    S.rows.forEach(function (r, i) {
      var p = textInput(r.prime, function (v) { r.prime = v; }, 'DOCTOR');
      var g = textInput(r.target, function (v) { r.target = v; }, 'NURSE');

      var c = textInput(r.condition, function (v) { r.condition = v; refreshBaselineOptions(); }, 'related');
      c.setAttribute('list', 'sb-cond-list');

      var labels = [['', '(no correct answer)']].concat(S.keys.map(function (k) {
        return [k.label, k.label || '(unnamed response)'];
      }));
      var a = selectInput(labels, r.correct, function (v) { r.correct = v; });
      a.title = 'Leave empty for tasks where no answer is right or wrong, such as a rating.';

      var x = el('button', { class: 'sb-x', type: 'button', text: 'remove' });
      x.onclick = function () {
        S.rows.splice(i, 1);
        if (!S.rows.length) S.rows.push({ prime: '', target: '', condition: '', correct: '' });
        persist(); paintRows(); paintBaseline();
      };

      tb.appendChild(el('tr', {}, [
        el('td', { text: String(i + 1), style: 'color:#64748b;padding-top:12px;' }),
        el('td', {}, [p]), el('td', {}, [g]), el('td', {}, [c]), el('td', {}, [a]), el('td', {}, [x])
      ]));
    });

    t.appendChild(tb);
    host.appendChild(t);
  }

  function conditionsInUse() {
    return uniq(S.rows.map(function (r) { return (r.condition || '').trim(); }));
  }

  function paintBaseline(host) {
    host = host || document.getElementById('sb-baseline-host');
    if (!host) return;
    host.textContent = '';
    var opts = [['', 'No baseline condition']].concat(conditionsInUse().map(function (c) { return [c, c]; }));
    var sel = selectInput(opts, S.baseline, function (v) { S.baseline = v; });
    sel.id = 'sb-baseline';
    host.appendChild(field('Which condition is the baseline (C)?',
      'The condition that shows what happens WITHOUT the prime doing its work - a neutral prime, a row of ' +
      'Xs, or no prime at all. Without one there is nothing for the primed outcome to be compared against.',
      sel));
  }

  function refreshBaselineOptions() {
    var sel = document.getElementById('sb-baseline');
    if (!sel) return;
    var keep = S.baseline;
    paintBaseline();
    var again = document.getElementById('sb-baseline');
    if (again) {
      again.value = keep;
      if (again.value !== keep) { S.baseline = ''; }   // that condition no longer exists
    }
  }

  function secTiming() {
    if (MODE === 'timeline') {
      var s = section(5, 'Timing: shape the trial above', C.amber,
        'The timeline at the top of this page IS this step. Drag the right edge of any block, or type exact ' +
        'values into it. Whatever it shows when you build the link is the timing your participants get.');
      var readout = el('div', { id: 'sb-timing-readout', style: 'color:#9aa6b2;font-size:.9rem;' });
      s.appendChild(readout);
      var refresh = el('button', { class: 'sb-btn ghost small', type: 'button', text: 'Show what the timeline currently says' });
      refresh.onclick = paintTimingReadout;
      s.appendChild(el('div', { class: 'sb-actions' }, [refresh]));
      paintTimingReadout(readout);
      return s;
    }

    var f = section(5, 'Timing', C.amber,
      'Milliseconds. The defaults are ordinary values for a visual priming study; ' +
      'if you would rather draw the trial than type it, the timeline version of this page does exactly that.');

    var g = el('div', { class: 'sb-grid' });
    var T = [
      ['fixation_ms', 'Fixation cross', 'The + before anything happens.'],
      ['prime_duration_ms', 'Prime (A) on screen', 'How long the prime is visible.'],
      ['ISI_ms', 'Gap after the prime', 'Blank screen between prime and target.'],
      ['target_duration_ms', 'Target (B) on screen', 'Recorded with the design. The generic engine leaves the target up until the response or the end of the response window.'],
      ['response_window_ms', 'Response window', 'After this the trial is scored as no response.'],
      ['ITI_ms', 'Gap between trials', 'Blank screen before the next trial starts.']
    ];
    T.forEach(function (row) {
      g.appendChild(field(row[1], row[2], numInput(S.timing[row[0]], function (v) {
        S.timing[row[0]] = Math.max(0, Math.round(v));
      }, 0, 10)));
    });
    f.appendChild(g);

    f.appendChild(el('div', { style: 'height:14px' }));
    f.appendChild(field('Presentation',
      'Sequential shows the prime and then the target. Simultaneous shows them together, which is what a ' +
      'Stroop-like design needs.',
      selectInput([['sequential', 'Sequential - prime, then target'], ['simultaneous', 'Simultaneous - both at once']],
        S.mode, function (v) { S.mode = v; })));
    return f;
  }

  function paintTimingReadout(host) {
    host = host || document.getElementById('sb-timing-readout');
    if (!host) return;
    var TP = planner();
    if (!TP) { host.textContent = 'The timeline is not loaded on this page.'; return; }
    var plan = TP.getPlan();
    var parts = Object.keys(plan).map(function (k) { return k.replace(/_ms$/, '') + ' ' + plan[k] + ' ms'; });
    host.textContent = parts.join('  |  ') + '   (total ' + TP.total() + ' ms per trial)';
  }

  /* ------------------------------------------------------------------ *
   * section 6/7: the optional ABCD declaration                         *
   * ------------------------------------------------------------------ */

  function secAbcd() {
    var n = (MODE === 'timeline') ? 6 : 6;
    var s = section(n, 'Say what your A, B, C and D are', C.lilac,
      'Optional. Your experiment runs whether or not you fill this in. What it buys you is a check: the ' +
      'platform reads your design and works out for itself whether it meets the three characteristics, and ' +
      'the interesting result is when that disagrees with what you thought you built.');

    var det = el('details', { class: 'sb-optional' });
    det.open = !!(S.abcd.A || S.abcd.B || S.abcd.assoc || S.abcd.sec || S.abcd.mod);
    var sum = el('summary', {}, [document.createTextNode('Describe this design in the ABCD framework')]);
    sum.appendChild(el('span', { class: 'sb-tag', text: 'optional' }));
    det.appendChild(sum);

    det.appendChild(el('p', { class: 'sb-note', html:
      'A = the prime, B = the target, C = the outcome without A, D = the outcome with A. ' +
      '<a href="../article/abcd-framework.html#s2" style="color:' + C.lilac + ';font-weight:600;">' +
      'Read the definition &rarr;</a>' }));

    /* --- the four slots --- */
    var grid = el('div', { class: 'sb-abcd' });

    var slotA = el('div', { class: 'sb-slot' });
    slotA.style.borderColor = C.pink + '66';
    slotA.appendChild(el('div', { class: 'sb-letter', text: 'A', style: 'color:' + C.pink }));
    slotA.appendChild(el('div', { class: 'sb-role', text: 'Prime' }));
    slotA.appendChild(areaInput(S.abcd.A, function (v) { S.abcd.A = v; },
      'One per line.\nA may be several stimuli, not just one.'));
    slotA.appendChild(el('div', { style: 'height:8px' }));
    slotA.appendChild(checkbox('A appears more than once per trial, or as a set',
      S.abcd.Amulti, function (v) { S.abcd.Amulti = v; }));
    grid.appendChild(slotA);

    var slotB = el('div', { class: 'sb-slot' });
    slotB.style.borderColor = C.orange + '66';
    slotB.appendChild(el('div', { class: 'sb-letter', text: 'B', style: 'color:' + C.orange }));
    slotB.appendChild(el('div', { class: 'sb-role', text: 'Target - the task' }));
    slotB.appendChild(areaInput(S.abcd.B, function (v) { S.abcd.B = v; },
      'What the participant is actually asked to do.'));
    grid.appendChild(slotB);

    var slotC = el('div', { class: 'sb-slot' });
    slotC.style.borderColor = C.sky + '66';
    slotC.appendChild(el('div', { class: 'sb-letter', text: 'C', style: 'color:' + C.sky }));
    slotC.appendChild(el('div', { class: 'sb-role', text: 'Outcome without A' }));
    slotC.appendChild(areaInput(S.abcd.C, function (v) { S.abcd.C = v; },
      'What you expect when the prime does nothing.'));
    grid.appendChild(slotC);

    var slotD = el('div', { class: 'sb-slot' });
    slotD.style.borderColor = C.green + '66';
    slotD.appendChild(el('div', { class: 'sb-letter', text: 'D', style: 'color:' + C.green }));
    slotD.appendChild(el('div', { class: 'sb-role', text: 'Outcome with A' }));
    slotD.appendChild(areaInput(S.abcd.D, function (v) { S.abcd.D = v; },
      'What you expect the prime to change it to.'));
    grid.appendChild(slotD);

    det.appendChild(grid);

    /* --- the three characteristics, as choices --- */
    det.appendChild(el('h3', {
      style: 'font-size:.98rem;margin:22px 0 4px;color:' + C.lilac + ';',
      text: 'The three characteristics'
    }));
    det.appendChild(el('p', { class: 'sb-note', text:
      'Pick the description that fits your design. If none of them obviously does, choose "not sure" and ' +
      'the check below will answer it from the design itself.' }));

    var cg = el('div', { style: 'display:grid;gap:14px;' });

    cg.appendChild(field('Association - how are A and B related?',
      'Priming needs a relation between the prime and the target that you can manipulate. ' +
      'If nothing connects them, whatever you measure is not priming.',
      selectInput(ASSOC_OPTIONS, S.abcd.assoc, function (v) { S.abcd.assoc = v; })));

    cg.appendChild(field('Secondariness - what does the participant do with A?',
      'The prime has to be beside the point of the task. The moment the participant is asked to answer, ' +
      'rate or memorise it, it is part of the task and the design is teaching or instruction rather than priming.',
      selectInput(SEC_OPTIONS, S.abcd.sec, function (v) { S.abcd.sec = v; })));

    cg.appendChild(field('Modulation - what does A change?',
      'There must be an outcome that shifts from C to D. A design with no measurable outcome has nothing ' +
      'for the prime to modulate.',
      selectInput(MOD_OPTIONS, S.abcd.mod, function (v) { S.abcd.mod = v; })));

    det.appendChild(cg);

    det.appendChild(el('div', { style: 'height:14px' }));
    det.appendChild(field('Anything else worth recording',
      'Free text. Travels with the design and is written into the exported file.',
      areaInput(S.abcd.notes, function (v) { S.abcd.notes = v; }, '')));

    s.appendChild(det);
    return s;
  }

  /* ------------------------------------------------------------------ *
   * section 7/8: check, preview, link                                  *
   * ------------------------------------------------------------------ */

  function secLaunch() {
    var s = section(7, 'Check it, try it, share it', C.teal,
      'The check is advisory and never blocks anything: a design it flags may still be a perfectly good ' +
      'experiment, it just would not be priming under the definition.');

    var check = el('button', { class: 'sb-btn', type: 'button', text: 'Check my design' });
    check.style.setProperty('--sb-accent', C.teal);
    check.onclick = function () { runCheck(true); };

    var run = el('button', { class: 'sb-btn ghost', type: 'button', text: 'Try it myself' });
    run.onclick = previewRun;

    var link = el('button', { class: 'sb-btn ghost', type: 'button', text: 'Create participant link' });
    link.onclick = makeLink;

    var dl = el('button', { class: 'sb-btn ghost', type: 'button', text: 'Download the design (JSON)' });
    dl.onclick = downloadDesign;

    s.appendChild(el('div', { class: 'sb-actions' }, [check, run, link, dl]));
    s.appendChild(el('div', { class: 'sb-msg', id: 'sb-msg' }));
    s.appendChild(el('div', { class: 'sb-report', id: 'sb-report' }));
    s.appendChild(el('div', { id: 'sb-declared' }));
    return s;
  }

  /* ------------------------------------------------------------------ *
   * building the config                                                *
   * ------------------------------------------------------------------ */

  function timing() {
    var TP = planner();
    if (MODE === 'timeline' && TP) {
      var p = TP.getPlan();
      // The planner speaks response_window_ms; the engine reads
      // response_timeout_ms. index.html bridges the two for its own path;
      // this page has to do the same or the biggest block on the timeline
      // would be a control that changes nothing at run time.
      var out = Object.assign({}, p);
      if (typeof out.response_window_ms === 'number') out.response_timeout_ms = out.response_window_ms;
      return out;
    }
    var t = Object.assign({}, S.timing);
    t.response_timeout_ms = t.response_window_ms;
    return t;
  }

  SB.buildConfig = function () {
    var rows = S.rows.filter(function (r) { return (r.target || '').trim(); });

    var primes = uniq(rows.map(function (r) { return (r.prime || '').trim(); }));
    var targets = uniq(rows.map(function (r) { return (r.target || '').trim(); }));

    // A BLANK PRIME IS A REAL DESIGN, not a mistake. Step 4's own help text
    // offers "a neutral prime, a row of Xs, or no prime at all" as the baseline,
    // and no prime at all is the cleanest C there is: identical timing, nothing
    // shown. uniq() drops the empty string, so indexOf('') was -1 and every such
    // row was silently discarded by the filter below.
    //
    // Silently is the bad part. `conditions` is collected from the rows BEFORE
    // this filter, so the config went on advertising a "no-prime" condition
    // while running zero no-prime trials - and the definition check, seeing a
    // baseline condition, reported modulation satisfied. A design that claims a
    // control condition it never runs is worse than one that has none.
    //
    // Keeping '' as a real entry makes the index resolve; the engine then
    // renders an empty prime for the prime duration, which is exactly a blank
    // interval of the right length.
    if (rows.some(function (r) { return !(r.prime || '').trim(); }) && primes.indexOf('') === -1) {
      primes.push('');
    }

    var pairings = rows.map(function (r) {
      var pi = primes.indexOf((r.prime || '').trim());
      return {
        primeIndex: pi,
        targetIndex: targets.indexOf((r.target || '').trim()),
        condition: (r.condition || '').trim() || 'default',
        correctResponse: (r.correct || '') || null
      };
    }).filter(function (p) { return p.primeIndex >= 0 && p.targetIndex >= 0; });

    var keys = {};
    S.keys.forEach(function (k) {
      var lab = (k.label || '').trim();
      var key = (k.key || '').trim();
      if (lab && key) keys[lab] = key;
    });

    var t = timing();
    var cfg = {
      id: (S.expId || 'scratch-design').trim(),
      name: (S.name || 'Untitled experiment').trim(),
      description: (S.description || '').trim(),
      type: 'custom',
      built_with: 'scratch_builder_fab ' + SB.version + ' (' + MODE + ')',
      instructions: S.instructions || '',
      primes: { type: 'text', items: primes },
      targets: { type: 'text', items: targets },
      conditions: conditionsInUse(),
      presentation: Object.assign({ mode: S.mode }, t),
      trial_plan: t,
      response: { type: 'key_press', keys: keys },
      trials: { randomize: !!S.randomize, repetitions: Math.max(1, S.reps | 0), pairings: pairings },
      feedback: { show: !!S.feedback, duration_ms: 400, correct_text: 'Correct', incorrect_text: 'Incorrect' },
      data: { save_to_supabase: true, table_name: 'experiment_results' },
      experimenter: { email: (S.email || '').trim(), experiment_id: (S.expId || '').trim() }
    };

    // Declared baseline: this is also exactly the key asm_validator.js looks
    // for when it asks whether C is obtainable, so the author's answer and the
    // automatic check are reading the same field rather than two versions of it.
    if (S.baseline) cfg.baseline = S.baseline;

    // The author's own reading of the design. Only sent when something was
    // actually filled in - an empty declaration in the data is worse than none,
    // because it looks like an answer.
    var a = S.abcd;
    if (a.A || a.B || a.C || a.D || a.assoc || a.sec || a.mod || a.notes) {
      cfg.abcd = {
        A: a.A.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
        A_multiple: !!a.Amulti,
        B: a.B, C: a.C, D: a.D,
        association: a.assoc, secondariness: a.sec, modulation: a.mod,
        notes: a.notes
      };
      // Declared "the participant responds to / learns the prime" is the direct
      // route out of secondariness. Handing it to the validator lets the
      // automatic check see what only the author could know.
      if (SEC_BREAKS[a.sec]) cfg.respondToPrime = true;
    }

    return cfg;
  };

  /* ------------------------------------------------------------------ *
   * checking                                                           *
   * ------------------------------------------------------------------ */

  function structuralProblems(cfg) {
    var bad = [];
    if (!cfg.targets.items.length) bad.push('There are no targets: every trial row needs something in the Target column.');
    if (!Object.keys(cfg.response.keys).length) bad.push('There are no response keys: step 3 needs at least one label and one key.');
    if (!cfg.trials.pairings.length) bad.push('There are no usable trials.');
    if (cfg.conditions.length < 2) bad.push('There is only one condition, so there is nothing to compare against anything.');
    var labels = Object.keys(cfg.response.keys);
    var unknown = uniq(cfg.trials.pairings.map(function (p) { return p.correctResponse; })
      .filter(function (r) { return r && labels.indexOf(r) === -1; }));
    if (unknown.length) bad.push('Some trials expect a correct answer that is not a response key: ' + unknown.join(', ') + '.');

    // Nothing may vanish quietly. A row the author typed and the config did not
    // keep is the failure mode that let a "no-prime" baseline be advertised and
    // never run - the condition list is built from the rows, the trial list is
    // built after filtering, and the two disagreed with nobody told.
    var typed = S.rows.filter(function (r) {
      return (r.prime || '').trim() || (r.target || '').trim() || (r.condition || '').trim();
    }).length;
    if (typed > cfg.trials.pairings.length) {
      bad.push('You have ' + typed + ' trial rows but only ' +
        cfg.trials.pairings.length + ' of them can run. A row is dropped when its ' +
        'Target cell is empty; the Prime cell may be left blank on purpose, for a ' +
        'no-prime baseline.');
    }

    // The same disagreement seen from the other side: a condition named in the
    // table but present in no runnable trial.
    var live = uniq(cfg.trials.pairings.map(function (p) { return p.condition; }));
    var phantom = cfg.conditions.filter(function (c) { return live.indexOf(c) === -1; });
    if (phantom.length) {
      bad.push('These conditions are named but no trial actually runs them: ' +
        phantom.join(', ') + '. The results would report a comparison that never happened.');
    }
    return bad;
  }

  function runCheck(loud) {
    var cfg = SB.buildConfig();
    var panel = document.getElementById('sb-report');
    var problems = structuralProblems(cfg);

    if (window.PTA && typeof PTA.validateASM === 'function' && panel) {
      var report = PTA.validateASM(cfg);
      PTA.renderASMReport(report, panel);
      answerUnsure(report);
      showDeclaredVsChecked(report);
      if (loud) {
        say(problems.length
          ? 'The definition check ran. First, though: ' + problems.join(' ')
          : 'The definition check ran - see below. ' + report.summary,
          problems.length ? 'warn' : (report.level === 'ok' ? 'ok' : 'warn'));
      }
      return { report: report, problems: problems, cfg: cfg };
    }

    if (loud) say(problems.length ? problems.join(' ') : 'The design is structurally complete.', problems.length ? 'warn' : 'ok');
    return { report: null, problems: problems, cfg: cfg };
  }

  // "Not sure - work it out from my design" is a real answer, so it has to be
  // answered. The automatic check has just produced exactly that judgement, so
  // the dropdown is filled from it rather than left saying "not sure".
  function answerUnsure(report) {
    var byChar = {};
    report.checks.forEach(function (c) {
      // secondariness can produce several findings; the worst one wins
      var rank = { fail: 3, warn: 2, incomplete: 2, ok: 1 };
      if (!byChar[c.characteristic] || rank[c.status] > rank[byChar[c.characteristic].status]) {
        byChar[c.characteristic] = c;
      }
    });
    var filled = [];

    if (S.abcd.assoc === 'unsure' && byChar.association) {
      S.abcd.assoc = byChar.association.status === 'ok' ? 'semantic' : 'none';
      filled.push('association');
    }
    if (S.abcd.sec === 'unsure' && byChar.secondariness) {
      S.abcd.sec = byChar.secondariness.status === 'ok' ? 'nothing'
        : (/identity|also the target/i.test(byChar.secondariness.message) ? 'nothing' : 'respond');
      filled.push('secondariness');
    }
    if (S.abcd.mod === 'unsure' && byChar.modulation) {
      S.abcd.mod = byChar.modulation.status === 'ok' ? 'rt' : 'none';
      filled.push('modulation');
    }

    if (filled.length) {
      persist();
      SB.repaint();
      say('Answered from your design: ' + filled.join(', ') + '. Change it if you disagree - you know the design, the check only reads it.', 'ok');
    }
  }

  // Where the author's declaration and the automatic check disagree. This is
  // the only place in the platform that can catch "I built something I did not
  // mean to build", so it says which of the two it is deferring to: neither.
  function showDeclaredVsChecked(report) {
    var host = document.getElementById('sb-declared');
    if (!host) return;
    host.textContent = '';
    var a = S.abcd;
    if (!a.assoc && !a.sec && !a.mod) return;

    var status = {};
    report.checks.forEach(function (c) {
      var rank = { fail: 3, warn: 2, incomplete: 2, ok: 1 };
      if (!status[c.characteristic] || rank[c.status] > rank[status[c.characteristic].status]) {
        status[c.characteristic] = c;
      }
    });

    var lines = [];
    function compare(name, declaredValue, breaks, checkKey) {
      if (!declaredValue) return;
      var authorSaysMet = !breaks[declaredValue];
      var chk = status[checkKey];
      if (!chk) return;
      var checkSaysMet = chk.status === 'ok';
      if (authorSaysMet === checkSaysMet) return;
      lines.push(authorSaysMet
        ? 'You described <b>' + esc(name) + '</b> as satisfied, but the design as built does not show it: ' + esc(chk.message)
        : 'You described <b>' + esc(name) + '</b> as not satisfied, but nothing in the built design shows that. ' +
          'If it is true, it is in the instructions rather than in the configuration - which is exactly the ' +
          'kind of thing the check cannot see.');
    }

    compare('association', a.assoc, ASSOC_BREAKS, 'association');
    compare('secondariness', a.sec, SEC_BREAKS, 'secondariness');
    compare('modulation', a.mod, MOD_BREAKS, 'modulation');

    if (!lines.length) {
      host.innerHTML = '<div style="margin-top:12px;border-left:3px solid ' + C.green +
        ';background:rgba(57,212,97,.08);border-radius:0 10px 10px 0;padding:11px 14px;font-size:.9rem;">' +
        'Your description of this design and the automatic check agree on all three characteristics.</div>';
      return;
    }
    host.innerHTML = '<div style="margin-top:12px;border-left:3px solid ' + C.amber +
      ';background:rgba(255,209,102,.08);border-radius:0 10px 10px 0;padding:11px 14px;font-size:.9rem;line-height:1.65;">' +
      '<b style="color:' + C.amber + '">Your description and the check disagree</b><br>' +
      lines.join('<br><br>') +
      '<div style="margin-top:10px;color:#9aa6b2;font-size:.85rem;">Neither one is authoritative. The check ' +
      'reads only the configuration; you know what participants will be told.</div></div>';
  }

  /* ------------------------------------------------------------------ *
   * preview, link, export                                              *
   * ------------------------------------------------------------------ */

  function indexUrl() {
    return new URL('../index.html', window.location.href).href;
  }

  function encode(cfg) {
    // PTK.encode is UTF-8 safe; PTA.encodeConfig used to be bare btoa() and
    // threw on any Hebrew, Arabic or Chinese stimulus. Stimuli here are typed
    // by the author, so that is not a hypothetical.
    if (window.PTK && PTK.encode) return PTK.encode(cfg);
    return btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  }

  function readyToShare() {
    var res = runCheck(false);
    if (res.problems.length) {
      say('Not yet: ' + res.problems.join(' '), 'bad');
      return null;
    }
    return res.cfg;
  }

  function previewRun() {
    var cfg = readyToShare();
    if (!cfg) return;
    // Run it on index.html, which owns the experiment overlay and the engine
    // bindings. Rebuilding that here would be a second copy of the run loop.
    var preview = Object.assign({}, cfg);
    preview.data = { save_to_supabase: false, table_name: 'experiment_results' };
    preview.name = cfg.name + ' (preview)';
    if (window.PTA && PTA.logEvent) {
      PTA.logEvent('preview_run', { experimentType: 'scratch-' + MODE, email: S.email || null,
                                    userExperimentId: S.expId || null });
    }
    say('Opening your experiment in a new tab. Nothing is saved from a preview.', 'ok');
    window.open(indexUrl() + '?config=' + encodeURIComponent(encode(preview)), '_blank');
  }

  function makeLink() {
    var cfg = readyToShare();
    if (!cfg) return;
    if (window.PTK && PTK.validateIdentity && !PTK.validateIdentity(S.email, S.expId)) return;

    // P in the DHSS proposal: an experiment becomes PUBLISHED the moment its
    // participant link exists. The kit paradigms count this in PTK.buildLink;
    // this page builds its link itself, so it counts it here.
    if (window.PTA && PTA.logEvent) {
      PTA.logEvent('link_generated', {
        experimentType: 'scratch-' + MODE,
        email: S.email || null,
        userExperimentId: S.expId || null,
        trials: cfg.trials.pairings.length,
        conditions: cfg.conditions.length,
        declaredAbcd: !!cfg.abcd
      });
    }

    // encodeURIComponent: a raw '+' from base64 decodes as a space and kills
    // the link. See the note in PTK.buildLink.
    var link = indexUrl() + '?config=' + encodeURIComponent(encode(cfg));
    if (window.PTK && PTK.showLinkModal) PTK.showLinkModal(link, C.teal);
    else window.prompt('Your participant link:', link);

    var out = document.getElementById('sb-link-out');
    if (!out) {
      out = el('div', { class: 'sb-out', id: 'sb-link-out' });
      document.getElementById('sb-report').parentNode.appendChild(out);
    }
    out.textContent = '';
    out.appendChild(el('div', { style: 'font-size:.82rem;color:#9aa6b2;margin-bottom:6px;',
      text: 'Your participant link (' + link.length + ' characters). Send this to participants:' }));
    var ta = el('textarea');
    ta.readOnly = true;
    ta.value = link;
    out.appendChild(ta);
    say('Link created. Results appear under "Get My Data" with your email and experiment ID.', 'ok');
  }

  function downloadDesign() {
    var cfg = SB.buildConfig();
    var blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = (cfg.id || 'design') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    say('Design downloaded. It is the exact object your link carries.', 'ok');
  }

  /* ------------------------------------------------------------------ *
   * mount                                                              *
   * ------------------------------------------------------------------ */

  SB.repaint = function () {
    if (!ROOT) return;
    var openState = {};
    ROOT.querySelectorAll('details').forEach(function (d, i) { openState[i] = d.open; });
    var scroll = window.scrollY;
    paint();
    ROOT.querySelectorAll('details').forEach(function (d, i) { if (openState[i]) d.open = true; });
    window.scrollTo(0, scroll);
  };

  function paint() {
    ROOT.textContent = '';
    ROOT.appendChild(secIdentity());
    ROOT.appendChild(secAbout());
    ROOT.appendChild(secResponse());
    ROOT.appendChild(secTrials());
    ROOT.appendChild(secTiming());
    ROOT.appendChild(secAbcd());
    ROOT.appendChild(secLaunch());
  }

  /**
   * @param {Object} opts
   * @param {string} opts.host  id of the container to build into
   * @param {string} opts.mode  'full' | 'timeline'
   */
  SB.mount = function (opts) {
    opts = opts || {};
    MODE = opts.mode === 'timeline' ? 'timeline' : 'full';
    ROOT = document.getElementById(opts.host || 'sb-root');
    if (!ROOT) { console.error('ScratchBuilder: no host element'); return; }
    S = restore() || blankState();
    paint();
  };

  /**
   * Redraw the "what the timeline currently says" line in step 5. Called by
   * build/timeline.html when the planner's own button is pressed, so that
   * button confirms something instead of writing into a draft this page does
   * not use.
   */
  SB.refreshTiming = function () {
    paintTimingReadout();
    var TP = planner();
    if (TP) {
      say('Timing noted: ' + TP.total() + ' ms per trial. The link always carries whatever the timeline shows.', 'ok');
    }
  };

  SB._state = function () { return S; };          // for the test harness
  return SB;
})();
