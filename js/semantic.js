/**
 * =====================================================
 * PrimingToolbox - Semantic Priming Module
 * =====================================================
 *
 * Lexical Decision Task with Semantic Priming.
 * Based on Meyer & Schvaneveldt (1971).
 *
 * ABCD Framework Mapping:
 * - A (Prime): First word activating semantic associations
 * - B (Target): Word/nonword requiring lexical decision
 * - C (Baseline): RT for unrelated pairs
 * - D (Measured): RT for related pairs
 * - Priming Effect: C - D (positive = faster for related)
 *
 * Features:
 * - Sequential prime-target presentation
 * - Configurable SOA (Stimulus Onset Asynchrony)
 * - Lexical decision task (word vs. nonword)
 * - Template Builder for experimenter customization
 * - Supabase data collection
 * - Export to CSV/Excel
 *
 * @module Semantic
 * @version 1.0
 * @requires PTA (core.js)
 * =====================================================
 */

/**
 * Semantic namespace - global experiment controller.
 * @namespace Semantic
 */
window.Semantic = {

  /**
   * Default stimulus configuration.
   * Contains related pairs, unrelated pairs, and nonwords.
   * @type {Object}
   */
  data: {
    relatedPairs: [
      { prime: 'DOCTOR', target: 'NURSE' },
      { prime: 'BREAD', target: 'BUTTER' },
      { prime: 'TABLE', target: 'CHAIR' },
      { prime: 'BLACK', target: 'WHITE' },
      { prime: 'KING', target: 'QUEEN' },
      { prime: 'HOT', target: 'COLD' },
      { prime: 'SALT', target: 'PEPPER' },
      { prime: 'CAT', target: 'DOG' },
      { prime: 'MOON', target: 'STAR' },
      { prime: 'LOCK', target: 'KEY' }
    ],
    unrelatedPairs: [
      { prime: 'DOCTOR', target: 'BUTTER' },
      { prime: 'BREAD', target: 'CHAIR' },
      { prime: 'TABLE', target: 'WHITE' },
      { prime: 'BLACK', target: 'QUEEN' },
      { prime: 'KING', target: 'COLD' },
      { prime: 'HOT', target: 'PEPPER' },
      { prime: 'SALT', target: 'DOG' },
      { prime: 'CAT', target: 'STAR' },
      { prime: 'MOON', target: 'KEY' },
      { prime: 'LOCK', target: 'NURSE' }
    ],
    nonwordTargets: [
      'FLIRP', 'BRANE', 'SLONT', 'NARP', 'CROPE',
      'BLINT', 'DRANE', 'SMAVE', 'TROCK', 'PRUNG'
    ],
    // Primes for nonword trials (use same primes as related pairs)
    nonwordPrimes: [
      'DOCTOR', 'BREAD', 'TABLE', 'BLACK', 'KING',
      'HOT', 'SALT', 'CAT', 'MOON', 'LOCK'
    ]
  },

  /**
   * Timing parameters in milliseconds.
   * SOA = fixation + primeDuration + ISI.
   * @type {Object}
   */
  timing: {
    fixation: 500,
    primeDuration: 200,
    soa: 250, // Stimulus Onset Asynchrony
    isi: 50,  // Inter-Stimulus Interval (blank between prime and target)
    responseTimeout: 3000,
    feedbackDuration: 300,
    iti: 1000 // Inter-Trial Interval
  },

  /**
   * Response key mappings.
   * Arrow keys for word/nonword decisions.
   * @type {Object}
   */
  responseKeys: {
    word: 'arrowright',
    nonword: 'arrowleft'
  },

  /**
   * Experiment state tracking.
   * @type {Object}
   */
  state: {
    trials: [],
    currentTrial: 0,
    results: [],
    stimulusOnset: 0,
    awaitingResponse: false,
    openedFromBuilder: false,
    phase: 'setup' // setup, fixation, prime, isi, target, feedback, results
  },

  /**
   * Custom stimuli from Template Builder.
   * @type {Object}
   */
  builderStimuli: {
    relatedPairs: [],
    unrelatedPairs: [],
    nonwordTargets: []
  },

  /** @type {string} Experimenter email for data attribution */
  experimenterEmail: '',
  /** @type {string} User-defined experiment identifier */
  userExperimentId: '',
  /** @type {boolean} Whether running in participant mode (via URL) */
  isParticipantMode: false,
  /** @type {number} Repetitions per condition */
  trialsPerCondition: 10,
  /** @type {boolean} Whether to show accuracy feedback */
  showFeedback: true,

  /**
   * Initialize Semantic module.
   * Sets up keyboard event listener.
   */
  init: function() {
    if (this._initDone) return;          // was unguarded: every call bound another keydown listener
    this._initDone = true;
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    // Installs _after()/_clearTimers(). The response window was already stored
    // and cleared, but the display chain (fixation -> prime -> ISI -> target)
    // and the feedback/ITI advance timers were not, and close() cleared none
    // of them - so the chain survived the overlay closing.
    PTK.timers(this);
    console.log('Semantic Priming module initialized');
  },

  /**
   * Open Semantic experiment overlay.
   * Shows setup screen, renders response keys.
   */
  open: function() {
    document.getElementById('semantic-overlay').classList.add('active');
    document.getElementById('semantic-setup').style.display = 'block';
    document.getElementById('semantic-trial').classList.remove('active');
    document.getElementById('semantic-results').classList.remove('active');
    this.renderResponseKeys();
    this.state.phase = 'setup';
  },

  /**
   * Close Semantic overlay.
   * Returns to builder or shows thank-you if participant mode.
   */
  close: function() {
    this._clearTimers();
    clearTimeout(this.responseTimeout);
    document.getElementById('semantic-overlay').classList.remove('active');
    this.state.awaitingResponse = false;
    this.state.phase = 'setup';

    if (this.state.openedFromBuilder) {
      this.state.openedFromBuilder = false;
      this.openBuilder();
    } else if (this.isParticipantMode) {
      this.showThankYou();
    }
  },

  /**
   * Display thank-you modal for participants.
   */
  showThankYou: function() {
    window.history.replaceState({}, document.title, window.location.pathname);
    this.isParticipantMode = false;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.85); z-index: 2000;
      display: flex; justify-content: center; align-items: center;
    `;
    modal.innerHTML = `
      <div style="background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(74, 222, 128, 0.5); border-radius: 20px; padding: 50px; max-width: 500px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 20px;">&#10003;</div>
        <h2 style="color: #4ade80; margin-bottom: 15px;">Thank You!</h2>
        <p style="color: #c0c0c0; margin-bottom: 25px; font-size: 16px;">
          Your responses have been recorded successfully.<br>
          You may now close this window.
        </p>
        <button onclick="this.closest('div').parentElement.remove()" style="background: linear-gradient(135deg, #4ade80, #22c55e); border: none; color: white; padding: 14px 35px; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: 600;">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  },

  /**
   * Render response key hints in UI.
   * Shows arrow keys for word/nonword decisions.
   */
  renderResponseKeys: function() {
    const container = document.getElementById('semantic-keys-container');
    if (!container) return;

    const nonwordKey = this.responseKeys.nonword.toLowerCase() === 'arrowleft' ? '←' : this.responseKeys.nonword.toUpperCase();
    const wordKey = this.responseKeys.word.toLowerCase() === 'arrowright' ? '→' : this.responseKeys.word.toUpperCase();

    container.innerHTML = `
      <div class="key-hint">
        <span class="key">${nonwordKey}</span>
        <span class="label" style="color: #ff6b6b;">NONWORD</span>
      </div>
      <div class="key-hint">
        <span class="key">${wordKey}</span>
        <span class="label" style="color: #4ade80;">WORD</span>
      </div>
    `;
  },

  /**
   * Generate randomized trial list.
   * Three conditions: related, unrelated, nonword.
   * @returns {Array} Shuffled array of trial objects
   */
  generateTrials: function() {
    const trials = [];
    const reps = this.trialsPerCondition;

    // Use builder stimuli if available, otherwise use defaults
    const relatedPairs = this.builderStimuli.relatedPairs.length > 0
      ? this.builderStimuli.relatedPairs
      : this.data.relatedPairs;
    const unrelatedPairs = this.builderStimuli.unrelatedPairs.length > 0
      ? this.builderStimuli.unrelatedPairs
      : this.data.unrelatedPairs;
    const nonwordTargets = this.builderStimuli.nonwordTargets.length > 0
      ? this.builderStimuli.nonwordTargets
      : this.data.nonwordTargets;
    const nonwordPrimes = this.data.nonwordPrimes;

    // Generate related trials (word targets)
    for (let i = 0; i < reps; i++) {
      relatedPairs.forEach(pair => {
        trials.push({
          prime: pair.prime,
          target: pair.target,
          targetType: 'word',
          condition: 'related',
          correctResponse: 'word'
        });
      });
    }

    // Generate unrelated trials (word targets)
    for (let i = 0; i < reps; i++) {
      unrelatedPairs.forEach(pair => {
        trials.push({
          prime: pair.prime,
          target: pair.target,
          targetType: 'word',
          condition: 'unrelated',
          correctResponse: 'word'
        });
      });
    }

    // Generate nonword trials
    for (let i = 0; i < reps; i++) {
      nonwordTargets.forEach((nonword, idx) => {
        const prime = nonwordPrimes[idx % nonwordPrimes.length];
        trials.push({
          prime: prime,
          target: nonword,
          targetType: 'nonword',
          condition: 'nonword',
          correctResponse: 'nonword'
        });
      });
    }

    // Shuffle trials
    for (let i = trials.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trials[i], trials[j]] = [trials[j], trials[i]];
    }

    return trials;
  },

  /**
   * Start experiment.
   * Generates trials, shows trial screen.
   */
  start: function() {
    this.state.trials = this.generateTrials();
    this.state.currentTrial = 0;
    this.state.results = [];

    document.getElementById('semantic-setup').style.display = 'none';
    document.getElementById('semantic-results').classList.remove('active');
    document.getElementById('semantic-trial').classList.add('active');
    document.getElementById('semantic-total-trials').textContent = this.state.trials.length;
    document.getElementById('semantic-overlay').focus();

    this.runTrial();
  },

  /**
   * Execute current trial.
   * Sequence: fixation → prime → ISI → target → response.
   */
  runTrial: function() {
    if (this.state.currentTrial >= this.state.trials.length) {
      this.showResults();
      return;
    }

    const trial = this.state.trials[this.state.currentTrial];
    const stimulus = document.getElementById('semantic-stimulus');

    // Update progress
    document.getElementById('semantic-current-trial').textContent = this.state.currentTrial + 1;
    const progress = (this.state.currentTrial / this.state.trials.length) * 100;
    document.getElementById('semantic-progress-fill').style.width = `${progress}%`;

    // Phase 1: Fixation
    this.state.phase = 'fixation';
    this.state.awaitingResponse = false;
    stimulus.innerHTML = '<span class="semantic-fixation">+</span>';

    this._after(() => {
      this.showPrime(trial, stimulus);
    }, this.timing.fixation);
  },

  /**
   * Display prime word.
   * @param {Object} trial - Current trial object
   * @param {HTMLElement} stimulus - Display element
   */
  showPrime: function(trial, stimulus) {
    // Phase 2: Prime
    this.state.phase = 'prime';
    // trial.prime is config-derived and reachable from a ?semantic= link, so it
    // must never be parsed as HTML. See PTK.showText.
    PTK.showText(stimulus, trial.prime, 'semantic-prime');

    // Calculate ISI timing
    // SOA = time from prime onset to target onset
    // If primeDuration = 200ms and SOA = 250ms, then ISI = 50ms
    const isiDuration = Math.max(0, this.timing.soa - this.timing.primeDuration);

    this._after(() => {
      this.showISI(trial, stimulus, isiDuration);
    }, this.timing.primeDuration);
  },

  /**
   * Display inter-stimulus interval (blank).
   * @param {Object} trial - Current trial object
   * @param {HTMLElement} stimulus - Display element
   * @param {number} duration - ISI duration in ms
   */
  showISI: function(trial, stimulus, duration) {
    // Phase 3: ISI (blank or mask)
    this.state.phase = 'isi';
    stimulus.innerHTML = ''; // Blank screen

    if (duration > 0) {
      this._after(() => {
        this.showTarget(trial, stimulus);
      }, duration);
    } else {
      this.showTarget(trial, stimulus);
    }
  },

  /**
   * Display target for lexical decision.
   * Starts response timing and sets timeout.
   * @param {Object} trial - Current trial object
   * @param {HTMLElement} stimulus - Display element
   */
  showTarget: function(trial, stimulus) {
    // Phase 4: Target
    this.state.phase = 'target';
    PTK.showText(stimulus, trial.target, 'semantic-target');
    this.state.stimulusOnset = performance.now();
    this.state.awaitingResponse = true;

    // Set response timeout
    this.responseTimeout = this._after(() => {
      if (this.state.awaitingResponse) {
        this.handleResponse(null, true); // timeout
      }
    }, this.timing.responseTimeout);
  },

  /**
   * Process participant response.
   * Calculates RT, checks correctness.
   * @param {string|null} key - Pressed key or null
   * @param {boolean} timeout - Whether response timed out
   */
  handleResponse: function(key, timeout = false) {
    if (!this.state.awaitingResponse) return;

    clearTimeout(this.responseTimeout);

    const rt = timeout ? null : performance.now() - this.state.stimulusOnset;
    const trial = this.state.trials[this.state.currentTrial];

    let response = null;
    if (!timeout && key) {
      if (key.toLowerCase() === this.responseKeys.word) {
        response = 'word';
      } else if (key.toLowerCase() === this.responseKeys.nonword) {
        response = 'nonword';
      }
    }

    const correct = response === trial.correctResponse;

    this.state.results.push({
      ...trial,
      rt: rt ? Math.round(rt * 100) / 100 : null,
      response: response,
      correct: correct,
      timeout: timeout,
      soa: this.timing.soa
    });

    this.state.awaitingResponse = false;
    this.state.currentTrial++;

    // Show feedback if enabled
    if (this.showFeedback && !timeout) {
      this.displayFeedback(correct);
    } else {
      this._after(() => this.runTrial(), timeout ? 500 : this.timing.iti);
    }
  },

  /**
   * Display accuracy feedback.
   * @param {boolean} correct - Whether response was correct
   */
  displayFeedback: function(correct) {
    const stimulus = document.getElementById('semantic-stimulus');
    this.state.phase = 'feedback';

    if (correct) {
      stimulus.innerHTML = '<span class="feedback-correct" style="font-size: 2rem; color: #4ade80;">Correct</span>';
    } else {
      stimulus.innerHTML = '<span class="feedback-incorrect" style="font-size: 2rem; color: #ff6b6b;">Incorrect</span>';
    }

    this._after(() => this.runTrial(), this.timing.feedbackDuration + this.timing.iti);
  },

  /**
   * Keyboard event handler.
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeydown: function(e) {
    const overlay = document.getElementById('semantic-overlay');
    const trial = document.getElementById('semantic-trial');

    if (overlay && overlay.classList.contains('active') && trial && trial.classList.contains('active')) {
      const validKeys = [this.responseKeys.word, this.responseKeys.nonword];
      const key = e.key.toLowerCase();
      if (validKeys.includes(key)) {
        e.preventDefault();
        this.handleResponse(key);
      }
    }
  },

  /**
   * Calculate and display results.
   * Computes priming effect: unrelated RT - related RT.
   */
  showResults: function() {
    this._clearTimers();
    document.getElementById('semantic-trial').classList.remove('active');
    document.getElementById('semantic-results').classList.add('active');
    this.state.phase = 'results';

    // Calculate statistics
    const correctResults = this.state.results.filter(r => r.correct && !r.timeout);
    const relatedResults = correctResults.filter(r => r.condition === 'related');
    const unrelatedResults = correctResults.filter(r => r.condition === 'unrelated');
    const nonwordResults = correctResults.filter(r => r.condition === 'nonword');

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b.rt, 0) / arr.length) : 0;

    const relatedRT = avg(relatedResults);
    const unrelatedRT = avg(unrelatedResults);
    const nonwordRT = avg(nonwordResults);
    const primingEffect = unrelatedRT - relatedRT;

    // Calculate accuracy
    const totalTrials = this.state.results.length;
    const correctTrials = this.state.results.filter(r => r.correct).length;
    const accuracy = Math.round((correctTrials / totalTrials) * 100);

    // Update display
    document.getElementById('semantic-related-rt').textContent = relatedRT;
    document.getElementById('semantic-unrelated-rt').textContent = unrelatedRT;
    document.getElementById('semantic-nonword-rt').textContent = nonwordRT;
    document.getElementById('semantic-priming-effect').textContent = primingEffect;
    document.getElementById('semantic-accuracy').textContent = accuracy + '%';

    // Generate explanation
    const explanation = this.generateExplanation(relatedRT, unrelatedRT, primingEffect);
    document.getElementById('semantic-explanation').textContent = explanation;

    // Save to Supabase
    this.saveResults();
  },

  /**
   * Generate explanation of priming results.
   * Interprets effect magnitude and direction.
   * @param {number} relatedRT - Mean RT for related pairs
   * @param {number} unrelatedRT - Mean RT for unrelated pairs
   * @param {number} primingEffect - RT difference (unrelated - related)
   * @returns {string} Explanation text
   */
  generateExplanation: function(relatedRT, unrelatedRT, primingEffect) {
    if (primingEffect > 30) {
      return `You showed a robust semantic priming effect of ${primingEffect}ms. ` +
        `Related word pairs (${relatedRT}ms) were recognized significantly faster than ` +
        `unrelated pairs (${unrelatedRT}ms). This suggests strong automatic spreading ` +
        `activation in your semantic memory - when you saw a prime word like "DOCTOR", ` +
        `it pre-activated related concepts like "NURSE", making them easier to recognize.`;
    } else if (primingEffect > 10) {
      return `You showed a modest semantic priming effect of ${primingEffect}ms. ` +
        `Related pairs (${relatedRT}ms) were faster than unrelated pairs (${unrelatedRT}ms). ` +
        `This demonstrates the typical facilitation effect where semantically related ` +
        `words prime each other through spreading activation.`;
    } else if (primingEffect > -10) {
      return `Your priming effect (${primingEffect}ms) was close to zero. ` +
        `Related pairs (${relatedRT}ms) and unrelated pairs (${unrelatedRT}ms) ` +
        `were processed at similar speeds. This could be due to strategic processing ` +
        `or the short SOA used in this version.`;
    } else {
      return `Interestingly, you showed a reversed priming effect (${primingEffect}ms). ` +
        `Unrelated pairs (${unrelatedRT}ms) were actually faster than related pairs (${relatedRT}ms). ` +
        `This unusual pattern might reflect inhibition or expectancy violation effects.`;
    }
  },

  /**
   * Save trial results to Supabase.
   */
  saveResults: function() {
    const experimentId = 'semantic_priming_' + Date.now().toString(36).slice(-6);
    const participantId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

    const dataToSave = this.state.results.map((r, i) => ({
      experiment_id: this.userExperimentId || experimentId,
      participant_id: participantId,
      trial_number: i + 1,
      prime_word: r.prime,
      target_word: r.target,
      target_type: r.targetType,
      condition: r.condition,
      response: r.response,
      correct: r.correct,
      rt: r.rt,
      timeout: r.timeout || false,
      soa: r.soa,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    }));

    // Save using PTA core if available
    if (window.PTA && PTA.saveAllResults) {
      PTA.saveAllResults('experiment_results', dataToSave)
        .then(result => {
          if (result.error) {
            console.error('Error saving semantic priming results:', result.error);
          } else {
            console.log('Semantic priming results saved:', dataToSave.length, 'trials');
          }
        });
    } else {
      console.log('PTA not available, results not saved to database');
      console.log('Results:', dataToSave);
    }
  },

  /**
   * Export results to CSV file.
   */
  exportCSV: function() {
    if (!this.state.results.length) {
      alert('No results to export');
      return;
    }

    const headers = ['Trial', 'Prime', 'Target', 'Target Type', 'Condition', 'Response', 'Correct', 'RT (ms)', 'SOA (ms)'];
    const rows = this.state.results.map((r, i) => [
      i + 1,
      r.prime,
      r.target,
      r.targetType,
      r.condition,
      r.response || 'timeout',
      r.correct ? 'Yes' : 'No',
      r.rt ? Math.round(r.rt) : 'timeout',
      r.soa
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `semantic_priming_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  },

  /**
   * Export results to Excel file.
   * Requires SheetJS library.
   */
  exportXLSX: function() {
    if (!this.state.results.length) {
      alert('No results to export');
      return;
    }

    if (!window.XLSX) {
      alert('Excel export not available');
      return;
    }

    const rawData = [
      ['Trial', 'Prime', 'Target', 'Target Type', 'Condition', 'Response', 'Correct', 'RT (ms)', 'SOA (ms)'],
      ...this.state.results.map((r, i) => [
        i + 1,
        r.prime,
        r.target,
        r.targetType,
        r.condition,
        r.response || 'timeout',
        r.correct ? 'Yes' : 'No',
        r.rt ? Math.round(r.rt) : 'timeout',
        r.soa
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `semantic_priming_results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  /**
   * Open Template Builder overlay.
   */
  openBuilder: function() {
    document.getElementById('semantic-builder-overlay').classList.add('active');
    this.initBuilderStimuli();
    this.renderBuilderTables();
    this.updateBuilderPreview();
  },

  /**
   * Close Template Builder overlay.
   */
  closeBuilder: function() {
    document.getElementById('semantic-builder-overlay').classList.remove('active');
  },

  /**
   * Initialize builder with default stimuli.
   */
  initBuilderStimuli: function() {
    // Initialize with default stimuli if empty
    if (this.builderStimuli.relatedPairs.length === 0) {
      this.builderStimuli.relatedPairs = [...this.data.relatedPairs];
    }
    if (this.builderStimuli.unrelatedPairs.length === 0) {
      this.builderStimuli.unrelatedPairs = [...this.data.unrelatedPairs];
    }
    if (this.builderStimuli.nonwordTargets.length === 0) {
      this.builderStimuli.nonwordTargets = [...this.data.nonwordTargets];
    }
  },

  /**
   * Render editable stimulus tables in builder.
   */
  renderBuilderTables: function() {
    // Render related pairs table
    const relatedTbody = document.getElementById('semantic-related-tbody');
    if (relatedTbody) {
      relatedTbody.innerHTML = '';
      this.builderStimuli.relatedPairs.forEach((pair, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><input type="text" value="${PTK.esc(pair.prime)}" onchange="Semantic.updatePair('related', ${idx}, 'prime', this.value)" onclick="event.stopPropagation()"></td>
          <td><input type="text" value="${PTK.esc(pair.target)}" onchange="Semantic.updatePair('related', ${idx}, 'target', this.value)" onclick="event.stopPropagation()"></td>
          <td><button class="btn-remove-row" onclick="event.stopPropagation(); Semantic.removePair('related', ${idx})" ${this.builderStimuli.relatedPairs.length <= 3 ? 'disabled' : ''}>x</button></td>
        `;
        relatedTbody.appendChild(row);
      });
    }

    // Render unrelated pairs table
    const unrelatedTbody = document.getElementById('semantic-unrelated-tbody');
    if (unrelatedTbody) {
      unrelatedTbody.innerHTML = '';
      this.builderStimuli.unrelatedPairs.forEach((pair, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><input type="text" value="${PTK.esc(pair.prime)}" onchange="Semantic.updatePair('unrelated', ${idx}, 'prime', this.value)" onclick="event.stopPropagation()"></td>
          <td><input type="text" value="${PTK.esc(pair.target)}" onchange="Semantic.updatePair('unrelated', ${idx}, 'target', this.value)" onclick="event.stopPropagation()"></td>
          <td><button class="btn-remove-row" onclick="event.stopPropagation(); Semantic.removePair('unrelated', ${idx})" ${this.builderStimuli.unrelatedPairs.length <= 3 ? 'disabled' : ''}>x</button></td>
        `;
        unrelatedTbody.appendChild(row);
      });
    }

    // Render nonword targets
    const nonwordTbody = document.getElementById('semantic-nonword-tbody');
    if (nonwordTbody) {
      nonwordTbody.innerHTML = '';
      this.builderStimuli.nonwordTargets.forEach((nonword, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><input type="text" value="${PTK.esc(nonword)}" onchange="Semantic.updateNonword(${idx}, this.value)" onclick="event.stopPropagation()"></td>
          <td><button class="btn-remove-row" onclick="event.stopPropagation(); Semantic.removeNonword(${idx})" ${this.builderStimuli.nonwordTargets.length <= 3 ? 'disabled' : ''}>x</button></td>
        `;
        nonwordTbody.appendChild(row);
      });
    }
  },

  /**
   * Update word pair in builder.
   * @param {string} type - 'related' or 'unrelated'
   * @param {number} index - Pair index
   * @param {string} field - 'prime' or 'target'
   * @param {string} value - New word value
   */
  updatePair: function(type, index, field, value) {
    const pairs = type === 'related' ? this.builderStimuli.relatedPairs : this.builderStimuli.unrelatedPairs;
    pairs[index][field] = value.toUpperCase();
    this.updateBuilderPreview();
  },

  /**
   * Add new word pair to builder.
   * @param {string} type - 'related' or 'unrelated'
   */
  addPair: function(type) {
    const pairs = type === 'related' ? this.builderStimuli.relatedPairs : this.builderStimuli.unrelatedPairs;
    pairs.push({ prime: '', target: '' });
    this.renderBuilderTables();
  },

  /**
   * Remove word pair from builder.
   * @param {string} type - 'related' or 'unrelated'
   * @param {number} index - Pair index to remove
   */
  removePair: function(type, index) {
    const pairs = type === 'related' ? this.builderStimuli.relatedPairs : this.builderStimuli.unrelatedPairs;
    if (pairs.length <= 3) {
      alert('You need at least 3 pairs.');
      return;
    }
    pairs.splice(index, 1);
    this.renderBuilderTables();
  },

  /**
   * Update nonword in builder.
   * @param {number} index - Nonword index
   * @param {string} value - New nonword value
   */
  updateNonword: function(index, value) {
    this.builderStimuli.nonwordTargets[index] = value.toUpperCase();
  },

  /**
   * Add new nonword to builder.
   */
  addNonword: function() {
    this.builderStimuli.nonwordTargets.push('');
    this.renderBuilderTables();
  },

  /**
   * Remove nonword from builder.
   * @param {number} index - Nonword index to remove
   */
  removeNonword: function(index) {
    if (this.builderStimuli.nonwordTargets.length <= 3) {
      alert('You need at least 3 nonwords.');
      return;
    }
    this.builderStimuli.nonwordTargets.splice(index, 1);
    this.renderBuilderTables();
  },

  /**
   * Update live preview in builder.
   */
  updateBuilderPreview: function() {
    // Update the preview animation
    const previewPrime = document.getElementById('semantic-preview-prime');
    const previewTarget = document.getElementById('semantic-preview-target');

    if (previewPrime && previewTarget && this.builderStimuli.relatedPairs.length > 0) {
      const pair = this.builderStimuli.relatedPairs[0];
      previewPrime.textContent = pair.prime;
      previewTarget.textContent = pair.target;
    }
  },

  /**
   * Update timing parameter from builder.
   * @param {string} param - Timing parameter name
   * @param {string} value - New value (will be parsed as int)
   */
  updateTiming: function(param, value) {
    this.timing[param] = parseInt(value) || this.timing[param];
    // Update total duration display
    const total = this.timing.fixation + this.timing.soa + this.timing.responseTimeout;
    const totalEl = document.getElementById('semantic-total-duration');
    if (totalEl) {
      totalEl.textContent = total;
    }
  },

  /**
   * Launch experiment preview from builder.
   */
  previewFromBuilder: function() {
    // Get settings from builder
    const trialsEl = document.getElementById('semantic-builder-trials');
    const feedbackEl = document.getElementById('semantic-builder-feedback');
    const fixationEl = document.getElementById('semantic-builder-fixation');
    const soaEl = document.getElementById('semantic-builder-soa');
    const primeEl = document.getElementById('semantic-builder-prime-duration');

    if (trialsEl) this.trialsPerCondition = parseInt(trialsEl.value) || 10;
    if (feedbackEl) this.showFeedback = feedbackEl.value === 'yes';
    if (fixationEl) this.timing.fixation = parseInt(fixationEl.value) || 500;
    if (soaEl) this.timing.soa = parseInt(soaEl.value) || 250;
    if (primeEl) this.timing.primeDuration = parseInt(primeEl.value) || 200;

    this.state.openedFromBuilder = true;
    this.closeBuilder();
    this.open();
  },

  /**
   * Generate unique experiment ID.
   */
  generateExperimentId: function() {
    const el = document.getElementById('semanticExperimentId');
    if (el) {
      el.value = 'semantic_' + Date.now().toString(36);
      el.style.borderColor = 'rgba(74, 222, 128, 0.7)';
    }
  },

  /**
   * Test Supabase connection.
   * @async
   */
  testConnection: async function() {
    const statusEl = document.getElementById('semantic-connection-status');
    const statusText = statusEl ? statusEl.querySelector('.status-text') : null;

    try {
      if (window.PTA && PTA.supabase) {
        // Simple connection test
        const { error } = await PTA.supabase.from('experiment_results').select('id').limit(1);
        if (!error) {
          if (statusEl) statusEl.classList.remove('error');
          if (statusText) statusText.innerHTML = '<strong>Connected</strong> - Data will be saved automatically';
        } else {
          if (statusEl) statusEl.classList.add('error');
          if (statusText) statusText.innerHTML = '<strong>Connection Failed</strong> - ' + error.message;
        }
      } else {
        if (statusEl) statusEl.classList.remove('error');
        if (statusText) statusText.innerHTML = '<strong>Connected</strong> - Data will be saved automatically';
      }
    } catch (error) {
      if (statusEl) statusEl.classList.add('error');
      if (statusText) statusText.innerHTML = '<strong>Error</strong> - ' + error.message;
    }
  },

  /**
   * Generate shareable experiment link.
   */
  generateLink: function() {
    // Get experimenter info
    const emailEl = document.getElementById('semanticExperimenterEmail');
    const expIdEl = document.getElementById('semanticExperimentId');
    const email = emailEl ? emailEl.value.trim() : '';
    const expId = expIdEl ? expIdEl.value.trim() : '';

    // Get settings
    const trialsEl = document.getElementById('semantic-builder-trials');
    const feedbackEl = document.getElementById('semantic-builder-feedback');
    const fixationEl = document.getElementById('semantic-builder-fixation');
    const soaEl = document.getElementById('semantic-builder-soa');
    const primeEl = document.getElementById('semantic-builder-prime-duration');

    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    if (!expId || expId.length < 3) {
      alert('Please enter an Experiment ID (at least 3 characters).');
      return;
    }

    const config = {
      template: 'semantic-priming',
      experimenterEmail: email,
      userExperimentId: expId,
      trialsPerCondition: trialsEl ? parseInt(trialsEl.value) : 10,
      showFeedback: feedbackEl ? feedbackEl.value === 'yes' : true,
      timing: {
        fixation: fixationEl ? parseInt(fixationEl.value) : 500,
        soa: soaEl ? parseInt(soaEl.value) : 250,
        primeDuration: primeEl ? parseInt(primeEl.value) : 200
      },
      stimuli: {
        relatedPairs: this.builderStimuli.relatedPairs,
        unrelatedPairs: this.builderStimuli.unrelatedPairs,
        nonwordTargets: this.builderStimuli.nonwordTargets
      }
    };

    try {
      const configStr = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
      const link = window.location.href.split('?')[0] + '?semantic=' + configStr;

      // Show modal with link
      this.showLinkModal(link);
      console.log('Semantic priming link generated:', link);
    } catch (error) {
      console.error('Error generating link:', error);
      alert('Error generating link. Please try again.');
    }
  },

  /**
   * Display modal with copyable experiment link.
   * @param {string} link - Generated experiment URL
   */
  showLinkModal: function(link) {
    const modal = document.createElement('div');
    modal.id = 'semantic-link-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.9); z-index: 2000;
      display: flex; justify-content: center; align-items: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(102, 126, 234, 0.3);
      border-radius: 20px; padding: 40px; max-width: 650px; text-align: center;
    `;

    const title = document.createElement('h2');
    title.style.cssText = 'color: #ffffff; margin-bottom: 20px;';
    title.textContent = 'Your Experiment Link is Ready!';

    const subtitle = document.createElement('p');
    subtitle.style.cssText = 'color: #9aa6b2; margin-bottom: 10px;';
    subtitle.textContent = 'Send this link to your participants:';

    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.value = link;
    linkInput.readOnly = true;
    linkInput.style.cssText = `
      width: 100%; padding: 15px; background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
      color: #ffffff; font-size: 0.85rem; margin-bottom: 20px;
    `;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 15px; justify-content: center;';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Link';
    copyBtn.style.cssText = `
      background: linear-gradient(135deg, #667eea, #764ba2); border: none;
      color: white; padding: 12px 25px; border-radius: 8px; cursor: pointer;
    `;
    copyBtn.onclick = function() {
      navigator.clipboard.writeText(link).then(() => alert('Link copied!'));
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      color: white; padding: 12px 25px; border-radius: 8px; cursor: pointer;
    `;
    closeBtn.onclick = function() {
      modal.remove();
    };

    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(subtitle);
    modalContent.appendChild(linkInput);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  },

  /**
   * Check URL for experiment configuration.
   * Parses ?semantic= parameter, enters participant mode.
   * @returns {boolean} True if valid config found
   */
  checkUrlConfig: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const semanticConfig = urlParams.get('semantic');

    if (semanticConfig) {
      try {
        const config = JSON.parse(decodeURIComponent(escape(atob(semanticConfig))));
        if (config.template === 'semantic-priming') {
          this.isParticipantMode = true;
          this.experimenterEmail = config.experimenterEmail || '';
          this.userExperimentId = config.userExperimentId || '';
          this.trialsPerCondition = config.trialsPerCondition || 10;
          this.showFeedback = config.showFeedback !== false;

          // Apply timing
          if (config.timing) {
            this.timing.fixation = config.timing.fixation || 500;
            this.timing.soa = config.timing.soa || 250;
            this.timing.primeDuration = config.timing.primeDuration || 200;
          }

          // Apply custom stimuli
          if (config.stimuli) {
            if (config.stimuli.relatedPairs && config.stimuli.relatedPairs.length > 0) {
              this.builderStimuli.relatedPairs = config.stimuli.relatedPairs;
            }
            if (config.stimuli.unrelatedPairs && config.stimuli.unrelatedPairs.length > 0) {
              this.builderStimuli.unrelatedPairs = config.stimuli.unrelatedPairs;
            }
            if (config.stimuli.nonwordTargets && config.stimuli.nonwordTargets.length > 0) {
              this.builderStimuli.nonwordTargets = config.stimuli.nonwordTargets;
            }
          }

          // Hide main layout for participants
          const layout = document.querySelector('.layout');
          if (layout) layout.style.display = 'none';

          // Open Semantic directly
          this.open();
          return true;
        }
      } catch (e) {
        console.error('Error parsing semantic experiment config:', e);
      }
    }
    return false;
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  Semantic.init();
});

console.log('Semantic Priming module loaded');
