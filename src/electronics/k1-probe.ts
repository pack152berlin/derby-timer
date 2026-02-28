import { SerialPort } from "serialport";

type TerminatorMode = "cr" | "lf" | "crlf";
type ParityMode = "none" | "even" | "odd";

type CliOptions = {
  showHelp: boolean;
  listPorts: boolean;
  portPath?: string;
  timeoutSeconds: number;
  baudRates: number[];
  terminators: TerminatorMode[];
  commands: string[];
  includeAltFraming: boolean;
  includeControlLineSweep: boolean;
  sampleByteLimit: number;
};

type ProbeTest = {
  name: string;
  baudRate: number;
  dataBits: 8 | 7;
  parity: ParityMode;
  stopBits: 1;
  terminator: TerminatorMode;
  controlSignals?: {
    dtr: boolean;
    rts: boolean;
  };
};

type ProbeResult = {
  test: ProbeTest;
  totalBytes: number;
  nullBytes: number;
  printableBytes: number;
  sampleHex: string;
  sampleText: string;
  error?: string;
};

const terminatorByMode: Record<TerminatorMode, string> = {
  cr: "\r",
  lf: "\n",
  crlf: "\r\n",
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const parsePositiveInteger = (value: string, label: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer. Received: ${value}`);
  }
  return parsed;
};

const parseBaudList = (value: string) => {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => parsePositiveInteger(item, "Baud rate"));

  if (values.length === 0) {
    throw new Error("--baud-list must include at least one baud rate.");
  }

  return values;
};

const parseTerminatorList = (value: string) => {
  const values = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error("--eol-list must include at least one mode.");
  }

  const parsed: TerminatorMode[] = [];
  for (const item of values) {
    if (item !== "cr" && item !== "lf" && item !== "crlf") {
      throw new Error(`Unsupported eol mode in --eol-list: ${item}`);
    }
    parsed.push(item);
  }

  return parsed;
};

const parseCommandList = (value: string) => {
  return value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
};

const parseArguments = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    showHelp: false,
    listPorts: false,
    timeoutSeconds: 2,
    baudRates: [9600, 2400, 4800, 19200],
    terminators: ["cr", "lf", "crlf"],
    commands: ["N1", "RV", "RG", "RM"],
    includeAltFraming: true,
    includeControlLineSweep: true,
    sampleByteLimit: 32,
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
      case "--timeout": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--timeout requires a value.");
        }
        options.timeoutSeconds = parsePositiveInteger(value, "Timeout");
        index += 1;
        break;
      }
      case "--baud-list": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--baud-list requires a value.");
        }
        options.baudRates = parseBaudList(value);
        index += 1;
        break;
      }
      case "--eol-list": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--eol-list requires a value.");
        }
        options.terminators = parseTerminatorList(value);
        index += 1;
        break;
      }
      case "--commands": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--commands requires a value.");
        }
        options.commands = parseCommandList(value);
        index += 1;
        break;
      }
      case "--sample-bytes": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--sample-bytes requires a value.");
        }
        options.sampleByteLimit = parsePositiveInteger(value, "Sample byte count");
        index += 1;
        break;
      }
      case "--no-alt-framing":
        options.includeAltFraming = false;
        break;
      case "--no-control-sweep":
        options.includeControlLineSweep = false;
        break;
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

const printHelp = () => {
  console.log(
    [
      "K1 Timer serial probe",
      "",
      "Purpose:",
      "  Run low-level serial matrix tests and report whether readable RX data exists.",
      "",
      "Usage:",
      "  bun run serial:k1:probe --list",
      "  bun run serial:k1:probe --port /dev/cu.usbserial-XXXX [options]",
      "",
      "Options:",
      "  --list                 List serial ports and exit",
      "  --port <path>          Serial device path",
      "  --timeout <sec>        Wait time per probe test (default: 2)",
      "  --baud-list <list>     Comma-separated baud rates (default: 9600,2400,4800,19200)",
      "  --eol-list <list>      Comma-separated terminators: cr,lf,crlf",
      "  --commands <list>      Commands to send per test (default: N1,RV,RG,RM)",
      "  --sample-bytes <n>     Max bytes shown in sample (default: 32)",
      "  --no-alt-framing       Skip 7E1 and 7O1 checks",
      "  --no-control-sweep     Skip DTR/RTS combinations",
      "  --help                 Show this help",
      "",
      "Exit code:",
      "  0 when readable RX text is detected, 1 otherwise",
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

const byteIsPrintableAscii = (value: number) => {
  return value === 9 || value === 10 || value === 13 || (value >= 32 && value <= 126);
};

const summarizeSampleText = (buffer: Buffer) => {
  let text = "";
  for (const byte of buffer) {
    if (byte >= 32 && byte <= 126) {
      text += String.fromCharCode(byte);
      continue;
    }

    if (byte === 10) {
      text += "\\n";
      continue;
    }
    if (byte === 13) {
      text += "\\r";
      continue;
    }
    if (byte === 9) {
      text += "\\t";
      continue;
    }

    text += ".";
  }
  return text;
};

const runProbeTest = async (
  portPath: string,
  test: ProbeTest,
  commands: string[],
  timeoutMilliseconds: number,
  sampleByteLimit: number
): Promise<ProbeResult> => {
  const port = new SerialPort({
    path: portPath,
    baudRate: test.baudRate,
    dataBits: test.dataBits,
    stopBits: test.stopBits,
    parity: test.parity,
    autoOpen: false,
  });

  const receivedChunks: Buffer[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      port.open((openError) => {
        if (openError) {
          reject(openError);
          return;
        }
        resolve();
      });
    });

    port.on("data", (chunk: Buffer) => {
      receivedChunks.push(Buffer.from(chunk));
    });

    if (test.controlSignals) {
      await new Promise<void>((resolve, reject) => {
        port.set(test.controlSignals!, (setError) => {
          if (setError) {
            reject(setError);
            return;
          }
          resolve();
        });
      });
      await sleep(80);
    }

    const terminator = terminatorByMode[test.terminator];
    for (const command of commands) {
      await writeCommand(port, command, terminator);
      await sleep(300);
    }

    await sleep(timeoutMilliseconds);

    await new Promise<void>((resolve) => {
      port.close(() => resolve());
    });

    const combined = Buffer.concat(receivedChunks);
    const sample = combined.subarray(0, sampleByteLimit);
    let nullBytes = 0;
    let printableBytes = 0;
    for (const value of combined) {
      if (value === 0) nullBytes += 1;
      if (byteIsPrintableAscii(value)) printableBytes += 1;
    }

    return {
      test,
      totalBytes: combined.length,
      nullBytes,
      printableBytes,
      sampleHex: sample.toString("hex"),
      sampleText: summarizeSampleText(sample),
    };
  } catch (error) {
    if (port.isOpen) {
      await new Promise<void>((resolve) => {
        port.close(() => resolve());
      });
    }

    return {
      test,
      totalBytes: 0,
      nullBytes: 0,
      printableBytes: 0,
      sampleHex: "",
      sampleText: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const buildProbeTests = (options: CliOptions) => {
  const tests: ProbeTest[] = [];

  for (const baudRate of options.baudRates) {
    for (const terminator of options.terminators) {
      tests.push({
        name: `${baudRate}/8N1/${terminator.toUpperCase()}`,
        baudRate,
        dataBits: 8,
        parity: "none",
        stopBits: 1,
        terminator,
      });
    }
  }

  if (options.includeAltFraming) {
    tests.push({
      name: "9600/7E1/CR",
      baudRate: 9600,
      dataBits: 7,
      parity: "even",
      stopBits: 1,
      terminator: "cr",
    });
    tests.push({
      name: "9600/7O1/CR",
      baudRate: 9600,
      dataBits: 7,
      parity: "odd",
      stopBits: 1,
      terminator: "cr",
    });
  }

  if (options.includeControlLineSweep) {
    const controlStates: Array<{ dtr: boolean; rts: boolean }> = [
      { dtr: false, rts: false },
      { dtr: true, rts: false },
      { dtr: false, rts: true },
      { dtr: true, rts: true },
    ];

    for (const state of controlStates) {
      tests.push({
        name: `9600/8N1/CR DTR=${state.dtr ? "1" : "0"} RTS=${state.rts ? "1" : "0"}`,
        baudRate: 9600,
        dataBits: 8,
        parity: "none",
        stopBits: 1,
        terminator: "cr",
        controlSignals: state,
      });
    }
  }

  return tests;
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

  const tests = buildProbeTests(options);
  const timeoutMilliseconds = options.timeoutSeconds * 1000;

  console.log(`Probe target: ${options.portPath}`);
  console.log(`Tests: ${tests.length}`);
  console.log(`Commands per test: ${options.commands.join(", ") || "(none)"}`);
  console.log(`Capture window: ${options.timeoutSeconds}s per test`);
  console.log("");

  const results: ProbeResult[] = [];

  for (const [index, test] of tests.entries()) {
    console.log(`[${index + 1}/${tests.length}] ${test.name}`);
    const result = await runProbeTest(
      options.portPath,
      test,
      options.commands,
      timeoutMilliseconds,
      options.sampleByteLimit
    );
    results.push(result);

    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
      continue;
    }

    const sampleHex = result.sampleHex || "(none)";
    const sampleText = result.sampleText || "(none)";
    console.log(
      `  RX bytes=${result.totalBytes} printable=${result.printableBytes} null=${result.nullBytes}`
    );
    console.log(`  sampleHex=${sampleHex}`);
    console.log(`  sampleText=${sampleText}`);
  }

  console.log("");

  const hadErrors = results.some((result) => Boolean(result.error));
  const hadPrintableRx = results.some((result) => result.printableBytes > 0);
  const totalReceivedBytes = results.reduce((sum, result) => sum + result.totalBytes, 0);
  const nonNullBytes = results.reduce(
    (sum, result) => sum + (result.totalBytes - result.nullBytes),
    0
  );

  if (hadPrintableRx) {
    console.log("PASS: readable serial RX data detected.");
    process.exit(0);
    return;
  }

  if (totalReceivedBytes === 0) {
    console.log("FAIL: no RX data observed in any probe test.");
    console.log(
      "Likely causes: wrong cable topology, timer not transmitting, or serial path not connected."
    );
    process.exit(1);
    return;
  }

  if (nonNullBytes === 0) {
    console.log("FAIL: RX observed only as NUL bytes (00) across probe tests.");
    console.log(
      "Likely causes: electrical/protocol mismatch (wrong RS-232 chain, level conversion issue, or timer TX path fault)."
    );
    process.exit(1);
    return;
  }

  if (hadErrors) {
    console.log("FAIL: probe completed with serial errors and no readable RX data.");
    process.exit(1);
    return;
  }

  console.log("FAIL: RX data observed, but not readable text.");
  console.log("Try narrowing settings with --baud-list and --eol-list, then retest.");
  process.exit(1);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
