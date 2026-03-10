# Heat Scheduling — Algorithms, Configuration & Time Estimation

> **See also**: [Race Day 2026 Post-Mortem](./race-day-2026-analysis.md) — analysis of our first real event (43 cars, 74 heats, too long).

## Current Implementation

### What We Have Today

The current planner (`src/race/heat-planner.ts`) uses an **adaptive greedy algorithm** with a rolling queue:

1. **Rolling queue** — only 2–3 heats are generated ahead ("lookahead"). As heats complete, new ones are planned using updated standings. This lets late results influence upcoming matchups.

2. **Lane balancing** — each racer's goal is to run in every lane `rounds` times (default: 1 round = every lane once). The planner tracks per-racer lane counts and prioritizes racers/lanes with the highest unmet need.

3. **Participant selection** — for each heat, a "seed racer" (most urgent need) is chosen, then companions are selected by scoring:
   - Lane coverage need (strong preference for racers who need the selected lanes)
   - Repeated matchup penalty (avoid pairing the same racers repeatedly)
   - Performance proximity (group racers with similar win rates together)
   - Total assignments balance (don't over-schedule any racer)

4. **Lane assignment** — once participants are chosen, lanes are assigned via branch-and-bound search minimizing: lane-need penalties, historical lane repeats, and global lane usage imbalance.

5. **Elimination rounds** — after all racers complete a full lane cycle, the field is cut to ~half (rounded up). Survivors are ranked by: wins DESC → losses ASC → avg time ASC → heats run DESC → car number ASC. This repeats until 2 finalists remain.

### Strengths
- Adaptive: uses current standings to influence matchups
- Fair lane coverage: every car hits every lane
- Elimination narrows the field, keeping event duration manageable
- Rolling queue means the full schedule isn't locked in — flexible

### Weaknesses
- Not a known optimal schedule (like Perfect-N) — no mathematical guarantee of head-to-head balance
- Greedy heuristic may produce suboptimal pairings compared to pre-computed charts
- No configurability — the algorithm is fixed, no user choice of strategy
- No time estimation — volunteers can't predict when the event will end
- **Factory Line Feel** — The focus on efficiency can make the event feel monotonous and "over-optimized" for throughput rather than fun.
- The early test file (`tests/heat-generation.test.ts`) tests a *different* inline algorithm, not the actual `heat-planner.ts`

### Scoring Model Today

Standings are **placement-based**: 1st place = win, everything else = loss. Times (`time_ms`) are optional — stored when hardware provides them, used only as a 3rd tiebreaker in standings: `wins DESC → losses ASC → avg_time_ms ASC`.

This means two very different cars can have identical win/loss records even though one is consistently 0.5 seconds faster. Times exist in the data model but don't meaningfully affect outcomes.

---

## Event Pacing & Experience

### Optimizing for Fun
Lessons from 2026 show that a high heat cadence (e.g., 47s) is efficient but can feel like a "chore" for volunteers and participants. The system should allow for **intentional pacing**:
- **Commentary Buffers**: Add a configurable delay or "wait for operator" state between heats to allow for MC commentary, cheers, and "hero moments" for the kids.
- **Atmosphere over Throughput**: For large fields, prioritize a format that keeps everyone involved longer (no early cuts) even if it means fewer heats per car.

### Start-Time Awareness
The system should track the "Scheduled Start" vs. "Actual First Heat".
- **Late Start Warning**: If registration/inspection runs long (e.g., more than 30 mins past scheduled start), surface a warning and suggest a shorter race format (like "Quick" mode) to ensure the event ends on time.
- **Registration stations**: Plan for high-capacity check-in (4+ stations) to prevent start delays.

---

## Scheduling Approaches in the Derby World

### 1. Perfect-N (Pre-Computed Chart)

The gold standard. A pre-computed chart where:
- Every car races in each lane the **exact same number of times**
- Every car races against every other car the **exact same number of times**
- Heat assignments are evenly distributed through the event

**Constraints**: Only works for specific car/lane combinations. For 4 lanes, Perfect-N charts exist for car counts like 4, 8, 13 — but not all numbers. Pioneered by Stan Pope and Bill Young.

**Pros**: Mathematically provably fair. Zero lane bias. Zero matchup bias.
**Cons**: Rigid — can't adapt to race results. Not all car counts are supported. Must be pre-computed.

*Sources: [stanpope.net](https://stanpope.net/ppngen.html), [Scouting Magazine](https://scoutingmagazine.org/2015/11/scheduling-strategies-transform-packs-next-pinewood-derby/)*

### 2. Partial Perfect-N (PPN)

A relaxation of Perfect-N that works for nearly all car/lane combinations:
- Each car races in each lane the same number of times ✓
- Head-to-head matchup counts differ by **at most 1** (not exactly equal)

Unsupported edge cases exist (e.g., 5 lanes + 20 cars) but can be worked around with byes.

**Pros**: Works for almost any field size. Still very fair. Pre-computed = fast.
**Cons**: Still rigid (no adaptation to results). Slightly less fair than Perfect-N on matchups.

*Sources: [stanpope.net PPN Generator](https://stanpope.net/ppngen.html)*

### 3. Lane Rotation (Simple Round-Robin)

Cars rotate through lanes sequentially. Each car runs in every lane once.
Points scored per heat (1st = 1 point, 2nd = 2, etc.), lowest total wins.

**Pros**: Dead simple to understand and implement. Every car races the same amount.
**Cons**: No control over who races whom. Some cars may face the fastest competitors disproportionately. Back-to-back racing for some cars.

*Sources: [Scouting Magazine](https://scoutingmagazine.org/2015/11/scheduling-strategies-transform-packs-next-pinewood-derby/)*

### 4. Adaptive Greedy (Current DerbyTimer)

Our current approach. See "What We Have Today" above.

**Pros**: Adapts to results. Flexible field size. Built-in elimination. Rolling queue.
**Cons**: No mathematical fairness guarantee. Hard to predict total duration.

### 5. Double Elimination (Bracket)

Traditional bracket — lose twice and you're out.

**Pros**: Exciting, familiar format. Shortest total time. Clear progression.
**Cons**: Most kids only race 2–3 times. Many eliminated early → bored spectators. No lane balancing. Requires a timing system or subjective judging.

*Sources: [Scouting Magazine](https://scoutingmagazine.org/2015/11/scheduling-strategies-transform-packs-next-pinewood-derby/)*

### 6. Stearns Method

Pre-selection round using a structured schedule to narrow a large field to 7–13 finalists, then Perfect-N for the final round. Good for 30+ car events.

**Pros**: Handles large fields efficiently. Final round is provably fair.
**Cons**: Two-phase adds complexity. Early rounds are less fair.

*Sources: [stanpope.net](https://stanpope.net/pwraces.html)*

---

## Comparison Matrix

### Scheduling Methods

| Method | Lane Fairness | Matchup Fairness | Adapts to Results | Works for Any Field Size | Total Heats (50 cars, 4 lanes) | Complexity |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Perfect-N | Perfect | Perfect | No | Limited sizes | 50 | Pre-computed |
| Partial Perfect-N | Perfect | Near-perfect | No | Nearly all | 50 | Pre-computed |
| Lane Rotation | Perfect | Random | No | Yes | 50 | Simple |
| Adaptive Greedy (ours) | Good | Good | Yes | Yes | ~50 + elimination | Medium |
| Double Elimination | None | None | By design | Yes | ~26–30 | Simple |
| Stearns + Perfect-N | Perfect (finals) | Mixed | No | Yes | ~60–70 | Two-phase |

### Scoring × Scheduling Interactions

Not all scoring modes pair equally well with all scheduling modes:

| Scoring Mode | Best Scheduling Pairing | Why |
|---|---|---|
| Placement (win/loss) | Adaptive Greedy or Bracket | Matchups matter — who you race against determines your record. Adaptive grouping by skill level makes this fairer. |
| Points (place-based) | Chart (PPN) or Lane Rotation | Points accumulate fairly when every car races equal heats. Pre-computed schedules guarantee this. |
| Time (average) | Any — matchups irrelevant | Since you're racing the clock, scheduling only needs to ensure equal heat counts. Lane coverage still matters for handicap fairness. |
| Handicapped Time | Chart (PPN) recommended | Handicaps correct for lane bias, but only if every car has run enough lanes for the correction to be meaningful. PPN guarantees equal lane exposure. |

---

## Proposed Configurable Scheduling

### User-Facing Options

When generating heats, volunteers choose a **scheduling mode** via the existing Race Format page:

#### Mode 1: "Balanced" (Default — Current Behavior, Enhanced)
Our adaptive greedy algorithm. Good default for most packs.

- **Config**: Rounds per cycle (default 1 = every lane once)
- **Config**: Finals format:
  - **None** (default for 20+ cars) — one lane cycle, standings are final
  - **Championship heat** — top 4 do a quick runoff after the main round
  - **Full elimination** — current behavior, halving the field each round (best for < 20 cars)
- **Config**: Lookahead (2 or 3 heats visible ahead)
- **Best for**: Packs wanting a fair, adaptive race with manageable duration
- **Lesson from 2026**: With 43 cars, full elimination produced 74 heats (~74 min). Single round + championship heat would have been ~53 heats (~53 min).

#### Mode 2: "Chart" (Perfect-N / Partial Perfect-N)
Pre-computed schedule. Every car races every lane exactly N times. No elimination — all cars race the full schedule, final standings decided by cumulative record.

- **Config**: Rounds (1–3, i.e., race each lane 1–3 times)
- **Behavior**: Entire schedule is generated upfront (no rolling queue)
- **Best for**: Packs wanting provably fair, fully predictable schedules
- **Implementation**: Port PPN chart generation or embed pre-computed tables for common car/lane combos (4–6 lanes, 4–60 cars)

#### Mode 3: "Quick" (Reduced Schedule)
Same adaptive algorithm but with a target heat count instead of full lane coverage. Each car races a fixed number of times (e.g., 3 heats regardless of lane count), then standings decide winners.

- **Config**: Heats per car (default 3)
- **Behavior**: Trades fairness for speed. Not every car will hit every lane.
- **Best for**: Large packs (40+ cars) that need to finish in under an hour, or events with time constraints

#### Mode 4: "Bracket" (Double Elimination)
Classic bracket format. Lose twice, you're out.

- **Config**: None needed
- **Behavior**: System generates matchups round by round
- **Best for**: Small fields (< 16 cars), exhibition events, time-crunched events

### Configuration UI

Add to the existing Race Format page (`RaceFormatView.tsx`):

```
┌─────────────────────────────────────────────┐
│ Scheduling Mode                              │
│ ┌─────────┐ ┌─────────┐ ┌───────┐ ┌───────┐│
│ │Balanced │ │ Chart   │ │ Quick │ │Bracket││
│ │(Default)│ │         │ │       │ │       ││
│ └─────────┘ └─────────┘ └───────┘ └───────┘│
│                                              │
│ Estimated Duration: ~45 min                  │
│ Total Heats: ~50                             │
│ Heats per Car: 4                             │
│ ████████████░░░░░░░░░░░░░░ 38% complete      │
└─────────────────────────────────────────────┘
```

---

## Time Estimation & Progress Bar

### Time-per-Heat Model

Derby heat turnaround varies by crew efficiency:

| Pace | Time per Heat | Description |
|------|:---:|---|
| Relaxed | 90s | First-time crew, lots of chatter |
| Normal | 60s | Typical volunteer crew |
| Fast | 45s | Experienced crew, smooth staging |
| Expert | 30s | Electronic timer, rehearsed volunteers |

### Estimation Formula

```
totalHeats = f(cars, lanes, mode, rounds)
estimatedMinutes = totalHeats × secondsPerHeat / 60
```

For each mode:
- **Balanced**: `totalHeats ≈ ceil(cars × lanes / lanes) × eliminationRounds` — sum of heats across elimination stages
- **Chart (PPN)**: `totalHeats = ceil(cars / lanes) × lanes × rounds`  (exact, since the full schedule is pre-computed)
- **Quick**: `totalHeats = ceil(cars × heatsPerCar / lanes)`
- **Bracket**: `totalHeats ≈ 2 × cars - 1` (double elimination)

### Live Progress Bar

Once racing begins, show a progress bar on the Heat Schedule and Race Control views:

```ts
interface RaceProgress {
  completedHeats: number;
  totalHeats: number;           // known or estimated
  avgSecondsPerHeat: number;    // rolling average of actual heats
  estimatedMinutesRemaining: number;
  percentComplete: number;
}
```

- **Before first heat**: use the configured pace assumption (default: 60s)
- **After 3+ heats**: switch to rolling average of actual elapsed time per heat
- **Display**: `████████░░░░░░░ 12/50 heats · ~38 min remaining`
- **For adaptive modes** where total heats aren't fully known: estimate based on remaining racers needing runs + elimination projections

### API Addition

```
GET /api/events/:eventId/progress
→ { completedHeats, totalHeats, avgSecondsPerHeat, estimatedMinutesRemaining, percentComplete }
```

`totalHeats` is exact for Chart mode and estimated for adaptive modes (based on current field size and remaining lane needs).

---

## Scoring Modes — When You Have Times

When electronic timing is available, times open up fundamentally different (and fairer) ways to determine winners. The scoring mode should be configurable per event.

### Mode A: Placement-Based (Current Default)

Each heat produces a winner (1st place) and losers (everyone else). Standings rank by win count. Times are a tiebreaker only.

```
Heat result:  Lane 1: 3.001s (1st)  Lane 2: 3.047s (2nd)  Lane 3: 3.128s (3rd)  Lane 4: 3.241s (4th)
Scoring:      Lane 1: WIN           Lane 2: LOSS           Lane 3: LOSS           Lane 4: LOSS
```

**Pros**: Simple, no timer required, works with manual judging
**Cons**: A 3.002s car and a 3.999s car both get "LOSS" — no credit for being close. Who you race against matters more than how fast you are.

### Mode B: Points-Based (Place Points)

Award points per finish position. Lower is better (golf scoring). Common in lane-rotation events.

```
Heat result:  Lane 1: 3.001s (1st)  Lane 2: 3.047s (2nd)  Lane 3: 3.128s (3rd)  Lane 4: 3.241s (4th)
Scoring:      Lane 1: 1 pt          Lane 2: 2 pts          Lane 3: 3 pts          Lane 4: 4 pts
```

Standings: total points, lowest wins. Ties broken by average time.

**Pros**: Second place means something. Still works without times (just placement order).
**Cons**: Still doesn't capture *how much* faster — a 0.001s margin and a 1.000s margin both give the same point gap.

### Mode C: Time-Based (Best/Average Time)

Standings ranked purely by cumulative or average finish time. Placement within a heat doesn't matter — only the clock.

```
Heat result:  Lane 1: 3.001s  Lane 2: 3.047s  Lane 3: 3.128s  Lane 4: 3.241s
Scoring:      Each car's time added to their running total/average
```

Standings: average time across all heats, lowest wins.

**Pros**: Most objective — the fastest car wins regardless of matchups. Who you race against is irrelevant. Eliminates the "unlucky bracket" problem.
**Cons**: **Requires electronic timing** — can't do this with manual judging. Lane bias matters more (some lanes are consistently faster). Less exciting for spectators (no "winners" per heat).

### Mode D: Handicapped Time (Time-Based + Lane Correction)

Same as time-based, but each car's raw time is adjusted by a per-lane handicap to correct for lane bias.

```
Lane handicaps:  Lane 1: +0.000s  Lane 2: +0.012s  Lane 3: -0.008s  Lane 4: +0.021s
Raw time:        Lane 1: 3.001s   Lane 2: 3.047s    Lane 3: 3.128s   Lane 4: 3.241s
Adjusted time:   Lane 1: 3.001s   Lane 2: 3.035s    Lane 3: 3.136s   Lane 4: 3.220s
```

Standings: average *adjusted* time, lowest wins.

**Pros**: The fairest possible scoring. Neutralizes track imperfections. Makes every heat directly comparable.
**Cons**: Requires calibration (see Lane Handicapping below). More complex to explain to parents. Requires electronic timing.

### Recommended Default

- **No timer**: Mode A (placement) — it's all you can do
- **With timer**: Mode C (time-based) — fairer than placement, simpler than handicapped
- **With timer + calibration**: Mode D (handicapped time) — maximum fairness

The scoring mode selector appears on the Race Format page alongside the scheduling mode selector.

### Data Model Changes for Scoring Modes

```sql
-- Add to events or planning_state:
scoring_mode TEXT DEFAULT 'placement'  -- 'placement' | 'points' | 'time' | 'handicapped_time'

-- Add to standings (new columns):
total_points INTEGER,        -- for points-based mode
adjusted_avg_time_ms REAL,   -- for handicapped mode
best_time_ms REAL,           -- useful across all modes
```

The `recalculateStandingsForRacer()` method in `results.ts` would branch on `scoring_mode` to compute the appropriate ranking fields. The standings query `ORDER BY` clause changes per mode:

| Mode | ORDER BY |
|------|----------|
| Placement | `wins DESC, losses ASC, avg_time_ms ASC` |
| Points | `total_points ASC, avg_time_ms ASC` |
| Time | `avg_time_ms ASC` |
| Handicapped | `adjusted_avg_time_ms ASC` |

---

## Lane Handicapping

### The Problem

No track is perfectly level or symmetrical. Lane 3 might be 0.015s faster than Lane 1 due to slight tilt, rail friction, or guide wire tension. Over many heats, this systematic bias accumulates and can change the outcome.

Perfect-N scheduling mitigates this by ensuring every car races every lane equally — but it doesn't *eliminate* the bias from each individual time measurement. If you're doing time-based scoring, lane bias directly corrupts results.

### Calibration Process

Run a **calibration set** before the event (or use the first few heats of the event itself):

#### Option 1: Dedicated Calibration Runs (Recommended)

Use 1–3 "calibration cars" (consistent, fast cars that a volunteer can re-stage quickly). Each calibration car runs every lane 2–3 times.

```
Calibration car A:
  Lane 1: 3.012s, 3.015s, 3.010s  → avg 3.012s
  Lane 2: 3.025s, 3.028s, 3.022s  → avg 3.025s
  Lane 3: 3.005s, 3.008s, 3.003s  → avg 3.005s
  Lane 4: 3.030s, 3.033s, 3.028s  → avg 3.030s

Track baseline (average of all lanes): 3.018s

Lane handicaps (offset from baseline):
  Lane 1: +0.006s (slightly slow)
  Lane 2: -0.007s (slightly fast → add time to compensate)
  Lane 3: +0.013s (fastest lane → biggest correction)
  Lane 4: -0.012s (slowest lane)
```

Wait — correction direction: if Lane 3 is the fastest, cars in Lane 3 have an advantage. To neutralize: **subtract** the lane's advantage from each raw time, so a car in the fast lane gets a slightly *higher* adjusted time.

Corrected formula: `adjusted_time = raw_time - lane_offset` where `lane_offset = lane_avg - track_avg`. A negative offset (slow lane) means we subtract a negative number (adding time back), a positive offset (fast lane) means we subtract time (penalizing the advantage).

Actually simpler: `adjusted_time = raw_time + handicap` where `handicap = track_avg - lane_avg`. Fast lanes get a positive handicap (penalty), slow lanes get a negative handicap (bonus).

#### Option 2: Auto-Calibrate from Race Data

After N heats (e.g., 10+), compute lane averages from all recorded times. Since many different cars race in each lane, the averages converge toward the lane's true speed characteristic.

```
After 20 heats:
  Lane 1 avg across all cars: 3.145s (82 runs)
  Lane 2 avg across all cars: 3.158s (80 runs)
  Lane 3 avg across all cars: 3.138s (81 runs)
  Lane 4 avg across all cars: 3.162s (83 runs)

Track baseline: 3.151s

Auto-derived handicaps:
  Lane 1: +0.006s
  Lane 2: -0.007s
  Lane 3: +0.013s
  Lane 4: -0.011s
```

This is less accurate early on (small sample) but requires zero extra setup. Can be recalculated continuously as more data comes in.

### Data Model

```sql
-- New table
CREATE TABLE lane_handicaps (
  event_id TEXT NOT NULL,
  lane_number INTEGER NOT NULL,
  handicap_ms REAL NOT NULL DEFAULT 0,  -- added to raw_time
  sample_count INTEGER DEFAULT 0,        -- how many runs this is based on
  source TEXT DEFAULT 'manual',          -- 'manual' | 'calibration' | 'auto'
  updated_at TEXT,
  PRIMARY KEY (event_id, lane_number)
);
```

### API

```
GET  /api/events/:eventId/lane-handicaps
POST /api/events/:eventId/lane-handicaps          — set manually or from calibration
POST /api/events/:eventId/lane-handicaps/auto      — recalculate from race data
POST /api/events/:eventId/lane-handicaps/calibrate — run calibration mode
```

### UI: Calibration Page

Accessible from Settings or Race Format:

```
┌─────────────────────────────────────────────┐
│ Lane Calibration                             │
│                                              │
│ Lane 1:  +0.006s  ██████░░  (12 samples)    │
│ Lane 2:  -0.007s  ███████░  (11 samples)    │
│ Lane 3:  +0.013s  █████████ (13 samples)    │
│ Lane 4:  -0.011s  ███████░░ (10 samples)    │
│                                              │
│ Source: Auto-calibrated from 20 heats        │
│                                              │
│ [Recalculate]  [Reset to Zero]  [Manual Edit]│
└─────────────────────────────────────────────┘
```

### How Handicaps Affect Results Display

When handicapped scoring is active:
- Race Control shows both **raw time** and **adjusted time** per lane
- Standings show **adjusted average** as the primary sort
- Individual heat results show the handicap applied: `3.047s → 3.040s (−0.007)`
- Certificate stats use adjusted times

---

## Implementation Plan

### Phase 1: Document & Stabilize Current Algorithm
1. Align test file (`heat-generation.test.ts`) with actual `heat-planner.ts` exports
2. Add property-based tests: lane coverage, no duplicate racers per heat, balanced assignments
3. Add time estimation API endpoint using current adaptive mode

### Phase 2: Progress Bar & Time Estimation
1. Track `started_at` / `completed_at` per heat for actual pacing data
2. Implement `GET /api/events/:eventId/progress`
3. Add progress bar to HeatsView and RaceConsoleView
4. Show estimated duration on the generate-heats confirmation dialog

### Phase 3: Scoring Mode Selection
1. Add `scoring_mode` to events or planning_state table
2. Branch `recalculateStandingsForRacer()` by scoring mode
3. Update standings query ORDER BY per mode
4. Add scoring mode selector to RaceFormatView
5. Show scoring-mode-appropriate columns in standings display

### Phase 4: Lane Handicapping
1. Create `lane_handicaps` table and migration
2. Implement auto-calibration from race data (after 10+ heats)
3. Implement manual calibration UI
4. Wire handicaps into adjusted time calculation in standings
5. Show raw + adjusted times in Race Control when handicaps are active

### Phase 5: Scheduling Mode Selection
1. Add `scheduling_mode` column to events or planning_state table
2. Update RaceFormatView with mode selector and per-mode config
3. Implement "Quick" mode (simplest new mode — just cap heats per car)
4. Pass mode config through generate-heats API

### Phase 6: Chart Mode (PPN)
1. Implement PPN chart generator (or embed pre-computed tables for 4-lane, 4–60 cars)
2. Generate full schedule upfront (no rolling queue)
3. Show full schedule preview before starting

### Phase 7: Bracket Mode
1. Implement double-elimination bracket generator
2. Bracket visualization UI
3. Auto-advance after each round

---

## Open Questions

- Should Chart mode allow mid-race additions (late registrations)?
  - **Lean no** — PPN charts are pre-computed. Late additions would require regeneration and voiding previous results. Show a warning instead.
- Should we support the Stearns method as a separate mode?
  - **Defer** — it's a two-phase approach (Stearns → Perfect-N finals). Complex to implement. The "Balanced" mode with elimination achieves a similar outcome.
- How to handle uneven car counts in Chart mode?
  - Use byes (empty lane) when car count doesn't divide evenly into lanes. The PPN algorithm handles this.
- Should the time estimate account for breaks?
  - Show raw racing time. Volunteers know their own break schedule. Optionally add a "break buffer" config later.
- Should handicaps recalculate continuously or lock after calibration?
  - **Lean toward lock after calibration** — auto-recalculating mid-event could shift standings retroactively, which feels unfair. Show a "recalibrate" button the volunteer can press manually between rounds.
- Should we retroactively adjust old results when handicaps are set or updated?
  - **Yes** — recompute all adjusted times from raw times + current handicaps. Raw times are never modified.
- Can time-based scoring work with elimination rounds?
  - Yes, but the elimination cut should use adjusted average time instead of wins/losses. This is actually simpler — just sort by time and cut the bottom half.
- What if only some heats have times (mixed manual/electronic)?
  - Fall back to placement scoring for heats without times. Or: require all heats to have times for time-based modes — show a warning if a heat is submitted without times in time/handicapped mode.
