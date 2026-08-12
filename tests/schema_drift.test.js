// A column the table does not have must not cost the whole run.
//
// Found 2026-08-12, after Shir restored the Supabase project. With the database
// healthy and reachable, PTA.Engine's save still failed every single time:
// it sends `experiment_name` and `timestamp`, and experiment_results has
// neither, so PostgREST rejected the entire insert with PGRST204. The generic
// engine is the path every ?config= participant link and every
// Build-From-Scratch design takes - so it had never once stored a row. The
// paradigm modules build different column sets and were unaffected, which is
// why the table still filled with 241 pilot rows and nobody saw it.
//
// PTA.saveAllResults now drops the named column and retries. These tests hold
// that behaviour, and hold the boundary: a real failure must still be rescued,
// not silently swallowed by the retry loop.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/schema_drift.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|PTA: Error saving|PTA: Supabase not initialized|PTA Engine: Failed to save|PTA: Exception saving|PTA: too many unknown|PTA: saved/i;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files']
  });

  async function page() {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    p._errs = errs;
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    await p.evaluate(() => localStorage.removeItem('ptbx_unsaved_index'));
    return p;
  }

  console.log('\n[the error message is parsed, not guessed]');
  {
    const p = await page();
    const r = await p.evaluate(() => ({
      real: PTA.missingColumnFrom({ code: 'PGRST204', message: "Could not find the 'experiment_name' column of 'experiment_results' in the schema cache" }),
      noCode: PTA.missingColumnFrom({ message: "Could not find the 'word' column of 'x' in the schema cache" }),
      otherCode: PTA.missingColumnFrom({ code: '23505', message: "Could not find the 'x' column" }),
      unrelated: PTA.missingColumnFrom({ code: 'PGRST204', message: 'something else entirely' }),
      nothing: PTA.missingColumnFrom(null)
    }));
    ok('reads the column name out of PGRST204', r.real === 'experiment_name', String(r.real));
    ok('works when supabase-js omits the code', r.noCode === 'word', String(r.noCode));
    ok('ignores a different error code', r.otherCode === null, String(r.otherCode));
    ok('ignores an unrelated PGRST204 message', r.unrelated === null, String(r.unrelated));
    ok('survives a null error', r.nothing === null, String(r.nothing));
    await p.close();
  }

  console.log('\n[one unknown column costs that column, not the run]');
  {
    const p = await page();
    const r = await p.evaluate(async () => {
      const seen = [];
      PTA.supabase = {
        from: () => ({
          insert: async (rows) => {
            seen.push(Object.keys(rows[0]));
            if ('experiment_name' in rows[0]) {
              return { error: { code: 'PGRST204', message: "Could not find the 'experiment_name' column of 'experiment_results' in the schema cache" } };
            }
            if ('trial_timestamp' in rows[0]) {
              return { error: { code: 'PGRST204', message: "Could not find the 'trial_timestamp' column of 'experiment_results' in the schema cache" } };
            }
            return { data: rows };
          }
        })
      };
      const res = await PTA.saveAllResults('experiment_results', [
        { trial_number: 1, rt: 300, experiment_name: 'X', trial_timestamp: 'T' },
        { trial_number: 2, rt: 320, experiment_name: 'X', trial_timestamp: 'T' }
      ], { experimentName: 'X' });
      return {
        error: res.error || null,
        dropped: res.droppedColumns,
        attempts: seen.length,
        finalKeys: seen[seen.length - 1],
        savedRows: res.data ? res.data.length : 0,
        panel: !!document.getElementById('pta-unsaved-panel')
      };
    });
    ok('the save eventually succeeds', !r.error, String(r.error));
    ok('both unknown columns are dropped', JSON.stringify(r.dropped) === JSON.stringify(['experiment_name', 'trial_timestamp']), JSON.stringify(r.dropped));
    ok('it took exactly three attempts', r.attempts === 3, String(r.attempts));
    ok('the real data survives', r.finalKeys.includes('trial_number') && r.finalKeys.includes('rt'), JSON.stringify(r.finalKeys));
    ok('every row is still saved', r.savedRows === 2, String(r.savedRows));
    ok('no scary panel for a save that worked', r.panel === false);
    ok('no page errors', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[a genuine failure is still rescued, not swallowed]');
  {
    const p = await page();
    const r = await p.evaluate(async () => {
      PTA.supabase = { from: () => ({ insert: async () => ({ error: { code: '42501', message: 'new row violates row-level security policy' } }) }) };
      const res = await PTA.saveAllResults('experiment_results', [{ trial_number: 1, rt: 300 }], { experimentName: 'X' });
      return { error: !!res.error, panel: !!document.getElementById('pta-unsaved-panel'), dropped: res.droppedColumns };
    });
    ok('the error is returned', r.error);
    ok('the rescue panel appears', r.panel);
    ok('nothing was dropped', JSON.stringify(r.dropped) === '[]', JSON.stringify(r.dropped));
    await p.close();
  }

  console.log('\n[the retry loop cannot spin forever]');
  {
    const p = await page();
    const r = await p.evaluate(async () => {
      let n = 0;
      PTA.supabase = {
        from: () => ({
          insert: async () => {
            n++;
            return { error: { code: 'PGRST204', message: "Could not find the 'col" + n + "' column of 'x' in the schema cache" } };
          }
        })
      };
      const row = {};
      for (let i = 1; i <= 20; i++) row['col' + i] = i;
      const res = await PTA.saveAllResults('experiment_results', [row], { experimentName: 'X' });
      return { attempts: n, error: !!res.error, panel: !!document.getElementById('pta-unsaved-panel') };
    });
    ok('it gives up after a bounded number of attempts', r.attempts <= 8, String(r.attempts));
    ok('and reports the failure', r.error);
    ok('and rescues the run', r.panel);
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
