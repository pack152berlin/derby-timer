# Multi-Year Results & History

## Problem

Every year the derby is a fresh start. There's no way to look back and say "You've improved your average time by 0.3 seconds since last year!" or "This is your 3rd derby — you're a veteran!"

## Goal

Track racer participation across years. Show improvement trends, all-time records, and returning racer recognition.

## Data Model Changes

The current model ties racers to a single event. To support multi-year:

### Option A: Racer Identity Table (Recommended)

```sql
-- New table: persistent racer identity across events
CREATE TABLE racer_identities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,           -- canonical name
  den TEXT,                     -- current den (updates each year)
  first_event_id TEXT,          -- when they first raced
  created_at TEXT DEFAULT (datetime('now'))
);

-- Add to existing racers table:
ALTER TABLE racers ADD COLUMN identity_id TEXT REFERENCES racer_identities(id);
```

When registering a racer, the app suggests matches from previous years: "Is this the same Dean Kim who raced in 2025?"

### Option B: Name Matching (Simpler, Less Reliable)

Match by name across events. Works for small packs but breaks with common names or spelling variations.

**Recommendation**: Start with Option A. The identity table is simple and explicit.

## Features

### Returning Racer Recognition
- During registration: "Welcome back! This is Dean's 3rd Pinewood Derby!"
- On certificates: "3-Year Derby Veteran"
- On the display page: veteran badge next to returning racers

### Personal History on Racer Profile
- List of past events with results
- Best-ever finish (overall and den)
- Time trend chart (if times were captured)
- "Personal best" callout when they beat their record

### All-Time Records
- Fastest time ever recorded (by event, overall)
- Most wins in a single event
- Most heats raced career total
- Pack Hall of Fame page

### Year-Over-Year Comparison
- Average time this year vs last year
- Win rate improvement
- "Most improved racer" award candidate

## UI Additions

### Racer Profile (Enhanced)
```
┌─────────────────────────────────────────┐
│ Dean Kim — Wolves Den                    │
│ 🏆 3-Year Veteran                       │
│                                          │
│ This Year: 2nd Place Overall, 8W-4L      │
│ Last Year: 5th Place Overall, 6W-6L      │
│ Career:    3 Events, 22W-14L             │
│                                          │
│ Personal Best: 3.001s (2026)             │
│ Average Time:  3.15s → 3.08s (improving!)│
└─────────────────────────────────────────┘
```

### Hall of Fame Page
- `/hall-of-fame` — all-time records and notable achievements
- Projector-friendly for display during the event
- Celebrate returning racers and pack history

## Migration Strategy

- Existing single-event data stays untouched
- `racer_identities` table is created on first multi-year use
- Volunteer can manually link past racers during registration
- No automatic linking — too error-prone for kids with similar names

## Open Questions

- How to handle racers who change dens year to year? (They age up through ranks)
  - Identity table stores current den; past events keep the den they had at the time
- Should we allow merging two identity records if a duplicate was created?
  - Yes, with a simple "merge" action in settings
- What's the minimum data needed from past events if times weren't captured?
  - Win/loss record and placement are sufficient. Times are a bonus.
