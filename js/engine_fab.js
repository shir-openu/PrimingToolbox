/*
 * PREVIOUS VERSIONS ON GITHUB, newest first. Every change to this file adds a
 * line here, so any earlier state can be recovered if something goes wrong.
 *
 *   before the experimenter-layer event logging, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/e93dccf/js/engine_fab.js
 *
 *   before the schema-drift fix, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/0783ff2/js/engine_fab.js
 *
 *   before the full-codebase read of 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/02cecb1/js/engine_fab.js
 *
 *   before a failed database save stopped being a console line, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/934c0b5/js/engine_fab.js
 *
 *   before the response-timeout double-fire fix and the per-condition generic stats, 2026-08-11
 *   https://github.com/shir-openu/PrimingToolbox/blob/87e1f20/js/engine_fab.js
 */
/**
 * =====================================================
 * PrimingToolbox - Trial Engine (V2 _fab wrapper)
 * =====================================================
 *
 * IDENTICAL to js/engine.js except that the whole file is wrapped in an IIFE.
 *
 * Why: engine.js opens with `const PTA = window.PTA || {};` at global scope,
 * and js/core_fab.js (loaded first) declares the very same global `const PTA`.
 * Two `const` declarations of one name in the global lexical scope is a
 * SyntaxError, so the browser threw engine.js away in its entirety and
 * `PTA.Engine` was undefined at run time. Nothing that goes through the shared
 * trial engine could run - including participant links, which is exactly the
 * path the trial timeline feeds. The paradigm modules (stroop.js, semantic.js,
 * ...) carry their own trial loops, which is why the site still appeared to
 * work and this stayed hidden.
 *
 * The IIFE gives engine.js its own scope, so its `const PTA` no longer
 * collides. Not one line of engine.js logic is changed; engine.js itself is
 * left untouched on disk.
 *
 * Verified 2026-07-25: with this file loaded, typeof PTA.Engine === 'object'.
 * =====================================================
 */
(function () {
/**
 * =====================================================
 * PrimingToolbox - Generic Priming Engine
 * =====================================================
 *
 * Core experiment engine implementing the ABCD Framework
 * for priming research (Sivroni & Stark, 2025).
 *
 * ABCD Framework:
 * - A = Prime (influencing information)
 * - B = Target (input to process)
 * - C = Baseline outcome (without A)
 * - D = Measured outcome (with A)
 * - Priming Effect = D ≠ C
 *
 * Three diagnostic criteria for priming:
 * 1. Association - relationship between A and B
 * 2. Secondariness - A is not required for the task
 * 3. Modulation - A changes outcome from C to D
 *
 * Supports:
 * - Sequential presentation (prime → ISI → target)
 * - Simultaneous presentation (Stroop-style)
 * - Configurable timing parameters
 * - Keyboard response collection
 * - Automatic data saving to Supabase
 *
 * @module PTA.Engine
 * @version 1.0
 * @requires PTA (core.js)
 * =====================================================
 */

const PTA = window.PTA || {};

PTA.Engine = {
  /**
   * Escape a value for interpolation into innerHTML.
   *
   * Every string this engine displays arrives inside a ?config= participant
   * link, so all of it is attacker-controlled. This lived inside renderStimulus
   * until 2026-08-12, which meant the two other functions that write config
   * data into innerHTML - renderSimultaneousStimulus and showFeedback - could
   * not reach it and escaped nothing. One escaper on the engine, so a new
   * render branch cannot quietly be written without one.
   *
   * Not PTK.esc: engine_fab.js loads before paradigm_kit_fab.js.
   * @param {*} s
   * @returns {string}
   */
  _esc: function(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // Current experiment configuration
  config: null,

  // Current state
  state: {
    isRunning: false,
    currentTrial: 0,
    totalTrials: 0,
    trials: [],
    results: [],
    participantId: null,
    externalId: null,
    startTime: null
  },

  // DOM references
  elements: {
    overlay: null,
    setupScreen: null,
    trialScreen: null,
    resultsScreen: null,
    stimulusDisplay: null,
    progressBar: null,
    progressText: null
  },

  /* =====================================================
     Initialization
     ===================================================== */

  /**
   * Initialize engine with experiment configuration.
   * Resets state and prepares for new experiment.
   * @param {Object} config - Experiment configuration object
   * @returns {Object} This engine instance (for chaining)
   */
  init: function(config) {
    this.config = config;
    this.state = {
      isRunning: false,
      currentTrial: 0,
      totalTrials: 0,
      trials: [],
      results: [],
      participantId: PTA.generateParticipantId(),
      externalId: null,
      startTime: null
    };

    console.log('PTA Engine: Initialized with config', config.name);
    return this;
  },

  /**
   * Bind DOM elements by ID for quick access.
   * @param {Object} elementIds - Map of key names to element IDs
   * @returns {Object} This engine instance (for chaining)
   */
  bindElements: function(elementIds) {
    for (const [key, id] of Object.entries(elementIds)) {
      this.elements[key] = document.getElementById(id);
    }
    return this;
  },

  /* =====================================================
     Trial Generation
     ===================================================== */

  /**
   * Generate trial list based on experiment configuration.
   * Handles Stroop and generic priming paradigms.
   * Applies randomization if specified in config.
   * @returns {Object} This engine instance (for chaining)
   */
  generateTrials: function() {
    const trials = [];
    const config = this.config;

    // Check experiment type for specialized trial generation
    if (config.type === 'stroop') {
      // Stroop-specific trial generation
      this.generateStroopTrials(trials);
    } else if (config.primes && config.primes.items) {
      // Generic trial generation
      const primes = config.primes.items;
      const targets = config.targets.items;

      if (config.trials.pairings) {
        // Explicit pairings provided
        for (const pairing of config.trials.pairings) {
          for (let rep = 0; rep < (config.trials.repetitions || 1); rep++) {
            trials.push({
              primeIndex: pairing.primeIndex,
              targetIndex: pairing.targetIndex,
              prime: primes[pairing.primeIndex],
              target: targets[pairing.targetIndex],
              condition: pairing.condition,
              correctResponse: pairing.correctResponse
            });
          }
        }
      } else {
        // Default: pair each prime with each target
        for (let p = 0; p < primes.length; p++) {
          for (let t = 0; t < targets.length; t++) {
            for (let rep = 0; rep < (config.trials.repetitions || 1); rep++) {
              trials.push({
                primeIndex: p,
                targetIndex: t,
                prime: primes[p],
                target: targets[t],
                condition: 'default',
                correctResponse: null
              });
            }
          }
        }
      }
    }

    // Randomize if specified
    if (config.trials.randomize) {
      this.state.trials = PTA.shuffleArray(trials);
    } else {
      this.state.trials = trials;
    }

    this.state.totalTrials = this.state.trials.length;
    console.log('PTA Engine: Generated', this.state.totalTrials, 'trials');

    return this;
  },

  /**
   * Generate Stroop-specific trials with congruent/incongruent conditions.
   * Congruent: word meaning matches ink color.
   * Incongruent: word meaning differs from ink color.
   * @param {Array} trials - Array to populate with trial objects
   */
  generateStroopTrials: function(trials) {
    const config = this.config;
    const colors = Object.keys(config.colors);
    const congruentReps = config.trials.congruent_reps || 2;
    const incongruentReps = config.trials.incongruent_reps || 2;

    colors.forEach(inkColor => {
      // Congruent trials: word matches ink color
      for (let i = 0; i < congruentReps; i++) {
        trials.push({
          inkColor: inkColor,
          inkHex: config.colors[inkColor].hex,
          word: config.colors[inkColor].word,
          wordMeaning: inkColor,
          congruent: true,
          correctResponse: inkColor
        });
      }

      // Incongruent trials: word differs from ink color
      const otherColors = colors.filter(c => c !== inkColor);
      for (let i = 0; i < incongruentReps; i++) {
        const wordMeaning = otherColors[i % otherColors.length];
        trials.push({
          inkColor: inkColor,
          inkHex: config.colors[inkColor].hex,
          word: config.colors[wordMeaning].word,
          wordMeaning: wordMeaning,
          congruent: false,
          correctResponse: inkColor
        });
      }
    });

    console.log('PTA Engine: Generated Stroop trials -',
      trials.filter(t => t.congruent).length, 'congruent,',
      trials.filter(t => !t.congruent).length, 'incongruent');
  },

  /* =====================================================
     Experiment Flow
     ===================================================== */

  /**
   * Start the experiment.
   * Initializes state, hides setup screen, shows trial screen.
   */
  start: function() {
    if (this.state.isRunning) {
      console.warn('PTA Engine: Already running');
      return;
    }

    this.state.isRunning = true;
    this.state.startTime = Date.now();
    this.state.currentTrial = 0;
    this.state.results = [];

    console.log('PTA Engine: Starting experiment');

    // Hide setup, show trial screen
    if (this.elements.setupScreen) {
      this.elements.setupScreen.style.display = 'none';
    }
    if (this.elements.trialScreen) {
      this.elements.trialScreen.classList.add('active');
    }

    // Start first trial
    this.runTrial();
  },

  /**
   * Run current trial.
   * Determines presentation mode and initiates stimulus sequence.
   */
  runTrial: function() {
    const trial = this.state.trials[this.state.currentTrial];

    if (!trial) {
      this.endExperiment();
      return;
    }

    // Update progress
    this.updateProgress();

    // Get presentation settings
    const presentation = this.config.presentation;

    if (presentation.mode === 'simultaneous') {
      // Simultaneous presentation (e.g., Stroop)
      this.presentSimultaneous(trial);
    } else {
      // Sequential presentation (e.g., semantic priming)
      this.presentSequential(trial);
    }
  },

  /**
   * Present stimuli simultaneously (Stroop-style).
   * Shows fixation, then combined prime+target.
   * @param {Object} trial - Current trial object
   */
  presentSimultaneous: function(trial) {
    const presentation = this.config.presentation;

    // Show fixation
    if (presentation.fixation_ms > 0) {
      this.showFixation();
      setTimeout(() => {
        this.showStimulusSimultaneous(trial);
      }, presentation.fixation_ms);
    } else {
      this.showStimulusSimultaneous(trial);
    }
  },

  /**
   * Present stimuli sequentially (semantic priming style).
   * Sequence: fixation → prime → ISI → target.
   * @param {Object} trial - Current trial object
   */
  presentSequential: function(trial) {
    const presentation = this.config.presentation;

    // Show fixation
    if (presentation.fixation_ms > 0) {
      this.showFixation();
      setTimeout(() => {
        this.showPrime(trial);
      }, presentation.fixation_ms);
    } else {
      this.showPrime(trial);
    }
  },

  /**
   * Display fixation cross in stimulus area.
   * Centers attention before stimulus presentation.
   */
  showFixation: function() {
    if (this.elements.stimulusDisplay) {
      this.elements.stimulusDisplay.innerHTML = '<span class="fixation">+</span>';
      this.elements.stimulusDisplay.style.color = '#ffffff';
    }
  },

  /**
   * Display prime stimulus (A in ABCD framework).
   * After prime duration, advances to ISI or target.
   * @param {Object} trial - Current trial with prime data
   */
  showPrime: function(trial) {
    const presentation = this.config.presentation;

    if (this.elements.stimulusDisplay) {
      this.elements.stimulusDisplay.innerHTML = this.renderStimulus(trial.prime, this.config.primes.type);
    }

    // After prime duration, show ISI or target
    setTimeout(() => {
      if (presentation.ISI_ms > 0) {
        this.showISI(trial);
      } else {
        this.showTarget(trial);
      }
    }, presentation.prime_duration_ms);
  },

  /**
   * Display inter-stimulus interval (blank screen).
   * Separates prime from target in sequential presentation.
   * @param {Object} trial - Current trial object
   */
  showISI: function(trial) {
    const presentation = this.config.presentation;

    if (this.elements.stimulusDisplay) {
      this.elements.stimulusDisplay.innerHTML = '';
    }

    setTimeout(() => {
      this.showTarget(trial);
    }, presentation.ISI_ms);
  },

  /**
   * Display target stimulus (B in ABCD framework).
   * Records target onset time and begins response collection.
   * @param {Object} trial - Current trial with target data
   */
  showTarget: function(trial) {
    if (this.elements.stimulusDisplay) {
      this.elements.stimulusDisplay.innerHTML = this.renderStimulus(trial.target, this.config.targets.type);
    }

    // Start listening for response
    trial.targetOnset = Date.now();
    this.listenForResponse(trial);
  },

  /**
   * Display both stimuli simultaneously (Stroop-style).
   * Prime and target combined in single display.
   * @param {Object} trial - Current trial object
   */
  showStimulusSimultaneous: function(trial) {
    // For Stroop-like experiments, prime and target are shown together
    // The prime might be a property (word meaning) and target another (ink color)
    if (this.elements.stimulusDisplay) {
      this.elements.stimulusDisplay.innerHTML = this.renderSimultaneousStimulus(trial);
    }

    // Start listening for response
    trial.targetOnset = Date.now();
    this.listenForResponse(trial);
  },

  /**
   * Render single stimulus as HTML.
   * Supports text, image, and color types.
   * @param {string} stimulus - Stimulus content (text, URL, or color)
   * @param {string} type - Stimulus type: 'text', 'image', or 'color'
   * @returns {string} HTML string for stimulus display
   */
  renderStimulus: function(stimulus, type) {
    // FIXED 2026-08-10. Every branch interpolated the stimulus raw. This is the
    // SHARED engine that runs generic ?config= participant links, so `stimulus`
    // is decoded straight from a URL an attacker can hand someone - the same
    // hole fixed in stroop.js (e217762) and the three modules in 946148f, but
    // on the path every generic link takes.
    //
    // Escaped rather than rebuilt with DOM APIs because this function returns
    // an HTML STRING and its callers assign it to innerHTML; changing the
    // contract would mean touching every call site. Escaping closes the hole
    // without that risk. Own helper, not PTK.esc, because engine_fab.js is
    // loaded before paradigm_kit_fab.js.
    //
    // 2026-08-12: the helper used to be declared HERE, local to this function,
    // and the comment above claimed the hole was closed "on the path every
    // generic link takes". It was not. renderSimultaneousStimulus is that same
    // path whenever presentation.mode is 'simultaneous', and showFeedback is
    // reached on every trial when feedback is on; neither could see a helper
    // scoped to this function, and neither escaped anything. Hoisted to the
    // engine so there is one escaper and no branch can quietly miss it.
    var esc = PTA.Engine._esc;
    switch (type) {
      case 'text':
        return `<span>${esc(stimulus)}</span>`;
      case 'image':
        return `<img src="${esc(stimulus)}" alt="stimulus" style="max-width: 100%; max-height: 300px;">`;
      case 'color':
        return `<span style="color: ${esc(stimulus)};">&#9632;</span>`; // Color square
      default:
        return `<span>${esc(stimulus)}</span>`;
    }
  },

  /**
   * Render combined prime+target stimulus for simultaneous display.
   * Handles Stroop (word in colored ink) and other combined displays.
   * @param {Object} trial - Trial with prime and target properties
   * @returns {string} HTML string for combined stimulus
   */
  renderSimultaneousStimulus: function(trial) {
    // Every value below comes from the trial list, which is built from the
    // ?config= link. Same hole as renderStimulus, same fix - see the note there.
    const esc = PTA.Engine._esc;
    // Check if this is a Stroop trial
    if (this.config.type === 'stroop' && trial.inkHex && trial.word) {
      // Stroop: word displayed in ink color
      return `<span style="color: ${esc(trial.inkHex)}; font-size: 4rem; font-weight: bold;">${esc(trial.word)}</span>`;
    } else if (this.config.primes && this.config.primes.type === 'text' && this.config.targets.type === 'color') {
      // Text displayed in a color (classic Stroop)
      return `<span style="color: ${esc(trial.target)};">${esc(trial.prime)}</span>`;
    } else if (this.config.primes && this.config.primes.type === 'color' && this.config.targets.type === 'text') {
      // Color with text overlay
      return `<span style="color: ${esc(trial.prime)};">${esc(trial.target)}</span>`;
    } else {
      // Default: show both
      return `<span>${esc(trial.prime || '')}</span><br><span>${esc(trial.target || '')}</span>`;
    }
  },

  /* =====================================================
     Response Handling
     ===================================================== */

  /**
   * Current keyboard event handler reference.
   * Stored to allow removal when response received.
   * @type {Function|null}
   */
  responseHandler: null,

  /**
   * Attach keyboard listener for participant response.
   * Validates key presses against configured response keys.
   * Handles response timeout if configured.
   * @param {Object} trial - Current trial object
   */
  listenForResponse: function(trial) {
    const responseConfig = this.config.response;

    // Remove any existing handler
    if (this.responseHandler) {
      document.removeEventListener('keydown', this.responseHandler);
    }

    // One token per trial. The timeout below used to guard on
    // `if (this.responseHandler)`, which is truthy for the whole run: a
    // participant who answered in time still got a second recordResponse()
    // for the SAME trial when the window elapsed, scored as no response, and
    // it advanced the experiment a second time - so half the trials were
    // skipped and a null row was written for each. The bug needs a fast
    // responder to show itself, which is why it survived: it never fires when
    // you step through the task slowly by hand.
    const token = (this.responseToken || 0) + 1;
    this.responseToken = token;

    if (this.responseTimeoutId) {
      clearTimeout(this.responseTimeoutId);
      this.responseTimeoutId = null;
    }

    // Create response handler
    this.responseHandler = (event) => {
      const key = event.key.toUpperCase();

      // Check if pressed key is a valid response key
      let responseValue = null;
      for (const [value, keyBinding] of Object.entries(responseConfig.keys)) {
        if (keyBinding.toUpperCase() === key) {
          responseValue = value;
          break;
        }
      }

      if (responseValue !== null) {
        if (this.responseToken !== token) return;   // already resolved
        this.responseToken = token + 1;
        event.preventDefault();
        document.removeEventListener('keydown', this.responseHandler);
        if (this.responseTimeoutId) {
          clearTimeout(this.responseTimeoutId);
          this.responseTimeoutId = null;
        }
        this.recordResponse(trial, responseValue);
      }
    };

    document.addEventListener('keydown', this.responseHandler);

    // Timeout if specified
    if (this.config.presentation.response_timeout_ms) {
      this.responseTimeoutId = setTimeout(() => {
        if (this.responseToken !== token) return;   // the participant answered
        this.responseToken = token + 1;
        this.responseTimeoutId = null;
        document.removeEventListener('keydown', this.responseHandler);
        this.recordResponse(trial, null); // No response
      }, this.config.presentation.response_timeout_ms);
    }
  },

  /**
   * Record participant response and compute trial outcome.
   * Calculates RT from target onset. Builds result object.
   * Shows feedback if configured, then advances to next trial.
   * @param {Object} trial - Current trial object with targetOnset
   * @param {string|null} response - Response value or null if timeout
   */
  recordResponse: function(trial, response) {
    const rt = Date.now() - trial.targetOnset;
    // Absence, not truthiness. A trial row whose Correct column the author left
    // empty arrives here with correctResponse null (scratch_builder_fab.js), and
    // a hand-written config can omit the field entirely. `correct` is then null,
    // meaning "this trial has no right answer" - which is a legitimate design,
    // not a wrong response. Everything downstream has to honour that: see
    // showFeedback, which used to call such a trial Incorrect.
    const hasCorrectAnswer = !(trial.correctResponse == null || trial.correctResponse === '');
    const correct = hasCorrectAnswer ? (response === trial.correctResponse) : null;

    // Build result object based on experiment type
    let result;
    if (this.config.type === 'stroop') {
      result = {
        trial_number: this.state.currentTrial + 1,
        word: trial.word,
        word_meaning: trial.wordMeaning,
        ink_color: trial.inkColor,
        congruent: trial.congruent,
        response: response,
        correct_response: trial.correctResponse,
        correct: correct,
        rt: rt,
        // `timestamp` is not a column on experiment_results and never was, so
        // PostgREST rejected the whole insert. sql/add_missing_columns.sql adds
        // it as trial_timestamp - `timestamp` itself is an SQL reserved word and
        // would need quoting everywhere it is touched.
        trial_timestamp: new Date().toISOString()
      };
    } else {
      result = {
        trial_number: this.state.currentTrial + 1,
        prime: trial.prime,
        target: trial.target,
        condition: trial.condition,
        response: response,
        correct: correct,
        rt: rt,
        // `timestamp` is not a column on experiment_results and never was, so
        // PostgREST rejected the whole insert. sql/add_missing_columns.sql adds
        // it as trial_timestamp - `timestamp` itself is an SQL reserved word and
        // would need quoting everywhere it is touched.
        trial_timestamp: new Date().toISOString()
      };
    }

    this.state.results.push(result);

    // Show feedback if configured
    if (this.config.feedback && this.config.feedback.show) {
      this.showFeedback(correct, () => {
        this.nextTrial();
      });
    } else {
      this.nextTrial();
    }
  },

  /**
   * Display accuracy feedback to participant.
   * Uses config text for correct/incorrect messages.
   * @param {boolean} correct - Whether response was correct
   * @param {Function} callback - Function to call after feedback duration
   */
  showFeedback: function(correct, callback) {
    // correct === null means the trial has no right answer (the Correct column
    // was left empty). Saying "Incorrect" to a participant who did nothing wrong
    // is worse than saying nothing, and it fired on EVERY trial of any design
    // built without correct answers - a rating task, or a free-choice task.
    // Wait out the feedback interval so trial pacing is unchanged, and show
    // nothing.
    if (correct === null) {
      if (this.elements.stimulusDisplay) this.elements.stimulusDisplay.textContent = '';
      setTimeout(function () { callback(); }, this.config.feedback.duration_ms || 500);
      return;
    }
    if (this.elements.stimulusDisplay) {
      // correct_text / incorrect_text arrive in the same ?config= link as the
      // stimuli, so they are attacker-controlled and were interpolated raw:
      // a link with feedback.show true and correct_text set to an <img onerror>
      // executed on the first correct trial. feedbackClass is built from fixed
      // literals here and needs no escaping.
      const feedbackText = correct ? (this.config.feedback.correct_text || 'Correct') : (this.config.feedback.incorrect_text || 'Incorrect');
      const feedbackClass = correct ? 'feedback correct' : 'feedback incorrect';
      this.elements.stimulusDisplay.innerHTML = `<span class="${feedbackClass}">${PTA.Engine._esc(feedbackText)}</span>`;
    }

    setTimeout(() => {
      callback();
    }, this.config.feedback.duration_ms || 500);
  },

  /**
   * Advance to next trial or end experiment.
   * Clears display during ITI, then triggers next trial.
   */
  nextTrial: function() {
    this.state.currentTrial++;

    if (this.state.currentTrial >= this.state.totalTrials) {
      this.endExperiment();
    } else {
      // Inter-trial interval
      const iti = this.config.presentation.ITI_ms || 500;
      if (this.elements.stimulusDisplay) {
        this.elements.stimulusDisplay.innerHTML = '';
      }
      setTimeout(() => {
        this.runTrial();
      }, iti);
    }
  },

  /**
   * Update progress bar and trial counter display.
   * Called at start of each trial.
   */
  updateProgress: function() {
    const progress = ((this.state.currentTrial) / this.state.totalTrials) * 100;

    if (this.elements.progressBar) {
      this.elements.progressBar.style.width = progress + '%';
    }
    if (this.elements.progressText) {
      this.elements.progressText.textContent = `Trial ${this.state.currentTrial + 1} of ${this.state.totalTrials}`;
    }
  },

  /* =====================================================
     Experiment End
     ===================================================== */

  /**
   * Finalize experiment and show results screen.
   * Calculates summary statistics, emits completion event.
   * Saves data to Supabase if configured.
   */
  endExperiment: function() {
    this.state.isRunning = false;

    console.log('PTA Engine: Experiment completed');
    // C in the DHSS proposal: participant completions across an experimenter's
    // published experiments. Derivable from experiment_results too, but an
    // explicit event also distinguishes a completed run from an abandoned one,
    // which the results table cannot.
    if (PTA.logEvent) {
      PTA.logEvent('participant_completed', {
        experimentType: this.config.experiment_type || this.config.type || 'generic',
        email: (this.config.experimenter && this.config.experimenter.email) || null,
        userExperimentId: (this.config.experimenter && this.config.experimenter.experiment_id) || null,
        trials: this.state.results.length
      });
    }
    console.log('Results:', this.state.results);

    // Hide trial screen, show results
    if (this.elements.trialScreen) {
      this.elements.trialScreen.classList.remove('active');
    }
    if (this.elements.resultsScreen) {
      this.elements.resultsScreen.classList.add('active');
    }

    // Calculate and display summary
    this.displayResults();

    // Save to Supabase if configured
    if (this.config.data && this.config.data.save_to_supabase) {
      this.saveResults();
    }
  },

  /**
   * Calculate summary statistics from results.
   * Computes mean RT, accuracy, error rate.
   * For Stroop: computes congruent/incongruent RT and Stroop effect.
   * Emits 'experimentComplete' event with results and stats.
   * @returns {Object} Summary statistics object
   */
  displayResults: function() {
    const results = this.state.results;
    let stats;

    if (this.config.type === 'stroop') {
      // Stroop-specific stats
      const correctResults = results.filter(r => r.correct === true);
      const congruentResults = correctResults.filter(r => r.congruent === true);
      const incongruentResults = correctResults.filter(r => r.congruent === false);

      // PTA.mean returns 0 for an empty array, and these two were unguarded.
      // A participant with no CORRECT congruent trials scored congruentRT = 0,
      // and the Stroop effect became incongruentRT - 0 - the entire reaction
      // time reported as the size of the interference effect. A real Stroop
      // effect is 50-100 ms; this produced 850.
      const congruentRT = PTA.meanOrNull(congruentResults.map(r => r.rt));
      const incongruentRT = PTA.meanOrNull(incongruentResults.map(r => r.rt));
      const stroopEffect = PTA.diffOrNull(incongruentRT, congruentRT);

      const correctTrials = results.filter(r => r.correct === true).length;
      const totalTrials = results.length;

      stats = {
        meanRT: PTA.meanOrNull(correctResults.map(r => r.rt)),
        congruentRT: congruentRT,
        incongruentRT: incongruentRT,
        stroopEffect: stroopEffect,
        // zero trials made these NaN, which prints as "NaN" on the screen
        accuracy: PTA.pctOrNull(correctTrials, totalTrials),
        errorRate: PTA.pctOrNull(totalTrials - correctTrials, totalTrials),
        totalTrials: totalTrials
      };
    } else {
      // Generic stats
      // r.response != null excludes the timeout rows. A trial the participant
      // never answered records rt = the full response window and correct = null
      // whenever the design has no right answer, so `correct !== false` let it
      // through and a non-response was averaged in as if it were a reaction.
      const rts = results.filter(r => r.rt && r.response != null && r.correct !== false).map(r => r.rt);
      const correctTrials = results.filter(r => r.correct === true).length;
      const totalTrials = results.length;

      // Per-condition means. Without these a design built on this platform can
      // only ever report one overall RT, and one number cannot show a priming
      // effect - the effect IS the difference between conditions. Every
      // generic result row already carries `condition`, so this is a summary
      // of data that was being collected and then thrown away.
      const byCondition = {};
      results.forEach(r => {
        const c = r.condition || 'default';
        if (!byCondition[c]) byCondition[c] = { condition: c, n: 0, correct: 0, rts: [] };
        const b = byCondition[c];
        b.n++;
        if (r.correct === true) b.correct++;
        if (r.rt && r.response != null && r.correct !== false) b.rts.push(r.rt);   // same exclusion as the overall mean
      });
      const conditions = Object.keys(byCondition).map(c => {
        const b = byCondition[c];
        return {
          condition: c,
          n: b.n,
          meanRT: b.rts.length ? PTA.mean(b.rts) : null,
          accuracy: b.n ? (b.correct / b.n) * 100 : null
        };
      });

      stats = {
        meanRT: PTA.meanOrNull(rts),
        medianRT: rts.length ? PTA.median(rts) : null,
        accuracy: PTA.pctOrNull(correctTrials, totalTrials),
        errorRate: PTA.pctOrNull(totalTrials - correctTrials, totalTrials),
        totalTrials: totalTrials,
        conditions: conditions
      };
    }

    // Emit results event for custom handling
    const event = new CustomEvent('experimentComplete', {
      detail: { results, stats }
    });
    document.dispatchEvent(event);

    return stats;
  },

  /**
   * Save all trial results to Supabase database.
   * Adds metadata: experiment ID, participant ID, experimenter info.
   * @async
   * @returns {Promise<void>}
   */
  saveResults: async function() {
    const tableName = this.config.data.table_name || 'experiment_results';

    // Prepare data with metadata
    const dataToSave = this.state.results.map(result => ({
      ...result,
      experiment_id: this.config.id,
      experiment_name: this.config.name,
      participant_id: this.state.participantId,
      external_id: this.state.externalId,
      experimenter_email: this.config.experimenter?.email,
      user_experiment_id: this.config.experimenter?.experiment_id
    }));

    // A console.error was the whole of the old failure path, so a run that could
    // not reach the database ended on a normal-looking results screen and was
    // lost without anyone being told. saveAllResults now runs the rescue itself
    // - local copy, visible warning, download button - and is told where this
    // engine's results screen is so the warning lands there rather than in a
    // floating overlay.
    const { error } = await PTA.saveAllResults(tableName, dataToSave, {
      experimentName: this.config.name,
      host: this.elements && this.elements.resultsScreen
    });

    if (error) {
      console.error('PTA Engine: Failed to save results', error);
    } else {
      console.log('PTA Engine: Results saved to Supabase');
    }
  },

  /**
   * Get all trial results for export or display.
   * @returns {Array} Array of trial result objects
   */
  getResults: function() {
    return this.state.results;
  },

  /**
   * Reset engine to initial state for new experiment.
   * Clears trials, results, removes event listeners.
   * @returns {Object} This engine instance (for chaining)
   */
  reset: function() {
    this.state = {
      isRunning: false,
      currentTrial: 0,
      totalTrials: 0,
      trials: [],
      results: [],
      participantId: PTA.generateParticipantId(),
      externalId: null,
      startTime: null
    };

    if (this.responseHandler) {
      document.removeEventListener('keydown', this.responseHandler);
      this.responseHandler = null;
    }

    // Invalidate any response window still pending, or a timeout left over
    // from the closed run would record a response into the next one.
    if (this.responseTimeoutId) {
      clearTimeout(this.responseTimeoutId);
      this.responseTimeoutId = null;
    }
    this.responseToken = (this.responseToken || 0) + 1;

    return this;
  }
};

// Export to PTA namespace
window.PTA = PTA;

console.log('PTA Engine loaded');
})();
