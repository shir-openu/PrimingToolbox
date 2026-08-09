/**
 * Regression tests for the three defects found and fixed:
 *   1. MaskedLexical  - orphaned response-window timeout wrote false "too slow"
 *                       rows carrying the previous trial's target.
 *   2. SyntacticPriming - a second click threw on tr.primeForm.
 *   3. RepetitionPriming - Enter plus Next recorded one fragment twice.
 * Each test reproduces the original trigger and asserts it no longer bites.
 */
const puppeteer = require('puppeteer');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (n, c, d) => {
  if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (d ? '  -> ' + d : '')); }
};

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files',
           '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows']
  });

  async function page() {
    const p = await b.newPage();
    await p.evaluateOnNewDocument(() => {
      const iv = setInterval(() => {
        if (window.PTA && PTA.saveToSupabase) { PTA.saveToSupabase = () => {}; clearInterval(iv); }
      }, 30);
    });
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    await sleep(700);
    return p;
  }

  // 1 -------------------------------------------------- orphaned timeout
  console.log('\n=== 1. MaskedLexical orphaned timeout ===');
  {
    const p = await page();
    const r = await p.evaluate(async () => {
      MaskedLexical.open(); MaskedLexical.start();          // real timings
      const plan = MaskedLexical.state.trials.map(t => t.target);
      const nap = ms => new Promise(x => setTimeout(x, ms));
      const t0 = Date.now();
      while (Date.now() - t0 < 75000) {
        await nap(15);
        if (document.getElementById('masked-results').style.display === 'block') break;
        if (MaskedLexical.state.awaiting) {
          const i = MaskedLexical.state.currentTrial;
          await nap(600);
          if (MaskedLexical.state.awaiting && MaskedLexical.state.currentTrial === i) {
            const t = MaskedLexical.state.trials[i];
            document.dispatchEvent(new KeyboardEvent('keydown', { key: t.lexical === 'word' ? 'j' : 'f' }));
          }
        }
      }
      const res = MaskedLexical.state.results;
      return {
        rows: res.length, planned: plan.length,
        wrongTarget: res.filter(x => plan[x.trial - 1] !== x.target).length,
        falseTimeouts: res.filter(x => x.timedOut).length,
        dupes: res.length - new Set(res.map(x => x.trial)).size
      };
    });
    check('one row per trial (' + r.rows + '/' + r.planned + ')', r.rows === r.planned);
    check('no row carries another trial target (' + r.wrongTarget + ')', r.wrongTarget === 0);
    check('no false timeouts when answering in 600 ms (' + r.falseTimeouts + ')', r.falseTimeouts === 0);
    check('no duplicate trial numbers (' + r.dupes + ')', r.dupes === 0);
    await p.close();
  }

  // 2 -------------------------------------------------- syntactic double click
  console.log('\n=== 2. SyntacticPriming double click ===');
  {
    const p = await page();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const r = await p.evaluate(async () => {
      SyntacticPriming.open(); SyntacticPriming.start();
      const nap = ms => new Promise(x => setTimeout(x, ms));
      SyntacticPriming.primeDone();
      await nap(50);
      const btns = document.getElementById('syntactic-options').querySelectorAll('button');
      // hammer the same option five times, the way an impatient participant does
      btns[0].click(); btns[0].click(); btns[0].click();
      if (btns[1]) btns[1].click();
      btns[0].click();
      await nap(400);
      return {
        recorded: SyntacticPriming.state.results.length,
        disabled: Array.from(btns).every(x => x.disabled)
      };
    });
    check('five clicks record exactly one item (' + r.recorded + ')', r.recorded === 1);
    check('options disable after the first click', r.disabled);
    check('no exception thrown', errs.length === 0, errs[0]);
    await p.close();
  }

  // 3 -------------------------------------------------- repetition double submit
  console.log('\n=== 3. RepetitionPriming double submit ===');
  {
    const p = await page();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const r = await p.evaluate(async () => {
      RepetitionPriming.timing = { study_ms: 20, iti_ms: 400 };
      RepetitionPriming.open(); RepetitionPriming.start();
      const nap = ms => new Promise(x => setTimeout(x, ms));
      // skip the study phase quickly
      for (let i = 0; i < 20; i++) {
        if (document.getElementById('repetition-study').style.display !== 'block') break;
        const btn = document.getElementById('repetition-scale').querySelector('button');
        if (btn) btn.click();
        await nap(30);
      }
      RepetitionPriming.beginTest();
      await nap(60);
      const it = RepetitionPriming.state.testList[RepetitionPriming.state.currentIndex];
      document.getElementById('repetition-answer').value = it.word;
      // Enter and the button, back to back
      RepetitionPriming.submitAnswer();
      RepetitionPriming.submitAnswer();
      RepetitionPriming.skipAnswer();
      await nap(120);
      const res = RepetitionPriming.state.results;
      return { recorded: res.length, firstWord: res[0] ? res[0].word : null,
               dupes: res.length - new Set(res.map(x => x.word)).size };
    });
    check('three submissions record exactly one fragment (' + r.recorded + ')', r.recorded === 1);
    check('no duplicate fragment rows (' + r.dupes + ')', r.dupes === 0);
    check('no exception thrown', errs.length === 0, errs[0]);
    await p.close();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
