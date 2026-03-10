# Cloud Sync & Remote Viewing

## Problem

Parents who couldn't attend (or are in the parking lot wrangling siblings) want to watch standings update in real time. Grandparents out of state want to see their kid's results. And after the event, printing certificates from the local network isn't possible.

## Goal

Optional, zero-config cloud connectivity so anyone with a link can watch the race live and print certificates from home.

## Architecture

The Pi/laptop is the source of truth. Cloud is a read-only mirror with a tunnel for live access.

```
┌──────────────┐         ┌──────────────────┐
│  Pi / Laptop │ ──────→ │  Cloudflare      │ ──→ Public URL
│  (DerbyTimer)│ tunnel  │  Tunnel / Tailscale│    derby.pack152.org
└──────────────┘         └──────────────────┘
```

## Tunnel Options

### Option A: Cloudflare Tunnel (Free, Recommended)
- Install `cloudflared` on the Pi
- One command: `cloudflared tunnel --url http://localhost:3000`
- Gets a random `*.trycloudflare.com` URL — share via QR code
- For a custom domain: configure once, runs automatically on boot
- Free tier is sufficient for race-day traffic

### Option B: Tailscale (For Tech-Savvy Packs)
- Install Tailscale on the Pi and on viewer devices
- Pi gets a stable `derby.tail12345.ts.net` address
- More setup but more control. Good for multi-device pack setups.

### Option C: Simple Relay Server (Self-Hosted)
- A tiny VPS ($5/mo) runs a WebSocket relay
- Pi connects out to the relay, relay forwards to viewers
- Full control, no third-party dependencies
- More work to maintain

## What's Exposed Remotely

| Route | Access | Notes |
|-------|--------|-------|
| `/display` | Public | Live standings + heat board |
| `/certificates` | Public | All certificates for printing |
| `/certificate/:id` | Public | Individual certificate |
| `/api/events/:id/standings` | Public (read-only) | For custom integrations |
| `/api/events/:id/heats` | Public (read-only) | Heat schedule |
| Registration, Race Control | **Blocked** | Admin-only, local network |

## Security

- Auth plan (`docs/auth-plan.md`) already defines public vs admin routes
- Cloudflare Tunnel can add access policies (email-based) for admin routes
- Read-only API endpoints are safe to expose
- No PII beyond racer names and den — acceptable for a pack event

## QR Code Sharing

On the Settings page, when cloud sync is enabled:
- Generate a QR code for the public URL
- "Share this with parents so they can watch from anywhere"
- Print the QR code on a flyer for the event

## Offline Resilience

- Cloud sync is strictly optional. The app works 100% without it.
- If the tunnel drops, local network continues working
- Tunnel reconnects automatically when connectivity returns
- No data is stored in the cloud — it's a passthrough

## Implementation Steps

1. **Detect connectivity** — check if the Pi has internet access
2. **Tunnel setup** — install `cloudflared`, configure systemd service
3. **Settings UI** — toggle cloud sync on/off, show public URL + QR code
4. **Route filtering** — ensure admin routes are blocked via the tunnel
5. **Status indicator** — show "Cloud: Connected" / "Cloud: Offline" in nav

## Open Questions

- Should we support push notifications (SMS/email) for race results?
  - Nice to have but adds complexity. Start with a public URL and iterate.
- How to handle the URL changing each time (random Cloudflare URL)?
  - Option 1: Pack sets up a custom domain (e.g., `derby.pack152.org`)
  - Option 2: Use a short URL service to create a stable redirect
  - Option 3: Tailscale gives a stable hostname
