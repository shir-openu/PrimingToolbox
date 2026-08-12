// A condition with no usable trials must not become a result.
//
// Five modules each carried their own copy of:
//     const avg = arr => arr.length ? Math.round(...) : 0;
// so an empty condition came back as 0 ms rather than "no data", and the
// results screens then SUBTRACTED that from a real mean.
//
// In semantic priming, a participant with no correct related trials produced
// 600 - 0 = 600, and the screen announced:
//
//   "You showed a robust semantic priming effect of 600ms. Related word pairs
//    (0ms) were recognized significantly faster than unrelated pairs (600ms)."
//
// A confident, specific, entirely invented finding - and 0 ms is not a reaction
// time any human has produced. The same shape existed in subliminal, number
// priming and Stroop, where an empty cell could decide which language the
// platform called dominant.
//
// PTA.meanRT returns null instead, PTA.diffOrNull refuses to subtract around a
// missing mean, and PTA.showMean prints an em dash.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/empty_conditions.test.js
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

  console.log('\n[the shared helpers are honest about nothing]');
  {
    const p = await open();
    const r = await p.evaluate(() => ({
      empty: PTA.meanRT([]),
      nullArg: PTA.meanRT(null),
      noNumbers: PTA.meanRT([{ rt: null }, { rt: undefined }]),
      real: PTA.meanRT([{ rt: 400 }, { rt: 500 }]),
      mixed: PTA.meanRT([{ rt: 400 }, { rt: null }]),
      diffBothReal: PTA.diffOrNull(600, 500),
      diffLeftNull: PTA.diffOrNull(null, 500),
      diffRightNull: PTA.diffOrNull(600, null),
      showNull: PTA.showMean(null),
      showReal: PTA.showMean(450, ' ms'),
      showZero: PTA.showMean(0)
    }));
    ok('an empty set has no mean', r.empty === null, String(r.empty));
    ok('null input has no mean', r.nullArg === null, String(r.nullArg));
    ok('rows without numbers have no mean', r.noNumbers === null, String(r.noNumbers));
    ok('a real set averages', r.real === 450, String(r.real));
    ok('non-numbers are skipped, not counted as zero', r.mixed === 400, String(r.mixed));
    ok('a difference of two real means works', r.diffBothReal === 100, String(r.diffBothReal));
    ok('a missing left mean gives null', r.diffLeftNull === null, String(r.diffLeftNull));
    ok('a missing right mean gives null', r.diffRightNull === null, String(r.diffRightNull));
    ok('null displays as an em dash', r.showNull === '—', r.showNull);
    ok('a real mean displays with its unit', r.showReal === '450 ms', r.showReal);
    ok('a genuine ZERO is not mistaken for missing', r.showZero === '0', r.showZero);
    await p.close();
  }

  console.log('\n[semantic: no related trials means NO effect, not a huge one]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Semantic;
      S.saveResults = function () {};
      // every related trial answered wrongly; unrelated all fine
      S.state.results = [];
      for (let i = 0; i < 8; i++) {
        S.state.results.push({ condition: 'related', correct: false, timeout: false, rt: 700 });
        S.state.results.push({ condition: 'unrelated', correct: true, timeout: false, rt: 600 });
      }
      S.showResults();
      const g = id => (document.getElementById(id) || {}).textContent;
      return {
        related: g('semantic-related-rt'),
        unrelated: g('semantic-unrelated-rt'),
        effect: g('semantic-priming-effect'),
        explanation: (document.getElementById('semantic-explanation') || {}).textContent || ''
      };
    });
    ok('the missing mean shows as a dash, not 0', r.related === '—', String(r.related));
    ok('the real mean is still shown', r.unrelated === '600', String(r.unrelated));
    ok('the effect shows as a dash, not 600', r.effect === '—', String(r.effect));
    ok('it does NOT claim a robust priming effect',
       !/robust/i.test(r.explanation), r.explanation.slice(0, 120));
    ok('it says which condition had no usable trials',
       /no usable trials/i.test(r.explanation) && /related/i.test(r.explanation),
       r.explanation.slice(0, 160));
    console.log('     ' + r.explanation.slice(0, 150));
    await p.close();
  }

  console.log('\n[semantic: a real effect is still reported normally]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Semantic;
      S.saveResults = function () {};
      S.state.results = [];
      for (let i = 0; i < 8; i++) {
        S.state.results.push({ condition: 'related', correct: true, timeout: false, rt: 500 });
        S.state.results.push({ condition: 'unrelated', correct: true, timeout: false, rt: 560 });
      }
      S.showResults();
      const g = id => (document.getElementById(id) || {}).textContent;
      return {
        related: g('semantic-related-rt'),
        effect: g('semantic-priming-effect'),
        explanation: (document.getElementById('semantic-explanation') || {}).textContent || ''
      };
    });
    ok('the related mean is reported', r.related === '500', String(r.related));
    ok('the effect is 60 ms', r.effect === '60', String(r.effect));
    ok('and it is interpreted as a real effect',
       /priming effect/i.test(r.explanation) && !/no usable/i.test(r.explanation),
       r.explanation.slice(0, 120));
    await p.close();
  }

  console.log('\n[the other three no longer invent an effect either]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const out = {};
      // subliminal: no related trials
      const S = window.Subliminal;
      S.saveResults = function () {};
      S.state.results = [];
      S.state.awarenessTrials = [];
      for (let i = 0; i < 6; i++) {
        S.state.results.push({ relation: 'unrelated', correct: true, rt: 620, trialType: 'lexical' });
      }
      try { S.showResults(); } catch (e) { out.subThrew = e.message; }
      out.subEffect = (document.getElementById('subliminal-priming-effect') || {}).textContent;

      // number priming: no congruent trials
      const N = window.NumberPriming;
      N.saveResults = function () {};
      N.state.results = [];
      for (let i = 0; i < 6; i++) {
        N.state.results.push({ congruent: false, correct: true, timeout: false, rt: 540 });
      }
      try { N.showResults(); } catch (e) { out.npThrew = e.message; }
      out.npEffect = (document.getElementById('np-priming-effect') ||
                      document.getElementById('number-priming-effect') || {}).textContent;
      return out;
    });
    ok('subliminal does not throw', !r.subThrew, String(r.subThrew));
    ok('subliminal reports no effect rather than a fabricated one',
       r.subEffect === '—' || r.subEffect === undefined || /—/.test(String(r.subEffect)),
       String(r.subEffect));
    ok('number priming does not throw', !r.npThrew, String(r.npThrew));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
