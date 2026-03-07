# Derby Race Manager 🏁

A comprehensive Pinewood Derby race management system inspired by DerbyNet. Built with Bun, SQLite, and a bold racing aesthetic optimized for projection displays.

## Features

### 🏎️ Race Management
- **Event Management**: Create and manage race day events
- **Racer Registration**: Add racers with den/rank information
- **Car Registration**: Assign car numbers, names, and classes
- **Inspection Tracking**: Pass/fail inspection workflow
- **Heat Generation**: Automatic balanced lane rotation algorithm
- **Live Race Console**: Real-time heat management with big buttons
- **Standings**: Auto-calculated win/loss rankings with tie-breaking
- **Projection Display**: Full-screen display optimized for walls/projectors

### 🎯 Key Design Decisions
- **Win/Loss Priority**: Records place (1st, 2nd, 3rd, 4th) rather than times
- **Optional Times**: Can capture times for tie-breaking but not required
- **Balanced Lanes**: Heat generation ensures even lane distribution
- **Fast Race Day Flow**: Minimal clicks, obvious actions, big buttons
- **50 Car Support**: Designed for ~50 cars and ~100 people

## Requirements

- [Bun](https://bun.com) (v1.2+)
- Modern web browser

## Quick Start

```bash
# Install dependencies
bun install

# Run database migrations
bun run src/migrate.ts

# Start the server with hot reload
bun start

# Open http://localhost:3000
```

## Testing

```bash
bun test                    # Run all unit and integration tests
bun run test:unit           # Run unit tests only
bun run test:integration    # Run API + websocket tests (spins up isolated server on :3099)
bun run test:ui             # Run Playwright E2E tests (ignores screenshots)
bun run screenshots         # Run Playwright to capture UI screenshots
```

## Race-Day Rehearsal Command

Run a full simulated race flow (check-in -> heat generation -> partial run -> server restart -> finish) in an isolated SQLite file:

```bash
bun run rehearsal:race-day
```

Useful options:

```bash
# Keep the rehearsal DB for post-run inspection
bun run rehearsal:race-day --keep-db

# Customize scale/format
bun run rehearsal:race-day --cars 50 --lookahead 2 --pre-restart-heats 20
```

## Race Day Workflow

### 1. Event Setup
1. Navigate to the home page
2. Click "Create Event"
3. Enter event name, date, and lane count (typically 4)

### 2. Registration
1. Click "Register" in the nav
2. Add racers (first name, last name, den/rank optional)
3. Add cars for each racer (car number, name, class)
4. Run inspection and mark cars as passed

### 3. Generate Heats
1. Go to "Heats" page
2. Click "Generate Heats"
3. System creates balanced lane assignments automatically

### 4. Race Day
1. Go to "Race" page for the race console
2. Project the "Display" view on a wall (open in new tab)
3. For each heat:
   - Click "START HEAT" to begin
   - Cars race down the track
   - Record finish order by clicking 1st, 2nd, 3rd, 4th or DNF
   - Click "Complete Heat & Save" to record results
4. System auto-advances to next heat

### 5. Awards
1. Go to "Standings" page to see rankings
2. Winners calculated by: Wins DESC, Losses ASC, Avg Time ASC
3. Top 3 highlighted with gold/silver/bronze styling

## API Endpoints

### Events
- `GET /api/events` - List all events
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get event details
- `PATCH /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Racers
- `GET /api/events/:eventId/racers` - List racers for event
- `POST /api/events/:eventId/racers` - Add racer
- `GET /api/racers/:id` - Get racer details
- `PATCH /api/racers/:id` - Update racer
- `DELETE /api/racers/:id` - Delete racer

### Cars
- `GET /api/events/:eventId/cars` - List cars for event
- `POST /api/events/:eventId/cars` - Add car
- `GET /api/cars/:id` - Get car details
- `PATCH /api/cars/:id` - Update car
- `DELETE /api/cars/:id` - Delete car
- `POST /api/cars/:id/inspect` - Mark inspection pass/fail

### Heats
- `GET /api/events/:eventId/heats` - List heats with lanes
- `POST /api/events/:eventId/heats` - Create heat manually
- `DELETE /api/events/:eventId/heats` - Clear all heats
- `GET /api/heats/:id` - Get heat details
- `POST /api/heats/:id/start` - Start a heat
- `POST /api/heats/:id/complete` - Complete a heat
- `POST /api/events/:eventId/generate-heats` - Auto-generate balanced heats

### Results & Standings
- `GET /api/heats/:heatId/results` - Get results for heat
- `POST /api/heats/:heatId/results` - Record results (batch)
- `GET /api/events/:eventId/standings` - Get race standings
- `GET /api/events/:eventId/standings/:className` - Get class-specific standings

## Database Schema

SQLite database with the following tables:

- **events**: Race day events with lane count and status
- **racers**: Scout racers with den/rank info
- **cars**: Car entries linked to racers
- **heats**: Race heats with round/heat number
- **heat_lanes**: Assignment of cars to lanes per heat
- **results**: Finish results with place and optional time
- **standings**: Materialized win/loss statistics

Migrations handled by Umzug.

## UI Views

- **/** - Event selector and creation
- **/register** - Racer and car registration with inspection
- **/heats** - Heat schedule preview and generation
- **/race** - Live race console for recording results
- **/standings** - Race results and rankings
- **/display** - Full-screen projection view (auto-rotates)

## Architecture

```
derby-timer/
├── src/
│   ├── index.ts          # Bun server with routes
│   ├── migrate.ts        # Database migration runner
│   ├── db/
│   │   ├── connection.ts # SQLite connection
│   │   ├── umzug.ts      # Migration setup
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.ts
│   │   └── models/
│   │       ├── events.ts
│   │       ├── racers.ts
│   │       ├── cars.ts
│   │       ├── heats.ts
│   │       └── results.ts
├── frontend.ts           # SPA frontend
├── index.html            # HTML entry
├── styles.css            # Racing-themed styles
└── docs/
    ├── race-day-plan.md
    └── ui-examples/
```

## Heat Generation Algorithm

The system uses a balanced lane rotation algorithm:

1. **Fewer cars than lanes**: Rotates starting positions so each car runs in each lane across rounds
2. **More cars than lanes**: Uses round-robin rotation with lane shifting to distribute cars evenly
3. **Validation**: Checks that each car hits every lane when mathematically possible

## Tech Stack

- **Runtime**: Bun (TypeScript, built-in bundler)
- **Database**: SQLite via `bun:sqlite`
- **Migrations**: Umzug
- **Frontend**: React SPA
- **Styling**: CSS with racing theme (Oswald + Space Grotesk fonts)
- **Server**: Bun.serve() with HMR

---

Built for fast-paced Pinewood Derby race days. 🏆
