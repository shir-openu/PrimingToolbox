/**
 * asm_validator.js -- design-time check of the three priming characteristics.
 *
 * The ABCD slots are already this engine's data model. This adds the missing step:
 * checking that a configured design actually satisfies the definition before it is run.
 *
 *   Association     A and B stand in a manipulable relation (congruent / incongruent / neutral)
 *   Secondariness   A is not required for the task and not needed to establish baseline C
 *   Modulation      the presence of A shifts the outcome from C to D, so C must be obtainable
 *
 * Secondariness is the only characteristic that can realistically fail in a built design, and it
 * fails when the prime stops being separable from the task. Two concrete routes are checked:
 *
 *   identity  -- the prime is also the target, so processing A *is* processing B
 *   direct    -- the subject is asked to respond to A itself (read it, learn it, answer it),
 *                which makes A part of the task rather than incidental to it
 *
 * Everything is a WARNING, never a block: an experimenter may knowingly build a repetition-priming
 * design, and the tool should say what that costs rather than refuse. Nothing here mutates config.
 *
 * Usage:  const report = PTA.validateASM(config);      // {ok, level, checks:[...]}
 *         PTA.renderASMReport(report, document.getElementById('asm-panel'));
 */
(function () {
  'use strict';
  const PTA = window.PTA || (window.PTA = {});

  /* ---------- helpers: the modules nest stimuli differently, so walk defensively ---------- */

  function collectStrings(node, depth) {
    // Gather comparable identifiers from any shape: array, {cat:[...]}, [{id,label,word,text}]
    if (node == null || depth > 4) return [];
    if (typeof node === 'string' || typeof node === 'number') return [String(node)];
    if (Array.isArray(node)) return node.flatMap(v => collectStrings(v, depth + 1));
    if (typeof node === 'object') {
      const keys = ['word', 'text', 'label', 'id', 'name', 'stimulus', 'value', 'emoji'];
      const direct = keys.filter(k => typeof node[k] === 'string').map(k => node[k]);
      if (direct.length) return direct;
      return Object.values(node).flatMap(v => collectStrings(v, depth + 1));
    }
    return [];
  }

  function norm(s) {
    return String(s).trim().toLowerCase();
  }

  function pick(config, names) {
    // find the first present key among names, at top level or under stimuli/design
    const scopes = [config, config.stimuli, config.design, config.defaults];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      for (const n of names) if (scope[n] != null) return scope[n];
    }
    return null;
  }

  function check(characteristic, status, message, detail) {
    return { characteristic, status, message, detail: detail || '' };
  }

  /* ------------------------------- the three checks ------------------------------- */

  function checkAssociation(config, primes, targets) {
    if (!primes.length || !targets.length) {
      return check('association', 'incomplete',
        'No prime set or no target set found, so the A–B relation cannot be evaluated.',
        'Association requires at least two experiences: a prime A and a target B.');
    }
    const conds = pick(config, ['conditions', 'primeTypes', 'primeConditions', 'relations']);
    const condCount = conds ? collectStrings(conds, 0).length : 0;
    const primeGroups = (() => {
      const p = pick(config, ['primes']);
      return p && !Array.isArray(p) && typeof p === 'object' ? Object.keys(p).length : 0;
    })();
    if (condCount >= 2 || primeGroups >= 2) {
      return check('association', 'ok',
        'Two or more prime conditions are defined, so the A–B relation can be manipulated.');
    }
    return check('association', 'warn',
      'Only one kind of prime was found. With no contrasting condition the A–B relation is held ' +
      'constant, so any effect cannot be attributed to association.',
      'Add a contrasting condition (for example incongruent, or unrelated) alongside the congruent one.');
  }

  function checkSecondariness(config, primes, targets) {
    const findings = [];

    // route 1: identity -- the prime is also the target
    const T = new Set(targets.map(norm));
    const overlap = [...new Set(primes.map(norm))].filter(p => p && T.has(p));
    if (overlap.length) {
      const share = overlap.length / Math.max(new Set(primes.map(norm)).size, 1);
      findings.push(check('secondariness', share > 0.5 ? 'fail' : 'warn',
        'The prime is also the target in ' + overlap.length + ' case(s), so processing A is ' +
        'partly processing B.',
        'This is the identity route: repetition designs of this kind measure a real effect, but ' +
        'the prime is no longer incidental to the task, so the result is repetition priming ' +
        'rather than priming in the strict sense. Examples: ' + overlap.slice(0, 4).join(', ') + '.'));
    }

    // route 2: direct -- the subject responds to A itself
    const resp = pick(config, ['response', 'responses', 'responseKeys']) || {};
    const respLabels = collectStrings(resp, 0).map(norm);
    const primeSet = new Set(primes.map(norm));
    const respondsToPrime =
      respLabels.some(l => primeSet.has(l)) ||
      Boolean(pick(config, ['respondToPrime', 'judgePrime', 'ratePrime', 'primeIsTask']));
    const instr = norm(collectStrings(pick(config, ['instructions', 'task', 'prompt']) || '', 0).join(' '));
    const instrTargetsPrime = /\b(the (first|prime)|prime)\b[^.]{0,40}\b(judge|rate|report|remember|learn|read aloud|respond)/.test(instr);
    if (respondsToPrime || instrTargetsPrime) {
      findings.push(check('secondariness', 'fail',
        'The task appears to require a response to the prime itself.',
        'This is the direct route: once the subject must read, learn, judge or answer A, the prime ' +
        'is on the task pathway and is no longer secondary. Designs of this kind are teaching or ' +
        'framing rather than priming.'));
    }

    if (!findings.length) {
      findings.push(check('secondariness', 'ok',
        'The prime is distinct from the target and the response is collected to the target, so the ' +
        'prime is incidental to the task.'));
    }
    return findings;
  }

  function checkModulation(config, primes) {
    const baseline = pick(config, ['baseline', 'control', 'neutral', 'noPrime', 'controlCondition']);
    const p = pick(config, ['primes']);
    const hasNeutralGroup = p && !Array.isArray(p) && typeof p === 'object' &&
      Object.keys(p).some(k => /neutral|control|baseline|none/i.test(k));
    if (baseline || hasNeutralGroup) {
      return check('modulation', 'ok',
        'A baseline condition is defined, so the C→D shift can be measured.');
    }
    return check('modulation', 'warn',
      'No neutral, control or no-prime condition was found. Without a baseline C there is nothing ' +
      'for D to be compared against.',
      'A contrast between two primed conditions still yields a difference, but the definition asks ' +
      'for the shift from the outcome expected without A.');
  }

  /* --------------------------------- public API --------------------------------- */

  PTA.validateASM = function validateASM(config) {
    config = config || {};
    const primes = collectStrings(pick(config, ['primes', 'primeStimuli']), 0);
    const targets = collectStrings(pick(config, ['targets', 'targetStimuli']), 0);

    const checks = [checkAssociation(config, primes, targets)]
      .concat(checkSecondariness(config, primes, targets))
      .concat([checkModulation(config, primes)]);

    const level = checks.some(c => c.status === 'fail') ? 'fail'
      : checks.some(c => c.status === 'warn' || c.status === 'incomplete') ? 'warn' : 'ok';

    return {
      ok: level === 'ok',
      level: level,
      checks: checks,
      summary: level === 'ok'
        ? 'The design satisfies association, secondariness and modulation.'
        : level === 'warn'
          ? 'The design is runnable, but at least one characteristic is weakly supported.'
          : 'At least one defining characteristic is not satisfied; this design would not count as ' +
            'priming under the definition, though it may still be a valid experiment.',
      counts: {
        primes: new Set(primes.map(norm)).size,
        targets: new Set(targets.map(norm)).size
      }
    };
  };

  // Report text embeds stimulus strings taken from the config (see the
  // "Examples: ..." detail in checkSecondariness), and a config can arrive from
  // a participant URL. Everything interpolated below is therefore escaped; the
  // colours are looked up in a fixed map and never come from the config.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  PTA.escapeHtml = esc;

  PTA.renderASMReport = function renderASMReport(report, el) {
    if (!el) return;
    const colour = { ok: '#1a7a33', warn: '#b45309', fail: '#c0392b', incomplete: '#b45309' };
    const label = { association: 'Association', secondariness: 'Secondariness', modulation: 'Modulation' };
    const rows = report.checks.map(c =>
      '<div style="border-inline-start:4px solid ' + (colour[c.status] || '#999') +
      ';background:#fafafa;border-radius:6px;padding:.5rem .8rem;margin:.4rem 0">' +
      '<b style="color:' + (colour[c.status] || '#999') + '">' +
      esc(label[c.characteristic] || c.characteristic) +
      ' — ' + esc(c.status) + '</b><div style="font-size:.9em;margin-top:.2rem">' + esc(c.message) + '</div>' +
      (c.detail ? '<div style="font-size:.82em;color:#666;margin-top:.2rem">' + esc(c.detail) + '</div>' : '') +
      '</div>').join('');
    el.innerHTML =
      '<div style="font-family:\'Segoe UI\',Arial,sans-serif">' +
      '<h3 style="margin:.2rem 0;font-size:1rem">Definition check (A·S·M)</h3>' +
      '<p style="font-size:.88em;color:#555;margin:.2rem 0 .5rem">' + esc(report.summary) + '</p>' +
      rows +
      '<p style="font-size:.78em;color:#888;margin-top:.5rem">Advisory only — nothing is blocked. ' +
      'A design flagged here may still be a sound experiment; the check reports whether it meets the ' +
      'three characteristics of priming.</p></div>';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PTA;   // for node self-test
})();
