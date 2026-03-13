# Remote Access — Tunnel Local Server to the Internet

## Problem

Parents who couldn't attend (or are in the parking lot wrangling siblings) want to watch standings update in real time. Grandparents out of state want to see their kid's results. And after the event, printing certificates from the local network isn't possible.

## Goal

Optional, zero-config connectivity so anyone with a link can watch the race live and print certificates from home — without deploying the app to the cloud. The race still runs locally on a Pi or laptop; a tunnel exposes it to the internet.

This is the simplest path to remote viewing: no database migration, no cloud hosting, no extra services. Just a tunnel.

## When to Use This vs Cloud Deployment

| Approach | Who it's for | Setup effort | Cost |
|----------|-------------|--------------|------|
| **Remote Access (this doc)** | Pack with reliable venue WiFi that wants to share a link during the event | One command | Free |
| **[Cloud Deployment](./deployment.md)** | Pack that wants persistent results online after the event | Moderate (Docker, Fly.io) | ~$2/month |
| **[Hosted Service](./hosted-service.md)** | Non-technical pack that wants everything managed | Flash a Pi | ~$5/month |

## Architecture

The Pi/laptop is the source of truth. The tunnel is a passthrough — no data stored in the cloud.

```
┌──────────────┐         ┌──────────────────┐
│  Pi / Laptop │ ──────→ │  Cloudflare      │ ──→ Public URL
│  (DerbyTimer)│ tunnel  │  Tunnel           │    derby.pack152.org
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
| `/standings` | Public | Interactive standings page |
| `/certificates` | Public | All certificates for printing |
| `/certificate/:id` | Public | Individual certificate |
| `/api/events/:id/standings` | Public (read-only) | For custom integrations |
| `/api/events/:id/heats` | Public (read-only) | Heat schedule |
| Registration, Race Control | **Blocked** | Admin-only via [auth](./auth.md) |

## Security

- [Auth plan](./auth.md) defines public vs admin routes
- Cloudflare Tunnel can add access policies (email-based) for admin routes
- Read-only API endpoints are safe to expose
- No PII beyond racer names and den — acceptable for a pack event

## QR Code Sharing

On the Settings page, when remote access is enabled:
- Generate a QR code for the public URL
- "Share this with parents so they can watch from anywhere"
- Print the QR code on a flyer for the event
- Display the QR code on the projector periodically (see [Display Plan](./display-pubsub.md))

## Offline Resilience

- Remote access is strictly optional. The app works 100% without it.
- If the tunnel drops, local network continues working
- Tunnel reconnects automatically when connectivity returns
- No data is stored in the cloud — it's a passthrough

## Implementation Steps

1. **Detect connectivity** — check if the Pi has internet access
2. **Tunnel setup** — install `cloudflared`, configure systemd service
3. **Settings UI** — toggle remote access on/off, show public URL + QR code
4. **Route filtering** — ensure admin routes are blocked via auth middleware
5. **Status indicator** — show "Remote: Connected" / "Remote: Offline" in nav

## Limitations

- Requires reliable internet at the venue (not always available)
- If the tunnel drops, remote viewers lose access until it reconnects
- When the Pi/laptop shuts down after the event, the URL dies — for persistent access, use [Cloud Deployment](./deployment.md) or [Hosted Service](./hosted-service.md)
- Random Cloudflare URLs change each session unless a custom domain is configured
