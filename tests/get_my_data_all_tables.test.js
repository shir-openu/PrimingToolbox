// "Get My Data" asks every table the platform writes to.
//
// fetchMyData() queried experiment_results and nothing else. Evaluative
// conditioning writes to ec_results and subliminal priming to
// subliminal_results, so an experimenter who ran either of those was told
//
//     "Found 0 trials from your experiment."
//
// - a confident sentence, wrong, with nothing to suggest the data was sitting
// safely in a table the query never mentioned. This is the same defect family
// as the rest of 2026-08-12, except it is in the app the experimenter actually
// uses rather than in a diagnostic page.
//
// The two extra tables have row-level security on with an INSERT policy and no
// SELECT policy, and PostgREST answers a blocked read with an empty list and
// status 200 - not an error. So a zero from them cannot be folded silently into
// the total; the message has to say what a zero there might mean.
//
// Every request is intercepted, so this never touches the real database.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/get_my_data_all_tables.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

// The Supabase client sends apikey/authorization headers, so the browser sends
// a CORS preflight first. Answering that OPTIONS with data and no CORS headers
// fails the preflight and the real request never leaves - which looks exactly
// like a broken page.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-expose-headers': 'content-range'
};

async function run(browser, answers) {
  const p = await browser.newPage();
  await p.setCacheEnabled(false);
  await p.setRequestInterception(true);
  p.on('request', req => {
    const m = req.url().match(/\/rest\/v1\/([a-z_]+)\?/);
    if (!m) return req.continue();
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
    const a = answers[m[1]];
    if (a && a.status && a.status !== 200) {
      return req.respond({ status: a.status, contentType: 'application/json', headers: CORS,
                           body: JSON.stringify({ message: a.message || 'denied' }) });
    }
    req.respond({ status: 200, contentType: 'application/json', headers: CORS,
                  body: JSON.stringify((a && a.rows) || []) });
  });

  await p.evaluateOnNewDocument(() => {
    window.alert = function (m) { window.__alert = m; };
    window.__PTBX_NO_TELEMETRY = true;
  });
  await p.goto(INDEX, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 700));

  const out = await p.evaluate(async () => {
    document.getElementById('dataEmail').value = 'lab@example.org';
    document.getElementById('dataExperimentId').value = 'exp_1';
    await fetchMyData();
    await new Promise(r => setTimeout(r, 300));
    return {
      message: (document.getElementById('dataResultsMessage') || {}).textContent || '',
      shown: (document.getElementById('dataResultsContainer') || {}).style.display,
      // BARE identifier, not window.retrievedData. index.html declares it as
      // `let retrievedData` at the top level of a classic script, and a
      // top-level let creates NO property on window - the same trap as
      // `let db` in db-viewer.html. page.evaluate runs in the page's global
      // scope, so the bare name resolves and window.<name> is undefined.
      rows: (typeof retrievedData !== 'undefined' && retrievedData ? retrievedData : []).length,
      sources: Array.from(new Set(
        (typeof retrievedData !== 'undefined' && retrievedData ? retrievedData : [])
          .map(r => r.source_table))),
      alert: window.__alert || null
    };
  });
  await p.close();
  return out;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });

  console.log('\n[data that lives in ec_results is found]');
  {
    const r = await run(browser, {
      experiment_results: { rows: [] },
      ec_results: { rows: [{ participant_id: 'a', rating: 6 }, { participant_id: 'b', rating: 3 }] },
      subliminal_results: { rows: [] }
    });
    ok('the trials are found', r.rows === 2, String(r.rows) + ' ' + r.message.slice(0, 90));
    ok('the message no longer says zero', !/Found 0 trials/.test(r.message), r.message.slice(0, 110));
    ok('each row is tagged with the table it came from',
       r.sources.length === 1 && r.sources[0] === 'ec_results', JSON.stringify(r.sources));
    ok('the results panel is opened', r.shown === 'block', String(r.shown));
    console.log('     ' + r.message.slice(0, 130));
  }

  console.log('\n[rows from several tables are combined]');
  {
    const r = await run(browser, {
      experiment_results: { rows: [{ participant_id: 'x' }, { participant_id: 'y' }] },
      ec_results: { rows: [{ participant_id: 'z' }] },
      subliminal_results: { rows: [{ participant_id: 'w' }] }
    });
    ok('all four trials are returned', r.rows === 4, String(r.rows));
    ok('all three tables are represented', r.sources.length === 3, JSON.stringify(r.sources));
    ok('no policy caveat when every table answered with data',
       !/cannot read/i.test(r.message), r.message.slice(0, 140));
  }

  console.log('\n[a zero from a table this key cannot read says so]');
  {
    const r = await run(browser, {
      experiment_results: { rows: [{ participant_id: 'x' }] },
      ec_results: { rows: [] },
      subliminal_results: { rows: [] }
    });
    ok('the readable table still reports its trial', r.rows === 1, String(r.rows));
    ok('and the message explains what the other zeros might mean',
       /cannot read/i.test(r.message) && /zero/i.test(r.message), r.message.slice(0, 220));
    console.log('     ' + r.message.slice(0, 200));
  }

  console.log('\n[one table failing does not lose the others]');
  {
    const r = await run(browser, {
      experiment_results: { rows: [{ participant_id: 'x' }, { participant_id: 'y' }] },
      ec_results: { status: 403, message: 'permission denied for table ec_results' },
      subliminal_results: { rows: [] }
    });
    ok('the rows that could be read are kept', r.rows === 2, String(r.rows));
    ok('the failure is reported rather than swallowed',
       /could not read/i.test(r.message) && /permission denied/i.test(r.message),
       r.message.slice(0, 220));
    ok('and it is not raised as a fatal alert', !r.alert, String(r.alert));
    console.log('     ' + r.message.slice(0, 200));
  }

  console.log('\n[everything failing is still an error]');
  {
    const r = await run(browser, {
      experiment_results: { status: 500, message: 'server exploded' },
      ec_results: { status: 500, message: 'server exploded' },
      subliminal_results: { status: 500, message: 'server exploded' }
    });
    ok('an alert is raised when nothing could be read', !!r.alert, String(r.alert));
    ok('the panel is not opened on total failure', r.shown !== 'block', String(r.shown));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
