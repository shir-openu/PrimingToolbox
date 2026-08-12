/*
 * PREVIOUS VERSIONS ON GITHUB, newest first. Every change to this file adds a
 * line here, so any earlier state can be recovered if something goes wrong.
 *
 *   before the full-codebase read of 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/02cecb1/js/amp.js
 *
 *   before a failed database save stopped being a console line, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/934c0b5/js/amp.js
 *
 *   before this paradigm carried the ABCD panel on its setup screen, 2026-08-11
 *   https://github.com/shir-openu/PrimingToolbox/blob/e090bd3/js/amp.js
 */
/**
 * =====================================================
 * PrimingToolbox - AMP (Affect Misattribution Procedure) Module
 * =====================================================
 *
 * Affect Misattribution Procedure based on Payne et al. (2005).
 * Measures implicit attitudes through affect misattribution to neutral targets.
 *
 * Trial sequence:
 * 1. Fixation (+) - 500ms
 * 2. Prime image/emoji - 75ms (brief!)
 * 3. Blank ISI - 125ms
 * 4. Target (Chinese character) - 1000ms
 * 5. Mask - until response
 * 6. Response: Arrow keys for pleasant/unpleasant judgment
 *
 * ABCD Framework Mapping:
 * - A (Prime): Emotional image/emoji (positive or negative valence)
 * - B (Target): Neutral Chinese ideograph
 * - C (Baseline): Negative prime trials serve as comparison
 * - D (Measured): Proportion of "pleasant" responses per prime type
 *
 * Key References:
 * - Payne, B. K., Cheng, C. M., Govorun, O., & Stewart, B. D. (2005).
 *   An inkblot for attitudes. JPSP, 89(3), 277-293.
 *
 * @module AMP
 * @version 1.0
 * @requires PTA (core.js)
 * =====================================================
 */

/**
 * AMP experiment namespace.
 * @namespace AMP
 */
window.AMP = {
  /**
   * This experiment, described in the ABCD framework.
   */
  abcdSpec: {
    accent: '#ea5cd5',
    articleAnchor: '#s2',
    abcd: {
      A: 'The affective image flashed before each pictograph.',
      B: 'The Chinese pictograph you judge as pleasant or unpleasant.',
      C: 'How often that pictograph is called pleasant after a neutral prime.',
      D: 'How often it is called pleasant after a positive or a negative prime.'
    },
    characteristics: {
      association: 'Prime and judgement share one dimension - valence - so the prime can push the judgement either way.',
      secondariness: 'You are told in so many words to ignore the image and judge only the pictograph. The instruction to disregard A is part of the procedure.',
      modulation: 'The proportion of pleasant judgements shifts with the valence of the prime, although the pictograph is unfamiliar and carries no meaning of its own for you.'
    },
    boundaryNote: 'The effect works by misattribution: the feeling A causes is read off as a property of B. Participants routinely insist they ignored the primes, and the shift appears anyway.'
  },


  /**
   * Experiment configuration for timing and trials.
   * @type {Object}
   */
  config: {
    timing: {
      fixation: 500,      // Fixation duration (ms)
      prime: 75,          // Prime duration (ms) - CRITICAL!
      isi: 125,           // Inter-stimulus interval (ms)
      target: 1000,       // Target duration (ms) - 1 second for visibility
      iti: 500,           // Inter-trial interval (ms)
      responseTimeout: 0  // 0 = no timeout (wait for response)
    },
    trials: {
      perCondition: 12,   // Trials per prime type (positive/negative)
      practice: 4,        // Practice trials
      randomize: true
    },
    response: {
      pleasant: { key: 'arrowright', label: 'Pleasant' },
      unpleasant: { key: 'arrowleft', label: 'Unpleasant' }
    }
  },

  /**
   * Default stimuli configuration.
   * Contains positive/negative/neutral primes, Chinese character targets, and mask.
   * @type {Object}
   */
  stimuli: {
    // Prime images (URLs or base64)
    primes: {
      positive: [
        { id: 'pos1', url: '', label: 'Positive 1', emoji: '😊' },
        { id: 'pos2', url: '', label: 'Positive 2', emoji: '🌸' },
        { id: 'pos3', url: '', label: 'Positive 3', emoji: '🐶' },
        { id: 'pos4', url: '', label: 'Positive 4', emoji: '☀️' }
      ],
      negative: [
        { id: 'neg1', url: '', label: 'Negative 1', emoji: '😠' },
        { id: 'neg2', url: '', label: 'Negative 2', emoji: '🕷️' },
        { id: 'neg3', url: '', label: 'Negative 3', emoji: '🐍' },
        { id: 'neg4', url: '', label: 'Negative 4', emoji: '💀' }
      ],
      neutral: [
        { id: 'neu1', url: '', label: 'Neutral 1', emoji: '⬜' },
        { id: 'neu2', url: '', label: 'Neutral 2', emoji: '📦' }
      ]
    },
    // Chinese ideographs as targets
    targets: [
      '會', '能', '應', '就', '後', '為', '從', '裡',
      '還', '很', '沒', '把', '與', '讓', '給', '等',
      '當', '幾', '被', '更', '卻', '每', '問', '事'
    ],
    // Mask pattern (will be generated)
    mask: null
  },

  /**
   * Experiment state tracking.
   * Includes trials, results, phase, and response timing.
   * @type {Object}
   */
  state: {
    trials: [],
    currentTrial: 0,
    results: [],
    phase: 'setup', // setup, practice, experiment, results
    stimulusOnset: 0,
    awaitingResponse: false,
    isPractice: false,
    openedFromBuilder: false
  },

  /** @type {string} Experimenter email for data association */
  experimenterEmail: '',
  /** @type {string} User-defined experiment identifier */
  userExperimentId: '',
  /** @type {boolean} True when running from shared participant link */
  isParticipantMode: false,
  /** @type {boolean} Whether to require external ID (Prolific/MTurk) */
  requireExternalId: false,
  /** @type {string} External participant ID if provided */
  externalId: '',

  /**
   * Initialize the AMP module.
   * Sets up keyboard listener and generates mask pattern.
   */
  init: function() {
    if (this._initDone) return;          // was unguarded: every call bound another keydown listener
    this._initDone = true;
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    this.generateMaskPattern();
    // Installs _after()/_clearTimers(). AMP had five setTimeout calls and not
    // one clearTimeout, so the five-phase chain
    //   fixation -> prime -> ISI -> target -> mask -> ITI
    // survived close() and kept advancing trials into a hidden overlay.
    PTK.timers(this);
    console.log('AMP module initialized');
  },

  /**
   * Generate visual noise pattern for response mask.
   * Creates random black/white pixel pattern on canvas.
   */
  generateMaskPattern: function() {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Create random noise pattern
    const imageData = ctx.createImageData(200, 200);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = Math.random() > 0.5 ? 0 : 255;
      imageData.data[i] = value;     // R
      imageData.data[i + 1] = value; // G
      imageData.data[i + 2] = value; // B
      imageData.data[i + 3] = 255;   // A
    }
    ctx.putImageData(imageData, 0, 0);

    this.stimuli.mask = canvas.toDataURL();
  },

  /**
   * Open the AMP experiment overlay.
   * Shows setup screen.
   */
  open: function() {
    document.getElementById('amp-overlay').classList.add('active');
    document.getElementById('amp-setup').style.display = 'block';
    document.getElementById('amp-trial').classList.remove('active');
    document.getElementById('amp-results').classList.remove('active');
    if (window.PTK) PTK.injectAbcd('amp-setup', this.abcdSpec);
    this.state.phase = 'setup';
  },

  /**
   * Close the AMP experiment overlay.
   * Returns to builder if opened from there, or shows thank you screen.
   */
  close: function() {
    this._clearTimers();
    document.getElementById('amp-overlay').classList.remove('active');
    this.state.awaitingResponse = false;

    if (this.state.openedFromBuilder) {
      this.state.openedFromBuilder = false;
      this.openBuilder();
    } else if (this.isParticipantMode) {
      this.showThankYou();
    }
  },

  /**
   * Display thank you modal after experiment completion.
   * Shown to participants after successful data submission.
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
   * Generate randomized trial list.
   * Creates positive and negative prime trials with unique target characters.
   * @param {boolean} [isPractice=false] - Generate practice trials (fewer trials)
   * @returns {Array<Object>} Shuffled array of trial objects
   */
  generateTrials: function(isPractice = false) {
    const trials = [];
    const perCondition = isPractice ? 2 : this.config.trials.perCondition;
    const primeTypes = ['positive', 'negative'];
    const targets = [...this.stimuli.targets];

    // Shuffle targets
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }

    let targetIndex = 0;

    primeTypes.forEach(primeType => {
      const primes = this.stimuli.primes[primeType];
      for (let i = 0; i < perCondition; i++) {
        const prime = primes[i % primes.length];
        const target = targets[targetIndex % targets.length];
        targetIndex++;

        trials.push({
          primeType: primeType,
          primeId: prime.id,
          primeUrl: prime.url,
          primeEmoji: prime.emoji,
          primeLabel: prime.label,
          target: target,
          isPractice: isPractice
        });
      }
    });

    // Shuffle trials
    if (this.config.trials.randomize) {
      for (let i = trials.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [trials[i], trials[j]] = [trials[j], trials[i]];
      }
    }

    return trials;
  },

  /**
   * Start the AMP experiment with practice trials.
   * Generates practice trials and shows instructions.
   */
  start: function() {
    // Start with practice trials
    this.state.isPractice = true;
    this.state.trials = this.generateTrials(true);
    this.state.currentTrial = 0;
    this.state.results = [];
    this.state.phase = 'practice';

    document.getElementById('amp-setup').style.display = 'none';
    document.getElementById('amp-results').classList.remove('active');
    document.getElementById('amp-trial').classList.add('active');

    this.updateProgress();
    document.getElementById('amp-overlay').focus();

    // Show practice instructions
    this.showMessage('Practice Trials', 'Let\'s practice first. Remember: judge the Chinese character as PLEASANT or UNPLEASANT.', () => {
      this.runTrial();
    });
  },

  /**
   * Transition from practice to main experiment.
   * Generates full trial set and shows transition message.
   */
  startMainExperiment: function() {
    this.state.isPractice = false;
    this.state.trials = this.generateTrials(false);
    this.state.currentTrial = 0;
    this.state.phase = 'experiment';

    this.updateProgress();

    this.showMessage('Main Experiment', 'Practice complete! Now the real experiment begins. Remember: judge only the Chinese character.', () => {
      this.runTrial();
    });
  },

  /**
   * Display instruction message with continue button.
   * @param {string} title - Message title
   * @param {string} text - Message body text
   * @param {Function} callback - Function to call when continue clicked
   */
  showMessage: function(title, text, callback) {
    const stimulus = document.getElementById('amp-stimulus');
    // title and text are interpolated into innerHTML. Both callers currently
    // pass hardcoded literals, so this is NOT a live hole - but it is one
    // refactor away from becoming one the moment anything config-derived is
    // passed in. Escaped rather than rewritten so the #amp-continue-btn wiring
    // below keeps working unchanged.
    stimulus.innerHTML = `
      <div style="text-align: center; max-width: 500px;">
        <h3 style="color: #ff4db8; margin-bottom: 20px;">${PTK.esc(title)}</h3>
        <p style="color: #e5e7eb; line-height: 1.6; margin-bottom: 30px;">${PTK.esc(text)}</p>
        <button id="amp-continue-btn" style="background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white; padding: 14px 35px; border-radius: 10px; cursor: pointer; font-size: 16px;">Continue</button>
      </div>
    `;

    document.getElementById('amp-continue-btn').onclick = callback;
    document.getElementById('amp-instruction').style.display = 'none';
    document.getElementById('amp-keys').style.display = 'none';
  },

  /**
   * Run a single AMP trial.
   * Executes sequence: Fixation → Prime → ISI → Target → Mask → Response.
   */
  runTrial: function() {
    // Check if practice is complete
    if (this.state.isPractice && this.state.currentTrial >= this.state.trials.length) {
      this.startMainExperiment();
      return;
    }

    // Check if main experiment is complete
    if (!this.state.isPractice && this.state.currentTrial >= this.state.trials.length) {
      this.showResults();
      return;
    }

    const trial = this.state.trials[this.state.currentTrial];
    const stimulus = document.getElementById('amp-stimulus');

    this.updateProgress();
    document.getElementById('amp-instruction').style.display = 'block';
    document.getElementById('amp-keys').style.display = 'flex';

    // Phase 1: Fixation
    stimulus.innerHTML = '<span class="amp-fixation">+</span>';
    this.state.awaitingResponse = false;

    this._after(() => {
      // Phase 2: Prime (75ms)
      this.showPrime(trial, () => {
        // Phase 3: Blank/ISI (125ms)
        stimulus.innerHTML = '';

        this._after(() => {
          // Phase 4: Target (200ms)
          this.showTarget(trial, () => {
            // Phase 5: Mask (until response)
            this.showMask();
            this.state.stimulusOnset = performance.now();
            this.state.awaitingResponse = true;
          });
        }, this.config.timing.isi);
      });
    }, this.config.timing.fixation);
  },

  /**
   * Show prime stimulus with precise timing.
   * Uses requestAnimationFrame for accurate 75ms presentation.
   * @param {Object} trial - Current trial object
   * @param {Function} callback - Function to call after prime duration
   */
  showPrime: function(trial, callback) {
    const stimulus = document.getElementById('amp-stimulus');

    // Use emoji as placeholder if no image URL
    if (trial.primeUrl && trial.primeUrl.length > 0) {
      // trial.primeUrl went straight into a src="" attribute, so a value
      // containing a quote could close the attribute and add its own, e.g.
      // onerror=. Setting the property instead means the string is only ever
      // treated as a URL and can never become markup.
      const img = document.createElement('img');
      img.className = 'amp-prime-image';
      img.alt = 'prime';
      img.src = trial.primeUrl;
      stimulus.textContent = '';
      stimulus.appendChild(img);
    } else {
      PTK.showText(stimulus, trial.primeEmoji, 'amp-prime-emoji');
    }

    // Use requestAnimationFrame for more precise timing
    const startTime = performance.now();
    const primeDuration = this.config.timing.prime;

    const checkTime = () => {
      if (performance.now() - startTime >= primeDuration) {
        callback();
      } else {
        requestAnimationFrame(checkTime);
      }
    };
    requestAnimationFrame(checkTime);
  },

  /**
   * Show target Chinese character.
   * Uses CJK-supporting font for proper display.
   * @param {Object} trial - Current trial object
   * @param {Function} callback - Function to call after target duration
   */
  showTarget: function(trial, callback) {
    const stimulus = document.getElementById('amp-stimulus');
    PTK.showText(stimulus, trial.target, null, {
      fontSize: '6rem', color: '#ffffff', fontWeight: 'bold', display: 'block',
      fontFamily: "'Noto Sans SC', 'Microsoft YaHei', 'SimHei', 'Heiti SC', sans-serif"
    });

    // Use setTimeout for reliable timing
    this._after(callback, this.config.timing.target);
  },

  /**
   * Show mask after target until response.
   * Prevents visual persistence of target.
   */
  showMask: function() {
    const stimulus = document.getElementById('amp-stimulus');
    stimulus.innerHTML = `<span style="font-size: 4rem; color: #666666; letter-spacing: 0.5rem;">▓▓▓▓▓</span>`;
  },

  /**
   * Update progress bar and trial counter display.
   */
  updateProgress: function() {
    const total = this.state.trials.length;
    const current = this.state.currentTrial;
    const progress = (current / total) * 100;

    document.getElementById('amp-progress-fill').style.width = `${progress}%`;

    const prefix = this.state.isPractice ? 'Practice ' : '';
    document.getElementById('amp-progress-text').textContent =
      `${prefix}Trial ${current + 1} of ${total}`;
  },

  /**
   * Handle participant response to target.
   * Records result for main trials only, not practice.
   * @param {string} response - 'pleasant' or 'unpleasant'
   */
  handleResponse: function(response) {
    if (!this.state.awaitingResponse) return;

    const rt = performance.now() - this.state.stimulusOnset;
    const trial = this.state.trials[this.state.currentTrial];

    // Record result (only for main experiment, not practice)
    if (!this.state.isPractice) {
      this.state.results.push({
        trialNumber: this.state.results.length + 1,
        primeType: trial.primeType,
        primeId: trial.primeId,
        primeLabel: trial.primeLabel,
        target: trial.target,
        response: response,
        rt: rt
      });
    }

    this.state.awaitingResponse = false;
    this.state.currentTrial++;

    // Brief ITI before next trial
    const stimulus = document.getElementById('amp-stimulus');
    stimulus.innerHTML = '';

    this._after(() => this.runTrial(), this.config.timing.iti);
  },

  /**
   * Handle keyboard events during experiment.
   * Routes arrow key presses to response handler.
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeydown: function(e) {
    const overlay = document.getElementById('amp-overlay');
    const trial = document.getElementById('amp-trial');

    if (overlay && overlay.classList.contains('active') &&
        trial && trial.classList.contains('active') &&
        this.state.awaitingResponse) {

      const key = e.key.toLowerCase();

      if (key === this.config.response.pleasant.key) {
        e.preventDefault();
        this.handleResponse('pleasant');
      } else if (key === this.config.response.unpleasant.key) {
        e.preventDefault();
        this.handleResponse('unpleasant');
      }
    }
  },

  /**
   * Display results screen with AMP effect statistics.
   * Shows pleasant response proportions for positive vs negative primes.
   */
  showResults: function() {
    this._clearTimers();
    document.getElementById('amp-trial').classList.remove('active');
    document.getElementById('amp-results').classList.add('active');
    this.state.phase = 'results';

    // Calculate statistics
    const positiveTrials = this.state.results.filter(r => r.primeType === 'positive');
    const negativeTrials = this.state.results.filter(r => r.primeType === 'negative');

    const posPleasant = positiveTrials.filter(r => r.response === 'pleasant').length;
    const negPleasant = negativeTrials.filter(r => r.response === 'pleasant').length;

    const posProportion = positiveTrials.length > 0 ?
      (posPleasant / positiveTrials.length * 100).toFixed(1) : 0;
    const negProportion = negativeTrials.length > 0 ?
      (negPleasant / negativeTrials.length * 100).toFixed(1) : 0;

    const avgRT = this.state.results.length > 0 ?
      Math.round(this.state.results.reduce((sum, r) => sum + r.rt, 0) / this.state.results.length) : 0;

    const ampEffect = (posProportion - negProportion).toFixed(1);

    // Update display
    document.getElementById('amp-pos-pleasant').textContent = `${posProportion}%`;
    document.getElementById('amp-neg-pleasant').textContent = `${negProportion}%`;
    document.getElementById('amp-effect').textContent = `${ampEffect}%`;
    document.getElementById('amp-avg-rt').textContent = `${avgRT} ms`;

    // Generate interpretation
    const interpretation = this.generateInterpretation(parseFloat(ampEffect));
    document.getElementById('amp-interpretation').textContent = interpretation;

    // Save to Supabase
    this.saveResults();
  },

  /**
   * Generate text interpretation of AMP effect.
   * @param {number} effect - Difference in pleasant response % (positive - negative primes)
   * @returns {string} Interpretation text
   */
  generateInterpretation: function(effect) {
    if (effect > 20) {
      return `You showed a strong AMP effect (${effect}% difference). Positive primes significantly increased pleasant judgments compared to negative primes. This indicates clear affective priming.`;
    } else if (effect > 10) {
      return `You showed a moderate AMP effect (${effect}% difference). Positive primes led to more pleasant judgments than negative primes.`;
    } else if (effect > 0) {
      return `You showed a small AMP effect (${effect}% difference). There was a slight tendency to rate targets as more pleasant after positive primes.`;
    } else if (effect > -10) {
      return `No clear AMP effect detected (${effect}% difference). Prime valence did not systematically influence your judgments.`;
    } else {
      return `Reversed AMP effect (${effect}% difference). This unusual pattern may indicate contrast effects or strategic responding.`;
    }
  },

  /**
   * Save results to Supabase database.
   * Includes trial data with experimenter and external ID if provided.
   * @async
   */
  saveResults: function() {
    // Was `if (!window.PTA || !PTA.supabase) return`, which abandoned the run
    // before saveAllResults could rescue it - and a missing client is exactly
    // the case the rescue exists for. Only a missing PTA leaves nothing to
    // rescue with; a missing client is a failure to be handled.
    if (!window.PTA || typeof PTA.saveAllResults !== 'function') {
      console.error('AMP: platform core not loaded - results NOT saved', this.state.results);
      return;
    }

    const experimentId = this.userExperimentId || 'amp_experiment';
    const participantId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

    const trialsData = this.state.results.map(r => ({
      experiment_id: experimentId,
      participant_id: participantId,
      trial_number: r.trialNumber,
      prime_type: r.primeType,
      prime_id: r.primeId,
      prime_label: r.primeLabel,
      target: r.target,
      response: r.response,
      rt: Math.round(r.rt * 100) / 100,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null,
      external_id: this.externalId || null
    }));

    PTA.saveAllResults('experiment_results', trialsData, {
      experimentName: 'AMP (Affect Misattribution)',
      host: document.getElementById('amp-results')
    }).then(result => {
      if (result.error) {
        console.error('AMP: Error saving results', result.error);
      } else {
        console.log('AMP: Results saved successfully');
      }
    });
  },

  /**
   * Export results to CSV file.
   * Includes trial, prime type, target character, response, and RT.
   */
  exportCSV: function() {
    if (!this.state.results.length) {
      alert('No results to export');
      return;
    }

    const headers = ['Trial', 'Prime Type', 'Prime ID', 'Target', 'Response', 'RT (ms)'];
    const rows = this.state.results.map(r => [
      r.trialNumber,
      r.primeType,
      r.primeId,
      r.target,
      r.response,
      Math.round(r.rt)
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `amp_results_${new Date().toISOString().slice(0, 10)}.csv`;
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
      ['Trial', 'Prime Type', 'Prime ID', 'Target', 'Response', 'RT (ms)'],
      ...this.state.results.map(r => [
        r.trialNumber,
        r.primeType,
        r.primeId,
        r.target,
        r.response,
        Math.round(r.rt)
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws, 'AMP Results');
    XLSX.writeFile(wb, `amp_results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  /**
   * Template Builder stimulus configuration.
   * Contains positive and negative prime stimuli with labels and emojis.
   * @type {Object}
   */
  builderStimuli: {
    positive: [
      { id: 'pos1', url: '', emoji: '😊', label: 'Happy face' },
      { id: 'pos2', url: '', emoji: '🌸', label: 'Flower' },
      { id: 'pos3', url: '', emoji: '🐶', label: 'Puppy' },
      { id: 'pos4', url: '', emoji: '☀️', label: 'Sun' }
    ],
    negative: [
      { id: 'neg1', url: '', emoji: '😠', label: 'Angry face' },
      { id: 'neg2', url: '', emoji: '🕷️', label: 'Spider' },
      { id: 'neg3', url: '', emoji: '🐍', label: 'Snake' },
      { id: 'neg4', url: '', emoji: '💀', label: 'Skull' }
    ]
  },

  /**
   * Open Template Builder overlay.
   * Renders stimulus cards for positive and negative primes.
   */
  openBuilder: function() {
    document.getElementById('amp-builder-overlay').classList.add('active');
    this.renderBuilderStimuli();
  },

  /**
   * Close Template Builder overlay.
   */
  closeBuilder: function() {
    document.getElementById('amp-builder-overlay').classList.remove('active');
  },

  /**
   * Render stimulus cards in builder UI.
   * Creates editable cards for positive and negative prime categories.
   */
  renderBuilderStimuli: function() {
    const posContainer = document.getElementById('amp-positive-primes');
    if (posContainer) {
      posContainer.innerHTML = '';
      this.builderStimuli.positive.forEach((stim, index) => {
        posContainer.innerHTML += this.createStimulusCard('positive', index, stim);
      });
    }

    // Render negative primes
    const negContainer = document.getElementById('amp-negative-primes');
    if (negContainer) {
      negContainer.innerHTML = '';
      this.builderStimuli.negative.forEach((stim, index) => {
        negContainer.innerHTML += this.createStimulusCard('negative', index, stim);
      });
    }
  },

  /**
   * Create HTML for stimulus card in builder.
   * @param {string} type - 'positive' or 'negative'
   * @param {number} index - Stimulus index
   * @param {Object} stim - Stimulus object with emoji and label
   * @returns {string} HTML string for stimulus card
   */
  createStimulusCard: function(type, index, stim) {
    return `
      <div class="stimulus-card" data-type="${type}" data-index="${index}">
        <div class="stimulus-preview">${stim.emoji}</div>
        <input type="text" value="${PTK.esc(stim.label)}" placeholder="Label"
               onchange="AMP.updateBuilderStimulus('${type}', ${index}, 'label', this.value)">
        <input type="text" value="${PTK.esc(stim.emoji)}" placeholder="Emoji" maxlength="2"
               onchange="AMP.updateBuilderStimulus('${type}', ${index}, 'emoji', this.value)">
        <button class="btn-remove" onclick="AMP.removeBuilderStimulus('${type}', ${index})"
                ${this.builderStimuli[type].length <= 2 ? 'disabled' : ''}>Remove</button>
      </div>
    `;
  },

  /**
   * Update stimulus field in builder.
   * @param {string} type - 'positive' or 'negative'
   * @param {number} index - Stimulus index
   * @param {string} field - Field name ('label' or 'emoji')
   * @param {string} value - New value
   */
  updateBuilderStimulus: function(type, index, field, value) {
    this.builderStimuli[type][index][field] = value;
    this.renderBuilderStimuli();
  },

  /**
   * Add new stimulus to builder category.
   * @param {string} type - 'positive' or 'negative'
   */
  addBuilderStimulus: function(type) {
    const newId = type.substring(0, 3) + (this.builderStimuli[type].length + 1);
    this.builderStimuli[type].push({
      id: newId,
      url: '',
      emoji: type === 'positive' ? '😊' : '😠',
      label: type === 'positive' ? 'Positive' : 'Negative'
    });
    this.renderBuilderStimuli();
  },

  /**
   * Remove stimulus from builder category.
   * Requires minimum 2 stimuli per category.
   * @param {string} type - 'positive' or 'negative'
   * @param {number} index - Stimulus index to remove
   */
  removeBuilderStimulus: function(type, index) {
    if (this.builderStimuli[type].length <= 2) {
      alert('You need at least 2 stimuli per category.');
      return;
    }
    this.builderStimuli[type].splice(index, 1);
    this.renderBuilderStimuli();
  },

  /**
   * Preview experiment from builder with current settings.
   * Applies builder stimuli and timing to main config.
   */
  previewFromBuilder: function() {
    // Apply builder settings
    this.stimuli.primes.positive = this.builderStimuli.positive.map(s => ({...s}));
    this.stimuli.primes.negative = this.builderStimuli.negative.map(s => ({...s}));

    // Get timing settings
    const fixation = parseInt(document.getElementById('amp-builder-fixation')?.value) || 500;
    const prime = parseInt(document.getElementById('amp-builder-prime')?.value) || 75;
    const isi = parseInt(document.getElementById('amp-builder-isi')?.value) || 125;
    const target = parseInt(document.getElementById('amp-builder-target')?.value) || 200;
    const trials = parseInt(document.getElementById('amp-builder-trials')?.value) || 12;

    this.config.timing.fixation = fixation;
    this.config.timing.prime = prime;
    this.config.timing.isi = isi;
    this.config.timing.target = target;
    this.config.trials.perCondition = trials;

    this.state.openedFromBuilder = true;
    this.closeBuilder();
    this.open();
  },

  /**
   * Generate unique experiment ID with timestamp.
   */
  generateExperimentId: function() {
    const el = document.getElementById('ampExperimentId');
    if (el) {
      el.value = 'amp_' + Date.now().toString(36);
      el.style.borderColor = 'rgba(74, 222, 128, 0.7)';
    }
  },

  /**
   * Generate shareable participant link with embedded configuration.
   * Encodes all experiment settings in Base64 URL parameter.
   */
  generateLink: function() {
    const emailEl = document.getElementById('ampExperimenterEmail');
    const expIdEl = document.getElementById('ampExperimentId');
    const requireExtIdEl = document.getElementById('amp-require-external-id');

    const email = emailEl ? emailEl.value.trim() : '';
    const expId = expIdEl ? expIdEl.value.trim() : '';
    const requireExtId = requireExtIdEl ? requireExtIdEl.checked : false;

    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    if (!expId || expId.length < 3) {
      alert('Please enter an Experiment ID (at least 3 characters).');
      return;
    }

    // Get timing settings
    const fixation = parseInt(document.getElementById('amp-builder-fixation')?.value) || 500;
    const prime = parseInt(document.getElementById('amp-builder-prime')?.value) || 75;
    const isi = parseInt(document.getElementById('amp-builder-isi')?.value) || 125;
    const target = parseInt(document.getElementById('amp-builder-target')?.value) || 200;
    const trials = parseInt(document.getElementById('amp-builder-trials')?.value) || 12;

    const config = {
      template: 'amp',
      experimenterEmail: email,
      userExperimentId: expId,
      requireExternalId: requireExtId,
      timing: {
        fixation: fixation,
        prime: prime,
        isi: isi,
        target: target
      },
      trialsPerCondition: trials,
      stimuli: {
        positive: this.builderStimuli.positive,
        negative: this.builderStimuli.negative
      }
    };

    try {
      const configStr = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
      // encodeURIComponent: base64 contains '+', and a raw '+' in a query
      // string decodes as a SPACE, which corrupts the payload and makes the
      // link silently dead. Verified. Old links are unaffected.
      const link = window.location.href.split('?')[0] + '?amp=' + encodeURIComponent(configStr);

      this.showLinkModal(link);
    } catch (error) {
      console.error('Error generating link:', error);
      alert('Error generating link. Please try again.');
    }
  },

  /**
   * Display modal with generated participant link.
   * @param {string} link - Generated experiment URL
   */
  showLinkModal: function(link) {
    const modal = document.createElement('div');
    modal.id = 'amp-link-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.9); z-index: 2000;
      display: flex; justify-content: center; align-items: center;
    `;

    modal.innerHTML = `
      <div style="background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(255, 77, 184, 0.3);
                  border-radius: 20px; padding: 40px; max-width: 650px; text-align: center;">
        <h2 style="color: #ffffff; margin-bottom: 20px;">Your AMP Experiment Link is Ready!</h2>
        <p style="color: #9aa6b2; margin-bottom: 10px;">Send this link to your participants:</p>
        <input type="text" value="${PTK.esc(link)}" readonly style="
          width: 100%; padding: 15px; background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
          color: #ffffff; font-size: 0.85rem; margin-bottom: 20px;">
        <div style="display: flex; gap: 15px; justify-content: center;">
          <button onclick="navigator.clipboard.writeText('${link}').then(() => alert('Link copied!'))" style="
            background: linear-gradient(135deg, #667eea, #764ba2); border: none;
            color: white; padding: 12px 25px; border-radius: 8px; cursor: pointer;">Copy Link</button>
          <button onclick="document.getElementById('amp-link-modal').remove()" style="
            background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
            color: white; padding: 12px 25px; border-radius: 8px; cursor: pointer;">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  /**
   * Check URL for embedded experiment configuration.
   * Parses Base64-encoded config from 'amp' parameter and auto-starts experiment.
   * @returns {boolean} True if valid config found and experiment started
   */
  checkUrlConfig: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const ampConfig = urlParams.get('amp');

    if (ampConfig) {
      try {
        const config = JSON.parse(decodeURIComponent(escape(atob(ampConfig))));
        if (config.template === 'amp') {
          this.isParticipantMode = true;
          this.experimenterEmail = config.experimenterEmail || '';
          this.userExperimentId = config.userExperimentId || '';
          this.requireExternalId = config.requireExternalId || false;

          // Apply timing config
          if (config.timing) {
            this.config.timing.fixation = config.timing.fixation || 500;
            this.config.timing.prime = config.timing.prime || 75;
            this.config.timing.isi = config.timing.isi || 125;
            this.config.timing.target = config.timing.target || 200;
          }

          // Apply trials config
          if (config.trialsPerCondition) {
            this.config.trials.perCondition = config.trialsPerCondition;
          }

          // Apply stimuli config
          if (config.stimuli) {
            if (config.stimuli.positive) {
              this.stimuli.primes.positive = config.stimuli.positive;
            }
            if (config.stimuli.negative) {
              this.stimuli.primes.negative = config.stimuli.negative;
            }
          }

          // Hide main layout for participants
          const layout = document.querySelector('.layout');
          if (layout) layout.style.display = 'none';

          // Check for external ID requirement
          if (this.requireExternalId) {
            this.showExternalIdPrompt();
          } else {
            this.open();
          }

          return true;
        }
      } catch (e) {
        console.error('Error parsing AMP config:', e);
      }
    }
    return false;
  },

  /**
   * Show modal to collect external participant ID.
   * Used when requireExternalId is true (Prolific/MTurk/SONA integration).
   */
  showExternalIdPrompt: function() {
    const modal = document.createElement('div');
    modal.id = 'amp-external-id-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.95); z-index: 2000;
      display: flex; justify-content: center; align-items: center;
    `;

    modal.innerHTML = `
      <div style="background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(102, 126, 234, 0.5);
                  border-radius: 20px; padding: 40px; max-width: 450px; text-align: center;">
        <h2 style="color: #ffffff; margin-bottom: 15px;">Participant ID Required</h2>
        <p style="color: #9aa6b2; margin-bottom: 20px;">Please enter your participant ID (from Prolific, MTurk, or SONA):</p>
        <input type="text" id="amp-external-id-input" placeholder="Enter your ID" style="
          width: 100%; padding: 15px; background: rgba(0,0,0,0.3);
          border: 2px solid rgba(102, 126, 234, 0.5); border-radius: 8px;
          color: #ffffff; font-size: 16px; margin-bottom: 20px;">
        <button onclick="AMP.submitExternalId()" style="
          background: linear-gradient(135deg, #667eea, #764ba2); border: none;
          color: white; padding: 14px 35px; border-radius: 10px; cursor: pointer; font-size: 16px;">
          Continue
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('amp-external-id-input').focus();
  },

  /**
   * Submit external ID and check for duplicate participation.
   * Opens experiment if ID is valid and not duplicate.
   * @async
   */
  submitExternalId: async function() {
    const input = document.getElementById('amp-external-id-input');
    const externalId = input.value.trim();

    if (!externalId) {
      alert('Please enter your participant ID.');
      return;
    }

    // Check for duplicate participation
    if (window.PTA && PTA.checkDuplicateParticipation) {
      const result = await PTA.checkDuplicateParticipation('experiment_results', this.userExperimentId, externalId);
      if (result.isDuplicate) {
        alert('You have already completed this experiment. Thank you!');
        return;
      }
    }

    this.externalId = externalId;
    document.getElementById('amp-external-id-modal').remove();
    this.open();
  },

  /**
   * Test Supabase database connection.
   * Updates status indicator in builder UI.
   * @async
   */
  testConnection: async function() {
    const statusEl = document.getElementById('amp-connection-status');
    if (!statusEl) return;

    const statusText = statusEl.querySelector('.status-text');

    // Was: report "Connected" whenever PTA.supabase was truthy. That object
    // exists as soon as the CDN script loads and proves nothing about whether
    // the database answers. PTA.paintConnectionStatus issues a real query.
    if (window.PTA && PTA.paintConnectionStatus) {
      await PTA.paintConnectionStatus(statusEl, statusText);
    } else if (statusText) {
      statusEl.classList.add('error');
      statusText.innerHTML = '<strong>Not connected</strong> - the platform core script ' +
        'did not load, so nothing can be saved.';
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  AMP.init();
});

console.log('AMP module loaded');
