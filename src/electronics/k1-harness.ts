import { SerialPort } from "serialport";
import { parseRaceDataLine, type LaneTiming } from "./k1-protocol";

type TerminatorMode = "cr" | "lf" | "crlf";

type CliOptions = {
  showHelp: boolean;
  listPorts: boolean;
  portPath?: string;
  baudRate: number;
  maxLaneCount: number;
  minLaneCount: number;
  requiredRacePackets: number;
  timeoutSeconds: number;
  commandTerminator: TerminatorMode;
  showRawLines: boolean;
  sendDefaultInit: boolean;
  initCommands: string[];
};

const terminatorByMode: Record<TerminatorMode, string> = {
  cr: "\r",
  lf: "\n",
  crlf: "\r\n",
};

const parsePositiveInteger = (value: string, label: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer. Received: ${value}`);
  }
  return parsed;
};

const normalizeCommands = (value: string) => {
  return value
    .split(",")
    .map((command) => command.trim().toUpperCase())
    .filter(Boolean);
};

const parseArguments = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    showHelp: false,
    listPorts: false,
    baudRate: 9600,
    maxLaneCount: 4,
    minLaneCount: 1,
    requiredRacePackets: 1,
    timeoutSeconds: 90,
    commandTerminator: "cr",
    showRawLines: false,
    sendDefaultInit: true,
    initCommands: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument) {
      continue;
    }

    switch (argument) {
      case "--help":
      case "-h":
        options.showHelp = true;
        break;
      case "--list":
        options.listPorts = true;
        break;
      case "--port": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--port requires a value.");
        }
        options.portPath = value;
        index += 1;
        break;
      }
      case "--baud": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--baud requires a value.");
        }
        options.baudRate = parsePositiveInteger(value, "Baud rate");
        index += 1;
        break;
      }
      case "--lanes": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--lanes requires a value.");
        }
        options.maxLaneCount = parsePositiveInteger(value, "Lane count");
        index += 1;
        break;
      }
      case "--min-lanes": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--min-lanes requires a value.");
        }
        options.minLaneCount = parsePositiveInteger(value, "Minimum lane count");
        index += 1;
        break;
      }
      case "--races": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--races requires a value.");
        }
        options.requiredRacePackets = parsePositiveInteger(value, "Race packet count");
        index += 1;
        break;
      }
      case "--timeout": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--timeout requires a value.");
        }
        options.timeoutSeconds = parsePositiveInteger(value, "Timeout");
        index += 1;
        break;
      }
      case "--eol": {
        const value = argv[index + 1]?.toLowerCase();
        if (!value) {
          throw new Error("--eol requires one of cr, lf, crlf.");
        }
        if (value !== "cr" && value !== "lf" && value !== "crlf") {
          throw new Error(`Unsupported eol mode: ${value}`);
        }
        options.commandTerminator = value;
        index += 1;
        break;
      }
      case "--raw":
        options.showRawLines = true;
        break;
      case "--no-init":
        options.sendDefaultInit = false;
        break;
      case "--init": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--init requires a comma-delimited command list.");
        }
        options.initCommands.push(...normalizeCommands(value));
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (options.minLaneCount > options.maxLaneCount) {
    throw new Error("--min-lanes cannot be greater than --lanes.");
  }

  return options;
};

const getCliArgs = () => {
  if (typeof Bun !== "undefined" && Array.isArray(Bun.argv)) {
    return Bun.argv.slice(2);
  }
  return process.argv.slice(2);
};

const printHelp = () => {
  console.log(
    [
      "K1 Timer hardware test harness",
      "",
      "Purpose:",
      "  Validate that the timer electronics are producing race timing data.",
      "",
      "Usage:",
      "  bun run serial:k1:harness --list",
      "  bun run serial:k1:harness --port /dev/tty.usbserial-XXXX [options]",
      "",
      "Options:",
      "  --list               List serial ports and exit",
      "  --port <path>        Serial device path",
      "  --baud <rate>        Baud rate (default: 9600)",
      "  --lanes <count>      Max lane count to parse (default: 4)",
      "  --min-lanes <count>  Minimum timed lanes required per race packet (default: 1)",
      "  --races <count>      Number of race packets required to pass (default: 1)",
      "  --timeout <sec>      Overall test timeout in seconds (default: 90)",
      "  --raw                Print raw serial lines in addition to parsed data",
      "  --no-init            Do not send default init commands (N1, MG, RV, RG)",
      "  --init <commands>    Extra startup commands, comma-delimited (example: LX3,MG)",
      "  --eol <mode>         Command terminator: cr | lf | crlf (default: cr)",
      "  --help               Show this help",
      "",
      "Exit code:",
      "  0 on pass, 1 on fail",
    ].join("\n")
  );
};

const listSerialPorts = async () => {
  const ports = await SerialPort.list();
  if (ports.length === 0) {
    console.log("No serial ports found.");
    return;
  }

  for (const port of ports) {
    const parts = [port.path];
    if (port.manufacturer) parts.push(port.manufacturer);
    if (port.serialNumber) parts.push(`SN:${port.serialNumber}`);
    if (port.vendorId && port.productId) {
      parts.push(`VID:PID ${port.vendorId}:${port.productId}`);
    }
    console.log(parts.join("  |  "));
  }
};

const formatLaneSummary = (laneResults: LaneTiming[]) => {
  return laneResults
    .map((lane) => {
      const place = lane.place ? ` (${lane.place})` : "";
      return `L${lane.laneNumber}=${lane.timeSeconds.toFixed(3)}s${place}`;
    })
    .join("  ");
};

const writeCommand = async (
  port: SerialPort,
  command: string,
  terminator: string
) => {
  await new Promise<void>((resolve, reject) => {
    port.write(`${command}${terminator}`, (writeError) => {
      if (writeError) {
        reject(writeError);
        return;
      }

      port.drain((drainError) => {
        if (drainError) {
          reject(drainError);
          return;
        }
        resolve();
      });
    });
  });
};

const main = async () => {
  let options: CliOptions;

  try {
    options = parseArguments(getCliArgs());
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Failed to parse command line arguments"
    );
    printHelp();
    process.exit(1);
    return;
  }

  if (options.showHelp) {
    printHelp();
    return;
  }

  if (options.listPorts) {
    await listSerialPorts();
    return;
  }

  if (!options.portPath) {
    console.error("Missing required --port argument.");
    await listSerialPorts();
    process.exit(1);
    return;
  }

  const commandTerminator = terminatorByMode[options.commandTerminator];
  const startupCommands = [
    ...(options.sendDefaultInit ? ["N1", "MG", "RV", "RG"] : []),
    ...options.initCommands,
  ];

  const port = new SerialPort({
    path: options.portPath,
    baudRate: options.baudRate,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    autoOpen: true,
  });

  let commandQueue = Promise.resolve();
  let rxBuffer = "";
  const decoder = new TextDecoder();

  let capturedRacePackets = 0;
  let lastDeviceLine: string | null = null;
  let finished = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const finish = async (passed: boolean, message: string) => {
    if (finished) {
      return;
    }

    finished = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    console.log("");
    console.log(message);
    console.log(
      `Race packets captured: ${capturedRacePackets}/${options.requiredRacePackets}`
    );
    if (lastDeviceLine) {
      console.log(`Last device response: ${lastDeviceLine}`);
    }

    await commandQueue;

    if (port.isOpen) {
      await new Promise<void>((resolve) => {
        port.close(() => resolve());
      });
    }

    process.exit(passed ? 0 : 1);
  };

  const queueCommand = (commandLiteral: string) => {
    const command = commandLiteral.trim().toUpperCase();
    if (command.length === 0) {
      return;
    }

    commandQueue = commandQueue
      .then(async () => {
        await writeCommand(port, command, commandTerminator);
        console.log(`[TX] ${command}`);
      })
      .catch((error) => {
        console.error(
          error instanceof Error
            ? `Failed to send ${command}: ${error.message}`
            : `Failed to send ${command}`
        );
      });
  };

  port.on("open", () => {
    console.log(`Connected: ${options.portPath} @ ${options.baudRate} baud (8N1)`);
    console.log(`Test target: ${options.requiredRacePackets} race packet(s)`);
    console.log(`Per-race minimum timed lanes: ${options.minLaneCount}`);
    console.log(`Timeout: ${options.timeoutSeconds} seconds`);
    console.log("");
    console.log("Run the start gate and send at least one car through the finish.");
    console.log("The harness will pass once enough timing packets are captured.");
    console.log("");

    startupCommands.forEach(queueCommand);

    timeoutHandle = setTimeout(() => {
      void finish(
        false,
        `FAIL: timed out after ${options.timeoutSeconds}s without enough race packets.`
      );
    }, options.timeoutSeconds * 1000);
  });

  port.on("data", (chunk: Buffer) => {
    rxBuffer += decoder.decode(chunk, { stream: true });
    const lines = rxBuffer.split(/\r\n|\r|\n/g);
    rxBuffer = lines.pop() ?? "";

    for (const candidate of lines) {
      const line = candidate.replace(/\u0000/g, "").trim();
      if (line.length === 0) {
        continue;
      }

      lastDeviceLine = line;

      if (options.showRawLines) {
        console.log(`[RX] ${line}`);
      }

      const parsed = parseRaceDataLine(line, {
        maxLaneCount: options.maxLaneCount,
      });

      if (!parsed) {
        if (!options.showRawLines) {
          console.log(`Device: ${line}`);
        }
        continue;
      }

      if (parsed.laneResults.length < options.minLaneCount) {
        console.log(
          `Ignoring race packet with ${parsed.laneResults.length} lane(s): ${parsed.rawLine}`
        );
        continue;
      }

      capturedRacePackets += 1;

      console.log(
        `Race packet ${capturedRacePackets}/${options.requiredRacePackets}: ${formatLaneSummary(
          parsed.laneResults
        )}`
      );

      if (capturedRacePackets >= options.requiredRacePackets) {
        void finish(true, "PASS: timer produced valid race timing data.");
        return;
      }
    }
  });

  port.on("error", (error) => {
    void finish(false, `FAIL: serial error: ${error.message}`);
  });

  port.on("close", () => {
    if (!finished) {
      void finish(false, "FAIL: serial port closed unexpectedly.");
    }
  });

  process.on("SIGINT", () => {
    void finish(false, "Stopped by user.");
  });
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
