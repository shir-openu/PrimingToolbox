// The ABCD panel on every experiment's setup screen.
//
// Eleven paradigms got the panel from PTK.paintSetup when they were written.
// The six that predate the kit - stroop, semantic, evaluative, amp,
// number-priming, subliminal - paint their own setup screens and had no panel
// at all until 2026-08-11; they now call PTK.injectAbcd() instead of being
// rewritten. This checks all sixteen, so a paradigm cannot quietly lose it.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/abcd_panel.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

// The six that were retro-fitted, with the setup container each one owns.
const RETROFIT = [
  ['stroop', 'stroop-setup'],
  ['semantic', 'semantic-setup'],
  ['evaluative', 'evaluative-setup'],
  ['amp', 'amp-setup'],
  ['number-priming', 'number-priming-setup'],
  ['subliminal', 'subliminal-setup']
];

// The eleven that get it from paintSetup.
const KIT = ['affective', 'social', 'negative', 'masked', 'syntactic', 'repetition',
             'goal', 'moral', 'money', 'advertising'];

const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\./i;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files']
  });

  console.log('\n[the six retro-fitted paradigms]');
  for (const [key, setupId] of RETROFIT) {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });

    await page.goto(INDEX + '?open=' + key, { waitUntil: 'networkidle2' });

    const info = await page.evaluate(id => {
      const panel = document.getElementById(id + '-abcd-fab');
      const setup = document.getElementById(id);
      if (!panel || !setup) return { found: false };
      const txt = panel.textContent;
      // the panel must come BEFORE the Start button, not after it
      let beforeButton = true;
      for (const child of setup.children) {
        if (child.tagName === 'BUTTON') { beforeButton = false; break; }
        if (child === panel) break;
      }
      const link = panel.querySelector('a');

      // The four slot cards, read structurally. PTK.abcdPanel writes a bare
      // "-" as the value when a slot was left undefined, and matching that in
      // the whole panel's text would also hit every ordinary dash in the prose.
      const grid = panel.querySelector('div[style*="auto-fit"]');
      const slots = grid ? Array.from(grid.children).map(card => ({
        letter: card.children[0] ? card.children[0].textContent.trim() : '',
        value: card.children[2] ? card.children[2].textContent.trim() : ''
      })) : [];

      return {
        found: true,
        beforeButton: beforeButton,
        slotCount: slots.length,
        letters: slots.map(s => s.letter).join('') === 'ABCD',
        empty: slots.filter(s => !s.value || s.value === '-').map(s => s.letter),
        chars: /Association/i.test(txt) && /Secondariness/i.test(txt) && /Modulation/i.test(txt),
        href: link ? link.getAttribute('href') : null,
        len: txt.length
      };
    }, setupId);

    ok(key + ': panel present', info.found);
    if (info.found) {
      ok(key + ': sits above the Start button', info.beforeButton);
      ok(key + ': four slots, labelled A B C D', info.slotCount === 4 && info.letters,
         info.slotCount + ' slots');
      ok(key + ': no slot left empty', info.empty.length === 0, 'empty: ' + info.empty.join(','));
      ok(key + ': all three characteristics stated', info.chars);
      ok(key + ': links into the framework page',
         !!info.href && /article\/abcd-framework\.html/.test(info.href), String(info.href));
      ok(key + ': the text is real, not a stub', info.len > 500, String(info.len));
    }

    // idempotent: re-opening must not stack a second copy
    const twice = await page.evaluate(id => {
      const mod = { 'stroop-setup': 'Stroop', 'semantic-setup': 'Semantic',
                    'evaluative-setup': 'EvaluativeConditioning', 'amp-setup': 'AMP',
                    'number-priming-setup': 'NumberPriming', 'subliminal-setup': 'Subliminal' }[id];
      const m = window[mod];
      if (typeof m.open === 'function') m.open();
      else if (typeof m.showSetup === 'function') m.showSetup();
      return document.querySelectorAll('#' + id + ' > div[id$="-abcd-fab"]').length;
    }, setupId);
    ok(key + ': re-opening does not stack a second panel', twice === 1, String(twice));

    ok(key + ': no page errors', errs.length === 0, errs.join(' | '));
    await page.close();
  }

  console.log('\n[the paradigms that get it from paintSetup]');
  for (const key of KIT) {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(INDEX + '?open=' + key, { waitUntil: 'networkidle2' });
    const has = await page.evaluate(() => {
      const t = document.body.textContent;
      return /What is being measured: the ABCD framework/.test(t) &&
             /Association/i.test(t) && /Secondariness/i.test(t) && /Modulation/i.test(t);
    });
    ok(key + ': panel still rendered after the refactor', has);
    await page.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
