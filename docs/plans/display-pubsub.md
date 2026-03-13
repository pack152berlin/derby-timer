# Display Pub/Sub — Real-Time Updates via WebSocket

## Problem

The projector display (`/display`) and volunteer phones currently poll the API on intervals. This creates lag — a heat finishes and it takes seconds for the display to update. With 100+ people watching the projector, that delay feels broken. We may also have more than one display — a pack might run a projector for standings and a TV near the track for the on-deck queue. Each display should subscribe to the content it cares about.

## Goal

Create a fun, race-day atmosphere through the display. Build suspense before heats, celebrate the effort kids put into their cars, and make every winner feel like a champion. The display is the emotional heartbeat of the event.

## Execution Strategy

Push updates to all connected displays the instant data changes. Updates can trigger different display behaviors:

- **Persistent** — new state replaces old state and stays (e.g., updated standings)
- **Transient** — a brief celebration or animation that plays, then returns to the previous view (e.g., a 5-second winner reveal after a heat)
- **Subscriber-driven** — each display picks which content feeds it subscribes to, so a standings-only screen ignores heat control events

## Display Events

These are the moments the display should react to, each an opportunity to create energy in the room:

### Race Flow

| Event | Display Behavior | Duration |
|-------|-----------------|----------|
| **Heat starting** | Flash "NOW RACING" banner with lane assignments, car numbers, racer names. If car photos exist, show them. | Persistent until heat completes |
| **Heat completed** | Results reveal — show placements with a brief animation (gold/silver/bronze flash). Update standings. | 5s reveal → persistent standings |
| **Race progress** | Subtle progress bar: "Heat 23 of 74 · ~40 min remaining" | Persistent, updates after each heat |
| **All heats complete** | Final standings with celebration — top 3 highlighted, confetti-style effect | Persistent |

### Suspense & Celebration

| Event | Display Behavior | Duration |
|-------|-----------------|----------|
| **Lead change** | When a new racer takes 1st place overall, flash "NEW LEADER: Tommy Scout!" with their stats | 5s transient |
| **Close race alert** | When top 2 are separated by < 1 point, show "NECK AND NECK" split-screen comparison | 10s transient |
| **Den champion update** | When a new racer becomes the fastest in their den, show den-colored banner: "Fastest Wolf: Alex!" | 5s transient |
| **Milestone** | "Halfway there! 37 of 74 heats complete" | 3s transient |

### Car Showcase

| Event | Display Behavior | Duration |
|-------|-----------------|----------|
| **Car parade** (pre-race) | Slow scroll through all registered cars with photos, names, and den badges. Families love seeing their kid's car on the big screen. | Cycle until racing starts |
| **On-deck preview** | Show the next 2-3 heats with car photos so parents can get their kid ready | Persistent between heats |
| **Photo spotlight** | Between heats, show a random car photo full-screen with the racer's name. Quick dopamine hit for the kid whose car appears. | 5s between heats |

### Audience Engagement

| Event | Display Behavior | Duration |
|-------|-----------------|----------|
| **Live registration ticker** | During pre-race, new racers scroll in as they register (see Pre-Race Display below) | Persistent pre-race |
| **QR code overlay** | Periodic reminder: "Follow along on your phone!" with QR code to standings page | 10s every ~10 heats |
| **Voting reminder** | If voting is enabled, show "Vote for your favorite car!" with QR code during breaks | 10s periodic |
| **Den standings** | Rotate through den-filtered standings between heats — each den gets their moment | 8s per den |

### Admin-Triggered

| Event | Display Behavior | Duration |
|-------|-----------------|----------|
| **Custom announcement** | Admin types a message that appears on all displays (e.g., "Lunch break — racing resumes at 1:00 PM") | Until dismissed |
| **Award ceremony mode** | Admin triggers a mode that reveals winners one by one with dramatic pause — 3rd place, 2nd place, 1st place | Manual advance |
| **Den champion ceremony** | Cycle through each den showing top 3 with den image and colors | Manual advance |

## Design

### Channel-Based Pub/Sub

Bun's built-in WebSocket support includes topic-based pub/sub. Clients subscribe to channels; the server publishes when data changes.

```
Channels:
  event:{eventId}:heats      — heat status changes (started, completed)
  event:{eventId}:standings   — standings recalculated
  event:{eventId}:racers      — racer added/edited/inspected
  event:{eventId}:control     — race control commands (start, reset)
  event:{eventId}:display     — display-specific events (announcements, ceremony triggers)
```

### Client Behavior

1. Connect to `ws://host/ws`
2. Send `{ subscribe: ["event:abc:heats", "event:abc:standings"] }`
3. Receive push messages: `{ channel: "event:abc:heats", data: { ... } }`
4. On disconnect, auto-reconnect with exponential backoff

### Server Behavior

1. Accept WebSocket upgrades on `/ws`
2. Track subscriptions per connection
3. After any mutating API call (POST/PUT/DELETE), publish to relevant channels
4. Payload is the same shape as the corresponding GET endpoint — clients can replace their local state directly

### Message Format

```ts
// Server → Client
interface WsMessage {
  channel: string;
  event: 'update' | 'delete' | 'refresh';
  data: unknown; // matches the GET response shape
  timestamp: number;
}

// Client → Server
interface WsSubscribe {
  subscribe?: string[];
  unsubscribe?: string[];
}
```

## Implementation Steps

1. **WebSocket handler** — add `websocket` config to `Bun.serve()`, manage subscriptions
2. **Publish helper** — `publish(channel, data)` function called from API routes
3. **Client hook** — `useWebSocket(channels)` React hook that merges push data into local state
4. **Migrate display.tsx** — replace `setInterval` polling with WebSocket subscription
5. **Migrate main app** — `useApp()` context subscribes to relevant channels, calls `refreshData()` on push
6. **Display configurator** — simple UI on each display to pick which feeds to subscribe to
7. **Transient event queue** — client-side queue that plays brief animations and returns to base state

## Pre-Race Display: Countdown + Live Registration Ticker

Before any heats run, the projector display has nothing to show. This is dead air during the busiest, most chaotic part of the event. Replace it with a **pre-race screen** that:

1. Counts down to the scheduled first heat
2. Shows new registrations scrolling in live as kids check in

### Countdown

```
┌─────────────────────────────────────────────────┐
│                                                  │
│         Pack 152 Pinewood Derby 2026             │
│                                                  │
│              Racing starts in                    │
│                                                  │
│                  23:47                           │
│                                                  │
│              (2:00 PM)                           │
│                                                  │
└─────────────────────────────────────────────────┘
```

- Green → Amber (< 10 min) → Red + pulsing (< 3 min)
- Once overdue with no heats: "Racing starts soon — preparing track..."
- Switches automatically to the normal heat display when the first heat starts

### Live Registration Ticker

Below the countdown, new racers scroll in as they're registered at the desk — families in the audience see their kid's name appear on the projector:

```
┌─────────────────────────────────────────────────┐
│  🏎  Dean Kim          Wolves     Car #101       │
│  🏎  Lyile Bowers      Bears      Car #102       │
│  🏎  Klara Kny-Flores  Webelos    Car #103       │
│  ...                                             │
└─────────────────────────────────────────────────┘
```

- New entries slide in from the bottom, older ones scroll up
- Show den badge / den image thumbnail next to each name
- Keep the last ~8–10 entries visible at once
- Driven by the `event:{eventId}:racers` WebSocket channel — zero polling, instant update when a racer is added

### Late-Start Warning

If scheduled start time passes with no heats running, the admin UI (not the projector) shows:

```
⚠️ Start overdue by 18 min. Estimated finish: 5:20 PM.
   Switch to Quick format to finish by 4:45 PM instead.
```

This keeps the pressure internal — families on the projector see "starting soon", not a stress indicator.

## Open Questions

- Should the WebSocket carry full payloads or just "invalidate" signals that trigger a fetch?
  - Full payloads are simpler and faster for small data (standings, heat list)
  - Invalidation is safer for large data or complex merging
  - **Lean toward full payloads** — our data is small
- How to handle stale clients? If a client reconnects after a long gap, it needs a full refresh
  - On reconnect, client sends `{ refresh: true }` and server sends current state for all subscribed channels
- Display configurator: should it be a separate admin page, or part of the `/display` URL itself (e.g., `/display?feeds=heats,standings`)?

