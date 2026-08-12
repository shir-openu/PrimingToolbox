// The control condition has to be randomly re-paired, not nearly-rotated.
//
// js/subliminal.js built its UNRELATED pairs - the baseline the whole effect is
// measured against - with
//
//     [...targets].sort(() => Math.random() - 0.5)
//
// which is not a shuffle. A comparator that answers inconsistently violates
// what a sort assumes, so the sort's own algorithm shows through and elements
// come out near where they started. Measured over 40,000 shuffles of six
// items, position 0 stayed put 28.8% of the time against a uniform 16.7%, and
// the bias differs by position (16.9% to 28.8%). Fisher-Yates gives 16.4-16.8%
// at every position.
//
// The consequence is not abstract. If targets barely move, the "unrelated"
// re-pairing is close to a fixed rotation, so every participant sees roughly
// the SAME unrelated pairs and item-level quirks - one target simply being an
// easier word - stop averaging out across participants and sit directly in the
// contrast being reported.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/shuffle_is_random.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });

  async function open() {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    await p.evaluateOnNewDocument(() => {
      window.alert = function () {};
      window.__PTBX_NO_TELEMETRY = true;
    });
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    return p;
  }

  console.log('\n[PTA.shuffleArray is uniform]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const N = 6, RUNS = 4000;
      const base = Array.from({ length: N }, (_, i) => i);
      const stay = new Array(N).fill(0);
      for (let run = 0; run < RUNS; run++) {
        const s = PTA.shuffleArray(base);
        for (let i = 0; i < N; i++) if (s[i] === i) stay[i]++;
      }
      const pct = stay.map(c => c / RUNS * 100);
      const input = [1, 2, 3];
      const out = PTA.shuffleArray(input);
      return {
        pct,
        ideal: 100 / N,
        // 4000 runs puts the sampling error near 0.6 points, so +/-5 is about
        // eight standard errors - wide enough never to flake, narrow enough
        // that the broken comparator (16.9 to 28.8) cannot slip through
        allWithin: pct.every(v => v > 11.7 && v < 21.7),
        newArray: out !== input,
        inputUntouched: input.join() === '1,2,3',
        sameItems: PTA.shuffleArray([1, 2, 3, 4]).sort().join() === '1,2,3,4'
      };
    });
    console.log('     P(stay) % by position: ' + r.pct.map(v => v.toFixed(1)).join(' ') +
                '   (uniform = ' + r.ideal.toFixed(1) + ')');
    ok('every position is near the uniform rate', r.allWithin,
       r.pct.map(v => v.toFixed(1)).join(' '));
    ok('it returns a new array', r.newArray);
    ok('it does not mutate its input', r.inputUntouched);
    ok('it keeps every item', r.sameItems);
    await p.close();
  }

  console.log('\n[nothing in the codebase still sorts by a random comparator]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      const files = ['js/subliminal.js', 'js/semantic.js', 'js/stroop.js', 'js/amp.js',
                     'js/evaluative.js', 'js/number-priming.js', 'js/core_fab.js',
                     'js/engine_fab.js', 'js/paradigm_kit_fab.js', 'js/affective_fab.js',
                     'js/social_fab.js', 'js/masked_fab.js', 'js/negative_fab.js',
                     'js/syntactic_fab.js', 'js/repetition_fab.js', 'js/moral_fab.js',
                     'js/money_fab.js', 'js/goal_fab.js', 'js/advertising_fab.js'];
      const offenders = [];
      for (const f of files) {
        try {
          const raw = await fetch(f).then(x => x.text());
          // Strip comments first. The fix in subliminal.js explains the defect
          // by quoting it, and a scan over raw text flags that comment as the
          // very thing it warns about - which is how this check failed on its
          // first run.
          const src = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
          if (/sort\(\s*\(?\s*\)?\s*=>\s*Math\.random\(\)\s*-\s*0?\.5\s*\)/.test(src) ||
              /sort\(\s*function\s*\(\)\s*\{\s*return\s+Math\.random\(\)\s*-\s*0?\.5/.test(src)) {
            offenders.push(f);
          }
        } catch (e) { /* file not present in this build */ }
      }
      return offenders;
    });
    ok('no module shuffles with sort(() => Math.random() - 0.5)', r.length === 0, r.join(', '));
    await p.close();
  }

  console.log('\n[the unrelated pairs really do vary]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Subliminal;
      const firstTargets = {};
      let relatedLeak = 0, runs = 0;

      for (let i = 0; i < 300; i++) {
        const pairs = S.createPairsFromBuilder();
        if (!pairs || !pairs.length) break;
        runs++;
        const unrelated = pairs.filter(x => x.relation === 'unrelated');
        if (!unrelated.length) break;
        const first = unrelated[0];
        firstTargets[first.target] = (firstTargets[first.target] || 0) + 1;

        // an "unrelated" pair must not be one of the related pairs
        const related = pairs.filter(x => x.relation === 'related')
                             .map(x => x.prime + '|' + x.target);
        unrelated.forEach(u => {
          if (related.indexOf(u.prime + '|' + u.target) !== -1) relatedLeak++;
        });
      }
      const distinct = Object.keys(firstTargets);
      const counts = distinct.map(k => firstTargets[k]);
      return {
        runs, distinct: distinct.length, relatedLeak,
        topShare: runs ? Math.max.apply(null, counts) / runs : 1,
        spread: firstTargets
      };
    });
    ok('the builder produced pairs', r.runs > 0, String(r.runs));
    ok('the first prime does not always get the same target', r.distinct >= 2,
       JSON.stringify(r.spread));
    ok('and no single target dominates it', r.topShare < 0.85,
       (r.topShare * 100).toFixed(0) + '% ' + JSON.stringify(r.spread));
    ok('no "unrelated" pair is secretly a related pair', r.relatedLeak === 0,
       String(r.relatedLeak));
    console.log('     first-prime targets over ' + r.runs + ' builds: ' + JSON.stringify(r.spread));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
