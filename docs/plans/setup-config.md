# Setup & Configuration

## Problem

Today, configuration is scattered across environment variables, code defaults, and the event creation form. A new volunteer setting up the system has to know about `PORT`, database locations, and timer settings.

## Goal

A first-run wizard and settings page that handles all configuration through the UI. Plug in the laptop, open the browser, answer a few questions, and you're racing.

## First-Run Wizard

On first launch (no events in database), show a setup wizard instead of the empty event list:

### Step 1: Event Setup
- Event name (e.g., "Pack 152 Pinewood Derby 2026")
- Date
- Number of lanes (default 4)
- **Scheduled start time** — when do you want the first heat to run? (e.g., 2:00 PM)
- **Target end time** — when do you need to be done? (e.g., 4:30 PM)

These times feed the projector display countdown and the late-start warning. See [Display Plan](./display-pubsub.md) for how the countdown works.

### Step 2: Network Info
- Display the server's local IP address and QR code
- "Share this with volunteers so they can connect on their phones"
- Auto-detect WiFi interface and show the right address

### Step 3: Timer Hardware (Optional)
- "Do you have an electronic timer?"
  - **No** → manual entry mode (current default)
  - **Yes, USB serial** → show detected serial ports, let them pick one, run a quick test
  - **Yes, WiFi/HTTP** → show the hardware endpoint URL and token

### Step 3b: Awards (Optional)

Pick which people's choice awards you want families to vote on. Check the ones you want, add your own, or skip entirely.

```
☑  Most Creative Car
☑  Best Paint Job
☐  Funniest Car
☐  Most Aerodynamic (looks)
☐  Most Scout-Like
☐  Most Colorful
☐  Best Name
☐  Pack Spirit Award
─────────────────────
+  Add your own...
```

Selected awards are created as voting categories automatically. The MC opens and closes voting from the race control screen during the awards ceremony.

→ See [Voting Plan](./voting.md) for how voting works during the event.

### Step 4: Ready
- Summary of settings
- **Roster Preload** (Optional): Upload a CSV of racer names and dens so check-in is a tap, not a form. See format below.
- "Start Registration" button → goes to registration view

### Roster CSV Format

```csv
name,den,car_number
Dean Kim,Wolves,101
Lyile Bowers,Bears,102
```

`car_number` is optional — can be assigned at the desk. `den` maps to the known den images.

## Settings Page

Accessible from the nav bar (gear icon). Sections:

### General
- Event name and date (editable)
- Lane count (only changeable before heats are generated)
- App port (requires restart)

### Network
- Current server IP + QR code
- Display page URL for projector
- Certificate page URL

### Timer
- Current mode: Manual / Serial / HTTP
- Serial port selection and test button
- Hardware token for HTTP mode

### Data
- **Roster Preload**: Upload CSV to add racers in bulk.
- **Registration Capacity**: Note to set up 4+ stations for large events.
- Export event data (JSON)
- Import event data
- Reset event (with confirmation)
- Database backup/restore

## Implementation Notes

- Settings stored in a `settings` table in SQLite (key-value)
- First-run detection: check if any events exist
- QR code: use a lightweight library or generate SVG inline
- Serial port detection: `SerialPort.list()` via Bun's native module support or a system call to `ls /dev/tty.*`
- Network detection: `os.networkInterfaces()` to find the WiFi/ethernet IP

## Open Questions

- Should settings be per-event or global?
  - **Lean toward global** with per-event overrides for lane count
- How to handle mid-event lane count changes?
  - Block after heats are generated. If they need to change, delete heats first.
