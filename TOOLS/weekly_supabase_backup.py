"""Weekly pull of everything in the PrimingToolbox Supabase project.

WHY THIS EXISTS
---------------
Two reasons, and the second is the one that matters most.

1. A copy of the data that is not inside Supabase. On 2026-08-12 the project
   was unreachable for an unknown number of days and there was no local copy of
   anything; had it been deleted rather than paused, the 241 pilot rows were
   gone. This writes every row of every table to disk, timestamped, on a
   schedule, so that can never be the situation again.

2. It keeps the project ALIVE. Supabase pauses a free-tier project after seven
   quiet days. That pause is what caused the outage. A job that queries the
   database once a week is, by itself, enough activity to stop the clock ever
   reaching seven days. The backup is the point; staying unpaused is the part
   that stops the problem recurring.

WHAT IT WRITES
--------------
    DATA_BACKUP/
      2026-08-12_1430/
        experiment_results.csv     every row, all columns
        experiment_results.json    the same, exact types preserved
        ec_results.csv / .json
        subliminal_results.csv / .json
        manifest.json              what ran, when, how many rows, any errors
      history.csv                  one line per run: date, table, rows
      STATUS.html                  a page you can open: growth, last run, warnings

CSV is for Excel and is written with a UTF-8 BOM, because these tables hold
Hebrew, Arabic, Russian and Chinese stimuli and Excel mangles all four without
one. JSON is the faithful copy: CSV cannot tell null from the string "null",
and it flattens booleans and numbers to text.

CREDENTIALS
-----------
Uses the anon key already published in js/core_fab.js. That key is public by
design and read-only under the row-level-security policies, which is all a
backup needs. Nothing secret is stored in this file, so it is safe to commit.

RUN IT
------
    python TOOLS/weekly_supabase_backup.py

SCHEDULE IT (once, from an ordinary terminal - no admin needed):

    schtasks /create /tn "PrimingToolbox weekly backup" /sc weekly /d SUN /st 09:00 ^
      /tr "python \"D:\\Dropbox\\Research\\PRIMING_TOOLBOX\\TOOLS\\weekly_supabase_backup.py\""

    schtasks /query /tn "PrimingToolbox weekly backup"     (check it is registered)
    schtasks /run   /tn "PrimingToolbox weekly backup"     (run it now, to test)
    schtasks /delete /tn "PrimingToolbox weekly backup" /f (remove it)

If the machine is off at 09:00 on Sunday, Windows runs the task at the next
opportunity, so a weekend away does not skip a week.
"""
import csv
import io
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ---------------------------------------------------------------- settings --

PROJECT_URL = 'https://luhgdmzksitdkbysdfbr.supabase.co'
ANON_KEY = (
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1'
    'aGdkbXprc2l0ZGtieXNkZmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjU0MDMsImV4'
    'cCI6MjA4MDEwMTQwM30.kxiMmJE4N5U5pM-3d81URKCwZ5PSsE-19AIr5KWOMlQ'
)

# Every table the platform writes to. affective/social/goal/moral/money/
# advertising and the rest of the kit paradigms all write into
# experiment_results; only these three exist as separate tables.
TABLES = ['experiment_results', 'ec_results', 'subliminal_results']

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_DIR = os.path.join(ROOT, 'DATA_BACKUP')

PAGE = 1000          # PostgREST caps a response; page through with Range
TIMEOUT = 60


# ------------------------------------------------------------------ fetch --

def fetch_all(table):
    """Every row of one table, paged. Returns (rows, error_or_None)."""
    rows = []
    offset = 0
    while True:
        url = '%s/rest/v1/%s?select=*&order=created_at.asc' % (PROJECT_URL, table)
        req = urllib.request.Request(url, headers={
            'apikey': ANON_KEY,
            'Authorization': 'Bearer ' + ANON_KEY,
            'Range-Unit': 'items',
            'Range': '%d-%d' % (offset, offset + PAGE - 1),
        })
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                batch = json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', 'replace')[:300]
            # A table with no created_at column: retry once without the order.
            if e.code == 400 and 'created_at' in body:
                return fetch_all_unordered(table)
            return rows, 'HTTP %d: %s' % (e.code, body)
        except Exception as e:                       # network, DNS, timeout
            return rows, '%s: %s' % (type(e).__name__, e)

        rows.extend(batch)
        if len(batch) < PAGE:
            return rows, None
        offset += PAGE


def fetch_all_unordered(table):
    rows, offset = [], 0
    while True:
        url = '%s/rest/v1/%s?select=*' % (PROJECT_URL, table)
        req = urllib.request.Request(url, headers={
            'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY,
            'Range-Unit': 'items', 'Range': '%d-%d' % (offset, offset + PAGE - 1)})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                batch = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            return rows, '%s: %s' % (type(e).__name__, e)
        rows.extend(batch)
        if len(batch) < PAGE:
            return rows, None
        offset += PAGE


# ------------------------------------------------------------------ write --

def write_csv(path, rows):
    """CSV with a UTF-8 BOM and the union of every row's keys as the header.

    The union matters: a row written by one paradigm carries columns another
    never sets, and taking the header off the first row alone silently drops
    every column the first row happens to lack.
    """
    headers = []
    seen = set()
    for row in rows:
        for k in row:
            if k not in seen:
                seen.add(k)
                headers.append(k)
    with io.open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=headers, extrasaction='ignore')
        w.writeheader()
        for row in rows:
            w.writerow({k: ('' if row.get(k) is None else row.get(k)) for k in headers})
    return headers


def write_json(path, rows):
    with io.open(path, 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)


def append_history(counts, stamp, errors):
    path = os.path.join(BACKUP_DIR, 'history.csv')
    new = not os.path.exists(path)
    with io.open(path, 'a', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        if new:
            w.writerow(['run_utc', 'table', 'rows', 'error'])
        for table in TABLES:
            w.writerow([stamp, table, counts.get(table, ''), errors.get(table, '')])


def read_history():
    path = os.path.join(BACKUP_DIR, 'history.csv')
    if not os.path.exists(path):
        return []
    with io.open(path, 'r', encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def esc(s):
    return (str('' if s is None else s)
            .replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;'))


def write_status(stamp, counts, errors, folder):
    """A page you can just open. Same house style as the work reports."""
    hist = read_history()
    by_run = {}
    for h in hist:
        by_run.setdefault(h['run_utc'], {})[h['table']] = h['rows']
    runs = sorted(by_run.keys(), reverse=True)[:20]

    ok = not any(errors.values())
    total = sum(v for v in counts.values() if isinstance(v, int))

    rows_html = []
    for r in runs:
        cells = ''.join('<td class="n">' + esc(by_run[r].get(t, '—')) + '</td>' for t in TABLES)
        rows_html.append('<tr><td>' + esc(r) + '</td>' + cells + '</tr>')

    err_html = ''
    if not ok:
        items = ''.join('<li><b>' + esc(t) + '</b> — ' + esc(e) + '</li>'
                        for t, e in errors.items() if e)
        err_html = ('<div class="find"><b>This run did not complete cleanly.</b>'
                    '<ul>' + items + '</ul>The last good copy is still on disk — '
                    'check the folders below.</div>')

    html = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PrimingToolbox — data backup status</title>
<style>
 body{font-family:"Segoe UI",Arial,sans-serif;max-width:960px;margin:1.5rem auto;padding:0 1.1rem;line-height:1.55;color:#1c1c1c;background:#fff;}
 h1{font-size:1.5rem;margin-bottom:.1rem;} .sub{color:#666;font-size:.92rem;margin-top:0;}
 h2{font-size:1.15rem;margin:1.8rem 0 .5rem;padding-bottom:.3rem;border-bottom:2px solid #1a7a33;color:#1a7a33;}
 .kpis{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0;}
 .kpi{background:#fafafa;border:1px solid #e4e4e4;border-radius:10px;padding:.55rem 1rem;text-align:center;min-width:110px;}
 .kpi b{font-size:1.5rem;display:block;} .kpi .l{font-size:.72rem;color:#888;text-transform:uppercase;}
 .good{background:#eefaf0;border:1px solid #bfe6c8;border-left:5px solid #1a7a33;border-radius:8px;padding:.9rem 1.2rem;margin:1rem 0;}
 .find{background:#fff5f9;border:1px solid #f6c2d8;border-left:5px solid #c2185b;border-radius:8px;padding:.9rem 1.2rem;margin:1rem 0;}
 table{border-collapse:collapse;width:100%;font-size:.88rem;margin:.5rem 0;}
 th{text-align:left;font-size:.7rem;text-transform:uppercase;color:#8a8a8a;border-bottom:1px solid #eee;padding:.35rem .5rem;}
 td{padding:.4rem .5rem;border-bottom:1px solid #f4f4f4;} td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;}
 code{font-family:Consolas,monospace;background:#f0f0f0;padding:0 4px;border-radius:3px;}
 a{color:#0b4f9c;} .foot{color:#888;font-size:.82rem;border-top:1px solid #eee;margin-top:1.8rem;padding-top:.8rem;}
</style></head><body>
<h1>PrimingToolbox — data backup</h1>
<p class="sub">Last run @@stamp@@ UTC · <a href="@@folder_url@@">this run's files</a> ·
 <a href="history.csv">history.csv</a> ·
 <a href="https://supabase.com/dashboard/project/luhgdmzksitdkbysdfbr">the Supabase dashboard</a></p>

<div class="kpis">
 <div class="kpi"><b style="color:#1a7a33">@@total@@</b><span class="l">rows copied</span></div>
 <div class="kpi"><b style="color:#0b4f9c">@@ntables@@</b><span class="l">tables</span></div>
 <div class="kpi"><b style="color:#a35b00">@@nruns@@</b><span class="l">backups kept</span></div>
</div>

@@err_html@@
@@ok_html@@

<h2>Rows over time</h2>
<table><tr><th>Run (UTC)</th>@@head@@</tr>@@rows@@</table>

<div class="foot">Written by <code>TOOLS/weekly_supabase_backup.py</code>. Running it weekly also keeps the
Supabase project from idling into the free-tier pause that took it offline on 12 August 2026.</div>
</body></html>"""
    # Token replacement, not %-formatting: the CSS above contains `width:100%`
    # and `%(...)s` interpolation chokes on it.
    fields = {
        '@@stamp@@': esc(stamp),
        '@@folder_url@@': esc(os.path.basename(folder)) + '/',
        '@@total@@': str(total),
        '@@ntables@@': str(len(TABLES)),
        '@@nruns@@': str(len(by_run)),
        '@@err_html@@': err_html,
        '@@ok_html@@': ('<div class="good"><b>All tables copied.</b> '
                        'Every row is on disk in CSV and JSON.</div>') if ok else '',
        '@@head@@': ''.join('<th>' + esc(t) + '</th>' for t in TABLES),
        '@@rows@@': ''.join(rows_html),
    }
    for k, v in fields.items():
        html = html.replace(k, v)
    with io.open(os.path.join(BACKUP_DIR, 'STATUS.html'), 'w', encoding='utf-8') as f:
        f.write(html)


# ------------------------------------------------------------------- main --

def main():
    started = datetime.now(timezone.utc)
    stamp = started.strftime('%Y-%m-%d_%H%M')
    folder = os.path.join(BACKUP_DIR, stamp)
    os.makedirs(folder, exist_ok=True)

    print('PrimingToolbox weekly backup')
    print('  project :', PROJECT_URL)
    print('  into    :', folder)
    print()

    counts, errors, columns = {}, {}, {}
    for table in TABLES:
        rows, err = fetch_all(table)
        counts[table] = len(rows)
        errors[table] = err or ''
        if err:
            print('  %-22s FAILED  %s' % (table, err))
            continue
        headers = write_csv(os.path.join(folder, table + '.csv'), rows)
        write_json(os.path.join(folder, table + '.json'), rows)
        columns[table] = headers
        print('  %-22s %6d rows, %2d columns' % (table, len(rows), len(headers)))

    manifest = {
        'run_utc': started.isoformat(),
        'project_url': PROJECT_URL,
        'tables': TABLES,
        'row_counts': counts,
        'columns': columns,
        'errors': {k: v for k, v in errors.items() if v},
        'note': ('Backup of the PrimingToolbox results tables. Running this weekly also keeps '
                 'the free-tier project from pausing after seven idle days.'),
    }
    with io.open(os.path.join(folder, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    append_history(counts, started.isoformat(), errors)
    write_status(started.strftime('%Y-%m-%d %H:%M'), counts, errors, folder)

    failed = [t for t, e in errors.items() if e]
    print()
    if failed:
        print('  FAILED for: ' + ', '.join(failed))
        print('  status page: ' + os.path.join(BACKUP_DIR, 'STATUS.html'))
        return 1
    print('  total %d rows' % sum(counts.values()))
    print('  status page: ' + os.path.join(BACKUP_DIR, 'STATUS.html'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
