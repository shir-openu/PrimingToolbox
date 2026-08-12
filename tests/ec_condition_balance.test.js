// An odd number of shapes cannot be split in half, and nothing said so.
//
// EvaluativeConditioning.generateCSUSPairings assigns the first floor(n/2)
// shapes to positive and THE REST to negative. Every odd count therefore sends
// the extra shape to negative, measured:
//
//     4 shapes -> 2 positive, 2 negative
//     5 shapes -> 2 positive, 3 negative
//     3 shapes -> 1 positive, 2 negative
//     1 shape  -> 0 positive, 1 negative     (no positive condition at all)
//
// The builder offers Add and Remove for these shapes, so 3, 5 and 7 are one
// click away, and a participant link can set the list to any length at all -
// checkUrlConfig overwrites data.neutralStimuli from config.cs. Meanwhile the
// text under the table promised "half of these will be paired with positive US,
// half with negative", which is exactly the claim that is false.
//
// Nothing is silently rebalanced. Dropping or duplicating a shape to make the
// numbers even would be a change to someone's experiment made behind their
// back, which is worse than an uneven design they chose knowingly. The builder
// says what the split will actually be.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/ec_condition_balance.test.js
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
  const p = await browser.newPage();
  await p.setCacheEnabled(false);
  await p.evaluateOnNewDocument(() => {
    window.alert = function () {};
    window.__PTBX_NO_TELEMETRY = true;
  });
  await p.goto(INDEX, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  console.log('\n[the split is what it says it is]');
  {
    const r = await p.evaluate(() => {
      const E = window.EvaluativeConditioning;
      const orig = E.data.neutralStimuli.slice();
      const run = (n) => {
        E.data.neutralStimuli = [];
        for (let i = 0; i < n; i++) {
          E.data.neutralStimuli.push({ id: 'cs' + i, label: 'S' + i, color: '#808080' });
        }
        E.generateCSUSPairings();
        const c = { positive: 0, negative: 0 };
        E.state.csUSPairings.forEach(x => { c[x.usValence]++; });
        return c;
      };
      const out = { four: run(4), five: run(5), three: run(3), one: run(1) };
      E.data.neutralStimuli = orig;
      return out;
    });
    ok('four shapes split evenly', r.four.positive === 2 && r.four.negative === 2, JSON.stringify(r.four));
    ok('five cannot, and the extra goes negative',
       r.five.positive === 2 && r.five.negative === 3, JSON.stringify(r.five));
    ok('three is one against two', r.three.positive === 1 && r.three.negative === 2, JSON.stringify(r.three));
    ok('one shape leaves NO positive condition',
       r.one.positive === 0 && r.one.negative === 1, JSON.stringify(r.one));
    console.log('     4:' + JSON.stringify(r.four) + '  5:' + JSON.stringify(r.five) +
                '  3:' + JSON.stringify(r.three) + '  1:' + JSON.stringify(r.one));
  }

  console.log('\n[the builder says so, every time the count changes]');
  {
    const r = await p.evaluate(() => {
      const E = window.EvaluativeConditioning;
      E.openBuilder && E.openBuilder();
      const read = () => (document.getElementById('cs-balance-note') || {}).textContent || '';
      const set = (n) => {
        E.builderStimuli.cs = [];
        for (let i = 0; i < n; i++) E.builderStimuli.cs.push({ id: 'cs' + i, label: 'S' + i, color: '#707070' });
        E.renderCSTable();
        return read();
      };
      return { four: set(4), five: set(5), six: set(6), three: set(3), one: set(1) };
    });
    ok('an even count is called balanced', /Balanced/.test(r.four), r.four);
    ok('six is balanced too', /Balanced/.test(r.six), r.six);
    ok('five is called out as uneven', /cannot be split evenly/.test(r.five), r.five);
    ok('and names the actual split', /2 .*positive.* and 3 .*negative/.test(r.five), r.five);
    ok('and says which side gets the extra', /always goes to negative/.test(r.five), r.five);
    ok('three is called out as well', /cannot be split evenly/.test(r.three), r.three);
    ok('one shape is called out as having no comparison',
       /no positive condition/.test(r.one) && /no comparison/.test(r.one), r.one);
    console.log('     ' + r.five);
    console.log('     ' + r.one);
  }

  console.log('\n[nothing is silently rebalanced]');
  {
    const r = await p.evaluate(() => {
      const E = window.EvaluativeConditioning;
      E.builderStimuli.cs = [];
      for (let i = 0; i < 5; i++) E.builderStimuli.cs.push({ id: 'cs' + i, label: 'S' + i, color: '#707070' });
      E.renderCSTable();
      return { count: E.builderStimuli.cs.length };
    });
    ok('five shapes stay five - none is dropped or duplicated', r.count === 5, String(r.count));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
