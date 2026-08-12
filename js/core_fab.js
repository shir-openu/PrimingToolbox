/*
 * PREVIOUS VERSIONS ON GITHUB, newest first. Every change to this file adds a
 * line here, so any earlier state can be recovered if something goes wrong.
 *
 *   before the schema-drift fix, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/0783ff2/js/core_fab.js
 */
/*
 * PREVIOUS VERSION ON GITHUB (before the full-codebase read of 2026-08-12):
 *     https://github.com/shir-openu/PrimingToolbox/blob/02cecb1/js/core_fab.js
 */
/*
 * PREVIOUS VERSION ON GITHUB (before a failed database save stopped being a console line, 2026-08-12):
 *     https://github.com/shir-openu/PrimingToolbox/blob/934c0b5/js/core_fab.js
 */
/*
 * PREVIOUS VERSION ON GITHUB (before encodeConfig/decodeConfig were made
 * UTF-8 safe, 2026-08-11):
 *     https://github.com/shir-openu/PrimingToolbox/blob/87e1f20/js/core_fab.js
 */
/**
 * =====================================================
 * PrimingToolbox - Core Module
 * =====================================================
 *
 * Central module for the PrimingToolbox platform.
 * Provides Supabase database connectivity, utility functions,
 * data storage operations, and UI helpers.
 *
 * @module PTA
 * @version 1.0
 * @author Dr. Shir Sivroni
 *
 * Dependencies:
 * - Supabase JS Client (loaded via CDN)
 * - SheetJS (optional, for Excel export)
 *
 * Usage:
 * 1. Include this script after Supabase SDK
 * 2. Call PTA.initSupabase() to connect to database
 * 3. Use PTA.saveTrialResult() or PTA.saveAllResults() for data
 * =====================================================
 */

const PTA = window.PTA || {};

/**
 * Global configuration object.
 * Contains Supabase credentials and version info.
 * @type {Object}
 */
PTA.config = {
  supabaseUrl: 'https://luhgdmzksitdkbysdfbr.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1aGdkbXprc2l0ZGtieXNkZmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjU0MDMsImV4cCI6MjA4MDEwMTQwM30.kxiMmJE4N5U5pM-3d81URKCwZ5PSsE-19AIr5KWOMlQ',
  version: '1.0'
};

/**
 * Supabase client instance.
 * Initialized by calling PTA.initSupabase().
 * @type {Object|null}
 */
PTA.supabase = null;

/**
 * Initialize connection to Supabase database.
 * Must be called after Supabase SDK is loaded.
 * @returns {boolean} True if initialization successful, false otherwise
 */
PTA.initSupabase = function() {
  // Idempotent since 2026-08-10. index.html calls this twice (once in its own
  // DOMContentLoaded handler and once further down), which built a SECOND
  // client over the first. Supabase itself warned about it on every page load:
  //   "Multiple GoTrueClient instances detected in the same browser context...
  //    may produce undefined behavior when used concurrently under the same
  //    storage key."
  // Two clients sharing one auth storage key is a real hazard, not cosmetic.
  // Guarding here rather than deleting a call site: it fixes every caller,
  // including the standalone paradigm pages, and cannot change init ordering.
  if (PTA.supabase) {
    return true;
  }
  if (typeof supabase !== 'undefined') {
    PTA.supabase = supabase.createClient(PTA.config.supabaseUrl, PTA.config.supabaseKey);
    console.log('PTA: Supabase initialized');
    return true;
  } else {
    console.error('PTA: Supabase library not loaded');
    return false;
  }
};

/* =====================================================
   Utility Functions
   ===================================================== */

/**
 * Generate unique participant ID.
 * Format: p_{timestamp}_{random9chars}
 * @returns {string} Unique participant identifier
 */
PTA.generateParticipantId = function() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Parse URL query parameters into an object.
 * @returns {Object} Key-value pairs of URL parameters
 */
PTA.getUrlParams = function() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
};

/**
 * Decode Base64-encoded experiment configuration.
 * Used to parse experiment parameters from shared URL.
 * @param {string} encodedConfig - Base64 encoded JSON string
 * @returns {Object|null} Parsed configuration object, or null on failure
 */
PTA.decodeConfig = function(encodedConfig) {
  try {
    let decoded;
    try {
      // UTF-8 aware, and byte-for-byte identical to plain atob() for the
      // pure-ASCII payloads every previously issued link contains - so old
      // links keep working.
      decoded = decodeURIComponent(escape(atob(encodedConfig)));
    } catch (utf8) {
      decoded = atob(encodedConfig);
    }
    return JSON.parse(decoded);
  } catch (e) {
    console.error('PTA: Failed to decode config', e);
    return null;
  }
};

/**
 * Encode experiment configuration to Base64 for URL sharing.
 * @param {Object} config - Experiment configuration object
 * @returns {string|null} Base64 encoded string, or null on failure
 */
PTA.encodeConfig = function(config) {
  try {
    const json = JSON.stringify(config);
    // btoa() alone throws "characters outside of the Latin1 range" on the
    // first Hebrew, Arabic or Chinese stimulus, which returned null and
    // produced a link reading "?config=null". Since the Build From Scratch
    // pages let an author type stimuli in any script, that is not a
    // hypothetical. Matches PTK.encode, so the repo now has one encoding.
    return btoa(unescape(encodeURIComponent(json)));
  } catch (e) {
    console.error('PTA: Failed to encode config', e);
    return null;
  }
};

/**
 * Format date for human-readable display.
 * @param {Date|string} date - Date object or parseable date string
 * @returns {string} Formatted date string (e.g., "Jan 15, 2025, 10:30 AM")
 */
PTA.formatDate = function(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Shuffle array using Fisher-Yates algorithm.
 * Returns a new shuffled array; does not modify original.
 * @param {Array} array - Array to shuffle
 * @returns {Array} New shuffled array
 */
PTA.shuffleArray = function(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Calculate arithmetic mean of numeric array.
 * @param {number[]} arr - Array of numbers
 * @returns {number} Mean value, or 0 for empty array
 */
PTA.mean = function(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

/**
 * Calculate population standard deviation.
 * @param {number[]} arr - Array of numbers
 * @returns {number} Standard deviation, or 0 for empty array
 */
PTA.std = function(arr) {
  if (arr.length === 0) return 0;
  const avg = PTA.mean(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(PTA.mean(squareDiffs));
};

/**
 * Calculate median of numeric array.
 * @param {number[]} arr - Array of numbers
 * @returns {number} Median value, or 0 for empty array
 */
PTA.median = function(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/* =====================================================
   Data Storage Functions
   ===================================================== */

/**
 * Save single trial result to Supabase database.
 * @async
 * @param {string} tableName - Target database table name
 * @param {Object} trialData - Trial data object to insert
 * @returns {Promise<Object>} Result with data or error property
 */
PTA.saveTrialResult = async function(tableName, trialData) {
  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized');
    return { error: 'Supabase not initialized' };
  }

  try {
    const { data, error } = await PTA.supabase
      .from(tableName)
      .insert([trialData]);

    if (error) {
      console.error('PTA: Error saving trial', error);
      return { error };
    }

    return { data };
  } catch (e) {
    console.error('PTA: Exception saving trial', e);
    return { error: e.message };
  }
};

/**
 * Save multiple trial results to Supabase in batch.
 * More efficient than saving trials individually.
 * @async
 * Every failure route here also hands the rows to PTA.rescueUnsavedResults, so
 * no caller can lose a run by ignoring the returned error - and most of them did.
 * Six modules call this function and each one handled failure differently;
 * five of them handled it by logging to the console and carrying on.
 *
 * @param {string} tableName - Target database table name
 * @param {Object[]} trialsData - Array of trial data objects
 * @param {Object} [rescueOpts] - passed to PTA.rescueUnsavedResults on failure
 *   ({experimentName, host}); a caller that knows where its results screen is
 *   should say so, otherwise the panel goes to a fixed overlay.
 * @returns {Promise<Object>} Result with data or error property
 */
PTA.saveAllResults = async function(tableName, trialsData, rescueOpts) {
  const rescue = (reason) => {
    if (typeof PTA.rescueUnsavedResults !== 'function') return;
    const o = Object.assign({}, rescueOpts || {});
    o.reason = o.reason || reason;
    if (!o.experimentName && trialsData && trialsData[0]) {
      o.experimentName = trialsData[0].experiment_name || trialsData[0].experiment_id || '';
    }
    PTA.rescueUnsavedResults(trialsData, o);
  };

  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized');
    rescue('Supabase not initialized');
    return { error: 'Supabase not initialized' };
  }

  // A column the table does not have makes PostgREST reject the WHOLE insert
  // (PGRST204), so one unrecognised field loses the entire run. That is not
  // hypothetical: with the database healthy and reachable, PTA.Engine's save
  // failed every time because it sends `experiment_name` and `timestamp`, and
  // experiment_results has neither - so the generic engine, which is the path
  // every participant link and every Build-From-Scratch design takes, had
  // never once stored a row. The paradigm modules write different column sets
  // and were unaffected, which is why the table still filled up and nobody
  // noticed.
  //
  // Losing a run over a column name is the wrong trade. PostgREST names the
  // offending column, so drop that one and try again, and keep the list so the
  // loss is visible rather than silent. The proper fix is still to add the
  // columns (sql/add_missing_columns.sql); this makes the platform survive
  // until that is run, and survive the next schema drift after it.
  const dropped = [];
  let rows = trialsData;

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const { data, error } = await PTA.supabase
        .from(tableName)
        .insert(rows);

      if (!error) {
        if (dropped.length) {
          console.warn('PTA: saved ' + rows.length + ' trials, but ' + tableName +
            ' has no column for: ' + dropped.join(', ') +
            ' - those values were NOT stored. Run sql/add_missing_columns.sql.');
        } else {
          console.log('PTA: Saved', rows.length, 'trials');
        }
        return { data, droppedColumns: dropped };
      }

      const missing = PTA.missingColumnFrom(error);
      if (missing && !dropped.includes(missing)) {
        dropped.push(missing);
        rows = rows.map(row => {
          const copy = Object.assign({}, row);
          delete copy[missing];
          return copy;
        });
        continue;                       // same rows, one column lighter
      }

      console.error('PTA: Error saving results', error);
      rescue((error && error.message) || String(error));
      return { error, droppedColumns: dropped };
    } catch (e) {
      console.error('PTA: Exception saving results', e);
      rescue((e && e.message) || String(e));
      return { error: e.message, droppedColumns: dropped };
    }
  }

  const giveUp = 'too many unknown columns: ' + dropped.join(', ');
  console.error('PTA: ' + giveUp);
  rescue(giveUp);
  return { error: giveUp, droppedColumns: dropped };
};

/**
 * The column name out of a PostgREST "schema cache" error, or null.
 *
 * PGRST204 reads: Could not find the 'experiment_name' column of
 * 'experiment_results' in the schema cache
 *
 * @param {Object} error - a supabase-js error
 * @returns {string|null}
 */
PTA.missingColumnFrom = function(error) {
  if (!error) return null;
  if (error.code && error.code !== 'PGRST204') return null;
  const msg = String(error.message || '');
  const m = msg.match(/Could not find the '([^']+)' column/);
  return m ? m[1] : null;
};

/**
 * Fetch experiment data for a specific experimenter.
 * Retrieves all trials matching experimenter email and experiment ID.
 * @async
 * @param {string} tableName - Source database table name
 * @param {string} experimenterEmail - Experimenter's email address
 * @param {string} experimentId - User-defined experiment identifier
 * @returns {Promise<Object>} Result with data array or error property
 */
PTA.fetchExperimenterData = async function(tableName, experimenterEmail, experimentId) {
  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized');
    return { error: 'Supabase not initialized' };
  }

  try {
    const { data, error } = await PTA.supabase
      .from(tableName)
      .select('*')
      .eq('experimenter_email', experimenterEmail)
      .eq('user_experiment_id', experimentId);

    if (error) {
      console.error('PTA: Error fetching data', error);
      return { error };
    }

    return { data };
  } catch (e) {
    console.error('PTA: Exception fetching data', e);
    return { error: e.message };
  }
};

/**
 * Check if participant with external ID already completed experiment.
 * Used to prevent duplicate participation.
 * @async
 * @param {string} tableName - Database table to check
 * @param {string} experimentId - Experiment identifier
 * @param {string} externalId - External participant ID (e.g., Prolific ID)
 * @returns {Promise<Object>} Result with isDuplicate boolean or error
 */
PTA.checkDuplicateParticipation = async function(tableName, experimentId, externalId) {
  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized');
    return { error: 'Supabase not initialized' };
  }

  try {
    const { data, error } = await PTA.supabase
      .from(tableName)
      .select('id')
      .eq('user_experiment_id', experimentId)
      .eq('external_id', externalId)
      .limit(1);

    if (error) {
      console.error('PTA: Error checking duplicate', error);
      return { error };
    }

    return { isDuplicate: data && data.length > 0 };
  } catch (e) {
    console.error('PTA: Exception checking duplicate', e);
    return { error: e.message };
  }
};

/**
 * Save a single trial to Supabase (fire-and-forget).
 *
 * Added in V2 (_fab) to fix the Stroop data-loss bug: js/stroop.js calls
 * PTA.saveToSupabase(trialData) per trial, but the function was never defined,
 * so Stroop results were silently discarded.
 *
 * The repo has two save paths, not one. This is the PER-TRIAL path (stroop.js,
 * affective_fab.js, social_fab.js, and every PTK paradigm through PTK.save);
 * PTA.saveAllResults is the END-OF-RUN batch path (the engine, semantic, amp,
 * subliminal, evaluative, number-priming). Both funnel their failures into
 * PTA.rescueUnsavedResults, which is the property that matters.
 *
 * (This block used to say Number Priming "already inserts directly via
 * PTA.supabase.from(...).insert(...)". It did, and that was the bug: the direct
 * insert threw when the client was null and dropped every failure to the
 * console. It batches through saveAllResults since 02cecb1.)
 * @param {Object} trialData - Trial row to insert
 * @param {string} [tableName='experiment_results'] - Target table
 */
PTA.saveToSupabase = function(trialData, tableName) {
  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized — trial not saved', trialData);
    PTA._bufferFailedTrial(trialData, 'Supabase not initialized');
    return;
  }
  PTA.supabase
    .from(tableName || 'experiment_results')
    .insert(trialData)
    .then(
      ({ error }) => {
        if (error) {
          console.error('PTA: Error saving trial', error);
          PTA._bufferFailedTrial(trialData, (error && error.message) || String(error));
        }
      },
      // Without this second callback a network-level throw became an unhandled
      // rejection: nothing logged, nothing buffered, the trial simply gone.
      (e) => {
        console.error('PTA: Exception saving trial', e);
        PTA._bufferFailedTrial(trialData, (e && e.message) || String(e));
      }
    );
};

/* ---- the per-trial failure buffer ------------------------------------- *
 * saveToSupabase is fire-and-forget and is called once per trial, so a dead
 * database produces one failure per trial. Rescuing each one separately would
 * put forty panels on the screen and forty copies in localStorage. Failures are
 * collected instead and handed over once, shortly after they stop arriving. */
PTA._failedTrials = [];
PTA._failedReason = '';
PTA._failedTimer = null;

PTA._bufferFailedTrial = function(trialData, reason) {
  if (!trialData) return;
  PTA._failedTrials.push(trialData);
  if (reason && !PTA._failedReason) PTA._failedReason = reason;
  if (PTA._failedTimer) clearTimeout(PTA._failedTimer);
  PTA._failedTimer = setTimeout(PTA.flushFailedTrials, 1800);
};

/**
 * Hand every buffered failed trial to the rescue path, as one batch.
 * Safe to call directly - a module that knows its run has ended can flush
 * immediately rather than waiting for the debounce.
 */
PTA.flushFailedTrials = function() {
  if (PTA._failedTimer) { clearTimeout(PTA._failedTimer); PTA._failedTimer = null; }
  if (!PTA._failedTrials.length) return;
  const rows = PTA._failedTrials;
  const reason = PTA._failedReason;
  PTA._failedTrials = [];
  PTA._failedReason = '';
  if (typeof PTA.rescueUnsavedResults === 'function') {
    PTA.rescueUnsavedResults(rows, {
      experimentName: (rows[0] && (rows[0].experiment_name || rows[0].experiment_id)) || '',
      reason: reason
    });
  }
};

// A tab closed mid-run would otherwise drop whatever is still in the buffer
// without ever offering it. This at least writes the localStorage copy.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pagehide', function () {
    if (PTA._failedTrials.length) PTA.flushFailedTrials();
  });
}

/**
 * Test whether Supabase is actually reachable and the results table readable.
 *
 * Added 2026-08-10. stroop.js's builder connection test called PTA.testSupabase
 * behind `if (window.PTA && PTA.testSupabase)`, but no such function existed
 * anywhere in the repo, so the guard fell through to the else branch and the
 * builder reported "Connected - Data will be saved automatically"
 * unconditionally, whether or not anything could be saved. That is the same
 * class of silent data loss the Stroop save bug caused, one layer up: the
 * experimenter is told their data is safe with no evidence that it is.
 *
 * Since 02cecb1 no module calls this directly. All five builders go through
 * PTA.paintConnectionStatus, which calls it and paints the answer, so there is
 * one implementation of "is the database actually there" instead of five.
 *
 * KNOWN LIMIT, worth stating: this proves a SELECT on `experiment_results`
 * succeeded. It does not prove an INSERT would, and it does not touch the other
 * tables (ec_results, subliminal_results). Under the anon policies in
 * sql/create_experiment_results_table.sql a readable table is normally a
 * writable one, but a policy change could make this report a false green. A
 * true write test is not implementable from the client: PostgREST runs each
 * request in its own server-side transaction, so a probe insert could not be
 * rolled back, and anon has no DELETE policy to clean it up afterwards.
 *
 * @async
 * @returns {Promise<boolean>} true only when a real query succeeded
 */
PTA.testSupabase = async function() {
  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized - connection test failed');
    return false;
  }
  try {
    const { error } = await PTA.supabase
      .from('experiment_results')
      .select('id')
      .limit(1);
    if (error) {
      console.error('PTA: connection test failed', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('PTA: connection test threw', e);
    return false;
  }
};

/**
 * Paint an honest connection status into a builder's status indicator.
 *
 * Every paradigm wrote its own version of this and four of them got it wrong the
 * same way: they checked that `PTA.supabase` was truthy and then reported
 * "Connected - Data will be saved automatically". But `PTA.supabase` is just the
 * client object; createClient() succeeds the moment the CDN script loads and
 * never contacts the project. So the builder said data was safe while the
 * database was unreachable - which on 2026-08-12 it was, for every experiment
 * on the live site. Two of the four went further and reported "Connected" in the
 * branch where PTA was missing entirely, i.e. exactly when saving is impossible.
 *
 * The only honest answer comes from a real query, which is what testSupabase
 * does. One implementation, so the mistake cannot be made a fifth time.
 *
 * @param {HTMLElement} statusEl - wrapper, gets the `error` class
 * @param {HTMLElement} [statusTextEl] - where the text goes; defaults to
 *        statusEl.querySelector('.status-text') or statusEl itself
 * @returns {Promise<boolean>} whether the database answered
 */
PTA.paintConnectionStatus = async function(statusEl, statusTextEl) {
  const textEl = statusTextEl || (statusEl && statusEl.querySelector('.status-text')) || statusEl;
  if (!textEl) return false;

  const set = (isError, html) => {
    if (statusEl) statusEl.classList[isError ? 'add' : 'remove']('error');
    textEl.innerHTML = html;
  };

  set(false, 'Testing the connection...');

  if (!window.PTA || !PTA.supabase) {
    set(true, '<strong>Not connected</strong> - the database client did not load, so ' +
      'nothing can be saved. Participants will be offered a download at the end instead.');
    return false;
  }

  try {
    const ok = await PTA.testSupabase();
    if (ok) {
      set(false, '<strong>Connected</strong> - Data will be saved automatically');
      return true;
    }
    set(true, '<strong>Not connected</strong> - the results database did not answer, so ' +
      'runs will NOT be stored on the server. Each participant will be shown a download ' +
      'button at the end instead; collect those files.');
    return false;
  } catch (e) {
    set(true, '<strong>Not connected</strong> - ' + PTA.escapeText(e && e.message ? e.message : String(e)));
    return false;
  }
};

/**
 * Escape a string for safe use inside innerHTML.
 * Error messages reach the status line and can contain markup.
 * @param {string} s
 * @returns {string}
 */
PTA.escapeText = function(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

/* =====================================================
   Export Functions
   ===================================================== */

/**
 * Export data array to CSV file and trigger download.
 * Handles escaping of commas and quotes in values.
 * @param {Object[]} data - Array of data objects to export
 * @param {string} [filename='experiment_data.csv'] - Download filename
 */
PTA.exportToCSV = function(data, filename) {
  if (!data || data.length === 0) {
    console.warn('PTA: No data to export');
    return;
  }

  // The union of every row's keys, not just the first row's. Rows are built
  // per-trial and a later trial can carry a field the first one did not (a
  // timeout row has no `key`, a practice row has no `condition`). Reading the
  // header off data[0] silently dropped those columns from the download, which
  // is data loss in the one file that exists to prevent data loss.
  const headers = [];
  const seen = Object.create(null);
  for (const row of data) {
    for (const k of Object.keys(row)) {
      if (!seen[k]) { seen[k] = true; headers.push(k); }
    }
  }
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      // Quote for commas, quotes AND line breaks. A newline inside an unquoted
      // field splits one row into two, silently, and every column after it
      // shifts. Not reachable from the app's own single-line inputs, but this
      // function is also fed rows read straight back out of Supabase
      // (index.html downloadData), whose text columns nothing constrains - and
      // it is the exporter the rescue path hands a failed run to, i.e. the last
      // copy of data that would otherwise be lost.
      const s = row[header] == null ? '' : String(row[header]);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  // Leading BOM. Without it Excel opens the file as the local ANSI codepage and
  // every Hebrew, Arabic, Russian and Chinese stimulus arrives as mojibake -
  // and this platform ships stimulus sets in all four. Every other exporter in
  // the repo already writes one; this one, the shared helper, did not.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'experiment_data.csv';
  link.click();

  URL.revokeObjectURL(url);
};

/* =====================================================
   Rescue: what happens when the database cannot be reached
   ===================================================== */

/**
 * Keep a run that could not be saved, and say so on screen.
 *
 * Until 2026-08-12 a failed save was a console.error and nothing else. The
 * participant reached a normal results screen, the experimenter was never told,
 * and the run was gone. That is not hypothetical: the Supabase project this
 * platform points at stopped resolving in DNS, so on that day EVERY run on the
 * live site was being discarded in silence while the screen looked healthy.
 *
 * A failed save is now three things instead of one:
 *   1. a copy in localStorage, so closing the tab is not instantly fatal
 *   2. a visible, unmissable panel saying the data is NOT on the server
 *   3. a download button, which is the only copy that actually leaves the machine
 *
 * The download is offered rather than forced: a click-free download is blocked
 * by browsers often enough that relying on it would recreate the silent failure.
 *
 * @param {Object[]} rows - the trial rows that failed to save
 * @param {Object} [opts]
 * @param {string} [opts.experimentName] - used in the filename and the message
 * @param {string} [opts.reason] - what went wrong, for the stored copy
 * @param {HTMLElement} [opts.host] - where to put the panel; defaults to a fixed overlay
 * @returns {string|null} the localStorage key the copy was written under
 */
PTA._rescued = (typeof WeakSet !== 'undefined') ? new WeakSet() : null;

PTA.rescueUnsavedResults = function(rows, opts) {
  opts = opts || {};
  if (!rows || !rows.length) return null;

  // saveAllResults rescues centrally, and a caller may rescue the same array
  // again with a better host. The array identity is the batch identity, so one
  // failed run produces one stored copy and one panel however many callers ask.
  if (PTA._rescued) {
    if (PTA._rescued.has(rows)) return null;
    PTA._rescued.add(rows);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = String(opts.experimentName || 'experiment')
    .replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'experiment';
  const filename = 'PrimingToolbox_UNSAVED_' + safeName + '_' + stamp + '.csv';

  /* 1. a copy that survives the results screen ---------------------------- */
  let key = null;
  try {
    key = 'ptbx_unsaved_' + stamp;
    localStorage.setItem(key, JSON.stringify({
      savedAt: stamp,
      experiment: opts.experimentName || '',
      reason: String(opts.reason || ''),
      rows: rows
    }));
    const idx = JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]');
    idx.push({ key: key, stamp: stamp, n: rows.length, experiment: opts.experimentName || '' });
    localStorage.setItem('ptbx_unsaved_index', JSON.stringify(idx));
  } catch (e) {
    // Private mode, or the quota is full. The download below is then the only
    // copy, which is exactly why the panel does not depend on this succeeding.
    console.warn('PTA: could not keep a local copy of the unsaved run', e);
    key = null;
  }

  /* 2 + 3. say it on screen, and give them the file ----------------------- */
  // Built as DOM nodes, never as an HTML string: the experiment name comes from
  // a ?config= URL and must not be able to inject markup into this panel.
  try {
    if (document.getElementById('pta-unsaved-panel')) return key;

    const box = document.createElement('div');
    box.id = 'pta-unsaved-panel';
    box.setAttribute('role', 'alert');
    box.style.cssText =
      'background:rgba(153,15,35,.22);border:1px solid #e38b82;border-left:5px solid #e38b82;' +
      'border-radius:12px;padding:16px 18px;margin:18px 0;font-family:"Segoe UI",Arial,sans-serif;' +
      'color:#ffd9d4;line-height:1.55;';

    const h = document.createElement('div');
    h.style.cssText = 'font-weight:700;font-size:1.02rem;color:#ff8fa3;margin-bottom:6px;';
    h.textContent = 'Your results were NOT saved to the database.';
    box.appendChild(h);

    const p = document.createElement('div');
    p.style.cssText = 'font-size:.93rem;margin-bottom:10px;';
    p.textContent = 'The server could not be reached, so these ' + rows.length +
      ' trials exist only in this browser window. Download them now and send the file ' +
      'to whoever gave you this link - closing this tab without downloading loses them.';
    box.appendChild(p);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Download my data (' + rows.length + ' trials)';
    btn.style.cssText =
      'background:#e38b82;color:#2a0d10;border:none;border-radius:9px;padding:11px 22px;' +
      'font-size:.95rem;font-weight:700;cursor:pointer;font-family:inherit;';
    btn.addEventListener('click', function () {
      PTA.exportToCSV(rows, filename);
      btn.textContent = 'Downloaded - check your Downloads folder';
      btn.disabled = true;
      btn.style.opacity = '.7';
      btn.style.cursor = 'default';
    });
    box.appendChild(btn);

    const why = document.createElement('div');
    why.style.cssText = 'font-size:.8rem;color:#c9a9a5;margin-top:10px;';
    why.textContent = opts.reason ? 'Reason: ' + String(opts.reason) : '';
    if (opts.reason) box.appendChild(why);

    const host = opts.host && opts.host.appendChild ? opts.host : null;
    if (host) {
      host.insertBefore(box, host.firstChild);
    } else {
      box.style.cssText += 'position:fixed;top:14px;left:50%;transform:translateX(-50%);' +
        'max-width:620px;width:calc(100% - 28px);z-index:99999;background:#2a0d10;box-shadow:0 12px 40px rgba(0,0,0,.6);';
      document.body.appendChild(box);
    }
  } catch (e) {
    console.error('PTA: could not show the unsaved-data panel', e);
  }

  return key;
};

/**
 * Every run this browser failed to save, newest last.
 * Recovery path for a run whose panel was closed or missed.
 * @returns {Object[]} [{key, stamp, n, experiment}]
 */
PTA.listUnsavedResults = function() {
  try {
    return JSON.parse(localStorage.getItem('ptbx_unsaved_index') || '[]');
  } catch (e) {
    return [];
  }
};

/**
 * Download one stranded run by its key from PTA.listUnsavedResults().
 * @param {string} key
 * @returns {boolean} true if something was downloaded
 */
PTA.downloadUnsavedResults = function(key) {
  try {
    const blob = JSON.parse(localStorage.getItem(key) || 'null');
    if (!blob || !blob.rows || !blob.rows.length) return false;
    PTA.exportToCSV(blob.rows, 'PrimingToolbox_RECOVERED_' + key.replace('ptbx_unsaved_', '') + '.csv');
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Export data array to Excel file and trigger download.
 * Requires SheetJS (XLSX) library to be loaded.
 * @param {Object[]} data - Array of data objects to export
 * @param {string} [filename='experiment_data.xlsx'] - Download filename
 */
PTA.exportToExcel = function(data, filename) {
  if (typeof XLSX === 'undefined') {
    console.error('PTA: SheetJS (XLSX) not loaded');
    alert('Excel export requires SheetJS library');
    return;
  }

  if (!data || data.length === 0) {
    console.warn('PTA: No data to export');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

  XLSX.writeFile(workbook, filename || 'experiment_data.xlsx');
};

/* =====================================================
   UI Helper Functions
   ===================================================== */

/**
 * Show a DOM element by removing 'hidden' class.
 * @param {HTMLElement|string} element - Element or element ID
 */
PTA.show = function(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.remove('hidden');
    element.style.display = '';
  }
};

/**
 * Hide a DOM element by adding 'hidden' class.
 * @param {HTMLElement|string} element - Element or element ID
 */
PTA.hide = function(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.add('hidden');
  }
};

/**
 * Show overlay element by adding 'active' class.
 * @param {string} overlayId - ID of overlay element
 */
PTA.showOverlay = function(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.add('active');
  }
};

/**
 * Hide overlay element by removing 'active' class.
 * @param {string} overlayId - ID of overlay element
 */
PTA.hideOverlay = function(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.remove('active');
  }
};

/**
 * Display status message in container element.
 * @param {HTMLElement|string} container - Container element or ID
 * @param {string} message - Message text to display
 * @param {string} [type='success'] - Message type ('success' or 'error')
 */
PTA.showMessage = function(container, message, type = 'success') {
  const msgDiv = document.createElement('div');
  msgDiv.className = type + '-message';
  msgDiv.textContent = message;

  if (typeof container === 'string') {
    container = document.getElementById(container);
  }

  if (container) {
    container.innerHTML = '';
    container.appendChild(msgDiv);
  }
};

// Export PTA to global scope
window.PTA = PTA;

console.log('PTA Core v' + PTA.config.version + ' loaded');
