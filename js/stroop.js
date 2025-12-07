/**
 * Stroop Language Dominance Module
 * Based on V30 - Full bilingual Stroop experiment with language dominance analysis
 *
 * This module provides:
 * - 8 language support (EN, HE, ES, FR, DE, RU, AR, ZH)
 * - Bilingual testing (48 trials: 2 lang x 4 colors x 2 congruency x 3 reps)
 * - Language dominance analysis with detailed explanations
 * - Template Builder for experiment customization
 * - Supabase data collection
 * - Export to CSV/Excel
 */

// Stroop namespace
window.Stroop = {

  // =====================================================
  // DATA CONFIGURATION
  // =====================================================
  data: {
    colors: {
      red: { hex: '#ff4444', keys: ['r'] },
      green: { hex: '#44ff44', keys: ['g'] },
      blue: { hex: '#4444ff', keys: ['b'] },
      yellow: { hex: '#ffff44', keys: ['y'] }
    },
    words: {
      en: { red: 'RED', green: 'GREEN', blue: 'BLUE', yellow: 'YELLOW' },
      he: { red: 'אדום', green: 'ירוק', blue: 'כחול', yellow: 'צהוב' },
      es: { red: 'ROJO', green: 'VERDE', blue: 'AZUL', yellow: 'AMARILLO' },
      fr: { red: 'ROUGE', green: 'VERT', blue: 'BLEU', yellow: 'JAUNE' },
      de: { red: 'ROT', green: 'GRUN', blue: 'BLAU', yellow: 'GELB' },
      ru: { red: 'КРАСНЫЙ', green: 'ЗЕЛЁНЫЙ', blue: 'СИНИЙ', yellow: 'ЖЁЛТЫЙ' },
      ar: { red: 'أحمر', green: 'أخضر', blue: 'أزرق', yellow: 'أصفر' },
      zh: { red: '红色', green: '绿色', blue: '蓝色', yellow: '黄色' }
    },
    languageNames: {
      en: 'English',
      he: 'Hebrew',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ru: 'Russian',
      ar: 'Arabic',
      zh: 'Chinese'
    }
  },

  // =====================================================
  // STATE
  // =====================================================
  state: {
    lang1: 'en',
    lang2: 'he',
    trials: [],
    currentTrial: 0,
    results: [],
    stimulusOnset: 0,
    awaitingResponse: false,
    openedFromBuilder: false
  },

  // Template Builder stimuli
  builderStimuli: [
    { id: 'red', color: '#ff4444', wordLang1: 'RED', wordLang2: 'אדום', key: 'R' },
    { id: 'green', color: '#44ff44', wordLang1: 'GREEN', wordLang2: 'ירוק', key: 'G' },
    { id: 'blue', color: '#4444ff', wordLang1: 'BLUE', wordLang2: 'כחול', key: 'B' },
    { id: 'yellow', color: '#ffff44', wordLang1: 'YELLOW', wordLang2: 'צהוב', key: 'Y' }
  ],

  // Experimenter info
  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,

  // =====================================================
  // INITIALIZATION
  // =====================================================
  init: function() {
    // Set up keyboard listener
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    console.log('Stroop module initialized');
  },

  // =====================================================
  // OVERLAY CONTROL
  // =====================================================
  open: function() {
    document.getElementById('stroop-overlay').classList.add('active');
    document.getElementById('stroop-setup').style.display = 'block';
    document.getElementById('stroop-trial').classList.remove('active');
    document.getElementById('stroop-results').classList.remove('active');
    this.renderResponseKeys();
  },

  close: function() {
    document.getElementById('stroop-overlay').classList.remove('active');
    this.state.awaitingResponse = false;

    if (this.state.openedFromBuilder) {
      this.state.openedFromBuilder = false;
      this.openBuilder();
    } else if (this.isParticipantMode) {
      this.showThankYou();
    }
  },

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

  // =====================================================
  // RESPONSE KEYS
  // =====================================================
  renderResponseKeys: function() {
    const container = document.getElementById('stroop-keys-container');
    if (!container) return;

    container.innerHTML = '';
    const colors = Object.keys(this.data.colors);

    colors.forEach(colorId => {
      const colorData = this.data.colors[colorId];
      const key = colorData.keys[0].toUpperCase();
      const hex = colorData.hex;
      const label = colorId.toUpperCase();

      const keyHint = document.createElement('div');
      keyHint.className = 'key-hint';
      keyHint.style.cursor = 'pointer';
      keyHint.innerHTML = `
        <span class="key">${key}</span>
        <span class="label" style="color: ${hex};">${label}</span>
      `;

      keyHint.addEventListener('click', () => {
        if (document.getElementById('stroop-trial').classList.contains('active')) {
          this.handleResponse(key.toLowerCase());
        }
      });

      container.appendChild(keyHint);
    });
  },

  // =====================================================
  // TRIAL GENERATION
  // =====================================================
  generateTrials: function() {
    const trials = [];
    const colors = Object.keys(this.data.colors);
    const languages = [this.state.lang1, this.state.lang2];

    // Generate trials: 2 languages x 4 colors x 2 congruency x 3 repetitions = 48 trials
    languages.forEach(lang => {
      colors.forEach(inkColor => {
        // Congruent: word matches ink
        for (let i = 0; i < 3; i++) {
          trials.push({
            language: lang,
            inkColor: inkColor,
            wordMeaning: inkColor,
            congruent: true
          });
        }
        // Incongruent: word differs from ink
        const otherColors = colors.filter(c => c !== inkColor);
        for (let i = 0; i < 3; i++) {
          const wordMeaning = otherColors[i % otherColors.length];
          trials.push({
            language: lang,
            inkColor: inkColor,
            wordMeaning: wordMeaning,
            congruent: false
          });
        }
      });
    });

    // Shuffle
    for (let i = trials.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trials[i], trials[j]] = [trials[j], trials[i]];
    }

    return trials;
  },

  // =====================================================
  // EXPERIMENT FLOW
  // =====================================================
  start: function() {
    this.state.lang1 = document.getElementById('language1').value;
    this.state.lang2 = document.getElementById('language2').value;

    if (this.state.lang1 === this.state.lang2) {
      alert('Please select two different languages.');
      return;
    }

    this.state.trials = this.generateTrials();
    this.state.currentTrial = 0;
    this.state.results = [];

    document.getElementById('stroop-setup').style.display = 'none';
    document.getElementById('stroop-results').classList.remove('active');
    document.getElementById('stroop-trial').classList.add('active');
    document.getElementById('total-trials').textContent = this.state.trials.length;
    document.getElementById('stroop-overlay').focus();

    this.runTrial();
  },

  runTrial: function() {
    if (this.state.currentTrial >= this.state.trials.length) {
      this.showResults();
      return;
    }

    const trial = this.state.trials[this.state.currentTrial];
    const stimulus = document.getElementById('stroop-stimulus');

    document.getElementById('current-trial').textContent = this.state.currentTrial + 1;
    const progress = ((this.state.currentTrial) / this.state.trials.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;

    // Show fixation
    stimulus.innerHTML = '<span class="stroop-fixation">+</span>';
    this.state.awaitingResponse = false;

    // After fixation, show stimulus
    setTimeout(() => {
      const word = this.data.words[trial.language][trial.wordMeaning];
      const color = this.data.colors[trial.inkColor].hex;
      const dir = (trial.language === 'he' || trial.language === 'ar') ? 'rtl' : 'ltr';

      stimulus.innerHTML = `<span style="color: ${color}; direction: ${dir}">${word}</span>`;
      this.state.stimulusOnset = performance.now();
      this.state.awaitingResponse = true;
    }, 500);
  },

  handleResponse: function(key) {
    if (!this.state.awaitingResponse) return;

    const rt = performance.now() - this.state.stimulusOnset;
    const trial = this.state.trials[this.state.currentTrial];
    const correctKey = trial.inkColor[0];
    const correct = key.toLowerCase() === correctKey;

    this.state.results.push({
      ...trial,
      rt: rt,
      correct: correct,
      response: key
    });

    this.state.awaitingResponse = false;
    this.state.currentTrial++;

    // Brief feedback
    const stimulus = document.getElementById('stroop-stimulus');
    if (correct) {
      stimulus.innerHTML = '<span class="feedback-correct" style="font-size: 2rem;">Correct</span>';
    } else {
      stimulus.innerHTML = '<span class="feedback-incorrect" style="font-size: 2rem;">Incorrect</span>';
    }

    setTimeout(() => this.runTrial(), 300);
  },

  handleKeydown: function(e) {
    const overlay = document.getElementById('stroop-overlay');
    const trial = document.getElementById('stroop-trial');

    if (overlay && overlay.classList.contains('active') && trial && trial.classList.contains('active')) {
      const validKeys = ['r', 'g', 'b', 'y'];
      const key = e.key.toLowerCase();
      if (validKeys.includes(key)) {
        e.preventDefault();
        this.handleResponse(key);
      }
    }
  },

  // =====================================================
  // RESULTS
  // =====================================================
  showResults: function() {
    document.getElementById('stroop-trial').classList.remove('active');
    document.getElementById('stroop-results').classList.add('active');

    const correctResults = this.state.results.filter(r => r.correct);
    const lang1Results = correctResults.filter(r => r.language === this.state.lang1);
    const lang2Results = correctResults.filter(r => r.language === this.state.lang2);

    const lang1Congruent = lang1Results.filter(r => r.congruent);
    const lang1Incongruent = lang1Results.filter(r => !r.congruent);
    const lang2Congruent = lang2Results.filter(r => r.congruent);
    const lang2Incongruent = lang2Results.filter(r => !r.congruent);

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b.rt, 0) / arr.length) : 0;

    const lang1AvgRT = avg(lang1Results);
    const lang2AvgRT = avg(lang2Results);
    const stroop1 = avg(lang1Incongruent) - avg(lang1Congruent);
    const stroop2 = avg(lang2Incongruent) - avg(lang2Congruent);

    document.getElementById('lang1-name').textContent = this.data.languageNames[this.state.lang1];
    document.getElementById('lang2-name').textContent = this.data.languageNames[this.state.lang2];
    document.getElementById('lang1-rt').textContent = lang1AvgRT;
    document.getElementById('lang2-rt').textContent = lang2AvgRT;
    document.getElementById('stroop-effect1').textContent = stroop1;
    document.getElementById('stroop-effect2').textContent = stroop2;

    // Determine dominance
    const dominant = stroop1 > stroop2 ? this.state.lang1 : this.state.lang2;
    const dominantName = this.data.languageNames[dominant];
    document.getElementById('dominant-language').textContent = dominantName;

    // Generate explanation
    const explanation = this.generateExplanation(stroop1, stroop2);
    document.getElementById('dominance-explanation').textContent = explanation;

    // Save to Supabase
    this.saveResults();
  },

  generateExplanation: function(stroop1, stroop2) {
    const lang1Name = this.data.languageNames[this.state.lang1];
    const lang2Name = this.data.languageNames[this.state.lang2];
    const dominantName = stroop1 > stroop2 ? lang1Name : lang2Name;

    if (stroop1 > 0 && stroop2 < 0) {
      return `You showed a classic Stroop effect in ${lang1Name} (${stroop1}ms slower for incongruent trials), ` +
        `but a reversed pattern in ${lang2Name} (${Math.abs(stroop2)}ms faster for incongruent trials). ` +
        `The positive Stroop effect in ${lang1Name} indicates automatic word reading in that language, ` +
        `suggesting ${lang1Name} is your more dominant language for reading.`;
    } else if (stroop1 < 0 && stroop2 > 0) {
      return `You showed a reversed pattern in ${lang1Name} (${Math.abs(stroop1)}ms faster for incongruent trials), ` +
        `but a classic Stroop effect in ${lang2Name} (${stroop2}ms slower for incongruent trials). ` +
        `The positive Stroop effect in ${lang2Name} indicates automatic word reading in that language, ` +
        `suggesting ${lang2Name} is your more dominant language for reading.`;
    } else if (stroop1 > 0 && stroop2 > 0) {
      return `The Stroop effect was ${stroop1 > stroop2 ? 'larger' : 'smaller'} in ${lang1Name} (${stroop1}ms) ` +
        `compared to ${lang2Name} (${stroop2}ms). ` +
        `A larger Stroop effect indicates more automatic word reading, suggesting ${dominantName} is your more dominant language for reading.`;
    } else if (stroop1 < 0 && stroop2 < 0) {
      return `Interestingly, you showed reversed Stroop effects in both languages ` +
        `(${lang1Name}: ${stroop1}ms, ${lang2Name}: ${stroop2}ms). ` +
        `This unusual pattern may indicate strategic response adjustments. ` +
        `Based on the smaller reversed effect, ${dominantName} may be your more dominant language.`;
    } else {
      return `Stroop effects: ${lang1Name} (${stroop1}ms), ${lang2Name} (${stroop2}ms). ` +
        `Based on these results, ${dominantName} appears to be your more dominant language for reading.`;
    }
  },

  // =====================================================
  // DATA SAVING
  // =====================================================
  saveResults: function() {
    const experimentId = 'stroop_lang_' + this.state.lang1 + '_' + this.state.lang2;
    const participantId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

    this.state.results.forEach((r, i) => {
      const trialData = {
        experiment_id: experimentId,
        participant_id: participantId,
        trial_number: i + 1,
        language: r.language,
        ink_color: r.inkColor,
        word_meaning: r.wordMeaning,
        congruent: r.congruent,
        response: r.response,
        correct: r.correct,
        rt: Math.round(r.rt * 100) / 100,
        experimenter_email: this.experimenterEmail || null,
        user_experiment_id: this.userExperimentId || null
      };

      if (window.PTA && PTA.saveToSupabase) {
        PTA.saveToSupabase(trialData);
      }
    });
  },

  // =====================================================
  // EXPORT
  // =====================================================
  exportCSV: function() {
    if (!this.state.results.length) {
      alert('No results to export');
      return;
    }

    const headers = ['Trial', 'Language', 'Word', 'Ink Color', 'Congruent', 'Response', 'Correct', 'RT (ms)'];
    const rows = this.state.results.map((r, i) => [
      i + 1,
      this.data.languageNames[r.language],
      this.data.words[r.language][r.wordMeaning],
      r.inkColor,
      r.congruent ? 'Yes' : 'No',
      r.response,
      r.correct ? 'Yes' : 'No',
      Math.round(r.rt)
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stroop_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  },

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
      ['Trial', 'Language', 'Word', 'Ink Color', 'Congruent', 'Response', 'Correct', 'RT (ms)'],
      ...this.state.results.map((r, i) => [
        i + 1,
        this.data.languageNames[r.language],
        this.data.words[r.language][r.wordMeaning],
        r.inkColor,
        r.congruent ? 'Yes' : 'No',
        r.response,
        r.correct ? 'Yes' : 'No',
        Math.round(r.rt)
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `stroop_results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  // =====================================================
  // TEMPLATE BUILDER
  // =====================================================
  openBuilder: function() {
    document.getElementById('stroop-builder-overlay').classList.add('active');
  },

  closeBuilder: function() {
    document.getElementById('stroop-builder-overlay').classList.remove('active');
  },

  previewFromBuilder: function() {
    this.state.openedFromBuilder = true;
    this.closeBuilder();
    this.open();
  },

  generateLink: function() {
    const lang1 = document.getElementById('builder-lang1').value;
    const lang2 = document.getElementById('builder-lang2').value;
    // Support both ID formats for compatibility
    const emailEl = document.getElementById('stroopExperimenterEmail') || document.getElementById('experimenterEmail');
    const expIdEl = document.getElementById('stroopExperimentId') || document.getElementById('userExperimentId');
    const email = emailEl ? emailEl.value.trim() : '';
    const expId = expIdEl ? expIdEl.value.trim() : '';

    if (lang1 === lang2) {
      alert('Please select two different languages.');
      return;
    }

    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    if (!expId || expId.length < 3) {
      alert('Please enter an Experiment ID (at least 3 characters).');
      return;
    }

    const config = {
      template: 'stroop-language',
      lang1: lang1,
      lang2: lang2,
      experimenterEmail: email,
      userExperimentId: expId,
      stimuli: this.builderStimuli
    };

    try {
      // Use encodeURIComponent to handle UTF-8 characters properly
      const configStr = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
      const link = window.location.href.split('?')[0] + '?exp=' + configStr;

      // Show modal with link
      const modal = document.createElement('div');
      modal.id = 'stroop-link-modal';
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

      console.log('Stroop link generated:', link);
    } catch (error) {
      console.error('Error generating link:', error);
      alert('Error generating link. Please try again.');
    }
  },

  // =====================================================
  // URL PARAMETER HANDLING
  // =====================================================
  checkUrlConfig: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const expConfig = urlParams.get('exp');

    if (expConfig) {
      try {
        // Decode UTF-8 properly
        const config = JSON.parse(decodeURIComponent(escape(atob(expConfig))));
        if (config.template === 'stroop-language') {
          this.isParticipantMode = true;
          this.experimenterEmail = config.experimenterEmail || '';
          this.userExperimentId = config.userExperimentId || '';

          // Apply custom stimuli
          if (config.stimuli && config.stimuli.length > 0) {
            this.data.colors = {};
            this.data.words[config.lang1] = {};
            this.data.words[config.lang2] = {};

            config.stimuli.forEach(stim => {
              this.data.colors[stim.id] = {
                hex: stim.color,
                keys: [stim.key.toLowerCase()]
              };
              this.data.words[config.lang1][stim.id] = stim.wordLang1;
              this.data.words[config.lang2][stim.id] = stim.wordLang2;
            });
          }

          this.state.lang1 = config.lang1 || 'en';
          this.state.lang2 = config.lang2 || 'he';

          document.getElementById('language1').value = this.state.lang1;
          document.getElementById('language2').value = this.state.lang2;

          // Hide main layout for participants
          document.querySelector('.layout').style.display = 'none';

          // Open Stroop directly
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
  Stroop.init();
});

console.log('Stroop module loaded');
