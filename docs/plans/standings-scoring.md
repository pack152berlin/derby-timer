# Standings & Ranking Research

## Current System

```sql
ORDER BY s.wins DESC, s.losses ASC, s.avg_time_ms ASC NULLS LAST
```

- 1st place = win, everything else = loss
- Two racers with identical W/L records are treated the same regardless of whether losses were 2nd or 4th place finishes
- Elimination logic adds two more tiebreakers: heats_run DESC, car_number ASC (not reflected in DB query)

### Problem

Racer A: 5W, three 2nd-place losses
Racer B: 5W, three 4th-place losses

Current system: **tied** (both 5W-3L until avg_time breaks it)
Points system: Racer A = 29pts, Racer B = 23pts — **Racer A clearly higher**

## Industry Standard: Points-Per-Place

Most organized pinewood derby events use points-per-place scoring:

| Place | Points |
|-------|--------|
| 1st | 4 |
| 2nd | 3 |
| 3rd | 2 |
| 4th | 1 |
| DNF | 0 |

Rank by: `total_points DESC, avg_time_ms ASC NULLS LAST`

### Why this is better
1. **Granularity** — 2nd place is meaningfully better than 4th
2. **Simplicity** — "more points = better" is easy for parents/kids
3. **Equivalent to F1 countback** in most cases (most wins, then most 2nds, etc.)
4. **Time as tiebreak only** — avoids penalizing racers who drew slower lanes

### What popular software does
- **GrandPrix Race Manager (GPRM)**: Points scoring with configurable values, tiebreakers include head-to-head, most victories, best cumulative results, single fastest time
- **DerbyNet**: Real-time standings with full tie support
- **Derby Day!**: Golf-style scoring (low points wins), elimination at point threshold
- **Slot car clubs**: F1-style scales (25/20/18/15/...)

### Variant scales
- Standard: 4/3/2/1 (high-points) or 1/2/3/4 (golf, low wins)
- Weighted: 7-5-3-1 (widens gap for 1st)
- Compressed: 30-28-26-24 (tighter gaps)

## Recommended Change

Switch from win/loss to points-per-place. Two implementation options:

### Option A: Add `total_points` to standings table
Simple, but less flexible if we want to change point weights later.

### Option B: Store per-place counts
Add `place_1_count`, `place_2_count`, `place_3_count`, `place_4_count` to standings.
Compute `total_points = 4*p1 + 3*p2 + 2*p3 + 1*p4`.
Gives both the points total AND countback detail for the UI.

### DB query change
```sql
ORDER BY total_points DESC, avg_time_ms ASC NULLS LAST
```

### Elimination sort change
```typescript
// Current:  wins DESC, losses ASC, avg_time ASC, heats_run DESC, car_number ASC
// Proposed: total_points DESC, wins DESC, avg_time ASC, heats_run DESC, car_number ASC
```

## Also Fix: DB vs Elimination Sort Mismatch

The DB standings query uses 3 tiebreakers but the elimination sort uses 5.
These should be aligned so the public standings page matches elimination cuts.

## Status

**Not yet implemented.** This is a future work item. Current W/L system works
but is less fair than points-per-place for multi-lane racing.
