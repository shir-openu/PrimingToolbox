// The CSV download had no tests, and it is the file the analysis is done on.
//
// Eight modules built their rows with
//     row.map(cell => `"${cell}"`).join(',')
// which wraps every cell in quotes and escapes nothing inside them. A value
// containing a double quote produced
//     "he said "hello""
// and every CSV parser reads that as the field ending after `he said `, so the
// rest of that row shifts left by one column and stops lining up with the
// header. Stimuli are typed by the experimenter, so a quote character is
// entirely reachable - and the corruption is silent: the file opens, it just
// says the wrong things.
//
// All eight now go through PTA.csvCell, which is the rule PTA.exportToCSV was
// already using.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/csv_export.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

// A real CSV parser, so the assertions are about what a spreadsheet would see
// rather than about the string we happened to emit.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
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
      // capture the download instead of performing it
      window.__csv = null;
      const RealBlob = window.Blob;
      window.Blob = function (parts, opts) {
        try { window.__csv = parts.join(''); } catch (e) {}
        return new RealBlob(parts, opts);
      };
      window.URL.createObjectURL = function () { return 'blob:stub'; };
      window.addEventListener('DOMContentLoaded', function () {
        HTMLAnchorElement.prototype.click = function () {};
      });
    });
    await p.goto(INDEX, { waitUntil: 'networkidle2' });
    return p;
  }

  console.log('\n[the cell rule]');
  {
    const p = await open();
    const r = await p.evaluate(() => ({
      plain: PTA.csvCell('hello'),
      number: PTA.csvCell(450),
      nul: PTA.csvCell(null),
      undef: PTA.csvCell(undefined),
      comma: PTA.csvCell('a,b'),
      quote: PTA.csvCell('he said "hello"'),
      newline: PTA.csvCell('line1\nline2'),
      hebrew: PTA.csvCell('אדום')
    }));
    ok('plain text is not quoted', r.plain === 'hello', r.plain);
    ok('a number stays a number, not text', r.number === '450', r.number);
    ok('null becomes empty, not "null"', r.nul === '', JSON.stringify(r.nul));
    ok('undefined becomes empty', r.undef === '', JSON.stringify(r.undef));
    ok('a comma forces quoting', r.comma === '"a,b"', r.comma);
    ok('an inner quote is DOUBLED', r.quote === '"he said ""hello"""', r.quote);
    ok('a newline forces quoting', r.newline === '"line1\nline2"', JSON.stringify(r.newline));
    ok('Hebrew needs no quoting', r.hebrew === 'אדום', r.hebrew);
    await p.close();
  }

  console.log('\n[a stimulus containing a quote no longer shifts the columns]');
  {
    const p = await open();
    const csv = await p.evaluate(() => {
      const S = window.Semantic;
      S.state.results = [
        { prime: 'he said "hi"', target: 'doctor', targetType: 'word',
          condition: 'related', response: 'word', correct: true, rt: 512, soa: 200 },
        { prime: 'plain', target: 'a,b', targetType: 'word',
          condition: 'unrelated', response: 'word', correct: false, rt: 640, soa: 200 }
      ];
      window.__csv = null;
      S.exportCSV();
      return window.__csv;
    });
    ok('a CSV was produced', !!csv, String(csv).slice(0, 60));

    if (csv) {
      const rows = parseCSV(csv.replace(/^\uFEFF/, ''));
      const header = rows[0];
      ok('the file starts with a BOM so Excel reads Hebrew',
         csv.charCodeAt(0) === 0xFEFF, 'first char ' + csv.charCodeAt(0));
      ok('every row has exactly as many fields as the header',
         rows.every(r => r.length === header.length),
         rows.map(r => r.length).join(','));
      const primeIdx = header.indexOf('Prime');
      const targetIdx = header.indexOf('Target');
      ok('the quoted stimulus survives intact',
         rows[1][primeIdx] === 'he said "hi"', JSON.stringify(rows[1][primeIdx]));
      ok('a stimulus with a comma stays one field',
         rows[2][targetIdx] === 'a,b', JSON.stringify(rows[2][targetIdx]));
      ok('the reaction time is still in the RT column',
         rows[1][header.indexOf('RT (ms)')] === '512',
         JSON.stringify(rows[1][header.indexOf('RT (ms)')]));
    }
    await p.close();
  }

  console.log('\n[the same holds for the other hand-rolled exporters]');
  {
    const p = await open();
    const out = await p.evaluate(() => {
      const results = {};

      const run = (name, prepare) => {
        try {
          window.__csv = null;
          prepare();
          results[name] = window.__csv;
        } catch (e) {
          results[name] = 'THREW: ' + e.message;
        }
      };

      run('stroop', () => {
        const M = window.Stroop;
        // Stroop prints the WORD LIST, not the result row: it looks up
        // data.words[language][wordMeaning]. The experimenter edits that list,
        // so the quote has to be planted where it could really appear.
        M.data.words.en.red = 'the "RED" one';
        M.state.results = [{ language: 'en', wordMeaning: 'red', inkColor: 'green',
                             congruent: false, response: 'g', correct: true, rt: 500 }];
        M.exportCSV();
      });
      run('amp', () => {
        const M = window.AMP;
        // the column is Prime ID, so that is the field that must survive
        M.state.results = [{ trialNumber: 1, primeType: 'positive', primeId: 'a"b',
                             target: '會', response: 'pleasant', rt: 500 }];
        M.exportCSV();
      });
      run('evaluative', () => {
        const M = window.EvaluativeConditioning;
        M.state.testResults = [{ csId: 'cs1', csLabel: 'Shape "A"', pairedValence: 'positive',
                                 rating: 6, rt: 900 }];
        M.state.learningResults = [];
        M.exportCSV();
      });
      return results;
    });

    Object.keys(out).forEach(name => {
      const csv = out[name];
      if (typeof csv !== 'string' || csv.startsWith('THREW')) {
        ok(name + ': produced a CSV', false, String(csv).slice(0, 90));
        return;
      }
      const rows = parseCSV(csv.replace(/^\uFEFF/, '')).filter(r => r.length > 1);
      const widths = Array.from(new Set(rows.map(r => r.length)));
      ok(name + ': every row lines up with its header (' + widths.join('/') + ' fields)',
         widths.length === 1, JSON.stringify(rows.slice(0, 3)));
      ok(name + ': the embedded quote survives',
         csv.includes('""'), csv.slice(0, 120));
    });
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
