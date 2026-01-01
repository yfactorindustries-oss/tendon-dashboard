const STATE_KEY = 'tendonDashboardState';
const CONFIG_KEY = 'tendonDashboardConfig';

let appConfig = null;
let todayStr = null;
let state = null;

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadStoredConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConfig(cfg) {
  appConfig = cfg;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function getTodayState() {
  if (!state[todayStr]) {
    state[todayStr] = {
      rehabDone: {},
      rehabSetsDone: {},
      workoutDone: {},
      workoutLoads: {},
      workoutIsoSets: {},
      pain: {}
    };
  } else {
    if (!state[todayStr].rehabSetsDone) state[todayStr].rehabSetsDone = {};
    if (!state[todayStr].workoutLoads) state[todayStr].workoutLoads = {};
    if (!state[todayStr].workoutIsoSets) state[todayStr].workoutIsoSets = {};
  }
  return state[todayStr];
}

function setTodayState(partial) {
  const current = getTodayState();
  state[todayStr] = { ...current, ...partial };
  saveState();
}

// ----- GLOBAL LOADS (persist across days) -----

function getGlobalLoads() {
  const root = state._global || {};
  return root.workoutLoads || {};
}

function setGlobalLoads(newLoads) {
  const root = state._global || {};
  state._global = { ...root, workoutLoads: newLoads };
  saveState();
}

// ------------ Helpers ------------

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function createCueElements(cues) {
  if (!cues || !cues.length) return null;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'cue-toggle';
  toggle.textContent = 'Show cues';

  const panel = document.createElement('div');
  panel.className = 'cue-panel';

  const list = document.createElement('ul');
  cues.forEach(line => {
    const li = document.createElement('li');
    li.textContent = line;
    list.appendChild(li);
  });
  panel.appendChild(list);

  let open = false;
  toggle.onclick = () => {
    open = !open;
    panel.style.display = open ? 'block' : 'none';
    toggle.textContent = open ? 'Hide cues' : 'Show cues';
  };

  return { toggle, panel };
}

// ------------ Date ------------

function renderDate() {
  const d = new Date();
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  document.getElementById('dateText').textContent =
    `${weekdayNames[d.getDay()]} • ${todayStr}`;
}

// ------------ Rehab (daily) ------------

function renderRehab() {
  const container = document.getElementById('rehabList');
  const statusEl = document.getElementById('rehabStatus');
  container.innerHTML = '';

  const todayState = getTodayState();
  const rehabDone = todayState.rehabDone || {};
  const rehabSetsDone = todayState.rehabSetsDone || {};
  const items = appConfig.dailyRehab || [];

  let completedItems = 0;

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'list-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!rehabDone[item.id];
    cb.onchange = () => {
      setTodayState({
        rehabDone: { ...rehabDone, [item.id]: cb.checked }
      });
      renderRehab();
    };

    const label = document.createElement('label');

    const titleRow = document.createElement('div');
    titleRow.className = 'exercise-title';

    if (item.video) {
      const link = document.createElement('a');
      link.href = item.video;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.label;
      link.className = 'exercise-link';
      titleRow.appendChild(link);
    } else {
      titleRow.textContent = item.label;
    }

    if (item.equipment === 'speediance') {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = 'Speediance';
      titleRow.appendChild(chip);
    }

    const meta = document.createElement('div');
    meta.className = 'small';
    meta.textContent = item.details || '';

    label.appendChild(titleRow);
    if (item.details) label.appendChild(meta);

    // Rehab cues only where needed
    if (item.cues && item.cues.length) {
      const cueElems = createCueElements(item.cues);
      if (cueElems) {
        label.appendChild(cueElems.toggle);
        label.appendChild(cueElems.panel);
      }
    }

    const sets = item.sets && item.sets > 0 ? item.sets : 0;
    const duration = item.durationSeconds && item.durationSeconds > 0 ? item.durationSeconds : 0;
    const rest = item.restSeconds && item.restSeconds > 0 ? item.restSeconds : 0;

    if (sets > 0 && duration > 0) {
      const setState = rehabSetsDone[item.id] || {};
      const timerRow = document.createElement('div');
      timerRow.className = 'timer-row';

      let activeTimer = false;

      for (let i = 1; i <= sets; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'timer-btn' + (setState[i] ? ' done' : '');
        btn.textContent = `Set ${i} • ${duration}s`;

        const display = document.createElement('span');
        display.className = 'timer-display';
        if (setState[i]) display.textContent = 'Done';

        btn.onclick = () => {
          if (setState[i] || activeTimer) return;

          activeTimer = true;
          btn.disabled = true;

          let phase = 'hold';
          let remaining = duration;
          display.textContent = `Hold ${formatSeconds(remaining)}`;

          const id = setInterval(() => {
            remaining -= 1;

            if (remaining <= 0) {
              if (phase === 'hold' && rest > 0) {
                phase = 'rest';
                remaining = rest;
                display.textContent = `Rest ${formatSeconds(remaining)}`;
                return;
              } else {
                clearInterval(id);
                btn.disabled = false;
                btn.classList.add('done');
                display.textContent = 'Done';

                const newItemState = { ...setState, [i]: true };
                const newRehabSetsDone = { ...rehabSetsDone, [item.id]: newItemState };

                let allDone = true;
                for (let s = 1; s <= sets; s++) {
                  if (!newItemState[s]) { allDone = false; break; }
                }

                const newRehabDone = {
                  ...rehabDone,
                  [item.id]: allDone ? true : rehabDone[item.id]
                };

                setTodayState({
                  rehabDone: newRehabDone,
                  rehabSetsDone: newRehabSetsDone
                });

                activeTimer = false;
                renderRehab();
              }
            } else {
              display.textContent =
                (phase === 'hold'
                  ? `Hold ${formatSeconds(remaining)}`
                  : `Rest ${formatSeconds(remaining)}`);
            }
          }, 1000);
        };

        timerRow.appendChild(btn);
        timerRow.appendChild(display);
      }

      label.appendChild(timerRow);
    }

    row.appendChild(cb);
    row.appendChild(label);
    container.appendChild(row);

    if (cb.checked) completedItems++;
  });

  const total = items.length;
  if (!total) {
    statusEl.textContent = 'No rehab items defined.';
    return;
  }

  if (completedItems === 0) {
    statusEl.textContent = 'Not started.';
  } else if (completedItems === total) {
    statusEl.innerHTML = '<span class="status-dot green"></span>All rehab done.';
  } else {
    statusEl.innerHTML =
      `<span class="status-dot yellow"></span>${completedItems}/${total} done.`;
  }
}

// ------------ Workouts ------------

function getTodayWorkoutConfig() {
  const weekday = new Date().getDay();
  const rotation = appConfig.rotation || {};
  const workoutId = rotation[String(weekday)];
  if (!workoutId) return null;
  return (appConfig.workouts || []).find(w => w.id === workoutId) || null;
}

function renderWorkout() {
  const titleEl = document.getElementById('workoutTitle');
  const subtitleEl = document.getElementById('workoutSubtitle');
  const contentEl = document.getElementById('workoutContent');

  contentEl.innerHTML = '';

  const workout = getTodayWorkoutConfig();
  const todayState = getTodayState();
  const workoutDone = todayState.workoutDone || {};
  const workoutLoadsToday = todayState.workoutLoads || {};
  const workoutIsoSets = todayState.workoutIsoSets || {};
  const globalLoads = getGlobalLoads();

  if (!workout) {
    titleEl.textContent = "Today's Session";
    subtitleEl.textContent = "No programmed workout.";
    contentEl.innerHTML =
      '<div class="rest-note">Optional: walking, light conditioning, or extra mobility.</div>';
    return;
  }

  titleEl.textContent = workout.name || "Today's Session";
  subtitleEl.textContent = workout.notes || '';

  (workout.exercises || []).forEach(ex => {
    const wrapper = document.createElement('div');
    wrapper.className = 'list-item';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'stretch';

    const titleRow = document.createElement('div');
    titleRow.className = 'exercise-title';

    if (ex.video) {
      const link = document.createElement('a');
      link.href = ex.video;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = ex.label;
      link.className = 'exercise-link';
      titleRow.appendChild(link);
    } else {
      titleRow.textContent = ex.label;
    }

    if (ex.equipment === 'speediance') {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = 'Speediance';
      titleRow.appendChild(chip);
    }

    const metaRow = document.createElement('div');
    metaRow.className = 'exercise-meta';
    metaRow.textContent = `${ex.sets} sets • ${ex.reps}`;

    const isoSets = ex.sets && ex.sets > 0 ? ex.sets : 0;
    const isoDuration = ex.durationSeconds && ex.durationSeconds > 0 ? ex.durationSeconds : 0;
    const isoRest = ex.restSeconds && ex.restSeconds > 0 ? ex.restSeconds : 0;
    const isIso = isoSets > 0 && isoDuration > 0;

    // Cue panel for all strength movements
    if (ex.cues && ex.cues.length) {
      const cueElems = createCueElements(ex.cues);
      if (cueElems) {
        ex._cueToggle = cueElems.toggle;
        ex._cuePanel = cueElems.panel;
      }
    }

    // Sets row (non-iso only)
    let setsRow = null;
    if (!isIso) {
      setsRow = document.createElement('div');
      setsRow.className = 'sets-row';
      const exState = workoutDone[ex.id] || {};
      for (let i = 1; i <= ex.sets; i++) {
        const pill = document.createElement('div');
        pill.className = 'set-pill' + (exState[i] ? ' done' : '');
        pill.textContent = `Set ${i}`;
        pill.onclick = () => {
          const newExState = { ...exState, [i]: !exState[i] };
          setTodayState({
            workoutDone: { ...workoutDone, [ex.id]: newExState }
          });
          renderWorkout();
        };
        setsRow.appendChild(pill);
      }
    }

    // Load row (Speediance only, with global memory)
    let loadRow = null;
    if (ex.equipment === 'speediance') {
      loadRow = document.createElement('div');
      loadRow.className = 'load-row';

      const loadLabel = document.createElement('span');
      loadLabel.textContent = 'Load:';

      const loadInput = document.createElement('input');
      loadInput.type = 'number';
      loadInput.min = '0';
      loadInput.step = '1';

      const todayVal = workoutLoadsToday[ex.id];
      const globalVal = globalLoads[ex.id];
      loadInput.value = (todayVal ?? globalVal) ?? '';

      loadInput.onchange = () => {
        const val = loadInput.value === '' ? null : Number(loadInput.value);

        const newLoadsToday = { ...workoutLoadsToday, [ex.id]: val };
        setTodayState({ workoutLoads: newLoadsToday });

        const newGlobalLoads = { ...globalLoads, [ex.id]: val };
        setGlobalLoads(newGlobalLoads);
      };

      const loadUnit = document.createElement('span');
      loadUnit.textContent = 'lb';

      loadRow.appendChild(loadLabel);
      loadRow.appendChild(loadInput);
      loadRow.appendChild(loadUnit);
    }

    // Iso timers
    let isoRow = null;
    if (isIso) {
      const isoState = workoutIsoSets[ex.id] || {};
      isoRow = document.createElement('div');
      isoRow.className = 'timer-row';

      let activeTimer = false;

      for (let i = 1; i <= isoSets; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'timer-btn' + (isoState[i] ? ' done' : '');
        btn.textContent = `Set ${i} • ${isoDuration}s`;

        const display = document.createElement('span');
        display.className = 'timer-display';
        if (isoState[i]) display.textContent = 'Done';

        btn.onclick = () => {
          if (isoState[i] || activeTimer) return;

          activeTimer = true;
          btn.disabled = true;

          let phase = 'hold';
          let remaining = isoDuration;
          display.textContent = `Hold ${formatSeconds(remaining)}`;

          const id = setInterval(() => {
            remaining -= 1;

            if (remaining <= 0) {
              if (phase === 'hold' && isoRest > 0) {
                phase = 'rest';
                remaining = isoRest;
                display.textContent = `Rest ${formatSeconds(remaining)}`;
                return;
              } else {
                clearInterval(id);
                btn.disabled = false;
                btn.classList.add('done');
                display.textContent = 'Done';

                const newIsoState = { ...isoState, [i]: true };
                const newWorkoutIsoSets = { ...workoutIsoSets, [ex.id]: newIsoState };
                setTodayState({ workoutIsoSets: newWorkoutIsoSets });

                activeTimer = false;
                renderWorkout();
              }
            } else {
              display.textContent =
                (phase === 'hold'
                  ? `Hold ${formatSeconds(remaining)}`
                  : `Rest ${formatSeconds(remaining)}`);
            }
          }, 1000);
        };

        isoRow.appendChild(btn);
        isoRow.appendChild(display);
      }
    }

    // Rest timer (non-iso only)
    let restRow = null;
    if (!isIso && ex.restSeconds && ex.restSeconds > 0) {
      restRow = document.createElement('div');
      restRow.className = 'timer-row';

      const restBtn = document.createElement('button');
      restBtn.type = 'button';
      restBtn.className = 'timer-btn';
      restBtn.textContent = `Rest ${ex.restSeconds}s`;

      const restDisplay = document.createElement('span');
      restDisplay.className = 'timer-display';
      restDisplay.textContent = '';

      restBtn.onclick = () => {
        let remaining = ex.restSeconds;
        restBtn.disabled = true;
        restDisplay.textContent = formatSeconds(remaining);
        const id = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(id);
            restDisplay.textContent = 'Rest done';
            restBtn.disabled = false;
          } else {
            restDisplay.textContent = formatSeconds(remaining);
          }
        }, 1000);
      };

      restRow.appendChild(restBtn);
      restRow.appendChild(restDisplay);
    }

    // Append in clean order
    wrapper.appendChild(titleRow);
    wrapper.appendChild(metaRow);

    if (ex._cueToggle && ex._cuePanel) {
      wrapper.appendChild(ex._cueToggle);
      wrapper.appendChild(ex._cuePanel);
    }

    if (setsRow) wrapper.appendChild(setsRow);
    if (loadRow) wrapper.appendChild(loadRow);
    if (isoRow) wrapper.appendChild(isoRow);
    if (restRow) wrapper.appendChild(restRow);

    contentEl.appendChild(wrapper);
  });
}

// ------------ Pain / readiness ------------

function renderPain() {
  const grid = document.getElementById('painGrid');
  const readinessEl = document.getElementById('readinessText');
  grid.innerHTML = '';

  const todayState = getTodayState();
  const pain = todayState.pain || {};
  const metrics = appConfig.painMetrics || [];

  let sum = 0;
  let count = 0;

  metrics.forEach(m => {
    const item = document.createElement('div');
    item.className = 'pain-item';

    const label = document.createElement('label');
    label.textContent = m.label;

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '10';
    input.step = '1';
    input.value = pain[m.id] ?? '';
    input.onchange = () => {
      const val = input.value === '' ? null : Math.max(0, Math.min(10, Number(input.value)));
      const newPain = { ...pain, [m.id]: val };
      setTodayState({ pain: newPain });
      renderPain();
    };

    if (typeof pain[m.id] === 'number') {
      sum += pain[m.id];
      count++;
    }

    item.appendChild(label);
    item.appendChild(input);
    grid.appendChild(item);
  });

  if (!metrics.length) {
    readinessEl.textContent = '';
    return;
  }

  if (count === 0) {
    readinessEl.textContent = 'Log pain to compute readiness.';
    return;
  }

  const avg = sum / count;
  let cls = 'green';
  let text = '';

  if (avg <= 3) {
    cls = 'green';
    text = 'Ready: Green – full session OK.';
  } else if (avg <= 6) {
    cls = 'yellow';
    text = 'Ready: Yellow – keep loads moderate.';
  } else {
    cls = 'red';
    text = 'Ready: Red – dial back intensity.';
  }

  readinessEl.innerHTML = `<span class="status-dot ${cls}"></span>${text}`;
}

function renderAll() {
  renderDate();
  renderRehab();
  renderWorkout();
  renderPain();
}

// ------------ Config / init ------------

async function initConfig() {
  const stored = loadStoredConfig();
  if (stored) {
    appConfig = stored;
    return;
  }
  try {
    const res = await fetch('config.json');
    const cfg = await res.json();
    saveConfig(cfg);
  } catch {
    appConfig = { dailyRehab: [], workouts: [], rotation: {}, painMetrics: [] };
  }
}

function resetToday() {
  state[todayStr] = {
    rehabDone: {},
    rehabSetsDone: {},
    workoutDone: {},
    workoutLoads: {},
    workoutIsoSets: {},
    pain: {}
  };
  saveState();
  renderAll();
}

function setupConfigUpload() {
  const input = document.getElementById('configUpload');
  const reloadBtn = document.getElementById('reloadConfigBtn');

  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cfg = JSON.parse(reader.result);
        saveConfig(cfg);
        renderAll();
        alert('Config applied.');
      } catch {
        alert('Invalid config file.');
      }
    };
    reader.readAsText(file);
  };

  reloadBtn.onclick = async () => {
    try {
      const res = await fetch('config.json');
      const cfg = await res.json();
      saveConfig(cfg);
      renderAll();
      alert('Default config reloaded.');
    } catch {
      alert('Failed to reload default config.');
    }
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  todayStr = getTodayStr();
  state = loadState();
  await initConfig();
  setupConfigUpload();
  document.getElementById('resetDayBtn').onclick = () => {
    if (confirm("Reset today's data?")) resetToday();
  };
  renderAll();
});
