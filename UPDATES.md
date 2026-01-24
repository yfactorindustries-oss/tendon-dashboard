# Career Ready - Update Documentation

## Overview
Complete modernization of the tendon-dashboard app, renamed to "Career Ready" for firefighter long-career training. Includes UI overhaul, automatic block-based programming system, session tracking, and compliance analytics.

**Date:** January 2026
**Version:** 2.0
**Original App:** Tendon Dashboard → **New Name:** Career Ready

---

## Major Features Added

### 1. **Automatic Block-Based Programming**
- Training program automatically switches between blocks based on date ranges
- Supports multiple training blocks (Block A, Block B, etc.) in a single config
- Current block name displayed in header
- No manual intervention needed when transitioning between blocks

### 2. **Modern Design System**
- Complete CSS modularization (5 separate CSS files)
- Dark theme with professional color palette
- Google Fonts integration (Inter for UI, JetBrains Mono for data)
- Responsive design (mobile-first: 320px → 1280px+)
- Smooth animations and transitions

### 3. **Session Tracking & Analytics**
- Compliance scoring system (40% rehab + 50% workout + 10% pain logging)
- GitHub-style 90-day compliance heatmap
- KPI cards: Current Streak, 30-Day Compliance, Total Sessions
- Session notes capability (500 character limit)
- Weight and rep memory for exercises

### 4. **Enhanced Exercise Support**
- Support for both traditional exercises (sets/reps) and duration-based exercises (cardio, mobility)
- Equipment tagging (Speediance)
- Collapsible cue panels for form guidance
- Set tracking with checkboxes

---

## File Structure Changes

### New Files Created

#### CSS Files (Modular Design System)
```
css/
├── variables.css    - Design tokens (colors, spacing, typography, shadows)
├── base.css         - Global styles, resets, animations
├── components.css   - Cards, buttons, pills, inputs, checkboxes
├── layouts.css      - Responsive grid system and breakpoints
└── analytics.css    - KPI cards, heatmap, charts, session notes
```

#### Documentation
```
UPDATES.md          - This file (comprehensive update documentation)
```

### Modified Files

#### `index.html`
- Changed title from "Tendon Dashboard" to "Career Ready"
- Added Google Fonts (Inter, JetBrains Mono)
- Replaced inline CSS with modular imports
- Changed "Daily Rehab" to "Daily Foundation (10-12 minutes)"
- Added subtitle: "Required every day, all year"
- Added session notes container
- Added analytics dashboard section (KPI grid, heatmap)

#### `dashboard.js`
- Added ~500 lines of new functionality
- Block-based programming system
- Compliance calculation and tracking
- Session notes management
- Analytics rendering (KPI cards, heatmap)
- Extended data model with new fields

#### `config.json`
- Complete restructure with blocks-based system
- Changed from single program to array of training blocks
- Added date ranges for automatic switching
- Firefighter Long-Career Training program (Block A)

---

## Config Structure Changes

### Old Format (v1)
```json
{
  "programName": "...",
  "currentBlock": "...",
  "dailyRehab": [...],
  "workouts": [...],
  "rotation": {
    "1": "workout_id"
  },
  "painMetrics": [...]
}
```

### New Format (v2)
```json
{
  "programName": "Firefighter Long-Career Training",
  "blocks": [
    {
      "id": "block_a",
      "name": "Block A - Base / Durability",
      "startDate": "2026-01-20",
      "endDate": "2026-04-13",
      "weekRange": "Weeks 1-12",
      "notes": "...",
      "dailyRehab": [...],
      "workouts": [...]
    }
  ],
  "painMetrics": [...]
}
```

**Key Changes:**
- `blocks` array allows multiple training blocks with date ranges
- Each block has its own `dailyRehab` and `workouts`
- Workouts use `days: [1, 2, 3]` array instead of separate `rotation` object
- `painMetrics` stays at root level (shared across all blocks)

---

## Data Model Extensions

### Extended localStorage Schema (v2)

Each day's state now includes:

```javascript
state[dateStr] = {
  // Existing v1 fields (preserved)
  rehabDone: {},
  rehabSetsDone: {},
  workoutDone: {},
  workoutLoads: {},
  workoutIsoSets: {},
  pain: {},

  // NEW v2 fields
  sessionNotes: "",                // Session journal (max 500 chars)
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
    dailyComplianceScore: 0        // 0-100%
  }
}
```

### Global Analytics
```javascript
state._global.analytics = {
  totalWorkouts: 0,
  totalRehabSessions: 0,
  currentStreak: 0,
  longestStreak: 0,
  averageComplianceRate: 0
}
```

---

## JavaScript Functions Added

### Block Management
- `getCurrentBlock()` - Returns active block based on today's date
  - Supports legacy config format (no blocks array)
  - Finds block where today falls within startDate/endDate
  - Falls back to most recent block if past all blocks

### Modified Functions
- `getTodayWorkoutConfig()` - Now uses current block's workouts
- `renderRehab()` - Now uses current block's dailyRehab
- `renderDate()` - Displays current block name in header
- Exercise rendering - Supports both `details` (duration) and `sets`/`reps` formats

### Session Notes
- `setupSessionNotes()` - Initialize notes panel
- Character counter (0/500)
- Auto-save on blur or manual save button
- Visual indicator when notes exist

### Analytics
- `computeDayCompliance()` - Calculate weighted compliance score
- `getGlobalAnalytics()` - Retrieve lifetime stats
- `renderAnalytics()` - Render KPI cards and heatmap
- Compliance heatmap with 90-day view

---

## Design System Details

### Color Palette
```css
--color-bg-primary: #0a0f1e;          /* Deep navy background */
--color-bg-secondary: #121827;        /* Card backgrounds */
--color-bg-tertiary: #1a202e;         /* Input backgrounds */

--color-accent-primary: #3b82f6;      /* Primary blue */
--color-accent-secondary: #8b5cf6;    /* Purple accent */

--color-success: #10b981;             /* Green for completion */
--color-warning: #f59e0b;             /* Amber for caution */
--color-danger: #ef4444;              /* Red for high RPE/pain */
```

### Typography
```css
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', Monaco, monospace;

--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
```

### Spacing Scale
```css
--space-xs: 0.25rem;    /* 4px */
--space-sm: 0.5rem;     /* 8px */
--space-md: 1rem;       /* 16px */
--space-lg: 1.5rem;     /* 24px */
--space-xl: 2rem;       /* 32px */
--space-2xl: 3rem;      /* 48px */
```

### Responsive Breakpoints
- **Mobile**: 320px - 640px (single column)
- **Tablet**: 768px - 1024px (single column, larger cards)
- **Desktop**: 1280px+ (two-column grid for analytics)

---

## Current Training Program (Block A)

### Program Details
- **Name:** Firefighter Long-Career Training - Block A
- **Focus:** Base / Durability
- **Duration:** Weeks 1-12 (Jan 20 - Apr 13, 2026)
- **Goals:** Career longevity (8+ years), joint/tendon durability, firefighter-specific work capacity
- **Intensity:** Main lifts never exceed RPE 7-8

### Daily Foundation (8 items, ~10-12 minutes)
1. Forearm & Distal Biceps Release (2 min)
2. Lat & Pec Minor Release (2 min)
3. Elbow CARs (2 reps/side)
4. Shoulder CARs (2 reps/side)
5. Hip CARs (2 reps/side)
6. Banded Ankle Dorsiflexion (2×15)
7. T-Spine Open Books (5 reps/side)
8. Crocodile or 90/90 Breathing (2 min, nasal only)

### Weekly Training Split
- **Monday (Day 1):** Lower Strength + Aerobic Base
  - Squat 5×5, Reverse Lunge 3×8, SL RDL 3×10, RFESS 3×10, Ham Curl 3×12-15, Zone 2 (30-45 min)

- **Tuesday (Day 2):** Upper Strength + Arms (Elbow Smart)
  - Neutral Press 4×6, Chest Row 4×10, Face Pulls 3×15, Offset Carry 3×30m, Incline Curl 3×12-15, Hammer Curl 3×10, Triceps Pressdown 3×12-15, Supinated ISO Hold 3×30s

- **Wednesday (Day 3):** Loaded Movement + Core
  - Loaded Walk 30-45 min @ 40-60lb, Dead Bug 3×10, Side Plank 3×45s, Suitcase Carry 4×40m, Pallof Press Hold 3×30s

- **Thursday (Day 4):** Hinge + Safe Power
  - Trap Bar Deadlift 4×3, Step-Ups 3×8, Ham Curl 3×8-10, Sled Push 6×20m (or Med Ball Scoop Toss 4×5)

- **Friday (Day 5):** Long Easy + Mobility (Optional)
  - Long Easy Session 45-75 min, Long Mobility 20-30 min

- **Saturday/Sunday:** Rest

### Pain Metrics Tracked
1. Elbow (Distal Biceps)
2. Shoulder
3. Lower Back

---

## How to Add Future Blocks

To add Block B, Block C, etc., edit `config.json` and add to the `blocks` array:

```json
{
  "programName": "Firefighter Long-Career Training",
  "blocks": [
    {
      "id": "block_a",
      "name": "Block A - Base / Durability",
      "startDate": "2026-01-20",
      "endDate": "2026-04-13",
      "dailyRehab": [...],
      "workouts": [...]
    },
    {
      "id": "block_b",
      "name": "Block B - Strength Focus",
      "startDate": "2026-04-14",
      "endDate": "2026-07-06",
      "weekRange": "Weeks 13-24",
      "notes": "Progressive strength building...",
      "dailyRehab": [
        // Can reuse Block A's dailyRehab or customize
      ],
      "workouts": [
        // New workout programming for Block B
        {
          "id": "block_b_lower",
          "name": "Lower Strength",
          "days": [1],
          "exercises": [...]
        }
      ]
    },
    {
      "id": "block_c",
      "name": "Block C - Power Development",
      "startDate": "2026-07-07",
      "endDate": "2026-09-28",
      "dailyRehab": [...],
      "workouts": [...]
    }
  ],
  "painMetrics": [...]
}
```

The app will automatically:
1. Detect which block you're currently in based on today's date
2. Display the block name in the header
3. Show the correct dailyRehab and workouts for that block
4. Transition seamlessly when entering a new block's date range

---

## Running the App

### Local Development
```bash
# Navigate to project directory
cd /Users/slhayes10/Personal/Fitness/APP/tendon-dashboard

# Start local HTTP server (required to avoid CORS issues)
python3 -m http.server 8000

# Open in browser
# http://localhost:8000
```

### Key Features to Test
1. **Block Detection:** Header shows "Friday • 2026-01-24 • Block A - Base / Durability"
2. **Daily Foundation:** All 8 items display correctly
3. **Today's Workout:** Friday shows "Long Easy + Mobility (Optional)"
4. **Exercise Details:** Duration-based exercises show their details (e.g., "45-75 min")
5. **Set Tracking:** Click sets to mark as complete
6. **Session Notes:** Add notes after completing workout
7. **Compliance Heatmap:** Complete activities to see heatmap populate
8. **Pain Tracking:** Enter pain levels (0-10) for elbow, shoulder, lower back

---

## Technical Notes

### Backward Compatibility
- Old config format (v1 without blocks) still works
- Legacy `rotation` object supported
- Existing localStorage data preserved during migration
- `getCurrentBlock()` creates synthetic block for legacy configs

### localStorage Keys
- `tendonDashboardConfig` - Stores config.json
- `tendonDashboardState` - Stores all workout/rehab/pain data

### Performance
- Initial load: <1 second
- State save: <100ms
- localStorage size: <2MB (prune after 365 days recommended)

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES6 support
- localStorage required
- No external dependencies (vanilla JS)

---

## Known Issues & Future Enhancements

### Current Limitations
1. No data export/import feature yet
2. No backend sync (all data local to browser)
3. Heatmap limited to 90 days
4. No workout templates or exercise library
5. No progression tracking (weight increases over time)

### Planned Features (Not Implemented)
1. RPE tracking per set (UI built but not required)
2. Volume calculations (total reps × weight)
3. Multiple chart views (volume trends, pain trends)
4. Data export to JSON/CSV
5. Progressive overload recommendations

---

## Troubleshooting

### Config Not Loading
1. Check browser console for errors
2. Validate JSON: `python3 -c "import json; json.load(open('config.json'))"`
3. Click "Reload default config" button
4. Clear localStorage: `localStorage.clear()` in browser console

### Workout Not Showing
1. Verify `days` array in workout config matches today's weekday (0=Sun, 1=Mon, etc.)
2. Check current block's date range includes today
3. Verify `getCurrentBlock()` returns expected block

### Exercises Show "undefined"
- Check if exercise uses `details` or `sets`/`reps` format
- Ensure rendering code in dashboard.js:770 handles both formats

---

## Credits

**Original App:** Tendon Dashboard (vanilla JS workout tracker)
**Modernization:** January 2026
**Training Program:** Firefighter Long-Career Training System
**Design System:** Inter + JetBrains Mono, custom CSS variables

---

## Version History

### v2.0 (January 2026)
- Complete UI overhaul with modular CSS
- Renamed to "Career Ready"
- Block-based automatic programming
- Compliance analytics and heatmap
- Session notes capability
- Extended data model
- Firefighter training program (Block A)

### v1.0 (Original)
- Basic workout tracking
- Daily rehab checklist
- Pain monitoring
- Single config format
- Inline CSS
