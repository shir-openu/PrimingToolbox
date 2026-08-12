// Can a user change a template and adjust it into their own experiment?
//
// Shir asked exactly that on 2026-08-12, and the honest answer needed testing
// rather than assuming. Two things were wrong. The Subliminal builder threw
// "Cannot read properties of null" on index.html, because its overlay markup
// only ever existed in an untracked standalone page - so one paradigm of
// sixteen could not be edited at all. And the Stroop builder accepted every
// edit but Preview ignored them: the stimulus mapping lived only inside
// checkUrlConfig, so an experimenter who changed the colours, words or keys and
// pressed Preview watched the DEFAULT experiment run with no warning.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/template_editing.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

// every paradigm, with the global its builder hangs off
const ALL = [
  ['stroop', 'Stroop'], ['semantic', 'Semantic'], ['number-priming', 'NumberPriming'],
  ['subliminal', 'Subliminal'], ['amp', 'AMP'], ['evaluative', 'EvaluativeConditioning'],
  ['affective', 'Affective'], ['social', 'Social'], ['negative', 'NegativePriming'],
  ['masked', 'MaskedLexical'], ['syntactic', 'SyntacticPriming'], ['repetition', 'RepetitionPriming'],
  ['goal', 'GoalPriming'], ['moral', 'MoralPriming'], ['money', 'MoneyPriming'],
  ['advertising', 'AdvertisingPriming']
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });

  console.log('\n[every paradigm opens a builder without throwing]');
  for (const [key, global] of ALL) {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await page.evaluate((g) => {
      const m = window[g];
      if (!m) return { noModule: true };
      if (typeof m.openBuilder !== 'function') return { noBuilder: true };
      // an alert() from a guarded builder must not hang the test
      window.alert = function () {};
      let threw = null;
      try { m.openBuilder(); } catch (e) { threw = e.message; }
      const fields = Array.from(document.querySelectorAll('input,select,textarea'))
        .filter(el => el.offsetParent !== null).length;
      return { threw: threw, fields: fields };
    }, global);

    ok(key + ': the module exists', !r.noModule);
    ok(key + ': it has a Template Builder', !r.noBuilder);
    ok(key + ': opening it does not throw', !r.threw, r.threw || '');
    await page.close();
  }

  console.log('\n[a Stroop edit reaches the Preview, not just the link]');
  {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(() => {
      const S = window.Stroop;
      // edit the template the way the builder table does
      S.builderStimuli = [
        { id: 'red', color: '#123456', wordLang1: 'CRIMSON', wordLang2: 'ARGAMAN', key: 'Q' },
        { id: 'green', color: '#654321', wordLang1: 'EMERALD', wordLang2: 'BAREKET', key: 'W' }
      ];
      const l1 = document.getElementById('builder-lang1');
      const l2 = document.getElementById('builder-lang2');
      if (l1) l1.value = 'en';
      if (l2) l2.value = 'he';
      S.closeBuilder = function () {};
      S.open = function () {};                  // stop before the overlay
      S.previewFromBuilder();
      return {
        colours: Object.keys(S.data.colors),
        redHex: S.data.colors.red ? S.data.colors.red.hex : null,
        redKey: S.data.colors.red ? S.data.colors.red.keys[0] : null,
        wordEn: S.data.words.en ? S.data.words.en.red : null,
        wordHe: S.data.words.he ? S.data.words.he.red : null
      };
    });
    ok('the edited colour reaches the experiment', r.redHex === '#123456', String(r.redHex));
    ok('the edited response key reaches it', r.redKey === 'q', String(r.redKey));
    ok('the edited English word reaches it', r.wordEn === 'CRIMSON', String(r.wordEn));
    ok('the edited Hebrew word reaches it', r.wordHe === 'ARGAMAN', String(r.wordHe));
    ok('only the edited stimuli are used', r.colours.length === 2, r.colours.join(','));
    await page.close();
  }

  console.log('\n[the Subliminal builder says what is wrong instead of dying]');
  {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(() => {
      let alerted = null;
      window.alert = function (m) { alerted = m; };
      let messaged = null;
      if (window.PTA) {
        const real = PTA.showMessage;
        PTA.showMessage = function (m) { messaged = m; if (real) try { real.apply(PTA, arguments); } catch (e) {} };
      }
      let threw = null;
      try { window.Subliminal.openBuilder(); } catch (e) { threw = e.message; }
      return { threw: threw, told: messaged || alerted };
    });
    ok('it does not throw', !r.threw, r.threw || '');
    ok('it tells the user why', !!r.told && /not available/i.test(r.told), String(r.told).slice(0, 90));
    ok('it points somewhere useful', !!r.told && /from-scratch|default/i.test(r.told), String(r.told).slice(0, 120));
    ok('no page error', errs.length === 0, errs.join(' | '));
    await page.close();
  }

  console.log('\n[?edit= links straight to a builder]');
  {
    // Shir asked for links she could follow to see where a user changes a
    // template. There were none: a builder took three clicks through the
    // chooser and had no URL. index.html?edit=<type> now opens one directly.
    for (const key of ['stroop', 'semantic', 'amp', 'number-priming', 'goal', 'masked']) {
      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      const errs = [];
      page.on('pageerror', e => errs.push(e.message));
      await page.evaluateOnNewDocument(() => { window.alert = function () {}; });
      await page.goto(INDEX + '?edit=' + key, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 800));
      const r = await page.evaluate(() => ({
        fields: Array.from(document.querySelectorAll('input,select,textarea'))
          .filter(e => e.offsetParent !== null).length,
        sel: (document.getElementById('experimentSelect') || {}).value
      }));
      ok('?edit=' + key + ' opens an editable builder', r.fields >= 10 && r.sel === key,
         'fields=' + r.fields + ' selected=' + r.sel);
      ok('?edit=' + key + ': no page error', errs.length === 0, errs.join(' | '));
      await page.close();
    }

    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(INDEX + '?edit=not-a-real-experiment', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));
    const opened = await page.evaluate(() => !!document.querySelector('[id^="ptk-builder"]'));
    ok('an unknown ?edit= type opens nothing', opened === false);
    ok('unknown type: no page error', errs.length === 0, errs.join(' | '));
    await page.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
