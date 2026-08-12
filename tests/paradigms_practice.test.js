/**
 * Coverage for the v2.0 practice block.
 *
 * This is the path that silently stalled the old harness: practice runs first,
 * its rows are deliberately kept out of results, and it ends on a "press a key
 * to begin the real trials" gate. Three things must hold, and none of them were
 * being checked:
 *   - practice rows never reach results or Supabase
 *   - the gate appears and names the right key
 *   - pressing that key starts the scored block, which then completes
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

  console.log('\n=== MaskedLexical practice -> scored handoff ===');
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.evaluateOnNewDocument(() => {
    window.__saved = [];
    const iv = setInterval(() => {
      if (window.PTA && PTA.saveToSupabase && !PTA.__patched) {
        PTA.saveToSupabase = d => { window.__saved.push(d); };
        PTA.__patched = true;
        clearInterval(iv);
      }
    }, 30);
  });
  await p.goto(INDEX, { waitUntil: 'networkidle2' });
  await sleep(800);

  const r = await p.evaluate(async () => {
    const M = MaskedLexical;
    M.practiceTrials = 3;
    M.timing = { mask_ms: 5, prime_ms: 5, target_ms: 400, iti_ms: 5 };
    M.open(); M.start();
    const nap = ms => new Promise(x => setTimeout(x, ms));

    // work through the practice block
    let practiceAnswered = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      await nap(15);
      if (!M.state.isPractice) break;
      if (M.state.awaiting) {
        const t = M.state.trials[M.state.currentTrial];
        document.dispatchEvent(new KeyboardEvent('keydown', { key: t.lexical === 'word' ? 'j' : 'f' }));
        practiceAnswered++;
      }
    }

    const box = document.getElementById('masked-display');
    const gateText = box ? box.textContent : '';
    const resultsAfterPractice = M.state.results.length;
    const savedAfterPractice = window.__saved.length;

    // the gate names the "word" key; press it
    document.dispatchEvent(new KeyboardEvent('keydown', { key: M.responseKeys.word }));
    await nap(60);
    const startedScored = !M.state.isPractice && M.state.trials.length > 0 && M.state.currentTrial === 0;

    // finish the scored block
    const t1 = Date.now();
    while (Date.now() - t1 < 40000) {
      await nap(15);
      if (document.getElementById('masked-results').style.display === 'block') break;
      if (M.state.awaiting) {
        const t = M.state.trials[M.state.currentTrial];
        document.dispatchEvent(new KeyboardEvent('keydown', { key: t.lexical === 'word' ? 'j' : 'f' }));
      }
    }

    return {
      practiceAnswered: practiceAnswered,
      gateText: gateText.replace(/\s+/g, ' ').trim(),
      resultsAfterPractice: resultsAfterPractice,
      savedAfterPractice: savedAfterPractice,
      startedScored: startedScored,
      finished: document.getElementById('masked-results').style.display === 'block',
      scoredRows: M.state.results.length,
      practiceRows: M.state.results.filter(x => x.isPractice).length,
      wordKey: M.responseKeys.word
    };
  });

  check('practice trials actually run (' + r.practiceAnswered + ')', r.practiceAnswered >= 3);
  check('practice rows stay out of results (' + r.resultsAfterPractice + ')', r.resultsAfterPractice === 0);
  check('practice rows never reach save (' + r.savedAfterPractice + ')', r.savedAfterPractice === 0);
  check('gate appears and names the key "' + r.wordKey + '"',
        /practice finished/i.test(r.gateText) && r.gateText.indexOf(r.wordKey) !== -1, r.gateText.slice(0, 90));
  check('pressing that key starts the scored block', r.startedScored);
  check('scored block completes', r.finished);
  check('scored rows recorded (' + r.scoredRows + ')', r.scoredRows > 0);
  check('no practice row leaked into the scored set (' + r.practiceRows + ')', r.practiceRows === 0);
  check('no page errors', errs.length === 0, errs[0]);

  await p.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
