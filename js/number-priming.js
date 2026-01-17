/**
 * =====================================================
 * PrimingToolbox - Number Priming Module
 * =====================================================
 *
 * Implementation of the Dehaene Masked Number Priming paradigm.
 * Demonstrates unconscious semantic priming with numerical stimuli.
 *
 * ABCD Framework Mapping:
 * - A (Prime): Masked/explicit number
 * - B (Target): Visible number to compare
 * - C (Baseline): Incongruent prime-target pairs
 * - D (Outcome): RT difference showing priming effect
 *
 * Features:
 * - Masked (subliminal) and explicit (supraliminal) modes
 * - Number comparison task (larger/smaller than reference)
 * - Configurable timing parameters
 * - Template Builder for experiment customization
 * - Supabase data collection
 * - Export to CSV/Excel
 *
 * References:
 * - Dehaene, S., Naccache, L., Le Clec'H, G., Koechlin, E., Mueller, M.,
 *   Dehaene-Lambertz, G., van de Moortele, P.F., & Le Bihan, D. (1998).
 *   Imaging unconscious semantic priming. Nature, 395(6702), 597-600.
 *
 * @module NumberPriming
 * @version 1.0
 * =====================================================
 */

// NumberPriming namespace
window.NumberPriming = {

  /* =====================================================
     DATA CONFIGURATION
     ===================================================== */

  /**
   * Configuration data for the experiment.
   * @type {Object}
   */
  data: {
    /**
     * Numbers to use in the experiment.
     * @type {number[]}
     */
    numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],

    /**
     * Reference number for comparison.
     * @type {number}
     */
    referenceNumber: 5,

    /**
     * Response configuration.
     * @type {Object}
     */
    responses: {
      smaller: { label: 'Smaller', key: 'arrowleft' },
      larger: { label: 'Larger', key: 'arrowright' }
    },

    /**
     * Default timing parameters in milliseconds.
     * @type {Object}
     */
    timing: {
      fixation: 500,
      forwardMask: 71,
      prime: 43,         // Short for masked, longer for explicit
      backwardMask: 71,
      targetTimeout: 5000,
      feedback: 300,
      iti: 1000
    },

    /**
     * Mask characters for subliminal presentation.
     * @type {string}
     */
    maskChar: '####',

    /**
     * Priming mode configurations.
     * @type {Object}
     */
    modes: {
      masked: { name: 'Masked (Subliminal)', primeDuration: 43 },
      explicit: { name: 'Explicit (Supraliminal)', primeDuration: 200 }
    },

    /**
     * Localized instruction text.
     * @type {Object}
     */
    instructions: {
      en: {
        title: 'Number Comparison Task',
        task: 'Is the number LARGER or SMALLER than 5?',
        keys: 'Press LEFT ARROW for Smaller, RIGHT ARROW for Larger',
        ready: 'Press SPACE to begin',
        fixate: 'Keep your eyes on the center of the screen',
        feedback: {
          correct: 'Correct!',
          incorrect: 'Incorrect',
          timeout: 'Too slow!'
        }
      },
      he: {
        title: 'משימת השוואת מספרים',
        task: 'האם המספר גדול או קטן מ-5?',
        keys: 'לחץ חץ שמאלה לקטן, חץ ימינה לגדול',
        ready: 'לחץ רווח להתחיל',
        fixate: 'שמור את העיניים במרכז המסך',
        feedback: {
          correct: '!נכון',
          incorrect: 'לא נכון',
          timeout: '!איטי מדי'
        }
      }
    }
  },

  /* =====================================================
     STATE
     ===================================================== */

  /**
   * Current experiment state.
   * @type {Object}
   */
  state: {
    mode: 'masked',           // 'masked' or 'explicit'
    trials: [],
    currentTrial: 0,
    results: [],
    targetOnset: 0,
    awaitingResponse: false,
    openedFromBuilder: false,
    language: 'en',
    trialsPerCondition: 12,   // Congruent + Incongruent
    showFeedback: true,
    currentPhase: 'setup'     // 'setup', 'instructions', 'trial', 'results'
  },

  /**
   * Template Builder settings.
   * @type {Object}
   */
  builderSettings: {
    mode: 'masked',
    primeDuration: 43,
    forwardMaskDuration: 71,
    backwardMaskDuration: 71,
    fixationDuration: 500,
    targetTimeout: 5000,
    feedbackDuration: 300,
    itiDuration: 1000,
    trialsPerCondition: 12,
    showFeedback: true,
    language: 'en',
    keySmaller: 'ArrowLeft',
    keyLarger: 'ArrowRight',
    referenceNumber: 5,
    maskChar: '####'
  },

  /**
   * Experimenter email for data collection.
   * @type {string}
   */
  experimenterEmail: '',

  /**
   * User-defined experiment identifier.
   * @type {string}
   */
  userExperimentId: '',

  /**
   * Whether running in participant mode (via shared link).
   * @type {boolean}
   */
  isParticipantMode: false,

  /* =====================================================
     INITIALIZATION
     ===================================================== */

  /**
   * Initialize NumberPriming module.
   * Sets up keyboard listener.
   */
  init: function() {
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    console.log('NumberPriming module initialized');
  },

  /* =====================================================
     OVERLAY CONTROL
     ===================================================== */

  /**
   * Open experiment overlay.
   */
  open: function() {
    const overlay = document.getElementById('number-priming-overlay');
    if (overlay) {
      overlay.classList.add('active');
      this.showSetup();
    }
  },

  /**
   * Close experiment overlay.
   * Handles return to builder or thank you screen.
   */
  close: function() {
    const overlay = document.getElementById('number-priming-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    this.state.awaitingResponse = false;

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
    this.state.currentPhase = 'setup';
    const setup = document.getElementById('number-priming-setup');
    const trial = document.getElementById('number-priming-trial');
    const results = document.getElementById('number-priming-results');

    if (setup) setup.style.display = 'block';
    if (trial) trial.classList.remove('active');
    if (results) results.classList.remove('active');

    this.renderResponseKeys();
  },

  /**
   * Display thank you modal for participants.
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

  /* =====================================================
     RESPONSE KEYS DISPLAY
     ===================================================== */

  /**
   * Render response key hints in UI.
   */
  renderResponseKeys: function() {
    const container = document.getElementById('number-priming-keys-container');
    if (!container) return;

    const keySmaller = this.builderSettings.keySmaller || 'ArrowLeft';
    const keyLarger = this.builderSettings.keyLarger || 'ArrowRight';
    const ref = this.builderSettings.referenceNumber || 5;

    // Display arrow symbols for arrow keys
    const displaySmaller = keySmaller.toLowerCase() === 'arrowleft' ? '←' : keySmaller;
    const displayLarger = keyLarger.toLowerCase() === 'arrowright' ? '→' : keyLarger;

    container.innerHTML = `
      <div class="key-hint">
        <span class="key">${displaySmaller}</span>
        <span class="label" style="color: #ff6b6b;">Smaller than ${ref}</span>
      </div>
      <div class="key-hint">
        <span class="key">${displayLarger}</span>
        <span class="label" style="color: #4ade80;">Larger than ${ref}</span>
      </div>
    `;
  },

  /* =====================================================
     TRIAL GENERATION
     ===================================================== */

  /**
   * Generate trial list for number priming experiment.
   * Creates congruent and incongruent trials.
   * @returns {Array} Shuffled array of trial objects
   */
  generateTrials: function() {
    const trials = [];
    const ref = this.builderSettings.referenceNumber || 5;
    const trialsPerCondition = this.builderSettings.trialsPerCondition || 12;

    // Numbers excluding reference
    const smallerNumbers = this.data.numbers.filter(n => n < ref);
    const largerNumbers = this.data.numbers.filter(n => n > ref);

    // Generate congruent trials (prime and target same side of reference)
    for (let i = 0; i < trialsPerCondition; i++) {
      // Both smaller
      const primeSmall = smallerNumbers[Math.floor(Math.random() * smallerNumbers.length)];
      const targetSmall = smallerNumbers[Math.floor(Math.random() * smallerNumbers.length)];
      trials.push({
        prime: primeSmall,
        target: targetSmall,
        congruent: true,
        correctResponse: 'smaller'
      });

      // Both larger
      const primeLarge = largerNumbers[Math.floor(Math.random() * largerNumbers.length)];
      const targetLarge = largerNumbers[Math.floor(Math.random() * largerNumbers.length)];
      trials.push({
        prime: primeLarge,
        target: targetLarge,
        congruent: true,
        correctResponse: 'larger'
      });
    }

    // Generate incongruent trials (prime and target different sides of reference)
    for (let i = 0; i < trialsPerCondition; i++) {
      // Prime smaller, target larger
      const primeSmall = smallerNumbers[Math.floor(Math.random() * smallerNumbers.length)];
      const targetLarge = largerNumbers[Math.floor(Math.random() * largerNumbers.length)];
      trials.push({
        prime: primeSmall,
        target: targetLarge,
        congruent: false,
        correctResponse: 'larger'
      });

      // Prime larger, target smaller
      const primeLarge = largerNumbers[Math.floor(Math.random() * largerNumbers.length)];
      const targetSmall = smallerNumbers[Math.floor(Math.random() * smallerNumbers.length)];
      trials.push({
        prime: primeLarge,
        target: targetSmall,
        congruent: false,
        correctResponse: 'smaller'
      });
    }

    // Shuffle trials
    for (let i = trials.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trials[i], trials[j]] = [trials[j], trials[i]];
    }

    return trials;
  },

  /* =====================================================
     EXPERIMENT FLOW
     ===================================================== */

  /**
   * Start the experiment.
   * Gets settings from UI and initializes trials.
   */
  start: function() {
    // Get settings from UI if present
    const modeSelect = document.getElementById('number-priming-mode');
    if (modeSelect) {
      this.builderSettings.mode = modeSelect.value;
      this.builderSettings.primeDuration = this.data.modes[modeSelect.value].primeDuration;
    }

    this.state.trials = this.generateTrials();
    this.state.currentTrial = 0;
    this.state.results = [];

    const setup = document.getElementById('number-priming-setup');
    const trial = document.getElementById('number-priming-trial');
    const results = document.getElementById('number-priming-results');

    if (setup) setup.style.display = 'none';
    if (results) results.classList.remove('active');
    if (trial) trial.classList.add('active');

    const totalTrialsEl = document.getElementById('np-total-trials');
    if (totalTrialsEl) {
      totalTrialsEl.textContent = this.state.trials.length;
    }

    this.state.currentPhase = 'trial';
    this.runTrial();
  },

  /**
   * Run current trial.
   * Presents fixation, mask, prime, mask, target sequence.
   */
  runTrial: function() {
    if (this.state.currentTrial >= this.state.trials.length) {
      this.showResults();
      return;
    }

    const trial = this.state.trials[this.state.currentTrial];
    const stimulus = document.getElementById('np-stimulus');

    // Update progress
    const currentTrialEl = document.getElementById('np-current-trial');
    if (currentTrialEl) {
      currentTrialEl.textContent = this.state.currentTrial + 1;
    }
    const progressFill = document.getElementById('np-progress-fill');
    if (progressFill) {
      const progress = (this.state.currentTrial / this.state.trials.length) * 100;
      progressFill.style.width = `${progress}%`;
    }

    this.state.awaitingResponse = false;

    // Phase 1: Fixation
    if (stimulus) {
      stimulus.innerHTML = '<span class="np-fixation">+</span>';
    }

    setTimeout(() => {
      // Phase 2: Forward Mask
      if (stimulus) {
        stimulus.innerHTML = `<span class="np-mask">${this.builderSettings.maskChar}</span>`;
      }

      setTimeout(() => {
        // Phase 3: Prime
        if (stimulus) {
          stimulus.innerHTML = `<span class="np-prime">${trial.prime}</span>`;
        }

        setTimeout(() => {
          // Phase 4: Backward Mask
          if (stimulus) {
            stimulus.innerHTML = `<span class="np-mask">${this.builderSettings.maskChar}</span>`;
          }

          setTimeout(() => {
            // Phase 5: Target
            if (stimulus) {
              stimulus.innerHTML = `<span class="np-target">${trial.target}</span>`;
            }
            this.state.targetOnset = performance.now();
            this.state.awaitingResponse = true;

            // Set timeout for response
            this.responseTimeout = setTimeout(() => {
              if (this.state.awaitingResponse) {
                this.handleTimeout();
              }
            }, this.builderSettings.targetTimeout);

          }, this.builderSettings.backwardMaskDuration);
        }, this.builderSettings.primeDuration);
      }, this.builderSettings.forwardMaskDuration);
    }, this.builderSettings.fixationDuration);
  },

  /**
   * Handle participant response.
   * @param {string} response - Response value ('smaller' or 'larger')
   */
  handleResponse: function(response) {
    if (!this.state.awaitingResponse) return;

    clearTimeout(this.responseTimeout);
    const rt = performance.now() - this.state.targetOnset;
    const trial = this.state.trials[this.state.currentTrial];
    const correct = response === trial.correctResponse;

    this.state.results.push({
      ...trial,
      rt: rt,
      correct: correct,
      response: response,
      timeout: false,
      mode: this.builderSettings.mode,
      primeDuration: this.builderSettings.primeDuration
    });

    this.state.awaitingResponse = false;
    this.state.currentTrial++;

    // Show feedback if enabled
    if (this.builderSettings.showFeedback) {
      const stimulus = document.getElementById('np-stimulus');
      const lang = this.builderSettings.language || 'en';
      const feedbackText = this.data.instructions[lang].feedback;

      if (stimulus) {
        if (correct) {
          stimulus.innerHTML = `<span class="feedback-correct" style="font-size: 1.5rem; color: #4ade80;">${feedbackText.correct}</span>`;
        } else {
          stimulus.innerHTML = `<span class="feedback-incorrect" style="font-size: 1.5rem; color: #ff6b6b;">${feedbackText.incorrect}</span>`;
        }
      }

      setTimeout(() => {
        // ITI
        const stimulus = document.getElementById('np-stimulus');
        if (stimulus) stimulus.innerHTML = '';
        setTimeout(() => this.runTrial(), this.builderSettings.itiDuration);
      }, this.builderSettings.feedbackDuration);
    } else {
      // No feedback, go to ITI directly
      const stimulus = document.getElementById('np-stimulus');
      if (stimulus) stimulus.innerHTML = '';
      setTimeout(() => this.runTrial(), this.builderSettings.itiDuration);
    }
  },

  /**
   * Handle response timeout.
   */
  handleTimeout: function() {
    const trial = this.state.trials[this.state.currentTrial];

    this.state.results.push({
      ...trial,
      rt: null,
      correct: false,
      response: null,
      timeout: true,
      mode: this.builderSettings.mode,
      primeDuration: this.builderSettings.primeDuration
    });

    this.state.awaitingResponse = false;
    this.state.currentTrial++;

    // Show timeout feedback
    if (this.builderSettings.showFeedback) {
      const stimulus = document.getElementById('np-stimulus');
      const lang = this.builderSettings.language || 'en';
      const feedbackText = this.data.instructions[lang].feedback;

      if (stimulus) {
        stimulus.innerHTML = `<span class="feedback-timeout" style="font-size: 1.5rem; color: #fbbf24;">${feedbackText.timeout}</span>`;
      }

      setTimeout(() => {
        const stimulus = document.getElementById('np-stimulus');
        if (stimulus) stimulus.innerHTML = '';
        setTimeout(() => this.runTrial(), this.builderSettings.itiDuration);
      }, this.builderSettings.feedbackDuration);
    } else {
      setTimeout(() => this.runTrial(), this.builderSettings.itiDuration);
    }
  },

  /**
   * Handle keyboard events.
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeydown: function(e) {
    const overlay = document.getElementById('number-priming-overlay');
    const trial = document.getElementById('number-priming-trial');

    if (overlay && overlay.classList.contains('active') &&
        trial && trial.classList.contains('active') &&
        this.state.awaitingResponse) {

      const key = e.key.toLowerCase();
      const keySmaller = (this.builderSettings.keySmaller || 'E').toLowerCase();
      const keyLarger = (this.builderSettings.keyLarger || 'I').toLowerCase();

      if (key === keySmaller) {
        e.preventDefault();
        this.handleResponse('smaller');
      } else if (key === keyLarger) {
        e.preventDefault();
        this.handleResponse('larger');
      }
    }
  },

  /* =====================================================
     RESULTS
     ===================================================== */

  /**
   * Calculate and display experiment results.
   * Computes priming effect and accuracy.
   */
  showResults: function() {
    this.state.currentPhase = 'results';

    const trial = document.getElementById('number-priming-trial');
    const results = document.getElementById('number-priming-results');

    if (trial) trial.classList.remove('active');
    if (results) results.classList.add('active');

    // Calculate statistics
    const validResults = this.state.results.filter(r => !r.timeout && r.correct);
    const congruentResults = validResults.filter(r => r.congruent);
    const incongruentResults = validResults.filter(r => !r.congruent);

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b.rt, 0) / arr.length) : 0;

    const congruentRT = avg(congruentResults);
    const incongruentRT = avg(incongruentResults);
    const primingEffect = incongruentRT - congruentRT;

    // Calculate accuracy
    const totalTrials = this.state.results.length;
    const correctTrials = this.state.results.filter(r => r.correct).length;
    const accuracy = Math.round((correctTrials / totalTrials) * 100);

    // Update display
    const congruentRTEl = document.getElementById('np-congruent-rt');
    const incongruentRTEl = document.getElementById('np-incongruent-rt');
    const primingEffectEl = document.getElementById('np-priming-effect');
    const accuracyEl = document.getElementById('np-accuracy');
    const explanationEl = document.getElementById('np-explanation');

    if (congruentRTEl) congruentRTEl.textContent = congruentRT + ' ms';
    if (incongruentRTEl) incongruentRTEl.textContent = incongruentRT + ' ms';
    if (primingEffectEl) {
      primingEffectEl.textContent = primingEffect + ' ms';
      primingEffectEl.style.color = primingEffect > 0 ? '#4ade80' : '#fbbf24';
    }
    if (accuracyEl) accuracyEl.textContent = accuracy + '%';

    // Generate explanation
    if (explanationEl) {
      explanationEl.textContent = this.generateExplanation(primingEffect, accuracy);
    }

    // Save results
    this.saveResults();
  },

  /**
   * Generate priming effect explanation text.
   * @param {number} primingEffect - RT difference in milliseconds
   * @param {number} accuracy - Accuracy percentage
   * @returns {string} Explanation text
   */
  generateExplanation: function(primingEffect, accuracy) {
    const mode = this.builderSettings.mode === 'masked' ? 'masked (subliminal)' : 'explicit';
    const ref = this.builderSettings.referenceNumber || 5;

    if (accuracy < 60) {
      return `Your accuracy (${accuracy}%) was below typical levels. This may indicate difficulty with the task or that responses were too fast. The priming effect cannot be reliably interpreted with low accuracy.`;
    }

    if (primingEffect > 30) {
      return `You showed a robust priming effect of ${primingEffect}ms! In the ${mode} condition, you responded faster when the prime and target were on the same side of ${ref} (congruent trials) compared to when they were on opposite sides (incongruent trials). This demonstrates that even briefly presented numbers can influence subsequent number processing.`;
    } else if (primingEffect > 10) {
      return `You showed a moderate priming effect of ${primingEffect}ms in the ${mode} condition. Congruent trials (prime and target both smaller or both larger than ${ref}) were responded to faster than incongruent trials. This is consistent with the classic Dehaene number priming finding.`;
    } else if (primingEffect > 0) {
      return `You showed a small priming effect of ${primingEffect}ms in the ${mode} condition. While the effect is in the expected direction (congruent faster than incongruent), it's smaller than typically observed. This could be due to individual differences or practice effects.`;
    } else if (primingEffect === 0) {
      return `No priming effect was observed (0ms difference). Response times were equal for congruent and incongruent trials in the ${mode} condition.`;
    } else {
      return `You showed a reversed priming effect of ${primingEffect}ms, with incongruent trials being faster than congruent trials. This is unusual and may reflect strategic response patterns or individual differences in number processing.`;
    }
  },

  /* =====================================================
     DATA SAVING
     ===================================================== */

  /**
   * Save trial results to Supabase.
   */
  saveResults: function() {
    if (!window.PTA || !PTA.supabase) {
      console.log('NumberPriming: Supabase not available, skipping save');
      return;
    }

    const experimentId = 'number_priming_' + this.builderSettings.mode;
    const participantId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

    const dataToSave = this.state.results.map((r, i) => ({
      experiment_id: experimentId,
      participant_id: participantId,
      trial_number: i + 1,
      prime: r.prime,
      target: r.target,
      congruent: r.congruent,
      correct_response: r.correctResponse,
      response: r.response,
      correct: r.correct,
      rt: r.rt ? Math.round(r.rt * 100) / 100 : null,
      timeout: r.timeout,
      priming_mode: r.mode,
      prime_duration: r.primeDuration,
      reference_number: this.builderSettings.referenceNumber,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null
    }));

    // Save using PTA core
    dataToSave.forEach(trial => {
      PTA.supabase.from('experiment_results').insert(trial)
        .then(({ error }) => {
          if (error) {
            console.error('Error saving trial:', error);
          }
        });
    });

    console.log('NumberPriming: Saved', dataToSave.length, 'trials');
  },

  /* =====================================================
     EXPORT
     ===================================================== */

  /**
   * Export results to CSV file.
   */
  exportCSV: function() {
    if (!this.state.results.length) {
      alert('No results to export');
      return;
    }

    const headers = ['Trial', 'Prime', 'Target', 'Congruent', 'Correct Response', 'Response', 'Correct', 'RT (ms)', 'Timeout', 'Mode', 'Prime Duration'];
    const rows = this.state.results.map((r, i) => [
      i + 1,
      r.prime,
      r.target,
      r.congruent ? 'Yes' : 'No',
      r.correctResponse,
      r.response || 'N/A',
      r.correct ? 'Yes' : 'No',
      r.rt ? Math.round(r.rt) : 'N/A',
      r.timeout ? 'Yes' : 'No',
      r.mode,
      r.primeDuration
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `number_priming_results_${new Date().toISOString().slice(0, 10)}.csv`;
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
      ['Trial', 'Prime', 'Target', 'Congruent', 'Correct Response', 'Response', 'Correct', 'RT (ms)', 'Timeout', 'Mode', 'Prime Duration'],
      ...this.state.results.map((r, i) => [
        i + 1,
        r.prime,
        r.target,
        r.congruent ? 'Yes' : 'No',
        r.correctResponse,
        r.response || 'N/A',
        r.correct ? 'Yes' : 'No',
        r.rt ? Math.round(r.rt) : 'N/A',
        r.timeout ? 'Yes' : 'No',
        r.mode,
        r.primeDuration
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `number_priming_results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  /* =====================================================
     TEMPLATE BUILDER
     ===================================================== */

  /**
   * Preview cycle index for builder.
   * @type {number}
   */
  previewIndex: 0,

  /**
   * Preview cycle interval reference.
   * @type {number|null}
   */
  previewInterval: null,

  /**
   * Open Template Builder overlay.
   */
  openBuilder: function() {
    const overlay = document.getElementById('number-priming-builder-overlay');
    if (overlay) {
      overlay.classList.add('active');
      this.initBuilderUI();
      this.startPreviewCycle();
    }
  },

  /**
   * Close Template Builder overlay.
   */
  closeBuilder: function() {
    const overlay = document.getElementById('number-priming-builder-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    this.stopPreviewCycle();
  },

  /**
   * Initialize builder UI with current settings.
   */
  initBuilderUI: function() {
    // Set form values from builderSettings
    const modeEl = document.getElementById('builder-np-mode');
    const primeDurEl = document.getElementById('builder-np-prime-duration');
    const fwMaskEl = document.getElementById('builder-np-forward-mask');
    const bwMaskEl = document.getElementById('builder-np-backward-mask');
    const fixationEl = document.getElementById('builder-np-fixation');
    const timeoutEl = document.getElementById('builder-np-timeout');
    const feedbackEl = document.getElementById('builder-np-feedback-duration');
    const itiEl = document.getElementById('builder-np-iti');
    const trialsEl = document.getElementById('builder-np-trials');
    const showFeedbackEl = document.getElementById('builder-np-show-feedback');
    const langEl = document.getElementById('builder-np-language');
    const keySmallerEl = document.getElementById('builder-np-key-smaller');
    const keyLargerEl = document.getElementById('builder-np-key-larger');
    const refNumEl = document.getElementById('builder-np-reference');
    const maskCharEl = document.getElementById('builder-np-mask-char');

    if (modeEl) modeEl.value = this.builderSettings.mode;
    if (primeDurEl) primeDurEl.value = this.builderSettings.primeDuration;
    if (fwMaskEl) fwMaskEl.value = this.builderSettings.forwardMaskDuration;
    if (bwMaskEl) bwMaskEl.value = this.builderSettings.backwardMaskDuration;
    if (fixationEl) fixationEl.value = this.builderSettings.fixationDuration;
    if (timeoutEl) timeoutEl.value = this.builderSettings.targetTimeout;
    if (feedbackEl) feedbackEl.value = this.builderSettings.feedbackDuration;
    if (itiEl) itiEl.value = this.builderSettings.itiDuration;
    if (trialsEl) trialsEl.value = this.builderSettings.trialsPerCondition;
    if (showFeedbackEl) showFeedbackEl.checked = this.builderSettings.showFeedback;
    if (langEl) langEl.value = this.builderSettings.language;
    if (keySmallerEl) keySmallerEl.value = this.builderSettings.keySmaller;
    if (keyLargerEl) keyLargerEl.value = this.builderSettings.keyLarger;
    if (refNumEl) refNumEl.value = this.builderSettings.referenceNumber;
    if (maskCharEl) maskCharEl.value = this.builderSettings.maskChar;

    this.updateBuilderPreview();
  },

  /**
   * Update builder settings from UI.
   */
  updateBuilderSettings: function() {
    const modeEl = document.getElementById('builder-np-mode');
    const primeDurEl = document.getElementById('builder-np-prime-duration');
    const fwMaskEl = document.getElementById('builder-np-forward-mask');
    const bwMaskEl = document.getElementById('builder-np-backward-mask');
    const fixationEl = document.getElementById('builder-np-fixation');
    const timeoutEl = document.getElementById('builder-np-timeout');
    const feedbackEl = document.getElementById('builder-np-feedback-duration');
    const itiEl = document.getElementById('builder-np-iti');
    const trialsEl = document.getElementById('builder-np-trials');
    const showFeedbackEl = document.getElementById('builder-np-show-feedback');
    const langEl = document.getElementById('builder-np-language');
    const keySmallerEl = document.getElementById('builder-np-key-smaller');
    const keyLargerEl = document.getElementById('builder-np-key-larger');
    const refNumEl = document.getElementById('builder-np-reference');
    const maskCharEl = document.getElementById('builder-np-mask-char');

    if (modeEl) {
      this.builderSettings.mode = modeEl.value;
      // Auto-set prime duration based on mode
      if (modeEl.value === 'masked' && primeDurEl) {
        this.builderSettings.primeDuration = 43;
        primeDurEl.value = 43;
      } else if (modeEl.value === 'explicit' && primeDurEl) {
        this.builderSettings.primeDuration = 200;
        primeDurEl.value = 200;
      }
    }
    if (primeDurEl) this.builderSettings.primeDuration = parseInt(primeDurEl.value) || 43;
    if (fwMaskEl) this.builderSettings.forwardMaskDuration = parseInt(fwMaskEl.value) || 71;
    if (bwMaskEl) this.builderSettings.backwardMaskDuration = parseInt(bwMaskEl.value) || 71;
    if (fixationEl) this.builderSettings.fixationDuration = parseInt(fixationEl.value) || 500;
    if (timeoutEl) this.builderSettings.targetTimeout = parseInt(timeoutEl.value) || 2000;
    if (feedbackEl) this.builderSettings.feedbackDuration = parseInt(feedbackEl.value) || 300;
    if (itiEl) this.builderSettings.itiDuration = parseInt(itiEl.value) || 1000;
    if (trialsEl) this.builderSettings.trialsPerCondition = parseInt(trialsEl.value) || 12;
    if (showFeedbackEl) this.builderSettings.showFeedback = showFeedbackEl.checked;
    if (langEl) this.builderSettings.language = langEl.value;
    if (keySmallerEl) this.builderSettings.keySmaller = keySmallerEl.value.toUpperCase();
    if (keyLargerEl) this.builderSettings.keyLarger = keyLargerEl.value.toUpperCase();
    if (refNumEl) this.builderSettings.referenceNumber = parseInt(refNumEl.value) || 5;
    if (maskCharEl) this.builderSettings.maskChar = maskCharEl.value || '####';

    this.updateBuilderPreview();
  },

  /**
   * Update builder preview display.
   */
  updateBuilderPreview: function() {
    const previewNumber = document.getElementById('np-preview-number');
    const previewMask = document.getElementById('np-preview-mask');

    if (previewNumber) {
      const numbers = [1, 2, 3, 4, 6, 7, 8, 9];
      previewNumber.textContent = numbers[this.previewIndex % numbers.length];
    }
    if (previewMask) {
      previewMask.textContent = this.builderSettings.maskChar;
    }
  },

  /**
   * Start preview animation cycle.
   */
  startPreviewCycle: function() {
    this.updateBuilderPreview();
    this.previewInterval = setInterval(() => {
      this.previewIndex++;
      this.updateBuilderPreview();
    }, 1500);
  },

  /**
   * Stop preview animation cycle.
   */
  stopPreviewCycle: function() {
    if (this.previewInterval) {
      clearInterval(this.previewInterval);
      this.previewInterval = null;
    }
  },

  /**
   * Preview experiment from builder settings.
   */
  previewFromBuilder: function() {
    this.updateBuilderSettings();
    this.state.openedFromBuilder = true;
    this.closeBuilder();
    this.open();
  },

  /**
   * Generate unique experiment ID.
   */
  generateExperimentId: function() {
    const el = document.getElementById('npExperimentId');
    if (el) {
      el.value = 'np_' + Date.now().toString(36);
      el.style.borderColor = 'rgba(74, 222, 128, 0.7)';
    }
  },

  /**
   * Test Supabase connection.
   * @async
   */
  testConnection: async function() {
    const statusEl = document.getElementById('np-connection-status');
    const statusText = statusEl ? statusEl.querySelector('.status-text') : null;

    try {
      if (window.PTA && PTA.supabase) {
        if (statusEl) statusEl.classList.remove('error');
        if (statusText) {
          statusText.innerHTML = '<strong>Connected</strong> - Data will be saved automatically';
        }
      } else {
        if (statusEl) statusEl.classList.add('error');
        if (statusText) {
          statusText.innerHTML = '<strong>Not Connected</strong> - Supabase not available';
        }
      }
    } catch (error) {
      if (statusEl) statusEl.classList.add('error');
      if (statusText) {
        statusText.innerHTML = '<strong>Error</strong> - ' + error.message;
      }
    }
  },

  /**
   * Generate shareable experiment link.
   */
  generateLink: function() {
    this.updateBuilderSettings();

    const emailEl = document.getElementById('npExperimenterEmail');
    const expIdEl = document.getElementById('npExperimentId');
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
      template: 'number-priming',
      mode: this.builderSettings.mode,
      primeDuration: this.builderSettings.primeDuration,
      forwardMaskDuration: this.builderSettings.forwardMaskDuration,
      backwardMaskDuration: this.builderSettings.backwardMaskDuration,
      fixationDuration: this.builderSettings.fixationDuration,
      targetTimeout: this.builderSettings.targetTimeout,
      feedbackDuration: this.builderSettings.feedbackDuration,
      itiDuration: this.builderSettings.itiDuration,
      trialsPerCondition: this.builderSettings.trialsPerCondition,
      showFeedback: this.builderSettings.showFeedback,
      language: this.builderSettings.language,
      keySmaller: this.builderSettings.keySmaller,
      keyLarger: this.builderSettings.keyLarger,
      referenceNumber: this.builderSettings.referenceNumber,
      maskChar: this.builderSettings.maskChar,
      experimenterEmail: email,
      userExperimentId: expId
    };

    try {
      const configStr = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
      const link = window.location.href.split('?')[0] + '?exp=' + configStr;

      // Show modal with link
      const modal = document.createElement('div');
      modal.id = 'np-link-modal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.9); z-index: 2000;
        display: flex; justify-content: center; align-items: center;
      `;

      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(255, 77, 184, 0.3);
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

      console.log('Number Priming link generated:', link);
    } catch (error) {
      console.error('Error generating link:', error);
      alert('Error generating link. Please try again.');
    }
  },

  /* =====================================================
     URL PARAMETER HANDLING
     ===================================================== */

  /**
   * Check URL for experiment configuration.
   * Auto-starts experiment if valid config found.
   * @returns {boolean} True if config was loaded
   */
  checkUrlConfig: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const expConfig = urlParams.get('exp');

    if (expConfig) {
      try {
        const config = JSON.parse(decodeURIComponent(escape(atob(expConfig))));
        if (config.template === 'number-priming') {
          this.isParticipantMode = true;
          this.experimenterEmail = config.experimenterEmail || '';
          this.userExperimentId = config.userExperimentId || '';

          // Apply all settings from config
          this.builderSettings = {
            mode: config.mode || 'masked',
            primeDuration: config.primeDuration || 43,
            forwardMaskDuration: config.forwardMaskDuration || 71,
            backwardMaskDuration: config.backwardMaskDuration || 71,
            fixationDuration: config.fixationDuration || 500,
            targetTimeout: config.targetTimeout || 2000,
            feedbackDuration: config.feedbackDuration || 300,
            itiDuration: config.itiDuration || 1000,
            trialsPerCondition: config.trialsPerCondition || 12,
            showFeedback: config.showFeedback !== undefined ? config.showFeedback : true,
            language: config.language || 'en',
            keySmaller: config.keySmaller || 'E',
            keyLarger: config.keyLarger || 'I',
            referenceNumber: config.referenceNumber || 5,
            maskChar: config.maskChar || '####'
          };

          // Hide main layout for participants
          const layout = document.querySelector('.layout');
          if (layout) layout.style.display = 'none';

          // Open experiment directly
          this.open();
          return true;
        }
      } catch (e) {
        console.error('Error parsing experiment config:', e);
      }
    }
    return false;
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  NumberPriming.init();
});

console.log('NumberPriming module loaded');
