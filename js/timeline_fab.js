/**
 * =====================================================
 * PrimingToolbox - Interactive Trial Timeline (V2 _fab)
 * =====================================================
 *
 * Turns the previously-static "Trial Timeline" bar into a live planner:
 *   - each phase duration is editable (numeric inputs)
 *   - the visual track + total duration re-render live
 *   - "Insert into experiment draft" writes the plan into the current
 *     experiment config (currentConfig.presentation) and localStorage, so the
 *     Template Builder and the generated participant link carry the timing.
 *
 * Loaded only by index_fab.html. Does not modify any original file.
 *
 * @module TimelinePlanner
 */
const TimelinePlanner = (function () {
  'use strict';

  const STORE_KEY = 'ptbx_trial_plan_fab';

  // Ordered phases. `box` = drawn as a labelled marker; gaps (ISI/ITI) are
  // durations only. `letter` mirrors the ABCD framework (A = prime, B = target).
  const DEFAULT = [
    { key: 'fixation_ms',        label: 'Fixation', letter: '+', box: true,  value: 500 },
    { key: 'prime_duration_ms',  label: 'Prime',    letter: 'A', box: true,  value: 200 },
    { key: 'ISI_ms',             label: 'ISI',      letter: '',  box: false, value: 50  },
    { key: 'target_duration_ms', label: 'Target',   letter: 'B', box: true,  value: 250 },
    { key: 'response_window_ms', label: 'Response', letter: '?', box: true,  value: 1500 },
    { key: 'ITI_ms',             label: 'ITI',      letter: '',  box: false, value: 500 }
  ];

  let plan = DEFAULT.map(p => ({ ...p }));

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved) plan.forEach(p => { if (typeof saved[p.key] === 'number') p.value = saved[p.key]; });
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

  /* ---------- rendering the visual track ---------- */

  function renderTrack() {
    const track = document.getElementById('timeline-track');
    if (!track) return;

    // Remove previously rendered event markers (keep axis + ticks).
    track.querySelectorAll('.timeline-event').forEach(el => el.remove());

    const totalMs = total() || 1;
    // Usable band is 5%..95% so edge boxes are not clipped.
    const toPct = ms => 5 + (ms / totalMs) * 90;

    let onset = 0;
    plan.forEach(p => {
      const at = onset;
      onset += Number(p.value) || 0;
      if (!p.box) return;
      const ev = document.createElement('div');
      ev.className = 'timeline-event';
      ev.style.left = toPct(at) + '%';
      ev.innerHTML =
        '<div class="event-box"><div class="event-label">' + p.label + '</div>' +
        '<div class="event-content">' + (p.letter || '&nbsp;') + '</div></div>' +
        '<div class="event-connector"></div><div class="event-dot"></div>' +
        '<div class="event-time">' + at + ' ms</div>';
      track.appendChild(ev);
    });

    const totalEl = document.getElementById('total-duration');
    if (totalEl) totalEl.textContent = totalMs;
  }

  /* ---------- the editor panel ---------- */

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
      wrap.style.cssText = 'display:flex;flex-direction:column;font-size:.65rem;color:rgba(255,255,255,.85);gap:2px;';
      wrap.innerHTML = p.label + (p.box ? '' : ' (gap)');
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = '10'; inp.value = p.value;
      inp.dataset.key = p.key;
      inp.style.cssText =
        'width:70px;padding:3px 5px;border-radius:5px;border:1px solid rgba(255,255,255,.3);' +
        'background:rgba(255,255,255,.12);color:#fff;font-size:.8rem;';
      inp.addEventListener('input', function () {
        const ph = plan.find(x => x.key === this.dataset.key);
        if (ph) ph.value = Math.max(0, Number(this.value) || 0);
        renderTrack();
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

  function flash(msg) {
    const s = document.getElementById('tl-status-fab');
    if (!s) return;
    s.textContent = msg;
    clearTimeout(window._tlFabT);
    window._tlFabT = setTimeout(() => { s.textContent = ''; }, 2600);
  }

  /* ---------- integration with the experiment draft ---------- */

  // Pull timing out of an experiment config's presentation block, if present.
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
    plan.forEach(p => { if (typeof src[p.key] === 'number') p.value = src[p.key]; });
    syncInputs();
    renderTrack();
    flash('Loaded timing from the selected experiment.');
  }

  function syncInputs() {
    plan.forEach(p => {
      const inp = document.querySelector('#tl-editor-fab input[data-key="' + p.key + '"]');
      if (inp) inp.value = p.value;
    });
  }

  // Write the plan where the builder and the shareable link will read it.
  function applyToDraft() {
    const timing = asObject();
    localStorage.setItem(STORE_KEY, JSON.stringify(timing));
    window.PTA_trialPlan = timing;

    if (typeof window.currentConfig === 'undefined' || !window.currentConfig) {
      window.currentConfig = { presentation: {} };
    }
    if (!window.currentConfig.presentation) window.currentConfig.presentation = {};
    Object.assign(window.currentConfig.presentation, timing);
    window.currentConfig.trial_plan = timing;

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
    total: total
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  TimelinePlanner.init();
});
