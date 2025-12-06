/* =====================================================
   PrimingToolbox - Stroop Language Dominance Module
   Version: 1.0 (from V30)

   Full bilingual Stroop experiment with:
   - 8 languages (English, Hebrew, Spanish, French, German, Russian, Arabic, Chinese)
   - Language dominance analysis
   - Detailed results breakdown
   ===================================================== */

// STROOP EXPERIMENT DATA
let STROOP_DATA = {
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
    de: { red: 'ROT', green: 'GRÜN', blue: 'BLAU', yellow: 'GELB' },
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
};

// Stroop experiment state
let stroopState = {
  lang1: 'en',
  lang2: 'he',
  trials: [],
  currentTrial: 0,
  results: [],
  stimulusOnset: 0,
  awaitingResponse: false,
  openedFromBuilder: false
};

// =====================================================
// STROOP EXPERIMENT FUNCTIONS
// =====================================================

// Render response key hints based on current STROOP_DATA
function renderResponseKeys() {
  const container = document.getElementById('stroop-keys-container');
  if (!container) return;

  container.innerHTML = '';
  const colors = Object.keys(STROOP_DATA.colors);

  colors.forEach(colorId => {
    const colorData = STROOP_DATA.colors[colorId];
    const key = colorData.keys[0].toUpperCase();
    const hex = colorData.hex;
    const label = colorId.toUpperCase();

    const keyHint = document.createElement('div');
    keyHint.className = 'key-hint';
    keyHint.innerHTML = `
      <span class="key">${key}</span>
      <span class="label" style="color: ${hex};">${label}</span>
    `;
    container.appendChild(keyHint);
  });
}

function openStroop() {
  document.getElementById('stroop-overlay').classList.add('active');
  document.getElementById('stroop-setup').style.display = 'block';
  document.getElementById('stroop-trial').classList.remove('active');
  document.getElementById('stroop-results').classList.remove('active');

  // Render response keys based on current stimuli
  renderResponseKeys();
}

function closeStroop() {
  document.getElementById('stroop-overlay').classList.remove('active');
  stroopState.awaitingResponse = false;

  // If opened from builder preview, return to builder
  if (stroopState.openedFromBuilder) {
    stroopState.openedFromBuilder = false;
    if (typeof openStroopBuilder === 'function') {
      openStroopBuilder();
    }
  } else if (typeof isParticipantMode !== 'undefined' && isParticipantMode) {
    // Participant finished - show thank you message
    window.history.replaceState({}, document.title, window.location.pathname);
    isParticipantMode = false;

    const thankYouModal = document.createElement('div');
    thankYouModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      z-index: 2000;
      display: flex;
      justify-content: center;
      align-items: center;
    `;
    thankYouModal.innerHTML = `
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
    document.body.appendChild(thankYouModal);
  }
}

function generateStroopTrials() {
  const trials = [];
  const colors = Object.keys(STROOP_DATA.colors);
  const languages = [stroopState.lang1, stroopState.lang2];

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

  // Shuffle trials
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trials[i], trials[j]] = [trials[j], trials[i]];
  }

  return trials;
}

function startStroop() {
  stroopState.lang1 = document.getElementById('language1').value;
  stroopState.lang2 = document.getElementById('language2').value;

  if (stroopState.lang1 === stroopState.lang2) {
    alert('Please select two different languages.');
    return;
  }

  stroopState.trials = generateStroopTrials();
  stroopState.currentTrial = 0;
  stroopState.results = [];

  document.getElementById('stroop-setup').style.display = 'none';
  document.getElementById('stroop-results').classList.remove('active');
  document.getElementById('stroop-trial').classList.add('active');

  document.getElementById('total-trials').textContent = stroopState.trials.length;

  // Focus the overlay to capture keyboard events
  document.getElementById('stroop-overlay').focus();

  runStroopTrial();
}

function runStroopTrial() {
  if (stroopState.currentTrial >= stroopState.trials.length) {
    showStroopResults();
    return;
  }

  const trial = stroopState.trials[stroopState.currentTrial];
  const stimulus = document.getElementById('stroop-stimulus');

  // Update progress
  document.getElementById('current-trial').textContent = stroopState.currentTrial + 1;
  const progress = ((stroopState.currentTrial) / stroopState.trials.length) * 100;
  document.getElementById('progress-fill').style.width = `${progress}%`;

  // Show fixation
  stimulus.innerHTML = '<span class="stroop-fixation">+</span>';
  stroopState.awaitingResponse = false;

  // After fixation, show stimulus
  setTimeout(() => {
    const word = STROOP_DATA.words[trial.language][trial.wordMeaning];
    const color = STROOP_DATA.colors[trial.inkColor].hex;

    stimulus.innerHTML = `<span style="color: ${color}; direction: ${trial.language === 'he' || trial.language === 'ar' ? 'rtl' : 'ltr'}">${word}</span>`;
    stroopState.stimulusOnset = performance.now();
    stroopState.awaitingResponse = true;
  }, 500);
}

function handleStroopResponse(key) {
  if (!stroopState.awaitingResponse) return;

  const rt = performance.now() - stroopState.stimulusOnset;
  const trial = stroopState.trials[stroopState.currentTrial];

  // Check if correct
  const correctKey = trial.inkColor[0]; // first letter of color
  const correct = key.toLowerCase() === correctKey;

  // Store word for export
  const word = STROOP_DATA.words[trial.language][trial.wordMeaning];

  stroopState.results.push({
    ...trial,
    word: word,
    color: trial.inkColor,
    rt: rt,
    correct: correct,
    response: key
  });

  stroopState.awaitingResponse = false;
  stroopState.currentTrial++;

  // Brief feedback then next trial
  const stimulus = document.getElementById('stroop-stimulus');
  if (correct) {
    stimulus.innerHTML = '<span style="color: #169999; font-size: 2rem;">Correct!</span>';
  } else {
    stimulus.innerHTML = '<span style="color: #990f23; font-size: 2rem;">Incorrect</span>';
  }

  setTimeout(runStroopTrial, 300);
}

function showStroopResults() {
  document.getElementById('stroop-trial').classList.remove('active');
  document.getElementById('stroop-results').classList.add('active');

  // Filter correct responses only
  const correctResults = stroopState.results.filter(r => r.correct);

  // Calculate stats per language
  const lang1Results = correctResults.filter(r => r.language === stroopState.lang1);
  const lang2Results = correctResults.filter(r => r.language === stroopState.lang2);

  const lang1Congruent = lang1Results.filter(r => r.congruent);
  const lang1Incongruent = lang1Results.filter(r => !r.congruent);
  const lang2Congruent = lang2Results.filter(r => r.congruent);
  const lang2Incongruent = lang2Results.filter(r => !r.congruent);

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b.rt, 0) / arr.length) : 0;

  const lang1AvgRT = avg(lang1Results);
  const lang2AvgRT = avg(lang2Results);
  const stroop1 = avg(lang1Incongruent) - avg(lang1Congruent);
  const stroop2 = avg(lang2Incongruent) - avg(lang2Congruent);

  // Calculate error rates
  const totalTrials = stroopState.results.length;
  const totalErrors = stroopState.results.filter(r => !r.correct).length;
  const errorRate = ((totalErrors / totalTrials) * 100).toFixed(1);

  // Update display
  document.getElementById('lang1-name').textContent = STROOP_DATA.languageNames[stroopState.lang1];
  document.getElementById('lang2-name').textContent = STROOP_DATA.languageNames[stroopState.lang2];
  document.getElementById('lang1-rt').textContent = lang1AvgRT;
  document.getElementById('lang2-rt').textContent = lang2AvgRT;
  document.getElementById('stroop-effect1').textContent = stroop1;
  document.getElementById('stroop-effect2').textContent = stroop2;

  // Update error rate display if element exists
  const errorRateEl = document.getElementById('stroop-error-rate');
  if (errorRateEl) {
    errorRateEl.textContent = errorRate + '%';
  }

  // Determine dominance
  const dominant = stroop1 > stroop2 ? stroopState.lang1 : stroopState.lang2;
  const dominantName = STROOP_DATA.languageNames[dominant];

  document.getElementById('dominant-language').textContent = dominantName;

  // Build explanation
  const lang1Name = STROOP_DATA.languageNames[stroopState.lang1];
  const lang2Name = STROOP_DATA.languageNames[stroopState.lang2];
  let explanation = '';

  if (stroop1 > 0 && stroop2 < 0) {
    explanation = `You showed a classic Stroop effect in ${lang1Name} (${stroop1}ms slower for incongruent trials), ` +
      `but a reversed pattern in ${lang2Name} (${Math.abs(stroop2)}ms faster for incongruent trials). ` +
      `The positive Stroop effect in ${lang1Name} indicates automatic word reading in that language, ` +
      `suggesting ${lang1Name} is your more dominant language for reading.`;
  } else if (stroop1 < 0 && stroop2 > 0) {
    explanation = `You showed a reversed pattern in ${lang1Name} (${Math.abs(stroop1)}ms faster for incongruent trials), ` +
      `but a classic Stroop effect in ${lang2Name} (${stroop2}ms slower for incongruent trials). ` +
      `The positive Stroop effect in ${lang2Name} indicates automatic word reading in that language, ` +
      `suggesting ${lang2Name} is your more dominant language for reading.`;
  } else if (stroop1 > 0 && stroop2 > 0) {
    explanation = `The Stroop effect was ${stroop1 > stroop2 ? 'larger' : 'smaller'} in ${lang1Name} (${stroop1}ms) ` +
      `compared to ${lang2Name} (${stroop2}ms). ` +
      `A larger Stroop effect indicates more automatic word reading, suggesting ${dominantName} is your more dominant language for reading.`;
  } else if (stroop1 < 0 && stroop2 < 0) {
    explanation = `Interestingly, you showed reversed Stroop effects in both languages ` +
      `(${lang1Name}: ${stroop1}ms, ${lang2Name}: ${stroop2}ms). ` +
      `This unusual pattern may indicate strategic response adjustments. ` +
      `Based on the smaller reversed effect, ${dominantName} may be your more dominant language.`;
  } else {
    explanation = `Stroop effects: ${lang1Name} (${stroop1}ms), ${lang2Name} (${stroop2}ms). ` +
      `Based on these results, ${dominantName} appears to be your more dominant language for reading.`;
  }

  document.getElementById('dominance-explanation').textContent = explanation;

  // Save results to Supabase if available
  if (typeof PTA !== 'undefined' && PTA.saveAllResults) {
    const experimentId = 'stroop_lang_' + stroopState.lang1 + '_' + stroopState.lang2;
    PTA.saveAllResults('experiment_results', stroopState.results.map(r => ({
      ...r,
      experiment_id: experimentId,
      experiment_name: 'Stroop Language Dominance'
    })));
  }
}

// =====================================================
// EXPORT FUNCTIONS
// =====================================================

function getStroopExportData() {
  const correctResults = stroopState.results.filter(r => r.correct);
  const lang1Results = correctResults.filter(r => r.language === stroopState.lang1);
  const lang2Results = correctResults.filter(r => r.language === stroopState.lang2);
  const lang1Congruent = lang1Results.filter(r => r.congruent);
  const lang1Incongruent = lang1Results.filter(r => !r.congruent);
  const lang2Congruent = lang2Results.filter(r => r.congruent);
  const lang2Incongruent = lang2Results.filter(r => !r.congruent);

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b.rt, 0) / arr.length) : 0;

  return {
    stroop1: avg(lang1Incongruent) - avg(lang1Congruent),
    stroop2: avg(lang2Incongruent) - avg(lang2Congruent),
    lang1Results, lang2Results,
    lang1Congruent, lang1Incongruent,
    lang2Congruent, lang2Incongruent,
    avg
  };
}

function exportStroopCSV() {
  if (!stroopState.results || stroopState.results.length === 0) {
    alert('No results to export');
    return;
  }

  const data = getStroopExportData();

  const headers = ['Trial', 'Language', 'Word', 'Ink Color', 'Congruent', 'Response', 'Correct', 'RT (ms)'];

  const rows = stroopState.results.map((r, i) => [
    i + 1,
    STROOP_DATA.languageNames[r.language],
    r.word,
    r.color,
    r.congruent ? 'Yes' : 'No',
    r.response,
    r.correct ? 'Yes' : 'No',
    Math.round(r.rt)
  ]);

  // Add summary
  rows.push([]);
  rows.push(['--- SUMMARY ---']);
  rows.push([]);
  rows.push(['Language', 'Avg RT (ms)', 'Congruent RT', 'Incongruent RT', 'Stroop Effect']);
  rows.push([
    STROOP_DATA.languageNames[stroopState.lang1],
    data.avg(data.lang1Results),
    data.avg(data.lang1Congruent),
    data.avg(data.lang1Incongruent),
    data.stroop1
  ]);
  rows.push([
    STROOP_DATA.languageNames[stroopState.lang2],
    data.avg(data.lang2Results),
    data.avg(data.lang2Congruent),
    data.avg(data.lang2Incongruent),
    data.stroop2
  ]);
  rows.push([]);
  rows.push(['Dominant Language:', data.stroop1 > data.stroop2 ? STROOP_DATA.languageNames[stroopState.lang1] : STROOP_DATA.languageNames[stroopState.lang2]]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `stroop_results_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}

function exportStroopXLSX() {
  if (!stroopState.results || stroopState.results.length === 0) {
    alert('No results to export');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('Excel export not available. Please use CSV export.');
    return;
  }

  const data = getStroopExportData();
  const dominantLang = data.stroop1 > data.stroop2 ? STROOP_DATA.languageNames[stroopState.lang1] : STROOP_DATA.languageNames[stroopState.lang2];

  const wb = XLSX.utils.book_new();

  // Sheet 1: Raw Data
  const rawData = [
    ['Trial', 'Language', 'Word', 'Ink Color', 'Congruent', 'Response', 'Correct', 'RT (ms)'],
    ...stroopState.results.map((r, i) => [
      i + 1,
      STROOP_DATA.languageNames[r.language],
      r.word,
      r.color,
      r.congruent ? 'Yes' : 'No',
      r.response,
      r.correct ? 'Yes' : 'No',
      Math.round(r.rt)
    ])
  ];
  const wsRaw = XLSX.utils.aoa_to_sheet(rawData);
  wsRaw['!cols'] = [{wch: 6}, {wch: 10}, {wch: 12}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 8}, {wch: 10}];
  XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw Data');

  // Sheet 2: Summary
  const summaryData = [
    ['Stroop Language Dominance Test - Results'],
    ['Date:', new Date().toLocaleDateString()],
    [],
    ['SUMMARY'],
    [],
    ['Language', 'Avg RT (ms)', 'Congruent RT', 'Incongruent RT', 'Stroop Effect'],
    [STROOP_DATA.languageNames[stroopState.lang1], data.avg(data.lang1Results), data.avg(data.lang1Congruent), data.avg(data.lang1Incongruent), data.stroop1],
    [STROOP_DATA.languageNames[stroopState.lang2], data.avg(data.lang2Results), data.avg(data.lang2Congruent), data.avg(data.lang2Incongruent), data.stroop2],
    [],
    ['Dominant Language:', dominantLang],
    [],
    ['INTERPRETATION'],
    ['A positive Stroop effect indicates automatic word reading (classic interference).'],
    ['A larger Stroop effect suggests stronger language dominance.'],
    ['A negative effect indicates a reversed/unusual pattern.']
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{wch: 20}, {wch: 12}, {wch: 14}, {wch: 14}, {wch: 12}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  XLSX.writeFile(wb, `stroop_results_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// =====================================================
// KEYBOARD LISTENER
// =====================================================

document.addEventListener('keydown', (e) => {
  const stroopOverlay = document.getElementById('stroop-overlay');
  const stroopTrial = document.getElementById('stroop-trial');

  if (stroopOverlay && stroopOverlay.classList.contains('active') &&
      stroopTrial && stroopTrial.classList.contains('active')) {
    const validKeys = ['r', 'g', 'b', 'y'];
    const key = e.key.toLowerCase();
    if (validKeys.includes(key)) {
      e.preventDefault();
      handleStroopResponse(key);
    }
  }
});

console.log('PTA Stroop Module loaded');
