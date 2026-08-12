/*
 * PREVIOUS VERSIONS ON GITHUB, newest first. Every change to this file adds a
 * line here, so any earlier state can be recovered if something goes wrong.
 *
 *   before the ABCD footnotes and the template-editing fixes, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/68bddb7/js/evaluative.js
 */
/*
 * PREVIOUS VERSIONS ON GITHUB, newest first. Every change to this file adds a
 * line here, so any earlier state can be recovered if something goes wrong.
 *
 *   before the ABCD footnotes and the template-editing fixes, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/68bddb7/js/evaluative.js
 *
 *   before the full-codebase read of 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/02cecb1/js/evaluative.js
 *
 *   before a failed database save stopped being a console line, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/934c0b5/js/evaluative.js
 *
 *   before this paradigm carried the ABCD panel on its setup screen, 2026-08-11
 *   https://github.com/shir-openu/PrimingToolbox/blob/e090bd3/js/evaluative.js
 */
/**
 * =====================================================
 * PrimingToolbox - Evaluative Conditioning Module
 * =====================================================
 *
 * Based on De Houwer et al. (2001) and Hofmann et al. (2010).
 *
 * Two-phase design:
 * - Learning Phase: CS-US pairings (no response required)
 * - Test Phase: Rate CS valence on 7-point scale
 *
 * ABCD Framework Mapping:
 * - A (Prime): US (positive/negative valence)
 * - B (Target): CS (neutral stimulus)
 * - C (Baseline): Initial neutral valence
 * - D (Measured): Post-conditioning valence rating
 * - EC Effect = Mean(positive-paired) - Mean(negative-paired)
 *
 * Features:
 * - Configurable CS-US pairing repetitions
 * - Simultaneous or sequential presentation
 * - Template Builder for customization
 * - Supabase data collection
 * - Export to CSV/Excel
 *
 * @module EvaluativeConditioning
 * @version 1.0
 * @requires PTA (core.js)
 * =====================================================
 */

/**
 * Evaluative Conditioning namespace.
 * @namespace EvaluativeConditioning
 */
window.EvaluativeConditioning = {
  /**
   * This experiment, described in the ABCD framework.
   */
  abcdSpec: {
    accent: '#39d461',
    articleAnchor: '#s2',
    abcd: {
      A: 'The valenced word repeatedly paired with a neutral shape in the learning phase (HAPPY, or PAIN).',
      B: 'The neutral shape itself, which you rate for pleasantness at test.',
      C: 'The rating that shape would receive without having been paired with anything.',
      D: 'The rating it receives after the pairing.'
    },
    characteristics: {
      association: 'The pairing is the association: repeated co-occurrence is what links A to B in the first place.',
      secondariness: 'At test you rate only the shape, and are never asked about the word it appeared with.',
      modulation: 'Shapes paired with positive words are rated more pleasant than shapes paired with negative ones.'
    },
    boundaryNote: 'Secondariness holds where it is measured. At test you rate the shape and nothing asks you about the word it appeared with - the prime is genuinely incidental to the judgement. See note 1 for the part that is worth arguing about.',
    footnotes: [
      {
        title: 'Two phases, one question.',
        text: 'During the learning phase the pairing is the task, so A is not incidental there. It is at test that A is secondary - and test is where C and D are compared, so that is the phase the definition has to be applied to. Reading it that way, this experiment satisfies all three characteristics.'
      },
      {
        title: 'Why it looks like a hard case.',
        text: 'Conditioning and priming were named by different literatures at different times, and they overlap exactly here. Calling this priming stretches the older, narrower usage; it does not stretch the definition on this page. That is a definition evolving to cover what it always implied, not a paradigm being forced into it.'
      },
      {
        title: 'What C really is here.',
        text: 'The cleanest baseline is the same shape rated by participants who never saw it paired with anything, or paired with a neutral word. Rating a shape before the learning phase also works but is weaker: the pre-rating itself changes the later one.'
      }
    ]
  },


  /**
   * Stimulus configuration data.
   * Contains CS (neutral), positive US, and negative US.
   * @type {Object}
   */
  data: {
    neutralStimuli: [
      { id: 'cs1', type: 'image', label: 'Shape A', src: null, color: '#808080' },
      { id: 'cs2', type: 'image', label: 'Shape B', src: null, color: '#a0a0a0' },
      { id: 'cs3', type: 'image', label: 'Shape C', src: null, color: '#606060' },
      { id: 'cs4', type: 'image', label: 'Shape D', src: null, color: '#909090' }
    ],
    // Default US (positive) - happy/pleasant images or words
    positiveUS: [
      { id: 'pos1', type: 'word', content: 'HAPPY', color: '#4ade80' },
      { id: 'pos2', type: 'word', content: 'JOY', color: '#4ade80' },
      { id: 'pos3', type: 'word', content: 'LOVE', color: '#4ade80' },
      { id: 'pos4', type: 'word', content: 'SMILE', color: '#4ade80' }
    ],
    // Default US (negative) - sad/unpleasant images or words
    negativeUS: [
      { id: 'neg1', type: 'word', content: 'SAD', color: '#f87171' },
      { id: 'neg2', type: 'word', content: 'FEAR', color: '#f87171' },
      { id: 'neg3', type: 'word', content: 'HATE', color: '#f87171' },
      { id: 'neg4', type: 'word', content: 'PAIN', color: '#f87171' }
    ],
    // Rating scale labels
    ratingLabels: {
      1: 'Very Unpleasant',
      2: 'Unpleasant',
      3: 'Slightly Unpleasant',
      4: 'Neutral',
      5: 'Slightly Pleasant',
      6: 'Pleasant',
      7: 'Very Pleasant'
    }
  },

  /**
   * Experiment state tracking.
   * @type {Object}
   */
  state: {
    phase: 'setup', // setup, learning, test, results
    currentTrial: 0,
    learningTrials: [],
    testTrials: [],
    learningResults: [],
    testResults: [],
    csUSPairings: [], // Which CS is paired with which US (pos/neg)
    stimulusOnset: 0,
    openedFromBuilder: false
  },

  /**
   * Experiment timing and display parameters.
   * @type {Object}
   */
  params: {
    pairingsPerCS: 8,          // Number of CS-US presentations per CS
    csDuration: 2000,          // CS display duration (ms)
    usDuration: 2000,          // US display duration (ms)
    csUSDelay: 0,              // Delay between CS onset and US onset (0 = simultaneous)
    iti: 1500,                 // Inter-trial interval (ms)
    fixationDuration: 500,     // Fixation cross duration (ms)
    ratingScale: 7,            // 1-7 scale for valence rating
    showProgressLearning: true,
    showProgressTest: true,
    instructionLanguage: 'en', // 'en' or 'he'
    testTimeout: 10000         // Max time for rating response (ms)
  },

  /** @type {string} Experimenter email */
  experimenterEmail: '',
  /** @type {string} User experiment ID */
  userExperimentId: '',
  /** @type {boolean} Participant mode flag */
  isParticipantMode: false,

  /**
   * Initialize EC module.
   * Sets up keyboard listener.
   */
  init: function() {
    if (this._initDone) return;          // was unguarded: every call bound another keydown listener
    this._initDone = true;
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    // Installs _after()/_clearTimers(). This module had EIGHT setTimeout calls
    // and not one clearTimeout, so the learning chain
    //   fixation -> CS/US -> ITI -> next trial
    // kept running after close(): it went on incrementing state.currentTrial and
    // rendering into a hidden overlay. Reaction time cannot detect that.
    PTK.timers(this);
    console.log('Evaluative Conditioning module initialized');
  },

  /**
   * Open EC experiment overlay.
   */
  open: function() {
    const overlay = document.getElementById('evaluative-overlay');
    if (overlay) {
      overlay.classList.add('active');
      this.showSetup();
    }
  },

  /**
   * Close EC overlay.
   */
  close: function() {
    this._clearTimers();
    const overlay = document.getElementById('evaluative-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    this.state.phase = 'setup';

    if (this.state.openedFromBuilder) {
      this.state.openedFromBuilder = false;
      this.openBuilder();
    } else if (this.isParticipantMode) {
      this.showThankYou();
    }
  },

  /**
   * Show setup screen.
   */
  showSetup: function() {
    this.state.phase = 'setup';
    document.getElementById('evaluative-setup').style.display = 'block';
    if (window.PTK) PTK.injectAbcd('evaluative-setup', this.abcdSpec);
    document.getElementById('evaluative-learning').classList.remove('active');
    document.getElementById('evaluative-test').classList.remove('active');
    document.getElementById('evaluative-results').classList.remove('active');
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
   * Generate CS-US valence pairings.
   * Half CS paired with positive US, half with negative.
   */
  generateCSUSPairings: function() {
    // Assign half of CS to positive US, half to negative US
    const csStimuli = [...this.data.neutralStimuli];
    const halfPoint = Math.floor(csStimuli.length / 2);

    this.state.csUSPairings = [];

    // First half paired with positive US
    for (let i = 0; i < halfPoint; i++) {
      this.state.csUSPairings.push({
        cs: csStimuli[i],
        usValence: 'positive',
        us: this.data.positiveUS[i % this.data.positiveUS.length]
      });
    }

    // Second half paired with negative US
    for (let i = halfPoint; i < csStimuli.length; i++) {
      this.state.csUSPairings.push({
        cs: csStimuli[i],
        usValence: 'negative',
        us: this.data.negativeUS[(i - halfPoint) % this.data.negativeUS.length]
      });
    }
  },

  /**
   * Generate learning phase trials.
   * Each CS-US pairing repeated per configuration.
   * @returns {Array} Shuffled learning trial array
   */
  generateLearningTrials: function() {
    const trials = [];

    // Create pairings based on configured repetitions
    this.state.csUSPairings.forEach(pairing => {
      for (let i = 0; i < this.params.pairingsPerCS; i++) {
        // Vary the US within same valence for richness
        const usPool = pairing.usValence === 'positive' ? this.data.positiveUS : this.data.negativeUS;
        const us = usPool[i % usPool.length];

        trials.push({
          type: 'learning',
          cs: pairing.cs,
          us: us,
          usValence: pairing.usValence,
          repetition: i + 1
        });
      }
    });

    // Shuffle trials
    return this.shuffleArray(trials);
  },

  /**
   * Generate test phase trials.
   * Each CS presented once for rating.
   * @returns {Array} Shuffled test trial array
   */
  generateTestTrials: function() {
    const trials = [];

    // Present each CS once for rating
    this.state.csUSPairings.forEach(pairing => {
      trials.push({
        type: 'test',
        cs: pairing.cs,
        pairedValence: pairing.usValence // For later analysis
      });
    });

    // Shuffle test trials
    return this.shuffleArray(trials);
  },

  /**
   * Fisher-Yates shuffle.
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled copy
   */
  shuffleArray: function(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  /**
   * Start experiment.
   * Generates pairings and trials, begins learning phase.
   */
  start: function() {
    // Generate pairings and trials
    this.generateCSUSPairings();
    this.state.learningTrials = this.generateLearningTrials();
    this.state.testTrials = this.generateTestTrials();
    this.state.learningResults = [];
    this.state.testResults = [];
    this.state.currentTrial = 0;

    // Start learning phase
    this.startLearningPhase();
  },

  /**
   * Initialize learning phase UI.
   */
  startLearningPhase: function() {
    this.state.phase = 'learning';
    this.state.currentTrial = 0;

    document.getElementById('evaluative-setup').style.display = 'none';
    document.getElementById('evaluative-learning').classList.add('active');
    document.getElementById('evaluative-test').classList.remove('active');
    document.getElementById('evaluative-results').classList.remove('active');

    const totalTrials = this.state.learningTrials.length;
    document.getElementById('learning-total-trials').textContent = totalTrials;

    // Show instructions briefly before starting
    this.showLearningInstructions();
  },

  /**
   * Display learning phase instructions.
   */
  showLearningInstructions: function() {
    const stimulus = document.getElementById('learning-stimulus');
    stimulus.innerHTML = `
      <div style="text-align: center; padding: 30px;">
        <h3 style="color: #ff4db8; margin-bottom: 20px;">Learning Phase</h3>
        <p style="color: #e5e7eb; font-size: 1.1rem; line-height: 1.8; max-width: 500px; margin: 0 auto;">
          You will see pairs of stimuli.<br>
          Simply <strong>watch and pay attention</strong>.<br>
          No response is required.
        </p>
        <p style="color: #9aa6b2; margin-top: 20px; font-size: 0.95rem;">
          The experiment will begin in a few seconds...
        </p>
      </div>
    `;

    this._after(() => this.runLearningTrial(), 3000);
  },

  /**
   * Execute learning trial.
   * Shows CS-US pairing, records exposure data.
   */
  runLearningTrial: function() {
    if (this.state.currentTrial >= this.state.learningTrials.length) {
      this.startTestPhase();
      return;
    }

    const trial = this.state.learningTrials[this.state.currentTrial];
    const stimulus = document.getElementById('learning-stimulus');

    // Update progress
    document.getElementById('learning-current-trial').textContent = this.state.currentTrial + 1;
    const progress = (this.state.currentTrial / this.state.learningTrials.length) * 100;
    document.getElementById('learning-progress-fill').style.width = `${progress}%`;

    // Show fixation
    stimulus.innerHTML = '<span class="fixation-cross">+</span>';

    this._after(() => {
      // Show CS and US together (or sequentially based on params)
      this.displayCSUS(trial, stimulus);

      // Record learning trial data
      this.state.learningResults.push({
        trialNumber: this.state.currentTrial + 1,
        csId: trial.cs.id,
        csLabel: trial.cs.label,
        usId: trial.us.id,
        usContent: trial.us.content,
        usValence: trial.usValence,
        repetition: trial.repetition,
        timestamp: Date.now()
      });

      // After stimulus duration, move to next trial
      const totalDuration = this.params.csUSDelay > 0
        ? this.params.csDuration + this.params.csUSDelay + this.params.usDuration
        : Math.max(this.params.csDuration, this.params.usDuration);

      this._after(() => {
        this.state.currentTrial++;
        // ITI before next trial
        stimulus.innerHTML = '';
        this._after(() => this.runLearningTrial(), this.params.iti);
      }, totalDuration);
    }, this.params.fixationDuration);
  },

  /**
   * Display CS-US stimulus pair.
   * Supports simultaneous or sequential presentation.
   * @param {Object} trial - Trial with CS and US data
   * @param {HTMLElement} container - Display container
   */
  displayCSUS: function(trial, container) {
    const cs = trial.cs;
    const us = trial.us;

    // Simultaneous presentation (csUSDelay = 0)
    if (this.params.csUSDelay === 0) {
      container.innerHTML = `
        <div class="csus-display">
          <div class="cs-stimulus">
            ${this.renderStimulus(cs, 'cs')}
          </div>
          <div class="us-stimulus">
            ${this.renderStimulus(us, 'us')}
          </div>
        </div>
      `;
    } else {
      // Sequential: CS first, then US
      container.innerHTML = `
        <div class="csus-display">
          <div class="cs-stimulus">
            ${this.renderStimulus(cs, 'cs')}
          </div>
        </div>
      `;

      this._after(() => {
        container.innerHTML = `
          <div class="csus-display">
            <div class="cs-stimulus">
              ${this.renderStimulus(cs, 'cs')}
            </div>
            <div class="us-stimulus">
              ${this.renderStimulus(us, 'us')}
            </div>
          </div>
        `;
      }, this.params.csUSDelay);
    }
  },

  /**
   * Render single stimulus as HTML.
   * Supports word, image, and shape types.
   * @param {Object} stim - Stimulus object
   * @param {string} type - 'cs' or 'us'
   * @returns {string} HTML string
   */
  renderStimulus: function(stim, type) {
    // stim.content, stim.color, stim.src and stim.label were interpolated raw
    // into innerHTML, and checkUrlConfig fills exactly those fields wholesale
    // from the ?ec= participant link (config.cs -> {label, color},
    // config.positiveUS/negativeUS -> {content, color}). A crafted link ran
    // arbitrary script on a page holding the Supabase anon key. Same class as
    // the holes closed in stroop, semantic, number-priming and amp on
    // 2026-08-10; this module was missed.
    const esc = (window.PTK && PTK.esc) ? PTK.esc : function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };
    if (stim.type === 'word') {
      const color = stim.color || '#ffffff';
      return `<span class="stimulus-word" style="color: ${esc(color)}; font-size: 2.5rem; font-weight: bold;">${esc(stim.content)}</span>`;
    } else if (stim.type === 'image' && stim.src) {
      return `<img src="${esc(stim.src)}" alt="${esc(stim.label)}" class="stimulus-image" style="max-width: 200px; max-height: 200px;">`;
    } else {
      // Default: colored shape
      const color = stim.color || '#808080';
      const shape = type === 'cs' ? 'square' : 'circle';
      const size = '120px';
      const borderRadius = shape === 'circle' ? '50%' : '10px';
      return `
        <div class="stimulus-shape" style="
          width: ${size}; height: ${size};
          background: ${esc(color)};
          border-radius: ${borderRadius};
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; color: #fff;
        ">${esc(stim.label || '')}</div>
      `;
    }
  },

  /**
   * Initialize test phase.
   */
  startTestPhase: function() {
    this.state.phase = 'test';
    this.state.currentTrial = 0;

    document.getElementById('evaluative-learning').classList.remove('active');
    document.getElementById('evaluative-test').classList.add('active');

    const totalTrials = this.state.testTrials.length;
    document.getElementById('test-total-trials').textContent = totalTrials;

    // Show test instructions
    this.showTestInstructions();
  },

  /**
   * Display test phase instructions.
   */
  showTestInstructions: function() {
    const stimulus = document.getElementById('test-stimulus');
    stimulus.innerHTML = `
      <div style="text-align: center; padding: 30px;">
        <h3 style="color: #ff4db8; margin-bottom: 20px;">Rating Phase</h3>
        <p style="color: #e5e7eb; font-size: 1.1rem; line-height: 1.8; max-width: 500px; margin: 0 auto;">
          Now you will see the stimuli one at a time.<br>
          <strong>Rate how pleasant or unpleasant</strong> each one feels to you.<br>
          Use the scale from 1 (Very Unpleasant) to 7 (Very Pleasant).
        </p>
        <p style="color: #9aa6b2; margin-top: 20px; font-size: 0.95rem;">
          The rating phase will begin in a few seconds...
        </p>
      </div>
    `;

    this._after(() => this.runTestTrial(), 3000);
  },

  /**
   * Execute test trial.
   * Shows CS alone, awaits valence rating.
   */
  runTestTrial: function() {
    if (this.state.currentTrial >= this.state.testTrials.length) {
      this.showResults();
      return;
    }

    const trial = this.state.testTrials[this.state.currentTrial];
    const stimulus = document.getElementById('test-stimulus');

    // Update progress
    document.getElementById('test-current-trial').textContent = this.state.currentTrial + 1;
    const progress = (this.state.currentTrial / this.state.testTrials.length) * 100;
    document.getElementById('test-progress-fill').style.width = `${progress}%`;

    // Show fixation
    stimulus.innerHTML = '<span class="fixation-cross">+</span>';

    this._after(() => {
      // Show CS alone
      stimulus.innerHTML = `
        <div class="test-display">
          <div class="cs-stimulus-test">
            ${this.renderStimulus(trial.cs, 'cs')}
          </div>
          <div class="rating-prompt" style="margin-top: 30px; color: #9aa6b2;">
            How pleasant is this stimulus?
          </div>
        </div>
      `;

      this.state.stimulusOnset = performance.now();

      // Enable rating scale
      this.enableRatingScale(trial);
    }, this.params.fixationDuration);
  },

  /**
   * Enable rating scale buttons.
   * @param {Object} trial - Current test trial
   */
  enableRatingScale: function(trial) {
    const ratingContainer = document.getElementById('rating-scale-container');
    ratingContainer.classList.add('active');

    // Remove previous listeners
    const buttons = ratingContainer.querySelectorAll('.rating-button');
    buttons.forEach((btn, index) => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });

    // Add new listeners
    const newButtons = ratingContainer.querySelectorAll('.rating-button');
    newButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const rating = parseInt(btn.dataset.value);
        this.recordTestResponse(trial, rating);
      });
    });
  },

  /**
   * Record rating response.
   * @param {Object} trial - Current trial
   * @param {number} rating - Valence rating (1-7)
   */
  recordTestResponse: function(trial, rating) {
    const rt = performance.now() - this.state.stimulusOnset;

    this.state.testResults.push({
      trialNumber: this.state.currentTrial + 1,
      csId: trial.cs.id,
      csLabel: trial.cs.label,
      pairedValence: trial.pairedValence,
      rating: rating,
      rt: Math.round(rt),
      timestamp: Date.now()
    });

    // Disable rating scale
    document.getElementById('rating-scale-container').classList.remove('active');

    // Move to next trial
    this.state.currentTrial++;
    const stimulus = document.getElementById('test-stimulus');
    stimulus.innerHTML = '';

    this._after(() => this.runTestTrial(), this.params.iti);
  },

  /**
   * Keyboard handler for number key ratings.
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeydown: function(e) {
    const overlay = document.getElementById('evaluative-overlay');
    if (!overlay || !overlay.classList.contains('active')) return;

    // During test phase, allow number keys 1-7 for rating
    if (this.state.phase === 'test') {
      const ratingContainer = document.getElementById('rating-scale-container');
      if (ratingContainer && ratingContainer.classList.contains('active')) {
        // FIXED 2026-08-10. This was hard-coded to ['1'..'7'] while
        // params.ratingScale is configurable. Set the scale to 9 and the
        // buttons rendered 1-9 but the keyboard silently ignored 8 and 9 -
        // the same class of bug as stroop.js scoring against the wrong key.
        const max = parseInt(this.params.ratingScale, 10) || 7;
        const n = parseInt(e.key, 10);
        if (!isNaN(n) && n >= 1 && n <= max) {
          e.preventDefault();
          const trial = this.state.testTrials[this.state.currentTrial];
          this.recordTestResponse(trial, n);
        }
      }
    }
  },

  /**
   * Calculate and display EC results.
   * EC Effect = positive-paired mean - negative-paired mean.
   */
  showResults: function() {
    this._clearTimers();
    this.state.phase = 'results';

    document.getElementById('evaluative-test').classList.remove('active');
    document.getElementById('evaluative-results').classList.add('active');

    // Calculate EC effect
    const positiveRatings = this.state.testResults
      .filter(r => r.pairedValence === 'positive')
      .map(r => r.rating);

    const negativeRatings = this.state.testResults
      .filter(r => r.pairedValence === 'negative')
      .map(r => r.rating);

    const avgPositive = positiveRatings.length > 0
      ? positiveRatings.reduce((a, b) => a + b, 0) / positiveRatings.length
      : 0;

    const avgNegative = negativeRatings.length > 0
      ? negativeRatings.reduce((a, b) => a + b, 0) / negativeRatings.length
      : 0;

    const ecEffect = avgPositive - avgNegative;

    // Update results display
    document.getElementById('result-positive-avg').textContent = avgPositive.toFixed(2);
    document.getElementById('result-negative-avg').textContent = avgNegative.toFixed(2);
    document.getElementById('result-ec-effect').textContent = ecEffect.toFixed(2);

    // Generate explanation
    const explanation = this.generateExplanation(avgPositive, avgNegative, ecEffect);
    document.getElementById('ec-explanation').textContent = explanation;

    // Save to Supabase
    this.saveResults();
  },

  /**
   * Generate explanation of EC results.
   * @param {number} avgPositive - Mean rating for positive-paired CS
   * @param {number} avgNegative - Mean rating for negative-paired CS
   * @param {number} ecEffect - Difference (positive - negative)
   * @returns {string} Explanation text
   */
  generateExplanation: function(avgPositive, avgNegative, ecEffect) {
    if (ecEffect > 1) {
      return `Strong evaluative conditioning effect observed. Stimuli paired with positive images/words ` +
        `were rated significantly more pleasant (${avgPositive.toFixed(1)}) than those paired with ` +
        `negative images/words (${avgNegative.toFixed(1)}). This demonstrates successful transfer of ` +
        `valence through repeated pairings.`;
    } else if (ecEffect > 0.5) {
      return `Moderate evaluative conditioning effect observed. There was a noticeable difference in ` +
        `pleasantness ratings between positively-paired (${avgPositive.toFixed(1)}) and negatively-paired ` +
        `(${avgNegative.toFixed(1)}) stimuli, suggesting partial valence transfer.`;
    } else if (ecEffect > 0) {
      return `Small evaluative conditioning effect observed. The difference between positively-paired ` +
        `(${avgPositive.toFixed(1)}) and negatively-paired (${avgNegative.toFixed(1)}) stimuli was minimal, ` +
        `possibly due to insufficient pairings or weak US stimuli.`;
    } else {
      return `No clear evaluative conditioning effect. Positively-paired stimuli (${avgPositive.toFixed(1)}) ` +
        `were not rated more pleasant than negatively-paired ones (${avgNegative.toFixed(1)}). ` +
        `This could indicate resistance to conditioning or other factors interfering with the effect.`;
    }
  },

  /**
   * Save learning and test results to Supabase.
   * @async
   */
  saveResults: async function() {
    // This guard used to read `if (!window.PTA || !PTA.supabase) return`, which
    // made the rescue path below unreachable in precisely the case it was
    // written for: no client at all (the Supabase CDN script blocked or
    // offline). The run was abandoned before anything could offer it as a file.
    // A missing PTA.supabase is now a failure to be rescued, not a reason to
    // give up; only a missing PTA itself leaves nothing to rescue with.
    if (!window.PTA || typeof PTA.saveAllResults !== 'function') {
      console.error('EC: platform core not loaded - results NOT saved', this.state.testResults);
      return;
    }

    const participantId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    const experimentId = this.userExperimentId || 'evaluative_conditioning_' + Date.now();

    // Save learning phase data
    const learningData = this.state.learningResults.map((trial, index) => ({
      experiment_id: experimentId,
      participant_id: participantId,
      phase: 'learning',
      trial_number: trial.trialNumber,
      cs_id: trial.csId,
      cs_label: trial.csLabel,
      us_id: trial.usId,
      us_content: trial.usContent,
      us_valence: trial.usValence,
      repetition: trial.repetition,
      rating: null,
      rt: null,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    }));

    // Save test phase data
    const testData = this.state.testResults.map((trial) => ({
      experiment_id: experimentId,
      participant_id: participantId,
      phase: 'test',
      trial_number: trial.trialNumber,
      cs_id: trial.csId,
      cs_label: trial.csLabel,
      us_id: null,
      us_content: null,
      us_valence: trial.pairedValence,
      repetition: null,
      rating: trial.rating,
      rt: trial.rt,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    }));

    const allData = [...learningData, ...testData];

    // The fallback to experiment_results is the path that carries the rescue
    // (local copy, visible warning, download button), so every route that fails
    // the ec_results insert has to reach it. It previously did not: `catch` just
    // logged, and PTA.supabase being null throws on the first line - which is
    // the common case when the Supabase CDN script has not loaded, and meant the
    // whole run was discarded without the fallback ever being tried.
    let primaryFailed = null;
    try {
      if (!PTA.supabase) {
        primaryFailed = 'Supabase not initialized';
      } else {
        const { error } = await PTA.supabase
          .from('ec_results')
          .insert(allData);
        if (error) {
          console.error('EC: Error saving results', error);
          primaryFailed = (error && error.message) || String(error);
        } else {
          console.log('EC: Results saved successfully');
        }
      }
    } catch (e) {
      console.error('EC: Exception saving results', e);
      primaryFailed = (e && e.message) || String(e);
    }

    if (primaryFailed) {
      await PTA.saveAllResults('experiment_results', allData, {
        experimentName: 'Evaluative Conditioning',
        host: document.getElementById('evaluative-results'),
        reason: 'ec_results: ' + primaryFailed
      });
    }
  },

  /**
   * Export results to CSV.
   */
  exportCSV: function() {
    if (!this.state.testResults.length) {
      alert('No results to export');
      return;
    }

    const headers = ['Phase', 'Trial', 'CS_ID', 'CS_Label', 'US_Valence', 'Rating', 'RT_ms'];

    const learningRows = this.state.learningResults.map(r => [
      'learning', r.trialNumber, r.csId, r.csLabel, r.usValence, '', ''
    ]);

    const testRows = this.state.testResults.map(r => [
      'test', r.trialNumber, r.csId, r.csLabel, r.pairedValence, r.rating, r.rt
    ]);

    const allRows = [...learningRows, ...testRows];
    const csvContent = [headers, ...allRows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `evaluative_conditioning_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  },

  /**
   * Export results to Excel with separate sheets per phase.
   */
  exportXLSX: function() {
    if (!this.state.testResults.length) {
      alert('No results to export');
      return;
    }

    if (!window.XLSX) {
      alert('Excel export not available');
      return;
    }

    const learningData = [
      ['Trial', 'CS_ID', 'CS_Label', 'US_ID', 'US_Content', 'US_Valence', 'Repetition'],
      ...this.state.learningResults.map(r => [
        r.trialNumber, r.csId, r.csLabel, r.usId, r.usContent, r.usValence, r.repetition
      ])
    ];

    const testData = [
      ['Trial', 'CS_ID', 'CS_Label', 'Paired_Valence', 'Rating', 'RT_ms'],
      ...this.state.testResults.map(r => [
        r.trialNumber, r.csId, r.csLabel, r.pairedValence, r.rating, r.rt
      ])
    ];

    const wb = XLSX.utils.book_new();
    const wsLearning = XLSX.utils.aoa_to_sheet(learningData);
    const wsTest = XLSX.utils.aoa_to_sheet(testData);

    XLSX.utils.book_append_sheet(wb, wsLearning, 'Learning Phase');
    XLSX.utils.book_append_sheet(wb, wsTest, 'Test Phase');

    XLSX.writeFile(wb, `evaluative_conditioning_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  /**
   * Template Builder stimulus configuration.
   * @type {Object}
   */
  builderStimuli: {
    cs: [
      { id: 'cs1', label: 'Shape A', color: '#808080' },
      { id: 'cs2', label: 'Shape B', color: '#a0a0a0' },
      { id: 'cs3', label: 'Shape C', color: '#606060' },
      { id: 'cs4', label: 'Shape D', color: '#909090' }
    ],
    positiveUS: [
      { id: 'pos1', content: 'HAPPY', color: '#4ade80' },
      { id: 'pos2', content: 'JOY', color: '#4ade80' }
    ],
    negativeUS: [
      { id: 'neg1', content: 'SAD', color: '#f87171' },
      { id: 'neg2', content: 'FEAR', color: '#f87171' }
    ]
  },

  /** Open Template Builder overlay. */
  openBuilder: function() {
    document.getElementById('evaluative-builder-overlay').classList.add('active');
    this.renderBuilderTables();
  },

  /** Close Template Builder overlay. */
  closeBuilder: function() {
    document.getElementById('evaluative-builder-overlay').classList.remove('active');
  },

  /** Render all builder stimulus tables. */
  renderBuilderTables: function() {
    this.renderCSTable();
    this.renderUSTable('positive');
    this.renderUSTable('negative');
  },

  /** Render CS (neutral stimuli) table. */
  renderCSTable: function() {
    const tbody = document.getElementById('cs-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    this.builderStimuli.cs.forEach((stim, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="text" value="${PTK.esc(stim.id)}" onchange="EvaluativeConditioning.updateCS(${index}, 'id', this.value)"></td>
        <td><input type="text" value="${PTK.esc(stim.label)}" onchange="EvaluativeConditioning.updateCS(${index}, 'label', this.value)"></td>
        <td><input type="color" value="${PTK.esc(stim.color)}" onchange="EvaluativeConditioning.updateCS(${index}, 'color', this.value)"></td>
        <td><button class="btn-remove-row" onclick="EvaluativeConditioning.removeCS(${index})" ${this.builderStimuli.cs.length <= 2 ? 'disabled' : ''}>x</button></td>
      `;
      tbody.appendChild(row);
    });
  },

  /**
   * Render US table for given valence.
   * @param {string} valence - 'positive' or 'negative'
   */
  renderUSTable: function(valence) {
    const tbodyId = valence === 'positive' ? 'positive-us-table-body' : 'negative-us-table-body';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const usArray = valence === 'positive' ? this.builderStimuli.positiveUS : this.builderStimuli.negativeUS;

    tbody.innerHTML = '';

    usArray.forEach((stim, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="text" value="${PTK.esc(stim.id)}" onchange="EvaluativeConditioning.updateUS('${valence}', ${index}, 'id', this.value)"></td>
        <td><input type="text" value="${PTK.esc(stim.content)}" onchange="EvaluativeConditioning.updateUS('${valence}', ${index}, 'content', this.value)"></td>
        <td><input type="color" value="${PTK.esc(stim.color)}" onchange="EvaluativeConditioning.updateUS('${valence}', ${index}, 'color', this.value)"></td>
        <td><button class="btn-remove-row" onclick="EvaluativeConditioning.removeUS('${valence}', ${index})" ${usArray.length <= 1 ? 'disabled' : ''}>x</button></td>
      `;
      tbody.appendChild(row);
    });
  },

  /** Update CS stimulus property. */
  updateCS: function(index, field, value) {
    this.builderStimuli.cs[index][field] = value;
  },

  /** Update US stimulus property. */
  updateUS: function(valence, index, field, value) {
    if (valence === 'positive') {
      this.builderStimuli.positiveUS[index][field] = value;
    } else {
      this.builderStimuli.negativeUS[index][field] = value;
    }
  },

  /** Add new CS to builder. */
  addCS: function() {
    const newId = 'cs' + (this.builderStimuli.cs.length + 1);
    this.builderStimuli.cs.push({ id: newId, label: 'Shape ' + String.fromCharCode(65 + this.builderStimuli.cs.length), color: '#707070' });
    this.renderCSTable();
  },

  /** Remove CS from builder. */
  removeCS: function(index) {
    if (this.builderStimuli.cs.length <= 2) {
      alert('You need at least 2 CS stimuli.');
      return;
    }
    this.builderStimuli.cs.splice(index, 1);
    this.renderCSTable();
  },

  /** Add new US to builder. */
  addUS: function(valence) {
    const usArray = valence === 'positive' ? this.builderStimuli.positiveUS : this.builderStimuli.negativeUS;
    const prefix = valence === 'positive' ? 'pos' : 'neg';
    const color = valence === 'positive' ? '#4ade80' : '#f87171';
    const newId = prefix + (usArray.length + 1);
    usArray.push({ id: newId, content: '', color: color });
    this.renderUSTable(valence);
  },

  /** Remove US from builder. */
  removeUS: function(valence, index) {
    const usArray = valence === 'positive' ? this.builderStimuli.positiveUS : this.builderStimuli.negativeUS;
    if (usArray.length <= 1) {
      alert('You need at least 1 US stimulus per valence.');
      return;
    }
    usArray.splice(index, 1);
    this.renderUSTable(valence);
  },

  /** Launch experiment preview from builder. */
  previewFromBuilder: function() {
    // Apply builder settings to main data
    this.data.neutralStimuli = this.builderStimuli.cs.map(cs => ({
      id: cs.id,
      type: 'shape',
      label: cs.label,
      color: cs.color
    }));

    this.data.positiveUS = this.builderStimuli.positiveUS.map(us => ({
      id: us.id,
      type: 'word',
      content: us.content,
      color: us.color
    }));

    this.data.negativeUS = this.builderStimuli.negativeUS.map(us => ({
      id: us.id,
      type: 'word',
      content: us.content,
      color: us.color
    }));

    // Get parameters from builder
    const pairingsInput = document.getElementById('builder-pairings');
    if (pairingsInput) {
      this.params.pairingsPerCS = parseInt(pairingsInput.value) || 8;
    }

    this.state.openedFromBuilder = true;
    this.closeBuilder();
    this.open();
  },

  /** Generate shareable experiment link. */
  generateLink: function() {
    const emailEl = document.getElementById('ecExperimenterEmail');
    const expIdEl = document.getElementById('ecExperimentId');
    const email = emailEl ? emailEl.value.trim() : '';
    const expId = expIdEl ? expIdEl.value.trim() : '';

    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    if (!expId || expId.length < 3) {
      alert('Please enter an Experiment ID (at least 3 characters).');
      return;
    }

    const config = {
      template: 'evaluative-conditioning',
      experimenterEmail: email,
      userExperimentId: expId,
      cs: this.builderStimuli.cs,
      positiveUS: this.builderStimuli.positiveUS,
      negativeUS: this.builderStimuli.negativeUS,
      params: {
        pairingsPerCS: document.getElementById('builder-pairings')?.value || 8
      }
    };

    try {
      const configStr = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
      const link = window.location.href.split('?')[0] + '?ec=' + configStr;

      // Show modal with link
      this.showLinkModal(link);
    } catch (error) {
      console.error('Error generating link:', error);
      alert('Error generating link. Please try again.');
    }
  },

  /** Display modal with experiment link. */
  showLinkModal: function(link) {
    const modal = document.createElement('div');
    modal.id = 'ec-link-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.9); z-index: 2000;
      display: flex; justify-content: center; align-items: center;
    `;
    modal.innerHTML = `
      <div style="background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(255, 77, 184, 0.3); border-radius: 20px; padding: 40px; max-width: 650px; text-align: center;">
        <h2 style="color: #ffffff; margin-bottom: 20px;">Your Experiment Link is Ready!</h2>
        <p style="color: #9aa6b2; margin-bottom: 10px;">Send this link to your participants:</p>
        <input type="text" value="${PTK.esc(link)}" readonly style="width: 100%; padding: 15px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #ffffff; font-size: 0.85rem; margin-bottom: 20px;">
        <div style="display: flex; gap: 15px; justify-content: center;">
          <button onclick="navigator.clipboard.writeText('${link}').then(() => alert('Link copied!'))" style="background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white; padding: 12px 25px; border-radius: 8px; cursor: pointer;">Copy Link</button>
          <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 12px 25px; border-radius: 8px; cursor: pointer;">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  /** Generate unique experiment ID. */
  generateExperimentId: function() {
    const el = document.getElementById('ecExperimentId');
    el.value = 'ec_' + Date.now().toString(36);
    el.style.borderColor = 'rgba(74, 222, 128, 0.7)';
  },

  /**
   * Check URL for experiment configuration.
   * @returns {boolean} True if valid config found
   */
  checkUrlConfig: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const ecConfig = urlParams.get('ec');

    if (ecConfig) {
      try {
        const config = JSON.parse(decodeURIComponent(escape(atob(ecConfig))));
        if (config.template === 'evaluative-conditioning') {
          this.isParticipantMode = true;
          this.experimenterEmail = config.experimenterEmail || '';
          this.userExperimentId = config.userExperimentId || '';

          // Apply custom stimuli
          if (config.cs) {
            this.data.neutralStimuli = config.cs.map(cs => ({
              id: cs.id,
              type: 'shape',
              label: cs.label,
              color: cs.color
            }));
          }
          if (config.positiveUS) {
            this.data.positiveUS = config.positiveUS.map(us => ({
              id: us.id,
              type: 'word',
              content: us.content,
              color: us.color
            }));
          }
          if (config.negativeUS) {
            this.data.negativeUS = config.negativeUS.map(us => ({
              id: us.id,
              type: 'word',
              content: us.content,
              color: us.color
            }));
          }
          if (config.params) {
            Object.assign(this.params, config.params);
          }

          // Hide main layout for participants
          const layout = document.querySelector('.layout');
          if (layout) layout.style.display = 'none';

          // Open EC directly
          this.open();
          return true;
        }
      } catch (e) {
        console.error('Error parsing EC config:', e);
      }
    }
    return false;
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  EvaluativeConditioning.init();
});

console.log('Evaluative Conditioning module loaded');
