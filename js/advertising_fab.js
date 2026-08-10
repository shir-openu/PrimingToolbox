/**
 * =====================================================
 * PrimingToolbox - Advertising (Brand) Priming (V2 _fab)
 * =====================================================
 *
 * Section 5.7 of the framework. Ferraro, Bettman & Chartrand (2009);
 * Lee & Labroo (2004).
 *
 * Participants viewed 20 photographs of people in everyday situations, with a
 * bottled-water brand incidentally visible in zero, four or twelve of them, and
 * were told to attend to facial expressions. Afterwards they chose a bottled
 * water from four brands. Among participants unaware of the exposure, choice of
 * the exposed brand rose from 17% (zero exposures) to 22% (four) to 40% (twelve).
 * The authors attributed this to perceptual fluency.
 *
 * ABCD: A = incidental brand exposure inside the photographs,
 *       B = choosing one brand from four,
 *       C = baseline choice rate, which is 1 in 4 by construction,
 *       D = choice rate after incidental exposure.
 *
 * ---------------------------------------------------------------------------
 * TWO SUBSTITUTIONS, BOTH STATED ON SCREEN
 * ---------------------------------------------------------------------------
 * 1. STIMULI. We hold no licence for photographs of people, so each "photo" is
 *    a schematic scene drawn in SVG: a figure, a setting, and sometimes a
 *    labelled bottle placed off to one side. The manipulation the study relies
 *    on - incidental, non-focal brand exposure during an unrelated judgement -
 *    is preserved. The naturalism is not. An experimenter running this for real
 *    should replace the scenes with photographs through the builder.
 *
 * 2. DESIGN. Ferraro et al. varied exposure BETWEEN participants. A single
 *    visitor would then make one choice, which carries almost no information.
 *    This version runs several rounds, each with a fresh set of four brands and
 *    one brand exposed, so a per-participant rate can be compared against the
 *    1-in-4 baseline. That baseline is exact rather than estimated, which is
 *    what makes the within-participant version defensible here.
 *
 * The cover task is kept: judge the figure's expression. Brand choice is only
 * asked afterwards, and awareness is probed at the end, as in the original -
 * the effect there held only for participants who had not noticed the brand.
 *
 * @module AdvertisingPriming
 * @version 1.0
 * @requires PTA (js/core_fab.js), PTK (js/paradigm_kit_fab.js)
 */
window.AdvertisingPriming = {

  data: {
    // Invented names, so no real brand is advantaged or disparaged by this demo.
    brands: ['AQUELLA', 'NIVARA', 'PURESTA', 'VOLTIRA', 'CASCARA', 'LUMEA', 'SERRANA', 'ONDIVA'],
    scenes: ['on a bench', 'having lunch', 'waiting for a bus', 'reading outside',
             'in a park', 'at a desk', 'on a train', 'in a cafe']
  },

  timing: {
    photo_ms: 1200,
    iti_ms: 200
  },

  rounds: 3,
  photosPerRound: 8,
  exposuresPerRound: 6,   // how many of the photos show the exposed brand

  state: {
    phase: 'setup', roundIndex: 0, photoIndex: 0,
    roundPlan: [], results: [], expressionResults: [],
    awareness: null, openedFromBuilder: false
  },

  experimenterEmail: '',
  userExperimentId: '',
  isParticipantMode: false,
  _initDone: false,
  _participantId: '',

  spec: function () {
    return {
      key: 'advertising',
      name: 'Advertising Priming',
      source: 'Ferraro, Bettman & Chartrand (2009); Lee & Labroo (2004)',
      urlParam: 'advertising',
      template: 'advertising-priming',
      accent: '#61a3ed',
      defaultExperimentId: 'advertising_priming',
      startFn: 'AdvertisingPriming.start()',
      closeFn: 'AdvertisingPriming.close()',
      howToPlay: [
        'You will see a series of short <b>scenes</b>, one at a time. Each shows a person somewhere ordinary.',
        'For each scene, decide whether the person looks <b>Happy</b> or <b>Not happy</b>, and click that button. Go with your first impression &ndash; each scene moves on by itself after about a second.',
        'After the scenes you will be asked to <b>pick a bottled water</b> from four brands. Choose whichever you would actually pick.',
        'That repeats for a few rounds, and at the end you get one question about what you noticed.'
      ],
      keyLegend: 'The scenes are simple drawings, not photographs, and every brand name is invented.',
      example: '<div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;align-items:center;">' +
        '<div style="width:220px;">' +
          '<svg viewBox="0 0 320 180" width="100%" role="img" aria-label="Example scene">' +
            '<rect width="320" height="180" rx="14" fill="#1e293b"/>' +
            '<rect x="0" y="140" width="320" height="40" fill="#0f172a" opacity=".6"/>' +
            '<circle cx="100" cy="66" r="34" fill="#f1d3b8"/>' +
            '<circle cx="88" cy="58" r="4" fill="#0f172a"/><circle cx="112" cy="58" r="4" fill="#0f172a"/>' +
            '<path d="M84 74 Q100 88 116 74" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
            '<rect x="72" y="102" width="56" height="46" rx="12" fill="#334155"/>' +
            '<g transform="translate(250,96)">' +
              '<rect x="0" y="14" width="26" height="54" rx="6" fill="#61a3ed" opacity=".85"/>' +
              '<rect x="9" y="2" width="8" height="14" fill="#61a3ed" opacity=".85"/>' +
              '<rect x="0" y="32" width="26" height="16" fill="#0b1220" opacity=".75"/>' +
            '</g>' +
            '<text x="160" y="170" font-size="11" text-anchor="middle" fill="#64748b" ' +
                  'font-family="Segoe UI, Arial, sans-serif">on a bench</text>' +
          '</svg>' +
        '</div>' +
        '<div style="text-align:left;max-width:230px;">' +
          '<div style="color:#4ade80;font-size:.95rem;margin-bottom:8px;">&rarr; you would click <b>Happy</b></div>' +
          '<div style="color:#9aa6b2;font-size:.86rem;line-height:1.6;">That is the whole task. Judge the face, ' +
            'nothing else. Anything else in the picture is just scenery.</div>' +
        '</div>' +
      '</div>',
      abcd: {
        A: 'A brand shown incidentally, off to one side, while you judge an expression.',
        B: 'Choosing one brand from four.',
        C: 'Baseline choice rate with no exposure, which is 1 in 4 by construction.',
        D: 'Choice rate for the brand that was incidentally present.'
      },
      characteristics: {
        association: 'Repeated incidental exposure builds a brand representation through perceptual fluency.',
        secondariness: 'The brand is irrelevant to the expression judgement you were asked to make.',
        modulation: 'Exposure frequency shifts later brand choice, typically without awareness.'
      },
      instructions: 'Judge each person\'s expression. Afterwards you will pick a bottled water.',
      stimulusGroups: [
        { key: 'brands', label: 'Brand names', type: 'words', min: 4,
          help: 'At least four, since each round offers a choice of four. Invented names avoid advantaging a real brand.' },
        { key: 'scenes', label: 'Scene descriptions', type: 'words', min: 3,
          help: 'Short phrases, e.g. "on a bench". Drawn schematically - replace with photographs for real data collection.' }
      ],
      timingFields: [
        { key: 'photo_ms', label: 'Each scene shown for', min: 300, max: 5000, step: 100,
          help: 'Ferraro et al. used 2000 ms per photograph.' },
        { key: 'iti_ms', label: 'Gap between scenes', min: 0, max: 2000, step: 50 }
      ],
      repetitions: { prop: 'rounds', def: 3, min: 1, max: 8,
                     label: 'Choice rounds',
                     help: 'Each round is a fresh set of four brands, one of them exposed, followed by one choice. More rounds give a steadier rate.' },
      toConfig: function (mod) { return mod.toConfig(); },
      applyConfig: function (mod, config) {
        if (typeof config.photosPerRound === 'number') mod.photosPerRound = config.photosPerRound;
        if (typeof config.exposuresPerRound === 'number') mod.exposuresPerRound = config.exposuresPerRound;
      },
      asm: function (mod) {
        return {
          instructions: 'Judge the expression in each scene. Then choose a bottled water.',
          primes: mod.data.brands.slice(),
          targets: mod.data.brands.slice(),
          conditions: ['exposed', 'not-exposed'],
          baseline: 'not-exposed',
          response: { 'choose a brand': 'click', 'judge the expression': 'click' }
        };
      }
    };
  },

  init: function () {
    if (this._initDone) return;
    this._initDone = true;
    PTK.timers(this);
    console.log('Advertising Priming module initialized');
  },

  /** A schematic scene. Deliberately crude - see the header. */
  sceneSVG: function (scene, brand, happy) {
    var mouth = happy
      ? '<path d="M84 74 Q100 88 116 74" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : '<line x1="86" y1="80" x2="114" y2="80" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>';
    var bottle = brand
      ? '<g transform="translate(250,96)">' +
          '<rect x="0" y="14" width="26" height="54" rx="6" fill="#61a3ed" opacity=".85"/>' +
          '<rect x="9" y="2" width="8" height="14" fill="#61a3ed" opacity=".85"/>' +
          '<rect x="0" y="32" width="26" height="16" fill="#0b1220" opacity=".75"/>' +
          '<text x="13" y="44" font-size="7" text-anchor="middle" fill="#e5e7eb" ' +
                'font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.5">' + PTK.esc(brand) + '</text>' +
        '</g>'
      : '';
    return '' +
      '<svg viewBox="0 0 320 180" width="100%" height="230" role="img">' +
        '<rect width="320" height="180" rx="14" fill="#1e293b"/>' +
        '<rect x="0" y="140" width="320" height="40" fill="#0f172a" opacity=".6"/>' +
        '<circle cx="100" cy="66" r="34" fill="#f1d3b8"/>' +
        '<circle cx="88" cy="58" r="4" fill="#0f172a"/>' +
        '<circle cx="112" cy="58" r="4" fill="#0f172a"/>' +
        mouth +
        '<rect x="72" y="102" width="56" height="46" rx="12" fill="#334155"/>' +
        bottle +
        '<text x="160" y="170" font-size="11" text-anchor="middle" fill="#64748b" ' +
              'font-family="Segoe UI, Arial, sans-serif">' + PTK.esc(scene) + '</text>' +
      '</svg>';
  },

  ensureOverlay: function () {
    if (document.getElementById('advertising-overlay')) return;
    var el = document.createElement('div');
    el.id = 'advertising-overlay';
    el.className = 'experiment-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2000;overflow:auto;';
    el.innerHTML =
      '<div style="max-width:700px;margin:0 auto;padding:44px 24px;color:#e5e7eb;text-align:center;font-family:inherit;">' +
        // Filled by PTK.paintSetup on open() - see js/paradigm_kit_fab.js
        '<div id="advertising-setup"></div>' +
        '<div id="advertising-photo" style="display:none;">' +
          '<div style="color:#9aa6b2;font-size:.85rem;" id="advertising-progress"></div>' +
          PTK.progressHtml('advertising-progress-fill') +
          '<div id="advertising-scene" style="margin:20px auto;max-width:420px;"></div>' +
          '<div id="advertising-expression" style="display:flex;gap:14px;justify-content:center;"></div>' +
        '</div>' +
        '<div id="advertising-choice" style="display:none;">' +
          '<h3 style="color:#61a3ed;">Pick a bottled water</h3>' +
          '<p style="color:#9aa6b2;line-height:1.7;max-width:480px;margin:14px auto;">' +
            'Whichever you would actually choose. There is no right answer.</p>' +
          '<div id="advertising-brands" style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;max-width:440px;margin:0 auto;"></div>' +
        '</div>' +
        '<div id="advertising-awareness" style="display:none;">' +
          '<h3 style="color:#61a3ed;">One last question</h3>' +
          '<p style="color:#9aa6b2;line-height:1.7;max-width:520px;margin:16px auto;">' +
            'Did you notice any brand or product in the scenes you just judged?</p>' +
          '<div id="advertising-awareness-options" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;"></div>' +
        '</div>' +
        '<div id="advertising-results" style="display:none;">' +
          '<h2 style="color:#61a3ed;">Complete</h2>' +
          '<div id="advertising-results-body" style="color:#cbd5e1;line-height:1.9;"></div>' +
          '<div id="advertising-interpretation"></div>' +
          '<div style="margin-top:20px;">' +
            '<button class="btn" onclick="AdvertisingPriming.exportCSV()">Download CSV</button> ' +
            '<button class="btn" onclick="AdvertisingPriming.exportXLSX()">Download Excel</button> ' +
            '<button class="btn" onclick="AdvertisingPriming.restart()">Try Again</button> ' +
            '<button class="btn btn-secondary" onclick="AdvertisingPriming.close()">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  show: function (which) {
    ['setup', 'photo', 'choice', 'awareness', 'results'].forEach(function (s) {
      var n = document.getElementById('advertising-' + s);
      if (n) n.style.display = (s === which) ? 'block' : 'none';
    });
  },

  open: function () {
    this.ensureOverlay();
    this.init();
    document.getElementById('advertising-overlay').style.display = 'block';
    PTK.paintSetup('advertising-setup', this, this.spec());
    this.show('setup');
    var p = document.getElementById('advertising-params');
    if (p) {
      p.textContent = this.rounds + ' rounds of ' + this.photosPerRound + ' scenes (' +
        this.exposuresPerRound + ' showing the exposed brand), each followed by one choice from four brands. ' +
        'Baseline is 1 in 4 = 25%.';
    }
    this.state.phase = 'setup';
  },

  close: function () {
    this._clearTimers();
    var ov = document.getElementById('advertising-overlay');
    if (ov) ov.style.display = 'none';
    this.state.phase = 'setup';
    if (this.state.openedFromBuilder) { this.state.openedFromBuilder = false; this.openBuilder(); }
    else if (this.isParticipantMode) { this.showThankYou(); }
  },

  /** Each round: pick 4 brands, expose one of them in some of the photos. */
  buildRounds: function () {
    var self = this;
    var plan = [];
    for (var r = 0; r < this.rounds; r++) {
      var pool = PTA.shuffleArray(this.data.brands.slice());
      var options = pool.slice(0, 4);
      var exposed = options[Math.floor(Math.random() * options.length)];
      var slots = [];
      for (var p = 0; p < this.photosPerRound; p++) {
        slots.push(p < Math.min(this.exposuresPerRound, this.photosPerRound) ? exposed : null);
      }
      plan.push({
        options: PTA.shuffleArray(options),
        exposed: exposed,
        photos: PTA.shuffleArray(slots).map(function (b) {
          return {
            brand: b,
            scene: self.data.scenes[Math.floor(Math.random() * self.data.scenes.length)],
            happy: Math.random() < 0.5
          };
        })
      });
    }
    return plan;
  },

  start: function () {
    this.state.results = [];
    this.state.expressionResults = [];
    this.state.awareness = null;
    this.state.roundPlan = this.buildRounds();
    this.state.roundIndex = 0;
    this.runRound();
  },

  runRound: function () {
    var round = this.state.roundPlan[this.state.roundIndex];
    if (!round) { this.askAwareness(); return; }
    this.state.photoIndex = 0;
    this.state.phase = 'photo';
    this.show('photo');
    this.renderPhoto();
  },

  renderPhoto: function () {
    var self = this;
    var round = this.state.roundPlan[this.state.roundIndex];
    var photo = round.photos[this.state.photoIndex];
    if (!photo) { this.runChoice(); return; }

    document.getElementById('advertising-progress').textContent =
      'Round ' + (this.state.roundIndex + 1) + ' of ' + this.state.roundPlan.length +
      ' - scene ' + (this.state.photoIndex + 1) + ' of ' + round.photos.length;
    PTK.setProgress('advertising-progress-fill', this.state.photoIndex, round.photos.length);
    document.getElementById('advertising-scene').innerHTML =
      this.sceneSVG(photo.scene, photo.brand, photo.happy);

    var box = document.getElementById('advertising-expression');
    box.innerHTML = '';
    var answered = false;
    [{ k: 'happy', t: 'Happy' }, { k: 'not-happy', t: 'Not happy' }].forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'btn btn-secondary';
      b.textContent = o.t;
      b.onclick = function () {
        if (answered) return;
        answered = true;
        self.recordExpression(photo, o.k);
      };
      box.appendChild(b);
    });

    // The scene advances on its own if the participant does not answer, so the
    // exposure count stays the same for everyone.
    this._after(function () {
      if (answered || self.state.phase !== 'photo') return;
      answered = true;
      self.recordExpression(photo, null);
    }, this.timing.photo_ms);
  },

  recordExpression: function (photo, judged) {
    this._clearTimers();
    var self = this;
    this.state.expressionResults.push({
      round: this.state.roundIndex + 1,
      scene: photo.scene,
      brandPresent: photo.brand || 'none',
      wasHappy: photo.happy,
      judged: judged || 'none',
      correct: judged === null ? null : ((judged === 'happy') === photo.happy)
    });
    this.state.photoIndex++;
    this._after(function () {
      if (self.state.phase === 'photo') self.renderPhoto();
    }, this.timing.iti_ms);
  },

  runChoice: function () {
    var self = this;
    this.state.phase = 'choice';
    this.show('choice');
    var round = this.state.roundPlan[this.state.roundIndex];
    var box = document.getElementById('advertising-brands');
    box.innerHTML = '';
    round.options.forEach(function (brand) {
      var b = document.createElement('button');
      b.className = 'btn btn-secondary';
      b.textContent = brand;
      b.style.cssText += ';padding:18px 12px;font-size:1.05rem;letter-spacing:1px;';
      b.onclick = function () { self.recordChoice(round, brand); };
      box.appendChild(b);
    });
  },

  recordChoice: function (round, brand) {
    var r = {
      round: this.state.roundIndex + 1,
      options: round.options.join(' | '),
      exposed: round.exposed,
      chosen: brand,
      choseExposed: brand === round.exposed,
      exposures: this.exposuresPerRound,
      photos: round.photos.length
    };
    this.state.results.push(r);
    this.saveTrial(r);
    this.state.roundIndex++;
    this.runRound();
  },

  askAwareness: function () {
    var self = this;
    this.state.phase = 'awareness';
    this.show('awareness');
    var box = document.getElementById('advertising-awareness-options');
    box.innerHTML = '';
    [{ k: 'noticed', t: 'Yes, I noticed a brand' },
     { k: 'unaware', t: 'No, I did not' }].forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'btn btn-secondary';
      b.textContent = o.t;
      b.style.cssText += ';padding:14px 22px;';
      b.onclick = function () { self.state.awareness = o.k; self.showResults(); };
      box.appendChild(b);
    });
  },

  saveTrial: function (r) {
    PTK.save(PTK.row(this, this.spec(), {
      trial_number: r.round,
      prime_type: 'exposed:' + r.exposed,
      target: r.chosen,
      ink_color: r.choseExposed ? 'exposed' : 'not-exposed',
      word_meaning: r.options,
      congruent: r.choseExposed,
      response: r.chosen,
      correct: r.choseExposed,
      rt: null
    }));
  },

  analyse: function () {
    var n = this.state.results.length;
    var hits = this.state.results.filter(function (r) { return r.choseExposed; }).length;
    var rate = n ? Math.round(100 * hits / n) : null;
    var baseline = 25;   // exact, by construction: four options
    var expr = this.state.expressionResults.filter(function (e) { return e.correct !== null; });
    return {
      rounds: n,
      choseExposed: hits,
      rate: rate,
      baseline: baseline,
      effect: rate === null ? null : rate - baseline,
      awareness: this.state.awareness,
      coverTaskAccuracy: expr.length
        ? Math.round(100 * expr.filter(function (e) { return e.correct; }).length / expr.length) : null
    };
  },

  showResults: function () {
    this._clearTimers();
    this.state.phase = 'results';
    this.show('results');
    var a = this.analyse();

    document.getElementById('advertising-results-body').innerHTML =
      '<p>Rounds: ' + a.rounds + ' &nbsp;|&nbsp; chose the exposed brand ' + a.choseExposed + ' time' +
        (a.choseExposed === 1 ? '' : 's') + '</p>' +
      '<p>Your rate: ' + (a.rate === null ? '-' : a.rate + '%') +
        ' &nbsp;|&nbsp; baseline with four options: ' + a.baseline + '%</p>' +
      '<p style="color:#61a3ed;font-weight:700;font-size:1.05rem;">Brand priming effect (D &minus; C): ' +
        (a.effect === null ? '-' : (a.effect > 0 ? '+' : '') + a.effect + ' percentage points') + '</p>' +
      '<p style="color:#64748b;font-size:.86rem;">You said you ' +
        (a.awareness === 'noticed' ? 'DID notice a brand' : 'did NOT notice a brand') +
        '. In Ferraro et al. (2009) the effect held only for participants who had not noticed.' +
        (a.coverTaskAccuracy !== null ? ' Expression judgements: ' + a.coverTaskAccuracy + '% agreement with the drawn expression.' : '') +
      '</p>';

    document.getElementById('advertising-interpretation').innerHTML = PTK.interpret({
      effect: a.effect,
      unit: 'percentage points',
      effectName: 'brand priming effect',
      expectedSign: 1,
      n: a.rounds,
      small: 15,
      note: 'With ' + a.rounds + ' choices this is extremely coarse - one round changes your rate by ' +
            (a.rounds ? Math.round(100 / a.rounds) : 0) + ' points, so only a large effect could show. ' +
            'The baseline of 25% is exact rather than estimated, which is the one thing this version has ' +
            'going for it. The scenes are schematic drawings, not photographs.' +
            (a.awareness === 'noticed'
              ? ' You also reported noticing the brand, which is the condition under which the original effect disappeared.'
              : '')
    });
  },

  restart: function () { this.open(); this.start(); },

  csvParts: function () {
    var aware = this.state.awareness;
    return {
      headers: ['round', 'options', 'exposed_brand', 'chosen_brand', 'chose_exposed',
                'exposures', 'photos_in_round', 'noticed_brand'],
      rows: this.state.results.map(function (r) {
        return [r.round, r.options, r.exposed, r.chosen, r.choseExposed,
                r.exposures, r.photos, aware || ''];
      })
    };
  },

  exportCSV: function () { var p = this.csvParts(); PTK.exportCSV(p.headers, p.rows, 'advertising_priming'); },
  exportXLSX: function () { var p = this.csvParts(); PTK.exportXLSX(p.headers, p.rows, 'advertising_priming'); },

  showThankYou: function () {
    window.history.replaceState({}, document.title, window.location.pathname);
    this.isParticipantMode = false;
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:3000;display:flex;justify-content:center;align-items:center;';
    m.innerHTML = '<div style="background:rgba(17,24,39,.97);border:1px solid rgba(74,222,128,.5);border-radius:20px;padding:44px;max-width:460px;text-align:center;color:#e5e7eb;">' +
      '<h2 style="color:#4ade80;">Thank You!</h2><p style="color:#c0c0c0;">Your responses were recorded. You may close this window.</p>' +
      '<button class="btn" onclick="this.closest(\'div\').parentElement.remove()">Close</button></div>';
    document.body.appendChild(m);
  },

  toConfig: function () {
    return {
      template: 'advertising-priming',
      experimenterEmail: this.experimenterEmail,
      userExperimentId: this.userExperimentId,
      rounds: this.rounds,
      photosPerRound: this.photosPerRound,
      exposuresPerRound: this.exposuresPerRound,
      timing: this.timing,
      stimuli: { brands: this.data.brands, scenes: this.data.scenes }
    };
  },

  openBuilder: function () {
    this.ensureOverlay();
    this.init();
    PTK.openBuilder(this, this.spec());
  },

  closeBuilder: function () { PTK.closeBuilder(this.spec()); },

  checkUrlConfig: function () {
    this.ensureOverlay();
    this.init();
    return PTK.checkUrlConfig(this, this.spec());
  }
};

document.addEventListener('DOMContentLoaded', function () { AdvertisingPriming.init(); });
console.log('Advertising Priming module loaded');
