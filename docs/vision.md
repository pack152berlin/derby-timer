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

### Near-Term: Deploy & Share

#### Cloud Deployment

Deploy to Fly.io so parents can view standings and certificates after the event from any device, not just the local network.

> [Deployment Plan](./plans/deployment.md)

#### Authentication & Access Control

Cookie-based admin key system — protects mutations while keeping standings and certificates public. Works the same locally and on Fly.io.

> [Auth Plan](./plans/auth.md)

#### Race Day Edge Cases

Handle common real-world disruptions: heat re-runs, broken cars, late entries, withdrawals, disqualifications, and tiebreakers.

> [Edge Cases Plan](./plans/edge-cases.md)

### Mid-Term: Better Race Day

#### Real-Time Display via WebSocket Pub/Sub

Replace polling with push-based updates so the projector display, volunteer phones, and parent devices all stay in sync instantly.

> [Display Pub/Sub Plan](./plans/display-pubsub.md)

#### Hardware Timer Integration

Accept electronic finish times from sensors (Micro Wizard K1, BestTrack, DIY IR gates) via serial or HTTP, so results flow directly into the app with millisecond accuracy.

> [Hardware API Plan](./plans/hardware-api.md)

#### Setup & Configuration

A first-run wizard and settings page so volunteers can configure lanes, event details, network, and timer hardware without touching config files.

> [Setup & Config Plan](./plans/setup-config.md)

#### Configurable Heat Scheduling

Multiple scheduling algorithms (adaptive greedy, Perfect-N charts, quick mode, bracket), configurable per event. Live progress bar with time-to-completion estimate.

> [Heat Scheduling Plan](./plans/heat-scheduling.md)

#### Points-Per-Place Scoring

Replace win/loss scoring with industry-standard points-per-place (4/3/2/1). More granular, fairer, and easier for parents to understand.

> [Standings & Scoring Research](./plans/standings-scoring.md)

### Long-Term: Expand

#### Raspberry Pi Turnkey Deployment

Flash an SD card, plug in power and ethernet, and you have a race server. Under $200 all-in, reusable year after year.

> [Pi Deployment Plan](./plans/pi-deployment.md)

#### Remote Access via Tunnel

Optional tunnel (Cloudflare Tunnel / Tailscale) so parents at home can review standings live during the event — no cloud deployment needed.

> [Remote Access Plan](./plans/remote-access.md)

#### DerbyTimer Cloud (Hosted Service)

Fully managed hosting for non-technical packs. Flash a Pi, pay $5, and the cloud handles everything — provisioning, display, certificates, backups. The Pi becomes a thin bridge to the track hardware.

> [Hosted Service Plan](./plans/hosted-service.md)

#### Multi-Year Results & History

Track racer progress across years. "This is your 3rd derby!" Show improvement trends, all-time records, returning racer profiles.

> [Multi-Year Tracking Plan](./plans/multi-year.md)

#### Hardware Compatibility

Compatibility matrix and flashable firmware images for supported timers and microcontrollers. Plug in, flash, race.

> [Hardware Compatibility](./plans/sensor-guide.md)

#### People's Choice Voting

Families vote on car awards (Most Creative, Best Paint Job) from their phones during the awards ceremony. Live vote counts on the projector, winners stored and printed on certificates.

> [Voting Plan](./plans/voting.md)

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

## Documentation

### Core Plans

| Plan | Status | Description |
|------|--------|-------------|
| [Race Day](./plans/race-day.md) | Implemented | Original spec — data model, UI flow, heat scheduling |
| [Achievement Certificates](./plans/achievement-certificate.md) | Implemented | Certificate tiering, layout, scout theming, den rankings |
| [Auth](./plans/auth.md) | Not started | Cookie-based admin key for local + cloud |
| [Deployment](./plans/deployment.md) | Not started | Fly.io deployment with SQLite + Litestream |
| [Edge Cases](./plans/edge-cases.md) | Not started | Heat re-runs, withdrawals, DQs, tiebreakers |
| [Standings Scoring](./plans/standings-scoring.md) | Not started | Points-per-place to replace win/loss |

### Future Plans

| Plan | Description |
|------|-------------|
| [Display Pub/Sub](./plans/display-pubsub.md) | WebSocket push-based updates |
| [Hardware API](./plans/hardware-api.md) | Electronic timer integration |
| [Heat Scheduling](./plans/heat-scheduling.md) | Advanced scheduling algorithms |
| [Setup & Config](./plans/setup-config.md) | First-run wizard and settings UI |
| [Pi Deployment](./plans/pi-deployment.md) | Raspberry Pi turnkey server |
| [Remote Access](./plans/remote-access.md) | Tunnel for live remote viewing |
| [Hosted Service](./plans/hosted-service.md) | Fully managed cloud for non-technical packs |
| [Multi-Year](./plans/multi-year.md) | Cross-year racer tracking |
| [Sensor Guide](./plans/sensor-guide.md) | Hardware compatibility matrix |
| [Voting](./plans/voting.md) | People's choice car awards |

### Reference

| Doc | Purpose |
|-----|---------|
| [Sources & References](./sources.md) | Scoring research, derby software, community links |
| [Race Day 2026 Analysis](./plans/race-day-2026-analysis.md) | Post-mortem from Feb 2026 event |
| [K1 Serial Script](./electronics/k1-serial-script.md) | Micro Wizard K1 serial communication |
| [Serial Test Checklist](./electronics/serial-bus-test-checklist.md) | Hardware validation steps |
