// What happens to a run when the database cannot be reached.
//
// On 2026-08-12 the Supabase project this platform points at stopped resolving
// in DNS. Every run on the live site was being discarded: the engine logged to
// the console, the participant saw a normal results screen, and the trials were
// gone. Four builders were simultaneously reporting "Connected - Data will be
// saved automatically", because they checked that the client object existed
// rather than asking the database anything.
//
// These tests hold that shut. They do not need a working database - they need a
// BROKEN one, so each case forces the failure and checks what the user is told.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/data_rescue.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

// The rescue path deliberately logs the failure it is rescuing, so those lines
// are the code working, not the page breaking.
const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|PTA: Error saving|PTA: Supabase not initialized|PTA Engine: Failed to save|PTA: Exception saving/i;

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
  page._errs = errs;
  return page;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files']
  });

  /* ---------------------------------------------------------------- */
  console.log('\n[a batch save that fails is rescued, not swallowed]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.removeItem('ptbx_unsaved_index'); });

    const r = await page.evaluate(async () => {
      // a client that always fails, exactly as an unreachable project behaves
      PTA.supabase = { from: () => ({ insert: async () => ({ error: { message: 'getaddrinfo ENOTFOUND' } }) }) };
      const rows = [
        { trial: 1, rt: 500, condition: 'related' },
        { trial: 2, rt: 520, condition: 'unrelated' }
      ];
      const res = await PTA.saveAllResults('experiment_results', rows, { experimentName: 'Test design' });
      const panel = document.getElementById('pta-unsaved-panel');
      const idx = JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]');
      return {
        returnedError: !!res.error,
        panelShown: !!panel,
        panelText: panel ? panel.innerText.replace(/\s+/g, ' ') : '',
        hasButton: !!(panel && panel.querySelector('button')),
        stored: idx.length,
        storedRows: idx.length ? (JSON.parse(localStorage.getItem(idx[idx.length - 1].key) || '{}').rows || []).length : 0
      };
    });

    ok('saveAllResults still returns the error to its caller', r.returnedError);
    ok('a warning panel appears on screen', r.panelShown);
    ok('the panel says the data was NOT saved', /not saved/i.test(r.panelText), r.panelText.slice(0, 120));
    ok('the panel offers a download button', r.hasButton);
    ok('a local copy is kept', r.stored >= 1, 'index entries: ' + r.stored);
    ok('the local copy holds every row', r.storedRows === 2, 'rows: ' + r.storedRows);
    ok('no page errors', page._errs.length === 0, page._errs.join(' | '));
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[one failed run produces one panel, not one per caller]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.removeItem('ptbx_unsaved_index'); });
    const r = await page.evaluate(async () => {
      PTA.supabase = null;                       // no client at all
      const rows = [{ trial: 1, rt: 500 }];
      await PTA.saveAllResults('experiment_results', rows, { experimentName: 'X' });
      PTA.rescueUnsavedResults(rows, { experimentName: 'X' });   // a second caller
      PTA.rescueUnsavedResults(rows, { experimentName: 'X' });   // and a third
      return {
        panels: document.querySelectorAll('#pta-unsaved-panel').length,
        stored: JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]').length
      };
    });
    ok('exactly one panel', r.panels === 1, String(r.panels));
    ok('exactly one stored copy', r.stored === 1, String(r.stored));
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[per-trial failures are collected into one panel]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.removeItem('ptbx_unsaved_index'); });
    const r = await page.evaluate(async () => {
      PTA.supabase = null;
      for (let i = 1; i <= 12; i++) PTA.saveToSupabase({ trial: i, rt: 400 + i });
      await new Promise(res => setTimeout(res, 2400));            // past the 1800ms debounce
      const panel = document.getElementById('pta-unsaved-panel');
      const idx = JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]');
      return {
        panels: document.querySelectorAll('#pta-unsaved-panel').length,
        text: panel ? panel.innerText.replace(/\s+/g, ' ') : '',
        storedRows: idx.length ? (JSON.parse(localStorage.getItem(idx[idx.length - 1].key) || '{}').rows || []).length : 0
      };
    });
    ok('twelve failed trials give one panel, not twelve', r.panels === 1, String(r.panels));
    ok('the panel counts all twelve', /12 trials/.test(r.text), r.text.slice(0, 120));
    ok('all twelve are in the local copy', r.storedRows === 12, String(r.storedRows));
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[a stranded run can be recovered later]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.removeItem('ptbx_unsaved_index'); });
    const r = await page.evaluate(async () => {
      localStorage.removeItem('ptbx_unsaved_index');
      PTA.supabase = null;
      await PTA.saveAllResults('experiment_results', [{ trial: 1, rt: 1 }, { trial: 2, rt: 2 }]);
      const list = PTA.listUnsavedResults();
      return { n: list.length, entry: list[0] || null, api: typeof PTA.downloadUnsavedResults };
    });
    ok('listUnsavedResults finds it', r.n === 1, String(r.n));
    ok('the entry records how many trials', r.entry && r.entry.n === 2, JSON.stringify(r.entry));
    ok('downloadUnsavedResults exists', r.api === 'function');
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[the experiment name cannot inject markup into the panel]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.removeItem('ptbx_unsaved_index'); });
    const r = await page.evaluate(async () => {
      PTA.supabase = null;
      window.__pwned = false;
      await PTA.saveAllResults('experiment_results', [{ trial: 1 }], {
        experimentName: '<img src=x onerror="window.__pwned=true">',
        reason: '<script>window.__pwned=true</script>'
      });
      await new Promise(res => setTimeout(res, 400));
      const panel = document.getElementById('pta-unsaved-panel');
      return {
        pwned: window.__pwned,
        imgs: panel ? panel.querySelectorAll('img,script').length : -1
      };
    });
    ok('nothing executed', r.pwned === false);
    ok('no element was created from the name', r.imgs === 0, String(r.imgs));
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[no builder claims "Connected" without asking the database]');
  {
    // Each of these five owns a connection indicator. With a client that exists
    // but always errors - which is exactly an unreachable project - none of them
    // may report success.
    const CASES = [
      ['stroop', 'stroop', 'connection-status'],
      ['semantic', 'semantic', 'semantic-connection-status'],
      ['amp', 'amp', 'amp-connection-status'],
      ['number-priming', 'number-priming', 'np-connection-status'],
      ['subliminal', 'subliminal', 'subliminal-connection-status']
    ];
    const MOD = { stroop: 'Stroop', semantic: 'Semantic', amp: 'AMP',
                  'number-priming': 'NumberPriming', subliminal: 'Subliminal' };

    for (const [name, key, statusId] of CASES) {
      const page = await newPage(browser);
      await page.goto(INDEX + '?open=' + key, { waitUntil: 'networkidle2' });
      const r = await page.evaluate(async (statusId, modName) => {
        PTA.supabase = { from: () => ({ select: () => ({ limit: async () => ({ error: { message: 'ENOTFOUND' } }) }) }) };
        const m = window[modName];
        if (!m || typeof m.testConnection !== 'function') return { missing: true };
        await m.testConnection();
        await new Promise(res => setTimeout(res, 300));
        const el = document.getElementById(statusId);
        return { missing: false, text: el ? el.innerText.replace(/\s+/g, ' ') : '(no element ' + statusId + ')' };
      }, statusId, MOD[key]);

      if (r.missing) { ok(name + ': has a testConnection', false); }
      else {
        ok(name + ': does not claim to be connected', !/^connected|>connected/i.test(r.text.trim()) && !/\bConnected\b\s*-\s*Data will be saved/i.test(r.text), r.text.slice(0, 110));
        ok(name + ': says the data will not be stored', /not connected|not be (stored|saved)/i.test(r.text), r.text.slice(0, 110));
      }
      await page.close();
    }
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[the CSV keeps columns that only later rows have]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.removeItem('ptbx_unsaved_index'); });
    const r = await page.evaluate(() => {
      let captured = null;
      const realCreate = document.createElement.bind(document);
      document.createElement = function (t) {
        const el = realCreate(t);
        if (t === 'a') { el.click = function () { captured = el.download; }; }
        return el;
      };
      const realBlob = window.Blob;
      let text = '';
      window.Blob = function (parts, o) { text = parts.join(''); return new realBlob(parts, o); };
      PTA.exportToCSV([{ trial: 1, rt: 500 }, { trial: 2, rt: 600, timeout: true }], 'x.csv');
      window.Blob = realBlob;
      document.createElement = realCreate;
      return { header: text.split('\n')[0], captured: captured };
    });
    ok('a column present only in row 2 survives', /timeout/.test(r.header), r.header);
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[no module bails out before the rescue can run]');
  {
    // The first version of the rescue path was unreachable in four modules.
    // Each of them opened saveResults with `if (!window.PTA || !PTA.supabase)
    // { console.log(...); return; }` - so the one case the rescue exists for,
    // no client at all, returned before reaching it. Found by reading the code,
    // not by any test, which is why this test exists.
    const MODULES = [
      ['amp', 'AMP', 'results'],
      ['subliminal', 'Subliminal', 'results'],
      ['number-priming', 'NumberPriming', 'results'],
      ['evaluative', 'EvaluativeConditioning', 'testResults']
    ];
    for (const [key, global, resultsKey] of MODULES) {
      const page = await newPage(browser);
      await page.goto(INDEX + '?open=' + key, { waitUntil: 'networkidle2' });
      await page.evaluate(() => { localStorage.removeItem('ptbx_unsaved_index'); });
      const r = await page.evaluate(async (g, rk) => {
        PTA.supabase = null;                       // the exact case that used to bail
        const m = window[g];
        if (!m || typeof m.saveResults !== 'function') return { missing: true };
        // give the module a run to save
        m.state[rk] = [{ trial: 1, rt: 400, response: 'a' }, { trial: 2, rt: 420, response: 'b' }];
        if (rk === 'testResults') m.state.learningResults = [];
        try { await m.saveResults(); } catch (e) { return { threw: e.message }; }
        await new Promise(res => setTimeout(res, 2400));
        const idx = JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]');
        return {
          missing: false,
          panel: !!document.getElementById('pta-unsaved-panel'),
          stored: idx.length,
          rows: idx.length ? (JSON.parse(localStorage.getItem(idx[idx.length - 1].key) || '{}').rows || []).length : 0
        };
      }, global, resultsKey);

      if (r.missing) ok(key + ': has a saveResults', false);
      else if (r.threw) ok(key + ': saveResults does not throw with no client', false, r.threw);
      else {
        ok(key + ': the run reaches the rescue instead of bailing', r.stored >= 1, 'stored=' + r.stored);
        ok(key + ': the participant is shown the warning', r.panel);
        ok(key + ': every row is kept', r.rows >= 2, 'rows=' + r.rows);
      }
      await page.close();
    }
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
