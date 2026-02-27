import { SerialPort } from "serialport";
import { parseRaceDataLine } from "./k1-protocol";

type OutputMode = "pretty" | "json";
type TimerFormat = "n0" | "n1" | "n2" | "none";
type TerminatorMode = "cr" | "lf" | "crlf";

type CliOptions = {
  showHelp: boolean;
  listPorts: boolean;
  portPath?: string;
  baudRate: number;
  maxLaneCount: number;
  outputMode: OutputMode;
  showRawLines: boolean;
  timerFormat: TimerFormat;
  startupCommands: string[];
  singleRunCommands: string[];
  useStdinCommands: boolean;
  commandTerminator: TerminatorMode;
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
    outputMode: "pretty",
    showRawLines: false,
    timerFormat: "n1",
    startupCommands: [],
    singleRunCommands: [],
    useStdinCommands: true,
    commandTerminator: "cr",
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
      case "--json":
        options.outputMode = "json";
        break;
      case "--raw":
        options.showRawLines = true;
        break;
      case "--format": {
        const value = argv[index + 1]?.toLowerCase();
        if (!value) {
          throw new Error("--format requires one of n0, n1, n2, none.");
        }
        if (value !== "n0" && value !== "n1" && value !== "n2" && value !== "none") {
          throw new Error(`Unsupported format: ${value}`);
        }
        options.timerFormat = value;
        index += 1;
        break;
      }
      case "--init": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--init requires a comma-delimited command list.");
        }
        options.startupCommands.push(...normalizeCommands(value));
        index += 1;
        break;
      }
      case "--send": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--send requires a command.");
        }
        options.singleRunCommands.push(value.trim().toUpperCase());
        index += 1;
        break;
      }
      case "--no-stdin":
        options.useStdinCommands = false;
        break;
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
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
};

const getCliArgs = () => {
  if (typeof Bun !== "undefined" && Array.isArray(Bun.argv)) {
    return Bun.argv.slice(2);
  }
  return process.argv.slice(2);
};

const terminatorByMode: Record<TerminatorMode, string> = {
  cr: "\r",
  lf: "\n",
  crlf: "\r\n",
};

const ordinal = (value: number) => {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`;
  const remainder = value % 10;
  if (remainder === 1) return `${value}st`;
  if (remainder === 2) return `${value}nd`;
  if (remainder === 3) return `${value}rd`;
  return `${value}th`;
};

const printHelp = () => {
  console.log(
    [
      "K1 Timer serial utility",
      "",
      "Usage:",
      "  bun run serial:k1 --list",
      "  bun run serial:k1 --port /dev/tty.usbserial-XXXX [options]",
      "",
      "Options:",
      "  --list              List serial ports and exit",
      "  --port <path>       Serial device path",
      "  --baud <rate>       Baud rate (default: 9600)",
      "  --lanes <count>     Max lane count to parse (default: 4)",
      "  --format <mode>     Timer format command: n0 | n1 | n2 | none (default: n1)",
      "  --init <commands>   Startup commands, comma-delimited (example: MG,LX3)",
      "  --send <command>    Send one command after connect (repeatable)",
      "  --eol <mode>        Command terminator: cr | lf | crlf (default: cr)",
      "  --json              Emit parsed output as JSON lines",
      "  --raw               Also print raw serial lines",
      "  --no-stdin          Disable interactive stdin command entry",
      "  --help              Show this help",
      "",
      "Interactive mode:",
      "  Type commands like RV, RG, RA, RM and press Enter.",
      "  Type exit or quit to stop.",
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

  const outputJson = options.outputMode === "json";
  const emit = (message: string) => {
    console.log(message);
  };

  const emitEvent = (type: string, payload: Record<string, unknown>) => {
    if (outputJson) {
      emit(
        JSON.stringify({
          type,
          timestamp: new Date().toISOString(),
          ...payload,
        })
      );
      return;
    }

    if (type === "status") {
      const message = payload.message;
      if (typeof message === "string") {
        emit(message);
      }
      return;
    }

    if (type === "tx") {
      const command = payload.command;
      if (typeof command === "string") {
        emit(`[TX] ${command}`);
      }
      return;
    }

    if (type === "raw") {
      const line = payload.line;
      if (typeof line === "string") {
        emit(`[RX] ${line}`);
      }
      return;
    }

    if (type === "race") {
      const raceNumber = payload.raceNumber;
      const laneResults = payload.laneResults;
      if (typeof raceNumber !== "number" || !Array.isArray(laneResults)) {
        return;
      }

      const laneSummary = laneResults
        .map((lane) => {
          if (typeof lane !== "object" || lane === null) {
            return null;
          }
          const laneRecord = lane as {
            laneNumber?: number;
            timeSeconds?: number;
            place?: number;
          };

          if (
            typeof laneRecord.laneNumber !== "number" ||
            typeof laneRecord.timeSeconds !== "number"
          ) {
            return null;
          }

          const placeText =
            typeof laneRecord.place === "number" ? ` (${ordinal(laneRecord.place)})` : "";
          return `L${laneRecord.laneNumber}=${laneRecord.timeSeconds.toFixed(3)}s${placeText}`;
        })
        .filter((value): value is string => value !== null)
        .join("  ");

      emit(`Race ${raceNumber}: ${laneSummary}`);
      return;
    }

    if (type === "line") {
      const line = payload.line;
      if (typeof line === "string") {
        emit(`Device: ${line}`);
      }
    }
  };

  const port = new SerialPort({
    path: options.portPath,
    baudRate: options.baudRate,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    autoOpen: true,
  });

  const commandTerminator = terminatorByMode[options.commandTerminator];
  let commandQueue = Promise.resolve();
  let raceCounter = 0;
  let rxBuffer = "";
  const decoder = new TextDecoder();

  const queueCommand = (commandLiteral: string) => {
    const command = commandLiteral.trim().toUpperCase();
    if (command.length === 0) {
      return;
    }

    commandQueue = commandQueue
      .then(async () => {
        await writeCommand(port, command, commandTerminator);
        emitEvent("tx", { command });
      })
      .catch((error) => {
        emitEvent("status", {
          message:
            error instanceof Error
              ? `Failed to send command ${command}: ${error.message}`
              : `Failed to send command ${command}`,
        });
      });
  };

  port.on("open", () => {
    emitEvent("status", {
      message: `Connected to ${options.portPath} @ ${options.baudRate} baud (8N1, no flow control).`,
    });

    if (options.timerFormat !== "none") {
      queueCommand(options.timerFormat.toUpperCase());
    }

    options.startupCommands.forEach(queueCommand);
    options.singleRunCommands.forEach(queueCommand);

    if (options.useStdinCommands && process.stdin.isTTY) {
      emitEvent("status", {
        message: "Type timer commands and press Enter (exit, quit to stop).",
      });
    }
  });

  port.on("data", (chunk: Buffer<ArrayBufferLike>) => {
    rxBuffer += decoder.decode(chunk, { stream: true });
    const lines = rxBuffer.split(/\r\n|\r|\n/g);
    rxBuffer = lines.pop() ?? "";

    for (const candidate of lines) {
      const line = candidate.replace(/\u0000/g, "").trim();
      if (line.length === 0) {
        continue;
      }

      if (options.showRawLines) {
        emitEvent("raw", { line });
      }

      const parsed = parseRaceDataLine(line, {
        maxLaneCount: options.maxLaneCount,
      });

      if (parsed) {
        raceCounter += 1;
        emitEvent("race", {
          raceNumber: raceCounter,
          rawLine: parsed.rawLine,
          laneResults: parsed.laneResults,
        });
      } else if (!options.showRawLines) {
        emitEvent("line", { line });
      }
    }
  });

  port.on("error", (error) => {
    emitEvent("status", {
      message: `Serial port error: ${error.message}`,
    });
  });

  port.on("close", () => {
    emitEvent("status", { message: "Serial port closed." });
  });

  if (options.useStdinCommands) {
    process.stdin.setEncoding("utf8");

    let stdinBuffer = "";
    process.stdin.on("data", (chunk: string) => {
      stdinBuffer += chunk;
      const lines = stdinBuffer.split(/\r\n|\r|\n/g);
      stdinBuffer = lines.pop() ?? "";

      for (const candidate of lines) {
        const command = candidate.trim();
        if (!command) {
          continue;
        }

        const lowered = command.toLowerCase();
        if (lowered === "exit" || lowered === "quit") {
          process.kill(process.pid, "SIGINT");
          return;
        }

        queueCommand(command);
      }
    });

    process.stdin.resume();
  }

  let closing = false;
  const closePort = async () => {
    if (closing) {
      return;
    }
    closing = true;

    await commandQueue;

    if (!port.isOpen) {
      process.exit(0);
      return;
    }

    await new Promise<void>((resolve) => {
      port.close(() => resolve());
    });

    process.exit(0);
  };

  process.on("SIGINT", () => {
    emitEvent("status", { message: "Shutting down..." });
    void closePort();
  });
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
