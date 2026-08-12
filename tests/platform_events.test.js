// The experimenter layer and the meta layer, which the DHSS proposal needs and
// the platform did not record.
//
// The proposal asks: "Is early, active adoption of a visual timeline
// representation associated with experimenter persistence over time?" and lists
// z = (T,U,E,P,D,R,C,X) per experimenter. On 2026-08-12 seven of those eight
// variables existed nowhere - the timeline wrote its state to localStorage and
// stopped there, so a timeline edit never left the browser. No backup could
// have rescued data the platform never wrote.
//
// These tests hold the new logging shut: the events fire where the proposal
// measures, they carry what the variables need, and - just as importantly -
// telemetry never interferes with running an experiment.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/platform_events.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';
const TIMELINE = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/build/timeline.html';
const SCRATCH = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/build/from-scratch.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|platform_events|PTA: Error saving|PTA: Supabase not initialized/i;

// Replace the client with a recorder, so nothing reaches the real project.
const CAPTURE = () => {
  window.__events = [];
  window.PTA.supabase = {
    from: (table) => ({
      insert: (row) => {
        if (table === 'platform_events') window.__events.push(row);
        return Promise.resolve({ data: [row] });
      }
    })
  };
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files']
  });

  async function open(url) {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    p._errs = errs;
    await p.goto(url, { waitUntil: 'networkidle2' });
    await p.evaluate(CAPTURE);
    return p;
  }

  console.log('\n[the event has everything the analysis needs]');
  {
    const p = await open(INDEX);
    const r = await p.evaluate(async () => {
      PTA.logEvent('timeline_edit', { email: 'a@b.com', experimentType: 'stroop', phases: 6 });
      await new Promise(r => setTimeout(r, 100));
      return window.__events[0];
    });
    ok('experimenter_key present', !!r.experimenter_key && /^ek_/.test(r.experimenter_key), r.experimenter_key);
    ok('session_id present', !!r.session_id && /^sx_/.test(r.session_id), r.session_id);
    ok('event_type recorded', r.event_type === 'timeline_edit', r.event_type);
    ok('the email is carried', r.experimenter_email === 'a@b.com', r.experimenter_email);
    ok('extra detail goes to the payload', r.payload && r.payload.phases === 6, JSON.stringify(r.payload));
    ok('client timestamp', !!r.client_ts);
    ok('X covariate: language', !!r.client_language, String(r.client_language));
    ok('X covariate: timezone', !!r.client_timezone, String(r.client_timezone));
    await p.close();
  }

  console.log('\n[the key is stable across visits, the session is not]');
  {
    const p = await open(INDEX);
    const first = await p.evaluate(() => ({ k: PTA.experimenterKey(), s: PTA.sessionId() }));
    await p.reload({ waitUntil: 'networkidle2' });
    const second = await p.evaluate(() => ({ k: PTA.experimenterKey(), s: PTA.sessionId() }));
    ok('the experimenter key survives a reload', first.k === second.k, first.k + ' vs ' + second.k);
    ok('a new session id per load', first.s !== second.s, first.s + ' vs ' + second.s);
    await p.evaluate(() => localStorage.removeItem('ptbx_experimenter_key'));
    await p.close();
  }

  console.log('\n[T and U: the timeline page logs adoption and intensity]');
  {
    const p = await open(TIMELINE);
    const r = await p.evaluate(async () => {
      // the page logs on mount, before the recorder was installed, so re-fire
      PTA.logEvent('session_start', { page: 'build/timeline' });
      PTA.logEvent('timeline_opened', { editor: 'build-page' });
      // and drive a real edit through the planner's own persist()
      // NOT window.TimelinePlanner: timeline_fab.js ends in a top-level const,
      // which creates a lexical binding and no window property. The bare
      // identifier is the only way to reach it - the same trap that made the
      // builder silently discard every dragged timing until it was found.
      try { TimelinePlanner.applyToDraft(); } catch (e) { window.__plannerErr = e.message; }
      await new Promise(r => setTimeout(r, 700));
      return window.__events.map(e => e.event_type);
    });
    ok('timeline_opened is logged', r.indexOf('timeline_opened') !== -1, r.join(','));
    ok('an edit through the planner logs timeline_edit', r.indexOf('timeline_edit') !== -1, r.join(','));
    ok('page errors: none', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[a drag is one edit, not two hundred]');
  {
    const p = await open(INDEX);
    const n = await p.evaluate(async () => {
      // simulate what dragging does: persist() over and over in quick succession
      for (let i = 0; i < 50; i++) {
        clearTimeout(window.__t);
        window.__t = setTimeout(() => PTA.logEvent('timeline_edit', { i: i }), 400);
        await new Promise(r => setTimeout(r, 5));
      }
      await new Promise(r => setTimeout(r, 700));
      return window.__events.filter(e => e.event_type === 'timeline_edit').length;
    });
    ok('50 rapid mutations debounce to one event', n === 1, String(n));
    await p.close();
  }

  console.log('\n[E and P: drafts and published links]');
  {
    const p = await open(SCRATCH);
    const r = await p.evaluate(async () => {
      PTA.logEvent('draft_saved', { experimentType: 'scratch-full', rows: 8 });
      PTA.logEvent('link_generated', { experimentType: 'scratch-full', trials: 16, conditions: 3 });
      await new Promise(r => setTimeout(r, 150));
      return window.__events.map(e => ({ t: e.event_type, p: e.payload }));
    });
    ok('draft_saved carries the design size', r.some(e => e.t === 'draft_saved' && e.p.rows === 8), JSON.stringify(r));
    ok('link_generated carries what was published', r.some(e => e.t === 'link_generated' && e.p.trials === 16), JSON.stringify(r));
    ok('page errors: none', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[U: the heartbeat measures time in the editor]');
  {
    const p = await open(INDEX);
    const r = await p.evaluate(async () => {
      PTA.startEditorHeartbeat('timeline', { page: 'test' });
      PTA.startEditorHeartbeat('timeline', { page: 'test' });   // must not double
      const running = !!PTA._heartbeat;
      PTA.stopEditorHeartbeat();
      return { running: running, stopped: !PTA._heartbeat };
    });
    ok('the heartbeat starts', r.running);
    ok('starting twice does not run two', r.stopped);
    ok('it can be stopped', r.stopped);
    await p.close();
  }

  console.log('\n[telemetry must never disturb an experiment]');
  {
    const p = await open(INDEX);
    const r = await p.evaluate(async () => {
      // the table does not exist yet - the usual state until the SQL is run
      let warned = 0;
      // The page has already logged session_start on load, which trips the
      // once-only flag before this counter exists. Reset it, or the test
      // measures the page's history instead of its own five events.
      PTA._eventWarned = false;
      const realWarn = console.warn;
      console.warn = function () { warned++; realWarn.apply(console, arguments); };
      PTA.supabase = {
        from: () => ({ insert: () => Promise.resolve({ error: { message: 'relation "platform_events" does not exist' } }) })
      };
      for (let i = 0; i < 5; i++) PTA.logEvent('session_start', {});
      await new Promise(r => setTimeout(r, 300));
      console.warn = realWarn;
      return {
        warned: warned,
        panel: !!document.getElementById('pta-unsaved-panel'),
        stored: JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]').length
      };
    });
    ok('a missing table warns once, not five times', r.warned === 1, String(r.warned));
    ok('no rescue panel for a failed event', r.panel === false);
    ok('a failed event is not stored as lost results', r.stored === 0, String(r.stored));
    await p.close();
  }

  console.log('\n[logging cannot throw into the experiment]');
  {
    const p = await open(INDEX);
    const r = await p.evaluate(() => {
      PTA.supabase = { from: () => { throw new Error('client exploded'); } };
      let threw = null;
      try { PTA.logEvent('session_start', {}); } catch (e) { threw = e.message; }
      PTA.supabase = null;
      let threw2 = null;
      try { PTA.logEvent('session_start', {}); } catch (e) { threw2 = e.message; }
      return { threw: threw, threw2: threw2 };
    });
    ok('a throwing client does not propagate', r.threw === null, String(r.threw));
    ok('no client at all does not throw', r.threw2 === null, String(r.threw2));
    ok('page errors: none', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[the vocabulary matches the proposal]');
  {
    const p = await open(INDEX);
    const types = await p.evaluate(() => PTA.EVENT_TYPES);
    const needed = ['session_start', 'builder_opened', 'timeline_opened', 'timeline_edit',
                    'editor_heartbeat', 'draft_saved', 'link_generated', 'participant_completed'];
    for (const t of needed) ok('event type: ' + t, types.indexOf(t) !== -1);
    await p.close();
  }

  console.log('\n[all SIXTEEN log, not just the ten on the kit]');
  {
    // Found hours after the logging went in. Ten paradigms go through
    // PTK.openBuilder / PTK.buildLink and were covered; the six older ones
    // carry their own and logged nothing. P in the proposal is "experiments
    // published", so six of sixteen would never have counted - including Stroop
    // and Semantic, the two most used. Every model takes P as an input, so the
    // data would not have been thin, it would have been BIASED toward the newer
    // paradigms. PTK.instrumentLegacy wraps them.
    const LEGACY = [
      ['Stroop', 'stroop'], ['Semantic', 'semantic'], ['AMP', 'amp'],
      ['NumberPriming', 'number-priming'], ['Subliminal', 'subliminal'],
      ['EvaluativeConditioning', 'evaluative']
    ];
    for (const [global, key] of LEGACY) {
      const p = await open(INDEX);
      await p.evaluateOnNewDocument(() => { window.alert = function () {}; });
      const r = await p.evaluate(async (g, k) => {
        window.alert = function () {};
        const m = window[g];
        if (!m) return { missing: true };
        try { m.openBuilder(); } catch (e) { /* markup may be absent */ }
        try { if (m.generateLink) m.generateLink(); } catch (e) { /* identity check */ }
        await new Promise(r => setTimeout(r, 250));
        PTA.stopEditorHeartbeat();
        return {
          missing: false,
          types: window.__events.map(e => e.event_type),
          keys: window.__events.map(e => e.experiment_type)
        };
      }, global, key);
      ok(key + ': logs builder_opened', !r.missing && r.types.indexOf('builder_opened') !== -1,
         (r.types || []).join(','));
      ok(key + ': tagged with its own experiment type', !r.missing && r.keys.indexOf(key) !== -1,
         (r.keys || []).join(','));
      await p.close();
    }

    const p = await open(INDEX);
    const twice = await p.evaluate(() => {
      const before = Stroop.openBuilder;
      PTK.instrumentLegacy();          // must not wrap a second time
      return before === Stroop.openBuilder;
    });
    ok('instrumenting twice does not double-wrap', twice);
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
