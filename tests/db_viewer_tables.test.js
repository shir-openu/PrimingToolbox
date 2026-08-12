// The viewer shows all three result tables, and says when it cannot read one.
//
// Evaluative conditioning writes to ec_results and subliminal priming writes to
// subliminal_results. db-viewer.html queried neither, so someone could run an
// evaluative-conditioning study, have every trial stored correctly, and see
// nothing on this page at all.
//
// The awkward part, and the reason the wording matters: "empty" and "not
// readable" are indistinguishable from the client. Both tables have row-level
// security on with an INSERT policy and no SELECT policy, and PostgREST answers
// a blocked read with an empty list and status 200 - not an error. A count of 0
// therefore cannot be reported as "no data" without saying what else it might
// mean.
//
// Every response here is intercepted, so this test never touches the real
// database and cannot fail because a network was slow. That also makes the
// has-rows and error branches reachable, which the live tables - both empty -
// could not exercise.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/db_viewer_tables.test.js
const puppeteer = require('puppeteer');

const PAGE = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/db-viewer.html';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

// canned answers per table, keyed by the table name in the REST path
async function openWith(browser, answers) {
  const p = await browser.newPage();
  await p.setCacheEnabled(false);
  await p.setRequestInterception(true);

  // The Supabase client sends apikey and authorization headers, which makes the
  // browser send a CORS PREFLIGHT first. Answering that OPTIONS request with
  // data and no CORS headers fails the preflight, the real request never
  // leaves, and the page renders nothing at all - which is exactly what the
  // first version of this harness did, and it looked like a product bug.
  const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-expose-headers': 'content-range'
  };

  p.on('request', req => {
    const url = req.url();
    const m = url.match(/\/rest\/v1\/([a-z_]+)\?/);
    if (!m) return req.continue();

    if (req.method() === 'OPTIONS') {
      return req.respond({ status: 204, headers: CORS, body: '' });
    }

    const table = m[1];
    const answer = answers[table];
    if (!answer) {
      return req.respond({ status: 200, contentType: 'application/json',
                           headers: CORS, body: '[]' });
    }
    if (answer.status && answer.status !== 200) {
      return req.respond({
        status: answer.status, contentType: 'application/json', headers: CORS,
        body: JSON.stringify({ message: answer.message || 'denied' })
      });
    }
    req.respond({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(answer.rows || [])
    });
  });

  await p.goto(PAGE, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  return p;
}

const text = p => p.evaluate(() =>
  ((document.getElementById('other-tables') || {}).textContent || '').replace(/\s+/g, ' ').trim());

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });

  console.log('\n[both extra tables are named at all]');
  {
    const p = await openWith(browser, {
      experiment_results: { rows: [{ participant_id: 'p1', user_experiment_id: 'e1', created_at: '2026-08-12T10:00:00Z' }] }
    });
    const t = await text(p);
    ok('the panel is rendered', t.length > 0, t.slice(0, 80));
    ok('evaluative conditioning is named', /Evaluative Conditioning/.test(t), t.slice(0, 120));
    ok('subliminal priming is named', /Subliminal Priming/.test(t), t.slice(0, 120));
    ok('the table names are given too',
       /ec_results/.test(t) && /subliminal_results/.test(t), t.slice(0, 160));
    await p.close();
  }

  console.log('\n[an empty read is not called "no data"]');
  {
    const p = await openWith(browser, {
      experiment_results: { rows: [] },
      ec_results: { rows: [] },
      subliminal_results: { rows: [] }
    });
    const t = await text(p);
    ok('it reports 0 rows', /0 rows/.test(t), t.slice(0, 140));
    ok('and says that is not the same as empty',
       /no SELECT policy/i.test(t), t.slice(0, 220));
    ok('it spells out the ambiguity',
       /empty whether it is empty or not/i.test(t), t.slice(0, 260));
    ok('it does NOT simply say no data', !/\bNo data found\b/.test(t), t.slice(0, 140));
    console.log('     ' + t.slice(0, 150));
    await p.close();
  }

  console.log('\n[a table that CAN be read is reported plainly]');
  {
    const p = await openWith(browser, {
      experiment_results: { rows: [] },
      ec_results: { rows: [{ participant_id: 'a' }, { participant_id: 'a' }, { participant_id: 'b' }] },
      subliminal_results: { rows: [] }
    });
    const t = await text(p);
    ok('the row count is shown', /3 rows/.test(t), t.slice(0, 160));
    ok('and the participant count', /2 participants/.test(t), t.slice(0, 160));
    ok('no policy caveat is attached to a table that answered',
       t.indexOf('3 rows, 2 participants') !== -1, t.slice(0, 200));
    console.log('     ' + t.slice(0, 150));
    await p.close();
  }

  console.log('\n[a refused read says so, rather than showing zero]');
  {
    const p = await openWith(browser, {
      experiment_results: { rows: [] },
      ec_results: { status: 403, message: 'permission denied for table ec_results' },
      subliminal_results: { rows: [] }
    });
    const t = await text(p);
    ok('the failure is surfaced', /could not be read/i.test(t), t.slice(0, 200));
    ok('with the reason from the server',
       /permission denied/i.test(t), t.slice(0, 240));
    console.log('     ' + t.slice(0, 170));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
