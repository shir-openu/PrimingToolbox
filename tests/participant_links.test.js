// Participant links must survive being a URL.
//
// Base64's alphabet includes '+' and '/'. A raw '+' in a query string decodes
// as a SPACE, so the payload comes back corrupted, PTA.decodeConfig returns
// null, and the participant lands on the ordinary landing page with nothing
// explaining why. The experimenter has no way to notice: the link they copied
// looks perfectly normal.
//
// Roughly one design in a few hundred by chance - and far more often with
// Hebrew, Arabic or Chinese stimuli, because non-ASCII spreads the byte values
// much wider. That is precisely this platform's use case.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/participant_links.test.js
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
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling']
  });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(INDEX, { waitUntil: 'networkidle2' });

  console.log('\n[the bug this file exists for]');
  {
    const r = await page.evaluate(() => {
      // hunt for a payload that actually contains '+'
      const words = ['\u05D0\u05D3\u05D5\u05DD', '\u05D9\u05E8\u05D5\u05E7', 'DOCTOR', '~t', 'a?b'];
      let hit = null;
      for (let i = 0; i < 4000 && !hit; i++) {
        const c = {
          name: 'n' + i, note: words[i % words.length] + i,
          primes: { type: 'text', items: [words[(i + 1) % words.length] + i] },
          targets: { type: 'text', items: ['NURSE' + i] },
          trials: { pairings: [{ primeIndex: 0, targetIndex: 0, condition: 'related', correctResponse: 'word' }], repetitions: 1 },
          conditions: ['related'], response: { keys: { word: 'ArrowRight' } }
        };
        const e = PTA.encodeConfig(c);
        if (e && e.indexOf('+') !== -1) hit = { cfg: c, enc: e };
      }
      if (!hit) return { found: false };
      const raw = new URLSearchParams('config=' + hit.enc).get('config');
      const safe = new URLSearchParams('config=' + encodeURIComponent(hit.enc)).get('config');
      return {
        found: true,
        rawCorrupted: raw !== hit.enc,
        rawDecodesToNull: PTA.decodeConfig(raw) === null,
        encodedRoundTrips: (function () {
          const d = PTA.decodeConfig(safe);
          return !!d && d.name === hit.cfg.name && d.note === hit.cfg.note;
        })()
      };
    });
    ok('a payload containing "+" can be produced', r.found);
    if (r.found) {
      ok('raw, it IS corrupted by the query string', r.rawCorrupted);
      ok('raw, it decodes to null - the link is dead', r.rawDecodesToNull);
      ok('percent-encoded, it round-trips perfectly', r.encodedRoundTrips);
    }
  }

  console.log('\n[every link builder percent-encodes]');
  {
    const r = await page.evaluate(() => {
      const cfg = {
        template: 'x', name: 'X',
        primes: { type: 'text', items: ['A'] }, targets: { type: 'text', items: ['B'] },
        trials: { pairings: [], repetitions: 1 }, conditions: [], response: { keys: {} }
      };
      const link = PTK.buildLink('exp', cfg);
      const payload = link.split('exp=')[1] || '';
      return {
        link: link.slice(0, 60),
        noRawPlus: payload.indexOf('+') === -1,
        // and it must still decode back to the same object
        decodes: (function () {
          const got = new URLSearchParams(link.split('?')[1]).get('exp');
          const d = PTK.decode(got);
          return !!d && d.name === 'X';
        })()
      };
    });
    ok('PTK.buildLink emits no raw "+"', r.noRawPlus, r.link);
    ok('PTK.buildLink still round-trips', r.decodes);
  }

  console.log('\n[an already-issued link without "+" still works]');
  {
    const r = await page.evaluate(() => {
      const cfg = { name: 'Old link', primes: { type: 'text', items: ['A'] },
                    targets: { type: 'text', items: ['B'] } };
      let enc = PTA.encodeConfig(cfg);
      if (enc.indexOf('+') !== -1) return { skipped: true };
      // exactly how an old link looked: raw, unencoded
      const got = new URLSearchParams('config=' + enc).get('config');
      const d = PTA.decodeConfig(got);
      return { skipped: false, works: !!d && d.name === 'Old link' };
    });
    ok('old raw links are not broken by the change', r.skipped || r.works, JSON.stringify(r));
  }

  console.log('\n[the whole chain, end to end, with a "+" payload]');
  {
    const link = await page.evaluate(() => {
      const words = ['\u05D0\u05D3\u05D5\u05DD', 'DOCTOR', '~t'];
      for (let i = 0; i < 4000; i++) {
        const cfg = {
          name: 'Plus test ' + i,
          experiment_type: 'custom',
          primes: { type: 'text', items: [words[i % 3] + i] },
          targets: { type: 'text', items: ['NURSE'] },
          trials: { pairings: [{ primeIndex: 0, targetIndex: 0, condition: 'related', correctResponse: 'word' }], repetitions: 1 },
          conditions: ['related'],
          response: { keys: { word: 'ArrowRight' } },
          presentation: { mode: 'sequential' },
          data: { save_to_supabase: false }
        };
        const e = PTA.encodeConfig(cfg);
        if (e && e.indexOf('+') !== -1) {
          return location.href.split('?')[0] + '?config=' + encodeURIComponent(e);
        }
      }
      return null;
    });
    ok('built a link whose payload contains "+"', !!link);
    if (link) {
      const p2 = await browser.newPage();
      await p2.setCacheEnabled(false);
      await p2.goto(link, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1500));
      const landed = await p2.evaluate(() => ({
        name: (window.currentConfig && window.currentConfig.name) || null,
        text: document.body.innerText.slice(0, 200)
      }));
      ok('the participant page decodes it', !!landed.name && /Plus test/.test(landed.name),
         String(landed.name));
      await p2.close();
    }
  }

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
