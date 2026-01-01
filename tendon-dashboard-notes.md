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

_(Note: history / trend views are **not implemented yet**; see §12 for the planned extension.)_

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
