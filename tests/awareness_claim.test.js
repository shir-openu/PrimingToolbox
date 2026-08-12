// The awareness check must not claim more than it can show.
//
// It is the only evidence that a run was subliminal rather than merely fast,
// so what it says on screen matters. It used to say:
//
//     awarenessRate > 50
//       ? "High awareness rate may indicate prime was not fully subliminal."
//       : "Low awareness suggests prime was subliminal."
//
// But EVERY awareness trial in this design contains a prime - generateTrials
// builds them from wordPairs, and there are no prime-absent catch trials. So:
//
//   * there is no false-alarm rate, and therefore no chance level; 50% is not
//     a threshold, it is just a number;
//   * a participant who answers "no" to everything scores 0% and was told the
//     prime "was subliminal". Response bias and genuine non-detection give
//     exactly the same 0%, and the data cannot separate them.
//
// The high-rate warning is still sound - people rarely report seeing words
// they were not shown. The reassuring half was not, and now states what the
// number actually supports.
//
// Adding prime-absent catch trials and reporting d-prime is a change to the
// experimental design, not a bug fix, so it is left for Shir to decide.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/awareness_claim.test.js
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

  // drive showResults with a given set of awareness answers
  async function summarise(page, answers) {
    return page.evaluate((answers) => {
      const S = window.Subliminal;
      S.saveResults = function () {};
      S.state.results = [];
      for (let i = 0; i < 6; i++) {
        S.state.results.push({ relation: 'related', correct: true, rt: 520, trialType: 'lexical' });
        S.state.results.push({ relation: 'unrelated', correct: true, rt: 580, trialType: 'lexical' });
      }
      S.state.awarenessTrials = answers.map((saw, i) => ({
        trialNumber: i + 1, prime: 'DOCTOR', sawWord: saw, rt: 700
      }));
      S.showResults();
      const el = document.getElementById('subliminal-awareness-summary')
              || document.getElementById('subliminal-explanation');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }, answers);
  }

  console.log('\n[a participant who said no to everything]');
  {
    const p = await open();
    const text = await summarise(p, [false, false, false, false, false, false]);
    ok('the summary is shown at all', text.length > 0, text.slice(0, 80));
    ok('it reports the count', /0 of 6/.test(text), text.slice(0, 120));
    ok('it does NOT claim the prime was subliminal',
       !/prime was subliminal|was subliminal\./i.test(text) ||
       /does not establish/i.test(text), text.slice(0, 200));
    ok('it says a low rate does not establish it',
       /does not establish/i.test(text), text.slice(0, 200));
    ok('it explains why - no prime-absent trials',
       /prime-absent|false alarm/i.test(text), text.slice(0, 260));
    ok('it names the response-bias case explicitly',
       /answering "no" throughout|answering .no. throughout/i.test(text), text.slice(0, 300));
    console.log('     ' + text.slice(0, 220));
    await p.close();
  }

  console.log('\n[a participant who saw the prime most of the time]');
  {
    const p = await open();
    const text = await summarise(p, [true, true, true, true, false, false]);
    ok('it reports the count', /4 of 6/.test(text), text.slice(0, 120));
    ok('it warns the prime was probably visible',
       /probably visible/i.test(text), text.slice(0, 200));
    ok('and says the run is still priming, just not subliminal',
       /not a subliminal one|not subliminal/i.test(text), text.slice(0, 240));
    console.log('     ' + text.slice(0, 220));
    await p.close();
  }

  console.log('\n[the design really does lack prime-absent trials]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Subliminal;
      // force the awareness branch on
      let box = document.getElementById('subliminal-awareness-check');
      if (!box) {
        box = document.createElement('input');
        box.type = 'checkbox';
        box.id = 'subliminal-awareness-check';
        document.body.appendChild(box);
      }
      box.checked = true;
      const trials = S.generateTrials ? S.generateTrials() : (S.createTrials && S.createTrials());
      if (!trials) return { none: true };
      const aware = trials.filter(t => t.trialType === 'awareness');
      return {
        awareness: aware.length,
        withPrime: aware.filter(t => !!t.prime).length,
        withoutPrime: aware.filter(t => !t.prime).length
      };
    });
    if (r.none) {
      ok('trials could be generated', false, 'no generator found');
    } else {
      ok('awareness trials exist', r.awareness > 0, String(r.awareness));
      ok('every one of them contains a prime', r.withPrime === r.awareness,
         r.withPrime + ' of ' + r.awareness);
      ok('there are NO prime-absent catch trials - which is why the text hedges',
         r.withoutPrime === 0, String(r.withoutPrime));
      console.log('     ' + r.awareness + ' awareness trials, ' + r.withPrime +
                  ' with a prime, ' + r.withoutPrime + ' without');
    }
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
