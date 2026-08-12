// The prime duration recorded is the one that happened, not the one requested.
//
// js/subliminal.js shows the prime by counting animation frames:
//
//     primeFrames = max(1, round(timing.prime / state.frameTime))
//
// state.frameTime comes from estimateFrameRate(), which counts 60 frames once
// at init. If that estimate is wrong or never completed - the tab was hidden,
// the count was interrupted - it stays at the 16.67 ms default. On a 120 Hz
// display the prime is then shown for 2 frames = 16.7 ms.
//
// Every saved row said prime_duration_ms = 33 regardless, because it wrote
// this.timing.prime, the REQUESTED value. In a subliminal paradigm the prime
// duration is the independent variable - it is the whole difference between
// subliminal and visible - so a run that silently halved it looked in the data
// exactly like a run that did not.
//
// The achieved duration is now measured and saved beside the requested one, so
// the disagreement is visible and those trials can be dropped.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/prime_duration_measured.test.js
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
    await new Promise(r => setTimeout(r, 400));
    return p;
  }

  console.log('\n[showPrime measures what it actually did]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      const S = window.Subliminal;
      S.open();
      S.showBackwardMask = function () {};          // stop the trial chain here
      S.state.frameTime = 16.67;
      S.timing.prime = 100;                          // ~6 frames at 60 Hz

      const trial = { prime: 'DOCTOR', target: 'NURSE', relation: 'related', targetType: 'word' };
      S.showPrime(trial);
      await new Promise(r => setTimeout(r, 600));
      return {
        requested: S.timing.prime,
        actual: trial.primeActualMs,
        framesRequested: trial.primeFramesRequested,
        framesShown: trial.primeFramesShown
      };
    });
    ok('an actual duration was measured', typeof r.actual === 'number', String(r.actual));
    ok('the frames shown match the frames asked for',
       r.framesShown === r.framesRequested, r.framesShown + ' of ' + r.framesRequested);
    ok('the measured duration is in the right region',
       r.actual > 50 && r.actual < 250, String(Math.round(r.actual)));
    console.log('     requested ' + r.requested + ' ms, measured ' +
                Math.round(r.actual) + ' ms over ' + r.framesShown + ' frames');
    await p.close();
  }

  console.log('\n[a wrong frame-rate estimate is now VISIBLE in the data]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      const S = window.Subliminal;
      S.open();
      S.showBackwardMask = function () {};
      // Pretend the frame-rate estimate came out badly wrong - as it does when
      // it never completes on a display that is not 60 Hz. round(33/33.3) = 1,
      // so the prime gets ONE frame, about 16.7 ms, not the 33 requested.
      S.state.frameTime = 33.3;
      S.state.frameRate = 30;
      S.timing.prime = 33;

      const trial = { prime: 'DOCTOR', target: 'NURSE', relation: 'related', targetType: 'word' };
      S.showPrime(trial);
      await new Promise(r => setTimeout(r, 400));
      return {
        requested: S.timing.prime,
        actual: trial.primeActualMs,
        frames: trial.primeFramesShown
      };
    });
    ok('only one frame was shown', r.frames === 1, String(r.frames));
    ok('the measured duration is well under the requested 33 ms',
       r.actual < 30, String(Math.round(r.actual)));
    ok('so requested and actual disagree, which is the point',
       Math.abs(r.requested - r.actual) > 5,
       'requested ' + r.requested + ' vs actual ' + Math.round(r.actual));
    console.log('     requested 33 ms, actually shown ' + Math.round(r.actual) +
                ' ms - previously the row would still have said 33');
    await p.close();
  }

  console.log('\n[the saved row carries both numbers]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Subliminal;
      const captured = [];
      PTA.saveAllResults = function (table, rows) { captured.push({ table, rows }); return Promise.resolve({}); };

      S.state.results = [{
        trialNumber: 1, prime: 'DOCTOR', target: 'NURSE', relation: 'related',
        targetType: 'word', response: 'word', correct: true, rt: 512,
        primeActualMs: 16.72, primeFramesShown: 1
      }];
      S.state.frameRate = 30;
      S.saveResults();

      const row = captured.length ? captured[0].rows[0] : null;
      return row ? {
        requested: row.prime_duration_ms,
        actual: row.prime_actual_ms,
        frames: row.prime_frames_shown,
        hz: row.frame_rate_hz,
        keys: Object.keys(row)
      } : { none: true };
    });
    ok('the row was built', !r.none, JSON.stringify(r).slice(0, 120));
    ok('it still carries the requested duration', r.requested === 33, String(r.requested));
    ok('and now the measured one', r.actual === 16.72, String(r.actual));
    ok('and the frames actually shown', r.frames === 1, String(r.frames));
    ok('and the frame rate it believed it had', r.hz === 30, String(r.hz));
    await p.close();
  }

  console.log('\n[a trial that never ran records null, not a fabricated duration]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Subliminal;
      const captured = [];
      PTA.saveAllResults = function (table, rows) { captured.push(rows); return Promise.resolve({}); };
      S.state.results = [{
        trialNumber: 1, prime: 'A', target: 'B', relation: 'related',
        targetType: 'word', response: 'word', correct: true, rt: 400
      }];
      S.saveResults();
      const row = captured[0][0];
      return { actual: row.prime_actual_ms, frames: row.prime_frames_shown };
    });
    ok('a missing measurement is null, not 0 or 33', r.actual === null, String(r.actual));
    ok('and so is the frame count', r.frames === null, String(r.frames));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
