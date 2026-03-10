# Car Voting — People's Choice Awards

## Background

After racing at the 2026 derby, cars were displayed and kids/families voted on favorites using paper ballots. The results weren't captured digitally, so they couldn't appear on certificates.

## Goal

Replace paper ballots with phone-based voting. Families scan a QR code, vote on their phone, results display live on the projector, and winners are stored so certificates can include the award.

## Voting Categories

Categories are chosen during the setup wizard (Step 3b) from a preset list, or typed in custom. Whatever is selected becomes the active award categories for the event.

**Built-in presets:**

| Award | Notes |
|-------|-------|
| Most Creative Car | Most commonly used — on by default |
| Best Paint Job | |
| Funniest Car | |
| Most Aerodynamic (looks) | |
| Most Scout-Like | |
| Most Colorful | |
| Best Name | |
| Pack Spirit Award | |

Custom awards can be added in setup or later from the Settings page before voting opens. Categories can't be changed once voting has started.

Each voter picks one car per category. A racer can win multiple categories.

## Flow

### For Families (Phone)

1. Projector shows a QR code: `http://derby.local/vote`
2. Family opens the page — sees a grid of car photos with racer names
3. Taps their favorite — one vote per device per category
4. Confirmation: "Vote counted for Dean Kim!"
5. Can change vote until voting closes

### For the MC / Admin

1. Opens `/vote/admin` — sees live vote counts per car, per category
2. When ready, clicks "Close Voting" — locks results
3. Winners are announced, stored in the database
4. Certificates for winners automatically include the award badge

### On the Projector

During the voting window, `/display` shows a live leaderboard:

```
┌─────────────────────────────────────────┐
│  🏆 Most Creative — Live Votes          │
│                                          │
│  1. Dean Kim          ████████  14 votes │
│  2. Klara Kny-Flores  █████     9 votes  │
│  3. Flora Kny-Flores  ███       6 votes  │
│  ...                                     │
│                                          │
│  Scan to vote →  [QR code]              │
└─────────────────────────────────────────┘
```

Live updates via WebSocket — vote counts tick up in real time as families vote.

## Data Model

```sql
-- Award categories defined per event
CREATE TABLE award_categories (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,          -- "Most Creative", "Best Paint Job"
  voting_open INTEGER DEFAULT 1,
  created_at TEXT
);

-- One row per vote (device-based deduplication)
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES award_categories(id),
  racer_id TEXT NOT NULL REFERENCES racers(id),
  device_token TEXT NOT NULL,  -- fingerprint stored in localStorage
  created_at TEXT,
  UNIQUE(category_id, device_token)  -- one vote per device per category
);

-- Winners (set when voting closes)
CREATE TABLE award_winners (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES award_categories(id),
  racer_id TEXT NOT NULL REFERENCES racers(id),
  vote_count INTEGER,
  created_at TEXT
);
```

## API

```
GET  /api/events/:eventId/award-categories     — list categories + voting status
POST /api/events/:eventId/award-categories     — create a category (admin)
POST /api/vote                                 — cast a vote { category_id, racer_id, device_token }
GET  /api/events/:eventId/vote-counts          — live counts per racer per category (public)
POST /api/award-categories/:id/close           — close voting + record winners (admin)
GET  /api/events/:eventId/award-winners        — final winners (used by certificates)
```

## Vote Integrity

- **One vote per device per category** — enforced by `UNIQUE(category_id, device_token)` in the database
- `device_token` is a random UUID generated on first visit, stored in `localStorage`
- Not cryptographically secure (families could vote twice on different browsers) but appropriate for a pack event — this isn't an election
- Admin can see vote counts live and spot obvious stuffing

## Certificate Integration

When a racer has won an award category, their certificate gains an award badge:

```
┌──────────────────────────────────────┐
│  [existing cert content]             │
│                                      │
│  🎨 Most Creative Car  ← new badge  │
└──────────────────────────────────────┘
```

The `Certificate` component checks `award_winners` for the racer's ID and renders a badge for each category won. Multiple awards stack.

## Timing

Voting works best during the **inter-round break** or **awards ceremony** — cars are on display, families are milling around, everyone has their phones out. The QR code on the projector is the invite.

For the 2026 event, this would have filled the 37-minute gap between Round 1 and Round 2 productively — families engage with the cars, the projector shows something interesting, and by the time racing resumes the winner is known.

## Display Phases

The `/display` page needs a new phase concept:

| Phase | Trigger | Display shows |
|-------|---------|---------------|
| `pre-race` | No heats yet | Countdown + registration ticker |
| `racing` | Heats in progress | Heat board + standings |
| `voting` | MC opens voting | Live vote leaderboard + QR code |
| `awards` | Voting closed | Winners announced |
| `complete` | Event marked done | Final standings + certificate QR |

Phase is set by the MC via the admin UI, not automatically — they control the pacing of the ceremony.

## Implementation Order

1. Data model + migrations
2. `POST /api/vote` + `GET /api/events/:id/vote-counts`
3. `/vote` phone page — car grid, tap to vote, confirmation
4. Admin close voting + record winners
5. Projector live leaderboard (WebSocket)
6. Certificate badge integration
7. QR code on projector display during voting phase
