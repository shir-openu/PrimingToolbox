# Tests

Real-browser tests. Every one of them drives an actual Chrome against
`index.html` from disk — there is no jsdom and no mocking of the product.

## Running them

```
node tests/run_all.js              every file, one table, non-zero exit if anything fails
node tests/run_all.js csv clock    only files whose name contains csv or clock
```

`run_all.js` sets `NODE_PATH` itself, so it works from any directory. To run one
file by hand:

```
set NODE_PATH=D:\Dropbox\Research\PRIMING_TOOLBOX\PRESENTATIONS\node_modules
node tests\csv_export.test.js
```

Puppeteer is installed under `PRESENTATIONS/node_modules`. Its own copy of
Chrome was never downloaded, so the harnesses drive the **system** Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe`.

Always pass `--disable-background-timer-throttling --disable-renderer-backgrounding
--disable-backgrounding-occluded-windows`. A headless page counts as
backgrounded and Chrome clamps its timers, which makes the *harness* look like a
product failure. That cost two false diagnoses on 2026-08-09.

Do not run the files concurrently. Some paradigms run at real stimulus
durations, and they fail for reasons that have nothing to do with the code when
they are competing for the CPU.

**No test writes to Supabase.** Most replace `PTA.saveToSupabase` with a
collector before the page loads; on top of that `PTA.isAutomated()` refuses real
writes whenever `navigator.webdriver` is true, which it is under Puppeteer. That
guard exists because a test run once put 2,032 rows into the live research
database.

There is deliberately **no total check count in this file**. The previous
version carried one — "99 checks" — and it was wrong within days. `run_all.js`
prints the number, and a number it prints cannot rot.

## What each file covers

| file | what it protects |
|---|---|
| `abcd_panel` | the ABCD panel on every setup screen describes the experiment that actually runs, not an idealised one |
| `amp_neutral_baseline` | AMP runs a neutral third condition, no target ideograph repeats within a session, and the two movements are reported separately |
| `builder_close` | abandoning a Template Builder leaves the experiment runnable |
| `builders` | the two Build From Scratch pages |
| `csv_export` | the download parses as CSV — a quote or comma in a stimulus does not shift the columns. This is the file the analysis is run on |
| `data_rescue` | a run whose database is unreachable is not lost: local copy, visible warning, download button |
| `definition_check` | the A/S/M definition check is capable of saying **no** |
| `editable_highlight` | what a user can change is visibly marked, in all sixteen builders |
| `empty_conditions` | a condition with no usable trials never becomes a result |
| `engine_correctness` | the generic engine's scoring, feedback and statistics, plus HTML injection through participant links |
| `evaluative_rating_lock` | one rating per trial, attributed to the right shape |
| `external_id` | the recruitment-platform ID is asked for before the experiment opens, duplicates are turned away, and a broken check does not strand a real participant |
| `leftovers` | a result written nowhere, and a listener that outlived its experiment |
| `no_prime_baseline` | a blank Prime cell is a real design and actually runs |
| `paradigms_endtoend` | every paradigm played through to its results screen, then a real participant link opened for each |
| `paradigms_interface` | module loads, is in the dropdown, has the full interface, builds balanced conditions, and its participant link survives being a URL |
| `paradigms_practice` | practice rows stay out of both the results and the database; the gate names the right key |
| `paradigms_regression` | the three defects found on 2026-08-09, each reproduced by its original trigger |
| `participant_links` | links survive encoding, including Hebrew and `+` |
| `platform_events` | the experimenter and meta layers the DHSS proposal depends on |
| `reaction_time_clock` | reaction times are measured on a monotonic clock, so a wall-clock jump cannot record a negative RT |
| `response_keys` | the keys shown on screen are the keys the task accepts |
| `schema_drift` | a column the table does not have costs that column, not the whole run |
| `template_editing` | a user can change a template and adjust it into their own experiment |
| `timing_settings` | timing settings survive from where they are set to where they are used |
| `zero_is_not_a_measurement` | a missing condition is never reported as 0 ms, 0.00 on a 1-7 scale, or NaN |

## Why the regression file exists

`paradigms_regression.test.js` reproduces defects by their *original trigger*
rather than by calling the fixed function directly. A test that calls the fix
passes as soon as the fix exists; a test that replays the trigger keeps passing
only while the path from trigger to symptom stays closed.

## What a test here is expected to do

Several tests in this suite were, at one time, incapable of failing — one built
its own base64 encoder and verified that `btoa` and `atob` are inverses, which
they are, while the product's encoder was broken. So:

- Exercise the **product's** function, not a reimplementation of it.
- Assert on what the user or the analyst would see — parse the CSV with a CSV
  parser, read the text off the results screen — not on the string the code
  happened to build.
- Prove the test can fail. Reintroduce the defect, watch it go red, put it back.
  Every fix in this suite since 2026-08-12 has that step in its commit message.
