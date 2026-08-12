// Abandoning a Template Builder must leave the experiment runnable.
//
// goal_fab, money_fab and social_fab flatten their stimuli IN PLACE when the
// builder opens - {words:[5], embedded} becomes {wordsText, embedded} so a text
// table can edit them. spec.afterApply rebuilds the array, and it ran only from
// applyToModule: on Preview, on Generate link, on Check design.
//
// Close was a fourth way out, and it ran none of them. The module was left
// holding the flattened shape, and the next run reached PTK.scrambledPhase and
// shuffled undefined - "array is not iterable". Abandoning a builder is the
// most ordinary thing a user does, and it broke the experiment until reload.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/builder_close.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}
const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|platform_events|PTA:/i;

// The three that flatten in place, with the property each one destroys.
const FLATTENERS = [
  { global: 'GoalPriming',  key: 'goal',   prop: 'achievementItems' },
  { global: 'MoneyPriming', key: 'money',  prop: 'moneyItems' },
  { global: 'Social',       key: 'social', prop: 'primeItems' }
];

// Every module that wraps PTK.closeBuilder must pass itself through.
const ALL_KIT = ['GoalPriming', 'MoneyPriming', 'Social', 'MoralPriming', 'AdvertisingPriming',
                 'Affective', 'MaskedLexical', 'NegativePriming', 'RepetitionPriming',
                 'SyntacticPriming'];

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
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    await p.evaluateOnNewDocument(() => { window.alert = function () {}; });
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    p._errs = errs;
    return p;
  }

  console.log('\n[closing the builder restores the stimuli]');
  for (const m of FLATTENERS) {
    const p = await open();
    const r = await p.evaluate((g, key, prop) => {
      const mod = window[g];
      if (!mod) return { missing: true };
      const before = Array.isArray((mod.data[prop] || [])[0] && mod.data[prop][0].words);
      mod.openBuilder();
      const during = Array.isArray((mod.data[prop] || [])[0] && mod.data[prop][0].words);
      // the builder's OWN Close, not some other Close on the page - that
      // mistake made this look unfixed when it was already fixed
      const overlay = document.getElementById('ptk-builder-' + key);
      const x = overlay
        ? Array.from(overlay.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close')
        : null;
      if (x) x.click();
      const item = (mod.data[prop] || [])[0];
      return {
        missing: false,
        overlayExisted: !!overlay,
        clicked: !!x,
        wasArrayBefore: before,
        flattenedWhileOpen: during === false,
        restoredAfter: Array.isArray(item && item.words),
        wordCount: item && item.words ? item.words.length : 0,
        overlayGone: !document.getElementById('ptk-builder-' + key)
      };
    }, m.global, m.key, m.prop);

    ok(m.key + ': the builder opened', !r.missing && r.overlayExisted && r.clicked, JSON.stringify(r));
    ok(m.key + ': stimuli start as an array', r.wasArrayBefore);
    ok(m.key + ': the builder flattens them while open', r.flattenedWhileOpen);
    ok(m.key + ': closing REBUILDS the array', r.restoredAfter, JSON.stringify(r));
    ok(m.key + ': with its words intact', r.wordCount >= 4, String(r.wordCount));
    ok(m.key + ': the overlay is gone', r.overlayGone);
    await p.close();
  }

  console.log('\n[and the experiment still runs afterwards]');
  for (const m of FLATTENERS) {
    const p = await open();
    const r = await p.evaluate((g, key) => {
      const mod = window[g];
      mod.openBuilder();
      const overlay = document.getElementById('ptk-builder-' + key);
      const x = Array.from(overlay.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close');
      x.click();
      let threw = null;
      try { if (typeof mod.start === 'function') mod.start(); } catch (e) { threw = e.message; }
      try { if (typeof mod.close === 'function') mod.close(); } catch (e) { /* tidy up */ }
      return { threw: threw };
    }, m.global, m.key);
    ok(m.key + ': starting after Close does not throw', r.threw === null, String(r.threw));
    await p.close();
  }

  console.log('\n[every module passes itself to closeBuilder]');
  {
    const p = await open();
    const r = await p.evaluate((names) => {
      const out = {};
      names.forEach(function (g) {
        const mod = window[g];
        out[g] = mod && typeof mod.closeBuilder === 'function'
          ? /closeBuilder\s*\(\s*this\.spec\(\)\s*,\s*this\s*\)/.test(mod.closeBuilder.toString())
          : null;
      });
      return out;
    }, ALL_KIT);
    Object.keys(r).forEach(function (g) {
      ok(g + ': passes itself through', r[g] === true, String(r[g]));
    });
    await p.close();
  }

  console.log('\n[a broken afterApply cannot trap the user in the builder]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const spec = { key: 'zz-test', afterApply: function () { throw new Error('boom'); } };
      const div = document.createElement('div');
      div.id = 'ptk-builder-zz-test';
      document.body.appendChild(div);
      let threw = null;
      try { PTK.closeBuilder(spec, {}); } catch (e) { threw = e.message; }
      return { threw: threw, gone: !document.getElementById('ptk-builder-zz-test') };
    });
    ok('closeBuilder swallows the failure', r.threw === null, String(r.threw));
    ok('and still removes the overlay', r.gone);
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
