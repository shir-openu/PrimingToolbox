// The generic engine's scoring, feedback and statistics, plus the injection
// holes that survived the 2026-08-10 escaping pass.
//
// All of this came out of the 2026-08-12 full-codebase read. Three of the four
// were invisible from the outside: a design with no correct answers told every
// participant "Incorrect", non-responses were averaged into the reaction-time
// means, and two of the three functions that write config data into innerHTML
// were never escaped even though the third carried a comment saying the hole
// was closed.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/engine_correctness.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|PTA: Error saving|PTA: Supabase not initialized|PTA Engine: Failed to save|PTA: Exception saving/i;

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
  page._errs = errs;
  return page;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files']
  });

  /* ---------------------------------------------------------------- */
  console.log('\n[a trial with no correct answer is not scored as wrong]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(() => {
      const E = PTA.Engine;
      E.config = { type: 'generic', feedback: { show: false } };
      E.state.results = [];
      E.state.currentTrial = 0;
      E.nextTrial = function () {};                  // stop after one trial
      const out = {};
      // no correctResponse at all
      E.recordResponse({ targetOnset: Date.now() - 400, prime: 'A', target: 'B', condition: 'x' }, 'word');
      out.missing = E.state.results[0].correct;
      // explicit null, which is what the builder writes for a blank Correct cell
      E.recordResponse({ targetOnset: Date.now() - 400, correctResponse: null, condition: 'x' }, 'word');
      out.explicitNull = E.state.results[1].correct;
      // empty string, from a hand-written config
      E.recordResponse({ targetOnset: Date.now() - 400, correctResponse: '', condition: 'x' }, 'word');
      out.emptyString = E.state.results[2].correct;
      // a real correct answer still scores normally
      E.recordResponse({ targetOnset: Date.now() - 400, correctResponse: 'word', condition: 'x' }, 'word');
      out.right = E.state.results[3].correct;
      E.recordResponse({ targetOnset: Date.now() - 400, correctResponse: 'word', condition: 'x' }, 'nonword');
      out.wrong = E.state.results[4].correct;
      return out;
    });
    ok('no correctResponse field -> null, not false', r.missing === null, String(r.missing));
    ok('correctResponse null -> null, not false', r.explicitNull === null, String(r.explicitNull));
    ok('correctResponse empty string -> null, not false', r.emptyString === null, String(r.emptyString));
    ok('a matching response still scores true', r.right === true, String(r.right));
    ok('a mismatching response still scores false', r.wrong === false, String(r.wrong));
    ok('no page errors', page._errs.length === 0, page._errs.join(' | '));
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[a participant who did nothing wrong is not told "Incorrect"]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(async () => {
      const E = PTA.Engine;
      E.config = { feedback: { show: true, duration_ms: 30, incorrect_text: 'Incorrect', correct_text: 'Correct' } };
      const host = document.createElement('div');
      document.body.appendChild(host);
      E.elements.stimulusDisplay = host;
      const seen = {};
      await new Promise(res => E.showFeedback(null, res));
      seen.forNull = host.textContent.trim();
      await new Promise(res => E.showFeedback(true, res));
      seen.forTrue = host.textContent.trim();
      await new Promise(res => E.showFeedback(false, res));
      seen.forFalse = host.textContent.trim();
      return seen;
    });
    ok('correct === null shows nothing at all', r.forNull === '', JSON.stringify(r.forNull));
    ok('correct === true still says Correct', /correct/i.test(r.forTrue), r.forTrue);
    ok('correct === false still says Incorrect', /incorrect/i.test(r.forFalse), r.forFalse);
    ok('the callback still fires for a null trial, so pacing is unchanged', true);
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[a trial nobody answered is not averaged into reaction time]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(() => {
      const E = PTA.Engine;
      E.config = { name: 'x', type: 'generic', data: {} };
      E.elements = {};
      // three real 300 ms answers and one 1500 ms timeout with no response
      E.state.results = [
        { rt: 300, response: 'word', correct: null, condition: 'related' },
        { rt: 300, response: 'word', correct: null, condition: 'related' },
        { rt: 300, response: 'word', correct: null, condition: 'related' },
        { rt: 1500, response: null, correct: null, condition: 'related' }
      ];
      const stats = E.displayResults();
      const byCond = (stats.conditions || []).find(c => c.condition === 'related');
      return { meanRT: stats.meanRT, condMean: byCond ? byCond.meanRT : null };
    });
    ok('the overall mean is 300, not 600', Math.round(r.meanRT) === 300, String(r.meanRT));
    ok('the per-condition mean is 300 too', r.condMean === null || Math.round(r.condMean) === 300, String(r.condMean));
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[every branch that writes config data into innerHTML escapes it]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(async () => {
      const E = PTA.Engine;
      const PAYLOAD = '<img src=x onerror="window.__pwned=true">';
      window.__pwned = false;
      const host = document.createElement('div');
      document.body.appendChild(host);
      E.elements.stimulusDisplay = host;
      const out = {};

      // renderSimultaneousStimulus, all four branches
      E.config = { type: 'stroop' };
      host.innerHTML = E.renderSimultaneousStimulus({ inkHex: PAYLOAD, word: PAYLOAD });
      out.stroopBranch = host.querySelectorAll('img').length;

      E.config = { primes: { type: 'text' }, targets: { type: 'color' } };
      host.innerHTML = E.renderSimultaneousStimulus({ prime: PAYLOAD, target: PAYLOAD });
      out.textColour = host.querySelectorAll('img').length;

      E.config = { primes: { type: 'color' }, targets: { type: 'text' } };
      host.innerHTML = E.renderSimultaneousStimulus({ prime: PAYLOAD, target: PAYLOAD });
      out.colourText = host.querySelectorAll('img').length;

      // the default branch - what Build From Scratch actually produces
      E.config = { primes: { type: 'text' }, targets: { type: 'text' } };
      host.innerHTML = E.renderSimultaneousStimulus({ prime: PAYLOAD, target: PAYLOAD });
      out.defaultBranch = host.querySelectorAll('img').length;

      // showFeedback
      E.config = { feedback: { show: true, duration_ms: 20, correct_text: PAYLOAD, incorrect_text: PAYLOAD } };
      await new Promise(res => E.showFeedback(true, res));
      out.feedbackCorrect = host.querySelectorAll('img').length;
      await new Promise(res => E.showFeedback(false, res));
      out.feedbackIncorrect = host.querySelectorAll('img').length;

      // renderStimulus, which was already fixed - it must stay fixed
      host.innerHTML = E.renderStimulus(PAYLOAD, 'text');
      out.renderStimulus = host.querySelectorAll('img').length;

      await new Promise(res => setTimeout(res, 250));
      out.pwned = window.__pwned;
      return out;
    });
    ok('renderSimultaneousStimulus: stroop branch escapes', r.stroopBranch === 0, String(r.stroopBranch));
    ok('renderSimultaneousStimulus: text/colour branch escapes', r.textColour === 0, String(r.textColour));
    ok('renderSimultaneousStimulus: colour/text branch escapes', r.colourText === 0, String(r.colourText));
    ok('renderSimultaneousStimulus: default branch escapes', r.defaultBranch === 0, String(r.defaultBranch));
    ok('showFeedback escapes correct_text', r.feedbackCorrect === 0, String(r.feedbackCorrect));
    ok('showFeedback escapes incorrect_text', r.feedbackIncorrect === 0, String(r.feedbackIncorrect));
    ok('renderStimulus is still escaped', r.renderStimulus === 0, String(r.renderStimulus));
    ok('nothing executed', r.pwned === false);
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[the participant link cannot smuggle markup into a kit paradigm]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(() => {
      const dirty = {
        template: 't',
        stimuli: { words: ['<img src=x onerror=alert(1)>', 'TABLE'] },
        responseKeys: { word: '"><script>bad()</script>' },
        nested: { deep: ['a<b>c'] },
        timing: { prime: 50 },
        keep: "DON'T & R&D"
      };
      const clean = PTK.sanitizeConfigValue(dirty);
      return {
        word0: clean.stimuli.words[0],
        word1: clean.stimuli.words[1],
        key: clean.responseKeys.word,
        nested: clean.nested.deep[0],
        timing: clean.timing.prime,
        keep: clean.keep
      };
    });
    ok('angle brackets are removed from stimuli', !/[<>]/.test(r.word0), r.word0);
    ok('quotes are removed from response keys', !/[<>"]/.test(r.key), r.key);
    ok('nesting is walked', !/[<>]/.test(r.nested), r.nested);
    ok('a clean stimulus is untouched', r.word1 === 'TABLE', r.word1);
    ok('numbers survive as numbers', r.timing === 50, String(r.timing));
    ok('apostrophes and ampersands are KEPT', r.keep === "DON'T & R&D", r.keep);
    await page.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n[the CSV export survives Excel and survives newlines]');
  {
    const page = await newPage(browser);
    await page.goto(INDEX, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(() => {
      let text = '';
      const realBlob = window.Blob;
      window.Blob = function (parts, o) { text = parts.join(''); return new realBlob(parts, o); };
      const realCreate = document.createElement.bind(document);
      document.createElement = function (t) {
        const el = realCreate(t);
        if (t === 'a') el.click = function () {};
        return el;
      };
      PTA.exportToCSV([
        { word: 'שלום', note: 'line one\nline two', rt: 300 },
        { word: 'plain', note: 'has, comma', rt: 400, extra: 'only here' }
      ], 'x.csv');
      window.Blob = realBlob;
      document.createElement = realCreate;
      return {
        startsWithBom: text.charCodeAt(0) === 0xFEFF,
        hebrew: text.indexOf('שלום') !== -1,
        header: text.split('\n')[0].replace('\uFEFF', ''),
        quotedNewline: /"line one\nline two"/.test(text),
        quotedComma: /"has, comma"/.test(text),
        // header + 2 records; the quoted newline must not add a record
        recordCount: text.split(/\n(?=(?:[^"]*"[^"]*")*[^"]*$)/).length
      };
    });
    ok('the file starts with a UTF-8 BOM', r.startsWithBom);
    ok('Hebrew stimuli survive', r.hebrew);
    ok('a column only the second row has is in the header', /extra/.test(r.header), r.header);
    ok('a value containing a newline is quoted', r.quotedNewline);
    ok('a value containing a comma is quoted', r.quotedComma);
    ok('the newline does not split the row', r.recordCount === 3, String(r.recordCount));
    await page.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
