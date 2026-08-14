// Where and when the participant actually sat down.
//
// Found 2026-08-14, when Shir asked which participants were not her and whether
// the data said what country anyone was in. It said neither. Worse, it did not
// even say what DAY people took part: `created_at` is a server DEFAULT now(),
// so all 241 pilot rows read 23 December 2025 - the insert date. The genuine
// session times were recoverable only because participant IDs happen to encode
// Date.now() in base 36, which is an accident of the ID generator. Decoded, the
// five real sittings span 30 November to 23 December 2025, four separate days.
//
// sql/add_timezone_columns.sql adds client_timezone, client_utc_offset and
// client_started_at to all three result tables (applied to the live project on
// 2026-08-14). These tests hold the client half: every save path stamps them,
// no paradigm has to remember to, and - the part that could have cost a whole
// run - the per-trial path now survives a project where that SQL has NOT been
// run, instead of having every insert rejected with PGRST204.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/client_timezone.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|PTA: Error saving|PTA: Supabase not initialized|PTA Engine: Failed to save|PTA: Exception saving|PTA: too many unknown|PTA: saved|has no column/i;

const KEYS = ['client_timezone', 'client_utc_offset', 'client_started_at'];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files']
  });

  async function page(tz) {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    if (tz) await p.emulateTimezone(tz);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    p._errs = errs;
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    await p.evaluate(() => localStorage.removeItem('ptbx_unsaved_index'));
    return p;
  }

  console.log('\n[the browser is asked, and it answers with a real zone]');
  {
    // Chrome is told it is in Jerusalem, so a pass here means the value tracks
    // the machine rather than being a constant somebody typed in.
    const p = await page('Asia/Jerusalem');
    const r = await p.evaluate(() => PTA.clientContext());
    ok('the timezone is the one the browser is in', r.client_timezone === 'Asia/Jerusalem', String(r.client_timezone));
    ok('the offset is a number', typeof r.client_utc_offset === 'number', typeof r.client_utc_offset);
    ok('and it matches that zone (UTC+2 or +3)', r.client_utc_offset === -120 || r.client_utc_offset === -180, String(r.client_utc_offset));
    ok('the client time parses as a date', !isNaN(Date.parse(r.client_started_at)), String(r.client_started_at));
    ok('and it is not the epoch or the far future',
       Math.abs(Date.parse(r.client_started_at) - Date.now()) < 5 * 60 * 1000, String(r.client_started_at));
    await p.close();
  }

  console.log('\n[a different machine gives a different answer]');
  {
    const p = await page('America/New_York');
    const r = await p.evaluate(() => PTA.clientContext());
    ok('the zone follows the machine', r.client_timezone === 'America/New_York', String(r.client_timezone));
    ok('so does the offset', r.client_utc_offset === 300 || r.client_utc_offset === 240, String(r.client_utc_offset));
    await p.close();
  }

  console.log('\n[stamping never overwrites what a caller already decided]');
  {
    const p = await page('Asia/Jerusalem');
    const r = await p.evaluate(() => {
      const one = PTA.stampClientContext({ rt: 300 });
      const kept = PTA.stampClientContext({ rt: 300, client_timezone: 'Europe/Berlin' });
      const many = PTA.stampClientContext([{ rt: 1 }, { rt: 2 }, { rt: 3 }]);
      const orig = { rt: 300 };
      PTA.stampClientContext(orig);
      return {
        one: one.client_timezone,
        keptZone: kept.client_timezone,
        keptOffset: typeof kept.client_utc_offset,
        manyAll: many.every(x => x.client_timezone === 'Asia/Jerusalem'),
        manyRts: many.map(x => x.rt).join(','),
        isArray: Array.isArray(many),
        mutatedOriginal: 'client_timezone' in orig,
        realDataKept: one.rt
      };
    });
    ok('a bare row gets the zone', r.one === 'Asia/Jerusalem', String(r.one));
    ok('a zone the caller set is left alone', r.keptZone === 'Europe/Berlin', String(r.keptZone));
    ok('the other fields still fill in', r.keptOffset === 'number', r.keptOffset);
    ok('every row of a batch is stamped', r.manyAll === true);
    ok('an array stays an array', r.isArray === true);
    ok('the real data is untouched', r.manyRts === '1,2,3' && r.realDataKept === 300, r.manyRts);
    ok('the caller\'s own object is not mutated', r.mutatedOriginal === false);
    await p.close();
  }

  console.log('\n[both save paths carry it, so no paradigm has to remember]');
  {
    const p = await page('Asia/Jerusalem');
    const r = await p.evaluate(async () => {
      const seen = [];
      PTA.supabase = {
        from: () => ({
          insert: (rows) => {
            seen.push(rows);
            return Promise.resolve({ data: rows });
          }
        })
      };
      await PTA.saveAllResults('experiment_results', [{ trial_number: 1, rt: 300 },
                                                      { trial_number: 2, rt: 320 }]);
      PTA.saveToSupabase({ trial_number: 3, rt: 340 });
      await new Promise(r2 => setTimeout(r2, 60));
      const batch = seen[0], single = seen[1];
      return {
        batchRows: batch.length,
        batchStamped: batch.every(x => x.client_timezone === 'Asia/Jerusalem' &&
                                       typeof x.client_utc_offset === 'number' &&
                                       !!x.client_started_at),
        singleStamped: !!single.client_timezone && !!single.client_started_at,
        singleZone: single.client_timezone,
        trialNumbersIntact: batch.map(x => x.trial_number).join(',') + '|' + single.trial_number
      };
    });
    ok('the batch path stamps every row', r.batchStamped === true);
    ok('nothing is dropped from the batch', r.batchRows === 2, String(r.batchRows));
    ok('the per-trial path stamps too', r.singleStamped === true, String(r.singleZone));
    ok('the trials themselves are unchanged', r.trialNumbersIntact === '1,2|3', r.trialNumbersIntact);
    ok('no page errors', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[a project without the new columns loses the columns, not the trial]');
  {
    // This is the failure the change could have caused. Before today the
    // per-trial path had no PGRST204 recovery at all, so adding three fields to
    // its payload would have made every Stroop trial fail on any project where
    // sql/add_timezone_columns.sql had not been run.
    const p = await page('Asia/Jerusalem');
    const r = await p.evaluate(async () => {
      const seen = [];
      PTA.supabase = {
        from: () => ({
          insert: (row) => {
            seen.push(Object.keys(row));
            for (const c of ['client_timezone', 'client_utc_offset', 'client_started_at']) {
              if (c in row) {
                return Promise.resolve({ error: { code: 'PGRST204',
                  message: "Could not find the '" + c + "' column of 'experiment_results' in the schema cache" } });
              }
            }
            return Promise.resolve({ data: [row] });
          }
        })
      };
      PTA.saveToSupabase({ trial_number: 1, rt: 300 });
      await new Promise(r2 => setTimeout(r2, 120));
      const attemptsFirst = seen.length;
      PTA.saveToSupabase({ trial_number: 2, rt: 320 });
      await new Promise(r2 => setTimeout(r2, 120));
      return {
        attemptsFirst,
        attemptsSecond: seen.length - attemptsFirst,
        finalKeys: seen[seen.length - 1],
        buffered: JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]').length,
        panel: !!document.getElementById('pta-unsaved-panel')
      };
    });
    ok('it retries once per missing column, then succeeds', r.attemptsFirst === 4, String(r.attemptsFirst));
    ok('the trial data survives', r.finalKeys.includes('trial_number') && r.finalKeys.includes('rt'), JSON.stringify(r.finalKeys));
    ok('no client column is left in the payload', KEYS.every(k => !r.finalKeys.includes(k)), JSON.stringify(r.finalKeys));
    ok('the next trial does not repeat the round trips', r.attemptsSecond === 1, String(r.attemptsSecond));
    ok('nothing is treated as an unsaved trial', r.buffered === 0, String(r.buffered));
    ok('and no rescue panel is shown', r.panel === false);
    await p.close();
  }

  console.log('\n[a genuine failure is still rescued, not swallowed by the retry]');
  {
    const p = await page('Asia/Jerusalem');
    const r = await p.evaluate(async () => {
      let n = 0;
      PTA.supabase = {
        from: () => ({
          insert: () => {
            n++;
            return Promise.resolve({ error: { code: '42501', message: 'new row violates row-level security policy' } });
          }
        })
      };
      PTA.saveToSupabase({ trial_number: 9, rt: 300 });
      await new Promise(r2 => setTimeout(r2, 120));
      const held = PTA._failedTrials.length;
      // the buffer debounces for 1.8s before it writes; a run that ends sooner
      // flushes explicitly, so do what a paradigm does rather than waiting
      PTA.flushFailedTrials();
      return { attempts: n, held,
               buffered: JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]').length };
    });
    ok('a real error is not retried', r.attempts === 1, String(r.attempts));
    ok('the trial is held for rescue', r.held === 1, String(r.held));
    ok('and it reaches localStorage on flush', r.buffered === 1, String(r.buffered));
    await p.close();
  }

  console.log('\n[the retry loop is bounded]');
  {
    const p = await page('Asia/Jerusalem');
    const r = await p.evaluate(async () => {
      let n = 0;
      PTA.supabase = {
        from: () => ({
          insert: () => {
            n++;
            return Promise.resolve({ error: { code: 'PGRST204',
              message: "Could not find the 'col" + n + "' column of 'experiment_results' in the schema cache" } });
          }
        })
      };
      PTA.saveToSupabase({ trial_number: 1, rt: 300 });
      await new Promise(r2 => setTimeout(r2, 200));
      const held = PTA._failedTrials.length;
      PTA.flushFailedTrials();
      return { attempts: n, held,
               buffered: JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]').length };
    });
    ok('it gives up after a bounded number of attempts', r.attempts <= 5, String(r.attempts));
    ok('and the trial is still rescued', r.held === 1 && r.buffered === 1,
       'held=' + r.held + ' buffered=' + r.buffered);
    await p.close();
  }

  console.log('\n[an old browser without Intl still saves the trial]');
  {
    const p = await page('Asia/Jerusalem');
    const r = await p.evaluate(() => {
      const real = window.Intl;
      // eslint-disable-next-line no-global-assign
      delete window.Intl;
      let ctx, threw = null;
      try { ctx = PTA.clientContext(); } catch (e) { threw = e.message; }
      window.Intl = real;
      return { threw, ctx };
    });
    ok('no exception without Intl', r.threw === null, String(r.threw));
    ok('the zone is simply missing', r.ctx.client_timezone === null, String(r.ctx.client_timezone));
    ok('the offset still works', typeof r.ctx.client_utc_offset === 'number', typeof r.ctx.client_utc_offset);
    ok('and so does the timestamp', !isNaN(Date.parse(r.ctx.client_started_at)));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
