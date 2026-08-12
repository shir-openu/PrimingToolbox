// Timing settings must survive from where they are set to where they are used.
//
// Two separate ways they did not:
//
// NUMBER PRIMING. index.html wires onchange="NumberPriming.updateBuilderSettings()"
// on every field in that builder, so the function runs whenever ANY field
// changes - and it applied the masked/explicit prime-duration preset
// unconditionally. Type 60 into Prime Duration, leave the field, and the preset
// wrote 43 straight back into it, then the next line read 43 out again. The
// input was in practice impossible to change, with nothing said. Prime duration
// is the whole difference between masked and explicit priming, so this removed
// the one setting a student most needs to vary.
//
// SUBLIMINAL. start() read four timing inputs that exist only in the standalone
// subliminal.html - an untracked local file, not part of the site. On
// index.html getElementById returns null, so `parseInt(undefined) || 33` handed
// back the default every time, discarding the timing carried in the participant
// link. checkUrlConfig applied config.timing and then start() overwrote it. A
// link built to run a 50 ms prime ran at 33 ms and said nothing.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/timing_settings.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}
const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|platform_events|PTA:/i;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });

  async function open(url) {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    await p.evaluateOnNewDocument(() => { window.alert = function () {}; });
    await p.goto(url, { waitUntil: 'networkidle2' });
    p._errs = errs;
    return p;
  }

  console.log('\n[number priming: the prime duration can actually be typed]');
  {
    const p = await open(INDEX + '?edit=number-priming');
    await new Promise(r => setTimeout(r, 900));
    const r = await p.evaluate(() => {
      const dur = document.getElementById('builder-np-prime-duration');
      const mode = document.getElementById('builder-np-mode');
      if (!dur || !mode) return { missing: true };
      NumberPriming.updateBuilderSettings();            // settle the remembered mode
      dur.value = '60';
      dur.dispatchEvent(new Event('change', { bubbles: true }));
      NumberPriming.updateBuilderSettings();
      const typed = { field: dur.value, setting: NumberPriming.builderSettings.primeDuration };

      // changing some OTHER field must not disturb it either
      const fix = document.getElementById('builder-np-fixation');
      if (fix) { fix.value = '600'; fix.dispatchEvent(new Event('change', { bubbles: true })); }
      NumberPriming.updateBuilderSettings();
      const afterOther = { field: dur.value, setting: NumberPriming.builderSettings.primeDuration };

      // but switching MODE should still apply its preset - that is the feature
      mode.value = 'explicit';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
      NumberPriming.updateBuilderSettings();
      const switched = { field: dur.value, setting: NumberPriming.builderSettings.primeDuration };

      mode.value = 'masked';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
      NumberPriming.updateBuilderSettings();
      const back = NumberPriming.builderSettings.primeDuration;

      return { missing: false, typed, afterOther, switched, back };
    });
    ok('the builder is there', !r.missing);
    ok('a typed 60 ms survives', r.typed && r.typed.field === '60' && r.typed.setting === 60,
       JSON.stringify(r.typed));
    ok('changing another field does not reset it', r.afterOther && r.afterOther.setting === 60,
       JSON.stringify(r.afterOther));
    ok('switching to explicit applies its 200 ms preset', r.switched && r.switched.setting === 200,
       JSON.stringify(r.switched));
    ok('switching back to masked applies 43 ms', r.back === 43, String(r.back));
    ok('no page errors', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[subliminal: timing set before Start is not overwritten]');
  {
    const p = await open(INDEX);
    const r = await p.evaluate(() => {
      const S = window.Subliminal;
      S.timing.prime = 50;
      S.timing.forwardMask = 333;
      S.timing.backwardMask = 111;
      S.timing.fixation = 777;
      try { S.start(); } catch (e) { /* trial screen may not be present */ }
      const after = {
        prime: S.timing.prime, forwardMask: S.timing.forwardMask,
        backwardMask: S.timing.backwardMask, fixation: S.timing.fixation
      };
      try { S.close(); } catch (e) { /* tidy */ }
      return after;
    });
    ok('prime duration survives Start', r.prime === 50, String(r.prime));
    ok('forward mask survives', r.forwardMask === 333, String(r.forwardMask));
    ok('backward mask survives', r.backwardMask === 111, String(r.backwardMask));
    ok('fixation survives', r.fixation === 777, String(r.fixation));
    await p.close();
  }

  console.log('\n[subliminal: end to end through a real participant link]');
  {
    const p = await open(INDEX);
    const link = await p.evaluate(() => {
      // exactly the shape Subliminal.checkUrlConfig reads
      const cfg = {
        template: 'subliminal-priming',
        experimenterEmail: 'x@y.com',
        userExperimentId: 'timing-check',
        timing: { prime: 50, forwardMask: 333, backwardMask: 111, fixation: 777 }
      };
      const enc = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
      return location.href.split('?')[0] + '?exp=' + encodeURIComponent(enc);
    });
    await p.close();

    const pp = await open(link);
    await new Promise(r => setTimeout(r, 1500));
    const r = await pp.evaluate(() => {
      const S = window.Subliminal;
      const fromLink = { ...S.timing };
      try { S.start(); } catch (e) { /* fine */ }
      const afterStart = {
        prime: S.timing.prime, forwardMask: S.timing.forwardMask,
        backwardMask: S.timing.backwardMask, fixation: S.timing.fixation
      };
      try { S.close(); } catch (e) { /* tidy */ }
      return { fromLink: fromLink, afterStart: afterStart, participant: S.isParticipantMode };
    });
    ok('the link was recognised', r.participant === true || r.fromLink.prime === 50,
       JSON.stringify(r.fromLink));
    ok('the link timing reached the module', r.fromLink.prime === 50, JSON.stringify(r.fromLink));
    ok('and SURVIVED pressing Start', r.afterStart.prime === 50, JSON.stringify(r.afterStart));
    ok('all four values intact',
       r.afterStart.forwardMask === 333 && r.afterStart.backwardMask === 111 && r.afterStart.fixation === 777,
       JSON.stringify(r.afterStart));
    await pp.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
