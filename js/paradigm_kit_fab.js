/*
 * PREVIOUS VERSIONS ON GITHUB, newest first. Every change to this file adds a
 * line here, so any earlier state can be recovered if something goes wrong.
 *
 *   before the ABCD footnotes and the template-editing fixes, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/68bddb7/js/paradigm_kit_fab.js
 *
 *   before the experimenter-layer event logging, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/e93dccf/js/paradigm_kit_fab.js
 *
 *   before the full-codebase read of 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/02cecb1/js/paradigm_kit_fab.js
 *
 *   before a failed database save stopped being a console line, 2026-08-12
 *   https://github.com/shir-openu/PrimingToolbox/blob/934c0b5/js/paradigm_kit_fab.js
 *
 *   ===================================================== PrimingToolbox - Paradigm Kit (V2 _fab) ===================================================== NEW FILE, 2026-08-10. PREVIOUS VERSION ON GITHUB (before the ABCD panel was split out of paintSetup into abcdPanel/injectAbcd, 2026-08-11
 *   https://github.com/shir-openu/PrimingToolbox/blob/e090bd3/js/paradigm_kit_fab.js
 *
 *   first published version, before the shared scrambled-sentence prime phase was added for goal / money / moral priming
 *   https://github.com/shir-openu/PrimingToolbox/blob/57eef45/js/paradigm_kit_fab.js
 */
window.PTK = (function () {
  'use strict';

  var PTK = {};

  PTK.version = '1.0';

  /* ===================================================================
     Small shared helpers
     =================================================================== */

  /**
   * HTML-escape a value for safe interpolation.
   * Prefers PTA.escapeHtml (defined by js/asm_validator.js) so the repo has one
   * escaping behaviour, and falls back when that file is not loaded.
   * @param {*} s
   * @returns {string}
   */
  PTK.esc = function (s) {
    if (window.PTA && typeof PTA.escapeHtml === 'function') return PTA.escapeHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /**
   * Put a stimulus on screen without ever parsing it as HTML.
   *
   * Added 2026-08-10 after a real hole in stroop.js: the trial renderer built
   * its stimulus with a template literal into innerHTML, and the stimulus text
   * comes from this.data, which checkUrlConfig overwrites WHOLESALE from the
   * ?exp= participant link. A crafted link therefore ran arbitrary script on a
   * page holding the Supabase key. The same shape existed in semantic,
   * number-priming and amp.
   *
   * textContent never parses HTML, and assigning to el.style.* silently drops
   * an invalid value rather than letting it break out of an attribute - so this
   * removes the bug class instead of escaping one instance of it.
   *
   * @param {HTMLElement} host      element to clear and fill
   * @param {string} text           the stimulus, treated as plain text always
   * @param {string} [className]
   * @param {Object} [style]        e.g. { color: '#fff', fontSize: '6rem' }
   * @returns {HTMLElement} the span created
   */
  PTK.showText = function (host, text, className, style) {
    if (!host) return null;
    var span = document.createElement('span');
    if (className) span.className = className;
    if (style) {
      Object.keys(style).forEach(function (k) {
        try { span.style[k] = style[k]; } catch (e) { /* invalid value: dropped */ }
      });
    }
    span.textContent = text == null ? '' : String(text);
    host.textContent = '';
    host.appendChild(span);
    return span;
  };

  /**
   * Install a tracked-timer registry on a module.
   *
   * Contract requirement 22. An untracked setTimeout from trial N fires during
   * trial N+1, writes a row against the wrong stimulus and advances the trial
   * index behind the participant's back. That bug corrupted 15 of 24 trials in
   * masked_fab before it was found, and reaction time cannot detect it - the
   * fingerprint is a target/trial-number mismatch.
   *
   * After calling this, use mod._after(fn, ms) instead of setTimeout and call
   * mod._clearTimers() on close, at the start of each trial, when a response is
   * recorded, and when results are shown.
   *
   * @param {Object} mod - the paradigm module
   * @returns {Object} the same module, for chaining
   */
  PTK.timers = function (mod) {
    if (mod._ptkTimers) return mod;
    mod._ptkTimers = true;
    mod._timers = mod._timers || [];
    mod._after = function (fn, ms) {
      var id = setTimeout(function () {
        var i = mod._timers.indexOf(id);
        if (i !== -1) mod._timers.splice(i, 1);
        fn();
      }, ms);
      mod._timers.push(id);
      return id;
    };
    mod._clearTimers = function () {
      mod._timers.forEach(clearTimeout);
      mod._timers = [];
    };
    return mod;
  };

  /* ===================================================================
     Progress bar (contract requirement 19)
     =================================================================== */

  PTK.progressHtml = function (id) {
    return '' +
      '<div style="max-width:520px;margin:0 auto 6px;">' +
        '<div style="height:6px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;">' +
          '<div id="' + PTK.esc(id) + '" style="height:100%;width:0%;border-radius:999px;' +
               'background:linear-gradient(90deg,#169999,#ff4db8);transition:width .25s ease;"></div>' +
        '</div>' +
      '</div>';
  };

  PTK.setProgress = function (id, current, total) {
    var el = document.getElementById(id);
    if (!el) return;
    var pct = (!total || total <= 0) ? 0 : Math.max(0, Math.min(100, (current / total) * 100));
    el.style.width = pct.toFixed(1) + '%';
  };

  /* ===================================================================
     Participant links (contract requirements 11, 12, 13)
     =================================================================== */

  /**
   * UTF-8 safe. PTA.encodeConfig used to be bare btoa(JSON.stringify(...)),
   * which throws on any non-Latin-1 character, so it could not carry Hebrew,
   * Arabic or Chinese stimuli; it was brought into line with this on
   * 2026-08-11, so the repo now has one encoding rather than two.
   */
  PTK.encode = function (config) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(config))));
  };

  PTK.decode = function (raw) {
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  };

  PTK.buildLink = function (urlParam, config) {
    // P in the DHSS proposal: experiments PUBLISHED. Generating the participant
    // link is the moment an experiment stops being a draft, so this is where
    // publication is counted.
    if (window.PTA && PTA.logEvent) {
      PTA.logEvent('link_generated', {
        experimentType: urlParam,
        email: (config && config.experimenterEmail) || null,
        userExperimentId: (config && config.userExperimentId) || null
      });
    }
    // encodeURIComponent: base64 contains '+', and a raw '+' in a query string
    // decodes as a SPACE - the payload is corrupted and the link silently dies.
    // URLSearchParams turns %2B back into '+', so old links keep working.
    return window.location.href.split('?')[0] + '?' + urlParam + '=' +
           encodeURIComponent(PTK.encode(config));
  };

  /**
   * Refuse to mint a link that cannot be retrieved later.
   * experimenter_email + user_experiment_id are the exact two columns
   * PTA.fetchExperimenterData filters on; without both, the rows are written
   * but the experimenter can never pull their own data back.
   * @returns {boolean} true when the identity is usable
   */
  PTK.validateIdentity = function (email, expId) {
    email = (email || '').trim();
    expId = (expId || '').trim();
    if (email.indexOf('@') === -1) {
      alert('Please enter a valid email address.\n\nIt is one of the two fields used to find your data again later.');
      return false;
    }
    if (expId.length < 3) {
      alert('Please enter an experiment ID of at least 3 characters.\n\nIt is how your rows are grouped and retrieved.');
      return false;
    }
    return true;
  };

  /**
   * In-page link modal with a real Copy button.
   * window.prompt() cannot be used for this: it is untitled, unstyled, and on
   * mobile a long Base64 string is impossible to select.
   */
  PTK.showLinkModal = function (link, accent) {
    accent = accent || '#ff4db8';
    var old = document.getElementById('ptk-link-modal');
    if (old) old.remove();

    var wrap = document.createElement('div');
    wrap.id = 'ptk-link-modal';
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:3200;display:flex;' +
      'justify-content:center;align-items:center;padding:24px;';

    var panel = document.createElement('div');
    panel.style.cssText =
      'background:rgba(17,24,39,.97);border:1px solid ' + accent + ';border-radius:18px;' +
      'padding:32px;max-width:620px;width:100%;color:#e5e7eb;text-align:center;font-family:inherit;';

    var h = document.createElement('h3');
    h.textContent = 'Participant link';
    h.style.cssText = 'color:' + accent + ';margin-bottom:8px;';
    panel.appendChild(h);

    var p = document.createElement('p');
    p.textContent = 'Send this to your participants. It carries your stimuli and timing.';
    p.style.cssText = 'color:#9aa6b2;font-size:.9rem;margin-bottom:16px;';
    panel.appendChild(p);

    var box = document.createElement('textarea');
    box.readOnly = true;
    box.value = link;
    box.rows = 4;
    box.style.cssText =
      'width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);' +
      'background:rgba(0,0,0,.35);color:#cbd5e1;font-family:monospace;font-size:.8rem;' +
      'resize:vertical;word-break:break-all;';
    panel.appendChild(box);

    var status = document.createElement('div');
    status.style.cssText = 'min-height:20px;margin-top:10px;color:#4ade80;font-size:.86rem;';
    panel.appendChild(status);

    var row = document.createElement('div');
    row.style.cssText = 'margin-top:12px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;';

    var copy = document.createElement('button');
    copy.className = 'btn';
    copy.textContent = 'Copy link';
    copy.onclick = function () {
      box.select();
      box.setSelectionRange(0, box.value.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (!ok && navigator.clipboard) {
        navigator.clipboard.writeText(link).then(function () {
          status.textContent = 'Copied.';
        }, function () {
          status.style.color = '#fbbf24';
          status.textContent = 'Could not copy automatically - the link is selected, press Ctrl+C.';
        });
        return;
      }
      status.style.color = ok ? '#4ade80' : '#fbbf24';
      status.textContent = ok
        ? 'Copied.'
        : 'Could not copy automatically - the link is selected, press Ctrl+C.';
    };
    row.appendChild(copy);

    var close = document.createElement('button');
    close.className = 'btn btn-secondary';
    close.textContent = 'Close';
    close.onclick = function () { wrap.remove(); };
    row.appendChild(close);

    panel.appendChild(row);
    wrap.appendChild(panel);
    wrap.onclick = function (e) { if (e.target === wrap) wrap.remove(); };
    document.body.appendChild(wrap);
    box.focus();
    box.select();
  };

  /* ===================================================================
     Experiment id + connection test (requirements 9, 10)
     =================================================================== */

  PTK.generateExperimentId = function (prefix) {
    return (prefix || 'exp') + '_' + Date.now().toString(36);
  };

  /**
   * A real reachability probe, not a guess.
   * js/stroop.js calls PTA.testSupabase, which does not exist anywhere in the
   * repo; its guard falls through to the success branch, so that builder
   * reports "Connected" unconditionally. This issues an actual select.
   * @param {HTMLElement} statusEl
   */
  PTK.testConnection = function (statusEl) {
    if (!statusEl) return;
    statusEl.style.color = '#9aa6b2';
    statusEl.textContent = 'Testing...';

    if (!window.PTA || !PTA.supabase) {
      statusEl.style.color = '#f87171';
      statusEl.textContent = 'Not connected - Supabase is not initialised. Data would NOT be saved.';
      return;
    }
    PTA.supabase.from('experiment_results').select('id').limit(1)
      .then(function (res) {
        if (res && res.error) {
          statusEl.style.color = '#f87171';
          statusEl.textContent = 'Connection failed: ' + res.error.message + ' - data would NOT be saved.';
        } else {
          statusEl.style.color = '#4ade80';
          statusEl.textContent = 'Connected - data will be saved automatically.';
        }
      }, function (err) {
        statusEl.style.color = '#f87171';
        statusEl.textContent = 'Connection error: ' + (err && err.message ? err.message : err);
      });
  };

  /* ===================================================================
     Exports (requirement 18)
     =================================================================== */

  PTK.exportCSV = function (headers, rows, baseName) {
    if (!rows || !rows.length) { alert('No results to export.'); return; }
    var csv = [headers].concat(rows)
      .map(function (r) {
        return r.map(function (c) {
          return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"';
        }).join(',');
      }).join('\n');
    // The BOM is what stops Excel mangling non-Latin stimuli.
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = baseName + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  PTK.exportXLSX = function (headers, rows, baseName) {
    if (!rows || !rows.length) { alert('No results to export.'); return; }
    if (typeof XLSX === 'undefined') {
      alert('Excel export needs the SheetJS library, which did not load.\nUse Download CSV instead.');
      return;
    }
    var aoa = [headers].concat(rows);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, baseName + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  };

  /* ===================================================================
     Generated interpretation (requirement 17)
     =================================================================== */

  /**
   * Plain-language reading of a result, branching on sign, size and accuracy.
   * The point is that someone without a stats background can read their own
   * result, and that a null or reversed effect does not look like a failure.
   *
   * @param {Object} o
   * @param {number|null} o.effect      the D - C difference
   * @param {string} o.unit             'ms', 'percentage points', ...
   * @param {string} o.effectName       e.g. 'affective priming effect'
   * @param {number} [o.expectedSign]   +1 if a positive effect is the predicted
   *                                    direction, -1 if negative. Negative
   *                                    priming and Stroop predict +1 slower.
   * @param {number|null} [o.accuracy]  percent correct
   * @param {number} [o.n]              trials contributing
   * @param {number} [o.small]          below this magnitude, call it no effect
   * @param {string} [o.note]           paradigm-specific caveat, appended
   * @returns {string} HTML paragraph
   */
  PTK.interpret = function (o) {
    var effect = o.effect;
    var unit = o.unit || 'ms';
    var name = o.effectName || 'effect';
    var sign = typeof o.expectedSign === 'number' ? o.expectedSign : 1;
    var small = typeof o.small === 'number' ? o.small : (unit === 'ms' ? 10 : 5);
    var parts = [];

    if (effect === null || effect === undefined || isNaN(effect)) {
      parts.push('There were not enough usable trials to compute the ' + PTK.esc(name) + '.');
    } else {
      var mag = Math.abs(effect);
      var inPredicted = (effect * sign) > 0;
      if (mag < small) {
        parts.push('Your ' + PTK.esc(name) + ' is ' + effect + ' ' + PTK.esc(unit) +
          ', which is close to zero. In a single short session that is a perfectly ordinary result - ' +
          'these effects are small and usually need many participants to show up reliably.');
      } else if (inPredicted) {
        parts.push('Your ' + PTK.esc(name) + ' is ' + effect + ' ' + PTK.esc(unit) +
          ', in the direction the paradigm predicts.');
      } else {
        parts.push('Your ' + PTK.esc(name) + ' is ' + effect + ' ' + PTK.esc(unit) +
          ', which runs opposite to the usual direction. That is not a mistake on your part - ' +
          'reversals are common in one person over few trials.');
      }
    }

    if (typeof o.n === 'number' && o.n > 0 && o.n < 20) {
      parts.push('This is based on only ' + o.n + ' usable trials, so treat the number as a demonstration rather than a measurement.');
    }
    if (typeof o.accuracy === 'number' && o.accuracy < 80) {
      parts.push('Accuracy was ' + Math.round(o.accuracy) + '%. Below about 80% the reaction times are hard to interpret, ' +
        'because errors and speed trade off against each other.');
    }
    if (o.note) parts.push(o.note);

    return '<p style="color:#9aa6b2;font-size:.92rem;line-height:1.75;max-width:560px;margin:14px auto 0;text-align:left;">' +
      parts.map(PTK.esc).join(' ') + '</p>';
  };

  /* ===================================================================
     A/S/M design object (requirement 25)
     =================================================================== */

  /**
   * Emit a design object shaped the way js/asm_validator.js actually reads it.
   *
   * Reported honestly: NO module in the repo currently emits these keys, mature
   * ones included, so association reports 'incomplete' and modulation reports
   * 'warn' for every design the validator has ever been handed. This is the
   * shape it looks for.
   *
   * @param {Object} spec - the paradigm spec
   * @param {Object} mod  - the live module, for its current stimuli
   */
  PTK.asmDesign = function (spec, mod) {
    var asm = (typeof spec.asm === 'function') ? spec.asm(mod) : (spec.asm || {});
    var design = {
      experiment_type: spec.key,
      name: spec.name,
      instructions: asm.instructions || spec.instructions || '',
      primes: asm.primes || [],
      targets: asm.targets || [],
      conditions: asm.conditions || [],
      response: asm.response || {},
      baseline: asm.baseline || null
    };
    return design;
  };

  /**
   * Run the validator over a spec + module and paint the report into a panel.
   * Advisory only - it must never block a run.
   */
  PTK.renderASM = function (spec, mod, panel) {
    if (!panel) return null;
    if (!window.PTA || typeof PTA.validateASM !== 'function') {
      panel.textContent = 'The A/S/M checker (js/asm_validator.js) is not loaded on this page.';
      return null;
    }
    var report = PTA.validateASM(PTK.asmDesign(spec, mod));
    if (typeof PTA.renderASMReport === 'function') {
      PTA.renderASMReport(report, panel);
    } else {
      panel.textContent = JSON.stringify(report);
    }
    return report;
  };

  /* ===================================================================
     Template Builder (requirements 5, 6, 8)
     =================================================================== */

  function labelled(labelText, node, help) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:14px;text-align:left;';
    var l = document.createElement('label');
    l.textContent = labelText;
    l.style.cssText = 'display:block;color:#e5e7eb;font-size:.88rem;margin-bottom:6px;font-weight:600;';
    wrap.appendChild(l);
    wrap.appendChild(node);
    if (help) {
      var h = document.createElement('div');
      h.textContent = help;
      h.style.cssText = 'color:#64748b;font-size:.78rem;margin-top:5px;line-height:1.5;';
      wrap.appendChild(h);
    }
    return wrap;
  }

  function textInput(value, placeholder) {
    var i = document.createElement('input');
    i.type = 'text';
    i.value = value == null ? '' : value;
    if (placeholder) i.placeholder = placeholder;
    i.style.cssText =
      'width:100%;padding:9px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.18);' +
      'background:rgba(0,0,0,.30);color:#e5e7eb;font-family:inherit;font-size:.92rem;';
    return i;
  }

  function numberInput(value, min, max, step) {
    var i = document.createElement('input');
    i.type = 'number';
    i.value = value;
    if (min !== undefined) i.min = min;
    if (max !== undefined) i.max = max;
    i.step = step || 1;
    i.style.cssText =
      'width:110px;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);' +
      'background:rgba(0,0,0,.30);color:#e5e7eb;font-family:inherit;font-size:.92rem;';
    return i;
  }

  function sectionCard(title, accent) {
    var c = document.createElement('div');
    c.style.cssText =
      'background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.09);border-radius:14px;' +
      'padding:18px 20px;margin-bottom:16px;text-align:left;';
    if (title) {
      var h = document.createElement('h4');
      h.textContent = title;
      h.style.cssText = 'color:' + (accent || '#ff4db8') + ';font-size:.96rem;margin-bottom:12px;';
      c.appendChild(h);
    }
    return c;
  }

  /** The ABCD panel every builder must carry (requirement 5). */
  function abcdCard(spec) {
    var c = sectionCard('ABCD framework structure', spec.accent);
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;';
    ['A', 'B', 'C', 'D'].forEach(function (k) {
      var cell = document.createElement('div');
      cell.style.cssText = 'background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.08);' +
                           'border-radius:10px;padding:11px 13px;';
      cell.innerHTML = '<span style="color:' + PTK.esc(spec.accent || '#ff4db8') +
        ';font-weight:700;font-size:1.1rem;display:block;margin-bottom:4px;">' + k + '</span>' +
        '<span style="color:#b6c0cc;font-size:.86rem;line-height:1.55;">' +
        PTK.esc((spec.abcd && spec.abcd[k]) || '-') + '</span>';
      grid.appendChild(cell);
    });
    c.appendChild(grid);

    if (spec.characteristics) {
      var ul = document.createElement('div');
      ul.style.cssText = 'margin-top:14px;';
      ['association', 'secondariness', 'modulation'].forEach(function (k) {
        if (!spec.characteristics[k]) return;
        var d = document.createElement('div');
        d.style.cssText = 'color:#b6c0cc;font-size:.86rem;line-height:1.65;margin-bottom:6px;';
        d.innerHTML = '<span style="color:#35d6d6;font-weight:600;text-transform:capitalize;">' +
          k + ':</span> ' + PTK.esc(spec.characteristics[k]);
        ul.appendChild(d);
      });
      c.appendChild(ul);
    }

    if (spec.boundaryNote) {
      var warn = document.createElement('div');
      warn.style.cssText = 'margin-top:14px;border-left:3px solid #e38b82;background:rgba(153,15,35,.14);' +
                           'border-radius:0 10px 10px 0;padding:12px 14px;color:#d6c2c6;font-size:.86rem;line-height:1.65;';
      warn.textContent = spec.boundaryNote;
      c.appendChild(warn);
    }
    return c;
  }

  /**
   * Open the Template Builder for a paradigm.
   * @param {Object} mod  - the live module (its .data and .timing are edited)
   * @param {Object} spec - see the header of any *_fab.js that calls this
   */
  PTK.openBuilder = function (mod, spec) {
    PTK.closeBuilder(spec);
    // Experimenter layer (DHSS proposal). Opening a builder is the start of
    // "time in editor" - U - and the heartbeat is what turns it into a duration
    // rather than a single click. Stopped in PTK.closeBuilder.
    if (window.PTA && PTA.logEvent) {
      PTA.logEvent('builder_opened', {
        experimentType: spec.key,
        email: mod.experimenterEmail || null,
        userExperimentId: mod.userExperimentId || null
      });
      PTA.startEditorHeartbeat('builder', { experimentType: spec.key });
    }
    var accent = spec.accent || '#ff4db8';
    var idBase = 'ptk-builder-' + spec.key;

    var overlay = document.createElement('div');
    overlay.id = idBase;
    overlay.className = 'ptk-builder-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(6,10,20,.97);z-index:2400;overflow:auto;padding:32px 20px;';

    var panel = document.createElement('div');
    panel.style.cssText =
      'max-width:860px;margin:0 auto;color:#e5e7eb;font-family:inherit;';

    /* --- header --- */
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:6px;';
    var htxt = document.createElement('div');
    htxt.innerHTML =
      '<h2 style="color:' + PTK.esc(accent) + ';margin:0;">' + PTK.esc(spec.name) + ' - Template Builder</h2>' +
      '<div style="color:#64748b;font-size:.88rem;margin-top:4px;">' + PTK.esc(spec.source || '') + '</div>';
    head.appendChild(htxt);
    var x = document.createElement('button');
    x.className = 'btn btn-secondary';
    x.textContent = 'Close';
    // Closing is a FOURTH way out of the builder, and until 2026-08-12 it was
    // the only one that did not run afterApply.
    //
    // goal_fab, money_fab and social_fab flatten their stimuli in place when the
    // builder opens - {words:[5], embedded} becomes {wordsText, embedded} so the
    // table can edit them as text. afterApply is what rebuilds the array, and it
    // ran only from applyToModule, i.e. only on Preview, Generate link and Check
    // design. Press Close instead and the module was left holding the flattened
    // shape: verified, data.achievementItems[0] came back with keys
    // ['wordsText','embedded'] and no `words` at all. The next run then reaches
    // PTK.scrambledPhase and shuffles undefined.
    //
    // Abandoning a builder is the most ordinary thing a user does, and it left
    // the experiment broken until the page was reloaded.
    x.onclick = function () { PTK.closeBuilder(spec, mod); };
    head.appendChild(x);
    panel.appendChild(head);

    panel.appendChild(document.createElement('div')).style.cssText = 'height:14px;';

    /* --- ABCD --- */
    panel.appendChild(abcdCard(spec));

    /* --- identity --- */
    var idCard = sectionCard('Your identity (used to find your data later)', accent);
    var emailIn = textInput(mod.experimenterEmail || '', 'you@university.edu');
    idCard.appendChild(labelled('Your email', emailIn,
      'Written to every row as experimenter_email. One of the two fields used to retrieve your data.'));

    var expRow = document.createElement('div');
    expRow.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
    var expIn = textInput(mod.userExperimentId || '', spec.key + '_pilot_1');
    expIn.style.flex = '1 1 auto';
    expRow.appendChild(expIn);
    var genBtn = document.createElement('button');
    genBtn.className = 'btn btn-secondary';
    genBtn.textContent = 'Generate';
    genBtn.style.cssText += ';white-space:nowrap;';
    genBtn.onclick = function () {
      expIn.value = PTK.generateExperimentId(spec.key);
      expIn.style.borderColor = 'rgba(74,222,128,.7)';
    };
    expRow.appendChild(genBtn);
    idCard.appendChild(labelled('Experiment ID', expRow,
      'Written to every row as user_experiment_id, and used as the row experiment_id so your rows group under the name you chose.'));

    var statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:.86rem;min-height:20px;color:#64748b;margin-top:4px;';
    statusEl.textContent = 'Connection not tested yet.';
    var testBtn = document.createElement('button');
    testBtn.className = 'btn btn-secondary';
    testBtn.textContent = 'Test connection';
    testBtn.onclick = function () { PTK.testConnection(statusEl); };
    idCard.appendChild(testBtn);
    idCard.appendChild(statusEl);
    panel.appendChild(idCard);

    /* --- stimuli --- */
    var stimInputs = [];
    (spec.stimulusGroups || []).forEach(function (group) {
      var card = sectionCard(group.label, accent);
      var listWrap = document.createElement('div');
      card.appendChild(listWrap);

      var current = (mod.data && mod.data[group.key]) ? mod.data[group.key].slice() : [];
      var min = group.min || 2;

      function redraw() {
        listWrap.innerHTML = '';
        current.forEach(function (item, i) {
          var row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';

          if (group.type === 'rows') {
            group.fields.forEach(function (f) {
              var inp = textInput(item[f.key], f.label);
              inp.style.flex = '1 1 0';
              inp.oninput = function () { item[f.key] = inp.value; };
              row.appendChild(inp);
            });
          } else {
            var inp2 = textInput(item, group.label);
            inp2.style.flex = '1 1 auto';
            inp2.oninput = function () { current[i] = inp2.value; };
            row.appendChild(inp2);
          }

          var del = document.createElement('button');
          del.className = 'btn btn-secondary';
          del.textContent = '−';
          del.title = 'Remove';
          del.style.cssText += ';padding:6px 12px;';
          del.onclick = function () {
            if (current.length <= min) {
              alert(group.label + ' needs at least ' + min + ' entries.');
              return;
            }
            current.splice(i, 1);
            redraw();
          };
          row.appendChild(del);
          listWrap.appendChild(row);
        });

        var add = document.createElement('button');
        add.className = 'btn btn-secondary';
        add.textContent = '+ Add';
        add.style.cssText += ';margin-top:4px;';
        add.onclick = function () {
          if (group.type === 'rows') {
            var blank = {};
            group.fields.forEach(function (f) { blank[f.key] = ''; });
            current.push(blank);
          } else {
            current.push('');
          }
          redraw();
        };
        listWrap.appendChild(add);
      }
      redraw();

      if (group.help) {
        var h = document.createElement('div');
        h.textContent = group.help;
        h.style.cssText = 'color:#64748b;font-size:.78rem;margin-top:10px;line-height:1.5;';
        card.appendChild(h);
      }
      stimInputs.push({ group: group, read: function () { return current; } });
      panel.appendChild(card);
    });

    /* --- timing --- */
    var timeInputs = [];
    if (spec.timingFields && spec.timingFields.length) {
      var tCard = sectionCard('Timing (milliseconds)', accent);
      var tGrid = document.createElement('div');
      tGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;';
      spec.timingFields.forEach(function (f) {
        var val = (mod.timing && mod.timing[f.key] !== undefined) ? mod.timing[f.key] : (f.def || 0);
        var inp = numberInput(val, f.min, f.max, f.step || 10);
        tGrid.appendChild(labelled(f.label, inp, f.help));
        timeInputs.push({ key: f.key, input: inp, min: f.min, max: f.max });
      });
      tCard.appendChild(tGrid);

      var seq = document.createElement('div');
      seq.style.cssText = 'color:#9aa6b2;font-size:.86rem;margin-top:10px;font-family:monospace;';
      function updateSeq() {
        seq.textContent = 'Sequence: ' + timeInputs.map(function (t) {
          var f = spec.timingFields.filter(function (x) { return x.key === t.key; })[0];
          return f.label + ' ' + t.input.value + 'ms';
        }).join('  →  ');
      }
      timeInputs.forEach(function (t) { t.input.oninput = updateSeq; });
      updateSeq();
      tCard.appendChild(seq);
      panel.appendChild(tCard);
    }

    /* --- practice --- */
    var practiceIn = null;
    if (spec.practice) {
      var pCard = sectionCard('Practice', accent);
      practiceIn = numberInput(mod.practiceTrials !== undefined ? mod.practiceTrials : spec.practice.def, 0, 20, 1);
      pCard.appendChild(labelled('Practice trials before the scored block', practiceIn,
        'Practice trials are shown, then discarded. Untrained web participants spend their first trials learning the task; scoring those inflates the baseline and shrinks the effect. 0 disables practice.'));
      panel.appendChild(pCard);
    }

    /* --- repetitions --- */
    var repIn = null;
    if (spec.repetitions) {
      var rCard = sectionCard('Length', accent);
      repIn = numberInput(mod[spec.repetitions.prop] !== undefined ? mod[spec.repetitions.prop] : spec.repetitions.def,
                          spec.repetitions.min, spec.repetitions.max, 1);
      rCard.appendChild(labelled(spec.repetitions.label, repIn, spec.repetitions.help));
      panel.appendChild(rCard);
    }

    /* --- A/S/M advisory --- */
    var asmCard = sectionCard('Design check (Association / Secondariness / Modulation)', accent);
    var asmPanel = document.createElement('div');
    asmPanel.style.cssText = 'background:#fafafa;border-radius:10px;padding:4px 10px;color:#111;';
    var asmBtn = document.createElement('button');
    asmBtn.className = 'btn btn-secondary';
    asmBtn.textContent = 'Check this design';
    asmBtn.onclick = function () { applyToModule(); PTK.renderASM(spec, mod, asmPanel); };
    asmCard.appendChild(asmBtn);
    asmCard.appendChild(document.createElement('div')).style.cssText = 'height:10px;';
    asmCard.appendChild(asmPanel);
    var asmNote = document.createElement('div');
    asmNote.textContent = 'Advisory only. It never blocks a run.';
    asmNote.style.cssText = 'color:#64748b;font-size:.78rem;margin-top:8px;';
    asmCard.appendChild(asmNote);
    panel.appendChild(asmCard);

    /* --- write the form back into the live module --- */
    function applyToModule() {
      mod.experimenterEmail = emailIn.value.trim();
      mod.userExperimentId = expIn.value.trim();

      stimInputs.forEach(function (s) {
        var vals = s.read();
        if (s.group.type === 'rows') {
          vals = vals.filter(function (o) {
            return s.group.fields.some(function (f) { return String(o[f.key] || '').trim() !== ''; });
          });
        } else {
          vals = vals.map(function (v) { return String(v).trim(); }).filter(Boolean);
        }
        if (vals.length >= (s.group.min || 2)) mod.data[s.group.key] = vals;
      });

      timeInputs.forEach(function (t) {
        var v = parseInt(t.input.value, 10);
        if (!isNaN(v)) {
          if (t.min !== undefined) v = Math.max(t.min, v);
          if (t.max !== undefined) v = Math.min(t.max, v);
          t.input.value = v;
          mod.timing[t.key] = v;
        }
      });

      if (practiceIn) {
        var p = parseInt(practiceIn.value, 10);
        mod.practiceTrials = isNaN(p) ? 0 : Math.max(0, Math.min(20, p));
      }
      if (repIn) {
        var r = parseInt(repIn.value, 10);
        if (!isNaN(r)) {
          mod[spec.repetitions.prop] = Math.max(spec.repetitions.min, Math.min(spec.repetitions.max, r));
        }
      }

      // Last chance for a paradigm whose editable table is a flattened view of
      // a nested stimulus shape to fold the table back into its real structure.
      // Runs for every path out of the builder - preview, link and A/S/M check -
      // so none of them can act on a stale stimulus set.
      if (typeof spec.afterApply === 'function') spec.afterApply(mod);
    }

    /* --- actions --- */
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin:22px 0 40px;';

    var preview = document.createElement('button');
    preview.className = 'btn btn-secondary';
    preview.textContent = 'Preview it';
    preview.onclick = function () {
      applyToModule();
      mod.state.openedFromBuilder = true;
      PTK.closeBuilder(spec);
      mod.open();
    };
    actions.appendChild(preview);

    var link = document.createElement('button');
    link.className = 'btn';
    link.textContent = 'Generate participant link';
    link.onclick = function () {
      if (!PTK.validateIdentity(emailIn.value, expIn.value)) return;
      applyToModule();
      var config = spec.toConfig(mod);
      PTK.showLinkModal(PTK.buildLink(spec.urlParam, config), accent);
    };
    actions.appendChild(link);

    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    overlay.scrollTop = 0;

    // Answer "which of these can I change?" the moment the builder opens.
    // After the layout has settled, or offsetParent is still null and every
    // control looks hidden.
    setTimeout(function () { PTK.markEditable(overlay); }, 60);
  };

  /* ===================================================================
     "Which of these can I actually change?"
     =================================================================== */

  /**
   * Mark every editable control in a builder, so it can be seen at a glance.
   *
   * Shir, 2026-08-12: "you can't quickly see at a glance what is editable and
   * what is not - as a start, just highlight the boxes that ARE editable, with
   * a purple glow", and pointed at her own page as the reference:
   * https://shir-openu.github.io/differential_linear_operator_addition-en/
   * That page uses --purple #a78bfa and a keyframe called controlBlink, two
   * pulses, on its buttons and selects. Same colour, same shape, same restraint.
   *
   * Two layers, because a pulse alone only answers the question for three
   * seconds:
   *   - an OPENING PULSE across every editable control (her effect, 3 runs)
   *   - a quiet permanent purple edge that stays after the pulse, so the
   *     question is still answered ten minutes later
   *
   * Disabled and readonly controls are deliberately skipped: they are exactly
   * the things this is meant to distinguish. Hidden ones are skipped too - a
   * glow inside a collapsed section highlights nothing.
   *
   * @param {HTMLElement|string} root - builder container, or its id
   * @param {Object} [opts]
   * @param {boolean} [opts.pulse=true] - run the opening pulse
   * @returns {number} how many controls were marked
   */
  PTK.markEditable = function (root, opts) {
    opts = opts || {};
    var host = typeof root === 'string' ? document.getElementById(root) : root;
    if (!host) return 0;

    if (!document.getElementById('ptk-editable-style')) {
      var st = document.createElement('style');
      st.id = 'ptk-editable-style';
      st.textContent =
        '@keyframes ptkControlBlink{' +
          '0%,100%{box-shadow:0 0 0 1px rgba(167,139,250,.25) inset}' +
          '50%{box-shadow:0 0 15px #a78bfa,0 0 0 2px #a78bfa inset}}' +
        // the quiet state: still obviously "this one", but not shouting
        '.ptk-editable{border-color:rgba(167,139,250,.55) !important;' +
          'box-shadow:0 0 0 1px rgba(167,139,250,.22) inset;}' +
        '.ptk-editable:focus{border-color:#a78bfa !important;' +
          'box-shadow:0 0 10px rgba(167,139,250,.55) !important;outline:none;}' +
        '.ptk-editable-pulse{animation:ptkControlBlink 1.5s ease-in-out 3;}' +
        '.ptk-editable-legend{display:flex;align-items:center;gap:8px;margin:0 0 14px;' +
          'font-size:.82rem;color:#c9b8f5;background:rgba(167,139,250,.10);' +
          'border:1px solid rgba(167,139,250,.35);border-radius:9px;padding:8px 12px;}' +
        '.ptk-editable-swatch{width:26px;height:14px;border-radius:4px;flex:none;' +
          'border:1px solid #a78bfa;box-shadow:0 0 8px rgba(167,139,250,.7);}';
      (document.head || document.documentElement).appendChild(st);
    }

    var controls = host.querySelectorAll('input, select, textarea');
    var marked = 0;
    Array.prototype.forEach.call(controls, function (el) {
      if (el.disabled || el.readOnly) return;
      if (el.type === 'hidden') return;
      // offsetParent is null for anything inside a position:fixed ancestor, so
      // it is not a visibility test. offsetWidth/offsetHeight are.
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return;      // not visible
      el.classList.add('ptk-editable');
      if (opts.pulse !== false) {
        el.classList.add('ptk-editable-pulse');
        // Remove the pulse class when it finishes so re-opening replays it.
        setTimeout(function () { el.classList.remove('ptk-editable-pulse'); }, 4800);
      }
      marked++;
    });

    if (marked && opts.legend !== false && !host.querySelector('.ptk-editable-legend')) {
      var bar = document.createElement('div');
      bar.className = 'ptk-editable-legend';
      var sw = document.createElement('span');
      sw.className = 'ptk-editable-swatch';
      bar.appendChild(sw);
      var txt = document.createElement('span');
      txt.textContent = 'Anything outlined in purple is yours to change (' + marked +
        ' fields here). Anything else is fixed for this experiment - to change it, ' +
        'build one from scratch.';
      bar.appendChild(txt);
      host.insertBefore(bar, host.firstChild);
    }
    return marked;
  };

  /**
   * Close a builder, and leave the module in a runnable state.
   *
   * @param {Object} spec
   * @param {Object} [mod] - when given, spec.afterApply is run so a module that
   *        flattened its own stimuli for editing gets them rebuilt. Every exit
   *        from the builder must do this; Close was the one that did not.
   */
  PTK.closeBuilder = function (spec, mod) {
    if (mod && typeof spec.afterApply === 'function') {
      try {
        spec.afterApply(mod);
      } catch (e) {
        // Better a logged failure than a half-closed builder: the overlay still
        // goes away, and the module is no worse off than before this existed.
        console.error(spec.key + ': afterApply failed on close', e);
      }
    }
    var el = document.getElementById('ptk-builder-' + spec.key);
    if (el) el.remove();
    if (window.PTA && PTA.stopEditorHeartbeat) PTA.stopEditorHeartbeat();
  };

  /* ===================================================================
     Participant-side decode (requirements 12, 13)
     =================================================================== */

  /**
   * Shared checkUrlConfig body. Returns true when this module owns the link.
   * Applies stimuli AND timing over the defaults, which is the whole point -
   * a link that carries only an email means the builder edits never reach the
   * participant and the Template Builder is decorative.
   */
  /**
   * Strip HTML-significant characters out of every string in a decoded config.
   *
   * This is the taint boundary. Everything below this line came out of a URL a
   * stranger can hand a participant, and it goes on to be written into
   * mod.data / mod.responseKeys - which each paradigm's spec() then
   * concatenates into its `example` and `keyLegend` HTML strings, which
   * paintSetup assigns to innerHTML. Those spec strings are DELIBERATE markup
   * (divs, colours, arrows), so paintSetup cannot escape them wholesale; and
   * asking ten modules to remember PTK.esc at every interpolation is a rule
   * that will be broken by the eleventh. masked_fab was already breaking it.
   *
   * So the fix is here instead. Three characters are removed and no others:
   *   <  >   cannot open or close a tag
   *   "      cannot break out of an attribute (every spec writes its HTML
   *          attributes double-quoted, inside single-quoted JS strings)
   * Apostrophes and ampersands are deliberately KEPT: neither can inject on
   * its own here, and stripping them would quietly mangle real stimuli -
   * DON'T, L'EAU, R&D. Sanitising has to stay narrow enough that an
   * experimenter never notices it on legitimate input, or it becomes the bug.
   *
   * @param {*} node - anything from the decoded config
   * @param {number} [depth]
   * @returns {*} the same shape with its strings made inert
   */
  PTK.sanitizeConfigValue = function (node, depth) {
    depth = depth || 0;
    if (depth > 6) return null;
    if (typeof node === 'string') {
      var clean = node.replace(/[<>"]/g, '');
      if (clean !== node) {
        console.warn('PTK: markup characters removed from a value in the participant link');
      }
      return clean;
    }
    if (typeof node === 'number' || typeof node === 'boolean' || node == null) return node;
    if (Array.isArray(node)) {
      return node.map(function (v) { return PTK.sanitizeConfigValue(v, depth + 1); });
    }
    if (typeof node === 'object') {
      var out = {};
      Object.keys(node).forEach(function (k) {
        out[k] = PTK.sanitizeConfigValue(node[k], depth + 1);
      });
      return out;
    }
    return null;
  };

  PTK.checkUrlConfig = function (mod, spec) {
    var raw = new URLSearchParams(window.location.search).get(spec.urlParam);
    if (!raw) return false;
    try {
      var config = PTK.decode(raw);
      if (config.template !== spec.template) return false;

      // Everything past this point is attacker-controlled. See sanitizeConfigValue.
      config = PTK.sanitizeConfigValue(config);

      mod.isParticipantMode = true;
      mod.experimenterEmail = config.experimenterEmail || '';
      mod.userExperimentId = config.userExperimentId || '';

      if (config.stimuli) {
        Object.keys(config.stimuli).forEach(function (k) {
          var v = config.stimuli[k];
          if (Array.isArray(v) && v.length) mod.data[k] = v;
        });
      }
      if (config.timing && mod.timing) {
        Object.keys(config.timing).forEach(function (k) {
          var v = config.timing[k];
          if (typeof v === 'number' && isFinite(v)) mod.timing[k] = v;
        });
      }
      if (typeof config.practiceTrials === 'number') mod.practiceTrials = config.practiceTrials;
      if (spec.repetitions && typeof config[spec.repetitions.prop] === 'number') {
        mod[spec.repetitions.prop] = config[spec.repetitions.prop];
      }
      if (typeof spec.applyConfig === 'function') spec.applyConfig(mod, config);

      var layout = document.querySelector('.layout');
      if (layout) layout.style.display = 'none';
      mod.open();
      return true;
    } catch (e) {
      console.error(spec.name + ': bad participant config', e);
      return false;
    }
  };

  /* ===================================================================
     Participant setup screen  (contract requirements 4 and 5)
     =================================================================== */

  /**
   * Paint the setup screen a participant actually reads, in the house style the
   * mature modules use (see #stroop-setup in index.html).
   *
   * Added 2026-08-10 after Shir opened ?open=goal and reported three things,
   * all of which were true of every _fab paradigm:
   *   1. it looked nothing like Stroop or Number Priming
   *   2. it never explained ABCD, association, secondariness or modulation
   *   3. as a subject you could not tell what you were being asked to do
   *
   * The mature screens carry a bordered "Instructions / How to Play" panel with
   * a WORKED VISUAL EXAMPLE. That example is the part that makes the task
   * obvious, and no _fab module had one. Everything here is generated from the
   * spec, so one implementation fixes all eight paradigms and any future one.
   *
   * @param {string} containerId  element to fill
   * @param {Object} mod
   * @param {Object} spec  needs: name, source, accent, howToPlay[], example (HTML),
   *                       abcd{A,B,C,D}, characteristics{...}, startFn, closeFn
   */
  /**
   * The "What is being measured: the ABCD framework" panel, on its own.
   *
   * Split out of paintSetup on 2026-08-11 so the six paradigms that predate
   * this kit - stroop, semantic, evaluative, amp, number-priming, subliminal -
   * can carry the same panel without being rewritten onto paintSetup. They
   * paint their own setup screens, with their own builders and option
   * selectors, and migrating them would be a large change with nothing to gain;
   * what they were missing was only this box.
   *
   * @param {Object} spec  {accent, abcd:{A,B,C,D}, characteristics:{...},
   *                        articleAnchor, boundaryNote, articleBase}
   * @returns {string} HTML
   */
  PTK.abcdPanel = function (spec) {
    var e = PTK.esc;
    var accent = spec.accent || '#ff4db8';
    // Pages in a subdirectory pass their own prefix; index.html needs none.
    var base = spec.articleBase == null ? 'article/abcd-framework.html' : spec.articleBase;

    var chars = ['association', 'secondariness', 'modulation'].map(function (k) {
      var v = (spec.characteristics || {})[k];
      if (!v) return '';
      var met = /^NOT MET/i.test(v);
      return '<div style="margin-bottom:10px;line-height:1.7;color:#c4ccd6;font-size:.93rem;">' +
        '<span style="color:' + (met ? '#f87171' : '#35d6d6') + ';font-weight:700;text-transform:capitalize;">' +
        k + ':</span> ' + e(v) + '</div>';
    }).join('');

    var abcd = ['A', 'B', 'C', 'D'].map(function (k) {
      var label = { A: 'Prime', B: 'Target', C: 'Baseline outcome', D: 'Measured outcome' }[k];
      return '<div style="background:rgba(0,0,0,.30);border:1px solid rgba(255,255,255,.10);' +
                    'border-radius:12px;padding:14px 16px;">' +
        '<div style="color:' + e(accent) + ';font-weight:700;font-size:1.3rem;line-height:1;">' + k + '</div>' +
        '<div style="color:#e5e7eb;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;margin:6px 0 8px;">' +
          e(label) + '</div>' +
        '<div style="color:#b6c0cc;font-size:.9rem;line-height:1.6;">' +
          e((spec.abcd || {})[k] || '-') + '</div>' +
      '</div>';
    }).join('');

    return '<div style="background:rgba(17,24,39,.55);border:1px solid rgba(255,77,184,.28);border-radius:15px;' +
             'padding:22px 24px;margin-bottom:22px;text-align:left;">' +
        '<h3 style="color:' + e(accent) + ';margin-bottom:6px;font-size:1.05rem;">What is being measured: the ABCD framework</h3>' +
        '<p style="color:#9aa6b2;font-size:.88rem;line-height:1.6;margin-bottom:16px;">' +
          'Every priming experiment on this platform is described the same way, so designs from different ' +
          'fields can be compared. <a href="' + e(base) + e(spec.articleAnchor || '') +
          '" style="color:' + e(accent) + ';font-weight:600;">' +
          (spec.articleAnchor && spec.articleAnchor !== '#s2'
            ? 'Read this experiment&rsquo;s case in the framework &rarr;'
            : 'Read the framework &rarr;') +
          '</a></p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;">' + abcd + '</div>' +
        '<div style="margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.09);">' +
          '<div style="color:#e5e7eb;font-size:.92rem;margin-bottom:10px;font-weight:600;">' +
            'The three characteristics that make this priming</div>' + chars +
          (spec.boundaryNote
            ? '<div style="margin-top:12px;border-left:3px solid #e38b82;background:rgba(153,15,35,.14);' +
                     'border-radius:0 10px 10px 0;padding:12px 14px;color:#d6c2c6;font-size:.9rem;line-height:1.65;">' +
                e(spec.boundaryNote) + '</div>'
            : '') +
          PTK.footnotesHtml(spec.footnotes) +
        '</div>' +
      '</div>';
  };

  /**
   * Numbered footnotes under the ABCD panel.
   *
   * Added 2026-08-12 at Shir's request. The boundary notes were arguments about
   * whether a paradigm fits the definition, sitting in the middle of a panel a
   * participant reads before starting - too heavy for that position, and the
   * ones that carry a concrete "here is how to do it properly" were being lost
   * inside them. Footnotes keep the panel short and put the caveat, the history
   * and the implementation advice where a reader can take them or leave them.
   *
   * Each entry is {title, text}. Kept deliberately plain: no markup, escaped,
   * because several of them quote stimulus names.
   *
   * @param {Array} notes
   * @returns {string} HTML, or '' when there are none
   */
  PTK.footnotesHtml = function (notes) {
    if (!notes || !notes.length) return '';
    var e = PTK.esc;
    var items = notes.map(function (n, i) {
      var title = typeof n === 'string' ? '' : (n.title || '');
      var text = typeof n === 'string' ? n : (n.text || '');
      return '<li style="margin-bottom:8px;">' +
        (title ? '<b style="color:#c4ccd6;">' + e(title) + '</b> ' : '') +
        e(text) + '</li>';
    }).join('');
    return '<div style="margin-top:14px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.12);">' +
      '<div style="color:#64748b;font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Notes</div>' +
      '<ol style="margin:0;padding-left:20px;color:#9aa6b2;font-size:.84rem;line-height:1.6;">' +
      items + '</ol></div>';
  };

  /**
   * Put the ABCD panel into a setup screen this kit did not build.
   *
   * Inserted before the first top-level <button> in the container, so the
   * screen reads instructions -> what is being measured -> Start, rather than
   * putting the explanation below the button nobody scrolls past. Idempotent:
   * these modules call open() every time the experiment is launched.
   *
   * @param {string} containerId  the module's own setup div
   * @param {Object} spec         as for PTK.abcdPanel
   */
  PTK.injectAbcd = function (containerId, spec) {
    var box = document.getElementById(containerId);
    if (!box) return;
    var id = containerId + '-abcd-fab';
    if (document.getElementById(id)) return;

    var wrap = document.createElement('div');
    wrap.id = id;
    wrap.innerHTML = PTK.abcdPanel(spec);

    var anchor = null;
    for (var i = 0; i < box.children.length; i++) {
      if (box.children[i].tagName === 'BUTTON') { anchor = box.children[i]; break; }
    }
    if (anchor) box.insertBefore(wrap, anchor);
    else box.appendChild(wrap);
  };

  PTK.paintSetup = function (containerId, mod, spec) {
    var box = document.getElementById(containerId);
    if (!box) return;
    var accent = spec.accent || '#ff4db8';
    var e = PTK.esc;

    var steps = (spec.howToPlay || []).map(function (s, i) {
      return '<li style="margin-bottom:10px;line-height:1.65;">' +
        '<span style="color:' + e(accent) + ';font-weight:700;">' + (i + 1) + '.</span> ' + s + '</li>';
    }).join('');

    box.innerHTML =
      '<h2 style="color:' + e(accent) + ';margin-bottom:4px;">' + e(spec.name) + '</h2>' +
      '<p class="subtitle" style="color:#64748b;margin-bottom:22px;">' + e(spec.source || '') + '</p>' +

      // ---- the box that makes the task obvious ----
      '<div style="background:rgba(102,126,234,.15);border:2px solid rgba(102,126,234,.4);' +
             'border-radius:15px;padding:24px;margin-bottom:22px;text-align:left;">' +
        '<h3 style="color:' + e(accent) + ';margin-bottom:14px;font-size:1.1rem;">Instructions / How to Play:</h3>' +
        '<ol style="color:#e5e7eb;font-size:1rem;margin:0 0 4px;padding-left:18px;list-style:none;">' + steps + '</ol>' +
        (spec.example
          ? '<div style="background:rgba(0,0,0,.3);border-radius:10px;padding:18px;margin-top:16px;">' +
              '<p style="color:#9aa6b2;margin-bottom:12px;font-size:.9rem;">Example:</p>' +
              spec.example +
            '</div>'
          : '') +
        (spec.keyLegend
          ? '<p style="color:#4ade80;margin-top:16px;font-size:.95rem;">' + spec.keyLegend + '</p>'
          : '') +
      '</div>' +

      // ---- what is being measured ----
      PTK.abcdPanel(spec) +

      '<div id="' + e(spec.key) + '-params" style="color:#64748b;font-size:.85rem;margin:0 auto 18px;' +
             'max-width:560px;line-height:1.7;"></div>' +

      '<button class="btn" onclick="' + e(spec.startFn) + '" style="margin-top:4px;">Start</button> ' +
      '<button class="btn btn-secondary" onclick="' + e(spec.closeFn) + '">Cancel</button>';
  };

  /* ===================================================================
     Scrambled-sentence prime phase
     =================================================================== */

  /**
   * The prime phase Bargh et al. (1996), Bargh & Gollwitzer (1994) and
   * Vohs et al. (2006) all share: sets of five words from which the
   * participant builds a grammatical four-word sentence. One word of a
   * "prime" set carries the construct being activated; "neutral" sets carry
   * none. The participant is never told the words matter, which is what makes
   * the manipulation secondary to the task they think they are doing.
   *
   * Shared here because three separate paradigms in this toolbox need exactly
   * this screen, and social_fab.js already had a fourth copy of it.
   *
   * @param {Object} o
   * @param {Object}   o.mod        the calling module (for tracked timers)
   * @param {string}   o.rootId     id of an empty container to render into
   * @param {Array}    o.items      [{words:[5], embedded:'win'|null, condition:'prime'|'neutral'}]
   * @param {number}   [o.pick=4]   how many words form the sentence
   * @param {number}   [o.iti=350]
   * @param {Function} o.onItem     (item, selectionArray, rtMs) => void
   * @param {Function} o.onDone     () => void
   */
  PTK.scrambledPhase = function (o) {
    var mod = o.mod;
    var root = document.getElementById(o.rootId);
    if (!root) return;
    var pick = o.pick || 4;
    var iti = o.iti === undefined ? 350 : o.iti;
    var index = 0;
    var selection = [];
    var onset = 0;

    root.innerHTML =
      '<div style="color:#9aa6b2;font-size:.85rem;" id="' + o.rootId + '-progress"></div>' +
      PTK.progressHtml(o.rootId + '-fill') +
      '<div style="color:#64748b;font-size:.8rem;letter-spacing:2px;margin-top:16px;">' +
        'MAKE A SENTENCE FROM FOUR OF THESE WORDS</div>' +
      '<div id="' + o.rootId + '-built" style="min-height:44px;font-size:1.4rem;margin:22px 0;color:#4ade80;letter-spacing:1px;"></div>' +
      '<div id="' + o.rootId + '-chips" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:18px 0;"></div>' +
      '<button class="btn btn-secondary" id="' + o.rootId + '-reset">Start this one again</button>';

    function render() {
      var item = o.items[index];
      if (!item) { o.onDone(); return; }
      selection = [];
      onset = performance.now();
      document.getElementById(o.rootId + '-progress').textContent =
        'Sentence ' + (index + 1) + ' of ' + o.items.length;
      PTK.setProgress(o.rootId + '-fill', index, o.items.length);
      document.getElementById(o.rootId + '-built').textContent = '';

      var chips = document.getElementById(o.rootId + '-chips');
      chips.innerHTML = '';
      PTA.shuffleArray(item.words).forEach(function (word) {
        var b = document.createElement('button');
        b.className = 'btn';
        b.textContent = word;
        b.style.cssText = 'background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);' +
                          'color:#fff;padding:10px 18px;border-radius:10px;font-size:1.1rem;cursor:pointer;';
        b.onclick = function () {
          if (b.disabled) return;
          b.disabled = true;
          b.style.opacity = '0.35';
          selection.push(word);
          document.getElementById(o.rootId + '-built').textContent = selection.join(' ');
          if (selection.length >= pick) {
            var rt = performance.now() - onset;
            o.onItem(item, selection.slice(), rt);
            index++;
            mod._after(render, iti);
          }
        };
        chips.appendChild(b);
      });
    }

    // Restarting an item resets its clock, so latency is not the dependent
    // measure for any paradigm that offers this button.
    document.getElementById(o.rootId + '-reset').onclick = render;
    render();
  };

  /* ===================================================================
     Persistence helper (requirements 15, 16)
     =================================================================== */

  /**
   * Build the row every paradigm must write, with the experimenter's own id
   * used as experiment_id when they supplied one.
   */
  PTK.row = function (mod, spec, extra) {
    if (!mod._participantId) {
      mod._participantId = (window.PTA && PTA.generateParticipantId)
        ? PTA.generateParticipantId()
        : 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
    }
    var row = {
      experiment_id: (mod.userExperimentId && mod.userExperimentId.trim()) || spec.defaultExperimentId || spec.key,
      participant_id: mod._participantId,
      language: 'en',
      experimenter_email: mod.experimenterEmail || null,
      user_experiment_id: mod.userExperimentId || null
    };
    Object.keys(extra || {}).forEach(function (k) { row[k] = extra[k]; });
    return row;
  };

  // Every trial from the ten kit paradigms goes through here. PTA.saveToSupabase
  // buffers its own failures and hands them to PTA.rescueUnsavedResults, so the
  // normal path needs nothing extra. The else branch is the one that used to end
  // in a console line: if core_fab.js never loaded there is no rescue path
  // either, so the loss has to be reported here or not at all.
  PTK._unsaved = [];

  /* ===================================================================
     Event logging for the six paradigms that predate this kit
     =================================================================== */

  /**
   * Wrap the older modules' own openBuilder / generateLink so they log the
   * same events the kit paradigms do.
   *
   * Found 2026-08-12, hours after the event logging went in. Ten paradigms go
   * through PTK.openBuilder and PTK.buildLink and were covered. The other six -
   * stroop, semantic, amp, number-priming, subliminal, evaluative - carry their
   * own versions of both and were logging nothing at all.
   *
   * That is not a small gap. P in the DHSS proposal is "experiments published",
   * and six of sixteen would never have counted - including Stroop and Semantic,
   * the two most used. Every model in the proposal takes P as an input, so the
   * result would not merely have been thin, it would have been BIASED, and
   * biased in a direction that flatters the newer paradigms.
   *
   * Wrapping rather than editing six files: one place to read, one place to fix,
   * and adding a seventh module means adding a name to the list below.
   */
  PTK.LEGACY_MODULES = [
    { global: 'Stroop',                  key: 'stroop' },
    { global: 'Semantic',                key: 'semantic' },
    { global: 'AMP',                     key: 'amp' },
    { global: 'NumberPriming',           key: 'number-priming' },
    { global: 'Subliminal',              key: 'subliminal' },
    { global: 'EvaluativeConditioning',  key: 'evaluative' }
  ];

  PTK.instrumentLegacy = function () {
    if (!window.PTA || !PTA.logEvent) return 0;
    var wrapped = 0;

    PTK.LEGACY_MODULES.forEach(function (m) {
      var mod = window[m.global];
      if (!mod || mod._ptkInstrumented) return;
      mod._ptkInstrumented = true;

      if (typeof mod.openBuilder === 'function') {
        var openOrig = mod.openBuilder;
        mod.openBuilder = function () {
          try {
            PTA.logEvent('builder_opened', {
              experimentType: m.key,
              email: mod.experimenterEmail || null,
              userExperimentId: mod.userExperimentId || null
            });
            PTA.startEditorHeartbeat('builder', { experimentType: m.key });
          } catch (e) { /* telemetry never blocks the builder */ }
          return openOrig.apply(this, arguments);
        };
        wrapped++;
      }

      if (typeof mod.closeBuilder === 'function') {
        var closeOrig = mod.closeBuilder;
        mod.closeBuilder = function () {
          try { PTA.stopEditorHeartbeat(); } catch (e) { /* same */ }
          return closeOrig.apply(this, arguments);
        };
      }

      if (typeof mod.generateLink === 'function') {
        var linkOrig = mod.generateLink;
        mod.generateLink = function () {
          var out = linkOrig.apply(this, arguments);
          // AFTER the original: these all validate the identity first and bail
          // if it is missing, and a refused link is not a publication.
          try {
            PTA.logEvent('link_generated', {
              experimentType: m.key,
              email: mod.experimenterEmail || null,
              userExperimentId: mod.userExperimentId || null
            });
          } catch (e) { /* same */ }
          return out;
        };
        wrapped++;
      }

      if (typeof mod.previewFromBuilder === 'function') {
        var prevOrig = mod.previewFromBuilder;
        mod.previewFromBuilder = function () {
          try { PTA.logEvent('preview_run', { experimentType: m.key }); } catch (e) { /* same */ }
          return prevOrig.apply(this, arguments);
        };
      }
    });

    return wrapped;
  };

  // These modules load AFTER this file, so wrapping has to wait for the page.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { PTK.instrumentLegacy(); });
    } else {
      PTK.instrumentLegacy();
    }
  }

  PTK.save = function (row) {
    if (window.PTA && typeof PTA.saveToSupabase === 'function') {
      PTA.saveToSupabase(row);
      return;
    }
    console.error('PTK: PTA.saveToSupabase missing - trial NOT saved', row);
    PTK._unsaved.push(row);
    if (PTK._unsavedTimer) clearTimeout(PTK._unsavedTimer);
    PTK._unsavedTimer = setTimeout(PTK.warnUnsaved, 1800);
  };

  /**
   * Say on screen that trials were lost, and offer them as a file.
   * Only reachable when core_fab.js failed to load.
   */
  PTK.warnUnsaved = function () {
    var rows = PTK._unsaved;
    if (!rows.length || document.getElementById('ptk-unsaved-panel')) return;

    var keys = [];
    rows.forEach(function (r) {
      Object.keys(r).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); });
    });

    var box = document.createElement('div');
    box.id = 'ptk-unsaved-panel';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99999;' +
      'max-width:620px;width:calc(100% - 28px);background:#2a0d10;border:1px solid #e38b82;' +
      'border-radius:12px;padding:16px 18px;color:#ffd9d4;font-family:"Segoe UI",Arial,sans-serif;' +
      'line-height:1.55;box-shadow:0 12px 40px rgba(0,0,0,.6);';

    var h = document.createElement('div');
    h.style.cssText = 'font-weight:700;color:#ff8fa3;margin-bottom:6px;';
    h.textContent = 'Your results were NOT saved.';
    box.appendChild(h);

    var p = document.createElement('div');
    p.style.cssText = 'font-size:.93rem;margin-bottom:10px;';
    p.textContent = 'The platform core script did not load, so these ' + rows.length +
      ' trials exist only in this window. Download them before closing the page.';
    box.appendChild(p);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Download my data (' + rows.length + ' trials)';
    btn.style.cssText = 'background:#e38b82;color:#2a0d10;border:none;border-radius:9px;' +
      'padding:11px 22px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.95rem;';
    btn.onclick = function () {
      PTK.exportCSV(keys, rows.map(function (r) {
        return keys.map(function (k) { return r[k] == null ? '' : r[k]; });
      }), 'PrimingToolbox_UNSAVED');
      btn.textContent = 'Downloaded - check your Downloads folder';
      btn.disabled = true;
      btn.style.opacity = '.7';
    };
    box.appendChild(btn);
    document.body.appendChild(box);
  };

  return PTK;
})();

console.log('PTK Paradigm Kit v' + window.PTK.version + ' loaded');
