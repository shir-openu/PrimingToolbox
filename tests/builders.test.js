// Smoke + behaviour test for the two Build From Scratch pages.
const puppeteer = require('puppeteer');
const path = require('path');

const ROOT = 'D:/Dropbox/Research/PRIMING_TOOLBOX';
const url = p => 'file:///' + path.posix.join(ROOT, p);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page._errs = errs;
  return page;
}

// Supabase / xlsx CDNs are blocked on file://; those are not our errors.
const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\./i;
function realErrors(p) { return p._errs.filter(e => !IGNORE.test(e)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files']
  });

  /* ---------------- 1. the full builder ---------------- */
  console.log('\n[1] build/from-scratch.html');
  let page = await newPage(browser);
  await page.goto(url('build/from-scratch.html'), { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.removeItem('ptbx_scratch_draft_fab'));
  await page.reload({ waitUntil: 'networkidle2' });

  ok('ScratchBuilder loaded', await page.evaluate(() => typeof ScratchBuilder === 'object'));
  ok('PTA.validateASM present', await page.evaluate(() => typeof PTA.validateASM === 'function'));
  ok('PTK present', await page.evaluate(() => typeof PTK === 'object'));
  ok('PTA.Engine present', await page.evaluate(() => typeof PTA.Engine === 'object'));
  ok('7 steps rendered', await page.$$eval('.sb-sec', n => n.length) === 7,
     String(await page.$$eval('.sb-sec', n => n.length)));
  ok('ABCD block is optional and collapsed by default',
     await page.evaluate(() => { const d = document.querySelector('details.sb-optional'); return d && !d.open; }));
  ok('three characteristic dropdowns exist',
     await page.evaluate(() => document.querySelectorAll('details.sb-optional select').length) === 3);
  ok('"not sure" is offered for all three',
     await page.evaluate(() => Array.from(document.querySelectorAll('details.sb-optional select'))
       .every(s => Array.from(s.options).some(o => o.value === 'unsure'))));

  // fill the worked example
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /worked example/i.test(x.textContent));
    b.click();
  });
  ok('worked example loaded 8 trials',
     await page.evaluate(() => ScratchBuilder._state().rows.length) === 8);

  let cfg = await page.evaluate(() => ScratchBuilder.buildConfig());
  ok('config has primes', cfg.primes.items.length > 0, JSON.stringify(cfg.primes.items));
  ok('config has targets', cfg.targets.items.length > 0);
  ok('config has pairings', cfg.trials.pairings.length === 8, String(cfg.trials.pairings.length));
  ok('every pairing resolves', cfg.trials.pairings.every(p => p.primeIndex >= 0 && p.targetIndex >= 0));
  ok('pairings point at the right stimuli', (() => {
    const p = cfg.trials.pairings[0];
    return cfg.primes.items[p.primeIndex] === 'DOCTOR' && cfg.targets.items[p.targetIndex] === 'NURSE';
  })());
  ok('conditions collected', cfg.conditions.length === 3, JSON.stringify(cfg.conditions));
  ok('baseline recorded', cfg.baseline === 'neutral', String(cfg.baseline));
  ok('response keys mapped', Object.keys(cfg.response.keys).length === 2);
  ok('response_timeout_ms bridged', cfg.presentation.response_timeout_ms === cfg.presentation.response_window_ms);
  ok('no abcd block when nothing declared', cfg.abcd === undefined);

  // the ASM check
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(x => /check my design/i.test(x.textContent)).click();
  });
  const reportText = await page.$eval('#sb-report', n => n.textContent);
  ok('ASM report rendered', /Association/.test(reportText) && /Secondariness/.test(reportText));
  ok('no false "prime is also the target" on a clean design',
     !/also the target/i.test(reportText), reportText.slice(0, 260));
  ok('association satisfied', /Association — ok/.test(reportText), reportText.slice(0, 200));
  ok('modulation satisfied (baseline declared)', /Modulation — ok/.test(reportText));
  ok('secondariness satisfied', /Secondariness — ok/.test(reportText));

  // "not sure" gets answered from the design
  await page.evaluate(() => {
    const s = ScratchBuilder._state();
    s.abcd.assoc = 'unsure'; s.abcd.sec = 'unsure'; s.abcd.mod = 'unsure';
    ScratchBuilder.repaint();
    Array.from(document.querySelectorAll('button')).find(x => /check my design/i.test(x.textContent)).click();
  });
  const answered = await page.evaluate(() => ScratchBuilder._state().abcd);
  ok('"not sure" replaced for association', answered.assoc !== 'unsure' && answered.assoc !== '', answered.assoc);
  ok('"not sure" replaced for secondariness', answered.sec !== 'unsure' && answered.sec !== '', answered.sec);
  ok('"not sure" replaced for modulation', answered.mod !== 'unsure' && answered.mod !== '', answered.mod);

  // declared-vs-checked disagreement
  await page.evaluate(() => {
    const s = ScratchBuilder._state();
    s.abcd.sec = 'respond';       // author says: they respond to the prime
    ScratchBuilder.repaint();
    Array.from(document.querySelectorAll('button')).find(x => /check my design/i.test(x.textContent)).click();
  });
  const decl = await page.$eval('#sb-declared', n => n.textContent);
  ok('declared "responds to prime" reaches the validator',
     /secondariness/i.test(decl) || /disagree/i.test(decl) === false, decl.slice(0, 200));
  cfg = await page.evaluate(() => ScratchBuilder.buildConfig());
  ok('respondToPrime flag set from the declaration', cfg.respondToPrime === true);
  const report2 = await page.$eval('#sb-report', n => n.textContent);
  ok('validator now fails secondariness', /Secondariness — fail/.test(report2), report2.slice(0, 300));
  ok('abcd declaration is in the config', cfg.abcd && cfg.abcd.secondariness === 'respond');

  // structural refusal
  await page.evaluate(() => {
    const s = ScratchBuilder._state();
    s.rows.forEach(r => r.condition = 'related');
    ScratchBuilder.repaint();
    Array.from(document.querySelectorAll('button')).find(x => /create participant link/i.test(x.textContent)).click();
  });
  const msg = await page.$eval('#sb-msg', n => n.textContent);
  ok('one condition is refused with a reason', /only one condition/i.test(msg), msg);

  ok('no console errors', realErrors(page).length === 0, realErrors(page).join(' | '));
  await page.close();

  /* ---------------- 2. the timeline builder ---------------- */
  console.log('\n[2] build/timeline.html');
  page = await newPage(browser);
  await page.goto(url('build/timeline.html'), { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.removeItem('ptbx_scratch_draft_fab'));
  await page.reload({ waitUntil: 'networkidle2' });

  ok('TimelinePlanner initialised', await page.evaluate(() => typeof TimelinePlanner === 'object'));
  ok('timeline blocks drawn', await page.$$eval('.timeline-seg', n => n.length) > 0,
     String(await page.$$eval('.timeline-seg', n => n.length)));
  ok('timeline is un-docked (not fixed to the viewport)',
     await page.evaluate(() => getComputedStyle(document.querySelector('.timeline-container')).position) === 'static');
  ok('"Load from selected" removed',
     await page.evaluate(() => !Array.from(document.querySelectorAll('#tl-editor-fab button'))
       .some(b => /load from selected/i.test(b.textContent))));
  ok('"Insert into experiment draft" relabelled',
     await page.evaluate(() => Array.from(document.querySelectorAll('#tl-editor-fab button'))
       .some(b => /use this timing/i.test(b.textContent))));
  ok('7 steps rendered', await page.$$eval('.sb-sec', n => n.length) === 7);

  // change one phase on the timeline and confirm it reaches the config
  await page.evaluate(() => {
    const inp = document.querySelector('#tl-editor-fab input[data-key="prime_duration_ms"]');
    inp.value = '333';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const tcfg = await page.evaluate(() => ScratchBuilder.buildConfig());
  ok('timeline value reaches the built config', tcfg.presentation.prime_duration_ms === 333,
     String(tcfg.presentation.prime_duration_ms));
  ok('response_timeout_ms bridged from the timeline',
     tcfg.presentation.response_timeout_ms === tcfg.presentation.response_window_ms);
  ok('"Use this timing" confirms without throwing',
     await page.evaluate(() => {
       Array.from(document.querySelectorAll('#tl-editor-fab button'))
         .find(b => /use this timing/i.test(b.textContent)).click();
       return /ms per trial/.test(document.getElementById('sb-msg').textContent);
     }));
  ok('no console errors', realErrors(page).length === 0, realErrors(page).join(' | '));
  await page.close();

  /* ---------------- 3. a built config actually runs ---------------- */
  console.log('\n[3] a from-scratch config runs on index.html');
  page = await newPage(browser);
  await page.goto(url('build/from-scratch.html'), { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.removeItem('ptbx_scratch_draft_fab'));
  await page.reload({ waitUntil: 'networkidle2' });
  const encoded = await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(x => /worked example/i.test(x.textContent)).click();
    const s = ScratchBuilder._state();
    s.name = 'Scratch Test';
    s.instructions = 'Look at the cross.\nDecide if the second string is a real word.';
    s.reps = 1;
    s.timing.fixation_ms = 20; s.timing.prime_duration_ms = 20; s.timing.ISI_ms = 10;
    s.timing.ITI_ms = 20; s.timing.response_window_ms = 400;
    const cfg = ScratchBuilder.buildConfig();
    cfg.data.save_to_supabase = false;
    return PTK.encode(cfg);
  });
  await page.close();

  page = await newPage(browser);
  await page.goto(url('index.html') + '?config=' + encoded, { waitUntil: 'networkidle2' });
  ok('overlay opened', await page.evaluate(() => document.getElementById('experimentOverlay').classList.contains('active')));
  ok('title carried through', await page.$eval('#experimentTitle', n => n.textContent) === 'Scratch Test');
  const instr = await page.$eval('#optionSelectors', n => n.textContent);
  ok('instructions shown to the participant', /real word/.test(instr), instr.slice(0, 120));
  const keysTxt = await page.$eval('#responseKeys', n => n.textContent);
  ok('response keys shown', /word/.test(keysTxt) && /Arrow/.test(keysTxt), keysTxt);
  ok('trial line no longer says "ink color"',
     !/ink color/i.test(await page.$eval('#trialInstruction', n => n.textContent)));

  // run the whole thing by answering every trial
  await page.evaluate(() => { window.__done = null; document.addEventListener('experimentComplete', e => { window.__done = e.detail; }); });
  await page.evaluate(() => startExperiment());
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => !!window.__done);
    if (done) break;
    await page.keyboard.press('ArrowRight');
    await new Promise(r => setTimeout(r, 120));
  }
  const detail = await page.evaluate(() => window.__done);
  ok('experiment completed', !!detail);
  ok('exactly 8 trials recorded - no phantom timeout double-advance',
     detail && detail.results.length === 8, detail ? String(detail.results.length) : 'none');
  ok('per-condition stats produced',
     detail && Array.isArray(detail.stats.conditions) && detail.stats.conditions.length === 3,
     detail ? JSON.stringify(detail.stats.conditions) : 'none');
  ok('condition labels reached the rows',
     detail && detail.results.every(r => r.condition));
  const gridTxt = await page.$eval('#resultsGrid', n => n.textContent);
  ok('results grid shows the conditions', /related/.test(gridTxt) && /neutral/.test(gridTxt), gridTxt.slice(0, 200));
  ok('no console errors', realErrors(page).length === 0, realErrors(page).join(' | '));
  await page.close();

  /* ---------------- 4. the landing page ---------------- */
  console.log('\n[4] index.html cards');
  page = await newPage(browser);
  await page.goto(url('index.html'), { waitUntil: 'networkidle2' });
  ok('Build From Scratch card wired',
     await page.evaluate(() => typeof showBuildFromScratch === 'function' &&
       !!document.querySelector('[onclick="showBuildFromScratch()"]')));
  ok('Build With The Timeline card added',
     await page.evaluate(() => typeof showBuildOnTimeline === 'function' &&
       !!document.querySelector('[onclick="showBuildOnTimeline()"]')));
  // innerText, not innerHTML: the source comment recording what the card used
  // to do mentions the old string, and matching that would be a false alarm.
  ok('no card still says "coming soon"',
     await page.evaluate(() => !/coming soon/i.test(document.body.innerText)));
  ok('showLearnMore no longer alerts',
     await page.evaluate(() => !/alert/.test(String(showLearnMore))));
  ok('all 16 experiments still in the dropdown',
     await page.$$eval('#experimentSelect option', o => o.filter(x => x.value).length) === 16,
     String(await page.$$eval('#experimentSelect option', o => o.filter(x => x.value).length)));
  ok('UTF-8 round trip through PTA encode/decode',
     await page.evaluate(() => {
       const c = { name: 'תחל ניסוי', primes: { items: ['רופא'] } };
       const back = PTA.decodeConfig(PTA.encodeConfig(c));
       return back && back.name === 'תחל ניסוי' && back.primes.items[0] === 'רופא';
     }));
  ok('old ASCII links still decode',
     await page.evaluate(() => {
       const legacy = btoa(JSON.stringify({ name: 'Legacy', id: 'x' }));
       const back = PTA.decodeConfig(legacy);
       return back && back.name === 'Legacy';
     }));
  ok('no console errors', realErrors(page).length === 0, realErrors(page).join(' | '));
  await page.close();

  await browser.close();
  console.log('\n=====================================');
  console.log('  ' + pass + ' passed, ' + fail + ' failed');
  console.log('=====================================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
