// The recruitment-platform ID: a feature that was half-built for months.
//
// What existed: PTA.checkDuplicateParticipation, an externalId slot in
// engine_fab state, external_id written on rows, and TWO "Require External ID"
// checkboxes in the interface - one of them inside the generic builder screen,
// which is unreachable because all sixteen paradigms have builders of their own.
//
// What did not exist: anything that ASKED the participant. So external_id was
// null on every row ever collected, and the duplicate check had nothing to
// compare against. Whoever recruits through Prolific or MTurk pays per
// completion, and the same person could take the study repeatedly.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/external_id.test.js
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

  async function open(url) {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    p._errs = [];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.evaluateOnNewDocument(() => {
      window.alert = function () {};
      window.__PTBX_NO_TELEMETRY = true;
    });
    await p.goto(url || INDEX, { waitUntil: 'networkidle2' });
    return p;
  }

  console.log('\n[the experimenter can ask for one, in every kit paradigm]');
  let link = null;
  {
    const p = await open();
    const r = await p.evaluate(() => {
      NegativePriming.openBuilder();
      const box = document.getElementById('negative-require-external-id');
      if (!box) return { noBox: true };
      box.checked = true;

      const scope = document.getElementById('ptk-builder-negative') || document;
      const inputs = Array.from(scope.querySelectorAll('input[type="text"]'));
      const email = inputs.find(i => /@/.test(i.placeholder || '')) || inputs[0];
      const expid = inputs.find(i => /pilot/.test(i.placeholder || '')) || inputs[1];
      if (email) email.value = 'lab@example.org';
      if (expid) expid.value = 'ext_probe_1';

      const btn = Array.from(scope.querySelectorAll('button'))
        .find(b => /participant link/i.test(b.textContent));
      if (!btn) return { noButton: true };
      btn.click();

      // scoped to the link modal: a bare input[readonly] selector matches an
      // unrelated readonly field elsewhere on the page and silently returns ''
      const field = document.querySelector('#ptk-link-modal textarea');
      return { link: field ? field.value : null, hadBox: true };
    });
    ok('the builder offers the switch', !r.noBox, JSON.stringify(r).slice(0, 140));
    ok('a link is produced', !!r.link, JSON.stringify(r).slice(0, 160));
    link = r.link;

    if (link) {
      const decoded = await p.evaluate((l) => {
        const raw = new URLSearchParams(l.split('?')[1]).get('negative');
        return PTK.decode(raw);
      }, link);
      ok('the link carries requireExternalId', decoded.requireExternalId === true,
         JSON.stringify(decoded).slice(0, 200));
    }
    await p.close();
  }

  console.log('\n[the participant is asked before the experiment opens]');
  if (link) {
    const target = INDEX + '?' + link.split('?')[1];
    const p = await open(target);
    await new Promise(r => setTimeout(r, 900));
    const r = await p.evaluate(() => {
      const overlay = document.getElementById('negative-overlay');
      return {
        asked: !!document.getElementById('pta-external-id'),
        input: !!document.getElementById('pta-ext-input'),
        experimentStillClosed: !overlay || overlay.style.display !== 'block'
      };
    });
    ok('it asks for the ID', r.asked);
    ok('there is somewhere to type it', r.input);
    ok('the experiment has NOT opened yet', r.experimentStillClosed,
       'stimuli must not be shown before the participant is accepted');

    if (r.asked) {
      const empty = await p.evaluate(() => {
        document.getElementById('pta-ext-go').click();
        return {
          stillThere: !!document.getElementById('pta-external-id'),
          msg: (document.getElementById('pta-ext-msg') || {}).textContent || ''
        };
      });
      ok('an empty ID is refused',
         empty.stillThere && /enter your participant id/i.test(empty.msg), empty.msg);

      const good = await p.evaluate(async () => {
        // no live database in the harness, so the gate must not strand the person
        window.PTA.supabase = null;
        document.getElementById('pta-ext-input').value = '  PROLIFIC_ABC123  ';
        document.getElementById('pta-ext-go').click();
        await new Promise(r => setTimeout(r, 400));
        return {
          gone: !document.getElementById('pta-external-id'),
          stored: window.NegativePriming.externalId,
          opened: (document.getElementById('negative-overlay') || {}).style.display
        };
      });
      ok('a real ID is accepted', good.gone);
      ok('it is trimmed and stored', good.stored === 'PROLIFIC_ABC123', String(good.stored));
      ok('and only then does the experiment open', good.opened === 'block', String(good.opened));

      const row = await p.evaluate(() => {
        const saved = [];
        window.PTK.save = function (r) { saved.push(r); };
        NegativePriming.saveTrial({ trial: 1, condition: 'control', rt: 500, correct: true });
        return saved[0] || null;
      });
      ok('the ID reaches the saved row', !!row && row.external_id === 'PROLIFIC_ABC123',
         JSON.stringify(row && row.external_id));
    }
    await p.close();
  }

  console.log('\n[a duplicate is turned away]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      PTA.supabase = { __stub: true };
      PTA.checkDuplicateParticipation = async () => ({ isDuplicate: true });
      const done = PTA.collectExternalId({ experimentId: 'x' });
      await new Promise(r => setTimeout(r, 60));
      document.getElementById('pta-ext-input').value = 'ALREADY_DID_THIS';
      document.getElementById('pta-ext-go').click();
      await new Promise(r => setTimeout(r, 300));
      const settled = await Promise.race([
        done.then(() => true),
        new Promise(r => setTimeout(() => r(false), 150))
      ]);
      return {
        stillOpen: !!document.getElementById('pta-external-id'),
        msg: (document.getElementById('pta-ext-msg') || {}).textContent || '',
        settled: settled
      };
    });
    ok('the prompt stays up', r.stillOpen);
    ok('it says the ID already completed the study', /already completed/i.test(r.msg), r.msg);
    ok('and the experiment is not started', r.settled === false, String(r.settled));
    await p.close();
  }

  console.log('\n[a broken duplicate check does not strand a real participant]');
  {
    const p = await open();
    const r = await p.evaluate(async () => {
      PTA.supabase = { __stub: true };
      PTA.checkDuplicateParticipation = async () => ({ error: 'network down' });
      const done = PTA.collectExternalId({ experimentId: 'x' });
      await new Promise(r => setTimeout(r, 60));
      document.getElementById('pta-ext-input').value = 'REAL_PERSON';
      document.getElementById('pta-ext-go').click();
      return await Promise.race([done, new Promise(r => setTimeout(() => r('STUCK'), 800))]);
    });
    ok('a failed CHECK is not treated as a duplicate', r === 'REAL_PERSON', String(r));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
