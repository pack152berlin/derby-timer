# Raspberry Pi Turnkey Deployment

## Problem

Setting up a laptop with Bun, cloning the repo, and running the server is fine for a developer. For a pack volunteer? Too many steps, too many things to go wrong.

## Goal

Flash an SD card once. Every year, plug in the Pi, wait 30 seconds, and the race server is running. Under $200 for the complete hardware kit.

## Hardware Bill of Materials

| Item | Approx Cost | Notes |
|------|------------|-------|
| Raspberry Pi 4 (4GB) or Pi 5 | $55–80 | Pi 4 is sufficient, Pi 5 is snappier |
| 32GB microSD card | $8 | Class 10 / A2 recommended |
| USB-C power supply | $10 | Official Pi power supply |
| Case with fan | $10 | Passive cooling works too |
| Ethernet cable (6ft) | $5 | For connecting to router/switch |
| USB WiFi AP dongle (optional) | $15 | If you want the Pi to be the WiFi hotspot |
| **Total** | **$88–128** | Excluding timer hardware |

## Software Stack

```
Raspberry Pi OS Lite (64-bit, headless)
  └── Bun runtime (ARM64 binary)
       └── DerbyTimer (bundled, single binary or source)
            └── SQLite database (local file)
```

### Boot Sequence

1. Pi powers on → OS boots (10–15 seconds)
2. Systemd service starts DerbyTimer (2–3 seconds)
3. mDNS announces `derby.local` on the network
4. Server is ready at `http://derby.local:3000`

## Image Build Process

Use a reproducible image builder (like `pi-gen` or a simple shell script):

```bash
# On a build machine:
1. Start from Raspberry Pi OS Lite base image
2. Install Bun runtime
3. Copy DerbyTimer source + node_modules (or pre-bundled)
4. Configure systemd service (auto-start on boot)
5. Configure mDNS (avahi-daemon, hostname: derby)
6. Configure WiFi AP mode (optional, via hostapd)
7. Disable unnecessary services (bluetooth, swap)
8. Set up automatic database backup to /boot partition
9. Write image to SD card
```

### Systemd Service

```ini
[Unit]
Description=DerbyTimer Race Server
After=network.target

[Service]
Type=simple
User=derby
WorkingDirectory=/opt/derby-timer
ExecStart=/usr/local/bin/bun src/index.ts
Restart=always
RestartSec=3
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Network Modes

### Mode A: Existing WiFi Network (Simplest)
- Pi connects to the venue's WiFi via ethernet or pre-configured WiFi
- Volunteers join the same network and access `derby.local:3000`
- Projector laptop connects via HDMI + WiFi

### Mode B: Pi as WiFi Hotspot (Most Portable)
- Pi runs `hostapd` to create a WiFi network: `PinewoodDerby` (no password or simple one)
- Volunteers connect to this network
- Pi serves DHCP via `dnsmasq`
- No internet needed — fully self-contained
- Downside: parents can't be on venue WiFi and derby WiFi simultaneously

### Mode C: Separate Travel Router (Recommended)
- Bring a small travel router (GL.iNet, ~$25)
- Pi connects via ethernet
- Router creates WiFi network
- Best of both worlds: reliable WiFi + Pi stays wired

## Year-to-Year Usage

1. **Before race day**: Plug in Pi, connect to network, open `derby.local:3000`, create new event
2. **Race day**: Pi is already configured. Plug in, wait 30s, go.
3. **After race day**: Unplug Pi, put it in the derby box with the track. Database persists on SD card.
4. **Next year**: Plug in the same Pi. Previous year's data is still there. Create a new event.

## Update Strategy

- Pi has no internet on race day → no auto-updates
- Before race day, volunteer can: `ssh derby@derby.local` → `cd /opt/derby-timer && git pull && bun install`
- Or: re-flash the SD card with a new image (nuclear option)
- Future: USB-stick update — drop a `.tar.gz` on a USB drive, Pi detects and updates on boot

## Open Questions

- Should the Pi image include the timer serial bridge auto-started?
  - Only if a serial device is detected at boot. Otherwise manual start.
- How to handle database corruption from sudden power loss?
  - SQLite WAL mode handles this well. Add `PRAGMA journal_mode=WAL` on startup.
  - Periodic checkpoint to `/boot` partition (FAT32, readable from any computer).
- Should we pre-bundle with `bun build --compile` for faster startup?
  - Yes, single-binary deployment is simpler. Test on ARM64 first.
