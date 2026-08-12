// One rating per trial, in evaluative conditioning.
//
// js/evaluative.js has always signalled "stop accepting ratings" with
// classList.remove('active') on #rating-scale-container. No stylesheet defined
// that class, so it was a dead hook: the seven buttons stayed fully visible and
// fully clickable between trials.
//
// A stray second click then recorded a second row - and not a harmless
// duplicate. state.currentTrial has already advanced, so the row is stamped
// with the NEXT trial's number while `trial` is still the previous one from the
// closure. Measured before the fix:
//
//     {trialNumber:1, csId:'cs1', rating:4}   the real response
//     {trialNumber:2, csId:'cs1', rating:6}   trial 2's slot, trial 1's shape
//
// In this paradigm the entire measure is which shape was paired with which
// valence. A rating attributed to the wrong shape does not add noise - it
// inverts the effect for that item.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/evaluative_rating_lock.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}
const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|platform_events|PTA:/i;

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
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    await p.evaluateOnNewDocument(() => { window.alert = function () {}; });
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    p._errs = errs;
    return p;
  }

  console.log('\n[a second click records nothing]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const M = window.EvaluativeConditioning;
      M.state.testResults = [];
      M.state.currentTrial = 0;
      M.state.stimulusOnset = performance.now();
      const trial = { cs: { id: 'cs1', label: 'SHAPE1' }, pairedValence: 'positive' };
      M.enableRatingScale(trial);
      const c = document.getElementById('rating-scale-container');
      const btns = c.querySelectorAll('.rating-button');
      btns[3].click();
      const afterOne = M.state.testResults.length;
      btns[5].click();          // the stray one
      btns[0].click();          // and another, for good measure
      return {
        buttons: btns.length,
        afterOne: afterOne,
        afterMore: M.state.testResults.length,
        rows: M.state.testResults.map(x => ({ t: x.trialNumber, cs: x.csId, r: x.rating }))
      };
    });
    ok('the scale has its seven buttons', r.buttons === 7, String(r.buttons));
    ok('the first click records', r.afterOne === 1, String(r.afterOne));
    ok('further clicks record nothing', r.afterMore === 1, String(r.afterMore));
    ok('no row carries the wrong shape', r.rows.length === 1 && r.rows[0].cs === 'cs1',
       JSON.stringify(r.rows));
    ok('no page errors', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[the "active" class is no longer a dead hook]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const c = document.getElementById('rating-scale-container');
      c.classList.remove('active');
      const off = getComputedStyle(c);
      const offState = { pe: off.pointerEvents, op: off.opacity };
      c.classList.add('active');
      const on = getComputedStyle(c);
      return { offState: offState, onState: { pe: on.pointerEvents, op: on.opacity } };
    });
    ok('inactive: clicks do not reach the buttons', r.offState.pe === 'none', JSON.stringify(r.offState));
    ok('inactive: it is visibly dimmed', Number(r.offState.op) < 0.6, JSON.stringify(r.offState));
    ok('active: clickable again', r.onState.pe === 'auto', JSON.stringify(r.onState));
    ok('active: fully visible', Number(r.onState.op) === 1, JSON.stringify(r.onState));
    await p.close();
  }

  console.log('\n[the next trial opens the window again]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const M = window.EvaluativeConditioning;
      M.state.testResults = [];
      M.state.currentTrial = 0;
      M.state.stimulusOnset = performance.now();
      const t1 = { cs: { id: 'cs1', label: 'A' }, pairedValence: 'positive' };
      const t2 = { cs: { id: 'cs2', label: 'B' }, pairedValence: 'negative' };
      M.enableRatingScale(t1);
      document.querySelectorAll('.rating-button')[2].click();
      M.state.stimulusOnset = performance.now();
      M.enableRatingScale(t2);              // next trial re-arms
      document.querySelectorAll('.rating-button')[6].click();
      return M.state.testResults.map(x => ({ cs: x.csId, r: x.rating }));
    });
    ok('two trials give two rows', r.length === 2, JSON.stringify(r));
    ok('each row carries its own shape', r.length === 2 && r[0].cs === 'cs1' && r[1].cs === 'cs2',
       JSON.stringify(r));
    await p.close();
  }

  console.log('\n[social priming: the fifth chip cannot double-record]');
  {
    // Same class of bug, different paradigm. The item closes on the fourth
    // word, but the FIFTH chip stays enabled for the 350 ms before renderItem
    // repaints. Clicking it pushed a fifth word, selection.length >= 4 was true
    // again, and recordItem ran a second time - after currentTrial had already
    // advanced. The previous item's words were filed under the NEXT item's
    // condition and stereotype, a second row went to the database, and a real
    // item was skipped. One stray click: one corrupted row, one missing one.
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Social;
      if (!S) return { missing: true };
      S.saveTrial = function () {};              // never touch the database
      S.state = S.state || {};
      S.state.results = [];
      S.state.currentTrial = 0;
      S.state.selection = [];
      S.state.itemOnset = performance.now();
      S.state.trials = [
        { condition: 'prime',   stereotype: 'elderly', words: ['a', 'b', 'c', 'd', 'e'] },
        { condition: 'neutral', stereotype: null,      words: ['f', 'g', 'h', 'i', 'j'] }
      ];
      S._after = function (fn) { return setTimeout(fn, 100000); };   // freeze the repaint
      S.state.locked = false;
      const fake = () => ({ disabled: false, style: {} });
      const btns = [fake(), fake(), fake(), fake(), fake()];
      S.pickWord('a', btns[0]);
      S.pickWord('b', btns[1]);
      S.pickWord('c', btns[2]);
      S.pickWord('d', btns[3]);
      const afterFour = S.state.results.length;
      const trialAfterFour = S.state.currentTrial;
      S.pickWord('e', btns[4]);                  // the stray fifth
      return {
        missing: false,
        afterFour: afterFour,
        afterFive: S.state.results.length,
        trialAfterFour: trialAfterFour,
        trialAfterFive: S.state.currentTrial,
        rows: S.state.results.map(x => ({ c: x.condition, s: x.sentence }))
      };
    });
    ok('social: four words record one item', !r.missing && r.afterFour === 1, JSON.stringify(r));
    ok('social: the fifth chip records nothing', r.afterFive === 1, String(r.afterFive));
    ok('social: no item is skipped', r.trialAfterFive === r.trialAfterFour, r.trialAfterFour + ' -> ' + r.trialAfterFive);
    ok('social: the one row is the real one', r.rows && r.rows.length === 1 && r.rows[0].s === 'a b c d',
       JSON.stringify(r.rows));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
