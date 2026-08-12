// Reaction times are measured on a monotonic clock.
//
// Sixteen paradigm modules used performance.now(). The SHARED ENGINE - the one
// that runs Template Builder and timeline participant links - used Date.now()
// for both ends of the subtraction:
//
//     trial.targetOnset = Date.now();          // showTarget
//     const rt = Date.now() - trial.targetOnset;  // recordResponse
//
// Date.now() reads the wall clock. An NTP correction, a daylight-saving change,
// or the participant fixing their system time steps it forwards or backwards.
// A backwards step mid-trial produces a NEGATIVE reaction time; a forwards step
// produces one of several thousand milliseconds. Neither is recoverable from
// the data afterwards - they look like an inattentive participant, and on a
// platform whose entire output is reaction-time differences of 20-80 ms, a
// handful of those moves the mean.
//
// performance.now() cannot be moved. PTA.now() is it, with a fallback.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/reaction_time_clock.test.js
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

  console.log('\n[the clock itself]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      const a = PTA.now();
      await new Promise(r => setTimeout(r, 40));
      const b = PTA.now();

      // move the wall clock back an hour, as an NTP correction would
      const realNow = Date.now;
      Date.now = () => realNow() - 3600000;
      const c = PTA.now();
      Date.now = realNow;

      return { a, b, c, advanced: b > a, unmoved: c >= b, isNumber: typeof a === 'number' };
    });
    ok('PTA.now returns a number', r.isNumber, typeof r.a);
    ok('it advances with real time', r.advanced, r.a + ' -> ' + r.b);
    ok('a wall-clock jump backwards does NOT move it', r.unmoved, r.b + ' -> ' + r.c);
    await p.close();
  }

  console.log('\n[the engine records an honest reaction time across a clock jump]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      const E = PTA.Engine;
      E.config = {
        id: 'clock_probe', name: 'clock probe', type: 'generic',
        presentation: {}, data: {}, targets: { type: 'text' }, primes: { type: 'text' }
      };
      E.state = { isRunning: true, currentTrial: 0, totalTrials: 1, trials: [],
                  results: [], participantId: 'p_test', externalId: null, startTime: Date.now() };
      // keep recordResponse from walking into feedback/next-trial DOM
      E.showFeedback = function () {};
      E.nextTrial = function () {};
      E.saveResults = function () {};

      // Let the ENGINE stamp the onset, through its own showTarget. Stamping it
      // from the test would only prove the two ends disagree; going through
      // showTarget means that with Date.now() on both ends the code is
      // internally consistent, and the only thing that breaks it is the clock
      // actually moving - which is the defect being guarded against.
      E.listenForResponse = function () {};
      E.elements = E.elements || {};
      E.elements.stimulusDisplay = document.createElement('div');

      const trial = { prime: 'a', target: 'b', condition: 'x', correctResponse: 'k' };
      E.showTarget(trial);
      await new Promise(r => setTimeout(r, 60));

      // the wall clock steps back an hour in the middle of the trial
      const realNow = Date.now;
      Date.now = () => realNow() - 3600000;
      E.recordResponse(trial, 'k');
      Date.now = realNow;

      const row = E.state.results[E.state.results.length - 1];
      return { rt: row && row.rt, rows: E.state.results.length };
    });
    ok('a trial was recorded', r.rows === 1, String(r.rows));
    ok('the reaction time is not negative', r.rt >= 0, String(r.rt));
    ok('it is a plausible reaction time, not an hour',
       r.rt > 20 && r.rt < 2000, String(r.rt));
    console.log('     recorded rt = ' + Math.round(r.rt) + ' ms across a -1h clock step');
    await p.close();
  }

  console.log('\n[a normal trial still measures what it should]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      const E = PTA.Engine;
      E.config = {
        id: 'clock_probe2', name: 'clock probe 2', type: 'generic',
        presentation: {}, data: {}, targets: { type: 'text' }, primes: { type: 'text' }
      };
      E.state = { isRunning: true, currentTrial: 0, totalTrials: 1, trials: [],
                  results: [], participantId: 'p_test', externalId: null, startTime: Date.now() };
      E.showFeedback = function () {};
      E.nextTrial = function () {};
      E.saveResults = function () {};

      const trial = { prime: 'a', target: 'b', condition: 'x', correctResponse: 'k' };
      trial.targetOnset = PTA.now();
      await new Promise(r => setTimeout(r, 250));
      E.recordResponse(trial, 'k');
      return { rt: E.state.results[0].rt, correct: E.state.results[0].correct };
    });
    // generous bounds: a headless browser is not a timing rig, but 250 ms of
    // real waiting must not come back as 5 or as 5000
    ok('a 250 ms wait measures near 250 ms', r.rt > 200 && r.rt < 600, String(Math.round(r.rt)));
    ok('the response is still scored', r.correct === true, String(r.correct));
    await p.close();
  }

  console.log('\n[nothing in the engine still measures elapsed time on the wall clock]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      const src = await fetch('js/engine_fab.js').then(r => r.text());
      // Date.now() is legitimate for a session TIMESTAMP; it is not legitimate
      // as either end of an elapsed-time subtraction.
      const subtraction = /Date\.now\(\)\s*-\s*\w/.test(src);
      const onsetOnWallClock = /Onset\s*=\s*Date\.now\(\)/.test(src);
      return { subtraction, onsetOnWallClock };
    });
    ok('no elapsed time is computed from Date.now()', r.subtraction === false);
    ok('no stimulus onset is stamped from Date.now()', r.onsetOnWallClock === false);
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
