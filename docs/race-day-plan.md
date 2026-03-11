# Race Day Implementation Plan (DerbyNet-Inspired)

## Goals
- Register cars and racers with clear ownership and class/den separation.
- Generate heats that give each car a balanced lane rotation (every lane hit if possible).
- Enter results by win/loss (placement) with an optional time capture for tie-breaking.
- Keep the flow fast for race day: minimal clicks, obvious next action.
- Big font / legible screens, especially for heats and showing winners, these screens will be projected on a wall
- there are around 50 cars racing so around 100 people.

## Scope & Assumptions
- Build a lightweight DerbyNet-inspired flow inside this Bun app.
- Track a single event at a time (one pack/race day); expand later to multi-event.
- Support manual timer entry and/or automatic finish ordering; prioritize win/loss.
- Start with 4 lanes, but model lanes as a configurable count.

## Data Model (SQLite via bun:sqlite)
handle migrations with https://github.com/sequelize/umzug

- events
  - id, name, date, laneCount, status (draft|checkin|racing|complete)
- racers
  - id, eventId, firstName, lastName, den, rank, contact
- cars
  - id, eventId, racerId, carNumber, name, class, weightOk, inspectedAt
- heats
  - id, eventId, round, heatNumber, status (pending|running|complete)
- heat_lanes
  - id, heatId, laneNumber, carId
- results
  - id, heatId, laneNumber, carId, place (1..laneCount), timeMs (nullable)
- standings
  - carId, wins, losses, heatsRun, avgTimeMs, lastUpdated

## UI Flow Overview
1. Race Setup
   - Create event: name, date, lane count, format (round-robin lanes).
   - Define classes/dens and race order.
2. Registration + Check-in
   - Add racers and cars; assign car numbers and classes.
   - Inspection checklist (weight, size, wheel clearance).
   - Mark cars as checked-in and eligible.
3. Heat Generation
   - Generate balanced lane rotation by class/den.
   - Preview heat grid and allow manual edits.
4. Live Race Console
   - Run heat, record finish order (win/loss) and optional times.
   - Auto-advance to next heat; monitor lane coverage.
5. Results & Awards
   - Standings by wins/losses; tie-break with time.
   - Export results and print award sheets.

## Detailed Plan

### 1) Registration & Check-in
- Build a registration screen with:
  - Racer form (name, den, rank).
  - Car form (car number, name, class, racer assignment).
  - Inspection checklist (weight, size, wheels) with pass/fail.
- Add quick search by car number or racer name.
- Support bulk import (CSV) for faster pre-race data entry.
- Enforce uniqueness: car number per event, racer per car.
- Record `inspectedAt` and `weightOk` for audit trail.

### 2) Heat Scheduling (Lane Balance)
- Define scheduling rules:
  - Each car should run the same number of heats.
  - Each car should hit every lane if total heats allow.
  - Lane usage should be evenly distributed across the field.
- Algorithm approach (DerbyNet-inspired):
  - Use a round-robin rotation with lane offsets per heat.
  - If total cars <= laneCount, run multiple rounds to hit each lane.
  - If total cars > laneCount:
    - Create heats by rotating the car list and shifting lane assignments.
    - Track per-car lane counts and pick the lane with the lowest count.
  - Validate distribution after scheduling; flag any car missing a lane.
- Provide a heat preview grid with warnings:
  - Missing lane coverage.
  - Duplicated lane pairings too often.
  - Heat count mismatch.

### 3) Race Console (Live Entry)
- Heat queue panel: upcoming heats with lane assignments.
- Active heat panel:
  - Display current heat number and lane/car list.
  - Capture finish order (1..laneCount) via tap/keyboard.
  - Optional time entry per lane if timer available.
- Result validation:
  - Require a unique place per lane.
  - If a car did not finish, allow DNF with auto-loss.
- Save results and advance to next heat.

### 4) Win/Loss & Standings
- Win/loss calculation:
  - For each heat, the lowest place gets a win; others get losses.
  - For tie results, use timeMs if available; otherwise shared place.
  - Update standings incrementally after each heat.
- Standings display:
  - Rank by wins desc, losses asc, then avg time asc.
  - Filter by class/den.
  - **Future:** Switch to points-per-place scoring (4/3/2/1) instead of win/loss.
    Current W/L system treats 2nd and 4th place identically as "loss."
    Points-per-place is the industry standard for multi-lane derbies.
    See `docs/notes/standings-ranking-research.md` for full analysis.
- Add a "Heat Coverage" view:
  - For each car: lane counts, heats run, upcoming lane needs.

### 6) Race Day Admin Checklist
- Pre-race day
  - Import roster, pre-assign car numbers.
  - Run a test schedule and verify lane coverage.
  - Confirm timer integration or manual entry flow.
- Race day
  - Check-in cars, run inspection.
  - Lock registration, generate heats.
  - Run heats, record finish order, monitor coverage.
- Post-race
  - Export standings and award winners.
  - Archive event data.

## Setup & Configuration Locking

The setup/config page should make it obvious what can be changed at each phase
and what gets locked in. Settings are grouped into tiers that lock at key milestones.

### Phase 1: Setup (status = draft)
Everything is editable. This is the pre-event planning phase.

| Setting | Editable? | Notes |
|---------|-----------|-------|
| Event name & date | Yes | Cosmetic, never locks |
| Lane count | Yes | Can change freely before heats exist |
| Add/remove racers | Yes | — |
| Edit racer info | Yes | Name, den, car number |
| Inspection (pass/fail) | Yes | Only inspected racers enter heats |
| Race format (rounds, lookahead) | Yes | Chosen at heat generation time |

### Phase 2: Racing (status = racing)
Triggered when heats are first generated. Race-critical config is locked.

| Setting | Editable? | Notes |
|---------|-----------|-------|
| Event name & date | Yes | Still cosmetic |
| Lane count | **Locked** | Heats are built around this |
| Add racers | **Locked** | New racers can't join mid-race |
| Remove racers | **Locked** | Would break heat lane references |
| Edit racer name/den | Yes | Cosmetic only |
| Inspection | **Locked** | Roster is fixed |
| Race format | **Locked** | Rounds/lookahead already committed |
| Record results | Yes | Core activity of this phase |

### Phase 3: Complete (status = complete)
Everything is frozen. Certificates available.

| Setting | Editable? | Notes |
|---------|-----------|-------|
| Event name & date | Yes | May still need correction |
| All race config | **Locked** | — |
| Results | **Locked** | Final standings are official |
| Certificates | Available | Gated on complete status |

### Future: Check-in phase (status = checkin)
The `checkin` status exists in the schema but isn't used yet. It could serve as
an intermediate phase between setup and racing — signaling that volunteers should
start weighing cars, but still allowing late registrations. Config locking would
be the same as draft (nothing locked yet) but the UI would shift focus to the
inspection workflow.

### Setup page UX
The Race Format / Setup page should visually communicate these tiers:
- Show current phase prominently
- Gray out / disable controls that are locked for the current phase
- Explain *why* something is locked ("Lane count is fixed once heats are generated")
- Offer an "undo" path where safe (e.g., clearing all heats returns to draft)

## Acceptance Criteria
- Registration lets staff add/edit racers and cars in under 30 seconds each.
- Heat generator ensures every car runs each lane when mathematically possible.
- Live console supports full race with only win/loss entry, no times required.
- Standings update within one second of recording a heat.
