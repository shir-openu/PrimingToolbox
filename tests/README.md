# Paradigm tests

Real-browser tests for the four paradigms added on 2026-08-09
(negative priming, masked lexical decision, syntactic priming, repetition priming).

## Running them

Puppeteer is installed under `PRESENTATIONS/node_modules`, and its own copy of
Chrome was never downloaded, so the harnesses drive the **system** Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe`.

```
cd D:\Dropbox\Research\PRIMING_TOOLBOX\tests
set NODE_PATH=D:\Dropbox\Research\PRIMING_TOOLBOX\PRESENTATIONS\node_modules
node paradigms_interface.test.js
node paradigms_endtoend.test.js
node paradigms_regression.test.js
```

Each exits non-zero if anything fails. No test writes to Supabase:
`PTA.saveToSupabase` is replaced with a collector before the page loads.

## What each one covers

| file | checks |
|---|---|
| `paradigms_interface.test.js` | module loads, appears in the dropdown, has the full interface, injects its overlay, builds balanced conditions, participant config round-trips, `saveTrial` reaches `PTA.saveToSupabase` |
| `paradigms_endtoend.test.js` | plays every paradigm through to its results screen, then opens a real participant link for each |
| `paradigms_regression.test.js` | the three defects found on 2026-08-09, each reproduced by its original trigger |

## Why the regression file exists

**Orphaned response-window timeout (MaskedLexical).** Each trial scheduled a
`setTimeout` for the response window and never cancelled it. When the
participant answered early, that timer stayed pending and fired *during a later
trial*, writing a false "too slow" row stamped with the later trial's number but
the earlier trial's target. At the default 2000 ms window and 800 ms ITI it hit
**15 of 24 trials**. RT could not reveal it, because the timeout path recorded a
hardcoded `rt = target_ms`; the fingerprint was the target/trial-number
mismatch. Fixed by tracking every timer and clearing it when the trial ends, and
by stamping each row with the trial index it belongs to.

**Double click (SyntacticPriming).** A second click reached `choose()` after
`currentTrial` had advanced and threw on `tr.primeForm`. Fixed with a stage lock
and by disabling the options after the first click.

**Double submit (RepetitionPriming).** Enter and the Next button could both fire
for one fragment. Fixed with a per-trial lock.

## A note on timings

Run these with background timer throttling disabled — the harnesses already pass
`--disable-background-timer-throttling`. Without it, a headless page is treated
as backgrounded and its timers are clamped, which makes the harness itself look
like a failure.
