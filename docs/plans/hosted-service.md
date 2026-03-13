# Hosted Service — DerbyTimer Cloud

A fully managed service for packs that want to run a derby without any technical setup beyond flashing a Pi.

## Problem

The current deployment options all assume some technical ability:

- **Local-only**: Requires cloning a repo, installing Bun, running the server
- **[Remote Access](./remote-access.md)**: Requires installing `cloudflared`, having venue internet
- **[Cloud Deployment](./deployment.md)**: Requires Docker, Fly.io CLI, volume management

Most Cub Scout pack volunteers are parents, not developers. They can follow "flash this SD card" instructions, but they can't deploy a Docker container or manage a Fly.io account. We need a path that's as simple as: **plug in the Pi, scan a QR code, start racing.**

## Goal

A parent with zero technical skills can:

1. Flash a Raspberry Pi with our image
2. Plug the Pi into power and (optionally) a display and track timer
3. The Pi auto-connects to the internet and registers with DerbyTimer Cloud
4. A web-based dashboard provisions everything automatically
5. Volunteers manage the event from their phones via a public URL
6. Results, certificates, and photos persist online after the event

## Architecture

The Pi is a thin bridge between the physical track and the cloud. The cloud runs the app.

```
                         ┌────────-─────────────────────────────┐
                         │         DerbyTimer Cloud             │
                         │                                      │
  ┌──────────┐  WSS      │  ┌─────────────┐   ┌──────────────┐  │
  │    Pi    │ ────────→ │  │  WebSocket  │   │  Bun Server  │  │
  │ (bridge) │           │  │  Gateway    │──→│  (per-event) │  │
  └──────────┘           │  └────-────────┘   └──────┬───────┘  │
       │                 │                           │          │
  ┌────┴─────┐           │                    ┌──────┴───────┐  │
  │  Timer   │           │                    │   SQLite     │  │
  │ Hardware │           │                    │  (Volume)    │  │
  └──────────┘           │                    └──────┬───────┘  │
                         │                           │          │
  Phones / Laptops ──────│─── HTTPS ──────→  API + SPA          │
  (at venue + remote)    │                           │          │
                         │                   ┌───────┴───────┐  │
  Projector Display ─────│─── HTTPS ──────→  │   S3 Backup   │  │
  (at venue or remote)   │                   │   (Tigris)    │  │
                         │                   └───────────────┘  │
                         └──────────────────────────────────────┘
```

### Key Differences from Local-First

| Aspect | Local-First | Hosted Service |
|--------|-------------|----------------|
| Source of truth | Pi/laptop | Cloud server |
| Display served from | Local network | Cloud (any browser, anywhere) |
| Timer data flow | Timer → Pi → App | Timer → Pi → WebSocket → Cloud → App |
| Internet required? | No | Yes (with offline fallback) |
| Data persistence | Local SQLite file | Cloud volume + S3 backup |
| Post-event access | Only while laptop is on | Always available |

## The Pi Bridge

The Pi's role shrinks to a hardware bridge:

1. **Boot** — connects to WiFi, establishes a persistent WebSocket to the cloud
2. **Timer relay** — reads serial data from the track timer, forwards finish times to the cloud over WebSocket
3. **Local display** (optional) — if a monitor is connected, shows the display page from the cloud URL
4. **Offline queue** — if internet drops, queues timer events locally and syncs when connectivity returns

### Pi Software

```
┌──────────────────────────────────┐
│          Pi Bridge               │
│                                  │
│  ┌────────────┐  ┌───────────┐  │
│  │  Serial    │  │ WebSocket │  │
│  │  Reader    │──│ Client    │──│──→ wss://cloud.derbytimer.org/bridge
│  └────────────┘  └───────────┘  │
│                                  │
│  ┌────────────┐  ┌───────────┐  │
│  │  Offline   │  │ Chromium  │  │
│  │  Queue     │  │ Kiosk     │──│──→ https://cloud.derbytimer.org/display/EVENT_ID
│  └────────────┘  └───────────┘  │
└──────────────────────────────────┘
```

- Minimal runtime: a small Bun process (~20 lines) that reads serial and forwards over WebSocket
- No local database, no API, no frontend — the cloud handles all of that
- Auto-updates via a simple `git pull` + restart on boot, or OTA update channel

### Resilience

The WebSocket connection must survive venue WiFi instability:

- **Reconnect with exponential backoff** (100ms → 200ms → 400ms → ... → 30s max)
- **Heartbeat** every 10s — if the cloud misses 3 heartbeats, it shows "Pi disconnected" in the admin UI
- **Offline queue**: Timer events are timestamped and queued locally. On reconnect, the queue drains in order. The cloud deduplicates by timestamp.
- **Manual fallback**: If internet is truly dead, the Pi can fall back to running the full local app (the SD card image includes it). Admin switches modes via a physical button or local web UI.

## Provisioning Flow

### For the Pack Leader

1. Go to `derbytimer.org` and create an account (email + password, or Google OAuth)
2. Click "New Event" — enter event name, date, lane count
3. Get a provisioning code (6 alphanumeric characters, e.g., `PACK-A7X3`)
4. Flash the Pi SD card image (download from the site, flash with Balena Etcher)
5. On first boot, the Pi shows the provisioning code input on its HDMI display
6. Enter the WiFi credentials and provisioning code
7. The Pi registers with the cloud — the web dashboard shows "Pi connected"
8. Start managing the event from any browser

### What Happens Behind the Scenes

```
Pack leader creates event on derbytimer.org
  → Cloud provisions a new Fly.io machine (or allocates a tenant slot)
  → Cloud generates a provisioning code linked to the event
  → Pack leader enters code on the Pi
  → Pi sends: { code: "PACK-A7X3", piId: "unique-hardware-id" }
  → Cloud validates, returns: { eventId, wsEndpoint, displayUrl }
  → Pi connects WebSocket to wsEndpoint
  → Cloud shows "Pi connected" in the dashboard
```

## Hosting Models

### Option A: Per-Event Fly.io Machine (Simple)

Each event gets its own Fly.io machine with a volume. Provisioned automatically via the Fly.io Machines API.

- **Pros**: Full isolation, simple to reason about, easy to tear down
- **Cons**: Higher cost per event, cold start on first access
- **Cost**: ~$5/event-month (shared-cpu-1x + 1GB volume + Litestream backup)
- **Teardown**: Machine auto-stops after 30 days of inactivity. Data backed up to S3 before deletion.

### Option B: Multi-Tenant (Efficient)

Multiple events share a single Fly.io machine. Each event is a separate SQLite database file.

- **Pros**: Much cheaper per event, no cold start
- **Cons**: Tenant isolation is weaker, noisy neighbor risk (unlikely at this scale)
- **Cost**: ~$2/event-month at scale (shared infrastructure, per-event storage only)
- **Isolation**: Separate DB files, separate WebSocket rooms, separate auth keys

### Recommendation

Start with **Option A** (per-event machines). It's simpler, provides better isolation, and the cost difference is negligible at low volume. Switch to multi-tenant if/when DerbyTimer Cloud serves 50+ events/month.

## Pricing

Target: **$15/event** — covers one month of hosting. After the month, results are archived to S3 and the machine shuts down. The pack can pay another $5 to reactivate.

| What's included | Details |
|----------------|---------|
| Cloud server | Fly.io shared-cpu-1x, 256MB |
| Storage | 1GB volume for SQLite + photos |
| Backup | Continuous Litestream to S3 |
| Display | Unlimited viewers, anywhere |
| Certificates | Shareable links, printable |
| Post-event access | 30 days included, extend for $5/month |

Payment: Stripe Checkout, one-time $15 charge. No subscription, no recurring billing unless they explicitly extend.

## Photo Handling

Car photos are a significant data concern in the cloud model:

- **Upload**: Volunteer takes photo on phone → uploads via the web app → stored on the cloud volume
- **Backup**: Photos sync to S3 alongside the database via a scheduled job (not Litestream, which only handles SQLite)
- **Size**: Cap at 1MB per photo (resize on upload). With 50 racers, that's ~50MB total.
- **CDN**: Serve photos through Fly.io's built-in CDN or put Cloudflare in front for caching

## Data Lifecycle

```
Event created → Active (30 days) → Archived (S3) → Deleted (after 1 year)
                    │                    │
                    │ $5 to extend       │ $5 to restore
                    ↓                    ↓
               Active (30 more days)   Active (30 days)
```

- **Active**: Full access, live WebSocket, editable
- **Archived**: Read-only access to standings and certificates via S3-hosted static pages. Machine shut down.
- **Deleted**: Data purged after 1 year of inactivity. 30-day warning email before deletion.

## Implementation Phases

### Phase 1: Cloud Deployment (prerequisite)

Complete the [Deployment Plan](./deployment.md) and [Auth Plan](./auth.md) first. The hosted service builds on top of a working Fly.io deployment. Auth provides admin keys (for pack leaders) and optional viewer passwords (for privacy-conscious families) — see the auth plan for the full two-tier cookie system.

### Phase 2: Pi Bridge

1. Strip the Pi image to just the bridge software (serial reader + WebSocket client)
2. Build a provisioning flow (WiFi setup + code entry on HDMI display)
3. Implement resilient WebSocket with offline queue

### Phase 3: Provisioning API

1. `POST /api/events` — creates an event, provisions a Fly.io machine via Machines API
2. `GET /api/events/:id/provision-code` — returns the 6-char code
3. `POST /api/bridge/register` — Pi sends code, receives connection details
4. Stripe Checkout integration for $5 payment

### Phase 4: Dashboard

1. Web dashboard at `derbytimer.org` — create events, manage billing, view status
2. "Pi status" indicator (connected / disconnected / last seen)
3. "Extend" and "Archive" buttons for event lifecycle

### Phase 5: Multi-Tenant (if needed)

1. Route events to shared machines based on load
2. Per-tenant database isolation
3. Resource limits per tenant

## Related Plans

- [Deployment](./deployment.md) — the Fly.io foundation this service builds on
- [Auth](./auth.md) — admin key + viewer password auth (privacy mode for families), cookie sessions
- [Pi Deployment](./pi-deployment.md) — the local Pi image (bridge reuses this SD card setup)
- [Remote Access](./remote-access.md) — the simpler tunnel approach for tech-savvy packs
- [Display Pub/Sub](./display-pubsub.md) — WebSocket display events, served from the cloud in this model
