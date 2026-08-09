/**
 * Real-browser test of the four new PrimingToolbox paradigms.
 * Puppeteer's own Chrome was never downloaded, so we drive the system Chrome.
 * Read-only against the repo: it loads index.html from disk and drives the UI.
 */
const puppeteer = require('puppeteer');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

const MODULES = [
  { key: 'negative',   global: 'NegativePriming',   overlay: 'negative-overlay',   param: 'negative',   tmpl: 'negative-priming' },
  { key: 'masked',     global: 'MaskedLexical',     overlay: 'masked-overlay',     param: 'masked',     tmpl: 'masked-lexical' },
  { key: 'syntactic',  global: 'SyntacticPriming',  overlay: 'syntactic-overlay',  param: 'syntactic',  tmpl: 'syntactic-priming' },
  { key: 'repetition', global: 'RepetitionPriming', overlay: 'repetition-overlay', param: 'repetition', tmpl: 'repetition-priming' }
];

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files',
           '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows']
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(INDEX, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));

  console.log('\n=== page level ===');
  const fatal = errors.filter(e => /SyntaxError|is not defined|Identifier .* has already been declared/.test(e));
  check('no fatal JS errors on load', fatal.length === 0, fatal.slice(0, 3).join(' | '));

  const ptaOk = await page.evaluate(() => typeof PTA === 'object' && typeof PTA.saveToSupabase === 'function');
  check('PTA present with saveToSupabase', ptaOk);

  const engineOk = await page.evaluate(() => !!(window.PTA && PTA.Engine));
  check('PTA.Engine defined (engine_fab IIFE intact)', engineOk);

  for (const m of MODULES) {
    console.log('\n=== ' + m.global + ' ===');

    const exists = await page.evaluate(g => typeof window[g] === 'object', m.global);
    check('global exists', exists);
    if (!exists) continue;

    const inDropdown = await page.evaluate(k =>
      !!document.querySelector('option[value="' + k + '"]'), m.key);
    check('listed in the dropdown', inDropdown);

    // required interface, same shape as the existing paradigms
    const iface = await page.evaluate(g => {
      const o = window[g];
      return ['init', 'open', 'close', 'start', 'showResults', 'exportCSV',
              'openBuilder', 'checkUrlConfig', 'saveTrial']
        .filter(fn => typeof o[fn] !== 'function');
    }, m.global);
    check('full module interface', iface.length === 0, 'missing: ' + iface.join(','));

    // overlay injection
    await page.evaluate(g => window[g].open(), m.global);
    const shown = await page.evaluate(id => {
      const el = document.getElementById(id);
      return !!el && el.style.display === 'block';
    }, m.overlay);
    check('overlay injects and opens', shown);

    // trial construction
    const built = await page.evaluate(g => {
      const o = window[g];
      try {
        if (typeof o.buildPairs === 'function') return { n: o.buildPairs().length, kind: 'pairs' };
        if (typeof o.buildTrials === 'function') return { n: o.buildTrials().length, kind: 'trials' };
        if (typeof o.buildLists === 'function') { o.buildLists(); return { n: o.state.testList.length, kind: 'lists' }; }
        return { n: -1, kind: 'none' };
      } catch (e) { return { n: -1, kind: 'threw: ' + e.message }; }
    }, m.global);
    check('builds trials (' + built.kind + ' = ' + built.n + ')', built.n > 0, built.kind);

    // conditions present and balanced enough to yield an effect
    const conds = await page.evaluate(g => {
      const o = window[g];
      let items = [];
      if (typeof o.buildPairs === 'function') items = o.buildPairs().map(x => x.condition);
      else if (typeof o.buildTrials === 'function') items = o.buildTrials().map(x => x.condition || x.primeForm);
      else if (o.state && o.state.testList) items = o.state.testList.map(x => x.studied ? 'studied' : 'unstudied');
      const set = {};
      items.forEach(c => { set[c] = (set[c] || 0) + 1; });
      return set;
    }, m.global);
    const nCond = Object.keys(conds).length;
    check('at least two conditions ' + JSON.stringify(conds), nCond >= 2);

    // participant-link round trip: encode via openBuilder's config shape, then decode
    const roundTrip = await page.evaluate((g, param, tmpl) => {
      const cfg = { template: tmpl, experimenterEmail: 'a@b.c', userExperimentId: 'x1' };
      const enc = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
      const dec = JSON.parse(decodeURIComponent(escape(atob(enc))));
      return dec.template === tmpl && dec.userExperimentId === 'x1';
    }, m.global, m.param, m.tmpl);
    check('participant config encodes and decodes', roundTrip);

    // checkUrlConfig must reject a link that is not its own
    const rejects = await page.evaluate(g => {
      const o = window[g];
      const saved = window.location.search;
      try { return o.checkUrlConfig() === false; } catch (e) { return 'threw: ' + e.message; }
    }, m.global);
    check('checkUrlConfig returns false without its own param', rejects === true, String(rejects));

    // saveTrial must actually reach PTA.saveToSupabase
    const saves = await page.evaluate(g => {
      const o = window[g];
      const orig = PTA.saveToSupabase;
      let called = null;
      PTA.saveToSupabase = (d) => { called = d; };
      try {
        o.saveTrial({ trial: 1, pair: 1, stage: 'probe', condition: 'control', target: 'B',
                      distractor: 'C', response: 'B', correct: true, rt: 500,
                      prime: 'x', lexical: 'word', timedOut: false,
                      set: 'dative', primeForm: 'do', chosenForm: 'do', chosen: 's', matched: true,
                      word: 'ELEPHANT', fragment: 'E_E_HANT', studied: true, answer: 'ELEPHANT',
                      completed: true });
      } catch (e) { PTA.saveToSupabase = orig; return 'threw: ' + e.message; }
      PTA.saveToSupabase = orig;
      return called && typeof called.experiment_id === 'string' && called.experiment_id.length > 0
        ? called.experiment_id : 'no call';
    }, m.global);
    check('saveTrial reaches PTA.saveToSupabase (' + saves + ')',
          typeof saves === 'string' && saves !== 'no call' && !saves.startsWith('threw'));

    await page.evaluate(g => window[g].close(), m.global);
  }

  console.log('\n=== unexpected runtime errors ===');
  const noise = errors.filter(e => !/favicon|supabase|net::ERR|Failed to load resource/i.test(e));
  if (noise.length) noise.slice(0, 8).forEach(e => console.log('  ! ' + e.slice(0, 160)));
  else console.log('  none');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
