/**
 * =====================================================
 * PrimingToolbox - Interactive Trial Timeline (V2 _fab)
 * =====================================================
 *
 * A live trial planner students can read at a glance:
 *   - every phase has its own color (palette: report40 discipline colors)
 *   - the track shows a colored block spanning exactly where each phase sits
 *     and how long it lasts; gaps (ISI/ITI) are dashed blocks
 *   - the numeric inputs are color-matched to their blocks
 *   - "Insert into experiment draft" writes the plan into the current
 *     experiment config (currentConfig.presentation) and localStorage, so the
 *     Template Builder and the generated participant link carry the timing.
 *
 * Loaded by index.html (V2 build). Does not modify any original file.
 *
 * @module TimelinePlanner
 */
const TimelinePlanner = (function () {
  'use strict';

  const STORE_KEY = 'ptbx_trial_plan_fab';

  // Ordered phases. `box` = a stimulus/response phase; gaps (ISI/ITI) are
  // blank intervals. `letter` mirrors the ABCD framework (A = prime,
  // B = target). Colors: report40 bright set (dark-background friendly).
  const DEFAULT = [
    { key: 'fixation_ms',        label: 'Fixation', letter: '+', box: true,  value: 500,  color: '#61a3ed',
      tip: 'Fixation cross: the participant fixates the screen centre before anything appears.' },
    { key: 'prime_duration_ms',  label: 'Prime',    letter: 'A', box: true,  value: 200,  color: '#ea5cd5',
      tip: 'Prime (A): the influencing stimulus, shown briefly.' },
    { key: 'ISI_ms',             label: 'ISI',      letter: '',  box: false, value: 50,   color: '#fafafa',
      tip: 'Inter-Stimulus Interval: blank gap between prime and target.' },
    { key: 'target_duration_ms', label: 'Target',   letter: 'B', box: true,  value: 250,  color: '#ff9b1e',
      tip: 'Target (B): the stimulus the participant must process.' },
    { key: 'response_window_ms', label: 'Response', letter: '?', box: true,  value: 1500, color: '#39d461',
      tip: 'Response window: time allowed for the key press.' },
    { key: 'ITI_ms',             label: 'ITI',      letter: '',  box: false, value: 500,  color: '#e38b82',
      tip: 'Inter-Trial Interval: blank gap before the next trial starts.' }
  ];

  let plan = DEFAULT.map(p => ({ ...p }));

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved) plan.forEach(p => {
        if (typeof saved[p.key] === 'number' && Number.isFinite(saved[p.key])) {
          p.value = Math.max(0, saved[p.key]);
        }
      });
    } catch (e) { /* ignore */ }
  }

  function asObject() {
    const o = {};
    plan.forEach(p => o[p.key] = p.value);
    return o;
  }

  function total() {
    return plan.reduce((s, p) => s + (Number(p.value) || 0), 0);
  }

  /* ---------- rendering: colored phase blocks on the track ---------- */

  function renderTrack() {
    const track = document.getElementById('timeline-track');
    if (!track) return;

    // Remove the old static event boxes and any previously rendered blocks.
    track.querySelectorAll('.timeline-event, .timeline-seg, .timeline-onset').forEach(el => el.remove());

    const totalMs = total();
    const denom = totalMs || 1;   // avoid division by zero; display keeps the true total
    // Usable band 3%..97% so edge labels are not clipped.
    const left = ms => 3 + (ms / denom) * 94;
    const width = ms => (ms / denom) * 94;

    let onset = 0;
    plan.forEach(p => {
      const durMs = Number(p.value) || 0;
      const seg = document.createElement('div');
      seg.className = 'timeline-seg';
      seg.title = p.tip + ' (' + durMs + ' ms, starts at ' + onset + ' ms)';
      const wPct = width(durMs);
      seg.style.cssText =
        'position:absolute;top:8px;height:46px;box-sizing:border-box;' +
        'left:' + left(onset) + '%;width:' + Math.max(wPct, 0.4) + '%;' +
        'background:' + p.color + (p.box ? '38' : '20') + ';' +
        'border:2px ' + (p.box ? 'solid' : 'dashed') + ' ' + p.color + ';' +
        'border-radius:7px;overflow:hidden;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;line-height:1.15;';
      const showText = wPct > 5.5;
      seg.innerHTML =
        (showText
          ? '<div style="font-size:.62rem;font-weight:700;letter-spacing:.4px;color:' + p.color + ';text-transform:uppercase;white-space:nowrap;">' +
              p.label + (p.letter ? ' <span style="opacity:.85">(' + p.letter + ')</span>' : '') + '</div>' +
            '<div style="font-size:.66rem;color:#ffffff;white-space:nowrap;">' + durMs + ' ms</div>'
          : '<div style="font-size:.6rem;color:' + p.color + ';font-weight:700;">' + (p.letter || '') + '</div>');
      track.appendChild(seg);

      // onset tick under the axis at each phase start
      const tick = document.createElement('div');
      tick.className = 'timeline-onset';
      tick.style.cssText =
        'position:absolute;bottom:2px;transform:translateX(-50%);left:' + left(onset) + '%;' +
        'font-size:.6rem;color:rgba(255,255,255,.55);white-space:nowrap;';
      tick.textContent = onset;
      track.appendChild(tick);

      onset += durMs;
    });

    // end-of-trial tick
    const end = document.createElement('div');
    end.className = 'timeline-onset';
    end.style.cssText =
      'position:absolute;bottom:2px;transform:translateX(-50%);left:' + left(totalMs) + '%;' +
      'font-size:.6rem;color:rgba(255,255,255,.85);font-weight:700;white-space:nowrap;';
    end.textContent = totalMs + ' ms';
    track.appendChild(end);

    const totalEl = document.getElementById('total-duration');
    if (totalEl) totalEl.textContent = totalMs;
  }

  /* ---------- the editor panel (inputs color-matched to blocks) ---------- */

  function buildEditor() {
    const container = document.querySelector('.timeline-container');
    if (!container || document.getElementById('tl-editor-fab')) return;

    const bar = document.createElement('div');
    bar.id = 'tl-editor-fab';
    bar.style.cssText =
      'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;' +
      'margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.2);';

    plan.forEach(p => {
      const wrap = document.createElement('label');
      wrap.title = p.tip;
      wrap.style.cssText = 'display:flex;flex-direction:column;font-size:.65rem;gap:2px;font-weight:700;color:' + p.color + ';';
      wrap.innerHTML =
        '<span style="display:flex;align-items:center;gap:4px;">' +
        '<span style="width:10px;height:10px;border-radius:2px;background:' + p.color + ';display:inline-block;"></span>' +
        p.label + (p.box ? '' : ' (gap)') + '</span>';
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = '10'; inp.value = p.value;
      inp.dataset.key = p.key;
      inp.style.cssText =
        'width:70px;padding:3px 5px;border-radius:5px;border:2px solid ' + p.color + ';' +
        'background:rgba(255,255,255,.10);color:#fff;font-size:.8rem;font-weight:400;';
      inp.addEventListener('input', function () {
        const ph = plan.find(x => x.key === this.dataset.key);
        if (ph) ph.value = Math.max(0, Number(this.value) || 0);
        renderTrack();
        persist();
      });
      wrap.appendChild(inp);
      bar.appendChild(wrap);
    });

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:8px;margin-inline-start:auto;';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Insert into experiment draft';
    applyBtn.style.cssText =
      'background:#ff4db8;color:#fff;border:none;border-radius:6px;padding:6px 14px;' +
      'font-weight:700;font-size:.78rem;cursor:pointer;';
    applyBtn.onclick = applyToDraft;

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load from selected';
    loadBtn.title = 'Copy timing from the experiment chosen in Quick Settings';
    loadBtn.style.cssText =
      'background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);' +
      'border-radius:6px;padding:6px 14px;font-size:.78rem;cursor:pointer;';
    loadBtn.onclick = loadFromSelected;

    btnWrap.appendChild(loadBtn);
    btnWrap.appendChild(applyBtn);
    bar.appendChild(btnWrap);

    const status = document.createElement('div');
    status.id = 'tl-status-fab';
    status.style.cssText = 'flex-basis:100%;font-size:.72rem;color:#c6ffd8;min-height:1em;';
    bar.appendChild(status);

    container.appendChild(bar);
  }

  function persist() {
    localStorage.setItem(STORE_KEY, JSON.stringify(asObject()));
  }

  function flash(msg) {
    const s = document.getElementById('tl-status-fab');
    if (!s) return;
    s.textContent = msg;
    clearTimeout(window._tlFabT);
    window._tlFabT = setTimeout(() => { s.textContent = ''; }, 2600);
  }

  /* ---------- integration with the experiment draft ---------- */

  function loadFromSelected() {
    const cfg = (typeof window.currentConfig !== 'undefined' && window.currentConfig) ? window.currentConfig : null;
    let src = cfg && cfg.presentation ? cfg.presentation : null;
    if (!src) {
      const sel = document.getElementById('experimentSelect');
      flash(sel && sel.value
        ? 'That experiment exposes no editable timing yet — using current values.'
        : 'Select an experiment in Quick Settings first.');
      return;
    }
    let matched = 0;
    plan.forEach(p => { if (typeof src[p.key] === 'number') { p.value = src[p.key]; matched++; } });
    syncInputs();
    renderTrack();
    flash(matched === plan.length
      ? 'Loaded timing from the selected experiment.'
      : 'Loaded ' + matched + ' of ' + plan.length + ' fields from the selected experiment; the rest kept their current values.');
  }

  function syncInputs() {
    plan.forEach(p => {
      const inp = document.querySelector('#tl-editor-fab input[data-key="' + p.key + '"]');
      if (inp) inp.value = p.value;
    });
  }

  // Write the plan where the builder and the shareable link will read it.
  // index.html merges window.PTA_trialPlan into the config AFTER
  // loadExperimentConfig() runs, so the plan survives config rebuilding.
  function applyToDraft() {
    const timing = asObject();
    persist();
    window.PTA_trialPlan = timing;

    if (window.currentConfig) {
      if (!window.currentConfig.presentation) window.currentConfig.presentation = {};
      Object.assign(window.currentConfig.presentation, timing);
      window.currentConfig.trial_plan = timing;
    }

    flash('Inserted into draft — total ' + total() + ' ms. It will travel with the generated link.');
  }

  function init() {
    load();
    buildEditor();
    renderTrack();
  }

  return {
    init: init,
    render: renderTrack,
    applyToDraft: applyToDraft,
    loadFromSelected: loadFromSelected,
    getPlan: asObject,
    total: total,
    _plan: plan
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  TimelinePlanner.init();
});
