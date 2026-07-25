/**
 * =====================================================
 * PrimingToolbox - Interactive Trial Timeline (V2 _fab)
 * =====================================================
 *
 * A live trial planner students can read AND reshape with the mouse:
 *   - every phase has its own color (palette: report40 discipline colors)
 *   - the track shows a colored block spanning exactly where each phase sits
 *     and how long it lasts; gaps (ISI/ITI) are dashed blocks
 *   - DRAG the right edge of any block to make that phase longer or shorter;
 *     the numbers, the total and the following blocks follow the cursor live
 *   - keyboard alternative: focus a block (Tab) and use the arrow keys
 *   - the numeric inputs stay in sync and are color-matched to their blocks
 *   - "Insert into experiment draft" writes the plan into the current
 *     experiment config (currentConfig.presentation) and localStorage, so the
 *     Template Builder and the generated participant link carry the timing.
 *
 * Drag geometry note
 * ------------------
 * The track normally scales so the whole trial fills it (94% band). If it kept
 * rescaling *while* you drag, the block would not follow the cursor - growing a
 * phase shrinks the pixels-per-ms, so the edge would lag behind the mouse. So
 * the scale is LOCKED for the duration of a drag (`dragSpan`), which gives exact
 * 1:1 tracking like a video editor, and is released on pointerup, when a short
 * CSS transition settles the view back to "whole trial fits the track".
 *
 * Rendering is split into buildTrack() (creates the nodes once) and
 * layoutTrack() (repositions them). That split matters: rebuilding the DOM on
 * every pointermove would destroy the very handle node being dragged.
 *
 * Loaded by index.html (V2 build). Does not modify any original file.
 *
 * @module TimelinePlanner
 */
const TimelinePlanner = (function () {
  'use strict';

  const STORE_KEY  = 'ptbx_trial_plan_fab';
  const SNAP_MS    = 10;      // default drag granularity (Shift = 1 ms)
  const MAX_MS     = 20000;   // sanity cap for a single phase
  const BAND_LEFT  = 3;       // usable band starts at 3% ...
  const BAND       = 94;      // ... and is 94% wide, so labels are not clipped
  const SEG_TOP    = 8;
  const SEG_HEIGHT = 46;
  const MIN_TICK_GAP = 4.2;   // % of track width; closer onset labels collide

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

  let plan     = DEFAULT.map(p => ({ ...p }));
  let els      = [];      // per-phase DOM refs, parallel to `plan`
  let endTick  = null;
  let dragSpan = null;    // locked ms-span while dragging (null = fit to total)
  let dragging = false;

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

  // ms-span the track currently represents: the locked one while dragging,
  // otherwise the whole trial. Never 0, so the % maths cannot divide by zero.
  function span() {
    return dragSpan || total() || 1;
  }

  function leftPct(ms)  { return BAND_LEFT + (ms / span()) * BAND; }
  function widthPct(ms) { return (ms / span()) * BAND; }

  /* ---------- rendering: build once, then only re-layout ---------- */

  function buildTrack() {
    const track = document.getElementById('timeline-track');
    if (!track) return null;
    if (els.length === plan.length && track.querySelector('.timeline-seg')) return track;

    // Remove the old static event boxes and anything previously rendered.
    track.querySelectorAll('.timeline-event, .timeline-seg, .timeline-onset, .timeline-handle')
         .forEach(el => el.remove());
    els = [];

    // Blocks are absolutely positioned inside the track; while a drag pushes
    // the trial past the visible span the overflow is clipped rather than
    // spilling over the card.
    track.style.position = track.style.position || 'relative';
    track.style.overflow = 'hidden';

    plan.forEach((p, i) => {
      const seg = document.createElement('div');
      seg.className = 'timeline-seg';
      seg.dataset.key = p.key;
      seg.tabIndex = 0;
      seg.setAttribute('role', 'slider');
      seg.setAttribute('aria-label', p.label + ' duration in milliseconds');
      seg.setAttribute('aria-valuemin', '0');
      seg.setAttribute('aria-valuemax', String(MAX_MS));
      seg.style.cssText =
        'position:absolute;top:' + SEG_TOP + 'px;height:' + SEG_HEIGHT + 'px;box-sizing:border-box;' +
        'background:' + p.color + (p.box ? '38' : '20') + ';' +
        'border:2px ' + (p.box ? 'solid' : 'dashed') + ' ' + p.color + ';' +
        'border-radius:7px;overflow:hidden;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;line-height:1.15;outline:none;';

      const name = document.createElement('div');
      name.className = 'timeline-seg-name';
      name.style.cssText =
        'font-size:.62rem;font-weight:700;letter-spacing:.4px;color:' + p.color +
        ';text-transform:uppercase;white-space:nowrap;pointer-events:none;';
      name.innerHTML = p.label + (p.letter ? ' <span style="opacity:.85">(' + p.letter + ')</span>' : '');

      const dur = document.createElement('div');
      dur.className = 'timeline-seg-dur';
      dur.style.cssText = 'font-size:.66rem;color:#ffffff;white-space:nowrap;pointer-events:none;';

      seg.appendChild(name);
      seg.appendChild(dur);
      seg.addEventListener('keydown', ev => onSegKey(i, ev));
      track.appendChild(seg);

      // Grab handle sitting ON the block's right edge. It is a sibling of the
      // block (not a child) so that even a 0 ms phase keeps a grabbable edge.
      const handle = document.createElement('div');
      handle.className = 'timeline-handle';
      handle.dataset.key = p.key;
      handle.title = 'Drag to change ' + p.label + ' (hold Shift for 1 ms steps)';
      handle.style.cssText =
        'position:absolute;top:' + (SEG_TOP - 2) + 'px;height:' + (SEG_HEIGHT + 4) + 'px;' +
        'width:14px;margin-left:-7px;cursor:col-resize;z-index:' + (10 + i) + ';' +
        'display:flex;align-items:center;justify-content:center;touch-action:none;';
      const grip = document.createElement('div');
      grip.style.cssText =
        'width:4px;height:60%;border-radius:2px;background:' + p.color + ';opacity:.75;' +
        'box-shadow:0 0 0 1px rgba(0,0,0,.35);pointer-events:none;';
      handle.appendChild(grip);
      handle.addEventListener('pointerdown', ev => startDrag(i, ev));
      handle.addEventListener('mouseenter', () => { grip.style.opacity = '1'; grip.style.width = '6px'; });
      handle.addEventListener('mouseleave', () => { if (!dragging) { grip.style.opacity = '.75'; grip.style.width = '4px'; } });
      track.appendChild(handle);

      // onset tick under the axis at each phase start
      const tick = document.createElement('div');
      tick.className = 'timeline-onset';
      tick.style.cssText =
        'position:absolute;bottom:2px;transform:translateX(-50%);' +
        'font-size:.6rem;color:rgba(255,255,255,.55);white-space:nowrap;pointer-events:none;';
      track.appendChild(tick);

      els.push({ seg: seg, name: name, dur: dur, handle: handle, grip: grip, tick: tick });
    });

    endTick = document.createElement('div');
    endTick.className = 'timeline-onset';
    endTick.style.cssText =
      'position:absolute;bottom:2px;transform:translateX(-50%);' +
      'font-size:.6rem;color:rgba(255,255,255,.85);font-weight:700;white-space:nowrap;pointer-events:none;';
    track.appendChild(endTick);

    setTransitions(true);
    return track;
  }

  // Transitions are on for ordinary edits (the view settles smoothly) and off
  // during a drag, where any easing would read as lag behind the cursor.
  function setTransitions(on) {
    const t = on ? 'left .18s ease, width .18s ease' : 'none';
    els.forEach(e => {
      e.seg.style.transition    = t;
      e.handle.style.transition = on ? 'left .18s ease' : 'none';
      e.tick.style.transition   = on ? 'left .18s ease' : 'none';
    });
    if (endTick) endTick.style.transition = on ? 'left .18s ease' : 'none';
  }

  function layoutTrack() {
    if (!els.length) return;
    const totalMs = total();
    const endPct = leftPct(totalMs);
    let onset = 0;
    let lastTickPct = -99;      // last onset label actually shown

    plan.forEach((p, i) => {
      const e = els[i];
      const durMs = Number(p.value) || 0;
      const wPct  = widthPct(durMs);

      e.seg.style.left  = leftPct(onset) + '%';
      e.seg.style.width = Math.max(wPct, 0.4) + '%';
      e.seg.title = p.tip + ' (' + durMs + ' ms, starts at ' + onset + ' ms) - drag its right edge to change it';
      e.seg.setAttribute('aria-valuenow', durMs);
      e.seg.setAttribute('aria-valuetext', durMs + ' ms');

      // Narrow blocks have no room for the name; they show the ABCD letter only.
      const wide = wPct > 5.5;
      e.name.style.display = wide ? '' : 'none';
      e.dur.textContent = wide ? durMs + ' ms' : (p.letter || '');
      e.dur.style.color = wide ? '#ffffff' : p.color;
      e.dur.style.fontWeight = wide ? '400' : '700';

      e.handle.style.left = leftPct(onset + durMs) + '%';

      // Onset labels are dropped when they would print on top of the previous
      // one (or on the bold end-of-trial label). The block itself still shows
      // its length, and the hover tooltip still gives the exact onset.
      const tickPct = leftPct(onset);
      const show = i === 0 ||
        ((tickPct - lastTickPct) >= MIN_TICK_GAP && (endPct - tickPct) >= MIN_TICK_GAP);
      e.tick.style.left = tickPct + '%';
      e.tick.textContent = onset;
      e.tick.style.display = show ? '' : 'none';
      if (show) lastTickPct = tickPct;

      onset += durMs;
    });

    if (endTick) {
      endTick.style.left = endPct + '%';
      endTick.textContent = totalMs + ' ms';
    }

    const totalEl = document.getElementById('total-duration');
    if (totalEl) totalEl.textContent = totalMs;
  }

  function renderTrack() {
    buildTrack();
    layoutTrack();
  }

  /* ---------- dragging a block edge ---------- */

  // Every write into plan[].value goes through here: non-finite input (NaN
  // from a typed letter, Infinity from "1e400") collapses to 0 rather than
  // poisoning total() and the layout maths.
  function clampMs(v, snap) {
    const step = snap || SNAP_MS;
    if (!Number.isFinite(v)) return 0;
    return Math.min(MAX_MS, Math.max(0, Math.round(v / step) * step));
  }

  // px per ms for the locked span. Returns 0 when the track cannot be measured
  // (hidden tab, or a DOM without layout) - the drag is then simply ignored
  // rather than jumping to a wrong value.
  function pxPerMs(track) {
    const rect = track.getBoundingClientRect ? track.getBoundingClientRect() : null;
    const w = ((rect && rect.width) || track.offsetWidth || 0) * (BAND / 100);
    return w > 0 ? w / span() : 0;
  }

  function startDrag(i, ev) {
    const track = document.getElementById('timeline-track');
    if (!track) return;

    // One drag at a time. Without this a second finger on a touchscreen (or a
    // second mouse button) would open a second closure; both would then react
    // to every window pointermove and fight over the plan.
    if (dragging) return;
    if (typeof ev.button === 'number' && ev.button !== 0) return;

    // Lock the scale BEFORE measuring. `|| 1000` only kicks in when every
    // phase is 0 ms - without it the whole trial would be squeezed into 1 ms
    // and a 100 px drag would not even reach one 10 ms step.
    dragSpan = total() || 1000;
    const scale = pxPerMs(track);
    if (!scale) { dragSpan = null; return; }

    if (ev.preventDefault) ev.preventDefault();
    const pointerId = ev.pointerId;
    const startX   = ev.clientX;
    const startVal = Number(plan[i].value) || 0;
    dragging = true;
    setTransitions(false);
    els[i].grip.style.opacity = '1';
    els[i].grip.style.width = '6px';
    document.body.style.userSelect = 'none';
    try { ev.target.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }

    // Ignore events belonging to a different pointer (second finger, pen).
    function mine(e) {
      return pointerId === undefined || e.pointerId === undefined || e.pointerId === pointerId;
    }

    function onMove(mv) {
      if (!mine(mv)) return;
      const v = clampMs(startVal + (mv.clientX - startX) / scale, mv.shiftKey ? 1 : SNAP_MS);
      if (v === plan[i].value) return;
      plan[i].value = v;
      syncInputs();
      layoutTrack();
    }

    function onUp(e) {
      if (e && e.type === 'pointerup' && !mine(e)) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
      dragging = false;
      dragSpan = null;                // release the lock -> whole trial refits
      els[i].grip.style.opacity = '.75';
      els[i].grip.style.width = '4px';
      document.body.style.userSelect = '';
      setTransitions(true);
      layoutTrack();
      persist();
      flash(plan[i].label + ' = ' + plan[i].value + ' ms  (trial total ' + total() + ' ms)');
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // Safety net: if the pointerup is swallowed (OS dialog steals focus, tab
    // switch) the drag would otherwise stay armed with the scale locked.
    window.addEventListener('blur', onUp);
  }

  // Keyboard equivalent of the drag, so the planner is usable without a mouse.
  function onSegKey(i, ev) {
    const big = ev.shiftKey ? 100 : SNAP_MS;
    let delta = 0;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp')   delta =  big;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') delta = -big;
    else if (ev.key === 'PageUp')   delta =  100;
    else if (ev.key === 'PageDown') delta = -100;
    else return;
    if (ev.preventDefault) ev.preventDefault();
    plan[i].value = clampMs((Number(plan[i].value) || 0) + delta, 1);
    syncInputs();
    layoutTrack();
    persist();
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

    const hint = document.createElement('div');
    hint.id = 'tl-hint-fab';
    hint.style.cssText = 'flex-basis:100%;font-size:.7rem;color:rgba(255,255,255,.65);margin-bottom:2px;';
    hint.innerHTML =
      'Drag the right edge of any block to make that phase longer or shorter ' +
      '(hold <b>Shift</b> for 1 ms steps, or focus a block and use the arrow keys). ' +
      'Or type exact values here:';
    bar.appendChild(hint);

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
        // Same clamp as the drag path. Typing "1e400" would otherwise make the
        // value Infinity, which poisons total(), prints "NaN%" widths and
        // silently disables every drag handle until a page refresh.
        if (ph) ph.value = clampMs(Number(this.value), 1);
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

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.title = 'Back to the default timing';
    resetBtn.style.cssText =
      'background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.25);' +
      'border-radius:6px;padding:6px 12px;font-size:.78rem;cursor:pointer;';
    resetBtn.onclick = resetPlan;

    btnWrap.appendChild(resetBtn);
    btnWrap.appendChild(loadBtn);
    btnWrap.appendChild(applyBtn);
    bar.appendChild(btnWrap);

    const status = document.createElement('div');
    status.id = 'tl-status-fab';
    status.style.cssText = 'flex-basis:100%;font-size:.72rem;color:#c6ffd8;min-height:1em;';
    bar.appendChild(status);

    container.appendChild(bar);
  }

  function resetPlan() {
    plan.forEach((p, i) => { p.value = DEFAULT[i].value; });
    syncInputs();
    layoutTrack();
    persist();
    flash('Reset to the default timing (total ' + total() + ' ms).');
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
        ? 'That experiment exposes no editable timing yet - using current values.'
        : 'Select an experiment in Quick Settings first.');
      return;
    }
    let matched = 0;
    plan.forEach(p => {
      if (typeof src[p.key] === 'number' && Number.isFinite(src[p.key])) {
        p.value = clampMs(src[p.key], 1);
        matched++;
      }
    });
    syncInputs();
    renderTrack();
    persist();          // every other mutator persists; this one used to not,
                        // so a reload silently reverted the loaded timing
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

    // Honest wording: the plan is guaranteed to reach the Template Builder's
    // "Generate participant link". The individual paradigm modules build their
    // own configs and do not read PTA_trialPlan.
    flash(window.currentConfig
      ? 'Inserted into the draft - total ' + total() + ' ms. It travels with the link you generate in the Template Builder.'
      : 'Saved - total ' + total() + ' ms. Pick an experiment first if you want it merged into a draft now; it will still travel with the Template Builder link.');
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
    reset: resetPlan,
    getPlan: asObject,
    total: total,
    _plan: plan,
    _isDragging: function () { return dragging; },
    _span: span
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  TimelinePlanner.init();
});
