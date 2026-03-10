# DerbyTimer — Project Vision

> A turnkey Pinewood Derby race management system that any pack volunteer can set up, run, and tear down in under an hour — no internet required.

## Where We Are

DerbyTimer handles the core race-day loop today:

- **Registration** — volunteers add racers on their phones, snap car photos, run inspection
- **Heat scheduling** — balanced lane rotation generated automatically
- **Race control** — start heats, record placements, optional time capture
- **Live display** — projector-optimized standings and heat boards via dedicated `/display` page
- **Certificates** — scout-themed printable certificates with tiered achievements and den rankings

The app runs as a single Bun process with SQLite. One laptop, one network, zero cloud dependencies.

## Where We're Going

### 1. Real-Time Display via WebSocket Pub/Sub

Replace polling with push-based updates so the projector display, volunteer phones, and parent devices all stay in sync instantly.

→ [Display Pub/Sub Plan](./plans/display-pubsub.md)

### 2. Hardware Timer Integration

Accept electronic finish times from sensors (Micro Wizard K1, BestTrack, DIY IR gates) via serial or HTTP, so results flow directly into the app with millisecond accuracy.

→ [Hardware API Plan](./plans/hardware-api.md)

### 3. Setup & Configuration

A first-run wizard and settings page so volunteers can configure lanes, event details, network, and timer hardware without touching config files.

→ [Setup & Config Plan](./plans/setup-config.md)

### 4. Raspberry Pi Turnkey Deployment

Flash an SD card, plug in power and ethernet, and you have a race server. Under $200 all-in, reusable year after year.

→ [Pi Deployment Plan](./plans/pi-deployment.md)

### 5. Cloud Sync & Remote Viewing

Optional tunnel (Cloudflare Tunnel / Tailscale) so parents at home can review standings live on their devices or after the event athome. Print certificates from any browser, not just the local network.

→ [Cloud Sync Plan](./plans/cloud-sync.md)

### 6. Cloud Store Multi-Year Results & History

Track racer progress across years. "This is your 3rd derby!" Show improvement trends, all-time records, returning racer profiles.

→ [Multi-Year Tracking Plan](./plans/multi-year.md)

### 7. Hardware Compatibility

Compatibility matrix and flashable firmware images for supported timers and microcontrollers. Plug in, flash, race.

→ [Hardware Compatibility](./plans/sensor-guide.md)

### 8. People's Choice Voting

Families vote on car awards (Most Creative, Best Paint Job) from their phones during the awards ceremony. Live vote counts on the projector, winners stored and printed on certificates.

→ [Voting Plan](./plans/voting.md)

### 9. Configurable Heat Scheduling

Multiple scheduling algorithms (adaptive greedy, Perfect-N charts, quick mode, bracket), configurable per event. Live progress bar with time-to-completion estimate.

→ [Heat Scheduling Plan](./plans/heat-scheduling.md)

## Design Principles

These hold across all future work:

1. **Offline-first** — everything works without internet. Cloud features are opt-in extras.
2. **Volunteer-proof** — if it takes training, it's too complex. Big buttons, clear labels, one action per screen.
3. **Projector-optimized** — high contrast, large text, readable from 30 feet away.
4. **Portable** — fits in a backpack. Laptop + Pi + timer + a few cables.
5. **Cheap** — under $300 for the complete hardware stack (excluding laptop).
6. **Adaptive** — works with no timer (manual entry), a basic timer (serial), or a full sensor rig.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Bun Server                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Routes   │  │ WebSocket│  │  Serial/Hardware  │  │
│  │ (API+HTML)│  │ Pub/Sub  │  │  Bridge           │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │              │
│       └──────────────┼─────────────────┘              │
│                      │                                │
│              ┌───────┴───────┐                        │
│              │    SQLite     │                        │
│              └───────────────┘                        │
└─────────────────────────────────────────────────────┘
        │              │              │
   ┌────┴───┐    ┌─────┴────┐   ┌────┴─────┐
   │ Phones │    │ Projector│   │  Timer   │
   │(WiFi)  │    │ Display  │   │ Hardware │
   └────────┘    └──────────┘   └──────────┘
```

## Existing Documentation

| Doc | Purpose |
|-----|---------|
| [Race Day Plan](./race-day-plan.md) | Original implementation spec — data model, UI flow, heat scheduling |
| [Certificate Plan](./certificate-plan.md) | Certificate tiering, layout, scout theming |
| [Auth Plan](./auth-plan.md) | Cookie-based auth for admin vs public routes |
| [K1 Serial Script](./electronics/k1-serial-script.md) | Micro Wizard K1 serial communication |
| [Serial Test Checklist](./electronics/serial-bus-test-checklist.md) | Hardware validation steps |
| [Race Day 2026 Analysis](./plans/race-day-2026-analysis.md) | Post-mortem from Feb 2026 derby — timing data, heat count analysis, lessons |
