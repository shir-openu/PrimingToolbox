// The keys on screen must be the keys the task accepts.
//
// Two trial screens told participants to press keys that did nothing:
//
//   Number Priming  "Press E = Smaller than 5, I = Larger than 5"
//                   the handler accepts only ArrowLeft / ArrowRight
//   Subliminal      "Press F = Nonword, J = Word"
//                   handleKeydown accepts only arrowleft / arrowright
//
// Both are the hint shown DURING the trials, once the setup instructions are
// gone - which is exactly when a participant looks down to check. Pressing the
// named key did nothing, the trial timed out, and the row was recorded as a
// non-response. A participant who trusted the screen produced a run of
// timeouts and no error anywhere.
//
// Number Priming's keys are configurable in its builder, so no fixed text could
// ever have been right; its hint is now generated from the same two variables
// as the key legend.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/response_keys.test.js
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

  async function open(key) {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    await p.evaluateOnNewDocument(() => { window.alert = function () {}; });
    await p.goto(INDEX + (key ? '?open=' + key : ''), { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 700));
    p._errs = errs;
    return p;
  }

  console.log('\n[number priming: the hint matches the handler]');
  {
    const p = await open('number-priming');
    const r = await p.evaluate(() => {
      NumberPriming.renderResponseKeys();
      const h = document.getElementById('np-response-hint');
      return {
        hint: h ? h.innerText.replace(/\s+/g, ' ').trim() : '(missing)',
        smaller: NumberPriming.builderSettings.keySmaller || 'ArrowLeft',
        larger: NumberPriming.builderSettings.keyLarger || 'ArrowRight'
      };
    });
    ok('the hint element exists', r.hint !== '(missing)');
    ok('it no longer names E or I as the keys',
       !/press\s*<?\s*E\b/i.test(r.hint) && !/=\s*E\b/i.test(r.hint), r.hint);
    ok('it shows the arrows the handler accepts', /←/.test(r.hint) && /→/.test(r.hint), r.hint);
    ok('the handler really uses arrows',
       /arrow/i.test(r.smaller) && /arrow/i.test(r.larger), r.smaller + '/' + r.larger);
    console.log('     ' + r.hint);

    const custom = await p.evaluate(() => {
      NumberPriming.builderSettings.keySmaller = 'q';
      NumberPriming.builderSettings.keyLarger = 'p';
      NumberPriming.renderResponseKeys();
      const h = document.getElementById('np-response-hint');
      return h ? h.innerText.replace(/\s+/g, ' ').trim() : '';
    });
    ok('it follows keys chosen in the builder', /q/.test(custom) && /p/.test(custom), custom);
    ok('no page errors', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[subliminal: the hint matches the handler]');
  {
    const p = await open('subliminal');
    const r = await p.evaluate(() => {
      const h = document.getElementById('subliminal-response-hint');
      const src = String(Subliminal.handleKeydown);
      return {
        hint: h ? h.innerText.replace(/\s+/g, ' ').trim() : '(missing)',
        acceptsArrows: /arrowleft/i.test(src) && /arrowright/i.test(src),
        acceptsFJ: /['"]f['"]/.test(src) && /['"]j['"]/.test(src)
      };
    });
    ok('the hint element exists', r.hint !== '(missing)');
    ok('the handler accepts arrow keys', r.acceptsArrows);
    ok('the handler does NOT accept F or J', !r.acceptsFJ);
    ok('the hint no longer names F or J', !/=\s*Nonword/.test(r.hint) || !/\bF\b/.test(r.hint), r.hint);
    ok('the hint names LEFT and RIGHT', /left/i.test(r.hint) && /right/i.test(r.hint), r.hint);
    console.log('     ' + r.hint);
    ok('no page errors', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  console.log('\n[no trial screen anywhere names a letter key it does not use]');
  {
    // A sweep rather than a claim about any one experiment: the response hints
    // are what a participant reads mid-trial, so none of them may name a bare
    // letter unless that letter is genuinely a response key somewhere.
    const p = await open(null);
    const r = await p.evaluate(() => {
      const hints = Array.from(document.querySelectorAll('.response-hint'));
      return hints.map(h => ({
        id: h.id || '(no id)',
        text: h.innerText.replace(/\s+/g, ' ').trim()
      }));
    });
    ok('every response hint has an id, so a module can own it',
       r.every(h => h.id !== '(no id)'), JSON.stringify(r.map(h => h.id)));
    const suspicious = r.filter(h => /=\s*[A-Z]\b/.test(h.text) && !/←|→|LEFT|RIGHT|ARROW/i.test(h.text));
    ok('no hint names a bare letter without an arrow', suspicious.length === 0,
       JSON.stringify(suspicious));
    console.log('     hints found: ' + r.length);
    r.forEach(h => console.log('       ' + h.id + ': ' + h.text.slice(0, 70)));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
