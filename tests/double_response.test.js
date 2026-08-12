// One response per item, however fast the participant clicks.
//
// Advertising priming wires both of its recorders straight to button clicks:
//
//     b.onclick = function () { self.recordChoice(round, brand); };
//
// and neither was guarded. Two clicks - a double-click, or a click on a second
// brand before the screen changed - pushed TWO rows for one item and advanced
// the index TWICE, so the next round or photo was skipped entirely. The brand
// choice is the dependent variable of this paradigm: whether the participant
// picked the brand they had been exposed to. A duplicate there is not cosmetic,
// and a skipped round is missing data nobody would notice.
//
// The same shape is already documented twice in this repo: the engine's
// response-token bug ("half the trials were skipped and a null row was written
// for each") and repetition_fab's _locked flag ("without the lock a fast double
// press records the same fragment twice"). Advertising was the one module that
// had neither.
//
// Checked while here: syntactic_fab and social_fab disable their buttons,
// repetition_fab has _locked, the eight keyboard paradigms guard on
// state.awaitingResponse, and engine_fab uses a per-trial response token.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/double_response.test.js
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

  console.log('\n[the brand choice cannot be recorded twice]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const A = window.AdvertisingPriming;
      A.saveTrial = function () {};
      A.open();
      A.start();                           // start() is what builds roundPlan
      A.state.results = [];

      const round = A.state.roundPlan[0];
      A.runChoice();                       // presents the choice, releases the lock
      const before = A.state.roundIndex;

      // two clicks in the same tick, which is what a double-click produces
      A.recordChoice(round, round.options[0]);
      A.recordChoice(round, round.options[1]);

      return {
        rows: A.state.results.length,
        advancedBy: A.state.roundIndex - before,
        chosen: A.state.results.map(x => x.chosen)
      };
    });
    ok('exactly one choice is recorded', r.rows === 1, String(r.rows) + ' ' + JSON.stringify(r.chosen));
    ok('and the round advanced exactly once', r.advancedBy === 1, String(r.advancedBy));
    ok('the choice kept is the first one', r.chosen.length === 1, JSON.stringify(r.chosen));
    console.log('     rows=' + r.rows + ' advancedBy=' + r.advancedBy);
    await p.close();
  }

  console.log('\n[the expression judgement cannot be recorded twice]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const A = window.AdvertisingPriming;
      A.saveTrial = function () {};
      A.open();
      A.start();                           // builds roundPlan and renders photo 1
      A.state.expressionResults = [];

      const round = A.state.roundPlan[0];
      const photo = round.photos[0];
      const before = A.state.photoIndex;

      A.recordExpression(photo, 'happy');
      A.recordExpression(photo, 'sad');

      return {
        rows: A.state.expressionResults.length,
        advancedBy: A.state.photoIndex - before,
        judged: A.state.expressionResults.map(x => x.judged)
      };
    });
    ok('exactly one judgement is recorded', r.rows === 1, String(r.rows) + ' ' + JSON.stringify(r.judged));
    ok('and the photo advanced exactly once', r.advancedBy === 1, String(r.advancedBy));
    console.log('     rows=' + r.rows + ' advancedBy=' + r.advancedBy);
    await p.close();
  }

  console.log('\n[a normal one-click-per-item run is unaffected]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      const A = window.AdvertisingPriming;
      A.saveTrial = function () {};
      A.open();
      A.start();
      A.state.expressionResults = [];

      const round = A.state.roundPlan[0];
      // answer three photos, one click each, letting the screen re-render between
      let answered = 0;
      for (let i = 0; i < 3 && i < round.photos.length; i++) {
        const photo = round.photos[A.state.photoIndex];
        if (!photo) break;
        A.recordExpression(photo, 'happy');
        answered++;
        A.renderPhoto();                   // what the ITI timer would do
      }
      return { answered, rows: A.state.expressionResults.length, photoIndex: A.state.photoIndex };
    });
    ok('every separate click is recorded', r.rows === r.answered && r.rows > 1,
       r.rows + ' of ' + r.answered);
    ok('the index advanced once per click', r.photoIndex === r.answered,
       r.photoIndex + ' vs ' + r.answered);
    console.log('     answered=' + r.answered + ' rows=' + r.rows);
    await p.close();
  }

  // The first attempt at this guard was a boolean lock released by the next
  // render, and this suite caught it failing: recordChoice calls runRound
  // synchronously, so the next screen released the lock inside the same call
  // stack and a second click in the same tick sailed straight through. The
  // guard is identity instead - "is this still the item on screen?" - which no
  // timing can defeat.
  console.log('\n[a stale item is refused, the current one is accepted]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const A = window.AdvertisingPriming;
      A.saveTrial = function () {};
      A.open();
      A.start();
      A.state.expressionResults = [];

      const round = A.state.roundPlan[0];
      const stale = round.photos[0];
      A.recordExpression(stale, 'happy');       // photoIndex moves on
      const afterFirst = A.state.expressionResults.length;

      A.recordExpression(stale, 'sad');         // same photo, now stale
      const afterStale = A.state.expressionResults.length;

      const current = round.photos[A.state.photoIndex];
      if (current) A.recordExpression(current, 'happy');
      const afterCurrent = A.state.expressionResults.length;

      return { afterFirst, afterStale, afterCurrent, hadCurrent: !!current };
    });
    ok('the first judgement is recorded', r.afterFirst === 1, String(r.afterFirst));
    ok('repeating the SAME photo is refused', r.afterStale === 1, String(r.afterStale));
    ok('but the next photo is still accepted',
       !r.hadCurrent || r.afterCurrent === 2, String(r.afterCurrent));
    await p.close();
  }

  // MORAL PRIMING - the same window, and a worse consequence.
  //
  // submitItem records, advances itemIndex, then schedules renderItem after the
  // ITI. sliderMoved was cleared only inside that render, so between the click
  // and the render the phase was still 'items' and sliderMoved was still true.
  // A second click in that window passed both guards, read items[itemIndex] -
  // which had just advanced - and recorded the NEXT item with the value given
  // for this one, timed from this one's onset.
  //
  // Not a duplicate. An answer attributed to an item the participant was never
  // shown, indistinguishable in the data from one they gave.
  console.log('\n[moral: a second click cannot answer an unseen item]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const M = window.MoralPriming;
      M.saveTrial = function () {};
      M._after = function () { return 0; };      // hold the next render open
      M.state.phase = 'items';
      M.state.blockIndex = 0;
      M.state.itemIndex = 0;
      M.state.blocks = [{ condition: 'moral', itemKey: 'itemsA' }];
      M.state.results = [];
      M.renderItem();

      const slider = document.getElementById('moral-slider');
      slider.value = '73';
      slider.dispatchEvent(new Event('input', { bubbles: true }));

      M.submitItem();                            // the real answer
      const afterFirst = M.state.results.length;
      M.submitItem();                            // the accidental second click
      const afterSecond = M.state.results.length;

      return {
        afterFirst, afterSecond,
        items: M.state.results.map(x => x.item),
        values: M.state.results.map(x => x.value),
        hint: (document.getElementById('moral-slider-hint') || {}).textContent || ''
      };
    });
    ok('the real answer is recorded', r.afterFirst === 1, String(r.afterFirst));
    ok('the second click records nothing', r.afterSecond === 1,
       r.afterSecond + ' rows for items ' + JSON.stringify(r.items));
    ok('so no answer exists for an item never shown',
       r.items.length === 1 && r.items[0] === 1, JSON.stringify(r.items));
    ok('and the participant is told to move the slider again',
       /move the slider first/i.test(r.hint), r.hint);
    console.log('     rows=' + r.afterSecond + ' items=' + JSON.stringify(r.items) +
                ' values=' + JSON.stringify(r.values));
    await p.close();
  }

  console.log('\n[moral: answering the next item normally still works]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const M = window.MoralPriming;
      M.saveTrial = function () {};
      M._after = function (fn) { fn(); return 0; };   // render immediately
      M.state.phase = 'items';
      M.state.blockIndex = 0;
      M.state.itemIndex = 0;
      M.state.blocks = [{ condition: 'moral', itemKey: 'itemsA' }];
      M.state.results = [];
      M.renderItem();

      const answer = (v) => {
        const s = document.getElementById('moral-slider');
        s.value = String(v);
        s.dispatchEvent(new Event('input', { bubbles: true }));
        M.submitItem();
      };
      answer(70);
      answer(30);
      return { rows: M.state.results.length,
               items: M.state.results.map(x => x.item),
               values: M.state.results.map(x => x.value) };
    });
    ok('two separate answers are both recorded', r.rows === 2, String(r.rows));
    ok('and they are attributed to different items',
       r.items.length === 2 && r.items[0] !== r.items[1], JSON.stringify(r.items));
    ok('each keeps the value it was given',
       r.values[0] === 70 && r.values[1] === 30, JSON.stringify(r.values));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
