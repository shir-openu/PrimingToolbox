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
| `paradigms_practice.test.js` | the v2.0 practice block: practice rows stay out of both results and Supabase, the gate names the right key, and pressing it runs the scored block to completion |

Current status: 39 + 41 + 10 + 9 = **99 checks, all passing** against the v2.0
modules (2026-08-10).

## Updated for v2.0 on 2026-08-10

The four modules were rewritten (PTK kit, `spec()`, practice blocks, A/S/M
verdicts). Two harness assumptions broke, and neither was a product fault:

- **Practice blocks.** `negative`, `masked` and `syntactic` now run practice
  trials first and end them on a *"press a key to begin the real trials"* gate.
  The harness only answers while `state.awaiting` is true, which is false at
  that gate, so it waited there forever and recorded zero scored rows. The
  end-to-end and regression suites now set `practiceTrials = 0` to test the
  scored path directly, and `paradigms_practice.test.js` covers the gate itself.
- **Syntactic no longer reports "% structure reuse".** That metric was removed
  deliberately: a participant with a fixed structural preference scores 50%
  reuse while showing no priming at all. The suite now asserts the D − C
  contrast that replaced it. The old assertion had been pinning the wrong
  behaviour.

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
