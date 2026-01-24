const STATE_KEY = 'tendonDashboardState';
const CONFIG_KEY = 'tendonDashboardConfig';

let appConfig = null;
let todayStr = null;
let state = null;

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Get the current active block based on today's date
function getCurrentBlock() {
  if (!appConfig) return null;

  // Support old config format (no blocks array)
  if (!appConfig.blocks) {
    return {
      id: 'legacy',
      name: appConfig.currentBlock || appConfig.programName,
      dailyRehab: appConfig.dailyRehab || [],
      workouts: appConfig.workouts || []
    };
  }

  // New format: find block that contains today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const block of appConfig.blocks) {
    const startDate = new Date(block.startDate);
    const endDate = new Date(block.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (today >= startDate && today <= endDate) {
      return block;
    }
  }

  // If no matching block found, return the most recent one that has ended
  // (in case user is past all blocks)
  let mostRecentBlock = appConfig.blocks[appConfig.blocks.length - 1];
  return mostRecentBlock || null;
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
      pain: {},
      // NEW: Session tracking
      sessionNotes: "",
      sessionMeta: {
        startTime: null,
        endTime: null,
        workoutId: null,
        rehabCompleted: false,
        workoutCompleted: false
      },
      compliance: {
        rehabFullyCompleted: false,
        workoutFullyCompleted: false,
        painLogged: false,
        dailyComplianceScore: 0
      }
    };
  } else {
    // Ensure backward compatibility with existing data
    if (!state[todayStr].rehabSetsDone) state[todayStr].rehabSetsDone = {};
    if (!state[todayStr].workoutLoads) state[todayStr].workoutLoads = {};
    if (!state[todayStr].workoutIsoSets) state[todayStr].workoutIsoSets = {};
    if (!state[todayStr].sessionNotes) state[todayStr].sessionNotes = "";
    if (!state[todayStr].sessionMeta) {
      state[todayStr].sessionMeta = {
        startTime: null,
        endTime: null,
        workoutId: null,
        rehabCompleted: false,
        workoutCompleted: false
      };
    }
    if (!state[todayStr].compliance) {
      state[todayStr].compliance = {
        rehabFullyCompleted: false,
        workoutFullyCompleted: false,
        painLogged: false,
        dailyComplianceScore: 0
      };
    }
  }
  return state[todayStr];
}

function setTodayState(partial) {
  const current = getTodayState();
  state[todayStr] = { ...current, ...partial };
  saveState();
}

// ----- GLOBAL LOADS & ANALYTICS (persist across days) -----

function getGlobalLoads() {
  const root = state._global || {};
  return root.workoutLoads || {};
}

function setGlobalLoads(newLoads) {
  const root = state._global || {};
  state._global = { ...root, workoutLoads: newLoads };
  saveState();
}

function getGlobalAnalytics() {
  const root = state._global || {};
  return root.analytics || {
    totalWorkouts: 0,
    totalRehabSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    averageComplianceRate: 0
  };
}

function setGlobalAnalytics(analytics) {
  const root = state._global || {};
  state._global = { ...root, analytics };
  saveState();
}

// Get last known weight/reps for an exercise
function getExerciseHistory(exerciseId) {
  const root = state._global || {};
  const history = root.exerciseHistory || {};
  return history[exerciseId] || null;
}

// Save weight/reps for an exercise
function setExerciseHistory(exerciseId, data) {
  const root = state._global || {};
  const history = root.exerciseHistory || {};
  history[exerciseId] = {
    ...data,
    lastUsed: todayStr
  };
  state._global = { ...root, exerciseHistory: history };
  saveState();
}

// ------------ Helpers ------------

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Calculate compliance score for a given day
function computeDayCompliance(dateStr) {
  const dayState = state[dateStr];
  if (!dayState) {
    return { date: dateStr, score: 0, rehab: false, workout: false, pain: false };
  }

  // Use existing compliance data if available
  if (dayState.compliance && dayState.compliance.dailyComplianceScore !== undefined) {
    return {
      date: dateStr,
      score: dayState.compliance.dailyComplianceScore,
      rehab: dayState.compliance.rehabFullyCompleted,
      workout: dayState.compliance.workoutFullyCompleted,
      pain: dayState.compliance.painLogged
    };
  }

  // Compute from data
  const rehabDone = dayState.rehabDone || {};
  const workoutDone = dayState.workoutDone || {};
  const pain = dayState.pain || {};

  // Rehab compliance
  const rehabItems = appConfig.dailyRehab || [];
  const rehabExpected = rehabItems.length;
  const rehabCompleted = Object.values(rehabDone).filter(Boolean).length;
  const rehabScore = rehabExpected > 0 ? (rehabCompleted / rehabExpected) * 100 : 100;

  // Workout compliance
  const workout = getWorkoutForDate(dateStr);
  let workoutScore = 100;
  if (workout && workout.exercises) {
    const workoutExpected = workout.exercises.reduce((sum, ex) => sum + ex.sets, 0);
    const workoutCompleted = Object.values(workoutDone).reduce((sum, exSets) => {
      return sum + Object.values(exSets).filter(Boolean).length;
    }, 0);
    workoutScore = workoutExpected > 0 ? (workoutCompleted / workoutExpected) * 100 : 100;
  }

  // Pain logging (partial credit)
  const painMetrics = appConfig.painMetrics || [];
  const painLogged = Object.keys(pain).length;
  const painScore = painMetrics.length > 0 ? (painLogged / painMetrics.length) * 100 : 0;

  // Weighted score: 40% rehab, 50% workout, 10% pain
  const totalScore = Math.round(rehabScore * 0.4 + workoutScore * 0.5 + painScore * 0.1);

  return {
    date: dateStr,
    score: totalScore,
    rehab: rehabScore === 100,
    workout: workoutScore === 100,
    pain: painScore > 0
  };
}

// Update compliance for today
function updateTodayCompliance() {
  const compliance = computeDayCompliance(todayStr);
  setTodayState({
    compliance: {
      rehabFullyCompleted: compliance.rehab,
      workoutFullyCompleted: compliance.workout,
      painLogged: compliance.pain,
      dailyComplianceScore: compliance.score
    }
  });
}

// Get workout for a specific date
function getWorkoutForDate(dateStr) {
  const d = new Date(dateStr);
  const dayOfWeek = d.getDay();
  const workouts = appConfig.workouts || [];
  const workout = workouts.find(w => w.days && w.days.includes(dayOfWeek));
  return workout || null;
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

// ------------ Analytics ------------

function computeComplianceMetrics() {
  const today = new Date();
  const last90Days = [];

  // Collect last 90 days
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const compliance = computeDayCompliance(dateStr);
    last90Days.push(compliance);
  }

  // Reverse to get oldest to newest
  last90Days.reverse();

  // Current streak
  let currentStreak = 0;
  for (let i = 89; i >= 0; i--) {
    if (last90Days[i].score === 100) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  last90Days.forEach(day => {
    if (day.score === 100) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  });

  // 30-day compliance
  const last30Days = last90Days.slice(-30);
  const compliance30d = Math.round(
    last30Days.reduce((sum, c) => sum + c.score, 0) / last30Days.length
  );

  // 90-day compliance
  const compliance90d = Math.round(
    last90Days.reduce((sum, c) => sum + c.score, 0) / last90Days.length
  );

  // Total sessions
  const totalSessions = Object.keys(state)
    .filter(key => key.match(/^\d{4}-\d{2}-\d{2}$/))
    .filter(key => {
      const dayState = state[key];
      return dayState && (
        Object.keys(dayState.rehabDone || {}).length > 0 ||
        Object.keys(dayState.workoutDone || {}).length > 0
      );
    })
    .length;

  return {
    currentStreak,
    streakTrend: currentStreak > 7 ? 'up' : currentStreak > 3 ? 'neutral' : 'down',
    compliance30d,
    compliance90d,
    complianceTrend: compliance30d > compliance90d ? 'up' : compliance30d < compliance90d ? 'down' : 'neutral',
    totalSessions,
    dailyCompliance: last90Days
  };
}

function createKPICard({ label, value, unit, icon, trend }) {
  const card = document.createElement('div');
  card.className = 'kpi-card';

  const iconEl = document.createElement('div');
  iconEl.className = 'kpi-icon';
  iconEl.textContent = icon;

  const content = document.createElement('div');
  content.className = 'kpi-content';

  const labelEl = document.createElement('div');
  labelEl.className = 'kpi-label';
  labelEl.textContent = label;

  const valueRow = document.createElement('div');
  valueRow.className = 'kpi-value-row';

  const valueEl = document.createElement('div');
  valueEl.className = 'kpi-value';

  if (unit) {
    valueEl.innerHTML = `${value}<span class="kpi-unit">${unit}</span>`;
  } else {
    valueEl.textContent = value;
  }

  valueRow.appendChild(valueEl);

  if (trend) {
    const trendEl = document.createElement('div');
    trendEl.className = `kpi-trend kpi-trend-${trend}`;
    trendEl.textContent = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
    valueRow.appendChild(trendEl);
  }

  content.appendChild(labelEl);
  content.appendChild(valueRow);

  card.appendChild(iconEl);
  card.appendChild(content);

  return card;
}

function createComplianceHeatmap(dailyCompliance) {
  const container = document.createElement('div');

  const title = document.createElement('h3');
  title.className = 'heatmap-title';
  title.textContent = 'Last 90 Days';

  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  // Group by weeks
  const weeks = [];
  let currentWeek = [];

  dailyCompliance.forEach((day, index) => {
    const date = new Date(day.date);
    const dayOfWeek = date.getDay();

    if (index > 0 && dayOfWeek === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    currentWeek.push(day);
  });

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  // Render weeks
  weeks.forEach((week, weekIndex) => {
    const weekCol = document.createElement('div');
    weekCol.className = 'heatmap-week';

    // Pad start of first week
    if (weekIndex === 0) {
      const firstDay = new Date(week[0].date).getDay();
      for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'heatmap-day heatmap-day-empty';
        weekCol.appendChild(empty);
      }
    }

    week.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'heatmap-day';
      cell.dataset.date = day.date;
      cell.dataset.score = day.score;
      cell.title = `${day.date}: ${day.score}% compliance`;

      // Color based on score
      if (day.score === 0) {
        cell.classList.add('heatmap-day-none');
      } else if (day.score < 50) {
        cell.classList.add('heatmap-day-low');
      } else if (day.score < 75) {
        cell.classList.add('heatmap-day-medium');
      } else if (day.score < 100) {
        cell.classList.add('heatmap-day-high');
      } else {
        cell.classList.add('heatmap-day-full');
      }

      weekCol.appendChild(cell);
    });

    grid.appendChild(weekCol);
  });

  container.appendChild(title);
  container.appendChild(grid);

  return container;
}

function renderAnalytics() {
  const kpiGrid = document.getElementById('kpiGrid');
  const heatmapContainer = document.getElementById('heatmapContainer');

  if (!kpiGrid || !heatmapContainer) return;

  // Clear previous content
  kpiGrid.innerHTML = '';
  heatmapContainer.innerHTML = '';

  // Compute metrics
  const metrics = computeComplianceMetrics();

  // Render KPI cards
  kpiGrid.appendChild(createKPICard({
    label: 'Current Streak',
    value: metrics.currentStreak,
    unit: 'days',
    icon: '🔥',
    trend: metrics.streakTrend
  }));

  kpiGrid.appendChild(createKPICard({
    label: '30-Day Compliance',
    value: metrics.compliance30d,
    unit: '%',
    icon: '📊',
    trend: metrics.complianceTrend
  }));

  kpiGrid.appendChild(createKPICard({
    label: 'Total Sessions',
    value: metrics.totalSessions,
    unit: '',
    icon: '💪',
    trend: null
  }));

  // Render heatmap
  const heatmap = createComplianceHeatmap(metrics.dailyCompliance);
  heatmapContainer.appendChild(heatmap);

  // Update global analytics
  setGlobalAnalytics({
    totalWorkouts: metrics.totalSessions,
    totalRehabSessions: metrics.totalSessions,
    currentStreak: metrics.currentStreak,
    longestStreak: Math.max(metrics.currentStreak, getGlobalAnalytics().longestStreak || 0),
    averageComplianceRate: metrics.compliance90d
  });
}

// ------------ Date ------------

function renderDate() {
  const d = new Date();
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const currentBlock = getCurrentBlock();

  let dateText = `${weekdayNames[d.getDay()]} • ${todayStr}`;

  // Add current block name if using blocks
  if (currentBlock && currentBlock.name) {
    dateText += ` • ${currentBlock.name}`;
  }

  document.getElementById('dateText').textContent = dateText;
}

// ------------ Rehab (daily) ------------

function renderRehab() {
  const container = document.getElementById('rehabList');
  const statusEl = document.getElementById('rehabStatus');
  container.innerHTML = '';

  const currentBlock = getCurrentBlock();
  if (!currentBlock) return;

  const todayState = getTodayState();
  const rehabDone = todayState.rehabDone || {};
  const rehabSetsDone = todayState.rehabSetsDone || {};
  const items = currentBlock.dailyRehab || [];

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
      updateTodayCompliance();
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
  const currentBlock = getCurrentBlock();
  if (!currentBlock) return null;

  const weekday = new Date().getDay();

  // Support old rotation format (legacy configs)
  if (appConfig.rotation) {
    const workoutId = appConfig.rotation[String(weekday)];
    if (workoutId) {
      return (currentBlock.workouts || []).find(w => w.id === workoutId) || null;
    }
  }

  // New format: find workout where days array includes today's weekday
  return (currentBlock.workouts || []).find(w => {
    const days = w.days || [];
    return days.includes(weekday);
  }) || null;
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
    // Support both details format and sets/reps format
    if (ex.details) {
      metaRow.textContent = ex.details;
    } else {
      metaRow.textContent = `${ex.sets} sets • ${ex.reps}`;
    }

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

  // Setup session notes (only show if there's a workout)
  setupSessionNotes();
  updateTodayCompliance();
}

// ------------ Session Notes ------------

function setupSessionNotes() {
  const container = document.getElementById('sessionNotesContainer');
  const toggle = document.getElementById('notesToggle');
  const panel = document.getElementById('notesPanel');
  const textarea = document.getElementById('sessionNotesInput');
  const saveBtn = document.getElementById('notesSaveBtn');
  const charCount = document.getElementById('notesCharCount');
  const indicator = document.getElementById('notesIndicator');

  if (!container || !toggle || !panel || !textarea || !saveBtn) return;

  // Only show for days with workouts
  const workout = getTodayWorkoutConfig();
  if (!workout) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  const maxChars = 500;
  const todayState = getTodayState();
  const notes = todayState.sessionNotes || '';

  // Load existing notes
  textarea.value = notes;
  charCount.textContent = `${notes.length} / ${maxChars}`;

  if (notes.length > 0) {
    indicator.style.display = 'inline';
  } else {
    indicator.style.display = 'none';
  }

  // Toggle panel
  toggle.onclick = () => {
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
  };

  // Character counter
  textarea.oninput = () => {
    const length = textarea.value.length;
    charCount.textContent = `${length} / ${maxChars}`;

    if (length > maxChars) {
      textarea.value = textarea.value.substring(0, maxChars);
      charCount.textContent = `${maxChars} / ${maxChars}`;
    }
  };

  // Save notes
  saveBtn.onclick = () => {
    const notes = textarea.value.trim();
    setTodayState({ sessionNotes: notes });

    if (notes.length > 0) {
      indicator.style.display = 'inline';
    } else {
      indicator.style.display = 'none';
    }

    // Visual feedback
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    saveBtn.style.background = 'var(--color-success)';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '';
    }, 2000);
  };
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
      updateTodayCompliance();
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
  renderAnalytics();
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
