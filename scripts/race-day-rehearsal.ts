type HeatStatus = "pending" | "running" | "complete";

interface EventRecord {
  id: string;
  status: "draft" | "checkin" | "racing" | "complete";
}

interface RacerRecord {
  id: string;
}

interface HeatLane {
  lane_number: number;
  racer_id: string;
}

interface HeatRecord {
  id: string;
  status: HeatStatus;
  round: number;
  heat_number: number;
  lanes: HeatLane[];
}

interface StandingRecord {
  racer_id: string;
  car_number: string;
  wins: number;
  losses: number;
}

interface ActiveHeatResponse {
  heatId: string | null;
  running: boolean;
  elapsedMs: number;
}

type Config = {
  port: number;
  dbPath: string;
  keepDb: boolean;
  carCount: number;
  laneCount: number;
  rounds: number;
  lookahead: 2 | 3;
  preRestartHeats: number;
  eventName: string;
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const parseArgs = (args: string[]) => {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let idx = 0; idx < args.length; idx++) {
    const arg = args[idx];
    if (!arg || !arg.startsWith("--")) {
      continue;
    }

    const trimmed = arg.slice(2);
    const equalsAt = trimmed.indexOf("=");

    if (equalsAt >= 0) {
      const key = trimmed.slice(0, equalsAt);
      const value = trimmed.slice(equalsAt + 1);
      values.set(key, value);
      continue;
    }

    const next = args[idx + 1];
    if (next && !next.startsWith("--")) {
      values.set(trimmed, next);
      idx++;
      continue;
    }

    flags.add(trimmed);
  }

  return { values, flags };
};

const getPositiveInt = (rawValue: string | undefined, fallback: number, label: string) => {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${rawValue}`);
  }

  return parsed;
};

const parseConfig = (): Config => {
  const { values, flags } = parseArgs(Bun.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const port = getPositiveInt(values.get("port"), 3100, "port");
  const carCount = getPositiveInt(values.get("cars"), 50, "cars");
  const laneCount = getPositiveInt(values.get("lanes"), 4, "lanes");
  const rounds = getPositiveInt(values.get("rounds"), 1, "rounds");
  const preRestartHeats = getPositiveInt(
    values.get("pre-restart-heats"),
    20,
    "pre-restart-heats"
  );
  const rawLookahead = getPositiveInt(values.get("lookahead"), 2, "lookahead");
  if (rawLookahead !== 2 && rawLookahead !== 3) {
    throw new Error(`Invalid lookahead: ${rawLookahead}. Expected 2 or 3.`);
  }

  const dbPath = values.get("db") ?? `/tmp/derby-rehearsal-${timestamp}.db`;
  const eventName = values.get("event-name") ?? `Race Day Rehearsal ${timestamp}`;

  return {
    port,
    dbPath,
    keepDb: flags.has("keep-db"),
    carCount,
    laneCount,
    rounds,
    lookahead: rawLookahead,
    preRestartHeats,
    eventName,
  };
};

const fetchJson = async <T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const rawText = await response.text();
  const parsed = rawText.length > 0 ? JSON.parse(rawText) : null;

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) ${path}: ${JSON.stringify(parsed)}`);
  }

  return parsed as T;
};

const waitForServer = async (baseUrl: string, timeoutMs = 20000) => {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/events`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(`Server did not become ready within ${timeoutMs}ms: ${String(lastError)}`);
};

const startServer = (config: Config) => {
  return Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: process.cwd(),
    stdout: "ignore",
    stderr: "ignore",
    env: {
      ...Bun.env,
      PORT: String(config.port),
      DERBY_DB_PATH: config.dbPath,
    },
  });
};

const stopServer = async (server: Bun.Subprocess | null) => {
  if (!server) {
    return;
  }

  server.kill();
  const exited = await Promise.race([
    server.exited.then(() => true),
    delay(3000).then(() => false),
  ]);

  if (!exited) {
    server.kill("SIGKILL");
    await server.exited;
  }
};

const restartServer = async (server: Bun.Subprocess | null, config: Config, baseUrl: string) => {
  await stopServer(server);
  const restartedServer = startServer(config);
  await waitForServer(baseUrl);
  return restartedServer;
};

const getNextHeat = async (baseUrl: string, eventId: string) => {
  const heats = await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${eventId}/heats`);
  return heats.find((heat) => heat.status === "running") ?? heats.find((heat) => heat.status === "pending") ?? null;
};

const buildResults = (heat: HeatRecord) => {
  const orderedLanes = [...heat.lanes].sort((left, right) => left.lane_number - right.lane_number);
  return orderedLanes.map((lane, index) => ({
    lane_number: lane.lane_number,
    racer_id: lane.racer_id,
    place: index + 1,
    time_ms: 3000 + index * 10,
  }));
};

const runSingleHeat = async (baseUrl: string, eventId: string) => {
  const nextHeat = await getNextHeat(baseUrl, eventId);
  if (!nextHeat) {
    return false;
  }

  let activeHeat = nextHeat;
  if (activeHeat.status === "pending") {
    await fetchJson<HeatRecord>(baseUrl, `/api/heats/${activeHeat.id}/start`, { method: "POST" });
    const refreshedHeat = await fetchJson<HeatRecord>(baseUrl, `/api/heats/${activeHeat.id}`);
    activeHeat = refreshedHeat;
  }

  await fetchJson(baseUrl, `/api/heats/${activeHeat.id}/results`, {
    method: "POST",
    body: JSON.stringify({ results: buildResults(activeHeat) }),
  });

  return true;
};

const main = async () => {
  const config = parseConfig();
  const baseUrl = `http://localhost:${config.port}`;
  let server: Bun.Subprocess | null = null;
  let success = false;

  console.log(`Running race-day rehearsal on ${baseUrl}`);
  console.log(
    `cars=${config.carCount} lanes=${config.laneCount} rounds=${config.rounds} lookahead=${config.lookahead}`
  );
  console.log(`db=${config.dbPath}`);

  try {
    if (!config.keepDb) {
      await Bun.$`rm -f ${config.dbPath}`;
    }

    server = startServer(config);
    await waitForServer(baseUrl);

    const createdEvent = await fetchJson<EventRecord>(baseUrl, "/api/events", {
      method: "POST",
      body: JSON.stringify({
        name: config.eventName,
        date: new Date().toISOString().slice(0, 10),
        lane_count: config.laneCount,
      }),
    });

    const eventId = createdEvent.id;
    const racerIds: string[] = [];

    for (let index = 1; index <= config.carCount; index++) {
      const racer = await fetchJson<RacerRecord>(baseUrl, `/api/events/${eventId}/racers`, {
        method: "POST",
        body: JSON.stringify({
          name: `Rehearsal Racer ${index}`,
          den: null,
          car_number: String(100 + index),
        }),
      });
      racerIds.push(racer.id);
    }

    for (const racerId of racerIds) {
      await fetchJson(baseUrl, `/api/racers/${racerId}/inspect`, {
        method: "POST",
        body: JSON.stringify({ weight_ok: true }),
      });
    }

    await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${eventId}/generate-heats`, {
      method: "POST",
      body: JSON.stringify({
        rounds: config.rounds,
        lookahead: config.lookahead,
        lane_count: config.laneCount,
      }),
    });

    for (let i = 0; i < config.preRestartHeats; i++) {
      const progressed = await runSingleHeat(baseUrl, eventId);
      if (!progressed) {
        break;
      }
    }

    const runningHeat = await getNextHeat(baseUrl, eventId);
    if (!runningHeat) {
      throw new Error("Expected a heat to be available before restart");
    }

    if (runningHeat.status === "pending") {
      await fetchJson<HeatRecord>(baseUrl, `/api/heats/${runningHeat.id}/start`, { method: "POST" });
    }

    const activeBeforeRestart = await fetchJson<ActiveHeatResponse>(baseUrl, "/api/race/active");
    if (!activeBeforeRestart.running) {
      throw new Error("Expected an active running heat before restart");
    }
    if (!activeBeforeRestart.heatId) {
      throw new Error("Expected active heat id before restart");
    }

    server = await restartServer(server, config, baseUrl);

    const activeAfterRestart = await fetchJson<ActiveHeatResponse>(baseUrl, "/api/race/active");
    if (!activeAfterRestart.running) {
      throw new Error("Expected active heat to survive restart");
    }
    if (activeAfterRestart.heatId !== activeBeforeRestart.heatId) {
      throw new Error(
        `Running heat mismatch after restart: ${activeBeforeRestart.heatId} vs ${activeAfterRestart.heatId}`
      );
    }

    for (let i = 0; i < 5000; i++) {
      const event = await fetchJson<EventRecord>(baseUrl, `/api/events/${eventId}`);
      if (event.status === "complete") {
        break;
      }

      const progressed = await runSingleHeat(baseUrl, eventId);
      if (!progressed) {
        break;
      }
    }

    const finalEvent = await fetchJson<EventRecord>(baseUrl, `/api/events/${eventId}`);
    const finalHeats = await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${eventId}/heats`);
    const finalStandings = await fetchJson<StandingRecord[]>(baseUrl, `/api/events/${eventId}/standings`);

    const incompleteHeats = finalHeats.filter((heat) => heat.status !== "complete");
    if (finalEvent.status !== "complete") {
      throw new Error(`Event did not complete: status=${finalEvent.status}`);
    }
    if (incompleteHeats.length > 0) {
      throw new Error(`Found ${incompleteHeats.length} incomplete heats`);
    }
    if (finalStandings.length !== config.carCount) {
      throw new Error(
        `Expected ${config.carCount} standings rows, found ${finalStandings.length}`
      );
    }

    console.log(
      JSON.stringify(
        {
          eventId,
          eventStatus: finalEvent.status,
          totalHeats: finalHeats.length,
          standingsCount: finalStandings.length,
          winner: finalStandings[0]
            ? {
                racer_id: finalStandings[0].racer_id,
                car_number: finalStandings[0].car_number,
                wins: finalStandings[0].wins,
                losses: finalStandings[0].losses,
              }
            : null,
          restartCheck: {
            before: activeBeforeRestart,
            after: activeAfterRestart,
          },
          dbPath: config.dbPath,
        },
        null,
        2
      )
    );

    console.log("Race-day rehearsal PASSED");
    success = true;
  } finally {
    await stopServer(server);

    if (!config.keepDb && success) {
      await Bun.$`rm -f ${config.dbPath}`;
    }
  }
};

await main();
