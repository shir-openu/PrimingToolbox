/**
 * End-to-end: actually play each new paradigm to its results screen, and open a
 * real participant link. Construction passing means nothing if the trial loop
 * never reaches the end.
 */
const puppeteer = require('puppeteer');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
const check = (n, c, d) => {
  if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (d ? '  -> ' + d : '')); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.__errors = errors;
  // Supabase writes must never fire during a test run
  await page.evaluateOnNewDocument(() => {
    window.__saved = [];
    const install = () => {
      if (window.PTA && PTA.saveToSupabase && !PTA.__patched) {
        const o = PTA.saveToSupabase;
        PTA.saveToSupabase = d => { window.__saved.push(d); };
        PTA.__patched = true;
        return true;
      }
      return false;
    };
    const iv = setInterval(() => { if (install()) clearInterval(iv); }, 30);
    setTimeout(() => clearInterval(iv), 8000);
  });
  return page;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files',
           '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows']
  });

  // ---------------------------------------------------------- negative priming
  {
    console.log('\n=== NegativePriming: full run ===');
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await sleep(800);
    await page.evaluate(() => {
      NegativePriming.repetitions = 1;          // 8 pairs = 16 displays
      NegativePriming.timing = { fixation_ms: 5, display_ms: 500, iti_ms: 5 };
      NegativePriming.open(); NegativePriming.start();
    });
    for (let i = 0; i < 60; i++) {
      await sleep(45);
      const done = await page.evaluate(() =>
        document.getElementById('negative-results').style.display === 'block');
      if (done) break;
      // press the correct key by reading the green letter off the screen
      const key = await page.evaluate(() => {
        const box = document.getElementById('negative-display');
        const green = Array.from(box.querySelectorAll('div'))
          .find(d => d.style.color === 'rgb(74, 222, 128)');
        return green ? green.textContent.trim() : null;
      });
      if (key) await page.keyboard.press(key);
    }
    const r = await page.evaluate(() => ({
      done: document.getElementById('negative-results').style.display === 'block',
      n: NegativePriming.state.results.length,
      saved: window.__saved.length,
      body: document.getElementById('negative-results-body').textContent,
      acc: NegativePriming.state.results.filter(x => x.correct).length
    }));
    check('reaches the results screen', r.done);
    check('recorded every display (' + r.n + ' of 16)', r.n === 16, 'got ' + r.n);
    check('all responses correct when driven correctly (' + r.acc + '/' + r.n + ')', r.acc === r.n);
    check('every trial handed to save (' + r.saved + ')', r.saved === r.n);
    check('results report a probe effect', /Negative priming effect/.test(r.body));
    check('no page errors', page.__errors.length === 0, page.__errors[0]);
    await page.close();
  }

  // ------------------------------------------------------------ masked lexical
  {
    console.log('\n=== MaskedLexical: full run ===');
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await sleep(800);
    await page.evaluate(() => {
      MaskedLexical.timing = { mask_ms: 5, prime_ms: 5, target_ms: 400, iti_ms: 5 };
      MaskedLexical.open(); MaskedLexical.start();
    });
    for (let i = 0; i < 90; i++) {
      await sleep(35);
      const done = await page.evaluate(() =>
        document.getElementById('masked-results').style.display === 'block');
      if (done) break;
      const lex = await page.evaluate(() => {
        const m = MaskedLexical;
        if (!m.state.awaiting) return null;
        return m.state.trials[m.state.currentTrial].lexical;
      });
      if (lex) await page.keyboard.press(lex === 'word' ? 'j' : 'f');
    }
    const r = await page.evaluate(() => ({
      done: document.getElementById('masked-results').style.display === 'block',
      n: MaskedLexical.state.results.length,
      saved: window.__saved.length,
      body: document.getElementById('masked-results-body').textContent,
      wrong: MaskedLexical.state.results.filter(x => !x.correct).length
    }));
    check('reaches the results screen', r.done);
    check('recorded all 24 trials (' + r.n + ')', r.n === 24, 'got ' + r.n);
    check('no errors when driven correctly (' + r.wrong + ' wrong)', r.wrong === 0);
    check('every trial handed to save (' + r.saved + ')', r.saved === r.n);
    check('results report a masked effect', /Masked priming effect/.test(r.body));
    check('no page errors', page.__errors.length === 0, page.__errors[0]);
    await page.close();
  }

  // -------------------------------------------------------------- syntactic
  {
    console.log('\n=== SyntacticPriming: full run ===');
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await sleep(800);
    await page.evaluate(() => { SyntacticPriming.open(); SyntacticPriming.start(); });
    for (let i = 0; i < 200; i++) {
      await sleep(40);
      const state = await page.evaluate(() => {
        if (document.getElementById('syntactic-results').style.display === 'block') return 'done';
        if (document.getElementById('syntactic-prime').style.display === 'block') return 'prime';
        if (document.getElementById('syntactic-choice').style.display === 'block') return 'choice';
        return 'other';
      });
      if (state === 'done') break;
      if (state === 'prime') await page.evaluate(() => SyntacticPriming.primeDone());
      else if (state === 'choice') {
        await page.evaluate(() => {
          const b = document.getElementById('syntactic-options').querySelector('button');
          if (b) b.click();
        });
      }
    }
    const r = await page.evaluate(() => ({
      done: document.getElementById('syntactic-results').style.display === 'block',
      n: SyntacticPriming.state.results.length,
      saved: window.__saved.length,
      body: document.getElementById('syntactic-results-body').textContent,
      forms: SyntacticPriming.state.results.map(x => x.chosenForm)
    }));
    check('reaches the results screen', r.done);
    check('recorded all 8 items (' + r.n + ')', r.n === 8, 'got ' + r.n);
    check('every item handed to save (' + r.saved + ')', r.saved === r.n);
    check('reports a structure-reuse rate', /structure reuse/.test(r.body));
    check('choices are real structures', r.forms.every(f => ['do', 'po', 'active', 'passive'].includes(f)),
          JSON.stringify(r.forms));
    check('no page errors', page.__errors.length === 0, page.__errors[0]);
    await page.close();
  }

  // -------------------------------------------------------------- repetition
  {
    console.log('\n=== RepetitionPriming: full run ===');
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await sleep(800);
    await page.evaluate(() => {
      RepetitionPriming.timing = { study_ms: 50, iti_ms: 5 };
      RepetitionPriming.open(); RepetitionPriming.start();
    });
    // study phase: rate every word
    for (let i = 0; i < 30; i++) {
      await sleep(35);
      const inStudy = await page.evaluate(() =>
        document.getElementById('repetition-study').style.display === 'block');
      if (!inStudy) break;
      await page.evaluate(() => {
        const b = document.getElementById('repetition-scale').querySelector('button');
        if (b) b.click();
      });
    }
    await page.evaluate(() => RepetitionPriming.beginTest());
    // test phase: answer studied fragments correctly, leave the rest blank,
    // so the effect must come out strongly positive
    for (let i = 0; i < 40; i++) {
      await sleep(35);
      const done = await page.evaluate(() =>
        document.getElementById('repetition-results').style.display === 'block');
      if (done) break;
      await page.evaluate(() => {
        const R = RepetitionPriming;
        const it = R.state.testList[R.state.currentIndex];
        if (!it) return;
        document.getElementById('repetition-answer').value = it.studied ? it.word : '';
        R.submitAnswer();
      });
    }
    const r = await page.evaluate(() => ({
      done: document.getElementById('repetition-results').style.display === 'block',
      n: RepetitionPriming.state.results.length,
      saved: window.__saved.length,
      body: document.getElementById('repetition-results-body').textContent,
      studiedHit: RepetitionPriming.state.results.filter(x => x.studied && x.completed).length,
      unstudiedHit: RepetitionPriming.state.results.filter(x => !x.studied && x.completed).length,
      ratings: RepetitionPriming.state.studyRatings.length
    }));
    check('reaches the results screen', r.done);
    check('study phase rated all 6 words (' + r.ratings + ')', r.ratings === 6, 'got ' + r.ratings);
    check('tested all 12 fragments (' + r.n + ')', r.n === 12, 'got ' + r.n);
    check('every fragment handed to save (' + r.saved + ')', r.saved === r.n);
    check('studied completed 6, unstudied 0 (' + r.studiedHit + '/' + r.unstudiedHit + ')',
          r.studiedHit === 6 && r.unstudiedHit === 0);
    check('effect computed as 100 points', /100 percentage points/.test(r.body), r.body.slice(0, 200));
    check('no page errors', page.__errors.length === 0, page.__errors[0]);
    await page.close();
  }

  // ------------------------------------------------------- participant links
  console.log('\n=== participant links ===');
  for (const [param, tmpl, global, overlay] of [
    ['negative', 'negative-priming', 'NegativePriming', 'negative-overlay'],
    ['masked', 'masked-lexical', 'MaskedLexical', 'masked-overlay'],
    ['syntactic', 'syntactic-priming', 'SyntacticPriming', 'syntactic-overlay'],
    ['repetition', 'repetition-priming', 'RepetitionPriming', 'repetition-overlay']]) {
    const cfg = Buffer.from(JSON.stringify({
      template: tmpl, experimenterEmail: 'lab@test.org', userExperimentId: 'pilot_9'
    }), 'utf8').toString('base64');
    const page = await newPage(browser);
    await page.goto(INDEX + '?' + param + '=' + cfg, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const r = await page.evaluate((g, ov) => ({
      participant: window[g].isParticipantMode,
      open: (document.getElementById(ov) || {}).style ? document.getElementById(ov).style.display === 'block' : false,
      email: window[g].experimenterEmail,
      expId: window[g].userExperimentId,
      layoutHidden: (document.querySelector('.layout') || {}).style
        ? document.querySelector('.layout').style.display === 'none' : false
    }), global, overlay);
    check(param + ': enters participant mode', r.participant);
    check(param + ': overlay opens automatically', r.open);
    check(param + ': carries email and experiment id', r.email === 'lab@test.org' && r.expId === 'pilot_9',
          r.email + '/' + r.expId);
    check(param + ': builder UI hidden from participant', r.layoutHidden);
    await page.close();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
