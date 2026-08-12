/*
 * PREVIOUS VERSIONS ON GITHUB, newest first. Every change to this file adds a
 * line here, so any earlier state can be recovered if something goes wrong.
 *
 *   before the ABCD footnotes and the template-editing fixes, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/68bddb7/js/subliminal.js
 *
 *   before the full-codebase read of 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/02cecb1/js/subliminal.js
 *
 *   before a failed database save stopped being a console line, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/934c0b5/js/subliminal.js
 *
 *   before this paradigm carried the ABCD panel on its setup screen, 2026-08-11
 *   https://github.com/shir-openu/PrimingToolbox/blob/e090bd3/js/subliminal.js
 */
/**
 * =====================================================
 * PrimingToolbox - Subliminal Priming Module
 * =====================================================
 *
 * Masked subliminal priming paradigm based on Marcel (1983).
 * Implements forward mask → prime → backward mask → target sequence
 * with frame-accurate timing using requestAnimationFrame.
 *
 * Includes awareness check trials to verify subliminal presentation
 * was below conscious perception threshold.
 *
 * ABCD Framework Mapping:
 * - A (Prime): Masked word presented at ~33ms (2 frames at 60Hz)
 * - B (Target): Word/nonword for lexical decision
 * - C (Baseline): Unrelated prime-target pairs
 * - D (Measured): RT difference between related/unrelated; awareness rate
 *
 * Key References:
 * - Marcel, A. J. (1983). Conscious and unconscious perception.
 *   Cognitive Psychology, 15(2), 197-237.
 *
 * @module Subliminal
 * @version 1.0
 * @requires PTA (core.js)
 * =====================================================
 */

/**
 * Subliminal priming experiment namespace.
 * @namespace Subliminal
 */
window.Subliminal = {
  /**
   * This experiment, described in the ABCD framework.
   */
  abcdSpec: {
    accent: '#8ea8ff',
    articleAnchor: '#s2',
    abcd: {
      A: 'The prime word, shown for about 33 ms between a forward and a backward mask.',
      B: 'The letter string you judge as a real word or not.',
      C: 'Decision speed after an unrelated masked prime.',
      D: 'Decision speed after a related masked prime.'
    },
    characteristics: {
      association: 'Prime and target share meaning, exactly as in the visible version of this task.',
      secondariness: 'The strongest case on the platform: the prime is not merely ignored, it cannot be reported. The awareness check at the end is there to test that claim rather than assume it.',
      modulation: 'A related prime speeds the lexical decision even though the prime is never consciously seen.'
    },
    boundaryNote: 'If the awareness check shows the primes were visible after all, the run is still a valid priming experiment. It is simply no longer a subliminal one.'
  },


  /**
   * Data configuration for default stimuli.
   * Contains word pairs, mask patterns, and default mask character.
   * @type {Object}
   */
  data: {
    // Default stimuli - semantic word pairs
    wordPairs: [
      // Related pairs (congruent)
      { prime: 'DOCTOR', target: 'NURSE', relation: 'related', targetType: 'word' },
      { prime: 'BREAD', target: 'BUTTER', relation: 'related', targetType: 'word' },
      { prime: 'TABLE', target: 'CHAIR', relation: 'related', targetType: 'word' },
      { prime: 'KING', target: 'QUEEN', relation: 'related', targetType: 'word' },
      { prime: 'BLACK', target: 'WHITE', relation: 'related', targetType: 'word' },
      { prime: 'HOT', target: 'COLD', relation: 'related', targetType: 'word' },
      // Unrelated pairs (incongruent)
      { prime: 'DOCTOR', target: 'BUTTER', relation: 'unrelated', targetType: 'word' },
      { prime: 'BREAD', target: 'CHAIR', relation: 'unrelated', targetType: 'word' },
      { prime: 'TABLE', target: 'QUEEN', relation: 'unrelated', targetType: 'word' },
      { prime: 'KING', target: 'WHITE', relation: 'unrelated', targetType: 'word' },
      { prime: 'BLACK', target: 'COLD', relation: 'unrelated', targetType: 'word' },
      { prime: 'HOT', target: 'NURSE', relation: 'unrelated', targetType: 'word' },
      // Nonword targets (for lexical decision)
      { prime: 'DOCTOR', target: 'NIRSE', relation: 'nonword', targetType: 'nonword' },
      { prime: 'BREAD', target: 'BUTTIR', relation: 'nonword', targetType: 'nonword' },
      { prime: 'TABLE', target: 'CHIAR', relation: 'nonword', targetType: 'nonword' },
      { prime: 'KING', target: 'QUEAN', relation: 'nonword', targetType: 'nonword' },
      { prime: 'BLACK', target: 'WHETE', relation: 'nonword', targetType: 'nonword' },
      { prime: 'HOT', target: 'CALD', relation: 'nonword', targetType: 'nonword' }
    ],
    maskPatterns: ['####', '&&&&', '%%%%', '@@@@'],
    defaultMask: '####'
  },

  /**
   * Timing configuration in milliseconds.
   * Prime duration is critical - typically 33ms (2 frames at 60Hz) for subliminal.
   * @type {Object}
   */
  timing: {
    fixation: 500,           // Fixation cross duration
    forwardMask: 500,        // Forward mask duration
    prime: 33,               // Prime duration (2 frames @ 60Hz)
    backwardMask: 100,       // Backward mask duration
    target: 2000,            // Max target display time
    feedback: 500,           // Feedback duration
    iti: 1000                // Inter-trial interval
  },

  /**
   * Experiment state tracking.
   * Includes trials, results, timing data, and awareness check results.
   * @type {Object}
   */
  state: {
    trials: [],
    currentTrial: 0,
    results: [],
    targetOnset: 0,
    awaitingResponse: false,
    openedFromBuilder: false,
    awarenessTrials: [],
    frameRate: 60,           // Estimated monitor refresh rate
    frameTime: 16.67         // Time per frame in ms
  },

  /**
   * Template Builder stimuli for customization.
   * @type {Array<Object>}
   */
  builderStimuli: [
    { prime: 'DOCTOR', target: 'NURSE', relation: 'related' },
    { prime: 'BREAD', target: 'BUTTER', relation: 'related' },
    { prime: 'TABLE', target: 'CHAIR', relation: 'related' },
    { prime: 'KING', target: 'QUEEN', relation: 'related' }
  ],

  /**
   * Builder nonwords for lexical decision task.
   * @type {Array<string>}
   */
  builderNonwords: ['NIRSE', 'BUTTIR', 'CHIAR', 'QUEAN'],

  /** @type {string} Experimenter email for data association */
  experimenterEmail: '',
  /** @type {string} User-defined experiment identifier */
  userExperimentId: '',
  /** @type {boolean} True when running from shared participant link */
  isParticipantMode: false,

  /**
   * Initialize the subliminal module.
   * Sets up keyboard listener and estimates monitor frame rate.
   */
  init: function() {
    if (this._initDone) return;          // was unguarded: every call bound another keydown listener
    this._initDone = true;

    // Set up keyboard listener
    document.addEventListener('keydown', this.handleKeydown.bind(this));

    // Estimate frame rate
    this.estimateFrameRate();

    // Installs _after()/_clearTimers(). This module tracked only its builder
    // preview interval - the whole trial chain, INCLUDING the response window,
    // was untracked, and close() cleared nothing. Of the six older modules this
    // was the least protected against a timer firing into a later trial.
    PTK.timers(this);

    console.log('Subliminal module initialized');
  },

  /**
   * Estimate monitor refresh rate using requestAnimationFrame.
   * Counts 60 frames and calculates Hz from elapsed time.
   * Critical for accurate subliminal prime presentation.
   */
  estimateFrameRate: function() {
    let frameCount = 0;
    let startTime = performance.now();
    const self = this;

    function countFrames(timestamp) {
      frameCount++;
      if (frameCount < 60) {
        requestAnimationFrame(countFrames);
      } else {
        const elapsed = timestamp - startTime;
        self.state.frameRate = Math.round(1000 / (elapsed / 60));
        self.state.frameTime = 1000 / self.state.frameRate;
        console.log('Subliminal: Estimated frame rate:', self.state.frameRate, 'Hz');
      }
    }

    requestAnimationFrame(countFrames);
  },

  /**
   * Open the subliminal experiment overlay.
   * Shows setup screen and initializes response keys display.
   */
  open: function() {
    document.getElementById('subliminal-overlay').classList.add('active');
    document.getElementById('subliminal-setup').style.display = 'block';
    document.getElementById('subliminal-trial').classList.remove('active');
    document.getElementById('subliminal-results').classList.remove('active');
    this.renderResponseKeys();
    this.updateTimingDisplay();
    if (window.PTK) PTK.injectAbcd('subliminal-setup', this.abcdSpec);
  },

  /**
   * Close the subliminal experiment overlay.
   * Returns to builder if opened from there, or shows thank you screen.
   */
  close: function() {
    this._clearTimers();
    document.getElementById('subliminal-overlay').classList.remove('active');
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
   * Render response key hints in setup screen.
   * Shows left arrow for NONWORD, right arrow for WORD.
   */
  renderResponseKeys: function() {
    const container = document.getElementById('subliminal-keys-container');
    if (!container) return;

    container.innerHTML = `
      <div class="key-hint">
        <span class="key">←</span>
        <span class="label">NONWORD</span>
      </div>
      <div class="key-hint">
        <span class="key">→</span>
        <span class="label">WORD</span>
      </div>
    `;

    // Add click handlers
    const hints = container.querySelectorAll('.key-hint');
    hints.forEach((hint, index) => {
      hint.style.cursor = 'pointer';
      hint.addEventListener('click', () => {
        if (this.state.awaitingResponse) {
          this.handleResponse(index === 0 ? 'arrowleft' : 'arrowright');
        }
      });
    });
  },

  /**
   * Update timing display to show detected frame rate and prime duration.
   * Calculates number of frames for prime presentation.
   */
  updateTimingDisplay: function() {
    const frameRateEl = document.getElementById('subliminal-frame-rate');
    if (frameRateEl) {
      frameRateEl.textContent = this.state.frameRate + ' Hz';
    }

    const primeFramesEl = document.getElementById('subliminal-prime-frames');
    if (primeFramesEl) {
      const frames = Math.round(this.timing.prime / this.state.frameTime);
      primeFramesEl.textContent = frames + ' frame(s) (~' + Math.round(frames * this.state.frameTime) + 'ms)';
    }
  },

  /**
   * Generate randomized trial list.
   * Creates related, unrelated, and nonword trials with optional awareness checks.
   * @returns {Array<Object>} Shuffled array of trial objects
   */
  generateTrials: function() {
    const trials = [];
    const repetitions = parseInt(document.getElementById('subliminal-reps')?.value) || 2;

    // Use default word pairs or builder-customized pairs
    const wordPairs = this.builderStimuli.length > 0
      ? this.createPairsFromBuilder()
      : this.data.wordPairs;

    // Generate trials with repetitions
    for (let rep = 0; rep < repetitions; rep++) {
      wordPairs.forEach(pair => {
        trials.push({
          prime: pair.prime,
          target: pair.target,
          relation: pair.relation,
          targetType: pair.targetType || (pair.relation === 'nonword' ? 'nonword' : 'word'),
          trialType: 'main'
        });
      });
    }

    // Add awareness check trials if enabled
    if (document.getElementById('subliminal-awareness-check')?.checked) {
      const awarenessCount = Math.floor(trials.length * 0.1) || 2; // 10% awareness trials
      for (let i = 0; i < awarenessCount; i++) {
        const randomPair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
        trials.push({
          prime: randomPair.prime,
          target: '?????',
          relation: 'awareness',
          targetType: 'awareness',
          trialType: 'awareness',
          correctAwareness: randomPair.prime
        });
      }
    }

    // Shuffle trials
    for (let i = trials.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trials[i], trials[j]] = [trials[j], trials[i]];
    }

    return trials;
  },

  /**
   * Create stimulus pairs from Template Builder configuration.
   * Generates related, unrelated, and nonword pairs from builder stimuli.
   * @returns {Array<Object>} Array of prime-target pair objects
   */
  createPairsFromBuilder: function() {
    const pairs = [];
    const primes = this.builderStimuli.map(s => s.prime);
    const targets = this.builderStimuli.map(s => s.target);

    // Related pairs
    this.builderStimuli.forEach(stim => {
      pairs.push({
        prime: stim.prime,
        target: stim.target,
        relation: 'related',
        targetType: 'word'
      });
    });

    // Unrelated pairs (shuffle targets)
    const shuffledTargets = [...targets].sort(() => Math.random() - 0.5);
    primes.forEach((prime, i) => {
      // Make sure it's not the same pair
      const target = shuffledTargets[i] === this.builderStimuli[i].target
        ? shuffledTargets[(i + 1) % shuffledTargets.length]
        : shuffledTargets[i];
      pairs.push({
        prime: prime,
        target: target,
        relation: 'unrelated',
        targetType: 'word'
      });
    });

    // Nonword targets
    if (this.builderNonwords.length > 0) {
      primes.forEach((prime, i) => {
        pairs.push({
          prime: prime,
          target: this.builderNonwords[i % this.builderNonwords.length],
          relation: 'nonword',
          targetType: 'nonword'
        });
      });
    }

    return pairs;
  },

  /**
   * Start the subliminal priming experiment.
   * Reads timing settings from UI, generates trials, and begins first trial.
   */
  start: function() {
    // Get timing settings from UI
    this.timing.prime = parseInt(document.getElementById('subliminal-prime-duration')?.value) || 33;
    this.timing.forwardMask = parseInt(document.getElementById('subliminal-forward-mask')?.value) || 500;
    this.timing.backwardMask = parseInt(document.getElementById('subliminal-backward-mask')?.value) || 100;
    this.timing.fixation = parseInt(document.getElementById('subliminal-fixation')?.value) || 500;

    this.state.trials = this.generateTrials();
    this.state.currentTrial = 0;
    this.state.results = [];
    this.state.awarenessTrials = [];

    document.getElementById('subliminal-setup').style.display = 'none';
    document.getElementById('subliminal-results').classList.remove('active');
    document.getElementById('subliminal-trial').classList.add('active');
    document.getElementById('subliminal-total-trials').textContent = this.state.trials.length;
    document.getElementById('subliminal-overlay').focus();

    this.runTrial();
  },

  /**
   * Run a single trial.
   * Checks if experiment complete, otherwise starts masking sequence.
   */
  runTrial: function() {
    if (this.state.currentTrial >= this.state.trials.length) {
      this.showResults();
      return;
    }

    const trial = this.state.trials[this.state.currentTrial];
    const stimulus = document.getElementById('subliminal-stimulus');

    document.getElementById('subliminal-current-trial').textContent = this.state.currentTrial + 1;
    const progress = ((this.state.currentTrial) / this.state.trials.length) * 100;
    document.getElementById('subliminal-progress-fill').style.width = `${progress}%`;

    // Clear any previous content
    stimulus.innerHTML = '';
    this.state.awaitingResponse = false;

    // Start the masking sequence
    this.showFixation(trial);
  },

  /**
   * Show fixation cross.
   * First phase of masking sequence.
   * @param {Object} trial - Current trial object
   */
  showFixation: function(trial) {
    const stimulus = document.getElementById('subliminal-stimulus');
    stimulus.innerHTML = '<span class="subliminal-fixation">+</span>';

    this._after(() => {
      this.showForwardMask(trial);
    }, this.timing.fixation);
  },

  /**
   * Show forward mask before prime.
   * Prevents conscious perception of prime onset.
   * @param {Object} trial - Current trial object
   */
  showForwardMask: function(trial) {
    const stimulus = document.getElementById('subliminal-stimulus');
    // Was innerHTML with the value concatenated in. trial.prime, trial.target
    // and data.defaultMask all originate in builderStimuli/data, which
    // checkUrlConfig overwrites WHOLESALE from the ?exp= link with no
    // validation - so a crafted link ran script on a page holding the anon
    // key. PTK.showText uses textContent, which never parses HTML.
    PTK.showText(stimulus, this.data.defaultMask, 'subliminal-mask');

    this._after(() => {
      this.showPrime(trial);
    }, this.timing.forwardMask);
  },

  /**
   * Show prime stimulus using frame-accurate timing.
   * Uses requestAnimationFrame for precise duration control.
   * @param {Object} trial - Current trial object
   */
  showPrime: function(trial) {
    const stimulus = document.getElementById('subliminal-stimulus');
    // Was innerHTML with the value concatenated in. trial.prime, trial.target
    // and data.defaultMask all originate in builderStimuli/data, which
    // checkUrlConfig overwrites WHOLESALE from the ?exp= link with no
    // validation - so a crafted link ran script on a page holding the anon
    // key. PTK.showText uses textContent, which never parses HTML.
    PTK.showText(stimulus, trial.prime, 'subliminal-prime');

    // Use frame-accurate timing for prime
    const primeFrames = Math.max(1, Math.round(this.timing.prime / this.state.frameTime));
    let frameCount = 0;
    const self = this;

    function waitFrames() {
      frameCount++;
      if (frameCount < primeFrames) {
        requestAnimationFrame(waitFrames);
      } else {
        // Immediately show backward mask (NO gap!)
        self.showBackwardMask(trial);
      }
    }

    requestAnimationFrame(waitFrames);
  },

  /**
   * Show backward mask immediately after prime.
   * No gap between prime offset and mask onset is critical for subliminal presentation.
   * @param {Object} trial - Current trial object
   */
  showBackwardMask: function(trial) {
    const stimulus = document.getElementById('subliminal-stimulus');
    // Was innerHTML with the value concatenated in. trial.prime, trial.target
    // and data.defaultMask all originate in builderStimuli/data, which
    // checkUrlConfig overwrites WHOLESALE from the ?exp= link with no
    // validation - so a crafted link ran script on a page holding the anon
    // key. PTK.showText uses textContent, which never parses HTML.
    PTK.showText(stimulus, this.data.defaultMask, 'subliminal-mask');

    this._after(() => {
      this.showTarget(trial);
    }, this.timing.backwardMask);
  },

  /**
   * Show target stimulus and enable response collection.
   * For awareness trials, shows Y/N prompt instead of lexical decision.
   * @param {Object} trial - Current trial object
   */
  showTarget: function(trial) {
    const stimulus = document.getElementById('subliminal-stimulus');

    if (trial.trialType === 'awareness') {
      // Awareness check trial
      stimulus.innerHTML = `
        <div class="awareness-prompt">
          <p>Did you see a word before the symbols?</p>
          <p style="font-size: 0.9rem; color: #9aa6b2; margin-top: 10px;">Press <span class="key">Y</span> for Yes or <span class="key">N</span> for No</p>
        </div>
      `;
      this.state.targetOnset = performance.now();
      this.state.awaitingResponse = true;
      this.state.currentTrialIsAwareness = true;
    } else {
      // Regular lexical decision trial
      PTK.showText(stimulus, trial.target, 'subliminal-target');
      this.state.targetOnset = performance.now();
      this.state.awaitingResponse = true;
      this.state.currentTrialIsAwareness = false;
    }
  },

  /**
   * Handle participant response.
   * Routes to awareness handler or lexical decision handler based on trial type.
   * @param {string} key - Response key pressed
   */
  handleResponse: function(key) {
    if (!this.state.awaitingResponse) return;

    const rt = performance.now() - this.state.targetOnset;
    const trial = this.state.trials[this.state.currentTrial];

    if (this.state.currentTrialIsAwareness) {
      // Awareness trial response
      const sawWord = key === 'y';
      this.state.awarenessTrials.push({
        trialNumber: this.state.currentTrial + 1,
        prime: trial.prime,
        sawWord: sawWord,
        rt: rt
      });

      this.state.awaitingResponse = false;
      this.state.currentTrial++;

      // Brief feedback for awareness
      const stimulus = document.getElementById('subliminal-stimulus');
      stimulus.innerHTML = '<span style="font-size: 1.2rem; color: #9aa6b2;">Response recorded</span>';
      this._after(() => this.runTrial(), 500);
    } else {
      // Lexical decision response
      const response = key === 'arrowright' ? 'word' : 'nonword';
      const correct = response === trial.targetType;

      this.state.results.push({
        trialNumber: this.state.currentTrial + 1,
        prime: trial.prime,
        target: trial.target,
        relation: trial.relation,
        targetType: trial.targetType,
        response: response,
        correct: correct,
        rt: rt
      });

      this.state.awaitingResponse = false;
      this.state.currentTrial++;

      // Show feedback
      const stimulus = document.getElementById('subliminal-stimulus');
      if (correct) {
        stimulus.innerHTML = '<span class="feedback-correct" style="font-size: 1.5rem;">Correct</span>';
      } else {
        stimulus.innerHTML = '<span class="feedback-incorrect" style="font-size: 1.5rem;">Incorrect</span>';
      }

      this._after(() => this.runTrial(), this.timing.feedback);
    }
  },

  /**
   * Handle keyboard events during experiment.
   * Routes Y/N for awareness trials, arrow keys for lexical decision.
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeydown: function(e) {
    const overlay = document.getElementById('subliminal-overlay');
    const trial = document.getElementById('subliminal-trial');

    if (overlay && overlay.classList.contains('active') && trial && trial.classList.contains('active')) {
      const key = e.key.toLowerCase();

      if (this.state.currentTrialIsAwareness) {
        // Awareness trial - Y/N response
        if (key === 'y' || key === 'n') {
          e.preventDefault();
          this.handleResponse(key);
        }
      } else {
        // Lexical decision - Arrow key response
        if (key === 'arrowleft' || key === 'arrowright') {
          e.preventDefault();
          this.handleResponse(key);
        }
      }
    }
  },

  /**
   * Display results screen with priming effect statistics.
   * Calculates RT difference between related/unrelated pairs.
   * Shows awareness check summary if enabled.
   */
  showResults: function() {
    this._clearTimers();
    document.getElementById('subliminal-trial').classList.remove('active');
    document.getElementById('subliminal-results').classList.add('active');

    // Calculate statistics
    const correctResults = this.state.results.filter(r => r.correct);
    const relatedResults = correctResults.filter(r => r.relation === 'related');
    const unrelatedResults = correctResults.filter(r => r.relation === 'unrelated');

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b.rt, 0) / arr.length) : 0;

    const relatedRT = avg(relatedResults);
    const unrelatedRT = avg(unrelatedResults);
    const primingEffect = unrelatedRT - relatedRT;

    const accuracy = this.state.results.length > 0
      ? Math.round((correctResults.length / this.state.results.length) * 100)
      : 0;

    // Display results
    document.getElementById('subliminal-related-rt').textContent = relatedRT + ' ms';
    document.getElementById('subliminal-unrelated-rt').textContent = unrelatedRT + ' ms';
    document.getElementById('subliminal-priming-effect').textContent = primingEffect + ' ms';
    document.getElementById('subliminal-accuracy').textContent = accuracy + '%';

    // Awareness summary
    const awarenessEl = document.getElementById('subliminal-awareness-summary');
    if (awarenessEl && this.state.awarenessTrials.length > 0) {
      const sawWord = this.state.awarenessTrials.filter(a => a.sawWord).length;
      const total = this.state.awarenessTrials.length;
      const awarenessRate = Math.round((sawWord / total) * 100);
      awarenessEl.innerHTML = `
        <p><strong>Awareness Check:</strong></p>
        <p>Reported seeing prime: ${sawWord} / ${total} (${awarenessRate}%)</p>
        ${awarenessRate > 50
          ? '<p style="color: #ff4db8;">Note: High awareness rate may indicate prime was not fully subliminal.</p>'
          : '<p style="color: #4ade80;">Low awareness suggests prime was subliminal.</p>'
        }
      `;
      awarenessEl.style.display = 'block';
    }

    // Generate interpretation
    this.generateInterpretation(primingEffect, accuracy);

    // Save to Supabase
    this.saveResults();
  },

  /**
   * Generate text interpretation of results.
   * Explains priming effect magnitude and awareness implications.
   * @param {number} primingEffect - RT difference in ms (unrelated - related)
   * @param {number} accuracy - Overall accuracy percentage
   */
  generateInterpretation: function(primingEffect, accuracy) {
    const interpretEl = document.getElementById('subliminal-interpretation');
    if (!interpretEl) return;

    let interpretation = '';

    if (primingEffect > 20) {
      interpretation = `A positive priming effect of ${primingEffect}ms was observed. ` +
        `Responses to targets preceded by related primes were faster than those preceded by unrelated primes. ` +
        `This suggests that semantic information from the masked prime was processed even though it may not have been consciously perceived.`;
    } else if (primingEffect > 0) {
      interpretation = `A small positive priming effect of ${primingEffect}ms was observed. ` +
        `This modest effect suggests some semantic processing of the masked prime occurred, though the effect is relatively small.`;
    } else if (primingEffect < -20) {
      interpretation = `A negative priming effect of ${Math.abs(primingEffect)}ms was observed (faster for unrelated pairs). ` +
        `This unexpected pattern may indicate response strategy effects or require further investigation.`;
    } else {
      interpretation = `No clear priming effect was observed (${primingEffect}ms). ` +
        `This may indicate that the prime duration was insufficient for semantic processing, ` +
        `or that the masking was effective in preventing any prime processing.`;
    }

    if (accuracy < 70) {
      interpretation += ` Note: Overall accuracy was ${accuracy}%, which is relatively low and may affect the reliability of the priming effect estimate.`;
    }

    interpretEl.textContent = interpretation;
  },

  /**
   * Save results to Supabase database.
   * Includes all trial data plus timing parameters used.
   * @async
   */
  saveResults: function() {
    // Was `if (!window.PTA || !PTA.supabase) return` - "skipping save" was
    // literally true and silently so. A missing client is the case the rescue
    // path exists for, so it must fall through to saveAllResults, not bail.
    if (!window.PTA || typeof PTA.saveAllResults !== 'function') {
      console.error('Subliminal: platform core not loaded - results NOT saved', this.state.results);
      return;
    }

    const experimentId = 'subliminal_' + Date.now().toString(36);
    const participantId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

    const dataToSave = this.state.results.map((r, i) => ({
      experiment_type: 'subliminal_priming',
      experiment_id: experimentId,
      participant_id: participantId,
      trial_number: r.trialNumber,
      prime: r.prime,
      target: r.target,
      relation: r.relation,
      target_type: r.targetType,
      response: r.response,
      correct: r.correct,
      rt: Math.round(r.rt * 100) / 100,
      prime_duration_ms: this.timing.prime,
      forward_mask_ms: this.timing.forwardMask,
      backward_mask_ms: this.timing.backwardMask,
      experimenter_email: this.experimenterEmail || null,
      user_experiment_id: this.userExperimentId || null,
      timestamp: new Date().toISOString()
    }));

    PTA.saveAllResults('subliminal_results', dataToSave, {
      experimentName: 'Subliminal Priming',
      host: document.getElementById('subliminal-results')
    })
      .then(result => {
        if (result.error) {
          console.error('Subliminal: Error saving results', result.error);
        } else {
          console.log('Subliminal: Results saved successfully');
        }
      });
  },

  /**
   * Export results to CSV file.
   * Includes trial number, prime, target, relation, response, accuracy, RT.
   */
  exportCSV: function() {
    if (!this.state.results.length) {
      alert('No results to export');
      return;
    }

    const headers = ['Trial', 'Prime', 'Target', 'Relation', 'TargetType', 'Response', 'Correct', 'RT (ms)'];
    const rows = this.state.results.map(r => [
      r.trialNumber,
      r.prime,
      r.target,
      r.relation,
      r.targetType,
      r.response,
      r.correct ? 'Yes' : 'No',
      Math.round(r.rt)
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `subliminal_results_${new Date().toISOString().slice(0, 10)}.csv`;
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
      ['Trial', 'Prime', 'Target', 'Relation', 'TargetType', 'Response', 'Correct', 'RT (ms)'],
      ...this.state.results.map(r => [
        r.trialNumber,
        r.prime,
        r.target,
        r.relation,
        r.targetType,
        r.response,
        r.correct ? 'Yes' : 'No',
        Math.round(r.rt)
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `subliminal_results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  /** @type {number} Current index for cycling preview display */
  previewIndex: 0,
  /** @type {number|null} Interval ID for preview cycling */
  previewInterval: null,

  /**
   * Open Template Builder overlay.
   * Renders stimulus tables and starts preview cycle.
   */
  openBuilder: function() {
    // #subliminal-builder-overlay exists only in the standalone subliminal.html,
    // which is an untracked local file and not part of the site. On index.html
    // this line threw "Cannot read properties of null" and the Template Builder
    // chooser died silently on the 'subliminal' option - the one paradigm of
    // sixteen whose template could not be edited at all. Guarding rather than
    // failing silently: say what is missing, so it is a bug report and not a
    // dead button.
    const overlay = document.getElementById('subliminal-builder-overlay');
    if (!overlay) {
      console.error('Subliminal: #subliminal-builder-overlay is not on this page - ' +
        'the Template Builder markup was never added to index.html.');
      if (window.PTA && PTA.showMessage) {
        PTA.showMessage('The Subliminal Template Builder is not available on this page yet. ' +
          'You can still run the experiment with its default stimuli, or build a masked ' +
          'design from scratch at build/from-scratch.html.', 'error');
      } else {
        alert('The Subliminal Template Builder is not available on this page yet.');
      }
      return;
    }
    overlay.classList.add('active');
    this.renderStimulusTable();
    this.renderNonwordsTable();
    this.startPreviewCycle();
    this.updateTimingPreview();
  },

  /**
   * Close Template Builder overlay and stop preview cycling.
   */
  closeBuilder: function() {
    document.getElementById('subliminal-builder-overlay').classList.remove('active');
    this.stopPreviewCycle();
  },

  /**
   * Preview experiment from builder with current settings.
   * Sets flag to return to builder after preview.
   */
  previewFromBuilder: function() {
    this.state.openedFromBuilder = true;
    this.closeBuilder();
    this.open();
  },

  /**
   * Generate unique experiment ID with timestamp.
   */
  generateExperimentId: function() {
    const el = document.getElementById('subliminalExperimentId');
    if (el) {
      el.value = 'subliminal_' + Date.now().toString(36);
      el.style.borderColor = 'rgba(74, 222, 128, 0.7)';
    }
  },

  /**
   * Render editable stimulus table in builder.
   * Each row contains prime and target word inputs.
   */
  renderStimulusTable: function() {
    const tbody = document.getElementById('subliminal-stimulus-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    this.builderStimuli.forEach((stim, index) => {
      const row = document.createElement('tr');
      row.dataset.index = index;
      row.innerHTML = `
        <td>
          <input type="text" value="${PTK.esc(stim.prime)}"
                 onchange="Subliminal.updateStimulus(${index}, 'prime', this.value.toUpperCase())"
                 placeholder="Prime word" style="text-transform: uppercase;">
        </td>
        <td>
          <input type="text" value="${PTK.esc(stim.target)}"
                 onchange="Subliminal.updateStimulus(${index}, 'target', this.value.toUpperCase())"
                 placeholder="Target word" style="text-transform: uppercase;">
        </td>
        <td>
          <button class="btn-remove-row" onclick="Subliminal.removeStimulusRow(${index})"
                  ${this.builderStimuli.length <= 2 ? 'disabled' : ''}>x</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  },

  /**
   * Render nonwords list in builder for lexical decision task.
   */
  renderNonwordsTable: function() {
    const container = document.getElementById('subliminal-nonwords-list');
    if (!container) return;

    container.innerHTML = this.builderNonwords.map((nw, i) => `
      <div class="nonword-item" style="display: flex; gap: 10px; margin-bottom: 8px;">
        <input type="text" value="${PTK.esc(nw)}"
               onchange="Subliminal.updateNonword(${i}, this.value.toUpperCase())"
               placeholder="Nonword" style="text-transform: uppercase; flex: 1;">
        <button class="btn-remove-row" onclick="Subliminal.removeNonword(${i})"
                ${this.builderNonwords.length <= 1 ? 'disabled' : ''}>x</button>
      </div>
    `).join('');
  },

  /**
   * Update stimulus field in builder.
   * @param {number} index - Stimulus index
   * @param {string} field - Field name ('prime' or 'target')
   * @param {string} value - New value
   */
  updateStimulus: function(index, field, value) {
    this.builderStimuli[index][field] = value;
    this.updatePreview();
  },

  /**
   * Add new stimulus row to builder table.
   */
  addStimulusRow: function() {
    this.builderStimuli.push({
      prime: '',
      target: '',
      relation: 'related'
    });
    this.renderStimulusTable();
  },

  /**
   * Remove stimulus row from builder table.
   * Requires minimum 2 word pairs.
   * @param {number} index - Row index to remove
   */
  removeStimulusRow: function(index) {
    if (this.builderStimuli.length <= 2) {
      alert('You need at least 2 word pairs.');
      return;
    }
    this.builderStimuli.splice(index, 1);
    this.renderStimulusTable();
  },

  /**
   * Update nonword at specified index.
   * @param {number} index - Nonword index
   * @param {string} value - New nonword value
   */
  updateNonword: function(index, value) {
    this.builderNonwords[index] = value;
  },

  /**
   * Add new nonword to builder list.
   */
  addNonword: function() {
    this.builderNonwords.push('');
    this.renderNonwordsTable();
  },

  /**
   * Remove nonword from builder list.
   * Requires minimum 1 nonword.
   * @param {number} index - Nonword index to remove
   */
  removeNonword: function(index) {
    if (this.builderNonwords.length <= 1) {
      alert('You need at least 1 nonword.');
      return;
    }
    this.builderNonwords.splice(index, 1);
    this.renderNonwordsTable();
  },

  /**
   * Update timing preview display in builder.
   * Shows sequence: Forward Mask → Prime → Backward Mask → Target.
   */
  updateTimingPreview: function() {
    const primeDuration = parseInt(document.getElementById('builder-prime-duration')?.value) || 33;
    const forwardMask = parseInt(document.getElementById('builder-forward-mask')?.value) || 500;
    const backwardMask = parseInt(document.getElementById('builder-backward-mask')?.value) || 100;

    const previewEl = document.getElementById('timing-preview-text');
    if (previewEl) {
      previewEl.innerHTML = `
        Forward Mask: ${forwardMask}ms &rarr;
        <strong style="color: #ff4db8;">Prime: ${primeDuration}ms</strong> &rarr;
        Backward Mask: ${backwardMask}ms &rarr; Target
      `;
    }

    // Update main timing settings
    this.timing.prime = primeDuration;
    this.timing.forwardMask = forwardMask;
    this.timing.backwardMask = backwardMask;
  },

  /**
   * Update preview display with current stimulus pair.
   */
  updatePreview: function() {
    if (this.builderStimuli.length === 0) return;

    const stim = this.builderStimuli[this.previewIndex % this.builderStimuli.length];
    const previewPrime = document.getElementById('preview-prime');
    const previewTarget = document.getElementById('preview-target');

    if (previewPrime) {
      previewPrime.textContent = stim.prime || '????';
    }
    if (previewTarget) {
      previewTarget.textContent = stim.target || '????';
    }
  },

  /**
   * Start cycling through stimuli in preview display.
   * Updates every 2 seconds.
   */
  startPreviewCycle: function() {
    this.updatePreview();
    this.previewInterval = setInterval(() => {
      this.previewIndex++;
      this.updatePreview();
    }, 2000);
  },

  /**
   * Stop preview cycling and clear interval.
   */
  stopPreviewCycle: function() {
    if (this.previewInterval) {
      clearInterval(this.previewInterval);
      this.previewInterval = null;
    }
  },

  /**
   * Test Supabase database connection.
   * Updates status indicator in builder UI.
   * @async
   */
  testConnection: async function() {
    const statusEl = document.getElementById('subliminal-connection-status');
    const statusText = statusEl?.querySelector('.status-text');

    // Was: report "Connected" whenever PTA.supabase was truthy. That object
    // exists as soon as the CDN script loads and proves nothing about whether
    // the database answers. PTA.paintConnectionStatus issues a real query.
    if (window.PTA && PTA.paintConnectionStatus) {
      await PTA.paintConnectionStatus(statusEl, statusText);
    } else if (statusText) {
      statusEl?.classList.add('error');
      statusText.innerHTML = '<strong>Not connected</strong> - the platform core script ' +
        'did not load, so nothing can be saved.';
    }
  },

  /**
   * Generate shareable participant link with embedded configuration.
   * Encodes all experiment settings in Base64 URL parameter.
   */
  generateLink: function() {
    const emailEl = document.getElementById('subliminalExperimenterEmail');
    const expIdEl = document.getElementById('subliminalExperimentId');
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
      template: 'subliminal-priming',
      experimenterEmail: email,
      userExperimentId: expId,
      stimuli: this.builderStimuli,
      nonwords: this.builderNonwords,
      timing: {
        prime: this.timing.prime,
        forwardMask: this.timing.forwardMask,
        backwardMask: this.timing.backwardMask,
        fixation: this.timing.fixation
      },
      awarenessCheck: document.getElementById('builder-awareness-check')?.checked || false
    };

    try {
      const configStr = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
      // encodeURIComponent: base64 contains '+', and a raw '+' in a query
      // string decodes as a SPACE, which corrupts the payload and makes the
      // link silently dead. Verified. Old links are unaffected.
      const link = window.location.href.split('?')[0] + '?exp=' + encodeURIComponent(configStr);

      // Show modal with link
      const modal = document.createElement('div');
      modal.id = 'subliminal-link-modal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.9); z-index: 2000;
        display: flex; justify-content: center; align-items: center;
      `;

      modal.innerHTML = `
        <div style="background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(102, 126, 234, 0.3);
                    border-radius: 20px; padding: 40px; max-width: 650px; text-align: center;">
          <h2 style="color: #ffffff; margin-bottom: 20px;">Your Experiment Link is Ready!</h2>
          <p style="color: #9aa6b2; margin-bottom: 10px;">Send this link to your participants:</p>
          <input type="text" value="${PTK.esc(link)}" readonly style="
            width: 100%; padding: 15px; background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
            color: #ffffff; font-size: 0.85rem; margin-bottom: 20px;
          ">
          <div style="display: flex; gap: 15px; justify-content: center;">
            <button onclick="navigator.clipboard.writeText('${link}').then(() => alert('Link copied!'))" style="
              background: linear-gradient(135deg, #667eea, #764ba2); border: none;
              color: white; padding: 12px 25px; border-radius: 8px; cursor: pointer;
            ">Copy Link</button>
            <button onclick="this.closest('div').parentElement.parentElement.remove()" style="
              background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
              color: white; padding: 12px 25px; border-radius: 8px; cursor: pointer;
            ">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      console.log('Subliminal link generated:', link);
    } catch (error) {
      console.error('Error generating link:', error);
      alert('Error generating link. Please try again.');
    }
  },

  /**
   * Check URL for embedded experiment configuration.
   * Parses Base64-encoded config from 'exp' parameter and auto-starts experiment.
   * @returns {boolean} True if valid config found and experiment started
   */
  checkUrlConfig: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const expConfig = urlParams.get('exp');

    if (expConfig) {
      try {
        const config = JSON.parse(decodeURIComponent(escape(atob(expConfig))));
        if (config.template === 'subliminal-priming') {
          this.isParticipantMode = true;
          this.experimenterEmail = config.experimenterEmail || '';
          this.userExperimentId = config.userExperimentId || '';

          // Apply custom stimuli
          if (config.stimuli && config.stimuli.length > 0) {
            this.builderStimuli = config.stimuli;
          }
          if (config.nonwords && config.nonwords.length > 0) {
            this.builderNonwords = config.nonwords;
          }

          // Apply timing settings
          if (config.timing) {
            this.timing.prime = config.timing.prime || 33;
            this.timing.forwardMask = config.timing.forwardMask || 500;
            this.timing.backwardMask = config.timing.backwardMask || 100;
            this.timing.fixation = config.timing.fixation || 500;
          }

          // Hide main layout for participants
          const layout = document.querySelector('.layout');
          if (layout) {
            layout.style.display = 'none';
          }

          // Open Subliminal directly
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
  Subliminal.init();
});

console.log('Subliminal module loaded');
