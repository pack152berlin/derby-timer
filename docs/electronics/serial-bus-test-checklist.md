# Serial Bus Test Checklist

Use this checklist when validating that the timer electronics are talking over USB serial and producing race timing packets.

## 1) Pre-flight setup

- Power the timer board and connect the DB9 serial side to your USB-to-serial adapter.
- Plug the USB adapter into the laptop running this repo.
- Make sure no other serial app is open (Arduino Serial Monitor, terminal app, etc).

## 2) Identify the serial port

```bash
bun run serial:k1:harness --list
```

Expected: you see one or more `/dev/tty.*` entries. Pick the USB serial device path.

## 3) Run the pass/fail harness

```bash
# Basic check: pass after 1 valid race packet
bun run serial:k1:harness --port /dev/tty.usbserial-XXXX

# Stronger check: require 3 packets in 2+ lanes
bun run serial:k1:harness --port /dev/tty.usbserial-XXXX --races 3 --min-lanes 2 --timeout 120
```

While it runs, trigger the start gate and roll cars through the finish sensors.

Expected pass output includes lines like:

```text
Connected: /dev/tty.usbserial-XXXX @ 9600 baud (8N1)
[TX] N1
[TX] MG
Race packet 1/3: L1=3.001s (1)  L2=3.047s (2)
...
PASS: timer produced valid race timing data.
```

Exit code expectations:

- `0` = pass
- `1` = fail (timeout, serial error, or no valid race packets)

## 4) If it fails, do live debug

```bash
bun run serial:k1 --port /dev/tty.usbserial-XXXX --raw
```

In interactive mode, type:

- `RV` (expect firmware/version response)
- `RG` (expect `1` or `0` depending on start switch state)
- `N1` (force new timing format)
- `MG` (unmask all lanes)

Then run a test heat again and watch for race lines (`A=... B=...`).

## 5) Common issues

- Wrong serial device selected -> run `--list` again and retry.
- Port in use -> close other serial tools and rerun.
- Wrong adapter/cable behavior -> retry with `--eol lf` or `--eol crlf`.
- No sensor events -> check timer power, start/reset switch wiring, sensor alignment, and ambient light conditions.
