// Run every test file and print one table.
//
//   node tests/run_all.js            all of them
//   node tests/run_all.js csv clock  only files whose name contains csv or clock
//
// NODE_PATH is set for you, so this works from any directory:
//   node D:\Dropbox\Research\PRIMING_TOOLBOX\tests\run_all.js
//
// Exits non-zero if anything failed, so it can gate a commit.
//
// Written because the suite total was being counted by hand every time, and
// tests/README.md carried a hard-coded "99 checks" that was wrong within days.
// A number in a document rots; a number this prints cannot.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = path.dirname(HERE);
const MODULES = path.join(ROOT, 'PRESENTATIONS', 'node_modules');

const filters = process.argv.slice(2).map(s => s.toLowerCase());
const files = fs.readdirSync(HERE)
  .filter(f => f.endsWith('.test.js'))
  .filter(f => !filters.length || filters.some(s => f.toLowerCase().includes(s)))
  .sort();

if (!files.length) {
  console.error('no test files matched', filters.join(' '));
  process.exit(2);
}

// Chrome is driven one page at a time on purpose. Running these concurrently
// makes the timing-sensitive paradigms (masked lexical decision runs at real
// stimulus durations) fail for reasons that have nothing to do with the code.
const results = [];
let totalPass = 0, totalFail = 0, broken = 0;

console.log('');
for (const f of files) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(HERE, f)], {
    env: Object.assign({}, process.env, { NODE_PATH: MODULES }),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  const out = (run.stdout || '') + (run.stderr || '');
  const m = out.match(/(\d+) passed, (\d+) failed/g);
  const last = m ? m[m.length - 1] : null;
  const pass = last ? Number(last.match(/^(\d+)/)[1]) : 0;
  const fail = last ? Number(last.match(/(\d+) failed/)[1]) : 0;
  const secs = ((Date.now() - started) / 1000).toFixed(0);

  totalPass += pass;
  totalFail += fail;
  if (!last) broken++;

  const status = !last ? 'NO SUMMARY' : fail ? fail + ' FAILED' : 'ok';
  console.log(
    '  ' + f.replace('.test.js', '').padEnd(30) +
    String(pass).padStart(4) + ' passed  ' +
    status.padEnd(12) + secs + 's'
  );

  results.push({ file: f, pass, fail, ok: !!last && !fail, out });
}

// Reprint the detail of anything that failed, so the reason is on screen and
// the file does not have to be re-run to find out what went wrong.
const bad = results.filter(r => !r.ok);
if (bad.length) {
  console.log('\n' + '-'.repeat(64));
  for (const r of bad) {
    console.log('\n### ' + r.file);
    const lines = r.out.split('\n').filter(l => /FAIL|HARNESS ERROR|Error:/.test(l));
    console.log(lines.length ? lines.slice(0, 12).join('\n') : r.out.slice(-1200));
  }
}

console.log('\n' + '-'.repeat(64));
console.log('  ' + files.length + ' files, ' + totalPass + ' passed, ' + totalFail + ' failed'
  + (broken ? ', ' + broken + ' produced no summary' : ''));
console.log('');

process.exit(totalFail || broken ? 1 : 0);
