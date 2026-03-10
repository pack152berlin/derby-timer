# Hardware Compatibility

## Approach

DerbyTimer doesn't teach you how to build sensors — it ships firmware images and serial parsers so supported hardware just works out of the box.

For each supported device, we provide:
- A **flashable firmware image** (for programmable boards like ESP32/Arduino)
- Or a **serial parser** (for commercial timers like Micro Wizard K1)

Plug in, flash (if needed), and the hardware talks to DerbyTimer automatically via the [Hardware API](./hardware-api.md).

## Compatibility Matrix

| Device | Connection | Integration | Status |
|--------|-----------|-------------|--------|
| Micro Wizard K1/K1CS | USB Serial (9600 8N1) | Serial parser (built-in) | Supported |
| BestTrack | USB Serial | Serial parser | Planned |
| ESP32 (any dev board) | WiFi HTTP or USB Serial | Flash DerbyTimer firmware | Planned |
| Arduino Uno/Nano | USB Serial | Flash DerbyTimer firmware | Planned |
| Raspberry Pi Pico | USB Serial | Flash DerbyTimer firmware | Planned |

## Commercial Timers

### Micro Wizard K1/K1CS

No firmware flash needed — these have their own firmware. DerbyTimer includes a serial parser that reads their output format.

**What you need**: K1 timer + DB9-to-USB serial adapter (~$10)

**Connect**:
```bash
bun run serial:k1:bridge --port /dev/tty.usbserial-XXXX --server http://localhost:3000
```

Existing docs: [`electronics/k1-serial-script.md`](../electronics/k1-serial-script.md), [`electronics/serial-bus-test-checklist.md`](../electronics/serial-bus-test-checklist.md)

### BestTrack

Same idea — serial parser, no firmware flash. Protocol documentation exists in the timer community. Parser not yet implemented.

## Flashable Firmware Images

For programmable boards (ESP32, Arduino, Pico), we provide pre-built firmware that:

1. Reads finish-line sensors (IR break-beam, laser, or photoresistor — whatever you've wired)
2. Detects start gate (microswitch or reed switch)
3. Sends results to DerbyTimer via the [Hardware API](./hardware-api.md)
4. Requires zero code from the user — just flash and configure lane count

### ESP32 Firmware

Flash via USB:
```bash
# Download and flash (one-time)
bun run firmware:flash --board esp32 --port /dev/tty.usbserial-XXXX

# Or download the .bin from releases and flash with esptool
esptool.py write_flash 0x0 derby-timer-esp32.bin
```

On boot, the ESP32 creates a WiFi config portal. Connect, enter the DerbyTimer server address, and it's ready.

**Supported sensor wiring**: Any break-beam or switch-based sensor connected to GPIO pins. The firmware is configurable for 2–6 lanes and supports IR, laser, or mechanical sensors.

### Arduino Firmware

Flash via Arduino IDE or CLI:
```bash
bun run firmware:flash --board arduino-nano --port /dev/tty.usbserial-XXXX
```

Arduino connects via USB serial (same as commercial timers). The serial parser auto-detects DerbyTimer firmware vs commercial timer output.

### Raspberry Pi Pico Firmware

Drag-and-drop `.uf2` file:
1. Hold BOOTSEL button, plug in USB
2. Drag `derby-timer-pico.uf2` to the mounted drive
3. Pico reboots and starts sending results over USB serial

## Testing Any Hardware

```bash
# Verify serial communication
bun run serial:k1:harness --port /dev/tty.usbserial-XXXX --races 1

# Verify HTTP communication (ESP32 WiFi mode)
curl -X POST http://localhost:3000/api/hardware/results \
  -H "Content-Type: application/json" \
  -d '{"lanes":[{"lane":1,"time_ms":3001},{"lane":2,"time_ms":3047}]}'
```

Full checklist: [`electronics/serial-bus-test-checklist.md`](../electronics/serial-bus-test-checklist.md)

## Adding Support for New Hardware

To add a new commercial timer, write a serial parser in `scripts/serial-*.ts` that:
1. Opens the serial port at the correct baud rate
2. Parses race timing lines into `{ lane, time_ms, place }` objects
3. POSTs results to `/api/hardware/results`

To add a new microcontroller, create firmware that speaks the DerbyTimer serial protocol or HTTP API.
