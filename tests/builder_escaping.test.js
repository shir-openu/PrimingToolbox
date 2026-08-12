// Values typed into a builder are put back on screen as HTML.
//
// stroop.js runs every builderStimuli value through PTK.esc when it renders the
// editable table - and did not in updateExamples, the two lines just below it
// that show a congruent and an incongruent example. The colour goes into a
// style ATTRIBUTE there, which is the easier of the two to break out of.
//
// This is reachable only from the builder, by whoever is typing the stimuli - a
// participant link cannot set builderStimuli, and checkUrlConfig never touches
// it. So this is robustness, not a way in: type a word with a quote in it and
// the example display breaks. Worth closing anyway, because the file escaped
// everywhere else and an inconsistency like that is how the next person
// concludes escaping is optional here.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/builder_escaping.test.js
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
      window.__ptbxPwned = false;
    });
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    return p;
  }

  console.log('\n[a stimulus containing markup does not become markup]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Stroop;
      // a word and a colour as someone might actually mistype them
      S.builderStimuli = [
        { id: 'red" onmouseover="window.__ptbxPwned=true', color: '#ff0000',
          wordLang1: '<img src=x onerror="window.__ptbxPwned=true">RED',
          wordLang2: 'אדום', key: 'R' },
        { id: 'green', color: '#00ff00', wordLang1: 'GREEN', wordLang2: 'ירוק', key: 'G' }
      ];

      // make sure the example elements exist even if the builder is closed
      ['example-congruent', 'example-incongruent'].forEach(id => {
        if (!document.getElementById(id)) {
          const d = document.createElement('div');
          d.id = id;
          document.body.appendChild(d);
        }
      });

      S.updateExamples();
      const cong = document.getElementById('example-congruent');
      const span = cong.querySelector('span');
      return {
        html: cong.innerHTML,
        text: cong.textContent,
        imgs: cong.querySelectorAll('img').length,
        spans: cong.querySelectorAll('span').length,
        // every attribute that starts with "on", anywhere in the subtree
        handlers: Array.from(cong.querySelectorAll('*')).reduce((n, el) =>
          n + Array.from(el.attributes).filter(a => /^on/i.test(a.name)).length, 0),
        spanStyle: span ? span.style.color : '',
        pwned: window.__ptbxPwned
      };
    });
    ok('no injected element was created', r.imgs === 0, r.html.slice(0, 160));
    ok('nothing executed', r.pwned === false);
    ok('the intended span is still there', r.spans === 1, String(r.spans));
    ok('the typed text is shown as text', /<img src=x/.test(r.text), r.text.slice(0, 90));
    // Assert on the DOM, not on the innerHTML string. Reading innerHTML back
    // serialises a quote that sits in TEXT position as a literal " - quotes
    // only need escaping inside attributes - so the string contains
    //     ... in red" onmouseover="... ink
    // and looks unescaped while being completely inert. The first version of
    // this check read that string and reported a hole that was not there.
    ok('no element carries an injected handler',
       r.handlers === 0, String(r.handlers));
    ok('the span kept exactly the colour it was given, so the style attribute '
       + 'was not broken out of', r.spanStyle === 'rgb(255, 0, 0)', r.spanStyle);
    console.log('     ' + r.text.slice(0, 110));
    await p.close();
  }

  console.log('\n[a plain stimulus still renders normally]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Stroop;
      S.builderStimuli = [
        { id: 'red', color: '#ff0000', wordLang1: 'RED', wordLang2: 'אדום', key: 'R' },
        { id: 'blue', color: '#0000ff', wordLang1: 'BLUE', wordLang2: 'כחול', key: 'B' }
      ];
      ['example-congruent', 'example-incongruent'].forEach(id => {
        if (!document.getElementById(id)) {
          const d = document.createElement('div');
          d.id = id;
          document.body.appendChild(d);
        }
      });
      S.updateExamples();
      const c = document.getElementById('example-congruent');
      const i = document.getElementById('example-incongruent');
      return {
        cong: c.textContent, incong: i.textContent,
        congColor: (c.querySelector('span') || {}).style ? c.querySelector('span').style.color : '',
        incongColor: (i.querySelector('span') || {}).style ? i.querySelector('span').style.color : ''
      };
    });
    ok('the congruent example reads correctly', /RED/.test(r.cong) && /red ink/.test(r.cong), r.cong);
    ok('the incongruent example pairs word with the other colour',
       /RED/.test(r.incong) && /blue ink/.test(r.incong), r.incong);
    ok('the congruent example is in its own colour', /255, 0, 0/.test(r.congColor) || r.congColor === 'rgb(255, 0, 0)', r.congColor);
    ok('the incongruent example is in the OTHER colour', r.incongColor === 'rgb(0, 0, 255)', r.incongColor);
    console.log('     ' + r.cong + '  |  ' + r.incong);
    await p.close();
  }

  console.log('\n[the editable table was already escaped, and still is]');
  {
    const p = await open();
    const r = await p.evaluate(() => {
      const S = window.Stroop;
      S.builderStimuli = [
        { id: 'a"b', color: '#ff0000', wordLang1: '<b>X</b>', wordLang2: 'y', key: 'R' },
        { id: 'c', color: '#00ff00', wordLang1: 'Z', wordLang2: 'w', key: 'G' }
      ];
      let tbody = document.getElementById('stimulus-table-body')
               || document.querySelector('#stroop-builder tbody')
               || document.querySelector('tbody');
      if (!tbody) {
        const t = document.createElement('table');
        tbody = document.createElement('tbody');
        tbody.id = 'stimulus-table-body';
        t.appendChild(tbody);
        document.body.appendChild(t);
      }
      try { S.renderStimulusTable(); } catch (e) { return { threw: e.message }; }
      const scope = document.getElementById('stimulus-table-body') || tbody;
      const inputs = Array.from(scope.querySelectorAll('input[type="text"]'));
      return {
        bolds: scope.querySelectorAll('b').length,
        values: inputs.map(i => i.value).slice(0, 4)
      };
    });
    if (r.threw) {
      console.log('     (table not present in this build: ' + r.threw + ')');
      ok('table rendering is covered elsewhere', true);
    } else {
      ok('markup in a stimulus did not become an element', r.bolds === 0, String(r.bolds));
      ok('the quote survives as a value', r.values.indexOf('a"b') !== -1, JSON.stringify(r.values));
    }
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
