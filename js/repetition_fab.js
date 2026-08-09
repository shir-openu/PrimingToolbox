/**
 * =====================================================
 * PrimingToolbox - Repetition Priming (V2 _fab)
 * =====================================================
 *
 * Word-fragment completion (Tulving, Schacter & Stark 1982). Two phases:
 *
 *   STUDY : words are shown one at a time and rated for pleasantness. The
 *           rating is a cover task - nobody is told there will be a memory
 *           test, which is what makes the later effect implicit.
 *   TEST  : word fragments (E L E _ H A N T) are completed. Half come from
 *           studied words, half from words never seen. Studied fragments are
 *           completed more often, even by participants who cannot recall the
 *           study list.
 *
 * Priming (ABCD): A = the studied word, B = the fragment task, C = completion
 * rate for unstudied fragments, D = completion rate for studied fragments.
 *
 * This is the only paradigm in the toolbox whose dependent measure is a
 * COMPLETION RATE with an accuracy criterion rather than a latency, so the
 * results panel reports rate first and latency second.
 *
 * Self-contained (injects its own overlay). Saves through PTA.saveToSupabase
 * using only existing experiment_results columns.
 *
 * @module RepetitionPriming
 */
window.RepetitionPriming = {

  data: {
    // fragment: the letters kept; blanks marked with _
    items: [
      { word: 'ELEPHANT', fragment: 'E _ E _ H A N T' },
      { word: 'BALLOON',  fragment: 'B A _ _ O O N' },
      { word: 'DIAMOND',  fragment: '_ I A _ O N D' },
      { word: 'PYRAMID',  fragment: 'P _ R A _ I D' },
      { word: 'HARVEST',  fragment: 'H A _ V _ S T' },
      { word: 'JOURNEY',  fragment: 'J O _ R _ E Y' },
      { word: 'MAGNET',   fragment: 'M A _ N _ T' },
      { word: 'VOLCANO',  fragment: 'V O _ C _ N O' },
      { word: 'LANTERN',  fragment: 'L A _ T _ R N' },
      { word: 'COMPASS',  fragment: 'C O _ P _ S S' },
      { word: 'TRUMPET',  fragment: 'T R _ M _ E T' },
      { word: 'BLANKET',  fragment: 'B L _ N _ E T' }
    ]
  },

  state: {
    studyList: [], testList: [], currentIndex: 0,
    phase: 'setup',           // setup | study | bridge | test | results
    onset: 0, results: [], studyRatings: [], openedFromBuilder: false
  },

  timing: {
    study_ms: 3000,           // how long each study word stays up if not rated
    iti_ms: 400
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  _initDone: false,
  _participantId: '',
  _locked: false,

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    console.log('Repetition Priming module initialized');
  },

  ensureOverlay: function () {
    if (document.getElementById('repetition-overlay')) return;
    const el = document.createElement('div');
    el.id = 'repetition-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        '<div id="repetition-setup">' +
          '<h2 style="color:#34d399;">Word Fragments</h2>' +
          '<p style="color:#9aa6b2;line-height:1.7;">First you will rate some words for how pleasant they feel.<br>' +
            'After that there is a short word puzzle. Please do not try to memorise anything.</p>' +
          '<button class="btn" onclick="RepetitionPriming.start()" style="margin-top:14px;">Start</button> ' +
          '<button class="btn btn-secondary" onclick="RepetitionPriming.close()">Cancel</button>' +
        '</div>' +

        '<div id="repetition-study" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="repetition-study-progress"></div>' +
          '<div style="color:#64748b;font-size:.8rem;letter-spacing:2px;margin-top:18px;">HOW PLEASANT IS THIS WORD?</div>' +
          '<div id="repetition-study-word" style="font-size:3rem;font-weight:700;margin:34px 0;letter-spacing:3px;"></div>' +
          '<div id="repetition-scale" style="display:flex;gap:10px;justify-content:center;"></div>' +
        '</div>' +

        '<div id="repetition-bridge" style="display:none;">' +
          '<h3 style="color:#34d399;">Part 2</h3>' +
          '<p style="color:#9aa6b2;line-height:1.7;max-width:520px;margin:14px auto;">Some letters are missing from each word below.<br>' +
            'Type the first complete word that comes to mind. If nothing comes, leave it blank and continue.</p>' +
          '<button class="btn" onclick="RepetitionPriming.beginTest()">Continue</button>' +
        '</div>' +

        '<div id="repetition-test" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="repetition-test-progress"></div>' +
          '<div id="repetition-fragment" style="font-size:2.6rem;font-weight:700;margin:30px 0;letter-spacing:6px;color:#34d399;"></div>' +
          '<input id="repetition-answer" type="text" autocomplete="off" spellcheck="false" ' +
                 'style="font-size:1.5rem;padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.3);' +
                 'background:rgba(255,255,255,.08);color:#fff;text-align:center;letter-spacing:3px;text-transform:uppercase;width:280px;">' +
          '<div style="margin-top:18px;">' +
            '<button class="btn" onclick="RepetitionPriming.submitAnswer()">Next</button> ' +
            '<button class="btn btn-secondary" onclick="RepetitionPriming.skipAnswer()">I do not know</button>' +
          '</div>' +
        '</div>' +

        '<div id="repetition-results" style="display:none;">' +
          '<h2 style="color:#34d399;">Complete</h2>' +
          '<div id="repetition-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<button class="btn" onclick="RepetitionPriming.exportCSV()">Download CSV</button> ' +
          '<button class="btn" onclick="RepetitionPriming.restart()">Try Again</button> ' +
          '<button class="btn btn-secondary" onclick="RepetitionPriming.close()">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('repetition-overlay').style.display = 'block';
    ['setup', 'study', 'bridge', 'test', 'results'].forEach(s => {
      const n = document.getElementById('repetition-' + s);
      if (n) n.style.display = (s === 'setup') ? 'block' : 'none';
    });
    this.state.phase = 'setup';
  },

  close: function () {
    const ov = document.getElementById('repetition-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  /** Half the items are studied; every item is tested. */
  buildLists: function () {
    const shuffled = PTA.shuffleArray(this.data.items.slice());
    const half = Math.floor(shuffled.length / 2);
    const studied = shuffled.slice(0, half);
    const unstudied = shuffled.slice(half);
    this.state.studyList = PTA.shuffleArray(studied.slice());
    this.state.testList = PTA.shuffleArray(
      studied.map(it => ({ ...it, studied: true }))
        .concat(unstudied.map(it => ({ ...it, studied: false })))
    );
  },

  start: function () {
    this.buildLists();
    this.state.currentIndex = 0;
    this.state.results = [];
    this.state.studyRatings = [];
    this.state.phase = 'study';
    document.getElementById('repetition-setup').style.display = 'none';
    document.getElementById('repetition-study').style.display = 'block';
    this.renderStudy();
  },

  renderStudy: function () {
    const it = this.state.studyList[this.state.currentIndex];
    if (!it) { this.endStudy(); return; }
    document.getElementById('repetition-study-progress').textContent =
      'Word ' + (this.state.currentIndex + 1) + ' of ' + this.state.studyList.length;
    document.getElementById('repetition-study-word').textContent = it.word;

    const scale = document.getElementById('repetition-scale');
    scale.innerHTML = '';
    for (let v = 1; v <= 5; v++) {
      const b = document.createElement('button');
      b.className = 'btn btn-secondary';
      b.textContent = String(v);
      b.style.cssText = 'min-width:56px;font-size:1.1rem;';
      b.onclick = () => this.rate(it, v);
      scale.appendChild(b);
    }
    this.state.onset = performance.now();
  },

  rate: function (it, value) {
    this.state.studyRatings.push({ word: it.word, rating: value,
                                   rt: performance.now() - this.state.onset });
    this.state.currentIndex++;
    setTimeout(() => this.renderStudy(), this.timing.iti_ms);
  },

  endStudy: function () {
    this.state.phase = 'bridge';
    document.getElementById('repetition-study').style.display = 'none';
    document.getElementById('repetition-bridge').style.display = 'block';
  },

  beginTest: function () {
    this.state.phase = 'test';
    this.state.currentIndex = 0;
    document.getElementById('repetition-bridge').style.display = 'none';
    document.getElementById('repetition-test').style.display = 'block';
    this.renderTest();
  },

  renderTest: function () {
    this._locked = false;
    const it = this.state.testList[this.state.currentIndex];
    if (!it) { this.showResults(); return; }
    document.getElementById('repetition-test-progress').textContent =
      'Fragment ' + (this.state.currentIndex + 1) + ' of ' + this.state.testList.length;
    document.getElementById('repetition-fragment').textContent = it.fragment;
    const input = document.getElementById('repetition-answer');
    input.value = '';
    input.focus();
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); this.submitAnswer(); } };
    this.state.onset = performance.now();
  },

  submitAnswer: function () {
    const input = document.getElementById('repetition-answer');
    this.record((input.value || '').trim().toUpperCase());
  },

  skipAnswer: function () { this.record(''); },

  record: function (answer) {
    // Enter and the Next button both land here; without the lock a fast double
    // press records the same fragment twice.
    if (this._locked) return;
    const it = this.state.testList[this.state.currentIndex];
    if (!it) return;
    this._locked = true;
    const rt = performance.now() - this.state.onset;
    const completed = answer === it.word;
    const r = {
      trial: this.state.currentIndex + 1,
      word: it.word,
      fragment: it.fragment.replace(/ /g, ''),
      studied: it.studied,
      answer: answer,
      completed: completed,
      rt: rt
    };
    this.state.results.push(r);
    this.saveTrial(r);
    this.state.currentIndex++;
    setTimeout(() => this.renderTest(), this.timing.iti_ms);
  },

  saveTrial: function (r) {
    if (!this._participantId) this._participantId = PTA.generateParticipantId();
    const trialData = {
      experiment_id: 'repetition_priming',
      participant_id: this._participantId,
      trial_number: r.trial,
      language: 'en',
      prime_type: r.studied ? 'studied' : 'unstudied',
      target: r.word,
      ink_color: r.studied ? 'studied' : 'unstudied',  // repurposed
      word_meaning: r.fragment,                        // repurposed: the fragment shown
      congruent: r.studied,
      response: r.answer || null,
      correct: r.completed,
      rt: Math.round(r.rt * 100) / 100,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    };
    if (window.PTA && PTA.saveToSupabase) PTA.saveToSupabase(trialData);
  },

  showResults: function () {
    this.state.phase = 'results';
    document.getElementById('repetition-test').style.display = 'none';
    document.getElementById('repetition-results').style.display = 'block';

    const st = this.state.results.filter(r => r.studied);
    const un = this.state.results.filter(r => !r.studied);
    const rate = a => a.length ? Math.round(100 * a.filter(r => r.completed).length / a.length) : null;
    const rS = rate(st), rU = rate(un);
    const effect = (rS !== null && rU !== null) ? (rS - rU) : null;
    const mrt = this.state.results.length ? Math.round(PTA.mean(this.state.results.map(r => r.rt))) : null;

    document.getElementById('repetition-results-body').innerHTML =
      '<p>Fragments attempted: ' + this.state.results.length +
        ' &nbsp;|&nbsp; words studied earlier: ' + st.length + '</p>' +
      '<p>Completed - studied words: ' + (rS !== null ? rS + '%' : '-') + '</p>' +
      '<p>Completed - never seen: ' + (rU !== null ? rU + '%' : '-') + '</p>' +
      '<p style="color:#34d399;font-weight:700;">Repetition priming effect (D): ' +
        (effect !== null ? effect + ' percentage points' +
          (effect > 0 ? ' (studied words completed more often)' : '') : '-') + '</p>' +
      '<p style="color:#9aa6b2;">Mean time per fragment: ' + (mrt !== null ? mrt + ' ms' : '-') + '</p>';
  },

  restart: function () { this.open(); this.start(); },

  exportCSV: function () {
    if (!this.state.results.length) { alert('No results to export'); return; }
    const headers = ['trial', 'fragment', 'solution', 'studied_earlier', 'answer', 'completed', 'time_ms'];
    const rows = this.state.results.map(r =>
      [r.trial, r.fragment, r.word, r.studied, r.answer, r.completed, Math.round(r.rt)]);
    const csv = [headers, ...rows].map(row => row.map(c => '"' + c + '"').join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const l = document.createElement('a');
    l.href = URL.createObjectURL(blob);
    l.download = 'repetition_priming_' + new Date().toISOString().slice(0, 10) + '.csv';
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
    const expId = prompt('Experiment ID (e.g. repetition_pilot_1):', this.userExperimentId || '');
    if (expId === null) return;
    this.experimenterEmail = email.trim();
    this.userExperimentId = expId.trim();
    const config = {
      template: 'repetition-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      timing: this.timing
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
    const link = window.location.href.split('?')[0] + '?repetition=' + encoded;
    window.prompt('Participant link (copy and send):', link);
  },

  checkUrlConfig: function () {
    const urlParams = new URLSearchParams(window.location.search);
    const raw = urlParams.get('repetition');
    if (!raw) return false;
    try {
      const config = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (config.template !== 'repetition-priming') return false;
      this.isParticipantMode = true;
      this.experimenterEmail = config.experimenterEmail || '';
      this.userExperimentId = config.userExperimentId || '';
      if (config.timing) Object.assign(this.timing, config.timing);
      const layout = document.querySelector('.layout');
      if (layout) layout.style.display = 'none';
      this.open();
      return true;
    } catch (e) {
      console.error('RepetitionPriming: bad participant config', e);
      return false;
    }
  }
};

document.addEventListener('DOMContentLoaded', function () { RepetitionPriming.init(); });
console.log('Repetition Priming module loaded');
