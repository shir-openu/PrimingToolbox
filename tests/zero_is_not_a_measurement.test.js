// Two more places where a missing condition became a real-looking number.
//
// empty_conditions.test.js covers semantic, subliminal, number priming, moral
// and repetition. Two live call sites were not covered by that sweep, both
// reached through PTA.mean, which returns 0 for an empty array:
//
//   1. js/evaluative.js - the mean rating of a condition with no trials fell
//      back to 0. THE SCALE RUNS 1 TO 7. A participant with no
//      negatively-paired trials got ecEffect = avgPositive - 0 = avgPositive,
//      and the screen announced a "Strong evaluative conditioning effect" whose
//      whole size was the positive mean, measured against a rating nobody can
//      give.
//
//   2. js/engine_fab.js, the Stroop branch of the shared engine - congruentRT
//      and incongruentRT were unguarded. No CORRECT congruent trials meant
//      congruentRT = 0 and stroopEffect = incongruentRT - 0, so the entire
//      reaction time was reported as the interference effect. A real Stroop
//      effect is 50-100 ms; this produced 850. Accuracy and error rate divided
//      by a trial count that can be zero, printing NaN.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/zero_is_not_a_measurement.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });

  async function open() {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    await p.evaluateOnNewDocument(() => {
      window.alert = function () {};
      window.__PTBX_NO_TELEMETRY = true;
    });
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    return p;
  }

  console.log('\n[the shared helpers]');
  {
    const p = await open();
    const r = await p.evaluate(() => ({
      emptyMean: PTA.meanOrNull([]),
      nullMean: PTA.meanOrNull(null),
      junkMean: PTA.meanOrNull([NaN, undefined]),
      realMean: PTA.meanOrNull([4, 5]),
      unrounded: PTA.meanOrNull([1, 2]),
      pctZero: PTA.pctOrNull(3, 0),
      pctReal: PTA.pctOrNull(3, 4),
      pctGenuineZero: PTA.pctOrNull(0, 4)
    }));
    ok('an empty array has no mean', r.emptyMean === null, String(r.emptyMean));
    ok('null input has no mean', r.nullMean === null, String(r.nullMean));
    ok('non-numbers have no mean', r.junkMean === null, String(r.junkMean));
    ok('a real array averages', r.realMean === 4.5, String(r.realMean));
    ok('it does NOT round - ratings are not milliseconds', r.unrounded === 1.5, String(r.unrounded));
    ok('a percentage of nothing is null, not NaN', r.pctZero === null, String(r.pctZero));
    ok('a real percentage works', r.pctReal === 75, String(r.pctReal));
    ok('a genuine 0% is kept', r.pctGenuineZero === 0, String(r.pctGenuineZero));
    await p.close();
  }

  console.log('\n[evaluative conditioning: 0 is not on the scale]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const E = window.EvaluativeConditioning;
      E.saveResults = function () {};
      // every trial positively paired; nothing negative
      E.state.testResults = [];
      for (let i = 0; i < 6; i++) {
        E.state.testResults.push({ pairedValence: 'positive', rating: 6 });
      }
      E.showResults();
      const g = id => (document.getElementById(id) || {}).textContent;
      return {
        pos: g('result-positive-avg'),
        neg: g('result-negative-avg'),
        effect: g('result-ec-effect'),
        explanation: (document.getElementById('ec-explanation') || {}).textContent || ''
      };
    });
    ok('the real mean is still shown', r.pos === '6.00', String(r.pos));
    ok('the missing mean is a dash, not 0.00', r.neg === '—', String(r.neg));
    ok('no effect is invented from it', r.effect === '—', String(r.effect));
    ok('it does NOT claim a strong conditioning effect',
       !/strong evaluative conditioning/i.test(r.explanation), r.explanation.slice(0, 140));
    ok('it says which condition was missing',
       /negatively-paired/i.test(r.explanation), r.explanation.slice(0, 160));
    ok('and says why zero was the wrong answer',
       /does not go that low/i.test(r.explanation), r.explanation.slice(0, 200));
    console.log('     ' + r.explanation.slice(0, 170));
    await p.close();
  }

  console.log('\n[evaluative conditioning: a real effect still reports normally]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const E = window.EvaluativeConditioning;
      E.saveResults = function () {};
      E.state.testResults = [];
      for (let i = 0; i < 6; i++) {
        E.state.testResults.push({ pairedValence: 'positive', rating: 6 });
        E.state.testResults.push({ pairedValence: 'negative', rating: 3 });
      }
      E.showResults();
      const g = id => (document.getElementById(id) || {}).textContent;
      return { pos: g('result-positive-avg'), neg: g('result-negative-avg'),
               effect: g('result-ec-effect'),
               explanation: (document.getElementById('ec-explanation') || {}).textContent || '' };
    });
    ok('both means reported', r.pos === '6.00' && r.neg === '3.00', r.pos + ' / ' + r.neg);
    ok('the effect is 3.00', r.effect === '3.00', String(r.effect));
    ok('and it IS interpreted as an effect',
       /evaluative conditioning effect/i.test(r.explanation) && !/no effect can be reported/i.test(r.explanation),
       r.explanation.slice(0, 140));
    await p.close();
  }

  console.log('\n[the engine Stroop branch: the effect is not the whole reaction time]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const E = PTA.Engine;
      E.config = Object.assign({}, E.config, { type: 'stroop' });
      // answered every incongruent trial correctly, got every congruent one
      // wrong - so there are no correct congruent trials to average
      E.state.results = [];
      for (let i = 0; i < 8; i++) {
        E.state.results.push({ correct: false, congruent: true, rt: 700, response: 'x' });
        E.state.results.push({ correct: true, congruent: false, rt: 850, response: 'y' });
      }
      const s = E.displayResults();
      return {
        congruentRT: s.congruentRT, incongruentRT: s.incongruentRT,
        stroopEffect: s.stroopEffect, accuracy: s.accuracy, meanRT: s.meanRT
      };
    });
    ok('the missing congruent mean is null, not 0', r.congruentRT === null, String(r.congruentRT));
    ok('the incongruent mean is real', r.incongruentRT === 850, String(r.incongruentRT));
    ok('the Stroop effect is null, NOT 850', r.stroopEffect === null, String(r.stroopEffect));
    ok('accuracy is still computed', r.accuracy === 50, String(r.accuracy));
    await p.close();
  }

  console.log('\n[the engine: a run with no trials prints no NaN]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const E = PTA.Engine;
      E.config = Object.assign({}, E.config, { type: 'generic' });
      E.state.results = [];
      const s = E.displayResults();
      return { accuracy: s.accuracy, errorRate: s.errorRate, meanRT: s.meanRT,
               medianRT: s.medianRT, anyNaN: [s.accuracy, s.errorRate, s.meanRT, s.medianRT]
                 .some(v => typeof v === 'number' && isNaN(v)) };
    });
    ok('accuracy is null, not NaN', r.accuracy === null, String(r.accuracy));
    ok('error rate is null, not NaN', r.errorRate === null, String(r.errorRate));
    ok('mean RT is null, not 0', r.meanRT === null, String(r.meanRT));
    ok('median RT is null', r.medianRT === null, String(r.medianRT));
    ok('nothing anywhere is NaN', r.anyNaN === false);
    await p.close();
  }

  console.log('\n[a real Stroop run is unaffected]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const E = PTA.Engine;
      E.config = Object.assign({}, E.config, { type: 'stroop' });
      E.state.results = [];
      for (let i = 0; i < 8; i++) {
        E.state.results.push({ correct: true, congruent: true, rt: 700, response: 'x' });
        E.state.results.push({ correct: true, congruent: false, rt: 780, response: 'y' });
      }
      const s = E.displayResults();
      return { c: s.congruentRT, i: s.incongruentRT, e: s.stroopEffect, a: s.accuracy };
    });
    ok('congruent mean is 700', r.c === 700, String(r.c));
    ok('incongruent mean is 780', r.i === 780, String(r.i));
    ok('the Stroop effect is 80 ms, a plausible one', r.e === 80, String(r.e));
    ok('accuracy is 100%', r.a === 100, String(r.a));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
