// A blank Prime cell is a real design, and it must actually run.
//
// Step 4 of the builder offers, in its own help text, "a neutral prime, a row
// of Xs, or no prime at all" as the baseline. No prime at all is the cleanest C
// there is: identical timing, nothing shown.
//
// It did not work. uniq() drops the empty string, so indexOf('') was -1 and
// every blank-prime row was discarded by the pairing filter. Silently - and
// that is the part that matters. `conditions` is collected from the rows BEFORE
// the filter, so the config went on advertising a "no-prime" condition while
// running zero no-prime trials, and the A/S/M check, seeing a baseline
// condition, reported modulation satisfied. A design that claims a control
// condition it never runs is worse than one that has no control at all.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/no_prime_baseline.test.js
const puppeteer = require('puppeteer');

const SCRATCH = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/build/from-scratch.html';
const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}
const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|platform_events|PTA:/i;

async function builderWithBlankPrime(browser) {
  const p = await browser.newPage();
  await p.setCacheEnabled(false);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
  await p.goto(SCRATCH, { waitUntil: 'networkidle2' });
  await p.evaluate(() => localStorage.removeItem('ptbx_scratch_draft_fab'));
  await p.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 500));
  // the worked example, then blank the last row's prime and call it the baseline
  await p.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .find(b => /worked example/i.test(b.textContent)).click();
  });
  await new Promise(r => setTimeout(r, 400));
  await p.evaluate(() => {
    const rows = Array.from(document.getElementById('sb-rows').querySelectorAll('tr'))
      .filter(tr => tr.querySelectorAll('input').length >= 3);   // skip the header
    const cells = rows[rows.length - 1].querySelectorAll('input');
    cells[0].value = '';                                    // Prime: blank on purpose
    cells[0].dispatchEvent(new Event('input', { bubbles: true }));
    cells[2].value = 'no-prime';                            // Condition
    cells[2].dispatchEvent(new Event('input', { bubbles: true }));
  });
  p._errs = errs;
  return p;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });

  console.log('\n[a blank prime survives into the config]');
  const p = await builderWithBlankPrime(browser);
  const cfg = await p.evaluate(() => {
    const c = window.ScratchBuilder.buildConfig();
    const noPrime = c.trials.pairings.filter(x => x.condition === 'no-prime');
    return {
      pairings: c.trials.pairings.length,
      primes: c.primes.items,
      conditions: c.conditions,
      noPrimeTrials: noPrime.length,
      noPrimeIndexValid: noPrime.every(x => x.primeIndex >= 0),
      primeAtThatIndex: noPrime.length ? c.primes.items[noPrime[0].primeIndex] : null
    };
  });
  ok('every row runs, none dropped', cfg.pairings === 8, String(cfg.pairings));
  ok('the empty prime is a real entry', cfg.primes.indexOf('') !== -1, JSON.stringify(cfg.primes));
  ok('the no-prime trials exist', cfg.noPrimeTrials > 0, String(cfg.noPrimeTrials));
  ok('their primeIndex resolves', cfg.noPrimeIndexValid);
  ok('and it points at the blank prime', cfg.primeAtThatIndex === '', JSON.stringify(cfg.primeAtThatIndex));

  console.log('\n[nothing may vanish quietly]');
  const warned = await p.evaluate(() => {
    // blank a TARGET, which genuinely cannot run, and check we are told
    const rows = Array.from(document.getElementById('sb-rows').querySelectorAll('tr'))
      .filter(tr => tr.querySelectorAll('input').length >= 3);
    const cells = rows[0].querySelectorAll('input');
    cells[1].value = '';
    cells[1].dispatchEvent(new Event('input', { bubbles: true }));
    Array.from(document.querySelectorAll('button'))
      .find(b => /link/i.test(b.textContent)).click();
    const m = document.getElementById('sb-msg');
    return m ? m.textContent : '';
  });
  ok('a row that cannot run is reported, not dropped in silence',
     /rows but only|can run/i.test(warned), warned.slice(0, 140));
  ok('the message explains a blank Prime is allowed',
     /blank on purpose|no-prime baseline/i.test(warned), warned.slice(0, 200));

  console.log('\n[a condition that runs no trials is caught]');
  const phantom = await p.evaluate(() => {
    const rows = Array.from(document.getElementById('sb-rows').querySelectorAll('tr'))
      .filter(tr => tr.querySelectorAll('input').length >= 3);
    // name a condition on a row whose target is blank: it can never run
    const cells = rows[0].querySelectorAll('input');
    cells[2].value = 'ghost-condition';
    cells[2].dispatchEvent(new Event('input', { bubbles: true }));
    Array.from(document.querySelectorAll('button'))
      .find(b => /link/i.test(b.textContent)).click();
    const m = document.getElementById('sb-msg');
    return m ? m.textContent : '';
  });
  ok('a phantom condition is named and refused',
     /ghost-condition/.test(phantom) || /no trial actually runs/i.test(phantom), phantom.slice(0, 200));
  ok('builder page: no errors', p._errs.length === 0, p._errs.join(' | '));
  await p.close();

  console.log('\n[it runs as a real trial for the participant]');
  {
    const b2 = await builderWithBlankPrime(browser);
    const link = await b2.evaluate(() => {
      const cfg = window.ScratchBuilder.buildConfig();
      cfg.data = { save_to_supabase: false };
      const enc = (window.PTK && PTK.encode) ? PTK.encode(cfg)
                : btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
      return new URL('../index.html', location.href).href + '?config=' + encodeURIComponent(enc);
    });
    await b2.close();

    const pp = await browser.newPage();
    await pp.setCacheEnabled(false);
    const errs = [];
    pp.on('pageerror', e => errs.push(e.message));
    pp.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    await pp.goto(link, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1800));
    await pp.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button'))
        .find(x => /start|begin/i.test(x.innerText) && x.offsetParent !== null);
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    let rows = 0;
    for (let i = 0; i < 200 && rows < 16; i++) {
      await pp.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowLeft');
      await new Promise(r => setTimeout(r, 400));
      rows = await pp.evaluate(() => {
        const E = window.PTA && PTA.Engine;
        return (E && E.state && E.state.results) ? E.state.results.length : 0;
      });
    }
    const got = await pp.evaluate(() => {
      const rs = (PTA.Engine.state.results || []);
      return {
        total: rs.length,
        conditions: Array.from(new Set(rs.map(r => r.condition))),
        noPrimeRows: rs.filter(r => r.condition === 'no-prime').length,
        noPrimeHasBlankPrime: rs.filter(r => r.condition === 'no-prime').every(r => !r.prime),
        noPrimeHasRT: rs.filter(r => r.condition === 'no-prime').every(r => typeof r.rt === 'number')
      };
    });
    ok('the participant ran all 16 trials', got.total === 16, String(got.total));
    ok('no-prime trials were actually presented', got.noPrimeRows > 0, String(got.noPrimeRows));
    ok('their prime is blank in the data', got.noPrimeHasBlankPrime);
    ok('they carry a reaction time like any other trial', got.noPrimeHasRT);
    ok('all four conditions reach the results', got.conditions.length === 4, got.conditions.join(','));
    ok('participant page: no errors', errs.length === 0, errs.join(' | '));
    await pp.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
