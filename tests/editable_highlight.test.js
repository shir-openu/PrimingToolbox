// "Which of these can I actually change?"
//
// Shir, 2026-08-12: opening a template builder gave no way to tell at a glance
// which fields were hers to edit. Her instruction was specific - highlight the
// ones that ARE editable, with a purple glow - and she pointed at her own page
// as the reference (--purple #a78bfa, a controlBlink keyframe, two pulses):
// https://shir-openu.github.io/differential_linear_operator_addition-en/
//
// The rule that matters most here is the one that is easy to get wrong: a
// DISABLED or READONLY control must never be marked, because separating those
// from the editable ones is the entire point.
//
// Run with:
//   NODE_PATH=D:/Dropbox/Research/PRIMING_TOOLBOX/PRESENTATIONS/node_modules node tests/editable_highlight.test.js
const puppeteer = require('puppeteer');

const INDEX = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/index.html';
const SCRATCH = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/build/from-scratch.html';
const TIMELINE = 'file:///D:/Dropbox/Research/PRIMING_TOOLBOX/build/timeline.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <<' + extra + '>>' : '')); }
}

const IGNORE = /net::ERR|Failed to load resource|supabase|sheetjs|cdn\.|platform_events|PTA:/i;
const PURPLE = '#a78bfa';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
           '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files']
  });

  async function open(url) {
    const p = await browser.newPage();
    await p.setCacheEnabled(false);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text()); });
    p._errs = errs;
    await p.evaluateOnNewDocument(() => { window.alert = function () {}; });
    await p.goto(url, { waitUntil: 'networkidle2' });
    return p;
  }

  console.log('\n[it uses her colour and her effect]');
  {
    const p = await open(INDEX);
    const r = await p.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML = '<input id="a"><input id="b">';
      document.body.appendChild(host);
      PTK.markEditable(host, { legend: false });
      const css = document.getElementById('ptk-editable-style').textContent;
      return {
        css: css,
        hasKeyframe: /@keyframes ptkControlBlink/.test(css),
        pulses: (css.match(/ptkControlBlink [\d.]+s ease-in-out (\d)/) || [])[1],
        marked: host.querySelectorAll('.ptk-editable').length
      };
    });
    ok('purple #a78bfa, exactly hers', r.css.indexOf(PURPLE) !== -1);
    ok('a controlBlink-style keyframe', r.hasKeyframe);
    ok('a short pulse, not a permanent flash', Number(r.pulses) > 0 && Number(r.pulses) <= 4, String(r.pulses));
    ok('both controls marked', r.marked === 2, String(r.marked));
    await p.close();
  }

  console.log('\n[disabled and readonly are NOT marked - the whole point]');
  {
    const p = await open(INDEX);
    const r = await p.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML =
        '<input id="ok1"><select id="ok2"><option>x</option></select><textarea id="ok3"></textarea>' +
        '<input id="dis" disabled><input id="ro" readonly><input id="hid" type="hidden">';
      document.body.appendChild(host);
      const n = PTK.markEditable(host, { legend: false });
      const cls = id => document.getElementById(id).classList.contains('ptk-editable');
      return { n: n, ok1: cls('ok1'), ok2: cls('ok2'), ok3: cls('ok3'),
               dis: cls('dis'), ro: cls('ro'), hid: cls('hid') };
    });
    ok('a text input is marked', r.ok1);
    ok('a select is marked', r.ok2);
    ok('a textarea is marked', r.ok3);
    ok('a DISABLED input is not marked', r.dis === false);
    ok('a READONLY input is not marked', r.ro === false);
    ok('a hidden input is not marked', r.hid === false);
    ok('the count is only the editable ones', r.n === 3, String(r.n));
    await p.close();
  }

  console.log('\n[the legend says what the colour means, once]');
  {
    const p = await open(INDEX);
    const r = await p.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML = '<input><input><input>';
      document.body.appendChild(host);
      PTK.markEditable(host);
      PTK.markEditable(host);          // re-opening must not stack legends
      const bar = host.querySelector('.ptk-editable-legend');
      return {
        legends: host.querySelectorAll('.ptk-editable-legend').length,
        text: bar ? bar.innerText : '',
        first: host.firstChild === bar
      };
    });
    ok('exactly one legend', r.legends === 1, String(r.legends));
    ok('it is at the top where it will be read', r.first);
    ok('it says purple means editable', /purple/i.test(r.text), r.text.slice(0, 90));
    ok('it counts the fields', /3 fields/.test(r.text), r.text.slice(0, 90));
    ok('it says what to do about the rest', /from scratch/i.test(r.text), r.text.slice(0, 140));
    await p.close();
  }

  console.log('\n[every builder gets it, all sixteen]');
  {
    const ALL = ['stroop', 'semantic', 'number-priming', 'amp', 'evaluative',
                 'affective', 'social', 'negative', 'masked', 'syntactic',
                 'repetition', 'goal', 'moral', 'money', 'advertising'];
    for (const key of ALL) {
      const p = await open(INDEX + '?edit=' + key);
      await new Promise(r => setTimeout(r, 700));
      const n = await p.evaluate(() =>
        document.querySelectorAll('.ptk-editable').length);
      ok(key + ': editable fields highlighted', n >= 3, 'marked=' + n);
      await p.close();
    }
  }

  console.log('\n[the two build pages get it too]');
  for (const [name, url] of [['from-scratch', SCRATCH], ['timeline', TIMELINE]]) {
    const p = await open(url);
    await new Promise(r => setTimeout(r, 700));
    const r = await p.evaluate(() => ({
      marked: document.querySelectorAll('.ptk-editable').length,
      legend: document.querySelectorAll('.ptk-editable-legend').length
    }));
    ok(name + ': fields highlighted', r.marked >= 5, 'marked=' + r.marked);
    ok(name + ': one legend', r.legend === 1, String(r.legend));
    ok(name + ': no page errors', p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
