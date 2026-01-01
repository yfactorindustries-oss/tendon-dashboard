
# Tendon Dashboard – App Reference

This document summarizes the current design and implementation of the **Tendon Dashboard** app: file structure, logic, and configuration format. Use this as a spec if you edit or rebuild it later.

---

## 1. Purpose

Single-page web app that:

- Runs locally (or via static hosting like GitHub Pages).
- Shows **daily rehab**, **today’s strength session**, and **pain/readiness**.
- Auto-rotates workouts by weekday.
- Tracks:
  - Rehab completion
  - Strength sets completion
  - Per-exercise **load (Speediance)** with **memory across days**
  - Pain scores
- Provides:
  - **Timers** for isometrics and rests
  - **Expandable cues** for *selected* rehab and **all** strength exercises

All data is stored in `localStorage` in the browser. No backend.

---

## 2. File Structure

The app is built from three main files:

- `index.html`
- `dashboard.js`
- `config.json`

All three are in the same directory. Open `index.html` in a browser or serve the folder with a static server.

### 2.1 `index.html`

- Basic layout:
  - Header with title + date.
  - Card: **Daily Rehab (10 minutes)**.
  - Card: **Today's Session** (workout).
  - Card: **Pain / Readiness**.
  - Card: **Config** (upload/restore config).
- Includes:
  - Embedded CSS for dark UI.
  - Script tag: `<script src="dashboard.js"></script>`.

### 2.2 `dashboard.js`

Main client logic:

- Loads state from `localStorage` under key `tendonDashboardState`.
- Loads config:
  - Prefer `localStorage` copy of `config.json` (`tendonDashboardConfig`).
  - If absent, fetches `config.json` from disk/server.
- Computes `todayStr` = `YYYY-MM-DD`.
- Renders:
  - Date
  - Rehab list
  - Workout for today
  - Pain grid + readiness flag
- Handles:
  - Checkbox click (rehab done).
  - Timer buttons (isometric sets and rest).
  - Set “pills” (for non-iso strength).
  - Load input (Speediance only).
  - Cue expand/collapse per-exercise.
  - Reset Day.
  - Config upload / reload.

### 2.3 `config.json`

Program definition and metadata:

Top-level keys:

- `dailyRehab`: array of rehab items.
- `workouts`: array of workout days.
- `rotation`: mapping `{ "weekdayNumber": "workoutId" }`.
- `painMetrics`: array of pain metrics to log (shoulder / glute / bicep).

---

## 3. Rotation Logic (Auto-Select Workout)

`rotation` maps JS `Date.getDay()` (0–6) to workout IDs:

```json
"rotation": {
  "1": "pull",       // Monday
  "2": "push",       // Tuesday
  "4": "glute",      // Thursday
  "6": "full_body"   // Saturday
}
```

- On each page load:
  - `weekday = new Date().getDay();`
  - `workoutId = rotation[String(weekday)]`
  - If found, match `workout.id === workoutId` in `workouts`.
  - If not found → “No programmed workout.”

Rehab is always shown regardless of day.

---

## 4. State Model

Stored in `localStorage` as JSON under `STATE_KEY = "tendonDashboardState"`.

### 4.1 Per-Day State

Each date (keyed by `YYYY-MM-DD`) stores:

```jsonc
{
  "YYYY-MM-DD": {
    "rehabDone": { "<rehabId>": true/false },
    "rehabSetsDone": {
      "<rehabId>": { "1": true/false, "2": true/false, ... }  // for iso timers
    },
    "workoutDone": {
      "<exerciseId>": { "1": true/false, "2": true/false, ... } // set pills
    },
    "workoutLoads": {
      "<exerciseId>": number|null   // per-day load
    },
    "workoutIsoSets": {
      "<exerciseId>": { "1": true/false, ... } // iso timers for strength
    },
    "pain": {
      "<metricId>": number|null
    }
  },

  "_global": {
    "workoutLoads": {
      "<exerciseId>": number|null   // last-used load across all days
    }
  }
}
```

### 4.2 Global Loads

`state._global.workoutLoads` holds the **last-used weight** for each Speediance exercise.

- When rendering a Speediance exercise:
  - It looks at **today’s** `workoutLoads[exerciseId]` first.
  - If absent, falls back to `_global.workoutLoads[exerciseId]`.
- When editing a load:
  - Updates today’s `workoutLoads[exerciseId]`.
  - Updates `_global.workoutLoads[exerciseId]`.

This provides automatic load memory across future sessions.

---

## 5. Config Schema

### 5.1 Rehab Items

Each item in `dailyRehab`:

```jsonc
{
  "id": "axilla_release",
  "label": "Posterior Axilla Ball",
  "details": "60 sec against wall",
  "equipment": "bodyweight" | "speediance",
  "video": "https://... (optional, YouTube etc.)",
  "durationSeconds": 60,    // >0 AND sets>0 → iso timer buttons
  "sets": 1,
  "restSeconds": 0,
  "cues": [                 // optional, only where execution matters
    "Setup: ...",
    "Execution: ...",
    "Constraint: ..."
  ]
}
```

Logic:

- If `durationSeconds > 0` AND `sets > 0`:
  - Show **one timer button per set**: `Set X • <duration>s`.
  - Timer runs: `Hold` → optional `Rest`.
  - On completion, button turns green and “Done”.
- `equipment` is **only cosmetic** in rehab (chip label); no load tracking.

### 5.2 Workouts

Each workout:

```jsonc
{
  "id": "pull",
  "name": "Day 1 – Pull + Posterior Shoulder",
  "notes": "Focus on slow eccentrics...",
  "exercises": [
    {
      "id": "lat_pulldown",
      "label": "Neutral Lat Pulldown",
      "sets": 3,
      "reps": "8 (3-sec eccentric)",
      "equipment": "speediance" | "bodyweight",
      "restSeconds": 60,
      "durationSeconds": 0,  // >0 means iso
      "video": "https://... (optional)",
      "cues": [
        "Setup: ...",
        "Execution: ...",
        "Constraint: ..."
      ]
    }
  ]
}
```

**Classification rules:**

- **Speediance** (`equipment: "speediance"`):
  - Always gets a **load input**.
  - Uses load memory across days.
- **Bodyweight**:
  - No load input.

**Iso vs non-iso:**

- If `durationSeconds > 0` AND `sets > 0` → **isometric / timed**:
  - No set pills.
  - Show **iso timer buttons** only (`Set X • duration`).
  - If `restSeconds > 0`, each iso timer includes internal rest countdown.
- If `durationSeconds === 0` or missing → **reps-based**:
  - Show **set pills** (Set 1, Set 2, …) for completion tracking.
  - Show **rest timer** button if `restSeconds > 0`.

---

## 6. Cues Logic

### 6.1 Rehab Cues

Included **only** for rehab items where execution can flare or protect tissue:

- Posterior Axilla Ball
- Glute Med Wall Hold
- Straight-Arm Pulldown Iso (Speediance)
- Neutral-Grip Curl Iso (Speediance)

Items like Thread-the-Needle and breathing do not have cues.

### 6.2 Strength Cues

**All strength exercises** (in workouts) have cues:

- Array of 2–3 short lines:
  - `Setup: ...`
  - `Execution: ...`
  - `Constraint: ...`

UI:

- Under the exercise meta:
  - A `Show cues` link (button) toggles a `<div>` with a bullet list.
  - Starts collapsed each day; expansion is **per exercise, per day** (not persisted across days).

---

## 7. Current Exercises (Summary)

### 7.1 Daily Rehab

- **Posterior Axilla Ball** – Bodyweight, 1×60s iso, cues enabled.
- **Thread-the-Needle** – Bodyweight mobility; no timers, no cues.
- **Glute Med Wall Hold (Right)** – Bodyweight, 2×30s iso, cues enabled.
- **Straight-Arm Pulldown Iso** – Speediance, 2×30s iso, cues enabled.
- **Neutral-Grip Curl Iso** – Speediance, 2×30s iso, cues enabled.
- **2-Min Breathing / Down-Regulation** – 1×120s iso, no cues.

### 7.2 Day 1 – Pull

All **Speediance**, reps-based, load + rest timers, cues:

- Neutral Lat Pulldown
- Single-Arm Row (elbow stops at torso line)
- Face Pull
- Straight-Arm Pulldown (eccentric focus)
- Hammer Curl (neutral grip)

### 7.3 Day 2 – Push

All **Speediance**, load + rest, with one iso:

- Incline Push-Up Simulation (Speediance handles high)
- Chest Press (elbows tucked)
- Rope Pressdown Isometric – iso + load
- Reverse Cable Triceps Extension (straight-arm bias)

### 7.4 Day 3 – Glute Tendon Strength

Mix of bodyweight + Speediance:

- Single-Leg Wall Hold (Right) – Bodyweight iso (3×30s).
- Cable Hip Hike (slow) – Speediance, reps.
- Lateral Step-Down (slow eccentric) – Bodyweight, reps.
- **Belted Hip Thrust (Speediance – Hip Belt)** – Speediance, reps, load.

### 7.5 Day 4 – Full-Body Strength Return

- Trap-Bar Cable Deadlift – Speediance, reps, heavy rest.
- Squat – Speediance, reps.
- Row (elbows tucked) – Speediance, reps.
- Floor Push-Up – Bodyweight only.
- Hammer Curl – Speediance, reps.

---

## 8. How to Add / Modify Exercises

### 8.1 Add a New Rehab Item

Add object to `dailyRehab`:

```jsonc
{
  "id": "new_rehab_id",
  "label": "Name",
  "details": "Short description",
  "equipment": "bodyweight",
  "video": "https://... (optional)",
  "durationSeconds": 30,
  "sets": 2,
  "restSeconds": 30,
  "cues": [
    "Setup: ...",
    "Execution: ...",
    "Constraint: ..."
  ]
}
```

- If you want timers: set `durationSeconds > 0` and `sets > 0`.

### 8.2 Add a New Strength Exercise

Insert into the appropriate `workouts[i].exercises`:

```jsonc
{
  "id": "some_exercise_id",
  "label": "Descriptive Name",
  "sets": 3,
  "reps": "8–10",
  "equipment": "speediance",
  "restSeconds": 60,
  "durationSeconds": 0,
  "video": "https://... (optional)",
  "cues": [
    "Setup: ...",
    "Execution: ...",
    "Constraint: ..."
  ]
}
```

- For a **timed iso**: set `durationSeconds > 0` and keep `sets`.
- For **bodyweight only**, set `equipment: "bodyweight"` (no load field).

### 8.3 Changing Rotation

Update `rotation` object to map weekdays to workout IDs:

```jsonc
"rotation": {
  "1": "pull",
  "2": "push",
  "3": "glute",
  "5": "full_body"
}
```

You must ensure referenced IDs exist in `workouts`.

---

## 9. How to Reset or Move to a New Program

- To **reset day data only**:
  - Click “Reset Today” in the UI.
- To **reset everything**:
  - Manually clear `localStorage` for keys `tendonDashboardState` and `tendonDashboardConfig` in browser dev tools.
- To switch program:
  - Create a new `config.json` with different rehab/workouts/rotation.
  - Use app’s **Config** section:
    - Click `Choose file` → pick your new `config.json` → “Config applied”.
  - Or: overwrite the physical `config.json` and click **Reload default config** in the UI.

---

## 10. Typical Workflow

1. Open app (desktop or phone).
2. Look at **date and day’s workout** (auto-rotated).
3. Run **Daily Rehab**, use iso timers where present.
4. Fill **Pain / Readiness** early or after rehab.
5. Do strength work:
   - For Speediance moves, **set or confirm load** (auto-filled from last session).
   - Use **set pills** for reps work; iso timers for isos.
   - Use **rest timers** between sets, if desired.
   - Expand **cues** only if you need reminders.
6. End of day:
   - State is automatically stored per date.
   - Next time the exercise appears, **load is auto-remembered**.

---

## 11. Porting or Recreating

If you start a new ChatGPT conversation later and want to rebuild or modify this app:

- Share:
  - This markdown file.
  - The current `config.json`.
- Key points to mention:
  - Uses **localStorage** keys: `tendonDashboardState`, `tendonDashboardConfig`.
  - Has **global load memory** in `state._global.workoutLoads`.
  - Iso detection is based purely on `durationSeconds > 0`.
  - Cues are `cues[]` arrays and rendered via “Show cues” toggles.

That’s enough for someone (or the model) to reconstruct the behavior exactly.
