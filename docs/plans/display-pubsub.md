# Display Pub/Sub — Real-Time Updates via WebSocket

## Problem

The projector display (`/display`) and volunteer phones currently poll the API on intervals. This creates lag — a heat finishes and it takes seconds for the display to update. With 100+ people watching the projector, that delay feels broken.

## Goal

Push updates to all connected clients the instant data changes. When a heat completes, every screen updates within 100ms.

## Design

### Channel-Based Pub/Sub

Bun's built-in WebSocket support includes topic-based pub/sub. Clients subscribe to channels; the server publishes when data changes.

```
Channels:
  event:{eventId}:heats      — heat status changes (started, completed)
  event:{eventId}:standings   — standings recalculated
  event:{eventId}:racers      — racer added/edited/inspected
  event:{eventId}:control     — race control commands (start, reset)
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
