# Hardware Timer API — External Finish-Line Integration

## Problem

Today, results are entered manually — a volunteer taps the placement order after each heat. This works but is slow, subjective, and can't capture millisecond finish times.

Electronic timers (Micro Wizard K1, BestTrack, DIY IR sensors) can provide exact finish times and automatic placement ordering.

## Goal

Accept timing data from external hardware and auto-populate heat results. Support multiple hardware approaches without requiring code changes.

## Architecture

Two integration modes:

### Mode 1: Serial Bridge (Existing)

The K1 serial script (`scripts/serial-k1.ts`) already parses timer output. Extend it to POST results directly to the API.

```
Timer → USB Serial → K1 Script → POST /api/heats/:id/results
```

This keeps the serial parsing isolated. The script runs alongside the server, watches for race packets, and submits results via HTTP.

### Mode 2: HTTP Push (Future Hardware)

For WiFi-enabled timers or custom Arduino/ESP32 builds, accept results directly via HTTP.

```
POST /api/hardware/results
Authorization: Bearer <hardware-token>
Content-Type: application/json

{
  "source": "k1",
  "lanes": [
    { "lane": 1, "time_ms": 3001, "place": 1 },
    { "lane": 2, "time_ms": 3047, "place": 2 },
    { "lane": 3, "time_ms": 3128, "place": 3 },
    { "lane": 4, "time_ms": 3241, "place": 4 }
  ]
}
```

The server matches this to the currently-running heat and populates results.

## API Endpoints

```
POST /api/hardware/results     — submit race timing from hardware
POST /api/hardware/start       — notify server that start gate opened
GET  /api/hardware/status      — current heat info for hardware display
POST /api/hardware/register    — register a hardware device (returns token)
```

## Race Flow with Hardware

1. Volunteer clicks "Start Heat" in Race Control → server marks heat as `running`
2. Start gate opens → timer begins counting
3. Cars cross finish line → timer records times per lane
4. Timer sends results via serial bridge or HTTP push
5. Server receives results, marks heat `complete`, updates standings
6. WebSocket push notifies all clients → display updates instantly

## Serial Bridge Enhancement

Extend the existing K1 script to:
- Watch for the currently-running heat via `GET /api/hardware/status`
- On race packet, POST results to `/api/hardware/results`
- Show confirmation in terminal: "Heat R1·H3 results submitted"
- Handle errors gracefully (no running heat, mismatched lane count)

```bash
# Start the bridge
bun run serial:k1:bridge --port /dev/tty.usbserial-XXXX --server http://localhost:3000
```

## Target Supported Timers

| Timer | Connection | Status |
|-------|-----------|--------|
| Micro Wizard K1/K1CS | USB Serial (9600 8N1) | Serial script exists |
| BestTrack | USB Serial | Parser needed |
| DIY IR Break-Beam | ESP32 WiFi HTTP | HTTP push ready |
| Pi or Arduino + Sensors | USB Serial | Parser needed |

## Open Questions

- Should hardware results auto-confirm, or should the Race Control volunteer review before confirming?
  - **Lean toward auto-confirm** with an "undo last" button — speed matters on race day
- How to handle DNF (Did Not Finish) lanes? Timer may report no time for a lane
  - Timer reports missing lanes → server fills those as DNF (last place)
- What if hardware results arrive when no heat is running?
  - Queue them with a warning, let the volunteer match them manually
