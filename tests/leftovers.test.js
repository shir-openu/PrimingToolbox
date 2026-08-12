// Two things left behind: a result written nowhere, and a listener that outlives
// the experiment.
//
// SUBLIMINAL wrote its awareness summary to #subliminal-awareness-summary and
// its interpretation to #subliminal-interpretation. Neither id exists on
// index.html - both live only in the untracked standalone subliminal.html - so
// on the page every participant actually uses, both were skipped in silence.
// Losing the interpretation costs a student the sentence explaining what their
// number means. Losing the awareness check costs more than that: it is the only
// evidence a run was subliminal rather than merely fast, which is the claim the
// whole paradigm rests on.
//
// AFFECTIVE PRIMING installed a document-level keydown at the
// practice-finished screen as a closure-local const, so close() could not reach
// it. Leave at that screen and the listener stayed on `document` forever;
// pressing that key later - on the landing page, inside another experiment -
// began a scored block in a hidden overlay and wrote trials nobody was looking
// at.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/leftovers.test.js
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

  console.log('\n[subliminal writes its results where the page can show them]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Subliminal;
      // a run with a clear effect and an awareness check
      S.state.results = [];
      for (let i = 0; i < 10; i++) {
        S.state.results.push({ relation: 'related', correct: true, rt: 500, trialType: 'lexical' });
        S.state.results.push({ relation: 'unrelated', correct: true, rt: 560, trialType: 'lexical' });
      }
      S.state.awarenessTrials = [{ sawWord: false }, { sawWord: false }, { sawWord: true }];
      S.saveResults = function () {};        // do not touch the real database
      try { S.showResults(); } catch (e) { return { threw: e.message }; }
      const host = document.getElementById('subliminal-explanation');
      return {
        threw: null,
        text: host ? host.innerText : '(no #subliminal-explanation)',
        len: host ? host.innerText.trim().length : 0
      };
    });
    ok('showResults does not throw', r.threw === null, String(r.threw));
    ok('something is written to the visible panel', r.len > 60, String(r.len));
    ok('the awareness check is reported', /awareness/i.test(r.text), r.text.slice(0, 120));
    ok('the awareness NUMBERS are there', /1 \/ 3|33%/.test(r.text), r.text.slice(0, 200));
    ok('the interpretation survives beside it', /priming effect/i.test(r.text), r.text.slice(-160));
    ok('one does not overwrite the other',
       /awareness/i.test(r.text) && /priming effect/i.test(r.text), r.text.slice(0, 240));
    ok('no page errors', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[affective: the practice listener dies with the experiment]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      const A = window.Affective;
      if (!A) return { missing: true };
      // reach the practice-finished screen the way runTrial does
      A.state = A.state || {};
      A.state.isPractice = true;
      A.state.currentTrial = 999;               // past the end -> the "press key" branch
      A.state.trials = [];
      A.responseKeys = A.responseKeys || { positive: 'p', negative: 'q' };
      let began = 0;
      A.beginScored = function () { began++; };
      try { A.runTrial(); } catch (e) { /* the branch may need DOM we lack */ }
      const armed = typeof A._practiceGo === 'function';

      // the participant leaves instead of pressing the key
      try { A.close(); } catch (e) { /* fine */ }
      const cleared = A._practiceGo === null || A._practiceGo === undefined;

      // and now presses that key somewhere else entirely
      document.dispatchEvent(new KeyboardEvent('keydown', { key: A.responseKeys.positive }));
      await new Promise(r => setTimeout(r, 120));
      return { missing: false, armed: armed, cleared: cleared, beganAfterClose: began };
    });
    ok('the module is there', !r.missing);
    ok('the listener is reachable from the module', r.armed, String(r.armed));
    ok('close() removes it', r.cleared, String(r.cleared));
    ok('pressing the key afterwards starts NOTHING', r.beganAfterClose === 0, String(r.beganAfterClose));
    ok('no page errors', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[re-entering practice does not stack listeners]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const A = window.Affective;
      A.state = A.state || {};
      A.state.isPractice = true;
      A.state.currentTrial = 999;
      A.state.trials = [];
      A.responseKeys = A.responseKeys || { positive: 'p', negative: 'q' };
      let began = 0;
      A.beginScored = function () { began++; };
      try { A.runTrial(); } catch (e) {}
      const first = A._practiceGo;
      try { A.runTrial(); } catch (e) {}
      const second = A._practiceGo;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: A.responseKeys.positive }));
      try { A.close(); } catch (e) {}
      return { replaced: first !== second, began: began };
    });
    ok('the second arming replaces the first', r.replaced, String(r.replaced));
    ok('one key press begins the block once, not twice', r.began <= 1, String(r.began));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
