# K1 Serial Script

This repo now includes a standalone script that talks to a Micro Wizard K1/K1CS timer over a USB-to-serial adapter.

For teammate-friendly validation steps, see `docs/electronics/serial-bus-test-checklist.md`.

## What it does

- Opens a serial port (default `9600` baud, `8N1`, no flow control)
- Optionally sends setup commands (`N1` by default)
- Parses race timing lines like `A=3.001! B=3.015" C=3.028# D=3.041$`
- Prints timing output as human-readable text or JSON lines

## Quick start

```bash
bun run serial:k1 --list
bun run serial:k1 --port /dev/tty.usbserial-XXXX --lanes 4
```

## Hardware test harness

Use this when you want a simple pass/fail check for electronics timing:

```bash
# Find serial device
bun run serial:k1:harness --list

# Require one valid race packet within 90 seconds
bun run serial:k1:harness --port /dev/tty.usbserial-XXXX

# Require 3 race packets and at least 2 timed lanes each
bun run serial:k1:harness --port /dev/tty.usbserial-XXXX --races 3 --min-lanes 2
```

The harness exits with code `0` on pass and `1` on fail, so it is scriptable.

## Useful flags

```bash
# Show every incoming line, including non-race output
bun run serial:k1 --port /dev/tty.usbserial-XXXX --raw

# Emit JSON lines (easy to pipe to another process)
bun run serial:k1 --port /dev/tty.usbserial-XXXX --json

# Send commands on connect
bun run serial:k1 --port /dev/tty.usbserial-XXXX --init MG,LX3 --send RV

# Disable auto-format command (skip sending N1)
bun run serial:k1 --port /dev/tty.usbserial-XXXX --format none
```

## Interactive mode

Once connected, you can type commands and press Enter:

- `RV` - return firmware version and serial number
- `RM` - read mode
- `RG` - return start-switch status
- `RA` - force results
- `MG` - unmask all lanes
- `N0` / `N1` / `N2` - change output data format

Type `exit` or `quit` to close the script.

## Notes from the hardware docs

- FUNterm examples indicate default timer serial settings (9600 baud, 8N1, no hardware flow control)
- Commands are sent with an Enter key in their software; this script uses `CR` by default and supports `--eol lf` or `--eol crlf` if needed
- New-format timing lines (`N1`) include finish-order punctuation after each lane time
