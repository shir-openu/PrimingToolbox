// Closing an experiment stops it.
//
// js/engine_fab.js scheduled the whole trial chain - fixation, prime, ISI,
// target, feedback, ITI - with bare setTimeout and tracked none of it, while
// reset() cleared only the response handler and the response window. reset() is
// what index.html calls when the experiment closes.
//
// So a run closed mid-trial left callbacks that still fired:
//
//   * showTarget() wrote into the hidden display and called listenForResponse,
//     which RE-ATTACHES a keydown listener - a closed experiment quietly
//     listening to the keyboard again;
//   * the ITI callback called runTrial(), starting a trial against the freshly
//     reset state.
//
// evaluative.js already carries a comment about exactly this ("kept running
// after close(): it went on incrementing state.currentTrial and rendering into
// a hidden overlay"). Every paradigm module gets _after/_clearTimers from
// PTK.timers; the engine cannot, because engine_fab.js loads BEFORE
// paradigm_kit_fab.js - the same load-order reason it carries its own _esc - so
// it now keeps its own.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/engine_timers.test.js
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

  // A one-trial generic experiment whose phases are long enough to close during.
  const SETUP = `
    const E = PTA.Engine;
    const host = document.createElement('div');
    host.id = 'engine-timer-probe';
    document.body.appendChild(host);
    E.elements.stimulusDisplay = host;
    E.saveResults = function () {};
    E.displayResults = function () { window.__displayed = (window.__displayed || 0) + 1; };
    E.config = {
      id: 'timer_probe', name: 'timer probe', type: 'generic',
      primes: { type: 'text', items: ['A'] },
      targets: { type: 'text', items: ['B'] },
      trials: { repetitions: 1 },
      presentation: { fixation_ms: 120, prime_duration_ms: 120, ISI_ms: 120,
                      target_duration_ms: 0, response_timeout_ms: 4000, ITI_ms: 120 },
      response: { keys: { word: 'F', nonword: 'J' } },
      feedback: { show: false },
      data: {}
    };
    E.state.trials = [{ prime: 'A', target: 'B', condition: 'x', correctResponse: 'word' }];
    E.state.totalTrials = 1;
    E.state.currentTrial = 0;
    E.state.results = [];
    E.state.isRunning = true;
  `;

  console.log('\n[the timers are tracked at all]');
  {
    const p = await open();
    const r = await p.evaluate(new Function(SETUP + `
      const before = (PTA.Engine._timers || []).length;
      PTA.Engine.runTrial();
      const after = (PTA.Engine._timers || []).length;
      return { hasHelpers: typeof PTA.Engine._after === 'function'
                        && typeof PTA.Engine._clearTimers === 'function',
               before, after };
    `));
    ok('the engine has _after and _clearTimers', r.hasHelpers);
    ok('running a trial registers a timer', r.after > r.before,
       r.before + ' -> ' + r.after);
    await p.close();
  }

  console.log('\n[closing mid-trial stops the chain]');
  {
    const p = await open();
    const r = await p.evaluate(new Function(SETUP + `
      PTA.Engine.runTrial();          // schedules fixation -> prime -> ISI -> target
      PTA.Engine.reset();             // what closing the experiment does
      return new Promise(res => setTimeout(() => {
        res({
          results: PTA.Engine.state.results.length,
          currentTrial: PTA.Engine.state.currentTrial,
          isRunning: PTA.Engine.state.isRunning,
          displayed: window.__displayed || 0,
          pending: (PTA.Engine._timers || []).length,
          html: document.getElementById('engine-timer-probe').innerHTML.length
        });
      }, 900));                       // well past every phase in the config
    `));
    ok('no trial ran after the close', r.results === 0, String(r.results));
    ok('the trial counter did not advance', r.currentTrial === 0, String(r.currentTrial));
    ok('the engine is not running', r.isRunning === false, String(r.isRunning));
    ok('no results screen was shown', r.displayed === 0, String(r.displayed));
    ok('no timers are left pending', r.pending === 0, String(r.pending));
    await p.close();
  }

  console.log('\n[a keypress after closing records nothing]');
  {
    const p = await open();
    const r = await p.evaluate(new Function(SETUP + `
      PTA.Engine.runTrial();
      PTA.Engine.reset();
      return new Promise(res => setTimeout(() => {
        // the window in which showTarget would have re-attached a listener
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', bubbles: true }));
        setTimeout(() => res({
          results: PTA.Engine.state.results.length,
          handler: !!PTA.Engine.responseHandler
        }), 100);
      }, 700));
    `));
    ok('no response was recorded into a closed run', r.results === 0, String(r.results));
    ok('no keydown handler is still attached', r.handler === false, String(r.handler));
    await p.close();
  }

  console.log('\n[a run that is NOT closed still completes]');
  {
    const p = await open();
    const r = await p.evaluate(new Function(SETUP + `
      PTA.Engine.runTrial();
      return new Promise(res => setTimeout(() => {
        // answer once the target is up
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', bubbles: true }));
        setTimeout(() => res({
          results: PTA.Engine.state.results.length,
          rt: (PTA.Engine.state.results[0] || {}).rt,
          response: (PTA.Engine.state.results[0] || {}).response
        }), 200);
      }, 500));
    `));
    ok('the trial still runs and records', r.results === 1, String(r.results));
    ok('with a real reaction time', typeof r.rt === 'number' && r.rt > 0, String(r.rt));
    ok('and the response that was pressed', r.response === 'word', String(r.response));
    console.log('     recorded rt = ' + Math.round(r.rt || 0) + ' ms');
    await p.close();
  }

  // index.html's startExperiment() calls init() directly and never resets
  // first, and restartExperiment() only re-shows the setup screen. Pressing
  // Start twice therefore left TWO trial chains running at once, both advancing
  // trials and both writing rows, with nothing on screen to show it.
  console.log('\n[starting twice leaves one experiment running, not two]');
  {
    const p = await open();
    const r = await p.evaluate(new Function(SETUP + `
      const cfg = PTA.Engine.config;
      const trials = PTA.Engine.state.trials;

      PTA.Engine.runTrial();                    // first chain is now pending
      const afterFirst = (PTA.Engine._timers || []).length;

      // the participant presses Start again
      PTA.Engine.init(cfg);
      const afterSecondInit = (PTA.Engine._timers || []).length;

      PTA.Engine.state.trials = trials;
      PTA.Engine.state.totalTrials = 1;
      PTA.Engine.state.results = [];
      PTA.Engine.state.isRunning = true;
      PTA.Engine.runTrial();                    // second chain

      return new Promise(res => setTimeout(() => res({
        afterFirst, afterSecondInit,
        results: PTA.Engine.state.results.length,
        currentTrial: PTA.Engine.state.currentTrial
      }), 900));
    `));
    ok('the first start scheduled a timer', r.afterFirst > 0, String(r.afterFirst));
    ok('the second init cancelled it', r.afterSecondInit === 0, String(r.afterSecondInit));
    ok('only one chain ran, so no trial was recorded twice',
       r.results <= 1, String(r.results));
    ok('and the trial counter advanced at most once',
       r.currentTrial <= 1, String(r.currentTrial));
    console.log('     timers after first start=' + r.afterFirst +
                ', after second init=' + r.afterSecondInit);
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
