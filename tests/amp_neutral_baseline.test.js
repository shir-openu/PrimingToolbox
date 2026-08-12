// AMP now runs a neutral-prime baseline.
//
// Until 2026-08-12 generateTrials used primeTypes = ['positive', 'negative'].
// Both compared conditions were primed, so the experiment had no C in the ABCD
// sense, and its single headline number - posProportion minus negProportion -
// could not say which side had moved. A 15-point effect might have been
// positive primes lifting the judgement, negative primes lowering it, or any
// mixture. The neutral images were defined in stimuli.primes.neutral and never
// used by anything.
//
// Two further things had to change with it:
//   * 24 targets was exactly 2 x 12, one per trial. A third condition makes 36
//     trials, so twelve ideographs would have been judged TWICE by the same
//     participant. Twelve more targets were added.
//   * There were 2 neutral primes against 4 positive and 4 negative, so each
//     neutral image would have appeared three times as often as each emotional
//     one. Two more were added.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/amp_neutral_baseline.test.js
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
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.evaluateOnNewDocument(() => { window.alert = function () {}; });
  await page.goto(INDEX, { waitUntil: 'networkidle2' });

  console.log('\n[the third condition actually runs]');
  const t = await page.evaluate(() => {
    const trials = AMP.generateTrials(false);
    const byType = {};
    trials.forEach(x => { byType[x.primeType] = (byType[x.primeType] || 0) + 1; });
    const targets = trials.map(x => x.target);
    const primeIds = {};
    trials.forEach(x => {
      primeIds[x.primeType] = primeIds[x.primeType] || new Set();
      primeIds[x.primeType].add(x.primeId);
    });
    return {
      byType,
      total: trials.length,
      uniqueTargets: new Set(targets).size,
      neutralPrimeCount: (primeIds.neutral || new Set()).size,
      positivePrimeCount: (primeIds.positive || new Set()).size,
      targetPoolSize: AMP.stimuli.targets.length,
      uniqueTargetPool: new Set(AMP.stimuli.targets).size,
      everyNeutralHasEmoji: AMP.stimuli.primes.neutral.every(p => !!p.emoji)
    };
  });
  ok('a neutral condition exists', t.byType.neutral > 0, JSON.stringify(t.byType));
  ok('all three conditions have equal trials',
     t.byType.positive === t.byType.negative && t.byType.negative === t.byType.neutral,
     JSON.stringify(t.byType));
  ok('no ideograph is judged twice in one session',
     t.uniqueTargets === t.total, t.uniqueTargets + ' unique of ' + t.total);
  ok('the target pool itself has no duplicates',
     t.uniqueTargetPool === t.targetPoolSize, t.uniqueTargetPool + '/' + t.targetPoolSize);
  ok('neutral primes are as varied as the emotional ones',
     t.neutralPrimeCount === t.positivePrimeCount,
     'neutral ' + t.neutralPrimeCount + ' vs positive ' + t.positivePrimeCount);
  ok('every neutral prime renders something', t.everyNeutralHasEmoji);

  console.log('\n[the baseline is reported, and says which side moved]');
  const r = await page.evaluate(() => {
    AMP.saveResults = function () {};
    // positive lifts a lot, negative barely moves: the interpretation must
    // attribute the effect to the positive side, which is the entire point of
    // having a baseline
    AMP.state.results = [];
    const push = (type, pleasant, n) => {
      for (let i = 0; i < n; i++) {
        AMP.state.results.push({ primeType: type, response: pleasant ? 'pleasant' : 'unpleasant', rt: 600 });
      }
    };
    push('positive', true, 10); push('positive', false, 2);   // 83.3%
    push('neutral',  true, 6);  push('neutral',  false, 6);   // 50.0%
    push('negative', true, 5);  push('negative', false, 7);   // 41.7%
    AMP.showResults();
    const g = id => (document.getElementById(id) || {}).textContent;
    return {
      pos: g('amp-pos-pleasant'), neu: g('amp-neu-pleasant'), neg: g('amp-neg-pleasant'),
      effect: g('amp-effect'),
      interp: g('amp-interpretation') || ''
    };
  });
  ok('the neutral baseline is displayed', r.neu === '50%', String(r.neu));
  ok('positive is displayed', r.pos === '83.3%', String(r.pos));
  ok('negative is displayed', r.neg === '41.7%', String(r.neg));
  ok('the headline effect is still positive minus negative', r.effect === '41.6%', String(r.effect));
  ok('the interpretation names the positive side as the mover',
     /positive primes lifting/i.test(r.interp), r.interp.slice(0, 200));
  ok('both movements are quoted against the baseline',
     /33\.3/.test(r.interp) && /8\.3/.test(r.interp), r.interp.slice(0, 240));
  console.log('     ' + r.interp.slice(0, 230));

  console.log('\n[an empty condition is still not a zero]');
  const e = await page.evaluate(() => {
    AMP.saveResults = function () {};
    AMP.state.results = [];
    for (let i = 0; i < 8; i++) {
      AMP.state.results.push({ primeType: 'positive', response: 'pleasant', rt: 600 });
      AMP.state.results.push({ primeType: 'neutral', response: 'pleasant', rt: 600 });
    }
    AMP.showResults();
    const g = id => (document.getElementById(id) || {}).textContent;
    return { neg: g('amp-neg-pleasant'), effect: g('amp-effect'),
             interp: g('amp-interpretation') || '' };
  });
  ok('a missing condition shows a dash, not 0%', e.neg === '—', String(e.neg));
  ok('and no effect is invented from it', e.effect === '—', String(e.effect));
  ok('the text says the comparison cannot be made',
     /cannot be made/i.test(e.interp), e.interp.slice(0, 160));

  console.log('\n[no page errors]');
  const noise = errs.filter(x => !/supabase|net::ERR|Failed to load/i.test(x));
  ok('no runtime errors', noise.length === 0, noise.slice(0, 2).join(' | '));

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
