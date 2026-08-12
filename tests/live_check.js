// Does the DEPLOYED site work? Run this after a push.
//
//   node tests/live_check.js
//   node tests/live_check.js https://some-other-host/PrimingToolbox/
//
// Deliberately NOT named *.test.js, so run_all.js does not pick it up: it needs
// the network and the live database, and a suite that fails when the wifi drops
// is a suite people stop trusting.
//
// WHY IT EXISTS. Every test in this repo drives index.html from file://.
// Participants load https://, where the origin, CORS and mixed-content rules
// are all different, and where the files come from whatever GitHub Pages last
// built rather than from disk. A fix can be committed, pushed, green locally,
// and still not be what a participant is running.
//
// Two ways of asking "is it deployed" that do NOT work, both learned the hard
// way on 2026-08-12:
//
//   * Fetching the page and looking for an id or a script string. WebFetch
//     converts HTML to markdown, so visible text survives and element ids and
//     <script> contents vanish - which reported three of today's fixes as
//     missing while a fourth from the SAME COMMIT was found. When a measurement
//     contradicts itself, suspect the measurement.
//   * Padding a test payload with one repeated Hebrew letter to force a "+"
//     into the base64. A run of the same two bytes tiles into groups that can
//     never be 62, so the payload comes out with no "+" and the check passes
//     having tested nothing. The filler below cycles a varied alphabet.
//
// The authoritative check on WHAT is deployed is:
//   gh api repos/shir-openu/PrimingToolbox/pages/builds/latest
// which returns the commit Pages actually built. This script checks that the
// deployed thing WORKS.
const puppeteer = require('puppeteer');

const LIVE = process.argv[2] || 'https://shir-openu.github.io/PrimingToolbox/';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

const PARADIGMS = ['Stroop','Semantic','NumberPriming','Subliminal','AMP','EvaluativeConditioning',
                   'Affective','Social','NegativePriming','MaskedLexical','SyntacticPriming',
                   'RepetitionPriming','GoalPriming','MoralPriming','MoneyPriming','AdvertisingPriming'];

(async () => {
  console.log('\nchecking ' + LIVE + '\n');
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding']
  });

  async function open(url) {
    const p = await browser.newPage();
    p._errs = [];
    p._bad = [];
    p.on('pageerror', e => p._errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') p._errs.push('console: ' + m.text().slice(0, 160)); });
    // favicon.ico is requested by the browser itself and the site does not ship
    // one; that 404 is expected and is not a broken resource.
    p.on('response', r => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) p._bad.push(r.status() + ' ' + r.url()); });
    // never let a probe write to the real research database
    await p.evaluateOnNewDocument(() => { window.__PTBX_NO_TELEMETRY = true; window.alert = function () {}; });
    await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));
    return p;
  }

  console.log('[the page loads and the platform is there]');
  const p = await open(LIVE);
  {
    const r = await p.evaluate((names) => ({
      PTA: typeof PTA === 'object',
      PTK: typeof PTK === 'object',
      engine: !!(window.PTA && PTA.Engine),
      supabase: !!(window.PTA && PTA.supabase),
      loaded: names.filter(n => typeof window[n] === 'object').length,
      missing: names.filter(n => typeof window[n] !== 'object'),
      dropdown: document.querySelectorAll('#experimentSelect option[value]:not([value=""])').length
    }), PARADIGMS);
    ok('PTA is loaded', r.PTA);
    ok('PTK is loaded', r.PTK);
    ok('the shared engine is defined', r.engine);
    ok('Supabase initialised over https', r.supabase);
    ok('all ' + PARADIGMS.length + ' paradigms are present', r.missing.length === 0, r.missing.join(', '));
    ok('the dropdown offers all of them', r.dropdown === PARADIGMS.length, String(r.dropdown));
    ok('no failed resources', p._bad.length === 0, p._bad.slice(0, 3).join(' | '));
    ok('no page errors', p._errs.length === 0, p._errs.slice(0, 3).join(' | '));
  }

  console.log('\n[an experiment opens and closes]');
  {
    const r = await p.evaluate(() => {
      try {
        window.Semantic.open();
        const el = document.getElementById('semantic-overlay');
        const open = !!el && (el.classList.contains('active') || el.style.display === 'block');
        window.Semantic.close();
        return { open, closed: true };
      } catch (e) { return { threw: e.message }; }
    });
    ok('a paradigm opens', r.open === true, JSON.stringify(r));
    ok('and closes again', r.closed === true, JSON.stringify(r));
  }

  console.log('\n[a real participant link survives the round trip]');
  {
    const link = await p.evaluate(() => {
      const cfg = { template: 'negative-priming', experimenterEmail: 'lab@example.org',
                    userExperimentId: 'live_check_probe', note: 'אדום ~ a?b' };
      // varied alphabet: a repeated single letter tiles into base64 groups that
      // can never be 62, so it would never force the "+" this is here to test
      const FILL = 'אבגדהוזחטיכלמנסעפצקרשת0123456789~?&= ';
      for (let i = 0; i < 300 && PTK.encode(cfg).indexOf('+') === -1; i++) {
        cfg.note += FILL[i % FILL.length];
      }
      return { url: PTK.buildLink('negative', cfg),
               hasPlus: PTK.encode(cfg).indexOf('+') !== -1,
               note: cfg.note };
    });
    ok('the payload really contains a "+"', link.hasPlus,
       'without one this check proves nothing');

    const p2 = await open(link.url);
    const r = await p2.evaluate((expected) => {
      const raw = new URLSearchParams(location.search).get('negative');
      let dec = null, threw = null;
      try { dec = PTK.decode(raw); } catch (e) { threw = String(e.message); }
      return {
        claimed: !!(window.NegativePriming && NegativePriming.isParticipantMode),
        expId: window.NegativePriming && NegativePriming.userExperimentId,
        noteIntact: !!dec && dec.note === expected,
        threw
      };
    }, link.note);
    ok('the module claims its own link', r.claimed === true, JSON.stringify(r));
    ok('the experiment id arrives', r.expId === 'live_check_probe', String(r.expId));
    ok('the payload decodes byte for byte, Hebrew included', r.noteIntact === true, String(r.threw));
    ok('opening a participant link raises no errors', p2._errs.length === 0,
       p2._errs.slice(0, 3).join(' | '));
    await p2.close();
  }

  await p.close();
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
