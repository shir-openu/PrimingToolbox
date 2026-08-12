// The definition check is the platform's whole claim. It has to be capable of
// saying no.
//
// ASSOCIATION COULD NEVER FAIL. checkAssociation passes when
// `condCount >= 2 || primeGroups >= 2`, and primeGroups was
// Object.keys(config.primes).length. Every config this toolbox builds writes
// primes as {type:'text', items:[...]}, so that is 2 for EVERY design, the
// branch always won, and the warn branch was unreachable. Measured before the
// fix: "ok" for a design with one condition, and "ok" for a design with no
// conditions at all. A green light nothing had earned.
//
// AND THE REPORT VANISHED FOR THE PEOPLE WHO NEEDED IT. runCheck rendered the
// report into #sb-report and then called answerUnsure, which - when any
// characteristic was left on "not sure" - calls SB.repaint() and rebuilds the
// page, replacing that panel with an empty one. So the students honest enough
// to say they were not sure, which is the entire reason that option exists,
// were the only ones who never saw the report. Measured at zero characters.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/definition_check.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';
const SCRATCH = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/build/from-scratch.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}
const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|platform_events|PTA:/i;

const BASE = {
  name: 'x',
  primes: { type: 'text', items: ['DOCTOR', 'BREAD'] },
  targets: { type: 'text', items: ['NURSE', 'BUTTER'] },
  trials: { pairings: [{ primeIndex: 0, targetIndex: 0, condition: 'related' }], repetitions: 1 },
  response: { keys: { word: 'ArrowRight' } }
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });

  console.log('\n[association can fail, and does]');
  {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await p.evaluate((base) => {
      const assoc = (cfg) => PTA.validateASM(cfg).checks
        .filter(c => c.characteristic === 'association').map(c => c.status)[0];

      const one = JSON.parse(JSON.stringify(base)); one.conditions = ['related'];
      const none = JSON.parse(JSON.stringify(base));
      const two = JSON.parse(JSON.stringify(base)); two.conditions = ['related', 'unrelated'];
      const three = JSON.parse(JSON.stringify(base)); three.conditions = ['related', 'unrelated', 'neutral'];
      // the OLDER shape, where the prime GROUPS are the conditions - must still pass
      const grouped = JSON.parse(JSON.stringify(base));
      delete grouped.conditions;
      grouped.primes = { related: ['DOCTOR'], unrelated: ['TABLE'] };
      return {
        one: assoc(one), none: assoc(none), two: assoc(two),
        three: assoc(three), grouped: assoc(grouped)
      };
    }, BASE);

    ok('one condition WARNS', r.one === 'warn', String(r.one));
    ok('no conditions at all WARNS', r.none === 'warn', String(r.none));
    ok('two conditions pass', r.two === 'ok', String(r.two));
    ok('three conditions pass', r.three === 'ok', String(r.three));
    ok('the older named-prime-group shape still passes', r.grouped === 'ok', String(r.grouped));
    await p.close();
  }

  console.log('\n[the other two characteristics still behave]');
  {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await p.evaluate((base) => {
      const get = (cfg, ch) => PTA.validateASM(cfg).checks
        .filter(c => c.characteristic === ch).map(c => c.status);

      const good = JSON.parse(JSON.stringify(base));
      good.conditions = ['related', 'unrelated'];
      good.baseline = 'neutral';

      const noBaseline = JSON.parse(JSON.stringify(good));
      delete noBaseline.baseline;

      const respondsToPrime = JSON.parse(JSON.stringify(good));
      respondsToPrime.respondToPrime = true;

      const primeIsTarget = JSON.parse(JSON.stringify(good));
      primeIsTarget.targets = { type: 'text', items: ['DOCTOR', 'BREAD'] };

      return {
        modOk: get(good, 'modulation'),
        modWarn: get(noBaseline, 'modulation'),
        secOk: get(good, 'secondariness'),
        secFail: get(respondsToPrime, 'secondariness'),
        secIdentity: get(primeIsTarget, 'secondariness')
      };
    }, BASE);

    ok('modulation passes with a baseline', r.modOk.indexOf('ok') !== -1, r.modOk.join(','));
    ok('modulation warns without one', r.modWarn.indexOf('warn') !== -1, r.modWarn.join(','));
    ok('secondariness passes when the prime is incidental', r.secOk.indexOf('ok') !== -1, r.secOk.join(','));
    ok('secondariness FAILS when the task is the prime', r.secFail.indexOf('fail') !== -1, r.secFail.join(','));
    ok('secondariness flags prime == target', r.secIdentity.some(s => s === 'fail' || s === 'warn'),
       r.secIdentity.join(','));
    await p.close();
  }

  console.log('\n["not sure" still gets a report]');
  {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    await p.goto(SCRATCH, { waitUntil: 'networkidle2' });
    await p.evaluate(() => localStorage.removeItem('ptbx_scratch_draft_fab'));
    await p.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    const r = await p.evaluate(async () => {
      Array.from(document.querySelectorAll('button'))
        .find(b => /worked example/i.test(b.textContent)).click();
      await new Promise(r => setTimeout(r, 300));
      const sel = Array.from(document.querySelectorAll('select'))
        .find(s => Array.from(s.options).some(o => o.value === 'unsure'));
      if (!sel) return { noUnsureOption: true };
      sel.value = 'unsure';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      const check = Array.from(document.querySelectorAll('button'))
        .find(b => /check|definition/i.test(b.textContent));
      if (check) check.click();
      await new Promise(r => setTimeout(r, 600));
      const panel = document.getElementById('sb-report');
      // answerUnsure repaints, so `sel` is now a DETACHED node holding the old
      // value. Re-query, or the test reports its own stale reference as a bug.
      const fresh = Array.from(document.querySelectorAll('select'))
        .filter(s => Array.from(s.options).some(o => o.value === 'unsure'));
      return {
        noUnsureOption: false,
        len: panel ? panel.innerText.trim().length : 0,
        text: panel ? panel.innerText.slice(0, 160) : '',
        stillUnsure: fresh.some(s => s.value === 'unsure')
      };
    });

    ok('the "not sure" option exists', !r.noUnsureOption);
    ok('the report is NOT wiped by the repaint', r.len > 200, 'length=' + r.len);
    ok('it names the three characteristics',
       /association/i.test(r.text) || /A.S.M/i.test(r.text), r.text.slice(0, 100));
    ok('"not sure" was answered from the design', r.stillUnsure === false, String(r.stillUnsure));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await p.close();
  }

  console.log('\n[a clean design still reports clean]');
  {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    await p.goto(SCRATCH, { waitUntil: 'networkidle2' });
    await p.evaluate(() => localStorage.removeItem('ptbx_scratch_draft_fab'));
    await p.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));
    const r = await p.evaluate(async () => {
      Array.from(document.querySelectorAll('button'))
        .find(b => /worked example/i.test(b.textContent)).click();
      await new Promise(r => setTimeout(r, 300));
      const rep = PTA.validateASM(ScratchBuilder.buildConfig());
      return { level: rep.level, statuses: rep.checks.map(c => c.characteristic + ':' + c.status) };
    });
    ok('the worked example still passes all three', r.level === 'ok', r.statuses.join(' '));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
